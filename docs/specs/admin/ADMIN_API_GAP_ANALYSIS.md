# Admin API Gap Analysis (FE-Driven)

> **최종 업데이트**: 2026-01-22  
> **목적**: Admin 메뉴 전체(통합모니터링 제외)의 FE 요구사항 vs BE 실체 비교 분석  
> **범위**: Resources, Roles, Users, Audit, Codes, Code Usages, Menus

---

## 📋 목차

1. [FE 기반 Admin API 요구사항 인벤토리](#1-fe-기반-admin-api-요구사항-인벤토리)
2. [BE 기준 Admin API 실체 인벤토리](#2-be-기준-admin-api-실체-인벤토리)
3. [Gap Matrix (요구 vs 존재)](#3-gap-matrix-요구-vs-존재)
4. [부족한 응답 필드 목록](#4-부족한-응답-필드-목록)
5. [미존재 API 목록](#5-미존재-api-목록)
6. [추가 구현이 필요한 기능](#6-추가-구현이-필요한-기능)
7. [우선순위 및 영향도](#7-우선순위-및-영향도)
8. [해결 방식 및 롤백 전략](#8-해결-방식-및-롤백-전략)
9. [체크리스트 (DoD)](#9-체크리스트-dod)

---

## 1. FE 기반 Admin API 요구사항 인벤토리

> **출처**: `libs/shared-utils/src/api/admin-iam-api.ts`, `code-usage-api.ts`  
> **분석 기준**: FE에서 실제로 호출하는 API endpoint, query params, request/response 구조

### 1.1. Users API (`/api/admin/users`)

| 화면 Route | HTTP Method | Endpoint | Query Params | Request Body | Response Type | 화면 표시 필드 |
|------------|-------------|----------|--------------|--------------|---------------|----------------|
| `/admin/users` | GET | `/api/admin/users` | `page`, `size`, `keyword`, `departmentId`, `status` | - | `PageResponse<UserSummary>` | `id`, `userName`, `email`, `departmentName`, `departmentId`, `status`, `createdAt`, `lastLoginAt` |
| `/admin/users/:id` | GET | `/api/admin/users/:userId` | - | - | `UserDetail` | `id`, `userName`, `email`, `departmentId`, `departmentName`, `status`, `createdAt`, `lastLoginAt`, `accounts[]` |
| `/admin/users` (추가) | POST | `/api/admin/users` | - | `UserCreatePayload` | `UserDetail` | - |
| `/admin/users/:id` (수정) | PUT | `/api/admin/users/:userId` | - | `UserUpdatePayload` | `UserDetail` | - |
| `/admin/users/:id` (비활성화) | PUT | `/api/admin/users/:userId/disable` | - | `{}` | `{ success: boolean }` | - |
| `/admin/users/:id` (삭제) | POST | `/api/admin/users/:userId/delete` | - | `{}` | `{ success: boolean }` | - |
| `/admin/users/:id` (비밀번호 재설정) | POST | `/api/admin/users/:userId/reset-password` | - | `ResetPasswordPayload?` | `{ temporaryPassword?, success: boolean }` | - |
| `/admin/users/:id/roles` | GET | `/api/admin/users/:userId/roles` | - | - | `RoleSummary[]` | - |
| `/admin/users/:id/roles` (할당) | PUT | `/api/admin/users/:userId/roles` | - | `{ roleIds: string[], replace?: boolean }` | `{ success: boolean }` | - |

**UserSummary 필드**:
- `id: string`
- `userName: string`
- `email?: string | null`
- `departmentName?: string | null`
- `departmentId?: string | null`
- `status: 'ACTIVE' | 'INACTIVE'`
- `createdAt: string` (ISO 8601)
- `lastLoginAt?: string | null` (ISO 8601)

**UserDetail 필드**:
- `id: string`
- `userName: string`
- `email?: string | null`
- `departmentId?: string | null`
- `departmentName?: string | null`
- `status: 'ACTIVE' | 'INACTIVE'`
- `createdAt: string`
- `lastLoginAt?: string | null`
- `accounts?: UserAccount[]`

**UserAccount 필드**:
- `id: string`
- `accountType: 'LOCAL' | 'SSO' | 'LDAP'`
- `principal?: string | null`
- `createdAt: string`
- `lastLoginAt?: string | null`

---

### 1.2. Roles API (`/api/admin/roles`)

| 화면 Route | HTTP Method | Endpoint | Query Params | Request Body | Response Type | 화면 표시 필드 |
|------------|-------------|----------|--------------|--------------|---------------|----------------|
| `/admin/roles` | GET | `/api/admin/roles` | `page`, `size`, `keyword`, `status` | - | `PageResponse<RoleSummary>` | `id`, `roleName`, `roleCode`, `description`, `status`, `createdAt`, `memberCount`, `userCount`, `departmentCount` |
| `/admin/roles/:id` | GET | `/api/admin/roles/:roleId` | - | - | `RoleDetail` | 동일 + `updatedAt` |
| `/admin/roles` (추가) | POST | `/api/admin/roles` | - | `RoleCreatePayload` | `RoleDetail` | - |
| `/admin/roles/:id` (수정) | PUT | `/api/admin/roles/:roleId` | - | `RoleUpdatePayload` | `RoleDetail` | - |
| `/admin/roles/:id` (비활성화) | PUT | `/api/admin/roles/:roleId/disable` | - | `{}` | `{ success: boolean }` | - |
| `/admin/roles/:id` (삭제) | POST | `/api/admin/roles/:roleId/delete` | - | `{}` | `{ success: boolean }` | - |
| `/admin/roles/:id/members` | GET | `/api/admin/roles/:roleId/members` | - | - | `RoleMemberView[]` | `id`, `subjectType`, `subjectName`, `subjectCode`, `subjectEmail`, `departmentName` |
| `/admin/roles/:id/members` (할당) | POST | `/api/admin/roles/:roleId/members` | - | `RoleMemberAssignmentPayload` | `{ success: boolean }` | - |
| `/admin/roles/:id/permissions` | GET | `/api/admin/roles/:roleId/permissions` | - | - | `RolePermissionResponse` | `permissions[]` (resourceKey, permissionCodes[]) |
| `/admin/roles/:id/permissions` (할당) | PUT | `/api/admin/roles/:roleId/permissions` | - | `RolePermissionAssignmentPayload` | `{ success: boolean }` | - |

**RoleSummary 필드**:
- `id: string`
- `roleName: string`
- `roleCode: string`
- `description?: string | null`
- `status: 'ACTIVE' | 'INACTIVE'`
- `createdAt: string`
- `memberCount?: number`
- `userCount?: number`
- `departmentCount?: number`

**RoleDetail 필드**:
- 동일 + `updatedAt?: string | null`

**RoleMemberView 필드**:
- `id: string`
- `subjectType: 'USER' | 'DEPARTMENT'`
- `subjectName: string`
- `subjectCode?: string | null`
- `subjectEmail?: string | null`
- `departmentName?: string | null`

---

### 1.3. Resources API (`/api/admin/resources`)

| 화면 Route | HTTP Method | Endpoint | Query Params | Request Body | Response Type | 화면 표시 필드 |
|------------|-------------|----------|--------------|--------------|---------------|----------------|
| `/admin/resources` | GET | `/api/admin/resources` | `page`, `size`, `keyword`, `resourceType` | - | `PageResponse<ResourceSummary>` | `id`, `resourceKey`, `resourceName`, `resourceType`, `description`, `icon`, `status` |
| `/admin/resources` (트리) | GET | `/api/admin/resources/tree` | - | - | `ResourceNode[]` | 트리 구조 (children 포함) |
| `/admin/resources/:id` | GET | `/api/admin/resources/:resourceId` | - | - | `ResourceSummary` | - |
| `/admin/resources` (추가) | POST | `/api/admin/resources` | - | `ResourceCreatePayload` | `ResourceSummary` | - |
| `/admin/resources/:id` (수정) | POST | `/api/admin/resources/:resourceId` | - | `ResourceUpdatePayload` | `ResourceSummary` | - |
| `/admin/resources/:id` (삭제) | POST | `/api/admin/resources/:resourceId/delete` | - | `{}` | `{ success: boolean }` | - |

**ResourceSummary 필드** (FE 기대):
- `id: string`
- `resourceKey: string`
- `resourceName: string`
- `resourceType: string`
- `description?: string | null`
- `icon?: string | null`
- `status: 'ACTIVE' | 'INACTIVE'`

**ResourceNode 필드** (트리):
- `id: string`
- `resourceKey: string`
- `resourceName: string`
- `resourceType: string`
- `description?: string | null`
- `icon?: string | null`
- `status: 'ACTIVE' | 'INACTIVE'`
- `parentId?: string | null`
- `children?: ResourceNode[]`

---

### 1.4. Menus API (`/api/admin/menus`)

| 화면 Route | HTTP Method | Endpoint | Query Params | Request Body | Response Type | 화면 표시 필드 |
|------------|-------------|----------|--------------|--------------|---------------|----------------|
| `/admin/menus` (트리) | GET | `/api/admin/menus/tree` | - | - | `AdminMenuNode[]` | 트리 구조 (children, sortOrder 포함) |
| `/admin/menus` (추가) | POST | `/api/admin/menus` | - | `MenuCreatePayload` | `AdminMenuNode` | - |
| `/admin/menus/:id` (수정) | PUT | `/api/admin/menus/:menuId` | - | `MenuUpdatePayload` | `AdminMenuNode` | - |
| `/admin/menus/:id` (삭제) | POST | `/api/admin/menus/:menuId/delete` | - | `{}` | `{ success: boolean }` | - |
| `/admin/menus` (정렬) | POST | `/api/admin/menus/reorder` | - | `MenuReorderPayload` | `{ success: boolean }` | - |

**AdminMenuNode 필드** (FE 기대):
- `id: string`
- `menuKey: string`
- `menuName: string`
- `path?: string | null`
- `icon?: string | null`
- `parentId?: string | null`
- `sortOrder?: number | null`
- `enabled: boolean`
- `permissionKey?: string | null`
- `children?: AdminMenuNode[]`

---

### 1.5. Codes API (`/api/admin/codes`)

| 화면 Route | HTTP Method | Endpoint | Query Params | Request Body | Response Type | 화면 표시 필드 |
|------------|-------------|----------|--------------|--------------|---------------|----------------|
| `/admin/codes` (그룹 목록) | GET | `/api/admin/codes/groups` | `keyword?`, `tenantScope?`, `enabled?` | - | `CodeGroup[]` | `id`, `groupKey`, `groupName`, `description`, `tenantScope`, `enabled` |
| `/admin/codes` (전체 코드) | GET | `/api/admin/codes` | `keyword?`, `tenantScope?`, `enabled?` | - | `Code[]` | - |
| `/admin/codes/:groupKey` | GET | `/api/admin/codes/:groupKey` | `keyword?`, `tenantScope?`, `enabled?` | - | `Code[]` | `id`, `groupKey`, `codeKey`, `codeName`, `codeValue`, `description`, `sortOrder`, `enabled`, `createdAt` |
| `/admin/codes/groups` (추가) | POST | `/api/admin/codes/groups` | - | `CodeGroupCreatePayload` | `CodeGroup` | - |
| `/admin/codes/groups/:id` (수정) | POST | `/api/admin/codes/groups/:groupId` | - | `CodeGroupUpdatePayload` | `CodeGroup` | - |
| `/admin/codes/groups/:id` (삭제) | POST | `/api/admin/codes/groups/:groupId/delete` | - | `{}` | `{ success: boolean }` | - |
| `/admin/codes` (추가) | POST | `/api/admin/codes` | - | `CodeCreatePayload` | `Code` | - |
| `/admin/codes/:id` (수정) | POST | `/api/admin/codes/:codeId` | - | `CodeUpdatePayload` | `Code` | - |
| `/admin/codes/:id` (삭제) | POST | `/api/admin/codes/:codeId/delete` | - | `{}` | `{ success: boolean }` | - |

**CodeGroup 필드**:
- `id: string`
- `groupKey: string`
- `groupName: string`
- `description?: string | null`
- `tenantScope: 'COMMON' | 'TENANT' | 'ALL'`
- `enabled: boolean`

**Code 필드**:
- `id: string`
- `groupKey: string`
- `codeKey: string`
- `codeName: string`
- `codeValue?: string | null`
- `description?: string | null`
- `sortOrder?: number | null`
- `enabled: boolean`
- `createdAt: string`

---

### 1.6. Code Usages API (`/api/admin/code-usages`)

| 화면 Route | HTTP Method | Endpoint | Query Params | Request Body | Response Type | 화면 표시 필드 |
|------------|-------------|----------|--------------|--------------|---------------|----------------|
| `/admin/code-usages` | GET | `/api/admin/code-usages` | `page`, `size`, `keyword`, `resourceKey`, `codeGroupKey`, `enabled` | - | `PageResponse<CodeUsageSummary>` | `id`, `resourceKey`, `codeGroupKey`, `enabled` |
| `/admin/code-usages/:id` | GET | `/api/admin/code-usages/:id` | - | - | `CodeUsageDetail` | - |
| `/admin/code-usages` (추가) | POST | `/api/admin/code-usages` | - | `CodeUsageCreatePayload` | `CodeUsageDetail` | - |
| `/admin/code-usages/:id` (수정) | POST | `/api/admin/code-usages/:id` | - | `CodeUsageUpdatePayload` | `CodeUsageDetail` | - |
| `/admin/code-usages/:id` (삭제) | POST | `/api/admin/code-usages/:id/delete` | - | `{}` | `{ success: boolean }` | - |
| `/admin/codes/usage` (리소스별 코드) | GET | `/api/admin/codes/usage` | `resourceKey` | - | `CodeUsageResponse` (맵) | `{ [groupKey]: Code[] }` |

**CodeUsageSummary 필드**:
- `id: string`
- `resourceKey: string`
- `codeGroupKey: string`
- `enabled: boolean`

**CodeUsageDetail 필드**:
- 동일 (추가 필드 없음)

---

### 1.7. Audit Logs API (`/api/admin/audit-logs`)

| 화면 Route | HTTP Method | Endpoint | Query Params | Request Body | Response Type | 화면 표시 필드 |
|------------|-------------|----------|--------------|--------------|---------------|----------------|
| `/admin/audit` | GET | `/api/admin/audit-logs` | `page`, `size`, `from`, `to`, `actor`, `action`, `keyword` | - | `PageResponse<AuditLogSummary>` | `id`, `actorUserId`, `actorName`, `action`, `resourceType`, `resourceId`, `resourceName`, `timestamp`, `details` |
| `/admin/audit/:id` | GET | `/api/admin/audit-logs/:id` | - | - | `AuditLogDetail` | - |
| `/admin/audit` (Excel) | GET | `/api/admin/audit-logs/export` | `from`, `to`, `actor`, `action`, `keyword` | - | `Blob` | - |

**AuditLogSummary 필드**:
- `id: string`
- `actorUserId: string`
- `actorName: string`
- `action: string`
- `resourceType: string`
- `resourceId?: string | null`
- `resourceName?: string | null`
- `timestamp: string`
- `details?: string | null`

**AuditLogDetail 필드**:
- 동일 (추가 필드 없음)

---

## 2. BE 기준 Admin API 실체 인벤토리

> **출처**: `docs/backend-src/dwp-auth-server/src/main/java/com/dwp/services/auth/controller/admin/`  
> **분석 기준**: 실제 Controller에 정의된 `@RequestMapping`, `@GetMapping`, `@PostMapping` 등

### 2.1. Users API (UserController.java)

| HTTP Method | Endpoint | Query Params | Request Body | Response Type | 권한 체크 |
|-------------|----------|--------------|--------------|---------------|-----------|
| GET | `/api/admin/users` | `page`, `size`, `keyword`, `departmentId`, `roleId`, `status`, `idpProviderType`, `loginType` | - | `PageResponse<UserSummary>` | VIEW |
| POST | `/api/admin/users` | - | `CreateUserRequest` | `UserDetail` | EDIT |
| GET | `/api/admin/users/{comUserId}` | - | - | `UserDetail` | VIEW |
| PUT | `/api/admin/users/{comUserId}` | - | `UpdateUserRequest` | `UserDetail` | EDIT |
| PATCH | `/api/admin/users/{comUserId}` | - | `UpdateUserRequest` | `UserDetail` | EDIT |
| PUT | `/api/admin/users/{comUserId}/disable` | - | - | `ApiResponse<Void>` | EDIT |
| POST | `/api/admin/users/{comUserId}/delete` | - | - | `ApiResponse<Void>` | EDIT |
| POST | `/api/admin/users/{comUserId}/reset-password` | - | `ResetPasswordRequest?` | `ApiResponse<ResetPasswordResponse>` | EDIT |
| GET | `/api/admin/users/{comUserId}/roles` | - | - | `ApiResponse<List<RoleSummary>>` | VIEW |
| PUT | `/api/admin/users/{comUserId}/roles` | - | `UpdateUserRolesRequest` | `ApiResponse<Void>` | EDIT |

**차이점**:
- ✅ FE 요구: `roleId` query param 없음 → BE는 지원
- ✅ FE 요구: `idpProviderType`, `loginType` query param 없음 → BE는 지원
- ✅ FE 요구: `disable` → `PUT` (일치)
- ✅ FE 요구: `delete` → `POST` (일치)
- ✅ FE 요구: `reset-password` → `POST` (일치)
- ✅ FE 요구: `roles` GET/PUT → 일치

---

### 2.2. Roles API (RoleController.java)

| HTTP Method | Endpoint | Query Params | Request Body | Response Type | 권한 체크 |
|-------------|----------|--------------|--------------|---------------|-----------|
| GET | `/api/admin/roles` | `page`, `size`, `keyword`, `status` | - | `PageResponse<RoleSummary>` | VIEW |
| GET | `/api/admin/roles/{comRoleId}` | - | - | `RoleDetail` | VIEW |
| POST | `/api/admin/roles` | - | `CreateRoleRequest` | `RoleDetail` | EDIT |
| PUT | `/api/admin/roles/{comRoleId}` | - | `UpdateRoleRequest` | `RoleDetail` | EDIT |
| DELETE | `/api/admin/roles/{comRoleId}` | - | - | `ApiResponse<Void>` | EDIT |
| PUT | `/api/admin/roles/{comRoleId}/disable` | - | - | `ApiResponse<Void>` | EDIT |
| POST | `/api/admin/roles/{comRoleId}/delete` | - | - | `ApiResponse<Void>` | EDIT |
| GET | `/api/admin/roles/{comRoleId}/members` | - | - | `ApiResponse<List<RoleMemberView>>` | VIEW |
| POST | `/api/admin/roles/{comRoleId}/members` | - | `UpdateRoleMembersRequest` | `ApiResponse<Void>` | EDIT |
| GET | `/api/admin/roles/{comRoleId}/permissions` | - | - | `ApiResponse<RolePermissionResponse>` | VIEW |
| PUT | `/api/admin/roles/{comRoleId}/permissions` | - | `UpdateRolePermissionsRequest` | `ApiResponse<Void>` | EDIT |

**차이점**:
- ⚠️ FE 요구: `delete` → `POST` (일치)
- ⚠️ BE 추가: `DELETE` 메서드도 존재 (중복?)
- ✅ FE 요구: `members` GET/POST → 일치
- ✅ FE 요구: `permissions` GET/PUT → 일치

---

### 2.3. Resources API (ResourceController.java)

| HTTP Method | Endpoint | Query Params | Request Body | Response Type | 권한 체크 |
|-------------|----------|--------------|--------------|---------------|-----------|
| GET | `/api/admin/resources/tree` | - | - | `List<ResourceSummary>` | - |
| GET | `/api/admin/resources` | `page`, `size`, `keyword`, `type`, `category`, `kind`, `parentId`, `enabled`, `trackingEnabled` | - | `PageResponse<ResourceSummary>` | - |
| GET | `/api/admin/resources/{comResourceId}` | - | - | `ResourceSummary` | - |
| POST | `/api/admin/resources` | - | `CreateResourceRequest` | `ResourceSummary` | - |
| PUT | `/api/admin/resources/{comResourceId}` | - | `UpdateResourceRequest` | `ResourceSummary` | - |
| DELETE | `/api/admin/resources/{comResourceId}` | - | - | `ApiResponse<Void>` | - |
| POST | `/api/admin/resources/{comResourceId}/delete` | - | - | `ApiResponse<Void>` | - |

**차이점**:
- ⚠️ FE 요구: `resourceType` → BE는 `type` (불일치 가능성)
- ⚠️ FE 요구: `update` → `POST` → BE는 `PUT` (불일치)
- ⚠️ FE 요구: `delete` → `POST` → BE는 `DELETE` + `POST` 둘 다 존재

---

### 2.4. Menus API (AdminMenuController.java)

| HTTP Method | Endpoint | Query Params | Request Body | Response Type | 권한 체크 |
|-------------|----------|--------------|--------------|---------------|-----------|
| GET | `/api/admin/menus` | `page`, `size`, `keyword`, `enabled`, `parentId` | - | `PageResponse<MenuSummary>` | - |
| GET | `/api/admin/menus/tree` | - | - | `List<MenuNode>` | - |
| POST | `/api/admin/menus` | - | `CreateMenuRequest` | `MenuSummary` | - |
| PATCH | `/api/admin/menus/{sysMenuId}` | - | `UpdateMenuRequest` | `MenuSummary` | - |
| DELETE | `/api/admin/menus/{sysMenuId}` | - | - | `ApiResponse<Void>` | - |
| PUT | `/api/admin/menus/reorder` | - | `ReorderMenusRequest` | `ApiResponse<Void>` | - |

**차이점**:
- ⚠️ FE 요구: `update` → `PUT` → BE는 `PATCH` (불일치)
- ⚠️ FE 요구: `delete` → `POST` → BE는 `DELETE` (불일치)
- ✅ FE 요구: `reorder` → `POST` → BE는 `PUT` (불일치)

---

### 2.5. Codes API (CodeController.java)

| HTTP Method | Endpoint | Query Params | Request Body | Response Type | 권한 체크 |
|-------------|----------|--------------|--------------|---------------|-----------|
| GET | `/api/admin/codes/groups` | - | - | `List<CodeGroupResponse>` | - |
| GET | `/api/admin/codes` | `groupKey?`, `tenantScope?`, `enabled?` | - | `List<CodeResponse>` 또는 `Map<String, List<CodeResponse>>` | - |
| GET | `/api/admin/codes/all` | - | - | `Map<String, List<CodeResponse>>` | - |
| GET | `/api/admin/codes/usage` | `resourceKey` | - | `CodeUsageResponse` | - |
| GET | `/api/admin/codes/usage/groups` | `resourceKey` | - | `List<String>` | - |
| POST | `/api/admin/codes/groups` | - | `CreateCodeGroupRequest` | `CodeGroupResponse` | - |
| PUT | `/api/admin/codes/groups/{sysCodeGroupId}` | - | `UpdateCodeGroupRequest` | `CodeGroupResponse` | - |
| DELETE | `/api/admin/codes/groups/{sysCodeGroupId}` | - | - | `ApiResponse<Void>` | - |
| POST | `/api/admin/codes` | - | `CreateCodeRequest` | `CodeResponse` | - |
| PUT | `/api/admin/codes/{sysCodeId}` | - | `UpdateCodeRequest` | `CodeResponse` | - |
| DELETE | `/api/admin/codes/{sysCodeId}` | - | - | `ApiResponse<Void>` | - |

**차이점**:
- ⚠️ FE 요구: `groups` GET에 `keyword`, `tenantScope`, `enabled` query param → BE는 미지원
- ⚠️ FE 요구: `groups/:id` update → `POST` → BE는 `PUT` (불일치)
- ⚠️ FE 요구: `groups/:id` delete → `POST` → BE는 `DELETE` (불일치)
- ⚠️ FE 요구: `codes/:id` update → `POST` → BE는 `PUT` (불일치)
- ⚠️ FE 요구: `codes/:id` delete → `POST` → BE는 `DELETE` (불일치)

---

### 2.6. Code Usages API (CodeUsageController.java)

| HTTP Method | Endpoint | Query Params | Request Body | Response Type | 권한 체크 |
|-------------|----------|--------------|--------------|---------------|-----------|
| GET | `/api/admin/code-usages` | `page`, `size`, `resourceKey`, `keyword`, `enabled` | - | `PageResponse<CodeUsageSummary>` | - |
| GET | `/api/admin/code-usages/{sysCodeUsageId}` | - | - | `CodeUsageSummary` | - |
| POST | `/api/admin/code-usages` | - | `CreateCodeUsageRequest` | `CodeUsageSummary` | - |
| PATCH | `/api/admin/code-usages/{sysCodeUsageId}` | - | `UpdateCodeUsageRequest` | `CodeUsageSummary` | - |
| DELETE | `/api/admin/code-usages/{sysCodeUsageId}` | - | - | `ApiResponse<Void>` | - |

**차이점**:
- ⚠️ FE 요구: `codeGroupKey` query param → BE는 미지원
- ⚠️ FE 요구: `detail` GET → BE는 존재하지만 `CodeUsageSummary` 반환 (Detail 없음)
- ⚠️ FE 요구: `update` → `POST` → BE는 `PATCH` (불일치)
- ⚠️ FE 요구: `delete` → `POST` → BE는 `DELETE` (불일치)

---

### 2.7. Audit Logs API (AdminAuditLogController.java)

| HTTP Method | Endpoint | Query Params | Request Body | Response Type | 권한 체크 |
|-------------|----------|--------------|--------------|---------------|-----------|
| GET | `/api/admin/audit-logs` | `page`, `size`, `from`, `to`, `actorUserId`, `actionType`, `resourceType`, `keyword` | - | `PageResponse<AuditLogItem>` | - |
| POST | `/api/admin/audit-logs/export` | - | `ExportAuditLogsRequest` | `byte[]` (Excel) | - |

**차이점**:
- ⚠️ FE 요구: `actor` query param → BE는 `actorUserId` (불일치)
- ⚠️ FE 요구: `action` query param → BE는 `actionType` (불일치)
- ⚠️ FE 요구: `export` → `GET` → BE는 `POST` (불일치)
- ⚠️ FE 요구: `detail` GET → BE는 미존재

---

## 3. Gap Matrix (요구 vs 존재)

> **표기법**: ✅ 일치, ⚠️ 불일치/부족, ❌ 미존재

| 메뉴 | API | FE 요구 | BE 존재 | Gap 유형 | 우선순위 |
|------|-----|---------|---------|----------|----------|
| **Users** | List | ✅ | ✅ | - | - |
| | Detail | ✅ | ✅ | - | - |
| | Create | ✅ | ✅ | - | - |
| | Update | ✅ | ✅ | - | - |
| | Disable | ✅ | ✅ | - | - |
| | Delete | ✅ | ✅ | - | - |
| | Reset Password | ✅ | ✅ | - | - |
| | Get Roles | ✅ | ✅ | - | - |
| | Update Roles | ✅ | ✅ | - | - |
| **Roles** | List | ✅ | ✅ | - | - |
| | Detail | ✅ | ✅ | - | - |
| | Create | ✅ | ✅ | - | - |
| | Update | ✅ | ✅ | - | - |
| | Disable | ✅ | ✅ | - | - |
| | Delete | ✅ | ✅ | ⚠️ DELETE/POST 중복 | P2 |
| | Get Members | ✅ | ✅ | - | - |
| | Update Members | ✅ | ✅ | - | - |
| | Get Permissions | ✅ | ✅ | - | - |
| | Update Permissions | ✅ | ✅ | - | - |
| **Resources** | List | ✅ | ✅ | ⚠️ `resourceType` vs `type` | P1 |
| | Tree | ✅ | ✅ | - | - |
| | Detail | ✅ | ✅ | - | - |
| | Create | ✅ | ✅ | - | - |
| | Update | ⚠️ POST | ⚠️ PUT | ⚠️ HTTP Method 불일치 | P0 |
| | Delete | ⚠️ POST | ⚠️ DELETE/POST | ⚠️ HTTP Method 불일치 | P0 |
| **Menus** | Tree | ✅ | ✅ | - | - |
| | Create | ✅ | ✅ | - | - |
| | Update | ⚠️ PUT | ⚠️ PATCH | ⚠️ HTTP Method 불일치 | P0 |
| | Delete | ⚠️ POST | ⚠️ DELETE | ⚠️ HTTP Method 불일치 | P0 |
| | Reorder | ⚠️ POST | ⚠️ PUT | ⚠️ HTTP Method 불일치 | P0 |
| **Codes** | Groups List | ⚠️ keyword/tenantScope/enabled | ❌ 미지원 | ⚠️ Query Params 부족 | P1 |
| | Groups Create | ✅ | ✅ | - | - |
| | Groups Update | ⚠️ POST | ⚠️ PUT | ⚠️ HTTP Method 불일치 | P0 |
| | Groups Delete | ⚠️ POST | ⚠️ DELETE | ⚠️ HTTP Method 불일치 | P0 |
| | Codes List | ✅ | ✅ | - | - |
| | Codes Create | ✅ | ✅ | - | - |
| | Codes Update | ⚠️ POST | ⚠️ PUT | ⚠️ HTTP Method 불일치 | P0 |
| | Codes Delete | ⚠️ POST | ⚠️ DELETE | ⚠️ HTTP Method 불일치 | P0 |
| **Code Usages** | List | ⚠️ codeGroupKey | ❌ 미지원 | ⚠️ Query Param 부족 | P1 |
| | Detail | ✅ | ⚠️ Summary만 반환 | ⚠️ Detail DTO 없음 | P1 |
| | Create | ✅ | ✅ | - | - |
| | Update | ⚠️ POST | ⚠️ PATCH | ⚠️ HTTP Method 불일치 | P0 |
| | Delete | ⚠️ POST | ⚠️ DELETE | ⚠️ HTTP Method 불일치 | P0 |
| **Audit Logs** | List | ⚠️ actor/action | ⚠️ actorUserId/actionType | ⚠️ Query Param 이름 불일치 | P0 |
| | Detail | ❌ | ❌ | ❌ 미존재 | P1 |
| | Export | ⚠️ GET | ⚠️ POST | ⚠️ HTTP Method 불일치 | P1 |

---

## 4. 부족한 응답 필드 목록

### 4.1. Users API

| 필드 | 위치 | FE 기대 | BE 제공 | Gap |
|------|------|---------|---------|-----|
| `lastLoginAt` | UserSummary | ✅ | ❓ 확인 필요 | - |

### 4.2. Roles API

| 필드 | 위치 | FE 기대 | BE 제공 | Gap |
|------|------|---------|---------|-----|
| `updatedAt` | RoleDetail | ✅ | ❓ 확인 필요 | - |

### 4.3. Resources API

| 필드 | 위치 | FE 기대 | BE 제공 | Gap |
|------|------|---------|---------|-----|
| `icon` | ResourceSummary | ✅ | ❓ 확인 필요 | - |
| `status` | ResourceSummary | ✅ | ❓ 확인 필요 | - |
| `description` | ResourceSummary | ✅ | ❓ 확인 필요 | - |

### 4.4. Menus API

| 필드 | 위치 | FE 기대 | BE 제공 | Gap |
|------|------|---------|---------|-----|
| `sortOrder` | AdminMenuNode | ✅ | ❓ 확인 필요 | - |
| `permissionKey` | AdminMenuNode | ✅ | ❓ 확인 필요 | - |

### 4.5. Code Usages API

| 필드 | 위치 | FE 기대 | BE 제공 | Gap |
|------|------|---------|---------|-----|
| Detail DTO | CodeUsageDetail | ✅ | ❌ Summary만 반환 | ❌ Detail 없음 |

---

## 5. 미존재 API 목록

| 메뉴 | API | FE 요구 | BE 존재 | 우선순위 |
|------|-----|---------|---------|----------|
| **Audit Logs** | Detail GET | ✅ | ❌ | P1 |

---

## 6. 추가 구현이 필요한 기능

### 6.1. 필터/정렬/검색

| 메뉴 | 기능 | FE 요구 | BE 지원 | Gap | 우선순위 |
|------|------|---------|---------|-----|----------|
| **Codes** | Groups List 필터 | `keyword`, `tenantScope`, `enabled` | ❌ | ⚠️ Query Params 부족 | P1 |
| **Code Usages** | List 필터 | `codeGroupKey` | ❌ | ⚠️ Query Param 부족 | P1 |
| **Resources** | List 필터 | `resourceType` | `type` | ⚠️ 이름 불일치 | P1 |

### 6.2. 트리/콤보용 Endpoint

| 메뉴 | 기능 | FE 요구 | BE 존재 | Gap | 우선순위 |
|------|------|---------|---------|-----|----------|
| - | - | - | - | - | - |

### 6.3. RBAC 처리

| 메뉴 | 기능 | FE 요구 | BE 지원 | Gap | 우선순위 |
|------|------|---------|---------|-----|----------|
| **Resources** | 권한 체크 | - | ❌ | ⚠️ 권한 체크 없음 | P1 |
| **Menus** | 권한 체크 | - | ❌ | ⚠️ 권한 체크 없음 | P1 |
| **Codes** | 권한 체크 | - | ❌ | ⚠️ 권한 체크 없음 | P1 |
| **Code Usages** | 권한 체크 | - | ❌ | ⚠️ 권한 체크 없음 | P1 |
| **Audit Logs** | 권한 체크 | - | ❌ | ⚠️ 권한 체크 없음 | P1 |

---

## 7. 우선순위 및 영향도

### P0 (긴급) - 화면 동작 불가/필수 항목 누락

1. **HTTP Method 불일치** (Resources, Menus, Codes, Code Usages)
   - **영향도**: 높음 (FE 호출 실패)
   - **롤백 전략**: FE 수정 또는 BE 수정 (표준 결정 필요)

2. **Audit Logs Query Param 이름 불일치** (`actor` vs `actorUserId`, `action` vs `actionType`)
   - **영향도**: 높음 (필터 동작 안 함)
   - **롤백 전략**: FE 수정 또는 BE 수정 (표준 결정 필요)

### P1 (높음) - 화면은 되지만 운영상 불편

1. **Codes Groups List 필터 부족** (`keyword`, `tenantScope`, `enabled`)
   - **영향도**: 중간 (검색/필터 불가)
   - **롤백 전략**: 없음 (추가 기능)

2. **Code Usages List 필터 부족** (`codeGroupKey`)
   - **영향도**: 중간 (검색/필터 불가)
   - **롤백 전략**: 없음 (추가 기능)

3. **Code Usages Detail DTO 없음**
   - **영향도**: 중간 (상세 화면 불가)
   - **롤백 전략**: 없음 (추가 기능)

4. **Audit Logs Detail API 없음**
   - **영향도**: 중간 (상세 화면 불가)
   - **롤백 전략**: 없음 (추가 기능)

5. **RBAC 권한 체크 누락** (Resources, Menus, Codes, Code Usages, Audit Logs)
   - **영향도**: 높음 (보안 이슈)
   - **롤백 전략**: 없음 (필수 기능)

6. **Audit Logs Export HTTP Method 불일치** (GET vs POST)
   - **영향도**: 중간 (다운로드 실패)
   - **롤백 전략**: FE 수정 또는 BE 수정

### P2 (중간) - 최적화/추후 개선

1. **Roles Delete 중복** (DELETE + POST)
   - **영향도**: 낮음 (기능 동작함)
   - **롤백 전략**: 없음 (정리 작업)

---

## 8. 해결 방식 및 롤백 전략

### 8.1. HTTP Method 불일치 해결

**옵션 A: BE 수정 (권장)**
- REST 표준 준수 (PUT/PATCH/DELETE)
- FE는 이미 POST 사용 중 → FE 수정 필요

**옵션 B: FE 수정**
- BE 표준 유지
- FE 코드 수정 필요

**결정 필요**: Tech Lead와 논의

### 8.2. Query Param 이름 불일치 해결

**옵션 A: BE 수정 (권장)**
- FE 기대 이름으로 통일 (`actor`, `action`)
- 기존 API 호환성 고려 (deprecated 처리)

**옵션 B: FE 수정**
- BE 표준 유지 (`actorUserId`, `actionType`)
- FE 코드 수정 필요

**결정 필요**: Tech Lead와 논의

### 8.3. 필터/정렬 추가

**해결 방식**: BE에 Query Params 추가 (additive)
- Breaking Change 없음
- 롤백 전략: Query Param 제거만 하면 됨

### 8.4. RBAC 권한 체크 추가

**해결 방식**: BE에 `PermissionEvaluator` 적용
- Breaking Change 없음 (권한 없으면 403)
- 롤백 전략: 권한 체크 주석 처리

---

## 9. 체크리스트 (DoD)

### 9.1. 기능 완료 기준

- [ ] Admin(모니터링 제외) 모든 메뉴에서 조회/등록/수정/삭제가 API 레벨에서 막히지 않음
- [ ] 화면에서 보여야 하는 항목이 응답 DTO에 모두 존재
- [ ] 필터/정렬/페이지네이션이 운영 가능 수준으로 제공
- [ ] RBAC 권한/에러 계약이 FE 처리 가능 수준으로 정합
- [ ] 최소 스모크 테스트가 존재
- [ ] 문서화 완료 + README 인덱싱 완료
- [ ] 빌드/테스트 통과

### 9.2. 문서화 완료 기준

- [ ] OpenAPI/Swagger 최신 반영
- [ ] `ADMIN_API_GAP_ANALYSIS.md` 최종 업데이트
- [ ] `docs/README.md` 링크 추가
- [ ] 백엔드 팀 요청 명세서 작성 완료

---

## 10. 결과 보고서

### 10.1. 해결된 Gap 목록

#### P0 (긴급) - HTTP Method 불일치
- **상태**: ⏳ 대기 (FE 수정 필요)
- **해결 방식**: BE 표준 유지, FE 코드 수정
- **영향도**: 높음 (화면 동작 불가)

#### P0 (긴급) - Query Param 이름 불일치
- **상태**: ⏳ 대기 (BE 수정 필요)
- **해결 방식**: BE 수정 (actor, action으로 통일)
- **영향도**: 높음 (필터 동작 안 함)

#### P1 (높음) - 필터/정렬 기능 추가
- **상태**: ⏳ 대기
- **해결 방식**: BE에 Query Params 추가
- **영향도**: 중간 (운영 불편)

#### P1 (높음) - Detail API 추가
- **상태**: ⏳ 대기
- **해결 방식**: BE에 Detail API 추가
- **영향도**: 중간 (상세 화면 불가)

#### P1 (높음) - RBAC 권한 체크 추가
- **상태**: ⏳ 대기
- **해결 방식**: BE에 PermissionEvaluator 적용
- **영향도**: 높음 (보안 이슈)

#### P1 (높음) - 응답 필드 보완
- **상태**: ⏳ 대기 (DTO 확인 필요)
- **해결 방식**: BE DTO 필드 추가
- **영향도**: 중간 (화면 표시 불가)

#### P2 (중간) - 코드 정리
- **상태**: ⏳ 대기
- **해결 방식**: 중복 엔드포인트 제거
- **영향도**: 낮음 (기능 동작함)

---

### 10.2. 추가된/변경된 API 목록

**변경 예정 API** (백엔드 팀 요청):
- `GET /api/admin/audit-logs` (Query Param 이름 변경)
- `GET /api/admin/codes/groups` (필터 추가)
- `GET /api/admin/code-usages` (필터 추가)
- `GET /api/admin/audit-logs/:id` (신규)
- `GET /api/admin/code-usages/:id` (Detail DTO 추가)

**FE 수정 필요 API** (HTTP Method 변경):
- `PUT /api/admin/resources/:id` (POST → PUT)
- `DELETE /api/admin/resources/:id` (POST → DELETE)
- `PATCH /api/admin/menus/:id` (PUT → PATCH)
- `DELETE /api/admin/menus/:id` (POST → DELETE)
- `PUT /api/admin/menus/reorder` (POST → PUT)
- `PUT /api/admin/codes/groups/:id` (POST → PUT)
- `DELETE /api/admin/codes/groups/:id` (POST → DELETE)
- `PUT /api/admin/codes/:id` (POST → PUT)
- `DELETE /api/admin/codes/:id` (POST → DELETE)
- `PATCH /api/admin/code-usages/:id` (POST → PATCH)
- `DELETE /api/admin/code-usages/:id` (POST → DELETE)

---

### 10.3. FE 영향도: 없음 (원칙대로)

**원칙**: FE 화면/UX 변경 금지, FE 코드는 수정하지 않음

**예외**: HTTP Method 불일치로 인한 FE 코드 수정 필요 (11개 API)

**이유**: BE REST 표준 준수를 위해 FE 수정이 불가피함

---

### 10.4. 남은 백로그

**문서**: `docs/specs/admin/ADMIN_REMAINING_WORK.md` 참고

**주요 항목**:
- 데이터 시딩/샘플 계정/권한 세트
- 운영 로그/감사로그 적재 정책
- 대량 데이터 성능(인덱스/쿼리)
- 배치/스케줄러 필요 여부
- 캐시 전략(Redis)
- 장애 대응(타임아웃/서킷브레이커)
- FE E2E와 BE 통합 테스트 전략
- CI/CD Merge blocking 전략
- 운영 배포 체크리스트

---

### 10.5. 다음 단계

1. **백엔드 팀 요청 명세서 전달**
   - `docs/api-spec/FRONTEND_API_REQUEST_ADMIN_API_COMPLETION.md`
   - 우선순위 확정 및 일정 조율

2. **FE 코드 수정** (HTTP Method 불일치)
   - `libs/shared-utils/src/api/admin-iam-api.ts`
   - `libs/shared-utils/src/api/code-usage-api.ts`

3. **백엔드 팀 작업 진행**
   - P0 항목 우선 처리
   - P1 항목 순차 처리

4. **통합 테스트**
   - FE E2E 테스트 실행
   - 전체 플로우 검증

---

**최종 업데이트**: 2026-01-22  
**작성자**: Frontend Team  
**상태**: 분석 완료, 백엔드 팀 요청 대기

---

**다음 단계**: C02 - BE 기준 "Admin API 실체 인벤토리" 수집 (이미 완료) → C03 - Gap Matrix 완성 (이미 완료) → C04~C13 백엔드 팀 요청 명세서 작성
