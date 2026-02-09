# Aura(aura.txt) · BE(back.txt) Phase2 Q&A 검토 및 추가 질문

> **대상**: FE 팀 → Aura/BE 담당자에게 전달  
> **작성일**: 2026-02-09  
> **목적**: 두 문서 검토 후 중복 정리, 불명확한 부분 추가 질문 정리

---

## 1. 중복·일치 정리

| 항목 | aura.txt | back.txt | 비고 |
|------|----------|----------|------|
| **진입점** | FE → BE만 호출 | BE를 진입점으로 사용 | ✅ 동일 |
| **분석 트리거** | `POST /api/synapse/cases/{caseId}/analysis-runs` | 동일 | ✅ 동일 |
| **스트림** | BE 기본 / Aura 선택 | 동일 | ✅ 동일 |
| **분석 결과** | `GET /api/synapse/cases/{caseId}/analysis` | 동일 | ✅ 동일 |
| **액션 제안** | `GET /api/synapse/cases/{caseId}/action-proposals` | 동일 | ✅ 동일 |
| **승인/거절** | `.../action-proposals/{proposalId}/approve`, `.../reject` | 동일 | ✅ 동일 |
| **프록시** | FE가 BE만 사용 시 `/api/aura/**` 불필요 | Gateway에 `/api/aura/**` 이미 설정됨 | ⚠️ 관점 차이 (아래 참고) |
| **DEMO 모드** | 간단 언급 | BE SYNAPSE_DEMO_MODE, Aura DEMO_OFF 상세 | back.txt가 더 구체적 |

### 프록시 관련 관점 차이

- **aura.txt**: "FE가 BE만 사용하면 /api/aura/** 프록시 불필요", "Aura 상세 스트림 쓰려면 필요"
- **back.txt**: "Gateway에 이미 설정됨, 별도 Host 설정 불필요"

→ **결론**: FE가 BE 스트림만 사용하는 기본 플로우에서는 `/api/aura/**` 설정 여부와 무관. Aura 상세 스트림 사용 시 Gateway에 이미 라우팅되어 있으므로 추가 설정 불필요. **추가 질문은 없음.**

---

## 2. Aura 담당에게 보낼 추가 질문

### Q1. SSE 스트림 이벤트 형식

- BE 스트림 `GET /api/synapse/analysis-runs/{runId}/stream`의 이벤트 형식이 아래와 맞는지 확인 부탁드립니다.
  - `event: started` / `event: completed` / `event: failed`
  - `data:` 필드 JSON 스키마 (예: `{ status, runId, message? }` 등)
- FE에서 진행률 표시 바 / 단계별 UI를 구현하려면 각 이벤트별 `data` 필드 spec이 필요합니다.

### Q2. Aura 상세 스트림 이벤트 spec

- Aura 스트림 `GET /api/aura/cases/{caseId}/analysis/stream?runId={runId}` 사용 시:
  - `step`, `evidence`, `confidence`, `proposal` 이벤트의 `data` JSON 예시를 주시면 FE 설계에 도움이 됩니다.
- 향후 Phase2+에서 상세 스트림 도입 시 참고용으로 필요합니다.

### Q3. DEMO 모드 시 Aura 동작

- `DEMO_OFF` 시 Aura가 `{"status":"disabled"}` 반환한다고 하셨는데, 이 경우 BE가 이를 어떻게 처리하는지(그대로 FE에 전달하는지, fallback 응답으로 대체하는지)를 알고 싶습니다.
- FE에서 DEMO 모드일 때 별도 분기 처리가 필요한지 판단하려 합니다.

---

## 3. 백엔드(BE) 담당에게 보낼 추가 질문

### Q1. action-proposals vs case detail의 relatedActions

- 현재 FE는 case detail(`GET /api/synapse/cases/{caseId}`)의 `relatedActions` 또는 `action.actions`를 사용합니다.
- Phase2에서는 `GET /api/synapse/cases/{caseId}/action-proposals`를 사용하도록 변경 예정입니다.
- **질문**: 두 API의 관계가 어떻게 되나요?
  - (A) action-proposals가 relatedActions를 대체하고, case detail의 relatedActions는 deprecated 예정인가요?
  - (B) 둘은 별도 용도(예: proposals = 분석 결과 제안, relatedActions = 이미 실행된 액션)인가요?
  - (C) action-proposals 항목에 `actionId`가 포함되어, 기존 `approveAction(actionId)`와 연동 가능한가요?

### Q2. proposalId vs actionId

- 승인/거절 시 `proposalId`를 사용하는데, FE에서는 기존에 `action.id`를 사용 중입니다.
- **질문**: `action-proposals` 응답의 각 항목에 `proposalId`(또는 `id`)가 담기나요? 그리고 `actionId`가 따로 존재하는지, proposalId와 actionId 매핑 방식은 어떻게 되나요?

### Q3. action-proposals 응답 스키마

- FE 연동을 위해 `GET /api/synapse/cases/{caseId}/action-proposals` 응답 스키마를 필요합니다.
- 예: `{ items: [{ proposalId, actionType, description, status, confidence?, evidence? }] }` 형태인지, 필수/선택 필드 목록을 알려주시면 감사하겠습니다.

### Q4. DEMO 모드 시 스트림 이벤트

- `SYNAPSE_DEMO_MODE=true` 시 즉시 완료 + 샘플 데이터 반환된다고 하셨습니다.
- **질문**: DEMO 모드에서 `GET /api/synapse/analysis-runs/{runId}/stream`을 구독할 때, 실제 운영과 동일한 이벤트 순서(started → completed) 및 `data` 형식으로 내려오나요? FE에서 동일 코드로 처리 가능한지 확인하고 싶습니다.

### Q5. analysis 결과와 runId 관계

- `GET /api/synapse/cases/{caseId}/analysis`가 `case_analysis_result`의 최신 run 기준인지 확인이 필요합니다.
- **질문**: 한 케이스에 여러 analysis run이 있을 수 있다면, 현재 `/analysis` 응답은 어떤 run을 기준으로 하나요? (최신 run, 최신 완료 run 등) runId를 쿼리 파라미터로 받아 특정 run 결과를 조회하는 API가 있는지도 궁금합니다.

---

## 4. FE 수정 방향 (유지)

| 항목 | 현재 FE | Phase2 (권장) |
|------|---------|---------------|
| 분석 트리거 | `POST /api/synapse/agent-tools/agents/finance/stream` | `POST /api/synapse/cases/{caseId}/analysis-runs` |
| 스트림 | 위 API에서 SSE 직접 수신 | `GET /api/synapse/analysis-runs/{runId}/stream` (streamUrl) |
| 액션 제안 | case detail의 `action.actions` | `GET /api/synapse/cases/{caseId}/action-proposals` |
| 승인/거절 | `.../actions/{actionId}/approve`, `.../reject` | `.../action-proposals/{proposalId}/approve`, `.../reject` |

추가 질문 답변을 받은 후 위 변경 작업을 진행할 예정입니다.

---

*작성: FE 팀*
