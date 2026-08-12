from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database — defaults to the docker-compose Postgres service. Override with
    # a sqlite+aiosqlite:// URL for zero-setup local dev without Docker.
    database_url: str = "postgresql+asyncpg://agentmarket:agentmarket@localhost:5432/agentmarket"
    # asyncpg doesn't parse libpq-style `?sslmode=require` in the URL, so SSL is
    # negotiated via connect_args instead (see app/db.py). Azure Database for
    # PostgreSQL requires SSL; local docker-compose Postgres doesn't use it.
    database_ssl: bool = False

    # Azure OpenAI
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_api_version: str = "2024-10-21"
    azure_openai_deployment: str = "gpt-4o"
    azure_openai_embedding_deployment: str = "text-embedding-3-small"

    # Azure Blob Storage — backs the workspace-level Resources feature (raw
    # file storage: PDF/Word/PPT/Excel/etc, distinct from the per-agent
    # Knowledge base which only stores derived text chunks + embeddings).
    azure_storage_connection_string: str = ""
    azure_storage_container: str = "resources"

    # App
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    auto_seed: bool = True

    @property
    def azure_openai_configured(self) -> bool:
        return bool(self.azure_openai_endpoint and self.azure_openai_api_key)

    @property
    def blob_storage_configured(self) -> bool:
        return bool(self.azure_storage_connection_string)


@lru_cache
def get_settings() -> Settings:
    return Settings()
