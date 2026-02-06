# Case Detail 탭 검증 + E2E 증빙

> B) Front Prompt — 탭 검증 + E2E 증빙(필수) 수행 결과

---

## 1) 네트워크 검증

### 절차

1. Case Detail 진입 (케이스 1건 선택)
2. 탭 4개를 각각 1회 클릭: Analysis → Confidence → Similar → RAG Evidence
3. DevTools Network 탭에서 요청 확인

### 기대 요청

| 탭 | URL | Method | 기대 상태 |
|----|-----|--------|-----------|
| Analysis | `/api/synapse/cases/{caseId}/analysis` | GET | 200 |
| Confidence | `/api/synapse/cases/{caseId}/confidence` | GET | 200 |
| Similar | `/api/synapse/cases/{caseId}/similar` | GET | 200 |
| RAG Evidence | `/api/synapse/cases/{caseId}/rag/evidence` | GET | 200 |

### Network 캡처

- [ ] 4개 요청이 모두 발생함을 확인
- [ ] 200 응답 확인
- [ ] payload 일부 캡처 (개인정보 제외)

**캡처 첨부:** `docs/prompts/assets/tabs-verification-network.png`

```
[스크린샷 또는 캡처 내용을 여기에 붙여넣기]

예시:
- GET /api/synapse/cases/xxx/analysis → 200
- GET /api/synapse/cases/xxx/confidence → 200
- GET /api/synapse/cases/xxx/similar → 200
- GET /api/synapse/cases/xxx/rag/evidence → 200
```

---

## 2) 화면 상태 검증 (스크린샷)

### 탭별 상태 확인

| 탭 | Success (데이터 렌더) | Empty (TabEmptyState) | Error (TabErrorState + Retry) |
|----|----------------------|------------------------|-------------------------------|
| Analysis | [ ] | [ ] | [ ] |
| Confidence | [ ] | [ ] | [ ] |
| Similar | [ ] | [ ] | [ ] |
| RAG Evidence | [ ] | [ ] | [ ] |

### 스크린샷 첨부

- [ ] **탭 1 (Analysis):** `docs/prompts/assets/tab-analysis-success.png` (또는 empty/error)
- [ ] **탭 2 (Confidence):** `docs/prompts/assets/tab-confidence-success.png`
- [ ] **탭 3 (Similar):** `docs/prompts/assets/tab-similar-success.png`
- [ ] **탭 4 (RAG Evidence):** `docs/prompts/assets/tab-rag-success.png`

### Empty 상태 검증

- API가 빈 배열/객체를 반환할 때 TabEmptyState가 표시되는지 확인
- (BE가 빈 응답을 주는 케이스가 있으면 해당 케이스로 검증)

### Error 상태 검증

- 401/500 등 에러 시 TabErrorState + Retry 버튼 표시 확인
- Retry 클릭 시 재요청 발생 확인
- (선택) BE를 일시적으로 중단하거나 잘못된 caseId로 404 유도

### 다크모드

- [ ] 다크모드에서 텍스트/배지 대비 문제 없음 확인

---

## 3) Fallback (caseData) 처리 정책

### PM 결론

- [ ] **옵션 A:** API 우선, fallback 제거
- [ ] **옵션 B:** fallback 유지 + "임시 표시" 안내 배지

### 적용 가이드

**옵션 A (fallback 제거):**
- `case-analysis-tab.tsx`: `fallbackConfidence`, `fallbackTitle`, `fallbackAnomalyType`, `fallbackSeverity` props 제거
- `case-detail.tsx`: `CaseAnalysisTab` 호출 시 fallback props 제거
- API 응답 없으면 `TabEmptyState`만 표시

**옵션 B (fallback + 배지):**
- `case-analysis-tab.tsx`: fallback 사용 시 상단에 `<Chip label="임시 표시" size="small" color="warning" />` 추가
- i18n: `cases.tabs.analysis.fallbackBadge`: "임시 표시" / "Temporary"

### 적용 내용

(선택한 옵션에 따른 변경 사항 기록)

### 변경 전/후 비교

| 구분 | 변경 전 | 변경 후 |
|------|---------|---------|
| Analysis 탭 (API 미연동 시) | fallback caseData 표시 | (옵션에 따라) |
| 스크린샷 | `docs/prompts/assets/before.png` | `docs/prompts/assets/after.png` |

---

## 4) DoD 체크리스트

- [ ] 탭 4개 스크린샷 4장
- [ ] Network 캡처 1장
- [ ] Error/Empty 동작이 의도대로임을 증빙

---

## 5) 검증 실행 방법

```bash
# 1. 앱 실행
yarn nx run dwp:serve
# 또는
yarn nx run synapsex:serve

# 2. 브라우저에서 /synapse/cases 진입
# 3. 케이스 1건 클릭 → Case Detail
# 4. DevTools (F12) → Network 탭 열기
# 5. 탭 4개를 각각 클릭하며 요청 확인
# 6. 스크린샷 캡처 (OS: Cmd+Shift+4 / Win: Win+Shift+S)
```

---

## 6) 결과 요약

| 항목 | 결과 |
|------|------|
| 네트워크 4개 요청 발생 | ✅ / ❌ |
| 200 응답 | ✅ / ❌ |
| Success 렌더 | ✅ / ❌ |
| Empty 상태 | ✅ / ❌ |
| Error + Retry | ✅ / ❌ |
| 다크모드 대비 | ✅ / ❌ |

**검증 일자:** ___________  
**검증자:** ___________
