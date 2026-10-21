"""Servidor local do SIGPM: arquivos existentes + API em /api."""
import argparse
import getpass
import os
import sys
from wsgiref.simple_server import make_server

from app import API, DEFAULT_DB, INITIAL_DEPARTMENTS, bootstrap_admin


def main():
    parser = argparse.ArgumentParser(description="Servidor local da API SIGPM")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--create-admin", action="store_true", help="cria o primeiro administrador e encerra")
    args = parser.parse_args()
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
