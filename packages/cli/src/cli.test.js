// stemmory-cli/packages/cli/src/cli.test.js
import { describe, expect, it } from "vitest";

import { HELP_TEXT, runCli } from "./cli.js";

describe("runCli", () => {
  it("prints the version with --version", () => {
    expect(runCli(["--version"], "0.1.0")).toEqual({ output: "0.1.0", exitCode: 0 });
  });

  it("prints the version with -v", () => {
    expect(runCli(["-v"], "0.1.0").output).toBe("0.1.0");
  });

  it("prints help with no args", () => {
    expect(runCli([], "0.1.0")).toEqual({ output: HELP_TEXT, exitCode: 0 });
  });

  it("prints help with --help", () => {
    expect(runCli(["--help"], "0.1.0").output).toBe(HELP_TEXT);
  });

  it("falls back to help for an unknown flag rather than erroring", () => {
    expect(runCli(["--bogus"], "0.1.0").output).toBe(HELP_TEXT);
  });
});
