# Evidence and scope

## Evidence order

1. Confirm HEAD, worktree status, normal and cached diffs, `package.json`, `Triadichrome-extension/manifest.template.json`, `vite.config.ts`, `tsconfig.json`, and the requested paths.
2. Trace the MV3 manifest, service worker, independent extension page, source imports, storage, CSV parsing, File System Access adapters, generated output, tests, and documents.
3. Use `rg`, imports/exports, event registration, dynamic loading, manifest references, and build output to confirm actual connections.
4. Read history only as evidence about regressions or incomplete migrations. Current source and current documents define the current contract.
5. Identify what existing tests and checks detect and what they do not detect.

## Scope map

For a broad request, enumerate every applicable surface:

| Surface | Minimum trace |
| --- | --- |
| Runtime | manifest, service worker, extension page, initialization, re-entry |
| Boundaries | `Triadichrome-extension/src/core/`, `Triadichrome-extension/src/extension/`, Chrome APIs, browser APIs, adapters |
| State and persistence | owner, keys, defaults, read/write/reset, conflicts, recovery |
| CSV and files | parser, validation, File System Access handles, lock/replace behavior |
| Build and distribution | Vite inputs, manifest generation, generated assets, `Triadichrome-extension/`, version |
| Regression and documents | tests, typecheck, build, README, AGENTS, linked references |

Attach implementation paths, protected contracts, owners, verification entry points, and a candidate state to each surface. A surface with no change still needs a `not-found` reason.

## Candidate states

- `confirmed`: the problem, path, impact, owner, protected contract, and verification are understood.
- `not-found`: the current HEAD does not show the alleged problem; do not change it.
- `insufficient-evidence`: more investigation is needed; do not delete or redesign the affected path.
- `out-of-scope`: explicitly excluded by the user or owned by an external system.

“Long”, “old”, or “duplicated” is an investigation prompt, not evidence for a refactor. A change unit needs a purpose, non-purpose, affected path, dependencies, compatibility contract, verification, and a safe removal condition for replaced paths.
