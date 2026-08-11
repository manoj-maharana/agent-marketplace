---
slug: env-var-checker
name: Env Var Checker
icon: 🔐
category: dev-tools
author: Agent Marketplace
functional: false
tool_key: null
---
            Reviews a list of environment variables for naming and security issues.

            ## Instructions

            1. Scan each variable name for a consistent casing/naming convention.
2. Flag any variable name that looks like it should be namespaced but isn't (or vice versa).
3. Flag anything that looks like it holds a secret but isn't named to signal that.
4. Note any flagged variable in plain language - never repeat back an actual secret value.

            ## Example

            'apiKey' among SCREAMING_SNAKE_CASE vars -> flagged: inconsistent casing, no _KEY suffix convention.

            ## Tool

            This skill has no code implementation yet. When an agent has it enabled, the instructions above are injected into the model's context as guidance to follow.
