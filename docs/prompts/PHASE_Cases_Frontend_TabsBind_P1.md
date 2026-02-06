# PHASE Cases Frontend Tabs Bind P1

> 산출 문서 — `docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt` 수행 결과

## 0) 결론/결정안

- 탭 데이터는 BE Proxy 단일 경로(`/api/synapse/cases/{caseId}/*`)로만 호출
- 탭별 QueryKey/DTO 분리, 탭 클릭 시에만 fetch (`enabled` 조건)
- SSE Stream 탭은 P1에서 제외, 4개 탭(analysis/confidence/similar/rag evidence) 완성

---

## 1) 구현 범위

### IN (P1) — 완료

- [x] Case Detail 탭 4종 실데이터 바인딩
  1. AI 분석 (Analysis)
  2. 신뢰도 (Confidence)
  3. 유사케이스 (Similar)
  4. RAG Evidence
- [x] 각 탭 공통: Skeleton / Empty / Error+Retry
- [x] i18n: empty/error/button 텍스트는 t() 키로 처리

### OUT (P1)

- SSE Stream 탭 "실시간" 바인딩 (별도 P1.5)
- 시뮬레이션 (write 없는 what-if) (별도 P2)

---

## 2) 변경 파일 목록

### API & Hooks (libs/shared-utils)

| 경로 | 변경 내용 |
|------|-----------|
| `libs/shared-utils/src/api/synapse-operations-api.ts` | getCaseAnalysis, getCaseConfidence, getCaseSimilar, getCaseRagEvidence + DTO 타입 |
| `libs/shared-utils/src/queries/use-synapse-operations-query.ts` | useCaseAnalysisQuery, useCaseConfidenceQuery, useCaseSimilarQuery, useCaseRagEvidenceQuery |

### UI 컴포넌트 (apps/remotes/synapsex)

| 경로 | 변경 내용 |
|------|-----------|
| `src/components/ux/tab-empty-state.tsx` | 탭 내부용 compact empty state |
| `src/components/ux/tab-content-skeleton.tsx` | 탭 내부용 로딩 스켈레톤 |
| `src/components/ux/tab-error-state.tsx` | 탭 내부용 error + retry |
| `src/pages/cases/components/case-analysis-tab.tsx` | Analysis 탭 컴포넌트 |
| `src/pages/cases/components/case-confidence-tab.tsx` | Confidence 탭 컴포넌트 |
| `src/pages/cases/components/case-similar-tab.tsx` | Similar 탭 컴포넌트 |
| `src/pages/cases/components/case-rag-evidence-tab.tsx` | RAG Evidence 탭 컴포넌트 |
| `src/pages/case-detail.tsx` | 탭 4종을 신규 컴포넌트로 교체, enabled 기반 fetch |

### i18n

| 경로 | 변경 내용 |
|------|-----------|
| `libs/shared-i18n/src/locales/en/common.json` | cases.tabs.*.empty, cases.tabs.*.error, common.retry, common.noData |
| `libs/shared-i18n/src/locales/ko/common.json` | 동일 키 추가 |

---

## 3) Query Keys

- `['synapse','cases','analysis', tenantId, caseId]`
- `['synapse','cases','confidence', tenantId, caseId]`
- `['synapse','cases','similar', tenantId, caseId]`
- `['synapse','cases','ragEvidence', tenantId, caseId]`

---

## 4) API Endpoints (BE 전제)

- `GET /api/synapse/cases/{caseId}/analysis`
- `GET /api/synapse/cases/{caseId}/confidence`
- `GET /api/synapse/cases/{caseId}/similar`
- `GET /api/synapse/cases/{caseId}/rag/evidence`

---

## 5) 완료 기준 (Definition of Done)

- [x] 케이스 상세 화면에서 탭 클릭 시 Network에 해당 API 호출 확인
- [x] 탭별로 Loading/Empty/Error/Success 상태가 UX 표준에 맞게 표시
- [x] 하드코딩된 더미/문구/숫자 없이 API 응답 기반 표시
- [ ] 다크모드에서 텍스트/배지 대비 문제 없음 (기존 테마 토큰 사용)
- [ ] lint/tsc 통과

---

## 6) 검증 방법

1. seed 1건 이상 준비
2. Case Detail 진입
3. 탭 4개를 각각 1회 클릭
4. 각 탭에서:
   - 데이터가 있으면 렌더 확인
   - 데이터가 없으면 EmptyState 확인
   - 401/500 시 ErrorState + Retry 확인 (선택)
5. 결과물: 탭별 스크린샷 4장, Network 캡처 1장
