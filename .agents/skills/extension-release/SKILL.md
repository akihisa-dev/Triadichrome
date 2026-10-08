---
name: extension-release
description: Plan and verify commit timing, SemVer changes, tags, and releases for this npm-managed Chrome MV3 repository. Use for release-readiness, version questions, or requested repository changes; keep questions read-only and preserve the explicit boundary for tags, pushes, and releases.
---

# Extension release workflow

Read [AGENTS.md](../../../AGENTS.md) for authorization, commit timing, SemVer, message format, and verification requirements. Use [README](../../../README.md#検証とgitフック) for commands and setup. This skill describes execution steps; it does not define a separate policy.

## Prepare and verify a commit

1. Inspect HEAD, status, both diffs, the root `package.json`, the manifest template, and relevant verification results. This repository has no `app/package.json`.
2. For an ordinary commit, keep the version and record its SemVer category in the commit body under AGENTS.md. For an explicitly requested accumulated version update or authorized tag/release preparation, review unaccounted commits in chronological order and pass their categories to `npm run version:next -- patch minor patch` to calculate a candidate. Update the source versions and lockfile, build the distribution, and record the accounted commit range in a dedicated version update commit. Do not count that dedicated commit again.
3. Select verification under AGENTS.md and inspect the resulting distribution. Reuse valid results for the same state and environment. If hook setup is needed, follow README and preserve any different existing configuration.
4. Inspect the exact staged diff and run `git diff --cached --check` and `npm run version:check-staged`. Commit with the required Japanese message only after applicable verification succeeds, then report the commit ID and remaining changes.

## Requested tags and releases

For a tag or release authorized under AGENTS.md, run `npm run verify:release` and inspect its result before creating the annotated tag. The command checks local tags only; check the destination as well when publishing is requested. Verify the created tag's target and the resulting Git state. Report local creation and remote publication separately so an unpushed tag or commit is not described as published.
