---
slug: keyword-extractor
name: Keyword Extractor
icon: 🏷️
category: research-tools
author: Agent Marketplace
functional: true
tool_key: keyword_extractor
---
            Pulls the most important keywords and phrases out of a block of text.

            ## Instructions

            1. Tokenize the text and lowercase it.
2. Filter out common stopwords.
3. Rank the remaining words by frequency and return the top N.

            ## Example

            A paragraph about climate policy -> ['climate', 'policy', 'emissions', 'energy', ...].

            ## Tool

            This skill is backed by `tool.py` in this folder and registered as the callable tool `keyword_extractor`. Agents with this skill enabled can invoke it automatically during a conversation.
