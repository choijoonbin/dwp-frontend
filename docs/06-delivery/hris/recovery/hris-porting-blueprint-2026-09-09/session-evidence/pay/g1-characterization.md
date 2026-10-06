# HRIS-PAY G1 characterization

## 1. Provenance and scope

- Session: `HRIS-PAY`
- Target runtime: new `dwp-payroll-server`
- Backend checkpoint: `5670877de7a39e94e75021c7e23cbbb553296c90`
- Frontend checkpoint: `7635ce4223000ed83cb4965f8374d8a8433f1a62`
- Worktrees: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/pay/backend` and `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/pay/frontend`
- Source boundary: pinned sanitized `pay` backend and `frontend/packages/pay|yea` views only. No SKKF code, SQL, formula, configuration value, template, binary, dependency, or customer data is reused.
- Interpretation mode: `BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE`.

The 580 parents are inventory artifacts, not 580 target screens/tables. Controller and deeper service/job/interface/formula/file/query/state behavior is expanded into 3,515 child traces. The absent YEA backend is not guessed: its 34 routes map to a provider-neutral hybrid case contract whose calculation/filing implementation is optional and activation-gated.

## 2. Coverage summary

| Measure | Count |
|---|---:|
| Parent artifacts | 580 |
| Routes / controllers / entities | 223 / 199 / 158 |
| PAY / YEA source parents | 546 / 34 |
| Decided parents | 580 |
| `UNKNOWN` / `UNASSESSED` | 0 / 0 |
| `REBUILD` | 227 |
| `CONFIGURE` | 121 |
| `REUSE` | 28 |
| `EXTENSION` | 57 |
| `RETIRE` independent artifacts | 147 |
| Consolidated detail/init/customer-variant surfaces | 147 |
| Child traces | 3,515 |

Child coverage is 223 menu elements, 2,240 service operations, 13 jobs, 54 interfaces, 213 formula/rule behaviors, 104 file/document behaviors, 158 persistence/query behaviors, and 510 state transitions, for 3,515 children in total. Every child has a parent FK, target capability/API-event/data owner, decision, disposition, owner role and evidence reference. For every readable controller, mapped-operation trace count is at least its inventory `method_mapping_count`; the blocked template uses an explicit safe substitute rather than inferred methods.

Capability distribution is: retirement 119, worker input 91, element/formula 63, retro/off-cycle 48, KR insurance 34, YEA hybrid 34, result/trace 32, run preparation 23, payslip 20, Time projection 19, KR tax 16, foundation 13, platform config 13, calculation 12, payment 7, notification 7, connector 7, dashboard 7, HRM projection 6, automation 5, and statutory deduction 4. Canonical accounting is an intentional target enhancement even though no trustworthy independent legacy parent represents it.

## 3. Actors and authorization

The target personas are employee, Payroll maker, Payroll checker, Payroll configuration administrator, Payroll statutory operator, Finance/integration operator, HRIS settings administrator, and enterprise auditor.

Every command/query is checked by the server-side PEP using:

`APP.HCM/HRIS entitlement ∩ atomic duty ∩ legal payroll entity/pay-group/period/worker population ∩ field-purpose policy ∩ object state ∩ maker/checker SoD/step-up ∩ installed country/provider pack`.

Run preparation, calculation, validation, approval, finalization, payment release, bank-file download, accounting posting, bank-account change and export are distinct duties. A maker cannot approve/finalize the same run; a bank-account changer cannot release its payment; an operator cannot widen population via request payload. Employees can access only their published statements and case tasks.

## 4. Journeys and commands

The 223 legacy routes are represented by role-aware work surfaces:

1. `급여 홈`: employee latest statement/tax tasks; operator run status, blockers and exceptions.
2. `급여 설정`: payroll entities/groups/calendars/periods, elements, typed formulas and policies.
3. `급여 입력`: effective-dated fixed/variable/exception/rate entries and bulk validation.
4. `급여 실행`: prepare, snapshot, calculate, validate, compare, approve and finalize command center.
5. `예외·계산추적`: worker/element intermediate trace, control totals and reconciliation.
6. `소급·비정기`: impact detection, differential run, correction and reversal.
7. `법정·퇴직·연말정산`: optional country/provider case workspace.
8. `지급·회계`: canonical payment and GL batches, adapter receipts and reversals.
9. `명세·인사이트`: published payslips, governed reports and exports.

Detail/init routes become panels, drawers, inspectors or wizard steps. No route count is reproduced as navigation. Payroll widgets contribute core information and tasks to HRIS home; the product catalog stays in a separate explorer.

## 5. Validation, state, and exceptions

- Configuration: `DRAFT → VALIDATED → APPROVED → PUBLISHED → RETIRED`; a published version is immutable.
- Run: `PREPARING → READY → CALCULATING → VALIDATED → APPROVED → FINALIZED → PAYMENT_PENDING | POSTING_PENDING → CLOSED`.
- Attempt: `QUEUED → RUNNING → SUCCEEDED | FAILED | RESULT_UNKNOWN`; retry creates a new attempt.
- Payment: `DRAFT → VALIDATED → APPROVED → RELEASED → ACKNOWLEDGED | REJECTED | RESULT_UNKNOWN → REVERSED`.
- GL: `DRAFT → BALANCED → APPROVED → SENT → POSTED | REJECTED | RESULT_UNKNOWN → REVERSED`.
- YEA case: `OPEN → COLLECTING → READY → SUBMITTED_TO_PROVIDER → CALCULATED → REVIEWED → FILED | CORRECTION_REQUIRED → CLOSED`.

All commands use tenant-scoped `Idempotency-Key`; existing aggregates require `expectedVersion`. Frozen snapshot, formula version, currency/scale, rounding stage, target population and period state are validated before execution. A result-unknown response is resolved from the durable receipt and external reconciliation rather than treated as success or retried blindly.

## 6. Data ownership and retention

`dwp-payroll-server` owns payroll foundation, worker payroll entries, tax profiles/payment instructions, input snapshots, run/attempt/worker/result/trace/balance ledgers, approvals, reconciliation, payment/GL canonical batches, payslips, statutory cases and provider receipts.

People owns worker/employment/assignment/compensation basis/dependent identity and verified bank-account token source. Time owns closed time/absence results. Payroll consumes minimal effective-dated public-ID projections/events and accepted handoffs; it has no upstream DB FK or direct query. Plain bank accounts, resident identifiers and connector secrets are not stored in general Payroll tables.

Finalized monetary facts and audit bundles are immutable. Retention is policy-versioned by jurisdiction and record class, supports legal hold, and prevents purge while filing/payment/GL reconciliation is unresolved. Access/download/export evidence is retained separately from mutable UI projection.

## 7. Batch, interface, and document behavior

DWP Admin owns the generic job catalog, tenant schedules, execution center and DLQ/replay UI. Payroll owns signed handlers, run locks, checkpoints, domain retry rules and receipts. Tenant input selects only a published job key and schema-validated parameters, never a class/method or executable expression.

People/Time, bank, ERP, tax/insurance authority and YEA providers use typed versioned adapters with secret references, endpoint allowlist, schema/mapping version, cursor, idempotency, retry/DLQ and reconciliation. Actual partner contracts, samples, credentials and SLAs gate only adapter activation.

Payslips, bank files and statutory documents use object references, digests, classification, expiry and immutable access/download audit. Design/test fixtures contain no actual salary, bank, identifier or tax data.

## 8. Redundancy and process improvements

- Foundation, elements, formulas and scattered standards become typed effective-dated configuration with simulation/publish lifecycle.
- Input, calculation, state and result screens become a run command center plus exception/worker-trace workbench.
- Dynamic/free formula execution becomes a bounded typed DSL with units, currencies, allowlisted functions, graph checks and resource limits.
- Delete/recreate results become frozen snapshots and append-only attempts/results/balance corrections.
- Manual close/send ambiguity becomes guarded states, control totals, receipts and result-unknown recovery.
- Customer-specific SK2/SKC/KF/ADDSK reports/transports become retired artifacts or signed adapters, never core branches.
- Direct bank/ERP/YEA coupling becomes canonical payload plus pluggable adapter/provider.
- Duplicate reports become governed drill-down insights with masking and export controls.

## 9. Generic core, country pack, and tenant extension

- Global core: payroll foundation, typed formula runtime, snapshots, regular/retro/off-cycle runs, results/traces/balances, approvals, payslips, reconciliation, canonical payment/GL models.
- Tenant configuration: pay groups/calendars/elements/eligibility/formulas/rounding/mappings with effective dates and publish governance.
- Optional country pack: KR tax, social insurance, retirement and statutory report behavior. Official rules and outputs gate only pack activation.
- YEA hybrid: DWP case/evidence/status/reconciliation core plus pluggable provider or optional native KR calculation/filing pack.
- Extension: actual bank/ERP/authority/YEA/provider adapters and signed customer extensions.
- Retired: BENSK/ADDSK branches, customer-named DTOs, standalone detail/init routes and unsafe dynamic execution.

The PAY shard contains no BENSK parent. All 12 registered ADDSK-contaminated files are traced: customer DTO/branch behavior retires; only generic canonical connector/notification/schedule/retirement semantics survive. SK2/SKC/KF variants are extension-or-retire and never product defaults.

## 10. Target contract proposals

The proposed G2 package comprises:

- `g2-service-boundary.md`: `dwp-payroll-server` bounded context and upstream/platform/provider contracts.
- `g2-physical-schema.sql`: PostgreSQL physical blueprint for configuration, snapshots, run/result/ledger, payment/GL, country pack and YEA provider receipts.
- `g2-api-event-contracts.json`: commands, queries, events, envelopes and durable receipts.
- `g2-runtime-controls.md`: formula sandbox, state, guards, CAS, idempotency, recovery, reconciliation and observability.
- `g2-authorization.md`: duties, scopes, fields, SoD and step-up.
- `synthetic-golden-fixtures.json` and `synthetic-golden-spec.md`: customer-free expected outcomes and activation placeholders.
- `validate_readiness.py`: deterministic cross-file readiness validator.

These are code-ready proposals after Integration Control validation; they do not certify statutory math, production bank/ERP/YEA adapters, or a customer cutover.

## 11. Unknowns and decisions

All 580 parents have a G1 product disposition; there is no unresolved source classification. Eighteen decisions close the product boundary, UX consolidation, formula runtime, ledgers, upstream inputs, state/SoD, connector activation, KR pack, YEA hybrid, contamination, platform reuse, security, retention, widgets and baseline.

The security-blocked mail-template artifact was not accessed or reconstructed. Its known notification need maps to DWP Notification as a safe substitute. YEA legacy calculation parity is not claimed because no backend is present. Current laws/rates/forms, actual customer volume/retention, actual partner schemas/keys and customer parallel-pay results are activation or production-cutover inputs; none may be guessed or hardcoded into core.

## 12. Synthetic characterization tests

The executable specification must cover at least:

- `PAY-GOLD-001`: deterministic regular run with gross, deductions and net control totals.
- `PAY-GOLD-002`: formula dependency ordering, cycle/type/unit rejection and configured rounding.
- `PAY-GOLD-003`: duplicate command and crashed-at-commit result-unknown receipt recovery.
- `PAY-GOLD-004`: retro differential result and append-only balance reversal.
- `PAY-GOLD-005`: off-cycle run isolated from the regular period.
- `PAY-GOLD-006`: maker/checker, stale version and pay-group population negative cases.
- `PAY-GOLD-007`: canonical payment amount/digest and rejected/unknown bank receipt reconciliation.
- `PAY-GOLD-008`: balanced GL lineage and posting/reversal receipt.
- `PAY-GOLD-009`: published payslip digest, revoke and step-up access audit.
- `PAY-GOLD-010`: disabled KR pack/YEA/provider fails closed while global core run remains usable.
- `PAY-GOLD-011`: YEA provider duplicate/correction receipt without embedding a statutory formula.
- `PAY-GOLD-012`: cross-tenant, masked field, export purpose and bank-token negative cases.

Expected outcomes are synthetic and independent. A statutory/provider/customer activation adds an approved pack-specific oracle without changing core fixtures.
