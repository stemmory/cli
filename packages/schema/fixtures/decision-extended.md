---
slug: decisions/extended
title: Extended Decision Grammar
---

## Why
Exercises the schema v1 spec's extended decision-line grammar, which carries
an explicit `Alternatives:` segment instead of a `because` clause.

## Decisions
- 2026-07-12 — Use Postgres over DynamoDB — relational queries dominate our access patterns — Alternatives: DynamoDB, MongoDB
