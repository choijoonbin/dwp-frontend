# DWP-R1-CORE-005 Notification Platform

- Owner: Shared Experience Platform
- 상태: `build-ready`
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

Header의 기존 알림은 정적 Badge와 두 항목만 가진 Prototype이다. 본 Package가 승인되기 전에는
운영 가능한 알림 기능으로 간주하지 않는다.

채택 구조는 `Kafka 업무 이벤트 + 전용 PostgreSQL Inbox·Delivery Job 원장 + Redis Live Hint +
SSE·Version Sync + QoS Channel Adapter`다. PostgreSQL은 읽음·저장·완료·설정·감사 상태를
보존하지만 앱 간 이벤트 Broker로 사용하지 않는다. Critical·Interactive·Bulk는 독립 실행 용량을
가지며 Tenant별 Quota와 RLS를 적용한다.

## 내부 Foundation 착수 판정

G0부터 G3까지의 제품·아키텍처·데이터·UX 명세와 최종 재검증이 완료되어 내부
Foundation 구현을 시작할 수 있다. 구현 순서는 최종 검토서의 Build Sequence를 따르며,
첫 Pilot Producer는 `결재 요청`, `직접 멘션`, `보안 조치` 세 개 이하로 제한한다.

### 단계별 내부 의존성

- Direct Recipient In-app Pilot은 현재 Event Ledger를 사용해 바로 착수할 수 있다.
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

Service, Migration, API와 화면 구현은 아직 시작하지 않았다. 외부 결정 항목은 Interface·Stub·Test
Harness 구현을 막지 않지만, 실제 Provider 연결과 Production 완료 판정은 G4 증거와 외부
승인 Gate를 통과한 뒤에만 가능하다.
