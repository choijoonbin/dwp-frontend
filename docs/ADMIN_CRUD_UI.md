# Admin CRUD UI 구현 완료 요약 (FE P1-3)

## 1. 구현된 기능

### 1.1. Users 화면 (/admin/users) - 강화 버전
- **권한 체크**: `menu.admin.users` VIEW 권한 필요
- **기능**:
  - 사용자 목록 조회 (페이징, keyword 검색, status 필터)
  - 사용자 생성 (로컬 계정 생성 옵션 포함)
  - 사용자 편집 (이름, 이메일, 상태)
  - 사용자 삭제 (확인 다이얼로그)
  - 역할 할당 (체크박스 기반 다중 선택)
  - 비밀번호 초기화 (임시 비밀번호 생성 또는 새 비밀번호 입력)
- **Form Validation**:
  - 이메일 형식 검증 (`validateEmail`, `getEmailError`)
  - 비밀번호 강도 검증 (`validatePassword`, `getPasswordError`)
    - 최소 8자 이상
    - 영문과 숫자 포함 필수
  - principal 중복 시 백엔드 에러 표시
- **권한 적용**:
  - VIEW: 페이지 접근
  - EDIT: 생성/편집 버튼 활성화
  - EXECUTE: 역할 관리/비밀번호 초기화 버튼 활성화
  - DELETE: 삭제 버튼 활성화

### 1.2. Roles 화면 (/admin/roles) - 강화 버전
- **권한 체크**: `menu.admin.roles` VIEW 권한 필요
- **화면 구조**: 좌측 역할 리스트 + 우측 역할 상세 (설명, 멤버, 권한 매트릭스)
- **기능**:
  - 역할 목록 조회 (keyword 검색, 좌측 사이드바)
  - 역할 선택 시 우측에 상세 정보 표시
  - 역할 생성/편집 (역할명, 역할 코드, 설명, 상태)
  - 역할 삭제 (확인 다이얼로그)
  - 멤버 할당 (사용자 체크박스 선택, Dialog)
  - 권한 매핑 (리소스 트리 기반, Code API 기반 권한 코드 체크박스)
  - **성능 최적화**:
    - Permission Matrix: lazy expand (접힌 상태로 시작)
    - 리소스 검색 필터 제공
    - expand 상태 기반 렌더링 (Collapse 사용)
- **권한 적용**:
  - VIEW: 페이지 접근
  - EDIT: 생성/편집 버튼 활성화
  - EXECUTE: 멤버 관리/권한 관리 버튼 활성화
  - DELETE: 삭제 버튼 활성화
- **권한 코드**: Code API의 `PERMISSION_CODE` 그룹에서 동적으로 로드 (하드코딩 금지)

### 1.3. Resources 화면 (/admin/resources) - 강화 버전
- **권한 체크**: `menu.admin.resources` VIEW 권한 필요
- **기능**:
  - 리소스 트리 조회 (계층 구조 표시)
  - 리소스 생성/편집 (리소스명, 리소스 키, 타입, path, 부모 리소스, 정렬 순서, 활성화)
  - 리소스 삭제 (확인 다이얼로그)
  - 트리 필터링 (keyword, resourceType)
  - 트리 확장/축소 (Collapse 기반)
- **타입 옵션**: Code API의 `RESOURCE_TYPE` 그룹에서 동적으로 로드 (하드코딩 금지)
- **권한 적용**:
  - VIEW: 페이지 접근
  - EDIT: 생성/편집 버튼 활성화
  - DELETE: 삭제 버튼 활성화

### 1.4. Codes 화면 (/admin/codes)
- **권한 체크**: `menu.admin.codes` VIEW 권한 필요
- **기능**:
  - 코드 그룹 목록 (좌측 패널)
  - 코드 목록 (우측 패널, 선택된 그룹의 코드)
  - 코드 그룹 생성/편집/삭제
  - 코드 생성/편집/삭제
  - 코드 그룹 선택 시 해당 그룹의 코드 자동 로드
- **권한 적용**:
  - VIEW: 페이지 접근
  - EDIT: 생성/편집 버튼 활성화
  - DELETE: 삭제 버튼 활성화

## 2. API Layer

### 2.1. admin-iam-api.ts
- **Users API**:
  - `getAdminUsers`: 사용자 목록 조회
  - `getAdminUserDetail`: 사용자 상세 조회
  - `createAdminUser`: 사용자 생성
  - `updateAdminUser`: 사용자 수정
  - `deleteAdminUser`: 사용자 삭제
  - `resetAdminUserPassword`: 비밀번호 초기화
  - `getAdminUserRoles`: 사용자 역할 조회
  - `updateAdminUserRoles`: 사용자 역할 할당
- **Roles API**:
  - `getAdminRoles`: 역할 목록 조회
  - `getAdminRoleDetail`: 역할 상세 조회
  - `createAdminRole`: 역할 생성
  - `updateAdminRole`: 역할 수정
  - `deleteAdminRole`: 역할 삭제
  - `getAdminRoleMembers`: 역할 멤버 조회
  - `updateAdminRoleMembers`: 역할 멤버 할당
  - `getAdminRolePermissions`: 역할 권한 조회
  - `updateAdminRolePermissions`: 역할 권한 할당
- **Resources API**:
  - `getAdminResources`: 리소스 목록 조회
  - `getAdminResourcesTree`: 리소스 트리 조회
  - `getAdminResourceDetail`: 리소스 상세 조회
  - `createAdminResource`: 리소스 생성
  - `updateAdminResource`: 리소스 수정
  - `deleteAdminResource`: 리소스 삭제
- **Codes API**:
  - `getCodeGroups`: 코드 그룹 목록 조회
  - `getCodesByGroup`: 그룹별 코드 조회
  - `getAllCodes`: 전체 코드 조회
  - `createCodeGroup`: 코드 그룹 생성
  - `updateCodeGroup`: 코드 그룹 수정
  - `deleteCodeGroup`: 코드 그룹 삭제
  - `createCode`: 코드 생성
  - `updateCode`: 코드 수정
  - `deleteCode`: 코드 삭제

## 3. Query Layer

### 3.1. Users Queries
- `use-admin-users-query.ts`: 사용자 목록 쿼리
- `use-admin-user-detail-query.ts`: 사용자 상세 쿼리
- `use-admin-user-roles-query.ts`: 사용자 역할 쿼리 및 mutation

### 3.2. Roles Queries
- `use-admin-roles-query.ts`: 역할 목록/상세 쿼리 및 mutation
- `use-admin-role-members-query.ts`: 역할 멤버 쿼리 및 mutation
- `use-admin-role-permissions-query.ts`: 역할 권한 쿼리 및 mutation

### 3.3. Resources Queries
- `use-admin-resources-query.ts`: 리소스 목록/트리/상세 쿼리 및 mutation

### 3.4. Codes Queries
- `use-code-groups-query.ts`: 코드 그룹 쿼리 및 mutation
- `use-codes-by-group-query.ts`: 그룹별 코드 쿼리 및 mutation
- `use-all-codes-query.ts`: 전체 코드 쿼리

### 3.5. Query Key 규칙
- Users: `['admin', 'users', tenantId, params]`
- User Detail: `['admin', 'user', tenantId, userId]`
- User Roles: `['admin', 'user', tenantId, userId, 'roles']`
- Roles: `['admin', 'roles', tenantId, params]`
- Role Detail: `['admin', 'role', tenantId, roleId]`
- Role Members: `['admin', 'role', tenantId, roleId, 'members']`
- Role Permissions: `['admin', 'role', tenantId, roleId, 'permissions']`
- Resources: `['admin', 'resources', tenantId, params]`
- Resources Tree: `['admin', 'resources', 'tree', tenantId]`
- Code Groups: `['admin', 'codes', 'groups', tenantId]`
- Codes by Group: `['admin', 'codes', tenantId, groupKey]`

## 4. 공통 UX

### 4.1. 로딩 상태
- Skeleton 컴포넌트 사용
- 테이블/리스트 로딩 시 행 수만큼 Skeleton 표시

### 4.2. 에러 처리
- Alert 컴포넌트로 에러 메시지 표시
- mutation 실패 시 Snackbar로 알림

### 4.3. Empty State
- "데이터가 없습니다." 메시지 표시

### 4.4. 성공/실패 알림
- Snackbar + Alert 조합 사용
- 성공: 초록색, 실패: 빨간색

### 4.5. 확인 다이얼로그
- 삭제 작업 시 필수 확인 다이얼로그 표시

## 5. 권한 정책

### 5.1. 페이지 접근
- 모든 CRUD 페이지는 `PermissionRouteGuard`로 보호
- 권한이 없으면 `/403`으로 리다이렉트

### 5.2. 버튼 제어
- `PermissionGate` 컴포넌트로 버튼 표시/비활성화 제어
- 권한이 없으면 버튼 숨김 또는 비활성화

### 5.3. 권한 코드
- VIEW: 조회 권한
- EDIT: 생성/수정 권한
- DELETE: 삭제 권한
- EXECUTE: 실행 권한 (역할 할당, 비밀번호 초기화 등)

## 6. 타입 정의 및 공통 유틸

### 6.1. admin/types.ts
- `PageResponse<T>`: 페이징 응답
- `UserSummary`, `UserDetail`, `UserAccount`: 사용자 타입
- `RoleSummary`, `RoleDetail`: 역할 타입
- `ResourceSummary`, `ResourceNode`: 리소스 타입
- `CodeGroup`, `Code`: 코드 타입
- 모든 Create/Update Payload 타입 정의

### 6.2. admin/form-validation.ts (신규)
- `validateEmail`: 이메일 형식 검증
- `getEmailError`: 이메일 에러 메시지 반환
- `validatePassword`: 비밀번호 강도 검증 (최소 8자, 영문+숫자)
- `getPasswordError`: 비밀번호 에러 메시지 반환
- `validateRequired`: 필수 필드 검증
- `getRequiredError`: 필수 필드 에러 메시지 반환
- `validateResourceKey`: 리소스 키 형식 검증
- `getResourceKeyError`: 리소스 키 에러 메시지 반환
- `validateCodeKey`: 코드 키 형식 검증
- `getCodeKeyError`: 코드 키 에러 메시지 반환

## 7. 테스트

### 7.1. admin-utils.test.ts
- `buildResourceTree`: 리소스 트리 빌드 및 정렬 테스트
- `mergeRolePermissions`: 역할 권한 병합 테스트

## 8. 생성/수정된 파일 목록

### 8.1. 타입 정의 및 공통 유틸
- `libs/shared-utils/src/admin/types.ts` (신규)
- `libs/shared-utils/src/admin/form-validation.ts` (신규)

### 8.2. API Layer
- `libs/shared-utils/src/api/admin-iam-api.ts` (신규)

### 8.3. Query Layer
- `libs/shared-utils/src/queries/use-admin-users-query.ts` (신규)
- `libs/shared-utils/src/queries/use-admin-user-detail-query.ts` (신규)
- `libs/shared-utils/src/queries/use-admin-user-roles-query.ts` (신규)
- `libs/shared-utils/src/queries/use-admin-roles-query.ts` (신규)
- `libs/shared-utils/src/queries/use-admin-role-members-query.ts` (신규)
- `libs/shared-utils/src/queries/use-admin-role-permissions-query.ts` (신규)
- `libs/shared-utils/src/queries/use-admin-resources-query.ts` (신규)
- `libs/shared-utils/src/queries/use-code-groups-query.ts` (신규)
- `libs/shared-utils/src/queries/use-codes-by-group-query.ts` (신규)
- `libs/shared-utils/src/queries/use-all-codes-query.ts` (신규)

### 8.4. UI 구현
- `apps/remotes/admin/src/pages/users.tsx` (수정: 완전한 CRUD 구현)
- `apps/remotes/admin/src/pages/roles.tsx` (수정: 완전한 CRUD 구현)
- `apps/remotes/admin/src/pages/resources.tsx` (수정: 완전한 CRUD 구현)
- `apps/remotes/admin/src/pages/codes.tsx` (신규)
- `apps/remotes/admin/src/admin-app.tsx` (수정: codes 라우트 추가)

### 8.5. 테스트
- `libs/shared-utils/src/admin/__tests__/admin-utils.test.ts` (신규)

### 8.6. Export
- `libs/shared-utils/src/index.ts` (수정: admin 타입 및 쿼리 export 추가)

## 9. 수동 검증 시나리오

### 9.1. Users 화면
1. Admin 로그인 → `/admin/users` 접근
2. 사용자 목록 조회 확인
3. keyword 검색 시 필터링 확인
4. status 필터 변경 시 필터링 확인
5. 사용자 생성:
   - "사용자 추가" 버튼 클릭
   - 사용자명 입력, 로컬 계정 생성 옵션 선택
   - 생성 성공 시 목록에 추가 확인
6. 사용자 편집:
   - 사용자 행의 메뉴 → "편집" 클릭
   - 이름/이메일/상태 수정 후 저장
   - 변경사항 반영 확인
7. 역할 할당:
   - 사용자 행의 메뉴 → "역할 관리" 클릭
   - 역할 체크박스 선택 후 저장
   - 역할 할당 확인
8. 비밀번호 초기화:
   - 사용자 행의 메뉴 → "비밀번호 초기화" 클릭
   - 새 비밀번호 입력 또는 비워두기
   - 임시 비밀번호 또는 성공 메시지 확인
9. 사용자 삭제:
   - 사용자 행의 메뉴 → "삭제" 클릭
   - 확인 다이얼로그에서 확인
   - 목록에서 제거 확인

### 9.2. Roles 화면 (강화 버전)
1. Admin 로그인 → `/admin/roles` 접근
2. 좌측 역할 리스트 확인
3. 역할 선택 시 우측에 상세 정보 표시 확인:
   - 역할 설명
   - 멤버 목록
   - 권한 매트릭스 (리소스 트리 + 권한 코드 체크박스)
4. 역할 생성:
   - 상단 "역할 추가" 버튼 클릭
   - 역할명/코드 입력 후 생성
   - 좌측 목록에 추가 확인
5. 멤버 할당:
   - 역할 선택 후 우측 "멤버" 섹션의 "관리" 버튼 클릭
   - 사용자 체크박스 선택 후 저장
   - 멤버 할당 확인
6. 권한 매핑:
   - 역할 선택 후 우측 "권한" 섹션의 "관리" 버튼 클릭
   - 리소스 트리 확장/축소 동작 확인 (lazy expand)
   - 리소스 검색 필터 동작 확인
   - 리소스별 권한 코드 체크박스 선택 (Code API에서 로드된 권한 코드 사용)
   - 저장 후 권한 할당 확인
   - 실제 메뉴 노출 변화 확인 (재로그인 또는 메뉴 refetch)
7. 성능 테스트:
   - 리소스가 많은 경우에도 렌더링 성능 확인 (lazy expand로 인한 개선)

### 9.3. Resources 화면
1. Admin 로그인 → `/admin/resources` 접근
2. 리소스 트리 조회 확인
3. 트리 확장/축소 동작 확인
4. keyword/resourceType 필터 동작 확인
5. 리소스 생성:
   - "리소스 추가" 버튼 클릭
   - 리소스명/키/타입 입력, 부모 리소스 선택
   - 생성 후 트리에 추가 확인
6. 리소스 편집:
   - 리소스 행의 메뉴 → "편집" 클릭
   - 정보 수정 후 저장
   - 변경사항 반영 확인
7. MENU 리소스 추가 후:
   - 재로그인 또는 메뉴 refetch
   - 사이드바에 메뉴 추가 확인

### 9.4. Codes 화면
1. Admin 로그인 → `/admin/codes` 접근
2. 코드 그룹 목록 확인 (좌측)
3. 코드 그룹 선택 시 코드 목록 확인 (우측)
4. 코드 그룹 생성:
   - 좌측 상단 "+" 버튼 클릭
   - 그룹 키/이름 입력 후 생성
   - 목록에 추가 확인
5. 코드 생성:
   - 우측 상단 "코드 추가" 버튼 클릭
   - 코드 키/이름 입력 후 생성
   - 목록에 추가 확인
6. 코드 수정/삭제 동작 확인
7. Resources 화면의 타입 dropdown에 코드 반영 확인

## 10. API 테스트 가이드 (curl)

### 10.1. Users API
```bash
# 사용자 목록 조회
curl -X GET "http://localhost:8080/api/admin/users?page=1&size=10&keyword=test" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"

# 사용자 생성
curl -X POST "http://localhost:8080/api/admin/users" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "userName": "testuser",
    "email": "test@example.com",
    "createLocalAccount": true,
    "principal": "testuser",
    "password": "password123"
  }'
```

### 10.2. Roles API
```bash
# 역할 목록 조회
curl -X GET "http://localhost:8080/api/admin/roles?page=1&size=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"

# 역할 생성
curl -X POST "http://localhost:8080/api/admin/roles" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "roleName": "Test Role",
    "roleCode": "TEST_ROLE",
    "description": "Test role description",
    "status": "ACTIVE"
  }'
```

### 10.3. Resources API
```bash
# 리소스 트리 조회
curl -X GET "http://localhost:8080/api/admin/resources/tree" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"

# 리소스 생성
curl -X POST "http://localhost:8080/api/admin/resources" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceName": "Test Menu",
    "resourceKey": "menu.test",
    "resourceType": "MENU",
    "path": "/test",
    "enabled": true
  }'
```

### 10.4. Codes API
```bash
# 코드 그룹 목록 조회
curl -X GET "http://localhost:8080/api/admin/codes/groups" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"

# 코드 그룹 생성
curl -X POST "http://localhost:8080/api/admin/codes/groups" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "groupKey": "TEST_GROUP",
    "groupName": "Test Group",
    "enabled": true
  }'
```

## 11. 주의사항 및 강화 버전 변경사항

### 11.1. 권한 변경 반영
- 역할 권한 변경 후 메뉴 반영: 재로그인 또는 메뉴 refetch 필요
- 사용자 역할 변경 후 권한 반영: 재로그인 또는 권한 refetch 필요

### 11.2. 리소스 트리 구조
- parentId 기반 계층 구조
- sortOrder로 정렬 (없으면 resourceName 알파벳 순)

### 11.3. 코드 그룹/코드 키
- groupKey와 codeKey는 unique해야 함
- 중복 시 BE에서 에러 반환

### 11.4. Mutation 후 Invalidate
- 모든 mutation 성공 시 관련 query 자동 invalidate
- 목록/상세/트리 쿼리 모두 갱신

### 11.5. 하드코딩 금지 (강화 버전)
- **권한 코드**: `PERMISSION_CODE` 그룹에서 Code API로 동적 로드
- **리소스 타입**: `RESOURCE_TYPE` 그룹에서 Code API로 동적 로드
- 하드코딩된 문자열(`VIEW`, `USE`, `MENU` 등) 제거
- 모든 드롭다운/라벨/필터는 Code API 기반으로 구성

### 11.6. Form Validation 통일 (강화 버전)
- 이메일 검증: `validateEmail` / `getEmailError` 사용
- 비밀번호 검증: `validatePassword` / `getPasswordError` 사용
- 필수 필드 검증: `validateRequired` / `getRequiredError` 사용
- 리소스 키 검증: `validateResourceKey` / `getResourceKeyError` 사용
- 코드 키 검증: `validateCodeKey` / `getCodeKeyError` 사용
- 서버 에러 메시지(`ApiResponse.message`)를 Alert에 노출하여 원인 확인 가능

### 11.7. Permission Matrix 성능 최적화 (강화 버전)
- 기본 lazy expand (접힌 상태로 시작)
- 리소스 검색 필터 제공
- expand 상태 기반 렌더링 (Collapse 사용)
- 리소스 수 증가 시에도 렌더링 성능 유지

## 12. 향후 개선 사항

### 12.1. Excel 다운로드
- Users/Roles/Resources 목록 Excel 다운로드 기능 (TODO)

### 12.2. 상세 정보 표시
- Row 클릭 시 상세 정보 모달 표시 (TODO)

### 12.3. 부서 관리
- Users 화면의 부서 필터를 코드 기반으로 동적 로드 (현재는 하드코딩)

### 12.4. 권한 미리보기
- Roles 권한 매핑 시 실제 메뉴 트리 미리보기 (TODO)

### 12.5. Permission Matrix 추가 기능 (강화 버전 완료)
- ✅ lazy expand 구현 완료
- ✅ 검색 필터 구현 완료
- ✅ Code API 기반 권한 코드 로드 완료
- ⏳ 권한 일괄 선택/해제 기능 (TODO)
- ⏳ 권한 변경 이력 추적 (TODO)
