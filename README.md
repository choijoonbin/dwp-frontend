## DWP Frontend

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

Nx Monorepo 구조를 **준비**한 DWP 프론트엔드 워크스페이스입니다.  
현재는 **Vite 기반 Host/Remote 개발환경**을 우선 구성해 빠르게 UI/테마/공통 라이브러리 분리를 완료했고, 추후 **Webpack Module Federation(MFE)** 으로 확장할 수 있도록 디렉토리/포트/공통 모듈 규칙을 정리했습니다.

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

- **Framework**: React + TypeScript
- **UI**: MUI v5 (Minimal UI Kit 기반)
- **Icons**: `@iconify/react` + 템플릿 Icon registry
- **Build/Dev**: Vite
- **Monorepo (준비)**: Nx 스타일 디렉토리/설정(`nx.json`, `tsconfig.base.json`)

## 🏗 아키텍처

### Host / Remotes

- **Host 앱 (`apps/dwp`)**: 레이아웃(사이드바/상단바) + 라우팅 + Remote가 들어올 공간(페이지/Outlet)을 제공
- **Remote 앱들 (`apps/remotes/*`)**: 독립 실행 가능한 기능 모듈 (현재 `mail`만 샘플 구현)
- **공통 라이브러리**
  - `libs/design-system`: 템플릿 테마/컴포넌트/훅을 공통화
  - `libs/shared-utils`: API base URL, API 함수, axiosInstance(현재는 fetch 기반 wrapper)

### 상태 (중요)

- **Nx / Module Federation**: 현재 워크스페이스는 *Nx 폴더 구조와 설정을 “준비”한 단계*입니다.  
  실제 `nx serve` / Webpack Module Federation 설정은 다음 단계에서 적용합니다.

## 📁 프로젝트 구조

```
dwp-frontend/
├── apps/
│   ├── dwp/                  # Host (Vite) - port 4200
│   │   ├── index.html
│   │   └── src/
│   │       ├── layouts/       # DashboardLayout 기반 레이아웃
│   │       ├── routes/        # react-router 구성
│   │       ├── pages/         # Dashboard/Mail/Chat/Approval
│   │       └── features/
│   │           └── health/    # Main API Health Check UI
│   └── remotes/
│       └── mail/             # Remote (Vite) - port 4201
│           ├── vite.config.ts
│           └── src/
│               └── mail-app.tsx
│
├── libs/
│   ├── design-system/         # 공통 테마/컴포넌트/훅
│   │   └── src/
│   │       ├── theme/         # ThemeProvider + light/dark 토글
│   │       ├── components/    # Iconify/Label/Scrollbar 등
│   │       └── hooks/         # router hooks 등
│   └── shared-utils/          # API/유틸
│       └── src/
│           ├── env.ts
│           ├── axios-instance.ts
│           └── api/
│               └── main-api.ts
│
├── vite.config.ts             # Host Vite config (apps/dwp root)
├── nx.json                    # Nx workspace layout (준비)
├── tsconfig.base.json         # TS path aliases
└── package.json
```

## 🔌 포트 할당 규칙

| 앱 | 포트 | 역할 |
|---|---:|---|
| dwp | 4200 | Host 앱 |
| mail | 4201 | Remote 앱 |
| chat | 4202 | Remote 앱 (예정) |
| approval | 4203 | Remote 앱 (예정) |

- **규칙**: Host는 `4200`, Remote는 `4201`부터 순차 할당
- **Remote 추가 시**: 다음 Remote는 `4202`, 그 다음은 `4203`… (중복 금지)

## 🔧 환경 변수(.env) 구성

운영 배포를 대비해 API 엔드포인트는 **환경 변수 `NX_API_URL`**로 주입됩니다.

- **local**: `.env`
- **dev**: `.env.dev`
- **prod**: `.env.prod`

예시:

```bash
# .env (local)
NX_API_URL=http://localhost:8080
```

> **참고**
>
> 현재(현 단계) 워크스페이스는 **Vite**에서 `loadEnv()`로 위 파일들을 읽고, 빌드/실행 시 `define`으로
> `process.env.NX_API_URL`을 **빌드 타임 주입**합니다.
>
> - Host: `vite.config.ts`
> - Remote 예시(mail): `apps/remotes/mail/vite.config.ts`
>
> **Nx + Webpack Module Federation 전환 시(향후)**에는 `webpack.config.js`(또는 federation config)에서
> `DefinePlugin`으로 `process.env.NX_API_URL`을 동일하게 주입해야 합니다.
>
> 예시(개념):
>
> ```js
> // webpack.config.js (concept)
> plugins: [
>   new webpack.DefinePlugin({
>     'process.env.NX_API_URL': JSON.stringify(process.env.NX_API_URL ?? 'http://localhost:8080'),
>   }),
> ]
> ```

## 🚀 시작하기

### 설치

```bash
npm install
```

### Host 실행 (local)

```bash
npm run dev
```

- 접속: `http://localhost:4200`

### Host 실행 (dev 모드)

```bash
npm run dev:dev
```

### Remote(mail) 실행 (local)

```bash
npm run dev:mail
```

- 접속: `http://localhost:4201`

### Remote(mail) 실행 (dev 모드)

```bash
npm run dev:mail:dev
```

### 빌드 (prod 모드)

```bash
npm run build
npm run build:mail
```

## ✅ 주요 구현

### 테마/다크모드 토글

- `libs/design-system`의 `ThemeProvider`가 전역 테마를 제공
- 상단바에서 **Light/Dark 토글** 가능 (localStorage에 저장)

### Host 레이아웃

- DashboardLayout 기반
- 사이드바 메뉴: **Dashboard / Mail / Chat / Approval**
- 중앙 영역: Remote 모듈이 들어올 수 있도록 페이지/Outlet 기반으로 확장

### Main API Health Check

#### 엔드포인트 규칙

- **Base URL**: `NX_API_URL` (기본값 `http://localhost:8080`)
- **Gateway 단일 진입점**: `http://localhost:8080`
- **Main API prefix**: `/api/main/**`

#### 사용 엔드포인트

- `GET /api/main/health`

#### 예상 응답 스키마

```ts
type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

type MainHealthPayload = {
  status: string;
  timestamp?: string;
};
```

- Host Dashboard 화면 상단에서 `GET /api/main/health` 결과를 Alert/Chip으로 표시
- API base URL은 `NX_API_URL`을 사용

## 🗺️ 로드맵 (다음 단계)

- **Nx CLI / 프로젝트 생성 표준화**
  - `nx serve/build` 기반으로 Host/Remote 실행 전환
  - `apps/remotes/chat`, `apps/remotes/approval` 생성 및 포트(4202/4203) 적용
- **MFE(Module Federation) 적용**
  - Host에서 Remote를 런타임 로드하도록 Webpack Module Federation 설정 추가
  - Host ↔ Remote 직접 import 금지, 공유 코드는 `libs/*`로만 유지
- **API 통신 표준화 (Critical)**
  - `libs/shared-utils/src/axios-instance.ts`를 **axios 기반**으로 교체
  - 서버 데이터는 **TanStack Query(React Query)** 로 통일
  - 템플릿의 Mock API 호출부 제거 및 실제 백엔드 연동

## 💻 개발 규칙

- **코드 스타일/규칙**: `.cursorrules` 준수
  - Functional Component + `export const`
  - `any` 금지
  - Icon은 **반드시 `@iconify/react`(템플릿 표준) 우선 사용**
    - `lucide-react` 등 다른 아이콘 라이브러리 혼용 금지(디자인 일관성 깨짐)
- **공통화 원칙**
  - 앱 간 공유는 반드시 `libs/*`로 올리고, Host/Remote 간 직접 의존성은 만들지 않기

## 🔤 폰트 로딩 (최적화/일관성)

폰트는 템플릿 표준(DM Sans + Barlow)을 사용하며, **각 앱의 `main.tsx`에서 공통 CSS를 import**하여
Host/Remote 모두 동일하게 로딩됩니다.

- 공통 CSS: `libs/design-system/src/styles/global.css`
- Host: `apps/dwp/src/main.tsx`
- Remote(mail): `apps/remotes/mail/src/main.tsx`
