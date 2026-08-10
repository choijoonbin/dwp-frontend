# DWP Premium Experience Direction

> 상태: R0.6 Experience Decision v1.2
>
> 기준일: 2026-08-10
>
> 대상: `dwp-frontend`

## 1. 결정

DWP가 지향하는 고급스러움은 장식적 Luxury가 아니라 **조용한 정밀함, 즉시 이해되는
우선순위, 살아 있는 업무 상태와 신뢰 가능한 AI**다. 일반 Admin Dashboard처럼 제목,
Table과 동일한 Card를 나열하지 않는다. 반대로 과도한 Glass, Gradient, 큰 여백,
Marketing Hero와 Bento Card 남용도 채택하지 않는다.

핵심 Experience는 다음 세 문장으로 정의한다.

1. **Know what matters**: 사용자가 지금 알아야 할 일과 이유를 먼저 보여준다.
2. **Move work forward**: 정보 확인에서 승인·요청·Handoff까지 Context를 유지한다.
3. **See intelligence at work**: 사람·System·Agent의 진행 상태와 근거를 숨기지 않는다.

## 2. 글로벌 제품에서 확인한 방향

| 제품                     | 관찰                                                                 | DWP 적용 판단                                           |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------- |
| Microsoft 365 Copilot    | Search·Chat·Agents·Notebooks·Apps를 한 Hub에 통합하고 최근 활동 추천 | Global Command와 최근 Context를 Shell의 1급 기능으로    |
| Workday Home 2026R1      | Awaiting Action·Timely Suggestions·Quick Actions를 역할별 개인화     | Today는 Widget 모음이 아니라 다음 행동의 편집된 순서    |
| Workday Sana             | Find·Act·Build·Automate를 하나의 AI 업무 Home으로 연결               | Ask를 답변 화면이 아닌 실행 가능한 Work Canvas로        |
| ServiceNow AI Experience | Workspace 안에서 Data·Insight·Action과 AI Panel을 병치               | Work List와 Context Detail, AI Guidance를 분리하지 않음 |
| Atlassian Rovo           | Find·Learn·Act, Source와 Teamwork Graph 기반 Context                 | Search 결과에서 Source·관계·후속 Action을 함께 제공     |
| Carbon for AI            | AI Presence와 Explainability를 일관된 시각 언어로 표시               | AI Label을 장식 Badge가 아닌 설명 진입점으로 사용       |

제품을 그대로 복제하지 않는다. 공통적으로 검증된 `개인화`, `Context 통합`, `진행 가시성`,
`출처`, `Human Control`만 DWP 계약으로 재정의한다.

## 3. DWP 차별화 Experience

### 3.1 Work Pulse

Home의 Today 영역은 단순 인사말이나 KPI Card가 아니다. Assigned Apps 다음에 일정,
마감, Blocker, Agent 실행을 분석해 다음 2~3시간의 업무 Rhythm을 보여준다.

- `Focus now`: 지금 처리할 한 가지와 선정 이유
- `Day signal`: 시간대별 Meeting·Focus·Deadline 밀도
- `AI brief`: 근거 수, 갱신 시각, 불확실성과 후속 Action
- `Capacity`: 오늘 확보된 집중시간과 예상 업무량

### 3.2 Unified Activity

Activity는 Notification 목록과 다르다. 사람, System, Connector와 Agent가 업무에 남긴
변화를 하나의 Audit 가능한 흐름으로 보여준다.

- Actor: Person·System·Agent를 형태와 Label로 구분
- State: Running·Needs input·Completed·Failed·Policy blocked
- Object: 영향을 받은 Work·Document·Request
- Evidence: Source, Tool, Policy와 Audit ID
- Control: Pause·Review·Approve·Retry·Open source

### 3.3 Context-preserving Flow

Home → Work → Ask → Activity → App으로 이동해도 선택한 업무 Context를 잃지 않는다.
Reference 단계에서는 Query Parameter와 합성 Fixture로 검증하고, R1 Connector 단계에서
Context Envelope 계약으로 전환한다.

## 4. 시각 언어

### 4.1 Composition

- Desktop Shell은 248px Sidebar와 64px Command Bar를 기준으로 한다.
- Sidebar가 72px Rail로 축소되면 확보된 176px를 Header와 운영형 Page Canvas가 함께
  회수한다. Right Edge는 고정하고 Split Pane과 Data Surface를 유동 확장한다.
- Home·Work·Ask·Activity·Apps·Administration은 최대폭 없는 `workspace` Canvas를,
  Profile·Preferences·Security는 1200px `focus` Canvas를 사용한다.
- Page Heading은 Compact하게 유지하고 첫 Viewport에 실제 업무가 보이게 한다.
- Section은 Full-width Band나 Unframed Layout을 우선한다.
- Card는 반복 Item, AI Plan, 실제로 경계가 필요한 Tool에만 사용한다.
- Radius는 4·6·8px로 제한하고 Card 안에 Card를 넣지 않는다.
- Table은 Scan에, List-detail은 판단과 실행에 사용한다.

### 4.2 Color and Material

- Graphite Neutral을 구조에, Cobalt를 Primary Action에 사용한다.
- Teal은 Verified·Healthy, Saffron은 Attention, Coral은 Critical에만 사용한다.
- Agent는 단일 보라색 Theme로 표현하지 않고 Cobalt·Teal 계열 Signal과 명시적 Label을
  함께 사용한다.
- Shadow는 Floating Layer에만 쓰고 Operational Surface는 Border·Tone·Spacing으로
  깊이를 만든다.
- Gradient, Glow, Orb와 Blur를 배경 장식으로 사용하지 않는다.

### 4.3 Typography

- 한국어 우선 UI는 승인된 CJK System Stack을 사용한다.
- Compact Panel 안에서는 `h5` 이하를 사용하고 Hero 크기 Typography를 사용하지 않는다.
- 숫자·시간·ID는 가능한 경우 Tabular Number와 Mono Stack을 사용한다.
- Letter Spacing은 0을 유지한다.

## 5. Icon, Image and Data Visualization

### Icon

- Lucide를 기본으로 하며 일반 Navigation 19px, Inline 16-18px, App Mark 22-24px를 쓴다.
- Stroke는 1.8을 기본으로 하고 상태를 Icon만으로 전달하지 않는다.
- Icon Button은 Tooltip과 Accessible Name을 반드시 제공한다.
- App Icon은 Domain별 Color와 Shape를 사용하되 Brand Logo를 허가 없이 모사하지 않는다.
- Browser Favicon과 설치 Icon은 DWP Product Mark에서 파생한 전용 `D` Monogram을 사용한다.
  원본은 `public/assets/brand/dwp-mark.svg`이며 외부 Brand나 Template Asset을 사용하지 않는다.

### Image

- 운영 화면을 채우기 위한 Stock Image와 추상 배경은 사용하지 않는다.
- Onboarding, Empty State, 조직 Campaign처럼 이미지가 실제 의미를 갖는 경우에만 DWP
  원본 또는 생성형 Bitmap을 제작한다.
- 생성 Asset은 Prompt, 생성일, Model·Tool, 편집 이력과 사용 화면을 Asset Manifest에
  기록하고 상표·인물·외부 UI를 모사하지 않는다.
- 실제 제품 상태를 설명할 수 있으면 이미지보다 Timeline, Mini Chart, Avatar Stack과
  Source Mark를 우선한다.
- 로그인·Onboarding처럼 제품 세계관을 처음 전달하는 진입 화면은 예외적으로 원본
  Full-bleed Bitmap을 사용할 수 있다. 이때 이미지는 장식용 추상 배경이 아니라 사람,
  업무, 지식, Service와 통제된 AI의 관계를 설명해야 한다.
- 진입 화면의 Form은 이미지와 경쟁하지 않는 고정 폭 Access Rail에 두고, Image 위
  Text에는 Contrast Scrim만 사용한다. 운영 화면에 이 Marketing Composition을 반복하지
  않는다.
- 로그인 입력은 Placeholder에 Label 역할을 맡기지 않는다. 항상 Input 위에 보이는
  Label을 제공하며 Browser Autofill, Keyboard, 200% Zoom에서도 Label과 값이 겹치지
  않아야 한다.

### Data Visualization

- Chart는 비교·추세·임계값을 전달할 때만 사용한다.
- 색만으로 상태를 구분하지 않고 Label·Icon·수치를 함께 제공한다.
- 장식용 Donut·Gauge는 사용하지 않는다.

## 6. Motion Language

Motion은 기능을 설명하고 공간 관계를 보존할 때만 사용한다.

| Intent            | Duration  | 적용                                      |
| ----------------- | --------- | ----------------------------------------- |
| Press·Hover       | 80~120ms  | Button, Row, App Mark의 즉시 Feedback     |
| Enter·State       | 160~220ms | Panel 등장, Filter 결과, Selected Detail  |
| Large Transition  | 220~320ms | Drawer·Context Panel의 위치 변화          |
| Continuous Status | 제한적    | Running Agent·Sync 상태에만 낮은 주의도로 |

- `prefers-reduced-motion`과 사용자 Reduced Motion 설정에서 Continuous Motion을 제거한다.
- 위치 이동은 `opacity`와 4~8px 이내 Offset을 사용하고 Layout Shift를 만들지 않는다.
- 성공·실패는 Motion 없이도 Icon, Text와 상태 Color로 이해할 수 있어야 한다.

## 7. 화면별 R0.6 계약

### Global Shell

- Header는 실제 입력창과 혼동되지 않는 Compact `Search DWP` Trigger를 제공한다. Desktop은
  검색 Icon·Label·`⌘K` 또는 `Ctrl K` Keycap, Mobile은 Icon Button을 사용한다.
- 검색 입력은 화면 상단 중앙의 Modal Command Palette에서만 수행한다. 앱·업무·지식·Ask를
  하나의 권한 기반 결과 목록으로 통합하고, 입력 즉시 추천을 갱신한다.
- Arrow Key로 결과를 이동하고 Enter로 실행하며 Esc로 닫는다. 전역 `⌘/Ctrl+K`는 Form 입력
  중에는 가로채지 않는다. `Command+Space`는 macOS Spotlight와 충돌하므로 사용하지 않는다.
- Header에 넓은 Search Field를 둘 경우에는 그 자리 자체가 실제 Input과 Suggestion Surface여야
  한다. 별도 입력 Surface를 여는 구조에서는 Compact Trigger를 공통 정책으로 사용한다.
- 현재 Workspace, 연결 상태, Notification, Account를 한 Header에서 제공한다.
- Work·Ask·Activity·Apps를 동일한 Navigation 문법으로 제공하고 Product Mark는 Home으로
  복귀한다. Today는 Home 내부 정보 계층으로 제공한다.
- 72px Compact Rail에서는 Product Mark를 Rail 중심에 고정한다. Collapse·Expand 제어는
  Logo나 Rail 경계 위에 띄우지 않고 Global Header의 첫 번째 40px Action으로 제공한다.
- Collapse 제어는 `aria-controls`, `aria-expanded`, 상태별 Tooltip을 제공하며 Logo와
  최소 24px의 시각 간격을 유지한다.
- Collapse·Expand 시 Sidebar, Header와 Main Width를 같은 180ms Motion으로 전환한다.
  Reduced Motion에서는 즉시 전환하며 Overlay, Horizontal Scroll이나 빈 Max-width 여백을
  만들지 않는다.

### Home

- 첫 Viewport에 권한 기반 Assigned Apps 전체와 Today 시작점을 함께 배치한다.
- App Group은 관리자 의미 체계를 유지하고 그룹 안에서 Reorder·Folder를 허용한다.
- Drag 동작에는 Keyboard와 Menu 기반의 동일한 대체 Command를 제공한다.
- Priority Queue, Day Timeline과 Agent Activity를 서로 다른 정보 형태로 표현한다.
- AI Brief에는 Source 수, Freshness와 Preview 상태를 항상 표시한다.

### Work

- Queue Summary → Filter → List → Context Detail 순서를 유지한다.
- Desktop은 List-detail Split, Mobile은 Selection 아래 Detail로 전환한다.

### Ask

- 질문 전에는 Prompt와 Recent Context를, 질문 후에는 Answer·Sources·Plan을 보여준다.
- Retrieval·Reasoning·Action 준비 상태를 구분하며 실제 내부 사고 과정을 노출하지 않는다.

### Activity

- Live 상태, Actor Filter, Event Timeline과 Selected Event Evidence를 제공한다.
- Agent 실행은 단계, Tool, 정책 결정, 경과시간과 Human Gate를 표시한다.

### Apps

- Pinned App은 빠른 Launch Surface로, 전체 App은 검색 가능한 Catalog로 분리한다.
- Entitlement, Launch Mode, Owner와 연결 건강 상태를 보여준다.

## 8. 품질 Gate

- Desktop 1440·1280, Mobile 390, 320px와 200% Zoom
- Light·Dark·High Contrast·Reduced Motion
- Keyboard-only, Visible Focus, Axe와 Screen Reader Landmark
- Visual Regression과 Text Overflow
- Animation 중 Layout Shift 0
- AI Content의 Label·Source·Freshness·Human Control
- 실제 업무 API·Model·Connector Mutation 0인 Reference 단계 유지

## 9. 참고 자료

- [Microsoft 365 Copilot app overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/microsoft-365-copilot-app-overview)
- [Microsoft 365 Copilot Search](https://support.microsoft.com/en-us/microsoft-365-copilot/get-started-with-search-in-the-microsoft-365-copilot-app)
- [Workday Home and Search](https://doc.workday.com/admin-guide/en-us/manage-workday/user-experience/people-experience/home-page/epj1594676779332.html)
- [Workday Sana](https://www.workday.com/en-us/artificial-intelligence/workday-sana.html)
- [ServiceNow Horizon](https://horizon.servicenow.com/)
- [Atlassian Rovo](https://www.atlassian.com/software/rovo/features)
- [Atlassian Jira command palette](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-command-palette/)
- [Microsoft Search overview](https://learn.microsoft.com/en-us/microsoftsearch/overview-microsoft-search)
- [Apple Spotlight search](https://support.apple.com/guide/mac-help/search-for-anything-with-spotlight-mchlp1008/mac)
- [Slack search](https://slack.com/help/articles/202528808-Search-in-Slack-Search-in-Slack-)
- [Fluent 2 Motion](https://fluent2.microsoft.design/motion)
- [Fluent 2 Nav](https://fluent2.microsoft.design/components/web/react/core/nav/usage)
- [Carbon UI Shell left panel](https://carbondesignsystem.com/components/UI-shell-left-panel/usage/)
- [Carbon 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/)
- [Material canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
- [Atlassian Motion](https://atlassian.design/foundations/motion)
- [Carbon for AI](https://carbondesignsystem.com/guidelines/carbon-for-ai/)
- [SAP Fiori Generative AI Design](https://experience.sap.com/fiori-design-web/generative-ai-design/)
