# 업무 앱 소유 범위 마감 — 2026-09-04

업무 앱의 디자인 전 선행 기능, 회의 출처 배정 원장·SDK, 형식 및 인계 문서의 이번 소유 범위를 마감했다. 후속 승인 범위로 로컬 Platform DB에 V226을 적용하고 직접 API 실행을 확인했다. 새 업무 화면은 디자인 수령 후 이어가며, Meeting 후보 생성·재배정의 실제 원천 연동은 NO-GO를 유지한다. 현재 공유 작업 트리는 여러 제품의 미커밋 변경을 포함하므로 이 문서는 불변 릴리스 인증서가 아니다.

## 이번 마감의 변경

- `work-hub-loader.test.ts`: Prettier 형식만 수정했다. 업무 전용 35개 파일의 수정 전후 source AST·runtime AST 동등성을 확인했다. raw token 차이는 객체의 선택적 후행 쉼표 1개이며, 이를 정규화한 token 비교도 통과했다.
- `workspace-api.ts`: Work 소유 `WorkspaceWorkStatus` 선언만 여러 줄로 정리했다. 파일 전체 AST 동등성을 확인했고 다른 소유 내용의 bytes는 보존했다.
- `index.ts`의 Work policy export는 이미 형식에 맞아 수정하지 않았다. Activity 소유 export의 형식 문제는 해당 소유자가 정리했고, 두 공유 파일의 Prettier 재검사가 통과했다.
- Work 문서는 초기 검증 snapshot을 보존하면서 후속 공통 빌드 성공·U09 실제 SDK 소비·남은 원천 권한 조건을 연결했다. 원래 테스트 JSON의 수치를 새 결과로 덮어쓰지 않았다.

형식 마감 단계에서는 기능·권한·렌더링·API 계약, 서비스, DB를 바꾸지 않았다. 이후 실행 환경 반영 단계에서 Platform 서비스만 재시작하고 V226만 적용했다. Meeting 코드와 공통 동결 파일, 역할·운영 원천 설정은 변경하지 않았으며 commit·push도 수행하지 않았다.

## 후속 실행 환경 반영

- 139,101,731-byte PostgreSQL custom backup을 먼저 만들고 SHA-256을 확인했다. V226을 현재 스키마의 transaction 안에서 실행한 뒤 rollback하는 dry-run을 통과했다.
- 기존 Platform 프로세스만 정상 종료한 뒤 다시 기동했다. Flyway는 `226 - create work assignments`를 0.089초에 적용했고 health는 200/UP이다.
- 런타임 OpenAPI에서 업무 배정 12개 path·13개 operation을 확인했다. 신뢰된 사용자 컨텍스트의 목록 조회는 200과 0건을 반환하고, 인증 없는 요청은 401로 차단됐다.
- Meeting 원천 URL과 서명 키가 없는 상태의 CREATE probe는 502로 실패했다. 전후 `work_assignments`, events, receipts는 모두 0건으로 저장 부작용이 없다.
- 상세 원본과 한계는 [V226 실행 증거](meeting-assignment/evidence/runtime-v226-activation.json)에 기록했다. `/tmp` backup은 임시 복구 산출물이므로 운영 백업으로 간주하려면 별도 영구 보관이 필요하다.

## Work 소유 재검증

| 검사               | 결과와 범위                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 업무 전용 Prettier | 35개 파일 통과. 수정이 필요했던 파일은 loader 테스트 1개                                                                                         |
| 의미 동등성        | 35/35 source AST·runtime AST 동등, 선택적 후행 쉼표 정규화 후 token 동등. 공유 Work 상태 선언은 별도 전체 AST·비소유 bytes 보존 확인             |
| 공유 파일 Prettier | `workspace-api.ts`, `index.ts` 모두 통과                                                                                                         |
| Work 단위 재실행   | 앱 7개 파일 35개 + 공유 API 4개 파일 24개 = **59개 통과**, 실패/skip 0. 기존 48개와 배정 SDK 11개를 포함하며 다른 과거 집계와 중복 합산하지 않음 |
| Work 범위 ESLint   | formatter 대상 업무 파일 검사 통과                                                                                                               |
| Backend 배정       | 기존 최종 42개(실제 PostgreSQL 15개 포함) 통과 증거와 현재 코드 SHA 일치. 이번 형식 마감에서 backend 테스트를 다시 실행한 것으로 기록하지 않음   |
| Platform 실행      | 로컬 정본 DB Flyway V226 성공, health 200, direct OpenAPI 12 paths/13 operations, 신뢰된 목록 GET 200·0건, fail-closed CREATE 502·DB 0건 유지    |
| 정적 연결          | Work 독립 service-boundary, U09 SDK production reachability·unused internal exports 통과 기록 유지                                               |
| 문서·diff          | Work 로컬 링크와 형식, 양 저장소 `git diff --check` 확인                                                                                         |

이번 재실행의 원본 JSON·형식/동등성 범위·소유자 보고서 출처는 [마감 증거](evidence/work-owner-closeout.json)에 기록한다. 이전 [선행 기능 보고서](implementation-report.md), [배정 구현 보고서](meeting-assignment/implementation-report.md)의 테스트와 운영 경계는 각각의 당시 snapshot이다.

## 다른 소유 작업에서 회수한 후속 결과

아래 결과는 각 소유자가 실행한 보고서를 읽고 대조한 것이다. 이번 Work 재실행 수치로 합산하지 않는다.

| 소유 작업                                                                                        | 확인된 후속 결과                                                                                                                       | 한계                                                                                                            |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [공통 마감](../DWP-R1-CORE-006-product-surface-separation/11-2026-09-04-closeout.md)             | 전체 FE 385개 파일·2,606개 단위 통과, 전체 architecture/build 통과. 초기 raw 1,050.5/1,074.2 KiB, gzip 306.8/317.4 KiB, 예산 상향 없음 | 해당 공유 트리 실행 시점의 결과. 외부 출시 증적 37건은 BLOCKED                                                  |
| 공통 서비스 계약                                                                                 | signedWorkload 등록, checker 회귀 18개와 Gradle checkServiceBoundaries 통과                                                            | 정적 서명 계약은 현재 사용자 권한·대상 담당자 적격성을 증명하지 않음                                            |
| [Meeting U09 마감](../DWP-R1-MTG-001-enterprise-video-meetings/08-menu-connection-checkpoint.md) | 실제 메뉴→목록/상세/state→Work SDK 소비. 모델/runtime/SDK 52개, desktop/mobile 12개 통과 보고                                          | API fixture 검증이며 실제 공유 Gateway→새 Work 원장의 종단 증거가 아님. Work 단위 59개 및 공통 2,606개와 중복됨 |

초기 Work 보고서의 번들 실패는 당시 실제 관측이므로 보존한다. 이후 공통 소유자가 초기 import를 개선하고 전체 build를 통과시킨 사실을 별도 후속 결과로 연결한다.

## 남은 일

1. 사용자가 제공할 디자인으로 통합업무함·유형별 상세·개인 할 일 폼·오늘 계획·Calendar 연결·AI 지원·결과/모바일 화면을 구현한다. [00~12 디자인 프롬프트](design-ai/README.md)와 [배정 업무 추가 프롬프트](meeting-assignment/design-impact.md)를 사용한다.
2. 신규 후보의 Work 생성·재배정에는 승인된 다음 additive 권한 계약, Meeting 전용 현재 Auth 평가, People 대상 적격성, source receiver의 현재 ACL·보존·nonce 검증이 필요하다. 현 v1~v4나 Gateway 전용 권한 평가를 다른 용도로 사용하지 않는다.
3. 런타임 Platform OpenAPI를 backend 공식 계약으로 export한 뒤 frontend `openapi:sync`로 generated 계약을 갱신한다. 현재 committed backend/frontend snapshot과 generated client에는 assignment path가 0개다.
4. Work `version`·`assignmentRevision`, Meeting `sourceVersion`, `authorityRevision`은 별개다. 10초 source snapshot을 서비스 간 원자적 권한 철회 보장으로 해석하지 않는다.
5. 기존 배정의 실제 코드 소비·정적 검사 통과와 실제 Gateway/새 원천 승격의 종단 검증을 구분한다. Meeting U09의 후보 CREATE·REASSIGN 및 아직 제공되지 않는 Work 상세 URL은 비활성 조건을 유지한다.

업무 앱의 모든 새 화면·전체 외부 연동·운영 출시를 완료한 것으로 보고하지 않는다. 확인된 선행 개발과 인계가 완료된 상태에서 다음 디자인·권한·환경 증거를 이어받는다.
