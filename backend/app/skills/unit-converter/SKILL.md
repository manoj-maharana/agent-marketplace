---
slug: unit-converter
name: Unit Converter
icon: 📐
category: productivity
author: Agent Marketplace
functional: true
tool_key: unit_converter
---
            Converts values between length, weight, and temperature units.

            ## Instructions

            1. Read the value, source unit, and target unit.
2. Convert via a shared base unit (meters, kilograms) for length/weight, or the direct formula for temperature.
3. Return the converted value rounded to 4 decimal places, or an error if the units don't match categories.

            ## Example

            `5, km, mi` -> `3.1069 mi`

            ## Tool

            This skill is backed by `tool.py` in this folder and registered as the callable tool `unit_converter`. Agents with this skill enabled can invoke it automatically during a conversation.
