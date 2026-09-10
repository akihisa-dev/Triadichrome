# Efficiency and pruning

Judge efficiency by the cost and risk of producing the same result, not by line or file count. Compare only the affected scenario and equivalent inputs.

- initialization, file reads/writes, CSV parsing, IndexedDB transactions, DOM work, render work, timers, listeners, observers, and subscriptions;
- cache creation/hit/miss/invalidation and work skipped for unchanged inputs;
- state owners, synchronization points, adapters, public entry points, compatibility branches, generated references, and documents to update;
- failure, cancellation, retry, replacement, and recovery cost.

After moving a consumer, scan old functions/classes, exports, event registration, subscriptions, manifest and Vite inputs, assets, tests, fixtures, and documentation. Keep a path only when a current consumer, public compatibility contract, generated source, or verification requires it. A temporary compatibility path needs an owner, reason, protected check, and removal condition. “Just in case” is not a retention reason.

Do not add instrumentation solely to claim an improvement and leave it in product code. Do not perform unrelated cleanup during a modernization wave.
