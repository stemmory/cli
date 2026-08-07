#!/usr/bin/env node
// stemmory-cli/scripts/generate-schema-manifest.mjs
//
// Regenerates packages/schema/.parity-manifest.json from the files currently
// on disk in this repo. Run this AFTER re-mirroring packages/schema from the
// product repo (AdyriX/stemmory packages/schema), then commit the updated
// manifest alongside the mirrored files in the same PR. See
// scripts/schema-parity-lib.mjs for exactly what this manifest does and does
// not guarantee.
import { writeFileSync } from "node:fs";

import { MANIFEST_PATH, computeManifest } from "./schema-parity-lib.mjs";

const manifest = computeManifest();
writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${Object.keys(manifest).length} file hashes to ${MANIFEST_PATH}`);
