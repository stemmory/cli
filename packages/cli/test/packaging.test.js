// stemmory-cli/packages/cli/test/packaging.test.js
//
// What ships to npm is not what `files` says if the two packers disagree
// about it — and they do.
//
// v0.1.0 shipped 8 test files that the allowlist meant to exclude. `files`
// carried `"!src/lib/**/*.test.js"` negations; npm honours those, pnpm
// ignores them entirely (verified against three different negation patterns,
// all ignored). The release ran `pnpm publish`, so the negations did nothing
// and the tests went to the registry.
//
// Fixed structurally rather than by finding a pattern pnpm respects: tests
// moved out of `src/`, so `files: ["bin/stemmory.js", "src"]` needs no
// negation at all and both packers agree by construction.
//
// These tests pin that, because the failure is invisible locally — `pnpm
// test` passes either way, and you only see it by unpacking a tarball.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const PKG_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(PKG_DIR, "package.json"), "utf8"));

describe("what gets packed does not depend on which packer runs", () => {
  it("uses no negation patterns in `files` — pnpm ignores them", () => {
    const negations = (pkg.files ?? []).filter((p) => p.startsWith("!"));
    expect(
      negations,
      "pnpm silently ignores `!` entries in `files`, so anything they exclude " +
        "still ships when the release runs through pnpm. Exclude by layout " +
        "instead: keep non-shipping files out of the included directories.",
    ).toEqual([]);
  });

  it("ships no test files, whichever packer is used", () => {
    // Belt and braces: even without negations, a test placed back under src/
    // would ship. This asserts the layout invariant directly.
    const shipped = (pkg.files ?? []).join(" ");
    expect(shipped).not.toMatch(/test/i);
  });
});
