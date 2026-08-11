from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.framework.chunking import chunk_text
from app.models import Agent, KnowledgeChunk, KnowledgeFile
from app.schemas import KnowledgeFileOut
from app.services.embeddings import EmbeddingsNotConfigured, embed_texts

router = APIRouter(prefix="/api/agents/{agent_id}/knowledge", tags=["knowledge"])

ALLOWED_EXTENSIONS = (".txt", ".md")


@router.get("", response_model=list[KnowledgeFileOut])
async def list_knowledge_files(agent_id: int, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    stmt = select(KnowledgeFile).where(KnowledgeFile.agent_id == agent_id).order_by(
        KnowledgeFile.created_at.desc()
    )
    files = (await db.execute(stmt)).scalars().all()
    return [
        KnowledgeFileOut(
            id=f.id, filename=f.filename, chunk_count=len(f.chunks), created_at=f.created_at
        )
        for f in files
    ]


@router.post("", response_model=KnowledgeFileOut, status_code=201)
async def upload_knowledge_file(
    agent_id: int, file: UploadFile, db: AsyncSession = Depends(get_db)
):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    filename = file.filename or "untitled.txt"
    if not filename.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Only .txt and .md files are supported")

    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="File must be UTF-8 text") from exc

    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="File has no readable text content")

    try:
        embeddings = await embed_texts(chunks)
    except EmbeddingsNotConfigured as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    knowledge_file = KnowledgeFile(agent_id=agent_id, filename=filename)
    db.add(knowledge_file)
    await db.flush()

    for index, (content, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
        db.add(
            KnowledgeChunk(
                file_id=knowledge_file.id,
                agent_id=agent_id,
                chunk_index=index,
                content=content,
                embedding=embedding,
            )
        )

    await db.commit()
    return KnowledgeFileOut(
        id=knowledge_file.id,
        filename=knowledge_file.filename,
        chunk_count=len(chunks),
        created_at=knowledge_file.created_at,
    )


@router.delete("/{file_id}", status_code=204)
async def delete_knowledge_file(agent_id: int, file_id: int, db: AsyncSession = Depends(get_db)):
    knowledge_file = await db.get(KnowledgeFile, file_id)
    if not knowledge_file or knowledge_file.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="File not found")
    await db.delete(knowledge_file)
    await db.commit()
