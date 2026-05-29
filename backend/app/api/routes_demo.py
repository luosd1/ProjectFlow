from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.demo import DemoResetRead
from app.seed.demo_seed import reset_demo_data

router = APIRouter(tags=["demo"])


@router.post("/demo/reset", response_model=DemoResetRead)
def api_reset_demo(session: Session = Depends(get_session)):
    return reset_demo_data(session)
