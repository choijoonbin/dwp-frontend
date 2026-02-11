# GNB Refactoring for Integrated Workbench — 분석 및 수정 계획

> **Role**: Lead Frontend Engineer (MUI & Responsive Design)  
> **Target**: Mobile, Tablet, Desktop (Full-Response), Light/Dark Mode  
> **Reference**: `apps/dwp/src/layouts/nav-config-dashboard.tsx`, `apps/dwp/src/routes/sections.tsx`

---

## 1. Pre-Check 답변 (코딩 전 필수)

### 1.1 `/synapse/workbench` 라우팅 추가 시 AuthGuard / RoleBasedGuard 호환성

**결론: 호환됨. 추가 라우트 선언 없이 Guard 체인 유지 가능.**

- **현재 구조**
  - `sections.tsx`에서 모든 대시보드 경로는 **단일 `AuthGuard` + `DashboardLayout`** 하위에 있음.
  - `path: '*'` → `PathnameDispatcher` → `SynapsePage` 이므로, `/synapse/workbench`는 이미 Host에서 별도 라우트 없이 Synapse Remote로 전달됨.
- **RoleBasedGuard**
  - `sections.tsx`에는 사용되지 않음. 페이지 단위 권한은 **Synapse 내부** `pathname-to-page.tsx`에서 `PermissionRouteGuard` + `getResourceKeyForPath(pathKey)` 로 처리됨.
- **필요 작업**
  - `libs/shared-utils/src/auth/route-permission-config.ts`에 **`workbench` → resourceKey** 매핑 추가.
  - `apps/remotes/synapsex/src/pathname-to-page.tsx`의 `PATH_TO_PAGE`에 **`workbench`** 키 추가 및 동일 pathKey로 `wrapWithRouteGuard` 적용.
  - 백엔드 Flyway V21(또는 메뉴/리소스 시드)에 동일한 resourceKey(예: `menu.workbench`)가 정의되어 있어야 권한 체크가 일치함.

**의문 없음. 진행 가능.**

---

### 1.2 모바일 Drawer에서 통합 메뉴 리스트 가독성

**결론: 현재 레이아웃으로 통합 메뉴 리스트 가독 가능.**

- **현재 구조**
  - `NavMobile`: MUI `Drawer`, `width: var(--layout-nav-mobile-width)` (288px).
  - Desktop과 동일한 `NavContent` 사용: 그룹별 `ListSubheader` + `ListItemButton` 리스트, `Scrollbar`로 스크롤.
- **통합 후**
  - SynapseX 그룹을 “통합 워크벤치” 한 항목으로 줄이면, Drawer 내 항목 수가 감소하여 **가독성은 오히려 향상**됨.
  - 터치 타겟: `minHeight: 44`, `py: 1` 등으로 44px 이상 유지됨 (프로젝트 규칙 준수).

**의문 없음. 진행 가능.**

---

### 1.3 라이트/다크 모드 전환 시 GNB 아이콘·텍스트 색상 및 Glassmorphism

**결론: 아이콘/텍스트는 이미 테마 토큰 사용. Glassmorphism 불투명도는 모드 분기 필요.**

- **아이콘·텍스트**
  - `nav.tsx`: `theme.vars.palette.text.secondary`, `theme.vars.palette.primary.main`, `varAlpha(theme.vars.palette.primary.mainChannel, 0.08)` 등 **테마 토큰만 사용**. 라이트/다크 전환 시 자동 반영됨.
- **Glassmorphism**
  - `header-section.tsx`: `backgroundColor: varAlpha(theme.vars.palette.background.defaultChannel, 0.8)`, `backdropFilter: blur(6px)` — 현재 **불투명도 0.8 고정**.
  - `searchbar.tsx`: 동일하게 `0.8` + blur 사용.
  - **요구사항**: Light 0.7, Dark 0.8 + Glow 분기.
  - **필요 작업**: `theme.palette.mode`에 따라 불투명도(및 다크 시 Glow) 분기 처리.

**의문 없음. theme.palette.mode 분기만 추가하면 됨.**

---

## 2. 구현 가이드 요약

### 2.1 Navigation Config — 통합 워크벤치 메뉴 1개로 통합

- **파일**: `apps/dwp/src/layouts/nav-config-dashboard.tsx`
- **현재**: 메뉴 트리는 `useMenuTreeStore()`(BE Menu Tree API)에서 오며, 그룹별 정렬 후 `convertMenuNodeToNavItem`으로 `NavItem[]` 생성.
- **작업 내용**
  - **옵션 A (FE에서 그룹 치환, 권장)**  
    - `useNavData()` 내에서, 정렬된 트리를 그룹별로 만든 뒤 **SynapseX 그룹만** 다음 하나의 `NavItem`으로 치환:
    - `title`: i18n `menu.workbench` (또는 `common.workbench`) → "통합 워크벤치"
    - `path`: `/synapse/workbench`
    - `icon`: `<Iconify width={22} icon="solar:widget-bold" />`
    - `resourceKey`: 백엔드와 합의한 키 (예: `menu.workbench`)
    - `group`: `'SynapseX'`
    - 그룹 순서는 기존 `GROUP_ORDER` 유지 (SynapseX 먼저).
  - **옵션 B (BE에서 단일 메뉴 반환)**  
    - 백엔드가 SynapseX 그룹을 “통합 워크벤치” 한 건으로 내려주면, FE는 기존 변환 로직만으로 처리. 이 경우 `MENU_KEY_TO_ICON`에 해당 menuKey → `solar:widget-bold` 추가만 하면 됨.
- **아이콘**: `solar:widget-bold` 사용 (요구사항 준수).

### 2.2 Responsive Design

- **Desktop**: 기존 사이드바(`NavDesktop`) 유지. `layoutQuery`(기본 `lg`) 이상에서 표시.
- **Tablet/Mobile**: 기존 `NavMobile`(MUI Drawer) 유지. 햄버거 버튼으로 열고, 동일 `NavContent`로 통합 워크벤치 포함 메뉴 표시.
- **Bottom Navigation**: 선택 사항. 현재 요구사항에 없으므로 별도 태스크로 두고, 필요 시 `layout.tsx`에 하단 네비 영역 추가 검토.

### 2.3 Theme Adaptation — Glassmorphism 모드 분기

- **파일**: `apps/dwp/src/layouts/core/header-section.tsx`, 필요 시 `apps/dwp/src/layouts/components/searchbar.tsx`
- **로직**:
  - `theme.palette.mode === 'dark'`: `backgroundColor` 불투명도 **0.8** 유지, 필요 시 `boxShadow`(Glow) 추가.
  - `theme.palette.mode === 'light'`: 불투명도 **0.7**.
  - 값은 `theme.vars.palette.background.defaultChannel` + `varAlpha(..., alpha)` 형태로 유지 (Hex 하드코딩 금지).

---

## 3. 백엔드와의 Cross-Check (resourceKey)

- **확인 사항**: 백엔드 Flyway V21(또는 메뉴/리소스 시드)에 정의된 **resourceKey**와 프론트 다음 설정이 일치해야 함.
  - `libs/shared-utils/src/auth/route-permission-config.ts`: `ROUTE_RESOURCE_MAP['workbench']`
  - Synapse Remote `pathname-to-page.tsx`: `workbench` pathKey로 `wrapWithRouteGuard` 시 사용하는 resourceKey
  - 권한 API `GET /api/auth/permissions`에 해당 resourceKey가 내려오는지
- **권장 resourceKey**: `menu.workbench` (또는 BE와 합의한 단일 키).  
  - 기존 `menu.command-center`를 워크벤치와 동일 진입점으로 쓸 경우, BE에 “workbench” 메뉴 없이 기존 리소스로 통합할 수도 있음 (기획 합의 필요).

---

## 4. 수정 계획 체크리스트

| # | 작업 | 파일 | 비고 |
|---|------|------|------|
| 1 | SynapseX 그룹을 “통합 워크벤치” 1개 NavItem으로 치환 | `nav-config-dashboard.tsx` | path `/synapse/workbench`, icon `solar:widget-bold`, i18n 키 추가 |
| 2 | workbench path → resourceKey 매핑 | `libs/shared-utils/src/auth/route-permission-config.ts` | `workbench` → `menu.workbench`(또는 합의 키) |
| 3 | workbench 라우트 및 Guard 연동 | `apps/remotes/synapsex/src/pathname-to-page.tsx` | `PATH_TO_PAGE['workbench']` 추가, `wrapWithRouteGuard` 사용 |
| 4 | workbench 진입 시 렌더 페이지 결정 | Synapse Remote | 대시보드/탭 조합 또는 전용 Workbench 페이지 중 기획에 맞게 선택 |
| 5 | GNB Glassmorphism 모드 분기 | `header-section.tsx` (및 필요 시 `searchbar.tsx`) | Light 0.7, Dark 0.8(+ Glow), `theme.palette.mode` 사용 |
| 6 | i18n: 통합 워크벤치 라벨 | `libs/shared-i18n/src/locales/{en,ko}/common.json` | 예: `menu.workbench` 또는 `common.workbench` |
| 7 | BE와 resourceKey 일치 확인 | 백엔드 Flyway/메뉴 API | `menu.workbench`(또는 합의 키) 등록 및 permissions 반영 |

---

## 5. 요약

- **Pre-Check**: AuthGuard/권한 구조와 호환되며, 모바일 Drawer 가독성·테마 토큰 사용은 조건 충족. Glassmorphism만 모드별 불투명도(및 다크 Glow) 분기하면 됨.
- **구현**: (1) nav-config에서 SynapseX 그룹을 “통합 워크벤치” 1개로 치환, (2) workbench 라우트·권한 매핑 추가, (3) 헤더/검색바 Glassmorphism을 `theme.palette.mode` 기준으로 분기.
- **백엔드**: Flyway V21(또는 동일 역할 스크립트)의 resourceKey와 FE `ROUTE_RESOURCE_MAP`·PermissionGuard 키 일치 여부를 반드시 확인할 것.

이 계획대로 진행하면 GNB 통합 워크벤치 리팩터링과 라이트/다크 모드 대응을 일관되게 적용할 수 있습니다.
