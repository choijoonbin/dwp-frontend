# 로그인 및 권한 API — 프론트엔드 전달 문서

- **작성일**: 2026-01-29
- **대상**: 로그인·권한 관련 API 및 역할별 메뉴 권한 정의 (화면 제어용)
- **Base URL**: Gateway 기준 `http://localhost:8080` (또는 배포 도메인)

---

## 1. 공통 사항

### 1.1 Base Path 및 인증

| 구분 | 내용 |
|------|------|
| **Gateway** | 모든 요청은 Gateway(8080) 경유 |
| **Auth API** | `/api/auth/**` → Auth 서버 |
| **Admin API** | `/api/admin/**` → Auth 서버 (사용자/역할/메뉴 등) |
| **인증** | `POST /api/auth/login`으로 JWT 발급 후, 이후 요청에 `Authorization: Bearer <JWT>` 필수 |
| **테넌트** | `X-Tenant-ID` 헤더 권장 (BIGINT, 예: 1). 미제공 시 JWT의 tenant_id 사용 가능 |

### 1.2 응답 형식

- **성공**: `ApiResponse<T>` → `{ "status": "SUCCESS", "message": "...", "data": { ... }, "timestamp": "..." }`
- **실패**: `{ "status": "ERROR", "message": "...", "errorCode": "E3000", "timestamp": "..." }`
- **data** 안에 실제 페이로드가 들어갑니다.

---

## 2. 로그인 API

### 2.1 LOCAL 로그인

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 로그인 및 JWT 발급 |

**Request Body**
```json
{
  "username": "admin",
  "password": "admin1234!",
  "tenantId": 1
}
```

**Response (data)**  
- `accessToken`: JWT 문자열 (Authorization 헤더에 사용)
- `tokenType`: "Bearer"
- `expiresIn`: 초 단위
- 기타 사용자/테넌트 정보 등 (구현에 따라 필드 상이)

**비고**
- 로그인 성공 시 `sys_login_histories`에 기록되며, 사용자별 마지막 로그인 시간(`lastLoginAt`)이 갱신됩니다.
- MFA(2단계 인증) 컬럼(`mfaEnabled`)이 추가되어 있으며, 향후 `true`인 사용자는 2FA 검증 플로우 적용 예정입니다.

### 2.2 SSO (OIDC/SAML)

- OIDC: `GET /api/auth/oidc/login?providerKey=AZURE_AD` → 리다이렉트, 콜백에서 JWT 발급
- SAML: `GET /api/auth/saml/login?providerKey=...` 등 (구현 정책에 따름)

---

## 3. 인증/권한 조회 API

### 3.1 내 정보 조회

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/auth/me` | 현재 사용자 정보 (JWT 기반) |

**Headers**: `Authorization: Bearer <JWT>`, `X-Tenant-ID` (선택)

**Response (data)**: 사용자 ID, 테넌트 ID, 표시명, 이메일, 역할 목록 등 (MeResponse 구조)

---

### 3.2 내 권한 목록 조회 (화면 제어용 핵심 API)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/auth/permissions` | 현재 사용자가 가진 **모든 권한** 목록 (리소스별 권한 코드) |

**Headers**: `Authorization: Bearer <JWT>`, `X-Tenant-ID` (선택)

**Response (data)**  
- 타입: `List<PermissionDTO>`
- 각 항목 예:
  - `resourceType`: "MENU", "UI_COMPONENT" 등
  - `resourceKey`: 메뉴/리소스 키 (예: `menu.autonomous-operations.cases`)
  - `resourceName`: 표시명
  - `permissionCode`: "VIEW", "USE", "EDIT", "APPROVE", "EXECUTE"
  - `permissionName`: "조회", "사용", "편집", "승인", "실행"
  - `effect`: "ALLOW"

**프론트 사용 예**
- `resourceKey` + `permissionCode` 조합으로 “이 메뉴에 VIEW가 있는지”, “EDIT/APPROVE/EXECUTE가 있는지” 판단
- 메뉴 노출: 해당 메뉴 `resourceKey`에 대해 `permissionCode === "VIEW"` 인 항목이 있으면 노출
- 버튼 활성화: 해당 리소스에 대해 `USE`/`EDIT`/`APPROVE`/`EXECUTE`가 있으면 해당 액션 허용

---

### 3.3 메뉴 트리 조회 (사이드바 렌더링용)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/auth/menus/tree` | **권한 기반으로 필터링된** 메뉴 트리 (VIEW 권한이 있는 메뉴만 포함) |

**Headers**: `Authorization: Bearer <JWT>`, `X-Tenant-ID` (선택)

**Response (data)**  
- `menus`: `List<MenuNode>` (트리 구조)
- `groups`: 그룹별 메뉴 목록 (선택적)

**MenuNode 필드**
- `id`: sysMenuId
- `parentId`: 부모 메뉴 ID
- `enabled`: 활성화 여부
- `permissionKey` / `menuKey`: 메뉴 키 (예: `menu.autonomous-operations.cases`)
- `menuName`: 화면 노출명
- `path`: 라우트 경로 (예: `/cases`)
- `icon`: 아이콘 키
- `group`: 메뉴 그룹 (예: SynapseX, MANAGEMENT)
- `depth`, `sortOrder`
- `children`: 자식 메뉴 목록

**비고**
- 이 API는 “VIEW 권한이 있는 메뉴만” 반환합니다. 따라서 **메뉴 노출 여부는 이 트리만으로도 제어** 가능합니다.
- **탭/버튼/액션** 수준 제어는 `GET /api/auth/permissions` 결과로 `resourceKey` + `permissionCode`를 보고 판단하면 됩니다.

---

## 4. 권한 그룹(역할) 정의

### 4.1 역할 코드 (DB) vs 표시명

| 역할 코드 (code) | 표시명 (name) | 약어 | 설명 |
|------------------|---------------|------|------|
| **ADMIN** | Admin | A | 정책·보안·거버넌스 관리자. PII/가드레일/자율성, Tenant Scope, Admin 3탭(P). Synapse 리모트 권한 제한. |
| **SYNAPSEX_ADMIN** | SynapseX_Admin | SA | 시스템 운영 및 비즈니스 결정권자. 케이스·조치 승인, 프로파일 기본값, 정합성/감사·Export. |
| **SYNAPSEX_OPERATOR** | SynapseX_Operator | SO | 실무 운영 및 케이스 처리자. 승인 요청만 가능, 승인권 없음. |
| **SYNAPSEX_VIEWER** | SynapseX_Viewer | SV | 단순 조회 및 모니터링. 읽기 전용. |

- 사용자는 여러 역할을 가질 수 있습니다. 권한은 **모든 역할의 합집합**으로 적용됩니다.
- 역할 목록은 `GET /api/auth/me` 또는 `GET /api/admin/users/{id}/roles` 등으로 조회 가능합니다.

### 4.2 권한 코드 (Permission) — 화면 관점 매핑

백엔드 권한 코드 5종과, 화면에서 사용할 레벨 정의는 아래와 같습니다.

| 백엔드 코드 (permissionCode) | 권한명 | 화면 레벨 | 용도 (프론트 제어) |
|------------------------------|--------|-----------|---------------------|
| **VIEW** | 조회 | R (Read) | 메뉴/페이지 노출, 조회/검색/필터/정렬/페이징/상세 열람 |
| **USE** | 사용 | W (Work) | 코멘트/태깅/할당/상태 변경/요청 생성(승인 요청 포함), 저장 뷰 개인 저장 |
| **EDIT** | 편집 | W (Work) / P (Policy) | 정책·프로파일·가드레일·PII 설정 등 편집(메뉴에 따라 W 또는 P로 해석) |
| **APPROVE** | 승인 | A (Approve) | 승인/반려/요청 정보 회신 등 “결정” 트리거 |
| **EXECUTE** | 실행 | A (Execute) | 실행/재시도/롤백 등 “조치” 트리거 |

- **R (Read)** = VIEW  
- **W (Work)** = USE + EDIT (해당 리소스에서 작업·편집이 허용되는 경우)  
- **A (Approve/Execute)** = APPROVE + EXECUTE  
- **P (Policy/Admin)** = 정책/거버넌스 리소스에서의 EDIT

프론트에서는 `GET /api/auth/permissions`로 받은 `resourceKey`별 `permissionCode` 목록으로 위 레벨을 계산하면 됩니다.

---

## 5. 메뉴 키 목록 (resourceKey)

아래는 Synapse/엔터프라이즈 메뉴 및 Auth Admin 메뉴의 **resourceKey** 목록입니다.  
`GET /api/auth/permissions`의 `resourceKey`와 `GET /api/auth/menus/tree`의 `menuKey`와 동일하게 사용됩니다.

### 5.1 통합 관제 센터 / 자율 운영 센터

| 메뉴 키 (resourceKey) | 메뉴명 (참고) |
|------------------------|----------------|
| menu.command-center | 통합 관제 센터 |
| menu.autonomous-operations | 자율 운영 센터 |
| menu.autonomous-operations.cases | 케이스 작업함 |
| menu.autonomous-operations.anomalies | 이상 징후 탐지 |
| menu.autonomous-operations.optimization | 채권·채무 최적화 |
| menu.autonomous-operations.actions | 조치 실행 센터 |
| menu.autonomous-operations.archive | 조치 이력 보관함 |

### 5.2 원천 데이터·이력 허브

| 메뉴 키 (resourceKey) | 메뉴명 (참고) |
|------------------------|----------------|
| menu.master-data-history | 원천 데이터·이력 허브 |
| menu.master-data-history.documents | 전표 조회 |
| menu.master-data-history.open-items | 미결제 항목 |
| menu.master-data-history.entities | 거래처 허브 |
| menu.master-data-history.lineage | 계보·근거 뷰어 |

### 5.3 지식·정책 허브

| 메뉴 키 (resourceKey) | 메뉴명 (참고) |
|------------------------|----------------|
| menu.knowledge-policy | 지식·정책 허브 |
| menu.knowledge-policy.rag | 규정·문서 라이브러리 |
| menu.knowledge-policy.policies | 정책 프로파일 |
| menu.knowledge-policy.guardrails | 조치 가드레일 |
| menu.knowledge-policy.dictionary | 용어·코드 사전 |
| menu.knowledge-policy.feedback | 피드백·라벨링 |

### 5.4 대사·감사 센터

| 메뉴 키 (resourceKey) | 메뉴명 (참고) |
|------------------------|----------------|
| menu.reconciliation-audit | 대사·감사 센터 |
| menu.reconciliation-audit.reconciliation | 정합성 대사 리포트 |
| menu.reconciliation-audit.action-recon | 조치 결과 대사 |
| menu.reconciliation-audit.audit | 감사 추적 로그 |
| menu.reconciliation-audit.analytics | 효과·성과 분석 |

### 5.5 거버넌스·설정 (시스템 관리, Admin 3탭 포함)

| 메뉴 키 (resourceKey) | 메뉴명 (참고) |
|------------------------|----------------|
| menu.governance-config | 거버넌스·설정 |
| menu.governance-config.governance | 자율성·통제 설정 |
| menu.governance-config.agent-config | 에이전트 구성 관리 |
| menu.governance-config.integrations | 연동·데이터 운영 |
| menu.governance-config.admin | 시스템 관리 (Admin 3탭: Users / Tenant Scope / PII) |

### 5.6 Auth Admin 메뉴 (DWP 통합 Admin)

| 메뉴 키 (resourceKey) | 메뉴명 (참고) |
|------------------------|----------------|
| menu.admin | Admin |
| menu.admin.monitoring | 통합 모니터링 |
| menu.admin.users | 사용자 관리 |
| menu.admin.roles | 역할 관리 |
| menu.admin.resources | 리소스 관리 |
| menu.admin.audit | 감사 로그 |
| menu.admin.menus | 메뉴 관리 |
| menu.admin.codes | 코드 관리 |
| menu.admin.code-usages | 코드 사용정의 |

---

## 6. 역할별 메뉴 권한 매트릭스 (화면 제어용)

아래는 **역할별로 각 메뉴(resourceKey)에 부여된 권한**을 정리한 것입니다.  
프론트에서는 `GET /api/auth/permissions` 결과와 아래 매트릭스를 함께 참고해, “이 역할이면 이 메뉴에서 어떤 버튼/탭을 켜고 끌지” 결정할 수 있습니다.

**권한 약어**
- **R** = VIEW (조회, 메뉴 노출)
- **W** = USE + EDIT (작업·편집)
- **A** = APPROVE + EXECUTE (승인·실행)
- **P** = EDIT (정책/설정 편집, Admin 3탭 등)

**표 해석**
- 셀에 "R"만 있으면 해당 메뉴에 VIEW만 부여 → 메뉴 노출 + 읽기 전용.
- "R/W"면 VIEW + USE + EDIT → 메뉴 노출 + 작업/편집 버튼 허용.
- "R/W/A"면 VIEW + USE + EDIT + APPROVE + EXECUTE → 메뉴 노출 + 작업 + 승인/실행 버튼 허용.
- "P"만 또는 "R"+"P"는 정책/설정 편집 권한 (Tenant Scope, PII, 가드레일 등).

### 6.1 통합 관제 센터 / 자율 운영 센터

| 메뉴 키 | SA | SO | SV | A |
|---------|----|----|----|---|
| menu.command-center | R | R | R | R |
| menu.autonomous-operations | R | R | R | R |
| menu.autonomous-operations.cases | R/W/A | R/W | R | R |
| menu.autonomous-operations.anomalies | R/W/A | R/W | R | R |
| menu.autonomous-operations.optimization | R/W/A | R/W | R | R |
| menu.autonomous-operations.actions | R/W/A | R/W | R | R |
| menu.autonomous-operations.archive | R/W/A | R/W | R | R |

- **SA**: 케이스·조치 승인, 재시도/롤백 요청, Bulk 승인 등 A 권한 사용.
- **SO**: 케이스 처리, 조치 요청(승인 요청)만 가능. 승인(APPROVE)/실행(EXECUTE) 버튼은 비활성화.
- **SV**: 모든 메뉴 R만 → 목록/상세 조회만.
- **A**: 운영 처리 없이 조회(감사/분석)만. 케이스 상태 변경/조치 실행 버튼 비활성화.

### 6.2 원천 데이터·이력 허브

| 메뉴 키 | SA | SO | SV | A |
|---------|----|----|----|---|
| menu.master-data-history | R | R | R | R |
| menu.master-data-history.documents | R/W | R | R | R |
| menu.master-data-history.open-items | R/W | R | R | R |
| menu.master-data-history.entities | R/W | R | R | R |
| menu.master-data-history.lineage | R/W | R | R | R |

- SA/SO는 “케이스로 등록” 등 요청/작업(W) 가능. A는 조회만.

### 6.3 지식·정책 허브

| 메뉴 키 | SA | SO | SV | A |
|---------|----|----|----|---|
| menu.knowledge-policy | R | R | R | R |
| menu.knowledge-policy.rag | R/W(제한) | R | R | P |
| menu.knowledge-policy.policies | R/W(제한) | R | R | P |
| menu.knowledge-policy.guardrails | R | R | R | P |
| menu.knowledge-policy.dictionary | R/W(옵션) | R | R | P |
| menu.knowledge-policy.feedback | R/W | R/W | R | P |

- **SA**: 프로파일 기본값 지정 등 제한적 W. 정책/가드레일 편집은 P가 아닌 W 수준만.
- **A**: RAG 업로드·버전, 정책/가드레일/용어·코드/피드백 반영 등 P(편집) 담당. 해당 편집 버튼 활성화.

### 6.4 대사·감사 센터

| 메뉴 키 | SA | SO | SV | A |
|---------|----|----|----|---|
| menu.reconciliation-audit | R | R | R | R |
| menu.reconciliation-audit.reconciliation | R | R | R | R |
| menu.reconciliation-audit.action-recon | R/W/A | R | R | R/A |
| menu.reconciliation-audit.audit | R | R | R | R |
| menu.reconciliation-audit.analytics | R | R | R | R |

- **SA**: 조치 결과 대사에서 승인/실행(A) 가능.
- **A**: 감사·승인 목적으로 action-recon에 R/A. Export(감사 패키지)는 A/SA 역할로 제한 권장.

### 6.5 거버넌스·설정 (시스템 관리, Admin 3탭)

| 메뉴 키 | SA | SO | SV | A |
|---------|----|----|----|---|
| menu.governance-config | R | R | R | R |
| menu.governance-config.governance | R | R | R | P |
| menu.governance-config.agent-config | R | R | R | P |
| menu.governance-config.integrations | R/W | R | R | R |
| menu.governance-config.admin | R/W | R | R | P |

**Admin 3탭 (menu.governance-config.admin 내부)**
- **Users 탭**: SA R, SO/SV 숨김 권장, A R (조회 및 Auth 시스템 링크).
- **Tenant Scope 탭**: SA R/W(토글), SO/SV R, A P/W(SoD 포함).
- **PII & Encryption 탭**: SA/SO/SV R(정책 조회), A P(편집/승인).

프론트는 `resourceKey === 'menu.governance-config.admin'`에 대해 VIEW가 있으면 “시스템 관리” 메뉴를 노출하고, 탭별로는 위 정책에 따라 Users/Tenant Scope/PII 탭 노출·편집·승인 버튼을 제어하면 됩니다.

### 6.6 Auth Admin 메뉴 (menu.admin.*)

- **ADMIN(A)** 역할만 `menu.admin.*`에 VIEW, USE, EDIT, APPROVE, EXECUTE 부여.
- **SA/SO/SV**는 `menu.admin.*` 리소스에 대한 권한이 없으므로, Auth Admin 메뉴는 A(Admin) 로그인 시에만 노출하면 됩니다.

---

## 7. 프론트 화면 제어 가이드

### 7.1 메뉴 노출

1. **사이드바/네비게이션**: `GET /api/auth/menus/tree` 응답만으로 렌더링. (이미 VIEW 권한으로 필터링됨)
2. **특정 메뉴 키로 제어**: `GET /api/auth/permissions`에서 `resourceKey === 'menu.xxx.yyy'` 이고 `permissionCode === 'VIEW'`인 항목이 있으면 해당 메뉴 노출.

### 7.2 버튼/액션 제어

- **저장/편집/할당/상태 변경/요청 생성**: 해당 메뉴(또는 리소스)에 `USE` 또는 `EDIT`가 있으면 활성화.
- **승인/반려/요청 정보**: `APPROVE`가 있으면 활성화.
- **실행/재시도/롤백**: `EXECUTE`가 있으면 활성화.
- **정책/프로파일/가드레일/PII 편집**: 해당 리소스에 `EDIT`가 있고 역할이 A(정책 담당)인 경우 활성화. (필요 시 역할 코드 `ADMIN` 여부도 함께 확인)

### 7.3 Admin 3탭 (Users / Tenant Scope / PII)

- **Users**: SA는 조회만, SO/SV는 탭 자체 숨김, A는 조회 + Auth 사용자 관리 링크.
- **Tenant Scope**: SA는 토글(회사/통화) R/W, SO/SV는 조회만, A는 P/W(SoD 포함 편집).
- **PII & Encryption**: SA/SO/SV는 정책 조회(R), A는 편집/승인(P).  
위는 권한 매트릭스와 동일하므로, `permissions` 리스트에서 `menu.governance-config.admin`에 대해 VIEW/USE/EDIT가 있는지와, 사용자 역할(ADMIN vs SYNAPSEX_*)을 조합해 탭·버튼을 제어하면 됩니다.

---

## 8. 시드 계정 (개발/검증용)

| principal | 비밀번호 | 역할 (code) |
|-----------|----------|-------------|
| admin | admin1234! | ADMIN |
| synapsex_admin | admin1234! | SYNAPSEX_ADMIN |
| synapsex_operator | admin1234! | SYNAPSEX_OPERATOR |
| synapsex_viewer | admin1234! | SYNAPSEX_VIEWER |

- 비밀번호는 모두 동일(admin1234!)하며, MFA(mfaEnabled)는 기본 false입니다.

---

## 9. 관련 Admin API (참고)

- **사용자 목록/상세**: `GET /api/admin/users`, `GET /api/admin/users/{id}` (헤더: X-Tenant-ID, 권한: menu.admin.users VIEW)
- **사용자별 역할**: `GET /api/admin/users/{id}/roles`, `PUT /api/admin/users/{id}/roles` (권한: menu.admin.users VIEW/EDIT)
- **역할 목록/상세**: `GET /api/admin/roles`, `GET /api/admin/roles/{id}` (권한: menu.admin.roles VIEW)
- **역할별 권한**: `GET /api/admin/roles/{id}/permissions` (권한: menu.admin.roles VIEW)

위 API들은 Auth 서버에서 제공하며, Gateway를 통해 `/api/admin/**`로 호출합니다.  
로그인·메뉴·권한 제어는 **§2~§4, §6~§7**을 기준으로 구현하시면 됩니다.
