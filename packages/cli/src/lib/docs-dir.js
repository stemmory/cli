// stemmory-cli/packages/cli/src/lib/docs-dir.js
//
// STEM-82 adversarial review finding 13: `docsDir` gets templated verbatim
// into the AGENTS.md fragment (inside an HTML comment block) and into the
// skill's YAML frontmatter description. A newline, or the characters that
// build a marker/YAML-breaking sequence (`<`, `>`, a backtick), let a
// crafted `--docs-dir` value break out of either. Checked both when the
// flag is parsed (init) and whenever a stored `config.json` is read back
// (update) - a hand-edited config.json is the same injection surface.
const UNSAFE_RE = /[\n\r<>`]/;

/** @param {string} dir */
export function isSafeDocsDir(dir) {
  return typeof dir === "string" && dir.length > 0 && !UNSAFE_RE.test(dir);
}
