# Efficiency and pruning

Judge efficiency by the cost and risk of producing the same result, not by line or file count. Compare only the affected scenario and equivalent inputs.

- sql.js/WebAssembly initialization, database opens/closes, validation queries, exports, byte-array copies, file reads/writes, DOM/render work, timers, listeners, and subscriptions;
- cache lifetime and invalidation, including whether cached bytes or a database become stale after editing or opening another file;
- ownership of database connections, UI state, file handles, public entry points, generated references, and documents;
- cancellation, write/close/abort failures, retry, cleanup, and recovery cost.

An optimization must preserve format validation and foreign-key enforcement, correct exported bytes, error propagation, and resource cleanup. Do not skip validation, retain a database indefinitely, or duplicate persisted state merely to reduce work on a successful path.

After moving a consumer, scan old functions/classes, exports, event registration, manifest/Vite inputs, assets, tests, fixtures, and documentation. Keep a path only for a current consumer, compatibility contract, generated reference, or required check. A temporary compatibility path needs a reason, protected check, and removal condition.

Do not leave measurement-only instrumentation in product code or perform unrelated cleanup during the requested change.
