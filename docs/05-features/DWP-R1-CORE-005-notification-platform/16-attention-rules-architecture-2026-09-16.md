# Notification Attention Rules 아키텍처

기준일: 2026-09-16

## 결정

기존 `Kafka + PostgreSQL Inbox + Redis Hint + SSE/REST Sync` 구조는 유지한다. 새 Broker나 별도
검색 제품을 추가하지 않는다. 고도화는 Notification Platform 내부에 사용자 소유
`Attention Rule`과 Saved View v2를 추가하고, Producer가 제공한 정규 Metadata만 평가한다.

핵심 원칙은 다음과 같다.

- Notification은 원업무 상태와 권한을 소유하지 않는다.
- 사용자 규칙은 수신·표시·전달을 제어하며 원업무 접근 권한을 만들지 않는다.
- 중앙 서비스는 임의의 메시지·HR·결재 본문을 Keyword 검색하지 않는다.
- Mandatory 정책과 보안 알림은 사용자 Mute로 우회할 수 없다.
- 관심 규칙 평가는 Inbox Materialization 경로에서 Batch로 수행하며 사용자별 N+1 조회를 금지한다.

## 제품 모델

### `AttentionRule`

```text
ruleId
tenantId
userId
scopeKind: APP_TYPE | ACTOR | THREAD | RESOURCE | TOPIC_TOKEN
scopeKey: canonical opaque key
effect: FOLLOW | PRIORITIZE | MUTE
channels: optional channel overrides
startsAt / expiresAt
source: USER | TENANT_POLICY | SYSTEM_DEFAULT
managed / exceptionAllowed
version / createdAt / updatedAt
```

규칙 Scope는 Exact Match만 허용한다. 정규식과 자유 SQL 표현은 허용하지 않는다.

### `NotificationContextReference`

Producer가 다음 Metadata를 계약으로 제공한다.

```text
kind: PERSON | CONVERSATION | THREAD | CHANNEL | PROJECT | WORK_ITEM | TOPIC
key: owner-app canonical opaque reference
displayHint: optional, recipient-safe localized label
matchable: contract-governed boolean
```

기존 `actorReference`, `subjectReference`, `targetReference`, `threadKey`는 호환 유지한다. 신규 Producer는
구조화된 Context Reference를 함께 제공하고 Notification은 소유 App, Tenant, Type Contract와 일치할
때만 Match 대상으로 사용한다.

### Saved View v2

```text
contract: dwp.notifications.center.saved-view
version: 2
scope: 기존 view/query/appKey/priority/readState/reason
presentation:
  density: DENSE | DETAILED
  grouping: NONE | SOURCE | CONTEXT
contextFilters: bounded rule/context references
```

v1은 읽을 수 있어야 하며 v2 기본값 `DETAILED/NONE`으로 승격한다. v2 저장 후에도 v1 Client가
이해하지 못하는 값을 파괴하지 않도록 서버의 Governed Saved View Version 협상을 사용한다.

## 정책 우선순위

1. System·Provider·Tenant Mandatory 정책
2. Tenant 허용·차단 정책과 보안·규제 우회 규칙
3. 사용자 Exact Resource/Thread 규칙
4. 사용자 Actor/VIP 규칙
5. 사용자 Governed Topic 규칙
6. 사용자 App/Type 규칙
7. Global Delivery Profile과 시스템 기본값

같은 계층·Scope에서는 `MUTE > PRIORITIZE > FOLLOW` 순서로 충돌을 해소한다. 더 구체적인 사용자
규칙은 더 넓은 사용자 규칙보다 우선하지만 Mandatory 정책을 넘지 못한다. `PRIORITIZE`는 Inbox
정렬과 Banner 후보를 높일 수 있으나 Tenant가 허용하지 않은 Quiet Hours 우회 권한은 만들지 않는다.

모든 최종 결정은 다음 설명 값을 남긴다.

```text
decision: DELIVER | DEFER | DIGEST | SUPPRESS
matchedRuleId
matchedScopeKind
policySource
reasonCode
ruleRevision
```

## 데이터 설계

다음 사용 가능한 Flyway 번호로 Migration을 만든다. 번호를 설계 문서에서 선점하지 않는다.

### `ntf_user_attention_rules`

- PK: `rule_id`
- Tenant/User FK와 `FORCE RLS`
- Canonical Scope Key 원문은 필요 시 암호화하고 비교용 SHA-256을 별도 저장
- Unique: `(tenant_id, user_id, scope_kind, scope_key_hash)`
- Index: 사용자 활성 규칙, 만료 규칙 청소, Revision 조회
- 한 사용자 기본 상한: 활성 500개. Tenant 정책으로 더 낮출 수 있다.

### `ntf_user_attention_rule_channels`

- Rule별 Channel Override
- Rule 삭제 시 Cascade
- 비활성 Provider Channel은 저장 가능하더라도 Effective 결과에서 비활성 사유를 표시한다.

### `ntf_recipient_notification_contexts`

- 수신자 Projection 전용이며 공유 Notification 본문과 분리한다.
- `(tenant_id, user_id, notification_id, kind, key_hash)` Index
- Context 표시 Hint는 Recipient-safe Snapshot만 저장한다.
- Retention과 Redaction은 부모 수신 알림과 동일하게 적용한다.

### `ntf_attention_rule_audit_outbox`

- 생성·수정·삭제·정책 강제·충돌·시험 알림을 감사한다.
- Scope Key 원문과 사용자 콘텐츠를 Outbox에 넣지 않는다.

## API 계약

### 사용자 규칙

```text
GET    /api/notifications/v1/me/attention-rules
POST   /api/notifications/v1/me/attention-rules/preview
POST   /api/notifications/v1/me/attention-rules
PUT    /api/notifications/v1/me/attention-rules/{ruleId}
DELETE /api/notifications/v1/me/attention-rules/{ruleId}
```

- Mutation은 `Idempotency-Key`와 정규 십진수 `expectedVersion`을 요구한다.
- Tenant/User 불일치는 404, 권한 회수는 fail-closed, 오래된 Version은 409다.
- Preview는 예상 영향과 Mandatory 충돌을 반환하지만 상태를 쓰지 않는다.

### 현재 알림의 Context 제어

```text
GET  /api/notifications/v1/inbox/{notificationId}/attention-controls
POST /api/notifications/v1/inbox/{notificationId}/attention-controls
```

응답은 사용 가능한 `MUTE_TYPE`, `MUTE_CONTEXT`, `FOLLOW_CONTEXT`, `PRIORITIZE_ACTOR`와 각각의
정책 잠금·만료·예상 영향을 반환한다. Client가 임의 Scope Key를 조립하지 않고 서버가 현재
Recipient Projection에서 정본 Context를 해석한다.

### 시험 알림

```text
POST /api/notifications/v1/me/test-deliveries
GET  /api/notifications/v1/me/test-deliveries/{testId}
```

- 분당 1회, 일 10회 기본 제한
- 실제 Inbox와 Analytics KPI에 투영하지 않음
- 24시간 자동 만료
- Banner/Preview/Endpoint 도달 단계와 실패 사유만 반환
- Mandatory·원업무 Action을 포함하지 않음

## Materialization 처리

```text
Domain Event
  -> Contract/Producer ownership validation
  -> Recipient entitlement admission
  -> Bulk load tenant policy + recipient rule revisions
  -> Exact context match and effective decision
  -> Recipient snapshot + decision reason commit
  -> Outbox/Kafka delivery jobs
  -> Redis content-free change hint
  -> SSE/REST durable synchronization
```

- 사용자 규칙 Cache Key: `tenantId:userId:ruleRevision`.
- Redis에는 Revision과 무내용 Invalidating Hint만 둔다.
- Rule 본문과 사람·Project Label을 Redis Pub/Sub에 싣지 않는다.
- 한 이벤트의 수신자 Batch에서 규칙을 일괄 조회하고 동일 Revision을 재사용한다.
- Cache Miss/Redis 장애 시 PostgreSQL 정본으로 평가하며 정책을 추정하지 않는다.
- Rule 변경 직후 새 Materialization부터 적용한다. 이미 생성된 Inbox를 소급 삭제하지 않는다.

## 보안과 개인정보

- 모든 API는 현재 Notification PEP, Tenant/User Binding, RLS를 그대로 통과한다.
- Actor/Resource Rule 생성은 사용자가 해당 Context를 볼 권한이 있는 현재 알림에서만 시작한다.
- 원업무 Deep Link는 열 때 Owner App이 권한과 최신 상태를 다시 검사한다.
- Topic Watch는 Producer가 Allowlist로 등록한 저민감 Token만 허용한다.
- HR·보안·결재 본문을 중앙 플랫폼이 자유 텍스트로 색인하지 않는다.
- 운영자 Analytics는 익명 집계만 노출하고 소규모 집단은 최소 집계 임계치 아래에서 숨긴다.
- 규칙 변경, 정책 잠금, 시험 알림은 감사되며 Support Session에도 Scope 원문은 기본 Redact한다.

## 화면 연결

- `/notifications/center`: Dense/Detailed Toggle, Context Filter, Saved View v2.
- 알림 상세: `왜 받았나요?` 아래에 Contextual Follow/Mute와 관리형 잠금 사유.
- `/notifications/settings?section=attention`: 중요 인물, Follow 중인 업무, Mute, Topic Watch.
- `/notifications/admin/policies?tab=attention`: 허용 Scope, Rule 한도, Mandatory 우선순위.
- `/notifications/admin/overview?focus=noise`: 익명 Noise Quality 지표와 Finding.

Sidebar 메뉴는 추가하지 않는다.

## 관측성

OpenTelemetry Messaging Semantic Convention의 Create/Send/Process/Settle 구분과
Conversation ID를 사용한다. Content와 Scope Label을 Trace Attribute로 기록하지 않는다.

필수 Metric:

- `notification.attention.evaluate.duration`
- `notification.attention.rule.match.count{scope,effect}`
- `notification.attention.suppressed.count{reason}`
- `notification.attention.cache.stale.count`
- `notification.attention.preview.count{outcome}`
- `notification.test_delivery.count{channel,outcome}`
- `notification.noise.mute_rate{app,type}`
- `notification.action.conversion{app,type}`

참조:

- [CloudEvents](https://cloudevents.io/)
- [OpenTelemetry Messaging spans](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/)
- [Kafka idempotent delivery와 transaction](https://kafka.apache.org/40/design/design/)
- [FCM 대규모 전송 권고](https://firebase.google.com/docs/cloud-messaging/scale-fcm)
- [FCM TTL과 collapse](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan)

## 검증 계획

### Backend

- RLS Tenant/User 격리, 401/403/404/409/429, Duplicate Replay, Version Conflict.
- Mandatory vs Mute, Specific vs Broad, VIP vs Explicit Mute 정책 표 전체.
- Rule 생성 후 신규 알림 즉시 반영, 기존 알림 무변경.
- Cache Hit/Miss/Stale/Redis 장애 동등성.
- 500 Rule 사용자와 대규모 Recipient Batch에서 N+1 없음.
- 시험 알림 Inbox·KPI·외부 업무 원장 무투영.

### Frontend

- Saved View v1→v2 복원, Dense/Detailed, Grouping, Back/Forward.
- 현재 알림 Context 제어의 Optimistic UI와 409 Rebase.
- 관리형 규칙 잠금, 만료, Empty/Error/Offline/Partial.
- 320/390/768/1440/1920px, 200% Zoom, Keyboard, Screen Reader, Reduced Motion.
- 밝은/어두운/고대비에서 Overflow 0과 Axe Critical·Serious 0.

### 운영

- 규칙 Cache 강제 무효화 Drill.
- Kafka/DB/Redis 장애 시 결정 일관성.
- Provider 429·5xx Backoff/Jitter, TTL/Collapse, Stale Endpoint 정리.
- Noise 지표에 PII가 포함되지 않는지 자동 Scan.

## 단계별 출시

1. E1: Saved View v2와 Density. Feature Flag, 기존 데이터 무변경.
2. E2: Actor/Thread/Resource Rule과 Contextual 제어. In-app 전용.
3. E3: 시험 알림과 진단. Web Banner부터 활성화.
4. E4: Governed Topic Token. Pilot Producer 1개 후 확대.
5. E5: 익명 Noise Quality. 최소 집계 임계치 승인 후 관리자 노출.
6. E6: 외부 Provider. 기존 Production Gate를 통과한 채널만 개별 활성화.

각 단계는 독립 Rollback이 가능해야 하며 새 기능이 실패해도 기존 App/Type 설정과 Inbox Triage는
계속 동작해야 한다.
