# RELEASING.md

How `stemmory` and `@stemmory/schema` get published to npm, and the guards
around it. This repo is public. What follows is the operational record: the
order publishing has to happen in, what to do if a publish fails partway,
what's still required in repo Settings before the first tag, and how to
extend the workflow when a third package shows up.

This file used to be `GO-PUBLIC.md`, a pre-flip runbook written while the
repo was still private. The repo went public before that runbook's own
checklist was fully resolved, including the item that said the runbook
itself must not survive to the public tree unedited — it named the private
product repo and its internal spec filenames directly. This document is
the generalized replacement, kept at HEAD from here on. See "What this
does not do" below for what that replacement does and does not achieve.

---

## Prerequisites before the first tag

`.github/workflows/publish.yml` triggers only on a `vX.Y.Z` tag push. The
two accidental-publish guards below are now **done**; `NPM_TOKEN` and the
npm name recheck are what's left before anyone pushes a tag — not "before
the first real release," before the first tag of any kind, since a tag is
the only trigger this workflow has.

- **Tag protection ruleset restricting `v*` tag creation to admins**
  (Settings → Rules → Rulesets). **Done** — `Protect release tags (v*)`,
  id `20629355`, target `tag`, enforcement `active`, applies to
  `refs/tags/v*`, rules: creation + update + deletion, bypass restricted to
  the admin repository role. Update and deletion were added on top of what
  the original checklist asked for (creation only): a tag that can be
  *moved* after the fact defeats the point of protecting it, since the
  publish workflow trusts the tag to identify what it publishes. Kept here
  because the reasoning is why it's shaped this way, not just that it
  exists: without it, anyone with tag-creation rights could fire the
  publish workflow by creating a matching tag — including by publishing a
  GitHub Release through the UI, which creates the tag for you if it
  doesn't already exist. A Release *is* a tag push; there is no separate
  "release button" trigger to disable, because there is no separate
  trigger at all.
- **`npm-publish` GitHub Environment with required reviewers** (Settings →
  Environments). **Done** — created with a required reviewer configured,
  1 protection rule. Kept here because the reasoning still matters for
  whoever touches this next: the workflow references this environment
  name, and that was exactly the trap before this was configured — GitHub
  auto-creates a referenced environment with **zero protection** the first
  time the workflow runs, if it doesn't already exist in Settings. The
  YAML reference alone was never the gate; the reviewer requirement had to
  be added by hand, and now stays configured permanently, not just for the
  first release.
- **`NPM_TOKEN` repository secret**, provisioned and confirmed able to
  *create* the still-nonexistent unscoped `stemmory` package (most granular
  npm tokens are scoped to packages that already exist; check npm's token
  settings for a "new packages" allowance, or fall back to a classic
  automation token). Not yet provisioned.
- **Re-confirm npm name availability** immediately before the first tag —
  `stemmory`, `@stemmory/schema`, and `@stemmory/cli` were last checked
  2026-08-08 and were available, which is a point-in-time fact, not a
  reservation.

## Publishing is blocked independently of the above, for now

Both `packages/cli/package.json` and `packages/schema/package.json` still
carry `"private": true`. Removing that is a deliberate, ordered step (see
below) and is out of scope for this document's edits — it happens
immediately after repository visibility flips to public, not before, and
not as a drive-by change.

## The publish sequence — order matters

Repository visibility is a Settings/API action, not a commit, and can't be
made atomic with one. The ordering below controls which failure mode a
stray tag hits during the transition:

1. Confirm no `v*.*.*` tag exists yet (`git tag -l`) and the tag ruleset
   above is active.
2. Flip repository visibility to public while both packages still have
   `"private": true`. At this instant the repo is public but neither
   package can be published — the publish workflow's guard step checks
   each `package.json`'s `private` field independently of visibility.
3. Immediately after, push the commit that removes `"private": true` from
   both `package.json` files. Visibility-first, `private` removal second,
   is deliberate: reversing it would open a window where the field-based
   half of the guard is disarmed while the repo is still private — the one
   combination where a stray tag is caught by only one of the two
   independent checks instead of both agreeing.
4. Only after that commit is on `main`: push a `vX.Y.Z` tag matching both
   packages' `version` field. This is what triggers
   `.github/workflows/publish.yml`.
5. The `npm-publish` environment pauses the run for required-reviewer
   approval — approve deliberately, not reflexively.
6. Watch the run to completion rather than assuming green. It fails safe
   two independent ways (repo-visibility check and per-package `private`
   check), so a wrong ordering upstream should show up as a failed run, not
   a silent bad publish — but confirm the actual outcome.

## If a publish step fails partway

`.github/workflows/publish.yml` publishes `@stemmory/schema` before
`stemmory`, and each publish step skips itself (`npm view <pkg>@<version>`)
if that exact version is already on the registry. So: if
`@stemmory/schema@X` publishes and `stemmory@X` then fails (registry 5xx,
npm outage, or an `NPM_TOKEN` that turns out to lack create-package
permission), fixing the underlying problem and re-running the same
workflow run (or re-pushing the same tag, if the run was deleted) skips
the already-published schema step and retries only `stemmory`. No version
bump or re-tag needed for that case. A version bump + new tag is only
needed if the *version itself* needs to change — e.g. the published
`@stemmory/schema@X` turns out to be broken and needs a new version rather
than a retry of the same one.

## Post-flip maintenance

- **macOS in the CI matrix.** `.github/workflows/ci.yml` deliberately kept
  macOS out of the matrix while the repo was private — private-repo GitHub
  Actions billing charges macOS runners at roughly 10x the Linux
  per-minute rate. Now that the repo is public, add `macos-latest` to the
  matrix (either the existing `node-version` job's `runs-on`, or a second
  OS axis — whichever `ci.yml`'s conventions look like by then).
- **Consolidate the schema mirror onto the published package.**
  `packages/schema` here is a byte-for-byte mirror of the product repo's
  own schema package, kept honest only by `scripts/check-schema-parity.mjs`'s
  manifest hash check. That check is a temporary measure — it only catches
  this repo's copy drifting from its own manifest, not the product repo's
  side changing without a matching update here. Once `@stemmory/schema` is
  published, switch the product repo's hosted ingest to depend on the
  published npm package instead of its own local copy. That closes the
  drift gap structurally instead of by convention + discipline. This is a
  change in the product repo, outside this repo's reach — recorded here so
  it isn't lost.

## Extending for a third package

- The npm-side prerelease/dist-tag handling (`--tag next` for versions
  containing `-`) and the tag-vs-package-version check are already in
  `.github/workflows/publish.yml` — nothing further needed there for a
  third package.
- The private-repo/private-package guard step globs `packages/*/package.json`
  and picks up a new package automatically. The "verify tag matches package
  versions" check and the publish steps do **not** — they're hardcoded to
  `cli` and `schema` on purpose, since publish *order* for a new package is
  a dependency-graph judgment call, not something safe to infer generically.
  Extend both by hand when a third package is added.

## Decisions on record

Three items from the pre-flip review are recorded here so the reasoning
isn't implicit. The first was fixed; the other two were accepted as-is.

- **LICENSE copyright holder — decided, and applied.** All three `LICENSE`
  files (root, `packages/cli/`, `packages/schema/` — plain copies, not
  symlinks) now read `Copyright (c) 2026 AdyriX Systems Private Limited`,
  verified byte-identical to each other after the edit. The previous value
  named the product brand, which is not a legal entity and so cannot hold
  copyright. The licence itself is unchanged: still MIT, matching the
  `license` field in both published `package.json` files — this was a
  holder correction, not a licence change. It was deliberately left for a
  human rather than decided by default, because the line is not retractable
  once the repo is public and forked.

- **Fixture content.** `packages/schema/fixtures/decision-canonical.md`
  and `packages/schema/fixtures/kit-fields-populated.md` carry a first
  name (an `owner: vamsi` field), a project slug, and one sentence
  recording a real product decision about auth providers. No secret.
  These fixtures are mirrored byte-for-byte from the product repo and
  hashed into `packages/schema/.parity-manifest.json`, enforced by
  `pnpm schema:parity` in CI. Scrubbing this copy alone would break parity —
  it requires a coordinated edit in both repos plus regenerated manifests
  on each side, which reaches outside this repo. **Accepted as-is.**
- **Comment-only internal ticket IDs, and comment-only spec-doc citations.**
  Ticket IDs (e.g. `STEM-82`, `STEM-86`) and citations of the product
  repo's private spec docs (e.g. "DATA_MODEL.md §4") appear in header
  comments and test `describe`/`it` names across `packages/cli/src/**` and
  `packages/schema/src/**`. **Accepted as-is** — visible in source is a
  materially different bar than printed at runtime, these comments explain
  *why* non-obvious behaviour exists, and a bare filename in a comment
  discloses nothing to a reader who can't open it. Scrubbing them would be
  a net loss for maintainers for no reader-facing benefit.

  That bar does **not** extend to strings a command actually emits —
  `stemmory lint`'s warnings/errors, `stemmory`'s help text, or anything
  else returned to a caller. Those reach a public user who has no access
  to the cited doc, which makes a citation there a UX bug, not just a
  disclosure question. One was found and fixed in this change:
  `packages/schema/src/parse-doc.ts`'s GitHub-ingest-clamp warning cited
  `(DATA_MODEL.md §4)` in the emitted string itself; the citation was
  dropped from the string (the warning already states the rule in full,
  so nothing was lost) and kept in the adjacent code comment, where it's
  still useful to a maintainer. A repo-wide check at the time found this
  was the only emitted string carrying a citation — verified directly
  against every non-comment, non-test-name occurrence of the four private
  spec filenames plus `DATA_MODEL.md`/`BUILD_AUDIT.md` in both packages'
  `src/`, not assumed from the one file. `packages/schema/src/fixtures.test.ts`
  now asserts, per fixture, that no warning `parseDoc` emits contains any
  of those filenames — the check that makes this the second and last time
  this gets re-verified by hand instead of caught automatically.

## What this document does not do

Replacing this file at HEAD removes it from the tree that ships from now
on. It does **not** remove the previous version from the repo's public
git history — the original runbook, with the private repo's name and its
internal spec filenames, is still readable in the 14 commits that predate
this change (`git log`, GitHub's history view, any existing clone or
fork). An independent secret sweep of that history came back clean and
GitHub's own secret scanning reports zero alerts, so nothing in it needs
rotating — but the repo name and spec filenames are still there for anyone
who looks.

Erasing them from history would mean rewriting this public repo's commits
(feasible at 14 commits and, so far, likely zero forks — but disruptive,
and it invalidates every existing clone). That's a founder call, not one
made in this change.
