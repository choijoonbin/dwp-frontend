# 세션 프롬프트 — HRIS-TIM

`00-common-session-contract.md`를 최우선 계약으로 읽고, SKKF `cloudhr-tim`의 근무·타각·근태해석·휴가·마감 능력을 DWP Time & Leave bounded context로 완전 이관하라. 신청화면 복제가 아니라 raw event → rule interpretation → timecard/leave ledger → approval → close/correction의 재현 가능한 흐름을 만든다.

## 현재 착수 상태 — 2026-09-14

현재 `NO_G3_START`다. 아래 G0의 `6f1ed92.../c2b3b...`는 역사적 code-entry 기준이며 최신 작업공간이나 새 공통 코드의 승인 baseline이 아니다. 실제 착수 기준은 Control이 현재 paired commit/tree·공통 계약·환경·검증을 묶어 게시한 successor baseline만 사용한다. `G2_READY`는 역사적 설계 추적 상태이지 전체 업무 의미 또는 G3 승인이라는 뜻이 아니다. `coding-readiness/reports/readiness-recovery-2026-09-14.md`와 실제 published Gate를 우선 확인한다. 후속 proposal은 독립 검증·정본 승계 전 구현 지시 정본으로 사용하지 않는다.

모듈 업무설계 P0의 정본 successor는 `coding-readiness/module-exact-business-start-canonical.v1.json`이다. TIM은 그 파일의 `BASE-P0-004/005/006/011`, `modules.HRIS-TIM`, `module-exact-business-schemas.v1.json` 및 `module-exact-business-lineage-register.v1.csv`를 구현 시작 계약으로 사용한다. native schedule, typed rule/accrual, literal timecard states 및 TIM-owned WFM source-vector를 구현하고 historical free-text rule·digest-only input·LOCKED/CLOSED collapse·HRM-owned availability를 되살리지 않는다. 세션 첫 검증에 `node coding-readiness/validate_module_exact_business_start.cjs --self-test --compact`를 추가한다. 이 정본은 TIM exact-business **설계** P0만 닫으며 공통 owner adapter·migration/current-source seal·두 LIVE Gate를 대신하거나 `NO_G3_START`를 자체 변경하지 않는다.

## G0 실행 바인딩

- 작업 루트: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/tim`
- Backend: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/tim/backend`, branch `codex/hris-tim-g1-backend-20260910`, code-entry base `787f25753a72dc5f0fbbb06783205c0bff6635a5`
- Frontend: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/tim/frontend`, branch `codex/hris-tim-g1-frontend-20260910`, base `c658679ef377f43ec4f9fec7e7433eb98f46970e`
- G1 evidence 기준 루트: `/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09` (worktree cwd 기준 상대경로 사용 금지)
- 허용된 읽기 전용 정제 분석 뷰: `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/tim`, `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/frontend`
- artifact별 접근 판정은 `/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/source-security-evidence/coverage-sanitized-access-register.csv`의 이 세션 행만 사용한다. 원본 SKKF checkout과 `.codex-worktrees/hris/source/*` raw snapshot 직접 접근은 금지한다. `SECURITY_BLOCKED_UNKNOWN`의 원문 bytes는 열지 않으며, G1 결정대장에 기록된 안전한 DWP 대체 계약만 구현한다.
- 첫 행동은 `python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact`로 최신 `COMMITTED_OPEN_AUTHORITATIVE_LIVE` 전환행과 전역 봉인을 함께 확인한 뒤, `coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact`, `g0/validate_code_checkpoint.py --check-live --session HRIS-TIM`, `coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-TIM`을 이 순서로 실행하는 것이다. scoped 두 명령은 global immutable/static 정본과 TIM paired worktree만 재검증하며 다른 모듈의 진행 중 dirty/advanced HEAD 때문에 TIM을 차단하지 않는다. authority·seal-only·scoped 검증 중 하나라도 실패하면 시작하지 않는다. 현재 최대 Gate는 `G3`이며 `07-g3-full-coding-execution-contract.md`를 함께 적용한다.

```text
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-TIM
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-TIM
```
- 실제 변경 전 `coding-readiness/g3-slice-code-go-register.csv`에서 자기 명명 slice와 `G3-CODE-GO-*` 토큰을 선택하고 `validate_g3_slice_code_go.py --compact` 및 typed 변경 경로 `--touch-manifest` 검증을 통과한다. 행에 선할당된 실행 명령과 G4 runbook·telemetry·migration clean/upgrade·worker recovery·acceptance evidence 경로를 사용한다.
- 화면·route 작업 전 `coding-readiness/hris-information-architecture-register.csv`, `hris-shell-navigation-register.csv`, `hris-workbench-task-group-register.csv`, `09-information-architecture-contract.md`를 읽고 `python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_information_architecture.py --compact` 및 같은 절대 경로의 `--self-test --compact`를 통과시킨다. 단일 `/hr/home`은 SYS가 소유하는 widget composition이며 메뉴 dump가 아니다. TIM은 자기 representative workbench landing/overview와 기여 widget만 소유하고 sidebar는 7개 workbench entry와 46개 내부 task group 계약을 따른다.
- 모듈 간 snapshot/event는 `coding-readiness/cross-module-canonical-schemas.v1.json`와 `cross-module-schema-binding-register.csv`만 사용하고 `validate_cross_module_schema_contracts.py --compact` 및 `--self-test --compact`를 통과시킨다. 물리 테이블은 `physical-owner-prefix-register.csv`의 Time/Absence 소유권·schema·`tme_|abs_` prefix를 벗어나지 않으며 `validate_physical_owner_prefixes.py --compact`를 통과시킨다.
- TIM modern slice는 `coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json` → 결정적 생성 후보 `modern-capability-causal-state-contracts.v2.json` → `modern-capability-event-successor-lineage.v2.json` 순으로 읽는다. 구현 전 `generate_modern_causal_successor.py --check`, `generate_modern_event_successor_lineage.py --check`, `validate_modern_causal_state_contracts.py --self-test --compact`, `node coding-readiness/validate_module_exact_business_start.cjs --self-test --compact`, `python3 -B coding-readiness/audit_module_exact_business_start.py --self-test --compact`를 통과한다. 수기 candidate·미등록 DML/event와 TIM 이외 owner sink는 금지한다.
- 이 세션은 자기 feature bounded test만 실행한다. `validate_modern_causal_independent_oracle.py`, `run_modern_causal_independent_pg_fixtures.py`, `validate_modern_causal_final_endorsement.py`, 모든 `--postgres-feasibility`, unscoped full readiness와 전체 suite는 Integration Control 전용이다.
- Slice 검증은 `g3-slice-code-go-register.csv`의 `G2-TIM-*` profile/key와 `G3CMD-TIM-BE`·`G3CMD-TIM-FE`·exact `frontend_test_path`를 두 closed command catalog에서 해석한다. 파생 display 문자열은 실행하지 않는다. backend는 time service의 slice-bounded test만, frontend는 `[SLICE:<slice_id>]` exact 파일 typed PASS만 제출하며 root Gradle check·전체 Vitest·skip/todo/no/unrelated test는 모듈 증거가 아니다.
- G1 exact 산출물: `session-evidence/tim/g1-characterization.md` (`ALLOC-TIM-G1-001`), `session-evidence/tim/g1-child-trace.csv` (`ALLOC-TIM-G1-002`), `session-evidence/tim/g1-decision-log.csv` (`ALLOC-TIM-G1-003`). 부모 디렉터리를 만들고 `g0/g1-evidence-output-contract.md`의 schema와 parent FK를 지킨다.

## 소스 coverage

- 프론트 TIM route 196건
- 백엔드 controller 후보 232건
- entity 140건
- `session-registers/hris-tim-source-coverage.csv` 568행
- 대소문자 무시 정적 표식 기준 TIM Java 1개 파일의 5개 행에서 ADDSK 참조가 탐지됐다. ADDSK legacy 코드·계약·식별 분기는 전부 `EXCLUDED_QUARANTINED`/`RETIRE`이며 target core나 extension으로 이관하지 않는다. 범용 connector/extension이 필요하면 ADDSK 자산을 재사용하지 않고 별도 계약과 합성 fixture로 독립 재설계한다.
- provider-neutral TIM core의 설계·추적 계약은 G2_READY지만 코드 착수는 `VALIDATOR_CONTROLLED`다. `transition_g3_gate.py --open`이 전역 후보 검증 4개를 내부 실행하고 최신 전환행을 `COMMITTED_OPEN_AUTHORITATIVE_LIVE`로 커밋한 뒤 `gate_authority.py --check-open`이 PASS할 때만 구현한다. 실제 KR 노동정책과 타각 adapter 활성화는 G6로 분리한다.

## 목표 소유권

- Backend: 신규 `dwp-time-server/{schedule,clock,interpretation,timecard,leave,close}`
- Frontend: `apps/dwp/src/features/hris/{time,leave}`
- 현행 People의 `tme_*`, `abs_*`는 전환 대상이며 장기 dual SoR를 만들지 않는다. 새 서비스는 worker public ID projection/event를 사용하고 People DB에 물리 FK를 두지 않는다.
- 임신·출산·육아·연차촉진 등 법정 규칙은 KR country pack, 회사별 교대·휴가 규칙은 tenant policy/extension으로 분리한다.

## 포함 기능군

- 근무제·스케줄·교대조·근무조·근무장소·calendar/holiday
- 원시 타각·수정요청·출퇴근·휴게·외근·교육·당직
- 유연근무·선택/탄력근무·연장/야간/휴일근로와 한도
- rule interpretation, 예외, 일마감·월마감·재개방·재마감
- 휴가유형·자격·발생·소멸·이월·촉진·잔액·신청·취소·조정
- 팀 승인, 대량작업, 급여 전송용 확정 결과와 대사

## 통합·고도화 방향

- 원시 타각은 불변 저장하고 해석 결과는 rule version별로 재생성한다.
- 개인/관리자별로 흩어진 신청 화면은 `근무·휴가 요청 workspace`로, 운영 화면은 `exception workbench`와 `period close command center`로 통합한다.
- 잔액 숫자 직접수정 대신 accrual/use/cancel/adjust/expire/carryover ledger로 계산한다.
- 일·월 마감 후에는 직접 수정하지 않고 reopen 또는 correction entry를 사용한다.
- timezone/DST, 자정 경계, overnight shift, 중복 타각, offline 수집, device/source provenance를 일급 계약으로 처리한다.
- 근무시간 설명 기능에 source punch, 적용 규칙, 반올림, 예외, 승인·보정 lineage를 제공한다.
- 고위험 자동 승인이나 생산성 감시·위치 추론은 추가하지 않는다.

## 선행·제공 계약

- HRM의 worker/assignment/legal entity/workplace/schedule eligibility snapshot이 필요하다.
- SYS의 calendar, policy publish, job/receipt와 Auth의 time-group/population policy를 사용한다.
- PAY에는 승인·마감된 `TimePeriodClosed`와 close revision, worker/pay-code aggregate, units, source/rule/input digest를 제공하고 accepted/rejected receipt를 대사한다.

## 첫 vertical slice

`근무계획 → 원시 타각 입력 → 규칙 해석 → 예외 보정 → 직원 제출 → 관리자 승인 → 기간마감 → payroll projection`을 한 근무제에서 완성한다.

## 최신 HRIS 필수 범위 — G3D

[modern capability delivery register](../coding-readiness/modern-capability-delivery-register.csv)와 [modern capability trace register](../coding-readiness/modern-capability-trace-register.csv)를 구현 정본으로 사용한다. 작업 전 [exact coding contract](../coding-readiness/07-modern-capability-coding-contract.md), [exact transport/data schema](../coding-readiness/modern-capability-exact-schema-contracts.v1.json), [typed event payload](../coding-readiness/modern-capability-event-payload-contracts.v1.json), [TIM module contract](../session-evidence/tim/g3-modern-capability-contracts.v1.json)을 함께 검증한다. `HRIS.MODERN.ADVANCED_WFM`은 이 세션의 `ALLOCATED_REQUIRED_NOT_STARTED` 필수 범위다. G3D에서 수요·제약 모델, 후보 스케줄, 설명·공정성 점검, 사람 승인과 publish ledger를 구현하고, G4에서 constraint property·fairness·승인 감사·publish reconciliation evidence를 모두 제출한다. 구현 전에는 완료로 표시하지 않으며 production 활성화는 G6 승인과 별개다.

## G5A 필수 — TIM 전체 화면 Design AI 프롬프트 패키지

G4 뒤 [전체 화면 Design AI 전달 계약](./90-design-ai-handoff-output-contract.md)에 따라 `output/hris-tim-design-ai-YYYY-MM-DD/`와 검증 ZIP을 만든다. 최소 화면군은 TIM 대표 workbench landing/overview(`/hr/home` 아님), 근무제·스케줄·교대 계획, 타각·timecard, 근무·휴가 요청 workspace, 잔액·발생·조정 ledger, 팀 승인, exception workbench, 일/월 close·reopen·correction command center, 운영 rule·device/interface·audit다. 실제 최종 메뉴·route·calendar/tab/dialog/bulk/report·persona/권한·상태를 `05-screen-coverage-register.csv`에 100% 연결하고 `UNMAPPED=0`이어야 한다. 이 패키지 없이는 TIM 세션을 완료 처리하지 않는다.

## 완료 특화 기준

- 대표 근무제·휴가제도의 직원/일/월 golden 결과 일치
- ledger 재생성 잔액과 projection 차이 0
- close/reopen/correction의 동시성·idempotency·감사 검증
- self approval, own edit approval, 범위 밖 팀원 접근 차단
- raw/interpretation/approved/closed 단계와 PAY 전달값의 lineage
- 모든 TIM source 행 판정과 통합/폐기 trace
