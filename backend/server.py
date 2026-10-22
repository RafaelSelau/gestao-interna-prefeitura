"""Servidor local do SIGPM: arquivos existentes + API em /api."""
import argparse
import getpass
import os
import sys
from wsgiref.simple_server import make_server

from app import API, DEFAULT_DB, INITIAL_DEPARTMENTS, bootstrap_admin, bootstrap_demo


def main():
    parser = argparse.ArgumentParser(description="Servidor local da API SIGPM")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--create-admin", action="store_true", help="cria o primeiro administrador e encerra")
    parser.add_argument("--create-demo", action="store_true", help="prepara uma base SQLite isolada com contas e dados fictícios e encerra")
    parser.add_argument("--demo-db", default=str(DEFAULT_DB.with_name("sigpm-demo.sqlite3")), help="arquivo SQLite exclusivo da demonstração")
    parser.add_argument("--demo-email", default=os.environ.get("SIGPM_DEMO_EMAIL", "").strip(),
                        help="e-mail autorizado da conta consulta (ou variável SIGPM_DEMO_EMAIL)")
    args = parser.parse_args()
    if args.create_demo:
        if not args.demo_email or "@" not in args.demo_email or len(args.demo_email) > 80 or any(char.isspace() for char in args.demo_email):
            parser.error("configure SIGPM_DEMO_EMAIL com o e-mail autorizado (máximo de 80 caracteres) antes de criar a base de demonstração")
        print("Esta operação usa somente a base de demonstração indicada em --demo-db; não altera --db nem o administrador existente.")
        gestor_password = getpass.getpass("Senha para demo.gestor (mínimo 12 caracteres): ")
        consulta_password = getpass.getpass(f"Senha para {args.demo_email} (perfil consulta, mínimo 12 caracteres): ")
        bootstrap_demo(args.demo_db, gestor_password, consulta_password, args.demo_email)
        print(f"Base de demonstração criada em: {args.demo_db}")
        print(f"Contas: demo.gestor (gestor) e {args.demo_email} (consulta). As senhas são as informadas acima.")
        return
    if args.create_admin:
        username = input("Usuário administrador: ").strip()
        name = input("Nome: ").strip()
        password = getpass.getpass("Senha (mínimo 12 caracteres): ")
        bootstrap_admin(args.db, username, name, password, departments=INITIAL_DEPARTMENTS)
        print("Administrador inicial criado.")
        return
    try:
        with make_server(args.host, args.port, API(args.db)) as server:
            print(f"SIGPM disponível em http://{args.host}:{args.port}/ (Ctrl+C para encerrar)")
            server.serve_forever()
    except OSError as error:
        print(f"Não foi possível iniciar em {args.host}:{args.port}: {error}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
