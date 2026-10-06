# HRIS-TIM G2 service-boundary proposal

Status: `CODE_READY_PROPOSAL`, pending Integration Control gate. This document does not open G3 by itself.

## Runtime identity

| Item | Decision |
|---|---|
| Gradle module | `dwp-time-server` |
| Logical owner | Time & Leave |
| Database/schema | dedicated Time store; `tme_*`, `abs_*` namespaces |
| Public API prefix | `/api/time/v1`, `/api/time/v1/leave` |
| Internal consumer API | `/internal/time/v1/*` only for versioned service contracts |
| Event namespace | `dwp.hris.time.v1`, `dwp.hris.leave.v1` |
| Frontend owner | `apps/dwp/src/features/hris/{time,leave}` |
| Checkpoint | BE `5670877de7a39e94e75021c7e23cbbb553296c90`, FE `7635ce4223000ed83cb4965f8374d8a8433f1a62` |

The runtime is not a copy of `cloudhr-tim`. It is a domain service whose public contracts are derived from the G1 decisions. It must not be added to root settings, gateway routes, shared contracts, or central navigation until Integration Control allocates those shared writes.

## Owned bounded contexts

| Package | Owns | Does not own |
|---|---|---|
| `schedule` | work-rule versions, shift templates, rotations, generated schedules, assignments | worker/employment truth, global holiday authority |
| `clock` | source registration, immutable raw clock events, void links, adapter receipts | device credentials, provider-specific payload in core |
| `interpretation` | frozen input/rule snapshots, attempts, interpreted segments, time ledger | payroll calculation |
| `timecard` | card projection, submission, decision, exceptions, corrections | organization/manager truth |
| `leave` | plans, enrollments, requests, entitlement runs/ledger/balance projection | employment leave-of-absence lifecycle, medical document body |
| `close` | daily/monthly close revisions, blockers, approvals, reopen/correction, Payroll handoff | Payroll acceptance rules and downstream calculation |
| `insight` | scoped operational read models and HRIS widget contribution | a separate analytics warehouse or broad employee surveillance |

## Internal architecture

```text
dwp-time-server
├─ bootstrap       Spring wiring, health, migrations, PEP adapters
├─ schedule        domain / application / adapters
├─ clock           domain / application / adapters
├─ interpretation  domain / application / adapters
├─ timecard        domain / application / adapters
├─ leave           domain / application / adapters
├─ close           domain / application / adapters
├─ insight         read models and widget API
├─ country
│  └─ spi          country-pack interfaces only; no KR rule in core
└─ connector
   └─ spi          clock/import/export canonical ports only
```

Each slice uses ports/adapters. Domain code has no dependency on HTTP, database entities, device SDKs, customer constants or another DWP service repository. Application commands return a durable receipt or resource revision. Read models are disposable projections.

## Sources of truth and projections

| Fact | Source of truth | Time representation |
|---|---|---|
| worker/employment/assignment/legal entity/workplace | `dwp-people-server` | minimal `tme_worker_projections`, ordered by upstream revision |
| manager/org population | People access relationship service | evaluated at request/decision time; revision included in audit |
| app grant/atomic duty | DWP Auth | PEP decision input; no Time ACL tables |
| approval case | `dwp-approval-server` | opaque case public ID plus expected domain revision |
| policy/calendar publication | DWP Platform configuration | immutable policy/calendar revision reference |
| notification/file | Notification/Object Storage | template/object public ref and digest only |
| raw clock and time/leave ledger | `dwp-time-server` | authoritative append-only facts |
| Payroll run | `dwp-payroll-server` | handoff receipt public ID/status only |

There are no cross-service physical foreign keys. A projection row is tenant-scoped and contains `source_revision`, `effective_from/to`, `received_at` and payload digest. Missing or stale mandatory projection fails closed; it does not trigger a direct People DB lookup.

## DWP platform reuse

- Auth: app entitlement, atomic role/duty and package assignment.
- People: workforce/population/field policy and worker events.
- Approval: case routing and decision evidence; Time still validates state and self-approval.
- Audit: security/business audit with purpose and field groups.
- Notification/Object Storage: template and evidence/document references.
- Platform automation: catalog, tenant schedule, lease, execution receipt and DLQ UI.
- Integration: connector catalog, connection instance, endpoint/secret refs, allowlist and health.
- Outbox/inbox: transactional publication and idempotent event consumption.

No Time-specific clone of these services is permitted.

## Global core, configuration, country and extension separation

| Layer | Contents | Activation |
|---|---|---|
| Global core | clocks, snapshots, interpretation engine, timecard/request/ledger, close/handoff, receipts | normal module enablement |
| Tenant configuration | work patterns, overtime/leave policies, calendars, assignments, approval policy | draft/validate/simulate/approve/publish |
| Country pack | jurisdiction-specific eligibility, protection, caps, evidence and reports | installed version + official reference + approved golden pack |
| Connector extension | device/vendor/import/export adapter | signed compatible package + connection + conformance evidence |
| Customer extension | narrowly scoped hook against published SPI | signed package; no core fork or DB access |

The initial core ships with no statutory numeric default. The optional KR pack owns maternity/childcare/annual-promotion rule versions. Absence/employment leave remains People-owned even when a Time country pack derives availability or pay-code effects.

## Command ownership

| Command | Aggregate | Required guards | Result |
|---|---|---|---|
| publish schedule/rule | policy version | config duty, schema/golden, effective overlap, approval | new immutable published revision |
| record/void clock | clock stream | source trust, worker projection, source-event uniqueness | clock receipt and outbox event |
| run interpretation | interpretation run | rule/input snapshot, period state, lease | attempt receipt; immutable segments/ledger |
| submit/decide timecard | timecard | expected version, population, self-approval/SoD, exceptions | revised card and decision event |
| request/decide/cancel leave | leave request | eligibility, balance, overlap, expected version, scope | request revision plus ledger posting/reversal |
| close/reopen period | close period | blockers, maker/checker, accepted corrections, CAS | close revision and immutable audit bundle |
| hand off to Payroll | close revision | CLOSED, digest stable, no unacknowledged supersession | accepted/rejected/result-unknown receipt |

## Events consumed

- `WorkerAssignmentSnapshot.v1` (versioned bootstrap/refetch projection)
- `WorkplaceAssignmentSnapshot.v1` (effective-dated workplace, timezone and calendar projection)
- `WorkerChanged.v1`
- `EmploymentChanged.v1`
- `AssignmentChanged.v1`
- `OrganizationChanged.v1`
- `WorkplaceChanged.v1`
- `PolicyPublished.v1`
- `CalendarPublished.v1`
- `ApprovalDecisionRecorded.v1`
- `ProductAccessPackageChanged.v1`

All consumers use `(tenant_id, id)` inbox uniqueness from the canonical DWP `DomainEventEnvelope` and per-subject `aggregateSequence` guards. Gap detection quarantines the subject until replay. Unknown schema versions are dead-lettered without partially updating projections.

## Events provided

- `ClosedTimeResult.v1` (immutable snapshot with header, lines, ledger membership and supersession lineage)
- `ClockEventRecorded.v1`
- `TimeInterpreted.v1`
- `TimecardSubmitted.v1`
- `TimecardDecisionRecorded.v1`
- `LeaveRequested.v1`
- `LeaveDecisionRecorded.v1`
- `LeaveLedgerPosted.v1`
- `TimePeriodClosed.v1`
- `TimePeriodReopened.v1`
- `PayrollTimeHandoffReady.v1`
- `HrisHomeContributionChanged.v1` (`TimeLeaveHomeContribution.v1` profile)

Events implement `contracts/asyncapi/domain-events.yaml#/components/schemas/DomainEventEnvelope` exactly (`specVersion`, `id`, `source`, `type`, `schemaVersion`, `time`, `tenantId`, `aggregateType`, `aggregateId`, `aggregateSequence`, `correlationId`, `data`). Optional causation, trace and purpose metadata stays in the envelope extensions; business payload digests stay in `data`. Events never contain free-text leave reasons, medical evidence, precise location or device credentials.

## Runtime and deployment gates

1. Module skeleton and migration allocation approved.
2. Contract fixtures pass without a running partner.
3. People/Auth/Approval/Platform mock-provider contracts pass.
4. Tenant-negative and scope/field/SoD tests pass.
5. Ledger/state/idempotency/golden tests pass.
6. A connector/country pack activates independently only after its evidence gate.
7. Production enablement additionally needs load/retention/DR/observability and human operational ownership.

Actual operating DDL, access logs, clock vendor contracts or KR law datasets are useful for a specific cutover/activation, not prerequisites for global core implementation.
