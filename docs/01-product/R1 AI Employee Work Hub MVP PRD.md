# R1 DWP AI Employee Work Hub MVP PRD

> 문서 상태: Validation Ready v1.0
>
> 기준일: 2026-08-08
>
> 목표 Release: R1
>
> 연계 문서: `프로젝트 개요.md`, `프로젝트로드맵.md`,
> `R0 핵심 사용자 Journey 및 KPI.md`, `개인화 홈 및 앱 경험 기획.md`

## 1. Product Summary

DWP AI Employee Work Hub는 직원이 여러 시스템을 순회하지 않고 오늘 해야 할 일을
파악하고, 권한 내 정보를 근거와 함께 찾고, HR·IT 서비스를 요청하며, 허용된 기존
시스템 Action을 통제된 방식으로 수행하게 하는 공통 업무 진입점이다.

R1은 완성된 Digital Workplace Suite가 아니다. 한 디자인 파트너의 제한된 사용자와
실제 시스템에서 세 개의 End-to-end Journey가 측정 가능한 가치를 만드는지 검증하는
Pilot Release다.

## 2. Problem Statement

목표 조직의 직원은 메일, 일정, 업무, 승인, 지식, HR·IT Portal과 Legacy 시스템을
오가며 다음 문제를 겪는다는 가설을 검증한다.

- 업무 시작 전에 여러 시스템과 알림을 확인해야 하며 우선순위 근거가 불명확하다.
- 사내 정보의 위치와 용어를 몰라 검색·질문·사람 문의를 반복한다.
- 서비스 이름과 담당 부서를 몰라 잘못된 양식, 재분류와 정보 보완이 발생한다.
- 기존 시스템 메뉴와 입력 규칙을 기억해야 하고 결과가 개인 업무 맥락과 분리된다.
- 일반 AI Chat은 원본 권한, 출처, 최신성, 승인과 실행 결과를 충분히 설명하지 못한다.

## 3. Objective와 North Star

### Objective

R1 Pilot 종료 시 J1~J3의 탐색·제출 시간을 줄이고, AI와 Connector의 모든 실행이
정책·승인·감사 계약 안에서 재현 가능함을 증명한다.

### North Star

**Governed Work Outcomes per Weekly Active User**

정책과 권한을 준수하고 필요한 승인을 거쳐 감사 가능한 상태로 완료된 유효 업무
결과를 사용자당 절감 시간과 함께 측정한다.

## 4. Target과 범위

### 4.1 목표 사용자

- P1 일반 직원·지식 근로자
- P2 Manager·승인자
- P3 HR 또는 IT 서비스 담당자
- P4 DWP·Connector·Agent 운영자
- P5 Security·Privacy·감사자는 사용자 기능보다 승인·증적 검토자로 참여한다.

### 4.2 R1 P0 Journey

| Journey | R1 범위                                                     | 완료 상태                                          |
| ------- | ----------------------------------------------------------- | -------------------------------------------------- |
| J1      | Today Brief, My Work, 승인·일정·중요 항목과 추천 이유       | 사용자가 유효 Action을 시작하거나 완료             |
| J2      | 권한 기반 지식 검색·질의, Citation과 Service·Action 연결    | 검증된 답, Abstention 또는 통제된 후속 행동        |
| J3      | HR 또는 IT 상위 5~10개 서비스 탐색·신청·상태 Timeline       | 올바른 요청 생성 또는 승인된 Self-service 해결     |
| J5      | 권한 기반 App 검색, SSO·Deep Link와 저위험 Connector Action | 올바른 Legacy Context 도달 또는 감사된 Action 완료 |

J4 Meeting to Outcome은 R1 P1 Discovery만 수행하고 Product Scope에는 포함하지 않는다.

## 5. Product Modules

### 5.1 Home

Home은 `Assigned Apps -> Today`의 통합 정보 계층을 제공하고 `/apps`는 전체 App
Catalog를 담당한다.

#### Home과 Today

- Entitlement가 있는 App을 목적 그룹으로 표시하고 그룹 내 Reorder·Folder를 지원
- 마감·영향도·사용자 선호에 따른 우선 업무 목록
- 중요 일정·승인·서비스 요청·필수 공지의 통합 상태
- Daily Brief와 각 추천의 이유·Source·최신 시각
- Pin, Hide, Reorder와 Personalization Reset
- 상세·완료·위임·일정화·원본 이동 등 제한된 Quick Action

#### Apps Catalog

- Entitlement가 있는 Native·Legacy·SaaS App만 표시
- 검색, Category, 최근 사용과 Pin
- SSO·Deep Link 또는 승인된 Connector Action
- App Owner, 상태, 데이터 분류와 장애 공지

자유 배치 Widget Canvas를 기본 경험으로 제공하지 않는다.

### 5.2 Work

- 내 업무, 요청, 승인과 Agent 실행을 하나의 Queue에서 조회
- 상태, 담당자, 기한, Source System과 위험 표시
- Filter, Sort, Saved View 후보와 Desktop Data Grid
- Mobile은 승인·상태 확인·핵심 Action을 우선
- 상세 Timeline에 사람·Workflow·Connector·Agent Event 통합

R1은 DWP가 연결한 업무만 표시한다. 범용 Project Management 기능을 만들지 않는다.

### 5.3 Ask

- 자연어·Keyword 질의와 Scope 선택
- 원본 ACL을 보존한 Hybrid Search
- Answer, Citation, Source Preview, Version·최신성·적용 범위
- 근거 부족·권한 없음·충돌 시 명시적 Abstention
- Feedback, 담당자 Handoff와 Service·Action 추천
- L2 이상 Action은 Plan Preview와 사용자 승인

질문 원문과 답변은 기본적으로 모델 학습에 사용하지 않는다.

### 5.4 Services

- 디자인 파트너가 선정한 HR 또는 IT 서비스 5~10개
- 자연어와 Catalog 탐색, 대상·자격·정책·예상 처리시간
- Self-service 지식, 결정적 Form과 AI Prefill
- 제출 전 변경값·민감정보·원본 System 확인
- 요청 ID, 상태, SLA, 담당자, 추가 정보와 결과 Timeline

급여 계산, 평가, 근태, ITSM Ticket 원장은 기존 System of Record가 유지한다.

### 5.5 Agent Trust Surface

- AI 사용과 생성·검색·실행 상태 표시
- Source와 Citation
- Agent·Prompt·Tool Version과 Audit ID 연결
- Plan Preview, 변경 대상, Risk Tier와 승인 조건
- 실행 Step, Partial Result, Failure, Stop·Retry와 Handoff
- 원본 System 결과 Link

R1은 Assistant Agent와 제한된 Delegated Agent만 운영한다. Process·Autonomous Agent는
R3 범위다.

### 5.6 Admin Minimum

- App·Connector·Agent Registry의 읽기와 상태 확인
- Feature Flag와 Kill Switch
- 감사 검색과 실행 Trace 연결
- Model·Tool Allowlist, Risk Tier와 Budget 정책 확인

범용 Agent Studio, Connector Builder와 복잡한 Policy Designer는 포함하지 않는다.

## 6. Functional Requirements

### 6.1 Identity와 Entitlement

| ID     | 요구사항                                                     | 우선순위 |
| ------ | ------------------------------------------------------------ | -------- |
| FR-001 | OIDC 또는 SAML SSO와 HttpOnly Browser Session을 사용         | P0       |
| FR-002 | Tenant·조직·역할·그룹과 원본 System Entitlement를 적용       | P0       |
| FR-003 | 사용자·Service·Agent Identity와 Credential을 분리            | P0       |
| FR-004 | Session 만료·폐기·Idle·기기 목록과 강제 로그아웃을 지원      | P0       |
| FR-005 | 역할·권한 변경이 활성 Session·검색·Tool 실행에 전파되어야 함 | P0       |

### 6.2 Home·Work

| ID     | 요구사항                                                           | 우선순위 |
| ------ | ------------------------------------------------------------------ | -------- |
| FR-101 | Today 항목은 Source ID, 상태, 기한, 최신 시각과 추천 이유를 가진다 | P0       |
| FR-102 | 사용자는 허용 범위에서 Pin·Hide·Reorder·Reset할 수 있다            | P0       |
| FR-103 | 필수·보안 항목은 숨김을 제한하고 이유를 표시한다                   | P0       |
| FR-104 | Work Queue는 Filter·Sort·Select·Pagination과 Keyboard 탐색을 제공  | P0       |
| FR-105 | Timeline은 중복 Event를 멱등하게 병합하고 원본 Link를 보존한다     | P0       |
| FR-106 | Offline·Stale·Partial 상태를 정상 Empty와 구분한다                 | P0       |

### 6.3 Ask·Knowledge

| ID     | 요구사항                                                                    | 우선순위 |
| ------ | --------------------------------------------------------------------------- | -------- |
| FR-201 | 검색 전과 결과 반환 시 현재 ACL을 적용한다                                  | P0       |
| FR-202 | Answer Claim은 Citation과 Source Version을 연결한다                         | P0       |
| FR-203 | Source 삭제·권한 변경이 Index와 Cache에 정의된 SLO 안에 반영된다            | P0       |
| FR-204 | 근거가 부족하거나 충돌하면 답을 생성하지 않고 다음 방법을 제시한다          | P0       |
| FR-205 | Feedback은 Answer·Source·Model·Prompt Version과 연결하되 원문 수집을 최소화 | P1       |

### 6.4 Service·Action

| ID     | 요구사항                                                                 | 우선순위 |
| ------ | ------------------------------------------------------------------------ | -------- |
| FR-301 | Form은 Schema Version, Validation, Eligibility와 Server Error를 표현한다 | P0       |
| FR-302 | AI Prefill 값은 사용자 입력과 구분하고 근거·수정 가능성을 제공           | P0       |
| FR-303 | 제출·Action은 Idempotency Key와 원본 System ID를 가진다                  | P0       |
| FR-304 | L2 이상 Action은 Plan Hash에 묶인 만료 가능한 승인을 요구한다            | P0       |
| FR-305 | 실패 시 Retry 가능성, 부분 완료, 보상과 사람 Handoff를 구분한다          | P0       |

## 7. Connector Scope

R1은 다음 네 범주에서 디자인 파트너 표준 제품 하나씩만 선택한다.

| 범주             | 후보                                   | R1 최소 Capability                          |
| ---------------- | -------------------------------------- | ------------------------------------------- |
| Productivity     | Microsoft 365 또는 Google Workspace    | 일정·중요 메일 Metadata, Deep Link          |
| Knowledge        | SharePoint, Google Drive 또는 고객 ECM | 문서·ACL·Version·삭제 동기화                |
| System of Record | HRIS 또는 ITSM                         | 서비스 조회·요청 생성·상태                  |
| Legacy           | 고객 시스템 1개                        | SSO·Deep Link 또는 승인된 저위험 Action 1개 |

연결 순서는 `표준 API -> Event/Webhook -> MCP Tool -> Embedded UI -> RPA`다. RPA는
P0 성공 조건이 아니며 API가 없는 경우 별도 위험 승인을 요구한다.

## 8. AI와 Risk Scope

### 8.1 포함

- 메일·일정·문서의 권한 기반 요약
- Daily Brief와 Action Item 후보
- 사내 지식 답변과 Citation
- Service 분류·Form Prefill
- L0·L1 자동 처리와 L2 Plan Preview·승인

### 8.2 제외

- L3·L4 권한·급여·금전·삭제의 자동 실행
- Agent가 임의 Tool이나 Credential을 추가하는 기능
- 사용자 동의 없는 장기 Memory
- 고객 데이터를 기본 학습 데이터로 사용하는 기능
- 다중 Agent 자율 협상과 외부 A2A 실행

### 8.3 Evaluation

| 영역           | 최소 Dataset                                            | Gate                              |
| -------------- | ------------------------------------------------------- | --------------------------------- |
| Retrieval      | 권한·삭제·중복·한국어·영어 Query                        | 무권한 노출 0, Recall Target 승인 |
| Answer         | 근거 충분·부족·충돌·오래된 문서                         | Grounded Accuracy 85% 이상        |
| Classification | HR·IT Intent와 Out-of-scope                             | Macro F1 Target 서비스별 승인     |
| Tool           | 정상·Timeout·중복·권한 변경·부분 실패                   | 잘못된 중요 실행 0                |
| Safety         | Prompt Injection·Data Exfiltration·Privilege Escalation | 중요 통제 우회 0                  |

## 9. Data와 Privacy

- DWP는 업무 Context·실행·감사 Metadata를 소유하고 원본 콘텐츠는 가능한 Source에 둔다.
- 메일 본문·첨부·회의 콘텐츠는 목적별 최소 범위와 짧은 보존을 적용한다.
- Knowledge Chunk는 Source ID·Version·ACL·보존·삭제 상태를 가진다.
- Prompt, Retrieval, Tool Argument와 Output의 원문 Trace는 기본 비활성화하고 승인된
  Redaction·Sampling 정책을 적용한다.
- Analytics는 개인 성과평가에 사용하지 않고 비식별·집계 기준을 사용한다.
- 고객 데이터의 모델 학습 사용 기본값은 `사용 안 함`이다.

실제 Table과 Migration은 각 Feature의 데이터 설계와 Source Owner 승인 후 추가한다.
이 PRD만으로 업무 Table이나 Vector Extension을 생성하지 않는다.

## 10. Experience Requirements

- Desktop Power User와 Mobile Approver를 모두 지원한다.
- WCAG 2.2 AA, Keyboard, Focus Not Obscured, Screen Reader와 200% Zoom을 Gate로 둔다.
- Light·Dark·High Contrast, Compact·Standard·Comfortable Density를 지원한다.
- 한국어·영어, Timezone, 긴 이름·문장·금액·날짜를 검증한다.
- Empty, Loading, Partial, Error, Offline, Denied와 Stale 상태를 구분한다.
- AI 결과는 Chat Bubble만으로 표현하지 않고 Source, Plan, Risk와 Timeline을 구조화한다.
- Tenant Font·Accent·Navigation 기능은 관리 정책에 유지하고 일반 사용자에게 임의
  변경을 허용하지 않는다.

## 11. Analytics Plan

공통 Event는 `R0 핵심 사용자 Journey 및 KPI.md`의 계약을 사용한다.

### Funnel

1. `journey_started`
2. Source·추천·검색·Service 선택
3. Plan·Form Review
4. 승인·제출·Action
5. `journey_completed` 또는 `journey_abandoned`

### Dashboard

- Journey별 사용자 수가 아니라 완료율, Median·P90 시간과 System 전환
- 추천 수가 아니라 추천 후 유효 Action과 수정·거부 사유
- 답변 수가 아니라 Citation·Grounded Accuracy와 Abstention
- Agent 실행 수가 아니라 Task Success, 사람 수정·거부와 성공 결과당 비용
- Guardrail: 무권한 노출, 무승인 실행, 감사 누락과 개인정보 사고

## 12. Non-goals

- 메일 서버, 범용 Messenger, 화상회의 미디어와 문서 편집기
- ERP, CRM, HRIS, ITSM, Project Management 원장
- 전 산업 기능과 통신·반도체 전용 메뉴
- 자유 배치 Widget Marketplace와 저코드 Page Builder
- 범용 Agent Studio, Multi-agent Marketplace와 완전 자율 Agent
- 모든 Connector와 모든 HR·IT 서비스를 첫 Release에 제공
- Native Mobile App과 Offline Transaction
- 고위험 Closed-loop 업무 실행

## 13. Delivery Plan

| 구간             | 권장 기간 | 종료 증거                                                            |
| ---------------- | --------- | -------------------------------------------------------------------- |
| Discovery        | 2주       | 디자인 파트너, J1~J3 Baseline, System·Data·Security Owner            |
| Contract Spike   | 2주       | SSO, Connector Read, ACL Search, 요청 Create, Audit Trace            |
| Alpha            | 4주       | Today·Work·Ask·Service E2E, Evaluation과 내부 10~20명                |
| Controlled Pilot | 6주 이상  | 목표 사용자 50~100명, KPI Dashboard, 주간 Feedback와 Incident Review |

Calendar보다 Gate를 우선한다. Discovery와 Contract Spike가 실패하면 UI 범위를 늘리지
않고 Connector·권한·데이터 계약을 먼저 수정한다.

## 14. R1 Release Gate

- J1~J3 Baseline과 Target이 디자인 파트너 Data Owner에게 승인됨
- 목표 사용자 50~100명과 6주 이상 Pilot 운영
- 정보 탐색·업무 시작시간 40% 이상 단축 또는 합의된 동등 지표 달성
- 주간 활성률 60% 이상을 4주 유지하되 Journey Outcome과 함께 충족
- Grounded Answer 85% 이상, Citation Coverage·Abstention Target 충족
- Connector·Agent 실행 Audit Coverage 100%
- 잘못된 중요 실행, 무승인 L2+ 실행과 무권한 정보 노출 0건
- P0 Journey의 WCAG 자동·수동 Gate, SLO와 운영 Runbook 통과
- 사용자·서비스 담당자의 반복 사용 의사와 경제적 구매자의 확장 결정 확보

## 15. Open Decisions

| ID  | 결정                                          | 필요한 입력                              | Owner 후보       |
| --- | --------------------------------------------- | ---------------------------------------- | ---------------- |
| OD1 | Microsoft 365 또는 Google Workspace           | 디자인 파트너 표준, API·보안·라이선스    | Product·Platform |
| OD2 | HR 또는 IT 첫 Service Pack                    | 빈도, 처리시간, Data Owner와 API         | Product·Domain   |
| OD3 | Knowledge Source와 검색 저장소                | 데이터량, ACL, 삭제 SLO와 평가 Dataset   | Architecture     |
| OD4 | Workflow Engine                               | 승인·Timer Journey, 운영 TCO와 License   | Architecture     |
| OD5 | 첫 Model Provider와 배포 Region               | Data Class, Residency, 품질·비용         | AI·Security      |
| OD6 | Pilot 배포 모델                               | SaaS, Single Tenant, Private·Hybrid 요구 | Platform·Sales   |
| OD7 | 최종 Brand, Self-host Font와 Tenant 허용 범위 | Brand Owner, CJK 품질·성능·License       | Design·Legal     |

## 16. 승인 Gate

- [ ] 디자인 파트너의 문제·Baseline과 P0 Journey가 확인됨
- [ ] Product·Domain Owner가 Scope와 Non-goal을 승인함
- [ ] Architecture·Security가 Connector·Search·Workflow·Model 경계를 승인함
- [ ] Privacy가 데이터 처리·보존·Analytics와 학습 금지를 승인함
- [ ] Design이 IA·Reference Flow와 접근성 기준을 승인함
- [ ] Delivery가 Pilot 인력·기간·지원·중단 조건을 승인함

승인 전 상태는 `Validation Ready`이며 구현 확정이 아니다. R1 메뉴와 Table을 임의로
늘리지 않고 승인된 P0 Journey의 Feature Package부터 Build Ready Gate로 이동한다.
