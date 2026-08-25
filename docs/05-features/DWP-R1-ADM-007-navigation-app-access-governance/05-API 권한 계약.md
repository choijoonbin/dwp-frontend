# DWP-R1-ADM-007 API·권한 계약

## Navigation API

- `GET /api/platform/v1/admin/navigation-studio`
- Draft 생성·수정·검증·게시·취소 API
- Published Revision 복원 API

## App Access API

- 구성원 조회·요청·취소 API는 Session User만 대상으로 한다.
- `GET /api/platform/v1/admin/app-access-requests`는 App Catalog Admin과 해당 앱의
  Owner·Access Manager·Approver·Reviewer가 사용한다. Scoped 책임자는 자기 Resource Set의
  요청만 받고 Tenant Admin Role만으로 Queue를 열지 않는다.
- `POST .../{requestId}/decision`은 해당 Resource Set의 `APP_ACCESS_APPROVER`만 사용한다.
- `POST .../{requestId}/fulfillment`와 `.../revocation`은 해당 Resource Set의
  `APP_ACCESS_MANAGER`만 사용한다.
- `APP_OWNER` 지정·회수는 위 Access Request 결정 권한으로 대신하지 않는다. App Catalog
  Authority가 별도 Ownership Workflow에서 처리하며 `APP_ACCESS_APPROVER`와
  `APP_ACCESS_MANAGER`는 Owner Assignment를 승인·회수할 수 없다.
- Platform은 전용 Identity Sync Token으로
  `PUT /internal/identity/v1/tenants/{tenantId}/app-entitlements/{sourceRef}`를 호출한다.

서버가 Tenant, Resource, Permission과 Resource Role을 다시 계산한다. 자기 요청의 자기
승인·이행, 동일 요청 승인자의 이행, Stale Version을 거부한다. 결정·이행·회수는 10자 이상의
근거를 요구한다. 내부 Entitlement Adapter 실패는 `FAILED`와 정제된 오류 증거로 남아
재시도할 수 있으며 성공으로 합성하지 않는다. App Catalog Admin은 Queue 읽기 전용이다.

## App Governance·Product Admin Preset API

- `POST /api/auth/admin/access/app-governance/assignments`와 Decision·Revoke API는
  `APP_OWNER`, `APP_ACCESS_APPROVER`, `APP_ACCESS_MANAGER`, `APP_ACCESS_REVIEWER`의 통제면
  책임만 처리한다. `APP_CONFIG_ADMIN`, Product Capability와 Scoped Duty는 이 경로에서 만들 수
  없다.
- `APP_OWNER` 요청·승인·회수는 `APP_CATALOG_ADMIN`의 독립 Ownership Authority만 사용한다.
  나머지 통제면 책임은 Owner 또는 Catalog Admin이 요청하고 같은 Resource Set의
  `APP_ACCESS_APPROVER`가 승인, `APP_ACCESS_MANAGER`가 회수한다.
- `GET /api/auth/admin/access/app-governance/presets/catalog`는 데이터 기반 Preset과 요청 가능
  여부를 반환한다.
- `POST /api/auth/admin/access/app-governance/presets/assignments`는 책임과 Scoped Duty를
  비활성 Aggregate로 원자 준비한다.
- `POST .../presets/assignments/{assignmentId}/decision`은 같은 Resource Set의
  `APP_ACCESS_APPROVER`, `POST .../activate`와 `PATCH .../revoke`는
  `APP_ACCESS_MANAGER`만 호출한다.
- `GET .../presets/self-service-options`와 `POST .../presets/self-service-requests`는 제품
  Workbench의 관리 권한 요청에 사용한다. 요청은 Session User 본인으로 고정하고
  `Idempotency-Key`를 동일 Payload에 결속한다.
- `POST .../presets/reviews/{reviewId}/decision`은 정확한 Resource Set의
  `APP_ACCESS_REVIEWER`만 호출한다.

Preset은 `PENDING_APPROVAL → APPROVED → ACTIVE`의 3단계이며 APPROVED 상태는 Effective 권한이
아니다. 요청자·승인자·활성자·대상은 서로 달라야 한다. 각 Mutation은 Aggregate와 Resource
Boundary를 잠근 뒤 Actor Authority, Tenant, Principal, Resource Set, Catalog Version, Object
Version, SoD, 검토·유효기간을 다시 검사한다. 책임 또는 Duty 하나만 활성화되는 부분 성공은
DB Constraint와 Transaction으로 차단한다. 성공·거부 모두 Correlation ID와 Reason을 감사하며
회수·만료 시 대상 Principal의 Access Revision을 갱신한다.
