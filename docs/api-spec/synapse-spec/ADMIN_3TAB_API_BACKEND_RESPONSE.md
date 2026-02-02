# Admin 3탭 화면 기준 API 보완/추가 요청 — 백엔드 회신

- **작성일**: 2026-01-29
- **최종 수정일**: 2026-02-02 (TAB 1 Users API 상세 스펙 반영)
- **대상**: SynapseX Admin 3탭(Users / Tenant Scope / PII & Encryption) API 검증 및 제공 가능 범위
- **회신 형식**: 요청서 5)에 따른 탭별 3가지 + 방향성 피드백 + 검증 항목

---

## 0. 공통 규칙 (확인)

| 항목 | 상태 | 비고 |
|------|------|------|
| Base Path | 유지 | `/api/synapse/**` (Admin/Audit) + `/api/admin/**` (Users → Auth) |
| Header X-Tenant-ID | 필수 | BIGINT, 미제공 시 400 |
| Header X-User-ID | 선택 | 감사/정책 변경 시 행위자 식별 |
| Response Wrapper | 통일 | `ApiResponse<T>` (dwp-core) |
| 권한 | 유지 | 기존 메뉴 권한 체계; endpoint별 scope는 Auth 정책에 따름 |
| Audit | 적용 | 정책/관리 변경 시 `audit_event_log` (category=ADMIN) 기록 (SynapseX Admin API 한정) |

---

## 1. 탭별 회신 (3가지씩)

### TAB 1) Users

| # | 항목 | 답변 |
|---|------|------|
| 1 | **제공 가능/불가** | **제공 가능** (이번 Phase 포함). 단, **SynapseX가 아닌 공통 Auth API를 그대로 사용**합니다. |
| 2 | **SoT 위치** | **dwp-auth-server (공통 Auth)**. 사용자/역할/부서/계정의 SoT는 `dwp_auth` DB (com_users, com_roles 등). SynapseX는 Users 데이터를 보유하지 않으며 proxy하지 않습니다. |
| 3 | **사용 가능 API / 신규 구현 범위** | **기존 Auth API 사용.** Gateway 경유 시 **`/api/admin/users`** (Auth 서버로 라우팅). 목록·상세·수정·status·reset-password·roles CRUD 모두 제공. **SynapseX에 `/synapse/admin/users` 신규 구현 없음.** |

**Phase 범위 확답**: Users는 **이번 Phase에 제공 가능**. 탭 숨김/Read-only로 바꿀 필요 없음. API는 Auth **`/api/admin/users`** 를 사용합니다.

---

#### Users API 상세 (프론트 구현용)

**Base**: Gateway 경유 `GET/POST/PATCH/PUT/DELETE /api/admin/users/**` → Auth 서버.  
**헤더**: `X-Tenant-ID` 필수, `Authorization: Bearer <JWT>` 필수.  
**권한**: `menu.admin.users` VIEW(조회) / EDIT(생성·수정·삭제·역할·비밀번호).

---

##### 1) 목록 조회 — `GET /api/admin/users`

| 구분 | 내용 |
|------|------|
| **용도** | Users 탭 테이블 데이터. SynapseX Admin에서는 **해당 앱 사용자만**, DWP 통합 어드민에서는 **플랫폼 전체** 조회 가능. |

**Query 파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `page` | int | 아니오 | 페이지 번호 (1-base). 기본 1. |
| `size` | int | 아니오 | 페이지 크기. 기본 20, 최대 200. |
| `keyword` | string | 아니오 | 이름(displayName)·이메일·로그인ID(principal) 검색. **appCode/roleIds 사용 시 해당 스코프 내에서만 검색.** |
| `appCode` | string | 아니오 | **앱 코드.** 예: `SYNAPSEX` → 해당 앱 역할(SYNAPSEX_ADMIN, SYNAPSEX_OPERATOR, SYNAPSEX_VIEWER)을 **하나라도** 가진 사용자만 조회. **미전달 시 플랫폼 전체 사용자.** SynapseX Admin Users 탭에서는 **반드시 `appCode=SYNAPSEX`** 로 호출. |
| `roleIds` | long[] | 아니오 | 역할 ID 목록. 해당 역할 중 **하나라도** 가진 사용자만 조회. `roleIds=2&roleIds=3` 형태. `appCode` 있으면 무시. |
| `roleId` | long | 아니오 | 단일 역할 ID. 해당 역할 사용자만 조회. `appCode`/`roleIds` 없을 때만 적용. |
| `departmentId` | long | 아니오 | 부서 ID 필터. |
| `status` | string | 아니오 | ACTIVE, INVITED 등. |
| `idpProviderType` / `loginType` | string | 아니오 | LOCAL, OIDC 등 로그인 유형. |

**호출 예**

- **SynapseX Admin Users 탭**: `GET /api/admin/users?appCode=SYNAPSEX&page=1&size=20`  
  (이름 검색 시): `GET /api/admin/users?appCode=SYNAPSEX&keyword=김&page=1&size=20`
- **DWP 통합 어드민 (전체)**: `GET /api/admin/users?page=1&size=20` (appCode 없음)

**Response (data)** — `PageResponse<UserSummary>`

```json
{
  "items": [ { "comUserId", "tenantId", "userName", "loginId", "email", "status", "mfaEnabled", "lastLoginAt", "roles", "departmentName", "departmentId", "createdAt", "updatedAt", "providerType" } ],
  "page": 1,
  "size": 20,
  "totalItems": 100,
  "totalPages": 5
}
```

**items[] 필드 (UserSummary)**

| 필드 | 타입 | 설명 |
|------|------|------|
| `comUserId` | long | 사용자 ID. UI에서 "U-1001" 등 표시 시 사용. |
| `tenantId` | long | 테넌트 ID. |
| `userName` | string | 표시명(displayName). |
| `loginId` | string | 로그인 ID(principal). |
| `email` | string | 이메일. |
| `status` | string | ACTIVE, INVITED 등. |
| `mfaEnabled` | boolean | MFA(2단계 인증) 사용 여부. 목록에서 "Enabled" / "Off" 표시용. |
| `lastLoginAt` | string (ISO 8601) / null | 마지막 로그인 시각. 없으면 null → UI "-" 등. |
| `roles` | array | **역할 목록.** Users 탭 Role 컬럼 표시용. |
| `departmentName` | string / null | 부서명. |
| `departmentId` | long / null | 부서 ID. |
| `createdAt`, `updatedAt` | string (ISO 8601) | 생성/수정 시각. |
| `providerType` | string / null | 로그인 유형. 예: LOCAL, OIDC. **FE 그리드 "로그인 유형" 컬럼에 매핑.** 없으면 "-" 표시. |

**roles[] 요소 (UserRoleInfo)**

| 필드 | 타입 | 설명 |
|------|------|------|
| `comRoleId` | long | 역할 ID. |
| `roleCode` | string | 예: SYNAPSEX_ADMIN, ADMIN. |
| `roleName` | string | 표시명. 예: SynapseX_Admin, Admin. |
| `subjectType` | string | USER / DEPARTMENT. |
| `isDepartmentBased` | boolean | 부서 기반 역할 여부. |
| `assignedAt` | string / null | 할당 시각. |

- **Role 컬럼**: `roles[0].roleName` 또는 복수 역할 시 `roles.map(r => r.roleName).join(', ')` 등으로 표시.

---

##### 2) 상세 조회 — `GET /api/admin/users/{comUserId}`

- **Response (data)**: UserDetail — 목록 필드 + `accounts[]`(계정 목록, lastLoginAt 포함), `roles[]`(동일 구조).

---

##### 3) 기타 엔드포인트 (요약)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/admin/users` | 사용자 생성. body: CreateUserRequest (userName, email, loginId, status, mfaEnabled 등). |
| PATCH / PUT | `/api/admin/users/{comUserId}` | 사용자 수정. body: UpdateUserRequest. |
| POST | `/api/admin/users/{comUserId}/status` | 상태 변경. body: { "status": "ACTIVE" } 등. |
| POST | `/api/admin/users/{comUserId}/reset-password` | 비밀번호 재설정. |
| GET | `/api/admin/users/{comUserId}/roles` | 사용자 역할 목록. |
| PUT | `/api/admin/users/{comUserId}/roles` | 사용자 역할 일괄 설정. body: { "roleIds": [1,2], "replaceExisting": true } 등. |
| POST | `/api/admin/users/{comUserId}/roles` | 역할 추가. body: { "roleId": 2 }. |
| DELETE | `/api/admin/users/{comUserId}/roles/{comRoleId}` | 역할 제거. |
| DELETE | `/api/admin/users/{comUserId}` | 사용자 삭제(soft delete). |

---

##### 4) 화면 컬럼 ↔ API 매핑 (참고)

| 화면 컬럼 | API 필드 | 비고 |
|-----------|----------|------|
| User (이름, 이메일, U-ID) | `userName`, `email`, `comUserId` | U-ID는 "U-" + comUserId 등으로 포맷. |
| Role | `roles` | `roles[].roleName` 또는 roleCode. |
| Status | `status` | ACTIVE, INVITED 등. |
| MFA | `mfaEnabled` | true → Enabled, false → Off. |
| Last login | `lastLoginAt` | null이면 "-". |

---

### TAB 2) Tenant Scope

| # | 항목 | 답변 |
|---|------|------|
| 1 | **제공 가능/불가** | **현재는 불가.** Company Codes Scope / Currencies Scope / SoD용 **전용 테이블·API가 없음.** 신규 구현 시 제공 가능. |
| 2 | **필요한 테이블 존재 여부** | **없음.** 현재 SynapseX에는 `config_profile`, `rule_threshold`(한도 정책, dimension/waers 등), `policy_pii_field`, `policy_action_guardrail` 등만 있음. **“테넌트가 사용하는 회사코드(BUKRS) 목록(enable/disable)”**, **“허용 통화(waers) 목록(enable/disable)”** 를 저장하는 테이블은 없음. SoD는 `policy_action_guardrail`(심각도별 조치)가 유사하나 “SoD 룰 목록 + enabled” 전용 구조는 없음. |
| 3 | **신규 API 범위** | **신규 구현 필요.** 권장 범위: (1) **GET /api/synapse/admin/tenant-scope** — `companyCodes: [{ bukrs, enabled }]`, `currencies: [{ waers, enabled }]`, `sod: { enabled, rulesSummary[] }`. (2) **PUT /api/synapse/admin/tenant-scope/company-codes/bulk** — body `[{ bukrs, enabled }]`. (3) **PUT /api/synapse/admin/tenant-scope/currencies/bulk** — body `[{ waers, enabled }]`. (4) SoD 편집(룰 CRUD)은 Phase2로 두고, **GET /api/synapse/admin/sod** 로 **enabled + rulesSummary** 만 제공해도 UI 완성도 확보 가능. |

**구현 시 필요 사항**

- 신규 마이그레이션: 테넌트별 **company_code_scope** (또는 tenant_scope), **currency_scope** 테이블(또는 config_kv/전용 테이블) 및 필요 시 SoD 메타 테이블.
- 모든 변경은 `audit_event_log` (category=ADMIN, resource_type 등) 기록.

---

### TAB 3) PII & Encryption

| # | 항목 | 답변 |
|---|------|------|
| 1 | **Masking 가능/불가** | **가능.** 현재 API로 “PII Masking Policy” UI 완성 가능. |
| 2 | **Security settings 저장 필요/불필요** | **현재 미구현.** at-rest 암호화, audit retention years, export 승인 여부 등은 **저장/조회 API 없음.** 이번 Phase에서 “표시용(Informational)”으로 두고 저장은 Phase2로 미루는 방안에 **백엔드 동의.** 필요 시 Phase2에서 **GET/PUT /api/synapse/admin/security-settings** (profileId 또는 tenantId 기반) 추가. |
| 3 | **API 확정** | **Masking:** (1) **GET /api/synapse/admin/pii-fields/catalog** — 필드 목록. (2) **GET /api/synapse/admin/pii-policies?profileId=** — 프로파일별 정책. (3) **PUT /api/synapse/admin/pii-policies/bulk** — 일괄 저장, handling 값 검증(ALLOW, MASK, HASH_ONLY, ENCRYPT, FORBID). **Encryption/Retention/Export:** 이번 Phase에서는 **API 없음.** 프론트는 우측 박스를 “Informational(고정)” 처리 가능. |

---

## 2. 검증(완료 기준) — 백엔드 확인 항목

구현/수정 후 아래를 확인합니다.

| 항목 | 내용 |
|------|------|
| Audit | 모든 Admin 설정 변경은 `audit_event_log`에 기록, category=ADMIN, resource_type/resource_id 의미 있게 채움, before/after 또는 diff_json 가능 범위 내 기록 |
| 멀티테넌트 | X-Tenant-ID로 모든 데이터 격리 |
| 페이지네이션 | 목록 응답은 **items + total**(또는 totalItems) + **pageInfo**(또는 page, size, totalPages) 규격 통일 (Synapse 신규 API는 items + total + pageInfo 권장) |
| 오류 코드 | default profile 삭제 400, 참조 존재 시 삭제 409, handling invalid 400, 권한 부족 403 |

---

## 3. “불필요하게 설계된 화면/기능” 조정 — 백엔드 의견

요청서 4) 방향성에 대해 **백엔드 동의**합니다.

| 제안 | 백엔드 의견 |
|------|-------------|
| Users 탭은 전사 공통 Auth/RBAC로 이동, SynapseX에서는 링크만 | **동의.** Users SoT는 Auth이므로 SynapseX에 Users API를 두지 않고, 프론트는 `/api/admin/users`(Gateway → Auth)로 직접 연동. Synapse 화면에서 “사용자 관리”는 링크 또는 동일 Gateway 하위 경로로 제공. |
| Tenant Scope는 프로파일/정책 기반 운영 범위(회사코드/통화/SoD enable)에 집중 | **동의.** 회사코드·통화·SoD enable 수준의 전용 API/테이블을 신규로 두고, 룰 편집(SoD CRUD)은 Phase2로 분리하는 안이 적절함. |
| PII & Encryption은 필드 마스킹/접근 워크플로우 중심, 실제 KMS는 Phase2/보안팀 협업으로 분리 | **동의.** 이번 Phase에서는 PII Masking Policy API만 확정하고, Encryption/Retention/Export는 Informational 또는 Phase2 Security Settings API로 확장. |

**SoT/구조 요약**

- **Users**: Auth(dwp_auth). SynapseX 없음.
- **Tenant Scope**: SynapseX(dwp_aura)에 신규 테이블·API 필요.
- **PII Masking**: SynapseX(dwp_aura, policy_pii_field). Encryption/Retention/Export: Phase2 또는 별도 보안 설정 테이블.

---

## 4. 요약 (탭별 한 줄)

| 탭 | 제공 | 비고 |
|----|------|------|
| **Users** | 가능 | Auth **`/api/admin/users`** 사용. SynapseX 신규 API 없음. |
| **Tenant Scope** | 신규 구현 후 가능 | 테이블·API 없음 → GET/PUT tenant-scope, company-codes/bulk, currencies/bulk, (선택) GET sod. |
| **PII & Encryption** | Masking 가능, Security 설정은 Phase2 | GET/PUT pii-fields/catalog, pii-policies, bulk 확정. security-settings는 이번 Phase 제외. |

---

*문서 끝*
