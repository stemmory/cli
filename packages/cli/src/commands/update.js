// stemmory-cli/packages/cli/src/commands/update.js
//
// `stemmory update` (AGENT_CONVENTIONS_KIT_SPEC.md §2.3): refreshes the
// AGENTS.md fragment and the installed skill in place via the idempotent
// markers, using the settings already recorded in .stemmory/config.json
// (init writes it; update reads it back rather than taking flags of its
// own - the spec's CLI table lists no flags for this command). Prints a
// changelog; never disturbs AGENTS.md content outside the markers.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readConfig } from "../lib/config.js";
import { buildFragment, upsertAgentsMd } from "../lib/fragment.js";
import { buildSkillMarkdown, SKILL_NAME } from "../lib/skill.js";

/**
 * @param {string} cwd
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
export function runUpdate(cwd) {
  const config = readConfig(cwd);
  if (!config) {
    return {
      stdout: "",
      stderr: `stemmory update: no .stemmory/config.json found - run "stemmory init" first.\n`,
      exitCode: 1,
    };
  }

  const changes = [];

  const agentsPath = path.join(cwd, "AGENTS.md");
  const existingAgents = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : null;
  const newAgents = upsertAgentsMd(existingAgents, buildFragment(config.docsDir));
  if (newAgents !== existingAgents) {
    writeFileSync(agentsPath, newAgents);
    changes.push("AGENTS.md fragment refreshed");
  } else {
    changes.push("AGENTS.md fragment already up to date");
  }

  // Whether a skill was ever installed (init ran with the default
  // claude agent vs. --agent generic) is read from disk, not re-asked -
  // update takes no --agent flag, so this is how it stays in sync with
  // whatever init actually did.
  const skillDir = path.join(cwd, ".claude", "skills", SKILL_NAME);
  const skillFile = path.join(skillDir, "SKILL.md");
  if (existsSync(skillFile)) {
    const existingSkill = readFileSync(skillFile, "utf8");
    const newSkill = buildSkillMarkdown({ docsDir: config.docsDir, hasApiKey: Boolean(config.apiKey) });
    if (newSkill !== existingSkill) {
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(skillFile, newSkill);
      changes.push(`${SKILL_NAME} skill refreshed`);
    } else {
      changes.push(`${SKILL_NAME} skill already up to date`);
    }
  } else {
    changes.push(`${SKILL_NAME} skill not installed (nothing to refresh)`);
  }

  return { stdout: `stemmory update:\n${changes.map((c) => `  - ${c}`).join("\n")}\n`, stderr: "", exitCode: 0 };
}
