# OIDC Callback 구현 현황 및 테스트 시나리오

BE 계약: IdP `redirect_uri` = `{FE_ORIGIN}/auth/oidc/callback`  
FE는 해당 라우트에서 `code`/`state`를 읽어 BE `GET /api/auth/oidc/callback` 호출 후 JWT 저장 및 리다이렉트를 수행한다.

---

## 1. 현재 구현 유무 / 수정 필요 여부

| 항목 | 상태 | 비고 |
|------|------|------|
| FE 라우트 `/auth/oidc/callback` | ✅ 구현 완료 | `apps/dwp/src/routes/sections.tsx` (path: `auth/oidc/callback`) |
| URL query에서 code/state/providerKey 읽기 | ✅ 구현 완료 | `apps/dwp/src/pages/auth/oidc-callback.tsx` |
| BE 호출 GET /api/auth/oidc/callback | ✅ 구현 완료 | `libs/shared-utils/src/api/auth-api.ts` `getOidcCallback()` |
| tenantId (헤더 또는 쿼리) | ✅ 구현 완료 | 쿼리 `tenantId` 전달, axiosInstance는 기존 `X-Tenant-ID` 주입 |
| 성공 시 JWT 저장 후 이동 | ✅ 구현 완료 | `AuthProvider.loginWithToken()` → `returnUrl` 또는 `/` |
| 실패 시 에러 처리(토스트/로그인 이동) | ✅ 구현 완료 | 에러 메시지 표시 후 3초 뒤 `/sign-in` 이동 |
| Sign-in SSO redirect_uri | ✅ 통일 완료 | `/sso-callback` → `/auth/oidc/callback`로 변경 |

**기존 `/sso-callback`**: 라우트는 유지(레거시/북마크 대응). 신규 SSO는 `/auth/oidc/callback`만 사용.

---

## 2. 변경 파일 계획 (PR)

| 파일 | 변경 내용 |
|------|------------|
| `libs/shared-utils/src/api/auth-api.ts` | `getOidcCallback`, `OidcCallbackParams`, `extractAccessTokenFromLoginResponse` 추가 |
| `libs/shared-utils/src/auth/auth-provider.tsx` | `loginWithToken(accessToken)` 추가, `login` 내부에서 토큰 처리 공통화 |
| `apps/dwp/src/pages/auth/oidc-callback.tsx` | **신규** – OIDC 콜백 페이지 (code/state 읽기, BE 호출, JWT 저장, 리다이렉트) |
| `apps/dwp/src/routes/sections.tsx` | `auth/oidc/callback` 라우트 및 `OidcCallbackPage` lazy 추가 |
| `apps/dwp/src/sections/auth/sign-in-view.tsx` | SSO 로그인 시 `callbackUrl`을 `/auth/oidc/callback`으로 변경 |

---

## 3. SSO 성공/실패 테스트 시나리오 (5개)

1. **성공 – code/state 정상, JWT 저장 후 returnUrl 이동**
   - 조건: IdP에서 `{origin}/auth/oidc/callback?returnUrl=/mail&code=abc&state=xyz` 로 리다이렉트, BE가 200 + `accessToken` 반환
   - 기대: 토큰 저장, 권한/메뉴 로드 후 `/mail`로 이동

2. **성공 – returnUrl 없음, 기본 경로(/) 이동**
   - 조건: `.../auth/oidc/callback?code=abc&state=xyz` (returnUrl 없음), BE 200 + 토큰
   - 기대: 토큰 저장 후 `/`(대시보드)로 이동

3. **실패 – IdP가 error 쿼리로 리다이렉트**
   - 조건: `.../auth/oidc/callback?error=access_denied&error_description=User%20denied`
   - 기대: "OIDC 인증 실패" 등 에러 메시지 표시, 3초 후 `/sign-in` 이동

4. **실패 – code 또는 state 누락**
   - 조건: `.../auth/oidc/callback?code=abc` (state 없음) 또는 `?state=xyz` (code 없음)
   - 기대: "code 또는 state가 없습니다." 표시, 3초 후 `/sign-in` 이동

5. **실패 – BE OIDC 콜백 API 오류(4xx/5xx 또는 네트워크 오류)**
   - 조건: BE가 401/500 등 반환 또는 타임아웃
   - 기대: 에러 메시지 표시, 3초 후 `/sign-in` 이동

---

## 4. BE 확인 사항

- `GET /api/auth/oidc/callback?code=...&state=...&providerKey=...&tenantId=...` 응답 형식: `ApiResponse<{ accessToken: string }>` 또는 `{ token: string }` 등 계약 확인
- `X-Tenant-ID` 헤더와 쿼리 `tenantId` 동시 전달 시 BE 우선순위 정책
- IdP 앱 등록 시 `redirect_uri`를 `{FE_ORIGIN}/auth/oidc/callback`으로 등록했는지 확인
