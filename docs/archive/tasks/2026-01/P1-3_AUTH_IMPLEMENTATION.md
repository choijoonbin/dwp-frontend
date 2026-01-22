# FE P1-3: Auth 운영급 구현 (401/403 처리, AuthGuard, returnUrl)

**작성일**: 2026-01-20  
**상태**: ✅ 완료  
**목적**: 인증/인가 운영급 처리 및 보안 강화

---

## 개요

401/403 전역 처리, AuthGuard 컴포넌트, returnUrl 처리 및 오픈 리다이렉트 방지를 구현했습니다.

---

## 구현 내용

### 1. 401/403 전역 처리

**파일**: `libs/shared-utils/src/axios-instance.ts`

#### 구현 내용:
- `axiosInstance.get/post/put/delete`에서 응답 상태 확인
- `res.ok === false`일 때 status 확인
- 401 또는 403이면 `handleAuthError(status)` 호출
- 무한 루프 방지:
  - `isHandlingUnauthorized` 플래그로 중복 호출 방지
  - 이미 `/sign-in` 또는 `/403` 페이지면 handler 호출 안 함
  - handler 호출 후 100ms 후 플래그 리셋

**파일**: `apps/dwp/src/components/auth-unauthorized-handler.tsx`

#### 구현 내용:
- 전역 401/403 핸들러 컴포넌트
- `app.tsx`에 추가하여 모든 요청 감시
- 401 발생 시: `auth.logout()` → `/sign-in?returnUrl=...` redirect
- 403 발생 시: `/403` 페이지로 redirect (logout 없음)

### 2. AuthGuard 컴포넌트

**파일**: `libs/shared-utils/src/auth/auth-guard.tsx`

#### 구현 내용:
- `getAccessToken()`으로 토큰 존재 여부 확인
- 토큰 없으면 `redirectToSignIn()` 호출하여 `/sign-in?returnUrl=...`로 이동
- 토큰 있으면 children 렌더링
- `redirectTo` prop으로 커스텀 redirect 경로 지정 가능

**파일**: `apps/dwp/src/routes/sections.tsx`

#### 적용:
- 모든 보호 라우트에 `AuthGuard` 적용
- `/sign-in`, `/403`, `/404`는 AuthGuard 제외

### 3. returnUrl 처리 및 오픈 리다이렉트 방지

**파일**: `libs/shared-utils/src/auth/auth-redirect.ts`

#### 구현 내용:
- `safeReturnUrl(url)`: 외부 URL, `../`, `/sign-in`, `/403`, `/404` 등 차단
  - `http://`, `https://`, `//`로 시작하는 값 무시
  - 상대 경로 (`../`) 차단
  - 특정 경로 (`/sign-in`, `/403`, `/404`) 차단
  - same-origin 내부 경로만 허용

- `buildReturnUrl()`: 현재 location에서 안전한 returnUrl 생성
  - `window.location.pathname + window.location.search` 사용
  - `safeReturnUrl()`로 검증

- `redirectToSignIn(returnUrl?)`: `/sign-in?returnUrl=...` 형태로 redirect
  - `returnUrl`이 없으면 현재 경로 사용
  - `safeReturnUrl()`로 검증 후 redirect

**파일**: `apps/dwp/src/sections/auth/sign-in-view.tsx`

#### 적용:
- 로그인 성공 후 `returnUrl` 파라미터 확인
- `safeReturnUrl()`로 검증 후 redirect
- 검증 실패 시 `/`로 redirect

### 4. 403 Forbidden 페이지

**파일**: `apps/dwp/src/pages/page-403.tsx`

#### 구현 내용:
- 403 Forbidden 페이지 컴포넌트
- "접근 권한이 없습니다" 메시지 표시
- 홈으로 돌아가기 버튼 제공

**파일**: `apps/dwp/src/routes/sections.tsx`

#### 적용:
- `/403` 라우트 추가

### 5. 무한 루프 방지

#### 구현 내용:
- `isHandlingUnauthorized` 플래그로 동시 다중 요청 시 1회만 handler 호출
- 이미 `/sign-in` 또는 `/403` 페이지면 handler 호출 안 함
- handler 호출 후 100ms 후 플래그 리셋

---

## 주요 해결 사항

### 1. 무한 리다이렉트 루프 방지
- `isHandlingUnauthorized` 플래그 사용
- 현재 경로 확인 (`window.location.pathname`)
- handler 호출 후 플래그 리셋

### 2. 오픈 리다이렉트 방지
- `safeReturnUrl()` 함수로 외부 URL 차단
- `http://`, `https://`, `//`로 시작하는 값 무시
- 상대 경로 (`../`) 차단

### 3. 401 vs 403 처리 구분
- 401: logout 후 `/sign-in` redirect
- 403: logout 없이 `/403` redirect

---

## 변경된 파일 목록

### 신규 파일
- `libs/shared-utils/src/auth/auth-redirect.ts`
- `libs/shared-utils/src/auth/auth-guard.tsx`
- `apps/dwp/src/components/auth-unauthorized-handler.tsx`
- `apps/dwp/src/pages/page-403.tsx`
- `libs/shared-utils/src/auth/token-storage.test.ts`
- `libs/shared-utils/src/auth/auth-redirect.test.ts`
- `libs/shared-utils/src/axios-instance.test.ts`

### 수정된 파일
- `libs/shared-utils/src/index.ts`: auth-redirect, auth-guard export 추가
- `libs/shared-utils/src/axios-instance.ts`: 401/403 전역 처리 로직 추가
- `apps/dwp/src/routes/sections.tsx`: AuthGuard 적용, /403 라우트 추가
- `apps/dwp/src/app.tsx`: AuthUnauthorizedHandler 컴포넌트 추가
- `apps/dwp/src/sections/auth/sign-in-view.tsx`: returnUrl 처리 추가

---

## 테스트 시나리오

### 1. 토큰 없을 때 보호 라우트 접근
1. 브라우저에서 localStorage의 `dwp-access-token` 삭제
2. `/mail` 또는 `/chat` 등 보호 라우트 접근
3. **예상 동작**: `/sign-in?returnUrl=/mail`로 자동 redirect
4. 로그인 성공 후 `/mail`로 복귀

### 2. 401 강제 발생
1. 개발자 도구 > Network 탭 열기
2. API 요청을 401로 모킹하거나, 실제 401 응답 발생
3. **예상 동작**: 
   - `AuthUnauthorizedHandler`가 감지
   - `auth.logout()` 호출 (토큰 삭제)
   - `/sign-in?returnUrl=...`로 redirect

### 3. 403 강제 발생
1. API 요청을 403으로 모킹하거나, 실제 403 응답 발생
2. **예상 동작**:
   - `AuthUnauthorizedHandler`가 감지
   - 로그아웃 없이 `/403` 페이지로 redirect

### 4. returnUrl 검증
1. 브라우저 주소창에 `/sign-in?returnUrl=http://evil.com` 입력
2. **예상 동작**: `safeReturnUrl()`이 `null` 반환, 로그인 후 `/`로 이동
3. `/sign-in?returnUrl=/mail` 입력
4. **예상 동작**: 로그인 후 `/mail`로 이동

### 5. 무한 루프 방지 테스트
1. `/sign-in` 페이지에서 API 요청이 401 발생
2. **예상 동작**: handler가 호출되지 않음 (이미 `/sign-in` 페이지)

---

## 주의사항

1. **Refresh 토큰**: 현재 구현에는 refresh 토큰 로직이 없습니다. 백엔드 API 준비 시 추가 필요.
2. **토큰 만료 판단**: JWT의 `exp` 필드를 확인하는 로직이 없습니다. 필요 시 추가 가능.
3. **Remote 앱**: Remote 앱은 Host와 동일한 localStorage를 사용하므로, Host에서 logout하면 Remote도 자동으로 토큰 접근 불가.

---

## 다음 단계 (P1-4)

- CodeUsage 관리 UI 구현
- 코드 그룹별 매핑 관리
- Admin CRUD UI 기본 구조
