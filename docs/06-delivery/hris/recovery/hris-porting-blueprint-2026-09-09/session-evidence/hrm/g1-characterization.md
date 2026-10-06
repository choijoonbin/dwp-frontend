# HRIS-HRM G1 characterization

## 1. Provenance and scope

- Session: `HRIS-HRM`
- Source mode: `BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE`
- HRM source commit/tree: `c8654c2132294cf79d2974cb727b31dae0eacc88` / `0ed80487f0d5f6b733bfdf3cfced867a6f72bf4a`
- G1 target binding: backend `5670877de7a39e94e75021c7e23cbbb553296c90` at `.codex-worktrees/hris/g1-20260910/hrm/backend`; frontend `7635ce4223000ed83cb4965f8374d8a8433f1a62` at `.codex-worktrees/hris/g1-20260910/hrm/frontend`. Both dedicated worktrees are pinned clean to the central coding baseline.
- Analysis boundaries: the pinned HRM and frontend sanitized views registered by G0. The raw SKKF checkout, excluded paths, executable assets, source SQL, formulas, credentials, and customer data were not opened or copied.
- Target: DWP People is the canonical Core HR system of record. This characterization recovers business meaning; it does not preserve legacy screen, controller, entity, or table topology.
- Scope includes people, employment, assignments, appointments, organization, workplaces, profile sections, employee changes, contracts, certificates, separation, HR semantic integration, and the HRM-owned data contracts used by home widgets.
- Two BENSK routes remain in the trace solely to prove exclusion. No ADDSK or BENSK behavior is admitted to Core HR.

## 2. Coverage summary

The HRM shard and its child trace are closed with no unassessed source artifact.

| Measure | Count |
|---|---:|
| Parent source artifacts | 583 |
| Routes | 193 |
| Controllers | 246 |
| Entities | 144 |
| Decided parents | 583 |
| `UNKNOWN` parents | 0 |
| `UNASSESSED` parents | 0 |
| `REUSE` | 112 |
| `REBUILD` | 312 |
| `CONFIGURE` | 87 |
| `EXTENSION` | 49 |
| `RETIRE` | 23 |
| BENSK retired | 2 |
| Child behavior traces | 1,654 |

The child trace contains 193 menu elements, 907 service operations, 5 jobs, 44 interfaces, 20 formula behaviors, 59 file/document behaviors, 144 SQL/persistence behaviors, and 282 state-transition traces. Every parent has at least one child, every child has a parent FK, and all children have a decision, owner role, sanitized provenance fingerprint, target capability, target contract, and acceptance evidence reference.

“Consolidation” is a process change rather than an extra disposition: the source rows remain individually traceable while multiple routes/controllers/entities map N:M to People 360, employment lifecycle, organization workbench, employee-service queue, or HRIS widgets. “Reimplementation” is represented by `REBUILD` under the no-code-reuse policy.

## 3. Actors and authorization

HRM uses DWP product access packages and owner-service PEP; it does not recreate SKKF menu ACLs.

| Actor | Permitted work | Mandatory boundary |
|---|---|---|
| Employee | View own profile/employment; create own typed change or certificate request | `APP.HCM:VIEW` compatibility entitlement, SELF population, field projection |
| Line manager | View authorized reports and request scoped workforce changes | live direct-report/delegation relation; no sensitive fields by default |
| HR operator | Search People 360; prepare employment, appointment, contract, and separation work | legal entity/org tree/named population; purpose-bound fields |
| HR lifecycle approver | Decide high-risk people changes | separate maker/checker; step-up; cannot approve own command |
| HR sensitive-data reader | View specifically approved restricted fields | named population, purpose, time-bound grant, access log, step-up |
| HR configuration administrator | Author or publish reference/workflow/document policies | author/publisher separation; impact preview; immutable published version |
| Integration operator | Run/reconcile authorized connectors | connection scope; no direct People-table write; no secret disclosure |
| Enterprise auditor | Read immutable decision, access, export, job, and change evidence | read-only, masked business content unless separately authorized |

Authorization is the intersection of app entitlement, atomic capability/action, target population, field group and purpose, effective time, step-up, and SoD. Explicit deny wins. Menu projection and client-side hiding are usability controls only; API and repository PEP must repeat the decision.

Minimum HRM field groups are `DIRECTORY`, `EMPLOYMENT`, `ORGANIZATION`, `CONTACT`, `PERSONAL_IDENTIFIER`, `FAMILY_DEPENDENT`, `EDUCATION_CAREER`, `QUALIFICATION`, `SERVICE_ACCESSIBILITY`, `COMPENSATION`, `BANK_PAYMENT`, and `DOCUMENT_CONTENT`. Responses use `VIEW`, `MASK`, or `OMIT`; unauthorized search, sort, aggregate, export, and error detail are also suppressed to prevent inference.

## 4. Journeys and commands

The target information architecture replaces source page proliferation with these journeys.

1. **People 360:** scoped search → as-of person/worker/assignment view → section-level evidence/history → permitted action. Repeated personal, family, education, career, language, qualification, reward, discipline, service, and accessibility pages become effective-dated sections, not independent menu entries.
2. **Hire/rehire and assignment:** create case → validate identity/employer/position/period → preview downstream impact → approval → publish effective event → audit/outbox → as-of reread.
3. **Appointment:** create individual or bulk proposal → validate period/primary assignment/org/position → maker review → independent approval → publish immutable assignment event → correction through a new superseding command.
4. **Employee change:** create a typed patch and evidence → submit → route to DWP Approval → approve/reject → atomically apply at effective date → notify and expose receipt. Attribute-specific source request screens share one queue and diff viewer.
5. **Organization and workforce design:** query the current graph as of a date → create scenario → validate cycles, dates, position and staffing impact → approve → publish one organization revision and events.
6. **Contract and compensation basis:** select an approved template version and population → preview → issue immutable snapshot → sign/decline → activate/expire/supersede. Compensation basis is a payroll input, never a payroll result.
7. **Certificate/document:** request → validate purpose/template → generate in controlled object storage → issue digest/verification token → download with audit → expire or revoke.
8. **Exit/return:** plan case and dates → validate active assignments and downstream dependencies → approve → execute tasks/handoffs → complete; reversal or rehire is a new linked case.

All mutating endpoints require an idempotency key, expected aggregate version, authenticated tenant, public target ID, correlation ID, and explicit effective date where business state changes over time. Bulk operations return per-item results and never convert partial failure into a false success.

## 5. Validation, state, and exceptions

Core invariants are:

- A public ID resolves only inside the authenticated tenant; cross-tenant and unauthorized targets are non-disclosing.
- Effective periods use half-open `[valid_from, valid_to)` semantics. Adjacent periods are allowed; overlap for the same business key is rejected.
- A worker has at most one active primary relationship, and a relationship has at most one active primary assignment for an overlapping period unless a separately approved global policy states otherwise.
- Assignment dates must be inside the relationship period; organization, position, location, grade, and job references must be effective on the event date.
- Published events, signed contracts, issued certificates, completed separation evidence, audit records, and outbox messages are immutable. Corrections append a linked superseding/reversal record.
- Maker cannot approve their own high-risk change; publisher cannot publish their own policy; an integration author cannot execute their own unreviewed mapping.
- Sensitive fields require field-level purpose and optional step-up even when the actor can view the worker row.

Canonical lifecycle machines are defined in `state-guard-idempotency-recovery.md`. API outcomes distinguish 400 schema failure, 401 authentication, 403 capability/purpose/field denial, non-disclosing 404, 409 stale version/effective overlap/idempotency mismatch, 422 domain rule failure, 423 locked aggregate/period, 429 throttling, and 5xx with a durable result-unknown receipt. Retrying a command with the same key and payload returns the original receipt; the same key with another payload is rejected.

## 6. Data ownership and retention

- `dwp-people-server/hris/people`: person, name, private identifiers, contacts, profile sections, worker identity, bank metadata, and People projections.
- `dwp-people-server/hris/employment`: relationships, terms, assignments, assignment events, compensation basis, contracts, and separation cases.
- `dwp-people-server/hris/organization`: legal employer, registration, business unit, establishment, organization graph, job, grade, position, and approved scenario projection.
- `dwp-people-server/hris/employeeservice`: employee-change requests/evidence and certificate issue lifecycle.
- `dwp-people-server/hris/compatibility`: HR semantic mapping, ingestion validation, cursor, quarantine, and reconciliation; it does not own provider connectivity secrets.
- DWP Platform/Auth/Approval/Notification/Audit/Object Storage retain ownership of their common concerns. HRM keeps opaque public references, revisions, receipts, and business correlation only.

Downstream TIM, PAY, and PER never join the People database. They consume versioned bootstrap snapshots and events keyed by tenant and public ID. HRM publishes `PersonChanged`, `WorkerHired`, `EmploymentChanged`, `AssignmentChanged`, `OrganizationChanged`, `CompensationBasisChanged`, and `WorkerSeparated`; each message carries schema version, occurred/effective time, aggregate version, causation, correlation, and a data-minimized payload.

Retention is policy-driven by record class and jurisdiction. Identity, bank, accessibility, disciplinary, contract, and document content is encrypted and purpose-limited; search indexes contain no clear restricted value. Legal hold pauses destruction. Destruction produces an immutable receipt without preserving the deleted payload. Exact production periods remain activation settings reviewed by Privacy/Legal, not source-code constants.

## 7. Batch, interface, and document behavior

The source exposes batch, data synchronization, several provider interfaces, and document workflows. The target treatment is:

- One central `DWP 관리자 > 자동화` control plane owns schedules, execution views, retry/DLQ, alerts, and operator policy. HRM registers code-owned, signed and versioned job manifests; the domain service still validates and executes HR semantics.
- Provider-neutral ingestion accepts validated envelopes, resolves versioned mappings, records an inbox receipt, stages errors without restricted payload leakage, applies idempotently, advances a cursor only after commit, and records reconciliation counts/digests.
- KeyFoundry, Kolon, Workday, ERP, and future company systems are typed provider adapters. No provider/customer branch or credentials enter Core HR.
- Documents use an approved template version, generation input snapshot, object reference, content digest, classification, signer/seal evidence, issue/revoke/expiry state, retention class, and access audit. The database never stores ad hoc file-system paths or public URLs.
- The two security-blocked artifacts remain unopened. Metadata export is replaced by governed typed metadata import/export, and mail-template assets by DWP schema-validated notification templates. This closes target design without claiming unknown legacy behavior.

Real connector specifications, sandbox credentials, customer schedules, and production volume data are activation inputs for the relevant adapter/job, not blockers to the generic HRM core.

## 8. Redundancy and process improvements

- Consolidate source list/detail/tab routes into stable work surfaces; detail, wizard, preview, and inspector state are workflow surfaces rather than sidebar entries.
- Replace module-local person/employee/organization copies with one DWP SoR and versioned projections.
- Replace direct CRUD for appointment, employment status, change requests, contracts, and separation with effective-dated commands and corrective history.
- Replace attribute-specific change queues with typed patch schema, common diff/evidence, policy routing, one approval receipt, and atomic apply.
- Replace source approval-line engines, users, portal, notifications, file delivery, audit, and scheduler copies with DWP common platforms.
- Replace application-side numeric sequence allocation with internal database identity plus public UUID and idempotency key.
- Replace generic URI relay and raw file paths with allowlisted adapters and authorized object references.
- Replace full reload and duplicated interface tables with mapping versions, cursors, inbox idempotency, quarantine, replay, and count/digest reconciliation.
- Replace standalone publishing/statistics pages with role-aware HRIS home widgets. The home is a task/information dashboard; the 76-node work catalog belongs in a separate explorer.
- Retire samples, loading demos, duplicate portal routes, cross-module presentation copies, and BENSK surfaces.

## 9. Generic core, country pack, and tenant extension

| Layer | HRM content |
|---|---|
| Product core | person/worker/relationship/assignment, organization graph, lifecycle cases, profile sections, evidence, documents, owner events, quality and reconciliation contracts |
| Country pack | registration field sets, statutory classifications, labor-document requirements, jurisdictional retention and localized validations; inactive without an approved effective version |
| Tenant configuration | reference values, organization types, appointment reasons, workflow, template, validation, SLA, retention and optional profile sections; effective-dated and published |
| Provider adapter | Workday/ERP/time/identity or legacy HR transport and mapping; conformant to generic ingestion contracts |
| Signed tenant extension | genuinely company-specific benefit/reward/process behavior such as the recovered fuel-support surface; declared permissions and revocable installation |
| Retired/excluded | BENSK, ADDSK, samples, duplicate portal/publishing/loading surfaces and unsafe utility mechanisms |

No tenant name, company ID, pay group, organization code, form, approval line, job schedule, field visibility, retention period, or provider URL may be hardcoded in product logic.

## 10. Target contract proposals

The module-specific G2 proposal is complete in `session-evidence/hrm/g2-readiness/`:

- `README.md`: verified execution baseline/worktree binding, package index, current gate boundary and central coordinator closeout actions.
- `adr-001-people-sor-effective-dating.md`: system ownership, bounded contexts, effective dating, correction and downstream contract decisions.
- `physical-schema-blueprint.sql`: PostgreSQL-oriented physical schema proposal with tenant composite integrity, half-open range exclusions, immutable lifecycle records, command receipts, indexes and retention metadata. It is a reviewed blueprint, not a numbered Flyway migration.
- `api-event-contracts.v1.json`: versioned query, command, receipt, snapshot and event contracts.
- `state-guard-idempotency-recovery.md`: state machines, guards, idempotency, outbox/inbox, async recovery and reconciliation.
- `authorization-field-policy.csv`: persona/duty/capability/population/field/purpose/SoD/step-up owner-PEP policy.
- `synthetic-golden-fixtures.json` and `synthetic-golden-spec.md`: customer-independent oracle cases.
- `validate_hrm_readiness.py`: structural and semantic readiness validator.

These proposals passed the refreshed integration checkpoint and central contract review, so generic-core HRM G3 coding is open. Named human acceptance is required at G6 production activation, not for implementation against synthetic contracts.

## 11. Unknowns and decisions

Source disposition has no remaining `UNKNOWN` or `UNASSESSED` row. Fifteen design decisions are recorded as `DECIDED` in `g1-decision-log.csv` based on the user-approved product direction and existing master contracts. The earlier pre-integration G0 failure was superseded by the sealed full-coding checkpoint; `g0/validate_code_checkpoint.py` is the current fail-closed authority.

The following are activation/parity evidence, not generic-core design blockers:

- An operating menu/program/permission export is needed only to reproduce a particular SKKF tenant or prove cutover parity; DWP menu and permission administration is native.
- Operating DDL and batch history are not required to clone tables. They are useful only for customer data migration sizing, parity and production runbook validation.
- Actual ERP/bank/tax/insurance/time-clock contracts are required per adapter activation, not to build the adapter framework.
- Customer production data is not required for the synthetic oracle. An anonymized customer parallel-run dataset is required for that customer’s migration acceptance.
- Statutory formulas, effective dates, rounding and filings require an approved country pack before activation; HRM core exposes extension points but invents none.

Cross-module controls—sealed integration baselines, worktree/checksum registers, master-coverage merge, shared authorization/event registry, migration allocation and build-matrix replay—are owned by Integration Control and are now closed for generic-core G3. Named human ACK remains separate and blocks only G6 production activation.

## 12. Synthetic characterization tests

| ID | Characterization | Expected result |
|---|---|---|
| HRM-GOLD-001 | Query one worker before, on, and after a future assignment boundary | Exactly the historically correct organization/position; no inclusive-end duplication |
| HRM-GOLD-002 | Add a secondary assignment while a primary assignment exists | Allowed when periods and relationship policy pass; primary remains singular |
| HRM-GOLD-003 | Add an overlapping primary assignment | Rejected with 409 and no partial write/outbox |
| HRM-GOLD-004 | Submit a personal contact change, approve by another actor, apply at a future date | Stable receipt; old value before date; new masked projection on/after date |
| HRM-GOLD-005 | Maker attempts to approve their own employment change | 403/SoD denial and immutable denied-access audit |
| HRM-GOLD-006 | Replay identical command with identical idempotency key | Original status/result returned; one aggregate change and one semantic event |
| HRM-GOLD-007 | Reuse idempotency key with a changed payload | 409 idempotency mismatch; no data change |
| HRM-GOLD-008 | Publish a transfer with a stale expected version | 409 stale version; caller receives current ETag and safe rebase guidance |
| HRM-GOLD-009 | Correct a published transfer | Original remains immutable; linked correction produces the reconstructed as-of history |
| HRM-GOLD-010 | Query another tenant’s public ID | Non-disclosing 404, no cache entry containing protected data, denial audit |
| HRM-GOLD-011 | Search by a field the actor can only MASK/OMIT | Query rejected or privacy-safe projection; no existence/count inference |
| HRM-GOLD-012 | Issue then revoke a certificate | Stored object digest and issue evidence remain; future download denied; revocation auditable |
| HRM-GOLD-013 | Provider delivers the same event twice and then an out-of-order version | Duplicate acknowledged once; out-of-order quarantined; cursor and counts remain coherent |
| HRM-GOLD-014 | One item fails in a bulk appointment proposal | Per-item failure and durable receipt; no false all-success response |
| HRM-GOLD-015 | Home workforce widget dependency times out | Other widgets render with freshness; failed widget shows retryable partial state without leaking fields |

The machine-readable fixtures contain only invented tenants, public IDs, codes, dates, hashes and encrypted-value placeholders. They are a versioned product test oracle, not an example of operational customer configuration.
