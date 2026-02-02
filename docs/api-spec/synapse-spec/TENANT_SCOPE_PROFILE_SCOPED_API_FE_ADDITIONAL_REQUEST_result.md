# Tenant Scope Profile-Scoped API — FE 추가 요청 구현 결과

> **작성일**: 2026-01-29  
> **참조**: `TENANT_SCOPE_PROFILE_SCOPED_API_FE_ADDITIONAL_REQUEST.md`  
> **대상**: Profile-Scoped Tenant Scope API (`/tenant-scope/company-codes`, `/currencies`, `/sod-rules`)

---

## 개요

FE 추가 요청 3가지 필드를 모두 반영했습니다. 기존 API 동작은 유지되며, 신규 필드는 **선택적(optional)**으로 동작합니다.

| # | 항목 | API | 상태 |
|---|------|-----|------|
| 1 | `fxControlMode` | Currencies GET/PUT bulk | ✅ 반영 |
| 2 | `severity` | SoD Rules GET/PUT bulk | ✅ 반영 |
| 3 | `lastUpdatedAt` | Company-codes / Currencies / Sod-rules GET | ✅ 반영 |

---

## 1. Currencies — fxControlMode

### 1.1 GET `/api/synapse/admin/tenant-scope/currencies?profileId=`

**응답 items[]에 추가:**
```json
{
  "currencyCode": "KRW",
  "currencyName": "Korean Won",
  "isActive": true,
  "included": true,
  "fxControlMode": "ALLOW"
}
```

- `fxControlMode`: `ALLOW` | `FX_REQUIRED` | `FX_LOCKED`
- policy에 없는 통화(implicit scope): `ALLOW` 기본값

### 1.2 PUT `/api/synapse/admin/tenant-scope/currencies/bulk`

**요청 updates[]에 추가:**
```json
{
  "profileId": 1,
  "updates": [
    { "currencyCode": "KRW", "included": true, "fxControlMode": "ALLOW" },
    { "currencyCode": "USD", "included": true, "fxControlMode": "FX_REQUIRED" }
  ]
}
```

- `fxControlMode` 미전송: 기존값 유지(update 시) 또는 `ALLOW`(신규 생성 시)
- `included: false`인 항목: `fxControlMode`는 저장되며, FE에서 무시 가능

---

## 2. SoD Rules — severity

### 2.1 GET `/api/synapse/admin/tenant-scope/sod-rules?profileId=`

**응답 rules[]에 추가:**
```json
{
  "ruleKey": "NO_SELF_APPROVE",
  "title": "Requester cannot approve own action",
  "description": "요청자는 본인 액션을 승인할 수 없습니다.",
  "isEnabled": true,
  "severity": "WARN"
}
```

- `severity`: `INFO` | `WARN` | `BLOCK`

### 2.2 PUT `/api/synapse/admin/tenant-scope/sod-rules/bulk`

**요청 updates[]에 추가:**
```json
{
  "profileId": 1,
  "updates": [
    { "ruleKey": "NO_SELF_APPROVE", "isEnabled": true, "severity": "WARN" },
    { "ruleKey": "DUAL_CONTROL", "isEnabled": true, "severity": "BLOCK" }
  ]
}
```

- `severity` 미전송: 기존값 유지
- `isEnabled: false`인 규칙: `severity`는 저장되며, 평가 시 미적용 가능

---

## 3. Tenant Scope — lastUpdatedAt

### 3.1 GET 응답 (company-codes, currencies, sod-rules 공통)

**응답 최상위에 추가:**
```json
{
  "profileId": 1,
  "lastUpdatedAt": "2026-01-29T18:30:00Z",
  "items": [ ... ]
}
```

또는 sod-rules:
```json
{
  "profileId": 1,
  "mode": "BASELINE",
  "lastUpdatedAt": "2026-01-29T18:30:00Z",
  "rules": [ ... ]
}
```

- `lastUpdatedAt`: `policy_scope_company`, `policy_scope_currency`, `policy_sod_rule` 중 **가장 최근 updated_at** (ISO 8601)
- 3개 테이블 모두 비어 있으면 `null`

---

## 4. DB 마이그레이션

**파일:** `services/synapsex-service/src/main/resources/db/migration/V11__profile_scope_currency_fx_control_mode_and_sod_severity.sql`

| 테이블 | 컬럼 | 타입 | 기본값 |
|--------|------|------|--------|
| `policy_scope_currency` | `fx_control_mode` | VARCHAR(16) | `ALLOW` |
| `policy_sod_rule` | `severity` | VARCHAR(16) | `WARN` |

---

## 5. 호환성

- **기존 응답**: `fxControlMode`, `severity`, `lastUpdatedAt` 필드 추가 — 기존 필드 변경 없음
- **기존 요청**: `fxControlMode`, `severity` 미전송 시 기존값 유지
- **기존 PATCH/POST bulk (legacy)**: 변경 없음 (Profile-scoped PUT bulk만 수정)

---

*문서 끝*
