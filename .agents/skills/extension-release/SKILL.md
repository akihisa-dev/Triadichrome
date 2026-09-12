---
name: extension-release
description: Plan and verify commit timing, SemVer changes, tags, and releases for this npm-managed Chrome MV3 repository. Use for release-readiness, version questions, or requested repository changes; keep questions read-only and preserve the explicit boundary for tags, pushes, and releases.
---

# Extension release workflow

Use this skill when the request concerns when to commit, how to bump the version, whether a release is ready, or how to create a tag. Read the repository `AGENTS.md`, `package.json`, `Triadichrome-extension/manifest.template.json`, current status, and relevant verification results before deciding.

## Commit timing

- Separate independent purposes into separate commits. Do not create a commit merely to record an intermediate state or a version-only change.
- A question, review, or release-readiness check is read-only. When the user explicitly requests a change, the normal commit is part of completing that change unless the user explicitly limits the work to planning or says not to commit.
- Protect unrelated worktree and staged changes. Stage only named paths; never use broad `git add .` or `git add -A`.
- Before a requested commit, inspect status and both diffs, run `git diff --cached --check`, verify package/manifest version consistency, and run the relevant npm checks. Do not commit a failed verification.
- After a commit, report the commit ID and confirm remaining changes. This skill does not authorize a commit by itself.

## Version policy

`package.json` is the version source of truth. `Triadichrome-extension/manifest.template.json` must carry the same version, and `Triadichrome-extension/manifest.json` is generated from that template. Every normal commit for a requested change includes the two source versions together; a version-only commit is not created.

Choose SemVer independently from commit type:

- MAJOR: a breaking change to a published feature, stored data, or configuration format.
- MINOR: a backward-compatible feature addition or a deprecation announcement.
- PATCH: a backward-compatible bug fix or a documentation, test, build, or maintenance change that needs a version update.

Use `<type>[!]: <version> <日本語の説明>` for commit subjects. Choose `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, or `revert`. Write the subject and body in Japanese; include `目的:` and `内容:` and add `scope:`, `確認:`, and `影響:` when useful.

## Tag and release boundary

Do not create tags for ordinary commits. A tag or release needs an explicit request, a clean worktree, matching package/manifest versions, successful appropriate verification, and an unused annotated `vX.Y.Z` that matches the package version. Never move, overwrite, or delete an existing tag. Do not infer push or store publication permission from a release-readiness request.
