# Admin Remote 구현 완료 요약

## 1. 구현된 기능

### 1.1. Admin Remote 앱 생성
- **위치**: `apps/remotes/admin`
- **포트**: 4204
- **구조**: Mail Remote와 동일한 구조로 생성
- **독립 실행**: `npm run dev:admin` (포트 4204)
- **Host 통합**: Host의 `/admin/*` 경로로 접근 가능

### 1.2. 권한 기반 UI 제어 시스템
- **권한 스토어**: `libs/shared-utils/src/auth/permissions-store.ts`
  - Zustand 기반 전역 권한 상태 관리
  - `resourceKey` → `Set<permissionCode>` Map 형태로 캐싱
  - `isLoaded` 플래그로 로딩 상태 관리
- **권한 훅**: `libs/shared-utils/src/auth/use-permissions.ts`
  - `hasPermission(resourceKey, permissionCode?)`: 권한 체크
  - `canViewMenu(resourceKey)`: 메뉴 표시 권한 체크 (기본 VIEW)
  - `canUseButton(resourceKey)`: 버튼 사용 권한 체크 (기본 USE)
- **PermissionGate 컴포넌트**: `libs/design-system/src/components/permission-gate/`
  - 권한이 없으면 children을 숨기거나 비활성화
  - `mode`: 'hide' (기본) 또는 'disable'
- **PermissionRouteGuard**: `libs/shared-utils/src/auth/permission-route-guard.tsx`
  - 권한 기반 라우트 보호
  - 권한이 없으면 `redirectTo`로 리다이렉트

### 1.3. 로그인 후 권한 로드
- **연결 위치**: `libs/shared-utils/src/auth/auth-provider.tsx`
- **로드 시점**: 로그인 성공 후 자동으로 `/api/auth/me`와 `/api/auth/permissions` 호출
- **저장 위치**: `usePermissionsStore`에 저장
- **로그아웃 시**: 권한 정보 자동 삭제

### 1.4. Host 메뉴에 Admin 추가
- **위치**: `apps/dwp/src/layouts/nav-config-dashboard.tsx`
- **권한 체크**: `resourceKey: 'menu.admin'` 기반 필터링
- **훅**: `useNavData()` - 권한 기반으로 필터링된 메뉴 반환
- **메뉴 그룹**: 'Management'
- **아이콘**: `solar:settings-bold-duotone`

### 1.5. Admin Remote 라우팅
- **Host 라우트**: `/admin/*` (권한 체크 포함)
- **Admin Remote 내부 라우트**:
  - `/admin/monitoring` - 통합 모니터링 대시보드
  - `/admin/users` - 사용자 관리
  - `/admin/roles` - 권한 그룹 관리
  - `/admin/resources` - 리소스 관리
  - `/admin/codes` - 코드 관리 (코드 그룹/코드 CRUD)
  - `/admin/code-usages` - 코드 사용 매핑 관리 (메뉴별 코드 그룹 매핑)
  - `/admin/audit` - 감사 로그

### 1.6. Monitoring Dashboard UI 구현 (FE P1-1, P1-2 완료)
- **필터 바**: 기간 프리셋, 날짜 범위, 검색 필드 (route, menu, path, userId, apiName, apiUrl, statusCode)
- **KPI 카드**: PV, UV, Events, API Error Rate (실데이터 연동 완료)
  - Summary API (`/api/admin/monitoring/summary`) 연동
  - 로딩/에러 상태 처리 (Skeleton, Alert)
- **차트**: 
  - 시간대별 PV/UV (라인 차트) - Timeseries API 연동 완료
  - 시간대별 API Total / API Error (라인 차트) - Timeseries API 연동 완료
  - ApexCharts 사용 (`@dwp-frontend/design-system`의 Chart 컴포넌트)
  - Interval 토글 (DAY/HOUR) 지원
  - from/to 필터 변경 시 자동 refetch
- **상세 리스트 탭**:
  - **페이지뷰** (실데이터 연동 완료)
    - `/api/admin/monitoring/page-views` 연동
    - 페이징, 필터링 지원
  - **방문자뷰** (실데이터 연동 완료)
    - `/api/admin/monitoring/visitors` 연동
    - keyword 검색 지원 (visitorId/path)
    - 컬럼: visitorId, userId, firstSeenAt, lastSeenAt, pageViewCount, eventCount, lastPath, lastDevice
  - **이벤트** (실데이터 연동 완료)
    - `/api/admin/monitoring/events` 연동
    - keyword, eventType, resourceKey 필터 지원
    - metadata expand/collapse 기능
    - 컬럼: occurredAt, eventType, resourceKey, action, label, visitorId, userId, path
  - **API 히스토리** (실데이터 연동 완료)
    - `/api/admin/monitoring/api-histories` 연동
    - 페이징, 필터링 지원
  - 페이지네이션 (10/30/50)
  - Excel 다운로드 버튼 (TODO)
  - Row 클릭 시 상세 정보 표시 (TODO)

### 1.7. 기타 Admin 페이지 스켈레톤
- **Users Page**: 사용자 관리 화면 스켈레톤
- **Roles Page**: 권한 그룹 관리 화면 스켈레톤
- **Resources Page**: 리소스 관리 화면 스켈레톤
- **Audit Page**: 감사 로그 화면 스켈레톤

### 1.8. Monitoring API 연동 (FE P1-1, P1-2)
- **API Layer**: `libs/shared-utils/src/api/monitoring-api.ts`
  - `getMonitoringSummary`: KPI 데이터 조회
  - `getMonitoringPageViews`: 페이지뷰 목록 조회
  - `getMonitoringApiHistories`: API 히스토리 목록 조회
  - `getMonitoringVisitors`: 방문자 목록 조회 (P1-2)
  - `getMonitoringEvents`: 이벤트 목록 조회 (P1-2)
  - `getMonitoringTimeseries`: 시계열 데이터 조회 (P1-2)
  - `postPageView`: 페이지뷰 수집 (인증 불필요)
  - `postEvent`: 이벤트 수집 (인증 불필요)
- **Query Layer**: `libs/shared-utils/src/queries/`
  - `use-monitoring-summary-query.ts`: Summary 쿼리 훅
  - `use-monitoring-pageviews-query.ts`: PageViews 쿼리 훅
  - `use-monitoring-apihistories-query.ts`: ApiHistories 쿼리 훅

### 1.9. 코드 사용 정책 (FE P1-3.1)
- **메뉴별 코드 사용 계약(Usage) 기반 조회**
  - API: `libs/shared-utils/src/api/code-usage-api.ts`
    - `getCodesByResourceKey(resourceKey)`: resourceKey 기준 코드 조회
  - Query: `libs/shared-utils/src/queries/use-codes-by-resource-query.ts`
    - `useCodesByResourceQuery(resourceKey)`: 코드 조회 훅
  - 유틸: `libs/shared-utils/src/admin/code-utils.ts`
    - `toSelectOptions(codes)`: 코드 배열을 SelectOption으로 변환
    - `getCodesByGroup(codeMap, groupKey)`: 그룹별 코드 추출
    - `getSelectOptionsByGroup(codeMap, groupKey)`: 그룹별 SelectOption 추출
- **화면별 적용**:
  - Users: `menu.admin.users` → `USER_STATUS`, `SUBJECT_TYPE`
  - Roles: `menu.admin.roles` → `PERMISSION_CODE`
  - Resources: `menu.admin.resources` → `RESOURCE_TYPE`
  - Codes: 예외 (전체 코드 그룹 조회 필요)
- **Fallback 정책**: Usage 매핑 없으면 dropdown disabled + "코드 매핑 필요" 메시지
  - `use-monitoring-visitors-query.ts`: Visitors 쿼리 훅 (P1-2)
  - `use-monitoring-events-query.ts`: Events 쿼리 훅 (P1-2)
  - `use-monitoring-timeseries-query.ts`: Timeseries 쿼리 훅 (P1-2)
- **필터/상태 관리**:
  - from/to는 Monitoring 페이지 최상단에서 single source of truth로 관리
  - 탭별 keyword 필터 독립 관리 (Visitors, Events)
  - 탭별 페이지 상태 독립 관리
  - 필터 변경 시 queryKey dependencies로 자동 refetch

### 1.9. PV/Event 수집 (FE P1-1)
- **페이지뷰 수집**: `apps/dwp/src/hooks/use-page-view-tracking.ts`
  - route 변경 시 자동 `postPageView` 호출
  - debounce 500ms 적용
  - silent fail 처리 (실패해도 앱에 영향 없음)
- **이벤트 수집**: 샘플 구현
  - Admin Users 조회: `apps/remotes/admin/src/pages/users.tsx`
  - AI Workspace 실행: `apps/dwp/src/pages/ai-workspace.tsx`

## 2. 생성/수정된 파일 목록

### 2.1. Admin Remote
- `apps/remotes/admin/project.json` (신규)
- `apps/remotes/admin/vite.config.ts` (신규)
- `apps/remotes/admin/index.html` (신규)
- `apps/remotes/admin/src/main.tsx` (신규)
- `apps/remotes/admin/src/admin-app.tsx` (신규)
- `apps/remotes/admin/src/pages/monitoring.tsx` (신규)
- `apps/remotes/admin/src/pages/monitoring-filter-bar.tsx` (신규)
- `apps/remotes/admin/src/pages/monitoring-kpi-cards.tsx` (신규)
- `apps/remotes/admin/src/pages/monitoring-charts.tsx` (신규)
- `apps/remotes/admin/src/pages/monitoring-tabs.tsx` (신규)
- `apps/remotes/admin/src/pages/users.tsx` (신규)
- `apps/remotes/admin/src/pages/roles.tsx` (신규)
- `apps/remotes/admin/src/pages/resources.tsx` (신규)
- `apps/remotes/admin/src/pages/audit.tsx` (신규)

### 2.2. 권한 시스템
- `libs/shared-utils/src/auth/permissions-store.ts` (신규)
- `libs/shared-utils/src/auth/use-permissions.ts` (신규)
- `libs/shared-utils/src/auth/permission-route-guard.tsx` (신규)
- `libs/shared-utils/src/api/auth-api.ts` (수정: `getMe`, `getPermissions` 추가, `PermissionDTO` 타입 추가)
- `libs/shared-utils/src/auth/auth-provider.tsx` (수정: 로그인 후 권한 로드 로직 추가)
- `libs/shared-utils/src/index.ts` (수정: export 추가)
- `libs/design-system/src/components/permission-gate/permission-gate.tsx` (신규)
- `libs/design-system/src/components/permission-gate/index.ts` (신규)
- `libs/design-system/src/components/index.ts` (수정: export 추가)

### 2.3. Monitoring API/Query (FE P1-1, P1-2)
- `libs/shared-utils/src/api/monitoring-api.ts` (신규)
- `libs/shared-utils/src/queries/use-monitoring-summary-query.ts` (신규)
- `libs/shared-utils/src/queries/use-monitoring-pageviews-query.ts` (신규)
- `libs/shared-utils/src/queries/use-monitoring-apihistories-query.ts` (신규)
- `libs/shared-utils/src/queries/use-monitoring-visitors-query.ts` (신규, P1-2)
- `libs/shared-utils/src/queries/use-monitoring-events-query.ts` (신규, P1-2)
- `libs/shared-utils/src/queries/use-monitoring-timeseries-query.ts` (신규, P1-2)
- `libs/shared-utils/src/queries/__tests__/monitoring-utils.test.ts` (신규, P1-2)
- `libs/shared-utils/src/index.ts` (수정: export 추가)

### 2.4. Monitoring UI 연동 (FE P1-1, P1-2)
- `apps/remotes/admin/src/pages/monitoring-kpi-cards.tsx` (수정: 실데이터 연동)
- `apps/remotes/admin/src/pages/monitoring-tabs.tsx` (수정: Visitors/Events 실데이터 연동)
- `apps/remotes/admin/src/pages/monitoring-charts.tsx` (수정: Timeseries 실데이터 연동)
- `apps/remotes/admin/src/pages/monitoring.tsx` (수정: 필터 전달)

### 2.5. PV/Event 수집 (FE P1-1)
- `apps/dwp/src/hooks/use-page-view-tracking.ts` (신규)
- `apps/dwp/src/app.tsx` (수정: usePageViewTracking 적용)
- `apps/remotes/admin/src/pages/users.tsx` (수정: 이벤트 수집 추가)
- `apps/dwp/src/pages/ai-workspace.tsx` (수정: 이벤트 수집 추가)

### 2.6. Host 통합
- `apps/dwp/src/pages/admin.tsx` (신규)
- `apps/dwp/src/components/admin-module.tsx` (신규)
- `apps/dwp/src/layouts/nav-config-dashboard.tsx` (수정: Admin 메뉴 추가, 권한 기반 필터링)
- `apps/dwp/src/layouts/dashboard/layout.tsx` (수정: `useNavData` 사용)
- `apps/dwp/src/routes/sections.tsx` (수정: `/admin/*` 라우트 추가)

### 2.4. 기타
- `package.json` (수정: `dev:admin`, `build:admin` 스크립트 추가)

## 3. 권한 체크 적용 위치

### 3.1. 메뉴
- **위치**: `apps/dwp/src/layouts/nav-config-dashboard.tsx`
- **방법**: `useNavData()` 훅에서 `canViewMenu('menu.admin')` 체크
- **결과**: 권한이 없으면 Admin 메뉴가 사이드바에 표시되지 않음

### 3.2. 라우트
- **위치**: `apps/dwp/src/pages/admin.tsx`
- **방법**: `PermissionRouteGuard` 컴포넌트로 래핑
- **결과**: 권한이 없으면 `/403` 또는 지정된 경로로 리다이렉트

### 3.3. 버튼 (향후 사용 예시)
```tsx
import { PermissionGate } from '@dwp-frontend/design-system';

<PermissionGate resource="btn.admin.delete" permission="DELETE">
  <Button>삭제</Button>
</PermissionGate>
```

## 4. 향후 BE API 연동 TODO

### 4.1. Monitoring Dashboard
- [ ] `GET /api/admin/monitoring/kpi` - KPI 데이터 조회
- [ ] `GET /api/admin/monitoring/charts/pv-uv` - PV/UV 차트 데이터
- [ ] `GET /api/admin/monitoring/charts/api` - API 차트 데이터
- [ ] `GET /api/admin/monitoring/page-views` - 페이지뷰 목록 (페이지네이션)
- [ ] `GET /api/admin/monitoring/visitors` - 방문자 목록 (페이지네이션)
- [ ] `GET /api/admin/monitoring/events` - 이벤트 목록 (페이지네이션)
- [ ] `GET /api/admin/monitoring/api-history` - API 히스토리 목록 (페이지네이션)
- [ ] `GET /api/admin/monitoring/export` - Excel 다운로드

### 4.2. Users Management
- [ ] `GET /api/admin/users` - 사용자 목록 조회
- [ ] `GET /api/admin/users/:id` - 사용자 상세 조회
- [ ] `POST /api/admin/users` - 사용자 생성
- [ ] `PUT /api/admin/users/:id` - 사용자 수정
- [ ] `DELETE /api/admin/users/:id` - 사용자 삭제

### 4.3. Roles Management
- [ ] `GET /api/admin/roles` - 권한 그룹 목록 조회
- [ ] `GET /api/admin/roles/:id` - 권한 그룹 상세 조회
- [ ] `POST /api/admin/roles` - 권한 그룹 생성
- [ ] `PUT /api/admin/roles/:id` - 권한 그룹 수정
- [ ] `DELETE /api/admin/roles/:id` - 권한 그룹 삭제

### 4.4. Resources Management
- [ ] `GET /api/admin/resources` - 리소스 목록 조회
- [ ] `GET /api/admin/resources/:id` - 리소스 상세 조회
- [ ] `POST /api/admin/resources` - 리소스 생성
- [ ] `PUT /api/admin/resources/:id` - 리소스 수정
- [ ] `DELETE /api/admin/resources/:id` - 리소스 삭제

### 4.5. Audit Log
- [ ] `GET /api/admin/audit` - 감사 로그 목록 조회 (페이지네이션, 필터링)
- [ ] `GET /api/admin/audit/:id` - 감사 로그 상세 조회

## 5. 실행 방법

### 5.1. Admin Remote 독립 실행
```bash
npm run dev:admin
```
- 포트: 4204
- URL: http://localhost:4204

### 5.2. Host에서 Admin 접근
```bash
npm run dev
```
- URL: http://localhost:4200/admin
- 권한 체크: `menu.admin` VIEW 권한 필요

### 5.3. 모든 앱 동시 실행
```bash
npm run dev:all
```
- Host (4200), Mail (4201), Admin (4204) 동시 실행

## 6. 타입 안정성

- ✅ `any` 타입 사용 없음
- ✅ 모든 타입이 명시적으로 정의됨
- ✅ `PermissionDTO`, `UserInfo` 등 API 응답 타입 정의

## 7. 기존 기능 영향

- ✅ 기존 기능 깨짐 없음
- ✅ Mail Remote, Chat, Approval 등 기존 기능 정상 동작
- ✅ 권한 시스템은 선택적 적용 (resourceKey가 있는 항목만 체크)

## 8. 참고 사항

### 8.1. 권한 체크 로직
- `effect: 'ALLOW'`인 권한만 인정 (DENY는 추후 처리 예정)
- 권한이 로드되지 않았으면 (`isLoaded: false`) 메뉴는 표시되지 않음

### 8.2. Admin Remote 라우팅
- 독립 실행 시: `BrowserRouter` 사용
- Host에서 사용 시: Host의 라우터 사용 (BrowserRouter 없이 Routes만 사용)

### 8.3. Monitoring Dashboard (FE P1-1, P1-2 완료)
- ✅ 실데이터 연동 완료 (Summary, PageViews, ApiHistories, Visitors, Events, Timeseries)
- ✅ `TanStack Query` 사용
- ✅ 필터 상태는 queryKey dependencies로 자동 refetch
- ✅ from/to는 single source of truth로 관리

### 8.4. Monitoring API 테스트 가이드

#### Summary API
```bash
curl -X GET "http://localhost:8080/api/admin/monitoring/summary?from=2024-01-01T00:00:00Z&to=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"
```

#### Visitors API
```bash
curl -X GET "http://localhost:8080/api/admin/monitoring/visitors?page=1&size=10&from=2024-01-01T00:00:00Z&to=2024-01-31T23:59:59Z&keyword=visitor-123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"
```

#### Events API
```bash
curl -X GET "http://localhost:8080/api/admin/monitoring/events?page=1&size=10&from=2024-01-01T00:00:00Z&to=2024-01-31T23:59:59Z&eventType=view&resourceKey=menu.admin.users" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"
```

#### Timeseries API
```bash
curl -X GET "http://localhost:8080/api/admin/monitoring/timeseries?from=2024-01-01T00:00:00Z&to=2024-01-31T23:59:59Z&interval=DAY&metric=PV" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"
```

### 8.5. 수동 검증 시나리오
1. Admin 로그인 → `/admin/monitoring` 진입
2. Summary KPI 정상 노출 확인
3. PageViews 탭: 목록/페이징 정상 확인
4. API Histories 탭: 목록/페이징 정상 확인
5. Visitors 탭: 목록 정상 노출, keyword 검색 시 refetch, 페이징 정상
6. Events 탭: 목록 정상 노출, eventType/keyword 필터 정상, metadata 보기 정상
7. Timeseries: from/to 변경 시 차트 refetch, interval 변경 시 refetch
8. 인증 해제(로그아웃) 후: query disabled 확인, 데이터 초기화 확인

### 8.6. 코드 사용 정책 (FE P1-3.1)
- **메뉴별 코드 사용 계약(Usage) 기반 조회**
  - ❌ `/api/admin/codes/all` 의존성 제거 (Codes 화면 제외)
  - ✅ 각 화면은 자신의 `resourceKey` 기준으로 필요한 코드만 조회
  - ✅ API: `GET /api/admin/codes/usage?resourceKey=...`
  - ✅ 응답 구조: `{ [groupKey: string]: Code[] }`
- **화면별 코드 조회 매핑**:
  - Users (`menu.admin.users`): `USER_STATUS`, `SUBJECT_TYPE`
  - Roles (`menu.admin.roles`): `PERMISSION_CODE`
  - Resources (`menu.admin.resources`): `RESOURCE_TYPE`
  - Codes: 예외 (전체 코드 그룹 조회 필요)
- **Fallback 정책**: Usage 매핑 없으면 dropdown disabled + "코드 매핑 필요" 메시지
- **하드코딩 금지**: 모든 드롭다운/필터는 Code API 기반으로만 구성

## 9. 코드 사용 정책 상세 (FE P1-3.1)

### 9.1. 메뉴별 코드 사용 계약(Usage) 기반 조회
- **기본 원칙**: `/api/admin/codes/all` 의존성 제거
- **조회 방식**: 각 화면은 자신의 `resourceKey` 기준으로 필요한 코드만 조회
- **API**: `GET /api/admin/codes/usage?resourceKey=...`
- **응답 구조**: `{ [groupKey: string]: Code[] }`

### 9.2. 화면별 코드 조회 매핑
- **Users 화면** (`/admin/users`): `menu.admin.users`
  - `USER_STATUS`: 사용자 상태 코드
  - `SUBJECT_TYPE`: 사용자 타입 코드 (있는 경우)
- **Roles 화면** (`/admin/roles`): `menu.admin.roles`
  - `PERMISSION_CODE`: 권한 코드 (VIEW, USE, EDIT, DELETE 등)
- **Resources 화면** (`/admin/resources`): `menu.admin.resources`
  - `RESOURCE_TYPE`: 리소스 타입 코드 (MENU, BUTTON, API 등)
- **Codes 화면** (`/admin/codes`): **예외**
  - 전체 코드 그룹 조회 필요하므로 `getAllCodes()` 허용
  - 관리자 코드 관리 화면이므로 예외 처리

### 9.3. 코드 바인딩 표준화
```typescript
// 표준 사용 패턴
const { data: codeMap } = useCodesByResourceQuery('menu.admin.users');
const userStatusOptions = getSelectOptionsByGroup(codeMap, 'USER_STATUS');
const subjectTypeOptions = getSelectOptionsByGroup(codeMap, 'SUBJECT_TYPE');
```

### 9.4. Fallback 정책 (Usage 매핑 누락 시)
- **코드 매핑이 없는 경우**:
  - Dropdown을 `disabled` 처리
  - Helper text에 "코드 매핑 필요" 메시지 표시
  - 임시로 `all` 조회 fallback **금지** (운영 안정성)
- **UX 정책**:
  - 로딩 중: "코드 로딩 중..." 표시
  - 매핑 없음: "코드 매핑 필요" 표시 + disabled

### 9.5. 하드코딩 금지
- ❌ 하드코딩된 문자열 금지: `'ACTIVE'`, `'INACTIVE'`, `'MENU'`, `'VIEW'` 등
- ✅ Code API 기반으로만 옵션 구성
- ✅ `toSelectOptions()` 유틸 함수 사용

### 9.6. Query Key 규칙
- Format: `['admin', 'codes', 'usage', tenantId, resourceKey]`
- enabled 조건: `isAuthenticated && Boolean(tenantId) && Boolean(resourceKey)`
- 캐싱: `staleTime: 1분`, `gcTime: 5분`

### 9.7. 생성된 파일
- `libs/shared-utils/src/api/code-usage-api.ts` (신규)
- `libs/shared-utils/src/queries/use-codes-by-resource-query.ts` (신규)
- `libs/shared-utils/src/admin/code-utils.ts` (신규)

## 10. Admin CRUD UI 완성 (FE P1-5)

### 10.1. CodeUsage 관리 UI (`/admin/code-usages`)
- **권한 체크**: `menu.admin.code-usages` VIEW 권한 필요
- **기능**:
  - 코드 사용 매핑 목록 조회 (page/size/keyword/resourceKey/codeGroupKey/enabled 필터)
  - 코드 사용 매핑 생성 (resourceKey + codeGroupKey + enabled)
  - 코드 사용 매핑 수정 (enabled 토글)
  - 코드 사용 매핑 삭제 (확인 다이얼로그)
- **UI 구성**:
  - 상단: 검색 + Resource Key 필터 + Code Group Key 필터 + 상태 필터
  - 테이블: resourceKey, codeGroupKey, 상태, 생성일
  - row action: Edit / Delete
- **API**:
  - `GET /api/admin/code-usages` - 목록 조회
  - `POST /api/admin/code-usages` - 생성
  - `PUT /api/admin/code-usages/:id` - 수정
  - `DELETE /api/admin/code-usages/:id` - 삭제
- **Query Hooks**: `use-code-usages-query.ts`
  - `useCodeUsagesQuery`: 목록 조회
  - `useCodeUsageDetailQuery`: 상세 조회
  - `useCreateCodeUsageMutation`: 생성
  - `useUpdateCodeUsageMutation`: 수정
  - `useDeleteCodeUsageMutation`: 삭제

### 10.2. 기존 페이지 실연동 상태
- **Users 페이지** (`/admin/users`): ✅ 실연동 완료
  - 검색/필터/페이징/CRUD 모두 구현됨
  - USER_STATUS 코드 기반 필터 사용
- **Roles 페이지** (`/admin/roles`): ✅ 실연동 완료
  - RoleMembers 관리 구현됨
  - RolePermissions 매트릭스 편집 구현됨 (운영 수준)
  - ROLE_STATUS 코드 기반 필터 사용
- **Resources 페이지** (`/admin/resources`): ✅ 실연동 완료
  - 트리 구조 편집 구현됨
  - RESOURCE_TYPE 코드 기반 필터 사용
- **Codes 페이지** (`/admin/codes`): ✅ 실연동 완료
  - 코드 그룹/코드 CRUD 모두 구현됨

### 10.3. RBAC 403 에러 처리
- **전역 처리**: `libs/shared-utils/src/axios-instance.ts`
  - 401: 로그아웃 + `/sign-in` 리다이렉트
  - 403: 로그아웃 금지, `/403` 페이지로 리다이렉트
- **Query Error Handler**: React Query의 `onError`에서 자동 처리
  - 403 발생 시 사용자에게 "접근 권한 없음" 안내
- **페이지별 처리**: `PermissionRouteGuard`로 라우트 레벨 보호

### 10.4. API/Query 파일 구조
- **API Layer** (`libs/shared-utils/src/api/`):
  - `admin-iam-api.ts`: Users, Roles, Resources, Codes API
  - `code-usage-api.ts`: CodeUsage 조회 및 CRUD API
- **Query Layer** (`libs/shared-utils/src/queries/`):
  - `use-admin-users-query.ts`: Users 쿼리 및 mutation
  - `use-admin-roles-query.ts`: Roles 쿼리 및 mutation
  - `use-admin-resources-query.ts`: Resources 쿼리 및 mutation
  - `use-code-groups-query.ts`: Code Groups 쿼리 및 mutation
  - `use-code-usages-query.ts`: Code Usages 쿼리 및 mutation
- **Query Key 규칙**: `['admin', resourceType, tenantId, ...params]`
- **enabled 조건**: `isAuthenticated && Boolean(tenantId)`

### 10.5. 화면별 resourceKey 매핑
- Users: `menu.admin.users`
- Roles: `menu.admin.roles`
- Resources: `menu.admin.resources`
- Codes: `menu.admin.codes`
- Code Usages: `menu.admin.code-usages`
- Monitoring: `menu.admin.monitoring`
- Audit: `menu.admin.audit`

### 10.6. Roles Permission Matrix UX (운영 수준) ⭐ 신규

**구현 위치**: `apps/remotes/admin/src/pages/roles.tsx` → `RolePermissionsDialog`

**핵심 기능**:
1. **Resource Tree 기반 편집**:
   - 좌측 패널에 리소스 트리 표시 (계층 구조)
   - 트리 노드 클릭 시 우측 매트릭스에서 해당 리소스 선택
   - 트리 확장/축소 기능 (전체 확장/축소 버튼 제공)
   - 트리 필터링: 검색어, 리소스 타입, 변경된 것만 필터 적용

2. **Tri-state 편집 (NONE/ALLOW/DENY)**:
   - 셀 클릭 시 순환: **NONE → ALLOW → DENY → NONE**
   - 표현:
     - NONE: 빈 셀 또는 `-` 아이콘
     - ALLOW: ✅ (녹색) 체크 아이콘
     - DENY: ⛔ (빨간색) 닫기 아이콘
   - `cycleState()` 유틸리티 함수로 상태 순환 처리

3. **변경 추적 (Dirty State)**:
   - `original` vs `current` 상태 분리 저장
   - `isMatrixDirty()` 함수로 변경 여부 확인
   - 변경된 리소스만 하이라이트 표시 (노란색 배경)
   - 변경된 리소스에 "변경" Chip 표시

4. **Bulk Apply 기능**:
   - **Row Apply**: 특정 리소스 행의 모든 권한 코드에 ALLOW/DENY 일괄 적용
   - **Column Apply**: 특정 권한 코드 열의 모든 리소스에 ALLOW/DENY 일괄 적용 (헤더의 버튼)
   - **Select All**: 필터된 모든 리소스의 모든 권한 코드에 ALLOW/DENY 일괄 적용
   - **Apply to Children**: 부모 노드에 적용 시 하위 리소스까지 재귀적으로 일괄 적용

5. **Change Preview Modal**:
   - 저장 클릭 시 변경사항 미리보기 모달 표시
   - 변경 셀 개수, 변경 리소스 개수 표시
   - 상위 20개 변경 상세 표시 (리소스명, 권한 코드, 변경 전/후 상태)
   - 확인 후에만 실제 저장 진행

6. **변경된 항목만 전송 (Diff Payload)**:
   - `generateDiffPayload()` 함수로 변경된 항목만 추출
   - 저장 시 변경된 항목만 PUT 요청으로 전송
   - NONE 상태는 `effect=null`로 전송 (삭제 의미)

7. **Unsaved Changes Guard**:
   - `dirty=true` 상태에서:
     - 브라우저 닫기/새로고침 시 `beforeunload` 이벤트로 경고
     - 다이얼로그 닫기 시 확인 다이얼로그 표시
     - 역할 변경 시 확인 다이얼로그 표시 (향후 구현)

8. **검색/필터**:
   - 리소스 이름/키 검색 (트리와 매트릭스 모두 필터링)
   - 리소스 타입 필터 (CodeUsage 기반)
   - "변경된 것만" 필터 (onlyChanged toggle)

9. **권한(403) UX 처리**:
   - 403 발생 시 "권한이 없습니다" Alert 표시
   - 로그아웃 금지, 테이블 숨김 또는 disabled 처리

**저장 Payload 형식** (Backend Spec):
```typescript
{
  items: [
    {
      resourceKey: "menu.admin.users",
      permissionCode: "VIEW",
      effect: "ALLOW" | "DENY" | null  // null for NONE (deletion)
    }
  ]
}
```

**GET 응답 형식** (Backend):
```typescript
{
  permissions: [
    {
      resourceKey: "menu.admin.users",
      permissionCodes: ["VIEW", "USE"],
      effect?: "ALLOW" | "DENY"  // Optional (default: ALLOW)
    }
  ]
}
```

**CodeUsage 기반 코드 로딩**:
- `resourceKey`: `menu.admin.roles`
- 사용 코드 그룹:
  - `PERMISSION_CODE`: 권한 코드 (VIEW, USE, EDIT 등)
  - `RESOURCE_TYPE`: 리소스 타입 (MENU, BUTTON 등)
  - `EFFECT_TYPE`: 권한 효과 (ALLOW, DENY) - 있는 경우

**유틸리티 함수** (`libs/shared-utils/src/admin/role-permission-matrix-utils.ts`):
- `cycleState()`: Tri-state 순환 함수 (NONE → ALLOW → DENY → NONE)
- `createMatrixState()`: 권한 응답을 매트릭스 상태로 변환
- `isMatrixDirty()`: 변경 여부 확인
- `generateDiffPayload()`: 변경된 항목만 추출하여 payload 생성 (items 배열, effect=null for NONE)
- `togglePermissionEffect()`: 셀 클릭 시 상태 순환
- `applyRowPermissions()`: 행 전체 일괄 적용
- `applyColumnPermissions()`: 열 전체 일괄 적용
- `applyAllPermissions()`: 전체 일괄 적용
- `applyToResourceAndChildren()`: 리소스와 하위까지 재귀 적용
- `getChangePreview()`: 변경사항 상세 목록 추출
- `getChangedResources()`: 변경된 리소스 키 Set 반환

**테스트** (`libs/shared-utils/src/admin/__tests__/role-permission-matrix.test.ts`):
- `cycleState()` 순환 로직 테스트
- `generateDiffPayload()` diff 생성 테스트 (effect=null 포함)
- `applyRowPermissions()`, `applyColumnPermissions()`, `applyAllPermissions()` bulk apply 테스트
- `applyRowPermissions()`: 행 전체 권한 적용
- `applyColumnPermissions()`: 열 전체 권한 적용
- `applyAllPermissions()`: 전체 권한 적용
- `resetMatrixState()`: 변경사항 초기화
- `togglePermissionEffect()`: 권한 효과 토글
- `setPermissionEffect()`: 권한 효과 직접 설정
- `getChangedResources()`: 변경된 리소스 목록 반환

**테스트** (`libs/shared-utils/src/admin/__tests__/role-permission-matrix.test.ts`):
- 변경 diff 생성 함수 테스트
- bulk apply 함수 테스트 (row/column/select all)
- dirty state 추적 테스트

## 11. Admin CRUD Feature 추가 방법 (표준 템플릿)

새로운 Admin CRUD Feature를 추가할 때는 반드시 표준 템플릿을 따라야 합니다. 상세 가이드는 `docs/ADMIN_CRUD_STANDARD_TEMPLATE.md`를 참조하세요.

### 11.1. 필수 폴더 구조
```
apps/remotes/admin/src/pages/<feature>/
├── index.tsx                    # 라우트 엔트리(조립 only, 400라인 이하)
├── types.ts                     # feature 전용 타입
├── adapters/<feature>-adapter.ts
├── hooks/use-<feature>-*.ts
└── components/<feature>-*.tsx
```

### 11.2. 계층 규칙
- API → Queries → Hooks → Components 순서만 허용
- 페이지/컴포넌트에서 직접 API 호출 금지

### 11.3. 필수 적용 사항
- CodeUsage 기반 select (하드코딩 금지)
- PermissionRouteGuard + PermissionGate 적용
- 이벤트 추적 (VIEW/SEARCH/FILTER/SUBMIT 등)
- QueryKey 규칙 준수 (`['admin', '<feature>', 'list', ...]`)

### 11.4. 체크리스트
- [ ] Feature 폴더 구조 생성
- [ ] API/Query 작성
- [ ] Adapters/Hooks/Components 작성
- [ ] index.tsx 조립 (400라인 이하)
- [ ] 권한/이벤트/코드 적용
- [ ] 테스트 추가
