# SynapseX Phase 2~4 전체 실화면 완성 작업 계획

> **목표**: 모든 메뉴 실화면 완성 + API 연동 + 404 제거  
> **작성일**: 2026-02-02  
> **주의**: DWP 규칙상 **MUI v5 + Iconify** 사용 (shadcn/ui 금지)

---

## 1. 현재 상태 요약

| 메뉴 | 라우트 | 현재 상태 | API | 비고 |
|------|--------|-----------|-----|------|
| Cases | /cases | ✅ 실화면 | useCasesListQuery | column chooser, saved views 있음 |
| Case Detail | /cases/:id | ✅ 실화면 | useCaseDetailQuery | 3-Panel, Agent Stream, HITL |
| Anomalies | /anomalies | ✅ 실화면 | useAnomaliesListQuery | rule badge, drilldown 보완 필요 |
| Optimization | /optimization | ⚠️ 부분 | useOpenItemsListQuery | AR/AP 탭, 버킷/추천 보완 |
| Actions | /actions | ✅ 실화면 | useActionsListQuery | 큐/Bulk approval 보완 |
| Archive | /archive | ✅ 실화면 | useArchiveListQuery | detail drawer 보완 |
| RAG | /rag | ✅ 실화면 | useRagDocumentsQuery | 업로드/인덱싱 상태 보완 |
| Policies | /policies | ✅ 실화면 | usePolicyProfilesQuery | profile selector, audit 링크 |
| Guardrails | /guardrails | ✅ 실화면 | useGuardrailsQuery | severity matrix 보완 |
| Dictionary | /dictionary | ✅ 실화면 | useDictionaryQuery | import/export optional |
| Feedback | /feedback | ✅ 실화면 | useFeedbackQuery | case 라벨링 UI 보완 |
| Reconciliation | /reconciliation | ✅ 실화면 | useReconRunsQuery | 2탭(health/integrity) 보완 |
| Action Recon | /action-recon | ✅ 실화면 | useActionReconQuery | 재시도 CTA |
| Audit | /audit | ⚠️ 부분 | useSynapseAuditEventsQuery | filters 보완 |
| Analytics | /analytics | ✅ 실화면 | useAnalyticsKpisQuery | 차트 최소, KPI 위주 |

**404 원인**: pathname-to-page에서 미매칭 시 Dashboard로 fallback → 404 아님. 다만 일부 상세 라우트 패턴 누락 가능.

---

## 2. 공통 인프라 (libs/design-system 또는 synapsex 공통)

| 항목 | 위치 | 상태 |
|------|------|------|
| Column chooser | cases에 있음 | 공통화 → `ColumnChooserPopover` |
| Saved views | cases에 있음 | 공통화 → `SavedViewsDropdown` |
| CSV export (프론트) | 없음 | `exportTableToCsv` 유틸 추가 |
| ApiResponse unwrap | shared-utils | 유지 |
| Error/Loading/Empty | 각 페이지 | 통일 컴포넌트 권장 |

---

## 3. 라우트별 상세 구현 체크리스트

### 1) /cases
- [x] Worklist 테이블 (severity/status/type/bukrs/waers/belnr/party/riskScore/updatedAt/assignee)
- [x] 좌측 필터 패널 + saved views
- [ ] bulk assign/priority/status (API 필요)
- [x] row click → /cases/[caseId]

### 2) /cases/[caseId]
- [x] Left: 문서/오픈아이템/거래처 요약 + Reversal Chain + 링크
- [x] Center: AI reasoning + RAG + evidence + View Lineage CTA
- [x] Right: Action CTA + Simulation + approve/reject + comment
- [ ] 탭: Overview / Related Docs / Related Open Items / History

### 3) /anomalies
- [ ] rule badge
- [ ] drilldown → case detail

### 4) /optimization
- [ ] AR/AP 탭
- [ ] 버킷, 연체예측, 추천 알림/조치
- [ ] entity/doc/open-item cross-link

### 5) /actions
- [ ] 큐(자동/승인대기/금지)
- [ ] Bulk approval
- [ ] Risk summary
- [ ] row → drawer (simulate/approve/execute)

### 6) /archive
- [ ] action archive list/detail (drawer)

### 7) /rag
- [ ] 문서 업로드 UI
- [ ] 인덱싱 상태
- [ ] doc click → detail drawer (페이지 스니펫)

### 8) /policies
- [ ] profile selector
- [ ] duplicate invoice config + thresholds + pii defaults
- [ ] audit 이벤트 링크

### 9) /guardrails
- [ ] severity별 matrix (자동/승인필수/금지)
- [ ] 변경 diff preview

### 10) /dictionary
- [ ] term CRUD
- [ ] import/export (csv) optional

### 11) /feedback
- [ ] case 기반 라벨링 UI
- [ ] policy suggestion
- [ ] 라벨 목록/필터 + case link

### 12) /reconciliation
- [ ] ingestion health / integrity report 2탭
- [ ] drilldown 링크

### 13) /action-recon
- [ ] 실패 재시도 CTA

### 14) /audit
- [ ] filters: category/type/outcome/severity/actor/resource/q
- [ ] resourceId deep link

### 15) /analytics
- [ ] impact metrics, lead time, savings
- [ ] 표+KPI 위주

---

## 4. 크로스링크 규칙

- documents → entity(/entities/[id]) / cases(/cases/[caseId]) / lineage(/lineage?caseId=)
- entities → related docs/open-items/cases 탭 링크
- actions → caseId/docKey 역추적 링크
- audit → resourceId deep link

---

## 5. 실행 순서

1. **공통**: CSV export 유틸, ColumnChooser/SavedViews 공통화
2. **Phase2**: cases 보완 → anomalies → optimization → actions → archive
3. **Phase3**: rag → policies → guardrails → dictionary → feedback
4. **Phase4**: reconciliation → action-recon → audit → analytics
5. **크로스링크**: 모든 링크 적용
6. **404 검증**: 모든 메뉴 클릭 시 빈화면 없음 확인
