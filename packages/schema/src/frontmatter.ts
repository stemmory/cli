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
export function parseFrontmatterBlock(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of block.split("\n")) {
    const withoutComment = line.replace(/\s+#.*$/, "");
    const m = withoutComment.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "").trim();
    if (value) out.set(m[1], value);
  }
  return out;
}

/** Splits `---\n<frontmatter>\n---\n<body>`. Returns null if the delimiters are malformed. */
export function splitFrontmatter(
  content: string,
): { frontmatter: string; body: string } | null {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  return { frontmatter: m[1], body: m[2] ?? "" };
}
