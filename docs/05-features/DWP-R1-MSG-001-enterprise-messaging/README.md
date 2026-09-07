# DWP-R1-MSG-001 Enterprise Messaging

- 상태: R1 핵심 기능 구현 및 검증 중, 프로덕션 인프라 Gate 별도
- 기준일: 2026-09-04
- 제품명: `메신저` / `Messenger`
- Route: `/messages`
- App Resource: `APP.MESSAGING`
- Backend: `dwp-messaging-server` (REST, resumable SSE, PostgreSQL), LiveKit

## 제품 정의

DWP 메신저는 일반 채팅 복제품이 아니다. People에서 사람을 찾고, Space 멤버십을 상속하며,
Calendar 회의와 대화를 이어가고, 메시지에서 업무·결정·결재·서비스 요청을 안전하게 연결하는
Tenant 내부 업무 대화 플랫폼이다.

## 설계 문서

최신 홈·받은 대화 UI 구현과 검증 범위는
[Home and Inbox Refinement](11-home-inbox-refinement-2026-09-04.md)을 기준으로 확인합니다.
기존 구조 개편 기록은 [Workspace Redesign](09-workspace-redesign-2026-09-04.md)에 보존합니다.
초기 문서의 기술 후보와 현재 채택한 런타임을 구분하여 기록했습니다.

읽음 확인과 개인별 공개 설정의 최신 계약 및 검증은
[Read Receipts and Privacy](10-read-receipts-and-privacy-2026-09-04.md)를 참고합니다.

| 문서                                                             | 내용                                       |
| ---------------------------------------------------------------- | ------------------------------------------ |
| [00-벤치마크 및 결정 근거.md](00-벤치마크%20및%20결정%20근거.md) | 글로벌 제품 비교와 DWP 채택 결정           |
| [01-기획 정의.md](01-기획%20정의.md)                             | 사용자, 범위, 정보 구조, 기능 우선순위     |
| [02-화면 설계서.md](02-화면%20설계서.md)                         | 메신저 홈, 대화, 검색, 반응형, 관리자 화면 |
| [03-디자인 정의.md](03-디자인%20정의.md)                         | 시각·상호작용·접근성·컴포넌트 기준         |
| [04-데이터 설계.md](04-데이터%20설계.md)                         | 원장, Table, Partition, 보존·Legal Hold    |
| [05-API 권한 계약.md](05-API%20권한%20계약.md)                   | REST, WebSocket, Event, 권한·연동 계약     |
| [06-AI Agent 계약.md](06-AI%20Agent%20계약.md)                   | 향후 AI Retrieval·Insight·Proposal 경계    |
| [07-수용 테스트.md](07-수용%20테스트.md)                         | 기능·보안·성능·접근성 완료 기준            |
| [08-인프라 운영 설계.md](08-인프라%20운영%20설계.md)             | 환경, 확장, 관측, DR, 단계별 구축          |

## 변경 불가 원칙

1. 성공 응답한 메시지는 먼저 영속화돼야 한다.
2. Space, People, Auth의 원장을 메시징 DB에 복제하지 않는다.
3. App/Admin 권한과 Conversation Membership 권한을 분리한다.
4. Kafka, Redis, OpenSearch는 메시지 원장이 아니다.
5. Messaging Admin은 사용자 본문을 열람할 수 없다.
6. AI는 사용자의 현재 권한을 확장하지 않고 업무를 자동 실행하지 않는다.
7. 메시지 수정·삭제, 보존, Hold, 검색 삭제는 하나의 수명주기 계약을 따른다.
8. 실제 Provider·Infra가 연결되지 않은 상태를 정상으로 표시하지 않는다.

## 현재 구현 기준선

| 영역                   | 구현 상태 | 현재 계약                                                     |
| ---------------------- | --------- | ------------------------------------------------------------- |
| DM·그룹·채널           | 구현      | Tenant 및 활성 사용자 검증, 멱등 생성                         |
| 메시지 원장            | 구현      | 대화별 단조 `sequence`, 요청 지문 기반 멱등성, 충돌 `409`     |
| Thread·Reaction        | 구현      | 전용 Thread 조회·답글, 의미 있는 반응 메뉴                    |
| 수정·삭제·Later        | 구현      | 작성자·정책·낙관적 버전 검증, 저장 항목 전용 화면             |
| 읽음·실시간            | 구현      | 역행하지 않는 읽음 Cursor, durable event log, 재개 가능한 SSE |
| 검색                   | R1 구현   | SQL 기반 ACL 재검증 검색; OpenSearch는 규모 Gate 이후         |
| 회의                   | 구현      | Provider 추상화, LiveKit 사전 점검·참여·전체 종료             |
| 관리자                 | 구현      | 운영 지표와 Tenant 정책; 본문 열람 기능 없음                  |
| 파일·최근 공유         | 구현      | CLEAN 파일만 노출, 메시지·멤버십 재검증, 일회 다운로드 Grant  |
| Compliance 인프라      | 별도 Gate | 운영 Scanner·DLP·WORM 및 보존 정책 검증 필요                  |
| 전용 WebSocket Gateway | 보류      | 현재 SSE를 운영 계측하고 Presence·Typing 규모 Gate에서 결정   |

`구현`은 개발 환경의 기능·계약 테스트 기준이다. 다중 AZ, 부하, 장애 복구, TURN, TLS/WSS,
Object Scanner, OpenSearch, Legal Hold를 통과하기 전에는 프로덕션 완료로 표시하지 않는다.

## 단계별 제품 범위

| 단계   | 범위                                                          | 출시 Gate                    |
| ------ | ------------------------------------------------------------- | ---------------------------- |
| Wave 0 | 프로토콜·저장·Socket·검색·보안 Spike                          | Capacity와 Threat Model 승인 |
| Wave 1 | 내부 DM, 그룹, Space 채널, Thread, 검색, 파일, 기본 관리자    | 기능·보안·접근성 수용 테스트 |
| Wave 2 | Later, 예약, Action Capsule, Meeting Continuity, Bot/App      | 업무 원장별 권한 계약 승인   |
| Wave 3 | Legal Hold·eDiscovery 고도화, 외부 Tenant, Data Residency, AI | 법무·보안·운영 별도 승인     |

현재 제품 코드는 Wave 1 핵심 경로부터 구현한다. 미구현 항목은 화면에 가짜 성공 상태나 동작하지
않는 버튼으로 노출하지 않으며, 각 운영 Gate를 통과한 기능만 단계적으로 활성화한다.
