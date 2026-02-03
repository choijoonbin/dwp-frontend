# SynapseX Remote

> **DWP 플랫폼의 재무·감사·AI 통합 비즈니스 모듈**  
> Vite 기반 Micro Frontend Remote — Host(4200)에서 lazy 로딩

---

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [메뉴 구성 및 연관관계](#2-메뉴-구성-및-연관관계)
3. [AI 구현 계획](#3-ai-구현-계획)
4. [기술 스택 및 아키텍처](#4-기술-스택-및-아키텍처)
5. [진행 현황](#5-진행-현황)
6. [남은 작업](#6-남은-작업)
7. [실행 방법](#7-실행-방법)

---

## 1. 프로젝트 개요

### 1.1 목적

**SynapseX**는 DWP 플랫폼의 핵심 비즈니스 모듈로, 다음 영역을 통합합니다:

| 영역 | 설명 |
|------|------|
| **재무·감사** | 전표, 거래처, 미결제 항목, 정합성 대사, 감사 추적 |
| **이상 징후 탐지** | Anomaly 탐지, 케이스 관리, 조치 실행, HITL 승인 |
| **지식·정책** | RAG 라이브러리, 정책 프로파일, 가드레일, 용어 사전 |
| **거버넌스** | 자율성 설정, RBAC/SoD, 에이전트 구성, 시스템 관리 |
| **AI 통합** | Aura Agentic AI 연동 (SSE 스트리밍, HITL, 컨텍스트 인지) |

### 1.2 참조 소스

- **UI 참조**: `docs/saa-s-ui-design_phase1-4_complete`
- **표준**: MUI v5, Iconify, `@dwp-frontend/design-system`, Theme 토큰
- **라우팅**: 백엔드 Menu Tree API (`GET /api/auth/menus/tree`) 기반 동적 path 등록

---

## 2. 메뉴 구성 및 연관관계

### 2.1 메뉴 트리 구조

메뉴는 **백엔드 Menu Tree API**에서 수신하며, `path` 기준으로 `pathname-to-page.tsx`에서 페이지 매핑됩니다.

```
SynapseX (그룹)
├── 통합 관제 센터 (menu.command-center)     → dashboard.tsx
├── 자율 운영 센터 (menu.autonomous-operations)
│   ├── 자율성 설정 (autonomy)               → autonomy.tsx
│   ├── 케이스 작업함 (cases)                → cases.tsx
│   ├── 이상 징후 (anomalies)                → anomalies.tsx
│   ├── 채권·채무 최적화 (optimization)      → optimization.tsx
│   ├── 조치 실행 (actions)                  → actions.tsx
│   └── 조치 이력 (archive)                  → archive.tsx
├── 원천 데이터·이력 허브 (menu.master-data-history)
│   ├── 전표 (documents)                     → documents.tsx
│   ├── 미결제 항목 (open-items)             → open-items.tsx
│   ├── 거래처 (entities)                    → entities.tsx
│   └── 계보·근거 (lineage)                  → lineage/
├── 지식·정책 허브 (menu.knowledge-policy)
│   ├── RAG 라이브러리 (rag)                → rag.tsx
│   ├── 정책 프로파일 (policies)             → policies.tsx
│   ├── 가드레일 (guardrails)                → guardrails.tsx
│   ├── 용어 사전 (dictionary)               → dictionary.tsx
│   └── 피드백 (feedback)                    → feedback.tsx
├── 대사·감사 센터 (menu.reconciliation-audit)
│   ├── 정합성 대사 (reconciliation)         → reconciliation.tsx
│   ├── 조치 결과 대사 (action-recon)        → action-recon.tsx
│   ├── 감사 로그 (audit)                    → audit-legacy.tsx
│   └── 효과 분석 (analytics)                → analytics.tsx
└── 거버넌스·설정 (menu.governance-config)
    ├── 거버넌스 (governance)                → governance.tsx
    ├── 에이전트 구성 (agent-config)         → agent-config.tsx
    ├── 연동 (integrations)                  → integrations.tsx
    └── 시스템 관리 (admin)                   → admin-legacy.tsx (3탭)
```

### 2.2 상세 페이지 라우트

| 패턴 | 페이지 |
|------|--------|
| `cases/:id` | case-detail.tsx |
| `documents/:id` | document-detail.tsx |
| `entities/:id` | entity-detail.tsx |

### 2.3 메뉴별 연관관계

```
[대시보드] ──────────────────────────────────────────────────────────────
    │
    ├─► [이상 징후] ──► [케이스 작업함] ──► [케이스 상세]
    │         │                  │                  │
    │         │                  └──► [조치 실행] ──► [조치 이력]
    │         │
    │         └──► [RAG] (규정·문서) ──► [정책] ──► [가드레일]
    │
    ├─► [전표] ──► [전표 상세] ──► [계보·근거]
    ├─► [거래처] ──► [거래처 상세]
    ├─► [미결제 항목] ──► [정합성 대사] / [조치 결과 대사]
    │
    ├─► [감사 로그] ◄── [시스템 관리] (Admin 3탭)
    └─► [거버넌스] ──► [자율성] / [에이전트 구성] / [연동]
```

- **케이스 → 조치**: 케이스에서 조치 승인/거절 → 조치 실행 센터에서 일괄 처리 → 조치 이력 보관
- **전표/거래처 → 계보**: 상세 페이지에서 Lineage로 데이터 변환 이력 추적
- **Admin**: Users(공통 Auth API) + Tenant Scope + PII & Encryption 3탭

---

## 3. AI 구현 계획

### 3.1 Aura Agentic AI 연동

**참조**: `docs/specs/aura.md`

| 기능 | 설명 | 구현 방식 |
|------|------|-----------|
| **실시간 스트리밍** | SSE 기반 타이핑 효과 | `POST /api/aura/test/stream` → ReadableStream |
| **사고 과정 시각화** | Thought Trace 타임라인 | `thought`, `thinking` 이벤트 파싱 |
| **HITL 승인** | 중요한 작업 전 사용자 승인 | `checkpoint-approval` 다이얼로그 |
| **컨텍스트 인지** | 현재 페이지/선택 항목 자동 수집 | `usePageContext()` → `context` payload |
| **실행 로그** | 터미널 스타일 실시간 로그 | `live-execution-log` 컴포넌트 |

### 3.2 SynapseX 내 AI 활용 포인트

| 페이지 | AI 활용 |
|--------|---------|
| **케이스 상세** | Anomaly 분석 요약, 조치 제안, Simulation 결과 해석 |
| **조치 실행** | Bulk Action 자동 분류, 승인 우선순위 제안 |
| **계보·근거** | RAG Citation 기반 규정/정책 인용, Evidence 시각화 |
| **용어 사전** | 용어 자동 매핑, 코드 추천 |
| **피드백** | TP/FP 라벨링, Policy Suggestion |

### 3.3 SSE 이벤트 계약

- 이벤트 타입: `libs/shared-utils`에 union type 정의
- UI는 reducer/handler를 통해서만 반영
- `unknown` 이벤트는 무시 + 로그

---

## 4. 기술 스택 및 아키텍처

### 4.1 기술 스택

| 구분 | 기술 |
|------|------|
| **UI** | MUI v5, Iconify (`solar:*`), `@dwp-frontend/design-system` |
| **스타일** | MUI sx, Emotion, Theme 토큰 (`theme.palette.*`, `theme.spacing()`) |
| **라우팅** | react-router-dom |
| **상태** | Zustand (전역 UI), TanStack Query (서버 데이터) |
| **API** | `libs/shared-utils` axiosInstance, ApiResponse\<T\> |

### 4.2 MFE 구조

- **Host**: `apps/dwp` (포트 4200)
- **로딩**: `lazy(() => import('../../../remotes/synapsex/src/synapse-app'))`
- **라우트**: `PathnameDispatcher` → `getPageForPathname(pathname)` → Synapse 페이지
- **권한**: `PermissionRouteGuard` + `getResourceKeyForPath(pathKey)`

### 4.3 디렉터리 구조

```
apps/remotes/synapsex/
├── docs/                    # 프로젝트 문서
│   ├── PORTING_PLAN.md
│   ├── PORTING_COMPLETE_REPORT.md
│   ├── LINEAGE_EVIDENCE_VIEWER_COMPLETE.md
│   ├── LINEAGE_FILE_STRUCTURE_COMPLETE.md
│   └── DECISION_REQUIRED.md
├── src/
│   ├── components/
│   │   ├── evidence/        # RAG Citation, Stats Evidence
│   │   └── finance/         # severity-badge, confidence-meter, timeline 등
│   ├── data/
│   │   └── mock-data.ts     # 타입 + Mock 데이터
│   ├── pages/
│   │   ├── admin/           # Admin 3탭 (tenant-scope, pii)
│   │   ├── lineage/         # 계보 페이지 (분리 구조)
│   │   └── *.tsx            # 27개 페이지
│   ├── pathname-to-page.tsx # path → 페이지 매핑
│   ├── routes.ts            # SYNAPSE_ROUTES 상수
│   ├── synapse-app.tsx      # 진입 컴포넌트
│   └── main.tsx
├── project.json
├── tsconfig.json
└── vite.config.ts
```

---

## 5. 진행 현황

### 5.1 완료된 작업

| 구분 | 상태 | 상세 |
|------|------|------|
| **페이지 구조** | ✅ 100% | 27개 페이지 모두 구현 |
| **동적 라우팅** | ✅ | Menu Tree API 기반 pathname → 페이지 매핑 |
| **Admin 3탭** | ✅ | Users(Auth API) + Tenant Scope + PII & Encryption |
| **Lineage** | ✅ | Evidence Panel, RAG Citation, Time-travel UI, Drawer |
| **Finance 컴포넌트** | ✅ 5개 | severity-badge, status-pill, confidence-meter, timeline, simulation-result-card |
| **Evidence 컴포넌트** | ✅ | rag-citation-card, stats-evidence-card, rag-citation-list |
| **표준 준수** | ✅ | MUI v5, Iconify, Theme 토큰, ESLint |
| **API 연동** | ✅ 일부 | Admin Users, Governance Config, Tenant Scope, PII (일부) |

### 5.2 API 연동 현황

| API | 상태 | 비고 |
|-----|------|------|
| `GET /api/admin/users` | ✅ | Auth API, appCode=SYNAPSEX |
| `GET /api/synapse/admin/governance-config` | ✅ | RBAC, SoD, Saved Views 미니 통계 |
| `GET/PATCH /api/synapse/admin/tenant-scope` | ✅ | 회사코드, 통화, SoD 규칙 |
| `GET /api/synapse/admin/catalog/*` | ✅ | Catalog → Scope 추가 |
| `GET /api/synapse/admin/profiles` | ⏳ | PII 탭 프로파일 목록 (BE 대기) |
| `GET/PUT /api/synapse/admin/pii-policies` | ⏳ | PII 정책 (BE 대기) |
| `GET/PUT /api/synapse/admin/data-protection` | ⏳ | 암호화·보존 설정 (BE 대기) |

### 5.3 참조 문서

- **API 스펙**: `docs/api-spec/synapse-spec/` (Phase 1~4 문서: `docs/20260203/`)
  - `ADMIN_3TAB_API_BACKEND_RESPONSE.md`
  - `SYNAPSE_ADMIN_AUDIT_API_result.md`
  - `SYNAPSE_PII_ENCRYPTION_ADMIN_TAB3_result.md`
  - `TENANT_SCOPE_AND_CATALOG_API_FE_HANDOVER.md`
  - `[전달용]ADMIN_SYSTEM_MANAGEMENT_FE_ADDITIONAL_REQUEST.md`

---

## 6. 남은 작업

### 6.1 백엔드 요청 사항 (FE 추가 API)

**문서**: `docs/20260203/` (Phase 1~4 관련 문서)

| # | 항목 | 우선순위 |
|---|------|----------|
| 1 | Tenant 목록 API (로그인 사용자 소속 Tenant만) | 중 |
| 2 | Profiles API 응답 필드/타입 확인 | 높음 |
| 3 | Config Profile CRUD API 동작 확인 | 중 |
| 4 | Audit API 쿼리 파라미터(category, type, resourceType) 지원 확인 | 낮음 |

### 6.2 의사결정 필요 (DECISION_REQUIRED.md)

| # | 항목 | 권장 |
|---|------|------|
| 1 | 추가 Finance 컴포넌트 6개 포팅 | Low — 현재 간소화 버전으로 충분 |
| 2 | Saved Views Backend 연동 | Medium |
| 3 | Time-travel 실제 구현 | Low — Backend 대규모 개선 필요 |
| 4 | Bulk Action API 연동 | **High** — 비즈니스 크리티컬 |
| 5 | Simulation API 연동 | **High** — 핵심 의사결정 지원 |
| 6 | Autonomy Level 저장 | Medium |
| 7 | Column Visibility 영속성 | Medium |

### 6.3 Placeholder → 완전 연동 (우선순위)

**High**  
1. Bulk Action 실행 로직 (actions, cases)  
2. Simulation 실행 로직 (actions, case-detail)

**Medium**  
3. Saved Views Backend 연동  
4. Autonomy Level 저장  
5. PII & Encryption 탭 BE API 연동  
6. Column Visibility 영속성 (LocalStorage 또는 User Preferences API)

**Low**  
7. Time-travel Backend 연동  
8. 추가 Finance 컴포넌트 (confidence-breakdown, document-relationship-graph 등)

---

## 7. 실행 방법

```bash
# SynapseX Remote 단독 개발 서버 (포트 4205)
yarn dev:synapsex

# 전체 시스템 (Host + Admin + SynapseX)
yarn dev:all

# 빌드
yarn build:synapsex
```

### 테스트 URL (Host 4200 기준)

| URL | 페이지 |
|-----|--------|
| http://localhost:4200/menu.command-center | 대시보드 |
| http://localhost:4200/cases | 케이스 작업함 |
| http://localhost:4200/lineage | 계보·근거 뷰어 |
| http://localhost:4200/admin | 시스템 관리 (3탭) |
| http://localhost:4200/cases/case-001 | 케이스 상세 |

---

## 📚 관련 문서

- **프로젝트 규칙**: `.cursorrules`, `docs/essentials/PROJECT_RULES.md`
- **디자인 시스템**: `docs/essentials/DESIGN_SYSTEM.md`
- **MFE 적용**: `docs/reference/MFE_APPLIED_WHERE.md`
- **Aura AI**: `docs/specs/aura.md`

---

*최종 업데이트: 2026-02-02*
