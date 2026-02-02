# Synapse Admin Tab #3: PII & Encryption API 결과 문서

> **작성일**: 2026-01-29  
> **대상**: Admin Tab #3 "PII & Encryption" (Masking Policy + Encryption & Retention 카드)  
> **Base Path**: `GET /api/synapse/admin/**` (Gateway 8080 → SynapseX 8085)

---

## 1. 구현 요약

| 구분 | API | 설명 |
|------|-----|------|
| **PII Field Catalog** | `GET /pii-fields/catalog` | tenant-agnostic 필드 카탈로그 (Mock 제거, 실제 카탈로그) |
| **PII Policy** | `GET /pii-policies?profileId=` | tenant+profileId 기준 PII 정책 목록 |
| **PII Policy** | `PUT /pii-policies/bulk` | PII 정책 일괄 upsert |
| **Data Protection** | `GET /data-protection?profileId=` | 암호화·보존·내보내기 설정 조회 (없으면 기본 행 생성) |
| **Data Protection** | `PUT /data-protection` | 암호화·보존·내보내기 설정 저장 |

---

## 2. 공통 사항

### 2.1. 필수 헤더

| 헤더 | 필수 | 타입 | 설명 |
|------|------|------|------|
| `X-Tenant-ID` | ✅ | Long (BIGINT) | 멀티테넌시 식별자 |
| `X-User-ID` | 선택 | Long | 변경 수행자 (감사 로그용) |
| `Authorization` | JWT 적용 시 | Bearer &lt;token&gt; | 인증 토큰 |

### 2.2. 응답 래퍼

모든 API는 `ApiResponse<T>` 형식:

```json
{
  "success": true,
  "message": "저장되었습니다.",
  "data": { ... }
}
```

에러 시:

```json
{
  "success": false,
  "code": "E2001",
  "message": "프로파일을 찾을 수 없습니다."
}
```

---

## 3. PII Field Catalog

### `GET /api/synapse/admin/pii-fields/catalog`

**tenant-agnostic** — 모든 테넌트 동일 카탈로그. `X-Tenant-ID`는 라우팅용으로만 사용 가능.

**응답 예시**

```json
{
  "success": true,
  "data": {
    "fields": [
      {
        "fieldKey": "IBAN",
        "label": "IBAN",
        "description": "국제 은행 계좌 번호",
        "dataDomain": "FINANCIAL",
        "defaultHandling": "MASK",
        "supportsMask": true,
        "supportsHash": true,
        "supportsEncrypt": true,
        "supportsVault": false,
        "sampleMaskedFormat": "DE89****1234"
      },
      {
        "fieldKey": "EMAIL",
        "label": "Email",
        "description": "이메일 주소",
        "dataDomain": "CONTACT",
        "defaultHandling": "MASK",
        "supportsMask": true,
        "supportsHash": true,
        "supportsEncrypt": true,
        "supportsVault": false,
        "sampleMaskedFormat": "u***@***.com"
      }
    ]
  }
}
```

**카탈로그 필드**: IBAN, BANK_ACCOUNT, EMAIL, PHONE, TAX_ID, NAME, ADDRESS

---

## 4. PII Policy (Masking Policy)

### `GET /api/synapse/admin/pii-policies?profileId={profileId}`

**Query**
- `profileId` (필수): Long

**응답 예시**

```json
{
  "success": true,
  "data": [
    {
      "piiId": 1,
      "tenantId": 1,
      "profileId": 10,
      "fieldKey": "IBAN",
      "handling": "MASK",
      "maskRule": "PARTIAL_4_4",
      "hashRule": null,
      "encryptRule": null,
      "note": null,
      "createdAt": "2026-01-29T10:00:00Z",
      "updatedAt": "2026-01-29T10:00:00Z"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `fieldKey` | string | 카탈로그의 fieldKey와 동일 |
| `handling` | string | ALLOW \| MASK \| HASH_ONLY \| ENCRYPT \| FORBID |
| `maskRule` | string? | 마스킹 규칙 (예: PARTIAL_4_4, FULL) |
| `hashRule` | string? | 해시 규칙 (예: SHA256) |
| `encryptRule` | string? | 암호화 규칙 (예: AES256) |

---

### `PUT /api/synapse/admin/pii-policies/bulk`

**Request Body**

```json
{
  "profileId": 10,
  "items": [
    {
      "fieldKey": "IBAN",
      "handling": "MASK",
      "maskRule": "PARTIAL_4_4",
      "hashRule": null,
      "encryptRule": null,
      "note": null
    },
    {
      "fieldKey": "EMAIL",
      "handling": "HASH_ONLY",
      "maskRule": null,
      "hashRule": "SHA256",
      "encryptRule": null
    }
  ]
}
```

| 필드 | 필수 | 검증 |
|------|------|------|
| `profileId` | ✅ | Long |
| `items[].fieldKey` | ✅ | NotBlank |
| `items[].handling` | ✅ | ALLOW \| MASK \| HASH_ONLY \| ENCRYPT \| FORBID |
| `items[].maskRule` | - | optional |
| `items[].hashRule` | - | optional |
| `items[].encryptRule` | - | optional |

**동작**: `(tenant_id, profile_id, field_key)` 기준 upsert. 요청에 없는 기존 필드는 삭제.

**응답**: 저장된 `items` 배열 (GET과 동일 형식)

---

## 5. Data Protection (Encryption & Retention)

### `GET /api/synapse/admin/data-protection?profileId={profileId}`

**Query**
- `profileId` (필수): Long

**동작**: 없으면 **기본 행을 DB에 생성** 후 반환.

**응답 예시**

```json
{
  "success": true,
  "data": {
    "protectionId": 1,
    "tenantId": 1,
    "profileId": 10,
    "atRestEncryptionEnabled": false,
    "keyProvider": "KMS_MOCK",
    "auditRetentionYears": 7,
    "exportRequiresApproval": true,
    "exportMode": "ZIP",
    "updatedAt": "2026-01-29T10:00:00Z"
  }
}
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `atRestEncryptionEnabled` | boolean | false | 저장 시 암호화 |
| `keyProvider` | string | KMS_MOCK | KMS_MOCK \| KMS \| HSM |
| `auditRetentionYears` | int | 7 | 감사 로그 보존 연수 |
| `exportRequiresApproval` | boolean | true | 내보내기 승인 필요 |
| `exportMode` | string | ZIP | ZIP \| CSV |

---

### `PUT /api/synapse/admin/data-protection`

**Request Body**

```json
{
  "profileId": 10,
  "atRestEncryptionEnabled": true,
  "keyProvider": "KMS",
  "auditRetentionYears": 10,
  "exportRequiresApproval": true,
  "exportMode": "ZIP"
}
```

| 필드 | 필수 | 검증 |
|------|------|------|
| `profileId` | ✅ | Long |
| `atRestEncryptionEnabled` | - | boolean |
| `keyProvider` | - | KMS_MOCK \| KMS \| HSM |
| `auditRetentionYears` | - | 1 ~ 20 |
| `exportRequiresApproval` | - | boolean |
| `exportMode` | - | ZIP \| CSV |

**동작**: upsert. 제공된 필드만 업데이트, 미제공 시 기존값 유지.

---

## 6. 에러 코드

| HTTP | code | message | 상황 |
|------|------|---------|------|
| 400 | E2002 | handling은 ALLOW, MASK, HASH_ONLY, ENCRYPT, FORBID 중 하나여야 합니다 | PII bulk: 잘못된 handling |
| 400 | E2002 | auditRetentionYears는 1~20 사이여야 합니다 | Data Protection: 범위 초과 |
| 400 | E2002 | keyProvider는 KMS_MOCK, KMS, HSM 중 하나여야 합니다 | Data Protection: 잘못된 keyProvider |
| 400 | E2002 | exportMode는 ZIP 또는 CSV여야 합니다 | Data Protection: 잘못된 exportMode |
| 404 | E2001 | 프로파일을 찾을 수 없습니다. | profileId에 해당 프로파일 없음 |

---

## 7. FE 연동 시 고려사항

### 7.1. Config Profile 선행

- PII Policy / Data Protection 모두 **profileId** 필요.
- `GET /api/synapse/admin/profiles` 로 프로파일 목록 조회 후, 선택된 `profileId`로 위 API 호출.

### 7.2. PII Policy UI 흐름

1. `GET /pii-fields/catalog` → 카탈로그 렌더링
2. `GET /pii-policies?profileId=` → 현재 정책 로드
3. 사용자 편집 후 `PUT /pii-policies/bulk` → 저장

### 7.3. Data Protection UI 흐름

1. `GET /data-protection?profileId=` → 현재 설정 로드 (없으면 BE가 기본 행 생성)
2. 사용자 편집 후 `PUT /data-protection` → 저장

### 7.4. 부분 업데이트 (Data Protection)

- `PUT` 시 **일부 필드만** 보내도 됨. 미전송 필드는 기존값 유지.
- 예: `{ "profileId": 10, "auditRetentionYears": 10 }` 만 전송 → 해당 필드만 변경.

### 7.5. OpenAPI

- SynapseX 서비스에 springdoc-openapi 적용.
- Swagger UI: `http://localhost:8085/swagger-ui.html` (SynapseX 직접 접근 시)
- Gateway 경유: `http://localhost:8080/api/synapse/admin/**`

---

## 8. 감사 로그

모든 변경은 `dwp_aura.audit_event_log`에 기록:

| 리소스 | event_type | resource_type | resource_id |
|--------|------------|---------------|-------------|
| PII Policy bulk | BULK_UPDATE | PII_POLICY | profileId |
| Data Protection | UPDATE | DATA_PROTECTION | profileId |

`before_json`, `after_json`, `diff_json` 포함.
