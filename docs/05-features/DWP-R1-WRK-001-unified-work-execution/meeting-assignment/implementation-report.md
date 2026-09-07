# 회의 출처 업무 배정 — 구현 결과와 연결 인계

기준일: 2026-09-04. Work 소유 backend·DB·공개 API·공유 클라이언트와 디자인 추가 요구를 구현했고, 로컬 Platform 실행 환경에 V226과 13개 operation을 반영했다. 실제 Meeting 원천 승격·재배정, 정식 OpenAPI 산출물, 인증된 Gateway 브라우저 종단, 새 Work 화면의 제공 완료를 의미하지 않는다.

## 사용자 행동과 소유권

회의에서 사람이 확정한 제목·설명·담당자·기한으로 독립 Work 업무를 만든다. 담당자는 조건을 보고 수락 또는 거절하며, 수락 후 시작·대기·완료한다. 요청자는 허용된 취소·재배정을 할 수 있다. 재배정하면 새 담당자의 수락이 다시 필요하고 이전 담당자의 조회·명령 권한은 사라진다.

이 객체는 개인 할 일과 구분한다. Meeting은 후보·원문·인용·후보 확정을 소유하며, Work는 확정된 업무 조건·수락·배정·진행을 소유한다. Meeting 원천 접근이 사라져도 독립 Work 조건과 수행은 현재 Work 권한에 따라 유지한다. 원천 참조·버전·링크는 모두 숨기며 새 생성·재배정은 현재 원천 검증에 실패하면 실행하지 않는다.

## 구현 범위

| 범위             | 구현                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work 도메인      | PENDING/ACCEPTED/DECLINED와 OPEN/IN_PROGRESS/WAITING/COMPLETED/CANCELLED의 별도 상태 축, 현재 생성자/담당자 권한, version·assignmentRevision              |
| PostgreSQL V226  | 업무·불변 이력·actor별 명령 영수증, tenant/source/candidate unique, 원천 재결속 금지, 감사 실패 시 전체 rollback. 로컬 정본 DB에 Flyway rank 193으로 적용 |
| 공개 API         | 5 GET + 8 POST. 목록·상세·원천별 조회·명령 복구·이력·생성·수락·거절·시작·대기·완료·취소·재배정. [정확한 경로와 DTO](contract.md)                          |
| Work 원천 송신부 | 전용 signed assertion, 고정 내부 method/path와 body SHA256, 30초 TTL, HTTPS 기본, redirect 금지, 5초 전체 응답 기한, 16 KiB 본문 상한, 모호한 JSON 거부   |
| 트랜잭션         | 원천 HTTP는 DB transaction 밖에서 수행. 최대 10초 검증 스냅샷·5초 DB lock 대기, 잠금 뒤 권한·버전·유효기간 재검증                                         |
| 응답 권한        | 원천 HTTP 완료 뒤 현재 참여자/행을 재조회하여 그사이 재배정된 구 담당자에게 내용이 돌아가지 않게 함. 영수증도 현재 권한 검사                              |
| 목록 성능        | 원천 HTTP 0회, NOT_REQUESTED·출처 null·canReassign=false. 상세·명령 결과·영수증에서 현재 출처 확인                                                        |
| 공유 SDK         | 직접 공개 API 호출·UUID 명령키·동일 요청 재시도·현재 명령 결과 보존·생성 본문의 임의 업무 조건 제거. 실제 U09 소비는 Meeting 소유                         |
| 디자인           | [01/05/09/12 추가 프롬프트](design-impact.md). 기존 00~12를 변경하지 않았으며 새 영구 메뉴·새 Work 화면 코드는 제작하지 않음                              |

서명은 요청자 증명이다. 현재 APP.MEETINGS 권한·사용자 ACTIVE·후속 업무 capability·대상 담당자 적격성 판정을 대신하지 않는다. sourceVersion, authorityRevision, Work version, assignmentRevision은 별개의 버전이다. 10초 스냅샷은 서비스 간 권한 철회와 Work commit의 원자성을 보장하지 않는다.

## 검증과 증거

이전 개인 업무의 테스트 집계를 이번 배정 업무의 집계에 포함하지 않는다. 배정 backend 42개·shared API 11개는 해당 실행 snapshot의 증거이며 이후 공통 전체 검사와 합산하지 않는다. 실제 Meeting 수신자는 테스트용 source port/로컬 HTTP stub과 구분한다.

| 검사                                                          | 판정·한계                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 배정 backend                                                  | 최종 42개 통과, 실패/오류/skip 0. Source HTTP 11·Signer 3·Controller 5·PostgreSQL 15·Service 8. [XML 요약·파일 SHA256](evidence/backend-tests.json). 관측성 전파와 브라우저 인증/session 헤더 비전달을 실제 stub 수신으로 포함                                                            |
| 실제 PostgreSQL                                               | 위 집계 중 15개. Testcontainers PostgreSQL 16의 V226·상태 전이·tenant/참여자·동시성·잠금 만료·멱등성·감사 rollback 검증. 전체 Platform 신규 배포 검증이 아님                                                                                                                              |
| shared API                                                    | 11개 단위 통과, 실패 0. [Vitest JSON](evidence/frontend-tests.json), 전체 TypeScript·범위 ESLint exit 0 및 [검사/파일 SHA256](evidence/frontend-checks.json). 실제 U09 소비나 브라우저 완료 의미가 아님                                                                                   |
| Work SDK 실제 소비·도달성                                     | U09 pages→목록/state/detail→SDK의 코드 소비 확인. Node24 production-reachability PASS(1152/1155 modules, 42 roots), unused-internal-exports PASS(2430 declarations). [실행·경로 증거](evidence/frontend-checks.json). 화면 종단/실제 원천 승격 완료 의미가 아님                           |
| source-size / unused-private / Java cycles / service-boundary | 4개 정적 검사 통과. 공통 담당의 typed signedWorkload 등록 후 Work 작업에서 service-boundary를 재실행해 exit 0 확인. [검사 기록](evidence/local-checks.json). 실제 권한·서비스 연결 완료 의미가 아님                                                                                       |
| 로컬 V226·직접 API 실행                                       | 백업·transaction rollback dry-run 뒤 V226 적용, Platform health 200, 런타임 OpenAPI 12 paths/13 operations. 신뢰된 tenant 1/user 900018 목록은 200·0건, 인증 없음은 401. 원천 미설정 CREATE probe는 502이며 배정·이력·영수증 0건 유지. [실행 증거](evidence/runtime-v226-activation.json) |
| 실제 서비스 간 연결                                           | **NO-GO.** Meeting receiver·후보 정본·현재 Auth action authority·People 대상자 적격성·원천 runtime 설정이 없다. CREATE/by-source/REASSIGN을 활성화하지 않음                                                                                                                               |
| 새 Work 화면·디자인·브라우저                                  | 미제작/미검증. 사용자가 디자인을 전달한 뒤 구현                                                                                                                                                                                                                                           |
| 배정 단독 검증 당시 전체 빌드                                 | 해당 snapshot은 전체 build 성공 판정을 제공하지 않았음. 원본 배정 증거를 후속 공통 전체 실행 결과로 덮어쓰지 않음                                                                                                                                                                         |
| 공통 후속 전체 단위·빌드                                      | [CLOSED / FROZEN 보고서](../../DWP-R1-CORE-006-product-surface-separation/11-2026-09-04-closeout.md): 385 files / 2,606 PASS, 전체 typecheck·ESLint·architecture·production build PASS. 초기 raw 1,050.5 KiB·gzip 306.8 KiB·요청 5개, 기존 예산 유지                                      |
| 운영·외부 출시                                                | 공통 readiness의 외부 출시 증적 37건 BLOCKED. 공통 빌드와 registry/U09 코드 도달성 통과는 현재 Meeting authority·target eligibility·receiver, 실제 Gateway·브라우저 E2E, 원천 승격의 완료가 아님                                                                                          |

## 남은 연결 조건과 담당

| 담당                     | 필요한 결과                                                                                                                                                   | 현재 판정                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 공통 Auth/People/Gateway | 차기 additive internal-only binding, 본문 action별 READ/CREATE/REASSIGN 식별, Meeting 전용 현재 권한 포트, 명시 followup capability/grant, target eligibility | 현 Gateway 전용 evaluate/HCM 판정 재사용 불가. 기존 v1~v4 무변경, 원천 승격 NO-GO                                                                                                                                                        |
| 공통 아키텍처            | 신규 Platform→Meeting internal-http 계약 및 검사 등록                                                                                                         | **정적 검사 통과.** 공통 담당이 typed signedWorkload(dwp1-hmac-sha256)로 protocol·client·서명 결속을 등록했고 Work 작업이 재실행 확인. 기존 token 인터페이스의 검증을 유지하며 운영 권한은 활성화하지 않음                               |
| Meeting                  | assertion/nonce 원자 검증, 현재 객체 ACL·retention·후보 확정·권한/적격성, 원본 복귀 ACL                                                                       | 승인된 현재 authority 경로 마련 전에는 fail closed                                                                                                                                                                                       |
| Meeting U09              | 현재 인증 사용자의 Work canonical SDK 실제 소비, 명령 영수증 복구, 기존 Work 수행과 비가용 후보 승격 구분                                                     | **SDK 2개 모듈의 production unreachable 해소.** 승인된 U09의 실제 nav/pages→목록/상세/수락·수행 소비 확인 후 독립 도달성·내부 export 검사 통과. SDK를 원래 위치에 유지. CREATE/REASSIGN 비활성 및 실제 Gateway/브라우저 종단 검증은 별도 |
| 공통 Gateway/generated   | 런타임 Platform OpenAPI를 정식 backend snapshot으로 export하고 frontend sync로 generated 계약 생성                                                            | Gateway wildcard route는 이미 존재하지만 정식 backend/frontend OpenAPI와 generated client에는 assignment path가 0개인 P0 차이. Work 소유 밖으로 인계했으며 직접 편집하지 않음                                                            |
| Work 화면                | 전달받은 디자인을 근거로 큐·상세·결과·모바일의 배정 업무 변형 연결                                                                                            | 디자인 대기                                                                                                                                                                                                                              |

공통 서비스 인터페이스 등록과 현재 Meeting 권한 포트는 서로 다른 게이트다. 정적 검사 통과만으로 실제 source 전환을 활성화하지 않는다. 로컬 Platform DB/API는 실행했지만 Meeting source 설정·비밀키·grant는 활성화하지 않았다. 다른 작업의 변경과 섞인 부분 commit을 만들지 않았다.

공통 마감은 해당 공유 작업 트리의 **CLOSED / FROZEN**이며 Work 기능 전체 완료나 immutable release attestation이 아니다. 기존 U09 배정 조회·수락/수행의 코드 소비는 확인됐지만 CREATE/by-source·REASSIGN은 현재 권한·대상자 적격성·수신부 연결 전 **NO-GO**다. Work 신규 시안·전용 화면 개발은 디자인 수령 뒤 이어간다. 공통 후속은 `build:products` 16종이나 backend 전체 check를 재실행한 증거도 아니다.

구체적인 보안·회귀 수용 기준은 [검증 매트릭스](verification-matrix.md), 서비스 간 인증 bytes와 공개 테스트 키는 [원천 프로토콜](source-protocol-v1.md) 및 [golden fixture](evidence/source-golden-v1.json)를 따른다.

## 파일 소유 범위

- Backend: `dwp-platform-server/src/main/java/com/dwp/services/platform/workhub/assignment/`의 DTO·controller·service·repository·source port·protocol·signer·HTTP adapter·body subscriber 9개와 같은 패키지의 테스트 5개, `V226__create_work_assignments.sql`, 테스트 golden fixture.
- Frontend: `libs/shared-utils/src/api/work-assignment-contracts.ts`, `work-assignment-api.ts`, `work-assignment-api.test.ts`. Work/Meeting UI 소비·공통 barrel·generated는 이번 SDK 변경에 포함하지 않는다.
- 문서: 이 `meeting-assignment/` 디렉터리. 기존 `design-ai/00~12`는 그대로 두고 추가 프롬프트로 전달한다.
- 현재 작업 디렉터리에는 다른 작업의 변경도 있다. 전체 git diff를 이번 업무 배정 변경으로 해석하거나 일괄 commit하지 않는다.
