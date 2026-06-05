"""Regression tests for workspace state member query loading."""
import json
from collections.abc import Iterator

import pytest
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.models import (
    MemberProfile,
    User,
    Workspace,
    WorkspaceMembership,
)
from app.services.workspace_state_service import get_workspace_state


@pytest.fixture
def engine() -> Iterator[Engine]:
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        json_serializer=json.dumps,
        json_deserializer=json.loads,
    )
    SQLModel.metadata.create_all(eng)
    yield eng


def _seed_workspace(session: Session, member_count: int) -> str:
    workspace_id = f"workspace-{member_count}"
    for i in range(member_count):
        uid = f"user-{member_count}-{i}"
        user = User(id=uid, display_name=f"User {i}")
        session.add(user)
    session.flush()

    ws = Workspace(
        id=workspace_id,
        name=f"Test Workspace ({member_count}m)",
        owner_user_id=f"user-{member_count}-0",
    )
    session.add(ws)
    session.flush()

    for i in range(member_count):
        uid = f"user-{member_count}-{i}"
        membership = WorkspaceMembership(workspace_id=workspace_id, user_id=uid)
        session.add(membership)
        profile = MemberProfile(
            user_id=uid,
            workspace_id=workspace_id,
            skills="[]",
            available_hours_per_week=10.0,
        )
        session.add(profile)

    session.commit()
    return workspace_id


def _count_queries_for_members(engine: Engine, member_count: int) -> int:
    with Session(engine) as session:
        ws_id = _seed_workspace(session, member_count)

    counter = {"count": 0}

    def _count_selects(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            counter["count"] += 1

    event.listen(engine, "before_cursor_execute", _count_selects)
    with Session(engine) as session:
        state = get_workspace_state(session, ws_id)
        assert state is not None
        assert len(state.members) == member_count
    event.remove(engine, "before_cursor_execute", _count_selects)

    return counter["count"]


class TestWorkspaceStateNPlusOne:
    def test_query_count_growth_is_bounded(self, engine: Engine):
        q5 = _count_queries_for_members(engine, 5)
        q10 = _count_queries_for_members(engine, 10)

        extra_queries = q10 - q5
        assert extra_queries <= 3, (
            f"Adding 5 members added {extra_queries} SELECT queries "
            f"(q5={q5}, q10={q10}). Expected <= 3 with batched member loading."
        )

    def test_query_count_reasonable_absolute(self, engine: Engine):
        q = _count_queries_for_members(engine, 20)

        assert q <= 20, (
            f"20-member workspace used {q} SELECTs, expected <= 20 "
            f"with batched member loading."
        )
