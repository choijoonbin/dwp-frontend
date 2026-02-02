# 시스템 관리(Admin) 메뉴 — FE 추가 API 요청 문서

> **작성일**: 2026-02-02  
> **대상**: 백엔드 팀  
> **참조 문서**:
> - `TENANT_SCOPE_AND_CATALOG_API_FE_HANDOVER.md`
> - `SYNAPSE_PII_ENCRYPTION_ADMIN_TAB3_result.md`
> - `SYNAPSE_ADMIN_AUDIT_API_result.md`

---

## 개요

시스템 관리(Admin) 메뉴의 3개 탭(Users, Tenant Scope, PII & Encryption) 구현 완료 후, 추가로 요청·확인이 필요한 API 및 스펙 정리입니다.

---

## 1. Tenant 목록 API (우선순위: 중)

### 1.1 요청 사항

**엔드포인트**: `GET /api/admin/tenants` 또는 `GET /api/synapse/admin/tenants` (BE 경로 협의)

**목적**: Admin 페이지 상단의 **Tenant Selector**를 동적으로 구성하기 위한 API입니다.  
현재 FE는 하드코딩된 목록 또는 단일 tenantId를 사용 중입니다.

### 1.2 필터링 요구사항

**로그인한 사용자가 속해 있는 Tenant 목록만 반환**해야 합니다.

- 사용자-테넌트 매핑은 BE에서 관리
- SSO/일반 로그인 사용자 모두 해당 사용자가 접근 가능한 tenant만 노출

### 1.3 응답 형식 (FE 기대)

```json
{
  "status": "SUCCESS",
  "message": "...",
  "data": [
    { "id": 1, "name": "Tenant A", "domain": "tenant-a.com" },
    { "id": 2, "name": "Tenant B", "domain": "tenant-b.com" }
  ],
  "success": true
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | Long (number) | ✅ | Tenant 식별자 |
| `name` | String | ✅ | Tenant 표시명 |
| `domain` | String | 선택 | 서브도메인 등 (없으면 생략 가능) |

---

## 2. Profiles API 응답 필드 확인 (우선순위: 높음)

### 2.1 참조

`SYNAPSE_ADMIN_AUDIT_API_result.md` — "A1) Config Profile" 섹션

### 2.2 요청 사항

`GET /api/synapse/admin/profiles` 응답의 **필드명 및 타입** 확인이 필요합니다.

| BE 스펙 (문서 기준) | FE 기대 매핑 | 확인 요청 |
|--------------------|--------------|-----------|
| `profileId` | `id` | `profileId`가 `number`(Long) 타입으로 반환되는지 |
| `profileName` | `name` | `profileName`이 `string` 타입으로 반환되는지 |
| `isDefault` | `isDefault` | `boolean` 타입인지 |

FE는 `profileId` → `id`, `profileName` → `name`으로 매핑하여 사용할 예정입니다.  
타입 정합성 확인 후 adapter 수정 여부를 결정하겠습니다.

---

## 3. Config Profile CRUD API (우선순위: 중, 선택)

### 3.1 참조

`SYNAPSE_ADMIN_AUDIT_API_result.md` — "A1) Config Profile" 섹션에 이미 정의됨

### 3.2 현황

- **BE**: POST/PUT/DELETE/PUT-default API 정의 완료
- **FE**: PII & Encryption 탭에서 프로파일 **목록 조회 및 선택**만 구현됨.  
  프로파일 **생성/수정/삭제** UI는 미구현

### 3.3 요청 사항

프로파일 관리(생성/수정/삭제/기본 설정) UI를 FE에서 제공할 경우, 아래 API 사용을 전제로 합니다.

| Method | Path | 용도 |
|--------|------|------|
| POST | `/api/synapse/admin/profiles` | 프로파일 생성 |
| PUT | `/api/synapse/admin/profiles/{profileId}` | 프로파일 수정 |
| DELETE | `/api/synapse/admin/profiles/{profileId}` | 프로파일 삭제 |
| PUT | `/api/synapse/admin/profiles/{profileId}/default` | 기본 프로파일 설정 |

**BE 확인 요청**: 위 API가 현재 스펙대로 동작하는지, 추가 제약사항(예: 기본 프로파일 삭제 금지 등)이 있는지 확인 부탁드립니다.

---

## 4. Audit API 쿼리 파라미터 지원 확인 (우선순위: 낮음)

### 4.1 참조

`SYNAPSE_ADMIN_AUDIT_API_result.md` — "B. Audit API" 섹션

### 4.2 FE 사용 현황

PII & Encryption 탭의 **"View Audit"** 링크가 특정 쿼리 파라미터와 함께 감사 로그 페이지로 이동합니다.

- 예시: `/synapse/audit?category=ADMIN&type=UPDATE&resourceType=DATA_PROTECTION`
- 목적: 해당 리소스 유형의 변경 이력만 초기 필터링하여 표시

### 4.3 요청 사항

감사 로그 목록 조회 API(`/api/synapse/audit-logs` 또는 동일 기능 API)가 아래 **쿼리 파라미터**를 지원하는지 확인 부탁드립니다.

| 파라미터 | 설명 | 예시 |
|----------|------|------|
| `category` | 카테고리 필터 | `ADMIN` |
| `type` | 이벤트 유형 | `UPDATE`, `CREATE`, `DELETE` |
| `resourceType` | 리소스 유형 | `DATA_PROTECTION`, `PII_POLICY`, `PROFILE` |

지원 시, FE에서 해당 파라미터로 초기 필터를 적용할 수 있습니다.  
미지원 시, FE는 전체 목록 조회 후 클라이언트 필터링으로 대체할 수 있습니다.

---

## 5. 요약

| # | 항목 | 우선순위 | 요청 유형 |
|---|------|----------|-----------|
| 1 | Tenant 목록 API | 중 | 신규 API 요청 |
| 2 | Profiles API 필드/타입 확인 | 높음 | 스펙 확인 |
| 3 | Config Profile CRUD API | 중 (선택) | 동작·제약 확인 |
| 4 | Audit API 쿼리 파라미터 | 낮음 | 필터 지원 여부 확인 |

---

*문서 끝*
