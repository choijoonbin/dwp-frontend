# G3 전체 코딩 실행 계약

상태: `VALIDATOR_CONTROLLED` — 아래 authoritative live·contract validator가 모두 PASS한 시점에만 `OPEN_G3_CODE`  
적용 세션: `HRIS-HRM`, `HRIS-PER`, `HRIS-PAY`, `HRIS-TIM`, `HRIS-SYS`, Integration Control

이 계약은 G1 소스 특성화와 G2 구현 설계를 실제 DWP 코드로 전환하는 기준이다. 역사 산출물의 존재와 현재 전체 업무 설계 검증 완료는 다르다. 2026-09-14 독립 재검증에서 BASE/modern 및 shared authority의 P0/P1이 발견돼 현재 G3는 닫혀 있다. `coding-readiness/reports/readiness-recovery-2026-09-14.md`와 각 독립 보고서를 먼저 읽으며 remediation proposal/self-check는 승인된 exact successor나 착수 허가로 사용하지 않는다.

G1 진입 당시의 역사적 `g0-control-register.csv`/closeout seal과 달리, 현재 G3 권한 정본은 `g0/source-governance-decision.md`, role operational binding, authoritative live checkpoint, 이 계약과 `coding-readiness/module-code-gate-register.csv`다. 코어 코딩 허용은 source 재사용, 운영 출시·국가팩 활성화·실고객 전환 승인이 아니다.

최신 16개 capability 구현자는 `coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json`을 operation별 명령·조회·handler의 유일한 인과 정본으로 읽고, 그 정본에서 결정적으로 생성된 `modern-capability-causal-state-contracts.v2.json`을 구현 후보로 사용하며, `modern-capability-event-successor-lineage.v2.json`으로 predecessor와 active event를 구분한다. 후보를 수기 수정하거나 세 파일 중 하나만 골라 구현해서는 안 된다. 모듈은 자기 owner operation/table/event만 구현하고, Control은 세 정본과 generator·독립 oracle·PG evidence·최종 endorsement의 current hash chain을 전역 봉인한다.

## 시작 조건

전사 최초 착수 승인과 공통 변경 재봉인은 Integration Control이 아래 단일 전환 명령으로만 수행한다. 이 명령은 후보 OPEN을 준비한 뒤 **4단계 전역 검증**을 내부에서 표시된 순서로 실행하고, 동일한 publication digest를 확인한 최신 `COMMITTED_OPEN_AUTHORITATIVE_LIVE` 전환행을 마지막 durable append로 기록한다. 네 검증 명령의 개별 PASS나 보고서 파일만으로는 Gate 권위가 생기지 않으며 수동으로 OPEN을 선언할 수 없다.

```bash
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/transition_g3_gate.py --open
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
```

전역 봉인 승인 이후 각 모듈의 첫 변경·재개·slice 경계에서는 먼저 `gate_authority.py --check-open`으로 최신 권위 전환행을 확인하고, `--verify-seal-only`로 승인된 전역 봉인이 현재 정본과 일치하는지 확인한 뒤 두 live 명령에 `--session <자기 실제 세션 ID>`를 붙여 **scoped** 재검증을 한다. seal-only 검증은 진행 중인 다른 모듈의 dirty 상태를 global clean 실패로 해석하지 않는다. 다음은 HRM 예시이며 나머지 모듈은 정확한 HRIS-PER/PAY/TIM/SYS ID를 사용한다.

```bash
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-HRM
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-HRM
```

authority·seal-only와 scoped 검증은 게시된 전역 immutable/static 정본 및 자기 paired live worktree를 검증하므로 다른 모듈의 정상 dirty 진행을 착수 실패로 만들지 않는다. 미승인 공통/integration 변경은 제외할 대상이 아니며 artifact digest 불일치로 차단되고 Control 재봉인과 영향 모듈 재검증을 요구한다. 이 PASS는 전사 최초 승인/global report를 대체하지 않고 `--write-report`도 허용하지 않는다. 모듈 세션에서 매번 unscoped global heavy suite/DB 검증을 중복 실행하지 않는다. 아래는 모듈이 실행할 수 있는 비-DB 결정적 계약 검증이다. HRM/PER/PAY/TIM은 module exact primary+independent를, SYS는 SYS exact primary+independent를 선택하며 PER/PAY만 compensation v2 authority를 추가한다.

Slice별 실행 명령의 유일한 권위는 `g0/g2-validation-command-catalog.v1.json`, `g0/g3-verification-command-catalog.v1.json`과 `g3-slice-code-go-register.csv`의 profile/key/path binding이다. G2 catalog는 repository `BLUEPRINT`, cwd `.`, argv array, owner/executor/semaphore와 typed receipt를 폐쇄형으로 고정한다. base slice는 자기 모듈 exact validator 전부를, modern slice는 static normal+self-test만 실행하고 PostgreSQL 16/18는 `G2-CONTROL-MODERN-PG16-18`로 Control만 실행한다. G3 모듈 backend는 service/slice-bounded test만, frontend는 exact `frontend_test_path`의 `[SLICE:<slice_id>]` assertion을 typed wrapper로 실행한다. no/wrong/unrelated/skipped/todo test receipt는 PASS가 아니며 root `./gradlew check`는 `G3CMD-CONTROL-BE`에서 정확히 한 번만 허용한다. register의 `*_display_non_authoritative` 문자열을 복사해 실행하거나 수정하여 권한을 확장하지 않는다.

모듈 checkpoint draft와 sealed bundle은 owner의 `session-evidence/<module>/g3/module-evidence/checkpoints/<checkpoint-id>`에만 둔다. `prepare_g3_checkpoint.py prepare`가 manifest에 append한 blank operation template를 blueprint 밖 regular file로 복사해 선택값만 채우고 `finalize --selection-map <external-file>`로 전달한다. finalize는 external map을 immutable selected map으로 append하고 OS 임시 staging에서 exact command/touch evidence를 만든 뒤 sealed batch와 row/finalization batch를 `CREATE_NEW_ONLY`로 기록한다. canonical shard에 mutable 편집본을 두거나 directory rename·overwrite로 봉인할 수 없다. 중단 뒤 완전한 byte-identical phase만 재시도하며 partial/different bundle은 fail-closed하고 새 checkpoint ID를 사용한다. `capture_g3_checkpoint_evidence.py`의 `--output`은 표준 bundle root와 분리된 `direct-captures/<checkpoint-id>/<file>.json` shard 상대 경로만 허용한다. Integration Control은 공통 semaphore를 먼저 획득한 뒤 Gate를 재확인하고 exact bundle·shard manifest·Git touch·closed commands를 모두 검증하며, 중앙 register CAS 직전 Gate를 다시 확인하고 file/parent-directory fsync까지 완료해야 append 성공을 선언한다.

Control allocation을 요청하는 모듈은 앞선 자기 `MODULE_COMMIT`에 결속된 `dwp.hris.g3.owner-control-proposal.v3` JSON을 blueprint 밖에서 작성하고 `append_g3_control_proposal.py`로만 게시한다. helper가 owner repository Git blob과 `module-evidence/control-proposals/<id>.json` shard에 exact bytes를 봉인하고 중앙 proposal register CAS까지 마친 뒤에만 Control이 소비한다. Integration Control의 세 checkpoint kind는 `prepare_g3_control_checkpoint.py prepare/finalize`와 `append_g3_control_checkpoint.py --finalization` 경로만 사용한다. frontend contract 소비는 앞선 verified Control backend checkpoint의 OpenAPI·AsyncAPI·product-authorization regular blob manifest와 resolved command-set digest를 dependency row로 함께 봉인한다. checkpoint/dependency 두 register는 PREPARED transaction marker 뒤에 교체하고 COMMITTED marker를 마지막에 기록한다. PREPARED가 남은 동안 신규 append는 금지하며 prior/candidate register digest와 immutable bundle이 정확히 맞는 `--recover commit|rollback`만 허용한다. 모든 standalone global/scoped `--check-live`는 static+live 전체를 공통 host semaphore 안에서 읽고, scoped workspace-boundary companion은 해당 owner G3 shard만 읽는다.

```bash
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_target_family_resolution.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_target_family_resolution.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_api_pep_bindings.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_transport_schema_resolution.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_transport_schema_resolution.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_decimal_value_contract.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_decimal_value_contract.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_command_receipt_contracts.py
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_command_receipt_contracts.py --self-test
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_country_pack_boundaries.py
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_country_pack_boundaries.py --self-test
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_g6_database_activation_boundaries.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_g6_database_activation_boundaries.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/generate_information_architecture_register.py --check
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_information_architecture.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_information_architecture.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_g3_slice_code_go.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_g3_slice_code_go.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_cross_module_schema_contracts.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_cross_module_schema_contracts.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_compensation_snapshot_v2_authority.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_compensation_snapshot_v2_authority.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_physical_owner_prefixes.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_physical_owner_prefixes.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/generate_modern_semantic_field_lineage.py --check
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_modern_semantic_field_lineage.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_modern_semantic_field_lineage.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_modern_capability_contracts.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_modern_capability_contracts.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/generate_modern_causal_successor.py --check
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/generate_modern_event_successor_lineage.py --check
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_modern_causal_state_contracts.py --self-test --compact
node /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_module_exact_business_start.cjs --self-test --compact
python3 -B /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/audit_module_exact_business_start.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_sys_exact_business_start.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_sys_exact_business_start.py --self-test --compact
node /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/audit_sys_exact_business_start.cjs --compact
node /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/audit_sys_exact_business_start.cjs --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/session-evidence/sys/validate_sys_service_local_migrations.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/session-evidence/sys/validate_sys_service_local_migrations.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_base_schema_postgres_feasibility.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_base_schema_postgres_feasibility.py --self-test --compact
```

다음 전역·PostgreSQL·독립 검토 명령은 **Integration Control 전용**이다. Control은 공통 `hris-verification` semaphore를 보유한 상태에서 candidate와 독립 oracle을 서로 대조하고, PostgreSQL 16/18 결과가 comparable인지 확인한 뒤 full live가 최종 endorsement를 child process로 실행하게 한다. 모듈 세션은 아래 명령, 독립 evidence/report 쓰기, backend/frontend 전체 suite를 실행하거나 그 결과로 자기 승인을 게시하지 않는다.

pre-G3 공통 foundation은 최종 clean backend commit이 확정된 뒤 Approval
V36..V38, Platform V254.1/V261, Notification V32의 exact 6개 blob만
대상으로 한다. B260 baseline 최적화와 존재하지 않는 protected predecessor
Notification V31은 이 Gate 밖이다. Control은 PG16을
실행하고 그 XML·관찰 sidecar를 즉시 create-only 보존한 뒤 PG18도 같은
commit에서 보존한다. 두 evidence가 모두 검증된 후 allocation을 먼저,
그 allocation을 단방향 pin하는 내부 기술검토 receipt를 나중에 한 번씩
materialize한다. `ROLE.DBA_AUTHORITY`는 여기서 내부 기술검토 역할일 뿐이며
외부 실명 승인 또는 G6 승인을 뜻하지 않는다.

```bash
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/capture_pre_g3_common_foundation_postgres_evidence.py --self-test
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/capture_pre_g3_common_foundation_postgres_evidence.py --write --image postgres:16-alpine
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/capture_pre_g3_common_foundation_postgres_evidence.py --write --image postgres:18.4-alpine
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/materialize_pre_g3_common_foundation_migration_receipts.py --write-allocation
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/materialize_pre_g3_common_foundation_migration_receipts.py --write-technical-review
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_pre_g3_common_foundation_migrations.py --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_pre_g3_common_foundation_migrations.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/generate_migration_successor_register.py --write
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/generate_migration_successor_register.py --check --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_migration_successor.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_modern_capability_contracts.py --postgres-feasibility --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_modern_causal_state_contracts.py --postgres-feasibility --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/build_modern_causal_independent_oracle.py --check
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/build_modern_causal_independent_oracle.py --self-test
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_modern_causal_independent_oracle.py --oracle-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_modern_causal_independent_oracle.py --verify-design-report --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/run_modern_causal_independent_pg_fixtures.py --self-test --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/run_modern_causal_independent_pg_fixtures.py --postgres-feasibility --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/session-evidence/sys/validate_sys_service_local_migrations.py --docker-postgres --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_base_schema_postgres_feasibility.py --docker-postgres --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_modern_causal_final_endorsement.py --self-test --compact
```

`validate_modern_causal_final_endorsement.py`의 production 검증은 임의 shell 우회 명령이 아니라 전환 helper가 호출한 `validate_full_coding_readiness.py --check-live --write-report` 프로세스 안에서 같은 thread의 opaque semaphore capability를 확인하고 실행하는 내부 단계다. 공개 CLI에는 parent-lock bypass가 없으며 이 chain 밖의 직접 실행 결과는 승인 증거가 아니다.

위 검증 중 하나라도 실패하면 모듈 기능 코드를 변경하지 않는다. 등록 code-entry 기준선은 backend `787f25753a72dc5f0fbbb06783205c0bff6635a5`, frontend `c658679ef377f43ec4f9fec7e7433eb98f46970e`이며 통합·5개 paired worktree가 이 exact HEAD/tree에서 clean 상태로 정렬됐다. C1 migration reservation도 같은 backend checkpoint로 재봉인됐지만, 이를 임의 승인으로 해석하지 않는다. 각 세션은 authoritative live PASS 후 승인된 paired worktree, allowed glob, migration range만 사용한다.

실행 파일 경계는 `coding-readiness/module-structure-contract-register.csv`와 `coding-readiness/g3-file-allocation-register.csv`가 정본이다. 모듈 source/test/scaffold와 settings/build/Docker/devctl/CI/deploy의 중앙 single-writer 할당을 벗어난 변경은 금지한다.

추적 단위는 `coding-readiness/g3-slice-code-go-register.csv`의 base 86 + modern 16, 총 102개 slice이며 코드 착수 단위는 그중 active 100개뿐이다. HRM-006/SYS-013 두 retired evidence-only 행은 코드 토큰·target touch·migration·runtime command를 갖지 않는다. `OPEN_G3_CODE`인 모듈도 자기 active `G3-CODE-GO-*` 토큰과 변경별 touch manifest 없이는 파일을 수정하지 않는다. `validate_g3_slice_code_go.py --touch-manifest <path> --compact`가 세션·경로·API/event 귀속을 fail-closed 검증한다.

정보구조는 `coding-readiness/hris-information-architecture-register.csv`, `coding-readiness/hris-shell-navigation-register.csv`, `coding-readiness/hris-workbench-task-group-register.csv`, `coding-readiness/09-information-architecture-contract.md`가 단일 정본이다. base 76 + modern 22 node마다 canonical route, 흡수 workbench, owner feature/API, 권한 projection과 redirect 정책을 그대로 구현한다. `/hr/home`은 메뉴 catalog를 렌더링하지 않고 권한·scope별 widget composition과 할 일을 제공한다. 전역 sidebar는 7개 workbench entry만 노출하고, 각 모듈의 많은 기능은 46개 workbench 내부 task group·검색·즐겨찾기·최근·진행중 업무로 점진 공개한다.

모듈 간 데이터는 `coding-readiness/cross-module-canonical-schemas.v1.json`와 `cross-module-schema-binding-register.csv`의 21개 typed snapshot/event만 사용한다. provider와 consumer는 각자 generated import 및 contract test를 소유하고, digest-only·자유형 JSON·타 서비스 entity/repository/FK로 우회하지 않는다. 물리 테이블은 `physical-owner-prefix-register.csv`의 runtime·schema·prefix에 정확히 한 번 귀속한다.

모든 비동기 command receipt는 owner-local 저장소에서 `(trusted tenant, subject principal, originating action, Idempotency-Key)`로 예약하고 request digest 충돌은 `409`로 거부한다. 원 command의 action·subject·population digest·field-policy revision·purpose·authorization revision은 immutable하게 봉인하며 조회 때 현재 권한과 원 권한 중 더 제한적인 결정을 적용한다. TIM/PAY Product Core와 signed pack runtime/conformance harness는 G3 범위지만 실제 KR 법정 규칙·요율·서식·YEA provider와 tenant 활성화는 `country-pack-boundary-register.csv`에 따라 G6 전까지 disabled다.

## 구현 순서와 병렬성

다섯 세션의 Gate는 validator-controlled이며, authoritative live·published 검증이 PASS해 열린 시점에도 계약 의존성을 무시한 동시 완성을 뜻하지 않는다.

1. SYS와 HRM은 app entitlement·access package·공통 타입·event envelope와 Person/Worker/Assignment/Organization snapshot을 먼저 구현한다.
2. PER와 TIM은 위 계약의 provider/consumer contract test를 병렬 구현하고, 다른 모듈 DB나 repository를 직접 참조하지 않는다.
3. PAY는 HRM compensation snapshot과 TIM closed-result 계약을 mock provider로 먼저 구현한 뒤 실제 consumer로 전환한다.
4. Integration Control만 settings, gateway, 공통 contract registry, 중앙 navigation/manifest와 신규 서비스 scaffold를 병합한다.
5. 각 단계는 작은 vertical slice로 통합하고 전체 build matrix를 통과한 후 다음 slice로 이동한다.

같은 host에서 frontend full suite·build·security audit·SBOM을 모듈들이 동시에 실행하지 않는다. 모듈 checkpoint는 자기 feature 경로의 bounded test를 `--maxWorkers=2 --maxConcurrency=1`로 실행하고, Integration Control이 단일 semaphore 안에서 전체 `yarn test --maxWorkers=4 --maxConcurrency=2`와 build를 한 번씩 실행한다. 단독 test 재실행 PASS는 진단에는 사용하되 중앙 full-suite 증거를 대신하지 않는다.

## 최신 HRIS 기능 16건

`coding-readiness/modern-capability-delivery-register.csv`와 `coding-readiness/modern-capability-trace-register.csv`의 16건은 `PLANNED_REQUIRED_SCOPE`다. SKKF parity와 완료율은 분리하지만 전체 제품 범위에서 제외하지 않는다. 각 owner 세션은 할당된 G3B/G3C/G3D implementation wave와 menu, data, authorization, API/event, test, acceptance evidence를 구현·검증해야 한다. 현재 `NOT_STARTED_G3`인 항목을 이 Gate가 구현 완료했다고 주장하지 않는다.

이는 제품 개발 범위의 정의이지 모든 고객의 필수 설치 목록이 아니다. core HR/근태/급여/성과와 ESS/MSS에 선택 기능을 더하되 ATS/LMS/스킬·승계/WFP/WFM/listening/analytics/AI 설치는 exact dependency와 고객 선택에 따른다. Analytics/AI를 위해 listening/issuer 설치를 강제하지 않고 비활성 기능은 관련 없는 core 업무를 막지 않는다. 활성 기능의 required owner/source가 빠지면 fail-closed한다.

## 코드 구조

- Frontend는 `features/hris/<domain>/{routes,pages,components,api,model,forms,hooks,testing}` 경계를 사용한다. 정본 import edge는 `module-structure-contract-register.csv`를 따르며 route/page가 API를 직접 호출하거나 타 도메인 내부 store를 import하지 않는다.
- Backend는 service별 `api`, `application`, `domain`, `infrastructure`, `config` 계층을 사용한다. 정본 import edge는 `module-structure-contract-register.csv`를 따르며 domain에는 Spring/JPA/transport 타입을 넣지 않는다.
- `dwp-people-server`는 HRM과 추출 가능한 PER를 소유한다. TIM은 신규 `dwp-time-server`, PAY는 신규 `dwp-payroll-server`를 사용한다. SYS 전용 서버는 만들지 않고 Auth/Platform/Gateway/Audit 등 DWP 공통 플랫폼을 확장한다.
- 서비스별 DB 소유권을 지키며 cross-service FK·join·repository 호출을 금지한다. public UUID, versioned API/event, outbox/inbox와 projection을 사용한다.
- 유효일은 `[from,to)`이고 확정된 근태·휴가·급여 값은 append-only ledger와 correction/reversal로만 변경한다.

## 계약·데이터·복구

- 모든 신규·고위험 변경 command는 tenant, actor, purpose, `Idempotency-Key`, expected version/CAS, correlation/causation을 받는다. 단, 기존 DWP Platform의 `SYS-API-032 platform_updateSurface`는 fixed `surfaceKey=hcm-home`과 request body `version` CAS·동기 응답을 exact reuse하는 유일한 `BASELINE_BODY_VERSION_CAS` 예외이며 새 header/receipt를 만들지 않는다.
- sync 응답과 async receipt는 결과불명·중복·재시도·DLQ·reconciliation을 표현한다.
- API와 event는 additive versioning, consumer contract test, deprecation window를 갖는다.
- 테이블은 tenant composite key, public ID unique, 상태·금액·시간 check, effective overlap 방지, optimistic version, audit/outbox를 적용한다.
- Flyway는 `g0/migration-allocation-register.csv`의 등록 stream·service·prefix·range와 slice reservation 안에서 owner 모듈이 직계 파일을 CREATE-only로 추가한다. 기존 migration의 수정·삭제·rename·symlink, 다른 slice의 exact 또는 numeric version 선점은 차단한다. Integration Control은 앞선 owner `MODULE_COMMIT`의 동일 path/blob만 source-linked merge하고 typed DBA workflow review와 affected-service/global clean-upgrade replay를 봉인한다. shared/on-demand 중앙 migration만 proposal-bound `CENTRAL_MATERIALIZATION`으로 만든다.

## 권한·개인정보

canonical `APP.HCM` app entitlement(`APP.HRIS` compatibility alias) 아래 `직원·관리자·업무운영자·설정관리자·전사감사자` 5개 logical UI/persona category를 둔다. 이 다섯 분류 자체가 보안 권한그룹의 전부는 아니다. 실제 허용은 31개 risk/duty access package → 128개 atomic duty(base 67 + modern 48 + IA initial-read 13) + population scope + field decision(`VIEW/MASK/OMIT`) + purpose + SoD로 API PEP가 판정한다. UI 숨김은 권한 경계가 아니다.

모든 slice는 다른 tenant, 범위 밖 직원, 자기승인, 만료 권한, 민감필드, export, 대량작업에 대한 negative test를 포함한다. 급여·계좌·세금·건강·가족·장애·노무자료는 최소수집·암호화·마스킹·보존·삭제·legal hold·접근감사를 구현한다.

## 범용 코어와 활성화 Gate

코딩 가능한 범위는 Product Core, provider-neutral country-pack/connector SPI, typed tenant configuration, signed extension framework와 합성 fixture다. 다음은 `G6` 활성화 증거이며 코어 코드 착수를 막지 않지만 실제 어댑터·국가팩·고객 운영을 열기 전 반드시 닫아야 한다.

- 실제 ERP·은행·세무·보험·타각 계약, credential과 allowlist
- KR 법정값·시행일·반올림·신고 포맷 및 YEA 회귀팩
- 고객 운영 메뉴/권한/로그 parity, 익명화 데이터, reconciliation/UAT
- 실측 용량·성능·SLO·보존·DR와 Product/HR/Security/Privacy/DBA/SRE/법정 승인
- 과거 V24-era 역할을 보유할 수 있는 기존 Approval 운영 DB의 일회성 역할/ACL 복구: principal inventory, `rolinherit=false` 전환 또는 controlled rebuild, membership·ownership·cluster/database ACL 전후 diff, schema-history/ownership digest, backup restore point, strict restart, rollback rehearsal, 실명 DBA·Security·SRE release 승인

하드코딩된 회사명·법정값·provider 분기·plain secret·임의 SQL/reflection handler는 금지한다.

마지막 항목은 `ACT-G6-APPROVAL-LEGACY-ROLE-HARDENING`으로 영향을 받는 Approval production activation만 차단한다. 모듈 세션은 운영 DB를 직접 수정하지 않으며, fresh/disposable DB의 clean-from-zero migration과 `NOINHERIT`·strict ACL negative test로 G3를 진행한다. 기존 DB의 상태를 확인할 수 없거나 위 복구 receipt가 하나라도 없으면 G3를 되돌리는 대신 해당 운영 DB의 G6만 fail-closed한다.

## 화면과 디자인 단계

G3/G4에서는 기능·정보구조·상태·접근성에 집중한다. HRIS 홈은 메뉴 지도가 아니라 권한별 인사·근태·급여·성과 핵심 위젯과 할 일로 구성하고, 전체 업무 탐색은 별도 `/hr/explore`에서 제공한다. 복잡한 메뉴는 역할별 기본보기, 모듈 workbench, 즐겨찾기·최근·검색·진행중 업무로 점진 공개한다.

각 모듈의 기능 G4가 끝나면 반드시 `90-design-ai-handoff-output-contract.md`에 따라 전체 메뉴·화면의 Design AI 프롬프트 설계서와 검증 ZIP을 만든다. 반환 디자인 승인 전에는 `WAITING_EXTERNAL_DESIGN`, 교체와 전체 회귀 후에만 `VISUAL_REPLACEMENT_COMPLETE`다.

## Slice 종료 조건

- 해당 source parent와 child trace가 구현·테스트·retire 증거에 연결됨
- schema/API/event/state/authorization/golden 계약과 코드가 일치함
- loading/empty/403/409/stale/partial/result-unknown 상태가 처리됨
- unit/integration/contract/property/tenant-negative/security/reconciliation 테스트 통과
- telemetry, audit, runbook, rollback 또는 forward-correction이 존재함
- 중앙 build matrix와 architecture/security audit가 통과함
- 완료·부분완료·차단을 구분하며 파일 수나 화면 수로 완료율을 주장하지 않음

각 조건의 출력 위치는 해당 `g3-slice-code-go-register.csv` 행의 `g4_*_evidence_ref`를, 실행 명령은 행의 backend/frontend profile과 exact frontend test path를 `g0/g3-verification-command-catalog.v1.json`에서 해석해 사용하고 `required_g4_assertions`를 모두 증명한다. `g3_verification_command_display_non_authoritative`는 파생 설명이며 명령 권위가 아니다. `migration-clean-upgrade-rls-backfill`, `worker-crash-replay`, `feature-flag-event-forward-correction` 중 하나라도 실제 PASS evidence가 없으면 G4로 올리지 않는다. 실측 DR·SLO·on-call 승인은 별도 G6 조건이다.
