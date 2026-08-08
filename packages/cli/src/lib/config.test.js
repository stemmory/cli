// stemmory-cli/packages/cli/src/lib/config.test.js
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildConfig, configPath, readConfig, writeConfig } from "./config.js";

describe("config", () => {
  /** @type {string} */
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "stemmory-config-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes the documented shape from AGENT_CONVENTIONS_KIT_SPEC.md §2.3", () => {
    writeConfig(dir, buildConfig({ project: "acme", docsDir: "docs/features", linearTeam: "ACME", apiKey: null }));
    const written = JSON.parse(readFileSync(configPath(dir), "utf8"));
    expect(written).toEqual({
      schema: 1,
      project: "acme",
      docsDir: "docs/features",
      linearTeam: "ACME",
      apiKey: null,
    });
  });

  it("round-trips through readConfig", () => {
    const config = buildConfig({ project: "acme", docsDir: "docs/features", linearTeam: null, apiKey: null });
    writeConfig(dir, config);
    expect(readConfig(dir)).toEqual(config);
  });

  it("returns null when no config exists yet", () => {
    expect(readConfig(dir)).toBeNull();
  });

  it("creates the .stemmory directory if missing", () => {
    writeConfig(dir, buildConfig({ project: "acme", docsDir: "docs/features", linearTeam: null, apiKey: null }));
    expect(statSync(path.join(dir, ".stemmory")).isDirectory()).toBe(true);
  });

  it.skipIf(process.platform === "win32")("writes the config file with 0600 permissions", () => {
    writeConfig(
      dir,
      buildConfig({ project: "acme", docsDir: "docs/features", linearTeam: null, apiKey: "sk-test-secret" }),
    );
    const mode = statSync(configPath(dir)).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
