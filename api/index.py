"""Vercel WSGI entry point for the SIGAM API.

Keep database initialization out of module import: Vercel imports this module
for each cold start, and a transient database outage must not break static pages
or prevent the function from returning a useful HTTP response.
"""
from __future__ import annotations

import json
import logging
import os

from backend.app import API


REQUIRED_ENV = (
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
)


class VercelAPI:
    """Lazy WSGI adapter for Vercel's Python serverless runtime."""

    def __init__(self):
        self.missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
        self._api: API | None = None

        # Static routes do not need Supabase. Avoid API.__init__, which connects
        # to the database and validates the production schema immediately.
        self._static = API.__new__(API)
        self._static.db_path = None

    @staticmethod
    def _respond(start_response, status, payload, headers=()):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        start_response(status, [
            ("Content-Type", "application/json; charset=utf-8"),
            ("Content-Length", str(len(body))),
            ("Cache-Control", "no-store"),
            *headers,
        ])
        return [body]

    def _static_response(self, environ, start_response):
        path = environ.get("PATH_INFO", "/")
        if path == "/produtividade.html":
            start_response("302 Found", [
                ("Location", "/portal.html"),
                ("Cache-Control", "no-store"),
                ("Content-Length", "0"),
            ])
            return [b""]
        return self._static.static(environ, start_response)

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "/")
        if not path.startswith("/api/"):
            return self._static_response(environ, start_response)

        if self.missing:
            return self._respond(start_response, "503 Service Unavailable", {
                "error": "API SIGAM não configurada no ambiente de produção.",
                "missing": self.missing,
            }, [("Retry-After", "30")])

        if self._api is None:
            try:
                self._api = API(os.environ["DATABASE_URL"])
            except Exception as error:
                # SQLSTATE identifies database errors without logging the DSN,
                # password, token, or raw driver message.
                sqlstate = getattr(error, "sqlstate", None) or "unavailable"
                logging.error("SIGAM backend initialization failed (%s, SQLSTATE=%s).",
                              type(error).__name__, sqlstate)
                return self._respond(start_response, "503 Service Unavailable", {
                    "error": "API SIGAM temporariamente indisponível; verifique a conexão com o banco de dados.",
                }, [("Retry-After", "30")])

        return self._api(environ, start_response)


app = VercelAPI()
