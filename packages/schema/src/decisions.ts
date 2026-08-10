// stemmory/packages/schema/src/decisions.ts
//
// `## Decisions` section grammar (CONVENTIONS.md §2 / AGENT_CONVENTIONS_KIT_SPEC.md
// §2.2's "decision record format", STEM-70 decision D-1 #4). Two accepted forms:
//
//   canonical: - YYYY-MM-DD — <title> — because <rationale>
//   extended:  - YYYY-MM-DD — <title> — <why> — <alternatives considered>
//
// The canonical form is what the repo has always shipped (the em-dash is what
// the spec writes, but people type hyphens, so both are accepted). The
// extended form is §2.2's own grammar: `- YYYY-MM-DD — Decision — Why —
// Alternatives considered` — four em-dash-separated segments. §2.2's template
// doesn't literally require the fourth segment to start with the word
// "Alternatives:"; it names what belongs there. The regex accepts an optional
// "Alternatives:" label so both a bare fourth segment and a labelled one
// parse the same way. Canonical is tried first, since a `because` clause read
// as the extended form's free-text "why" would silently drop the distinction.
export type ParsedDecision = {
  decidedAt: string;
  title: string;
  rationale: string;
  /** Present only for the extended grammar's fourth (alternatives) segment. */
  alternatives?: string;
};

/**
 * Segment separator between date/title/rationale/alternatives. An em/en-dash
 * may sit tight against its neighbours (— common when typed via a
 * dash-inserting editor), but a plain ASCII hyphen MUST have whitespace on
 * both sides.
 *
 * ⚠️ Without that requirement, hyphenated words inside the title/rationale
 * itself satisfy the separator: "Switched to feature-flag-based rollout"
 * parses as three segments (title "...feature", rationale "flag",
 * alternatives "based rollout") with NO rationale at all — a silent
 * corruption of the product's core artifact, not the visible "missing —
 * because" warning the module promises. Caught by Fable's adversarial review
 * (79-case differential harness against the base-branch parser).
 */
const SEP = String.raw`(?:\s+-\s+|\s*[—–]\s*)`;

const DECISION_RE_CANONICAL = new RegExp(
  String.raw`^[-*]\s*(\d{4}-\d{2}-\d{2})${SEP}(.+?)${SEP}because\s+(.+)$`,
  "i",
);

const DECISION_RE_EXTENDED = new RegExp(
  String.raw`^[-*]\s*(\d{4}-\d{2}-\d{2})${SEP}(.+?)${SEP}(.+?)${SEP}(?:Alternatives:\s*)?(.+)$`,
  "i",
);

export function parseDecisions(body: string): { decisions: ParsedDecision[]; warnings: string[] } {
  const decisions: ParsedDecision[] = [];
  const warnings: string[] = [];

  // Only the `## Decisions` section, and only until the next heading of the
  // same or higher level — a `### Rejected` subsection stays inside it, while
  // the next `## Something` ends it.
  const start = body.search(/^##\s+Decisions\s*$/im);
  if (start === -1) return { decisions, warnings };

  const rest = body.slice(start).split("\n").slice(1);
  const endIdx = rest.findIndex((l) => /^#{1,2}\s+\S/.test(l));
  const section = (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");

  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (!/^[-*]\s/.test(trimmed)) continue;

    const canonical = trimmed.match(DECISION_RE_CANONICAL);
    const extended = canonical ? null : trimmed.match(DECISION_RE_EXTENDED);

    if (!canonical && !extended) {
      // Reported, never silently dropped: a decision the author believed they
      // recorded and which never appears is worse than a visible warning.
      warnings.push(`decision line missing "— because <rationale>": ${trimmed.slice(0, 80)}`);
      continue;
    }

    const [, decidedAt, title, rationale, alternatives] = (canonical ?? extended)!;
    if (!Number.isFinite(Date.parse(decidedAt))) {
      warnings.push(`decision line has an unparseable date: ${trimmed.slice(0, 80)}`);
      continue;
    }
    decisions.push({
      decidedAt,
      title: title.trim(),
      rationale: rationale.trim(),
      ...(extended ? { alternatives: alternatives.trim() } : {}),
    });
  }

  return { decisions, warnings };
}
