# Widget Command Reconciliation

- Owners: Provider Control and Platform Registry on-call
- Scope: Provider Receipt, Platform Receipt Gate, Completion Ledger, Target, Event, and Outbox

## Invariants

- Permanent `SEALED Gate ↔ Ledger` is one-to-one; an existing completed Receipt must match it.
- `IN_PROGRESS` can coexist only with an `OPEN` Gate and no Ledger.
- Reconciliation reads or seals stored completion; it never re-executes the Registry target.

## Execute

1. Claim expired leases with `FOR UPDATE SKIP LOCKED` and a fencing token; abandon writes after losing the fence.
2. Read completion with current reconcile trust and exact command/fingerprint/actor-hash/operation/target binding.
3. If no completion exists and original artifacts are past `exp+30s`, call only `seal-not-executed`.
4. Platform verifies the original Identity/Provider signatures with durable `VERIFY_ONLY` keys, then locks Gate first.
5. Seal `NOT_EXECUTED` only when Gate is open and Target/Event/Ledger are absent. Otherwise page integrity failure.
6. Store the Platform response in Provider Receipt/Audit/Outbox atomically; never synthesize a public response.

## Exit evidence

- Backlog and oldest age are below thresholds, stale fences wrote nothing, Receipt-TTL replay returns Ledger bytes,
  and Gate/Ledger counts and hashes match. Key retirement remains blocked until unsealed count is zero.
