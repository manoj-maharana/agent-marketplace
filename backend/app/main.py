from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    agents,
    assistant,
    categories,
    chat,
    experimental_agent_groups,
    experimental_deepagents,
    mcp,
    resources,
    skills,
    tasks,
)
from app.seed import seed

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.auto_seed:
        await seed()
    yield


app = FastAPI(title="Agent Marketplace API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories.router)
app.include_router(agents.router)
app.include_router(skills.router)
app.include_router(chat.router)
app.include_router(assistant.router)
app.include_router(resources.router)
app.include_router(tasks.router)
app.include_router(mcp.router)
app.include_router(experimental_deepagents.router)
app.include_router(experimental_agent_groups.router)


@app.get("/health")
async def health():
    return {"status": "ok", "azure_openai_configured": settings.azure_openai_configured}
