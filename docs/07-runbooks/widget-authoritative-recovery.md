# Widget Authoritative Recovery

- Owner: Platform Control Plane on-call
- Scope: Authoritative Effective Catalog and Runtime Guard
- Safety rule: Authoritative failure never falls back to the static allow catalog

## Enter when

- Registry, Tenant Policy, Binding, Safety, authority snapshot, cache isolation, or Runtime Guard is unavailable or inconsistent.

## Execute

1. Open an incident and disable the narrowest runtime scope needed to stop discovery/render/data/action exposure.
2. Keep fail-closed responses active. Do not switch to legacy Static as an authorization source.
3. Restore the failed authority store and verify tenant predicates, revisions, signatures, and replay stores.
4. Purge positive caches and warm only with current tenant/subject/authority/safety/binding revision keys.
5. Run cross-tenant, revoked, quarantined, permission, and data/action negative probes before reducing the kill scope.
6. Re-enable through independent approval and a new immutable Runtime Control revision.

## Exit evidence

- Negative probes deny, allowed probes use current-user data, Outbox sequences have no gap, and no static fallback occurred.
- Kill/recovery decision delays meet SLO and a post-incident Bootstrap/Shadow window is required before ring expansion.
