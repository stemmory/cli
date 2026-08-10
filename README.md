<div align="center">

# Stemmory Conventions Kit

**Keep your feature docs and decisions well-formed — for humans and coding agents alike.**

[![npm](https://img.shields.io/npm/v/stemmory?color=0b7285)](https://www.npmjs.com/package/stemmory)
[![CI](https://github.com/stemmory/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/stemmory/cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

</div>

---

A small CLI, an agent skill, and an `AGENTS.md` fragment that give your project one
consistent shape for feature documentation — then check that it stays that way.

Runs **fully offline**, sends **no telemetry**, and needs **no account**.

```bash
npx stemmory init
```

## Why this exists

Coding agents write docs. Left alone, each one invents its own format — and six
months later nothing can read the pile programmatically, including the next agent.

The kit fixes the shape once: every feature gets a doc at
`docs/features/<slug>.md` with validated frontmatter and dated decision records.
Your agent writes them, `stemmory lint` keeps them honest in CI, and the result is
useful on its own — a readable, greppable, diffable record of what you built and why.

If you later connect [Stemmory](https://stemmory.com), that same structure renders
as a live map of your project. The kit doesn't depend on it.

## Quick start

```bash
# Install the skill, the AGENTS.md fragment, and .stemmory/config.json
npx stemmory init

# Validate your feature docs — CI-friendly exit codes
npx stemmory lint

# Refresh the installed skill + fragment after upgrading
npx stemmory update
```

`init` is idempotent and writes inside clearly delimited markers, so re-running it
never clobbers your own `AGENTS.md` content.

## What a feature doc looks like

```markdown
---
schema: 1
slug: share-links
title: Public share links
status: planned
owner: alex
updated: 2026-08-06
linear_team: ENG
links: PR#42
---

## Why
Customers want to show a read-only view to people without accounts.

## Decisions
- 2026-08-04 — Links expire after 30 days by default — because an
  indefinitely-live link is a support burden nobody remembers creating.
```

`slug`, `title` and `status` are required; everything else is optional and warns
rather than fails when missing. Decision lines use a
`date — what — because — why` grammar so the reasoning survives the person.

## Commands

| Command | What it does |
| --- | --- |
| `stemmory init` | Installs the conventions skill, the `AGENTS.md` fragment, and `.stemmory/config.json` |
| `stemmory lint [path]` | Validates `docs/features/*.md` against schema v1 |
| `stemmory update` | Refreshes the installed skill and fragment in place |

Useful flags: `--docs-dir <dir>`, `--linear-team <key>`,
`--agent <claude\|generic>` (`generic` writes the fragment only, no skill).
Run `npx stemmory --help` for the full list.

The table lists the commands themselves; prefix them with `npx` unless you
installed globally. A local install puts the binary in `node_modules/.bin/`,
which is not on your `PATH`, so a bare `stemmory lint` gives `command not
found`:

| | Command | Bare `stemmory` works? |
| --- | --- | --- |
| No install | `npx stemmory lint` | — |
| Project dependency | `npm i -D stemmory`, then `npx stemmory lint` or an npm script | no (use `npx`) |
| Global | `npm i -g stemmory`, then `stemmory lint` | yes |

For CI, prefer the project dependency: the version is pinned in your lockfile,
so the linter cannot change under you between runs.

### Lint exit codes

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

## Packages

| Package | Description |
| --- | --- |
| [`packages/cli`](packages/cli) | [`stemmory`](https://www.npmjs.com/package/stemmory) — the `init` / `lint` / `update` CLI |
| [`packages/schema`](packages/schema) | [`@stemmory/schema`](https://www.npmjs.com/package/@stemmory/schema) — the frontmatter v1 grammar and validator |

`@stemmory/schema` is the single definition of what a valid doc is. The hosted
product validates with the same package, so a doc that lints clean locally is read
the same way everywhere. [`scripts/check-schema-parity.mjs`](scripts/check-schema-parity.mjs)
guards that the copy in this repo matches its committed manifest.

## Development

Requires **Node ≥ 20** and **pnpm 9**.

```bash
pnpm install
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run schema:parity   # packages/schema matches its committed manifest
```

### Branching

`main` is the trunk and always releasable. Work happens on short-lived branches
that merge back via PR; releases are git tags on `main`, which is what triggers
publishing. There are no long-lived release branches — those only earn their keep
once multiple major versions need support in parallel.

### Git hooks (optional)

A pre-commit hook runs the repository's secret scan before a commit is created,
so a credential-shaped string never leaves your machine:

```bash
git config core.hooksPath .githooks
```

## Contributing

Issues and pull requests are welcome. Please make sure `pnpm run typecheck`,
`pnpm run lint` and `pnpm run test` pass, and add a test alongside any behaviour
change — including one that fails without your fix.

## License

MIT — see [LICENSE](LICENSE).
