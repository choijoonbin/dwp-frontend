# Widget Catalog Kill

- Owner: Platform Security on-call
- Scope: global or Definition/Version catalog discovery and runtime controls
- Safety rule: a kill can only reduce capability

## Enter when

- unauthorized Definition, metadata, data, or action is exposed;
- Registry mutation integrity, signing, Binding Catalog, or cross-tenant isolation is suspect;
- Quarantine propagation exceeds its SLO.

## Execute

1. Create an incident and choose the narrowest safe scope: catalog mutation, discovery, render, or action.
2. Append a `DISABLED` Runtime Control revision with DB-clock activation; never update an old row.
3. Commit Control, Safety revision, Audit, Registry Event, and Outbox atomically.
4. Purge positive evaluator/runtime caches by Safety revision and verify missing/stale state denies.
5. In Phase 1A verify would-deny without changing legacy runtime. In Authoritative mode verify actual render/data/action denial.

## Exit evidence

- All affected contexts return the closed public reason; unaffected tenants/definitions remain available.
- Cache, Outbox, consumer sequence, and kill-decision p99 evidence are attached to the incident.
- Re-enable requires a separate immutable approval, independent actor, current Evidence/Binding Gate, and new revision.
