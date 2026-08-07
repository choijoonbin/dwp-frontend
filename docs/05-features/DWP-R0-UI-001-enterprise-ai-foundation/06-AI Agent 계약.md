# DWP-R0-UI-001 AI Agent 계약

> 적용 여부: applicable

## Use Case

- 사용자 의도: AI가 제안·실행한 업무의 근거, 변경 내용, Risk와 진행 상태를 이해
- Agent가 필요한 이유: 여러 Source와 Tool을 연결한 비결정적 요약·계획·예외 처리
- 금지된 사용: UI Component가 Model을 직접 호출하거나 승인 없이 고위험 Tool 실행

## Grounding

| Source              | Owner        | Permission Filter   | Freshness          | Citation |
| ------------------- | ------------ | ------------------- | ------------------ | -------- |
| Enterprise document | Data Owner   | 원본 ACL            | Version·indexedAt  | 필수     |
| Business record     | System Owner | Tenant·Resource ACL | recordVersion      | 필수     |
| Mail·meeting        | User·Tenant  | Delegated scope     | provider timestamp | 필수     |

## Tool과 Action

| Tool                   | 입력·출력      | Risk Tier | 승인        | Idempotency | Rollback       |
| ---------------------- | -------------- | --------- | ----------- | ----------- | -------------- |
| Read·Search            | Query·Source   | L0        | 불필요      | 선택        | N/A            |
| Draft                  | Context·Draft  | L1        | 사용자 확인 | 선택        | 폐기           |
| Reversible update      | Target·Patch   | L2        | 필수        | 필수        | 보상 Action    |
| Irreversible·sensitive | Target·Command | L3        | 분리 승인   | 필수        | 사전 정의 필수 |

## 실행 상태

- Plan Preview: Tool, Data, Target, 변경 전·후, Risk와 승인자 표시
- Progress: Queued·Running·Waiting approval·Succeeded·Partial·Failed·Stopped
- Stop은 가능한 Step에서만 제공하고 요청 접수와 실제 중단을 구분
- Partial Success는 성공·실패 Target을 각각 표시
- Retry는 동일 Idempotency Key 정책과 보상 여부를 보여줌
- Human Handoff는 담당 Group, Context Summary와 Audit ID 포함

## Trust UI

- AI Label과 Model 세부정보를 구분하고 과도한 의인화 금지
- 추천 이유, 불확실성, 누락 Source와 Freshness 표시
- Citation·Source Preview는 원본 ACL을 재검증
- 승인·반려·수정은 명확한 Command와 결과 Announcement 제공
- Execution Timeline은 Tool 내부 비밀값 대신 업무 의미와 Audit ID 표시

## Evaluation

| Metric             | Dataset        | Baseline      | Target        | Release Gate |
| ------------------ | -------------- | ------------- | ------------- | ------------ |
| Groundedness       | 승인된 R1 질문 | Pilot 전 측정 | 85% 이상      | R1           |
| Plan completeness  | Golden plan    | Pilot 전 측정 | 95% 필수 Step | R1           |
| Unsafe action rate | 공격·오용 Set  | 0             | 0%            | 차단         |
| Approval bypass    | L2·L3 Scenario | 0             | 0건           | 차단         |
| UI comprehension   | 사용자 Test    | 측정 필요     | 90% 상태 이해 | R0.5         |
