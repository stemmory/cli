// stemmory-cli/packages/cli/src/commands/init.test.js
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runInit } from "../../src/commands/init.js";

const SKILL_FILE_SEGMENTS = [".claude", "skills", "stemmory-conventions", "SKILL.md"];
// Deliberately inert-looking fake secrets: no "sk-" / "sk_live" style
// prefix and no real name, so these never look like a genuine credential
// to a human or a secret scanner (STEM-82 adversarial review finding 19).
const FAKE_KEY_1 = "test-secret-do-not-leak-000111";
const FAKE_KEY_2 = "test-secret-do-not-leak-222333";

describe("runInit", () => {
  /** @type {string} */
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "stemmory-init-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes config, the AGENTS.md fragment, and the claude skill by default", () => {
    const result = runInit(dir, []);
    expect(result.exitCode).toBe(0);
    expect(existsSync(path.join(dir, ".stemmory", "config.json"))).toBe(true);
    expect(existsSync(path.join(dir, "AGENTS.md"))).toBe(true);
    expect(existsSync(path.join(dir, ...SKILL_FILE_SEGMENTS))).toBe(true);
  });

  it("--agent generic skips the skill install but still writes fragment + config", () => {
    const result = runInit(dir, ["--agent", "generic"]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(path.join(dir, ".claude"))).toBe(false);
    expect(existsSync(path.join(dir, "AGENTS.md"))).toBe(true);
    expect(existsSync(path.join(dir, ".stemmory", "config.json"))).toBe(true);
  });

  it("running init twice changes nothing the second time (idempotent)", () => {
    runInit(dir, []);
    const agentsOnce = readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    const skillOnce = readFileSync(path.join(dir, ...SKILL_FILE_SEGMENTS), "utf8");
    const configOnce = readFileSync(path.join(dir, ".stemmory", "config.json"), "utf8");

    runInit(dir, []);

    expect(readFileSync(path.join(dir, "AGENTS.md"), "utf8")).toBe(agentsOnce);
    expect(readFileSync(path.join(dir, ...SKILL_FILE_SEGMENTS), "utf8")).toBe(skillOnce);
    expect(readFileSync(path.join(dir, ".stemmory", "config.json"), "utf8")).toBe(configOnce);
  });

  it("preserves substantial pre-existing AGENTS.md content, including content after the fragment", () => {
    const agentsPath = path.join(dir, "AGENTS.md");
    const before = "# My Project\n\nBuild with `pnpm build`. Deploy via CI only.";
    const after = "## Team norms\nAlways write tests. Never merge red CI.";
    writeFileSync(agentsPath, `${before}\n`);

    runInit(dir, []); // first run: appends the fragment after `before`
    writeFileSync(agentsPath, `${readFileSync(agentsPath, "utf8").trimEnd()}\n\n${after}\n`);
    runInit(dir, []); // second run: must refresh the fragment in place, not disturb before/after

    const final = readFileSync(agentsPath, "utf8");
    expect(final).toContain(before);
    expect(final).toContain(after);
    expect(final.indexOf(before)).toBeLessThan(final.indexOf("stemmory:begin"));
    expect(final.indexOf("stemmory:end")).toBeLessThan(final.indexOf(after));
  });

  describe("secret handling", () => {
    it("never leaks the api key into stdout or stderr (space-separated form)", () => {
      const result = runInit(dir, ["--api-key", FAKE_KEY_1]);
      expect(result.stdout).not.toContain(FAKE_KEY_1);
      expect(result.stderr).not.toContain(FAKE_KEY_1);
      const config = JSON.parse(readFileSync(path.join(dir, ".stemmory", "config.json"), "utf8"));
      expect(config.apiKey).toBe(FAKE_KEY_1);
    });

    it("accepts --api-key=VALUE and never echoes the value (finding 3, repro #1)", () => {
      const result = runInit(dir, [`--api-key=${FAKE_KEY_1}`]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain(FAKE_KEY_1);
      expect(result.stderr).not.toContain(FAKE_KEY_1);
      const config = JSON.parse(readFileSync(path.join(dir, ".stemmory", "config.json"), "utf8"));
      expect(config.apiKey).toBe(FAKE_KEY_1);
    });

    it("treats a value-less --linear-team followed by --api-key as a missing value, not a swallowed flag (finding 3, repro #2)", () => {
      const result = runInit(dir, ["--linear-team", "--api-key", FAKE_KEY_1]);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("--linear-team");
      expect(result.stderr).not.toContain(FAKE_KEY_1);
      // Nothing should have been written - the key was never even parsed
      // as a value, so it definitely shouldn't reach disk here.
      expect(existsSync(path.join(dir, ".stemmory", "config.json"))).toBe(false);
    });

    it("an unknown --flag=value option never echoes the value half, only the flag name", () => {
      const result = runInit(dir, [`--apikey=${FAKE_KEY_1}`]); // typo'd flag name
      expect(result.exitCode).toBe(2);
      expect(result.stderr).not.toContain(FAKE_KEY_1);
      expect(result.stderr).toContain("--apikey");
    });
  });

  it.skipIf(process.platform === "win32")("writes .stemmory/config.json with 0600 permissions", () => {
    runInit(dir, ["--api-key", FAKE_KEY_1]);
    const mode = statSync(path.join(dir, ".stemmory", "config.json")).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("rejects an unknown flag with exit 2", () => {
    const result = runInit(dir, ["--nope"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--nope");
  });

  it("rejects an invalid --agent value with exit 2", () => {
    const result = runInit(dir, ["--agent", "bogus"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("bogus");
  });

  it("honors --docs-dir in both config.json and the fragment", () => {
    runInit(dir, ["--docs-dir", "documentation/features"]);
    const config = JSON.parse(readFileSync(path.join(dir, ".stemmory", "config.json"), "utf8"));
    expect(config.docsDir).toBe("documentation/features");
    expect(readFileSync(path.join(dir, "AGENTS.md"), "utf8")).toContain("documentation/features/<slug>.md");
  });

  it("rejects a --docs-dir value that could break out of the fragment/YAML (finding 13)", () => {
    const result = runInit(dir, ["--docs-dir", "docs/features\n<!-- stemmory:end -->"]);
    expect(result.exitCode).toBe(2);
    expect(existsSync(path.join(dir, "AGENTS.md"))).toBe(false);
  });

  it("records --linear-team in config.json", () => {
    runInit(dir, ["--linear-team", "STEM"]);
    const config = JSON.parse(readFileSync(path.join(dir, ".stemmory", "config.json"), "utf8"));
    expect(config.linearTeam).toBe("STEM");
  });

  it("derives the project slug from package.json's name when present", () => {
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "@acme/Storefront App" }));
    runInit(dir, []);
    const config = JSON.parse(readFileSync(path.join(dir, ".stemmory", "config.json"), "utf8"));
    expect(config.project).toBe("acme-storefront-app");
  });

  describe("re-running init merges rather than clobbers (finding 5)", () => {
    it("preserves a previously configured api key and linear team when re-run with only --docs-dir", () => {
      runInit(dir, ["--api-key", FAKE_KEY_1, "--linear-team", "STEM"]);

      runInit(dir, ["--docs-dir", "documentation/features"]);

      const config = JSON.parse(readFileSync(path.join(dir, ".stemmory", "config.json"), "utf8"));
      expect(config.apiKey).toBe(FAKE_KEY_1);
      expect(config.linearTeam).toBe("STEM");
      expect(config.docsDir).toBe("documentation/features");
      // The Tier 2 section must still be there - it was silently dropped
      // in the reproduced bug because apiKey got reset to null.
      const skill = readFileSync(path.join(dir, ...SKILL_FILE_SEGMENTS), "utf8");
      expect(skill).toMatch(/Tier 2/i);
    });

    it("changing the api key on a later run only changes the key, not the linear team", () => {
      runInit(dir, ["--api-key", FAKE_KEY_1, "--linear-team", "STEM"]);
      runInit(dir, ["--api-key", FAKE_KEY_2]);
      const config = JSON.parse(readFileSync(path.join(dir, ".stemmory", "config.json"), "utf8"));
      expect(config.apiKey).toBe(FAKE_KEY_2);
      expect(config.linearTeam).toBe("STEM");
    });

    it("--api-key '' explicitly clears a previously configured key", () => {
      runInit(dir, ["--api-key", FAKE_KEY_1]);
      runInit(dir, ["--api-key", ""]);
      const config = JSON.parse(readFileSync(path.join(dir, ".stemmory", "config.json"), "utf8"));
      expect(config.apiKey).toBeNull();
      const skill = readFileSync(path.join(dir, ...SKILL_FILE_SEGMENTS), "utf8");
      expect(skill).not.toMatch(/Tier 2/i);
    });
  });

  describe("symlink refusal (finding 10)", () => {
    it("refuses to write through a symlinked AGENTS.md, and touches nothing else", () => {
      const outside = mkdtempSync(path.join(os.tmpdir(), "stemmory-outside-"));
      const outsideFile = path.join(outside, "real-target.md");
      const originalContent = "# Some unrelated file that happens to be symlink target\n";
      writeFileSync(outsideFile, originalContent);
      symlinkSync(outsideFile, path.join(dir, "AGENTS.md"));

      try {
        const result = runInit(dir, []);
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toMatch(/symlink/i);
        // The symlink target must be untouched.
        expect(readFileSync(outsideFile, "utf8")).toBe(originalContent);
        // Nothing should have been written inside the project either -
        // pre-flight runs before the first write (finding 7).
        expect(existsSync(path.join(dir, ".stemmory"))).toBe(false);
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    });
  });

  describe(".gitignore (finding 2)", () => {
    it("adds .stemmory/ to .gitignore when an api key is configured", () => {
      runInit(dir, ["--api-key", FAKE_KEY_1]);
      const gitignore = readFileSync(path.join(dir, ".gitignore"), "utf8");
      expect(gitignore.split("\n")).toContain(".stemmory/");
    });

    it("does not touch .gitignore when no api key is configured", () => {
      runInit(dir, []);
      expect(existsSync(path.join(dir, ".gitignore"))).toBe(false);
    });

    it("is idempotent: running init twice with an api key doesn't duplicate the entry", () => {
      runInit(dir, ["--api-key", FAKE_KEY_1]);
      runInit(dir, ["--api-key", FAKE_KEY_1]);
      const lines = readFileSync(path.join(dir, ".gitignore"), "utf8").split("\n");
      expect(lines.filter((l) => l.trim() === ".stemmory/")).toHaveLength(1);
    });

    it("appends to an existing .gitignore without disturbing its content", () => {
      writeFileSync(path.join(dir, ".gitignore"), "node_modules/\ndist/\n");
      runInit(dir, ["--api-key", FAKE_KEY_1]);
      const gitignore = readFileSync(path.join(dir, ".gitignore"), "utf8");
      expect(gitignore).toContain("node_modules/");
      expect(gitignore).toContain("dist/");
      expect(gitignore).toContain(".stemmory/");
    });
  });

  it("a corrupt existing config.json fails cleanly (exit 1, no stack trace, no secret echoed) instead of crashing", () => {
    mkdirSync(path.join(dir, ".stemmory"), { recursive: true });
    writeFileSync(path.join(dir, ".stemmory", "config.json"), `{ "apiKey": "${FAKE_KEY_1}", oops }`);

    const result = runInit(dir, []);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not valid JSON/i);
    expect(result.stderr).not.toContain(FAKE_KEY_1);
    expect(result.stderr).not.toContain("SyntaxError");
  });

  it("leaves no stray temp files behind after a normal run (finding 8, atomic writes)", () => {
    runInit(dir, ["--api-key", FAKE_KEY_1]);
    /** @param {string} root @returns {string[]} */
    const findTmp = (root) => {
      /** @type {string[]} */
      const found = [];
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        const full = path.join(root, entry.name);
        if (entry.name.includes("stemmory-tmp-")) found.push(full);
        else if (entry.isDirectory()) found.push(...findTmp(full));
      }
      return found;
    };
    expect(findTmp(dir)).toEqual([]);
  });
});
