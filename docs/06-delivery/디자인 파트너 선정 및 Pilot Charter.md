# DWP 디자인 파트너 선정 및 Pilot Charter

> 문서 상태: Execution Ready v1.0
>
> 기준일: 2026-08-08
>
> 적용 단계: R0 Partner Selection과 R1 Controlled Pilot
>
> 연계 문서: `../01-product/R0 핵심 사용자 Journey 및 KPI.md`,
> `../01-product/R1 AI Employee Work Hub MVP PRD.md`

## 1. 목적

첫 디자인 파트너는 매출 가능성만 보는 고객도, 요구사항을 전달하는 외주 발주처도
아니다. DWP의 공통 Journey, 제품 계약, 보안과 운영 모델을 실제 사용자·시스템·데이터로
함께 검증하고 측정 가능한 결과를 만드는 공동 개발 파트너다.

산업은 2순위다. 통신·반도체 기업도 후보가 될 수 있지만 첫 Pilot에서는 산업별
Closed-loop 업무보다 J1 Start My Day, J2 Ask and Act, J3 Employee Service와 J5
Legacy Task의 수평적 가치를 검증한다.

## 2. 필수 진입 조건

다음 중 하나라도 충족하지 못하면 점수와 관계없이 디자인 파트너로 선정하지 않는다.

- 경제적 Sponsor와 업무 Sponsor가 각각 지정된다.
- Product, HR 또는 IT, Security·Privacy, Platform 담당자가 주간 의사결정에 참여한다.
- 50~100명의 제한 Pilot 사용자와 10영업일 이상 Baseline 측정이 가능하다.
- Microsoft 365 또는 Google Workspace 중 하나를 사용한다.
- HRIS 또는 ITSM 중 하나와 Knowledge Source 하나가 있다.
- API·SSO가 가능한 Legacy 시스템 또는 저위험 Action 하나가 있다.
- 사용자·그룹·Source ACL, 삭제와 감사 계약을 검증할 수 있다.
- 비식별 업무 로그, 샘플 데이터와 평가 Dataset을 합법적으로 제공할 수 있다.
- 8~12주 유료 Pilot과 성공 시 확장 검토 의지가 있다.
- R1에서 금전·권한·급여·생산·네트워크 Closed-loop 자동화를 요구하지 않는다.

## 3. 100점 선정 Scorecard

| 영역                    | 배점 | 높은 점수의 증거                                                     |
| ----------------------- | ---- | -------------------------------------------------------------------- |
| 문제 강도·빈도          | 15   | J1~J3 반복량, 탐색·처리시간, 재작업·SLA 비용이 로그로 확인됨         |
| Baseline·Outcome 측정   | 15   | 시작·종료·오류 정의와 10영업일 이상 원시 데이터·Owner가 있음         |
| Connector·데이터 준비   | 15   | API, Sandbox, SSO, ACL, Webhook, Test 계정과 문서가 준비됨           |
| Sponsor·의사결정 속도   | 10   | 경제적·업무 Sponsor가 범위·우선순위 충돌을 5영업일 안에 결정         |
| 사용자 공동설계 참여    | 10   | P1~P5 사용자, 주간 Interview·Prototype Test와 Feedback 약속          |
| Security·Privacy 실행력 | 10   | Data Map, Threat Review, DPA·보존·국외 이전 결정을 일정 안에 수행    |
| 수평 재사용성           | 10   | 고객 고유 화면보다 다른 산업에도 반복되는 Journey와 표준 System 사용 |
| 운영·AI Governance      | 5    | Incident, Audit, Model·Tool 승인, Kill Switch와 운영 Owner가 있음    |
| 상업적 의지             | 5    | 유료 Pilot 예산, 확장 의사결정자, 성공 시 사용자·System 확대 기준    |
| 전략 산업 적합성        | 5    | 통신·반도체 후속 Pack에 실제 Data·Domain Owner와 재사용 기회         |

### 판정

- `80점 이상`: 우선 디자인 파트너 후보
- `70~79점`: 보완 조건과 기한을 둔 예비 후보
- `70점 미만`: Research Interview는 가능하나 Pilot 후보에서 제외
- 필수 진입 조건 실패: 점수와 무관하게 제외

전략 산업 적합성은 5점뿐이다. 산업 이름이 다른 필수 조건과 측정 가능성을 대신할 수
없다.

## 4. Scorecard Worksheet

| 항목                    | 배점 | 후보 A | 후보 B | 근거 Link·Owner | 보완 기한 |
| ----------------------- | ---- | ------ | ------ | --------------- | --------- |
| 필수 진입 조건          | Pass | TBD    | TBD    | TBD             | TBD       |
| 문제 강도·빈도          | 15   | TBD    | TBD    | TBD             | TBD       |
| Baseline·Outcome 측정   | 15   | TBD    | TBD    | TBD             | TBD       |
| Connector·데이터 준비   | 15   | TBD    | TBD    | TBD             | TBD       |
| Sponsor·의사결정 속도   | 10   | TBD    | TBD    | TBD             | TBD       |
| 사용자 공동설계 참여    | 10   | TBD    | TBD    | TBD             | TBD       |
| Security·Privacy 실행력 | 10   | TBD    | TBD    | TBD             | TBD       |
| 수평 재사용성           | 10   | TBD    | TBD    | TBD             | TBD       |
| 운영·AI Governance      | 5    | TBD    | TBD    | TBD             | TBD       |
| 상업적 의지             | 5    | TBD    | TBD    | TBD             | TBD       |
| 전략 산업 적합성        | 5    | TBD    | TBD    | TBD             | TBD       |
| 총점                    | 100  | TBD    | TBD    |                 |           |

모든 점수는 인터뷰 발언이 아니라 로그, System 문서, 참석자·예산 승인과 같은 증거를
Link한다. 근거가 없으면 0점 또는 `미검증`으로 기록한다.

## 5. 선정 Process

### Stage 0. 후보 발굴

- ICP 적합 조직 5~8곳 Longlist
- 경제적 Sponsor, 업무 Sponsor와 기술 Contact 확인
- NDA와 Research 목적·데이터 경계 합의

### Stage 1. Evidence Interview

- 후보 3~5곳
- 역할별 Interview, Workflow Walkthrough와 System Inventory
- 최근 실제 사례 3건 이상을 사용하고 일반적 의견만 수집하지 않음
- Scorecard와 필수 조건 1차 판정

### Stage 2. Technical and Trust Workshop

- 상위 2곳
- SSO·조직, Productivity, Knowledge, HRIS·ITSM, Legacy API·Event 검토
- ACL, 삭제·보존, Data Residency, Incident와 감사 Workshop
- Sandbox 또는 최소 Contract Spike 가능성 검증

### Stage 3. Pilot Design

- 우선 후보 1곳과 예비 후보 1곳
- J1~J3 중 2~3개 P0 Journey, 사용자와 System 확정
- Baseline, Target, Guardrail, 운영·지원과 중단 조건 합의
- 유료 Pilot 계약과 Data Processing 문서 체결

### Stage 4. Selection Review

- Product, Architecture, Security, Delivery와 Commercial 공동 판정
- 최고 점수가 아니라 증거 품질, 해결 가능한 위험과 제품 재사용성을 검토
- Decision Record에 채택·기각 이유와 보완 조건 기록

## 6. Interview Plan

### 6.1 권장 일정과 표본

| Day | 활동                          | 참여자                          | 산출물                   |
| --- | ----------------------------- | ------------------------------- | ------------------------ |
| 1   | Sponsor·목표·사업성과         | 경제적·업무 Sponsor             | Outcome·예산·결정 구조   |
| 2~3 | J1·J2 Contextual Inquiry      | P1 직원 6~8명, P2 2~3명         | As-is Map·시간·우회      |
| 4   | J3 Service Walkthrough        | P1 3명, P3 담당자 3명           | 요청량·재분류·SLA        |
| 5   | J5 Legacy·System Inventory    | P1·P3·Platform                  | App·SSO·API·Action 목록  |
| 6   | Identity·ACL·Data Lifecycle   | IAM·Security·Privacy·Data Owner | Trust Boundary·Data Map  |
| 7   | Agent·Audit·Incident          | Security·Audit·Operations       | Risk·승인·증적 요구      |
| 8   | Baseline Data Review          | Product Analytics·System Owner  | Metric Dictionary·표본   |
| 9   | Reference Flow Prototype Test | P1~P3 8명 이상                  | Task 결과·오류·신뢰 이슈 |
| 10  | Scorecard·Pilot Scope Review  | 전 Owner                        | 선정안·Open Risk·Charter |

### 6.2 직원·승인자 질문

- 최근 업무일에 처음 확인한 시스템과 순서를 실제 화면으로 보여 달라.
- 놓쳤거나 늦게 발견한 업무의 최근 사례와 영향은 무엇인가.
- 답을 찾지 못해 사람에게 물은 최근 질문은 무엇이며 몇 단계를 거쳤는가.
- AI 답변을 믿거나 거부하게 만드는 근거와 표현은 무엇인가.
- 승인 시 확인하는 Source, 금액·대상·정책과 거부·위임 조건은 무엇인가.
- 개인화에서 직접 바꾸고 싶은 것과 조직이 통제해야 하는 것은 무엇인가.

### 6.3 서비스 담당자 질문

- 최근 4주의 상위 요청 유형, 처리량, Median·P90 처리시간은 무엇인가.
- 재분류, 정보 보완, 중복, SLA 초과의 상위 원인은 무엇인가.
- 자동 해결해도 되는 조건과 반드시 사람이 봐야 하는 예외는 무엇인가.
- 요청 상태와 결과를 직원에게 어떻게 전달하고 어떤 문의가 반복되는가.

### 6.4 Platform·Security·Privacy 질문

- 사용자·그룹·역할 변경은 각 시스템에 얼마나 빨리 반영되는가.
- Search Index, Cache와 Agent Context에 적용해야 하는 삭제·권한 변경 SLO는 무엇인가.
- 사용자 위임과 Service·Agent Identity를 어떻게 구분해야 하는가.
- Model Provider, Data Residency, 보존·학습과 국외 이전 제한은 무엇인가.
- 사고 시 어떤 Agent·Tool·Connector를 누가 얼마나 빨리 중단해야 하는가.
- 감사자가 재현해야 하는 최소 Event와 보존기간은 무엇인가.

### 6.5 Sponsor·구매자 질문

- 어떤 Outcome이 Pilot 비용과 내부 변화 비용을 정당화하는가.
- 성공·실패·중단을 결정할 수치와 의사결정자는 누구인가.
- 성공 시 사용자, Journey, 법인·지역과 예산을 어떤 순서로 확대하는가.
- 표준 제품과 고객 고유 개발의 경계를 어디에 두는가.

## 7. System and Data Inventory

| 범주                | 제품·Version | Owner | 사용자·Group | API·Event | Sandbox | Data Class | 보존·삭제 | Pilot 범위 |
| ------------------- | ------------ | ----- | ------------ | --------- | ------- | ---------- | --------- | ---------- |
| Identity            | TBD          | TBD   | TBD          | TBD       | TBD     | TBD        | TBD       | TBD        |
| Productivity        | TBD          | TBD   | TBD          | TBD       | TBD     | TBD        | TBD       | TBD        |
| Knowledge           | TBD          | TBD   | TBD          | TBD       | TBD     | TBD        | TBD       | TBD        |
| HRIS 또는 ITSM      | TBD          | TBD   | TBD          | TBD       | TBD     | TBD        | TBD       | TBD        |
| Legacy              | TBD          | TBD   | TBD          | TBD       | TBD     | TBD        | TBD       | TBD        |
| Audit·Observability | TBD          | TBD   | TBD          | TBD       | TBD     | TBD        | TBD       | TBD        |

## 8. Pilot Charter Template

### 8.1 기본 정보

| 항목              | 내용                                      |
| ----------------- | ----------------------------------------- |
| 고객·Tenant       | TBD                                       |
| Pilot 기간        | Baseline 2주 + Build·Spike 4주 + 운영 6주 |
| 사용자            | 50~100명                                  |
| P0 Journey        | J1, J2, J3 중 승인된 2~3개                |
| Enabler           | J5 App·Legacy 1개                         |
| Executive Sponsor | TBD                                       |
| Product Owner     | TBD                                       |
| Security·Privacy  | TBD                                       |
| DWP Release Owner | TBD                                       |

### 8.2 공동 목표

`<대상 사용자>`가 `<현재 문제>`를 처리할 때 `<Baseline>`에서 `<Target>`으로
개선하면서 `<Guardrail>`을 위반하지 않음을 `<기간>` 동안 증명한다.

### 8.3 In Scope

- 승인된 Persona·조직·사용자 Group
- J1~J3 중 승인된 Journey와 상위 서비스 5~10개
- Productivity, Knowledge, System of Record와 Legacy Connector 각 1개
- L0·L1 AI, 승인된 L2 Action 최대 1개
- KPI Dashboard, Audit, Incident와 Support 운영

### 8.4 Out of Scope

- 고객 전사 배포와 모든 법인·지역
- 범용 Messenger·Video·Email·HRIS·ITSM 재구축
- L3 이상 고위험 변경과 Closed-loop 산업 제어
- Multi-agent, Agent Studio와 고객 임의 Tool 등록
- 승인되지 않은 개인정보·민감정보의 Model 입력과 장기 보존

### 8.5 Success Metrics

| Metric ID | Baseline | Target       | Data Source       | Owner | Review 주기 |
| --------- | -------- | ------------ | ----------------- | ----- | ----------- |
| J1-K1     | TBD      | -40%         | TBD               | TBD   | 주간        |
| J2-K1     | TBD      | -50%         | TBD               | TBD   | 주간        |
| J2-K2     | TBD      | 85%+         | Eval Set          | TBD   | Release     |
| J3-K1     | TBD      | -40%         | TBD               | TBD   | 주간        |
| Adoption  | TBD      | WAU 60%+ 4주 | Product Analytics | TBD   | 주간        |
| Audit     | TBD      | 100%         | Audit Store       | TBD   | 일간        |

Baseline이 확정되지 않은 Target은 계약상 확정 수치가 아니라 초기 가설이다. Baseline
Review에서 절대값, 상대 개선율과 최소 표본을 함께 승인한다.

### 8.6 Guardrail

- 무권한 Source 노출 0건
- 무승인 L2 이상 Action 0건
- 중대한 개인정보·보안 사고 0건
- Audit 누락 0건
- Pilot 밖 사용자·System·Data 처리 0건
- 학습 금지 데이터의 Model Training 사용 0건

Guardrail 위반은 평균 KPI와 상쇄하지 않는다.

### 8.7 책임

| 역할             | 고객 책임                                    | DWP 책임                                |
| ---------------- | -------------------------------------------- | --------------------------------------- |
| Sponsor          | 목표·예산·갈등 결정, 사용자 참여 보장        | 진행·위험·성과의 투명한 보고            |
| Product·Domain   | 업무 정의, Baseline, 정책·예외와 수용        | PRD, UX, Scope·Backlog와 KPI            |
| Platform·Data    | Sandbox, API, 계정, Source Owner와 변경 공지 | Connector, Mapping, Sync·오류와 운영    |
| Security·Privacy | 정책, DPA, Data Class, 보존·Incident 승인    | Threat Model, 최소권한, Audit·Redaction |
| 사용자           | Research·Pilot 참여와 실제 업무 Feedback     | 고지, 지원, 접근성, Feedback 반영       |
| Support          | 고객 1차 업무 문의와 Escalation              | 제품 장애, Runbook, SLO와 Root Cause    |

### 8.8 운영 Cadence

- Daily: Connector·Agent Health, Guardrail과 P0 Incident Review
- Weekly: KPI, 사용자 Feedback, 실패·거부·Handoff와 Scope Decision
- Biweekly: Sponsor Demo와 Risk·예산·일정 Review
- Release: Security, Privacy, Accessibility, License, SLO와 Rollback Gate

### 8.9 Support와 Incident

| Severity | 예시                              | 초기 대응 | 통제                                      |
| -------- | --------------------------------- | --------- | ----------------------------------------- |
| SEV-1    | 무권한 노출, 무승인 중요 실행     | 15분      | 즉시 Kill Switch, 증거 보존, Sponsor 통지 |
| SEV-2    | P0 Journey 중단, 광범위 잘못된 답 | 30분      | Feature·Connector 제한, Fallback          |
| SEV-3    | 일부 사용자 오류·성능 저하        | 4시간     | Workaround, 우선순위 Review               |
| SEV-4    | 낮은 영향의 UX·Content 문제       | 다음 주기 | Backlog와 Release 계획                    |

### 8.10 중단·철회 조건

- Guardrail 위반 또는 반복되는 SEV-1
- 고객이 승인된 Data·System·사용자 경계를 제공하지 못함
- 핵심 Owner·사용자의 2주 이상 미참여
- Baseline을 측정할 수 없거나 Outcome과 DWP 영향의 연결이 불가능함
- 고객 고유 Custom 요구가 공통 제품 계약을 지속적으로 훼손함
- Pilot 비용·운영 위험이 검증 가능한 가치보다 큼

중단은 실패를 숨기는 결정이 아니다. 증거와 교훈을 기록하고 Data 삭제, Credential
폐기, 사용자 통지와 Source 연결 해제를 완료한다.

## 9. Commercial 원칙

- Research Interview와 유료 Pilot의 범위·책임을 분리한다.
- 무료 대규모 Custom 개발을 디자인 파트너십으로 포장하지 않는다.
- Pilot 가격은 License뿐 아니라 Connector, Security Review, Support와 운영비를
  반영한다.
- 성공 시 사용자·Journey·Connector·배포 모델별 확장 가설을 계약 전에 합의한다.
- 고객 고유 기능의 소유권, 공통 제품 환원, Source·Data 권리와 Confidentiality를
  명확히 한다.

## 10. Selection Decision Record

| 항목                | 내용 |
| ------------------- | ---- |
| 선택 후보           | TBD  |
| 예비 후보           | TBD  |
| 필수 조건 결과      | TBD  |
| Score·증거          | TBD  |
| 승인 P0 Journey     | TBD  |
| 승인 Connector      | TBD  |
| 주요 위험·보완 기한 | TBD  |
| 채택·기각 근거      | TBD  |
| 승인자·일자         | TBD  |

## 11. Pilot Start Gate

- [ ] 필수 진입 조건 전부 Pass
- [ ] Scorecard 80점 이상 또는 승인된 보완 계획
- [ ] P0 Journey와 Baseline Dictionary 승인
- [ ] System·Data Inventory와 Sandbox 준비
- [ ] DPA, Security·Privacy·Model·Data Residency 승인
- [ ] 사용자 모집, Research 고지와 Support 채널 준비
- [ ] Success·Guardrail·중단 조건과 유료 계약 서명
- [ ] Rollback, Kill Switch, Credential 폐기와 Pilot 종료 Data 삭제 절차 검증

이 Gate를 통과하기 전 고객 고유 메뉴, Table, Connector와 Agent를 Production
Source에 추가하지 않는다.
