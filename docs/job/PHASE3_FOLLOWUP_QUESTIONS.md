# Phase3 추가 질문 (BE·Aura 전달사항 반영 후)

> back.txt, aura.txt 반영 후 남은 확인 요청. **BE·Aura 답변 수신 후** 갱신.  
> **추가 확인 필요 (최종)**: [PHASE3_HANDOFF_BY_SYSTEM.md §6](PHASE3_HANDOFF_BY_SYSTEM.md) — **Aura ragRefs 콜백 스키마(필드명)** 확정·공유 1건만 남음.

---

## 1. BE (dwp-backend) — 답변 반영 완료

### Q1. POST analysis-runs 응답에 streamPath/streamUrl

- **질문**: FE가 스트림 연결 시 사용할 경로를 **streamUrl**과 **streamPath** 둘 다 수용합니다. BE가 Aura 트리거 응답에서 받은 `streamPath`를 그대로 FE 응답에 넣을 때, 필드명을 **streamUrl**로 할지 **streamPath**로 할지 정해 주시면 FE에서 일관되게 사용하겠습니다.
- **BE 답변**: Phase3 사용 시 **streamPath**를 그대로 내려줌(상대 경로 예: `/aura/cases/{caseId}/analysis/stream?runId=...`). FE는 `res.data?.streamUrl ?? res.data?.streamPath` 수용 중 → **해결.**

### Q2. GET analysis 응답의 ragRefs

- **질문**: Aura 콜백(aura.txt)에 `analysis.ragRefs`가 포함된다고 되어 있습니다. BE가 이를 저장한 뒤 GET analysis 응답의 `data.ragRefs`로 내려주는지, 및 스키마 확인 부탁.
- **BE 답변**: ✅ **제공.** `data.ragRefs`는 case_analysis_result.rag_refs_json을 그대로 반환. Aura 콜백에서 전달한 구조(refId, sourceType, sourceKey, excerpt, score 등) 저장·반환. FE 렌더 준비 완료 → **해결.**

### Q3. 실행(시뮬) 응답 executionId·executedAt

- **질문**: execute 응답에 executionId, executedAt 등 포함 여부, FE에서 실행 완료 메시지 표시 가능 여부.
- **BE 답변**: execute API 제공 완료. 응답 스키마(executionId, executedAt 등)는 BE back.txt·ProposalExecuteResponseDto 기준. FE는 필요 시 카드에 실행 이력 표시 가능 → **해결.**

### Run 목록·과거 run (BE 추가 답변)

- **run 목록**: `GET /api/synapse/cases/{caseId}/analysis-runs` (latest 생략) → `[{ runId, status, startedAt }, ...]` 배열.
- **최신 runId만**: `GET .../analysis-runs?latest=true` → `{ runId }` 단일 객체.
- **과거 run 조회**: `GET .../analysis?runId=`, `GET .../action-proposals?runId=` 에 과거 runId 전달 시 해당 run 결과 반환 가능.
- Run 선택 UI(최신/이전 N개) 구현 시 위 API로 충족 가능 → **해결.**

---

## 2. Aura (aura.txt 기준) — 답변 반영 완료

### Q1. event:completed 전송

- **질문**: Phase3 스트림에서 완료 시 **event:completed** + `data: {"runId":"...","status":"completed"}` 를 보내 주시나요?
- **Aura 답변**: ✅ 스트림 종료 시 **event:completed** + `data: {"runId":"...","status":"completed"}` 를 **먼저** 보내고, 이어서 **data: [DONE]** 을 보냅니다. "가능하면 event:completed 전송"에 맞춰 구현되어 있음. → **해결.**

### Q2. event: agent 및 진행률

- **질문**: event: agent 스키마, step/agent 의 percent를 진행률 바에 사용해도 되는지.
- **Aura 답변**: ✅ Phase3 스트림에서 **event: agent** + `data: { agent, message, percent }` 를 전송. step과 동일하게 진행률(percent) 및 라벨로 표시하면 됨. event: step / event: agent 의 **percent** 값을 진행률 바에 사용하면 됨. → **해결.** (FE 이미 반영됨)

### Q3. failed 이벤트의 retryable

- **질문**: failed 이벤트의 **retryable** 값에 따라 "재시도 가능" 문구를 다르게 보여줘도 될지, **error** 필드를 그대로 에러 메시지로 사용해도 되는지.
- **Aura 답변**:  
  - **retryable**: 값에 따라 "재시도 가능" 문구를 다르게 보여줘도 됨. `true`면 재시도 가능 표시, `false`면 다르게 표시하거나 생략해도 됨.  
  - **error**: 에러 메시지로 그대로 사용해도 됨. Aura가 사람이 읽기 쉬운 문구로 넣음.  
  → **해결.**

---

## 3. 공통 / Gateway

### Q1. 스트림 URL 최종 형태

- **질문**: FE가 (NX_API_URL + streamPath) 조합으로 연결할 때, Gateway에서 /aura/... 를 Aura로 라우팅하는지, 인증이 Gateway를 통해 Aura까지 전달되는지 확인 부탁.
- **Aura 추가 전달**: BE가 내려준 streamPath(또는 streamUrl)에 해당하는 **GET /aura/cases/{caseId}/analysis/stream?runId=** 를 Aura가 그대로 제공. **상대 경로 시 FE에서 NX_API_URL 접두 시 동일하게 연결 가능**하다고 확인됨. → FE 현재 구현과 일치. Gateway 라우팅·인증 전달은 인프라 측 확인 사항으로 유지.
