// stemmory-cli/packages/cli/src/cli.test.js
import { describe, expect, it } from "vitest";

import { HELP_TEXT, runCli } from "./cli.js";

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

  it.each(["init", "lint", "update"])(
    "exits 2 on stderr for the unimplemented %s command, not 0",
    (command) => {
      const result = runCli([command], "0.1.0");
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(command);
    },
  );

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
});
