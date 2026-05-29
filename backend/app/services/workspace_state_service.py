import json

from sqlmodel import Session, select

from app.models import (
    Workspace,
    WorkspaceMembership,
    MemberProfile,
    User,
    Project,
    Stage,
    Task,
)
from app.schemas.workspace_state import (
    MemberState,
    StageState,
    TaskState,
    ProjectState,
    WorkspaceStateResponse,
)


def get_workspace_state(session: Session, workspace_id: str) -> WorkspaceStateResponse | None:
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        return None

    # Members with profiles
    membership_rows = session.exec(
        select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id)
    ).all()
    members: list[MemberState] = []
    for mem in membership_rows:
        user = session.get(User, mem.user_id)
        if not user:
            continue
        profile = session.exec(
            select(MemberProfile).where(
                MemberProfile.user_id == mem.user_id,
                MemberProfile.workspace_id == workspace_id,
            )
        ).first()
        members.append(MemberState(
            user_id=user.id,
            display_name=user.display_name,
            skills=json.loads(profile.skills) if profile and profile.skills else [],
            available_hours_per_week=profile.available_hours_per_week if profile else 0.0,
            role_preference=profile.role_preference if profile else "",
            interests=profile.interests if profile else "",
            constraints=profile.constraints if profile else "",
        ))

    # Active project (first active or draft project in workspace)
    project_row = session.exec(
        select(Project)
        .where(Project.workspace_id == workspace_id)
        .order_by(Project.created_at.desc())
    ).first()

    project_state: ProjectState | None = None
    if project_row:
        stage_rows = session.exec(
            select(Stage).where(Stage.project_id == project_row.id).order_by(Stage.order_index)
        ).all()
        stages = [StageState(
            id=s.id, name=s.name, goal=s.goal,
            status=s.status if isinstance(s.status, str) else s.status.value, order_index=s.order_index,
        ) for s in stage_rows]

        task_rows = session.exec(
            select(Task).where(Task.project_id == project_row.id)
        ).all()
        tasks = [TaskState(
            id=t.id, title=t.title, status=t.status if isinstance(t.status, str) else t.status.value,
            priority=t.priority if isinstance(t.priority, str) else t.priority.value, owner_user_id=t.owner_user_id,
            due_date=t.due_date, can_cut=t.can_cut,
        ) for t in task_rows]

        project_state = ProjectState(
            id=project_row.id, name=project_row.name, idea=project_row.idea,
            deadline=project_row.deadline, status=project_row.status if isinstance(project_row.status, str) else project_row.status.value,
            current_stage_id=project_row.current_stage_id,
            stages=stages, tasks=tasks,
        )

    return WorkspaceStateResponse(
        workspace_id=workspace.id,
        workspace_name=workspace.name,
        members=members,
        project=project_state,
    )
