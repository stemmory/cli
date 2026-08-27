// stemmory/packages/schema/src/status.test.ts
import { describe, expect, it } from "vitest";

import {
  DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY,
  DOC_STATUS_VALUES,
  NODE_STATUS_VALUES,
  isDocStatus,
} from "./status";

/**
 * STEM-196 (founder ruling, 2026-08-27): this is now the ONLY doc-status ->
 * node-status map. CLI `stemmory lint`, future agent/MCP writes, AND
 * GitHub-frontmatter ingest (`parseDoc`) all use it — `shipped` reaches
 * `live` through every one of those paths. What used to be a second,
 * clamping map (`DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST`, deleted here) is
 * now a precedence GUARD instead — `applyStatusWrite` in
 * `apps/web/lib/sync/derive.ts` decides whether a `source: "github"` write
 * is allowed to land, not this map. See `derive.test.ts`'s "authority"
 * suite for that behavior.
 */
describe("DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY (CLI lint, agent/MCP writes, GitHub ingest)", () => {
  it("maps every document status to a real node_status value", () => {
    for (const status of DOC_STATUS_VALUES) {
      expect(NODE_STATUS_VALUES).toContain(DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY[status]);
    }
  });

  it("never produces needs_work — that is derivation-only", () => {
    expect(Object.values(DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY)).not.toContain("needs_work");
  });

  it("matches D-1 #2 exactly — the full vocabulary", () => {
    expect(DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY).toEqual({
      idea: "planned",
      planned: "planned",
      building: "in_progress",
      shipped: "live",
      paused: "planned",
      deprecated: "deprecated",
    });
  });

  it("STEM-196: status: shipped now ingests as live", () => {
    expect(DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY.shipped).toBe("live");
  });
});

describe("isDocStatus", () => {
  it.each(DOC_STATUS_VALUES)("accepts %s", (s) => expect(isDocStatus(s)).toBe(true));

  it.each(["live", "in_progress", "needs_work", "nonsense", ""])("rejects %s", (s) =>
    expect(isDocStatus(s)).toBe(false),
  );
});
