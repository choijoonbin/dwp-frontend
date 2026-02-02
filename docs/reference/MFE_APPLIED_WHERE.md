# MFE 적용 위치 및 값 정리

**최종 업데이트**: 2026-02-02

현재 DWP Frontend는 **Module Federation을 사용하지 않고**, **Vite 기반 Host + Remote 소스 경로 lazy 로딩** 구조입니다.  
**로그인은 Host 단일 소유**이며, Remote별 별도 "MFE 로그인"은 없습니다.

---

## 1. 적용 방식 요약

| 구분 | 적용 방식 | 값/위치 |
|------|-----------|---------|
| **런타임 로딩** | Module Federation **미사용** | Remotes는 Host 빌드 시 **소스 경로 lazy import**로 포함 |
| **인증(로그인)** | Host 단일 소유 | Remote는 독자 로그인 없음. Host에서 로그인 후 JWT/세션 공유 |
| **라우팅** | Host 라우터가 전부 소유 | `/admin/*`, `/synapse/*` 등 경로는 Host `sections.tsx`에서 매핑 |

---

## 2. Host (Shell)

| 항목 | 값 | 파일/위치 |
|------|-----|-----------|
| **앱 경로** | `apps/dwp` | 루트 `vite.config.ts`의 `root` |
| **개발 포트** | **4200** | `vite.config.ts` → `PORT = 4200` |
| **API Base URL** | `process.env.NX_API_URL` (기본 `http://localhost:8080`) | `vite.config.ts` → `define` |
| **레이아웃/인증** | DashboardLayout, AuthGuard | `apps/dwp/src/routes/sections.tsx`, `layouts/dashboard/` |
| **로그인 페이지** | `/sign-in` | Host 전용. Remote는 사용하지 않음 |

---

## 3. Remote 로딩 (어디에 어떤 값으로 적용되는지)

Remotes는 **별도 서버로 띄우는 것이 아니라**, Host가 **같은 레포 안의 소스 경로**를 `lazy(() => import('...'))` 로 불러옵니다.

### 3.1 Admin Remote

| 항목 | 값 | 파일/위치 |
|------|-----|-----------|
| **소스 경로** | `apps/remotes/admin` | - |
| **진입 컴포넌트** | `AdminApp` | `apps/remotes/admin/src/admin-app.tsx` |
| **Host에서 로딩** | `lazy(() => import('../../../remotes/admin/src/admin-app'))` | `apps/dwp/src/components/admin-module.tsx` |
| **라우트 경로** | `/admin/*` | `apps/dwp/src/routes/sections.tsx` → `{ path: 'admin/*', element: <AdminPage /> }` |
| **페이지 래퍼** | `apps/dwp/src/pages/admin.tsx` | `PermissionRouteGuard` + `DashboardContent` + `AdminModule` |
| **독립 실행용 포트** | **4204** | `apps/remotes/admin/vite.config.ts` → `PORT = 4204` (개발 시 `yarn dev:admin` 사용 시) |

### 3.2 Synapse (SynapseX) Remote

| 항목 | 값 | 파일/위치 |
|------|-----|-----------|
| **소스 경로** | `apps/remotes/synapsex` | - |
| **진입 컴포넌트** | `SynapseApp` | `apps/remotes/synapsex/src/synapse-app.tsx` |
| **Host에서 로딩** | `lazy(() => import('../../../remotes/synapsex/src/synapse-app'))` | `apps/dwp/src/components/synapse-module.tsx` |
| **라우트 경로** | 메뉴 트리 API에 등록된 경로 또는 `/synapse/*` (8자 초과) | `apps/dwp/src/routes/sections.tsx` → `PathnameDispatcher` |
| **페이지 래퍼** | `apps/dwp/src/pages/synapse.tsx` | `DashboardContent` + `SynapseModule` |
| **독립 실행용 포트** | **4205** | `apps/remotes/synapsex/vite.config.ts` (주석: 4200 host, 4201 mail, 4204 admin, 4205 synapsex) |

### 3.3 Mail Remote

| 항목 | 값 | 파일/위치 |
|------|-----|-----------|
| **소스 경로** | `apps/remotes/mail` | - |
| **개발 포트** | **4201** | `apps/remotes/mail/vite.config.ts` → `PORT = 4201` |
| **Host 라우트** | `path: 'mail'` → `MailPage` | `apps/dwp/src/routes/sections.tsx` (Mail은 Host 내부 페이지로 구현될 수 있음) |

---

## 4. 포트 정리 (개발 시)

| 앱 | 포트 | 비고 |
|----|------|------|
| **Host (dwp)** | 4200 | `yarn dev` |
| **Mail** | 4201 | `yarn dev:mail` |
| **Admin** | 4204 | `yarn dev:admin` |
| **SynapseX** | 4205 | `yarn dev:synapsex` |

`yarn dev:all` 시 위 네 개가 동시에 뜨지만, **실제 사용자는 보통 Host(4200)만 접속**하고, Admin/Synapse는 Host 라우트를 통해 같은 오리진에서 lazy 로딩됩니다.

---

## 5. 로그인 (MFE 로그인 없음)

- **인증/로그인**: Host만 담당. `AuthGuard`, `/sign-in`, `/sso-callback`, `/auth/oidc/callback` 등은 모두 Host(`apps/dwp`)에 있음.
- **Remote**: 로그인 페이지나 로그인 API를 갖지 않음. Host에서 로그인한 뒤 공유되는 **JWT/세션**과 **axiosInstance**(`libs/shared-utils`)를 그대로 사용.
- 따라서 **“MFE 로그인”** 이라는 별도 플로우는 없고, **단일 로그인(Host)** 만 존재합니다.

---

## 6. Module Federation 관련

- **현재**: 코드 상으로 Module Federation **미적용**. `admin-module.tsx` 주석에만 “In production, this would be loaded via Module Federation” 라고 되어 있음.
- **규칙(.cursorrules)**: “Webpack Module Federation 도입/적용 시 범위, 노출 모듈, 버전 정책을 문서로 고지해야 한다” 로만 명시되어 있음.

---

## 7. 한 줄 요약

- **MFE 적용 위치**: Host는 `apps/dwp` (포트 4200), Remote는 `apps/remotes/admin`, `apps/remotes/synapsex`, `apps/remotes/mail` 이며, **실제 런타임 로딩은 Host에서 소스 경로 lazy import** 로만 이루어짐.
- **적용 값**: Host 4200, Admin 4204, SynapseX 4205, Mail 4201; API는 `NX_API_URL`(기본 `http://localhost:8080`).
- **로그인**: Host 단일. Remote용 “MFE 로그인”은 없음.
