# 세션 프롬프트 — HRIS 통합·검증 Control Task

이 task는 여섯 번째 업무 모듈을 개발하지 않는다. `HRIS-HRM`, `HRIS-PER`, `HRIS-PAY`, `HRIS-TIM`, `HRIS-SYS`가 같은 제품 계약과 기준선 위에서 움직이도록 Gate·소유권·통합 증거를 관리한다.

## G0 실행 바인딩

- Backend control: `/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend`, `codex/hris-integration-backend-20260909`, code-entry `787f25753a72dc5f0fbbb06783205c0bff6635a5`
- Frontend control: `/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend`, `codex/hris-integration-frontend-20260909`, `c658679ef377f43ec4f9fec7e7433eb98f46970e`
- G0 정본과 live validator: `output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py`
- G0는 닫혔지만 통합 task는 매 checkpoint 전 live 검증 실패 시 모든 후속 병합을 중단한다.
- 전체 route·메뉴·workbench 정본은 `coding-readiness/hris-information-architecture-register.csv`, `hris-shell-navigation-register.csv`, `hris-workbench-task-group-register.csv`, `09-information-architecture-contract.md`다. 중앙 navigation/manifest 변경 전 `validate_information_architecture.py --compact`와 `--self-test --compact`를 실행해 base 76 + modern 22 node, `/hr/home` widget-only, `/hr/explore`, 7개 sidebar entry, 46개 내부 task group 및 redirect closure를 검증한다.
- 모듈 간 계약 정본은 `coding-readiness/cross-module-canonical-schemas.v1.json`와 `cross-module-schema-binding-register.csv`다. 매 checkpoint에서 `validate_cross_module_schema_contracts.py --compact`와 `--self-test --compact`를 실행하고, provider/consumer generated import·contract test·digest 정규화 drift를 차단한다.
- modern 인과 구현은 `coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json`, 그 정본의 결정적 생성 후보 `modern-capability-causal-state-contracts.v2.json`, `modern-capability-event-successor-lineage.v2.json`을 함께 봉인한다. 매 checkpoint에서 `generate_modern_causal_successor.py --check`, `generate_modern_event_successor_lineage.py --check`, `validate_modern_causal_state_contracts.py --self-test --compact`를 실행하고 모듈별 exact validator(HRM/PER/PAY/TIM primary+independent, SYS primary+independent, PER/PAY compensation v2 authority)를 재검증한다.
- `MOD-SYS-LISTEN`은 canonical modern 5개에 합성된 Listening 행이 active 정본이고 `dwp.hris.sys.listening.stream-authority-successor.v1`은 그 5개 입력을 단방향 검증한 derived summary다. Control은 summary generator `--check`, 독립 validator normal/self-test, 4개 stream allocation과 5개 verification profile을 함께 검사하고 canonical 5개와 summary/validator hash를 modern independent review/final endorsement source pin에 포함한다. canonical 5개에서 summary로의 역참조, 별도 mutable predecessor pin, legacy listening table/event/semantic 직접 소비 또는 단일 V287 예약 checkpoint는 거부한다. 이 계약은 G3 시작 경계만 고정하며 실제 CRUD/DB/runtime 또는 G6 identity/process isolation 완료 증거가 아니다.
- 독립 `validate_modern_causal_independent_oracle.py`, `run_modern_causal_independent_pg_fixtures.py`, `validate_modern_causal_final_endorsement.py`, candidate PostgreSQL 16/18, base/modern schema PostgreSQL, backend/frontend full suite는 Integration Control 단독 책임이다. 공통 `hris-verification` host semaphore 안에서 직렬 실행하고 current input hash·동일 PG16/18 결과·P0/P1=0·최종 endorsement receipt를 중앙 checkpoint에 봉인한다. 모듈이 제출한 자체 oracle/PG/full 결과를 전역 증거로 승격하지 않는다.
- 공용 non-Git blueprint는 `g0/blueprint-central-snapshot-manifest.v1.json`의 exact path/byte digest로 읽기 봉인한다. 모듈은 자기 G3 `session-evidence/<module>/g3/module-evidence` 또는 G4 `session-evidence/<module>/g4` shard에 `CREATE_NEW_ONLY`로만 제출하지만 자체 chain을 포함한 제출 전체는 `UNTRUSTED_SUBMISSION`이다. G3 checkpoint exact root는 `module-evidence/checkpoints/<id>`이며 draft/template/selected map/sealed files/row/finalization 전부 manifest entry여야 한다. Integration Control은 `append_g3_checkpoint.py`의 공통 semaphore 내부에서 현재 Gate, exact path·bytes·mode·manifest membership, Git diff/touch closure와 closed-catalog 명령을 독립 재검증·재실행하고 CAS 직전 Gate를 다시 확인한 뒤 file 및 parent-directory fsync가 끝난 중앙 test/touch digest만 append한다. G4는 active slice 전량의 양쪽 checkpoint와 5종 증거를 검증한 exact aggregate만 `append_g4_functional_gate.py`로 최신 checkpoint prefix/SHA anchor에 기록한다. `validate_blueprint_workspace_boundaries.py` normal/self-test, shard writer self-test 또는 각 Control append helper self-test 실패 시 통합하지 않는다. 이 절차는 workflow integrity를 제공하지만 외부 신원 attestation은 아니다.
- 중앙 materialization 전에 `append_g3_control_proposal.py`로 owner 외부 JSON을 owner Git blob, `module-evidence/control-proposals` shard, 중앙 proposal register에 차례로 봉인한다. `CENTRAL_MATERIALIZATION`, `INTEGRATION_MERGE`, `CONTROL_BASELINE_SYNC`는 `prepare_g3_control_checkpoint.py`가 `g0/control-evidence-intake/<module>/g3-control-checkpoints/<id>`에 만든 exact `0600` bundle만 입력으로 삼고 `append_g3_control_checkpoint.py`로 append한다. helper는 Control/owner 해당 live chain만 독립 replay하고 checkpoint와 optional cross-repo dependency register를 PREPARED marker→두 CAS→COMMITTED marker 순서로 file/parent fsync한다. 일반 실패는 세 파일 동기 rollback, process interruption은 prior/candidate digest와 같은 immutable bundle을 재검증한 `--recover commit|rollback` 외 경로를 금지한다. PREPARED marker 동안 module checkpoint와 새 proposal append도 fail-closed한다.
- 물리 소유권 정본은 `coding-readiness/physical-owner-prefix-register.csv`다. `validate_physical_owner_prefixes.py --compact`와 `--self-test --compact`로 다른 서비스의 schema/prefix/FK/repository/migration 침범을 차단한다.
- 다섯 모듈의 설계·추적 계약은 G2_READY지만 범용 코어 착수 Gate는 `VALIDATOR_CONTROLLED`이며 현재 재봉인 중에는 `BLOCKED`다. `transition_g3_gate.py --open`이 두 authoritative live validator와 published-truth normal/self-test를 내부 실행하고 동일 publication digest에 결속된 최신 `COMMITTED_OPEN_AUTHORITATIVE_LIVE` 행을 커밋한 뒤 `gate_authority.py --check-open`이 PASS할 때만 `07-g3-full-coding-execution-contract.md`를 실행한다. 운영·국가팩·실연계·고객 전환은 G6에서 별도 승인한다.
- 같은 host의 frontend full suite·build·security audit·SBOM은 Integration Control이 semaphore로 직렬 실행한다. 각 중앙 checkpoint는 `yarn test --maxWorkers=4 --maxConcurrency=2`와 build를 정확히 한 번 실행하고, 모듈의 bounded feature test나 단독 재현 PASS로 이를 대체하지 않는다.
- G2/G3 실행 권위는 각각 `g0/g2-validation-command-catalog.v1.json`, `g0/g3-verification-command-catalog.v1.json`과 slice row의 profile/key/path binding뿐이다. Control은 모듈 제출의 typed receipt를 믿지 않고 exact argv를 재실행한다. PostgreSQL 16/18 G2 profile은 `G2-CONTROL-MODERN-PG16-18` 단독, root `./gradlew check`는 `G3CMD-CONTROL-BE`에서 정확히 한 번이다. 모듈 backend root/full command, frontend wrong/no/unrelated/skipped/todo slice test, 누락된 SYS listening 4-stream profile은 중앙 checkpoint에서 fail-closed한다.
- `coding-readiness/g3-slice-code-go-register.csv`의 base 86 + modern 16, 총 102개 추적 slice 중 100개 active 행과 그 `G3-CODE-GO-*` 토큰만 코드 착수 정본이다. HRM-006/SYS-013 두 행은 retired evidence-only라 target touch·migration·command를 만들 수 없다. `validate_g3_slice_code_go.py --compact`와 typed evidence digest를 포함한 변경별 `--touch-manifest`를 검사한다. 모듈 owner는 등록 stream·range·prefix·slice reservation에 맞는 Flyway 파일을 CREATE-only로 봉인하며 Control은 source checkpoint의 같은 path/blob만 병합하고 typed DBA workflow review와 affected-service/global replay를 검증한다. shared/on-demand 중앙 migration만 owner proposal 기반 `CENTRAL_MATERIALIZATION`으로 만든다.

## 단독 소유권

- backend/frontend clean integration baseline과 paired worktree/branch 할당
- `dwp-backend/settings.gradle`, `dwp-backend/contracts/**`, `dwp-backend/dwp-gateway/**`
- `dwp-frontend/architecture/product-surface-authorization.v1.json`
- 중앙 HCM/HRIS navigation·product manifest와 compatibility alias
- 서비스별 Flyway migration 번호 registry
- `five-session-source-coverage-register.csv` master와 cross-session N:M trace
- schema/event/API registry, shared contract ADR와 exact `G3-CODE-GO-*` 발행
- SYS가 소유하는 공통 HRIS shell/design contract와 5개 모듈 Design AI package의 cross-module 용어·메뉴·component·권한 승인

모듈 코드를 대신 구현하거나 사용자의 기존 dirty checkout을 정리·덮어쓰지 않는다. 세션 제출물을 작은 vertical slice로 병합하고, 충돌하는 계약은 owner와 함께 명시적으로 결정한다.

## G0 종료 조건

1. backend와 frontend 각각의 승인된 integration commit을 기록한다.
2. 다섯 paired worktree, branch, 담당자, allowed/forbidden glob을 배정한다.
3. 모든 세션이 `five-session-execution-manifest.csv`와 공통 계약을 확인한다.
4. master 대장은 읽기 전용이고 session shard는 단일 writer의 untrusted submission임을 검증하며, Control 독립 replay와 중앙 CAS anchor 없이는 소비하지 않는다.
5. 중앙 파일과 migration 번호의 단일 writer를 지정한다.
6. checkpoint와 merge cadence, 실패 시 중단/복구 방식을 기록한다.

## G1 통합 판정

- 2,269 raw artifact와 추가 child trace의 중복·누락·고아를 검사한다.
- 모든 source 행의 disposition, target capability, owner, acceptance evidence와 decision owner를 검사한다.
- 운영자료가 없어도 범용 core 행위를 안전한 typed substitute·provider-neutral port·합성 fixture로 결정할 수 있으면 G1/G2를 `DECIDED`로 닫고, 실제 parity·법정·연계·고객 검증만 G6 activation으로 격리한다. 안전한 제품 결정을 할 근거조차 없는 항목에 한해서만 `UNKNOWN`과 차단 범위·자료 owner·기한을 기록한다.
- BENSK/ADDSK와 고객사 표식이 core 계약에 들어오지 않았는지 검사한다.
- 동적 메뉴·요소권한, controller method, service/job/interface/formula/file/SQL/state-transition coverage를 집계한다.

## `G3-CODE-GO-*` 발행 조건

토큰은 모듈 전체가 아니라 명명된 vertical slice별로 발행한다. 다음이 모두 있어야 한다.

- capability와 source-to-target N:M trace
- owner service·aggregate·물리 persistence 초안
- versioned API/event schema와 소비자 contract test
- command/state/guard/CAS/error/recovery 표
- app entitlement, atomic duty, population/field policy와 SoD
- tenant/retention/audit/idempotency/observability 계약
- golden 또는 characterization fixture와 명시된 허용오차
- allowed files와 할당된 migration 번호

전수 source/child trace, 물리 스키마, API·event, 상태·복구, 권한, 합성 golden의 G2 설계 계약은 닫혔다. 범용 코어 G3 Gate는 authoritative live·published 후보 검증과 최신 OPEN 전환행을 한 helper가 봉인하고 authority check가 PASS한 시점에만 발행되며, 각 vertical slice도 동일 조건을 다시 만족해야 병합한다. 실제 KR 법정팩/YEA, ERP·은행·세무·보험·타각 adapter, 고객 데이터 전환과 운영 승인은 `coding-readiness/activation-gate-register.csv`의 G6 Gate가 닫힐 때까지 활성화하지 않는다.

## 통합 검증

- 모듈 제출마다 build, unit/integration/contract, tenant-negative, authorization와 migration 검사를 실행한다.
- shared contract의 breaking change, cross-context DB 접근, direct repository/FK, fake success, 고객사 하드코딩을 차단한다.
- PAY/TIM에는 결정성·ledger·correction/reversal·receipt/reconciliation을, HRM/PER에는 effective-date·snapshot·상태전이·민감필드 검증을 추가한다.
- 결과를 `완료 / 부분완료 / 차단 / 미착수`로 보고하고 파일 수·화면 수를 진척률로 사용하지 않는다.

## G4/G5A/G5B/G5C

모듈별 source 인스코프 100% 판정, P0 자동화, 허용되지 않은 대사 차이 0, 운영 runbook과 회복 증거가 있을 때만 G4를 승인한다. 그 뒤 각 모듈에 다음을 강제한다.

1. `G5A DESIGN_REQUEST_READY`: `90-design-ai-handoff-output-contract.md` 형식의 전체 메뉴·route·surface 프롬프트 패키지, 독립 검토, verification JSON과 무결성 검증 ZIP. `UNMAPPED=0`, orphan=0이 아니면 모듈 세션 완료 금지. 외부 디자인 반환 전 상태는 `WAITING_EXTERNAL_DESIGN`이며 최종 완료가 아니다.
2. `G5B DESIGN_ACCEPTED`: 사용자·제품 owner의 SYS HRIS 홈과 비-SYS 대표 workbench landing/overview 선승인, 화면군별 채택/수정/보류 결정; 반환된 editable frame·component·token·interaction·asset/license를 coverage 대장에 연결.
3. `G5C VISUAL_REPLACEMENT_COMPLETE`: 코드 교체 후 기능·권한·상태·접근성·responsive·시각·golden 회귀 재검증.

SYS는 공통 DWP HRIS 셸·HRIS 홈·공통 디자인 계약을 한 번만 정의한다. HRM/PER/PAY/TIM은 자기 업무 화면만 설계하고, control task는 중복 메뉴·서로 다른 동일 용어·권한 누락·가짜 미구현 기능·민감정보 캡처를 차단한다.

G5A 산출 ownership/path 정본은 `coding-readiness/g5a-design-ai-package-allocation-register.csv`다. 현재 G3 checkpoint에는 아래 두 명령만 실행하며 실제 package 부재는 blocker가 아니다.

```bash
python3 coding-readiness/validate_g5a_design_ai_packages.py --mode planned --compact
python3 coding-readiness/validate_g5a_design_ai_packages.py --self-test --compact
```

첫 명령은 반드시 `PLANNED_NOT_DUE_AFTER_G4 / NOT_RUN_NOT_DUE`여야 한다. 둘째는 missing/hash/text PII/secret/unmapped/wrong-module/foreign/nonexistent target/rendered-image OCR PII/ZIP drift 9종을 차단해야 한다. 각 모듈 G4 승인 뒤에만 `--mode post-g4 --module HRIS-{MODULE} --package-date YYYY-MM-DD --compact`를 실행한다. 이 모드는 required file, exact manifest와 detached final verification, content hash, PII·secret, fresh Apple Vision OCR, 해당 모듈의 98 IA owner node 전량과 `(ia_node_id,surface_key)` N-surface 양방향 closure, G4 frontend surface inventory digest, 세션 G3 FE allocation과 실제 G4 commit blob, `UNMAPPED=0`, wrong-module/orphan/duplicate=0 및 directory/ZIP/checksum parity를 재검증한다. 성공은 `DESIGN_REQUEST_READY`일 뿐이며 실제 디자인 반환 전에는 `WAITING_EXTERNAL_DESIGN`이다.
