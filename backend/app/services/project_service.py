import json
from datetime import UTC, datetime
from typing import Any

from sqlmodel import Session, select

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


def create_project(session: Session, data: ProjectCreate) -> Project:
    project = Project(
        workspace_id=data.workspace_id,
        name=data.name,
        idea=data.idea,
        deadline=data.deadline,
        deliverables=data.deliverables,
        created_by=data.created_by,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def get_project(session: Session, project_id: str) -> Project | None:
    return session.get(Project, project_id)


def list_projects_by_workspace(session: Session, workspace_id: str) -> list[Project]:
    return list(
        session.exec(select(Project).where(Project.workspace_id == workspace_id)).all()
    )


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _first_text(*values: Any) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def normalize_direction_card(value: str | dict | None) -> dict | None:
    """Return the current direction-card API shape from current or legacy data."""
    if value is None:
        return None
    if isinstance(value, str):
        if not value.strip():
            return None
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return None
    if not isinstance(value, dict):
        return None

    boundaries = _string_list(value.get("boundaries"))
    if not boundaries:
        boundaries = _string_list(value.get("constraints"))
        out_of_scope = _string_list(value.get("out_of_scope"))
        boundaries.extend(
            item for item in out_of_scope if item not in boundaries
        )

    risks = _string_list(value.get("risks"))
    if not risks:
        risks = _string_list(value.get("initial_risks"))

    return {
        "problem": _first_text(value.get("problem")),
        "users": _first_text(value.get("users"), value.get("target_users")),
        "value": _first_text(value.get("value"), value.get("core_value")),
        "deliverables": _string_list(value.get("deliverables")),
        "boundaries": boundaries,
        "risks": risks,
        "suggested_questions": _string_list(value.get("suggested_questions")),
    }


def update_project(session: Session, project_id: str, data: ProjectUpdate) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise ValueError(f"Project {project_id} not found")

    update_data = data.model_dump(exclude_unset=True)
    if "direction_card" in update_data and update_data["direction_card"] is not None:
        if not isinstance(update_data["direction_card"], str):
            update_data["direction_card"] = json.dumps(
                update_data["direction_card"],
                ensure_ascii=False,
            )
    for key, value in update_data.items():
        setattr(project, key, value)
    project.updated_at = datetime.now(UTC)

    session.add(project)
    session.commit()
    session.refresh(project)
    return project
