"""EXPERIMENTAL - not wired into the frontend, not used by the production
chat path in app/routers/chat.py.

A parallel prototype that runs a single chat turn through deepagents
(LangChain + LangGraph) instead of the hand-rolled Agent.stream() in
app/framework/agent.py. It exists to evaluate two things before committing
to a bigger migration:

1. Whether our BaseSkill tools work as LangChain tools with no rewrite
   (they do - see app/framework/deepagents_support.py's `skill_to_langchain_tool`,
   which wraps the same `skill_registry.call()` the production path already uses).
2. Real subagent delegation: the requested agent gets 1-2 sibling agents
   from the same category wired in as deepagents `subagents`, so the model
   can hand off a sub-task via deepagents' built-in `task` tool. This
   mirrors LobeHub's own subagent pattern (see packages/types/src/
   agentExecution/index.ts upstream: `execSubAgent` runs another agent in
   an isolated thread and bridges its result back to the parent's turn;
   `execVirtualSubAgent` is the tool-triggered version, marked
   `isSubAgent: true` so it can't itself spawn further subagents).
   deepagents' `task` tool is the same idea, just local-process instead of
   a separate isolated thread/operation.

See app/routers/experimental_agent_groups.py for the related "Agent Groups"
feature (multiple named members + an Orchestrator, deterministic
collaboration modes) - a different shape of multi-agent run than this
single-agent-plus-ad-hoc-subagents endpoint.

Deliberately isolated in its own router: deepagents pulls in langchain,
langgraph, and provider SDKs - a much heavier dependency footprint than the
rest of this backend. Keeping it here means it can be deleted or promoted to
the primary chat path later without touching app/routers/chat.py.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db import async_session_factory
from app.framework.deepagents_support import agent_tool_keys, model_for_agent, tools_for
from app.models import Agent as AgentRow

router = APIRouter(prefix="/api/experimental/deepagents", tags=["experimental"])


async def _load_agent_and_peers(db, agent_id: int) -> tuple[AgentRow, list[AgentRow]]:
    agent = (
        await db.execute(
            select(AgentRow).options(selectinload(AgentRow.skills)).where(AgentRow.id == agent_id)
        )
    ).scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")

    peers: list[AgentRow] = []
    if agent.category_id:
        peers = list(
            (
                await db.execute(
                    select(AgentRow)
                    .options(selectinload(AgentRow.skills))
                    .where(
                        AgentRow.category_id == agent.category_id,
                        AgentRow.id != agent.id,
                        AgentRow.is_custom.is_(False),
                    )
                    .limit(2)
                )
            ).scalars()
        )
    return agent, peers


class DeepAgentChatRequest(BaseModel):
    agent_id: int
    message: str


class DeepAgentStep(BaseModel):
    type: str  # "tool_call" | "subagent_call"
    name: str
    detail: str | None = None


class DeepAgentChatResponse(BaseModel):
    reply: str
    steps: list[DeepAgentStep]
    subagents_available: list[str]


@router.post("/chat", response_model=DeepAgentChatResponse)
async def deepagents_chat(payload: DeepAgentChatRequest) -> DeepAgentChatResponse:
    """Non-streaming: runs one full turn through a deepagents graph. Call
    this directly (e.g. via curl or the API docs) to evaluate deepagents -
    it is not linked from any page in the app."""
    settings = get_settings()
    if not settings.azure_openai_configured:
        raise HTTPException(400, "Azure OpenAI is not configured (see backend/.env).")

    from deepagents import create_deep_agent

    async with async_session_factory() as db:
        agent, peers = await _load_agent_and_peers(db, payload.agent_id)

        subagents = [
            {
                "name": peer.slug,
                "description": f"Delegate to {peer.title}: {peer.description}",
                "system_prompt": peer.system_prompt,
                "tools": tools_for(agent_tool_keys(peer)),
            }
            for peer in peers
        ]

        graph = create_deep_agent(
            model=model_for_agent(agent),
            tools=tools_for(agent_tool_keys(agent)),
            system_prompt=agent.system_prompt,
            subagents=subagents,
        )

        result = await graph.ainvoke({"messages": [{"role": "user", "content": payload.message}]})

    steps: list[DeepAgentStep] = []
    for msg in result.get("messages", []):
        for call in getattr(msg, "tool_calls", None) or []:
            kind = "subagent_call" if call["name"] == "task" else "tool_call"
            steps.append(DeepAgentStep(type=kind, name=call["name"], detail=str(call.get("args"))[:200]))

    final_content = result["messages"][-1].content if result.get("messages") else ""

    return DeepAgentChatResponse(
        reply=final_content if isinstance(final_content, str) else str(final_content),
        steps=steps,
        subagents_available=[s["name"] for s in subagents],
    )
