"""Read-only fictional records served only to the signed demonstration session."""
from __future__ import annotations

from datetime import date, datetime, timedelta


def _stamp(days_ago: int = 0, hour: int = 9) -> str:
    value = datetime.combine(date.today() - timedelta(days=days_ago), datetime.min.time()).replace(hour=hour)
    return value.isoformat(timespec="seconds")


def departments() -> list[dict]:
    return [
        {"id": 901, "name": "Secretaria Demonstrativa de Administração",
         "description": "Unidade fictícia para apresentação do SIGAM.", "active": 1,
         "created_at": _stamp(20), "task_count": 2, "document_count": 1},
        {"id": 902, "name": "Secretaria Demonstrativa de Obras",
         "description": "Unidade fictícia para apresentação do SIGAM.", "active": 1,
         "created_at": _stamp(18), "task_count": 1, "document_count": 1},
        {"id": 903, "name": "Secretaria Demonstrativa de Saúde",
         "description": "Unidade fictícia para apresentação do SIGAM.", "active": 1,
         "created_at": _stamp(15), "task_count": 1, "document_count": 1},
    ]


def tasks() -> list[dict]:
    return [
        {"id": 9101, "title": "DEMONSTRATIVO — Revisar plano anual de atendimento",
         "description": "Registro fictício para demonstrar filtros, prazos e acompanhamento.",
         "category": "Planejamento", "start_at": _stamp(2), "due_at": _stamp(-5, 17),
         "priority": "alta", "status": "em_andamento", "observations": "Dado fictício.",
         "department_id": 901, "department_name": departments()[0]["name"], "created_at": _stamp(2)},
        {"id": 9102, "title": "DEMONSTRATIVO — Organizar agenda de reuniões",
         "description": "Registro fictício para demonstração do módulo de tarefas.",
         "category": "Administrativo", "start_at": _stamp(1), "due_at": _stamp(2, 16),
         "priority": "normal", "status": "aberta", "observations": "Dado fictício.",
         "department_id": 901, "department_name": departments()[0]["name"], "created_at": _stamp(1)},
        {"id": 9103, "title": "DEMONSTRATIVO — Acompanhar manutenção de praça",
         "description": "Registro fictício sem vínculo com uma solicitação real.",
         "category": "Serviços urbanos", "start_at": _stamp(4), "due_at": _stamp(7, 17),
         "priority": "baixa", "status": "aguardando", "observations": "Dado fictício.",
         "department_id": 902, "department_name": departments()[1]["name"], "created_at": _stamp(4)},
        {"id": 9104, "title": "DEMONSTRATIVO — Consolidar relatório mensal",
         "description": "Exemplo fictício concluído para apresentação do dashboard.",
         "category": "Relatório", "start_at": _stamp(8), "due_at": _stamp(3, 17),
         "priority": "normal", "status": "concluida", "observations": "Dado fictício.",
         "department_id": 903, "department_name": departments()[2]["name"], "created_at": _stamp(8)},
    ]


def documents() -> list[dict]:
    return [
        {"id": 9201, "title": "DEMONSTRATIVO — Relatório de atendimento",
         "description": "Arquivo fictício demonstrativo; nenhum documento real é compartilhado.",
         "category": "relatorio", "original_name": "demonstrativo-relatorio.txt",
         "size_bytes": 18432, "tag": "DEMONSTRATIVO", "created_at": _stamp(1),
         "department_id": 901, "department_name": departments()[0]["name"], "download_url": "#"},
        {"id": 9202, "title": "DEMONSTRATIVO — Memorando de manutenção",
         "description": "Registro fictício para visualizar a listagem e os filtros.",
         "category": "memorando", "original_name": "demonstrativo-memorando.txt",
         "size_bytes": 8192, "tag": "DEMONSTRATIVO", "created_at": _stamp(3),
         "department_id": 902, "department_name": departments()[1]["name"], "download_url": "#"},
        {"id": 9203, "title": "DEMONSTRATIVO — Ata de reunião",
         "description": "Registro inteiramente fictício para apresentação.",
         "category": "ata", "original_name": "demonstrativo-ata.txt",
         "size_bytes": 12288, "tag": "DEMONSTRATIVO", "created_at": _stamp(6),
         "department_id": 903, "department_name": departments()[2]["name"], "download_url": "#"},
    ]


def filter_tasks(filters: dict) -> list[dict]:
    rows = tasks()
    query = str(filters.get("q") or "").casefold()
    if query:
        rows = [row for row in rows if query in (row["title"] + " " + row["description"] + " " + row["department_name"]).casefold()]
    for key, field in (("status", "status"), ("priority", "priority"), ("departmentId", "department_id")):
        value = filters.get(key)
        if value:
            rows = [row for row in rows if str(row[field]) == str(value)]
    if filters.get("from"):
        rows = [row for row in rows if (row.get("due_at") or "")[:10] >= str(filters["from"])[:10]]
    if filters.get("to"):
        rows = [row for row in rows if (row.get("due_at") or "")[:10] <= str(filters["to"])[:10]]
    if filters.get("open") == "1":
        rows = [row for row in rows if row["status"] not in ("concluida", "cancelada")]
    return rows


def filter_documents(filters: dict) -> list[dict]:
    rows = documents()
    query = str(filters.get("q") or "").casefold()
    if query:
        rows = [row for row in rows if query in (row["title"] + " " + row["description"] + " " + row["original_name"]).casefold()]
    if filters.get("category"):
        rows = [row for row in rows if row["category"] == filters["category"]]
    if filters.get("departmentId"):
        rows = [row for row in rows if str(row["department_id"]) == str(filters["departmentId"])]
    return rows


def dashboard(day: str | None = None) -> dict:
    task_rows, document_rows, department_rows = tasks(), documents(), departments()
    statuses = ("aberta", "em_andamento", "aguardando", "concluida", "cancelada")
    counts_by_status = {status: sum(row["status"] == status for row in task_rows) for status in statuses}
    by_department = [{"department_id": unit["id"], "name": unit["name"],
                      "total": sum(row["department_id"] == unit["id"] for row in task_rows)}
                     for unit in department_rows]
    return {
        "date": day or date.today().isoformat(),
        "counts": {"abertas": counts_by_status["aberta"], "em_andamento": counts_by_status["em_andamento"],
                   "concluidas": counts_by_status["concluida"], "aguardando": counts_by_status["aguardando"],
                   "canceladas": counts_by_status["cancelada"], "atrasadas": 0, "proximas": 1, "urgentes": 0,
                   "total_tarefas": len(task_rows), "total_documentos": len(document_rows),
                   "total_secretarias": len(department_rows)},
        "taskStatuses": [{"status": status, "total": counts_by_status[status]} for status in statuses],
        "tasksByDepartment": by_department,
        "recentTasks": task_rows[:4], "routine": [], "upcomingEvents": [], "nextAction": None,
        "recentDocuments": document_rows[:3],
        "recentActivity": [{"summary": "Dados fictícios carregados no modo de demonstração.", "happened_at": _stamp()}],
    }
