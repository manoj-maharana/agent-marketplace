from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Category, McpServer
from app.schemas import McpServerListResponse, McpServerOut

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


@router.get("", response_model=McpServerListResponse)
async def list_mcp_servers(
    category: str | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(McpServer)
    count_stmt = select(func.count()).select_from(McpServer)

    if category:
        stmt = stmt.join(Category).where(Category.slug == category)
        count_stmt = count_stmt.join(Category).where(Category.slug == category)

    if q:
        like = f"%{q.lower()}%"
        cond = or_(func.lower(McpServer.name).like(like), func.lower(McpServer.description).like(like))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        stmt.order_by(McpServer.install_count.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    items = (await db.execute(stmt)).scalars().unique().all()

    return McpServerListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{mcp_id}", response_model=McpServerOut)
async def get_mcp_server(mcp_id: int, db: AsyncSession = Depends(get_db)):
    server = await db.get(McpServer, mcp_id)
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return server
