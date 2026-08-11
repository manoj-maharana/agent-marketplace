from datetime import datetime, timezone

from app.framework.skills import BaseSkill, skill_registry


class CurrentDatetimeSkill(BaseSkill):
    key = "current_datetime"
    name = "Current Date & Time"
    description = "Get the current UTC date and time."
    parameters = {"type": "object", "properties": {}}

    async def run(self) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "iso": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "weekday": now.strftime("%A"),
        }


skill_registry.register(CurrentDatetimeSkill())
