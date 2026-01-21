# FE P1-4: CodeUsage 관리 UI 구현

**작성일**: 2026-01-20  
**상태**: ✅ 완료  
**목적**: CodeUsage 관리 UI 구현 및 코드 사용 정책 적용

---

## 개요

메뉴별 코드 사용 계약(Usage) 기반 조회 시스템을 구현하고, CodeUsage 관리 UI를 추가했습니다.

---

## 구현 내용

### 1. CodeUsage API Layer

**파일**: `libs/shared-utils/src/api/code-usage-api.ts`

#### 구현된 API 함수:
- `getCodesByResourceKey(resourceKey)`: resourceKey 기준 코드 조회
  - 엔드포인트: `GET /api/admin/codes/usage?resourceKey={resourceKey}`
  - 응답: `CodeUsageResponse` (코드 그룹별 코드 목록)
  
- `getCodeUsages(params)`: CodeUsage 목록 조회
  - 엔드포인트: `GET /api/admin/codes/usage`
  - 파라미터: `page`, `size`, `resourceKey`, `codeGroupKey`
  - 응답: `PageResponse<CodeUsage>`

- `createCodeUsage(payload)`: CodeUsage 생성
  - 엔드포인트: `POST /api/admin/codes/usage`
  - Payload: `{ resourceKey, codeGroupKey, codeKeys: string[] }`

- `updateCodeUsage(id, payload)`: CodeUsage 수정
  - 엔드포인트: `PUT /api/admin/codes/usage/{id}`
  - Payload: `{ codeKeys: string[] }`

- `deleteCodeUsage(id)`: CodeUsage 삭제
  - 엔드포인트: `DELETE /api/admin/codes/usage/{id}`

### 2. Query Layer

**파일**: `libs/shared-utils/src/queries/use-code-usages-query.ts`

#### 구현된 Query Hooks:
- `useCodesByResourceQuery(resourceKey)`: resourceKey 기준 코드 조회 훅
  - Query Key: `['admin', 'codes', 'usage', tenantId, resourceKey]`
  - Enabled: `isAuthenticated && Boolean(tenantId) && Boolean(resourceKey)`
  
- `useCodeUsagesQuery(params)`: CodeUsage 목록 조회 훅
  - Query Key: `['admin', 'code-usages', tenantId, page, size, resourceKey, codeGroupKey]`
  - Enabled: `isAuthenticated && Boolean(tenantId)`

- `useCreateCodeUsageMutation()`: CodeUsage 생성 mutation
- `useUpdateCodeUsageMutation()`: CodeUsage 수정 mutation
- `useDeleteCodeUsageMutation()`: CodeUsage 삭제 mutation

### 3. Code Utils

**파일**: `libs/shared-utils/src/admin/code-utils.ts`

#### 구현된 유틸 함수:
- `toSelectOptions(codes)`: 코드 배열을 SelectOption으로 변환
  - `{ value: code.codeKey, label: code.codeName }` 형식
  
- `getCodesByGroupFromMap(codeMap, groupKey)`: 그룹별 코드 추출
  - `codeMap`에서 `groupKey`에 해당하는 코드 배열 반환
  
- `getSelectOptionsByGroup(codeMap, groupKey)`: 그룹별 SelectOption 추출
  - `getCodesByGroupFromMap()` + `toSelectOptions()` 조합

### 4. CodeUsage 관리 UI

**파일**: `apps/remotes/admin/src/pages/code-usages.tsx`

#### 구현된 기능:
- **목록 화면**:
  - CodeUsage 목록 표시 (테이블)
  - 컬럼: resourceKey, codeGroupKey, codeKeys (쉼표 구분), actions
  - 검색: resourceKey, codeGroupKey
  - 페이징: 10/30/50
  - 로딩 상태: Skeleton
  - 빈 상태: "데이터가 없습니다"
  - 에러 상태: Alert

- **생성/수정 다이얼로그**:
  - resourceKey 입력 (TextField)
  - codeGroupKey 선택 (Select, CodeUsage 기반)
  - codeKeys 다중 선택 (Autocomplete, CodeUsage 기반)
  - 검증: resourceKey, codeGroupKey 필수
  - 저장 시 mutation 호출 및 query invalidation

- **삭제 확인 다이얼로그**:
  - 삭제 확인 메시지
  - 삭제 시 mutation 호출 및 query invalidation

### 5. 코드 사용 정책 적용

#### 화면별 적용:
- **Users**: `menu.admin.users` → `USER_STATUS`, `SUBJECT_TYPE`
- **Roles**: `menu.admin.roles` → `PERMISSION_CODE`
- **Resources**: `menu.admin.resources` → `RESOURCE_TYPE`
- **Monitoring Events**: `menu.admin.monitoring` → `UI_ACTION` (우선), `EVENT_TYPE` (fallback)
- **Codes**: 예외 (전체 코드 그룹 조회 필요)

#### Fallback 정책:
- Usage 매핑 없으면 dropdown disabled + "코드 매핑 필요" helperText
- CodeUsage 관리 UI에서 매핑 추가 가능

---

## 주요 해결 사항

### 1. 하드코딩된 옵션 제거
- 모든 selectbox 옵션을 CodeUsage API 기반으로 변경
- `useCodesByResourceQuery(resourceKey)` 사용
- 코드 그룹별 필터링 (`getCodesByGroupFromMap()`)

### 2. 코드 매핑 없을 때 UX
- selectbox 비활성화
- "코드 매핑 필요" helperText 표시
- CodeUsage 관리 UI로 이동 안내 (향후 추가 가능)

### 3. CodeUsage 관리 UI 예외 처리
- Codes 화면은 전체 코드 그룹 조회 필요
- `/api/admin/codes/all` 사용 (CodeUsage API 아님)

---

## 변경된 파일 목록

### 신규 파일
- `libs/shared-utils/src/api/code-usage-api.ts`
- `libs/shared-utils/src/queries/use-code-usages-query.ts`
- `libs/shared-utils/src/admin/code-utils.ts`
- `apps/remotes/admin/src/pages/code-usages.tsx`
- `libs/shared-utils/src/admin/__tests__/code-utils.test.ts`

### 수정된 파일
- `libs/shared-utils/src/index.ts`: code-usage-api, code-utils export 추가
- `apps/remotes/admin/src/admin-app.tsx`: CodeUsagesPage 라우트 추가
- `apps/remotes/admin/src/pages/monitoring-tabs.tsx`: eventType 필터를 CodeUsage 기반으로 변경
- `apps/remotes/admin/src/pages/users.tsx`: status selectbox를 CodeUsage 기반으로 변경
- `apps/remotes/admin/src/pages/roles.tsx`: status selectbox를 CodeUsage 기반으로 변경

---

## 테스트 시나리오

1. **CodeUsage 목록 조회**:
   - `/admin/code-usages` 접근
   - 목록 로드 확인

2. **CodeUsage 생성**:
   - "추가" 버튼 클릭
   - resourceKey, codeGroupKey, codeKeys 입력
   - 저장 후 목록에 추가 확인

3. **CodeUsage 수정**:
   - 목록에서 수정 버튼 클릭
   - codeKeys 수정
   - 저장 후 변경사항 반영 확인

4. **CodeUsage 삭제**:
   - 목록에서 삭제 버튼 클릭
   - 확인 다이얼로그에서 확인
   - 삭제 후 목록에서 제거 확인

5. **코드 사용 정책 적용**:
   - Users 화면에서 status selectbox 확인 (CodeUsage 기반)
   - Roles 화면에서 status selectbox 확인 (CodeUsage 기반)
   - Monitoring Events 탭에서 eventType 필터 확인 (CodeUsage 기반)

---

## 다음 단계 (P1-5)

- Admin CRUD UI 완성 (Users/Roles/Resources)
- RBAC UX 강화
- Permission Matrix UX 구현
