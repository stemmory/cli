// stemmory-cli/packages/cli/src/cli.js
//
// Pure, testable core of the `stemmory` bin. `init`/`update`/`lint` are
// stories 5.2/5.3 — this scaffold (STEM-74) only wires up `--version` and a
// help message so the package is a real, installable CLI shape from day one.
// Kept as plain JSDoc-typed JS (checked via tsconfig's `checkJs`) rather than
// TypeScript because the bin script that calls it must run under plain
// `node` with no build/transpile step.
//
// Exit codes matter even for a scaffold (AGENT_CONVENTIONS_KIT_SPEC.md
// §2.3: "Exit codes CI-friendly"): a named-but-unimplemented command or an
// unrecognised argument must NOT exit 0, or an early adopter who wires
// `stemmory lint` into a pipeline today gets a permanent silent pass.

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

/** Real commands named in the spec, not yet implemented (stories 5.2/5.3). */
const UNIMPLEMENTED_COMMANDS = ["init", "lint", "update"];

/**
 * @param {string[]} argv - CLI arguments, e.g. `process.argv.slice(2)`.
 * @param {string} version - the installed package version.
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
export function runCli(argv, version) {
  if (argv.includes("--version") || argv.includes("-v")) {
    return { stdout: version, stderr: "", exitCode: 0 };
  }
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { stdout: HELP_TEXT, stderr: "", exitCode: 0 };
  }

  const [command] = argv;
  if (UNIMPLEMENTED_COMMANDS.includes(command)) {
    return {
      stdout: "",
      stderr: `stemmory ${command}: not implemented yet (scaffold build, STEM-74) - run "stemmory --help" for what's available.\n`,
      exitCode: 2,
    };
  }

  return {
    stdout: "",
    stderr: `stemmory: unknown command or option "${command}"\n\n${HELP_TEXT}\n`,
    exitCode: 2,
  };
}
