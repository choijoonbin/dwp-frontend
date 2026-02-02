# 시스템 관리(Admin) 메뉴 — FE 추가 API 요청 결과 문서

> **작성일**: 2026-02-02  
> **요청 문서**: `ADMIN_SYSTEM_MANAGEMENT_FE_ADDITIONAL_REQUEST.md`  
> **참조**: `TENANT_SCOPE_AND_CATALOG_API_FE_HANDOVER.md`, `SYNAPSE_PII_ENCRYPTION_ADMIN_TAB3_result.md`, `SYNAPSE_ADMIN_AUDIT_API_result.md`

---

## 1. Tenant 목록 API (신규 구현)

### 1.1 구현 내용

| 항목 | 내용 |
|------|------|
| **경로** | `GET /api/admin/tenants` |
| **서비스** | dwp-auth-server |
| **권한** | `menu.admin.users` VIEW (Admin 진입 가능 사용자) |

### 1.2 동작

- **로그인한 사용자가 속한 Tenant 목록만** 반환 (UserAccount 기준).
- JWT `sub`(userId)로 UserAccount 조회 → distinct tenant_id → Tenant 엔티티 조회 (status=ACTIVE).

### 1.3 응답 형식

```json
{
  "status": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": [
    { "id": 1, "name": "Tenant A", "domain": "TENANT_A" },
    { "id": 2, "name": "Tenant B", "domain": "TENANT_B" }
  ],
  "success": true
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | Long | Tenant 식별자 |
| `name` | String | Tenant 표시명 |
| `domain` | String | Tenant `code` (서브도메인 대체용, 현재 BE에 domain 컬럼 없음) |

### 1.4 주의사항

- **X-Tenant-ID**: JWT에 `tenant_id` 클레임 필요 (로그인 시 설정). Tenant 선택 전 호출 시 로그인 시 사용한 tenant_id가 JWT에 포함됨.
- **domain**: Tenant 엔티티에 `domain` 컬럼 없음. `code`를 domain 대체로 사용. 추후 domain 컬럼 추가 시 변경 가능.

---

## 2. Profiles API 응답 필드 확인

### 2.1 확인 결과

`GET /api/synapse/admin/profiles` 응답 필드:

| BE 필드 | FE 매핑 | 타입 | 비고 |
|---------|---------|------|------|
| `profileId` | `id` | **Long (number)** | ✅ |
| `profileName` | `name` | **String** | ✅ |
| `isDefault` | `isDefault` | **Boolean** | ✅ |

FE에서 `profileId` → `id`, `profileName` → `name`으로 매핑하여 사용하면 됩니다.

---

## 3. Config Profile CRUD API 확인

### 3.1 API 목록 (현재 스펙대로 동작)

| Method | Path | 용도 |
|--------|------|------|
| POST | `/api/synapse/admin/profiles` | 프로파일 생성 |
| PUT | `/api/synapse/admin/profiles/{profileId}` | 프로파일 수정 |
| DELETE | `/api/synapse/admin/profiles/{profileId}` | 프로파일 삭제 |
| PUT | `/api/synapse/admin/profiles/{profileId}/default` | 기본 프로파일 설정 |

### 3.2 제약사항

| 상황 | HTTP | 에러 |
|------|------|------|
| 기본 프로파일 삭제 시도 | 400 | `"기본 프로파일은 삭제할 수 없습니다. 다른 프로파일을 기본으로 지정한 후 삭제하세요."` |
| 한도 정책 또는 PII 정책 참조 중 삭제 시도 | 409 | `"한도 정책 또는 PII 정책이 참조 중입니다. 먼저 제거하세요."` |
| 프로파일 없음 | 404 | `"프로파일을 찾을 수 없습니다."` |
| 프로파일명 중복 | 409 | `"이미 존재하는 프로파일명입니다."` |

---

## 4. Audit API 쿼리 파라미터 지원

### 4.1 Synapse 감사 로그 API

**경로**: `GET /api/synapse/audit/events` (※ `/api/synapse/audit-logs` 아님)

### 4.2 지원 쿼리 파라미터

| 파라미터 | BE 매핑 | 지원 | 설명 |
|----------|---------|------|------|
| `category` | event_category | ✅ | ADMIN, POLICY, ACTION, INTEGRATION |
| `type` | event_type | ✅ | UPDATE, CREATE, DELETE, BULK_UPDATE 등 |
| `resourceType` | resource_type | ✅ | DATA_PROTECTION, PII_POLICY, PROFILE 등 |
| `resourceId` | resource_id | ✅ | 문자열 |
| `from`, `to` | - | ✅ | ISO-8601 timestamptz |
| `page`, `size`, `sort` | - | ✅ | 페이지네이션 |

### 4.3 FE 연동 예시

View Audit 링크 이동 시:

```
/synapse/audit?category=ADMIN&type=UPDATE&resourceType=DATA_PROTECTION
```

FE에서 감사 로그 페이지 로드 시 API 호출:

```
GET /api/synapse/audit/events?category=ADMIN&type=UPDATE&resourceType=DATA_PROTECTION&page=0&size=20
```

**주의**: `X-Tenant-ID` 헤더 필수.

---

## 5. 요약

| # | 항목 | 결과 |
|---|------|------|
| 1 | Tenant 목록 API | ✅ `GET /api/admin/tenants` 신규 구현 |
| 2 | Profiles API 필드/타입 | ✅ profileId(Long), profileName(String), isDefault(Boolean) |
| 3 | Config Profile CRUD | ✅ 동작 확인, 제약사항 문서화 |
| 4 | Audit API 쿼리 파라미터 | ✅ category, type, resourceType 지원 (`/api/synapse/audit/events`) |

---

*문서 끝*
