"""One-time, opt-in import of reviewed SIGPM SQLite data into Supabase."""
from __future__ import annotations

import argparse
import mimetypes
import os
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import psycopg
from psycopg import sql


ORDER = [
    "users", "system_flags", "departments", "sectors", "people", "user_units",
    "protocol_sequences", "demands", "demand_events", "employee_profiles",
    "work_events", "work_event_history", "personal_tasks", "personal_task_events",
    "personal_documents", "personal_plans", "personal_notifications",
    "personal_notification_preferences", "productivity_activity",
]
SKIP = {"sessions", "audit_log"}  # sessions must be reissued; audit chain starts in the new DB


def tables(connection):
    return {row[0] for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}


def main():
    parser = argparse.ArgumentParser(description="Import a reviewed local SQLite database into Supabase PostgreSQL.")
    parser.add_argument("--source", default="backend/sigpm.sqlite3", help="SQLite file to import")
    parser.add_argument("--apply", action="store_true", help="perform the import; without this flag only show counts")
    args = parser.parse_args()
    source = Path(args.source).resolve()
    if not source.is_file():
        parser.error(f"SQLite file not found: {source}")
    required = ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        parser.error("Set DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this terminal.")

    local = sqlite3.connect(source)
    local.row_factory = sqlite3.Row
    local_tables = tables(local)
    unknown = local_tables - set(ORDER) - SKIP
    if unknown:
        parser.error("Source contains tables absent from the Supabase migration; review them before importing.")
    if "system_flags" in local_tables and local.execute(
            "SELECT 1 FROM system_flags WHERE flag='demo_seeded' LIMIT 1").fetchone():
        parser.error("The selected database is marked as a demo database. Choose a reviewed non-demo SQLite database.")

    demo_users = {row[0] for row in local.execute(
        "SELECT id FROM users WHERE username='demo.gestor' OR lower(username) LIKE '%@example.invalid' "
        "OR display_name LIKE '%Demonstração%' ")}
    demo_departments = {row[0] for row in local.execute(
        "SELECT id FROM departments WHERE name='Secretaria Demonstrativa'")}
    emails = {row[0]: row[1] for row in local.execute(
        "SELECT user_id,work_email FROM employee_profiles WHERE work_email LIKE '%@%' AND work_email NOT LIKE '% %'")}
    excluded = {"users": set(demo_users), "departments": set(demo_departments)}
    plans = []
    for table in ORDER:
        if table not in local_tables:
            continue
        columns = [row[1] for row in local.execute(f'PRAGMA table_info("{table}")')]
        rows = [dict(row) for row in local.execute(f'SELECT * FROM "{table}"')]
        foreign_keys = [(row[3], row[2]) for row in local.execute(f'PRAGMA foreign_key_list("{table}")')]
        keep = []
        for row in rows:
            if table == "personal_documents" and not args.apply:
                pass
            blocked = False
            if table in {"users", "departments"} and row.get("id") in excluded.get(table, set()):
                blocked = True
            if table == "departments" and row.get("name") == "Secretaria Demonstrativa":
                blocked = True
            if table == "users" and row.get("id") in emails and "@" not in str(row.get("username") or ""):
                row["username"] = emails[row["id"]]
            if table == "system_flags" and row.get("flag") == "demo_seeded":
                blocked = True
            if table in SKIP:
                blocked = True
            for column, referenced_table in foreign_keys:
                if row.get(column) in excluded.get(referenced_table, set()):
                    blocked = True
            if blocked:
                if "id" in row:
                    excluded.setdefault(table, set()).add(row["id"])
                continue
            keep.append(row)
        plans.append((table, columns, keep))

    print(f"Fonte: {source}")
    print("Registros a importar (sem sessões e trilha de auditoria antiga):")
    for table, _, rows in plans:
        print(f"  {table}: {len(rows)}")
    print(f"Contas e registros de demonstração reconhecidos e excluídos: {sum(map(len, excluded.values()))}")
    if not args.apply:
        print("Prévia apenas. Revise os totais; para importar, repita com --apply.")
        return 0

    storage_files = []
    for table, _, rows in plans:
        if table == "personal_documents":
            for row in rows:
                file_path = source.parent / "private_files" / str(row["user_id"]) / row["stored_name"]
                if not file_path.is_file():
                    parser.error("A base contém documentos sem o arquivo local correspondente; nada foi importado.")
                storage_files.append((row, file_path))

    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    with psycopg.connect(os.environ["DATABASE_URL"], prepare_threshold=None) as target:
        with target.cursor() as cursor:
            for table, _, _ in plans:
                cursor.execute(sql.SQL("SELECT count(*) FROM public.{}").format(sql.Identifier(table)))
                if cursor.fetchone()[0]:
                    parser.error("O destino já contém dados. Use um projeto Supabase vazio para a primeira importação.")
            for table, columns, rows in plans:
                if not rows:
                    continue
                # Keep only fields present in the Supabase schema (auth_user_id is newly added).
                cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s", (table,))
                target_columns = {item[0] for item in cursor.fetchall()}
                selected = [column for column in columns if column in target_columns]
                statement = sql.SQL("INSERT INTO public.{} ({}) VALUES ({})").format(
                    sql.Identifier(table), sql.SQL(",").join(map(sql.Identifier, selected)),
                    sql.SQL(",").join(sql.Placeholder() for _ in selected))
                cursor.executemany(statement, [tuple(row.get(column) for column in selected) for row in rows])
            for table, _, _ in plans:
                if any("id" == row[1] for row in local.execute(f'PRAGMA table_info("{table}")')):
                    cursor.execute(sql.SQL(
                        "SELECT setval(pg_get_serial_sequence(%s,'id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM public.{}"
                    ).format(sql.Identifier(table)), (f"public.{table}",))
            # Upload inside the PostgreSQL transaction so an upload failure rolls back the data copy.
            # Upsert permits a clean retry if an earlier run uploaded some objects before failing.
            for row, file_path in storage_files:
                object_path = "/".join(urllib.parse.quote(part, safe="") for part in
                                       (str(row["user_id"]), row["stored_name"]))
                mime = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
                request = urllib.request.Request(
                    f"{base}/storage/v1/object/sigam-documentos/{object_path}",
                    data=file_path.read_bytes(), method="POST",
                    headers={"Content-Type": mime, "apikey": key,
                             "Authorization": f"Bearer {key}", "x-upsert": "true"})
                try:
                    with urllib.request.urlopen(request, timeout=30):
                        pass
                except urllib.error.HTTPError as error:
                    print("Storage upload failed; the PostgreSQL transaction will roll back.", file=sys.stderr)
                    raise SystemExit(1) from error
    local.close()
    print("Import completed. Existing passwords are linked to Supabase Auth on first login when their username is an email.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
