// stemmory-cli/packages/cli/src/commands/lint.test.js
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseDoc } from "@stemmory/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runInit } from "./init.js";
import { lintOne, runLint } from "./lint.js";

// `status: planned` is the one value the GitHub-ingest clamp (parse-doc.ts,
// DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST) passes through warn-free - every
// other value (idea/building/shipped/paused) warns. Using "planned" here
// keeps this fixture genuinely clean; the clamp's warning behaviour itself
// is covered below by the differential test and by packages/schema's own
// "status-building.md" fixture, not duplicated as a hand-picked case here
// (STEM-86 review finding 1 - that was exactly the blind spot).
const CLEAN_DOC = `---
schema: 1
slug: share-links
title: Public share links
status: planned
owner: vamsi
updated: 2026-08-06
links: []
---

## Why
Because.
`;

const WARNING_DOC = `---
feature: legacy-alias
title: Legacy Alias Doc
---

## Why
Uses the legacy "feature:" key instead of "slug:" - warns, doesn't fail.
`;

const ERROR_DOC_MISSING_TITLE = `---
slug: broken-doc
---

## Why
No title at all.
`;

const ERROR_DOC_INVALID_SLUG = `---
slug: Not Valid Slug!
title: Bad Slug
---
`;

const NO_FRONTMATTER_DOC = `# Just a note

No frontmatter block here at all.
`;

const NO_SLUG_DOC = `---
title: No Slug Key
---

Has frontmatter but no slug/feature key.
`;

/** @param {string} dir @param {string} name @param {string} content */
function writeDoc(dir, name, content) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), content);
}

describe("runLint", () => {
  /** @type {string} */
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "stemmory-lint-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("exits 0 with no docs directory content beyond a clean doc", () => {
    writeDoc(path.join(dir, "docs", "features"), "share-links.md", CLEAN_DOC);
    const result = runLint(dir, []);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("1 doc checked");
    expect(result.stdout).toContain("1 clean");
    expect(result.stderr).toBe("");
  });

  it("exits 0 (not a failure) for a doc that parses with warnings, and reports the warning", () => {
    writeDoc(path.join(dir, "docs", "features"), "legacy.md", WARNING_DOC);
    const result = runLint(dir, []);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("WARN");
    expect(result.stdout).toContain("legacy.md");
    expect(result.stdout).toMatch(/legacy "feature:" key/);
    expect(result.stdout).toContain("1 with warnings");
  });

  it("exits 1 for a doc with a hard schema error, naming the file, field, and fix", () => {
    writeDoc(path.join(dir, "docs", "features"), "broken-doc.md", ERROR_DOC_MISSING_TITLE);
    const result = runLint(dir, []);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("ERROR");
    expect(result.stdout).toContain("broken-doc.md");
    expect(result.stdout).toContain("[title]");
    expect(result.stdout).toMatch(/add "title:/);
  });

  it("exits 1 for an invalid slug, naming the grammar fix", () => {
    writeDoc(path.join(dir, "docs", "features"), "bad.md", ERROR_DOC_INVALID_SLUG);
    const result = runLint(dir, []);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("[slug]");
    expect(result.stdout).toMatch(/lowercase a-z0-9/);
  });

  it("a mix of clean, warning, and error docs: exit 1, all three counted", () => {
    const featuresDir = path.join(dir, "docs", "features");
    writeDoc(featuresDir, "clean.md", CLEAN_DOC);
    writeDoc(featuresDir, "warn.md", WARNING_DOC);
    writeDoc(featuresDir, "error.md", ERROR_DOC_MISSING_TITLE);
    const result = runLint(dir, []);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("1 clean");
    expect(result.stdout).toContain("1 with warnings");
    expect(result.stdout).toContain("1 with errors");
  });

  it("silently skips README.md - not counted as a doc, not an error", () => {
    const featuresDir = path.join(dir, "docs", "features");
    writeDoc(featuresDir, "clean.md", CLEAN_DOC);
    writeDoc(featuresDir, "README.md", "# Feature docs\n\nSee each file for details.\n");
    const result = runLint(dir, []);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("1 doc checked");
    expect(result.stdout).not.toContain("README");
  });

  it("silently skips a file with no frontmatter block at all", () => {
    const featuresDir = path.join(dir, "docs", "features");
    writeDoc(featuresDir, "note.md", NO_FRONTMATTER_DOC);
    const result = runLint(dir, []);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("0 docs checked");
    expect(result.stdout).toContain("1 skipped");
  });

  it("silently skips a file whose frontmatter has no slug/feature key", () => {
    const featuresDir = path.join(dir, "docs", "features");
    writeDoc(featuresDir, "no-slug.md", NO_SLUG_DOC);
    const result = runLint(dir, []);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("1 skipped");
  });

  it("exits 3 when the docs directory does not exist at all", () => {
    const result = runLint(dir, []);
    expect(result.exitCode).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("could not read");
    expect(result.stderr).toContain("docs/features");
  });

  it("exits 3 when the resolved docs path is a file, not a directory", () => {
    writeFileSync(path.join(dir, "docs-file"), "not a directory");
    const result = runLint(dir, ["docs-file"]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("not a directory");
  });

  it("reads docsDir from .stemmory/config.json when present", () => {
    runInit(dir, ["--docs-dir", "documentation/features"]);
    writeDoc(path.join(dir, "documentation", "features"), "share-links.md", CLEAN_DOC);
    const result = runLint(dir, []);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("documentation/features");
  });

  it("a positional path argument overrides config.json", () => {
    runInit(dir, ["--docs-dir", "documentation/features"]);
    writeDoc(path.join(dir, "other-docs"), "share-links.md", CLEAN_DOC);
    const result = runLint(dir, ["other-docs"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("other-docs");
  });

  it("--docs-dir overrides both config.json and a positional argument", () => {
    runInit(dir, ["--docs-dir", "documentation/features"]);
    writeDoc(path.join(dir, "flag-docs"), "share-links.md", CLEAN_DOC);
    writeDoc(path.join(dir, "positional-docs"), "share-links.md", CLEAN_DOC);
    const result = runLint(dir, ["positional-docs", "--docs-dir", "flag-docs"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("flag-docs");
    expect(result.stdout).not.toContain("positional-docs");
  });

  it("rejects an unknown flag with exit 2", () => {
    const result = runLint(dir, ["--nope"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--nope");
  });

  it("rejects more than one positional argument with exit 2", () => {
    const result = runLint(dir, ["a", "b"]);
    expect(result.exitCode).toBe(2);
  });

  it("rejects a --docs-dir value that could break out of a template, exit 2", () => {
    const result = runLint(dir, ["--docs-dir", "docs\n<script>"]);
    expect(result.exitCode).toBe(2);
  });

  it("exits 0 with zero docs found in an existing, empty docs directory", () => {
    mkdirSync(path.join(dir, "docs", "features"), { recursive: true });
    const result = runLint(dir, []);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("0 docs checked");
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "exits 3 (not 1) when a doc file can't be read due to permissions",
    () => {
      const featuresDir = path.join(dir, "docs", "features");
      writeDoc(featuresDir, "locked.md", CLEAN_DOC);
      chmodSync(path.join(featuresDir, "locked.md"), 0o000);
      try {
        const result = runLint(dir, []);
        expect(result.exitCode).toBe(3);
        expect(result.stderr).toContain("could not read");
        expect(result.stderr).toContain("locked.md");
        // The message must say "reading", never fs-safety.js's write-path
        // wording, and must never leak the absolute path (STEM-86 review
        // finding 3).
        expect(result.stderr).not.toContain("writing");
        expect(result.stderr).not.toContain(dir);
      } finally {
        chmodSync(path.join(featuresDir, "locked.md"), 0o644);
      }
    },
  );

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "exit 3 for an unreadable file still reports docs it already checked (STEM-86 review finding 4)",
    () => {
      const featuresDir = path.join(dir, "docs", "features");
      writeDoc(featuresDir, "clean.md", CLEAN_DOC);
      writeDoc(featuresDir, "broken-doc.md", ERROR_DOC_MISSING_TITLE);
      writeDoc(featuresDir, "locked.md", CLEAN_DOC);
      chmodSync(path.join(featuresDir, "locked.md"), 0o000);
      try {
        const result = runLint(dir, []);
        expect(result.exitCode).toBe(3);
        expect(result.stderr).toContain("locked.md");
        // The already-computed results for the OTHER files must survive -
        // not be thrown away just because one file couldn't be read.
        expect(result.stdout).toContain("ERROR");
        expect(result.stdout).toContain("broken-doc.md");
      } finally {
        chmodSync(path.join(featuresDir, "locked.md"), 0o644);
      }
    },
  );

  describe("recursive scan (STEM-86 review finding 2 - ingest accepts docs at any depth)", () => {
    it("finds a doc nested under a subdirectory", () => {
      const featuresDir = path.join(dir, "docs", "features");
      writeDoc(featuresDir, "top.md", CLEAN_DOC);
      writeDoc(path.join(featuresDir, "auth"), "social-login.md", ERROR_DOC_INVALID_SLUG);
      const result = runLint(dir, []);
      expect(result.stdout).toContain("2 docs checked");
      expect(result.stdout).toContain("docs/features/auth/social-login.md");
      expect(result.exitCode).toBe(1);
    });

    it("finds a doc nested four directories deep", () => {
      const featuresDir = path.join(dir, "docs", "features");
      // A hard error (not the clean doc) so its report line - naming the
      // full path - actually appears in stdout; a clean file prints
      // nothing per-file by design, only in the aggregate count.
      writeDoc(path.join(featuresDir, "a", "b", "c"), "deep.md", ERROR_DOC_INVALID_SLUG);
      const result = runLint(dir, []);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("1 doc checked");
      expect(result.stdout).toContain("docs/features/a/b/c/deep.md");
    });
  });

  describe("symlinks are never followed (STEM-86 review finding 7)", () => {
    it("counts a symlinked .md as skipped, not as a checked doc", () => {
      const featuresDir = path.join(dir, "docs", "features");
      writeDoc(featuresDir, "real.md", CLEAN_DOC);
      const outsideFile = path.join(dir, "outside.md");
      writeFileSync(outsideFile, CLEAN_DOC);
      symlinkSync(outsideFile, path.join(featuresDir, "linked.md"));

      const result = runLint(dir, []);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("1 doc checked");
      expect(result.stdout).toContain("1 skipped (symlink, not followed)");
    });
  });

  describe("cross-file duplicate slugs (STEM-86 review finding 5)", () => {
    it("keeps the first file clean and warns on the second, mirroring reconcile.ts", () => {
      const featuresDir = path.join(dir, "docs", "features");
      const first = CLEAN_DOC; // slug: share-links
      const second = CLEAN_DOC.replace("Public share links", "Duplicate share links");
      writeDoc(featuresDir, "a-first.md", first);
      writeDoc(featuresDir, "b-second.md", second);

      const result = runLint(dir, []);
      expect(result.exitCode).toBe(0); // a warning, not a hard failure
      expect(result.stdout).toContain("1 clean");
      expect(result.stdout).toContain("1 with warnings");
      expect(result.stdout).toMatch(
        /duplicate feature key "share-links": keeping docs\/features\/a-first\.md, ignoring docs\/features\/b-second\.md/,
      );
    });
  });
});

/**
 * Adversarial review finding 6: nothing guarded `lintOne`'s re-composition
 * against drifting from `parseDoc` - the exact gap that let the status-clamp
 * warning (finding 1) go unnoticed by 18 green tests. This asserts, fixture
 * by fixture, that `lintOne`'s verdict and warnings are exactly what
 * `parseDoc` - the function hosted ingest actually calls - produces. Any
 * future re-composition drift fails here first.
 */
describe("lintOne matches parseDoc, fixture by fixture (differential parity guard)", () => {
  const FIXTURES_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "schema",
    "fixtures",
  );
  const SILENT_SKIP_REASONS = new Set(["readme", "no_frontmatter", "no_feature_key"]);
  const fixtureNames = readdirSync(FIXTURES_DIR).filter((name) => name.endsWith(".md"));

  it("found fixtures to compare against (sanity-checks FIXTURES_DIR itself)", () => {
    expect(fixtureNames.length).toBeGreaterThan(10);
  });

  it.each(fixtureNames)("%s", (name) => {
    const content = readFileSync(path.join(FIXTURES_DIR, name), "utf8");
    const relPath = `docs/features/${name}`;

    const authoritative = parseDoc(relPath, content);
    const result = lintOne(relPath, content);

    if (authoritative.ok) {
      expect(result.kind).toBe("ok");
      expect(result.kind === "ok" && result.slug).toBe(authoritative.doc.slug);
      expect(result.kind === "ok" && result.warnings).toEqual(authoritative.warnings);
    } else if (SILENT_SKIP_REASONS.has(authoritative.skip)) {
      expect(result.kind).toBe("skip");
    } else {
      expect(result.kind).toBe("error");
    }
  });
});
