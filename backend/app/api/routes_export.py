"""Review summary export endpoint."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.project import Project
from app.models.stage import Stage
from app.models.task import Task
from app.models.risk import Risk
from app.models.action_card import ActionCard
from app.models.timeline import AgentEvent
from app.models.user import User
from app.models.workspace import Workspace
from app.models.member_profile import MemberProfile
from app.models.assignment import AssignmentProposal
from app.models.checkin import CheckInCycle, CheckInResponse

router = APIRouter(tags=["export"])


class ExportResponse(BaseModel):
    markdown: str


@router.post("/projects/{project_id}/export/review-summary", response_model=ExportResponse)
def export_review_summary(project_id: str, session: Session = Depends(get_session)):
    """Generate a review-ready Markdown summary of the project.

    Summarizes product positioning, current state, risks, replanning,
    and next actions.
    """
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    workspace = session.get(Workspace, project.workspace_id)
    stages = session.exec(select(Stage).where(Stage.project_id == project_id).order_by(Stage.order_index)).all()
    tasks = session.exec(select(Task).where(Task.project_id == project_id)).all()
    risks = session.exec(select(Risk).where(Risk.project_id == project_id)).all()
    action_cards = session.exec(select(ActionCard).where(ActionCard.project_id == project_id)).all()
    timeline = session.exec(select(AgentEvent).where(AgentEvent.project_id == project_id).order_by(AgentEvent.created_at)).all()
    proposals = session.exec(select(AssignmentProposal).where(AssignmentProposal.project_id == project_id)).all()
    checkin_cycles = session.exec(select(CheckInCycle).where(CheckInCycle.project_id == project_id)).all()
    checkin_responses = session.exec(select(CheckInResponse).where(CheckInResponse.project_id == project_id)).all()

    # Build member map
    member_ids = set()
    for t in tasks:
        if t.owner_user_id:
            member_ids.add(t.owner_user_id)
    for p in proposals:
        member_ids.add(p.recommended_owner_user_id)
    members = session.exec(select(User).where(User.id.in_(member_ids))).all() if member_ids else []
    member_map = {m.id: m.display_name for m in members}

    # Build profile map
    profiles = session.exec(select(MemberProfile).where(MemberProfile.workspace_id == project.workspace_id)).all()
    profile_map = {}
    for p in profiles:
        skills = json.loads(p.skills) if p.skills else []
        profile_map[p.user_id] = {
            "role_preference": p.role_preference,
            "available_hours": p.available_hours_per_week,
            "skills": ", ".join(f"{s['name']}({s['level']})" for s in skills),
        }

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # -- Build Markdown --
    lines: list[str] = []

    lines.append(f"# ProjectFlow 评审摘要")
    lines.append("")
    lines.append(f"生成时间：{now_str}")
    lines.append("")

    # Product positioning
    lines.append("## 产品定位")
    lines.append("")
    if project.direction_card:
        dc = json.loads(project.direction_card)
        lines.append(f"**问题**：{dc.get('problem', '')}")
        lines.append(f"**目标用户**：{dc.get('target_users', '')}")
        lines.append(f"**核心价值**：{dc.get('core_value', '')}")
        lines.append("")
        deliverables = dc.get("deliverables", [])
        if deliverables:
            lines.append("**交付物**：")
            for d in deliverables:
                lines.append(f"- {d}")
            lines.append("")
        constraints = dc.get("constraints", [])
        if constraints:
            lines.append("**约束**：")
            for c in constraints:
                lines.append(f"- {c}")
            lines.append("")
    else:
        lines.append(f"项目想法：{project.idea}")
        lines.append("")

    # Current state
    lines.append("## 当前状态")
    lines.append("")
    lines.append(f"- **项目**：{project.name}（{project.status}）")
    lines.append(f"- **截止日期**：{project.deadline}")
    lines.append(f"- **交付物**：{project.deliverables}")
    active_stage = next((s for s in stages if s.status == "active"), None)
    if active_stage:
        lines.append(f"- **当前阶段**：{active_stage.name}（{active_stage.start_date} ~ {active_stage.end_date}）")
    lines.append("")

    # Stages
    lines.append("## 阶段概览")
    lines.append("")
    lines.append("| # | 阶段 | 状态 | 时间 |")
    lines.append("|---|------|------|------|")
    for s in stages:
        lines.append(f"| {s.order_index + 1} | {s.name} | {s.status} | {s.start_date} ~ {s.end_date} |")
    lines.append("")

    # Tasks
    lines.append("## 任务状态")
    lines.append("")
    p0_tasks = [t for t in tasks if t.priority == "P0"]
    p1_tasks = [t for t in tasks if t.priority == "P1"]
    p2_tasks = [t for t in tasks if t.priority == "P2"]

    for priority, group in [("P0", p0_tasks), ("P1", p1_tasks), ("P2", p2_tasks)]:
        if not group:
            continue
        lines.append(f"### {priority} 任务")
        lines.append("")
        lines.append("| 任务 | 负责人 | 状态 | 截止 | 预估 |")
        lines.append("|------|--------|------|------|------|")
        for t in group:
            owner = member_map.get(t.owner_user_id, "未分配") if t.owner_user_id else "未分配"
            lines.append(f"| {t.title} | {owner} | {t.status} | {t.due_date} | {t.estimated_hours}h |")
        lines.append("")

    # Team
    lines.append("## 团队")
    lines.append("")
    lines.append("| 成员 | 意向 | 可用时间/周 | 技能 |")
    lines.append("|------|------|-------------|------|")
    for uid, name in member_map.items():
        p = profile_map.get(uid, {})
        lines.append(f"| {name} | {p.get('role_preference', '-')} | {p.get('available_hours', '-')}h | {p.get('skills', '-')} |")
    lines.append("")

    # Risks
    lines.append("## 风险")
    lines.append("")
    if risks:
        lines.append("| 严重度 | 类型 | 标题 | 状态 | 建议 |")
        lines.append("|--------|------|------|------|------|")
        for r in risks:
            lines.append(f"| {r.severity} | {r.type} | {r.title} | {r.status} | {r.recommendation[:40]}... |")
        lines.append("")
        lines.append("### 风险详情")
        lines.append("")
        for r in risks:
            evidence = json.loads(r.evidence) if r.evidence else []
            lines.append(f"**{r.title}**（{r.severity}/{r.type}）")
            lines.append(f"- 描述：{r.description}")
            lines.append(f"- 证据：")
            for e in evidence:
                lines.append(f"  - {e}")
            lines.append(f"- 建议：{r.recommendation}")
            lines.append("")
    else:
        lines.append("当前无风险。")
        lines.append("")

    # Action Cards
    active_cards = [ac for ac in action_cards if ac.status == "active"]
    if active_cards:
        lines.append("## 下一步行动")
        lines.append("")
        for ac in active_cards:
            target = member_map.get(ac.user_id, "团队") if ac.user_id else "团队"
            lines.append(f"- **[{target}]** {ac.title} — {ac.reason}")
        lines.append("")

    # Check-ins
    if checkin_responses:
        lines.append("## Check-in 摘要")
        lines.append("")
        for cr in checkin_responses:
            name = member_map.get(cr.user_id, "未知")
            blocker_str = f" ⚠️ **Blocker**: {cr.blocker}" if cr.blocker else ""
            lines.append(f"- **{name}**：{cr.what_done}{blocker_str}")
        lines.append("")

    # Timeline
    if timeline:
        lines.append("## Agent 决策时间线")
        lines.append("")
        for ae in timeline:
            confirmed = "✅" if ae.user_confirmed else "⏳"
            lines.append(f"- {confirmed} **{ae.event_type}**：{ae.reasoning_summary}")
        lines.append("")

    lines.append("---")
    lines.append(f"*由 ProjectFlow Agent 生成于 {now_str}*")

    markdown = "\n".join(lines)
    return ExportResponse(markdown=markdown)
