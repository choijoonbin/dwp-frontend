# agent-events API 스펙 (확정)

> GET /api/synapse/cases/{caseId}/agent-events — BE 스펙 반영 완료

## Endpoint

```
GET /api/synapse/cases/{caseId}/agent-events
```

### Query Params

| Param | Type | 설명 |
|-------|------|------|
| runId | optional, UUID | 특정 분석 실행(run)만 조회 |
| latestIfMissing | optional, boolean, default=true | runId 없을 때 최신 run 기준 조회 여부 |

### Headers

- `X-Tenant-ID` (required)
- `X-User-ID` (optional, 권한 범위 체크에 사용)

### 정렬

- `occurred_at` ASC (시간 오름차순)

### runId 없음 + latestIfMissing=true 동작

| 상황 | 응답 |
|------|------|
| 최신 run 이벤트 있음 | 200 + 배열 |
| run 없음 또는 이벤트 없음 | 200 + `[]` |
| 404 | 사용하지 않는 방향 권장 (FE 예외처리 단순화) |

### 최신 run 정의

- caseId 기준 `max(occurred_at)`를 가진 runId
- 동률 시 `created_at` desc 보조

---

## 응답 구조

**중요**: `data`는 `{ events: [...] }`가 아닌 **이벤트 배열 직접 반환**.

```json
{
  "status": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": [
    {
      "event_type": "NODE_START",
      "node": "RAG_RETRIEVAL",
      "tool": null,
      "decision_code": "OK",
      "input_hash": "2f9f7d9b8e7c1a21",
      "output_ref": null,
      "evidence_ids": [],
      "timestamp": "2026-02-27T01:15:10Z",
      "run_id": "9c7f9f9e-1f0b-4cc5-bd58-8d0a5e98f741",
      "case_id": "129",
      "latency_ms": 12,
      "summary_message": "retrieval node started",
      "error_code": null,
      "error_message": null
    }
  ],
  "timestamp": "2026-02-27T01:15:16.123456",
  "success": true
}
```

---

## 이벤트 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| event_type | string | NODE_START, NODE_END, TOOL_CALL, TOOL_RESULT, EVIDENCE_ADDED, EVIDENCE_REJECTED, GATE_APPLIED, COMPLETED, FAILED |
| node | string | 노드 식별자 |
| tool | string \| null | 도구명 (TOOL_CALL/TOOL_RESULT) |
| decision_code | string \| null | 판정 코드 |
| input_hash | string \| null | 중복 제거용 |
| output_ref | string \| null | 결과 참조 (예: s3 경로) |
| evidence_ids | string[] | 근거 ID 목록 |
| timestamp | string | ISO8601 발생 시각 |
| run_id | string | 분석 run UUID |
| case_id | string | 케이스 ID |
| latency_ms | number \| null | 소요 시간(ms) |
| summary_message | string \| null | 요약 메시지 |
| error_code | string \| null | FAILED 시 에러 코드 |
| error_message | string \| null | FAILED 시 에러 메시지 |

---

## FE 적용

- `getAgentEvents` → `ApiResponse<AgentEventItemDto[]>` (data = 배열)
- `useAgentEventsQuery` → 반환값 = `AgentEventItemDto[]`
- `agentEventsToTimelineSteps(agentEventsQuery.data)` — `data`를 직접 전달
