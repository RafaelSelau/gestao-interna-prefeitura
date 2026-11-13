"""Small SQLite/PostgreSQL compatibility layer used by the existing API."""
from __future__ import annotations

import re


ID_TABLES = {
    "users", "departments", "sectors", "people", "audit_log", "demands",
    "demand_events", "personal_tasks", "personal_task_events", "work_events",
    "work_event_history", "personal_documents", "personal_notifications",
    "productivity_activity",
}


class Row(dict):
    """Mapping row that preserves sqlite3.Row's numeric indexing behavior."""
    def __getitem__(self, key):
        if isinstance(key, int):
            return tuple(self.values())[key]
        return super().__getitem__(key)


class Cursor:
    def __init__(self, cursor, lastrowid=None):
        self._cursor = cursor
        self.lastrowid = lastrowid

    @property
    def rowcount(self):
        return self._cursor.rowcount

    def fetchone(self):
        value = self._cursor.fetchone()
        return Row(value) if value is not None else None

    def fetchall(self):
        return [Row(value) for value in self._cursor.fetchall()]

    def __iter__(self):
        for value in self._cursor:
            yield Row(value)


class PostgresConnection:
    def __init__(self, dsn: str):
        import psycopg
        from psycopg.rows import dict_row

        self._connection = psycopg.connect(dsn, connect_timeout=10, row_factory=dict_row,
                                          prepare_threshold=None)

    @staticmethod
    def _translate(sql: str) -> tuple[str, bool]:
        ignore = bool(re.match(r"\s*INSERT\s+OR\s+IGNORE\s+INTO\b", sql, re.I))
        if ignore:
            sql = re.sub(r"(\s*INSERT)\s+OR\s+IGNORE\s+(INTO\b)", r"\1 \2", sql, count=1, flags=re.I)
        sql = sql.replace("?", "%s")
        sql = re.sub(r"\binstr\s*\(", "strpos(", sql, flags=re.I)
        return sql, ignore

    def execute(self, sql: str, params=()):
        translated, ignore = self._translate(sql)
        match = re.match(r"\s*INSERT\s+INTO\s+([a-z_]+)\b", translated, re.I)
        returning_id = bool(match and match.group(1).lower() in ID_TABLES and
                            not re.search(r"\bRETURNING\b", translated, re.I))
        if ignore and not re.search(r"\bON\s+CONFLICT\b", translated, re.I):
            translated = translated.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"
        if returning_id:
            translated = translated.rstrip().rstrip(";") + " RETURNING id"
        cursor = self._connection.execute(translated, params)
        lastrowid = None
        if returning_id and cursor.description:
            row = cursor.fetchone()
            lastrowid = row["id"] if row else None
        return Cursor(cursor, lastrowid)

    def executemany(self, sql: str, params):
        translated, _ = self._translate(sql)
        return Cursor(self._connection.cursor().executemany(translated, params))

    def activate_user(self, auth_user_id: str | None):
        if not auth_user_id:
            raise PermissionError("Esta conta ainda não está vinculada ao Supabase Auth.")
        import json
        self._connection.execute("SET LOCAL ROLE authenticated")
        self._connection.execute("SELECT set_config('request.jwt.claim.sub', %s, true)", (auth_user_id,))
        self._connection.execute("SELECT set_config('request.jwt.claims', %s, true)",
                                  (json.dumps({"sub": auth_user_id, "role": "authenticated"}),))
        self._connection.execute("SELECT set_config('sigam.backend', '1', true)")

    def executescript(self, script: str):
        cursor = None
        for statement in script.split(";"):
            if statement.strip():
                cursor = self.execute(statement)
        return cursor

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()

    def close(self):
        self._connection.close()
