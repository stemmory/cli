#!/usr/bin/env node
// stemmory-cli/scripts/check-schema-parity.mjs
//
// CI parity gate (STEM-74 acceptance criterion). Fails (exit 1) if
// packages/schema's files on disk don't hash-match the committed
// .parity-manifest.json - i.e. someone edited the mirrored schema package
// (or added/removed a file in src/ or fixtures/) without regenerating the
// manifest via `pnpm schema:parity:update`. See schema-parity-lib.mjs for
// the honest scope of what this catches.
import { computeManifest, readCommittedManifest } from "./schema-parity-lib.mjs";

const actual = computeManifest();
let committed;
try {
  committed = readCommittedManifest();
} catch (error) {
  console.error(`Could not read the committed manifest: ${error.message}`);
  console.error(`Run "pnpm schema:parity:update" and commit the result.`);
  process.exit(1);
}

const allPaths = new Set([...Object.keys(actual), ...Object.keys(committed)]);
const drift = [];

for (const relPath of [...allPaths].sort()) {
  const actualHash = actual[relPath];
  const committedHash = committed[relPath];
  if (actualHash === undefined) {
    drift.push(`removed on disk but still in manifest: ${relPath}`);
  } else if (committedHash === undefined) {
    drift.push(`present on disk but missing from manifest: ${relPath}`);
  } else if (actualHash !== committedHash) {
    drift.push(`content changed: ${relPath}`);
  }
}

if (drift.length > 0) {
  console.error("Schema parity check failed - packages/schema has drifted from its manifest:\n");
  for (const line of drift) console.error(`  - ${line}`);
  console.error(
    `\nIf this drift is intentional (re-mirrored from the product repo, or a deliberate local ` +
      `change), run "pnpm schema:parity:update" and commit the regenerated manifest.\n`,
  );
  process.exit(1);
}

console.log(`Schema parity OK - ${Object.keys(actual).length} files match the committed manifest.`);
