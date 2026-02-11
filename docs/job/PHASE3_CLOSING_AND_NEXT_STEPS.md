# Phase3 마무리 및 다음 단계

> **참고**: `front.txt`(Phase3 FE 구현 지시서) 기준 마무리 정리. `work.txt`(DWP/SynapseX Phase3 실행 패키지 2주 MVP + 4주 고도화)는 **이번 개발 종료 후** 진행할 전체 로드맵.

---

## 1. front.txt 체크리스트 vs 현재 구현 상태

| 구분 | front.txt 항목 | 현재 상태 | 비고 |
|------|----------------|-----------|------|
| **Week1** | 분석 시작 버튼: POST 호출 + runId/streamUrl 저장 | ✅ 완료 | `createAnalysisRun`, `streamUrl`/`streamPath` 수용 |
| | SSE 연결: started/step/agent/completed/failed 렌더 | ✅ 완료 | `useAnalysisRunStream`, `CaseAgentStreamPanel` |
| | completed/failed 이벤트 처리(자동 조회/토스트) | ✅ 완료 | completed 시 analysis·action-proposals refetch |
| | AI 분석 탭 렌더(score/severity/reason/evidence/ragRefs) | ✅ 완료 | `CaseAnalysisTab`, ragRefs 리스트 표시 |
| | 액션제안 탭 렌더(type/status/risk/rationale/payload/refs) | ✅ 완료 | `CaseActionProposalsTab` |
| **Week2** | 승인/거절 버튼 및 decision API 연동 | ✅ 완료 | `POST .../action-proposals/{proposalId}/decision` |
| | 실행(시뮬) 버튼 및 execute API 연동 | ✅ 완료 | `POST .../action-proposals/{proposalId}/execute` (path 기반) |
| | 중복 merge UI(동일 fingerprint) | ✅ 완료 | fingerprint 기준 groupBy, 최신 1건 표시 |
| | 실패 UX + 재시도 UX | ✅ 완료 | failed 시 `error`/`message` 메시지 표시, `retryable===true`일 때 "재시도 가능" 문구 표시(Aura §13 반영) |

**결론**: front.txt 기준 **필수 체크리스트 구현 완료**.

**확인 반영**: FE — step 라벨(서버 값 그대로) / failed error 객체(문자열·객체 모두) / 액션 제안 체크리스트 표시(빈 배열 시 숨김) **모두 반영 완료**.

---

## 2. front.txt / work.txt와 현재 계약(handoff) 차이

| 항목 | front.txt / work.txt | 현재 계약 (PHASE3_HANDOFF_BY_SYSTEM) |
|------|----------------------|--------------------------------------|
| **streamUrl** | "반드시 Aura SSE URL", "BE 내부 proxy 내려주지 않는다" | **옵션 B 확정**: 운영은 **BE SSE 프록시 경로**만. 옵션 A(직접 Aura URL)는 개발/로컬 feature flag 전용, 운영 OFF. |
| **execute API** | `POST .../actions/execute` body `{ proposalId, mode: "SIMULATION", ... }` | FE는 **path 기반** 사용: `POST .../action-proposals/{proposalId}/execute` (body 없음). BE 두 경로 모두 지원, 추가 확인 불필요. |
| **run 선택** | 최신/이전 실행 전환 | MVP는 최신만(latest=true). Week3에 run 목록 API 기반 드롭다운 추가 예정(work.txt Week3와 일치). |

→ **실제 연동·의사결정은 handoff 문서 기준**. front.txt/work.txt는 초기 스펙·로드맵 참고용.

---

## 3. 각 시스템에 확인이 필요한 사항

| # | 대상 | 확인 요청 내용 | 상태 |
|---|------|----------------|------|
| 1 | **Aura** | **ragRefs 콜백 스키마(필드명)** 확정·공유 | **유일 남은 필수 확인**. FE 기대: `refId`, `sourceType`, `sourceKey`, `excerpt`, `score`. 확정·공유 시 BE 저장·반환, FE 렌더 완료. |
| 2 | 인프라/Gateway | (선택) 옵션 A 사용 시 `/aura/...` 라우팅·인증 Aura 전달 | 운영은 BE 프록시만 사용하므로 필수 아님. |

**요약**: FE→BE·Aura 질문은 미회답 없음. **추가로 확인 필수인 것은 Aura ragRefs 스키마(필드명) 1건.**

---

## 4. 의사결정이 필요한 내용 및 질문

### 4.1 의사결정 완료(현재 반영됨)

- 스트림 연결 주체: 옵션 B(운영 BE 프록시), 옵션 A는 개발/로컬 feature flag만.
- decision/execute: BE API로만 전환, 임시 상태변경 버튼 금지.
- run 선택 UI: MVP 최신만, Week3 드롭다운.
- 감사 로그 링크: decision/execute 성공 후 caseId·runId·eventType 필터로 Audit 화면 링크 노출(권장).

### 4.2 추가 의사결정·질문(필요 시)

| # | 구분 | 내용 | 비고 |
|---|------|------|------|
| 1 | FE UX | failed 이벤트 **retryable** 값에 따라 "재시도 가능" 문구 표시 | ✅ **반영 완료**. `retryable===true`일 때 "재시도 가능합니다." 표시. |
| 2 | FE UX | **error** 필드를 에러 메시지로 사용 | ✅ **반영 완료**. `error ?? message` 로 메시지 표시. |
| 3 | 로드맵 | work.txt Week3~4(고도화) 우선순위 | run 전환 드롭다운, 변경 highlight, 근거 탐색, run 디버그 패널 등 — 제품/일정에 따라 결정. |

---

## 5. 다음 단계(work.txt 로드맵 요약)

- **Week 3**: 재시도/중복/비교 UX — latest=true·run 목록, run 전환 드롭다운, 변경 highlight.
- **Week 4**: 품질/성능/권한/운영도구 — 권한 분리, "왜 이 제안인가" 근거 탐색, run 디버그 패널.

상세는 `work.txt` 참고.

---

## 6. 순차 점검 요약(검증)

- **API·훅**: `createAnalysisRun`, `getCaseAnalysis`(runId), `getCaseActionProposals`(runId), `submitActionProposalDecision`, `executeProposal` — 경로·스키마 handoff 기준 일치.
- **스트림**: `streamUrl`/`streamPath` 수용, 상대 경로 시 NX_API_URL 접두. completed 시 refetch, failed 시 `error`/`retryable` 반영.
- **케이스 상세**: 분석 시작 → `startStream` → onSuccess 시 `latestRunId` 설정 및 쿼리 무효화. AI 분석/액션제안 탭에 `runId` 전달.
- **액션제안 탭**: decision API(`useApproveProposalMutation`/`useRejectProposalMutation`), execute API(`useExecuteProposalMutation`), fingerprint dedup 적용.
- **린트**: Phase3 수정 파일(agent stream, case-agent-stream-panel, stream-status, i18n) — 에러 없음.

---

## 7. 프론트에서 확인 가능 여부 (FAILED stage / 리버스프록시 SSE)

### 7.1 FAILED stage 값 (Aura: rag/llm/pipeline/background) — FE 표시·BE 저장

| 구분 | 프론트 확인 가능? | 내용 |
|------|------------------|------|
| **FE 표시** | ✅ **가능** | FE는 `error`를 **문자열** 또는 **객체 `{ message, stage }`** 둘 다 처리. `stage`는 Aura 값(rag/llm/pipeline/background)을 **문자열 그대로** 통과시키며 enum 검사 없음 → FE 표시는 깨지지 않음. |
| **BE 저장** | ❌ **불가** | 실패 시 run 상태/error 저장은 **BE·Aura 콜백 계약** 영역. FE는 스트림만 소비하므로 BE 저장 스키마/정합성은 **BE 또는 E2E/통합 테스트**에서 확인 필요. |

→ **요약**: FE는 “문자열/객체 error + stage 값 그대로 통과”만 검증 가능. BE 저장은 BE 측 검증.

### 7.2 리버스프록시/게이트웨이 SSE 타임아웃·버퍼링·keep-alive (30분 타임아웃 포함)

| 구분 | 프론트 확인 가능? | 내용 |
|------|------------------|------|
| **설정 적용 여부** | ❌ **불가** | 타임아웃/버퍼링/keep-alive는 **리버스프록시·게이트웨이(nginx 등) 설정**. 브라우저는 단순히 SSE URL로 연결할 뿐, 해당 설정값을 읽거나 검사할 수 없음. |
| **간접 관찰** | △ 가능 | 30분 이상 스트리밍 시 연결이 끊기면 “타임아웃 가능성”은 추론 가능하나, **30분이 적용됐는지**는 인프라/BE 담당이 설정 문서·프록시 로그로 확인해야 함. |

→ **요약**: **프론트에서는 확인 불가**. 리버스프록시/게이트웨이 담당에서 SSE 타임아웃(30분 포함)·버퍼링·keep-alive 설정 점검 필요.
