# ADR-001 — DWP People SoR, effective dating, and HRM aggregate boundaries

- Status: `READY_FOR_G3_CODE`
- Date: 2026-09-10
- Decision scope: HRIS-HRM only
- Decision owners for G2: `ROLE.HRIS_HRM_PRODUCT_OWNER`, `ROLE.ARCHITECTURE_AUTHORITY`, `ROLE.DBA_AUTHORITY`, `ROLE.SECURITY_AUTHORITY`, `ROLE.PRIVACY_AUTHORITY`
- Gate note: the refreshed integration checkpoint and central engineering validation opened generic-core G3 coding. Named human acceptance remains a G6 production-activation requirement.
- G1 execution binding: backend `5670877de7a39e94e75021c7e23cbbb553296c90` in `.codex-worktrees/hris/g1-20260910/hrm/backend`; frontend `7635ce4223000ed83cb4965f8374d8a8433f1a62` in `.codex-worktrees/hris/g1-20260910/hrm/frontend`. Both are pinned clean to the central coding baseline.

## Context

SKKF distributes equivalent person, employee, organization, code, approval, interface and screen-state concepts across many routes, controllers and entities. Copying this topology would create multiple systems of record and retain direct-update, duplicate common platform, customer branch and cross-module database coupling. DWP already has canonical `ppl_*`, integration, access/export, audit and outbox foundations.

The target must support multiple employers and assignments, historical/future as-of views, governed correction, downstream Time/Payroll/Performance consumption, tenant isolation, purpose-bound sensitive fields, and customer-neutral extension.

## Decision

### 1. System of record

DWP People is the canonical system of record for person, worker, work relationship, assignment, organization, job, grade, position, employment terms, compensation basis, Core HR documents and employment lifecycle events. External HR systems can be authoritative per configured inbound domain during a transition or connector/hybrid deployment, but they write through the same versioned ingestion and domain-command boundary. They never write People tables directly.

### 2. Bounded contexts and code ownership

| Context | Code owner | Data owned |
|---|---|---|
| People | `dwp-people-server/hris/people` | person, names, contacts, identifiers, private/profile sections, worker, bank metadata |
| Employment | `dwp-people-server/hris/employment` | relationship, terms, assignment, assignment event/item, compensation basis, contract, separation case/task |
| Organization | `dwp-people-server/hris/organization` | legal employer/registration, business unit, establishment, organization graph, job/grade/position, scenario projection |
| Employee Service | `dwp-people-server/hris/employeeservice` | employee-change request/evidence, certificate request/issue |
| HR compatibility | `dwp-people-server/hris/compatibility` | legacy/provider semantic mapping, staging decision, inbox receipt and reconciliation view |

Identity, Auth, Approval, Notification, Audit, Object Storage, Scheduler and Integration connectivity remain DWP common-platform responsibilities. HRM stores only their public references, revisions, receipts and business correlation.

### 3. Identity and keys

- Internal joins inside the People physical store use `(tenant_id, bigint_id)` composite keys.
- APIs and events expose UUID `public_id`; no internal sequence appears externally.
- Every business aggregate has a tenant-scoped stable business key and optimistic `version`.
- External mapping uses `(tenant_id, source_system_id, entity_type, external_id)` and a source version/cursor; it is not a second identity master.
- Application-managed sequence controllers are retired. Commands use a unique idempotency key and payload hash.

### 4. Effective time

- All effective-dated records use half-open `[valid_from, valid_to)` periods; `valid_to` is exclusive and nullable for infinity.
- Recorded time (`created_at`/`recorded_at`) and business effective time are distinct.
- The database rejects overlapping slices for single-valued business keys. Adjacent slices are valid.
- Assignment dates must be contained by the work relationship; relationship dates by the legal-employer existence window; referenced organization/job/position/location/grade must be effective on the event date.
- One worker may have multiple relationships and assignments, but overlapping primary relationship/primary assignment is rejected unless a future explicit policy and physical constraint replacement are approved.

### 5. Commands and immutable history

Hire, rehire, assignment, transfer, promotion, leave/return, termination, employee change, contract issue, certificate issue and separation are use-case commands—not generic table CRUD. A command validates the expected version and effective-date conflicts, records a durable receipt, changes the aggregate, appends audit and an outbox message in one transaction, then exposes the updated as-of projection.

Published assignment events, signed/active contracts, issued certificates, completed separation cases, audit and outbox records are immutable. Correction creates a new row with `supersedes_*` or `reverses_*`, reason, actor, approval evidence and correlation. No rollback deletes a published business fact.

### 6. Downstream data contract

TIM, PAY and PER do not read People repositories or use People database foreign keys. They bootstrap from a paged, point-in-time workforce snapshot and thereafter consume owner events. Every event carries event ID, schema version, tenant ID, aggregate public ID/version, occurred time, effective time, causation, correlation and minimized payload. Consumers record inbox event ID/schema version and apply idempotently.

Required events are `PersonChanged.v1`, `WorkerHired.v1`, `EmploymentChanged.v1`, `AssignmentChanged.v1`, `OrganizationChanged.v1`, `CompensationBasisChanged.v1`, `EmploymentContractIssued.v1`, `WorkerSeparated.v1`, `EmployeeChangeApplied.v1`, and `CertificateIssued.v1`.

### 7. Security and privacy

Tenant is derived from authenticated context, never trusted from a request payload. Each query/command passes app entitlement, atomic capability/action, owner population, field group and purpose, effective grant, step-up and SoD checks. Explicit deny wins. A caller cannot search, sort, count, export or receive distinct error detail for an unauthorized field.

Restricted values use envelope encryption and key references; searchable identifiers store a keyed hash and masked suffix, not clear values. Object bytes live in DWP Object Storage. Cache keys include tenant, principal/policy revision, purpose, field projection and as-of date; denied/partially authorized responses containing PII are not shared-cacheable.

### 8. Configuration and extension

Reference values, reason codes, optional profile sections, validation rules, workflows, templates, retention and SLAs are versioned tenant configuration with draft, validation, impact simulation, independent approval, publish and supersede. Country-specific fields/rules require an approved country-pack version. Provider systems are typed adapters. Company-only reward/process behavior is a signed, permission-declared tenant extension. Customer identifiers and branches are forbidden in Core HR.

## Physical-store decision

Initial HRM implementation remains in the People PostgreSQL store so tenant composite foreign keys and atomic outbox/audit commits are available. Logical package boundaries and public contracts are mandatory from the first migration. Cross-context references outside People are opaque public IDs without physical FK. If a People context is later split, an outbox/inbox projection migration precedes removal of local FKs.

The physical proposal strengthens existing tables rather than recreating them. A numbered Flyway migration must be allocated centrally and must include data profiling/remediation before enabling exclusion/immutability constraints. `physical-schema-blueprint.sql` is non-executable design evidence until then.

## Alternatives rejected

| Alternative | Reason rejected |
|---|---|
| Copy all SKKF entities and tables | duplicates owners and imports legacy physical/display state rather than capabilities |
| One microservice per SKKF module | preserves accidental source boundaries and creates synchronous coupling without ownership benefit |
| External HR system remains the only SoR | conflicts with the approved complete DWP HRIS goal and prevents a self-contained generic product |
| Direct update with audit columns | cannot reconstruct effective history or enforce published correction semantics |
| Event sourcing every profile field | disproportionate operational complexity; effective-dated records plus immutable lifecycle events satisfy traceability |
| JSON for all employee attributes | weak constraints, unsafe search and field authorization; typed core tables plus governed custom attributes are used |
| HRM-local auth, workflow, scheduler and object storage | duplicates DWP platforms and weakens governance/SoD |

## Consequences

Positive consequences are one owner per business fact, consistent as-of behavior, smaller stable APIs, reliable downstream lineage, explicit extension boundaries and stronger audit/recovery. Costs are migration data remediation, more explicit commands and state machines, owner-event schema governance, projection lag handling, and stricter product/DBA/Security/Privacy review.

## Migration and rollout constraints

1. Profile existing DWP data for duplicate public/business keys, invalid date boundaries, overlapping primary rows and orphan references.
2. Add nullable public IDs/periods and backfill deterministically; verify counts and checksums.
3. Quarantine unresolved rows; do not coerce or silently drop them.
4. Install constraints `NOT VALID` where PostgreSQL supports it, validate after remediation, then enforce command-only writes.
5. Dual-read and shadow-write only through an explicit compatibility adapter with receipts; no permanent two-master period.
6. Reconcile per tenant and aggregate type: source count, accepted/rejected count, current projection, history slice count and digest.
7. Cut over one capability slice at a time with a forward-correction plan. Published records are never removed by rollback.

## Operational and activation evidence

Core implementation can proceed with the synthetic volume model and fixtures after G2 approval. Actual customer volume, retention, connector contracts, menu export, legacy DDL and parallel-run data are required only for the affected migration/adapter/production activation. They must not be turned into hardcoded defaults or a global core blocker.

## Acceptance criteria

- All 583 parents and 1,654 child behaviors remain traceable with zero unknown disposition.
- One canonical current row is returned for every as-of single-valued fact; invalid overlap is impossible at both service and database boundaries.
- Identical command replay is single-effect; same key/different payload is 409; result-unknown can be recovered from receipt.
- Published facts reconstruct before/after/correction history and produce one semantic outbox event per committed aggregate version.
- Tenant, population, field, purpose, SoD, step-up, export and direct-API negative tests pass.
- Downstream bootstrap/event conformance, inbox replay and reconciliation pass without People DB access.
- No BENSK/ADDSK route, code, table, asset or customer branch enters target runtime.
