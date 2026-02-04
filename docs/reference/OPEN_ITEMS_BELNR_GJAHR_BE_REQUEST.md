# Open Items belnr/gjahr 필터 — BE 미지원 및 요청안

> P1-2a. 현재 Open Items belnr(전표번호), gjahr(회계연도) 필터는 BE 미지원.

---

## 최종 계약표

| 파라미터 | FE 전달 | BE 지원 | UI 필터 정책 |
|----------|---------|---------|---------------|
| belnr | ❌ | **N (미지원)** | **숨김** — FilterBar/URL 미노출 |
| gjahr | ❌ | **N (미지원)** | **숨김** — FilterBar/URL 미노출 |

- **파일**: `libs/shared-utils/src/api/synapse-data-api.ts`
- **타입**: `OpenItemsListParams` — belnr, gjahr 미정의
- **API**: `getFiOpenItems` — belnr, gjahr querystring 미전달
- **DoD**: FilterBar/URL에 belnr, gjahr 노출되지 않음. 문서에 '미지원' 명시

---

## FE 대응

1. **문서화**: 본 문서에 "현재 belnr/gjahr 필터 BE 미지원" 명시
2. **UI 정책**: belnr, gjahr 필터는 **숨김** (FilterBar에 추가하지 않음). BE 지원 시 추가
3. **코드 주석**: `synapse-data-api.ts` getFiOpenItems 상단에 P1-2a 참조

---

## BE 요청안

**요청 문장**:

> `GET /api/synapse/entities/fi-open-items` parameters에 **belnr**(전표번호), **gjahr**(회계연도) 추가 요청합니다. FI 전표 단위 필터링에 필요합니다.

**OpenAPI 예시**:

```yaml
parameters:
  - name: belnr
    in: query
    schema: { type: string, description: "전표번호" }
  - name: gjahr
    in: query
    schema: { type: string, description: "회계연도 (예: 2025)" }
```

---

## BE 지원 시 FE 적용

1. `OpenItemsListParams`에 `belnr?: string`, `gjahr?: string` 추가
2. `getFiOpenItems`에 `if (params?.belnr) query.set('belnr', params.belnr)` 등 추가
3. Open Items 페이지 FilterBar에 belnr, gjahr 입력 필드 추가
