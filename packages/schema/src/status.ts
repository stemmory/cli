// stemmory/packages/schema/src/status.ts
//
// One vocabulary translation, one map (STEM-70 decision D-1 #2, corrected by
// STEM-196's founder ruling — 2026-08-27). Documents describe INTENT (`idea`,
// `building`, ...); the graph stores FACT — `node_status`, the DB enum from
// DATA_MODEL.md §1. They are not the same words on purpose.
//
// STEM-196: doc frontmatter is the authority a repo-only org (never
// connected Linear) needs to ever see a node go `live` — every other
// producer of `live` is downstream of a Linear ticket or a write path that
// does not exist (see STEM-196's founder ruling for the full survey). So
// `status: shipped` in `docs/features/*.md` now reaches `live`, through the
// same full-vocabulary map CLI `stemmory lint` and future agent/MCP writes
// already used.
//
// This file used to carry a SECOND map that clamped GitHub-frontmatter
// ingest to `"planned" | "deprecated"`, so a doc could never race ahead of
// real ticket-derived state. That protection still exists — it just moved.
// It is now `applyStatusWrite`'s precedence guard in
// `apps/web/lib/sync/derive.ts`, which runs *after* this map and decides
// whether a `source: "github"` write is allowed to land at all. Clamping the
// VALUE here and gating the WRITE there were doing the same job twice; only
// one of them can also produce `live`, so the gate is the one that survives.
// A doc's `status: shipped` sitting stale for three weeks still cannot
// promote a node to `live` out from under a real ticket-derived state —
// DATA_MODEL.md §4.1's authority order already refuses a `github` write
// whenever the node's current status came from `linear`/`user`/`agent`,
// before the guard's content check ever runs.
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
 * The one doc-status -> node-status translation (STEM-196). Used by CLI
 * `stemmory lint`, future agent/MCP writes, AND — since STEM-196's founder
 * ruling — GitHub-frontmatter ingest (`parseDoc` in `parse-doc.ts`). All
 * three write `node_status` through the same words; what differs between
 * them is `WRITE_AUTHORITY` and the `github`-only precedence guard in
 * `apps/web/lib/sync/derive.ts`'s `applyStatusWrite`, not this map.
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

export function isDocStatus(value: string): value is DocStatus {
  return (DOC_STATUS_VALUES as readonly string[]).includes(value);
}
