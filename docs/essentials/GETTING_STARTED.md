# DWP Frontend 시작 가이드

**최종 업데이트**: 2026-01-22

이 문서는 신규 개발자가 15분 안에 프로젝트를 이해하고 개발을 시작할 수 있도록 안내합니다.

---

## 📋 목차

1. [5분 안에 이해하기](#5분-안에-이해하기)
2. [로컬 환경 설정](#로컬-환경-설정)
3. [프로젝트 구조](#프로젝트-구조)
4. [첫 페이지 만들기](#첫-페이지-만들기)
5. [다음 단계](#다음-단계)

---

## 5분 안에 이해하기

### 프로젝트 개요
**DWP Frontend**는 React + TypeScript 기반의 **Micro Frontend 아키텍처**를 사용하는 엔터프라이즈 플랫폼입니다.

### 핵심 기술 스택
- **React 19** (최신 Stable)
- **TypeScript** (Strict Mode)
- **Nx Monorepo** (워크스페이스 관리)
- **Vite** (빌드 도구)
- **MUI v5** (UI 라이브러리)
- **TanStack Query** (서버 상태 관리)
- **Zustand** (클라이언트 상태 관리)

### 아키텍처 구조
```
┌─────────────────────────────────────┐
│       Host App (apps/dwp)          │  ← Shell, Auth, Layout, Routing
├─────────────────────────────────────┤
│  Remote: Admin (apps/remotes/admin)│  ← 관리자 기능
│  Remote: Mail (apps/remotes/mail)  │  ← 메일 기능
│  Remote: ...                        │  ← 향후 확장
├─────────────────────────────────────┤
│  libs/design-system                 │  ← 공통 UI 컴포넌트
│  libs/shared-utils                  │  ← 공통 로직/유틸
└─────────────────────────────────────┘
```

---

## 로컬 환경 설정

### 1. 사전 요구사항
```bash
# Node.js 20.x LTS
node -v  # v20.x.x

# Yarn 1.22.x
yarn -v  # 1.22.x
```

### 2. 프로젝트 클론 및 의존성 설치
```bash
# 클론
git clone <repository-url>
cd dwp-frontend

# 의존성 설치
yarn install
```

### 3. 환경 변수 설정
```bash
# 루트에 .env 파일 생성 (예시는 .env.example 참고)
cp .env.example .env
```

### 4. 개발 서버 실행
```bash
# 전체 실행 (Host + Admin + Mail)
yarn dev:all

# 또는 개별 실행
yarn dev           # Host만
yarn dev:admin     # Admin Remote만
yarn dev:mail      # Mail Remote만
```

### 5. 브라우저에서 확인
```
Host:  http://localhost:4200
Admin: http://localhost:4204
Mail:  http://localhost:4201
```

---

## 프로젝트 구조

### 최상위 폴더
```
dwp-frontend/
├── apps/
│   ├── dwp/                 # Host 앱 (Shell, Auth, Layout, Routing)
│   └── remotes/
│       ├── admin/           # Admin Remote (관리자 기능)
│       └── mail/            # Mail Remote (메일 기능)
├── libs/
│   ├── design-system/       # 공통 UI 컴포넌트
│   └── shared-utils/        # 공통 로직/유틸
├── docs/                    # 문서
└── package.json
```

### Host 앱 구조 (`apps/dwp/src/`)
```
src/
├── main.tsx                 # 앱 진입점
├── routes/                  # 라우터 설정
│   └── sections.tsx         # 라우트 정의
├── layouts/                 # 레이아웃 컴포넌트
│   ├── dashboard/           # 대시보드 레이아웃
│   ├── auth/                # 인증 레이아웃
│   └── core/                # 코어 레이아웃 (LayoutSection, MainSection)
├── pages/                   # 페이지 컴포넌트
│   ├── dashboard.tsx
│   ├── admin.tsx            # Admin Remote 마운트
│   └── ai-workspace.tsx
├── components/              # 공통 컴포넌트
├── store/                   # 전역 상태 (Zustand)
└── theme/                   # MUI 테마 설정
```

### Remote 앱 구조 (`apps/remotes/admin/src/`)
```
src/
├── admin-app.tsx            # Remote 진입점
├── pages/                   # 페이지 컴포넌트
│   ├── menus/              # 메뉴 관리
│   ├── roles/              # 권한 관리
│   ├── users/              # 사용자 관리
│   └── monitoring/         # 통합 모니터링
└── remote-entry.ts          # Module Federation 설정
```

---

## 첫 페이지 만들기 (30분 실습)

### 시나리오: "부서 관리" 페이지 추가

#### 1. 파일 생성 (Admin Remote)
```bash
cd apps/remotes/admin/src/pages
mkdir departments
cd departments
```

#### 2. 기본 구조 복사
```bash
# 메뉴 관리 페이지를 참고로 복사
cp -r ../menus/* .
```

#### 3. 파일명 변경
```
departments/
├── page.tsx                         # 메인 페이지
├── types.ts                         # 타입 정의
├── hooks/
│   ├── use-department-table-state.ts
│   └── use-department-actions.ts
└── components/
    ├── department-list-panel.tsx
    └── department-detail-panel.tsx
```

#### 4. 라우터 등록 (`admin-app.tsx`)
```typescript
import { DepartmentsPage } from './pages/departments/page';

export const AdminApp = ({ standalone = false }: { standalone?: boolean }) => {
  const routes = (
    <Routes>
      <Route path="departments" element={<DepartmentsPage />} />
      {/* ... 기존 라우트 ... */}
    </Routes>
  );
  // ...
};
```

#### 5. 메뉴 추가 (백엔드 작업 필요)
```
백엔드 Menu API에 "부서 관리" 메뉴 추가
→ 프론트는 자동으로 사이드바에 표시됨
```

#### 6. 개발 서버 확인
```bash
yarn dev:all
# http://localhost:4200/admin/departments
```

---

## 다음 단계

### 1주차 필독 문서 (순서대로 읽기)

1. ✅ **[프로젝트 시작 가이드](GETTING_STARTED.md)** ← 지금 읽는 문서
2. **[핵심 규칙](PROJECT_RULES.md)** (20분)
3. **[Admin CRUD 개발 표준](ADMIN_CRUD_STANDARD.md)** (30분)
4. **[레이아웃 가이드](LAYOUT_GUIDE.md)** (15분)
5. **[디자인 시스템](DESIGN_SYSTEM.md)** (30분)

### 추가 학습 자료

- **백엔드 API 명세**: `docs/reference/api/backend-api-spec.md`
- **Aura AI 기능**: `docs/specs/aura.md`
- **과거 작업 히스토리**: `docs/archive/tasks/2026-01/README.md`

---

## 자주 묻는 질문 (FAQ)

### Q1. "어떤 UI 라이브러리를 써야 하나요?"
**A**: MUI v5만 사용합니다. shadcn/ui, Radix UI, Ant Design 등은 사용 금지입니다.

### Q2. "공통 컴포넌트는 어디에 만들어야 하나요?"
**A**: `libs/design-system/src/components/`에 배치합니다. Remote 내부에 `components/ui` 폴더 생성은 금지입니다.

### Q3. "스타일은 어떻게 작성하나요?"
**A**: MUI의 `sx` prop과 `styled` 컴포넌트를 사용합니다. Tailwind는 레이아웃 보조용으로만 제한적 허용됩니다.

### Q4. "API 호출은 어떻게 하나요?"
**A**: TanStack Query를 사용합니다. 계층 구조는 `shared-utils/api` → `shared-utils/queries` → `hooks` → `pages/components` 순서입니다.

### Q5. "레이아웃 스크롤이 안 되는데요?"
**A**: `docs/essentials/LAYOUT_GUIDE.md`를 참고하세요. Fixed/Scrollable 모드를 이해해야 합니다.

---

## 도움이 필요하신가요?

- **문서 문의**: 개발 리드에게 문의
- **코드 리뷰**: PR에 팀원 태그
- **버그 리포트**: GitHub Issues에 등록

**Happy Coding! 🚀**
