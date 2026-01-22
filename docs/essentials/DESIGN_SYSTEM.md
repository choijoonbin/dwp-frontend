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

### 비즈니스 패턴 컴포넌트 (추가 예정)

아래 컴포넌트들은 **향후 추가 예정**이며, 추가 시 이 문서가 업데이트됩니다.

#### 1. SelectableCard (선택 가능한 카드)
**상태**: 📋 계획 중  
**용도**: 메뉴 관리, 권한 관리 등 좌측 목록

```typescript
// 향후 사용 예시
<SelectableCard
  selected={selectedId === item.id}
  onClick={() => setSelectedId(item.id)}
  title={item.name}
  subtitle={item.code}
/>
```

#### 2. DataTable (공통 테이블)
**상태**: 📋 계획 중  
**용도**: 정렬, 페이징, 필터가 있는 테이블

```typescript
// 향후 사용 예시
<DataTable
  columns={columns}
  rows={rows}
  page={page}
  rowsPerPage={rowsPerPage}
  onPageChange={handlePageChange}
/>
```

#### 3. FilterBar (필터 바)
**상태**: 📋 계획 중  
**용도**: 검색/필터 UI 표준화

```typescript
// 향후 사용 예시
<FilterBar
  filters={filters}
  onFilterChange={handleFilterChange}
  onReset={handleReset}
/>
```

#### 4. EmptyState (빈 상태)
**상태**: 📋 계획 중  
**용도**: 데이터가 없을 때 표시

```typescript
// 향후 사용 예시
<EmptyState
  title="데이터가 없습니다"
  description="새로운 항목을 추가해주세요"
  actionLabel="추가하기"
  onAction={handleCreate}
/>
```

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
