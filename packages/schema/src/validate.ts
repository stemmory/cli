// stemmory/packages/schema/src/validate.ts
//
// Turns the raw `key: value` map (frontmatter.ts) into a `FrontmatterV1`, or
// reports why it can't. Each field has its own severity, matched to the
// shipped parser's behaviour and STEM-70 decision D-1:
//
//   slug/title/parent grammar  -> ERROR (the doc cannot be described at all)
//   slug vs legacy feature     -> ERROR only if they disagree; `feature:`
//                                  ALONE is a WARNING (D-1 #1). `slug:` and
//                                  `feature:` both present AND EQUAL is
//                                  warn-free — that is BUILD_AUDIT's own
//                                  transitional PR-0 stub form, not a mistake.
//   status                     -> unrecognised value is IGNORED + WARNING
//                                  (a doc may not assert a bogus or DB-only
//                                  status; DATA_MODEL.md §3 still governs)
//   type / sort / schema       -> unrecognised value silently falls back
//                                  (type infers from parent; sort defaults to
//                                  0; schema defaults to CURRENT_SCHEMA_VERSION,
//                                  with a warning for schema version skew).
//                                  Oversized digit strings fall back the same
//                                  way — see `digitsToNumber` below.
//   owner / linear_team        -> optional, no validation beyond non-empty
//                                  (AGENT_CONVENTIONS_KIT_SPEC.md §2.4 marks
//                                  linear_team explicitly optional; owner
//                                  carries the same treatment for the same
//                                  reason — no doc in this repo predates them)
//   updated                    -> optional ISO date, never an error. Malformed
//                                  always warns (the author tried and got it
//                                  wrong). Absence warns ONLY when the doc
//                                  declares `schema:` — i.e. has opted into
//                                  the kit; §2.4 obliges AGENTS to keep it
//                                  current, it does not authorise ingest to
//                                  nag every pre-kit doc forever.
//   links                      -> optional list; see links.ts for the narrow
//                                  grammar the hand-rolled parser can support
//
// The end of this file hands the assembled candidate to `frontmatterV1Schema`
// (schema-v1.ts) as the final authority, so zod — not this file's judgment —
// decides whether the result is actually schema-v1-shaped.
import { z } from "zod";

import type { ParsedFrontmatterBlock } from "./frontmatter";
import { parseLinks } from "./links";
import { isValidSlug, SLUG_GRAMMAR_HINT } from "./slug";
import { CURRENT_SCHEMA_VERSION, frontmatterV1Schema, type FrontmatterV1 } from "./schema-v1";
import { DOC_STATUS_VALUES, isDocStatus, type DocStatus } from "./status";

/**
 * A stable, machine-checkable reason — never string-sniffed by callers.
 * `parse-doc.ts` maps each code straight onto a web-app `SkipReason`.
 */
export type IssueCode =
  | "missing_slug"
  | "slug_conflict"
  | "invalid_slug"
  | "invalid_parent"
  | "missing_title"
  | "schema_mismatch"
  | "duplicate_key";

export type ValidationIssue = { code: IssueCode; field: string; message: string; detail?: string };

export type ValidateResult =
  | { value: FrontmatterV1; warnings: string[]; errors: [] }
  | { value: null; warnings: string[]; errors: [ValidationIssue] };

/**
 * Digit-only string -> number. Shared by `sort` and `schema` — both are plain
 * non-negative integers, and both fall back gracefully (`sort` -> 0, `schema`
 * -> warn + current version) on a `safeParse` failure.
 *
 * ⚠️ `.refine(Number.isSafeInteger)` is load-bearing, not decoration: zod's
 * own `.int()` on `frontmatterV1Schema` (schema-v1.ts) rejects unsafe
 * integers, so an oversized digit string (`sort: 9007199254740993`,
 * `schema: 99999999999999999999`) used to sail past THIS parse, reach that
 * final gate, and hard-skip the whole doc as a misreported `invalid_slug` —
 * the "defensive, unreachable" `schema_mismatch` branch below was actually
 * reachable. Filtering unsafe integers here keeps both fields on their
 * documented silent-fallback path instead. Caught by Fable's adversarial review.
 */
const digitsToNumber = z.string().regex(/^\d+$/).transform(Number).refine(Number.isSafeInteger);

function fail(warnings: string[], issue: ValidationIssue): ValidateResult {
  return { value: null, warnings, errors: [issue] };
}

/**
 * Version skew: an older `schema:` parses with warnings, never a hard
 * failure. A newer one degrades the same way, pointed at `stemmory update`
 * rather than left to guess at fields this validator doesn't know yet.
 */
function resolveSchemaVersion(raw: string | undefined, warnings: string[]): number {
  if (raw === undefined) return CURRENT_SCHEMA_VERSION;
  const parsed = digitsToNumber.safeParse(raw);
  if (!parsed.success) {
    warnings.push(
      `frontmatter "schema" value "${raw}" is not a non-negative integer — treated as v${CURRENT_SCHEMA_VERSION}. Fix: "schema: ${CURRENT_SCHEMA_VERSION}".`,
    );
    return CURRENT_SCHEMA_VERSION;
  }
  if (parsed.data > CURRENT_SCHEMA_VERSION) {
    warnings.push(
      `frontmatter declares "schema: ${parsed.data}", newer than this validator understands (v${CURRENT_SCHEMA_VERSION}) — parsed with v${CURRENT_SCHEMA_VERSION} rules, some fields may be ignored. Run \`stemmory update\` to get a validator that understands schema v${parsed.data}.`,
    );
  } else if (parsed.data < CURRENT_SCHEMA_VERSION) {
    warnings.push(
      `frontmatter declares "schema: ${parsed.data}", older than this validator (v${CURRENT_SCHEMA_VERSION}) — parsed with v${CURRENT_SCHEMA_VERSION} rules.`,
    );
  }
  return parsed.data;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * §2.4: "ISO date; agents must touch on every edit." Malformed shape always
 * warns (the author actively tried and got it wrong — actionable). Absence
 * only warns when the doc has opted into the kit (`schema:` declared) — §2.4
 * obliges AGENTS to touch `updated`, it does not authorise ingest to nag
 * every pre-kit doc, every sync, forever. Measured against docs/features/:
 * without this gate, 16 of 23 docs (every one predating the kit) warned on
 * every run — invented noise flagged by Fable's adversarial review.
 */
function resolveUpdated(
  raw: string | undefined,
  hasOptedIntoKit: boolean,
  warnings: string[],
): string | null {
  if (raw === undefined) {
    if (hasOptedIntoKit) {
      warnings.push(
        `frontmatter is missing "updated: YYYY-MM-DD" — agents should touch this on every edit (schema v1 §2.4).`,
      );
    }
    return null;
  }
  if (!ISO_DATE.test(raw) || !Number.isFinite(Date.parse(raw))) {
    warnings.push(
      `frontmatter "updated" value "${raw}" is not a valid ISO date — ignored. Fix: use YYYY-MM-DD format (e.g. "2026-08-06").`,
    );
    return null;
  }
  return raw;
}

/** D-1 #1: `slug:` is canonical, `feature:` is a legacy alias. Disagreement is an error. */
function resolveSlug(
  fm: ReadonlyMap<string, string>,
  warnings: string[],
): { slug: string } | { error: ValidationIssue } {
  const rawSlug = fm.get("slug");
  const rawFeature = fm.get("feature");

  if (rawSlug !== undefined && rawFeature !== undefined && rawSlug !== rawFeature) {
    return {
      error: {
        code: "slug_conflict",
        field: "slug",
        message: `frontmatter has both "slug: ${rawSlug}" and legacy "feature: ${rawFeature}" and they disagree — remove one (keep "slug:").`,
        detail: `slug: ${rawSlug} vs feature: ${rawFeature}`,
      },
    };
  }
  // Only warn when `feature:` is doing actual work — i.e. `slug:` is absent.
  // BUILD_AUDIT.md's PR-0 stubs deliberately carry BOTH keys, equal, as a
  // transitional form ("validates under schema v1 AND ingests under today's
  // live parser"); warning about a doc that already did what we told it to
  // do is exactly backwards. Measured: this was 100% of docs/features/ before
  // the gate (every doc has `feature:`), flagged by Fable's adversarial review.
  if (rawFeature !== undefined && rawSlug === undefined) {
    warnings.push(
      `frontmatter uses the legacy "feature:" key — rename to "slug:" (still accepted, but deprecated).`,
    );
  }

  const raw = rawSlug ?? rawFeature;
  if (raw === undefined) {
    return {
      error: {
        code: "missing_slug",
        field: "slug",
        message: `frontmatter is missing required field "slug" — add "slug: <path/like/this>".`,
      },
    };
  }
  if (!isValidSlug(raw)) {
    return {
      error: {
        code: "invalid_slug",
        field: "slug",
        message: `frontmatter "slug" value "${raw}" is invalid — ${SLUG_GRAMMAR_HINT}.`,
        detail: raw,
      },
    };
  }
  return { slug: raw };
}

export function validateFrontmatterV1(fm: ParsedFrontmatterBlock): ValidateResult {
  const warnings: string[] = [];
  const schemaVersion = resolveSchemaVersion(fm.fields.get("schema"), warnings);

  const slugResult = resolveSlug(fm.fields, warnings);
  if ("error" in slugResult) return fail(warnings, slugResult.error);
  const { slug } = slugResult;

  // Only a doc that actually declared a slug reaches here — a doc with no
  // slug at all already returned `missing_slug` above and keeps its
  // silent-skip contract untouched, duplicate `foo:` or not. Ordering
  // (STEM-111): after slug resolves, before the title check — refusal
  // needs a real doc to refuse.
  if (fm.duplicates.length > 0) {
    const dup = fm.duplicates[0];
    return fail(warnings, {
      code: "duplicate_key",
      field: dup.key,
      message: `frontmatter declares "${dup.key}" more than once — line ${dup.line}, first seen at line ${dup.firstLine}. Remove the duplicate.`,
      detail: dup.key,
    });
  }

  const rawTitle = fm.fields.get("title");
  if (!rawTitle) {
    return fail(warnings, {
      code: "missing_title",
      field: "title",
      message: `frontmatter is missing required field "title" — add "title: <Human readable title>".`,
      detail: slug,
    });
  }

  const rawParent = fm.fields.get("parent") ?? null;
  if (rawParent !== null && !isValidSlug(rawParent)) {
    return fail(warnings, {
      code: "invalid_parent",
      field: "parent",
      message: `frontmatter "parent" value "${rawParent}" is invalid — ${SLUG_GRAMMAR_HINT}.`,
      detail: `parent: ${rawParent}`,
    });
  }
  // ⚠️ `parent: <its own slug>` hits the DB's `nodes_no_self_parent` CHECK and
  // would abort the whole sync transaction over one file's typo. Dropped to
  // top-level with a warning instead; the node still imports.
  const selfParent = rawParent !== null && rawParent === slug;
  const parent = selfParent ? null : rawParent;
  if (selfParent) {
    warnings.push(`parent "${slug}" is this doc's own feature key — ignored, node left top-level`);
  }

  const rawStatus = fm.fields.get("status");
  let status: DocStatus | null = null;
  if (rawStatus !== undefined) {
    if (isDocStatus(rawStatus)) {
      status = rawStatus;
    } else {
      warnings.push(
        `frontmatter status "${rawStatus}" ignored — valid values are ${DOC_STATUS_VALUES.join(", ")} (schema v1). Fix: use one of those, or drop the "status:" line.`,
      );
    }
  }

  const rawType = fm.fields.get("type");
  const type: "feature" | "subfeature" =
    rawType === "feature" || rawType === "subfeature" ? rawType : parent ? "subfeature" : "feature";

  const rawSort = fm.fields.get("sort");
  const sortParsed = rawSort !== undefined ? digitsToNumber.safeParse(rawSort) : undefined;
  const sort = sortParsed?.success ? sortParsed.data : 0;

  const owner = fm.fields.get("owner") ?? null;
  const linearTeam = fm.fields.get("linear_team") ?? null;
  const updated = resolveUpdated(fm.fields.get("updated"), fm.fields.has("schema"), warnings);
  const links = parseLinks(fm.fields.get("links"), warnings);

  const finalCheck = frontmatterV1Schema.safeParse({
    slug,
    title: rawTitle,
    parent,
    status,
    type,
    sort,
    schemaVersion,
    owner,
    updated,
    linearTeam,
    links,
  });
  if (!finalCheck.success) {
    // Defensive: every field above was already checked against the same
    // rules this schema encodes, so reaching here means the two drifted.
    // Surfaced as `schema_mismatch` rather than silently trusting either side.
    const issue = finalCheck.error.issues[0];
    return fail(warnings, {
      code: "schema_mismatch",
      field: String(issue?.path[0] ?? "frontmatter"),
      message: issue?.message ?? "frontmatter did not match schema v1",
    });
  }

  return { value: finalCheck.data, warnings, errors: [] };
}
