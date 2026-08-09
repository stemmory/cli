# GO-PUBLIC.md

Runbook for flipping `stemmory/cli` from private to public and cutting the first npm release. Written for STEM-91 (5.4). **Publishing is the one irreversible step in this epic** — npm provenance permanently attests a public-repo build, and an accidental publish built from private history cannot be walked back. Do not skip steps or reorder anything marked **ORDER MATTERS**.

None of the items on this list have been executed. This file only records what a human needs to decide and do, in order.

⚠️ **This file itself must not survive to the public repo unedited — see §1.8.** It names the private repo, all four internal spec filenames, and (until you scrub it per §1.8) quoted fixture content. Do not copy sections of it verbatim into a public issue, PR description, or commit message before the flip.

---

## 0. Before touching visibility at all

- [ ] **Squash history to a clean initial commit.** The current history was built against private specs and internal review threads; nothing in it should carry over verbatim into a public repo. The squashed tree is also where §1.8 (this file) gets handled — don't squash first and clean up after.
- [ ] **Scan commits, issues, PRs, and Actions logs for secrets and internal references.** All of these become public retroactively the moment visibility flips — a secret rotated *after* the flip is still a secret that was public. Check: env values ever pasted into a PR comment or Actions log, API keys in commit messages, internal Slack/Linear links in PR descriptions.
- [ ] **Add a tag protection ruleset restricting `v*` tag creation to admins** (Settings → Rules → Rulesets → New tag ruleset, pattern `v*`). Do this now, before the flip — it's a pure hardening step, doesn't require the repo to be public first, and closes the accidental-publish path described in §2's warning. Without it, anyone with tag-creation rights (or write access via a PAT) can fire `.github/workflows/publish.yml` by creating a matching tag — including by publishing a GitHub Release through the UI, which creates the tag for you if it doesn't already exist. A Release *is* a tag push; there is no separate "release button" trigger to worry about, and no separate one to disable.
- [ ] **Configure the `npm-publish` GitHub Environment with required reviewers** (Settings → Environments → New environment → name it exactly `npm-publish` to match `.github/workflows/publish.yml` → add required reviewers). The workflow already references this environment; GitHub auto-creates it with **zero protection** the first time the workflow runs if it doesn't exist in Settings yet — the YAML reference alone is not the gate. This is the last manual approval before the first real publish and should stay configured permanently, not just for the first release.
- [ ] **Provision the `NPM_TOKEN` repository secret.** Needs: a granular npm automation token with publish permission for the `@stemmory` scope, and — since `stemmory` (unscoped) doesn't exist on the registry yet — permission to *create* a new unscoped package, which most granular tokens don't grant by default (they're normally scoped to packages that already exist). Check npm's token settings for a "new packages" or org-level publish allowance before assuming a granular token will work; a classic automation token is the fallback if it won't. Do this well before the first tag — discovering a token can't create `stemmory` mid-publish, after `@stemmory/schema` already succeeded, is exactly the partial-publish scenario §3's idempotent publish steps exist to make *recoverable*, not to prevent.
- [ ] **Confirm npm name availability**, one more time, immediately before the first tag (checked during STEM-91 prep on 2026-08-08: unscoped `stemmory`, `@stemmory/schema`, and `@stemmory/cli` all returned `404 Not found` on the registry — i.e. available at that point in time, not a guarantee it stays that way). Fallback is `@stemmory/cli` with bin still `stemmory` if the unscoped name gets taken first. **Claim the `@stemmory` npm scope regardless of unscoped-name availability** (per `ARCHITECTURE_AND_SYNC_SPEC.md` §6).

## 1. The seven items the reviews already found

### 1.1 Private-repo spec citations (~24 files)

Source comments cite `AGENT_CONVENTIONS_KIT_SPEC.md`, `ARCHITECTURE_AND_SYNC_SPEC.md`, `CONVENTIONS.md`, and `ONBOARDING_IMPORT_SPEC.md` — all four live only in the private product repo (`AdyriX/stemmory`). Every citation becomes a dangling reference the moment this repo is public — and note this isn't only a GitHub-source-browsing concern: `packages/cli`'s published tarball ships raw `src/*.js` (see its `package.json` `files` field), so these citations also ship straight to **npm**, reachable by anyone who runs `npm view stemmory` or unpacks the tarball, not just GitHub visitors. Files found citing one or more of these (checked 2026-08-08; re-grep before acting, this list will drift):

```
packages/cli/src/cli.js
packages/cli/src/commands/init.js
packages/cli/src/commands/lint.js
packages/cli/src/commands/update.js
packages/cli/src/lib/config.js
packages/cli/src/lib/config.test.js
packages/cli/src/lib/fragment.js
packages/cli/src/lib/fragment.test.js
packages/cli/src/lib/skill-fields.js
packages/cli/src/lib/skill.js
packages/cli/src/lib/slug-util.js
packages/schema/fixtures/hierarchical-slug-depth-4.md
packages/schema/fixtures/kit-fields-populated.md
packages/schema/fixtures/missing-slug.md
packages/schema/src/decisions.test.ts
packages/schema/src/decisions.ts
packages/schema/src/fixtures.test.ts
packages/schema/src/frontmatter.ts
packages/schema/src/links.ts
packages/schema/src/parse-doc.ts
packages/schema/src/schema-v1.ts
packages/schema/src/slug.ts
packages/schema/src/validate.test.ts
packages/schema/src/validate.ts
```

- [ ] Rewrite as "the Conventions Kit spec" (or similar generic phrasing), or publish the referenced sections somewhere public and link to that instead.

### 1.2 Internal ticket IDs in code

`STEM-70`, `STEM-74`, `STEM-82`, `STEM-86` appear in header comments and test `describe`/`it` names across `packages/cli/src/**` and `packages/schema/src/**` (grep `STEM-[0-9]` to re-find them; ~20 hits as of 2026-08-08).

- [ ] As of this check, none of them are in `HELP_TEXT` or any other string the CLI actually prints to a user at runtime (`packages/cli/src/cli.js`'s `HELP_TEXT` was checked directly) — but they're still visible to anyone reading source once the repo is public (including via the npm tarball, per §1.1's note), which is the review finding's actual concern. Decide whether comment-only ticket IDs need scrubbing too, or whether "visible in source, not in output" is an acceptable bar.

### 1.3 Fixture content carries real internal state

`packages/schema/fixtures/decision-canonical.md` and `packages/schema/fixtures/kit-fields-populated.md` contain real product decision text and a real name — a project slug, an owner field with a first name, and a full sentence recording an actual product decision and its rationale. (Deliberately not quoted here — quoting it in this runbook would just be a second copy of the same leak. Open the two files directly to see the exact text.)

**Left unchanged.** These fixtures are mirrored byte-for-byte from the private product repo's `packages/schema/fixtures/` and hashed into `packages/schema/.parity-manifest.json` (`pnpm schema:parity`, enforced in CI). Scrubbing this copy alone breaks parity — the private repo's copy would need the identical edit in the same coordinated change, then both manifests regenerated (`pnpm schema:parity:update` here, whatever the private repo's equivalent is there). That coordination touches the other repo, which is out of this story's reach.

- [ ] Decide: scrub both copies together in a coordinated change, or accept that this content becomes public. Either way it's a decision to make deliberately, not by default.

### 1.4 LICENSE copyright holder — legal call, not made here

`LICENSE` (and the identical copies at `packages/cli/LICENSE` and `packages/schema/LICENSE` — all three are plain file copies, not symlinks, verified byte-identical) currently reads:

```
Copyright (c) 2026 Stemmory
```

Proposed replacement: `AdyriX Systems Private Limited` (the legal entity, vs. `Stemmory` the product brand). **This file is deliberately left untouched.** Reasons this needs a human, not an agent:
- Both `ARCHITECTURE_AND_SYNC_SPEC.md` §6 and `AGENT_CONVENTIONS_KIT_SPEC.md` §7 item 4 still list the kit's license as an **open item** ("decide before publish"), even though 5.1's acceptance criteria states MIT.
- Once the repo is public and forked, the copyright line is not retractable.

- [ ] Decide the copyright holder and update all three `LICENSE` files identically before the flip.

### 1.5 `private: true` removal — **ORDER MATTERS**, see §2

Both `packages/cli/package.json` and `packages/schema/package.json` currently have `"private": true` with `publishConfig.access: "public"` already staged alongside it. **Do not remove it here in isolation — see the exact ordering required in §2.** Removing it too early (before the repo is actually public) opens the specific window `.github/workflows/publish.yml`'s guard step was written to survive, but survives it precisely *because* that guard checks repo visibility independently — don't rely on that redundancy as an excuse to get the ordering in §2 wrong.

### 1.6 macOS in the CI matrix — post-flip only

`.github/workflows/ci.yml` already carries the marker comment:

```
# TODO(5.4): add a macOS leg to this matrix once the repo goes public.
# Private-repo GitHub Actions billing charges macOS runners at roughly
# 10x the Linux per-minute rate, so macOS stays out while private.
```

- [ ] Once public, add `macos-latest` to the `matrix.node-version` job's `runs-on`, or add a second OS axis to the matrix — whichever `ci.yml`'s conventions look like by then.

### 1.7 Consolidate the schema mirror onto the published package

Per `ARCHITECTURE_AND_SYNC_SPEC.md` §6: `packages/schema` here is a byte-for-byte mirror of the private product repo's own `packages/schema`, kept honest only by `scripts/check-schema-parity.mjs`'s manifest hash check. That parity check is explicitly a **temporary measure** — its known gap is that there's no automated bridge catching drift *from* the private repo side (parity only fails when this repo's copy diverges from a manifest generated from this repo's own files; it can't detect the private repo changing without this repo's copy being updated to match).

- [ ] Once `@stemmory/schema` is published, switch the private product repo's hosted ingest to depend on the published npm package instead of its own local copy. This closes the drift gap structurally (single source of truth) rather than by convention (parity check + discipline). This is a change in the private repo, outside this story's reach — recorded here so it isn't lost.

### 1.8 GO-PUBLIC.md itself

This file is, right now, the single densest concentration of "things that shouldn't be public" in the whole repo: it names the private repo (`AdyriX/stemmory`), all four internal spec filenames, and (before §1.3 is resolved) describes exactly which two fixture files carry real internal data. None of the other seven items' checklists include removing *this* file, which means completing all of them and then squashing history in §0 would still leave this document itself sitting in the public tree.

- [ ] Before or as part of the §0 squash: delete this file from the tree that goes public, or move its still-relevant post-flip items (§1.6, §1.7, §4) into a version with the private-repo and spec-filename references generalized. Either way, this file does not survive to the public initial commit as-is.

## 2. The flip itself — **ORDER MATTERS**

Repository visibility is a Settings/API action — it is **not a commit**, and cannot be made atomic with one. "One commit that does both" is not achievable; the two actions happen at different times no matter how quickly you do them back to back, and the ordering below controls which single window that gap opens.

1. [ ] All of §0 and §1 above resolved (or explicitly accepted as-is, per the "decide" items), **including §1.8** — confirm the tree about to go public does not still contain an unedited copy of this file.
2. [ ] Confirm no `v*.*.*` tag exists yet (`git tag -l`) and the tag ruleset from §0 is active.
3. [ ] **Flip the GitHub repository visibility to public first**, while both packages still have `"private": true`. At this instant the repo is public but neither package can be published — `.github/workflows/publish.yml`'s guard step checks each `package.json`'s `private` field independently of visibility, so even a stray tag pushed in this exact window is still refused.
4. [ ] **Immediately after**, push the commit that removes `private: true` from `packages/cli/package.json` and `packages/schema/package.json`. This ordering — visibility first, `private:true` removal second — is deliberate: reversing it (removing `private:true` while the repo is still private) would leave a window where the field-based half of the guard is already disarmed *and* the repo is still private, which is the one combination where a stray tag would only be caught by the guard's repo-visibility check instead of by both checks agreeing. Visibility-first keeps at least one of the two guard conditions true for the entire transition, not just for careful readers of this file.
5. [ ] Only after that commit is on `main`: push a `vX.Y.Z` tag matching both packages' `version` field. This is what triggers `.github/workflows/publish.yml`.
6. [ ] The `npm-publish` environment (§0) will pause the run for the required reviewer approval configured there — approve deliberately, not reflexively.
7. [ ] Watch the run to completion. It fails safe if the ordering above was somehow still wrong (both guard conditions checked independently; see the workflow file's header comment) — confirm the actual outcome rather than assuming green.

## 3. What happens if a publish step fails partway

`.github/workflows/publish.yml` publishes `@stemmory/schema` before `stemmory`, and each publish step now skips itself (`npm view <pkg>@<version>`) if that exact version is already on the registry. So: if `@stemmory/schema@X` publishes successfully and `stemmory@X` then fails (registry 5xx, npm outage, or — see §0 — an `NPM_TOKEN` that turns out to lack create-package permission for the still-nonexistent `stemmory` name), fixing the underlying problem and re-running the same workflow run (or pushing the same tag again, if the run was deleted) will skip the already-published schema step and retry only `stemmory`. No version bump or re-tag needed for that case. A version bump + new tag is only needed if the *version itself* needs to change (e.g. the published `@stemmory/schema@X` turns out to be broken and needs a new version rather than a retry of the same one).

## 4. Optional, beyond what's built in

- [ ] The npm-side prerelease/dist-tag handling (`--tag next` for versions containing `-`) and the tag-vs-package-version check are both already in `.github/workflows/publish.yml` — nothing further needed there.
- [ ] If a third package is ever added to `packages/`, the private-repo/private-package guard step already picks it up automatically (it globs `packages/*/package.json`). The "verify tag matches package versions" check and the publish steps do **not** — they're hardcoded to `cli` and `schema` on purpose, since publish *order* for a new package is a dependency-graph judgment call, not something safe to infer generically. Extend both when the third package is added.
