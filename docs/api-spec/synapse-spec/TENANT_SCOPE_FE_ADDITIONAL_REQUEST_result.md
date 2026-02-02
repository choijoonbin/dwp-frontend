# Tenant Scope & Catalog API — FE 추가 확인 요청 응답

> **작성일**: 2026-02-02  
> **요청 문서**: `TENANT_SCOPE_FE_ADDITIONAL_REQUEST.md`  
> **참조**: `TENANT_SCOPE_AND_CATALOG_API_FE_HANDOVER.md`

---

## 1. Catalog API 응답 구조

**답변: (A) — `data`에 전체 `CatalogDto` 객체가 들어갑니다.**

| API | data 구조 |
|-----|-----------|
| `GET /api/synapse/admin/catalog/company-codes` | `{ companyCodes: [...], currencies: [] }` |
| `GET /api/synapse/admin/catalog/currencies` | `{ companyCodes: [], currencies: [...] }` |

FE는 `data.companyCodes` / `data.currencies`로 추출하면 됩니다.

```json
// GET /catalog/company-codes 응답 예시
{
  "status": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": {
    "companyCodes": [
      { "bukrs": "1000", "docCount": 150, "lastSeenAt": "2026-02-02T10:00:00Z" }
    ],
    "currencies": []
  },
  "success": true
}
```

---

## 2. Catalog → Scope 추가: PATCH vs Bulk

**답변: (A) — PATCH로 신규 추가 가능합니다.**

Catalog에는 있지만 tenant-scope에 없는 BUKRS/WAERS를 **PATCH로 추가**할 수 있습니다.

- `PATCH .../company-codes/{bukrs}` with `{ "enabled": true }` → 없으면 **자동 생성** 후 enabled=true
- `PATCH .../currencies/{waers}` with `{ "enabled": true }` → 동일

BE 구현: `findByTenantIdAndBukrs(...).orElseGet(() -> { /* 신규 생성 */ })` 패턴으로, 없을 경우 새 행을 생성합니다.

**FE는 현재 (A) 가정대로 PATCH 사용을 유지해도 됩니다.** Bulk는 여러 항목을 한 번에 업데이트할 때 사용하면 됩니다.

---

## 3. PATCH 응답 형식

**답변: 예 — `data`에 전체 `TenantScopeResponseDto`가 들어갑니다.**

```json
{
  "status": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": {
    "companyCodes": [...],
    "currencies": [...],
    "sodRules": [...],
    "meta": {
      "tenantId": 1,
      "lastUpdatedAt": "2026-02-02T18:00:00Z",
      "seeded": true
    }
  },
  "success": true
}
```

`invalidateQueries` 대신 응답 `data`를 바로 캐시에 반영해도 됩니다.

---

## 4. meta.tenantId 타입

**답변: BE는 `number`(Long)로 반환합니다.**

JSON 예: `"tenantId": 1`

FE에서 `number | string` 모두 처리하도록 하시면 됩니다.

---

## 5. 에러 응답 상세

**답변: 예 — `message` 필드에 사용자 표시용 메시지가 포함됩니다.**

| 상황 | message 예시 |
|------|--------------|
| BaseException (404, 400 등) | `"프로파일을 찾을 수 없습니다."`, `"bukrs는 4자리 대문자 영숫자여야 합니다"` |
| @Valid 검증 실패 | `"입력값 검증에 실패했습니다."` |
| 파라미터 타입 오류 | `"파라미터 'profileId'의 타입이 올바르지 않습니다."` |

`res.message`를 토스트에 그대로 노출해도 됩니다.  
추가로 `res.errorCode`(예: E3000, E4003)로 분기 처리할 수 있습니다.

---

## 6. 요약

| 문항 | 답변 |
|------|------|
| 1. Catalog 응답 | **(A)** `data` = 전체 CatalogDto → `data.companyCodes` / `data.currencies` 사용 |
| 2. Catalog Add | **(A)** PATCH `{ enabled: true }`로 신규 추가 가능 |
| 3. PATCH 응답 | `data`에 전체 TenantScopeResponseDto 포함 |
| 4. meta.tenantId | `number` (Long) |
| 5. 에러 message | 사용자 표시용 한글/영문 메시지 포함 |

---

*문서 끝*
