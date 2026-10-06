# HRIS-HRM state, guard, idempotency, and recovery contract

- Status: `READY_FOR_G3_CODE`
- Scope: HRM command behavior in `dwp-people-server`
- Rule: a UI state never authorizes a transition. The service loads the aggregate, evaluates owner PEP and guards, writes business state, audit, receipt and outbox atomically, and returns the durable receipt.

## 1. State machines

### 1.1 Assignment event

```text
DRAFT ──validate──> VALIDATED ──submit──> PENDING_APPROVAL
  │                    │                         │
  └──cancel────────────┴──cancel                 ├──approve──> APPROVED ──publish──> PUBLISHED
                                                 ├──reject───> REJECTED
                                                 └──cancel───> CANCELLED
```

- `PUBLISHED`, `REJECTED`, and `CANCELLED` are terminal.
- A correction is a new `CORRECTION` event referencing the published event; it never edits the original.
- Validation records an impact snapshot and its hash. Submit and publish fail if referenced aggregate versions no longer match.

### 1.2 Employee change request

```text
DRAFT -> SUBMITTED -> IN_REVIEW -> APPROVED -> APPLYING -> APPLIED
   |         |             |           |            └──────> APPLY_FAILED -> APPLYING
   |         |             └──────────> REJECTED
   └─────────┴────────────────────────> CANCELLED
```

- Only the requester may edit a draft; edit replaces encrypted patch content and increments version.
- Submitted content and evidence are frozen. A changed request is a new superseding draft.
- An Approval callback is inbox-idempotent by decision event ID.
- `APPROVED` means permission to attempt the domain command, not guaranteed application. Apply repeats current-version/effective-date validation.
- `APPLIED`, `REJECTED`, and `CANCELLED` are terminal. A business correction is a new linked request.

### 1.3 Employment contract

```text
DRAFT -> ISSUED -> SIGNED -> ACTIVE -> EXPIRED
                |          |      └-> SUPERSEDED
                |          └--------> REVOKED
                └---------------> DECLINED
```

- Issue freezes template ID/version, generation-input snapshot, object reference and SHA-256.
- A new issue is required after template/input change; rendered bytes cannot be overwritten.
- Signature service callbacks are inbox-idempotent.
- `DECLINED`, `SUPERSEDED`, `EXPIRED`, and `REVOKED` are terminal. Active content remains immutable while lifecycle status may advance.

### 1.4 Certificate

```text
REQUESTED -> VALIDATING -> ISSUED -> EXPIRED
       |          └-----> FAILED     └-> REVOKED (before expiry)
       └---------------> CANCELLED
```

- Issue freezes subject snapshot, purpose, locale, template/seal version, object reference and digest.
- Revocation preserves issue evidence but invalidates verification and download.
- A failed generation is retryable only if the receipt classifies the error as retryable; a new byte stream must never replace an already issued object.

### 1.5 Separation case and task

```text
DRAFT -> PLANNED -> PENDING_APPROVAL -> APPROVED -> IN_PROGRESS -> COMPLETED
   |        |               |              |             └-----> CANCELLED (only before irreversible task)
   └────────┴───────────────> CANCELLED     └------------> CANCELLED
```

- Planning snapshots open assignments and required TIM/PAY/Identity/asset/document handoffs.
- Completion requires every mandatory task `COMPLETED` or explicitly `WAIVED` by an authorized approver with reason.
- After an irreversible downstream receipt, cancellation becomes a new reversal/return/rehire case.

### 1.6 Versioned configuration consumed by HRM

```text
DRAFT -> VALIDATED -> PENDING_APPROVAL -> PUBLISHED -> SUPERSEDED
   |          |                └-------> REJECTED
   └----------┴------------------------> RETIRED (only before publication)
```

- Product/system invariants cannot be relaxed by tenant configuration.
- Published versions are immutable and apply by tenant, scope, priority, effective period and deterministic conflict rule.
- Author cannot approve/publish the same version.

## 2. Guard order

Every command uses this fail-closed order. Failure in an earlier guard prevents lower layers and all business writes.

1. Authenticate user/service and establish tenant from trusted context.
2. Validate request schema, size, media type and canonicalization version.
3. Reserve or read `(tenant, on-behalf-of subject, originating action, idempotency key)` receipt. The tuple, canonical request hash, actor, authorization/population/field-policy revisions, purpose and correlation are immutable; receipt deletion is forbidden.
4. Compare canonical request hash; reject key reuse with a different payload.
5. Require canonical `APP.HCM:VIEW` or accepted `APP.HRIS:VIEW` alias resolution.
6. Evaluate exact atomic capability/action and deny precedence.
7. Evaluate target population from live/effective relationship; do not trust client organization/manager fields.
8. Evaluate field groups, purpose, field operation, export control and masking.
9. Verify effective grant, step-up freshness, delegation and SoD.
10. Load aggregate in tenant scope and compare `If-Match` expected version.
11. Validate current lifecycle state and allowed transition.
12. Validate half-open effective ranges and cross-aggregate temporal containment.
13. Validate referenced organization/job/grade/position/location/config versions as of the effective date.
14. Validate approval/impact snapshot version and maker/checker rules.
15. Execute aggregate mutation, audit, receipt update and semantic outbox append in one transaction.

Queries perform guards 1, 2, 5–8 before repository access. Search/sort/aggregate fields are authorized independently of returned fields. A target outside population or tenant returns non-disclosing 404 unless an audit duty explicitly permits existence disclosure.

## 3. Command-specific guards

| Command | Required source state | Critical guards | Terminal evidence |
|---|---|---|---|
| Create person/worker | none | duplicate candidate, identifier hash, legal employer effective, worker-number uniqueness | aggregate versions + `WorkerHired` event |
| Validate assignment event | DRAFT | relationship period, reference periods, primary overlap, manager cycle, downstream impact | impact snapshot/hash |
| Publish assignment event | APPROVED | maker ≠ publisher, fresh step-up, expected versions unchanged, approval binding | immutable event + assignment slice + audit/outbox |
| Submit employee change | DRAFT | patch schema published, writable fields, evidence clean, target population | Approval case ref + frozen patch hash |
| Apply employee change | APPROVED | target expected version, current field permission, effective overlap, approval revision | request APPLIED + target version + event |
| Issue contract | DRAFT | template published/effective, relationship date, field purpose, object digest | issued immutable snapshot |
| Issue/revoke certificate | VALIDATING/ISSUED | subject/purpose, template/seal, download policy, revocation reason | issue/revoke audit and object digest |
| Complete separation | IN_PROGRESS | mandatory tasks, downstream receipts, effective termination event | case completion + `WorkerSeparated` event |
| Bulk import/apply | validated run | per-item permission/version/schema; all-or-item atomicity declared | run receipt + per-item results + reconciliation |

## 4. Idempotency protocol

### Key scope and request hash

- Scope is `(tenant_id, command_type, Idempotency-Key)`; a key is not global across command types.
- The request hash covers canonical method/path, target public ID, relevant headers, schema version and normalized body. It excludes transport timestamps and authorization tokens.
- The service inserts `RECEIVED` before domain work. Concurrent inserts on the same key serialize through the unique constraint.
- Same key/same hash returns the original receipt and never reruns a successful/terminal rejected command.
- Same key/different hash returns `409 IDEMPOTENCY_KEY_REUSED`.
- Keys and receipts are retained at least through the longest client retry, asynchronous execution and audit investigation window; the exact production duration is a versioned policy.

### Receipt outcomes

| State | Client action |
|---|---|
| `RECEIVED/VALIDATING/RUNNING` | poll receipt using backoff or consume authorized completion notification |
| `SUCCEEDED` | follow result/target link if still authorized |
| `REJECTED` | do not retry unchanged request; correct input or authority |
| `FAILED_RETRYABLE` | retry same key; worker claims by lease |
| `DEAD` | operator investigates redacted reason and may create an authorized replay receipt |
| `CANCELLED` | create a new key for a new business intent |

No endpoint returns success before its durable effect/receipt exists. A network timeout after commit is “result unknown,” not failure; the caller retrieves the receipt by key/correlation.

## 5. Transaction and event delivery

- The owner transaction includes aggregate rows, version, command receipt, access/business audit pointer, and `sys_people_outbox_events` append.
- Event ID and aggregate version are unique. Publishing workers use lease, bounded exponential backoff, retry classification and dead-letter state.
- At-least-once delivery is expected. Consumers record `(tenant, consumer, event_id)` in an inbox before applying projection changes.
- Events for one aggregate partition by `tenant:aggregatePublicId`; a consumer quarantines a version gap or unsupported major schema and requests snapshot recovery.
- Payloads contain public IDs and minimum changed facts. Clear personal identifiers, bank accounts, document bytes, access tokens and secrets are forbidden.
- Outbox publication failure never rolls back an already committed domain transaction; it keeps the receipt recoverable and alerts the operator.

## 6. Batch and bulk recovery

HRM jobs are registered in the central DWP automation catalog but run in the owner service. A job manifest declares stable type/version, input JSON schema, capability, maximum concurrency, lease duration, retry class, cancellation point, output receipt schema and redacted telemetry.

Bulk commands must declare one of:

- `ITEM_ATOMIC`: each row commits independently with per-item idempotency and result; the batch summary can be partial.
- `GROUP_ATOMIC`: a declared business group commits together; failure rejects that group only.
- `ALL_ATOMIC`: used only when bounded size and lock/rollback evidence prove safety.

The default for workforce import and appointment bulk preparation is `ITEM_ATOMIC`. Approval/publish may use `GROUP_ATOMIC` for one governed proposal. “Continue on error” never changes an item’s failed result to success.

Recovery sequence:

1. Expired worker lease returns `RUNNING` receipt to retryable after heartbeat/grace validation.
2. Worker rereads receipt and aggregate version before side effects.
3. External side effects use their own idempotency key and store provider receipt.
4. Retryable failures use bounded backoff; validation/authorization/domain failures are terminal rejects.
5. After retry budget, move to `DEAD`/quarantine and alert with redacted context.
6. Authorized replay creates a new replay receipt linked to the original; it does not rewrite history.

## 7. Integration ingestion and reconciliation

- Provider event uniqueness is `(tenant, source system, entity type, source record key, source version)`.
- Validate envelope and mapping version before decrypting/mapping restricted fields.
- A duplicate with the same hash is acknowledged without effect. Same identity/version with another hash is quarantined as a contract violation.
- Out-of-order updates are quarantined unless the adapter contract supplies a deterministic ordering/correction rule.
- Cursor advances only after all accepted effects and receipts for the cursor unit commit.
- Required equation: `source = accepted + rejected + duplicate`; `accepted = applied + quarantined_after_acceptance`. All unexplained differences are zero before cutover.
- Reconciliation retains counts, digests, opaque sample references and error codes—not unrestricted payload copies.

## 8. Effective-date conflict recovery

- A 409 response includes safe current aggregate version, conflict type and a refresh link, not protected before/after values.
- UI reloads authorized projection and presents a semantic diff of fields the actor may view.
- Caller may abandon, rebase into a new command, or request a separately authorized correction.
- Database exclusion constraints are the last line of defense. A constraint conflict maps to the same domain error and leaves no partial audit/outbox success.
- Published-event correction closes/supersedes affected future slices, creates replacement slices and links lineage in one transaction. Historical reconstruction follows recorded event order and effective dates deterministically.

## 9. Security and privacy failures

- Denials are audited with decision revision, capability, population/field reason code, target token and correlation; restricted input/output values are omitted.
- Authentication/authorization failures are never retryable by the service worker.
- Step-up tokens are audience, command, actor, tenant and expiry bound and are single-use or replay-recorded for critical commands.
- Cached People responses vary by tenant, principal/access-package revision, purpose, field projection and as-of. 403/404 and PII-bearing partial results are private/no-store unless a reviewed safe-cache contract exists.
- Export is a separate asynchronous governed command with purpose, selected field groups, approval, expiry, watermark, object reference and download audit.

## 10. Telemetry and operational acceptance

Required metrics are command latency/status by type, 409/422/403 rate, receipt age, retry/dead count, outbox age, consumer lag/version gaps, range conflicts, per-adapter reconciliation difference, field-policy denial, step-up failure, document generation/revoke failures and separation task SLA. Labels never include person/worker IDs or restricted values.

Required alerts cover stuck `RUNNING`, expired lease, outbox age, inbox gap, repeat contract violation, reconciliation mismatch, unexpected denial surge, cross-tenant guard attempt, template/render failure and mandatory separation task breach.

Core code Gate evidence uses the synthetic fixtures and fault injection. Customer menu exports, legacy DDL, schedules, production PII and live interface credentials are parity/activation evidence only.
