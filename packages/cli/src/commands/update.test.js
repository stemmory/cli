// stemmory-cli/packages/cli/src/commands/update.test.js
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runInit } from "./init.js";
import { runUpdate } from "./update.js";

const SKILL_FILE_SEGMENTS = [".claude", "skills", "stemmory-conventions", "SKILL.md"];

describe("runUpdate", () => {
  /** @type {string} */
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "stemmory-update-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("errors clearly (not exit 0) if init hasn't run yet", () => {
    const result = runUpdate(dir);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("stemmory init");
  });

  it("refreshes the fragment and skill in place, printing a changelog", () => {
    runInit(dir, []);
    const result = runUpdate(dir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("stemmory update:");
    expect(result.stdout).toContain("AGENTS.md fragment");
    expect(result.stdout).toContain("stemmory-conventions skill");
  });

  it("does not disturb AGENTS.md content outside the markers", () => {
    runInit(dir, []);
    const agentsPath = path.join(dir, "AGENTS.md");
    const withCustomContent = `# Custom heading\n\n${readFileSync(agentsPath, "utf8").trimEnd()}\n\n## After\ncustom trailing content\n`;
    writeFileSync(agentsPath, withCustomContent);

    runUpdate(dir);

    const final = readFileSync(agentsPath, "utf8");
    expect(final).toContain("# Custom heading");
    expect(final).toContain("## After\ncustom trailing content");
  });

  it("running update twice in a row changes nothing the second time", () => {
    runInit(dir, []);
    runUpdate(dir);
    const agentsOnce = readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    const skillOnce = readFileSync(path.join(dir, ...SKILL_FILE_SEGMENTS), "utf8");

    const second = runUpdate(dir);

    expect(readFileSync(path.join(dir, "AGENTS.md"), "utf8")).toBe(agentsOnce);
    expect(readFileSync(path.join(dir, ...SKILL_FILE_SEGMENTS), "utf8")).toBe(skillOnce);
    expect(second.stdout).toContain("already up to date");
  });

  it("does not install or touch a skill when init used --agent generic", () => {
    runInit(dir, ["--agent", "generic"]);
    const result = runUpdate(dir);
    expect(existsSync(path.join(dir, ".claude"))).toBe(false);
    expect(result.stdout).toContain("not installed");
  });

  it("adds the Tier 2 section to the skill once an api key is configured via init", () => {
    runInit(dir, ["--api-key", "sk-test-secret"]);
    runUpdate(dir);
    const skill = readFileSync(path.join(dir, ...SKILL_FILE_SEGMENTS), "utf8");
    expect(skill).toMatch(/Tier 2/i);
  });

  it("never leaks the api key into stdout or stderr", () => {
    const secret = "sk-live-do-not-leak-update-token";
    runInit(dir, ["--api-key", secret]);
    const result = runUpdate(dir);
    expect(result.stdout).not.toContain(secret);
    expect(result.stderr).not.toContain(secret);
  });
});
