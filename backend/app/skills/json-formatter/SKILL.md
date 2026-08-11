---
slug: json-formatter
name: JSON Formatter
icon: 🧾
category: dev-tools
author: Agent Marketplace
functional: true
tool_key: json_formatter
---
            Validates and pretty-prints a block of JSON, flagging syntax errors.

            ## Instructions

            1. Parse the given text as JSON.
2. If invalid, report the exact error message, line, and column.
3. If valid, return it re-serialized with 2-space indentation.

            ## Example

            `{"a":1}` -> `{\n  "a": 1\n}`

            ## Tool

            This skill is backed by `tool.py` in this folder and registered as the callable tool `json_formatter`. Agents with this skill enabled can invoke it automatically during a conversation.
