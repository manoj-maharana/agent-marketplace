"""Turns an uploaded Resource into searchable ResourceChunk rows: extract
text, chunk it, embed each chunk, store - run once per resource right after
upload (see routers/resources.py), independent of which agent(s) it later
gets attached to. If extraction or embeddings aren't available, the resource
still uploads and stays downloadable - it just won't show up in RAG search
until that's fixed and it's reprocessed."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.framework import vector_search
from app.framework.chunking import chunk_text
from app.framework.document_extract import ExtractionNotSupported, extract_text
from app.models import Resource, ResourceChunk
from app.services.blob_storage import BlobStorageNotConfigured, download_blob
from app.services.embeddings import EmbeddingsNotConfigured, embed_texts


async def process_resource(db: AsyncSession, resource: Resource) -> None:
    try:
        data = await download_blob(resource.blob_name)
        text = extract_text(resource.filename, data)
        chunks = chunk_text(text)
        if not chunks:
            raise ExtractionNotSupported(f"{resource.filename} has no readable text content")
        embeddings = await embed_texts(chunks)
    except (ExtractionNotSupported, EmbeddingsNotConfigured, BlobStorageNotConfigured) as exc:
        resource.processing_error = str(exc)
        await db.commit()
        return

    for index, (content, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
        chunk = ResourceChunk(resource_id=resource.id, chunk_index=index, content=content, embedding=embedding)
        db.add(chunk)
        await db.flush()
        await vector_search.store_embedding(db, chunk.id, embedding)

    resource.is_processed = True
    resource.processing_error = None
    await db.commit()
