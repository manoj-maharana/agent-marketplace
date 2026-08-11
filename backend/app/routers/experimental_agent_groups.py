"""EXPERIMENTAL - not used by the production chat path in app/routers/chat.py.

"Agent Groups": a team of existing marketplace/library agents that
collaborate on a single turn under one of four modes - sequential, parallel,
iterative, debate - plus a built-in Orchestrator that synthesizes the
team's contributions into one final answer. This mirrors the *product
concept* LobeHub documents in its own "Agent Groups" guide (same four mode
names, same "built-in Orchestrator" idea) - the implementation here
(models, orchestration loop, API shape) is original, not copied from their
docs or source.

Each member's turn and the Orchestrator's synthesis both run as deepagents
graphs (see app/framework/agent_group_runner.py), reusing the same
skill-to-LangChain-tool bridge as app/routers/experimental_deepagents.py.

Deliberately isolated alongside experimental_deepagents.py: same heavier
dependency footprint (langchain/langgraph), same "prototype, not yet the
production chat path" status.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.framework.agent_group_runner import run_group
from app.models import Agent, AgentGroup, AgentGroupMember
from app.schemas import (
    AgentGroupCreate,
    AgentGroupListResponse,
    AgentGroupOut,
    GroupRunRequest,
    GroupRunResponse,
)

router = APIRouter(prefix="/api/experimental/deepagents/groups", tags=["experimental"])

_VALID_MODES = {"sequential", "parallel", "iterative", "debate"}


async def _resolve_members(db: AsyncSession, payload: AgentGroupCreate) -> list[AgentGroupMember]:
    if not payload.members:
        return []
    agent_ids = [m.agent_id for m in payload.members]
    found = (await db.execute(select(Agent.id).where(Agent.id.in_(agent_ids)))).scalars().all()
    missing = set(agent_ids) - set(found)
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown agent id(s): {sorted(missing)}")

    return [
        AgentGroupMember(agent_id=m.agent_id, role_label=m.role_label, position=i)
        for i, m in enumerate(payload.members)
    ]


@router.get("", response_model=AgentGroupListResponse)
async def list_groups(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count()).select_from(AgentGroup))).scalar_one()
    items = (
        (await db.execute(select(AgentGroup).order_by(AgentGroup.updated_at.desc())))
        .scalars()
        .unique()
        .all()
    )
    return AgentGroupListResponse(items=items, total=total)


@router.get("/{group_id}", response_model=AgentGroupOut)
async def get_group(group_id: int, db: AsyncSession = Depends(get_db)):
    group = await db.get(AgentGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Agent group not found")
    return group


@router.post("", response_model=AgentGroupOut, status_code=201)
async def create_group(payload: AgentGroupCreate, db: AsyncSession = Depends(get_db)):
    if payload.mode not in _VALID_MODES:
        raise HTTPException(status_code=400, detail=f"mode must be one of {sorted(_VALID_MODES)}")

    group = AgentGroup(
        name=payload.name,
        description=payload.description,
        mode=payload.mode,
        orchestrator_prompt=payload.orchestrator_prompt,
        iterations=payload.iterations,
        members=await _resolve_members(db, payload),
    )
    db.add(group)
    await db.commit()
    await db.refresh(group, attribute_names=["members"])
    return group


@router.delete("/{group_id}", status_code=204)
async def delete_group(group_id: int, db: AsyncSession = Depends(get_db)):
    group = await db.get(AgentGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Agent group not found")
    await db.delete(group)
    await db.commit()


@router.post("/{group_id}/run", response_model=GroupRunResponse)
async def run_group_turn(group_id: int, payload: GroupRunRequest, db: AsyncSession = Depends(get_db)):
    from app.config import get_settings

    if not get_settings().azure_openai_configured:
        raise HTTPException(400, "Azure OpenAI is not configured (see backend/.env).")

    group = await db.get(AgentGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Agent group not found")

    try:
        contributions, summary = await run_group(group, payload.message)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GroupRunResponse(contributions=contributions, summary=summary)
