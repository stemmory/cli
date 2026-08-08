// stemmory-cli/packages/cli/src/cli.js
//
// Pure, testable core of the `stemmory` bin. `init` and `update` are story
// 5.2 (STEM-82); `lint` is still story 5.3's scaffold placeholder. Kept as
// plain JSDoc-typed JS (checked via tsconfig's `checkJs`) rather than
// TypeScript because the bin script that calls it must run under plain
// `node` with no build/transpile step.
//
// Exit codes matter (AGENT_CONVENTIONS_KIT_SPEC.md §2.3: "Exit codes
// CI-friendly"): a named-but-unimplemented command or an unrecognised
// argument must NOT exit 0, or an early adopter who wires `stemmory lint`
// into a pipeline today gets a permanent silent pass.
import { runInit } from "./commands/init.js";
import { runUpdate } from "./commands/update.js";

export const HELP_TEXT = `stemmory - Stemmory Conventions Kit CLI

Usage:
  stemmory <command> [options]

Commands:
  init      Install the conventions skill + AGENTS.md fragment
  lint      Validate docs/features/*.md against schema v1 (coming soon)
  update    Refresh the installed skill + fragment in place

Init options:
  --docs-dir <dir>          Feature docs directory (default: docs/features)
  --linear-team <key>       Linear team key to record in .stemmory/config.json
  --api-key <key>           Stemmory API key (Tier 2 MCP write config)
  --agent <claude|generic>  Target agent; generic = fragment-only, no skill
                             install (default: claude)

Options:
  --version, -v   Print the installed version
  --help, -h      Show this help message

lint is not implemented yet.`;

/** Real commands named in the spec, not yet implemented (story 5.3). */
const UNIMPLEMENTED_COMMANDS = ["lint"];

/**
 * @param {string[]} argv - CLI arguments, e.g. `process.argv.slice(2)`.
 * @param {string} version - the installed package version.
 * @param {string} [cwd] - working directory to operate in; defaults to `process.cwd()`.
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
export function runCli(argv, version, cwd = process.cwd()) {
  if (argv.includes("--version") || argv.includes("-v")) {
    return { stdout: version, stderr: "", exitCode: 0 };
  }
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { stdout: HELP_TEXT, stderr: "", exitCode: 0 };
  }

  const [command, ...rest] = argv;

  if (command === "init") return runInit(cwd, rest);
  if (command === "update") return runUpdate(cwd);

  if (UNIMPLEMENTED_COMMANDS.includes(command)) {
    return {
      stdout: "",
      stderr: `stemmory ${command}: not implemented yet - run "stemmory --help" for what's available.\n`,
      exitCode: 2,
    };
  }

  return {
    stdout: "",
    stderr: `stemmory: unknown command or option "${command}"\n\n${HELP_TEXT}\n`,
    exitCode: 2,
  };
}
