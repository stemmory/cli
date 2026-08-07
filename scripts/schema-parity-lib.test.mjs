// stemmory-cli/scripts/schema-parity-lib.test.mjs
//
// The parity gate (check-schema-parity.mjs) is the headline safety
// mechanism for STEM-74's acceptance criteria and, before this file, was
// the only piece of code in the repo with zero automated coverage. Each
// test below is one row of the tamper table an adversarial review ran by
// hand against packages/schema: content edit, add, remove, and — the one
// the hand-rolled non-recursive version of `listFilesRecursive` missed
// entirely — a file added inside a NEW subdirectory.
//
// Uses node:test + node:assert (stdlib) against a throwaway fixture
// directory, not vitest: scripts/ isn't a workspace package, and pulling in
// a test framework for four checks on ~70 lines of code would be the
// heavier choice, not the lazier one. Run via `pnpm run test:scripts` (see
// root package.json) or `node --test scripts/`.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { buildManifest } from "./schema-parity-lib.mjs";

/** @returns {string} a fresh temp dir shaped like packages/schema (src/ + fixtures/), never the real one. */
function makeFixtureDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "stemmory-parity-test-"));
  mkdirSync(path.join(dir, "src"), { recursive: true });
  mkdirSync(path.join(dir, "fixtures"), { recursive: true });
  writeFileSync(path.join(dir, "src", "a.ts"), "export const a = 1;\n");
  writeFileSync(path.join(dir, "fixtures", "f.md"), "hello\n");
  return dir;
}

/** @type {string} */
let dir;
before(() => {
  dir = makeFixtureDir();
});
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("baseline: lists every file across both mirrored subdirs", () => {
  const manifest = buildManifest(dir);
  assert.deepEqual(Object.keys(manifest).sort(), ["fixtures/f.md", "src/a.ts"]);
});

test("tamper: editing a file's content changes its hash", () => {
  const before_ = buildManifest(dir);
  writeFileSync(path.join(dir, "src", "a.ts"), "export const a = 2;\n");
  const after_ = buildManifest(dir);
  assert.notEqual(before_["src/a.ts"], after_["src/a.ts"]);
  writeFileSync(path.join(dir, "src", "a.ts"), "export const a = 1;\n"); // restore
});

test("tamper: a new top-level file is picked up", () => {
  writeFileSync(path.join(dir, "src", "b.ts"), "export const b = 1;\n");
  const manifest = buildManifest(dir);
  assert.ok("src/b.ts" in manifest, "new file must appear in the manifest");
  rmSync(path.join(dir, "src", "b.ts"));
});

test("tamper: a removed file drops out of the manifest", () => {
  writeFileSync(path.join(dir, "src", "c.ts"), "export const c = 1;\n");
  assert.ok("src/c.ts" in buildManifest(dir));
  rmSync(path.join(dir, "src", "c.ts"));
  assert.ok(!("src/c.ts" in buildManifest(dir)));
});

test("tamper: a file added in a NEW nested subdirectory is NOT silently dropped", () => {
  // This is the exact bug an adversarial review found: a non-recursive
  // readdirSync only lists direct children, so `src/evil/x.ts` never
  // appeared in the manifest and the gate reported "OK".
  mkdirSync(path.join(dir, "src", "evil"), { recursive: true });
  writeFileSync(path.join(dir, "src", "evil", "x.ts"), "export const x = 1;\n");
  const manifest = buildManifest(dir);
  assert.ok("src/evil/x.ts" in manifest, "nested file must appear in the manifest");
  rmSync(path.join(dir, "src", "evil"), { recursive: true, force: true });
});
