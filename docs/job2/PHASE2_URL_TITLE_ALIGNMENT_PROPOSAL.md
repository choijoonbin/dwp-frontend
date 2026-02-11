# Phase 2: URL/Title Alignment & Scenario-Ready UI — 수정 제안

## 목표
- **Command Center** 용어 제거, **통합 워크벤치(Integrated Workbench)** 로 통일
- 메인 진입점: **`/synapse/workbench`** (기존 `/command-center` 제거)
- 상단 제목·GNB·플레이스홀더 정리로 시연(V40) 준비

---

## 1. 라우팅 변경 (Routing Update)

### 1.1 `apps/dwp/src/config-global.ts`
| 항목 | 현재 | 변경 |
|------|------|------|
| `defaultAfterLoginPath` | `'/command-center'` | `'/synapse/workbench'` |
| 주석 | `'/menu.command-center'` 예시 | `'/synapse/workbench'` 예시 |

**로직**: 로그인 후 첫 페이지 및 루트(`/`) 리다이렉트 대상을 워크벤치로 고정.

---

### 1.2 `apps/remotes/synapsex/src/pathname-to-page.tsx`

| 작업 | 내용 |
|------|------|
| **PATH_TO_PAGE 정리** | `'menu.command-center'`, `synapse` 키 제거. 두 키 모두 `DashboardPage`로 연결되어 있음 → **워크벤치로 통일** |
| **기본/폴백 페이지** | `normalized === ''` 또는 매칭 실패 시 현재 `wrapWithRouteGuard(<DashboardPage />, 'synapse')` → **`<Navigate to="/synapse/workbench" replace />` 또는 `WorkbenchPage`** 로 변경 |
| **레거시 경로 리다이렉트** | `/command-center`, `/menu.command-center` 접근 시 **`/synapse/workbench`로 301/302 리다이렉트** 처리 추가(선택) |

**경로 변경 로직 요약**:
```
/synapse/workbench     → WorkbenchPage (메인)
/workbench             → WorkbenchPage (동일)
/                      → DefaultLanding → CONFIG.defaultAfterLoginPath → /synapse/workbench
/menu.command-center   → 제거 또는 /synapse/workbench 리다이렉트
/synapse (단독)        → /synapse/workbench 리다이렉트 또는 WorkbenchPage
```

- **제거할 매핑**: `'menu.command-center': () => <DashboardPage />`, `synapse: () => <DashboardPage />`
- **추가/유지**: `workbench` → `WorkbenchPage` 만 메인. 빈 path 또는 `synapse` 단독일 때 `getPageForPathname` 내부에서 `WorkbenchPage` 반환 또는 `/synapse/workbench`로 `Navigate`.

---

### 1.3 `apps/dwp/src/routes/sections.tsx`
- **현재**: `path: '*'` → `PathnameDispatcher` → `SynapsePage` 로 넘기고, Synapse 내부 `pathname-to-page`에서 pathname 해석.
- **변경**: `sections.tsx`에는 **별도 `/command-center` 라우트가 없음**. Host는 `*` 만 사용하므로, **경로 제거는 Synapse Remote의 pathname-to-page + config-global 만 수정** 하면 됨.

---

## 2. 권한 리소스 키 정리 (route-permission-config)

### 2.1 `libs/shared-utils/src/auth/route-permission-config.ts`

| 현재 | 변경 |
|------|------|
| `'menu.command-center': 'menu.command-center'` | **제거** 또는 `'menu.command-center': 'menu.workbench'` 로 매핑(백엔드가 아직 menu.command-center 권한만 내려줄 때 대비) |
| `synapse: 'menu.command-center'` | `synapse: 'menu.workbench'` 또는 제거 후 workbench만 사용 |

**제안**: BE가 `menu.workbench` 권한을 내려주는 경우, `menu.command-center` 키 제거. BE가 계속 `menu.command-center`만 내려주면 `'menu.command-center': 'menu.workbench'` 로 매핑해 동일 리소스로 처리.

---

## 3. 제목 통일 (Title Refactoring)

### 3.1 i18n — `libs/shared-i18n/src/locales/ko/common.json`, `en/common.json`

| 키 | 현재(예시) | 변경 |
|----|------------|------|
| `dashboard.title` | 통합 관제 센터 / Integrated Control Center | **통합 워크벤치 (Integrated Workbench)** / **Integrated Workbench** |
| `dashboard.subtitle` | 자율 재무 운영 실시간 현황 / Real-time autonomous finance operations | 유지 또는 시연용 문구로 조정 |

또는 공통 제목용 키 추가:
- `integratedWorkbench.title`: `"통합 워크벤치 (Integrated Workbench)"` / `"Integrated Workbench"`
- 대시보드·워크벤치 상단에서 모두 이 키 참조.

### 3.2 페이지 컴포넌트

| 파일 | 변경 |
|------|------|
| `apps/remotes/synapsex/src/pages/dashboard/index.tsx` | 상단 `t('dashboard.title')` / `t('dashboard.subtitle')` → `t('integratedWorkbench.title')` 또는 수정된 `dashboard.title` 사용 |
| `apps/remotes/synapsex/src/pages/workbench/index.tsx` | 현재 상단 제목 없음 → **상단에 "통합 워크벤치 (Integrated Workbench)" 표시** (탭 위 또는 좌측 상단). `t('integratedWorkbench.title')` 또는 `t('menu.workbench')` 활용 |

- **대시보드**: 이미 `Typography variant="h5"` + subtitle 존재 → 문구만 i18n 변경.
- **워크벤치**: 탭 상단 또는 레이아웃 상단에 제목 한 줄 추가.

---

## 4. GNB 정리 (Sidebar Cleanup)

### 4.1 `apps/dwp/src/layouts/nav-config-dashboard.tsx`

**현재 동작**:
- `useNavData`가 메뉴 트리(BE) 로드 후 `sortRootMenuNodes(menuTree)` 적용.
- `group === 'SynapseX'` 인 노드들은 **하나의 "통합 워크벤치"** 로 치환 (`buildWorkbenchNavItem(t)`), path는 `/synapse/workbench`.

**정리 포인트**:
1. **중복/숨김 메뉴 미렌더링**: 이미 SynapseX 그룹은 1개로 치환되어 있음. BE에서 `menu.command-center` 또는 다른 SynapseX 노드가 여전히 오면, **그룹이 SynapseX인 모든 노드를 하나로만 넣는 로직**이 있어야 함. 현재 `synapseXReplaced` 플래그로 첫 번째만 넣고 있으므로 **추가 SynapseX 노드는 무시**됨 → 유지해도 됨.
2. **명시적 제외**: BE에 `menu.command-center` path를 가진 노드가 있다면, **path가 `/command-center` 또는 `menu.command-center` 인 항목은 NavItem으로 추가하지 않도록** 필터 추가 가능 (선택).
3. **표시 라벨**: `t('menu.workbench')` = "통합 워크벤치" 이미 사용 중 → 유지.

**수정 제안**:
- 기존 로직 유지 + 주석으로 "Command Center 제거, workbench 단일 진입점" 명시.
- (선택) `node.path === '/command-center' || node.path?.includes('command-center')` 인 경우 `convertMenuNodeToNavItem` 호출하지 않고 스킵.

---

## 5. 플레이스홀더 제거 (Placeholder Removal) — V40 시연 데이터 대비

### 5.1 "개발중" / "데이터 없음" 표시

| 위치 | 현재 | 변경 |
|------|------|------|
| `apps/remotes/synapsex/src/components/placeholder-page.tsx` | "Under Development", "Coming Soon", "No data available yet" 하드코딩 | i18n 키로 교체 (예: `placeholder.underDevelopment`, `placeholder.comingSoon`, `placeholder.noDataYet`). 시연 시 **빈 데이터일 때만** 해당 문구 노출, API 연동 후에는 실제 데이터 우선 표시. |
| `libs/shared-i18n/.../common.json` | `emptyData`, `noData` 등 이미 존재 | 대시보드/워크벤치에서 "데이터 없음" 시 **동일 키 사용** 또는 `dashboard.emptyState`, `workbench.emptyState` 추가. |
| 대시보드 KPI/Feed/HITL | API 실패·빈 배열 시 ErrorState/EmptyState | **데이터 없음** 문구를 i18n으로 통일하고, V40에서 시연 데이터 주입 시 곧바로 표시되도록 **빈 상태 UI만 유지** (문구만 "데이터 없음" 등으로). |

### 5.2 데이터 주입 준비
- 대시보드: 이미 `useSynapseDashboardSummaryQuery` 등으로 BE 연동. **빈 응답**일 때 Empty/Error 컴포넌트에 "데이터 없음" 또는 i18n 키 사용.
- 워크벤치: Queue/Stream/ThoughtChain이 **API 연동 후** 시연 데이터를 받을 수 있도록 훅/쿼리 준비. 현재 placeholder 문구는 i18n으로 빼두고, "데이터 없음"은 공통 키로 통일.

---

## 6. 수정이 필요한 파일 목록 (체크리스트)

| # | 파일 경로 | 작업 요약 |
|---|-----------|-----------|
| 1 | `apps/dwp/src/config-global.ts` | `defaultAfterLoginPath` → `'/synapse/workbench'`, 주석 수정 |
| 2 | `apps/remotes/synapsex/src/pathname-to-page.tsx` | `menu.command-center`/`synapse` 제거, 빈 path·synapse 단독 시 Workbench 또는 `/synapse/workbench` 리다이렉트, 주석 정리 |
| 3 | `libs/shared-utils/src/auth/route-permission-config.ts` | `menu.command-center`/`synapse` → `menu.workbench` 정리(또는 BE 정책에 맞춰 유지) |
| 4 | `libs/shared-i18n/src/locales/ko/common.json` | `dashboard.title` → "통합 워크벤치 (Integrated Workbench)" 또는 `integratedWorkbench.title` 추가 |
| 5 | `libs/shared-i18n/src/locales/en/common.json` | 위와 동일 |
| 6 | `apps/remotes/synapsex/src/pages/dashboard/index.tsx` | 상단 제목 i18n 키를 통합 워크벤치 제목으로 변경 |
| 7 | `apps/remotes/synapsex/src/pages/workbench/index.tsx` | 상단에 "통합 워크벤치 (Integrated Workbench)" 제목 추가 |
| 8 | `apps/dwp/src/layouts/nav-config-dashboard.tsx` | (선택) command-center 경로 명시적 제외, 주석 정리 |
| 9 | `apps/remotes/synapsex/src/components/placeholder-page.tsx` | "Under Development" 등 하드코딩 → i18n 키 사용 |
| 10 | `libs/shared-utils/src/auth/menu-tree-utils.ts` | 주석 내 "menu.command-center" 예시 → "menu.workbench" 또는 "/synapse/workbench" 로 수정 |

---

## 7. 경로 변경 로직 요약 (pathname-to-page)

```
입력 pathname              → 동작
────────────────────────────────────────────────────────────
/                          → Host DefaultLanding → /synapse/workbench 리다이렉트
/synapse/workbench         → WorkbenchPage
/workbench                 → PATH_TO_PAGE['workbench'] → WorkbenchPage
/synapse                   → Navigate to /synapse/workbench 또는 WorkbenchPage
/menu.command-center       → 제거: Navigate to /synapse/workbench
/command-center            → (Host * 캐치) Synapse에서 normalized='command-center' → PATH_TO_PAGE 없음 → 폴백 시 WorkbenchPage 또는 Navigate
/cases, /documents, ...     → 기존 유지
```

- **빈 path** (`normalized === ''`): 현재 `wrapWithRouteGuard(<DashboardPage />, 'synapse')` → **`<Navigate to="/synapse/workbench" replace />`** 또는 `wrapWithRouteGuard(<WorkbenchPage />, 'workbench')`.
- **정규화 후 키가 PATH_TO_PAGE에 없을 때** 마지막 fallback: 현재 `DashboardPage` → **`WorkbenchPage`** 또는 `/synapse/workbench` 리다이렉트.

이 제안대로 적용하면 URL/제목/GNB가 "통합 워크벤치" + `/synapse/workbench` 기준으로 정리되고, 플레이스홀더는 i18n·빈 상태로 V40 시연 데이터를 맞이할 수 있습니다.

---

## 8. Pre-check: 메뉴 클릭 시 화면이 나오지 않는 원인

| 원인 | 설명 | 조치 |
|------|------|------|
| **resourceKey 불일치** | BE 권한은 `menu.command-center` 등인데 FE `PermissionRouteGuard`/`ROUTE_RESOURCE_MAP`에서 다른 키로 매핑하면 403 발생 → 빈 화면 또는 접근 거부. | `libs/shared-utils/src/auth/route-permission-config.ts`의 `ROUTE_RESOURCE_MAP`에서 `workbench`, `command-center`, `menu.command-center`, `menu.autonomous-operations.workbench` 등이 모두 **동일 리소스 키**(예: `menu.command-center`)로 매핑되도록 유지. |
| **라우팅/컴포넌트 누락** | pathname에 해당하는 항목이 `PATH_TO_PAGE`에 없거나, `getPageForPathname`에서 fallback만 타서 잘못된 페이지/리다이렉트가 나옴. | `pathname-to-page.tsx`에 해당 path → 페이지 매핑 추가. `/synapse/command-center` 등 레거시는 상단에서 `/synapse/workbench`로 `Navigate` 처리. |

**정리**: "메뉴 클릭 시 화면 안 나옴"은 대부분 **resourceKey 불일치**(403) 때문이다. 라우팅/컴포넌트는 `pathname-to-page`와 `PATH_TO_PAGE`에 항목이 있으면 해결된다. 워크벤치/command-center는 `menu.command-center`로 통일해 두었음.
