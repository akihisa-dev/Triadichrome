# Architecture contract

Read [AGENTS.md](../../../../AGENTS.md) for the authoritative source and generated-output boundaries. The paths below locate the current owners; re-read their implementation before planning a move.

## Source and runtime owners

| Responsibility | Current owner |
| --- | --- |
| File extension, format identity/version, schema tables and views | `Triadichrome-extension/src/core/triadicSchema.ts` |
| sql.js initialization, validation, database creation/open/export | `Triadichrome-extension/src/core/triadicDatabase.ts` |
| Writable stream, byte copying, close and abort | `Triadichrome-extension/src/extension/triadicFile.ts` |
| File picker/fallback input, drop, busy state, errors, page transition | `Triadichrome-extension/src/extension/ExtensionPage.tsx` |
| Manifest and distribution generation | `Triadichrome-extension/manifest.template.json`, `scripts/build.mjs`, `vite.config.ts` |

The core directory already exists. Keep `chrome.*`, file-picker calls, and raw browser handles out of schema/database processing. sql.js uses a bundled WebAssembly asset; preserve its local loading path and verify the generated reference if initialization or imports move. Service-worker code must remain independent from React page lifecycle and DOM globals.

## SQLite document contracts

- One `.triadic` file represents one plan as a standard SQLite database. Read the current schema and README; do not invent a second persistence format or make derived views a separate source of truth.
- Preserve extension and format identity, metadata version, `PRAGMA user_version`, required tables/views/columns, the single-plan constraint, and foreign-key validation. Package SemVer is independent from `TRIADIC_FORMAT_VERSION`.
- Current loading rejects unsupported or malformed documents; it does not imply a migration facility. A requested schema change needs an explicit compatibility decision, defined handling of older and newer files, and failure recovery before any migration is introduced.
- Keep database ownership clear: creation and validation close their temporary databases; callers of `openTriadicDatabase` own the returned database. Preserve cleanup on failures and foreign-key enforcement after export as implemented by `exportTriadicDatabase`.

## File and UI contracts

- Preserve the split between database bytes and browser file handles. Trace the picker, fallback input, drop, validation, and page transition before changing their owner.
- `writeTriadicFile` copies the supplied byte view, writes it, and treats successful `close()` as completion. Write or close failure attempts `abort()` and propagates the original failure even if abort also fails.
- A rejected `createWritable()` has no acquired stream to abort. On creation, wait for writing, rereading, and validation before entering the document. On opening an existing file, validate before changing the active document and do not write as part of validation. Restore the UI from its busy state after failure or cancellation.
- Read current UI state ownership and persistence behavior. An in-memory field is not automatically persisted just because a corresponding schema table exists. Do not add autosave, handle caching, locking, or permission flows unless required by the actual change.

## Moving a boundary

Do not move a module merely because it is large. Confirm imports, dynamic references, manifest/build inputs, asset loading, tests, and current consumers. After reconnecting an owner, scan old exports, listeners, subscriptions, references, and documentation before removing the replaced path.
