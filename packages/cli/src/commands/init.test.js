// stemmory-cli/packages/cli/src/commands/init.test.js
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runInit } from "./init.js";

const SKILL_FILE_SEGMENTS = [".claude", "skills", "stemmory-conventions", "SKILL.md"];

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

  it("never leaks the api key into stdout or stderr", () => {
    const secret = "sk-live-do-not-leak-vamsi-test-token";
    const result = runInit(dir, ["--api-key", secret]);
    expect(result.stdout).not.toContain(secret);
    expect(result.stderr).not.toContain(secret);
    const config = JSON.parse(readFileSync(path.join(dir, ".stemmory", "config.json"), "utf8"));
    expect(config.apiKey).toBe(secret);
  });

  it.skipIf(process.platform === "win32")("writes .stemmory/config.json with 0600 permissions", () => {
    runInit(dir, ["--api-key", "sk-test-secret"]);
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
});
