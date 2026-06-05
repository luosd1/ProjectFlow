"""Tests for the aggregated project state endpoint."""

from fastapi.testclient import TestClient


def test_project_state_endpoint_returns_frontend_payload(client: TestClient):
    client.post("/api/seed/demo")

    response = client.get("/api/projects/demo-project-001/state")

    assert response.status_code == 200
    state = response.json()
    assert set(state) == {
        "workspace",
        "project",
        "resources",
        "members",
        "memberships",
        "member_profiles",
        "projects",
        "stages",
        "tasks",
        "agent_proposals",
        "assignment_proposals",
        "assignment_responses",
        "assignment_negotiations",
        "checkins",
        "risks",
        "action_cards",
        "timeline",
    }
    assert state["workspace"]["id"] == "demo-workspace-001"
    assert state["project"]["id"] == "demo-project-001"
    assert len(state["members"]) == 6
    assert len(state["memberships"]) == 6
    assert len(state["member_profiles"]) == 6
    assert len(state["projects"]) == 1
    assert len(state["stages"]) == 4
    assert len(state["tasks"]) == 10
    assert state["tasks"][0]["dependency_ids"] == []
    assert isinstance(state["risks"][0]["evidence"], list)
    assert state["timeline"]


def test_project_state_endpoint_404_for_missing_project(client: TestClient):
    response = client.get("/api/projects/missing-project/state")

    assert response.status_code == 404
