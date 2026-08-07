// stemmory/packages/schema/src/status.test.ts
import { describe, expect, it } from "vitest";

import {
  DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY,
  DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST,
  DOC_STATUS_VALUES,
  NODE_STATUS_VALUES,
  isDocStatus,
} from "./status";

describe("DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY (CLI lint / future agent-MCP writes)", () => {
  it("maps every document status to a real node_status value", () => {
    for (const status of DOC_STATUS_VALUES) {
      expect(NODE_STATUS_VALUES).toContain(DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY[status]);
    }
  });

  it("never produces needs_work — that is derivation-only", () => {
    expect(Object.values(DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY)).not.toContain("needs_work");
  });

  it("matches D-1 #2 exactly — the full vocabulary, for the authority that outranks derivation", () => {
    expect(DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY).toEqual({
      idea: "planned",
      planned: "planned",
      building: "in_progress",
      shipped: "live",
      paused: "planned",
      deprecated: "deprecated",
    });
  });
});

/**
 * DATA_MODEL.md §4, LOCKED: "GitHub frontmatter may only raise a node from
 * nothing to `planned`, or set `deprecated`; it never overrides
 * `in_progress`/`live` (docs lag reality)." This is the authority
 * `apps/web/lib/sync/markdown.ts` actually uses — it must clamp, not widen.
 */
describe("DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST (§4: docs lag reality, so they clamp)", () => {
  it("only ever produces planned or deprecated — never in_progress, live, or needs_work", () => {
    for (const status of DOC_STATUS_VALUES) {
      expect(["planned", "deprecated"]).toContain(DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST[status]);
    }
  });

  it("matches the corrected D-1 #2 exactly — everything but deprecated clamps to planned", () => {
    expect(DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST).toEqual({
      idea: "planned",
      planned: "planned",
      building: "planned",
      shipped: "planned",
      paused: "planned",
      deprecated: "deprecated",
    });
  });

  /**
   * The regression this whole split exists to prevent: a stale
   * `status: shipped` must NOT promote a node to `live` out from under its
   * real ticket-derived state.
   */
  it("status: shipped does NOT ingest as live", () => {
    expect(DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST.shipped).not.toBe("live");
    expect(DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST.shipped).toBe("planned");
  });

  it("status: building does NOT ingest as in_progress", () => {
    expect(DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST.building).not.toBe("in_progress");
    expect(DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST.building).toBe("planned");
  });
});

describe("isDocStatus", () => {
  it.each(DOC_STATUS_VALUES)("accepts %s", (s) => expect(isDocStatus(s)).toBe(true));

  it.each(["live", "in_progress", "needs_work", "nonsense", ""])("rejects %s", (s) =>
    expect(isDocStatus(s)).toBe(false),
  );
});
