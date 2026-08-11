---
slug: changelog-writer
name: Changelog Writer
icon: 📜
category: dev-tools
author: Agent Marketplace
functional: false
tool_key: null
---
            Turns a list of commits or changes into a readable changelog entry.

            ## Instructions

            1. Group the given commits/changes by type: Added, Fixed, Changed, Removed.
2. Rewrite each into a short, user-facing sentence - not raw commit text.
3. Order groups consistently and list newest or most impactful changes first within each.
4. Skip internal-only changes (refactors, tests) unless a full technical log is wanted.

            ## Example

            Commits -> 'Added: dark mode toggle. Fixed: crash when uploading empty files.'

            ## Tool

            This skill has no code implementation yet. When an agent has it enabled, the instructions above are injected into the model's context as guidance to follow.
