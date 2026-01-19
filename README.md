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

### 1. 인증 시스템 (Auth)
- **AuthProvider**: `libs/shared-utils`에 위치하며 JWT 토큰 저장 및 자동 `Authorization` 헤더 주입 기능을 포함합니다.
- **Sign-in**: 실제 `dwp-auth-server`의 `/api/auth/login` 엔드포인트와 연동되도록 설계되었습니다.
  - 요청 Body: `{ username, password, tenantId }` 형식으로 전송
  - `Content-Type: application/json` 헤더 자동 포함
  - `X-Tenant-ID` 헤더 자동 주입 (서브도메인 기반 자동 추출)
- **로그인 상태 유지**: `localStorage`에 토큰 저장으로 브라우저 재시작 후에도 로그인 상태 유지
- **AuthGuard**: 보호된 라우트에 자동 적용되어 인증되지 않은 사용자는 `/sign-in`으로 리다이렉트
- **401/403 전역 처리**: `axiosInstance`에서 401/403 응답 시 자동으로 로그아웃 및 리다이렉트 처리
- **returnUrl 지원**: 로그인 후 원래 접근하려던 페이지로 자동 복귀

### 2. 고도화된 사이드바 및 레이아웃 (Zustand)
- **Dynamic Sidebar**: `Zustand` 기반으로 확장(300px) 및 축소(88px) 기능을 제공합니다.
- **Micro UI Optimization**: 축소 시 메뉴 아이템 사이즈를 **79*58**로 고정하고, 아이콘 아래에 메뉴명을 배치하여 가독성을 극대화했습니다.
- **Grouped Menu**: 메뉴를 'Management', 'Apps' 등 논리적 그룹으로 분리하고 독립적인 컨테이너(`Box`)로 감싸 정교한 CSS 관리가 가능합니다.
- **Header Workspace**: 팀 선택기(`WorkspacesPopover`)를 사이드바에서 상단 헤더 좌측으로 이동하여 접근성을 높였습니다.

### 3. DWP V3 로고 시스템
- **신규 로고 적용**: 가독성을 높인 'D', 'P' 분리형 V3 로고를 적용했습니다.
- **UI 무결성**: 원형 잘림이나 찌그러짐 방지를 위해 `overflow: visible` 처리 및 `rx: 10` 사각형 배경을 적용했습니다.
- **테마 동기화**: 로고 색상이 MUI Primary 팔레트와 실시간 연동되어 프리셋 변경 시 자동 대응됩니다.

### 4. API 통신 규격
- **ApiResponse<T>**: `status`, `message`, `data`, `timestamp`를 포함하는 백엔드 공통 규격을 사용합니다.
- **HttpError**: 상태 코드(404, 401 등)에 따른 분기 처리를 위해 전역 에러 객체를 지원합니다.

### 5. 에이전틱 AI 연동 표준 (Aura)
### 6. 권한 기반 Admin 모듈 (Admin Remote)
- **Admin Remote**: `apps/remotes/admin` (포트 4204) 신규 추가
- **접근 제어**: `menu.admin` VIEW 권한 없으면 메뉴/라우트 접근 불가
- **권한 스토어**: `libs/shared-utils/src/auth/permissions-store.ts` (Zustand)
- **권한 훅**: `usePermissions()`로 `hasPermission`, `canViewMenu`, `canUseButton` 제공
- **Route Guard**: `/admin/*` 경로에 PermissionRouteGuard 적용
- **CRUD 기능**: Users, Roles, Resources, Codes 관리 화면 구현 완료
  - **Users**: 사용자 목록, 생성/수정/삭제, 역할 할당, 비밀번호 초기화
  - **Roles**: 역할 목록, 생성/수정/삭제, 멤버 관리, 권한 매핑
  - **Resources**: 리소스 트리 뷰, 생성/수정/삭제, 타입별 필터링
  - **Codes**: 코드 그룹 및 코드 CRUD, 활성화/비활성화 관리
- **권한 기반 UI 제어**: `PermissionGate` 컴포넌트로 버튼/액션 제어
- **코드 사용 정책**: 메뉴별 `resourceKey` 기반 코드 조회 (`/api/admin/codes/usage`)
- **로그인 정책 기반 UI 분기**: 테넌트별 인증 정책(LOCAL/SSO)에 따라 로그인 UI 자동 분기
  - `/api/auth/policy` API로 정책 조회
  - `allowedLoginTypes`에 따라 ID/PW 폼 또는 SSO 버튼 표시
  - 정책 조회 실패 시 fallback 없이 Alert 표시 (보안 강화)
- **테넌트 ID 설정**: 테스트용으로 기본값 "1" 사용 (`libs/shared-utils/src/tenant-util.ts`)
  - 모든 API 요청에 `X-Tenant-ID: 1` 헤더 자동 주입
  - 향후 실제 테넌트 ID 추출 로직으로 변경 예정

글로벌 SaaS 수준의 Agentic AI 업무 파트너 시스템을 구현했습니다.

#### 핵심 기능
- **Floating AI Button**: 우측 하단에 고정된 원형 버튼으로 `arua.gif` 애니메이션을 사용합니다. 알림 배지, hover 애니메이션, 글로우 효과가 포함되어 있습니다.
- **Mini AI Chat Overlay**: 버튼 클릭 시 우측에 슬라이드되는 오버레이로, 현재 페이지를 가리지 않고 빠른 상호작용을 제공합니다.
- **Full AI Workspace**: `/ai-workspace` 경로의 전체 페이지로, 좌측 채팅 패널과 우측 타임라인 UI(계획 → 실행 → 결과)를 제공합니다.
- **Context Awareness**: `usePageContext` 훅을 통해 현재 URL, 페이지 제목, 메타데이터를 자동으로 수집하여 AI에게 전달합니다.
- **Quick Actions**: Mini Overlay 상단에 "현재 화면 요약", "다음 행동 추천" 버튼을 제공합니다.
- **Return Path**: AI Workspace에서 작업 완료 후 이전 페이지로 복귀할 수 있는 기능입니다.

#### 상태 관리
- **Zustand Store (`use-aura-store.ts`)**: 대화 히스토리, 오버레이 상태, 알림 상태를 전역으로 관리합니다. Mini Overlay와 Full Workspace 간 상태가 자동으로 동기화됩니다.
- **메시지 유지**: 오버레이에서 시작한 대화가 Workspace로 확장되어도 히스토리가 그대로 유지됩니다.

#### 고급 시각화 기능
- **사고 과정 탭 (Thought Process)**: AI의 내부 사고 체인을 타임라인으로 시각화합니다. `thought` 이벤트를 통해 실시간으로 사고 과정을 표시하며, 참고 자료(코드 파일, 대화 기록 등)를 칩 형태로 표시합니다. `timeline_step_update` 이벤트로 타임라인 단계 상태를 실시간 업데이트합니다.
- **작업 계획 탭 (Work Plan)**: 에이전트의 단계별 실행 계획을 카드 형태로 표시합니다. 사용자가 순서 변경, 승인, 건너뛰기를 할 수 있으며, `plan_step` 및 `plan_step_update` 이벤트로 실시간 업데이트됩니다.
- **실행 로그 탭 (Execution Log)**: 실제 도구(Git, Jira 등) 호출 시 파라미터와 결과를 다크 테마의 로그 뷰어 스타일로 표시합니다. `tool_execution` 이벤트를 통해 실행 상태(executing/completed/failed)를 실시간으로 표시합니다.
- **결과 탭 (Results)**: 결과물을 Diff(코드 변경사항), 문서 프리뷰, 체크리스트 등 다양한 형태로 렌더링합니다. `content` 이벤트의 `metadata.result`를 통해 결과를 표시하며, `react-syntax-highlighter`를 사용하여 코드를 가독성 있게 표시합니다.
- **Reasoning Timeline**: 에이전트의 단계별 계획 수립 과정을 시각화합니다. 각 단계는 Pending, Processing, Completed, Failed 상태로 구분되며, Framer Motion을 활용한 부드러운 애니메이션을 제공합니다.
- **HITL Approval Dialog**: 에이전트가 사용자 승인이 필요한 단계에서 실행을 멈추고, 승인/거절 버튼을 강조하여 표시합니다. 사용자가 작업 내용을 인라인으로 수정할 수 있습니다.

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
