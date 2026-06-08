from fastapi import HTTPException
from sqlmodel import Session


def require_row(session: Session, model: type, row_id: str, label: str):
    row = session.get(model, row_id)
    if row is None:
        raise ValueError(f"{label} not found")
    return row


def require_user(session: Session, user_id: str):
    """Validate that a user_id exists. Raises HTTPException 400 if not found."""
    from app.models import User
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=400, detail=f"用户 {user_id} 不存在")
    return user
