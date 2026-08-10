// stemmory/packages/schema/src/decisions.test.ts
import { describe, expect, it } from "vitest";

import { parseDecisions } from "./decisions";

describe("parseDecisions", () => {
  it("skips a line with neither grammar, and warns", () => {
    const r = parseDecisions("## Decisions\n- 2026-07-12 — We chose Postgres\n");
    expect(r.decisions).toEqual([]);
    expect(r.warnings.some((w) => w.includes("because"))).toBe(true);
  });

  it("accepts hyphens as well as em-dashes", () => {
    const r = parseDecisions(
      "## Decisions\n- 2026-07-12 - Use Postgres - because it is boring and we know it\n",
    );
    expect(r.decisions).toHaveLength(1);
  });

  it("stops at the next ## heading", () => {
    const r = parseDecisions(
      "## Decisions\n- 2026-07-12 — A — because reason one\n\n## Notes\n- 2026-07-13 — B — because reason two\n",
    );
    expect(r.decisions.map((d) => d.title)).toEqual(["A"]);
  });

  it("keeps a ### subsection inside the Decisions block", () => {
    const r = parseDecisions(
      "## Decisions\n- 2026-07-12 — A — because one\n\n### Rejected\n- 2026-07-13 — B — because two\n",
    );
    expect(r.decisions.map((d) => d.title)).toEqual(["A", "B"]);
  });

  it("warns on an unparseable date rather than storing it", () => {
    const r = parseDecisions("## Decisions\n- 2026-13-45 — A — because reason\n");
    expect(r.decisions).toEqual([]);
    expect(r.warnings.some((w) => w.includes("date"))).toBe(true);
  });

  it("no Decisions section is not an error", () => {
    const r = parseDecisions("## Why\nBecause.\n");
    expect(r.decisions).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("the extended grammar also warns on an unparseable date", () => {
    const r = parseDecisions(
      "## Decisions\n- 2026-13-45 — A — some reason — Alternatives: B, C\n",
    );
    expect(r.decisions).toEqual([]);
    expect(r.warnings.some((w) => w.includes("date"))).toBe(true);
  });

  /**
   * AGENT_CONVENTIONS_KIT_SPEC.md §2.2's own template is
   * `- YYYY-MM-DD — Decision — Why — Alternatives considered` — four
   * em-dash-separated segments, with no literal "Alternatives:" label
   * required. The grammar accepts the label when present (see the fixture
   * `decision-extended.md`) and also accepts a bare fourth segment.
   */
  it("the extended grammar's fourth segment doesn't require an 'Alternatives:' label", () => {
    const r = parseDecisions(
      "## Decisions\n- 2026-07-12 — Use Postgres — relational access patterns dominate — DynamoDB, MongoDB\n",
    );
    expect(r.decisions).toEqual([
      {
        decidedAt: "2026-07-12",
        title: "Use Postgres",
        rationale: "relational access patterns dominate",
        alternatives: "DynamoDB, MongoDB",
      },
    ]);
  });

  /**
   * Fable's adversarial review (79-case differential harness): a hyphenated
   * WORD inside the title must not be read as a segment separator. Before
   * the whitespace-around-ASCII-hyphen fix, this line — which has NO
   * rationale at all — silently stored `{title:"Switched to feature",
   * rationale:"flag", alternatives:"based rollout"}` instead of warning.
   * That inverted the module's own contract: a visible warning became a
   * silent corruption of the product's core artifact.
   */
  it("a hyphenated word in the title does not fabricate a rationale", () => {
    const r = parseDecisions(
      "## Decisions\n- 2026-01-02 — Switched to feature-flag-based rollout\n",
    );
    expect(r.decisions).toEqual([]);
    expect(r.warnings.some((w) => w.includes("because"))).toBe(true);
  });

  /** Same bug, with two hyphenated words either side of a real separator. */
  it("hyphenated words either side of a real separator still don't fabricate a rationale", () => {
    const r = parseDecisions(
      "## Decisions\n- 2026-01-02 — Add e-mail sign-in — improves onboarding\n",
    );
    expect(r.decisions).toEqual([]);
    expect(r.warnings.some((w) => w.includes("because"))).toBe(true);
  });

  it("a plain ASCII hyphen still works as a separator when spaced", () => {
    // Regression guard for the fix itself: `\s+-\s+` must still match, only
    // the unspaced (mid-word) form must not.
    const r = parseDecisions(
      "## Decisions\n- 2026-01-02 - Ship the redesign - because the old one tested worse\n",
    );
    expect(r.decisions).toEqual([
      {
        decidedAt: "2026-01-02",
        title: "Ship the redesign",
        rationale: "the old one tested worse",
      },
    ]);
  });
});
