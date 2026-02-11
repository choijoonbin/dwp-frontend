# Level 4 Functional & API Binding Audit (Frontend)

**원칙**: Single Source of Truth(백엔드)에 따른 인터랙션·API 바인딩 전수 점검  
**점검일**: 2026-02-11  
**대상**: 1차 테스트 메뉴 — 통합 워크벤치, 지식·정책 허브, 시스템 알림

---

## 1. [통합 워크벤치] 상세 기능 점검

### 1.1 Case List — 리스크 등급 배지 & KPI

| 항목 | 호출 API | 바인딩 컴포넌트 | PASS 여부 | 비고 |
|------|----------|-----------------|-----------|------|
| 리스크 등급별 컬러 배지 | `GET /api/synapse/cases` | `WorkbenchQueuePanel`, `SeverityBadge`, `caseListDtoToUi` | **PASS** | `getCases()` → `CaseListRowDto.severity` → adapter `mapSeverity()` → `CaseListItem.severity` → `SeverityBadge`(critical/high/medium/low → error/warning/info/success) |
| KPI 애니메이션 | `GET /api/synapse/cases` | (동일) | **CONDITIONAL** | Case List 데이터와 동기화되는 별도 KPI 위젯/애니메이션 컴포넌트는 소스에서 확인되지 않음. 큐 패널 자체는 `useCasesListQuery`와 동기화됨 |

- **API**: `libs/shared-utils/src/api/synapse-operations-api.ts` — `getCases(params)`  
- **Query**: `useCasesListQuery` → `libs/shared-utils/src/queries/use-synapse-operations-query.ts`  
- **Adapter**: `apps/remotes/synapsex/src/pages/cases/adapters/case-list-adapter.ts` — `caseListDtoToUi`  
- **UI**: `apps/remotes/synapsex/src/pages/workbench/components/WorkbenchQueuePanel.tsx` (리스트), `SeverityBadge` (배지)

---

### 1.2 Item Grid — fi_doc_item (buzei, hkont, wrbtr, sgtxt)

| 항목 | 호출 API | 바인딩 컴포넌트 | PASS 여부 | 비고 |
|------|----------|-----------------|-----------|------|
| fi_doc_item 규격 1:1 매칭 | `GET /api/synapse/cases/{caseId}` | `WorkbenchItemDetailGrid`, `CaseLineItemsCard`, `useCaseDetail` | **PASS** | Case detail 응답 `evidence.documentOrOpenItem.items[]` → `use-case-detail.ts`에서 `buzei`, `hkont`, `wrbtr`, `dmbtr`, `waers`, `sgtxt` 등 매핑 |
| 통화 단위(Currency) 변환 | (동일) | `WorkbenchItemDetailGrid`, `case-line-items-card` | **PASS** | `formatAmount(wrbtr, dmbtr, waers, shkzg)` 사용, `waers`/전표 레벨 통화 fallback 적용 |

- **API**: `getCaseDetail(caseId)` — `synapse-operations-api.ts`  
- **Hook**: `useCaseDetail(caseId)` → `evidence.documentOrOpenItem.items` → `FiDocItem[]`  
- **UI**: `WorkbenchItemDetailGrid` (워크벤치), `CaseLineItemsCard` (케이스 상세), `case-detail-left-panel`  
- **필드**: `buzei`, `hkont`, `wrbtr`, `dmbtr`, `waers`, `sgtxt`, `shkzg` 등 BE DTO와 1:1 대응

---

### 1.3 Action Execution — 승인/거절 (백엔드 엔드포인트, comment)

| 항목 | 호출 API | 바인딩 컴포넌트 | PASS 여부 | 비고 |
|------|----------|-----------------|-----------|------|
| 백엔드 엔드포인트 호출 (Aura 아님) | `POST /api/synapse/cases/{caseId}/action-proposals/{proposalId}/decision` | `CaseActionProposalsTab`, `useApproveProposalMutation`, `useRejectProposalMutation` | **PASS** | `submitActionProposalDecision(caseId, proposalId, { decision: 'APPROVE'\|'REJECT', comment? })` 사용. Aura 직접 호출 없음 |
| 사용자 코멘트(comment_text) 전송 | (동일) | `CaseActionProposalsTab` | **CONDITIONAL FAIL** | API·뮤테이션은 `comment` 파라미터 지원. UI에서 승인/거절 클릭 시 **코멘트 입력 필드 없이** `mutate({ caseId, proposalId })`만 호출 → comment 미전송. BE가 `comment_text` 필드 필수/권장 시 UI에서 코멘트 입력 후 전달 필요 |

- **API**: `libs/shared-utils/src/api/synapse-analysis-api.ts` — `submitActionProposalDecision`, `approveActionProposal`, `rejectActionProposal` (decision API 사용)  
- **Query/Mutation**: `use-synapse-operations-query.ts` — `useApproveProposalMutation`, `useRejectProposalMutation` (내부에서 `submitActionProposalDecision` 호출)  
- **UI**: `apps/remotes/synapsex/src/pages/cases/components/case-action-proposals-tab.tsx` — 승인/거절 버튼만 있고 코멘트 입력 없음  

**권장**: BE가 `comment`/`comment_text` 수신 시, `CaseActionProposalsTab`에 텍스트 필드 추가 후 `approveMutation.mutate({ caseId, proposalId, comment })` 형태로 전달.

---

### 1.4 History Timeline — agent_case_action_history, ISO8601 → 로컬 타임존

| 항목 | 호출 API | 바인딩 컴포넌트 | PASS 여부 | 비고 |
|------|----------|-----------------|-----------|------|
| 이력 데이터 소스 | `GET /api/synapse/cases/{caseId}/audit-events` | `WorkbenchActionHistoryTimeline`, `workbench/index.tsx` | **PASS** | 워크벤치에서는 `useCaseAuditEventsQuery` → `auditData.items`를 `AgentCaseActionHistoryItem[]`으로 매핑해 타임라인에 전달. (BE가 agent_case_action_history를 audit-events로 노출하는 경우 동일 데이터) |
| ISO8601 → 로컬 타임존 표시 | (동일) | `WorkbenchActionHistoryTimeline` | **PASS** | `formatActionAt(actionAt)`: `new Date(actionAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })` 사용 → 사용자 로컬 타임존으로 파싱·표시 |

- **API**: `getCaseAuditEvents(caseId, params)` — `synapse-operations-api.ts`  
- **Query**: `useCaseAuditEventsQuery`  
- **UI**: `WorkbenchActionHistoryTimeline` — `actionAt`, `actorName`, `comment` 표시  
- **매핑**: `workbench/index.tsx` — `auditData.items` → `{ id, actorName, actionAt: item.createdAt, comment }`

---

## 2. [지식·정책 허브] 상세 기능 점검

### 2.1 Upload — MultipartFile vs RagController

| 항목 | 호출 API | 바인딩 컴포넌트 | PASS 여부 | 비고 |
|------|----------|-----------------|-----------|------|
| 업로드 규격 일치 | `POST /api/synapse/rag/documents` | `RegisterRagDocumentModal`, `useRegisterRagDocumentMutation` | **CONDITIONAL** | FE는 **JSON body**만 전송: `RegisterRagDocumentRequest` (title, sourceType, s3Key?, url?, checksum?). **MultipartFile(파일 바이너리) 업로드는 미구현.** BE RagController가 MultipartFile 수신 시 FE에 파일 업로드 UI + FormData 전송 추가 필요. S3/URL 기반 등록만 사용 시 PASS |

- **API**: `registerRagDocument(body)` — `libs/shared-utils/src/api/synapse-knowledge-api.ts`  
- **UI**: `apps/remotes/synapsex/src/pages/rag/components/register-rag-document-modal.tsx` — 제목, sourceType, S3 Key, URL, checksum 입력

---

### 2.2 Status Sync — 학습 중 → 완료 실시간 반영

| 항목 | 호출 API / 수신 경로 | 바인딩 컴포넌트 | PASS 여부 | 비고 |
|------|----------------------|-----------------|-----------|------|
| 웹소켓으로 상태 즉시 반영 | RAG 전용 WebSocket 미확인 | `RagPage`, `useRagDocumentsQuery` | **CONDITIONAL FAIL** | RAG 문서 목록은 `GET /api/synapse/rag/documents` + `useRagDocumentsQuery` (staleTime 1분). **백엔드가 Redis 신호를 웹소켓으로 전달하는 RAG 전용 채널은 소스에 없음.** 알림 WebSocket(`/ws/notifications`)의 `training_complete` 시 토스트만 있고, RAG 목록 쿼리 무효화/refetch 연동 없음 → 새로고침 전까지 '학습 중'→'완료' 배지 갱신 안 됨. 학습 완료 시 `['synapse','rag']` invalidate 또는 RAG 전용 WS 구독 시 PASS |

- **현재**: 등록 후 `useRegisterRagDocumentMutation` onSuccess에서 `invalidateQueries({ queryKey: ['synapse','rag'] })`로 목록 갱신. 실시간 상태 변경은 미연동.

---

## 3. [시스템 알림]

### 3.1 Deep Link — 알림 클릭 → case_id 상세 라우팅

| 항목 | 호출 API / 데이터 | 바인딩 컴포넌트 | PASS 여부 | 비고 |
|------|------------------|-----------------|-----------|------|
| Deep Link 라우팅 | WebSocket 알림 payload `link` | `NotificationsPopover`, `NotificationRow`, `useNavigate` | **PASS** | 알림 아이템에 `link` 있으면 클릭 시 `navigate(notification.link)` 호출 후 Popover 닫음. BE가 `link`에 `/synapse/cases/{case_id}` 형태로 내려주면 케이스 상세로 정상 이동 |

- **구현**: `apps/dwp/src/layouts/components/notifications-popover.tsx` — `handleNotificationClick` → `navigate(notification.link)`, `handleClosePopover()`  
- **Store**: `notification-store`에 `link` 저장, `use-notification-websocket.ts`에서 `payload.link`를 `addNotification`에 전달  
- **조건**: 백엔드 알림 메시지에 `link` 필드 포함 필요 (예: `"/synapse/cases/123"`).

---

## 4. 점검 대상 메뉴 사용 API 목록

아래는 위 1~3번 메뉴(통합 워크벤치, 지식·정책 허브, 시스템 알림)에서 사용하는 **API 주소** 및 **주요 바인딩 컴포넌트** 요약입니다.

### 4.1 통합 워크벤치

| 메서드 | API 주소 | 용도 | 바인딩 컴포넌트/훅 |
|--------|----------|------|---------------------|
| GET | `/api/synapse/cases` | 케이스 목록 | `WorkbenchQueuePanel`, `useCasesListQuery`, `caseListDtoToUi` |
| GET | `/api/synapse/cases/{caseId}` | 케이스 상세(fi_doc_item 포함) | `useCaseDetail`, `WorkbenchDetailPanel`, `WorkbenchItemDetailGrid` |
| GET | `/api/synapse/cases/{caseId}/audit-events` | 감사 이력(타임라인) | `useCaseAuditEventsQuery`, `WorkbenchActionHistoryTimeline` |
| GET | `/api/synapse/cases/{caseId}/action-proposals?runId=` | 액션 제안 목록 | `CaseActionProposalsTab`, `useCaseActionProposalsQuery` |
| POST | `/api/synapse/cases/{caseId}/action-proposals/{proposalId}/decision` | 승인/거절(comment 포함 가능) | `useApproveProposalMutation`, `useRejectProposalMutation`, `CaseActionProposalsTab` |
| POST | `/api/synapse/cases/{caseId}/action-proposals/{proposalId}/execute` | 제안 실행 | `useExecuteProposalMutation`, `CaseActionProposalsTab` |

(추가로 워크벤치/케이스 상세에서 사용 가능한 API:  
`GET /api/synapse/cases/{caseId}/analysis`, `.../confidence`, `.../similar`, `.../rag/evidence`, `.../analysis-runs`,  
`POST /api/synapse/cases/{caseId}/analysis-runs` 등 — 필요 시 동일 형식으로 목록 확장)

### 4.2 지식·정책 허브 (RAG)

| 메서드 | API 주소 | 용도 | 바인딩 컴포넌트/훅 |
|--------|----------|------|---------------------|
| GET | `/api/synapse/rag/documents` | RAG 문서 목록(상태 포함) | `RagPage`, `useRagDocumentsQuery` |
| POST | `/api/synapse/rag/documents` | RAG 문서 등록(JSON: title, sourceType, s3Key/url 등) | `RegisterRagDocumentModal`, `useRegisterRagDocumentMutation` |
| GET | `/api/synapse/rag/documents/{docId}` | RAG 문서 상세 | `useRagDocumentDetailQuery`, RAG 상세 페이지 |
| GET | `/api/synapse/rag/search?q=` | RAG 검색 | `useRagSearchQuery`, `RagPage` |

### 4.3 시스템 알림

| 구분 | 주소/채널 | 용도 | 바인딩 컴포넌트/훅 |
|------|-----------|------|---------------------|
| WebSocket | `{NX_WS_URL 또는 NX_API_URL}/ws/notifications` | 실시간 알림 수신 | `useNotificationWebSocket`, `notification-store`, `NotificationsPopover` |
| (REST 없음) | — | 알림 목록은 스토어 상태로만 유지 | `useNotificationStore`, `NotificationsPopover` |

---

## 5. 요약

- **PASS**: Case List(배지), Item Grid(fi_doc_item·통화), Action Execution(백엔드 호출), History Timeline(ISO8601→로컬), 알림 Deep Link.  
- **CONDITIONAL / CONDITIONAL FAIL**:  
  - **Action Execution**: API는 comment 지원, UI에서 코멘트 미입력·미전송 → BE `comment_text` 요구 시 UI 보완 필요.  
  - **RAG Upload**: JSON만 전송, MultipartFile 미사용 → BE가 파일 업로드만 받는 경우 FE에 파일 업로드 추가 필요.  
  - **RAG Status Sync**: 학습 완료 시 RAG 목록 자동 갱신/웹소켓 연동 없음 → 새로고침 없이 상태 반영하려면 invalidate 또는 RAG 전용 WS 구독 필요.  
- **KPI 애니메이션**: Case List와 동기화되는 별도 KPI 컴포넌트는 미확인; 있으면 동일 원칙으로 API 바인딩 점검 권장.

이 문서는 소스 레벨 점검 결과이며, 백엔드 실제 계약(comment_text 필드명, MultipartFile 여부, RAG WS 경로 등)과 비교해 최종 PASS/FAIL을 조정할 수 있습니다.
