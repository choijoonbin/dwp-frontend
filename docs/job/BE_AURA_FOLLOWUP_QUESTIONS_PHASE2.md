# Phase2 — 백엔드/Aura 서버 확인 필요 사항

> FE 연동 완료 후 남은 확인 쿼리. BE/Aura 팀 답변 시 이 문서에 반영 예정.
>
> **2026-02-09**: Aura 답변 반영 완료.  
> **2026-02-09**: BE 답변 반영 완료 (back.txt).

---

## 1. 백엔드 (Synapse) 서버 — BE 답변 반영 완료

### 1.1 action-proposals runId 없을 때 동작

**질문**: `GET /api/synapse/cases/{caseId}/action-proposals` (runId 쿼리 없음) 호출 시 응답은?

- [ ] 최신 completed run의 proposals만 반환
- [x] **모든 run의 proposals 반환 (누적)**

**BE 답변** ✅: **누적** 반환. FE는 `runId`를 항상 전달해 최신 run만 표시하도록 구현 완료.

---

### 1.2 analysis-runs latest=true, run이 없을 때

**질문**: 케이스에 analysis run이 하나도 없을 때 `GET .../analysis-runs?latest=true` 응답은?

- [x] **200 + `{ data: { runId: null } }`**
- [ ] 404 또는 빈 배열

**BE 답변** ✅: 404 아님. 200 + `{ data: { runId: null } }`

---

### 1.3 analysis-runs 응답 스키마 (ApiResponse 래핑)

**질문**: `latest=true` 응답이 `ApiResponse` 래핑인지 확인.

- [x] **`{ data: { runId } }` 형태 맞음**

**BE 답변** ✅: 스키마 확인됨.

---

### 1.4 evidenceSnapshot vs evidence

**질문**: FE→BE body 필드명 및 사용 여부.

**BE 답변** ✅: **현재 둘 다 미사용** → 추후 협의 시 FE용 `evidenceSnapshot` 권장.

- Aura: optional dict, 별도 스키마 없음
- FE: `evidenceSnapshot`으로 전달하는 구현 유지 (추후 BE 사용 시 대비)

---

## 2. Aura 서버 — Aura 답변 반영 완료

### 2.1 status 필드 (STARTED vs ACCEPTED)

**질문**: POST analysis-runs 응답의 `data.status` 값은?

- [x] **`ACCEPTED`** (HTTP 202 의미)

**Aura 실제 반환** (`api/routes/aura_cases.py`):

```json
{
  "status": "ACCEPTED",
  "runId": "...",
  "caseId": "85114",
  "streamUrl": "/aura/analysis-runs/{runId}/stream"
}
```

- **`ACCEPTED`** 사용. HTTP 202(수락됨)를 의미하며, run이 백그라운드에서 시작됨을 나타냄.

---

### 2.2 streamUrl 경로 형식

**질문**: 응답 `streamUrl` 값 형식 확인.

**Aura 답변** ✅:

- Aura 반환값: `streamUrl: "/aura/analysis-runs/{runId}/stream"` (상대 경로)
- FE 사용 시: `{NX_API_URL}` + streamUrl
  - 예: `NX_API_URL = https://gateway.example.com/api` → `https://gateway.example.com/api/aura/analysis-runs/{runId}/stream`
  - 예: `NX_API_URL = https://gateway.example.com` → `https://gateway.example.com/aura/analysis-runs/{runId}/stream`
- **`/api/synapse/...`로 변환할 필요 없음** — BE 스트림과 Aura 스트림은 다른 경로
  - BE 스트림: `GET /api/synapse/analysis-runs/{runId}/stream`
  - Aura 스트림: `GET /api/aura/analysis-runs/{runId}/stream` (Aura 직접, 상세 이벤트)

---

### 2.3 step 이벤트 지원 여부

**질문**: Aura 스트림에서 `event: step` 및 `data: { label, detail, percent }` 지원 여부?

- [x] **지원함**

**Aura 실제 구현** (`core/analysis/phase2_pipeline.py`, `phase2_events.py`):

- 이벤트 순서: `started` → `step` → `evidence` → `confidence` → `proposal` → `completed` | `failed`
- `event: step` 스키마: `{ "label": "EVIDENCE_GATHER", "detail": "증거 수집 중", "percent": 25 }`
- label 예: INPUT_NORM, EVIDENCE_GATHER, RULE_SCORING, LLM_REASONING, PROPOSALS

FE의 `step` 이벤트 기반 진행률 UI는 **Aura 스트림에서 그대로 사용 가능**합니다.

---

## 3. Gateway / Proxy — BE 확인 완료 ✅

### 3.1 streamUrl 라우팅

**BE 전달** (Gateway 구성 적용됨):

| Route ID | Path | 대상 | 비고 |
|----------|------|------|------|
| aura-dashboard-synapsex | `/api/aura/dashboard/**` | synapsex (8085) | order: -1, 우선 적용 |
| aura-platform | `/api/aura/**` | Aura Platform (9000) | StripPrefix=1 |

**GET /api/aura/analysis-runs/{runId}/stream 호출 시**:
- `/api/aura/dashboard/**`에 매칭되지 않음 → aura-platform에 매칭
- StripPrefix=1 → `/aura/analysis-runs/{runId}/stream`으로 변환
- `http://localhost:9000/aura/analysis-runs/{runId}/stream`로 전달

**FE 호출**: `{NX_API_URL}/api/aura/analysis-runs/{runId}/stream` → Gateway를 통해 Aura로 라우팅됨

- Aura 응답 `streamUrl: "/aura/analysis-runs/{runId}/stream"` 사용 시: `{NX_API_URL}`이 `/api`로 끝나면 결합 결과가 `/api/aura/...`가 됨
- response-timeout: 300초 (SSE 스트리밍 지원)
- SseResponseHeaderFilter로 SSE 응답 헤더 설정

---

## 4. 정리 (답변 후 체크)

| # | 항목 | 담당 | 상태 |
|---|------|------|------|
| 1.1 | action-proposals runId 없을 때 | BE | ✅ 누적 반환 (FE는 runId 항상 전달) |
| 1.2 | analysis-runs run 없을 때 | BE | ✅ 200 + `{ data: { runId: null } }` |
| 1.3 | analysis-runs ApiResponse 스키마 | BE | ✅ `{ data: { runId } }` |
| 1.4 | evidenceSnapshot | BE | ✅ 현재 미사용, 추후 evidenceSnapshot 권장 |
| 2.1 | status STARTED vs ACCEPTED | Aura | ✅ ACCEPTED |
| 2.2 | streamUrl 경로 형식 | Aura | ✅ `/aura/analysis-runs/{runId}/stream` |
| 2.3 | step 이벤트 지원 | Aura | ✅ 지원함 |
| 3.1 | streamUrl 라우팅 | Gateway | ✅ `/api/aura/**` → Aura (9000) 적용됨 |

---

---

## 5. BE 추가 전달 (back.txt)

| 항목 | 내용 |
|------|------|
| **evidenceSnapshot** | BE 수용 완료. FE가 보내면 Aura에 전달. 없으면 BE가 DB에서 조회해 전달 |
| **requiresApproval** | proposals[].requiresApproval (Boolean) 추가. FE 승인 플로우 판단용 |
| **streamUrl** | 응답 값 그대로 사용 (하드코딩 금지) |

---

*작성: FE 팀 | Aura 답변: 2026-02-09 (aura.txt) | BE 답변: 2026-02-09 (back.txt) | 참조: AURA_PHASE2_SERVER_CHANGES.md*
