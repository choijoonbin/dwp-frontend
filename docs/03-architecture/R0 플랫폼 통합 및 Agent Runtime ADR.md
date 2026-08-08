# DWP R0 플랫폼 통합 및 Agent Runtime ADR

> 문서 상태: Accepted Architecture Contract v1.2
>
> 기준일: 2026-08-08
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`, `dwp_agent`
>
> 구현 시점: R0 Spike와 R1 첫 End-to-end Journey

## 1. 목적

DWP가 단순 포털이나 독립 Chatbot으로 굳지 않도록 Connector, Event, Search,
Workflow와 Agent Runtime의 책임을 먼저 고정한다. 이 문서는 제품별 API나 DB Table을
미리 만드는 명세가 아니다. 첫 디자인 파트너의 실제 시스템을 선택할 때 구현이
갈라지지 않게 하는 플랫폼 계약이다.

## 2. 결정 요약

| ID      | 결정                                                    | 상태     | 구현 Gate                                        |
| ------- | ------------------------------------------------------- | -------- | ------------------------------------------------ |
| ADR-009 | API·Event 우선 Connector와 격리된 Tool Gateway          | Accepted | 첫 Productivity·SoR Connector Spike              |
| ADR-010 | CloudEvents Envelope와 Transactional Outbox             | Accepted | Event Broker·전달 SLO 선정                       |
| ADR-011 | 원본 ACL을 보존하는 Hybrid Search                       | Accepted | 첫 Knowledge Source·평가 Dataset 확정            |
| ADR-012 | 결정적 Durable Workflow와 비결정적 Agent Runtime 분리   | Accepted | Temporal·BPMN 후보 Spike와 TCO·License 검토      |
| ADR-013 | Model Gateway·Agent/Tool Registry·Risk Tier 중앙 통제   | Accepted | 첫 Model Provider와 L0·L1 Agent 구현             |
| ADR-014 | OpenTelemetry 기반 Trace와 별도 불변 Audit Event        | Accepted | 관측 Backend·보존·민감정보 정책 확정             |
| ADR-015 | MCP는 Agent-to-Tool, A2A는 외부 Agent 상호운용 경계에서 | Accepted | 실제 다중 Agent·외부 Agent 요구 전 도입하지 않음 |
| ADR-016 | Browser·사용자·Service Identity 분리와 내부 Zero Trust  | Accepted | Spike 2 Token, 운영 Workload Identity·mTLS Gate  |

## 3. 논리 구조와 소유권

```text
Browser
  -> Gateway/BFF
     -> Domain API (Work, Service, Approval, Knowledge)
     -> Policy Decision + Audit
     -> Workflow Port
        -> Durable Workflow Engine candidate
        -> Connector/Tool Gateway
           -> SaaS, Legacy API, Event, MCP, approved RPA
     -> Agent Control Plane
        -> Agent Runtime
           -> Model Gateway
           -> Retrieval API
           -> Tool Gateway
```

- `dwp-backend`가 Tenant, 사용자 권한, 업무 상태, 승인, Workflow와 Audit의 원본을
  소유한다.
- `dwp_agent`는 계획, 검색 조합, Model 호출과 Agent 실행을 담당하지만 업무 원장과
  최종 권한 판정의 원본이 되지 않는다.
- Browser는 Model Provider나 MCP Server를 직접 호출하지 않는다.
- 내부 Network 위치만으로 Agent 요청을 신뢰하지 않는다. Gateway가 외부 Service Header를
  제거하고 별도 Service Identity를 주입하며 Agent는 사용자 Identity보다 먼저 검증한다.
- Connector Credential은 Vault 또는 동등한 Secret Store에 두며 Prompt, Trace와
  DB 평문에 넣지 않는다.

## 4. ADR-009 Connector와 Tool Gateway

연결 우선순위는 다음과 같다.

`표준 API -> Event/Webhook -> MCP Tool -> 승인된 Embedded UI -> RPA`

### 필수 계약

- Connector Manifest: ID, Version, Owner, Tenant Scope, Data Classification,
  Capability와 지원 Action
- Credential Binding: 사용자 위임 또는 Service Identity를 명시하고 Tenant 간 공유 금지
- Action Schema: JSON Schema 입력·출력, Timeout, Retry 가능 여부, Idempotency Key,
  Compensating Action과 Risk Tier
- Policy Check: Tool 목록 노출 전과 실제 실행 직전에 각각 평가
- Result Envelope: 원본 System ID·URL, 수행 주체, 시작·종료 시각, 상태와 오류 코드
- Health: 인증 만료, Rate Limit, 동기화 지연과 마지막 성공 시각

MCP는 승인된 Connector Adapter가 제공할 수 있는 프로토콜 중 하나다. 내부 REST API를
전부 MCP로 다시 감싸거나 MCP Server가 DWP 권한을 우회하게 만들지 않는다. 원격 MCP는
HTTPS와 규격의 Authorization Profile을 적용하고 Tool Schema를 Versioning한다.

RPA는 API가 없는 읽기·저위험 업무의 마지막 대안이다. 화면 Selector 변경 감지,
Credential 격리, 사람 승인, 녹화 또는 동등한 증거와 Kill Switch가 없는 RPA Action은
운영하지 않는다.

## 5. ADR-010 Event Backbone

Domain 상태 변경과 Event 발행의 이중 쓰기를 피하기 위해 Transactional Outbox를
사용한다. Event는 CloudEvents 호환 Envelope를 기본으로 한다.

필수 Metadata는 `id`, `source`, `type`, `specversion`, `time`, `subject`,
`tenantId`, `correlationId`, `causationId`, `schemaVersion`, `classification`이다.

- 전달 의미는 기본적으로 At-least-once이며 Consumer는 Idempotent해야 한다.
- Event ID와 Consumer ID의 처리 이력을 사용해 중복을 억제한다.
- 순서가 필요한 Aggregate는 Aggregate ID Partition 안에서만 보장한다.
- 개인정보 원문과 Prompt를 Event Envelope에 복제하지 않고 참조 ID와 최소 Metadata만
  전달한다.
- Schema 변경은 Backward-compatible Additive Change를 기본으로 하고 Breaking
  Change는 새 Major Type으로 발행한다.
- Broker 제품은 첫 고객의 Cloud, 운영 역량, Throughput, Data Residency와 TCO Spike
  뒤 정한다. 계약보다 제품을 먼저 고르지 않는다.

## 6. ADR-011 Search와 Knowledge

검색은 `Keyword + Vector + Metadata Filter + Rerank` Hybrid Pipeline을 사용하되,
권한 필터를 결과 표시 단계에만 붙이지 않는다.

1. Source Connector가 문서 ID, Version, Owner, ACL, 보존·삭제 Metadata를 수집한다.
2. 정규화 문서와 Chunk는 Source Version과 ACL Snapshot을 가진다.
3. 질의 시 현재 사용자·그룹·Tenant 권한과 ACL 후보를 교집합으로 제한한다.
4. Keyword와 Vector 후보를 결합하고 Rerank한다.
5. 응답에는 Source, Version, 검색 시각과 원본 Link를 남긴다.
6. Source 삭제·권한 변경 Event는 Index와 Cache에 전파하고 지연 SLO를 측정한다.

R0의 빈 Agent DB에 과거 `rag_chunk`나 Vector Table을 되살리지 않는다. 첫 Knowledge
Source와 Embedding Model, 언어별 평가 Dataset이 확정된 뒤 Migration으로 생성한다.
Pilot 규모에서는 PostgreSQL Full Text Search와 `pgvector`를 후보로 검증한다.
`pgvector` 확장 객체는 제품 Table이 아니므로 Extension 도입 시 별도 Inventory와
Upgrade 절차로 관리한다. 대규모 Tenant 격리, 검색 지연 또는 운영 요구가 한계를 넘을
때 전용 Search Engine을 비교한다.

### Search Evaluation Gate

- 한국어·영어 질의별 Recall@K, nDCG와 Citation Precision
- 무권한 문서 노출 0건
- 삭제·ACL 변경 전파 SLO
- P95 검색·첫 응답 지연과 Query당 비용
- 최신성, 중복, 깨진 Link와 Answer Abstention

## 7. ADR-012 Workflow와 Agent Runtime 분리

승인, SLA, Timer, Retry, Compensation과 장기 실행 상태는 Durable Workflow가
소유한다. LLM의 계획과 응답은 재실행 때 동일함을 보장할 수 없으므로 Workflow
History의 결정적 분기 자체로 사용하지 않는다.

- Workflow: 상태 전이, 승인 대기, Timeout, Retry Policy, Idempotency,
  Compensation과 최종 업무 결과
- Agent Runtime: 의도 해석, 근거 검색, 계획 후보, Model 호출과 Tool 입력 후보
- Tool Gateway: 실행 직전 Policy, Schema Validation, Credential Binding과 Audit
- Human Task: 승인자, Delegation, 만료, 반려 이유와 재승인 조건

Temporal 같은 Code-first Durable Execution과 BPMN 계열을 R0 Spike에서 비교한다.
Spring·Python SDK 적합성, 사람 승인 가시성, Version Migration, Self-host/Cloud,
HA·DR, 운영 인력, License와 3년 TCO를 평가하기 전 Runtime Dependency를 추가하지
않는다. 어떤 제품을 택해도 Domain Layer는 `WorkflowPort`로 격리한다.

## 8. ADR-013 Agent Control Plane

### Registry

- Agent: ID, Owner, Version, 목적, 허용 Tenant, 상태와 평가 Version
- Tool: Schema Version, Owner, Risk Tier, Scope, Timeout, Idempotency와 보상 가능성
- Model Route: 목적, Data Class, Region, 최대 비용·지연과 Fallback
- Policy: 사용자·Agent Identity, 업무 Context, Tool, Target과 승인 조건

### Risk Tier

| Tier | 예시                         | 기본 통제                                      |
| ---- | ---------------------------- | ---------------------------------------------- |
| L0   | 공개 도움말·비민감 조회      | 자동 실행, Source 표시                         |
| L1   | 권한 내 개인 업무 조회·초안  | 자동 실행 가능, Trace·취소 제공                |
| L2   | 외부 시스템 변경·메시지 전송 | Plan Preview와 명시적 사용자 승인              |
| L3   | 권한·급여·삭제·대량 변경     | 분리된 승인, 강한 인증, 제한된 Tool, 사후 검토 |

Agent가 계획한 Tool Name과 Argument를 그대로 신뢰하지 않는다. 실행 직전에 현재 권한,
Risk, Target, 변경량과 승인 Binding을 다시 검증한다. 승인 Token은 Plan Hash, Tool
Version, Target과 만료 시각에 묶으며 입력이 바뀌면 재승인을 요구한다.

Model Gateway는 Provider별 API를 숨기고 Data Residency, Model Allowlist, 예산,
Rate Limit, Retry, Content Policy와 Fallback을 중앙 통제한다. Prompt·Agent·Tool과
Evaluation Version을 배포 Artifact로 관리한다.

## 9. ADR-014 Observability와 Audit

분산 Trace와 법적·운영 Audit의 목적을 분리한다.

- Trace: `traceId`, 요청·Workflow·Agent Run·Model·Retrieval·Tool Span, 지연·오류·비용
- Audit: 누가, 어떤 Tenant에서, 어떤 권한·승인으로, 무엇을, 언제, 어떤 결과로
  변경했는지 남기는 Append-only Event
- Product Analytics: 사용자의 Journey 성공과 탐색·처리시간

OpenTelemetry Semantic Convention을 기준으로 HTTP, Messaging, DB와 GenAI Span을
연결한다. 다만 GenAI Convention의 Development 상태 필드는 내부 Versioned Mapping을
두고 직접 영구 계약으로 고정하지 않는다. Prompt, Tool Argument, 검색 문서와 Model
Output은 민감할 수 있으므로 기본 Trace에서 원문을 제외하고 명시적 Redaction·Sampling
정책을 거친다.

## 10. ADR-015 MCP와 A2A 도입 경계

- MCP: Agent가 Tool·Resource를 사용하는 경계
- A2A: 독립 Agent 시스템 간 발견, Task 위임과 Artifact 교환 경계
- 내부 함수 호출, Domain API와 Event를 프로토콜 유행에 맞춰 전부 치환하지 않는다.
- R1은 단일 DWP Agent Runtime과 MCP Tool Adapter만 허용한다.
- A2A는 외부 Agent 또는 독립 팀 Agent 간 상호운용 요구, 신뢰 경계, Agent Card,
  Version·Authentication·Task Lifecycle Test가 있을 때 도입한다.

## 11. R0 Spike와 Exit Evidence

| Spike | 입력                              | 종료 증거                                                    |
| ----- | --------------------------------- | ------------------------------------------------------------ |
| C1    | 첫 Productivity Connector         | 위임 Auth, Read, Rate Limit, Health와 감사 Demo              |
| C2    | 첫 System of Record 저위험 Action | Plan Hash 승인, Idempotency, 실패·Retry·Compensation Demo    |
| S1    | 실제 Knowledge 500~5,000건        | ACL 0건 누출, 검색 품질·지연·삭제 전파 Report                |
| W1    | 승인과 Timer가 있는 장기 Journey  | 재시작 복구, 중복 0건, Version 배포와 운영 TCO 비교          |
| A1    | L0·L1 Agent                       | Registry, Model Route, Citation, Trace, Budget와 Eval Report |

Contract Spike 1에서는 위 제품 Spike의 선행 조건인 Provider 중립 Java Port, Gateway의
Session·CSRF·Identity Relay와 deterministic L2 Plan Preview를 구현했다. 외부 Model과
Tool 없이 Audit·Human Gate를 검증했으며 상세 증적은
`R0 Contract Spike 1 - Governed Plan Preview.md`에 기록한다. C1·S1·W1·A1의 실제
Exit Evidence는 아직 충족하지 않았으므로 완료 처리하지 않는다.

Contract Spike 2에서는 Gateway→Agent Service Identity, 승인 Binding용 SHA-256 Plan
Hash, Correlation 연결과 원문을 제외한 구조화 Audit Event를 구현했다. 로컬 Shared
Secret은 계약 검증용이며 운영 배포 전 Workload Identity 또는 mTLS, Network Policy와
Secret Rotation으로 교체한다. 상세 증적은
`R0 Contract Spike 2 - Service Trust and Plan Integrity.md`에 기록한다.

R0에서는 위 계약을 검증하기 위한 최소 Fixture만 만든다. 디자인 파트너와 첫 Journey가
정해지기 전에 제품 메뉴, 업무 Table, Connector SDK와 Multi-agent Framework를 대량으로
생성하지 않는다.

## 12. 참고 자료

- [MCP Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
- [MCP Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [A2A Protocol 1.0 Specification](https://a2a-protocol.org/latest/specification/)
- [CloudEvents](https://cloudevents.io/)
- [Temporal Documentation](https://docs.temporal.io/)
- [pgvector](https://github.com/pgvector/pgvector)
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [OpenID Shared Signals and CAEP](https://openid.net/wg/sharedsignals/)
- [OWASP Agentic Security Initiative](https://genai.owasp.org/)
- [NIST SP 800-207 Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final)
- [RFC 8705 OAuth Mutual TLS](https://datatracker.ietf.org/doc/html/rfc8705)
