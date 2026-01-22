# E2E 테스트 data-testid 표준

> **최종 업데이트**: 2026-01-22  
> **목적**: Playwright E2E 테스트를 위한 data-testid 네이밍 규칙 정의

---

## 목차

1. [왜 data-testid를 사용하는가?](#왜-data-testid를-사용하는가)
2. [네이밍 규칙](#네이밍-규칙)
3. [필수 testid (Admin 페이지)](#필수-testid-admin-페이지)
4. [공통 컴포넌트 testid](#공통-컴포넌트-testid)
5. [추가 가이드](#추가-가이드)

---

## 왜 data-testid를 사용하는가?

### ✅ DO: data-testid 기반 selector

```typescript
// ✅ GOOD: 안정적인 selector
await page.getByTestId('page-admin-monitoring').isVisible();
await page.getByTestId('filter-bar').click();
```

**장점**:
- UI 변경에 영향 받지 않음
- 명확한 의도 전달
- Playwright Best Practice

---

### ❌ DON'T: CSS selector, XPath, Text 기반

```typescript
// ❌ BAD: 불안정한 selector
await page.locator('div.MuiBox-root > div:nth-child(2)').isVisible(); // 구조 변경 시 깨짐
await page.locator('//div[@class="filter-bar"]').click(); // CSS class 변경 시 깨짐
await page.getByText('통합 모니터링').isVisible(); // 텍스트 변경 시 깨짐
```

**문제**:
- UI 구조 변경 시 테스트 깨짐 (flaky)
- 다국어 지원 시 텍스트 기반 불가능
- 유지보수 어려움

---

## 네이밍 규칙

### 1️⃣ Page Root

**형식**: `page-<feature>` 또는 `page-<scope>-<feature>`

```typescript
// Admin 페이지
data-testid="page-admin-monitoring"
data-testid="page-admin-users"
data-testid="page-admin-roles"
data-testid="page-admin-resources"
data-testid="page-admin-codes"
data-testid="page-admin-audit"

// AI Workspace
data-testid="page-ai-workspace"

// Dashboard
data-testid="page-dashboard"

// Auth 페이지
data-testid="page-auth-login"
data-testid="page-auth-signup"
```

**위치**: 각 페이지의 최상위 컨테이너

```tsx
// ✅ 예시: apps/remotes/admin/src/pages/monitoring/page.tsx
export const MonitoringPage = () => (
  <Box data-testid="page-admin-monitoring" sx={{ p: 3 }}>
    {/* 페이지 내용 */}
  </Box>
);
```

---

### 2️⃣ 공통 컴포넌트

**형식**: `<component-name>` (kebab-case)

```typescript
// Design System 패턴 컴포넌트
data-testid="filter-bar"
data-testid="data-table"
data-testid="editor-modal"
data-testid="empty-state"
data-testid="confirm-dialog"
data-testid="toolbar-actions"
data-testid="selectable-card"
data-testid="two-column-layout"

// 기타 공통 컴포넌트
data-testid="permission-gate"
data-testid="approval-dialog"
```

**위치**: `libs/design-system/src/components/patterns/` 컴포넌트의 루트 요소

```tsx
// ✅ 예시: libs/design-system/src/components/patterns/filter-bar/filter-bar.tsx
export const FilterBar = ({ controls, actions }: FilterBarProps) => (
  <Stack data-testid="filter-bar" direction={{ xs: 'column', sm: 'row' }} spacing={2}>
    {controls}
    {actions}
  </Stack>
);
```

---

### 3️⃣ Feature 전용 컴포넌트

**형식**: `<feature>-<component>` (kebab-case)

```typescript
// Roles 페이지
data-testid="roles-list-panel"
data-testid="roles-detail-panel"
data-testid="roles-permission-matrix"
data-testid="roles-members-tab"

// Users 페이지
data-testid="users-filter-bar"
data-testid="users-table"
data-testid="users-editor-modal"

// Monitoring 페이지
data-testid="monitoring-kpi-cards"
data-testid="monitoring-charts"
data-testid="monitoring-tabs"
```

**위치**: `apps/remotes/<app>/src/pages/<feature>/components/` 컴포넌트의 루트 요소

```tsx
// ✅ 예시: apps/remotes/admin/src/pages/roles/components/role-list-panel.tsx
export const RoleListPanel = ({ roles, onSelect }: RoleListPanelProps) => (
  <Box data-testid="roles-list-panel" sx={{ height: '100%' }}>
    {/* 컴포넌트 내용 */}
  </Box>
);
```

---

### 4️⃣ 액션 버튼

**형식**: `<action>-<target>-btn` (kebab-case)

```typescript
// 생성/추가
data-testid="create-user-btn"
data-testid="add-role-btn"
data-testid="add-member-btn"

// 편집/수정
data-testid="edit-user-btn"
data-testid="update-role-btn"

// 삭제
data-testid="delete-user-btn"
data-testid="remove-member-btn"

// 검색/필터
data-testid="search-btn"
data-testid="filter-btn"
data-testid="reset-filter-btn"

// 저장/취소
data-testid="save-btn"
data-testid="cancel-btn"
data-testid="submit-btn"
```

**위치**: 액션 버튼 요소

```tsx
// ✅ 예시
<Button
  data-testid="create-user-btn"
  variant="contained"
  startIcon={<Iconify icon="mingcute:add-line" />}
  onClick={handleCreate}
>
  사용자 추가
</Button>
```

---

### 5️⃣ Form 입력 요소

**형식**: `<field-name>-input` (kebab-case)

```typescript
// 텍스트 입력
data-testid="username-input"
data-testid="email-input"
data-testid="search-keyword-input"

// Select / Dropdown
data-testid="status-select"
data-testid="role-select"
data-testid="department-select"

// Date / Time
data-testid="date-from-input"
data-testid="date-to-input"
```

**위치**: Form 입력 컴포넌트

```tsx
// ✅ 예시
<TextField
  data-testid="username-input"
  label="사용자명"
  fullWidth
  value={formData.userName}
  onChange={(e) => onFormChange('userName', e.target.value)}
/>
```

---

## 필수 testid (Admin 페이지)

### Monitoring (통합 모니터링)

```typescript
// Page Root
data-testid="page-admin-monitoring"

// 필수 컴포넌트
data-testid="filter-bar"                // MonitoringFilterBar
data-testid="monitoring-kpi-cards"      // MonitoringKPICards
data-testid="monitoring-charts"         // MonitoringCharts
data-testid="monitoring-tabs"           // MonitoringTabs
data-testid="data-table"                // 각 탭의 테이블
data-testid="empty-state"               // 데이터 없을 때
```

---

### Users (사용자 관리)

```typescript
// Page Root
data-testid="page-admin-users"

// 필수 컴포넌트
data-testid="filter-bar"                // UsersFilters
data-testid="data-table"                // UsersTable
data-testid="editor-modal"              // UserEditorModal
data-testid="confirm-dialog"            // DeleteConfirmDialog
data-testid="empty-state"               // 데이터 없을 때

// 액션 버튼
data-testid="create-user-btn"
data-testid="edit-user-btn"
data-testid="delete-user-btn"
```

---

### Roles (권한 관리)

```typescript
// Page Root
data-testid="page-admin-roles"

// 필수 컴포넌트
data-testid="two-column-layout"         // TwoColumnLayout
data-testid="roles-list-panel"          // 좌측 목록
data-testid="roles-detail-panel"        // 우측 상세
data-testid="empty-state"               // 선택 전 상태
data-testid="editor-modal"              // RoleEditorModal
data-testid="confirm-dialog"            // DeleteConfirmDialog

// 탭
data-testid="roles-overview-tab"
data-testid="roles-members-tab"
data-testid="roles-permissions-tab"

// 액션 버튼
data-testid="create-role-btn"
data-testid="edit-role-btn"
data-testid="delete-role-btn"
```

---

### Resources (리소스 관리)

```typescript
// Page Root
data-testid="page-admin-resources"

// 필수 컴포넌트
data-testid="filter-bar"                // ResourcesFilters
data-testid="resources-tree"            // ResourcesTree
data-testid="editor-modal"              // ResourceEditorModal
data-testid="confirm-dialog"            // DeleteConfirmDialog
data-testid="empty-state"               // 데이터 없을 때

// 액션 버튼
data-testid="create-resource-btn"
data-testid="edit-resource-btn"
data-testid="delete-resource-btn"
```

---

## 공통 컴포넌트 testid

### libs/design-system 컴포넌트

| 컴포넌트 | testid | 파일 경로 |
|---------|--------|-----------|
| FilterBar | `filter-bar` | `patterns/filter-bar/filter-bar.tsx` |
| DataTable | `data-table` | `patterns/data-table/data-table.tsx` |
| EmptyState | `empty-state` | `patterns/empty-state/empty-state.tsx` |
| ConfirmDialog | `confirm-dialog` | `patterns/confirm-dialog/confirm-dialog.tsx` |
| EditorModal | `editor-modal` | `patterns/editor-modal/editor-modal.tsx` |
| ToolbarActions | `toolbar-actions` | `patterns/toolbar-actions/toolbar-actions.tsx` |
| SelectableCard | `selectable-card` | `patterns/selectable-card/selectable-card.tsx` |
| TwoColumnLayout | `two-column-layout` | `patterns/two-column-layout/two-column-layout.tsx` |

---

## 추가 가이드

### 1️⃣ testid는 UI 변경 없이 추가

```tsx
// ✅ GOOD: 기존 요소에 testid만 추가
<Box data-testid="page-admin-monitoring" sx={{ p: 3 }}>
  {/* 기존 내용 */}
</Box>

// ❌ BAD: 불필요한 래퍼 추가
<div data-testid="page-admin-monitoring">
  <Box sx={{ p: 3 }}>
    {/* 기존 내용 */}
  </Box>
</div>
```

---

### 2️⃣ 조건부 렌더링 시 주의

```tsx
// ✅ GOOD: 조건에 관계없이 testid 유지
{isLoading ? (
  <Skeleton data-testid="data-table-skeleton" />
) : data.length === 0 ? (
  <EmptyState data-testid="empty-state" />
) : (
  <DataTable data-testid="data-table" />
)}
```

---

### 3️⃣ 동적 testid는 최소화

```tsx
// ⚠️ 가능하지만 최소화
{roles.map((role) => (
  <Card key={role.id} data-testid={`role-card-${role.id}`}>
    {role.name}
  </Card>
))}

// ✅ 더 나은 방법: 고정 testid + index
{roles.map((role, index) => (
  <Card key={role.id} data-testid="role-card" data-index={index}>
    {role.name}
  </Card>
))}
```

---

### 4️⃣ testid는 최상위 요소에만

```tsx
// ✅ GOOD: 컴포넌트 루트에만 testid
export const RoleListPanel = () => (
  <Box data-testid="roles-list-panel">
    <Stack spacing={1}>
      {/* 내부 요소는 testid 불필요 */}
      <Typography variant="h6">권한 목록</Typography>
      <List>{/* ... */}</List>
    </Stack>
  </Box>
);

// ❌ BAD: 모든 요소에 testid (과도)
export const RoleListPanel = () => (
  <Box data-testid="roles-list-panel">
    <Stack data-testid="roles-list-stack" spacing={1}>
      <Typography data-testid="roles-list-title" variant="h6">권한 목록</Typography>
      <List data-testid="roles-list">{/* ... */}</List>
    </Stack>
  </Box>
);
```

---

## 참고 문서

- **[E2E 스모크 테스트 가이드](./E2E_SMOKE_TESTS.md)**: Playwright 실행 방법
- **[Playwright 공식 문서](https://playwright.dev/)**: Locator Best Practices
- **[Design System](../essentials/DESIGN_SYSTEM.md)**: 공통 컴포넌트 카탈로그

---

## 정기 업데이트

- **신규 페이지 추가 시**: testid 표준에 따라 추가
- **공통 컴포넌트 추가 시**: 이 문서에 testid 등록
- **월 1회**: testid 누락 페이지 확인

---

**testid는 E2E 테스트의 안정성을 보장합니다! 🎯**
