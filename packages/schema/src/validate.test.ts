// stemmory/packages/schema/src/validate.test.ts
//
// Edge cases the golden fixtures (fixtures.test.ts) don't already cover:
// malformed (non-numeric) schema values, self-parent, and the silent
// fallbacks for `type:`/`sort:`.
import { describe, expect, it } from "vitest";

import { validateFrontmatterV1 } from "./validate";

const fm = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe("schema: malformed value", () => {
  it("a non-numeric schema value warns and defaults to the current version", () => {
    const r = validateFrontmatterV1(fm({ slug: "x", title: "X", schema: "abc" }));
    expect(r.value?.schemaVersion).toBe(1);
    expect(r.warnings.some((w) => w.includes("schema"))).toBe(true);
  });
});

describe("parent", () => {
  it("a parent equal to the doc's own slug is dropped with a warning, not an error", () => {
    const r = validateFrontmatterV1(fm({ slug: "auth", title: "Auth", parent: "auth" }));
    expect(r.value?.parent).toBeNull();
    expect(r.warnings.some((w) => w.includes("own feature key"))).toBe(true);
  });

  it("an invalid parent slug is an error carrying the offending value", () => {
    const r = validateFrontmatterV1(fm({ slug: "ok", title: "X", parent: "Bad Parent" }));
    expect(r.value).toBeNull();
    expect(!r.value && r.errors[0].code).toBe("invalid_parent");
    expect(!r.value && r.errors[0].detail).toBe("parent: Bad Parent");
  });
});

describe("type", () => {
  it("infers subfeature from parent presence, feature otherwise", () => {
    expect(validateFrontmatterV1(fm({ slug: "a/b", title: "X", parent: "a" })).value?.type).toBe(
      "subfeature",
    );
    expect(validateFrontmatterV1(fm({ slug: "a", title: "X" })).value?.type).toBe("feature");
  });

  it("an unrecognised type falls back to the inferred value without a warning", () => {
    // `updated:` supplied so the only thing under test — type's silent
    // fallback — isn't obscured by the separate "missing updated" warning.
    const r = validateFrontmatterV1(
      fm({ slug: "a", title: "X", type: "nonsense", updated: "2026-08-01" }),
    );
    expect(r.value?.type).toBe("feature");
    expect(r.warnings).toEqual([]);
  });
});

describe("owner / linear_team", () => {
  it("both optional, absent -> null, no warning", () => {
    const r = validateFrontmatterV1(fm({ slug: "a", title: "X", updated: "2026-08-01" }));
    expect(r.value?.owner).toBeNull();
    expect(r.value?.linearTeam).toBeNull();
    expect(r.warnings).toEqual([]);
  });

  it("both pass through verbatim when present", () => {
    const r = validateFrontmatterV1(
      fm({ slug: "a", title: "X", updated: "2026-08-01", owner: "vamsi", linear_team: "STEM" }),
    );
    expect(r.value?.owner).toBe("vamsi");
    expect(r.value?.linearTeam).toBe("STEM");
  });
});

describe("updated", () => {
  /**
   * Fable's adversarial review: measured against docs/features/, this
   * warning fired for 16 of 23 docs — every doc predating the kit — because
   * it fired on absence unconditionally. §2.4 obliges AGENTS to keep
   * `updated` current; it does not authorise ingest to nag every legacy doc.
   * Gated on `schema:` presence — i.e. "has this doc opted into the kit".
   */
  it("absent AND not opted into the kit (no schema:) -> no warning", () => {
    const r = validateFrontmatterV1(fm({ slug: "a", title: "X" }));
    expect(r.value?.updated).toBeNull();
    expect(r.warnings).toEqual([]);
  });

  it("absent BUT opted into the kit (schema: declared) -> warns", () => {
    const r = validateFrontmatterV1(fm({ slug: "a", title: "X", schema: "1" }));
    expect(r.value?.updated).toBeNull();
    expect(r.warnings.some((w) => w.includes('missing "updated'))).toBe(true);
  });

  it("malformed shape always warns and is dropped to null, never a hard failure — opted in or not", () => {
    const r = validateFrontmatterV1(fm({ slug: "a", title: "X", updated: "08/06/2026" }));
    expect(r.value?.updated).toBeNull();
    expect(r.warnings.some((w) => w.includes("updated") && w.includes("ISO date"))).toBe(true);
  });

  it("a valid ISO date passes through", () => {
    const r = validateFrontmatterV1(fm({ slug: "a", title: "X", updated: "2026-08-06" }));
    expect(r.value?.updated).toBe("2026-08-06");
    expect(r.warnings).toEqual([]);
  });
});

describe("sort / schema: oversized digit strings", () => {
  it("sort: defaults to 0 when absent, non-numeric, or too large to be a safe integer", () => {
    expect(validateFrontmatterV1(fm({ slug: "a", title: "X" })).value?.sort).toBe(0);
    expect(validateFrontmatterV1(fm({ slug: "a", title: "X", sort: "abc" })).value?.sort).toBe(0);
    expect(
      validateFrontmatterV1(fm({ slug: "a", title: "X", sort: "9007199254740993" })).value?.sort,
    ).toBe(0);
  });

  it("sort: parses a digit string", () => {
    expect(validateFrontmatterV1(fm({ slug: "a", title: "X", sort: "20" })).value?.sort).toBe(20);
  });

  /**
   * Fable's adversarial review: `schema: 99999999999999999999` used to reach
   * the "defensive, unreachable" final zod gate and hard-skip the WHOLE doc,
   * misreported as `invalid_slug` — directly violating spec §3 ("older
   * schemas parse with warnings, never hard-fail"; the same rule covers an
   * unparseable value). `.refine(Number.isSafeInteger)` on `digitsToNumber`
   * routes it through the existing warn-and-default-to-current path instead.
   */
  it("schema: an oversized value warns and defaults to the current version, never a hard-skip", () => {
    const r = validateFrontmatterV1(
      fm({ slug: "a", title: "X", schema: "99999999999999999999" }),
    );
    expect(r.value).not.toBeNull();
    expect(r.value?.schemaVersion).toBe(1);
    expect(r.warnings.some((w) => w.includes("schema"))).toBe(true);
  });
});

/**
 * Fable's adversarial review: measured against docs/features/, the legacy
 * warning fired for 100% of docs, including the 6 PR-0 stubs that carry
 * BOTH `slug:` and `feature:`, equal, exactly as BUILD_AUDIT told them to.
 */
describe("legacy feature: + slug: together", () => {
  it("both present and EQUAL: no warning — this is the sanctioned transitional form", () => {
    const r = validateFrontmatterV1(fm({ slug: "auth", feature: "auth", title: "Auth" }));
    expect(r.value?.slug).toBe("auth");
    expect(r.warnings.some((w) => w.includes("legacy"))).toBe(false);
  });

  it("feature: alone (no slug:) still warns — that IS the deprecated form", () => {
    const r = validateFrontmatterV1(fm({ feature: "auth", title: "Auth" }));
    expect(r.value?.slug).toBe("auth");
    expect(r.warnings.some((w) => w.includes("legacy"))).toBe(true);
  });

  it("both present and DIFFERENT: still an error, unaffected by the warning fix", () => {
    const r = validateFrontmatterV1(fm({ slug: "auth", feature: "billing", title: "X" }));
    expect(r.value).toBeNull();
    expect(!r.value && r.errors[0].code).toBe("slug_conflict");
  });
});
