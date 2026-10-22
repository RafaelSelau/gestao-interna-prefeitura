"""Primeira fatia da API do SIGPM, usando apenas a biblioteca padrão.

Este serviço é adequado para desenvolvimento local. Para produção, configure HTTPS,
segredos gerenciados, política institucional de retenção e revisão de segurança.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import base64
import mimetypes
import os
import secrets
import sqlite3
import time
import uuid
from datetime import date, datetime, timedelta
from contextlib import contextmanager
from http import HTTPStatus
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = Path(__file__).resolve().parent / "sigpm.sqlite3"
ROLES = {"admin", "gestor", "atendente", "consulta"}
ROLE_PERMISSIONS = {
    "admin": {"*"},
    "gestor": {"departments:read", "sectors:read", "sectors:write", "demands:read", "demands:create", "demands:forward", "demands:act", "demands:reopen"},
    "atendente": {"departments:read", "sectors:read", "demands:read", "demands:create", "demands:act"},
    "consulta": {"departments:read", "sectors:read", "demands:read"},
}
SESSION_SECONDS = 8 * 60 * 60
INITIAL_DEPARTMENTS = (
    "Administração",
    "Assistência Social",
    "Educação",
    "Finanças",
    "Meio Ambiente",
    "Obras e Serviços Urbanos",
    "Saúde",
    "Transportes",
)
DEMAND_STATUSES = {"aberta", "aguardando_triagem", "encaminhada", "em_atendimento",
                   "aguardando_informacoes", "aguardando_outro_setor", "em_execucao",
                   "aguardando_validacao", "resolvida", "encerrada", "cancelada"}
STATUS_TRANSITIONS = {
    "aberta": {"aguardando_triagem", "encaminhada", "em_atendimento", "aguardando_informacoes", "cancelada"},
    "aguardando_triagem": {"encaminhada", "em_atendimento", "aguardando_informacoes", "cancelada"},
    "encaminhada": {"em_atendimento", "aguardando_outro_setor", "aguardando_informacoes", "cancelada"},
    "em_atendimento": {"aguardando_informacoes", "aguardando_outro_setor", "em_execucao", "aguardando_validacao", "resolvida", "cancelada"},
    "aguardando_informacoes": {"em_atendimento", "cancelada"},
    "aguardando_outro_setor": {"encaminhada", "em_atendimento", "cancelada"},
    "em_execucao": {"aguardando_validacao", "resolvida", "aguardando_outro_setor", "cancelada"},
    "aguardando_validacao": {"em_execucao", "resolvida", "cancelada"},
    "resolvida": {"encerrada"}, "encerrada": set(), "cancelada": set(),
}


def connect(path: str | Path) -> sqlite3.Connection:
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


@contextmanager
def database(path: str | Path):
    db = connect(path)
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize(path: str | Path) -> None:
    with database(path) as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','gestor','atendente','consulta')),
          active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS system_flags (flag TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS departments (
          id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sectors (
          id INTEGER PRIMARY KEY, department_id INTEGER NOT NULL REFERENCES departments(id),
          name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(department_id, name)
        );
        CREATE TABLE IF NOT EXISTS people (
          id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('fisica','juridica')),
          name TEXT NOT NULL, document TEXT, email TEXT, phone TEXT, active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(document)
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
          csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES users(id), action TEXT NOT NULL,
          entity TEXT NOT NULL, entity_id TEXT, details TEXT NOT NULL DEFAULT '{}',
          happened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, previous_hash TEXT NOT NULL, entry_hash TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_units (
          user_id INTEGER PRIMARY KEY REFERENCES users(id), department_id INTEGER REFERENCES departments(id),
          sector_id INTEGER REFERENCES sectors(id)
        );
        CREATE TABLE IF NOT EXISTS protocol_sequences (
          year INTEGER PRIMARY KEY, last_number INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS demands (
          id INTEGER PRIMARY KEY, protocol TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL,
          category TEXT NOT NULL, department_id INTEGER NOT NULL REFERENCES departments(id),
          sector_id INTEGER REFERENCES sectors(id), assigned_user_id INTEGER REFERENCES users(id),
          requester_type TEXT NOT NULL CHECK(requester_type IN ('servidor','cidadao')),
          requester_name TEXT NOT NULL, priority TEXT NOT NULL CHECK(priority IN ('baixa','media','alta','urgente')),
          due_date TEXT, status TEXT NOT NULL CHECK(status IN ('aberta','aguardando_triagem','encaminhada','em_atendimento','aguardando_informacoes','aguardando_outro_setor','em_execucao','aguardando_validacao','resolvida','encerrada','cancelada')),
          address TEXT, solution TEXT, created_by INTEGER NOT NULL REFERENCES users(id), citizen_token_hash TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          closed_at TEXT
        );
        CREATE TABLE IF NOT EXISTS demand_events (
          id INTEGER PRIMARY KEY, demand_id INTEGER NOT NULL REFERENCES demands(id), actor_id INTEGER REFERENCES users(id),
          action TEXT NOT NULL, old_status TEXT, new_status TEXT, department_from INTEGER REFERENCES departments(id),
          department_to INTEGER REFERENCES departments(id), justification TEXT, details TEXT NOT NULL DEFAULT '{}',
          happened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS employee_profiles (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          work_email TEXT, job_title TEXT, employee_number TEXT, work_phone TEXT,
          work_hours TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS personal_tasks (
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Geral',
          start_at TEXT, due_at TEXT, priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('baixa','normal','alta','urgente')),
          status TEXT NOT NULL DEFAULT 'aberta' CHECK(status IN ('aberta','em_andamento','aguardando','concluida','cancelada')),
          observations TEXT NOT NULL DEFAULT '', source_event_id INTEGER REFERENCES work_events(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT, archived_at TEXT
        );
        CREATE TABLE IF NOT EXISTS personal_task_events (
          id INTEGER PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES personal_tasks(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, action TEXT NOT NULL,
          details TEXT NOT NULL DEFAULT '{}', happened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS work_events (
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK(kind IN ('reuniao','compromisso','entrega','prazo','atendimento','lembrete','evento_interno')),
          title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', starts_at TEXT NOT NULL, ends_at TEXT,
          location TEXT NOT NULL DEFAULT '', participants TEXT NOT NULL DEFAULT '', agenda TEXT NOT NULL DEFAULT '',
          objective TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', minutes TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'agendada' CHECK(status IN ('agendada','realizada','cancelada')),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS work_event_history (
          id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES work_events(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, action TEXT NOT NULL,
          details TEXT NOT NULL DEFAULT '{}', happened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS personal_documents (
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'outros',
          original_name TEXT NOT NULL, stored_name TEXT NOT NULL, mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL, tag TEXT NOT NULL DEFAULT '', linked_task_id INTEGER REFERENCES personal_tasks(id) ON DELETE SET NULL,
          linked_event_id INTEGER REFERENCES work_events(id) ON DELETE SET NULL,
          attention INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS personal_plans (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, plan_date TEXT NOT NULL,
          priorities TEXT NOT NULL DEFAULT '', daily_notes TEXT NOT NULL DEFAULT '', weekly_goal TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,plan_date)
        );
        CREATE TABLE IF NOT EXISTS personal_notifications (
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL,
          message TEXT NOT NULL, due_at TEXT NOT NULL, read_at TEXT,
          UNIQUE(user_id,kind,entity_type,entity_id)
        );
        CREATE TABLE IF NOT EXISTS personal_notification_preferences (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(user_id,kind)
        );
        CREATE TABLE IF NOT EXISTS productivity_activity (
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          entity_type TEXT NOT NULL, entity_id INTEGER, action TEXT NOT NULL, summary TEXT NOT NULL,
          happened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """)
        demand_columns = {row["name"] for row in db.execute("PRAGMA table_info(demands)")}
        if "citizen_token_hash" not in demand_columns:
            db.execute("ALTER TABLE demands ADD COLUMN citizen_token_hash TEXT")
        document_columns = {row["name"] for row in db.execute("PRAGMA table_info(personal_documents)")}
        if "attention" not in document_columns:
            db.execute("ALTER TABLE personal_documents ADD COLUMN attention INTEGER NOT NULL DEFAULT 0")
        if "department_id" not in document_columns:
            db.execute("ALTER TABLE personal_documents ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL")
        task_columns = {row["name"] for row in db.execute("PRAGMA table_info(personal_tasks)")}
        if "department_id" not in task_columns:
            db.execute("ALTER TABLE personal_tasks ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL")
        department_columns = {row["name"] for row in db.execute("PRAGMA table_info(departments)")}
        if "description" not in department_columns:
            db.execute("ALTER TABLE departments ADD COLUMN description TEXT NOT NULL DEFAULT ''")
        db.execute("INSERT OR IGNORE INTO users(username,display_name,password_hash,role,active) VALUES('__portal_cidadao__','Portal do cidadão','disabled$no-login','consulta',0)")
        db.executescript("""
        CREATE INDEX IF NOT EXISTS idx_personal_tasks_owner_due ON personal_tasks(user_id,due_at);
        CREATE INDEX IF NOT EXISTS idx_work_events_owner_start ON work_events(user_id,starts_at);
        CREATE INDEX IF NOT EXISTS idx_personal_documents_owner_created ON personal_documents(user_id,created_at);
        """)


def password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def password_matches(password: str, encoded: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = encoded.split("$", 2)
        if scheme != "scrypt":
            return False
        actual = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
        return hmac.compare_digest(actual.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def record_audit(db: sqlite3.Connection, actor_id: int | None, action: str, entity: str,
                 entity_id: Any = None, details: dict[str, Any] | None = None) -> None:
    previous = db.execute("SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1").fetchone()
    previous_hash = previous["entry_hash"] if previous else "0" * 64
    payload = json.dumps({"actor": actor_id, "action": action, "entity": entity,
                          "entity_id": entity_id, "details": details or {}, "previous": previous_hash},
                         ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    entry_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    db.execute("INSERT INTO audit_log(actor_id,action,entity,entity_id,details,previous_hash,entry_hash) VALUES(?,?,?,?,?,?,?)",
               (actor_id, action, entity, str(entity_id) if entity_id is not None else None,
                json.dumps(details or {}, ensure_ascii=False, sort_keys=True), previous_hash, entry_hash))


def initial_department_names(value: Any = None) -> list[str]:
    """Validate the editable department list used during the first local setup."""
    if value is None:
        candidates = list(INITIAL_DEPARTMENTS)
    elif isinstance(value, str):
        candidates = value.splitlines()
    elif isinstance(value, (list, tuple)):
        candidates = value
    else:
        raise ValueError("Informe as secretarias iniciais como uma lista de nomes.")
    names, seen = [], set()
    for item in candidates:
        name = str(item).strip()
        if not name:
            continue
        if len(name) > 120:
            raise ValueError("Cada secretaria pode ter até 120 caracteres.")
        key = name.casefold()
        if key not in seen:
            names.append(name)
            seen.add(key)
    if not names:
        raise ValueError("Cadastre pelo menos uma secretaria para liberar as demandas.")
    if len(names) > 30:
        raise ValueError("Cadastre no máximo 30 secretarias durante a configuração inicial.")
    return names


class API:
    def __init__(self, db_path: str | Path = DEFAULT_DB):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.public_attempts: dict[str, list[float]] = {}
        initialize(self.db_path)

    def __call__(self, environ, start_response):
        method, path = environ.get("REQUEST_METHOD", "GET").upper(), environ.get("PATH_INFO", "/")
        if not path.startswith("/api/"):
            return self.static(environ, start_response)
        try:
            body = self._body(environ)
            if method == "GET" and environ.get("QUERY_STRING"):
                for key, values in parse_qs(environ["QUERY_STRING"], keep_blank_values=True).items():
                    body[key] = values[-1] if values else ""
            with database(self.db_path) as db:
                if method == "GET" and path == "/api/health":
                    return self.respond(start_response, 200, {
                        "status": "ok",
                        "service": "SIGPM API",
                        "apiVersion": "sigpm-dashboard-v1",
                    })
                if path.startswith("/api/public/"):
                    return self.public_dispatch(db, method, path, body, environ, start_response)
                if method == "GET" and path == "/api/setup/status":
                    configured = bool(db.execute("SELECT 1 FROM users WHERE active=1 LIMIT 1").fetchone())
                    demo_configured = bool(db.execute("""SELECT 1 FROM system_flags f
                        WHERE f.flag='demo_seeded' AND f.value='complete' AND EXISTS (
                          SELECT 1 FROM users u JOIN employee_profiles p ON p.user_id=u.id
                          WHERE u.active=1 AND u.role='consulta' AND instr(u.username,'@')>1
                            AND p.work_email=u.username
                        ) LIMIT 1""").fetchone())
                    return self.respond(start_response, 200, {"needsAdmin": not configured,
                        "demoConfigured": demo_configured})
                if method == "POST" and path == "/api/setup/admin":
                    if environ.get("REMOTE_ADDR") not in ("127.0.0.1", "::1"):
                        return self.respond(start_response, 403, {"error": "A configuração inicial só pode ser feita localmente."})
                    username = str(body.get("username", "")).strip()
                    name = str(body.get("name", "")).strip()
                    password = str(body.get("password", ""))
                    if not username or len(username) > 80 or not name or len(name) > 180 or len(password) < 12:
                        raise ValueError("Informe usuário, nome e uma senha com pelo menos 12 caracteres.")
                    departments = initial_department_names(body.get("departments"))
                    claim = db.execute("INSERT OR IGNORE INTO system_flags(flag,value) SELECT 'initial_admin','complete' WHERE NOT EXISTS (SELECT 1 FROM users WHERE active=1)")
                    if claim.rowcount != 1:
                        return self.respond(start_response, 409, {"error": "O administrador inicial já foi criado."})
                    cur = db.execute("INSERT INTO users(username,display_name,password_hash,role) VALUES(?,?,?,'admin')",
                                     (username, name, password_hash(password)))
                    for department in departments:
                        department_cur = db.execute("INSERT INTO departments(name) VALUES(?)", (department,))
                        record_audit(db, cur.lastrowid, "create", "department", department_cur.lastrowid,
                                     {"name": department, "source": "initial_setup"})
                    record_audit(db, cur.lastrowid, "bootstrap_admin", "user", cur.lastrowid, {"username": username})
                    return self.respond(start_response, 201, {"ok": True, "departmentsCreated": len(departments),
                        "message": "Administrador inicial criado. Entre com as credenciais escolhidas."})
                if method == "POST" and path == "/api/login":
                    return self.login(db, environ, body, start_response)
                user, csrf = self.authenticate(db, environ)
                if not user:
                    return self.respond(start_response, 401, {"error": "Autenticação necessária."})
                if method == "GET" and path == "/api/me":
                    return self.respond(start_response, 200, {"id": user["id"], "username": user["username"],
                        "name": user["display_name"], "role": user["role"], "departmentId": user["department_id"],
                        "sectorId": user["sector_id"], "csrfToken": csrf})
                if method != "GET" and not hmac.compare_digest(
                        environ.get("HTTP_X_CSRF_TOKEN", ""), csrf):
                    return self.respond(start_response, 403, {"error": "Token CSRF inválido ou ausente."})
                if method == "POST" and path == "/api/logout":
                    db.execute("DELETE FROM sessions WHERE token_hash=?", (self.cookie_token_hash(environ),))
                    record_audit(db, user["id"], "logout", "session")
                    return self.respond(start_response, 200, {"ok": True}, [("Set-Cookie", self.cookie("", 0))])
                return self.dispatch(db, method, path, body, user, start_response)
        except (ValueError, json.JSONDecodeError) as error:
            return self.respond(start_response, 400, {"error": str(error)})
        except PermissionError as error:
            return self.respond(start_response, 403, {"error": str(error)})
        except sqlite3.IntegrityError as error:
            return self.respond(start_response, 409, {"error": "Conflito de dados: verifique duplicidade e vínculos.", "detail": str(error)})
        except Exception:
            return self.respond(start_response, 500, {"error": "Erro interno. Consulte os registros do servidor."})

    def static(self, environ, start_response):
        rel = environ.get("PATH_INFO", "/").lstrip("/") or "welcome.html"
        target = (ROOT / rel).resolve()
        if target == (ROOT / "produtividade.html").resolve():
            with database(self.db_path) as db:
                user, _ = self.authenticate(db, environ)
            if not user:
                start_response("302 Found", [("Location", "/portal.html"), ("Cache-Control", "no-store"), ("Content-Length", "0")])
                return [b""]
        if rel.replace("\\", "/").lower().startswith("backend/"):
            return self.respond(start_response, 404, {"error": "Arquivo não encontrado."})
        private_root = (ROOT / "backend").resolve()
        if (ROOT not in target.parents and target != ROOT) or private_root in target.parents or target == private_root or not target.is_file():
            return self.respond(start_response, 404, {"error": "Arquivo não encontrado."})
        content = target.read_bytes()
        mime = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml"}.get(target.suffix, "application/octet-stream")
        start_response("200 OK", [("Content-Type", mime), ("Content-Length", str(len(content))), ("X-Content-Type-Options", "nosniff")])
        return [content]

    @staticmethod
    def _body(environ):
        length = int(environ.get("CONTENT_LENGTH") or 0)
        if length > 12_000_000:
            raise ValueError("Corpo da requisição excede o limite de 12 MB.")
        raw = environ["wsgi.input"].read(length) if length else b"{}"
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("O corpo deve ser um objeto JSON.")
        return data

    @staticmethod
    def respond(start_response, status, data, headers=None):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        phrase = HTTPStatus(status).phrase
        start_response(f"{status} {phrase}", [("Content-Type", "application/json; charset=utf-8"),
            ("Content-Length", str(len(payload))), ("Cache-Control", "no-store"),
            ("X-Content-Type-Options", "nosniff")] + (headers or []))
        return [payload]

    @staticmethod
    def cookie(value, age=SESSION_SECONDS):
        # Secure é obrigatório quando implantado atrás de HTTPS; desenvolvimento usa loopback HTTP.
        secure = "; Secure" if os.environ.get("SIGPM_HTTPS") == "1" else ""
        return f"sigpm_session={value}; HttpOnly; SameSite=Strict; Path=/; Max-Age={age}{secure}"

    @staticmethod
    def cookie_token_hash(environ):
        cookies = {}
        for part in environ.get("HTTP_COOKIE", "").split(";"):
            if "=" in part:
                key, value = part.strip().split("=", 1)
                cookies[key] = value
        token = cookies.get("sigpm_session", "")
        return hashlib.sha256(token.encode()).hexdigest() if token else ""

    def authenticate(self, db, environ):
        token_hash = self.cookie_token_hash(environ)
        row = db.execute("SELECT s.csrf_token,u.*,uu.department_id,uu.sector_id FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN user_units uu ON uu.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1",
                         (token_hash, int(time.time()))).fetchone()
        return (row, row["csrf_token"]) if row else (None, "")

    def login(self, db, environ, body, start_response):
        username, password = str(body.get("username", "")).strip(), str(body.get("password", ""))
        row = db.execute("SELECT * FROM users WHERE username=? AND active=1", (username,)).fetchone()
        if not row or not password_matches(password, row["password_hash"]):
            record_audit(db, None, "login_failed", "session", details={"username": username[:80]})
            return self.respond(start_response, 401, {"error": "Usuário ou senha inválidos."})
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(24)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        db.execute("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)",
                   (token_hash, row["id"], csrf, int(time.time()) + SESSION_SECONDS))
        record_audit(db, row["id"], "login", "session")
        unit = db.execute("SELECT department_id,sector_id FROM user_units WHERE user_id=?", (row["id"],)).fetchone()
        return self.respond(start_response, 200, {"id": row["id"], "username": row["username"],
            "name": row["display_name"], "role": row["role"], "departmentId": unit["department_id"] if unit else None,
            "sectorId": unit["sector_id"] if unit else None, "csrfToken": csrf},
            [("Set-Cookie", self.cookie(token))])

    @staticmethod
    def allowed(user, permission):
        permissions = ROLE_PERMISSIONS[user["role"]]
        return "*" in permissions or permission in permissions

    def dispatch(self, db, method, path, body, user, start_response):
        if path == "/api/profile" and method in ("GET", "PUT"):
            return self.profile(db, method, body, user, start_response)
        if path == "/api/dashboard" and method == "GET":
            return self.dashboard(db, body, user, start_response)
        if path == "/api/plan" and method in ("GET", "PUT"):
            return self.plan(db, method, body, user, start_response)
        if path == "/api/search" and method == "GET":
            return self.global_search(db, body, user, start_response)
        if path == "/api/notifications" and method == "GET":
            return self.notifications(db, user, start_response)
        if path == "/api/notifications/preferences" and method in ("GET", "PUT"):
            return self.notification_preferences(db, method, body, user, start_response)
        if path.startswith("/api/notifications/") and method == "POST" and path.endswith("/read"):
            parts = path.strip("/").split("/")
            if len(parts) == 4 and parts[2].isdigit():
                return self.mark_notification_read(db, int(parts[2]), user, start_response)
        if path == "/api/tasks":
            if method == "GET":
                return self.list_tasks(db, body, user, start_response)
            if method == "POST":
                return self.save_task(db, method, None, body, user, start_response)
        if path.startswith("/api/tasks/"):
            parts = path.strip("/").split("/")
            if len(parts) >= 3 and parts[2].isdigit():
                task_id = int(parts[2])
                if len(parts) == 3 and method == "GET":
                    return self.get_task(db, task_id, user, start_response)
                if len(parts) == 3 and method in ("PUT", "PATCH"):
                    return self.save_task(db, method, task_id, body, user, start_response)
                if len(parts) == 3 and method == "DELETE":
                    return self.archive_task(db, task_id, user, start_response)
                if len(parts) == 4 and parts[3] == "history" and method == "GET":
                    return self.task_history(db, task_id, user, start_response)
        if path == "/api/events":
            if method == "GET":
                return self.list_work_events(db, body, user, start_response)
            if method == "POST":
                return self.save_work_event(db, method, None, body, user, start_response)
        if path.startswith("/api/events/"):
            parts = path.strip("/").split("/")
            if len(parts) >= 3 and parts[2].isdigit():
                event_id = int(parts[2])
                if len(parts) == 3 and method == "GET":
                    return self.get_work_event(db, event_id, user, start_response)
                if len(parts) == 3 and method in ("PUT", "PATCH"):
                    return self.save_work_event(db, method, event_id, body, user, start_response)
                if len(parts) == 3 and method == "DELETE":
                    return self.delete_work_event(db, event_id, user, start_response)
                if len(parts) == 4 and parts[3] == "history" and method == "GET":
                    return self.work_event_history(db, event_id, user, start_response)
                if len(parts) == 4 and parts[3] == "tasks" and method == "POST":
                    return self.task_from_meeting(db, event_id, body, user, start_response)
        if path == "/api/documents":
            if method == "GET":
                return self.list_documents(db, body, user, start_response)
            if method == "POST":
                return self.create_document(db, body, user, start_response)
        if path.startswith("/api/documents/"):
            parts = path.strip("/").split("/")
            if len(parts) >= 3 and parts[2].isdigit():
                document_id = int(parts[2])
                if len(parts) == 3 and method == "GET":
                    return self.get_document(db, document_id, user, start_response)
                if len(parts) == 3 and method in ("PUT", "PATCH"):
                    return self.update_document(db, document_id, body, user, start_response)
                if len(parts) == 3 and method == "DELETE":
                    return self.archive_document(db, document_id, user, start_response)
                if len(parts) == 4 and parts[3] == "download" and method == "GET":
                    return self.download_document(db, document_id, user, start_response)
        if path.startswith("/api/departments/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[2].isdigit():
                department_id = int(parts[2])
                if method == "GET":
                    if not self.allowed(user, "departments:read"):
                        return self.respond(start_response, 403, {"error": "Seu perfil não permite esta operação."})
                    status, result = self.get_department(db, department_id, user, start_response)
                    return self.respond(start_response, status, result)
                if method in ("PUT", "PATCH"):
                    if not self.allowed(user, "departments:write"):
                        return self.respond(start_response, 403, {"error": "Seu perfil não permite esta operação."})
                    status, result = self.update_department(db, department_id, body, user, start_response)
                    return self.respond(start_response, status, result)
                if method == "DELETE":
                    if not self.allowed(user, "departments:write"):
                        return self.respond(start_response, 403, {"error": "Seu perfil não permite esta operação."})
                    status, result = self.delete_department(db, department_id, user, start_response)
                    return self.respond(start_response, status, result)
        routes = {
            ("GET", "/api/departments"): ("departments:read", self.list_departments),
            ("POST", "/api/departments"): ("departments:write", self.create_department),
            ("GET", "/api/sectors"): ("sectors:read", self.list_sectors),
            ("POST", "/api/sectors"): ("sectors:write", self.create_sector),
            ("GET", "/api/people"): ("people:read", self.list_people),
            ("POST", "/api/people"): ("people:write", self.create_person),
            ("GET", "/api/audit"): ("audit:read", self.list_audit),
            ("GET", "/api/users"): ("users:read", self.list_users),
            ("POST", "/api/users"): ("users:write", self.create_user),
            ("GET", "/api/demands"): ("demands:read", self.list_demands),
            ("POST", "/api/demands"): ("demands:create", self.create_demand),
        }
        if path.startswith("/api/demands/"):
            parts = path.strip("/").split("/")
            if len(parts) in (3, 4) and parts[2].isdigit():
                demand_id = int(parts[2])
                if len(parts) == 3 and method == "GET":
                    return self.get_demand(db, demand_id, user, start_response)
                if len(parts) == 4 and parts[3] == "history" and method == "GET":
                    return self.get_demand_history(db, demand_id, user, start_response)
                if len(parts) == 4 and parts[3] == "actions" and method == "POST":
                    return self.demand_action(db, demand_id, body, user, start_response)
        route = routes.get((method, path))
        if not route:
            return self.respond(start_response, 404, {"error": "Rota não encontrada."})
        permission, handler = route
        if not self.allowed(user, permission):
            return self.respond(start_response, 403, {"error": "Seu perfil não permite esta operação."})
        status, result = handler(db, body, user)
        return self.respond(start_response, status, result)

    @staticmethod
    def list_departments(db, body, user):
        rows = db.execute("""SELECT d.id,d.name,d.description,d.active,d.created_at,
            (SELECT COUNT(*) FROM personal_tasks t WHERE t.department_id=d.id AND t.user_id=? AND t.archived_at IS NULL) AS task_count,
            (SELECT COUNT(*) FROM personal_documents x WHERE x.department_id=d.id AND x.user_id=? AND x.active=1) AS document_count
            FROM departments d ORDER BY d.name""", (user["id"], user["id"]))
        return 200, [dict(row) for row in rows]

    @staticmethod
    def create_department(db, body, user):
        name = str(body.get("name", "")).strip()
        if not name or len(name) > 120:
            raise ValueError("Informe o nome da secretaria (até 120 caracteres).")
        description = str(body.get("description") or "").strip()
        if len(description) > 1000:
            raise ValueError("A descrição deve ter até 1.000 caracteres.")
        cur = db.execute("INSERT INTO departments(name,description) VALUES(?,?)", (name, description))
        record_audit(db, user["id"], "create", "department", cur.lastrowid, {"name": name})
        return 201, {"id": cur.lastrowid, "name": name, "description": description, "active": 1}

    @staticmethod
    def get_department(db, department_id, user, start_response):
        row = db.execute("""SELECT d.id,d.name,d.description,d.active,d.created_at,
            (SELECT COUNT(*) FROM personal_tasks t WHERE t.department_id=d.id AND t.user_id=? AND t.archived_at IS NULL) AS task_count,
            (SELECT COUNT(*) FROM personal_documents x WHERE x.department_id=d.id AND x.user_id=? AND x.active=1) AS document_count
            FROM departments d WHERE d.id=?""", (user["id"], user["id"], department_id)).fetchone()
        if not row:
            return 404, {"error": "Secretaria não encontrada."}
        return 200, dict(row)

    @staticmethod
    def update_department(db, department_id, body, user, start_response):
        current = db.execute("SELECT * FROM departments WHERE id=?", (department_id,)).fetchone()
        if not current:
            return 404, {"error": "Secretaria não encontrada."}
        name = str(body.get("name", current["name"]) or "").strip()
        description = str(body.get("description", current["description"]) or "").strip()
        if not name or len(name) > 120 or len(description) > 1000:
            raise ValueError("Informe um nome válido e uma descrição de até 1.000 caracteres.")
        db.execute("UPDATE departments SET name=?,description=? WHERE id=?", (name, description, department_id))
        record_audit(db, user["id"], "update", "department", department_id, {"name": name})
        return API.get_department(db, department_id, user, start_response)

    @staticmethod
    def delete_department(db, department_id, user, start_response):
        current = db.execute("SELECT name FROM departments WHERE id=?", (department_id,)).fetchone()
        if not current:
            return 404, {"error": "Secretaria não encontrada."}
        references = {
            "setores": db.execute("SELECT COUNT(*) FROM sectors WHERE department_id=?", (department_id,)).fetchone()[0],
            "contas vinculadas": db.execute("SELECT COUNT(*) FROM user_units WHERE department_id=?", (department_id,)).fetchone()[0],
            "demandas": db.execute("SELECT COUNT(*) FROM demands WHERE department_id=?", (department_id,)).fetchone()[0],
            "tarefas": db.execute("SELECT COUNT(*) FROM personal_tasks WHERE department_id=?", (department_id,)).fetchone()[0],
            "documentos": db.execute("SELECT COUNT(*) FROM personal_documents WHERE department_id=?", (department_id,)).fetchone()[0],
        }
        linked = [label for label, count in references.items() if count]
        if linked:
            return 409, {"error": "A secretaria possui vínculos e não pode ser excluída.", "references": linked}
        db.execute("DELETE FROM departments WHERE id=?", (department_id,))
        record_audit(db, user["id"], "delete", "department", department_id, {"name": current["name"]})
        return 200, {"ok": True, "deleted": True}

    @staticmethod
    def list_sectors(db, body, user):
        rows = db.execute("SELECT s.id,s.department_id,d.name AS department,s.name,s.active FROM sectors s JOIN departments d ON d.id=s.department_id ORDER BY d.name,s.name")
        return 200, [dict(row) for row in rows]

    @staticmethod
    def create_sector(db, body, user):
        name = str(body.get("name", "")).strip()
        department_id = body.get("departmentId")
        if not name or len(name) > 120 or not str(department_id or "").isdigit():
            raise ValueError("Informe um setor válido e o identificador da secretaria.")
        if user["role"] != "admin" and user["department_id"] != int(department_id):
            raise PermissionError("Gestores só podem cadastrar setores na própria secretaria.")
        cur = db.execute("INSERT INTO sectors(department_id,name) VALUES(?,?)", (int(department_id), name))
        record_audit(db, user["id"], "create", "sector", cur.lastrowid, {"departmentId": int(department_id), "name": name})
        return 201, {"id": cur.lastrowid, "departmentId": int(department_id), "name": name, "active": 1}

    @staticmethod
    def list_people(db, body, user):
        query = str(body.get("q", "")).strip()
        if query:
            rows = db.execute("SELECT id,kind,name,document,email,phone,active,created_at,updated_at FROM people WHERE active=1 AND (name LIKE ? OR document LIKE ?) ORDER BY name LIMIT 100", (f"%{query}%", f"%{query}%"))
        else:
            rows = db.execute("SELECT id,kind,name,document,email,phone,active,created_at,updated_at FROM people WHERE active=1 ORDER BY name LIMIT 100")
        return 200, [dict(row) for row in rows]

    @staticmethod
    def create_person(db, body, user):
        kind, name = body.get("kind"), str(body.get("name", "")).strip()
        document = str(body.get("document", "")).strip() or None
        if kind not in ("fisica", "juridica") or not name or len(name) > 180:
            raise ValueError("Informe tipo (fisica/juridica) e nome válido.")
        cur = db.execute("INSERT INTO people(kind,name,document,email,phone) VALUES(?,?,?,?,?)",
                         (kind, name, document, str(body.get("email", "")).strip() or None,
                          str(body.get("phone", "")).strip() or None))
        record_audit(db, user["id"], "create", "person", cur.lastrowid, {"kind": kind, "name": name})
        return 201, {"id": cur.lastrowid, "kind": kind, "name": name, "document": document}

    @staticmethod
    def create_user(db, body, user):
        username, name = str(body.get("username", "")).strip(), str(body.get("name", "")).strip()
        password, role = str(body.get("password", "")), body.get("role")
        if not username or len(username) > 80 or not name or len(name) > 180:
            raise ValueError("Informe usuário e nome válidos.")
        if role not in ROLES or len(password) < 12:
            raise ValueError("Perfil inválido ou senha menor que 12 caracteres.")
        department_id, sector_id = body.get("departmentId"), body.get("sectorId")
        if role != "admin" and not department_id:
            raise ValueError("Vincule o servidor a uma secretaria para limitar a fila de atendimento.")
        if department_id is not None and not str(department_id).isdigit():
            raise ValueError("Secretaria inválida.")
        if sector_id is not None and not str(sector_id).isdigit():
            raise ValueError("Setor inválido.")
        if sector_id and not department_id:
            raise ValueError("Informe também a secretaria vinculada ao setor.")
        if sector_id and not db.execute("SELECT 1 FROM sectors WHERE id=? AND department_id=?", (int(sector_id), int(department_id))).fetchone():
            raise ValueError("O setor informado não pertence à secretaria escolhida.")
        cur = db.execute("INSERT INTO users(username,display_name,password_hash,role) VALUES(?,?,?,?)",
                         (username, name, password_hash(password), role))
        if department_id:
            db.execute("INSERT INTO user_units(user_id,department_id,sector_id) VALUES(?,?,?)",
                       (cur.lastrowid, int(department_id), int(sector_id) if sector_id else None))
        record_audit(db, user["id"], "create", "user", cur.lastrowid, {"username": username, "role": role})
        return 201, {"id": cur.lastrowid, "username": username, "name": name, "role": role,
                     "departmentId": int(department_id) if department_id else None,
                     "sectorId": int(sector_id) if sector_id else None}

    @staticmethod
    def _unit_can_access(user, department_id, sector_id=None):
        if user["role"] == "admin":
            return True
        if user["department_id"] is None:
            return False
        if user["department_id"] != department_id:
            return False
        return user["sector_id"] is None or user["sector_id"] == sector_id

    def list_demands(self, db, body, user):
        filters, values = [], []
        if user["role"] != "admin":
            if user["department_id"] is None:
                return 200, []
            filters.append("d.department_id=?")
            values.append(user["department_id"])
            if user["sector_id"] is not None:
                filters.append("(d.sector_id=? OR d.sector_id IS NULL)")
                values.append(user["sector_id"])
        if body.get("status"):
            filters.append("d.status=?")
            values.append(body["status"])
        if body.get("q"):
            filters.append("(d.protocol LIKE ? OR d.title LIKE ? OR d.description LIKE ?)")
            values.extend([f"%{body['q']}%"] * 3)
        where = " WHERE " + " AND ".join(filters) if filters else ""
        query = "SELECT d.*,dep.name AS department,s.name AS sector,u.display_name AS assignee FROM demands d JOIN departments dep ON dep.id=d.department_id LEFT JOIN sectors s ON s.id=d.sector_id LEFT JOIN users u ON u.id=d.assigned_user_id" + where + " ORDER BY d.created_at DESC LIMIT 500"
        rows = db.execute(query, values)
        records = []
        for row in rows:
            record = dict(row)
            record["public_tracking"] = bool(record.pop("citizen_token_hash", None))
            records.append(record)
        return 200, records

    @staticmethod
    def _demand_row(db, demand_id):
        return db.execute("SELECT d.*,dep.name AS department,s.name AS sector,u.display_name AS assignee FROM demands d JOIN departments dep ON dep.id=d.department_id LEFT JOIN sectors s ON s.id=d.sector_id LEFT JOIN users u ON u.id=d.assigned_user_id WHERE d.id=?", (demand_id,)).fetchone()

    def get_demand(self, db, demand_id, user, start_response):
        demand = self._demand_row(db, demand_id)
        if not demand:
            return self.respond(start_response, 404, {"error": "Demanda não encontrada."})
        if not self._unit_can_access(user, demand["department_id"], demand["sector_id"]):
            return self.respond(start_response, 403, {"error": "Demanda fora da sua unidade de acesso."})
        record = dict(demand)
        record["public_tracking"] = bool(record.pop("citizen_token_hash", None))
        return self.respond(start_response, 200, record)

    def get_demand_history(self, db, demand_id, user, start_response):
        demand = self._demand_row(db, demand_id)
        if not demand:
            return self.respond(start_response, 404, {"error": "Demanda não encontrada."})
        if not self._unit_can_access(user, demand["department_id"], demand["sector_id"]):
            return self.respond(start_response, 403, {"error": "Demanda fora da sua unidade de acesso."})
        rows = db.execute("SELECT e.*,u.display_name AS actor,df.name AS from_department,dt.name AS to_department FROM demand_events e LEFT JOIN users u ON u.id=e.actor_id LEFT JOIN departments df ON df.id=e.department_from LEFT JOIN departments dt ON dt.id=e.department_to WHERE e.demand_id=? ORDER BY e.id", (demand_id,))
        return self.respond(start_response, 200, [dict(row) for row in rows])

    def create_demand(self, db, body, user):
        title, description = str(body.get("title", "")).strip(), str(body.get("description", "")).strip()
        category, requester = str(body.get("category", "")).strip(), str(body.get("requesterName", "")).strip()
        department_id, sector_id = body.get("departmentId"), body.get("sectorId")
        priority, due_date = body.get("priority", "media"), body.get("dueDate") or None
        requester_type = body.get("requesterType", "servidor")
        if not title or len(title) > 180 or not description or len(description) > 10000 or not category or len(category) > 100:
            raise ValueError("Preencha título, descrição e categoria dentro dos limites informados.")
        if not requester or len(requester) > 180 or requester_type not in ("servidor", "cidadao"):
            raise ValueError("Informe solicitante e um tipo válido.")
        if priority not in ("baixa", "media", "alta", "urgente"):
            raise ValueError("Prioridade inválida.")
        if not str(department_id or "").isdigit():
            raise ValueError("Selecione uma secretaria responsável.")
        department_id = int(department_id)
        if not db.execute("SELECT 1 FROM departments WHERE id=? AND active=1", (department_id,)).fetchone():
            raise ValueError("Secretaria não encontrada ou inativa.")
        if sector_id and not db.execute("SELECT 1 FROM sectors WHERE id=? AND department_id=? AND active=1", (int(sector_id), department_id)).fetchone():
            raise ValueError("Setor não pertence à secretaria ou está inativo.")
        if user["role"] != "admin" and user["department_id"] != department_id:
            raise PermissionError("Só é permitido abrir demandas para a própria secretaria.")
        if due_date:
            try:
                due_date = date.fromisoformat(str(due_date)).isoformat()
            except ValueError:
                raise ValueError("Prazo deve ser uma data válida no formato AAAA-MM-DD.") from None
        protocol = self._next_protocol(db)
        cur = db.execute("INSERT INTO demands(protocol,title,description,category,department_id,sector_id,requester_type,requester_name,priority,due_date,status,address,created_by) VALUES(?,?,?,?,?,?,?,?,?,?, 'aberta',?,?)",
                         (protocol, title, description, category, department_id, int(sector_id) if sector_id else None,
                          requester_type, requester, priority, due_date, str(body.get("address", "")).strip() or None, user["id"]))
        self._event(db, cur.lastrowid, user["id"], "abertura", None, "aberta", None, department_id,
                    "Demanda registrada.", {"protocol": protocol})
        record_audit(db, user["id"], "create", "demand", cur.lastrowid, {"protocol": protocol, "departmentId": department_id})
        row = self._demand_row(db, cur.lastrowid)
        record = dict(row)
        record["public_tracking"] = bool(record.pop("citizen_token_hash", None))
        return 201, record

    @staticmethod
    def _event(db, demand_id, actor_id, action, old_status, new_status, source, target, justification, details=None):
        db.execute("INSERT INTO demand_events(demand_id,actor_id,action,old_status,new_status,department_from,department_to,justification,details) VALUES(?,?,?,?,?,?,?,?,?)",
                   (demand_id, actor_id, action, old_status, new_status, source, target, justification,
                    json.dumps(details or {}, ensure_ascii=False, sort_keys=True)))

    @staticmethod
    def _next_protocol(db):
        year = time.gmtime().tm_year
        row = db.execute("SELECT last_number FROM protocol_sequences WHERE year=?", (year,)).fetchone()
        number = row["last_number"] + 1 if row else 1
        if row:
            db.execute("UPDATE protocol_sequences SET last_number=? WHERE year=?", (number, year))
        else:
            db.execute("INSERT INTO protocol_sequences(year,last_number) VALUES(?,?)", (year, number))
        return f"SIGAM-{year}-{number:06d}"

    def _public_rate_limited(self, remote_addr, limit, window_seconds):
        now = time.monotonic()
        attempts = [stamp for stamp in self.public_attempts.get(remote_addr, []) if now - stamp < window_seconds]
        if len(attempts) >= limit:
            self.public_attempts[remote_addr] = attempts
            return True
        attempts.append(now)
        self.public_attempts[remote_addr] = attempts
        return False

    def public_dispatch(self, db, method, path, body, environ, start_response):
        if method == "GET" and path == "/api/public/departments":
            return self.respond(start_response, 200, [dict(row) for row in db.execute("SELECT id,name FROM departments WHERE active=1 ORDER BY name")])
        remote = environ.get("REMOTE_ADDR", "unknown")
        if method == "POST" and path == "/api/public/demands":
            if self._public_rate_limited(remote, 5, 3600):
                return self.respond(start_response, 429, {"error": "Limite temporário de solicitações atingido. Tente novamente mais tarde."})
            return self.public_create_demand(db, body, start_response)
        if method == "POST" and path == "/api/public/track":
            if self._public_rate_limited(remote, 30, 600):
                return self.respond(start_response, 429, {"error": "Muitas consultas. Aguarde alguns minutos e tente novamente."})
            return self.public_track(db, body, start_response)
        if method == "POST" and path == "/api/public/respond":
            if self._public_rate_limited(remote, 10, 600):
                return self.respond(start_response, 429, {"error": "Muitas respostas. Aguarde alguns minutos e tente novamente."})
            return self.public_respond(db, body, start_response)
        return self.respond(start_response, 404, {"error": "Rota pública não encontrada."})

    def public_create_demand(self, db, body, start_response):
        title, description = str(body.get("title", "")).strip(), str(body.get("description", "")).strip()
        category, requester = str(body.get("category", "")).strip(), str(body.get("requesterName", "")).strip()
        department_id = body.get("departmentId")
        if not title or len(title) > 180 or not description or len(description) > 10000 or not category or len(category) > 100:
            raise ValueError("Preencha título, descrição e categoria dentro dos limites informados.")
        if not requester or len(requester) > 180 or not str(department_id or "").isdigit():
            raise ValueError("Informe seu nome e a secretaria relacionada à solicitação.")
        department_id = int(department_id)
        if not db.execute("SELECT 1 FROM departments WHERE id=? AND active=1", (department_id,)).fetchone():
            raise ValueError("Secretaria selecionada não encontrada.")
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        protocol = self._next_protocol(db)
        service_user = db.execute("SELECT id FROM users WHERE username='__portal_cidadao__' AND active=0").fetchone()
        cur = db.execute("INSERT INTO demands(protocol,title,description,category,department_id,requester_type,requester_name,priority,status,created_by,citizen_token_hash) VALUES(?,?,?,?,?,'cidadao',?,'media','aberta',?,?)",
                         (protocol, title, description, category, department_id, requester, service_user["id"], token_hash))
        self._event(db, cur.lastrowid, None, "abertura_cidadao", None, "aberta", None, department_id,
                    None, {"publicMessage": "Solicitação recebida. Guarde o protocolo e a chave de acompanhamento."})
        record_audit(db, None, "create_citizen_demand", "demand", cur.lastrowid, {"protocol": protocol})
        return self.respond(start_response, 201, {"protocol": protocol, "accessToken": token,
            "message": "Guarde a chave de acompanhamento. Ela não será exibida novamente."})

    @staticmethod
    def _citizen_demand(db, protocol, token):
        protocol, token = str(protocol or "").strip()[:40], str(token or "")
        if not protocol or not token:
            return None
        row = db.execute("SELECT d.*,dep.name AS department FROM demands d JOIN departments dep ON dep.id=d.department_id WHERE d.protocol=? AND d.requester_type='cidadao'", (protocol,)).fetchone()
        if not row or not row["citizen_token_hash"]:
            return None
        return row if hmac.compare_digest(hashlib.sha256(token.encode()).hexdigest(), row["citizen_token_hash"]) else None

    def public_track(self, db, body, start_response):
        demand = self._citizen_demand(db, body.get("protocol"), body.get("accessToken"))
        if not demand:
            return self.respond(start_response, 404, {"error": "Protocolo ou chave de acompanhamento inválidos."})
        rows = db.execute("SELECT action,new_status,details,happened_at FROM demand_events WHERE demand_id=? AND action IN ('abertura_cidadao','pedir_informacao','resposta_publica','resposta_cidadao') ORDER BY id", (demand["id"],))
        events = []
        for row in rows:
            details = json.loads(row["details"] or "{}")
            events.append({"action": row["action"], "status": row["new_status"],
                           "message": details.get("publicMessage", "Informação complementar recebida."),
                           "happenedAt": row["happened_at"]})
        return self.respond(start_response, 200, {"protocol": demand["protocol"], "title": demand["title"],
            "status": demand["status"], "department": demand["department"], "createdAt": demand["created_at"],
            "updatedAt": demand["updated_at"], "canRespond": demand["status"] == "aguardando_informacoes", "events": events})

    def public_respond(self, db, body, start_response):
        demand = self._citizen_demand(db, body.get("protocol"), body.get("accessToken"))
        if not demand:
            return self.respond(start_response, 404, {"error": "Protocolo ou chave de acompanhamento inválidos."})
        if demand["status"] != "aguardando_informacoes":
            return self.respond(start_response, 409, {"error": "Esta solicitação não está aguardando informações."})
        message = str(body.get("message", "")).strip()
        if not message or len(message) > 5000:
            raise ValueError("Escreva a informação complementar (até 5.000 caracteres).")
        old = demand["status"]
        db.execute("UPDATE demands SET status='em_atendimento',updated_at=CURRENT_TIMESTAMP WHERE id=?", (demand["id"],))
        self._event(db, demand["id"], None, "resposta_cidadao", old, "em_atendimento", demand["department_id"],
                    demand["department_id"], None, {"publicMessage": message})
        record_audit(db, None, "citizen_response", "demand", demand["id"], {"protocol": demand["protocol"]})
        return self.respond(start_response, 200, {"ok": True, "status": "em_atendimento"})

    def demand_action(self, db, demand_id, body, user, start_response):
        demand = self._demand_row(db, demand_id)
        if not demand:
            return self.respond(start_response, 404, {"error": "Demanda não encontrada."})
        if not self._unit_can_access(user, demand["department_id"], demand["sector_id"]):
            return self.respond(start_response, 403, {"error": "Demanda fora da sua unidade de acesso."})
        action = body.get("action")
        justification = str(body.get("justification", "")).strip()
        old, department_from = demand["status"], demand["department_id"]
        new_status, department_to, details = old, department_from, {}
        if action == "assumir":
            if not self.allowed(user, "demands:act"):
                return self.respond(start_response, 403, {"error": "Perfil sem permissão para assumir demandas."})
            if demand["assigned_user_id"] and demand["assigned_user_id"] != user["id"]:
                return self.respond(start_response, 409, {"error": "A demanda já foi assumida por outro servidor."})
            if old not in ("aberta", "aguardando_triagem", "encaminhada", "aguardando_outro_setor"):
                return self.respond(start_response, 409, {"error": "Esta demanda não pode ser assumida no status atual."})
            new_status = "em_atendimento"
            db.execute("UPDATE demands SET assigned_user_id=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (user["id"], new_status, demand_id))
        elif action == "encaminhar":
            if not self.allowed(user, "demands:forward"):
                return self.respond(start_response, 403, {"error": "Perfil sem permissão para encaminhar demandas."})
            raw_to = body.get("departmentId")
            if not justification or not str(raw_to or "").isdigit():
                raise ValueError("Informe a secretaria de destino e a justificativa do encaminhamento.")
            if old in ("resolvida", "encerrada", "cancelada"):
                return self.respond(start_response, 409, {"error": "Reabra a demanda com justificativa antes de encaminhá-la."})
            department_to = int(raw_to)
            if not db.execute("SELECT 1 FROM departments WHERE id=? AND active=1", (department_to,)).fetchone():
                raise ValueError("Secretaria de destino inválida.")
            if department_to == department_from:
                raise ValueError("A secretaria de destino deve ser diferente da atual.")
            new_status = "encaminhada"
            db.execute("UPDATE demands SET department_id=?,sector_id=NULL,assigned_user_id=NULL,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (department_to, new_status, demand_id))
        elif action == "status":
            if not self.allowed(user, "demands:act"):
                return self.respond(start_response, 403, {"error": "Perfil sem permissão para alterar o andamento."})
            new_status = body.get("status")
            if new_status in ("resolvida", "encerrada"):
                raise ValueError("Use as ações de solução e encerramento para concluir a demanda corretamente.")
            if new_status not in DEMAND_STATUSES or new_status not in STATUS_TRANSITIONS.get(old, set()):
                raise ValueError("Transição de status inválida para o estado atual.")
            if new_status in ("cancelada", "aguardando_informacoes", "aguardando_outro_setor") and not justification:
                raise ValueError("Informe a justificativa desta alteração.")
            db.execute("UPDATE demands SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (new_status, demand_id))
        elif action in ("pedir_informacao", "resposta_publica"):
            if not self.allowed(user, "demands:act"):
                return self.respond(start_response, 403, {"error": "Perfil sem permissão para enviar mensagens ao cidadão."})
            if demand["requester_type"] != "cidadao" or not demand["citizen_token_hash"]:
                return self.respond(start_response, 409, {"error": "Esta demanda não possui acompanhamento pelo portal do cidadão."})
            message = str(body.get("message", "")).strip()
            if not message or len(message) > 5000:
                raise ValueError("Escreva uma mensagem ao cidadão (até 5.000 caracteres).")
            if action == "pedir_informacao":
                new_status = "aguardando_informacoes"
                if new_status not in STATUS_TRANSITIONS.get(old, set()):
                    return self.respond(start_response, 409, {"error": "Não é possível solicitar informações no status atual."})
                db.execute("UPDATE demands SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (new_status, demand_id))
            details = {"publicMessage": message}
        elif action in ("providencia", "solucao"):
            if not self.allowed(user, "demands:act"):
                return self.respond(start_response, 403, {"error": "Perfil sem permissão para registrar providências."})
            text = str(body.get("text", "")).strip()
            if not text or len(text) > 5000:
                raise ValueError("Descreva a providência (até 5.000 caracteres).")
            if old in ("resolvida", "encerrada", "cancelada"):
                return self.respond(start_response, 409, {"error": "Reabra a demanda antes de registrar uma nova providência."})
            details = {"text": text, "visibility": "internal"}
            if action == "solucao":
                if old not in ("em_atendimento", "em_execucao", "aguardando_validacao"):
                    return self.respond(start_response, 409, {"error": "A solução não pode ser registrada no status atual."})
                new_status = "resolvida"
                db.execute("UPDATE demands SET solution=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (text, new_status, demand_id))
        elif action == "encerrar":
            if not self.allowed(user, "demands:act"):
                return self.respond(start_response, 403, {"error": "Perfil sem permissão para encerrar demandas."})
            if old != "resolvida":
                return self.respond(start_response, 409, {"error": "A demanda precisa estar resolvida antes do encerramento."})
            new_status = "encerrada"
            db.execute("UPDATE demands SET status=?,closed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?", (new_status, demand_id))
        elif action == "reabrir":
            if not self.allowed(user, "demands:reopen") or old not in ("resolvida", "encerrada"):
                return self.respond(start_response, 403, {"error": "Reabertura não permitida para este perfil ou status."})
            if not justification:
                raise ValueError("Informe a justificativa da reabertura.")
            new_status = "em_atendimento"
            db.execute("UPDATE demands SET status=?,closed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?", (new_status, demand_id))
        else:
            return self.respond(start_response, 400, {"error": "Ação desconhecida."})
        self._event(db, demand_id, user["id"], action, old, new_status, department_from, department_to,
                    justification or None, details)
        record_audit(db, user["id"], action, "demand", demand_id, {"from": old, "to": new_status, "departmentTo": department_to})
        record = dict(self._demand_row(db, demand_id))
        record["public_tracking"] = bool(record.pop("citizen_token_hash", None))
        return self.respond(start_response, 200, record)

    @staticmethod
    def _activity(db, user_id, entity_type, entity_id, action, summary):
        db.execute("INSERT INTO productivity_activity(user_id,entity_type,entity_id,action,summary) VALUES(?,?,?,?,?)",
                   (user_id, entity_type, entity_id, action, summary[:240]))

    @staticmethod
    def _personal_task(db, task_id, user_id):
        return db.execute("SELECT * FROM personal_tasks WHERE id=? AND user_id=?", (task_id, user_id)).fetchone()

    @staticmethod
    def _work_event(db, event_id, user_id):
        return db.execute("SELECT * FROM work_events WHERE id=? AND user_id=?", (event_id, user_id)).fetchone()

    @staticmethod
    def _profile_record(db, user):
        profile = db.execute("SELECT * FROM employee_profiles WHERE user_id=?", (user["id"],)).fetchone()
        unit = db.execute("SELECT uu.department_id,uu.sector_id,d.name AS department,s.name AS sector FROM user_units uu LEFT JOIN departments d ON d.id=uu.department_id LEFT JOIN sectors s ON s.id=uu.sector_id WHERE uu.user_id=?", (user["id"],)).fetchone()
        data = dict(profile) if profile else {"user_id": user["id"], "work_email": None, "job_title": None,
            "employee_number": None, "work_phone": None, "work_hours": None}
        data.update({"id": user["id"], "full_name": user["display_name"], "role": user["role"],
                     "department_id": unit["department_id"] if unit else None,
                     "sector_id": unit["sector_id"] if unit else None,
                     "department": unit["department"] if unit else None,
                     "sector": unit["sector"] if unit else None})
        return data

    def profile(self, db, method, body, user, start_response):
        if method == "GET":
            return self.respond(start_response, 200, self._profile_record(db, user))
        name = str(body.get("fullName", user["display_name"])).strip()
        values = {"work_email": str(body.get("workEmail", "")).strip() or None,
                  "job_title": str(body.get("jobTitle", "")).strip() or None,
                  "employee_number": str(body.get("employeeNumber", "")).strip() or None,
                  "work_phone": str(body.get("workPhone", "")).strip() or None,
                  "work_hours": str(body.get("workHours", "")).strip() or None}
        if not name or len(name) > 180:
            raise ValueError("Informe um nome completo válido (até 180 caracteres).")
        if values["work_email"] and (len(values["work_email"]) > 180 or "@" not in values["work_email"]):
            raise ValueError("Informe um e-mail profissional válido.")
        if any(value and len(value) > maxlen for value, maxlen in ((values["job_title"], 120),
               (values["employee_number"], 80), (values["work_phone"], 60), (values["work_hours"], 120))):
            raise ValueError("Um dos campos excede o limite permitido.")
        db.execute("UPDATE users SET display_name=? WHERE id=?", (name, user["id"]))
        db.execute("INSERT INTO employee_profiles(user_id,work_email,job_title,employee_number,work_phone,work_hours) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET work_email=excluded.work_email,job_title=excluded.job_title,employee_number=excluded.employee_number,work_phone=excluded.work_phone,work_hours=excluded.work_hours,updated_at=CURRENT_TIMESTAMP",
                   (user["id"], values["work_email"], values["job_title"], values["employee_number"], values["work_phone"], values["work_hours"]))
        self._activity(db, user["id"], "profile", user["id"], "update", "Perfil profissional atualizado")
        record_audit(db, user["id"], "update_profile", "employee_profile", user["id"])
        refreshed = dict(user); refreshed["display_name"] = name
        return self.respond(start_response, 200, self._profile_record(db, refreshed))

    def dashboard(self, db, body, user, start_response):
        day = str(body.get("date") or date.today().isoformat())
        try:
            day = date.fromisoformat(day).isoformat()
        except ValueError:
            raise ValueError("Informe uma data válida para o painel.") from None
        counts = {row["status"]: row["total"] for row in db.execute(
            "SELECT status,COUNT(*) AS total FROM personal_tasks WHERE user_id=? AND archived_at IS NULL GROUP BY status", (user["id"],))}
        total_tasks = db.execute("SELECT COUNT(*) FROM personal_tasks WHERE user_id=? AND archived_at IS NULL", (user["id"],)).fetchone()[0]
        total_documents = db.execute("SELECT COUNT(*) FROM personal_documents WHERE user_id=? AND active=1", (user["id"],)).fetchone()[0]
        total_departments = db.execute("SELECT COUNT(*) FROM departments WHERE active=1").fetchone()[0]
        due_open = db.execute("SELECT COUNT(*) FROM personal_tasks WHERE user_id=? AND archived_at IS NULL AND due_at IS NOT NULL AND substr(due_at,1,10)<substr(?,1,10) AND status NOT IN ('concluida','cancelada')", (user["id"], day)).fetchone()[0]
        due_soon = db.execute("SELECT COUNT(*) FROM personal_tasks WHERE user_id=? AND archived_at IS NULL AND due_at IS NOT NULL AND substr(due_at,1,10)>=? AND substr(due_at,1,10)<=? AND status NOT IN ('concluida','cancelada')", (user["id"], day, (date.fromisoformat(day) + timedelta(days=7)).isoformat())).fetchone()[0]
        urgent = db.execute("SELECT COUNT(*) FROM personal_tasks WHERE user_id=? AND archived_at IS NULL AND priority='urgente' AND status IN ('aberta','em_andamento','aguardando')", (user["id"],)).fetchone()[0]
        next_action = db.execute("SELECT * FROM personal_tasks WHERE user_id=? AND archived_at IS NULL AND status IN ('aberta','em_andamento','aguardando') ORDER BY CASE priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,COALESCE(due_at,'9999'),created_at LIMIT 1", (user["id"],)).fetchone()
        today_tasks = [dict(row) for row in db.execute("SELECT * FROM personal_tasks WHERE user_id=? AND archived_at IS NULL AND substr(COALESCE(due_at,start_at,''),1,10)=? ORDER BY CASE priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,COALESCE(due_at,start_at),id", (user["id"], day))]
        today_events = [dict(row) for row in db.execute("SELECT * FROM work_events WHERE user_id=? AND status='agendada' AND substr(starts_at,1,10)=? ORDER BY starts_at", (user["id"], day))]
        upcoming = [dict(row) for row in db.execute("SELECT * FROM work_events WHERE user_id=? AND status='agendada' AND starts_at>=? ORDER BY starts_at LIMIT 5", (user["id"], day))]
        recent_docs = [dict(row) for row in db.execute("SELECT x.id,x.title,x.category,x.original_name,x.created_at,x.department_id,d.name AS department_name FROM personal_documents x LEFT JOIN departments d ON d.id=x.department_id WHERE x.user_id=? AND x.active=1 ORDER BY x.id DESC LIMIT 5", (user["id"],))]
        recent_tasks = [dict(row) for row in db.execute("SELECT t.id,t.title,t.status,t.priority,t.due_at,t.created_at,t.department_id,d.name AS department_name FROM personal_tasks t LEFT JOIN departments d ON d.id=t.department_id WHERE t.user_id=? AND t.archived_at IS NULL ORDER BY t.created_at DESC LIMIT 8", (user["id"],))]
        task_statuses = [{"status": status, "total": counts.get(status, 0)} for status in ("aberta", "em_andamento", "aguardando", "concluida", "cancelada")]
        task_departments = [dict(row) for row in db.execute("SELECT d.id AS department_id,d.name,COUNT(t.id) AS total FROM departments d LEFT JOIN personal_tasks t ON t.department_id=d.id AND t.user_id=? AND t.archived_at IS NULL WHERE d.active=1 GROUP BY d.id,d.name ORDER BY d.name", (user["id"],))]
        activity = [dict(row) for row in db.execute("SELECT entity_type,entity_id,action,summary,happened_at FROM productivity_activity WHERE user_id=? ORDER BY id DESC LIMIT 12", (user["id"],))]
        routine = [{"kind": "task", **task} for task in today_tasks] + [{"kind": "event", **event} for event in today_events]
        routine.sort(key=lambda item: (str(item.get("due_at") or item.get("starts_at") or "9999"), 0 if item["kind"] == "event" else 1))
        return self.respond(start_response, 200, {"date": day, "counts": {"abertas": counts.get("aberta",0),
            "em_andamento": counts.get("em_andamento",0), "concluidas": counts.get("concluida",0),
            "aguardando": counts.get("aguardando",0), "canceladas": counts.get("cancelada",0),
            "atrasadas": due_open, "proximas": due_soon, "urgentes": urgent,
            "total_tarefas": total_tasks, "total_documentos": total_documents, "total_secretarias": total_departments},
            "taskStatuses": task_statuses, "tasksByDepartment": task_departments,
            "recentTasks": recent_tasks, "routine": routine,
            "upcomingEvents": upcoming, "nextAction": dict(next_action) if next_action else None,
            "recentDocuments": recent_docs, "recentActivity": activity})

    def list_tasks(self, db, body, user, start_response):
        clauses = ["t.user_id=?", "t.archived_at IS NULL"]; values = [user["id"]]
        if body.get("open") == "1": clauses.append("t.status NOT IN ('concluida','cancelada')")
        if body.get("status") in ("aberta","em_andamento","aguardando","concluida","cancelada"):
            clauses.append("t.status=?"); values.append(body["status"])
        if body.get("priority") in ("baixa","normal","alta","urgente"):
            clauses.append("t.priority=?"); values.append(body["priority"])
        if body.get("departmentId"):
            if not str(body["departmentId"]).isdigit():
                raise ValueError("Secretaria inválida.")
            clauses.append("t.department_id=?"); values.append(int(body["departmentId"]))
        if body.get("from"):
            clauses.append("substr(COALESCE(t.due_at,t.start_at,''),1,10)>=?"); values.append(str(body["from"])[:10])
        if body.get("to"):
            clauses.append("substr(COALESCE(t.due_at,t.start_at,''),1,10)<=?"); values.append(str(body["to"])[:10])
        if body.get("q"):
            clauses.append("(t.title LIKE ? OR t.description LIKE ? OR t.category LIKE ? OR t.observations LIKE ?)"); values.extend([f"%{body['q']}%"]*4)
        order = "CASE t.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,COALESCE(t.due_at,'9999'),t.created_at DESC"
        if body.get("sort") == "prazo": order = "COALESCE(t.due_at,'9999'),CASE t.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END"
        if body.get("sort") == "recentes": order = "t.created_at DESC"
        rows = [dict(row) for row in db.execute(f"SELECT t.*,d.name AS department_name FROM personal_tasks t LEFT JOIN departments d ON d.id=t.department_id WHERE {' AND '.join(clauses)} ORDER BY {order} LIMIT 500", values)]
        return self.respond(start_response, 200, rows)

    def get_task(self, db, task_id, user, start_response):
        row = self._personal_task(db, task_id, user["id"])
        if not row or row["archived_at"]:
            return self.respond(start_response, 404, {"error": "Tarefa não encontrada."})
        data = dict(row)
        if data.get("department_id"):
            department = db.execute("SELECT name FROM departments WHERE id=?", (data["department_id"],)).fetchone()
            data["department_name"] = department["name"] if department else None
        data["documents"] = [dict(item) for item in db.execute("SELECT id,title,category,original_name FROM personal_documents WHERE linked_task_id=? AND user_id=? AND active=1", (task_id,user["id"]))]
        return self.respond(start_response, 200, data)

    def save_task(self, db, method, task_id, body, user, start_response):
        current = self._personal_task(db, task_id, user["id"]) if task_id else None
        if task_id and (not current or current["archived_at"]):
            return self.respond(start_response, 404, {"error": "Tarefa não encontrada."})
        if method != "POST" and method in ("PUT","PATCH"):
            data = dict(current)
            aliases = {"title":"title","description":"description","category":"category","startAt":"start_at","dueAt":"due_at","priority":"priority","status":"status","observations":"observations","departmentId":"department_id"}
            for key, column in aliases.items():
                if key in body: data[column] = body[key]
        else:
            data = {"title": body.get("title"), "description": body.get("description", ""),
                "category": body.get("category", "Geral"), "start_at": body.get("startAt"),
                "due_at": body.get("dueAt"), "priority": body.get("priority", "normal"),
                "status": body.get("status", "aberta"), "observations": body.get("observations", ""),
                "department_id": body.get("departmentId") or None}
        title = str(data.get("title") or "").strip(); description = str(data.get("description") or "").strip()
        category = str(data.get("category") or "Geral").strip(); observations = str(data.get("observations") or "").strip()
        priority, status = data.get("priority"), data.get("status")
        if not title or len(title)>180 or len(description)>10000 or not category or len(category)>100 or len(observations)>5000:
            raise ValueError("Informe título e categoria válidos; confira os limites de texto.")
        if priority not in ("baixa","normal","alta","urgente") or status not in ("aberta","em_andamento","aguardando","concluida","cancelada"):
            raise ValueError("Status ou prioridade inválidos.")
        dates = {}
        for field in ("start_at","due_at"):
            value = data.get(field)
            if value:
                try:
                    parsed = datetime.fromisoformat(str(value))
                    if parsed.tzinfo: raise ValueError
                    value = parsed.isoformat(timespec="minutes")
                except ValueError:
                    raise ValueError("Datas e horários devem usar formato local Brasília AAAA-MM-DDTHH:MM.") from None
            dates[field] = value or None
        old_status = current["status"] if current else None
        department_id = data.get("department_id")
        if department_id not in (None, ""):
            if not str(department_id).isdigit() or not db.execute("SELECT 1 FROM departments WHERE id=? AND active=1", (int(department_id),)).fetchone():
                raise ValueError("Selecione uma secretaria cadastrada e ativa.")
            department_id = int(department_id)
        else:
            department_id = None
        completed_at = current["completed_at"] if current else None
        if status == "concluida" and old_status != "concluida": completed_at = datetime.now().isoformat(timespec="seconds")
        if status != "concluida": completed_at = None
        source = body.get("sourceEventId") if "sourceEventId" in body else (current["source_event_id"] if current else None)
        if source is not None:
            if not str(source).isdigit() or not self._work_event(db, int(source), user["id"]):
                raise ValueError("A reunião de origem não pertence à sua conta.")
            source = int(source)
        if task_id:
            db.execute("UPDATE personal_tasks SET title=?,description=?,category=?,start_at=?,due_at=?,priority=?,status=?,observations=?,source_event_id=?,department_id=?,completed_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
                (title,description,category,dates["start_at"],dates["due_at"],priority,status,observations,source,department_id,completed_at,task_id,user["id"]))
            action = "status" if old_status != status else "edit"
            db.execute("INSERT INTO personal_task_events(task_id,user_id,action,details) VALUES(?,?,?,?)", (task_id,user["id"],action,json.dumps({"from":old_status,"to":status},ensure_ascii=False)))
            self._activity(db,user["id"],"task",task_id,"edit",f"Tarefa atualizada: {title}")
        else:
            cur = db.execute("INSERT INTO personal_tasks(user_id,title,description,category,start_at,due_at,priority,status,observations,source_event_id,department_id,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                (user["id"],title,description,category,dates["start_at"],dates["due_at"],priority,status,observations,source,department_id,completed_at))
            task_id = cur.lastrowid
            db.execute("INSERT INTO personal_task_events(task_id,user_id,action,details) VALUES(?,?,?,?)",(task_id,user["id"],"created","{}"))
            self._activity(db,user["id"],"task",task_id,"create",f"Tarefa criada: {title}")
        record_audit(db,user["id"],"save_task","personal_task",task_id,{"status":status,"priority":priority})
        return self.get_task(db,task_id,user,start_response) if method != "POST" and method in ("PUT","PATCH") else self.respond(start_response,201,dict(self._personal_task(db,task_id,user["id"])))

    def archive_task(self, db, task_id, user, start_response):
        task = self._personal_task(db,task_id,user["id"])
        if not task or task["archived_at"]: return self.respond(start_response,404,{"error":"Tarefa não encontrada."})
        db.execute("UPDATE personal_tasks SET archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?",(task_id,))
        self._activity(db,user["id"],"task",task_id,"archive",f"Tarefa arquivada: {task['title']}")
        record_audit(db,user["id"],"archive_task","personal_task",task_id)
        return self.respond(start_response,200,{"ok":True,"archived":True})

    def task_history(self, db, task_id, user, start_response):
        if not self._personal_task(db,task_id,user["id"]): return self.respond(start_response,404,{"error":"Tarefa não encontrada."})
        rows = [dict(r) for r in db.execute("SELECT action,details,happened_at FROM personal_task_events WHERE task_id=? AND user_id=? ORDER BY id DESC",(task_id,user["id"]))]
        return self.respond(start_response,200,rows)

    def list_work_events(self, db, body, user, start_response):
        clauses=["user_id=?"]; values=[user["id"]]
        if body.get("kind") in ("reuniao","compromisso","entrega","prazo","atendimento","lembrete","evento_interno"):
            clauses.append("kind=?"); values.append(body["kind"])
        if body.get("from"):
            clauses.append("substr(starts_at,1,10)>=?"); values.append(str(body["from"])[:10])
        if body.get("to"):
            clauses.append("substr(starts_at,1,10)<=?"); values.append(str(body["to"])[:10])
        if body.get("q"):
            clauses.append("(title LIKE ? OR description LIKE ? OR minutes LIKE ? OR participants LIKE ?)"); values.extend([f"%{body['q']}%"]*4)
        rows=[dict(r) for r in db.execute(f"SELECT * FROM work_events WHERE {' AND '.join(clauses)} ORDER BY starts_at LIMIT 500",values)]
        return self.respond(start_response,200,rows)

    @staticmethod
    def _write_event_history(db,event_id,user_id,action,details):
        db.execute("INSERT INTO work_event_history(event_id,user_id,action,details) VALUES(?,?,?,?)",(event_id,user_id,action,json.dumps(details or {},ensure_ascii=False)))

    def save_work_event(self, db, method, event_id, body, user, start_response):
        current=self._work_event(db,event_id,user["id"]) if event_id else None
        if event_id and not current: return self.respond(start_response,404,{"error":"Compromisso não encontrado."})
        data=dict(current) if current else {}
        aliases={"kind":"kind","title":"title","description":"description","startsAt":"starts_at","endsAt":"ends_at","location":"location","participants":"participants","agenda":"agenda","objective":"objective","notes":"notes","minutes":"minutes","status":"status"}
        for key,column in aliases.items():
            if key in body: data[column]=body[key]
        defaults={"kind":"reuniao","title":"","description":"","starts_at":"","ends_at":None,"location":"","participants":"","agenda":"","objective":"","notes":"","minutes":"","status":"agendada"}
        for k,v in defaults.items(): data.setdefault(k,v)
        kind=data["kind"]; title=str(data["title"] or "").strip(); starts=str(data["starts_at"] or "").strip(); ends=str(data["ends_at"] or "").strip() or None
        if kind not in ("reuniao","compromisso","entrega","prazo","atendimento","lembrete","evento_interno") or data["status"] not in ("agendada","realizada","cancelada"):
            raise ValueError("Tipo ou situação do evento inválidos.")
        if not title or len(title)>180 or not starts: raise ValueError("Informe o título e a data/horário inicial.")
        try:
            start_dt=datetime.fromisoformat(starts); end_dt=datetime.fromisoformat(ends) if ends else None
            if start_dt.tzinfo or (end_dt and end_dt.tzinfo) or (end_dt and end_dt<=start_dt): raise ValueError
            starts=start_dt.isoformat(timespec="minutes"); ends=end_dt.isoformat(timespec="minutes") if end_dt else None
        except ValueError: raise ValueError("Use horários locais de Brasília em AAAA-MM-DDTHH:MM e um término posterior ao início.") from None
        for field,limit in (("description",10000),("location",240),("participants",2000),("agenda",5000),("objective",2000),("notes",5000),("minutes",10000)):
            data[field]=str(data.get(field) or "").strip()
            if len(data[field])>limit: raise ValueError(f"O campo {field} ultrapassa {limit} caracteres.")
        values=(user["id"],kind,title,data["description"],starts,ends,data["location"],data["participants"],data["agenda"],data["objective"],data["notes"],data["minutes"],data["status"])
        if event_id:
            db.execute("UPDATE work_events SET kind=?,title=?,description=?,starts_at=?,ends_at=?,location=?,participants=?,agenda=?,objective=?,notes=?,minutes=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",(kind,title,data["description"],starts,ends,data["location"],data["participants"],data["agenda"],data["objective"],data["notes"],data["minutes"],data["status"],event_id,user["id"]))
            self._write_event_history(db,event_id,user["id"],"update",{"status":data["status"]})
            action="update"; target_id=event_id
        else:
            cur=db.execute("INSERT INTO work_events(user_id,kind,title,description,starts_at,ends_at,location,participants,agenda,objective,notes,minutes,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",values)
            target_id=cur.lastrowid; action="create"
            self._write_event_history(db,target_id,user["id"],"create",{"status":data["status"]})
        self._activity(db,user["id"],"event",target_id,action,f"{('Reunião' if kind=='reuniao' else 'Compromisso')} {'atualizada' if event_id else 'agendada'}: {title}")
        record_audit(db,user["id"],"save_work_event","work_event",target_id,{"kind":kind,"status":data["status"]})
        event=dict(self._work_event(db,target_id,user["id"]))
        event["conflicts"]=self._event_conflicts(db,user["id"],target_id,starts,ends) if data["status"]=="agendada" else []
        return self.respond(start_response,200 if event_id else 201,event)

    @staticmethod
    def _event_conflicts(db,user_id,event_id,starts,ends):
        if not ends: return []
        return [dict(r) for r in db.execute("SELECT id,title,starts_at,ends_at FROM work_events WHERE user_id=? AND id<>? AND status='agendada' AND ends_at>? AND starts_at<? ORDER BY starts_at LIMIT 10",(user_id,event_id,starts,ends))]

    def get_work_event(self,db,event_id,user,start_response):
        event=self._work_event(db,event_id,user["id"])
        if not event: return self.respond(start_response,404,{"error":"Compromisso não encontrado."})
        data=dict(event); data["conflicts"]=self._event_conflicts(db,user["id"],event_id,event["starts_at"],event["ends_at"])
        return self.respond(start_response,200,data)

    def delete_work_event(self,db,event_id,user,start_response):
        event=self._work_event(db,event_id,user["id"])
        if not event: return self.respond(start_response,404,{"error":"Compromisso não encontrado."})
        db.execute("DELETE FROM work_events WHERE id=? AND user_id=?",(event_id,user["id"]))
        self._activity(db,user["id"],"event",event_id,"delete",f"Compromisso excluído: {event['title']}")
        record_audit(db,user["id"],"delete_work_event","work_event",event_id)
        return self.respond(start_response,200,{"ok":True})

    def work_event_history(self,db,event_id,user,start_response):
        if not self._work_event(db,event_id,user["id"]): return self.respond(start_response,404,{"error":"Compromisso não encontrado."})
        return self.respond(start_response,200,[dict(r) for r in db.execute("SELECT action,details,happened_at FROM work_event_history WHERE event_id=? AND user_id=? ORDER BY id DESC",(event_id,user["id"]))])

    def task_from_meeting(self,db,event_id,body,user,start_response):
        event=self._work_event(db,event_id,user["id"])
        if not event or event["kind"]!="reuniao": return self.respond(start_response,404,{"error":"Reunião não encontrada."})
        title=str(body.get("title") or "").strip()
        if not title or len(title)>180: raise ValueError("Informe o título da tarefa (até 180 caracteres).")
        priority=body.get("priority","normal")
        if priority not in ("baixa","normal","alta","urgente"): raise ValueError("Prioridade inválida.")
        due=body.get("dueAt") or None
        if due:
            try:
                parsed=datetime.fromisoformat(str(due))
                if parsed.tzinfo: raise ValueError
                due=parsed.isoformat(timespec="minutes")
            except ValueError: raise ValueError("Prazo deve usar AAAA-MM-DDTHH:MM no horário local.") from None
        cur=db.execute("INSERT INTO personal_tasks(user_id,title,description,category,due_at,priority,status,source_event_id) VALUES(?,?,?,?,?,?,'aberta',?)",(user["id"],title,str(body.get("description") or "")[:10000],str(body.get("category") or "Reunião")[:100],due,priority,event_id))
        task_id=cur.lastrowid
        db.execute("INSERT INTO personal_task_events(task_id,user_id,action,details) VALUES(?,?,?,?)",(task_id,user["id"],"created_from_meeting",json.dumps({"eventId":event_id})))
        self._activity(db,user["id"],"task",task_id,"create",f"Tarefa encaminhada da reunião: {title}")
        record_audit(db,user["id"],"task_from_meeting","personal_task",task_id,{"eventId":event_id})
        return self.respond(start_response,201,dict(self._personal_task(db,task_id,user["id"])))

    def list_documents(self,db,body,user,start_response):
        clauses=["x.user_id=?","x.active=1"]; values=[user["id"]]
        if body.get("q"):
            clauses.append("(x.title LIKE ? OR x.description LIKE ? OR x.original_name LIKE ? OR x.tag LIKE ?)"); values.extend([f"%{body['q']}%"]*4)
        if body.get("category"):
            clauses.append("x.category=?"); values.append(str(body["category"])[:80])
        if body.get("departmentId"):
            if not str(body["departmentId"]).isdigit():
                raise ValueError("Secretaria inválida.")
            clauses.append("x.department_id=?"); values.append(int(body["departmentId"]))
        if body.get("from"):
            clauses.append("substr(x.created_at,1,10)>=?"); values.append(str(body["from"])[:10])
        if body.get("to"):
            clauses.append("substr(x.created_at,1,10)<=?"); values.append(str(body["to"])[:10])
        rows=[self._document_public(dict(r)) for r in db.execute(f"SELECT x.*,d.name AS department_name FROM personal_documents x LEFT JOIN departments d ON d.id=x.department_id WHERE {' AND '.join(clauses)} ORDER BY x.id DESC LIMIT 500",values)]
        return self.respond(start_response,200,rows)

    @staticmethod
    def _document_public(row):
        row.pop("stored_name",None); row.pop("active",None)
        row["download_url"]=f"/api/documents/{row['id']}/download"
        return row

    def create_document(self,db,body,user,start_response):
        title=str(body.get("title") or "").strip(); filename=os.path.basename(str(body.get("fileName") or "").replace("\\","/"))
        category=str(body.get("category") or "outros").strip(); content=body.get("fileBase64")
        allowed={"administrativo","oficio","memorando","relatorio","ata","formulario","portaria","referencia","outros"}
        if not title or len(title)>180 or not filename or len(filename)>180 or category not in allowed:
            raise ValueError("Informe título, arquivo e categoria válidos.")
        ext=Path(filename).suffix.lower()
        extensions={".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",".txt",".csv",".png",".jpg",".jpeg"}
        if ext not in extensions: raise ValueError("Formato não aceito. Use PDF, Office, TXT, CSV, PNG ou JPEG.")
        if not isinstance(content,str) or len(content)>11_300_000: raise ValueError("O arquivo deve ter até 8 MB.")
        try: raw=base64.b64decode(content,validate=True)
        except (ValueError,base64.binascii.Error): raise ValueError("Arquivo codificado inválido.") from None
        if not raw or len(raw)>8*1024*1024: raise ValueError("O arquivo deve ter entre 1 byte e 8 MB.")
        signatures={".pdf":raw.startswith(b"%PDF-"),".png":raw.startswith(b"\x89PNG\r\n\x1a\n"),
            ".jpg":raw.startswith(b"\xff\xd8\xff"),".jpeg":raw.startswith(b"\xff\xd8\xff"),
            ".doc":raw.startswith(bytes.fromhex("D0CF11E0A1B11AE1")),".xls":raw.startswith(bytes.fromhex("D0CF11E0A1B11AE1")),
            ".ppt":raw.startswith(bytes.fromhex("D0CF11E0A1B11AE1")),".docx":raw.startswith(b"PK\x03\x04"),
            ".xlsx":raw.startswith(b"PK\x03\x04"),".pptx":raw.startswith(b"PK\x03\x04"),
            ".txt":b"\x00" not in raw,".csv":b"\x00" not in raw}
        if not signatures[ext]: raise ValueError("O conteúdo não corresponde ao formato de arquivo informado.")
        task_id=body.get("linkedTaskId") or None; event_id=body.get("linkedEventId") or None
        department_id=body.get("departmentId") or None
        if department_id and (not str(department_id).isdigit() or not db.execute("SELECT 1 FROM departments WHERE id=? AND active=1", (int(department_id),)).fetchone()):
            raise ValueError("Selecione uma secretaria cadastrada e ativa.")
        if task_id and (not str(task_id).isdigit() or not self._personal_task(db,int(task_id),user["id"])): raise ValueError("A tarefa associada não pertence à sua conta.")
        if event_id and (not str(event_id).isdigit() or not self._work_event(db,int(event_id),user["id"])): raise ValueError("O evento associado não pertence à sua conta.")
        stored=uuid.uuid4().hex+ext; directory=self.db_path.parent/"private_files"/str(user["id"]); directory.mkdir(parents=True,exist_ok=True)
        file_path=directory/stored
        file_path.write_bytes(raw)
        mime=mimetypes.guess_type(filename)[0] or "application/octet-stream"
        try:
            cur=db.execute("INSERT INTO personal_documents(user_id,title,description,category,original_name,stored_name,mime_type,size_bytes,tag,linked_task_id,linked_event_id,attention,department_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (user["id"],title,str(body.get("description") or "")[:5000],category,filename,stored,mime,len(raw),str(body.get("tag") or "")[:120],int(task_id) if task_id else None,int(event_id) if event_id else None,int(bool(body.get("needsAttention"))),int(department_id) if department_id else None))
        except Exception:
            file_path.unlink(missing_ok=True); raise
        document_id=cur.lastrowid
        self._activity(db,user["id"],"document",document_id,"create",f"Documento adicionado: {title}")
        record_audit(db,user["id"],"create_document","personal_document",document_id,{"size":len(raw),"category":category})
        row=db.execute("SELECT x.*,d.name AS department_name FROM personal_documents x LEFT JOIN departments d ON d.id=x.department_id WHERE x.id=? AND x.user_id=?",(document_id,user["id"])).fetchone()
        return self.respond(start_response,201,self._document_public(dict(row)))

    def get_document(self,db,document_id,user,start_response):
        row=db.execute("SELECT x.*,d.name AS department_name FROM personal_documents x LEFT JOIN departments d ON d.id=x.department_id WHERE x.id=? AND x.user_id=? AND x.active=1",(document_id,user["id"])).fetchone()
        if not row: return self.respond(start_response,404,{"error":"Documento não encontrado."})
        return self.respond(start_response,200,self._document_public(dict(row)))

    def update_document(self,db,document_id,body,user,start_response):
        row=db.execute("SELECT x.*,d.name AS department_name FROM personal_documents x LEFT JOIN departments d ON d.id=x.department_id WHERE x.id=? AND x.user_id=? AND x.active=1",(document_id,user["id"])).fetchone()
        if not row: return self.respond(start_response,404,{"error":"Documento não encontrado."})
        title=str(body.get("title",row["title"]) or "").strip(); category=body.get("category",row["category"])
        if not title or len(title)>180 or category not in ("administrativo","oficio","memorando","relatorio","ata","formulario","portaria","referencia","outros"):
            raise ValueError("Título ou categoria inválidos.")
        task_id=body.get("linkedTaskId",row["linked_task_id"]) or None; event_id=body.get("linkedEventId",row["linked_event_id"]) or None
        department_id=body.get("departmentId",row["department_id"]) or None
        if department_id and (not str(department_id).isdigit() or not db.execute("SELECT 1 FROM departments WHERE id=? AND active=1", (int(department_id),)).fetchone()):
            raise ValueError("Selecione uma secretaria cadastrada e ativa.")
        if task_id and (not str(task_id).isdigit() or not self._personal_task(db,int(task_id),user["id"])): raise ValueError("A tarefa associada não pertence à sua conta.")
        if event_id and (not str(event_id).isdigit() or not self._work_event(db,int(event_id),user["id"])): raise ValueError("O evento associado não pertence à sua conta.")
        description=str(body.get("description",row["description"]) or "")[:5000]; tag=str(body.get("tag",row["tag"]) or "")[:120]
        attention=int(bool(body.get("needsAttention",row["attention"])))
        db.execute("UPDATE personal_documents SET title=?,description=?,category=?,tag=?,linked_task_id=?,linked_event_id=?,attention=?,department_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",(title,description,category,tag,int(task_id) if task_id else None,int(event_id) if event_id else None,attention,int(department_id) if department_id else None,document_id,user["id"]))
        self._activity(db,user["id"],"document",document_id,"edit",f"Documento atualizado: {title}")
        record_audit(db,user["id"],"update_document","personal_document",document_id)
        return self.get_document(db,document_id,user,start_response)

    def archive_document(self,db,document_id,user,start_response):
        row=db.execute("SELECT title FROM personal_documents WHERE id=? AND user_id=? AND active=1",(document_id,user["id"])).fetchone()
        if not row: return self.respond(start_response,404,{"error":"Documento não encontrado."})
        db.execute("UPDATE personal_documents SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",(document_id,user["id"]))
        self._activity(db,user["id"],"document",document_id,"archive",f"Documento arquivado: {row['title']}")
        record_audit(db,user["id"],"archive_document","personal_document",document_id)
        return self.respond(start_response,200,{"ok":True,"archived":True})

    def download_document(self,db,document_id,user,start_response):
        row=db.execute("SELECT * FROM personal_documents WHERE id=? AND user_id=? AND active=1",(document_id,user["id"])).fetchone()
        if not row: return self.respond(start_response,404,{"error":"Documento não encontrado."})
        target=(self.db_path.parent/"private_files"/str(user["id"])/row["stored_name"]).resolve()
        expected=(self.db_path.parent/"private_files"/str(user["id"])).resolve()
        if expected not in target.parents or not target.is_file(): return self.respond(start_response,404,{"error":"Arquivo não encontrado."})
        payload=target.read_bytes(); filename=str(row["original_name"]).replace("\r","").replace("\n","").replace('"',"'")
        start_response("200 OK",[("Content-Type",row["mime_type"]),("Content-Length",str(len(payload))),
            ("Content-Disposition",f"attachment; filename=\"arquivo\"; filename*=UTF-8''{quote(filename)}"),
            ("Cache-Control","no-store"),("X-Content-Type-Options","nosniff")])
        return [payload]

    def plan(self,db,method,body,user,start_response):
        day=str(body.get("date") or date.today().isoformat())
        try: day=date.fromisoformat(day).isoformat()
        except ValueError: raise ValueError("Data de planejamento inválida.") from None
        if method=="GET":
            row=db.execute("SELECT priorities,daily_notes,weekly_goal,updated_at FROM personal_plans WHERE user_id=? AND plan_date=?",(user["id"],day)).fetchone()
            return self.respond(start_response,200,{"date":day,"priorities":row["priorities"] if row else "","dailyNotes":row["daily_notes"] if row else "","weeklyGoal":row["weekly_goal"] if row else "","updatedAt":row["updated_at"] if row else None})
        priorities=str(body.get("priorities") or "").strip(); notes=str(body.get("dailyNotes") or "").strip(); goal=str(body.get("weeklyGoal") or "").strip()
        if len(priorities)>3000 or len(notes)>5000 or len(goal)>3000: raise ValueError("Uma nota excede o limite permitido.")
        db.execute("INSERT INTO personal_plans(user_id,plan_date,priorities,daily_notes,weekly_goal) VALUES(?,?,?,?,?) ON CONFLICT(user_id,plan_date) DO UPDATE SET priorities=excluded.priorities,daily_notes=excluded.daily_notes,weekly_goal=excluded.weekly_goal,updated_at=CURRENT_TIMESTAMP",(user["id"],day,priorities,notes,goal))
        self._activity(db,user["id"],"plan",None,"update",f"Planejamento atualizado para {day}")
        return self.respond(start_response,200,{"date":day,"priorities":priorities,"dailyNotes":notes,"weeklyGoal":goal})

    def global_search(self,db,body,user,start_response):
        query=str(body.get("q") or "").strip()
        if len(query)<2: return self.respond(start_response,200,{"tasks":[],"events":[],"documents":[],"notes":[]})
        pat=f"%{query[:100]}%"
        tasks=[dict(r) for r in db.execute("SELECT id,title,description,status,priority,due_at FROM personal_tasks WHERE user_id=? AND archived_at IS NULL AND (title LIKE ? OR description LIKE ? OR observations LIKE ?) ORDER BY updated_at DESC LIMIT 20",(user["id"],pat,pat,pat))]
        events=[dict(r) for r in db.execute("SELECT id,kind,title,description,starts_at,status,minutes FROM work_events WHERE user_id=? AND (title LIKE ? OR description LIKE ? OR agenda LIKE ? OR minutes LIKE ? OR participants LIKE ?) ORDER BY starts_at DESC LIMIT 20",(user["id"],pat,pat,pat,pat,pat))]
        documents=[self._document_public(dict(r)) for r in db.execute("SELECT * FROM personal_documents WHERE user_id=? AND active=1 AND (title LIKE ? OR description LIKE ? OR original_name LIKE ? OR tag LIKE ?) ORDER BY id DESC LIMIT 20",(user["id"],pat,pat,pat,pat))]
        notes=[dict(r) for r in db.execute("SELECT plan_date,priorities,daily_notes,weekly_goal FROM personal_plans WHERE user_id=? AND (priorities LIKE ? OR daily_notes LIKE ? OR weekly_goal LIKE ?) ORDER BY plan_date DESC LIMIT 20",(user["id"],pat,pat,pat))]
        return self.respond(start_response,200,{"tasks":tasks,"events":events,"documents":documents,"notes":notes})

    def notifications(self,db,user,start_response):
        pref={r["kind"]:bool(r["enabled"]) for r in db.execute("SELECT kind,enabled FROM personal_notification_preferences WHERE user_id=?",(user["id"],))}
        now=datetime.now(); today=now.date().isoformat(); soon=(now+timedelta(hours=24)).isoformat(timespec="minutes")
        tasks=db.execute("SELECT * FROM personal_tasks WHERE user_id=? AND archived_at IS NULL AND status IN ('aberta','em_andamento','aguardando') AND (due_at IS NOT NULL OR priority='urgente')",(user["id"],)).fetchall()
        for task in tasks:
            due=task["due_at"]; due_day=due[:10] if due else ""
            if due and due_day<today: kind="tarefa_atrasada"; msg=f"Tarefa atrasada: {task['title']}"
            elif due and due<=soon: kind="tarefa_prazo"; msg=f"Prazo próximo: {task['title']}"
            elif task["priority"]=="urgente": kind="tarefa_urgente"; msg=f"Tarefa urgente em aberto: {task['title']}"
            else: continue
            if not pref.get(kind,True): continue
            db.execute("INSERT INTO personal_notifications(user_id,kind,entity_type,entity_id,message,due_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,kind,entity_type,entity_id) DO UPDATE SET message=excluded.message,due_at=excluded.due_at",(user["id"],kind,"task",task["id"],msg,due))
        events=db.execute("SELECT * FROM work_events WHERE user_id=? AND status='agendada' AND kind='reuniao' AND starts_at>=? AND starts_at<=?",(user["id"],now.isoformat(timespec="minutes"),soon)).fetchall()
        for event in events:
            if not pref.get("reuniao_proxima",True): continue
            db.execute("INSERT INTO personal_notifications(user_id,kind,entity_type,entity_id,message,due_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,kind,entity_type,entity_id) DO UPDATE SET message=excluded.message,due_at=excluded.due_at",(user["id"],"reuniao_proxima","event",event["id"],f"Reunião próxima: {event['title']}",event["starts_at"]))
        documents=db.execute("SELECT id,title FROM personal_documents WHERE user_id=? AND active=1 AND attention=1",(user["id"],)).fetchall()
        for document in documents:
            if not pref.get("documento_atencao",True): continue
            db.execute("INSERT INTO personal_notifications(user_id,kind,entity_type,entity_id,message,due_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,kind,entity_type,entity_id) DO UPDATE SET message=excluded.message",(user["id"],"documento_atencao","document",document["id"],f"Documento precisa de atenção: {document['title']}",now.isoformat(timespec="minutes")))
        rows=[dict(r) for r in db.execute("SELECT * FROM personal_notifications WHERE user_id=? ORDER BY (read_at IS NULL) DESC,due_at LIMIT 100",(user["id"],))]
        live={("task",r["id"]) for r in tasks if (r["due_at"] and (r["due_at"][:10]<today or r["due_at"]<=soon)) or r["priority"]=="urgente"}
        live|={("event",r["id"]) for r in events}
        live|={("document",r["id"]) for r in documents}
        rows=[r for r in rows if (r["entity_type"],r["entity_id"]) in live and pref.get(r["kind"],True)]
        return self.respond(start_response,200,rows)

    def notification_preferences(self,db,method,body,user,start_response):
        kinds=("tarefa_atrasada","tarefa_prazo","tarefa_urgente","reuniao_proxima","documento_atencao")
        if method=="PUT":
            preferences=body.get("preferences")
            if not isinstance(preferences,dict): raise ValueError("Informe as preferências de notificação.")
            for kind in kinds:
                if kind in preferences and not isinstance(preferences[kind],bool): raise ValueError("Cada preferência deve ser ligada ou desligada.")
                db.execute("INSERT INTO personal_notification_preferences(user_id,kind,enabled) VALUES(?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET enabled=excluded.enabled",(user["id"],kind,int(preferences.get(kind,True))))
        saved={r["kind"]:bool(r["enabled"]) for r in db.execute("SELECT kind,enabled FROM personal_notification_preferences WHERE user_id=?",(user["id"],))}
        return self.respond(start_response,200,{kind:saved.get(kind,True) for kind in kinds})

    def mark_notification_read(self,db,notification_id,user,start_response):
        cur=db.execute("UPDATE personal_notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND user_id=?",(notification_id,user["id"]))
        if cur.rowcount!=1: return self.respond(start_response,404,{"error":"Notificação não encontrada."})
        return self.respond(start_response,200,{"ok":True})

    @staticmethod
    def list_users(db, body, user):
        rows = db.execute("SELECT u.id,u.username,u.display_name,u.role,u.active,uu.department_id,d.name AS department,uu.sector_id,s.name AS sector FROM users u LEFT JOIN user_units uu ON uu.user_id=u.id LEFT JOIN departments d ON d.id=uu.department_id LEFT JOIN sectors s ON s.id=uu.sector_id WHERE u.active=1 ORDER BY u.display_name")
        return 200, [dict(row) for row in rows]

    @staticmethod
    def list_audit(db, body, user):
        return 200, [dict(row) for row in db.execute("SELECT id,actor_id,action,entity,entity_id,details,happened_at,previous_hash,entry_hash FROM audit_log ORDER BY id DESC LIMIT 200")]


def bootstrap_admin(path: str | Path, username: str, name: str, password: str,
                    departments: Any = None) -> None:
    if len(password) < 12:
        raise ValueError("A senha inicial deve conter ao menos 12 caracteres.")
    department_names = initial_department_names(departments) if departments is not None else []
    initialize(path)
    with database(path) as db:
        if db.execute("SELECT 1 FROM users WHERE active=1 LIMIT 1").fetchone():
            raise ValueError("Já há usuário cadastrado. O bootstrap inicial foi bloqueado.")
        cur = db.execute("INSERT INTO users(username,display_name,password_hash,role) VALUES(?,?,?,'admin')",
                         (username, name, password_hash(password)))
        for department in department_names:
            department_cur = db.execute("INSERT INTO departments(name) VALUES(?)", (department,))
            record_audit(db, cur.lastrowid, "create", "department", department_cur.lastrowid,
                         {"name": department, "source": "initial_setup"})
        db.execute("INSERT OR IGNORE INTO system_flags(flag,value) VALUES('initial_admin','complete')")
        record_audit(db, cur.lastrowid, "bootstrap_admin", "user", cur.lastrowid, {"username": username})


def bootstrap_demo(path: str | Path, gestor_password: str, consulta_password: str,
                   consulta_username: str) -> None:
    """Prepare an isolated demo database without modifying an existing installation."""
    if len(gestor_password) < 12 or len(consulta_password) < 12:
        raise ValueError("As senhas de demonstração devem ter ao menos 12 caracteres.")
    if not consulta_username or "@" not in consulta_username or len(consulta_username) > 80 or any(char.isspace() for char in consulta_username):
        raise ValueError("Configure um e-mail autorizado válido para a conta de consulta da demonstração.")
    initialize(path)
    with database(path) as db:
        if db.execute("SELECT 1 FROM system_flags WHERE flag='demo_seeded'").fetchone():
            raise ValueError("Esta base de demonstração já foi preparada; nenhuma conta foi alterada.")
        if db.execute("SELECT 1 FROM users WHERE active=1 LIMIT 1").fetchone():
            raise ValueError("A base escolhida já contém usuários. Use um arquivo SQLite exclusivo para demonstração.")
        dep = db.execute("INSERT INTO departments(name) VALUES('Secretaria Demonstrativa')").lastrowid
        gestor = db.execute("INSERT INTO users(username,display_name,password_hash,role) VALUES(?,?,?,'gestor')",
                            ("demo.gestor", "Ana Lima · Demonstração", password_hash(gestor_password))).lastrowid
        consulta = db.execute("INSERT INTO users(username,display_name,password_hash,role) VALUES(?,?,?,'consulta')",
                              (consulta_username, "Bruno Alves · Demonstração", password_hash(consulta_password))).lastrowid
        db.executemany("INSERT INTO user_units(user_id,department_id) VALUES(?,?)", [(gestor, dep), (consulta, dep)])
        db.execute("INSERT INTO employee_profiles(user_id,work_email) VALUES(?,?)", (consulta, consulta_username))
        demand_id = db.execute("INSERT INTO demands(protocol,title,description,category,department_id,requester_type,requester_name,priority,status,created_by) VALUES(?,?,?,?,?,'cidadao',?,'alta','aberta',?)",
                               ("DEMO-2026-0001", "Iluminação pública na Praça das Palmeiras",
                                "Registro fictício para apresentação acadêmica. Nenhum dado pessoal real.",
                                "Iluminação pública", dep, "Mariana Costa (personagem fictícia)", gestor)).lastrowid
        record_audit(db, gestor, "create", "demand", demand_id, {"source": "demo_seed"})
        db.execute("INSERT INTO system_flags(flag,value) VALUES('demo_seeded','complete')")
