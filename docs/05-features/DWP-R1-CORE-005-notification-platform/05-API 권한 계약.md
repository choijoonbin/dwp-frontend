# DWP-R1-CORE-005 API·권한 계약

## API 공통

- Prefix: `/api/notifications/v1`
- 인증: 기존 Same-origin HttpOnly Session, Gateway Session Verification과 CSRF
- Tenant·User: Session Context에서만 파생. Client가 전달한 Tenant Header로 전환 금지
- 응답: 기존 DWP Envelope, `correlationId`, 안정적 Error Code
- Mutation: CSRF + `Idempotency-Key` + 낙관적 `version`
- Pagination: Opaque Keyset Cursor, `limit` 최대 100
- Time: UTC ISO-8601 저장·전송, 표시 시 사용자 Timezone 적용

## User API

| Method            | Path                          | 권한                                  | 계약                                                 |
| ----------------- | ----------------------------- | ------------------------------------- | ---------------------------------------------------- |
| `GET`             | `/summary`                    | `NOTIFICATION.INBOX.READ_SELF`        | Badge Counter, View별 Count, Cursor Version          |
| `GET`             | `/sync`                       | Read Self                             | `afterVersion`, 변경 ID·상태·Summary Delta           |
| `GET`             | `/inbox`                      | Read Self                             | `view`, filter, cursor, limit; 권한이 검증된 Preview |
| `GET`             | `/inbox/{id}`                 | Read Self                             | 상세, 수신 이유, Thread, 허용 Action                 |
| `POST`            | `/inbox/{id}/read`            | `NOTIFICATION.INBOX.TRIAGE_SELF`      | 읽음, Version 반환                                   |
| `POST`            | `/inbox/{id}/unread`          | Triage Self                           | 안 읽음                                              |
| `POST`            | `/inbox/{id}/save`            | Triage Self                           | 저장 Toggle이 아닌 명시 Action                       |
| `POST`            | `/inbox/{id}/complete`        | Triage Self                           | Inbox Done, 원업무 완료 아님                         |
| `POST`            | `/inbox/{id}/snooze`          | Triage Self                           | 허용 기간·절대 시각 검증                             |
| `POST`            | `/inbox/bulk-actions`         | Triage Self                           | 최대 100개, 부분 성공 Contract                       |
| `GET`             | `/stream`                     | Read Self                             | SSE Cursor Signal                                    |
| `GET/PUT`         | `/me/delivery-profile`        | `NOTIFICATION.PREFERENCE.MANAGE_SELF` | Quiet·Digest·Global Channel                          |
| `GET/PUT/DELETE`  | `/me/subscription-rules/{id}` | Manage Self                           | App·Type·Channel Override                            |
| `GET`             | `/me/effective-settings`      | Manage Self                           | 관리형 Lock과 합성 결과                              |
| `GET/POST/DELETE` | `/me/endpoints`               | `NOTIFICATION.ENDPOINT.MANAGE_SELF`   | Push Endpoint 등록·철회                              |

Read는 기본적으로 상태를 바꾸지 않는다. Preview가 실제로 열리거나 명시적 User Action이 있을 때만
Read 처리한다. `GET` 요청에서 쓰기 Side Effect를 만들지 않는다.

Triage Mutation은 `Idempotency-Key`와 현재 Resource `version`을 받는다. Bulk Action은 요청당 최대
100개이고 각 항목의 성공·이미 처리됨·충돌·권한 오류를 반환한다. Timeout 후 같은 Key로 재요청해도
상태를 중복 전이하지 않는다.

알림 센터의 Saved View는 기존 Personal Preference API의 검증된 `notifications.savedViews`
Namespace를 사용한다. Notification Domain API에 같은 설정 저장소를 중복 생성하지 않는다.

## SSE Contract

```text
GET /api/notifications/v1/stream?after=<opaque-change-version>
Accept: text/event-stream

id: <signed-user-change-version>
event: notification.changed
data: {"changeVersion":41,"counterVersion":41,"changedIds":["..."]}
```

- Native `EventSource`의 Same-origin Cookie를 사용한다.
- `Last-Event-ID` 또는 Query Version을 `/sync?after=`에 전달해 재연결 Gap을 Catch-up한다.
- Version Token은 Tenant·User·Version·만료를 서명한 불투명 값이며 다른 사용자의 Token은 거부한다.
- 요청 Version이 보존 Watermark보다 오래되면 `NOTIFICATION_SYNC_RESET_REQUIRED`를 반환하고
  Client는 `/summary`와 현재 View 첫 Page를 다시 읽는다.
- Signal에는 제목·본문·Actor·PII를 넣지 않는다.
- Heartbeat는 Comment Frame으로 보내며 UI Event로 처리하지 않는다.
- SSE Node는 Node Channel 구독 → DB Version Sync → 대기 Hint 중복 제거 순서로 연결해 조회와
  구독 사이 Race를 막는다.
- Heartbeat 주기에는 마지막 `counterVersion`을 대조하고 불일치하면 Version Sync API로 복구한다.
- 한 사용자 다중 Tab은 Browser BroadcastChannel로 한 연결을 공유하는 방식을 우선 검토한다.
- Gateway·Proxy Buffering을 끄고 Idle Timeout보다 짧은 Heartbeat를 사용한다.
- 연결 Limit, Backpressure, Slow Consumer Drop과 재연결 Jitter를 적용한다.
- SSE가 장시간 실패하면 가시 탭만 낮은 빈도의 `/sync` Polling으로 저하하고 Background Tab은
  중단한다. Polling은 정상 SSE가 복구되면 즉시 종료한다.

## Producer Contract

### 기본 원칙

Producer는 Notification REST API를 직접 호출하지 않고 자신이 소유한 Domain Event를 기존
`DomainEventRecorder`로 발행한다.

```json
{
  "specversion": "1.0",
  "id": "uuid",
  "source": "dwp-approval-server",
  "type": "dwp.approval.requested",
  "time": "2026-08-19T01:00:00Z",
  "tenantid": "tenant-public-id",
  "subject": "approval/request-public-id",
  "dataschema": "urn:dwp:approval:requested:v1",
  "data": {
    "requestId": "public-id",
    "actorId": "public-id",
    "assigneeIds": ["public-id"],
    "dueAt": "2026-08-20T01:00:00Z"
  }
}
```

- Event에는 이미 Localized된 문구나 HTML을 넣지 않는다.
- 수신자 ID가 Event에 필요한지는 Type Contract가 정한다. 대규모 Audience는 조직·Role Reference와
  Snapshot Version을 사용한다.
- Secret·급여·건강·징계 원문을 넣지 않는다.
- Aggregate Sequence, Correlation, Causation, Trace와 Schema Version을 보존한다.
- Legacy Adapter용 REST Intake가 필요하면 Service Principal, 승인 Contract ID, Idempotency Key,
  제한된 Audience와 Schema Validation을 강제하며 임의 문구 API는 제공하지 않는다.

## External Channel·Callback Contract

- Email Worker는 Job의 `destination_ref/version`을 사용해 Auth의 검증된 Contact Resolver를 단일
  Tenant Context에서 호출한다. Client·Event·Template가 임의 주소를 전달할 수 없다.
- Provider Callback은 사용자 API와 분리된 WAF 보호 Ingress에서 Provider별 서명, Timestamp,
  Nonce, Content Type과 Payload 크기를 검증한다.
- Callback의 `provider_event_id`는 Idempotency Key다. Tenant는 Callback Body가 아니라 발송 시
  저장한 `provider_message_ref`로 복원한다.
- Hard Bounce, Complaint, Invalid Token은 대상 Fingerprint를 Suppression·Endpoint 철회로
  전이하고 같은 목적지로 자동 재시도하지 않는다.
- Provider가 Idempotency나 Message Status 조회를 지원하지 않는 상태에서 전송 응답이 유실되면
  Job은 `UNKNOWN`이다. 중복 민감 Channel은 운영 정책과 Reconciliation 없이 자동 재전송하지 않는다.
- 선택형 Email의 One-click Unsubscribe는 익명 `POST` 전용 Signed Token을 사용한다. Token은
  Tenant·User·Type·목적에 Scope되고 PII를 포함하지 않으며, Mandatory Type이나 다른 Channel을
  해제할 수 없다.

## Admin API

| Prefix                    | 권한                        | 주요 기능                                           |
| ------------------------- | --------------------------- | --------------------------------------------------- |
| `/admin/types`            | `NOTIFICATION.CONTRACT.*`   | Draft, Validate, Review, Activate, Deprecate        |
| `/admin/templates`        | `NOTIFICATION.TEMPLATE.*`   | Locale Revision, Preview, Review, Publish, Rollback |
| `/admin/policies`         | `NOTIFICATION.POLICY.*`     | Effective Diff, Simulation, Approval, Publish       |
| `/admin/providers`        | `NOTIFICATION.PROVIDER.*`   | Health, Endpoint Config Ref, Test, Circuit Breaker  |
| `/admin/operations`       | `NOTIFICATION.OPERATIONS.*` | Lag, Queue, Failure, DLQ, Replay Preview·Execute    |
| `/admin/suppressions`     | `NOTIFICATION.OPERATIONS.*` | Bounce·Complaint·Endpoint Suppression 검토·해제     |
| `/admin/audit`            | `NOTIFICATION.AUDIT.READ`   | Contract·Policy·Replay·Delivery Evidence            |
| `/provider/notifications` | Provider Role               | Fleet, Quota, Global Package, Incident Control      |

Provider Secret 원문은 API로 반환하지 않고 Secret Manager Reference와 검증 상태만 제공한다.

## 권한 Matrix

| Resource       | User                 | Template Editor | Policy Approver | Operator  | Auditor   | Provider Operator |
| -------------- | -------------------- | --------------- | --------------- | --------- | --------- | ----------------- |
| 본인 Inbox     | R/W                  | R/W own         | R/W own         | R/W own   | R/W own   | R/W own           |
| 타인 본문      | 없음                 | 없음            | 없음            | 기본 없음 | 기본 없음 | 없음              |
| Type Contract  | R active             | R               | Approve 일부    | R         | R         | Global package    |
| Template       | R effective          | Draft           | Publish         | R         | R         | Global package    |
| Tenant Policy  | Effective만          | R               | W·Publish       | R         | R         | Metadata          |
| Queue·Provider | 본인 Delivery Health | 없음            | R summary       | W         | R         | Fleet W           |
| Replay         | 없음                 | 없음            | 승인            | Execute   | R         | Provider scope    |
| Audit          | 본인 설정 변경       | 본인 변경       | Scope 변경      | 운영 변경 | R         | Provider metadata |

지원 목적으로 사용자 본문이 필요하면 기존 Provider Support Session Contract, 사유, 대상 Tenant,
TTL과 Audit을 사용한다. Notification 전용 우회 Role을 만들지 않는다.

## 정책 합성 API 규칙

Effective Setting은 다음을 함께 반환한다.

```json
{
  "effectiveMode": "IMMEDIATE",
  "source": "TENANT_POLICY",
  "managed": true,
  "exceptionAllowed": false,
  "ownerLabelKey": "notification.policy.owner.security",
  "channels": ["IN_APP", "EMAIL"]
}
```

UI가 개인 값만 보여주고 실제 관리 정책을 숨기지 않게 한다. 개인 설정 저장은 비허용 값을 `200`으로
무시하지 않고 안정적 `POLICY_CONSTRAINT_VIOLATION`으로 거부한다.

## Error Contract

| Code                                       | HTTP | 의미                      |
| ------------------------------------------ | ---- | ------------------------- |
| `NOTIFICATION_NOT_FOUND`                   | 404  | 본인 Scope에서 없음       |
| `NOTIFICATION_STALE_VERSION`               | 409  | 동시 Triage 충돌          |
| `NOTIFICATION_TARGET_UNAVAILABLE`          | 410  | 원업무 삭제·만료          |
| `NOTIFICATION_POLICY_CONSTRAINT_VIOLATION` | 422  | 관리 정책 위반            |
| `NOTIFICATION_INVALID_CURSOR`              | 400  | 위변조·만료 Cursor        |
| `NOTIFICATION_SYNC_RESET_REQUIRED`         | 409  | Delta 보존 Watermark 경과 |
| `NOTIFICATION_RATE_LIMITED`                | 429  | User·Type·Provider Limit  |
| `NOTIFICATION_CONTRACT_QUARANTINED`        | 422  | 미등록·비호환 Event       |
| `NOTIFICATION_DELIVERY_UNAVAILABLE`        | 503  | Channel Provider 장애     |

## 감사 Event

다음은 기존 감사 Delivery Contract로 기록한다.

- Contract·Template·Policy Draft, Review, Publish, Rollback
- Mandatory·Urgent·Quiet Bypass 변경
- Endpoint 등록·철회와 사용자 Preference 변경
- Provider Test, Circuit Breaker, Suppression, DLQ·Replay
- Support Session을 통한 사용자 Content 접근

일상적인 목록 조회와 각 Read 상태를 모두 중앙 감사 원장에 복제하지 않는다. 보안상 필요한 조회와
Bulk·Export·지원 접근만 감사하고 사용자 Triage Analytics는 비식별 운영 지표로 분리한다.
