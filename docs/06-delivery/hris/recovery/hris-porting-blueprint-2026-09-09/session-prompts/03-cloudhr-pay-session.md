# 세션 프롬프트 — HRIS-PAY

`00-common-session-contract.md`를 최우선 계약으로 읽고, SKKF `cloudhr-pay`와 프론트 `pay + yea`의 급여·보험·퇴직·연말정산 능력을 DWP Payroll bounded context로 완전 이관하라. 금액 결과의 의미가 검증되기 전에는 레거시 산식을 추측하거나 화면/API 수로 진척을 주장하지 않는다.

## 현재 착수 상태 — 2026-09-14

현재 `NO_G3_START`다. 아래 G0의 `6f1ed92.../c2b3b...`는 역사적 code-entry 기준이며 최신 작업공간이나 새 공통 코드의 승인 baseline이 아니다. 실제 착수 기준은 Control이 현재 paired commit/tree·공통 계약·환경·검증을 묶어 게시한 successor baseline만 사용한다. `G2_READY`는 역사적 설계 추적 상태이지 전체 업무 의미 또는 G3 승인이라는 뜻이 아니다. `coding-readiness/reports/readiness-recovery-2026-09-14.md`와 실제 published Gate를 우선 확인한다. 후속 proposal은 독립 검증·정본 승계 전 구현 지시 정본으로 사용하지 않는다.

모듈 업무설계 P0의 정본 successor는 `coding-readiness/module-exact-business-start-canonical.v1.json`이다. PAY는 그 파일의 `BASE-P0-010`, `modules.HRIS-PAY`, `module-exact-business-schemas.v1.json` 및 `module-exact-business-lineage-register.v1.csv`를 구현 시작 계약으로 사용한다. foundation은 digest-only가 아니라 full typed artifact, run은 exact multi-owner input source vector, formula는 closed typed AST이며 retirement/YEA는 provider-neutral case와 optional signed pack 경계를 따른다. 세션 첫 검증에 `node coding-readiness/validate_module_exact_business_start.cjs --self-test --compact`를 추가한다. 이 정본은 PAY exact-business **설계** P0만 닫으며 공통 owner adapter·migration/current-source seal·두 LIVE Gate를 대신하거나 `NO_G3_START`를 자체 변경하지 않는다.

## G0 실행 바인딩

- 작업 루트: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/pay`
- Backend: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/pay/backend`, branch `codex/hris-pay-g1-backend-20260910`, code-entry base `787f25753a72dc5f0fbbb06783205c0bff6635a5`
- Frontend: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/pay/frontend`, branch `codex/hris-pay-g1-frontend-20260910`, base `c658679ef377f43ec4f9fec7e7433eb98f46970e`
- G1 evidence 기준 루트: `/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09` (worktree cwd 기준 상대경로 사용 금지)
- 허용된 읽기 전용 정제 분석 뷰: `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/pay`, `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/frontend`
- artifact별 접근 판정은 `/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/source-security-evidence/coverage-sanitized-access-register.csv`의 이 세션 행만 사용한다. 원본 SKKF checkout과 `.codex-worktrees/hris/source/*` raw snapshot 직접 접근은 금지한다. `SECURITY_BLOCKED_UNKNOWN`의 원문 bytes는 열지 않으며, G1 결정대장에 기록된 안전한 DWP 대체 계약만 구현한다.
- 첫 행동은 `python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact`로 최신 `COMMITTED_OPEN_AUTHORITATIVE_LIVE` 전환행과 전역 봉인을 함께 확인한 뒤, `coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact`, `g0/validate_code_checkpoint.py --check-live --session HRIS-PAY`, `coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-PAY`을 이 순서로 실행하는 것이다. scoped 두 명령은 global immutable/static 정본과 PAY paired worktree만 재검증하며 다른 모듈의 진행 중 dirty/advanced HEAD 때문에 PAY를 차단하지 않는다. authority·seal-only·scoped 검증 중 하나라도 실패하면 시작하지 않는다. 현재 최대 Gate는 `G3`이며 `07-g3-full-coding-execution-contract.md`를 함께 적용한다.

```text
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-PAY
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-PAY
```
- 실제 변경 전 `coding-readiness/g3-slice-code-go-register.csv`에서 자기 명명 slice와 `G3-CODE-GO-*` 토큰을 선택하고 `validate_g3_slice_code_go.py --compact` 및 typed 변경 경로 `--touch-manifest` 검증을 통과한다. 행에 선할당된 실행 명령과 G4 runbook·telemetry·migration clean/upgrade·worker recovery·acceptance evidence 경로를 사용한다.
- 화면·route 작업 전 `coding-readiness/hris-information-architecture-register.csv`, `hris-shell-navigation-register.csv`, `hris-workbench-task-group-register.csv`, `09-information-architecture-contract.md`를 읽고 `python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_information_architecture.py --compact` 및 같은 절대 경로의 `--self-test --compact`를 통과시킨다. 단일 `/hr/home`은 SYS가 소유하는 widget composition이며 메뉴 dump가 아니다. PAY는 자기 representative workbench landing/overview와 기여 widget만 소유하고 sidebar는 7개 workbench entry와 46개 내부 task group 계약을 따른다.
- 모듈 간 snapshot/event는 `coding-readiness/cross-module-canonical-schemas.v1.json`와 `cross-module-schema-binding-register.csv`만 사용하고 `validate_cross_module_schema_contracts.py --compact` 및 `--self-test --compact`를 통과시킨다. 금액 wire/storage는 `coding-readiness/decimal-value-types.v1.json`, 물리 테이블은 `physical-owner-prefix-register.csv`의 Payroll 소유권·schema·`pay_` prefix를 따르며 `validate_physical_owner_prefixes.py --compact`를 통과시킨다.
- DEP-019 consumer는 `validate_compensation_snapshot_v2_authority.py --compact`와 `validate_compensation_snapshot_v2_authority.py --self-test --compact`를 통과시킨다. `CompensationPlanApproved.v1`이나 plan-approval fact는 trigger로 받지 않고 exact 16-field `ApprovedCompensationPlanSnapshotPublished.v2`만 inbox dedupe 후 `snapshotId+snapshotRevision`으로 재조회한다.
- PAY는 modern capability owner가 아니라 compensation consumer지만 `coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json`, 결정적 생성 후보 `modern-capability-causal-state-contracts.v2.json`, `modern-capability-event-successor-lineage.v2.json`을 함께 읽어 PER commit/event와 PAY inbox/materialization 경계를 확인한다. 변경 전 `generate_modern_causal_successor.py --check`, `generate_modern_event_successor_lineage.py --check`, `validate_modern_causal_state_contracts.py --self-test --compact`, `node coding-readiness/validate_module_exact_business_start.cjs --self-test --compact`, `python3 -B coding-readiness/audit_module_exact_business_start.py --self-test --compact` 및 compensation v2 authority normal/self-test를 통과한다. PAY가 causal candidate나 PER owner 계약을 수정하는 것은 금지한다.
- 이 세션은 자기 feature bounded test만 실행한다. `validate_modern_causal_independent_oracle.py`, `run_modern_causal_independent_pg_fixtures.py`, `validate_modern_causal_final_endorsement.py`, 모든 `--postgres-feasibility`, unscoped full readiness와 전체 suite는 Integration Control 전용이다.
- Slice 검증은 `g3-slice-code-go-register.csv`의 `G2-PAY-*` profile/key와 `G3CMD-PAY-BE`·`G3CMD-PAY-FE`·exact `frontend_test_path`를 두 closed command catalog에서 해석한다. 파생 display 문자열은 실행하지 않는다. backend는 payroll service의 slice-bounded test만, frontend는 `[SLICE:<slice_id>]` exact 파일 typed PASS만 제출하며 root Gradle check·전체 Vitest·skip/todo/no/unrelated test는 모듈 증거가 아니다.
- G1 exact 산출물: `session-evidence/pay/g1-characterization.md` (`ALLOC-PAY-G1-001`), `session-evidence/pay/g1-child-trace.csv` (`ALLOC-PAY-G1-002`), `session-evidence/pay/g1-decision-log.csv` (`ALLOC-PAY-G1-003`). 부모 디렉터리를 만들고 `g0/g1-evidence-output-contract.md`의 schema와 parent FK를 지킨다.

## 소스 coverage

- 프론트 PAY route 189건 + YEA route 34건 = 223건
- 백엔드 controller 후보 199건
- entity 158건
- `session-registers/hris-pay-source-coverage.csv` 580행. `source_module=yea`도 이 세션 소유다.
- repository에는 YEA backend가 없고 PAY가 외부 `/yea/inf/yea/tot-incom-rslt`를 호출한다. backend/운영 계약을 확보하거나 connector/defer 결정을 내리기 전에는 연말정산 완전 구현을 주장하지 않는다.
- 대소문자 무시 정적 표식 기준 PAY Java 12개 파일의 94개 행에서 ADDSK 참조가 탐지됐다. ADDSK legacy 코드·계약·식별 분기는 전부 `EXCLUDED_QUARANTINED`/`RETIRE`이며 target core나 extension으로 이관하지 않는다. 범용 connector/extension이 필요하면 ADDSK 자산을 재사용하지 않고 별도 계약과 합성 fixture로 독립 재설계한다.
- provider-neutral PAY core의 설계·추적 계약은 G2_READY지만 코드 착수는 `VALIDATOR_CONTROLLED`다. `transition_g3_gate.py --open`이 전역 후보 검증 4개를 내부 실행하고 최신 전환행을 `COMMITTED_OPEN_AUTHORITATIVE_LIVE`로 커밋한 뒤 `gate_authority.py --check-open`이 PASS할 때만 HRM/TIM 계약을 mock-first consumer contract로 개발한다. 실제 KR pack/YEA·지급·신고 adapter 활성화는 G6로 분리한다.

## 목표 소유권

- Backend: 신규 `dwp-payroll-server/{foundation,element,formula,calculation,retro,statutory,retirement,yearend,payment,accounting,payslip}`
- Frontend: `apps/dwp/src/features/hris/payroll`
- 별도 Payroll DB/schema와 owner PEP를 사용하고 People/Time table에 물리 FK 또는 직접 query를 만들지 않는다.
- 한국 세금·사회보험·퇴직·연말정산 규칙은 versioned KR country pack으로 분리한다.

## 포함 기능군

- 법인·급여그룹·주기·일정·통화·급여항목·계산순서·eligibility
- 고정/변동 입력, 보상기준, 일할, 정기·비정기·off-cycle·소급
- 계산 graph, 중간값, 반올림, 검증, 예외, 재계산, freeze
- 세금·사회보험·압류/공제, 퇴직금/퇴직연금, 연말정산
- 승인·확정·명세·지급지시·은행파일·회계전표·대사·취소/역분개

## 통합·고도화 방향

- 자유 SpEL/동적 코드 실행을 금지하고 typed formula DSL, 허용 함수, 단위/통화, dependency graph, 시간·메모리 한도를 적용한다.
- 입력·계산·결과·지급 화면을 `급여 run command center + exception workbench + worker calculation trace`로 통합한다.
- delete/recreate 대신 immutable run/attempt/result line과 correction/reversal을 사용한다.
- 모든 금액에 입력 snapshot, 정책/산식 version, 중간 계산, 반올림, 승인, 지급/GL lineage를 제공한다.
- dry-run/impact comparison, control total, duplicate/anomaly check, restart checkpoint, result-unknown recovery를 추가한다.
- 계산·검증·승인·지급·계좌변경·회계를 atomic duty와 객체 단위 SoD로 분리한다.
- 고객별 항목·수당은 configuration/extension pack으로, 법정 로직은 country pack으로 격리한다.

## 선행·제공 계약

- HRM의 worker/employment/assignment, compensation basis, dependent identity, 검증된 bank-account token source snapshot과 effective event가 필요하다.
- Payroll은 tax election/profile과 payment instruction을 소유한다. 이 필드를 People에 중복 저장하거나 양쪽이 동시에 수정하지 않는다.
- TIM의 approved/closed time result와 absence result가 필요하다. 원시 타각을 직접 읽지 않는다.
- SYS의 policy/formula publish, job/receipt, secret/file/connector, Auth package 계약을 소비한다.
- `PayrollRunApproved`, `PayrollFinalized`, `PayslipPublished`, `PaymentInstructionReleased`, `PayrollPosted` event를 제공한다.
- TIM handoff는 close revision, worker/pay-code aggregate, units, source/rule/input digest를 받으며 accepted/rejected receipt와 idempotency를 보장한다.

## 구현 순서

1. legacy characterization harness와 golden dataset/schema를 먼저 만든다.
2. foundation·element·typed formula·snapshot·run ledger를 구현한다.
3. regular calculation과 trace/reconciliation을 완성한다.
4. retro/off-cycle, statutory, retirement/year-end, payment/GL을 각각 country-pack evidence와 함께 확장한다.
5. G4 뒤에 아래 전체 화면 Design AI 전달 패키지를 만든다.

## 최신 HRIS 필수 범위 — G3D

[modern capability delivery register](../coding-readiness/modern-capability-delivery-register.csv)와 [modern capability trace register](../coding-readiness/modern-capability-trace-register.csv)를 구현 정본으로 사용한다. 작업 전 [exact coding contract](../coding-readiness/07-modern-capability-coding-contract.md), [typed event payload](../coding-readiness/modern-capability-event-payload-contracts.v1.json), [PAY consumer contract](../session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json)을 함께 검증한다. `HRIS.MODERN.COMPENSATION_PLANNING`의 계획 aggregate/API/state/table/화면은 PER 소유이며 PAY는 이를 중복 구현하지 않는다. 이 세션의 G3D 필수 consumer slice는 immutable snapshot header+N lines가 같은 transaction에서 확정된 뒤에만 발행되는 `ApprovedCompensationPlanSnapshotPublished.v2`를 inbox에서 중복 제거하고, `SVC-PEP-PER-001`의 `GET /internal/hris-performance/v1/approved-compensation-plan-snapshots/{snapshotId}`를 `HRIS_APPROVED_COMPENSATION_PLAN_SNAPSHOT_REFETCH` 목적으로 호출하여 tenant·plan/cycle identity·승인 revision/receipt·유효기간·lineCount·header/line digest를 재검증한 뒤 `ApprovedCompensationPlanSnapshot.v1`의 ordered line N건을 정확히 N개의 급여 입력 row로 불변 동결하는 것이다. `CompensationPlanApprovalRecorded.v2`는 snapshot이 아직 없으므로 PAY 소비를 시작하지 않는다. `lineCount` 불일치, line UUID/sequence 중복·누락, 비연속 순서, 부분 materialization은 snapshot 전체를 quarantine한다. 계획 ledger를 PAY에 만들거나 PER DB/repository를 직접 읽는 것은 금지한다. G4에서는 stale/superseded/unapproved/digest mismatch/cardinality negative와 PAY input N:N reconciliation evidence를 제출한다. 구현 전에는 완료로 표시하지 않으며 production 활성화는 G6 승인과 별개다.

## G5A 필수 — PAY 전체 화면 Design AI 프롬프트 패키지

G4 뒤 [전체 화면 Design AI 전달 계약](./90-design-ai-handoff-output-contract.md)에 따라 `output/hris-pay-design-ai-YYYY-MM-DD/`와 검증 ZIP을 만든다. 최소 화면군은 PAY 대표 workbench landing/overview(`/hr/home` 아님), 급여기준·항목·산식·정책, 입력·변동자료, payroll run command center, exception·worker calculation trace·대사, regular/retro/off-cycle, 세금·보험·퇴직·YEA, 승인·확정·지급·은행·GL, 명세서·법정 report/PDF, 운영·연계·감사다. 실제 최종 메뉴·route·wizard/tab/dialog/export/document·persona/권한·SoD·상태를 `05-screen-coverage-register.csv`에 100% 연결하고 `UNMAPPED=0`이어야 한다. 실제 급여·계좌·주민식별·세무 데이터는 Design AI에 전달하지 않는다. 이 패키지 없이는 PAY 세션을 완료 처리하지 않는다.

## G4 범용 코어 완료 특화 기준

- 합성된 최소 3개 법인/급여군과 regular·retro·off-cycle 시나리오가 provider-neutral engine에서 결정적으로 재현됨
- 합성 개인·항목·총액·지급·GL의 승인되지 않은 차이 0. 세금·보험은 `TEST_ONLY` country provider 결과일 뿐 실제 법정 적합성을 주장하지 않음
- 동일 snapshot/rule version의 결정성 및 재실행 중복 0
- 확정 결과 직접 update/delete 0, 모든 보정은 correction/reversal
- 급여/계좌/주민식별 필드와 export의 step-up·목적·감사·negative test
- 모든 PAY/YEA source 행 판정과 source-to-target trace

## G6 실제 tenant 활성화 기준

- `ACT-G6-KR-PAY`, `ACT-G6-YEA`, `ACT-G6-CUSTOMER-DATA`, `ACT-G6-BANK`, `ACT-G6-TAX-INSURANCE`, `ACT-G6-ERP` 등 적용 대상 activation Gate를 모두 닫음
- 익명화·승인된 고객 자료로 대표 급여군과 최소 2~3개 실제 주기를 병행 계산하고 개인·항목·총액·세금·보험·지급·GL의 승인되지 않은 차이 0을 책임자가 확인함
- 실제 국가 법정 pack·은행/세무/보험/ERP adapter certification, 운영 대사·복구·cutover와 명명된 책임자 승인을 완료함

위 실제 병행 계산과 법정·외부 연계 검증은 G3/G4 범용 코어 구현의 선행조건이 아니며, 증거 없이 production 또는 해당 tenant 기능을 활성화할 수 없다.
