# Compatibility and verification

## Verification by surface

| Surface | Minimum confirmation |
| --- | --- |
| Manifest and generated output | JSON validity, MV3 fields, service-worker/page references, generated asset existence, no source/test leakage, version consistency |
| Core and extension boundary | no unintended `chrome.*` import into core, dependency direction, entry syntax |
| Persistence and CSV | existing keys/columns, defaults, read/write/update/remove, malformed input, conflicts, failure and recovery |
| File System Access | permission denial, abort, lock conflict, replacement failure, retry, handle invalidation |
| Async lifecycle | stale completion, cancellation, retry, re-entry, shutdown, duplicate notification |
| Extension page | relative asset paths, React bootstrap, blank/no-UI contract when requested |
| Documents and diff | README/AGENTS links, generated output, `git diff --check`, status |

## Current npm checks

Use only scripts that exist in the root `package.json`. The current baseline commands are:

- `npm run typecheck`
- `npm run build`
- `node --check dist/extension/background.js` after a successful build

Run targeted checks immediately after a related change. Before a requested commit, run the appropriate complete set once and reuse a successful result for the same HEAD and environment. Do not claim that a typecheck/build proves real Chrome loading, target-site behavior, performance, or OS-specific packaging.

## Completion

The selected change is complete only when the affected contract and failure paths are covered, generated output and source references agree, no unresolved `confirmed` or `insufficient-evidence` item remains in scope, and the final diff/status/version are inspected. Report any unrequested real-browser, external, OS, or performance checks as not run.
