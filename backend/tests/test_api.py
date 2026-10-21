import io
import json
import tempfile
import unittest
from pathlib import Path

from backend.app import API, bootstrap_admin, database


class APITest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1])
        self.db_path = Path(self.temp.name) / "test.sqlite3"
        bootstrap_admin(self.db_path, "admin", "Administradora", "senha-segura-123")
        self.api = API(self.db_path)
        self.cookie = ""
        self.csrf = ""

    def tearDown(self):
        self.temp.cleanup()

    def request(self, method, path, payload=None, authenticated=True, remote_addr="127.0.0.1"):
        raw = json.dumps(payload or {}).encode()
        environ = {"REQUEST_METHOD": method, "PATH_INFO": path.split("?", 1)[0],
                   "QUERY_STRING": path.split("?", 1)[1] if "?" in path else "",
                   "CONTENT_LENGTH": str(len(raw)), "wsgi.input": io.BytesIO(raw),
                   "REMOTE_ADDR": remote_addr,
                   "HTTP_COOKIE": self.cookie if authenticated else "",
                   "HTTP_X_CSRF_TOKEN": self.csrf if method not in ("GET",) else ""}
        result = {}

        def start_response(status, headers):
            result["status"] = int(status.split()[0])
            result["headers"] = dict(headers)

        body = b"".join(self.api(environ, start_response))
        if "Set-Cookie" in result.get("headers", {}):
            self.cookie = result["headers"]["Set-Cookie"].split(";", 1)[0]
        try:
            result["body"] = json.loads(body) if body else None
        except (json.JSONDecodeError, UnicodeDecodeError):
            result["body"] = body
        return result

    def login(self):
        result = self.request("POST", "/api/login", {"username": "admin", "password": "senha-segura-123"}, authenticated=False)
        self.assertEqual(result["status"], 200)
        self.csrf = result["body"]["csrfToken"]

    def test_auth_crud_relationship_and_audit(self):
        self.assertEqual(self.request("GET", "/api/departments")["status"], 401)
        self.login()
        department = self.request("POST", "/api/departments", {"name": "Secretaria de Administração"})
        self.assertEqual(department["status"], 201)
        sector = self.request("POST", "/api/sectors", {"departmentId": department["body"]["id"], "name": "Protocolo"})
        self.assertEqual(sector["status"], 201)
        person = self.request("POST", "/api/people", {"kind": "fisica", "name": "Pessoa de teste", "document": "TESTE-001"})
        self.assertEqual(person["status"], 201)
        self.assertEqual(len(self.request("GET", "/api/people?q=Pessoa")["body"]), 1)
        audit = self.request("GET", "/api/audit")["body"]
        self.assertTrue(any(entry["entity"] == "person" and entry["action"] == "create" for entry in audit))

    def test_csrf_duplicate_validation_and_permissions(self):
        self.login()
        original = self.csrf
        self.csrf = "incorrecto"
        self.assertEqual(self.request("POST", "/api/departments", {"name": "Teste"})["status"], 403)
        self.csrf = original
        created = self.request("POST", "/api/departments", {"name": "Administração"})
        self.assertEqual(created["status"], 201)
        duplicate = self.request("POST", "/api/departments", {"name": "Administração"})
        self.assertEqual(duplicate["status"], 409)
        with database(self.db_path) as db:
            self.assertTrue(db.execute("SELECT password_hash FROM users WHERE username='admin'").fetchone()[0].startswith("scrypt$"))

    def test_initial_admin_is_one_time_only(self):
        with self.assertRaises(ValueError):
            bootstrap_admin(self.db_path, "second", "Segundo", "senha-segura-123")

    def test_first_run_admin_wizard_is_local_and_one_time(self):
        fresh_path = Path(self.temp.name) / "first-run.sqlite3"
        self.api = API(fresh_path)
        self.assertTrue(self.request("GET", "/api/setup/status", authenticated=False)["body"]["needsAdmin"])
        remote = self.request("POST", "/api/setup/admin", {"username": "raiz", "name": "Admin inicial", "password": "senha-inicial-123"}, authenticated=False, remote_addr="192.168.1.10")
        self.assertEqual(remote["status"], 403)
        setup = self.request("POST", "/api/setup/admin", {"username": "raiz", "name": "Admin inicial", "password": "senha-inicial-123"}, authenticated=False)
        self.assertEqual(setup["status"], 201)
        self.assertEqual(setup["body"]["departmentsCreated"], 8)
        public_departments = self.request("GET", "/api/public/departments", authenticated=False)["body"]
        self.assertEqual(len(public_departments), 8)
        self.assertFalse(self.request("GET", "/api/setup/status", authenticated=False)["body"]["needsAdmin"])
        login = self.request("POST", "/api/login", {"username": "raiz", "password": "senha-inicial-123"}, authenticated=False)
        self.assertEqual(login["status"], 200)
        self.csrf = login["body"]["csrfToken"]
        department = self.request("GET", "/api/departments")["body"][0]
        demand = self.request("POST", "/api/demands", {"title": "Pedido de teste", "description": "Descrição de validação.",
            "category": "Serviço", "departmentId": department["id"], "requesterName": "Solicitante de teste", "priority": "alta"})
        self.assertEqual(demand["status"], 201)
        self.assertEqual(demand["body"]["department_id"], department["id"])
        blocked = self.request("POST", "/api/setup/admin", {"username": "outro", "name": "Outro", "password": "senha-inicial-456"}, authenticated=False)
        self.assertEqual(blocked["status"], 409)

    def test_first_run_accepts_custom_editable_department_names(self):
        fresh_path = Path(self.temp.name) / "custom-setup.sqlite3"
        self.api = API(fresh_path)
        setup = self.request("POST", "/api/setup/admin", {"username": "raiz", "name": "Admin inicial", "password": "senha-inicial-123",
            "departments": [" Obras ", "Cultura", "obras"]}, authenticated=False)
        self.assertEqual(setup["status"], 201)
        departments = self.request("GET", "/api/public/departments", authenticated=False)["body"]
        self.assertEqual([item["name"] for item in departments], ["Cultura", "Obras"])

    def test_role_permission_is_checked_by_api(self):
        self.login()
        department = self.request("POST", "/api/departments", {"name": "Secretaria de Consulta"})["body"]
        create = self.request("POST", "/api/users", {"username": "leitura", "name": "Consulta", "role": "consulta",
            "password": "outra-senha-123", "departmentId": department["id"]})
        self.assertEqual(create["status"], 201)
        result = self.request("POST", "/api/login", {"username": "leitura", "password": "outra-senha-123"}, authenticated=False)
        self.assertEqual(result["status"], 200)
        self.cookie = result["headers"]["Set-Cookie"].split(";", 1)[0]
        self.csrf = result["body"]["csrfToken"]
        self.assertEqual(self.request("POST", "/api/departments", {"name": "Bloqueada"})["status"], 403)
        self.assertEqual(self.request("GET", "/api/departments")["status"], 200)

    def test_demand_workflow_department_scope_and_history(self):
        self.login()
        obras = self.request("POST", "/api/departments", {"name": "Obras"})["body"]
        saude = self.request("POST", "/api/departments", {"name": "Saúde"})["body"]
        user = self.request("POST", "/api/users", {"username": "obras", "name": "Servidor Obras", "role": "gestor",
            "password": "obras-senha-123", "departmentId": obras["id"]})
        self.assertEqual(user["status"], 201)
        login = self.request("POST", "/api/login", {"username": "obras", "password": "obras-senha-123"}, authenticated=False)
        self.cookie = login["headers"]["Set-Cookie"].split(";", 1)[0]
        self.csrf = login["body"]["csrfToken"]
        demand = self.request("POST", "/api/demands", {"title": "Buraco na rua", "description": "Solicitação de reparo",
            "category": "Manutenção urbana", "departmentId": obras["id"], "requesterName": "Solicitante de teste",
            "requesterType": "servidor", "priority": "alta"})
        self.assertEqual(demand["status"], 201)
        demand_id = demand["body"]["id"]
        self.assertRegex(demand["body"]["protocol"], r"^SIGAM-\d{4}-\d{6}$")
        self.assertEqual(self.request("POST", f"/api/demands/{demand_id}/actions", {"action": "assumir"})["body"]["status"], "em_atendimento")
        solved = self.request("POST", f"/api/demands/{demand_id}/actions", {"action": "solucao", "text": "Equipe registrou providência."})
        self.assertEqual(solved["body"]["status"], "resolvida")
        closed = self.request("POST", f"/api/demands/{demand_id}/actions", {"action": "encerrar"})
        self.assertEqual(closed["body"]["status"], "encerrada")
        reopened = self.request("POST", f"/api/demands/{demand_id}/actions", {"action": "reabrir", "justification": "Solicitante informou que persiste."})
        self.assertEqual(reopened["body"]["status"], "em_atendimento")
        forwarded = self.request("POST", f"/api/demands/{demand_id}/actions", {"action": "encaminhar", "departmentId": saude["id"], "justification": "Análise conjunta necessária."})
        self.assertEqual(forwarded["body"]["department_id"], saude["id"])
        self.assertEqual(self.request("GET", f"/api/demands/{demand_id}/history")["status"], 403)
        self.assertEqual(self.request("GET", "/api/demands")["body"], [])
        self.login()
        self.assertEqual(self.request("GET", f"/api/demands/{demand_id}")["status"], 200)
        self.assertEqual(len(self.request("GET", f"/api/demands/{demand_id}/history")["body"]), 6)

    def test_demand_requires_owned_secretariat_and_justified_transitions(self):
        self.login()
        first = self.request("POST", "/api/departments", {"name": "Administração"})["body"]
        second = self.request("POST", "/api/departments", {"name": "Educação"})["body"]
        self.request("POST", "/api/users", {"username": "adm", "name": "Gestor", "role": "gestor",
            "password": "adm-senha-123", "departmentId": first["id"]})
        login = self.request("POST", "/api/login", {"username": "adm", "password": "adm-senha-123"}, authenticated=False)
        self.cookie = login["headers"]["Set-Cookie"].split(";", 1)[0]
        self.csrf = login["body"]["csrfToken"]
        denied = self.request("POST", "/api/demands", {"title": "Teste", "description": "Teste", "category": "Geral",
            "departmentId": second["id"], "requesterName": "Teste"})
        self.assertEqual(denied["status"], 403)
        created = self.request("POST", "/api/demands", {"title": "Pedido", "description": "Teste", "category": "Geral",
            "departmentId": first["id"], "requesterName": "Teste"})
        self.assertEqual(created["status"], 201)
        demand_id = created["body"]["id"]
        invalid = self.request("POST", f"/api/demands/{demand_id}/actions", {"action": "status", "status": "cancelada"})
        self.assertEqual(invalid["status"], 400)
        invalid_resolution = self.request("POST", f"/api/demands/{demand_id}/actions", {"action": "status", "status": "resolvida"})
        self.assertEqual(invalid_resolution["status"], 400)

    def test_personal_productivity_profile_tasks_calendar_documents_and_isolation(self):
        import base64

        self.login()
        profile = self.request("PUT", "/api/profile", {"fullName": "Servidor Teste", "workEmail": "servidor@example.gov.br",
            "jobTitle": "Analista", "employeeNumber": "M-001", "workPhone": "1111", "workHours": "8h às 14h"})
        self.assertEqual(profile["status"], 200)
        self.assertEqual(profile["body"]["job_title"], "Analista")
        self.assertEqual(self.request("GET", "/api/profile")["body"]["full_name"], "Servidor Teste")

        task = self.request("POST", "/api/tasks", {"title": "Preparar relatório", "description": "Fechar números do mês",
            "category": "Relatório", "priority": "urgente", "dueAt": "2020-01-01T09:00", "status": "aberta"})
        self.assertEqual(task["status"], 201)
        task_id = task["body"]["id"]
        self.assertEqual(self.request("PUT", f"/api/tasks/{task_id}", {"status": "em_andamento"})["body"]["status"], "em_andamento")
        completed = self.request("PUT", f"/api/tasks/{task_id}", {"status": "concluida"})["body"]
        self.assertTrue(completed["completed_at"])
        reopened = self.request("PUT", f"/api/tasks/{task_id}", {"status": "aberta"})["body"]
        self.assertIsNone(reopened["completed_at"])
        dashboard = self.request("GET", "/api/dashboard?date=2020-01-02")["body"]
        self.assertEqual(dashboard["counts"]["atrasadas"], 1)
        self.assertEqual(dashboard["counts"]["urgentes"], 1)
        self.assertEqual(dashboard["nextAction"]["id"], task_id)
        self.assertGreaterEqual(len(self.request("GET", f"/api/tasks/{task_id}/history")["body"]), 4)
        self.assertEqual(len(self.request("GET", "/api/tasks?q=relatório&priority=urgente")["body"]), 1)

        meeting = self.request("POST", "/api/events", {"kind": "reuniao", "title": "Reunião de planejamento",
            "startsAt": "2099-03-14T10:00", "endsAt": "2099-03-14T11:00", "agenda": "Prioridades", "participants": "Equipe"})
        self.assertEqual(meeting["status"], 201)
        event_id = meeting["body"]["id"]
        conflict = self.request("POST", "/api/events", {"kind": "reuniao", "title": "Reunião sobreposta",
            "startsAt": "2099-03-14T10:30", "endsAt": "2099-03-14T11:30"})
        self.assertEqual(len(conflict["body"]["conflicts"]), 1)
        self.assertEqual(len(self.request("GET", "/api/events?kind=reuniao&from=2099-03-01&to=2099-03-31")["body"]), 2)
        minutes = self.request("PUT", f"/api/events/{event_id}", {"minutes": "Ata resumida com encaminhamentos."})
        self.assertIn("encaminhamentos", minutes["body"]["minutes"])
        from_meeting = self.request("POST", f"/api/events/{event_id}/tasks", {"title": "Enviar ata", "priority": "alta"})
        self.assertEqual(from_meeting["status"], 201)
        self.assertEqual(from_meeting["body"]["source_event_id"], event_id)

        file_content = b"%PDF-1.4\nconteudo de teste"
        document = self.request("POST", "/api/documents", {"title": "Ata da reunião", "category": "ata",
            "fileName": "ata.pdf", "fileBase64": base64.b64encode(file_content).decode(), "linkedEventId": event_id,
            "needsAttention": True})
        self.assertEqual(document["status"], 201)
        document_id = document["body"]["id"]
        self.assertEqual(self.request("GET", "/api/documents?q=Ata&category=ata")["body"][0]["id"], document_id)
        renamed = self.request("PUT", f"/api/documents/{document_id}", {"title": "Ata validada", "needsAttention": True})
        self.assertEqual(renamed["body"]["title"], "Ata validada")
        download = self.request("GET", f"/api/documents/{document_id}/download")
        self.assertEqual(download["status"], 200)
        self.assertEqual(download["body"], file_content)
        notices = self.request("GET", "/api/notifications")["body"]
        self.assertTrue(any(n["kind"] == "documento_atencao" for n in notices))
        self.assertTrue(any(n["kind"] == "tarefa_atrasada" for n in notices))
        read_id = next(n["id"] for n in notices if n["kind"] == "documento_atencao")
        self.assertEqual(self.request("POST", f"/api/notifications/{read_id}/read", {})["status"], 200)
        self.assertEqual(self.request("GET", f"/api/search?q=encaminhamentos")["body"]["events"][0]["id"], event_id)
        preferences = self.request("PUT", "/api/notifications/preferences", {"preferences": {"tarefa_urgente": False}})
        self.assertFalse(preferences["body"]["tarefa_urgente"])
        plan = self.request("PUT", "/api/plan", {"date": "2026-10-21", "priorities": "Fechar relatório", "dailyNotes": "Ligar ao setor", "weeklyGoal": "Concluir revisão"})
        self.assertEqual(self.request("GET", "/api/plan?date=2026-10-21")["body"]["weeklyGoal"], "Concluir revisão")
        invalid_file = self.request("POST", "/api/documents", {"title": "Arquivo inválido", "category": "ata",
            "fileName": "falso.pdf", "fileBase64": base64.b64encode(b"isso nao e pdf").decode()})
        self.assertEqual(invalid_file["status"], 400)

        department = self.request("POST", "/api/departments", {"name": "Secretaria do outro funcionário"})["body"]
        created = self.request("POST", "/api/users", {"username": "outro", "name": "Outro funcionário",
            "role": "atendente", "password": "outra-senha-123", "departmentId": department["id"]})
        self.assertEqual(created["status"], 201)
        login = self.request("POST", "/api/login", {"username": "outro", "password": "outra-senha-123"}, authenticated=False)
        self.cookie = login["headers"]["Set-Cookie"].split(";", 1)[0]
        self.csrf = login["body"]["csrfToken"]
        self.assertEqual(self.request("GET", "/api/tasks")["body"], [])
        self.assertEqual(self.request("GET", f"/api/tasks/{task_id}")["status"], 404)
        self.assertEqual(self.request("GET", f"/api/events/{event_id}")["status"], 404)
        self.assertEqual(self.request("GET", f"/api/documents/{document_id}")["status"], 404)
        self.assertEqual(self.request("GET", f"/api/documents/{document_id}/download")["status"], 404)
        self.assertEqual(self.request("GET", "/backend/sigpm.sqlite3", authenticated=False)["status"], 404)
        self.assertEqual(self.request("GET", "/not-a-folder/../backend/sigpm.sqlite3", authenticated=False)["status"], 404)

    def test_citizen_submission_private_tracking_and_information_response(self):
        self.login()
        department = self.request("POST", "/api/departments", {"name": "Zeladoria"})["body"]
        submitted = self.request("POST", "/api/public/demands", {"title": "Lâmpada apagada", "description": "Poste em frente à praça.",
            "category": "Iluminação pública", "departmentId": department["id"], "requesterName": "Munícipe de teste",
            "address": "Praça Teste"}, authenticated=False)
        self.assertEqual(submitted["status"], 201)
        protocol, token = submitted["body"]["protocol"], submitted["body"]["accessToken"]
        tracked = self.request("POST", "/api/public/track", {"protocol": protocol, "accessToken": token}, authenticated=False)
        self.assertEqual(tracked["status"], 200)
        self.assertNotIn("description", tracked["body"])
        self.assertNotIn("requester_name", tracked["body"])
        self.assertEqual(self.request("POST", "/api/public/track", {"protocol": protocol, "accessToken": "chave-errada"}, authenticated=False)["status"], 404)
        internal = self.request("GET", "/api/demands")["body"][0]
        self.assertTrue(internal["public_tracking"])
        self.assertNotIn("citizen_token_hash", internal)
        self.request("POST", f"/api/demands/{internal['id']}/actions", {"action": "assumir"})
        asked = self.request("POST", f"/api/demands/{internal['id']}/actions", {"action": "pedir_informacao", "message": "Envie um ponto de referência próximo."})
        self.assertEqual(asked["body"]["status"], "aguardando_informacoes")
        tracked = self.request("POST", "/api/public/track", {"protocol": protocol, "accessToken": token}, authenticated=False)
        self.assertTrue(tracked["body"]["canRespond"])
        self.assertIn("ponto de referência", tracked["body"]["events"][-1]["message"])
        response = self.request("POST", "/api/public/respond", {"protocol": protocol, "accessToken": token, "message": "Ao lado da escola municipal."}, authenticated=False)
        self.assertEqual(response["status"], 200)
        self.assertEqual(self.request("POST", "/api/public/track", {"protocol": protocol, "accessToken": token}, authenticated=False)["body"]["status"], "em_atendimento")


if __name__ == "__main__":
    unittest.main()
