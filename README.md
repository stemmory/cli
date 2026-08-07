# stemmory

The Stemmory Conventions Kit — skill, `AGENTS.md` fragment, and CLI.

## Packages

- [`packages/cli`](packages/cli) — publishes [`stemmory`](https://www.npmjs.com/package/stemmory) (bin: `stemmory`). Scaffold only for now: `stemmory --version` / `--help`. `init`, `update`, and `lint` ship in later stories.
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
