---
name: extension-release
description: Plan and verify commit timing, SemVer changes, tags, and releases for this npm-managed Chrome MV3 repository. Use for release-readiness, version questions, or requested repository changes; keep questions read-only and preserve the explicit boundary for tags, pushes, and releases.
---

# Extension release workflow

Read the repository `AGENTS.md`, `package.json`, manifest template, current status, both diffs, and relevant verification results. Use the root `package.json` as the version source of truth; this repository has no `app/package.json`.

## Commit timing

- A change request includes the normal local commit after implementation, required documentation, and verification. Questions and reviews are read-only; honor an explicit no-commit limit.
- Work on main without creating branches. Separate independent purposes into commits. For Issue work, commit each Issue separately and identify it in the body; do not create empty commits for Issues needing no changes.
- Protect unrelated worktree and staged changes. Stage named paths only; never use `git add .` or `git add -A`.
- Run `npm run verify:full` before committing by default. For changes with no UI impact, `npm run verify` is sufficient. Choose one, reuse valid results for the same state and environment, and do not commit after failed verification.
- Before committing, inspect status and both diffs, run `git diff --cached --check` and `npm run version:check-staged`, and check generated output. Report the commit ID and remaining changes afterward.

## Version and message

Update the version in every change commit. Include `package.json`, `Triadichrome-extension/manifest.template.json`, and generated `Triadichrome-extension/manifest.json` together with matching versions. Keep `package-lock.json` synchronized and include any changed distribution output from `npm run build`. Do not create version-only commits or edit generated output directly.

Choose SemVer independently from commit type:

- MAJOR: a breaking change to published features, stored data, or configuration.
- MINOR: a backward-compatible feature addition or deprecation announcement.
- PATCH: a compatible fix or a documentation, test, build, or maintenance change.

`npm run version:next -- patch` (or `minor` / `major`) prints a candidate without modifying files.

Use `<type>[!]: <version> <日本語の説明>` for the subject, with a type from `AGENTS.md`. Write the subject and body in Japanese. For multiple files, version updates, or workflow changes, include `scope:`, `目的:`, `内容:`, `確認:`, and `影響:`. Use lowercase English nouns for scope and omit sensitive values.

## Hooks, push, tags, and releases

- Enable repository hooks with `npm run setup:hooks`. Preserve a different existing hooks configuration rather than overwriting it silently. Normal verification fails when these hooks are not configured.
- The pre-commit hook checks staged whitespace and the three version files. The pre-push hook runs `npm run verify:full`, including UI tests. A browser startup failure is a failed verification.
- Push, PR creation, tags, and releases each require an explicit request. Issue completion and local commits do not grant that authorization.
- Ordinary commits do not create tags. Before a requested tag or release, run `npm run verify:release` and confirm a clean worktree, matching versions, successful verification, and an unused `vX.Y.Z` matching the package. The command checks local tags; also check the destination when publishing is requested. Create an annotated tag, verify its target, and never move, overwrite, or delete an existing tag.
