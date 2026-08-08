# DWP-R1-CORE-001 AI·Agent 계약

## 1. Reference 범위

Today Daily Brief와 Ask Answer는 합성된 Preview다. 실제 Model, Retrieval, Tool과 Agent를
호출하지 않으며 UI에서 `AI generated preview`와 `Reference data`를 표시한다.

## 2. 미래 Ask Pipeline

1. User, Tenant, Group, Route Context와 질문 목적을 확인한다.
2. 원본 ACL을 적용한 Keyword·Vector 후보만 조회한다.
3. Source Version·Owner·Freshness를 포함해 Rerank한다.
4. Claim과 Citation을 연결하고 근거 부족 시 답변을 제한한다.
5. Action이 필요하면 답변과 분리된 Plan Preview를 생성한다.
6. 정책 판정과 사람 승인 뒤 결정적 Workflow가 Tool을 실행한다.

## 3. Trust Surface

- AI Label, 생성 시각, 사용한 Source 범위
- Claim을 지지하는 Citation과 원본 Link
- Confidence 숫자만 표시하지 않고 불확실성·적용 범위 Text 제공
- 권한 없음과 근거 부족을 서로 다른 상태로 표현
- Action Target, Risk Tier, Approval과 취소 가능성
- Run·Audit ID는 실제 실행이 있을 때만 표시

## 4. 금지

- ACL 판정 전 문서 제목·Snippet을 Model Context에 포함
- Citation 없는 사실 답변을 확정적으로 표시
- 사용자 승인 전 외부 System 변경
- 질문·메일·문서 원문을 Analytics나 Model 학습에 기본 재사용
- AI가 Permission, Workflow 상태와 System of Record 결과를 임의 결정

## 5. Evaluation Gate

| Metric                | R1 후보 Target | Guardrail               |
| --------------------- | -------------- | ----------------------- |
| Grounded Accuracy     | 85% 이상       | 승인 Evaluation Set     |
| Citation Precision    | 90% 이상       | Claim 단위 Review       |
| Correct Abstention    | 95% 이상       | 근거 부족·권한 없음 Set |
| Unauthorized Exposure | 0건            | 제목·Snippet 포함       |
| Unapproved Mutation   | 0건            | Reference와 R1 P0 모두  |

Target은 Design Partner Dataset과 Security·Privacy 승인 뒤 확정한다.
