---
slug: regex-tester
name: Regex Tester
icon: 🧩
category: dev-tools
author: Agent Marketplace
functional: true
tool_key: regex_tester
---
            Explains and validates a regular expression against sample input.

            ## Instructions

            1. Compile the pattern; report a syntax error immediately if invalid.
2. Run it against the sample text and collect up to 20 matches.
3. Return each match with its position and captured groups.

            ## Example

            Pattern `\d+` on `a1 b22 c333` -> 3 matches: 1, 22, 333.

            ## Tool

            This skill is backed by `tool.py` in this folder and registered as the callable tool `regex_tester`. Agents with this skill enabled can invoke it automatically during a conversation.
