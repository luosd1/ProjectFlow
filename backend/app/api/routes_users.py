from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.user import UserCreate, UserRead
from app.services import user_service

router = APIRouter(tags=["users"])


@router.post("/users", response_model=UserRead, status_code=201)
def create_user(data: UserCreate, session: Session = Depends(get_session)):
    user = user_service.create_user(session, data)
    return user


@router.get("/users", response_model=list[UserRead])
def list_users(session: Session = Depends(get_session)):
    return user_service.list_users(session)


@router.get("/users/{user_id}", response_model=UserRead)
def get_user(user_id: str, session: Session = Depends(get_session)):
    user = user_service.get_user(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
