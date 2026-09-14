# 19. 전체 요구사항 복구 및 완료 기준

- 기준일: 2026-09-14
- 범위: 전자결재 APR-01~~04 → APR-05~~10 → APR-11~16
- 상태: `IN_PROGRESS`, 전체 완료 아님
- 부분 UI·mock·소스별 통과를 전체 구현 완료로 보고하지 않는다.
- 시각 원본: Google Stitch 프로젝트 13391261371843159731의 승인된 화면과 상태 변형
- 최초 요구: 원본의 세련된 시각 계층을 DWP에 적용하고 필요한 신규 내부 기능까지 개발한다.
  기존 API가 없다는 사실은 신규 개발의 시작점이지 자동 제외 근거가 아니다.

## 완료 원칙

각 항목은 원본 프레임, 실제 코드, API/DB/권한, 실행 검증을 연결해야 완료할 수 있다.
메뉴 존재, mock 성공, 이전 snapshot 테스트 통과만으로 완료 처리하지 않는다.
원본의 fixture와 handoff 주석은 운영 사실이나 제품 내 설명문으로 복제하지 않는다.
홈은 홈으로 유지하며 4개 큐는 결재함 아래 접이식 sidebar에만 둔다.
기존 React/MUI/router, DWP Design System, owner PEP와 tenant 격리를 유지한다.
새 public API는 owner-service → Gateway OpenAPI → generated type → exact route/PEP를 함께 검증한다.

## 요구사항 원장

| 범위    | 반드시 대조/구현할 항목                                                                                                        | 현재 상태                                                                                                            | 완료 근거                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| APR-01  | 인사/작성 행동, 시각 기반 briefing, 4개 compact 지표, 우선 결재, 내 기안 추적, 단계 흐름, quick actions, navigator, 최근 활동  | 홈·결재함 58개 회귀 및 모바일 2×2·시간 단위 재보정 후 publishing 24개 회귀 통과                                      | desktop/mobile 원본 대비 캡처 + 실제 data/클릭 여정       |
| APR-02  | sidebar 큐 toggle, list/detail 선택, 서버 검색/필터/정렬/page, batch 선택/항목 결과/안전한 재확인                              | 서버 검색/page 및 quorum 요청 버전·회차·결재선·문서 핀 변경 차단 browser 26개 회귀 통과                              | 100건 초과 검색/page, 권한 회수/부분 결과 E2E             |
| APR-03  | 문서/metadata/검토 근거/결재선/timeline, sticky 결정, 댓글, 첨부/증빙 읽기, copy/print/history                                 | 문서 browser 32개 및 첨부 server 258개 통과; 첨부 v9 실제 owner filter 연결과 통합 실행 검증 진행 중                 | 실제 owner API, immutable evidence, 원본/negative 여정    |
| APR-04  | 모바일 목록→상세→결정→복귀, batch, IME/키보드/focus, 예외 상태                                                                 | 기존 모바일 여정 회귀 통과, 신규 문서 도구와 quorum 여정 추가 검증 필요                                              | 390/320/200%, dark/forced-colors/reduced-motion           |
| APR-05  | 게시 양식 선택, 동적 field, 부분 초안, route preview, 첨부 업로드/취소/검사/권한                                               | 실제 storage/AV 및 prepare/seal helper PG 29개 통과; 기존 저장/복원/상신의 실제 hook 결속 진행 중                    | 실제 저장/검사/스캔 전 접근 차단                          |
| APR-06  | 동일 server/client validation, 상신 전 payload/route/policy/evidence, 결과불명 재확인                                          | typed/USER 검증·원본 명령 키·UNKNOWN fencing 구현, 병렬 보완 회차 미완료                                             | 403/409/503, stale source, 중복 상신 0                    |
| APR-07  | debounce autosave, 단일 저장, stable command key, receipt replay/reconcile, revision history/diff/recover, soft delete/restore | V17 및 frontend 구현·실제 PG/브라우저 회귀 통과, 최종 통합 재검증 필요                                               | PG concurrent replay/tenant/actor/version + close/409 E2E |
| APR-08  | 내 요청 검색/page, 보완/철회 상태별 행동, revision 기반 추적                                                                   | 검색/기존 보완·철회 구현·사용자 여정 통과, typed 병렬 보완 회차 미완료                                               | owner-only 검색 및 immutable 보완 회귀                    |
| APR-09  | 내 완료 결정/내 요청 보관 구분, 검색/page, 안전한 export/download, 보존 상태                                                   | scoped export/댓글/인쇄 v8 실제 browser 20개 통과; record-wide 보존/삭제 worker 미완료                               | scoped export와 audit, 접근 회수                          |
| APR-10  | 대결 대상/기간/scope, outgoing/incoming, revoke, representative evidence                                                       | 기존 계약 기반 구현·desktop/mobile 회귀 통과, 최종 통합 재검증 필요                                                  | 최신 권한/위임 만료/confused deputy 회귀                  |
| APR-11  | exception-first overview, generatedAt/stale/partial, persona별 실제 CTA                                                        | 관리 화면 보정·기존 여정 통과, 신규 정책/HIGH 실제 v8 연결 검증 대기                                                 | 부분 소스 실패 보존 + 권한별 write 차단                   |
| APR-12  | category disclosure/tree keyboard, filters/sort/metadata, mobile drill-in, version/publish                                     | V23 workspace/lifecycle 및 양식 372개 통과; v9 정본 봉인/동기화 완료, 신규 5개 명령 browser 실행 검증 진행 중        | tree keyboard/focus, independent publish, partial source  |
| APR-13  | field canvas/inspector, locale/device preview, issue→field, validation parity, advanced typed fields                           | typed AST·조건/계산/반복/USER 구현, Forms 216개 회귀 통과·USER 화면 검증, 신규 v8 및 실제 운영 source 연결 검증 대기 | 동일 AST 검증/참조 cycle/immutable schema hash            |
| APR-14  | stage 편집/복제/mobile, routing 조건, parallel/quorum, readonly simulation                                                     | 동일 typed AST·4개 quorum·DAG/조건 편집 연결, Workflow 123개 회귀 통과; 실제 ROLE source·simulation·보완 UI 진행 중  | 후보 snapshot, stage CAS, quorum/concurrent decisions     |
| APR-15  | semantic current/proposed/history, 영향 미리보기, durable SLA escalation                                                       | 영향 API/UI 및 원본 대조 통과; SLA 원본 증거 V30와 native/Auth 통합 최종 검증 중                                     | independent publish, timer dedup/fenced outbox            |
| APR-16A | 운영 목록/상세/attempt, retry/deadletter/reassign/bulk/reconcile, hold/retention/export                                        | 탭형 큐·우측 상세·최신 권한 retry 구현; 신규 7개 delivery/2개 task API와 보존 실행 연결 미완료                       | sealed eligibility, item ledger, dual control/fencing     |
| APR-16B | 공급자 capability/config/probe 구분, 실제 서명 ceremony와 proof, 외부 gate                                                     | 내부 서명 ceremony UI/실제 RSA 검증 연결; 외부 공급자 연동과 KMS/WORM의 내부 코드·운영 조건을 별도 재감사 중         | 서명 provenance 및 실제 provider 검증, 외부 승인 별도     |

## 진행 소유

- Root: 전체 원본 대조, APR-01~04, 공통 API adapter/i18n/정본 동기화, 통합 검증.
- Backend 전문가: V17 초안 저장 결과 기록/이력/복원/휴지통/서버 검색. 다른 migration 예약과 분리.
- 사용자 여정 전문가: APR-05~10 autosave/recovery/lifecycle, 전용 unit/E2E.
- 관리/설계 전문가: APR-11~16 원본 대조와 기존 계약 기반 UI 결함 보정.
- 타 제품의 기존 dirty 변경은 보존하며 partial commit/push, 임의 DB reset을 수행하지 않는다.

## 현재 내부 차단 및 다음 단계

- 문서 정책 변경/게시의 대상은 신규 `policies/{policyId}/draft|publish` 경로로 고정한다.
  URL의 정책 UUID가 현재 tenant/management resource set의 DB 정책과 같아야 한다.
  미배포 no-ID 경로를 호환 별칭으로 남기지 않는다. v8을 이 보정 이전 경로로 봉인하지 않는다.
- Auth HIGH resolver의 지원 버전이 과거 v2/v3만 허용하는 누락은 내부 결함이다.
  실제 신뢰 정본과 활성 pointer 검증을 유지하면서 최신 v7/v8의 실제 발급 경로를 회귀한다.
- V21은 첨부, V22는 병렬 결재 보완 회차, V23은 양식 버전/workspace/lifecycle에 예약했다.
  아직 생성·검증하지 않은 migration을 실행 완료나 immutable 증거로 기록하지 않는다.
- 게시 양식의 편집은 별도 draft pointer를 사용하며 게시 양식을 신규 기안에서 계속 사용할 수 있어야 한다.
  catalog retire는 신규 시작만 제한하고 기존 pinned 요청의 현재 권한 재검증을 생략하지 않는다.
- `REQUEST_INFO`를 기존 순차 결재로 우회하지 않는다. 과거 회차의 투표·후보·위임·payload 증거를
  보존하되 새 보완 회차의 승인 수로 재사용하지 않고, 오래된 worker/결정은 변경 0으로 거절한다.
- 이전 Forms 전체 snapshot의 502개 중 3개 실패는 원인별 보정했다. 두 mutation-count 회귀는
  추가된 read와 실제 mutation을 분리해 원래 1/7 기대를 유지한 19개 target이 통과했고,
  Workflow publish 0-row CAS는 scope별 실제 PostgreSQL 8개 회귀로 409/변경 0을 고정했다.
  이 target 수치를 모든 신규 source를 포함한 Approval 전체 회귀로 재사용하지 않는다.
- scoped 테스트 통과와 원본 비교 캡처는 각 증적의 snapshot에만 유효하다.
  신규 문서 API/정본 및 후속 기능을 연결한 뒤 전체 unit/build/PG/browser/runtime Gate를 새로 실행한다.

## 원본 및 검증 증적

- APR-01 desktop 원본 HTML/PNG/DESIGN.md: workspace output/approval-stitch-2026-09-14/APR-01-desktop.
- 추가 원본 ZIP은 Stitch UI의 16-screen export 제한에 맞춰 묶음별로 확보한다.
- 2026-09-11 테스트 수치는 이전 범위의 이력이며 재개 코드의 최신 검증으로 재사용하지 않는다.
- 전체 완료 보고 전에는 모든 원장 행의 미완료를 구현 또는 명시적인 실제 외부 조건으로
  판정해야 한다. 내부 기능 미구현을 외부 조건으로 이동하지 않는다.

## 연결 검증 이력

- V20 corrected OpenAPI raw SHA-256: `40660fdc1baf9d8482ef8448d8ed378468f84213b1b5cd98b8e3fe6c0b16242d`.
  실제 fresh boot의 Approval 60 paths/67 methods/153 schemas로부터 Gateway 835 public paths를
  공식 compose/export하고 frontend generated types를 동기화했다. no-ID 정책 쓰기 경로는 없다.
- v8 immutable authorization checksum: `9449a516a2dbd96106e71963cbda764b80d83f0f61fa861d110d85517adac942`.
  275 routes(79 PAGE/58 DATA/138 ACTION), frontend 정본 및 공식 fixture v1-v8 동기화 통과.
  기존 v1-v7 artifact/checksum은 보존했다. 실제 fresh Auth의 v7/v8 Doc HIGH 발급 검증과
  admin SourceVIEW 결합 회귀가 통과했다. SourceVIEW helper 포함 Auth 551개 회귀, V212의
  FORM resource 등록 추가 후 fresh 115 migrations/Auth 555개 회귀가 통과했다. 등록은 권한
  부여나 ROLE runtime activation 증거가 아니며 기존 disabled/retired와 grant 수를 보존했다.
- API/전역 ACTION exact 및 HIGH 본문 version 결속 target 94개 통과. 신규 문서 9개 mutation은
  실제 AST call edge마다 동일 execution 전달을 검증한다. Doc 게시는 COMMAND_BODY 바인딩이며
  불필요한 expected-object-version 헤더를 제거하고 본문/서명/명령 키 일치 검증을 유지했다.
- 최신 frontend build는 architecture/API/권한/정본/도달성/미사용 export/DS/i18n/display/lint/
  TypeScript/Vite/bundle Gate를 통과했다. initial raw 1052.2/1074.2 KiB, gzip 305.6/317.4 KiB,
  4/5 requests다. 이 빌드 이후 API9 보완 회차 연결은 최종 재검증 대상이다.
- 옛 Workflow hook 경로를 읽던 source-contract를 실제 controller 검사로 수정한 뒤 full
  frontend unit 615 files/5154 tests가 통과했다. 이 후 정책 원본 fencing·API9·양식 workspace
  adapter가 추가됐으므로 전체 fresh 재실행이 남아 있다. 최신 비증분 TypeScript는 통과했다.
- V21의 strict dependency verification 추가 14 artifacts는 공식 Maven Central 배포본 SHA-256/
  published checksum과 대조했다. 실제 Clam 최신 signature 양성/악성 2개와 S3 3개,
  passive parser 8개, manifest/scan/intake/download PG 및 endpoint/input을 포함한 첨부 53개가
  통과했다. 36-file source manifest는 c283f041d6c8585b84517f4cafa0c2899c1470a66dff0b5900621230dd416302다.
  public exact PEP·prepare/seal·전체 사용자 여정 연결은 별도로 남아 있다.
- V23 Forms/workspace/legacy 관리 우회와 최초 채택의 경합을 보정한 coherent snapshot에서
  31 suites/356 tests가 통과했다. 새 정책 V25 이후의 전체 Forms 실행 근거로 재사용하지 않는다.
  게시본과 작업 초안을 분리하는 frontend adapter 19개도 통과했다. 카탈로그의 여섯 UI leaf와
  최소 Studio 연결, 원본 버전의 branch·history·diff·검토 게시·retire/reinstate는 구현했다.
  해당 UI target 37개 및 WaveC 223개가 통과했고, 현재 v8의 새 계약 부재를 표시하는 실제
  browser 6개도 통과했다. v9 설치 후 실제 변경·게시 browser를 검증하기 전에는 공개 기능을
  완료로 판정하지 않는다. unit의 명시적 binding fixture는 운영 설치 근거가 아니다.
- Task 실제 댓글/UTF-8 파일 bytes·SHA·다운로드/인쇄·UNKNOWN 원래 키 재시도 browser 12개,
  Request/Archive 실제 문서 여정 20개가 통과했다. Doc 도구의 기본 비활성은 운영 activation 증거가 아니다.
- 정책 제안 원본을 고정하는 실제 browser 8개, 정책 모델 및 전송 전/CSRF 후 source guard를
  포함한 target 92개가 통과했다. 편집 도중 바뀐 제안에 입력·검토를 자동 적용하지 않는다.
  Toast의 실제 DOM/light/dark/high-contrast 색 대비 13개도 통과했으며 visible Toast browser
  16개는 Axe 예외 없이 검증했다. 정책 영향·durable SLA·운영 명령은 아직 미완료다.
- API9 보완 회차와 USER 참조의 만료·재검증, 원래 명령과 자료 보존을 함께 보정한 target은
  20 files/173 tests 및 실제 Chromium 23/mobile 23, 합계 browser 46개가 통과했다.
  사용자 참조의 UUID 교체·403·503은 기존 제출을 치유하지 않으며 원래 UUID만 명시적으로
  다시 확인할 수 있다. 뒤에 추가한 picker portal의 이름 있는 region 보정은 별도 companion으로
  검증한다. desktop/mobile published USER 여정 두 개가 해당 보정 후 새로 통과했다.
- 이전 735-test 전체 Approval snapshot의 21개 실패는 최신 완료 근거가 아니다. 당시 Doc18
  classpath에 v8 registry/helper/bundle/PEP resource가 누락됐다. 실제 최신 source를 함께 복사한
  unchanged Doc18 18개와 Workflow159/게시 route15, 합계192개가 통과했다. 전체 coherent check는 남아 있다.
- 최신 Workflow·문서·보완 소스·transport와 정책 정수 회귀의 coherent 전체 실행은
  21 suites/224 tests, failure/error/skip 0으로 통과했다.
  Approval 실제 issuer/client → Auth의 실제 HTTP·fresh PostgreSQL 115 migrations·Redis 연결
  별도 테스트도 통과했고 네 개 권한 회수/재사용 거절의 정확한 FORBIDDEN을 고정했다.
  이 first-leg는 설치된 Approval PEP·DB 실행 전체의 활성화 근거가 아니다.
- Auth의 해당 Workflow runtime 구현은 132 suites/581 tests, failure/error/skip 0으로 통과했다.
  실제 기본 HTTP 서버의 64단계/현재 구성원 1,000명 경로를 포함한다. 이후 새 PolicyImpact
  package의 검증 근거로 이 수치를 재사용하지 않는다. 기존 ROLE 20-file 정본은 유지했다.
- V25는 실제 root 정책에 누락된 기준 이력만 capture 시점으로 기록하며 과거 검토자·게시자·
  시각을 만들어 내지 않는다. 기존 버전은 UNKNOWN provenance로 유지하고 원래 자료를 바꾸지
  않는다. 미래 tenant 초기화도 동일 경로로 기록하며 read-time provisioning은 하지 않는다.
  정책 영향 및 V25 actual PG target 6 suites/33 tests가 통과했다. 실제 최신 세 관리 권한을
  검증하는 별도 Auth/Approval 연결과 public owner DATA route는 여전히 내부 구현 중이다.
- 첨부 중앙 adapter의 최신 target은 18개다. 서버가 지원하지 않는 CSV를 제거하고 실제
  지원하는 PPTX를 허용 형식에 결속했다. 관리자 정책은 원래 자료를 private snapshot으로
  유지하는 조회/변경/게시 adapter 8개와 별도 HIGH command 3개가 통과했다.
  공개 정책 DTO의 pending maker/revision/hash와 제공자별 readiness를 서버에서 검증하는
  companion 및 실제 사용자·관리자 UI 연결은 진행 중이다. 게시 본문 CAS와 원래 key를 유지한다.
- V24의 actual PostgreSQL 권한 경계와 실제 버전별 S3 삭제를 포함한 coherent target은
  retention 35 + attachment 53 + unchanged Doc 18 + Draft/Search 51, 합계 157개가 통과했다.
  열 개 기존 trigger 함수는 DELETE의 검증된 전용 실행만 좁게 허용하고 그 외 기존 함수 본문은
  보존했다. 테스트의 private schema 정리는 disposable PostgreSQL fixture에만 적용한다.
  관리 보존 정책, 전체 record linkage, 전달된 Audit/Notification 사본 처리 및 실제 운영 worker
  활성화는 내부 잔여이며 외부 조건으로 제외하지 않는다.
- 완료된 보완 명령의 durable 재확인에는 원래 실제 검증의 causal stamp가 필요하다.
  V26은 이 신규 immutable admission ledger에만 예약했다. 과거 명령에 검증 이력을 소급하여
  만들지 않으며, 오래된 증적과 최신 권한을 별도로 검증한다. 아직 실행 완료로 기록하지 않는다.
- 최신 전체 frontend 첫 실행은 620 files/5,243 tests 중 5,241 pass/2 fail이었다. 두 소유 범위가
  원인을 보정하고 해당 target을 다시 통과시켰지만, 전체 fresh 재실행을 통과한 것으로 바꾸지
  않는다. shared tree의 중간 compile 상태도 별도 확인하며 최종 동결 후 전체 재실행한다.
- 위 각 검증은 해당 coherent source snapshot의 근거다. API9 및 전체 내부 기능의 최종 통합,
  새 fresh boot, 실제 사용자·관리자 여정과 모든 원본 프레임 대조 전에는 전체 완료로 봉인하지 않는다.

## 2026-09-14 재개 후 현재 지점

전체 상태는 계속 `IN_PROGRESS`다. 위 원장의 미완료 표시는 최종 공개 연결과 사용자 여정까지의 완료 기준이며,
아래 개별 구현의 통과 수치를 전체 완료로 대신하지 않는다. 아래 수치는 각각 기록된 source snapshot에만 유효하다.

- Forms: 실제 Spring JSON 입력의 알 수 없는 필드가 무시되는 결함을 RED로 재현했다.
  신규 5개 입력 DTO와 중첩 metadata만 엄격하게 거절하고 기존 DTO/Map 의미는 유지했다.
  전용 18개 및 전체 Forms 35 suites/372 tests가 failure/error/skip 0으로 통과했다.
- 홈: 원본과 현재 화면을 직접 대조하고 홈에만 executive 표면을 적용했다.
  과도한 그림자와 경계를 정리하고 신속 실행 버튼을 개별 경계와 간격으로 구분했다.
  desktop/mobile publishing 24개가 통과했으며 dark/320px/200%/forced-colors/Axe와 실제 캡처를 확인했다.
- 첨부: 실제 CA Clam/S3, 보존, 문서, NEEDS_INFO 요청 상태 및 조회 write 0을 포함한
  최종 23 suites/258 tests가 failure/error/skip 0으로 통과했다. 첫 설정은 명시적 POST이며
  실제 PG의 absence CAS/current authority/concurrency를 포함한 최초 설정 20개도 통과했다.
  최초 설정 API 및 UI/CSRF 대상 40개가 통과했으며 조회로 자동 생성하지 않는다.
- 실제 owner API: 처음 추출한 export의 양식 Diff 이름 충돌을 보정했다.
  최종 실제 export SHA `681496d78a457e63af9f38a0fb6ede092589fa17020a2e4a4f40af3fe0937f13`는
  85 public paths/94 methods/203 schemas다. 새 27개 계약의 JSON 기록 11개 및 raw binary 1개의
  응답을 직접 추출했고, 24개 실제 component와 binary 응답을 별도로 해시 검증했다.
  최초 설정을 포함한 official Approval-only export와 Gateway 900 public paths compose 및
  frontend generated API sync를 완료했다. 원본 source와 isolated capture의 drift는 0이다.
- v9 정본은 checksum `02b19c4119e560b63d4054ec317fe7e4d694e402a5af03960c63b20db4b41ab7`로
  봉인했으며 302 routes/127 capabilities/22 access policies/16 expressions/41 predicates다.
  Approval owner PEP는 91 routes/99 bindings, checksum
  `42eed3ca14abd7fcd5b62f2f3714dd8b62aabaab9b07348cadd33ace829b02bf`다.
  Auth seed는 계속 `DRAFT`이며 정본 봉인은 운영 활성화나 권한 부여가 아니다.
  official frontend authorization/fixtures sync와 v1-v8 byte/checksum 보존 검증을 완료했다.
  actual owner OpenAPI와 27개 method/path, 12개 응답 그래프, HIGH header 결속을 검증하는
  Python 19개 및 Approval registry 4개가 통과했다. 실제 signed 양방향 통신과 public 실행은 별도다.
- Auth: 원래 검증된 581개와 신규 receipt replay/helper/default HTTP를 포함한
  140 suites/628 tests가 통과했다. 별도 PolicyImpact/helper 대상 8 suites/46 tests도 통과했다.
  이 둘을 단순 합산한 수치를 전체 최신 Auth 통과로 보고하지 않는다.
  실제 v8 DB descriptor를 full checksum으로 검증한 후 v9 부재를 503으로 거절한 증거이며,
  아직 실제 설치된 v9 positive 경로의 완료 근거는 아니다.
- 보완 결과 확인: 원본 UTF-8 wire bytes와 key를 private 상태로 보존하고, 별도 최신 DATA 권한으로
  처리 결과를 조회하는 API 및 화면을 연결했다. 원본 wire/API 대상 53개, receipt API 14개,
  새 frontend 연결 대상 194개가 통과했다. dot-segment key 방어와 view 전환 회귀를 포함한다.
  과거 완료 receipt가 현재 문서보다 오래되어도 현재 문서를 덮어쓰지 않으며, 조회 실패 시 원본을 보존한다.
- V26: native parent transaction과 실제 검증의 causal stamp를 연결했다.
  명령 완료와 stamp의 동일 business transaction, 늦은 권한 실패의 rollback 및 durable UNKNOWN,
  역사 replay의 신규 stamp 0을 포함한 후속 Receipt/completion 11 suites/68 tests가 통과했다.
  실제 MVC의 잘못된 GET이 500이 되는 공통 예외 처리를 405/실제 Allow 헤더로 보정하고
  Core 25 suites/101 tests를 통과했다. genuine Auth v9 두 leg의 실행 검증은 별도로 진행 중이다.
- 최신 전체 frontend 한 snapshot은 639 files/5,406 tests가 통과했고,
  후속 wire 연결 후 공식 build도 통과했다(initial 1,052.3 KiB raw/305.7 KiB gzip, 4 requests).
  receipt UI와 추가 신규 계약 및 타 소유 변경 이후의 전체 fresh Gate는 다시 실행해야 한다.
- APR-16B 내부 서명은 실제 crypto/PG/권한 회수 전용 34개가 통과한 신규 기능 단계다.
  verified source issuer, 정확한 공개 권한 계약과 ceremony UI, 외부 provider 프로토콜,
  metadata-only UNKNOWN 확인 및 운영 보존 증거는 아직 완료가 아니다.
- Auth final9 seed/schema는 실제 full migration PostgreSQL 65개, Gateway adapter 8개가 통과했다.
  민감한 명령의 Resolver9 누락을 실제 Spring RED로 재현한 뒤 exact closed-version/descriptor seal/
  current pointer 검증을 유지해 보정했다. target 48개 및 해당 Auth 전체 141 suites/650 tests가
  통과했다. 이는 별도 PolicyImpact package까지 합산한 전체 최신 Auth 수치가 아니다.
  실제 PolicyImpact latest9 DB/Redis/default HTTP target의 정상 처리·회수·null query guard
  5개도 통과했으며 이 source-leg를 installed Gateway/owner browser 증거로 대체하지 않는다.
- 관리 signed planning은 전용 신규 source/proof/client/DTO와 default Boot schema를 구현했다.
  requester-free aggregate ROLE_POOL_PREVIEW만 제공하고 TASK eligibility/quorum을 평가 완료로
  표시하지 않는다. 실제 WF effective window와 signed expiry를 포함한 28개 및 해당 전용
  HTTP 경계를 고정하는 전체 boundary Python 51개가 통과했다. Auth counterpart/정본 v10/UI는 진행 중이다.
- 남은 내부 작업: 첨부 prepare/seal의 실제 create/save/recover/submit/보완 결속,
  서명 ceremony의 공개 기능 연결, 관리용 signed planning, SLA 알림 consumer/운영 명령 및
  전체 record 보존 연결을 구현하고 실제 여정으로 검증한다. 외부 조건으로 이동하지 않는다.

새 기능의 단위 성공이나 기본 disabled 상태를 기능 구현 완료 또는 운영 activation으로 오인하지 않는다.

## 2026-09-14 통합 재검증 및 다음 연결

- 홈 및 관리 화면의 eager import가 초기 번들을 늘리는 결함을 실제 build로 재현했다.
  기존 권한 검사와 페이지 헤더를 유지하면서 실제 route/panel lazy 경계를 적용했고,
  예산을 높이지 않은 공식 build가 통과했다. 초기 1,054.7 KiB raw/306.1 KiB gzip,
  4 requests, 최대 async 482.5 KiB raw/123.2 KiB gzip이다.
  그 뒤 실제 desktop/mobile publishing 24개를 다시 통과했다.
- 전체 frontend 실행은 최초 652 files/5,583 tests 중 3개 실패였다.
  최초 설정의 immutable execution 전달을 기존 AST 계약에 맞추고, 생성 계약 테스트를
  봉인된 v9 checksum 및 302 routes에 고정했다. 먼저 36개 target이 통과했고,
  전체 fresh 재실행은 652 files/5,583 tests, failure 0으로 통과했다.
  로그: `/tmp/approval-root-full-unit-20260914-final9-fixed.log`.
- 실제 owner filter/controller 연결은 Release9 parser/matrix 7 suites/457 tests가 통과했다.
  genuine Auth 발급 및 PostgreSQL controller 6개는 포함하지만 MFA/session fixture 사용을
  실제 사용자 로그인·전체 Gateway browser activation 완료로 바꾸지 않는다.
- 실제 첨부 lifecycle helper 및 draft recovery는 46개, 실제 producer Spring hook은
  별도 18개를 통과했다. 신규 hook으로 바뀐 초기 자료를 중복 INSERT하는 과거 fixture는
  현재 재검증 중이다. 이러한 target을 전체 최신 Approval 성공으로 합산하지 않는다.
- SLA 알림 V27의 상속된 worker UPDATE/DELETE 권한으로 완료 chunk를 변경할 수 있는
  실제 PostgreSQL RED를 보존했다. 권한 회수와 immutable trigger를 보정한 V27 SHA는
  `fbd80f5370c9f7fe97c690860a4bd7f9009a5b26ec3cb429c0e7fe37ecddaa62`다.
  독립 fresh all V1..27/NOOWNER/NOBYPASSRLS/WORKER 검사 32개가 모두 통과했다.
  증거: `output/notification-sla-sidecar-2026-09-14/primitive-final-green`.
  이는 journal primitive의 근거이며 native 알림 전체 consumer의 완료 근거가 아니다.
- 전용 SLA transport/client/current recipient verifier 및 100명 단위 consumer를 구현했다.
  고정된 전체 수신자를 현재 권한으로 재검증하고 child intent·보존·chunk를 같은 transaction에
  저장하며, 늦은 권한 변경은 rollback한다. 해당 신규 production/test compile은 격리 snapshot에서
  통과했다. 실제 signed HTTP/100-child 원자성/알림 발행 및 Auth SYSTEM source 연결 검증은 진행 중이다.
  기본값은 계속 disabled이며 producer snapshot이나 caller boolean을 현재 권한으로 인정하지 않는다.
- 다음 내부 순서: genuine v9 보완 business transaction 및 causal stamp → 실제 INFO 첨부 결속 →
  signing/planning/retention 신규 공개 계약과 정본 v10 → 서비스 간 SLA 및 보존 사본 처리 →
  APR-01~16 전체 원본 대조·실제 사용자/관리자 browser·서버 재기동 통합 검사.
  전체 상태는 계속 `IN_PROGRESS`이며 내부 미구현을 외부 Gate로 이동하지 않는다.

## 2026-09-14 실제 연결 후속 체크포인트

- APR-15: 기존 정책 API의 실제 versioned GET 영향 분석을 연결했다. API 18개,
  desktop/mobile browser 18개가 통과했다. 별도 독립 harness에서 이전 구현은
  15개 중 7개가 실패했고, 현재 query cache의 최초 실패와 현재 권한을 명령 직전에
  다시 검사한 후 15개가 모두 통과했다. 원본의 중앙 현재/변경안 비교와 우측 독립
  검토/영향/이력 배치를 적용했다. geometry 6개, 영향 18개, source-fence 8개 및
  presentation/model 17개는 서로 다른 bounded 검증이다.
  실제 캡처와 인계: `output/approval-policy-workspace-2026-09-14/HANDOFF.md`.
- 실제 Auth v9 양방향 보완 HTTP 및 native attachment seal이 결합된 standalone
  교차 테스트 1개가 통과했다. 같은 payload SHA와 증가한 attachment revision,
  private V26 completion/stamp, 후속 generation/만료/권한 회수의 역사 receipt를
  실제 DB/HTTP로 검사했다. 별도 native attachment PG 7개 및 post-D 126개가
  통과했다. 실제 공개 Gateway browser 또는 AV/storage 운영 준비 증거는 아니다.
- SLA Notification의 실제 native 100/1,000명, 100명 단위 10 chunk, late failure
  rollback 및 immutable journal/retention/outbox를 포함한 62개가 전부 통과했다.
  증거: `output/notification-sla-sidecar-2026-09-14/native-stage-zero-final-green`.
  Auth nonce 보존의 실제 RED 2개를 고친 후 Auth 대상 19개가 통과했다.
  실제 Approval native source/Auth HTTP/NF assertion 교차 3개 및 source/default Boot
  25개도 통과했다. 이것을 기존 SLA producer의 최종 연결 또는 Kafka 운영 완료로
  대신하지 않는다. producer 연동은 아직 진행 중이다.
- 실제 fresh Approval V1..29 및 R1의 30개 migration, 실패 0, health UP을 확인했다.
  신규 공개 API는 Signing 8개, Retention 7개, planning simulation 1개다.
  서명 evidence의 `$ref`와 `type:null` 교집합 오류를 발견해 source annotation을
  실제 object/null union으로 보정했다. 실제 Draft 2020-12 검증기로 native RSA
  Evidence와 null, 전체 pending/attested ceremony를 검증했다. 해당 Auth 12개와
  Approval 64개가 하나의 격리 snapshot에서 모두 통과했다.
- 실제 owner export SHA-256은
  `92bd65d72399ae13f2b97adb98545296a4ae3b2e935a3d4fb84d0a4e76b4564d`다.
  기존 v9 operations/schema 보존과 정확히 신규 16 operations를 검사했다.
  release10 response graph는 17개 closed schemas이고 SHA-256은
  `9cdd8e9f4aef77ccb534277515c3cd55ac2f1397dbc518b0a6e21adb7f366ee6`다.
  정본 registry10은 318 routes/132 capabilities, Approval PEP10은 107 routes다.
  Auth seed는 DRAFT이며 실제 live grant/activation/ceiling을 변경하지 않았다.
- 기록 읽기/문서·첨부 작업자의 실제 LIVE 및 exact DataSource/RC transaction
  fence는 각각 53개와 후속 52개가 통과했다. private native 파기와 pending
  delivery 차단 2개, workflow/outbox current lease fence 39개도 별도 통과했다.
  LOCAL_DB_PURGED는 외부 사본 확인 또는 전체 삭제 완료가 아니다.
- 신규 Retention UI/API를 실제 7개 경로에 연결하는 중이다. 독립 API 테스트의
  불완전한 read 증거/본문 없는 403 자동 재전송 RED 9개를 보정한 후 105개가
  모두 통과했다. 기존 axios 대상 44개도 함께 통과했다. 별도 workspace의
  렌더링 없는 clock expiry RED를 보정하고 원래 명령/입력을 보존하는 workspace 14개와
  browser 16개를 통과했다. 이 browser는 명시적 계약 fixture의 UI/전송 경계 근거이며
  실제 운영 Auth/Gateway 설치 또는 보존 실행 완료 근거가 아니다.
- release10 공식 frontend authorization/fixture 동기화와 immutable v1~~v9 보존을 완료했다.
  실제 설치된 Auth/Gateway positive 검증, planning preview 최종 연결, SLA producer와
  consumer의 최종 실제 연결, retention 실행 Auth/외부 사본 producer·consumer,
  최신 전체 enum/CHECK audit와 quality/build/browser 및 DB를 보존한 재기동이다.
  위 bounded 성공을 전체 최신 frontend/backend PASS나 APR-01~~16 100% 완료로
  합산하지 않는다. 전체는 `IN_PROGRESS`이며 실제 외부 37개 BLOCKED는 보존한다.

## 2026-09-14 후속 구현 checkpoint

- 운영 화면은 전송/SLA/전송 완료의 세 탭, 상태 필터, 시각 기준 정렬, 우측 상세를 연결했다.
  SLA 검토는 실제 task를 선택해 결재함으로 이동한다. 조회된 항목 수와 전체 tenant 수를
  혼동하지 않으며, broker PUBLISHED를 외부 처리 완료로 표시하지 않는다.
- 현재 권한·선택·전체 행 fingerprint·native version·eligibility·45초의 실제 시계 유효성을
  CSRF 전/전송 직전/응답 후 재검증한다. 첫 조회 실패나 paused 상태에서 cached READY로
  쓰지 않으며, bodyless 403을 자동 재전송하지 않는다. 모델/API/실제 AST 대상 50개와
  기존 native retry UI Chromium/mobile 2개가 통과했다. 신규 운영 browser 검증은 진행 중이다.
- 운영 소스 실패가 보존 editor를 unmount하지 않도록 조회와 편집의 mount 경계를 분리했다.
  보존 응답 유실 후 원래 key/body를 확인하는 신규 네 DATA receipt API는 V32에서 구현 중이다.
  최신 head version 상승만으로 원래 명령의 성공을 추정하지 않는다.
- 내부 서명은 독립 API/검증 모델/관리 UI/문서 viewer/AST 대상 51개와 browser 14개를 통과했다.
  실제 RSA 서명 검증과 현재 소스 변경 시 POST 0, 320px·실제 200% font·Axe를 포함한다.
  mock browser의 발급 증거는 실제 운영 MFA·외부 법적 서명 완료 증거로 재사용하지 않는다.
- Native 운영 명령 7개와 별도 task 재배정 2개를 신규 범위로 승인했고 Approval V34를 예약했다.
  일괄 선택은 실제 actor-owned persisted batch이며 실행은 최대 50건 all-or-nothing이다.
  후보 권한 검증과 실제 broker observation을 구현하기 전에는 재배정/재확인을 완료로 표시하지 않는다.
- Source11은 planning-selection 한 DATA와 보존 receipt 네 DATA로 고정했다.
  이후 운영 명령은 Source12로 분리하며 봉인 전 미설치 계약은 계속 거절한다.
  V30 원본 SLA witness, V31 inventory 38, V32 receipt, V33 inventory 39, V34 운영 schema의
  소유를 분리했다. 미래 운영 테이블을 기존 보존 목록에 몰래 추가하지 않으며 FK 차단을 유지한다.
- 최신 전체 frontend 두 번째 실행은 664 files/5,846 tests 중 5,838 pass/8 fail이었다.
  전역 HIGH 기대 1개와 문서 viewer의 AuthProvider 격리 7개를 보정해 해당 target을 통과했다.
  후속 운영·planning 소스가 추가됐으므로 이것을 최신 전체 PASS로 바꾸지 않는다.
  전체 TypeScript의 planning 4개 오류는 소유자가 보정했고 heap 부족 exit 134는 PASS가 아니다.
  compile-safe source에서 전체 unit/type/build를 새로 회수한다.

## 2026-09-14 실제 후속 구현과 남은 연결

- 전체 frontend 한 고정 소스는 671 files / 5,946 tests, failure/skip 0으로 통과했다.
  실행 전후 2,529-file SHA manifest의 drift는 0이다. 이후 아래 후속 소스와 타 제품
  format-only 변경이 추가됐으므로 이 수치를 최신 최종 전체 완료로 재사용하지 않는다.
- 운영 browser의 실제 검색 버튼 200% font 넘침을 재현했다. CSS token 문자열이
  계산된 line-height로 적용되지 않는 문제를 실제 theme callback으로 보정한 뒤,
  동일 5개 target과 전체 30개 Chromium/mobile 여정이 통과했다. 32개 실제 viewport
  캡처와 Axe/focus/320px/dark/forced-colors 근거를 별도 MANIFEST에 보존했다.
  이 증거는 fixture UI/전송 경계이며 운영 Native Auth 설치 증거는 아니다.
- APR-11의 첫 403/503 동안 cached 집계가 현재 ENFORCED로 남는 실제 결함을 보정했다.
  403은 즉시 숨김, 503/fetch/20초 만료는 과거 수신 자료·UNKNOWN·바로가기 0으로 처리한다.
  수신 시각은 client dataUpdatedAt이며 server generatedAt으로 표시하지 않는다.
  SLA는 operations?queue=sla, 전달 실패는 queue=delivery, 직무 분리 예외는 policies로
  이동한다. 정책/서명 PAGE 바로가기는 각각 현재 exact 권한을 확인한다.
  실제 mounted 조회/권한/ABA 여정 26개, source 15개, 기존 model 12개가 통과했다.
- 보존 원본 증적의 네 bodyless DATA GET adapter와 private original body/profile 검증을
  추가했다. Java bytewriter의 비-BMP 대문자 surrogate escaping 차이는 실제 RED로
  재현해 새 Retention profile만 보정했다. 원본 body/hash/key/actor/resource set/version/
  operation과 same-transaction COMMITTED 증적이 일치해야 하며, 최신 head나 실행 claim을
  성공 증거로 치환하지 않는다. profile 40개/API 15개 및 운영 queue 31개와 APR-11 53개를
  함께 실행한 6 files / 139 tests가 통과했다. 설치된 Source11/fresh DATA 권한/실제 서버
  응답과 private UNKNOWN 화면 연결은 아직 별도 구현·검증 대상이다.
- Auth의 V213/V214 포함 한 coherent 실제 전체는 167 suites / 770 tests가 통과했다.
  native Workflow planning → 실제 Auth HTTP/PostgreSQL/Redis → 현재 owner source 재검증
  별도 7개도 통과했다. 이후 짧은 duty deadline보다 오래 유효한 원래 JWT를 다시 사용할
  수 있는 nonce TTL 결함을 실제 Redis에서 재현했으므로, 이 수치를 nonce 보정 이후의
  최신 전체 PASS로 바꾸지 않는다. replay 저장 기한과 admission 기한을 분리해 보정 중이다.
- SLA V30 final의 독립 snapshot은 22 suites / 212 tests, failure/error/skip 0이며
  3,664-file manifest와 원본 witness/동일 transaction/crypto-on-read를 검증했다.
  V31/V32/V33의 보존 증적과 이후 전체 실행 근거로 대신하지 않는다.
- APR-16B 원본의 history/all-probe/provider-probe/settings/gate-guide/KMS/WORM 여덟
  실제 control에 해당하는 내부 제공자 진단과 외부 서명 연동을 새 native package로 개발한다.
  policy producer 5개를 포함한 19개 public operation은 Source13 예정이며 아직 봉인/
  설치/전체 공개 실행 완료가 아니다. 실제 DTO/strict JSON/MVC 26개와 검증된 dependency
  checkpoint는 vendor 전송·콜백·CMS/PKIX/TSA·KMS/WORM 전체 완료 근거가 아니다.
  SELF 내부 증적과 외부 법적 서명, 등록 참조와 실제 credential 검증을 분리한다.
- 미래 예약은 Source11=planning-selection 1+retention receipt 4 DATA,
  Source12=운영 7+task 2, Source13=진단/외부 서명/policy 19 operation이다.
  Approval V31/V32/V33/V34/V35와 Auth V214/V215의 소유를 분리한다.
  V35/V215 및 Platform code-contract 보정은 actual schema/catalog 검증 전 완료로 기록하지 않는다.
- 보존의 fresh command witness는 실제 receipt 보존 기한을 따른다. 자신의 witness 때문에
  원본 inventory가 바뀌는 문제는 same-transaction 한 번만 검증·봉인하는 retained control
  evidence로 닫으며, 늦은 inventory 치유·소급 증거·자동 삭제 성공을 허용하지 않는다.
  관리 실행 Auth, Audit/Notification 실제 사본 처리 ACK, 전체 record worker 및 runtime
  readiness 연결은 계속 내부 구현 대상이다. 상수 disabled나 참조 존재만으로 READY를
  표시하거나 내부 누락을 외부 승인 37개로 이동하지 않는다.

전체 상태는 계속 `IN_PROGRESS`다. 각 APR 원본 대비 최신 사용자 여정, native producer/
consumer 연결, 새 immutable SHA 및 DB 보존 재기동까지 최종 통합 Gate를 다시 실행한다.
