# 디자인 시스템 & 컴포넌트 카탈로그

**최종 업데이트**: 2026-01-22

이 문서는 DWP Frontend의 디자인 시스템 규칙과 공통 컴포넌트 카탈로그를 제공합니다.

---

## 📋 목차

1. [디자인 시스템 철학](#디자인-시스템-철학)
2. [테마 토큰](#테마-토큰)
3. [공통 컴포넌트 카탈로그](#공통-컴포넌트-카탈로그)
4. [레이아웃 패턴](#레이아웃-패턴)
5. [스타일링 가이드](#스타일링-가이드)
6. [신규 컴포넌트 추가 프로세스](#신규-컴포넌트-추가-프로세스)

---

## 디자인 시스템 철학

### Single Source of Truth
**모든 공통 UI는 `libs/design-system`에만 배치합니다.**

```
libs/design-system/
├── src/
│   ├── components/       # 공통 컴포넌트
│   ├── theme/           # MUI 테마 설정
│   └── hooks/           # 공통 훅
└── index.ts
```

### 핵심 원칙
1. **재사용성**: 동일한 패턴은 반드시 공통화
2. **일관성**: 모든 페이지에서 동일한 UI/UX
3. **유지보수성**: 한 곳만 수정하면 전체 반영
4. **문서화**: 모든 컴포넌트는 사용법 문서 필수

---

## 테마 토큰

### 색상 (Palette)

#### 주요 색상
```typescript
theme.palette.primary.main       // 메인 컬러
theme.palette.primary.light      // 밝은 메인 컬러
theme.palette.primary.dark       // 어두운 메인 컬러
theme.palette.primary.lighter    // 아주 밝은 메인 컬러 (배경용)
theme.palette.primary.darker     // 아주 어두운 메인 컬러

theme.palette.secondary.main     // 보조 컬러
theme.palette.error.main         // 에러 컬러
theme.palette.warning.main       // 경고 컬러
theme.palette.info.main          // 정보 컬러
theme.palette.success.main       // 성공 컬러
```

#### 텍스트 색상
```typescript
theme.palette.text.primary       // 주요 텍스트 (검정/흰색)
theme.palette.text.secondary     // 보조 텍스트 (회색)
theme.palette.text.disabled      // 비활성 텍스트 (연한 회색)
```

#### 배경 색상
```typescript
theme.palette.background.default // 기본 배경 (밝은 회색/어두운 회색)
theme.palette.background.paper   // 카드 배경 (흰색/어두운 회색)
theme.palette.background.neutral // 중립 배경
```

#### 액션 색상 (선택/호버)
```typescript
theme.palette.action.selected    // 선택된 항목 배경
theme.palette.action.hover       // 호버 시 배경
theme.palette.action.disabled    // 비활성 상태
theme.palette.divider            // 구분선
```

### 간격 (Spacing)
```typescript
theme.spacing(1)  // 8px
theme.spacing(2)  // 16px
theme.spacing(3)  // 24px
theme.spacing(4)  // 32px

// 사용 예시
<Box sx={{ p: 2, m: 3 }}>  // padding: 16px, margin: 24px
```

### 반응형 Breakpoints
```typescript
theme.breakpoints.up('xs')    // ≥ 0px
theme.breakpoints.up('sm')    // ≥ 600px
theme.breakpoints.up('md')    // ≥ 900px
theme.breakpoints.up('lg')    // ≥ 1200px
theme.breakpoints.up('xl')    // ≥ 1536px
```

### 테마 토큰 사용 예시

#### ✅ 올바른 사용
```typescript
<Box sx={{
  bgcolor: 'background.paper',
  color: 'text.primary',
  p: 2,
  borderRadius: 1,
  border: 1,
  borderColor: 'divider',
}}>
```

#### ❌ 잘못된 사용 (하드코딩)
```typescript
<Box sx={{
  backgroundColor: '#ffffff',
  color: '#000000',
  padding: '16px',
  borderRadius: '8px',
  border: '1px solid #e0e0e0',
}}>
```

---

## 공통 컴포넌트 카탈로그

### 기본 컴포넌트

#### 1. Iconify (아이콘)
**위치**: `libs/design-system/src/components/iconify`

```typescript
import { Iconify } from '@dwp-frontend/design-system';

<Iconify icon="solar:user-bold-duotone" width={24} />
<Iconify icon="solar:settings-bold" width={20} sx={{ color: 'primary.main' }} />
```

**아이콘 검색**: https://icon-sets.iconify.design/

**✅ Do**:
- Iconify만 사용
- 의미에 맞는 아이콘 선택

**❌ Don't**:
- Lucide, Heroicons, MUI Icons 직접 사용

---

#### 2. Logo (로고)
**위치**: `libs/design-system/src/components/logo`

```typescript
import { Logo } from '@dwp-frontend/design-system';

<Logo />
<Logo size={48} />
```

---

#### 3. Label (레이블/뱃지)
**위치**: `libs/design-system/src/components/label`

```typescript
import { Label } from '@dwp-frontend/design-system';

<Label color="success">활성</Label>
<Label color="error">비활성</Label>
<Label color="warning">대기</Label>
```

---

#### 4. Scrollbar (커스텀 스크롤바)
**위치**: `libs/design-system/src/components/scrollbar`

```typescript
import { Scrollbar } from '@dwp-frontend/design-system';

<Scrollbar sx={{ height: '100%' }}>
  <Box sx={{ p: 2 }}>
    {/* 긴 콘텐츠 */}
  </Box>
</Scrollbar>
```

**✅ Do**:
- Fixed 모드 페이지의 내부 스크롤에 사용
- `height: '100%'` 또는 `flex: 1, minHeight: 0` 설정

**❌ Don't**:
- Scrollable 모드 페이지에서 사용 (브라우저 스크롤 사용)

---

#### 5. Chart (차트)
**위치**: `libs/design-system/src/components/chart`

```typescript
import { Chart } from '@dwp-frontend/design-system';

<Chart
  type="line"
  series={[{ name: 'PV', data: [30, 40, 45, 50] }]}
  options={{
    xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr'] },
  }}
/>
```

---

#### 6. PermissionGate (권한 제어)
**위치**: `libs/design-system/src/components/permission-gate`

```typescript
import { PermissionGate } from '@dwp-frontend/design-system';

<PermissionGate resource="menu.admin.menus" permission="CREATE">
  <Button>생성</Button>
</PermissionGate>
```

---

### 패턴 컴포넌트 (libs/design-system/patterns)

아래 8개 패턴 컴포넌트는 **사용 가능** 상태이며, Admin CRUD 화면 개발 시 반드시 사용해야 합니다.

---

#### 1. EmptyState ✅
**상태**: ✅ 사용 가능  
**위치**: `libs/design-system/src/components/patterns/empty-state`  
**용도**: 데이터 없음/검색 결과 없음/권한 없음 상태 표시

**Props**:
```typescript
type EmptyStateProps = {
  title?: string;              // 기본값: "데이터가 없습니다"
  description?: string;
  icon?: ReactNode;            // Iconify 아이콘 권장
  action?: ReactNode;          // 버튼 등
  minHeight?: number | string; // 기본값: 240
};
```

**사용 예시**:
```typescript
import { EmptyState } from '@dwp-frontend/design-system';
import { Iconify } from '@dwp-frontend/design-system';
import Button from '@mui/material/Button';

// ✅ DO: 아이콘과 액션 버튼 포함
<EmptyState
  title="권한을 선택하세요"
  description="좌측에서 권한을 선택하거나 새 권한을 생성하세요."
  icon={<Iconify icon="solar:shield-user-bold-duotone" width={28} />}
  action={
    <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={onCreate}>
      새 권한 생성
    </Button>
  }
/>
```

**적용 화면**:
- ✅ Admin 권한 관리: `apps/remotes/admin/src/pages/roles`
- 권한 목록 멤버 탭 빈 상태
- 권한 선택 전 우측 상세 빈 상태

---

#### 2. ConfirmDialog ✅
**상태**: ✅ 사용 가능  
**위치**: `libs/design-system/src/components/patterns/confirm-dialog`  
**용도**: 삭제/비활성화 등 위험한 작업 확인

**Props**:
```typescript
type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;        // 기본값: "확인"
  cancelText?: string;         // 기본값: "취소"
  severity?: 'default' | 'danger'; // 기본값: 'default'
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};
```

**사용 예시**:
```typescript
import { ConfirmDialog } from '@dwp-frontend/design-system';

// ✅ DO: 삭제 확인은 severity='danger' 사용
<ConfirmDialog
  open={deleteDialogOpen}
  title="사용자 삭제"
  description="정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
  confirmText="삭제"
  cancelText="취소"
  severity="danger"
  loading={isDeleting}
  onConfirm={handleDelete}
  onClose={handleCloseDialog}
/>
```

**적용 화면**:
- ✅ Admin 사용자 관리: `apps/remotes/admin/src/pages/users`
- 사용자 삭제 확인

---

#### 3. SelectableCard ✅
**상태**: ✅ 사용 가능  
**위치**: `libs/design-system/src/components/patterns/selectable-card`  
**용도**: 좌측 목록 선택 카드 (메뉴 관리, 권한 관리)

**Props**:
```typescript
type SelectableCardProps = {
  selected: boolean;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  onClick?: () => void;
};
```

**사용 예시**:
```typescript
import { SelectableCard } from '@dwp-frontend/design-system';
import Chip from '@mui/material/Chip';

// ✅ DO: 선택 상태를 명확히 표시
<SelectableCard
  selected={selectedId === role.id}
  onClick={() => onSelect(role.id)}
  title={role.roleName}
  subtitle={role.roleCode}
  meta={<Chip label={role.status} color={role.statusColor} size="small" />}
/>
```

**토큰 규칙**:
- 선택 상태 배경: `action.selected`
- 호버 배경: `action.hover`
- 선택 상태 텍스트: `primary.main`

**참고 구현**:
- Admin 권한 관리 RoleCard: `apps/remotes/admin/src/pages/roles/components/role-list-panel.tsx`

---

#### 4. TwoColumnLayout ✅
**상태**: ✅ 사용 가능  
**위치**: `libs/design-system/src/components/patterns/two-column-layout`  
**용도**: 좌측 목록 + 우측 상세 분할 레이아웃

**Props**:
```typescript
type TwoColumnLayoutProps = {
  left: ReactNode;
  right: ReactNode;
  leftWidth?: number;          // 기본값: 320
  minRightWidth?: number;      // 기본값: 520
  stickyHeader?: boolean;      // 기본값: false
  mode?: 'fixed' | 'scrollable'; // 기본값: 'scrollable'
};
```

**사용 예시**:
```typescript
import { TwoColumnLayout } from '@dwp-frontend/design-system';

// ✅ DO: Fixed 모드에서 사용
<TwoColumnLayout
  mode="fixed"
  left={<RoleListPanel />}
  right={<RoleDetailPanel />}
  leftWidth={320}
  minRightWidth={520}
/>
```

**반응형**:
- xs/sm: 좌우 → 상하 stack 자동 전환
- md+: 좌우 분할 유지

**참고 구현**:
- Admin 권한 관리: `apps/remotes/admin/src/pages/roles/page.tsx`
- Admin 메뉴 관리: `apps/remotes/admin/src/pages/menus/page.tsx`

---

#### 5. FilterBar ✅
**상태**: ✅ 사용 가능  
**위치**: `libs/design-system/src/components/patterns/filter-bar`  
**용도**: 검색/필터/액션 버튼 영역 표준화

**Props**:
```typescript
type FilterBarProps = {
  controls?: ReactNode;        // 검색/필터 컨트롤
  actions?: ReactNode;         // 액션 버튼
  spacing?: number;            // 기본값: 2
};
```

**사용 예시**:
```typescript
import { FilterBar } from '@dwp-frontend/design-system';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

// ✅ DO: 좌측 컨트롤, 우측 액션
<FilterBar
  controls={
    <>
      <TextField placeholder="검색" size="small" />
      <Select size="small">...</Select>
    </>
  }
  actions={
    <>
      <Button variant="contained">추가</Button>
      <Button variant="outlined">다운로드</Button>
    </>
  }
/>
```

**반응형**:
- xs: 세로 stack (controls → actions)
- sm+: 가로 배치

**참고 구현**:
- Admin 통합 모니터링: `apps/remotes/admin/src/pages/monitoring/monitoring-filter-bar.tsx`

---

#### 6. ToolbarActions ✅
**상태**: ✅ 사용 가능  
**위치**: `libs/design-system/src/components/patterns/toolbar-actions`  
**용도**: 버튼 그룹 정렬 표준화

**Props**:
```typescript
type ToolbarActionsProps = {
  left?: ReactNode;
  right?: ReactNode;
  spacing?: number;            // 기본값: 1
};
```

**사용 예시**:
```typescript
import { ToolbarActions } from '@dwp-frontend/design-system';
import Button from '@mui/material/Button';

// ✅ DO: 좌측/우측 버튼 그룹 분리
<ToolbarActions
  left={
    <>
      <Button variant="outlined">필터</Button>
      <Button variant="outlined">정렬</Button>
    </>
  }
  right={
    <>
      <Button variant="contained">저장</Button>
      <Button variant="outlined">취소</Button>
    </>
  }
/>
```

**참고 구현**:
- Admin 권한 관리 헤더: `apps/remotes/admin/src/pages/roles/components/role-list-panel.tsx`

---

#### 7. DataTable ✅
**상태**: ✅ 사용 가능  
**위치**: `libs/design-system/src/components/patterns/data-table`  
**용도**: 테이블 컨테이너 (로딩/빈 상태/스크롤 통일)

**Props**:
```typescript
type DataTableProps = {
  title?: string;
  toolbar?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyNode?: ReactNode;
  children: ReactNode;         // 실제 Table
};
```

**사용 예시**:
```typescript
import { DataTable } from '@dwp-frontend/design-system';
import Table from '@mui/material/Table';

// ✅ DO: 테이블 감싸기 + 빈 상태 처리
<DataTable
  title="사용자 목록"
  toolbar={<Button>추가</Button>}
  loading={isLoading}
  empty={users.length === 0}
  emptyNode={<EmptyState title="사용자가 없습니다" />}
>
  <Table>
    {/* 테이블 내용 */}
  </Table>
</DataTable>
```

**반응형**:
- 테이블은 `overflowX: auto` 자동 적용
- 모바일에서 가로 스크롤 허용 (컬럼 숨김 금지)

**참고 구현**:
- Admin 통합 모니터링 탭: `apps/remotes/admin/src/pages/monitoring/monitoring-tabs.tsx`

---

#### 8. EditorModal ✅
**상태**: ✅ 사용 가능  
**위치**: `libs/design-system/src/components/patterns/editor-modal`  
**용도**: 생성/편집/보기 모달 표준화

**Props**:
```typescript
type EditorModalProps = {
  open: boolean;
  title: string;
  mode: 'create' | 'edit' | 'view';
  onClose: () => void;
  onSubmit?: () => void;
  loading?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  fullScreen?: boolean;        // 기본값: false
};
```

**사용 예시**:
```typescript
import { EditorModal } from '@dwp-frontend/design-system';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';

// ✅ DO: mode에 따라 동작 자동 조정
<EditorModal
  open={open}
  title={mode === 'create' ? '사용자 추가' : '사용자 편집'}
  mode={mode}
  onClose={handleClose}
  onSubmit={handleSubmit}
  loading={isSubmitting}
>
  <Stack spacing={2}>
    <TextField label="이름" fullWidth />
    <TextField label="이메일" fullWidth />
  </Stack>
</EditorModal>
```

**동작 규칙**:
- `view` 모드: 저장 버튼 자동 숨김
- xs: fullScreen 옵션 가능
- 확인/취소 버튼 자동 제공

**참고 구현**:
- Admin 사용자 관리: `apps/remotes/admin/src/pages/users/components/user-editor-modal.tsx`

---

## 레이아웃 패턴

### 1. 좌우 분할 레이아웃 (Two Column)
**사용 케이스**: 메뉴 관리, 권한 관리

```typescript
<Box sx={{ p: 3, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
  <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
    {/* 좌측 목록 */}
    <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', minHeight: 0, height: 1 }}>
      <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <LeftPanel />
      </Card>
    </Grid>
    {/* 우측 상세 */}
    <Grid size={{ xs: 12, md: 8 }} sx={{ display: 'flex', minHeight: 0, height: 1 }}>
      <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <RightPanel />
      </Card>
    </Grid>
  </Grid>
</Box>
```

### 2. 세로 나열 레이아웃 (Stacked)
**사용 케이스**: 대시보드, 모니터링

```typescript
<Box sx={{ p: 3 }}>
  <Stack spacing={3}>
    <Typography variant="h4">제목</Typography>
    <Card><KPICards /></Card>
    <Card><Charts /></Card>
    <Card><DataTable /></Card>
  </Stack>
</Box>
```

### 3. 그리드 레이아웃 (Grid)
**사용 케이스**: 카드 형태의 목록

```typescript
<Box sx={{ p: 3 }}>
  <Grid container spacing={2}>
    {items.map((item) => (
      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
        <Card>
          <CardContent>{item.name}</CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
</Box>
```

---

## 스타일링 가이드

### MUI System (`sx` prop)
**권장**: 대부분의 스타일링은 `sx` prop 사용

```typescript
<Box sx={{
  bgcolor: 'background.paper',
  p: 2,
  borderRadius: 1,
  border: 1,
  borderColor: 'divider',
}}>
```

### Styled Components
**권장**: 재사용 가능한 스타일 컴포넌트

```typescript
import { styled } from '@mui/material/styles';

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
}));

<StyledCard>Content</StyledCard>
```

### Tailwind CSS
**제한적 허용**: 레이아웃 보조용으로만

```typescript
// ✅ 허용: 간단한 레이아웃
<div className="flex items-center gap-2">

// ❌ 금지: 컴포넌트 스타일링 주도
<div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
```

---

## 신규 컴포넌트 추가 프로세스

### 1. 기존 컴포넌트 확인
먼저 `libs/design-system/src/components/`에 유사한 컴포넌트가 있는지 확인합니다.

### 2. 컴포넌트 작성
```bash
cd libs/design-system/src/components
mkdir my-component
cd my-component
touch my-component.tsx
touch index.ts
```

**my-component.tsx**:
```typescript
import type { BoxProps } from '@mui/material/Box';
import Box from '@mui/material/Box';

export type MyComponentProps = BoxProps & {
  title: string;
  subtitle?: string;
};

export const MyComponent = ({ title, subtitle, ...other }: MyComponentProps) => {
  return (
    <Box {...other}>
      <Box sx={{ fontWeight: 600 }}>{title}</Box>
      {subtitle && <Box sx={{ color: 'text.secondary' }}>{subtitle}</Box>}
    </Box>
  );
};
```

**index.ts**:
```typescript
export * from './my-component';
```

### 3. Export 추가
**libs/design-system/src/components/index.ts**:
```typescript
export * from './my-component';
```

### 4. 문서 업데이트
이 문서(`DESIGN_SYSTEM.md`)에 컴포넌트 설명 추가:

```markdown
#### X. MyComponent (컴포넌트 이름)
**위치**: `libs/design-system/src/components/my-component`

\`\`\`typescript
import { MyComponent } from '@dwp-frontend/design-system';

<MyComponent title="제목" subtitle="부제목" />
\`\`\`

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| title | string | - | 제목 |
| subtitle | string | - | 부제목 (선택) |

**✅ Do**:
- 간단한 텍스트 표시에 사용

**❌ Don't**:
- 복잡한 레이아웃에 사용
```

### 5. 팀 공유
- Slack 또는 팀 채널에 새 컴포넌트 추가 공지
- PR에 사용 예시 포함

---

## 디자인 토큰 표준 (리스트/카드/선택 상태)

### 선택 가능한 카드
```typescript
<Card
  sx={{
    bgcolor: selected ? 'action.selected' : 'background.paper',
    color: selected ? 'primary.main' : 'text.primary',
    '&:hover': {
      borderColor: 'primary.main',
      bgcolor: selected ? 'action.selected' : 'action.hover',
    },
  }}
>
```

### 리스트 아이템
```typescript
<ListItem
  sx={{
    bgcolor: selected ? 'action.selected' : 'transparent',
    '&:hover': {
      bgcolor: 'action.hover',
    },
  }}
>
```

### 테이블 행
```typescript
<TableRow
  sx={{
    bgcolor: selected ? 'action.selected' : 'inherit',
    '&:hover': {
      bgcolor: 'action.hover',
    },
  }}
>
```

---

## Admin CRUD 화면별 패턴 매핑

아래 표는 각 Admin 화면이 어떤 패턴 컴포넌트를 사용하는지 정리한 것입니다.  
**신규 화면 개발 시 이 표를 참고하여 동일한 패턴을 적용하세요.**

| 화면 | 레이아웃 모드 | 패턴 컴포넌트 | 특징 |
|------|---------------|---------------|------|
| **메뉴 관리** (`/admin/menus`) | Fixed | TwoColumnLayout, SelectableCard, EmptyState | 좌측 메뉴 트리 + 우측 상세 편집 |
| **권한 관리** (`/admin/roles`) | Fixed | TwoColumnLayout, SelectableCard, EmptyState, ConfirmDialog | 좌측 권한 목록 + 우측 상세 탭 (개요/멤버/권한) |
| **사용자 관리** (`/admin/users`) | Scrollable | FilterBar, DataTable, EditorModal, ConfirmDialog | 상단 필터 + 테이블 + 편집 모달 + 삭제 확인 |
| **코드 관리** (`/admin/codes`) | Scrollable | FilterBar, DataTable, EmptyState | 상단 필터 + 탭 + 테이블 |
| **코드 사용 정의** (`/admin/code-usages`) | Scrollable | FilterBar, DataTable, EmptyState | 상단 필터 + 테이블 |
| **감사 로그** (`/admin/audit`) | Scrollable | FilterBar, DataTable, EmptyState | 상단 필터 + 테이블 + Drawer |
| **통합 모니터링** (`/admin/monitoring`) | Scrollable | FilterBar, DataTable, EmptyState | KPI 카드 + 차트 + 탭 테이블 |
| **리소스 관리** (`/admin/resources`) | Fixed (향후) | TwoColumnLayout, SelectableCard, EmptyState | 좌측 리소스 목록 + 우측 상세 (예정) |

### 패턴 선택 가이드

#### Fixed 모드 화면 (좌우 분할 CRUD)
```
필수 패턴:
- TwoColumnLayout (좌우 분할)
- SelectableCard (좌측 목록 선택)
- EmptyState (우측 빈 상태)

권장 패턴:
- ConfirmDialog (삭제 확인)
- EditorModal (생성/편집)
```

#### Scrollable 모드 화면 (일반 CRUD)
```
필수 패턴:
- FilterBar (상단 필터 영역)
- DataTable (테이블 컨테이너)
- EmptyState (데이터 없음)

권장 패턴:
- ToolbarActions (버튼 그룹)
- EditorModal (생성/편집)
- ConfirmDialog (삭제 확인)
```

### DO / DON'T

#### ✅ DO
- 패턴 컴포넌트를 먼저 확인하고 적용
- 테마 토큰만 사용 (`theme.palette.*`, `theme.spacing()`)
- 반응형 breakpoint 기반 레이아웃 (`direction={{ xs: 'column', md: 'row' }}`)
- 테이블은 `overflowX: auto`로 가로 스크롤 허용

#### ❌ DON'T
- 패턴 컴포넌트를 무시하고 직접 구현
- 하드코딩 색상 (`#1976d2`) 사용
- 모바일에서 테이블 컬럼 숨기기 (정보 손실)
- 패턴 없이 중복 UI 반복 구현

---

## 참고 문서

- **핵심 규칙**: `docs/essentials/PROJECT_RULES.md`
- **레이아웃 가이드**: `docs/essentials/LAYOUT_GUIDE.md`
- **Admin CRUD 표준**: `docs/essentials/ADMIN_CRUD_STANDARD.md`
- **MUI 공식 문서**: https://mui.com/material-ui/getting-started/

---

## 정기 업데이트

- **월 1회**: 새로운 공통 컴포넌트 추가 시 이 문서 업데이트
- **분기 1회**: 사용되지 않는 컴포넌트 정리

---

**디자인 시스템을 통해 일관된 UI/UX를 유지합시다! 🎨**
