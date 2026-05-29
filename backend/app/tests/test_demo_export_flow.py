from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.core.database import get_session
from app.main import app


def _client() -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    def override_get_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    return TestClient(app)


def _create_review_fixture(client: TestClient):
    owner = client.post("/api/users", json={"display_name": "Lin"}).json()
    member = client.post("/api/users", json={"display_name": "Mia"}).json()
    workspace = client.post(
        "/api/workspaces",
        json={"name": "ProjectFlow Demo Team"},
        params={"owner_user_id": owner["id"]},
    ).json()
    client.post(
        f"/api/workspaces/{workspace['id']}/members",
        json={"user_id": member["id"], "role": "member"},
    )
    client.post(
        "/api/member-profiles",
        json={
            "user_id": member["id"],
            "workspace_id": workspace["id"],
            "skills": [{"name": "frontend", "level": 4}],
            "available_hours_per_week": 10,
            "role_preference": "frontend",
            "interests": "dashboards",
            "constraints": "busy before Friday",
        },
    )
    project = client.post(
        "/api/projects",
        json={
            "workspace_id": workspace["id"],
            "name": "AI Study Planner",
            "idea": "Help students coordinate a course project demo.",
            "deadline": "2026-06-07",
            "deliverables": "Demo and review summary",
            "created_by": owner["id"],
        },
    ).json()
    client.post(
        "/api/resources",
        json={
            "project_id": project["id"],
            "type": "text_note",
            "title": "Review target",
            "content_text": "Show active push, risk, and replan.",
        },
    )
    stage = client.post(
        "/api/stages",
        json={
            "project_id": project["id"],
            "name": "Prototype",
            "goal": "Show the full agent loop.",
            "start_date": "2026-05-29",
            "end_date": "2026-06-01",
            "deliverable": "Clickable dashboard",
            "done_criteria": ["Export works"],
            "status": "active",
        },
    ).json()
    task = client.post(
        "/api/tasks",
        json={
            "project_id": project["id"],
            "stage_id": stage["id"],
            "title": "Build export panel",
            "description": "Generate a review-ready summary.",
            "priority": "P0",
            "due_date": "2026-05-31",
            "estimated_hours": 3,
        },
    ).json()
    client.post(
        "/api/action-cards",
        json={
            "project_id": project["id"],
            "stage_id": stage["id"],
            "task_id": task["id"],
            "user_id": owner["id"],
            "type": "team_next_step",
            "title": "Confirm review path",
            "content": "Walk through the dashboard before export.",
            "reason": "The demo needs a reliable final step.",
            "created_by_agent": True,
        },
    )
    client.post(
        "/api/risks",
        json={
            "project_id": project["id"],
            "stage_id": stage["id"],
            "task_id": task["id"],
            "type": "deadline",
            "severity": "high",
            "title": "Review date is close",
            "description": "The project has less than ten days before demo.",
            "evidence": ["deadline: 2026-06-07"],
            "recommendation": "Keep only P0 demo work.",
            "created_by_agent": True,
        },
    )
    return project


def test_review_summary_export_returns_markdown_and_logs_timeline_event():
    with _client() as client:
        project = _create_review_fixture(client)

        response = client.post(f"/api/projects/{project['id']}/export/review-summary")

        assert response.status_code == 200
        markdown = response.json()["markdown"]
        assert "# ProjectFlow 评审摘要" in markdown
        assert "AI Study Planner" in markdown
        assert "Build export panel" in markdown
        assert "Review date is close" in markdown
        assert "Confirm review path" in markdown

        timeline = client.get(f"/api/projects/{project['id']}/timeline")
        assert timeline.status_code == 200
        assert any(event["event_type"] == "export" for event in timeline.json())


def test_demo_reset_creates_known_state_with_execution_loop_data():
    with _client() as client:
        response = client.post("/api/demo/reset")

        assert response.status_code == 200
        payload = response.json()
        project_id = payload["project_id"]
        workspace_id = payload["workspace_id"]

        assert client.get(f"/api/workspaces/{workspace_id}/state").status_code == 200
        assert len(client.get("/api/users").json()) >= 5
        assert len(client.get(f"/api/projects/{project_id}/stages").json()) >= 2
        assert len(client.get(f"/api/projects/{project_id}/tasks").json()) >= 5
        assert len(client.get(f"/api/projects/{project_id}/assignment-proposals").json()) >= 1
        assert len(client.get(f"/api/projects/{project_id}/action-cards").json()) >= 1
        assert len(client.get(f"/api/projects/{project_id}/risks").json()) >= 1
        assert len(client.get(f"/api/projects/{project_id}/checkin-cycles").json()) >= 1
        assert len(client.get(f"/api/projects/{project_id}/timeline").json()) >= 1
