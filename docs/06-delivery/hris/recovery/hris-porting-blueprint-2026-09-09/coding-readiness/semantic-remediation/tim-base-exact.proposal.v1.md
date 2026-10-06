# TIM BASE exact preparation proposal v1

Status: DESIGN_PROPOSED / CURRENT_PUBLISHED=false / Gate authorization NONE. This is a bounded successor design for BASE-P0-004/005/006/011, not an independent P0 closure, canonical Gate decision or all TIM/BASE86 certificate. Historical G2 JSON/SQL/CSV and BE/FE/root proposals were not edited.

The machine contract is [tim-base-exact.proposal.v1.json](tim-base-exact.proposal.v1.json). All `$defs`, operation request deltas, physical columns, per-column producer expressions, planned initial-native CREATE SQL, typed lineage, queries, events, fixtures and test allocations are in that file. Planned SQL has not run and is not permission to drop/overwrite existing facts.

## Stage boundary

G3 requires independently approved exact planned API/schema/SQL/read-write/state/source/fixture/test allocation plus actual shared owner DTO/SPI, fail-closed validation adapters and producer/consumer compile, Control-owned empty-stream/role/receipt/guard/bootstrap and common/pilot/runtime smoke. G3 does not require implementing or executing all proposed domain CRUD/native journeys first.

Full domain SQL/materialization/CRUD, actual calculations, ledgers and native acceptance journeys are G4. Customer identity authority/adoption and production statutory/provider/process-isolation approval are G6. Missing exact shared owner/source or common authority readiness is a G3 P0, not deferred merely by calling it G4/G6.

## Scope and inventory

| Inventory | Exact count |
| --- | ---: |
| operations | 114 |
| publicOperations | 86 |
| ownerOperations | 28 |
| replacements | 16 |
| additions | 98 |
| queries | 33 |
| commands | 81 |
| plannedTables | 43 |
| replacedHistoricalPlannedTables | 13 |
| newTables | 30 |
| plannedColumns | 581 |
| schemaDefinitions | 461 |
| ownerReadContractProposals | 17 |
| typedSources | 5018 |
| requiredColumnSources | 4789 |
| queryProjectionFields | 515 |
| eventSchemas | 81 |
| negativeCases | 30 |

The 114 operations are 86 public and 28 TIM owner-only/SPI operations: 16 historical replacements plus 98 additions. Counts are not a Gate oracle and no prior 100-operation/menu count is preserved at the expense of business semantics. Twelve historical TIM operations outside this bounded redesign remain independently unverified; widget/receipt, clock/interpretation, close/handoff/export are not silently certified by this proposal.

## Identity and source ownership

DWP principal UUID is not person, worker, employment or assignment UUID. `HRM.VerifiedSelfScopeSnapshot.v1` is a required new owner contract: trusted principal+tenant → effective verified person/worker/employment/self-context link, with verification/provenance, revocation and multi-employment semantics. Zero verified contexts is403; multiple contexts require explicit owner-issued selfContext selection (409 if absent); foreign/expired/unverified links reject. Worker UUIDs in bodies are planning/admin selectors or consistency checks only. Persisted worker/assignment fields come from reauthorized HRM snapshot, never principal-as-worker or a SELF body claim.

No principal.workerPublicId shortcut is assumed. HRM historical base does not expose the required identity link; HRM proposal's mapping delta is still proposed and its existing31 semantic provenance failures are not cleared here. G3 needs actual exact mapping schema/query/SPI/shared failclosed consumer binding; real customer identity adoption is G6.

TIM owns native work arrangement, calendar/rule expansion, approved absence, published schedule and availability composition. HRM supplies effective employment/assignment/location, not actual leave/schedule/availability rules. PER supplies skills separately; TIM availability never calculates PER skill rules. WFM joins exact HRM/TIM/PER refs through owner ports, not cross-service DB joins.

Composition is employment-eligible intervals ∩ native TIM membership/pattern/shift/calendar allowed windows minus approved absence/current occupied schedule/rest. It is not the whole employment interval minus a few exceptions. Missing native arrangement/configuration blocks, never opens unrestricted availability.

## Native schedule aggregate and recovery

A schedule period has its own immutable business revision, worksite/half-open interval, pinned rule/calendar/config sources and mutable CAS rowVersion. Assignments are N verified HRM worker+assignment relations. Segments are explicit line-keyed WORK/BREAK/ON_CALL/TRAINING/ABSENCE records with paidness, localWorkDate, UTC instants, IANA zone, offset seconds, pinned tzdb/attribution rule and recomputed provenance. Manual native input requires no optional connector or solver.

A published shift/pattern is immutable; a native membership supplies explicit effective pattern/calendar. Child rows resolve their own verified assignment and actual local FK. One parent/path UUID is never copied to unrelated worker, organization, policy or internal BIGINT identities. Actual generated parent internal IDs are reused once from DB RETURNING; public UUIDs are secure owner-generated, not arbitrary businessKey/correlation substitutions.

| Aggregate | Initial states | Reachable states | Terminal states |
| --- | --- | --- | --- |
| tme_work_rule_set_versions | DRAFT | DRAFT, VALIDATED, SIMULATED, SUBMITTED, WITHDRAW_PENDING, APPROVED, PUBLISHED, REJECTED, CANCELLED, RETIRED | REJECTED, CANCELLED, RETIRED |
| tme_shift_template_versions | DRAFT | DRAFT, VALIDATED, SIMULATED, SUBMITTED, WITHDRAW_PENDING, APPROVED, PUBLISHED, REJECTED, CANCELLED, RETIRED | REJECTED, CANCELLED, RETIRED |
| tme_schedule_patterns | DRAFT | DRAFT, VALIDATED, SIMULATED, SUBMITTED, WITHDRAW_PENDING, APPROVED, PUBLISHED, REJECTED, CANCELLED, RETIRED | REJECTED, CANCELLED, RETIRED |
| abs_leave_plan_versions | DRAFT | DRAFT, VALIDATED, SIMULATED, SUBMITTED, WITHDRAW_PENDING, APPROVED, PUBLISHED, REJECTED, CANCELLED, RETIRED | REJECTED, CANCELLED, RETIRED |
| tme_schedule_periods | DRAFT, ASSIGNED, PUBLISHED | DRAFT, ASSIGNED, VALIDATED, VALIDATION_FAILED, SUBMITTED, APPROVED, PUBLISHED, REJECTED, CANCEL_PENDING, CANCELLED, WITHDRAW_PENDING | PUBLISHED, REJECTED, CANCELLED |
| abs_worker_plan_enrollments | ACTIVE | ACTIVE, ENDED, CANCELLED | ENDED, CANCELLED |
| abs_leave_requests | DRAFT, CORRECTION_REQUIRED | DRAFT, SUBMITTED, APPROVED, REJECTED, CANCEL_PENDING, CANCELLED, WITHDRAW_PENDING, CORRECTION_REQUIRED | REJECTED, CANCELLED |
| abs_entitlement_runs | QUEUED | QUEUED, RUNNING, SUCCEEDED, PARTIAL, FAILED, RESULT_UNKNOWN, CANCEL_PENDING, CANCELLED, CANCELLED_PARTIAL | SUCCEEDED, PARTIAL, FAILED, CANCELLED, CANCELLED_PARTIAL |
| tme_time_cards | CORRECTION_REQUIRED, OPEN | OPEN, SUBMITTED, APPROVED, REJECTED, LOCKED, CORRECTION_REQUIRED | LOCKED |

All9 declared main machines have a syntactically reachable producer/transition in the proposal (86 guarded transition rows); this is a structural author check, not proof that guards or runtime implementations are healthy.

Native flow: create DRAFT → assign ASSIGNED → actual validation VALIDATED or VALIDATION_FAILED → submit SUBMITTED → independent owner decision APPROVED or REJECTED → publish PUBLISHED. Revalidation uses current actual segment/source inputs, zero persisted blockers and exact subject content, not a preexisting/digest-only receipt. Empty ordinary DRAFT cannot validate; only a typed CANCEL_PUBLISHED corrective successor may have no replacement work segments.

Published amendment and cancellation create a new period revision with exact base publication UUID/revision/hash and preserved source identities. The earlier PUBLISHED period/segments/publication remains unchanged. A validated independent approved corrective publication appends SUPERSEDE/CANCEL events and atomically replaces/removes only matching prior active projections; no erase of source facts. Closed TIM/downstream PAY effects require an exact owner reopen/reconciliation contract, otherwise409.

Publication locks assignment authority in deterministic UUID order and repeats overlap/CAS/owner/source/calendar/absence/SoD checks under the same TIM transaction. An active interval exclusion is defense in depth, not a substitute for PEP or source guards. Active projections rebuild from append-only PUBLISH/SUPERSEDE/CANCEL source events.

Withdrawal/cancel after dispatch is pending until exact durable owner effect proof. Unknown/NOT_FOUND_RETRYABLE is not CANCELLED, no reservation/availability release. If owner decision already APPROVED/REJECTED, that owner history stays so; typed cancellation result and actual local irreversible-effect proof govern local cancellation. No counterfeit owner CANCELLED receipt is created.

## WFM canonical publication transaction/query SPI

`TIM.CanonicalSchedulePublicationPort.v1` is defined here as an IN_PROCESS same-owner transaction SPI, not a gateway publication endpoint. `publishApproved(existing TimOwnerTransaction, TIM.CanonicalSchedulePublicationCommand.v1)` returns `TIM.CanonicalSchedulePublication.v1` using persisted native period/publication UUIDs, not candidate UUID aliases. `findByCandidate` joins actual candidate FK and returns the same durable result for replay/postcommit unknown.

Caller candidate/shifts/evaluation/approval/source vector, canonical period/assignments/exact segments/publication/events/projection, caller WFM publication ledger/candidate, one actual command receipt and outbox must commit/rollback together on the same TIM DS/connection/tenant/role. REQUIRES_NEW, remote HTTP or cross DB FK is refused. Unique candidate identity fences duplicate publication; failed result observation is reconciled from actual persisted FK/receipt, never blind republish.

Root currently asks `TIM.CanonicalSchedulePublicationPort.proposal.v1`; exact successor naming and DTO source integration is OPEN. It is not an implicit alias/fallback. Root's exact nested WORK/BREAK/calendar/work-rule/zone refs must be preserved. Aggregate break duration cannot be expanded or distributed arbitrarily. Heterogeneous per-worker rule/calendar refs must not be silently collapsed to a period's pinned default: exact per-segment materialization or explicit compatible partition/guard successor needs cross-validation, and is not certified here.

Root WFM bounded read: SHA 5c0af043947c007c9304edb29519a8176011fd46180cfa49d2d04d2f0107bd91, 22public/6internal/14tables after new lease claim/candidate revision counter, not the older22/5/13 count. This concurrent proposal observation is not an independent WFM review or canonical seal.

## Closed rule/leave policy

`TIM_RULE_AST` has local AST symbols, explicit node/output types, closed quantity/rate/Boolean constants, registered input keys and15 closed operators. No eval, user SQL, reflection or unregistered executable formula string. DAG uniqueness/reachability/arity/depth/budget/output/unit checks reject unknown/cyclic/missing/type/zero-denominator/overflow cases. Quantity Decimal19,6, rate Decimal19,8 and checked intermediate Decimal24,8 are exact strings, never binary floats.

| Operator | Arity | Input | Output |
| --- | ---: | --- | --- |
| ADD | 2 | QUANTITY<U>,QUANTITY<U> | QUANTITY<U> |
| SUBTRACT | 2 | QUANTITY<U>,QUANTITY<U> | QUANTITY<U> |
| MULTIPLY_RATE | 2 | QUANTITY<U>,RATE | QUANTITY<U> |
| DIVIDE_TO_RATE | 2 | QUANTITY<U>,QUANTITY<U> | RATE |
| MIN | 2 | QUANTITY<U>,QUANTITY<U> | QUANTITY<U> |
| MAX | 2 | QUANTITY<U>,QUANTITY<U> | QUANTITY<U> |
| GT | 2 | QUANTITY<U>,QUANTITY<U> | BOOLEAN |
| GTE | 2 | QUANTITY<U>,QUANTITY<U> | BOOLEAN |
| EQ | 2 | T,T | BOOLEAN |
| AND | 2 | BOOLEAN,BOOLEAN | BOOLEAN |
| OR | 2 | BOOLEAN,BOOLEAN | BOOLEAN |
| NOT | 1 | BOOLEAN | BOOLEAN |
| IF | 3 | BOOLEAN,T,T | T |
| ROUND | 1 | QUANTITY<U> | QUANTITY<U> |
| CONVERT_USING_CALENDAR | 1 | QUANTITY<DAY/HOUR/MINUTE> | QUANTITY<TARGET_UNIT> |

Inputs are owner-bound actual work/paid-break/scheduled quantity, employment/assignment state/eligible calendar basis, approved overtime, captured enrollment balance/unused lot, service months and termination boundary. Missing authoritative input does not become zero. Completed service months and verified anniversary service-anchor/continuity need an additional exact HRM employment-basis extension: current EffectiveAssignment DTO does not supply it, so those modes remain unavailable/failclosed until owner approval, not generic date arithmetic.

Work/regular maximum windows and rest aggregation are typed local day/week or rolling elapsed, explicit day/week boundary and assignment/all-authorized-employments scope. Calendar/zone/units and priority/layer authority are immutable versioned SYS policy context + exact TIM artifact, not legal/tenant hardcoded thresholds. Core unit conversion of seconds/minutes/hours is physical unit semantics; DAY conversion uses actual worker-day calendar/schedule, never8hours/day.

Leave policy has closed eligibility AST; explicit/native automatic enrollment mode; closed monthly/yearly/anniversary/per-worked-unit accrualSchedule with explicit anchors/invalid-day treatment/local boundary and exact worked-unit/pay-code basis; same-unit proration basis; configured carryover/balance caps; explicit clamp-with-suppressed-amount vs block; expiry NEVER/configured days/fixed date; termination stop/prorate/owner settlement; reservation timing; negative-balance Boolean; explicit stage rounding. No first-of-month/Jan1/year-end/hire-date/company/statutory number is implicitly inserted in core.

Rounding is explicitly configured HALF_UP/HALF_EVEN/DOWN/UP/FLOOR/CEILING, scale0..6, for PRORATION/GRANT/CONVERSION/CARRYOVER/TERMINATION/TIME_CLASSIFICATION. Persist unrounded/rounded value, mode/scale/stage and policy hash. No implicit database rounding or source-history update.

## Leave enrollment, execution, ledger and cancellation

Eligibility creates an immutable true/false decision from exact policy+HRM+SYS sources before inserting an ACTIVE enrollment FK. No placeholder circular enrollment identity. Native auto-enrollment event processing must use the same eligibility/authorization/idempotency guard. Ended/cancelled enrollment is real storage; unused no-effect cancellation is distinct from termination/settlement.

Entitlement run is QUEUED → fenced owner RUNNING, per selected enrollment ITEM_ATOMIC result/grant/lot/balance/receipt/outbox, then SUCCEEDED/PARTIAL/FAILED. Cancel fencing leads CANCELLED or CANCELLED_PARTIAL without undoing successful immutable items. RESULT_UNKNOWN queries durable items/lease and only known zero-effect permits bounded retry. DRY_RUN creates a computed immutable result item only, no ledger/counter/lot/balance effects. Unknown source, zero denominator, invalid stage/unit or BLOCK_POST cap blocks posting. CLAMP stores the suppressed amount and full trace.

Posted ledger and reserved amount are different. Approval revalidates exact owner decision/eligibility/source/balance/calendar/period/SoD; USE posts a signed negative and FEFO allocations. Rejection or known submitted cancellation releases reservation only. Known cancellation of approved open-period USE appends RELEASE equal the original magnitude and lot release; no old fact mutation or double release. Amendment creates CORRECTION_REQUIRED successor; closed or irreversible consumption requires owner settlement/reopen, not automatic PAY conversion.

Carryover has paired OUT-/IN+ source events and entries, net zero except actual excess EXPIRE. Expiry/carryover source keys include enrollment/local boundary/lot/policy, so replay/midnight cannot double-post. Grant lots/allocations/releases/reversals are append-only. Termination changes an old grant through exact negative REVERSE plus new GRANT and retains provenance. Balance restore is exact immutable signed SUM at captured ledger revision plus separate active reservations, no fabricated grants.

## Timecard state, multiassignment ledger and preserved infrastructure

Historical SQL lines281–315 `tme_time_ledger_entries` has worker_public_id but no assignment_public_id. Multi-employment card/closed-result joins cannot safely infer assignment from worker or the first employment. An additive new-write assignment UUID and worker-global ledger revision counter is proposed, preserving original immutable facts and historical unique(tenant,worker,ledgerRevision). Ambiguous old facts stay UNBOUND_BLOCKED. The exact append-only legacy owner assignment binding schema/source proof is still a G3 design P0; real data adoption is G6. No historical fact UPDATE/backfill/trigger disable was run.

Timecard state is OPEN/SUBMITTED/APPROVED/REJECTED/LOCKED/CORRECTION_REQUIRED. Close period state independently comes from actual `tme_close_periods.status`: OPEN/VALIDATING/CLOSING/CLOSED/REOPEN_REQUESTED/REOPENED/FAILED or NOT_BOUND projection. Card CLOSED is never invented. CLOSING locks APPROVED card to LOCKED; actual REOPENED creates a new CORRECTION_REQUIRED card revision, original LOCKED unchanged. Correction appends exact negative REVERSAL and new MANUAL_CORRECTION using explicit original ledger UUID/assignment/unit/date/policy source, not mutable minutes overwrite.

Actual G2 names/types are retained: `tme_command_receipts.result_ref` is UUID; `tme_outbox_events` and `tme_inbox_receipts` are the real infrastructure tables. No shadow domain_event_outbox or string result_ref. Per originating action result entity/public UUID is registered exactly. Sealed caller/action/population/field/purpose/authorization/request digest replay is reauthorized against current more-restrictive decision. Cross-tenant receipt returns opaque failure, not result oracle.

81 proposed operation-specific committed event payload schemas are TIM owner-private internal events, not indiscriminate external raw owner/evidence broadcasts. All read/write records are actual declared table projections. External SYS/Approval command delivery requires exact new DTO/SPI and purpose policy; no label-only event/receipt evidence is accepted.

## SYS authority and owner contract status

13stream is ROOT_ARCHITECTURE_DECISION_PROPOSED, not current published/bootstrap proof. SYS `platform-hris-configuration` owns hris_configuration / flyway_hris_configuration_history through a distinct purpose DS/LOGIN role and external Control migration authority. Current published cross-module contracts remain21 existing XCON schemas; new effective time configuration/context/calendar, identity, Approval and TIM source ports are not canonically published.

TIM content is the time artifact SoR; SYS proposed config metadata governs priority/scope/effective lifecycle/approval and binds exact TIM artifact UUID/versionNo/contentSchema/contentSHA. This boundary needs root/SYS approval; it is not a local SYS configuration shadow table or permission for cross-DB access. New SYS runtime policy context avoids a circular requirement for a DRAFT's own already-published artifact metadata during first creation.

Manifest/receipt/guard must exact-bind service/stream/catalog/schema/history/locations, migration/runtime principals+purpose+allowlist, external expected Control reference/digest, history/definition/ACL/ownership/source inventory, ordering/provenance/predecessor. Missing/tampered/foreign receipt or DS role/source mismatch rejects enabled capability. Disabled private stream is not opened. No scalar/primary credential fallback, app DDL, blanket grants, PUBLIC EXECUTE, SET ROLE or cross DB/repo FK. Existing8service/9stream scalar runtime receipts remain valid only for their saved scope, not new13 composite proof.

| Required owner read contract | Owner/stream | Schema | Current published |
| --- | --- | --- | --- |
| HRM.EffectiveAssignmentSnapshot.v1 | HRM / people-main | HRM.EffectiveAssignmentSnapshot.v1 | false; OPEN |
| HRM.VerifiedSelfScopeSnapshot.v1 | HRM / people-main | HRM.VerifiedSelfScopeSnapshot.v1 | false; OPEN |
| HRM.EffectiveLocationSnapshot.proposal.v1 | HRM / people-main | HRM.EffectiveLocationSnapshot.proposal.v1 | false; OPEN |
| SYS.EffectiveTimeConfigurationSnapshot.v1 | SYS / platform-hris-configuration | SYS.EffectiveTimeConfigurationSnapshot.v1 | false; OPEN |
| SYS.TimePolicyContextSnapshot.proposal.v1 | SYS / platform-hris-configuration | SYS.TimePolicyContextSnapshot.proposal.v1 | false; OPEN |
| SYS.TimeCalendarSnapshot.v1 | SYS / platform-hris-configuration | SYS.TimeCalendarSnapshot.v1 | false; OPEN |
| Approval.TimeDecisionSnapshot.v1 | SYS / approval-main | Approval.TimeDecisionSnapshot.v1 | false; OPEN |
| Approval.TimeCancellationSnapshot.v1 | SYS / approval-main | Approval.TimeCancellationSnapshot.v1 | false; OPEN |
| TIM.CanonicalScheduleSnapshot.v1 | TIM / time-main | TIM.ScheduleAvailabilitySnapshot.v1 | false; OPEN |
| TIM.AbsenceAvailabilitySnapshot.v1 | TIM / time-main | TIM.ScheduleAvailabilitySnapshot.v1 | false; OPEN |
| TIM.AvailabilityCompositionSnapshot.v1 | TIM / time-main | TIM.ScheduleAvailabilitySnapshot.v1 | false; OPEN |
| TIM.EffectiveCalendarSnapshot.proposal.v1 | TIM / time-main | TIM.EffectiveCalendarSnapshot.proposal.v1 | false; OPEN |
| TIM.EffectiveWorkRuleSnapshot.proposal.v1 | TIM / time-main | TIM.EffectiveWorkRuleSnapshot.proposal.v1 | false; OPEN |
| TIM.TimeRuleArtifactSnapshot.v1 | TIM / time-main | TIM.Record.tme_work_rule_set_versions.v1 | false; OPEN |
| TIM.ShiftTemplateArtifactSnapshot.v1 | TIM / time-main | TIM.Record.tme_shift_template_versions.v1 | false; OPEN |
| TIM.SchedulePatternArtifactSnapshot.v1 | TIM / time-main | TIM.Record.tme_schedule_patterns.v1 | false; OPEN |
| TIM.LeavePolicyArtifactSnapshot.v1 | TIM / time-main | TIM.Record.abs_leave_plan_versions.v1 | false; OPEN |

Exact producer source registration, owner reauthorization/source identity, DTO/SPI/failclosed adapter and consumer compile are required shared G3 work. Owner snapshot labels or authored field maps are not a semantic validator PASS. Historical31 HRM lineage failures stay unchanged until real independent owner registration/source proof.

## Fixture and validation results

Two API-body/owner-double configuration fixtures declare all selected worker/person/employment/assignment/verified self-link, immutable policy/calendar/config refs and authoritative owner response schemas. Stable UUIDs are unrelated fixture-generated identities, never codes replacing UUIDs. Native arrangement prerequisite is explicitly TIM-owned. Exact typed owner doubles are not actual owner/customer/Control production receipts.

| Golden | A | B |
| --- | ---: | ---: |
| Same actual work minutes | 120 | 120 |
| Configured maximum | 120 | 90 |
| First validation | VALIDATED | VALIDATION_FAILED |
| Corrective draft reassign/revalidate | 120 / valid | 90 / valid |
| Monthly grant amount HOUR | 2 | 4 |
| Eligible/full calendar days | 15/31 | 15/31 |
| Posted grant HALF_UP6 | 0.967742 | 1.935484 |
| Prior unused grant | 1.500000 | 1.500000 |
| Carryover cap | 1 | 2 |
| Excess EXPIRE | 1.467742 | 1.435484 |
| Final carryover balance | 1.000000 | 2.000000 |
| Half DAY actual scheduled minutes | 180 (360/day) | 240 (480/day) |
| Termination7/31 final grant | 0.451613 | 0.903226 |

A/B values are synthetic approved configuration examples, not statutory/default/customer recommendations. NY spring2026-03-08 01:30→03:30 is60elapsed minutes; fold2026-11-01 01:30 earlier→later is60elapsed minutes. Offset/local/tzdb proof is checked, gap/fold not guessed. The installed Python zoneinfo golden confirms expected arithmetic, not the proposed pinned runtime tzdb/owner authority.

Canonical fixture hash: UTF8 recursively key-sorted JSON with exact decimal strings; only top-level own digest slot excluded, all nested owner reference identities/revisions/digests included, arrays retain declared canonical order. Node SHA256 computed local artifact/context/calendar hashes; owner reauthorization remains fixture double, not real receipt. Test phases explicitly separate configuration prep, future native schedule, full-period entitlement POST and carryover.

Author checks:13/13 structural checks;36/36 closed request/owner DTO instances (24bodies,12owner payloads) in the custom explicit JSON-Schema subset checker;13/13 Decimal/DST golden expected-value checks. This is not standards-engine certification, independent P0 closure, native runtime or source authority proof. No jsonschema/Ajv standards engine was available. Executable checker/hash logic is embedded at `authorValidation.fixtureSubsetCheckerJavaScript` and `.fixtureHashProcedureJavaScript`; bind proposal.$defs and iterate exact operation body / ownerResponseSchemaRefs. Normal historical semantic-lineage candidate-overlay validation was NOT_RUN/NO_PASS because new owner source identity/registration remains OPEN.

30 allocated negatives cover overlap, concurrent CAS, tenant/SoD, source stale, verified-self zero/multiple/foreign/expired, immutable amend/closed downstream, card locked/reopen, DST gap/fold/offset, actual payload replay, WFM postcommit unknown/same transaction, cancellation unknown/already-approved history, type/unit/divide0/operator/cycle/rounding/cap, duplicate reversal/carryover, DRY_RUN, missing native arrangement/stream authority and legacy unbound assignment. These are planned G3 shared-contract fixtures and G4 domain behavior tests, not executed domain cases.

## Planned physical objects

| Table | Change | Internal identity | Columns incl identity |
| --- | --- | --- | ---: |
| tme_work_rule_set_versions | REPLACE_HISTORICAL_PLANNED_SPEC | work_rule_set_version_id | 21 |
| tme_shift_template_versions | REPLACE_HISTORICAL_PLANNED_SPEC | shift_template_version_id | 21 |
| tme_schedule_patterns | REPLACE_HISTORICAL_PLANNED_SPEC | schedule_pattern_id | 21 |
| abs_leave_plan_versions | REPLACE_HISTORICAL_PLANNED_SPEC | leave_plan_version_id | 21 |
| tme_artifact_revision_counters | ADD | artifact_counter_id | 8 |
| tme_time_groups | ADD | time_group_id | 9 |
| tme_time_group_memberships | ADD | group_membership_id | 14 |
| tme_owner_artifact_snapshots | ADD | owner_artifact_snapshot_id | 16 |
| tme_calendar_version_snapshots | ADD | calendar_snapshot_id | 13 |
| tme_schedule_periods | ADD | schedule_period_id | 21 |
| tme_schedule_period_revision_counters | ADD | period_revision_counter_id | 7 |
| tme_worker_schedule_assignments | REPLACE_HISTORICAL_PLANNED_SPEC | schedule_assignment_id | 13 |
| tme_scheduled_segments | REPLACE_HISTORICAL_PLANNED_SPEC | scheduled_segment_id | 23 |
| tme_schedule_evaluation_counters | ADD | evaluation_counter_id | 7 |
| tme_schedule_evaluations | ADD | schedule_evaluation_id | 14 |
| tme_schedule_violation_lines | ADD | violation_line_id | 11 |
| tme_schedule_approval_bindings | ADD | approval_binding_id | 14 |
| tme_schedule_publication_receipts | ADD | publication_id | 15 |
| tme_schedule_assignment_events | ADD | schedule_assignment_event_id | 12 |
| tme_schedule_active_intervals | ADD | active_interval_id | 10 |
| tme_availability_snapshots | ADD | availability_snapshot_id | 16 |
| tme_availability_snapshot_rows | ADD | availability_snapshot_row_id | 10 |
| tme_snapshot_source_refs | ADD | snapshot_source_ref_id | 9 |
| abs_worker_plan_enrollments | REPLACE_HISTORICAL_PLANNED_SPEC | enrollment_id | 13 |
| abs_enrollment_decisions | ADD | enrollment_decision_id | 16 |
| abs_leave_requests | REPLACE_HISTORICAL_PLANNED_SPEC | leave_request_id | 13 |
| abs_leave_request_segments | REPLACE_HISTORICAL_PLANNED_SPEC | leave_request_segment_id | 14 |
| abs_leave_approval_bindings | ADD | leave_approval_binding_id | 13 |
| abs_leave_reservations | ADD | leave_reservation_id | 11 |
| abs_entitlement_runs | REPLACE_HISTORICAL_PLANNED_SPEC | entitlement_run_id | 16 |
| abs_entitlement_run_items | ADD | entitlement_run_item_id | 18 |
| abs_entitlement_ledger_entries | REPLACE_HISTORICAL_PLANNED_SPEC | entitlement_ledger_entry_id | 19 |
| abs_ledger_revision_counters | ADD | ledger_revision_counter_id | 7 |
| abs_leave_grant_lots | ADD | leave_grant_lot_id | 10 |
| abs_leave_lot_events | ADD | leave_lot_event_id | 11 |
| abs_leave_balance_projections | REPLACE_HISTORICAL_PLANNED_SPEC | leave_balance_projection_id | 12 |
| tme_time_cards | REPLACE_HISTORICAL_PLANNED_SPEC | time_card_id | 18 |
| tme_timecard_revision_counters | ADD | timecard_revision_counter_id | 9 |
| tme_policy_evaluation_reports | ADD | policy_evaluation_report_id | 12 |
| tme_policy_governance_bindings | ADD | policy_governance_binding_id | 15 |
| tme_availability_revision_counters | ADD | availability_revision_counter_id | 9 |
| tme_timecard_approval_bindings | ADD | timecard_approval_binding_id | 12 |
| tme_time_ledger_revision_counters | ADD | time_ledger_revision_counter_id | 7 |

Local FKs are tenant+actual target internal BIGINT only; same-owner shared UUID FKs remain UUID and never use a BIGINT public→internal resolver. Responses do not expose internal identities. SQL uses canonical dwp.tenant_id RLS with missing context failclosed and application PEP mandatory. Secure owner UUID/internal DB identity are distinct. Exact Control runtime role/migration namespace/touch/immutable/interval guard allocation remains unapproved; no indiscriminate 1000line exception.

All43 specs have explicit CREATE design and581 column producer expressions,4789 per-operation physical write source rows,5018 typed source entries,515 query field bindings. These are complete structural rows, not assertion of correct semantics or runtime source graph health. Sixty-eight historical planned column removal/rename/source dispositions still require owner semantic restoration review; legacy generic expressions/aggregate breaks/worker-only identity cannot be automatically converted. Sealed baseline blobs must be preserved; approved common prefix+successor allocation is separate from changing the old validator to pass. People47/48, Auth211/212 and Platform231..237 are already occupied; no HRM business47/48 use. TIM historicalV1..39 reservation is not an approved new exact business touch manifest.

## Exact operation register

Each operation's full request additions/removals, explicit read/write tables/modes/columns, response/event/source and test allocation is in `operationDeltas` and referenced `operationFieldLineage`. Owner-only/internal/SPI operations are not public Gateway actions.

| Operation | Boundary / method | Path | State/creation | Business writes |
| --- | --- | --- | --- | --- |
| tim.rule.create | GATEWAY_AUTHENTICATED POST | /api/time/v1/rule-versions | NEW DRAFT | tme_work_rule_set_versions:INSERT, tme_artifact_revision_counters:UPSERT_MONOTONIC |
| tim.rule.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/rule-versions | READ/guarded side effect |  |
| tim.rule.get | GATEWAY_AUTHENTICATED GET | /api/time/v1/rule-versions/{versionId} | READ/guarded side effect |  |
| tim.rule.validate | GATEWAY_AUTHENTICATED POST | /api/time/v1/rule-versions/{versionId}/validate | DRAFT → VALIDATED/DRAFT | tme_work_rule_set_versions:UPDATE, tme_policy_evaluation_reports:INSERT |
| tim.rule.simulate | GATEWAY_AUTHENTICATED POST | /api/time/v1/rule-versions/{versionId}/simulate | VALIDATED → SIMULATED | tme_work_rule_set_versions:UPDATE, tme_policy_evaluation_reports:INSERT |
| tim.rule.submit | GATEWAY_AUTHENTICATED POST | /api/time/v1/rule-versions/{versionId}/submit | SIMULATED → SUBMITTED | tme_work_rule_set_versions:UPDATE, tme_policy_governance_bindings:INSERT |
| tim.rule.publish | GATEWAY_AUTHENTICATED POST | /api/time/v1/rule-versions/{versionId}/publish | APPROVED → PUBLISHED | tme_work_rule_set_versions:UPDATE, tme_owner_artifact_snapshots:INSERT |
| tim.rule.cancel | GATEWAY_AUTHENTICATED POST | /api/time/v1/rule-versions/{versionId}/cancel | DRAFT/VALIDATED/SIMULATED → CANCELLED | tme_work_rule_set_versions:UPDATE |
| tim.rule.retire | GATEWAY_AUTHENTICATED POST | /api/time/v1/rule-versions/{versionId}/retire | PUBLISHED → RETIRED | tme_work_rule_set_versions:UPDATE |
| tim.rule.governance.receive | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/rule-versions/{versionId}/governance | SUBMITTED/WITHDRAW_PENDING → APPROVED/REJECTED/CANCELLED | tme_work_rule_set_versions:UPDATE, tme_owner_artifact_snapshots:INSERT, tme_policy_governance_bindings:UPDATE |
| tim.shift.create | GATEWAY_AUTHENTICATED POST | /api/time/v1/shift-versions | NEW DRAFT | tme_shift_template_versions:INSERT, tme_artifact_revision_counters:UPSERT_MONOTONIC |
| tim.shift.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/shift-versions | READ/guarded side effect |  |
| tim.shift.get | GATEWAY_AUTHENTICATED GET | /api/time/v1/shift-versions/{versionId} | READ/guarded side effect |  |
| tim.shift.validate | GATEWAY_AUTHENTICATED POST | /api/time/v1/shift-versions/{versionId}/validate | DRAFT → VALIDATED/DRAFT | tme_shift_template_versions:UPDATE, tme_policy_evaluation_reports:INSERT |
| tim.shift.simulate | GATEWAY_AUTHENTICATED POST | /api/time/v1/shift-versions/{versionId}/simulate | VALIDATED → SIMULATED | tme_shift_template_versions:UPDATE, tme_policy_evaluation_reports:INSERT |
| tim.shift.submit | GATEWAY_AUTHENTICATED POST | /api/time/v1/shift-versions/{versionId}/submit | SIMULATED → SUBMITTED | tme_shift_template_versions:UPDATE, tme_policy_governance_bindings:INSERT |
| tim.shift.publish | GATEWAY_AUTHENTICATED POST | /api/time/v1/shift-versions/{versionId}/publish | APPROVED → PUBLISHED | tme_shift_template_versions:UPDATE, tme_owner_artifact_snapshots:INSERT |
| tim.shift.cancel | GATEWAY_AUTHENTICATED POST | /api/time/v1/shift-versions/{versionId}/cancel | DRAFT/VALIDATED/SIMULATED → CANCELLED | tme_shift_template_versions:UPDATE |
| tim.shift.retire | GATEWAY_AUTHENTICATED POST | /api/time/v1/shift-versions/{versionId}/retire | PUBLISHED → RETIRED | tme_shift_template_versions:UPDATE |
| tim.shift.governance.receive | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/shift-versions/{versionId}/governance | SUBMITTED/WITHDRAW_PENDING → APPROVED/REJECTED/CANCELLED | tme_shift_template_versions:UPDATE, tme_owner_artifact_snapshots:INSERT, tme_policy_governance_bindings:UPDATE |
| tim.pattern.create | GATEWAY_AUTHENTICATED POST | /api/time/v1/pattern-versions | NEW DRAFT | tme_schedule_patterns:INSERT, tme_artifact_revision_counters:UPSERT_MONOTONIC |
| tim.pattern.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/pattern-versions | READ/guarded side effect |  |
| tim.pattern.get | GATEWAY_AUTHENTICATED GET | /api/time/v1/pattern-versions/{versionId} | READ/guarded side effect |  |
| tim.pattern.validate | GATEWAY_AUTHENTICATED POST | /api/time/v1/pattern-versions/{versionId}/validate | DRAFT → VALIDATED/DRAFT | tme_schedule_patterns:UPDATE, tme_policy_evaluation_reports:INSERT |
| tim.pattern.simulate | GATEWAY_AUTHENTICATED POST | /api/time/v1/pattern-versions/{versionId}/simulate | VALIDATED → SIMULATED | tme_schedule_patterns:UPDATE, tme_policy_evaluation_reports:INSERT |
| tim.pattern.submit | GATEWAY_AUTHENTICATED POST | /api/time/v1/pattern-versions/{versionId}/submit | SIMULATED → SUBMITTED | tme_schedule_patterns:UPDATE, tme_policy_governance_bindings:INSERT |
| tim.pattern.publish | GATEWAY_AUTHENTICATED POST | /api/time/v1/pattern-versions/{versionId}/publish | APPROVED → PUBLISHED | tme_schedule_patterns:UPDATE, tme_owner_artifact_snapshots:INSERT |
| tim.pattern.cancel | GATEWAY_AUTHENTICATED POST | /api/time/v1/pattern-versions/{versionId}/cancel | DRAFT/VALIDATED/SIMULATED → CANCELLED | tme_schedule_patterns:UPDATE |
| tim.pattern.retire | GATEWAY_AUTHENTICATED POST | /api/time/v1/pattern-versions/{versionId}/retire | PUBLISHED → RETIRED | tme_schedule_patterns:UPDATE |
| tim.pattern.governance.receive | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/pattern-versions/{versionId}/governance | SUBMITTED/WITHDRAW_PENDING → APPROVED/REJECTED/CANCELLED | tme_schedule_patterns:UPDATE, tme_owner_artifact_snapshots:INSERT, tme_policy_governance_bindings:UPDATE |
| tim.leave-policy.create | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave-policy-versions | NEW DRAFT | abs_leave_plan_versions:INSERT, tme_artifact_revision_counters:UPSERT_MONOTONIC |
| tim.leave-policy.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave-policy-versions | READ/guarded side effect |  |
| tim.leave-policy.get | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave-policy-versions/{versionId} | READ/guarded side effect |  |
| tim.leave-policy.validate | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave-policy-versions/{versionId}/validate | DRAFT → VALIDATED/DRAFT | abs_leave_plan_versions:UPDATE, tme_policy_evaluation_reports:INSERT |
| tim.leave-policy.simulate | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave-policy-versions/{versionId}/simulate | VALIDATED → SIMULATED | abs_leave_plan_versions:UPDATE, tme_policy_evaluation_reports:INSERT |
| tim.leave-policy.submit | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave-policy-versions/{versionId}/submit | SIMULATED → SUBMITTED | abs_leave_plan_versions:UPDATE, tme_policy_governance_bindings:INSERT |
| tim.leave-policy.publish | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave-policy-versions/{versionId}/publish | APPROVED → PUBLISHED | abs_leave_plan_versions:UPDATE, tme_owner_artifact_snapshots:INSERT |
| tim.leave-policy.cancel | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave-policy-versions/{versionId}/cancel | DRAFT/VALIDATED/SIMULATED → CANCELLED | abs_leave_plan_versions:UPDATE |
| tim.leave-policy.retire | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave-policy-versions/{versionId}/retire | PUBLISHED → RETIRED | abs_leave_plan_versions:UPDATE |
| tim.leave-policy.governance.receive | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/leave-policy-versions/{versionId}/governance | SUBMITTED/WITHDRAW_PENDING → APPROVED/REJECTED/CANCELLED | abs_leave_plan_versions:UPDATE, tme_owner_artifact_snapshots:INSERT, tme_policy_governance_bindings:UPDATE |
| tim.group.create | GATEWAY_AUTHENTICATED POST | /api/time/v1/time-groups | NEW IMMUTABLE | tme_time_groups:INSERT |
| tim.group.members.assign | GATEWAY_AUTHENTICATED POST | /api/time/v1/time-groups/{groupId}/memberships | READ/guarded side effect | tme_time_group_memberships:INSERT, tme_owner_artifact_snapshots:INSERT |
| tim.group.members.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/time-groups/{groupId}/memberships | READ/guarded side effect |  |
| tim.schedule.create | GATEWAY_AUTHENTICATED POST | /api/time/v1/schedule-periods | NEW DRAFT | tme_schedule_periods:INSERT, tme_schedule_period_revision_counters:UPSERT_MONOTONIC |
| tim.schedule.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/schedule-periods | READ/guarded side effect |  |
| tim.schedule.get | GATEWAY_AUTHENTICATED GET | /api/time/v1/schedule-periods/{periodId} | READ/guarded side effect |  |
| tim.schedule.assign | GATEWAY_AUTHENTICATED POST | /api/time/v1/schedule-periods/{periodId}/assignments | DRAFT/ASSIGNED/VALIDATION_FAILED → ASSIGNED | tme_schedule_periods:UPDATE, tme_worker_schedule_assignments:DRAFT_REPLACE, tme_scheduled_segments:DRAFT_REPLACE, tme_owner_artifact_snapshots:INSERT |
| tim.schedule.assignments.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/schedule-periods/{periodId}/assignments | READ/guarded side effect |  |
| tim.schedule.segments.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/schedule-periods/{periodId}/segments | READ/guarded side effect |  |
| tim.schedule.validate | GATEWAY_AUTHENTICATED POST | /api/time/v1/schedule-periods/{periodId}/validate | ASSIGNED/VALIDATION_FAILED/VALIDATED/DRAFT → VALIDATED/VALIDATION_FAILED | tme_schedule_periods:UPDATE, tme_schedule_evaluation_counters:UPSERT_MONOTONIC, tme_schedule_evaluations:INSERT, tme_schedule_violation_lines:INSERT |
| tim.schedule.evaluation.get | GATEWAY_AUTHENTICATED GET | /api/time/v1/schedule-evaluations/{evaluationId} | READ/guarded side effect |  |
| tim.schedule.submit | GATEWAY_AUTHENTICATED POST | /api/time/v1/schedule-periods/{periodId}/submit | VALIDATED → SUBMITTED | tme_schedule_periods:UPDATE, tme_schedule_approval_bindings:INSERT |
| tim.schedule.withdraw | GATEWAY_AUTHENTICATED POST | /api/time/v1/schedule-periods/{periodId}/withdraw | SUBMITTED → WITHDRAW_PENDING | tme_schedule_periods:UPDATE, tme_schedule_approval_bindings:UPDATE |
| tim.schedule.approval.receive | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/schedule-periods/{periodId}/approval-decisions | SUBMITTED/CANCEL_PENDING/WITHDRAW_PENDING → APPROVED/REJECTED/CANCELLED | tme_schedule_periods:UPDATE, tme_schedule_approval_bindings:UPDATE, tme_owner_artifact_snapshots:INSERT |
| tim.schedule.publish | GATEWAY_AUTHENTICATED POST | /api/time/v1/schedule-periods/{periodId}/publish | APPROVED → PUBLISHED | tme_schedule_periods:UPDATE, tme_schedule_publication_receipts:INSERT, tme_schedule_assignment_events:INSERT, tme_schedule_active_intervals:INSERT |
| tim.schedule.publication.get | GATEWAY_AUTHENTICATED GET | /api/time/v1/schedule-publications/{publicationId} | READ/guarded side effect |  |
| tim.schedule.amend | GATEWAY_AUTHENTICATED POST | /api/time/v1/schedule-periods/{periodId}/amendments | NEW ASSIGNED (source PUBLISHED unchanged) | tme_schedule_periods:INSERT, tme_schedule_period_revision_counters:UPSERT_MONOTONIC, tme_worker_schedule_assignments:INSERT, tme_scheduled_segments:INSERT |
| tim.schedule.cancel | GATEWAY_AUTHENTICATED POST | /api/time/v1/schedule-periods/{periodId}/cancellations | DRAFT/ASSIGNED/VALIDATED/VALIDATION_FAILED/SUBMITTED/APPROVED → CANCELLED/CANCEL_PENDING | tme_schedule_periods:UPDATE, tme_schedule_approval_bindings:UPDATE |
| tim.schedule.approval.reconcile | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/schedule-periods/{periodId}/approval-reconciliation | CANCEL_PENDING/WITHDRAW_PENDING → CANCELLED | tme_schedule_approval_bindings:UPDATE, tme_schedule_periods:UPDATE, tme_owner_artifact_snapshots:INSERT |
| tim.schedule.published-cancel.create | GATEWAY_AUTHENTICATED POST | /api/time/v1/schedule-periods/{periodId}/published-cancellation-proposals | NEW DRAFT (source PUBLISHED unchanged) | tme_schedule_periods:INSERT, tme_schedule_period_revision_counters:UPSERT_MONOTONIC, tme_worker_schedule_assignments:INSERT |
| tim.leave.enrollment.create | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/enrollments | NEW ACTIVE | abs_worker_plan_enrollments:INSERT, abs_enrollment_decisions:INSERT, tme_owner_artifact_snapshots:INSERT |
| tim.leave.enrollment.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave/enrollments | READ/guarded side effect |  |
| tim.leave.enrollment.get | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave/enrollments/{enrollmentId} | READ/guarded side effect |  |
| tim.leave.enrollment.terminate | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/enrollments/{enrollmentId}/termination | ACTIVE → ENDED | abs_worker_plan_enrollments:UPDATE, abs_enrollment_decisions:INSERT |
| tim.leave.enrollment.reassess | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/enrollments/{enrollmentId}/eligibility-reassessments | READ/guarded side effect | abs_enrollment_decisions:INSERT |
| tim.leave.entitlement.run | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/entitlement-runs | NEW QUEUED | abs_entitlement_runs:INSERT, tme_owner_artifact_snapshots:INSERT |
| tim.leave.entitlement.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave/entitlement-runs | READ/guarded side effect |  |
| tim.leave.entitlement.get | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave/entitlement-runs/{runId} | READ/guarded side effect |  |
| tim.leave.entitlement.items.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave/entitlement-runs/{runId}/items | READ/guarded side effect |  |
| tim.leave.entitlement.cancel | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/entitlement-runs/{runId}/cancellations | QUEUED/RUNNING → CANCELLED/CANCEL_PENDING | abs_entitlement_runs:UPDATE |
| tim.leave.entitlement.lease | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/leave/entitlement-runs/{runId}/lease | QUEUED → RUNNING | abs_entitlement_runs:UPDATE |
| tim.leave.entitlement.execute-item | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/leave/entitlement-runs/{runId}/execute-item | READ/guarded side effect | abs_entitlement_run_items:INSERT, abs_entitlement_ledger_entries:INSERT, abs_ledger_revision_counters:UPSERT_MONOTONIC, abs_leave_grant_lots:INSERT, abs_leave_balance_projections:INSERT |
| tim.leave.entitlement.finalize | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/leave/entitlement-runs/{runId}/finalize | RUNNING/CANCEL_PENDING → SUCCEEDED/PARTIAL/FAILED/CANCELLED/CANCELLED_PARTIAL | abs_entitlement_runs:UPDATE |
| tim.leave.entitlement.mark-unknown | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/leave/entitlement-runs/{runId}/unknown | RUNNING → RESULT_UNKNOWN | abs_entitlement_runs:UPDATE |
| tim.leave.entitlement.reconcile | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/leave/entitlement-runs/{runId}/reconciliation | RESULT_UNKNOWN → SUCCEEDED/PARTIAL/QUEUED/FAILED | abs_entitlement_runs:UPDATE |
| tim.leave.request.create | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/requests | NEW DRAFT | abs_leave_requests:INSERT, abs_leave_request_segments:INSERT |
| tim.leave.request.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave/requests | READ/guarded side effect |  |
| tim.leave.request.get | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave/requests/{requestId} | READ/guarded side effect |  |
| tim.leave.request.segments.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave/requests/{requestId}/segments | READ/guarded side effect |  |
| tim.leave.request.submit | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/requests/{requestId}/submit | DRAFT/CORRECTION_REQUIRED → SUBMITTED | abs_leave_requests:UPDATE, abs_leave_approval_bindings:INSERT, abs_leave_reservations:INSERT |
| tim.leave.request.decide | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/requests/{requestId}/decisions | SUBMITTED → APPROVED/REJECTED | abs_leave_requests:UPDATE, abs_leave_approval_bindings:UPDATE, tme_owner_artifact_snapshots:INSERT, abs_entitlement_ledger_entries:INSERT, abs_ledger_revision_counters:UPSERT_MONOTONIC, abs_leave_reservations:UPDATE, abs_leave_lot_events:INSERT, abs_leave_balance_projections:INSERT |
| tim.leave.request.approval.receive | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/leave/requests/{requestId}/approval-decisions | SUBMITTED → APPROVED/REJECTED | abs_leave_requests:UPDATE, abs_leave_approval_bindings:UPDATE, tme_owner_artifact_snapshots:INSERT, abs_entitlement_ledger_entries:INSERT, abs_ledger_revision_counters:UPSERT_MONOTONIC, abs_leave_reservations:UPDATE, abs_leave_lot_events:INSERT, abs_leave_balance_projections:INSERT |
| tim.leave.request.withdraw | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/requests/{requestId}/withdraw | SUBMITTED → WITHDRAW_PENDING | abs_leave_requests:UPDATE, abs_leave_approval_bindings:UPDATE |
| tim.leave.request.cancel | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/requests/{requestId}/cancellations | DRAFT/APPROVED/SUBMITTED → CANCELLED/CANCELLED/CANCEL_PENDING | abs_leave_requests:UPDATE, abs_entitlement_ledger_entries:INSERT, abs_ledger_revision_counters:UPSERT_MONOTONIC, abs_leave_reservations:UPDATE, abs_leave_lot_events:INSERT, abs_leave_balance_projections:INSERT, abs_leave_approval_bindings:UPDATE |
| tim.leave.request.cancel-reconcile | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/leave/requests/{requestId}/cancellation-reconciliation | CANCEL_PENDING/WITHDRAW_PENDING → CANCELLED | abs_leave_requests:UPDATE, abs_leave_approval_bindings:UPDATE, abs_leave_reservations:UPDATE, tme_owner_artifact_snapshots:INSERT |
| tim.leave.request.amend | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/requests/{requestId}/amendments | NEW CORRECTION_REQUIRED (source APPROVED unchanged) | abs_leave_requests:INSERT, abs_leave_request_segments:INSERT |
| tim.leave.ledger.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave/ledger-entries | READ/guarded side effect |  |
| tim.leave.balance.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/leave/balances | READ/guarded side effect |  |
| tim.leave.ledger.reverse | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/ledger-entries/{entryId}/approved-reversals | READ/guarded side effect | abs_entitlement_ledger_entries:INSERT, abs_ledger_revision_counters:UPSERT_MONOTONIC, abs_leave_lot_events:INSERT, abs_leave_balance_projections:INSERT |
| tim.leave.lots.expiry-carryover | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/leave/enrollments/{enrollmentId}/lot-boundaries | READ/guarded side effect | abs_leave_lot_events:INSERT, abs_entitlement_ledger_entries:INSERT, abs_ledger_revision_counters:UPSERT_MONOTONIC, abs_leave_grant_lots:INSERT, abs_leave_balance_projections:INSERT |
| tim.leave.balance.restore | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/leave/enrollments/{enrollmentId}/restore-balance | READ/guarded side effect | abs_leave_balance_projections:UPSERT_REBUILD |
| tim.timecard.query | GATEWAY_AUTHENTICATED GET | /api/time/v1/timecards/{cardId} | READ/guarded side effect |  |
| tim.timecard.correct | GATEWAY_AUTHENTICATED POST | /api/time/v1/timecards/{cardId}/corrections | OPEN/REJECTED/CORRECTION_REQUIRED → OPEN | tme_time_cards:UPDATE, tme_time_ledger_entries:INSERT, tme_time_ledger_revision_counters:UPSERT_MONOTONIC |
| tim.timecard.submit | GATEWAY_AUTHENTICATED POST | /api/time/v1/timecards/{cardId}/submit | OPEN → SUBMITTED | tme_time_cards:UPDATE, tme_timecard_approval_bindings:INSERT |
| tim.timecard.decide | GATEWAY_AUTHENTICATED POST | /api/time/v1/timecards/{cardId}/decisions | SUBMITTED → APPROVED/REJECTED | tme_time_cards:UPDATE, tme_owner_artifact_snapshots:INSERT, tme_timecard_approval_bindings:UPDATE |
| tim.timecard.lock-from-close | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/timecards/{cardId}/close-lock | APPROVED → LOCKED | tme_time_cards:UPDATE |
| tim.timecard.reopen-successor | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/timecards/{cardId}/reopened-successors | NEW CORRECTION_REQUIRED (source LOCKED unchanged) | tme_time_cards:INSERT, tme_timecard_revision_counters:UPSERT_MONOTONIC |
| tim.availability.schedule.capture | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/schedule-availability-snapshots | NEW IMMUTABLE | tme_availability_snapshots:INSERT, tme_availability_snapshot_rows:INSERT, tme_snapshot_source_refs:INSERT, tme_owner_artifact_snapshots:INSERT, tme_availability_revision_counters:UPSERT_MONOTONIC |
| tim.availability.schedule.get | TIM_OWNER_WORKLOAD_ONLY GET | /internal/hris-time/v1/schedule-availability-snapshots/{snapshotId} | READ/guarded side effect |  |
| tim.availability.absence.capture | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/absence-availability-snapshots | NEW IMMUTABLE | tme_availability_snapshots:INSERT, tme_availability_snapshot_rows:INSERT, tme_snapshot_source_refs:INSERT, tme_owner_artifact_snapshots:INSERT, tme_availability_revision_counters:UPSERT_MONOTONIC |
| tim.availability.absence.get | TIM_OWNER_WORKLOAD_ONLY GET | /internal/hris-time/v1/absence-availability-snapshots/{snapshotId} | READ/guarded side effect |  |
| tim.availability.composed.capture | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/composed-availability-snapshots | NEW IMMUTABLE | tme_availability_snapshots:INSERT, tme_availability_snapshot_rows:INSERT, tme_snapshot_source_refs:INSERT, tme_owner_artifact_snapshots:INSERT, tme_availability_revision_counters:UPSERT_MONOTONIC |
| tim.availability.composed.get | TIM_OWNER_WORKLOAD_ONLY GET | /internal/hris-time/v1/composed-availability-snapshots/{snapshotId} | READ/guarded side effect |  |
| tim.schedule.wfm-publish-transaction | TIM_OWNER_WORKLOAD_ONLY POST | OWNER_SPI:TIM.CanonicalSchedulePublicationPort.v1#publishApproved | NEW PUBLISHED | tme_schedule_periods:INSERT, tme_schedule_period_revision_counters:UPSERT_MONOTONIC, tme_worker_schedule_assignments:INSERT, tme_scheduled_segments:INSERT, tme_schedule_publication_receipts:INSERT, tme_schedule_assignment_events:INSERT, tme_schedule_active_intervals:INSERT |
| tim.schedule.wfm-publication.query | TIM_OWNER_WORKLOAD_ONLY GET | OWNER_SPI:TIM.CanonicalSchedulePublicationPort.v1#findByCandidate | READ/guarded side effect |  |
| tim.rule.withdraw | GATEWAY_AUTHENTICATED POST | /api/time/v1/rule-versions/{versionId}/withdraw | SUBMITTED → WITHDRAW_PENDING | tme_work_rule_set_versions:UPDATE, tme_policy_governance_bindings:UPDATE |
| tim.shift.withdraw | GATEWAY_AUTHENTICATED POST | /api/time/v1/shift-versions/{versionId}/withdraw | SUBMITTED → WITHDRAW_PENDING | tme_shift_template_versions:UPDATE, tme_policy_governance_bindings:UPDATE |
| tim.pattern.withdraw | GATEWAY_AUTHENTICATED POST | /api/time/v1/pattern-versions/{versionId}/withdraw | SUBMITTED → WITHDRAW_PENDING | tme_schedule_patterns:UPDATE, tme_policy_governance_bindings:UPDATE |
| tim.leave-policy.withdraw | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave-policy-versions/{versionId}/withdraw | SUBMITTED → WITHDRAW_PENDING | abs_leave_plan_versions:UPDATE, tme_policy_governance_bindings:UPDATE |
| tim.policy.evaluation.get | GATEWAY_AUTHENTICATED GET | /api/time/v1/policy-evaluation-reports/{reportId} | READ/guarded side effect |  |
| tim.leave.enrollment.cancel | GATEWAY_AUTHENTICATED POST | /api/time/v1/leave/enrollments/{enrollmentId}/termination | ACTIVE → CANCELLED | abs_worker_plan_enrollments:UPDATE |
| tim.timecard.materialize | TIM_OWNER_WORKLOAD_ONLY POST | /internal/hris-time/v1/timecards/materialize | NEW OPEN | tme_time_cards:INSERT, tme_timecard_revision_counters:UPSERT_MONOTONIC |
| tim.effective-calendar.get | TIM_OWNER_WORKLOAD_ONLY GET | /internal/hris-time/v1/calendar-snapshots/{snapshotId} | READ/guarded side effect |  |
| tim.effective-work-rule.get | TIM_OWNER_WORKLOAD_ONLY GET | /internal/hris-time/v1/work-rule-snapshots/{snapshotId} | READ/guarded side effect |  |

## Remaining closing conditions

- TIM-G3-OPEN-001 (G3 / P0): independent semantic approval for all planned object/schema/state/source/fixtures; author cannot close own P0
- TIM-G3-OPEN-002 (G3 / P0): 17 owner read DTOs plus command contracts not canonical published/registered; exact HRM self/assignment/location + SYS configuration/calendar/context + Approval sources, producer/consumer compile and failclosed adapters unallocated
- TIM-G3-OPEN-003 (G3 / P0): proposed13 stream actual bootstrap/authority/receipt/digest/DS/principal guards and common pilot not wired; existing8/9 runtime scope preserved not reused
- TIM-G3-OPEN-004 (G3 / P0): new migration namespaces/touch manifests/runtime role/guards/effective interval exclusions and historical planned-column source disposition require approval; no blanket allocation
- TIM-G3-OPEN-005 (G3 / P0): legacy worker-only time ledger assignment binding exact schema/source identity and all legacy source semantics not independently approved; ambiguous rows fail closed
- TIM-G3-OPEN-006 (G3 / P0): root WFM proposed port contract name/DTO/segment/calendar/work-rule alias successor integration and normal semantic source graph validator must be cross-validated; no aliases count as authority
- TIM-G3-OPEN-007 (G3 / UNVERIFIED_SCOPE): 12 retained historical TIM operations (clock/interpreter/close/handoff/widget/export/receipt) and full BASE86 source restoration beyond bounded 004/005/006/011 not certified; PER BASE and HRM BASE exact prep still separately required
- TIM-G4-OPEN-008 (G4 / DOMAIN_IMPLEMENTATION): complete actual domain SQL/API/ledger/native journey acceptance after coding; not circular G3 prerequisite
- TIM-G6-OPEN-009 (G6 / PRODUCTION_AUTHORITY): customer identity/adoption, actual statutory/provider/deployment authority, no company/legal numerical approval claimed
- TIM-G3-OPEN-010 (G3 / P0): COMPLETED_SERVICE_MONTHS and ANNIVERSARY verified service-anchor/gap/leave continuity inputs require exact HRM employment-basis owner schema/source approval; current EffectiveAssignment DTO does not supply this basis, so these modes fail closed until required owner extension is canonical

The authoritative Gate remains CLOSED. Stable proposal authoring and structural checks do not approve Gate, allocate missing owner contracts or certify all86 families. Independent adversarial review and root exact owner-contract/authority integration are the next G3 decision steps; full domain implementation follows G4.

