// stemmory-cli/scripts/schema-parity-lib.mjs
//
// Shared logic for the schema parity check (STEM-74). `packages/schema` is a
// byte-for-byte mirror of the Stemmory product repo's private
// `packages/schema` — but this repo is public and that one is not, so CI
// here has no way to reach it and diff directly. What this DOES check: the
// committed `packages/schema/.parity-manifest.json` (a sha256 per mirrored
// file, generated at mirror time — see `generate-schema-manifest.mjs`)
// still matches the files actually on disk in THIS repo. That catches an
// accidental or unreviewed edit to the mirrored source landing without
// updating the manifest alongside it.
//
// What it does NOT catch: the product repo's `packages/schema` changing
// after today and nobody re-mirroring here. There is no automated bridge
// between the two repos (by design - this repo is public, that one is not).
// Closing that gap requires a human (or a scheduled job with access to both
// repos) to re-run `pnpm schema:parity:update` against a fresh checkout of
// the product repo and commit the result.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const SCHEMA_DIR = path.join(import.meta.dirname, "..", "packages", "schema");
export const MANIFEST_PATH = path.join(SCHEMA_DIR, ".parity-manifest.json");

// The mirrored surface: source + fixtures. Package metadata (package.json,
// tsconfig.json, vitest.config.ts) is intentionally excluded — those are
// this repo's own workspace wiring, not part of what's mirrored from the
// product repo's package.
const MIRRORED_SUBDIRS = ["src", "fixtures"];

/**
 * Recursively lists files under `dir`, as `/`-joined paths relative to
 * `dir`. MUST be recursive: a non-recursive `readdirSync` silently drops
 * any file inside a subdirectory, which means an entire unmirrored
 * subdirectory (or a nested addition the product repo makes later) can
 * land with the parity gate reporting green. See schema-parity-lib.test.mjs
 * for the regression test.
 * @param {string} dir
 * @returns {string[]}
 */
function listFilesRecursive(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath ?? entry.path, entry.name)))
    .map((relPath) => relPath.split(path.sep).join("/"))
    .sort();
}

/**
 * Builds a manifest (relative path -> sha256 hex digest) for `subdirs` under
 * `baseDir`. Exported separately from `computeManifest` so tests can point
 * it at a throwaway fixture directory instead of the real
 * `packages/schema`.
 * @param {string} baseDir
 * @param {string[]} [subdirs]
 * @returns {Record<string, string>}
 */
export function buildManifest(baseDir, subdirs = MIRRORED_SUBDIRS) {
  /** @type {Record<string, string>} */
  const manifest = {};
  for (const subdir of subdirs) {
    const dir = path.join(baseDir, subdir);
    for (const relPath of listFilesRecursive(dir)) {
      const content = readFileSync(path.join(dir, relPath));
      manifest[`${subdir}/${relPath}`] = createHash("sha256").update(content).digest("hex");
    }
  }
  return manifest;
}

/** @returns {Record<string, string>} the real packages/schema manifest, as it exists on disk right now. */
export function computeManifest() {
  return buildManifest(SCHEMA_DIR);
}

export function readCommittedManifest() {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}
