# UI 개발자용 PR 체크리스트 (상세 가이드)

> **최종 업데이트**: 2026-01-22  
> **대상**: UI/Frontend 개발자  
> **목적**: PR 제출 전 반드시 확인해야 할 상세 체크리스트

---

## 목차

1. [기본 검증](#기본-검증)
2. [디자인 시스템 검증](#디자인-시스템-검증)
3. [Admin CRUD 표준 검증](#admin-crud-표준-검증)
4. [반응형 검증](#반응형-검증)
5. [성능 검증](#성능-검증)
6. [접근성 검증](#접근성-검증)
7. [코드 품질 검증](#코드-품질-검증)
8. [문서화 검증](#문서화-검증)

---

## 기본 검증

### ✅ 빌드 및 실행

```bash
# 빌드 성공 확인
yarn build

# 개발 서버 실행 확인
yarn dev

# 타입 체크 통과 확인
yarn typecheck

# Lint 통과 확인
yarn lint
```

**통과 기준**:
- 빌드 오류 없음
- 타입 오류 없음
- Lint 오류 없음 (warning은 확인 후 해결 계획 명시)

---

## 디자인 시스템 검증

### 1️⃣ UI 라이브러리 표준 (필수)

#### ✅ DO
```typescript
// ✅ MUI v5 사용
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

// ✅ Iconify 사용
import { Iconify } from '@dwp-frontend/design-system';

<Button startIcon={<Iconify icon="solar:add-bold" />}>
  추가
</Button>
```

#### ❌ DON'T
```typescript
// ❌ shadcn/ui 금지
import { Button } from '@/components/ui/button';

// ❌ Radix UI 금지
import * as Dialog from '@radix-ui/react-dialog';

// ❌ Lucide 아이콘 금지
import { Plus } from 'lucide-react';

// ❌ Heroicons 금지
import { PlusIcon } from '@heroicons/react/24/solid';
```

**검증 방법**:
```bash
# ESLint가 자동으로 warning을 표시합니다
yarn lint
```

**참고**: `.cursorrules` 섹션 "Hard Rules (Strictly Prohibited)"

---

### 2️⃣ 테마 토큰 사용 (필수)

#### ✅ DO
```typescript
// ✅ 테마 토큰 사용
<Box
  sx={{
    bgcolor: 'background.paper',
    color: 'text.primary',
    borderColor: 'divider',
    p: theme.spacing(2),
  }}
>
```

#### ❌ DON'T
```typescript
// ❌ 하드코딩 색상 금지
<Box
  sx={{
    bgcolor: '#ffffff',
    color: '#000000',
    borderColor: '#e0e0e0',
    padding: '16px',
  }}
>
```

**검증 방법**:
1. 코드 리뷰 시 `sx` prop 확인
2. 색상 하드코딩 (`#`, `rgb()`, `rgba()`) 검색
3. 테마 모드 전환 (Light ↔ Dark) 후 UI 깨짐 확인

**참고**: `docs/essentials/THEME_TOKENS.md`

---

### 3️⃣ 패턴 컴포넌트 사용 (필수)

#### ✅ DO
```typescript
// ✅ Design System 패턴 사용
import { EmptyState, ConfirmDialog, TwoColumnLayout } from '@dwp-frontend/design-system';

// ✅ 빈 상태
<EmptyState
  title="데이터가 없습니다"
  description="새로운 항목을 추가해주세요"
  icon={<Iconify icon="solar:inbox-line-bold-duotone" />}
  action={<Button variant="contained">추가하기</Button>}
/>

// ✅ 삭제 확인
<ConfirmDialog
  open={open}
  title="삭제 확인"
  description="정말로 삭제하시겠습니까?"
  severity="danger"
  onConfirm={handleDelete}
  onClose={handleClose}
/>
```

#### ❌ DON'T
```typescript
// ❌ 중복 구현 금지
const MyEmptyState = () => (
  <Box sx={{ textAlign: 'center', py: 10 }}>
    <Typography>데이터가 없습니다</Typography>
  </Box>
);

// ❌ 로컬 components/ui 폴더 생성 금지
import { EmptyState } from './components/ui/empty-state';
```

**검증 방법**:
1. `apps/remotes/*/src/components/ui/` 폴더 존재 여부 확인 (생성 금지)
2. 빈 상태/삭제 확인/모달 등 공통 패턴 직접 구현 여부 확인
3. `@dwp-frontend/design-system` import 확인

**참고**: `docs/essentials/DESIGN_SYSTEM.md` 섹션 "패턴 컴포넌트"

---

### 4️⃣ 레이아웃 모드 (필수)

#### ✅ DO
```typescript
// ✅ Fixed 모드: 좌우 분할 CRUD (메뉴/권한 관리)
// - 브라우저 스크롤 없음
// - 좌측 목록 + 우측 상세
<TwoColumnLayout
  mode="fixed"
  left={<ListPanel />}
  right={<DetailPanel />}
/>

// ✅ Scrollable 모드: 대시보드/모니터링
// - 브라우저 스크롤 허용
// - 세로 나열
<Box sx={{ p: 3 }}>
  <Stack spacing={3}>
    <FilterBar />
    <DataTable />
  </Stack>
</Box>
```

#### ❌ DON'T
```typescript
// ❌ Fixed 모드에서 브라우저 스크롤 발생
// - `minHeight: 0` 누락
// - `overflow: hidden` 누락

// ❌ Scrollable 모드에서 브라우저 스크롤 차단
// - Fixed 모드 스타일 잘못 적용
```

**검증 방법**:
1. Fixed 모드 화면 (`/admin/menus`, `/admin/roles`):
   - 브라우저 스크롤바 없음
   - 좌/우 내부 스크롤만 존재
2. Scrollable 모드 화면 (`/admin/monitoring`, `/dashboard`):
   - 브라우저 스크롤바 있음
   - 페이지 전체 스크롤 가능

**참고**: `docs/essentials/LAYOUT_GUIDE.md`

---

## Admin CRUD 표준 검증

### 1️⃣ Feature Folder 구조 (필수)

#### ✅ DO
```
apps/remotes/admin/src/pages/<feature>/
├── index.tsx              # PermissionRouteGuard + 라우트 엔트리
├── page.tsx               # Orchestration (조립만)
├── types.ts               # Feature 전용 타입
├── adapters/              # DTO ↔ UI model 변환
│   ├── role-adapters.ts
│   └── role-mappers.ts
├── hooks/                 # 상태/비즈니스 로직
│   ├── use-role-table-state.ts
│   └── use-role-actions.ts
└── components/            # 표시 컴포넌트 (props 기반)
    ├── role-list-panel.tsx
    └── role-detail-panel.tsx
```

#### ❌ DON'T
```
apps/remotes/admin/src/pages/
├── roles.tsx              # ❌ 모든 로직이 한 파일에
└── roles-helper.ts        # ❌ 불명확한 파일명
```

**검증 방법**:
1. 폴더 구조가 위 표준을 따르는지 확인
2. `page.tsx`가 400줄 이하인지 확인
3. 각 컴포넌트가 250줄 이하인지 확인

**참고**: `docs/essentials/ADMIN_CRUD_STANDARD.md` 섹션 "Feature Folder Standard"

---

### 2️⃣ Query Key 규칙 (필수)

#### ✅ DO
```typescript
// ✅ 네임스페이스 기반 Query Key
const queryKey = ['admin', 'roles', 'list', tenantId, filters];
const detailKey = ['admin', 'roles', 'detail', tenantId, roleId];
const codesKey = ['admin', 'codes', 'usage', tenantId, 'menu.admin.roles'];
```

#### ❌ DON'T
```typescript
// ❌ 불규칙한 Query Key
const queryKey = ['roleList'];
const detailKey = ['role', roleId];
const codesKey = ['codes'];
```

**검증 방법**:
1. `queryKey` 정의 확인
2. `['admin', '<feature>', 'list'|'detail', tenantId, ...]` 패턴 준수 확인

**참고**: `.cursorrules` 섹션 "Admin CRUD Engineering Pattern"

---

### 3️⃣ CodeUsage 기반 Select (필수)

#### ✅ DO
```typescript
// ✅ CodeUsage로 옵션 로딩
import { useCodesByResourceQuery, getSelectOptionsByGroup } from '@dwp-frontend/shared-utils';

const { data: codeMap, isLoading } = useCodesByResourceQuery('menu.admin.roles');
const statusOptions = getSelectOptionsByGroup(codeMap, 'ROLE_STATUS');

<TextField
  select
  disabled={isLoading || statusOptions.length === 0}
  helperText={statusOptions.length === 0 ? '코드 매핑 필요' : undefined}
>
  {statusOptions.map(opt => (
    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
  ))}
</TextField>
```

#### ❌ DON'T
```typescript
// ❌ 하드코딩 select 옵션
<TextField select>
  <MenuItem value="ACTIVE">활성</MenuItem>
  <MenuItem value="INACTIVE">비활성</MenuItem>
</TextField>
```

**검증 방법**:
1. `select` 컴포넌트 확인
2. `useCodesByResourceQuery` 사용 여부 확인
3. 하드코딩된 `MenuItem` 없음 확인

**참고**: `docs/essentials/ADMIN_CRUD_STANDARD.md` 섹션 "CodeUsage 기반 select"

---

### 4️⃣ 권한 제어 (필수)

#### ✅ DO
```typescript
// ✅ 라우트 권한
import { PermissionRouteGuard } from '@dwp-frontend/shared-utils';

export const RolesPage = () => (
  <PermissionRouteGuard resource="menu.admin.roles" permission="VIEW" redirectTo="/403">
    <RolesPageContent />
  </PermissionRouteGuard>
);

// ✅ 버튼 권한
import { PermissionGate } from '@dwp-frontend/design-system';

<PermissionGate resource="menu.admin.roles" permission="CREATE">
  <Button variant="contained">추가</Button>
</PermissionGate>
```

#### ❌ DON'T
```typescript
// ❌ 권한 체크 없음
export const RolesPage = () => <RolesPageContent />;

// ❌ 조건부 렌더링으로 권한 체크 (일관성 없음)
{hasPermission && <Button>추가</Button>}
```

**검증 방법**:
1. 모든 보호 라우트에 `PermissionRouteGuard` 확인
2. 생성/편집/삭제 버튼에 `PermissionGate` 확인

**참고**: `.cursorrules` 섹션 "Authentication / Authorization"

---

### 5️⃣ 이벤트 트래킹 (필수)

#### ✅ DO
```typescript
import { trackEvent } from '@dwp-frontend/shared-utils';

// ✅ VIEW 이벤트
useEffect(() => {
  trackEvent('VIEW', 'menu.admin.roles', '권한 관리 페이지 조회');
}, []);

// ✅ SEARCH 이벤트
const handleSearch = () => {
  trackEvent('SEARCH', 'menu.admin.roles', '권한 검색', { keyword });
};

// ✅ SUBMIT 이벤트
const handleCreate = async () => {
  await createMutation.mutateAsync(data);
  trackEvent('SUBMIT', 'menu.admin.roles', '권한 생성', { roleId });
};
```

#### ❌ DON'T
```typescript
// ❌ 이벤트 트래킹 없음
const handleCreate = async () => {
  await createMutation.mutateAsync(data);
};
```

**검증 방법**:
1. `trackEvent` import 확인
2. 주요 액션 (VIEW/SEARCH/FILTER/SUBMIT/DOWNLOAD/CLICK)에 `trackEvent` 호출 확인

**참고**: `.cursorrules` 섹션 "Admin CRUD Engineering Pattern"

---

## 반응형 검증

### 1️⃣ Breakpoint 기반 레이아웃 (필수)

#### ✅ DO
```typescript
// ✅ MUI breakpoint 사용
<Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
  <TextField sx={{ minWidth: { xs: 1, md: 280 } }} />
  <Button sx={{ width: { xs: 1, md: 'auto' } }}>검색</Button>
</Stack>

// ✅ useMediaQuery 사용
import { useMediaQuery } from '@mui/material';
const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

{isMobile ? <CardList /> : <TableView />}
```

#### ❌ DON'T
```typescript
// ❌ 하드코딩 breakpoint
<Stack direction={window.innerWidth < 768 ? 'column' : 'row'}>

// ❌ 반응형 없음
<Stack direction="row">
  <TextField sx={{ minWidth: 280 }} />
  <Button>검색</Button>
</Stack>
```

**검증 방법**:
1. 브라우저 DevTools로 화면 크기 조절
2. xs (320px), sm (600px), md (960px) 확인
3. 모든 breakpoint에서 UI 깨짐 없음 확인

**참고**: `.cursorrules` 섹션 "UI / UX & Responsive Standard"

---

### 2️⃣ 터치 타겟 크기 (필수)

#### ✅ DO
```typescript
// ✅ 최소 44x44px 보장
<IconButton sx={{ minWidth: 44, minHeight: 44 }}>
  <Iconify icon="solar:trash-bin-bold" />
</IconButton>

<Button sx={{ minHeight: 44 }}>추가</Button>
```

#### ❌ DON'T
```typescript
// ❌ 터치 타겟 너무 작음 (모바일에서 선택 어려움)
<IconButton sx={{ width: 24, height: 24 }}>
  <Iconify icon="solar:trash-bin-bold" width={16} />
</IconButton>
```

**검증 방법**:
1. 모바일 화면 (xs)에서 버튼/링크 클릭 테스트
2. 터치 타겟이 44x44px 이상인지 DevTools로 확인

**참고**: `.cursorrules` 섹션 "UI / UX & Responsive Standard"

---

### 3️⃣ 테이블 Overflow (필수)

#### ✅ DO
```typescript
// ✅ 테이블 overflowX 허용
<Box sx={{ overflowX: 'auto' }}>
  <Table sx={{ minWidth: 800 }}>
    {/* 테이블 내용 */}
  </Table>
</Box>
```

#### ❌ DON'T
```typescript
// ❌ Overflow 처리 없음 (모바일에서 잘림)
<Table>
  {/* 테이블 내용 */}
</Table>

// ❌ 모바일에서 컬럼 숨김 (정보 손실)
{!isMobile && <TableCell>부서</TableCell>}
```

**검증 방법**:
1. 모바일 화면 (xs)에서 테이블 확인
2. 가로 스크롤 가능 여부 확인
3. 모든 컬럼이 보이는지 확인 (숨김 금지)

**참고**: `docs/essentials/LAYOUT_GUIDE.md` 섹션 "반응형 규칙"

---

## 성능 검증

### 1️⃣ 메모이제이션 (권장)

#### ✅ DO
```typescript
// ✅ 비싼 계산은 useMemo
const filteredData = useMemo(
  () => data.filter(item => item.status === filter),
  [data, filter]
);

// ✅ 콜백은 useCallback
const handleSubmit = useCallback(async () => {
  await submitMutation.mutateAsync(formData);
}, [formData, submitMutation]);
```

#### ❌ DON'T
```typescript
// ❌ 매 렌더링마다 재계산
const filteredData = data.filter(item => item.status === filter);

// ❌ 매 렌더링마다 새 함수 생성
const handleSubmit = async () => {
  await submitMutation.mutateAsync(formData);
};
```

**검증 방법**:
1. React DevTools Profiler로 렌더링 횟수 확인
2. 불필요한 재렌더링 없음 확인

---

### 2️⃣ 이미지 최적화 (권장)

#### ✅ DO
```typescript
// ✅ Next.js Image (향후 도입 시)
<Image src={src} alt={alt} width={100} height={100} loading="lazy" />

// ✅ 현재: lazy loading 속성
<img src={src} alt={alt} loading="lazy" />
```

#### ❌ DON'T
```typescript
// ❌ lazy loading 없음
<img src={src} alt={alt} />
```

---

## 접근성 검증

### 1️⃣ Semantic HTML (권장)

#### ✅ DO
```typescript
// ✅ Semantic HTML
<form onSubmit={handleSubmit}>
  <TextField label="이름" required />
  <Button type="submit">제출</Button>
</form>
```

#### ❌ DON'T
```typescript
// ❌ Non-semantic HTML
<div onClick={handleSubmit}>
  <div>이름</div>
  <input />
  <div onClick={handleSubmit}>제출</div>
</div>
```

---

### 2️⃣ ARIA 속성 (권장)

#### ✅ DO
```typescript
// ✅ ARIA 속성
<IconButton aria-label="삭제" onClick={handleDelete}>
  <Iconify icon="solar:trash-bin-bold" />
</IconButton>
```

#### ❌ DON'T
```typescript
// ❌ ARIA 없음
<IconButton onClick={handleDelete}>
  <Iconify icon="solar:trash-bin-bold" />
</IconButton>
```

---

## 코드 품질 검증

### 1️⃣ 파일 크기 제한 (필수)

**제한**:
- Page: 400줄 이하
- Component: 250줄 이하

**초과 시 조치**:
1. 로직을 `hooks/`로 분리
2. 컴포넌트를 `components/`로 분리
3. 유틸리티를 `adapters/`로 분리

**검증 방법**:
```bash
# 파일 라인 수 확인
wc -l apps/remotes/admin/src/pages/roles/page.tsx
```

**참고**: `.cursorrules` 섹션 "Maintainability Rules"

---

### 2️⃣ Any 타입 금지 (필수)

#### ✅ DO
```typescript
// ✅ unknown + type guard
function processData(data: unknown) {
  if (typeof data === 'string') {
    return data.toUpperCase();
  }
  throw new Error('Invalid data');
}
```

#### ❌ DON'T
```typescript
// ❌ any 사용
function processData(data: any) {
  return data.toUpperCase();
}
```

**검증 방법**:
```bash
# any 검색
grep -r "any" apps/remotes/admin/src/pages/
```

**참고**: `.cursorrules` 섹션 "Hard Rules (Strictly Prohibited)"

---

### 3️⃣ 명확한 변수명 (필수)

#### ✅ DO
```typescript
const isUserActive = user.status === 'ACTIVE';
const filteredRoles = roles.filter(role => role.status === filter);
```

#### ❌ DON'T
```typescript
const flag = user.status === 'ACTIVE';
const data = roles.filter(r => r.status === filter);
```

---

## 문서화 검증

### 1️⃣ 새로운 공통 컴포넌트 추가 시 (필수)

**업데이트 대상**:
- `docs/essentials/DESIGN_SYSTEM.md`
- `libs/design-system/README.md` (있다면)

**추가 내용**:
- 컴포넌트명
- Props
- 사용 예시
- DO / DON'T

---

### 2️⃣ 새로운 패턴/규칙 추가 시 (필수)

**업데이트 대상**:
- `docs/essentials/PROJECT_RULES.md`
- `.cursorrules` (필요 시)

---

### 3️⃣ README 업데이트 (필요 시)

**업데이트 시점**:
- 새로운 스크립트 추가
- 환경 변수 추가
- 설치 방법 변경

---

## 체크리스트 요약 (최종 확인)

### 🔴 필수 (PR Reject 사항)

- [ ] MUI v5만 사용 (shadcn/radix 금지)
- [ ] Iconify만 사용 (lucide 금지)
- [ ] 테마 토큰만 사용 (하드코딩 색상 금지)
- [ ] 패턴 컴포넌트 사용 (중복 구현 금지)
- [ ] 레이아웃 모드 준수 (Fixed/Scrollable)
- [ ] Feature Folder 구조 준수
- [ ] CodeUsage 기반 select 사용
- [ ] PermissionRouteGuard + PermissionGate 적용
- [ ] trackEvent 호출 (주요 액션)
- [ ] 파일 크기 제한 준수 (Page: 400줄, Component: 250줄)
- [ ] any 타입 사용 안 함

### 🟡 권장 (Warning 수준)

- [ ] 메모이제이션 (useMemo, useCallback)
- [ ] 이미지 최적화 (lazy loading)
- [ ] Semantic HTML
- [ ] ARIA 속성
- [ ] 명확한 변수명

---

## 참고 문서

- **[디자인 시스템](../essentials/DESIGN_SYSTEM.md)**: UI 개발 필수
- **[Admin CRUD 표준](../essentials/ADMIN_CRUD_STANDARD.md)**: CRUD 개발 필수
- **[레이아웃 가이드](../essentials/LAYOUT_GUIDE.md)**: Fixed/Scrollable 모드
- **[핵심 규칙](../essentials/PROJECT_RULES.md)**: 프로젝트 전체 규칙
- **[테마 토큰](../essentials/THEME_TOKENS.md)**: 색상/간격 표준

---

## 문의

PR 리뷰 시 체크리스트 관련 질문이 있다면:
1. `docs/README.md`에서 관련 문서 확인
2. `.cursorrules` 검색
3. 팀 채널에 질문

---

**이 체크리스트를 준수하면 일관되고 유지보수 가능한 코드를 작성할 수 있습니다! 🎯**
