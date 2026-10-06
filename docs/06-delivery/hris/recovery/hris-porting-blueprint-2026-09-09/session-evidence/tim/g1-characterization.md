# HRIS-TIM G1 characterization

## 1. Provenance and scope

- Session: `HRIS-TIM`
- Target runtime: new `dwp-time-server`
- Backend checkpoint: `5670877de7a39e94e75021c7e23cbbb553296c90`
- Frontend checkpoint: `7635ce4223000ed83cb4965f8374d8a8433f1a62`
- Worktrees: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/tim/backend` and `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/tim/frontend`
- Source boundary: pinned sanitized `tim` backend and `frontend/packages/tim` views only. No SKKF code, SQL, formula, configuration value, template, binary, dependency, or customer data is reused.
- Interpretation mode: `BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE`.

The 568 parents are inventory lower-bound artifacts, not 568 target screens or tables. Controller and deeper service/job/interface/formula/file/query/state behavior is expanded into 3,566 child traces. A source artifact marked `RETIRE` means its independent route, init endpoint, duplicate store, or customer variant is removed; its useful business question remains linked to the consolidated target capability.

## 2. Coverage summary

| Measure | Count |
|---|---:|
| Parent artifacts | 568 |
| Routes / controllers / entities | 196 / 232 / 140 |
| Decided parents | 568 |
| `UNKNOWN` / `UNASSESSED` | 0 / 0 |
| `REBUILD` | 190 |
| `CONFIGURE` | 164 |
| `REUSE` | 28 |
| `EXTENSION` | 9 |
| `RETIRE` independent artifacts | 177 |
| Consolidated detail/init/duplicate surfaces | 177 |
| Child traces | 3,566 |

Child coverage is 196 menu elements, 2,533 service operations, 16 jobs, 54 interfaces, 82 calculation/rule behaviors, 63 file/document behaviors, 140 persistence/query behaviors, and 482 state transitions. Every child has a parent FK, target capability/API-event/data owner, decision, disposition, owner role, and evidence reference. For every readable controller, mapped-operation trace count is at least its inventory `method_mapping_count`; the blocked template uses an explicit safe substitute rather than inferred methods.

Capability distribution is: schedule 129, overtime 82, leave request 77, timecard 42, leave ledger 32, leave policy 29, KR leave pack 28, interpretation 26, close/handoff 22, analytics 20, dashboard 20, employment absence 14, platform config 13, HRM projection 8, approval 7, connector 7, clock 6, automation 5, and notification 1.

## 3. Actors and authorization

The target personas are employee, manager, Time operator, Leave operator, HRIS settings administrator, integration operator, and enterprise auditor. Navigation is a projection of effective permission; it is never an authorization boundary.

Every command/query is checked by the server-side PEP using:

`APP.HCM/HRIS entitlement ∩ atomic duty ∩ worker/time-group/period population ∩ field-purpose policy ∩ object state ∩ SoD/step-up ∩ installed pack/tenant policy`.

Self-service is limited to the authenticated worker public ID. Manager actions require a live manager/population revision. Operators cannot approve their own corrections or close/reopen actions. Auditors receive read-only, purpose-bound, field-masked projections. Device credentials, medical evidence, location detail, and free-text reasons are not exposed through broad list APIs.

## 4. Journeys and commands

The 196 legacy routes are represented by five work surfaces instead of a flat menu:

1. `내 근태·휴가`: schedule, clock/timecard explanation, requests, balances, documents.
2. `내 팀`: approval inbox, team availability, workload/overtime alerts.
3. `근태 운영`: exception workbench, bulk validation, daily/monthly close, payroll handoff and reconciliation.
4. `근태 설정`: work rules, schedules/rotations, leave plans, calendars, connector assignments.
5. `근태 인사이트`: governed drill-down and export.

The first vertical slice is `schedule → raw clock → interpretation → exception/correction → submit → manager decision → close → Payroll handoff receipt`. Detail and popup routes become panels, drawers, inspectors, or wizard steps. Init controllers become typed bootstrap queries. The HRIS home receives actionable Time/Leave widgets; the full work catalog is a separate explorer.

## 5. Validation, state, and exceptions

- Raw clocks: append-only `RECORDED → VOIDED` by a separate void event; never overwrite.
- Interpretation attempt: `QUEUED → RUNNING → SUCCEEDED | FAILED | RESULT_UNKNOWN`; retry creates a new attempt.
- Timecard: `OPEN → SUBMITTED → APPROVED | REJECTED → LOCKED`; edits after lock require correction/reopen.
- Request: `DRAFT → SUBMITTED → APPROVED | REJECTED | CANCELLED`; approved cancellation posts reversing ledger entries.
- Period: `OPEN → VALIDATING → CLOSING → CLOSED → REOPEN_REQUESTED → REOPENED → CLOSED`.
- Payroll handoff: `PENDING → SENT → ACKNOWLEDGED | REJECTED | RESULT_UNKNOWN` with stable payload digest.

Commands require tenant-scoped `Idempotency-Key`; existing aggregate mutations require `expectedVersion`. Guard failures return typed 409/422 outcomes. A result-unknown response never becomes fake success: the caller resolves it through durable receipt lookup. Closed facts are corrected with reversal/supersession lineage, not update/delete.

## 6. Data ownership and retention

`dwp-time-server` owns schedules, clock events, interpretation, timecards, exceptions, work/leave requests, entitlement/time ledgers, close revisions, and Payroll handoff receipts. People owns worker, employment, assignment, workplace and absence/employment lifecycle. Time stores only a minimal versioned public-ID projection and has no People DB FK or direct query. Payroll receives only approved/closed aggregates, never raw punches.

Clock and ledger facts are immutable. Projections are rebuildable. Retention is versioned by tenant, jurisdiction and record class; legal hold suspends purge. Medical/evidence objects use separate classifications and object references. Precise location is not collected merely for productivity monitoring.

## 7. Batch, interface, and document behavior

The DWP Admin automation control plane owns catalog, tenant schedule, operator assignment, execution view and DLQ/replay. `dwp-time-server` owns signed handlers, domain locks, checkpoint, reconciliation and receipt. Job class/method names are never tenant-configurable executable input.

Clock and legacy workforce connections use a canonical adapter contract with secret references, endpoint allowlists, mapping versions, cursors, idempotency, quarantine and receipts. Actual vendor schemas and samples gate only that adapter's activation. Time-generated documents and notification templates use DWP Object Storage/Notification references and digests; no legacy asset is copied.

## 8. Redundancy and process improvements

- Multiple weekday/holiday/pre/post/fixed overtime screens become a single policy-driven request and exception flow.
- Employee, manager, group, block and cancellation leave screens become one role-aware request workspace.
- Mutable daily/monthly records become raw facts, replayable interpretation, immutable ledgers and projections.
- Direct balance edits become grant/use/release/adjust/expire/carryover/reversal entries.
- Separate close and send actions become one guarded command center with validation blockers and receipt reconciliation.
- Duplicate inquiry/report screens become governed insights with drill-down, freshness and export controls.
- Screen-specific init endpoints and duplicate common tables are removed.

These changes preserve business questions while reducing route count, privilege ambiguity, silent side effects and recovery risk.

## 9. Generic core, country pack, and tenant extension

- Core: raw clock, interpretation engine, timecard/request lifecycle, ledgers, close/reopen/correction, handoff, authorization and reconciliation.
- Tenant configuration: work patterns, overtime/leave rules, calendars, approval policies and effective assignments.
- Optional country pack: KR maternity/childcare/annual-promotion and other statutory policies, activated only with official effective-law golden evidence.
- Extension: clock/vendor/legacy adapters and signed customer extensions.
- Retired: BENSK/ADDSK customer branches, standalone detail/init aliases, mutable duplicate stores and unsafe executable job configuration.

The TIM shard contains no BENSK parent. The detected ADDSK access-batch behavior is explicitly retired at child level; only the generic access-event adapter contract remains. It cannot become a tenant conditional in core.

## 10. Target contract proposals

The proposed G2 package comprises:

- `g2-service-boundary.md`: service/runtime ownership and deployment boundary.
- `g2-physical-schema.sql`: PostgreSQL physical blueprint with tenant keys, public IDs, effective dates, immutable ledgers, indexes and state constraints.
- `g2-api-event-contracts.json`: command/query/event/receipt envelope and versioning contract.
- `g2-runtime-controls.md`: state, guard, CAS, idempotency, recovery, telemetry and cutover rules.
- `g2-authorization.md`: capability/action/population/field/SoD policy.
- `synthetic-golden-fixtures.json` and `synthetic-golden-spec.md`: customer-free golden oracle.
- `validate_readiness.py`: deterministic cross-file readiness validator.

These are code-ready proposals after Integration Control validation; they do not themselves claim production, statutory-pack, or connector activation approval.

## 11. Unknowns and decisions

All 568 source parents have a G1 product disposition. There is no unresolved source classification. Sixteen decisions in `g1-decision-log.csv` close the core product boundary, consolidation, immutability, configuration, authorization, automation, connector, home-widget and safe-substitute questions.

The security-blocked mail-template artifact was not read or reconstructed. Its business need is satisfied by the safe DWP Notification contract, so source parity for that asset is intentionally not claimed. Vendor clock schemas, actual customer volumes, KR legal rates/effective dates and production retention values remain activation/deployment inputs, not blockers to core code. They must not be represented as guessed product defaults.

## 12. Synthetic characterization tests

The executable specification must cover at least:

- `TIM-GOLD-001`: overnight shift across local midnight.
- `TIM-GOLD-002`: DST gap/overlap with preserved local offset and deterministic minutes.
- `TIM-GOLD-003`: duplicate, delayed and out-of-order clock events.
- `TIM-GOLD-004`: configurable overtime threshold and approval without embedding statutory values.
- `TIM-GOLD-005`: leave grant/use/cancel/reversal and projection replay.
- `TIM-GOLD-006`: concurrent timecard submit/approve using expected version.
- `TIM-GOLD-007`: close blocker, maker/checker, reopen and correction lineage.
- `TIM-GOLD-008`: Payroll handoff duplicate/reject/result-unknown recovery.
- `TIM-GOLD-009`: cross-tenant, out-of-population, self-approval and masked-field negative cases.
- `TIM-GOLD-010`: disabled KR pack and disabled connector fail closed without blocking core flows.

Expected outcomes are stored in the synthetic fixture, not inferred from SKKF output. Country/provider production activation adds independently approved golden packs.
