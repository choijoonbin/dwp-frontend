# DWP-R1-ADM-007 API·권한 계약

## Navigation API

- `GET /api/platform/v1/admin/navigation-studio`
- Draft 생성·수정·검증·게시·취소 API
- Published Revision 복원 API

## App Access API

- 구성원 조회·요청·취소 API는 Session User만 대상으로 한다.
- `GET /api/platform/v1/admin/app-access-requests`는 Tenant Admin, App Catalog Admin과
  해당 앱의 Owner·Access Manager·Approver·Reviewer가 사용한다. Scoped 역할은 자기
  Resource Set의 요청만 받는다.
- `POST .../{requestId}/decision`은 Tenant Admin 또는 해당 앱의
  `APP_ACCESS_APPROVER`만 사용한다.
- `POST .../{requestId}/fulfillment`와 `.../revocation`은 Tenant Admin 또는 해당 앱의
  `APP_ACCESS_MANAGER`만 사용한다.
- Platform은 전용 Identity Sync Token으로
  `PUT /internal/identity/v1/tenants/{tenantId}/app-entitlements/{sourceRef}`를 호출한다.

서버가 Tenant, Resource, Permission과 Resource Role을 다시 계산한다. 자기 요청의 자기
승인·이행, 동일 요청 승인자의 이행, Stale Version을 거부한다. 결정·이행·회수는 10자 이상의
근거를 요구한다. 내부 Entitlement Adapter 실패는 `FAILED`와 정제된 오류 증거로 남아
재시도할 수 있으며 성공으로 합성하지 않는다. App Catalog Admin은 Queue 읽기 전용이다.
