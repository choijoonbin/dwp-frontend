# DWP Frontend 코드 검증 리포트 및 PR 계획

**작성일**: 2026-01-27  
**대상**: 현재 FE 코드 기준 11개 점검 항목 검증, PR 단위 작업계획, BE 확인 질문

---

## 1) 점검 리포트 (표)

| # | 항목 | 현재 구현 여부 | 근거 (파일 경로) | 리스크 | 권장 조치 |
|---|------|----------------|------------------|--------|-----------|
| **A. MFE 연결 방식** |
| A1 | Host↔Remote 라우팅/로딩 | **구현됨** (동적 import, 번들 내 로딩) | `apps/dwp/src/components/admin-module.tsx`: `lazy(() => import('../../../remotes/admin/src/admin-app'))` — Vite alias로 Remote 소스 직접 로딩. `vite.config.ts`(root): resolve alias `@dwp-frontend/*` → libs. Host용 vite는 `root: apps/dwp`, Remote 별도 번들 없음. | Module Federation 미도입으로 프로덕션 분리 배포/버전 관리 시 재검토 필요. | 문서화: 현재는 "단일 레포 내 경로 기반 로딩"으로 명시. MFE 전환 시 스펙 문서화 후 적용. |
| A2 | nav-config-dashboard가 라우팅 소스로 동작하는지 | **아님** — 메뉴 데이터 소스는 **백엔드 메뉴 트리** | `apps/dwp/src/layouts/nav-config-dashboard.tsx`: `useNavData()` → `useMenuTreeStore()` 사용. `navData`는 빈 배열 export(하위 호환). `apps/dwp/src/layouts/dashboard/layout.tsx`: `const navData = useNavData()` → Sidebar에 사용. | 없음. | (없음) BE 메뉴 트리가 Source of Truth임을 유지. |
| A3 | Remote가 ThemeProvider/design-system 적용을 받는지 | **구현됨** (Remote 단독 실행 시 자체 Provider) | `apps/remotes/admin/src/main.tsx`: `ThemeProvider` from `@dwp-frontend/design-system` 래핑. Host 내 로딩 시에는 Host의 ThemeProvider 하위에 AdminApp이 렌더되므로 동일 테마 적용. | Generator로 생성되는 신규 Remote가 ThemeProvider를 포함하는지 확인 필요. | `apps/remotes/_starter` 및 `tools/generators/new-remote` 템플릿에 ThemeProvider 포함 여부 검사 후 문서화. |
| **B. 메뉴 트리 정규화/권한** |
| B1 | 메뉴 트리 id: path vs i18n key, FE Source of Truth | **명확함** — path는 BE 응답값, FE에서 정규화 적용 | `libs/shared-utils/src/queries/use-menu-tree-query.ts`: `normalizeMenuTreePaths()`에서 `normalizeRoutePath(node.path)` 적용 후 store 저장. 메뉴 키는 `node.menuKey`(i18n/리소스 키), path는 라우팅용. | BE가 path를 `/app/admin/xxx` 형태로 주면 FE가 `/admin/xxx`로 변환. BE path 규칙 변경 시 `normalize-route-path.ts` 수정 필요. | BE–FE path 규칙을 API 스펙에 명시. |
| B2 | normalizeRoutePath 적용 흐름 | **구현됨** — 메뉴 트리 fetch 후 변환, 라우팅 시 직접 사용처는 경로 매칭 시 | `libs/shared-utils/src/router/normalize-route-path.ts`: `/app/admin/*` → `/admin/*`, audit-logs→audit, code-usage→code-usages, aiworkspace→ai-workspace 등. `use-menu-tree-query.ts` 22행: `path: normalizeRoutePath(node.path)`. | 새 path 규칙 추가 시 normalize 함수에 하드코딩 추가 필요. | 매핑 테이블을 상수로 분리하거나 BE와 규칙 공유 문서화. |
| B3 | 권한 기반 메뉴 노출 vs PermissionRouteGuard | **구현됨** — 서버 필터 + FE 이중 방어 | 메뉴: `getMenuTree()`(BE)가 이미 권한 필터된 트리 반환 → `useMenuTreeStore`에 저장 → `useNavData()`로 Sidebar 렌더. 라우트: `libs/shared-utils/src/auth/permission-route-guard.tsx`: `usePermissions()`(permissions-store)로 `hasPermission(resource, permission)` 검사, 미충족 시 redirect. Admin 페이지들: `PermissionRouteGuard resource="menu.admin.xxx"` 적용. | Sidebar 숨김만으로는 URL 직접 접근 가능하므로 Guard 필수. 현재 Guard 적용된 페이지만 표시됨. | 신규 보호 라우트 추가 시 Guard 적용 체크리스트에 포함. |
| **C. 멀티테넌시/인증** |
| C1 | X-Tenant-ID 초기 결정 방식 | **미완성** — 현재 고정값 '1' | `libs/shared-utils/src/tenant-util.ts`: `getTenantId = () => '1'`. 주석에 "도메인 기반 추출 예정" 명시. | 운영 환경에서 테넌트 식별 불가. | PR: 도메인 기반 추출 로직 추가(서브도메인 또는 설정), 개발 시 fallback '1' 유지. |
| C2 | 토큰 만료/로그아웃(401 전역), Refresh 토큰/갱신 플로우 | **401 처리 구현됨 / Refresh 미구현** | `libs/shared-utils/src/axios-instance.ts`: 401/403 시 `handleAuthError(status)` 호출, `setUnauthorizedHandler`로 Host가 주입. Host에서 logout + redirect. `libs/shared-utils/src/api/auth-api.ts`: 로그인 응답 타입에 `refreshToken?: string` 존재. **axios 인터셉터/401 시 refresh 호출 로직 없음.** | 토큰 만료 시 무조건 로그아웃. 장시간 세션 유지 불가. | BE에 refresh 엔드포인트/계약 확인 후, PR: 401 시 1회 refresh 시도, 실패 시 logout. |
| C3 | /api/auth/policy 호출 시점과 캐싱 | **구현됨** | `libs/shared-utils/src/queries/use-auth-policy-query.ts`: `authPolicyQueryKey(tenantId)`, `staleTime: 5 * 60 * 1000`, `gcTime: 10 * 60 * 1000`. 호출 시점은 이 훅을 사용하는 컴포넌트 마운트 시. | policy 사용처(로그인 분기 등)가 훅 사용 전에 결정되면 초기 로딩 순서 의존. | 로그인 페이지 등에서 policy 사용 시점 문서화. |
| **D. Gateway/API 호출 규격** |
| D1 | NX_API_URL이 Gateway 단일 진입점인지 | **FE 기준 단일 baseURL** | `libs/shared-utils/src/env.ts`: `NX_API_URL = process.env.NX_API_URL ?? 'http://localhost:8080'`. `axios-instance.ts`: `const baseURL = NX_API_URL`, 모든 get/post/put에 사용. | 운영에서 Gateway 8080 외 다른 URL 사용 시 env만 변경하면 됨. 실제 Gateway 단일 여부는 인프라 정책 확인 필요. | BE/인프라와 협의 후 문서에 "Gateway 단일 진입점" 명시. |
| D2 | axiosInstance 헤더 주입 값(X-Tenant-ID, X-Agent-ID 등) 세팅 위치 | **구현됨** — tenant/토큰/agentId 모듈·전역 변수 | `libs/shared-utils/src/axios-instance.ts`: `getTenantId()`, `getAccessToken()`, `currentAgentId`(setAgentId로 설정). POST/PUT/GET 공통 헤더: Content-Type, X-Tenant-ID, Authorization(있을 때), X-Agent-ID(있을 때). **X-User-ID는 axiosInstance에 없음.** | 일반 API 호출에 X-User-ID 미포함. HITL/SSE 등은 별도 fetch에서 수동 주입. | PR: axiosInstance에 X-User-ID 옵션 또는 getUserId() 기반 자동 주입 추가 검토. |
| D3 | Remote에서 동일 헤더/테넌트 유지 | **동일** — Remote도 shared-utils 사용 시 동일 인스턴스 | Remote(admin)는 `@dwp-frontend/shared-utils` 사용. 토큰/tenant는 전역 스토리지·tenant-util 사용 시 Host와 동일 컨텍스트. | Remote 단독 실행 시 Host 미초기화면 getTenantId='1', 토큰 없을 수 있음. | 단독 실행 시 테넌트/토큰 초기화 시나리오 문서화. |
| **E. SSE/HITL 안정성** |
| E1 | Last-Event-ID 사용: 서버가 SSE `id:` 라인을 주는지 vs data 내부 id | **FE는 SSE 표준 `id:` 라인 파싱** | `libs/shared-utils/src/agent/use-agent-stream.ts`: 166–169행 `trimmedLine.startsWith('id: ')` → `lastEventIdRef.current = trimmedLine.slice(4).trim()`. 재연결 시 106행 `...(lastEventId && { 'Last-Event-ID': lastEventId })`. | **BE가 `id:` 라인을 보내지 않고 data 내부 id만 주면 재연결 시 동작 안 함.** | BE 확인: SSE 응답에 `id: <value>` 라인 포함 여부. 없으면 FE에서 data.id fallback 로직 추가 PR. |
| E2 | 이벤트 스키마 버저닝/파싱 실패 시 graceful handling | **부분 구현** — 파싱 실패만 처리, unknown type/버저닝 없음 | `use-agent-stream.ts`: JSON.parse 실패 시 catch에서 `console.error` 후 continue(215–216행). `data.type`은 thought/thinking/content 등 처리, 그 외는 addEventType만 호출. unknown type 필터/스키마 버전 필드 없음. | 신규 이벤트 타입·필드 추가 시 FE가 깨지거나 무시할 수 있음. | PR: unknown type는 로그만 하고 스트림 유지. 선택: data.version 무시 또는 경고 로그. |
| E3 | HITL 낙관적 업데이트: 서버 거절/검증 실패 시 UI 롤백/UX | **부분 구현** — 거절 후 상태 정리 있음, 명시적 롤백 없음 | `apps/dwp/src/pages/aiworkspace/hooks/use-ai-workspace.ts`: handleRejectHitl에서 rejectHitlRequest 호출 후 setPendingHitl(null), addMessage(거절 메시지), updateTimelineStep(..., { status: 'failed' }). 서버 에러 시 catch에서 메시지만 추가. `checkpoint-approval.tsx`: 편집 시 "Optimistic update"로 store만 반영, 승인/거절 API 실패 시 롤백 코드 없음. | 승인 요청 후 서버 거절 시 "승인됨"처럼 보였다가 뒤늦게 실패 메시지만 나올 수 있음. | PR: HITL approve/reject 응답 실패 시 pendingHitl 복원 또는 실패 토스트 + 상태 롤백. |
| E4 | 재연결(backoff 5회) 후 상태 동기화(중복/순서) | **구현됨** — Last-Event-ID 기반 재개, 중복 제거 로직 없음 | `use-agent-stream.ts`: attemptReconnect에서 최대 5회(286행), connectStream에 lastEventId 전달. README 257행: "Last-Event-ID로 중단 지점부터 재개". **이벤트 중복 제거 또는 순서 정렬 로직 없음.** | BE가 Last-Event-ID 기준으로 중복 제거하지 않으면 재연결 후 중복 이벤트 가능. | BE 확인: Last-Event-ID 이후 이벤트만 재전송하는지. FE에서 id 기반 중복 제거는 BE 정책 확인 후 검토. |
| **F. 운영/품질** |
| F1 | Nx lint/test/typecheck/build의 CI 단계 존재 여부 | **스크립트만 있음, CI 워크플로 없음** | `package.json`: `lint`, `lint:fix`, `test:e2e`, `tsc:watch` 등. root `vite.config.ts`에 checker(typescript, eslint). **`.github/` 아래에 workflows 디렉터리 없음**(PULL_REQUEST_TEMPLATE만 존재). | PR 머지 전 자동 lint/typecheck/build 미실행. | PR: `.github/workflows/ci.yml` 추가 — lint, tsc --noEmit, build(또는 nx run-many), e2e(선택). |
| F2 | Admin CRUD 4계층 신규 화면 Generator 존재 여부 | **미구현** — Remote 앱 생성 Generator만 존재 | `tools/generators/new-remote/index.ts`: 새 Remote 앱 생성(_starter 복사). **페이지/훅/어댑터/컴포넌트 4계층 CRUD 템플릿 Generator 없음.** | 신규 CRUD 시 수동으로 폴더/파일 생성, 표준 이탈 가능. | PR: Admin CRUD 페이지 Generator 추가(예: page + hooks + adapters + components 스켈레톤). |
| F3 | trackEvent 스키마(필수 필드/PII 마스킹) 정합성 | **필수 필드 구현, PII 마스킹 규칙 없음** | `libs/shared-utils/src/monitoring/event-tracking.ts`: resourceKey, action 필수. path/visitorId/userId 자동 채움. `libs/shared-utils/src/api/monitoring-api.ts` EventPayload: action, resourceKey 필수. metadata는 `Record<string, unknown>`. **PII 마스킹/금지 필드 규칙 없음.** | metadata에 이메일/이름 등 넣으면 그대로 전송. | PR: event-tracking 또는 DESIGN_SYSTEM에 "metadata에 PII 금지" 문서 + 선택적 sanitize(마스킹) 유틸. |

---

## 2) PR 단위 작업계획

| PR | 우선순위 | 목표 | 변경 파일/내용 요약 |
|----|----------|------|---------------------|
| **PR#1** | P0 | CI 파이프라인 도입 | **신규**: `.github/workflows/ci.yml` — on push/PR 시 `yarn lint`, `yarn tsc --noEmit`(또는 nx run-many typecheck), `yarn build`(또는 host build). 필요 시 `test:e2e`는 별도 워크플로 또는 cron. |
| **PR#2** | P0 | X-Tenant-ID 도메인 기반 추출 | **수정**: `libs/shared-utils/src/tenant-util.ts` — getTenantId()에서 hostname 파싱(예: subdomain), localhost/IP일 때 fallback '1'. **선택**: env `NX_TENANT_ID` 오버라이드. **테스트**: tenant-util 단위 테스트 추가. |
| **PR#3** | P1 | axiosInstance에 X-User-ID 헤더 추가 | **수정**: `libs/shared-utils/src/axios-instance.ts` — getUserId()(user-id-storage)로 userId 읽어 GET/POST/PUT 헤더에 `X-User-ID` 추가(없으면 생략 또는 'none'). BE가 모든 API에서 기대할 경우 적용. |
| **PR#4** | P1 | SSE unknown type·파싱 graceful 처리 강화 | **수정**: `libs/shared-utils/src/agent/use-agent-stream.ts` — 알 수 없는 data.type은 로그만 하고 스트림 계속. JSON 파싱 실패 시 이미 continue 중이므로, 필요 시 data.version 존재 시 로그 추가. |
| **PR#5** | P1 | HITL 서버 거절/실패 시 UI 롤백 | **수정**: `apps/dwp/src/pages/aiworkspace/hooks/use-ai-workspace.ts` — approve/reject API 실패 시 setPendingHitl(이전 값 복원) 또는 실패 토스트 후 pendingHitl 유지/메시지 추가. **수정**: `apps/dwp/src/components/aura/checkpoint-approval.tsx` — 승인 요청 중 로딩/비활성화로 이중 요청 방지. |
| **PR#6** | P2 | 401 시 Refresh 토큰 1회 시도 | **수정**: `libs/shared-utils/src/axios-instance.ts` — 401 발생 시 refresh 전용 함수 호출(shared-utils에 getRefreshToken, refreshApi 등 추가). 성공 시 새 토큰 저장 후 재시도, 실패 시 기존 handleAuthError. **신규**: `libs/shared-utils/src/api/auth-api.ts` 또는 auth 전용 모듈에 refresh 호출 함수(BE 계약 확인 후). |
| **PR#7** | P2 | trackEvent PII 정책 및 문서 | **수정**: `libs/shared-utils/src/monitoring/event-tracking.ts` — JSDoc 또는 주석으로 "metadata에 PII(이메일, 전화번호 등) 넣지 말 것" 명시. **선택**: metadata shallow copy 후 알려진 PII 키 마스킹. **문서**: `docs/essentials/PROJECT_RULES.md` 또는 이벤트 스펙에 정책 추가. |
| **PR#8** | P2 | Admin CRUD 페이지 Generator | **신규**: `tools/generators/new-admin-crud-page/` — 스키마: featureName, resourceKey 등. 출력: `apps/remotes/admin/src/pages/<feature>/index.tsx`, `types.ts`, `adapters/`, `hooks/`, `components/` 스켈레톤. `tools/generators/generators.json`에 등록. |
| **PR#9** | P3 | normalizeRoutePath 매핑 상수화/문서 | **수정**: `libs/shared-utils/src/router/normalize-route-path.ts` — path 매핑을 상수 객체로 분리. **문서**: BE–FE path 규칙을 docs/api-spec 또는 README에 요약. |
| **PR#10** | P3 | Remote/Generator ThemeProvider 검증 문서 | **문서**: `apps/remotes/_starter` 및 new-remote Generator 출력에 ThemeProvider 포함 여부 확인 후 `docs/essentials/LAYOUT_GUIDE.md` 또는 GETTING_STARTED에 "Remote 테마" 절 추가. |

---

## 3) BE 확인 질문 (필수)

| # | 질문 | 배경 | 선택지/정보 | 권장안 |
|---|------|------|-------------|--------|
| **Q1** | SSE 스트림에서 **`id:` 라인**을 표준대로 보내주시나요? | FE는 재연결 시 `Last-Event-ID` 헤더로 마지막 이벤트 ID를 보내고, **SSE 표준**은 `id: <value>` 라인으로 ID를 전달하는 것을 전제로 합니다. data JSON 내부의 id만 있으면 FE가 재연결 시 ID를 알 수 없습니다. | (1) 매 이벤트에 `id: <unique-id>` 라인 전송 (2) data 내부 id만 전송 (3) 미전송 | (1) 권장. (2)인 경우 FE에 data.id를 lastEventId로 쓰는 fallback 추가 가능. |
| **Q2** | **Last-Event-ID**를 받았을 때, 해당 ID 이후 이벤트만 재전송하시나요? | 재연결 후 중복 이벤트·순서 뒤섞임을 막으려면, 서버가 Last-Event-ID 이후 이벤트만 보내는 것이 좋습니다. | (1) ID 이후만 전송 (2) 항상 처음부터 또는 전체 재전송 (3) 미지원 | (1) 권장. (2)면 FE에서 id 기반 중복 제거 검토. |
| **Q3** | **Refresh Token** 계약이 있나요? (엔드포인트, 요청/응답 형식) | FE는 401 시 현재 무조건 로그아웃합니다. 장시간 세션을 위해 401 전에 access token 갱신을 하고 싶습니다. | (1) POST /api/auth/refresh 등 명세 제공 (2) 없음(갱신 없이 로그아웃 유지) | (1)이면 FE에 refresh 1회 시도 로직 추가. |
| **Q4** | 일반 API(Gateway 경유) 요청에 **X-User-ID** 헤더를 기대하시나요? | FE는 현재 HITL/SSE 등 일부 요청에만 X-User-ID를 넣습니다. axiosInstance에는 없습니다. | (1) 모든 인증 요청에 필요 (2) 선택/일부만 (3) 불필요 | (1)이면 PR#3으로 axiosInstance에 전역 주입. |
| **Q5** | 메뉴 트리 API의 **path** 값 규칙은 무엇인가요? (`/app/admin/...` vs `/admin/...`) | FE는 `normalizeRoutePath`로 `/app/admin/*` 등을 `/admin/*`로 변환합니다. BE가 이미 `/admin/*`만 주면 변환 불필요할 수 있습니다. | (1) BE가 `/app/admin/...` 등 prefix 포함 (2) BE가 이미 `/admin/...` (3) 혼재 가능 | 규칙을 API 스펙에 적어 주시면 FE 정규화 규칙과 맞춥니다. |

---

**문서 끝.**
