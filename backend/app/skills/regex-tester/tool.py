import re

from app.framework.skills import BaseSkill, skill_registry


class RegexTesterSkill(BaseSkill):
    key = "regex_tester"
    name = "Regex Tester"
    description = "Validate a regular expression and show what it matches in a sample text."
    parameters = {
        "type": "object",
        "properties": {
            "pattern": {"type": "string", "description": "The regular expression pattern."},
            "text": {"type": "string", "description": "Sample text to test the pattern against."},
        },
        "required": ["pattern", "text"],
    }

    async def run(self, pattern: str, text: str) -> dict:
        try:
            compiled = re.compile(pattern)
        except re.error as exc:
            return {"valid": False, "error": str(exc)}

        matches = [
            {"match": m.group(0), "start": m.start(), "end": m.end(), "groups": list(m.groups())}
            for m in compiled.finditer(text)
        ][:20]

        return {"valid": True, "match_count": len(matches), "matches": matches}


skill_registry.register(RegexTesterSkill())
