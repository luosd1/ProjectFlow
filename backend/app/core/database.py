from sqlmodel import SQLModel, Session, create_engine

from app.core.config import settings
import app.models  # noqa: F401 — ensure all models are registered before create_all

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
