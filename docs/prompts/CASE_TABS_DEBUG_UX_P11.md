# Case 탭 바인딩 검증용 Debug UX (P1.1)

## 개요

- **목적**: 200 OK인데 Empty만 보이면 "바인딩 여부"를 검증할 수 없음
- **해결**: DEV/QA 모드에서만 노출되는 **Debug Drawer(원본 payload + empty reason)** 추가
- **검증**: BE DEMO 모드 ON/OFF 두 케이스를 모두 검증하여 "원복 시 정상"을 증빙

## 구현 내용

### 1. Empty reason 계산 (탭별)

| 탭 | 조건 | reason 키 |
|----|------|-----------|
| analysis | summary empty && recommendations length==0 | `summaryRecommendationsZero` |
| confidence | score null OR factors length==0 | `factorsZeroOrScoreNull` |
| similar | items length==0 | `itemsZero` |
| rag | items length==0 | `itemsZero` |

### 2. TabEmptyState 확장

- `reason?: string` prop 추가
- reason이 있으면 secondary 텍스트(monospace)로 표시

### 3. Debug Drawer (DEV only)

- **노출 조건**: `import.meta.env.DEV === true` (Vite DEV 모드)
- **트리거**: Case 상세 우측 상단 `</>` (code-square) 아이콘
- **내용**:
  - Active Tab
  - URL (탭별 API 경로)
  - Status (success/error)
  - Payload JSON pretty print
  - Copy JSON 버튼

### 4. i18n 키

- `cases.tabs.analysis.empty.reason.summaryRecommendationsZero`
- `cases.tabs.confidence.empty.reason.factorsZeroOrScoreNull`
- `cases.tabs.similar.empty.reason.itemsZero`
- `cases.tabs.ragEvidence.empty.reason.itemsZero`

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `apps/remotes/synapsex/src/components/ux/tab-empty-state.tsx` | reason prop 추가 |
| `apps/remotes/synapsex/src/pages/cases/components/case-*-tab.tsx` | empty reason, debug payload 연동 |
| `apps/remotes/synapsex/src/pages/cases/context/case-tabs-debug-context.tsx` | **신규** Debug context |
| `apps/remotes/synapsex/src/pages/cases/components/case-tabs-debug-drawer.tsx` | **신규** Debug drawer |
| `apps/remotes/synapsex/src/pages/case-detail.tsx` | Provider, Debug 버튼, tabKey 전달 |
| `libs/shared-i18n/src/locales/{en,ko}/common.json` | reason 키 추가 |

## 검증 시나리오

1. **(BE)** `SYNAPSE_DEMO_MODE=true` 로 실행
2. **(FE)** 케이스 상세 진입 → 탭 4개 클릭 → Success 캡처
3. **(BE)** `SYNAPSE_DEMO_MODE=false` 로 재기동
4. **(FE)** 동일 케이스/탭 → Empty + reason 캡처
5. Debug Drawer에서 payload 확인 캡처 1장

## PROD 빌드

- `import.meta.env.DEV`는 Vite production 빌드에서 `false`로 치환됨
- Debug 버튼 및 Drawer는 PROD에서 렌더되지 않음
