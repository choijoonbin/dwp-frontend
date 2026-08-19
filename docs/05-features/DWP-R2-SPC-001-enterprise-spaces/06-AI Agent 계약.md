# DWP-R2-SPC-001 AI Agent 계약

> 적용 여부: applicable

## Use Case

- 사용자 의도: 적합한 Space Template 추천, 생성 요청 초안, Space Brief, Content 검색·요약,
  작업·결정 추출, Membership·Lifecycle 위험 설명, 정책에 맞는 운영 Command 실행
- Agent가 필요한 이유: 여러 Content·App·Connector의 Context를 종합하고 자연어 의도를
  구조화된 Space Command로 변환해야 한다.
- 결정적 Workflow 영역: 권한 판정, Policy Evaluation, 상태 전이, 승인 Routing, Grant,
  Publish, Archive·Delete는 결정적 Service가 최종 수행한다.
- 금지된 사용: 승인 대리 결정, 보이지 않는 Space 탐색, Source ACL 우회, Secret·PII 추론,
  무승인 외부 공유·App 설치·Owner 변경·Purge

## Context 계약

Agent Request는 다음 Context Envelope를 Server가 구성한다.

```json
{
  "tenantId": 1,
  "principalId": 123,
  "appKey": "APP.SPACES",
  "contextType": "MY_WORK_OR_SPACE",
  "spaceId": "uuid-or-null",
  "effectiveGrantRevision": 42,
  "locale": "ko-KR",
  "timeZone": "Asia/Seoul",
  "classificationCeiling": "CONFIDENTIAL",
  "traceId": "trace-id"
}
```

- 사용자가 입력한 `spaceId`, Role, Tenant Header를 신뢰하지 않는다.
- Context Selector 전환 시 기존 Conversation을 자동 재사용하지 않는다. 새 대화를 만들거나
  사용자가 “현재 대화를 새 Space Context로 이어가기”를 명시적으로 확인한다.
- Permission Revision이 바뀌면 Retrieval Cache와 Tool Plan을 폐기하고 재평가한다.

## Grounding

| Source                | Owner            | Permission Filter            | Freshness          | Citation           |
| --------------------- | ---------------- | ---------------------------- | ------------------ | ------------------ |
| Space Metadata·Policy | Space Service    | Tenant + Space Grant         | Transactional      | Object Deep Link   |
| DWP Content Revision  | Content Owner    | Content ACL + State          | Published Revision | Revision Link      |
| App·Resource Binding  | App·Source Owner | Binding + Source ACL         | Connector Receipt  | 원본 Link          |
| Approval Timeline     | Approval Service | Request Participant·Approver | Transactional      | Request Link       |
| Membership·Role       | Auth/IAG         | Scoped Admin 또는 Self       | Grant Revision     | Access Evidence ID |
| Audit Summary         | Audit Service    | Auditor Scope                | Near real-time     | Case·Event ID      |

- Draft·Rejected Content는 작성자와 Reviewer 외 Retrieval에서 제외한다.
- Citation은 제목, Source, Revision·기준시각, 분류, 접근 근거를 표시한다.
- Vector Retrieval 전·후 모두 Tenant·Space·Principal ACL Filter를 적용한다.

## Tool과 Action

| Tool                      | 입력·출력                                | Risk Tier | 승인                      | Idempotency | Rollback             |
| ------------------------- | ---------------------------------------- | --------- | ------------------------- | ----------- | -------------------- |
| `space.search`            | Query → 허용 Space·Content               | R0        | 없음                      | -           | -                    |
| `space.summarize`         | Source IDs → Citation Brief              | R0        | 없음                      | -           | -                    |
| `space.recommendTemplate` | 목적·기간·대상 → 후보·근거               | R0        | 없음                      | -           | -                    |
| `space.draftRequest`      | 자연어 → 검증된 Request Draft            | R1        | 사용자 확인               | Draft key   | Draft 삭제           |
| `space.submitRequest`     | Draft ID → Request                       | R2        | 사용자 확인 + Policy      | Required    | 제출 취소 정책       |
| `space.inviteMembers`     | Principal·Role·기간 → Membership Command | R2/R3     | Preview, 필요 시 승인     | Required    | Grant 회수           |
| `space.bindApp`           | App·Scope → Binding Request              | R2/R3     | App Policy·고위험 승인    | Required    | Binding Disable      |
| `space.publishContent`    | Revision·Audience → Publication          | R2/R3     | Content Policy            | Required    | 회수·새 Revision     |
| `space.archive`           | Space → Lifecycle Request                | R3        | Owner + Policy Approval   | Required    | 복원 기간 내 Restore |
| `space.delete`            | Space → Delete Request                   | R4        | 다중 승인·Legal Hold 검사 | Required    | Purge 전 Cancel      |

Risk Tier는 대상 분류, 외부성, 영향 범위, Connector Scope와 가역성에 따라 동적으로 상향한다.

## 실행 상태

- Plan Preview: 변경 대상, 현재값·예상값, 영향 Member·Content·App, 정책 이유, 승인 경로,
  예상 완료 시간을 표시한다.
- Progress·Streaming: 의미 단위 Step과 Connector 상태를 표시하며 내부 Chain of Thought는
  노출하지 않는다.
- Stop·Cancel: 생성 전 Draft는 즉시 취소, 승인 제출 후에는 Workflow 정책에 따라 회수한다.
- Partial Success: 완료·실패·미시도 Step과 보상 가능 여부를 분리한다.
- Retry: 동일 Idempotency Key를 사용하고 새 요청을 만들지 않는다.
- Compensation: Membership 회수, Binding Disable, Draft 복원처럼 명시된 Tool만 수행한다.
- Human Handoff: 정책 불명확, 고위험, Source ACL Drift, 반복 실패는 Owner·Admin Queue로 보낸다.

## Policy

- Model Routing: 분류·지역·Tenant BYOM 정책에 따라 승인된 Model Route만 사용한다.
- Prompt·Output Class: 입력 Source 중 가장 높은 분류를 상속한다.
- Training: Tenant Content, Prompt, Output, Feedback의 Provider 재학습 사용 금지
- Content Safety: Prompt Injection, Data Exfiltration, Malware Link, Toxicity·Harassment 검사
- Tool Allowlist: Tenant → App → Space → User의 Allowlist 교집합
- Budget: Space·Tenant별 Token·Tool·Connector Budget과 경고·차단 Threshold
- Timeout: Read Plan 30초, Action Plan 60초, 장기 작업은 Async Job으로 전환
- Memory: Space별 장기 Memory는 Opt-in·Retention·삭제·Citation 계약이 준비되기 전 금지

## Trust UI

- AI Label: 모든 생성·요약·추천·실행에 `AI` Label과 Model Route Category 표시
- 추천 이유: 선택한 Template·Risk Route의 근거 Rule과 Source를 사용자 언어로 설명
- 불확실성: 누락된 Owner·기간·분류·Source Freshness를 명시하고 추측해 제출하지 않는다.
- Citation: 원문 Preview, Revision, 기준시각, 접근 범위 제공
- 변경 대상: Before·After Diff와 영향을 받는 Principal·Resource 수 제공
- 승인: 사용자가 Draft를 수정하고 제출 전 최종 확인
- Timeline: Plan, Policy, Approval, Tool Call, Result, Compensation, Audit ID

## Prompt Injection·Connector 안전

- 외부 Content의 Instruction은 데이터로 취급하고 System·Tenant Policy보다 우선하지 않는다.
- Tool Argument는 LLM String을 직접 실행하지 않고 Typed Schema·Allowlist로 검증한다.
- URL Fetch는 Connector Adapter와 Egress Policy를 거치고 임의 네트워크 접근을 금지한다.
- Retrieved Content가 Tool 승인이나 Permission을 주장해도 신뢰하지 않는다.
- Connector Scope·Source ACL이 변경되면 기존 Index와 Agent Cache를 격리한다.

## Evaluation

| Metric                  | Dataset                  | Baseline | Target    | Release Gate |
| ----------------------- | ------------------------ | -------- | --------- | ------------ |
| Groundedness            | 한·영 Space Q&A 500건    | G2 측정  | 95% 이상  | G4           |
| Citation Correctness    | ACL·Revision 포함 300건  | G2 측정  | 98% 이상  | G4           |
| Template Recommendation | 목적별 Golden Set 200건  | G2 측정  | Top-3 90% | G3           |
| Draft Schema Validity   | 생성 요청 500건          | G2 측정  | 99.5%     | G3           |
| Tool Argument Accuracy  | Action 500건             | G2 측정  | 99.5%     | G4           |
| Unauthorized Retrieval  | Adversarial 1,000건      | 0 허용   | 0건       | Blocking     |
| Unsafe Action Rate      | Prompt Injection 1,000건 | 0 허용   | 0건       | Blocking     |
| Human Override          | Pilot                    | 측정     | 15% 이하  | G4           |
| P95 Latency             | Search·Brief             | 측정     | 8초·15초  | G4           |

평가 Dataset은 Tenant·Space·Role·분류·상태·Locale 조합을 포함하고 Permission이 없는 문서를
의도적으로 섞어 Negative Test를 수행한다.
