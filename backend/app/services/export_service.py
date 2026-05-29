from sqlmodel import Session, select

from app.models import (
    ActionCard,
    AgentEvent,
    AssignmentProposal,
    Project,
    ProjectResource,
    Risk,
    Stage,
    Task,
    User,
    Workspace,
)
from app.models.enums import AgentEventStatus, AgentEventType


def generate_review_summary(session: Session, project_id: str) -> str:
    project = session.get(Project, project_id)
    if project is None:
        raise ValueError("Project not found")
    workspace = session.get(Workspace, project.workspace_id)
    if workspace is None:
        raise ValueError("Workspace not found")

    stages = list(
        session.exec(select(Stage).where(Stage.project_id == project_id).order_by(Stage.order_index)).all()
    )
    tasks = list(session.exec(select(Task).where(Task.project_id == project_id)).all())
    resources = list(session.exec(select(ProjectResource).where(ProjectResource.project_id == project_id)).all())
    proposals = list(
        session.exec(select(AssignmentProposal).where(AssignmentProposal.project_id == project_id)).all()
    )
    action_cards = list(session.exec(select(ActionCard).where(ActionCard.project_id == project_id)).all())
    risks = list(session.exec(select(Risk).where(Risk.project_id == project_id)).all())

    user_names = {
        user.id: user.display_name
        for user in session.exec(select(User)).all()
    }

    lines: list[str] = [
        "# ProjectFlow Review Summary",
        "",
        f"## {project.name}",
        "",
        f"- Workspace: {workspace.name}",
        f"- Status: {project.status.value}",
        f"- Deadline: {project.deadline.isoformat()}",
        f"- Deliverables: {project.deliverables}",
        "",
        "## Project Direction",
        "",
        project.idea,
        "",
    ]

    if resources:
        lines.extend(["## Resources", ""])
        for resource in resources:
            detail = resource.content_text or resource.url or resource.file_name or "No detail"
            lines.append(f"- {resource.title}: {detail}")
        lines.append("")

    lines.extend(["## Stage Plan", ""])
    for stage in stages:
        lines.append(
            f"- {stage.name} ({stage.status.value}, {stage.start_date.isoformat()} to {stage.end_date.isoformat()}): {stage.goal}"
        )
    lines.append("")

    lines.extend(["## Assigned Tasks", ""])
    for task in tasks:
        owner = user_names.get(task.owner_user_id or "", "Unassigned")
        backup = user_names.get(task.backup_owner_user_id or "", "No backup")
        lines.append(
            f"- [{task.priority.value}] {task.title} - {task.status.value}; owner: {owner}; backup: {backup}; due: {task.due_date.isoformat()}"
        )
        if task.assignment_reason:
            lines.append(f"  - Reason: {task.assignment_reason}")
    if not tasks:
        lines.append("- No tasks yet.")
    lines.append("")

    lines.extend(["## Assignment Proposals", ""])
    for proposal in proposals:
        task = next((item for item in tasks if item.id == proposal.task_id), None)
        owner = user_names.get(proposal.recommended_owner_user_id, proposal.recommended_owner_user_id)
        lines.append(f"- {task.title if task else proposal.task_id}: {owner} ({proposal.status.value})")
        lines.append(f"  - Reason: {proposal.reason}")
    if not proposals:
        lines.append("- No assignment proposals yet.")
    lines.append("")

    lines.extend(["## Risks", ""])
    open_risks = [risk for risk in risks if risk.status.value == "open"]
    for risk in open_risks:
        lines.append(f"- {risk.severity.value.upper()} {risk.title}: {risk.recommendation}")
    if not open_risks:
        lines.append("- No open risks.")
    lines.append("")

    lines.extend(["## Next Actions", ""])
    active_cards = [card for card in action_cards if card.status.value == "active"]
    for card in active_cards:
        assignee = user_names.get(card.user_id or "", "Team")
        lines.append(f"- {card.title} ({assignee}): {card.content}")
        lines.append(f"  - Reason: {card.reason}")
    if not active_cards:
        lines.append("- No active action cards.")
    lines.append("")

    markdown = "\n".join(lines).strip() + "\n"
    event = AgentEvent(
        project_id=project.id,
        workspace_id=project.workspace_id,
        event_type=AgentEventType.export,
        status=AgentEventStatus.success,
        input_snapshot={"project_id": project.id},
        output_snapshot={
            "stages": len(stages),
            "tasks": len(tasks),
            "risks": len(open_risks),
            "action_cards": len(active_cards),
        },
        reasoning_summary="Generated a review summary from persisted project state.",
        user_confirmed=True,
    )
    session.add(event)
    session.commit()
    return markdown
