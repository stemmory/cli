#!/usr/bin/env node
// stemmory-cli/scripts/check-dist-leaks.mjs
//
// Fails (exit 1) if the built `packages/schema/dist` contains an internal
// ticket ID or a private spec/path reference. See dist-leaks-lib.mjs for
// why this has to check the built artifact and not the source: the
// published `dist` was believed to strip comments and does not.
//
// Must run AFTER `pnpm --filter @stemmory/schema build` (or the workspace
// `pnpm build`) — this reads dist/, it does not build it.
import path from "node:path";

import { checkDistLeaks } from "./dist-leaks-lib.mjs";

const DIST_DIR = path.join(import.meta.dirname, "..", "packages", "schema", "dist");

let findingsByFile;
try {
  findingsByFile = checkDistLeaks(DIST_DIR);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Could not read ${DIST_DIR}: ${message}`);
  console.error(`Run "pnpm --filter @stemmory/schema build" first.`);
  process.exit(1);
}

const files = Object.keys(findingsByFile);
if (files.length > 0) {
  console.error("check-dist-leaks: packages/schema's built dist leaks internal references:\n");
  for (const file of files) {
    console.error(`  ${file}:`);
    for (const finding of findingsByFile[file]) console.error(`    - ${finding}`);
  }
  console.error(
    `\nA JSDoc comment attached to an exported symbol survives tsup's bundling into dist/. ` +
      `Reword the source comment to keep the explanation and drop the citation (see ` +
      `RELEASING.md's "Comment-only internal ticket IDs" note), then re-run ` +
      `"pnpm --filter @stemmory/schema build".\n`,
  );
  process.exit(1);
}

console.log("check-dist-leaks: packages/schema/dist is clean.");
