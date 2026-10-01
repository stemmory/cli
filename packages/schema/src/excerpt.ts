// stemmory/packages/schema/src/excerpt.ts

/**
 * A fenced code block's opening line: ≤3 spaces indent, then 3+ backticks or
 * 3+ tildes, then an info string. CommonMark rule applied on purpose: a
 * backtick fence's info string may not itself contain a backtick, so
 * "```x``` is inline" does not open a fence — it is a prose line whose first
 * run of backticks closes three characters later, on the same line.
 */
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

function matchFenceOpen(line: string): { char: string; len: number } | null {
  const m = FENCE_OPEN_RE.exec(line);
  if (!m) return null;
  const marker = m[1];
  const char = marker[0];
  const info = m[2];
  if (char === "`" && info.includes("`")) return null;
  return { char, len: marker.length };
}

/** A closing fence: same character, at least as many of them, ≤3 spaces
 * indent, nothing but trailing whitespace after. */
function isFenceClose(line: string, char: string, minLen: number): boolean {
  const re = char === "`" ? /^ {0,3}(`{3,})\s*$/ : /^ {0,3}(~{3,})\s*$/;
  const m = re.exec(line);
  return m !== null && m[1].length >= minLen;
}

/**
 * First PROSE paragraph — shown as the card excerpt. Fenced code is skipped
 * entirely (and a fence interrupts a paragraph in progress, same as a blank
 * line). Headings and indented/other block types are left exactly as before
 * — this is a deliberate simplification, not a full CommonMark parser, and
 * only fences get special handling.
 */
export function firstParagraph(body: string): string | null {
  const lines = body.split("\n");
  const buf: string[] = [];
  let fence: { char: string; len: number } | null = null;
  for (const line of lines) {
    if (fence) {
      if (isFenceClose(line, fence.char, fence.len)) fence = null;
      continue;
    }
    const opened = matchFenceOpen(line);
    if (opened) {
      if (buf.length) break;
      fence = opened;
      continue;
    }
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
