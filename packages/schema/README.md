# @stemmory/schema

[![npm](https://img.shields.io/npm/v/@stemmory/schema?color=0b7285)](https://www.npmjs.com/package/@stemmory/schema)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Frontmatter schema v1 for Stemmory feature docs — the parser and validator for
`docs/features/*.md`.

Validates the frontmatter block (`slug`, `title`, `status`, and the optional
`owner` / `updated` / `linear_team` / `links` fields) and the `## Decisions`
section's dated `date — what — because — why` grammar.

This is the single definition of what a valid feature doc is. The
[`stemmory`](https://www.npmjs.com/package/stemmory) CLI's `lint` command and
the hosted Stemmory ingest both validate with this same package, so a doc that
lints clean locally is read identically everywhere.

## Install

```bash
npm i @stemmory/schema
```

Most people don't need this directly — install the
[`stemmory`](https://www.npmjs.com/package/stemmory) CLI instead. Reach for
this package when you're building your own tooling on the same rules.

## Usage

```js
import { parseDoc } from "@stemmory/schema";

const result = parseDoc("docs/features/share-links.md", source);

if (result.ok) {
  result.doc.slug;        // "share-links"
  result.doc.decisions;   // parsed decision records
  result.warnings;        // advisory — the doc is still valid
} else {
  result.skip;            // why it was not a feature doc, or why it failed
}
```

`parseDoc(path, content)` takes the path as well as the source: the path is
used to decide whether a file is a feature doc at all, and to report where a
problem is. Warnings are advisory — a doc with warnings is still valid.

Other exports include `validateFrontmatterV1`, `parseDecisions`,
`splitFrontmatter`, `isValidSlug`, `DOC_STATUS_VALUES` and
`CURRENT_SCHEMA_VERSION`.

## What a valid doc looks like

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

`slug`, `title` and `status` are required. Everything else is optional and
warns rather than fails when absent.

## Requirements

Node ≥ 20. ESM only.

## License

MIT — see [LICENSE](LICENSE).
