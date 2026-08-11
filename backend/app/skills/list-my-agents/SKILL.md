---
slug: list-my-agents
name: My Agents
icon: 🗂️
category: productivity
author: Agent Marketplace
functional: true
tool_key: list_my_agents
---

Lists the agents currently in the user's library - both agents installed from the marketplace and custom ones they've created themselves.

## Instructions

1. Call this whenever the user asks what agents they have, have added, installed, or built - phrasing varies ("what agents do I have", "list my agents", "what have I added").
2. Read the returned list rather than guessing from conversation history - the user may have added agents in a session you can't see.
3. Summarize by name and purpose; mention custom (self-created) agents separately from installed marketplace ones if it's a mixed list.
4. If the list is empty, say so plainly and suggest visiting the Agent Marketplace.

## Example

"What agents have I added?" -> calls this tool -> "You have 3 agents: Study Buddy (installed), Daily Planner Pal (installed), and Weekend Trip Planner (a custom agent you created)."

## Tool

This skill is backed by `tool.py` in this folder and registered as the callable tool
`list_my_agents`. It opens its own short-lived database session (read-only) rather than
relying on conversation context, so the answer is always accurate.
