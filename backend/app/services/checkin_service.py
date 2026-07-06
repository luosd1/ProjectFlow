from datetime import timedelta

from sqlmodel import Session, select

from app.core.db_utils import require_row
from app.models import CheckInCycle, CheckInResponse, Project, Stage, Task, User
from app.schemas.checkin import CheckInCycleCreate, CheckInResponseCreate


def create_checkin_cycle(session: Session, data: CheckInCycleCreate, *, auto_commit: bool = True) -> CheckInCycle:
    if data.cadence_days < 1:
        raise ValueError("cadence_days must be at least 1")
    require_row(session, Project, data.project_id, "Project")
    require_row(session, Stage, data.stage_id, "Stage")
    require_row(session, User, data.created_by_user_id, "Creator")

    cycle = CheckInCycle(
        project_id=data.project_id,
        stage_id=data.stage_id,
        cadence_days=data.cadence_days,
        start_date=data.start_date,
        next_due_date=data.start_date + timedelta(days=data.cadence_days),
        created_by_user_id=data.created_by_user_id,
    )
    session.add(cycle)
    if auto_commit:
        session.commit()
        session.refresh(cycle)
    else:
        session.flush()
    return cycle


def list_checkin_cycles_by_project(session: Session, project_id: str) -> list[CheckInCycle]:
    return list(session.exec(select(CheckInCycle).where(CheckInCycle.project_id == project_id)).all())


def create_checkin_response(
    session: Session,
    cycle_id: str,
    data: CheckInResponseCreate,
    *,
    auto_commit: bool = True,
) -> CheckInResponse:
    cycle = require_row(session, CheckInCycle, cycle_id, "Check-in cycle")
    require_row(session, Project, data.project_id, "Project")
    require_row(session, Stage, data.stage_id, "Stage")
    require_row(session, User, data.user_id, "User")
    if data.task_id:
        require_row(session, Task, data.task_id, "Task")
    if cycle.project_id != data.project_id or cycle.stage_id != data.stage_id:
        raise ValueError("Check-in response must match cycle project and stage")

    response = CheckInResponse(
        cycle_id=cycle_id,
        project_id=data.project_id,
        stage_id=data.stage_id,
        user_id=data.user_id,
        task_id=data.task_id,
        what_done=data.what_done,
        blocker=data.blocker,
        available_hours_next_cycle=data.available_hours_next_cycle,
        mood_or_confidence=data.mood_or_confidence,
    )
    session.add(response)
    if auto_commit:
        session.commit()
        session.refresh(response)
    else:
        session.flush()
    return response


def list_checkin_responses_by_cycle(session: Session, cycle_id: str) -> list[CheckInResponse]:
    return list(session.exec(select(CheckInResponse).where(CheckInResponse.cycle_id == cycle_id)).all())
