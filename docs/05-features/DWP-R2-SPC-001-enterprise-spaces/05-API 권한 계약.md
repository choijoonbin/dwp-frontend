# DWP-R2-SPC-001 API·권한 계약

## API Inventory

### Member·Space

| Method | Path                                         | 목적                        | Permission               | Idempotency | Audit         |
| ------ | -------------------------------------------- | --------------------------- | ------------------------ | ----------- | ------------- |
| GET    | `/v1/spaces`                                 | 내 Space 목록               | `APP.SPACES:VIEW`        | -           | Access metric |
| GET    | `/v1/spaces/discover`                        | 발견 가능한 Space           | `APP.SPACES:VIEW`        | -           | Access metric |
| POST   | `/v1/spaces/requests`                        | Space 생성 요청             | `APP.SPACES:REQUEST`     | Required    | Full          |
| GET    | `/v1/spaces/requests/{id}`                   | 요청·승인·Provisioning 상태 | Request owner 또는 Admin | -           | Read audit    |
| POST   | `/v1/spaces/{key}/join-requests`             | 가입 요청                   | `SPACE:DISCOVER`         | Required    | Full          |
| GET    | `/v1/spaces/{key}`                           | Space Context               | `SPACE:VIEW`             | -           | Access metric |
| GET    | `/v1/spaces/{key}/overview`                  | Overview Projection         | `SPACE:VIEW`             | -           | Metric        |
| GET    | `/v1/spaces/{key}/content`                   | Content 목록                | `SPACE.CONTENT:VIEW`     | -           | Access metric |
| POST   | `/v1/spaces/{key}/content`                   | Draft 생성                  | `SPACE.CONTENT:CREATE`   | Required    | Full          |
| PUT    | `/v1/spaces/{key}/content/{id}`              | Revision 저장               | `SPACE.CONTENT:EDIT`     | Request key | Full          |
| POST   | `/v1/spaces/{key}/content/{id}/publications` | 게시 요청                   | `SPACE.CONTENT:PUBLISH`  | Required    | Full          |
| GET    | `/v1/spaces/{key}/members`                   | 구성원 조회                 | `SPACE.MEMBER:VIEW`      | -           | Read audit    |

### Owner Studio

| Method | Path                                    | 목적                     | Permission               | Idempotency        | Audit        |
| ------ | --------------------------------------- | ------------------------ | ------------------------ | ------------------ | ------------ |
| PATCH  | `/v1/spaces/{key}`                      | Space 설정 변경          | `SPACE:MANAGE`           | Request key + ETag | Before/After |
| POST   | `/v1/spaces/{key}/memberships`          | 구성원·Group 추가        | `SPACE.MEMBER:MANAGE`    | Required           | Full         |
| PATCH  | `/v1/spaces/{key}/memberships/{id}`     | 역할·기간 변경           | `SPACE.MEMBER:MANAGE`    | Request key + ETag | Before/After |
| DELETE | `/v1/spaces/{key}/memberships/{id}`     | 접근 회수                | `SPACE.MEMBER:MANAGE`    | Required           | Full         |
| POST   | `/v1/spaces/{key}/app-bindings`         | App 연결                 | `SPACE.APP:MANAGE`       | Required           | Full         |
| POST   | `/v1/spaces/{key}/resource-bindings`    | 외부 자원 연결           | `SPACE.RESOURCE:MANAGE`  | Required           | Full         |
| PUT    | `/v1/spaces/{key}/policies/{policyKey}` | Space 강화 정책          | `SPACE.POLICY:MANAGE`    | Request key + ETag | Before/After |
| POST   | `/v1/spaces/{key}/lifecycle-requests`   | 연장·Archive·Delete 요청 | `SPACE.LIFECYCLE:MANAGE` | Required           | Full         |

### Tenant Control Center

| Method | Path                                                         | 목적                  | Permission                      | Idempotency        | Audit        |
| ------ | ------------------------------------------------------------ | --------------------- | ------------------------------- | ------------------ | ------------ |
| GET    | `/v1/admin/spaces/overview`                                  | 운영 지표             | `ADMIN.SPACES:VIEW`             | -                  | Admin read   |
| GET    | `/v1/admin/spaces/requests`                                  | 위험 Queue            | `ADMIN.SPACE_REQUESTS:VIEW`     | -                  | Admin read   |
| POST   | `/v1/admin/spaces/requests/{id}/decisions`                   | 승인·반려·변경 요청   | Approval Task Permission        | Required           | Full         |
| GET    | `/v1/admin/spaces/directory`                                 | 전체 Directory        | `ADMIN.SPACES:VIEW`             | -                  | Admin read   |
| POST   | `/v1/admin/spaces/templates`                                 | Template Draft        | `ADMIN.SPACE_TEMPLATES:MANAGE`  | Required           | Full         |
| POST   | `/v1/admin/spaces/templates/{id}/versions/{version}/publish` | Version 게시          | `ADMIN.SPACE_TEMPLATES:PUBLISH` | Required           | Full         |
| PUT    | `/v1/admin/spaces/policies/{key}`                            | Tenant Policy Version | `ADMIN.SPACE_POLICIES:MANAGE`   | Request key + ETag | Before/After |
| GET    | `/v1/admin/spaces/content-reviews`                           | Content 검토 Queue    | `ADMIN.SPACE_CONTENT:REVIEW`    | -                  | Admin read   |
| POST   | `/v1/admin/spaces/content-reviews/{id}/decisions`            | 게시 결정             | `ADMIN.SPACE_CONTENT:DECIDE`    | Required           | Full         |
| GET    | `/v1/admin/spaces/lifecycle-reviews`                         | 수명주기 Queue        | `ADMIN.SPACE_LIFECYCLE:VIEW`    | -                  | Admin read   |
| POST   | `/v1/admin/spaces/lifecycle-reviews/{id}/decisions`          | 갱신·보관 결정        | `ADMIN.SPACE_LIFECYCLE:DECIDE`  | Required           | Full         |

### 운영 정합성·복구 실행 계약

아래 경로가 2026-08-19 OpenAPI 실행 기준이다. 위 Inventory의 장기 Target 경로와 이름이 다른
경우 이 표와 `contracts/openapi/space.json`을 현재 구현 계약으로 우선한다.

| Method | Path | 목적 | Permission | Audit·Evidence |
| ------ | ----------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------- | -------------------------------------- | ----------------- |
| GET | `/v1/admin/operations` | 정합성 KPI·발견사항·실행·전달 조회 | `ADMIN.SPACE_GOVERNANCE:VIEW    | MANAGE` | Admin read metric |
| POST | `/v1/admin/operations/reconcile` | Desired State 수동 재계산 | `ADMIN.SPACE_GOVERNANCE:MANAGE` | Reconciliation run + Audit |
| POST | `/v1/admin/operations/entitlements/{syncItemId}/retry` | Retry·Dead 전달 재대기 | `ADMIN.SPACE_GOVERNANCE:MANAGE` | Retry audit |
| GET | `/v1/admin/spaces?q=` | 삭제되지 않은 Tenant Space Metadata 검색 | `ADMIN.SPACE_GOVERNANCE:VIEW    | MANAGE` | Content 미포함 |
| POST | `/v1/admin/spaces/{spaceKey}/owner-recovery` | 소유자 없는 Space 책임자 복구 | `ADMIN.SPACE_GOVERNANCE:MANAGE` | Reason + Policy + Audit + Recovery run |
| POST | `/internal/identity/v1/tenants/{tenantId}/space-entitlements/principal-validations` | 활성·동일 Tenant Principal 검증 | Space Service Identity | Auth read evidence |
| PUT | `/internal/identity/v1/tenants/{tenantId}/space-entitlements/{sourceRef}` | Membership Desired Grant 동기화 | Space Service Identity | Identity grant audit |

소유자 복구 Request는 `personPublicId`와 10~1000자의 `reason`을 요구한다. 활성 Owner가 이미
있으면 `409`, 주체가 비활성·미존재·타 Tenant이면 `400`, 관리 책임이 없으면 `403`이다.
복구 API는 일반 Membership 관리 API와 분리되어 있으며 Provider Support Role은 호출할 수 없다.

## Request와 Response

- OpenAPI Link: `dwp-backend/contracts/openapi/space-public.yaml` 예정
- Content Type: `application/json`, File Upload는 Pre-signed Storage Session 계약
- Pagination: Cursor 기반, `limit` 최대 100
- Sort: Allowlist Field만 허용, 기본 `updatedAt desc, id desc`
- Filter: Structured Query Parameter 또는 검증된 Filter DTO, SQL Fragment 입력 금지
- ETag: Mutable Aggregate의 `version`으로 생성, 변경 API는 `If-Match` 필수
- Idempotency: Command API는 `Idempotency-Key` 필수, Tenant·Actor·Route Scope로 24시간 보존
- Time: ISO-8601 UTC, 사용자 표시는 Locale·Tenant Time Zone에서 변환
- Enum: API Code는 안정된 영문 Code, 표시명은 i18n Resource로 해석

### 생성 요청 핵심 Schema

```json
{
  "templateVersionId": "uuid",
  "spaceTypeCode": "PROJECT",
  "name": "Customer Zero rollout",
  "purpose": "Coordinate pilot delivery and decisions",
  "owner": { "principalType": "USER", "principalId": "123" },
  "startsAt": "2026-09-01T00:00:00Z",
  "endsAt": "2026-12-31T00:00:00Z",
  "accessLevel": "REQUEST",
  "classificationCode": "INTERNAL",
  "membershipSources": [],
  "appBindings": [],
  "resourceBindings": [],
  "agentPolicy": { "enabled": true, "sourceIds": [], "toolKeys": [] }
}
```

Response는 `requestId`, `state`, `riskTier`, `policyEvaluation`, `approvalRoute`,
`provisioningPreview`, `links`를 포함하고 내부 Rule Expression이나 Secret을 노출하지 않는다.

## Error Contract

| HTTP | Error Code                     | 사용자 의미                  | Retry      | UI 처리                  |
| ---- | ------------------------------ | ---------------------------- | ---------- | ------------------------ |
| 400  | `SPACE_INPUT_INVALID`          | 입력·조합 오류               | N          | Field Error Summary      |
| 403  | `SPACE_ACCESS_DENIED`          | App 또는 Space 권한 없음     | N          | 접근 요청 또는 Back      |
| 403  | `SPACE_POLICY_BLOCKED`         | Tenant 정책상 금지           | 입력 수정  | 정책 이유 표시           |
| 404  | `SPACE_NOT_FOUND`              | 없거나 발견 불가             | N          | 존재 여부 최소 노출      |
| 409  | `SPACE_KEY_CONFLICT`           | Key 중복                     | 수정       | 대체 Key 제안            |
| 409  | `SPACE_STATE_CONFLICT`         | 현재 상태에서 Command 불가   | Refresh    | 최신 Timeline            |
| 409  | `SPACE_MEMBERSHIP_DRIFT`       | IAG Grant 불일치             | 운영 Retry | Partial 상태             |
| 412  | `SPACE_VERSION_MISMATCH`       | 다른 사용자가 변경           | Refresh    | Diff·재적용              |
| 422  | `SPACE_APPROVAL_REQUIRED`      | 사람 승인 필요               | N          | Approval Preview         |
| 429  | `SPACE_RATE_LIMITED`           | 요청 한도 초과               | Y          | Retry-After              |
| 503  | `SPACE_DEPENDENCY_UNAVAILABLE` | Approval·Auth·Connector 장애 | Y          | Partial + Correlation ID |

Problem Details는 RFC 9457 형태로 `type`, `title`, `status`, `code`, `detail`, `instance`,
`traceId`, `fieldErrors`, `policyReasons`를 제공한다.

## Permission

| Resource Key                | Permission               | Scope                     | Condition                        | Deny 동작          |
| --------------------------- | ------------------------ | ------------------------- | -------------------------------- | ------------------ |
| `APP.SPACES`                | VIEW·REQUEST             | Tenant                    | App Entitlement                  | App 숨김 + API 403 |
| `SPACE.<key>`               | VIEW·MANAGE              | Space                     | Active Membership·Responsibility | 404 또는 403 정책  |
| `SPACE.<key>.CONTENT`       | VIEW·CREATE·EDIT·PUBLISH | Space                     | Role + Content Policy            | Command 숨김 + 403 |
| `SPACE.<key>.MEMBER`        | VIEW·MANAGE              | Space                     | Owner·위임 관리자                | 403                |
| `SPACE.<key>.APP`           | VIEW·MANAGE              | Space                     | Owner + App Policy               | 승인 요청 전환     |
| `SPACE.<key>.AGENT`         | USE·CONFIGURE            | Space                     | Source ACL + Tool Allowlist      | Tool·Source 제외   |
| `ADMIN.SPACE_GOVERNANCE`    | VIEW·MANAGE              | Tenant                    | Scoped Responsibility            | Admin 메뉴 숨김    |
| `ADMIN.SPACE_TEMPLATES`     | MANAGE·PUBLISH           | Tenant·Template Set       | SoD                              | 별도 승인 필요     |
| `ADMIN.SPACE_COMPLIANCE`    | VIEW·APPROVE·MANAGE      | Tenant·Classification Set | Reviewer Assignment              | Queue에서 제외     |
| `ADMIN.SPACE_ACCESS_REVIEW` | VIEW·APPROVE·MANAGE      | Tenant·Space Set          | Reviewer Assignment              | Queue에서 제외     |

Context Selector는 Permission Source가 아니다. 선택한 `spaceKey`를 Trusted Header로 받지 않고
Route·Token Subject·Server-side Grant로 다시 결정한다.

Auth는 `APP.SPACES`와 Space Coarse Grant를 발급하고, Space Service는 Membership Role과
Content·App·Policy 조건을 결합해 세부 Capability를 계산한다. 이 계약을 위해 Auth Catalog와
Check Constraint에 `SPACE`, `SPACE_MEMBERSHIP`, `SPACE_ACCESS_REQUEST`를 먼저 추가한다.

## Responsibility와 SoD

- `SPACE_OWNER`는 해당 Space에서 Member·정책·App을 관리하되 Tenant 정책을 완화하지 못한다.
- `SPACE_TEMPLATE_ADMIN`은 Draft를 만들 수 있으나 자신의 Version을 단독 Publish하지 않는다.
- `SPACE_GOVERNANCE_ADMIN`은 전체 Tenant를 관리하지만 Compliance Decision과 Audit Export를
  암묵적으로 상속하지 않으며, Space Membership이 없다면 비공개 본문과 Owner Studio도
  열람하지 못한다.
- `MODERATOR`는 Content Moderation을 수행하지만 Membership·Policy `MANAGE`를 갖지 않는다.
- `SPACE_COMPLIANCE_REVIEWER`는 배정 Scope의 고위험 요청만 결정한다.
- Provider Role은 Tenant Space API를 호출할 수 없다. 승인된 Support Session의 Read-only
  Diagnostic Scope는 별도 계약을 사용한다.

## Security

- Authentication: Gateway가 검증한 Session·Service Identity, Backend는 사용자 제공 Role
  Header를 신뢰하지 않는다.
- CSRF·CORS: Cookie Session Command에 CSRF Token, Tenant Allowlist Origin
- Input Validation: Name Unicode Normalization, URL Scheme Allowlist, JSON Schema,
  Principal·App·Connector 존재 검증
- PII: Member Email 대신 User ID, Log·Error에서 Purpose·Comment·Invitee Masking
- Encryption: TLS, DB Encryption, Storage SSE, Connector Secret은 KMS/Secret Manager
- Rate Limit: Actor·Tenant·Route·Risk Command 별도 Bucket
- File: Pre-signed Upload, MIME Sniffing, Size·Extension, Malware·DLP 완료 전 Publish 금지
- SSRF: Connector URL Allowlist, DNS Rebinding 차단, Egress Proxy
- Tenant Isolation: Repository Query와 Unique Key에 `tenant_id`, Cross-tenant ID는 404

## Audit와 Observability

- Audit: Actor, Tenant, Space, Request, Target, Action, Outcome, Before·After Hash,
  Reason, Approval·Policy Version, Trace·Correlation
- Content Body·Secret·Access Token은 Audit Payload에 넣지 않는다.
- API: 공통 `sys_api_history`에 Route Template, Status, Latency, Trace, Actor·Tenant Hash를 기록한다.
- Metric: request lead time, provisioning step latency, active space, ownerless, review overdue,
  connector drift, access deny, agent tool deny
- Alert: 승인 SLA, Provisioning DLQ, Ownerless Restricted Space, ACL Drift, Purge Receipt 미완료

## SLO

| Capability             | Target                               |
| ---------------------- | ------------------------------------ |
| Space 목록·Context API | 99.9%, P95 300ms                     |
| Space 생성 요청        | 99.9%, P95 800ms excluding approval  |
| Policy Evaluation      | 99.95%, P95 500ms                    |
| Provisioning 시작      | 승인 후 30초 이내                    |
| 권한 회수 전파         | P95 60초, Restricted 15초 목표       |
| Search ACL 변경 전파   | P95 5분, 즉시 Query-time Filter 유지 |

## Compatibility

- API Version: `/v1`, breaking 변경은 `/v2` 또는 Versioned Media Type
- Consumer: DWP Frontend, Agent Runtime, Approval, Auth, Search, Notification
- Deprecation: 최소 2개 Minor Release, Telemetry로 Consumer 0 확인 후 제거
- Contract Test: OpenAPI Schema, Event Schema, Gateway Route, Permission Deny, Idempotency,
  ETag, Tenant Isolation
