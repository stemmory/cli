// stemmory/packages/schema/src/parse-doc.ts
//
// The web-app-facing entry point: turns one markdown doc into a `ParsedDoc`,
// or a `SkipReason` if it should not become a node at all — CONVENTIONS.md §2's
// "silent skip" contract, unchanged by schema v1 (STEM-70). Layers atop
// validate.ts (which validates the frontmatter itself) with everything that
// depends on the wider document: `## Decisions` parsing, the excerpt, and the
// doc-status -> node_status mapping.
//
// ⚠️ STATUS AUTHORITY (STEM-70 D-1 #2, corrected): this is the
// GitHub-frontmatter INGEST path — `apps/web/lib/sync/markdown.ts` ->
// `github.ts` -> `reconcile.ts` — which DATA_MODEL.md §4 ranks BELOW ticket
// derivation. It therefore uses `DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST`
// (clamps to `planned`/`deprecated` only), never the EXPLICIT-authority map.
// Using the wrong map here is exactly the bug this file exists to prevent: a
// stale `status: shipped` would silently promote a node to `live` out from
// under its real ticket state.
//
// `apps/web/lib/sync/markdown.ts` re-exports this file verbatim — this is the
// only parser in the codebase (STEM-70).
import { parseDecisions, type ParsedDecision } from "./decisions";
import { firstParagraph } from "./excerpt";
import { parseFrontmatterBlock, splitFrontmatter } from "./frontmatter";
import { DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST, type GithubIngestNodeStatus } from "./status";
import type { IssueCode } from "./validate";
import { validateFrontmatterV1 } from "./validate";

export type { ParsedDecision };

export type ParsedDoc = {
  slug: string;
  title: string;
  parent: string | null;
  /**
   * GitHub-ingest authority only — `"planned" | "deprecated"`, never
   * `in_progress`/`live`/`needs_work` (§4's write-priority rule; status.ts).
   * A doc that declares `building`/`shipped`/etc. still lands here as
   * `planned`; see the ingest-authority warning this file pushes when that
   * happens.
   */
  status: GithubIngestNodeStatus | null;
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
  | "no_title";

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

  // §4's clamp. `DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST`'s return type makes
  // in_progress/live/needs_work unreachable here by construction — see status.ts.
  const status = fm1.status ? DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST[fm1.status] : null;
  if (fm1.status && fm1.status !== status) {
    // Fires for every declared value the clamp actually changes (idea,
    // building, shipped, paused — all -> planned). `planned`/`deprecated`
    // pass through unchanged and warn-free.
    warnings.push(
      `frontmatter status "${fm1.status}" cannot be set from a doc — GitHub frontmatter may only raise a node to "planned" or set "deprecated"; ingested as "${status}".`,
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
