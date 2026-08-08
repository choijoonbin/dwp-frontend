# DWP R0 핵심 사용자 Journey 및 KPI

> 문서 상태: Validation Ready v1.0
>
> 기준일: 2026-08-08
>
> 적용 단계: R0 Product Discovery와 R1 Pilot
>
> 연계 문서: `프로젝트 개요.md`, `프로젝트로드맵.md`,
> `개인화 홈 및 앱 경험 기획.md`

## 1. 목적

R1의 화면과 메뉴를 만들기 전에 DWP가 줄여야 할 실제 업무 마찰과 측정 방법을
고정한다. 이 문서의 As-is 수치는 아직 고객 관찰 전 가설이며 제품 성과로 사용하지
않는다. 디자인 파트너의 업무 로그, 인터뷰와 관찰을 통해 Baseline을 채운 뒤 Target을
최종 승인한다.

## 2. 핵심 Persona와 JTBD

| ID  | Persona                 | 책임과 상황                             | JTBD                                                                 |
| --- | ----------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| P1  | 일반 직원·지식 근로자   | 여러 시스템에서 개인 업무와 정보를 처리 | 하루 업무를 시작할 때 놓친 일 없이 우선순위를 파악하고 바로 실행한다 |
| P2  | Manager·승인자          | 팀 업무, 요청과 위험 있는 결정을 승인   | 근거와 영향을 빠르게 이해하고 안전하게 승인·반려·위임한다            |
| P3  | HR·IT 서비스 담당자     | 반복 요청 처리, SLA와 예외를 관리       | 자동 해결 가능한 요청을 줄이고 예외·고위험 건에 집중한다             |
| P4  | 플랫폼·DWP 운영자       | 사용자, 권한, Connector와 Agent를 운영  | 변경의 영향과 이상을 추적하고 문제 기능을 즉시 제한·복구한다         |
| P5  | Security·Privacy·감사자 | 정책 승인, 조사, 규제 증적과 사고 대응  | 누가 어떤 근거와 권한으로 무엇을 수행했는지 재현한다                 |

### 2.1 공통 행동 원칙

- P1·P2에게는 업무 목적과 다음 행동을 먼저 보여주고 System 구조를 학습시키지 않는다.
- P3에게는 Queue, SLA, Batch·Exception 처리와 원본 System Link를 제공한다.
- P4·P5에게는 사용자용 화면보다 정책, Version, Trace와 감사 증거를 우선한다.
- AI가 판단을 보조해도 Source of Record, 정책 판정과 최종 상태는 결정적 시스템이
  소유한다.

## 3. Journey Portfolio

| Journey ID | 이름               | 주 Persona | R1 우선순위 | 검증 목적                                      |
| ---------- | ------------------ | ---------- | ----------- | ---------------------------------------------- |
| J1         | Start My Day       | P1·P2      | P0          | 업무 시작 탐색과 시스템 전환 감소              |
| J2         | Ask and Act        | P1·P2·P3   | P0          | 권한 기반 답변이 실제 후속 행동으로 이어지는지 |
| J3         | Employee Service   | P1·P3      | P0          | 서비스 탐색·신청·상태 확인의 처리시간 감소     |
| J4         | Meeting to Outcome | P1·P2      | P1          | 회의 결정과 Action의 누락·재입력 감소          |
| J5         | Legacy Task        | P1·P3      | P0 Enabler  | 기존 시스템을 교체하지 않고 전환 비용 감소     |

## 4. J1 Start My Day

### Outcome Contract

| 항목        | 정의                                                                  |
| ----------- | --------------------------------------------------------------------- |
| Trigger     | 사용자가 업무일 첫 접속 또는 명시적으로 Today를 연다                  |
| Start State | 메일·일정·업무·승인·공지 상태이 여러 System에 흩어져 있다             |
| End State   | 사용자가 우선 처리 항목을 이해하고 하나 이상의 유효 Action을 시작한다 |
| Failure     | 중요한 항목 누락, 중복·오래된 정보, 근거 없는 우선순위, 알림 과부하   |
| AI 역할     | 요약·분류·우선순위 후보와 추천 이유 제공                              |
| 사람 통제   | Pin·Hide·Reset, Source 확인, Action 선택과 외부 변경 전 승인          |

### 최소 흐름

1. 인증·Tenant·역할·사용자 선호를 적용한다.
2. 마감 업무, 승인, 일정, 중요 커뮤니케이션과 필수 공지를 통합한다.
3. 항목마다 Source, 최신 시각, 추천 이유와 예상 소요를 제공한다.
4. 사용자가 상세 확인, 완료, 위임, 일정화 또는 원본 System 이동을 선택한다.
5. 실행 결과를 Work Timeline과 Analytics Event에 남긴다.

### KPI

| ID    | 지표                     | 산식·측정                                               | 초기 Target          |
| ----- | ------------------------ | ------------------------------------------------------- | -------------------- |
| J1-K1 | Time to First Action     | 첫 접속부터 유효 업무 Action 시작까지 Median            | Baseline 대비 -40%   |
| J1-K2 | Systems Before Action    | 첫 Action 전 방문한 고유 System·화면 수 평균            | Baseline 대비 -30%   |
| J1-K3 | Brief Action Rate        | Brief 노출 Session 중 유효 Action을 시작한 Session 비율 | 50% 이상             |
| J1-K4 | Priority Correction Rate | 추천 순서를 사용자가 수정·숨김한 항목 / 추천 항목       | 추세 하락, 사유 분류 |
| J1-G1 | Critical Miss            | 당일 필수 승인·마감 항목이 Today에서 누락된 건          | 0건                  |

## 5. J2 Ask and Act

### Outcome Contract

| 항목        | 정의                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| Trigger     | 사용자가 정책, 문서, 사람, 업무 상태 또는 처리 방법을 질문한다            |
| Start State | 검색 위치·용어·소유자를 모르거나 여러 자료를 비교해야 한다                |
| End State   | 권한 내 근거로 답을 이해하고 유효한 다음 행동 또는 Abstention을 확인한다  |
| Failure     | 무권한 Source 노출, 출처 없는 답, 오래된 정책, 과도한 확신, 잘못된 Action |
| AI 역할     | Query 해석, Hybrid Retrieval, 근거 기반 요약과 Action 후보                |
| 사람 통제   | Source Preview, 답변 Feedback, 계획 검토와 L2 이상 Action 승인            |

### 최소 흐름

1. 사용자·Tenant·Group·업무 Context를 확인한다.
2. 원본 ACL을 적용해 Keyword·Vector 후보를 검색하고 Rerank한다.
3. 답변, Source·Version·최신성, 불확실성과 적용 범위를 함께 제시한다.
4. 답이 부족하면 추가 질문 또는 사람·담당 부서 Handoff를 제안한다.
5. 실행이 필요하면 결정적 Form 또는 Plan Preview로 전환한다.

### KPI

| ID    | 지표                    | 산식·측정                                            | 초기 Target           |
| ----- | ----------------------- | ---------------------------------------------------- | --------------------- |
| J2-K1 | Time to Verified Answer | 질문 시작부터 사용자가 Source를 확인한 답까지 Median | Baseline 대비 -50%    |
| J2-K2 | Grounded Accuracy       | 승인 Evaluation Set에서 근거가 지지하는 답변 비율    | 85% 이상              |
| J2-K3 | Citation Precision      | 제시한 Source 중 실제 Claim을 지지하는 Source 비율   | 90% 이상              |
| J2-K4 | Answer to Action        | 유효 답변 중 후속 업무·서비스로 연결된 비율          | Baseline 수집 후 승인 |
| J2-G1 | Unauthorized Exposure   | 권한 없는 문서 제목·Snippet·내용 노출                | 0건                   |
| J2-G2 | Correct Abstention      | 근거 부족·권한 없음 상황에서 답을 생성하지 않은 비율 | 95% 이상              |

## 6. J3 Employee Service

### Outcome Contract

| 항목        | 정의                                                                  |
| ----------- | --------------------------------------------------------------------- |
| Trigger     | 직원이 HR·IT·Workplace 도움, 신청 또는 문제 해결을 원한다             |
| Start State | 담당 부서·서비스명·양식·정책을 모르거나 여러 채널을 거친다            |
| End State   | Self-service 해결 또는 올바른 요청이 생성되고 상태·다음 책임자가 보임 |
| Failure     | 잘못된 분류, 중복 요청, 필수정보 누락, 상태 불명, SLA 초과            |
| AI 역할     | 의도·Category 후보, 지식 답변, Form Prefill과 요약                    |
| 사람 통제   | 제출 전 값 확인, 민감정보 고지, 담당자 수정과 사람 Handoff            |

### 최소 흐름

1. 자연어 또는 Catalog에서 서비스를 찾는다.
2. 정책과 사용자 Context로 Self-service, Form 또는 담당자 연결을 구분한다.
3. AI Prefill 값과 근거를 표시하고 필수 항목을 사용자가 확인한다.
4. System of Record에 요청을 생성하고 DWP Work Item과 연결한다.
5. 상태, SLA, 담당자, 추가 요청과 결과를 Timeline으로 동기화한다.

### KPI

| ID    | 지표                       | 산식·측정                                            | 초기 Target        |
| ----- | -------------------------- | ---------------------------------------------------- | ------------------ |
| J3-K1 | Time to Correct Submission | 시작부터 추가 재분류 없는 요청 제출까지 Median       | Baseline 대비 -40% |
| J3-K2 | Self-service Resolution    | 사람 티켓 없이 승인된 지식으로 해결된 대상 요청 비율 | 서비스별 승인      |
| J3-K3 | First-time-right           | 재분류·정보 보완 없이 처리 Queue에 진입한 요청 비율  | 85% 이상           |
| J3-K4 | Resolution Lead Time       | 요청 생성부터 완료까지 Median·P90                    | Baseline 대비 -30% |
| J3-G1 | Duplicate Request          | 동일 사용자·의도·기간의 중복 요청 비율               | Baseline 대비 -50% |

## 7. J4 Meeting to Outcome

### Outcome Contract

| 항목        | 정의                                                                 |
| ----------- | -------------------------------------------------------------------- |
| Trigger     | 일정 전 준비 또는 회의 종료 후 결정·후속 업무를 정리한다             |
| Start State | 관련 메일·문서·결정이 흩어지고 Action Owner·기한이 불명확하다        |
| End State   | 사람이 확인한 결정·Action이 Owner·기한·Source와 함께 업무에 반영된다 |
| Failure     | 동의 없는 녹취, 잘못된 결정 추출, 담당자 오인, 중복 업무 생성        |
| AI 역할     | 준비자료 요약, 결정·Action 후보 추출, 중복·충돌 탐지                 |
| 사람 통제   | 녹취·처리 동의, 후보 확인·수정, 외부 공유와 업무 생성 승인           |

### KPI

| ID    | 지표                | 산식·측정                                            | 초기 Target        |
| ----- | ------------------- | ---------------------------------------------------- | ------------------ |
| J4-K1 | Action Capture Time | 회의 종료부터 확인된 Action 등록까지 Median          | Baseline 대비 -50% |
| J4-K2 | Action Completeness | 표본 회의의 실제 Action 중 Owner·기한 포함 등록 비율 | 90% 이상           |
| J4-K3 | Duplicate Entry     | 이미 존재하는 업무를 중복 생성한 비율                | 2% 미만            |
| J4-G1 | Consent Violation   | 동의·정책 없는 녹취·요약 처리                        | 0건                |

J4는 R1 P1 범위다. J1~J3의 데이터·권한·업무 연결이 안정되기 전에 자체 회의 미디어
기능을 만들지 않는다.

## 8. J5 Legacy Task

### Outcome Contract

| 항목        | 정의                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| Trigger     | 사용자가 기존 시스템의 화면 또는 저위험 Action을 찾아야 한다              |
| Start State | 시스템명·메뉴 경로·권한·입력 규칙을 기억하거나 여러 번 재인증한다         |
| End State   | 올바른 System Context로 이동하거나 승인된 Action 결과가 Timeline에 남는다 |
| Failure     | 잘못된 Tenant·대상 이동, 권한 우회, 세션 고착, RPA 화면 변경              |
| AI 역할     | App·Action 후보와 필요한 정보 안내                                        |
| 사람 통제   | Target 확인, L2 이상 Plan 승인, 원본 System Link와 결과 확인              |

### KPI

| ID    | 지표                | 산식·측정                                          | 초기 Target        |
| ----- | ------------------- | -------------------------------------------------- | ------------------ |
| J5-K1 | Time to Target      | 의도 표현부터 올바른 Legacy 화면·Action까지 Median | Baseline 대비 -40% |
| J5-K2 | Navigation Steps    | 목표 도달 전 Click·화면 전환 수                    | Baseline 대비 -30% |
| J5-K3 | Action Success      | 승인된 Connector Action 중 업무적으로 완료된 비율  | 95% 이상           |
| J5-G1 | Unauthorized Action | 현재 사용자·Agent Scope를 벗어난 실행              | 0건                |
| J5-G2 | Untracked Change    | Audit·원본 ID가 없는 외부 시스템 변경              | 0건                |

## 9. Baseline 수집 프로토콜

### 9.1 표본

- P1 직원 12명 이상: 부서·직급·숙련도 분산
- P2 Manager·승인자 5명 이상
- P3 HR 또는 IT 서비스 담당자 5명 이상
- P4·P5 운영·보안·감사 각 2명 이상
- 최소 10영업일, Journey별 정상·예외 표본 30건 이상

작은 Pilot에서는 통계적 유의성을 과장하지 않고 Median, P90, 분포와 정성 사유를 함께
본다. 개인 성과평가 목적으로 원시 행동 데이터를 사용하지 않는다.

### 9.2 수집 방법

1. System Log에서 시작·완료 Timestamp, 상태와 System 전환을 비식별 집계한다.
2. Contextual Inquiry로 화면·검색·재입력·대기와 우회 채널을 관찰한다.
3. Diary Study로 놓친 업무, 신뢰 문제와 예외를 10영업일 기록한다.
4. 서비스 담당자에게 재분류·보완·중복·SLA 원인을 분류하게 한다.
5. Security·Privacy가 수집 항목, 보존기간과 접근자를 승인한다.

### 9.3 Baseline Worksheet

| Journey | Metric ID | 정의·단위 | 기간 | 표본 수 | Median | P90 | Data Source | Owner | 승인 |
| ------- | --------- | --------- | ---- | ------- | ------ | --- | ----------- | ----- | ---- |
| J1      | J1-K1     | 분        | TBD  | TBD     | TBD    | TBD | TBD         | TBD   | TBD  |
| J2      | J2-K1     | 분        | TBD  | TBD     | TBD    | TBD | TBD         | TBD   | TBD  |
| J3      | J3-K1     | 분        | TBD  | TBD     | TBD    | TBD | TBD         | TBD   | TBD  |
| J4      | J4-K1     | 분        | TBD  | TBD     | TBD    | TBD | TBD         | TBD   | TBD  |
| J5      | J5-K1     | 분        | TBD  | TBD     | TBD    | TBD | TBD         | TBD   | TBD  |

## 10. 공통 Analytics Event 계약

| Event                          | Trigger                      | 필수 Property                                                      |
| ------------------------------ | ---------------------------- | ------------------------------------------------------------------ |
| `journey_started`              | 정의된 Trigger 진입          | journeyId, entryPoint, tenantId, roleClass, correlationId          |
| `source_opened`                | Source·원본 System 확인      | journeyId, sourceType, sourceIdHash, version, permissionDecisionId |
| `recommendation_acted`         | 추천 Action 선택             | journeyId, recommendationType, reasonCode, rank, actionType        |
| `recommendation_dismissed`     | 숨김·거부·순서 변경          | journeyId, reasonCode, reversible                                  |
| `plan_reviewed`                | Agent Plan 확인              | runId, planHash, riskTier, toolCount, sourceCount                  |
| `approval_decided`             | 승인·반려·수정               | runId, decision, reasonCode, approverRole, latencyBucket           |
| `journey_completed`            | End State 도달               | journeyId, outcomeType, durationBucket, systemCount, handoffCount  |
| `journey_abandoned`            | Timeout·명시적 종료          | journeyId, lastStep, reasonCode, durationBucket                    |
| `security_guardrail_triggered` | 권한·정책·민감정보 통제 발동 | journeyId, controlType, riskTier, blocked, policyVersion           |

- 사용자 이름, 메일 본문, 질문 원문, 문서 제목과 Tool Argument를 기본 Analytics에
  저장하지 않는다.
- ID는 운영 Trace와 분리한 비식별·회전 가능한 값으로 사용한다.
- 자유 입력 사유는 제한된 Code와 별도 Research 동의 절차로 수집한다.

## 11. KPI 판정 규칙

- 평균만 사용하지 않고 Median, P90과 실패 분포를 함께 본다.
- Adoption 상승만으로 성공 판정하지 않고 Journey 완료와 시간 절감을 연결한다.
- AI KPI는 Offline Evaluation과 실제 업무 Outcome을 분리한다.
- Target 달성을 위해 Guardrail을 희생할 수 없다. 무권한 노출·무승인 고위험 실행·
  중대한 개인정보 사고가 1건이라도 발생하면 해당 Release를 중단하고 조사한다.
- 절감 시간은 중복 계산하지 않고 Journey별 Baseline과 동일한 시작·종료 정의를 쓴다.

## 12. Validation Gate

- [ ] 디자인 파트너의 P1~P5 대표 역할과 실제 사용자가 Mapping됨
- [ ] J1~J3 P0 Journey의 As-is 관찰과 Baseline 표본이 채워짐
- [ ] 각 System of Record, Data Owner와 원본 권한 모델이 확인됨
- [ ] Target, Guardrail, Analytics 수집과 보존 정책이 승인됨
- [ ] Pilot 사용자에게 개인 성과평가 목적이 아님을 고지함
- [ ] Product·Domain·Security·Privacy가 R1 우선 Journey를 승인함

이 Gate 전에는 Baseline의 `TBD`를 임의 수치로 채우거나 제품 성과를 예측값으로
발표하지 않는다.
