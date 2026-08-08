// stemmory/packages/schema/src/schema-v1.ts
//
// THE frontmatter schema v1 definition, in zod — the one place its shape is
// declared. `validate.ts` builds a candidate object field by field (each
// field has its own required/ignore-and-warn/error behaviour — see there) and
// runs it through this schema as the final, authoritative gate: if the
// candidate does not conform to `frontmatterV1Schema`, it is not a valid
// schema-v1 document, full stop. That keeps zod as the actual validator
// rather than decoration around hand-rolled checks that happen to agree with it.
import { z } from "zod";

import { isValidSlug, SLUG_GRAMMAR_HINT } from "./slug";
import { DOC_STATUS_VALUES } from "./status";

/** Bump when a new frontmatter field or vocabulary value is added. */
export const CURRENT_SCHEMA_VERSION = 1;

const slugShape = z.string().refine(isValidSlug, `slug ${SLUG_GRAMMAR_HINT}`);

export const frontmatterV1Schema = z.object({
  slug: slugShape,
  title: z.string().min(1),
  parent: slugShape.nullable(),
  /** Document vocabulary — see status.ts for the mapping to `node_status`. */
  status: z.enum(DOC_STATUS_VALUES).nullable(),
  type: z.enum(["feature", "subfeature"]),
  sort: z.number().int().nonnegative(),
  // Nonnegative, not positive: an old doc can legitimately predate the
  // `schema:` field's own numbering and be marked `schema: 0` — version skew
  // must degrade with a warning, never hard-fail (§3), and a stricter bound
  // here would turn that into a `schema_mismatch` skip.
  schemaVersion: z.number().int().nonnegative(),
  // AGENT_CONVENTIONS_KIT_SPEC.md §2.4's remaining four fields. All optional:
  // no doc in this repo's `docs/features/` predates them, and reconcile.ts
  // must keep ingesting every one of those unchanged (a missing optional
  // field is a warning at most, never a skip — validate.ts).
  owner: z.string().min(1).nullable(),
  /** ISO `YYYY-MM-DD`. "agents must touch on every edit" per §2.4 — absence still warns. */
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  linearTeam: z.string().min(1).nullable(),
  links: z.array(z.string()),
});

export type FrontmatterV1 = z.infer<typeof frontmatterV1Schema>;
