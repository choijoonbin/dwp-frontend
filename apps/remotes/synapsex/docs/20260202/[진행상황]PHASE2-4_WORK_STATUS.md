# Phase2~4 작업 진행상황 점검

> **목표**: 모든 메뉴 실화면 완성 + API 연동 + 라우트 404 제거  
> **점검일**: 2026-02-02

---

## 1. 라우트/404 현황

### 1.1 pathname-to-page 매핑

| pathname 패턴 | 페이지 | 상태 |
|---------------|--------|------|
| `/synapse`, `/` | DashboardPage | ✅ |
| `/synapse/cases`, `/cases` | CasesPage | ✅ |
| `/synapse/cases/:id` | CaseDetailPage | ✅ |
| `/synapse/documents`, `/documents` | DocumentsPage | ✅ |
| `/synapse/documents/:bukrs/:belnr/:gjahr` | DocumentDetailPage | ✅ |
| `/synapse/open-items`, `/open-items` | OpenItemsPage | ✅ |
| `/synapse/entities`, `/entities` | EntitiesPage | ✅ |
| `/synapse/entities/:id` | EntityDetailPage | ✅ |
| `/synapse/lineage`, `/lineage` | LineagePage | ✅ |
| `/synapse/anomalies`, `/anomalies` | AnomaliesPage | ✅ |
| `/synapse/optimization`, `/optimization` | OptimizationPage | ✅ |
| `/synapse/actions`, `/actions` | ActionsPage | ✅ |
| `/synapse/archive`, `/archive` | ArchivePage | ✅ |
| `/synapse/rag`, `/rag` | RagPage | ✅ |
| `/synapse/rag/:docId` | RagDocumentDetailPage | ✅ |
| `/synapse/policies`, `/policies` | PoliciesPage | ✅ |
| `/synapse/policies/:profileId` | PolicyProfileDetailPage | ✅ |
| `/synapse/guardrails`, `/guardrails` | GuardrailsPage | ✅ |
| `/synapse/dictionary`, `/dictionary` | DictionaryPage | ✅ |
| `/synapse/feedback`, `/feedback` | FeedbackPage | ✅ |
| `/synapse/reconciliation`, `/reconciliation` | ReconciliationPage | ✅ |
| `/synapse/reconciliation/:runId` | ReconRunDetailPage | ✅ |
| `/synapse/action-recon`, `/action-recon` | ActionReconciliationPage | ✅ |
| `/synapse/audit`, `/audit` | AuditPage | ✅ |
| `/synapse/analytics`, `/analytics` | AnalyticsPage | ✅ |
| `/synapse/autonomy`, `/autonomy` | AutonomyPage | ✅ |
| `/synapse/governance`, `/governance` | GovernancePage | ✅ |
| `/synapse/agent-config`, `/agent-config` | AgentConfigPage | ✅ |
| `/synapse/integrations`, `/integrations` | IntegrationsPage | ✅ |
| `/synapse/admin`, `/admin` | SynapseAdminPage | ✅ |
| 알 수 없는 경로 | DashboardPage (fallback) | ✅ 404 아님 |

**404 원인**: Host PathnameDispatcher는 `pathname.startsWith('/synapse/')` 또는 `menuPathnames.has(pathname)` 시 SynapsePage 표시. 미등록 경로만 404.

---

## 2. 메뉴별 구현 현황

### 2.1 Phase 2 — Operations

| 메뉴 | API 연동 | column chooser | saved views | csv export | 에러/로딩/empty | 비고 |
|------|----------|----------------|-------------|------------|-----------------|------|
| **/cases** | ✅ useCasesListQuery | ✅ | ✅ | ❌ | ✅ | worklist 완성 |
| **/cases/:id** | ✅ useCaseDetailQuery | — | — | — | ✅ | 3-Panel, Agent Stream, HITL, Simulation |
| **/anomalies** | ✅ useAnomaliesListQuery | ⚠️ 부분 | ❌ | ❌ | ✅ | rule badge, drilldown → case |
| **/optimization** | ✅ useOpenItemsListQuery | ❌ | ❌ | ❌ | ✅ | AR/AP 탭, cross-link |
| **/actions** | ✅ useActionsListQuery | ⚠️ 부분 | ❌ | ❌ | ✅ | Bulk approval, drawer |
| **/archive** | ✅ useArchiveListQuery | ❌ | ❌ | ❌ | ✅ | list + detail drawer |

### 2.2 Phase 3 — Knowledge & Policy

| 메뉴 | API 연동 | column chooser | saved views | csv export | 에러/로딩/empty | 비고 |
|------|----------|----------------|-------------|------------|-----------------|------|
| **/rag** | ✅ | ❌ | ❌ | ❌ | ✅ | 문서 업로드, 인덱싱 상태 |
| **/policies** | ✅ | — | profile selector | — | ✅ | duplicate config, thresholds |
| **/guardrails** | ✅ | — | — | — | ✅ | severity matrix, evaluate |
| **/dictionary** | ✅ | ❌ | ❌ | ⚠️ optional | ✅ | term CRUD |
| **/feedback** | ✅ | ❌ | ❌ | ❌ | ✅ | case 라벨링, policy suggestion |

### 2.3 Phase 4 — Reconciliation & Audit

| 메뉴 | API 연동 | column chooser | saved views | csv export | 에러/로딩/empty | 비고 |
|------|----------|----------------|-------------|------------|-----------------|------|
| **/reconciliation** | ✅ | ❌ | ❌ | ❌ | ✅ | runs list. 요구: ingestion health / integrity 2탭 |
| **/action-recon** | ✅ | ❌ | ❌ | ❌ | ✅ | 실패 재시도 CTA |
| **/audit** | ✅ useSynapseAuditEventsQuery | ⚠️ filters | ❌ | ❌ | ✅ | category/type/outcome 등 필터 |
| **/analytics** | ✅ useAnalyticsKpisQuery | — | — | — | ✅ | KPI 위주 |

---

## 3. 미완성/보완 필요 항목

### 3.1 공통 (모든 리스트 화면)

- [x] **CSV export** (프론트만): Cases ✅, Anomalies ✅, Action-recon ✅ (추가 완료). 나머지: Actions, Archive, Documents, Open Items, Entities, RAG, Dictionary, Feedback, Reconciliation, Audit
- [ ] **column chooser**: Anomalies, Actions, Archive, Documents, Open Items, Entities 등
- [ ] **saved views**: Anomalies, Actions, Archive 등 (Cases는 이미 있음)

### 3.2 라우트별 상세

1. **/cases** — 완성 (CSV export 포함)
2. **/cases/:id** — 완성 (3-Panel, Agent, HITL, Simulation)
3. **/anomalies** — rule badge, case detail 링크, CSV export ✅. column chooser, saved views
4. **/optimization** — AR/AP 탭 구조, cross-link (entity/doc/open-item)
5. **/actions** — Bulk approval UI, row → drawer (simulate/approve/execute), column chooser, csv
6. **/archive** — column chooser, saved views, csv, detail drawer 개선
7. **/rag** — 문서 업로드 UI, 인덱싱 상태, doc click → detail drawer
8. **/policies** — profile selector, duplicate invoice config, thresholds, audit 이벤트 링크
9. **/guardrails** — severity별 matrix UI, 변경 diff preview
10. **/dictionary** — import/export csv optional
11. **/feedback** — case 기반 라벨링 UI, policy suggestion
12. **/reconciliation** — ingestion health / integrity report 2탭 ✅ (완료)
13. **/action-recon** — 실패 재시도 CTA ✅, CSV export ✅ (완료)
14. **/audit** — filters: category/type/outcome/severity/actor/resource/q ✅ (완료)
15. **/analytics** — impact metrics, lead time, savings (차트 최소, 표+KPI)

### 3.3 크로스링크 규칙

- documents → entity, cases, lineage
- entities → related docs, open-items, cases
- actions → caseId, docKey 역추적
- audit → resourceId deep link

---

## 4. 다음 작업 우선순위

1. **CSV export** (프론트): 클라이언트에서 테이블 데이터 → CSV 다운로드. 공통 유틸 추가.
2. **column chooser / saved views**: Cases 패턴을 다른 리스트에 적용.
3. **reconciliation 2탭**: ingestion health / integrity report
4. **audit filters**: category, type, outcome 등
5. **크로스링크**: documents, entities, actions, audit에서 상호 링크
