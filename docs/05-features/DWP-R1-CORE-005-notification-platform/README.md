# DWP-R1-CORE-005 Notification Platform

- Owner: Shared Experience Platform
- 상태: `foundation-pilot-implemented`; 결정·환경 의존 Production Gate 진행 중
- Roadmap: R1 Core Foundation
- 사용자 제품명: `알림 센터`
- 내부 도메인명: `notification`
- 기준일: 2026-08-24

## 산출물

- [기획 정의](01-기획 정의.md)
- [화면 설계서](02-화면 설계서.md)
- [디자인 정의](03-디자인 정의.md)
- [데이터 설계](04-데이터 설계.md)
- [API 권한 계약](05-API 권한 계약.md)
- [AI Agent 계약](06-AI Agent 계약.md)
- [수용 테스트 및 출시 Gate](07-수용 테스트.md)
- [최종 아키텍처·UX 검토](08-최종 아키텍처 UX 검토.md)
- [Notification Platform ADR](../../03-architecture/R1%20DWP%20Notification%20Platform%20및%20Omnichannel%20Delivery%20ADR.md)
- [기존 Domain Event Delivery Ledger](../../../../dwp-backend/docs/architecture/domain-event-delivery-ledger.md)

## 현재 판정

Direct Recipient 기반 In-app Foundation Pilot은 구현되어 실제 로컬 서비스와 데이터로 동작한다.
Header Badge·Glance, 사용자 알림 센터, 개인 설정, Tenant 운영 개요·계약·전달 운영 화면은 각각의
권한 경계와 Route로 분리했다. `/notifications`는 더 이상 설정·관리 화면의 링크 모음이 아니며,
읽음·저장·나중에·완료·검색·필터·일괄 처리·수신 이유를 제공하는 사용자 Attention Center다.

채택 구조는 `Kafka 업무 이벤트 + 전용 PostgreSQL Inbox·Delivery Job 원장 + Redis Live Hint +
SSE·Version Sync + QoS Channel Adapter`다. PostgreSQL은 읽음·저장·완료·설정·감사 상태를
보존하지만 앱 간 이벤트 Broker로 사용하지 않는다. Critical·Interactive·Bulk는 독립 실행 용량을
가지며 Tenant별 Quota와 RLS를 적용한다.

## 구현 증거

- 독립 `dwp-notification-server`, 전용 `dwp_notification` DB, V1-V21 Migration과 Runtime DB Role
  분리·`FORCE RLS` Guard
- 결재 Domain Event Kafka Pilot, 안정적 Event·Type Identity, 중복 억제와 논리 Thread 갱신
- PostgreSQL 영속 Inbox·Summary·Preference·Admin Projection, Keyset Cursor와 낙관적 Version
- Redis content-free Hint, SSE Catch-up, 30초 REST 동기화 Fallback과 연결 종료 정리
- `/notifications/{home,center,settings}`와
  `/notifications/admin/{overview,contracts,policies,templates,operations,suppressions}` 정보구조와
  권한 경계
- In-app Capability와 Banner·Preview Privacy·Quiet Hours를 활성화했다. Email·Web/Mobile
  Push·Teams·Slack과 외부 Digest 전달은 Provider와 Tenant 운영 검증 전까지 비활성화한다.
- 브라우저에서 목록·상세·검색·필터·반응형 상세와 Header Glance를 실제 데이터로 검증
- Frontend route·navigation·realtime·API 집중 테스트와 알림 범위 ESLint·i18n·Display Dictionary,
  Backend Notification 전체 테스트 통과

### 2026-08-21 런타임 회귀 증거

- 메신저 Domain Event Producer가 비활성 생성자를 선택하던 주입 결함과 Outbox Lease 해제 시
  PostgreSQL `Instant` 바인딩 오류를 수정했다.
- 서로 다른 계정으로 실제 메시지를 생성해 Messaging DB Commit → Transactional Outbox → Kafka →
  Notification Materializer → 수신자 Inbox 경로를 검증했다.
- 동일 대화의 후속 메시지는 Inbox 한 건으로 병합하면서 `threadCount`, Preview, Version을 갱신한다.
  프론트 도착 신호는 알림 ID만이 아니라 `changeVersion + notificationId`로 중복을 판정해 후속
  메시지를 영구 억제하지 않는다.
- Chrome에서 수신자 Header Count, Glance 전체 목록, `Messenger` 출처, 최신 Preview와 관련 업데이트
  수를 확인했고 390x844 반응형 상세 화면의 겹침·수평 Overflow가 없음을 확인했다.
- SSE Endpoint의 `notification.connected`와 `notification.changed`를 실제 세션으로 확인했다. 전체
  Browser·재시작·접근성 조합은 [수용 테스트](07-수용%20테스트.md)의 열린 항목으로 유지한다.
- 수신자에게 노출되는 발신자·본문·행동 링크·발생 횟수를 사용자 Projection에 스냅샷으로 격리하고,
  등록 Producer와 소유 App 계약을 서버에서 강제했다. Producer의 사유 문자열은 Mandatory Policy를
  우회할 수 없으며 동일 원본 Event의 복수 Intent는 독립 Outbox Key를 사용한다.
- Domain Event Outbox 완료·실패는 Worker와 Lease Token을 함께 검증한다. SSE는 연결을 먼저 등록하고
  페이지 단위 Catch-up 중 도착한 Hint를 버퍼링하며, 재연결 Cursor와 100건 초과 변경을 이어서
  복구한다. 읽음·저장·완료 같은 Triage 변경은 화면만 갱신하고 새 도착 Banner를 만들지 않는다.
- V18은 수신자별 Snapshot 도입 전에 공유 Thread에서 복사된 Legacy 발신자·본문·Target·Action을
  안전하게 Redact한다. 보존 Watermark 이전 SSE Cursor는 409를 받으면 모든 Browser Tab에서 폐기하고
  최신 Summary·첫 페이지 기준으로 다시 연결한다.
- Browser 실시간 조정 규약을 `v2`로 분리해 구버전 Web Lock이 새 배포의 Leader 선출을 막지 않게
  했다. 인증된 HTTP Stream이 열리면 연결 상태를 확정하고, Leader·Follower Tab에 Live·Polling 상태를
  명시적으로 공유한다.
- 박현우 계정의 실제 메신저 메시지를 최준빈 Chrome 세션에 전송해 새로고침 없이 Header 미확인 수가
  `2→3`으로 증가하고, 알림 센터 전체 보기에서 발신자·본문·수신 이유가 조회됨을 확인했다.
- SSE 연결이 JPA Open EntityManager in View를 통해 JDBC Pool을 점유하던 결함을 수정했다. 알림 서버
  재기동 후 자동 재연결과 일반 Inbox 조회를 확인했고, 활성 Browser Stream 중 Runtime DB 연결은
  장기 `active` 상태가 아닌 `idle`로 반환됐다. `spring.jpa.open-in-view=false`는 설정 회귀 테스트로
  고정했다.
- 일반 `WORKSPACE_MEMBER` 실제 계정은 본인 Inbox를 조회할 수 있지만 Tenant 운영 API는 403으로
  차단됨을 Gateway 경유로 확인했다.
- 알림 도착의 순수 상태 계산을 React Host에서 Policy 모듈로 분리해 Fast Refresh 전체 재기동 경고를
  제거했다. 개인 설정에는 내부 Type Key 대신 결재·HR·메신저·Space의 사용자용 다국어 명칭과 설명을
  표시한다.

### 2026-08-24 현재 통합 게이트 상태

- Backend 전체 `check`와 823개 Production Source Size Gate를 통과했다. 홈 개인화 서비스는 책임별
  Support로 분리되어 이전 920줄 차단이 해소됐다.
- Frontend 전체 87개 파일·379개 테스트와 Architecture·Source Size·Design System·i18n·Display
  Dictionary·ESLint·TypeScript·Production Build·Bundle Budget를 통과했다.
- 실제 브라우저에서 사용자 Home·Center·Settings와 운영 6개 Route를 모두 확인하고, 읽음·안 읽음,
  저장·해제, Quiet Hours 자동 저장을 수행했다. 자동 저장 중 발견한 감사 Outbox 권한 결함은 V21에서
  `event_id` 열 조회만 허용하도록 수정했고 감사 Event의 `PUBLISHED`까지 확인했다.
- V19의 정확한 Bulk Undo, V20의 Target 수명주기·410 재검사, Counter Reconciliation, Redis·SSE
  복구, 설정 409 Rebase, Policy Runtime 동등성과 Tenant 격리는 자동화 증거로 고정했다.
- 알림 센터 E2E는 최신 `/notifications/center` IA, Fail-closed 목록 Masking, Desktop·iPhone 상세 전환,
  320px·1440px 수평 Overflow 0과 reduced-motion 실행 Animation 0을 검증한다. Select 이름 전달 결함을
  수정한 뒤 두 프로젝트의 `main` Axe Critical·Serious 0을 확인했다.
- 320·390·768·1280·1440px에서 Header Bell·Glance가 화면 경계를 벗어나지 않으며,
  Light·Dark와 Compact·Standard·Comfortable·High Contrast 조합의 수평 Overflow와 Axe를 검증했다.
  Search·우선순위·앱·읽음 Filter와 Bulk Read·Save·Snooze·Complete는 키보드만으로 수행했다.
- 열린 Glance는 새 Event를 즉시 끼워 넣지 않고 버퍼링해 기존 Focus를 유지한다. Badge `0·1·99+`,
  Offline·Partial·Deleted Target 상태도 브라우저에서 검증했으며, 이 과정에서 Badge 상한의 조기 절단과
  Summary·Inbox 장애 Source 중복 집계 결함을 수정했다.
- `전체` Glance는 20건 Burst의 중복 없는 Arrival ID를 한 번의 Polite Status로 집계하면서 열린 목록과
  Focus를 유지한다. `우선순위` Glance는 해당 View의 실제 조회 결과만 집계해 숨겨진 일반 알림을
  과대 계산하지 않는다. 한국어·공백 없는 장문 영어 제목의 320px 목록 생략과 상세 Reflow도 검증했다.
- Keyset `더 불러오기` 점진 Rendering은 다음 Page를 붙여도 기존 항목 순서와 항목별 선택·Action을
  유지한다. Virtual List는 180일 용량·접근성 시험에서 현 방식을 초과하는 이익이 입증될 때만 활성화한다.

### 결정·환경 의존 잔여 작업

- 권한 회수 후 App·Type의 전달 차단과 기존 항목 표시 방식을 Auth의 권위 있는 Entitlement 내부 계약에
  연결한다.
- Tenant 휴일 캘린더 원본과 개인 Timezone·회사 휴일의 합성 우선순위를 확정한 뒤 Quiet Hours에 통합한다.
- Preview·사유·독립 승인·제한 Batch·Reconciliation·감사를 갖춘 Governed Replay 운영 절차를 확정한다.
- Provider Support Session의 본문 가시성, TTL, 사유, 승인과 Redaction 정책을 확정한다.
- Provider 전용 Redacted View의 정보 밀도·시각화는 위 Support Session 정책과 운영자 업무 범위 승인 후 확정한다.
- Virtual List 활성화 임계는 180일 Feed·저성능 단말·Screen Reader 용량 결과로 확정한다.
- Chrome·Edge·Safari·Mobile·접근성 전체 Matrix와 Production QoS·부하·보안·DR 증거를 승인된 환경에서
  수집한다.
- Digest 외부 발송, Channel Worker, People Snapshot Audience는 아래 외부 시스템 계약이 준비될 때까지
  비활성 상태를 유지한다.

### 남은 단계별 의존성

- Direct Recipient In-app Pilot은 완료되었으며 현재 Event Ledger와 Gateway를 사용한다.
- 조직·Role Audience는 People 내부 Target Population Snapshot Contract 완료 전 비활성화한다.
- Email은 Auth Verified Contact Resolver, 발신 Domain 검증, Provider Callback·Suppression이
  준비되기 전 Sandbox Stub만 사용한다.
- 전 Tenant Scheduler와 Provider 운영 API는 각각 Scheduling Metadata·Redacted View 전용 DB
  Role로 분리하며 `BYPASSRLS`를 사용하지 않는다.

## Production 연결·출시 Gate

1. `D-NTF-01`부터 `D-NTF-09`까지 Owner·기한·승인 증거 확정
2. Pilot User·Tenant·Peak Event Capacity Profile과 최종 SLO 확정
3. 개인정보·Retention·Urgent·Residency·Pool·Silo Policy 승인
4. 실제 Provider·Credential·발신 Domain 승인과 Sandbox·Failure Drill 증거 확보
5. Figma·Storybook·Playwright·접근성·부하·보안 증거로 G4 통과

Foundation 구현 완료는 Production 출시 완료를 뜻하지 않는다. 실제 외부 Provider 연결,
People Target Population 기반 대규모 조직·Role Fan-out, Production HA·부하·장애·복구·보안 증거는
G4와 외부 승인 Gate를 통과한 뒤에만 활성화한다.
