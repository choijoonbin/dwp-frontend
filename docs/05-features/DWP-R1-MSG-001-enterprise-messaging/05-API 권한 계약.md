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

| Method            | Path                                    | 목적                                          |
| ----------------- | --------------------------------------- | --------------------------------------------- |
| `GET`             | `/home`                                 | 주의 필요, 이어서 보기, Space 대화 Projection |
| `GET`             | `/activity`                             | Mention, Reply, Reaction, Action Event        |
| `GET`             | `/conversations`                        | 접근 가능한 대화 Cursor 목록                  |
| `POST`            | `/conversations`                        | Group·Channel 생성                            |
| `POST`            | `/direct-conversations`                 | Person ID 기반 1:1 조회 또는 생성             |
| `GET`             | `/conversations/{id}`                   | Header, 정책, Membership 요약                 |
| `PATCH`           | `/conversations/{id}`                   | Owner가 이름·주제·정책 변경                   |
| `GET`             | `/conversations/{id}/messages`          | `beforeSequence`, `afterSequence` History     |
| `POST`            | `/conversations/{id}/messages`          | Durable Message 전송                          |
| `PATCH`           | `/messages/{messageId}`                 | 내 메시지 수정, `If-Match` 필수               |
| `DELETE`          | `/messages/{messageId}`                 | 정책 기반 사용자 삭제                         |
| `PUT`             | `/messages/{messageId}/reactions/{key}` | Reaction 추가                                 |
| `DELETE`          | `/messages/{messageId}/reactions/{key}` | Reaction 제거                                 |
| `PUT`             | `/conversations/{id}/read-cursor`       | 마지막 읽은 Sequence 전진                     |
| `GET/PUT`         | `/conversations/{id}/draft`             | 개인 Draft 동기화                             |
| `POST`            | `/scheduled-messages`                   | 예약 발송                                     |
| `GET/POST/DELETE` | `/saved-items`                          | Later와 Reminder                              |
| `GET`             | `/search`                               | ACL 적용 메시지·파일·대화 검색                |
| `POST`            | `/attachments/upload-intents`           | Quarantine Upload Intent                      |
| `POST`            | `/attachments/{id}/complete`            | Upload 완료·Scan 요청                         |
| `POST`            | `/realtime-tickets`                     | 일회용 WebSocket Ticket                       |

`POST /direct-conversations`는 `personPublicId`만 받고 기존 1:1 Fingerprint가 있으면 같은 대화를
반환한다. 상대가 없거나 정책상 보이지 않는 경우를 구분해 공격자가 Directory 존재 여부를
추측하지 못하게 한다.

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

## 4. WebSocket 계약

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
