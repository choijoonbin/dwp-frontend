# R0 Contract Spike 1 - Governed Plan Preview

> 상태: implemented-and-verified
>
> 기준일: 2026-08-08
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`, `dwp_agent`
>
> 후속 보강: `R0 Contract Spike 2 - Service Trust and Plan Integrity.md`

## 1. 목적

첫 디자인 파트너와 실제 Productivity·Knowledge·System of Record 제품이 정해지기 전에
특정 SDK, 업무 Table 또는 Workflow Engine을 고르지 않고 다음 경계가 실제로 연결되는지
검증한다.

```text
Browser
  -> Gateway: CSRF + Browser Session 재검증 + 위조 Identity Header 제거
    -> Agent Runtime: deterministic Plan Preview
      -> L2 Risk + Human Approval + Audit Reference
```

이 Spike는 외부 Model, Retrieval, Connector, Tool 실행과 업무 Mutation을 호출하지 않는다.

## 2. 최신 공식 계약에서 반영한 제약

- Microsoft Graph Delta는 `nextLink`·`deltaLink` Token을 불투명 Cursor로 취급해야 하고
  Replay와 `410 Gone` 후 Full Resync를 처리해야 한다.
- Mail Delta는 Folder 단위이며 삭제·이동과 Read 상태 변화가 다시 나타날 수 있다.
- Webhook은 누락·구독 제거·재승인이 가능하므로 Delta Backstop이 필요하다.
- Graph 권한은 Delegated와 최소 권한을 우선하고 Application Permission은 별도 승인한다.
- pgvector Approximate Index는 Metadata Filter가 Index Scan 뒤 적용될 수 있으므로 ACL
  후보 제한과 Recall Evaluation 없이 도입하지 않는다.

따라서 Connector 계약은 Provider URL이나 Token 내용을 해석하지 않는 Cursor,
`permissionReference`, Health·Lag·Partial 상태를 먼저 고정한다.

## 3. 구현 범위

### Backend

- `dwp-platform-contracts`: `ExecutionContext`, `ConnectorPort`, `KnowledgeSearchPort`,
  `WorkflowPort`, `AgentRuntimePort`, `AuditEventEnvelope`
- Collection Snapshot, Read Limit, Risk Tier, Plan Hash, Idempotency와 Preview Mutation 금지를
  생성 시점에 검증
- Gateway의 보호 API는 Auth `/auth/me`로 Session Registry까지 재검증
- Browser가 보낸 `X-DWP-*` Header를 제거하고 검증된 사용자·Tenant·Role만 다시 전달
- 비-Auth Mutation은 `XSRF-TOKEN` Cookie와 `X-XSRF-TOKEN` Header 일치 요구
- `/api/agent/**`를 내부 Agent Runtime으로만 Relay

### Agent

- `POST /v1/plans/preview`
- Gateway가 전달한 User·Tenant·Correlation Header 필수
- Request ID 기반의 결정적 Run·Audit ID
- Source 권한 확인 → Read-only Tool Preview → Human Approval 세 단계
- `referenceMode=true`, `mutationAllowed=false`, L2와 명시적 승인 필수
- 내부 Chain-of-thought, Prompt, Credential과 원문 Trace 미반환

### Frontend

- Ask가 공통 CSRF Client를 통해 Agent Preview 요청
- Preparing, Contract verified와 Runtime Fallback 상태 분리
- 응답이 Mutation 허용을 주장하면 Client에서도 Fail-closed
- Audit ID, Source Reference 수, Risk와 Approval을 구조화해 표시

## 4. API 계약

```http
POST /api/agent/v1/plans/preview
X-Tenant-ID: 1
X-XSRF-TOKEN: <in-memory token>
Cookie: DWP_SESSION=<http-only>; XSRF-TOKEN=<double-submit token>
```

Request는 `requestId`, `intent`, `action`, `target`, `sourceReferences`만 허용한다. 알 수 없는
Field와 Gateway가 검증하지 않은 Identity는 거부한다. Response는 `runId`, `auditId`,
`riskTier`, `approvalRequired`, `mutationAllowed`, `steps`, `sourceReferences`를 DWP API
Envelope 안에 반환한다.

## 5. 검증 증적

- Backend Gradle 전체 Test 통과
- Agent Pytest 5개와 Python Compile 통과
- Frontend Unit 15개, Typecheck·Lint 통과
- Desktop·Mobile Shell E2E·Axe 8개 통과
- Desktop·Mobile Visual 18개 통과 및 Ask 기준 이미지 직접 검토
- 실제 Local Integration: Login 200 → Plan Preview 200 → Logout 200
- Negative Integration: Session 없는 위조 Identity 401, CSRF 없는 Mutation 403
- 새 DB Table·Migration, 외부 SDK·Model·Workflow·Vector Dependency 0개

## 6. 아직 완료되지 않은 Gate

- C1: 디자인 파트너의 Microsoft 365 또는 Google Workspace 위임 Auth·Read Demo
- S1: 실제 Knowledge 500~5,000건 ACL·삭제·검색 품질 Evaluation
- W1: Temporal·BPMN 후보의 Timer·재시작·Version·TCO 비교
- A1: 승인된 Model Route의 L0·L1 Citation·Budget·Evaluation
- Gateway Session Verification의 Cache·Circuit Breaker 운영 정책
- Agent Port의 외부 Network 차단과 Production Workload Identity 또는 mTLS

이 항목이 통과하기 전에는 실제 Connector Credential, Vector Table, Workflow Engine과
Model Provider를 Production Dependency로 추가하지 않는다.

## 7. 참고 자료

- [Microsoft Graph permissions](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Microsoft Graph delta query](https://learn.microsoft.com/en-us/graph/delta-query-overview)
- [Microsoft Graph message delta](https://learn.microsoft.com/en-us/graph/delta-query-messages)
- [Microsoft Graph lifecycle notifications](https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events)
- [pgvector](https://github.com/pgvector/pgvector)
