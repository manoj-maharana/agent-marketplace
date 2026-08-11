from app.framework.skills import BaseSkill, skill_registry


class CitationFormatterSkill(BaseSkill):
    key = "citation_formatter"
    name = "Citation Formatter"
    description = "Format a source into an APA, MLA, or Chicago style citation."
    parameters = {
        "type": "object",
        "properties": {
            "style": {"type": "string", "enum": ["apa", "mla", "chicago"]},
            "author": {"type": "string", "description": "Author, as 'Last, First'."},
            "title": {"type": "string"},
            "year": {"type": "string"},
            "source": {"type": "string", "description": "Publisher, journal, or website name."},
        },
        "required": ["style", "author", "title", "year", "source"],
    }

    async def run(self, style: str, author: str, title: str, year: str, source: str) -> dict:
        style = style.lower()
        if style == "apa":
            citation = f"{author} ({year}). {title}. {source}."
        elif style == "mla":
            citation = f'{author}. "{title}." {source}, {year}.'
        elif style == "chicago":
            citation = f'{author}. "{title}." {source} ({year}).'
        else:
            return {"error": f"Unsupported style: {style}. Use apa, mla, or chicago."}

        return {"style": style, "citation": citation}


skill_registry.register(CitationFormatterSkill())
