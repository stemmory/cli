// stemmory/packages/schema/src/excerpt.test.ts
//
// STEM-530: the excerpt becomes the first PROSE paragraph — a fenced code
// block is skipped entirely, and a fence also interrupts a paragraph in
// progress (same as a blank line). Everything else about `firstParagraph`
// (heading handling, blank-line breaks, joining, the 500-char cap, `null` for
// no prose) is unchanged — the regression suite at the bottom proves that
// against the real corpus, not just by inspection.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { firstParagraph } from "./excerpt";

describe("firstParagraph — fenced code", () => {
  it("skips a backtick fence that opens the doc, keeps the prose after it", () => {
    const body = "```ts\nconst x = 1;\n```\n\nThe prose paragraph.";
    expect(firstParagraph(body)).toBe("The prose paragraph.");
  });

  it("skips a tilde fence the same way", () => {
    const body = "~~~\ncode\n~~~\n\nThe prose paragraph.";
    expect(firstParagraph(body)).toBe("The prose paragraph.");
  });

  it("skips a fence with an info string", () => {
    const body = "```typescript\nconst x = 1;\n```\n\nProse.";
    expect(firstParagraph(body)).toBe("Prose.");
  });

  it("treats a fence indented up to 3 spaces as a fence", () => {
    const body = "   ```\ncode\n   ```\n\nProse.";
    expect(firstParagraph(body)).toBe("Prose.");
  });

  it("does NOT treat a 4-space indented ``` as a fence (indented code, left alone)", () => {
    // Not a fence, so it is handled by the unchanged paragraph logic — these
    // lines simply become part of the (only) paragraph, same as before.
    const body = "    ```\n    code\n    ```";
    expect(firstParagraph(body)).toBe("``` code ```");
  });

  it("requires a closing fence at least as long as the opener (4-backtick fence survives an inner ``` line)", () => {
    const body = "````\n```\ncode with a triple-backtick line inside\n```\n````\n\nProse.";
    expect(firstParagraph(body)).toBe("Prose.");
  });

  it("an unclosed fence runs to the end of the document — null when nothing precedes it", () => {
    const body = "```ts\nconst x = 1;\nstill in the fence";
    expect(firstParagraph(body)).toBeNull();
  });

  it("prose running straight into a fence with no blank line yields only the prose", () => {
    const body = "Intro:\n```\ncode\n```";
    expect(firstParagraph(body)).toBe("Intro:");
  });

  it("a fence between two prose paragraphs leaves the first paragraph unchanged", () => {
    const body = "Para one.\n\n```\ncode\n```\n\nPara two.";
    expect(firstParagraph(body)).toBe("Para one.");
  });

  it("a document that is only code has no excerpt", () => {
    const body = "```\nconst x = 1;\n```";
    expect(firstParagraph(body)).toBeNull();
  });

  it("keeps inline triple-backtick text on a prose line (not a fence — info string carries a backtick)", () => {
    const body = "```x``` is inline, not a fence.";
    expect(firstParagraph(body)).toBe("```x``` is inline, not a fence.");
  });

  it("heading, then fence, then prose — the excerpt is the prose", () => {
    const body = "# Heading\n\n```\ncode\n```\n\nThe real prose.";
    expect(firstParagraph(body)).toBe("The real prose.");
  });

  it("still caps at 500 characters when the fence-skipping prose is long", () => {
    const body = "```\ncode\n```\n\n" + "x".repeat(600);
    expect(firstParagraph(body)?.length).toBe(500);
  });
});

/**
 * The OLD implementation (pre-STEM-530), copied here verbatim as a reference
 * — not imported, so a future edit to excerpt.ts can never accidentally make
 * this drift into testing itself. This is what proves the fence change is
 * additive: run both against every real document and every fixture, and the
 * only documents allowed to differ are ones a human can point at and explain
 * (and in this repo, today, there are none).
 */
function oldFirstParagraph(body: string): string | null {
  const lines = body.split("\n");
  const buf: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^#{1,6}\s/.test(t)) {
      if (buf.length) break;
      continue;
    }
    if (!t) {
      if (buf.length) break;
      continue;
    }
    buf.push(t);
  }
  const text = buf.join(" ").trim();
  return text ? text.slice(0, 500) : null;
}

const DOCS_DIR = path.join(import.meta.dirname, "..", "..", "..", "docs", "features");
const FIXTURES_DIR = path.join(import.meta.dirname, "..", "fixtures");

function loadMarkdown(dir: string): { path: string; content: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ path: path.join(dir, f), content: readFileSync(path.join(dir, f), "utf8") }));
}

/** Strips the frontmatter block the way `parseDoc` does before handing the
 * body to `firstParagraph` — these corpora are raw files with frontmatter
 * still attached, and `firstParagraph` is never called with it in production
 * (see parse-doc.ts: `splitFrontmatter` runs first). Comparing the stripped
 * body is what makes this regression check representative of the real call. */
function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---", 4);
  return end === -1 ? content : content.slice(end + 4).replace(/^\n/, "");
}

describe("firstParagraph — regression against the real corpus (no behavior change without a fence)", () => {
  // This file is mirrored byte-for-byte into the public CLI repo
  // (check:schema-mirror), which has no docs/features. The corpus exists only
  // in the product repo, so the case skips where the directory is absent.
  it.skipIf(!existsSync(DOCS_DIR))("docs/features/**/*.md: byte-identical excerpt before and after, or the diff is listed", () => {
    const changed: { path: string; before: string | null; after: string | null }[] = [];
    for (const { path: p, content } of loadMarkdown(DOCS_DIR)) {
      const body = stripFrontmatter(content);
      const before = oldFirstParagraph(body);
      const after = firstParagraph(body);
      if (before !== after) changed.push({ path: p, before, after });
    }
    expect(changed, JSON.stringify(changed, null, 2)).toEqual([]);
  });

  it("packages/schema/fixtures/*.md: byte-identical excerpt before and after, or the diff is listed", () => {
    const changed: { path: string; before: string | null; after: string | null }[] = [];
    for (const { path: p, content } of loadMarkdown(FIXTURES_DIR)) {
      const body = stripFrontmatter(content);
      const before = oldFirstParagraph(body);
      const after = firstParagraph(body);
      if (before !== after) changed.push({ path: p, before, after });
    }
    expect(changed, JSON.stringify(changed, null, 2)).toEqual([]);
  });
});
