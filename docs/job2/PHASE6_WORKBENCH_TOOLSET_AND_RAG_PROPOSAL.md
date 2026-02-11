# Phase 6: Integrated Knowledge UI & RAG Pipeline Visualization — 제안

## Pre-Check 답변 (MUST ANSWER BEFORE CODING)

### 1. RagView / PolicyView / Guardrails 컴포넌트의 모달 내 렌더링 가능 여부

**현재 상태: 아니오 (관심사 분리 미비)**

- **RagPage** (`apps/remotes/synapsex/src/pages/rag/index.tsx`): 단일 페이지 컴포넌트. `useNavigate`, 상단 헤더(타이틀+등록 버튼), `Box sx={{ p: { xs: 2, sm: 3 } }}` 등 **페이지 전용 레이아웃**이 본문과 한 덩어리로 작성되어 있음.
- **PoliciesPage** (`apps/remotes/synapsex/src/pages/policies/index.tsx`): 동일. 헤더 + 테이블이 한 컴포넌트 안에 있음.
- **GuardrailsPage** (`apps/remotes/synapsex/src/pages/guardrails/index.tsx`): 동일. 리스트 + 에디터 모달 + 평가 패널이 페이지 단위로만 존재.

**따라서** 모달에서 “기존 화면”을 그대로 쓰려면 **뷰 분리**가 선행되어야 함.

- **제안**:  
  - 각 페이지에서 **콘텐츠만 담당하는 Presentational 컴포넌트**를 추출 (예: `RagViewContent`, `PoliciesViewContent`, `GuardrailsViewContent`).  
  - 이 컴포넌트는 **헤더/패딩/전체 페이지 레이아웃을 받지 않고**, `children` 또는 `slotProps`로 제목/액션을 주입받거나, **`embedMode?: boolean`** prop으로 “모달/드로어 내부”일 때 헤더/패딩을 생략하도록 분기.  
  - **페이지 컴포넌트**는 기존처럼 라우트에서만 사용하고, “제목 + [등록] 버튼 + 콘텐츠”를 렌더; **모달/드로어**는 `Dialog`/`Drawer` + `RagViewContent`(등)만 렌더.

---

### 2. 모바일에서 대형 모달의 fullScreen 조건부 적용

**현재 상태: 미적용**

- RAG의 `RegisterRagDocumentModal`은 `Dialog`만 사용하며 `fullScreen` 없음.  
- Policies/Guardrails 페이지 자체는 단독 페이지로만 열리므로 모달이 없음.

**제안**

- 워크벤치에서 띄우는 **지식/정책/가드레일 모달(또는 Drawer)** 에 대해:
  - `useMediaQuery(theme.breakpoints.down('sm'))` 또는 `down('md')` 로 모바일 여부 판단.
  - `Dialog` 사용 시: `fullScreen={isMobile}` 로 설정하여 모바일에서 전체 화면으로 표시.
  - `Drawer` 사용 시: `variant="temporary"` + `anchor="right"` (또는 bottom on mobile) 로 이미 전체 화면에 가깝게 동작하므로, 필요 시 `sx={{ width: { xs: '100%', sm: 480 } }}` 등으로 데스크톱만 너비 제한.

---

## Task 1: 워크벤치 툴바 + 지식/정책/가드레일 모달 연동

### 1.1 구조 요약

- **위치**: 통합 워크벤치 상단 (탭 바로 위, 또는 탭과 같은 줄 우측).
- **버튼 3개**: [지식 관리(RAG)] [정책 설정] [가드레일].
- **동작**: 클릭 시 **페이지 이동 없이** MUI `Dialog`(또는 `Drawer`)를 열고, 기존 RAG/정책/가드레일 **콘텐츠**를 모달 안에서 렌더 (위 Pre-Check에 따라 추출한 Content 컴포넌트 사용).

### 1.2 수정/추가 파일 제안

| 파일 | 역할 |
|------|------|
| `apps/remotes/synapsex/src/pages/rag/index.tsx` | `RagViewContent` 추출. `embedMode?: boolean` 이면 헤더/패딩 최소화, 등록 버튼은 유지(모달 내에서도 등록 가능). |
| `apps/remotes/synapsex/src/pages/rag/components/rag-view-content.tsx` | **(신규)** `RagPage` 본문만 담당. props: `embedMode?: boolean`, `onClose?: () => void` (모달일 때 닫기 콜백). |
| `apps/remotes/synapsex/src/pages/policies/index.tsx` | `PoliciesViewContent` 추출. |
| `apps/remotes/synapsex/src/pages/policies/components/policies-view-content.tsx` | **(신규)** 정책 리스트+검색 본문. |
| `apps/remotes/synapsex/src/pages/guardrails/index.tsx` | `GuardrailsViewContent` 추출. |
| `apps/remotes/synapsex/src/pages/guardrails/components/guardrails-view-content.tsx` | **(신규)** 가드레일 리스트+에디터 연동 본문. |
| `apps/remotes/synapsex/src/pages/workbench/components/WorkbenchToolbar.tsx` | **(신규)** 툴바: [지식 관리(RAG)] [정책 설정] [가드레일] 버튼 + 각 모달 상태. |
| `apps/remotes/synapsex/src/pages/workbench/components/WorkbenchKnowledgeModal.tsx` | **(신규)** Dialog/Drawer + `RagViewContent`. `fullScreen={useMediaQuery(theme.breakpoints.down('sm'))}`. |
| `apps/remotes/synapsex/src/pages/workbench/components/WorkbenchPoliciesModal.tsx` | **(신규)** 동일 패턴, `PoliciesViewContent`. |
| `apps/remotes/synapsex/src/pages/workbench/components/WorkbenchGuardrailsModal.tsx` | **(신규)** 동일 패턴, `GuardrailsViewContent`. |
| `apps/remotes/synapsex/src/pages/workbench/index.tsx` | 상단에 `WorkbenchToolbar` 추가, 툴바 상태에 따라 모달 3개 렌더. |

### 1.3 툴바/모달 코드 스케치

**WorkbenchToolbar**

- 3개 버튼. 아이콘 + 라벨(i18n: `menu.knowledge-management`, `menu.policies`, `menu.guardrails` 등).
- 상태: `ragOpen`, `policiesOpen`, `guardrailsOpen` (useState).
- 버튼 클릭 시 해당 `open` 만 true. 모달은 `onClose` 시 해당 `open` false.

**WorkbenchKnowledgeModal (RAG)**

```tsx
// 의사 코드
export const WorkbenchKnowledgeModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog open={open} onClose={onClose} fullScreen={isMobile} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('menu.workbench.tools.rag')}  {/* 지식 관리(RAG) */}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>...</IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <RagViewContent embedMode onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
};
```

- `RagViewContent`: 기존 `RagPage` 본문(검색, 테이블, 등록 모달)만 렌더. `embedMode` 시 상단 큰 타이틀/패딩 제거 또는 축소.

**정책/가드레일 모달**

- 동일 패턴. `PoliciesViewContent`, `GuardrailsViewContent` 를 `DialogContent` 안에 넣고, `fullScreen={isMobile}` 적용.

### 1.4 라우트와의 관계

- 기존 `/synapse/rag`, `/synapse/policies`, `/synapse/guardrails` 라우트는 **그대로 두고** 페이지 컴포넌트(`RagPage` 등)가 기존처럼 전체 레이아웃으로 렌더.
- 워크벤치 툴바는 **같은 콘텐츠**를 모달로만 여는 것이므로, 라우트 변경 없이 구현 가능.

---

## Task 2: RAG 벡터화 진행 UI + 전역 갱신

### 2.1 현재 동작

- **등록**: `useRegisterRagDocumentMutation` 호출 → 성공 시 `queryClient.invalidateQueries({ queryKey: ['synapse', 'rag'] })` + 토스트 + 모달 닫기.
- **문서 상태**: `getRagDocuments` 응답의 `status` (`indexed` | `indexing` | `error`). 등록 직후 백엔드가 비동기로 벡터화하면, 리스트를 다시 조회해야 `indexing` → `indexed` 로 보임.
- **진행 UI**: 현재 “벡터화 중”을 실시간으로 보여주는 전용 Progress UI는 없음. 리스트 테이블의 `statusMeta.indexing` 아이콘/라벨만 존재.

### 2.2 RAG Ingestion Progress UI 제안

1. **등록 후 모달 동작**
   - 등록 요청 성공 후 **등록 모달을 바로 닫지 않고**, “등록됨. 벡터화 중입니다.” 같은 메시지 + **해당 docId(또는 title)에 대한 Progress** 를 같은 모달 안에 표시.
   - 또는 등록 모달은 닫고, **RAG 리스트 뷰(페이지 또는 워크벤치 RAG 모달)** 에서 “방금 등록된 문서” 한 줄을 **로컬 상태**로 추가하고, 그 행에만 `LinearProgress` + “Vectorizing...” 표시.

2. **실시간 상태 반영**
   - **폴링**: `status === 'indexing'` 인 문서가 하나라도 있으면 `useRagDocumentsQuery` 에 `refetchInterval: 3000` (또는 2초) 적용. 리스트에 `indexing` 인 행은 `statusMeta.indexing` + `LinearProgress` (indeterminate 또는 백엔드에서 % 제공 시 determinate) 표시.
   - **선택**: 백엔드에 “ingestion progress” API(예: GET `/api/synapse/rag/documents/:docId/ingestion-status`)가 있으면, 방금 등록한 docId에 대해 해당 API를 폴링하여 진행률을 표시.

3. **벡터화 완료 시**
   - 폴링으로 리스트를 다시 가져오면 해당 문서가 `indexed` 로 바뀜.
   - **전역 갱신**: 아래 2.3 참고.

### 2.3 “워크벤치 리스트에서 해당 규정 즉시 참조” / 전역 상태

- **useAuraStore**: 현재 Aura 스토어는 **채팅/타임라인/HITL/플로팅 버튼** 등에만 사용되며, RAG 문서 목록 상태는 없음.
- **제안 (단순 안)**  
  - **React Query 무효화만으로 충분**: `useRegisterRagDocumentMutation` 의 `onSuccess` 에서 이미 `queryClient.invalidateQueries({ queryKey: ['synapse', 'rag'] })` 를 호출하고 있음.  
  - 워크벤치에서 “규정/지식 리스트”를 보여주는 UI가 **같은 `useRagDocumentsQuery`**(또는 같은 queryKey)를 구독하면, invalidate 시 자동으로 refetch 되어 **즉시 참조 가능**.
- **제안 (강조가 필요할 때)**  
  - “방금 인덱싱 완료된 문서”를 워크벤치 한 곳에 배지/토스트로 알리려면:
    - **옵션 A**: `onSuccess` 후 `refetch` 완료 시점에 `showToast(t('rag.indexingComplete'))` 또는 doc title 포함 메시지.
    - **옵션 B**: Aura 스토어에 `lastIndexedDocIds: string[]` + `actions.addLastIndexedDoc(docId)` 를 두고, RAG mutation 성공 + (폴링으로) status가 indexed 로 바뀐 시점에 `addLastIndexedDoc(docId)` 호출. 워크벤치 좌측 리스트나 툴바 옆에서 “새 규정 반영됨” 같은 배지를 구독해서 표시.

실무적으로는 **Query 무효화 + (필요 시) 폴링 중/완료 토스트**만으로도 “즉시 참조” 요구사항을 만족할 수 있음.

### 2.4 수정/추가 파일 제안 (Task 2)

| 파일 | 역할 |
|------|------|
| `apps/remotes/synapsex/src/pages/rag/components/register-rag-document-modal.tsx` | 변경 최소화. 부모에서 “등록 중”일 때 버튼 비활성화 + 로딩 아이콘은 유지. |
| `apps/remotes/synapsex/src/pages/rag/index.tsx` (또는 `rag-view-content.tsx`) | `useRagDocumentsQuery` 에 `refetchInterval: items.some(d => d.status === 'indexing') ? 3000 : 0` 적용. 테이블에서 `status === 'indexing'` 인 행에 `LinearProgress` + “Vectorizing...” 라벨 표시. |
| `libs/shared-utils/src/queries/use-synapse-knowledge-query.ts` | `useRegisterRagDocumentMutation` 의 `onSuccess` 에서 기존처럼 `invalidateQueries(['synapse','rag'])` 유지. (옵션) 완료 토스트 메시지 추가. |
| (옵션) `libs/shared-utils/src/aura/use-aura-store.ts` | “방금 인덱싱된 문서” 배지용 `lastIndexedDocIds` + `addLastIndexedDoc` 추가. 워크벤치에서만 구독. |

---

## 요약 체크리스트

- [ ] **Pre-Check 1**: RAG/정책/가드레일 페이지에서 **ViewContent** 형태로 콘텐츠 컴포넌트 추출 (`embedMode` 또는 slot으로 모달 대응).
- [ ] **Pre-Check 2**: 워크벤치 지식/정책/가드레일 모달에 **fullScreen={isMobile}** (또는 Drawer variant) 적용.
- [ ] **Task 1**: 워크벤치 상단 툴바 + [지식 관리(RAG) | 정책 설정 | 가드레일] 버튼 + 각각 Dialog/Drawer + 기존 콘텐츠 재사용.
- [ ] **Task 2**: RAG 리스트에서 `indexing` 상태 행에 **Progress UI**(LinearProgress + “Vectorizing...”) 보강; `refetchInterval` 로 폴링; 벡터화 완료 후 **Query 무효화**로 워크벤치 포함 전역 리스트 갱신, (옵션) 토스트 또는 Aura 스토어 배지.

이 제안대로 구현 시, 워크벤치 내 도구함 버튼 및 RAG 모달 연동과 RAG 벡터화 진행 UI·전역 갱신을 일관되게 적용할 수 있습니다.
