# ADR-001 — Performance Bounded Context and Runtime Ownership

- Status: `READY_FOR_G3_CODE`
- Date: 2026-09-10
- Scope: HRIS-PER
- Decision owner for G1 baseline: `ROLE.HRIS_PER_ENGINEERING`
- Required G2 reviewers: `ROLE.HRIS_PER_PRODUCT_OWNER`, `ROLE.HRIS_PER_SME`, `ROLE.ARCHITECTURE_AUTHORITY`, `ROLE.DBA_AUTHORITY`, `ROLE.SECURITY_AUTHORITY`, `ROLE.PRIVACY_AUTHORITY`, `ROLE.QA_EVIDENCE`, `ROLE.INTEGRATION_CONTROL`

## Context

SKKF distributes performance behavior across stage-specific screens, controllers, copied HR data, generic code tables, batch endpoints and result interfaces. A one-for-one port would preserve duplicate workflows, allow mutable result records and couple Performance to HRM persistence.

DWP needs a generic, tenant-safe product whose first deployment stays operationally simple but can later split Performance into its own service without rewriting contracts.

## Decision

Performance is an independent bounded context initially deployed inside `dwp-people-server/hris/performance`. It owns the `prf_*` schema, application ports, migrations, public APIs, domain events, inbox/outbox, command receipts and policy enforcement.

The package may depend on shared DWP libraries and public service clients. It may not import HRM entities/repositories, write People tables, or join another bounded context's physical tables. Worker, assignment, organization and manager facts enter through an as-of HRM snapshot contract and effective events. All stored references are public IDs plus source revision metadata.

The frontend boundary is `apps/dwp/src/features/hris/performance`. HRIS Home consumes a compact widget projection; the full 76-node catalog remains in the separate work finder and is never rendered as home content.

## Aggregate boundaries

| Aggregate | Root | Owned children | Key invariant |
|---|---|---|---|
| Cycle | `prf_cycle` | version, stage, policy refs | Published version immutable; one active version per cycle/effective instant |
| Template | `prf_template` | version, section/item/rubric snapshots | Submitted work always points to a published immutable version |
| Population freeze | `prf_population_freeze` | participants, reviewer assignments | Membership is deterministic for HRM snapshot revision and cannot drift after freeze |
| Goal | `prf_goal` | revisions, alignment edges | No alignment cycle; weights and measurement contracts validated before approval |
| Review | `prf_review` | submission, answers, evidence refs | Only assigned actor can submit; submitted snapshot cannot be overwritten |
| Feedback request | `prf_feedback_request` | assignments, responses | Identity/release obey anonymity and minimum-cohort policy |
| Check-in | `prf_checkin` | agenda, participants, note refs | Private notes never become public by default |
| Calibration session | `prf_calibration_session` | immutable adjustments | Every before/after change has reason, actor, approval and distribution impact |
| Result | `prf_result_set` | participant results, publications, corrections | Publish is distinct from calculate/approve; corrections append |
| Appeal | `prf_appeal` | events, evidence refs | No silent result mutation; resolution links to correction when applicable |

## Data and integration ownership

- HRM owns Person/Worker/Assignment/Organization/Position and publishes snapshot/event contracts.
- Auth owns app entitlement, access packages and atomic permission evaluation inputs.
- Performance owns participant/reviewer population and `PERFORMANCE_PRIVATE` field-policy decision inputs.
- Approval owns approval process instances; Performance retains opaque approval references and consumes final events idempotently.
- Notification owns templates and delivery. Performance publishes notification requests and stores delivery receipt references only.
- Object Storage owns file bodies. Performance stores object ID, content hash, purpose, classification and expiry.
- Platform Automation owns schedules, leases, run control and DLQ. Performance owns versioned job handlers and domain reconciliation.
- Provider/Integration owns connector instances and secrets. Performance owns canonical mapping semantics and domain receipts.

## Extractability constraints

1. All inter-context calls use versioned ports, never repository imports.
2. `prf_*` tables have no foreign keys to `ppl_*`, Auth or platform tables.
3. Every external event is received through an inbox keyed by `(tenant_id,event_id)`.
4. Every committed domain event is inserted into a local outbox in the aggregate transaction.
5. Public identifiers are UUIDs; internal numeric IDs never leave the boundary.
6. API errors, receipts, audit fields and event envelopes remain stable if the package moves to a separate deployable.
7. A future extraction copies only the `prf_*` schema and rebinds existing ports; no consumer contract changes.

## Process decisions

- Stage-specific self/manager/second/third screens become one review workspace driven by assignment and template snapshots.
- Evaluation targets, evaluators, approvers and exceptions become population rules plus a freeze preview.
- MBO, personal goals and organization goals share one goal/alignment model.
- Result adjustment uses calibration sessions; direct result update is forbidden.
- Code tables and formulas become typed/versioned configuration. Arbitrary executable expressions are forbidden.
- Exact customer connectors are extension packs. Missing production contracts do not block core implementation.

## Consequences

Positive consequences are reproducibility, simpler journeys, explicit permission boundaries, immutable evidence and later service extraction. Costs are more explicit snapshot/event contracts, receipt handling and projections. Those costs are accepted because they remove hidden database coupling and production ambiguity.

## Rejected alternatives

- Clone `cloudhr-per` as a new service: rejected because it preserves screen/table coupling and duplicates DWP platform functions.
- Store PER directly with People aggregates: rejected because performance privacy, lifecycle and scale differ and extraction would be costly.
- Externalize Performance immediately: rejected for the first slice because a new deployable adds operational work before the domain contract is proven.
- Treat all source behavior as tenant configuration: rejected because code-owned invariants, state transitions and authorization cannot be delegated to mutable tenant data.

## Activation versus core readiness

Operating menu exports, customer access logs, real provider payloads and production retention decisions are parity/adapter/production activation evidence. They are not required to code and test the generic core against synthetic fixtures. A slice may receive `G2-CODE-GO` when its API, schema, state, authorization and golden contract pass this module validator and the required G2 roles are actually bound.
