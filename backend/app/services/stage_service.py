import json
from datetime import UTC, datetime

from sqlmodel import Session, select

from app.models.project import Project
from app.models.stage import Stage
from app.models.task import Task
from app.schemas.stage import StageCreate, StageUpdate


def create_stage(session: Session, data: StageCreate) -> Stage:
    criteria = data.done_criteria if data.done_criteria is not None else []
    stage = Stage(
        project_id=data.project_id,
        name=data.name,
        goal=data.goal,
        start_date=data.start_date.isoformat() if hasattr(data.start_date, "isoformat") else data.start_date,
        end_date=data.end_date.isoformat() if hasattr(data.end_date, "isoformat") else data.end_date,
        deliverable=data.deliverable,
        done_criteria=json.dumps(criteria, ensure_ascii=False),
        order_index=data.order_index if data.order_index is not None else 0,
    )
    session.add(stage)
    session.commit()
    session.refresh(stage)
    return stage


def get_stage(session: Session, stage_id: str) -> Stage | None:
    return session.get(Stage, stage_id)


def list_stages_by_project(session: Session, project_id: str) -> list[Stage]:
    return list(
        session.exec(select(Stage).where(Stage.project_id == project_id)).all()
    )


def update_stage(session: Session, stage_id: str, data: StageUpdate) -> Stage:
    stage = session.get(Stage, stage_id)
    if stage is None:
        raise ValueError(f"Stage {stage_id} not found")

    update_data = data.model_dump(exclude_unset=True)
    if "done_criteria" in update_data and update_data["done_criteria"] is not None:
        update_data["done_criteria"] = json.dumps(update_data["done_criteria"], ensure_ascii=False)
    for key, value in update_data.items():
        setattr(stage, key, value)

    session.add(stage)
    session.commit()
    session.refresh(stage)
    return stage


def try_advance_stage(session: Session, task_id: str) -> str | None:
    """Check if the task's stage should be auto-completed, and if so activate the next one.

    Returns a short description of what happened (for logging), or None if no change.
    """
    task = session.get(Task, task_id)
    if task is None:
        return None

    stage = session.get(Stage, task.stage_id)
    if stage is None:
        return None
    if stage.status not in ("active", "at_risk"):
        return None

    # Are all non-done tasks in this stage done now?
    pending = session.exec(
        select(Task).where(
            Task.stage_id == stage.id,
            Task.status != "done",
        )
    ).all()

    if len(pending) > 0:
        return None

    # All tasks done — complete this stage
    stage.status = "completed"
    session.add(stage)

    # Find the next pending stage and activate it
    project = session.get(Project, stage.project_id)
    if project is not None and project.current_stage_id == stage.id:
        next_stage = session.exec(
            select(Stage)
            .where(
                Stage.project_id == stage.project_id,
                Stage.status == "pending",
            )
            .order_by(Stage.order_index)
        ).first()
        if next_stage is not None:
            next_stage.status = "active"
            project.current_stage_id = next_stage.id
            session.add(next_stage)
            session.add(project)
            return f"阶段「{stage.name}」已完成 → 自动激活「{next_stage.name}」"
        else:
            # No more stages — project is done
            project.current_stage_id = None
            project.status = "completed"
            project.updated_at = datetime.now(UTC)
            session.add(project)
            return f"阶段「{stage.name}」已完成，所有阶段已结束，项目标记为已完成"

    return f"阶段「{stage.name}」已完成"
