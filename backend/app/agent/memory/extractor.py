"""V1 Deterministic MemoryExtractor — 不调用 LLM。

读取 schema 校验后的 Memory Source Event payload 与关联实体展示字段，
通过固定规则和中文模板生成 ProjectMemory candidate。

关键约束：
- 所有用户可见文本使用 display_name/title/中文占位词，禁止 raw ID
- 不调用 LLM
- 同一 source event + 同一 memory_type 最多输出 1 条 candidate
- 多个 boundaries 聚合为 1 条 boundary
"""

from __future__ import annotations

import json
import hashlib
from dataclasses import dataclass, field
from datetime import datetime

from sqlmodel import Session

from app.agent.memory.display_resolver import resolve_project_name
from app.agent.output_schemas import DirectionCardOutput
from app.models import AgentProposal, Project


EXTRACTOR_VERSION = "det-v1.0-zh"


@dataclass
class ProjectMemoryCandidate:
    """Extractor 输出的候选记忆，不直接写 DB，供 memory_service 校验和幂等写入。"""

    memory_type: str
    scope: str
    content: str
    rationale: str
    source_type: str
    source_id: str
    source_hash: str
    visibility: str
    subject_user_id: str | None = None
    owner_user_id_snapshot: str | None = None
    related_stage_id: str | None = None
    related_task_id: str | None = None
    related_risk_id: str | None = None
    valid_until: datetime | None = None


def _compute_source_hash(stable_fields: dict) -> str:
    """对稳定字段做确定性 JSON 序列化 + SHA256。

    stable_fields 只包含影响抽取语义的字段，
    不包含 created_at/updated_at/requires_confirmation 等无关字段。
    """
    canonical = json.dumps(stable_fields, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _get_direction_card_stable_fields(output: DirectionCardOutput) -> dict:
    """提取 DirectionCardOutput 中影响抽取语义的稳定字段。"""
    return {
        "problem": output.problem,
        "users": output.users,
        "value": output.value,
        "deliverables": sorted(output.deliverables),
        "boundaries": sorted(output.boundaries) if output.boundaries else [],
        "mvp_boundary": output.mvp_boundary,
    }


def extract_direction_card_confirmed(
    session: Session,
    *,
    proposal: AgentProposal,
    project: Project,
) -> list[ProjectMemoryCandidate]:
    """direction_card_confirmed → 1 条 direction 记忆
    + payload 含 boundaries 时 → 1 条 boundary 记忆（多点稳定排序聚合）

    visibility=team, scope=project
    """
    # Parse and validate payload
    payload = proposal.payload
    if isinstance(payload, str):
        payload = json.loads(payload)
    output = DirectionCardOutput.model_validate(payload)

    project_name = resolve_project_name(session, project.id)
    source_hash = _compute_source_hash(_get_direction_card_stable_fields(output))
    candidates: list[ProjectMemoryCandidate] = []

    # ── direction 记忆 ──
    deliverables_cn = "、".join(output.deliverables)
    direction_content = (
        f"项目「{project_name}」的核心方向："
        f"解决{output.problem}，服务{output.users}，交付{output.value}。"
        f"主要交付物：{deliverables_cn}。"
    )
    direction_rationale = "方向卡确认时团队明确了项目方向。来源：方向卡确认。"

    candidates.append(
        ProjectMemoryCandidate(
            memory_type="direction",
            scope="project",
            content=direction_content,
            rationale=direction_rationale,
            source_type="direction_card_confirmed",
            source_id=proposal.id,
            source_hash=source_hash,
            visibility="team",
        )
    )

    # ── boundary 记忆（仅当 boundaries 非空）──
    if output.boundaries:
        # 稳定排序后聚合为 1 条
        sorted_boundaries = sorted(output.boundaries)
        boundaries_cn = "；".join(sorted_boundaries)
        boundary_content = f"项目「{project_name}」的范围边界：{boundaries_cn}。"
        boundary_rationale = "方向卡确认时团队明确了 MVP 和范围边界。来源：方向卡确认。"

        candidates.append(
            ProjectMemoryCandidate(
                memory_type="boundary",
                scope="project",
                content=boundary_content,
                rationale=boundary_rationale,
                source_type="direction_card_confirmed",
                source_id=proposal.id,
                source_hash=source_hash,
                visibility="team",
            )
        )

    return candidates
