import json

from app.framework.skills import BaseSkill, skill_registry


class JsonFormatterSkill(BaseSkill):
    key = "json_formatter"
    name = "JSON Formatter"
    description = "Validate a block of JSON and pretty-print it, or explain the syntax error."
    parameters = {
        "type": "object",
        "properties": {
            "json_text": {"type": "string", "description": "Raw JSON text to validate and format."}
        },
        "required": ["json_text"],
    }

    async def run(self, json_text: str) -> dict:
        try:
            parsed = json.loads(json_text)
        except json.JSONDecodeError as exc:
            return {"valid": False, "error": f"{exc.msg} at line {exc.lineno}, column {exc.colno}"}
        return {"valid": True, "formatted": json.dumps(parsed, indent=2, ensure_ascii=False)}


skill_registry.register(JsonFormatterSkill())
