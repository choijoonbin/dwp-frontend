# DWP-R1-MSG-001 Enterprise Messaging

- 상태: Design complete, implementation approval pending
- 기준일: 2026-08-19
- 제품명: `메신저` / `Messenger`
- Route: `/messages`
- App Resource: `APP.MESSAGING`
- Backend: `dwp-messaging-server`, `dwp-messaging-realtime-gateway`

## 제품 정의

DWP 메신저는 일반 채팅 복제품이 아니다. People에서 사람을 찾고, Space 멤버십을 상속하며,
Calendar 회의와 대화를 이어가고, 메시지에서 업무·결정·결재·서비스 요청을 안전하게 연결하는
Tenant 내부 업무 대화 플랫폼이다.

## 설계 문서

| 문서                                                 | 내용                                       |
| ---------------------------------------------------- | ------------------------------------------ |
| [01-기획 정의.md](01-기획%20정의.md)                 | 사용자, 범위, 정보 구조, 기능 우선순위     |
| [02-화면 설계서.md](02-화면%20설계서.md)             | 메신저 홈, 대화, 검색, 반응형, 관리자 화면 |
| [03-디자인 정의.md](03-디자인%20정의.md)             | 시각·상호작용·접근성·컴포넌트 기준         |
| [04-데이터 설계.md](04-데이터%20설계.md)             | 원장, Table, Partition, 보존·Legal Hold    |
| [05-API 권한 계약.md](05-API%20권한%20계약.md)       | REST, WebSocket, Event, 권한·연동 계약     |
| [06-AI Agent 계약.md](06-AI%20Agent%20계약.md)       | 향후 AI Retrieval·Insight·Proposal 경계    |
| [07-수용 테스트.md](07-수용%20테스트.md)             | 기능·보안·성능·접근성 완료 기준            |
| [08-인프라 운영 설계.md](08-인프라%20운영%20설계.md) | 환경, 확장, 관측, DR, 단계별 구축          |

## 변경 불가 원칙

1. 성공 응답한 메시지는 먼저 영속화돼야 한다.
2. Space, People, Auth의 원장을 메시징 DB에 복제하지 않는다.
3. App/Admin 권한과 Conversation Membership 권한을 분리한다.
4. Kafka, Redis, OpenSearch는 메시지 원장이 아니다.
5. Messaging Admin은 사용자 본문을 열람할 수 없다.
6. AI는 사용자의 현재 권한을 확장하지 않고 업무를 자동 실행하지 않는다.
7. 메시지 수정·삭제, 보존, Hold, 검색 삭제는 하나의 수명주기 계약을 따른다.
8. 실제 Provider·Infra가 연결되지 않은 상태를 정상으로 표시하지 않는다.

## 단계별 제품 범위

| 단계   | 범위                                                          | 출시 Gate                    |
| ------ | ------------------------------------------------------------- | ---------------------------- |
| Wave 0 | 프로토콜·저장·Socket·검색·보안 Spike                          | Capacity와 Threat Model 승인 |
| Wave 1 | 내부 DM, 그룹, Space 채널, Thread, 검색, 파일, 기본 관리자    | 기능·보안·접근성 수용 테스트 |
| Wave 2 | Later, 예약, Action Capsule, Meeting Continuity, Bot/App      | 업무 원장별 권한 계약 승인   |
| Wave 3 | Legal Hold·eDiscovery 고도화, 외부 Tenant, Data Residency, AI | 법무·보안·운영 별도 승인     |

제품 코드는 이 설계와 선결정 사항을 사용자와 검토한 뒤 시작한다.
