# FE P1-5 (Enhanced): Admin CRUD UI 구현 명세서

**작성일**: 2026-01-20  
**목적**: 운영 가능한 Admin CRUD UI + RBAC UX 강화 + CodeUsage 관리 완성

---

## 핵심 정책 (상단 5줄)

1. **RBAC UX 통일**: 서버 403 발생 시 로그아웃 금지, "접근 권한 없음" Alert + 페이지 UI disable 처리
2. **CodeUsage 기반 코드 조회**: 모든 드롭다운/필터는 `/api/admin/codes/usage?resourceKey=...`로 메뉴별 필요한 코드만 조회 (하드코딩 금지)
3. **API 계층 구조**: `shared-utils/api` → `shared-utils/queries` → UI 컴포넌트 순서로 엄격히 준수
4. **표준 CRUD UX**: 검색/필터/페이징/loading skeleton/empty state/error state/ConfirmDialog 필수
5. **타입 안전성**: `any` 금지, null-safe 처리, DTO는 types로 분리

---

## 1. 공통 사항

### 1.1 API 호출 계층 구조
```
libs/shared-utils/src/api/          # API 함수 (axiosInstance 사용)
  ↓
libs/shared-utils/src/queries/      # React Query hooks
  ↓
apps/remotes/admin/src/pages/       # UI 컴포넌트
```

### 1.2 필수 헤더 (자동 주입)
- `Authorization: Bearer <JWT>` (axiosInstance에서 자동 주입)
- `X-Tenant-ID: <tenant_id>` (axiosInstance에서 자동 주입)
- `X-Agent-ID: <agent_session_id>` (Aura AI 요청 시만)

### 1.3 Query Key 규칙
- Format: `['admin', resourceType, tenantId, ...params]`
- 예시:
  - Users: `['admin', 'users', tenantId, page, size, keyword, status]`
  - Roles: `['admin', 'roles', tenantId, page, size, keyword]`
  - Code Usages: `['admin', 'code-usages', tenantId, page, size, resourceKey, codeGroupKey]`

### 1.4 Query enabled 조건
- 모든 Admin Query는 `isAuthenticated && Boolean(tenantId)` 조건 필수
- CodeUsage Query는 추가로 `Boolean(resourceKey)` 조건 필요

### 1.5 표준 응답 처리
```typescript
const res = await getAdminUsers(params);
if (res.data) {
  return res.data; // PageResponse<T> 또는 T
}
throw new Error(res.message || 'Failed to fetch users');
```

---

## 2. Users 관리 UI

### 2.1 페이지 경로
- **Route**: `/admin/users`
- **Component**: `apps/remotes/admin/src/pages/users.tsx`
- **권한 체크**: `PermissionRouteGuard` with `resource="menu.admin.users" permission="VIEW"`

### 2.2 API 연동
- **API 파일**: `libs/shared-utils/src/api/admin-iam-api.ts`
- **Query 파일**: `libs/shared-utils/src/queries/use-admin-users-query.ts`

**주요 함수**:
- `getAdminUsers(params?: UserListParams)`: 목록 조회
- `getAdminUserDetail(userId: string)`: 상세 조회
- `createAdminUser(payload: UserCreatePayload)`: 생성
- `updateAdminUser(userId: string, payload: UserUpdatePayload)`: 수정
- `deleteAdminUser(userId: string)`: 삭제
- `resetAdminUserPassword(userId: string, payload?: ResetPasswordPayload)`: 비밀번호 초기화
- `getAdminUserRoles(userId: string)`: 사용자 역할 조회
- `updateAdminUserRoles(userId: string, roleIds: string[])`: 사용자 역할 할당

### 2.3 Query Hooks
```typescript
// 목록 조회
const { data, isLoading, error, refetch } = useAdminUsersQuery({
  page: 1,
  size: 10,
  keyword: '홍',
  status: 'ACTIVE'
});

// 생성
const createMutation = useCreateAdminUserMutation();
await createMutation.mutateAsync({
  userName: '홍길동',
  email: 'hong@example.com',
  createLocalAccount: true,
  principal: 'hong',
  password: 'password123'
});

// 수정
const updateMutation = useUpdateAdminUserMutation();
await updateMutation.mutateAsync({
  userId: '1',
  payload: { userName: '홍길동', status: 'ACTIVE' }
});

// 삭제
const deleteMutation = useDeleteAdminUserMutation();
await deleteMutation.mutateAsync('1');
```

### 2.4 UI 구성
- **상단 필터 바**:
  - 검색 (keyword): 이름/이메일/사번 검색
  - 상태 필터: `USER_STATUS` 코드 기반 (usage 조회)
- **테이블**:
  - 컬럼: 사용자명, 이메일, 부서, 상태, 생성일
  - 페이징: TablePagination (10/30/50 옵션)
  - Row Action: Edit / 역할 관리 / 비밀번호 초기화 / Delete
- **Dialog**:
  - UserCreateDialog: 사용자 생성
  - UserEditDialog: 사용자 수정 (상태 포함)
  - UserRolesDialog: 역할 할당 (체크박스 리스트)
  - ResetPasswordDialog: 비밀번호 초기화
  - DeleteConfirmDialog: 삭제 확인

### 2.5 코드 사용 정책
- **resourceKey**: `menu.admin.users`
- **사용 코드 그룹**:
  - `USER_STATUS`: 사용자 상태 (ACTIVE/INACTIVE 등)
  - `SUBJECT_TYPE`: 사용자 타입 (있는 경우)
- **코드 조회 방식**:
```typescript
const { data: codeMap } = useCodesByResourceQuery('menu.admin.users');
const userStatusOptions = getSelectOptionsByGroup(codeMap, 'USER_STATUS');
```

---

## 3. Roles 관리 UI

### 3.1 페이지 경로
- **Route**: `/admin/roles`
- **Component**: `apps/remotes/admin/src/pages/roles.tsx`
- **권한 체크**: `PermissionRouteGuard` with `resource="menu.admin.roles" permission="VIEW"`

### 3.2 API 연동
- **API 파일**: `libs/shared-utils/src/api/admin-iam-api.ts`
- **Query 파일**: 
  - `libs/shared-utils/src/queries/use-admin-roles-query.ts`
  - `libs/shared-utils/src/queries/use-admin-role-members-query.ts`
  - `libs/shared-utils/src/queries/use-admin-role-permissions-query.ts`

**주요 함수**:
- `getAdminRoles(params?: RoleListParams)`: 역할 목록 조회
- `getAdminRoleDetail(roleId: string)`: 역할 상세 조회
- `createAdminRole(payload: RoleCreatePayload)`: 역할 생성
- `updateAdminRole(roleId: string, payload: RoleUpdatePayload)`: 역할 수정
- `deleteAdminRole(roleId: string)`: 역할 삭제
- `getAdminRoleMembers(roleId: string)`: 역할 멤버 조회
- `updateAdminRoleMembers(roleId: string, payload: RoleMemberAssignmentPayload)`: 역할 멤버 할당
- `getAdminRolePermissions(roleId: string)`: 역할 권한 조회
- `updateAdminRolePermissions(roleId: string, payload: RolePermissionAssignmentPayload)`: 역할 권한 할당

### 3.3 Query Hooks
```typescript
// 역할 목록 조회
const { data, isLoading, error, refetch } = useAdminRolesQuery({
  size: 1000, // 좌측 사이드바용
  keyword: '매니저'
});

// 역할 상세 조회
const { data: roleDetail } = useAdminRoleDetailQuery(roleId);

// 역할 멤버 조회
const { data: roleMembers } = useAdminRoleMembersQuery(roleId);

// 역할 권한 조회
const { data: rolePermissions } = useAdminRolePermissionsQuery(roleId);

// 역할 멤버 업데이트
const updateMembersMutation = useUpdateAdminRoleMembersMutation();
await updateMembersMutation.mutateAsync({
  roleId: '1',
  payload: { userIds: ['1', '2', '3'] }
});

// 역할 권한 업데이트 (bulk)
const updatePermissionsMutation = useUpdateAdminRolePermissionsMutation();
await updatePermissionsMutation.mutateAsync({
  roleId: '1',
  payload: {
    permissions: [
      {
        resourceKey: 'menu.admin.users',
        permissionCodes: ['VIEW', 'USE', 'EDIT']
      }
    ]
  }
});
```

### 3.4 UI 구성
- **좌측 사이드바**: 역할 리스트 (검색 가능)
- **우측 상세 영역**:
  - **Role Info Card**: 역할명, 역할 코드, 상태, 설명, 편집/삭제 버튼
  - **Members Section**: 멤버 목록 + "관리" 버튼 (Dialog로 사용자 선택)
  - **Permissions Section**: 권한 매트릭스 + "관리" 버튼 (Dialog로 권한 편집)
- **Dialog**:
  - RoleDialog: 역할 생성/수정
  - RoleMembersDialog: 멤버 할당 (체크박스 리스트)
  - RolePermissionsDialog: 권한 매트릭스 편집 (리소스별 권한 체크박스)

### 3.5 권한 매트릭스 편집 로직
```typescript
// 권한 매트릭스 변환 (백엔드 응답 → UI 표시용)
const permissionsMatrix = useMemo(() => {
  if (!rolePermissions || !resourcesTree) return [];
  
  // 리소스 트리를 평탄화하여 매트릭스 구성
  const flattenResources = (nodes: ResourceNode[]): ResourceNode[] => {
    const result: ResourceNode[] = [];
    nodes.forEach(node => {
      result.push(node);
      if (node.children) {
        result.push(...flattenResources(node.children));
      }
    });
    return result;
  };
  
  const allResources = flattenResources(resourcesTree);
  const permissionMap = new Map(
    rolePermissions.permissions.map(p => [`${p.resourceKey}:${p.permissionCode}`, p.effect])
  );
  
  return allResources.map(resource => ({
    resourceKey: resource.resourceKey,
    resourceName: resource.resourceName,
    permissions: PERMISSION_CODES.map(code => ({
      code,
      granted: permissionMap.get(`${resource.resourceKey}:${code}`) === 'ALLOW'
    }))
  }));
}, [rolePermissions, resourcesTree]);
```

### 3.6 코드 사용 정책
- **resourceKey**: `menu.admin.roles`
- **사용 코드 그룹**:
  - `PERMISSION_CODE`: 권한 코드 (VIEW, USE, EDIT, DELETE 등)
  - `ROLE_STATUS`: 역할 상태 (ACTIVE/INACTIVE)
  - `EFFECT_TYPE`: 권한 효과 (ALLOW/DENY)
- **코드 조회 방식**:
```typescript
const { data: codeMap } = useCodesByResourceQuery('menu.admin.roles');
const permissionOptions = getSelectOptionsByGroup(codeMap, 'PERMISSION_CODE');
const roleStatusOptions = getSelectOptionsByGroup(codeMap, 'ROLE_STATUS');
```

---

## 4. Resources 관리 UI

### 4.1 페이지 경로
- **Route**: `/admin/resources`
- **Component**: `apps/remotes/admin/src/pages/resources.tsx`
- **권한 체크**: `PermissionRouteGuard` with `resource="menu.admin.resources" permission="VIEW"`

### 4.2 API 연동
- **API 파일**: `libs/shared-utils/src/api/admin-iam-api.ts`
- **Query 파일**: `libs/shared-utils/src/queries/use-admin-resources-query.ts`

**주요 함수**:
- `getAdminResources(params?: ResourceListParams)`: 리소스 목록 조회
- `getAdminResourcesTree()`: 리소스 트리 조회
- `getAdminResourceDetail(resourceId: string)`: 리소스 상세 조회
- `createAdminResource(payload: ResourceCreatePayload)`: 리소스 생성
- `updateAdminResource(resourceId: string, payload: ResourceUpdatePayload)`: 리소스 수정
- `deleteAdminResource(resourceId: string)`: 리소스 삭제

### 4.3 Query Hooks
```typescript
// 리소스 트리 조회
const { data: resourcesTree, isLoading, error, refetch } = useAdminResourcesTreeQuery();

// 리소스 생성
const createMutation = useCreateAdminResourceMutation();
await createMutation.mutateAsync({
  resourceName: '사용자 관리',
  resourceKey: 'menu.admin.users',
  resourceType: 'MENU',
  parentId: '10',
  enabled: true
});

// 리소스 수정
const updateMutation = useUpdateAdminResourceMutation();
await updateMutation.mutateAsync({
  resourceId: '1',
  payload: { resourceName: '사용자 관리 (수정)', enabled: false }
});
```

### 4.4 UI 구성
- **상단 필터 바**:
  - 검색 (keyword): 리소스명/리소스 키 검색
  - 리소스 타입 필터: `RESOURCE_TYPE` 코드 기반 (usage 조회)
- **트리 뷰**:
  - 계층 구조 표시 (Collapse 기반)
  - 각 노드: 리소스명, 리소스 키, 타입, 상태, 메뉴 버튼 (Edit/Delete)
  - 트리 확장/축소 기능
- **Dialog**:
  - ResourceDialog: 리소스 생성/수정 (부모 리소스 선택 포함)
  - DeleteConfirmDialog: 삭제 확인

### 4.5 코드 사용 정책
- **resourceKey**: `menu.admin.resources`
- **사용 코드 그룹**:
  - `RESOURCE_TYPE`: 리소스 타입 (MENU, BUTTON, API 등)
  - `RESOURCE_CATEGORY`: 리소스 카테고리 (있는 경우)
  - `RESOURCE_KIND`: 리소스 종류 (있는 경우)
- **코드 조회 방식**:
```typescript
const { data: codeMap } = useCodesByResourceQuery('menu.admin.resources');
const resourceTypes = getSelectOptionsByGroup(codeMap, 'RESOURCE_TYPE');
```

---

## 5. Code Management UI

### 5.1 페이지 경로
- **Route**: `/admin/codes`
- **Component**: `apps/remotes/admin/src/pages/codes.tsx`
- **권한 체크**: `PermissionRouteGuard` with `resource="menu.admin.codes" permission="VIEW"`

### 5.2 API 연동
- **API 파일**: `libs/shared-utils/src/api/admin-iam-api.ts`
- **Query 파일**: 
  - `libs/shared-utils/src/queries/use-code-groups-query.ts`
  - `libs/shared-utils/src/queries/use-codes-by-group-query.ts`

**주요 함수**:
- `getCodeGroups()`: 코드 그룹 목록 조회
- `getCodesByGroup(groupKey: string)`: 그룹별 코드 목록 조회
- `createCodeGroup(payload: CodeGroupCreatePayload)`: 코드 그룹 생성
- `updateCodeGroup(groupId: string, payload: CodeGroupUpdatePayload)`: 코드 그룹 수정
- `deleteCodeGroup(groupId: string)`: 코드 그룹 삭제
- `createCode(payload: CodeCreatePayload)`: 코드 생성
- `updateCode(codeId: string, payload: CodeUpdatePayload)`: 코드 수정
- `deleteCode(codeId: string)`: 코드 삭제

### 5.3 UI 구성
- **좌측 패널**: 코드 그룹 리스트 (선택 시 우측에 코드 목록 표시)
- **우측 패널**: 선택된 그룹의 코드 목록 (테이블)
- **Dialog**:
  - CodeGroupDialog: 코드 그룹 생성/수정
  - CodeDialog: 코드 생성/수정
  - DeleteConfirmDialog: 삭제 확인

### 5.4 특이 사항
- **예외 처리**: Codes 화면만 `/api/admin/codes/all` 조회 허용 (전체 코드 그룹 조회 필요)
- **다른 화면**: 반드시 `/api/admin/codes/usage?resourceKey=...` 사용

---

## 6. CodeUsage 관리 UI ⭐ 신규

### 6.1 페이지 경로
- **Route**: `/admin/code-usages`
- **Component**: `apps/remotes/admin/src/pages/code-usages.tsx`
- **권한 체크**: `PermissionRouteGuard` with `resource="menu.admin.code-usages" permission="VIEW"`

### 6.2 API 연동
- **API 파일**: `libs/shared-utils/src/api/code-usage-api.ts`
- **Query 파일**: `libs/shared-utils/src/queries/use-code-usages-query.ts`

**주요 함수**:
- `getCodeUsages(params?: CodeUsageListParams)`: 코드 사용 매핑 목록 조회
- `getCodeUsageDetail(id: string)`: 코드 사용 매핑 상세 조회
- `createCodeUsage(payload: CodeUsageCreatePayload)`: 코드 사용 매핑 생성
- `updateCodeUsage(id: string, payload: CodeUsageUpdatePayload)`: 코드 사용 매핑 수정
- `deleteCodeUsage(id: string)`: 코드 사용 매핑 삭제

### 6.3 Query Hooks
```typescript
// 목록 조회
const { data, isLoading, error, refetch } = useCodeUsagesQuery({
  page: 1,
  size: 10,
  keyword: 'menu.admin',
  resourceKey: 'menu.admin.users',
  codeGroupKey: 'UI_ACTION',
  enabled: true
});

// 생성
const createMutation = useCreateCodeUsageMutation();
await createMutation.mutateAsync({
  resourceKey: 'menu.admin.users',
  codeGroupKey: 'UI_ACTION',
  enabled: true
});

// 수정 (enabled 토글)
const updateMutation = useUpdateCodeUsageMutation();
await updateMutation.mutateAsync({
  id: '1',
  payload: { enabled: false }
});

// 삭제
const deleteMutation = useDeleteCodeUsageMutation();
await deleteMutation.mutateAsync('1');
```

### 6.4 UI 구성
- **상단 필터 바**:
  - 검색 (keyword): Resource Key / Code Group Key 검색
  - Resource Key 필터: Resources 트리에서 추출한 고유 키 목록
  - Code Group Key 필터: Code Groups에서 추출한 고유 키 목록
  - 상태 필터: 활성/비활성
- **테이블**:
  - 컬럼: Resource Key, Code Group Key, 상태, 생성일
  - 페이징: TablePagination (10/30/50 옵션)
  - Row Action: Edit / Delete
- **Dialog**:
  - CodeUsageDialog: 코드 사용 매핑 생성/수정
  - DeleteConfirmDialog: 삭제 확인

### 6.5 코드 사용 매핑 동작 원리
1. **생성**: 운영자가 `menu.admin.users` + `UI_ACTION` 매핑 생성
2. **조회**: Users 화면에서 `useCodesByResourceQuery('menu.admin.users')` 호출
3. **백엔드**: `/api/admin/codes/usage?resourceKey=menu.admin.users`에서 매핑된 `UI_ACTION` 코드만 반환
4. **프론트엔드**: `getSelectOptionsByGroup(codeMap, 'UI_ACTION')`로 드롭다운 옵션 생성

---

## 7. RBAC UX 강화

### 7.1 전역 403 처리
- **위치**: `libs/shared-utils/src/axios-instance.ts`
- **동작**:
  - 401: 로그아웃 + `/sign-in?returnUrl=...` 리다이렉트
  - 403: 로그아웃 금지, `/403` 페이지로 리다이렉트
- **무한 루프 방지**: `isHandlingUnauthorized` 플래그 사용

### 7.2 라우트 레벨 보호
- **컴포넌트**: `PermissionRouteGuard`
- **사용 예시**:
```typescript
export const UsersPage = () => (
  <PermissionRouteGuard resource="menu.admin.users" permission="VIEW" redirectTo="/403">
    <UsersPageContent />
  </PermissionRouteGuard>
);
```

### 7.3 UI 컴포넌트 레벨 보호
- **컴포넌트**: `PermissionGate` (design-system)
- **사용 예시**:
```typescript
<PermissionGate resource="menu.admin.users" permission="CREATE">
  <Button onClick={handleCreate}>추가</Button>
</PermissionGate>
```

### 7.4 Query Error 처리
- React Query의 `onError`에서 자동 처리
- 403 발생 시 사용자에게 "접근 권한 없음" Alert 표시
- 페이지 UI는 disable 처리 (로그아웃하지 않음)

---

## 8. 코드 사용 정책 상세

### 8.1 기본 원칙
- ❌ `/api/admin/codes/all` 의존성 제거 (Codes 화면 제외)
- ✅ 각 화면은 자신의 `resourceKey` 기준으로 필요한 코드만 조회
- ✅ API: `GET /api/admin/codes/usage?resourceKey=...`
- ✅ 응답 구조: `{ [groupKey: string]: Code[] }`

### 8.2 화면별 코드 조회 매핑
| 화면 | resourceKey | 사용 코드 그룹 |
|------|-------------|----------------|
| Users | `menu.admin.users` | `USER_STATUS`, `SUBJECT_TYPE` |
| Roles | `menu.admin.roles` | `PERMISSION_CODE`, `ROLE_STATUS`, `EFFECT_TYPE` |
| Resources | `menu.admin.resources` | `RESOURCE_TYPE`, `RESOURCE_CATEGORY`, `RESOURCE_KIND` |
| Code Usages | `menu.admin.code-usages` | (없음, 매핑 관리 화면) |
| Codes | `menu.admin.codes` | **예외** (전체 코드 그룹 조회) |
| Monitoring | `menu.admin.monitoring` | `UI_ACTION`, `EVENT_TYPE` |

### 8.3 표준 사용 패턴
```typescript
// 1. 코드 조회
const { data: codeMap, isLoading: codesLoading } = useCodesByResourceQuery('menu.admin.users');

// 2. 그룹별 옵션 추출
const userStatusOptions = getSelectOptionsByGroup(codeMap, 'USER_STATUS');

// 3. UI에 적용
<TextField
  select
  label="상태"
  value={statusFilter}
  onChange={(e) => setStatusFilter(e.target.value)}
  disabled={!userStatusOptions.length || codesLoading}
  helperText={
    codesLoading
      ? '코드 로딩 중...'
      : !userStatusOptions.length
        ? '코드 매핑 필요 (CodeUsage에서 설정)'
        : undefined
  }
>
  <MenuItem value="">전체</MenuItem>
  {userStatusOptions.map((option) => (
    <MenuItem key={option.value} value={option.value}>
      {option.label}
    </MenuItem>
  ))}
</TextField>
```

### 8.4 Fallback 정책
- **코드 매핑이 없는 경우**:
  - Dropdown을 `disabled` 처리
  - Helper text에 "코드 매핑 필요" 메시지 표시
  - 임시로 `all` 조회 fallback **금지** (운영 안정성)
- **UX 정책**:
  - 로딩 중: "코드 로딩 중..." 표시
  - 매핑 없음: "코드 매핑 필요" 표시 + disabled

---

## 9. 파일 구조

### 9.1 API Layer
```
libs/shared-utils/src/api/
├── admin-iam-api.ts          # Users, Roles, Resources, Codes API
└── code-usage-api.ts         # CodeUsage 조회 및 CRUD API
```

### 9.2 Query Layer
```
libs/shared-utils/src/queries/
├── use-admin-users-query.ts
├── use-admin-user-detail-query.ts
├── use-admin-user-roles-query.ts
├── use-admin-roles-query.ts
├── use-admin-role-members-query.ts
├── use-admin-role-permissions-query.ts
├── use-admin-resources-query.ts
├── use-code-groups-query.ts
├── use-codes-by-group-query.ts
├── use-code-usages-query.ts          # ⭐ 신규
└── use-codes-by-resource-query.ts
```

### 9.3 UI Layer
```
apps/remotes/admin/src/pages/
├── users.tsx
├── roles.tsx
├── resources.tsx
├── codes.tsx
├── code-usages.tsx                  # ⭐ 신규
└── monitoring.tsx
```

### 9.4 Types
```
libs/shared-utils/src/admin/types.ts
├── UserSummary, UserDetail, UserCreatePayload, UserUpdatePayload
├── RoleSummary, RoleDetail, RoleCreatePayload, RoleUpdatePayload
├── ResourceSummary, ResourceNode, ResourceCreatePayload, ResourceUpdatePayload
├── CodeGroup, Code, CodeGroupCreatePayload, CodeCreatePayload
└── CodeUsageSummary, CodeUsageDetail, CodeUsageCreatePayload, CodeUsageUpdatePayload  # ⭐ 신규
```

### 9.5 Utils
```
libs/shared-utils/src/admin/
├── code-utils.ts              # toSelectOptions, getSelectOptionsByGroup
├── event-actions.ts           # UiAction 타입, normalizeAction
└── types.ts                  # 모든 Admin 타입 정의
```

---

## 10. 테스트

### 10.1 Unit Tests
- **위치**: `libs/shared-utils/src/admin/__tests__/`
- **파일**:
  - `code-utils.test.ts`: 코드 변환 로직 테스트 (7개 테스트 케이스)
  - `event-actions.test.ts`: UiAction 정규화 테스트

### 10.2 테스트 커버리지
- ✅ `toSelectOptions`: 필터링, 정렬, fallback 라벨
- ✅ `getSelectOptionsByGroup`: 그룹별 조회, 존재하지 않는 그룹 처리
- ✅ `isValidUiAction`: 유효한 액션 검증
- ✅ `normalizeAction`: 액션 정규화 (대문자 변환)

---

## 11. 에러 처리

### 11.1 HTTP 에러 코드
| HTTP 상태 | 처리 방식 | 사용자 안내 |
|----------|----------|------------|
| 401 | 로그아웃 + `/sign-in` 리다이렉트 | "인증이 필요합니다" |
| 403 | 로그아웃 금지, `/403` 페이지 리다이렉트 | "접근 권한이 없습니다" |
| 404 | Alert 표시 | "요청한 리소스를 찾을 수 없습니다" |
| 500 | Alert 표시 | "서버 오류가 발생했습니다" |

### 11.2 Query Error 처리
```typescript
const { data, isLoading, error } = useAdminUsersQuery(params);

if (error) {
  return (
    <Alert severity="error">
      사용자 목록을 불러오는 중 오류가 발생했습니다: {error instanceof Error ? error.message : 'Unknown error'}
    </Alert>
  );
}
```

---

## 12. 주요 구현 사항

### 12.1 CodeUsage 관리 UI 신규 생성
- ✅ CodeUsage CRUD API 추가 (`code-usage-api.ts`)
- ✅ CodeUsage Query hooks 추가 (`use-code-usages-query.ts`)
- ✅ CodeUsage 관리 페이지 생성 (`code-usages.tsx`)
- ✅ 라우트 추가 (`/admin/code-usages`)

### 12.2 기존 페이지 실연동 완성
- ✅ Users 페이지: 검색/필터/페이징/CRUD 모두 구현
- ✅ Roles 페이지: RoleMembers, RolePermissions 매트릭스 편집 구현
- ✅ Resources 페이지: 트리 편집, 필터 구현
- ✅ Codes 페이지: 코드 그룹/코드 CRUD 구현

### 12.3 RBAC UX 강화
- ✅ 전역 403 처리 (axios-instance.ts)
- ✅ 라우트 레벨 보호 (PermissionRouteGuard)
- ✅ UI 컴포넌트 레벨 보호 (PermissionGate)

### 12.4 코드 사용 정책 준수
- ✅ 모든 드롭다운/필터는 usage 기반 코드 조회 사용
- ✅ 하드코딩된 코드 값 제거
- ✅ Fallback 정책 구현 (disabled + helper text)

---

## 13. 백엔드 연동 체크리스트

### 13.1 API 엔드포인트 확인
- [x] `GET /api/admin/users` - 사용자 목록 조회
- [x] `POST /api/admin/users` - 사용자 생성
- [x] `PUT /api/admin/users/{id}` - 사용자 수정
- [x] `DELETE /api/admin/users/{id}` - 사용자 삭제
- [x] `GET /api/admin/roles` - 역할 목록 조회
- [x] `GET /api/admin/roles/{id}/members` - 역할 멤버 조회
- [x] `GET /api/admin/roles/{id}/permissions` - 역할 권한 조회
- [x] `PUT /api/admin/roles/{id}/permissions` - 역할 권한 업데이트
- [x] `GET /api/admin/resources/tree` - 리소스 트리 조회
- [x] `GET /api/admin/codes/usage?resourceKey=...` - 메뉴별 코드 조회
- [x] `GET /api/admin/code-usages` - 코드 사용 매핑 목록 조회
- [x] `POST /api/admin/code-usages` - 코드 사용 매핑 생성
- [x] `PUT /api/admin/code-usages/{id}` - 코드 사용 매핑 수정
- [x] `DELETE /api/admin/code-usages/{id}` - 코드 사용 매핑 삭제

### 13.2 응답 형식 확인
- [x] `PageResponse<T>` 형식 (items, total, page, size, totalPages)
- [x] `ApiResponse<T>` 래퍼 형식 (success, data, message)
- [x] 에러 응답 형식 (success: false, message)

### 13.3 권한 체크 확인
- [x] 403 Forbidden 응답 처리
- [x] 권한 없을 때 적절한 UX 제공

---

**작성자**: DWP Frontend Team  
**최종 업데이트**: 2026-01-20
