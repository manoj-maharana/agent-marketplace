import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session_factory, get_db
from app.framework import vector_search
from app.framework.assistant_router import plan_route, run_assistant_turn
from app.models import Agent, AssistantMessage, AssistantThread, ResourceAgent, utcnow
from app.schemas import (
    AssistantMessageCreate,
    AssistantMessageOut,
    AssistantThreadCreate,
    AssistantThreadOut,
)
from app.services.embeddings import EmbeddingsNotConfigured, embed_texts

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

    kb_stmt = select(ResourceAgent.agent_id).distinct()
    agents_with_kb = {r for r, in (await db.execute(kb_stmt)).all()} & agents_by_id.keys()

    db.add(AssistantMessage(thread_id=thread_id, role="user", content=payload.content))
    if thread.title == "New thread":
        thread.title = payload.content[:50]
    await db.commit()

    plan = await plan_route(payload.content, library_agents, agents_with_kb)

    # Retrieve each chosen agent's relevant document chunks once, up front -
    # same pattern as chat.py's single-agent path, computed before streaming
    # starts since it needs this request-scoped db session (see vector_search
    # module docstring for why the search itself is dialect-aware).
    resource_context_by_agent: dict[int, str] = {}
    chosen_with_kb = [aid for aid in plan["agent_ids"] if aid in agents_with_kb]
    if chosen_with_kb:
        try:
            [query_embedding] = await embed_texts([payload.content])
            for agent_id in chosen_with_kb:
                resource_ids_stmt = select(ResourceAgent.resource_id).where(
                    ResourceAgent.agent_id == agent_id
                )
                resource_ids = [r for r, in (await db.execute(resource_ids_stmt)).all()]
                relevant = await vector_search.search_chunks(db, resource_ids, query_embedding, k=4)
                if relevant:
                    resource_context_by_agent[agent_id] = (
                        "Relevant context from your attached resources:\n\n" + "\n\n---\n\n".join(relevant)
                    )
        except EmbeddingsNotConfigured:
            pass

    async def event_stream() -> AsyncGenerator[str, None]:
        final_text = ""
        routing: dict | None = None
        async for event in run_assistant_turn(
            payload.content, agents_by_id, plan, resource_context_by_agent
        ):
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
