// stemmory/packages/schema/src/frontmatter.test.ts
//
// The parser itself (STEM-111) — previously exercised only through
// parse-doc.ts callers (fixtures.test.ts, validate.test.ts, corpus.test.ts),
// none of which reached duplicate-key detection because none needed to.
// `duplicates` must be recorded from key OCCURRENCE during the scan, not
// derived from the returned `fields` Map afterwards: `fields.set` keeps only
// the last NON-EMPTY value for a key, so an empty second occurrence changes
// nothing in the Map and would be invisible to any check that looked only
// at `fields`.
import { describe, expect, it } from "vitest";

import { parseFrontmatterBlock } from "./frontmatter";

describe("parseFrontmatterBlock: duplicate keys", () => {
  it("an identical-value duplicate is still flagged (not just the differing-value case)", () => {
    const r = parseFrontmatterBlock("slug: a\nslug: a");
    expect(r.fields.get("slug")).toBe("a");
    expect(r.duplicates).toEqual([{ key: "slug", firstLine: 1, line: 2 }]);
  });

  it("a differing-value duplicate is flagged, with the last non-empty value winning in `fields`", () => {
    const r = parseFrontmatterBlock("slug: a\nslug: b");
    expect(r.fields.get("slug")).toBe("b");
    expect(r.duplicates).toEqual([{ key: "slug", firstLine: 1, line: 2 }]);
  });

  it("an empty-valued second occurrence is still flagged even though `fields` keeps the first value", () => {
    const r = parseFrontmatterBlock("slug: a\nslug:");
    // Last-NON-EMPTY-wins: the empty second line doesn't overwrite `a` in
    // the Map, but it happened, and duplicate detection reads occurrence,
    // not the Map, so it's still caught.
    expect(r.fields.get("slug")).toBe("a");
    expect(r.duplicates).toEqual([{ key: "slug", firstLine: 1, line: 2 }]);
  });

  it("a duplicate of a non-schema key is flagged the same way as slug", () => {
    const r = parseFrontmatterBlock("owner: alice\nowner: bob");
    expect(r.duplicates).toEqual([{ key: "owner", firstLine: 1, line: 2 }]);
  });

  it("`Slug:` and `slug:` are distinct keys (case-sensitive) — not a duplicate", () => {
    const r = parseFrontmatterBlock("Slug: a\nslug: b");
    expect(r.fields.get("Slug")).toBe("a");
    expect(r.fields.get("slug")).toBe("b");
    expect(r.duplicates).toEqual([]);
  });

  it("firstLine/line are 1-based within the block, counted from wherever the duplicate actually sits", () => {
    const r = parseFrontmatterBlock("schema: 1\ntitle: X\nslug: a\nslug: b");
    expect(r.duplicates).toEqual([{ key: "slug", firstLine: 3, line: 4 }]);
  });

  it("a fully commented-out line is not a key occurrence — no duplicate", () => {
    const r = parseFrontmatterBlock("slug: a\n# slug: b");
    expect(r.fields.get("slug")).toBe("a");
    expect(r.duplicates).toEqual([]);
  });

  it("a duplicate line carrying a trailing inline comment is still detected", () => {
    const r = parseFrontmatterBlock("slug: a\nslug: b  # renamed, forgot to delete the old one");
    expect(r.fields.get("slug")).toBe("b");
    expect(r.duplicates).toEqual([{ key: "slug", firstLine: 1, line: 2 }]);
  });

  it("three occurrences of the same key: every occurrence after the first is flagged against the first line", () => {
    const r = parseFrontmatterBlock("slug: a\nslug: b\nslug: c");
    expect(r.duplicates).toEqual([
      { key: "slug", firstLine: 1, line: 2 },
      { key: "slug", firstLine: 1, line: 3 },
    ]);
  });

  it("no duplicates at all: an empty array, not undefined", () => {
    const r = parseFrontmatterBlock("slug: a\ntitle: X");
    expect(r.duplicates).toEqual([]);
  });
});
