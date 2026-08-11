---
slug: csv-explorer
name: CSV Explorer
icon: 📊
category: data
author: Agent Marketplace
functional: true
tool_key: csv_explorer
---
            Describes columns, types, and quick stats for a pasted CSV sample.

            ## Instructions

            1. Parse the CSV text with a header row.
2. For each column, infer whether it's numeric (with min/max) or text (with distinct values or a sample).
3. Return row count, per-column stats, and a few sample rows.

            ## Example

            A 3-column CSV -> row_count, per-column type/stat breakdown, and 3 sample rows.

            ## Tool

            This skill is backed by `tool.py` in this folder and registered as the callable tool `csv_explorer`. Agents with this skill enabled can invoke it automatically during a conversation.
