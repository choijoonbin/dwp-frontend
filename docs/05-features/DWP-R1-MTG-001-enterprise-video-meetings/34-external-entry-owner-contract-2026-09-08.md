# 외부 게스트·공개 코드·호스트 이전 입장 소유자 계약 (2026-09-08)

## 판정

현재 판정은 **`FAIL_CLOSED / NOT_PRODUCTION_READY`**다.

`PUBLIC_CODE`, 외부 게스트 초대, `guestAccessEnabled`, `allowJoinBeforeHost`는
UI 옵션만 연결해서 열 수 있는 기능이 아니다. 현재 저장소에는 로그인된 workforce
사용자의 tenant identity, 대기실, 참가자 CAS, LiveKit 방 수명주기 계약은 있지만 다음
신뢰 권한이 없다.

- 외부 게스트가 누구인지 증명하고 tenant·meeting·invitee에 묶는 Auth 주체
- 원문을 저장하지 않는 일회용 초대 credential, 만료·소비·회수·회전 계약
- 익명 인터넷 요청을 제한하고 교환 assertion만 내부로 전달하는 Gateway 경계
- 호스트가 오기 전에 방을 여는 durable activator와 권위 있는 host-presence 상태
- 취소·회수·호스트 부재 때 이미 발급된 provider credential을 제거하는 계약

따라서 공개 코드를 내부 사용자 코드로 축소 해석하거나, 이메일·표시명·초대 발송 상태를
인증 증거로 간주하지 않는다. 구현 완료 전까지 UI와 API, 도메인, DB가 모두 같은 방향으로
차단해야 한다.

내부 `INTERNAL`/`INVITED` 사용자는 기존 verified workforce identity와 tenant 경계를
계속 사용한다. 이 사용자군의 `allowJoinBeforeHost`는 외부 게스트보다 먼저 구현할 수 있는
후보이지만, 현재도 안전하게 활성화할 수 없다. provider room 선행 생성, host presence,
absence timeout, room incarnation, credential drain/revoke의 소유 계약이 없기 때문이다.

## 현재 저장소에서 확인된 신뢰 경계

| 경계            | 존재하는 계약                                                                                                 | 외부 입장에 부족한 계약                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Auth/Gateway    | Meeting 호출마다 trusted service token, 양의 user/tenant ID, roles, permissions, person snapshot을 요구       | `GUEST` identity plane, 이메일/조직 증명, 초대 activation, session family, guest revoke      |
| Meeting context | `MeetingRequestContext.Subject(userId, tenantId, personPublicId, ...)`                                        | guest subject type, invitation ID/revision, auth strength, assertion JTI/expiry              |
| Meeting DB      | tenant-scoped meeting/participant FK, `version`, 대기실 `REQUESTED → ADMITTED/DENIED`                         | invite digest/JTI, intended subject binding, redeem/consume/revoke/expiry                    |
| 개인 회의실     | tenant 안의 32자 alias와 `invitation_revision`                                                                | 외부 credential이나 identity proof가 아니며 alias는 media access를 부여하지 않음             |
| 일정 알림       | payload-free `vm_meeting_invitation_outbox`와 delivery state                                                  | 수신자 proof, redeem credential, delivery receipt와 identity의 결합                          |
| 초대 응답       | workforce participant의 RSVP/재확인 상태                                                                      | 입장 인증이나 일회용 token 소비                                                              |
| LiveKit         | host start 시 durable room operation, room incarnation, 짧은 participant token, signed webhook/reconciliation | scheduled prewarm actor, host-presence aggregate, pre-host eviction, issued-token revocation |
| Audit           | meeting/event audit가 동일 트랜잭션에서 실패하면 핵심 변경 롤백                                               | 익명 시도용 privacy-safe actor/evidence와 abuse decision                                     |

근거가 되는 현재 소스는 다음과 같다.

- `dwp-meeting-server/.../security/MeetingSecurityFilter.java`: 모든 Meeting 경로에서
  service token과 verified positive user/tenant를 요구한다.
- `dwp-meeting-server/.../security/MeetingRequestContext.java`: tenant 또는 provider
  workforce 주체 외 guest subject 표현이 없다.
- `V15__create_enterprise_video_meeting_app.sql`: `GUEST`, `PUBLIC_CODE`,
  `allow_join_before_host` 열은 있으나 초대 credential과 소비 상태가 없다.
- `V27__add_personal_meeting_rooms.sql`: alias/revision은 tenant-scoped resolver이며
  guest proof나 provider token이 아니다.
- `V30__extend_meeting_schedule_and_preparation.sql`: invitation outbox는 수신 내용을
  저장하지 않는 delivery intent다.
- `MeetingPersonalRoomService.resolve`: 로그인 tenant 안에서만 alias를 해석하고 join
  credential을 반환하지 않는다.

## 이번에 적용한 release fence

Backend는 `VideoMeetingEntryPolicy`를 단일 정책점으로 사용한다.

- 즉시/예약/반복 일정 생성 전에 `PUBLIC_CODE`, guest flag/invitee,
  `allowJoinBeforeHost`를 거부한다.
- idempotency replay 조회 전에 거부하므로 과거 unsafe row도 성공 응답으로 재생되지 않는다.
- 일정 초안은 `allowJoinBeforeHost=true`를 저장하지 않는다.
- 과거 unsafe row는 코드 조회, 입장 요청, admission 결정, media token 발급,
  provider room start에서 fail closed 처리한다.
- tenant 정책은 guests/pre-host뿐 아니라
  `requireAuthenticatedInternalUsers=false`도 거부한다.
- 코드 조회는 unsafe meeting의 존재를 숨기기 위해 일반 invalid-code 응답으로 수렴한다.

`V40__fence_unverified_meeting_entry.sql`은 애플리케이션 우회를 막는 DB 경계다.

- tenant 정책을 `guests=false`, `pre-host=false`, `authenticated-internal=true`로 정규화하고
  check constraint로 고정한다.
- 새 unsafe meeting 설정과 새 `GUEST` participant를 trigger로 거부한다.
- 기존 guest participant가 있는 meeting은 `guest_access_enabled=true`로 표시해 런타임
  guard가 위험 이력을 놓치지 않게 한다.
- 비 LIVE unsafe 이력은 삭제하거나 안전하다고 위장하지 않고 보존한다. title 변경,
  cancel, retention cleanup 같은 비입장 처리도 가능하다.
- unsafe `LIVE` room이 하나라도 있으면 migration이 중단된다. DB만으로 provider room
  종료와 캐시된 JWT 폐기를 증명할 수 없으므로 배포 전에 운영자가 room을 drain해야 한다.

이 fence는 기능 구현의 대체물이 아니다. 아래 계약이 모두 구현되고 검증된 migration으로
명시적으로 교체되기 전까지 제거하면 안 된다.

## 목표 소유 구조

| 소유자              | 필수 산출물                                                                                                   | 승인 책임               |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Identity/Auth       | guest subject, proof/activation, session family, assertion issuer, JWKS rotation, revoke API                  | Security Identity owner |
| API Gateway/Edge    | public redemption boundary, header stripping, rate limit, CSRF/CORS/referrer/cache 정책, signed exchange 전달 | Edge Security owner     |
| Meeting             | invitation aggregate, entry session, waiting/admission CAS, policy evaluation, revocation fan-out             | Meeting domain owner    |
| Notification        | opaque invitation 전달과 bounce/complaint 처리                                                                | Messaging owner         |
| Live media provider | prewarm/close/kick/revoke, authoritative participant/host events, reconciliation                              | Realtime Media owner    |
| Audit/SIEM          | immutable success/deny/replay/rate-limit evidence와 탐지 규칙                                                 | Audit/SOC owner         |
| Privacy/Data        | email digest key custody, retention, DSAR/deletion, regional residency                                        | Privacy owner           |
| SRE                 | key/clock/provider health, queue lag, drain runbook, capacity/abuse alarms                                    | Meeting SRE owner       |

어느 한 소유자의 준비 상태만으로 feature flag를 열지 않는다. Auth assertion, Meeting
consume, provider enforcement, audit receipt를 같은 release evidence에 묶는다.

## Auth/Gateway 계약

### Guest subject

Auth는 workforce `userId`를 만들어 내지 않는다. 별도의 불변 `guestSubjectId`를 발급하고
다음 속성을 관리한다.

| 필드                       | 요구                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `guestSubjectId`           | 불변 UUID/opaque ID. 이메일 주소를 ID로 사용하지 않음            |
| `sessionFamilyId`          | 재인증·전 기기 revoke 경계                                       |
| `verificationMethod`       | `EMAIL_LINK`, `OIDC_FEDERATION`, `SPONSORED_IDENTITY` allowlist  |
| `authStrength`             | Meeting 정책이 비교 가능한 enum/revision                         |
| `verifiedAt` / `expiresAt` | 서버 시각 기준, bounded lifetime                                 |
| `status`                   | `ACTIVE`, `REVOKED`, `EXPIRED`, `LOCKED`                         |
| `tenantSponsorRef`         | 어느 tenant가 이 외부 identity를 신뢰하는지 나타내는 opaque 참조 |

이메일 proof는 초대 수신자와 같은 mailbox를 통제한다는 증거일 뿐 사람의 법적 신원을
자동 증명하지 않는다. 고위험 회의는 federation 또는 sponsor approval을 요구할 수 있어야
한다.

### One-time redemption

공개 브라우저가 받는 URL은 최소 192-bit entropy의 opaque token을 포함한다. 원문 token은
Auth, Gateway, Meeting, audit, analytics 로그나 DB에 저장하지 않는다.

Gateway public endpoint 예시는 다음과 같다.

```http
POST /api/meetings/v1/guest-invitations/{opaqueToken}/redeem
Content-Type: application/json
Idempotency-Key: <client generated>

{"verificationResponse":"<auth-owned opaque proof>"}
```

Gateway는 모든 클라이언트 제공 `X-DWP-*` identity header를 제거하고, Auth와 Meeting
사이의 mTLS/workload identity로만 내부 호출한다. 성공과 실패의 외부 응답 모양과 시간은
회의·tenant·초대 존재 여부를 열거할 수 없게 수렴시킨다. 성공 시에도 raw invitation
token을 전달하지 않고 60~90초 수명의 signed entry assertion 또는 1회 exchange handle만
내부 Meeting endpoint로 보낸다.

필수 assertion claim:

```text
iss, aud=dwp-meeting-server, typ=meeting-guest-entry-v1
tenantId, meetingId, invitationId, invitationGeneration
participantId, guestSubjectId, intendedEmailDigest
sessionFamilyId, verificationMethod, authStrength
jti, iat, nbf, exp, kid
httpMethod, canonicalPath, requestBodySha256
```

- 비대칭 서명과 rotatable JWKS를 사용한다.
- `aud`, `typ`, method/path/body digest를 exact match한다.
- `exp - iat`는 최대 90초, clock skew는 운영에서 승인한 작은 값으로 제한한다.
- token URL이 referrer/history/telemetry에 남지 않도록 redemption 후 즉시 URL을
  scrub하고 `Cache-Control: no-store`, `Referrer-Policy: no-referrer`를 적용한다.
- 로그인 CSRF와 guest redemption CSRF를 각각 위협 모델링하고 SameSite/origin 정책을
  테스트한다.

## Meeting 영속 모델

아래는 구현 소유자가 migration과 API를 함께 만들 때 필요한 최소 필드다. 이름은 제안이며
의미와 invariant가 호환성 계약이다.

### `vm_meeting_guest_invitations`

```text
invitation_id UUID PK
tenant_id BIGINT NOT NULL
meeting_id UUID NOT NULL
participant_id UUID NOT NULL
invitation_generation BIGINT NOT NULL
credential_digest CHAR(64) NOT NULL
digest_key_id VARCHAR(...) NOT NULL
intended_email_digest CHAR(64)
intended_subject_ref VARCHAR(...)
state ISSUED|REDEEMED|REVOKED|EXPIRED
issued_at, not_before, expires_at
redeemed_at, redeemed_guest_subject_id, redeemed_session_family_id
revoked_at, revoked_by, revoke_reason_code
version BIGINT NOT NULL
created_by, updated_by, created_at, updated_at
```

필수 invariant:

- `(tenant_id, meeting_id, invitation_id)` FK/unique와
  `(tenant_id, credential_digest, digest_key_id)` unique.
- 한 participant의 current generation은 하나만 활성 상태다.
- digest는 HMAC-SHA-256 이상의 keyed digest를 사용하며 key는 DB 밖 KMS가 소유한다.
- `expires_at > not_before`, redeemed/revoked timestamp와 actor 조합을 check한다.
- 재발급은 generation을 증가시키고 이전 generation을 원자적으로 revoke한다.
- 이메일 원문은 필요가 입증된 기존 participant 연락처 외 credential table에 복제하지 않는다.

### `vm_meeting_entry_assertion_replay`

```text
jti UUID PK
tenant_id, meeting_id, invitation_id, invitation_generation
assertion_sha256 CHAR(64)
consumed_at, expires_at
request_correlation_id
```

Meeting은 assertion 검증과 JTI insert를 같은 DB 트랜잭션에서 수행한다. unique 충돌은
성공 replay가 아니라 보안 replay 거부다. 만료 row purge가 늦어도 만료 전 replay
보호가 약해지지 않아야 한다.

### `vm_meeting_entry_sessions`

```text
entry_session_id UUID PK
tenant_id, meeting_id, participant_id
principal_type WORKFORCE|GUEST
principal_ref, session_family_id
invitation_id, invitation_generation
state VERIFIED|WAITING|ADMITTED|DENIED|REVOKED|EXPIRED|
      TOKEN_ISSUED|CONNECTED|LEFT
policy_revision, auth_strength
admission_version, host_presence_revision
room_incarnation
current_token_nonce_digest, token_issue_count
verified_at, requested_at, admitted_at, expires_at, last_seen_at
version, created_at, updated_at
```

`tenant_id`, `meeting_id`, `participant_id`, invitation generation, principal ref는 세션 생성 뒤
변경할 수 없다. admission, revoke, expiry, token issue는 `WHERE version=?` CAS로 갱신한다.
admission 승인 당시의 policy revision만 믿지 않고 token 발급 직전에 현재 정책,
invitation/session 상태, room incarnation, host presence를 다시 검사한다.

### `vm_meeting_host_presence`

```text
tenant_id, meeting_id, room_incarnation PK
state ABSENT|PRESENT|ENDED
present_host_count
provider_sequence, last_provider_event_id
observed_at, absent_since, version
```

host 여부는 클라이언트 선언이나 token 발급으로 바꾸지 않는다. signed provider webhook과
reconciliation 결과만 `provider_sequence`/event replay fence를 통과해 상태를 바꾼다.
organizer, co-host 권한은 해당 시점의 Meeting 역할과 revoke 상태를 다시 확인한다.

## 상태 전이와 원자성

### Invitation

```text
ISSUED --valid proof + atomic consume--> REDEEMED
ISSUED --host/admin revoke-----------> REVOKED
ISSUED --server time-----------------> EXPIRED
REDEEMED --session/invite revoke-----> REVOKED
```

redemption 트랜잭션은 invitation row를 잠그고 tenant, meeting, participant, current
generation, keyed digest, `not_before`, expiry, state, Auth subject binding을 모두 확인한 뒤
JTI를 소비하고 session을 만든다. audit 쓰기가 실패하면 consume과 session 생성도
롤백한다. raw token 비교 대신 constant-time digest 비교를 사용한다.

### Entry session

```text
VERIFIED -> WAITING -> ADMITTED -> TOKEN_ISSUED -> CONNECTED -> LEFT
WAITING  -> DENIED
VERIFIED|WAITING|ADMITTED|TOKEN_ISSUED -> REVOKED|EXPIRED
```

- duplicate client retry는 `Idempotency-Key + request digest` receipt로 같은 결과를 돌려준다.
- 같은 key의 다른 payload는 conflict다.
- host admission은 participant/session expected version을 모두 요구한다.
- 승인과 취소/revoke가 경합하면 DB CAS 승자만 유효하며 token 발급은 다시 lock/revalidate한다.
- Meeting 취소, participant 제거, invitation rotate/revoke, Auth session revoke는 모든
  active entry session을 revoke하고 provider kick/drain command를 outbox에 기록한다.
- provider I/O는 DB transaction 밖에서 수행하되 lease, fence UUID, room incarnation,
  retry 상태를 가진 durable operation으로 완료한다.

## `allowJoinBeforeHost` 별도 단계

내부 workforce 초대자는 guest/public과 identity 계약을 공유하지 않아도 된다. 그러나
다음 media 계약이 완성된 뒤에만 별도 feature flag로 먼저 열 수 있다.

1. Scheduler/Meeting activator가 허용 시작 시각에 durable `PREWARM` operation을 만든다.
2. provider 방 생성은 meeting version, room incarnation, policy revision, scheduled
   window에 묶인다.
3. 입장자는 verified `INTERNAL`/`INVITED` workforce participant여야 하며 waiting-room
   정책을 우회하지 않는다.
4. token 발급 시각이 허용 window보다 이르면 거부한다. 예: 시작 10분 전부터, 정책으로
   상한을 두고 tenant별 임의 무제한 값은 허용하지 않는다.
5. `host_presence=ABSENT` 동안 자동 admission 허용 여부를 별도 정책으로 평가한다.
   첫 출시는 invited workforce만 대기실까지 허용하고 media admission은 host
   presence 이후로 제한하는 단계적 rollout이 안전하다.
6. 부재 timeout, 취소, 일정 변경, policy revoke 시 room을 닫고 participant를 제거하며
   cached token의 짧은 TTL이 끝날 때까지 reconciliation한다.
7. provider가 방 삭제, participant kick, token revocation 또는 짧은 TTL 가운데 어떤
   보장을 제공하는지 adapter capability와 운영 테스트로 증명한다.
8. organizer가 실제 접속하지 않았는데 클라이언트 요청만으로 `PRESENT`가 되지 않는다.

`PUBLIC_CODE`/guest는 위 조건에 Auth·invitation·abuse 계약까지 더해져야 한다. 내부
pre-host 출시가 guest/public fence를 자동으로 해제하지 않는다.

## Abuse protection

Gateway와 Meeting은 다음 축을 조합하되 개인정보 원문을 telemetry label로 쓰지 않는다.

- credential digest bucket
- meeting/tenant bucket
- keyed IP prefix pseudonym과 device/session pseudonym
- 계정/guest subject/session family
- 글로벌 ASN/region 이상 징후

정책에는 짧은 burst, 지속 rate, 실패 누적, exponential backoff, lock duration을 명시한다.
제한 응답은 `429`와 bounded `Retry-After`를 사용하고 존재 여부를 누설하지 않는다.
credential guessing, 동일 token 다중 기기 redeem, 성공 직전 revoke, clock skew, IPv6
rotation, proxy header 위조, tenant enumeration을 자동 테스트한다. Gateway가 신뢰하는
proxy hop 외 `Forwarded`/`X-Forwarded-For`는 버린다.

## Audit와 관측

필수 event 예시:

```text
meeting.guest-invitation.issued
meeting.guest-invitation.redeemed
meeting.guest-invitation.replay-rejected
meeting.guest-invitation.revoked
meeting.entry.requested|admitted|denied|expired|revoked
meeting.prehost.prewarm-requested|room-ready|room-closed
meeting.host-presence.changed
meeting.entry.rate-limited
meeting.provider-participant.removed
```

evidence에는 tenant/meeting/invitation/session의 opaque ID, generation/version,
policy revision, auth strength, reason code, correlation ID, provider room incarnation과
fence만 둔다. raw token, 이메일, IP, user agent, 표시명은 기록하지 않는다. 필요하면
별도 privacy-governed keyed pseudonym을 사용한다.

보안 결정과 핵심 상태 변경은 같은 commit에 audit outbox/evidence를 남긴다. audit가
필수인 경로에서 write 실패는 요청 전체를 실패시킨다. 외부 sink 전송은 leased outbox로
재시도하며 backlog/staleness가 release 기준을 넘으면 새 guest redemption을 차단한다.

## API 최소 집합

| 주체             | API                                                          | 동시성/보안 요구                                                  |
| ---------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Host             | `POST /v1/meetings/{id}/guest-invitations`                   | idempotency key, meeting expectedVersion                          |
| Host             | `POST /v1/meetings/{id}/guest-invitations/{inviteId}/rotate` | invite expectedVersion, old generation revoke                     |
| Host/Admin       | `DELETE .../{inviteId}`                                      | invite expectedVersion, reason code, session/provider revoke      |
| Public browser   | `POST /api/meetings/v1/guest-invitations/{token}/redeem`     | enumeration-safe, rate limited, proof required                    |
| Gateway/Auth     | `POST /internal/v1/meeting-entry-assertions/exchange`        | mTLS/workload identity, one-time assertion                        |
| Verified entrant | `POST /v1/meetings/{id}/join-requests`                       | entry-session binding, idempotency receipt                        |
| Host             | existing admission decision API                              | participant + entry-session CAS                                   |
| Verified entrant | existing token API                                           | admission/session/invite/policy/presence/incarnation revalidation |
| Scheduler        | internal prewarm/close command                               | durable lease/fence, no user-header impersonation                 |

Public response는 제목, organizer, tenant, participant 목록을 proof 이전에 반환하지 않는다.
poll handle도 높은 entropy와 짧은 expiry를 가지며 다른 entry session에 재사용할 수 없다.

## 검증 행렬과 release evidence

기능 활성화 PR은 최소 다음 자동 검증을 포함한다.

- PostgreSQL: tenant mismatch FK, current generation unique, redeem/revoke race,
  consume rollback on audit failure, session/admission CAS, expired JTI purge.
- API/filter: forged/duplicate identity headers, wrong audience/type/path/body,
  unknown kid, expired/not-yet-valid assertion, replay, enumeration-safe response.
- Auth/Gateway integration: 실제 서명 key rotation, old-key overlap/revoke,
  session-family revoke, rate-limit 분산 저장소 장애 시 fail closed.
- Meeting/provider integration: prewarm retry, stale worker, wrong incarnation,
  host webhook duplicate/out-of-order, revoke 후 cached token reconnect 차단,
  absence timeout과 cancel/reschedule drain.
- Multi-tenant: 동일 이메일/token/meeting code라도 tenant 교차 접근 불가.
- Privacy: DB/log/audit/metrics/traces/browser URL에 raw token·이메일·IP가 없음.
- Accessibility/UX: 만료·거부·rate limit의 복구 가능한 상태, 키보드/스크린리더,
  locale, 320px, reduced motion.
- Load/abuse: 공개 endpoint 목표 RPS, hot token, distributed guessing,
  100+ participant room과 provider rate limit.

운영 evidence에는 active key ID/JWKS age, clock skew, rate-limit backend health,
audit outbox lag, provider webhook lag, reconciliation age, pending revoke/drain 수,
prewarm 실패율을 포함한다. 단위 테스트나 mock provider 성공만으로 production gate를
통과시키지 않는다.

## V40 해제 조건

다음 조건을 모두 만족한 하나의 rollout 계획이 승인되어야 한다.

1. Auth/Gateway/Meeting/provider schema와 API가 배포 호환 순서로 릴리스됨.
2. V40 이전 unsafe LIVE room이 0이고 provider drain evidence가 보존됨.
3. feature flag 기본값은 tenant별 `OFF`; 승인 tenant/cohort만 단계적으로 활성화됨.
4. DB trigger를 제거하는 migration이 새 invitation/session constraint와 동시에 적용됨.
5. `PUBLIC_CODE`, guest, internal pre-host를 서로 독립된 capability로 관리함.
6. revoke/replay/expiry/audit/abuse/provider reconnect의 실제 통합 시험이 통과함.
7. rollback은 feature flag 차단, 새 redemption 중단, active session revoke,
   provider drain을 포함함.

그 전까지 안전한 제품 설명은 “로그인된 내부 사용자 대상 코드 입장과 초대 입장이
동작하며, 외부 게스트·공개 코드·호스트 이전 입장은 신뢰 계약 미완료로 차단됨”이다.
