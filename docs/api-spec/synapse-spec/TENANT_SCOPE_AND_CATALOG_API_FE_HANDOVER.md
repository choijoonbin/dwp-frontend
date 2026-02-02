# Tenant Scope & Catalog API — 프론트엔드 전달 문서

- **작성일**: 2026-02-02
- **대상**: SynapseX Admin — Tenant Scope 탭, Catalog, SoD, FI Document 조회
- **Base Path**: Gateway 경유 `/api/synapse/**` → synapsex-service

---

## 0. 공통 사항

| 항목 | 내용 |
|------|------|
| **Base URL** | `http://localhost:8080/api/synapse` (Gateway) |
| **X-Tenant-ID** | 필수 (BIGINT) |
| **X-User-ID** | 선택 (감사 로그용) |
| **Response** | `ApiResponse<T>` — `{ status, message, data, success, timestamp }` |
| **성공 시** | `data: { success: true }` 또는 payload 포함 (Admin 성공 응답 계약 준수) |

---

## 1. Tenant Scope APIs

Tenant Scope 탭: Company Codes, Currencies, SoD Rules 카드.

### 1.1 전체 조회 — `GET /api/synapse/admin/tenant-scope`

**용도**: Tenant Scope 탭 초기 로드. 비어있으면 BE가 idempotent 시드 후 반환.

**Headers**: `X-Tenant-ID` 필수

**Response (data)** — `TenantScopeResponseDto`

```json
{
  "companyCodes": [
    { "bukrs": "1000", "enabled": true, "source": "SEED" },
    { "bukrs": "2000", "enabled": false, "source": "MANUAL" }
  ],
  "currencies": [
    { "waers": "KRW", "enabled": true, "fxControlMode": "ALLOW" },
    { "waers": "USD", "enabled": true, "fxControlMode": "FX_REQUIRED" }
  ],
  "sodRules": [
    {
      "ruleKey": "NO_SELF_APPROVE",
      "title": "Requester cannot approve own action",
      "description": null,
      "enabled": true,
      "severity": "WARN",
      "appliesTo": []
    }
  ],
  "meta": {
    "tenantId": 1,
    "lastUpdatedAt": "2026-02-02T18:00:00Z",
    "seeded": true
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| companyCodes[].bukrs | string | 4자리 회사코드 |
| companyCodes[].enabled | boolean | on/off 토글 상태 |
| companyCodes[].source | string | MANUAL \| SAP \| SEED |
| currencies[].waers | string | 3~5자리 통화코드 |
| currencies[].enabled | boolean | on/off 토글 상태 |
| currencies[].fxControlMode | string | ALLOW \| FX_REQUIRED \| FX_LOCKED |
| sodRules[].ruleKey | string | 규칙 키 (예: NO_SELF_APPROVE) |
| sodRules[].severity | string | INFO \| WARN \| BLOCK |
| meta.lastUpdatedAt | string | ISO 8601 (footer 표시용) |

---

### 1.2 회사코드 토글 — `PATCH /api/synapse/admin/tenant-scope/company-codes/{bukrs}`

**Request Body**

```json
{ "enabled": false }
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| enabled | boolean | O | on/off |

**Response**: `TenantScopeResponseDto` (전체 목록)

**Validation**: bukrs 4자리 대문자 영숫자

---

### 1.3 통화 토글 — `PATCH /api/synapse/admin/tenant-scope/currencies/{waers}`

**Request Body**

```json
{
  "enabled": true,
  "fxControlMode": "FX_REQUIRED"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| enabled | boolean | X | on/off |
| fxControlMode | string | X | ALLOW \| FX_REQUIRED \| FX_LOCKED |

**Response**: `TenantScopeResponseDto` (전체 목록)

**Validation**: waers 3~5자리 대문자

---

### 1.4 SoD 규칙 토글 — `PATCH /api/synapse/admin/tenant-scope/sod-rules/{ruleKey}`

**Request Body**

```json
{
  "enabled": false,
  "severity": "BLOCK"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| enabled | boolean | X | on/off |
| severity | string | X | INFO \| WARN \| BLOCK |

**Response**: `TenantScopeResponseDto` (전체 목록)

**ruleKey 예**: NO_SELF_APPROVE, DUAL_CONTROL, FINANCE_VS_SECURITY

---

### 1.5 Bulk 업데이트

| 메서드 | 경로 | Body |
|--------|------|------|
| POST | `/api/synapse/admin/tenant-scope/company-codes/bulk` | `{ "items": [{ "bukrs": "1000", "enabled": true, "source": "MANUAL" }] }` |
| POST | `/api/synapse/admin/tenant-scope/currencies/bulk` | `{ "items": [{ "waers": "KRW", "enabled": true, "fxControlMode": "ALLOW" }] }` |
| POST | `/api/synapse/admin/tenant-scope/sod-rules/bulk` | `{ "items": [{ "ruleKey": "NO_SELF_APPROVE", "enabled": true, "severity": "WARN", "title": "...", "description": "...", "appliesTo": [] }] }` |

**items[].bukrs**: 4자리 영숫자 (company-codes)  
**items[].waers**: 3~5자리 대문자 (currencies)  
**items[].ruleKey**: 필수 (sod-rules)

**Response**: `TenantScopeResponseDto` (전체 목록)

---

## 2. Catalog APIs

Scope 선택 UI용 카탈로그 (FI 데이터 + tenant_scope 테이블 기반).

### 2.1 회사코드 카탈로그 — `GET /api/synapse/admin/catalog/company-codes`

**용도**: BUKRS 추가/제거 UI에서 사용 가능한 회사코드 목록.

**Headers**: `X-Tenant-ID` 필수

**Response (data)** — `CatalogDto`

```json
{
  "companyCodes": [
    { "bukrs": "1000", "docCount": 150, "lastSeenAt": "2026-02-02T10:00:00Z" },
    { "bukrs": "2000", "docCount": 80, "lastSeenAt": null }
  ],
  "currencies": []
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| companyCodes[].bukrs | string | 회사코드 |
| companyCodes[].docCount | long | FI 문서 건수 (optional) |
| companyCodes[].lastSeenAt | string | 마지막 사용 시각 (optional) |

---

### 2.2 통화 카탈로그 — `GET /api/synapse/admin/catalog/currencies`

**Response (data)**

```json
{
  "companyCodes": [],
  "currencies": [
    { "waers": "KRW", "docCount": 200, "lastSeenAt": "2026-02-02T10:00:00Z" },
    { "waers": "USD", "docCount": 50, "lastSeenAt": null }
  ]
}
```

---

### 2.3 전체 카탈로그 — `GET /api/synapse/admin/catalog`

**Response**: companyCodes + currencies 모두 포함.

---

## 3. SoD Evaluate API (향후 Governance용)

### 3.1 SoD 평가 — `POST /api/synapse/admin/sod/evaluate`

**용도**: 액션 실행 전 SoD 규칙 위반 여부 평가 (현재 스켈레톤, 향후 확장).

**Request Body**

```json
{
  "actionType": "PAYMENT_BLOCK",
  "actorRole": "FINANCE_OPERATOR",
  "targetResourceType": "FI_DOC",
  "amount": 1000000,
  "currency": "KRW",
  "companyCode": "1000"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| actionType | string | X | 액션 유형 |
| actorRole | string | X | 행위자 역할 |
| targetResourceType | string | X | 대상 리소스 유형 |
| amount | number | X | 금액 (금액 기반 규칙용) |
| currency | string | X | 통화 |
| companyCode | string | X | 회사코드 |

**Response (data)**

```json
{
  "allowed": true,
  "violatedRules": []
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| allowed | boolean | 허용 여부 |
| violatedRules | array | 위반 규칙 목록 (현재 스켈레톤에서는 빈 배열) |
| violatedRules[].ruleKey | string | 규칙 키 |
| violatedRules[].severity | string | INFO \| WARN \| BLOCK |
| violatedRules[].message | string | 메시지 |

---

## 4. FI Document Scope APIs (Scope 적용 조회)

Tenant Scope가 적용된 FI 문서/Open Item 조회.

### 4.1 FI 전표 헤더 — `GET /api/synapse/entities/fi-doc-headers`

**용도**: Scope 내 BUKRS만 포함된 FI 전표 목록.

**Headers**: `X-Tenant-ID` 필수

**Query**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| limit | int | 100 | 최대 건수 |

**동작**: `tenant_company_code_scope`에서 enabled=true인 BUKRS만 사용. **Scope가 비어있으면 빈 배열 반환.**

**Response (data)** — `List<Map>`

```json
[
  {
    "tenantId": 1,
    "bukrs": "1000",
    "belnr": "0000000001",
    "gjahr": "2025",
    "budat": "2025-01-15",
    "waers": "KRW",
    "xblnr": "REF-001",
    "statusCode": "POSTED"
  }
]
```

---

### 4.2 Open Items — `GET /api/synapse/entities/fi-open-items`

**용도**: Scope 내 BUKRS + WAERS만 포함된 미결 항목.

**Query**: `limit` (기본 100)

**동작**: BUKRS와 currency(WAERS) 모두 scope 내인 경우만 반환. **Scope 비어있으면 빈 배열.**

**Response (data)** — `List<Map>`

```json
[
  {
    "tenantId": 1,
    "bukrs": "1000",
    "belnr": "0000000001",
    "gjahr": "2025",
    "buzei": "001",
    "itemType": "AP",
    "openAmount": 50000,
    "currency": "KRW",
    "dueDate": "2025-02-01"
  }
]
```

---

## 5. Scope Enforcement 동작

| 상황 | 동작 |
|------|------|
| Scope에 BUKRS/WAERS가 있음 | 해당 값만 포함된 데이터 반환 |
| Scope가 비어있음 | **빈 배열 반환** (전체 fallback 없음) |
| FI Document / Open Items API | `tenant_company_code_scope`, `tenant_currency_scope`의 enabled=true만 사용 |

---

## 6. 에러 코드

| HTTP | 상황 |
|------|------|
| 400 | X-Tenant-ID 누락, validation 실패 (bukrs/waers/ruleKey 형식) |
| 404 | 리소스 없음 |
| 409 | constraint 위반 (중복 등) |
| 500 | 서버 오류 |

---

## 7. UI 연동 체크리스트

- [ ] Tenant Scope 탭: `GET /api/synapse/admin/tenant-scope` 초기 로드
- [ ] Company Codes 카드: 토글 시 `PATCH .../company-codes/{bukrs}`, bulk 시 `POST .../company-codes/bulk`
- [ ] Currencies 카드: 토글 시 `PATCH .../currencies/{waers}`, bulk 시 `POST .../currencies/bulk`
- [ ] SoD 카드: 토글 시 `PATCH .../sod-rules/{ruleKey}`, bulk 시 `POST .../sod-rules/bulk`
- [ ] Catalog: BUKRS/WAERS 추가 UI에서 `GET /api/synapse/admin/catalog/company-codes`, `GET .../currencies` 사용
- [ ] FI Document/Open Items 조회 시 `GET /api/synapse/entities/fi-doc-headers`, `GET .../fi-open-items` 사용 (Scope 자동 적용)
- [ ] meta.lastUpdatedAt: Tenant Scope 탭 footer에 "마지막 업데이트" 표시
