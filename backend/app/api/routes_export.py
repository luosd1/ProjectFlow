"""Review summary export endpoint."""

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.action_card import ActionCard
from app.models.assignment import AssignmentProposal
from app.models.checkin import CheckInCycle, CheckInResponse
from app.models.enums import AgentEventStatus, AgentEventType
from app.models.member_profile import MemberProfile
from app.models.project import Project
from app.models.risk import Risk
from app.models.stage import Stage
from app.models.task import Task
from app.models.timeline import AgentEvent
from app.models.user import User
from app.models.workspace import Workspace
from app.services.project_service import normalize_direction_card

router = APIRouter(tags=["export"])


class ExportResponse(BaseModel):
    markdown: str


def _json_value(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    if not isinstance(value, str) or not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


@router.post("/projects/{project_id}/export/review-summary", response_model=ExportResponse)
def export_review_summary(project_id: str, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    workspace = session.get(Workspace, project.workspace_id)
    stages = session.exec(
        select(Stage).where(Stage.project_id == project_id).order_by(Stage.order_index)
    ).all()
    tasks = session.exec(select(Task).where(Task.project_id == project_id)).all()
    risks = session.exec(select(Risk).where(Risk.project_id == project_id)).all()
    action_cards = session.exec(
        select(ActionCard).where(ActionCard.project_id == project_id)
    ).all()
    timeline = session.exec(
        select(AgentEvent)
        .where(AgentEvent.project_id == project_id)
        .order_by(AgentEvent.created_at)
    ).all()
    proposals = session.exec(
        select(AssignmentProposal).where(AssignmentProposal.project_id == project_id)
    ).all()
    checkin_cycles = session.exec(
        select(CheckInCycle).where(CheckInCycle.project_id == project_id)
    ).all()
    checkin_responses = session.exec(
        select(CheckInResponse).where(CheckInResponse.project_id == project_id)
    ).all()

    member_ids = {profile.user_id for profile in session.exec(
        select(MemberProfile).where(MemberProfile.workspace_id == project.workspace_id)
    ).all()}
    if workspace:
        member_ids.add(workspace.owner_user_id)
    for task in tasks:
        if task.owner_user_id:
            member_ids.add(task.owner_user_id)
        if task.backup_owner_user_id:
            member_ids.add(task.backup_owner_user_id)
    for proposal in proposals:
        member_ids.add(proposal.recommended_owner_user_id)
        if proposal.backup_owner_user_id:
            member_ids.add(proposal.backup_owner_user_id)

    members = session.exec(select(User).where(User.id.in_(member_ids))).all() if member_ids else []
    member_map = {member.id: member.display_name for member in members}

    profiles = session.exec(
        select(MemberProfile).where(MemberProfile.workspace_id == project.workspace_id)
    ).all()
    profile_map = {}
    for profile in profiles:
        skills = _json_value(profile.skills, [])
        profile_map[profile.user_id] = {
            "role_preference": profile.role_preference,
            "available_hours": profile.available_hours_per_week,
            "skills": ", ".join(
                f"{skill.get('name', '-') }({skill.get('level', '-')})"
                for skill in skills
                if isinstance(skill, dict)
            ),
        }

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines: list[str] = [
        "# ProjectFlow 评审摘要",
        "",
        f"生成时间：{now_str}",
        "",
        "## 产品定位",
        "",
    ]

    direction_card = normalize_direction_card(project.direction_card)
    if isinstance(direction_card, dict):
        lines.append(f"**问题**：{direction_card.get('problem', '')}")
        lines.append(f"**目标用户**：{direction_card.get('users', '')}")
        lines.append(f"**核心价值**：{direction_card.get('value', '')}")
        lines.append("")
        deliverables = direction_card.get("deliverables", [])
        if deliverables:
            lines.append("**交付物**：")
            for deliverable in deliverables:
                lines.append(f"- {deliverable}")
            lines.append("")
        boundaries = direction_card.get("boundaries", [])
        if boundaries:
            lines.append("**边界**：")
            for boundary in boundaries:
                lines.append(f"- {boundary}")
            lines.append("")
        initial_risks = direction_card.get("risks", [])
        if initial_risks:
            lines.append("**初始风险**：")
            for initial_risk in initial_risks:
                lines.append(f"- {initial_risk}")
            lines.append("")
    else:
        lines.append(f"项目想法：{project.idea}")
        lines.append("")

    lines.extend(
        [
            "## 当前状态",
            "",
            f"- **项目**：{project.name}（{project.status}）",
            f"- **截止日期**：{project.deadline}",
            f"- **交付物**：{project.deliverables}",
        ]
    )
    active_stage = next((stage for stage in stages if stage.status == "active"), None)
    if active_stage:
        lines.append(
            f"- **当前阶段**：{active_stage.name}（{active_stage.start_date} ~ {active_stage.end_date}）"
        )
    lines.append("")

    lines.extend(["## 阶段概览", "", "| # | 阶段 | 状态 | 时间 |", "|---|------|------|------|"])
    for stage in stages:
        lines.append(
            f"| {stage.order_index + 1} | {stage.name} | {stage.status} | {stage.start_date} ~ {stage.end_date} |"
        )
    lines.append("")

    lines.extend(["## 任务状态", ""])
    for priority in ["P0", "P1", "P2"]:
        group = [task for task in tasks if task.priority == priority]
        if not group:
            continue
        lines.extend(
            [
                f"### {priority} 任务",
                "",
                "| 任务 | 负责人 | 状态 | 截止 | 预估 |",
                "|------|--------|------|------|------|",
            ]
        )
        for task in group:
            owner = member_map.get(task.owner_user_id, "未分配") if task.owner_user_id else "未分配"
            lines.append(
                f"| {task.title} | {owner} | {task.status} | {task.due_date} | {task.estimated_hours}h |"
            )
        lines.append("")

    lines.extend(["## 团队", "", "| 成员 | 意向 | 可用时间/周 | 技能 |", "|------|------|-------------|------|"])
    for user_id, name in member_map.items():
        profile = profile_map.get(user_id, {})
        lines.append(
            f"| {name} | {profile.get('role_preference', '-')} | {profile.get('available_hours', '-')}h | {profile.get('skills', '-')} |"
        )
    lines.append("")

    lines.extend(["## 风险", ""])
    if risks:
        lines.extend(["| 严重度 | 类型 | 标题 | 状态 | 建议 |", "|--------|------|------|------|------|"])
        for risk in risks:
            recommendation = risk.recommendation[:40]
            suffix = "..." if len(risk.recommendation) > 40 else ""
            lines.append(
                f"| {risk.severity} | {risk.type} | {risk.title} | {risk.status} | {recommendation}{suffix} |"
            )
        lines.extend(["", "### 风险详情", ""])
        for risk in risks:
            evidence = _json_value(risk.evidence, [])
            lines.append(f"**{risk.title}**（{risk.severity}/{risk.type}）")
            lines.append(f"- 描述：{risk.description}")
            lines.append("- 证据：")
            for item in evidence:
                lines.append(f"  - {item}")
            lines.append(f"- 建议：{risk.recommendation}")
            lines.append("")
    else:
        lines.extend(["当前无风险。", ""])

    active_cards = [card for card in action_cards if card.status == "active"]
    if active_cards:
        lines.extend(["## 下一步行动", ""])
        for card in active_cards:
            target = member_map.get(card.user_id, "团队") if card.user_id else "团队"
            lines.append(f"- **[{target}]** {card.title} - {card.reason}")
            if card.goal:
                lines.append(f"  - 目标：{card.goal}")
            if card.start_suggestion:
                lines.append(f"  - 如何开始：{card.start_suggestion}")
            if card.completion_standard:
                lines.append(f"  - 完成标准：{card.completion_standard}")
        lines.append("")

    if checkin_cycles or checkin_responses:
        lines.extend(["## Check-in 摘要", ""])
        for response in checkin_responses:
            name = member_map.get(response.user_id, "未知")
            blocker = f" Blocker: {response.blocker}" if response.blocker else ""
            lines.append(f"- **{name}**：{response.what_done}{blocker}")
        lines.append("")

    if timeline:
        lines.extend(["## Agent 决策时间线", ""])
        for event in timeline:
            confirmed = "confirmed" if event.user_confirmed else "pending"
            lines.append(f"- **{event.event_type}** [{confirmed}]：{event.reasoning_summary}")
        lines.append("")

    lines.extend(["---", f"*由 ProjectFlow Agent 生成于 {now_str}*"])
    markdown = "\n".join(lines)

    event = AgentEvent(
        project_id=project.id,
        workspace_id=project.workspace_id,
        event_type=AgentEventType.export,
        status=AgentEventStatus.success,
        input_snapshot=json.dumps({"project_id": project.id}, ensure_ascii=False),
        output_snapshot=json.dumps({"markdown_length": len(markdown)}, ensure_ascii=False),
        reasoning_summary="Generated review summary export for demo handoff.",
        user_confirmed=False,
    )
    session.add(event)
    session.commit()

    return ExportResponse(markdown=markdown)
