# DWP 프론트엔드 UI/UX 기술검토

> 문서 상태: R0 Technical Review v2.3
>
> 기준일: 2026-08-10
>
> 대상: `dwp-frontend`
>
> 연계 문서: `../01-product/프로젝트 개요.md`,
> `../01-product/프로젝트로드맵.md`, `DWP UI Foundation 전략.md`,
> `DESIGN_SYSTEM.md`
>
> 재검토 시점: R0 종료 Gate, Design System 주요 버전 또는 UI Library License 변경 시

## 1. 최종 판정

React 19, TypeScript, Vite, MUI 7, TanStack Query, i18next, Vitest와 Playwright는
엔터프라이즈 DWP를 구축하기에 적합하므로 유지한다. 외부 Admin UI Template을
제품 기반으로 사용하지 않고 DWP가 Token, Component, 업무 Floorplan과 AI 신뢰
Pattern을 직접 소유한다.

참고 제품과 화면은 문제 정의, 정보 구조와 Interaction 비교 자료로만 사용한다.
Source, Asset, 시각 구성과 문구를 복제하지 않으며 채택할 아이디어는 사용자 가치,
접근성, 확장성, 운영 복잡도와 License를 함께 검증한다.

현재 코드는 신규 제품 기능을 시작할 수 있는 안전한 Shell에 가까워졌지만 R0 전체가
끝난 것은 아니다. R1 메뉴와 업무 기능은 아래 Enterprise·AI Pattern, Visual
Baseline과 Architecture Gate가 승인된 뒤 시작한다.

### 1.1 현재 상태

| 평가 영역                | 상태      | 현재 근거와 남은 Gate                                                                                             |
| ------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------- |
| Core 기술 Stack          | 충족      | React 19, TypeScript, Vite, MUI 7과 Yarn 4 Build 통과                                                             |
| Source 독립성            | 1차 충족  | 식별된 파생 Theme·Component·Asset·Tooling을 삭제 또는 독립 구현                                                   |
| Design Token             | 부분 충족 | DTCG Draft와 Code Adapter 구현, Figma 승인·배포 자동화 남음                                                       |
| Appearance Policy        | 충족      | Product·Tenant·User·OS 우선순위와 Light·Dark·Contrast·Density 구현                                                |
| Global Shell             | 부분 충족 | 반응형 Header·Navigation·Account 구현, 실제 업무 Floorplan 검증 남음                                              |
| 공통 Component           | 1차 충족  | Action·Form·Dialog·Async State 공통 계약과 직접 사용 증가 차단, Navigation Primitive 확장 필요                    |
| Enterprise Component     | 부분 충족 | Server Grid·Toolbar·Selection과 Date·DateRange·Timezone 정책 구현, Filter·Tree·File·Timeline 필요                 |
| DWP 업무 Pattern         | 미충족    | Today·Work·Approval·Service·Knowledge Pattern 구현 필요                                                           |
| AI UX Pattern            | 부분 충족 | Citation·Plan·Execution·Retry·Handoff Reference, Streaming·Feedback 필요                                          |
| 접근성                   | 부분 충족 | Desktop·Mobile Axe 자동검사 통과, Keyboard·Reader·Zoom 수동 Gate 남음                                             |
| 다국어·한국어            | 1차 충족  | `ko`·`en` 전 제품 Namespace, 사용자·Tenant Fallback, API 오류와 Coverage Gate 구현. Native QA·제품 Font 승인 남음 |
| UI Test·Governance       | 1차 충족  | Storybook Play·Axe·Visual 및 AST 도입 Gate 구현, CI 승인 규칙과 수동 접근성 Gate 남음                             |
| Browser Session Security | 부분 충족 | HttpOnly Session·CSRF·Logout 구현, Rotation·Idle·운영 검증 남음                                                   |

## 2. Foundation Architecture

### 2.1 Source 구조

```text
libs/design-system/
  tokens/          DTCG 호환 원본 Token
  src/foundation/  Code에서 사용하는 Token Adapter와 Foundation Story
  src/appearance/  Product·Tenant·User·OS 정책 해석
  src/theme/       해석 결과를 MUI Theme으로 변환
  src/components/  재사용 가능한 DWP Component
  src/enterprise/  Grid, Filter, Form, Date, Tree, File, Timeline
  src/patterns/     Shell, Work, Approval, Service, Knowledge
  src/ai/           Citation, Plan, Approval, Trace, Handoff
```

`tokens`가 의미와 값의 원본이고 Theme은 Runtime Adapter다. Feature가 색상, 간격,
Radius, 상태와 Motion 값을 직접 소유하지 않는다. Token 변경은 Storybook, Axe와
Visual Baseline을 함께 통과해야 한다.

### 2.2 Appearance 책임

Font, 색상과 Navigation 기능을 없애지 않는다. 변경 권한과 노출 위치를 제품
책임에 맞게 분리한다.

| 책임 주체        | 제어 항목                                                              |
| ---------------- | ---------------------------------------------------------------------- |
| Product          | 기본 Token, 승인 Font 목록, 기본 Accent, 기본 Navigation, 허용 범위    |
| Tenant 관리자    | 승인된 Font, Brand Accent, Logo, Navigation Pattern과 사용자 허용 정책 |
| 일반 사용자      | System·Light·Dark, High Contrast, Density, Reduced Motion, Language    |
| Operating System | System Color Scheme, Reduced Motion와 접근성 신호                      |

정책 해석 순서는 `Product -> Tenant -> 허용된 User Preference -> OS Signal`이다.
현재 `DwpThemeProvider`와 `AppearancePolicy`가 이 계약을 구현한다. 일반 사용자는
제품 Font, 임의 Color Preset과 전체 Navigation Layout을 바꾸지 못하지만 해당
Capability는 Tenant Configuration과 향후 관리자 Console에 유지된다.

사용자 선호는 비민감 Versioned Key `dwp.appearance.v1`에 저장한다. Tenant Brand는
인증된 Tenant Configuration에서 주입해야 하며 URL Parameter나 임의 사용자 입력을
직접 Theme 값으로 사용하지 않는다.

### 2.3 Source와 License 경계

- 현재 Source Tree에서 식별된 외부 Template 파생 Source, Asset, Font, Icon과 Root
  Tooling을 제거하거나 독립 구현으로 교체했다.
- React, MUI, Lucide 등 공개 Dependency는 Package Manager와 Lockfile로 추적한다.
- DWP 원본 Source는 제품 License 확정 전 `UNLICENSED`로 표시한다.
- 외부 Delivery 전 Production Dependency SBOM, Attribution과 License Policy를
  자동 검증한다.
- Git History에는 제거 전 Commit이 남을 수 있다. History까지 없는 전달물이
  필요하면 Release Owner 승인을 받아 Clean Repository를 만들거나 History 정리
  절차를 수행한다.

현재 Tree 검색 결과만으로 법률적 무결성을 단정하지 않는다. Dependency License와
과거 Commit을 포함한 최종 Delivery 검토는 별도 Release Gate다.

## 3. 목표 Experience

### 3.1 Quiet Precision

DWP의 고급스러움은 장식보다 정보의 정돈, 일관된 상태, 빠른 반복 업무와 예측 가능한
AI 행동에서 만든다.

- 중립 Surface와 선명한 Typography를 기본으로 한다.
- Brand Accent와 Status Color를 분리한다.
- Page Section을 떠 있는 Card로 만들지 않고 Card 중첩을 피한다.
- Card Radius는 8px 이하, Shadow는 Overlay와 실제 Elevation에만 사용한다.
- Desktop은 Scan, Compare, Multi-select와 Bulk Action을 지원한다.
- Mobile은 Desktop 축소판이 아니라 승인, 알림, 검색과 상태 확인을 우선한다.
- Font 크기를 Viewport Width에 비례해 키우지 않는다.
- 장식 Gradient, 과도한 Animation과 의미 없는 Badge를 사용하지 않는다.

### 3.2 Global Shell

Desktop Navigation은 목적 기반 `Home`, `Work`, `Inbox`, `People`, `Services`,
`Knowledge`, `Apps`, `Agents`와 권한 기반 `Admin`으로 확장한다. Header는 Workspace,
Global Ask/Search, 빠른 생성, 알림, 도움말과 Account를 제공한다. 우측 Context
Panel은 현재 업무의 Agent, Detail, Activity와 Collaboration을 전환한다.

Mobile은 핵심 목적지 4개와 More Navigation을 사용한다. Context Panel과 Detail은
Bottom Sheet 또는 전체 화면으로 전환하고 언어와 낮은 빈도 설정은 Account에 둔다.
320px, 390px, 1280px와 1440px를 최소 Baseline으로 검증한다.

### 3.3 개인화 Home과 Apps

Home은 자유 배치 App Portal보다 `Today Action Hub`를 우선하고 `Apps`를 별도
Mode로 제공한다. 사용자가 부여받은 Native·Legacy·SaaS App은 검색, 최근 사용,
Pin과 Category로 접근하되 Entitlement와 Tenant Policy를 항상 적용한다.

추천 순서는 `보안·필수 정책 -> 역할·조직 -> 사용자 명시 선호 -> 마감·현재 맥락
-> 사용 패턴 -> AI 추천`이다. 추천에는 이유, 숨김과 초기화를 제공하며 AI가 임의
HTML이나 JSX를 생성하지 않는다.

## 4. Component Roadmap

### 4.1 R0.5 필수 계층

| 계층                | 필수 범위                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation          | Semantic Color, Type, Space, Size, Radius, Elevation, Motion, Density, Breakpoint, Focus, Z-index                                                                    |
| Primitive           | Button, IconButton, Link, Field, Select, Checkbox, Radio, Switch, Segmented Control, Tabs, Tooltip, Menu, Dialog, Drawer, Badge, Progress, Skeleton, Feedback        |
| Enterprise          | Data Grid, Filter Bar, Saved View, Form, Date·Time, Tree, Entity Picker, File, Timeline, Detail Drawer, Split Panel, Virtual List, Bulk Action                       |
| DWP Pattern         | App Shell, Page Header, Daily Brief, Work Item, Approval, Service Catalog, Request Form, Inbox Item, Person, Knowledge Result, App Tile, Notification, Activity Feed |
| AI Pattern          | Ask Composer, Streaming Answer, Citation, Source Preview, Plan Preview, Risk, Approval, Tool Trace, Execution Timeline, Stop·Retry, Feedback, Handoff                |
| Cross-cutting State | Empty, Loading, Partial, Error, Offline, Stale, Permission Denied, No Result, First Use, Read-only                                                                   |

### 4.2 Component 계약

공통 Component는 다음 조건을 충족해야 Public API로 승격한다.

- Anatomy, Variant, Size, Density와 허용 조합
- Default, Hover, Focus, Active, Selected, Disabled, Loading과 Error State
- Keyboard와 Screen Reader 동작
- Light, Dark, High Contrast와 Tenant Theme
- 한국어·영문, 긴 문자열, 숫자, 날짜와 Timezone Story
- Responsive와 Container Constraint
- Content Guideline, Analytics Event와 Owner
- Unit, Interaction, Axe와 Visual Test

### 4.3 기술 선택

| 영역                | 결정 또는 Gate                                                    |
| ------------------- | ----------------------------------------------------------------- |
| UI Primitive        | MUI 7 + Emotion 유지                                              |
| Icon                | Lucide 한 계열, 16·20·24 Optical Size와 Stroke 규칙               |
| Component Workbench | Storybook Autodocs·Interaction·A11y                               |
| Enterprise Data     | MUI X Community 9.11.0, Pro·Premium은 요구사항과 TCO 승인 후 사용 |
| Form                | R1 Service Form을 기준으로 State·Schema Validation ADR            |
| Date·Time           | Locale·Timezone Adapter와 MUI X Picker                            |
| Server State        | TanStack Query                                                    |
| 작은 Client State   | Zustand 제한 사용                                                 |
| Localization        | i18next Namespace와 Intl Formatting                               |
| Test                | Vitest, Playwright, Axe와 Screenshot Baseline                     |
| Font                | CJK 품질·성능·License 검증 후 승인 Font를 Self-host               |

### 4.4 Enterprise Data Grid 정책

운영 목록은 데이터가 적다는 이유로 빈 Grid Viewport를 크게 남기지 않는다. 기본
`EnterpriseDataGrid`는 현재 페이지의 데이터 수에 따라 높이를 결정하고 대량 데이터에서만
제한된 Viewport와 가상 스크롤을 사용한다.

- Density별 Header·Row 높이는 `compact 44px`, `standard 52px`, `comfortable 60px`로
  동일하게 맞춘다. 화면 단위로 임의 높이를 지정하지 않는다.
- 1~8행은 내용 높이에 맞추고, 8행 초과는 최대 높이에서 내부 스크롤과 Virtualization을
  유지한다. Empty는 2행, Loading은 3행 높이를 예약해 상태 전환 시 Layout Shift를 줄인다.
- 고정 높이는 Work Split View처럼 주변 Panel과 수직 비교가 필요한 화면에만 허용하며
  코드에 업무 근거가 있어야 한다.
- 기본 행은 고정 높이와 한 줄 Cell을 사용한다. Identity처럼 핵심 식별 정보가 필요한 첫
  Cell만 최대 두 줄을 허용하고, 다중 Tag는 정해진 개수 뒤 `+N`과 Tooltip으로 축약한다.
- Cell 내부 Badge·Chip은 24px, 행 단위 Icon Action은 32px로 맞추고 모든 Cell을 수직
  중앙 정렬한다. 숫자는 Tabular Numeric으로 비교 정렬한다.
- Mobile은 Desktop Grid를 축소하거나 가로 스크롤시키지 않고, 정보 우선순위가 정의된
  Structured List로 전환한다.
- 콘텐츠 때문에 행 높이가 달라지는 목록은 Activity·Narrative Feed처럼 의미적으로
  가변 높이가 필요한 Pattern에만 허용한다.

Access, Directory, Registry, Reference Data와 Audit은 이 공통 정책을 사용한다. 공지
Table도 같은 52px 행 리듬과 24/32px Cell Component 규격을 따른다.

## 5. AI UX Safety Pattern

일반 Chat Bubble은 통제된 업무 실행을 충분히 설명하지 못한다. R1의 AI UI는 다음
정보를 구조적으로 제공한다.

- AI 사용 표시, Streaming과 응답 상태
- Citation, Source Preview, 권한 범위와 최신성
- Plan Preview, 변경 대상과 예상 결과
- Risk Tier, 승인 요구, 승인·반려·수정
- Tool Execution Timeline, Progress, Stop, Retry와 보상 상태
- Partial Result, Failure Reason과 Human Handoff
- 결과, 원본 System Link, Audit ID와 Feedback

급여, 승인, 권한, 삭제와 중요 변경은 결정적 Form과 Review Step을 유지한다. AI가
값을 채워도 사용자가 원본 근거와 변경 내용을 확인한다. 동적 UI는 승인된 Component
Registry, JSON Schema, 관계 규칙과 Policy 안에서만 조합한다.

## 6. Quality Gate

### 6.1 현재 자동 검증

- Yarn 4 Clean Install 계약
- Typecheck, Lint, Unit와 Production Build
- Storybook Build와 A11y Addon
- Playwright Desktop·Mobile 인증 Journey
- Light·Dark·High Contrast 설정과 Account Navigation
- Playwright Axe 자동 접근성 검사
- Data Grid와 AI Trust Pattern Storybook Play·Axe·Desktop·Mobile Visual Baseline

### 6.2 R0에 남은 검증

1. Keyboard-only 핵심 Journey와 Focus Not Obscured
2. VoiceOver 또는 동등한 Screen Reader 검증
3. 200% Zoom, Reflow, Reduced Motion와 OS High Contrast
4. 320·768·1440 Viewport와 Theme·Density 전체 Matrix
5. 한국어·영문, 긴 문자열, 숫자·통화·날짜·Timezone
6. 실제 대규모 Grid·List와 Streaming 응답 성능
7. Bundle Budget와 Core Web Vitals 기준

자동 Axe는 모든 접근성 문제를 찾지 못하므로 수동·사용자 검증을 대체하지 않는다.

## 7. R0.5 Exit Gate

- [x] 외부 Template 파생 Source·Asset Inventory와 독립 교체
- [x] DTCG Foundation Token Draft와 MUI Adapter
- [x] Product·Tenant·User·OS Appearance Policy
- [x] Light·Dark·High Contrast·Density·Reduced Motion Runtime
- [x] Storybook·Playwright Axe 자동 기반
- [x] MUI X Community Data Grid와 AI Trust Pattern 1차 Reference
- [x] Action·Form·Dialog·Async State와 Date·DateRange·Timezone Reference
- [x] 직접 MUI 사용 증가를 차단하는 AST Baseline Gate
- [x] Storybook Play·Axe·Desktop·Mobile Visual Baseline 1차
- [ ] Figma Variable·Component Library와 Code Token Mapping 승인
- [ ] Filter·Tree·Entity Picker·File·Timeline Enterprise Reference
- [ ] Global Shell·Today·Work·Apps·Ask Reference Flow 승인
- [ ] Citation·Plan·Approval·Trace의 Figma·수동 AI Trust Pattern 승인
- [ ] Keyboard·Screen Reader·Zoom 수동 접근성 Gate
- [x] Production Dependency License Policy와 재현 가능한 Report
- [ ] SBOM·Attribution·Git History를 포함한 외부 Delivery 법무 승인

R0.5가 끝나기 전에는 Feature별로 중복 Grid, Form, Timeline, Citation 또는 Approval
UI를 만들지 않는다. 각 기능은 `docs/00-governance`의 기획·화면·디자인·데이터·API·
권한·AI·수용 테스트 Package가 Build Ready Gate를 통과한 뒤 구현한다.

## 8. 주요 참고 자료

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C Design Tokens Format 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/)
- [MUI CSS Theme Variables](https://mui.com/material-ui/customization/css-theme-variables/usage/)
- [MUI X Licensing](https://mui.com/x/introduction/licensing/)
- [Storybook UI Testing](https://storybook.js.org/docs/writing-tests)
- [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Fluent 2 Design Tokens](https://fluent2.microsoft.design/design-tokens)
- [IBM Carbon Accessibility](https://carbondesignsystem.com/guidelines/accessibility/overview/)
- [SAP, Evolving Design Systems for AI-driven UX](https://www.sap.com/uk/design/stories-resources/evolving-design-systems-for-ai-driven-ux)
