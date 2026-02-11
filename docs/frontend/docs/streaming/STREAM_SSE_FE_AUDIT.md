# SSE 스트림 FE 감사 — “FE에서 끊기는지” 확정

**목적**: SSE 스트림 “첫 청크 이후 끊김” 현상에서 FE가 close/abort/reconnect 루프를 발생시키는지 코드 근거로 확정.  
**원칙**: FE는 Aura 직접 연결을 하지 않고, **BE 프록시 SSE만 연결(옵션 B)** 한다.

---

## A. FE 스트림 연결 구현 요약 (필수)

### A.1 스트림 시작 트리거

| 항목 | 내용 | 코드 경로 |
|------|------|-----------|
| 트리거 | 케이스 상세 페이지에서 **사용자 클릭**으로 시작 | `apps/remotes/synapsex/src/pages/cases/components/case-agent-stream-panel.tsx` — "Start Analysis" 버튼 `onClick={onStartAnalysis}` (라인 149 근처) |
| 핸들러 | `handleStartAnalysis` → `startStream(caseId, { onSuccess, payload })` | `apps/remotes/synapsex/src/pages/cases/hooks/use-case-analysis-run-state.ts` 라인 36–48 |
| 훅 | `useAnalysisRunStream()` 의 `startStream` 호출 | `use-case-analysis-run-state.ts` 라인 19, 38 |

**자동 시작**: 없음. 스트림은 **버튼 클릭 시에만** 시작된다.

### A.2 runId 획득 흐름

| 단계 | API / 응답 필드 | 코드 경로 |
|------|------------------|-----------|
| 1 | `POST /api/synapse/cases/{caseId}/analysis-runs` | `libs/shared-utils/src/api/synapse-analysis-api.ts` — `createAnalysisRun(caseId, body)` 라인 38–50 |
| 2 | 응답 `res.data?.runId`, `res.data?.streamUrl`, `res.data?.streamPath` 사용 | `libs/shared-utils/src/agent/use-analysis-run-stream.ts` 라인 135–148 |
| 3 | runId 없으면 예외 | 동일 파일 라인 139–141: `if (!runId) throw new Error('runId not received from analysis-runs')` |

**응답 타입**: `CreateAnalysisRunResponse` — `runId`, `streamUrl?`, `streamPath?` (`synapse-analysis-api.ts` 라인 15–23).

### A.3 실제 SSE 연결 URL (옵션 B)

| 항목 | 내용 | 코드 경로 |
|------|------|-----------|
| 옵션 B(운영) | BE가 **상대 경로(프록시)** 만 내리면 `NX_API_URL` 을 접두해 **항상 BE 프록시로 연결** | `use-analysis-run-stream.ts` 라인 144–152 |
| URL 결정 | `streamUrlOrPath = res.data?.streamUrl ?? res.data?.streamPath ?? \`/api/synapse/analysis-runs/${runId}/stream\`` | 라인 145–148 |
| 최종 url | `http(s)://` 로 시작하면 그대로, 아니면 `\`${NX_API_URL}${streamUrlOrPath}\`` | 라인 149–152 |
| NX_API_URL | `process.env.NX_API_URL ?? 'http://localhost:8080'` (axios baseURL과 동일) | `libs/shared-utils/src/env.ts` 라인 3 |

**결론**: FE는 **Aura를 직접 호출하지 않는다**. 상대 경로일 때 `NX_API_URL`(BE) + 경로로만 요청하므로 **BE 프록시 SSE만 연결**한다.

### A.4 스트림 처리 방식

| 항목 | 내용 | 코드 경로 |
|------|------|-----------|
| 방식 | **EventSource 미사용**. **fetch + ReadableStream** | `use-analysis-run-stream.ts` 라인 160–165 |
| fetch | `fetch(url, { method: 'GET', headers, signal: abortControllerRef.current.signal })` | 라인 160–164 |
| 읽기 | `response.body?.getReader()`, `reader.read()` 루프 | 라인 183–185, 191–195 |

**EventSource**: 코드베이스 전체에서 사용하지 않음 (grep 검증).

### A.5 메시지 파싱/렌더링

| 이벤트/데이터 | FE 동작 | 코드 경로 |
|---------------|----------|-----------|
| 모든 라인 | `addEventLogLine(trimmed)` (로그/타임라인) | `use-analysis-run-stream.ts` 라인 209–211 |
| `event:` | `currentEventType` 설정, `addEventType(currentEventType)` | 라인 214–217 |
| `data: [DONE]` | 정상 종료: `setStatus('COMPLETED')`, `onSuccess(runId)`, `return` | 라인 223–231 |
| `event: started` | `addEventType('started')` | 라인 233–234 |
| `event: step` | `setStepProgress({ label, detail, percent })` | 라인 235–246 |
| `event: agent` | `setStepProgress({ agent/message, percent })` | 라인 247–258 |
| `event: completed` | 정상 종료: `setStatus('COMPLETED')`, `onSuccess(runId)`, `return` | 라인 259–266 |
| `event: failed` | `setStatus('ERROR')`, `setError(msg)`, `onError`, `return` | 라인 266–307 |

**파싱 방식**: `buffer += decoder.decode(value, { stream: true })` → `buffer.split('\n')` → 마지막 불완전 라인은 `lines.pop()` 으로 buffer에 유지 (라인 204–206). 청크 경계/부분 라인 처리 있음.

### A.6 종료 조건 / 재시도 정책

| 조건 | 동작 | 코드 경로 |
|------|------|-----------|
| 정상 종료 | `data: [DONE]` 또는 `event: completed` 수신 시 `return` (루프 종료). **close()/abort() 호출 없음** | 라인 223–231, 259–266 |
| 실패 종료 | `event: failed` 수신 시 에러 상태 설정 후 `return` | 라인 266–307 |
| 서버가 스트림 종료 | `reader.read()` → `done === true` 시 `break` 후 “완료되지 않았습니다” 메시지 | 라인 192–196, 303–310 |
| 타임아웃 | 65초 후 `setError`, `onError` (스트림 자체는 abort 하지 않음, signal 은 유지) | 라인 49, 175–181 |
| 사용자 취소 | `cancel()` → `abortControllerRef.current.abort()` | 라인 331–341 |
| 컴포넌트 unmount | cleanup 에서 **500ms 지연** 후 `controller.abort()`. remount 시 예약 취소 | 라인 99–117 |

**재시도**: Analysis Run 스트림 훅에는 **자동 재연결/backoff 없음**. 재시도는 UI “다시 시도” 버튼 → `handleRetryStream()` → `handleStartAnalysis()` (`use-case-analysis-run-state.ts` 라인 51, 36–48).

---

## B. “끊김 유발” 가능성 체크리스트 (필수)

### B.1 첫 이벤트/첫 청크 수신 직후 close() 또는 AbortController.abort() 호출

| 질문 | 답 | 근거 |
|------|----|------|
| 첫 청크/첫 줄 수신 직후 `close()` 또는 `abort()` 가 있는가? | **없음** | `chunkIndex === 1` 분기에서는 `LOG('first chunk received', ...)` 및 `LOG('first line (from first chunk)', ...)` 만 수행. `addEventLogLine(trimmed)` 후 **return/break/abort 없이** for → while 루프 계속 → 다음 `reader.read()` 호출. `use-analysis-run-stream.ts` 라인 198–212, 214–219. |

**결론**: 제거/수정할 “첫 청크 시 끊기” 로직 없음.

### B.2 useEffect dependency 변경 시 새 스트림/EventSource 생성 (중복 연결/재연결 루프)

| 질문 | 답 | 근거 |
|------|----|------|
| progress/state/runId 등 dependency 로 인해 스트림이 재생성되는가? | **아니오** | 스트림 시작은 `startStream(caseId, options)` **한 번 호출**로만 이루어짐. `useEffect` 는 **cleanup만** 담당 (dependency: `[clearStreamTimeout, resetStore]`). runId/state 변경 시 **새 EventSource/fetch 를 자동으로 여는 코드 없음**. 라인 99–118, 120–328. |

**결론**: 중복 연결/재연결 루프 없음.

### B.3 탭 이동/상태 변경 시 cleanup 즉시 실행으로 연결 끊김

| 질문 | 답 | 근거 |
|------|----|------|
| cleanup 이 즉시 abort 를 호출하는가? | **아니오** | cleanup 에서는 **500ms 지연** 후에만 `controller.abort()` 호출. remount 시(Strict Mode 등) `pendingCleanupAbortId` 를 clear 하여 **예약된 abort 취소**. 라인 105–116. |

**결론**: 탭 이동/remount 시 즉시 끊기는 구조 아님. 500ms 지연 + remount 시 취소로 완화됨.

### B.4 onerror 에서 무조건 close 후 즉시 reconnect (폭주) / backoff

| 질문 | 답 | 근거 |
|------|----|------|
| onerror 즉시 close + 재연결(폭주) 인가? | **해당 없음** | Analysis Run 스트림은 **fetch + getReader** 방식. `onerror` 콜백 없음. 에러 시 `catch` 블록에서 상태만 설정하고, **자동 재연결/backoff 없음**. 라인 312–325. |

**결론**: onerror 폭주/backoff 미존재 문제 없음.

### B.5 streamUrl 을 FE가 임의 합성(baseURL+path)하여 잘못된 URL 생성

| 질문 | 답 | 근거 |
|------|----|------|
| FE가 임의로 baseURL+path 를 합성하는가? | **아니오 (옵션 B 준수)** | URL 은 **BE 응답** `streamUrl` / `streamPath` 또는 fallback `\`/api/synapse/analysis-runs/${runId}/stream\`` 만 사용. 상대 경로일 때만 `NX_API_URL + streamUrlOrPath` (BE 프록시). 절대 URL 은 **그대로 사용**. 라인 145–152. |

**결론**: BE가 내려준 값 또는 fallback 경로만 사용. 옵션 B 에서는 항상 BE 프록시 URL.

### B.6 SSE 파싱 — `\n\n` 경계/부분 라인(청크 경계) 처리

| 질문 | 답 | 근거 |
|------|----|------|
| 청크 경계/불완전 라인 처리하는가? | **예** | `buffer += decoder.decode(value, { stream: true })` → `lines = buffer.split('\n')` → `buffer = lines.pop() ?? ''` 로 **마지막 불완전 라인을 buffer 에 보존** 후 다음 청크와 이어서 파싱. 라인 204–206, 208–219. |

**결론**: fetch 스트림 기준으로 부분 라인 처리 적절함.

---

## C. 브라우저 증적 (필수)

아래는 **FE 코드/로그 기준** 정리. 실제 캡처는 환경에서 한 번 더 채우는 것을 권장한다.

### C.1 Request URL / Response headers

| 항목 | 예시/설명 |
|------|-----------|
| Request URL | `GET {NX_API_URL}/api/synapse/analysis-runs/{runId}/stream` (옵션 B). 예: `http://localhost:8080/api/synapse/analysis-runs/830503e9-.../stream` |
| Request headers | `Accept: text/event-stream`, `X-Tenant-ID`, `X-Trace-ID`, `Authorization: Bearer ...` (buildStreamRequestHeaders). **Connection 헤더 없음** (restricted). `stream-request-headers.ts` 라인 39–61. |
| Response headers | `Content-Type: text/event-stream` (BE/프록시에서 설정). |

### C.2 종료 형태

| 형태 | FE 관점 설명 |
|------|--------------|
| pending 유지 | FE 가 abort 하지 않으면, 서버가 끊기 전까지 pending. |
| canceled | FE 에서 `abort()` 가 호출되면 **canceled**. 이 경우 콘솔에 `[AnalysisStream] catch: AbortError` 로그 발생. |
| finished | 서버가 스트림을 닫으면 **finished**. FE 는 `reader.read()` → `done === true` 로 인지. |

**수집 시 확인**: 동일 runId 에서 “첫 청크 직후 끊김” 시 Network 에서 해당 요청이 **canceled** 인지 **finished** 인지 확인. FE 콘솔에 `AbortError` 없이 `reader.read() done=true` 만 있다면 **finished**(서버/프록시 측 종료).

### C.3 종료 시점

- “첫 이벤트 직후 종료” 인 경우:  
  - FE 로그에 `first chunk received` → 이어서 `reader.read() done=true — stream ended by server` 만 있고, `delayed abort fired` / `cancel() called` / `catch: AbortError` 가 **없으면** FE 는 끊지 않은 것이며, **서버/게이트웨이 측에서 연결을 닫은 것**으로 해석 가능.

---

## D. 결론 / PR (필수)

### D.1 원인 후보 (1~3개, 근거 포함)

1. **Gateway/프록시 구간에서 첫 청크 전달 직후 연결 종료**  
   - **근거**: FE 콘솔에서 동일 runId 시 **abort 관련 로그 없음**, `reader.read() done=true` 만 반복 관측. FE 는 `AbortController.abort()` 를 첫 청크 처리 경로에서 호출하지 않으며, cleanup 도 500ms 지연 + remount 시 취소.  
   - **권장**: Gateway 로그에서 `SSE stream cancelled by client` vs `SSE stream completed by downstream` 및 첫 청크 직후 종료 조건(타임아웃, 버퍼 정책 등) 점검.

2. **Strict Mode unmount 로 인한 과거 끊김 (이미 완화)**  
   - **근거**: cleanup 에서 즉시 abort 하면 remount 전에 스트림이 끊김. **이미 500ms 지연 + remount 시 예약 취소**로 수정됨. (`use-analysis-run-stream.ts` 라인 52, 99–117.)  
   - **현재**: 동일 runId 로그에서 “remount: clearing scheduled cleanup abort” 확인 시, 이 경로로 인한 끊김은 아님.

3. **BE(SynapseX) → Aura 구간 또는 Aura 응답 지연**  
   - **근거**: BE 측 “client disconnected” 는 SynapseX 입장에서 **Gateway 쪽 연결이 이미 끊긴 상태**에서의 메시지일 수 있음. FE 는 Gateway 까지만 연결하므로, Gateway 가 다운스트림(SynapseX) 구독을 첫 청크 후 취소하는 시나리오와 결합 가능.  
   - **권장**: BE/Gateway 쪽에서 첫 청크 전달 직후 연결을 닫는 조건(타임아웃, 에러 처리, 버퍼 플러시 정책) 검토.

### D.2 FE 측 정리 (수정 PR 반영 사항)

| 항목 | 상태 |
|------|------|
| Aura 직접 연결 | **하지 않음**. 옵션 B: `NX_API_URL` + BE 가 내려준 경로로 **BE 프록시 SSE만** 연결. |
| 첫 청크/첫 이벤트 후 close/abort | **없음**. 로그/상태 반영만 하고 루프 계속. |
| cleanup 즉시 abort | **제거됨**. 500ms 지연 + remount 시 예약 취소. |
| EventSource | **미사용**. fetch + ReadableStream 만 사용. |
| streamUrl 합성 | **BE 응답 또는 fallback 경로** 만 사용. 임의 baseURL 합성 없음. |
| SSE 파싱(청크 경계) | **buffer + lines.pop()** 로 부분 라인 처리. |

**추가 패치**: 현재 코드 기준으로 “FE 가 끊기는 경우”를 유발하는 로직은 없음. 계속 끊긴다면 **브라우저 Network 탭**에서 해당 stream 요청의 종료 형태(canceled vs finished)와 **동일 runId 의 FE 콘솔 로그**를 함께 수집해 BE/Gateway와 공유하는 것을 권장.

---

**문서 작성**: FE 코드베이스 기준 (use-analysis-run-stream, use-case-analysis-run-state, synapse-analysis-api, stream-request-headers, env).  
**참고**: `docs/reference/STREAM_DISCONNECT_FE_VERIFICATION.md` 에 상세 검증 및 콘솔 로그 해석 정리됨.
