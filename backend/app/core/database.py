import json

from sqlalchemy import inspect, text
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


def _migrate_agent_proposals() -> None:
    """Add missing rejection_reason column to agent_proposals if needed."""
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.connect() as conn:
        inspector = inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("agent_proposals")}
        if "rejection_reason" not in columns:
            conn.execute(text("ALTER TABLE agent_proposals ADD COLUMN rejection_reason TEXT"))
            conn.commit()


def _migrate_tasks_order_index() -> None:
    """Add order_index column to tasks table if missing."""
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.connect() as conn:
        inspector = inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("tasks")}
        if "order_index" not in columns:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0"))
            conn.commit()


def _migrate_workspace_team_fields() -> None:
    """Add team_size and use_case columns to workspaces table if missing."""
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.connect() as conn:
        inspector = inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("workspaces")}
        if "team_size" not in columns:
            conn.execute(text("ALTER TABLE workspaces ADD COLUMN team_size INTEGER"))
        if "use_case" not in columns:
            conn.execute(text("ALTER TABLE workspaces ADD COLUMN use_case TEXT"))
        conn.commit()


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    _migrate_agent_proposals()
    _migrate_tasks_order_index()
    _migrate_workspace_team_fields()


def get_session():
    with Session(engine) as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
