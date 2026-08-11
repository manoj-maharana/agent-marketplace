from abc import ABC, abstractmethod


class BaseSkill(ABC):
    """A callable tool an Agent can invoke mid-conversation.

    Subclass this, set `key`/`name`/`description`/`parameters`, and implement
    `run()`. `parameters` follows the JSON Schema shape OpenAI/Azure OpenAI
    function-calling expects.
    """

    key: str
    name: str
    description: str
    parameters: dict = {"type": "object", "properties": {}}  # noqa: RUF012

    @abstractmethod
    async def run(self, **kwargs) -> dict:
        """Execute the skill and return a JSON-serializable result."""

    def openai_schema(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.key,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class SkillRegistry:
    """Process-wide catalog of BaseSkill instances, keyed by `key`."""

    def __init__(self) -> None:
        self._skills: dict[str, BaseSkill] = {}

    def register(self, skill: BaseSkill) -> BaseSkill:
        self._skills[skill.key] = skill
        return skill

    def get(self, key: str) -> BaseSkill | None:
        return self._skills.get(key)

    def openai_tool_defs(self, keys: list[str]) -> list[dict]:
        return [skill.openai_schema() for key in keys if (skill := self.get(key))]

    async def call(self, key: str, arguments: dict) -> dict:
        skill = self.get(key)
        if not skill:
            return {"error": f"Unknown tool: {key}"}
        try:
            return await skill.run(**arguments)
        except TypeError as exc:
            return {"error": f"Invalid arguments for {key}: {exc}"}


skill_registry = SkillRegistry()
