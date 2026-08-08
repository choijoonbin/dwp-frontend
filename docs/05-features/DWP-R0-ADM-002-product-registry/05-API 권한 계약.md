# 05 API 권한 계약

| Method   | Path                                                     | 계약                       |
| -------- | -------------------------------------------------------- | -------------------------- |
| GET·POST | `/api/platform/v1/admin/registry-entries`                | Head 목록·첫 Draft 생성    |
| GET      | `/api/platform/v1/admin/registry-entries/{type}/{key}`   | Current와 Revision History |
| POST     | `.../{type}/{key}/revisions`                             | 다음 Draft Revision 생성   |
| PATCH    | `.../{type}/{key}/revisions/{revision}`                  | Draft만 수정               |
| POST     | `.../{revision}/activate`                                | 기존 Active 대체           |
| POST     | `.../{revision}/retire`                                  | Runtime에서 제외           |
| GET      | `/api/platform/v1/catalog/registry-entries`              | Active Revision만 조회     |
| GET      | `/api/platform/v1/catalog/registry-entries/{type}/{key}` | Active Revision 해석       |

모든 API는 Gateway에서 검증된 Tenant Context와 내부 Service Identity를 요구한다.
Admin Write는 Admin Role, CSRF와 Version을 요구하며 충돌은 `409 E1009`다.
Agent Runtime은 관리자용 Token과 분리된 Read Token으로 `GET /v1/catalog/**`만 호출하며
같은 Token으로 `/v1/admin/**`에 접근하면 `401`이다.
