// stemmory/packages/schema/src/status.ts
//
// Two vocabularies, TWO mappings — not one (STEM-70 decision D-1 #2,
// corrected). Documents describe INTENT (`idea`, `building`, ...); the graph
// stores FACT — `node_status`, the DB enum from DATA_MODEL.md §1. They are not
// the same words on purpose, and which mapping applies depends on WHO is
// writing: DATA_MODEL.md §4 is a LOCKED write-priority rule —
//
//   user = agent > derived (linear) > github frontmatter > system default
//
// — and "GitHub frontmatter may only raise a node from nothing to `planned`,
// or set `deprecated`; it never overrides `in_progress`/`live` (docs lag
// reality)." A doc's `status: shipped` sitting stale for three weeks must
// never promote a node to `live` out from under a real ticket-derived state —
// that is exactly the sync fight this file's split exists to prevent.
//
// So: TWO maps, named for the authority each one is allowed to exercise.
//   - EXPLICIT authority (CLI `stemmory lint`, and future agent/MCP writes,
//     which §4 puts ABOVE derivation) may use the full vocabulary.
//   - GITHUB INGEST authority (what `apps/web/lib/sync/markdown.ts` ->
//     `reconcile.ts` actually consumes today) CLAMPS — its return type is
//     restricted to `"planned" | "deprecated"` so `in_progress`/`live` are
//     unreachable from a doc by construction, not by convention.
export const DOC_STATUS_VALUES = [
  "idea",
  "planned",
  "building",
  "shipped",
  "paused",
  "deprecated",
] as const;
export type DocStatus = (typeof DOC_STATUS_VALUES)[number];

/** The DB's `node_status` enum. */
export const NODE_STATUS_VALUES = [
  "planned",
  "in_progress",
  "live",
  "needs_work",
  "deprecated",
] as const;
export type NodeStatus = (typeof NODE_STATUS_VALUES)[number];

/**
 * A document can never assert `needs_work` — it is derivation-only (open bug
 * tickets against an otherwise-live node), never a claim a human writes in
 * frontmatter. Excluding it from this type makes that a compile error at every
 * call site, not a convention someone has to remember and re-check.
 */
export type DocDerivedNodeStatus = Exclude<NodeStatus, "needs_work">;

/**
 * EXPLICIT authority only: CLI `stemmory lint`, and future agent/MCP writes —
 * both of which §4's write-priority rule ranks ABOVE derivation. Do NOT use
 * this for GitHub-frontmatter ingest; that path's authority is strictly
 * narrower — see `DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST` below.
 */
export const DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY: Readonly<
  Record<DocStatus, DocDerivedNodeStatus>
> = {
  idea: "planned",
  planned: "planned",
  building: "in_progress",
  shipped: "live",
  paused: "planned",
  deprecated: "deprecated",
};

/**
 * §4: what a doc can achieve through GitHub-frontmatter ingest — the only
 * path the product app's markdown sync actually exercises. The return type
 * is the enforcement: `in_progress`/`live`/`needs_work` are not values this
 * type can hold, so a call site cannot accidentally widen it.
 */
export type GithubIngestNodeStatus = "planned" | "deprecated";

export const DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST: Readonly<
  Record<DocStatus, GithubIngestNodeStatus>
> = {
  idea: "planned",
  planned: "planned",
  building: "planned",
  shipped: "planned",
  paused: "planned",
  deprecated: "deprecated",
};

export function isDocStatus(value: string): value is DocStatus {
  return (DOC_STATUS_VALUES as readonly string[]).includes(value);
}
