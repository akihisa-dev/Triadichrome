---
name: modernize-chrome-extension
description: Plan and execute broad, evidence-based modernization across Triadichrome's TypeScript/React, Manifest V3, .triadic SQLite storage, file I/O, and build boundaries while preserving existing behavior. Use for repository-wide or explicitly multi-boundary refactors, not single bugs, isolated UI changes, or release-only work.
---

# Modernize a Chrome extension

Use this skill when one requested outcome spans several responsibilities: source boundaries, service worker, extension page, `.triadic` database processing, file I/O, generated output, tests, or documentation. Do not turn a local change into a whole-repository program.

Read [AGENTS.md](../../../AGENTS.md) for scope, authorization, source boundaries, verification, and commit/version policy. Use [README](../../../README.md) for current product behavior and commands. This skill supplies modernization procedures without redefining those policies.

## Choose the mode and references

- **Full program:** map every relevant runtime, storage, build, generated-output, test, and document boundary for a whole-repository request.
- **Limited program:** trace the named area and its connected boundaries; preserve explicit exclusions.
- **Evaluation only:** investigate or plan without editing, changing versions, or committing.

Choose the mode from the user's requested outcome, not from the first easy file or change count. Load references only as needed:

- [Evidence and scope](references/evidence-and-scope.md): build the current dependency and ownership map.
- [Architecture contract](references/architecture-contract.md): change source boundaries, database processing, or file ownership.
- [Large-change workflow](references/large-change-workflow.md): order dependent changes and resume incomplete work.
- [Compatibility and verification](references/compatibility-and-verification.md): select checks for changed behavior and failure paths.
- [Efficiency and pruning](references/efficiency-and-pruning.md): assess cost and remove replaced paths.
- [Routing evaluation](references/routing-evaluation.md): resolve whether a request belongs to this workflow.

## Preserve the actual contracts

- The existing `src/core/` owns Chrome-independent schema/database processing; `src/extension/` owns UI, Chrome entry points, and browser file operations. Verify current callers before moving either boundary.
- `.triadic` is the SQLite document format, processed with sql.js. Preserve accepted files, schema validation, and write/cancel/failure behavior. Do not add a different storage system or migration merely to modernize the code.
- Product version and document-format version have different purposes. A package version bump alone does not change the document-format version.
- Source and generated files coexist under `Triadichrome-extension/`. Rebuild through the existing pipeline and never clear authored source when replacing generated output.
- Preserve the requested UI scope and the current page/service-worker behavior. Required automated UI tests, including their generated images, follow AGENTS.md; real-site operations, real-file writes, and publication retain its explicit authorization boundaries.

## Evidence and completion

Map current HEAD, worktree, source imports, data and I/O owners, manifest/build references, tests, and documents. Use the candidate states in the evidence reference and do not remove a path while its consumer or compatibility contract is uncertain.

After each independent change unit, re-scan affected callers, registrations, subscriptions, generated references, and documentation. Completion requires all in-scope confirmed problems to be addressed, unresolved evidence that affects the result to be resolved, and the final diff, generated output, versions, and Git state to be checked. Report any remaining work or unverified behavior explicitly.
