# 승인 디자인 기반 메뉴 연결 — 2026-09-05 최종 재감사 지점

## 판정

**01–15의 desktop/mobile 30개 승인 프레임은 사용자 제공 export의 bitmap/HTML hash와 node 식별자 기준으로 모두 대조했고, 제품 안에서 재현 가능한 화면 구조와 핵심 사용자 수직을 연결했다. 외부 미디어·AI 공급망까지 포함한 운영 GO는 아니다.**

착수 전 신규 서버/화면 코드가 라우터·사이드바에 연결되지 않아 사용자에게 변화가 보이지 않았다. 실제 :4200 Chrome 화면에서 사용자 7개 메뉴, 관리 전용 3개 메뉴, 홈의 템플릿·개인실 진입을 확인했다. 이후 로컬 PostgreSQL은 Flyway V36, Meeting health/readiness/liveness는 HTTP 200/UP까지 확인했다. 디자인 판정은 Stitch 원본 30프레임, 구현 screenshot, 실제 런타임의 세 증거를 서로 바꿔 쓰지 않는다.

## 준비와 소유 경계

- 디자인·퍼블리싱: 30개 승인 프레임 직접 확인, 데스크톱/모바일 구조·상태·원본 모순과 최종 의도적 차이는 `07-approved-design-frame-register.md`와 `04-approved-home-design-correction.md`에 기록.
- 아키텍처·DB: 메뉴별 읽기/명령/저장/권한/보존 및 V26–V36의 실제 저장 계약을 `05-meeting-design-contract-matrix.md`와 `06-menu-implementation-readiness.md`에 구분.
- Work 담당: 배정·수락·진행 원장과 명령 receipt. Meeting은 회의 원본/검토/출처를 소유하며 두 서비스의 권한을 동일시하지 않는다.
- 공통 메뉴 담당: 사용자 메뉴 7개 + 관리 메뉴 3개, 전체 솔루션 메뉴 191개. 신규 메뉴는 W3 DRAFT로 연결하며 official v4 활성화/승격은 하지 않았다.
- 타 제품, 공통 Gateway·Vite·전역 생성기는 직접 편집하지 않았다. 공통 담당의 별도 변경과 공유 dirty tree는 보존했다.

## 실제 연결

| 영역          | 구현 경로와 행동                                                                                                                                                                      | 아직 제공하지 않는 범위                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 사용자 탐색   | 홈 / 코드 참여 / 내 회의 / 라이브러리 / 내 후속 업무 / 템플릿 / 설정; xs 사용자 화면의 홈/내 회의/라이브러리/후속 업무/설정 고정 탐색                                                 | immersive room·join·관리 문맥에는 고정 탐색을 중복하지 않음                                 |
| U03 예약      | 단건·반복 예약, 회차 preview, `THIS_ONLY`/`THIS_AND_FUTURE` 변경·취소, DST/월말 보정, durable receipt와 payload-free 통지 의도; tenant/user별 수동 초안 저장·복원·폐기·검토 후 commit | Calendar 가용성·외부 Notification 전달; silent autosave/localStorage는 사용하지 않음        |
| U04 준비      | 안건·참석 응답·현재 정책, host의 metadata-only 자료 등록, non-host redaction, 만료 fail-closed·보존 purge 증거, SELF-only 개인 준비 체크 → 장치 점검                                  | 신뢰 저장소의 원자료 ACL 재검증·열기/다운로드, 사전 대화; 타 사용자 준비 상태·집계는 미제공 |
| U06 회의실    | 실제 room의 참가자/채팅/손들기/반응/녹화 제어와 검증된 Q&A·투표·안건 timebox snapshot/명령; rail과 launcher가 같은 governed drawer를 열음                                             | 소회의실, 외부 LiveKit/TURN/recording 종단                                                  |
| U09 후속 업무 | Work 실제 목록/상세/수락/거절/시작/대기/완료/취소, 후보 projection/검토와 source persistence 경계, current-authority 부재의 fail-closed 표시                                          | 후보 CREATE용 current Auth authority, REASSIGN용 Auth + People eligibility                  |
| U10 템플릿    | 개인/조직 조회·개인 CRUD·복제·즐겨찾기·개정 확인 후 예약                                                                                                                              | 조직 관리 권한을 사용자 CRUD로 우회하지 않음                                                |
| U11 개인실    | 생성·이름·초대 revision 교체·현재 세션·초대 resolver                                                                                                                                  | QR 생성, 개인실 alias만으로 자동 입장, 자동 녹화/동의                                       |
| U12 설정      | 계정 기본값, tenant/user scoped 브라우저 장치 선호, 명시적 장치 테스트; U05와 room의 mic/camera/speaker/noise suppression 입력에 적용                                                 | 미지원 배경, 실제 알림 발송, OS/browser 실기기 종단                                         |
| 보고서 출처   | history의 meeting/report UUID로 해당 게시본만 조회                                                                                                                                    | 숫자 version의 과거 시점 조회, 접근 불가 원본을 최신 결과로 대체                            |
| 홈 리소스     | 실제 즐겨찾기 3개, 개인실·설정 진입, 템플릿 오류/빈 상태 분리                                                                                                                         | 예시 회의/업무 수치·가짜 안건 완료율·샘플 사용자 삽입                                       |

새 메뉴 route는 `/meetings/follow-ups`, `/meetings/templates`, `/meetings/preferences`이다. 예약/준비/개인실은 `/meetings/mine`의 명시적 `view` 문맥으로 연결한다. 사용자가 승인한 15개 화면을 15개 중복 sidebar 항목으로 만들지 않았다.

기존 `meeting-schedule-dialog.tsx`는 실제 새 예약 workspace로 교체하면서 제거했다. 기존 파일은 Git 이력으로 복구할 수 있고, 기존 예약 생성/초기값/멱등키 회귀는 새 예약 suite로 이전해 보존했다. 다른 사용자 파일이나 데이터는 삭제하지 않았다.

## 발견한 문제와 수정

1. 템플릿 적용은 제목/안건을 URL이나 임시 저장소로 전달하지 않는다. UUID/개정만 전달하고 현재 개정을 다시 조회한 뒤 사용자 검토를 거친다.
2. 다른 tenant/계정 전환, 403, 조회 경합 이후 이전 데이터가 복구되지 않도록 scope key·abort·generation fence를 사용한다. 로그아웃된 홈 리소스에는 재조회 버튼도 남기지 않는다.
3. Work version 증가와 Meeting 원본 ACL 판정은 서로 다른 순서 축이다. 늦은 업무 명령 응답이 최신의 출처 접근 거부를 되돌리지 못하게 별도 fence를 뒀다.
4. 지정 report ID의 403/404/410/503, 다른 meeting/report ID, 미게시/private/삭제 결과에서 최신 게시본을 대신 보여주지 않는다. 새로고침 중 이전 원문도 감춘다.
5. 모바일 템플릿 필터가 축소·겹치던 문제, 200% 확대 시 카메라 preview의 내재 최소 폭, 개인실 데스크톱 열 높이 간섭을 보정했다.
6. 결과 탭의 긴 영문 label이 37px 잘리던 문제를 content-width 가로 탐색으로 고쳤다. 게시 결과에 초안이라고 표시하던 문구를 실제 게시 상태에 맞췄다.
7. 공통 상태 컴포넌트·디자인 시스템 버튼·한영 사전을 재사용했다. 기준 상향으로 lint/크기 Gate를 통과시키지 않았다. 기존 예약 E2E는 독립 예약 suite로 옮겨 의미와 검증을 보존했다.
8. 모든 페이지에 gradient·과한 그림자·hover lift를 일괄 적용하던 시각 규칙을 flat paper, semantic border/selection 중심으로 정리했다. 미디어 룸의 떠 있는 반응/협업 패널처럼 몰입형 도구의 깊이를 설명하는 그림자만 의도적 예외로 남겼다.
9. 모바일 사용자 화면의 다섯 목적지는 390/320에서 fixed + safe-area로 유지하고 마지막 콘텐츠가 가려지지 않게 했다. room·join·준비·관리 문맥에는 두 번째 전역 탐색을 중복하지 않는다.
10. U05의 출력 speaker 선택과 짧은 test tone은 `setSinkId` 지원을 탐지해 실제 선택 장치에 적용하고, 미지원·권한 실패는 성공으로 위장하지 않고 시스템 기본 장치로 안전하게 복귀한다. 장치 label/ID는 서버에 원문 저장하지 않는다.
11. U06 rail의 과거 `미구성` 문구를 실제 governed facilitation snapshot과 연결된 진입 CTA로 교체했다. Q&A·투표·timebox가 실패하면 drawer도 503을 준비 상태로 바꾸지 않고 fail-closed로 유지한다.
12. U08 모바일 결과는 요약·의사결정·후속 조치를 먼저 읽고, 그 다음에 권한이 재검증되는 근거·재생으로 이어지게 재배치했다. 주제·분위기·질문·위험은 접근 가능한 disclosure로 제공해 핵심 결과를 밀어내지 않는다.
13. U13 모바일 운영 화면은 영향 지표와 readiness를 첫 viewport에 두고 예외 진단을 아래로 내렸다. U14 정책 화면은 변경 영향과 정책 그룹을 native disclosure로 정리하고 변경·오류가 있는 그룹만 자동으로 펼친다.
14. U01 홈과 U10 템플릿의 장식용 gradient/blob을 제거하고 단색 semantic accent와 정보 위계로 바꿨다. 밀도 검증은 1px 경계와 3px 상태 accent를 각각 검사하며 과한 card soup를 허용하지 않는다.
15. U03은 브라우저 임시 저장이 아니라 V36 tenant/user/version/idempotency에 결속한 수동 초안으로 저장·복원·폐기·preview·commit한다. source가 철회되면 본문을 되살리지 않고 discard-only로 전환한다.
16. U04 체크리스트는 안건 수명주기와 분리된 SELF-only 상태다. 다른 참가자의 상태나 aggregate/count를 노출하지 않고 version 충돌·철회 이후 late success를 차단한다.
17. U06 모바일 390/320은 회의 identity와 아이콘 행동을 두 행으로 분리하고, LiveKit 연결 상태 toast와 헤더가 DOMRect 기준 겹치지 않는 safe-zone을 고정했다.

## 회수한 검증

아래 수치는 중복되는 검증이 있으므로 합산하여 전체 고유 테스트 수라고 하지 않는다. 현재 디자인·전체 E2E는 독립 Node24.19/Yarn4.17 canonical server :4462–:4464에서 회수했으며, backend/Agent 수치는 루트의 최종 동일 통합 지점이다. `이전 checkpoint`는 역사 증거일 뿐 현재 수치로 사용하지 않는다.

| 검증                             | 결과/조건                                                                                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 승인 원본 불변성·30셀 추적       | 사용자 제공 ZIP SHA + 30개 bitmap/HTML SHA·raster·node·route·state·정확한 구현 path/크기/hash/랜드마크/clearance, 양 프로젝트 matrix **62/62 PASS**                                                      |
| 12개 전용 실제 D/M frame         | U01/U02/U05–U14 actual route/state의 desktop 1440 + mobile 390 strict **24/24 PASS**. 11개 scrollable mobile은 전체 문서, U06 D/M은 immersive viewport                                                   |
| U03/U04 실제 D/M·기능·경계       | 수동 예약 초안과 SELF-only 준비 체크를 포함한 소유 spec Chromium+mobile **54/54 PASS**                                                                                                                   |
| U15 실제 D/M frame               | canonical 1440 + 390 Korean/light/BLOCKED, 별도 390 English/dark/READY disclosure 보존. 전체 visual 묶음 **27 PASS / 3 project-scope skip / 0 fail**                                                     |
| 30 구현 frame 결론               | U01–U15 D/M **30/30** actual route/state golden; 28 FULL_DOCUMENT + U06 D/M 2 IMMERSIVE, distinct path/SHA/owner call, orphan·duplicate 0. 승인 bitmap과 구현 golden은 다른 증거 등급                    |
| 접근성/반응형                    | 1440/1280/768@200%/390/320, light/dark/forced-colors/reduced-motion, keyboard; 검증 범위 Axe serious/critical 0, horizontal overflow 0                                                                   |
| Frontend Meeting 단위 회귀       | 최신 공유 트리, Meeting feature **55 files / 527 PASS**, shared video API **13 files / 198 PASS**; 합계 **68 files / 725 PASS / 0 fail**                                                                 |
| Frontend 정적 Gate               | clean typecheck 오류 0, i18n, source-size **1,667 files**, maintenance-size **207 files**, design-system, architecture, full lint PASS; release approval evidence **0/37 BLOCKED**는 별도 운영 승인 Gate |
| Frontend Meeting 전체 E2E        | fresh canonical Yarn server :4464, Chromium+mobile **340 collected = 315 PASS / 25 의도적 project skip / 0 fail**, strict no-update, immutable Stitch ZIP 결속                                           |
| Frontend 최종 production Gate    | Node 24.19 전체 `yarn build`, Prettier, diff-check PASS. 기준 상향·실패 무시 없이 재실행                                                                                                                 |
| Backend Meeting 최종             | Flyway V36, **517 testcase = 516 PASS / 1 opt-in LiveKit skip / 0 fail·error**, 로컬 health/readiness/liveness HTTP 200/UP, service OpenAPI 87 paths                                                     |
| Agent 최종                       | 전체 **376 collected = 336 PASS / 40 environment-dependent skip / 0 fail**, Meeting target **60 PASS / 1 environment skip**, public OpenAPI snapshot 일치                                                |
| 정본 OpenAPI                     | Meeting **87 paths**, Gateway **797 paths**; backend/frontend snapshot sync·check PASS, internal ingress public 노출 없음                                                                                |
| 이전 frontend/backend 체크포인트 | 292 E2E, 689 unit, V35 491 backend test, 82/792 paths는 역사 증거다. 현재 수치와 합산하거나 최종 증거로 재사용하지 않음                                                                                  |

시각 E2E 서버는 canonical Yarn webServer 정책의 독립 :4464이며 격리 API fixture를 사용한다. 이 fixture와 별도로 로컬 제품 DB에는 `meeting-ui-demo-v1` 운영자 seed 회의 30건·참가자 170건·안건 90건·템플릿 12건·개인실 1건이 존재한다. 두 데이터 등급 모두 LiveKit browser media·TURN·STT·LLM·KMS·녹화 저장/외부 삭제 운영 연결의 증거가 아니다.

2026-09-05 최종 전체 E2E는 위의 개별 historical checkpoint를 대체하는 합산 실행이다. fresh Playwright-owned 서버에서 모든 `video-meeting*.spec.ts`를 Chromium과 mobile 프로젝트로 실행했으며, 25개 skip은 프로젝트·브라우저 조건을 명시한 의도적 분기다. V36 준비 fixture 정합으로 U06 desktop의 우측 rail이 `불러오는 중`에서 실제 검증된 `01 · 출시 결정`으로 바뀐 한 프레임만 expected/actual/diff를 육안 확인하고 명시적으로 갱신했다. 모바일 first-viewport-only 증적 11개는 전체 문서 golden으로 교체하고, U15-M은 D와 동일한 Korean/light/BLOCKED 조건으로 바로잡았다. 변경 bitmap 12개를 겹침·잘림·과도한 tail·fixed-nav 중복 관점에서 전수 육안검수한 뒤 전체 **340개**를 `--update-snapshots=none`으로 재실행해 기준 자동수용을 금지했다. `architecture:check` 자체는 exit 0이지만 release evidence는 schema/integrity 모드의 `BLOCKED, 0/37`이므로 외부 운영 GO로 해석하지 않는다.

최종 준비·자료 재생 브라우저 추가 회수: RSVP·안건 경합·철회·반응형 8건과 보존/재생 티켓 4건을 합쳐 **12/12 PASS**. 검증용 독립 서버와 별도 생성한 브라우저 탭은 각 실행 후 종료했다. 사용자 :4200·:8009는 그대로 유지했다.

### 이전 V29/V34 체크포인트와 현재 V36 상태

아래 5개는 V29 시점에 회수한 격리 clean-boot 증거로 보존한다. `dwp-meeting-server/src/test/java/com/dwp/services/meeting/support/MeetingApplicationContextPostgresTest.java`가 `@SpringBootTest(RANDOM_PORT)`·실제 PostgreSQL 16 Testcontainer·Flyway V29·실제 transaction proxy·HTTP 필터를 검증했다(5 PASS, skip 0). standalone controller fixture나 기존 :8009/DB를 사용하지 않는다.

- `cleanBootMigratesThroughV29AndWiresRealTransactionalServices`: 격리 DB, V26–V29 적용, pending/failed migration 0, 실제 4개 서비스 AOP proxy, health 200.
- `runtimeServiceOpenApiIncludesNewBindingsButHidesInternalIngress`: 서비스 OpenAPI **59 paths**, 신규 **15 paths / 25 operations**. 이전 12/22 숫자는 V29 준비 3경로를 제외한 값이므로 이 수치로 정정한다. 내부 ingestion 3경로는 runtime에만 존재하고 schema에는 나타나지 않는다.
- `trustedGatewayIdentityReadsDefaultsThroughRealFilterWithNoStore`: 실제 조회·no-store·미생성 개인실의 `status=SUCCESS, success=true, data 생략`을 고정한다.
- `actualHttpCommandsPersistWorkspaceAndReadV29PreparationWithoutMedia`: 템플릿/계정 선호/개인실/세션 실제 저장 → 준비 조회와 감사 outbox를 검증한다. 실제 미디어는 비활성이다.
- `realServiceBoundaryRejectsSpoofedHeadersAndUserAccessToAdminTemplates`: 서비스 토큰 없는 위조, 사용자 관리 접근, SUPPORT 혼동을 거부한다. 실제 public Gateway 통과 증거로 과장하지 않는다.

기동 검증에서 발견한 실제 응답 차이는 U11 adapter와 단위/브라우저 fixture에 반영했다. 성공 여부를 확인하지 않은 빈 JSON이나 오류 envelope를 미생성 개인실로 해석하지 않는다. 공통 `ApiResponse`와 다른 제품 계약은 변경하지 않았다.

Flyway **V34**, Meeting check **82 suites / 482 tests / 0 fail / 1 skip**, :8009 health **UP**, service OpenAPI **82 paths**와 회의 **42건 / 참가자 196건 / 템플릿 12건**은 당시 루트 통합에서 회수한 **V34 역사 체크포인트**다. V29의 59-path/15-path/25-operation 수치와 마찬가지로 최신 V36 수치로 재사용하지 않는다.

최신 로컬 검증은 Flyway **V36**, Meeting check **517 testcase = 516 PASS / 1 opt-in LiveKit skip / 0 fail·error**, health/readiness/liveness HTTP **200/UP**이다. chat 및 schedule-draft retention health는 마지막 성공, 실패 없음, overdue=false, active lease 없음으로 확인했다. 최신 `meeting-ui-demo-v1` 화면점검 seed는 회의 **30건**(SCHEDULED 16, ENDED 10, CANCELLED 2, DRAFT 1, LOBBY 1), 참가자 **170건**, 안건 **90건**, 템플릿 **12건**, 개인실 **1건**이다.

## 공유 런타임 반영 — 사용자 재기동 승인 이후

이 절의 PID·backup·59-path·8/22 수치는 V29 rollout 당시의 변경 이력이다. 최신 V36 검증과 혼합하지 않는다.

- Meeting만 정본 `devctl.start_service`로 재기동했다(관리 PID 80658 → 60129). 다른 제품 서버·Gateway·:4200 프런트는 계속 유지했다. 전체 재기동 허용을 전체 서비스 재기동 완료로 보고하지 않는다.
- 종료 후 기존 DB를 PostgreSQL custom-format으로 백업했다(194,535 bytes, TOC 289줄). 백업은 backend의 Git 제외 `.dev-runtime/meeting-rollout.sQWQug/dwp_meetings-before-v26.dump`에 600 권한으로 보존했다. DB 초기화·정리·사용자 데이터 삭제는 하지 않았다.
- 실제 `dwp_meetings`를 READ ONLY 트랜잭션으로 확인했다. V26–V29 성공/실패 0, 신규 13테이블·4함수·활성 트리거 4개, 기존 회의 8건/참가자 22건 보존, 준비 정보 8건/초대 응답 22건을 확인했다.
- 실제 :8009 health 200/UP, OpenAPI 59 paths, 신규 15 paths/25 operations, 내부 path 노출 0이다.
- 정본 `export-openapi-contracts.py --service meeting --write` 및 `--check` PASS. 현재 다른 서비스 snapshot으로 합성한 Gateway와 기존 working Gateway의 완전 일치를 먼저 확인하고 백업했다. export 전후 변경된 backend 계약은 `meeting.json`, `gateway-public.json` 두 개뿐이다. 다른 서비스와 타 작업의 platform 변경은 그대로 보존했다.
- Gateway 정본 757 paths를 프런트의 JSON/TypeScript 두 생성물에 직접 sync하고 generated `--check` PASS를 확인했다. Agent 계약과 immutable 권한 bundle은 변경하지 않았다.
- 실제 로그인 :4200 브라우저에서 7개 사용자 메뉴, 홈 리소스, 템플릿 정상 빈 목록, 계정 설정 버전 0, 미생성 개인실, 기존 회의 준비/안건 버전/참석 응답의 정상 조회를 확인했다. API fixture나 가짜 운영 데이터를 사용하지 않았다. 사용자 선호·회의실을 검증용으로 생성/변경하지 않았으므로 실제 공유 환경 CRUD 완료라고 확대하지 않는다.
- 생성 계약 반영 후 Node24 전체 `corepack yarn typecheck --incremental false`는 오류 0으로 통과했다. backend 생성 계약과 frontend 대상 생성물/문서의 diff-check도 통과했다. 이전 테스트 수치를 이번 재기동에서 모두 재실행한 것으로 표시하지 않는다.
- 전체 `corepack yarn architecture:check`도 exit 0이다. source-size 1,554 production files 및 maintenance 182 files PASS. 이 명령의 release readiness 출력은 schema/integrity 모드의 **BLOCKED, 0/37 release evidence**이며 운영 GO로 해석하지 않는다. 별도 Chrome 검증 탭은 종료했고 실제 서비스는 실행 상태로 유지했다.
- 위 V29 rollout 뒤 V34에서 Flyway V34, :8009 health UP, OpenAPI 82 paths, 회의 42건/참가자 196건/템플릿 12건 보존을 READ ONLY로 확인했다. 이는 역사 증거다. V30부터 실제 public Gateway 왕복으로 확인한 WEEKLY 4회 생성/replay, THIS_ONLY 변경, 단일 회차 취소/replay, host 자료 metadata version 0→1/replay 증거는 보존하되 현재 seed 수와 혼합하지 않는다. 통지 outbox의 payload-free `PENDING`은 외부 dispatcher 성공으로 과장하지 않는다.

## 승인 15화면 완성도 최종 재감사

30개 승인 원본의 확인과 30개 구현 화면의 픽셀 복제 판정은 다르다. 아래는 node ID별 desktop/mobile 구현을 최신 기능 snapshot에 다시 대조한 결과다. `구조 합격`은 원본 정보 위계와 행동을 보존했다는 뜻이며 외부 인프라 운영 GO는 아니다.

| 화면              | 최신 구현 판정                                                                                                                           | 의도적 차이 / 남은 Gate                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 01 홈             | 8:4 타임라인/대기열·7:5 결과/도구·공통 gutter·390/320 fixed 5-nav 구조 합격                                                              | 가상 아바타·안건 완료율·보안 등급은 실제 projection 전까지 미표시                |
| 02 내 회의        | 검색/시간/역할 필터·2:1 목록/inspector·예약 변경/취소 workspace 연결 구조 합격                                                           | 가짜 준비율은 만들지 않음                                                        |
| 03 예약·변경      | 단건/반복·회차, THIS_ONLY/THIS_AND_FUTURE 변경/취소, DST/월말, impact/receipt, 수동 초안 저장·복원·폐기·commit 구조 합격                 | Calendar 가용성·외부 Notification 전달 NO-GO; silent autosave 미제공             |
| 04 준비           | 안건·RSVP·host metadata 자료·non-host redaction·expiry purge·SELF-only 개인 준비 체크·입장 흐름 구조 합격                                | 공급자 ACL/open·사전 대화 NO-GO; 타 사용자 준비 집계 미제공                      |
| 05 장치·대기      | private preview:보안 rail, 계정/브라우저 선호→실제 choices, speaker/test tone, mobile sticky 입장 구조 합격                              | OS 장치·LiveKit 종단 운영 Gate                                                   |
| 06 회의실         | 미디어 무대·참가자/채팅·손들기·반응·녹화 제어, Q&A·투표·안건 timebox, mobile drawer/overflow, 390/320 2행 헤더·toast safe-zone 구조 합격 | 소회의실 및 LiveKit/TURN/recording 종단 NO-GO                                    |
| 07 라이브러리     | history 7:5 목록/preview·bounded search/evidence filter·mobile actionable list 구조 합격                                                 | 전사 본문 검색·공유받음·즐겨찾기 source 계약 대기                                |
| 08 결과·AI 검토   | evidence 7:5·연속 결과 문서·검토/게시·bounded 전사 segment/search·ephemeral 재생/citation seek 구조 합격                                 | 원문/locator 비저장; 접근 티켓은 매 페이지 재검증                                |
| 09 후속 업무      | Work 목록/inspector·6개 명령·receipt 복구, 후보 projection/검토·signed source/JTI 경계와 미검증 CTA 차단 합격                            | CREATE는 current Auth authority, REASSIGN은 Auth + People eligibility까지 NO-GO  |
| 10 템플릿         | 개인 CRUD·조직 조회·복제/즐겨찾기·예약, desktop/mobile 구조 합격                                                                         | 조직 관리를 사용자 CRUD로 우회하지 않음                                          |
| 11 개인실         | 생성/이름·초대 revision·현재 세션/이력/resolver 구조 합격                                                                                | QR·alias 자동 입장·자동 녹화/동의 미제공                                         |
| 12 내 설정        | 계정 기본값·tenant/user scoped 장치 선호·명시적 점검→prejoin/room 입력/출력 적용 구조 합격                                               | 알림 전달·배경·실기기 종단 Gate                                                  |
| 13 운영 관리      | 운영 영향·공급자 상태·예외 큐:진단 inspector 구조 합격                                                                                   | 고위험 조작은 추가 인증·receipt 없이는 차단                                      |
| 14 정책 관리      | 정책 그룹·적용 상태·변경 영향/이력 rail 구조 합격                                                                                        | 저장 암호화와 E2EE를 구분; 외부 집행 readiness Gate                              |
| 15 AI·데이터 관리 | 7단계 pipeline·사용자 기능·의존성·사람 검토/게시·보존/삭제 증거, 1440 7열/390 순차 구조 합격                                             | 승인 원본보다 긴 fail-closed 근거를 의도적으로 보존; KMS/STT/LLM/recording NO-GO |

현재 `meeting-room-experience.tsx`는 계정 mic/camera/display-name 기본값과 tenant·user에 결속한 브라우저 장치 선호를 합성해 `meeting-prejoin.tsx`에 전달한다. 사용자가 제출한 동일 choices를 실제 room에 전달하고 speaker device/noise suppression도 room 연결에 적용한다. 계정 전환 시 장치 key가 분리되며, 이 기본값은 조직 정책·콘텐츠 고지·사용자 명시 선택을 우회하지 않는다.

## 남은 외부 운영 Gate

1. V30의 반복 일정/회차/변경/취소와 자료 metadata·보존 worker, V31–V35의 source/AI/transcript/facilitation/chat retention, V36의 수동 예약 초안·SELF 준비 체크 경계는 구현했다. 남은 외부 Calendar 가용성, Notification dispatcher, trusted material ACL adapter는 별도 운영 수직으로 연결한다.
2. U12 선호→U05/room 소비, 계정 전환·late response fence와 stale speaker fallback은 연결했다. 실제 장치·OS/browser permission·LiveKit 종단은 운영 환경 Gate로 유지한다.
3. 30개 승인 프레임의 구조 대조와 현재 visual regression은 `07-approved-design-frame-register.md`에 고정한다. 구현 screenshot을 Stitch 승인 원본으로 바꾸지 않는다.
4. 후보 persistence/검토·signed source 경계는 존재하지만 production current Auth authority adapter가 없어 CREATE를 `AUTHORITY_UNVERIFIED`로 차단한다. REASSIGN은 여기에 People의 현재 tenant membership/assignability 경계까지 연결된 뒤에만 활성화한다.
5. V35 chat plaintext 및 V36 만료 schedule draft 파기·CAS lease/fence·heartbeat/backlog readiness와 content-free evidence/audit 원자성은 로컬 PostgreSQL에서 검증했다. LiveKit control-plane smoke도 확인했지만 실제 browser media·TURN·recording Egress/저장·KMS·STT·LLM·외부 삭제/crypto-shred 종단 증거가 없으면 관련 운영 NO-GO를 유지한다. 얼굴/음성으로 개인 감정이나 직원 점수를 추정하는 기능은 구현 범위가 아니다.
6. report·chat·recording·transcript·준비 자료의 개별 보존 경계와 파기 증거는 구현됐지만, 전체 회의 메타데이터를 최종 삭제하는 worker와 legal-hold 관리자 workflow는 의도적으로 활성화하지 않았다. 외부 object 삭제 완료와 법적 보존 판정을 먼저 결속하지 않은 채 parent meeting을 cascade 삭제하면 증거 불일치가 생기므로 `MEETING_RECORD_RETENTION_WORKER_NOT_CONFIGURED`와 `LEGAL_HOLD_ADMIN_WORKFLOW_NOT_CONFIGURED`를 운영 NO-GO로 유지한다.

제품 내부에서 재현 가능한 30프레임 구조와 이번 범위의 핵심 수직은 닫았다. 외부 공급자 증거가 필요한 기능은 화면이 존재하더라도 운영 완료로 보고하지 않는다. 이 문서는 구현 완료 범위와 운영 NO-GO를 함께 고정하는 인계 지점이다.
