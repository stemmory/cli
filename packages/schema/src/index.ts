// stemmory/packages/schema/src/index.ts
//
// The package entry point — the ONE frontmatter schema v1 definition and
// validator in the codebase (STEM-70). `apps/web/lib/sync/markdown.ts`
// consumes this rather than carrying its own copy of the rules.
export {
  CURRENT_SCHEMA_VERSION,
  frontmatterV1Schema,
  type FrontmatterV1,
} from "./schema-v1";

export {
  validateFrontmatterV1,
  type IssueCode,
  type ValidateResult,
  type ValidationIssue,
} from "./validate";

export {
  parseDoc,
  shouldSkipByName,
  type ParsedDecision,
  type ParsedDoc,
  type ParseResult,
  type SkipReason,
} from "./parse-doc";

export { parseDecisions } from "./decisions";
export { firstParagraph } from "./excerpt";
export { parseFrontmatterBlock, splitFrontmatter } from "./frontmatter";
export { parseLinks } from "./links";

export { isValidSlug, MAX_SLUG_DEPTH, SLUG_GRAMMAR_HINT } from "./slug";

export {
  DOC_STATUS_TO_NODE_STATUS_EXPLICIT_AUTHORITY,
  DOC_STATUS_TO_NODE_STATUS_GITHUB_INGEST,
  DOC_STATUS_VALUES,
  NODE_STATUS_VALUES,
  isDocStatus,
  type DocDerivedNodeStatus,
  type DocStatus,
  type GithubIngestNodeStatus,
  type NodeStatus,
} from "./status";
