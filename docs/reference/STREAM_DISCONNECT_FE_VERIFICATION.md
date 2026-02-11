# 스트림 끊김 원인 확인 — 프론트엔드 검토 결과

스트림 끊김 원인 확인 요청에 대한 FE 측 검토 결과입니다.

## 원인 및 수정 (FE가 먼저 연결을 닫는 경우)

**원인**: `useAnalysisRunStream`의 **useEffect cleanup**에서 `AbortController.abort()`를 **즉시** 호출하고 있었습니다.  
React 18 **Strict Mode**에서는 mount → unmount → remount가 빠르게 일어나므로, 스트림을 연 직후 cleanup이 실행되면 FE가 연결을 끊어 BE에서 `IllegalStateException`이 발생할 수 있습니다.

**수정**: cleanup 시 abort를 **즉시 하지 않고 지연(500ms)** 후 실행하고, **remount 시** 이전 cleanup에서 예약한 abort 타이머를 **취소**하도록 변경했습니다.  
- 실제 네비게이션(페이지 이탈) 시에는 remount가 없으므로 500ms 후 정상적으로 abort됩니다.  
- Strict Mode 등으로 remount되는 경우에는 새 인스턴스의 useEffect에서 예약을 취소하므로 스트림이 유지됩니다.  
- **BE 상관 분석**(Gateway + SynapseX 로그): 첫 줄(12바이트) 수신 직후 1ms 내 "SSE proxy client disconnected" → FE가 연결을 끊은 것으로 확인됨. 120ms 지연일 때 unmount 시 예약한 abort가 remount effect 실행 전에 fire했을 가능성이 있어, 지연을 **500ms**로 늘려 remount 시 취소가 우선되도록 함.

---

## 1. 스트림을 끊는 조건

### 1.1 사용 방식: EventSource 아님, fetch + ReadableStream

- **EventSource 미사용**: 코드베이스에서 `EventSource`는 사용하지 않습니다.
- **사용 방식**: 모든 스트림은 `fetch(url, { signal })` 후 `response.body.getReader()`로 `ReadableStream`을 읽습니다.

### 1.2 FE에서 연결을 끊는 경우

| 조건 | 동작 | 파일 예시 |
|------|------|-----------|
| 사용자 취소 | `AbortController.abort()` 호출 | 모든 스트림 훅의 `cancel()` |
| 컴포넌트 언마운트 | `useEffect` cleanup에서 `abortController.abort()` | use-analysis-run-stream, use-synapse-agent-stream, use-agent-stream |
| **첫 이벤트 수신 후 즉시 close/재연결** | **해당 없음** | — |

### 1.3 첫 이벤트/첫 데이터 수신 직후 close · abort · 재연결 여부 (확인 결과)

**질문**: EventSource / fetch 스트림에서 **첫 이벤트 또는 첫 데이터 수신 직후** `close()` / `abort()` / 재연결 로직이 있는지, “첫 청크 오면 끊기” 같은 처리가 있는지.

**확인 결과**:

| 항목 | 결과 | 근거 |
|------|------|------|
| EventSource 사용 | **미사용** | 코드베이스 전체에 `EventSource` 없음. 모든 스트림은 `fetch` + `getReader()`. |
| 첫 청크/첫 줄 수신 시 `close()` | **없음** | `reader.close()` 호출 nowhere. |
| 첫 청크/첫 줄 수신 시 `abort()` | **없음** | `use-analysis-run-stream.ts`에서 `chunkIndex === 1`일 때 하는 일은 **LOG + addEventLogLine** 뿐. `abortControllerRef.current.abort()` 호출 없음. |
| 첫 이벤트 수신 시 재연결 | **없음** | 재연결은 `use-agent-stream` / `use-synapse-agent-stream`의 **에러/실패 경로**에서만 수행. 첫 데이터 수신 직후 재연결 로직 없음. |
| “첫 청크 오면 끊기” 처리 | **없음** | 첫 청크 분기(`chunkIndex === 1`)에서는 로그만 찍고, `return`/`break`/`abort` 없이 **for → while 루프 계속** → 다음 `reader.read()` 호출. |

**코드 기준 (use-analysis-run-stream.ts)**:

- 첫 청크: `if (chunkIndex === 1) LOG('first chunk received', ...)` → 이후 `buffer += decoder.decode(...)`, 라인 파싱, `addEventLogLine(trimmed)` 등만 수행.
- 첫 줄 로그: `if (chunkIndex === 1) LOG('first line (from first chunk)', trimmed.slice(0, 80))` → **로그만**, 연결 종료/abort 없음.
- `: connected`, `event:`, `data:` 등 첫 줄은 파싱 분기에서 **return/break 하지 않음**. `[DONE]` / `event: completed` / `event: failed` 수신 시에만 `return` (정상·실패 종료).

**결론**: 스트림을 유지하는 코드만 있으며, **“첫 이벤트 또는 첫 데이터 수신 직후 close/abort/재연결” 또는 “첫 청크 오면 끊기” 같은 처리는 없습니다.**

---

### 1.4 첫 이벤트 후 close/재연결 여부 (요약)

- **없음**: `event: started` 또는 첫 `data:` 수신 후에 연결을 끊거나 재연결하는 코드는 없습니다.
- BE가 보내는 첫 줄 `: connected`(SSE 주석)는 `addEventLogLine`으로만 남기고, `event:`/`data:`가 아니므로 파싱 분기에서 **return/break 하지 않습니다**.
- `started` / `step` / `agent` 이벤트는 로그·UI 상태만 갱신하고, `reader.read()` 루프는 계속 진행합니다.
- 정상 종료는 다음일 때만 발생합니다.
  - `event: completed` 또는 `data: [DONE]` 수신 시 → 상태를 `COMPLETED`로 두고 `return` (루프 종료).
  - `event: failed` 수신 시 → 에러 상태 설정 후 `return`.

**과거 원인**: cleanup에서의 즉시 `abort()` 호출이 Strict Mode unmount 시 스트림을 끊었음. → cleanup 시 abort 지연(500ms) + remount 시 예약 취소로 수정함.

### 백엔드 상관 분석 참고 (Gateway + SynapseX)

- **타임라인**: GET .../stream → SSE started → Aura 첫 줄(12바이트) 수신 → **같은 ms(42.208→42.209) 내** "SSE proxy client disconnected".
- **결론**: 연결을 끊은 쪽은 클라이언트(FE). BE는 스트림 유지 중 클라이언트 끊김에 따라 정상 종료.
- **FE 권장 확인**(BE 제안): (1) 수정한 스트림 코드 경로가 실제로 타는지, (2) 첫 이벤트/첫 청크 수신 시 close 또는 unmount 유발 여부, (3) onerror/onmessage에서 즉시 close 여부, (4) 동일 연결을 닫는 다른 훅/컴포넌트 여부. → 위 항목은 본 문서에서 검토 완료. 추가로 cleanup 지연을 500ms로 확대 적용.

### FE 콘솔 로그 분석 (front.txt 및 runId 254b2b5b 동기 테스트)

추가한 `[AnalysisStream]` 로그를 수집한 런들에서 공통으로:

- **FE는 abort를 호출하지 않음.**  
  `delayed abort fired`, `cancel() called`, `catch: AbortError` 로그가 없음.
- **스트림 종료**: `reader.read()`가 **done=true**로 반환됨 → 브라우저는 “스트림이 서버 쪽에서 종료됨”으로 인식.  
  (FE에서 `abort()`를 호출했다면 `reader.read()`는 reject → `AbortError`로 catch됨.)

**runId 254b2b5b 동기 테스트** (백엔드 back.txt와 동일 runId):

| 시각 (FE 콘솔) | 로그 |
|----------------|------|
| 08:10:49.174 | cleanup: unmount — scheduling delayed abort in ms 500 |
| 08:10:49.178 | **remount: clearing scheduled cleanup abort (stream will stay open)** |
| 08:11:13.185 | startStream: created new AbortController { caseId: '85116' } |
| 08:11:14.789 | startStream: fetch start { url: '.../254b2b5b.../stream' } |
| 08:11:15.781 | startStream: fetch response ok true |
| 08:11:16.344 | first chunk received { byteLength: 5 } |
| 08:11:16.351 | **reader.read() done=true — stream ended by server** |
| 08:11:16.358 | reader loop exited without done (...) |

- **Strict Mode**: unmount 후 4ms 만에 remount되어 예약된 abort가 **취소**됨 → 해당 시점에는 스트림이 없으므로 정상.
- **스트림 시작**: 사용자가 약 24초 후 분석 시작 → fetch → 첫 청크(5바이트) 수신 → **바로 다음 read()에서 done=true** (7ms 이내).  
  즉 FE 관점에서는 **연결이 상대 쪽에서 끊어진 뒤** done으로 종료된 것임.
- **BE back.txt 요약**: 동일 runId 기준 SynapseX는 Aura에서 첫 줄(12바이트) 수신 후 클라이언트로 전달하려다 `emitter.send()`에서 IllegalStateException, “SSE proxy client disconnected while forwarding”.  
  BE 결론: “첫 SSE 청크를 전송하기 전에 이미 클라이언트(Gateway/FE) 쪽 연결이 끊어짐”.

**FE 결론 (동일 runId 기준)**:

- 이 runId에서 FE는 **abort()를 호출하지 않았고**, **done=true**로 스트림 종료만 인지함.
- 따라서 “클라이언트가 끊었다”는 BE 관찰과, “서버/연결이 끊겨서 done=true”라는 FE 관찰을 동시에 만족하는 해석은:  
  **Gateway(또는 FE↔Gateway 구간)가 첫 청크 전달 직후 연결을 닫고, SynapseX에는 그 결과가 “client disconnected”로 보인다**는 시나리오가 타당함.
- 권장: Gateway 로그에서 `SSE stream cancelled by client` vs `SSE stream completed by downstream` 및 첫 청크 전달 직후 연결 종료 유발 조건(타임아웃, 버퍼링 정책 등) 점검.

### 백엔드 전달 문서 요약 (back.txt — runId 254b2b5b)

- **타임라인**: POST analysis-runs → GET .../stream → SSE stream started → SynapseX가 Aura에서 첫 줄(12바이트) 수신 → **첫 청크를 클라이언트로 보내기 직전** `emitter.send()`에서 IllegalStateException, “SSE proxy client disconnected while forwarding” (totalBytesForwarded=12, lineCount=1).
- **BE 결론**: “첫 번째 청크를 보내기 전에 이미 연결이 끊어진 상태”. 끊는 쪽 = Gateway 또는 FE. SynapseX 관점에서 “client” = Gateway.
- **BE 권장 확인**: (1) FE: 해당 runId/시각에 abort·cleanup·unmount 여부. (2) Gateway: 동일 runId로 `SSE stream cancelled by client` vs `SSE stream completed by downstream` 수집해 끊김 방향 재확인.  
  → FE 측은 위 동기 테스트 콘솔로 **abort/cleanup 없음** 확인함. Gateway 구간 점검 권장.

---

## 2. 에러 처리

### 2.1 fetch 단계 에러 (연결 전)

- `fetch()` 자체가 실패하는 경우(예: **restricted header name: "Connection"**, 네트워크 오류, CORS):
  - 요청이 실패하므로 **스트림 연결은 수립되지 않음**.
  - `catch` 블록에서 `setStatus('ERROR')`, `setError(message)`, `onError(...)` 호출.
  - `AbortController`로 “연결 끊기”를 따로 호출할 필요 없음 (요청이 성공하지 않았음).

### 2.2 스트림 수신 중 에러

- `reader.read()`에서 예외가 나면 같은 `catch`로 빠져서:
  - `setStatus('ERROR')`, `setError(message)`, `onError(...)` 호출.
- 이때는 이미 연결이 끊어진 상태이고, FE는 그 사실을 UI/상태로만 반영합니다.

**결론**: 에러가 나면 상태만 `ERROR`로 두고 `onError`를 호출하며, “에러 시 연결을 닫는” 별도 close 호출은 없습니다. (fetch 실패 시에는 연결 자체가 없고, read 중 에러 시에는 스트림이 이미 끊긴 상태입니다.)

---

## 3. Connection 헤더 사용 여부 (재확인)

### 3.1 단일 정의: `buildStreamRequestHeaders`

- 스트림용 요청 헤더는 **한 곳**에서만 정의됩니다.
- **파일**: `libs/shared-utils/src/agent/stream-request-headers.ts`
- **함수**: `buildStreamRequestHeaders(options)`
- **설정하는 헤더**:
  - `Accept: 'text/event-stream'`
  - `X-Tenant-ID`, `X-Trace-ID`
  - (선택) `Content-Type: application/json'`, `Authorization`, `X-Agent-ID`, `X-User-ID`, `Last-Event-ID`
- **Connection 헤더**: **설정하지 않음** (코드에 없음).  
  JSDoc에 “Connection은 restricted header name이므로 넣지 않는다”고 명시되어 있습니다.

### 3.2 스트림 호출부 사용 현황

| 위치 | 사용 여부 |
|------|-----------|
| `use-analysis-run-stream.ts` (analysis-runs stream) | `buildStreamRequestHeaders({ tenantId, token })` 사용 |
| `use-synapse-agent-stream.ts` | `buildStreamRequestHeaders({ ... })` 사용 |
| `use-agent-stream.ts` | `buildStreamRequestHeaders({ ... })` 사용 |
| `apps/dwp` — aura-mini-overlay.tsx | `buildStreamRequestHeaders({ ... })` 사용 |
| `apps/dwp` — use-ai-workspace.ts | `buildStreamRequestHeaders({ ... })` 사용 |

- 위 경로들에서 **스트림 요청 시 Connection 헤더를 넣는 코드는 없습니다.**

**결론**: FE에서는 스트림 API 호출 시 **Connection 헤더를 전혀 보내지 않습니다.**

---

## 4. CORS / 프록시 (Gateway, Nginx)

- **FE에서 확인 불가**: Gateway, Nginx, 리버스 프록시의 버퍼링·타임아웃·CORS 설정은 서버/인프라 측 설정입니다.
- **권장**: 스트림 끊김이 계속되면 백엔드/인프라에서 다음을 점검하는 것이 좋습니다.
  - 스트림 응답에 대한 **버퍼링 비활성화** (예: `X-Accel-Buffering: no`, `proxy_buffering off` 등).
  - 스트림 구간 **타임아웃 완화** (예: 30분 이상).
  - **CORS**에서 `Accept: text/event-stream` 및 필요한 커스텀 헤더 허용 여부.

---

## 5. 요약 표

| 확인 항목 | FE 결론 |
|-----------|---------|
| 첫 이벤트만 받고 close/재연결하는 코드 | **없음** |
| EventSource 사용 | **미사용** (모두 fetch + getReader) |
| 에러 시 연결 종료 처리 | 에러 시 상태만 설정, 별도 close 없음 (fetch 실패 시에는 연결 없음) |
| Connection 헤더 전송 | **하지 않음** (buildStreamRequestHeaders만 사용, Connection 미포함) |
| CORS/프록시 설정 | **FE 범위 밖** — BE/인프라 점검 필요 |

---

*문서 작성일: 2025-02 기준, 코드베이스 검토 결과*
