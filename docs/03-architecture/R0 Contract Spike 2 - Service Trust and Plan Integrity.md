# R0 Contract Spike 2 - Service Trust and Plan Integrity

> 상태: implemented-and-verified
>
> 기준일: 2026-08-08
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`, `dwp_agent`

## 1. 목적

Contract Spike 1은 Browser Session과 Agent Plan Preview를 연결했지만 내부 Network에
있다는 이유만으로 Agent가 Identity Header를 신뢰하는 공백이 남았다. NIST Zero Trust의
원칙에 따라 Browser Identity와 Service Identity를 분리하고, 이후 승인·실행에서 동일한
계획인지 검증할 Plan Hash와 개인정보 최소화 Audit Event를 추가한다.

```text
Browser
  -> Gateway: Session + CSRF + verified user identity
    -> Gateway: sanitize spoofed service header once + inject route service identity
      -> Agent: verify service identity before user headers
        -> resolve active Agent Registry revision
          -> deterministic plan hash + privacy-minimized audit event
```

외부 Model, Connector, Retrieval, Workflow Engine과 업무 Mutation은 여전히 호출하지 않는다.

## 2. 외부 후보 재검증

### 2.1 Productivity Connector

| 기준        | Microsoft 365                                                | Google Workspace                                           | DWP 결론                                         |
| ----------- | ------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------ |
| 권한        | Graph Delegated·RSC·Application을 구분하고 최소 권한 우선    | OAuth Scope를 기능별로 제한하고 민감 Scope 검증 필요       | 사용자 위임 Read부터 시작                        |
| 증분 동기화 | 불투명 `nextLink`·`deltaLink`, Replay·`410`·Full Resync 처리 | Gmail `historyId`, Calendar `syncToken`, 만료 시 Full Sync | Cursor를 해석하지 않는 Port 유지                 |
| Push        | Change Notification 뒤 Delta Backstop 필요                   | Gmail Watch·Calendar Channel 뒤 증분 Sync 필요             | Push를 진실 원본으로 사용하지 않음               |
| 첫 후보     | Outlook·Calendar·SharePoint를 Graph로 묶어 검증 가능         | Gmail·Calendar·Drive 조합에 적합                           | 고객 중립 시 Microsoft 365를 C1 기본 후보로 사용 |

Microsoft 365 우선은 영구 종속 결정이 아니라 첫 실증 순서다. 디자인 파트너의 표준이
Google Workspace이면 C1 Adapter만 교체하고 공통 Cursor·Health·Permission 계약은 바꾸지
않는다. Application Permission과 Tenant 전체 수집은 별도 Privacy·Security 승인 전 금지한다.

### 2.2 Durable Workflow

| 기준      | Temporal                            | Camunda 8                           | 선택 규칙                         |
| --------- | ----------------------------------- | ----------------------------------- | --------------------------------- |
| 모델      | Code-first, Event History Replay    | BPMN·User Task 중심                 | 개발팀 소유 자동화 대 현업 가시성 |
| 장기 실행 | 장애 뒤 상태 재구성과 결정적 Replay | Process Instance와 Human Task 대기  | 둘 다 Timer·재시작 실증 필요      |
| 변경 배포 | Worker Versioning·Pinning           | Process Version·Instance Migration  | 장기 실행 중 변경 시나리오 비교   |
| DWP 후보  | Agent·Tool Orchestration 1순위      | 복잡한 승인·업무 프로세스 비교 후보 | 동일 Journey와 3년 TCO로 W1 결정  |

현재는 Temporal을 W1의 기술 1순위로 두되 Dependency를 추가하지 않는다. 승인자 배정,
업무 기한, 현업 BPMN 변경이 Pilot의 핵심이면 Camunda 점수를 높인다. LLM 호출은 어떤
Engine에서도 결정적 Workflow 분기 안에 직접 넣지 않고 외부 Activity로 격리한다.

### 2.3 Search

실제 Knowledge 500~5,000건과 ACL Snapshot이 없으므로 Vector Table을 만들지 않는다.
S1은 Keyword Baseline을 먼저 측정하고 같은 Dataset에서 `pgvector` Hybrid 후보의
Recall·nDCG·Citation·ACL·삭제 전파·P95를 비교한다. 결과 없이 전용 Search Engine이나
Embedding 차원을 고정하지 않는다.

## 3. 구현 결정

### 3.1 Service Identity

- Browser가 보낸 `X-DWP-Service-Token`은 Gateway에서 항상 제거한다.
- 공통 Sanitizer가 외부 Header를 한 번 제거하고 Agent·Platform Route Filter가 각자
  독립 Token을 새 Header로 주입한다.
- Gateway 또는 Agent에 Token이 없으면 `503`, 누락·불일치는 Agent가 `401`로 거부한다.
- Token 비교는 Constant-time으로 수행하고 Log·Response·Frontend에 노출하지 않는다.
- 로컬 Shared Secret은 Contract 검증 수단일 뿐 운영 종착점이 아니다.
- 운영은 Agent Port 비공개, Secret Store Rotation과 Workload Identity 또는 mTLS를
  Release Gate로 요구한다.

### 3.2 Plan Integrity

`planHash`는 Tenant, 사용자, 정규화 Role, Request ID, Intent, Action, Target, Source
Reference와 해석된 Agent Registry Key·Revision·Artifact Version을 Canonical JSON으로
만든 뒤 SHA-256으로 계산한다.

- 같은 Identity·권한·입력의 재시도는 같은 Hash를 만든다.
- 질문, 대상, Source 또는 Role이 바뀌면 Hash가 바뀐다.
- 활성 Agent Revision이 바뀌면 Hash가 바뀐다.
- L2·L3 승인 Token은 이후 이 Hash, Tool Version, Target과 만료 시각에 묶는다.
- Frontend는 64자리 소문자 SHA-256이 아니면 응답을 Fail-closed 처리한다.

### 3.3 Audit 최소화

`agent.plan.previewed` Event는 Audit ID, Run ID, Tenant, 사용자, Correlation, Plan Hash,
Risk, 승인·Mutation 상태와 Role·Source 개수만 기록한다. 다음 값은 기록하지 않는다.

- 질문·메일·문서 원문
- Source ID·Title·Snippet
- Service Token·Session Cookie·Connector Credential
- Chain-of-thought·Prompt

현재 Log Event는 Schema와 Redaction 검증용이다. Append-only 저장소, 서명·보존·검색과
SIEM 전달은 관측 Backend와 규제 범위를 정한 뒤 구현한다.

## 4. 검증 증적

- Gateway: 외부 Service Header 교체, 미설정 `503`, 비-Agent 경로 Header 제거
- Gateway: Agent·Platform Filter 연쇄 뒤에도 올바른 Route Token이 유지됨
- Agent: Service Token 누락·불일치 `401`, 서버 미설정 `503`
- Local Supervisor: Agent가 `127.0.0.1:8010`에만 Listen
- Agent: 동일 요청 Hash 안정성, 입력 변경 시 Hash 변경, Mutation 금지
- Audit: 원문 Intent·Source ID·Service Token 미기록 자동 검증
- Frontend: Plan Hash·Correlation 필수, 변조 Hash Fail-closed
- 실제 Browser 경로: Session·CSRF·User Identity·Service Identity를 모두 통과해야 `200`
- 실제 Agent 경로: Active Registry Revision을 해석하고 응답·Hash·Audit에 포함
- 새 DB Table·Migration, Connector SDK, Workflow·Model·Vector Dependency 0개

## 5. 남은 Gate

- C1: 디자인 파트너 Microsoft 365 위임 Tenant 또는 Google Workspace 대체 결정
- S1: Data Owner가 승인한 실제 Knowledge·ACL·삭제 Event Dataset
- W1: 동일 승인·Timer Journey의 Temporal·Camunda 실행·복구·Version·TCO 비교
- A1: Registry Resolution 완료, 승인 Model Route·Tool Grant·L0·L1 Citation·Budget·Evaluation
- Production Workload Identity 또는 mTLS, Token Rotation과 Agent Network Policy
- Append-only Audit Store, 보존기간, SIEM·Incident 운영 승인

## 6. 공식 근거

- [NIST SP 800-207 Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final)
- [RFC 8705 OAuth Mutual TLS](https://datatracker.ietf.org/doc/html/rfc8705)
- [Microsoft Graph Permission Best Practices](https://learn.microsoft.com/en-us/graph/best-practices-graph-permission)
- [Microsoft Graph Delta Query](https://learn.microsoft.com/en-us/graph/delta-query-overview)
- [Gmail Synchronization](https://developers.google.com/workspace/gmail/api/guides/sync)
- [Google Calendar Synchronization](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Temporal Workflow](https://docs.temporal.io/workflows)
- [Temporal Worker Versioning](https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning)
- [Camunda User Tasks](https://docs.camunda.io/docs/components/modeler/bpmn/user-tasks/)
- [Camunda Process Instance Migration](https://docs.camunda.io/docs/components/concepts/process-instance-migration/)
