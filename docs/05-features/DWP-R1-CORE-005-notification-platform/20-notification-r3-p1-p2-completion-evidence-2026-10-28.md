# Notification R3 P1/P2 Completion Evidence

- 기준일: 2026-10-28
- Frontend 기준 revision: `1eca2b157309e1ba32e9b623637fb5c3bb10ad5f`
- Backend 기준 revision: `699ef730f21a89200be6dfed6d2e34148014cd10`
- 설계 정본: [Notification R3 P1/P2 하드닝 설계](19-notification-r3-p1-p2-hardening-design-2026-10-28.md)
- 판정: `P1_P2_COMPLETE_LOCAL_LIVE_PASS`

이 문서는 공유 dirty worktree에서 수행한 Notification 전용 변경과 검증만 기록한다. 다른 제품의
동시 변경은 완료 근거에 포함하지 않으며, 이번 작업은 commit 또는 push를 만들지 않았다.

## 1. 요구사항 판정

| 범위                                   | 판정             | 구현·검증 근거                                                                                                                                                                                                           |
| -------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1-A 모바일 필터                       | PASS             | Drawer 전용 draft, cancel/Escape/backdrop 폐기, apply 시 1회 반영, 활성 필터 badge·접근 가능한 이름을 E2E로 고정                                                                                                         |
| P1-A 설정 최신 의도 저장               | PASS             | 단일 in-flight queue, 대기 변경 coalescing, 최신 응답만 draft 정본 반영, 409 1회 rebase, 실패 draft 보존·재시도 unit 회귀                                                                                                |
| P1-A Glance unknown/stale·bulk partial | PASS             | 최초 5xx는 unknown, refetch 5xx는 last-known stale, 표시 항목 bulk 결과의 누락·실패 ID를 부분 실패로 정산                                                                                                                |
| P1-B HRIS 계약                         | PASS             | V36 append-only v2 계약, `requestPublicId` 필수 변수와 exact route, `ko-KR`/`en-US` 결정적 locale, Frontend exact href 회귀                                                                                              |
| P1-C 접근성·지역화                     | PASS             | Noise 추세의 범례·텍스트 요약·동일값 표·패턴, Saved View 아이콘·색상 한국어/영어 이름, keyboard/320·390 반응형 회귀                                                                                                      |
| P1-D 보존 정책                         | PASS             | Production finite positive TTL guard, contract > tenant > platform 결정, materialized decision evidence, active legal hold purge veto                                                                                    |
| P1-D Outbox·scheduler                  | PASS             | backlog/retry/dead/oldest/lease-loss/last-success metric·health, 전송 실패 lease-loss 정산, outbox/retention/reconciliation/SSE scheduler 격리                                                                           |
| P1-D DLT                               | PASS             | DLT는 publish-only이며 자동 consumer/redrive가 없고, listener가 DLT를 소비하지 못하도록 negative invariant gate로 고정                                                                                                   |
| P1-E Frontend·Backend CI               | PASS             | 독립 Frontend unit/type/lint/build/chunk/production-preview/E2E/visual workflow와 실제 PostgreSQL 16.10 4-DB workflow                                                                                                    |
| P1-E 실제 수직 경로                    | PASS             | 브라우저→Gateway→Notification→PostgreSQL/Redis/Kafka 실제 경계 1/1 PASS, skip 0, unexpected 0. saved views·RESOURCE attention contexts·SSE·읽음·attention controls와 UI/Redis/PostgreSQL/Kafka 증거를 동일 실행에서 검증 |
| P2-A URL·지원성                        | PASS             | 설정 view/section/app 검증·canonical URL·history 복원, bounded Support ID 표시·복사, 모바일 동기화 시각                                                                                                                  |
| P2-B route·성능·유지보수               | PASS             | 7개 독립 dynamic entry/closure budget, 30·300·1000건 hard budget, 68개 production 화면 899줄 상한과 controller/view 분리                                                                                                 |
| P2-B SSE 제어 루프                     | PASS             | profile leader 조건, leader handoff/cursor relay, cursor reset, hidden leader 유지, offline wait, deterministic backoff, 429 Retry-After                                                                                 |
| P2-C 환경·권한·producer                | PASS             | 명시 환경 fail-closed, Production TTL/v4 승인 강제, 저장소 v4 DRAFT로 Production 차단, key ID dual-key rotation                                                                                                          |
| P2-C Provider·People                   | BLOCKED_EXTERNAL | readiness는 `BLOCKED_EXTERNAL`; 실제 credential/callback/suppression/endpoint lifecycle과 People snapshot 전까지 활성화하지 않음                                                                                         |

## 2. 주요 구현 증거

### 사용자 정확성·접근성

- `notification-filter-bar.tsx`: 모바일 편집 draft와 적용 경계, active count
- `notification-preference-save-queue.ts`, `use-notification-profile-save-controller.ts`:
  latest-intent 직렬 저장과 conflict recovery
- `notification-header-glance-model.ts`, `notification-header-glance.tsx`:
  unknown/stale/partial settlement
- `notification-noise-quality-trend.tsx`: 시각 차트와 동등한 표·범례·텍스트 대체
- `notification-settings-url-state.ts`, `notification-settings-route.tsx`:
  검증된 공유 URL 상태
- `notification-route-error-support.ts`, `notification-routes.tsx`:
  자유 형식 오류 문구를 노출하지 않는 bounded Support ID

### Backend 운영·보안

- `V36__harden_hcm_employee_change_deep_link.sql`: HRIS exact request deep link와 두 locale template
- `V37__govern_notification_retention_hierarchy.sql`: tenant/contract TTL과 결정 증거, 기존 legal hold 최종 veto 유지
- `NotificationProductionConfigurationGuard`: 환경 누락, Production TTL 0, 미승인 v4를 startup에서 차단
- `NotificationOutboxOperationalMonitor`: backlog/oldest/dead/retry/lease loss와 outbox relay scheduler freshness metric·health
- `NotificationOutboxRelayService`: publish·retry·dead·failure-path lease loss를 의미 손실 없이 정산
- `NotificationSchedulingConfiguration`: outbox, retention, reconciliation, SSE 전용 scheduler
- `NotificationSecurityFilter`: legacy token과 key-ID keyring의 dual-key rotation
- `NotificationExternalCapabilityReadiness`, `NotificationProductAuthorizationReadiness`:
  외부 준비가 없는 상태를 성공으로 오인하지 않는 `BLOCKED_EXTERNAL`
- `NotificationKafkaTopicBoundary`, `check-notification-no-dlt-consumer.mjs`: input/DLT 동일 토픽을
  startup에서 거부하고 DLT consumer·자동 replay 추가를 차단하는 runtime+static negative invariant
- `notification-live-vertical.yml`, `live-notification-vertical.spec.ts`: mock·skip 없이 실제 경계를
  실행하고 Frontend/Backend SHA, correlation ID와 durable evidence를 30일 artifact로 보존
- `auth-api.ts`, `axios-instance.ts`: 인증 성공·세션 회전·OIDC callback 뒤 pre-auth CSRF 캐시를
  폐기하고, mutation의 빈 403에 한해 CSRF 갱신 후 정확히 한 번만 재시도
- `NotificationAttentionContextRepository`: PostgreSQL ARE가 허용하지 않는 bound quantifier를
  길이 predicate와 unbounded character class로 교체하고 RESOURCE 300자·TOPIC 160자 경계를 실제 DB로 고정
- `SavedViewSurfaceAccessPolicy`: `notifications.work`를 `APP.NOTIFICATIONS:VIEW`에 정확히 매핑

### 유지보수·번들

- 기존 대형 관리자 barrel을 제거하고 overview/contracts/operations page 및 6개 admin route entry로 분리했다.
- Center, Policy, Noise, Template의 상세 surface를 별도 모듈로 추출했다.
- Preferences의 section/row도 별도 모듈로 추출했다. 68개 Notification production 화면은 모두
  899줄 이하이며 최대는 Center 888줄, Preferences는 790줄이다.
- route closure는 Vite manifest의 재귀 imports를 계산하고, 이미 warm 상태인 initial shell graph만
  제외한다. 이 계산 규칙 자체도 fixture test로 고정했다.

## 3. 자동 검증 결과

### Frontend

| Gate                                        | 결과                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Notification scoped Vitest                  | 39 files, 257 tests PASS                                                                                      |
| Support-ID focused regression               | 2 files, 6 tests PASS                                                                                         |
| Workflow/chunk/source-size contract         | 8/8 PASS                                                                                                      |
| Live workflow/evidence fail-closed contract | 16/16 PASS                                                                                                    |
| Auth/CSRF focused regression                | 2 files, 66 tests PASS                                                                                        |
| Production build                            | Node 24 fresh build PASS                                                                                      |
| Production-preview performance              | 4/4 PASS, 30/300/1000 목록과 7개 lazy route, 25.0s                                                            |
| Source-size                                 | 68/68 PASS, 최대 888줄                                                                                        |
| Scoped ESLint/Prettier/diff check           | PASS                                                                                                          |
| Visual baseline contract                    | macOS active baseline 17장(명시적 desktop/mobile viewport matrix), snapshot rewrite/ignore 금지 workflow 고정 |
| Settings URL/history E2E                    | PASS                                                                                                          |
| Full TypeScript check                       | Notification/Auth/Live 범위 오류 0; 공유 worktree의 Activity/Home/Payroll 무관 오류 13건은 별도 기록          |
| Live vertical                               | 1/1 PASS, 12.4s, skip 0, unexpected 0                                                                         |

Production route closure 실측과 상한은 다음과 같다. 단위는 KiB이다. LiveKit, MediaPipe,
Temporal, dnd-kit, QR SDK가 알림과 무관한 공용 chunk에 합쳐지는 문제를 별도 vendor group으로
격리했고, fresh build 실측보다 약 25%만 높은 수준으로 모든 closure 상한을 다시 낮췄다.

| Route              | closure raw/gzip 실측 | closure raw/gzip 상한 |
| ------------------ | --------------------: | --------------------: |
| settings           |          244.2 / 79.0 |              288 / 96 |
| admin overview     |          127.2 / 41.6 |              188 / 66 |
| admin contracts    |          113.0 / 41.4 |              156 / 58 |
| admin policies     |          186.0 / 61.3 |              229 / 74 |
| admin templates    |          132.7 / 47.8 |              182 / 66 |
| admin operations   |           90.4 / 31.3 |              102 / 36 |
| admin suppressions |           65.5 / 23.2 |              112 / 40 |

대표 명령:

```bash
node --test scripts/check-notification-route-chunks.test.mjs \
  scripts/check-notification-quality-workflow.test.mjs \
  scripts/check-notification-source-size.test.mjs
node scripts/check-notification-source-size.mjs
corepack yarn vite build
node scripts/check-notification-route-chunks.mjs
corepack yarn vitest run apps/dwp/src/features/notifications \
  apps/dwp/src/components/notification-live-bridge.test.ts \
  apps/dwp/src/components/notification-runtime-host.test.ts \
  libs/shared-utils/src/axios-instance.test.ts \
  libs/shared-utils/src/api/notification-api.test.ts
```

공유 worktree에서 full `tsc`를 한 번 실행했다. Activity 3건, Home 7건, Payroll 3건으로 총 13건의
동시 작업 오류가 남아 전체 명령은 실패했지만 Notification/Auth/Live 변경 경로의 오류는 0건이었다.
Notification 전용 workflow는 clean checkout에서 full typecheck를 필수로 실행하며
`continue-on-error`가 없다. Notification 변경은 TypeScript transpilation을 포함한 production build,
unit/component test와 scoped ESLint를 통과했다. Vitest와 Vite build를 full typecheck 근거로
과장하지 않는다.

### Backend

| Gate                                             | 결과                                                                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Notification 전체 module regression              | 527 tests 실행에서 기존 525 PASS, 신규 경계 fixture와 최신 migration 기대값 2건을 검출; 수정 후 해당 경계 1/1 및 SLA fresh-DB 12/12 PASS |
| 실제 PostgreSQL 16.10 contract                   | 기존 7 classes, 64 tests PASS + 신규 RESOURCE/TOPIC 최대 길이 경계 1/1 PASS                                                              |
| Attention repository + Saved View policy focused | 3/3 + 5/5 = 8/8 PASS                                                                                                                     |
| 실제 Gateway preflight                           | saved views 200, RESOURCE attention contexts 200, correlation ID 확인                                                                    |
| Outbox relay unit                                | 5/5 PASS                                                                                                                                 |
| Kafka input/DLT boundary unit                    | 8/8 PASS                                                                                                                                 |
| Outbox + Kafka boundary final rerun              | 13/13 PASS, skipped/failure/error 0, BUILD SUCCESSFUL 52s                                                                                |
| DLT negative invariant fixture/source            | 4/4 + 3 listeners PASS                                                                                                                   |
| Workflow contract                                | 4/4 PASS                                                                                                                                 |
| Migration/RLS/concurrency/append-only            | PASS                                                                                                                                     |

실제 PostgreSQL class별 결과:

- Reason query: 21
- Attention governance concurrency: 3
- Attention audit: 2
- Structured context materialization: 7
- Noise quality history: 3
- Approval SLA delivery journal: 17
- Approval SLA materialization: 12

기존 합계는 64 tests이고 신규 structured-context 최대 길이 경계를 더해 유효 범위는 65 tests다.
마지막 전체 실행에서 통과한 525건은 다시 전부 반복하지 않고, 실패 원인 두 건만 수정 후 실제
PostgreSQL disposable DB에서 경계 1/1과 SLA 12/12로 재검증했다. skip은 허용하지 않는다.
CI는 PostgreSQL 16.10에서 reason, attention, context, SLA용 disposable DB 4개를 만들고 다음
명령을 실행한다.

```bash
./gradlew :dwp-notification-server:cleanTest :dwp-notification-server:test \
  --no-daemon --max-workers=1 --console=plain
node --test scripts/check-notification-quality-workflow.test.mjs
node scripts/check-notification-no-dlt-consumer.mjs
```

## 4. 외부 Gate

다음은 코드 완료 또는 Production 출시 완료로 표시하지 않는다.

1. Product Authorization v4 승인 bundle과 rollout evidence. 저장소 artifact는 의도적으로 `DRAFT`라
   Production startup이 차단된다.
2. People Target Population Snapshot과 HRIS 실제 relay 활성화 증거.
3. Email, Web/Mobile Push, Teams, Slack 실제 Provider credential, callback, suppression,
   endpoint lifecycle, 발신 도메인과 실패 drill.
4. Production Kafka HA, peak load, DR/복구 실행 증거.
5. Retention, residency, legal hold, support session의 조직 승인.
6. Backend 변경으로 Frontend 저장소의 live workflow를 자동 dispatch하고 required check로 묶는
   cross-repository token/branch-protection 설정. 코드는 `workflow_dispatch`의 exact `backend_ref`와
   두 저장소 SHA 증거를 지원하지만 조직 설정 자체는 저장소 코드로 완료 선언하지 않는다.

위 항목이 준비되기 전 readiness는 `READY`가 아니라 `BLOCKED_EXTERNAL`을 유지한다.

## 5. 최종 판정

`P1_P2_COMPLETE_LOCAL_LIVE_PASS`

최종 로컬 실행은 1건 중 1건 통과, 0건 실패, 0건 skip, 0건 unexpected였다. 12.4초의 동일 실행에서
다음을 모두 증명했다.

- 실제 Gateway 로그인과 exact Product Surface authority
- Notification saved views 200 및 RESOURCE attention contexts 200
- Inbox 200, SSE 200, UI notification 일치, attention controls 200
- 읽음 mutation 단일 시도 `[200]`와 correlation ID
- Redis tenant/user shard signal 일치
- PostgreSQL notification `READ`, outbox `PUBLISHED`
- Kafka `dwp.notification.outbox.v1`의 notification/source event 일치
- Frontend/Backend revision 일치와 예상하지 않은 API/transport 실패 0건

증거는
[`artifacts/notification-live-vertical-final-20261028-2218`](../../../artifacts/notification-live-vertical-final-20261028-2218/)
아래 JSON/HTML report에 보존했다. 상세 evidence의 durable 항목은 모두 `true`이며, 상세 화면 전환
구간의 bounded inbox `net::ERR_ABORTED` 1건만 명시적으로 허용된 cancellation으로 기록됐다.

공유 dirty backend worktree의 무관한 Calendar bean 생성자 결함이 platform startup을 깨뜨리고 있어
원본 코드를 수정하지 않았다. 대신 Backend HEAD의 clean detached worktree에서
`SavedViewSurfaceAccessPolicy` 한 클래스만 컴파일해 기존 정상 platform JAR의 동일 단일 entry를
교체했다. class hash 일치, entry count 1, Boot JAR 무결성, migration digest 불변을 확인한 격리
런타임으로 최종 gate를 실행했다. Notification은 수정 SQL을 bytecode로 확인한 immutable image
`c66a56a9c0d5abb71d074433bec6a09c2370eed21b124f9a459512d3b1cd0f5c`를 사용했다.

P1/P2 코드와 로컬 실제 경계 검증은 완료다. 섹션 4의 실제 Provider credential, Production Kafka
HA/DR, 조직 승인, cross-repository required-check 설정은 코드 범위를 벗어난
`BLOCKED_EXTERNAL`로 유지하며 Production 출시 완료로 과장하지 않는다.
