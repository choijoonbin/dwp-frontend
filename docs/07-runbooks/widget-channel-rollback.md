# Widget Channel Rollback

- Owner: Provider Release on-call
- Scope: one Definition and `STABLE` or `PREVIEW` channel

## Preconditions

- The requested restore Version belongs to the Definition and is immutable `APPROVED/PUBLISHED/CLEAR`.
- Current Risk/Evidence Gate and full Binding Catalog/head Gate pass at execution time.
- The public request, path channel, deterministic channel target, expected head, and idempotency key are bound.

## Execute

1. Preview affected tenant policy and instance counts without returning subject lists.
2. Lock the channel head and target Version, then recompute every Gate and expected version.
3. Append a new channel revision pointing to the requested restore Version and preserve the old head as previous.
4. Commit Audit, `WIDGET_CHANNEL_ROLLED_BACK`, Outbox, Receipt Gate, and Completion Ledger atomically.
5. Verify channel read, Effective evaluation, renderer compatibility, and consumer aggregate sequence.

## Abort

- On any stale revision or Gate change, return the closed 409/422 response and leave channel/Version rows unchanged.
- Never edit or republish the historical Version to simulate rollback.
