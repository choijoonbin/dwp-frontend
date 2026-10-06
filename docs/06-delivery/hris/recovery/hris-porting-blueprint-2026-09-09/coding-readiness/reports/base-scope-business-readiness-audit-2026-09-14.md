# BASE 86 업무군 코딩 준비 독립 감사 — 2026-09-14

상태: `INDEPENDENT_READ_ONLY_AUDIT / G3_CLOSED / NOT_ALL86_PASS`. 이 보고서는 Gate 정본이나 승인 파일이 아닙니다. 현재 effective Gate는 `CLOSED_FAIL_SAFE`; historical `OPEN_G3_CODE` 100개 토큰은 실제 개방을 뜻하지 않습니다.

86개 가족(활성84·퇴역2), source 부모2269·자식10001의 source→target 구조 연결은 PASS입니다. 다만 현재 계약 P0 11개를 확인했으며, 업무 의미 전수 인증은 하지 않습니다. 69개 활성 가족은 확인된 G3 계약 P0에 연결되고 나머지15개 활성 가족도 독립 business oracle 검증이 미완료입니다. 퇴역2개는 no-code 결정이며 업무 PASS가 아닙니다.

읽기 기준 backend: `70c996fdafc011392056a1909a2e5222b240ded3`, integration/backend clean. 사용자 main dirty worktree·BE/FE·기존 정본·DB·container·process·commit은 변경하지 않았습니다. 두 신규 보고서만 작성했습니다.

## 감사 범위와 단계 경계

CSV source→target 및 테스트 할당은 Spreadsheets의 read-only precedent 방식으로 대조하고 bundled Python csv/json·Ruby YAML을 사용했습니다. 원본 workbook/CSV는 수정하거나 export하지 않았습니다. 모든86 target-family rationales를 검토하고8개 기존 static validator를 실행했습니다. 10001개 자식의 구조 연결은 validator가 확인했지만, 각 sanitized business field/operator를 전수 읽고 인증한 것은 아닙니다. Raw excluded/customer source·credential은 읽지 않았습니다. Sanitized parent evidence는 available2258/blocked9/retired2입니다.

G3는 전체 business CRUD 이전의 정확한 계획/API·SQL·typed 값·객체 상태·read/write·owner source/refetch·fixtures·negative/test allocation, 실제 shared DTO/SPI/generated binding/fail-closed adapter·consumer compile·common/pilot 증거와 현행 Gate reconciliation입니다. 전체 domain CRUD/SQL materialization/native 여정 실행은 G4입니다. 실제 customer identity authority/data/bootstrap/adoption 및 국가 규칙/provider production activation은 G6입니다. 모든 G4 operation을 먼저 구현해야 coding READY가 되는 순환 조건을 만들지 않습니다.

## 실제 저장 바이트와 static 검증

| 검증 | 결과 | 정확한 범위 |
| --- | --- | --- |
| coding-readiness/validate_target_family_resolution.py | PASS (exit0) | 86가족/2269부모/10001자식 structural closure |
| g0/validate_typed_contract_test_allocations.py | PASS (exit0) | 130 provider/consumer test path writer allocation |
| coding-readiness/validate_transport_schema_resolution.py | FAIL (exit1) | 175 operation parity,121 async receipts; baseline source resolution14 errors |
| coding-readiness/validate_contamination_decisions.py | PASS (exit0) | 13 explicit contamination retire decisions |
| coding-readiness/validate_information_architecture.py | PASS (exit0) | BASE76+modern22=98 IA nodes,46 task groups |
| coding-readiness/validate_cross_module_schema_contracts.py | PASS (exit0) | 21 canonical schemas,31 consumer bindings,52 XCON test paths |
| coding-readiness/validate_base_schema_postgres_feasibility.py | FAIL (exit1) | 116 static checks, People V1..V48 vs sealed V1..V46:3 errors; PostgreSQL not executed |
| coding-readiness/validate_source_provenance.py | PASS (exit0) | 168943 checks, no raw source reads; exact evidence digest/access closure |

계획 physical DDL은 HRM24+PER34+TIM31+PAY42+SYS32=163 `CREATE TABLE`입니다. base static feasibility는 SYS 제외131개를 분석했으며 본 감사에서 PostgreSQL을 실행하지 않았습니다. 이후 modern producer56+PAY consumer projection2는 별도계획이므로 BASE163과 섞어 성공 범위를 확장하지 않습니다. API/PEP/transport public175개는 HRM16/PER21/TIM28/PAY33/SYS77; owner internal APIs는 별도입니다. Synthetic fixture case specs는 HRM15/PER18/TIM13/PAY17/SYS60이나 이 숫자는 runtime 실행 또는 모든 API-valid payload를 증명하지 않습니다.

현행 source→target 정본은 [coding-readiness/target-family-resolution-register.csv](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/target-family-resolution-register.csv), slice/test 할당은 [coding-readiness/g3-slice-code-go-register.csv](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/g3-slice-code-go-register.csv), Gate는 [g0/current-g3-gate-decision.json](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/current-g3-gate-decision.json)입니다. JSON companion은45개 입력 SHA와 모든 validator 실제 출력을 보존합니다.

## 확인된 G3 P0와 closing conditions

### BASE-P0-001 — Historical migration seal and current owner allocation diverge

Current clean integration HEAD 70c996fdafc011392056a1909a2e5222b240ded3 contains People V47/V48, Auth V211/V212, Platform V231..V237 common hardening. Existing reservations start at those occupied versions. HRM/PER baseline static check rejects current48-file prefix; this does not mean historical V1..V46 SQL blobs were changed.

근거: g0/migration-allocation-register.csv (allocation_id=MIG-HRM-PEOPLE-47-69|MIG-SYS-AUTH-211-239|MIG-SYS-PLATFORM-231-259); coding-readiness/validate_base_schema_postgres_feasibility.py (actual default static result: 3 errors, current People V1..V48 compared with sealed V1..V46).

- Preserve sealed historical V1..V46 blobs/digests; approve an exact common-prefix successor and current baseline lineage independently.
- Reallocate create-only business versions after actual current high-water, with exact files/owner/history/stream and synchronized checkpoint/touch manifests.
- Do not widen historical validator range or renumber installed migrations to obtain PASS.

### BASE-P0-002 — Current baseline transport source cannot be resolved by historical worktree seal

175-operation parity/121 asynchronous authorized-receipt convergences remain structurally closed, but source resolution for GET/PUT baseline home-preferences fails because the historical validator rejects current worktree lineage and resolves to /__invalid_baseline__. It is a seal/source reconciliation failure, not proof that the real GET/PUT API disappeared.

근거: coding-readiness/transport-schema-resolution-register.csv (pep_binding_id=PEP-SYS-033|PEP-SYS-034; DWP_BACKEND@5670877de7a39e94e75021c7e23cbbb553296c90:contracts/openapi/gateway-public.json); coding-readiness/validate_transport_schema_resolution.py (actual default static result: HEAD drift and14 errors).

- Approve current exact common baseline successor and prove immutable historical source-reference bytes/current generated OpenAPI relation.
- Reconcile baseline references and named body-version CAS exception without substituting an unrelated current schema; rerun transport and published/current Gate validators.

### BASE-P0-003 — Self/worker identity lacks a canonical verified multi-employment source contract

Trusted tenant and authenticated principal do not imply worker identity. Read-only search of current People V1..V48 and historical G2 SQL found worker/person linkage and actor audit IDs, but no canonical verified effective principal↔person↔worker self-resolution relation. Body worker UUIDs may be authorized operator references; they cannot establish a self claim. Proposed HRM identity mapping remains DESIGN_PROPOSED, not canonical closure.

근거: coding-readiness/cross-module-canonical-schemas.v1.json (WorkerAssignmentSnapshot: personPublicId/workerPublicId/assignments; no authenticated-principal-to-worker mapping); session-evidence/tim/g2-transport-schemas.v1.json#/$defs/LeaveRequestCommand/required; session-evidence/per/g2-readiness/api-event-contracts.yaml (CreateGoalCommand.ownerPublicId; CreateCheckinCommand subjectWorkerPublicId/managerWorkerPublicId); dwp-people-server/src/main/resources/db/migration/V41__harden_hcm_entity_boundaries.sql (worker→person identity, not user/principal→worker link).

- Publish exact owner identity link schema/query DTO+SPI: tenant+principal, independent verification/provenance, valid half-open interval, linked person/worker/employment IDs and explicit multi-employment selfContext selection.
- Compile strict fail-closed shared producer/consumer adapters with synthetic zero/one/many/expired/revoked/cross-tenant link, body-self-claim and unrelated assignment negatives.
- Customer identity authority/adoption/link bootstrap is G6; full business SELF CRUD is G4, not a prerequisite for G3.

### BASE-P0-004 — Schedule policy CRUD is not the actual worker schedule lifecycle

All28 public operations offer schedule.query and work-rule-version create/validate/simulate/publish, but no registered native schedule-period/worker-assignment/segment create, assign, validate, submit, publish, amend or cancel command/write set. SchedulePage exposes DRAFT/PUBLISHED/CANCELLED schedule states without defining their aggregate source or materialization. Rule publication alone cannot identify worker/assignment/crew/shift/calendar/effective-period writes or preserve correction lineage.

근거: session-registers/hris-tim-source-coverage.csv: rows4,6,10,12,27 (TIM-SCHEDULE: crew/rotation/work-time/crew-change/flexible work source semantics;129 parents); session-evidence/tim/g2-api-event-contracts.json#/operations/2; session-evidence/tim/g2-api-event-contracts.json#/operations/3; session-evidence/tim/g2-transport-schemas.v1.json#/$defs/SchedulePage; session-evidence/tim/g2-physical-schema.sql:88 (tme_schedule_patterns; tme_worker_schedule_assignments at109; tme_scheduled_segments at130).

- Define exact native schedule aggregate API/state/column-source/read-write design, including worker/assignment and immutable shift/pattern/rule/calendar refs, effective timezone/DST intervals, approval/CAS, amendments/cancellation and restore/replay rules.
- Publish the TIM canonical schedule transaction/query snapshot port, fail-closed owner validation adapter and independent consumer compile fixtures before WFM depends on it.
- Allocate two deterministic configuration journeys and assignment-overlap, source stale, rejected approval, cross-tenant, SoD and stale amendment negatives; domain execution belongs to G4.

### BASE-P0-005 — Time rule and leave accrual policy are bounded strings, not exact typed semantics

ruleExpression is arbitrary string(max20000), leave rules are arrays of strings(max2000). Closed outer schema and bounded size do not define code-owned operators, units, accrual basis, eligibility, enrollment/source, carryover/caps/expiry, proration/calendar dependencies or deterministic precedence. One overtime threshold fixture gives a valid illustrative expected total, not a complete API-valid published policy contract.

근거: session-evidence/tim/g2-transport-schemas.v1.json#/$defs/RuleVersionCommand/properties/ruleExpression; session-evidence/tim/g2-transport-schemas.v1.json#/$defs/LeavePlanCommand/properties/rules; session-evidence/tim/synthetic-golden-fixtures.json#/cases/3; session-evidence/tim/g2-physical-schema.sql:422 (abs_worker_plan_enrollments).

- Register closed rule AST or exact grammar+typed operator/input/output registry; reject executable scripts/unknown operators, unit mismatch and arbitrary customer literals.
- Define immutable policy versions, owner schema/source/refetch provenance, worker-plan enrollment generation and replay/cancel/reversal write sets.
- Provide API-valid two-policy synthetic fixtures with exact quantities/rounding/calendar/eligibility/negative results; optional statutory policy approval/activation remains G6.

### BASE-P0-006 — Timecard response state cannot be projected literally from planned SQL

Response enum is OPEN/SUBMITTED/APPROVED/REJECTED/CLOSED, while table status is OPEN/SUBMITTED/APPROVED/REJECTED/LOCKED/CORRECTION_REQUIRED. CLOSED is absent in SQL; LOCKED/CORRECTION_REQUIRED are absent in response. No explicit typed domain projection mapping justifies collapsing locked/needs-correction into closed.

근거: session-evidence/tim/g2-transport-schemas.v1.json#/$defs/TimecardResponse/properties/state/enum; session-evidence/tim/g2-physical-schema.sql:340 (ck_tme_time_card_status).

- Approve one object-state vocabulary or explicit closed projection mapping with source/guard definition, preserving lock vs close vs corrective lifecycle.
- Allocate source enum completeness and every legal/illegal transition/projection fixture before implementation; do not add unguarded storage states only to match counts.

### BASE-P0-007 — HRM employment events and patches do not yet define event-specific typed change/write schemas

LEAVE/RETURN/HIRE/REHIRE/CORRECTION event codes exist; absence/reinstatement ownership transfer to HRM is sensible. They are not wholly missing lifecycles. However, changes[field,value] permits untyped scalar values and EmployeeChange patch accepts arbitrary object/array values under schemaKey/version without a registered event-specific fieldset/source/write-set graph here. HIRE requires an existing assignmentPublicId; native first person/worker/relationship/assignment admission and separation task completion/correction source commands are not exact in the22 HRM endpoint catalog. Source-shaped absence-cases is noncanonical, so it cannot substitute for those contracts.

근거: coding-readiness/hrm-transport-schema-supplement.v1.json#/$defs/AssignmentEventCommand; coding-readiness/hrm-transport-schema-supplement.v1.json#/$defs/EmployeeChangeCommand/properties/patch/items; session-registers/hris-tim-source-coverage.csv: rows20,31,33,307,496,497 (leave-of-absence/reinstatement moved to HRM absence-cases|EmploymentChanged); session-evidence/hrm/g2-readiness/state-guard-idempotency-recovery.md (Create person/worker guard; separation requires downstream tasks and post-irreversible reversal/return/rehire).

- Publish eventType-discriminated exact body/record/source/write contracts and registered patch schema versions for native admission, appointments, leave/return, concurrent employment, termination and correction.
- Bind relationship/assignment/org/position/config refs to the proper tenant-bound owner snapshot or local resolver; no first-path/correlation/business-key UUID substitution.
- Specify separation task command/query/callback and post-irreversible successor semantics with source versions and existing historical facts retained. G4 implements these operations; G3 approves exact plan and shared owner source contracts.

### BASE-P0-008 — Performance declares multi-aggregate lifecycles whose command/owner signal coverage is incomplete

Catalog has create/check-in, create-feedback, append-calibration, publish-results and open-appeal, but not exact cycle activation/close trigger, goal approval/complete/return, feedback response/decline/release, check-in complete/ack, calibration session create/submit/approve/lock, result compute/validate/approve, appeal review/resolve/withdraw/close commands or owner signal definitions. Therefore final states are not reachable through the registered public/internal command graph unless undocumented jobs/callbacks are assumed. Goal RETURNED text is absent from response enum; feedback AGGREGATED and check-in ACKNOWLEDGED/DRAFT vocabulary also diverge. Caller previousValue/distributionImpact cannot be the authoritative score/cohort baseline.

근거: session-evidence/per/g2-readiness/api-event-contracts.yaml (paths:21 public operations +2 owner-internal operations); session-evidence/per/g2-readiness/state-guard-idempotency-recovery.md (Cycle/Goal/Review/Feedback/Check-in/Calibration/Result/Appeal machines); session-evidence/per/g2-readiness/api-event-contracts.yaml:906 (CalibrationAdjustmentCommand.distributionImpact supplied by caller); session-evidence/per/g2-readiness/api-event-contracts.yaml:1050 (PerformanceAppealResolved event with no exact resolve command).

- Bind each real aggregate transition to exact operationId or typed trusted owner signal, write set, PEP/SoD/source version and receipt/outbox schema; remove unsupported lifecycle claims only by explicit approved scope decision.
- Refetch/calculatively derive result/calibration baseline and distribution from immutable owner snapshots; treat caller values only as compare assertions.
- Provide per-aggregate reachability/terminal/no-submit-after-lock fixtures and full producer source/input/output schemas before G4 lifecycle implementation.

### BASE-P0-009 — Performance population freeze closed allOf schema rejects every required valid input

FreezePopulationCommand allOf combines closed PopulationPreviewCommand(required populationRuleId/workforceSnapshotId/workforceSnapshotRevision) with a second closed object permitting only required previewContentHash. Base rejects previewContentHash and extension rejects all three base fields. A constructive property-set witness on actual saved YAML confirms the required-property intersection is unsatisfiable. This is a mechanical JSON-Schema closure proof, not a full standards-engine validation run.

근거: session-evidence/per/g2-readiness/api-event-contracts.yaml:719#/components/schemas/FreezePopulationCommand; session-evidence/per/g2-readiness/api-event-contracts.yaml:711#/components/schemas/PopulationPreviewCommand.

- Flatten the closed schema or use a correctly supported allOf/unevaluatedProperties construction, retaining all four typed required fields and no unknown properties.
- Execute standard JSON-Schema/OpenAPI valid+missing+unknown-field fixtures and exact consumer DTO compile test after an approved successor; keep historical YAML immutable.

### BASE-P0-010 — Payroll foundation/input freeze and formula wire payload lack exact authoritative artifact/DSL binding

Foundation create passes payloadDigest only with configCode/version/effective scope; run.prepare passes inputSnapshotDigest without exact immutable input IDs/revisions/source vector or declared owner materialization query binding. A digest can validate bytes only after actual authoritative artifact resolution. Formula wire expression is a string, while golden validExpression is a typed MULTIPLY graph and principles require typed-bounded-dsl-only. No exact string grammar or closed AST registry in these audited artifacts bridges that contract. Existing six decimal value types and typed worker entry discriminants are meaningful hardening, but do not complete foundation/formula/source semantics.

근거: session-evidence/pay/g2-transport-schemas.v1.json#/$defs/VersionedConfigCommand; session-evidence/pay/g2-transport-schemas.v1.json#/$defs/RunCommand; session-evidence/pay/g2-transport-schemas.v1.json#/$defs/FormulaCommand/properties/expression; session-evidence/pay/synthetic-golden-fixtures.json#/cases/1/input/validExpression; session-evidence/pay/g2-api-event-contracts.json#/principles/formulaExecution.

- Define exact foundation artifact payload/ref/import+owner refetch schema and run input source vector/snapshot sealing rule, including HRM/TIM/PER current authorized revision and reopen/supersede invalidation.
- Publish typed bounded formula AST or exact grammar/operator/type/unit/error registry, closed return/currency/rounding-policy binding and dependency graph/source schema.
- Allocate API-valid two-config calculation+retro/off-cycle/source-stale/unknown-function/cycle/unit/currency/forged-digest fixtures; implementation and complete payroll runtime journeys are G4.

### BASE-P0-011 — WFM availability must be a TIM-orchestrated multi-owner snapshot, not HRM-owned calculation

Current proposal explicitly owner=TIM/notOwner=HRM and composes HRM effective assignment/location, TIM absence availability/canonical schedule, PER WFM skill vocabulary. Root corrected the fixture alias during this audit to TIM.WfmPlanningInputSnapshot.v1 and PER.WfmSkillVocabularySnapshot.proposal.v1. The earlier HRM.WorkforceAvailabilitySnapshot alias is no longer the current fixture defect. Neither corrected label nor expectation-only tests publish the canonical contracts. Historical TIM G2 provides only ClosedTimeResult snapshot, and XCON21 lacks these ports.

근거: coding-readiness/cross-module-contract-register.csv (canonical21: no TIM availability/schedule planning-input or PER skills vocabulary contract); session-evidence/tim/g2-api-event-contracts.json#/providedSnapshots; coding-readiness/semantic-remediation/tim-wfm-exact.proposal.v1.json#/planningInputOwnerDecision; coding-readiness/semantic-remediation/sys-tim-synthetic-acceptance.v1.json#/fixtures/0/inputs/ownerSnapshots/availability.

- Independently register exact producer operation/response schema and DTO+SPI for HRM employment/assignment/location, TIM approved leave/work arrangement/schedule availability, PER skill/taxonomy/proficiency evidence.
- TIM orchestrates an authorized tenant/worker/assignment/asOf/effective interval/revision join; HRM does not calculate TIM/PER rules and SYS does not join owner databases.
- Define immutable source vector/refetch/staleness/interval-intersection/privacy semantics and strict negative compile/source fixtures; full WFM business execution is G4, production provider activation G6.

## 선택적 국가·provider / source restoration 미인증 범위

2269 parents/10001 children have transitive resolution and3 pinned retired child overrides; child target_api_event_candidate is noncanonical. This audit did not inspect every sanitized child business value/rule or every excluded/blocked source byte. Retirement country workflows are mapped to generic activation/run/results, but that does not independently prove all retirement-specific case/eligibility/basis/output/correction semantics are planned. 13 contamination retire decisions are explicit and structurally validated; no customer rates, BENSK/ADDSK/raw scripts should be restored into generic core.

- For every retained source family, approve source requirement→exact target object/typed field/rule/operation/event/fixture/negative/source-restore matrix with explicit consolidation/exclusion rationale; an unsupported semantic must remain OPEN, not hidden behind generic counts.
- Define generic optional pack/provider DTO/SPI and fail-closed feature-disabled/conformance fixtures at G3 where planned; actual jurisdiction rules/official approval/customer data/provider adoption are G6.
- Do not treat proposed historical traceability or mechanically inherited child target as an independently verified business oracle; no all86 PASS claim.

TIM leave-of-absence/reinstatement source14행은 실제 고용 휴직/복직이므로 HRM Employment 소유로 이동하는 방향은 타당합니다. 일반 휴가 신청/승인/스케줄·가용시간 계산까지 HRM 소유가 되는 것은 아닙니다. HRM enum에 LEAVE/RETURN/REHIRE가 존재하므로 'return lifecycle 전무'라고 판단하지 않습니다. 핵심은 eventType별 typed body/source/write/state 계획과 신뢰 가능한 owner SPI가 아직 정본으로 연결되지 않았다는 것입니다.

현재 WFM proposal과 fixture는 TIM owner로 교정되었습니다. `planningInputOwnerDecision`은 HRM assignment/location, TIM approved leave/availability/canonical schedule, PER skill/taxonomy/proficiency를 TIM에서 compose한다고 명시합니다. 현재 fixture availability label은 `TIM.WfmPlanningInputSnapshot.v1`, skills label은 `PER.WfmSkillVocabularySnapshot.proposal.v1`입니다. earlier HRM availability alias는 현재 defect로 보고하지 않습니다. expectation-only21tests나 owner label은 unpublished canonical DTO/SPI를 대신하지 않습니다.

## 보존해야 하는 준비의 실제 장점

- All86 families have explicit source→target consolidation/exclusion rationales and resolved references;2 families are decision-only retired, with3 pinned retired child overrides. 한계: Structural transitive closure, not every retained child semantic restoration.
- 175 public API/PEP tuples,175 transport bindings,121 async→authorized receipt convergences and130 exact provider/consumer test writer allocations exist. 한계: Transport source resolution currently FAIL14; allocation is not an executed consumer test result.
- XCON21 closed canonical typed schemas have pinned normalized digests, producer/consumer generated import and52 XCON test bindings. 한계: Identity/self, native schedule/availability/skills owner ports are not in existing21.
- TIM→PAY ClosedTimeResult and PER→PAY ApprovedCompensationPlanSnapshot specify immutable owner refetch, typed decimal/unit/currency, bounded streaming, staged atomic count/sequence/digest validation and reopen/supersede failure modes. 한계: This audit does not independently rerun full-domain producer/consumer runtime.
- Shared access/SoD/effective-dating/receipt sealed-originating authorization, controlled object metadata/scan snapshot and typed widget privacy are concretely planned, not menu-only API counts. 한계: PER/HRM state docs still contain stale idempotency tuple/state prose; approved successor must resolve contradictions against current shared protocol.

특히 immutable ClosedTimeResult/ApprovedCompensationPlanSnapshot의 owner refetch·reopen/supersede deny·decimal/unit/currency·bounded streaming·staged atomic count/sequence/digest는 의미 있는 공통 계약입니다. 그것을 identity/schedule/rule/source 빈틈 또는 전체 business runtime PASS로 확대해 해석하지 않습니다. HRM/PER state 문서의 구 idempotency tuple prose도 현재 caller/action-bound shared receipt 정본과 successor에서 명시적으로 합치시켜야 합니다.

## 86행 가족별 감사 범위

`OPEN` = 확인된 G3 계약 P0 연관+나머지 업무 의미 미인증, `UNVERIFIED` = 독립 business oracle 미인증(오류가 없다는 PASS 아님), `RETIRED` = 승인된 no-code 결정. 각 row의 exact original refs/rationale·slice row·migration allocation은 JSON에 있으며 원본 TFR row는 아래에 표시합니다.

| TFR row | 가족 / source capability | 부모 | 판단 | finding IDs |
| --- | --- | ---: | --- | --- |
| 2 | TFR-HRM-001 / settings-workflow | 34 | OPEN | P0-001 |
| 3 | TFR-HRM-002 / dwp-experience | 10 | OPEN | P0-001, P0-002 |
| 4 | TFR-HRM-003 / hr-operations-home | 19 | OPEN | P0-001 |
| 5 | TFR-HRM-004 / hr-people | 133 | OPEN | P0-001, P0-003, P0-007 |
| 6 | TFR-HRM-005 / hr-organization-positions | 43 | OPEN | P0-001, P0-007, P0-011 |
| 7 | TFR-HRM-006 / OUT_OF_SCOPE.BENSK / OUT_OF_SCOPE.TECHNICAL_DUPLICATE | 23 | RETIRED | P0-001, SCOPE-012 |
| 8 | TFR-HRM-007 / hr-appointments | 31 | OPEN | P0-001, P0-007 |
| 9 | TFR-HRM-008 / hr-employment-assignments | 18 | OPEN | P0-001, P0-003, P0-007, P0-011 |
| 10 | TFR-HRM-009 / hr-certificates-documents | 21 | OPEN | P0-001, P0-003 |
| 11 | TFR-HRM-010 / hr-employee-change-requests | 73 | OPEN | P0-001, P0-003, P0-007 |
| 12 | TFR-HRM-011 / hr-contracts-compensation-basis | 30 | OPEN | P0-001, P0-003 |
| 13 | TFR-HRM-012 / hr-data-quality | 49 | OPEN | P0-001 |
| 14 | TFR-HRM-013 / hr-exit-return | 23 | OPEN | P0-001, P0-007 |
| 15 | TFR-HRM-014 / settings-documents-communications | 12 | OPEN | P0-001 |
| 16 | TFR-HRM-015 / dwp-extensibility | 6 | OPEN | P0-001 |
| 17 | TFR-HRM-016 / settings-reference | 52 | OPEN | P0-001 |
| 18 | TFR-HRM-017 / settings-operations | 6 | OPEN | P0-001 |
| 19 | TFR-PAY-001 / PAY-PLATFORM-NOTIFICATION | 7 | UNVERIFIED | business oracle |
| 20 | TFR-PAY-002 / PAY-CONNECTOR | 7 | UNVERIFIED | business oracle |
| 21 | TFR-PAY-003 / PAY-KR-INSURANCE | 34 | UNVERIFIED | SCOPE-012 |
| 22 | TFR-PAY-004 / PAY-RETIREMENT | 119 | UNVERIFIED | SCOPE-012 |
| 23 | TFR-PAY-005 / PAY-KR-TAX | 16 | UNVERIFIED | SCOPE-012 |
| 24 | TFR-PAY-006 / PAY-ELEMENT-FORMULA | 63 | OPEN | P0-010 |
| 25 | TFR-PAY-007 / PAY-FOUNDATION | 13 | OPEN | P0-010 |
| 26 | TFR-PAY-008 / PAY-PAYMENT | 7 | UNVERIFIED | business oracle |
| 27 | TFR-PAY-009 / PAY-PAYSLIP | 20 | OPEN | P0-003 |
| 28 | TFR-PAY-010 / PAY-RETRO-OFFCYCLE | 48 | UNVERIFIED | business oracle |
| 29 | TFR-PAY-011 / PAY-CALCULATION | 12 | OPEN | P0-010 |
| 30 | TFR-PAY-012 / PAY-RESULT-TRACE | 32 | UNVERIFIED | business oracle |
| 31 | TFR-PAY-013 / PAY-RUN-PREPARE | 23 | OPEN | P0-010 |
| 32 | TFR-PAY-014 / PAY-STATUTORY-DEDUCTION | 4 | OPEN | P0-010 |
| 33 | TFR-PAY-015 / PAY-DASHBOARD | 7 | OPEN | P0-003 |
| 34 | TFR-PAY-016 / PAY-WORKER-INPUT | 91 | OPEN | P0-008, P0-010 |
| 35 | TFR-PAY-017 / PAY-YEA-HYBRID | 34 | UNVERIFIED | SCOPE-012 |
| 36 | TFR-PAY-018 / PAY-PLATFORM-AUTOMATION | 5 | UNVERIFIED | business oracle |
| 37 | TFR-PAY-019 / PAY-PLATFORM-CONFIG | 13 | OPEN | P0-010 |
| 38 | TFR-PAY-020 / PAY-TIME-PROJECTION | 19 | OPEN | P0-010 |
| 39 | TFR-PAY-021 / PAY-HRM-PROJECTION | 6 | OPEN | P0-007, P0-010 |
| 40 | TFR-PER-001 / PER-NOTIFICATION-001 | 2 | OPEN | P0-001 |
| 41 | TFR-PER-002 / PER-CALIBRATION-001 | 36 | OPEN | P0-001, P0-008 |
| 42 | TFR-PER-003 / PER-CHECKIN-001 | 27 | OPEN | P0-001, P0-008 |
| 43 | TFR-PER-004 / PER-CONFIG-001 | 12 | OPEN | P0-001 |
| 44 | TFR-PER-005 / PER-CYCLE-001 | 8 | OPEN | P0-001, P0-008 |
| 45 | TFR-PER-006 / PER-POPULATION-001 | 42 | OPEN | P0-001, P0-008, P0-009 |
| 46 | TFR-PER-007 / PER-HOME-001 | 5 | OPEN | P0-001, P0-003 |
| 47 | TFR-PER-008 / PER-FEEDBACK-001 | 14 | OPEN | P0-001, P0-008 |
| 48 | TFR-PER-009 / PER-GOAL-001 | 77 | OPEN | P0-001, P0-003, P0-008 |
| 49 | TFR-PER-010 / PER-INTEGRATION-001 | 6 | OPEN | P0-001 |
| 50 | TFR-PER-011 / PER-MONITOR-001 | 27 | OPEN | P0-001 |
| 51 | TFR-PER-012 / PER-RESULT-001 | 35 | OPEN | P0-001, P0-008 |
| 52 | TFR-PER-013 / PER-REVIEW-001 | 26 | OPEN | P0-001, P0-003, P0-008, P0-009 |
| 53 | TFR-PER-014 / PER-TEMPLATE-001 | 22 | OPEN | P0-001, P0-008 |
| 54 | TFR-PER-015 / PER-PLATFORM-001 | 4 | OPEN | P0-001 |
| 55 | TFR-PER-016 / PER-WORKFORCE-PROJECTION-001 | 6 | OPEN | P0-001, P0-007, P0-011 |
| 56 | TFR-SYS-001 / DWP.GOVERNANCE.AUDIT_EVIDENCE | 16 | OPEN | P0-001 |
| 57 | TFR-SYS-002 / DWP.OPERATIONS.OBSERVABILITY | 5 | OPEN | P0-001 |
| 58 | TFR-SYS-003 / DWP.APPROVAL.WORKFLOW | 10 | OPEN | P0-001 |
| 59 | TFR-SYS-004 / DWP.IDENTITY.PRODUCT_ACCESS | 39 | OPEN | P0-001 |
| 60 | TFR-SYS-005 / DWP.COMMUNICATION.TEMPLATES | 12 | OPEN | P0-001 |
| 61 | TFR-SYS-006 / DWP.AUTOMATION.CONTROL_PLANE | 10 | OPEN | P0-001 |
| 62 | TFR-SYS-007 / HRIS.CONFIG.REFERENCE_DATA | 37 | OPEN | P0-001 |
| 63 | TFR-SYS-008 / DWP.INTEGRATION.CONTROL_PLANE | 19 | OPEN | P0-001 |
| 64 | TFR-SYS-009 / DWP.OBJECT.CONTROLLED_TRANSFER | 2 | OPEN | P0-001 |
| 65 | TFR-SYS-010 / DWP.DATA.GOVERNANCE | 9 | OPEN | P0-001 |
| 66 | TFR-SYS-011 / DWP.TENANT.ENTERPRISE_DIRECTORY | 19 | OPEN | P0-001 |
| 67 | TFR-SYS-012 / HRIS.EXPERIENCE.COMPOSITION | 7 | OPEN | P0-001, P0-002, P0-003 |
| 68 | TFR-SYS-013 / DWP.PLATFORM.RETIRED_LEGACY_PATH | 4 | RETIRED | P0-001, SCOPE-012 |
| 69 | TFR-TIM-001 / TIM-APPROVAL | 7 | UNVERIFIED | business oracle |
| 70 | TFR-TIM-002 / TIM-PLATFORM-NOTIFICATION | 1 | UNVERIFIED | business oracle |
| 71 | TFR-TIM-003 / TIM-LEAVE-ABSENCE | 14 | OPEN | P0-007 |
| 72 | TFR-TIM-004 / TIM-PLATFORM-AUTOMATION | 5 | UNVERIFIED | business oracle |
| 73 | TFR-TIM-005 / TIM-PLATFORM-CONFIG | 13 | OPEN | P0-005 |
| 74 | TFR-TIM-006 / TIM-CLOCK | 6 | OPEN | P0-003 |
| 75 | TFR-TIM-007 / TIM-CLOSE-HANDOFF | 22 | OPEN | P0-006 |
| 76 | TFR-TIM-008 / TIM-CONNECTOR | 7 | UNVERIFIED | business oracle |
| 77 | TFR-TIM-009 / TIM-ANALYTICS | 20 | UNVERIFIED | business oracle |
| 78 | TFR-TIM-010 / TIM-INTERPRETATION | 26 | OPEN | P0-004, P0-005 |
| 79 | TFR-TIM-011 / TIM-LEAVE-KR | 28 | OPEN | P0-005, SCOPE-012 |
| 80 | TFR-TIM-012 / TIM-LEAVE-LEDGER | 32 | OPEN | P0-005 |
| 81 | TFR-TIM-013 / TIM-LEAVE-POLICY | 29 | OPEN | P0-005 |
| 82 | TFR-TIM-014 / TIM-LEAVE-REQUEST | 77 | OPEN | P0-003, P0-005, P0-011 |
| 83 | TFR-TIM-015 / TIM-OVERTIME | 82 | OPEN | P0-004, P0-005, P0-006 |
| 84 | TFR-TIM-016 / TIM-SCHEDULE | 129 | OPEN | P0-003, P0-004, P0-005, P0-011 |
| 85 | TFR-TIM-017 / TIM-TIMECARD | 42 | OPEN | P0-003, P0-006 |
| 86 | TFR-TIM-018 / TIM-DASHBOARD | 20 | OPEN | P0-003 |
| 87 | TFR-TIM-019 / TIM-HRM-PROJECTION | 8 | OPEN | P0-004, P0-007, P0-011 |

## ROOT 최종 통합에 필요한 정확한 다음 단계

- Per retained family: named source requirement→business object/effective facts→closed typed request/record/response/event→allowed real transition/trusted signal→transaction write set→column-source/ref resolver→owner snapshot refetch→tenant/population/field/SoD rule→API-valid two-config journey/negative/test allocation.
- Retired/consolidated child keeps semantic decision and proof of preserved behavior or intentional exclusion; no forced one-to-one legacy screen/table count.
- Independently verify column identity/provenance, unit/currency/decimal/calendar precision and all terminal reachability, correction/history/reopen semantics.
- A named owner alias, businessKey/digest, UUID shape or test count alone cannot establish source authority; unresolved source/identity stays OPEN.
- Complete native business implementations/runtime journeys are G4; real customer identity/statutory/provider activation G6.

- Approve exact canonical owner-contract successors and source semantic bindings; run independent source/contract validator on actual saved candidate, not label bypass.
- Approve common stream/role/receipt/DS/identity source scaffolding and strict shared adapters with consumer compile + bounded pilot evidence.
- Reconcile current allocation/common SHA/source seals/current capacity/checkpoint/published Gate truth. This report does not run --write-report or mutate authoritative Gate.

본 보고서는 authoritative Gate를 변경하거나 open을 선언하지 않습니다. source owner alias/UUID shape/correlation/businessKey/digest 또는 count만으로 closure 처리하지 않으며, 미정 계약은 OPEN으로 유지합니다.
