// stemmory-cli/packages/cli/src/lib/skill-fields.js
//
// The stemmory-conventions skill documents the frontmatter schema so
// agents never have to guess it (AGENT_CONVENTIONS_KIT_SPEC.md §2.2 point
// 1). §6 names "skill/schema drift" as a known risk and mandates
// `@stemmory/schema` as the single source of truth - this file must never
// define field names by hand disconnected from it.
//
// FIELD_DOCS pairs each of `frontmatterV1Schema`'s own zod-shape keys with
// its on-disk YAML key + a one-line human description. The field NAMES and
// their COUNT are read from `frontmatterV1Schema.shape` at import time, not
// retyped here - `diffFields` below is checked immediately after, and
// throws if packages/schema adds, renames, or removes a field without this
// file being updated to match. That turns drift into a loud import-time
// failure (see skill-fields.test.js) instead of a silently stale skill.
import { frontmatterV1Schema } from "@stemmory/schema";

/** @type {Record<string, { yaml: string, desc: string }>} */
const FIELD_DOCS = {
  schemaVersion: { yaml: "schema", desc: "Schema version this doc was written against. Currently always `1`." },
  slug: {
    yaml: "slug",
    desc: "Kebab-case path segments joined by `/`, max depth 4 (e.g. `auth/social-login`). Must match the filename. (Legacy alias: `feature:` - still accepted, deprecated.)",
  },
  title: { yaml: "title", desc: "Human-readable title." },
  parent: { yaml: "parent", desc: "Slug of the parent feature, or omit for a top-level feature." },
  status: {
    yaml: "status",
    desc: "One of the status values below. Omit if genuinely unknown - never guess one.",
  },
  type: { yaml: "type", desc: "`feature` or `subfeature`. Inferred from `parent` when omitted." },
  sort: { yaml: "sort", desc: "Non-negative integer, sibling display order. Defaults to `0`." },
  owner: { yaml: "owner", desc: "Who owns this feature (free text, e.g. a username)." },
  updated: { yaml: "updated", desc: "ISO `YYYY-MM-DD`. Touch this on every edit that changes the doc." },
  linearTeam: { yaml: "linear_team", desc: "Linear team key for this feature's issues. Optional." },
  links: { yaml: "links", desc: "Comma-separated related URLs / PR references. Optional." },
};

/**
 * Pure comparison, exported so the drift check itself is testable without
 * needing to actually break `@stemmory/schema` to prove it fires.
 * @param {string[]} schemaFields
 * @param {string[]} documentedFields
 */
export function diffFields(schemaFields, documentedFields) {
  return {
    missing: schemaFields.filter((f) => !documentedFields.includes(f)),
    extra: documentedFields.filter((f) => !schemaFields.includes(f)),
  };
}

const schemaFields = Object.keys(frontmatterV1Schema.shape);
const { missing, extra } = diffFields(schemaFields, Object.keys(FIELD_DOCS));
if (missing.length > 0 || extra.length > 0) {
  throw new Error(
    "stemmory-conventions skill's frontmatter field docs have drifted from @stemmory/schema's " +
      `frontmatterV1Schema - missing: [${missing.join(", ")}] extra: [${extra.join(", ")}]. ` +
      "Update packages/cli/src/lib/skill-fields.js to match.",
  );
}

/** Row order follows the schema's own declaration order (schema-v1.ts). */
export function frontmatterFieldTable() {
  const header = "| YAML key | Meaning |\n| --- | --- |";
  const rows = schemaFields.map((f) => `| \`${FIELD_DOCS[f].yaml}\` | ${FIELD_DOCS[f].desc} |`);
  return [header, ...rows].join("\n");
}
