from sqlalchemy import or_, select

from app.db import async_session_factory
from app.framework.skills import BaseSkill, skill_registry
from app.models import Agent


class ListMyAgentsSkill(BaseSkill):
    key = "list_my_agents"
    name = "My Agents"
    description = (
        "List the agents currently in the user's library: agents installed from the "
        "marketplace plus any custom agents they've created. Use this whenever the user asks "
        "what agents they have, have added, installed, or built."
    )
    parameters = {"type": "object", "properties": {}}

    async def run(self) -> dict:
        async with async_session_factory() as db:
            rows = (
                (
                    await db.execute(
                        select(Agent).where(or_(Agent.is_installed.is_(True), Agent.is_custom.is_(True)))
                    )
                )
                .scalars()
                .unique()
                .all()
            )

        agents = [
            {
                "id": a.id,
                "title": a.title,
                "description": a.description,
                "category": a.category.name if a.category else None,
                "is_custom": a.is_custom,
                "skills": [s.name for s in a.skills],
            }
            for a in rows
        ]
        return {"count": len(agents), "agents": agents}


skill_registry.register(ListMyAgentsSkill())
