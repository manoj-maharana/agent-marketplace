import json
from collections.abc import AsyncGenerator

from openai import AsyncAzureOpenAI

from app.config import get_settings
from app.framework import skill_loader
from app.framework.skills import skill_registry

skill_loader.load_skill_docs()  # discovers app/skills/*/ and registers functional tools

MAX_TOOL_ROUNDS = 4


def get_client() -> AsyncAzureOpenAI:
    settings = get_settings()
    return AsyncAzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
    )


async def stream_chat(
    messages: list[dict],
    tool_keys: list[str],
    deployment: str | None = None,
    temperature: float = 0.7,
) -> AsyncGenerator[dict, None]:
    """Runs a (possibly multi-round) Azure OpenAI chat completion with tool-calling,
    yielding structured events: token / tool_call / tool_result / done / error."""
    settings = get_settings()

    if not settings.azure_openai_configured:
        yield {
            "type": "error",
            "message": (
                "Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT and "
                "AZURE_OPENAI_API_KEY in backend/.env, then restart the server."
            ),
        }
        return

    client = get_client()
    model = deployment or settings.azure_openai_deployment
    tools = skill_registry.openai_tool_defs(tool_keys) or None
    working_messages = list(messages)
    full_text = ""

    try:
        for _round in range(MAX_TOOL_ROUNDS):
            stream = await client.chat.completions.create(
                model=model,
                messages=working_messages,
                tools=tools,
                temperature=temperature,
                stream=True,
            )

            round_text = ""
            tool_call_fragments: dict[int, dict] = {}
            finish_reason: str | None = None

            async for chunk in stream:
                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                delta = choice.delta
                if choice.finish_reason:
                    finish_reason = choice.finish_reason

                if delta and delta.content:
                    round_text += delta.content
                    yield {"type": "token", "content": delta.content}

                if delta and delta.tool_calls:
                    for tc in delta.tool_calls:
                        frag = tool_call_fragments.setdefault(
                            tc.index, {"id": None, "name": "", "arguments": ""}
                        )
                        if tc.id:
                            frag["id"] = tc.id
                        if tc.function and tc.function.name:
                            frag["name"] += tc.function.name
                        if tc.function and tc.function.arguments:
                            frag["arguments"] += tc.function.arguments

            full_text += round_text

            if finish_reason != "tool_calls" or not tool_call_fragments:
                yield {"type": "done", "content": full_text}
                return

            # Assistant turn that requested tool calls
            assistant_tool_calls = [
                {
                    "id": frag["id"] or f"call_{idx}",
                    "type": "function",
                    "function": {"name": frag["name"], "arguments": frag["arguments"] or "{}"},
                }
                for idx, frag in sorted(tool_call_fragments.items())
            ]
            working_messages.append(
                {"role": "assistant", "content": round_text or None, "tool_calls": assistant_tool_calls}
            )

            for call in assistant_tool_calls:
                name = call["function"]["name"]
                try:
                    args = json.loads(call["function"]["arguments"] or "{}")
                except json.JSONDecodeError:
                    args = {}

                yield {"type": "tool_call", "name": name, "arguments": args}
                result = await skill_registry.call(name, args)
                yield {"type": "tool_result", "name": name, "result": result}

                working_messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": json.dumps(result),
                    }
                )

        yield {"type": "done", "content": full_text}
    except Exception as exc:  # noqa: BLE001
        yield {"type": "error", "message": str(exc)}
