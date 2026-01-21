# FE P1-2: Monitoring 대시보드 강화 (Visitors/Events/Timeseries)

**작성일**: 2026-01-20  
**상태**: ✅ 완료  
**목적**: Monitoring 대시보드에 Visitors/Events 탭 추가 및 Timeseries API 강화

---

## 개요

P1-1에서 구현한 기본 대시보드를 확장하여 방문자뷰, 이벤트 탭을 추가하고, Timeseries API를 강화했습니다.

---

## 구현 내용

### 1. Monitoring API 확장

**파일**: `libs/shared-utils/src/api/monitoring-api.ts`

#### 추가된 API 함수:
- `getMonitoringVisitors(params)`: 방문자 목록 조회
  - 엔드포인트: `GET /api/admin/monitoring/visitors`
  - 파라미터: `from`, `to`, `page`, `size`, `keyword`
  - 응답: `PageResponse<VisitorItem>`
  - 기본값: `from`, `to`가 없으면 최근 30일로 설정

- `getMonitoringEvents(params)`: 이벤트 목록 조회
  - 엔드포인트: `GET /api/admin/monitoring/events`
  - 파라미터: `from`, `to`, `page`, `size`, `keyword`, `eventType`, `resourceKey`
  - 응답: `PageResponse<EventLogItem>`
  - 기본값: `from`, `to`가 없으면 최근 30일로 설정

- `getMonitoringTimeseries(params)`: 시계열 데이터 조회
  - 엔드포인트: `GET /api/admin/monitoring/timeseries`
  - 파라미터: `from`, `to`, `interval` (DAY/HOUR), `metric` (PV, UV, API_TOTAL, API_ERROR)
  - 응답: `TimeseriesResponse` (`labels`, `values` 배열)
  - 백엔드 형식: `{ labels: string[], values: number[] }`
  - 프론트엔드 변환: ApexCharts 형식 (`categories`, `series`)

### 2. Query Layer 확장

**파일**: `libs/shared-utils/src/queries/`

#### 추가된 Query Hooks:
- `useMonitoringVisitorsQuery(params)`: Visitors 쿼리 훅
- `useMonitoringEventsQuery(params)`: Events 쿼리 훅
- `useMonitoringTimeseriesQuery(params)`: Timeseries 쿼리 훅

**Query Key 규칙**:
- Visitors: `['admin', 'monitoring', 'visitors', tenantId, from, to, page, size, keyword]`
- Events: `['admin', 'monitoring', 'events', tenantId, from, to, page, size, keyword, eventType, resourceKey]`
- Timeseries: `['admin', 'monitoring', 'timeseries', tenantId, from, to, interval, metric]`

### 3. Monitoring Tabs 확장

**파일**: `apps/remotes/admin/src/pages/monitoring-tabs.tsx`

#### 추가된 탭:

**방문자뷰 탭**:
- 컬럼:
  - `visitorId`: 방문자 ID
  - `userId`: 사용자 ID (로그인한 경우)
  - `firstSeenAt`: 최초 방문 시간
  - `lastSeenAt`: 최종 방문 시간
  - `pageViewCount`: 페이지뷰 수
  - `eventCount`: 이벤트 수
  - `lastPath`: 최종 방문 경로
  - `lastDevice`: 최종 방문 기기
- 기능:
  - keyword 검색 (visitorId/path)
  - 페이징 (10/30/50)
  - 상세 정보 다이얼로그 (Visitor Summary 포함)

**이벤트 탭**:
- 컬럼:
  - `occurredAt`: 발생 시간
  - `eventType`: 이벤트 타입 (VIEW, CLICK, EXECUTE 등)
  - `resourceKey`: 리소스 키
  - `action`: 액션 코드
  - `label`: 라벨
  - `visitorId`: 방문자 ID
  - `userId`: 사용자 ID
  - `path`: 경로
  - `metadata`: 메타데이터 (expand/collapse)
- 기능:
  - keyword 검색
  - eventType 필터 (CodeUsage 기반 동적 옵션)
  - resourceKey 필터
  - 페이징 (10/30/50)
  - metadata expand/collapse
  - 상세 정보 다이얼로그

### 4. Timeseries 차트 강화

**파일**: `apps/remotes/admin/src/pages/monitoring-charts.tsx`

#### 개선 사항:
- 백엔드 응답 형식 변환 로직 추가
  - `labels` → `categories` (X축)
  - `values` → `series[0].data` (Y축)
- KST 시간대 표시 개선
  - `toLocaleTimeString('ko-KR')` 사용
  - `toLocaleDateString('ko-KR')` 사용
- Interval 토글 (DAY/HOUR) 지원
- Metric별 차트 분리:
  - PV/UV 차트
  - API Total / API Error 차트

### 5. 이벤트 추적 표준화

**파일**: `libs/shared-utils/src/admin/event-actions.ts`

#### 구현 내용:
- `UiAction` 타입 정의: 'VIEW', 'CLICK', 'EXECUTE', 'SEARCH', 'DOWNLOAD' 등
- `normalizeAction()`: 액션 코드를 대문자로 정규화
- `isValidUiAction()`: 유효한 액션 코드인지 검증

**파일**: `libs/shared-utils/src/api/monitoring-api.ts`

#### 개선 사항:
- `postEvent()` 함수 개선:
  - `action`: `UiAction | string` (표준 액션 코드)
  - `resourceKey`: 필수 필드
  - `metadata`: 선택적 객체
  - `eventType`: deprecated (하위 호환성 유지)

**파일**: `apps/dwp/src/hooks/use-standard-event-tracking.ts`

#### 구현 내용:
- 공통 이벤트 추적 훅
- 자동 포함 필드: `tenantId`, `visitorId`, `pagePath`
- 선택적 debouncing:
  - SEARCH: 500ms debounce
  - CLICK: debounce 없음

### 6. CodeUsage 기반 필터 옵션

**파일**: `apps/remotes/admin/src/pages/monitoring-tabs.tsx`

#### 구현 내용:
- 이벤트 탭의 `eventType` 필터를 CodeUsage 기반으로 변경
- `useCodesByResourceQuery('menu.admin.monitoring')` 사용
- 코드 그룹 우선순위:
  1. `UI_ACTION` (우선)
  2. `EVENT_TYPE` (fallback)
- 코드 매핑 없으면 selectbox 비활성화 + "코드 매핑 필요" helperText

---

## 주요 해결 사항

### 1. 타임존 처리 (KST)
- 모든 날짜/시간 필드는 KST 기준으로 표시
- `toLocaleString('ko-KR')` 사용

### 2. 백엔드 응답 형식 변환
- Spring Page 형식 → Frontend 형식
- Timeseries `labels`/`values` → ApexCharts `categories`/`series`

### 3. 기본 날짜 범위 처리
- `from`, `to`가 없으면 최근 30일로 자동 설정
- API 호출 시 500 에러 방지

### 4. React Key Prop 경고 해결
- 모든 `TableRow`에 고유한 `key` prop 추가
- 빈 상태, 로딩 상태에도 `key` 제공

### 5. TypeScript 타입 오류 해결
- `VisitorSummary` 필드명 정정 (`pageViews` → `pageViewCount`)
- null-safe 처리 추가 (`?? 0`, `?? null`)

### 6. 탭 전환 시 상태 초기화
- `detailData`를 `null`로 리셋
- `detailDialogOpen`을 `false`로 설정

---

## 변경된 파일 목록

### 신규 파일
- `libs/shared-utils/src/queries/use-monitoring-visitors-query.ts`
- `libs/shared-utils/src/queries/use-monitoring-events-query.ts`
- `libs/shared-utils/src/queries/use-monitoring-timeseries-query.ts`
- `libs/shared-utils/src/admin/event-actions.ts`
- `apps/dwp/src/hooks/use-standard-event-tracking.ts`

### 수정된 파일
- `libs/shared-utils/src/api/monitoring-api.ts`: Visitors/Events/Timeseries API 추가, postEvent 개선
- `apps/remotes/admin/src/pages/monitoring-tabs.tsx`: Visitors/Events 탭 추가, 상세 다이얼로그 추가
- `apps/remotes/admin/src/pages/monitoring-charts.tsx`: Timeseries 변환 로직 추가
- `libs/shared-utils/src/index.ts`: event-actions export 추가

---

## 테스트 시나리오

1. **방문자뷰 탭**:
   - 방문자뷰 탭 클릭
   - 목록 로드 확인
   - keyword 검색 동작 확인
   - 상세 정보 다이얼로그 확인

2. **이벤트 탭**:
   - 이벤트 탭 클릭
   - 목록 로드 확인
   - eventType 필터 동작 확인 (CodeUsage 기반)
   - metadata expand/collapse 동작 확인
   - 상세 정보 다이얼로그 확인

3. **Timeseries 차트**:
   - 기간 선택 (예: 7d)
   - Interval 토글 (DAY/HOUR) 동작 확인
   - 차트 데이터 표시 확인

4. **이벤트 추적**:
   - 메뉴 클릭 시 이벤트 로그 확인
   - 버튼 클릭 시 이벤트 로그 확인
   - SEARCH 액션 debounce 확인

---

## 다음 단계 (P1-3)

- CodeUsage 관리 UI 구현
- 코드 그룹별 매핑 관리
- Admin CRUD UI 기본 구조
