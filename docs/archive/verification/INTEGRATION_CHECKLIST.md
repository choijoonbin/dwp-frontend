# 통/협업 관점 통합 체크리스트

> **대상**: 프론트엔드 개발팀, 백엔드 개발팀, Aura Platform 개발팀  
> **최종 업데이트**: 2026-01-16  
> **상태**: ⚠️ 확인 필요

---

## 📋 개요

이 문서는 프론트엔드와 백엔드 간 통합 시 충돌이 예상되는 부분을 명확히 하고, 확인이 필요한 사항을 정리합니다.

---

## 1. 포트 충돌 방지

### 현재 상태

**프론트엔드**:
- Host 앱: `4200`
- Mail Remote: `4201`
- Gateway API URL: `.env` 파일의 `NX_API_URL`로 설정 (기본값: `http://localhost:8080`)

**백엔드 (예상)**:
- Gateway: `8080`
- Aura-Platform: `9000` (변경됨)

### 확인 필요 사항

- [ ] **dwp-gateway의 `application.yml`에서 Aura-Platform 라우팅이 `http://localhost:9000`으로 설정되어 있는지 확인**
- [ ] Gateway의 `/api/aura/*` 경로가 올바르게 Aura-Platform으로 프록시되는지 확인
- [ ] CORS 설정에서 `http://localhost:4200`, `http://localhost:4201` 등 프론트엔드 포트가 허용되어 있는지 확인

### 권장 사항

백엔드 팀은 다음을 확인해주세요:

```yaml
# application.yml 예시
spring:
  cloud:
    gateway:
      routes:
        - id: aura-platform
          uri: http://localhost:9000  # ✅ 9000 포트로 변경 확인 필요
          predicates:
            - Path=/api/aura/**
```

---

## 2. 사용자 식별자(User-ID) 일관성

### 현재 프론트엔드 구현

**파일**: `libs/shared-utils/src/auth/user-id-storage.ts`

```typescript
export function extractUserIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // 우선순위: sub > userId > user_id
    return payload.sub || payload.userId || payload.user_id || null;
  } catch {
    return null;
  }
}
```

**사용 위치**:
- `libs/shared-utils/src/agent/hitl-api.ts`: HITL API 호출 시 `X-User-ID` 헤더에 포함
- `libs/shared-utils/src/auth/auth-provider.tsx`: 로그인 시 자동 추출 및 저장

### 확인 필요 사항

- [ ] **JWT 토큰의 사용자 식별자 필드명이 `sub`, `userId`, `user_id` 중 어느 것인지 백엔드 팀과 확인**
- [ ] **백엔드 Gateway가 `X-User-ID` 헤더를 Aura-Platform으로 전달하는지 확인**
- [ ] **Aura-Platform이 `X-User-ID` 헤더를 기대하는지, 다른 필드명을 사용하는지 확인**

### 현재 프론트엔드 헤더 전송

**HITL API 호출 시** (`libs/shared-utils/src/agent/hitl-api.ts`):

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Tenant-ID': tenantId,
  'X-User-ID': finalUserId,  // ✅ 이 헤더 사용
  'Content-Type': 'application/json',
}
```

**SSE 스트리밍 요청 시** (`apps/dwp/src/components/aura/aura-mini-overlay.tsx`, `apps/dwp/src/pages/ai-workspace.tsx`):

```typescript
headers: {
  'Content-Type': 'application/json',
  'X-Tenant-ID': tenantId,
  'Authorization': `Bearer ${token}`,
  // ⚠️ X-User-ID는 현재 SSE 요청에 포함되지 않음
}
```

### 권장 사항

1. **JWT 필드명 확인**: 백엔드 팀과 JWT 토큰의 사용자 식별자 필드명을 명확히 합의
2. **SSE 요청에 X-User-ID 추가**: SSE 스트리밍 요청에도 `X-User-ID` 헤더를 포함하도록 수정 권장
3. **백엔드 검증**: Gateway와 Aura-Platform이 `X-User-ID` 헤더를 올바르게 처리하는지 확인

---

## 3. SSE 전송 방식

### 현재 프론트엔드 구현

**엔드포인트**: `POST /api/aura/test/stream`

**사용 위치**:
- `apps/dwp/src/components/aura/aura-mini-overlay.tsx`
- `apps/dwp/src/pages/ai-workspace.tsx`

**요청 형식**:

```typescript
const response = await fetch(`${NX_API_URL}/api/aura/test/stream`, {
  method: 'POST',  // ✅ POST 방식 사용
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId,
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    prompt: finalPrompt,
    context: pageContext,  // context 데이터가 큼
  }),
});
```

**선택 이유**:
- `context` 객체에 URL, 경로, 메타데이터, Remote 앱 상태 등 많은 정보가 포함됨
- GET 방식의 쿼리 파라미터로는 URL 길이 제한에 걸릴 수 있음

### 확인 필요 사항

- [ ] **백엔드 Gateway가 `POST /api/aura/test/stream` 요청을 지원하는지 확인**
- [ ] **Aura-Platform이 POST 방식의 SSE 요청을 처리할 수 있는지 확인**
- [ ] **POST 요청의 body를 파싱하여 SSE 스트림을 생성하는지 확인**

### 대안 (GET 방식 지원)

프론트엔드 코드에 주석으로 GET 방식 대안이 포함되어 있습니다:

```typescript
// NOTE: Backend supports GET /api/aura/test/stream?message={message}
// Currently using POST for context data. If backend requires GET, use:
// const url = `${NX_API_URL}/api/aura/test/stream?message=${encodeURIComponent(finalPrompt)}`;
// const response = await fetch(url, { method: 'GET', headers: {...} });
```

### 권장 사항

1. **백엔드 테스트**: POST 방식의 SSE 응답이 정상적으로 동작하는지 테스트
2. **대안 준비**: GET 방식이 필요한 경우, context 데이터를 축소하거나 별도 API로 전송하는 방안 검토
3. **문서화**: 최종 결정된 방식을 `docs/BACKEND_API_SPEC.md`에 명시

---

## 4. 추가 확인 사항

### SSE 이벤트 ID 지원

**프론트엔드 구현**: `libs/shared-utils/src/agent/use-agent-stream.ts`

```typescript
// Last-Event-ID 헤더 지원 (재연결 시 사용)
if (trimmedLine.startsWith('id: ')) {
  lastEventIdRef.current = trimmedLine.slice(4).trim();
  continue;
}

// 재연결 시 Last-Event-ID 헤더 전송
headers: {
  ...(lastEventId && { 'Last-Event-ID': lastEventId }),
}
```

**확인 필요**:
- [ ] 백엔드가 SSE 응답에 `id:` 라인을 포함하는지 확인
- [ ] `Last-Event-ID` 헤더를 받아서 중단 지점부터 재개하는지 확인

### CORS 설정

**필수 허용 헤더**:
- `Authorization`
- `X-Tenant-ID`
- `X-User-ID` (HITL API 사용 시)
- `Content-Type`

**확인 필요**:
- [ ] Gateway의 CORS 설정에 위 헤더들이 포함되어 있는지 확인

---

## 📝 체크리스트 요약

### 백엔드 팀 확인 사항

- [ ] Aura-Platform 포트가 `9000`으로 설정되어 있고, Gateway 라우팅이 올바른지 확인
- [ ] JWT 토큰의 사용자 식별자 필드명(`sub`, `userId`, `user_id`) 확인
- [ ] `X-User-ID` 헤더를 Gateway와 Aura-Platform이 올바르게 처리하는지 확인
- [ ] `POST /api/aura/test/stream` 요청에 대한 SSE 응답이 정상 동작하는지 테스트
- [ ] SSE 응답에 `id:` 라인을 포함하여 재연결 지원하는지 확인
- [ ] CORS 설정에 필수 헤더들이 포함되어 있는지 확인

### 프론트엔드 팀 확인 사항

- [ ] `.env` 파일의 `NX_API_URL`이 Gateway 주소를 가리키는지 확인
- [ ] JWT 토큰에서 사용자 ID 추출이 정상 동작하는지 확인
- [ ] SSE 스트리밍 요청이 정상적으로 동작하는지 테스트
- [ ] HITL API 호출 시 `X-User-ID` 헤더가 포함되는지 확인

---

## 🔗 관련 문서

- `docs/BACKEND_API_SPEC.md`: 백엔드 API 스펙 상세
- `docs/aura.md`: 프론트엔드 구현 가이드
- `README.md`: 프로젝트 개요 및 설정

---

## 📞 문의

확인이 필요한 사항이 있으면 다음을 참고하세요:

1. **포트 및 라우팅**: 백엔드 Gateway 팀
2. **JWT 및 인증**: 백엔드 Auth 서버 팀
3. **SSE 스트리밍**: Aura Platform 팀
4. **프론트엔드 구현**: 프론트엔드 팀
