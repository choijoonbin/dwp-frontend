# Tenant Scope Profile-Scoped API — FE 추가 요청

> **작성일**: 2026-02-02  
> **참조**: `PROFILE_SCOPED_TENANT_SCOPE_AND_DATA_PROTECTION_result.md`  
> **대상**: Profile-Scoped Tenant Scope API (`/tenant-scope/company-codes`, `/currencies`, `/sod-rules`)

---

## 개요

FE는 Profile-Scoped API로 전환 완료했습니다. 다만 아래 3가지 필드가 현재 스펙에 없어 UI에서 **비노출** 상태입니다.  
해당 필드 지원 시 FE에서 즉시 노출 가능하도록 요청드립니다.

---

## 1. Currencies — fxControlMode (FX 제어 모드)

### 1.1 용도

- **Admin > Tenant Scope > Currencies 카드**에서 통화별 FX(환율) 제어 정책 설정
- 사용자가 통화를 스코프에 포함(included)한 뒤, 해당 통화에 대한 **posting/reporting 시 환율 처리 방식**을 선택

### 1.2 필요한 데이터

| 필드 | 타입 | 허용값 | 설명 |
|------|------|--------|------|
| `fxControlMode` | string | `ALLOW` \| `FX_REQUIRED` \| `FX_LOCKED` | 통화별 FX 제어 모드 |

| 값 | 의미 |
|----|------|
| `ALLOW` | 환율 없이 posting/report 허용 |
| `FX_REQUIRED` | 환율 필수 (FX 미입력 시 차단) |
| `FX_LOCKED` | 환율 고정 (변동 불가) |

### 1.3 요청 API 변경

**GET** `/api/synapse/admin/tenant-scope/currencies?profileId=`

**응답 items[]에 추가:**
```json
{
  "currencyCode": "KRW",
  "included": true,
  "fxControlMode": "ALLOW"
}
```

**PUT** `/api/synapse/admin/tenant-scope/currencies/bulk`

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

- `fxControlMode` 미전송 시: 기존값 유지 또는 기본값 `ALLOW`
- `included: false`인 항목: `fxControlMode` 무시 가능

### 1.4 FE 사용처

- Currencies 카드 각 행에 Select 드롭다운 (Allow / FX Required / FX Locked)
- `included: true`인 통화에만 노출

---

## 2. SoD Rules — severity (규칙 심각도)

### 2.1 용도

- **Admin > Tenant Scope > Segregation of Duties 카드**에서 SoD 규칙별 **위반 시 처리 수준** 설정
- 사용자가 규칙을 활성화(isEnabled)한 뒤, 위반 시 **Info / Warning / Block** 중 하나로 동작 지정

### 2.2 필요한 데이터

| 필드 | 타입 | 허용값 | 설명 |
|------|------|--------|------|
| `severity` | string | `INFO` \| `WARN` \| `BLOCK` | 규칙 위반 시 심각도 |

| 값 | 의미 |
|----|------|
| `INFO` | 로그만 기록, 차단 없음 |
| `WARN` | 경고 표시, 진행 가능 |
| `BLOCK` | 차단, 액션 실행 불가 |

### 2.3 요청 API 변경

**GET** `/api/synapse/admin/tenant-scope/sod-rules?profileId=`

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

**PUT** `/api/synapse/admin/tenant-scope/sod-rules/bulk`

**요청 updates[] 형식 (또는 rules[]):**
```json
{
  "profileId": 1,
  "updates": [
    { "ruleKey": "NO_SELF_APPROVE", "isEnabled": true, "severity": "WARN" },
    { "ruleKey": "DUAL_CONTROL", "isEnabled": true, "severity": "BLOCK" }
  ]
}
```

- `severity` 미전송 시: 기존값 유지 또는 기본값 `WARN`
- `isEnabled: false`인 규칙: `severity`는 저장만 하고, 평가 시 미적용

### 2.4 FE 사용처

- SoD 카드 각 규칙 행에 Select 드롭다운 (Info / Warning / Block)
- `isEnabled: true`인 규칙에만 노출

---

## 3. Tenant Scope — lastUpdatedAt (마지막 업데이트 시각)

### 3.1 용도

- **Admin > Tenant Scope 탭** 하단 footer에 "마지막 업데이트: YYYY-MM-DD HH:mm" 표시
- 관리자가 스코프/정책 변경 시점을 한눈에 확인

### 3.2 필요한 데이터

| 필드 | 타입 | 설명 |
|------|------|------|
| `lastUpdatedAt` | string (ISO 8601) | Tenant Scope(회사코드/통화/SoD) 중 하나라도 변경된 최근 시각 |

### 3.3 요청 API 변경

**GET** `/api/synapse/admin/tenant-scope/company-codes?profileId=`  
**GET** `/api/synapse/admin/tenant-scope/currencies?profileId=`  
**GET** `/api/synapse/admin/tenant-scope/sod-rules?profileId=`

**응답 최상위에 meta 추가 (또는 각 응답에 공통 필드):**
```json
{
  "profileId": 1,
  "lastUpdatedAt": "2026-02-02T18:30:00Z",
  "items": [ ... ]
}
```

또는 **단일 meta 전용 응답**이 있다면:
- `GET /api/synapse/admin/tenant-scope/meta?profileId=` → `{ lastUpdatedAt: "..." }`

- FE는 3개 API 중 하나에서 `lastUpdatedAt`만 받아도 됨 (예: sod-rules 응답에 포함)
- `policy_scope_company`, `policy_scope_currency`, `policy_sod_rule` 중 가장 최근 `updated_at` 사용 권장

### 3.4 FE 사용처

- Tenant Scope 탭 하단: `마지막 업데이트: {lastUpdatedAt 로컬 포맷}`

---

## 4. 요약

| # | 항목 | API | 용도 |
|---|------|-----|------|
| 1 | `fxControlMode` | Currencies GET/PUT bulk | 통화별 FX 제어 모드 (Allow/FX Required/FX Locked) |
| 2 | `severity` | SoD Rules GET/PUT bulk | SoD 규칙 위반 시 심각도 (Info/Warn/Block) |
| 3 | `lastUpdatedAt` | Company-codes / Currencies / Sod-rules GET 중 하나 | Tenant Scope 마지막 변경 시각 (footer 표시) |

---

*문서 끝*
