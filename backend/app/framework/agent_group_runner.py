"""Runs one turn of an Agent Group through one of four collaboration modes.

Mirrors the product concept documented in LobeHub's own "Agent Groups" guide
(sequential / parallel / iterative / debate, plus a built-in Orchestrator that
synthesizes the team's contributions) - implemented here from scratch as
deterministic Python orchestration rather than copied code, since the modes
are a functional pattern, not the guide's specific prose or UI.

Each member's turn runs as its own deepagents graph (model + that member's
own functional skills as tools), so members can call tools mid-turn just
like the single-agent experimental chat endpoint does. The Orchestrator is
also a (tool-less) deepagents graph, kept separate from the members - it
only ever sees the original task plus everyone's contributions, never runs
mid-team.
"""

import asyncio

from app.config import get_settings
from app.framework.deepagents_support import agent_tool_keys, model_for_agent, tools_for
from app.models import AgentGroup, AgentGroupMember
from app.schemas import GroupContribution

DEFAULT_ORCHESTRATOR_PROMPT = (
    "You are the Orchestrator of a team of specialist agents. You'll be given "
    "the original task and each team member's contribution. Synthesize their "
    "input into one clear, well-organized final answer. Note any disagreements "
    "between members plainly rather than papering over them, and credit which "
    "member(s) drove which conclusion when it helps the reader."
)

_DEFAULT_DEBATE_ROLES = ["advocate", "critic", "analyst"]


async def _run_member(member: AgentGroupMember, message: str, extra_context: str = "") -> str:
    from deepagents import create_deep_agent

    agent = member.agent
    role_suffix = (
        f" You are playing the role of '{member.role_label}' in this discussion."
        if member.role_label
        else ""
    )
    graph = create_deep_agent(
        model=model_for_agent(agent),
        tools=tools_for(agent_tool_keys(agent)),
        system_prompt=agent.system_prompt + role_suffix,
    )
    content = f"{extra_context}\n\n{message}" if extra_context else message
    result = await graph.ainvoke({"messages": [{"role": "user", "content": content}]})
    final = result["messages"][-1].content if result.get("messages") else ""
    return final if isinstance(final, str) else str(final)


async def _run_orchestrator(
    group: AgentGroup, message: str, contributions: list[GroupContribution]
) -> str:
    from deepagents import create_deep_agent
    from langchain_openai import AzureChatOpenAI

    settings = get_settings()
    model = AzureChatOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
        azure_deployment=group.orchestrator_model_deployment or settings.azure_openai_deployment,
        temperature=0.4,
    )
    graph = create_deep_agent(
        model=model, system_prompt=group.orchestrator_prompt or DEFAULT_ORCHESTRATOR_PROMPT
    )

    transcript = "\n\n".join(
        f"[{c.agent_name}{f' ({c.role_label})' if c.role_label else ''} - round {c.round}]\n{c.content}"
        for c in contributions
    )
    prompt = f"Original task:\n{message}\n\nTeam contributions:\n\n{transcript}\n\nSynthesize a final answer."
    result = await graph.ainvoke({"messages": [{"role": "user", "content": prompt}]})
    final = result["messages"][-1].content if result.get("messages") else ""
    return final if isinstance(final, str) else str(final)


async def _run_sequential(members: list[AgentGroupMember], message: str) -> list[GroupContribution]:
    contributions: list[GroupContribution] = []
    running_context = ""
    for member in members:
        content = await _run_member(member, message, extra_context=running_context)
        contributions.append(
            GroupContribution(
                agent_id=member.agent.id,
                agent_name=member.agent.title,
                role_label=member.role_label,
                round=1,
                content=content,
            )
        )
        running_context += f"\n\n[{member.agent.title}'s contribution]\n{content}"
    return contributions


async def _run_parallel(members: list[AgentGroupMember], message: str) -> list[GroupContribution]:
    results = await asyncio.gather(*[_run_member(m, message) for m in members])
    return [
        GroupContribution(
            agent_id=m.agent.id, agent_name=m.agent.title, role_label=m.role_label, round=1, content=r
        )
        for m, r in zip(members, results, strict=True)
    ]


async def _run_iterative(
    members: list[AgentGroupMember], message: str, iterations: int
) -> list[GroupContribution]:
    pair = members[:2] if len(members) >= 2 else members
    contributions: list[GroupContribution] = []
    running_context = ""
    for round_num in range(1, max(1, iterations) + 1):
        for member in pair:
            content = await _run_member(member, message, extra_context=running_context)
            contributions.append(
                GroupContribution(
                    agent_id=member.agent.id,
                    agent_name=member.agent.title,
                    role_label=member.role_label,
                    round=round_num,
                    content=content,
                )
            )
            running_context += f"\n\n[Round {round_num} - {member.agent.title}]\n{content}"
    return contributions


async def _run_debate(members: list[AgentGroupMember], message: str) -> list[GroupContribution]:
    async def run_one(index: int, member: AgentGroupMember) -> tuple[str, str]:
        role = member.role_label or (
            _DEFAULT_DEBATE_ROLES[index] if index < len(_DEFAULT_DEBATE_ROLES) else "contributor"
        )
        prompt = f"Debate topic: {message}\n\nArgue from your assigned role as the {role}."
        content = await _run_member(member, prompt)
        return content, role

    results = await asyncio.gather(*[run_one(i, m) for i, m in enumerate(members)])
    return [
        GroupContribution(
            agent_id=m.agent.id, agent_name=m.agent.title, role_label=role, round=1, content=content
        )
        for m, (content, role) in zip(members, results, strict=True)
    ]


_MODES = {
    "sequential": lambda members, message, iterations: _run_sequential(members, message),
    "parallel": lambda members, message, iterations: _run_parallel(members, message),
    "iterative": lambda members, message, iterations: _run_iterative(members, message, iterations),
    "debate": lambda members, message, iterations: _run_debate(members, message),
}


async def run_group(group: AgentGroup, message: str) -> tuple[list[GroupContribution], str]:
    members = sorted(group.members, key=lambda m: m.position)
    if not members:
        raise ValueError("Group has no members")

    mode_fn = _MODES.get(group.mode)
    if mode_fn is None:
        raise ValueError(f"Unknown collaboration mode: {group.mode}")

    contributions = await mode_fn(members, message, group.iterations)
    summary = await _run_orchestrator(group, message, contributions)
    return contributions, summary
