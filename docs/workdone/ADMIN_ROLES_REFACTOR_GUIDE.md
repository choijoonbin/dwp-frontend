# [DWP Frontend] Admin Roles 페이지 리팩토링 가이드

## 개요

이 문서는 `apps/remotes/admin/src/pages/roles` 페이지의 리팩토링 구조와 규칙을 정의합니다.
1000라인 이상의 단일 파일을 유지보수 가능한 구조로 분리한 결과를 문서화합니다.

---

## 1. 디렉토리 구조

```
apps/remotes/admin/src/pages/roles/
├── page.tsx                      # 메인 페이지 (레이아웃 + 조립만, 400라인 이하)
├── types.ts                      # 화면 전용 타입 정의
├── adapters/
│   ├── role-adapter.ts           # API → UI Model 변환 (RoleRowModel, RoleDetailModel)
│   ├── permission-matrix.ts      # 권한 매트릭스 변환/정렬 로직
│   └── __tests__/
│       ├── role-adapter.test.ts  # role-adapter 테스트
│       └── permission-matrix.test.ts  # permission-matrix 테스트
├── hooks/
│   ├── use-role-table-state.ts   # TableState: 검색/정렬/페이지/선택 row
│   ├── use-role-editor-state.ts  # EditorState: 모달 open/close, form draft, mode, dirty
│   └── use-role-actions.ts       # CRUD mutate orchestration (query invalidation 포함)
└── components/
    ├── roles-filter-bar.tsx      # 검색 필터 바
    ├── roles-table.tsx           # 역할 목록 테이블 (memo 적용)
    ├── delete-confirm-dialog.tsx # 삭제 확인 다이얼로그
    ├── role-detail-view.tsx      # 역할 상세 뷰 (향후 분리 예정)
    ├── role-editor-modal.tsx     # 역할 편집 모달 (향후 분리 예정)
    └── role-permission-matrix.tsx # 권한 매트릭스 (향후 분리 예정)
```

---

## 2. State 분리 규칙 (절대 준수)

### 2.1 TableState (조회/목록/선택)
**위치**: `hooks/use-role-table-state.ts`

**책임**:
- 검색 키워드 (`keyword`)
- 선택된 역할 ID (`selectedRoleId`)
- 필터/정렬/페이지네이션 (향후 확장)
- Query 데이터 로딩 및 변환

**금지 사항**:
- EditorState (모달, 폼)와 섞이지 않음
- page.tsx에 직접 `useState` 사용 금지

### 2.2 EditorState (생성/수정/보기 모달)
**위치**: `hooks/use-role-editor-state.ts`

**책임**:
- 모달 모드 (`mode: 'create' | 'edit' | 'view'`)
- 모달 열림 상태 (`open`)
- 폼 초안 (`draftForm: RoleFormState`)
- Dirty 상태 (`dirty: boolean`)
- Validation 오류 (`validationErrors`)

**금지 사항**:
- TableState와 섞이지 않음
- page.tsx에 직접 폼 상태 관리 금지

---

## 3. Adapter 규칙 (API → UI Model 변환)

### 3.1 역할 데이터 변환
**파일**: `adapters/role-adapter.ts`

**함수**:
- `toRoleRowModel(role: RoleSummary): RoleRowModel` - 테이블 행용 모델
- `toRoleDetailModel(role: RoleDetail | RoleSummary): RoleDetailModel` - 상세/폼용 모델
- `toRoleRowModels(roles: RoleSummary[]): RoleRowModel[]` - 배열 변환

**규칙**:
- Component는 **절대** raw API DTO (`RoleSummary`, `RoleDetail`)를 직접 참조하지 않음
- 모든 데이터는 adapter를 통해 UI Model로 변환 후 사용
- null-safe 처리 필수 (fallback 값 제공)

### 3.2 권한 매트릭스 변환
**파일**: `adapters/permission-matrix.ts`

**함수**:
- `toPermissionMatrixModels()` - 매트릭스 표시용 모델 변환
- `filterResourceTree()` - 트리 필터링 (재귀)
- `filterTreeNodes()` - 다중 필터 적용 (검색/타입/변경 상태)
- `flattenResourceTree()` - 트리 평탄화

**규칙**:
- 정렬: `sortOrder` 우선, 없으면 `resourceKey` 알파벳 순
- 필터링: 부모-자식 관계 유지 (자식 매칭 시 부모 포함)

---

## 4. Query/API 계층 규칙

### 4.1 Query Hook 사용 위치
- **hooks/** 에서만 Query Hook 사용 (`useAdminRolesQuery`, `useCreateAdminRoleMutation` 등)
- **components/** 에서는 직접 Query Hook 사용 금지
- **page.tsx** 에서도 Query Hook 직접 사용 금지 (hooks를 통해 간접 사용)

### 4.2 Query Key 규칙
- 형식: `['admin', resourceType, tenantId, ...params]`
- 예: `['admin', 'roles', tenantId]`, `['admin', 'role', tenantId, roleId, 'permissions']`

### 4.3 Enabled 조건
- 모든 Query는 `isAuthenticated && Boolean(tenantId)` 조건 필수
- Query Hook 내부에서 처리

### 4.4 Query Invalidation 규칙
**위치**: `hooks/use-role-actions.ts`

**규칙**:
- Mutation 성공 시 `queryClient.invalidateQueries()` 호출
- 관련된 모든 Query Key 무효화
- `refetch()` 호출로 즉시 갱신

**예시**:
```typescript
const invalidateRolesQueries = useCallback(() => {
  queryClient.invalidateQueries({ queryKey: ['admin', 'roles', tenantId] });
  refetch();
}, [queryClient, tenantId, refetch]);
```

---

## 5. 성능 최적화 규칙

### 5.1 useMemo 적용 대상
- **Adapter 변환 결과**: `toRoleRowModels()`, `toPermissionMatrixModels()`
- **필터링/정렬 결과**: `filteredResources`, `filteredTree`
- **계산된 값**: `isDirty`, `changedResources`, `permissionCodes`

### 5.2 useCallback 적용 대상
- **Event Handler**: `handleCreate`, `handleEdit`, `handleDelete`, `handleRoleSelect`
- **Form Handlers**: `updateFormField`, `resetForm`, `validateForm`

### 5.3 React.memo 적용 대상
- **테이블 Row 컴포넌트**: `RoleRow` (props 변경 시에만 re-render)
- **큰 리스트 아이템**: 권한 매트릭스 행 (향후)

**금지**:
- 이유 없는 memo 남발
- 상태가 너무 쪼개져서 props drilling 폭발하는 구조

---

## 6. 폼/모달 UX 규칙

### 6.1 Dirty State 처리
- `dirty=true` 상태에서 모달 닫기 시 확인 다이얼로그 표시
- 브라우저 닫기/새로고침 시 `beforeunload` 이벤트로 경고

### 6.2 모드 전환 규칙
- `create` → `edit`: 폼 초기화 (빈 폼)
- `edit` → `create`: 폼 초기화 (빈 폼)
- `create/edit` → `view`: 폼 초기화 (원본 데이터로)

### 6.3 성공 시 처리
1. Toast 출력 (기존 UX 유지)
2. Query invalidation (`invalidateQueries`)
3. 모달 close
4. Table refetch (선택 유지/리셋 규칙 명확히)

---

## 7. 테스트 위치 및 규칙

### 7.1 테스트 파일 위치
- `adapters/__tests__/` - Adapter 변환 로직 테스트
- `hooks/__tests__/` - Hook 로직 테스트 (향후)

### 7.2 필수 테스트 항목
1. **role-adapter.test.ts**:
   - `toRoleRowModel()` null-safe 처리
   - `toRoleDetailModel()` 필드 누락 시 fallback
   - `filterRoles()` 필터링 로직
   - `sortRolesByName()` 정렬 로직

2. **permission-matrix.test.ts**:
   - `filterResourceTree()` 재귀 필터링
   - `filterTreeNodes()` 다중 필터 조합
   - `flattenResourceTree()` 평탄화 순서

### 7.3 테스트 작성 규칙
- Vitest 사용
- 순수 함수만 테스트 (Hook은 별도 처리)
- Edge case 포함 (null, undefined, empty array)

---

## 8. CodeUsage 기반 옵션 로딩

### 8.1 규칙
- 모든 selectbox 옵션은 CodeUsage API 기반으로만 로드
- `useCodesByResourceQuery('menu.admin.roles')` 사용
- 코드 그룹: `ROLE_STATUS`, `PERMISSION_CODE`, `RESOURCE_TYPE` 등

### 8.2 Fallback 처리
- 코드 매핑이 없으면 selectbox 비활성화 + helperText 표시
- 하드코딩된 옵션 금지

---

## 9. 파일 크기 제한 규칙

### 9.1 라인 수 제한
- **page.tsx**: 400라인 이하 (절대 초과 금지)
- **Component**: 250라인 이하
- **Hook**: 200라인 이하
- **Adapter**: 150라인 이하

### 9.2 초과 시 조치
- 기능 단위로 분리 (컴파일만 되게 쪼개기 금지)
- 새로운 파일/디렉토리 생성
- 기존 import 경로 유지 (backward compatibility)

---

## 10. 재발 방지 가드 레일

### 10.1 코드 리뷰 체크리스트
- [ ] page.tsx가 400라인 이하인가?
- [ ] TableState와 EditorState가 분리되어 있는가?
- [ ] Component가 raw API DTO를 직접 참조하지 않는가?
- [ ] Adapter 변환 결과가 useMemo로 캐싱되는가?
- [ ] Event handler가 useCallback으로 안정화되어 있는가?
- [ ] Query invalidation이 mutation 성공 시 호출되는가?

### 10.2 ESLint 규칙 (향후)
- `max-lines` 규칙으로 page.tsx 라인 수 제한
- `no-restricted-imports`로 raw API DTO 직접 import 금지

---

## 11. 마이그레이션 가이드

### 11.1 기존 코드에서 새 구조로 전환
1. 기존 `roles.tsx`는 backward compatibility를 위해 유지
2. 새로운 컴포넌트는 `roles/` 디렉토리에 생성
3. 점진적으로 기존 컴포넌트를 분리

### 11.2 Import 경로
```typescript
// ✅ 올바른 import
import { useRoleTableState } from './hooks/use-role-table-state';
import { toRoleRowModel } from './adapters/role-adapter';
import { RolesTable } from './components/roles-table';

// ❌ 잘못된 import (raw API DTO 직접 사용)
import type { RoleSummary } from '@dwp-frontend/shared-utils';
// → RoleRowModel을 사용해야 함
```

---

## 12. 참고 자료

- [DWP Frontend Unified Enterprise Rules](../.cursorrules)
- [Admin Remote Implementation](./ADMIN_REMOTE_IMPLEMENTATION.md)
- [P1-5 Admin CRUD FE Implementation](./P1-5_ADMIN_CRUD_FE_IMPLEMENTATION.md)

---

**최종 업데이트**: 2026-01-20
**버전**: 1.0
