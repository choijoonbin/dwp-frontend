# DWP-R1-CORE-007 Flow Home Personalization

- 상태: `Home v2 adaptive-wide correction implemented`
- Gate: `production build·targeted automated·actual-session browser verification passed / manual QA·G0-G3 approval pending`
- 준비도: `release review pending`
- 구현 상태: `Phase 1·2 capability preserved; Daily Work Launch & Triage v2 composition implemented`
- Owner: DWP Product Experience / Shared Experience Platform
- Roadmap: R1 Flow Home vNext (`R1-24`)
- 적용 저장소: `dwp-frontend`, `dwp-backend`
- 기준일: 2026-08-24

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

1. 전체 읽기 순서는 `Compact Context → My App Dock → 필수·Critical Rail(해당 시) → Work
Action Stage → 일반 Updates`다.
2. 기본 Desktop Work Stage는 `>=1200px`에서 `우선 업무 + 첫 개인 Section`의 보완 폭을
   사용한다. Expressive `>=1800px`의 기본 구조는 실제 `5/12 + 3/12 + 4/12`로 재구성하고,
   우측 4/12에 `업무 현황 + 다음에 준비할 일` support stack을 배치한다. 좁은 화면은 같은 DOM을
   한 열로 Reflow한다.
3. `Compact Context`는 Desktop 96px 이하, `My App Dock`은 128px 이하와 최대 8개를 기본
   예산으로 삼는다. Expressive 넓은 화면은 1760px 내부 rail에서 tile pitch를 유지한 채 최대
   12개를 표시한다. Dock은 권한·Tenant 정책·사용자 Pin을 순서대로 적용한다.
4. Home 본문 Widget은 같은 축의 독립 세로 스크롤을 만들지 않는다. 콘텐츠 예산을 넘는 정보는
   요약하고 `전체 보기`로 원본 업무 화면에 연결한다.
5. 일반 소식은 업무 뒤의 `Updates`로 내리고, 확인 필수 또는 Critical 항목만 얇은 Rail로
   승격하며 중복 노출하지 않는다. `required`는 확인 필수 의미를 유지하고, 전체 활성 피드의
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

세부 결정은 다음 기록을 따른다.

- [Flow Home 정보 구조](decisions/0001-flow-home-information-architecture.md)
- [단일 문서 스크롤](decisions/0002-single-document-scroll-and-widget-overflow.md)
- [제약형 개인화와 AI 제안](decisions/0003-bounded-personalization-and-ai-suggestions.md)
- [Visual v1.1과 안전한 편집 세션](decisions/0004-flow-home-visual-v1-1-and-safe-editor.md)
- [Flow Home v2 Daily Work Launch & Triage](decisions/0005-flow-home-v2-daily-work-launch-and-triage.md)
- [Critical design audit and Home v2 correction](decisions/0006-critical-design-audit-and-home-v2-correction.md)
- [Adaptive wide, governance and interaction hardening](decisions/0007-adaptive-wide-governance-and-interaction-hardening.md)

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

- v1 참고 File: [DWP Flow Home — Development Ready v1](https://www.figma.com/design/WKo4pIiHeCvFLcVgMHzgMn)
- [`01 Screens / Desktop / Default / 1440`](https://www.figma.com/design/WKo4pIiHeCvFLcVgMHzgMn/DWP-Flow-Home-Development-Ready-v1?node-id=6-2):
  작성 및 시각 검증 완료
- 이 Figma는 v1 참고 증거이며 v2 4+8 Action Stage의 최종 승인 Frame으로 간주하지 않는다.
- v2 Desktop·Mobile·Edit·상태 Frame과 독립 Design·Accessibility 승인은 대기 상태다.
- 최신 2560·1920·1440 Desktop Capture와 편집 상태는 내부 Product/UX·Visual Design·
  Interaction/Accessibility 전문 Agent의 비판적 재검증에서 P0·P1 0건으로 통과했다.
- 외부 상용 Design AI의 독립 검증을 완료했다고 주장하지 않는다.

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

Phase 1·2 기능 경계와 v2 구성이 Source에 구현됐고 위 Targeted 자동 증거가 통과했다. 이전 v1의
전체 Frontend·Backend·로컬 통합 결과는 회귀 기준선이지 최신 v2 전체 검증을 대신하지 않는다.
승인자·일자와 수동 QA 결과를 연결한 뒤에만 출시 상태로 변경한다. 구체적인
구현 범위와 남은 항목은 [구현 및 검증 결과](10-구현%20및%20검증%20결과.md)를 따른다.
