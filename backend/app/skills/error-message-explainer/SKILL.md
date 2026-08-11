---
slug: error-message-explainer
name: Error Message Explainer
icon: 🚧
category: dev-tools
author: Agent Marketplace
functional: false
tool_key: null
---
            Explains a cryptic error message and suggests likely causes.

            ## Instructions

            1. Identify the error type/class from the message.
2. Explain in plain language what that category of error generally means.
3. List the 2-3 most likely causes given the specific message and any surrounding context.
4. Suggest a concrete first thing to check, not just 'check your code.'

            ## Example

            'NoneType has no attribute...' -> something expected to hold a value was empty; check the call right before it.

            ## Tool

            This skill has no code implementation yet. When an agent has it enabled, the instructions above are injected into the model's context as guidance to follow.
