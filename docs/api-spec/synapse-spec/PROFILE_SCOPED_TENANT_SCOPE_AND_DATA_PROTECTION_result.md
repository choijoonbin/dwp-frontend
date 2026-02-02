# Profile-Scoped Tenant Scope & Data Protection 구현 결과

## 개요

Tenant Scope를 **Profile(profileId) 기준**으로 적용하도록 전환했습니다.
- profileId 없으면 테넌트 기본 프로파일(is_default=true) 사용
- md_company_code, md_currency 마스터 테이블 + policy_scope_company, policy_scope_currency, policy_sod_rule 사용
- config_kv에 BUKRS 목록 저장 금지 준수

---

## A) DB 마이그레이션 (V10)

**파일:** `services/synapsex-service/src/main/resources/db/migration/V10__profile_scoped_tenant_scope_and_masters.sql`

| 테이블 | 설명 |
|--------|------|
| `dwp_aura.md_company_code` | 회사코드(BUKRS) 마스터 |
| `dwp_aura.md_currency` | 통화 마스터(전역) |
| `dwp_aura.policy_scope_company` | Profile별 회사코드 스코프 |
| `dwp_aura.policy_scope_currency` | Profile별 통화 스코프 |
| `dwp_aura.policy_sod_rule` | Profile별 SoD 규칙 |
| `policy_data_protection.kms_mode` | kms_mode 컬럼 추가 |

FI 데이터(fi_doc_header, fi_open_item) 기반 시드 + KRW/USD/EUR 공통 통화 시드 포함.

---

## B) API 스펙

### C1) Tenant Scope - Company Codes

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/synapse/admin/tenant-scope/company-codes?profileId=` | profileId 없으면 기본 프로파일 사용 |
| PUT | `/api/synapse/admin/tenant-scope/company-codes/bulk` | bulk 업데이트 |

**GET 응답:**
```json
{
  "profileId": 1,
  "items": [
    {
      "bukrs": "1000",
      "bukrsName": "BUKRS 1000",
      "defaultCurrency": "KRW",
      "isActive": true,
      "included": true,
      "lastSyncTs": null
    }
  ]
}
```

**PUT 요청:**
```json
{
  "profileId": 1,
  "updates": [
    { "bukrs": "1000", "included": true },
    { "bukrs": "2000", "included": false }
  ]
}
```

### C2) Tenant Scope - Currencies

| Method | Path |
|--------|------|
| GET | `/api/synapse/admin/tenant-scope/currencies?profileId=` |
| PUT | `/api/synapse/admin/tenant-scope/currencies/bulk` |

**PUT 요청:**
```json
{
  "profileId": 1,
  "updates": [
    { "currencyCode": "KRW", "included": true },
    { "currencyCode": "USD", "included": false }
  ]
}
```

### C3) Tenant Scope - SoD Rules

| Method | Path |
|--------|------|
| GET | `/api/synapse/admin/tenant-scope/sod-rules?profileId=` |
| PUT | `/api/synapse/admin/tenant-scope/sod-rules/bulk` |

**GET 응답:**
```json
{
  "profileId": 1,
  "mode": "BASELINE",
  "rules": [
    {
      "ruleKey": "NO_SELF_APPROVE",
      "title": "Requester cannot approve own action",
      "description": "요청자는 본인 액션을 승인할 수 없습니다.",
      "isEnabled": true
    }
  ]
}
```

### C4) Data Protection (kmsMode 추가)

| Method | Path |
|--------|------|
| GET | `/api/synapse/admin/data-protection?profileId=` |
| PUT | `/api/synapse/admin/data-protection` |

**GET 응답 (kmsMode 필드 추가):**
```json
{
  "profileId": 1,
  "atRestEncryptionEnabled": true,
  "kmsMode": "KMS_MANAGED_KEYS",
  "auditRetentionYears": 7,
  "exportRequiresApproval": true
}
```

**PUT 요청:** `kmsMode` 필드 추가. 현재 `"KMS_MANAGED_KEYS"`만 허용.

---

## C) Scope Enforcement (읽기)

| 엔드포인트 | 스코프 조건 |
|------------|-------------|
| `GET /api/synapse/entities/fi-doc-headers` | tenant_id + bukrs IN scope |
| `GET /api/synapse/entities/fi-open-items` | tenant_id + bukrs IN scope + currency IN scope |
| `GET /api/synapse/entities/cases` | tenant_id + bukrs IN scope |
| `GET /api/synapse/entities/actions` | case 조인, case bukrs IN scope |

Scope 비어있으면 빈 결과 반환. profileId 없으면 기본 프로파일 스코프 사용.

---

## D) 쓰기/액션 시 403 OUT_OF_SCOPE

- `ScopeEnforcementService.requireBukrsInScope()`, `requireBukrsAndCurrencyInScope()` 사용
- 스코프 밖 리소스 접근 시: **403** + `ErrorCode.OUT_OF_SCOPE` (E2009)
- 감사로그: `outcome=DENIED`, `severity=WARN`, `resource_type` 적절히 설정

---

## E) 감사 로그

모든 Admin 정책 변경은 `audit_event_log`에 기록:
- `TENANT_SCOPE_COMPANY`, `TENANT_SCOPE_CURRENCY`, `SOD_RULE`
- `DATA_PROTECTION`
- Scope DENIED: `logScopeDenied()` → outcome=DENIED

---

## F) 기존 API 호환성

- `GET /api/synapse/admin/tenant-scope` (기존 tenant-level) 유지
- `PATCH /company-codes/{bukrs}`, `POST /company-codes/bulk` 등 기존 엔드포인트 유지
- 새 profile-scoped API는 `GET/PUT /company-codes`, `/currencies`, `/sod-rules` 경로 사용
