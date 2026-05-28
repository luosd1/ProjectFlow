from datetime import date, datetime
from pydantic import BaseModel


class MemberState(BaseModel):
    user_id: str
    display_name: str
    skills: list
    available_hours_per_week: float
    role_preference: str
    interests: str
    constraints: str


class StageState(BaseModel):
    id: str
    name: str
    goal: str
    status: str
    order_index: int


class TaskState(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    owner_user_id: str | None
    due_date: date
    can_cut: bool


class ProjectState(BaseModel):
    id: str
    name: str
    idea: str
    deadline: date
    status: str
    current_stage_id: str | None
    stages: list[StageState]
    tasks: list[TaskState]


class WorkspaceStateResponse(BaseModel):
    workspace_id: str
    workspace_name: str
    members: list[MemberState]
    project: ProjectState | None
