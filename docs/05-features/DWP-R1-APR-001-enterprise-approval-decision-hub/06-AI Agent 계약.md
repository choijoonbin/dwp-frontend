# DWP-R1-APR-001 AI Agent 계약

> 적용 여부: applicable

## Use Case

- 사용자는 긴 문서와 여러 Source의 변경점을 빠르게 이해하고 싶다.
- 요청자는 적합한 Form, 누락 정보와 예상 결재선을 사전에 확인하고 싶다.
- 결재자는 정보 요청·보완 의견의 초안을 만들고 싶다.
- 관리자는 자연어로 Workflow 후보를 만들 수 있지만 검증·Diff·독립 게시가 필요하다.

AI는 비정형 문서 요약과 설명을 담당한다. 결재선 계산, 권한, 상태 전이, 정족수와 최종
결정은 결정적 정책·Workflow가 담당한다.

## 금지된 사용

- Agent가 승인·반려·위임·재지정의 최종 Actor가 되는 것
- 사용자의 Session 또는 Step-up Token을 Agent Service가 재사용하는 것
- 출처 없이 위험·규정 준수·승인 가능성을 단정하는 것
- 자연어 요청만으로 Workflow·Policy를 게시하는 것
- 다른 Tenant, 비공개 첨부 또는 사용자가 열람할 수 없는 과거 결정을 Grounding하는 것
- 결정 결과를 학습 데이터로 재사용하는 것

## Grounding

| Source                 | Owner                 | Permission Filter           | Freshness         | Citation                   |
| ---------------------- | --------------------- | --------------------------- | ----------------- | -------------------------- |
| Request Revision       | Approval              | participant + content scope | immutable         | field path + revision hash |
| Attachment             | Approval/Object Store | attachment ACL + scan state | immutable version | page·section + sha256      |
| Source record snapshot | Domain                | source scope                | submitted version | source entity + version    |
| Workflow·Policy        | Approval              | explain permission          | published version | rule/node/version          |
| Organization·Role      | People·Auth           | effective scope             | effective-at      | unit·position·role         |
| Prior decision         | Approval              | same instance + audit scope | immutable         | decision ID                |

AI 응답은 최소 하나의 구조화 Citation을 포함하고, Citation을 열 때 사용자의 권한을 다시
검증한다. 요약 Cache Key에는 tenant, principal scope hash, revision hash, model과 prompt
version을 포함한다.

## Tool과 Action

| Tool                                   | 입력·출력              | Risk Tier | 승인             | Idempotency   | Rollback      |
| -------------------------------------- | ---------------------- | --------- | ---------------- | ------------- | ------------- |
| `approval.get_context`                 | 허용된 Revision·Policy | L1 read   | 불필요           | -             | -             |
| `approval.compare_revisions`           | 구조화 Diff            | L1 read   | 불필요           | -             | -             |
| `approval.explain_route`               | Rule·후보 설명         | L1 read   | 불필요           | -             | -             |
| `approval.prepare_draft`               | Form Draft patch       | L2        | 사용자 Preview   | client action | Draft revert  |
| `approval.prepare_information_request` | 질문 Draft             | L1        | 전송 전 확인     | client action | Draft discard |
| `approval.preflight`                   | 검증·결재선 Preview    | L2        | 제출 전 확인     | 필수          | 없음          |
| `approval.submit_draft`                | 승인 요청 생성         | L3        | 명시적 사람 승인 | 필수          | 정책형 회수   |

`approval.decide`, `approval.delegate`, `approval.reassign`, `approval.publish_policy`는 Agent
Allowlist에 등록하지 않는다.

## 실행 상태

- Plan Preview: 변경할 Draft, 사용할 Form·Workflow, 예상 결재선과 Source를 표시한다.
- Progress: Source 수집, Diff, Preflight 단계를 분리해 보여준다.
- Stop: 제출 전 언제든 중단 가능하며 Draft만 남길지 선택한다.
- Partial Success: 읽지 못한 Source와 영향 범위를 명시하고 제출을 기본 차단한다.
- Retry: 같은 Idempotency Key와 Plan Hash를 사용한다.
- Compensation: 제출 후에는 삭제가 아니라 정책형 회수 Command를 사용한다.
- Human Handoff: 정보 부족·정책 충돌·Restricted 문서는 담당자에게 넘긴다.

## Trust UI

- Label: `AI 요약` 또는 `AI가 준비한 초안`
- 표시: 사용 Source 수, 생성 시각, 최신 Revision, 누락 Source
- 근거: 문장 또는 Field 단위 Citation과 Source Preview
- 불확실성: 신뢰도 숫자 하나보다 `확인하지 못한 항목`을 구체적으로 표시
- 승인: AI Panel 안에 최종 승인 Button을 넣지 않는다. 결정 Bar는 사람 Action으로 분리한다.
- 변경: AI Draft가 수정한 Field Diff를 제출 전에 확인한다.
- Audit: model route, prompt version, source hash, tool call, plan hash와 사람 확인 ID

## Policy

- Model Routing: Tenant 정책과 데이터 등급에 맞는 승인 Model만 사용
- Restricted Data: 외부 Model 전송 금지, 승인된 Private Route가 없으면 AI 기능 비활성
- Training: Prompt·본문·결정의 Provider 학습 사용 금지
- Tool Allowlist: 읽기 3개, Draft·Preflight·Submit 준비 도구만 허용
- Budget: Request당 Source·Token·Latency 상한
- Timeout: 요약 실패가 결정적 결재 UI를 차단하지 않음
- Output: HTML 실행 금지, 구조화 Schema 검증과 안전한 Markdown Rendering

## Evaluation

| Metric                     | Dataset                            |       Target | Release Gate                   |
| -------------------------- | ---------------------------------- | -----------: | ------------------------------ |
| Citation correctness       | 4 Reference Form + 실제 익명 Pilot |     98% 이상 | 잘못된 Citation 0 critical     |
| Field factuality           | 구조화 Snapshot QA                 |     97% 이상 | 금액·사람·기한 오류 0 critical |
| Diff completeness          | Revision pair corpus               |     95% 이상 | 중요 Field 누락 0              |
| Route explanation accuracy | Policy test matrix                 |         100% | 정책과 불일치 0                |
| Unsafe action rate         | 공격·우회 corpus                   |           0% | 결정 Tool 호출 0               |
| Human override             | Pilot                              | 측정 후 기준 | 높은 Override 원인 분석        |
| P95 latency                | 6-source brief                     |     6초 이하 | UI Timeout·fallback 검증       |

AI Gate를 통과하지 못해도 Source 문서, Diff, 결재선과 수동 결정은 정상 동작해야 한다.
