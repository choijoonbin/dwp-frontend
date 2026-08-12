# 05 API 권한 계약

| Method                    | Path                                                                  | 계약                      |
| ------------------------- | --------------------------------------------------------------------- | ------------------------- |
| GET                       | `/api/auth/admin/identity/users`                                      | Tenant 사용자와 Role Page |
| GET                       | `/api/auth/admin/identity/roles`                                      | Tenant Active Role        |
| PUT                       | `/api/auth/admin/identity/users/{userId}/roles`                       | Role Set 교체             |
| GET                       | `/api/auth/admin/identity/audit-events`                               | Identity Audit Page       |
| GET                       | `/api/auth/admin/access/reviews`                                      | 접근 검토 Campaign 목록   |
| POST                      | `/api/auth/admin/access/reviews`                                      | Draft Campaign 생성       |
| GET                       | `/api/auth/admin/access/reviews/{campaignId}`                         | 불변 검토 Item 근거       |
| POST                      | `/api/auth/admin/access/reviews/{campaignId}/activate`                | Snapshot 생성·활성화      |
| PUT                       | `/api/auth/admin/access/reviews/{campaignId}/items/{itemId}/decision` | 승인·회수 결정            |
| POST                      | `/api/auth/admin/access/reviews/{campaignId}/complete`                | Campaign 완료             |
| GET                       | `/api/auth/admin/provisioning/scim/connectors`                        | Connector·건강 목록       |
| GET                       | `/api/auth/admin/provisioning/scim/connectors/events`                 | Provisioning 증적         |
| POST                      | `/api/auth/admin/provisioning/scim/connectors`                        | Connector·Secret 생성     |
| POST                      | `/api/auth/admin/provisioning/scim/connectors/{id}/rotate-secret`     | Secret 회전               |
| PATCH                     | `/api/auth/admin/provisioning/scim/connectors/{id}/lifecycle`         | 수명주기 변경             |
| GET/POST/PUT/PATCH/DELETE | `/api/auth/scim/v2/Users`, `/api/auth/scim/v2/Groups`                 | SCIM 2.0 Resource         |

인증된 Session의 Tenant와 `X-Tenant-ID`가 일치해야 하며 `ADMIN`, `TENANT_ADMIN`,
`PLATFORM_ADMIN` 중 하나가 필요하다. 자기 Role 변경은 `409`, 다른 Tenant 객체는 `404`,
Access Revision·JPA Version 충돌은 `409 E1009`다.

Role 변경 성공 시 대상 사용자의 폐기되지 않은 모든 Browser Session을 즉시 폐기하고,
응답의 `accessRevision`과 `version`을 증가시킨다. 동일 Revision을 재사용한 요청은
`409 E1009`로 Fail-closed한다.

Access Review 생성·활성화·완료와 SCIM Connector 관리는 Tenant Admin만 가능하다. 지정된
Reviewer는 자신에게 배정된 Active Item만 결정할 수 있으며 회수에는 사유가 필수다. Campaign과
Item Version 충돌은 `409`로 거부한다. SCIM Bearer Token은 Connector의 Tenant·Lifecycle·허용
Operation을 모두 통과해야 하며 Event에는 Secret과 원문 개인정보를 기록하지 않는다.
