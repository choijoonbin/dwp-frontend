# SSE Last-Event-ID 기대 동작 (P2-1)

> useSynapseAgentStream 훅의 Last-Event-ID 처리 정책  
> **Aura 계약 정합**: replay 미지원, id 연속만

---

## 의미 (Aura 계약 반영)

**Last-Event-ID**는 스트림이 **끊겼을 때** 재연결 요청에 포함하는 헤더이다.

**Aura 계약**: **replay 미지원**, **id 연속만**. 재연결 시 **새 스트림**이며, id는 last_id+1로 이어질 뿐 **replay 없음**.

---

## FE 구현 (use-synapse-agent-stream.ts)

| 단계 | 위치 | 동작 |
|------|------|------|
| **저장** | 161~163행 | SSE `id:` 라인 파싱 → `lastEventIdRef.current = eventId` |
| **전송** | 118행 | 재연결 시 `connectStream({ lastEventId })` → headers `Last-Event-ID` |
| **재연결** | 262~295행 | `attemptReconnect`에서 `lastEventIdRef.current`를 `connectStream`에 전달 |

---

## 제약 및 구분

| 시나리오 | Last-Event-ID 사용 | 비고 |
|----------|-------------------|------|
| **스트림 끊김** (네트워크 오류, 타임아웃) | ✅ 사용 | exponential backoff 재연결 시 헤더 포함. **새 스트림** 시작 |
| **HITL approve/reject 후** | ❌ 미사용 | 동일 연결 유지, BE가 같은 스트림으로 이벤트 이어서 전송 |
| **사용자 취소 (Abort)** | ❌ 미사용 | 재연결 시도 없음 |

---

## FE 기대 동작 (Aura 정합)

1. 스트림 에러/끊김 → exponential backoff로 재연결 시도
2. 재연결 시 `Last-Event-ID` 헤더 포함
3. **새 스트림** 시작. id는 last_id+1로 연속. **replay 없음**
4. **클라이언트 dedupe**: id로 중복 이벤트 제거. last_id 이하 이벤트 무시
5. **UX**: 재연결 시 "스트림이 재연결되었습니다" 안내 또는 스피너 표시
