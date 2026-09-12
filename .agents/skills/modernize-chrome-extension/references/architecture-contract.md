# Architecture contract

## Source and generated boundaries

- `Triadichrome-extension/src/` contains authored TypeScript, React, and extension source.
- `Triadichrome-extension/src/core/` is reserved for platform-neutral logic when that boundary is introduced; it must not import `chrome.*`.
- `Triadichrome-extension/src/extension/` owns the Manifest V3 service worker, independent extension page entry, Chrome adapters, and direct browser-extension lifecycle code.
- `Triadichrome-extension/manifest.template.json` is the editable manifest source.
- `Triadichrome-extension/` is the only Chrome load/distribution directory after build. Its `manifest.json`, page, assets, and generated JavaScript coexist with authored `manifest.template.json` and `Triadichrome-extension/src/`; do not clear the authored source while building.

## Runtime contracts

- Keep the manifest's service-worker path, extension-page entry, permissions, host permissions, and relative asset references internally consistent.
- Keep React page code independent from service-worker lifecycle code. The service worker must remain valid under MV3 and must not depend on DOM globals.
- Put Dexie schema/transaction ownership behind a named persistence boundary. Keep PapaParse conversion separate from UI state and preserve malformed-row/error semantics once they are defined.
- Put File System Access API calls behind an adapter that owns handle permission checks, file replacement, lock coordination, and abort/error behavior. Do not spread raw handles through unrelated components.
- Keep public names, storage keys, CSV columns, file names, and manifest loading order stable unless the user explicitly approves a compatibility change.

## Change boundary

Do not move or split an entry merely because the file is large. Confirm its consumers, dynamic references, manifest references, generated output, and tests first. When a consumer moves to a new owner, re-scan the old export, registration, listener, subscription, asset, and document references before removing anything.
