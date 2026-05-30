from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.core.security import require_demo_admin_access
from app.schemas.demo import DemoResetRead
from app.seed.demo_projectflow import PROJECT_ID, STAGE_IDS, TASK_IDS, USER_IDS, WORKSPACE_ID, seed_demo_data
from app.seed.reset import reset_demo_data

router = APIRouter(tags=["demo"], dependencies=[Depends(require_demo_admin_access)])


@router.post("/demo/reset", response_model=DemoResetRead)
def api_reset_demo(session: Session = Depends(get_session)):
    reset_demo_data(session)
    seed_demo_data(session)
    return DemoResetRead(
        workspace_id=WORKSPACE_ID,
        project_id=PROJECT_ID,
        user_ids=list(USER_IDS.values()),
        stage_ids=list(STAGE_IDS.values()),
        task_ids=list(TASK_IDS.values()),
    )
