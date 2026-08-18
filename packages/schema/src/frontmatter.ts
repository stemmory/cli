// stemmory/packages/schema/src/frontmatter.ts
//
// A deliberately small YAML subset: `key: value`, one per line, no nesting, no
// lists, no anchors. The frontmatter schema (CONVENTIONS.md §2 / schema v1) is
// a handful of scalar keys, and adding a real YAML parser would accept far
// more than the spec defines — every extra feature is a way for a doc to mean
// something nobody designed. This is a deliberate choice, not a placeholder:
// keep it hand-rolled rather than reaching for a YAML library.
//
// Quotes are stripped because humans write `title: "Social login"` and being
// pedantic about it produces a node literally titled `"Social login"`.
//
// `duplicates` is recorded from key OCCURRENCE during the scan, never
// derived from `fields` afterwards — `fields.set` keeps only the last
// NON-EMPTY value for a key (an empty second occurrence, e.g. `slug: a`
// then a bare `slug:`, leaves `a` in the map untouched), so a duplicate
// that never changed the parsed result would be invisible to any check
// that only looked at the returned Map. Lines are 1-based WITHIN this
// block (the caller strips the opening `---` before calling this, so this
// function cannot see, and must not claim, a file line).
export type FrontmatterDuplicate = { key: string; firstLine: number; line: number };
export type ParsedFrontmatterBlock = {
  fields: Map<string, string>;
  duplicates: FrontmatterDuplicate[];
};

export function parseFrontmatterBlock(block: string): ParsedFrontmatterBlock {
  const fields = new Map<string, string>();
  const firstLineByKey = new Map<string, number>();
  const duplicates: FrontmatterDuplicate[] = [];
  const lines = block.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const withoutComment = lines[i].replace(/\s+#.*$/, "");
    const m = withoutComment.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^["']|["']$/g, "").trim();
    const firstLine = firstLineByKey.get(key);
    if (firstLine !== undefined) {
      duplicates.push({ key, firstLine, line: lineNumber });
    } else {
      firstLineByKey.set(key, lineNumber);
    }
    if (value) fields.set(key, value);
  }
  return { fields, duplicates };
}

/** Splits `---\n<frontmatter>\n---\n<body>`. Returns null if the delimiters are malformed. */
export function splitFrontmatter(
  content: string,
): { frontmatter: string; body: string } | null {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  return { frontmatter: m[1], body: m[2] ?? "" };
}
