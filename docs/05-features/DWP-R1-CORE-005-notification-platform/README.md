# DWP-R1-CORE-005 Notification Platform

- Owner: Shared Experience Platform
- 상태: `foundation-pilot-implemented`
- Roadmap: R1 Core Foundation
- 사용자 제품명: `알림 센터`
- 내부 도메인명: `notification`
- 기준일: 2026-08-19

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

- 독립 `dwp-notification-server`, 전용 `dwp_notification` DB, V1-V7 Migration과 Runtime DB Role
  분리·`FORCE RLS` Guard
- 결재 Domain Event Kafka Pilot, 안정적 Event·Type Identity, 중복 억제와 논리 Thread 갱신
- PostgreSQL 영속 Inbox·Summary·Preference·Admin Projection, Keyset Cursor와 낙관적 Version
- Redis content-free Hint, SSE Catch-up, 30초 REST 동기화 Fallback과 연결 종료 정리
- `/notifications`, `/account/settings/notifications`, `/admin/notifications/{overview,contracts,operations}`
  정보구조와 권한 경계
- In-app Capability만 활성화하고 Email·Web/Mobile Push·Teams·Slack·Quiet Hours·Digest는 Provider와
  Tenant 운영 검증 전까지 비활성화
- 브라우저에서 목록·상세·검색·Bulk·자동저장·복원·Admin 계약 조회를 실제 데이터로 검증
- Frontend route·navigation·realtime·API 테스트, TypeScript·Architecture·i18n 검사 및 Backend
  Notification 전체 테스트 통과

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
