# 테스트 데이터 생성 프로세스 — 프론트엔드 점검 체크리스트

시연/테스트 데이터 생성 플로우에서 **프론트에 해당되는 부분**이 명세대로 구현·연동되었는지 정리한 문서입니다.

---

## 1단계: [프론트] 테스트 데이터 생성 요청

| 항목 | 명세 | 구현 위치 | 상태 |
|------|------|-----------|------|
| 시연 제어 메뉴 | 사용자가 시나리오·강도 선택 후 '생성' 클릭 | `apps/remotes/synapsex/src/pages/demo-control/index.tsx` | ✅ |
| 시나리오 선택 | split_payment, weekend_use, limit_excess (카드별) | `SCENARIOS`, `scenario_type` → BE 전달 | ✅ |
| 강도(Intensity) | NORMAL / WARNING / VIOLATION (Radio) | `INTENSITY_OPTIONS`, `cardState[].intensity` | ✅ |
| 생성 건수 | 1~10 (Slider) | `total_count` in `cardState` | ✅ |
| 생성 버튼 | 시나리오별 "생성" 클릭 | `handleGenerate(scenarioKey, scenario_type)` | ✅ |
| API 호출 | POST /api/demo/generate | `libs/shared-utils/src/api/synapse-demo-api.ts` — `generateDemo({ scenario_type, total_count, intensity })` | ✅ |
| 생성 후 이동 | 워크벤치로 이동 | `navigate('/synapse/workbench')` | ✅ |
| 스트림 확인 | 워크벤치 진입 후에도 Thought 스트림 확인 가능 | CASE_ACTION/ANALYSIS_STARTED 수신 시 해당 케이스 자동 선택(`suggestedSelectCaseId`) → **중앙 상세의 추론 탭**에 타자 효과 표시 | ✅ |

---

## 2단계: [백엔드] 가상 SAP 데이터 생성 및 1차 탐지 + [보완] CASE_ACTION 알림

| 항목 | 명세 | 구현 위치 | 상태 |
|------|------|-----------|------|
| 케이스 생성 시 알림 | 케이스 생성 즉시 프론트로 CASE_ACTION 알림 | WebSocket `/topic/notifications` 수신 | ✅ |
| 상단 토스트 | CASE_ACTION / case_created 시 토스트 표시 | `use-notification-websocket.ts`: `cat/typ === 'CASE_ACTION'` 또는 `payload.event === 'case_created'` → 토스트 메시지 | ✅ |
| 토스트 문구 | "🚨 새로운 위반 의심 케이스 탐지! Aura가 분석을 시작합니다." | 동일 | ✅ |
| 워크벤치 리스트 갱신 | CASE_ACTION 수신 시 케이스 리스트 Refetch | `layout.tsx` onReceive: `queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] })` | ✅ |

---

## 3단계: [백엔드 → Aura] AI 분석 트리거

백엔드 자동 호출. 프론트 별도 버튼/액션 없음.  
프론트는 **ANALYSIS_STARTED** 수신 시 "분석 중" 표시 및 리스트 무효화만 담당.

---

## 4단계: [Aura → 백엔드] 실시간 사고 체인 + [보완] THOUGHT_STREAM

| 항목 | 명세 | 구현 위치 | 상태 |
|------|------|-----------|------|
| Thought 스트리밍 수신 | 백엔드가 '생각' 수신 시마다 THOUGHT_STREAM 이벤트 전송 | WebSocket: `category/type === 'THOUGHT_STREAM'` 처리 | ✅ |
| 상세 페이지 반영 | 해당 케이스 상세의 ThoughtChainUI에 스트리밍 반영 | `layout` onReceive → Aura 스토어 `addThoughtChain` / `updateThoughtChain` (현재 상세 case_id 일치 시만) | ✅ |
| 타자 효과 | "상세 페이지에서 AI가 타자를 치는 것처럼 보임" | `WorkbenchThoughtChain`: `isStreamingLast` 시 마지막 thought에 `TypewriterText` 적용 | ✅ |
| 컨텍스트 정합성 | run_id / case_id로 "해당 상세"와 매칭 | `workbench-reactive-store`: `currentThoughtStreamCaseId`, `streamingThoughtIdByRun`; 케이스 선택 시 `setThoughtStreamContext` | ✅ |

---

## 5단계·6단계: 최종 분석 결과 및 백엔드 인서트

백엔드 처리. 프론트는 아래와 같이 **이미 구현된 API·UI**로 반영됩니다.

| 백엔드 저장 항목 | 프론트 반영 | 구현 위치 | 상태 |
|------------------|-------------|-----------|------|
| agent_case (위반 등급·상태) | 케이스 목록/상세의 status, severity | `useCaseDetail`, `caseDetailDtoToUi`, `caseListDtoToUi`, StatusBadge/SeverityBadge | ✅ |
| case_analysis_result | 상세의 reasoning, 분석 결과 탭 등 | `use-case-detail.ts`: `reasoning`, `aiThoughts` (dto.reasoning / dto.aiThoughts) | ✅ |
| action_proposal | 액션 제안 탭, 승인/거절 | `CaseActionProposalsTab`, `useCaseActionProposalsQuery`, decision/execute 뮤테이션 | ✅ |
| thought_chain_log | 시연 후 근거 조회 (사고 과정) | 상세 API `aiThoughts` / `reasoning.thoughts`로 노출 시 동일 ThoughtChain UI로 표시 | ✅ (BE가 상세 응답에 포함 시) |

---

## 실시간 이벤트 요약 (프론트 수신부)

| 이벤트 | 트리거 | 프론트 액션 |
|--------|--------|-------------|
| **CASE_ACTION** (case_created) | 케이스 생성 | 토스트 표시, `['synapse','cases']`, `['synapse','dashboard','agent-stream']` 무효화 |
| **ANALYSIS_STARTED** | Aura 분석 시작 | `addAnalyzing(case_id)`, 동일 쿼리 무효화 → 워크벤치 큐에 "분석 중" 칩 |
| **THOUGHT_STREAM** | Aura 사고 청크 | 현재 상세 case_id 일치 시 Aura 스토어에 thought 추가/추가 입력 → 상세 ThoughtChain + 타자 효과 |
| 상태 종료 | 케이스 status !== IN_PROGRESS | `WorkbenchQueuePanel`: 리스트 항목 기준 `removeAnalyzing(id)` → "분석 중" 칩 제거 |

---

## 참고 파일

- 시연 제어: `apps/remotes/synapsex/src/pages/demo-control/index.tsx`
- 데모 API: `libs/shared-utils/src/api/synapse-demo-api.ts`
- WebSocket 수신: `libs/shared-utils/src/notifications/use-notification-websocket.ts`
- 레이아웃 onReceive: `apps/dwp/src/layouts/dashboard/layout.tsx`
- 워크벤치 스토어: `libs/shared-utils/src/workbench/workbench-reactive-store.ts`
- 워크벤치 큐(분석 중 칩): `apps/remotes/synapsex/src/pages/workbench/components/WorkbenchQueuePanel.tsx`
- 워크벤치 상세·Thought: `WorkbenchDetailPanel.tsx`, `WorkbenchThoughtChain.tsx`
- Aura 스토어(thought): `libs/shared-utils/src/aura/use-aura-store.ts`
- 케이스 상세(aiThoughts·reasoning·action): `use-case-detail.ts`, `case-detail-adapter.ts`

---

**결론**: 테스트 데이터 생성 프로세스에서 프론트에 해당하는 기능(1단계 생성 요청, 2단계 CASE_ACTION 토스트·리스트 갱신, 4단계 THOUGHT_STREAM·타자 효과, 5·6단계 결과 표시)은 명세대로 정리·연동되어 있습니다. 상단 토스트, 워크벤치 리스트 무효화, "분석 중" 칩, 상세 Thought 스트리밍·타자 효과가 모두 반영되어 있습니다.

**스트림이 보이는 위치**  
- **추론 탭**: 워크벤치 **중앙(상세)** 패널의 **「추론」 탭**에서 THOUGHT_STREAM이 실시간 타자 효과로 표시됩니다. (WorkbenchThoughtChain)  
- **에이전트 스트림**: **우측** 패널은 대시보드 agent activity 로그(API `GET /api/synapse/dashboard/agent-stream`)용이며, WebSocket THOUGHT_STREAM과는 별도입니다.

**스트림 확인 흐름 (생성 후 자동 이동)**  
1. 생성 클릭 → API 성공 → **케이스 목록 쿼리 무효화** → `/synapse/workbench`로 이동.  
2. 워크벤치 좌측 목록: 무효화로 최신 목록 요청. **Detect가 비동기**이면 케이스가 아직 없을 수 있음 → 목록이 비었을 때 **한 번 2.5초 후 재요청**.  
3. 백엔드가 케이스 생성·분석 시작 시 WebSocket으로 CASE_ACTION / ANALYSIS_STARTED 전송 (payload에 `case_id` 또는 `caseId` 포함 필요).  
4. 수신 시 해당 케이스 ID를 `suggestedSelectCaseId`에 설정.  
5. 워크벤치 페이지에서 `suggestedSelectCaseId`가 설정되면 해당 케이스를 **자동 선택**하고 제안값 클리어.  
6. 이후 도착하는 THOUGHT_STREAM이 선택된 케이스와 일치하므로 **중앙 상세의 추론 탭**에서 실시간 Thought 타자 효과로 확인 가능.

**좌측 케이스가 안 보일 때**  
- 백엔드 `GET /api/synapse/cases`가 생성된 케이스를 반환하는지 확인 (Detect 완료 후 DB 반영·동일 tenantId).  
- 프론트는 생성 성공 시 목록 무효화 + 워크벤치에서 목록 비었을 때 2.5초 후 한 번 재요청함.

**에이전트 스트림(우측)**  
- `GET /api/synapse/dashboard/agent-stream` 데이터가 있을 때만 로그가 표시됨. 백엔드에서 분석 시 해당 API로 활동을 적재해야 함.
