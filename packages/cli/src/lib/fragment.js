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
//   - §6: "the block is declared machine-owned in its own text" - see the
//     banner line in `buildFragment` below
//
// ⚠️ STEM-82 adversarial review, finding 1 (CRITICAL data loss): the
// previous implementation matched markers with a non-greedy regex
// (`BEGIN[\s\S]*?END`). That silently accepts a malformed document - an
// orphan BEGIN with no END, or more than one of either - and deletes
// everything between whatever it happens to match, with no warning. A
// botched merge of two branches that both ran `init`, or a user who
// pastes the marker literal into their own prose, reaches this. Fixed by
// counting occurrences with plain `indexOf` instead of trusting a regex
// to pick a deletion range: exactly one BEGIN and one END, BEGIN before
// END -> splice; zero of both -> append; anything else -> refuse and
// write nothing (`upsertAgentsMd` returns `{ error }`).
//
// `docs/features` in the spec's draft text is templated to the project's
// configured `docsDir` so the fragment never points somewhere the project
// didn't actually choose.
export const FRAGMENT_BEGIN = "<!-- stemmory:begin v1 -->";
export const FRAGMENT_END = "<!-- stemmory:end -->";

/**
 * @param {string} docsDir - project's configured feature-docs directory, e.g. "docs/features".
 * @returns {string} the fragment text, markers included, no trailing newline.
 */
export function buildFragment(docsDir) {
  return [
    FRAGMENT_BEGIN,
    "<!-- machine-owned: stemmory update overwrites this block; put notes outside it -->",
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
 * Every occurrence of `needle` in `haystack`, as start indices.
 * @param {string} haystack
 * @param {string} needle
 * @returns {number[]}
 */
function indexOfAll(haystack, needle) {
  /** @type {number[]} */
  const out = [];
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = haystack.indexOf(needle, i + 1);
  }
  return out;
}

/**
 * Append-never-own (§2.1): replaces an existing marked block in place so
 * `stemmory update` is idempotent, or appends the fragment (creating a
 * minimal file if none exists) otherwise. Never reorders or rewrites
 * anything outside the markers.
 *
 * Refuses (rather than guessing) when the markers don't form exactly one
 * well-formed BEGIN...END pair - see the finding-1 note above. Callers
 * MUST check for `"error"` and write nothing when present.
 *
 * @param {string | null} existingContent - null when AGENTS.md doesn't exist yet.
 * @param {string} fragmentText - from `buildFragment`.
 * @returns {{ content: string } | { error: string }}
 */
export function upsertAgentsMd(existingContent, fragmentText) {
  if (existingContent === null || existingContent.length === 0) {
    return { content: `${fragmentText}\n` };
  }

  const begins = indexOfAll(existingContent, FRAGMENT_BEGIN);
  const ends = indexOfAll(existingContent, FRAGMENT_END);

  if (begins.length === 0 && ends.length === 0) {
    // No markers yet: append after exactly one blank line, whatever the
    // existing trailing whitespace looked like.
    const trimmedEnd = existingContent.replace(/\n+$/, "");
    return { content: `${trimmedEnd}\n\n${fragmentText}\n` };
  }

  if (begins.length === 1 && ends.length === 1 && begins[0] < ends[0]) {
    const start = begins[0];
    const end = ends[0] + FRAGMENT_END.length;
    return { content: existingContent.slice(0, start) + fragmentText + existingContent.slice(end) };
  }

  return {
    error: "AGENTS.md has malformed or duplicated stemmory markers - fix them by hand; nothing was written.",
  };
}
