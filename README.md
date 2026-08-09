# stemmory

The Stemmory Conventions Kit — a CLI, an `AGENTS.md` fragment, and an agent skill that keep your feature docs and decisions well-formed as you build. It's useful entirely on its own, with **zero Stemmory account required**.

## Install

```bash
npx stemmory init
```

This installs the `stemmory-conventions` skill and a small, delimited `AGENTS.md` fragment into your project, and writes `.stemmory/config.json`. From there, your coding agent writes feature docs at `docs/features/<slug>.md` with valid frontmatter and dated decision records — structure you keep whether or not you ever connect Stemmory.

```bash
stemmory lint     # validate docs/features/*.md against schema v1, CI-friendly exit codes
stemmory update   # refresh the installed skill + fragment in place
```

Works fully offline (after the npm fetch) and adds no telemetry.

## Why

Stemmory's conventions are open and useful on their own: organizing feature docs and decisions locally is standalone value, no account needed. Once you've got clean, structured docs accumulating, connect them to Stemmory to **see it as a live map** — the graph is the paid render of what the kit already maintains.

## Packages

- [`packages/cli`](packages/cli) — publishes [`stemmory`](https://www.npmjs.com/package/stemmory) (bin: `stemmory`): `init`, `lint`, and `update`.
- [`packages/schema`](packages/schema) — publishes `@stemmory/schema`, the frontmatter schema v1 validator. Mirrored from the private product repo's `packages/schema` — see [`scripts/check-schema-parity.mjs`](scripts/check-schema-parity.mjs) for how that mirror is kept honest.

## Development

Requires Node ≥ 20 and pnpm 9.

```bash
pnpm install
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run schema:parity   # verifies packages/schema matches its committed manifest
```

## License

MIT — see [LICENSE](LICENSE).
