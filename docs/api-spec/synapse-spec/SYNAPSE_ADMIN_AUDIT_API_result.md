# Synapse(Aura) Admin / Audit API 구현 결과 (BE → FE)

- **작업일**: 2026-01-29
- **대상**: Synapse 전용 `/admin`(통화/PII 정책) + `/audit`(감사 로그) API
- **서비스**: synapsex-service (Java), Gateway 경유 시 Base URL: `http://localhost:8080` (또는 배포 도메인)

---

## 1. 공통 사항

### 1.1 Base URL 및 라우팅

- **Gateway**: `http://localhost:8080`
- **프론트 제공 API (Synapse)**: `/api/synapse/admin/**`, `/api/synapse/audit/**`, `/api/synapse/entities/**`  
  → Gateway가 **synapsex-service(8085)** 로 라우팅. (Aura Platform 호출은 백엔드 전용으로 `/api/aura/**` 사용)

### 1.2 필수 헤더

| 헤더 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `X-Tenant-ID` | Long (BIGINT) | **필수** | 테넌트 식별자. 미제공 시 400. |
| `X-User-ID` | Long | 선택 | 행위자 사용자 ID (감사 로그·정책 변경 시 사용). |
| `Authorization` | Bearer JWT | 인증 정책에 따름 | Gateway/Auth에서 검증 후 하위 서비스로 전파. |

### 1.3 응답 형식

- 모든 API는 **dwp-core** `ApiResponse<T>` 래퍼 사용.
- 성공: `{ "status": "SUCCESS", "message": "...", "data": { ... }, "timestamp": "..." }`
- 실패: `{ "status": "ERROR", "message": "...", "errorCode": "E3000", "timestamp": "..." }`

---

## 2. A. Admin API (통화/PII 정책)

### A1) Config Profile

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/synapse/admin/profiles` | tenant 프로파일 목록 + default 표시 |
| POST | `/api/synapse/admin/profiles` | 프로파일 생성 |
| PUT | `/api/synapse/admin/profiles/{profileId}` | 이름/설명/기본여부 변경 |
| PUT | `/api/synapse/admin/profiles/{profileId}/default` | 해당 프로파일을 기본으로 설정 (테넌트당 1개) |
| DELETE | `/api/synapse/admin/profiles/{profileId}` | 삭제 (기본 프로파일 삭제 금지, 한도/PII 참조 시 차단) |

**GET /api/synapse/admin/profiles**

- Request: 헤더만 (`X-Tenant-ID` 필수).
- Response `data`: 배열  
  - `profileId`, `tenantId`, `profileName`, `description`, `isDefault`, `createdAt`, `updatedAt`

**POST /api/synapse/admin/profiles**

- Request body:
```json
{
  "profileName": "string (필수)",
  "description": "string (선택)",
  "isDefault": false
}
```
- Response `data`: 생성된 프로파일 DTO (동일 필드).

**PUT /api/synapse/admin/profiles/{profileId}**

- Request body:
```json
{
  "profileName": "string (선택)",
  "description": "string (선택)",
  "isDefault": true
}
```
- Response `data`: 수정된 프로파일 DTO.

**PUT /api/synapse/admin/profiles/{profileId}/default**

- Request: path `profileId` + 헤더 (`X-Tenant-ID`, `X-User-ID` 선택).
- Response: `data` = 해당 프로파일 DTO. 테넌트당 default는 1개로 유지.

**DELETE /api/synapse/admin/profiles/{profileId}**

- Request: path `profileId` + 헤더.
- Response: `data` 없음.
- 규칙: 기본 프로파일(isDefault=true) 삭제 시 400. 한도 정책 또는 PII 정책이 참조 중이면 409(하위 제거 후 삭제).

---

### A2) Currency/Threshold Policy (rule_threshold)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/synapse/admin/thresholds` | 검색/필터/페이지네이션 |
| POST | `/api/synapse/admin/thresholds` | threshold 추가/수정(upsert) |
| DELETE | `/api/synapse/admin/thresholds/{thresholdId}` | 삭제 |

**GET /api/synapse/admin/thresholds**

- Query params: `profileId`, `dimension`, `waers`, `q` (선택), `page`, `size`, `sort` (Spring Pageable).
- Response `data`: Spring `Page<ThresholdDto>`  
  - `content`: 배열 요소  
    - `thresholdId`, `tenantId`, `profileId`, `policyDocId`, `dimension`, `dimensionKey`, `waers`, `thresholdAmount`, `requireEvidence`, `evidenceTypes`, `severityOnBreach`, `actionOnBreach`, `createdAt`, `updatedAt`

**POST /api/synapse/admin/thresholds (upsert)**

- Request body:
```json
{
  "thresholdId": null,
  "profileId": 1,
  "policyDocId": "string (선택)",
  "dimension": "string (필수)",
  "dimensionKey": "string (필수)",
  "waers": "KRW",
  "thresholdAmount": 1000000.00,
  "requireEvidence": false,
  "evidenceTypes": {},
  "severityOnBreach": "MEDIUM",
  "actionOnBreach": "FLAG_FOR_REVIEW"
}
```
- `thresholdId` 있으면 update, 없으면 create.
- Response `data`: 저장된 ThresholdDto.

**DELETE /api/synapse/admin/thresholds/{thresholdId}**

- Response: `data` 없음.

---

### A3) PII Policy (policy_pii_field)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/synapse/admin/pii-policies?profileId=` | profileId 기준 field별 handling 조회 |
| PUT | `/api/synapse/admin/pii-policies/bulk` | 여러 field 정책 일괄 저장 |
| GET | `/api/synapse/admin/pii-fields/catalog` | 민감필드 후보 목록 (옵션) |

**GET /api/synapse/admin/pii-policies**

- Query: `profileId` (필수).
- Response `data`: 배열  
  - `piiId`, `tenantId`, `profileId`, `fieldName`, `handling` (ALLOW|MASK|HASH_ONLY|ENCRYPT|FORBID), `note`, `createdAt`, `updatedAt`

**PUT /api/synapse/admin/pii-policies/bulk**

- Request body:
```json
{
  "profileId": 1,
  "items": [
    { "fieldName": "IBAN", "handling": "MASK", "note": "선택" },
    { "fieldName": "EMAIL", "handling": "ALLOW", "note": null }
  ]
}
```
- 기존 해당 profile의 PII 정책을 모두 삭제 후 `items`로 일괄 저장.
- Response `data`: 저장된 PiiPolicyDto 배열.

**GET /api/synapse/admin/pii-fields/catalog**

- Response `data`: 문자열 배열 (예: IBAN, BANK_ACCOUNT, EMAIL, PHONE, TAX_ID, NAME, ADDRESS).

---

### A4) PII Vault Access (옵션)

- **GET /api/synapse/entities/{partyId}/pii**  
  - 명세상 권한/승인 필요, audit_event_log에 event_category='PII', event_type='VIEW' 기록.  
  - **현재 구현**: 별도 컨트롤러/엔드포인트 미구현(Phase2). 필요 시 요청 시 추가.

---

## 3. B. Audit API (Synapse 전용 감사 로그)

- 저장소: **dwp_aura.audit_event_log** (SoT). PK: `audit_id`, event_category/event_type/outcome/severity, actor_type/actor_user_id, channel, before_json/after_json/diff_json/evidence_json, tags 등.

### B1) Query

**GET /api/synapse/audit/events**

- Query params:
  - `from`, `to`: ISO-8601 timestamptz (선택)
  - `category` (event_category), `type` (event_type), `outcome` (SUCCESS|FAILED|DENIED|NOOP), `severity` (INFO|WARN|HIGH|CRITICAL): 문자열 (선택)
  - `actorUserId`: Long (선택), `actorType`: HUMAN|AGENT|SYSTEM (선택)
  - `resourceType`, `resourceId`: 문자열 (선택)
  - `q`: 메시지/태그 검색 (선택)
  - `page`, `size`, `sort`: 기본 sort=createdAt desc

- Response `data`: **items + total + pageInfo**  
  - `items`: AuditEventDto[] (auditId, createdAt, eventCategory, eventType, resourceType, resourceId, actorType, actorUserId, actorDisplayName, outcome, severity, evidenceJson)
  - `total`: 전체 건수
  - `pageInfo`: { page, size, totalPages, total }

### B2) Detail

**GET /api/synapse/audit/events/{auditId}**

- Response `data`: AuditEventDetailDto (audit_event_log 전체 컬럼)  
  - `auditId`, `tenantId`, `createdAt`, `eventCategory`, `eventType`, `resourceType`, `resourceId`, `actorType`, `actorUserId`, `actorAgentId`, `actorDisplayName`, `channel`, `outcome`, `severity`, `beforeJson`, `afterJson`, `diffJson`, `evidenceJson`, `tags`, `ipAddress`, `userAgent`, `gatewayRequestId`, `traceId`, `spanId`  
  - JSON 필드는 raw 그대로 반환.

### B3) Write (서버 내부 전용)

- **AuditWriter** 컴포넌트로 서비스 내부에서만 기록. SoT: **dwp_aura.audit_event_log**.
- `/admin` 정책 변경(profiles/thresholds/pii-policies) 시 event_category=ADMIN, event_type=CREATE|UPDATE|DELETE|SET_DEFAULT|BULK_UPDATE, outcome=SUCCESS, channel=API 로 자동 기록.
- Phase1 확장용 event_type 표준: ACTION(APPROVE, REJECT, EXECUTE, SIMULATE, FAILED), INTEGRATION(INGEST_FAIL, VALIDATION_FAIL, OUTBOX_ENQUEUED, SAP_APPLY_RESULT).

### B4) Export (Phase2)

- **GET /api/synapse/audit/export?caseId=**  
  - 현재 미구현(stub/placeholder). Phase2에서 구현 예정.

---

## 4. 데이터 모델 매핑 규칙 (C)

- **resource_id**: 문자열 통일. 복합키는 **resource_key_json** 등으로 payload에 JSON 저장 가능.
- 예: FI_DOC → resource_id=`"1000|1000000001|2025"`, payload.resource_key_json=`{"bukrs":"1000","belnr":"1000000001","gjahr":"2025"}`.
- CASE: resource_id = case_id, ACTION: resource_id = action_id.

---

## 5. 완료 조건(DoD) 체크

- [x] /admin 통화/PII 정책 CRUD 가능 (profiles, thresholds, pii-policies)
- [x] /audit/events 리스트/상세 조회 가능
- [x] /admin 정책 변경 시 synapse_audit_event_log에 POLICY_CHANGE 기록
- [x] Tenant 분리: X-Tenant-ID 필수, 모든 조회/변경에 tenant_id 적용
- [ ] A4 PII Vault GET /api/synapse/entities/{partyId}/pii: 옵션으로 Phase2
- [ ] B4 Audit Export: Phase2

---

## 6. 프론트엔드 연동 시 참고

1. **Base URL**: Gateway `http://localhost:8080` (또는 배포 URL).
2. **모든 요청에 `X-Tenant-ID`** 헤더 포함 (필수).
3. **인증**: Gateway/Auth 정책에 따라 `Authorization` Bearer JWT 전달.
4. **에러 처리**: `ApiResponse.status === "ERROR"` 시 `message`, `errorCode` 사용.
5. **페이지네이션**: thresholds, audit/events는 `Page` 객체 (content, totalElements, size, number 등).

문의 사항 있으면 백엔드 담당자에게 요청하시면 됩니다.
