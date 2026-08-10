# DWP UI Foundation 전략

> 상태: R0.5 Foundation Decision v2.0
>
> 기준일: 2026-08-08
>
> 대상: `dwp-frontend`

## 1. 최종 결정

DWP는 외부 Admin Template을 제품 기반으로 사용하지 않는다. React, TypeScript,
Vite, MUI와 Emotion은 공개 Library로 사용하되, Product Token, Appearance Policy,
Component, Shell, 업무 Pattern과 AI Pattern은 DWP가 직접 소유한다.

- 외부 Template에서 파생된 Theme·Palette·Shadow·Typography·Icon·Logo Wrapper 제거
- 외부 배경·Favicon·Font Package와 Demo UI 제거
- Root Tooling과 ESLint·Prettier·Vite Configuration 독립 작성
- DTCG 2025.10 형식의 DWP Token Source 추가
- Product·Tenant·User 세 계층의 Appearance Policy 구현
- Lucide와 MUI 공개 API로 Shell·Account·Preference 화면 재작성
- DWP 원저작물은 `UNLICENSED`로 명시하고 외부 Delivery License는 별도 결정

다른 Template으로 교체하지 않는다. 참고 제품에서 좋은 동작을 발견하더라도 문제와
원리를 먼저 정의하고 DWP 계약으로 다시 설계한다.

## 2. 설정 기능은 삭제되지 않는다

`사용자 설정에서 제외`는 기능을 없앤다는 의미가 아니다. 제어 책임을 다음과 같이
분리한다.

### 2.1 Product 기본값

제품 전체에서 변하지 않아야 하는 접근성, Semantic Status, Component State와
Responsive Rule을 정의한다. 고객이나 사용자가 임의로 변경할 수 없다.

### 2.2 Tenant 관리 정책

조직 Brand와 운영 정책에 해당하는 기능이다. Tenant 관리자 또는 배포 Configuration이
승인된 범위 안에서 설정한다.

- Product Name과 Logo Asset
- Brand Accent
- 승인된 Product Font
- Desktop Navigation Pattern: Sidebar, Rail, Top
- 사용자에게 허용할 Mode·Density·접근성 Option

### 2.3 사용자 선호

사용자 업무 효율과 접근성을 높이면서 제품 일관성을 해치지 않는 항목이다.

- System·Light·Dark
- High Contrast
- Compact·Standard·Comfortable Density
- Reduced Motion
- Language
- Sidebar Collapse처럼 현재 Session의 작업 공간을 조정하는 동작

### 2.4 설정별 정책

| 기능              | Engine 유지 | Product                | Tenant Admin          | User                 |
| ----------------- | ----------- | ---------------------- | --------------------- | -------------------- |
| Color Mode        | 예          | Scheme과 Contrast Gate | 허용 Mode 제한        | System·Light·Dark    |
| High Contrast     | 예          | WCAG 기준              | 강제·허용 정책        | 허용 시 선택         |
| Density           | 예          | 세 가지 Token          | Default·허용 범위     | 허용 시 선택         |
| Font Family       | 예          | Approved Font 계약     | 승인 목록에서 선택    | 직접 선택하지 않음   |
| Brand Color       | 예          | Semantic Color 보호    | Accent Slot 설정      | 직접 선택하지 않음   |
| Navigation Layout | 예          | Responsive Rule        | Sidebar·Rail·Top 설정 | Collapse만 허용 가능 |
| RTL               | 예          | Locale 계약            | 지원 Locale 활성화    | Locale에 따라 자동   |

현재 Preference 화면은 사용자 항목을 조작하고 Product Font, Brand Accent와 Navigation
Pattern의 Tenant 적용 상태를 `Managed`로 보여준다. 향후 Admin 기능은 같은 Policy
Contract를 Backend Configuration API와 연결한다.

## 3. Source Architecture

```text
libs/design-system/
  tokens/
    dwp.tokens.json
  src/
    appearance/
      appearance-policy.ts
      appearance-provider.tsx
    foundation/
      tokens.ts
      foundation.stories.tsx
    theme/
      build-theme.ts
    components/
      access-boundary/
      product-mark/
      toast-viewport/
    styles/
      global.css
```

### 3.1 Token

`tokens/dwp.tokens.json`이 도구 독립 Source다. Color는 sRGB Component와 Hex Metadata를,
Dimension은 값과 Unit을, Motion은 Duration을 명시한다. TypeScript Adapter는 Token을
MUI Theme와 Storybook에 연결한다.

### 3.2 Appearance Policy

`AppearancePolicy`는 다음 우선순위를 적용한다.

```text
Product invariant -> Tenant policy -> Allowed user preference -> OS preference
```

허용되지 않은 Font, Accent와 Navigation 값은 적용하지 않는다. 사용자 선호는
Versioned Local Storage에 저장하며 향후 User Preference API로 동기화할 수 있다.

### 3.3 Theme

Theme는 Mode, Contrast, Density, Reduced Motion, Tenant Accent와 Font를 입력받아
매번 결정적으로 생성한다.

- Dark Mode는 Tenant Accent를 그대로 사용하지 않고 대비가 검증된 Action Color 사용
- Focus Visible은 모든 Interactive Control에서 명확히 표시
- Radius는 4·6·8px 범위
- Operational Surface는 Border 중심, Shadow 최소화
- Control Height와 Table Cell Padding은 Density Token으로 변경
- Heading은 Viewport에 따라 과도하게 확대하지 않음

## 4. 목표 Experience

### Global Shell

- Product·Workspace 식별
- 통합 Search와 향후 Ask DWP
- Notification과 Approval 상태
- Account, Preference, Security·Session과 Logout
- Tenant Policy 기반 Navigation Pattern
- Mobile Navigation Drawer와 Desktop Sidebar·Rail·Top 대응

### 업무 Surface

- Today: Daily Brief, 우선순위 업무, 일정과 추천 이유
- Work: Task·Approval·Request Queue와 List·Detail Split View
- Apps: Entitlement 기반 App, 최근 사용과 즐겨찾기
- Ask: 권한 기반 검색, 출처와 후속 Action
- Activity: Human·System·Agent 실행 상태, Policy, Tool, 결과와 Audit Reference
- Services: HR·IT·Workplace Request와 SLA
- Admin: Tenant, App, Connector, Agent Policy와 Audit

### AI 신뢰 Pattern

- AI Label과 응답 상태
- Source Citation, 권한과 최신성
- 추천 이유와 불확실성
- 실행 전 Plan, 변경 대상, 예상 결과와 Risk Tier
- 승인·수정·반려·중지·재시도
- 부분 성공, Compensation과 Human Handoff
- Execution Timeline과 Audit ID

## 5. 현재 구현 상태

### 완료

- [x] 외부 Template 파생 Theme·Utility·Icon·Logo Source 제거
- [x] 동일한 정적 배경·Favicon·Font와 Icon Dependency 제거
- [x] Root ESLint·Prettier·Vite Configuration 독립 재작성
- [x] DTCG 2025.10 Token Draft 추가
- [x] Product·Tenant·User Appearance Policy 구현
- [x] Light·Dark·High Contrast, Density와 Reduced Motion Engine 구현
- [x] Sidebar·Rail·Top Navigation Policy Engine 구현
- [x] Shell, Account, Preference, Security 화면 독립 구현
- [x] Premium Global Shell·Work Pulse와 Home·Work·Ask·Activity·Apps Reference 구현
- [x] 권한 기반 Global Search·Ask Command Palette와 `⌘/Ctrl+K` Keyboard 계약 구현
- [x] 권한 App Group·Reorder·Folder·비 Drag 대체 조작과 개인 저장 구현
- [x] Human·System·Agent Unified Activity와 AI Trust Surface 구현
- [x] Desktop·Mobile Login·Shell E2E와 Axe 통과
- [x] Typecheck, Lint와 Production Build 통과

### 남은 R0.5 Gate

- [ ] DWP Product Brand와 최종 Font 승인
- [ ] DTCG Token을 Figma Variable과 동기화 (라이선스 준비 시까지 보류)
- [x] Enterprise Reference Component와 AI Trust Pattern Storybook 구현
- [x] Desktop·Mobile 자동 Visual Baseline 구축
- [ ] Desktop 1440·1280, Tablet, Mobile 수동 Visual 승인
- [ ] Screen Reader, Keyboard, 200% Zoom과 Manual High Contrast Review
- [ ] 디자인 파트너와 Shell·Home·Work·Ask·Activity·Apps Flow 검증
- [x] Dependency License Report 자동화
- [ ] SBOM 자동화
- [ ] 외부 Delivery용 Git History 정책 승인

## 6. License와 Git History

현재 Working Tree와 Production Bundle Source에는 초기 외부 Template의 Source,
Asset, Font·Icon Dependency와 식별 문자열을 남기지 않는다. Dependency는 각 공개
Library의 License를 따르며 자동 Report와 SBOM을 Release Gate에 둔다.

과거 Commit을 포함한 Git History는 별도 문제다. 전체 History를 전달하면 삭제 전
Source가 조회될 수 있다. 완전한 Clean Delivery가 필요하면 최종 R0.5 검증 후 다음 중
하나를 선택한다.

현재는 사용자 결정에 따라 `dwp-dev`의 로컬 커밋 이력만 갱신하고 Remote Push는 별도
지시가 있을 때까지 보류한다. Figma 쓰기 작업도 라이선스 준비 확인 전까지 보류한다.

1. `dwp-dev`를 단일 Clean Root Commit으로 다시 생성하고 Remote를 명시적으로 갱신
2. 외부 Delivery용 신규 Repository를 Clean Export로 생성
3. 내부 History는 보존하고 외부 Release Artifact만 Source Snapshot으로 제공

첫 번째 방식은 Remote History를 변경하므로 Repository Owner의 명시적 승인과 세
Repository의 동일한 전환 시점이 필요하다.

## 7. R1 진입 조건

R1 Feature 구현은 다음 조건을 만족한 뒤 시작한다.

- Foundation Token과 Figma Variable 승인
- Shell과 핵심 Floorplan 디자인 파트너 검증
- R1 필수 Enterprise·AI Component Storybook 준비
- 접근성·Visual·License·SBOM Gate 통과
- Feature Package 문서와 G0~G3 승인

## 8. 참고 기준

- [Design Tokens Format Module 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [MUI Theme Variables](https://mui.com/material-ui/customization/css-theme-variables/overview/)
- [MUI X Licensing](https://mui.com/x/introduction/licensing/)
- [Microsoft Fluent Design Tokens](https://fluent2.microsoft.design/design-tokens)
- [IBM Carbon for AI](https://carbondesignsystem.com/guidelines/carbon-for-ai/)
- [SAP Fiori Design System](https://experience.sap.com/fiori-design-web/sap-fiori/)
- [ServiceNow Horizon Design System](https://horizon.servicenow.com/getting-started/about-horizon)
