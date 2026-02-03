# Synapse Screen-to-Endpoint Matrix (QA Reference)

> **Purpose**: QA verification checklist for screen ↔ backend API alignment.  
> **Tenant**: All Synapse APIs use `X-Tenant-ID` header (from `getTenantId()`).  
> **Last updated**: 2026-02-02
>
> **관련 문서**: 스펙 불일치·누락 사항은 `[전달용]INCORRECT_INSTRUCTIONS_AND_MISSING_PARTS.md` 참고

---

## 1. Route Params ↔ Backend Keys

| Screen | Route Pattern | Path Param | Backend Key | Notes |
|--------|---------------|------------|-------------|-------|
| Case Detail | `/synapse/cases/:id` | `id` | `caseId` | 1:1 |
| Document Detail | `/synapse/documents/:bukrs/:belnr/:gjahr` | `bukrs`, `belnr`, `gjahr` | Same | FI doc composite key |
| Entity Detail | `/synapse/entities/:id` | `id` | `partyId` or entity id | 1:1 |
| RAG Document Detail | `/synapse/rag/:docId` | `docId` | `docId` | 1:1 |
| Policy Profile Detail | `/synapse/policies/:profileId` | `profileId` | `profileId` | 1:1 |
| Recon Run Detail | `/synapse/reconciliation/:runId` | `runId` | `runId` | 1:1 |

---

## 2. Screen → Endpoint Mapping

### Data & Trust (Phase 1)

| Screen | Path | Primary Endpoint(s) | Query Params (FE → BE) | Mock Fallback |
|--------|------|---------------------|------------------------|---------------|
| Documents | `/documents` | `GET /api/synapse/entities/fi-doc-headers` | limit, page, size (BE); dateFrom, dateTo, bukrs, status (FE client-side) | No (API only) |
| Document Detail | `/documents/:bukrs/:belnr/:gjahr` | `GET /api/synapse/entities/fi-doc-headers/{bukrs}/{belnr}/{gjahr}` | — | Yes (use-document-detail) |
| Open Items | `/open-items` | `GET /api/synapse/entities/fi-open-items` | bukrs, belnr, gjahr, status, dateFrom, dateTo, page, size | No |
| Entities | `/entities` | `GET /api/synapse/entities/parties` | type, country, riskMin, page, size | Yes (mockEntities) |
| Entity Detail | `/entities/:id` | `GET /api/synapse/entities/parties/{partyId}` | — | Yes (full mock) |
| Lineage | `/lineage` | `GET /api/synapse/lineage` | docKey, bukrs, belnr, gjahr | Yes (mockLineageSteps) |

### Operations (Phase 2)

| Screen | Path | Primary Endpoint(s) | Query Params (FE → BE) | Mock Fallback |
|--------|------|---------------------|------------------------|---------------|
| Cases | `/cases` | `GET /api/synapse/cases` | status, severity, caseType, detectedFrom, detectedTo, bukrs, belnr, gjahr, buzei, partyId, page, size, sort | Yes (use-cases-list) |
| Case Detail | `/cases/:id` | `GET /api/synapse/cases/{caseId}`, `POST .../status` | — | Yes (use-case-detail) |
| Anomalies | `/anomalies` | `GET /api/synapse/anomalies` | severity, anomalyType, detectedFrom, detectedTo, page, size | Yes (use-anomalies-list) |
| Actions | `/actions` | `GET /api/synapse/actions`, `POST`, `POST .../approve`, `POST .../execute` | status, type, caseId, createdFrom, createdTo, page, size | Yes (use-actions-list) |
| Archive | `/archive` | `GET /api/synapse/archive` | outcome, type, from, to, page, size | Yes (use-archive-list) |

### Knowledge & Policy (Phase 3)

| Screen | Path | Primary Endpoint(s) | Query Params (FE → BE) | Mock Fallback |
|--------|------|---------------------|------------------------|---------------|
| RAG | `/rag` | `GET /api/synapse/rag/documents`, `GET .../search`, `POST .../documents` | status, page, size (docs); q, page, size (search) | No |
| RAG Document Detail | `/rag/:docId` | `GET /api/synapse/rag/documents/{docId}` | — | No |
| Policies | `/policies` | `GET /api/synapse/policies/profiles` | — | No |
| Policy Detail | `/policies/:profileId` | `GET /api/synapse/policies/profiles/{profileId}`, `GET .../effective` | profileId, bukrs (effective) | No |
| Guardrails | `/guardrails` | `GET/POST/PUT/DELETE /api/synapse/guardrails`, `POST .../evaluate` | enabledOnly (GET) | No |
| Dictionary | `/dictionary` | `GET/POST/PUT/DELETE /api/synapse/dictionary` | category | No |
| Feedback | `/feedback` | `GET/POST /api/synapse/feedback` | targetType, targetId | No |

### Reporting (Phase 4)

| Screen | Path | Primary Endpoint(s) | Query Params (FE → BE) | Mock Fallback |
|--------|------|---------------------|------------------------|---------------|
| Reconciliation | `/reconciliation` | `GET /api/synapse/reconciliation/runs`, `POST .../runs` | runType (GET) | No |
| Recon Run Detail | `/reconciliation/:runId` | `GET /api/synapse/reconciliation/runs/{runId}` | — | No |
| Action Recon | `/action-recon` | `GET /api/synapse/action-recon` | — | No |
| Analytics | `/analytics` | `GET /api/synapse/analytics/kpis` | from, to, bukrs, currency, dims | No |

---

## 3. Filter → Backend Query Param Mapping (1:1)

| Screen | UI Filter | Backend Param | Notes |
|--------|-----------|---------------|-------|
| Cases | status | status | ✓ |
| Cases | severity | severity | ✓ |
| Cases | caseType | caseType | ✓ |
| Cases | date range | detectedFrom, detectedTo | ISO8601 |
| Cases | bukrs, belnr, gjahr | bukrs, belnr, gjahr | ✓ |
| Anomalies | severity | severity | ✓ |
| Anomalies | anomalyType | anomalyType | ✓ |
| Anomalies | date range | detectedFrom, detectedTo | ✓ |
| Actions | status | status | ✓ |
| Actions | type | type | ✓ |
| Actions | caseId | caseId | ✓ |
| Archive | outcome | outcome | ✓ |
| Archive | type | type | ✓ |
| Archive | from, to | from, to | ✓ |
| Documents | bukrs, status, dateFrom, dateTo | limit, page, size → BE; dateFrom, dateTo, bukrs, status → FE filter | ✓ (FE client-side filter) |
| RAG Documents | status | status | ✓ |
| RAG Search | q | q | Required |
| Policies Effective | profileId, bukrs | profileId, bukrs | ✓ |
| Guardrails | enabledOnly | enabledOnly | ✓ |
| Dictionary | category | category | ✓ |
| Feedback | targetType, targetId | targetType, targetId | ✓ |
| Reconciliation Runs | runType | runType | ✓ |
| Analytics | from, to | from, to | ✓ |
| Analytics | bukrs | bukrs | ✓ (synapse-reporting-api) |
| Analytics | currency | currency | ✓ (synapse-reporting-api) |
| Analytics | dims | dims | ✓ (optional, for additional dimensions) |

---

## 4. Tenant Handling

- **Header**: `X-Tenant-ID` (from `getTenantId()`)
- **Default**: `'1'` (tenant-util.ts)
- **Override**: `setTenantIdOverride(id)` for admin tenant selector
- **Expected behavior**:
  - `tenant_id=1` (valid): Returns data or empty list
  - Invalid tenant: Empty list or `403 Forbidden` (policy-dependent)

---

## 5. Contract Test Scenarios

| Scenario | Request | Expected |
|----------|---------|----------|
| Valid tenant | `GET /api/synapse/cases` with `X-Tenant-ID: 1` | 200 + data or empty `content`/`items` |
| Invalid tenant (403) | `GET /api/synapse/cases` with `X-Tenant-ID: invalid` | 403 Forbidden |
| Invalid tenant (empty) | Same as above (if policy returns empty) | 200 + `[]` or `content: []` |
| Unauthenticated | No `Authorization` header | 401 Unauthorized |

**Contract test execution:**
```bash
yarn nx test shared-utils -- synapse-contract
```
Location: `libs/shared-utils/src/api/__tests__/synapse-contract.test.ts`

---

## 6. Screens with Mock-Only Data (No API)

| Screen | Data Source | Recommendation |
|--------|-------------|-----------------|
| Dashboard | mockKPIs, mockCases, mockActions, mockRiskDrivers, mockTeamSnapshot, mockAgentActivity | Add `GET /api/synapse/dashboard` or similar |
| Case Detail (extended) | mockConfidenceFactors, mockFieldChanges, mockDocumentRelationship, mockRAGCitations | Backend CaseDetailDto should include these |
| Document Detail (reversal chain) | mockFiDocs | Backend doc detail should include reversal refs |
| Entity Detail | mockEntities, mockEntityChangeLogs, mockFiDocs, mockOpenItems, mockCases, mockActions | Add entity 360 API |
| Lineage | mockLineageSteps, mockVendorMasterSnapshots | Backend lineage API |
| Optimization | mockEntities, mockOpenItems | Add optimization API |
| Audit (legacy) | mockAuditEvents | Use synapse audit API |
| Saved Views (Cases) | mockSavedViews | Add saved-views API or remove |
