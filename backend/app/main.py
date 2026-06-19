import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import INSECURE_DEFAULTS, settings
from .database import Base, SessionLocal, engine
from .models import Admin
from .routers import (
    admin_auth,
    admin_progress,
    admin_questions,
    admin_registrations,
    admin_tests,
    public,
    student,
)
from .security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")


def check_secrets() -> None:
    """Block startup (in production) or warn (otherwise) on default secrets."""
    insecure = [name for name, default in INSECURE_DEFAULTS.items() if getattr(settings, name) == default]
    if not insecure:
        return
    if settings.is_production:
        raise RuntimeError(
            "Refusing to start in production with default secrets for: "
            + ", ".join(insecure)
            + ". Set strong values via environment variables."
        )
    logger.warning("Using INSECURE default values for %s — fine for local dev, never for production.", ", ".join(insecure))


def bootstrap_admin() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Admin).filter(Admin.email == settings.admin_email.lower()).first()
        if existing is None:
            db.add(
                Admin(
                    email=settings.admin_email.lower(),
                    password_hash=hash_password(settings.admin_password),
                    name=settings.admin_name,
                )
            )
            db.commit()
            logger.info("Bootstrapped admin account: %s", settings.admin_email)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    check_secrets()
    Base.metadata.create_all(bind=engine)
    bootstrap_admin()
    yield


app = FastAPI(title="Tamil Knowledge Test API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_base_url, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(student.router)
app.include_router(admin_auth.router)
app.include_router(admin_tests.router)
app.include_router(admin_questions.router)
app.include_router(admin_registrations.router)
app.include_router(admin_progress.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
