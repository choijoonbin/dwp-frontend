# 통합 워크벤치 · 자동 SSE 구독이 안 될 때 확인할 것

테스트 데이터 생성 후 통합 워크벤치로 이동했는데 `agent-stream?range=6h&limit=50` 폴링만 보이고 **스트림(SSE) 요청이 하나도 안 보일 때** 아래를 순서대로 확인하세요.

---

## 0. 개발 모드에서 WebSocket 알림이 꺼져 있지 않은지

- **Layout**에서 알림 WebSocket은 **로컬·프로덕션 모두 기본 활성화**됩니다.
- 비활성화하려면 `VITE_NOTIFICATION_WS_ENABLED=false` 로 실행하거나 `.env.local`에 추가하세요.
- 콘솔에 `[Workbench SSE] WebSocket 알림 연결 여부` 로그가 나오며, `enabled: false`이면 위 설정으로 비활성화된 상태입니다. `enabled: true`여야 ANALYSIS_STARTED를 받을 수 있습니다.
- **iframe.html 404** 또는 **WebSocket connection ... failed** 반복 시: 백엔드/게이트웨이에서 SockJS 경로(`/ws/notifications/info`, `**/websocket`, `**/iframe.html` 등) 제공·프록시 여부를 점검하세요. 상세는 `docs/api-spec/synapse-spec/NOTIFICATIONS_BACKEND_RESULT.md` §8.5 참고.

---

## 1. 백엔드가 ANALYSIS_STARTED를 보내는지

- **WebSocket** `/topic/notifications` 구독 후, 테스트 데이터 생성 직후 **ANALYSIS_STARTED** (또는 category/type에 해당) 이벤트가 오는지 확인합니다.
- 브라우저 개발자 도구 → **Network** → **WS** 탭에서 해당 WebSocket 프레임을 열어 payload를 확인합니다.
- payload에 **`case_id`**(또는 `caseId`)가 있어야 합니다.  
  **`run_id`**(또는 `runId`)가 있으면 FE가 `stream_url`이 없을 때  
  ` /api/synapse/analysis-runs/{runId}/stream` 로 자동 연결을 시도합니다.  
  **`stream_url`**(또는 `streamUrl`)이 있으면 그 URL로 바로 연결합니다.

---

## 2. 프론트에서 이벤트를 받았는지 (개발 모드)

- `apps/dwp/src/layouts/dashboard/layout.tsx` 의 **onReceive**에서  
  `ANALYSIS_STARTED` 수신 시 **개발 모드**에서 다음 로그가 나옵니다.
  - `[Workbench onReceive] ANALYSIS_STARTED → pendingAutoStream set`  
    → **stream_url 또는 run_id가 있어서** pendingAutoStream이 설정된 경우.
  - `[Workbench onReceive] ANALYSIS_STARTED but no stream_url nor run_id in payload`  
    → payload에 **stream_url도 run_id도 없음**. 백엔드에서 둘 중 하나는 보내야 합니다.
  - `[Workbench onReceive] ANALYSIS_STARTED but no caseId in payload`  
    → **case_id/caseId가 없음**. 백엔드에서 반드시 포함해야 합니다.

---

## 3. 워크벤치 진입 후 케이스가 선택되었는지

- **통합 워크벤치** 페이지가 로드된 뒤, **왼쪽 큐에서 해당 케이스가 자동 선택**되어 있어야 합니다.  
  (suggestedSelectCaseId → selectedCaseId 로 설정되는지 확인)
- 콘솔에  
  `[Workbench] pendingAutoStream not consumed` + `reason: 'no selectedCaseId'`  
  가 보이면 → 아직 **선택된 케이스가 없음**.  
  (이벤트가 오기 전에 워크벤치에 왔거나, suggestedSelectCaseId가 설정되지 않은 경우)

---

## 4. case_id와 선택된 케이스가 일치하는지

- payload의 **case_id**와 워크벤치에서 **선택된 케이스 ID(selectedCaseId)** 가 **문자열 기준으로 동일**해야 자동 구독이 실행됩니다.
- 콘솔에  
  `[Workbench] pendingAutoStream not consumed` + `reason: 'caseId mismatch'`  
  와 **selectedCaseId**, **pendingCaseId**가 찍힙니다.  
  → 백엔드는 숫자, 프론트는 문자열로 비교하므로 보통은 동일해야 합니다.  
  (다른 케이스를 선택한 상태면 의도적으로 소비하지 않습니다.)

---

## 5. 자동 구독이 실행되면 (개발 모드)

- 콘솔에  
  `[Workbench] auto SSE subscribe`  
  가 보이고, **Network** 탭에  
  `GET .../api/synapse/analysis-runs/{runId}/stream`  
  또는 푸시로 받은 **stream_url** 로 대한 **요청이 한 번** 보여야 합니다.  
  (이벤트 스트림이므로 타입은 보통 **eventsource** 또는 **fetch** 로 표시됩니다.)

---

## 6. 정리: 백엔드 payload 권장 형태

**ANALYSIS_STARTED** 알림 시 **payload**에 최소한 다음을 넣어주세요.

- **case_id** (또는 caseId): 케이스 ID (필수)
- **run_id** (또는 runId): 분석 run ID — 있으면 FE가 `stream_url`이 없을 때  
  `/api/synapse/analysis-runs/{runId}/stream` 로 연결 시도
- **stream_url** (또는 streamUrl): (선택) 있으면 이 URL로 바로 연결

`stream_url`이 없어도 **run_id**만 있으면 프론트에서 위 경로로 자동 연결을 시도합니다.
