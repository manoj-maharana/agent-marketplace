---
slug: currency-converter
name: Currency Converter
icon: 💱
category: data
author: Agent Marketplace
functional: true
tool_key: currency_converter
---

Converts an amount between currencies using current exchange rates, no API key required.

## Instructions

1. Read the amount, source currency, and target currency.
2. Fetch the current exchange rate between the two.
3. Return the converted amount alongside the rate used.

## Example

"100 USD to EUR" -> converted amount plus the exchange rate used.

## Tool

This skill is backed by `tool.py` in this folder and registered as the callable tool
`currency_converter`, using the free Frankfurter API (European Central Bank rates, no API key
needed). Agents with this skill enabled can invoke it automatically during a conversation.
