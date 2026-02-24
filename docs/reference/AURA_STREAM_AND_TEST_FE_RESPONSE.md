# Aura 스트림·테스트 데이터 오류 — FE 대응 요약

Aura 측 원인 분석 및 조치 요약에 대한 프론트엔드 대응 내역입니다.  
Aura 상세 문서: `docs/troubleshooting/STREAM_AND_TEST_DATA_ERRORS.md` (백엔드 저장소).

---

## 1. POST /aura/test/stream 401

**Aura 조치:** 인증 예외(EXEMPT_PATTERNS) 추가, OptionalUser로 토큰 없이도 `user_id=test`, `tenant_id=1` 로 동작.

**FE 현황:**  
- SandboxChat, use-ai-workspace, aura-mini-overlay 모두 `buildStreamRequestHeaders()` 사용.  
- `token` 이 있으면 `Authorization: Bearer {token}` 포함, 없으면 미포함.  
- **추가 조치 없음.** 토큰 유무와 관계없이 Aura에서 처리 가능.

---

## 2. 스트림 조기 종료 (GET .../analysis/stream)

**Aura 요청:**  
- POST .../analysis-runs 의 **202 응답 runId**로만 GET .../analysis/stream?runId=... 연결.  
- **data: [DONE]** 또는 **failed** 가 나올 때까지 연결 유지.  
- **컴포넌트 언마운트 시에만** 연결 종료.  
- 짧은 타임아웃이나 잘못된 runId로 재연결하지 않기.  
- Gateway/프록시 스트리밍 타임아웃은 넉넉히 늘리거나 스트리밍 경로 제외.

**FE 현황 (`libs/shared-utils/src/agent/use-analysis-run-stream.ts`):**

| 항목 | 구현 |
|------|------|
| runId 소스 | POST analysis-runs 응답의 `runId` 또는 ANALYSIS_STARTED 푸시의 `streamUrl`/`runId` 만 사용. 잘못된 runId로 재연결하지 않음. |
| 연결 유지 | `reader.read()` 루프로 **data: [DONE]**, **event: completed**, **event: failed** 수신 시에만 정상/실패 처리 후 종료. |
| 연결 종료 | 컴포넌트 언마운트 시 cleanup 에서만 `AbortController.abort()` 호출 (StrictMode 대응으로 500ms 지연 후 abort). |
| 타임아웃 | 65초(`STREAM_TIMEOUT_MS`)는 **마지막 수단**용. 정상 종료는 [DONE]/completed/failed에 의존. |

**추가 조치:**  
- **운영/인프라:** Gateway·리버스 프록시에서 스트리밍 경로(`/api/synapse/analysis-runs/*/stream`, `/api/aura/*/stream` 등) 타임아웃을 넉넉히 늘리거나 스트리밍 구간은 타임아웃 제외 요청.

---

## 3. Azure Content Filter / RAG 0건

백엔드·Aura 측 원인 및 조치 사항이며, 프론트 추가 조치 없음.

---

## 4. 참고

- 테스트 채팅: `POST /api/aura/test/stream` — SandboxChat, AI 워크스페이스, Aura 미니 오버레이.  
- 분석 스트림: `GET /api/synapse/analysis-runs/{runId}/stream` — `useAnalysisRunStream` (워크벤치·케이스 상세).
