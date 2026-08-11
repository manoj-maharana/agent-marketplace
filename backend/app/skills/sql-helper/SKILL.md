---
slug: sql-helper
name: SQL Helper
icon: 🗄️
category: data
author: Agent Marketplace
functional: false
tool_key: null
---
            Drafts and explains SQL queries from a plain-English request.

            ## Instructions

            1. Identify the tables and columns implied by the request.
2. Draft the simplest query that answers it - avoid unnecessary joins or subqueries.
3. Add a one-line plain-English explanation of what the query does.
4. Note any assumption made about table/column names since they weren't given exactly.

            ## Example

            'Users who signed up this month' -> `SELECT * FROM users WHERE signup_date >= date_trunc('month', now());`

            ## Tool

            This skill has no code implementation yet. When an agent has it enabled, the instructions above are injected into the model's context as guidance to follow.
