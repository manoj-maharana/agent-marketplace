import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session_factory, get_db
from app.framework.assistant_router import plan_route, run_assistant_turn
from app.models import Agent, AssistantMessage, AssistantThread, utcnow
from app.schemas import (
    AssistantMessageCreate,
    AssistantMessageOut,
    AssistantThreadCreate,
    AssistantThreadOut,
)

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.post("/threads", response_model=AssistantThreadOut, status_code=201)
async def create_thread(payload: AssistantThreadCreate, db: AsyncSession = Depends(get_db)):
    thread = AssistantThread(title=payload.title or "New thread")
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return thread


@router.get("/threads", response_model=list[AssistantThreadOut])
async def list_threads(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AssistantThread).order_by(AssistantThread.updated_at.desc(), AssistantThread.id.desc())
    )
    return result.scalars().all()


@router.delete("/threads/{thread_id}", status_code=204)
async def delete_thread(thread_id: int, db: AsyncSession = Depends(get_db)):
    thread = await db.get(AssistantThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    await db.delete(thread)
    await db.commit()


@router.get("/threads/{thread_id}/messages", response_model=list[AssistantMessageOut])
async def list_messages(thread_id: int, db: AsyncSession = Depends(get_db)):
    thread = await db.get(AssistantThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    result = await db.execute(
        select(AssistantMessage)
        .where(AssistantMessage.thread_id == thread_id)
        .order_by(AssistantMessage.created_at)
    )
    return result.scalars().all()


@router.post("/threads/{thread_id}/messages")
async def send_message(thread_id: int, payload: AssistantMessageCreate, db: AsyncSession = Depends(get_db)):
    thread = await db.get(AssistantThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    agents_stmt = select(Agent).where(or_(Agent.is_installed.is_(True), Agent.is_custom.is_(True)))
    library_agents = (await db.execute(agents_stmt)).scalars().unique().all()
    agents_by_id = {a.id: a for a in library_agents}

    db.add(AssistantMessage(thread_id=thread_id, role="user", content=payload.content))
    if thread.title == "New thread":
        thread.title = payload.content[:50]
    await db.commit()

    plan = await plan_route(payload.content, library_agents)

    async def event_stream() -> AsyncGenerator[str, None]:
        final_text = ""
        routing: dict | None = None
        async for event in run_assistant_turn(payload.content, agents_by_id, plan):
            if event["type"] == "done":
                final_text = event["content"]
                routing = event.get("routing")
            elif event["type"] == "error":
                final_text = f"⚠️ {event['message']}"
            yield f"data: {json.dumps(event)}\n\n"

        async with async_session_factory() as session:
            session.add(
                AssistantMessage(thread_id=thread_id, role="assistant", content=final_text, routing=routing)
            )
            t = await session.get(AssistantThread, thread_id)
            if t:
                t.updated_at = utcnow()
            await session.commit()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
