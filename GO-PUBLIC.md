# GO-PUBLIC.md

Runbook for flipping `stemmory/cli` from private to public and cutting the first npm release. Written for STEM-91 (5.4). **Publishing is the one irreversible step in this epic** — npm provenance permanently attests a public-repo build, and an accidental publish built from private history cannot be walked back. Do not skip steps or reorder the two constraints marked **ORDER MATTERS** below.

None of the items on this list have been executed. This file only records what a human needs to decide and do, in order.

---

## 0. Before touching visibility at all

- [ ] **Squash history to a clean initial commit.** The current history was built against private specs and internal review threads; nothing in it should carry over verbatim into a public repo.
- [ ] **Scan commits, issues, PRs, and Actions logs for secrets and internal references.** All of these become public retroactively the moment visibility flips — a secret rotated *after* the flip is still a secret that was public. Check: env values ever pasted into a PR comment or Actions log, API keys in commit messages, internal Slack/Linear links in PR descriptions.
- [ ] **Confirm npm name availability**, one more time, immediately before the first tag (checked during STEM-91 prep on 2026-08-08: unscoped `stemmory`, `@stemmory/schema`, and `@stemmory/cli` all returned `404 Not found` on the registry — i.e. available at that point in time, not a guarantee it stays that way). Fallback is `@stemmory/cli` with bin still `stemmory` if the unscoped name gets taken first. **Claim the `@stemmory` npm scope regardless of unscoped-name availability** (per `ARCHITECTURE_AND_SYNC_SPEC.md` §6).

## 1. The seven items the reviews already found

### 1.1 Private-repo spec citations (~24 files)

Source comments cite `AGENT_CONVENTIONS_KIT_SPEC.md`, `ARCHITECTURE_AND_SYNC_SPEC.md`, `CONVENTIONS.md`, and `ONBOARDING_IMPORT_SPEC.md` — all four live only in the private product repo (`AdyriX/stemmory`). Every citation becomes a dangling reference the moment this repo is public. Files found citing one or more of these (checked 2026-08-08; re-grep before acting, this list will drift):

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

- [ ] As of this check, none of them are in `HELP_TEXT` or any other string the CLI actually prints to a user at runtime (`packages/cli/src/cli.js`'s `HELP_TEXT` was checked directly) — but they're still visible to anyone reading source once the repo is public, which is the review finding's actual concern. Decide whether comment-only ticket IDs need scrubbing too, or whether "visible in source, not in output" is an acceptable bar.

### 1.3 Fixture content carries real internal state

`packages/schema/fixtures/decision-canonical.md` and `packages/schema/fixtures/kit-fields-populated.md` contain real product decisions and a real name:

- `slug: share-links`
- `owner: vamsi`
- `- 2026-07-12 — Use Apple + Google only for v1 — because 90% of our users are on those platforms and each extra provider adds review burden.`

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

### 1.5 `private: true` removal — **ORDER MATTERS**

Both `packages/cli/package.json` and `packages/schema/package.json` currently have `"private": true` with `publishConfig.access: "public"` already staged alongside it.

- [ ] Remove `private: true` from both `package.json` files in the **same commit** that flips repository visibility to public. Not before (nothing to publish yet, and it's a pointless window where the private-repo guard in `.github/workflows/publish.yml` is the only thing standing between "private" and "public" state on the publish path), not after (a gap where the repo is public but the packages still can't be published, inviting someone to "fix" it in an unreviewed commit).

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

## 2. The flip itself — **ORDER MATTERS**

1. [ ] All of §0 and §1 above resolved (or explicitly accepted as-is, per the "decide" items).
2. [ ] One commit that does both, together: remove `private: true` from `packages/cli/package.json` and `packages/schema/package.json`, **and** flip the GitHub repository visibility to public.
3. [ ] Only after that commit is on `main` and the repo is confirmed public: push a `vX.Y.Z` tag matching both packages' `version` field. This is what triggers `.github/workflows/publish.yml` — see that file's header comment for how it fails safe (an explicit private-package guard step, verified during STEM-91 to actually fail today; not relying on npm/pnpm's own private-package check, which does **not** fire under `--dry-run` and so couldn't be trusted as the only guard for something irreversible).
4. [ ] Watch the publish run. Provenance requires the repo to already be public at publish time — if it fires from a still-private state, the workflow's guard step should stop it, but confirm the run's outcome rather than assuming.

## 3. Optional, not required by the current workflow

- [ ] Consider a GitHub Environment (e.g. `npm-publish`) with required manual reviewers on `.github/workflows/publish.yml`'s job, as a second gate beyond "push a tag." Not added during STEM-91 — the tag-only trigger plus the private-package guard were judged sufficient, and an environment that isn't configured in the repo's settings yet would be an untested extra moving part. Add it here if the extra approval step is wanted before the first real publish.
