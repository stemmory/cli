// stemmory-cli/scripts/dist-leaks-lib.mjs
//
// Shared logic for the dist-leak check (STEM-105 follow-up). The published
// `@stemmory/schema` build was believed to strip comments — RELEASING.md's
// "accepted as-is" note on comment-only ticket IDs and spec-doc citations
// leaned on that belief for this package. It is false: `tsup ... --dts`
// preserves JSDoc comments attached to exported symbols (and some
// object-literal-property comments) in both `dist/index.js` and
// `dist/index.d.ts`. Verified against the published 0.1.1: 24 comment lines
// in `dist/index.js`, 41 in `dist/index.d.ts`, several citing
// `DATA_MODEL.md`, `reconcile.ts`, and an internal ticket ID.
//
// This checks the BUILT ARTIFACT, not the source — source comments citing
// internal tickets/docs are a separate, accepted-as-is question (see
// RELEASING.md). What must never happen is one of those citations reaching
// something actually published to npm.
import { readFileSync } from "node:fs";

/** Same list `packages/schema/src/fixtures.test.ts` checks against emitted warnings. */
export const PRIVATE_SPEC_NAMES = [
  "AGENT_CONVENTIONS_KIT_SPEC.md",
  "ARCHITECTURE_AND_SYNC_SPEC.md",
  "CONVENTIONS.md",
  "ONBOARDING_IMPORT_SPEC.md",
  "DATA_MODEL.md",
  "BUILD_AUDIT.md",
];

/** Private product-repo file/path references that have no business in a public dist. */
export const PRIVATE_PATH_FRAGMENTS = ["reconcile.ts", "apps/web"];

const TICKET_ID_RE = /\bSTEM-\d+\b/g;

/**
 * Scans `text` for internal ticket IDs and private spec/path references.
 * @param {string} text
 * @returns {string[]} one human-readable finding per match, empty if clean.
 */
export function findLeaks(text) {
  /** @type {string[]} */
  const findings = [];
  for (const match of text.matchAll(TICKET_ID_RE)) {
    findings.push(`internal ticket id "${match[0]}"`);
  }
  for (const name of PRIVATE_SPEC_NAMES) {
    if (text.includes(name)) findings.push(`private spec filename "${name}"`);
  }
  for (const fragment of PRIVATE_PATH_FRAGMENTS) {
    if (text.includes(fragment)) findings.push(`private repo path "${fragment}"`);
  }
  return findings;
}

/**
 * Reads `dist/index.js` and `dist/index.d.ts` under `distDir` and returns a
 * map of relative filename -> findings, for files that have any. Empty
 * object means clean. Throws if `distDir` doesn't contain a built dist
 * (caller's job to give a helpful message — see check-dist-leaks.mjs).
 * @param {string} distDir
 * @returns {Record<string, string[]>}
 */
export function checkDistLeaks(distDir) {
  /** @type {Record<string, string[]>} */
  const result = {};
  for (const file of ["index.js", "index.d.ts"]) {
    const text = readFileSync(`${distDir}/${file}`, "utf8");
    const findings = findLeaks(text);
    if (findings.length > 0) result[file] = findings;
  }
  return result;
}
