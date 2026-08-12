"""Seeds the database from the locale content files under app/locales/<locale>/,
plus the skill packages under app/skills/<slug>/SKILL.md.

Runs automatically on startup when the categories table is empty (see main.py),
or manually via `python -m app.seed`. Only en-US exists today; adding another
locale means dropping a matching folder next to it and wiring up a language
switch later — the loader and DB schema don't need to change.
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from app.db import Base, async_session_factory, engine
from app.framework import skill_loader, vector_search
from app.models import Agent, Category, McpServer, Skill

LOCALE = "en-US"
LOCALES_DIR = Path(__file__).parent / "locales" / LOCALE


def _load_json(*parts: str):
    with open(LOCALES_DIR.joinpath(*parts), encoding="utf-8") as f:
        return json.load(f)


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        await vector_search.ensure_pgvector_ready(db)

        existing = (await db.execute(select(Category.id))).first()
        if existing:
            return

        categories: dict[str, Category] = {}
        for c in _load_json("agent_categories.json"):
            cat = Category(slug=c["slug"], name=c["name"], kind="agent")
            db.add(cat)
            categories[c["slug"]] = cat
        for c in _load_json("skill_categories.json"):
            cat = Category(slug=c["slug"], name=c["name"], kind="skill")
            db.add(cat)
            categories[c["slug"]] = cat
        for c in _load_json("mcp_categories.json"):
            cat = Category(slug=c["slug"], name=c["name"], kind="mcp")
            db.add(cat)
            categories[c["slug"]] = cat
        await db.flush()

        skills_by_slug: dict[str, Skill] = {}
        for doc in skill_loader.load_skill_docs():
            skill = Skill(
                slug=doc.slug,
                name=doc.name,
                description=doc.description,
                icon=doc.icon,
                category_id=categories[doc.category].id,
                tool_key=doc.tool_key,
                is_functional=doc.functional,
                author=doc.author,
                source_url=doc.source_url,
            )
            db.add(skill)
            skills_by_slug[doc.slug] = skill

        for m in _load_json("mcp_servers.json"):
            db.add(
                McpServer(
                    slug=m["slug"],
                    name=m["name"],
                    description=m["description"],
                    icon=m["icon"],
                    category_id=categories[m["category"]].id,
                    transport=m["transport"],
                    is_functional=m["is_functional"],
                    author="Agent Marketplace",
                )
            )
        await db.flush()

        agents_dir = LOCALES_DIR / "agents"
        for agent_file in sorted(agents_dir.glob("*.json")):
            category_slug = agent_file.stem
            for a in json.loads(agent_file.read_text(encoding="utf-8")):
                attached = [skills_by_slug[slug] for slug in a["skills"]]
                agent = Agent(
                    slug=a["slug"],
                    title=a["title"],
                    description=a["description"],
                    avatar_emoji=a["emoji"],
                    avatar_color=a["color"],
                    system_prompt=(
                        f"You are {a['title']}, an AI agent for the '{category_slug}' domain. "
                        f"{a['description']} Be concise, friendly, and use your available tools "
                        f"when they would give a more accurate answer than reasoning alone."
                    ),
                    category_id=categories[category_slug].id,
                    tags=a["tags"],
                    author="Agent Marketplace",
                    is_installed=a.get("installed", False),
                    is_custom=False,
                    skills=attached,
                )
                db.add(agent)

        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
