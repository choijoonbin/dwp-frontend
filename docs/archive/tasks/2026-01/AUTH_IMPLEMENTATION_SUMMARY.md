# [DWP Frontend] Auth 운영급 점검 - 구현 완료 요약

## 변경/추가된 파일 목록

### 신규 파일
1. `libs/shared-utils/src/auth/auth-redirect.ts` - returnUrl 처리 및 redirect 유틸리티
2. `libs/shared-utils/src/auth/auth-guard.tsx` - AuthGuard 컴포넌트
3. `apps/dwp/src/components/auth-unauthorized-handler.tsx` - 전역 401/403 핸들러 설정
4. `apps/dwp/src/pages/page-403.tsx` - 403 Forbidden 페이지
5. `libs/shared-utils/src/auth/token-storage.test.ts` - token-storage 단위 테스트
6. `libs/shared-utils/src/auth/auth-redirect.test.ts` - auth-redirect 단위 테스트
7. `libs/shared-utils/src/axios-instance.test.ts` - axios-instance 401/403 처리 테스트
8. `docs/AUTH_STATUS_ANALYSIS.md` - 현황 분석 문서
9. `docs/AUTH_IMPLEMENTATION_SUMMARY.md` - 본 문서

### 수정된 파일
1. `libs/shared-utils/src/index.ts` - auth-redirect, auth-guard export 추가
2. `libs/shared-utils/src/axios-instance.ts` - 401/403 전역 처리 로직 추가
3. `apps/dwp/src/routes/sections.tsx` - AuthGuard 적용, /403 라우트 추가
4. `apps/dwp/src/app.tsx` - AuthUnauthorizedHandler 컴포넌트 추가
5. `apps/dwp/src/sections/auth/sign-in-view.tsx` - returnUrl 처리 추가

---

## 핵심 로직 설명

### 1. 401/403 전역 처리 (`axios-instance.ts`)
- `axiosInstance.get/post`에서 `res.ok === false`일 때 status 확인
- 401 또는 403이면 `handleAuthError(status)` 호출
- 무한 루프 방지: `isHandlingUnauthorized` 플래그로 중복 호출 방지
- 이미 `/sign-in` 또는 `/403` 페이지면 handler 호출 안 함

### 2. AuthGuard (`auth-guard.tsx`)
- `getAccessToken()`으로 토큰 존재 여부 확인
- 토큰 없으면 `redirectToSignIn()` 호출하여 `/sign-in?returnUrl=...`로 이동
- 토큰 있으면 children 렌더링

### 3. returnUrl 처리 (`auth-redirect.ts`)
- `safeReturnUrl()`: 외부 URL, `../`, `/sign-in`, `/403`, `/404` 등 차단
- `buildReturnUrl()`: 현재 location에서 안전한 returnUrl 생성
- `redirectToSignIn()`: `/sign-in?returnUrl=...` 형태로 redirect

### 4. 무한 루프 방지
- `isHandlingUnauthorized` 플래그로 동시 다중 요청 시 1회만 handler 호출
- 이미 `/sign-in` 또는 `/403` 페이지면 handler 호출 안 함
- handler 호출 후 100ms 후 플래그 리셋

---

## 체크리스트 (반영 여부)

| 항목 | 상태 | 근거 파일 경로 |
|------|------|----------------|
| 401 전역 처리 | ✅ OK | `libs/shared-utils/src/axios-instance.ts` (line 55-60, 91-96) |
| 403 전역 처리 | ✅ OK | `libs/shared-utils/src/axios-instance.ts` (line 55-60, 91-96) |
| AuthGuard 컴포넌트 | ✅ OK | `libs/shared-utils/src/auth/auth-guard.tsx` |
| ProtectedRoute 적용 | ✅ OK | `apps/dwp/src/routes/sections.tsx` (line 45-50) |
| returnUrl 처리 | ✅ OK | `apps/dwp/src/sections/auth/sign-in-view.tsx` (line 36-37) |
| 오픈 리다이렉트 방지 | ✅ OK | `libs/shared-utils/src/auth/auth-redirect.ts` (safeReturnUrl) |
| 무한 루프 방지 | ✅ OK | `libs/shared-utils/src/axios-instance.ts` (isHandlingUnauthorized) |
| /403 페이지 | ✅ OK | `apps/dwp/src/pages/page-403.tsx`, `apps/dwp/src/routes/sections.tsx` (line 68-71) |
| 단위 테스트 (token-storage) | ✅ OK | `libs/shared-utils/src/auth/token-storage.test.ts` |
| 단위 테스트 (auth-redirect) | ✅ OK | `libs/shared-utils/src/auth/auth-redirect.test.ts` |
| 단위 테스트 (401-handler) | ✅ OK | `libs/shared-utils/src/axios-instance.test.ts` |

---

## 실행 방법

### Unit Test 실행
```bash
# Vitest로 테스트 실행
npx vitest run libs/shared-utils/src/auth/token-storage.test.ts
npx vitest run libs/shared-utils/src/auth/auth-redirect.test.ts
npx vitest run libs/shared-utils/src/axios-instance.test.ts

# 또는 모든 테스트 실행
npx vitest run
```

### Dev 실행 시나리오

#### 1. 토큰 없을 때 보호 라우트 접근
1. 브라우저에서 localStorage의 `dwp-access-token` 삭제
2. `/mail` 또는 `/chat` 등 보호 라우트 접근
3. **예상 동작**: `/sign-in?returnUrl=/mail`로 자동 redirect
4. 로그인 성공 후 `/mail`로 복귀

#### 2. 401 강제 발생
1. 개발자 도구 > Network 탭 열기
2. API 요청을 401로 모킹하거나, 실제 401 응답 발생
3. **예상 동작**: 
   - `AuthUnauthorizedHandler`가 감지
   - `auth.logout()` 호출 (토큰 삭제)
   - `/sign-in?returnUrl=...`로 redirect

#### 3. 403 강제 발생
1. API 요청을 403으로 모킹하거나, 실제 403 응답 발생
2. **예상 동작**:
   - `AuthUnauthorizedHandler`가 감지
   - 로그아웃 없이 `/403` 페이지로 redirect

#### 4. returnUrl 검증
1. 브라우저 주소창에 `/sign-in?returnUrl=http://evil.com` 입력
2. **예상 동작**: `safeReturnUrl()`이 `null` 반환, 로그인 후 `/`로 이동
3. `/sign-in?returnUrl=/mail` 입력
4. **예상 동작**: 로그인 후 `/mail`로 이동

#### 5. 무한 루프 방지 테스트
1. `/sign-in` 페이지에서 API 요청이 401 발생
2. **예상 동작**: handler가 호출되지 않음 (이미 `/sign-in` 페이지)

---

## 주의사항

1. **Refresh 토큰**: 현재 구현에는 refresh 토큰 로직이 없습니다. 백엔드 API 준비 시 추가 필요.
2. **토큰 만료 판단**: JWT의 `exp` 필드를 확인하는 로직이 없습니다. 필요 시 추가 가능.
3. **Remote 앱**: Remote 앱은 Host와 동일한 localStorage를 사용하므로, Host에서 logout하면 Remote도 자동으로 토큰 접근 불가.
4. **테스트 환경**: Vitest 테스트는 `window.localStorage`와 `fetch`를 모킹합니다.

---

## 다음 단계 (P1 권장)

1. JWT 토큰 만료 시간(`exp`) 확인 로직 추가
2. Refresh 토큰 로직 추가 (백엔드 API 준비 시)
3. E2E 테스트 추가 (Playwright 등)
4. 401 발생 시 자동 refresh 시도 (1회) 후 원 요청 재시도
