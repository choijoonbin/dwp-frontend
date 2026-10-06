# HRIS-PAY runtime controls

Status: `CODE_READY_PROPOSAL` validated by central `OPEN_G3_CODE` for provider-neutral core; production activation remains `G6_NOT_AUTHORIZED`.

## Aggregate state machines

| Aggregate | Legal transitions | Terminal/frozen behavior |
|---|---|---|
| Foundation/element/formula/rounding/mapping version | `DRAFT → VALIDATED → APPROVED → PUBLISHED → RETIRED` | published version immutable; replace with new effective version |
| Payroll run | `PREPARING → READY → CALCULATING → VALIDATED → APPROVED → FINALIZED → PAYMENT_PENDING | POSTING_PENDING → CLOSED`; failure/unknown are explicit | `FINALIZED/CLOSED` input/result cannot mutate; correction is a new linked run |
| Attempt | `QUEUED → RUNNING → SUCCEEDED | FAILED | RESULT_UNKNOWN → SUPERSEDED` | retry creates a numbered attempt, never overwrites |
| Reconciliation issue | `OPEN → ASSIGNED → RESOLVED | WAIVED → SUPERSEDED` | waive requires separate duty, reason and evidence |
| Payment batch | `DRAFT → VALIDATING → APPROVED → RELEASED → ACKNOWLEDGED | REJECTED | RESULT_UNKNOWN → REVERSED` | released instructions and file digest immutable |
| GL batch | `DRAFT → BALANCED → APPROVED → SENT → POSTED | REJECTED | RESULT_UNKNOWN → REVERSED` | posted journal corrected by reversal/new batch |
| Payslip | `GENERATED → PUBLISHED → REVOKED` | each regeneration increments document version and digest |
| Country pack | `AVAILABLE → INSTALLED → VALIDATED → APPROVED → ACTIVE → SUSPENDED | RETIRED` | activation requires official reference, golden pack and statutory approval |
| YEA case | `OPEN → COLLECTING → READY → SUBMITTED_TO_PROVIDER → CALCULATED → REVIEWED → FILED | CORRECTION_REQUIRED → CLOSED` | provider response/correction is append-only and digest-linked |

Unlisted transitions return `409 INVALID_STATE_TRANSITION`. Finalization, payment release, GL posting, country-pack activation and provider submission are step-up operations.

## Guard order and CAS

1. Authenticate and derive tenant/actor; payload cannot override either.
2. Validate app entitlement, atomic action and installed module/pack/adapter.
3. Validate purpose and field projection.
4. Resolve legal-payroll-entity/pay-group/period/worker population from Payroll-owned facts.
5. Load `(tenant_id, public_id)` and return opaque 404 for missing or out-of-scope.
6. Compare `expectedVersion` before any calculation or partner side effect.
7. Evaluate run/period state, maker/checker and object-level SoD.
8. Verify frozen People projection, accepted Time handoff, formula/element/rounding/country versions and their digests.
9. Reserve tenant/command/idempotency key and compare canonical request digest.
10. Append state event, monetary facts, business/security audit, outbox and durable receipt atomically.

Mutable aggregate updates use a tenant-scoped expected-version predicate and exactly-one-row assertion. Final result/trace/balance/approval/access facts never update. A stale command returns 409 without recalculation or connector call.

## Formula execution controls

- Parse only the declared typed DSL AST; reject Java/SpEL/SQL/JavaScript, reflection, class/method names, network/file/database calls, ambient time/random and recursion.
- Validate input/output types, unit/currency, dependency availability, acyclic graph, maximum nodes/depth and allowlisted pure function-set version.
- Make rounding stage, scale and mode explicit and snapshot them with the run.
- Compile to a content-addressed artifact in a sandbox with CPU/memory/time ceilings.
- Same engine/function/formula/input/rounding digests must yield the same output digest.
- A timeout or resource violation blocks that worker/run; partial numbers never become final.
- Golden test digest is mandatory before publish. Country-specific expected values reside only in the activated pack's approved golden set.

## Snapshot and ledger rules

Run preparation freezes target workers, effective People projection revisions, accepted Time handoff/close revision, worker entries, elements/formulas/rounding, country packs, currency and mapping versions. The snapshot is content-addressed and immutable.

Attempts, worker results, result lines, trace nodes, balance ledger, approvals and published documents are append-only. Retro/off-cycle/correction uses a new run linked by `supersedes_run_id`; reversal lines/ledger entries reference originals. No final result is deleted/recreated. A balance projection must replay to the ledger total; unexplained difference is blocking.

## Idempotency and result-unknown recovery

- Scope: `(tenant_id, command_type, Idempotency-Key)`.
- Request digest: canonical schema version + normalized body + target IDs, excluding token/volatile headers.
- Same key/digest returns the original receipt; same key/different digest returns `409 IDEMPOTENCY_KEY_REUSED`.
- Long operations use durable `ACCEPTED/RUNNING` receipt, renewable lease and fencing token.
- Commit and receipt/outbox write share a transaction. If the HTTP response is lost, lookup returns the committed result.
- Partner timeout is `RESULT_UNKNOWN`, never success. Reconcile by provider reference/idempotency key before retry.
- Retry creates a new attempt/transport receipt but preserves logical command key and lineage.
- Receipt creation seals `originating_action`, `subject_principal_public_id`, `population_scope_digest`, `field_policy_revision`, `purpose_code` and `authorization_revision`; those values cannot be caller-overridden later.
- `GET /v1/command-receipts/{receiptId}` re-evaluates the current HRIS entitlement and the exact originating action, subject, population, field and purpose context. The more restrictive of the originating and current policy wins; revocation is immediate and cross-tenant/out-of-scope identifiers return opaque `404`.

## Control totals and reconciliation

Run validation proves worker result lines equal gross/deduction/net/employer totals; run totals equal worker totals; balance deltas replay; target count equals included/excluded disposition; all blocking issues are resolved. Currency totals never mix currencies.

## Decimal value and rounding contract

`coding-readiness/decimal-value-types.v1.json` is the single numeric SSOT. Wire values are canonical non-exponent decimal strings; binary floating point, locale formatting, negative zero and PostgreSQL implicit rounding are forbidden. HRM compensation and payroll inputs use `InputAmount NUMERIC(19,6)`, rate uses `RateDecimal NUMERIC(19,8)`, quantity uses `QuantityDecimal NUMERIC(19,6)`, formula intermediates and trace use `CalculationDecimal NUMERIC(24,8)`, and immutable payroll/payment/GL/statement facts use `PostedMoney NUMERIC(19,4)`. The pipeline is `SOURCE_NORMALIZE → FORMULA_DECLARED → ELEMENT → WORKER_RESULT → SETTLEMENT_OR_STATUTORY`; each actual quantization records unrounded/rounded values, stage, scale, one of `HALF_UP|HALF_EVEN|DOWN|UP|FLOOR|CEILING`, and policy digest. Overflow is rejected before persistence and never truncated or saturated.

Payment batch total equals released instruction total and each instruction references a finalized worker result and verified bank token version. GL debit equals credit and every line references a result line plus mapping revision. Bank/ERP/provider receipts are reconciled by digest/reference; reject/unknown remains open. Waiver is a separate audited duty and cannot turn a monetary difference into silent success.

## Payment, GL and document protection

Canonical payment/GL generation is global core. Provider format/transport is a separately activated adapter. Connector endpoint, certificate and secret remain in DWP Integration. Payroll stores only opaque refs, payload/response digests and provider references.

Bank-file and payslip download uses a short-lived object grant after field-purpose and step-up checks. Every view/download/print/export is append-only audit. Plain bank account, resident identifier, full tax evidence and connector secret are forbidden in logs, events, general result tables and frontend caches.

## Country pack and YEA activation

Global core includes the country-pack SPI/harness but no guessed law/rate/form. Activation requires jurisdiction, official reference/version/effective date, rounding, approved expected results, filing schema and statutory owner. A disabled pack fails only pack-dependent work with a typed error.

Country-pack activation is serialized by PostgreSQL for each tenant/jurisdiction/pack key. Every ever-active period is retained as a half-open `[)` range under `ex_pay_country_pack_ever_active_period`; two concurrent overlapping activations have exactly one winner and the `23P01` loser maps to HTTP `409` without moving an active pointer. A successor may start exactly at the prior upper boundary. Once activated, pack identity, artifact/compatibility evidence, approval evidence and lower bound are immutable; only forward closure of an open upper bound is permitted, so suspend/retire cannot erase the historical overlap guard.

YEA hybrid core owns case/evidence/status/consent/purpose/invocation/reconciliation. External provider or native country pack owns calculation/filing. Provider calls use versioned schemas, request/response digests and durable receipts. Missing real provider or legal evidence blocks only provider/native-pack activation, not core Payroll development.

## Batch, recovery and operations

Jobs are signed code-owned manifests with JSON-schema parameters. DWP Admin owns catalog/schedule/execution/DLQ UI; Payroll owns locks, domain handler and receipts. Tenant input cannot select a class, method or executable formula. Retry policy distinguishes transient transport, permanent schema/auth, domain failure and result unknown.

Required metrics: run/worker/element duration, formula timeout, idempotency conflict, snapshot/projection lag, control-total difference, blocking issue age, payment/GL/provider unknown age, receipt reject rate, DLQ depth, document access and ledger replay difference. Logs use public IDs/digests only.

Core uses synthetic golden/load/recovery proof. Current statutory values, customer parallel-pay data, production bank/ERP/YEA contracts, production volume/retention/DR and named operational owners remain explicit activation/cutover gates.
