# HRIS-PAY G2 service-boundary proposal

Status: `CODE_READY_PROPOSAL`, pending Integration Control gate. This document does not open G3 by itself.

## Runtime identity

| Item | Decision |
|---|---|
| Gradle module | `dwp-payroll-server` |
| Logical owner | Payroll & Statutory |
| Database/schema | dedicated Payroll store; `pay_*` core, pack-owned versioned rules |
| Public API prefix | `/api/payroll/v1` |
| Internal consumer API | `/internal/payroll/v1/*` only for versioned service contracts |
| Event namespace | `dwp.hris.payroll.v1` |
| Frontend owner | `apps/dwp/src/features/hris/payroll` |
| Checkpoint | BE `5670877de7a39e94e75021c7e23cbbb553296c90`, FE `7635ce4223000ed83cb4965f8374d8a8433f1a62` |

The runtime is not a copy of `cloudhr-pay`, its entities, formulas, reports, or YEA proxy. It is an independent Payroll bounded context based on the G1 behavior decisions. Shared Gradle settings, gateway, central contracts and navigation remain Integration Control writes.

## Owned bounded contexts

| Package | Owns | Does not own |
|---|---|---|
| `foundation` | legal payroll entity, group, calendar/period, currency, rounding | legal employer/worker truth |
| `element` | element/balance definitions and effective versions | arbitrary executable customer code |
| `formula` | typed DSL schema, graph, compiled artifact metadata, golden tests | source expressions or reflection/SpEL scripting |
| `input` | effective worker entries, tax election/profile, payment instruction token refs | compensation basis/dependent/bank source truth |
| `calculation` | frozen snapshots, runs, attempts, worker/result/trace | Time raw punches or mutable final result |
| `retro` | impact events, differential/off-cycle runs, correction/reversal lineage | destructive recalculation |
| `statutory` | pack SPI, filing cases/results/receipts | a hardcoded KR rule in global core |
| `retirement` | optional pack case/workflow/results through common engine | customer-specific SK2/KF types in core |
| `yearend` | DWP case/collection/evidence/status/reconciliation and provider SPI | assumed legacy YEA backend or mandatory provider |
| `payment` | canonical batch/instruction/file metadata/receipts | bank-specific transport/credentials in core |
| `accounting` | canonical balanced journal, mapping refs and receipts | ERP-specific transport or account master truth |
| `payslip` | immutable statement metadata, publication/revoke/access audit | ungoverned local files/templates |

## Internal architecture

```text
dwp-payroll-server
├─ bootstrap       wiring, health, migrations, PEP adapters
├─ foundation      domain / application / adapters
├─ element         domain / application / adapters
├─ formula         typed DSL compiler/interpreter ports
├─ input           worker entries and upstream projections
├─ calculation     snapshots, run, attempts, trace, result ledger
├─ retro           impact/correction/off-cycle
├─ statutory
│  ├─ spi          country-pack interfaces
│  └─ case         generic filing/reconciliation workflow
├─ retirement      generic case shell using country-pack SPI
├─ yearend         provider-neutral hybrid case and SPI
├─ payment         canonical instructions and adapter SPI
├─ accounting      canonical journal and adapter SPI
├─ payslip         document publication and access audit
└─ insight         read models and HRIS widget contribution
```

Domain packages do not depend on HTTP, JPA entities, partner SDKs, customer constants or upstream repositories. Formula runtime is a bounded value language, not Java/SpEL/SQL/JavaScript execution. Country and connector packages implement published SPIs and cannot access another aggregate's tables.

## Sources of truth and projections

| Fact | Source of truth | Payroll representation |
|---|---|---|
| worker/employment/assignment/compensation/dependent | `dwp-people-server` | minimal effective-dated `pay_worker_projections` |
| verified bank source | People/vault provider | opaque token/version/verification state only |
| approved/closed work and absence | `dwp-time-server` | accepted handoff snapshot with close revision/digests |
| access packages/duties | DWP Auth | PEP input; no Payroll ACL table |
| approval | DWP Approval | opaque case ID plus Payroll revision/guard |
| files/templates | Object Storage/Notification | object/template public ref and digest |
| payroll inputs/runs/results/balances | `dwp-payroll-server` | authoritative immutable/versioned facts |
| partner credentials/endpoints | DWP Integration | secret/connection public ref only |

There are no People/Time/Auth/Integration physical foreign keys and no direct DB queries. Projection gaps, unsupported schema or digest mismatch fail closed and are reconciled through replay, not hidden fallback.

## DWP platform reuse

- Auth and access packages for app grant and atomic duties.
- People workforce/population/field-purpose policy and source events.
- Approval for routing/evidence, with Payroll retaining state and SoD checks.
- Audit for business/security/access/export evidence.
- Notification/Object Storage for statements, filing evidence and messages.
- Platform automation for catalog, schedule, execution center and DLQ UI.
- Integration for connection, endpoint/secret refs, allowlist and health.
- Transactional outbox/inbox for publication and idempotent consumption.

Payroll does not create module-local versions of these capabilities.

## Global core, country pack, YEA and connector separation

| Layer | Contents | Activation |
|---|---|---|
| Global core | foundation, typed formula engine, input/run/snapshot/result/trace/balance, retro/off-cycle, approvals, payslip, canonical payment/GL and reconciliation | normal module enablement |
| Tenant configuration | groups/calendars/elements/eligibility/formulas/rounding/mappings | draft/validate/simulate/approve/publish |
| Country pack | tax, insurance, retirement, statutory forms/filing rules | signed compatible pack + official effective-law golden evidence |
| YEA provider/native pack | calculation/filing behind `YearEndProvider` SPI | provider conformance or native statutory approval |
| Connector | bank/ERP/authority/legacy transports/formats | connection + conformance + operational owner |
| Customer extension | published hooks and fields only | signed package; no core fork/direct DB/executable script |

Default YEA is hybrid: DWP owns the case, collection, evidence, consent/purpose, status, corrections and reconciliation; a provider or optional native KR pack owns calculation/filing. A tenant may leave YEA uninstalled without disabling core Payroll.

## Typed formula boundary

The DSL supports typed numeric/date/boolean/code values, explicit currency/unit, named inputs, decision tables, bounded aggregation, allowlisted pure functions, dependency graph, effective versions and declared rounding. It rejects dynamic class/method access, reflection, network/file/database access, unbounded loops/recursion, ambient clock/randomness and cross-tenant reads.

Compilation produces an immutable artifact digest. A run snapshot records DSL version, function-set version, formula/element versions, rounding policy and golden test digest. CPU/memory/node/depth/time limits are enforced; timeout is a typed worker failure, never a partial final result.

## Command ownership

| Command | Aggregate | Required guards | Result |
|---|---|---|---|
| publish foundation/element/formula | config version | schema, graph/golden, effective overlap, approval | immutable published revision |
| set worker entry/tax profile/payment token | worker input | expected version, field purpose, source/effective period | revised entry and audit event |
| prepare run | payroll run | period open, target scope, upstream revisions/digests, idempotency | frozen target/input/rule snapshot |
| calculate/retry | run attempt | READY, lease, snapshot digest, formula limits | immutable attempt/results/trace or result-unknown receipt |
| validate/approve/finalize | run | control totals, issues, expected version, maker/checker | immutable approval/finalization event |
| create/release payment | payment batch | finalized run, bank tokens verified, SoD/step-up | canonical instructions/file and adapter receipt |
| create/post GL | GL batch | finalized run, balanced lines, mapping version, SoD | canonical journal and ERP receipt |
| submit/correct YEA case | year-end case | installed provider/pack, purpose/evidence, expected version | provider request/receipt and reconciled case revision |

## Events consumed

- `WorkerAssignmentSnapshot.v1`
- `CompensationBasisSnapshot.v1`
- `WorkerDependentEligibilitySnapshot.v1`
- `WorkerTaxIdentitySnapshot.v1` (token only)
- `WorkerBankAccountTokenSnapshot.v1` (opaque token only)
- `ClosedTimeResult.v1`
- `ApprovedCompensationPlanSnapshot.v1`
- `WorkerChanged.v1`
- `EmploymentChanged.v1`
- `AssignmentChanged.v1`
- `OrganizationChanged.v1`
- `CompensationBasisChanged.v1`
- `WorkerDependentEligibilityChanged.v1`
- `WorkerTaxIdentityChanged.v1`
- `WorkerBankAccountTokenChanged.v1`
- `TimePeriodClosed.v1`
- `TimePeriodReopened.v1`
- `PayrollTimeHandoffReady.v1`
- `CompensationPlanApproved.v1`
- `PolicyPublished.v1`
- `ApprovalDecisionRecorded.v1`
- `ProductAccessPackageChanged.v1`
- partner receipts through the Integration ingress envelope.

Inbox uniqueness is `(tenant_id, id)` from the canonical DWP `DomainEventEnvelope`, with per-subject `aggregateSequence` guards. Reopened Time revisions invalidate only unfinalized snapshots; a finalized run requires an explicit retro/correction event. Every event is only an invalidation/coordination signal: Payroll fetches the exact versioned snapshot and verifies its digest before freezing a run.

## Events provided

- `PayrollConfigurationPublished.v1`
- `PayrollRunPrepared.v1`
- `PayrollCalculated.v1`
- `PayrollValidated.v1`
- `PayrollRunApproved.v1`
- `PayrollFinalized.v1`
- `PayrollCorrectionPosted.v1`
- `PayslipPublished.v1`
- `PaymentInstructionReleased.v1`
- `PayrollPosted.v1`
- `YearEndCaseChanged.v1`

Events carry public IDs, revisions, effective/occurred/recorded times, actor/service principal, purpose, correlation/causation, schema version and digests. They do not include account plaintext, identifiers, full formulas, pay-line detail or tax documents.

## Runtime and deployment gates

1. Skeleton/migration allocation and shared contract owners approve writes.
2. Formula/state/ledger/API contract fixtures pass without a customer or partner.
3. People/Time/Auth/Approval/Platform provider-contract tests pass.
4. Tenant-negative, field-purpose, step-up and SoD tests pass.
5. Synthetic regular/retro/off-cycle/payment/GL/YEA-shell goldens pass.
6. Each country/provider/connector activates independently after its evidence gate.
7. Production additionally needs load, volume/partition, retention/DR, operations and customer parallel/reconciliation evidence.

No AS-IS DDL, real salary data, bank/ERP contract or current KR rate table is required to build global core. Those materials are required only for the corresponding migration, adapter, country pack or production activation claim.
