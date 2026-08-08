// stemmory-cli/packages/cli/src/commands/lint.js
//
// `stemmory lint` (AGENT_CONVENTIONS_KIT_SPEC.md §2.3, story 5.3): validates
// docs/features/*.md against schema v1 using the SAME validator hosted
// ingest runs (@stemmory/schema, ARCHITECTURE_AND_SYNC_SPEC.md §6 - "one
// validator, both consumers"). No rule is reimplemented here - this file
// only orchestrates: find files, feed each one through the shared building
// blocks, and turn the result into CI-friendly exit codes.
//
// "Silent skip" contract (CONVENTIONS.md §2, mirrored from
// packages/schema/src/parse-doc.ts): README.md, a file with no frontmatter
// block at all, and a file whose frontmatter has no slug/feature key never
// attempted to declare a feature doc, so they are excluded rather than
// reported as violations - exactly what hosted ingest does with them. A
// doc that ingest quietly ignores must never show up as a `lint` failure,
// or the two "consumers" of the shared validator would disagree.
//
// Exit codes (also documented in cli.js's HELP_TEXT):
//   0 = clean - no errors (warnings do not fail the run - spec §3: version
//       skew and similar issues warn, never hard-fail)
//   1 = one or more docs failed validation (real schema errors)
//   2 = bad CLI usage (unknown flag, bad --docs-dir value) - same code the
//       rest of the CLI already uses for usage errors
//   3 = could not read (missing docs dir, unreadable dir/file, bad config)
// A pipeline needs "your docs are wrong" (1) to never look like "the tool
// broke" (3), and neither to look like "you typed the command wrong" (2).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  parseDecisions,
  parseFrontmatterBlock,
  shouldSkipByName,
  splitFrontmatter,
  validateFrontmatterV1,
} from "@stemmory/schema";

import { readConfig } from "../lib/config.js";
import { isSafeDocsDir } from "../lib/docs-dir.js";
import { mapFsError } from "../lib/fs-safety.js";

const DEFAULT_DOCS_DIR = "docs/features";

/**
 * `IssueCode` values CONVENTIONS.md §2 treats as a silent skip rather than a
 * violation - see parse-doc.ts's own comment: "a file with no slug/feature
 * key is skipped... SILENT skip, not sync.unmapped". Every other code
 * (invalid_slug, slug_conflict, missing_title, schema_mismatch) means the
 * author DID attempt a feature doc and got the schema wrong, which is
 * exactly what `lint` exists to catch.
 */
const SILENT_ISSUE_CODES = new Set(["missing_slug"]);

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
 * @typedef {{ kind: "ok", warnings: string[] }} LintOk
 * @typedef {{ kind: "error", issue: import("@stemmory/schema").ValidationIssue, warnings: string[] }} LintError
 */

/**
 * Runs one file's content through the shared validator's building blocks -
 * the same pieces `parseDoc` composes internally (packages/schema/src/
 * parse-doc.ts) - kept separate here only so the fatal `ValidationIssue`'s
 * full `message` (field + fix-it text) survives; `parseDoc`'s own return
 * shape narrows that down to a bare skip reason for the web app's needs.
 * @param {string} content
 * @returns {LintSkip | LintOk | LintError}
 */
function lintOne(content) {
  const split = splitFrontmatter(content);
  if (!split) return { kind: "skip" };

  const fm = parseFrontmatterBlock(split.frontmatter);
  const result = validateFrontmatterV1(fm);
  if (!result.value) {
    const issue = result.errors[0];
    if (SILENT_ISSUE_CODES.has(issue.code)) return { kind: "skip" };
    return { kind: "error", issue, warnings: result.warnings };
  }

  const decisions = parseDecisions(split.body);
  return { kind: "ok", warnings: [...result.warnings, ...decisions.warnings] };
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
    const reason = errno.code === "ENOENT" ? "no such directory" : mapFsError(errno, docsDirAbs);
    return { stdout: "", stderr: `stemmory lint: could not read "${docsDirDisplay}" - ${reason}\n`, exitCode: 3 };
  }
  if (!stat.isDirectory()) {
    return { stdout: "", stderr: `stemmory lint: "${docsDirDisplay}" is not a directory\n`, exitCode: 3 };
  }

  /** @type {import("node:fs").Dirent[]} */
  let entries;
  try {
    entries = readdirSync(docsDirAbs, { withFileTypes: true });
  } catch (err) {
    const errno = /** @type {NodeJS.ErrnoException} */ (err);
    return {
      stdout: "",
      stderr: `stemmory lint: could not read "${docsDirDisplay}" - ${mapFsError(errno, docsDirAbs)}\n`,
      exitCode: 3,
    };
  }

  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md") && !shouldSkipByName(e.name))
    .map((e) => e.name)
    .sort();

  /** @type {string[]} */
  const lines = [];
  /** @type {string[]} */
  const unreadable = [];
  let errorCount = 0;
  let warningCount = 0;
  let skipCount = 0;
  let cleanCount = 0;

  for (const name of files) {
    const filePath = path.join(docsDirAbs, name);
    const displayPath = path.join(docsDirDisplay, name);

    /** @type {string} */
    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch (err) {
      unreadable.push(`${displayPath}: ${mapFsError(/** @type {NodeJS.ErrnoException} */ (err), filePath)}`);
      continue;
    }

    const result = lintOne(content);
    if (result.kind === "skip") {
      skipCount++;
    } else if (result.kind === "error") {
      errorCount++;
      lines.push(`ERROR ${displayPath}: [${result.issue.field}] ${result.issue.message}`);
      for (const warning of result.warnings) lines.push(`  warn: ${warning}`);
    } else if (result.warnings.length > 0) {
      warningCount++;
      lines.push(`WARN  ${displayPath}:`);
      for (const warning of result.warnings) lines.push(`  - ${warning}`);
    } else {
      cleanCount++;
    }
  }

  // A read failure means the tool couldn't do its job on that file - never
  // reported as a validation violation (exit 1), always the distinct "could
  // not read" code (exit 3), even if every other file in the batch was fine.
  if (unreadable.length > 0) {
    const detail = unreadable.map((line) => `  - ${line}`).join("\n");
    return {
      stdout: "",
      stderr: `stemmory lint: could not read ${unreadable.length} file(s) in "${docsDirDisplay}":\n${detail}\n`,
      exitCode: 3,
    };
  }

  const total = cleanCount + warningCount + errorCount;
  const skipSuffix = skipCount > 0 ? `, ${skipCount} skipped (not feature docs)` : "";
  lines.push(
    `${total} doc${total === 1 ? "" : "s"} checked in "${docsDirDisplay}" - ${cleanCount} clean, ` +
      `${warningCount} with warnings, ${errorCount} with errors${skipSuffix}`,
  );

  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: errorCount > 0 ? 1 : 0 };
}
