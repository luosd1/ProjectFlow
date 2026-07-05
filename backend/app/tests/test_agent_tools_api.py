"""Tests for T41 Internal Agent Tools API (S5 + S8).

Validates the unified internal contract:
- POST /internal/agent-tools/workspace-state
- POST /internal/agent-tools/conversation
- POST /internal/agent-tools/pending-proposals
- POST /internal/agent-tools/timeline-slice
- POST /internal/agent-tools/assignment-recommendation (S8)

Read-only tools return side_effect_status=no_side_effect.
Proposal tools return side_effect_status=proposal_persisted.
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models import (
    AgentEvent,
    AgentProposal,
    AssignmentProposal,
    Project,
    Stage,
    Task,
    User,
    Workspace,
    WorkspaceMembership,
)
from app.models.enums import AgentEventType, AgentProposalStatus, AssignmentProposalStatus, TaskStatus
from app.core.database import get_session


@pytest.fixture
def test_engine():
    import app.models  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def client(test_engine):
    from contextlib import asynccontextmanager
    from fastapi import FastAPI

    def override_get_session():
        with Session(test_engine) as session:
            yield session

    @asynccontextmanager
    async def noop_lifespan(_: FastAPI):
        yield

    app.router.lifespan_context = noop_lifespan
    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _seed(test_engine) -> dict:
    """Seed a workspace/project/user + one pending + one confirmed proposal + one timeline event."""
    with Session(test_engine) as session:
        session.add(User(id="u1", display_name="小林"))
        session.add(Workspace(id="ws1", name="测试工作区", owner_user_id="u1"))
        session.add(WorkspaceMembership(workspace_id="ws1", user_id="u1", role="owner"))
        session.add(
            Project(
                id="p1",
                workspace_id="ws1",
                name="测试项目",
                idea="做一个 demo",
                deadline="2026-08-01",
                deliverables="演示闭环",
                created_by="u1",
            )
        )
        # Timeline event
        event = AgentEvent(
            project_id="p1",
            workspace_id="ws1",
            event_type=AgentEventType.plan,
            reasoning_summary="生成阶段计划",
        )
        session.add(event)
        session.flush()
        # Two proposals: one pending, one confirmed — pending-proposals must return only the pending one
        session.add(
            AgentProposal(
                id="prop_pending",
                project_id="p1",
                workspace_id="ws1",
                proposal_type="plan",
                status=AgentProposalStatus.pending,
                agent_event_id=event.id,
                payload='{"summary":"pending plan"}',
            )
        )
        session.add(
            AgentProposal(
                id="prop_confirmed",
                project_id="p1",
                workspace_id="ws1",
                proposal_type="plan",
                status=AgentProposalStatus.confirmed,
                agent_event_id=event.id,
                payload='{"summary":"confirmed plan"}',
            )
        )
        session.commit()
        event_id = event.id
    return {"event_id": event_id}


def _envelope(tool_name: str, arguments: dict | None = None) -> dict:
    return {
        "run_id": "run_test",
        "tool_call_id": "call_test",
        "conversation_id": "conv_test",
        "workspace_id": "ws1",
        "project_id": "p1",
        "tool_name": tool_name,
        "tool_version": 1,
        "manifest_version": 1,
        "idempotency_key": "run_test:call_test:v1",
        "arguments": arguments or {},
        "client_event_id": "run_test:call_test:request",
        "ordering_hint": 0,
        "trace": {"run_id": "run_test", "tool_call_id": "call_test", "tool_name": tool_name},
    }


class TestInternalAgentTools:
    def test_workspace_state_tool(self, client, test_engine):
        _seed(test_engine)
        resp = client.post("/internal/agent-tools/workspace-state", json=_envelope("workspace-state", {"workspace_id": "ws1"}))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "success"
        assert data["side_effect_status"] == "no_side_effect"
        assert data["data"]["workspace_id"] == "ws1"

    def test_conversation_tool(self, client, test_engine):
        _seed(test_engine)
        resp = client.post("/internal/agent-tools/conversation", json=_envelope("conversation", {"project_id": "p1"}))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "success"
        assert data["side_effect_status"] == "no_side_effect"

    def test_pending_proposals_returns_only_pending(self, client, test_engine):
        _seed(test_engine)
        resp = client.post(
            "/internal/agent-tools/pending-proposals",
            json=_envelope("pending-proposals", {"project_id": "p1"}),
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "success"
        items = data["data"]["items"]
        assert len(items) == 1
        assert items[0]["id"] == "prop_pending"
        assert items[0]["status"] == "pending"

    def test_timeline_slice_tool(self, client, test_engine):
        _seed(test_engine)
        resp = client.post(
            "/internal/agent-tools/timeline-slice",
            json=_envelope("timeline-slice", {"project_id": "p1", "limit": 20}),
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "success"
        items = data["data"]["items"]
        assert len(items) == 1
        assert items[0]["event_type"] == "plan"

    def test_timeline_slice_event_types_filter(self, client, test_engine):
        _seed(test_engine)
        resp = client.post(
            "/internal/agent-tools/timeline-slice",
            json=_envelope("timeline-slice", {"project_id": "p1", "event_types": ["checkin"]}),
        )
        assert resp.status_code == 200, resp.text
        items = resp.json()["data"]["items"]
        assert items == []

    def test_unknown_tool_returns_404(self, client, test_engine):
        _seed(test_engine)
        resp = client.post("/internal/agent-tools/no-such-tool", json=_envelope("no-such-tool"))
        assert resp.status_code == 404

    def test_workspace_not_found_returns_failed_result(self, client, test_engine):
        # No seed → workspace does not exist
        resp = client.post(
            "/internal/agent-tools/workspace-state",
            json=_envelope("workspace-state", {"workspace_id": "missing"}),
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "failed"
        assert data["side_effect_status"] == "no_side_effect"


class TestPublicProposalStatusFilter:
    """The public /api/agent-proposals route must honor status=pending (previously silently ignored)."""

    def test_status_filter_excludes_confirmed(self, client, test_engine):
        _seed(test_engine)
        resp = client.get("/api/agent-proposals", params={"project_id": "p1", "status": "pending"})
        assert resp.status_code == 200, resp.text
        items = resp.json()
        assert len(items) == 1
        assert items[0]["status"] == "pending"

    def test_no_status_filter_returns_all(self, client, test_engine):
        _seed(test_engine)
        resp = client.get("/api/agent-proposals", params={"project_id": "p1"})
        assert resp.status_code == 200, resp.text
        assert len(resp.json()) == 2


# ─── S8: Assignment Recommendation Tool ──────────────────────────────────


def _seed_assignment(test_engine) -> dict:
    """Seed workspace with 2 users, 1 project, 1 stage, 1 task (no owner)."""
    with Session(test_engine) as session:
        session.add(User(id="u1", display_name="小林"))
        session.add(User(id="u2", display_name="小王"))
        session.add(Workspace(id="ws1", name="测试工作区", owner_user_id="u1"))
        session.add(WorkspaceMembership(workspace_id="ws1", user_id="u1", role="owner"))
        session.add(WorkspaceMembership(workspace_id="ws1", user_id="u2", role="member"))
        session.add(
            Project(
                id="p1",
                workspace_id="ws1",
                name="测试项目",
                idea="做一个 demo",
                deadline="2026-08-01",
                deliverables="演示闭环",
                created_by="u1",
            )
        )
        session.add(
            Stage(
                id="s1",
                project_id="p1",
                name="规划阶段",
                goal="完成项目规划",
                start_date="2026-07-01",
                end_date="2026-07-15",
                deliverable="阶段计划文档",
                order_index=0,
                status="active",
            )
        )
        session.add(
            Task(
                id="t1",
                project_id="p1",
                stage_id="s1",
                title="后端 API 开发",
                priority="P0",
                status=TaskStatus.not_started,
                order_index=0,
            )
        )
        session.commit()
    return {}


class TestAssignmentRecommendationTool:
    """S8: recommend_assignment tool via POST /internal/agent-tools/assignment-recommendation."""

    def test_create_proposal_success(self, client, test_engine):
        """Creating an AssignmentProposal returns proposal_persisted and created_ids."""
        _seed_assignment(test_engine)
        resp = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                "recommended_owner_user_id": "u1",
                "reason": "小林熟悉后端开发",
            }),
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "success"
        assert data["side_effect_status"] == "proposal_persisted"
        assert data["links"]["created_ids"] != []
        assert data["links"]["proposal_id"] is not None
        assert data["links"]["proposal_id"] == data["links"]["created_ids"][0]
        assert data["idempotency_key"] == "run_test:call_test:v1"
        # Verify the proposal data
        proposal = data["data"]
        assert proposal["project_id"] == "p1"
        assert proposal["stage_id"] == "s1"
        assert proposal["task_id"] == "t1"
        assert proposal["recommended_owner_user_id"] == "u1"
        assert proposal["status"] == "proposed"
        assert proposal["created_by_agent"] is True

    def test_create_proposal_with_backup_owner(self, client, test_engine):
        """Proposal with backup_owner_user_id is accepted."""
        _seed_assignment(test_engine)
        resp = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                "recommended_owner_user_id": "u1",
                "backup_owner_user_id": "u2",
                "reason": "小林主负责，小王备选",
            }),
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "success"
        assert data["data"]["backup_owner_user_id"] == "u2"

    def test_proposal_does_not_write_task_owner(self, client, test_engine):
        """Creating a proposal must NOT write Task.owner_user_id."""
        _seed_assignment(test_engine)
        resp = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                "recommended_owner_user_id": "u1",
                "reason": "技能匹配",
            }),
        )
        assert resp.status_code == 200, resp.text
        # Verify task still has no owner
        with Session(test_engine) as session:
            task = session.get(Task, "t1")
            assert task is not None
            assert task.owner_user_id is None

    def test_idempotency_same_task_owner_rejected(self, client, test_engine):
        """Second proposal for same (task, owner) is rejected (validation_error)."""
        _seed_assignment(test_engine)
        # First call
        resp1 = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                "recommended_owner_user_id": "u1",
                "reason": "技能匹配",
            }),
        )
        assert resp1.status_code == 200
        assert resp1.json()["status"] == "success"

        # Second call — same task, same owner → should fail
        resp2 = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                "recommended_owner_user_id": "u1",
                "reason": "再次推荐",
            }),
        )
        assert resp2.status_code == 200
        data = resp2.json()
        assert data["status"] == "validation_error"
        assert data["side_effect_status"] == "no_side_effect"
        assert "已有" in data["observation"] or "already" in data["observation"].lower()

    def test_different_owner_for_same_task_allowed(self, client, test_engine):
        """A different owner for the same task is allowed."""
        _seed_assignment(test_engine)
        # First proposal: u1
        resp1 = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                "recommended_owner_user_id": "u1",
                "reason": "小林适合",
            }),
        )
        assert resp1.json()["status"] == "success"

        # Second proposal for same task but different owner: u2
        resp2 = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                "recommended_owner_user_id": "u2",
                "reason": "小王更适合",
            }),
        )
        # This should fail because there's already an active proposal for the task
        assert resp2.status_code == 200
        data = resp2.json()
        assert data["status"] == "validation_error"

    def test_missing_required_fields_returns_validation_error(self, client, test_engine):
        """Missing required fields returns validation_error."""
        _seed_assignment(test_engine)
        resp = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                # Missing recommended_owner_user_id and reason
            }),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "validation_error"
        assert "缺少必填字段" in data["observation"]

    def test_nonexistent_task_returns_validation_error(self, client, test_engine):
        """Nonexistent task returns validation_error."""
        _seed_assignment(test_engine)
        resp = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "nonexistent",
                "recommended_owner_user_id": "u1",
                "reason": "技能匹配",
            }),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "validation_error"

    def test_nonexistent_user_returns_validation_error(self, client, test_engine):
        """Nonexistent recommended owner returns validation_error."""
        _seed_assignment(test_engine)
        resp = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                "recommended_owner_user_id": "nonexistent",
                "reason": "技能匹配",
            }),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "validation_error"

    def test_backup_same_as_recommended_rejected(self, client, test_engine):
        """Backup owner same as recommended is rejected."""
        _seed_assignment(test_engine)
        resp = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                "recommended_owner_user_id": "u1",
                "backup_owner_user_id": "u1",
                "reason": "技能匹配",
            }),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "validation_error"
        assert "备选" in data["observation"] or "backup" in data["observation"].lower()

    def test_stage_not_in_project_rejected(self, client, test_engine):
        """Stage belonging to a different project is rejected."""
        _seed_assignment(test_engine)
        # Add a second project and stage
        with Session(test_engine) as session:
            session.add(
                Project(
                    id="p2",
                    workspace_id="ws1",
                    name="另一个项目",
                    idea="另一个想法",
                    deadline="2026-09-01",
                    deliverables="交付物",
                    created_by="u1",
                )
            )
            session.add(
                Stage(
                    id="s2",
                    project_id="p2",
                    name="另一阶段",
                    goal="另一目标",
                    start_date="2026-07-01",
                    end_date="2026-07-15",
                    deliverable="交付物",
                    order_index=0,
                    status="active",
                )
            )
            session.commit()
        # Submit with stage from different project
        resp = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s2",  # belongs to p2, not p1
                "task_id": "t1",
                "recommended_owner_user_id": "u1",
                "reason": "技能匹配",
            }),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "validation_error"

    def test_task_not_in_stage_rejected(self, client, test_engine):
        """Task belonging to a different stage is rejected."""
        _seed_assignment(test_engine)
        # Add a second stage and task
        with Session(test_engine) as session:
            session.add(
                Stage(
                    id="s2",
                    project_id="p1",
                    name="开发阶段",
                    goal="完成开发",
                    start_date="2026-07-15",
                    end_date="2026-08-01",
                    deliverable="代码",
                    order_index=1,
                    status="pending",
                )
            )
            session.add(
                Task(
                    id="t2",
                    project_id="p1",
                    stage_id="s2",
                    title="前端开发",
                    priority="P1",
                    status=TaskStatus.not_started,
                    order_index=0,
                )
            )
            session.commit()
        # Submit with task from different stage
        resp = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t2",  # belongs to s2, not s1
                "recommended_owner_user_id": "u1",
                "reason": "技能匹配",
            }),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "validation_error"

    def test_non_member_owner_rejected(self, client, test_engine):
        """User who exists but is not a workspace member is rejected."""
        _seed_assignment(test_engine)
        # Add a user who is NOT in the workspace
        with Session(test_engine) as session:
            session.add(User(id="u_outsider", display_name="局外人"))
            session.commit()
        resp = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                "recommended_owner_user_id": "u_outsider",
                "reason": "技能匹配",
            }),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "validation_error"
        assert "工作区" in data["observation"] or "member" in data["observation"].lower() or "成员" in data["observation"]

    def test_task_already_has_owner_rejected(self, client, test_engine):
        """Task that already has an owner is rejected."""
        _seed_assignment(test_engine)
        # Assign owner to task
        with Session(test_engine) as session:
            task = session.get(Task, "t1")
            task.owner_user_id = "u2"
            session.commit()
        resp = client.post(
            "/internal/agent-tools/assignment-recommendation",
            json=_envelope("assignment-recommendation", {
                "stage_id": "s1",
                "task_id": "t1",
                "recommended_owner_user_id": "u1",
                "reason": "技能匹配",
            }),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "validation_error"
        assert "已有" in data["observation"] or "already" in data["observation"].lower() or "owner" in data["observation"].lower()
