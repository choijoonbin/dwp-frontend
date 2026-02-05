# Phase 0 — Frontend Route Map

> Shell↔Remote 로딩/라우팅 및 SynapseX 주요 라우트 맵

---

## 1. Host (Shell) ↔ Remote 로딩

### Host 앱

- **경로**: `apps/dwp/`
- **라우트 정의**: `apps/dwp/src/routes/sections.tsx`

### 라우트 구조

```
/ (index) → DefaultLanding (CONFIG.defaultAfterLoginPath 또는 /)
/dashboard → DashboardPage
/mail → MailPage
/chat → ChatPage
/approval → ApprovalPage
/ai-workspace → AIWorkspacePage
/admin/* → AdminPage (Remote)
/* → PathnameDispatcher → SynapsePage (Synapse Remote)
```

### Synapse Remote 로딩

- **Host 컴포넌트**: `apps/dwp/src/components/synapse-module.tsx`
- **Vite alias**: `@synapse-app` → `apps/remotes/synapsex`
- **Remote 엔트리**: `apps/remotes/synapsex/src/synapse-app.tsx`

### PathnameDispatcher

- `dashboard`, `mail`, `admin` 등 명시 라우트에 매칭되지 않은 경로 → Synapse 앱으로 디스패치
- `pathname` 기준으로 `getPageForPathname(pathname)` 호출

---

## 2. Synapse Remote 라우트 경로

**출처**: `apps/remotes/synapsex/src/routes.ts`

| 경로 | 페이지 |
|------|--------|
| `/synapse` | Dashboard |
| `/synapse/autonomy` | Autonomy |
| `/synapse/cases` | Cases |
| `/synapse/cases/:id` | Case Detail |
| `/synapse/anomalies` | Anomalies |
| `/synapse/optimization` | Optimization |
| `/synapse/actions` | Actions |
| `/synapse/archive` | Archive |
| `/synapse/documents` | Documents |
| `/synapse/documents/:bukrs/:belnr/:gjahr` | Document Detail |
| `/synapse/open-items` | Open Items |
| `/synapse/entities` | Entities |
| `/synapse/entities/:id` | Entity Detail |
| `/synapse/lineage` | Lineage |
| `/synapse/rag` | RAG |
| `/synapse/rag/:docId` | RAG Document Detail |
| `/synapse/policies` | Policies |
| `/synapse/policies/:profileId` | Policy Profile Detail |
| `/synapse/guardrails` | Guardrails |
| `/synapse/dictionary` | Dictionary |
| `/synapse/feedback` | Feedback |
| `/synapse/reconciliation` | Reconciliation |
| `/synapse/reconciliation/:runId` | Recon Run Detail |
| `/synapse/action-recon` | Action Recon |
| `/synapse/audit` | Audit |
| `/synapse/analytics` | Analytics |
| `/synapse/governance` | Governance |
| `/synapse/agent-config` | Agent Config |
| `/synapse/integrations` | Integrations |
| `/synapse/admin` | Synapse Admin |

---

## 3. pathname → 페이지 매핑

**출처**: `apps/remotes/synapsex/src/pathname-to-page.tsx`

- **API path**: `menu.command-center`, `cases`, `synapse/cases` 등
- **path key**: 선행 `/` 제거 후 비교
- **권한**: `PermissionRouteGuard` + `getResourceKeyForPath(pathKey)`

### path key → 페이지

| path key | 페이지 |
|----------|--------|
| `menu.command-center`, `synapse` | Dashboard |
| `menu.autonomous-operations`, `autonomy` | Autonomy |
| `cases` | Cases |
| `anomalies` | Anomalies |
| `optimization` | Optimization |
| `actions` | Actions |
| `archive` | Archive |
| `menu.master-data-history`, `documents` | Documents |
| `open-items` | Open Items |
| `entities` | Entities |
| `lineage` | Lineage |
| `menu.knowledge-policy`, `rag` | RAG |
| `policies` | Policies |
| `guardrails` | Guardrails |
| `dictionary` | Dictionary |
| `feedback` | Feedback |
| `menu.reconciliation-audit`, `reconciliation` | Reconciliation |
| `action-recon` | Action Recon |
| `audit` | Audit |
| `analytics` | Analytics |
| `menu.governance-config`, `governance` | Governance |
| `agent-config` | Agent Config |
| `integrations` | Integrations |
| `admin` | Synapse Admin |

---

## 4. Admin Remote

- **경로**: `apps/remotes/admin/`
- **Host 라우트**: `/admin/*` → `AdminPage`
- **Admin 앱 라우트**: `apps/remotes/admin/src/admin-app.tsx`

| 경로 | 페이지 |
|------|--------|
| `/admin/monitoring` | Monitoring |
| `/admin/batch` | Batch Monitoring (Detect Run History) |
| `/admin/users` | Users |
| `/admin/roles` | Roles |
| `/admin/menus` | Menus |
| `/admin/resources` | Resources |
| `/admin/codes` | Codes |
| `/admin/code-usages` | Code Usages |
| `/admin/audit` | Audit Logs |

---

## 5. 관련 파일

| 역할 | 파일 |
|------|------|
| Host 라우트 | `apps/dwp/src/routes/sections.tsx` |
| Synapse 로딩 | `apps/dwp/src/components/synapse-module.tsx` |
| Synapse 앱 | `apps/remotes/synapsex/src/synapse-app.tsx` |
| Synapse 라우트 상수 | `apps/remotes/synapsex/src/routes.ts` |
| pathname → 페이지 | `apps/remotes/synapsex/src/pathname-to-page.tsx` |
| 권한 path 매핑 | `libs/shared-utils/src/auth/route-permission-config.ts` |
