# 세션 프롬프트 — HRIS-SYS

`00-common-session-contract.md`를 최우선 계약으로 읽고, SKKF `cloudhr-sys`와 SYS/portal 프론트의 공통 기능을 DWP 네이티브 HRIS platform/configuration으로 이관하라. `dwp-sys-server`나 HRIS 전용 공통 플랫폼을 복제하지 말고, DWP Auth·Platform·People·Gateway·Audit·Notification·Object Storage·frontend shell을 제품 중립적으로 확장한다.

## 현재 착수 상태 — 2026-09-14

현재 `NO_G3_START`다. 아래 G0의 `6f1ed92.../c2b3b...`는 역사적 code-entry 기준이며 최신 작업공간이나 새 공통 코드의 승인 baseline이 아니다. 실제 착수 기준은 Control이 현재 paired commit/tree·공통 계약·환경·검증을 묶어 게시한 successor baseline만 사용한다. `G2_READY`는 역사적 설계 추적 상태이지 전체 업무 의미 또는 G3 승인이라는 뜻이 아니다. `coding-readiness/reports/readiness-recovery-2026-09-14.md`와 실제 published Gate를 우선 확인한다. 후속 proposal은 독립 검증·정본 승계 전 구현 지시 정본으로 사용하지 않는다.

## G0 실행 바인딩

- 작업 루트: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/sys`
- Backend: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/sys/backend`, branch `codex/hris-sys-g1-backend-20260910`, code-entry base `787f25753a72dc5f0fbbb06783205c0bff6635a5`
- Frontend: `/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/sys/frontend`, branch `codex/hris-sys-g1-frontend-20260910`, base `c658679ef377f43ec4f9fec7e7433eb98f46970e`
- G1 evidence 기준 루트: `/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09` (worktree cwd 기준 상대경로 사용 금지)
- 허용된 읽기 전용 정제 분석 뷰: `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/sys`, `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/frontend`
- artifact별 접근 판정은 `/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/source-security-evidence/coverage-sanitized-access-register.csv`의 이 세션 행만 사용한다. 원본 SKKF checkout과 `.codex-worktrees/hris/source/*` raw snapshot 직접 접근은 금지한다. `SECURITY_BLOCKED_UNKNOWN`의 원문 bytes는 열지 않으며, G1 결정대장에 기록된 안전한 DWP 대체 계약만 구현한다.
- 첫 행동은 `python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact`로 최신 `COMMITTED_OPEN_AUTHORITATIVE_LIVE` 전환행과 전역 봉인을 함께 확인한 뒤, `coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact`, `g0/validate_code_checkpoint.py --check-live --session HRIS-SYS`, `coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-SYS`를 이 순서로 실행하는 것이다. scoped 두 명령은 global immutable/static 정본과 SYS paired worktree만 재검증하며 다른 모듈의 진행 중 dirty/advanced HEAD 때문에 SYS를 차단하지 않는다. authority·seal-only·scoped 검증 중 하나라도 실패하면 시작하지 않는다. 현재 최대 Gate는 `G3`이며 `07-g3-full-coding-execution-contract.md`를 함께 적용한다.

```text
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-SYS
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-SYS
```
- 실제 변경 전 `coding-readiness/g3-slice-code-go-register.csv`에서 자기 명명 slice와 `G3-CODE-GO-*` 토큰을 선택하고 `validate_g3_slice_code_go.py --compact` 및 typed 변경 경로 `--touch-manifest` 검증을 통과한다. 행에 선할당된 실행 명령과 G4 runbook·telemetry·migration clean/upgrade·worker recovery·acceptance evidence 경로를 사용한다.
- 화면·route 작업 전 `coding-readiness/hris-information-architecture-register.csv`, `hris-shell-navigation-register.csv`, `hris-workbench-task-group-register.csv`, `09-information-architecture-contract.md`를 읽고 `python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_information_architecture.py --compact` 및 같은 절대 경로의 `--self-test --compact`를 통과시킨다. 홈은 메뉴 dump가 아니라 widget composition이며 sidebar는 7개 workbench entry와 46개 내부 task group 계약을 따른다.
- 모듈 간 snapshot/event는 `coding-readiness/cross-module-canonical-schemas.v1.json`와 `cross-module-schema-binding-register.csv`만 사용하고 `validate_cross_module_schema_contracts.py --compact` 및 `--self-test --compact`를 통과시킨다. Auth·Platform·Insights·Configuration 물리 객체는 `physical-owner-prefix-register.csv`의 서비스·schema·prefix별 독립 migration 경계를 따르며 `validate_physical_owner_prefixes.py --compact`를 통과시킨다.
- SYS modern slice는 `coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json` → 결정적 생성 후보 `modern-capability-causal-state-contracts.v2.json` → `modern-capability-event-successor-lineage.v2.json` 순으로 읽는다. 구현 전 `generate_modern_causal_successor.py --check`, `generate_modern_event_successor_lineage.py --check`, `validate_modern_causal_state_contracts.py --self-test --compact`, `python3 coding-readiness/validate_sys_exact_business_start.py --self-test --compact`, `node coding-readiness/audit_sys_exact_business_start.cjs --self-test --compact`를 통과한다. Auth/Platform/Insights/Configuration의 명시된 owner sink와 handler 순서를 임의 변경하지 않는다.
- `MOD-SYS-LISTEN`은 operation causal·semantic binding·public identity·exact schema·event payload canonical 5개에 합성된 Listening 행만 구현 정본으로 사용한다. `dwp.hris.sys.listening.stream-authority-successor.v1`은 이 5개에서 단방향 생성되는 검증용 summary다. `generate_sys_listening_stream_authority_successor.py --check --compact`와 `validate_sys_listening_stream_authority_successor.py` normal/self-test가 PASS하지 않으면 기존 4 table/6 event/V287 경로를 구현하지 않는다. configuration·protected admission·insights·Auth issuer의 4 stream과 5 runtime purpose, stream-local FK/receipt/outbox/inbox/history, publish/close result-unknown refetch, submit/close 동일 protected fence가 canonical 5개와 derived summary에서 일치해야 한다. 전체 CRUD는 `NOT_STARTED_G3_G4`, 실제 identity/process isolation은 G6다.
- 이 세션은 자기 feature bounded test와 SYS owner-local migration 검증만 실행한다. `validate_modern_causal_independent_oracle.py`, `run_modern_causal_independent_pg_fixtures.py`, `validate_modern_causal_final_endorsement.py`, modern causal·base 전체 `--postgres-feasibility`, unscoped full readiness와 전체 suite는 Integration Control 전용이다. SYS owner-local Docker 검증도 Control의 host semaphore·실행 지시에 따라 직렬 실행한다.
- Slice 검증은 행의 `G2-SYS-*` profile/key와 G3 profile·exact `frontend_test_path`를 두 closed command catalog에서 해석하며 파생 display 문자열은 실행하지 않는다. SYS base G2는 readiness와 service-local migration validator 둘 다 필수다. 일반 SYS slice는 선택된 Auth 또는 Platform service-bounded profile만, `MOD-SYS-LISTEN`은 configuration/protected/insights/issuer 네 backend profile과 `G3-SYS-LISTEN-FE`를 모두 실행한다. frontend는 `[SLICE:<slice_id>]` exact 파일 typed PASS만 인정하며 root Gradle check·전체 Vitest·skip/todo/no/unrelated test는 모듈 증거가 아니다.
- G1 exact 산출물: `session-evidence/sys/g1-characterization.md` (`ALLOC-SYS-G1-001`), `session-evidence/sys/g1-child-trace.csv` (`ALLOC-SYS-G1-002`), `session-evidence/sys/g1-decision-log.csv` (`ALLOC-SYS-G1-003`). 부모 디렉터리를 만들고 `g0/g1-evidence-output-contract.md`의 schema와 parent FK를 지킨다.
- 현재 SYS 구현계약은 `session-evidence/sys/g2-implementation-contract.v2.md`다. 원본 `g2-implementation-contract.md`는 `SUPERSEDED_IMMUTABLE` 역사 근거이며 실행 지시로 사용하지 않는다. SYS 물리 migration 설계 원본은 `g2-auth-physical-schema.sql`과 `g2-platform-physical-schema.sql`이고, 번호·파일명 권위는 `g0/migration-allocation-register.csv`의 `MIG-SYS-AUTH-217-245`와 `MIG-SYS-PLATFORM-262-290`뿐이다. `g2-physical-schema.sql`은 exact parity를 검토하는 합본 catalog일 뿐 실행하거나 서비스 migration으로 복사하지 않는다. 시작 전과 제출 전 `validate_sys_readiness.v2.py` 및 `validate_sys_service_local_migrations.py` normal/`--self-test`를 통과하고, PostgreSQL/Docker가 가용하면 `--docker-postgres`까지 실행한다.
- SYS의 업무 의미 착수 정본은 `coding-readiness/sys-exact-business-start-successor.v1.json`과 `sys-exact-business-start-pin.v1.json`이다. 이 후속 계약은 기존 HRM/PER/PAY/TIM 4개 모듈 canonical을 수정하거나 SYS 정본으로 오인하지 않고, `TFR-SYS-001..013` 13개(12 active + 1 retired), SYS가 구현하는 교차 소유 `BASE-TFR-HRM-015` signed extension, `MOD-SYS-ANALYTICS|LISTEN|AI`의 정확히 17개 slice를 G2 계약·상태·스키마·물리 owner·권한·golden·G3 allocation에 결박한다. 구현 전 `python3 coding-readiness/validate_sys_exact_business_start.py --self-test --compact`와 독립 구현 `node coding-readiness/audit_sys_exact_business_start.cjs --self-test --compact`를 모두 통과한다. 이 두 검증의 PASS는 SYS slice의 설계 입력 완결성만 뜻하며 전역 Gate, G4 완료, G5 Design AI 또는 G6 운영 활성화를 대신하지 않는다.

## 소스 coverage

- 프론트 SYS/portal route 153건
- 백엔드 controller 후보 22건
- entity 14건
- `session-registers/hris-sys-source-coverage.csv` 189행
- SYS 설계·추적 계약은 G2_READY지만 코드 착수는 `VALIDATOR_CONTROLLED`다. `transition_g3_gate.py --open`이 전역 후보 검증 4개를 내부 실행하고 최신 전환행을 `COMMITTED_OPEN_AUTHORITATIVE_LIVE`로 커밋한 뒤 `gate_authority.py --check-open`이 PASS할 때만 구현하며, Auth/Platform 중앙 파일은 Integration Control 단일 writer 규칙으로만 병합한다.

## 목표 소유권

- Frontend HRIS shell, 표시명/alias, administration/integrations 메뉴 projection
- Auth의 product access package catalog/assignment/projection/SoD 고도화
- Platform/People의 versioned configuration lifecycle와 HRIS source-system connector 확장
- 공통 code/i18n/form/template/import/job/extension registry의 framework
- domain별 실제 근태·급여·평가 규칙 내용과 테이블은 해당 domain 세션 소유

## 포함 기능군

- tenant/company 기준정보 중 DWP Platform/People에 필요한 매핑
- 사용자·그룹·역할·메뉴·프로그램 정보를 DWP app entitlement/access package로 변환하는 migration mapping
- 공통코드·다국어·양식·template의 versioned draft/simulate/approve/publish/rollback
- batch/job type registry, schedule/lease/checkpoint/receipt/retry/DLQ와 실행 감사
- import/export template, object storage, 검증·오류행·재실행·대사
- connector, mapping version, secret reference, activation, health, reconciliation
- audit/search/retention/legal hold와 extension/country-pack manifest governance

## 통합·고도화 방향

- SKKF 메뉴 ACL 테이블을 이관하지 않고 `APP.HCM:VIEW + atomic duty + population/field policy`로 projection한다.
- class/method reflection job을 allowlisted job type/handler registry로 교체한다.
- dictionary/native SQL 조회를 허용된 dataset/query template과 parameter binding으로 교체한다.
- module마다 반복된 코드·직원·조직·메일·파일·배치 구현을 폐기하고 DWP owner service를 호출한다.
- 설정은 JSON blob 난립 대신 versioned typed schema, validation, impact preview, approval, rollback을 갖는다.
- notice/board/guide는 기존 DWP communication/content 기능과 대조해 재사용 또는 폐기한다.
- FTP/은행/ERP/API credential 평문을 저장하지 않고 secret reference와 connector별 최소권한을 사용한다.

## 선행 역할

이 세션은 다섯 세션 중 첫 번째 foundation owner다. 다음 계약을 먼저 제안·고정하고 coordinator 승인을 받는다.

- HRIS app display/alias와 route/capability manifest
- access package assignment 및 exact PEP contract
- `Money`, `EffectivePeriod`, `Actor`, `Receipt`, `PolicyVersionRef` 등 최소 공통 타입
- event envelope/schema registry와 outbox/inbox contract
- config/formula/form publish lifecycle
- async job/import/export receipt와 result-unknown recovery
- migration 번호·중앙 파일·shared contract 변경 registry

## 파일 충돌 방지

- `settings.gradle`, gateway route, product authorization bundle, central HCM navigation/manifest, shared event registry는 coordinator만 병합한다. SYS 세션은 변경안을 contract proposal로 제출한다.
- HRM/PER/PAY/TIM은 변경 제안과 slice-owned registration을 제출하고 중앙 파일을 동시에 수정하지 않는다.
- migration 번호는 서비스별 coordinator registry에서 할당받기 전 생성하지 않는다.
- Auth와 Platform migration은 서로 다른 데이터베이스에서 독립 실행돼야 한다. 상대 서비스 테이블/FK, cross-database query, psql include, repository import를 금지하고 public UUID/revision receipt/versioned event만 사용한다. 과거 Auth V211–V239/Platform V231–V259는 현재 사용 가능한 예약이 아니다. 실제 common V211/V212 및 V231..V237을 보존하고 Control이 충돌 없는 successor 번호·파일명을 승인한 뒤 CREATE-only로 생성한다. 합본 DDL을 한 서비스에 배치하지 않는다.

## 첫 vertical slice

`HRIS 앱 진입 → 디렉터리 그룹에 access package 할당 → app grant/atomic duty/policy projection → 메뉴 표시/API PEP → 만료·회수·감사`를 완성한다.

Home과 Explorer를 구현할 때는 다음 fail-closed 계약을 함께 적용한다.

- Home은 HRM/TIM/PAY/PER 요약과 SYS 할 일의 닫힌 five-branch discriminated union만 반환한다. `module`, `widgetType`, `data.kind`의 교차 조합, digest-only payload reference, 자유형 JSON과 민감 source payload를 거부한다.
- owner contribution의 `ownerPopulationScope`와 브라우저의 `browserAudience`를 분리하고, persona outer PEP와 owner `VIEW/MASK/OMIT` fieldDecision 중 더 제한적인 결과를 요청마다 다시 적용한다. manager가 payroll/operations scope로 상승시키는 변조는 opaque deny다.
- Explorer workbench enum은 `MY_HR|TEAM|HR_OPERATIONS|TIME|PAYROLL|PERFORMANCE|SETTINGS`와 exact 일치해야 한다. SYS-owned preference/recent endpoint는 tenant/user를 인증 문맥에서 바인딩하고 최대 20 favorites, 30-day TTL, 안정적 순서, entitlement re-filter, retired/denied route purge를 강제한다.
- 진행중 업무는 authorized receipt/case의 allowlisted projection만 저장·반환하며 command body, review answer, 급여/식별자 같은 민감 원문을 저장하지 않는다.

## 최신 HRIS 필수 범위 — G3B~G3D

[modern capability delivery register](../coding-readiness/modern-capability-delivery-register.csv)와 [modern capability trace register](../coding-readiness/modern-capability-trace-register.csv)를 구현 정본으로 사용한다. 작업 전 [exact coding contract](../coding-readiness/07-modern-capability-coding-contract.md), [exact transport/data schema](../coding-readiness/modern-capability-exact-schema-contracts.v1.json), [typed event payload](../coding-readiness/modern-capability-event-payload-contracts.v1.json), [SYS module contract](../session-evidence/sys/g3-modern-capability-contracts.v1.json)을 함께 검증한다. 아래 항목은 아이디어 목록이 아니라 이 세션의 `ALLOCATED_REQUIRED_NOT_STARTED` 필수 범위다. 각 delivery wave에서 aggregate/API/event/PEP/fixture를 구현하고, G4에서 anonymity/cohort/privacy negative·metric lineage·AI policy/provenance/evaluation/kill-switch acceptance evidence를 모두 제출한다. AI가 고용·평가·급여·징계 결정을 자율 확정하지 않도록 human-control 계약을 강제한다. 구현 전에는 완료로 표시하지 않으며 production 활성화는 G6 승인과 별개다.

- `HRIS.MODERN.EMPLOYEE_LISTENING`
- `HRIS.MODERN.PEOPLE_ANALYTICS`
- `HRIS.MODERN.GOVERNED_AI`

## G5A 필수 — SYS 및 HRIS 공통 셸 전체 화면 Design AI 프롬프트 패키지

G4 뒤 [전체 화면 Design AI 전달 계약](./90-design-ai-handoff-output-contract.md)에 따라 `output/hris-sys-design-ai-YYYY-MM-DD/`와 검증 ZIP을 만든다. SYS는 공통 DWP HRIS 셸·HRIS 홈·공통 디자인 계약의 단일 owner다. 최소 화면군은 HRIS launch/home, 앱·access package·그룹 assignment, 메뉴/capability projection, code/policy/form/template, job/import/export, connector·mapping·secret reference, audit·retention·legal hold, country/extension pack과 platform operations다. 실제 최종 메뉴·route·studio/wizard/tab/dialog/log/report·persona/권한·SoD·상태를 `05-screen-coverage-register.csv`에 100% 연결하고 `UNMAPPED=0`이어야 한다. 타 모듈 업무 화면을 재설계하지 않고 공통 shell·용어·navigation 계약만 제공한다. 이 패키지 없이는 SYS 세션을 완료 처리하지 않는다.

## 완료 특화 기준

- 31 access package/128 atomic duty(base 67 + modern 48 + IA initial-read 13)/29 SoD catalog의 seed·assignment·projection·drift test. 수치는 `hris-permission-group-matrix.csv`, `hris-atomic-duty-matrix.csv`, `hris-sod-rule-matrix.csv`와 exact 일치해야 하며 subset 검사는 금지한다.
- 모든 HRIS route의 product entitlement와 exact capability default-deny
- config publish와 job 실행의 maker/checker·step-up·rollback/receipt
- HRIS 업무 DB에 별도 user-menu ACL 0
- native arbitrary SQL/reflection execution/plain secret 0
- 모든 SYS source 행 판정과 DWP 공통기능 재사용·폐기 trace
- Auth 7개/Platform 25개, 총 32개 base table의 service-local DDL exact closure, 각 tenant table의 ENABLE+FORCE RLS와 policy, index/constraint, local-only FK 검증. 현행 `validate_sys_readiness.v2.py` normal/`--self-test`와 service-local migration validator normal/`--self-test`/Docker PostgreSQL 검증이 모두 PASS한다. `validate_sys_readiness.py`는 immutable G2 predecessor이므로 실행 정본으로 재사용하지 않는다.
