# Tenant Widget Policy Rollback

- Owner: Tenant Experience on-call
- Scope: one tenant and one Widget Definition

## Preconditions

- Source revision belongs to the current tenant/definition and its immutable snapshot is readable.
- Current catalog, Binding, Safety, audience authority, and expected Head revisions are available.

## Execute

1. Run the read-only impact calculation and record only aggregates and opaque revisions.
2. Lock the tenant policy Head and reject any stale impact or expected version.
3. Copy the source snapshot into a new `PUBLISHED` revision with a new reason and predecessor.
4. Mark the prior Head superseded through the new immutable revision chain; never update historical payloads.
5. Commit Audit, `TENANT_WIDGET_POLICY_ROLLED_BACK`, Outbox, and Head swap in one transaction.

## Exit evidence

- Only the selected tenant changes; other tenants and user layouts/configuration are byte-preserved.
- Explain returns the new policy revision and current authority/binding/safety tuple without raw membership data.
