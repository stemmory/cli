// stemmory-cli/packages/cli/src/commands/init.js
//
// `stemmory init` (AGENT_CONVENTIONS_KIT_SPEC.md §2.3): writes
// .stemmory/config.json, upserts the AGENTS.md fragment, and - unless
// --agent generic - installs the stemmory-conventions skill into the
// project's skills dir. Fully offline: no telemetry, no network call.
//
// Agent detection is deliberately simple: `--agent` picks it, default is
// "claude" (the only concretely supported skills-dir convention today -
// ONBOARDING_IMPORT_SPEC.md §6 open item 2). Auto-sniffing a wider set of
// agent harnesses is exactly the kind of speculative branching to add when
// a second one is actually supported, not before.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildConfig, writeConfig } from "../lib/config.js";
import { buildFragment, upsertAgentsMd } from "../lib/fragment.js";
import { buildSkillMarkdown, SKILL_NAME } from "../lib/skill.js";
import { deriveProjectSlug } from "../lib/slug-util.js";

const DEFAULT_DOCS_DIR = "docs/features";
const VALID_AGENTS = ["claude", "generic"];

/**
 * @typedef {{ docsDir: string, linearTeam: string | null, apiKey: string | null, agent: "claude" | "generic" }} InitFlags
 */

/**
 * @param {string[]} args - argv after the "init" command word.
 * @returns {{ value: InitFlags } | { error: string }}
 */
export function parseInitArgs(args) {
  /** @type {{ docsDir: string | undefined, linearTeam: string | null | undefined, apiKey: string | null | undefined, agent: string | undefined }} */
  const flags = { docsDir: DEFAULT_DOCS_DIR, linearTeam: null, apiKey: null, agent: "claude" };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--docs-dir") flags.docsDir = args[++i];
    else if (arg === "--linear-team") flags.linearTeam = args[++i];
    else if (arg === "--api-key") flags.apiKey = args[++i];
    else if (arg === "--agent") flags.agent = args[++i];
    else return { error: `unknown option "${arg}"` };
  }

  if (flags.docsDir === undefined) return { error: "--docs-dir requires a value" };
  if (flags.linearTeam === undefined) return { error: "--linear-team requires a value" };
  if (flags.apiKey === undefined) return { error: "--api-key requires a value" };
  if (flags.agent === undefined) return { error: "--agent requires a value" };
  if (!VALID_AGENTS.includes(flags.agent)) {
    return { error: `--agent must be "claude" or "generic", got "${flags.agent}"` };
  }

  return {
    value: {
      docsDir: flags.docsDir,
      linearTeam: flags.linearTeam,
      apiKey: flags.apiKey,
      agent: /** @type {"claude" | "generic"} */ (flags.agent),
    },
  };
}

/**
 * @param {string} cwd
 * @param {string[]} args - argv after the "init" command word.
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
export function runInit(cwd, args) {
  const parsed = parseInitArgs(args);
  if ("error" in parsed) {
    return { stdout: "", stderr: `stemmory init: ${parsed.error}\n`, exitCode: 2 };
  }
  const { docsDir, linearTeam, apiKey, agent } = parsed.value;

  const project = deriveProjectSlug(cwd);
  writeConfig(cwd, buildConfig({ project, docsDir, linearTeam, apiKey }));

  const agentsPath = path.join(cwd, "AGENTS.md");
  const existingAgents = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : null;
  writeFileSync(agentsPath, upsertAgentsMd(existingAgents, buildFragment(docsDir)));

  const lines = [
    "stemmory init:",
    "  - wrote .stemmory/config.json",
    existingAgents === null
      ? "  - created AGENTS.md with the stemmory fragment"
      : "  - updated the stemmory fragment in AGENTS.md",
  ];

  if (agent === "claude") {
    const skillDir = path.join(cwd, ".claude", "skills", SKILL_NAME);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, "SKILL.md"), buildSkillMarkdown({ docsDir, hasApiKey: Boolean(apiKey) }));
    lines.push(`  - installed the ${SKILL_NAME} skill (.claude/skills/${SKILL_NAME}/SKILL.md)`);
  } else {
    lines.push("  - skipped skill install (--agent generic is fragment-only)");
  }

  // Never interpolate `apiKey`/`linearTeam` values into stdout below this
  // point - only static, non-secret status lines belong here.
  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}
