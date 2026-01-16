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
- **Remote 앱들 (`apps/remotes/*`)**: 독립적인 비즈니스 모듈 (예: `mail`, `chat`, `approval`).
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
│   │   ├── components/    # Aura FloatingButton, MiniOverlay 등
│   │   │   └── aura/      # AI 업무 파트너 UI 컴포넌트
│   │   ├── hooks/         # usePageContext 등 커스텀 훅
│   │   ├── store/         # useLayoutStore, useAuraStore (Zustand)
│   │   ├── routes/        # react-router (AuthGuard 적용 가능 구조)
│   │   └── pages/         # Dashboard, Sign-in, AI Workspace 등
│   └── remotes/
│       └── mail/             # Remote (Mail) - port 4201
│
├── libs/
│   ├── design-system/         # UI 표준 라이브러리
│   │   └── src/
│   │       ├── theme/         # MUI Theme + Dark/Light 토글 로직
│   │       └── components/    # Logo V3, Iconify, Workspaces, Label 등 공통 컴포넌트
│   └── shared-utils/          # 공통 비즈니스 로직
│       └── src/
│           ├── auth/          # AuthProvider, useAuth, JWT 스토리지
│           ├── api/           # auth-api, main-api 등 실제 엔드포인트 호출
│           ├── agent/         # AI 에이전트 관련 유틸리티
│           │   ├── context-util.ts  # 페이지 컨텍스트 수집
│           │   └── use-agent-stream.ts # SSE 스트리밍 훅
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

- **규칙**: Host는 `4200`, Remote는 `4201`부터 순차 할당. 중복 절대 금지.

## 🔧 환경 변수(.env) 구성

API 엔드포인트는 **환경 변수 `NX_API_URL`**로 주입됩니다.

- **local**: `.env` (개발 시 localhost:8080 주소 등 설정)
- **dev**: `.env.dev`
- **prod**: `.env.prod`

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
```

#### 모든 앱 동시 실행

**방법 1: npm run dev:all 사용** (권장)

`package.json`에 이미 설정된 스크립트를 사용하여 모든 앱을 한 번에 실행합니다:

```bash
npm run dev:all
```

> **참고**: 새로운 Remote 앱이 추가되면 `package.json`의 `dev:all` 스크립트에 해당 앱의 실행 명령을 추가해야 합니다.
> 예: `"dev:all": "npx concurrently \"npm run dev\" \"npm run dev:mail\" \"npm run dev:chat\""`
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

#### 기술 구현
- **useAgentStream**: SSE(Server-Sent Events)를 지원하는 TanStack Query 기반 스트리밍 훅입니다. '추론(Thinking)' 상태와 실시간 텍스트 출력을 지원하며, `AbortController`를 통한 중단 기능을 포함합니다.
- **Agent Context Utility**: 현재 활성 앱, URL 경로, 항목 ID 등을 자동으로 수집하여 에이전트 요청 시 문맥(Context)을 전달합니다.
- **ApprovalDialog**: 에이전트가 주요 액션을 수행하기 전 사용자의 명시적 승인을 받기 위한 HITL(Human-in-the-loop) 표준 UI 컴포넌트입니다.
- **Header Interceptors**: `axiosInstance`를 통해 모든 요청에 `X-Tenant-ID` 및 `X-Agent-ID`를 자동으로 주입합니다.

## 🧪 통합 테스트 가이드 (Aura-Platform)

Aura-Platform 및 Gateway와의 통합 테스트를 위해 다음 사항을 점검하세요:

1.  **엔드포인트 설정**: `.env` 파일의 `NX_API_URL`이 Gateway 주소(예: `http://localhost:8080`)를 정확히 가리키고 있는지 확인하세요.
2.  **SSE 데이터 규격**: 백엔드는 `data: {"content": "..."}\n\n` 또는 `data: {"type": "thought"}\n\n` 형식을 준수해야 하며, 스트림 종료 시 `data: [DONE]`을 전송해야 합니다.
3.  **CORS 허용 헤더**: Gateway에서 `X-Tenant-ID`, `X-Agent-ID`, `Authorization` 헤더를 CORS 허용 목록에 추가해야 합니다.
4.  **컨텍스트 수집**: 대화 시작 시 `context` 객체가 백엔드로 정상 전달되는지 브라우저 네트워크 탭에서 확인하세요.

## 💻 개발 규칙

- **컴포넌트**: 반드시 화살표 함수(`export const`) 형식을 사용합니다.
- **아이콘**: 디자인 일관성을 위해 모든 아이콘은 **Iconify(`@iconify/react`)**를 표준으로 사용합니다.
  - **오프라인 등록**: 아이콘 로딩 시 깜빡임(flickering) 방지를 위해, 빈번히 사용되는 아이콘은 `libs/design-system/src/components/iconify/icon-sets.ts`에 등록하여 사용합니다.
- **공통화**: 앱 간 공유가 필요한 모든 코드는 반드시 `libs/*` 하위 라이브러리로 분리합니다. Host/Remote 간 직접적인 import는 금지됩니다.

## 🔤 폰트 및 스타일
- **Fonts**: DM Sans(본문), Barlow(헤더) 표준 폰트를 사용합니다.
- **Global CSS**: `libs/design-system/src/styles/global.css`에서 중앙 관리합니다.
