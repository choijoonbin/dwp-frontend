# Phase3 P0/P1 Execute(sim) UX/바인딩 구현 리포트

## 구현 내용

- **P0 (Action Proposals 탭)**  
  - 실행(시뮬) 버튼: `proposalId` + `runId`로 `POST .../action-proposals/{proposalId}/execute` 호출, body에 `{ runId, simulate: true }` 전송.  
  - 카드별 실행 결과: 성공 시 actionId / simulation(key-value 테이블) / executedAt, 실패 시 message·stage 표시.  
  - runId 변경 시 카드별 결과 초기화. 실행 중 버튼 비활성화(중복 클릭 방지).

- **P1 (스트림 탭)**  
  - Step 기반 타임라인: started → step(label/percent/detail) → completed/failed.  
  - failed 시 stage 기반 메시지 + 재시도 CTA(contained 버튼).

## execute(sim) 요청 스키마

- **권장안(A)**: `POST /api/synapse/cases/{caseId}/action-proposals/{proposalId}/execute`  
  - Body: `{ runId?: string, simulate?: boolean, gatewayRequestId?: string }`  
  - FE는 `runId`(또는 proposal의 runId)와 `simulate: true`를 보냄.  
- BE가 아직 proposalId만 받고 body를 무시할 수 있음. 그 경우에도 FE는 동일 body로 보내 두었으며, BE에서 runId/simulate 지원 시 바로 활용 가능.

## 증적

- DevTools 캡처: proposals 응답, execute 요청/응답, UI 결과 표시(동일 카드 내 결과 패널) — 수동 캡처 후 PR 또는 문서에 첨부.

## 변경 파일 요약

- `libs/shared-utils`: `synapse-analysis-api.ts` (execute body/response), `use-synapse-operations-query.ts` (mutation runId, error stage), `stream-store.ts` (timelineSteps), `use-analysis-run-stream.ts` (addTimelineStep 호출).
- `apps/remotes/synapsex`: `case-action-proposals-tab.tsx` (카드별 결과 state, 결과 패널, runId 전달), `case-agent-stream-panel.tsx` (step 타임라인, failed stage + 재시도 CTA).
- i18n: `caseDetail.executing`, `lastExecutedAt`, `simulationResult`, `agentStreamPanel.timelineStarted/Completed/Failed`, `failedStage`.
