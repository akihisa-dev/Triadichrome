# Compatibility and verification

## Select existing checks

Use [AGENTS.md](../../../../AGENTS.md#検証と完了条件) for verification requirements and [README](../../../../README.md#検証とgitフック) for command contents. Confirm scripts in the current root `package.json` before running them.

Choose `npm run verify` or `npm run verify:full` according to the changed surfaces. Both include the build's typecheck, generated-output checks, normal tests, and version consistency; the full command also runs existing UI tests. Reuse successful checks for the same state and environment instead of running overlapping suites repeatedly. Use `npm run verify:release` only when the requested work calls for release verification.

Current normal-test entry points include `scripts/test-files.mjs` for database/file behavior and `tests/repository-workflow.test.mjs` for Git/version safeguards. UI checks live under `tests/ui/`, use memory-backed file operations, and include comparison with built output. Inspect actual assertions before treating a case below as covered; this table is a selection guide, not a claim of existing coverage.

## Verification by affected surface

| Surface | Conditions to protect when that surface changes |
| --- | --- |
| Manifest and distribution | MV3 fields, service-worker/page references, local WebAssembly and other asset paths, no source/test leakage into generated assets, version consistency |
| Core/extension boundary | database code does not acquire Chrome/file handles; moved exports, runtime imports, and initialization still resolve |
| File-format validation | valid existing documents still open; malformed bytes, wrong identity/version, missing tables/views/columns, invalid plan count, and foreign-key violations remain rejected |
| Schema or requested migration | metadata and `user_version` agree; supported files retain records, constraints, and derived results; unsupported files are rejected without overwrite; migration failure preserves the original document |
| Database lifecycle | temporary databases close on success/failure; opened databases have an explicit owner; foreign-key enforcement remains enabled after export |
| File write lifecycle | exact byte view is written; acquisition, write, and close failures propagate; write/close failure attempts abort; abort failure does not hide the original error |
| UI and async state | picker cancellation, invalid-file rejection, retries, busy-state cleanup, stale/repeated actions, memory-only state, page navigation, and generated-output parity remain consistent |
| Documents and diff | referenced paths and commands exist; source/generated versions agree; diff checks and final status are clean of unintended changes |

For storage changes, use disposable fixtures representing accepted and rejected documents. Preserve the bytes and contents needed to compare before and after a failed operation. Do not use the user's working files as test fixtures or introduce migrations as part of a behavior-preserving refactor.

## Limits and completion

Mocked streams can prove error propagation and abort calls; memory-backed UI tests can prove visible state and interaction. They do not prove filesystem durability, real picker permissions, disk-full recovery, concurrent-writer behavior, extension icon launch, or service-worker lifecycle. Perform real-file/site checks only within the authorization in AGENTS.md and report remaining limits precisely.

A browser startup failure is a failed UI check, not a skipped success. Do not weaken assertions to conceal a regression. Completion requires the affected contracts and failure paths to be verified at the appropriate boundary, with unresolved cases reported rather than implied to be covered by typecheck or build alone.
