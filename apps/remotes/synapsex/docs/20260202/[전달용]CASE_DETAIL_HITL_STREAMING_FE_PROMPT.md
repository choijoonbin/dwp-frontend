# SynapseX Case Detail HITL/Streaming 연결 — 프론트엔드 전달 프롬프트

> **목적**: Case Detail 3-Panel에서 Agent 스트리밍 + HITL 승인 + Simulation 비교를 실제 동작으로 구현  
> **대상**: SynapseX(React) 프론트엔드 개발자  
> **작성일**: 2026-02-02  
> **참고**: DWP `.cursorrules`, `docs/essentials/PROJECT_RULES.md`

---

## 1. 목표

**Case Detail 3-Panel** (`/cases/:id`)에서 다음을 실제 API 연동으로 동작시킨다:

1. **Agent Stream Panel** — SSE 스트리밍으로 Agent 추론/결과를 타임라인 UI에 렌더
2. **HITL 승인 Drawer/Modal** — 승인/반려 버튼 → API 호출 → 상태 즉시 반영
3. **Simulation toggle + before/after diff viewer** — Simulation Mode ON 시 API 호출 후 diff 하이라이트

---

## 2. 라우트/화면 연결

| 항목 | 값 |
|------|-----|
| **라우트** | `/synapse/cases/:id` 또는 `/cases/:id` (pathname-to-page 기준) |
| **페이지** | `apps/remotes/synapsex/src/pages/case-detail.tsx` |
| **훅** | `pages/cases/hooks/use-case-detail.ts` (기존 `useCaseDetailQuery` 사용) |

**3-Panel 레이아웃 (기존)**:
- **Left**: Source Evidence (FI Document, Document Relationship)
- **Center**: Analysis / Agent Stream / Simulation
- **Right**: Actions / Audit / HITL

---

## 3. 기존 인프라 활용 (libs/shared-utils)

### 3.1 Agent/HITL 관련 모듈

| 모듈 | 경로 | 용도 |
|------|------|------|
| **HITL API** | `libs/shared-utils/src/agent/hitl-api.ts` | `approveHitlRequest`, `rejectHitlRequest`, `getHitlRequest` |
| **use-agent-stream** | `libs/shared-utils/src/agent/use-agent-stream.ts` | SSE 스트리밍 (현재 `/api/agent/chat-stream` 사용) |
| **stream-store** | `libs/shared-utils/src/agent/stream-store.ts` | 스트림 상태 (CONNECTING, STREAMING, COMPLETED, ERROR 등) |
| **agent-session** | `libs/shared-utils/src/agent/agent-session.ts` | `getAgentSessionId()` |
| **context-util** | `libs/shared-utils/src/agent/context-util.ts` | `getAgentContext()` — tenantId, userId, route 등 |

### 3.2 Synapse 전용 확장 필요

- **Agent Stream**: `use-agent-stream`은 `/api/agent/chat-stream` 사용. Synapse Case Detail용으로 **`POST /api/synapse/agent-tools/agents/finance/stream`** (또는 gateway 규칙에 맞는 path) 전용 훅/API 추가 필요.
- **HITL**: 기존 `approveHitlRequest`/`rejectHitlRequest`는 `/api/aura/hitl/approve`, `/api/aura/hitl/reject` 사용. Synapse 중계 엔드포인트로 변경 시 `hitl-api.ts` 또는 synapse 전용 래퍼 추가.
- **Simulation**: `useSimulateActionMutation` (synapse-operations-api) 존재. Case Detail용 **`POST /api/synapse/agent-tools/actions/simulate`** (caseId/actionId 기반) 연동 필요 시 별도 API/훅 추가.

---

## 4. API 연동 (React Query)

### 4.1 Agent Stream 시작

| 항목 | 내용 |
|------|------|
| **Method** | `POST` |
| **Path** | `/api/synapse/agent-tools/agents/finance/stream` (또는 gateway 규칙에 맞는 path) |
| **Request** | `{ caseId: string, context?: Record<string, unknown> }` |
| **Response** | SSE (`text/event-stream`) |
| **Headers** | `Accept: text/event-stream`, `X-Tenant-ID`, `X-Agent-ID`, `Authorization` |
| **재연결** | `Last-Event-ID` 헤더로 끊긴 지점부터 재개 |

**SSE 이벤트 타입 (예상)**:
- `thought` / `thinking` — 추론 중
- `content` / `message` — 최종 결과 텍스트
- `hitl` — HITL 승인 대기 이벤트 (requestId 포함)

**구현 위치 권장**:
- `libs/shared-utils/src/api/synapse-agent-api.ts` (신규)
- `libs/shared-utils/src/agent/use-synapse-agent-stream.ts` (신규) — `use-agent-stream` 패턴 참고, endpoint만 Synapse용으로 변경

### 4.2 HITL 승인/반려

| 항목 | 내용 |
|------|------|
| **승인** | `POST /api/aura/hitl/approve/{requestId}` (기존) 또는 Synapse 중계 엔드포인트 |
| **반려** | `POST /api/aura/hitl/reject/{requestId}` (기존) |
| **상태 조회** | `GET /api/aura/hitl/requests/{requestId}` |

**기존 함수 사용**:
```typescript
import { approveHitlRequest, rejectHitlRequest } from '@dwp-frontend/shared-utils';
```

**React Query**: `useMutation`으로 래핑, `onSuccess` 시 스트림 재개 또는 UI 상태 갱신.

### 4.3 Simulation

| 항목 | 내용 |
|------|------|
| **Method** | `POST` |
| **Path** | `/api/synapse/agent-tools/actions/simulate` (또는 `POST /api/synapse/actions/{actionId}/simulate` 기존) |
| **Request** | `{ caseId: string, actionId?: string }` 또는 actionId 단일 |
| **Response** | `{ before: Record<string, unknown>, after: Record<string, unknown>, outcome: 'success' | 'failed', ... }` |

**구현**: 기존 `useSimulateActionMutation`(actionId 기반) 활용 또는 caseId 기반 simulate 전용 훅 추가.

---

## 5. UI 컴포넌트 요구사항

### 5.1 Agent Stream Panel (Center Panel 탭)

- **위치**: Center Panel 내 "Agent Stream" 탭
- **기능**:
  - "Start Analysis" 버튼 → Agent Stream API 호출
  - SSE 수신 이벤트를 **타임라인 UI**에 렌더 (thought / content 구분)
  - `thinking` 상태 시 로딩 인디케이터
  - `hitl` 이벤트 수신 시 → HITL Drawer/Modal 자동 오픈

### 5.2 HITL 승인 Drawer/Modal

- **트리거**: SSE `hitl` 이벤트 또는 Agent가 승인 요청 시
- **내용**: 요청 설명, 승인/반려 버튼
- **동작**:
  - 승인 → `approveHitlRequest(requestId)` 호출
  - 반려 → `rejectHitlRequest(requestId, reason?)` 호출
  - **상태 변화 즉시 UI 반영**: `pending_approval` → `approved` → `executing` → `succeeded` / `failed`

### 5.3 Simulation Toggle + Before/After Diff Viewer

- **Simulation Mode ON**:
  - "Run Simulation" 버튼 → `POST .../actions/simulate` 호출
  - 결과 `before` / `after`를 **우측 패널**에 하이라이트(diff) 표시
- **Diff UI**: 필드별 current → new 값, 색상 구분 (추가/삭제/변경)
- **기존 컴포넌트**: `SimulationResultCard` (`components/finance/simulation-result-card.tsx`) — API 응답 구조에 맞게 확장

---

## 6. 공통 UX

### 6.1 상태 뱃지

| 상태 | 표시 | 색상 |
|------|------|------|
| `pending_approval` | Pending Approval | warning |
| `executing` | Executing | info |
| `succeeded` | Succeeded | success |
| `failed` | Failed | error |

**구현**: `StatusPill` (`components/finance/status-pill.tsx`) 또는 Chip + theme 토큰 사용.

### 6.2 Evidence Panel

- **RAG snippet** + **출처 표시** (문서명/버전/페이지 — mocked 가능)
- **기존**: `RagCitationList`, `RagCitationCard` (`components/evidence/`)
- API `reasoning.ragRefsJson` 또는 SSE 이벤트에서 전달 시 연동

### 6.3 장애 대응

| 상황 | 동작 |
|------|------|
| **SSE 끊김** | `Last-Event-ID`로 재연결 시도 (기존 `use-agent-stream` 패턴) |
| **Empty state** | "No stream data" + "Start Analysis" CTA |
| **Error state** | 에러 메시지 + "Retry" 버튼 |
| **HITL 409** | 이미 승인/반려됨 — idempotent 처리, UI 정리 |

---

## 7. DWP 프론트엔드 규칙 준수

- **MUI v5 Only** — shadcn/ui, Radix UI 사용 금지
- **Iconify Only** — Lucide, Heroicons 사용 금지
- **Theme Tokens** — `theme.palette.*`, `theme.spacing()` 사용, 하드코딩 색상 금지
- **API 계층**: `libs/shared-utils/api` → `libs/shared-utils/queries` → `hooks` → `pages/components`
- **파일 크기**: Page 400라인 이하, Component 250라인 이하 — 초과 시 `components/`, `hooks/` 분리
- **any 금지** — `unknown` + type guard 사용

---

## 8. 권장 파일 구조

```
apps/remotes/synapsex/src/pages/
├── case-detail.tsx                    # 3-Panel 레이아웃 (조립만)
└── cases/
    ├── hooks/
    │   ├── use-case-detail.ts         # 기존
    │   ├── use-case-agent-stream.ts    # 신규: Synapse Agent Stream
    │   ├── use-case-hitl.ts            # 신규: HITL 승인/반려 mutation
    │   └── use-case-simulation.ts      # 신규: Simulation API
    └── components/
        ├── case-agent-stream-panel.tsx # Agent Stream 타임라인
        ├── case-hitl-drawer.tsx        # HITL 승인 Drawer/Modal
        ├── case-simulation-diff.tsx     # Before/After diff viewer
        └── case-status-badge.tsx       # 상태 뱃지 (선택)

libs/shared-utils/src/
├── api/
│   └── synapse-agent-api.ts           # 신규: Agent Stream, Simulation
└── agent/
    └── use-synapse-agent-stream.ts     # 신규: Synapse 전용 SSE 훅
```

---

## 9. 체크리스트 (구현 완료 시)

- [ ] Agent Stream Panel: POST → SSE 수신 → 타임라인 렌더
- [ ] HITL Drawer: 승인/반려 → API 호출 → 상태 즉시 반영
- [ ] Simulation: ON 시 API 호출 → before/after diff 표시
- [ ] 상태 뱃지: pending_approval / executing / succeeded / failed
- [ ] Evidence Panel: RAG snippet + 출처 (mocked 가능)
- [ ] 장애 대응: SSE 재연결(Last-Event-ID), Empty/Error/Retry
- [ ] DWP 규칙 준수: MUI, Iconify, theme 토큰, API 계층

---

## 10. 참고 문서

- `docs/essentials/PROJECT_RULES.md`
- `libs/shared-utils/src/agent/use-agent-stream.ts` — SSE 패턴 참고
- `libs/shared-utils/src/agent/hitl-api.ts` — HITL API
- `apps/remotes/synapsex/src/components/finance/simulation-result-card.tsx`
- `apps/remotes/synapsex/src/components/evidence/` — RAG citation
