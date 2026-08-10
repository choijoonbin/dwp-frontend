# 05 API 권한 계약

모든 Path의 Prefix는 `/api/auth/admin/directory`다.

| Method | Path                                                | 계약                      |
| ------ | --------------------------------------------------- | ------------------------- |
| GET    | `/users`                                            | Member Picker 사용자 Page |
| GET    | `/organizations`                                    | 조직 검색·상태 Page       |
| POST   | `/organizations`                                    | Local 조직 생성           |
| GET    | `/organizations/{id}`                               | 조직과 현재 Member        |
| PATCH  | `/organizations/{id}`                               | 이름·설명·Parent 변경     |
| POST   | `/organizations/{id}/activate`                      | 조직 활성화               |
| POST   | `/organizations/{id}/deactivate`                    | 빈 조직 비활성화          |
| PUT    | `/organizations/{id}/members`                       | 기본 조직 Member Set 교체 |
| GET    | `/groups`                                           | Group 검색·상태 Page      |
| POST   | `/groups`                                           | Local Group 생성          |
| GET    | `/groups/{id}`                                      | Group과 직접 Member       |
| PATCH  | `/groups/{id}`                                      | 표시명·설명 변경          |
| POST   | `/groups/{id}/activate` / `/groups/{id}/deactivate` | Group Lifecycle           |
| PUT    | `/groups/{id}/members`                              | 직접 User Member Set 교체 |

인증 Session의 Tenant와 `X-Tenant-ID`가 일치해야 하며 `ADMIN`, `TENANT_ADMIN`,
`PLATFORM_ADMIN` 중 하나가 필요하다. 다른 Tenant Context는 `403`, 다른 Tenant Resource는
`404`, Cycle·Dependency·Source Ownership·Stale Version은 `409 E1009`다.

Mutation은 CSRF Token과 Version을 요구한다. Member Set은 최대 500명이며 존재하지 않거나
비활성인 사용자는 `400`으로 거부한다. 성공한 Membership 변경은 영향받은 사용자 Session을
폐기한다.
