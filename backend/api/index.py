# Vercel serverless entrypoint.
# Vercel's Python runtime serves the ASGI `app` exported here.
# The project root (backend/) is on sys.path, so `app.main` resolves.
from app.main import app  # noqa: F401
