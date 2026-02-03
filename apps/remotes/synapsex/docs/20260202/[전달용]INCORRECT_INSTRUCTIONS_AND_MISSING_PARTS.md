# Synapse 검증 작업 — 잘못된 지시사항 및 누락된 부분

> **작성일**: 2026-02-02  
> **목적**: "Verify screens against real data" 작업 수행 중 발견한 잘못된 가정, 스펙 불일치, 미구현 항목 정리

---

## 1. 잘못된 지시사항 / 스펙 불일치

### 1.1 Documents API — BE로 전달되는 필터 파라미터

| 항목 | 기대(스펙/매트릭스) | 실제 구현 | 조치 |
|------|---------------------|-----------|------|
| Query params | limit, dateFrom, dateTo, bukrs, status, hasReversal, usnam, page, size | **limit, page, size만** BE 전달 | FE에서 dateFrom, dateTo, bukrs, status는 **클라이언트 필터**로만 적용. BE가 해당 파라미터를 지원하면 API 확장 필요 |

**근거**: `synapse-data-api.ts` getFiDocHeaders 주석 — "현재: limit만 지원. 필터는 FE에서 적용 또는 BE 확장 후 사용"

---

### 1.2 Open Items API — BE로 전달되는 필터 파라미터

| 항목 | 기대(매트릭스) | 실제 구현 | 조치 |
|------|----------------|-----------|------|
| Query params | bukrs, belnr, gjahr, status, dateFrom, dateTo, page, size | **limit, page, size만** BE 전달 | OpenItemsListParams에 dueFrom, dueTo, bukrs, partyId 등 타입은 있으나 **쿼리에 미반영**. Open Items 화면에는 **필터 UI 없음** (limit: 200 고정) |

**근거**: `synapse-data-api.ts` getFiOpenItems, `open-items/index.tsx` — limit만 사용

---

### 1.3 Lineage API — 파라미터 불일치

| 항목 | 매트릭스 기재 | 실제 API | 조치 |
|------|---------------|----------|------|
| Query params | docKey, bukrs, belnr, gjahr | **caseId, docKey, rawEventId, partyId, asOf** | 매트릭스 수정 필요. bukrs/belnr/gjahr는 docKey 파싱으로 전달 가능한지 BE 확인 |

**근거**: `synapse-data-api.ts` getLineage — LineageParams 타입 및 구현

---

### 1.4 Entities API — riskLevel, highExposure 미전달

| 항목 | 매트릭스 기재 | 실제 구현 | 조치 |
|------|---------------|-----------|------|
| Query params | type, country, riskMin, page, size | **type, page, size만** BE 전달 | EntitiesListParams에 riskLevel, highExposure 타입 있으나 쿼리 미반영. country, riskMin은 타입에도 없음 |

**근거**: `synapse-data-api.ts` getEntities — type, page, size만 사용

---

### 1.5 Contract Test — "실제 데이터 반환" 검증 범위

| 항목 | 기대 | 실제 | 조치 |
|------|------|------|------|
| tenant_id=1 요청 시 데이터 반환 | 실제 BE 호출로 데이터 수신 검증 | **fetch mock**으로 요청 구조만 검증 | 실제 BE 연동 검증은 E2E 또는 통합 테스트로 별도 수행 필요 |

---

## 2. 누락된 부분

### 2.1 Mock 미대체 — API 존재하나 UI에서 mock 사용

| 화면 | 사용처 | 권장 조치 |
|------|--------|-----------|
| **Actions** | `mockCases` — Create Action 모달의 caseId 드롭다운, 관련 케이스 표시 | `useCasesListQuery` 또는 `getCases`로 케이스 목록 로드 후 사용 |
| **Cases** | `mockSavedViews` — Saved Views 드롭다운 | Saved Views API 추가 또는 기능 제거 |
| **Case Detail** | `mockCases` — Similar Cases 섹션 | CaseDetailDto에 similarCases 포함 요청 또는 별도 API |

---

### 2.2 Mock 미대체 — API 없음 (BE 작업 필요)

| 화면 | Mock 데이터 | 권장 조치 |
|------|-------------|-----------|
| Dashboard | mockKPIs, mockCases, mockActions, mockRiskDrivers, mockTeamSnapshot, mockAgentActivity | `GET /api/synapse/dashboard` 또는 개별 KPI/액티비티 API |
| Entity Detail | mockEntities, mockEntityChangeLogs, mockFiDocs, mockOpenItems, mockCases, mockActions | Entity 360 통합 API |
| Lineage | mockLineageSteps, mockVendorMasterSnapshots | Lineage API 응답 확장 또는 별도 스냅샷 API |
| Optimization | mockEntities, mockOpenItems | Optimization API |
| Audit (legacy) | mockAuditEvents | Synapse Audit API 연동 |

---

### 2.3 필터 → BE 파라미터 매핑 미구현

| 화면 | UI 필터 | BE 파라미터 | 상태 |
|------|---------|-------------|------|
| Documents | dateFrom, dateTo, bukrs, status, hasReversal, usnam | — | FE 클라이언트 필터만 적용 |
| Open Items | dueFrom, dueTo, bukrs, partyId, itemType, cleared | — | API에 미전달 (타입만 존재) |

---

### 2.4 Analytics dims 파라미터

| 항목 | 내용 | 조치 |
|------|------|------|
| dims | BE 스펙에 dims 언급, bukrs/currency 지원 여부 불명확 | synapse-reporting-api는 bukrs, currency 전달. BE 팀에 dims vs bukrs/currency 정책 확인 요청 |

---

### 2.5 Route Param ↔ Backend Key 검증

| 화면 | Path Param | Backend Key | 검증 상태 |
|------|------------|------------|-----------|
| Case Detail | `:id` | caseId | Adapter에서 id → caseId 매핑 확인 필요 |
| Entity Detail | `:id` | partyId | 1:1 사용 가정, BE 스펙 확인 |

---

## 3. 권장 후속 작업

1. **BE 스펙 확인**: fi-doc-headers, fi-open-items, entities/parties의 실제 지원 쿼리 파라미터 목록 확보
2. **Actions mockCases 제거**: useCasesListQuery로 케이스 목록 로드 후 Create Action 모달에 적용
3. **Saved Views**: API 추가 또는 UI에서 제거 결정
4. **Contract Test 확장**: 실제 BE 연동 시나리오는 E2E/통합 테스트로 분리
5. **[전달용]SCREEN_TO_ENDPOINT_MATRIX.md**: Open Items, Lineage, Entities 파라미터 기재 수정
