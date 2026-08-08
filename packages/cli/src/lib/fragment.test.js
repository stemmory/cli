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

  it("declares itself machine-owned (§6 clobber mitigation)", () => {
    expect(buildFragment("docs/features")).toMatch(/machine-owned/i);
  });
});

describe("upsertAgentsMd - well-formed inputs", () => {
  const fragment = buildFragment("docs/features");

  it("creates a minimal AGENTS.md when none exists", () => {
    expect(upsertAgentsMd(null, fragment)).toEqual({ content: `${fragment}\n` });
  });

  it("appends the fragment to existing content without altering it (no markers yet)", () => {
    const existing = "# My Project\n\nSome instructions here.\n";
    const result = upsertAgentsMd(existing, fragment);
    if (!("content" in result)) throw new Error("expected a content result");
    expect(result.content).toContain(existing.trim());
    expect(result.content).toContain(fragment);
    expect(result.content.indexOf(existing.trim())).toBeLessThan(result.content.indexOf(FRAGMENT_BEGIN));
  });

  it("replaces an existing well-formed marked block in place, leaving content before/after untouched", () => {
    const before = "# My Project\nSome instructions.";
    const after = "## Team norms\nDon't break prod.";
    const oldFragment = [FRAGMENT_BEGIN, "## Stemmory conventions", "stale content", FRAGMENT_END].join("\n");
    const existing = `${before}\n\n${oldFragment}\n\n${after}\n`;

    const result = upsertAgentsMd(existing, fragment);
    if (!("content" in result)) throw new Error("expected a content result");

    expect(result.content).toContain(before);
    expect(result.content).toContain(after);
    expect(result.content).not.toContain("stale content");
    expect(result.content).toContain(fragment);
    expect(result.content.indexOf(before)).toBeLessThan(result.content.indexOf(FRAGMENT_BEGIN));
    expect(result.content.indexOf(FRAGMENT_END)).toBeLessThan(result.content.indexOf(after));
  });

  it("is idempotent: applying it twice in a row produces identical output", () => {
    const existing = "# My Project\n\nSome instructions.\n";
    const once = upsertAgentsMd(existing, fragment);
    if (!("content" in once)) throw new Error("expected a content result");
    const twice = upsertAgentsMd(once.content, fragment);
    expect(twice).toEqual(once);
  });
});

describe("upsertAgentsMd - malformed/hostile marker states (STEM-82 finding 1, CRITICAL)", () => {
  const fragment = buildFragment("docs/features");

  it("refuses an orphan BEGIN with no END - byte-for-byte: returns only an error, no content to accidentally write", () => {
    // Reproduction from the adversarial review: a stray BEGIN marker
    // followed by real prose and no matching END (e.g. a user paste, or a
    // botched merge of two branches that both ran `init`). The previous
    // implementation matched markers with a non-greedy regex
    // (`BEGIN[\s\S]*?END`); it wouldn't match THIS input, but a second
    // `init`/`update` run against its own output (now two BEGINs, one
    // END) matched orphan-BEGIN -> new-END and silently deleted
    // everything between them, including unrelated content. The fix
    // refuses outright instead of guessing a deletion range.
    const before = "# DEPLOY RUNBOOK";
    const hostile = [
      before,
      "",
      FRAGMENT_BEGIN, // orphan - no matching END anywhere in the file
      "",
      "never deploy on friday",
      "",
      "## Team norms",
      "some other real content",
    ].join("\n");

    const result = upsertAgentsMd(hostile, fragment);

    expect(result).toHaveProperty("error");
    expect(Object.keys(result)).toEqual(["error"]); // no "content" key alongside it
    expect(/** @type {{ error: string }} */ (result).error).toMatch(/malformed|duplicat/i);
  });

  it("refuses two BEGINs and one END (the state a second run against the orphan case above would produce)", () => {
    const hostile = [
      "# DEPLOY RUNBOOK",
      FRAGMENT_BEGIN,
      "never deploy on friday",
      "## Team norms",
      "some other real content",
      FRAGMENT_BEGIN,
      "## Stemmory conventions",
      "whatever got appended",
      FRAGMENT_END,
    ].join("\n");

    expect(upsertAgentsMd(hostile, fragment)).toHaveProperty("error");
  });

  it("refuses an END with no BEGIN", () => {
    const hostile = `# Notes\nsome content\n${FRAGMENT_END}\nmore content\n`;
    expect(upsertAgentsMd(hostile, fragment)).toHaveProperty("error");
  });

  it("refuses one BEGIN and two ENDs", () => {
    const hostile = `# Notes\n${FRAGMENT_BEGIN}\nbody\n${FRAGMENT_END}\ntrailing\n${FRAGMENT_END}\n`;
    expect(upsertAgentsMd(hostile, fragment)).toHaveProperty("error");
  });

  it("refuses END appearing before BEGIN (reversed order)", () => {
    const hostile = `# Notes\n${FRAGMENT_END}\nbody\n${FRAGMENT_BEGIN}\n`;
    expect(upsertAgentsMd(hostile, fragment)).toHaveProperty("error");
  });
});
