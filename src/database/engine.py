"""SQLite database engine for AP Academy course data."""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from src.database.models import Base

_engine = None
_SessionLocal = None

DB_PATH = Path(__file__).parent.parent.parent / "data" / "ap_academy.db"


def get_engine():
    global _engine
    if _engine is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(
            f"sqlite:///{DB_PATH}",
            connect_args={"check_same_thread": False},
            echo=False,
        )
    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine())
    return _SessionLocal


def init_db():
    """Create all tables if they don't exist."""
    engine = get_engine()
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    """Get a database session. Use as dependency or context manager."""
    factory = get_session_factory()
    db = factory()
    try:
        return db
    except Exception:
        db.close()
        raise
