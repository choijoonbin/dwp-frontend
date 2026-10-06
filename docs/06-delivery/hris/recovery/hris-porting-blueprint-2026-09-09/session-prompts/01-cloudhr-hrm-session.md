# 세션 프롬프트 — HRIS-HRM

`00-common-session-contract.md`를 최우선 계약으로 읽고, SKKF `cloudhr-hrm`의 업무 능력을 DWP Core HR/People으로 완전 이관하라. 소스 화면·서비스·테이블 복제가 아니라 사람·고용·배치·조직 lifecycle의 단일 SoR를 완성하는 작업이다. 분석만 하고 끝내지 말고 Gate를 지키며 안전하게 구현·검증하고, 외부 자료가 없어 차단된 항목은 근거와 범위를 명시하라.

## 현재 착수 상태 — 2026-09-14

현재 `NO_G3_START`다. 아래 G0의 `6f1ed92.../c2b3b...`는 역사적 code-entry 기준이며 최신 작업공간이나 새 공통 코드의 승인 baseline이 아니다. 실제 착수 기준은 Control이 현재 paired commit/tree·공통 계약·환경·검증을 묶어 게시한 successor baseline만 사용한다. `G2_READY`는 역사적 설계 추적 상태이지 전체 업무 의미 또는 G3 승인이라는 뜻이 아니다. `coding-readiness/reports/readiness-recovery-2026-09-14.md`와 실제 published Gate를 우선 확인한다. 후속 proposal은 독립 검증·정본 승계 전 구현 지시 정본으로 사용하지 않는다.

모듈 업무설계 P0의 정본 successor는 `coding-readiness/module-exact-business-start-canonical.v1.json`이다. HRM은 그 파일의 `BASE-P0-007`, `modules.HRIS-HRM`, `module-exact-business-schemas.v1.json` 및 `module-exact-business-lineage-register.v1.csv`를 구현 시작 계약으로 사용하고, superseded proposal의 빈 source/NULL placeholder/generic patch를 되살리지 않는다. 세션 첫 검증에 `node coding-readiness/validate_module_exact_business_start.cjs --self-test --compact`를 추가한다. 이 정본은 HRM exact-business **설계** P0만 닫으며 공통 identity adapter·migration/current-source seal·두 LIVE Gate를 대신하거나 `NO_G3_START`를 자체 변경하지 않는다.

## G0 실행 바인딩

- 작업 루트: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/hrm`
- Backend: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/hrm/backend`, branch `codex/hris-hrm-g1-backend-20260910`, code-entry base `787f25753a72dc5f0fbbb06783205c0bff6635a5`
- Frontend: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/hrm/frontend`, branch `codex/hris-hrm-g1-frontend-20260910`, base `c658679ef377f43ec4f9fec7e7433eb98f46970e`
- G1 evidence 기준 루트: `/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09` (worktree cwd 기준 상대경로 사용 금지)
- 허용된 읽기 전용 정제 분석 뷰: `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/hrm`, `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/frontend`
- artifact별 접근 판정은 `/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/source-security-evidence/coverage-sanitized-access-register.csv`의 이 세션 행만 사용한다. 원본 SKKF checkout과 `.codex-worktrees/hris/source/*` raw snapshot 직접 접근은 금지한다. `SECURITY_BLOCKED_UNKNOWN`의 원문 bytes는 열지 않으며, G1 결정대장에 기록된 안전한 DWP 대체 계약만 구현한다.
- 첫 행동은 `python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact`로 최신 `COMMITTED_OPEN_AUTHORITATIVE_LIVE` 전환행과 전역 봉인을 함께 확인한 뒤, `coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact`, `g0/validate_code_checkpoint.py --check-live --session HRIS-HRM`, `coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-HRM`을 이 순서로 실행하는 것이다. scoped 두 명령은 global immutable/static 정본과 HRM paired worktree만 재검증하며 다른 모듈의 진행 중 dirty/advanced HEAD 때문에 HRM을 차단하지 않는다. authority·seal-only·scoped 검증 중 하나라도 실패하면 시작하지 않는다. 현재 최대 Gate는 `G3`이며 `07-g3-full-coding-execution-contract.md`를 함께 적용한다.

```text
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-HRM
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-HRM
```
- 실제 변경 전 `coding-readiness/g3-slice-code-go-register.csv`에서 자기 명명 slice와 `G3-CODE-GO-*` 토큰을 선택하고 `validate_g3_slice_code_go.py --compact` 및 typed 변경 경로 `--touch-manifest` 검증을 통과한다. 행에 선할당된 실행 명령과 G4 runbook·telemetry·migration clean/upgrade·worker recovery·acceptance evidence 경로를 사용한다.
- 화면·route 작업 전 `coding-readiness/hris-information-architecture-register.csv`, `hris-shell-navigation-register.csv`, `hris-workbench-task-group-register.csv`, `09-information-architecture-contract.md`를 읽고 `python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_information_architecture.py --compact` 및 같은 절대 경로의 `--self-test --compact`를 통과시킨다. 단일 `/hr/home`은 SYS가 소유하는 widget composition이며 메뉴 dump가 아니다. HRM은 자기 representative workbench landing/overview와 기여 widget만 소유하고 sidebar는 7개 workbench entry와 46개 내부 task group 계약을 따른다.
- 모듈 간 snapshot/event는 `coding-readiness/cross-module-canonical-schemas.v1.json`와 `cross-module-schema-binding-register.csv`만 사용하고 `validate_cross_module_schema_contracts.py --compact` 및 `--self-test --compact`를 통과시킨다. 물리 테이블은 `physical-owner-prefix-register.csv`의 People 소유권·schema·prefix를 벗어나지 않으며 `validate_physical_owner_prefixes.py --compact`를 통과시킨다.
- HRM modern slice는 `coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json` → 결정적 생성 후보 `modern-capability-causal-state-contracts.v2.json` → `modern-capability-event-successor-lineage.v2.json` 순으로 읽는다. 구현 전 `generate_modern_causal_successor.py --check`, `generate_modern_event_successor_lineage.py --check`, `validate_modern_causal_state_contracts.py --self-test --compact`, `node coding-readiness/validate_module_exact_business_start.cjs --self-test --compact`, `python3 -B coding-readiness/audit_module_exact_business_start.py --self-test --compact`를 통과한다. 수기 candidate·미등록 DML/event와 HRM 이외 owner sink는 금지한다.
- 이 세션은 자기 feature bounded test만 실행한다. `validate_modern_causal_independent_oracle.py`, `run_modern_causal_independent_pg_fixtures.py`, `validate_modern_causal_final_endorsement.py`, 모든 `--postgres-feasibility`, unscoped full readiness와 전체 suite는 Integration Control 전용이다.
- Slice 검증은 `g3-slice-code-go-register.csv`의 `G2-HRM-*` profile/key와 `G3CMD-HRM-BE`·`G3CMD-HRM-FE`·exact `frontend_test_path`를 두 closed command catalog에서 해석한다. 파생 display 문자열은 실행하지 않는다. backend는 people service의 slice-bounded test만, frontend는 `[SLICE:<slice_id>]` exact 파일 typed PASS만 제출하며 root Gradle check·전체 Vitest·skip/todo/no/unrelated test는 모듈 증거가 아니다.
- G1 exact 산출물: `session-evidence/hrm/g1-characterization.md` (`ALLOC-HRM-G1-001`), `session-evidence/hrm/g1-child-trace.csv` (`ALLOC-HRM-G1-002`), `session-evidence/hrm/g1-decision-log.csv` (`ALLOC-HRM-G1-003`). 부모 디렉터리를 만들고 `g0/g1-evidence-output-contract.md`의 schema와 parent FK를 지킨다.

## 소스 coverage

- core HRM router 158건. raw inventory 193건은 portal/publishing/common과 범위 제외 BENSK benefit route 2건을 포함한다.
- 백엔드 controller 후보 246건
- entity 144건
- `session-registers/hris-hrm-source-coverage.csv` 583행. BENSK 2행은 추적 보존만 하고 구현하지 않는다.
- HRM 설계·추적 계약은 G2_READY지만 코드 착수는 `VALIDATOR_CONTROLLED`다. `transition_g3_gate.py --open`이 전역 후보 검증 4개를 내부 실행하고 최신 전환행을 `COMMITTED_OPEN_AUTHORITATIVE_LIVE`로 커밋한 뒤 `gate_authority.py --check-open`이 PASS할 때만 등록된 HRM migration 구간과 named-slice checkpoint 안에서 구현한다.

## 목표 소유권

- Backend: `dwp-people-server/hris/{people,employment,organization,employeeservice,compatibility}`
- Frontend: `apps/dwp/src/features/hris/{people,organization,employee-services}`
- 기존 DWP `ppl_persons`, `ppl_workers`, work relationship, assignment, organization graph, access/export/audit/outbox 기반을 canonical로 재사용
- 중앙 navigation, product manifest, gateway, shared event schema는 직접 독점 수정하지 말고 SYS/coordinator에 contract change를 제출

## 포함 기능군

- 인물·직원·재직상태·고용관계·주/부배치·발령·겸직·전보·승진·휴직·복직·퇴직·재고용
- 조직·사업장·직무·직급·포지션·비용센터와 as-of 조직도
- 근로/연봉 계약, 서약, 증명, 전자문서
- 가족·학력·경력·자격·어학·병역 등 개인정보와 증빙
- 직원/관리자 변경요청, 승인, 영향 preview, bulk import와 데이터 품질

## 통합·고도화 방향

- 수많은 속성별 관리화면은 `사람 360 + 유효일 section + 변경요청/승인 history`로 통합한다.
- 발령·계약·상태변경은 직접 table update가 아니라 versioned change command와 effective-date conflict 검사로 처리한다.
- 증명/서약/계약은 template version, 생성 snapshot, 서명·발급·취소·감사 lifecycle을 갖는다.
- 중복 `com_employee/com_organization`과 module별 전체 재적재를 폐기하고 owner event projection으로 대체한다.
- 고객사 전용 수당·문서·필드·분기는 typed custom field/form 또는 extension pack으로 격리한다.
- data-quality rule, merge 후보, 미래변경 영향 preview, change lineage를 제품 기능으로 추가한다.

## 선행·제공 계약

- SYS로부터 HRIS app entitlement, access package, code/form/policy lifecycle 계약을 소비한다.
- `Person`, `Worker`, `WorkRelationship`, `Assignment`, `OrganizationUnit`, `Job`, `Position`의 public ID와 versioned snapshot/event를 먼저 고정한다.
- TIM/PAY/PER가 People DB를 읽지 않도록 `WorkerHired`, `EmploymentChanged`, `AssignmentChanged`, `OrganizationChanged`, `CompensationBasisChanged` 계약과 bootstrap snapshot을 제공한다.

## 첫 vertical slice

`직원·고용·배치 조회 → 개인 변경요청 → HR 승인 → effective-date 반영 → audit/outbox/notification → 권한별 재조회`를 완성한다.

## 최신 HRIS 필수 범위 — G3B~G3D

[modern capability delivery register](../coding-readiness/modern-capability-delivery-register.csv)와 [modern capability trace register](../coding-readiness/modern-capability-trace-register.csv)를 구현 정본으로 사용한다. 작업 전 [exact coding contract](../coding-readiness/07-modern-capability-coding-contract.md), [exact transport/data schema](../coding-readiness/modern-capability-exact-schema-contracts.v1.json), [typed event payload](../coding-readiness/modern-capability-event-payload-contracts.v1.json), [HRM module contract](../session-evidence/hrm/g3-modern-capability-contracts.v1.json)을 함께 검증한다. 아래 항목은 아이디어 목록이 아니라 이 세션의 `ALLOCATED_REQUIRED_NOT_STARTED` 필수 범위다. 각 delivery wave에서 aggregate/API/event/PEP/fixture를 구현하고, G4에서 trace register에 할당된 계약·상태기계·보안 negative·reconciliation acceptance evidence를 모두 제출한다. 구현 전에는 완료로 표시하지 않으며 production 활성화는 G6 승인과 별개다.

- `HRIS.MODERN.RECRUITING_ATS`
- `HRIS.MODERN.ONBOARDING`
- `HRIS.MODERN.WORKFORCE_PLANNING`
- `HRIS.MODERN.BENEFITS_ADMIN`
- `HRIS.MODERN.HR_SERVICE_DELIVERY`
- `HRIS.MODERN.CONTINGENT_WORKFORCE`

## G5A 필수 — HRM 전체 화면 Design AI 프롬프트 패키지

G4 뒤 [전체 화면 Design AI 전달 계약](./90-design-ai-handoff-output-contract.md)에 따라 `output/hris-hrm-design-ai-YYYY-MM-DD/`와 검증 ZIP을 만든다. 최소 화면군은 HRM 대표 workbench landing/overview(`/hr/home` 아님), People 360, 조직·인력설계, 입사·발령·휴복직·퇴직 lifecycle case, 계약·문서·증명, 직원/관리자 self-service, HR 운영·data quality·bulk/import다. 실제 최종 메뉴·route·tab/dialog/document·persona/권한·상태를 `05-screen-coverage-register.csv`에 100% 연결하고 `UNMAPPED=0`이어야 한다. 이 패키지 없이는 HRM 세션을 완료 처리하지 않는다.

## 완료 특화 기준

- 같은 유효구간의 허용되지 않은 주 고용/주 배치 중복 0
- 과거·현재·미래 as-of 조회와 correction 이력 재현
- 민감필드 목적·마스킹·반출 negative test
- 모든 HRM source 행 판정 및 통합/폐기 N:M trace
- downstream snapshot/event contract test 통과
