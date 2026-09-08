# U08 모바일 결과 우선순위 보정

## 범위와 원인

- 주요 사용자: 게시된 회의 결과와 인용 근거를 검토하는 참가자.
- 핵심 질문: 무엇을 결정했고, 후속 조치와 실제 근거는 어디에 있는가?
- 기본 행동: 결정의 인용 시점 확인, 연결된 업무 후보 검토.
- 페이지 유형: 결과 문서와 근거를 연결한 list-detail 화면.

승인 원본 U08-M과 실행 화면을 직접 대조했다. 실행 화면은 제목 카드, 별도
통계 행, 별도 게시 흐름 카드, 탭이 수직으로 반복되어 첫 결정 제목이 모바일
하단 내비게이션 아래에 놓였다. 샘플 데이터, 공통 셸, 픽셀 유사도는 이 판정의
근거로 사용하지 않았다.

## 최소 구현

- `MeetingRecapMobileHeader`는 이미 권한 검증된 부모의 표시 값과 콜백만 받는다.
  데이터 조회, 권한 추론, 원문 접근, 새 캐시를 추가하지 않는다.
- 599px 이하에서만 제목·종료 시각·실제 시간·참가자·접근 범위·산출물 건수와
  게시 흐름을 한 카드에 묶는다. 뒤로 가기·새로 고침은 유지한다.
- 모바일 단계 표시는 ko 녹화/전사/AI/검토/게시, en Record/Text/AI/Review/Publish다.
  각 단계의 접근성 이름은 기존 전체 이름과 검증 상태를 유지한다.
- 600px 이상의 기존 구조, 결정·후속 업무·인용·보존 정보, 모바일 상세 분석의
  기본 닫힘 상태와 사용자의 펼침 동작은 유지한다.
- 승인 원본인 390px에서는 결정 제목이 첫 화면 안에 보이도록 검증한다.
  추가 접근성 폭인 320px에서는 내용 삭제나 글자 축소 없이 전체 요약, 줄바꿈,
  수평 넘침 없음과 200% 글자 확대를 검증한다. 320px에서 첫 결정까지 반드시
  첫 화면에 넣었다고 주장하지 않는다.

## 측정과 직접 확인

동일 390×844, 한국어, WebKit, 동일 게시 결과 데이터에서 측정했다.

| 위치                      | 보정 전 | 보정 후 |
| ------------------------- | ------: | ------: |
| 첫 결정 제목 하단         |   842px |   661px |
| 고정 하단 내비게이션 상단 |   779px |   779px |

첫 결정 제목을 181px 위로 이동했다. 보정 후 핵심 요약 제목은 y=425px,
결정 제목은 y=637px이며, 첫 결정 본문도 초기 화면에 진입한다.

- 원본: `/Users/a10697/Work/DWP/output/meeting-design-review-30-2026-09-07/source/U08-M.png`
- 보정 전: `/tmp/dwp-meeting-recap-header-before-0907/video-meeting-recap-compac-56129-out-hiding-governed-details-mobile/U08-initial-viewport.png`
- 보정 후: `/tmp/dwp-meeting-recap-header-final-0907/video-meeting-recap-compac-56129-out-hiding-governed-details-mobile/U08-initial-viewport.png`
- 모든 폭·언어·브라우저의 좌표: `/tmp/dwp-meeting-recap-header-final-0907.json`
- 전체 문서·200% 캡처: `/tmp/dwp-meeting-recap-header-final-0907/`

## 기능·접근성 회귀

Node24 환경에서 수행했다.

- 신규 compact 8건: Chromium/WebKit × 390/320 × ko/en. 초기 정보 위치,
  5단계 유지, 200% 글자, 키보드 분석 펼침, 수평 넘침, serious/critical axe 0.
- 전사 2건: 근거 상세 펼침 전 원문 요청 0 → 키보드 펼침 후에도 원문 요청 0 →
  명시적인 접근 권한 확인 → 실제 조회/본문 검색/허가된 재생 시점 이동.
- AI intelligence 4건: 동일 의도 재시도, 검토/게시 중 권한 철회와 늦은 응답 차단,
  독립 검토자 배정·철회. 중복된 문구는 해당 회의 행·AI intelligence 영역으로
  locator를 한정했으며 실제 콘텐츠를 숨기거나 검증을 삭제하지 않았다.
- 기존 U07/U08 탐색·후보 연결·권한·모바일 우선순위 회귀 16건 PASS.
- recap/전사/인용 관련 단위 43건 PASS.
- scoped ESLint, i18n, design-system adoption, source-size PASS.

## 시각 기준과 운영 판정

기존 visual-quality `published AI recap` 2건은 런타임·키보드·접근성·넘침 검증을
모두 통과한 뒤 이전 골든 이미지 비교에서만 실패했다. 기준 PNG, 승인 원본,
허용 차이 임계값은 변경하지 않았다.

- desktop en dark: 기존 1440×1772 → 현재 1440×1850.
- mobile ko: 기존 390×2731 → 현재 390×1606.

이 전체 높이 차이에는 이전의 본문 구조 및 분석 펼침 변경도 포함되므로 이번
보정의 단독 성과로 합산하지 않는다. 이번 보정의 직접 비교 수치는 위 181px다.
증거는 `/tmp/dwp-meeting-recap-no-update-0907/`이며 기준 이미지 담당자에게 인계했다.

실제 LiveKit/녹화/STT/LLM/KMS 및 운영 보존·삭제 종단 검증의 기존 외부 NO-GO는
이 표시 개선이나 mock 기반 회귀로 해제하지 않는다.

## 중단 후 재검증과 원문 접근 경계 보강

2026-09-07 중단 재개 시 보존된 승인 원본 U08-D/M PNG를 직접 열어 정보 순서와
현재 초기 화면을 다시 대조했다. 이전 `/tmp/dwp-meeting-stitch.7J7N2b/` 추출 경로는
더 이상 존재하지 않았으나, 루트가 정본 ZIP을 복원한
`/tmp/meeting-resume-source.ZVbtmr/stitch_enterprise_grid_calendar_application/`에서
U08 desktop 569줄·mobile 351줄의 `code.html`도 끝까지 다시 읽었다. 보존 원본 PNG와
현재 실행 캡처는 별도 파일로 유지했다.

직접 대조에서 원본 4탭 중 후속 업무 탭을 누락한 것도 확인했다. 이 누락은 운영
제약이 아니므로 아래 추가 보정으로 닫았다. 공유 셸, 승인본 공유/감사/내보내기,
주최자·공식 개정 표시에는 여전히 차이가 있다. 현재 구현 회귀 기준의 검토는 원본
100% 승인이 아니다. 원본의 `user-scalable=no`·`maximum-scale=1`을 복사해 확대를
막거나, 샘플의 99.4% 신뢰도·FIPS 140-3·모의 재생 상태를 실제 사실로 표기하지 않는다.

모바일 헤더·결정/후속 조치 순서·키보드 상세 펼침은 유지되었으며, 새 기능이나
샘플 신뢰도·원문을 추가하지 않았다. 원문 접근을 다시 감사하면서 다음 실제 경계를
보강했다.

- 페이지를 읽은 뒤 다음 원문 페이지가 HTTP 410을 반환하면 이전 본문이 남아 있었다.
  새 단위 회귀에서 `Confidential transcript evidence`가 일반 오류 아래에 유지되는
  실패를 먼저 재현했다. 410을 401/403/404와 같은 권한·보존 철회로 처리하여 본문,
  검색 입력, 페이지 커서, 재생 시점 버튼을 모두 제거한다.
- 원문 상세를 닫거나 사용자/tenant/회의/산출물 버전이 바뀌면 기존의 응답 세대
  폐기와 함께 실제 HTTP 요청도 AbortController로 취소한다. 다시 열어도 이전 본문을
  복구하거나 자동 조회하지 않고, 사용자의 새로운 명시적 접근 행동을 요구한다.
- `queryVideoMeetingTranscript`는 옵션의 선택적 `signal`을 공통 HTTP transport
  config에 전달한다. 검색어는 여전히 POST 본문에만 있고 signal은 본문에 들어가지
  않는다. 공개 경로·응답·보존 및 현재 권한 검사 계약은 변경하지 않는다.
- 이미 응답한 구문은 원문 뷰어의 메모리에만 존재한다. 이 수정은 로그·저장소·URL에
  원문이나 토큰을 추가하지 않는다. 취소를 무시한 늦은 응답도 기존 세대 경계로 버린다.

재실행 증거:

- 기존 5개 U08 관련 spec: **60/60 PASS**, Chromium/WebKit, retry·PNG 갱신 없이
  `/tmp/dwp-u08-resume-verification-0907.json`과 동일 이름 디렉터리에 저장.
- 보강 원문 브라우저: **8/8 PASS**. 실제 `requestfailed` 이벤트로 닫힘 시 HTTP 취소를
  확인하고, 늦은 응답 폐기·새 명시적 접근·403/410 철회와 axe를 실행했다.
  `/tmp/dwp-u08-transcript-boundary-0907-r2.json`.
- recap source/candidate/intelligence model, 모바일 disclosure, 원문 runtime/API:
  **6 files / 54 PASS**. 원문 401/403/404/410 네 개 경계, 신원 변경 및 닫힘 취소 포함.
- scoped ESLint 0 오류·경고, source-size **1,774 production files PASS**, i18n PASS,
  scoped diff-check PASS. 전체 공유 트리 typecheck와 최종 통합 결과는 루트 기록과 구분한다.

원문 경계 보강의 production 변경은 `meeting-transcript-viewer.tsx`와
`video-meeting-transcript-api.ts` 두 파일이며, 관련 runtime/API 단위와
`e2e/video-meeting-transcript.spec.ts` 및 본 문서만 함께 수정했다. 승인 원본,
기준 PNG, 픽셀 임계값, 공통 셸, Gateway, OpenAPI 생성물은 수정하지 않았다.

## 누락된 네 번째 후속 업무 탭 복원

원본의 결과 요약 / 녹화·전사 / 후속 업무 / 자료·참석 탐색 구조에 맞춰
`MeetingRecapDetail`에 후속 업무 탭을 추가했다. 별도 조회나 가짜 데이터를 만드는
패널이 아니라 기존 `MeetingRecapOutcome`의 현재 권한이 확인된 후속 영역에 연결한다.

- 현재 게시 보고서의 실제 `actionItems.length`만 건수로 표시한다. 게시 결과를
  확인하지 못하면 숫자를 표시하지 않는다. 빈 보고서에는 실제 빈 상태가 나온다.
- 선택하면 해당 탭이 활성화되고 기존 후속 영역으로 스크롤하며 키보드 초점도
  함께 이동한다. overview 진입 또는 일반 재렌더링은 초점을 빼앗지 않는다.
- 모든 폭에서 원본의 네 탭 순서를 유지하고, 모바일은 가로 탐색으로 읽을 수 있다.
  390/320px 및 ko/en에서 후속 영역 제목이 상·하단 고정 내비게이션에 가려지지 않는다.
- 정확한 report ID를 유지하며 다른 최신 보고서를 읽지 않는다. 후보 검토·전체 관리는
  기존 동선을 이용하고 Work 명령 권한을 새로 부여하지 않는다. 403 뒤 영역과 건수,
  기존 실행 텍스트는 즉시 제거된다.
- `aria-controls`는 해당 영역이 실제 DOM에 존재할 때만 붙인다. 비활성 미디어/참석
  화면이나 실패 상태에 존재하지 않는 요소를 참조하지 않는다.

이 추가 보정은 `meeting-recap-detail.tsx`, `meeting-recap-outcome.tsx`, ko/en
`history.recap.tabs.followUps` 각 1개 키, 신규
`meeting-recap-follow-ups.runtime.test.tsx` 및 compact-header/library-design-actions/
recap-source E2E 세 파일에 한정된다. 원본 및 구현 기준 PNG는 변경하지 않았다.

- 새 탭 focus 단위 **3/3 PASS**.
- 탭 대상 **12/12 Chromium/WebKit PASS**, 1440/1280/390/320, ko/en, 실제 후속 건수,
  키보드·axe·넘침·정확 source 및 403 회귀. `/tmp/dwp-u08-four-tabs-0907.json`.
- 앞선 원문 보정의 전체 5개 spec은 fresh 1 worker로 **66/66 PASS (3.5분)**.
  `/tmp/dwp-u08-resume-final-0907-r2.json`. 직전 동시 HMR·부하 실행의 Loading page
  지연 6건은 이 성공 수에 섞지 않았고 timeout·원본·PNG 기준을 완화하지 않았다.
- 전체 공유 typecheck는 루트의 단일 최종 실행으로 인계했다. 중복 실행을 중단한
  로컬 typecheck는 PASS로 계산하지 않는다.

### 네 탭 반영 후 최종 안전 지점

- **68/68 PASS, 0 실패, 0 retry, 0 skip (4.5분)**. Chromium/WebKit 각 34개:
  AI 검토/철회 4 + 라이브러리/네 번째 탭 8 + compact header 8 + 정확한 원본 40 +
  원문 접근 8. `/tmp/dwp-u08-four-tabs-final-0907.json` 및 동명 캡처 디렉터리.
- 390/320 ko/en, desktop 1440/1280, 200% 글자, dark/forced-colors/reduced-motion,
  키보드 선택/상세 펼침, 고정 내비게이션과의 충돌, serious/critical axe 0을 포함한다.
- 원문/recap 모델·모바일 disclosure 54개와 새 후속 탭 runtime 3개, 총 대상 단위
  **57 PASS**. 새 탭 이후 scoped ESLint/Prettier/diff/i18n PASS,
  production source-size **1,781 files PASS**.
- 복원 ZIP의 원본 U08-D/M PNG와 기존 보존 원본의 SHA-256도 일치했다.
  D: `f2b8156e20111a211ccc876e02669ab56492cc35a48407dddd434ca9414a9c5b`,
  M: `e5bf93d863b7ac6553935999578e70d1a100cec91ca3e39492672b80a7aad5ff`.

실행은 번들 Node24 PATH에서 다음 정본 Playwright 설정을 사용했다. `:4476`은 같은
앱 설정을 상속하는 기존 테스트 전용 격리 Vite cache이며 보안/기능 플래그는 바꾸지
않았다. 최종 실행 뒤 이 검증 서버는 종료한다. 원본/임계값/기준 PNG 갱신은 하지 않았다.

```sh
E2E_BASE_URL=http://127.0.0.1:4476 E2E_REUSE_EXISTING_SERVER=true PLAYWRIGHT_OUTPUT_DIR=/tmp/dwp-u08-four-tabs-final-0907 PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/dwp-u08-four-tabs-final-0907.json corepack yarn playwright test e2e/video-meeting-recap-compact-header.spec.ts e2e/video-meeting-transcript.spec.ts e2e/video-meeting-intelligence.spec.ts e2e/video-meeting-library-design-actions.spec.ts e2e/video-meeting-recap-source.spec.ts --project=chromium --project=mobile --workers=1 --update-snapshots=none --trace=retain-on-failure --reporter=line,json
```
