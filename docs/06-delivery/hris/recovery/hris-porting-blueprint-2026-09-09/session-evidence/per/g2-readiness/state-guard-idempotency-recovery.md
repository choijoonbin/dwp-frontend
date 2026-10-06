# PER State, Guard, Idempotency and Recovery Contract

Status: `READY_FOR_G3_CODE`  
Runtime owner: `dwp-people-server/hris/performance`

## Command envelope

Every mutation receives the following trusted/validated context before application code runs:

| Field | Source | Rule |
|---|---|---|
| tenant | authenticated DWP context | Never accepted from request body/query; included in every repository predicate |
| actor | authenticated DWP context | Stable opaque user/service ID |
| app entitlement | Auth PEP | `APP.HCM` canonical grant (HRIS alias read compatibility only) |
| capability | route/API contract | Exact atomic action, not a broad persona role |
| population scope | Auth + Performance policy | Self, assigned-review, named population or organization scope |
| field policy/purpose | Auth + Performance policy | Returned and writable fields are independently filtered |
| idempotency key | request header/event ID | Required for mutation; unique by tenant + on-behalf-of subject + originating action; the tuple and request/authorization context are immutable and the receipt cannot be deleted |
| expected version | `If-Match` or event aggregate version | Required for mutable aggregate commands |
| correlation/causation | gateway/event envelope | Preserved through Audit, Approval, Notification and outbox |
| step-up evidence | Auth | Required for calibration approval and result publication; one-time/replay protected |

Repository access occurs only after all applicable guards pass. UI route visibility never substitutes for these checks.

## State machines

### Cycle and version

| From | Command | To | Guards | Side effects |
|---|---|---|---|---|
| — | CreateCycle | `DRAFT` | unique tenant cycle key | `PerformanceCycleDrafted` |
| `DRAFT` | ValidateCycle | `VALIDATED` | stages ordered/non-overlapping; template/rules published; weights valid | immutable validation report |

Published population-rule effective periods are serialized by the database, not by an application precheck. The canonical scope is the generated null-safe `scope_key = scope_type || ':' || COALESCE(scope_public_id, 'GLOBAL')`; for the same tenant/scope/rule, all ever-published periods use half-open `[)` ranges and must not overlap. Two concurrent overlapping publishes produce one winner and one PostgreSQL `23P01`, mapped to HTTP `409` with no partial pointer update. A successor whose `effective_from` equals the predecessor's `effective_to` is valid. Published identity, scope, content hash and lower bound are immutable; only closing an open upper bound forward is allowed, so superseding a row cannot erase the historical exclusion invariant.
| `VALIDATED` | RequestPublish | `VALIDATED` | independent approval instance; operator scope | approval reference only |
| `VALIDATED` | PublishCycle | `PUBLISHED` | approval completed; expected version; step-up when policy requires | immutable version, outbox event |
| `PUBLISHED` | ActivateCycle | `ACTIVE` | effective instant reached; population frozen | tasks generated idempotently |
| `ACTIVE` | CloseCycle | `CLOSED` | required stages complete or approved waivers | close receipt, missing-work summary |
| `PUBLISHED|ACTIVE` | CorrectCycle | new `DRAFT` version | reason; no mutation of prior version | successor version linked by lineage |

Deletion is allowed only for an unused draft and is implemented as a tombstoned state plus audit, never physical deletion after publish.

### Population freeze

`DRAFT → PREVIEWED → FROZEN → SUPERSEDED`

- Preview is a pure deterministic function of population rule version and HRM workforce snapshot revision.
- Freeze requires the client preview hash to equal the server's latest hash.
- A frozen member/reviewer set is append-only. HR changes after freeze create exceptions or a new freeze version; they never silently change membership.
- A new freeze supersedes the prior one only before any review submission, unless a controlled correction workflow explicitly migrates assignments and records both sets.

### Goal

`DRAFT → SUBMITTED → APPROVED → ACTIVE → COMPLETED`, with `RETURNED` and `CANCELLED` alternatives.

- Goal periods must fit the cycle policy.
- Weight totals are validated per configured group to exactly `1.000000` using decimal arithmetic.
- Alignment edges cannot self-reference or create a graph cycle.
- After approval, content changes append a revision and may require reapproval based on materiality policy.

### Review

`NOT_STARTED → IN_PROGRESS → SUBMITTED → COMPLETED`; `RETURNED → IN_PROGRESS` is allowed with a reason and a new submission number.

- The actor must match the frozen reviewer assignment, including stage and participant.
- Template version and participant snapshot are immutable after review creation.
- Submit validates required items, scale bounds, evidence references and content hash.
- A submitted response is never updated. Return creates a new draft submission and preserves the previous submitted snapshot.
- An actor cannot review an unassigned subject, including one in their current reporting line but absent from the freeze.

### Feedback and check-in

- Feedback request: `DRAFT → OPEN → CLOSED → AGGREGATED → RELEASED`; cancellation is allowed before release.
- Feedback assignment: `ASSIGNED → SUBMITTED|DECLINED|CANCELLED`.
- Anonymous aggregation releases only when `submitted_count >= minimum_release_count`; otherwise output remains withheld without revealing contributor identities or exact suppressed counts.
- Check-in: `DRAFT → SCHEDULED → COMPLETED → ACKNOWLEDGED`; private notes remain private across all transitions.

### Calibration

`DRAFT → READY → IN_SESSION → SUBMITTED → APPROVED → LOCKED`

- Baseline result-set hash must match before every adjustment.
- Each adjustment appends before value/grade, after value/grade, reason, actor, time and distribution impact.
- The calibrator cannot be the result publisher for the same cycle.
- Submit requires all constraint violations resolved or individually waived with an approval reference.
- Approval and lock require current step-up evidence. Locked sessions accept no mutation; corrections use a successor session.

### Result and appeal

- Result set: `COMPUTED → VALIDATED → APPROVED → PUBLISHED`; recalculation creates a higher result version. `CORRECTED` points to the superseded result set.
- Calculation, validation, approval and publish are distinct actions. Publish requires publisher duty, independent approval, step-up evidence and a population hash match.
- Appeal: `OPEN → UNDER_REVIEW → UPHELD|REJECTED → CLOSED`; withdraw is allowed before resolution. An upheld appeal creates a correction command, not an in-place result edit.

## Formula and deterministic calculation rules

1. All numeric inputs and outputs use decimal types; binary floating point is forbidden for persisted scores.
2. Published template/rubric/rule versions are immutable and identified by content hash.
3. Weight totals equal `1.000000`; scale values are bounded and strictly ordered.
4. Missing, not-applicable and withheld values are distinct states and are never silently treated as zero.
5. Intermediate values, input snapshot hash, rule version and rounding policy are retained with the result.
6. Tenant input may select a supported code-owned strategy and parameters but cannot submit executable expressions or scripts.
7. AI may draft narrative text or summarize evidence; it cannot autonomously assign scores, grades, publish results or take adverse employment action.

## Idempotency contract

### HTTP commands

1. Reserve `(tenant_id, Idempotency-Key)` in `prf_command_receipts` before effects.
2. Hash the normalized command, capability, actor, aggregate and expected version.
3. Same key + same hash returns the original status/result; it never repeats effects.
4. Same key + different hash returns `409 IDEMPOTENCY_KEY_REUSED`.
5. Commit aggregate change, outbox event and success receipt in one transaction.
6. If the client times out, it queries `/command-receipts/{receiptId}`. It does not guess success or blindly resubmit.
7. Receipt retention is the larger of client retry horizon, downstream replay horizon and audit policy.

### Event consumers

- Inbox uniqueness is `(tenant_id,event_id)`.
- Duplicate event + same payload hash is acknowledged with the stored outcome.
- Duplicate event + different payload hash is quarantined as `EVENT_ID_PAYLOAD_MISMATCH`.
- Older aggregate revisions are ignored with an audit marker; gaps pause the projection and request replay/snapshot repair.
- Handlers commit domain/projection change and inbox outcome atomically.

### Scheduled and bulk work

- Platform Automation obtains a fenced lease before invoking a signed job handler.
- Job identity is `(tenant, job-key, job-version, logical-window, parameter-hash)`.
- Row effects have stable natural/idempotency keys. Retry may resume after the last durable checkpoint.
- A replacement run links `retry_of_receipt_id`; it does not erase the failed run.

## Failure and recovery table

| Failure | Externally visible state | Recovery | Duplicate prevention |
|---|---|---|---|
| Validation failure before commit | `422` with stable issue codes | Correct command and use a new key | No receipt effect beyond rejected audit |
| Optimistic conflict | `409 STALE_VERSION` | Re-read resource/ETag and consciously reapply | Expected-version guard |
| Timeout after commit | receipt `SUCCEEDED` or `RESULT_UNKNOWN` | Poll receipt; reconciliation worker resolves unknown | Idempotency key + request hash |
| Outbox broker unavailable | aggregate committed, outbox `PENDING` | exponential retry with jitter; quarantine after policy threshold | unique aggregate/version/event type |
| HRM snapshot revision gap | preview `BLOCKED_DEPENDENCY_GAP` | fetch signed snapshot and replay in order | inbox revision watermark |
| Population freeze worker crash | receipt `RUNNING/RESULT_UNKNOWN` | lease expiry then resume from checkpoint | freeze content hash + logical job identity |
| Import partially invalid | run `PARTIAL` or `REJECTED` | download canonical row issues, correct, new run | source hash + idempotency key |
| Publish notification failure | results remain published; delivery receipt failed | Notification retry/DLQ; do not republish results | publication identity + notification event ID |
| Calibration or publish SoD denial | `403 SOD_DENIED` | different authorized actor completes action | cycle-scoped SoD policy |
| Cross-tenant identifier probe | tenant-safe `404` | none | tenant predicate before public ID lookup |

## Concurrency rules

- Aggregate mutations use optimistic version checks and increment exactly once per successful command.
- Population freeze, close, calculation and publish use a short database claim plus external/fenced lease; long work never holds a database transaction open.
- Publication is unique per tenant/result set. Two concurrent attempts return the same receipt or a conflict, never two notifications.
- Goal alignment cycle detection and weight validation occur against the transaction-consistent graph/version.
- Review auto-save and submit race: submit wins only when its draft content hash matches; later auto-save receives `409 REVIEW_ALREADY_SUBMITTED`.

## Audit and observability

Each command records correlation/causation IDs, tenant, actor, purpose, capability, population decision reference, field-policy revision, aggregate/version, state transition, approval and step-up references, result code and receipt. Sensitive values and narrative bodies are excluded from logs. Metrics are tagged by module, capability, result code and tenant-safe bucket, never person/reviewer ID.

Minimum alerts cover stuck receipts, inbox revision gaps, outbox age, freeze reconciliation mismatch, import rejection spike, stage deadline backlog, unauthorized-access spike and publish delivery failures.

## Required automated tests before slice Gate

- legal and illegal transition table tests for every aggregate;
- idempotency same-key/same-body and same-key/different-body tests;
- timeout-after-commit receipt recovery;
- outbox retry and inbox duplicate/gap tests;
- cross-tenant, outside-assignment, private-field and suppressed-cohort negative tests;
- concurrent submit/auto-save, freeze and publish tests;
- golden decimal score/weight/calibration/result lineage tests;
- correction/appeal tests proving prior evidence is unchanged.
