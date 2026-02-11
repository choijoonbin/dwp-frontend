# Document Detail × Lineage 통합 (Phase 3) — 분석 및 구현 계획

> **Role**: Lead Frontend Engineer  
> **Target**: 전표 상세 내 [상세 정보 | 계보(Lineage) | 관련 증거] 탭 통합, 반응형, 테마 토큰

---

## 1. Pre-Check 답변 (코딩 전 필수)

### 1.1 전표 상세 API 호출 시 계보 데이터(`lineage_json`)를 함께 가져올지, 탭 클릭 시 별도 호출할지

**결론: 탭 클릭 시 별도 호출을 권장합니다.**

| 방식 | 장점 | 단점 |
|------|------|------|
| **상세 API에 lineage_json 포함** | 한 번의 요청으로 상세+계보 로딩, 탭 전환 즉시 표시 | BE 전표 상세 API 변경 필요, 응답 크기 증가, 계보를 쓰지 않는 사용자에게도 비용 발생 |
| **탭 클릭 시 별도 호출** | 기존 BE 계약 유지, 전표 상세 응답은 그대로, 계보 탭을 열 때만 `GET /api/synapse/lineage?docKey=...` 호출 | 탭 전환 시 로딩 상태 필요 |

**현재 구조**: `useDocumentDetail`은 `useDocumentDetailQuery(bukrs, belnr, gjahr)`만 사용하며, `libs/shared-utils`의 `getLineage(params)`는 `docKey` 등으로 **별도 API** 호출이다. 전표 상세 API 스펙에 `lineage_json` 필드가 없으므로, **탭 클릭 시 `useLineageQuery({ docKey: \`${bukrs}-${belnr}-${gjahr}\` })`를 호출**하는 방식으로 구현한다.  
(추후 BE에서 전표 상세 응답에 `lineage` 또는 `lineage_json`을 포함하기로 하면, `useDocumentDetail`에서 옵션으로 함께 반환하도록 확장 가능하다.)

---

### 1.2 모바일 뷰에서 복잡한 Flow 그래프를 대체할 'Simple Timeline' 컴포넌트 레이아웃

**결론: 수직 타임라인 리스트(Simple Timeline) 레이아웃을 아래와 같이 구상한다.**

- **데이터 소스**: Lineage 탭과 동일한 `steps` (useLineageQuery → steps). `agent_activity_log`와 **동일한 step/이벤트 리스트 개념**으로, 시간순 정렬된 단일 리스트로 취급한다.
- **레이아웃**:
  - **좌측**: 세로 연결선(vertical line) + 각 step별 노드(원형 아이콘 또는 dot). 연결선과 노드는 `theme.vars.palette.divider`, `theme.vars.palette.primary.main` 등 테마 토큰 사용.
  - **우측(또는 풀 width)**: 각 step 한 행에 **아이콘 | 이름 | 타임스탬프 | 상태(완료/실행중 등)**. 터치 시 확장하여 상세(details) 또는 Evidence 요약 표시 가능.
- **컴포넌트**: `DocumentLineageTimeline` (이름 가칭). props: `steps: LineageStep[]`, `selectedStepId`, `onStepClick`, (선택) `onStepDetail`.  
  - Desktop(md 이상): 기존 `LineageFlow`(가로 플로우 + 카드 리스트) 노출.  
  - Mobile(xs, sm): `LineageFlow`는 `display: none`, `DocumentLineageTimeline`만 `display: block` 하여 수직 타임라인 리스트로 노출.  
  - `sx` 미디어 쿼리: `display: { xs: 'none', md: 'block' }` / `display: { xs: 'block', md: 'none' }` 로 전환.
- **접근성**: 터치 타겟 최소 44px, 리스트 스크롤 영역 `overflow: auto`로 375px 높이 대응.

---

## 2. 구현 계획 요약

### 2.1 탭 인터페이스 재구성

- **대상**: `apps/remotes/synapsex/src/pages/document-detail.tsx`
- **현재 탭**: Line Items(0), Reversals(1), Integrity(2), Related(3).
- **목표 구조**:  
  - **Tab 0 — 상세 정보**: 기존 “Document Header + Line Items”를 하나의 “상세 정보” 탭으로 유지. (기존 Line Items 탭 내용을 상세 정보 내부에 유지하거나, 헤더 카드 아래 첫 번째 탭으로 통합.)  
  - **Tab 1 — 계보(Lineage)**: Lineage 탭 추가. 클릭 시 `useLineageQuery({ docKey })` 호출, `LineageFlow`(Desktop) / `DocumentLineageTimeline`(Mobile) 렌더.  
  - **Tab 2 — 관련 증거**: 기존 Integrity + Related를 “관련 증거”로 묶거나, Evidence 패널(계보 step 기반) + Related Cases/Actions 카드로 구성.
- **구체화**:  
  - 기존 4탭을 유지한 채 “Lineage” 탭을 **추가**할지,  
  - 아니면 3탭 “[상세 정보 | 계보 | 관련 증거]”로 **재구성**할지 팀 합의 권장.  
  - 아래 계획은 **기존 4탭 유지 + Lineage 탭 추가**(예: Tab 4로 삽입)로 기술하며, 필요 시 탭 순서/이름만 조정하면 된다.

### 2.2 LineageFlow 이식 및 탭 내 배치

- **위치**: `pages/documents/components/` 또는 `pages/lineage/_components/` 유지 후 document-detail에서 import.
- **이식 내용**:
  - `LineageFlow`는 이미 `lineage/_components/lineage-flow.tsx`에 있으므로, **document-detail의 Lineage 탭**에서 `docKey`(bukrs-belnr-gjahr)를 기준으로 `useLineageQuery({ docKey })`를 호출하고, 반환된 `steps`를 `LineageFlow`에 그대로 전달.
  - 선택 step 상세는 기존 `StepDetailDrawer` / `StepDetailsInline`를 탭 내부에 함께 넣거나, 간소화된 드로어만 사용.
- **의존성**: `LineageFlow`는 `LineageStep[]`, `formatTime`/`formatDate`(lineage/utils), `theme` 사용. 전표 상세 페이지에서 `doc?.id` 또는 `bukrs-belnr-gjahr`로 docKey를 만들어 `useLineageQuery`만 연결하면 된다.

### 2.3 Simple Timeline (모바일 375px)

- **신규 컴포넌트**: `DocumentLineageTimeline` (또는 `LineageTimelineList`).
  - **위치**: `apps/remotes/synapsex/src/pages/lineage/_components/lineage-timeline-list.tsx` 또는 `apps/remotes/synapsex/src/pages/documents/components/DocumentLineageTimeline.tsx`.
  - **UI**:  
    - 좌측 세로선 + step별 노드(아이콘/점).  
    - 각 행: [아이콘] [이름 + system + 타임스탬프] [상태 뱃지].  
  - **색상**: 선/노드/텍스트 모두 `theme.vars.palette.*`(divider, primary, text.secondary, success.main 등) 사용.
  - **반응형**:  
    - Lineage 탭 콘텐츠 영역에서:  
      - `LineageFlow` wrapper: `sx={{ display: { xs: 'none', md: 'block' } }}`.  
      - `DocumentLineageTimeline` wrapper: `sx={{ display: { xs: 'block', md: 'none' } }}`.  
    - 375px에서 플로우 차트는 숨기고, 수직 타임라인만 보이도록 한다.

### 2.4 Theme (선/노드 색상)

- **LineageFlow** (기존):  
  - 연결선: `bgcolor: 'divider'` 또는 `theme.vars.palette.divider`.  
  - 노드(선택 시): `theme.palette.primary.main` → `theme.vars.palette.primary.main` 등으로 통일.  
- **DocumentLineageTimeline**:  
  - 세로선: `borderLeft` 또는 `bgcolor`에 `theme.vars.palette.divider` 또는 `varAlpha(..., 0.24)`.  
  - 노드/아이콘: `primary.main`, `success.main`, `text.disabled` 등 테마 토큰만 사용.  
- **공통**: Hex 등 하드코딩 금지, `@libs/design-system` 테마 토큰만 사용하여 라이트/다크 전환 시 자연스럽게 반영되도록 한다.

### 2.5 관련 증거 탭

- “관련 증거”가 **계보 step 기반 Evidence**를 의미하는 경우: Lineage 페이지의 `EvidencePanel`을 탭 내부에 넣고, 동일한 `steps`를 넘긴다.  
- “관련 증거”가 **전표 기준 Related Cases/Actions + Integrity**를 의미하는 경우: 기존 Integrity 탭 + Related 탭 내용을 하나의 “관련 증거” 탭으로 합치면 된다.  
- 팀 정의에 따라 EvidencePanel 이식 여부만 결정하면 된다.

---

## 3. 파일/작업 체크리스트

| # | 작업 | 파일/위치 | 비고 |
|---|------|-----------|------|
| 1 | Lineage 탭 추가 및 activeTab 분기 | `document-detail.tsx` | docKey 계산 후 Lineage 탭에서 useLineageQuery 호출 |
| 2 | Lineage 탭 콘텐츠: Desktop → LineageFlow | `document-detail.tsx` 또는 `documents/components/DocumentLineageTab.tsx` | steps, selectedStepId, onStepClick, onStepDetail 전달 |
| 3 | Lineage 탭 콘텐츠: Mobile → Simple Timeline | 신규 `LineageTimelineList.tsx` 또는 `DocumentLineageTimeline.tsx` | steps, theme.vars, 수직 리스트 |
| 4 | 반응형 sx 적용 | Lineage 탭 내부 | LineageFlow: display { xs: 'none', md: 'block' }, Timeline: { xs: 'block', md: 'none' } |
| 5 | LineageFlow/타임라인 선·노드 테마 토큰화 | `lineage-flow.tsx`, 신규 타임라인 컴포넌트 | theme.vars.palette, varAlpha 사용 |
| 6 | (선택) StepDetailDrawer/EvidencePanel 탭 내 사용 | document-detail 또는 DocumentLineageTab | step 상세/증거 표시 |
| 7 | i18n | `common.json` (en/ko) | documentDetail.tabs.detail / lineage / evidence 등 |

---

## 4. 데이터 흐름 요약

- **전표 상세 로딩**: 기존대로 `useDocumentDetail(docKey)` → doc, lineItems, integrityChecks, relatedCases, relatedActions, reversalChain.  
- **Lineage 탭 선택 시**: `docKey` = `\`${doc.bukrs}-${doc.belnr}-${doc.gjahr}\`` 로 `useLineageQuery({ docKey })` 호출 → `steps`.  
- **Lineage 탭 내**:  
  - Desktop: `LineageFlow`(steps) + (선택) StepDetailsInline / StepDetailDrawer.  
  - Mobile: `DocumentLineageTimeline`(steps) only 또는 간단한 step 상세 확장.  

이 계획대로 구현하면 전표 상세 내 계보 통합과 375px Simple Timeline, 테마 일관성을 만족할 수 있다.

---

## 5. BE Lineage DTO (참고)

BE lineage 패키지 응답은 **그래프 구조**를 사용한다.

| 파일 | 역할 |
|------|------|
| **LineageNodeDto** | `id`, `type`(SOURCE/AGENT/CASE/ACTION), `label`, `refId`, `occurredAt`, `payload` |
| **LineageEdgeDto** | `fromId`, `toId` |
| **LineageGraphDto** | `resourceKey`, `nodes`, `edges` |

- **FE 타입**: `libs/shared-utils`의 `synapse-data-api.ts`에 `LineageNodeDto`, `LineageEdgeDto`, `LineageGraphDto` 정의됨. `getLineage()` 응답은 `LineageResponse`로, `nodes`/`edges`(및 선택적 `resourceKey`)를 담도록 확장됨.
- **어댑터**: 기존 `LineageFlow`가 받는 `LineageStep[]` 형태가 필요하면, **graph → steps** 변환을 adapter에서 수행한다.  
  - `nodes`를 `occurredAt` 기준 정렬한 뒤, `LineageNodeDto` → `{ id, name: label, timestamp: occurredAt, status, system: type, ... }` 형태로 매핑.  
  - Desktop Flow: nodes + edges로 직접 다이어그램을 그리거나, 위 adapter로 만든 steps로 기존 LineageFlow 재사용.  
- **Simple Timeline (모바일)**: `nodes`를 `occurredAt` 순으로 정렬한 리스트로 렌더. 각 행에 `type`별 아이콘, `label`, `occurredAt` 표시.
