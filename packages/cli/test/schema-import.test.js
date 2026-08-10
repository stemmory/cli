// stemmory-cli/packages/cli/src/schema-import.test.js
//
// Regression check for a real bug (STEM-74 review, blocking issue #1):
// @stemmory/schema's `exports` used to point straight at `./src/index.ts`,
// which only works when a bundler (Next.js's transpilePackages, vitest's
// own transform, ...) sits between the consumer and the file. A plain
// `node` process — which is exactly what the `stemmory` bin is — could not
// import it on ANY supported Node major (ERR_UNKNOWN_FILE_EXTENSION on 22,
// a dead end on the extensionless relative import even where type-stripping
// kicks in on 23/24). Nothing caught this because nothing actually imported
// the package outside of vitest's own transform pipeline.
//
// This test resolves `@stemmory/schema` through the SAME package.json
// `exports` field a real `node` process uses, and asserts real exports come
// back — it is a deliberately shallow "does the import even work" check,
// not a re-test of the schema package's own behaviour (that's
// packages/schema's job).
import { describe, expect, it } from "vitest";

describe("@stemmory/schema import (cross-package resolution)", () => {
  it("resolves and exposes its public API through package.json exports", async () => {
    const schema = await import("@stemmory/schema");
    expect(typeof schema.CURRENT_SCHEMA_VERSION).toBe("number");
    expect(typeof schema.validateFrontmatterV1).toBe("function");
    expect(typeof schema.parseDoc).toBe("function");
  });
});
