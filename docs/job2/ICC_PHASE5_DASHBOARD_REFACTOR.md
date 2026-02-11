# ICC Phase 5 — Integrated Control Center Dashboard Refactor

**작업 완료:** 수치(analytics_kpi_daily → kpiDaily)와 펄스 애니메이션에 집중해 BE aggregator(`SynapseDashboardSummaryDto`) 연동 및 레이더 펄스 UI 적용 완료.

## Pre-Check (Answered)

### 1. Dashboard aggregator API 엔드포인트 백엔드 합의

- **현재**: 단일 “Dashboard Aggregator” 엔드포인트는 없음. 기존 대시보드와 동일하게 **개별 API** 사용:
  - **Metrics (KPI)**: `GET /api/synapse/dashboard/summary` → `useDashboardSummaryQuery()` (기존 `DashboardSummaryDto` → `mapSummaryToKpis`).  
  - 추후 `analytics_kpi_daily` 또는 통합 aggregator가 있으면 이 레이어만 교체하면 됨.
- **Live Feed**: `GET /api/synapse/dashboard/agent-stream?range=6h&limit=50` → `useDashboardAgentActivityQuery()`.
- **Critical HITL**: `GET /api/synapse/reconciliation/runs` + `GET /api/synapse/reconciliation/runs/:runId` → `useReconRunsQuery()` + `useReconRunDetailQuery(latestRunId)`.  
  `results` 중 `status === 'FAIL'` 인 항목 최신 5건 표시.

### 2. 라이트/다크 Glassmorphism `theme.palette.mode` 분기

- **적용함.** `getGlassCardSx(theme)` 에서 `theme.palette.mode === 'dark'` 로 분기:
  - **Light**: `backdropFilter: blur(20px)`, `backgroundColor: 'rgba(255, 255, 255, 0.7)'`.
  - **Dark**: `backgroundColor: 'rgba(30, 41, 59, 0.8)'`, `boxShadow` with `varAlpha(theme.vars.palette?.error?.mainChannel, 0.12)` (SK Red glow).

---

## 구현 요약

| 섹션 | 구현 내용 |
|------|------------|
| **Metrics Layer (Top)** | **수치**: BE aggregator `GET /api/synapse/dashboard/summary` → `SynapseDashboardSummaryDto.kpiDaily` (analytics_kpi_daily 오늘 최대 4건). `useSynapseDashboardSummaryQuery` + `mapKpiDailyToCards(kpiDaily)` → 4열 카드(metricKey/metricValue). 24px 아이콘 + 옅은 배경 + 굵은 수치 + glass. |
| **Autonomous Pulse (Middle-Left)** | **펄스 애니메이션**: `RadarPulse` (Pure CSS/SVG). 동심원 + 회전 스윕 + 중앙 점 ping. “Live SCAN” 라벨. 데이터 연동 없음. |
| **Live Intelligence Feed (Right)** | `agent_activity_log` 최근 10건. `useDashboardAgentActivityQuery` → `mapAgentActivity` → 타임라인 리스트. 각 행: 시간, **title**=action, **reasoning**=message, **status**=Label. 클릭 시 `handleAgentActivityClick` (케이스/감사 등 이동). |
| **Critical HITL Summary (Bottom)** | `recon_result` FAIL 최신 5건. `useReconRunsQuery` → 최신 run의 `runId` → `useReconRunDetailQuery(runId)` → `results.filter(r => r.status === 'FAIL').slice(0, 5)`. 리소스 키 + FAIL 뱃지 + “View Reconciliation” 링크. |
| **Glassmorphism** | 모든 카드에 `getGlassCardSx(theme)` 적용 (Light/Dark 위 분기). |
| **Responsive** | `Grid`/`Stack` `direction={{ xs: 'column', lg: 'row' }}`, `size={{ xs: 12, sm: 6, md: 3 }}` 등으로 375px에서 1열 스택. |

---

## 파일 변경

- `apps/remotes/synapsex/src/pages/dashboard/index.tsx`: ICC 레이아웃, KPI 4열+glass, Pulse+Live Feed+HITL, 기존 Action Required / Risk / Team / Agent Stream / Quick Stats 카드 제거.
- `apps/remotes/synapsex/src/pages/dashboard/components/radar-pulse.tsx`: 신규. 레이더/펄스 SVG + keyframes.
- `libs/shared-i18n/src/locales/en/common.json`, `ko/common.json`: `dashboard.icc.*` (liveScan, liveFeedTitle, liveFeedSubtitle, hitlSummaryTitle, hitlSummarySubtitle, hitlEmpty, hitlResource, hitlStatus, viewRecon).

---

## 데이터 규격 (참고)

- **agent_activity_log**: `AgentActivityDto` → `AgentActivityUiItem` (timestamp, action, message, status, caseId, …). Feed에서는 **title**=action, **reasoning**=message, **status**=status 로 렌더.
- **recon_result**: `ReconResultDto` (resultId, resourceType, resourceKey, status: 'PASS'|'FAIL', detailJson). HITL에는 status===’FAIL’ 만 사용.
