// stemmory-cli/packages/cli/src/lib/slug-util.js
//
// Best-effort `project` slug for `.stemmory/config.json` (AGENT_CONVENTIONS_
// KIT_SPEC.md §2.3): package.json's `name` when this is a Node project,
// else the directory name. Not user-configurable via a flag - the kit's
// flag surface (§2.3) doesn't offer one, and the value only labels the
// project inside its own config file.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** @param {string} input */
function slugify(input) {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project";
}

/** @param {string} cwd */
export function deriveProjectSlug(cwd) {
  const pkgPath = path.join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (typeof pkg.name === "string" && pkg.name.trim().length > 0) {
        // Scoped names ("@scope/name") lose the "@" and join on "-".
        return slugify(pkg.name.replace(/^@/, "").replace(/\//g, "-"));
      }
    } catch {
      // Malformed package.json - fall through to the directory name below.
    }
  }
  return slugify(path.basename(cwd));
}
