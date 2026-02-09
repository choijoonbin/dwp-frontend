# Aura Phase2 서버 변경사항 (FE 대응)

> Aura 서버 작업 내용 기반 정리. FE는 이 문서와 BE 측 `FRONTEND_AURA_PHASE2_RESPONSE.md`를 참고한다.

---

## 백엔드 서버 변경 (Phase2 202 표준화 + proposal 멱등성)

### 1. POST /api/synapse/cases/{caseId}/analysis-runs → 202 Accepted

- `ResponseEntity.status(HttpStatus.ACCEPTED)` 사용
- 응답: `runId`, `status=STARTED`, `streamUrl`, `startedAt`(optional)

### 2. GET /api/synapse/cases/{caseId}/analysis?runId={runId}

- `runId` 쿼리 파라미터 추가
- runId 있을 때: 해당 run 결과만 반환
- runId 없을 때: 기존처럼 최신 completed run 결과 반환

### 3. GET /api/synapse/cases/{caseId}/action-proposals?runId={runId}

- `runId` 쿼리 파라미터 추가
- runId 있을 때: 해당 run의 proposals만 반환

### 4. proposal 멱등성 (dedup_key)

- `dedup_key` 컬럼, `UNIQUE(case_id, run_id, dedup_key)` 제약
- BE에서 `existsByCaseIdAndRunIdAndDedupKey`로 중복 검사 후 저장
- **FE에서 normalize 금지** — BE dedup 담당

### 5. GET /api/synapse/cases/{caseId}/analysis-runs?latest=true

- `latest=true`: 최신 runId만 반환 `{ runId: "..." }`
- latest 없음: run 목록 반환

---

## 변경 사항 요약

### 1. 트리거 (POST /aura/cases/{caseId}/analysis-runs)

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| **Request body** | (빈 body 또는 일부) | `caseId`, `evidenceSnapshot`, `options(model, policyVersion)` |
| **Response status** | `STARTED` | `ACCEPTED` |
| **Response** | `runId`, `streamUrl`, `status` | 동일 + `caseId` 포함 |
| **streamUrl** | (caseId 기반 legacy) | `/aura/analysis-runs/{runId}/stream` (runId 기반) |

### 2. 스트림 (runId 기반)

| Method | Path | 비고 |
|--------|------|------|
| **GET** | `/aura/analysis-runs/{runId}/stream` | **신규** — runId 경로로 전환 |
| GET | `/aura/cases/{caseId}/analysis/stream?runId=` | **Legacy** (하위 호환) |

### 3. 콜백/결과

- `proposals`에 `createdAt` 추가
- 멱등성: BE dedup 담당 (FE에서 normalize 금지)

### 4. API 경로 표

| Method | Path | Response |
|--------|------|----------|
| **POST** | `/aura/cases/{caseId}/analysis-runs` | 202 + JSON `{ runId, streamUrl, status: ACCEPTED, caseId }` |
| **GET** | `/aura/analysis-runs/{runId}/stream` | SSE |
| GET | `/aura/cases/{caseId}/analysis/stream?runId=` | SSE (legacy) |

---

## FE 대응 사항

### 1. Request body

- `createAnalysisRun(caseId, body)` 호출 시 `body`에 `evidenceSnapshot`, `options` 전달 지원
- `evidenceSnapshot`: `useCaseDetail().evidence` (또는 BE 약속 스냅샷 구조)
- `options`: `{ model?, policyVersion? }` (선택)

### 2. streamUrl 처리

- BE가 `streamUrl`을 응답에 포함하면 그대로 사용
- fallback: `runId`로 `/api/synapse/analysis-runs/{runId}/stream`
- 프로젝트에서 `/api/synapse/*` → Aura proxy 매핑이면 streamUrl 상대 경로도 proxy를 통해 전달됨

### 3. 202 응답 / status

- POST analysis-runs → 202 Accepted. Axios는 2xx를 성공으로 처리하므로 body 수신 가능.
- `data.status`는 `STARTED` (BE). FE는 `runId`, `streamUrl`만 사용.

### 4. proposals.createdAt / dedup

- `CaseActionProposalDto`에 `createdAt` 필드 있음. 카드에 표시 정책 유지.
- **멱등성(dedup)**: BE 전담. FE에서 normalize 금지.

### 5. GET analysis-runs?latest=true

- `getAnalysisRuns(caseId, { latest: true })` → `{ runId: "..." }`
- 케이스 상세 초기 로드 시 `useCaseAnalysisRunsQuery`로 최신 runId 조회 → `latestRunId` 초기화
- 분석 완료 시 `analysis-runs` 쿼리 invalidate

---

## 참고 문서

- `docs/job/PHASE2_TEST_EXECUTION_GUIDE.md` — Phase2 E2E 검증
- `docs/job/BE_FOLLOWUP_QUESTIONS_PHASE2.md` — BE 협의 내용
- BE: `docs/phase2/PHASE2_TRIGGER_STANDARD.md`, `FRONTEND_AURA_PHASE2_RESPONSE.md`
