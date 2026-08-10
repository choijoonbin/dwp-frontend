# 05 API 권한 계약

## Runtime API

| Method | Path                                                 | 계약                  |
| ------ | ---------------------------------------------------- | --------------------- |
| GET    | `/api/platform/v1/reference-data/{setKey}?locale=ko` | 활성·유효 Item만 반환 |

## Admin API

| Method    | Path                                                          | 계약                   |
| --------- | ------------------------------------------------------------- | ---------------------- |
| GET·POST  | `/api/platform/v1/admin/reference-sets`                       | 목록·생성              |
| GET·PATCH | `/api/platform/v1/admin/reference-sets/{setKey}`              | 상세·수정              |
| POST      | `/api/platform/v1/admin/reference-sets/{setKey}/activate`     | Version 검증 후 활성화 |
| POST      | `/api/platform/v1/admin/reference-sets/{setKey}/retire`       | Version 검증 후 폐기   |
| POST      | `/api/platform/v1/admin/reference-sets/{setKey}/items`        | Item 생성              |
| PATCH     | `/api/platform/v1/admin/reference-sets/{setKey}/items/{code}` | Item 수정              |
| POST      | `.../items/{code}/activate` / `.../items/{code}/retire`       | Item Lifecycle 변경    |
| GET       | `/api/platform/v1/admin/audit-events`                         | Tenant Audit Page      |

## Security

- Browser는 HttpOnly Session Cookie와 CSRF 계약을 사용한다.
- Gateway가 내부 `X-DWP-Service-Token`과 검증된 Identity Header를 생성한다.
- Agent는 별도 Runtime Read Token으로 `GET /v1/catalog/**`와
  `GET /v1/reference-data/**`만 호출할 수 있다.
- Platform 직접 요청과 일반 Role의 `/v1/admin/**` 요청은 각각 `401`, `403`이다.
- Client가 보낸 내부 Service Header는 Gateway에서 제거한 뒤 다시 생성한다.
- 모든 요청은 Tenant Scope를 벗어나는 Fallback을 허용하지 않는다.

## Error

- `400`: 형식·Validation 오류
- `401`: Session 또는 Service Identity 없음
- `403`: Admin Role 없음
- `404`: 현재 Tenant에 객체 없음
- `409 E1009`: 중복, Lifecycle 또는 Version 충돌
