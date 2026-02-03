# Tenant Scope & Catalog API — FE 추가 확인/요청 사항

- **작성일**: 2026-02-02
- **참조**: `TENANT_SCOPE_AND_CATALOG_API_FE_HANDOVER.md`
- **대상**: 백엔드 팀

---

## 1. Catalog API 응답 구조 확인

**문서 2.1, 2.2**에 따르면 Catalog API 응답이 `CatalogDto` 형태입니다.

```json
{
  "companyCodes": [{ "bukrs": "1000", "docCount": 150, "lastSeenAt": "..." }],
  "currencies": []
}
```

**확인 요청**:
- `GET /api/synapse/admin/catalog/company-codes` 호출 시
  - **A)** `data`가 `{ companyCodes: [...], currencies: [] }` 전체 객체인가요?
  - **B)** `data`가 `companyCodes` 배열만 (`[...]`) 인가요?

- `GET /api/synapse/admin/catalog/currencies` 호출 시
  - **A)** `data`가 `{ companyCodes: [], currencies: [...] }` 전체 객체인가요?
  - **B)** `data`가 `currencies` 배열만 (`[...]`) 인가요?

FE는 현재 **(B)** 배열 직접 반환을 가정하고 있습니다. **(A)**인 경우 `data.companyCodes` / `data.currencies` 추출 로직으로 수정하겠습니다.

---

## 2. Catalog → Scope 추가: PATCH vs Bulk

**문서 1.2** PATCH는 기존 항목의 `enabled` 토글용으로 이해했습니다.

**확인 요청**:
- Catalog에는 있지만 **현재 tenant-scope에 없는** BUKRS/WAERS를 추가할 때
  - **A)** `PATCH .../company-codes/{bukrs}` with `{ enabled: true }` 로 신규 추가 가능한가요?
  - **B)** 반드시 `POST .../company-codes/bulk` (또는 currencies/sod-rules bulk) 를 사용해야 하나요?

FE는 현재 **(A)** 가정으로 Catalog Add 시 sequential PATCH를 사용 중입니다. **(B)**인 경우 Bulk API로 전환하겠습니다.

---

## 3. PATCH 응답 형식

**문서 1.2~1.4**: PATCH 응답이 `TenantScopeResponseDto` (전체 목록) 반환.

**확인 요청**:
- `ApiResponse<T>` 래핑 시 `data` 필드에 전체 `TenantScopeResponseDto`가 들어오나요?
- 예: `{ status: "SUCCESS", message: "...", data: { companyCodes: [...], currencies: [...], sodRules: [...], meta: {...} } }`

FE는 현재 성공 시 `invalidateQueries`로 refetch하여 최신 데이터를 가져옵니다. 응답 `data`에 전체 목록이 있으면 즉시 캐시 업데이트로 활용할 수 있습니다.

---

## 4. meta.tenantId 타입

**문서 1.1** 예시: `"tenantId": 1` (number)

FE 타입은 `tenantId: string`으로 정의되어 있습니다. `number | string` 모두 처리 가능하도록 수정 예정입니다.

---

## 5. (선택) 에러 응답 상세

**문서 6** 400/404/409 시 `message` 필드에 사용자에게 표시할 한글/영문 메시지가 포함되나요?  
FE는 `res.message`를 토스트에 그대로 노출합니다.

---

## 6. FE 구현 현황 (참고)

| 체크리스트 항목 | 상태 |
|----------------|------|
| GET tenant-scope 초기 로드 | ✅ |
| PATCH company-codes/{bukrs} 토글 | ✅ |
| PATCH currencies/{waers} 토글 | ✅ |
| PATCH sod-rules/{ruleKey} 토글 | ✅ |
| Catalog company-codes/currencies 조회 | ✅ (응답 구조 확인 후 수정 가능) |
| Catalog Add (Bulk 또는 PATCH) | ✅ (2번 확인 후 Bulk 전환 가능) |
| meta.lastUpdatedAt footer 표시 | 🔲 예정 (데이터 수신 확인 후 구현) |
| FI Document/Open Items Scope 적용 | 🔲 Admin 탭 외 별도 페이지 연동 예정 |

---

*문서 끝*
