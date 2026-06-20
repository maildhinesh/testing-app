from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from .config import settings

# On serverless (Vercel) every invocation is its own short-lived process, so a
# persistent connection pool just accumulates stale/leaked connections and
# exhausts Postgres. NullPool opens one connection per request and closes it on
# release; pair it with Neon's POOLED connection string (host contains "-pooler")
# so PgBouncer handles real pooling on Neon's side.
engine = create_engine(settings.database_url, poolclass=NullPool, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
