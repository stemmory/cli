// stemmory-cli/packages/cli/src/lib/config.test.js
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { CURRENT_SCHEMA_VERSION } from "@stemmory/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assertConfigWritable, buildConfig, configPath, readConfig, writeConfig } from "../../src/lib/config.js";

const FAKE_SECRET = "test-secret-do-not-leak-000111";

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
      schema: CURRENT_SCHEMA_VERSION,
      project: "acme",
      docsDir: "docs/features",
      linearTeam: "ACME",
      apiKey: null,
    });
  });

  it("stamps the schema field from @stemmory/schema's CURRENT_SCHEMA_VERSION, not a hardcoded literal (finding 14)", () => {
    const config = buildConfig({ project: "acme", docsDir: "docs/features", linearTeam: null, apiKey: null });
    expect(config.schema).toBe(CURRENT_SCHEMA_VERSION);
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
    writeConfig(dir, buildConfig({ project: "acme", docsDir: "docs/features", linearTeam: null, apiKey: FAKE_SECRET }));
    const mode = statSync(configPath(dir)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it.skipIf(process.platform === "win32")(
    "config.json ends up 0600 even if it previously existed with looser permissions (finding 18)",
    () => {
      mkdirSync(path.join(dir, ".stemmory"), { recursive: true });
      const file = configPath(dir);
      writeFileSync(file, "{}", { mode: 0o644 });
      writeConfig(dir, buildConfig({ project: "acme", docsDir: "docs/features", linearTeam: null, apiKey: FAKE_SECRET }));
      const mode = statSync(file).mode & 0o777;
      expect(mode).toBe(0o600);
    },
  );

  describe("readConfig - malformed config.json (findings 4 and 9)", () => {
    it("throws a short, non-crashing message on invalid JSON - never the raw SyntaxError with file content quoted back", () => {
      mkdirSync(path.join(dir, ".stemmory"), { recursive: true });
      writeFileSync(configPath(dir), `{ "apiKey": "${FAKE_SECRET}", oops }`);
      expect(() => readConfig(dir)).toThrow(/not valid JSON/i);
      try {
        readConfig(dir);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        expect(message).not.toContain(FAKE_SECRET);
        expect(message).not.toContain("SyntaxError");
      }
    });

    it("throws when a field is missing (e.g. docsDir), instead of silently returning a half-shaped config", () => {
      mkdirSync(path.join(dir, ".stemmory"), { recursive: true });
      writeFileSync(configPath(dir), JSON.stringify({ schema: 1, project: "acme", linearTeam: null, apiKey: null }));
      expect(() => readConfig(dir)).toThrow(/expected config shape/i);
    });

    it("throws when a field has the wrong type", () => {
      mkdirSync(path.join(dir, ".stemmory"), { recursive: true });
      writeFileSync(
        configPath(dir),
        JSON.stringify({ schema: "1", project: "acme", docsDir: "docs/features", linearTeam: null, apiKey: null }),
      );
      expect(() => readConfig(dir)).toThrow(/expected config shape/i);
    });
  });

  describe("assertConfigWritable - symlink/wrong-shape refusal (finding 10)", () => {
    it("does not throw when .stemmory and config.json don't exist yet", () => {
      expect(() => assertConfigWritable(dir)).not.toThrow();
    });

    it("throws when .stemmory exists as a plain file instead of a directory", () => {
      writeFileSync(path.join(dir, ".stemmory"), "not a directory");
      expect(() => assertConfigWritable(dir)).toThrow(/not a directory/i);
    });

    it("throws when config.json is a symlink", () => {
      const outside = mkdtempSync(path.join(os.tmpdir(), "stemmory-outside-"));
      const target = path.join(outside, "target.json");
      writeFileSync(target, "{}");
      mkdirSync(path.join(dir, ".stemmory"), { recursive: true });
      symlinkSync(target, configPath(dir));
      try {
        expect(() => assertConfigWritable(dir)).toThrow(/symlink/i);
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    });
  });
});
