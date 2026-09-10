# Large-change workflow

## Before editing

Present a short scope contract: requested surfaces, explicit exclusions, current `confirmed`/`not-found`/`insufficient-evidence` items, dependency order, and the final completion condition. Establish a baseline from the current HEAD, worktree, Node/npm versions, current generated output if present, and the relevant `npm run typecheck`/`npm run build` results.

Do not treat a failed baseline as success. Separate pre-existing, environment, and change-caused failures before proceeding.

## Change waves

1. Fix the contract and impact map.
2. Add or update characterization and static boundary checks when needed.
3. Move pure logic and adapters without changing consumers.
4. Move state ownership, persistence, asynchronous lifecycle, cancellation, and reset behavior.
5. Reconnect the service worker, independent page, CSV/file adapters, and future UI consumers.
6. Remove an old path only after all consumers, manifest/build references, tests, and documents are migrated.
7. Synchronize the source-of-truth documents, version policy, and final audit.

Keep each wave verifiable. If an intermediate state cannot be checked safely, keep the dependent edits in one change unit. A successful single wave, build, or commit is not completion of a broad program.

## Checkpoints and handoff

When pausing, record the base/current HEAD, worktree and cached diff, assigned paths, completed units and checks, incomplete units and dependencies, known failures, and next safe operation. Label it `全体プログラム未完了` until the selected scope has been re-audited.

On resume, re-check status, HEAD, diffs, paths, version, and other-agent changes before using the old plan. Do not silently continue from stale assumptions.

## External and Git boundary

Workers and sub-tasks do not commit, tag, push, publish, or mutate external Issues unless the parent task explicitly assigns that action. The repository `AGENTS.md` owns the Japanese commit and SemVer rules; this workflow only records when those checks belong in the final wave.
