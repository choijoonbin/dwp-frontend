# Phase2 실행 — Frontend 테스트 수행 가이드

> **상태**: FE GO (테스트 준비 완료)  
> **목적**: Phase2 202 표준, runId 기반 조회, 액션제안 누적 방지 검증

---

## 점검 요약

- FE는 Phase2 구현 완료: 트리거(202), SSE, runId 전달, latestRunId, replace-on-retry, evidenceSnapshot, step 진행률 UI
- 추가 필수 구현 없음. **E2E 테스트로 "재시도 3회 시 액션제안 누적 방지" 확인**

---

## Phase2 API 요약

| Method | Path | 비고 |
|--------|------|------|
| POST | `/api/synapse/cases/{caseId}/analysis-runs` | **202 Accepted**, runId, streamUrl, status |
| GET | `/api/synapse/cases/{caseId}/analysis-runs?latest=true` | 최신 runId 또는 `{ runId: null }` |
| GET | `/api/synapse/cases/{caseId}/analysis?runId={runId}` | runId별 결과 |
| GET | `/api/synapse/cases/{caseId}/action-proposals?runId={runId}` | runId별 proposals (누적 방지) |
| GET | `/api/synapse/analysis-runs/{runId}/stream` | SSE (started, step, completed, failed) |

---

## 실행 절차

### 1) 사전 준비

1. BE가 위 API를 제공하는지 확인
2. 앱 실행: `yarn nx run dwp:serve` 또는 Host+Remote 구성
3. 로그인 후 케이스 목록 접근 가능한지 확인

### 2) 테스트 실행

| # | 단계 | 확인 사항 |
|---|------|-----------|
| 1 | 케이스 상세 진입 | `/synapse/cases` 또는 메뉴에서 케이스 클릭 → 상세 페이지 진입 |
| 2 | Agent Stream 탭 선택 | 중앙 탭에서 "에이전트 스트림" 또는 "Agent Stream" 탭 클릭 |
| 3 | "분석 시작" 클릭 | CTA 버튼 클릭 |
| 4 | Network 탭 확인 | DevTools → Network → 관련 요청 확인 |

### 3) Network 캡처 (필수)

| # | 요청 | 캡처 내용 |
|---|------|-----------|
| 1 | `POST .../analysis-runs` | **202** 응답, body (runId, streamUrl) |
| 2 | `GET .../analysis-runs/{runId}/stream` | SSE 이벤트 (started, step, completed/failed) |
| 3 | `GET .../analysis?runId={runId}` | completed 후 refetch |
| 4 | `GET .../action-proposals?runId={runId}` | completed 후 refetch |
| 5 | `GET .../analysis-runs?latest=true` | 초기 로드 시 최신 runId 조회 |

### 4) 화면 캡처 (필수)

| # | 화면 | 캡처 내용 |
|---|------|-----------|
| 1 | **스트림 탭** | started → step → completed. 진행률 UI (step 이벤트 시) |
| 2 | **AI 분석 탭** | score, reasonText, evidence 등 |
| 3 | **액션 제안 탭** | proposals, runId/createdAt 표시 |

### 5) 재시도 누적 방지 검증 (핵심)

| # | 단계 | 확인 사항 |
|---|------|-----------|
| 1 | "분석 시작" 1회 | 완료 후 액션제안 탭에 proposals 표시 |
| 2 | "재시도" 2회 | 새 runId로 **교체** (기존 proposals 누적되지 않음) |
| 3 | "재시도" 3회 | 동일 — 최신 run 결과만 표시 |

---

## 결과물 체크리스트

- [ ] POST analysis-runs **202** 응답 캡처
- [ ] GET stream SSE 캡처
- [ ] GET analysis?runId=, action-proposals?runId= 캡처
- [ ] 스트림 탭 화면 캡처
- [ ] AI 분석 / 액션 제안 탭 화면 캡처
- [ ] **재시도 3회 시 액션제안 누적 방지** 확인

---

## 예상 시나리오

### 정상 시나리오

1. "분석 시작" 클릭 → POST **202** + runId, streamUrl
2. streamUrl로 SSE 연결 → started → step(선택) → completed
3. completed 시 analysis, action-proposals refetch (runId 포함)
4. 액션 제안 탭: 해당 run의 proposals만 표시

### 재시도 시나리오

1. 재시도 클릭 → 새 runId 생성
2. 액션 제안 탭: **기존 proposals 교체** (누적 X)

### DEMO_OFF / 타임아웃 시나리오

1. 스트림: started만 수신, completed/failed 없이 약 60초 후 종료
2. FE: "분석이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요." 표시

---

## 참고

- `docs/job/BE_AURA_FOLLOWUP_QUESTIONS_PHASE2.md` — BE/Aura 답변 종합
- `docs/job/AURA_PHASE2_SERVER_CHANGES.md` — 서버 변경사항
