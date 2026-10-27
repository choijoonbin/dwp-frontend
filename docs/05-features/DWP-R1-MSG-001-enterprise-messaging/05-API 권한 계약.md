# 05. API 권한 계약

## 1. 기본 규칙

- 외부 Base URL: `/api/messaging/v1`
- Product Route: `/messages`
- 모든 Command는 `Idempotency-Key`와 Correlation ID를 지원한다.
- 모든 변경 API는 Tenant, App Grant, Conversation Membership, 상태, 정책을 서버에서 확인한다.
- Client가 보내는 `tenantId`, Role, Membership Source를 신뢰하지 않는다.
- List API는 Opaque Cursor를 사용하고 최대 Page Size를 제한한다.
- Error는 DWP 공통 Envelope과 안정된 Error Code를 사용하며 민감한 존재 여부를 노출하지 않는다.

## 2. 구성원 REST API

| Method            | Path                                                             | 목적                                          |
| ----------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| `GET`             | `/home`                                                          | 주의 필요, 이어서 보기, Space 대화 Projection |
| `GET`             | `/activity`                                                      | Mention, Reply, Reaction, Action Event        |
| `GET`             | `/conversations`                                                 | 접근 가능한 대화 Cursor 목록                  |
| `POST`            | `/conversations`                                                 | Group·Channel 생성                            |
| `POST`            | `/direct-conversations`                                          | Person ID 기반 1:1 조회 또는 생성             |
| `GET`             | `/conversations/{id}`                                            | Header, 정책, Membership 요약                 |
| `PATCH`           | `/conversations/{id}`                                            | Owner가 이름·주제·정책 변경                   |
| `GET`             | `/conversations/{id}/messages`                                   | `beforeSequence`, `afterSequence` History     |
| `POST`            | `/conversations/{id}/messages`                                   | Durable Message 전송                          |
| `PATCH`           | `/messages/{messageId}`                                          | 내 메시지 수정, `If-Match` 필수               |
| `DELETE`          | `/messages/{messageId}`                                          | 정책 기반 사용자 삭제                         |
| `PUT`             | `/messages/{messageId}/reactions/{key}`                          | Reaction 추가                                 |
| `DELETE`          | `/messages/{messageId}/reactions/{key}`                          | Reaction 제거                                 |
| `PUT`             | `/conversations/{id}/read-cursor`                                | 마지막 읽은 Sequence 전진                     |
| `GET/PUT`         | `/conversations/{id}/draft`                                      | 개인 Draft 동기화                             |
| `POST`            | `/scheduled-messages`                                            | 예약 발송                                     |
| `GET/POST/DELETE` | `/saved-items`                                                   | Later와 Reminder                              |
| `GET`             | `/search`                                                        | ACL 적용 메시지·파일·대화 검색                |
| `PUT`             | `/presence/heartbeat`                                            | 현재 사용자 Presence Lease 갱신               |
| `POST`            | `/conversations/{id}/attachments/uploads`                        | 격리 업로드 세션과 10분 단일 사용 Token 발급  |
| `PUT`             | `/conversations/{id}/attachments/{attachmentId}/content`         | Binary 업로드와 동기 검사 실행                |
| `GET`             | `/conversations/{id}/attachments/{attachmentId}`                 | 검사 상태와 안전한 Metadata 조회              |
| `DELETE`          | `/conversations/{id}/attachments/{attachmentId}`                 | 전송하지 않은 내 첨부 폐기                    |
| `POST`            | `/conversations/{id}/attachments/{attachmentId}/download-grants` | 1분 단일 사용 Download Grant 발급             |
| `GET`             | `/conversations/{id}/attachments/{attachmentId}/content`         | Grant 소비 후 무결성 검증 다운로드            |
| `POST`            | `/realtime-tickets`                                              | 일회용 WebSocket Ticket                       |

`POST /direct-conversations`는 `personPublicId`만 받고 기존 1:1 Fingerprint가 있으면 같은 대화를
반환한다. 상대가 없거나 정책상 보이지 않는 경우를 구분해 공격자가 Directory 존재 여부를
추측하지 못하게 한다.

### R1 Presence REST 계약

- `PUT /presence/heartbeat`는 `APP.MESSAGING:VIEW`가 있는 인증된 현재 사용자만 호출한다.
- Request Body와 사용자·Tenant 식별자는 받지 않는다. Gateway가 검증한 Subject만 사용한다.
- Browser가 `/messages`의 허용된 Surface에 있고 `visible`·`online`일 때 즉시 호출한 뒤 성공
  Response가 지시한 간격(기본 20초)으로 갱신한다. 숨김·오프라인·Unmount에서는 명시적
  Offline Command를 보내지 않는다.
  다중 Tab 중 하나가 계속 갱신할 수 있기 때문이다.
- 성공은 `204 No Content`이며 `X-DWP-Presence-Lease-TTL-Seconds`(기본 `75`)와
  `X-DWP-Presence-Refresh-After-Seconds`(기본 `20`) Response Header를 반환한다. Presence 저장소가
  갱신을 수락하지 못하면 시간 Header 없이 `503 Service Unavailable`을 반환한다.
- 두 Header는 초 단위 양의 정수이다. TTL은 30~300초, 갱신 권고는 최소 5초이며
  `refresh + 15초 <= TTL`을 만족해야 한다. Client는 누락·잘못된·불안전한 Header를 무시하고
  최소 안전 Compatibility 값인 30/5초를 사용한다.
- Client는 최근 성공 Lease를 Request 시작 시각부터 보수적으로 계산한다. 첫 실패 후
  Retry 시작은 `Lease 시작 + TTL - 5초 Timeout - 5초 Safety Margin`을 넘지 않는다.
- 5초 Heartbeat Request Deadline은 CSRF Bootstrap·최초 Dispatch·단 한 번의 Stale-CSRF Replay를
  포함하는 하나의 절대 예산이다. Replay에서 5초를 새로 시작하지 않는다.
- 기본 Lease TTL은 75초다. Lease가 없거나 만료되면 `OFFLINE`, Redis Authority가 비활성·장애
  상태이면 `UNKNOWN`으로 판정하며 Directory Seed 값을 Fallback으로 사용하지 않는다.
- `GET /home`은 `presence.authority`, `presence.evaluatedAt`, `presence.leaseTtlSeconds`,
  `presence.refreshAfterSeconds`를 반환한다. `UNAVAILABLE`은 온라인 0명과 다른 상태이며 Client는
  이를 `상태 확인 불가`로 표시한다.
- 현재 계약은 연결 가능 여부를 위한 `AVAILABLE | OFFLINE | UNKNOWN`이다. `BUSY`, `AWAY`,
  `FOCUS` 같은 사용자 선언 상태는 별도 정책·만료 계약 없이는 생성하지 않는다.

## 3. 관리자와 Compliance API

- `/api/messaging/v1/admin/policies`
- `/api/messaging/v1/admin/retention`
- `/api/messaging/v1/admin/templates`
- `/api/messaging/v1/admin/integrations`
- `/api/messaging/v1/admin/safety`
- `/api/messaging/v1/admin/operations`
- `/api/messaging/v1/admin/ai`
- `/api/messaging/v1/compliance/cases`
- `/api/messaging/v1/compliance/search`
- `/api/messaging/v1/compliance/exports`

관리 API Response에는 메시지 Preview, 파일명, 참여자별 대화 목록을 기본 포함하지 않는다.
Compliance API는 일반 Admin Route와 Controller, Service, DB Role을 분리한다.

Retention 단축, Legal Hold 해제, Export는 사유와 Re-authentication을 요구하고 Tenant 정책에
따라 Dual Approval을 적용한다.

## 4. 목표 WebSocket 계약

아래 계약은 전용 Realtime Gateway 단계의 목표 계약이다. 현재 R1 Runtime은 Durable 변경 Event에
SSE를 사용하고 Presence 입력은 위 REST Heartbeat를 사용한다. 구현되지 않은 WebSocket Event를
현재 동작으로 간주하지 않는다.

Endpoint: `/api/messaging/v1/realtime`

Browser WebSocket은 임의 Authorization Header를 넣기 어렵다. 다음 Handshake를 사용한다.

1. 인증된 REST Session으로 30초 유효한 단일 사용 Opaque Ticket을 발급한다.
2. Ticket은 `Sec-WebSocket-Protocol`의 DWP 전용 Subprotocol로 전달하고 Query String과 Log에
   남기지 않는다.
3. Gateway는 Origin, Session, Tenant, Device, Ticket 재사용을 검증한다.
4. 연결 후 Client가 요청한 Conversation Subscription을 서버가 각각 승인한다.

Event Envelope:

```json
{
  "protocolVersion": 1,
  "eventId": "uuid",
  "type": "message.created",
  "conversationId": "uuid",
  "sequence": 4821,
  "occurredAt": "2026-08-19T10:00:00Z",
  "payload": {}
}
```

서버 Event:

- `message.created`, `message.edited`, `message.deleted`
- `reaction.changed`, `thread.changed`
- `conversation.changed`, `membership.changed`, `access.revoked`
- `read-cursor.changed`
- `presence.changed`, `typing.changed`
- `system.resync-required`, `system.degraded`

Client Event:

- `subscription.add`, `subscription.remove`
- `typing.start`, `typing.stop`
- `presence.heartbeat`
- `event.ack`

메시지 생성·수정·삭제는 WebSocket으로 받지 않고 REST Command로만 수행한다. Transient Event는
Sequence 원장에 포함하지 않으며, 재연결 후 `afterSequence` REST Delta로 복구한다.

## 5. 권한 모델

### Auth Coarse Grant

| Resource                       | Permission                 | 역할                    |
| ------------------------------ | -------------------------- | ----------------------- |
| `APP.MESSAGING`                | `VIEW`, `CREATE`           | 메신저 사용과 대화 생성 |
| `ADMIN.MESSAGING_POLICY`       | `VIEW`, `MANAGE`           | Tenant 정책             |
| `ADMIN.MESSAGING_OPERATIONS`   | `VIEW`, `MANAGE`           | 운영·재처리             |
| `ADMIN.MESSAGING_COMPLIANCE`   | `SEARCH`, `HOLD`, `EXPORT` | 승인 Case               |
| `ADMIN.MESSAGING_INTEGRATIONS` | `VIEW`, `MANAGE`           | App·Bot·Webhook         |
| `ADMIN.MESSAGING_AI`           | `VIEW`, `MANAGE`           | AI 정책                 |

### Conversation Local Capability

| Role        | 기본 Capability                                       |
| ----------- | ----------------------------------------------------- |
| `VIEWER`    | 읽기, 허용된 Reaction                                 |
| `MEMBER`    | 읽기, 쓰기, Thread, 파일, 자신의 메시지 변경          |
| `MODERATOR` | Member + 공지, 신고 조치, 정책 범위 내 타 메시지 숨김 |
| `OWNER`     | Moderator + 구성원, 주제, 채널 정책, Archive          |

최종 Capability는 Role, Conversation Type, Tenant Policy, Space Policy, Message 상태를 합성한다.
Role 이름만 확인하는 Controller 분기를 금지하고 `MessagingAuthorizationService`의 Resource
Decision을 사용한다.

### 역할 분리

- `MESSAGING_ADMIN`: 본문 열람 없음
- `MESSAGING_COMPLIANCE`: 승인 Case Scope 안에서만 본문 검색
- `MESSAGING_INTEGRATION_ADMIN`: App Scope 관리, 사용자 대화 열람 없음
- `MESSAGING_AI_ADMIN`: AI 설정, Prompt·사용량 집계, 원문 열람 없음
- Provider Support: Tenant 메시지 본문과 Compliance Export 접근 없음

## 6. Space·People·Calendar Event 계약

### 수신 Event

- `dwp.space.membership-changed`
- `dwp.space.lifecycle-changed`
- `dwp.people.worker-changed`
- `dwp.auth.user-deactivated`
- `dwp.calendar.event-participants-changed`

모든 Event는 DWP CloudEvents-aligned Envelope, Tenant, Aggregate Sequence, Schema Version,
Correlation ID를 포함한다. Messaging Inbox가 Payload Hash, 중복, 순서를 검증한다.

Space Event 누락을 전제로 주기적 Reconciliation API를 제공한다. Reconciliation은 원장을
수정하지 않고 Projection Drift만 교정한다.

### 발행 Event

- `dwp.messaging.message-created`
- `dwp.messaging.message-edited`
- `dwp.messaging.message-deleted`
- `dwp.messaging.mention-created`
- `dwp.messaging.membership-changed`
- `dwp.messaging.action-linked`
- `dwp.messaging.retention-applied`

High-volume Messaging Event는 일반 Domain Topic과 분리한 `dwp.messaging-events.v1`을 사용하고
Key는 `tenant|conversation`으로 한다. Event에는 Attachment Binary와 Secret을 넣지 않는다.
Notification Intent는 정책상 허용된 짧은 Preview 또는 일반 문구와 Deep Link만 전달한다.

## 7. Search 권한 계약

1. Query 시 현재 사용자 Membership과 `history_start_sequence`를 조회한다.
2. OpenSearch Filter에 Tenant, Conversation, Sequence 범위를 서버가 주입한다.
3. Search Hit의 Message ID를 현재 DB ACL과 Tombstone으로 재검증한다.
4. 권한이 바뀐 Hit는 결과에서 제외하고 Security Metric을 남긴다.
5. Browser에 OpenSearch Credential이나 Raw Query DSL을 제공하지 않는다.

OpenSearch DLS/FLS는 Cluster 내부 Defense-in-depth이지 사용자별 권한의 유일한 원장이 아니다.

## 8. App·Bot Scope

- `messages:read:mentioned`
- `messages:write`
- `conversations:read`
- `members:read:minimal`
- `files:write`
- `actions:publish`

Bot은 사용자 Token을 가장하지 않는 독립 Principal이다. App 설치는 Tenant 또는 Space Scope를
명시하고, Message Read는 기본 거부한다. Incoming Webhook도 무제한 Channel ID를 받지 않고
설치 시 승인된 Conversation으로 고정한다.

## 9. 보안 검증

- Message Content Schema와 길이, Mention 수, Link 수를 서버에서 제한
- Rate Limit: 사용자, IP, Device, Conversation, App Principal 단위
- Mass Mention, 반복 DM, 자동 초대 Abuse 탐지
- URL Canonicalization, IDN Homograph 표시, Unsafe Scheme 차단
- Link Preview SSRF·DNS Rebinding·Redirect Chain 방어
- Attachment MIME Sniffing, AV/DLP, Archive Limit
- `If-Match`와 Version으로 Lost Update 차단
- Forward·Quote·Action Capsule은 대상 대화의 원문 접근 권한을 다시 확인
- Log, Trace, Metric Label에 Message Body와 Search Query 원문을 넣지 않음

### 첨부파일 전송 계약

- 업로드 생성은 현재 대화 구성원만 가능하며 서버가 Tenant 정책과 배포 환경의 절대 전송 한도 중
  더 작은 값을 적용한다.
- 업로드 Token은 10분 동안 한 번만 사용할 수 있다. Token 소비를 DB에서 원자적으로 선점한 뒤
  Object를 쓰므로 재시도·경합 요청이 먼저 저장된 Object를 덮어쓰거나 삭제하지 못한다.
- Browser는 `application/octet-stream`과 정확한 `Content-Length`를 전송한다. 길이가 없거나 선언
  크기와 다르거나 절대 한도를 넘으면 본문을 Controller에 적재하기 전에 거부한다.
- 파일은 허용 확장자·MIME·Magic Byte·실행 파일·OOXML Archive 구조를 검사한다. 운영 환경은
  ClamAV 또는 승인된 AV/DLP Adapter를 사용하며 검사 실패는 허용으로 전환하지 않는다.
- `CLEAN`이면서 메시지에 연결된 첨부만 대화 구성원에게 보인다. 다운로드는 사용자·대화·파일에
  결합된 1분 단일 사용 Grant를 소비하고 SHA-256을 다시 확인한다.
- 작성 중 제거하거나 대화 이동으로 버린 첨부는 작성자만 폐기할 수 있다. 만료 Job이 전송되지
  않은 Object와 오래된 Grant를 재정리한다.
- 한 메시지에는 중복되지 않은 첨부를 최대 10개까지 연결한다. 파일명은 NFKC 정규화하고 경로
  문자와 제어 문자를 거부하며 Object Key에 원문 파일명을 넣지 않는다.
