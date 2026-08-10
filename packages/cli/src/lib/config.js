// stemmory-cli/packages/cli/src/lib/config.js
//
//.stemmory/config.json:
// `{ "schema": 1, "project": "<slug>", "docsDir": "docs/features",
//    "linearTeam": "<team-key>", "apiKey": null }`.
//
// Written 0600 on POSIX: `apiKey` is a secret (Tier 2 MCP write config,
// §2.3/§4) and this file lives inside a project directory an inattentive
// `git add -A` could sweep up (see gitignore.js for the other half of that
// mitigation - adversarial review). ⚠️ 0600 is a POSIX
// permission bit; Windows has no equivalent ACL-narrowing here (`fchmod`
// only ever toggles the read-only attribute there) - treat `.stemmory/` as
// sensitive regardless of OS, don't rely on the file mode alone.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { CURRENT_SCHEMA_VERSION } from "@stemmory/schema";

import { assertSafeDirTarget, assertSafeFileTarget, atomicWriteFile } from "./fs-safety.js";

/**
 * @typedef {{ schema: number, project: string, docsDir: string, linearTeam: string | null, apiKey: string | null }} StemmoryConfig
 */

/**
 * @param {{ project: string, docsDir: string, linearTeam: string | null, apiKey: string | null }} opts
 * @returns {StemmoryConfig}
 */
export function buildConfig({ project, docsDir, linearTeam, apiKey }) {
  return {
    schema: CURRENT_SCHEMA_VERSION,
    project,
    docsDir,
    linearTeam: linearTeam ?? null,
    apiKey: apiKey ?? null,
  };
}

/** @param {string} cwd */
export function stemmoryDir(cwd) {
  return path.join(cwd, ".stemmory");
}

/** @param {string} cwd */
export function configPath(cwd) {
  return path.join(stemmoryDir(cwd), "config.json");
}

/**
 * Refuses a symlink/directory-shaped `.stemmory` or `config.json` before
 * anything is written (and 10) - callers should run
 * this, and every other pre-flight check, before the first write of a
 * multi-file command so a bad target is caught before a secret has landed
 * anywhere on disk.
 * @param {string} cwd
 */
export function assertConfigWritable(cwd) {
  assertSafeDirTarget(stemmoryDir(cwd));
  assertSafeFileTarget(configPath(cwd));
}

/**
 * @param {string} cwd
 * @param {StemmoryConfig} config
 * @returns {string} the path written.
 */
export function writeConfig(cwd, config) {
  const file = configPath(cwd);
  atomicWriteFile(file, `${JSON.stringify(config, null, 2)}\n`, 0o600);
  return file;
}

/**
 * @param {unknown} value
 * @returns {value is StemmoryConfig}
 */
function isValidConfigShape(value) {
  if (value === null || typeof value !== "object") return false;
  const v = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof v.schema === "number" &&
    typeof v.project === "string" &&
    v.project.length > 0 &&
    typeof v.docsDir === "string" &&
    v.docsDir.length > 0 &&
    (v.linearTeam === null || typeof v.linearTeam === "string") &&
    (v.apiKey === null || typeof v.apiKey === "string")
  );
}

/**
 * @param {string} cwd
 * @returns {StemmoryConfig | null} null when init hasn't run yet.
 * @throws {Error} a short, non-secret-echoing message when the file exists
 *   but isn't valid JSON, or doesn't match the documented shape (e.g. a
 *   half-merged `config.json` missing `docsDir`) - never a raw `SyntaxError`
 *   quoting the file's own content back at the caller (and 9).
 */
export function readConfig(cwd) {
  const file = configPath(cwd);
  if (!existsSync(file)) return null;
  const relPath = path.relative(cwd, file) || file;

  const raw = readFileSync(file, "utf8");
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${relPath} is not valid JSON - fix or delete it`);
  }
  if (!isValidConfigShape(parsed)) {
    throw new Error(`${relPath} does not match the expected config shape - fix or delete it`);
  }
  return parsed;
}
