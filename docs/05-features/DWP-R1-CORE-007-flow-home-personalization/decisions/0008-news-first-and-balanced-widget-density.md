# 0008. News-first hierarchy and balanced widget density

- 상태: Accepted — 2026-09-04 레퍼런스 보정 및 후속 와이드형 폭 복원 자동 검증 완료
- 기준일: 2026-09-03
- 정렬 계약 수정일: 2026-09-04
- 레퍼런스 충실도 보정일: 2026-09-04
- 와이드형 폭 복원일: 2026-09-04
- 대체 범위: Decision 0005·0007의 일반 News 후미 배치와 Dock 선행 정렬 규칙,
  본 결정 초기안의 대형 통합 Hero·하단 상태 Strip·가로 Task Grid·마지막 6+6 행 구성

## Context

사용자는 Home을 솔루션의 대표 진입면으로 보며, 로그인 직후 필수 공지뿐 아니라 최신 사내소식도
업무 위젯보다 먼저 접해야 한다. 기존 `Work Stage → Updates` 순서는 이 요구와 어긋났고, 넓은
화면에서 앱이 그룹 좌측에 몰리거나 우선 업무가 긴 한 줄 목록으로 늘어져 정보량보다 빈 공간이 더
크게 보였다.

첨부 레퍼런스와 Stitch 상세안은 다음 신호를 공통으로 제공한다.

- My App은 네 개의 명확한 업무 범주와 5열×2행 실행 밀도를 유지한다.
- 앱 Glyph는 작은 색점이 아니라 한눈에 구분되는 고대비 Surface를 사용한다.
- 처리할 업무·오늘 일정·답변 필요는 하나의 짧은 3분할 상태 Strip으로 연결한다.
- Home은 서로 다른 역할의 실데이터 Widget으로 채우되, 길고 성긴 전체 폭 목록은 피한다.

후속 사용자 확인에서 부분 행의 대칭 Slot 배치를 제외했다. 공간 균형은 공통 5열 Rail과 일정한
열 간격으로 해결하며, 앱 순서는 모든 행에서 첫 열부터 연속적으로 채워져야 한다.

## Decision

1. 읽기·DOM·Keyboard·Mobile 순서는 `Compact Context → My App Dock → 필수·Critical Rail(해당
시) → 일반 News → Personal Work Widgets`로 고정한다.
2. 일반 News는 조직 관리형 전체 폭 Editorial Row로 유지한다. 짝이 없는 부분 폭을 허용하지 않고,
   대표 1건과 보조 최대 2건의 콘텐츠 예산을 유지해 상단을 과점하지 않는다. 필수·Critical 항목은
   기존과 같이 News에서 중복 제거한다.
3. My App의 각 그룹은 고정 5열×2행을 유지한다. 모든 행은 저장·DOM 순서의 `index % 5 + 1`열을
   사용해 1열부터 연속 배치한다. 첨부 화면의 저장 순서에서 메신저·화상회의는 소식·캘린더 아래 1·2열, 서비스 2개는
   1·2열, 시스템 4개는 1~4열에 둔다. 읽기·편집 모드 모두 동일한 열 기준선을 유지한다.
   Tenant 기본 순서와 사용자 저장 순서는 재정렬하지 않는다.
   Desktop Glyph는 승인된 48px `glass` Surface, 좁은 화면은 기존 44px `soft` Surface를 쓴다.
4. Context의 세 상태는 `처리할 업무 / 오늘 일정 / 답변 필요`의 작은 반투명 3분할 Chip으로
   표시한다. 기본 Desktop에서는 인사말 오른쪽에 두며 실제 수치·Anchor·접근 가능한 이름과
   조작 영역을 유지한다. 인사말 아래의 큰 어두운 Toolbar로 표현하지 않는다.
5. 기본 Desktop의 우선 업무는 8열 주영역에서 제목·상태·다음 행동을 읽을 수 있는 세로 목록으로
   표시한다. 초기안의 최대 4열 compact task grid는 레퍼런스 보정 구성에 적용하지 않는다.
6. 기존 업무·일정·응답·요청·역할 Widget에 `집중 시간(focus-balance)`과 `회의 부하
(meeting-load)`를 독립 개인 Widget으로 추가한다. 두 Widget은 `/home/overview`의 Calendar
   metrics와 weekLoad만 사용하며 새 API·가짜 KPI를 만들지 않는다. 전문 Widget이 보일 때 같은
   Calendar 신호는 역할 현황에서 제거하고, 사용자가 전문 Widget을 숨기면 역할 현황에 복원한다.
7. 신규 Widget의 저장 기본값은 각각 `medium + short`를 유지한다.
   `quarter|compact|medium` 너비와 `short|standard` 높이만 허용하고, Registry·개인 저장
   allowlist·중앙 코드값을 같은 Release 계약으로 관리한다. 읽기 모드의 기본 Desktop에서는
   아래 8+4 배치의 오른쪽 보조 열에 표시하며, 표현용 폭을 개인 설정에 저장하지 않는다.

## 2026-09-04 레퍼런스 충실도 보정

사용자는 이전 전체 구성이 제공한 레퍼런스와 다르다는 이유로 수용하지 않았다. 이전 자동 Test의
통과는 기능 회귀 증거일 뿐 시각 설계의 사용자 승인이나 이번 보정의 검증 완료를 의미하지 않는다.
새 전체 화면 참고는 2026-09-04 오전 9.12.43 첨부 이미지다. 함께 전달된 큰 상태 Strip Crop은
원하는 디자인이 아니라 수정해야 할 현재 화면으로 해석한다.

- 주 사용자는 출근·업무 재진입 시 Home을 여는 구성원이다. 핵심 질문은 `조직 소식과 지금
처리할 업무는 무엇인가`이며, 주 행동은 소식 확인과 우선 업무 진입이다. 화면 유형은
  개인화 가능한 Command Center다.
- Hero는 인사와 상태 Chip을 담는 짧은 배너로 한정한다. Dock는 배너 밖의 독립 Surface로
  분리하고 Light Mode에서 밝은 바탕을 사용한다. Dark Mode·고대비는 각 Theme 계약을 유지한다.
- 균형형 기본 콘텐츠 폭은 최대 1680px로 제한한다. 집중형 1280px·와이드형 2560px은 아래
  후속 폭 복원 계약을 따른다. 가용 폭이 넓어져도 빈 공간을 메우려고 Typography·아이콘·Widget
  높이나 콘텐츠 예산을 확대하지 않는다.
- Viewport `>=1200px`이며 역할 기본 구성의 키·순서·가시성·기본 너비가 그대로인 경우에만
  다음 12열 기반의 `주영역 8 + 보조영역 4` 읽기 구성을 적용한다.

| 행  | 주영역 8열                                                | 보조영역 4열                  |
| --- | --------------------------------------------------------- | ----------------------------- |
| 1   | 우선 업무 `action-queue`                                  | 역할별 업무 현황 `role-pulse` |
| 2   | 오늘 일정 `today` 4열 + 답변·확인 요청 `response-hub` 4열 | 집중 시간 `focus-balance`     |
| 3   | 내 요청 현황 `request-tracker`                            | 오늘 회의 부하 `meeting-load` |

- 명시적 CSS Grid 행·열은 기본 읽기 화면의 표현 규칙이다. 저장 배열이나 DOM 순서를
  재정렬하지 않으며, 편집·개인 순서·숨김·너비 변경으로 기본 구성 조건을 벗어나면 기존
  saved-order Grid를 사용한다. 저장된 콘텐츠 깊이인 높이도 덮어쓰지 않는다. 좁은 화면과 큰
  글자 모드는 DOM 순서로 Reflow하고, Dense Packing으로 빈칸을 자동 재배치하지 않는다.
- `내 앱 → 필수확인(해당 시) → 사내소식`과 Dock 5열×2행·Row-major·저장 순서 보존은
  그대로 유지한다. 참고 이미지의 News 후미 위치보다 사용자의 명시적 상단 이동 지시가 우선한다.
- 레퍼런스의 연락처·홍보 카드 모양을 채우기 위해 가짜 구성원·프로모션·지표·업무를 추가하지
  않는다. 기존 7개 개인 Widget과 실제 Calendar·Contribution·Communications 데이터만 사용한다.

### 최종 밀도·가독성 보정

- 역할 현황은 기본 레퍼런스 구성에서 실제 보조 항목을 기본 최대 3개까지 표시한다. 지표가
  있다는 이유로 실제 항목을 1개로 줄인 뒤 한 행을 크게 늘리지 않는다. 저장한 콘텐츠 예산과
  높이별 표시 한도는 유지하며, 남은 항목은 기존 `더 보기`로 연결한다.
- 기본 읽기 구성의 빈 요청 카드와 로딩 완료 후 표시 일정이 3개 미만인 일정 카드는 내용의
  자연 높이로 시작 정렬한다. 옆 카드 높이를 맞추기 위해 빈 내부 영역을 강제로 늘리지 않으며,
  사용자 지정 배치·편집 모드·저장된 콘텐츠 높이 설정 자체는 바꾸지 않는다.
- Header의 갱신 시각은 단어 중간에서 끊기지 않게 유지한다. 상태 Chip과 편집 조작의 실제
  데이터·Anchor·접근 가능한 이름은 바꾸지 않는다.
- `<360px`에서는 집중·회의 그래프의 제목과 범례를 세로로 배치해 한국어 단어를 음절 단위로
  쪼개지 않는다. 숫자와 단위는 같은 묶음으로 유지한다. 수치 Typography와 막대의 기존 디자인
  Token, 실제 주간 수치, 접근 가능한 차트 설명·표, 상세 이동 경로는 그대로 둔다.
- 그룹 제목·설명 간격을 줄여 Dock의 불필요한 높이를 줄이되 48px Desktop Glyph와 5열×2행
  Row-major는 유지한다. 권한·개인 Pin 때문에 남는 Slot을 가짜 앱이나 저장 순서 변경으로 채우지
  않는다. 기존 Mobile 축약·큰 글자 Reflow 예외도 유지한다.

### 검증 상태

구현·설계 보정과 최종 자동 회귀 검증은 완료했다. 1440·1920px 표본에서 상단 분리와 8+4 위계를,
최신 320px 표본에서 그래프 제목·범례 및 값·단위 보정을 독립적으로 확인했다. 일정 카드의 자연
높이도 별도로 생성한 최신 Desktop Capture와 실제 Geometry로 확인했다. 이전
`7+5 / 4+4+4 / 6+6` 결과를 새 구성의 통과 증거로 재사용하지 않는다. 운영 배포·DB Migration
실행은 이 기록의 범위가 아니며 레퍼런스와 픽셀 단위로 동일하다고 주장하지 않는다.

2026-09-04 레퍼런스 보정의 최종 실행 결과이며, 아래 후속 와이드형 폭 복원 이전의 증거다:

- Home 단위 Test: 62 files / 469 passed.
- `flow-home-visual.spec.ts`: 62 passed / 62 project-specific skipped. 최종 실행에서 Snapshot을
  갱신하지 않고 비교 검증을 통과했다.
- Flow Home + Calendar Insight 통합 회귀: 80 passed / 30 project-specific skipped.
- 전체 TypeScript: 11:53 실행 passed. Home 범위 ESLint와 Source-size·Maintenance Source-size
  검사도 passed.
- 전체 Design-system 검사에는 다른 DWAI·ON·Notifications·Work 등 작업 영역의 회귀 29건이
  남아 있다. Home 범위 지적은 없으며, 이를 전체 저장소 Gate 통과로 표현하지 않는다.
- 최종 시각·통합 검증은 필요한 두 Home Flag를 활성화한 전용 로컬 서버 `4391`에서 실행했다.
  공용 `4200`의 Flag 미설정으로 발생한 VIEWS 단일 실패는 실행환경 문제로 분리했다. 공용 서버
  설정을 수정하거나 재시작하지 않았으며 전용 환경에서 전체 범위를 다시 검증했다.
- 일정 자연 높이 추가 검증은 Balanced·Focused·Expressive 1440px 3건과 마지막 실제 Capture
  1건이 통과했다. 최종 Ready·Launcher Clearance 확인 후 `visible=2`, `sparseMarker=true`,
  카드 높이 `178.671875px`, 마지막 항목 아래 여백 `9px`를 측정했다. 표시 항목이 1~2개일 때
  Sparse Marker와 하단 여백 `<=24px`를 요구하도록 Geometry 단언도 강화했다.
- 해당 실행의 고유 로컬 증거:
  [reference-home-1440.png](/tmp/dwp-home-final-reference-capture/flow-home-visual-Flow-Home-57ba3-esktop-1440-visual-baseline-chromium/reference-home-1440.png).
  임시 검증 경로이며 운영 배포 자산이나 이전 Baseline 파일이 아니다.

- [x] 1440·1920px에서 짧은 Hero·독립 Dock·오른쪽 상태 Chip·8+4 위계를 실제 Capture로 확인한다.
- [x] 최신 320px에서 그래프 제목·범례와 값·단위 보정이 읽히는지 확인한다.
- [x] 최신 Desktop Capture에서 항목이 적은 일정 카드의 자연 높이를 확인한다.
- [x] 1280px, 390px, 320px, 200% 글자 확대의 가로 넘침·겹침 자동 회귀를 검증한다.
- [x] 기본 구성 적용, 사용자 순서·숨김·너비·높이 저장, 편집·취소·재진입의 보존을 검증한다.
- [x] 필수확인 직후 News, Dock 5×2 Row-major, Keyboard 순서와 접근 가능한 이름을 검증한다.
- [x] 실제 데이터의 빈 상태·권한 없음·부분 실패와 Light/Dark·고대비·Reduced Motion을 검증한다.

위 체크는 이번 구현의 자동 검증·지정 Capture 확인 범위다. 실기기·보조기술 수동 QA와
Product·Design·운영 승인은 별도 출시 조건으로 유지한다.

### 후속 보정: 갱신 시각의 단일 표시

2026-09-04 사용자 확인에서 상단 `업데이트`와 하단 `마지막 새로고침`의 중복을 정리했다.
상단은 여러 업무 소스의 갱신 상태와 지연·부분 실패·재시도를 함께 제공하지만, 기존 하단은
업무 목록의 생성 시각을 별도로 표시해 같은 값의 반복 또는 서로 다른 시각의 혼동을 만들었다.

- 실제 Flow Home이 렌더링된 경우 갱신 시각은 상단에만 표시한다. 상단의 갱신 중 상태,
  접근성 알림, 소스별 오류 설명과 재시도는 변경하지 않는다.
- 하단은 접근 권한 내 데이터라는 범위 안내와 기존 정책·도움말 링크만 유지한다.
- Classic Home과 초기 로딩·오류 화면은 상단 갱신 표시가 없으므로 기존 하단 시각을 유지한다.
  조건은 기능 활성화 여부만이 아니라 `ready && editorFlowHomeEnabled`로 실제 상단 렌더링과 일치시킨다.

검증: 관련 단위 17개, 전용 Footer 브라우저 회귀 9개, 변경된 Flow 전체 화면 시각 회귀 16개
(최종 Snapshot 갱신 없이 비교) 통과. 1440·1280·390·320px, 한국어·영어, 200% 글자·Dark·
Forced Colors, 키보드 재시도, Classic·로딩·오류 및 로딩 후 Flow 전환을 확인했다.
TypeScript·범위 ESLint·i18n·Source-size 검사도 통과했다.

### 후속 보정: 와이드형 실제 폭 복원 — 자동 검증 완료

레퍼런스 보정에서 균형형과 와이드형을 모두 최대 1680px로 제한한 것은 표현 유형의 의도와
어긋났다. 기존 8+4 정보 위계는 유지하고, 와이드형이 큰 Viewport에서 실제로 확장되도록 최대
폭만 복원한다. 1680px은 모든 유형의 상한이 아니라 균형형 기본 상한이다.

- 공통 `HOME_PRESENTATION_MAX_WIDTH`는 `focused: 1280`, `balanced: 1680`,
  `expressive: 2560`이다. Flow의 폭 CSS 변수는 이 계약에서 한 번만 설정한다.
- Viewport `>=1800px`에서 유형과 무관하게 최대 폭을 덮어쓰는 규칙은 제거한다. 균형형은 큰
  화면에서도 1680px 상한을 유지하고, 와이드형만 2560px 상한까지 가용 공간을 사용한다.
- 초기 로딩의 `layout.maxWidth`도 같은 공통 계약을 사용해 로딩·완료 상태 간 폭 정책을
  일치시킨다. 유형별 최대 폭은 고정 너비가 아니며 화면 가용 폭보다 커지지 않는다.
- 1440px처럼 가용 폭이 두 상한보다 작은 화면에서는 균형형·와이드형 차이가 작거나 없을 수
  있다. 차이를 보여주려고 글자·아이콘·카드 높이·표시 항목 수를 임의로 바꾸지 않는다.
- 8+4 적용 조건·행 구성, Dock 5열×2행·Row-major, 필수확인 직후 News, 저장·DOM 순서,
  사용자 지정 Grid, 저장 높이·콘텐츠 예산과 실데이터 흐름은 변경하지 않는다.

이번 폭 복원 이후의 별도 검증 결과:

- 관련 Policy·Layout 단위 Test 26 passed. 전체 Home·Launchpad·Workspace Widget Catalog
  단위 Test 63 files / 475 passed. 관련 단위 결과는 전체 결과에 중복 합산하지 않는다.
- 기존 Wide·Cold Loading·Balanced 및 1440·1280·390·320px·200% 글자 확대 Main E2E
  11 passed / 11 expected project-specific skipped.
- 1920px Wide 및 200% 글자 확대 시각 회귀 11 passed / 11 expected project-specific skipped.
  Snapshot 갱신 후 비교 검증만 별도로 재실행했으며, 최종 비교 실행에서는 갱신하지 않았다.
- 신규 `e2e/home-wide-presentation.spec.ts`는 `LEGACY / VIEWS × 1920 / 2560px`에서
  실제 편집 선택·취소·저장·Reload와 초기 로딩·완료 본문의 폭 일치를 검증했다.
  4 passed / 4 desktop-only skipped. 전체 페이지 Capture 방식으로 최종 재실행도 통과했으며,
  1920px 일반 화면과 2560px 편집 화면을 직접 확인했다. 재실행은 중복 합산하지 않는다.
- TypeScript·범위 ESLint·Source-size 검사 통과.

위 레퍼런스·Footer 보정의 완료 수치는 이전 실행 증거로 유지하며 이번 폭 복원 결과와
구분한다. 운영 배포는 수행하지 않았다. 수동 QA·Product/Design 승인이나 다른 작업 영역의
전체 저장소 Gate까지 통과했다고 주장하지 않는다.

## Consequences

- 사내소식은 필수확인 직후 노출돼 조직 정보 도달성이 높아진다.
- 5×2 계약과 개인 저장 순서를 유지하면서 부분 행도 첫 행의 동일 열에 정렬된다.
- 기본 Desktop에서는 우선 업무와 요청 흐름을 주영역으로, 상태·집중·회의 정보를 보조영역으로
  구분해 실제 정보량에 맞는 위계를 만든다. 짧은 Hero와 분리된 Dock는 업무 진입면을 확보한다.
- 집중 시간과 회의 부하는 보조 열의 독립 Widget으로 표시하며, 각자 숨김·순서·허용 크기를
  독립 저장할 수 있다. 사용자 지정 배치에서는 해당 저장 계약을 우선한다.
- News가 위로 이동하므로 첫 Viewport 업무 노출은 News 콘텐츠 예산과 반응형 회귀 Test로 보호한다.
- 기존 5개 저장 레이아웃은 정규화 과정에서 두 Widget을 뒤에 보충하며, 기존 항목의 순서·가시성·
  크기 설정은 덮어쓰지 않는다.

## Deployment and rollback

- Frontend보다 Backend의 확장된 `HomeLayoutPolicy` allowlist와 V221 Migration을 먼저 배포한다.
- `focus-balance`·`meeting-load`가 포함된 개인 설정이 저장된 뒤 Frontend를 Rollback하더라도,
  Backend의 확장된 `HomeLayoutPolicy` allowlist는 유지한다. 변경 전 Backend는 저장된 신규
  Widget Key를 거부하므로 함께 되돌리지 않는다. 사용자 설정 삭제나 Flyway Down Migration은
  Rollback 수단으로 사용하지 않는다.
