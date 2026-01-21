# [DWP Frontend] Auth 운영급 점검 - 현황 분석 결과

## 1) 현황 분석 결과

### [Auth] 토큰 저장 위치 및 키 이름
- **위치**: `localStorage`
- **키 이름**: `'dwp-access-token'`
- **파일**: `libs/shared-utils/src/auth/token-storage.ts`
- **상태**: ✅ 구현됨

### [Auth] 토큰 만료 판단 로직
- **존재 여부**: ❌ 없음
- **상태**: JWT 토큰의 만료 시간을 확인하는 로직이 없음
- **영향**: 클라이언트 측에서 토큰 만료를 사전에 감지할 수 없음

### [Auth] refresh 토큰/재발급 로직
- **존재 여부**: ❌ 없음
- **상태**: refresh 토큰 저장/관리 로직 없음
- **영향**: 401 발생 시 자동 재발급 불가

### [API] axiosInstance가 401/403을 어떻게 처리하는지
- **현재 상태**: ❌ 전역 처리 없음
- **파일**: `libs/shared-utils/src/axios-instance.ts`
- **동작**: `res.ok === false`일 때 `HttpError`를 throw만 함
- **문제점**: 
  - 401/403에 대한 특별한 처리 없음
  - redirect, logout 등 전역 정책 없음
  - 무한 루프 방지 로직 없음

### [Routing] AuthGuard(또는 ProtectedRoute) 존재 여부 및 적용 범위
- **존재 여부**: ❌ 없음
- **파일**: `apps/dwp/src/routes/sections.tsx`
- **현재 상태**: 
  - 모든 라우트가 보호되지 않음
  - `/sign-in`과 보호 라우트 구분 없음
  - 인증 없이 접근 가능한 상태

### [UX] 로그인 실패/만료 시 redirect 규칙(returnUrl) 존재 여부
- **존재 여부**: ❌ 없음
- **파일**: `apps/dwp/src/sections/auth/sign-in-view.tsx`
- **현재 상태**: 
  - 로그인 성공 후 항상 `/`로 이동 (line 37: `router.push('/')`)
  - returnUrl 파라미터 처리 없음
  - 오픈 리다이렉트 방지 로직 없음

### [Loop Risk] 401 처리 무한 루프 위험
- **위험도**: 🔴 높음
- **문제점**:
  - 401 발생 시 redirect 로직 없음
  - 다중 요청 동시 발생 시 중복 redirect 가능성
  - 이미 `/sign-in` 페이지인데도 401 발생 시 다시 redirect 가능
- **방지 장치**: ❌ 없음

### [Remote] Remote가 Host의 Auth 상태를 전제로 하는 방식
- **방식**: 토큰 공유 (localStorage 직접 접근)
- **파일**: `libs/shared-utils/src/auth/token-storage.ts`
- **상태**: 
  - Remote 앱은 `@dwp-frontend/shared-utils`의 `getAccessToken()` 사용
  - localStorage에서 직접 토큰 읽기
  - Host와 동일한 키(`'dwp-access-token'`) 사용
- **영향**: Host에서 logout하면 Remote도 자동으로 토큰 접근 불가 (이벤트 기반 동기화 있음)

---

## 2) 체크리스트 (반영 여부)

| 항목 | 상태 | 근거 파일 경로 |
|------|------|----------------|
| 토큰 저장소 구현 | ✅ OK | `libs/shared-utils/src/auth/token-storage.ts` |
| User ID 저장소 구현 | ✅ OK | `libs/shared-utils/src/auth/user-id-storage.ts` |
| AuthProvider 구현 | ✅ OK | `libs/shared-utils/src/auth/auth-provider.tsx` |
| 토큰 만료 판단 로직 | ❌ NO | 없음 |
| Refresh 토큰 로직 | ❌ NO | 없음 |
| 401 전역 처리 | ❌ NO | `libs/shared-utils/src/axios-instance.ts` (line 55-56, 91-92) |
| 403 전역 처리 | ❌ NO | `libs/shared-utils/src/axios-instance.ts` (line 55-56, 91-92) |
| AuthGuard 컴포넌트 | ❌ NO | 없음 |
| ProtectedRoute 적용 | ❌ NO | `apps/dwp/src/routes/sections.tsx` |
| returnUrl 처리 | ❌ NO | `apps/dwp/src/sections/auth/sign-in-view.tsx` (line 37) |
| 오픈 리다이렉트 방지 | ❌ NO | 없음 |
| 무한 루프 방지 | ❌ NO | 없음 |
| /403 페이지 | ❌ NO | `apps/dwp/src/routes/sections.tsx` (404만 있음) |

---

## 3) 구현 필요 항목

### P0 (필수)
1. ✅ 401/403 전역 처리 정책 확정 및 구현
2. ✅ AuthGuard 컴포넌트 생성 및 라우트 적용
3. ✅ returnUrl 처리 및 오픈 리다이렉트 방지
4. ✅ 무한 루프 방지 장치
5. ✅ /403 페이지 추가

### P1 (권장)
1. 토큰 만료 판단 로직 (JWT payload의 `exp` 확인)
2. Refresh 토큰 로직 (백엔드 API 준비 시)

---

## 4) 참고 사항

- `axiosInstance`는 실제로는 `fetch` 기반 wrapper입니다 (axios 미설치 환경 대응)
- `HttpError` 클래스는 `status` 필드를 가지고 있어 401/403 구분 가능
- `AuthProvider`는 이미 `logout()` 함수를 제공함
- Remote 앱은 Host와 동일한 localStorage를 사용하므로 토큰 공유 가능
