// stemmory-cli/packages/cli/src/lib/fragment.js
//
// The AGENTS.md fragment (AGENT_CONVENTIONS_KIT_SPEC.md §2.1). LOCKED
// principles this file exists to uphold:
//   - append, never own: only the delimited block is ever written; every
//     byte outside the markers is the user's, untouched
//   - idempotent markers so `stemmory update` can replace the block in
//     place: `<!-- stemmory:begin v1 -->` ... `<!-- stemmory:end -->`
//   - <= 15 lines total (including the markers) - always-on instructions
//     are taxed on every agent turn in every session; enforced by
//     fragment.test.js, not just this comment
//
// `docs/features` in the spec's draft text is templated to the project's
// configured `docsDir` so the fragment never points somewhere the project
// didn't actually choose.
export const FRAGMENT_BEGIN = "<!-- stemmory:begin v1 -->";
export const FRAGMENT_END = "<!-- stemmory:end -->";

/** @param {string} literal */
function escapeForRegex(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MARKER_RE = new RegExp(`${escapeForRegex(FRAGMENT_BEGIN)}[\\s\\S]*?${escapeForRegex(FRAGMENT_END)}`);

/**
 * @param {string} docsDir - project's configured feature-docs directory, e.g. "docs/features".
 * @returns {string} the fragment text, markers included, no trailing newline.
 */
export function buildFragment(docsDir) {
  return [
    FRAGMENT_BEGIN,
    "## Stemmory conventions",
    "This project keeps a living map in Stemmory. Non-negotiables:",
    `- Feature docs live at \`${docsDir}/<slug>.md\` with valid frontmatter (see stemmory-conventions skill).`,
    "- Every Linear issue for a feature carries the label `feature:<slug>` matching its doc.",
    "- Record decisions (what + why + alternatives) in the feature doc's `## Decisions` section, dated.",
    "- When your work changes a feature's scope or status, update its doc in the same session.",
    "- Procedures, templates, and the frontmatter schema: load the `stemmory-conventions` skill. Validate with `stemmory lint`.",
    FRAGMENT_END,
  ].join("\n");
}

/**
 * Append-never-own (§2.1): replaces an existing marked block in place so
 * `stemmory update` is idempotent, or appends the fragment (creating a
 * minimal file if none exists) otherwise. Never reorders or rewrites
 * anything outside the markers.
 *
 * @param {string | null} existingContent - null when AGENTS.md doesn't exist yet.
 * @param {string} fragmentText - from `buildFragment`.
 * @returns {string} the full new AGENTS.md content.
 */
export function upsertAgentsMd(existingContent, fragmentText) {
  if (existingContent === null || existingContent.length === 0) {
    return `${fragmentText}\n`;
  }
  if (MARKER_RE.test(existingContent)) {
    return existingContent.replace(MARKER_RE, fragmentText);
  }
  // No markers yet: append after exactly one blank line, whatever the
  // existing trailing whitespace looked like.
  const trimmedEnd = existingContent.replace(/\n+$/, "");
  return `${trimmedEnd}\n\n${fragmentText}\n`;
}
