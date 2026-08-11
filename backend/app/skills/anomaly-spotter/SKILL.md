---
slug: anomaly-spotter
name: Anomaly Spotter
icon: 🚨
category: data
author: Agent Marketplace
functional: false
tool_key: null
---
            Flags values in a dataset that look like outliers or errors.

            ## Instructions

            1. Establish the typical range or pattern for the data given.
2. Flag values that clearly fall outside that range.
3. Note why each flagged value looks off (too high, too low, wrong format).
4. Don't flag values just because they're the max/min - only ones that look like errors or true outliers.

            ## Example

            Ages: 24, 31, 29, 412 -> 412 flagged as almost certainly a data entry error.

            ## Tool

            This skill has no code implementation yet. When an agent has it enabled, the instructions above are injected into the model's context as guidance to follow.
