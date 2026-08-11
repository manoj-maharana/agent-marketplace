---
slug: color-palette-generator
name: Color Palette Generator
icon: 🎭
category: creative
author: Agent Marketplace
functional: true
tool_key: color_palette_generator
---
            Proposes a harmonious color palette from a mood or brand description.

            ## Instructions

            1. Hash the description into a deterministic base hue.
2. Derive 5 hues/saturations/lightnesses around it for a balanced palette.
3. Return each color as a hex code.

            ## Example

            'calm ocean morning' -> a 5-color palette of hex codes built around one base hue.

            ## Tool

            This skill is backed by `tool.py` in this folder and registered as the callable tool `color_palette_generator`. Agents with this skill enabled can invoke it automatically during a conversation.
