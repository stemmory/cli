// stemmory-cli/packages/cli/src/lib/skill-fields.test.js
import { frontmatterV1Schema } from "@stemmory/schema";
import { describe, expect, it } from "vitest";

import { diffFields, frontmatterFieldTable } from "./skill-fields.js";

describe("diffFields", () => {
  it("reports fields present in the schema but not documented", () => {
    expect(diffFields(["a", "b"], ["a"])).toEqual({ missing: ["b"], extra: [] });
  });

  it("reports fields documented but no longer in the schema", () => {
    expect(diffFields(["a"], ["a", "c"])).toEqual({ missing: [], extra: ["c"] });
  });

  it("reports no drift when both sides match", () => {
    expect(diffFields(["a", "b"], ["b", "a"])).toEqual({ missing: [], extra: [] });
  });
});

describe("frontmatterFieldTable", () => {
  it("has exactly one row per field in @stemmory/schema's frontmatterV1Schema", () => {
    const schemaFieldCount = Object.keys(frontmatterV1Schema.shape).length;
    const rowCount = frontmatterFieldTable()
      .split("\n")
      .filter((line) => line.startsWith("| `")).length;
    expect(rowCount).toBe(schemaFieldCount);
  });

  it("documents the on-disk YAML keys, including the schema/linear_team renames", () => {
    const table = frontmatterFieldTable();
    expect(table).toContain("`schema`");
    expect(table).toContain("`linear_team`");
    // The zod-shape's own internal names should not leak into the docs.
    expect(table).not.toContain("`schemaVersion`");
    expect(table).not.toContain("`linearTeam`");
  });
});
