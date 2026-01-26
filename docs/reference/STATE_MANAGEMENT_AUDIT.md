# 상태 관리(Store) 구조 점검

> **목적**: Zustand/Context/Provider 등 상태 관리가 체계적으로 배치·운용되는지 점검하고, 신규 개발자 투입 시 공통 부분 헛점 없음·모듈화·관리 일관성을 확보하기 위한 기준을 정리합니다.

---

## 1. 현재 구조 요약

### 1.1 스토어 배치 현황

| 스토어 | 위치 | 소유 | 용도 | export 경로 |
|--------|------|------|------|-------------|
| **useLayoutStore** | `apps/dwp/src/store/use-layout-store.ts` | Host | Sidebar 열림/접힘, activeMenu | `src/store/use-layout-store` |
| **useAuraStore / useAuraActions** | `libs/shared-utils/src/aura/use-aura-store.ts` | 공통 | Aura 오버레이, 메시지, HITL, 타임라인 등 | `@dwp-frontend/shared-utils/aura/use-aura-store` (서브패스만) |
| **useMenuTreeStore** | `libs/shared-utils/src/auth/menu-tree-store.ts` | 공통 | 메뉴 트리 (API 로드 결과) | `@dwp-frontend/shared-utils` (index) |
| **usePermissionsStore** | `libs/shared-utils/src/auth/permissions-store.ts` | 공통 | 권한 목록·permissionMap, hasPermission | `@dwp-frontend/shared-utils` (index) |
| **useStreamStore** | `libs/shared-utils/src/agent/stream-store.ts` | 공통 | SSE 스트림 상태 (IDLE/CONNECTING 등) | `@dwp-frontend/shared-utils` (index) |

- **Auth 세션**: React Context (`AuthContext`) + `useState` (accessToken). Zustand 아님. Provider는 `libs/shared-utils`의 `AuthProvider`, Host `main.tsx`에서 단일 래핑.
- **서버 데이터**: TanStack Query 전담. 쿼리는 `libs/shared-utils/src/queries/`에 배치, 앱/페이지는 훅만 사용.

### 1.2 Provider 트리 (Host, apps/dwp)

```
StrictMode
  └─ QueryClientProvider
       └─ ThemeProvider (design-system)
            └─ AuthProvider (shared-utils) ← menu-tree / permissions store 사용
                 └─ RouterProvider → App → Outlet
```

- Remotes(admin, mail)는 자체 진입점에서 `ThemeProvider`만 래핑. Auth/라우트는 Host가 제공하는 Micro Frontend 구조에 의존.

---

## 2. 규칙 준수 여부

### 2.1 .cursorrules / PROJECT_RULES 반영

| 규칙 | 현재 상태 | 비고 |
|------|-----------|------|
| 전역 UI 상태 → Zustand | ✅ 준수 | Layout, Aura, 메뉴/권한, 스트림 모두 Zustand |
| 서버 데이터 → TanStack Query | ✅ 준수 | API 호출은 shared-utils api → queries → hooks → pages |
| Host가 Auth/메뉴/전역 정책 단일 소유 | ✅ 준수 | AuthProvider·menu-tree·permissions는 Host에서 사용, Remote는 공통 lib만 import |
| Remote는 Host 스토어 직접 수정 금지, Host가 제공하는 인터페이스로만 상호작용 | ✅ 준수 | Remote(admin)는 `useAuraActions` 등 shared-utils 스토어만 사용 |
| 페이지/컴포넌트에서 axios 직접 호출 금지 | ✅ 준수 | queries/hooks 계층 사용 |

### 2.2 스토어 네이밍·패턴 일관성

- **이름**: `useXxxStore`, `useXxxActions` 패턴 통일 (Layout, Aura, MenuTree, Permissions). Stream은 `useStreamStore`만 export, 갱신은 `use-agent-stream` 훅 내부에서만 수행.
- **구조**: 상태 + `actions` 객체에 액션 모음. `useXxxActions()`로 액션만 구독해 불필요한 리렌더 감소 가능.
- **위치**: “여러 앱/Remote에서 쓰는 상태” → `libs/shared-utils`; “Host 전용 UI” → `apps/dwp/src/store/`.

---

## 3. 발견 사항 및 조치

### 3.1 🔴 중복 파일 (정리 권장)

| 항목 | 설명 | 조치 |
|------|------|------|
| **apps/dwp/src/store/use-aura-store.ts** | Aura 스토어가 Host에 동일 내용으로 복사본 존재 | **삭제 권장**. 모든 사용처(aiworkspace, aura 컴포넌트, admin aura-insight-bar)는 이미 `@dwp-frontend/shared-utils/aura/use-aura-store`만 import. 남겨두면 향후 수정 시 이중 유지보수·불일치 위험. |

### 3.2 🟡 문서와 실제 불일치

| 항목 | 현재 문서 | 실제 | 조치 |
|------|-----------|------|------|
| README 구조도 | `store/ # useLayoutStore, useAuraStore (Zustand)` | Aura는 libs에만 있음 | README를 “useLayoutStore (Zustand), Aura는 shared-utils 참조” 등으로 수정 권장 |

### 3.3 🟢 잘 유지된 부분

- **모듈화**: 공통 스토어는 모두 `libs/shared-utils`에 있고, auth / agent / aura 도메인별 디렉터리로 분리.
- **Remote 격리**: Remotes에는 로컬 Zustand 스토어 없음. Admin은 Aura 제어만 `useAuraActions`(shared-utils)로 수행.
- **스토어·쿼리 분리**: 메뉴/권한은 “로드 후 저장”은 store, “fetch”는 API+Query 훅에서 수행. AuthProvider에서 getPermissions/getMenuTree 호출 후 store에 set.
- **Aura 타입**: `AgentMessage` 등은 use-aura-store에만 정의하고, use-agent-stream의 `AgentMessage`와는 별도 타입으로 유지. shared-utils index에서 Aura store 미export로 타입 충돌 방지.

---

## 4. 신규 개발자용 가이드 (공통 부분 헛점 방지)

### 4.1 “새 전역 상태가 필요할 때” 판단

1. **Host 전용 UI 상태** (사이드바, 헤더 플래그 등)  
   → `apps/dwp/src/store/use-xxx-store.ts`에 추가.  
   예: `useLayoutStore` 참고.

2. **여러 앱/Remote가 쓰는 상태** (Aura, 인증·메뉴·권한, 에이전트 스트림 등)  
   → `libs/shared-utils` 안 적절한 도메인 폴더에 추가.  
   - auth 관련: `libs/shared-utils/src/auth/xxx-store.ts`  
   - Aura/에이전트: `libs/shared-utils/src/aura/` 또는 `agent/`  
   export는 index에서 할지, 서브패스만 할지 타입 충돌 여부에 따라 결정.

3. **서버 데이터**  
   → Zustand 쓰지 말고 TanStack Query만 사용.  
   훅은 `libs/shared-utils/src/queries/` 에 두고, API는 `libs/shared-utils/src/api/` 에만 정의.

### 4.2 “새 Provider가 필요할 때”

- **Theme / Auth**: 이미 Host에서 단일 제공. Remote는 ThemeProvider만 자체 진입점에 두고, Auth는 Host 체인에 의존.
- **새 전역 Context**를 쓸 경우:  
  - Host+Remote가 같이 써야 하면 `libs/shared-utils`에 Provider 정의하고, Host `main.tsx`에서 한 번만 래핑.  
  - Remote 단독이면 해당 Remote의 진입점에서만 래핑 (가능한 한 지양하고 Host 통합 권장).

### 4.3 import 규칙

- Layout 스토어: `src/store/use-layout-store` (Host 내 상대/alias).
- Aura 스토어: `@dwp-frontend/shared-utils/aura/use-aura-store` (서브패스). **Host 전용 store/use-aura-store는 사용하지 말 것.**
- 메뉴/권한/스트림: `@dwp-frontend/shared-utils` 에서 이름으로 import.

---

## 5. 요약

| 구분 | 평가 | 비고 |
|------|------|------|
| **체계성** | ✅ 양호 | 전역은 Zustand, 서버는 Query, 도메인별 배치 명확 |
| **모듈화** | ✅ 양호 | 공통 스토어는 shared-utils, Host 전용은 apps/dwp/store |
| **규칙 준수** | ✅ 양호 | Host/Remote 책임 분리, store 직접 수정 금지 준수 |
| **헛점/중복** | 🔴 1건 | Host `use-aura-store.ts` 중복 → 삭제 권장 |
| **문서** | 🟡 1건 | README 스토어 설명을 실제 구조에 맞게 정리 권장 |

위 조치를 반영하면, 상태 관리 구조는 향후 개발자 투입 시에도 일관되고 공통 부분 헛점 없이 유지보수하기에 적합한 상태입니다.
