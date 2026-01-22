# DWP Frontend 핵심 규칙

**최종 업데이트**: 2026-01-22  
**원본**: `.cursorrules` (전체 규칙은 루트의 `.cursorrules` 파일 참조)

이 문서는 프로젝트의 핵심 규칙만 간추린 요약본입니다. 모든 개발자는 이 규칙을 숙지하고 준수해야 합니다.

---

## 🎯 핵심 원칙 (10대 계명)

### 1. React 19 Only
- React는 항상 **최신 Stable Major** 사용 (현재 ^19.x)
- React 18 fallback 코드 작성 금지
- `package.json`에서 react/react-dom 버전이 18로 내려가면 PR Reject

### 2. MUI v5 Only
- UI 라이브러리는 **MUI v5만** 사용
- ❌ 금지: shadcn/ui, Radix UI, Ant Design, Chakra UI 등
- Icons는 **Iconify (`@iconify/react`)만** 사용
- ❌ 금지: Lucide, Heroicons, MUI Icons 직접 사용

### 3. Single Source of Truth
- 공통 UI는 **`libs/design-system`에만** 배치
- Remote 내부에 `components/ui` 폴더 생성 금지
- 새로운 패턴 발견 시 즉시 `libs/design-system`으로 공통화

### 4. Theme Tokens First
- 테마 토큰(`theme.palette`, `theme.spacing`)만 사용
- ❌ 금지: 하드코딩된 색상 (`#1976d2`, `rgb(25, 118, 210)` 등)
- ❌ 금지: 하드코딩된 간격 (`padding: '16px'` → `p: 2` 사용)

### 5. No Any Type
- `any` 타입 사용 절대 금지
- 불가피할 경우 `unknown` + type guard 사용
- TypeScript Strict Mode 필수

### 6. Layout Mode 준수
- `fixed` 모드: 좌우 분할 CRUD (메뉴 관리, 권한 관리)
- `scrollable` 모드: 대시보드, 모니터링 (기본값)
- 상세 내용: `docs/essentials/LAYOUT_GUIDE.md`

### 7. Admin CRUD 표준 구조
- Page는 Orchestration만 담당 (400라인 이하)
- 로직은 `hooks/`, `adapters/`, `components/`로 분리
- 상세 내용: `docs/essentials/ADMIN_CRUD_STANDARD.md`

### 8. Import 자동 정렬
- Import 순서는 수동 금지, ESLint auto-fix 사용
- 순서: react → external → internal → relative
- 저장 시 자동 정렬되도록 설정 필수

### 9. Query Key 규칙
- 네임스페이스 기반 정의: `['admin', 'menus', 'list', tenantId, ...]`
- API 호출 계층: `shared-utils/api` → `shared-utils/queries` → `hooks` → `pages/components`

### 10. Permission Guard 필수
- 모든 보호 라우트는 `PermissionRouteGuard` 적용
- 버튼/컴포넌트는 `PermissionGate` 적용
- Sidebar 숨김만으로 보안이 성립한다고 가정 금지

---

## 🚫 Hard Rules (위반 시 PR Reject)

### ❌ No Host ↔ Remote Direct Import
- Host ↔ Remote 간 상대 경로 import 절대 금지
- 공통 코드는 반드시 `libs`를 통해서만 공유

### ❌ No Duplicate Layout
- Remote 내부에서 Header / Sidebar / Global Layout 중복 구현 금지
- Host가 제공하는 Layout/Theme/Auth 정책을 반드시 따름

### ❌ No `@/` Alias (원칙)
- 내부 import는 Nx/TS path alias(`@dwp-frontend/*`) 또는 상대경로만 사용
- `@/` alias는 표준이 아니므로 금지

### ❌ No Non-Standard UI Deps
- shadcn/ui, Radix UI, lucide-react 등 도입 금지
- 생성 코드(v0.app 등)가 요구하더라도 "설치로 해결" 금지
- MUI/Iconify로 치환 필수

---

## 📐 코드 스타일 규칙

### 컴포넌트 작성
```typescript
// ✅ 권장: 화살표 함수
export const MyComponent = () => {
  return <div>Hello</div>;
};

// ❌ 금지: function 선언
export function MyComponent() {
  return <div>Hello</div>;
}
```

### 스타일 작성
```typescript
// ✅ 권장: 테마 토큰 사용
<Box sx={{ 
  bgcolor: 'primary.main',
  p: 2,
  borderRadius: 1,
}}>

// ❌ 금지: 하드코딩
<Box sx={{ 
  backgroundColor: '#1976d2',
  padding: '16px',
  borderRadius: '8px',
}}>
```

### API 호출
```typescript
// ✅ 권장: TanStack Query 사용
const { data, isLoading } = useMenusQuery();

// ❌ 금지: 직접 axios 호출
const [data, setData] = useState(null);
useEffect(() => {
  axios.get('/api/menus').then(setData);
}, []);
```

### State 관리
```typescript
// ✅ 권장: 전역 UI 상태 - Zustand
const sidebarOpen = useLayoutStore((state) => state.sidebarOpen);

// ✅ 권장: 서버 데이터 - TanStack Query
const { data } = useMenusQuery();

// ❌ 금지: 모든 상태를 Context/Redux에 때려넣기
```

---

## 📂 파일 구조 규칙

### Feature 폴더 구조 (CRUD)
```
apps/remotes/admin/src/pages/<feature>/
├── page.tsx                 # 라우트 엔트리 (조립만, 400라인 이하)
├── types.ts                 # 타입 정의
├── adapters/                # DTO ↔ UI model 변환
├── hooks/                   # 상태/로직
└── components/              # UI 컴포넌트
```

### 공통 UI 컴포넌트
```
libs/design-system/src/components/
├── button/
├── select/
├── data-table/
├── modal/
└── ...
```

---

## 🎨 디자인 시스템 규칙

### 컴포넌트 사용 우선순위
1. `libs/design-system`에서 제공하는 컴포넌트 확인
2. 없으면 MUI 기본 컴포넌트 사용
3. 커스터마이징 필요 시 `libs/design-system`에 추가 후 재사용

### 선택 가능한 카드 예시
```typescript
// ✅ 권장
import { SelectableCard } from '@dwp-frontend/design-system';

<SelectableCard
  selected={selectedId === item.id}
  onClick={() => setSelectedId(item.id)}
  bgcolor="action.selected"  // 테마 토큰
/>

// ❌ 금지
<Card sx={{ 
  bgcolor: selectedId === item.id ? '#e3f2fd' : 'white',  // 하드코딩
}}>
```

---

## 🔐 인증 / 권한 규칙

### 라우트 보호
```typescript
// ✅ 권장
<PermissionRouteGuard resource="menu.admin.menus" permission="VIEW" redirectTo="/403">
  <MenusPage />
</PermissionRouteGuard>
```

### 버튼 보호
```typescript
// ✅ 권장
<PermissionGate resource="menu.admin.menus" permission="CREATE">
  <Button>생성</Button>
</PermissionGate>
```

### 401/403 정책
- **401 (Unauthorized)**: refresh 1회 시도 → 실패 시 logout + `/sign-in?returnUrl=...`
- **403 (Forbidden)**: logout 금지, `/403` 페이지 또는 토스트로 처리

---

## 📏 유지보수성 규칙

### 파일 크기 제한 (Hard)
- 단일 Page: **400라인 이하**
- 단일 Component: **250라인 이하**
- 초과 시 반드시 책임 단위로 분리

### Mandatory Split (대형 화면)
```
page/index.tsx       # 레이아웃 + 조립만
components/          # UI 조각
hooks/               # 상태/로직
adapters/            # 변환 로직
types.ts             # 타입 정의
```

---

## 🧪 테스트 규칙

### 필수 테스트 대상
- `libs/shared-utils`의 순수 로직
- Auth redirect, token storage 로직
- `adapters/` 변환 함수

### 권장 테스트 대상
- Menu tree store 반영 로직
- 복잡한 상태 관리 로직

---

## 📖 관련 문서

- **전체 규칙**: `.cursorrules` (루트)
- **Admin CRUD 표준**: `docs/essentials/ADMIN_CRUD_STANDARD.md`
- **레이아웃 가이드**: `docs/essentials/LAYOUT_GUIDE.md`
- **디자인 시스템**: `docs/essentials/DESIGN_SYSTEM.md`

---

## ✅ PR 체크리스트

모든 PR은 다음을 확인해야 합니다:

- [ ] 테마 토큰만 사용했는가? (하드코딩 색상 없음)
- [ ] `any` 타입을 사용하지 않았는가?
- [ ] 공통 컴포넌트는 `libs/design-system`에 배치했는가?
- [ ] MUI 직접 import가 없는가?
- [ ] 파일 크기가 제한을 넘지 않았는가? (Page 400라인, Component 250라인)
- [ ] Permission Guard를 적용했는가?
- [ ] Import 순서가 자동 정렬되었는가?
- [ ] ESLint 오류가 없는가?

---

**이 규칙들은 프로젝트의 장기적인 성공을 위한 필수 사항입니다. 규칙 위반 시 PR이 거부될 수 있습니다.**
