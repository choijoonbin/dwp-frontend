## DWP Frontend

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

Nx Monorepo 구조를 기반으로 구축된 DWP 프론트엔드 워크스페이스입니다.  
현재 **Host(Shell)와 Remote(Mail) 구조**가 Vite 기반으로 구성되어 있으며, 공통 UI 라이브러리(`design-system`)와 유틸리티(`shared-utils`)를 통해 마이크로 프론트엔드(MFE) 아키텍처를 실현하고 있습니다.

## 📋 목차

- [기술 스택](#-기술-스택)
- [아키텍처](#-아키텍처)
- [프로젝트 구조](#-프로젝트-구조)
- [포트 할당 규칙](#-포트-할당-규칙)
- [환경 변수(.env) 구성](#-환경-변수env-구성)
- [시작하기](#-시작하기)
- [주요 구현](#-주요-구현)
- [개발 규칙](#-개발-규칙)

## 🛠 기술 스택

- **Framework**: React 18+ + TypeScript
- **UI**: MUI v5 (Minimal UI Kit 기반)
- **Icons**: `@iconify/react` (표준 아이콘 시스템)
- **State Management**: 
  - **Global/Layout**: `Zustand` (Sidebar, Auth 상태 통합 관리)
  - **Server Data**: `TanStack Query` (사용 준비 완료)
- **Build/Dev**: Vite
- **Monorepo**: Nx (apps/libs 구조 및 Path Aliases 적용)

## 🏗 아키텍처

### Host / Remotes

- **Host 앱 (`apps/dwp`)**: 메인 쉘(Shell). 전체 레이아웃 소유, 인증 관리, 글로벌 네비게이션 제공.
- **Remote 앱들 (`apps/remotes/*`)**: 독립적인 비즈니스 모듈 (예: `mail`, `admin`, `chat`, `approval`).
- **공통 라이브러리**
  - `libs/design-system`: 공통 테마(ThemeProvider), 전역 스타일, 재사용 컴포넌트, 공유 훅.
  - `libs/shared-utils`: API 클라이언트(axiosInstance), 인증 처리(Auth), 공통 타입 및 유틸.

## 📁 프로젝트 구조

```
dwp-frontend/
├── apps/
│   ├── dwp/                  # Host (Shell) - port 4200
│   │   ├── src/
│   │   │   ├── layouts/       # Zustand 기반 DashboardLayout (Sidebar/Header)
│   │   │   ├── components/    # Aura FloatingButton, MiniOverlay 등
│   │   │   │   └── aura/      # AI 업무 파트너 UI 컴포넌트
│   │   │   ├── hooks/         # usePageContext 등 커스텀 훅
│   │   │   ├── store/         # useLayoutStore, useAuraStore (Zustand)
│   │   │   ├── routes/        # react-router (AuthGuard 적용 가능 구조)
│   │   │   └── pages/         # Dashboard, Sign-in, AI Workspace 등
│   └── remotes/
│       ├── mail/             # Remote (Mail) - port 4201
│       └── admin/            # Remote (Admin) - port 4204
│
├── libs/
│   ├── design-system/         # UI 표준 라이브러리
│   │   └── src/
│   │       ├── theme/         # MUI Theme + Dark/Light 토글 로직
│   │       └── components/    # Logo V3, Iconify, Workspaces, Label 등 공통 컴포넌트
│   └── shared-utils/          # 공통 비즈니스 로직
│       └── src/
│           ├── auth/          # AuthProvider, useAuth, JWT 스토리지
│           │   ├── auth-provider.tsx  # AuthProvider 컴포넌트
│           │   ├── token-storage.ts   # JWT 토큰 저장/조회
│           │   └── user-id-storage.ts # 사용자 ID 저장/조회 (JWT에서 추출)
│           ├── api/           # auth-api, main-api 등 실제 엔드포인트 호출
│           ├── agent/         # AI 에이전트 관련 유틸리티
│           │   ├── context-util.ts  # 페이지 컨텍스트 수집
│           │   ├── use-agent-stream.ts # SSE 스트리밍 훅
│           │   └── hitl-api.ts     # HITL 승인/거절 API
│           ├── axios-instance.ts # fetch 기반 axios-like wrapper (Auth 헤더 자동 포함)
│           └── types.ts       # ApiResponse<T> 등 공통 타입 정의
```

## 🔌 포트 할당 규칙

| 앱 | 포트 | 역할 |
|---|---:|---|
| dwp | 4200 | Host 앱 (Main Shell) |
| mail | 4201 | Remote 앱 (메일 모듈) |
| chat | 4202 | Remote 앱 (채팅 모듈 - 예정) |
| approval | 4203 | Remote 앱 (결재 모듈 - 예정) |
| admin | 4204 | Remote 앱 (관리자 모듈) |

- **규칙**: Host는 `4200`, Remote는 `4201`부터 순차 할당. 중복 절대 금지.

## 🔧 환경 변수(.env) 구성

API 엔드포인트는 **환경 변수 `NX_API_URL`**로 주입됩니다.

- **local**: `.env` (개발 시 localhost:8080 주소 등 설정)
- **dev**: `.env.dev`
- **prod**: `.env.prod`

**중요**: Gateway(8080)를 통해 Aura-Platform(9000)과 통신하므로, `.env` 파일에 다음을 설정하세요:

```bash
NX_API_URL=http://localhost:8080
```

Vite의 `define` 설정을 통해 `process.env.NX_API_URL` 형태로 코드 어디서든 참조 가능합니다.

## 🚀 시작하기

### 설치 및 실행

```bash
npm install
```

#### 개별 앱 실행

각 앱을 별도의 터미널에서 실행합니다:

```bash
# 터미널 1: Host 앱 (포트 4200)
npm run dev

# 터미널 2: Mail Remote 앱 (포트 4201)
npm run dev:mail

# 향후 추가될 Remote 앱들도 동일한 방식으로 실행
# npm run dev:chat      # 포트 4202
# npm run dev:approval  # 포트 4203
# npm run dev:admin     # 포트 4204
```

#### 모든 앱 동시 실행

**방법 1: npm run dev:all 사용** (권장)

`package.json`에 이미 설정된 스크립트를 사용하여 모든 앱을 한 번에 실행합니다:

```bash
npm run dev:all
```

> **참고**: 새로운 Remote 앱이 추가되면 `package.json`의 `dev:all` 스크립트에 해당 앱의 실행 명령을 추가해야 합니다.
> 예: `"dev:all": "npx concurrently \"npm run dev\" \"npm run dev:mail\" \"npm run dev:admin\" \"npm run dev:chat\""`
> 
> `npx`를 사용하면 `concurrently` 패키지가 설치되어 있지 않아도 자동으로 다운로드하여 실행합니다.

**방법 2: Nx run-many 사용** (Nx 타겟이 설정된 경우)

```bash
# 특정 앱들만 지정하여 실행
npx nx run-many --target=serve --projects=dwp,mail --parallel=2

# 모든 앱 자동 감지 (라이브러리 제외)
npx nx run-many --target=serve --all --parallel
```

**방법 3: 여러 터미널에서 수동 실행**

각 앱을 개별 터미널에서 실행하는 방식입니다. 가장 안정적이며 디버깅이 용이합니다.

## 🛠 신규 모듈 생성 가이드 (Custom Nx Generator)

새로운 Remote 모듈(앱)을 추가할 때는 표준화된 스켈레톤을 생성해주는 커스텀 Generator를 사용합니다.

### 1. 신규 모듈 생성 명령어
```bash
# npx nx workspace-generator [이름] --name=[모듈명] --port=[포트번호]
npx nx workspace-generator new-remote --name=chat --port=4202
```

### 2. 생성 후 단
1.  **개발 시작**: `apps/remotes/[모듈명]/src/entry.tsx` 파일에서 비즈니스 로직 개발을 시작합니다.
2.  **Host 연결**: `apps/dwp/src/layouts/nav-config-dashboard.tsx`에 신규 모듈의 메뉴 정보를 추가합니다.
3.  **MFE 등록 (향후)**: Webpack Module Federation 도입 시 `module-federation.config.ts`에 노출 정보를 등록합니다.

### 3. 개발 표준 준수
- **테마 주입**: 모든 Remote는 `libs/design-system`의 `ThemeProvider`로 감싸져야 합니다. (Generator 자동 포함)
- **API 호출**: `libs/shared-utils`의 `axiosInstance`를 사용하세요.
- **아이콘**: `@iconify/react`를 사용하세요.

## ✅ 주요 구현

### 1. 인증 및 보안 시스템 (Auth)
- **AuthProvider**: `libs/shared-utils`에 위치하며 JWT 토큰 저장 및 자동 `Authorization` 헤더 주입 기능을 포함합니다.
- **Login Policy Branching**: 테넌트별 인증 정책(LOCAL/SSO)에 따라 로그인 UI가 자동으로 분기됩니다.
  - `/api/auth/policy` API 연동으로 허용된 로그인 타입만 노출
  - SSO 선택 시 해당 IDP(Google, MS 등)로 리다이렉트 및 콜백 처리 (`/sso-callback`)
- **AuthGuard & Route Protection**: 보호된 라우트에 자동 적용되어 인증되지 않은 사용자는 `/sign-in`으로 리다이렉트되며, `PermissionRouteGuard`를 통해 권한별 접근 제어를 수행합니다.
- **401/403 전역 처리**: `axiosInstance`에서 401(토큰 만료) 시 로그아웃, 403(권한 없음) 시 전역 에러 알림 처리를 수행합니다.

### 2. 고도화된 사이드바 및 레이아웃 (Zustand)
- **Dynamic Sidebar**: `Zustand` 기반으로 확장(300px) 및 축소(88px) 기능을 제공하며, 축소 시 아이콘 아래 메뉴명을 배치하여 가독성을 높였습니다.
- **UI UX 최적화**: 
  - 사이드바 축소 시 서브메뉴 팝오버 위치 및 깜빡임 현상을 완벽히 해결했습니다.
  - 모바일 환경에서 데스크탑 전환 시 사이드바가 자동으로 닫히는 지능형 레이아웃을 적용했습니다.
  - **접근성(Aria)**: 팝오버 및 드로어 사용 시 `aria-hidden` 충돌을 방지하는 포커스 관리 로직을 보강했습니다.

### 3. DWP 통합 로고 시스템
- **Logo V3**: Primary 팔레트와 연동되는 "D" 아이콘과 "DWP" 텍스트 조합의 반응형 로고를 적용했습니다.
- **상태 연동**: 사이드바 축소 시 텍스트가 자동으로 숨겨지며 로고 정렬이 중앙으로 최적화됩니다.

### 4. Admin CRUD 표준화 및 고도화
- **Enterprise CRUD Pattern**: 모든 관리자 화면(Users, Roles, Resources, Menus 등)을 `Page(Orchestration) - Hooks(Logic) - Adapters(Transform) - Components(UI)`의 4계층 구조로 리팩토링했습니다.
- **Roles 관리 화면 Redesign**:
  - **3단 레이아웃**: 좌측 역할 리스트, 우측 상세 탭(개요/멤버/권한) 구조로 생산성을 높였습니다.
  - **권한 매트릭스**: ALLOW/DENY/null 3단태 상태를 지원하는 인터랙티브 매트릭스를 구현했습니다. 행/열 일괄 처리 기능을 포함합니다.
  - **Sticky Save Bar**: 데이터 수정 시 하단에 플로팅 저장 바가 나타나며, 변경사항 유실 방지를 위한 탭 이동 방지 팝업을 제공합니다.
- **표준화된 에러 핸들링**: `HttpError` 클래스와 `useMutationErrorHandler`를 통해 백엔드 에러 메시지를 사용자 친화적으로 노출합니다.

### 5. 데이터 분석 및 모니터링
- **Standardized Event Tracking**: `trackEvent` 유틸리티를 통해 사용자 액션(VIEW, CLICK, SEARCH 등)을 표준화된 규격으로 수집합니다.
- **Admin Audit Logs**: 시스템 내 모든 주요 변경 사항을 추적하는 감사 로그 화면을 제공합니다.

### 6. 에이전틱 AI 연동 표준 (Aura)
글로벌 SaaS 수준의 Agentic AI 업무 파트너 시스템을 구현했습니다.

#### 핵심 기능
- **Floating AI Button**: 우측 하단에 고정된 원형 버튼으로 `arua.gif` 애니메이션을 사용합니다. 
- **Stream Status Banner**: AI 응답 스트리밍 상태(Connecting, Streaming, Error)를 실시간으로 알려주는 상단 배너를 추가했습니다.
- **Mini AI Chat Overlay & Full AI Workspace**: 상황에 맞는 AI 업무 공간을 제공하며, 대화 히스토리가 실시간으로 동기화됩니다.
- **Context Awareness**: `usePageContext`를 통해 현재 경로, 제목, 메타데이터를 AI에게 자동으로 전달합니다.
- **Thought/Plan/Log/Result Visualizer**: AI의 사고 과정부터 실행 계획, 도구 로그, 최종 결과물까지 단계별로 시각화합니다.
- **HITL (Human-In-The-Loop)**: 사용자 승인이 필요한 단계에서 실행을 멈추고 인라인 수정 및 승인/거절을 받는 인터페이스를 제공합니다.

#### 기술 구현
- **SSE 스트리밍**: `fetch` API의 `ReadableStream`을 사용하여 백엔드로부터 실시간 스트리밍을 받습니다. `thought`, `plan_step`, `tool_execution`, `hitl`, `content`, `plan_step_update`, `timeline_step_update` 등 다양한 이벤트 타입을 처리합니다.
- **SSE 자동 재연결**: 네트워크 일시 단절 시 Exponential Backoff 방식으로 최대 5회 자동 재연결을 시도합니다. 재연결 시 `Last-Event-ID` 헤더를 통해 마지막으로 받은 이벤트 ID를 전달하여 중단 지점부터 재개합니다.
- **MFE Context Bridge**: Remote 앱(Mail 등)의 내부 상태(선택된 항목, 그리드 선택 값, 뷰 상태)를 `window.dwpContextProvider` 인터페이스를 통해 동적으로 수집합니다. Remote 앱은 이 인터페이스를 구현하여 컨텍스트를 제공할 수 있습니다.
- **HITL API 통합**: `libs/shared-utils/src/agent/hitl-api.ts`에서 승인/거절 API를 제공합니다. 백엔드의 `/api/aura/hitl/approve/{requestId}` 및 `/api/aura/hitl/reject/{requestId}` 엔드포인트와 통합됩니다.
- **HITL 낙관적 업데이트**: `checkpoint-approval.tsx`에서 사용자가 내용을 수정할 경우, 즉시 `use-aura-store`에 반영하여 UI가 즉시 업데이트됩니다. 백엔드 전송 전에도 수정된 내용이 UI에 반영됩니다.
- **사용자 ID 관리**: `libs/shared-utils/src/auth/user-id-storage.ts`에서 JWT 토큰에서 사용자 ID를 자동 추출하여 localStorage에 저장합니다. 로그인 시 자동으로 추출되며, HITL API 호출 시 자동으로 포함됩니다.
- **결과 메타데이터 추적**: `content` 이벤트의 `metadata.result`를 추적하여 결과 탭에 표시합니다. Diff, Preview, Checklist, Text 등 다양한 결과 타입을 지원합니다.
- **Agent Context Utility**: `libs/shared-utils/src/agent/context-util.ts`에서 현재 활성 앱, URL 경로, 항목 ID 등을 자동으로 수집하여 에이전트 요청 시 문맥(Context)을 전달합니다.
- **Header Interceptors**: `axiosInstance`를 통해 모든 요청에 `X-Tenant-ID` 및 `X-Agent-ID`를 자동으로 주입합니다.
- **Framer Motion**: Timeline 및 Floating Button의 애니메이션에 사용됩니다.
- **react-syntax-highlighter**: 코드 Diff 및 코드 블록 렌더링에 사용됩니다.

#### 백엔드 통합
- **API 스펙 문서**: `docs/BACKEND_API_SPEC.md`에 백엔드 개발팀을 위한 상세한 API 스펙이 정의되어 있습니다.
- **SSE 이벤트 타입**: `thought`, `plan_step`, `tool_execution`, `hitl`, `content`, `timeline_step_update`, `plan_step_update` 등 모든 이벤트 타입이 정의되어 있습니다.
- **HITL 승인 플로우**: 승인 요청 → 사용자 승인/거절 → 스트리밍 재개/종료 플로우가 완전히 구현되어 있습니다.

## 📚 문서

프로젝트 관련 상세 문서는 `docs/` 디렉토리에서 확인할 수 있습니다:

- **`docs/aura.md`**: Aura AI 통합 가이드 (프론트엔드 구현 상세)
- **`docs/BACKEND_API_SPEC.md`**: 백엔드 개발팀을 위한 API 스펙서 (SSE 이벤트 타입, HITL API, UI 탭별 데이터 요구사항)
- **`docs/INTEGRATION_CHECKLIST.md`**: 통/협업 관점 통합 체크리스트 (포트 충돌, 사용자 식별자, SSE 전송 방식 등 확인 필요 사항)
- **`docs/FRONTEND_VERIFICATION_RESPONSE.md`**: 프론트엔드 확인 응답 체크리스트 (백엔드 확인 요청에 대한 구현 상태 응답)
- **`docs/FRONTEND_VERIFICATION_REQUIREMENTS.md`**: 프론트엔드 확인 요청 사항 (JWT 매핑, POST SSE, 재연결, CORS, 에러 처리 상세 가이드)
- **`docs/ADMIN_CRUD_UI.md`**: Admin Remote CRUD 화면 구현 가이드 (Users, Roles, Resources, Codes 관리)
- **`docs/ADMIN_REMOTE_IMPLEMENTATION.md`**: Admin Remote 구현 상세 (권한 시스템, 코드 사용 정책, API 통합)
- **`docs/LOGIN_POLICY_UI.md`**: 로그인 정책 기반 UI 분기 구현 가이드 (LOCAL/SSO 자동 분기)

## 🧪 통합 테스트 가이드 (Aura-Platform)

Aura-Platform 및 Gateway와의 통합 테스트를 위해 다음 사항을 점검하세요:

1.  **엔드포인트 설정**: `.env` 파일의 `NX_API_URL`이 Gateway 주소(예: `http://localhost:8080`)를 정확히 가리키고 있는지 확인하세요.
2.  **SSE 데이터 규격**: 백엔드는 `data: {"type": "thought", "content": "..."}\n\n` 형식을 준수해야 하며, 스트림 종료 시 `data: [DONE]`을 전송해야 합니다. 자세한 스펙은 `docs/BACKEND_API_SPEC.md`를 참조하세요.
3.  **CORS 허용 헤더**: Gateway에서 `X-Tenant-ID`, `X-User-ID`, `Authorization` 헤더를 CORS 허용 목록에 추가해야 합니다.
4.  **컨텍스트 수집**: 대화 시작 시 `context` 객체가 백엔드로 정상 전달되는지 브라우저 네트워크 탭에서 확인하세요.
5.  **HITL 승인 플로우**: 승인 요청 시 스트리밍이 일시 중지되고, 승인/거절 후 적절히 재개/종료되는지 확인하세요.

## 💻 개발 규칙

- **컴포넌트**: 반드시 화살표 함수(`export const`) 형식을 사용합니다.
- **아이콘**: 디자인 일관성을 위해 모든 아이콘은 **Iconify(`@iconify/react`)**를 표준으로 사용합니다.
  - **오프라인 등록**: 아이콘 로딩 시 깜빡임(flickering) 방지를 위해, 빈번히 사용되는 아이콘은 `libs/design-system/src/components/iconify/icon-sets.ts`에 등록하여 사용합니다.
- **공통화**: 앱 간 공유가 필요한 모든 코드는 반드시 `libs/*` 하위 라이브러리로 분리합니다. Host/Remote 간 직접적인 import는 금지됩니다.

## 🔤 폰트 및 스타일
- **Fonts**: DM Sans(본문), Barlow(헤더) 표준 폰트를 사용합니다.
- **Global CSS**: `libs/design-system/src/styles/global.css`에서 중앙 관리합니다.
