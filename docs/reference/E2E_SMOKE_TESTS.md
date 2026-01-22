# E2E 스모크 테스트 가이드

> **최종 업데이트**: 2026-01-22  
> **목적**: Playwright 기반 E2E 스모크 테스트 실행 방법 및 확장 가이드

---

## 목차

1. [E2E 테스트란?](#e2e-테스트란)
2. [로컬 실행 방법](#로컬-실행-방법)
3. [CI/CD 통합](#cicd-통합)
4. [테스트 구조](#테스트-구조)
5. [확장 가이드](#확장-가이드)
6. [트러블슈팅](#트러블슈팅)

---

## E2E 테스트란?

### 목적

- **회귀 방지**: UI 변경 시 기존 기능이 깨지지 않았는지 자동 검증
- **빠른 피드백**: PR 단계에서 UI 회귀 조기 감지
- **수동 테스트 부담 감소**: 반복적인 UI 테스트 자동화

---

### 스코프 (현재)

**Phase 1**: Admin 핵심 4개 페이지 최소 스모크 테스트

| 페이지 | 라우트 | 테스트 내용 |
|--------|--------|-------------|
| Monitoring | `/admin/monitoring` | 페이지 로드, 요소 존재, 반응형 |
| Users | `/admin/users` | 페이지 로드, 요소 존재, 반응형 |
| Roles | `/admin/roles` | 페이지 로드, 요소 존재, 반응형 |
| Resources | `/admin/resources` | 페이지 로드, 요소 존재, 반응형 |

**Phase 2** (향후):
- Audit, Codes, Menus 페이지 추가
- CRUD 액션 테스트 (생성/편집/삭제)
- Form validation 테스트

---

## 로컬 실행 방법

### 1️⃣ 사전 준비

```bash
# Playwright 설치 확인 (이미 설치됨)
yarn playwright --version

# 브라우저 설치 확인 (이미 설치됨)
npx playwright install chromium
```

---

### 2️⃣ 로컬 실행 (권장)

#### 방법 A: 자동 dev server 시작 (권장)

```bash
# E2E 테스트 실행 (자동으로 dev server 시작)
yarn playwright test

# UI 모드로 실행 (디버깅에 유용)
yarn playwright test --ui

# 특정 테스트만 실행
yarn playwright test e2e/admin/admin-smoke.spec.ts
```

**동작**:
1. Playwright가 자동으로 `yarn dev` 실행
2. `http://localhost:3000` 대기
3. 테스트 실행
4. 종료 시 dev server 자동 종료

---

#### 방법 B: 수동 dev server 시작

```bash
# Terminal 1: Dev server 시작
yarn dev

# Terminal 2: E2E 테스트 실행
yarn playwright test --headed
```

**장점**: Dev server가 이미 실행 중이면 더 빠름

---

### 3️⃣ Headed 모드 (브라우저 UI 보기)

```bash
# 브라우저 UI를 보면서 실행
yarn playwright test --headed

# 특정 브라우저만 실행
yarn playwright test --project=chromium
yarn playwright test --project=mobile
```

---

### 4️⃣ 결과 확인

```bash
# HTML 리포트 생성 및 열기
yarn playwright show-report

# 실패한 테스트 스크린샷 확인
ls playwright-report/
```

---

## CI/CD 통합

### GitHub Actions (예정)

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'yarn'
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Install Playwright browsers
        run: npx playwright install chromium
      
      - name: Run E2E tests
        run: yarn playwright test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 테스트 구조

### 폴더 구조

```
e2e/
├── admin/
│   └── admin-smoke.spec.ts    # Admin 4개 페이지 스모크 테스트
├── utils/
│   ├── auth.ts                # 인증 유틸 (storageState 기반)
│   ├── routes.ts              # 라우트 상수
│   └── viewports.ts           # Viewport 상수
└── .auth/                     # storageState.json (gitignore)
    └── user.json
```

---

### 테스트 파일 구조

```typescript
// e2e/admin/admin-smoke.spec.ts

import { test, expect } from '@playwright/test';
import { ADMIN_ROUTES } from '../utils/routes';
import { ensureAuth } from '../utils/auth';
import { MOBILE_VIEWPORT, DESKTOP_VIEWPORT } from '../utils/viewports';

test.describe('Admin Smoke Tests - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await ensureAuth(page);
  });

  test('Monitoring page loads', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.monitoring);
    await expect(page.getByTestId('page-admin-monitoring')).toBeVisible();
  });
});
```

---

### 인증 처리 (TODO)

현재는 인증을 스킵하고 있습니다. 실제 인증 구현은 다음 중 하나를 선택:

#### Option 1: storageState 기반 (권장)

```typescript
// e2e/utils/auth.ts
export async function ensureAuth(page: Page): Promise<void> {
  // 1. 한번 로그인
  await page.goto('/sign-in');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
  
  // 2. storageState 저장
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
}

// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json', // 재사용
      },
    },
  ],
});
```

---

#### Option 2: 토큰 직접 주입

```typescript
export async function injectAuthToken(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((token) => {
    localStorage.setItem('accessToken', token);
  }, process.env.TEST_AUTH_TOKEN);
  await page.reload();
}
```

---

#### Option 3: API 로그인

```typescript
export async function loginViaAPI(page: Page): Promise<void> {
  const response = await page.request.post('/api/auth/login', {
    data: {
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD,
    },
  });
  const { accessToken } = await response.json();
  
  await page.goto('/');
  await page.evaluate((token) => {
    localStorage.setItem('accessToken', token);
  }, accessToken);
}
```

---

## 확장 가이드

### 1️⃣ 새로운 페이지 추가

```typescript
// 1. 페이지에 testid 추가
// apps/remotes/admin/src/pages/audit/page.tsx
<Box data-testid="page-admin-audit" sx={{ p: 3 }}>

// 2. 라우트 상수 추가
// e2e/utils/routes.ts
export const ADMIN_ROUTES = {
  ...existing,
  audit: '/admin/audit',
};

// 3. 테스트 추가
// e2e/admin/admin-smoke.spec.ts
test('Audit page loads', async ({ page }) => {
  await page.goto(ADMIN_ROUTES.audit);
  await expect(page.getByTestId('page-admin-audit')).toBeVisible();
});
```

---

### 2️⃣ CRUD 액션 테스트 추가

```typescript
// e2e/admin/users-crud.spec.ts
test.describe('Users CRUD', () => {
  test('Create user', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.users);
    
    // Click create button
    await page.getByTestId('create-user-btn').click();
    
    // Fill form
    await page.getByTestId('username-input').fill('Test User');
    await page.getByTestId('email-input').fill('test@example.com');
    
    // Submit
    await page.getByTestId('submit-btn').click();
    
    // Verify success
    await expect(page.getByText('사용자가 생성되었습니다')).toBeVisible();
  });
});
```

---

### 3️⃣ 모바일 전용 테스트

```typescript
test.describe('Mobile-specific tests', () => {
  test.use({ ...devices['iPhone 13'] });

  test('Mobile sidebar opens', async ({ page }) => {
    await page.goto('/admin/users');
    
    // Click menu button (mobile only)
    await page.getByRole('button', { name: 'menu' }).click();
    
    // Verify sidebar is visible
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});
```

---

## 트러블슈팅

### ❌ 문제: "locator.isVisible() timed out"

**원인**: 요소가 나타나지 않음 (로딩 느림, testid 누락, 인증 실패)

**해결**:
```typescript
// 1. timeout 증가
await expect(page.getByTestId('page-admin-users')).toBeVisible({ timeout: 10000 });

// 2. 로딩 대기
await page.waitForLoadState('networkidle');

// 3. testid 확인
// 브라우저 개발자 도구에서 확인
```

---

### ❌ 문제: "dev server가 시작되지 않음"

**원인**: 포트 충돌, 환경 설정 오류

**해결**:
```bash
# 1. 포트 확인
lsof -i :3000

# 2. 수동으로 dev server 시작
yarn dev

# 3. Playwright에게 기존 서버 사용하도록 지시
yarn playwright test
```

---

### ❌ 문제: "테스트가 flaky (간헐적 실패)"

**원인**: 타이밍 이슈, 네트워크 지연

**해결**:
```typescript
// ✅ GOOD: 명시적 대기
await page.waitForLoadState('networkidle');
await expect(page.getByTestId('data-table')).toBeVisible();

// ❌ BAD: 고정 시간 대기
await page.waitForTimeout(1000); // flaky!
```

---

### ❌ 문제: "인증이 필요한 페이지 접근 실패"

**원인**: 인증 유틸이 아직 미구현

**임시 해결**:
```typescript
// e2e/utils/auth.ts에서 실제 인증 구현
// Option 1, 2, 3 중 선택
```

---

## 스크립트 추가 (package.json)

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:mobile": "playwright test --project=mobile",
    "test:e2e:report": "playwright show-report"
  }
}
```

---

## 다음 단계

1. ✅ **Phase 1 완료**: Admin 4개 페이지 스모크 테스트
2. 🔄 **인증 구현**: storageState 기반 로그인
3. 📋 **Phase 2 계획**:
   - Audit, Codes, Menus 페이지 추가
   - CRUD 액션 테스트 (users 생성/편집/삭제)
   - Form validation 테스트
4. 🚀 **CI/CD 통합**: GitHub Actions workflow 추가

---

## 참고 문서

- **[testid 표준](./E2E_TESTID_STANDARD.md)**: data-testid 네이밍 규칙
- **[Playwright 공식 문서](https://playwright.dev/)**: Best Practices
- **[Design System 마이그레이션](./DESIGN_SYSTEM_MIGRATION.md)**: Admin 페이지 개선 로드맵

---

**E2E 테스트로 안정적인 UI를 유지합시다! 🎯**
