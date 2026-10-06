# DWP HRIS G0 운영 통제 패키지

이 디렉터리는 HRIS 5개 모듈 세션을 같은 기준선에서 안전하게 시작하기 위한 G0 정본이다. 준비도 문서의 **6개 논리 통제** 중 backend/frontend 기준선을 별도 증빙으로 관리하므로, 기계 대장은 **6 controls / 7 evidence rows** 구조를 사용한다.

## Gate 판정

- `G1`: 이 패키지의 live-state 검증이 통과하면 역할 실명이 아직 정해지지 않아도 characterization과 trace 작성은 진행할 수 있다.
- `G2 설계/G3 범용 core`: 사용자가 승인한 제품 방향, stable role binding, authoritative live validator, named slice token·touch manifest·checkpoint evidence가 모두 통과할 때 코딩할 수 있다. 이 권한은 SKKF source reuse 또는 운영 활성화 권한이 아니다.
- Production: 법정·개인정보·보안·운영 책임자의 실제 서명과 해당 release evidence가 없으면 활성화할 수 없다.
- Source: 현재 활성 모드는 `BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE`다. SKKF 코드·설정·binary·SQL·formula·asset의 복사와 SKKF dependency import는 금지한다.

## 정본 파일

- `g0-control-register.csv`: 6개 논리 통제와 7개 증빙행
- `integration-baseline-manifest.csv`: backend/frontend 기준선과 integration worktree
- `code-entry-baseline-lineage.csv`, `generate_code_entry_baseline_lineage.py`: 고정 characterization predecessor에서 현재 clean integration code-entry까지의 exact commit 순서, A/M/D diff digest와 path allowlist를 Git 객체로 재생성·대조한다.
- `worktree-branch-register.csv`: control 및 5개 모듈의 paired worktree
- `g1-g2-sealed-artifact-register.csv`: G1/G2 immutable package digest에 포함되는 exact allowlist. `session-evidence/<module>/g3`, `g4`, `g5` 하위의 실행 증거는 이 digest 범위에서 제외한다.
- `blueprint-artifact-successor-lineage.csv`, `current-blueprint-artifact-pointer.csv`, `validate_blueprint_artifact_lineage.py`: 이미 봉인된 G2 predecessor bytes를 보존하면서 PER은 6개 독립 Flyway 스트림 rebase와 reviewed modern causal/event projection을, SYS는 128-duty·6-dependency 현행 계약과 기본 2 + Listening 격리 4 migration stream을 versioned successor로 전환한다. aggregate hash set은 predecessor와 successor를 모두 봉인하지만 실행 경로는 current pointer의 successor만 사용할 수 있다. Validator는 파일 hash만 재봉인하지 않고 immutable PER v1 + 현재 reviewed SSOT 결정적 projection과 SYS predecessor→successor 승인 delta closed-set을 같이 검증한다.
- `blueprint-central-snapshot-manifest.v1.json`, `blueprint-workspace-boundary-register.csv`, `validate_blueprint_workspace_boundaries.py`: Git이 아닌 공용 blueprint의 중앙 입력을 byte digest·size·mode·exact path set으로 봉인하고, 다섯 모듈에는 자기 G3 `session-evidence/<module>/g3/module-evidence`와 G4 `session-evidence/<module>/g4` shard만 `CREATE_NEW_ONLY`로 허용한다. `write_module_evidence_shard.py --phase g3|g4`의 SHA-256 chain은 우발적·비조정 overwrite/deletion 탐지용일 뿐이며 shard는 계속 `UNTRUSTED_SUBMISSION`이다. session-scoped preflight는 immutable 중앙 입력과 해당 owner shard만 검사해 다른 모듈의 file→manifest publication 중간 상태와 경합하지 않고, unscoped Control 검증은 전체 shard를 검사한다. Control이 closed catalog 명령을 독립 재실행하고 exact Git path·bytes·mode와 touch/test digest를 검증한 뒤 G3는 `append_g3_checkpoint.py`, G4는 `append_g4_functional_gate.py`로 중앙 CAS/aggregate anchor를 기록한 경우에만 해당 digest가 Gate 근거가 된다. 이는 외부 신원 attestation이 아니다.
- `g2-validation-command-catalog.v1.json`, `validate_g2_validation_command_catalog.py`: repository `BLUEPRINT`, cwd `.`, argv array로 고정된 5개 base exact profile, 5개 modern static normal+self-test profile, Control-only PostgreSQL 16/18 profile와 typed receipt 계약. SYS base의 두 validator 누락과 모듈 PG 실행을 fail-closed한다.
- `g3-verification-command-catalog.v1.json`, `validate_g3_verification_command_catalog.py`, `run_required_frontend_slice_test_gate.py`: session·repository·slice별 required command의 exact argv 배열. 모듈 backend는 service/slice-bounded test만, frontend는 행의 exact test path에서 `[SLICE:<slice_id>]` PASS가 하나 이상이고 skip·todo·wrong·unrelated가 0인 typed receipt만 허용한다. root `./gradlew check`는 Control backend integration profile에 정확히 한 번만 있다.
- `session-environment-command-catalog.v1.json`, `session-environment-evidence.json`, `capture_session_environment_evidence.py`: 5개 모듈의 backend/frontend 실행성, frontend dependency materialization, 18개 read-only support worktree와 명령 receipt를 기계 봉인한다.
- `host_semaphore.py`: Integration Control 전체 suite와 module checkpoint 검증이 같은 host에서 겹치지 않도록 `hris-verification` exclusive lock을 제공한다.
- `prepare_g3_checkpoint.py`, `capture_g3_checkpoint_evidence.py`: module commit의 diff·allocation·operation·exact command evidence를 `session-evidence/<module>/g3/module-evidence/checkpoints/<id>`에만 shard-manifest 신규 append한다. prepare의 blank template는 blueprint 밖에서 선택값을 작성해 finalize에 입력하며 OS 임시 staging 외 canonical draft/봉인 파일의 직접 write·rename·overwrite는 금지한다. 실패한 불완전 bundle은 신뢰·삭제하지 않고 byte-identical phase retry 또는 새 ID만 허용한다.
- `append_g3_checkpoint.py`: module finalization을 신뢰하지 않고 exact 제출 directory/file/mode와 shard manifest membership을 재검증한다. Gate 재확인, closed-catalog 명령과 Git touch closure의 Control 독립 replay, 중앙 CAS를 모두 공통 `hris-verification` lock 안에서 수행하고 register file/parent directory fsync 및 동기 실패 rollback을 적용한다.
- `append_g3_control_proposal.py`: blueprint 밖 owner 승인 JSON을 stable-read하고 owner repository Git blob과 자기 `module-evidence/control-proposals` shard에 exact bytes로 먼저 봉인한 뒤, 동일 host lock에서 typed source MODULE_COMMIT·slice·Control allocation·path·operation·역할·시각을 독립 검증해 `g3-control-proposal-register.csv`에 CAS append한다. 수기 register append와 Control이 owner를 대신한 proposal 작성은 금지한다.
- `prepare_g3_control_checkpoint.py`, `append_g3_control_checkpoint.py`, `g3-control-checkpoint-transaction-state.json`: `CENTRAL_MATERIALIZATION`, `INTEGRATION_MERGE`, `CONTROL_BASELINE_SYNC`를 `g0/control-evidence-intake/<module>/g3-control-checkpoints/<id>`의 immutable `0600` bundle로 준비한다. 선택 map은 blueprint 밖 regular non-symlink 파일만 허용하고 Control closed catalog를 실행한다. append helper는 exact bundle·Git·proposal·dependency를 다시 검증하고 Gate를 CAS 직전 재확인한다. checkpoint/dependency 두 register는 PREPARED marker에 preimage/candidate digest를 먼저 기록한 뒤 file/parent fsync하고 COMMITTED marker를 마지막에 쓴다. 일반 실패는 세 파일을 동기 rollback하고 process crash는 동일 immutable bundle에서 명시적 `--recover commit|rollback`만 허용한다.
- `file-ownership-register.csv`: exact machine-readable allowed/central/deny 경계
- `new-file-allocation-register.csv`: G1에서 생성 가능한 exact 신규 산출물
- `g1-evidence-output-contract.md`: 15개 G1 산출물의 Markdown 섹션·CSV schema·parent FK·decision 무결성 계약
- `migration-allocation-register.csv`: 서비스별 high-water와 미할당 상태
- `migration-successor-register.v1.json`, `migration-stream-register.csv`, `validate_migration_successor.py`: backend migration subtree와 8개 실제 high-water, 6개 모듈 range, People V47~V50 공통 기반, 11개 exact-byte rename 계보를 C1 정본으로 봉인한다. 검증기는 중복·겹침·stale high-water·PER private/public 누수·lineage 변조를 fail-closed로 거부하며 이 PASS만으로 Gate를 열지 않는다.
- `build-matrix.csv`: push/checkpoint/nightly/Gate 검증 계약
- `support-evidence-register.csv`: backend negative-matrix/정식 contract 검증용 checkout과 frontend build의 Agent OpenAPI 호환 checkout, 총 2개의 SHA/tree/origin 고정
- `checkpoint-register.csv`: 현재 G3 runtime 대장이 아니라 과거 G2 시점의 5개 sealed evidence checkpoint. backend/frontend SHA와 `migration_ids`를 포함한 전체 byte generation은 역사 provenance로 보존하며 current baseline이나 C1 successor를 따라 repin하지 않는다. 실효 G3 판정은 `integration-baseline-manifest.csv`, `worktree-branch-register.csv`, `g3-checkpoint-register.csv`와 live validator가 별도로 담당한다.
- `g3-checkpoint-register.csv`: sealed entry HEAD 이후 실제 G3 commit을 writer/repository별 forward chain으로 기록하는 append-only 대장. 빈 대장은 아직 구현이 시작되지 않았음을 뜻하며, descendant HEAD는 최신 VERIFIED 행과 정확히 일치해야 한다.
- `g3-control-proposal-register.csv`: 중앙 materialization 전에 owner MODULE_COMMIT, source tree/touch digest, owner-repository Git blob, payload-bound owner-declared workflow integrity seal을 묶는 append-only 대장이다. 이는 외부 신원 attestation 또는 Product/G6 승인을 대신하지 않는다.
- `g3-cross-repo-dependency-register.csv`: Control frontend contract checkpoint가 앞선 verified Control backend checkpoint의 OpenAPI·AsyncAPI·product-authorization regular blob exact set을 소비했음을 typed receipt와 resolved command-set digest로 봉인한다. checkpoint와 dependency row는 위 Control transaction helper만 함께 append한다.
- `append_g3_control_delivery.py` + `g3-control-delivery-state.json`: Control release와 그 release의 허용 consumer 전체 sync receipt를 공통 `hris-verification` 잠금 아래 한 batch로 검증·sequence 할당·append하고 두 CSV digest와 transaction sequence를 마지막 marker에 봉인한다. 중간 쓰기 실패는 marker 불일치로 fail-closed이며 module이 이 대장을 직접 append할 수 없다.
- `validate_typed_contract_test_allocations.py`: XCON/PDX provider·consumer test 130개 경로가 의도한 session/repository/dependency의 active allocation에 정확히 한 번 속하는지 검증한다. 미할당 경로와 중복 allocation은 모두 거부한다.
- `g3-checkpoint-evidence-contract.md`: Git diff와 1:1인 touch manifest, command-level PASS JSON, module→Integration Control 반영 관계의 exact schema
- `role-register.csv`, `role-operational-binding-register.csv`, `raci-sla-register.csv`: stable role ID와 G1 운영 binding 및 결정권·SLA
- `source-scope-register.csv`: SKKF raw provenance snapshot과 G1용 정제 분석 뷰·취급 모드
- `source-risk-surface-register.csv`: snapshot별 binary/env/credential-like 파일의 값 없는 보수적 표면 계수
- `scan_source_security.py`: raw source를 실행하지 않고 현재 tree·reachable history·manifest·binary 표면과 정제 뷰를 재현하는 값 비노출 scanner
- `source-security-evidence/`: scan metadata, rule/denylist, history/current finding 위치, dependency/license/binary inventory, 2,269행 접근 판정, 6개 정제 뷰 register, reference-only SBOM과 digest chain
- `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/{hrm,per,pay,tim,sys,frontend}`: G1에서만 읽는 0444/0555 `.analysis.txt` 뷰; Git metadata·symlink·build/import/execute 금지
- `capture_target_command_evidence.py`, `target-command-evidence-backend.json`, `target-command-evidence-frontend.json`: raw command output 대신 명령·출력 SHA와 byte count만 보존하는 기준선 재생 증거
- `integration-cadence-and-recovery.md`: 병합·검증·복구 계약
- `source-governance-decision.md`: 권리 미확정 상태의 보수적 source 사용 결정
- `g0-closeout-report.md`: 종료 판정과 후속 차단 범위
- `validate_g0.py`: schema·교차참조·live Git 상태 검증기

## Entry seal과 G3 checkpoint

`integration-baseline-manifest.csv`와 `worktree-branch-register.csv`의 SHA는 현재 G3 진입 기준점(entry seal)이다. G3가 시작되기 전 공통 기반 후속 commit을 채택할 때만 아래 절차로 새 current 세대로 교체할 수 있다. 반면 `checkpoint-register.csv`의 backend/frontend SHA는 이미 봉인된 역사 G2 provenance이므로 current integration HEAD와 같게 만들기 위해 덮어쓰지 않는다. 실제 G3 변경은 named slice touch manifest와 command-level PASS evidence를 만든 뒤 `g3-checkpoint-register.csv`에 순차 추가한다. live validator는 current baseline/worktree와 immutable historical checkpoint를 별도 계약으로 검증하고, commit 실재·forward ancestry·Git diff와 touch manifest 1:1·changed-path digest·소유권·test evidence·각 worktree의 최신 sealed HEAD 일치를 확인한다.

G3 작업 권한은 `worktree-branch-register.csv`에 등록된 12개 exact path에만 있다. 모듈 경로는 `g1-20260910/{hrm,per,pay,tim,sys}/{backend,frontend}`, 통합 경로는 `integration/{backend,frontend}`다. 파일시스템에 남아 있는 2026-09-09 구 경로 `/hris/{hrm,per,pay,tim,sys}/{backend,frontend}`는 모두 `SUPERSEDED_DO_NOT_USE`이며, 존재 여부와 무관하게 작업·증거 생성·checkpoint 등록·병합 출처로 사용할 수 없다.

G3 시작 전에 entry 기준선 자체를 의도적으로 교체해야 할 때만 다음 절차를 수행한다.

1. 변경된 integration commit을 clean 상태에서 검증한다.
2. 아직 작업을 시작하지 않은 5개 모듈 branch를 그 commit으로 fast-forward한다.
3. `integration-baseline-manifest.csv`, `worktree-branch-register.csv`의 실제 SHA와 `captured_at`을 갱신하되, `checkpoint-register.csv`의 역사 G2 SHA/bytes는 변경하지 않았음을 확인한다.
4. `python3 transition_g3_gate.py --open`을 실행한다. 이 명령만 G0 live, full live 보고서 게시, published-truth normal/self-test를 내부에서 순서대로 실행하고 동일 publication digest에 결속된 OPEN 전환행을 마지막에 append한다.
5. `python3 gate_authority.py --check-open --compact`로 최신 전환행이 `COMMITTED_OPEN_AUTHORITATIVE_LIVE`이고 현재 decision·보고서·선언·runtime successor가 모두 일치함을 확인한다.

검증 결과가 실패한 상태에서는 G3 변경이나 병합을 시작하지 않는다. 값은 `PLACEHOLDER`, `TBD`, 빈 SHA로 대체하지 않는다. `g0-control-register.csv`와 `g0-closeout-report.md`의 G2/G3 차단 표기는 G1 진입 당시의 역사적 seal이며 현재 G3 권한 정본은 `validate_code_checkpoint.py`, role binding, named slice register다.

Integration Control의 G3 entry/final audit만 global `--check-live`를 실행한다. 각 모듈의 독립 preflight는 먼저 `gate_authority.py --check-open --compact`로 최신 OPEN 전환 권위를 확인하고, `coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact`로 현재 전역 봉인의 보고서·선언·checkpoint·artifact digest를 확인한 뒤 `validate_code_checkpoint.py --check-live --session HRIS-<MODULE>`과 `coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-<MODULE>`로 global immutable/static 정본과 자기 paired worktree만 재검증한다. seal-only는 다른 진행 중 모듈의 global clean 상태를 재검사하지 않는다. 두 validator의 global live와 모든 capture는 같은 `hris-verification` semaphore를 사용하며, scoped 검사에는 global report를 쓰는 `--write-report`를 결합하지 않는다.
