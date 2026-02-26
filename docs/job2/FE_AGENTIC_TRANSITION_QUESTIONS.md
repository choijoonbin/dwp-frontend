# FE 작업 요청서 — BE 확인 질문

> 자율형 에이전트 전환 작업 진행 전 확인 필요

---

## 확정 사항 (BE 답변 반영)

| 항목 | 확정 내용 |
|------|-----------|
| **근거 사용 여부** | BE 미확정 시 FE는 데이터 없음 유지. BE는 `evidenceLinks[].usage` 또는 `fiDocItems[].evidenceUsage` 중 하나로 확정 필요 |
| **Citation 메타** | `chapter`/`article`/`document`는 BE 확정 필요. 현재 FE는 `chunk_id`/`sourceKey`까지만 표시 |
| **NEEDS_REVIEW** | BE 미반영 시 FE의 `isHoldState` 클라이언트 치환 유지 (COMPLIANT → NEEDS_REVIEW) |
| **Shadow 비교 (P1)** | 별도 API 권장: `GET /cases/{caseId}/shadow-compare?runId=...`. analysis 응답에 섞지 않는 것이 안정적 |
| **SSE vs agent-events** | agent-events API가 저장/재조회용 기준. SSE는 실시간 표시용. FE는 AGENT_EVENT 스키마(`event_type`/`node`/`input_hash`)만 타임라인 표준 사용 |

---

## 1. 분석 단계 탭 — 이벤트 스트림

**요구**: NODE_START, NODE_END, TOOL_CALL, TOOL_RESULT, EVIDENCE_ADDED, EVIDENCE_REJECTED, GATE_APPLIED, COMPLETED, FAILED

**질문**:
- Aura/BE SSE 스트림에서 위 이벤트 타입을 **이미 전송**하고 있나요?
- 전송 중이라면, 이벤트 payload 예시(JSON)를 공유해 주실 수 있나요?
  - 예: `{ event_type, node, decisionCode, summaryMessage, tool?, latency?, evidenceCount? }`

**현재 FE**: `started` / `step` / `agent` / `completed` / `failed` / `evidence` 만 처리 중.

---

## 2. 근거 맵 — "근거 사용 여부" 컬럼

**요구**: 위반 전표 아이템에 USED / REFERENCED / NOT_USED 컬럼

**질문**:
- 이 값을 제공하는 **BE 필드**가 있나요?
  - 예: `evidenceLinks[].usage` 또는 `fiDocItems[].evidenceUsage` 등
- 없다면, BE 추가 예정인가요? 예정 시 필드명·타입을 알려 주세요.

**현재 FE**: `evidenceLinks` = `{ itemIdx, reason?, severity? }` 만 사용.

---

## 3. Citation 메타

**요구**: C1/C2에 문서/장/조/chunk_id 노출

**질문**:
- `citations[]`에 `chapter`, `article`, `document`(문서명) 필드를 BE에서 내려주나요?
- **현재 FE**: `citation_id`, `chunk_id`, `sourceKey`, `excerpt`, `title` 만 사용.

---

## 4. 판단 규정 — NEEDS_REVIEW 충돌 방지

**요구**: "최종판단이 보류면 준수로만 보이지 않게 NEEDS_REVIEW 반영"

**질문**:
- 보류 시(예: POLICY_CONFLICT, RAG_ZERO) `regulationCheckpoints`의 status를 BE에서 **NEEDS_REVIEW로 내려주나요?**
- FE에서 `isHoldState`일 때 COMPLIANT → NEEDS_REVIEW로 **클라이언트 치환**해도 될까요?

---

## 5. Shadow Run 비교 (P1)

**질문**:
- `agent_mode` (Legacy / Shadow / Primary) 및 legacy vs agentic_shadow 비교 데이터를 **어느 API**에서 제공하나요?
- case analysis 응답에 포함인가요, 별도 endpoint인가요?

**확정**: 별도 API 권장. analysis 응답에 섞지 않는 것이 안정적.

### Shadow Compare API 권장 스펙 (BE 구현 시)

```
GET /api/synapse/cases/{caseId}/shadow-compare?runId=...
```

- **비교 항목**: verdict 일치 여부, score 차이, citation 연결률 차이, 보류 코드 차이
- **agent_mode 배지**: Legacy / Shadow / Primary
