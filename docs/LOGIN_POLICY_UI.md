# 로그인 정책 기반 UI 분기 구현 (FE P1-4)

## 1. 개요

테넌트별 로그인 정책(LOCAL/SSO)을 기반으로 로그인 화면의 UI와 흐름을 자동으로 분기하는 기능을 구현했습니다.

## 2. 구현 내용

### 2.1. API Layer

#### `libs/shared-utils/src/api/auth-policy-api.ts`
- `getAuthPolicy()`: 테넌트의 인증 정책 조회
  - `GET /api/auth/policy`
  - 응답: `AuthPolicyResponse`
- `getIdentityProvider()`: Identity Provider 설정 조회
  - `GET /api/auth/idp`
  - 응답: `IdentityProviderResponse`

### 2.2. 타입 정의

#### `libs/shared-utils/src/auth/auth-policy-types.ts`
```typescript
export type LoginType = 'LOCAL' | 'SSO';

export type AuthPolicyResponse = {
  tenantId: string;
  allowedLoginTypes: LoginType[];
  defaultLoginType: LoginType;
  requireMfa?: boolean;
  passwordPolicy?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumber?: boolean;
    requireSpecialChar?: boolean;
  };
};

export type IdentityProviderResponse = {
  tenantId: string;
  providerType: 'OIDC' | 'SAML' | 'LDAP';
  providerName: string;
  authUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};
```

### 2.3. Query Layer

#### `libs/shared-utils/src/queries/use-auth-policy-query.ts`
- Query Key: `['auth', 'policy', tenantId]`
- enabled 조건: `Boolean(tenantId)`
- 캐싱: `staleTime: 5분`, `gcTime: 10분`
- Retry: 1회

#### `libs/shared-utils/src/queries/use-idp-query.ts`
- Query Key: `['auth', 'idp', tenantId]`
- enabled 조건: `Boolean(tenantId)`
- 캐싱: `staleTime: 5분`, `gcTime: 10분`
- Retry: 1회

### 2.4. Login UI 자동 분기

#### `apps/dwp/src/sections/auth/sign-in-view.tsx`

**정책 로딩 흐름:**
1. `tenantId` 추출 (기존 `getTenantId()` 사용)
2. `useAuthPolicyQuery()`로 정책 조회
3. `useIdpQuery()`로 IDP 설정 조회 (SSO 사용 시)
4. UI 분기 렌더링

**UI 분기 규칙:**

1. **정책 로딩 중:**
   - CircularProgress 표시
   - "로그인 정책을 불러오는 중..." 메시지

2. **정책 조회 실패:**
   - ❌ **Fallback 금지** (LOCAL 기본 표시하지 않음)
   - Alert로 "테넌트 정책 조회 실패" 표시
   - 에러 메시지 상세 표시

3. **LOCAL 로그인 표시 조건:**
   - `allowedLoginTypes`에 `'LOCAL'`이 포함된 경우만 표시
   - ID/PW 입력 폼 표시
   - `defaultLoginType === 'LOCAL'`이면 primary CTA (contained, primary color)
   - 그 외에는 secondary CTA (contained, inherit color)

4. **SSO 로그인 표시 조건:**
   - `allowedLoginTypes`에 `'SSO'`가 포함된 경우만 표시
   - "SSO로 로그인" 버튼 표시
   - `defaultLoginType === 'SSO'`이면 primary CTA (contained, primary color)
   - 그 외에는 secondary CTA (outlined, inherit color)

5. **로직 순서:**
   - `defaultLoginType`이 우선순위
   - SSO가 default면 SSO 버튼을 먼저 표시
   - LOCAL이 default면 LOCAL 폼을 먼저 표시
   - 둘 다 허용되면 Divider로 구분

6. **로그인 방법 없음:**
   - `allowedLoginTypes`가 비어있거나 둘 다 없는 경우
   - Warning Alert 표시: "사용 가능한 로그인 방법이 없습니다."

### 2.5. SSO 버튼 동작

**현재 구현 (Placeholder):**
- SSO 버튼 클릭 시:
  1. `idpConfig.authUrl`이 있으면 → `window.location.href`로 리다이렉트
  2. 없으면 → Dialog 표시: "SSO 연동은 준비중입니다. 관리자에게 문의하세요."

**향후 확장:**
- 실제 OIDC/SAML 연동 구현 시 `authUrl` 기반 리다이렉트 사용
- Callback 처리 로직 추가 필요

## 3. API Contract

### 3.1. GET /api/auth/policy

**Request:**
- Headers: `X-Tenant-ID` (자동 주입)

**Response:**
```json
{
  "success": true,
  "data": {
    "tenantId": "client-a",
    "allowedLoginTypes": ["LOCAL", "SSO"],
    "defaultLoginType": "LOCAL",
    "requireMfa": false,
    "passwordPolicy": {
      "minLength": 8,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireNumber": true,
      "requireSpecialChar": false
    }
  },
  "message": "Success"
}
```

### 3.2. GET /api/auth/idp

**Request:**
- Headers: `X-Tenant-ID` (자동 주입)

**Response:**
```json
{
  "success": true,
  "data": {
    "tenantId": "client-a",
    "providerType": "OIDC",
    "providerName": "Azure AD",
    "authUrl": "https://login.microsoftonline.com/.../oauth2/v2.0/authorize?...",
    "metadata": null
  },
  "message": "Success"
}
```

## 4. 예외 처리 정책

### 4.1. 정책 조회 실패
- ❌ **절대 금지**: 정책 조회 실패 시 LOCAL fallback
- ✅ **올바른 처리**: Alert로 에러 표시, 로그인 불가 상태 유지
- 이유: 보안상 위험 (정책 우회 가능)

### 4.2. tenantId 없음
- Query가 `enabled: false`로 설정되어 자동으로 비활성화
- 정책 조회 시도하지 않음

### 4.3. IDP 설정 없음
- SSO 버튼은 표시되지만 `authUrl`이 없으면 Dialog 표시
- 실제 리다이렉트는 하지 않음

## 5. 테스트

### 5.1. Query 테스트
- `libs/shared-utils/src/queries/__tests__/use-auth-policy-query.test.ts`
  - tenantId 없을 때 disabled 동작
  - 정책 조회 성공/실패 케이스
  - 네트워크 에러 처리

- `libs/shared-utils/src/queries/__tests__/use-idp-query.test.ts`
  - tenantId 없을 때 disabled 동작
  - IDP 조회 성공/실패 케이스

### 5.2. UI 테스트 (수동)
1. **LOCAL only 정책:**
   - ID/PW 폼만 표시
   - SSO 버튼 숨김

2. **SSO only 정책:**
   - SSO 버튼만 표시
   - ID/PW 폼 숨김

3. **LOCAL + SSO 정책:**
   - 둘 다 표시
   - defaultLoginType에 따라 우선순위 결정

4. **정책 조회 실패:**
   - Alert 표시
   - 로그인 불가 상태

## 6. 생성/수정된 파일

### 6.1. 신규 파일
- `libs/shared-utils/src/auth/auth-policy-types.ts`
- `libs/shared-utils/src/api/auth-policy-api.ts`
- `libs/shared-utils/src/queries/use-auth-policy-query.ts`
- `libs/shared-utils/src/queries/use-idp-query.ts`
- `libs/shared-utils/src/queries/__tests__/use-auth-policy-query.test.ts`
- `libs/shared-utils/src/queries/__tests__/use-idp-query.test.ts`
- `docs/LOGIN_POLICY_UI.md`

### 6.2. 수정된 파일
- `libs/shared-utils/src/index.ts` (export 추가)
- `apps/dwp/src/sections/auth/sign-in-view.tsx` (정책 기반 UI 분기)

## 7. 향후 개선 사항

### 7.1. 실제 SSO 연동
- OIDC/SAML 프로토콜 구현
- Callback 처리 로직
- Token 교환 및 세션 관리

### 7.2. MFA 지원
- `requireMfa` 플래그 기반 MFA UI 추가
- TOTP/SMS 인증 구현

### 7.3. Password Policy 적용
- `passwordPolicy` 설정 기반 비밀번호 검증
- 실시간 강도 표시

## 8. 주의사항

### 8.1. 보안
- ❌ 정책 조회 실패 시 LOCAL fallback 절대 금지
- ✅ 모든 정책은 백엔드에서 강제 적용
- ✅ 프론트엔드는 정책에 따라 UI만 제어

### 8.2. 확장성
- SSO 연동은 확장 가능한 구조로 설계
- `authUrl` 기반 리다이렉트로 다양한 프로바이더 지원 가능

### 8.3. 캐싱
- 정책은 자주 변경되지 않으므로 긴 캐싱 시간 설정 (5분)
- 필요 시 수동 `refetch()` 가능
