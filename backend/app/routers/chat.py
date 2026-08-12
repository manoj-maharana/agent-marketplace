import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session_factory, get_db
from app.framework import vector_search
from app.framework.agent import Agent as RuntimeAgent
from app.models import Agent, Conversation, Message, ResourceAgent, utcnow
from app.schemas import ConversationCreate, ConversationOut, MessageCreate, MessageOut
from app.services.embeddings import EmbeddingsNotConfigured, embed_texts

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/conversations", response_model=ConversationOut, status_code=201)
async def create_conversation(payload: ConversationCreate, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, payload.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    conversation = Conversation(agent_id=agent.id, title=payload.title or f"Chat with {agent.title}")
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation, attribute_names=["agent"])
    return conversation


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(agent_id: int | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(Conversation).order_by(Conversation.updated_at.desc())
    if agent_id:
        stmt = stmt.where(Conversation.agent_id == agent_id)
    result = await db.execute(stmt)
    return result.scalars().unique().all()


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: int, db: AsyncSession = Depends(get_db)):
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conversation)
    await db.commit()


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(conversation_id: int, db: AsyncSession = Depends(get_db)):
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id, Message.role.in_(["user", "assistant"]))
        .order_by(Message.created_at)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: int, payload: MessageCreate, db: AsyncSession = Depends(get_db)
):
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    agent = await db.get(Agent, conversation.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    history_stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id, Message.role.in_(["user", "assistant"]))
        .order_by(Message.created_at)
    )
    history = (await db.execute(history_stmt)).scalars().all()

    db.add(Message(conversation_id=conversation_id, role="user", content=payload.content))
    if not history and conversation.title == f"Chat with {agent.title}":
        conversation.title = payload.content[:50]
    await db.commit()

    history_messages: list[dict] = [{"role": m.role, "content": m.content} for m in history]
    history_messages.append({"role": "user", "content": payload.content})

    runtime_agent = RuntimeAgent.from_db(agent)

    extra_context: str | None = None
    resource_ids_stmt = select(ResourceAgent.resource_id).where(ResourceAgent.agent_id == agent.id)
    resource_ids = [r for r, in (await db.execute(resource_ids_stmt)).all()]
    if resource_ids:
        try:
            [query_embedding] = await embed_texts([payload.content])
            relevant = await vector_search.search_chunks(db, resource_ids, query_embedding, k=4)
            if relevant:
                extra_context = "Relevant context from the agent's attached resources:\n\n" + "\n\n---\n\n".join(
                    relevant
                )
        except EmbeddingsNotConfigured:
            pass  # chat still works without RAG context if embeddings aren't configured

    async def event_stream() -> AsyncGenerator[str, None]:
        full_text = ""
        async for event in runtime_agent.stream(history_messages, extra_context):
            if event["type"] == "done":
                full_text = event["content"]
            elif event["type"] == "error":
                full_text = f"⚠️ {event['message']}"
            yield f"data: {json.dumps(event)}\n\n"

        async with async_session_factory() as session:
            session.add(Message(conversation_id=conversation_id, role="assistant", content=full_text))
            conv = await session.get(Conversation, conversation_id)
            if conv:
                conv.updated_at = utcnow()
            await session.commit()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
