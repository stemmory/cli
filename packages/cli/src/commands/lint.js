// stemmory-cli/packages/cli/src/commands/lint.js
//
// `stemmory lint` (AGENT_CONVENTIONS_KIT_SPEC.md §2.3, story 5.3 / STEM-86):
// validates docs/features/**/*.md against schema v1 using the SAME
// validator hosted ingest runs (@stemmory/schema, ARCHITECTURE_AND_SYNC_
// SPEC.md §6 - "one validator, both consumers"). No rule is reimplemented
// here - this file only orchestrates: find files, feed each one through
// `parseDoc` (the exact function `apps/web/lib/sync/markdown.ts` calls),
// and turn the result into CI-friendly exit codes.
//
// Adversarial review (round 2) found the first version drifted from
// `parseDoc` in two ways that only looked correct because the product
// repo's current corpus never exercises the divergent paths:
//   1. Re-composing `splitFrontmatter -> parseFrontmatterBlock ->
//      validateFrontmatterV1` (instead of calling `parseDoc`) skipped
//      `parse-doc.ts`'s GitHub-ingest status clamp AND ITS WARNING - a doc
//      declaring `status: building` (etc.) warned at ingest and was
//      reported clean here. Fixed by calling `parseDoc` itself for the
//      verdict; the richer per-field message is recovered separately, on
//      the error path only, without changing that verdict.
//   2. A flat, single-directory `readdirSync` missed anything nested -
//      ingest's own `isDocPath` (github.ts) and its tests accept docs at
//      any depth. Fixed by `findDocsRecursive` below.
// A table-driven differential test in lint.test.js now asserts `lintOne`'s
// verdict matches `parseDoc`'s, file for file, over every fixture in
// packages/schema/fixtures/ - the guard neither blocking finding had.
//
// "Silent skip" contract (CONVENTIONS.md §2, `parse-doc.ts`): README.md, a
// file with no frontmatter block at all, and a file whose frontmatter has
// no slug/feature key never attempted to declare a feature doc, so they
// are excluded rather than reported as violations - exactly what hosted
// ingest does with them. A doc that ingest quietly ignores must never show
// up as a `lint` failure, or the two "consumers" of the shared validator
// would disagree.
//
// Exit codes (also documented in cli.js's HELP_TEXT):
//   0 = clean - no errors (warnings do not fail the run - spec §3: version
//       skew and similar issues warn, never hard-fail)
//   1 = one or more docs failed validation (real schema errors)
//   2 = bad CLI usage (unknown flag, bad --docs-dir value) - same code the
//       rest of the CLI already uses for usage errors
//   3 = could not read (missing docs dir, unreadable dir/file, or a bad
//       .stemmory/config.json - a malformed "docsDir" included, same as
//       `update` treats it)
// A pipeline needs "your docs are wrong" (1) to never look like "the tool
// broke" (3), and neither to look like "you typed the command wrong" (2).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { parseDoc, parseFrontmatterBlock, splitFrontmatter, validateFrontmatterV1 } from "@stemmory/schema";

import { readConfig } from "../lib/config.js";
import { isSafeDocsDir } from "../lib/docs-dir.js";

const DEFAULT_DOCS_DIR = "docs/features";

/**
 * `SkipReason` values CONVENTIONS.md §2 treats as a silent skip rather than
 * a violation - see parse-doc.ts's own comment: "a file with no slug/
 * feature key is skipped... SILENT skip, not sync.unmapped". Every other
 * reason (invalid_slug, slug_conflict, no_title, and the defensive
 * schema_mismatch->invalid_slug mapping) means the author DID attempt a
 * feature doc and got the schema wrong, which is exactly what `lint`
 * exists to catch.
 */
const SILENT_SKIP_REASONS = new Set(["readme", "no_frontmatter", "no_feature_key"]);

/** @param {NodeJS.ErrnoException} err @param {string} displayPath - already relative; never pass an absolute path (leaks the user's machine layout into CI logs). */
function mapReadError(err, displayPath) {
  switch (err.code) {
    case "EACCES":
    case "EPERM":
      return `permission denied reading "${displayPath}"`;
    case "EISDIR":
      return `"${displayPath}" is a directory, expected a file`;
    case "ENOTDIR":
      return `a parent directory of "${displayPath}" is not a directory`;
    default:
      return `could not read "${displayPath}" (${err.code ?? err.message})`;
  }
}

class DocsScanError extends Error {
  /** @param {string} relPath @param {NodeJS.ErrnoException} cause */
  constructor(relPath, cause) {
    super(mapReadError(cause, relPath));
  }
}

/**
 * Recursively finds every `*.md` file under `dirAbs` at any depth -
 * mirrors `isDocPath` (apps/web/lib/sync/github.ts), which ingest matches
 * against a `?recursive=1` git tree listing. A real filesystem walk
 * doesn't need `isDocPath`'s string-prefix-vs-sibling-directory defense
 * (its own tests guard "docs/features-archive" not matching prefix
 * "docs/features") - we're walking the resolved directory itself, not
 * string-matching a flat path list against a prefix.
 *
 * Symlinks (file or directory) are never followed - each symlinked `.md`
 * is reported back as `symlinks` (counted, not silently dropped) rather
 * than read, and a symlinked directory is skipped outright, closing off
 * any symlink-cycle risk.
 * @param {string} dirAbs
 * @param {string} [relPrefix] - accumulated relPath; "" at the root.
 * @returns {{ files: string[], symlinks: string[] }}
 */
function findDocsRecursive(dirAbs, relPrefix = "") {
  /** @type {import("node:fs").Dirent[]} */
  let entries;
  try {
    entries = readdirSync(dirAbs, { withFileTypes: true });
  } catch (err) {
    throw new DocsScanError(relPrefix || ".", /** @type {NodeJS.ErrnoException} */ (err));
  }

  /** @type {string[]} */
  const files = [];
  /** @type {string[]} */
  const symlinks = [];
  for (const entry of entries) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) {
      if (entry.name.toLowerCase().endsWith(".md")) symlinks.push(rel);
      continue;
    }
    if (entry.isDirectory()) {
      const nested = findDocsRecursive(path.join(dirAbs, entry.name), rel);
      files.push(...nested.files);
      symlinks.push(...nested.symlinks);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(rel);
    }
  }
  return { files, symlinks };
}

/**
 * Supports a positional docs-dir argument OR `--docs-dir`, matching the
 * flag `init` already uses. If both are given, `--docs-dir` wins (it's the
 * more explicit form) - documented in --help.
 * @param {string[]} args - argv after the "lint" command word.
 * @returns {{ value: { docsDir: string | undefined } } | { error: string }}
 */
function parseLintArgs(args) {
  /** @type {string | undefined} */
  let flagValue;
  /** @type {string[]} */
  const positionals = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--docs-dir" || arg.startsWith("--docs-dir=")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        flagValue = arg.slice(eqIdx + 1);
        continue;
      }
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) {
        return { error: "--docs-dir requires a value" };
      }
      flagValue = next;
      i++;
      continue;
    }
    if (arg.startsWith("--")) {
      return { error: `unknown option "${arg}"` };
    }
    positionals.push(arg);
  }

  if (positionals.length > 1) {
    return { error: `expected at most one docs-dir path argument, got ${positionals.length}` };
  }

  const docsDir = flagValue ?? positionals[0];
  if (docsDir !== undefined && !isSafeDocsDir(docsDir)) {
    return { error: "docs-dir must not contain a newline or any of the characters < > `" };
  }
  return { value: { docsDir } };
}

/** @param {unknown} err */
function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * @typedef {{ kind: "skip" }} LintSkip
 * @typedef {{ kind: "ok", slug: string, warnings: string[] }} LintOk
 * @typedef {{ kind: "error", field: string, message: string, warnings: string[] }} LintError
 */

/**
 * Runs `parseDoc` - the SAME function the hosted ingest path calls
 * (packages/schema/src/parse-doc.ts, re-exported verbatim by apps/web/lib/
 * sync/markdown.ts) - so lint's ok/skip verdict and warnings (status clamp
 * included) are byte-identical to what ingest sees; see lint.test.js's
 * differential test for the fixture-by-fixture proof.
 *
 * On a hard error, `parseDoc`'s own return type narrows the failure down
 * to a bare `SkipReason` (by design, for the web app's needs) and drops
 * the validator's fix-it `message`. To recover it for display, this
 * re-derives the same `ValidationIssue` via the identical exported
 * building blocks `parseDoc` calls internally - `splitFrontmatter` is
 * guaranteed to succeed here because every non-silent `SkipReason` implies
 * the frontmatter block itself parsed (readme/no_frontmatter/
 * no_feature_key are the only reasons that can fire before validation
 * runs, and all three are silent). This recomputation cannot change the
 * verdict `parseDoc` already produced - it only recovers text `parseDoc`
 * throws away.
 * @param {string} relPath
 * @param {string} content
 * @returns {LintSkip | LintOk | LintError}
 */
export function lintOne(relPath, content) {
  const parsed = parseDoc(relPath, content);
  if (parsed.ok) return { kind: "ok", slug: parsed.doc.slug, warnings: parsed.warnings };
  if (SILENT_SKIP_REASONS.has(parsed.skip)) return { kind: "skip" };

  const split = /** @type {NonNullable<ReturnType<typeof splitFrontmatter>>} */ (splitFrontmatter(content));
  const fm = parseFrontmatterBlock(split.frontmatter);
  const result = validateFrontmatterV1(fm);
  if (result.value) {
    // Unreachable: `parseDoc` already ran the identical `validateFrontmatterV1`
    // call and got a failure for this same content - a second call can't
    // succeed where the first didn't. Typed as a real branch only because
    // `ValidateResult`'s two arms aren't otherwise narrowed here.
    throw new Error(`stemmory lint: internal error - re-validation of "${relPath}" disagreed with parseDoc`);
  }
  const issue = result.errors[0];
  return { kind: "error", field: issue.field, message: issue.message, warnings: result.warnings };
}

/**
 * @param {string} cwd
 * @param {string[]} args - argv after the "lint" command word.
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
export function runLint(cwd, args) {
  const parsed = parseLintArgs(args);
  if ("error" in parsed) {
    return { stdout: "", stderr: `stemmory lint: ${parsed.error}\n`, exitCode: 2 };
  }

  /** @type {import("../lib/config.js").StemmoryConfig | null} */
  let config;
  try {
    config = readConfig(cwd);
  } catch (err) {
    return { stdout: "", stderr: `stemmory lint: ${errorMessage(err)}\n`, exitCode: 3 };
  }
  if (config && !isSafeDocsDir(config.docsDir)) {
    return {
      stdout: "",
      stderr: 'stemmory lint: .stemmory/config.json\'s "docsDir" contains a newline or one of < > ` - fix it by hand.\n',
      exitCode: 3,
    };
  }

  // Precedence: --docs-dir / positional arg > .stemmory/config.json > default.
  const docsDir = parsed.value.docsDir ?? config?.docsDir ?? DEFAULT_DOCS_DIR;
  const docsDirAbs = path.resolve(cwd, docsDir);
  const docsDirDisplay = path.relative(cwd, docsDirAbs) || docsDir;

  /** @type {import("node:fs").Stats} */
  let stat;
  try {
    stat = statSync(docsDirAbs);
  } catch (err) {
    const errno = /** @type {NodeJS.ErrnoException} */ (err);
    const reason = errno.code === "ENOENT" ? "no such directory" : mapReadError(errno, docsDirDisplay);
    return { stdout: "", stderr: `stemmory lint: could not read "${docsDirDisplay}" - ${reason}\n`, exitCode: 3 };
  }
  if (!stat.isDirectory()) {
    return { stdout: "", stderr: `stemmory lint: "${docsDirDisplay}" is not a directory\n`, exitCode: 3 };
  }

  /** @type {{ files: string[], symlinks: string[] }} */
  let scan;
  try {
    scan = findDocsRecursive(docsDirAbs);
  } catch (err) {
    return {
      stdout: "",
      stderr: `stemmory lint: could not read "${docsDirDisplay}" - ${errorMessage(err)}\n`,
      exitCode: 3,
    };
  }
  const files = scan.files.sort();

  /** @type {string[]} */
  const lines = [];
  /** @type {string[]} */
  const unreadable = [];
  /** @type {Map<string, string>} */
  const firstPathBySlug = new Map();
  let errorCount = 0;
  let warningCount = 0;
  let skipCount = 0;
  let cleanCount = 0;

  for (const relPath of files) {
    const filePath = path.join(docsDirAbs, relPath);
    const displayPath = `${docsDirDisplay}/${relPath}`;

    /** @type {string} */
    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch (err) {
      unreadable.push(`${displayPath}: ${mapReadError(/** @type {NodeJS.ErrnoException} */ (err), displayPath)}`);
      continue;
    }

    const result = lintOne(relPath, content);
    if (result.kind === "skip") {
      skipCount++;
    } else if (result.kind === "error") {
      errorCount++;
      lines.push(`ERROR ${displayPath}: [${result.field}] ${result.message}`);
      for (const warning of result.warnings) lines.push(`  warn: ${warning}`);
    } else {
      // kind === "ok". Cross-file duplicate slugs are invisible to
      // `parseDoc` (it only sees one file at a time) but very visible to
      // `reconcile.ts`, which keeps the first and drops the rest with a
      // warning - mirrored here (message format matched, not the DB logic
      // reused - there's no exported function for this) so a doc that
      // ingest will silently discard doesn't show up as "clean" here.
      const warnings = [...result.warnings];
      const firstPath = firstPathBySlug.get(result.slug);
      if (firstPath !== undefined) {
        warnings.push(`duplicate feature key "${result.slug}": keeping ${firstPath}, ignoring ${displayPath}`);
      } else {
        firstPathBySlug.set(result.slug, displayPath);
      }

      if (warnings.length > 0) {
        warningCount++;
        lines.push(`WARN  ${displayPath}:`);
        for (const warning of warnings) lines.push(`  - ${warning}`);
      } else {
        cleanCount++;
      }
    }
  }

  // A read failure means the tool couldn't do its job on that file - never
  // reported as a validation violation (exit 1), always the distinct
  // "could not read" code (exit 3). Whatever was already computed for the
  // OTHER files is still real information, so it's kept in stdout rather
  // than discarded - the user shouldn't have to fix a permission bit and
  // re-run just to learn about errors lint already found.
  if (unreadable.length > 0) {
    const detail = unreadable.map((line) => `  - ${line}`).join("\n");
    return {
      stdout: lines.length > 0 ? `${lines.join("\n")}\n` : "",
      stderr: `stemmory lint: could not read ${unreadable.length} file(s) in "${docsDirDisplay}":\n${detail}\n`,
      exitCode: 3,
    };
  }

  const total = cleanCount + warningCount + errorCount;
  /** @type {string[]} */
  const suffixes = [];
  if (skipCount > 0) suffixes.push(`${skipCount} skipped (not feature docs)`);
  if (scan.symlinks.length > 0) suffixes.push(`${scan.symlinks.length} skipped (symlink, not followed)`);
  lines.push(
    `${total} doc${total === 1 ? "" : "s"} checked in "${docsDirDisplay}" - ${cleanCount} clean, ` +
      `${warningCount} with warnings, ${errorCount} with errors${suffixes.length > 0 ? `, ${suffixes.join(", ")}` : ""}`,
  );

  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: errorCount > 0 ? 1 : 0 };
}
