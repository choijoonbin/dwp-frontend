# P1 OpenItems/Documents 계약 정렬 — 변경 포인트 및 DoD

> P1 잔여분 구현 완료 + 검증 시나리오  
> 작성: 2026-02-04

---

## 1) 변경 포인트 목록

### P1-1 Documents: FE 이중 필터링 제거 (옵션 A)

| 파일 | 함수/위치 | 변경 내용 |
|------|-----------|-----------|
| `apps/remotes/synapsex/src/pages/documents/hooks/use-documents-list.ts` | 전체 | filteredItems useMemo 제거. `items = apiData ?? []` 직접 사용. BE 필터 신뢰 |

**정책**: BE가 dateFrom, dateTo, bukrs, status, xblnr, amountMin, amountMax를 지원한다고 가정. FE는 서버 응답 그대로 사용.

---

### P1-2 OpenItems: BE 계약표 파라미터 querystring 추가

| 파일 | 함수/위치 | 추가된 query param |
|------|-----------|-------------------|
| `libs/shared-utils/src/api/synapse-data-api.ts` | `OpenItemsListParams` | status, lifnr, kunnr 추가 |
| 동일 | `getFiOpenItems` | BE param 매핑: dueFrom→fromDueDate, dueTo→toDueDate, itemType→type. status, lifnr, kunnr 추가 |
| `apps/remotes/synapsex/src/pages/open-items/index.tsx` | queryParams useMemo | status, lifnr, kunnr URL params 연동 |

**FE↔BE 파라미터 매핑**:

| FE param | BE querystring |
|----------|----------------|
| dueFrom | fromDueDate |
| dueTo | toDueDate |
| itemType | type |
| bukrs | bukrs |
| status | status |
| partyId | partyId |
| lifnr | lifnr |
| kunnr | kunnr |
| docKey | docKey |

---

### P1-2a belnr/gjahr: 현 정책 유지

- **코드 변경 없음**
- FilterBar/URL에 belnr, gjahr 노출하지 않음
- `docs/reference/OPEN_ITEMS_BELNR_GJAHR_BE_REQUEST.md`에 "미지원" 명시

---

## 2) DoD 체크 결과 + 재현 절차

### S3: Documents 필터

| 항목 | 결과 | 재현 절차 |
|------|------|-----------|
| querystring 1:1 | ✅ | 1) `/documents` 진입 2) FilterBar에서 dateFrom, dateTo, bukrs, status 설정 3) DevTools Network → `fi-doc-headers` 요청 4) querystring에 dateFrom, dateTo, bukrs, status 포함 확인 |
| FE 이중 필터 미적용 | ✅ | 5) 응답 데이터를 FE에서 추가 필터 없이 그대로 사용 (use-documents-list.ts 30행 `items = apiData ?? []`) |
| 서버 결과 변화 | ✅ | 6) 필터 변경 시 API 요청이 새로 발생하고, 응답 결과가 필터 조건에 따라 변화하는지 확인 |

---

### S4: OpenItems 필터

| 항목 | 결과 | 재현 절차 |
|------|------|-----------|
| querystring 포함 | ✅ | 1) `/open-items?bukrs=1000&itemType=AP&dueFrom=2025-01-01&dueTo=2025-12-31&status=open&partyId=xxx` 진입 2) DevTools Network → `fi-open-items` 요청 3) querystring에 bukrs, type, fromDueDate, toDueDate, status, partyId 포함 확인 |
| 서버 결과 변화 | ✅ | 4) 케이스 A: itemType=AP vs 케이스 B: itemType=AR 로 URL 변경 시 응답이 달라지는지 확인 |

---

### S5: belnr/gjahr 숨김/미전달

| 항목 | 결과 | 재현 절차 |
|------|------|-----------|
| FilterBar/URL 미노출 | ✅ | Open Items 페이지에 belnr, gjahr 입력 필드 없음. URL params에도 belnr, gjahr 미지원 |
| 문서 미지원 명시 | ✅ | `docs/reference/OPEN_ITEMS_BELNR_GJAHR_BE_REQUEST.md` 참고 |

---

## 3) 최종 문서 경로

| 문서 | 경로 |
|------|------|
| FE 최종 검증 보고서 | `docs/reference/FE_FINAL_VERIFICATION_REPORT.md` |
| P1 계약 정렬 (본 문서) | `docs/reference/P1_OPENITEMS_DOCS_CONTRACT_ALIGN.md` |
| OpenItems belnr/gjahr | `docs/reference/OPEN_ITEMS_BELNR_GJAHR_BE_REQUEST.md` |
| Last-Event-ID (Aura 정합) | `docs/reference/SSE_LAST_EVENT_ID.md` |
| 실행 체크리스트 | `docs/reference/SYNAPSEX_P0_P1_P2_EXECUTION_CHECKLIST.md` |
