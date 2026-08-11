---
slug: list-my-agent-groups
name: My Agent Groups
icon: 👥
category: productivity
author: Agent Marketplace
functional: true
tool_key: list_my_agent_groups
---

Lists the Agent Groups (teams of agents that collaborate on a task) the user has created, with each group's collaboration mode and members.

## Instructions

1. Call this whenever the user asks what agent groups or teams they've set up.
2. Read the returned list rather than guessing - report the actual mode (sequential/parallel/iterative/debate) and member names.
3. If there are none, say so and suggest creating one from the Agents page.

## Example

"What groups do I have?" -> calls this tool -> "You have one group, 'Content Team' (sequential), with members Literature Review Assistant and Product Description Writer."

## Tool

This skill is backed by `tool.py` in this folder and registered as the callable tool
`list_my_agent_groups`. It opens its own short-lived database session (read-only).
