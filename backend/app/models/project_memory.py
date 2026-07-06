import uuid
from datetime import UTC, datetime

from sqlalchemy import Index
from sqlmodel import SQLModel, Field


class ProjectMemory(SQLModel, table=True):
    __tablename__ = "project_memories"
    __table_args__ = (
        Index(
            "idx_memory_idemp",
            "project_id",
            "source_type",
            "source_id",
            "memory_type",
            "source_hash",
            unique=True,
        ),
        Index("idx_memory_project_status", "project_id", "status"),
        Index("idx_memory_workspace_project", "workspace_id", "project_id"),
        Index("idx_memory_source", "source_type", "source_id"),
    )

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    project_id: str = Field(foreign_key="projects.id", index=True)

    memory_type: str = Field(index=True)  # direction / boundary / plan / assignment / tradeoff / rejection / member_constraint
    scope: str  # project / stage / task / member
    content: str  # Agent 可引用的结论（中文，无 raw ID）
    rationale: str  # 当时为什么这么决定（中文，无 raw ID）

    source_type: str = Field(index=True)  # direction_card_confirmed / proposal_rejected / ...
    source_id: str = Field(index=True)  # 产生该决策的 proposal 对象 id
    source_hash: str | None = Field(default=None)  # SHA256 of 稳定 JSON 序列化

    status: str = Field(default="active", index=True)  # active / superseded / archived
    visibility: str = Field(default="team")  # team / subject_and_owner

    subject_user_id: str | None = Field(default=None, foreign_key="users.id", index=True)
    owner_user_id_snapshot: str | None = Field(default=None, index=True)
    related_stage_id: str | None = Field(default=None, foreign_key="stages.id", index=True)
    related_task_id: str | None = Field(default=None, foreign_key="tasks.id", index=True)
    related_risk_id: str | None = Field(default=None, foreign_key="risks.id", index=True)

    valid_until: datetime | None = Field(default=None, index=True)
    superseded_by_memory_id: str | None = Field(default=None, index=True)

    extractor_version: str = "det-v1.0-zh"
    schema_version: str = "pm-schema-v1"

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ProjectMemorySync(SQLModel, table=True):
    __tablename__ = "project_memory_sync"
    __table_args__ = (Index("idx_memory_sync_status", "sync_status"),)

    memory_id: str = Field(foreign_key="project_memories.id", primary_key=True)
    backend: str = "fts5"  # fts5 / sqlite_vec
    backend_memory_id: str | None = Field(default=None)
    sync_status: str = "pending"  # pending / synced / failed
    last_synced_at: datetime | None = Field(default=None)
    last_error: str | None = Field(default=None)
