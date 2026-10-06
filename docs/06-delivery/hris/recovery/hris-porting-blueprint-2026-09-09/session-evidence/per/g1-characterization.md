# HRIS-PER G1 Characterization

## Provenance and scope

- Session: `HRIS-PER`
- Target runtime owner: `dwp-people-server/hris/performance`
- Backend G1 baseline: `5670877de7a39e94e75021c7e23cbbb553296c90`
- Frontend G1 baseline: `7635ce4223000ed83cb4965f8374d8a8433f1a62`
- Worktrees: `.codex-worktrees/hris/g1-20260910/per/{backend,frontend}`
- Governed source views: `view:per` digest `e841baef961f22777c1bafc318c43224ee30ed0d97cc790b8a16104f1d564054`, `view:frontend` digest `2604fb73e68233581335092ff20baefdc6cf7d40fc193eebc5dd4de834c84c3a`
- Analysis mode: `BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE`. Source expressions, SQL, formulas, assets, dependencies, credentials and customer data are not copied.
- BENSK and ADDSK are outside the PER core. The PER shard contains no accepted BENSK/ADDSK implementation. Customer adapters may only enter as signed extension packs.

## Coverage summary

The governed shard contains exactly 349 parent artifacts: 121 routes, 126 controllers and 102 entities. All 349 are decided and all required target fields are populated; `UNKNOWN=0`, `UNASSESSED=0`, and orphan parent references are zero.

| Disposition | Count | Meaning |
|---|---:|---|
| `REBUILD` | 305 | Independently implement the business behavior in the consolidated DWP workflow |
| `CONFIGURE` | 17 | Replace legacy codes/questions with typed, versioned tenant configuration |
| `REUSE` | 12 | Consume existing DWP workforce, automation and notification contracts |
| `EXTENSION` | 6 | Keep provider/customer exchange outside core behind the connector SPI |
| `RETIRE` | 9 | Remove legacy portal homes, test grade-group screens and sample persistence |

The child trace contains 1,041 evidence rows: 607 service operations, 121 menu elements, 102 SQL behaviors, 96 state transitions, 68 formula behaviors, 37 file/document behaviors, 6 interfaces and 4 jobs. The 605 declared mapped controller operations are represented; two zero-mapping controllers receive explicit target contracts, and the two security-blocked template controllers receive safe platform substitute operation slots without reconstructing source behavior.

`REBUILD=305` is the reimplementation count. A total of 337 parents are explicitly consolidated/replaced/restructured by their `process_change`; it is not a separate disposition and therefore does not alter the 349-row total.

## Actors and authorization

- Employee: own goals, own submitted reviews, released feedback and published results only.
- Line manager/assigned reviewer: only frozen and explicitly assigned review population; management hierarchy alone never grants review access.
- Performance operator: cycle, population, exception and monitoring operations within named organizations/populations.
- Configuration designer and publisher: separate duties for templates, rubrics and policies.
- Calibrator and result publisher: distinct critical duties. `SOD_HRIS_PERFORMANCE_CALIBRATE_PUBLISH` prevents the same actor from calibrating and publishing the same cycle.
- Enterprise auditor: read-only, purpose-bound evidence view; narrative/private feedback identities remain masked unless a specific field policy allows access.

Every API evaluates `APP.HCM` entitlement, atomic capability, tenant, named/frozen population, field group, purpose, cycle state and step-up/SoD requirements. UI hiding is only a projection; API PEP is authoritative.

## Journeys and commands

1. HRIS Home receives a small, permission-trimmed performance widget contract for tasks, goal progress and released result status. It is not a menu map.
2. Cycle Studio creates a draft version, validates schedules and stage rules, simulates population, obtains publish approval, then activates the immutable version.
3. Goal Workspace combines organization goals, cascade/alignment, individual goals, approval and progress revisions.
4. Participant Review Workspace renders self/manager/second/third/referee stages from the frozen assignment and the published form snapshot.
5. Feedback and Check-in workspaces cover multi-source feedback, continuous check-ins, interviews and private/public notes.
6. Calibration records before/after values, reason, distribution impact, actor and approval without overwriting submissions.
7. Results Explorer validates, approves, publishes and corrects result versions and handles appeals.
8. Command Center unifies monitoring, validation failures, incomplete work and remediation deep links.

Mutations require `Idempotency-Key` and `If-Match`/expected version. Long-running freeze, import, export, recalculation and publish commands return a receipt.

## Validation, state, and exceptions

- Cycle: `DRAFT → VALIDATED → PUBLISHED → ACTIVE → CLOSED`; published versions are immutable.
- Population freeze: `DRAFT → PREVIEWED → FROZEN → SUPERSEDED`; the exact HRM projection revision and rule version are retained.
- Goal: `DRAFT → SUBMITTED → APPROVED → ACTIVE → COMPLETED`; material changes create a new revision.
- Review: `NOT_STARTED → IN_PROGRESS → SUBMITTED → RETURNED|COMPLETED`; a submission snapshot is append-only.
- Calibration: `DRAFT → READY → IN_SESSION → SUBMITTED → APPROVED → LOCKED`.
- Result: `COMPUTED → VALIDATED → APPROVED → PUBLISHED → CORRECTED`; publish is a separate critical command.
- Appeal: `OPEN → UNDER_REVIEW → UPHELD|REJECTED → CLOSED`.

Common failures are explicit: `400` malformed contract, `403` entitlement/scope/field/purpose, `404` tenant-safe absence, `409` stale version or illegal transition, `422` rule violation, and `202`/receipt for result-unknown asynchronous processing. No delete/recreate lifecycle is permitted.

## Data ownership and retention

`dwp-people-server/hris/performance` owns all `prf_*` aggregates and projections. It consumes HRM public IDs and versioned worker/assignment/org/manager snapshots; it neither mutates People core tables nor relies on cross-context database joins. The package can later be extracted because its public API/events, tables, migrations, inbox/outbox and command receipts have a self-contained boundary.

Submission, calibration and published-result evidence is append-only. Tenant retention policy IDs determine expiry; legal hold overrides deletion. File bodies remain in DWP Object Storage. Performance tables keep only opaque object references and content hashes. Analytics read models suppress small cohorts and do not retain unneeded reviewer identity.

## Batch, interface, and document behavior

- DWP Admin owns the automation catalog, schedule, run center, retry/quarantine and alerts.
- The PER bounded context owns signed/versioned job handlers such as population freeze, reminder projection, import validation, result computation and export preparation.
- Each run uses a lease, idempotency key, versioned parameters, immutable receipt, reconciliation counts and DLQ/quarantine outcome.
- Bulk files use versioned schemas, malware-scanned Object Storage references, row-level validation receipts and expiring audited downloads. Legacy bundled spreadsheets/reports are not reused.
- Actual ERP/provider/customer contracts are adapter activation evidence. Their absence does not block the provider-neutral core or conformance harness.

## Redundancy and process improvements

- Three legacy module home routes are retired; HRIS Home supplies cross-module widgets and `/hr/talent` supplies the performance work surface.
- Stage-specific self/1st/2nd/3rd review pages become one assignment-driven review workspace.
- Separate target/evaluator/approver/exception screens become one population rule preview and freeze flow.
- Goal, MBO and organization goal screens become a single goal/alignment model with reusable approvals.
- Grade-group allocation and result adjustment screens become an auditable calibration session.
- Duplicate results and historical reports become one field-policy-aware Results Explorer.
- Screen-init controllers are replaced by explicit, cacheable read contracts; they do not become target CRUD endpoints one-for-one.
- Boolean close/use flags and destructive deletes are replaced by explicit state/version histories and correction events.

## Generic core, country pack, and tenant extension

Performance cycles, goals, reviews, feedback, calibration, publish and appeals are global core. Forms, scales, weights, stage names, schedules, population rules, privacy thresholds and retention references are typed tenant configuration with effective versions. Locale text is data, not branching code. External result exchange is a signed adapter extension. PER has no statutory country calculation; jurisdiction-specific retention or works-council constraints can add policy packs without forking the core.

Operating menus, runtime access logs and customer configuration exports are required only for exact SKKF/customer parity or cutover evidence. They are not core code-readiness blockers. The two security-blocked legacy template controllers are replaced by DWP Notification contracts; exact source parity remains a controlled activation check, not an excuse to reconstruct blocked source.

## Target contract proposals

- Owner/runtime: `dwp-people-server/hris/performance`; frontend: `apps/dwp/src/features/hris/performance`.
- Extractability: no direct People repository use; HRM snapshot API/event, independent `prf_*` schema, versioned events, inbox/outbox and opaque public IDs.
- API base: `/api/people/v1/hris/performance`.
- Event envelope: `eventId`, `eventType`, `schemaVersion`, `tenantId`, `aggregateId`, `aggregateVersion`, `occurredAt`, `correlationId`, `causationId`, `actorRef`, `purpose`, `payload`.
- Shared dependencies: HRM snapshot, Auth PEP, Approval, Audit, Notification, Object Storage, Automation and Provider/Integration ports.
- First executable slice: cycle draft → population freeze → self review submit → manager review → auditable result query.

The detailed physical schema, API/event contracts, state/guard rules, authorization policy and synthetic oracle are under `session-evidence/per/g2-readiness/`. They passed cross-module validation and form the `OPEN_G3_CODE` baseline; each implementation slice must keep the central checkpoint green.

## Unknowns and decisions

There are no unresolved source-to-target classifications (`UNKNOWN=0`). Sixteen G1 architectural decisions are closed in `g1-decision-log.csv`. No additional user product decision is required for the generic core.

Deferred activation evidence is deliberately scoped:

- exact customer/SKKF menu and behavior parity: operating export and controlled review;
- real connector: provider contract, sandbox, sample, SLA and reconciliation tolerance;
- production retention/privacy: named owner and tenant/country policy;
- production release: named Product/SME/DBA/Security/Privacy/QA approvals.

These do not reopen G1 or prevent core implementation. They block only the corresponding adapter, parity claim or production activation.

## Synthetic characterization tests

- A cycle version cannot publish with overlapping stage dates, invalid form version or weights that do not total `1.000000`.
- Population preview is deterministic for the same HRM projection revision; freeze preserves membership after a later organization change.
- An unassigned manager receives `403` even when the employee is currently in the manager's hierarchy.
- Duplicate review submission with the same idempotency key returns the same receipt; a different body under the same key conflicts.
- Submitted answers, calibration adjustments and published results cannot be overwritten.
- A calibrator cannot publish the same cycle, and step-up expiry prevents critical commands.
- Feedback identities are hidden below the configured minimum cohort.
- Partial import produces accepted/rejected counts and row error references without partially publishing a cycle.
- A tenant cannot infer another tenant's record through search, count, error message or export.
- A failed async command is recovered by receipt state, lease expiry and retry/DLQ policy without duplicate effects.
