// stemmory-cli/packages/cli/src/cli.js
//
// Pure, testable core of the `stemmory` bin. `init`/`update`/`lint` are
// stories 5.2/5.3 — this scaffold (STEM-74) only wires up `--version` and a
// help message so the package is a real, installable CLI shape from day one.
// Kept as plain JSDoc-typed JS (checked via tsconfig's `checkJs`) rather than
// TypeScript because the bin script that calls it must run under plain
// `node` with no build/transpile step.

export const HELP_TEXT = `stemmory - Stemmory Conventions Kit CLI

Usage:
  stemmory <command> [options]

Commands:
  init      Install the conventions skill + AGENTS.md fragment (coming soon)
  lint      Validate docs/features/*.md against schema v1 (coming soon)
  update    Refresh the installed skill + fragment in place (coming soon)

Options:
  --version, -v   Print the installed version
  --help, -h      Show this help message

This is a scaffold build (STEM-74) - init/update/lint are not implemented yet.`;

/**
 * @param {string[]} argv - CLI arguments, e.g. `process.argv.slice(2)`.
 * @param {string} version - the installed package version.
 * @returns {{ output: string, exitCode: number }}
 */
export function runCli(argv, version) {
  if (argv.includes("--version") || argv.includes("-v")) {
    return { output: version, exitCode: 0 };
  }
  return { output: HELP_TEXT, exitCode: 0 };
}
