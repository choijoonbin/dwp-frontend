# SynapseX 운영형 UX 마감 진행상황

> **목표**: 모든 메뉴 클릭 시 404/빈화면 없음. 실제 API 연동 상태에서 엔터프라이즈급 UX 보장.  
> **점검일**: 2026-02-02

---

## 1. 전 화면 공통

### 1.1 Loading / Empty / Error / Retry 통일

| 항목 | 상태 | 비고 |
|------|------|------|
| **ErrorStateWithRetry** | ✅ | `components/ux/error-state-with-retry.tsx` |
| **is403Error** | ✅ | 403 시 "권한 부족/가드레일 위반" 표기 |
| **적용 페이지** | ✅ | Cases, Archive, Anomalies, Documents, Action-recon, Actions, Case Detail |
| **TableLoadingSkeleton** | ✅ | `components/ux/table-loading-skeleton.tsx` |
| **Empty State** | ⚠️ | 페이지별 개별 구현 (테이블 empty row) |

### 1.2 Table: pagination/sort/filter/search/saved views

| 페이지 | pagination | sort | filter | search | saved views |
|--------|-------------|------|--------|--------|-------------|
| Cases | ✅ | ✅ | ✅ | ✅ | ✅ |
| Anomalies | ⚠️ | ⚠️ | ✅ | ✅ | ❌ |
| Actions | ✅ | ⚠️ | ✅ | ✅ | ❌ |
| Archive | ⚠️ | ⚠️ | ✅ | ✅ | ❌ |
| Documents | ✅ | ⚠️ | ✅ | ✅ | ❌ |
| 기타 | 페이지별 | | | | |

### 1.3 Tenant switch 시 cache

| 항목 | 상태 |
|------|------|
| **queryKey에 tenantId 포함** | ✅ 모든 Synapse query (use-synapse-*, use-tenant-scope-* 등) |
| **cross-tenant 캐시 오염 방지** | ✅ |

---

## 2. Case Detail 3-Panel 마감

| 영역 | 상태 | 비고 |
|------|------|------|
| **Left (원천)** | ✅ | FI Document → documents/:bukrs/:belnr/:gjahr deep-link |
| | ✅ | Vendor → entities/:partyId deep-link |
| | ✅ | Related Open Items → open-items?caseId= deep-link |
| | ✅ | View Data Lineage → lineage?caseId= |
| **Center (근거)** | ✅ | AI Analysis, Agent Stream, Confidence, Similar 탭 |
| | ✅ | RAG citations, evidence, lineage CTA |
| **Right (조치)** | ✅ | Simulation diff viewer, approve/reject, comment timeline |
| **Error 처리** | ✅ | ErrorStateWithRetry + refetch |

---

## 3. Action Center 마감

| 항목 | 상태 |
|------|------|
| **simulate → approve → execute 단계 표시** | ✅ "Step 1: Simulate → Step 2: Approve → Step 3: Execute" |
| **중복 클릭 방지** | ✅ isDrawerActionPending 시 버튼 disable |
| **CircularProgress** | ✅ pending 시 버튼 내 로딩 표시 |
| **실패 시 toast** | ✅ mutation onError → showToast |
| **auditId 링크** | ⚠️ BE 응답에 auditId 포함 시 추가 가능 |

---

## 4. PII/권한 기반 UI

| 항목 | 상태 |
|------|------|
| **PiiFieldDisplay** | ✅ handling=MASK/HASH_ONLY/ENCRYPT/FORBID |
| **Entity detail** | ✅ piiMasked 시 MASK 적용 |
| **PermissionGate** | ✅ Actions 등 권한 없는 버튼 숨김 |
| **403 표기** | ✅ "권한 부족/가드레일 위반" (ErrorStateWithRetry is403) |

---

## 5. Observability

| 항목 | 상태 |
|------|------|
| **DevErrorPanel** | ✅ synapse-app.tsx에 마운트 |
| **registerDevErrorReporter** | ✅ axios-instance에서 4xx/5xx 시 reportDevErrorToReporter 호출 |
| **표시 내용** | endpoint, method, params, tenantId, status, message |
| **gateway_request_id/trace_id** | ⚠️ BE 응답 헤더에 포함 시 axios interceptor에서 추출 가능 |

---

## 6. 미완성/보완 항목

1. **saved views**: Cases 외 다른 리스트에 확장
2. **column chooser**: Cases 외 다른 리스트에 확장
3. **gateway_request_id**: BE가 헤더로 전달 시 DevErrorPanel에 표시
4. **auditId 링크**: Action 실패 시 BE가 auditId 반환 시 링크 추가
