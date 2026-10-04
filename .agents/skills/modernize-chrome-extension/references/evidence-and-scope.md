# Evidence and scope

## Evidence order

1. Follow [AGENTS.md](../../../../AGENTS.md) to inspect HEAD, normal/staged changes, package and manifest sources, build configuration, and the requested paths.
2. Trace the manifest, service worker, extension page, schema/database processing, browser file operations, generated output, tests, and current documentation.
3. Use `rg`, imports/exports, registrations, dynamic loading, manifest references, and build output to confirm actual connections.
4. Read history only as evidence about regressions or incomplete migrations. Current code and source-of-truth documents define the current contract.
5. Identify actual test assertions and their limits before deciding what needs additional verification.

## Scope map

For a broad request, trace every applicable surface:

| Surface | Minimum trace |
| --- | --- |
| Runtime | manifest, service worker, extension page, initialization, re-entry |
| Source boundaries | existing `Triadichrome-extension/src/core/` and `src/extension/` owners, Chrome/browser APIs, imports, adapters |
| SQLite documents | `triadicSchema.ts`, `triadicDatabase.ts`, format identity/version, schema validation, views, foreign keys, database lifetime, export |
| Files | `triadicFile.ts` and `ExtensionPage.tsx`, file selection/drop, bytes and handles, write/close/abort, cancellation, errors |
| UI state | actual owner, lifetime, navigation/reset, whether values are memory-only or written to a document |
| Build and distribution | Vite inputs, manifest generation, sql.js WebAssembly, generated references, source/output coexistence, product version |
| Regression and documents | normal/UI assertions, verify commands, README, AGENTS, linked references |

For each surface, attach relevant paths, contracts, owners, verification entry points, and findings. Do not infer unimplemented persistence or migration features from table names, UI controls, or old plans.

## Candidate states

- `confirmed`: the problem, impact, owner, protected contract, and verification are understood.
- `not-found`: current evidence does not show the alleged problem; do not change it.
- `insufficient-evidence`: investigation is still needed; do not delete or redesign the affected path.
- `out-of-scope`: excluded by the request or owned by an external system.

Record why an inspected surface needs no change. “Long”, “old”, or “duplicated” is an investigation prompt, not evidence of a defect. Each proposed unit needs an actual purpose, affected dependencies, compatibility condition, verification, and safe removal condition for replaced paths.
