# 2026-10-07 HRIS G3 통합 로드맵 상태 Successor

> 상태: G3 complete with known G5 blockers; G4 authorized, not started
>
> 기준일: 2026-10-07
>
> 선행 정본: [G2 통합 로드맵 상태 Successor](2026-10-07-integration-roadmap-status.md)
>
> G3 판정: [G3 Canonical Contract Generation Receipt](2026-10-07-g3-canonical-contract-generation-receipt.json)

이 문서는 G1·G2 receipt가 byte 단위로 봉인한 선행 로드맵과 상태 문서를
수정하지 않고 G3 완료 후의 상태만 승계한다. 선행 문서의 검증 순서, 단일
writer, G5·G6·G7 권한 경계는 그대로 유효하다.

## 현재 Gate 상태

| 단계 | 상태 | 판정 |
| --- | --- | --- |
| G3 Canonical·조건부 v35 생성 | `COMPLETE_WITH_KNOWN_G5_BLOCKERS` | Backend `f0a971eada612e6a267ece104707f0cab4191343`; 통합 canonical source가 보존된 v34와 의미적으로 동일하여 `KEEP_V34`를 확정했고 v35·AUTH V243은 발급하지 않았다. Assignment 7개 API를 response schema와 high-risk proof header까지 포함한 reviewed OpenAPI로 고정했다. Fixture는 byte 동일하여 재발행하지 않았다. Modern canonical 4종·199 operation·157 event·695 primary-owner successor를 새 현행 권한으로 봉인했으며 역사 525행 원본의 byte 복원을 주장하지 않는다. 공식 신규 101 operation의 request/entity-child/response exact oracle(648 request fields, 117 record schemas, 139 response schemas)을 독립 감사로 닫았고 열린 P1·P2는 없다. |
| G4 Frontend 의미 통합 | `AUTHORIZED_NOT_STARTED` | G3 Backend contract pin을 유일한 생성 입력으로 사용한다. Backend v34를 재발행하지 않고, current Frontend v32·Reconciled v33 route 의미를 통합한 뒤 pinned v34 Authorization·fixture·OpenAPI projection을 한 번 materialize한다. 그 결과에 대해 sync/check의 no-op을 검증하고 route·model·i18n·snapshot은 변경 journey 단위로 통합한다. Home 앱의 visible identity는 API·catalog·i18n·runtime projection 전체에서 stale `인사`가 아닌 `HRIS`로 해결되어야 한다. |
| G5 통합 안정화·동결 | `NOT_STARTED_REQUIRED_NO_WAIVER` | 별도 이전한 live Auth/Platform export, People/PAY/TIM runtime OpenAPI parity, Docker clean/upgrade·persistence, production 38건·test 10건 source-size debt와 전체 결정론적 Gate를 해소한 뒤 FE/BE head를 동결한다. |
| G6 W1 Successor | `NOT_RUN` | G5에서 동결된 FE/BE head pair에서 정확히 한 번만 실행한다. |
| G7 Evidence Promotion·위임 | `NOT_AUTHORIZED` | 모듈별 packet 발급 전까지 module-parallel development authority는 `false`다. |

## G3 고정 결과

- Authorization: canonical v34 semantic checksum
  `852d20e1e639e1a7170f02b5714d21d8c51a9eb8ff5ac32d8b7940b82d6be83b`, v35 미발급,
  AUTH V243 미발급.
- OpenAPI: People 84 paths/91 operations/173 schemas, Gateway 1,665 paths/1,905 operations/3,591
  schemas. Backend Gateway projection SHA-256은
  `b203455b032f938a0c37bbe11d2ef68981e4e3f106d549427b1a15f06497cd0c`다.
- Fixture: `CHECKED_IDENTICAL_NO_REISSUE`.
- Recovery successor: 199 operations(133 command, 66 query), 157 events, 695 primary-owner rows.
  공식 신규 101 operations의 request/entity-child/response exact oracle은 648 request fields,
  117 record schemas, 139 response schemas로 봉인되었고 독립 최종 감사 결과는 `CLEAN`
  (open P1 = 0, open P2 = 0)이다.
  산출물은 `docs/06-delivery/hris/g3-successors/2026-10-07/`에 있으며
  `SEALED_G3_CANONICAL_SUCCESSOR_NOT_IMPLEMENTED`다.

## Runtime evidence의 G5 이전

G3에서 실행한 복구 시도는 기존 migration-control seal·owner DB credential과 충돌했다.
이를 반복 재실행하지 않고 Auth/Platform 격리 exporter와 People/PAY/TIM enabled-owner live
OpenAPI parity를 G5의 한 번의 runtime batch로 명시적으로 이전한다. G3 OpenAPI는
reviewed snapshot과 Assignment Springdoc slice로 검증한 **G4 통합 입력**이지 enabled runtime 정본이나
release 증거가 아니다.

G5 live parity diff가 비어 있으면 G4 증거를 그대로 재사용한다. Diff가 있으면
해당 Backend snapshot과 Frontend projection을 한 번 다시 동기화하고 변경된 contract·route·journey
검증만 무효화한다. 공유 semantic surface 범위가 달라지지 않았다면 G4 전체를 재실행하지
않는다.

## G4 권한 경계

G4는 Backend commit `f0a971eada612e6a267ece104707f0cab4191343`의 contract만 소비한다.
Frontend에서 shared Backend canonical source, Authorization version, ownership successor, migration을
수동 변경하지 않는다. current Frontend v32에 v34 projection을 즉시 덮어쓰지 않고
Reconciled v33 route 의미를 먼저 통합한 뒤 pinned backend output으로 정확히 한 번 생성한다.
Source 번역과 Backend V239에서 이미 `HRIS`로 고정된 visible Home application identity를 API,
catalog, i18n과 frontend runtime projection에서 다시 검증한다. G5는 migrated runtime DB에서
같은 identity를 확인한다. 추가 Backend semantic diff가 필요하면 SYS/Common change request로 G3를
다시 열어야 한다. G4 승인은 모듈 병렬 개발, 고객 활성화, production release를
승인하지 않는다.
