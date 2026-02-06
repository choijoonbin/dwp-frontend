# PHASE Cases Frontend Menu Hardening P0-P2

> 산출 문서 — `docs/job/PROMPT_B_Frontend_MenuByMenu_Cases_First.txt` 수행 결과

## 0) 결론/결정안

- **P0**: `/synapse/cases`(목록) + `/synapse/cases/:id`(상세) 화면에서 하드코딩 제거 (표시 항목/필터/정렬 포함)
- **P1**: Detail 탭 5개는 "실데이터 API 바인딩 + 로딩/에러/empty state"까지 완성
- **P2**: 시뮬레이션 모드/링크 이동의 쿼리 파라미터 정확화 (관련 미결재/계보)

---

## 1) 구현 범위 (In/Out)

### IN (P0) — 완료

- [x] CasesPage: status select UX 개선 (검색형 combobox + pinned + maxHeight)
- [x] Cases list: 카드/테이블에 표시되는 값은 API 응답 기반으로만 렌더링 (하드코딩 제거)
- [x] QueryKey/filters: q, status, severity, caseType → 실제 API query로 전달
- [x] TableLoadingSkeleton 적용
- [x] Empty state: "데이터 없음" + "필터 초기화" CTA
- [x] CaseDetailPage: mock 데이터 제거 (extendedComments, mockConfidenceFactors, mockFieldChanges, mockDocumentRelationship, mockSimulationResult)

### IN (P1) — 부분 완료

- [x] CaseDetailPage: Summary(좌측), 3-panel 구조 유지
- [x] Tabs: AI 분석, 에이전트 스트림, 신뢰도, 유사케이스, RAG
- [x] 신뢰도 탭: API 없을 때 empty state 표시
- [ ] 탭별 전용 API 바인딩: `/cases/{id}/analysis`, `/confidence`, `/similar`, `/rag/evidence` (BE API 확정 후)
- [ ] 모든 탭에 Skeleton/Empty/Error 표준 적용

### IN (P2) — 완료

- [x] 시뮬레이션 모드: CaseSimulationDiff API 연동 (mock fallback 제거)
- [x] "관련 미결재 항목": open-items route로 이동 + `caseId`, `related=true`, `bukrs`/`belnr`/`gjahr` 전달
- [x] "데이터 계보보기": lineage 페이지로 이동 + `caseId`, `docKey` 전달

### OUT

- 자동 번역/AI 분석 고도화(모델/RAG 품질)는 별도 phase

---

## 2) 변경 파일 목록

### 코드 변경

| 경로 | 변경 내용 |
|------|-----------|
| `apps/remotes/synapsex/src/pages/cases/index.tsx` | CodeSelectCombobox 적용, DEFAULT_* 제거, TableLoadingSkeleton, empty state CTA |
| `apps/remotes/synapsex/src/pages/case-detail.tsx` | mock 데이터 제거, documentRelationshipFromFiDoc, ragCitations(reasoning/evidence), Open Items/Lineage 링크 파라미터 |
| `apps/remotes/synapsex/src/pages/open-items/index.tsx` | caseId, related, belnr, gjahr 쿼리 파라미터 수신 |
| `libs/shared-utils/src/api/synapse-data-api.ts` | OpenItemsListParams에 caseId, related, belnr, gjahr 추가 |
| `libs/shared-i18n/src/locales/en/common.json` | cases.emptyData, filterResetCta, statusSearchPlaceholder, pinnedStatuses, allStatuses, relatedOpenItemsDesc, noConfidenceData |
| `libs/shared-i18n/src/locales/ko/common.json` | 동일 키 추가 |

### 산출 문서

| 경로 | 설명 |
|------|------|
| `docs/prompts/PHASE_Cases_Frontend_MenuHardening_P0-P2.md` | 본 문서 |

---

## 3) Query Keys

- `['synapse','cases','list', tenantId, params]`
- `['synapse','cases','detail', tenantId, caseId]`

---

## 4) 체크리스트 (완료 조건/엣지)

- [x] 케이스 목록/상세/탭 모든 화면에서 "하드코딩 데이터" 0개 (텍스트/숫자)
- [x] 로딩/에러/빈상태 UI 표준 적용 (목록: TableLoadingSkeleton, empty+filterResetCta)
- [x] 관련 링크는 "전체 조회"를 유발하지 않음 (필터 전달됨)
- [x] 다국어(i18n) 적용된 UI 텍스트는 t()로만
- [ ] Dark mode 대비 통과 (기존 테마 토큰 사용)

---

## 5) 테스트 방법

- 브라우저 Network 탭으로 탭 클릭 시 해당 API 호출 확인
- 케이스 seed 5건 기준으로 목록=5, 상세/탭에 해당 값이 표시되는지 스크린샷 첨부

---

## 6) BE API 요청 (누락 시)

다음 API가 없을 경우 Backend 요청 문서 생성:

- `GET /api/synapse/cases/{id}/analysis` — AI 분석 탭
- `GET /api/synapse/cases/{id}/confidence` — 신뢰도 탭
- `GET /api/synapse/cases/{id}/similar` — 유사케이스 탭
- `GET /api/synapse/cases/{id}/rag/evidence` — RAG 탭
- Open Items API: `caseId`, `related` 파라미터 지원
