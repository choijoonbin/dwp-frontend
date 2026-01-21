# FE P1-1: Monitoring API 연동 및 기본 대시보드 구현

**작성일**: 2026-01-20  
**상태**: ✅ 완료  
**목적**: Monitoring API 연동 및 기본 대시보드 UI 구현

---

## 개요

Admin Remote의 통합 모니터링 대시보드 기본 기능을 구현했습니다. KPI 카드, 기본 차트, 페이지뷰/API 히스토리 탭을 포함합니다.

---

## 구현 내용

### 1. Monitoring API Layer

**파일**: `libs/shared-utils/src/api/monitoring-api.ts`

#### 구현된 API 함수:
- `getMonitoringSummary(params)`: KPI 데이터 조회
  - 엔드포인트: `GET /api/admin/monitoring/summary`
  - 파라미터: `from`, `to` (ISO 8601 날짜 문자열)
  - 응답: `MonitoringSummary` (pv, uv, events, apiErrorRate)
  
- `getMonitoringPageViews(params)`: 페이지뷰 목록 조회
  - 엔드포인트: `GET /api/admin/monitoring/page-views`
  - 파라미터: `from`, `to`, `page`, `size`, `keyword`
  - 응답: `PageResponse<PageViewItem>`
  
- `getMonitoringApiHistories(params)`: API 히스토리 목록 조회
  - 엔드포인트: `GET /api/admin/monitoring/api-histories`
  - 파라미터: `from`, `to`, `page`, `size`, `keyword`
  - 응답: `PageResponse<ApiHistoryItem>`

- `postPageView(payload)`: 페이지뷰 수집
  - 엔드포인트: `POST /api/monitoring/page-view`
  - 인증: 불필요
  - Payload: `{ pageKey, path, title, referrer?, device? }`

- `postEvent(payload)`: 이벤트 수집
  - 엔드포인트: `POST /api/monitoring/event`
  - 인증: 불필요
  - Payload: `{ action, resourceKey, label?, metadata? }`

### 2. Query Layer

**파일**: `libs/shared-utils/src/queries/`

#### 구현된 Query Hooks:
- `useMonitoringSummaryQuery(params)`: Summary 쿼리 훅
- `useMonitoringPageViewsQuery(params)`: PageViews 쿼리 훅
- `useMonitoringApiHistoriesQuery(params)`: ApiHistories 쿼리 훅

**Query Key 규칙**:
- Format: `['admin', 'monitoring', resourceType, tenantId, ...params]`
- 예시: `['admin', 'monitoring', 'summary', tenantId, from, to]`

**Enabled 조건**:
- `isAuthenticated && Boolean(tenantId) && Boolean(from) && Boolean(to)`

### 3. Monitoring Dashboard UI

**파일**: `apps/remotes/admin/src/pages/monitoring.tsx`

#### 구현된 기능:
- **필터 바** (`monitoring-filter-bar.tsx`):
  - 기간 프리셋: 1h, 24h, 7d, 30d
  - 날짜 범위: from/to (datetime-local)
  - 검색 필드: route, menu, path, userId, apiName, apiUrl, statusCode
  - 기본값: 24h (화면 진입 시)
  - 선택된 기간 localStorage에 저장 (메뉴 이동 후 복귀 시 유지)

- **KPI 카드** (`monitoring-kpi-cards.tsx`):
  - PV (Page Views)
  - UV (Unique Visitors)
  - Events
  - API Error Rate (%)
  - 로딩 상태: Skeleton 표시
  - 에러 상태: Alert 표시

- **차트** (`monitoring-charts.tsx`):
  - 시간대별 PV/UV (라인 차트)
  - 시간대별 API Total / API Error (라인 차트)
  - ApexCharts 사용 (`@dwp-frontend/design-system`의 Chart 컴포넌트)
  - Interval 토글: DAY/HOUR
  - from/to 필터 변경 시 자동 refetch

- **상세 리스트 탭** (`monitoring-tabs.tsx`):
  - **페이지뷰 탭**:
    - `/api/admin/monitoring/page-views` 연동
    - 페이징, 필터링 지원
    - 컬럼: timestamp, route, path, title, visitorId, userId, device
  - **API 히스토리 탭**:
    - `/api/admin/monitoring/api-histories` 연동
    - 페이징, 필터링 지원
    - 컬럼: timestamp, apiName, apiUrl, method, statusCode, responseTime, traceId

### 4. 페이지뷰 자동 수집

**파일**: `apps/dwp/src/hooks/use-page-view-tracking.ts`

#### 구현 내용:
- React Router의 `useLocation`을 사용하여 route 변경 감지
- route 변경 시 자동으로 `postPageView` 호출
- debounce 500ms 적용
- silent fail 처리 (실패해도 앱에 영향 없음)

---

## 주요 해결 사항

### 1. 타임존 처리 (KST)
- `getKoreaTime()`: 현재 한국 시간 반환
- `formatKSTToISO()`: KST를 ISO 8601 형식으로 변환
- 모든 날짜 필터는 KST 기준으로 처리

### 2. 무한 API 호출 방지
- `useMemo`로 date range 객체 메모이제이션
- React Query의 `queryKey`가 변경될 때만 refetch

### 3. 백엔드 응답 형식 변환
- Spring Page 형식 (`content`, `totalElements`) → Frontend 형식 (`items`, `total`)
- Timeseries 형식 (`labels`, `values`) → ApexCharts 형식 (`categories`, `series`)

---

## 변경된 파일 목록

### 신규 파일
- `libs/shared-utils/src/api/monitoring-api.ts`
- `libs/shared-utils/src/queries/use-monitoring-summary-query.ts`
- `libs/shared-utils/src/queries/use-monitoring-pageviews-query.ts`
- `libs/shared-utils/src/queries/use-monitoring-apihistories-query.ts`
- `apps/remotes/admin/src/pages/monitoring.tsx`
- `apps/remotes/admin/src/pages/monitoring-filter-bar.tsx`
- `apps/remotes/admin/src/pages/monitoring-kpi-cards.tsx`
- `apps/remotes/admin/src/pages/monitoring-charts.tsx`
- `apps/remotes/admin/src/pages/monitoring-tabs.tsx`
- `apps/dwp/src/hooks/use-page-view-tracking.ts`

### 수정된 파일
- `libs/shared-utils/src/index.ts`: monitoring-api, queries export 추가
- `apps/dwp/src/app.tsx`: usePageViewTracking 훅 추가

---

## 테스트 시나리오

1. **KPI 카드 로딩**:
   - `/admin/monitoring` 접근
   - KPI 카드에 Skeleton 표시 후 데이터 로드 확인

2. **차트 표시**:
   - 기간 선택 (예: 7d)
   - 차트에 데이터 표시 확인

3. **페이지뷰 탭**:
   - 페이지뷰 탭 클릭
   - 목록 로드 및 페이징 동작 확인

4. **API 히스토리 탭**:
   - API 히스토리 탭 클릭
   - 목록 로드 및 페이징 동작 확인

5. **기간 선택 유지**:
   - 7d 선택 후 다른 메뉴 이동
   - 다시 모니터링 메뉴 접근 시 7d 유지 확인

---

## 다음 단계 (P1-2)

- 방문자뷰 탭 추가
- 이벤트 탭 추가
- Timeseries API 연동 강화
- 상세 정보 다이얼로그 추가
