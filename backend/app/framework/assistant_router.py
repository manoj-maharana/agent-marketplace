"""Routes a free-text Assistant message to one or more of the user's library
agents, then executes them and (for multi-agent turns) synthesizes a single
final answer - the engine behind app/routers/assistant.py.

Deliberately built on the same primitives as the production single-agent
chat path (app/framework/agent.py's Agent.stream / app/services/azure_openai's
stream_chat) rather than the experimental deepagents-based Agent Group
runner, so it streams token-by-token over SSE the same way regular chat
does, and inherits the same "Azure OpenAI not configured" fallback behavior.
"""

import asyncio
import json
from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING

from app.config import get_settings
from app.framework.agent import Agent as RuntimeAgent
from app.services.azure_openai import get_client, stream_chat

if TYPE_CHECKING:
    from app.models import Agent as AgentRow

ROUTER_SYSTEM_PROMPT = """You are the routing planner for a multi-agent assistant workspace.
Given the user's message and a list of the specialist agents available in their library, decide
which agent(s) should handle it and how they should collaborate.

Respond with ONLY a JSON object of this exact shape, no other text:
{"mode": "single" | "parallel" | "sequential", "agent_ids": [<int>, ...], "reason": "<one short sentence>"}

Rules:
- "single": exactly one agent is clearly the right fit for the whole request.
- "parallel": the request has multiple independent facets that different agents can each tackle
  on their own at the same time (their answers get combined into one final reply afterward).
- "sequential": one agent's output should become input to the next (e.g. research, then write).
- Only use agent ids from the list you were given. Pick 1 to 3 agents, never more, never zero.
- If nothing is a great fit, pick the single closest agent rather than refusing.
"""

SYNTHESIS_SYSTEM_PROMPT = """You are the Assistant, presenting a team's combined work as one
final answer to the user who asked the original question. You'll be given the original message
and each delegated specialist's contribution. Write one clear, well-organized reply that draws on
all of it - don't just concatenate the contributions, and don't mention this synthesis step itself."""


async def plan_route(message: str, agents: list["AgentRow"]) -> dict:
    """Decides which library agent(s) should handle `message`. Falls back to
    the first agent in "single" mode if Azure OpenAI isn't configured or the
    model's response can't be parsed - routing always resolves to *something*
    runnable, and the actual "not configured" error surfaces naturally once
    stream_chat is invoked, same as regular chat."""
    if not agents:
        return {"mode": "single", "agent_ids": [], "reason": "No agents in your library yet."}

    settings = get_settings()
    if not settings.azure_openai_configured:
        return {"mode": "single", "agent_ids": [agents[0].id], "reason": "Default routing."}

    catalog = "\n".join(f"- id={a.id}: {a.title} - {a.description}" for a in agents)
    try:
        client = get_client()
        resp = await client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[
                {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
                {"role": "user", "content": f"Available agents:\n{catalog}\n\nUser message: {message}"},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
        plan = json.loads(resp.choices[0].message.content or "{}")
    except Exception:  # noqa: BLE001 - any planning failure just falls back below
        plan = {}

    valid_ids = {a.id for a in agents}
    agent_ids = [i for i in plan.get("agent_ids", []) if isinstance(i, int) and i in valid_ids][:3]
    if not agent_ids:
        agent_ids = [agents[0].id]
    mode = plan.get("mode") if plan.get("mode") in ("single", "parallel", "sequential") else "single"
    if len(agent_ids) == 1:
        mode = "single"
    return {"mode": mode, "agent_ids": agent_ids, "reason": plan.get("reason", "")}


async def _run_agent_streamed(
    agent_id: int, row: "AgentRow", message: str, extra_context: str | None, queue: asyncio.Queue
) -> None:
    await queue.put({"type": "agent_start", "agent_id": agent_id, "agent_title": row.title})
    runtime = RuntimeAgent.from_db(row)
    text = ""
    async for event in runtime.stream([{"role": "user", "content": message}], extra_context):
        if event["type"] == "token":
            text += event["content"]
            await queue.put({"type": "agent_token", "agent_id": agent_id, "content": event["content"]})
        elif event["type"] == "done":
            text = event["content"]
        elif event["type"] == "error":
            text = f"⚠️ {event['message']}"
    await queue.put({"type": "agent_done", "agent_id": agent_id, "content": text})


async def _synthesize(message: str, contributions: list[dict]) -> AsyncGenerator[dict, None]:
    transcript = "\n\n".join(f"[{c['agent_title']}]\n{c['content']}" for c in contributions)
    prompt = f"Original message:\n{message}\n\nTeam contributions:\n\n{transcript}"
    messages = [
        {"role": "system", "content": SYNTHESIS_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    async for event in stream_chat(messages, tool_keys=[]):
        yield event


async def run_assistant_turn(
    message: str, agents_by_id: dict[int, "AgentRow"], plan: dict
) -> AsyncGenerator[dict, None]:
    """Yields route -> {agent_start, agent_token, agent_done}* -> [synthesis token]* -> done | error.

    Also returns (via the final "done" event's "routing" field) enough structure for the
    caller to persist what happened - which agents ran and what each of them said."""
    agent_ids = plan["agent_ids"]
    mode = plan["mode"]

    if not agent_ids:
        yield {"type": "error", "message": "No agents are in your library yet - install or create one first."}
        return

    yield {
        "type": "route",
        "mode": mode,
        "agents": [{"id": i, "title": agents_by_id[i].title} for i in agent_ids],
        "reason": plan.get("reason", ""),
    }

    contributions: list[dict] = []

    try:
        if mode == "sequential":
            running_context = ""
            for aid in agent_ids:
                row = agents_by_id[aid]
                queue: asyncio.Queue = asyncio.Queue()
                task = asyncio.create_task(
                    _run_agent_streamed(aid, row, message, running_context or None, queue)
                )
                text = ""
                while True:
                    item = await queue.get()
                    yield item
                    if item["type"] == "agent_token":
                        text += item["content"]
                    elif item["type"] == "agent_done":
                        text = item["content"]
                        break
                await task
                contributions.append({"agent_id": aid, "agent_title": row.title, "content": text})
                running_context += f"\n\n[{row.title}'s contribution]\n{text}"
        else:
            queue = asyncio.Queue()
            tasks = [
                asyncio.create_task(_run_agent_streamed(aid, agents_by_id[aid], message, None, queue))
                for aid in agent_ids
            ]
            done_count = 0
            pending_text: dict[int, str] = {aid: "" for aid in agent_ids}
            while done_count < len(agent_ids):
                item = await queue.get()
                yield item
                if item["type"] == "agent_done":
                    pending_text[item["agent_id"]] = item["content"]
                    done_count += 1
            await asyncio.gather(*tasks)
            contributions = [
                {"agent_id": aid, "agent_title": agents_by_id[aid].title, "content": pending_text[aid]}
                for aid in agent_ids
            ]

        if mode == "single":
            final_text = contributions[0]["content"]
        else:
            final_text = ""
            async for event in _synthesize(message, contributions):
                if event["type"] == "token":
                    final_text += event["content"]
                    yield {"type": "token", "content": event["content"]}
                elif event["type"] == "done":
                    final_text = event["content"]
                elif event["type"] == "error":
                    final_text = f"⚠️ {event['message']}"

        yield {"type": "done", "content": final_text, "routing": {"mode": mode, "contributions": contributions}}
    except Exception as exc:  # noqa: BLE001
        yield {"type": "error", "message": str(exc)}
