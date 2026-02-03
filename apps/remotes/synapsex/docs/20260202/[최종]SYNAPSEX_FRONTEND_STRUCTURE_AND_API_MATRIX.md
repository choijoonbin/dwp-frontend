# SynapseX 프론트엔드 최종 점검 보고서

> **목적**: DWP 프론트엔드 규칙 준수 여부 점검, 메뉴별 소스 구조화 검토, 화면별 API 사용 현황 정리  
> **작성일**: 2026-02-02  
> **기준 문서**: `docs/essentials/PROJECT_RULES.md`, `docs/essentials/ADMIN_CRUD_STANDARD.md`

---

## 1. 프론트엔드 규칙 준수 점검

### 1.1 준수 현황 요약

| 규칙 | 상태 | 비고 |
|------|------|------|
| React 19 Only | ✅ | package.json 기준 |
| MUI v5 Only | ✅ | shadcn/ui 등 미사용 |
| Single Source of Truth (libs/design-system) | ✅ | 공통 UI는 design-system 사용 |
| Theme Tokens First | ✅ | 하드코딩 색상 금지 준수 |
| No Any Type | ⚠️ | 일부 unknown 사용, 타입 보완 권장 |
| Layout Mode (fixed/scrollable) | ✅ | CRUD/대시보드 적절히 적용 |
| Admin CRUD 표준 구조 | ⚠️ | 일부 페이지 구조 미준수 (아래 상세) |
| Query Key 규칙 | ✅ | `['synapse', '<feature>', ...]` 네임스페이스 준수 |
| API 호출 계층 | ✅ | api → queries → hooks → pages 준수 |
| Permission Guard | ✅ | pathname-to-page에서 PermissionRouteGuard 적용 |
| Host ↔ Remote Direct Import 금지 | ✅ | libs/shared-utils 경유 |
| No Duplicate Layout | ✅ | Remote 내부 Header/Sidebar 미구현 |
| 파일 크기 제한 (Page 400라인, Component 250라인) | ⚠️ | case-detail, entity-detail 등 초과 페이지 존재 |

### 1.2 구조 미준수 페이지 및 권장 사항

| 페이지 | 이슈 | 권장 조치 |
|--------|------|-----------|
| **case-detail.tsx** | 단일 파일 1100+ 라인 초과 | FilterBar/Table/EditorModal 등 components 분리 |
| **entity-detail.tsx** | 단일 파일 1100+ 라인, mock 데이터 사용 | 구조 분리 + useEntityDetailQuery 연동 |
| **dashboard.tsx** | mock 전용 (mockKPIs, mockCases 등) | `GET /api/synapse/dashboard` API 연동 권장 |
| **autonomy.tsx** | API 없음, 정적 페이지 | 필요 시 대시보드 API 연동 |
| **governance.tsx** | API 없음 | Governance Config API 연동 검토 |
| **agent-config.tsx** | mock 텍스트만 | Agent Config API 연동 검토 |
| **integrations.tsx** | API 없음 | Integrations API 연동 검토 |
| **entities/index.tsx** | mock fallback 사용 | BE `/api/synapse/entities/parties` 완성 후 mock 제거 |
| **lineage/index.tsx** | mock fallback (mockLineageSteps, mockVendorMasterSnapshots) | BE lineage API 완성 후 mock 제거 |

---

## 2. 메뉴별 소스 구조

### 2.1 표준 구조를 준수하는 메뉴 (Phase 1~4)

#### Documents (원천 데이터·이력 허브)

```
pages/documents/
├── index.tsx                    # 라우트 엔트리 (조립)
├── types.ts                     # FiDocHeaderListItem 등
├── adapters/
│   └── document-detail-adapter.ts   # FiDocDetailRaw → DocumentDetailUi
├── components/
│   ├── documents-filter-bar.tsx
│   └── documents-kpi-strip.tsx
└── hooks/
    ├── use-documents-list.ts    # useDocumentsListQuery
    └── use-document-detail.ts   # useDocumentDetailQuery
```

#### Cases (자율 운영 센터)

```
pages/cases/
├── index.tsx                    # 라우트 엔트리
├── adapters/
│   ├── case-list-adapter.ts     # CaseListRowDto → UI
│   └── case-detail-adapter.ts   # CaseDetailDto → CaseDetailUi
└── hooks/
    ├── use-cases-list.ts        # useCasesListQuery
    └── use-case-detail.ts       # useCaseDetailQuery
```

#### Anomalies

```
pages/anomalies/
├── index.tsx
├── adapters/
│   └── anomaly-list-adapter.ts
└── hooks/
    └── use-anomalies-list.ts    # useAnomaliesListQuery, useCompanyCodeCatalogQuery
```

#### Actions

```
pages/actions/
├── index.tsx
├── adapters/
│   └── action-list-adapter.ts
├── components/
│   └── create-action-modal.tsx
└── hooks/
    └── use-actions-list.ts      # useActionsListQuery, useCasesListQuery
```

#### Archive

```
pages/archive/
├── index.tsx
├── adapters/
│   └── archive-list-adapter.ts
└── hooks/
    └── use-archive-list.ts     # useArchiveListQuery
```

#### RAG (지식·정책 허브)

```
pages/rag/
├── index.tsx
├── rag-detail.tsx
└── components/
    └── register-rag-document-modal.tsx
```

#### Policies

```
pages/policies/
├── index.tsx
├── policy-detail.tsx
```

#### Guardrails

```
pages/guardrails/
├── index.tsx
├── components/
│   ├── evaluate-panel.tsx
│   └── guardrail-editor-modal.tsx
```

#### Dictionary

```
pages/dictionary/
├── index.tsx
```

#### Feedback

```
pages/feedback/
├── index.tsx
```

#### Reconciliation (대사·감사 센터)

```
pages/reconciliation/
├── index.tsx
├── recon-run-detail.tsx
└── components/
    └── start-recon-modal.tsx
```

#### Admin (거버넌스·설정)

```
pages/admin-legacy.tsx           # 탭 컨테이너
pages/admin/
├── tenant-scope/
│   ├── index.tsx
│   ├── hooks/use-tenant-scope.ts
│   └── components/
│       ├── company-code-card.tsx
│       ├── currency-card.tsx
│       ├── sod-card.tsx
│       ├── catalog-add-dialog.tsx
│       ├── empty-state.tsx
│       ├── error-state.tsx
│       └── loading-skeleton.tsx
└── tabs/pii/
    ├── index.tsx
    ├── hooks/use-pii-tab.ts
    └── components/
        ├── data-protection-card.tsx
        ├── masking-policy-card.tsx
        ├── pii-field-row.tsx
        ├── pii-loading-skeleton.tsx
        └── pii-policy-sheet.tsx
```

### 2.2 단일 파일 또는 구조 단순 메뉴

| 메뉴 | 경로 | 구조 |
|------|------|------|
| Dashboard | `pages/dashboard.tsx` | 단일 파일, mock |
| Autonomy | `pages/autonomy.tsx` | 단일 파일 |
| Open Items | `pages/open-items/index.tsx` | index만 |
| Optimization | `pages/optimization.tsx` | 단일 파일 |
| Entities | `pages/entities/index.tsx` | index만 |
| Lineage | `pages/lineage/` | _components/, utils.ts, mock.ts |
| Action Recon | `pages/action-recon/index.tsx` | index만 |
| Audit | `pages/audit-legacy.tsx` | 단일 파일 |
| Analytics | `pages/analytics/index.tsx` | index만 |
| Governance | `pages/governance.tsx` | 단일 파일 |
| Agent Config | `pages/agent-config.tsx` | 단일 파일 |
| Integrations | `pages/integrations.tsx` | 단일 파일 |

---

## 3. 화면별 API 사용 현황

### 3.1 Phase 1 — Data & Trust (원천 데이터·이력 허브)

| 화면 | 경로 | 사용 API (Query/Mutation) | 백엔드 엔드포인트 | 비고 |
|------|------|---------------------------|-------------------|------|
| **Documents** | `/documents` | `useDocumentsListQuery`<br>`useCompanyCodeCatalogQuery` | `GET /api/synapse/entities/fi-doc-headers`<br>`GET /api/synapse/admin/tenant-scope/company-codes/catalog` | 필터: dateFrom, dateTo, bukrs, status |
| **Document Detail** | `/documents/:bukrs/:belnr/:gjahr` | `useDocumentDetailQuery` | `GET /api/synapse/entities/fi-doc-headers/{bukrs}/{belnr}/{gjahr}` | — |
| **Open Items** | `/open-items` | `useOpenItemsListQuery` | `GET /api/synapse/entities/fi-open-items` | limit, page, size |
| **Entities** | `/entities` | `useEntitiesListQuery` | `GET /api/synapse/entities/parties` | mock fallback 있음 |
| **Entity Detail** | `/entities/:id` | — (mock) | `GET /api/synapse/entities/parties/{partyId}` | useEntityDetailQuery 미연동 |
| **Lineage** | `/lineage` | `useLineageQuery` | `GET /api/synapse/lineage` | caseId, docKey, partyId, rawEventId, asOf. mock fallback 있음 |

### 3.2 Phase 2 — Operations (자율 운영 센터)

| 화면 | 경로 | 사용 API (Query/Mutation) | 백엔드 엔드포인트 | 비고 |
|------|------|---------------------------|-------------------|------|
| **Cases** | `/cases` | `useCasesListQuery` | `GET /api/synapse/cases` | status, severity, caseType, detectedFrom/To, page, size |
| **Case Detail** | `/cases/:id` | `useCaseDetailQuery`<br>`useUpdateCaseStatusMutation` | `GET /api/synapse/cases/{caseId}`<br>`POST /api/synapse/cases/{caseId}/status` | — |
| **Anomalies** | `/anomalies` | `useAnomaliesListQuery`<br>`useCompanyCodeCatalogQuery` | `GET /api/synapse/anomalies`<br>`GET .../company-codes/catalog` | severity, anomalyType, detectedFrom/To |
| **Actions** | `/actions` | `useActionsListQuery`<br>`useCasesListQuery`<br>`useCreateActionMutation`<br>`useApproveActionMutation`<br>`useExecuteActionMutation`<br>`useRejectActionMutation`<br>`useSimulateActionMutation` | `GET /api/synapse/actions`<br>`GET /api/synapse/cases`<br>`POST /api/synapse/actions`<br>`POST .../actions/{id}/approve`<br>`POST .../actions/{id}/execute`<br>`POST .../actions/{id}/reject`<br>`POST .../actions/{id}/simulate` | — |
| **Archive** | `/archive` | `useArchiveListQuery` | `GET /api/synapse/archive` | outcome, type, from, to |
| **Optimization** | `/optimization` | `useOpenItemsListQuery` | `GET /api/synapse/entities/fi-open-items` | Open Items API 재사용 |

### 3.3 Phase 3 — Knowledge & Policy (지식·정책 허브)

| 화면 | 경로 | 사용 API (Query/Mutation) | 백엔드 엔드포인트 | 비고 |
|------|------|---------------------------|-------------------|------|
| **RAG** | `/rag` | `useRagDocumentsQuery`<br>`useRagSearchQuery`<br>`useRegisterRagDocumentMutation` | `GET /api/synapse/rag/documents`<br>`GET /api/synapse/rag/search`<br>`POST /api/synapse/rag/documents` | status, page, size (docs); q (search) |
| **RAG Document Detail** | `/rag/:docId` | `useRagDocumentDetailQuery` | `GET /api/synapse/rag/documents/{docId}` | — |
| **Policies** | `/policies` | `usePolicyProfilesQuery` | `GET /api/synapse/policies/profiles` | — |
| **Policy Detail** | `/policies/:profileId` | `usePolicyProfileDetailQuery`<br>`useEffectivePolicyQuery` | `GET /api/synapse/policies/profiles/{profileId}`<br>`GET /api/synapse/policies/effective` | profileId, bukrs |
| **Guardrails** | `/guardrails` | `useGuardrailsQuery`<br>`useCreateGuardrailMutation`<br>`useUpdateGuardrailMutation`<br>`useDeleteGuardrailMutation`<br>`useEvaluateGuardrailMutation` | `GET /api/synapse/guardrails`<br>`POST /api/synapse/guardrails`<br>`PUT /api/synapse/guardrails/{id}`<br>`DELETE /api/synapse/guardrails/{id}`<br>`POST /api/synapse/guardrails/evaluate` | enabledOnly (GET) |
| **Dictionary** | `/dictionary` | `useDictionaryQuery`<br>`useCreateDictionaryTermMutation`<br>`useUpdateDictionaryTermMutation`<br>`useDeleteDictionaryTermMutation` | `GET /api/synapse/dictionary`<br>`POST /api/synapse/dictionary`<br>`PUT /api/synapse/dictionary/{termId}`<br>`DELETE /api/synapse/dictionary/{termId}` | category |
| **Feedback** | `/feedback` | `useFeedbackQuery`<br>`useCreateFeedbackMutation` | `GET /api/synapse/feedback`<br>`POST /api/synapse/feedback` | targetType, targetId |

### 3.4 Phase 4 — Reconciliation & Audit (대사·감사 센터)

| 화면 | 경로 | 사용 API (Query/Mutation) | 백엔드 엔드포인트 | 비고 |
|------|------|---------------------------|-------------------|------|
| **Reconciliation** | `/reconciliation` | `useReconRunsQuery`<br>`useStartReconRunMutation` | `GET /api/synapse/reconciliation/runs`<br>`POST /api/synapse/reconciliation/runs` | runType |
| **Recon Run Detail** | `/reconciliation/:runId` | `useReconRunDetailQuery` | `GET /api/synapse/reconciliation/runs/{runId}` | — |
| **Action Recon** | `/action-recon` | `useActionReconQuery` | `GET /api/synapse/action-recon` | — |
| **Audit** | `/audit` | `useSynapseAuditEventsQuery` | `GET /api/synapse/audit/events` | category, type, resourceType 등 |
| **Analytics** | `/analytics` | `useAnalyticsKpisQuery` | `GET /api/synapse/analytics/kpis` | from, to, bukrs, currency, dims |

### 3.5 Admin & Governance (거버넌스·설정)

| 화면 | 경로 | 사용 API (Query/Mutation) | 백엔드 엔드포인트 | 비고 |
|------|------|---------------------------|-------------------|------|
| **Admin (Legacy)** | `/admin` | `useAdminTenantsQuery`<br>`useAdminUsersQuery`<br>`useGovernanceConfigQuery`<br>`usePatchGovernanceConfigMutation` | `GET /api/admin/tenants`<br>`GET /api/admin/users`<br>`GET /api/synapse/admin/governance-config`<br>`PATCH /api/synapse/admin/governance-config/{key}` | appCode: SYNAPSEX |
| **Admin Tenant Scope** | (탭) | `useTenantScopeQuery`<br>`useAdminProfilesQuery`<br>`usePatchSodRuleMutation`<br>`useAddCurrenciesMutation`<br>`usePatchCurrencyMutation`<br>`useAddCompanyCodesMutation`<br>`usePatchCompanyCodeMutation`<br>`useCompanyCodeCatalogQuery`<br>`useCurrencyCatalogQuery` | `GET /api/synapse/admin/tenant-scope/company-codes`<br>`GET /api/synapse/admin/profiles`<br>`PATCH .../sod-rules`<br>`POST .../currencies/bulk`<br>`PATCH .../currencies`<br>`POST .../company-codes/bulk`<br>`PATCH .../company-codes`<br>`GET .../company-codes/catalog`<br>`GET .../currencies/catalog` | profileId 기반 |
| **Admin PII** | (탭) | `usePiiCatalogQuery`<br>`usePiiPoliciesQuery`<br>`useAdminProfilesQuery`<br>`useDataProtectionQuery`<br>`usePutDataProtectionMutation`<br>`usePutPiiPoliciesBulkMutation` | `GET /api/synapse/admin/pii/catalog`<br>`GET /api/synapse/admin/pii/policies`<br>`GET /api/synapse/admin/profiles`<br>`GET /api/synapse/admin/data-protection`<br>`PUT /api/synapse/admin/data-protection`<br>`PUT /api/synapse/admin/pii/policies/bulk` | — |

### 3.6 API 미연동 화면 (Mock 또는 정적)

| 화면 | 경로 | 데이터 소스 | 권장 |
|------|------|-------------|------|
| **Dashboard** | `/` | mockKPIs, mockCases, mockActions, mockRiskDrivers, mockTeamSnapshot, mockAgentActivity | `GET /api/synapse/dashboard` 추가 |
| **Autonomy** | `/autonomy` | 정적 | 필요 시 대시보드 API |
| **Entity Detail** | `/entities/:id` | mockCases, mockFiDocs, mockActions, mockEntities, mockOpenItems, mockEntityChangeLogs | useEntityDetailQuery 연동 |
| **Governance** | `/governance` | 정적 | Governance Config 연동 검토 |
| **Agent Config** | `/agent-config` | 정적(mock 텍스트) | Agent Config API |
| **Integrations** | `/integrations` | 정적 | Integrations API |

---

## 4. API 레이어 매핑 (libs/shared-utils)

| API 파일 | 담당 도메인 | Query 파일 |
|----------|-------------|------------|
| `synapse-data-api.ts` | Documents, Open Items, Entities, Lineage | `use-synapse-data-query.ts` |
| `synapse-operations-api.ts` | Cases, Anomalies, Actions, Archive | `use-synapse-operations-query.ts` |
| `synapse-knowledge-api.ts` | RAG, Policies, Guardrails, Dictionary, Feedback | `use-synapse-knowledge-query.ts` |
| `synapse-reporting-api.ts` | Reconciliation, Action Recon, Analytics | `use-synapse-reporting-query.ts` |
| `synapse-admin-api.ts` (barrel) | Admin Tenant Scope, PII, Governance, Audit | `use-tenant-scope-query.ts`, `use-pii-admin-query.ts`, `use-synapse-audit-query.ts` |

---

## 5. Tenant 처리

- **Header**: `X-Tenant-ID` (from `getTenantId()`)
- **Admin Tenant Override**: `setTenantIdOverride(id)` — Admin 페이지에서 테넌트 선택 시
- **Contract Test**: `yarn nx test shared-utils -- synapse-contract`

---

## 6. 관련 문서

- `[전달용]SCREEN_TO_ENDPOINT_MATRIX.md` — QA용 화면↔엔드포인트 매트릭스
- `[전달용]INCORRECT_INSTRUCTIONS_AND_MISSING_PARTS.md` — 스펙 불일치·누락
- `docs/essentials/PROJECT_RULES.md` — 핵심 규칙
- `docs/essentials/ADMIN_CRUD_STANDARD.md` — CRUD 표준 구조
