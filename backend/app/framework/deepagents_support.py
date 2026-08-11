"""Shared helpers for the EXPERIMENTAL deepagents-backed routes
(app/routers/experimental_deepagents.py, app/routers/experimental_agent_groups.py).

Not imported by the production chat path (app/routers/chat.py /
app/framework/agent.py) - keeps the heavier langchain/deepagents dependency
surface confined to opt-in endpoints.
"""

from typing import TYPE_CHECKING, Any

from pydantic import create_model

from app.config import get_settings
from app.framework.skills import BaseSkill, skill_registry

if TYPE_CHECKING:
    from langchain_openai import AzureChatOpenAI

    from app.models import Agent as AgentRow

_JSON_TYPE_MAP: dict[str, type] = {
    "string": str,
    "number": float,
    "integer": int,
    "boolean": bool,
}


def skill_to_langchain_tool(skill: BaseSkill):
    from langchain_core.tools import StructuredTool

    properties: dict[str, Any] = skill.parameters.get("properties", {})
    required = set(skill.parameters.get("required", []))
    fields: dict[str, Any] = {}
    for field_name, spec in properties.items():
        py_type = _JSON_TYPE_MAP.get(spec.get("type"), str)
        fields[field_name] = (py_type, ... if field_name in required else None)
    args_schema = create_model(f"{skill.key}_args", **fields)  # type: ignore[call-overload]

    async def _run(**kwargs: Any) -> dict:
        return await skill_registry.call(skill.key, kwargs)

    return StructuredTool.from_function(
        coroutine=_run, name=skill.key, description=skill.description, args_schema=args_schema
    )


def tools_for(tool_keys: list[str]) -> list:
    return [skill_to_langchain_tool(skill_registry.get(k)) for k in tool_keys if skill_registry.get(k)]


def model_for_agent(agent: "AgentRow") -> "AzureChatOpenAI":
    """Builds an AzureChatOpenAI bound to an agent's own deployment/temperature
    (falling back to the app-wide default deployment)."""
    from langchain_openai import AzureChatOpenAI

    settings = get_settings()
    return AzureChatOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
        azure_deployment=agent.model_deployment or settings.azure_openai_deployment,
        temperature=agent.temperature,
    )


def agent_tool_keys(agent: "AgentRow") -> list[str]:
    return sorted({s.tool_key for s in agent.skills if s.tool_key})
