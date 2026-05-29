from pydantic import BaseModel


class DemoResetRead(BaseModel):
    workspace_id: str
    project_id: str
    user_ids: list[str]
    stage_ids: list[str]
    task_ids: list[str]
