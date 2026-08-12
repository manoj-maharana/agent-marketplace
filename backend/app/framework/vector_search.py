"""Real vector-store search for Resource RAG, layered on top of the portable
JSON `ResourceChunk.embedding` column (see models.py).

On Postgres, each chunk's embedding is mirrored into a genuine pgvector
column via raw SQL, and search uses pgvector's `<=>` cosine-distance operator
- real ANN, not a Python loop. This is raw SQL rather than a second mapped
SQLAlchemy column because pgvector's Vector type only compiles cleanly on the
postgresql dialect; this app also runs on SQLite for zero-setup local dev
(see README.md), and mapping a Postgres-only column type at the ORM level
would break `Base.metadata.create_all` there. SQLite (and any non-Postgres
dialect) instead falls back to loading candidate chunks and scoring them in
Python (app/framework/chunking.py's cosine_similarity) - fine at this app's
scale, and it's local-dev-only so it never has to serve production traffic.

Embeddings are always requested at a fixed 1536 dimensions (see
app/services/embeddings.py) so the pgvector column width never has to change
even if the configured embedding deployment is swapped for a different model.
"""

from sqlalchemy import bindparam, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.framework.chunking import top_k_by_similarity
from app.models import ResourceChunk

EMBEDDING_DIMENSIONS = 1536


def is_postgres(db: AsyncSession) -> bool:
    return db.bind.dialect.name == "postgresql"


async def ensure_pgvector_ready(db: AsyncSession) -> None:
    """Idempotent setup, safe to call on every startup - no-ops on SQLite."""
    if not is_postgres(db):
        return
    await db.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    await db.execute(text("ALTER TABLE resource_chunks ADD COLUMN IF NOT EXISTS embedding_vec vector(1536)"))
    await db.commit()


async def store_embedding(db: AsyncSession, chunk_id: int, embedding: list[float]) -> None:
    """Mirrors a chunk's embedding into the pgvector column. No-op on SQLite."""
    if not is_postgres(db):
        return
    from pgvector.sqlalchemy import Vector

    stmt = text("UPDATE resource_chunks SET embedding_vec = :vec WHERE id = :cid").bindparams(
        bindparam("vec", type_=Vector(EMBEDDING_DIMENSIONS))
    )
    await db.execute(stmt, {"vec": embedding, "cid": chunk_id})


async def search_chunks(
    db: AsyncSession, resource_ids: list[int], query_embedding: list[float], k: int = 4
) -> list[str]:
    """Returns up to k chunk contents from the given resources, most relevant
    to query_embedding first."""
    if not resource_ids:
        return []

    if is_postgres(db):
        from pgvector.sqlalchemy import Vector

        stmt = text(
            "SELECT content FROM resource_chunks "
            "WHERE resource_id IN :ids AND embedding_vec IS NOT NULL "
            "ORDER BY embedding_vec <=> :qvec LIMIT :k"
        ).bindparams(
            bindparam("ids", expanding=True),
            bindparam("qvec", type_=Vector(EMBEDDING_DIMENSIONS)),
        )
        result = await db.execute(stmt, {"ids": resource_ids, "qvec": query_embedding, "k": k})
        return [row[0] for row in result.all()]

    result = await db.execute(
        select(ResourceChunk.content, ResourceChunk.embedding).where(
            ResourceChunk.resource_id.in_(resource_ids)
        )
    )
    items = [(content, embedding) for content, embedding in result.all()]
    return top_k_by_similarity(query_embedding, items, k=k)
