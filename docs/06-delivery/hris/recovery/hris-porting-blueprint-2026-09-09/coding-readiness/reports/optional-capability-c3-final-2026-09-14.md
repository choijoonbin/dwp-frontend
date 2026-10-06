# C3 선택 기능 START 경계 최종 보고

기준 시각: `2026-09-14T14:37:23Z`  
판정: **C3 START 경계 PASS / 전체 모듈 코딩 Gate 변화 없음(`CLOSED_FAIL_SAFE`)**

## 결과

`dwp-platform-contracts`에 provider-neutral typed descriptor, request, install state, semantic version, decision, error, exception, authorized-binding reference와 순수 pre-call guard를 추가했다. 구현 커밋은 `8dcaf1c0b69eda93584317b381503d6572aab568`, tree는 `e99103a30a6ca0981bf8afb0f2179b05ab283451`이며 전용 worktree는 clean 상태다. Integration에는 아직 병합하지 않았다.

독립 설계 재검토 중 두 가지 fail-open 가능성을 선제 제거했다.

- capability에 속하지 않는 operation을 임의로 “unrelated core”로 간주하지 않는다. `affectedOperations` 또는 명시적인 `preservedOperations`에 exact 등록된 작업만 허용하고 나머지는 `UNKNOWN_OPERATION`으로 차단한다.
- 요청한 HRIS 모듈이 descriptor의 consumer 집합에 없으면 `UNAUTHORIZED_CONSUMER`로 차단한다.

또한 Analytics/AI가 prerequisite를 통해 protected store/current issuer 바인딩을 우회 획득하는 구성은 catalog 생성 시 거부한다. 허용 결과에는 provider 객체나 credential이 아니라 capability별 최소 바인딩 참조만 포함된다.

## 닫힌 동작

- 미설치·비활성 기능 및 binding/prerequisite/version 부족은 영향을 받는 작업만 callback 전에 차단하고 provider 호출은 0회다.
- unknown capability, 비인가 consumer, 미등록 operation, duplicate descriptor, operation collision, unknown prerequisite, dependency cycle, 금지 바인딩의 transitive dependency를 모두 fail-closed 처리한다.
- WFM skill match는 WFM과 Skills를 모두 요구하지만 Skills가 없을 때 HRM/TIM core는 유지되고 Skills 호출은 0회다.
- country-pay pack 부재 시 statutory 계산만 막고 generic payroll authoring은 유지한다.
- connector 준비 부족 시 job만 막고 exact 등록된 manual path는 유지한다.
- employee listening은 config·insights·protected·issuer 네 바인딩을 모두 요구한다.
- non-listening Analytics/AI는 config·insights만 받고 protected/issuer 호출은 각각 0회다.

## 검증

- shared guard: 6 tests, 실패 0
- HRM/PER/PAY/TIM/SYS 소비자: 6 tests, 실패 0
- service-boundary/source-size/test-source-size/dependency-cycle/unused-private ratchet: 95 self-tests PASS
- source 검사: production 2,183개, test 1,111개; Spring constructor cycle 0
- 설계 계약: 15 capabilities / 15 scenarios, 14 mutation 거부
- 구현 정적 검증: production sources 11 / consumer modules 5 / shared test 1, 10/10 mutation 거부
- 구현 artifact aggregate: `a7db651a8b6cc051b5bedaed2bea7df51295c614ca0558880c84c7000dbc6e22`

## Integration Control 후속 연결점

1. C1/C2의 최신 backend integration 위에 `8dcaf1c0b69eda93584317b381503d6572aab568`을 병합하거나 cherry-pick하고 동일 검증을 다시 실행한다.
2. `g0/validate_code_checkpoint.py`의 `validate_companion_gate_contracts`에 `validate_optional_capability_implementation.py` 일반/`--self-test` 두 명령을 추가한다. 두 명령의 `--backend-root`는 최신 canonical backend integration worktree여야 한다.
3. `coding-readiness/validate_full_coding_readiness.py`의 `artifact_hashes()`에 `optional-capability-implementation-manifest.v1.json`과 `validate_optional_capability_implementation.py`를 추가한다.
4. `coding-readiness/README.md` 항목 65를 확장하거나 65a를 추가하고, 중앙 snapshot을 재생성·검증한다.

## 의도적으로 남겨 둔 경계

provider adapter, retry, idempotency, reconciliation과 실제 기능 통합 수용은 G4다. Tenant entitlement, credential, provider 계약, country certification, SLO와 production enablement는 G6다. 이번 작업은 이를 구현하거나 승인했다고 주장하지 않으며, 다섯 모듈의 전체 코딩 Gate도 열지 않는다.
