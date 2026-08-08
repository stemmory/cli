// stemmory-cli/packages/cli/src/lib/config.js
//
// .stemmory/config.json (AGENT_CONVENTIONS_KIT_SPEC.md §2.3):
// `{ "schema": 1, "project": "<slug>", "docsDir": "docs/features",
//    "linearTeam": "<team-key>", "apiKey": null }`.
//
// Written 0600: `apiKey` is a secret (Tier 2 MCP write config, §2.3/§4) and
// this file lives inside a project directory an inattentive `git add -A`
// could sweep up. Tight permissions are the one guarantee the CLI itself
// can still make about a file it doesn't control the lifecycle of.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * @typedef {{ schema: 1, project: string, docsDir: string, linearTeam: string | null, apiKey: string | null }} StemmoryConfig
 */

/**
 * @param {{ project: string, docsDir: string, linearTeam: string | null, apiKey: string | null }} opts
 * @returns {StemmoryConfig}
 */
export function buildConfig({ project, docsDir, linearTeam, apiKey }) {
  return {
    schema: 1,
    project,
    docsDir,
    linearTeam: linearTeam ?? null,
    apiKey: apiKey ?? null,
  };
}

/** @param {string} cwd */
export function configPath(cwd) {
  return path.join(cwd, ".stemmory", "config.json");
}

/**
 * @param {string} cwd
 * @param {StemmoryConfig} config
 * @returns {string} the path written.
 */
export function writeConfig(cwd, config) {
  const file = configPath(cwd);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  // `writeFileSync`'s `mode` is still subject to umask; force the exact bits
  // so a permissive umask can't leave a secret world-readable.
  chmodSync(file, 0o600);
  return file;
}

/**
 * @param {string} cwd
 * @returns {StemmoryConfig | null} null when init hasn't run yet.
 */
export function readConfig(cwd) {
  const file = configPath(cwd);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}
