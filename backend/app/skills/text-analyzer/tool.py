import re

from app.framework.skills import BaseSkill, skill_registry


class TextCounterSkill(BaseSkill):
    key = "text_counter"
    name = "Text Analyzer"
    description = "Count words, characters, and sentences in a piece of text."
    parameters = {
        "type": "object",
        "properties": {"text": {"type": "string", "description": "The text to analyze."}},
        "required": ["text"],
    }

    async def run(self, text: str) -> dict:
        words = re.findall(r"\S+", text)
        sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
        return {
            "characters": len(text),
            "words": len(words),
            "sentences": len(sentences),
        }


skill_registry.register(TextCounterSkill())
