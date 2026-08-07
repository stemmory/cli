// stemmory/packages/schema/src/slug.ts
//
// CONVENTIONS.md §3: lowercase, `a-z0-9-` per segment, `/` between segments,
// max depth 4 (project root is implicit, not part of the slug).
const SLUG_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_DEPTH = 4;

export function isValidSlug(slug: string): boolean {
  const segments = slug.split("/");
  if (segments.length === 0 || segments.length > MAX_SLUG_DEPTH) return false;
  return segments.every((s) => SLUG_SEGMENT.test(s));
}

/** Human-readable fix hint, shared by every error message that names a bad slug. */
export const SLUG_GRAMMAR_HINT =
  'lowercase a-z0-9 segments joined by "/", max depth 4 (e.g. "auth/social-login")';
