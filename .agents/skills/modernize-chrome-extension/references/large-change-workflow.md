# Large-change workflow

## Before editing

State the requested surfaces, exclusions, current evidence, dependency order, and completion condition briefly. Establish a baseline from HEAD, worktree and staged changes, Node/npm versions, current generated output, and valid verification results. Select any missing checks through [AGENTS.md](../../../../AGENTS.md#検証と完了条件) and the [verification reference](compatibility-and-verification.md).

Separate pre-existing failures, environment failures, and regressions from the proposed change. Protect unrelated staged work, including version files; do not incorporate it into the modernization commit.

## Order dependent changes

Adapt the sequence to the actual dependency graph:

1. Identify the compatibility contract and affected consumers.
2. Add meaningful regression checks for behavior that is moving or lacks necessary coverage.
3. Separate schema/database processing from browser and UI ownership without changing accepted `.triadic` files.
4. Move state ownership, database lifetime, asynchronous cancellation, and error handling as needed.
5. Reconnect the service worker, page, database-byte/file-handle boundary, and existing UI consumers.
6. Remove a replaced path only after callers, manifest/build references, tests, and documents have migrated.
7. Update source-of-truth documentation, apply the version/commit rules, and review the complete requested result.

Keep each independent purpose verifiable. Keep dependent edits together when an intermediate state cannot be checked safely. One successful unit, build, or commit does not prove that the whole request is complete.

## Resume or hand off

When work is interrupted or handed off, record HEAD, worktree/staged state, affected paths, completed checks, remaining work, dependencies, and the next safe action in the handoff message. Do not accumulate a work log in project documentation.

On resume, recheck HEAD, status, relevant diffs, versions, and changed paths before relying on earlier evidence. Proceed with safely separable work; report only the overlapping portion that cannot be completed safely.

## Git and external actions

[AGENTS.md](../../../../AGENTS.md) owns commit timing, SemVer, and authorization for push, tags, releases, and Issue changes. If delegated work is explicitly authorized, its assignment must state any Git or external actions it owns; ordinary subtask completion does not grant that authority.
