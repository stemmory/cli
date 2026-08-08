// stemmory/packages/schema/src/links.ts
//
// `links: []` (AGENT_CONVENTIONS_KIT_SPEC.md §2.4) is the one v1 field whose
// spec-literal syntax is an actual list — and frontmatter.ts's hand-rolled
// `key: value` parser deliberately has no list/nesting support (see the
// comment there). Rather than reach for a YAML library to parse one field,
// this file recognises exactly two shapes on the single-line string value:
//
//   "[]"                      -> empty list (the spec's own example)
//   "PR#42, docs/foo.md"      -> comma-or-space separated bare items
//
// Anything with `[`/`]` that isn't literally `[]` (real YAML flow-list syntax,
// nested structures, ...) is beyond this parser's deliberately narrow scope:
// warn and degrade to `[]` rather than fail the whole document over one
// optional field.
export function parseLinks(raw: string | undefined, warnings: string[]): string[] {
  if (raw === undefined || raw === "[]") return [];

  if (raw.includes("[") || raw.includes("]")) {
    warnings.push(
      `frontmatter "links" value "${raw}" is not a simple list — the frontmatter parser has no bracketed/nested syntax. Degraded to []. Fix: use a comma- or space-separated list, e.g. "links: PR#42, docs/foo.md".`,
    );
    return [];
  }

  // Comma is the delimiter whenever one is present, full stop — never ALSO
  // split on whitespace in that case, or a link value containing a space
  // (an unencoded URL, "PR#42 (see thread)") fragments further than the
  // comma alone would. Whitespace is the delimiter only as a fallback, for
  // the no-comma form ("links: PR#42 docs/foo.md"). Flagged by Fable's
  // adversarial review: this doesn't (and can't, without quoting) fully
  // disambiguate a link value that legitimately contains a comma — it only
  // stops compounding that ambiguity with a second, unrelated delimiter.
  const items = raw.includes(",") ? raw.split(",") : raw.split(/\s+/);
  return items.map((s) => s.trim()).filter(Boolean);
}
