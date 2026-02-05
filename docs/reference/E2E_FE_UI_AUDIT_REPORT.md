# E2E 관련 메뉴 전수 검사 보고서

> 작성일: 2026-02-02  
> 근거: E2E_Test_30pct_Review_Followups.txt, synapse-verify.spec.ts, 코드베이스 전수 검사

---

## 1. 요약

| 구분 | 건수 | 비고 |
|------|------|------|
| **동작 누락** | 2 | Entity Detail API 미연동, Audit API fallback 시 mock |
| **하드코딩/ Mock 데이터** | 12+ | Case Detail, Entity Detail, Lineage, Audit 등 |
| **API 데이터 바인딩 미흡** | 2 | Case List amount(수정 완료), Case Type 라벨 |
| **BE 의존 이슈** | 3 | evidence_json, amount, dedup_key |

---

## 2. 메뉴별 상세

### 2.1 케이스 작업함 (Cases) — `/synapse/cases`

| 항목 | 상태 | 상세 |
|------|------|------|
| **Amount $0** | ✅ 수정 | `case-list-adapter.ts`: `amount: 0` 하드코딩 → `dto.amount ?? 0` 사용. BE가 `amount` 반환 시 표시됨 |
| **API 연동** | ✅ | `useCasesListQuery` → `getCases()` |
| **case_type 라벨** | ⚠️ | DUPLICATE_INVOICE 등 코드값 그대로 표시. 코드 관리(menu.admin.codes) 연계 권장 |
| **currency** | ✅ 수정 | `currency: 'USD'` → `dto.currency ?? 'USD'` |

### 2.2 케이스 상세 (Case Detail) — `/synapse/cases/:id`

| 항목 | 상태 | 상세 |
|------|------|------|
| **Comments** | ❌ Mock | `extendedComments` 하드코딩. API 없음 |
| **Confidence Factors** | ❌ Mock | `mockConfidenceFactors` |
| **Document Relationship** | ❌ Mock | `mockDocumentRelationship` |
| **Simulation** | ⚠️ Fallback | `useCaseSimulation` API 연동. 실패 시 `mockSimulationResult` 사용 |
| **Field Changes** | ❌ Mock | `mockFieldChanges` |
| **RAG Citations** | ❌ 빈 배열 | `emptyRagCitations` — API 미제공 |
| **Amount** | ⚠️ BE 의존 | `evidence.documentOrOpenItem.amount`. evidence_json NULL 시 0 |
| **pathname-to-page id** | ✅ 수정 | useParams 미동작 → pathname 파싱으로 id 추출 (이전 세션 수정) |

### 2.3 조치 실행 센터 (Actions) — `/synapse/actions`

| 항목 | 상태 | 상세 |
|------|------|------|
| **API 연동** | ✅ | `useActionsList`, Simulate/Approve/Execute/Reject mutation |
| **actionTypes** | ⚠️ 하드코딩 | `post_reversal`, `block_payment` 등 — 코드 관리 연계 권장 |
| **statuses/riskLevels** | ⚠️ 하드코딩 | UI 필터용. BE enum과 일치 확인 필요 |

### 2.4 문서 (Documents) — `/synapse/documents`

| 항목 | 상태 | 상세 |
|------|------|------|
| **API 연동** | ✅ | `useDocumentsListQuery`, BE 필터 신뢰(이중 필터 제거 완료) |
| **Mock** | 없음 | API 전용 |

### 2.5 미결 항목 (Open Items) — `/synapse/open-items`

| 항목 | 상태 | 상세 |
|------|------|------|
| **API 연동** | ✅ | `useOpenItemsListQuery`, bukrs/type/status/dueFrom/dueTo 등 |
| **belnr/gjahr** | 숨김 | BE 미지원. `OPEN_ITEMS_BELNR_GJAHR_BE_REQUEST.md` |

### 2.6 이상 탐지 (Anomalies) — `/synapse/anomalies`

| 항목 | 상태 | 상세 |
|------|------|------|
| **API 연동** | ✅ | `useAnomaliesListQuery` |
| **Mock fallback** | 없음 | API 전용 |

### 2.7 데이터 계보 (Lineage) — `/synapse/lineage`

| 항목 | 상태 | 상세 |
|------|------|------|
| **Steps** | ✅ | `useLineageQuery` → API steps 사용. error 시 ErrorStateWithRetry |
| **Time-Travel** | ❌ Mock | `mockVendorMasterSnapshots` — transaction/current 스냅샷 하드코딩 |
| **changedFields** | ❌ Mock | mockVendorMasterSnapshots 기반 |
| **Empty params** | ✅ | caseId/docKey/partyId 없으면 Empty 안내 |

### 2.8 거래처 (Entities) — `/synapse/entities`

| 항목 | 상태 | 상세 |
|------|------|------|
| **목록** | ⚠️ Mock fallback | API 빈 배열 시 `mockEntities` 표시 |
| **상세 (Entity Detail)** | ❌ 전부 Mock | `mockEntities`, `mockFiDocs`, `mockActions`, `mockEntityChangeLogs` 등. **API 미연동** |
| **Entity 360 API** | 없음 | BE `GET /api/synapse/entities/parties/{partyId}` 등 필요 |

### 2.9 감사 추적 (Audit) — `/synapse/audit`

| 항목 | 상태 | 상세 |
|------|------|------|
| **API 연동** | ⚠️ 조건부 | `apiParams` 있을 때만 `useSynapseAuditEventsQuery` 호출 |
| **Fallback** | ❌ Mock | API 파라미터 없거나 items 빈 배열 시 `extendedAuditEvents`(mockAuditEvents 기반) 표시 |
| **eventTypes** | 하드코딩 | action_approved, case_created 등 — BE eventType과 매핑 확인 필요 |

### 2.10 대시보드 (Dashboard) — `/synapse`

| 항목 | 상태 | 상세 |
|------|------|------|
| **KPI/Summary** | ✅ | `useDashboardSummaryQuery` 등 API 연동 |
| **Agent Execution Stream** | ❌ Mock | "API 미제공" 주석. 실제 스트림 UI 없음 |
| **CASE_TYPE 라벨** | 하드코딩 | `dashboard-adapter.ts` CASE_TYPE_LABEL_MAP |

### 2.11 정책 (Policies) — `/synapse/policies`

| 항목 | 상태 | 상세 |
|------|------|------|
| **API 연동** | 확인 필요 | `usePoliciesListQuery` 등 |
| **Mock** | mockPolicies | mock-data.ts에 존재. 실제 사용 여부 확인 |

### 2.12 가드레일 (Guardrails) — `/synapse/guardrails`

| 항목 | 상태 | 상세 |
|------|------|------|
| **CASE_TYPES** | 하드코딩 | PAYMENT, REVERSAL, BLOCK 등 — evaluate-panel |

### 2.13 대사 (Reconciliation) — `/synapse/reconciliation`

| 항목 | 상태 | 상세 |
|------|------|------|
| **API 연동** | 확인 필요 | Run 목록, 상세 등 |
| **Mock** | 없음(추정) | |

### 2.14 Admin (Governance) — `/synapse/admin`

| 항목 | 상태 | 상세 |
|------|------|------|
| **Tenant Scope** | ✅ | useTenantScope, API 연동 |
| **PII Tab** | ✅ | usePiiTab, API 연동 |

### 2.15 최적화 (Optimization) — `/synapse/optimization`

| 항목 | 상태 | 상세 |
|------|------|------|
| **Recommendations** | ❌ Mock | "Recommendations are mocked" 주석 |

### 2.16 Agent Config — `/synapse/agent-config`

| 항목 | 상태 | 상세 |
|------|------|------|
| **Template** | Mock | "Template (mock)" |

---

## 3. BE 의존 사항 (E2E 100% 달성용)

| 항목 | 요청 내용 |
|------|----------|
| **agent_case.amount** | denormalized amount 컬럼 또는 evidence_json에 amount/currency 포함 |
| **agent_case.evidence_json** | documentOrOpenItem에 amount, currency, counterparty 등 채우기 |
| **agent_case.dedup_key, last_detect_run_id** | Upsert 검증용 필수 |
| **Entity 360 API** | `GET /api/synapse/entities/parties/{id}` 또는 유사 API |
| **Lineage Time-Travel** | transaction/current 스냅샷 API (또는 steps 내 포함) |
| **Case Comments API** | 댓글 CRUD (현재 없음) |
| **Audit eventType** | BE eventType과 FE 필터 매핑 정합 |

---

## 4. FE 수정 완료 항목

| 항목 | 파일 | 변경 |
|------|------|------|
| Case List amount | `case-list-adapter.ts` | `dto.amount ?? 0`, `dto.currency ?? 'USD'` |
| Case Detail pathname id | `case-detail.tsx` | pathname 파싱으로 id 추출 (pathname-to-page 대응) |
| StatusPill unknown status | `status-pill.tsx` | defaultConfig, triaged 추가 |
| Cancel Reconnecting | `use-synapse-agent-stream.ts` | setIsReconnecting(false) |

---

## 5. 권장 액션 (우선순위)

1. **P0**: Entity Detail — API 연동 또는 "준비 중" 안내
2. **P0**: Audit — API 파라미터 없을 때 Empty State (mock 대신)
3. **P1**: Case Detail — Comments/Confidence/Relationship 등 API 또는 제거
4. **P1**: Lineage Time-Travel — API 또는 섹션 비활성화
5. **P1**: case_type/actionType — 코드 관리(useCodesByResourceQuery) 연동
6. **P2**: Optimization, Agent Config mock 제거 또는 "Preview" 라벨
