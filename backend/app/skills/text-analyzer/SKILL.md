---
slug: text-analyzer
name: Text Analyzer
icon: 🔤
category: productivity
author: Agent Marketplace
functional: true
tool_key: text_counter
---
            Counts words, characters, and sentences in any block of text.

            ## Instructions

            1. Count total characters as given.
2. Split on whitespace to count words.
3. Split on sentence-ending punctuation (./!/?) to count sentences, ignoring empty fragments.

            ## Example

            "Hello there. How are you?" -> 24 characters, 5 words, 2 sentences.

            ## Tool

            This skill is backed by `tool.py` in this folder and registered as the callable tool `text_counter`. Agents with this skill enabled can invoke it automatically during a conversation.
