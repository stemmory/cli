// stemmory/packages/schema/src/parse-doc.ts
//
// The web-app-facing entry point: turns one markdown doc into a `ParsedDoc`,
// or a `SkipReason` if it should not become a node at all — CONVENTIONS.md §2's
// "silent skip" contract, unchanged by schema v1 (STEM-70). Layers atop
// validate.ts (which validates the frontmatter itself) with everything that
// depends on the wider document: `## Decisions` parsing, the excerpt, and the
// doc-status -> node_status mapping.
//
// ⚠️ STATUS AUTHORITY (STEM-70 D-1 #2; corrected again by STEM-196's founder
// ruling, 2026-08-27): this is the GitHub-frontmatter INGEST path —
// `apps/web/lib/sync/markdown.ts` -> `github.ts` -> `reconcile.ts` — which
// DATA_MODEL.md §4 ranks BELOW ticket derivation. It now uses the full
// `DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY` map — the same one CLI
// `stemmory lint` and future agent/MCP writes use — so `status: shipped` can
// reach `live` (STEM-196: a repo-only org that never connected Linear has no
// other way to ever see a node go live). What still ranks this path BELOW
// derivation is not this map anymore; it is `applyStatusWrite`'s precedence
// guard in `apps/web/lib/sync/derive.ts`, which is where a stale
// `status: shipped` is stopped from overriding a node whose current status
// came from `linear`/`user`/`agent` — see that file for the guard.
//
// `apps/web/lib/sync/markdown.ts` re-exports this file verbatim — this is the
// only parser in the codebase (STEM-70).
import { parseDecisions, type ParsedDecision } from "./decisions";
import { firstParagraph } from "./excerpt";
import { parseFrontmatterBlock, splitFrontmatter } from "./frontmatter";
import { DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY, type DocDerivedNodeStatus } from "./status";
import type { IssueCode } from "./validate";
import { validateFrontmatterV1 } from "./validate";

export type { ParsedDecision };

export type ParsedDoc = {
  slug: string;
  title: string;
  parent: string | null;
  /**
   * The full doc-status vocabulary except `needs_work` (derivation-only —
   * see `DocDerivedNodeStatus` in status.ts). `shipped` reaches `live`
   * here; whether that value actually gets WRITTEN to the node is a
   * separate decision made downstream by the hosted product's
   * `applyStatusWrite` precedence guard, not by this parse step.
   */
  status: DocDerivedNodeStatus | null;
  type: "feature" | "subfeature";
  sortOrder: number;
  /**
   * The doc's resolved `schema:` value (validate.ts's `resolveSchemaVersion`
   * — defaults to `CURRENT_SCHEMA_VERSION` when the field is absent, never
   * skipped). Not yet consumed by ingestion; the product app's Conformance
   * panel is the first consumer — it's how the panel computes the
   * "conventions kit outdated, run `stemmory update`" nudge without
   * re-deriving version skew itself.
   */
  schemaVersion: number;
  excerpt: string | null;
  decisions: ParsedDecision[];
  // AGENT_CONVENTIONS_KIT_SPEC.md §2.4's remaining fields. All optional and
  // not yet consumed by reconcile.ts (no DB columns for them exist yet — a
  // later story's job) — carried through here so the parsed value is
  // complete, not truncated to what today's writer happens to use.
  owner: string | null;
  updated: string | null;
  linearTeam: string | null;
  links: string[];
};

export type SkipReason =
  | "readme"
  | "no_frontmatter"
  | "no_feature_key"
  | "invalid_slug"
  | "slug_conflict"
  | "no_title"
  | "duplicate_key";

export type ParseResult =
  | { ok: true; doc: ParsedDoc; warnings: string[] }
  | { ok: false; skip: SkipReason; detail?: string };

/**
 * `README.md` is excluded BY NAME, and a file with no `slug:`/`feature:` key
 * is skipped. §2's "silent skip" contract: both are SILENT skips, not
 * `sync.unmapped` — "a directory needs to be able to explain itself without
 * generating triage noise." Returning a skip reason rather than an error is
 * what keeps them out of the activity log.
 */
export function shouldSkipByName(path: string): boolean {
  return path.split("/").pop()?.toLowerCase() === "readme.md";
}

/** `validate.ts`'s `IssueCode` is the authority — never string-sniffed here. */
const SKIP_REASON_BY_CODE: Record<IssueCode, SkipReason> = {
  missing_slug: "no_feature_key",
  slug_conflict: "slug_conflict",
  invalid_slug: "invalid_slug",
  invalid_parent: "invalid_slug",
  missing_title: "no_title",
  // Unreachable in practice — see validate.ts's `schema_mismatch` comment —
  // but every code needs a mapping, and "invalid_slug" is the closest existing
  // web-app skip bucket for "the frontmatter did not validate".
  schema_mismatch: "invalid_slug",
  duplicate_key: "duplicate_key",
};

export function parseDoc(path: string, content: string): ParseResult {
  if (shouldSkipByName(path)) return { ok: false, skip: "readme" };

  const split = splitFrontmatter(content);
  if (!split) return { ok: false, skip: "no_frontmatter" };

  const fm = parseFrontmatterBlock(split.frontmatter);
  const body = split.body;

  const validated = validateFrontmatterV1(fm);
  if (!validated.value) {
    const issue = validated.errors[0];
    return { ok: false, skip: SKIP_REASON_BY_CODE[issue.code], detail: issue.detail };
  }

  const fm1 = validated.value;
  const warnings = [...validated.warnings];

  // STEM-196: the full translation, not a clamp — see the file header. No
  // warning fires here for most values; whether a translated write actually
  // lands is `applyStatusWrite`'s call, downstream in derive.ts, recorded
  // per-node as a `StatusOutcome`, not as a parse-time warning on the doc.
  //
  // ONE exception: `building` -> `in_progress` is refused by
  // `applyStatusWrite`'s `github_cannot_override` guard for EVERY node, on
  // every sync, unconditionally (derive.ts §STEM-196 precedence rule — a
  // github write may only raise-to-planned, ship, or deprecate). Without a
  // warning here, a doc author who writes `status: building` gets no effect
  // and no feedback anywhere in the product; every other doc-status value
  // can at least apply on a fresh/system-authority node.
  const status = fm1.status ? DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY[fm1.status] : null;
  if (fm1.status === "building") {
    warnings.push(
      `frontmatter status "building" cannot be set from a doc — sync will not write it (in_progress is derived from Linear tickets only)`,
    );
  }

  const parsedDecisions = parseDecisions(body);
  warnings.push(...parsedDecisions.warnings);

  return {
    ok: true,
    warnings,
    doc: {
      slug: fm1.slug,
      title: fm1.title,
      parent: fm1.parent,
      status,
      type: fm1.type,
      sortOrder: fm1.sort,
      schemaVersion: fm1.schemaVersion,
      excerpt: firstParagraph(body),
      decisions: parsedDecisions.decisions,
      owner: fm1.owner,
      updated: fm1.updated,
      linearTeam: fm1.linearTeam,
      links: fm1.links,
    },
  };
}
