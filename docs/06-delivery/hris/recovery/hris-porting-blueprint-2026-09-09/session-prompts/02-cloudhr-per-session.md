# 세션 프롬프트 — HRIS-PER

`00-common-session-contract.md`를 최우선 계약으로 읽고, SKKF `cloudhr-per`의 목표·평가 업무를 DWP Performance bounded context로 완전 이관하라. 평가단계별 레거시 화면을 복제하지 말고, versioned cycle·form·participant·review·calibration·publish 모델로 단순화한다.

## 현재 착수 상태 — 2026-09-14

현재 `NO_G3_START`다. 아래 G0의 `6f1ed92.../c2b3b...`는 역사적 code-entry 기준이며 최신 작업공간이나 새 공통 코드의 승인 baseline이 아니다. 실제 착수 기준은 Control이 현재 paired commit/tree·공통 계약·환경·검증을 묶어 게시한 successor baseline만 사용한다. `G2_READY`는 역사적 설계 추적 상태이지 전체 업무 의미 또는 G3 승인이라는 뜻이 아니다. `coding-readiness/reports/readiness-recovery-2026-09-14.md`와 실제 published Gate를 우선 확인한다. 후속 proposal은 독립 검증·정본 승계 전 구현 지시 정본으로 사용하지 않는다.

모듈 업무설계 P0의 정본 successor는 `coding-readiness/module-exact-business-start-canonical.v1.json`이다. PER은 그 파일의 `BASE-P0-008/009`, `modules.HRIS-PER`, `module-exact-business-schemas.v1.json` 및 `module-exact-business-lineage-register.v1.csv`를 구현 시작 계약으로 사용한다. flattened closed population freeze와 모든 cycle/goal/evaluation/feedback/check-in/calibration/result/appeal 전이를 그대로 구현하며 caller의 score baseline·distributionImpact를 SoR로 쓰지 않는다. 세션 첫 검증에 `node coding-readiness/validate_module_exact_business_start.cjs --self-test --compact`를 추가한다. 이 정본은 PER exact-business **설계** P0만 닫으며 공통 owner adapter·migration/current-source seal·두 LIVE Gate를 대신하거나 `NO_G3_START`를 자체 변경하지 않는다.

## G0 실행 바인딩

- 작업 루트: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/per`
- Backend: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/per/backend`, branch `codex/hris-per-g1-backend-20260910`, code-entry base `787f25753a72dc5f0fbbb06783205c0bff6635a5`
- Frontend: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/per/frontend`, branch `codex/hris-per-g1-frontend-20260910`, base `c658679ef377f43ec4f9fec7e7433eb98f46970e`
- G1 evidence 기준 루트: `/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09` (worktree cwd 기준 상대경로 사용 금지)
- 허용된 읽기 전용 정제 분석 뷰: `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/per`, `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/frontend`
- artifact별 접근 판정은 `/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/source-security-evidence/coverage-sanitized-access-register.csv`의 이 세션 행만 사용한다. 원본 SKKF checkout과 `.codex-worktrees/hris/source/*` raw snapshot 직접 접근은 금지한다. `SECURITY_BLOCKED_UNKNOWN`의 원문 bytes는 열지 않으며, G1 결정대장에 기록된 안전한 DWP 대체 계약만 구현한다.
- 첫 행동은 `python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact`로 최신 `COMMITTED_OPEN_AUTHORITATIVE_LIVE` 전환행과 전역 봉인을 함께 확인한 뒤, `coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact`, `g0/validate_code_checkpoint.py --check-live --session HRIS-PER`, `coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-PER`을 이 순서로 실행하는 것이다. scoped 두 명령은 global immutable/static 정본과 PER paired worktree만 재검증하며 다른 모듈의 진행 중 dirty/advanced HEAD 때문에 PER를 차단하지 않는다. authority·seal-only·scoped 검증 중 하나라도 실패하면 시작하지 않는다. 현재 최대 Gate는 `G3`이며 `07-g3-full-coding-execution-contract.md`를 함께 적용한다.

```text
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-PER
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-PER
```
- 실제 변경 전 `coding-readiness/g3-slice-code-go-register.csv`에서 자기 명명 slice와 `G3-CODE-GO-*` 토큰을 선택하고 `validate_g3_slice_code_go.py --compact` 및 typed 변경 경로 `--touch-manifest` 검증을 통과한다. 행에 선할당된 실행 명령과 G4 runbook·telemetry·migration clean/upgrade·worker recovery·acceptance evidence 경로를 사용한다.
- 화면·route 작업 전 `coding-readiness/hris-information-architecture-register.csv`, `hris-shell-navigation-register.csv`, `hris-workbench-task-group-register.csv`, `09-information-architecture-contract.md`를 읽고 `python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_information_architecture.py --compact` 및 같은 절대 경로의 `--self-test --compact`를 통과시킨다. 단일 `/hr/home`은 SYS가 소유하는 widget composition이며 메뉴 dump가 아니다. PER는 자기 representative workbench landing/overview와 기여 widget만 소유하고 sidebar는 7개 workbench entry와 46개 내부 task group 계약을 따른다.
- 모듈 간 snapshot/event는 `coding-readiness/cross-module-canonical-schemas.v1.json`와 `cross-module-schema-binding-register.csv`만 사용하고 `validate_cross_module_schema_contracts.py --compact` 및 `--self-test --compact`를 통과시킨다. 물리 테이블은 `physical-owner-prefix-register.csv`의 Performance 소유권·schema·`prf_` prefix를 벗어나지 않으며 `validate_physical_owner_prefixes.py --compact`를 통과시킨다.
- DEP-019 producer는 `validate_compensation_snapshot_v2_authority.py --compact`와 `validate_compensation_snapshot_v2_authority.py --self-test --compact`를 통과시킨다. `CompensationPlanApproved.v1`을 발행하거나 v2와 dual publish하지 않으며, snapshot header+ordered lines commit 뒤 exact 16-field `ApprovedCompensationPlanSnapshotPublished.v2`만 발행한다.
- PER modern slice는 `coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json` → 결정적 생성 후보 `modern-capability-causal-state-contracts.v2.json` → `modern-capability-event-successor-lineage.v2.json` 순으로 읽는다. 구현 전 `generate_modern_causal_successor.py --check`, `generate_modern_event_successor_lineage.py --check`, `validate_modern_causal_state_contracts.py --self-test --compact`, `node coding-readiness/validate_module_exact_business_start.cjs --self-test --compact`, `python3 -B coding-readiness/audit_module_exact_business_start.py --self-test --compact`를 통과한다. compensation producer 변경에는 위 v2 authority normal/self-test를 반드시 함께 실행한다.
- 이 세션은 자기 feature bounded test만 실행한다. `validate_modern_causal_independent_oracle.py`, `run_modern_causal_independent_pg_fixtures.py`, `validate_modern_causal_final_endorsement.py`, 모든 `--postgres-feasibility`, unscoped full readiness와 전체 suite는 Integration Control 전용이다.
- Slice 검증은 `g3-slice-code-go-register.csv`의 `G2-PER-*` profile/key와 `G3CMD-PER-BE`·`G3CMD-PER-FE`·exact `frontend_test_path`를 두 closed command catalog에서 해석한다. 파생 display 문자열은 실행하지 않는다. backend는 people service의 slice-bounded test만, frontend는 `[SLICE:<slice_id>]` exact 파일 typed PASS만 제출하며 root Gradle check·전체 Vitest·skip/todo/no/unrelated test는 모듈 증거가 아니다.
- G1 exact 산출물: `session-evidence/per/g1-characterization.md` (`ALLOC-PER-G1-001`), `session-evidence/per/g1-child-trace.csv` (`ALLOC-PER-G1-002`), `session-evidence/per/g1-decision-log.csv` (`ALLOC-PER-G1-003`). 부모 디렉터리를 만들고 `g0/g1-evidence-output-contract.md`의 schema와 parent FK를 지킨다.

## 소스 coverage

- 프론트 PER route 121건
- 백엔드 controller 후보 126건
- entity 102건
- `session-registers/hris-per-source-coverage.csv` 349행
- PER 설계·추적 계약은 G2_READY지만 코드 착수는 `VALIDATOR_CONTROLLED`다. `transition_g3_gate.py --open`이 전역 후보 검증 4개를 내부 실행하고 최신 전환행을 `COMMITTED_OPEN_AUTHORITATIVE_LIVE`로 커밋한 뒤 `gate_authority.py --check-open`이 PASS할 때만 HRM consumer contract를 mock-first로 구현하고 실제 계약 통합 전에는 독립 저장소 경계를 유지한다.

## 목표 소유권

- 초기 Backend: `dwp-people-server/hris/performance`의 독립 package/bounded context
- Frontend: `apps/dwp/src/features/hris/performance`
- HRM의 worker/assignment/org snapshot을 소비하며 People core table을 performance repository에서 직접 수정하지 않는다.
- 장기 추출 가능성을 위해 performance aggregate와 event/API를 독립 계약으로 유지한다.

## 포함 기능군

- 평가주기·차수·그룹·대상자·평가자·승인자·예외대상
- 조직/개인 목표, cascade/alignment, 진행·변경·확정
- 자기·1/2/3차 평가, 역량평가, 다면평가, 인터뷰/면담
- 등급표·평가기준·가중치·오류검증·차등등급·보정
- 결과 집계·리포트·공개·이의제기와 history

## 통합·고도화 방향

- 차수마다 분리된 화면을 한 개 `참여자 평가 workspace`와 단계 설정으로 통합한다.
- 목표·역량·다면 form은 versioned schema와 immutable 제출 snapshot으로 만든다.
- 대상자·평가자 산정은 재현 가능한 population rule과 freeze snapshot을 가진다.
- 보정은 before/after, 사유, 분포 영향, 승인, 공개를 한 evidence chain으로 남긴다.
- test/copy/old grade group 및 중복 report 화면은 usage 근거 후 `RETIRE`한다.
- AI는 문구 초안·근거 요약만 제공하며 점수·등급·보상·징계 결정을 자율 확정하지 않는다.
- bias/fairness 관찰 지표는 민감정보 최소화·표본 임계치·권한 통제를 전제로 제공한다.

## 선행·제공 계약

- HRM의 assignment/org/manager as-of snapshot과 조직개편 effective event가 필수다.
- SYS의 form/rubric/policy publish와 Auth의 assigned review population을 사용한다.
- Notification/Approval에 review task와 publish 승인 계약을 제공한다.

## 첫 vertical slice

`평가주기 draft → 대상/평가자 freeze → 목표 또는 self review 제출 → manager review → 감사 가능한 결과 조회`를 완성한다.

## 최신 HRIS 필수 범위 — G3B~G3D

[modern capability delivery register](../coding-readiness/modern-capability-delivery-register.csv)와 [modern capability trace register](../coding-readiness/modern-capability-trace-register.csv)를 구현 정본으로 사용한다. 작업 전 [exact coding contract](../coding-readiness/07-modern-capability-coding-contract.md), [exact transport/data schema](../coding-readiness/modern-capability-exact-schema-contracts.v1.json), [typed event payload](../coding-readiness/modern-capability-event-payload-contracts.v1.json), [PER module contract](../session-evidence/per/g3-modern-capability-contracts.v2.json)을 함께 검증한다. 아래 항목은 아이디어 목록이 아니라 이 세션의 `ALLOCATED_REQUIRED_NOT_STARTED` 필수 범위다. 각 delivery wave에서 aggregate/API/event/PEP/fixture를 구현하고, G4에서 trace register에 할당된 계약·상태기계·privacy/fairness negative·provenance acceptance evidence를 모두 제출한다. 구현 전에는 완료로 표시하지 않으며 production 활성화는 G6 승인과 별개다.

- `HRIS.MODERN.SKILLS_ONTOLOGY`
- `HRIS.MODERN.GROWTH_PROFILE`
- `HRIS.MODERN.LEARNING`
- `HRIS.MODERN.INTERNAL_MARKETPLACE`
- `HRIS.MODERN.SUCCESSION`
- `HRIS.MODERN.COMPENSATION_PLANNING`

`HRIS.MODERN.COMPENSATION_PLANNING`의 계획 aggregate/API/state/table/화면과 승인된 불변
`ApprovedCompensationPlanSnapshot.v1` 생성은 PER이 소유한다. 스냅샷은
`prf_cmp_approved_snapshots` 불변 header 1건과
`prf_cmp_approved_snapshot_lines` 불변 line 1..100000건으로 저장한다.
`lineCount == lines.length`, lineSequence 연속·오름차순, line UUID/sequence
유일성, line digest 및 ordered-line header digest를 원자적으로 검증한다.
PAY는 line N건을 N개의 input row로만 materialize할 수 있으며 scalar 축약이나
부분 성공은 금지한다. 같은
`dwp-people-server` 안의 HRM 입력은 typed application port로만 받고 self-HTTP나 가짜
workload identity를 만들지 않는다. PAY에는 승인 event와 tenant-bound snapshot refetch
계약만 제공하며, 급여 결과 원장이나 계산 책임은 가져오지 않는다.

## G5A 필수 — PER 전체 화면 Design AI 프롬프트 패키지

G4 뒤 [전체 화면 Design AI 전달 계약](./90-design-ai-handoff-output-contract.md)에 따라 `output/hris-per-design-ai-YYYY-MM-DD/`와 검증 ZIP을 만든다. 최소 화면군은 PER 대표 workbench landing/overview(`/hr/home` 아님), Cycle Studio, 목표·정렬, 참여자 평가 workspace, 다면·feedback·면담, calibration, 결과공개·이의제기, 운영 monitoring·analytics·설정이다. 실제 최종 메뉴·route·step/tab/dialog/report·persona/권한·상태를 `05-screen-coverage-register.csv`에 100% 연결하고 `UNMAPPED=0`이어야 한다. 이 패키지 없이는 PER 세션을 완료 처리하지 않는다.

## 완료 특화 기준

- cycle/version별 대상·평가자·form·가중치 완전 재현
- assignment 밖 조회/평가와 자기 publish 차단
- 보정 전후 합계·등급분포·사유 lineage 검증
- 모든 PER source 행 판정과 단계별 화면 통합 trace
- 공개 전/후 필드 가시성과 notification contract test 통과
