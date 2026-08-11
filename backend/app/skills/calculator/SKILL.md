---
slug: calculator
name: Calculator
icon: 🧮
category: productivity
author: Agent Marketplace
functional: true
tool_key: calculator
---
            Evaluates arithmetic expressions on demand, from quick sums to nested formulas.

            ## Instructions

            1. Accept a plain arithmetic expression using + - * / % ** and parentheses.
2. Evaluate it exactly - no estimation.
3. Return the numeric result, or a clear error if the expression is invalid.

            ## Example

            `(12 + 4) * 3 / 2` -> `24.0`

            ## Tool

            This skill is backed by `tool.py` in this folder and registered as the callable tool `calculator`. Agents with this skill enabled can invoke it automatically during a conversation.
