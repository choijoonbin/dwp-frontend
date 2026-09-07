# DWP-R1-CORE-007 Flow Home Personalization

- 상태: `Home v2 reference-fidelity and wide presentation restoration verified`
- Gate: `2026-09-04 reference-fidelity·wide-width regression passed / manual QA·G0-G3 approval pending`
- 준비도: `release review pending`
- 구현 상태: `Phase 1·2 capability preserved; slim Hero·standalone Dock·8+4 composition correction implemented`
- Owner: DWP Product Experience / Shared Experience Platform
- Roadmap: R1 Flow Home vNext (`R1-24`)
- 적용 저장소: `dwp-frontend`, `dwp-backend`
- 기준일: 2026-09-04

## 목적

기존 Personal Home의 핵심 가치인 권한 기반 앱 실행, 구조화된 앱별 알림과 사용자 Pin·Folder를
유지하면서 로그인 직후 `지금 무엇을 처리하고 무엇을 준비할 것인가`를 선별하는 **Daily Work
Launch & Triage형 DWP Flow Home**으로 고도화한다. 사용자가 Home Widget 위에 포인터를 둔
상태에서도 문서 아래로 계속 이동하도록 Home의 세로 스크롤 소유권을 페이지 하나로 통일한다.

이번 Package는 기존 Home 편집 기능을 제거하거나 자유 배치형 Page Builder로 교체하는
계획이 아니다. 명시적 편집 버튼, 길게 누르기, Drag 이동, 비 Drag 메뉴·Keyboard 대체 조작,
앱 Folder, 표시·숨김, 승인된 크기, 저장·취소·초기화를 유지하고 Undo·Redo와 Device Preview를
보강한다.

## 제품 결정 요약

1. 전체 읽기 순서는 `Compact Context → My App Dock → 필수·Critical Rail(해당 시) → 일반
News → Personal Work Widgets`다. 필수 Rail이 없을 때도 News가 앱 다음에 이어진다.
2. 기본 Desktop Work Stage는 `>=1200px`의 기본 구성에만 `주영역 8 + 보조영역 4`를 적용하고
   콘텐츠 최대 폭은 집중형 1280px·균형형 1680px·와이드형 2560px로 구분한다. 주영역은 `우선 업무 → 오늘 일정·답변 요청 → 내 요청
현황`, 보조영역은 `역할별 업무 현황 → 집중 시간 → 오늘 회의 부하`다. 저장·DOM 순서를
   바꾸지 않고 사용자 지정 구성은 기존 saved-order Grid로 돌아간다. 좁은 화면과 큰 글자 모드는
   DOM 순서로 Reflow한다.
3. `Compact Context`는 짧은 Hero로 두며 상태 3분할 Chip을 기본 Desktop 인사말 오른쪽에
   배치한다. `My App Dock`는 Hero 밖의 독립 Surface이며 Light Mode는 밝게 표현한다. 네 그룹은
   각각 고정 5열×2행·최대 10개 계약을 유지하고, 모든 행을 1열부터 연속 배치한다. 부분 행도
   저장·DOM 순서의 `index % 5 + 1`열을 사용하며, 읽기·편집 모드의 열 기준선을 일치시킨다.
   Dock은 권한·Tenant 정책·사용자 Pin을 순서대로 적용한다.
4. Home 본문 Widget은 같은 축의 독립 세로 스크롤을 만들지 않는다. 콘텐츠 예산을 넘는 정보는
   요약하고 `전체 보기`로 원본 업무 화면에 연결한다.
5. 일반 소식은 필수 Rail 직후의 compact Editorial Row로 배치하고, 확인 필수 또는 Critical
   항목은 얇은 Rail로 분리해 중복 노출하지 않는다. `required`는 확인 필수 의미를 유지하고, 전체 활성 피드의
   `criticalUnread`·`actionable`과 일반 표본에 독립적인 `actionableItems`를 사용한다. Home CTA의
   목적 화면도 같은 Action 항목을 별도 Rail로 이어 보여주고 일반 소식과 중복하지 않는다.
6. `FORBIDDEN`, `UNAVAILABLE`, `PARTIAL`, 날짜 불일치와 Badge의 urgent·actionable·unread를
   데이터 손실 없이 구분한다. Notification Summary Cache·Refetch와 `generatedAt`
   Freshness는 각각 30초 예산을 사용하며, 권한 없음·Query 오류·오래된 성공 응답은
   이전 Badge를 재사용하지 않고 Fail Closed한다.
7. 영구 Assistant Rail과 Home Header Assistant를 두지 않고 DWAI·ON을 우측 하단 Floating
   Launcher로 통일한다. 최초 Aura·Float·Greeting Motion과 Reduced Motion 대응을 유지하고,
   Footer 조작 요소와 겹치면 위로 자동 회피한다. Tenant Logo는 제품명 우측에 표시하고 실패하면
   조직명으로 수렴한다.
8. 개인화는 임의 좌표 Canvas가 아니라 권한과 관리 정책 안의 `bounded personalization`이며,
   AI 제안에는 이유·Diff·Preview·승인·Undo가 필수다.
9. 개인 Widget Registry는 기존 5종에 `focus-balance`, `meeting-load`를 더한 7종이다. 두 신규
   Widget은 `medium + short` 기본값, 제한된 너비·높이 계약, 별도 표시·숨김·이동 저장을 가지며
   역할 현황과 같은 Calendar 신호를 동시에 중복 표시하지 않는다.

세부 결정은 다음 기록을 따른다.

- [Flow Home 정보 구조](decisions/0001-flow-home-information-architecture.md)
- [단일 문서 스크롤](decisions/0002-single-document-scroll-and-widget-overflow.md)
- [제약형 개인화와 AI 제안](decisions/0003-bounded-personalization-and-ai-suggestions.md)
- [Visual v1.1과 안전한 편집 세션](decisions/0004-flow-home-visual-v1-1-and-safe-editor.md)
- [Flow Home v2 Daily Work Launch & Triage](decisions/0005-flow-home-v2-daily-work-launch-and-triage.md)
- [Critical design audit and Home v2 correction](decisions/0006-critical-design-audit-and-home-v2-correction.md)
- [Adaptive wide, governance and interaction hardening](decisions/0007-adaptive-wide-governance-and-interaction-hardening.md)
- [News-first hierarchy and balanced widget density](decisions/0008-news-first-and-balanced-widget-density.md)

## 단계별 범위

| 구분 | 목표                                | 포함 범위                                                                                                               | 제외·후속                                         |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1차  | Flow Home 전환과 안전한 개인화 기반 | 새 정보 구조, 단일 문서 스크롤, 기존 편집 동작 보존, 전체 L2 구조 개인화, 선택 L3 시각 Preset, 접근성·관측·Feature Flag | 복수 Home, 공유 Template, AI 자동 제안            |
| 2차  | 개인 업무환경 확장                  | 복수 개인 Home, 고급 콘텐츠 설정, 공유 Template, Device별 고급 Layout, Version History, AI Workstyle Composer           | 임의 HTML·Script·CSS, 권한 우회, 무승인 자동 배치 |

## 산출물

- [근거 및 글로벌 벤치마크](00-근거%20및%20글로벌%20벤치마크.md)
- [기획 정의](01-기획%20정의.md)
- [화면 설계서](02-화면%20설계서.md)
- [디자인 정의](03-디자인%20정의.md)
- [데이터 설계](04-데이터%20설계.md)
- [API·권한 계약](05-API%20권한%20계약.md)
- [AI Agent 계약](06-AI%20Agent%20계약.md)
- [수용 테스트](07-수용%20테스트.md)
- [개발 백로그 및 추적 매트릭스](08-개발%20백로그%20및%20추적%20매트릭스.md)
- [롤아웃·관측·롤백 계획](09-롤아웃%20관측%20롤백%20계획.md)
- [구현 및 검증 결과](10-구현%20및%20검증%20결과.md)
- [Figma·계약 초안 및 시각 증거](assets/README.md)
- [OpenAPI 증분 계약 초안](assets/flow-home-api-delta.openapi.yaml)
- [Home Analytics Event Schema 초안](assets/home-analytics-event.schema.json)
- [수용 테스트 Fixture 초안](assets/flow-home-test-fixtures.json)

## 기존 기준선과 관계

- `DWP-R1-CORE-002-personal-home-experience`는 구현된 Personal Home Shell, Tenant Media,
  App Launcher, 공지와 Preference 기준선으로 보존한다.
- 본 Package는 `workspace-home`의 정보 순서, 시각 계층과 Widget Overflow 동작만 후속
  정의한다. Shell·Entitlement·App Registry·Tenant Governance·Audit 계약은 폐기하지 않는다.
- 공통 Personal Home Composer의 순서 보존형 Grid와 승인 Component Registry는 유지한다.
  기존 Desktop 고정 높이 내부 Scroll 규칙만 `workspace-home`에서 부분 대체한다.
- 기존 체크된 수용 테스트는 이전 구현 증거이며 본 Package의 미실행 수용 테스트를 대신하지
  않는다.

## 디자인 증거 상태

- 2026-09-04 레퍼런스 충실도 보정의 코드·설계 및 최종 자동 회귀 검증은 완료했다. 상단·8+4
  구조와 320px 그래프 문구를 독립 확인했고, 항목이 적은 일정 카드도 고유한 최신 Capture와
  실제 높이 측정으로 확인했다. 아래 이전 Capture 및 자동 Test 기록은 새 구성의 검증이나 사용자 승인을 대신하지
  않는다.
- 그 이후 적용한 와이드형 실제 폭 복원도 별도 단위·브라우저·시각 회귀를 통과했다. 아래
  레퍼런스 보정의 통과 수치나 Capture를 폭 변경의 증거로 재사용하지 않고 후속 결과를 구분한다.
- v1 참고 File: [DWP Flow Home — Development Ready v1](https://www.figma.com/design/WKo4pIiHeCvFLcVgMHzgMn)
- [`01 Screens / Desktop / Default / 1440`](https://www.figma.com/design/WKo4pIiHeCvFLcVgMHzgMn/DWP-Flow-Home-Development-Ready-v1?node-id=6-2):
  작성 및 시각 검증 완료
- 이 Figma는 v1 참고 증거이며 v2 4+8 Action Stage의 최종 승인 Frame으로 간주하지 않는다.
- v2 Desktop·Mobile·Edit·상태 Frame과 독립 Design·Accessibility 승인은 대기 상태다.
- 이전 2560·1920·1440 Desktop Capture와 편집 상태는 내부 Product/UX·Visual Design·
  Interaction/Accessibility 전문 Agent의 비판적 재검증에서 P0·P1 0건으로 통과했다.
- 외부 상용 Design AI의 독립 검증을 완료했다고 주장하지 않는다.

## 2026-09-04 레퍼런스 충실도 보정 — 자동 검증 완료

사용자는 이전 전체 구성이 첨부한 레퍼런스와 다르다며 수용하지 않았다. 큰 통합 Dark Hero와
인사말 아래 Toolbar, `7+5 / 4+4+4 / 6+6` 띠형 배치를 새 기본안으로 유지하지 않는다. 새 전체
화면 참고는 2026-09-04 오전 9.12.43 첨부 이미지이며, 큰 상태 Strip Crop은 원하는 안이 아니라
수정 대상인 현재 화면이다.

- 짧은 Hero와 독립된 밝은 Dock, 인사말 오른쪽의 작은 반투명 상태 Chip으로 상단 위계를
  수정한다. 실제 상태 수치·Anchor·접근 가능한 이름은 유지한다.
- `>=1200px`의 기본 구성에 다음 8+4 위계를 적용한다. 1680px은 균형형 기본 최대 폭이며,
  집중형·와이드형의 최대 폭은 아래 후속 보정의 단일 폭 계약을 따른다.

| 행  | 주영역 8열                                                | 보조영역 4열                  |
| --- | --------------------------------------------------------- | ----------------------------- |
| 1   | 우선 업무 `action-queue`                                  | 역할별 업무 현황 `role-pulse` |
| 2   | 오늘 일정 `today` 4열 + 답변·확인 요청 `response-hub` 4열 | 집중 시간 `focus-balance`     |
| 3   | 내 요청 현황 `request-tracker`                            | 오늘 회의 부하 `meeting-load` |

- CSS Grid 표현만 보정한다. 역할 기본 키·순서·가시성·너비가 아닌 사용자 구성과 편집 모드는
  기존 saved-order Grid를 사용하며 저장 배열·DOM 순서·콘텐츠 높이를 재작성하지 않는다.
- `내 앱 → 필수확인(해당 시) → 사내소식`과 각 앱 그룹의 5열×2행·Row-major를 유지한다.
  부분 행은 첫 열부터 저장 순서대로 채우며, 화면을 채우려고 앱을 재정렬하지 않는다.
- 기존 7개 개인 Widget과 실제 데이터만 사용한다. 레퍼런스의 인물·홍보 카드·수치를 가짜
  콘텐츠로 재현하지 않는다. 집중·회의 전문 Widget과 역할 현황의 신호 중복 방지도 유지한다.
- 역할 현황의 실제 보조 항목은 기본 최대 3개까지 노출한다. 로딩 완료 후 일정이 3개 미만인
  카드와 빈 요청 카드는 기본 읽기 구성에서 자연 높이를 사용해 강제 확장된 빈 내부 공간을
  줄인다. 저장한 콘텐츠 깊이·표시 예산·더 보기·개인 배치 계약은 유지한다.
- 갱신 시각은 단어 중간의 줄바꿈을 방지한다. `<360px`의 집중·회의 그래프 제목·범례는
  세로로 정리하고 값·단위를 같은 묶음으로 유지한다. 기존 수치·막대 디자인 Token과 실제 데이터,
  차트 설명·표·상세 이동은 변경하지 않는다.
- 1440·1920px 표본의 상단·8+4 구조와 최신 320px의 좁은 그래프 문구를 독립적으로 확인했다.
  최종 자동 회귀와 일정 카드 자연 높이의 최신 Desktop Capture·실제 Geometry 확인도 완료했다.
  이전 수치를 새 구성의 검증으로 간주하지 않는다.
- 이 보정은 실제 데이터 흐름과 저장 계약을 유지한 제품 구성 변경이다. 레퍼런스와 픽셀 단위로
  동일하다거나 운영 배포·DB Migration이 완료됐다고 주장하지 않는다.

설계 변경 이유·적용 조건·미실행 검증 항목은
[Decision 0008 보정](decisions/0008-news-first-and-balanced-widget-density.md#2026-09-04-레퍼런스-충실도-보정)을 따른다.

### 이번 보정의 최종 자동 검증 결과

아래는 와이드형 실제 폭 복원 이전 레퍼런스 보정의 완료 증거다.

- Home 단위 Test: 62 files / 469 passed.
- 전체 Flow 시각 회귀: 62 passed / 62 project-specific skipped. 최종 실행은 Snapshot 갱신 없이
  비교 검증을 통과했다.
- Flow Home + Calendar Insight 통합 회귀: 80 passed / 30 project-specific skipped.
- 전체 TypeScript는 11:53 실행에서 통과했다. Home 범위 ESLint와 Source-size·Maintenance
  Source-size 검사도 통과했다.
- 전체 Design-system 검사에는 다른 DWAI·ON·Notifications·Work 등 작업 영역의 회귀 29건이
  남아 있다. Home 범위 지적은 0건이며, 전체 저장소의 디자인 Gate나 전체 Production Build가
  통과했다고 주장하지 않는다.
- 최종 시각·통합 실행은 두 Home Flag를 활성화한 전용 로컬 서버 `4391`을 사용했다. 공용
  `4200`의 Flag 미설정에 따른 VIEWS 단일 실패는 실행환경 문제로 분리했고, 공용 서버를 수정·
  재시작하지 않은 채 전용 환경에서 전체 검증을 다시 통과했다.
- 일정 자연 높이 추가 검증은 Balanced·Focused·Expressive 1440px 3건과 최종 실제 Capture
  1건이 통과했다. Ready·Launcher Clearance 확인 후 표시 2개·Sparse Marker 활성·카드 높이
  `178.671875px`·하단 여백 `9px`를 확인했다. 표시 1~2개이면 Marker와 하단 여백 `<=24px`를
  요구하는 Geometry 단언을 적용했다.
- 고유 로컬 증거:
  [reference-home-1440.png](/tmp/dwp-home-final-reference-capture/flow-home-visual-Flow-Home-57ba3-esktop-1440-visual-baseline-chromium/reference-home-1440.png).
  별도 실행의 임시 Capture이며 이전 Baseline이나 운영 배포 자산이 아니다.
- 실기기·보조기술 수동 QA, 사람의 Product·Design 승인과 운영 배포는 위 자동·Capture 결과에
  포함하지 않는다.

## 2026-09-04 후속 보정: 와이드형 실제 폭 복원 — 자동 검증 완료

레퍼런스 보정에서 균형형과 와이드형을 1680px로 제한해 두 유형의 실제 폭 차이가
사라졌다. 1680px은 균형형 기본 최대 폭으로 정정하고, 와이드형이 큰 화면의 가용 폭을 사용할
수 있도록 표현 유형별 최대 폭을 복원한다.

- 공통 `HOME_PRESENTATION_MAX_WIDTH`를 `focused: 1280`, `balanced: 1680`,
  `expressive: 2560`으로 정의한다. Flow의 콘텐츠 폭 CSS 변수는 이 계약에서 한 번만 설정하며,
  `>=1800px`에서 선택 유형과 무관하게 폭을 덮어쓰는 규칙은 두지 않는다.
- 초기 로딩도 같은 계약의 `layout.maxWidth`를 사용한다. 준비 화면과 실제 Home이 서로 다른
  최대 폭을 사용하지 않도록 한다.
- 최대 폭은 고정 너비가 아니다. 실제 폭은 Viewport의 가용 폭 안으로 제한되므로 1440px에서는
  균형형과 와이드형의 차이가 작거나 없을 수 있다. 차이를 만들기 위해 글자·아이콘·높이·항목
  수를 임의로 확대하지 않는다.
- 기본 8+4 배치와 적용 조건, Dock 5열×2행·Row-major, News의 필수확인 직후 위치, 저장·DOM
  순서, 사용자 지정 Grid와 높이·콘텐츠 예산은 그대로 유지한다. API·실데이터 계약도 변경하지 않는다.

이번 폭 복원 이후 별도 실행한 검증 결과:

- 관련 Policy·Layout 단위 Test: 26 passed. 전체 Home·Launchpad·Workspace Widget Catalog
  단위 Test: 63 files / 475 passed. 관련 단위 결과는 전체 결과에 중복 합산하지 않는다.
- 기존 Wide·Cold Loading·Balanced 및 1440·1280·390·320px·200% 글자 확대 Main E2E:
  11 passed / 11 expected project-specific skipped.
- 1920px Wide 및 200% 글자 확대 시각 회귀: 11 passed / 11 expected project-specific
  skipped. 변경된 Snapshot을 갱신한 뒤, 갱신하지 않는 비교 검증만 별도로 재실행해 통과했다.
- 신규 `e2e/home-wide-presentation.spec.ts`: `LEGACY / VIEWS × 1920 / 2560px`에서 실제
  편집 선택·취소·저장·Reload 및 초기 로딩과 본문의 폭 일치를 검증해 4 passed /
  4 desktop-only skipped. 전체 페이지 Capture 방식으로 최종 재실행도 통과했으며,
  1920px 일반 화면과 2560px 편집 화면을 직접 확인했다. 재실행은 중복 합산하지 않는다.
- TypeScript·범위 ESLint·Source-size 검사 통과. 이전 레퍼런스 보정의 469개 단위·62개 시각·
  80개 통합 회귀는 각 시점의 증거로 보존하며, 이번 결과로 그 실행 범위나 수치를 덮어쓰지 않는다.
- 운영 배포는 수행하지 않았다. 수동 QA·Product/Design 승인 및 다른 작업 영역의 전체
  저장소 Gate 현황은 위 자동 검증과 별개다.

## 2026-09-04 Home 밀도·앱 정렬 보강 — 이전 구성의 증거

아래는 레퍼런스 충실도 보정 이전 구현과 Test 기록이다. 앱 정렬·실데이터 계약은 유지하지만,
가로 Task Grid와 6+6 인사이트 행의 시각 구성은 위 보정으로 대체한다.

- `내 앱 → 필수확인(해당 시) → 사내소식 → 개인 업무 Widget` 순서를 반영했다.
- Desktop 앱 그룹은 5열×2행을 유지하며 모든 행을 첫 열부터 연속 배치한다. 부분 행을 분산하던
  계산 함수와 개별 열 지정은 제거했다. 저장 순서와 읽기·편집 모드의 열 기준선은 보존한다.
- 우선 업무는 넓은 화면에서 compact 비교형 Grid로 표시한다. `집중 시간`과 `오늘 회의 부하`를
  실제 Calendar 계약에 연결된 독립 Widget으로 추가해 기본 개인 Widget을 7개로 보강했다.
  주간 집중·회의 집계와 오늘의 회의 부하를 구분하며 전문 Widget을 숨기면 역할 현황에 신호를
  복원한다.
- 320·390px, 1440·1920px 및 1280px/200% 글자 확대를 점검했다. 오류·권한·빈 상태, 재시도,
  키보드 조작, 다크·강제 색상, 긴 한국어·영어 문구를 회귀 검증한다.
- Home·Launchpad·Catalog 단위 Test: 58 files / 403 passed. Backend Home Test: 78 passed.
- Flow Home 및 Calendar Insight 통합 회귀: 80 passed / 30 project-specific skipped.
  Desktop 실시간 Resize와 Native Mobile 초기 Viewport를 분리해 앱 열 정렬·넘침·저장 복원을 검증했다.
- 전체 Flow 시각 회귀: 62 passed / 62 project-specific skipped. 변경된 스크린샷을 직접 점검한 뒤
  기준 이미지 갱신 없이 전체 비교 검증을 통과했다.
- 전체 TypeScript, Home 범위 ESLint·Prettier, i18n·Display Dictionary, Feature/API 경계,
  Import Cycle·Reachability·Internal Export 검사와 Maintenance Source Size 검사를 통과했다.
- 동시 작업의 Calendar Prop 계약 오류는 소유 작업에 전달해 해소된 뒤 전체 TypeScript를 다시
  통과했다. 공용 ProgressMeter 변경 이후 강제 색상·200% 시각 표본 3건도 이미지 갱신 없이 통과했다.
- Home Source Size 위반은 없다. 공유 Worktree 전체 Source Size 검사에는 다른 작업의
  `notification-center.tsx` 1021줄/1000줄 초과 1건이 남아 있으며 이 Feature에서 수정하지 않았다.
- 운영 배포나 DB Migration 실행은 이 검증에 포함하지 않는다. Backend/V221 선배포 및
  Frontend Rollback 시 확장된 Widget allowlist 유지 절차는
  [Decision 0008](decisions/0008-news-first-and-balanced-widget-density.md)을 따른다.

## v2 통합 자동 검증

- Frontend Vitest 전체 92 files / 405 tests 통과. Flow·Editor·Personalization·Badge Policy·
  Home History localization, Communications Action Rail과 API Rolling Fallback을 포함한다.
- `flow-home.spec.ts` Chromium 41 passed / 9 skipped
- `flow-home.spec.ts` Mobile 34 passed / 16 skipped
- Communications + Flow Home Chromium 44 passed / 9 skipped
- 신규 Home→소식 Action Journey Mobile 표본 2/2 passed
- DWAI·ON Chromium 5/5와 Home Footer 충돌 회피 1/1 passed. 최초 Motion의 실제 Animation Clock
  진행과 Reduced Motion 정지를 함께 검증한다.
- Backend Communications·Home 관련 15/15, Frontend API 경계 4/4 passed
- Production `yarn build` 전체 Gate: Architecture·Route·Feature·API·Source-size·Design System·i18n·
  Display Dictionary·ESLint·TypeScript·Vite·Bundle Budget passed
- E2E는 2560px Adaptive Recomposition, Mobile 상위 4개 Dock·첫 CTA, 개별 Source Freshness·시간 경과, 확인 완료된
  Required Rail 제거, Work-only Route, `UNAVAILABLE`·`FORBIDDEN` 의미 분리, Mobile
  Preview 실제 단일 열·Required Notice 우선 Compact, Notification Badge 30초 Stale
  transition, 일반 소식 표본 밖 Critical 2건의 목적 화면 단일 노출과 5건 Action Rail 확장을
  포함한다.

위 수치는 2026-08-24 최신 통합 Worktree 재실행 결과다. 실기기·보조기술 QA와 사람·
운영 승인은 별도다.

## 출시 전환 조건

- [ ] Product Owner와 Domain Owner가 문제·KPI·1차/2차 범위를 승인한다.
- [ ] Design, Frontend, Backend, Data, Security와 Accessibility Review가 완료된다.
- [ ] Desktop Edit, Mobile Default·Edit Frame과 Node URL이 연결된다.
- [ ] OpenAPI·Schema·Migration·Test Data 계약의 Owner 승인이 기록된다.
- [ ] 구현 Issue가 요구사항 ID, Figma Node와 수용 기준 ID에 연결된다.
- [ ] Feature Flag, Pilot Ring, 운영 Owner와 Rollback 책임자가 지정된다.

Phase 1·2 기능 경계와 이전 v2 구성의 Targeted 자동 증거는 보존한다. 2026-09-04 레퍼런스
충실도 보정의 코드·설계 및 최종 자동 회귀, 일정 카드의 최신 실제 높이 확인을 완료했다.
후속 와이드형 실제 폭 복원도 별도 단위·브라우저·시각 회귀를 통과했다.
이전 v1·v2의 전체 Frontend·Backend·로컬 통합 결과는 회귀 기준선이지 이번 보정의
검증을 대신하지 않는다.
승인자·일자와 수동 QA 결과를 연결한 뒤에만 출시 상태로 변경한다. 구체적인
구현 범위와 남은 항목은 [구현 및 검증 결과](10-구현%20및%20검증%20결과.md)를 따른다.
