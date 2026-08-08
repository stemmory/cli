// stemmory-cli/packages/cli/src/commands/lint.test.js
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runInit } from "./init.js";
import { runLint } from "./lint.js";

const CLEAN_DOC = `---
schema: 1
slug: share-links
title: Public share links
status: building
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
      } finally {
        chmodSync(path.join(featuresDir, "locked.md"), 0o644);
      }
    },
  );
});
