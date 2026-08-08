# 05 API 권한 계약

| Method | Path                                            | 계약                      |
| ------ | ----------------------------------------------- | ------------------------- |
| GET    | `/api/auth/admin/identity/users`                | Tenant 사용자와 Role Page |
| GET    | `/api/auth/admin/identity/roles`                | Tenant Active Role        |
| PUT    | `/api/auth/admin/identity/users/{userId}/roles` | Role Set 교체             |
| GET    | `/api/auth/admin/identity/audit-events`         | Identity Audit Page       |

인증된 Session의 Tenant와 `X-Tenant-ID`가 일치해야 하며 `ADMIN`, `TENANT_ADMIN`,
`PLATFORM_ADMIN` 중 하나가 필요하다. 자기 Role 변경은 `409`, 다른 Tenant 객체는 `404`,
Access Revision·JPA Version 충돌은 `409 E1009`다.

Role 변경 성공 시 대상 사용자의 폐기되지 않은 모든 Browser Session을 즉시 폐기하고,
응답의 `accessRevision`과 `version`을 증가시킨다. 동일 Revision을 재사용한 요청은
`409 E1009`로 Fail-closed한다.
