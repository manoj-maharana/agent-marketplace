import math

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Splits text into overlapping chunks, preferring paragraph boundaries."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    buffer = ""

    for para in paragraphs:
        candidate = f"{buffer}\n\n{para}" if buffer else para
        if len(candidate) <= chunk_size:
            buffer = candidate
            continue
        if buffer:
            chunks.append(buffer)
        if len(para) <= chunk_size:
            buffer = para
        else:
            # Paragraph itself is too long — hard-split with overlap.
            start = 0
            while start < len(para):
                end = start + chunk_size
                chunks.append(para[start:end])
                start = end - overlap
            buffer = ""

    if buffer:
        chunks.append(buffer)

    return chunks or ([text[:chunk_size]] if text.strip() else [])


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def top_k_by_similarity(query_embedding: list[float], items: list[tuple[str, list[float]]], k: int = 4) -> list[str]:
    """Given (content, embedding) pairs, returns the top-k content strings by cosine similarity."""
    scored = sorted(items, key=lambda item: cosine_similarity(query_embedding, item[1]), reverse=True)
    return [content for content, _ in scored[:k]]
