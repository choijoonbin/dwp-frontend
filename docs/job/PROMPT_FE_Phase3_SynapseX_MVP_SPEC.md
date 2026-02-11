# DWP SynapseX Phase3 (FE) 실행 프롬프트 — 2주(MVP) + 4주(고도화)

목적: Case Detail에서 "Agentic 분석(스트림)" + "AI 분석" + "액션제안"을 Phase3 기준으로 완성한다.

---

## 핵심 합의(이번 라운드 고정)

1. **POST /api/synapse/cases/{caseId}/analysis-runs** 응답은 BE가 **202로 통일**하는 방향(권장).  
   - 단, FE는 **200/202 모두 처리 가능**하게 구현(하위호환).
2. 응답의 **streamUrl은 "BE 스트림 URL이 아니라 Aura SSE URL"**이어야 한다.  
   - FE는 **반드시 streamUrl 그대로** EventSource/fetch 연결한다.
3. 분석 결과/제안은 **BE 저장 후** FE는 **BE 조회 API**로 렌더링한다.

---

## A. 필수 기능(2주 MVP)

### 1) 분석 실행

- **버튼**: "분석 시작"
- **동작**:
  - a) POST /api/synapse/cases/{caseId}/analysis-runs
  - b) 응답의 runId 저장
  - c) 응답의 **streamUrl 그대로** SSE 연결(fetch ReadableStream 또는 EventSource)
  - d) SSE **completed** 수신 시:
    - GET /api/synapse/cases/{caseId}/analysis?runId=...
    - GET /api/synapse/cases/{caseId}/action-proposals?runId=...
    - 자동 refetch해서 탭 결과가 바로 보이게

### 2) 에이전트 스트림 탭(UI/UX)

- **상태**: IDLE / RUNNING / COMPLETED / FAILED
- **이벤트 표준**:
  - `event: started | step | agent | completed | failed`
  - step data: `{ label, detail, percent }`
  - agent data: `{ agent, message, percent }`
- **UI**:
  - 진행률 bar(percent)
  - **최근 이벤트 로그 200줄** 저장/표시
  - "재시도" 버튼: 새 run 생성(새 runId) + 새 streamUrl 연결
- **주의**:
  - 탭 이동/언마운트 시 EventSource cleanup(메모리 누수 금지)
  - **streamUrl을 BE URL로 잘못 붙는 실수 재발 방지**(그대로 사용)

### 3) AI 분석 탭

- **렌더**:
  - score(%), severity, reasonText
  - evidence 리스트
  - **ragRefs 리스트**(최소 sourceType / sourceKey / excerpt / score 표시)
- run 선택(고도화 W3~4): 최신/이전 실행 드롭다운

### 4) 액션제안 탭

- **조회**: GET /api/synapse/cases/{caseId}/action-proposals?runId=...
- **중복 정책**:
  - BE가 UNIQUE(run_id, fingerprint)로 1차 차단
  - FE도 **fingerprint 기준**으로 중복 렌더 방지
  - 구현: fingerprint로 groupBy 후 최신 createdAt 1개만 표시 (+ "N회 생성됨" optional)
- **CTA**:
  - "해결 처리" → decision=APPROVE
  - "무시 처리" → decision=REJECT
  - "실행(시뮬)" → execute API
- **처리 후**: proposals/analysis refetch, 필요시 감사로그 화면 링크

---

## B. FE가 의존하는 API 스키마(예시)

### 1) POST analysis-runs (200/202 둘 다 처리)

```json
{
  "status": "SUCCESS",
  "data": {
    "runId": "c05dfe94-29e9-4cba-8da7-55639ca6f8c9",
    "status": "STARTED",
    "streamUrl": "http://aura-host/aura/cases/85115/analysis/stream?runId=c05dfe94-29e9-4cba-8da7-55639ca6f8c9",
    "startedAt": "2026-02-09T12:38:43.938Z"
  }
}
```

### 2) SSE (Aura)

```
event:started
data:{"runId":"...","status":"started"}
event:step
data:{"label":"Normalize evidence","detail":"","percent":20}
event:agent
data:{"agent":"PolicyAgent","message":"...","percent":70}
event:completed
data:{"runId":"...","status":"completed"}
```

### 3) GET analysis

```json
{
  "status": "SUCCESS",
  "data": {
    "runId": "...",
    "score": 72.0,
    "severity": "MEDIUM",
    "reasonText": "정책 위반 가능성이 있는 전표 조합입니다.",
    "evidence": [{"key":"중복 지급 의심"},{"key":"벤더 계좌 변경 직후 지급"}],
    "ragRefs": [{"refId":"ref-1","sourceType":"POLICY","sourceKey":"POLICY-AP-72H","excerpt":"...","score":0.83}]
  }
}
```

### 4) GET action-proposals (fingerprint 필수)

```json
{
  "status": "SUCCESS",
  "data": [
    {
      "proposalId": "074da137-3f7d-4a14-bcca-80e43e83e0cd",
      "runId": "...",
      "type": "HOLD_PAYMENT",
      "status": "PROPOSED",
      "riskLevel": "MEDIUM",
      "rationale": "계좌 변경 72시간 룰 위반 가능",
      "payload": {"companyCode":"1000","docKey":"1000-1900000005-2024","reasonCode":"POLICY_72H_VENDOR_CHANGE"},
      "fingerprint": "hold_payment|1000|1000-1900000005-2024|policy_72h_vendor_change",
      "createdAt": "2026-02-09T09:00:12.003610Z"
    }
  ]
}
```

### 5) decision

- POST /api/synapse/cases/{caseId}/action-proposals/{proposalId}/decision  
- body: `{"decision":"APPROVE"|"REJECT","comment":"optional"}`

### 6) execute(sim)

- POST /api/synapse/cases/{caseId}/actions/execute  
- body: `{"runId":"...","proposalId":"...","mode":"SIMULATION"}`

---

## C. 테스트 시나리오(Phase3 Gate)

1. **정상 E2E**: POST analysis-runs → SSE(step/agent 포함) → completed → analysis/proposals 표시 → decision + execute 성공 → 감사로그 RUN/DECISION/EXECUTE
2. **재시도**: 분석 시작 3회 → runId 별 구분, proposals는 fingerprint 기준 UI 중복 없음
3. **실패**: failed 이벤트 시 실패 표시 + 재시도 가능

---

## D. 현재 구현 vs Phase3 갭(요약)

| 항목 | 현재 | Phase3 요구 |
|------|------|-------------|
| streamUrl | NX_API_URL + streamUrl when relative | **streamUrl 그대로** 사용(절대 URL이면 as-is) |
| POST 200/202 | 200만 명시적 처리 | 200/202 둘 다 성공으로 처리 |
| event: agent | 미처리 | step과 동일하게 percent/label 표시 |
| data: [DONE] | 미처리(스트림 종료 시 실패 처리) | completed로 간주 또는 completed 이벤트 필수 |
| 이벤트 로그 200줄 | 없음(events=[] 하드코딩) | 저장/표시 |
| AI 분석 ragRefs | 미렌더 | sourceType/sourceKey/excerpt/score 표시 |
| 액션 fingerprint | 미사용 | groupBy fingerprint, 최신 1개 표시 |
| decision API | approve/reject (body 없음) | POST .../decision body { decision, comment } |
| execute API | actions/{id}/execute | cases/{caseId}/actions/execute body { runId, proposalId, mode } |
