// stemmory-cli/packages/cli/src/lib/fragment.test.js
import { describe, expect, it } from "vitest";

import { FRAGMENT_BEGIN, FRAGMENT_END, buildFragment, upsertAgentsMd } from "./fragment.js";

describe("buildFragment", () => {
  it("is <= 15 lines including markers (AGENT_CONVENTIONS_KIT_SPEC.md §2.1)", () => {
    const lines = buildFragment("docs/features").split("\n");
    expect(lines.length).toBeLessThanOrEqual(15);
  });

  it("starts and ends with the idempotent markers", () => {
    const fragment = buildFragment("docs/features");
    expect(fragment.startsWith(FRAGMENT_BEGIN)).toBe(true);
    expect(fragment.endsWith(FRAGMENT_END)).toBe(true);
  });

  it("templates the configured docs dir into the fragment body", () => {
    expect(buildFragment("documentation/features")).toContain("documentation/features/<slug>.md");
    expect(buildFragment("documentation/features")).not.toContain("docs/features/<slug>.md");
  });
});

describe("upsertAgentsMd", () => {
  const fragment = buildFragment("docs/features");

  it("creates a minimal AGENTS.md when none exists", () => {
    expect(upsertAgentsMd(null, fragment)).toBe(`${fragment}\n`);
  });

  it("appends the fragment to existing content without altering it", () => {
    const existing = "# My Project\n\nSome instructions here.\n";
    const result = upsertAgentsMd(existing, fragment);
    expect(result).toContain(existing.trim());
    expect(result).toContain(fragment);
    expect(result.indexOf(existing.trim())).toBeLessThan(result.indexOf(FRAGMENT_BEGIN));
  });

  it("replaces an existing marked block in place, leaving content before and after untouched", () => {
    const before = "# My Project\nSome instructions.";
    const after = "## Team norms\nDon't break prod.";
    const oldFragment = [FRAGMENT_BEGIN, "## Stemmory conventions", "stale content", FRAGMENT_END].join("\n");
    const existing = `${before}\n\n${oldFragment}\n\n${after}\n`;

    const result = upsertAgentsMd(existing, fragment);

    expect(result).toContain(before);
    expect(result).toContain(after);
    expect(result).not.toContain("stale content");
    expect(result).toContain(fragment);
    expect(result.indexOf(before)).toBeLessThan(result.indexOf(FRAGMENT_BEGIN));
    expect(result.indexOf(FRAGMENT_END)).toBeLessThan(result.indexOf(after));
  });

  it("is idempotent: applying it twice in a row produces identical output", () => {
    const existing = "# My Project\n\nSome instructions.\n";
    const once = upsertAgentsMd(existing, fragment);
    const twice = upsertAgentsMd(once, fragment);
    expect(twice).toBe(once);
  });
});
