"""Vercel WSGI entry point for the SIGAM API."""
import os

from backend.app import API


required = ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
missing = [name for name in required if not os.environ.get(name)]
if missing:
    raise RuntimeError("Configure as variáveis de ambiente exigidas para a API SIGAM.")

# The API is a WSGI application. Vercel's Python runtime discovers this `app`.
app = API(os.environ["DATABASE_URL"])
