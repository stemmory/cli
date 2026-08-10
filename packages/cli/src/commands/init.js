// stemmory-cli/packages/cli/src/commands/init.js
//
// `stemmory init`: writes
//.stemmory/config.json, upserts the AGENTS.md fragment, and - unless
// --agent generic - installs the stemmory-conventions skill into the
// project's skills dir. Fully offline: no telemetry, no network call.
//
// adversarial review reshaped this file around one rule: validate
// and compute everything FIRST (pure), and only then write - and even
// then, write the files that hold no secret before the one that does
//. A run that fails partway through never leaves an API key
// on disk without the rest of the install, and never leaves a
// syntactically-broken AGENTS.md behind (, 8, 10).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { assertConfigWritable, buildConfig, readConfig, writeConfig } from "../lib/config.js";
import { isSafeDocsDir } from "../lib/docs-dir.js";
import { assertSafeDirTarget, assertSafeFileTarget, atomicWriteFile } from "../lib/fs-safety.js";
import { buildFragment, upsertAgentsMd } from "../lib/fragment.js";
import { ensureGitignoreHasStemmoryDir } from "../lib/gitignore.js";
import { buildSkillMarkdown, SKILL_NAME } from "../lib/skill.js";
import { deriveProjectSlug } from "../lib/slug-util.js";

const DEFAULT_DOCS_DIR = "docs/features";
const VALID_AGENTS = ["claude", "generic"];
const FLAG_TO_KEY = /** @type {const} */ ({
  "--docs-dir": "docsDir",
  "--linear-team": "linearTeam",
  "--api-key": "apiKey",
  "--agent": "agent",
});

/**
 * @typedef {{ docsDir: string | undefined, linearTeam: string | undefined, apiKey: string | undefined, agent: string | undefined }} RawInitFlags
 */

/**
 * Supports `--flag value` and `--flag=value`. A value that itself looks
 * like a flag (`--foo`) is treated as a missing value, not silently
 * consumed - the fix for, where
 * `--linear-team --api-key sk-...` swallowed the next flag's own value as
 * `--linear-team`'s argument and then echoed it back in an error. Error
 * messages below only ever name the FLAG, never a value - an api-key typo
 * must never come back out on stderr.
 * @param {string[]} args
 * @returns {{ value: RawInitFlags } | { error: string }}
 */
function parseRawFlags(args) {
  /** @type {Record<string, string | undefined>} */
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const eqIdx = arg.indexOf("=");
    const flagName = eqIdx === -1 ? arg : arg.slice(0, eqIdx);
    const key = FLAG_TO_KEY[/** @type {keyof typeof FLAG_TO_KEY} */ (flagName)];
    if (!key) return { error: `unknown option "${flagName}"` };

    if (eqIdx !== -1) {
      flags[key] = arg.slice(eqIdx + 1);
      continue;
    }
    const next = args[i + 1];
    if (next === undefined || next.startsWith("--")) {
      return { error: `${flagName} requires a value` };
    }
    flags[key] = next;
    i++;
  }
  return { value: /** @type {RawInitFlags} */ (flags) };
}

/**
 * @typedef {{ docsDir: string | undefined, linearTeam: string | undefined, apiKey: string | undefined, agent: "claude" | "generic" | undefined }} InitFlags
 * - `undefined` on `docsDir`/`linearTeam`/`apiKey` means "not passed - keep
 *   whatever's already in config.json, or fall back to the default on a
 *   first run". An explicit empty string
 *   (`--api-key ""`) is a deliberate clear, distinct from "not passed".
 */

/**
 * @param {string[]} args - argv after the "init" command word.
 * @returns {{ value: InitFlags } | { error: string }}
 */
export function parseInitArgs(args) {
  const raw = parseRawFlags(args);
  if ("error" in raw) return raw;
  const { docsDir, linearTeam, apiKey, agent } = raw.value;

  if (agent !== undefined && !VALID_AGENTS.includes(agent)) {
    return { error: `--agent must be "claude" or "generic", got "${agent}"` };
  }
  if (docsDir !== undefined && !isSafeDocsDir(docsDir)) {
    return { error: "--docs-dir must not contain a newline or any of the characters < > `" };
  }

  return {
    value: { docsDir, linearTeam, apiKey, agent: /** @type {"claude" | "generic" | undefined} */ (agent) },
  };
}

/**
 * `--agent` not passed: cheap, honest signal-check rather than a guess -
 * still resolves to "claude" either way (the only concretely supported
 * skills-dir convention today, the kit spec open item 2),
 * but the changelog says why.
 * @param {string} cwd
 */
function detectAgent(cwd) {
  if (existsSync(path.join(cwd, ".claude"))) {
    return { agent: /** @type {"claude"} */ ("claude"), reason: "found an existing .claude/ directory" };
  }
  if (process.env.CLAUDECODE === "1" || process.env.CLAUDE_CODE_ENTRYPOINT) {
    return { agent: /** @type {"claude"} */ ("claude"), reason: "running inside Claude Code" };
  }
  return {
    agent: /** @type {"claude"} */ ("claude"),
    reason: "default - no agent signal found; pass --agent generic to skip the skill install",
  };
}

/** @param {unknown} err */
function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
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

  /** @type {import("../lib/config.js").StemmoryConfig | null} */
  let existingConfig;
  try {
    existingConfig = readConfig(cwd);
  } catch (err) {
    return { stdout: "", stderr: `stemmory init: ${errorMessage(err)}\n`, exitCode: 1 };
  }

  // Merge, don't clobber: a flag that wasn't passed keeps
  // whatever's already on disk instead of resetting to the hardcoded
  // default - re-running `init` to tweak one setting must not cost the
  // user their stored API key or Linear team.
  const docsDir = parsed.value.docsDir ?? existingConfig?.docsDir ?? DEFAULT_DOCS_DIR;
  const linearTeam =
    parsed.value.linearTeam !== undefined ? parsed.value.linearTeam || null : (existingConfig?.linearTeam ?? null);
  const apiKey =
    parsed.value.apiKey !== undefined ? parsed.value.apiKey || null : (existingConfig?.apiKey ?? null);
  const project = deriveProjectSlug(cwd);

  const agentExplicit = parsed.value.agent !== undefined;
  const detected = detectAgent(cwd);
  const agent = parsed.value.agent ?? detected.agent;

  const agentsPath = path.join(cwd, "AGENTS.md");
  const skillDir = path.join(cwd, ".claude", "skills", SKILL_NAME);
  const skillFile = path.join(skillDir, "SKILL.md");

  // Pre-flight EVERY write target before the first write: a
  // symlink, a wrong-shaped directory, or malformed AGENTS.md markers
  // must be caught with nothing written at all - not even the config with
  // its key.
  try {
    assertConfigWritable(cwd);
    assertSafeFileTarget(agentsPath);
    if (agent === "claude") {
      assertSafeDirTarget(skillDir);
      assertSafeFileTarget(skillFile);
    }
  } catch (err) {
    return { stdout: "", stderr: `stemmory init: ${errorMessage(err)}\n`, exitCode: 1 };
  }

  const existingAgents = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : null;
  const upserted = upsertAgentsMd(existingAgents, buildFragment(docsDir));
  if ("error" in upserted) {
    return { stdout: "", stderr: `stemmory init: ${upserted.error}\n`, exitCode: 1 };
  }

  // Write order matters: non-secret files first, `.stemmory/config.json`
  // (the only file holding the API key) last. A failure partway through
  // this sequence then never leaves a credential on disk without the rest
  // of the install having happened.
  try {
    atomicWriteFile(agentsPath, upserted.content, 0o644);
    if (agent === "claude") {
      atomicWriteFile(skillFile, buildSkillMarkdown({ docsDir, hasApiKey: Boolean(apiKey) }), 0o644);
    }
    writeConfig(cwd, buildConfig({ project, docsDir, linearTeam, apiKey }));
  } catch (err) {
    return { stdout: "", stderr: `stemmory init: ${errorMessage(err)}\n`, exitCode: 1 };
  }

  const lines = ["stemmory init:"];
  lines.push(
    existingAgents === null
      ? "  - created AGENTS.md with the stemmory fragment"
      : "  - updated the stemmory fragment in AGENTS.md",
  );
  if (agent === "claude") {
    lines.push(`  - installed the ${SKILL_NAME} skill (.claude/skills/${SKILL_NAME}/SKILL.md)`);
  } else {
    lines.push("  - skipped skill install (--agent generic is fragment-only)");
  }
  lines.push("  - wrote .stemmory/config.json");
  if (!agentExplicit) {
    lines.push(`  - agent: ${agent} (auto-detected: ${detected.reason})`);
  }

  // Secret handling below: never interpolate `apiKey`'s VALUE into
  // stdout/stderr, only whether one is present.
  if (apiKey) {
    if (ensureGitignoreHasStemmoryDir(cwd)) {
      lines.push("  - added .stemmory/ to .gitignore (an API key is configured)");
    }
    if (process.platform === "win32") {
      lines.push(
        "  - note: .stemmory/config.json's permissions can't be fully locked down on Windows - keep it out of version control",
      );
    }
  }

  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}
