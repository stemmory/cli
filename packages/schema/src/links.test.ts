// stemmory/packages/schema/src/links.test.ts
import { describe, expect, it } from "vitest";

import { parseLinks } from "./links";

describe("parseLinks", () => {
  it("absent -> []", () => {
    const warnings: string[] = [];
    expect(parseLinks(undefined, warnings)).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("the literal empty-array form -> []", () => {
    const warnings: string[] = [];
    expect(parseLinks("[]", warnings)).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("comma-separated items are split and trimmed", () => {
    const warnings: string[] = [];
    expect(parseLinks("PR#42, docs/foo.md", warnings)).toEqual(["PR#42", "docs/foo.md"]);
    expect(warnings).toEqual([]);
  });

  it("space-separated items are split too", () => {
    const warnings: string[] = [];
    expect(parseLinks("PR#42 docs/foo.md", warnings)).toEqual(["PR#42", "docs/foo.md"]);
  });

  it("real bracketed/flow-list syntax degrades to [] with a warning", () => {
    const warnings: string[] = [];
    expect(parseLinks("[PR#42, docs/foo.md]", warnings)).toEqual([]);
    expect(warnings.some((w) => w.includes("links"))).toBe(true);
  });

  /**
   * Fable's adversarial review (NIT): comma is authoritative whenever one is
   * present — it must not ALSO split on whitespace, or a link value
   * containing a space (an unencoded URL, a parenthetical) fragments further
   * than the comma alone would.
   */
  it("comma is authoritative: an internal space in one item is preserved", () => {
    const warnings: string[] = [];
    expect(parseLinks("https://x.com/search?q=a b, https://y.com/c", warnings)).toEqual([
      "https://x.com/search?q=a b",
      "https://y.com/c",
    ]);
  });

  it("a link containing a comma still splits on it (inherent ambiguity, not this fix's job)", () => {
    const warnings: string[] = [];
    expect(parseLinks("https://x.com/a,1", warnings)).toEqual(["https://x.com/a", "1"]);
  });
});
