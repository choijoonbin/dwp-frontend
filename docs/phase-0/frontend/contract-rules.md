# Phase 0 — Frontend Contract Rules

> Phase A/B 전에 FE가 표준 계약을 깨지 않도록 기초 정리  
> **목표**: 기능 추가 최소, 계약/공통 규칙 정리

---

## 1. 표준 요청 헤더

모든 REST/SSE 요청에서 아래 헤더를 **반드시** 전송한다.

| 헤더 | 필수 | 출처 | 비고 |
|------|------|------|------|
| `X-Tenant-ID` | ✅ | `getTenantId()` | tenant-util |
| `Authorization` | 조건부 | `getAccessToken()` | Bearer 토큰, 로그인 시만 |
| `X-User-ID` | 조건부 | `getUserId()` | user-id-storage |
| `X-Trace-ID` | ✅ | `generateTraceId()` | 요청별 분산 추적용 UUID |
| `X-Agent-ID` | 조건부 | `getAgentSessionId()` | Agent/SSE 스트림 시 |

### 구현 위치

- **REST**: `libs/shared-utils/src/axios-instance.ts` — `buildHeaders()`
- **SSE (Aura)**: `libs/shared-utils/src/agent/use-agent-stream.ts`
- **SSE (Synapse Case)**: `libs/shared-utils/src/agent/use-synapse-agent-stream.ts`

### Trace ID 생성

- `libs/shared-utils/src/trace-util.ts` — `generateTraceId()`
- `crypto.randomUUID()` 또는 fallback

### 헤더 누락 시

- 개발 모드: `X-Tenant-ID` 누락 시 `console.warn` 로그

---

## 2. 실제 호출 엔드포인트

> Backend 결과 문서 기준 확정 경로. FE는 아래 경로만 사용한다.

### Case 목록/상세

| 용도 | 메서드 | 경로 | 구현 위치 |
|------|--------|------|-----------|
| 목록 조회 | GET | `/api/synapse/cases` | `synapse-operations-api.ts` — `getCases()` |
| 상세 조회 | GET | `/api/synapse/cases/{caseId}` | `synapse-operations-api.ts` — `getCaseDetail()` |
| 상태 변경 | POST | `/api/synapse/cases/{caseId}/status` | `synapse-operations-api.ts` — `updateCaseStatus()` |

### HITL (Case Detail Agent Stream)

| 용도 | 메서드 | 경로 | 구현 위치 |
|------|--------|------|-----------|
| 승인 | POST | `/api/aura/hitl/approve/{requestId}` | `hitl-api.ts` — `approveHitlRequest()` |
| 반려 | POST | `/api/aura/hitl/reject/{requestId}` | `hitl-api.ts` — `rejectHitlRequest()` |

### Actions (조치 승인/실행)

| 용도 | 메서드 | 경로 | 구현 위치 |
|------|--------|------|-----------|
| 목록 조회 | GET | `/api/synapse/actions` | `synapse-operations-api.ts` — `getActions()` |
| 승인 | POST | `/api/synapse/actions/{actionId}/approve` | `synapse-operations-api.ts` — `approveAction()` |
| 실행 | POST | `/api/synapse/actions/{actionId}/execute` | `synapse-operations-api.ts` — `executeAction()` |
| 반려 | POST | `/api/synapse/actions/{actionId}/reject` | `synapse-operations-api.ts` — `rejectAction()` |
| 시뮬레이션 | POST | `/api/synapse/actions/{actionId}/simulate` | `synapse-operations-api.ts` — `simulateAction()` |

### Audit Events

| 용도 | 메서드 | 경로 | 구현 위치 |
|------|--------|------|-----------|
| 이벤트 목록 | GET | `/api/synapse/audit/events` | `synapse-admin-pii-api.ts` — `getSynapseAuditEvents()` |

쿼리 파라미터: `category`, `type`, `resourceType`, `resourceId`, `outcome`, `severity`, `actor`, `q`, `from`, `to`, `page`, `size`, `sort`

### Agent Stream (SSE)

| 용도 | 메서드 | 경로 | 구현 위치 |
|------|--------|------|-----------|
| Case 분석 스트림 | POST | `/api/synapse/agent-tools/agents/finance/stream` | `use-synapse-agent-stream.ts` |

### Detect Batch (Admin)

| 용도 | 메서드 | 경로 | 구현 위치 |
|------|--------|------|-----------|
| Scheduler 상태 | GET | `/api/synapse/admin/detect/scheduler/status` | `synapse-detect-api.ts` — `getDetectSchedulerStatus()` |
| Run 목록 | GET | `/api/synapse/admin/detect/runs` | `synapse-detect-api.ts` — `getDetectRuns()` |
| Run 상세 | GET | `/api/synapse/admin/detect/runs/{runId}` | `synapse-detect-api.ts` — `getDetectRunDetail()` |
| 수동 실행 | POST | `/api/synapse/admin/detect/run` | `synapse-detect-api.ts` — `runDetectNow()` |

---

## 3. 에러 처리 규칙

- `ErrorState` / `ErrorStateWithRetry` 사용
- 에러를 mock/fallback으로 숨기지 않는다.
- 401/403: Host `handleAuthError` → `setUnauthorizedHandler` 콜백

### 공통 컴포넌트

| 용도 | 컴포넌트 | 경로 |
|------|----------|------|
| 에러 + 재시도 | `ErrorStateWithRetry` | `apps/remotes/synapsex/src/components/ux/error-state-with-retry.tsx` |
| 빈 상태 | `EmptyState` | `libs/design-system/src/components/patterns/empty-state/` |
| 로딩 스켈레톤 | `Skeleton` (MUI) | `@mui/material/Skeleton` |
| 테이블 로딩 | `TableLoadingSkeleton` | `apps/remotes/synapsex/src/components/ux/table-loading-skeleton.tsx` |

---

## 4. 페이징/정렬 파라미터 표준

| 파라미터 | 타입 | 의미 |
|----------|------|------|
| `page` | number | 0-based 페이지 번호 |
| `size` | number | 페이지당 항목 수 |
| `sort` | string | 정렬 필드 (예: `createdAt,desc`) |

**출처**: `libs/shared-utils/src/contracts/synapse-filters.ts` — `CommonListFilter`

---

## 5. SSE / Last-Event-ID 규칙

- **재연결**: 스트림 끊김 시 exponential backoff + `Last-Event-ID` 헤더
- **재연결 시**: 새 스트림. id는 last_id+1로 연속. **replay 미지원**
- **HITL approve/reject 후**: 동일 연결 유지, Last-Event-ID 미사용

상세: `docs/reference/SSE_LAST_EVENT_ID.md`

---

## 6. 메뉴/라우트 키

- 메뉴 트리: `GET /api/auth/menus/tree` (백엔드 SoT)
- 확정된 path: `/synapse`, `/cases`, `/audit`, `/admin` 등
- `pathname-to-page` → `getResourceKeyForPath` → `PermissionRouteGuard`

---

## 7. Cases 리스트 리프레시 규칙

- Detect batch 실행 후 케이스가 생성되므로, 수동 Refresh 시 query invalidate + refetch 수행
- **QueryKey**: `['synapse', 'cases', 'list', tenantId]` (TanStack Query)
- **동작**: Refresh 버튼 클릭 시 `invalidateQueries` 후 `refetch()` 호출
- **구현**: `apps/remotes/synapsex/src/pages/cases/index.tsx` — `handleRefresh()`

---

## 8. 관련 문서

- `docs/phase-0/frontend/route-map.md` — Shell↔Remote 라우팅
- `docs/reference/SSE_LAST_EVENT_ID.md` — SSE 재연결
- `docs/essentials/DESIGN_SYSTEM.md` — 공통 컴포넌트 카탈로그
