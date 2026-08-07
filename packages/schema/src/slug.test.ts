// stemmory/packages/schema/src/slug.test.ts
import { describe, expect, it } from "vitest";

import { isValidSlug } from "./slug";

describe("slug grammar", () => {
  it.each(["auth", "auth/social-login", "a/b/c/d", "x1/y2-z3"])("accepts %s", (s) =>
    expect(isValidSlug(s)).toBe(true),
  );

  it.each([
    ["Auth", "uppercase"],
    ["auth_social", "underscore"],
    ["auth//social", "empty segment"],
    ["a/b/c/d/e", "depth 5 exceeds the max of 4"],
    ["-auth", "leading hyphen"],
    ["auth-", "trailing hyphen"],
    ["auth social", "space"],
    ["", "empty"],
  ])("rejects %s (%s)", (s) => expect(isValidSlug(s)).toBe(false));
});
