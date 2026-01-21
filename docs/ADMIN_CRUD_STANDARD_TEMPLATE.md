# [DWP Frontend] Admin CRUD 운영급 표준 템플릿

## 목표
- Admin CRUD 화면은 확장 시에도 파일이 비대해지지 않는 구조로 개발한다.
- 페이지는 Orchestration만 담당하고, 모든 로직은 hook/adapters/components로 분리한다.
- 코드/권한/이벤트 추적까지 "운영 수준"으로 일관되게 처리한다.

---

## 1) Feature 폴더 구조 (필수)

```
apps/remotes/admin/src/pages/<feature>/
├── index.tsx                    # 라우트 엔트리(조립 only, 400라인 이하)
├── types.ts                     # feature 전용 타입(선언 only)
├── adapters/
│   └── <feature>-adapter.ts    # DTO ↔ UI model 변환(순수함수)
├── hooks/
│   ├── use-<feature>-filters.ts      # 필터 상태/파라미터 관리
│   ├── use-<feature>-table-state.ts  # pagination/sort/selection 관리
│   ├── use-<feature>-mutations.ts   # create/update/delete orchestration
│   └── use-<feature>-dialog.ts      # modal/drawer open/close
└── components/
    ├── <feature>-toolbar.tsx         # 검색/필터/액션 버튼
    ├── <feature>-filters.tsx        # 필터 UI (코드 기반 select)
    ├── <feature>-table.tsx          # 리스트 테이블 (표시 only)
    ├── <feature>-editor-modal.tsx   # 생성/수정 폼 (표시 only)
    ├── <feature>-detail-drawer.tsx  # 상세 보기
    ├── <feature>-empty.tsx          # empty state
    └── <feature>-error.tsx          # error state
```

### 규칙
- ✅ 파일 1개 400라인 초과 금지
- ✅ "components는 props 기반 표시만" / "hooks에서 로직 처리"

---

## 2) 계층 규칙 (절대 위반 금지)

```
libs/shared-utils/api → libs/shared-utils/queries → page/hooks/components
```

### 금지 사항
- ❌ 페이지(index.tsx)에서 axios 직접 호출
- ❌ component에서 query 호출
- ✅ hook에서만 query/mutation orchestration

### 예시

```typescript
// ❌ 잘못된 예시
// index.tsx
const MyPage = () => {
  const { data } = useQuery(['my-data'], () => axios.get('/api/data'));
  return <MyTable data={data} />;
};

// ✅ 올바른 예시
// hooks/use-my-table-state.ts
export const useMyTableState = () => {
  const { data } = useMyDataQuery();
  return { data };
};

// index.tsx
const MyPage = () => {
  const { data } = useMyTableState();
  return <MyTable data={data} />;
};
```

---

## 3) QueryKey 규칙 (통일)

### List
```typescript
['admin', '<feature>', 'list', tenantId, filters...]
```

### Detail
```typescript
['admin', '<feature>', 'detail', tenantId, id]
```

### Codes (Usage)
```typescript
['admin', 'codes', 'usage', tenantId, resourceKey]
```

### 규칙
- ✅ filter 변경 시 page=1 reset
- ✅ keyword는 debounce 300~500ms

### 예시

```typescript
// hooks/use-roles-table-state.ts
export const useRolesTableState = () => {
  const { tenantId } = useTenant();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);

  const debouncedKeyword = useDebounce(keyword, 300);

  const queryKey = ['admin', 'roles', 'list', tenantId, debouncedKeyword, status, page, size];
  const { data } = useQuery(queryKey, () => getAdminRoles({ keyword: debouncedKeyword, status, page, size }));

  // Filter 변경 시 page reset
  useEffect(() => {
    setPage(1);
  }, [status]);

  return { data, keyword, setKeyword, status, setStatus, page, setPage, size, setSize };
};
```

---

## 4) 코드(CodeUsage) 기반 Select 사용 규칙

### 필수
- selectbox/필터의 옵션은 하드코딩 금지
- `useCodesByResourceQuery(resourceKey)`로 로드

### Fallback 정책
- 코드 매핑이 없으면 dropdown disabled
- helperText: "코드 매핑 필요"
- `all` 조회 fallback 금지 (Codes 화면 제외)

### 예시

```typescript
// components/roles-filters.tsx
export const RolesFilters = () => {
  const { data: codeMap, isLoading } = useCodesByResourceQuery('menu.admin.roles');
  const statusOptions = useMemo(() => {
    const codes = getCodesByGroupFromMap(codeMap, 'ROLE_STATUS');
    return toSelectOptions(codes);
  }, [codeMap]);

  return (
    <TextField
      select
      label="상태"
      disabled={!statusOptions.length || isLoading}
      helperText={
        isLoading
          ? '코드 로딩 중...'
          : !statusOptions.length
            ? '코드 매핑 필요 (ROLE_STATUS)'
            : undefined
      }
    >
      {statusOptions.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.label}
        </MenuItem>
      ))}
    </TextField>
  );
};
```

---

## 5) 권한 Enforcement 위치 (통일)

### Route Guard
- `PermissionRouteGuard`로 화면 접근 자체 보호
- `menu.<feature>` VIEW 권한 필요

### UI Button
- `PermissionGate`로 버튼 제어
- 버튼 resourceKey + permissionCode 기반
- 없는 경우 기본 disabled 처리

### 규칙
- ✅ 권한은 "프론트에서만 막지 말고" BE enforcement 전제

### 예시

```typescript
// admin-app.tsx
<Route
  path="/admin/roles"
  element={
    <PermissionRouteGuard resourceKey="menu.admin.roles" permission="VIEW">
      <RolesPage />
    </PermissionRouteGuard>
  }
/>

// components/roles-toolbar.tsx
<PermissionGate resourceKey="menu.admin.roles" permission="CREATE">
  <Button onClick={handleCreate}>역할 추가</Button>
</PermissionGate>
```

---

## 6) 이벤트 추적 표준 (운영 추적 완성)

모든 Feature에서 필수 이벤트 기록:

- `VIEW`: 페이지 진입
- `SEARCH`: 검색 실행(디바운스)
- `FILTER`: 필터 변경
- `OPEN`/`CLOSE`: 모달/드로어 열기/닫기
- `SUBMIT`: 저장
- `DOWNLOAD`: 엑셀 다운로드
- `CLICK`: 주요 버튼

### 기본 규칙
- `trackEvent({ action: 'VIEW'|'SEARCH'|... , resourceKey, metadata })`
- action은 `UiAction` 타입 강제(대문자 normalize)

### 예시

```typescript
// hooks/use-roles-table-state.ts
useEffect(() => {
  trackEvent({
    resourceKey: 'menu.admin.roles',
    action: 'VIEW',
    label: '역할 관리',
    metadata: { page: window.location.pathname },
  });
}, []);

// components/roles-toolbar.tsx
const handleSearch = () => {
  trackEvent({
    resourceKey: 'menu.admin.roles',
    action: 'SEARCH',
    label: '역할 검색',
    metadata: { keyword },
  });
  onSearch(keyword);
};

// hooks/use-roles-mutations.ts
const handleCreate = async (payload: RoleCreatePayload) => {
  await createMutation.mutateAsync(payload);
  trackEvent({
    resourceKey: 'menu.admin.roles',
    action: 'SUBMIT',
    label: '역할 생성 완료',
    metadata: { roleName: payload.roleName },
  });
};
```

---

## 7) Feature 구현 순서(추천)

1. **types.ts + adapters 작성** (변환만)
   - API DTO 타입 정의
   - UI Model 타입 정의
   - 변환 함수 작성 (순수함수)

2. **API 함수 작성** (`libs/shared-utils/api`)
   - `getAdmin<Feature>`, `getAdmin<Feature>Detail`
   - `createAdmin<Feature>`, `updateAdmin<Feature>`, `deleteAdmin<Feature>`

3. **Query 작성** (`libs/shared-utils/queries`)
   - `useAdmin<Feature>Query`, `useAdmin<Feature>DetailQuery`
   - `useCreateAdmin<Feature>Mutation`, `useUpdateAdmin<Feature>Mutation`, `useDeleteAdmin<Feature>Mutation`

4. **hooks 작성**
   - `use-<feature>-table-state.ts`: pagination/sort/selection
   - `use-<feature>-filters.ts`: 필터 상태/파라미터
   - `use-<feature>-mutations.ts`: CRUD orchestration
   - `use-<feature>-dialog.ts`: modal/drawer 상태

5. **components 작성**
   - `table.tsx`: 리스트 표시 (props 기반)
   - `filters.tsx`: 필터 UI (코드 기반 select)
   - `editor-modal.tsx`: 생성/수정 폼
   - `detail-drawer.tsx`: 상세 보기
   - `empty.tsx`, `error.tsx`: 상태 표시

6. **index.tsx에서 조립**
   - hooks 조합
   - components 조합
   - 400라인 이하 유지

7. **PermissionGate/RouteGuard 적용**
   - Route에 `PermissionRouteGuard` 적용
   - 버튼에 `PermissionGate` 적용

8. **이벤트 추적 추가**
   - VIEW, SEARCH, FILTER, OPEN/CLOSE, SUBMIT, DOWNLOAD, CLICK

9. **Vitest: adapters/utils 2~3개 최소**
   - adapter 변환 함수 테스트
   - utils 함수 테스트

---

## 8) 기능별 적용 예시 (가이드)

### Roles
- Permission Matrix는 `roles/components/permission-matrix.tsx`로 분리
- role-member 편집은 editor-modal에서 탭 분리

### Resources
- ResourceKind/Category 드롭다운은 CodeUsage 기반
- trackingEnabled/eventActions 표시/편집 분리

### Audit
- 리스트/필터만(기본)
- detail drawer에서 JSON 보기 (metadata pretty print)

---

## 9) 완료 기준(DoD)

- ✅ TOP 페이지 파일 400라인 이하
- ✅ component에서 API 호출 없음
- ✅ select 하드코딩 제거
- ✅ 권한/이벤트 적용 완료
- ✅ lint/test 통과
- ✅ `docs/ADMIN_REMOTE_IMPLEMENTATION.md`에 "feature 추가 방법" 10줄 업데이트

---

## 10) 체크리스트

새로운 Feature 추가 시:

- [ ] Feature 폴더 구조 생성 (`index.tsx`, `types.ts`, `adapters/`, `hooks/`, `components/`)
- [ ] API 함수 작성 (`libs/shared-utils/api`)
- [ ] Query 작성 (`libs/shared-utils/queries`)
- [ ] Adapters 작성 (DTO → UI Model 변환)
- [ ] Hooks 작성 (table-state, filters, mutations, dialog)
- [ ] Components 작성 (table, filters, editor-modal, detail-drawer, empty, error)
- [ ] `index.tsx` 조립 (400라인 이하)
- [ ] `PermissionRouteGuard` 적용
- [ ] `PermissionGate` 적용 (버튼)
- [ ] CodeUsage 기반 select 적용
- [ ] 이벤트 추적 추가 (VIEW, SEARCH, FILTER, OPEN/CLOSE, SUBMIT, DOWNLOAD, CLICK)
- [ ] Vitest 테스트 추가 (adapters/utils 최소 2~3개)
- [ ] Lint/Test 통과 확인
- [ ] 문서 업데이트
