---
name: modernize-chrome-extension
description: Plan and execute a broad, evidence-based modernization across multiple boundaries of a TypeScript, React, Vite, Manifest V3 extension while preserving public contracts. Use for repository-wide or explicitly multi-boundary refactors, not single bugs, isolated UI changes, or release-only work.
---

# Modernize a Chrome extension

Use this skill only when the request spans multiple responsibilities such as source boundaries, service worker, independent extension page, IndexedDB/CSV/File System Access adapters, generated extension output, tests, and documentation. A single bug, new feature, isolated UI change, dependency-only update, or version/tag task belongs to a narrower workflow.

## Choose the mode

- **Full program:** the user asks for a whole-repository, broad, or comprehensive modernization. Map every relevant runtime, storage, build, generated-output, test, and document boundary before editing.
- **Limited program:** the user names a bounded area. Trace only the connected boundaries and record the explicit exclusions.
- **Evaluation only:** the user asks for audit, diagnosis, or planning. Do not edit, bump version, or commit.

Do not infer scope from the first easy file or from the number of changes. Read `AGENTS.md` first, then load only the references needed for the selected mode:

- [evidence and scope](references/evidence-and-scope.md)
- [architecture contract](references/architecture-contract.md)
- [large-change workflow](references/large-change-workflow.md)
- [compatibility and verification](references/compatibility-and-verification.md)
- [efficiency and pruning](references/efficiency-and-pruning.md)
- [routing evaluation](references/routing-evaluation.md)

## Non-negotiable boundaries

- Preserve the requested UI scope. If the user says no screen or design work, do not add visual UI while modernizing the build or runtime.
- Keep pure application logic separate from Chrome-specific adapters. Keep `chrome.*` and direct extension-page/service-worker concerns in `src/extension/`; keep future platform-neutral logic in `src/core/` when that boundary exists.
- Treat `public/manifest.json` as the editable manifest source and `dist/extension/` as generated output. Do not put generated JavaScript, bundles, or sample data in `src/`.
- Preserve MV3 entry points, the independent extension page, service worker behavior, storage contracts, CSV semantics, File System Access safety, permissions, and version consistency unless the user explicitly changes them.
- Do not load an unpacked extension, operate a real site, capture screenshots, push, publish, or change external state unless explicitly requested.

## Evidence and completion

Map the current HEAD, worktree, manifest, service worker, extension page, source imports, storage and I/O owners, generated references, tests, build scripts, and documents. Classify candidates as `confirmed`, `not-found`, `insufficient-evidence`, or `out-of-scope`. Do not delete an old path while its consumer, public contract, or generated reference is uncertain.

Split independent purposes into verifiable change units. After each unit or wave, re-scan its consumers, registrations, subscriptions, manifest/build references, tests, and source-of-truth documents. Do not call a broad modernization complete until the selected scope has no unresolved `confirmed` or `insufficient-evidence` item and the final diff, generated output, version, and Git state have been checked.
