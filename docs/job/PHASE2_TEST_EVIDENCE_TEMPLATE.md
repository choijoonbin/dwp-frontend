# Phase2-1 테스트 증빙 제출 템플릿

> **제출일**: ___________  
> **테스터**: ___________  
> **환경**: BE URL ___________, FE 브랜치 ___________

---

## 1. Network 캡처 (필수 3종)

### 1-1. POST analysis-runs
- [ ] 캡처 완료
- 요청: `POST /api/synapse/cases/{caseId}/analysis-runs`
- 응답: runId ___________ streamUrl ___________
- 첨부: `evidence_01_post_analysis_runs.png`

### 1-2. GET stream (SSE)
- [ ] 캡처 완료
- 요청: `GET /api/synapse/analysis-runs/{runId}/stream`
- 수신 이벤트: started ☐ completed ☐ failed ☐ step ☐
- 첨부: `evidence_02_get_stream.png`

### 1-3. GET analysis
- [ ] 캡처 완료
- 요청: `GET /api/synapse/cases/{caseId}/analysis`
- 응답: 데이터 있음 ☐ / 비어있음 ☐
- 첨부: `evidence_03_get_analysis.png`

---

## 2. 화면 캡처 (필수 2종)

### 2-1. 스트림 탭
- [ ] 캡처 완료
- 표시 내용: started ☐ step ☐ completed ☐ failed ☐ 분석 완료 카드 ☐
- 첨부: `evidence_04_stream_tab.png`

### 2-2. AI 분석 탭
- [ ] 캡처 완료
- 표시 내용: 결과(reasonText, score 등) ☐ / Empty+reason ☐
- 첨부: `evidence_05_analysis_tab.png`

---

## 3. Go/No-Go 판정

- [ ] **GO**: runId 발급 + SSE 연결 + 이벤트 표시 + (완료 시) analysis refetch까지 동작
- [ ] **NO-GO**: runId 없음 / SSE 연결 실패 / UI 무반응

**비고**: ___________
