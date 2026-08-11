---
slug: web-search
name: Web Search
icon: 🔎
category: research-tools
author: Agent Marketplace
functional: true
tool_key: web_search
---
            Looks up a topic on the open web and returns a short summary with sources.

            ## Instructions

            1. Send the query to a web search API.
2. Return the top abstract/summary along with a source URL when available.
3. Include a handful of related-topic links for further reading.

            ## Example

            "lobehub" -> a short abstract plus related links.

            ## Tool

            This skill is backed by `tool.py` in this folder and registered as the callable tool `web_search`. Agents with this skill enabled can invoke it automatically during a conversation.
