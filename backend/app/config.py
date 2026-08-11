from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database — defaults to the docker-compose Postgres service. Override with
    # a sqlite+aiosqlite:// URL for zero-setup local dev without Docker.
    database_url: str = "postgresql+asyncpg://agentmarket:agentmarket@localhost:5432/agentmarket"

    # Azure OpenAI
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_api_version: str = "2024-10-21"
    azure_openai_deployment: str = "gpt-4o"
    azure_openai_embedding_deployment: str = "text-embedding-3-small"

    # App
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    auto_seed: bool = True

    @property
    def azure_openai_configured(self) -> bool:
        return bool(self.azure_openai_endpoint and self.azure_openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
