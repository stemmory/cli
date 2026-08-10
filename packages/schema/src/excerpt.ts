// stemmory/packages/schema/src/excerpt.ts

/** First non-empty, non-heading paragraph — shown as the card excerpt. */
export function firstParagraph(body: string): string | null {
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
