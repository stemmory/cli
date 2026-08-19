# Changelog

Both packages in this workspace — [`stemmory`](packages/cli) and
[`@stemmory/schema`](packages/schema) — are released together and share a
version number.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-08-19

### Changed

- **BREAKING: `parseFrontmatterBlock` no longer returns a bare `Map<string, string>`.**
  It now returns `{ fields: Map<string, string>, duplicates: { key, firstLine, line }[] }`.
  `validateFrontmatterV1` takes that same shape instead of a `ReadonlyMap`. Update
  any direct caller from `parseFrontmatterBlock(block).get(key)` to
  `parseFrontmatterBlock(block).fields.get(key)`.

### Fixed

- **Duplicate frontmatter keys (`slug:` twice, `title:` twice, any key) are now
  refused, not silently last-wins** (STEM-111). A rename that leaves two answers
  for one key is not knowable, so `stemmory lint` now reports it as a new
  `duplicate_key` skip reason instead of staying green. Detected on key
  occurrence during the scan — an empty second occurrence (`slug: a` / a bare
  `slug:`) is still caught even though it doesn't change which value parses.
  Only fires for a doc that already resolved a `slug:` (or legacy `feature:`),
  so a doc with no slug at all keeps its existing silent-skip contract.
- **`duplicate_key` now reports a real file line**, not a line relative to the
  frontmatter block, so following a refusal message to an editor lands on the
  offending line.

## [0.1.2] — 2026-08-10

### Fixed

- **`ParsedDoc.schemaVersion` now mirrors the product repo** (STEM-105), so the
  CLI and the hosted ingest agree on what a parsed doc carries. Doc comments and
  `dist`-published references were scrubbed to match.
- CI now checks the built `dist` for leaked internal references
  (`scripts/check-dist-leaks.mjs`).

## [0.1.1] — 2026-08-10

No behaviour changes. Everything here is packaging, provenance and docs — the
result of inspecting what `0.1.0` actually put on the registry rather than
trusting a green publish run.

### Fixed

- **npm provenance now attaches.** `0.1.0` published with no attestation and
  the run was still green: `pnpm publish --provenance` is a no-op on pnpm 9.15
  — the flag is absent from its `--help`, and pnpm accepted it, ignored it,
  and exited 0. Publishing now packs with pnpm and publishes with npm, which
  is the only combination that gets both: `packages/cli` declares
  `"@stemmory/schema": "workspace:*"` and only pnpm rewrites that to a real
  version at pack time, while only npm implements provenance. A verification
  step now fails the release if either package lands without an attestation.
- **Documented why a bare `stemmory` is `command not found`** after a local
  install. The binary lands in `node_modules/.bin/`, which is not on `PATH`.
  Both READMEs now prefix every runnable example with `npx` and spell out the
  three ways to run it. Reported from real use.
- **`stemmory` shipped its own test files.** `files` excluded them with `!`
  negation patterns; npm honours those, **pnpm ignores them entirely** — and
  the release ran through pnpm, so `0.1.0` put 8 test files on the registry.
  Fixed structurally rather than by hunting for a pattern pnpm respects: tests
  moved out of `src/`, so the allowlist is now `["bin/stemmory.js", "src"]`
  and both packers agree by construction. A test pins it, because the failure
  is invisible locally — the suite passes either way and you only see it by
  unpacking a tarball.
- **`@stemmory/schema`'s usage example was wrong.** It showed
  `parseDoc(source)` returning `{ frontmatter, decisions, warnings, errors }`.
  The real signature is `parseDoc(path, content)` returning
  `{ ok, warnings, doc }`. Corrected and verified by running it.

### Changed

- Internal ticket ids, private spec filenames and review-finding numbers
  removed from `stemmory`'s shipped source comments — they were visible on
  npm's code tab and pointed at documents a reader cannot open. Every
  explanation was kept; only the pointers went. `@stemmory/schema` was never
  affected: it ships a bundled `dist` with comments stripped.
- `@stemmory/schema`'s npm description no longer references the private
  product repo or an internal script path.
- Added `keywords` and `author` to both packages, and `engines: node >= 20` to
  `@stemmory/schema`, matching the CLI.
- CI and publish workflows moved off Node 20 actions, which GitHub runners now
  force onto Node 24.

## [0.1.0] — 2026-08-10

First public release.

- `stemmory init` — installs the conventions skill, the `AGENTS.md` fragment
  and `.stemmory/config.json`, idempotently and inside delimited markers.
- `stemmory lint` — validates `docs/features/*.md` against schema v1, with
  CI-friendly exit codes (`0` clean, `1` invalid, `2` usage, `3` unreadable).
- `stemmory update` — refreshes the installed skill and fragment in place.
- `@stemmory/schema` — the frontmatter v1 grammar, validator and decision-line
  parser that both the CLI and the hosted ingest validate with.

Published without provenance attestations; see 0.1.1.

[0.2.0]: https://github.com/stemmory/cli/releases/tag/v0.2.0
[0.1.2]: https://github.com/stemmory/cli/releases/tag/v0.1.2
[0.1.1]: https://github.com/stemmory/cli/releases/tag/v0.1.1
[0.1.0]: https://github.com/stemmory/cli/releases/tag/v0.1.0
