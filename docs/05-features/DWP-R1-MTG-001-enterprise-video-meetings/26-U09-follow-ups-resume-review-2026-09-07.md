# U09 후속 업무 — 중단 재개와 구현 회귀 검토

## 범위와 승인 원본

사용자는 회의에서 파생된 본인의 업무를 확인하는 구성원이다. 핵심 질문은
“확인할 후보와 이미 배정된 업무 중 지금 무엇을 해야 하는가?”이고, 주요 행동은
후보 근거 검토 또는 정본 Work 업무의 명시적 수락·진행 변경이다. 화면 유형은
목록–상세이며 회의 읽기 권한이 업무 명령 권한을 대신하지 않는다.

이번 작업은 루트가 인계한 U09 한 spec과 재현 결함의 최소 보정이다. U01 CTA,
관리자 retention, U14 및 공통 셸·Gateway·OpenAPI는 수정하지 않았다. 루트가 앞서
수정한 수락 receipt 보존/collectionPending 비노출 경계도 그대로 유지했다.

- 원본 프로젝트: <https://stitch.withgoogle.com/projects/13391261371843159731>.
- 복원 원본: `/tmp/meeting-resume-source.ZVbtmr/stitch_enterprise_grid_calendar_application/`.
- `dwp_meetings_follow_ups_workbench_09._1440px`의 PNG와 HTML 515줄,
  `dwp_meetings_follow_ups_workbench_09._390px_restored`의 PNG와 HTML 304줄을 직접 읽었다.
- 보존된 `output/meeting-design-review-30-2026-09-07/source/U09-D.png`, `U09-M.png`와
  복원 원본의 SHA-256이 각각 일치했다. 원본 PNG·HTML은 수정하지 않았다.
  - D: `a9966513c370a1fed8d05abf9effc4604e18d5237174d1412f6abb603fc978cb`.
  - M: `c6c986c05850f70cd702900f0467325db4e9dc0dc963a29e8f4ae69121542b90`.

## 중단 지점과 발견한 원인

`/tmp/dwp-meeting-admin-followup-resume-r1.json`의 U09 20개 결과는 13 PASS,
페이지 lazy loading 중 제목을 5초 안에 찾지 못한 1건, 구 구현 PNG 불일치 6건이었다.
전체 공유 실행의 다른 제품 결과는 이 수에 포함하지 않는다.

1. 제목을 검사하기 전에 기존 공통 패턴의 `Loading page / 페이지 불러오는 중`
   progressbar 소멸과 실제 main 마운트를 기다리도록 했다. 각각 15초 상태 기반
   상한이며 고정 sleep이나 전체 timeout 변경은 아니다.
2. 구 PNG 비교가 첫 지점에서 중단되어 후속 동작 검증을 가리고 있었다. 화면 비교만
   `expect.soft`로 분리했다. 차이가 있으면 spec은 여전히 실패하며 임계값은
   `maxDiffPixelRatio: 0.002` 그대로다. 이후의 기능·기하·접근성 검증은 생략하지 않는다.
3. 그 결과 구 `Published source` locator가 현재의 명시적 근거 접근 UI와 맞지 않는
   것도 확인했다. 실제 `Meeting decision and action evidence` 제목과 `Preview evidence`,
   `View linked report` 동작을 검사하도록 정합했다. 원문 자동 조회를 다시 도입하거나
   생성 권한 차단을 해제하지 않았다.
4. 390→320px 전환 뒤 선택된 AI 후보 탭이 오른쪽 141.1px 밖에 남는 실제 결함을
   재현했다. fonts-ready와 5초 기하 poll 뒤에도 같은 실패였다. 이 증거는
   `/tmp/dwp-u09-resume-reviewed-r3.json`에 보존했다.
5. `meeting-follow-ups.tsx`의 작은 `FollowUpTabs` 경계에서 scroller/선택 탭의
   ResizeObserver로 선택 항목만 수평 노출한다. 페이지 세로 위치나 초점을 강제로
   옮기지 않으며 observer는 탭 변경·unmount 시 disconnect한다. 좌우 실측 좌표차를
   사용하므로 `scrollLeft`가 항상 양수라는 가정은 없다. ko/en LTR 실행은 검증했지만
   이 결과를 전체 제품 RTL 지원 검증으로 확대하지 않는다.

`/tmp/dwp-u09-resume-reviewed-r4.json`에서는 같은 320px 선택 탭 경계와 후보 검토,
닫기, 생성 명령 0 및 axe가 통과했고 구 PNG 차이만 남았다. 최종 spec에는 Home/End
키로 양 끝 탭에 이동하고 Enter로 실제 선택을 바꾼 뒤, 선택 탭이 다시 보이는
기하 검증도 포함했다. 탭 전환으로 업무 상태 변경 명령이 발생하지 않음을 확인한다.

## 화면 대조와 구현 기준 이미지의 한계

원본과 실제 화면을 직접 대조해 정보 구조를 검토했다. 데스크톱은 요약/필터와
7:5 목록–상세, 선택 행의 청색 강조, 출처·담당·기한·현재 상태, 별도 권한 경계를
유지한다. 모바일은 압축 요약, 가로 탐색, 목록과 전체 화면 후보 검토를 유지한다.
승인 시안의 예시 숫자·96% 신뢰도·발언자·영구 보존·실시간 양방향 보증은 계약에서
입증되지 않으므로 복사하지 않았다. 원문의 확대 금지 viewport 설정도 적용하지 않았다.

원본과 100% 시각·기능 일치라는 판정은 하지 않는다. 공유 셸, 데이터와 문구,
전체/현재 페이지 요약 의미, 별도 완료 탭 대신 상태 필터, 자동 후보 혼합 여부,
내보내기·재배정·목적지 Work 상세 연결에 차이 또는 미제공 경계가 남는다. 이번
이미지 정합은 검토된 현재 구현의 회귀 기준이지, 이런 차이를 승인 완료로 바꾸는
작업이 아니다. 후보 생성은 현재 Meeting entitlement/scope/identity/action을 확인할
수 없으면 계속 차단된다. 외부 목적지 미연결은 비활성 버튼과 사유로 남는다.

이전 full-page PNG에는 스크롤 후의 fixed 헤더·skip link·모바일 dock이 문서 중간에
합성된 캡처 결함도 있었다. 실제 viewport 캡처와 dock의 하단 위치를 먼저 확인한 뒤,
기존 `withMeetingDocumentCapture`를 소비하여 문서 캡처만 정규화한다. 공통 helper는
수정하지 않았고, 실제 viewport PNG에는 높이 정규화를 적용하지 않는다.

### 명시적으로 검토·갱신한 구현 PNG 10개

다음은 모두 `e2e/video-meeting-follow-ups.spec.ts-snapshots/` 안의 구현 회귀 파일이다.
원본 `source/` 파일이나 임계값은 바꾸지 않았다.

- `meeting-u09-candidates-authority-blocked-1280-chromium-darwin.png`
- `meeting-u09-candidates-authority-blocked-390-mobile-darwin.png`
- `meeting-u09-candidates-authority-blocked-320-mobile-darwin.png`
- `meeting-u09-candidate-review-authority-blocked-1280-chromium-darwin.png`
- `meeting-u09-candidate-review-authority-blocked-390-mobile-darwin.png`
- `meeting-u09-candidate-review-authority-blocked-320-mobile-darwin.png`
- `meeting-u09-candidates-authority-blocked-ko-1280-chromium-darwin.png`
- `meeting-u09-candidates-authority-blocked-ko-390-mobile-darwin.png`
- `meeting-u09-follow-ups-chromium-darwin.png`
- `meeting-u09-follow-ups-mobile-darwin.png`

검토 전 actual/expected/diff는 `/tmp/dwp-u09-resume-reviewed-r1/`부터 `r4/`에
보존했다. 10장 정합은 이 spec의 대상 6개만 `--update-snapshots=changed`로 실행했다.
그 실행은 6/6 PASS, 28.7초지만 최종 no-update 성공과 별도로 기록한다.

## 실행 범위

모든 실행은 번들 Node24 PATH와 정본 Playwright 설정, 격리 Vite `:4476`에서
1 worker로 수행했다. Vite 설정은 기존 앱 설정을 상속하며 보안이나 기능 플래그를
변경하지 않는다. 단위 검증은 follow-ups runtime/model, candidate model, evidence의
4개 파일 70/70 PASS다. 루트가 추가한 delayed collection receipt 유지 및 403 철회
회귀도 포함한다. scoped ESLint 0 오류/경고, diff-check와 source-size 1,783 production
files PASS를 확인했다. 전체 공유 typecheck/build는 루트의 단일 통합 Gate와 구분한다.

운영 LiveKit/녹화/STT/LLM/KMS 및 보존·삭제 종단 검증의 외부 NO-GO는 이 mock 기반
회귀로 해제하지 않는다. 실제 원문·녹화·사용자 정보를 추가 저장하거나 가짜 성공을
표시하는 변경은 없다.

### 최종 no-update 안전 지점

`/tmp/dwp-u09-final-no-update-0907.json`과 동명 캡처 디렉터리:
**20/20 PASS, 0 failure, 0 skip, 0 retry, 1.5분**. Chromium 10개와 mobile/WebKit 10개다.
수락→별도 시작, 같은 명령 receipt 복구, 409 최신 버전 검토, 파괴적 명령의 명시적 사유,
권한 철회/늦은 성공 폐기, 후보 생성 차단, 정확한 게시 버전 근거 및 근거 403 뒤 제거,
1280/390/320, ko/en, 320 dark, Home/End/Enter, 넘침과 serious/critical axe 0을 포함한다.
최종 실행에서는 아래와 같이 PNG 갱신을 금지했다.

```sh
E2E_BASE_URL=http://127.0.0.1:4476 E2E_REUSE_EXISTING_SERVER=true PLAYWRIGHT_OUTPUT_DIR=/tmp/dwp-u09-final-no-update-0907 PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/dwp-u09-final-no-update-0907.json corepack yarn playwright test e2e/video-meeting-follow-ups.spec.ts --project=chromium --project=mobile --workers=1 --update-snapshots=none --trace=retain-on-failure --reporter=line,json
```

본 인계의 변경은 `meeting-follow-ups.tsx`의 로컬 탭 wrapper, 해당 E2E 1개, 위 구현
PNG 10개와 본 문서다. 같은 파일의 기존 루트 변경은 보존했다. 검증 서버 종료 후
원자 편집 0·실행 명령 0인 CLOSED/FROZEN 상태로 루트에 인계하며 부분 커밋은 만들지 않는다.
