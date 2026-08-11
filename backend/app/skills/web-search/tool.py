import httpx

from app.framework.skills import BaseSkill, skill_registry


class WebSearchSkill(BaseSkill):
    key = "web_search"
    name = "Web Search"
    description = "Search the web for a quick summary and related facts about a topic."
    parameters = {
        "type": "object",
        "properties": {"query": {"type": "string", "description": "The search query."}},
        "required": ["query"],
    }

    async def run(self, query: str) -> dict:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    "https://api.duckduckgo.com/",
                    params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:  # noqa: BLE001
            return {"query": query, "error": f"Search failed: {exc}"}

        related = [
            {"text": t.get("Text"), "url": t.get("FirstURL")}
            for t in data.get("RelatedTopics", [])
            if isinstance(t, dict) and t.get("Text")
        ][:5]

        return {
            "query": query,
            "summary": data.get("AbstractText") or "No direct summary found.",
            "source_url": data.get("AbstractURL"),
            "related": related,
        }


skill_registry.register(WebSearchSkill())
