// stemmory-cli/packages/cli/src/commands/update.js
//
// `stemmory update` (AGENT_CONVENTIONS_KIT_SPEC.md §2.3): refreshes the
// AGENTS.md fragment and the installed skill in place via the idempotent
// markers, using the settings already recorded in .stemmory/config.json
// (init writes it; update reads it back rather than taking flags of its
// own - the spec's CLI table lists no flags for this command). Prints a
// changelog; never disturbs AGENTS.md content outside the markers.
//
// STEM-82 adversarial review: pre-flight every write target before the
// first write (finding 7), refuse rather than guess on malformed AGENTS.md
// markers (finding 1), back up SKILL.md before overwriting a hand-edited
// copy (finding 6), and surface a corrupt/malformed config.json as one
// clean line instead of a raw exception (findings 4, 9).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { readConfig } from "../lib/config.js";
import { isSafeDocsDir } from "../lib/docs-dir.js";
import { assertSafeDirTarget, assertSafeFileTarget, atomicWriteFile } from "../lib/fs-safety.js";
import { buildFragment, upsertAgentsMd } from "../lib/fragment.js";
import { ensureGitignoreHasStemmoryDir } from "../lib/gitignore.js";
import { buildSkillMarkdown, SKILL_NAME } from "../lib/skill.js";

/** @param {unknown} err */
function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * @param {string} cwd
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
export function runUpdate(cwd) {
  /** @type {import("../lib/config.js").StemmoryConfig | null} */
  let config;
  try {
    config = readConfig(cwd);
  } catch (err) {
    return { stdout: "", stderr: `stemmory update: ${errorMessage(err)}\n`, exitCode: 1 };
  }
  if (!config) {
    return {
      stdout: "",
      stderr: `stemmory update: no .stemmory/config.json found - run "stemmory init" first.\n`,
      exitCode: 1,
    };
  }
  if (!isSafeDocsDir(config.docsDir)) {
    return {
      stdout: "",
      stderr:
        "stemmory update: .stemmory/config.json's \"docsDir\" contains a newline or one of < > ` - fix it by hand.\n",
      exitCode: 1,
    };
  }

  const agentsPath = path.join(cwd, "AGENTS.md");
  const skillDir = path.join(cwd, ".claude", "skills", SKILL_NAME);
  const skillFile = path.join(skillDir, "SKILL.md");
  const skillBakFile = path.join(skillDir, "SKILL.md.bak");

  // Pre-flight before any write (finding 7/10).
  try {
    assertSafeFileTarget(agentsPath);
    assertSafeDirTarget(skillDir);
    assertSafeFileTarget(skillFile);
    assertSafeFileTarget(skillBakFile);
  } catch (err) {
    return { stdout: "", stderr: `stemmory update: ${errorMessage(err)}\n`, exitCode: 1 };
  }

  const existingAgents = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : null;
  const upserted = upsertAgentsMd(existingAgents, buildFragment(config.docsDir));
  if ("error" in upserted) {
    return { stdout: "", stderr: `stemmory update: ${upserted.error}\n`, exitCode: 1 };
  }

  const changes = [];

  if (upserted.content !== existingAgents) {
    atomicWriteFile(agentsPath, upserted.content, 0o644);
    changes.push("AGENTS.md fragment refreshed");
  } else {
    changes.push("AGENTS.md fragment already up to date");
  }

  // Whether a skill was ever installed (init ran with the default claude
  // agent vs. --agent generic) is read from disk, not re-asked - update
  // takes no --agent flag, so this is how it stays in sync with whatever
  // init actually did.
  if (existsSync(skillFile)) {
    const existingSkill = readFileSync(skillFile, "utf8");
    const newSkill = buildSkillMarkdown({ docsDir: config.docsDir, hasApiKey: Boolean(config.apiKey) });
    if (newSkill !== existingSkill) {
      // Back up whatever was there first (could be a hand edit, not just
      // a previous generated version) - `update` must never make local
      // changes to SKILL.md unrecoverable (finding 6).
      atomicWriteFile(skillBakFile, existingSkill, 0o644);
      atomicWriteFile(skillFile, newSkill, 0o644);
      changes.push(`${SKILL_NAME} skill refreshed (previous version saved to SKILL.md.bak)`);
    } else {
      changes.push(`${SKILL_NAME} skill already up to date`);
    }
  } else {
    changes.push(`${SKILL_NAME} skill not installed (nothing to refresh)`);
  }

  if (config.apiKey) {
    if (ensureGitignoreHasStemmoryDir(cwd)) {
      changes.push("added .stemmory/ to .gitignore (an API key is configured)");
    }
  }

  return { stdout: `stemmory update:\n${changes.map((c) => `  - ${c}`).join("\n")}\n`, stderr: "", exitCode: 0 };
}
