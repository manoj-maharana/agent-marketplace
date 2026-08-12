import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Agent, Category, Skill
from app.schemas import AgentCreate, AgentListResponse, AgentOut, AgentUpdate

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _slugify(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "agent"
    return base


async def _unique_slug(db: AsyncSession, title: str) -> str:
    base = _slugify(title)
    slug = base
    suffix = 1
    while (await db.execute(select(Agent.id).where(Agent.slug == slug))).scalar_one_or_none():
        suffix += 1
        slug = f"{base}-{suffix}"
    return slug


async def _resolve_category(db: AsyncSession, slug: str | None) -> Category | None:
    if not slug:
        return None
    return (await db.execute(select(Category).where(Category.slug == slug))).scalar_one_or_none()


async def _resolve_skills(db: AsyncSession, skill_ids: list[int] | None) -> list[Skill]:
    if not skill_ids:
        return []
    return (await db.execute(select(Skill).where(Skill.id.in_(skill_ids)))).scalars().all()


@router.get("", response_model=AgentListResponse)
async def list_agents(
    category: str | None = None,
    q: str | None = None,
    scope: str = Query("marketplace", pattern="^(marketplace|library)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Agent)
    count_stmt = select(func.count()).select_from(Agent)

    if scope == "library":
        stmt = stmt.where(or_(Agent.is_installed.is_(True), Agent.is_custom.is_(True)))
        count_stmt = count_stmt.where(or_(Agent.is_installed.is_(True), Agent.is_custom.is_(True)))

    if category:
        stmt = stmt.join(Category).where(Category.slug == category)
        count_stmt = count_stmt.join(Category).where(Category.slug == category)

    if q:
        like = f"%{q.lower()}%"
        cond = or_(func.lower(Agent.title).like(like), func.lower(Agent.description).like(like))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = (await db.execute(count_stmt)).scalar_one()

    # Most seeded agents share the same updated_at (they're all inserted in one
    # batch), so updated_at alone leaves ties whose order SQLite doesn't
    # guarantee - a secondary key keeps pagination stable across DB engines.
    stmt = (
        stmt.order_by(Agent.updated_at.desc(), Agent.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(stmt)).scalars().unique().all()

    return AgentListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.post("", response_model=AgentOut, status_code=201)
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)):
    category = await _resolve_category(db, payload.category_slug)
    skills = await _resolve_skills(db, payload.skill_ids)

    agent = Agent(
        slug=await _unique_slug(db, payload.title),
        title=payload.title,
        description=payload.description,
        avatar_emoji=payload.avatar_emoji,
        avatar_color=payload.avatar_color,
        system_prompt=payload.system_prompt,
        category_id=category.id if category else None,
        tags=payload.tags,
        author="You",
        is_installed=True,
        is_custom=True,
        temperature=payload.temperature,
        skills=list(skills),
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent, attribute_names=["category", "skills"])
    return agent


@router.post("/{agent_id}/install", response_model=AgentOut)
async def install_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not agent.is_installed:
        agent.is_installed = True
        agent.install_count += 1
        await db.commit()
        await db.refresh(agent, attribute_names=["category", "skills"])
    return agent


@router.delete("/{agent_id}/install", response_model=AgentOut)
async def uninstall_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.is_custom:
        raise HTTPException(status_code=400, detail="Custom agents cannot be uninstalled, only deleted")
    agent.is_installed = False
    await db.commit()
    await db.refresh(agent, attribute_names=["category", "skills"])
    return agent


@router.post("/{agent_id}/fork", response_model=AgentOut, status_code=201)
async def fork_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    source = await db.get(Agent, agent_id)
    if not source:
        raise HTTPException(status_code=404, detail="Agent not found")

    forked = Agent(
        slug=await _unique_slug(db, source.title),
        title=source.title,
        description=source.description,
        avatar_emoji=source.avatar_emoji,
        avatar_color=source.avatar_color,
        system_prompt=source.system_prompt,
        category_id=source.category_id,
        tags=list(source.tags),
        author="You",
        is_installed=True,
        is_custom=True,
        temperature=source.temperature,
        skills=list(source.skills),
    )
    db.add(forked)
    await db.commit()
    await db.refresh(forked, attribute_names=["category", "skills"])
    return forked


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(agent_id: int, payload: AgentUpdate, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not agent.is_custom:
        raise HTTPException(status_code=400, detail="Only custom agents can be edited — fork it first")

    data = payload.model_dump(exclude_unset=True)
    if "category_slug" in data:
        category = await _resolve_category(db, data.pop("category_slug"))
        agent.category_id = category.id if category else None
    if "skill_ids" in data:
        agent.skills = await _resolve_skills(db, data.pop("skill_ids"))
    for field, value in data.items():
        setattr(agent, field, value)

    await db.commit()
    await db.refresh(agent, attribute_names=["category", "skills"])
    return agent


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not agent.is_custom:
        raise HTTPException(status_code=400, detail="Only custom agents can be deleted")
    await db.delete(agent)
    await db.commit()
