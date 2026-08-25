# 0006. Critical design audit and Home v2 correction

- 상태: Implemented · production build and actual-session browser verification passed · design approval pending
- 기준일: 2026-08-24
- 적용 Surface: `workspace-home`의 `FLOW_V1`
- 대체 범위: Decision 0005의 Header Assistant, Tenant Logo 실패 처리, Dock cadence,
  Action Stage 8+4 비율, inverse Now surface와 Appearance preset 의미를 대체한다.

## Context

Home v2를 완성본으로 부르기 전에 제품·정보구조, 시각 디자인, 상호작용·접근성의 세 관점으로
독립 재검증했다. 세 검토 모두 기능 통합과 디자인 완성도를 구분해야 한다고 판정했다. 특히 기존
Home의 핵심 가치인 `앱별 새 알림 확인 → 자주 쓰는 앱 즉시 실행`이 평면화된 8개 Dock과 넓은
간격 때문에 약해졌고, 검은 `Now`, 모호한 세 Preset, Header로 이동한 DWAI·ON과 일반 소식의
고정 하단 배치가 제품 의도를 충분히 설명하지 못했다.

글로벌 비교는 앱 Launcher를 제거하는 근거가 아니라, 관리형 업무 카드와 개인화 가능한 앱·뉴스를
함께 제공하는 근거로 사용한다.

- Microsoft Viva Connections Dashboard:
  <https://learn.microsoft.com/en-us/viva/connections/create-dashboard>
- Microsoft Viva audience targeting:
  <https://learn.microsoft.com/en-us/viva/connections/use-audience-targeting-in-viva-connections>
- Atlassian Home: <https://support.atlassian.com/platform-experiences/docs/what-is-atlassian-home/>
- ServiceNow Employee Center widgets:
  <https://www.servicenow.com/docs/r/xanadu/employee-service-management/employee-experience-foundation/employee-center-widgets-list.html>
- ServiceNow App Launcher:
  <https://www.servicenow.com/docs/r/employee-service-management/employee-experience-foundation/web-application-employee-about.html>

## Decision

### 1. Product and tenant brand

- Desktop Header는 `Digital Workplace | Tenant logo` 순서를 유지한다.
- Gateway의 인증 Media 경로는 Browser의 현재 Origin에서 요청한다. 개발 환경의 별도
  `VITE_API_URL`을 접두하지 않아 `Cross-Origin-Resource-Policy: same-origin`에 차단되지 않게
  한다.
- Logo가 실패하거나 없으면 Tenant 전체 맥락을 조용히 제거하지 않고 조직명을 fallback으로
  표시한다.
- Header의 DWAI·ON 진입점은 제거한다.

### 2. App launch remains a first-class Home task

- 읽기 상태 명칭은 `내 앱 Dock` 대신 `자주 쓰는 앱`을 사용한다.
- App tile은 72px 고정 폭, 10~16px gap, 좌측 정렬을 사용한다. 넓은 화면의 남는 폭을 `1fr`로
  App 사이에 배분하지 않는다.
- `8 / 17`처럼 의미가 불분명한 Count는 읽기 상태에서 숨기고 편집 중에만 `8개 표시`로
  설명한다.
- Badge의 시각 숫자는 Tone과 일치시킨다. Urgent tone이면 `urgentUnread`, Actionable tone이면
  `actionableUnread`, 일반 상태에서만 전체 읽지 않음을 표시한다. 접근 가능한 이름에는 전체와
  세부 Count를 함께 유지한다.
- Dock의 `DWAI·ON 워크스페이스`는 전체 AI 업무공간이고, 화면 우측 하단 Launcher는 빠른 질문
  진입점으로 역할을 분리한다.

### 3. Work stage hierarchy

- `지금`은 `우선 업무`, `오늘의 Flowline`은 `오늘 일정과 마감`, `업무 신호`는 `업무 현황`,
  `다음`은 `다음에 준비할 일`로 쓴다.
- 실행 가능한 업무가 있다는 이유만으로 inverse black surface를 사용하지 않는다. 기본은 밝은
  surface와 accent edge이며, 기한 경과·높은 우선순위만 상태색으로 구분한다.
- 높이는 콘텐츠 기반으로 계산하고 Grid는 `align-items:start`를 사용한다. 옆 카드 때문에 빈
  surface가 늘어나지 않는다.
- `<1200px`은 한 열, `>=1200px`은 `우선 업무 7 + 첫 개인 Section 5`를 사용한다. 1221px 실제
  화면에서 약 658px + 470px을 확보한다. 좁은 5열 `업무 현황`은 2×2 요약으로 reflow한다.
- `grid-auto-flow:dense`를 사용하지 않아 시각 순서와 DOM·Keyboard 순서가 달라지지 않게 한다.
- Flowline은 상태가 아니라 시간순으로 표시하고, 선택 예산을 정할 때만 위험도를 사용한다.
  `우선 업무`의 Primary item은 Flowline에서 중복 노출하지 않는다.
- CTA는 고정된 `업무에서 열기`가 아니라 `전자결재에서 열기`처럼 실제 Source 이름을 사용한다.

### 4. Layout styles

기존 enum은 API 호환을 위해 유지하되 UI 의미를 다음처럼 재정의한다.

| 저장값       | 사용자 명칭 | Desktop shell                 | 목적                         |
| ------------ | ----------- | ----------------------------- | ---------------------------- |
| `focused`    | 집중형      | 최대 1240px                   | 좁은 폭과 조밀한 정보        |
| `balanced`   | 균형형      | 최대 1680px                   | 표준 폭과 표준 간격          |
| `expressive` | 와이드형    | 최대 2240px, 좌우 24px target | 큰 화면과 원본 수준의 활용폭 |

Home Studio의 Section 명칭은 `화면 분위기`가 아니라 `레이아웃 스타일`로 바꾸고, Preview는 같은
추상 카드가 아니라 좁은 canvas, 표준 canvas, edge-to-edge 3-column canvas를 보여준다. Radio는
roving tabindex와 Arrow·Home·End keyboard interaction을 제공한다. 장기적으로는 `화면 폭`,
`정보 밀도`, `배경 표현`을 별도 설정으로 분리한다.

### 5. Assistant, notices and updates

- DWAI·ON은 Home에서도 최초와 같은 우측 하단 Floating Launcher와 Aura·Float·Greeting Motion을
  사용하고 편집 중에는 숨긴다. Desktop 74px·Mobile 64px Target을 유지하고, Footer 조작 요소와
  겹치면 위로 자동 회피한다. `prefers-reduced-motion`과 Dialog보다 낮은 Layer를 유지해
  Motion·Modal 접근성을 보장한다.
- 여러 필수 공지가 있으면 Rail에 `필수 확인 n건`과 전용 Required queue 진입을 제공한다.
- 일반 소식의 하단 기본값은 `로그인 후 업무 시작 우선` 템플릿의 의도된 선택이다. 다만 영구
  고정 정답은 아니다. 필수 Rail은 관리형으로 유지하고 일반 소식은 후속 Layout 계약에서
  이동·숨김 가능한 개인 Widget과 역할별 Template 대상으로 확장한다.

### 6. Existing behavior and accessibility

- 명시적 편집, App·Widget long press, Pointer·Touch·Keyboard DnD, 비 drag 이동, Folder,
  Pin·Hide·Restore, Widget 순서·폭·콘텐츠, Save·Cancel·Reset·Undo·Redo·409 복구, 복수 Home,
  Template·Revision·Device preview를 제거하거나 초기화하지 않는다.
- Widget 내부 Button·Link·Input의 long press는 편집 진입으로 해석하지 않는다.
- 편집 진입 후 floating toolbar의 첫 활성 action으로 focus를 이동하고, 종료 후 기존 focus와
  scroll 위치를 복원한다.
- Home의 세로 scroll owner는 계속 Document 하나다.

## Verified implementation

- 실제 Tenant 1 로그인 Session에서 `/api/platform/v1/tenant-branding/logo?v=1`이 같은 Origin으로
  요청되고 Header에 Tenant Logo가 표시되는 것을 Browser에서 확인했다.
- 실제 1280px Home에서 compact Dock, `7+5` work stage, 밝은 priority surface, 우측 하단
  DWAI·ON과 `집중형/균형형/와이드형` Preview를 캡처해 검토했다.
- Flow model, preference adapter, long-press guard와 Browser media policy Unit test 25건이
  통과했고 TypeScript 전체 검사가 통과했다.
- Flow Home·DWAI·ON Chromium 회귀는 29 passed / 환경상 제외 9 skipped로 통과했다. 정상
  Logo의 기존 Shell E2E는 오래된 인증 Session fixture가 대기 중 Sign-in으로 전환되는 독립
  불안정성이 있어 완료 증거로 계산하지 않고, 실제 로그인 Browser와 Media policy Unit test를
  복원 증거로 사용한다.
- Production Build의 Architecture·Route·Feature·API·Source-size·Design System·i18n·Display
  Dictionary·ESLint·TypeScript·Vite·Bundle Budget Gate가 모두 통과했다.

## Known follow-up

- 일반 소식을 개인 Widget Registry와 Home View Layout 계약에 포함하는 Backend·Frontend 계약
  확장은 아직 구현하지 않았다.
- `화면 폭/밀도/배경 표현`을 세 독립 설정으로 분리하는 Schema 변경은 호환 Migration이 필요한
  후속 범위다.
- Mobile의 숨은 Now 보조 항목 Count, 기기별 Dock pin, 실제 VoiceOver/NVDA와 실기기 Trackpad
  검증은 출시 승인 Gate에 남는다.

## Restore point

Critical correction 전에도 기존 복원 지점을 유지한다.

`/Users/a10697/Work/DWP/.codex-restore-points/home-flow-v1-before-redesign-20260824-130133-KST`

복원은 사용자의 명시 요청이 있을 때만 전체 Capture 단위로 수행한다.
