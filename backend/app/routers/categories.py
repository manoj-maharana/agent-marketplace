from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Category
from app.schemas import CategoryOut

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    kind: str = Query(..., pattern="^(agent|skill|mcp)$"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Category).where(Category.kind == kind).order_by(Category.name))
    return result.scalars().all()
