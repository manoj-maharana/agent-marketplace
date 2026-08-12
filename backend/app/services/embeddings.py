from openai import AsyncAzureOpenAI

from app.config import get_settings


class EmbeddingsNotConfigured(Exception):
    pass


def get_client() -> AsyncAzureOpenAI:
    settings = get_settings()
    return AsyncAzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
    )


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embeds a batch of strings via the Azure OpenAI embeddings deployment.

    Raises EmbeddingsNotConfigured if Azure OpenAI credentials aren't set,
    so callers can surface a clear message instead of a raw SDK error."""
    settings = get_settings()
    if not settings.azure_openai_configured:
        raise EmbeddingsNotConfigured(
            "Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY "
            "in backend/.env, then restart the server."
        )

    client = get_client()
    response = await client.embeddings.create(
        model=settings.azure_openai_embedding_deployment,
        input=texts,
        # Fixed regardless of which embedding model is configured, so the
        # pgvector column width (see app/framework/vector_search.py) never
        # has to change if the deployment is swapped for a different model.
        dimensions=1536,
    )
    return [item.embedding for item in response.data]
