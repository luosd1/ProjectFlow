import json

from sqlmodel import SQLModel, Session, create_engine

from app.core.config import settings
import app.models  # noqa: F401 — ensure all models are registered before create_all

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
# For SQLite, provide JSON serializer/deserializer so Column(JSON) works
# with dict/list values even on Python 3.12+ where default adapters were removed.
_engine_kwargs = {}
if settings.database_url.startswith("sqlite"):
    _engine_kwargs["json_serializer"] = json.dumps
    _engine_kwargs["json_deserializer"] = json.loads

engine = create_engine(settings.database_url, connect_args=connect_args, **_engine_kwargs)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
