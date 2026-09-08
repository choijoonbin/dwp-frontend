# Meeting 중단 후 재개 — 최종 검증 기록 (2026-09-07)

## 판정과 범위

중단 이후 공유 트리, 실제 Stitch 프로젝트, 로컬 서비스 및 테스트를 다시 확인했다. 이 문서는 이전 성공 로그를 재사용한 보고서가 아니다. 아래의 검증 가능한 보정 범위와 남은 제품/운영 조건을 구분한다. **30개 화면의 사용자 승인 또는 디자인·기능·운영 100% 완료 판정이 아니다.** 최종 공유 build 결과는 아래에 별도 기록한다.

원본/현재 화면 비교: [30면 비교 갤러리](/Users/a10697/Work/DWP/output/meeting-design-review-30-2026-09-07/index.html). 각 화면에 원본 코드/이미지 SHA, 구현 캡처 SHA와 시각, 사용한 ZIP 버전이 있다. 상태는 `REVIEW_EVIDENCE_NOT_DESIGN_APPROVAL`이다. 갤러리의 풍부한 예시 데이터는 권한 경계를 통과하는 테스트 fixture이며 실제 사용자의 운영 데이터를 복제한 것이 아니다.

## 원본 재확인

- 사용자가 준 [Stitch 프로젝트](https://stitch.withgoogle.com/projects/13391261371843159731)에 실제 접속해 DWP Meeting 15개 데스크톱/모바일 쌍의 node ID를 다시 확인했다.
- 보존된 30면 원본 ZIP `stitch_enterprise_grid_calendar_application (10).zip`: SHA-256 `0a2fc4d7881a01f9b3ba0e6f164f3b9f980f8aa8afc53c29ea53afecb5d22787`.
- 온라인에서 바뀐 U14 모바일은 동일 node `7baadb2159e3411db77faaadb0dc52f5`의 최신 선택 화면을 직접 export했다. ZIP `(15)` SHA-256 `39425824a002e9c551df53975828723c0d91b120c9fb3c231df1812a78f351bb`; 최신 PNG 390×942. 기존 원본은 덮어쓰지 않고 이력으로 보존했다.
- 나머지 29개 HTML을 이번에 전부 다시 온라인 export했다는 주장이 아니다. 기존 불변 원본에 대한 해시와 최신 U14 override를 검사했다. 구버전/원본 교체 및 잘못된 출처 판정 회귀를 포함한 68건이 통과했다.
- 최종 갤러리의 구현 캡처는 2026-09-07 18:46–18:52 KST에 새로 생성했다. 이후 prejoin의 번역 키 문자열 조합 한 줄만 동일 동작의 template literal로 정합했다.

## 실제로 발견하고 보정한 원인

1. **모바일을 축소 데스크톱처럼 처리한 구간**: U02 안건 제목/시간/담당자와 결과 수 줄바꿈, U04 200% 글자에서 명단 고정 64px, U07 즐겨찾기 버튼의 별도 빈 줄과 38px target, U11 초대 링크 복사 한글 분절을 실제 재현해 수정했다. 320/390px, ko/en, 확대와 클릭 영역으로 회귀를 고정했다.
2. **최신 원본 revision 미반영**: U14-M의 4개 선택 칩/01–04 단일 펼침 구조로 정합하고, 닫았다 열어도 미저장 정책 값이 유지되도록 했다. 운영상 필요한 추가 정책은 삭제하지 않고 별도 펼침으로 보존했다.
3. **U08/U09 실제 상태 전이 결함**: U08의 네 번째 후속 업무 탭을 실제 권한 응답에 연결했다. 전사 410에서 이전 원문이 남던 문제, U09 좁은 화면 선택 탭 가림 및 receipt 재조회/403에서 이전 표시가 남거나 사라지는 경계를 보정했다.
4. **U08 탭 레일의 지연 observer 결함**: 접근성 검사 후 현재 폭과 다른 과거 IntersectionObserver 값이 스크롤 화살표를 만들었다. Meeting 로컬 measured-overflow 래퍼로 실제 overflow가 있을 때만 기존 MUI 자동 제어를 사용한다. 36개 반복 캡처/90개 geometry 관측 및 390/320px·200%에서도 검증했다. 원본, 기존 정상 PNG 및 허용오차를 바꾸는 방식으로 숨기지 않았다.
5. **캡처 도구의 고정 dock/문서 높이 문제**: 실제 viewport 검증과 전체 문서 캡처를 분리했다. 폰트 완료와 최대 4회 높이 수렴을 확인하고 원래 viewport를 finally에서 복구한다. 동작/CSS를 숨기지 않는다. 갱신한 구현 회귀 PNG는 각각 직접 검토했고 Stitch 원본과 별개다.
6. **보존 관리 UI 미연결**: U15 관리자 화면에 실제 기록 UUID 기반 조회, 기록 부모 삭제 보류/해제와 만료 대상 삭제 승인/철회를 연결했다. MANAGE 권한, 명시적 확인, 버전 CAS, 동일 idempotency 키 재시도, 권한 회수 시 철회를 검증했다. 녹화/전사/보고서 전체에 대한 법적 보존 명령으로 오인되지 않도록 범위를 표시한다.
7. **최종 표시 사전 Gate**: `meeting-prejoin.tsx`의 `'status.' + meeting.lifecycleState`를 검사기가 enum 비교로 오인해 `states.STATUS`를 요구했다. 기존 Meeting 표시 방식과 동일한 template literal로 정합했다. 번역/실제 표시/권한 동작은 불변이며 무의미한 공통 사전 키 추가나 검사 완화는 없다.

디자인/퍼블리싱·브라우저, recap/후속 업무, backend/보존 경계를 독립 담당자가 검토했다. U01–U05/U08/U09 14면, U06/U07/U10/U11/U12 10면, U13–U15 6면의 원본·구현을 직접 열어 확인했다. 픽셀 기준선 통과만으로 콘텐츠·권한 정확성을 판단하지 않았다.

## 최신 검증 결과

중복되는 실행이 있으므로 다음 수치를 단순 합산해 전체 고유 테스트 수로 발표하지 않는다.

| 검증                                                       | 결과                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Meeting feature/video API unit                             | 93개 파일, 1,192 PASS                                                                                |
| 전체 clean non-incremental typecheck                       | 0 오류 PASS; 마지막 prejoin 표기 정합 이후 재실행                                                    |
| Meeting scoped ESLint                                      | 0 오류/경고 PASS                                                                                     |
| source-size / maintenance                                  | 1,818 production 파일 PASS; maintenance는 마지막 공통 readiness 정합 후 재실행 대상                  |
| design-system / i18n / display / architecture / 계약 check | PASS                                                                                                 |
| 30면 최신 캡처 포함 9 spec 통합                            | 120 scheduled = 99 PASS / 21 의도된 project skip / 0 FAIL / 0 flaky                                  |
| 기존 브라우저 8 spec R17                                   | 166 scheduled = 145 PASS / 21 의도된 project skip / 0 FAIL / 0 flaky; no-update                      |
| 승인 크기 구현 회귀                                        | 공통 모바일 접근성 보정 반영 후 24/24 PASS; no-update, 원본 대체 아님                                |
| 원본/출처/메타데이터                                       | 68/68 PASS                                                                                           |
| U08 rail 최종 반복                                         | 12/12 PASS, skip/failure/flaky/retry 0                                                               |
| U09 독립 회귀                                              | 20/20 E2E, 관련 70 unit PASS                                                                         |
| U13–U15 독립 admin PNG                                     | 7 PASS / 3 기존 중복 project skip / 0 FAIL                                                           |
| backend Meeting fresh check                                | 95 suites / 576 tests, failures 0, errors 0, 외부 LiveKit smoke 1 skip                               |
| 신규 V38 보존 경계                                         | PostgreSQL 26 + 실제 SecurityFilter/controller PG 5 + wiring 2 = 33 PASS, skip 0                     |
| Agent Meeting target                                       | 75 PASS / PG 환경 미설정 1 skip                                                                      |
| Meeting 독립 production build                              | PASS; initial gzip 264.8KiB/280, 5 requests/5, largest async gzip 133.6KiB/260                       |
| 마지막 prejoin 동일 동작 표기 정합 영향                    | 기존 unit 5개 파일 43/43 PASS; 동일 영향 22 E2E fresh R19 = 18 PASS / 4 명시 skip / 0 FAIL / 0 flaky |
| 전체 공유 production build                                 | 최종 재실행 기록 대기; 아래 차단 이력 참조                                                           |

접근성 검사는 의미 있는 조작·키보드·focus·실제 fixed dock 위 콘텐츠 clearance와 axe를 함께 사용한다. 테스트별 해당 조건에서 ko/en, light/dark, forced-colors, 1440/1280/390/320px 및 200% 글자를 검증했다. 모든 30면×모든 조건의 완전한 조합을 실행했다는 뜻은 아니다.

추가 기능 12 spec은 최초 **68 PASS / 2 FAIL / 2 SKIP**였다. 실패를 포함한 2 spec을 fresh server에서 전체 재실행해 **12/12 PASS**. 중복 제거 증거는 70건 통과와 모바일 native-background 미지원 2건이다. 첫 실패와 모듈 로딩 로그를 삭제하지 않았으며, 단일 실행 72건 전부 성공 또는 console 오류 0으로 보고하지 않는다.

마지막 prejoin 영향 R18은 17 PASS / 1 모듈 로딩 FAIL / 4 SKIP이었다. 첫 Chromium blur 사례가 화면 진입 전에 개발 서버의 동적 module import에서 실패했다. 코드/PNG/조건을 수정하지 않고 같은 22개 범위를 fresh canonical server에서 다시 실행한 R19는 18 PASS / 4 SKIP / 0 FAIL / 0 flaky이다. 제외 4건은 모바일 native-background 미지원 2건과 Chromium 전용 legacy PNG의 중복 project 2건이다. U05 모바일 실제 기하/확대/승인/입장/speaker는 실행해 통과했다. 이 43 unit은 앞선 1,192에 추가 합산하지 않는다.

### 마지막 공유 Gate 차단 이력

- 원자 편집 중 다른 제품 타입 오류는 그 소유자에게 전달했고, 마지막 전체 clean typecheck는 PASS다.
- Meeting U14 raw radius는 같은 16px의 공통 design token `meetingShape.stage`로 정합했다. DS 기준 상향은 없다.
- Meeting prejoin 표시 사전 오인은 위 7번처럼 의미/동작 불변으로 수정했고 display Gate는 통과했다.
- 이후 full build는 Work 소유 브라우저 zoom extension 증거 파일의 `chrome` 전역 ESLint 오류 한 건으로 중단됐다. Work 소유자에게 국소 수정 요청했으며 Meeting 작업에서 외부 소유 파일이나 공통 checker는 수정하지 않았다.
- Work 소유자가 해당 Chrome service worker 전역을 국소 선언해 ESLint PASS로 복구했다. 다음 full build는 중앙 backend OpenAPI 갱신과 frontend snapshot 사이의 불일치에서 중단되어, 공통 소유자의 최종 sync/check를 요청했다. Meeting 작업은 생성물을 덮어쓰지 않았다.
- 이후 Work 증거와 Activity 문서 포맷은 각 소유 범위에서 정합되어 전체 Prettier 검사가 PASS했다. 이 결과도 최종 공유 스냅샷에서 다시 확인한다.
- 첫 최종 재실행은 공통 `check-product-surface-production-readiness.test.mjs` 1,206줄이 maintenance 기준 1,199줄을 초과해 중단됐다. 동시에 Work 소유 파일 3개가 변경되어 실행 전후 source manifest도 달라졌다. 이를 Meeting 성공으로 오인하지 않고 공통 소유자 정합과 Work 동결 뒤 재실행한다.
- 최종 결과는 이 표/구획을 갱신하며, 중간 실패를 PASS로 바꾸어 해석하지 않는다.

## 실제 앱·데이터·운영 확인

중단된 로컬 Docker와 Auth/Gateway/핵심 서비스를 각 소유자가 정본 경로로 재기동했다. volumes 삭제/임의 데이터 초기화는 없다. Meeting 8009를 포함한 core 서비스와 8080 Gateway가 ready이며 중앙이 9개 서비스, **809 public Gateway paths**를 정본 export/sync/check했다. 공통 생성물은 Meeting 작업에서 직접 덮어쓰지 않았다.

공식 로컬 점검 계정 `hyunwoo.park@sk.com`으로 실제 앱에 로그인해 `/meetings/home`의 회의, 참여자/수락 수, 일정, 준비 상태, 빈 결과/후속 업무 상태를 확인했다. 로그인 토큰/쿠키를 읽거나 보고서에 저장하지 않았다. 이 재개 구간에는 실제 사용자 데이터 변경/삭제가 없다. 앞선 `joonbin@sk.com` 기록함 즐겨찾기 설정→새로고침→해제 원상복구 점검은 문서 20의 **이전 시점** 증거이며 새 점검으로 재사용하지 않는다.

V38 worker는 기본 disabled다. 기록 보존 설계는 승인/보류 CAS, DB lease/fence, child artifact 삭제 증거, audit publication, 한 transaction의 tombstone/감사/정확 범위 삭제를 요구한다. 실제 고객 기록 purge를 한 번도 수행하지 않았다. Agent 8010과 실제 managed processing은 별도 운영 NO-GO로 유지한다.

## 완료로 계산하지 않은 차이와 다음 인계 경계

| 영역          | 남은 조건/필요한 계약                                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 전체 셸/시각  | Stitch 예시의 독립 header/sidebar와 솔루션 공통 셸은 다르다. 공통 좌우 여백/토큰은 보존했다. 실제 데이터의 길이/상태와 추가 보안 설명 때문에 모든 픽셀·높이가 원본과 같지는 않다.                     |
| U03 예약      | 실제 Calendar 가용성/충돌 및 초대 전달 증거 결속. 초대 대상을 등록하는 기능과 외부 전달 성공은 별개다.                                                                                                |
| U04 준비      | 스마트 브리핑, 사전 대화/원본 자료 broker 및 Meeting tenant/ACL/revision 결속. 임의 모델 호출이나 외부 파일 접근을 추가하지 않는다.                                                                   |
| U07 기록함    | shared/review/publication/expiry 서버 projection, CSV/export, 서명/permission sharing 계약. 비활성 설명은 해당 기능 개발 완료가 아니다.                                                               |
| U08 결과      | 공유·내보내기·감사 이력의 권한/소유 서비스 연결, 실제 녹화/전사/AI 처리.                                                                                                                              |
| U09 후속 업무 | Work 직접 이동/재배정/export 및 owner command 권한 계약. 후보 승인은 승인으로 표시하고 최종 Work 생성 성공을 위조하지 않는다.                                                                         |
| U10–U12       | 실제 템플릿 사용/추천 지표, 일부 개인실 자동화, office/custom-image 배경 등 미지원 기능. 명시적 장치 사용 전 정상 진단/사진을 꾸며 넣지 않는다.                                                       |
| 운영 종단     | 실제 SFU/TURN/Egress, trusted transcript broker, KMS, STT/LLM, 정상 audit delivery, 승인된 일회용 canary와 보존/삭제 증거. 관리자가 worker를 활성화하거나 고객 기록을 삭제하려면 별도 운영 승인 필요. |

이 범위는 새 credential, 타 제품 owner-service 계약/협업, 공통 셸 승인, 실제 보존 정책과 disposable canary가 필요한 인계 조건이다. 기능이 없는데 디자인의 성공 배지를 복제하거나 준비 상태를 GREEN으로 조작하지 않는다.

## 재현 명령과 파일

번들 Node 24.19 및 정본 Yarn 4.17.1 사용:

```sh
corepack yarn typecheck --incremental false
corepack yarn vitest run apps/dwp/src/features/meetings libs/shared-utils/src/api/video-meeting*.test.ts --maxWorkers=2
node scripts/check-display-dictionary.mjs
node scripts/check-i18n.mjs
node scripts/check-source-size.mjs
node scripts/check-maintenance-source-size.mjs
corepack yarn nx run dwp-meetings:build
corepack yarn build
./gradlew :dwp-meeting-server:check --rerun-tasks --console=plain
```

Gradle은 backend 루트에서, 나머지는 frontend 루트에서 실행한다. E2E exact specs/environment는 영구 요약 JSON과 각 담당 문서에 기록했다. canonical Yarn webServer의 각 isolated port를 사용하고 타 제품 테스트 서버를 재사용하지 않았다. Agent/내부 source-traceability의 PG/browser 미사용 범위도 별도로 표시한다.

- [누적 Meeting 소유 파일 목록](29-resume-file-inventory-2026-09-07.md) — 이전 중단 전 미커밋도 포함, 다른 제품/공통 생성물 제외.
- [브라우저 원인·exact 명령·수치](24-resumed-browser-regression-2026-09-07.md)
- [브라우저 영구 Gate 증거](24-browser-gate-evidence-2026-09-07.json)
- [재개 통합 및 마지막 영향 실행의 영구 요약/해시](28-resume-gate-evidence-2026-09-07.json)
- [U14 최신 원본 버전](25-U14-mobile-source-revision-2026-09-07.md)
- [U09 권한·모바일 보정](26-U09-follow-ups-resume-review-2026-09-07.md)
- [관리자 원본 대조](27-admin-source-and-implementation-review-2026-09-07.md)
- [U08 rail 재현·수정](30-U08-recap-tabs-stability-2026-09-07.md)
- [Backend 테이블·보존 경계·PG 메서드](/Users/a10697/Work/DWP/dwp-backend/docs/workspace/meeting-record-retention-2026-09-07.md)

부분 커밋 없음. 완료된 보정/검증과 아직 충족되지 않은 제품·운영 조건을 분리하여 인계한다.
