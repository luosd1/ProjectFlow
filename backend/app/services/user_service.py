from sqlmodel import Session, select

from app.models.user import User
from app.schemas.user import UserCreate


def create_user(session: Session, data: UserCreate) -> User:
    user = User(
        display_name=data.display_name,
        email=data.email,
        avatar_url=data.avatar_url,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def get_user(session: Session, user_id: str) -> User | None:
    return session.get(User, user_id)


def list_users(session: Session) -> list[User]:
    return list(session.exec(select(User)).all())
