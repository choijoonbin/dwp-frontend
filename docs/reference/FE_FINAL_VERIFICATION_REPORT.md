# FE 최종 검증 보고서

> DWP/SynapseX FE — P0/P1 완료 확정 + 검증 시나리오  
> 작성: 2026-02-04

---

## (A) P0 완료 상태

### 1) SSE X-User-ID

| 항목 | 내용 |
|------|------|
| **상태** | ✅ **완료** |
| **코드** | `libs/shared-utils/src/agent/use-synapse-agent-stream.ts` 101행, 118행 |
| **정책** | X-User-ID 존재 시 전송. Aura: 있으면 JWT sub 일치 검증 |

### 2) Lineage mock 차단 + error/empty 분기

| 항목 | 내용 |
|------|------|
| **상태** | ✅ **완료** |
| **코드** | `apps/remotes/synapsex/src/pages/lineage/index.tsx` 50, 51~63, 88~98, 100~125행 |
| **정책** | error → ErrorStateWithRetry. !lineageParams → Empty. mock 제거 |

---

## (B) P1 완료 상태

### 3) Documents 이중 필터링 제거 (옵션 A)

| 항목 | 내용 |
|------|------|
| **상태** | ✅ **완료** |
| **코드** | `apps/remotes/synapsex/src/pages/documents/hooks/use-documents-list.ts` — filteredItems 제거, apiData 직접 사용 |
| **정책** | BE 필터 신뢰. querystring(dateFrom, dateTo, bukrs, status 등)과 서버 응답 1:1 |

### 4) OpenItems BE 계약표 파라미터 전달

| 항목 | 내용 |
|------|------|
| **상태** | ✅ **완료** |
| **코드** | `libs/shared-utils/src/api/synapse-data-api.ts` getFiOpenItems — bukrs, type, status, fromDueDate, toDueDate, partyId, lifnr, kunnr |
| **매핑** | dueFrom→fromDueDate, dueTo→toDueDate, itemType→type |

### 5) belnr/gjahr 숨김 유지

| 항목 | 내용 |
|------|------|
| **상태** | ✅ **완료** |
| **정책** | FilterBar/URL 미노출. `docs/reference/OPEN_ITEMS_BELNR_GJAHR_BE_REQUEST.md` |

### 6) Last-Event-ID Aura 계약 정합

| 항목 | 내용 |
|------|------|
| **상태** | ✅ **완료** |
| **정책** | replay 미지원, id 연속만. `docs/reference/SSE_LAST_EVENT_ID.md` |

---

## (C) 검증 시나리오

### S3: Documents 필터

1. `/documents` 진입
2. FilterBar에서 dateFrom, dateTo, bukrs, statusCode(또는 status) 설정
3. DevTools Network → `fi-doc-headers` 요청
4. **기대**: querystring에 dateFrom, dateTo, bukrs, status 포함
5. **기대**: 서버 응답 그대로 사용, FE 이중 필터 미적용

### S4: OpenItems 필터

1. `/open-items?bukrs=1000&itemType=AP&dueFrom=2025-01-01&dueTo=2025-12-31&status=open&partyId=xxx` 진입
2. DevTools Network → `fi-open-items` 요청
3. **기대**: querystring에 bukrs, type, fromDueDate, toDueDate, status, partyId 포함
4. **기대**: 필터 변경 시 서버 응답 변화 (최소 2케이스: itemType=AP vs AR)

### S5: belnr/gjahr 숨김

1. Open Items 페이지 확인
2. **기대**: FilterBar/URL에 belnr, gjahr 노출되지 않음
3. **기대**: 문서에 "미지원" 명시

---

## (D) 문서 링크

| 문서 | 경로 |
|------|------|
| 본 보고서 | `docs/reference/FE_FINAL_VERIFICATION_REPORT.md` |
| P1 변경 포인트/DoD | `docs/reference/P1_OPENITEMS_DOCS_CONTRACT_ALIGN.md` |
| OpenItems belnr/gjahr | `docs/reference/OPEN_ITEMS_BELNR_GJAHR_BE_REQUEST.md` |
| Last-Event-ID | `docs/reference/SSE_LAST_EVENT_ID.md` |
| 실행 체크리스트 | `docs/reference/SYNAPSEX_P0_P1_P2_EXECUTION_CHECKLIST.md` |

---

## 결론

P0 2개, P1 잔여분( Documents 이중 필터 제거, OpenItems BE 계약 파라미터 전달, belnr/gjahr 숨김, Last-Event-ID Aura 정합) **완료**. 팀 공유 가능.
