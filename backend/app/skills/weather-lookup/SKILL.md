---
slug: weather-lookup
name: Weather Lookup
icon: 🌤️
category: productivity
author: Agent Marketplace
functional: true
tool_key: weather_lookup
---

Looks up the current weather and a short forecast for a named place, no API key required.

## Instructions

1. Geocode the place name to latitude/longitude.
2. Fetch current conditions and a short daily forecast for those coordinates.
3. Return temperature, conditions, and the next couple of days in plain terms.

## Example

"weather in Lisbon" -> current temperature, conditions, and a 2-day outlook for Lisbon, Portugal.

## Tool

This skill is backed by `tool.py` in this folder and registered as the callable tool
`weather_lookup`, using the free Open-Meteo API (no API key needed). Agents with this skill
enabled can invoke it automatically during a conversation.
