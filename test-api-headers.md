# API 헤더 테스트 가이드

## 1. 브라우저 개발자 도구에서 확인

1. Chrome/Edge: F12 → Network 탭
2. 페이지 새로고침 (http://localhost:4200/sign-in)
3. `/api/auth/policy` 요청 클릭
4. **Request Headers** 섹션에서 확인:
   - `X-Tenant-ID: 1` ✓ (있어야 함)
   - `Authorization: Bearer ...` (없어야 정상 - sign-in 페이지에서는)

## 2. 예상되는 문제

### 문제 1: 백엔드 설정
- `/api/auth/policy`와 `/api/auth/idp`가 **public API로 설정되지 않음**
- 이 API들은 **인증 없이** 접근 가능해야 합니다

**백엔드 확인 사항:**
```kotlin
// SecurityConfig에서 permitAll() 확인
.requestMatchers("/api/auth/policy", "/api/auth/idp").permitAll()
```

### 문제 2: CORS 설정
- 프론트엔드 (localhost:4200)에서 백엔드 (localhost:8080)로의 요청이 CORS로 차단될 수 있음

**백엔드 확인 사항:**
```kotlin
@CrossOrigin(origins = ["http://localhost:4200"])
```

## 3. 수동 테스트

터미널에서 직접 테스트:

```bash
# 1. 헤더만으로 테스트
curl -X GET http://localhost:8080/api/auth/policy \
  -H "X-Tenant-ID: 1" \
  -v

# 2. 성공 응답 예시
# HTTP/1.1 200 OK
# {
#   "data": {
#     "tenantId": "1",
#     "allowedLoginTypes": ["LOCAL", "SSO"],
#     "defaultLoginType": "LOCAL"
#   }
# }
```

## 4. 해결 방법

**백엔드에서 수정 필요:**

1. `SecurityConfig.kt`에서 public API 추가:
```kotlin
http.authorizeHttpRequests { auth ->
    auth
        .requestMatchers("/api/auth/policy").permitAll()
        .requestMatchers("/api/auth/idp").permitAll()
        .requestMatchers("/api/auth/login").permitAll()
        .anyRequest().authenticated()
}
```

2. `TenantInterceptor.kt`에서 X-Tenant-ID 헤더 확인
3. CORS 설정 확인
