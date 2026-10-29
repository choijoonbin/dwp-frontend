# Messenger Hardening and Product Completion

- 기준일: 2026-10-28
- 상태: 저장소 범위 구현·검증 완료 (외부 Provider·부하 증거 항목은 `BLOCKED`)
- 대상: `dwp-frontend`, `dwp-messaging-server`, Gateway 및 운영 배포 계약
- 목적: 현재 R1 대화 엔진을 사용자 연속성, 운영 진실성, 확장성까지 갖춘 제품으로 완성한다.

## 1. 제품·운영 질문

### 구성원 Surface

- 주 사용자: Tenant 내부 구성원
- 핵심 질문: 지금 처리할 대화는 무엇이며, 작업 중인 맥락을 잃지 않고 이어갈 수 있는가?
- 기본 행동: 정확한 메시지로 이동하고, 작성·저장·예약·후속 작업을 완료한다.
- 화면 유형: Home은 Focus Queue, Inbox는 List-detail, People은 Search directory다.

### 관리자 Surface

- 주 사용자: Messaging Admin과 운영 담당자
- 핵심 질문: 기능이 설정된 것뿐 아니라 실제로 안전하게 집행되고 있는가?
- 기본 행동: 장애 또는 정책 drift를 조사하고, 고위험 변경은 Preview와 증적을 거쳐 수행한다.
- 화면 유형: 운영 Command Center다. 단순 KPI 카드 모음으로 완료하지 않는다.

## 2. 변경 불가 원칙

1. 성공한 메시지는 PostgreSQL에 먼저 영속화하고, 검색·알림·실시간 전파는 파생 처리한다.
2. App 권한, Conversation Membership, 메시지 시점별 History 권한을 모든 새 API에서 재검증한다.
3. 내부 숫자 ID를 새 공개 계약에 추가하지 않는다. Person·Message·Conversation public ID를 사용한다.
4. 외부 Provider가 없거나 검증되지 않으면 `READY` 또는 성공 상태로 표현하지 않는다.
5. 보존 삭제는 Hold·감사·복구 계약 없이 실행하지 않는다. 안전 조건이 없으면 실행을 거부한다.
6. Offline 저장은 사용자·Tenant 범위, TTL, 로그아웃 삭제, 민감도 정책을 갖춘 데이터만 허용한다.
7. 부분 배포 중 구버전 Client와 신버전 Server가 서로를 실패하게 만들지 않는다.
8. 색상, Presence, 연결 상태는 색 하나만으로 의미를 전달하지 않는다.

## 3. 범위와 우선순위

### H0 — 진실성 및 신뢰 경로

- 검색·Later·공유 자산은 `conversationId + messageId`로 정확한 메시지를 연다.
- 모바일에서도 연결 상태를 compact 형태로 노출한다.
- 모든 읽기 실패 상태에 동일한 Retry·Offline·권한 상실 표현을 제공한다.
- Presence v1 문구는 실제 계약인 `Messenger 접속 중`을 사용한다. `연결 가능`은 선언 상태가
  구현된 뒤에만 사용한다.
- Provider와 정책은 `configured`, `effective`, `state`, `lastVerifiedAt`, `reasonCode`로 구분한다.

### H1 — 작업 연속성

- Draft는 사용자·대화·Thread별 Versioned 서버 원장으로 저장한다.
- Client는 1초 내외 debounce로 저장하고, 409 시 최신본과 안전하게 병합하거나 선택을 요구한다.
- 브라우저 영속 저장 정책이 확정되기 전에는 Versioned 서버 Draft를 손실 방지 원장으로 사용한다.
  Message 재시도는 동일 idempotency key를 유지한다. 영속 Offline Outbox는 별도 정책 승인 전까지
  구현 완료로 표시하지 않는다.
- 예약 전송은 UTC 실행 시각과 사용자 표시 Time Zone을 함께 보존하고, 실행 직전 권한·Membership·
  정책을 다시 확인한다. 첨부 Reservation 계약이 도입되기 전에는 첨부 예약을 UI와 API에서
  fail-closed로 차단한다.
- Later는 `SAVED`, `SNOOZED`, `DUE`, `COMPLETED` 상태와 Reminder를 갖는다.

### H2 — 정보 구조 완결

- `/messages/activity`: Mention, Thread reply, Reaction, 시스템·접근 변경을 통합한다.
- `/messages/threads`: 참여 또는 Follow 중인 Thread를 제공한다.
- `/messages/files`: 현재 접근 가능한 CLEAN 첨부와 Link를 검색한다.
- `/messages/settings`: 알림, 표시, 읽음 확인, 단축키, 접근성 및 Presence 개인정보를 관리한다.
- Home과 우측 Rail은 위 Surface의 요약이며 별도 원장이 아니다.

### H3 — 규모와 성능

- 대화와 People 목록은 Offset 대신 안정적인 Keyset Cursor를 사용한다.
- Timeline과 대규모 Directory는 가상화하고, Focus·Unread·Deep link anchor를 보존한다.
- SSE가 `LIVE`일 때 정기 Polling을 중단하고 Event invalidate 또는 cache patch를 사용한다.
- Polling은 `POLLING`, `RECONNECTING`, 브라우저 복귀 시에만 제한적으로 수행한다.
- Cross-tab leader가 Heartbeat와 공용 SSE를 소유하고 follower는 BroadcastChannel로 상태를 받는다.

### H4 — 보존·운영·규정 준수

- Retention은 `DISABLED`, `DRY_RUN`, `ENFORCING`, `PAUSED`, `BLOCKED` 상태를 갖는다.
- `ENFORCING`은 Legal Hold Authority가 명시적으로 준비됐을 때만 허용한다.
- Batch는 Tenant별 상한과 전역 Kill switch를 적용하고, Preview와 실행 결과를 Audit에 남긴다.
- 삭제 대상은 사용자 본문뿐 아니라 Reaction, Mention, Saved item, Realtime replay, Attachment,
  Search tombstone의 수명주기를 함께 처리한다.
- Admin은 Commit/Fanout/SSE resume/Outbox/Scan/Retention/Presence의 freshness와 SLO를 제공한다.
- 운영 Profile은 Local Storage, Local Scanner, Disabled Meeting Provider로 기동하지 못한다.

### H5 — 생산성 확장

- 선언 Presence: `AVAILABLE`, `BUSY`, `AWAY`, `FOCUS`, `INVISIBLE`, 만료와 근무시간 연동
- Action Capsule: 업무·결정·결재·일정의 원문 링크 및 양방향 상태
- Calendar Meeting Continuity, 승인된 Bot/App/Slash command
- 인용 기반 AI Recap·번역·제안. AI는 자동 실행하지 않고 현재 권한을 확장하지 않는다.

외부 Tenant, CMK, eDiscovery Export, Data Residency는 별도의 법무·보안 승인 Wave로 유지한다.

## 4. API 및 데이터 계약

### 공통 Cursor

```json
{
  "items": [],
  "nextCursor": "opaque-signed-or-versioned-token",
  "hasMore": false,
  "total": 0,
  "generatedAt": "2026-10-28T00:00:00Z"
}
```

- Cursor는 Tenant·사용자·filter fingerprint와 정렬 값을 포함하고 임의 SQL 조각을 받지 않는다.
- 구버전 `page/pageSize`는 한 호환 기간 유지하고 새 Client는 Cursor를 우선 사용한다.

### Runtime readiness

```json
{
  "capability": "RETENTION_ENFORCEMENT",
  "configured": true,
  "effective": false,
  "state": "BLOCKED",
  "reasonCode": "LEGAL_HOLD_AUTHORITY_UNAVAILABLE",
  "lastVerifiedAt": "2026-10-28T00:00:00Z"
}
```

- `state`: `READY`, `DEGRADED`, `UNAVAILABLE`, `BLOCKED`, `DISABLED`
- Admin의 성공 Toast는 저장 성공만 의미하며 Runtime readiness와 혼동하지 않는다.

### Draft와 예약 전송

- Draft key: `(tenant_id, user_id, conversation_id, thread_root_message_id)`
- Draft mutation: `expectedVersion`을 요구하고 본문과 구조화 Mention 수신자를 저장한다. 첨부는
  기존 미첨부 Upload cleanup 수명을 연장하는 Reservation 계약이 없으므로 Draft 원장에 포함하지 않는다.
- Scheduled message: immutable payload revision, `scheduled_for`, `display_time_zone`, 상태, attempt,
  idempotency key, 실패 사유를 보존한다.
- 실행 시점에 정책과 권한을 다시 확인하고 실패를 사용자 Activity로 전달한다.

#### 구현된 작업 연속성 기준선

- `V19`는 대화/Thread별 `msg_message_drafts`와 사용자별 `msg_scheduled_messages`를 추가한다.
- Draft API는 비어 있는 원장을 `version=0`으로 표현하고 생성 후 `version=1`부터 compare-and-swap한다.
  Stale 저장과 삭제는 HTTP 409로 반환한다.
- 예약 Worker는 `FOR UPDATE SKIP LOCKED`와 5분 처리 Lease로 due command를 claim한다. 전송 성공 후
  상태 기록 전에 프로세스가 중단돼도 별도의 send idempotency key로 같은 메시지를 재사용한다.
- 영구 권한·Membership·정책 실패는 `FAILED`, 일시 장애는 상한이 있는 backoff 후 재시도한다. 취소는
  `PENDING`에서만 version 조건으로 허용해 이미 시작된 전송을 취소했다고 오인하지 않는다.
- 첨부 예약은 현재 Attachment cleanup 계약과 소유권 이전을 안전하게 연결할 Reservation 원장이 없어
  의도적으로 차단한다. UI는 원인을 표시하며 서버도 비어 있지 않은 `attachmentIds`를 거부한다.

### Later

- `msg_saved_items`는 상태, reminder 시각, snooze 시각, 완료 시각, version을 갖는다.
- 원본 메시지가 삭제되거나 접근이 회수되면 본문을 노출하지 않고 상태만 안전하게 정리한다.

## 5. UI 계약

- Home 첫 viewport는 실제 처리 Queue를 먼저 보여주며 빈 모듈은 큰 공간을 차지하지 않는다.
- Context Rail은 넓은 화면에서는 고정, 1280px 이하에서는 Drawer, 사용자 선택으로 접을 수 있다.
- 검색, 필터, 선택, 관리자 시간 범위는 URL에 보존한다.
- Error state는 원인 범주, 마지막 성공 시각, Retry, 안전한 대체 경로를 제공한다.
- People 버튼 접근성 이름은 `{{name}}에게 메시지 보내기`처럼 행 대상을 포함한다.
- 모바일에서도 Offline/Reconnecting/Live 상태를 색과 텍스트로 전달한다.
- 상태 색상은 design-system semantic token을 사용하며 임의 Hex를 추가하지 않는다.

## 6. 보안 및 개인정보

- Draft·Scheduled payload를 일반 로그, Metric label, Trace attribute에 기록하지 않는다.
- Presence와 Typing Redis key에는 숫자 user ID 외 이름·이메일·본문을 넣지 않는다.
- 파일 검색과 다운로드는 결과 조회 시점과 Grant 발행 시점에 Membership을 각각 확인한다.
- Retention Preview와 실행은 별도 권한·감사 event·상관 ID를 요구한다.
- Admin은 일반 메시지 본문을 조회할 수 없다.
- High classification 메시지는 Notification, Activity, Offline cache에서 보호된 Preview만 사용한다.

## 7. 호환·배포 순서

1. Additive DB migration과 Server read contract를 먼저 배포한다.
2. 신·구 Client 호환 응답을 검증한 뒤 Frontend를 배포한다.
3. Runtime readiness는 초기 `DISABLED/BLOCKED`로 시작한다.
4. Preview와 Production clone 검증 후 기능별로 `READY` 전환한다.
5. Retention은 `DRY_RUN` 결과·Hold Authority·복구 Drill 승인 후에만 `ENFORCING`으로 바꾼다.
6. Cursor 전환 후 Offset 사용률이 0이 된 호환 기간 다음에 Legacy 경로를 제거한다.

## 8. 수용 기준

### 기능

- 검색·저장·파일 결과가 정확한 메시지를 열고 포커스하며 주변 문맥을 보여준다.
- Draft는 새로고침·대화 이동 후 복구되고 동시 수정 충돌을 조용히 덮어쓰지 않는다.
- 현재 탭의 전송 재시도는 같은 idempotency key를 유지해 중복을 만들지 않는다. 브라우저를 닫은 뒤에도
  재개되는 영속 Offline Outbox는 보안·TTL·로그아웃 삭제 정책 승인 전까지 수용 범위가 아니며,
  구현된 것처럼 표시하지 않는다.
- 예약 전송은 Time Zone·DST 경계와 권한 변경을 올바르게 처리한다.
- Activity, Threads, Files, Settings는 로딩·빈·오류·권한 상태를 모두 제공한다.

### 운영

- Retention은 Hold Authority 장애 시 한 건도 삭제하지 않는다.
- Provider가 비활성 또는 Local-only이면 Admin과 Health가 `READY`를 반환하지 않는다.
- Redis 장애 중 Durable send/history는 유지되고 Presence·Typing만 Degraded된다.
- SSE 재연결 폭주와 Slow consumer가 Durable commit을 고갈시키지 않는다.

### 품질

- Frontend: typecheck, lint, focused unit, 전체 Messenger E2E, Axe
- Backend: unit, PostgreSQL·Redis integration, migration invariant, OpenAPI sync
- 화면: 1440, 1280, 390, 320, 200% zoom, light/dark/high contrast/reduced motion
- 부하: Cursor pagination, 20k 연결, hot conversation, reconnect storm, retention batch
- 변경된 사용자 Journey는 Playwright screenshot과 실패 상태 증적을 남긴다.

## 9. 완료 정의

기능이 렌더링되거나 API가 존재하는 것만으로 완료하지 않는다. 대표 사용자 Journey, 권한 회수,
부분 장애, 재시도, 운영 freshness, 롤백 계약과 자동화 테스트가 함께 통과해야 완료다. 외부 Provider가
필요한 항목은 코드·설정·Health·Runbook을 완성하고 실제 환경 검증 전까지 명시적으로 `BLOCKED`로
남긴다.

## 10. 동결된 구현·검증 매트릭스

이 표는 구현 종료 전에 합의한 단일 기준선이다. 마지막 릴리스 검증에서 새 제품 범위를 추가하지 않고,
각 행을 구현 직후 검증한다. `외부 증거 필요` 항목은 코드가 있어도 실제 Provider 증거 전에는 READY로
승격하지 않는다.

| 묶음          | 필수 계약                                                           | 구현 증거                                                    | 종료 Gate                                    |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| 접근·식별자   | Tenant/User/Membership/History 재검증, 새 공개 API에 숫자 ID 금지   | Public UUID DTO·scope-bound cursor·회수 후 fail-closed query | 단위 + PostgreSQL 권한 회귀                  |
| 메시지 진실성 | Domain mutation과 realtime log 원자 커밋, 동일 key 재시도           | 트랜잭션 append·rollback 검증·idempotency                    | PostgreSQL commit/rollback 회귀              |
| 작업 연속성   | Versioned draft, DST-safe schedule, 실패 Activity, Later 상태       | CAS·worker lease·Temporal resolver·FAILED projection         | 충돌·DST gap/overlap·권한회수 테스트         |
| 개인정보      | Protected preview redaction, Admin 본문 미노출                      | conversation/home/activity/file/admin projection redaction   | 분류별·membership 회수 회귀                  |
| Cursor·규모   | Tenant/User/filter-bound keyset, legacy fallback                    | People/conversation/schedule opaque cursor                   | 변조·교차 scope·동률 정렬 테스트             |
| 실시간        | SSE resume, cross-tab leader, bounded catch-up, Redis 장애 fallback | event id/replay·leader election·adaptive polling             | reconnect·high cursor·identity switch 테스트 |
| 운영 준비도   | Commit/SSE/Fanout/Outbox/Scan/Retention/Presence/Schedule 증거      | DB probe·전용 pub/sub nonce·tenant outbox backlog·freshness  | 실패 주입 + 외부 증거 필요                   |
| 보존          | Hold fail-closed, fair batch, tombstone, attachment lifecycle       | DRY_RUN/ENFORCING 구분·request hash·worker heartbeat         | PostgreSQL migration + retention 회귀        |
| UI·접근성     | Loading/empty/error/retry, keyboard, semantic status, responsive    | 각 Surface 상태 UI·대상 포함 aria label                      | unit + Axe + 1440/1280/390/320/200%          |
| 계약·배포     | Additive migration, 구버전 fallback, OpenAPI 동기화                 | V18–V24+ migration·generated contracts·runbook               | migration from zero + contract diff          |

### 명시적 비범위와 READY 경계

- 영속 Offline Outbox, 선언 Presence, Bot/App, Calendar continuity, AI 기능은 이번 기준선의 완료 항목이 아니다.
- Local attachment storage/scanner, 비활성 Meeting, 검증되지 않은 telemetry는 Production READY가 아니다.
- Kafka outbox의 `PUBLISHED`는 broker ACK 증거이며 최종 사용자 알림 materialization 증거로 과장하지 않는다.
- 부하 목표(20k 연결, reconnect storm)는 전용 환경 실행 증거가 없으면 문서상 목표로 남기고 통과로 표시하지 않는다.

## 11. 구현 완료 범위

### Presence와 개인정보

- 우측 구성원 상태는 가비지 정적 목록이 아니라 Redis lease 기반 `Messenger 접속 중` 상태를 조회한다.
- `V25__add_presence_sharing_privacy.sql`에서 사용자별 Presence 공유 동의를 영속화했다.
- 사용자가 공유를 끄면 현재 lease를 회수하고, 이후 heartbeat도 DB 동의를 매번 확인한다.
- 동의 조회 장애는 fail-closed로 처리하며, PostgreSQL advisory lock으로 opt-out과 heartbeat 갱신 경쟁을
  차단한다.
- 화면은 색만으로 상태를 전달하지 않으며, 연결 문구와 개인정보 토글을 함께 제공한다.

### 사용자 연속성과 UI 신뢰성

- 검색어와 대화 필터를 URL에 보존하고 새로고침 뒤 복원한다.
- 오래된 reply deep link에서도 Thread panel을 유지하며, 조회 실패 시 오류와 재시도 동작을 제공한다.
- Home, Search, Settings, Display, Members, Create, Admin 읽기 실패를 공통 오류 분류와 재시도 계약으로
  통일했다.
- 계정의 고대비·동작 줄이기 설정과 Messenger Presence 개인정보 설정을 실제 서버 계약에 연결했다.
- People cursor pagination, 대규모 행 `content-visibility`, 모바일 제목·Thread·composer 배치, history prepend
  scroll anchor를 회귀 테스트로 고정했다.
- Later 완료 상태는 semantic success token과 outlined 표현을 사용해 light/mobile 대비 기준을 충족한다.

### 서버 진실성·계약

- 예약 전송 idempotency fingerprint를 immutable 요청 기준으로 고정하고, 동일 재시도는 현재 시각·권한
  변화 뒤에도 저장된 응답을 반환하며 다른 payload는 충돌 처리한다.
- Presence 응답과 업데이트 요청의 OpenAPI required/optional 차이를 명시하고, 이름이 충돌하던 Messaging
  Attention·Collaboration 스키마를 고유 이름으로 분리했다.
- Spring proxy가 필요한 Presence 정책 구현은 public/non-final 계약과 회귀 테스트로 보호한다.
- Retention PostgreSQL 통합 테스트는 고정 tenant의 감사 이벤트까지 정리해 반복 실행 간 오염을 제거했다.

## 12. 종료 검증 증거

| Gate                          | 실행 결과                                                                                                                            | 판정                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Backend 전체 테스트           | 최초 347개 중 346개 통과. 유일한 실패는 고정 tenant 감사 이벤트 잔존으로 확인했고 fixture 정리 후 해당 PostgreSQL 테스트 재실행 통과 | Messenger 제품 결함 없음    |
| Backend Presence/OpenAPI 회귀 | `MessagingPrivacyServiceTest` 7/7, `MessagingOpenApiSchemaIdentityTest` 3/3 통과                                                     | 통과                        |
| PostgreSQL·Redis·Migration    | 실제 PostgreSQL/Redis 통합 테스트 통과, Presence 6건·fanout 1건 통과, Flyway V1–V25 적용·검증 통과                                   | 통과                        |
| 실제 서버 기동                | Messaging Spring Boot 실제 기동과 V1–V25 migration 완료                                                                              | 통과                        |
| OpenAPI                       | 12 services, Gateway public 1,769 paths 검증 및 Frontend generated contract 동기화                                                   | 통과                        |
| Frontend unit                 | 기준선 43 files/203 tests 통과. 마지막 제품 수정 focused suites 5/11, 3/6, 2/4도 각각 통과                                           | 통과                        |
| Messenger 정적 품질           | Messenger TypeScript 오류 0, scoped ESLint·Prettier·`git diff --check` 통과                                                          | 통과                        |
| Messenger E2E                 | 전체 74개 최초 실행은 58 pass/15 fail/1 skip. 15개 실패를 공통 원인별 수정한 뒤 해당 Chromium·Mobile 조합을 모두 선택 재실행해 통과  | 통과                        |
| 저장소 전체 TypeScript/i18n   | Messenger 외 Activity·Calendar·Home·HRIS·Notification 타입 오류와 기존 i18n 721건이 남음. Messenger 관련 i18n 출력은 0               | 별도 저장소 부채            |
| 외부 Provider·대규모 부하     | 실제 외부 Provider, 20k 연결, reconnect storm, production-clone retention 부하 증거는 이번 로컬 검증에 없음                          | `BLOCKED` / READY 승격 금지 |

최종 판정은 저장소에서 구현·검증 가능한 Messenger 범위의 완료다. 외부 인프라가 필요한 항목은
readiness와 fail-closed 계약 및 운영 문서까지만 완료했으며, 실제 환경 증거 전에는 `READY`로 표시하지
않는다.
