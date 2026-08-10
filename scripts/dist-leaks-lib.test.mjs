// stemmory-cli/scripts/dist-leaks-lib.test.mjs
//
// Mutation-style coverage for findLeaks/checkDistLeaks: each test plants
// exactly the kind of reference that reached dist/index.d.ts before this
// check existed (STEM-84's ticket id + reconcile.ts, DATA_MODEL.md,
// AGENT_CONVENTIONS_KIT_SPEC.md) and asserts the check fails closed on it.
// Uses node:test + node:assert against throwaway text/dirs, same reasoning
// as schema-parity-lib.test.mjs: scripts/ isn't a workspace package.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { checkDistLeaks, findLeaks } from "./dist-leaks-lib.mjs";

test("baseline: clean text has no findings", () => {
  assert.deepEqual(findLeaks("export function parseDoc() { return null; }"), []);
});

test("mutation: a ticket id is detected", () => {
  const findings = findLeaks("/** STEM-84's Conformance panel is the first consumer. */");
  assert.ok(findings.some((f) => f.includes("STEM-84")), `expected a STEM-84 finding, got: ${findings}`);
});

test("mutation: multiple ticket ids are each reported", () => {
  const findings = findLeaks("STEM-1 and STEM-2 both appear here");
  assert.equal(findings.filter((f) => f.includes("ticket id")).length, 2);
});

test("mutation: a private spec filename is detected", () => {
  const findings = findLeaks("/** DATA_MODEL.md `node_status` enum. */");
  assert.ok(findings.some((f) => f.includes("DATA_MODEL.md")));
});

test("mutation: a private repo path is detected", () => {
  const findings = findLeaks("Carried through unused by `reconcile.ts` today");
  assert.ok(findings.some((f) => f.includes("reconcile.ts")));
});

test("clean text with an unrelated ALL-CAPS-ish word is not a false positive", () => {
  assert.deepEqual(findLeaks("STATUS_AUTHORITY and CONVENTIONS_ARE_GOOD are not real citations"), []);
});

test("checkDistLeaks: clean dist/ reports no findings", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "stemmory-dist-leaks-test-"));
  writeFileSync(path.join(dir, "index.js"), "export function f() {}\n");
  writeFileSync(path.join(dir, "index.d.ts"), "export declare function f(): void;\n");
  assert.deepEqual(checkDistLeaks(dir), {});
  rmSync(dir, { recursive: true, force: true });
});

test("checkDistLeaks: a leak planted in either file is reported under that file", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "stemmory-dist-leaks-test-"));
  writeFileSync(path.join(dir, "index.js"), "// AGENT_CONVENTIONS_KIT_SPEC.md §2.4\nexport function f() {}\n");
  writeFileSync(path.join(dir, "index.d.ts"), "export declare function f(): void;\n");
  const result = checkDistLeaks(dir);
  assert.ok("index.js" in result);
  assert.ok(!("index.d.ts" in result));
  rmSync(dir, { recursive: true, force: true });
});

test("checkDistLeaks: throws a helpful error when dist/ doesn't exist", () => {
  assert.throws(() => checkDistLeaks(path.join(tmpdir(), "stemmory-dist-leaks-does-not-exist")));
});
