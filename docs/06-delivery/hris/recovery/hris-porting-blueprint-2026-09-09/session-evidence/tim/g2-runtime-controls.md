# HRIS-TIM runtime controls

Status: `CODE_READY_PROPOSAL` validated by central `OPEN_G3_CODE` for provider-neutral core; production activation remains `G6_NOT_AUTHORIZED`.

## Aggregate state machines

| Aggregate | Legal transitions | Terminal/frozen behavior |
|---|---|---|
| Work rule / leave plan version | `DRAFT → VALIDATED → APPROVED → PUBLISHED → RETIRED`; validation failure returns to `DRAFT` by a new revision | published revision never mutates; replacement is a new version |
| Clock stream | `NONE → RECORDED`; correction posts `VOID` referencing the original | raw event update/delete forbidden |
| Interpretation run | `QUEUED → RUNNING → SUCCEEDED | FAILED | RESULT_UNKNOWN → SUPERSEDED` | every retry is a new numbered attempt; successful output remains immutable |
| Timecard | `OPEN → SUBMITTED → APPROVED | REJECTED → LOCKED`; rejected returns through an explicit correction command | `LOCKED` accepts only reopen/correction workflow |
| Work/leave request | `DRAFT → SUBMITTED → APPROVED | REJECTED | CANCELLED`; approved cancellation posts reversal | decision/evidence history is append-only |
| Close period | `OPEN → VALIDATING → CLOSING → CLOSED → REOPEN_REQUESTED → REOPENED → VALIDATING → CLOSED` | closed ledger revision cannot change in place |
| Payroll handoff | `PENDING → SENT → ACKNOWLEDGED | REJECTED | RESULT_UNKNOWN → SUPERSEDED` | payload digest and close revision never change |

Every state handler rejects an unlisted transition with `409 INVALID_STATE_TRANSITION`. State is evaluated inside the same transaction as the CAS and outbox write.

## Command guard order

1. Authenticate and derive tenant/actor; ignore tenant or actor in payload.
2. Validate app entitlement, atomic action and module/pack installation.
3. Resolve purpose and field policy; reject unknown purpose.
4. Resolve current worker/time-group/period population from owner facts and record the policy revision.
5. Load aggregate by `(tenant_id, public_id)`; out-of-scope and absent both return opaque 404.
6. Compare `expectedVersion`/`If-Match`; reject stale command before domain side effects.
7. Evaluate object state, closed-period lock, effective date, overlap, self-approval and SoD.
8. Validate schema, timezone/offset, quantities, policy/rule and country/connector activation.
9. Reserve idempotency receipt by `(tenant, command type, key)` and compare request digest.
10. Apply domain transition, append facts/audit/outbox and update receipt atomically.

An existing key with a different request digest returns `409 IDEMPOTENCY_KEY_REUSED`. An existing matching key returns the original receipt/result and never re-executes the command.

## CAS contract

Mutable command aggregates use the equivalent of:

```sql
UPDATE aggregate
SET status = :next_status, row_version = row_version + 1, updated_at = now()
WHERE tenant_id = :tenant_id
  AND public_id = :public_id
  AND row_version = :expected_version
  AND status IN (:allowed_source_states);
```

Exactly one updated row is required. Zero rows triggers opaque not-found or `409 STALE_OR_INVALID_STATE` after a scope-safe recheck. Ledger/event rows never use CAS update because they are append-only.

## Idempotency and durable receipts

- Scope: `(tenant_id, command_type, Idempotency-Key)`.
- Digest: canonical schema version + normalized body + target public IDs; excludes bearer token and volatile trace headers.
- Reservation and domain write occur in one transaction for synchronous commands.
- Long jobs persist `ACCEPTED`, acquire a renewable lease and create numbered attempts.
- The HTTP result may be 202 while receipt status is `RUNNING` or `RESULT_UNKNOWN`.
- Client recovery is receipt lookup with exponential backoff and server `Retry-After`, never blind resubmission with a new key.
- Outbox and receipt use the same correlation ID; consumers deduplicate `(tenant_id, event_id)`.
- Receipt creation seals `originating_action`, `subject_principal_public_id`, `population_scope_digest`, `field_policy_revision`, `purpose_code` and `authorization_revision`; those values cannot be caller-overridden later.
- `GET /v1/command-receipts/{receiptId}` re-evaluates the current HRIS entitlement and the exact originating action, subject, population, field and purpose context. The more restrictive of the originating and current policy wins; revocation is immediate and cross-tenant/out-of-scope identifiers return opaque `404`.

## Ledger and replay rules

- Clock, interpreted segment, time ledger and entitlement ledger are never updated/deleted.
- Wrong raw clock: append a `VOID` event, rebuild a new interpretation attempt, and post reversals/new entries.
- Leave cancellation: post `RELEASE` or `REVERSE`; never decrement a balance column directly.
- Time/leave projections carry `ledgerRevision` and are rebuildable. Rebuild compares digest and raises a blocking reconciliation issue on difference.

## Clock instant and DST evidence

`ClockCommand.v1` and `tme_clock_events` preserve the source instant and the exact civil-time evidence used to derive it: `occurredAt`, `sourceLocalDateTime`, IANA `timeZone`, `sourceUtcOffsetMinutes`, `dstResolution`, `instantAuthority`, `tzdbVersion`, `timeZoneRuleVersion`, and `sourceProvenanceDigest`. Canonical recorded event types are `IN`, `OUT`, `BREAK_START`, `BREAK_END`; `VOID` and `OTHER` are owner-created corrective/import facts, not aliases accepted by the normal clock endpoint. Canonical sources are `WEB`, `MOBILE`, `KIOSK`, `DEVICE`, `IMPORT`, `API` in transport, domain and storage. A DST overlap requires the selected earlier/later offset; a gap requires an explicit approved shift-forward policy. Inconsistent instant/local/offset evidence or a provenance digest mismatch is rejected, never silently recalculated with the server's current tzdb.
- Rule/input snapshots are content-addressed. Same input/rule digest must produce the same output digest.
- All time facts store canonical instant plus original local datetime, zone and UTC offset.

## Close and Payroll handoff

Close validation captures blocking exceptions, unapproved cards/requests, projection gaps, rule versions and ledger revision. Close uses a period-scoped advisory/lease lock and maker/checker separation. Reopen requires reason, step-up, separate approver and produces a new close revision; the old close event remains valid historical evidence.

Close creates an immutable `ClosedTimeResult.v1` header, pay-code lines, and the exact ledger-entry membership used by every line. The result binds the close revision, ledger revision range, worker/line counts, source/rule/payload digests, and supersession lineage. Reopen or correction creates a new close/result revision and never mutates the prior snapshot. A handoff references exactly one closed result. Payroll must return an accepted/rejected receipt for that result and digest. A timeout produces `RESULT_UNKNOWN`; a reconciliation worker queries by idempotency key/provider reference.

## Batch and connector recovery

- Job definitions are signed code manifests with JSON-schema parameters. Tenant configuration can enable/schedule a known job key but cannot select a class/method.
- One active lease per tenant/job/scope; fencing token prevents a late worker committing after lease loss.
- Retry only typed transient errors; permanent schema/auth/domain errors go to quarantine/DLQ.
- Replay preserves source event key and idempotency. Operator actions require reason, capability and audit.
- Connector credentials/endpoints live in DWP Integration. Time receives an opaque connection ref.
- Disabled/uninstalled connector returns a typed fail-closed error; it does not switch to an in-memory or fake-success path.

## Privacy, retention and audit

Audit records actor/service principal, purpose, effective permission/policy revisions, target public ID, action, before/after digest, result, correlation and step-up session. It excludes raw medical evidence, free-text leave reason, token and device secret. Export is asynchronous, purpose-bound, expiry-limited and separately audited.

Retention policy classes include raw clock, time ledger, leave ledger, request/evidence, connector receipt and security audit. Tenant selection is bounded by jurisdictional minimum/maximum policy. Legal hold prevents purge. Projection rows may be rebuilt/purged independently from immutable facts.

## Observability and operational proof

Required metrics: command/receipt latency, idempotency hit/conflict, projection lag/gap, interpretation duration/failure, open blocking exceptions, close duration/CAS conflict, handoff unknown/reject age, connector/DLQ depth and ledger reconciliation difference. Logs use public IDs/digests, never sensitive values. Alerts link to governed support views and runbooks.

Core code readiness uses synthetic load/golden cases. Actual clock vendor schemas, production volumes, retention values, official KR evidence and named operations owners are connector/country/production activation gates.
