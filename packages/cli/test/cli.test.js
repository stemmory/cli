// stemmory-cli/packages/cli/src/cli.test.js
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HELP_TEXT, runCli } from "../src/cli.js";

describe("runCli", () => {
  it("prints the version to stdout with --version, exit 0", () => {
    expect(runCli(["--version"], "0.1.0")).toEqual({ stdout: "0.1.0", stderr: "", exitCode: 0 });
  });

  it("prints the version with -v", () => {
    expect(runCli(["-v"], "0.1.0").stdout).toBe("0.1.0");
  });

  it("prints help to stdout with no args, exit 0", () => {
    expect(runCli([], "0.1.0")).toEqual({ stdout: HELP_TEXT, stderr: "", exitCode: 0 });
  });

  it("prints help with --help", () => {
    expect(runCli(["--help"], "0.1.0").stdout).toBe(HELP_TEXT);
  });

  it("prints help with -h", () => {
    expect(runCli(["-h"], "0.1.0").stdout).toBe(HELP_TEXT);
  });

  it("exits 2 with usage on stderr for an unknown flag, not 0", () => {
    const result = runCli(["--bogus"], "0.1.0");
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--bogus");
    expect(result.stderr).toContain(HELP_TEXT);
  });

  it("exits 2 with usage on stderr for an unknown command", () => {
    const result = runCli(["frobnicate"], "0.1.0");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("frobnicate");
  });

  describe("init/update routing (cwd-scoped, real filesystem)", () => {
    /** @type {string} */
    let dir;
    beforeEach(() => {
      dir = mkdtempSync(path.join(os.tmpdir(), "stemmory-cli-routing-"));
    });
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it("routes `init` to the init command in the given cwd", () => {
      const result = runCli(["init"], "0.1.0", dir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("stemmory init:");
    });

    it("routes `update` to the update command in the given cwd", () => {
      runCli(["init"], "0.1.0", dir);
      const result = runCli(["update"], "0.1.0", dir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("stemmory update:");
    });

    it("`update` before `init` fails clearly instead of exiting 0", () => {
      const result = runCli(["update"], "0.1.0", dir);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("stemmory init");
    });

    it("routes `lint` to the lint command in the given cwd", () => {
      mkdirSync(path.join(dir, "docs", "features"), { recursive: true });
      const result = runCli(["lint"], "0.1.0", dir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("docs checked");
    });

    it("routes `lint` with a missing docs dir to exit 3, not 0 or 1", () => {
      const result = runCli(["lint"], "0.1.0", dir);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain("could not read");
    });
  });
});
