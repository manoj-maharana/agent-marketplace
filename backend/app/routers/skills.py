from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Category, Skill
from app.schemas import SkillListResponse, SkillOut

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.get("", response_model=SkillListResponse)
async def list_skills(
    category: str | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Skill)
    count_stmt = select(func.count()).select_from(Skill)

    if category:
        stmt = stmt.join(Category).where(Category.slug == category)
        count_stmt = count_stmt.join(Category).where(Category.slug == category)

    if q:
        like = f"%{q.lower()}%"
        cond = or_(func.lower(Skill.name).like(like), func.lower(Skill.description).like(like))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Skill.is_functional.desc(), Skill.name).offset((page - 1) * page_size).limit(
        page_size
    )
    items = (await db.execute(stmt)).scalars().unique().all()

    return SkillListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{skill_id}", response_model=SkillOut)
async def get_skill(skill_id: int, db: AsyncSession = Depends(get_db)):
    skill = await db.get(Skill, skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill
