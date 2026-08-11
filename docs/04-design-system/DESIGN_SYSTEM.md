# DWP Design System Engineering Standard

## Source of Truth

- Design Token: `libs/design-system/tokens/dwp.tokens.json`
- Theme Adapter: `libs/design-system/src/theme/build-theme.ts`
- Appearance Policy: `libs/design-system/src/appearance/`
- Public Component: `libs/design-system/src/components/`
- Enterprise Component: `libs/design-system/src/enterprise/`
- AI Trust Pattern: `libs/design-system/src/ai/`
- Component Workbench: Storybook
- Design Source: 승인된 DWP Figma Foundation File

Raw Color, Font, Radius, Shadow와 Motion 값을 Feature Source에 직접 작성하지 않는다.
새 값이 필요하면 의미, 상태, 접근성 검증과 Migration 영향을 Token 변경에 기록한다.

## Component 계층

1. Foundation Token
2. MUI 기반 Primitive와 Variant
3. Enterprise Component
4. DWP 업무 Pattern
5. AI Trust Pattern

MUI Component를 기계적으로 전부 감싸지 않는다. 제품 의미, 반복 상태, 접근성 계약이나
교체 가능성이 있는 경우에만 Public DWP Component를 만든다.

## Icon

- 일반 UI 명령은 `lucide-react`의 의미가 명확한 Icon을 사용한다.
- Icon-only Button은 Tooltip과 Accessible Name을 가진다.
- 제품·상태 Icon은 DWP가 소유하고 출처·License를 기록한다.
- 임의 SVG Path와 출처 불명 Icon을 Source에 추가하지 않는다.

## Appearance Responsibility

- Product: Semantic Status, Component State, Accessibility, Responsive Rule
- Tenant: 승인된 Brand Accent, Font, Product Mark와 Navigation Pattern
- User: Mode, High Contrast, Density, Reduced Motion, Language

사용자 설정에서 숨긴 기능도 Tenant Policy Engine에서 제거하지 않는다. 정책 우선순위와
허용 범위를 `AppearancePolicy`로 통제한다.

## Shell Reflow와 Page Width

Header와 Sidebar의 의미·순서·Scope 계약은
[`R1 Global Shell 및 Header Context ADR`](../03-architecture/R1%20Global%20Shell%20및%20Header%20Context%20ADR.md)을
Source of Truth로 사용한다. Layout은 Header 내부 요소를 화면별로 다시 조립하지 않고 공통
`ShellHeader`에 현재 Application Context와 Scope만 전달한다.

Desktop Navigation은 본문 옆에 놓이는 Inline 영역이다. Expanded `248px`와 Compact
`72px`의 차이 `176px`는 Sidebar를 접는 즉시 Global Header와 Main Canvas가 함께
회수한다. Header와 Main은 동일한 Motion Duration을 사용하고 오른쪽 Viewport 경계를
유지한다. Mobile Navigation은 본문 폭을 바꾸지 않는 Overlay Drawer를 사용한다.

페이지 루트는 MUI `Container`나 임의 `maxWidth` 대신 Public `PageCanvas`를 사용한다.

- `workspace`: Home, Work, Ask, Activity, Apps, Administration처럼 비교·탐색·운영하는
  화면이다. 최대폭을 두지 않고 고정 Gutter 안에서 가용 폭 전체를 사용한다.
- `focus`: Profile, Preferences, Security처럼 읽기·입력에 집중하는 화면이다. Canvas를
  `1200px`로 제한하되 Shell 자체는 계속 Reflow한다.
- 본문 내부의 설명 Text, Form Field와 Detail Pane에는 목적에 맞는 국소 최대폭을 둘 수
  있다. 페이지 전체를 임의로 고정하는 것은 허용하지 않는다.
- Split View는 `minmax(0, ...)`와 `minWidth: 0`을 사용해 Compact 전환 중 Overflow와
  Layout Shift를 만들지 않는다.

공통 수치는 `dwp.tokens.json`의 `dimension.layout`이 Source of Truth다. `1920px`
Viewport에서 Expanded Canvas `1672px`, Compact Canvas `1848px`와 `176px` 증가량을 E2E
Gate로 검증한다.

## Public Component Gate

공통 Component는 다음 항목이 준비된 뒤 Export한다.

- 명확한 제품 책임과 API
- 모든 Interactive·Disabled·Loading·Error 상태
- Light·Dark·High Contrast와 Density 상태
- Keyboard, Focus, Screen Reader와 Axe
- 한국어·영어와 긴 문자열
- Desktop·Mobile Story
- Unit·Interaction·Visual Test
- Figma Component와 Version Mapping

## 현재 Reference API

- `ActionButton`: Primary·Secondary·Quiet·Danger 의도와 Disabled·Loading 상태 계약
- `ActionIconButton`: 필수 Accessible Name, Tooltip, 의도와 Loading 상태 계약
- `LanguageIcon`: 로그인·탐색·설정에서 동일하게 사용하는 제품 언어 의미 아이콘
- `FormField`: Supporting Text·Validation Error·Feedback 높이의 공통 Text Field 계약
- `SelectField`: 문자열·숫자 Option과 빈 값·오류·도움말의 공통 Select 계약
- `AutocompleteField`: 단일 Entity 선택과 검색 입력의 공통 접근성·오류 계약
- `FormDialog`: 제목·설명·폼 제출·Busy·취소·Secondary Action의 공통 Modal Form 계약
- `ConfirmDialog`: 일반·파괴적 확인, 초기 취소 Focus와 Busy 상태의 공통 계약
- `EmptyState`·`ErrorState`·`LoadingState`: 안정된 높이와 Live Region을 가진 비동기 상태
- `PageCanvas`: 운영형 Fluid Canvas와 집중형 Bounded Canvas의 공통 폭 계약
- `EnterpriseDataGrid`: Client·Server 처리 모드, Toolbar, 검색, 내보내기, 새로고침,
  페이지 간 선택과 Bulk Action을 DWP Density·접근성 계약에 연결
- `DwpDateTimeProvider`: 제품 Locale과 IANA Timezone의 단일 공급자
- `DatePickerField`: Timezone 변환이 없는 `YYYY-MM-DD` 날짜 전용 값 계약
- `DateTimePickerField`: 저장은 UTC ISO Instant, 표시는 제품 Timezone인 일시 계약
- `DateRangePickerField`: 시작·종료 날짜와 순서·최소·최대 범위 검증 계약
- `SourceCitationList`: 근거 이름, 유형, Version·시각과 원본 Link
- `AgentPlanPreview`: 변경 계획, Tool, Risk, 근거와 승인·반려
- `AgentExecutionTimeline`: Step 상태, 실패 원인, Retry와 Handoff

이 API는 제품 기능에서 복제하지 않는다. Filter Bar·Saved View·Tree·Entity Picker·File,
Streaming·Stop·Feedback은 실제 Journey의 Feature Package와 수용 기준이 준비된 뒤 같은
Public Gate로 추가한다.

## Action과 Form 계약

- 화면의 명령은 색상이나 `variant`를 직접 선택하지 않고 제품 의도인
  `primary | secondary | quiet | danger`를 선택한다.
- 비동기 명령은 별도 Spinner를 조합하지 않고 `loading`을 사용한다. Loading 중에는 중복
  제출이 차단되고 Button 크기와 Accessible Name이 유지되어야 한다.
- Icon-only 명령은 `ActionIconButton`의 `label`을 반드시 제공한다. Tooltip은 설명 보조이며
  Accessible Name을 대신하지 않는다.
- 동일한 제품 의미는 화면마다 Lucide 아이콘을 직접 고르지 않고 Semantic Icon을 사용한다.
  크기와 색상은 배치 맥락에 맞추되 아이콘 형태는 변경하지 않는다.
- 필드의 오류는 Supporting Text보다 우선한다. 레이아웃 이동이 문제인 밀집 Form은
  `reserveFeedbackSpace`를 사용한다.
- 화면 Form은 도메인 상태와 검증을 소유하고, 공통 Field는 표시·상태·접근성 계약만
  소유한다. API DTO와 Form 상태를 공통 Component에 넣지 않는다.

## Dialog와 비동기 상태

- Form 제출은 `FormDialog.onSubmit` 하나로 통합하고 Busy 중 닫기와 중복 제출을 막는다.
- 삭제·회수처럼 복구 불가능한 작업만 `ConfirmDialog intent="danger"`를 사용한다. 위험
  Dialog의 초기 Focus는 취소 명령에 둔다.
- 로딩·빈 결과·오류를 임의 Typography 묶음으로 만들지 않는다. Page·Standard·Compact
  크기 중 주변 Layout에 맞는 공통 상태를 사용해 Content Shift를 줄인다.
- Error는 `role="alert"`, Loading은 `role="status"` 계약을 유지한다. 장시간 목록 로딩은
  Skeleton, 짧은 명령 대기는 Button Loading을 사용한다.

## EnterpriseDataGrid 계약

- `mode="client"`: 전달된 Row 안에서 Pagination·Sort·Filter를 처리한다.
- `mode="server"`: `rowCount`, `paginationModel`, `sortModel`, `filterModel`과 각 Change
  Handler를 Feature가 API Query와 연결한다. Grid는 세 처리 모드를 모두 Server로
  고정하고 페이지가 바뀌어도 선택을 보존한다.
- 공통 도구는 `toolbar` 설정으로 Columns·Filter·Quick Search·CSV·Refresh를 제공한다.
  화면별 Button을 Grid 위에 중복 배치하지 않는다.
- Client 모드의 `enableCsvExport`는 메모리에 로드된 결과를 내보낸다. Server 모드는 전체
  Filter 결과를 내보내는 백엔드 Job·Download API를 `onExport`에 연결해야 하며 기본 CSV를
  노출하지 않는다.
- 선택 작업은 `rowSelectionModel`을 제어하고 `selectedCountLabel`과 `bulkActions`를
  제공한다. Exclude Selection Model은 전체 `rowCount`를 기준으로 계산한다.
- MUI X의 기본 Checkbox가 최신 Axe에서 만드는 Indeterminate ARIA 중복은
  `EnterpriseDataGrid` 내부 Native State Adapter가 교정한다. Feature에서 DOM Patch를
  추가하지 않는다.

## 날짜와 시간대 정책

- 생일·적용일·마감일처럼 달력 날짜 자체가 의미인 값은 `YYYY-MM-DD` 문자열로 저장한다.
  UTC 변환이나 자정 `Date` 객체 직렬화를 하지 않는다.
- 게시 시각·실행 시각·감사 시각처럼 순간이 의미인 값은 API와 저장소에서 UTC ISO 8601로
  저장하고 `DwpDateTimeProvider`의 명시적 IANA Timezone으로 표시한다.
- Product Locale은 현재 `ko | en`이며 미지원 Locale은 `en`으로 정규화한다. Timezone은
  유효한 제품 설정을 우선하고 없으면 Browser IANA Zone, 마지막으로 `UTC`를 사용한다.
- 날짜 입력을 사용하는 지연 로드 Route 경계와 Storybook Root에는 공급자를 한 번만 둔다.
  Feature에서 Day.js Plugin을 다시 확장하지 않으며, 로그인처럼 날짜 입력이 없는 초기
  화면 번들에는 Picker Runtime을 포함하지 않는다.
- 범위 값은 `{ start, end }`로 전달하고 열린 범위를 허용하되 닫힌 범위의 역전은
  차단한다. 현재 Community Picker 두 개를 조합하므로 Pro License 의존성이 없다.

## 도입과 강제 규칙

`scripts/check-design-system-adoption.mjs`가 제품 Source의 직접 MUI Button·IconButton,
TextField·Autocomplete, Dialog, DataGrid, Date Picker와 Native Date Input 사용을 TypeScript
AST로 검사한다.

- 기존 직접 사용은 `scripts/design-system-adoption-baseline.json`에 파일·Component별로만
  한시 허용한다.
- 신규 파일의 직접 사용과 기존 파일의 증가분은 `yarn lint`, `yarn build`와
  `yarn design-system:check`를 실패시킨다.
- 기존 화면 전환으로 숫자가 줄면 `yarn design-system:baseline`을 실행해 기준선을
  낮춘다. 증가를 승인하는 용도로 기준선을 갱신하지 않는다.
- 새 화면은 처음부터 Public Component를 사용한다. 기존 화면은 기능 수정 시 인접한
  Action·Form·Dialog·State를 함께 전환하는 Boy Scout 방식으로 줄인다.
- 예외가 필요하면 Public API로 흡수할 제품 의미인지 먼저 검토하고, 일회성 시각 차이는
  Theme·`sx` 범위에서 해결한다.

## Feature 개발

신규 메뉴와 화면은 `docs/00-governance/기능 개발 산출물 및 Gate.md`와
`docs/05-features/<feature-id>/` Package를 먼저 준비한다. Feature 내부에서 Foundation
Token이나 Global Shell 계약을 임의로 변경하지 않는다.
