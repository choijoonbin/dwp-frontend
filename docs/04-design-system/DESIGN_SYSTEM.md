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

- `EnterpriseDataGrid`: MUI X Community를 DWP Density·상태·접근성 계약에 연결
- `SourceCitationList`: 근거 이름, 유형, Version·시각과 원본 Link
- `AgentPlanPreview`: 변경 계획, Tool, Risk, 근거와 승인·반려
- `AgentExecutionTimeline`: Step 상태, 실패 원인, Retry와 Handoff

이 API는 R0 Reference이며 제품 기능에서 복제하지 않는다. Filter·Form·Date·Tree·File,
Streaming·Stop·Feedback은 각각 실제 Journey의 Feature Package와 수용 기준이 준비된 뒤
같은 Public Gate로 추가한다.

## Feature 개발

신규 메뉴와 화면은 `docs/00-governance/기능 개발 산출물 및 Gate.md`와
`docs/05-features/<feature-id>/` Package를 먼저 준비한다. Feature 내부에서 Foundation
Token이나 Global Shell 계약을 임의로 변경하지 않는다.
