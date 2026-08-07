// stemmory-cli/scripts/schema-parity-lib.mjs
//
// Shared logic for the schema parity check (STEM-74). `packages/schema` is a
// byte-for-byte mirror of `AdyriX/stemmory`'s private `packages/schema` — but
// this repo is public and that repo is private, so CI here has no way to
// reach it and diff directly. What this DOES check: the committed
// `packages/schema/.parity-manifest.json` (a sha256 per mirrored file,
// generated at mirror time — see `generate-schema-manifest.mjs`) still
// matches the files actually on disk in THIS repo. That catches an
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
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const SCHEMA_DIR = path.join(import.meta.dirname, "..", "packages", "schema");
export const MANIFEST_PATH = path.join(SCHEMA_DIR, ".parity-manifest.json");

// The mirrored surface: source + fixtures. Package metadata (package.json,
// tsconfig.json, vitest.config.ts) is intentionally excluded — those are
// this repo's own workspace wiring, not part of what's mirrored from the
// product repo's package.
const MIRRORED_SUBDIRS = ["src", "fixtures"];

/** @returns {string[]} repo-relative (to packages/schema) paths, sorted. */
function listFiles(subdir) {
  const dir = path.join(SCHEMA_DIR, subdir);
  return readdirSync(dir)
    .filter((f) => statSync(path.join(dir, f)).isFile())
    .map((f) => `${subdir}/${f}`)
    .sort();
}

/** @returns {Record<string, string>} relative path -> sha256 hex digest. */
export function computeManifest() {
  /** @type {Record<string, string>} */
  const manifest = {};
  for (const subdir of MIRRORED_SUBDIRS) {
    for (const relPath of listFiles(subdir)) {
      const content = readFileSync(path.join(SCHEMA_DIR, relPath));
      manifest[relPath] = createHash("sha256").update(content).digest("hex");
    }
  }
  return manifest;
}

export function readCommittedManifest() {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}
