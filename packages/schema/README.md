# @stemmory/schema

Frontmatter schema v1 validator for Stemmory feature docs (`docs/features/*.md`). Parses and validates the `slug`/`title`/`status`/... frontmatter block, the `## Decisions` section grammar, and related helpers.

Consumed by the [`stemmory`](https://www.npmjs.com/package/stemmory) CLI's `lint` command and by the Stemmory product's ingest pipeline, so both sides validate docs with identical rules.

This package is mirrored byte-for-byte from the Stemmory product repo's own `packages/schema` — see [`../../scripts/check-schema-parity.mjs`](../../scripts/check-schema-parity.mjs) in the [stemmory/cli](https://github.com/stemmory/cli) workspace for how that's kept honest.

## License

MIT — see [LICENSE](LICENSE).
