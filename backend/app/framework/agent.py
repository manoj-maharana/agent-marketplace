from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.framework import skill_loader
from app.services.azure_openai import stream_chat

if TYPE_CHECKING:
    from app.models import Agent as AgentRow


@dataclass
class Agent:
    """Runtime wrapper around a persisted Agent row: a persona plus the
    skills it's allowed to call. Keeps the DB row (persistence) separate
    from the thing that actually talks to the model (behavior)."""

    name: str
    system_prompt: str
    skill_keys: list[str] = field(default_factory=list)
    skill_guidance: str | None = None
    deployment: str | None = None
    temperature: float = 0.7

    @classmethod
    def from_db(cls, row: "AgentRow") -> "Agent":
        guidance_blocks = []
        for skill in row.skills:
            if skill.tool_key:
                continue  # functional skills are passed to the model as tools, not text
            doc = skill_loader.get_doc(skill.slug)
            if doc and doc.instructions.strip():
                guidance_blocks.append(f"### {doc.name}\n{doc.instructions.strip()}")

        return cls(
            name=row.title,
            system_prompt=row.system_prompt,
            skill_keys=sorted({s.tool_key for s in row.skills if s.tool_key}),
            skill_guidance=(
                "The following skills describe methodologies you should follow when they're "
                "relevant to the user's request:\n\n" + "\n\n".join(guidance_blocks)
                if guidance_blocks
                else None
            ),
            deployment=row.model_deployment,
            temperature=row.temperature,
        )

    def stream(
        self, history: list[dict], extra_context: str | None = None
    ) -> AsyncGenerator[dict, None]:
        """Streams a reply given prior turns as `{"role", "content"}` dicts
        (no system message — this method supplies the agent's own).

        Attached skills reach the model two ways: functional skills become
        OpenAI tool defs the model can call; skills with no code become a
        second system message of behavioral guidance (`skill_guidance`).
        `extra_context` (e.g. retrieved knowledge-base chunks) is injected as
        a third system message, kept separate from the other two."""
        messages = [{"role": "system", "content": self.system_prompt}]
        if self.skill_guidance:
            messages.append({"role": "system", "content": self.skill_guidance})
        if extra_context:
            messages.append({"role": "system", "content": extra_context})
        messages += history
        return stream_chat(messages, self.skill_keys, self.deployment, self.temperature)
