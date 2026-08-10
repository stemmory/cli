// stemmory-cli/packages/cli/src/lib/gitignore.js
//
// adversarial review: `.stemmory/config.json` can
// hold a plaintext API key inside the project's own working tree, and
// nothing stopped `git add -A` from staging it - file mode (0600) is a
// filesystem control, not a git one. Only touched when a key is actually
// configured; a Tier 1 project with no key never gets a `.gitignore` edit.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { atomicWriteFile } from "./fs-safety.js";

const ENTRY = ".stemmory/";

/**
 * Idempotent: does nothing if an equivalent entry (`.stemmory/` or bare
 * `.stemmory`) is already present on its own line.
 * @param {string} cwd
 * @returns {boolean} true if `.gitignore` was created or changed.
 */
export function ensureGitignoreHasStemmoryDir(cwd) {
  const file = path.join(cwd, ".gitignore");
  const existing = existsSync(file) ? readFileSync(file, "utf8") : null;
  const alreadyPresent =
    existing !== null && existing.split("\n").some((line) => line.trim() === ENTRY || line.trim() === ".stemmory");
  if (alreadyPresent) return false;

  const content = existing === null ? `${ENTRY}\n` : `${existing.replace(/\n+$/, "")}\n${ENTRY}\n`;
  atomicWriteFile(file, content, 0o644);
  return true;
}
