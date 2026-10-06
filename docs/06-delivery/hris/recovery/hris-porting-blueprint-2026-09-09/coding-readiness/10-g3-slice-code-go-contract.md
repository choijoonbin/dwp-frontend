# G3 named vertical-slice code-go contract

`module-code-gate-register.csv`의 `OPEN_G3_CODE`는 다섯 모듈의 범용 코어 착수 가능 상태다. 실제 코드 변경은 추가로 `g3-slice-code-go-register.csv`의 명명된 slice와 `G3-CODE-GO-*` 토큰에 귀속되어야 한다. 정본은 base target family 86개와 modern capability 16개를 합친 추적 slice 102개다. 그중 100개만 code-enabled이고, `BASE-TFR-HRM-006`과 `BASE-TFR-SYS-013`은 각각 `RETIRED_NO_CODE / NOT_APPLICABLE_RETIRED / NO_CODE_GO_RETIRED`인 evidence-only slice다. retired 두 행은 source retirement와 target absence의 추적성만 유지하며 file·migration allocation, target change path, G3 command 또는 G4 runtime evidence를 갖지 않는다. 나머지 각 행은 IA 화면, API/event, 권한, schema/state, dependency, 파일·migration 구간, 실행 명령과 G4 runbook·telemetry·clean/upgrade migration·worker recovery·acceptance evidence의 정확한 출력 경로를 함께 봉인한다. `NOT_STARTED_G3`는 구현 완료가 아님을, `NOT_AUTHORIZED_G6`는 운영 활성화가 아님을 명시한다.

API·내부 service PEP·producer XCON·SYS G2 contract·base event·modern operation/event의 primary 구현 owner는 526행 `g3-contract-primary-ownership-register.csv`가 독립 정본이다. MODERN_EVENT는 NOT_STARTED_G3 상태에서 predecessor v1 32종을 잔존 없이 supersede/split하고, 공개 outbox·AsyncAPI 계약인 v2 86종(HRM 33, PER 29, TIM 6, SYS 18)을 각각 exactly-one primary owner로 봉인한다. `target-family-resolution-register.csv`의 `primary_resolution_refs`는 이 정본과 exact semantic set으로 닫히고, `related_resolution_refs`는 구현 권한을 부여하지 않는다. generator는 이 정본을 소비하며 validator는 G2 source universe, upstream primary semantics, 생성 register의 exact-one primary 귀속을 독립 검증한다. XCON 및 service PEP consumer는 각각 `consumed_xcon_refs`, `consumed_service_pep_refs`에서 별도 역할로 봉인한다.

generated Java contract의 구조·digest·compile과 실제 도메인 행위는 별도 Gate다. `generated-contract-runtime-invariant-register.csv`는 canonical codegen manifest의 89개 `DOMAIN_RUNTIME` member(기존 81개 + PDX-012~014 8개)를 producer/consumer slice와 acceptance policy에 귀속하고 `g0/validate_generated_contract_runtime_invariants.py`가 독립 검증한다. DTO 생성이나 constructor test만 통과해도 해당 slice의 runtime·negative evidence가 없으면 완료로 올릴 수 없다.

기존 People HR endpoint에서 canonical HRIS endpoint로의 전환은 `hris-api-sor-transition-register.csv`의 23개 source-extracted decision을 따른다. 단순 endpoint 치환이 불가능한 aggregate/workspace read는 등록된 복수 canonical contract의 response composition으로 재구축하고, feature flag는 요청마다 legacy 또는 canonical 중 하나만 선택한다. dual read/write, silent fallback, schema 호환 검증 없는 직접 URL switch, BENSK 상태 재사용은 금지되며 `validate_hris_api_sor_transitions.py` normal/self-test가 통과하지 않으면 해당 slice의 integration acceptance를 봉인할 수 없다.

모듈 세션은 코드 변경 전에 자기 slice를 선택하고 변경 경로마다 `g3-slice-touch-manifest.csv`를 작성해 `validate_g3_slice_code_go.py --touch-manifest <path>`로 검사한다. 알려지지 않은 slice, 다른 세션 경로, 등록되지 않은 API/event, 할당 밖 경로는 fail-closed다. 하나의 변경이 여러 slice에 걸치면 경로별 행을 분리하며, 중앙 contract/route/build/runtime 변경은 Integration Control 제출물로 분리한다.

## Migration owner-create and Control integration

모듈 owner는 자기 `migration-allocation-register.csv` stream·service·prefix·range와 slice reservation에 정확히 맞는 Flyway 직계 파일을 `CREATE`만 할 수 있다. schema touch가 없는 slice는 migration 파일을 만들지 않는 것이 정상이다. 기존 migration의 `MODIFY/DELETE/rename`, symlink, 범위·prefix·service 밖 생성, 다른 slice의 exact 또는 numeric version 예약 선점은 모두 금지한다. generic 파일명은 현재 Git·선행 verified checkpoint·미래 exact reservation을 제외한 next-free version만 허용하며, modern exact reservation과 `BASE-TFR-PAY-016`은 등록된 exact path만 허용한다.

owner는 실제 SQL·clean-from-zero/baseline-upgrade·slice regression을 포함한 `MODULE_COMMIT`을 먼저 봉인한다. Integration Control은 source-linked `INTEGRATION_MERGE`로 같은 path와 regular blob을 그대로 반영하고 typed `DBA_ACCEPTED_FOR_G3_INTEGRATION` workflow review, affected-service 및 global clean/upgrade replay를 검증한다. 이 workflow review는 G3 무결성 증거일 뿐 production/G6 실명 승인이 아니다. 이미 적용된 migration은 새 forward-correction으로만 복구한다. shared/on-demand 중앙 migration은 별도 owner proposal을 결속한 `CENTRAL_MATERIALIZATION`에만 남는다.

commit과 병합 evidence의 정본 형식은 `g0/g3-checkpoint-evidence-contract.md`다. entry SHA는 구현 HEAD로 덮어쓰지 않으며, 모듈 commit·중앙 materialization·integration merge를 append-only checkpoint로 분리한다. live Gate는 현재 HEAD가 최신 VERIFIED checkpoint와 같고 Git diff·touch manifest·명령별 PASS evidence가 모두 봉인된 경우에만 열린다.

검증 명령은 자유형 shell 문자열이 아니다. G2는 `g0/g2-validation-command-catalog.v1.json`의 `BLUEPRINT`/cwd `.`/argv-array profile과 행의 `g2_validation_profile_id`·`g2_validation_command_keys`를, G3는 `g0/g3-verification-command-catalog.v1.json`과 행의 backend/frontend profile·`frontend_test_path`를 사용한다. `*_display_non_authoritative`는 파생 설명일 뿐 실행 입력이 아니다. 모듈 backend는 service/slice-bounded test만 허용하고 root `./gradlew check`는 Control integration에서 정확히 한 번만 실행한다. frontend는 Vitest의 positional exact path와 `[SLICE:<slice_id>]` 이름 필터를 사용하고, 해당 파일의 테스트가 1개 이상 PASS하며 skip·todo·wrong·unrelated test가 0인 typed receipt가 필수다. `MOD-SYS-LISTEN`은 configuration/protected/insights/issuer 네 backend profile과 단일 listening frontend profile을 모두 실행한다.

## 실행

```bash
python3 coding-readiness/generate_g3_slice_code_go_register.py
python3 coding-readiness/validate_g3_slice_code_go.py --compact
python3 coding-readiness/validate_g3_slice_code_go.py --self-test --compact
python3 coding-readiness/validate_g3_slice_code_go.py --touch-manifest /absolute/path/g3-slice-touch-manifest.csv --compact
```

generator 출력과 register가 byte-for-byte 다르거나 102개 source가 전량·단일 귀속되지 않으면 중앙 Gate는 닫힌다. API/event의 canonical dependency는 IA surface까지 포함해 계산하며 self-test가 보고하는 전체 변조를 모두 거부해야 한다.
