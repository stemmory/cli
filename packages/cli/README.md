# stemmory

**Keep your feature docs and decisions well-formed — for humans and coding agents alike.**

[![npm](https://img.shields.io/npm/v/stemmory?color=0b7285)](https://www.npmjs.com/package/stemmory)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

The Stemmory Conventions Kit CLI. Installs an agent skill and an `AGENTS.md`
fragment into your project, then validates the feature docs your agent writes.

Runs **fully offline**, sends **no telemetry**, and needs **no account**.

```bash
npx stemmory init
```

## Why

Coding agents write docs. Left alone, each one invents its own format — and six
months later nothing can read the pile programmatically, including the next agent.

This fixes the shape once: every feature gets a doc at `docs/features/<slug>.md`
with validated frontmatter and dated decision records. Your agent writes them,
`stemmory lint` keeps them honest in CI.

## Usage

```bash
npx stemmory init      # install skill + AGENTS.md fragment + .stemmory/config.json
stemmory lint          # validate docs/features/*.md against schema v1
stemmory update        # refresh the installed skill + fragment in place
stemmory --help
```

`init` is idempotent and writes inside clearly delimited markers, so re-running it
never clobbers your own `AGENTS.md` content.

Useful flags: `--docs-dir <dir>`, `--linear-team <key>`,
`--agent <claude|generic>` (`generic` writes the fragment only, no skill install).

## What a feature doc looks like

```markdown
---
schema: 1
slug: share-links
title: Public share links
status: planned
owner: alex
updated: 2026-08-06
---

## Why
Customers want to show a read-only view to people without accounts.

## Decisions
- 2026-08-04 — Links expire after 30 days by default — because an
  indefinitely-live link is a support burden nobody remembers creating.
```

`slug`, `title` and `status` are required; everything else is optional and warns
rather than fails when missing.

## Lint exit codes

Designed to be dropped straight into CI:

| Code | Meaning |
| --- | --- |
| `0` | Clean — every doc valid (warnings don't fail the run) |
| `1` | One or more docs failed validation |
| `2` | Bad command-line usage |
| `3` | Could not read a directory, a file, or `.stemmory/config.json` |

```yaml
- run: npx stemmory lint
```

## Related

- [`@stemmory/schema`](https://www.npmjs.com/package/@stemmory/schema) — the
  frontmatter v1 grammar and validator this CLI uses. The hosted product validates
  with the same package, so a doc that lints clean locally is read the same way
  everywhere.
- [stemmory/cli](https://github.com/stemmory/cli) — source, issues, contributing.

## Requirements

Node ≥ 20.

## License

MIT — see [LICENSE](LICENSE).
