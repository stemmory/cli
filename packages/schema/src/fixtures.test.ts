// stemmory/packages/schema/src/fixtures.test.ts
//
// Golden fixtures on disk (../fixtures/*.md), not inline strings — real files
// a doc author could actually commit. Each one names, in its own frontmatter
// and prose, the exact behaviour it exercises.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseDoc } from "./parse-doc";

const FIXTURES_DIR = path.join(import.meta.dirname, "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, name), "utf8");
}

/** Every fixture this suite exercises. Kept as one static list, not derived
 * from test execution order, so the completeness check below doesn't depend
 * on which `it` happens to run first. */
const ALL_FIXTURES = [
  "status-idea.md",
  "status-planned.md",
  "status-building.md",
  "status-shipped.md",
  "status-paused.md",
  "status-deprecated.md",
  "legacy-feature-alias.md",
  "slug-feature-conflict.md",
  "decision-canonical.md",
  "decision-extended.md",
  "missing-slug.md",
  "missing-title.md",
  "bad-slug-grammar.md",
  "bad-slug-depth.md",
  "unknown-status.md",
  "malformed-delimiters.md",
  "schema-newer-than-supported.md",
  "schema-older-than-supported.md",
  "kit-fields-populated.md",
  "kit-fields-absent.md",
  "malformed-updated-date.md",
  "links-non-empty.md",
  "hierarchical-slug-depth-4.md",
];

it("fixtures/ on disk exactly matches the list this suite exercises", () => {
  const onDisk = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".md"));
  expect(onDisk.sort()).toEqual([...ALL_FIXTURES].sort());
});

/**
 * DATA_MODEL.md §4, LOCKED: "GitHub frontmatter may only raise a node from
 * nothing to `planned`, or set `deprecated`; it never overrides
 * `in_progress`/`live` (docs lag reality)." `parseDoc` is the GitHub-ingest
 * path (`apps/web/lib/sync/markdown.ts` -> `reconcile.ts`), so EVERY declared
 * status here clamps to `planned` except `deprecated` — this is the
 * regression test for the original D-1's `building -> in_progress` /
 * `shipped -> live` bug an adversarial reviewer caught.
 */
describe("every valid document status, through the GitHub-ingest clamp (§4)", () => {
  it.each([
    ["status-idea.md", "planned", true],
    ["status-planned.md", "planned", false],
    ["status-building.md", "planned", true],
    ["status-shipped.md", "planned", true],
    ["status-paused.md", "planned", true],
    ["status-deprecated.md", "deprecated", false],
  ] as const)("%s ingests as node_status %s", (name, nodeStatus, expectClampWarning) => {
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.status).toBe(nodeStatus);
    if (expectClampWarning) {
      expect(r.ok && r.warnings.some((w) => w.includes("cannot be set from a doc"))).toBe(true);
    } else {
      expect(r.ok && r.warnings).toEqual([]);
    }
  });

  it("status: shipped does NOT ingest as live — the regression this split prevents", () => {
    const r = parseDoc("status-shipped.md", fixture("status-shipped.md"));
    expect(r.ok && r.doc.status).not.toBe("live");
    expect(r.ok && r.doc.status).toBe("planned");
  });

  it("status: building does NOT ingest as in_progress — the regression this split prevents", () => {
    const r = parseDoc("status-building.md", fixture("status-building.md"));
    expect(r.ok && r.doc.status).not.toBe("in_progress");
    expect(r.ok && r.doc.status).toBe("planned");
  });
});

describe("feature: legacy alias (D-1 #1)", () => {
  it("parses using feature: alone, and warns", () => {
    const name = "legacy-feature-alias.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.slug).toBe("legacy/aliased-feature");
    expect(r.ok && r.warnings.some((w) => w.includes("legacy") && w.includes("feature"))).toBe(true);
  });

  it("errors when slug: and feature: disagree", () => {
    const name = "slug-feature-conflict.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.skip).toBe("slug_conflict");
  });
});

describe("both decision-line grammars (D-1 #4)", () => {
  it("parses the shipped canonical `— because <rationale>` form", () => {
    const name = "decision-canonical.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.decisions).toEqual([
      {
        decidedAt: "2026-07-12",
        title: "Use Apple + Google only for v1",
        rationale:
          "90% of our users are on those platforms and each extra provider adds review burden.",
      },
    ]);
  });

  it("parses the spec's extended `— <why> — Alternatives: <...>` form", () => {
    const name = "decision-extended.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.decisions).toEqual([
      {
        decidedAt: "2026-07-12",
        title: "Use Postgres over DynamoDB",
        rationale: "relational queries dominate our access patterns",
        alternatives: "DynamoDB, MongoDB",
      },
    ]);
  });
});

describe("missing required fields", () => {
  it("no slug and no feature key is skipped, not errored", () => {
    const name = "missing-slug.md";
    const r = parseDoc(name, fixture(name));
    expect(r).toEqual({ ok: false, skip: "no_feature_key" });
  });

  it("no title is skipped, carrying the slug", () => {
    const name = "missing-title.md";
    const r = parseDoc(name, fixture(name));
    expect(r).toEqual({ ok: false, skip: "no_title", detail: "alpha/no-title" });
  });
});

/**
 * D-1 #4 / BUILD_AUDIT.md §1: slugs are the CONVENTIONS.md §3 hierarchical
 * path, not the flat "matches filename" form §2.4's example comment implies —
 * 9 of the 16 existing feature docs (`auth/roles`, `billing/plan-changes`,
 * `sync/github-docs`, ...) rely on this. A validator that rejected or warned
 * on multi-segment slugs would break 56% of the current corpus.
 */
describe("hierarchical slugs (CONVENTIONS.md §3, D-1 #4)", () => {
  it("a depth-4 /-separated slug is accepted, unchanged, with no warning", () => {
    const name = "hierarchical-slug-depth-4.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.slug).toBe("auth/roles/admin/permissions");
    expect(r.ok && r.warnings).toEqual([]);
  });
});

describe("bad slug grammar", () => {
  it("uppercase/underscore is rejected", () => {
    const name = "bad-slug-grammar.md";
    const r = parseDoc(name, fixture(name));
    expect(r).toEqual({ ok: false, skip: "invalid_slug", detail: "Not_A_Valid_Slug" });
  });

  it("depth > 4 is rejected", () => {
    const name = "bad-slug-depth.md";
    const r = parseDoc(name, fixture(name));
    expect(r).toEqual({ ok: false, skip: "invalid_slug", detail: "a/b/c/d/e" });
  });
});

describe("unknown status", () => {
  it("is ignored (status: null) with a warning, not rejected", () => {
    const name = "unknown-status.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.status).toBeNull();
    expect(r.ok && r.warnings.some((w) => w.includes("ignored"))).toBe(true);
  });
});

describe("malformed frontmatter delimiters", () => {
  it("a missing closing delimiter is skipped, not a crash", () => {
    const name = "malformed-delimiters.md";
    const r = parseDoc(name, fixture(name));
    expect(r).toEqual({ ok: false, skip: "no_frontmatter" });
  });
});

describe("schema version skew (spec §3) — never a hard failure", () => {
  it("a schema NEWER than this validator degrades gracefully, warning to run `stemmory update`", () => {
    const name = "schema-newer-than-supported.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.slug).toBe("alpha/from-the-future");
    // shipped -> planned through the ingest clamp (§4) — still understood,
    // NOT promoted to live just because the schema version is unfamiliar.
    expect(r.ok && r.doc.status).toBe("planned");
    expect(
      r.ok && r.warnings.some((w) => w.includes("newer") && w.includes("stemmory update")),
    ).toBe(true);
    expect(r.ok && r.warnings.some((w) => w.includes("cannot be set from a doc"))).toBe(true);
  });

  it("a schema OLDER than this validator also degrades gracefully, with a warning", () => {
    const name = "schema-older-than-supported.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.slug).toBe("alpha/from-the-past");
    expect(r.ok && r.warnings.some((w) => w.includes("older"))).toBe(true);
  });
});

/**
 * AGENT_CONVENTIONS_KIT_SPEC.md §2.4's remaining four fields — added after
 * the STEM-70 correction that the spec docs were missing from the working
 * tree. All four are optional (§2.4 marks `linear_team`/`links` explicitly
 * so; `owner`/`updated` get the same treatment here because no doc in this
 * repo's `docs/features/` predates any of them, and reconcile.ts must keep
 * ingesting every one unchanged).
 */
describe("AGENT_CONVENTIONS_KIT_SPEC.md §2.4 kit fields", () => {
  it("all four populated: no field-specific warning fires (status: building still clamps, §4)", () => {
    const name = "kit-fields-populated.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.owner).toBe("vamsi");
    expect(r.ok && r.doc.updated).toBe("2026-08-06");
    expect(r.ok && r.doc.linearTeam).toBe("STEM");
    expect(r.ok && r.doc.links).toEqual(["PR#42", "docs/features/share-links.md"]);
    // This fixture is the spec's own §2.4 example verbatim, which declares
    // `status: building` — the ingest-authority clamp (§4) still applies to
    // it. owner/updated/linear_team/links are unaffected: only the status
    // clamp warning fires, and status ingests as `planned`, not `in_progress`.
    expect(r.ok && r.doc.status).toBe("planned");
    expect(r.ok && r.warnings).toEqual([expect.stringContaining("cannot be set from a doc")]);
  });

  it("all four absent AND not opted into the kit (no schema:): every doc ingests silently", () => {
    const name = "kit-fields-absent.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.owner).toBeNull();
    expect(r.ok && r.doc.updated).toBeNull();
    expect(r.ok && r.doc.linearTeam).toBeNull();
    expect(r.ok && r.doc.links).toEqual([]);
    // No `schema:` -> not opted into the kit -> the missing-`updated:`
    // warning does not fire. This is the fix for the 16-of-23-docs noise
    // Fable's adversarial review measured against docs/features/.
    expect(r.ok && r.warnings).toEqual([]);
  });

  it("a malformed updated: date is ignored (never a skip), with a warning", () => {
    const name = "malformed-updated-date.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.updated).toBeNull();
    expect(r.ok && r.warnings.some((w) => w.includes("updated") && w.includes("ISO date"))).toBe(
      true,
    );
  });

  it("a non-empty comma-separated links: value parses into an array, warning-free", () => {
    const name = "links-non-empty.md";
    const r = parseDoc(name, fixture(name));
    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.links).toEqual(["PR#42", "docs/features/alpha.md"]);
    // No `schema:` -> not opted into the kit -> no missing-`updated:` warning.
    expect(r.ok && r.warnings).toEqual([]);
  });
});
