from sqlalchemy import select

from app.db import async_session_factory
from app.framework.skills import BaseSkill, skill_registry
from app.models import AgentGroup


class ListMyAgentGroupsSkill(BaseSkill):
    key = "list_my_agent_groups"
    name = "My Agent Groups"
    description = (
        "List the Agent Groups (teams of agents that collaborate) the user has created, with "
        "their collaboration mode and members. Use this whenever the user asks what agent "
        "groups or teams they have set up."
    )
    parameters = {"type": "object", "properties": {}}

    async def run(self) -> dict:
        async with async_session_factory() as db:
            rows = (await db.execute(select(AgentGroup))).scalars().unique().all()

        groups = [
            {
                "id": g.id,
                "name": g.name,
                "description": g.description,
                "mode": g.mode,
                "members": [m.agent.title for m in g.members],
            }
            for g in rows
        ]
        return {"count": len(groups), "groups": groups}


skill_registry.register(ListMyAgentGroupsSkill())
