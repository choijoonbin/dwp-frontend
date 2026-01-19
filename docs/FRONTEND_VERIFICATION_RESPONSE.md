# 프론트엔드 확인 응답 체크리스트

> **작성일**: 2026-01-16  
> **대상**: 백엔드 개발팀  
> **목적**: 백엔드 확인 요청에 대한 프론트엔드 구현 상태 응답

---

## ✅ 프론트엔드 구현 완료 항목

### 1. JWT sub 필드 사용

**✅ 구현 완료**: JWT의 `sub` 클레임을 `X-User-ID` 헤더로 전달합니다.

**구현 위치**:
- `libs/shared-utils/src/auth/user-id-storage.ts`

**코드 확인**:
```typescript
export function extractUserIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // ✅ 우선순위: sub > userId > user_id (백엔드 명세에 맞춰 sub 우선)
    return payload.sub || payload.userId || payload.user_id || null;
  } catch {
    return null;
  }
}
```

**JWT Payload 처리**:
- 로그인 시 `auth-provider.tsx`에서 자동으로 `sub` 필드를 추출하여 localStorage에 저장
- HITL API 호출 시 `X-User-ID` 헤더에 자동 포함
- SSE 스트리밍 요청 시 `X-User-ID` 헤더에 자동 포함

**사용 위치**:
1. `apps/dwp/src/components/aura/aura-mini-overlay.tsx`: SSE 요청 시
2. `apps/dwp/src/pages/ai-workspace.tsx`: SSE 요청 시
3. `libs/shared-utils/src/agent/hitl-api.ts`: HITL API 호출 시

---

### 2. POST 요청 테스트 준비

**✅ 구현 완료**: POST `/api/aura/test/stream` 요청이 구현되어 있습니다.

**구현 위치**:
- `apps/dwp/src/components/aura/aura-mini-overlay.tsx`
- `apps/dwp/src/pages/ai-workspace.tsx`

**요청 형식**:
```typescript
const response = await fetch(`${NX_API_URL}/api/aura/test/stream`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId,
    'Authorization': `Bearer ${token}`,
    'X-User-ID': userId,  // ✅ JWT의 sub 값
  },
  body: JSON.stringify({
    prompt: finalPrompt,
    context: agentContext,  // ✅ pathname, activeApp 포함
  }),
});
```

**Context 객체 구조**:
```typescript
{
  activeApp: 'mail',        // ✅ 명세 준수
  path: '/mail',
  pathname: '/mail',        // ✅ 명세 준수 (추가됨)
  itemId: undefined,
  timestamp: '2026-01-16T...',
  userAgent: '...',
  language: 'ko-KR',
  remoteState: { ... }     // MFE Context Bridge (선택)
}
```

**디버깅 로그**:
개발 환경에서 브라우저 콘솔에 다음 로그가 출력됩니다:
```javascript
[Aura SSE Request] {
  endpoint: 'http://localhost:8080/api/aura/test/stream',
  method: 'POST',
  headers: { ... },
  payload: { ... },
  contextCheck: {
    hasPathname: true,      // ✅ 확인
    hasActiveApp: true,     // ✅ 확인
    pathname: '/mail',
    activeApp: 'mail'
  }
}
```

---

### 3. SSE 재연결 테스트 준비

**✅ 구현 완료**: `Last-Event-ID` 헤더를 사용한 재연결이 구현되어 있습니다.

**구현 위치**:
- `libs/shared-utils/src/agent/use-agent-stream.ts`

**재연결 로직**:
```typescript
// SSE 응답에서 id: 라인 파싱
if (trimmedLine.startsWith('id: ')) {
  lastEventIdRef.current = trimmedLine.slice(4).trim();
  continue;
}

// 재연결 시 Last-Event-ID 헤더 포함
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Tenant-ID': tenantId,
  ...(token && { Authorization: `Bearer ${token}` }),
  ...(lastEventId && { 'Last-Event-ID': lastEventId }),  // ✅ 재연결 지원
};

// Exponential Backoff 재연결
const attemptReconnect = async (attempt: number): Promise<string> => {
  try {
    return await connectStream({
      prompt,
      options,
      lastEventId: lastEventIdRef.current,  // ✅ 마지막 이벤트 ID 전달
      abortController: abortControllerRef.current || undefined,
    });
  } catch (error: any) {
    if (error.name === 'AbortError' || attempt >= 5) {
      throw error;
    }
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (최대 30s)
    const delay = getBackoffDelay(attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return attemptReconnect(attempt + 1);
  }
};
```

**재연결 흐름**:
1. 네트워크 오류 발생
2. `lastEventIdRef.current`에 마지막으로 받은 이벤트 ID 저장
3. Exponential Backoff로 재시도 (최대 5회)
4. 재연결 시 `Last-Event-ID` 헤더에 마지막 이벤트 ID 포함
5. 백엔드가 해당 ID 이후의 이벤트부터 재개

**상태 관리**:
- `isReconnecting`: 재연결 중 상태 표시 가능
- `lastEventIdRef`: 마지막 이벤트 ID 저장
- `reconnectAttemptRef`: 재시도 횟수 추적

---

### 4. CORS 헤더 확인

**✅ 구현 완료**: 필요한 헤더가 모든 요청에 포함되어 있습니다.

**포함되는 헤더**:
- `Authorization`: JWT 토큰
- `X-Tenant-ID`: 테넌트 ID (서브도메인에서 추출)
- `X-User-ID`: 사용자 ID (JWT의 `sub` 필드)
- `Content-Type`: `application/json`
- `Last-Event-ID`: SSE 재연결 시 (선택)

**구현 위치**:
1. **SSE 스트리밍 요청**:
   - `apps/dwp/src/components/aura/aura-mini-overlay.tsx`
   - `apps/dwp/src/pages/ai-workspace.tsx`

2. **HITL API 요청**:
   - `libs/shared-utils/src/agent/hitl-api.ts`

**헤더 전송 예시**:
```typescript
headers: {
  'Content-Type': 'application/json',
  'X-Tenant-ID': tenantId,                    // ✅ 필수
  'Authorization': `Bearer ${token}`,          // ✅ 필수
  'X-User-ID': userId,                        // ✅ 필수 (HITL 및 SSE)
  'Last-Event-ID': lastEventId,               // ✅ 선택 (재연결 시)
}
```

---

## 📋 프론트엔드 확인 체크리스트

### 구현 완료 항목

- [x] **JWT sub 필드 사용**: JWT의 `sub` 클레임을 `X-User-ID` 헤더로 전달
- [x] **POST 요청 구현**: POST `/api/aura/test/stream` 요청 구현 완료
- [x] **Context 객체 구조**: `pathname`과 `activeApp` 필드 포함
- [x] **SSE 재연결 구현**: `Last-Event-ID` 헤더를 사용한 재연결 로직 구현
- [x] **CORS 헤더 포함**: 필요한 모든 헤더가 요청에 포함됨
- [x] **디버깅 로그**: 개발 환경에서 요청 정보 로깅

### 테스트 필요 항목

- [ ] **실제 백엔드 연결 테스트**: Gateway(8080)를 통한 Aura-Platform(9000) 연결 테스트
- [ ] **SSE 스트리밍 테스트**: 실제 SSE 이벤트 수신 및 파싱 테스트
- [ ] **HITL 승인 플로우 테스트**: 승인/거절 API 호출 및 스트리밍 재개 테스트
- [ ] **재연결 시나리오 테스트**: 네트워크 끊김 시나리오에서 재연결 동작 테스트

---

## 🔧 테스트 시나리오

### 1. 기본 SSE 연결 테스트

**프론트엔드에서 확인할 사항**:
1. 브라우저 콘솔에서 `[Aura SSE Request]` 로그 확인
2. `contextCheck`에서 `hasPathname: true`, `hasActiveApp: true` 확인
3. 네트워크 탭에서 POST 요청 헤더 확인:
   - `Authorization: Bearer {token}`
   - `X-Tenant-ID: {tenantId}`
   - `X-User-ID: {userId}`
4. SSE 응답 수신 확인

**예상 동작**:
- 요청이 `http://localhost:8080/api/aura/test/stream`로 전송됨
- Gateway가 `http://localhost:9000`으로 프록시
- SSE 이벤트가 정상적으로 수신됨

### 2. SSE 재연결 테스트

**테스트 방법**:
1. 네트워크 탭에서 "Offline" 모드 활성화
2. SSE 요청 전송
3. 네트워크 복구 후 자동 재연결 확인

**예상 동작**:
- `isReconnecting` 상태가 `true`로 변경됨
- Exponential Backoff로 재시도 (1s, 2s, 4s, 8s, 16s)
- 재연결 시 `Last-Event-ID` 헤더 포함
- 백엔드가 중단 지점부터 재개

### 3. Context 객체 검증

**브라우저 콘솔에서 확인**:
```javascript
[Aura Context] {
  endpoint: '/api/aura/test/stream',
  context: {
    activeApp: 'mail',        // ✅ 확인
    pathname: '/mail',        // ✅ 확인
    path: '/mail',
    ...
  }
}
```

**요청 페이로드 확인**:
```javascript
{
  prompt: '...',
  context: {
    activeApp: 'mail',        // ✅ 명세 준수
    pathname: '/mail',        // ✅ 명세 준수
    ...
  }
}
```

---

## ⚠️ 추가 확인 필요 사항

### 1. 환경 변수 설정

**확인 사항**:
- `.env` 파일에 `NX_API_URL=http://localhost:8080` 설정 확인
- 기본값이 `http://localhost:8080`으로 설정되어 있지만, 명시적으로 설정 권장

**설정 방법**:
```bash
# .env 파일 생성 또는 수정
echo "NX_API_URL=http://localhost:8080" >> .env
```

### 2. JWT 토큰 구조

**확인 사항**:
- JWT 토큰의 `sub` 필드가 실제 사용자 ID를 포함하는지 확인
- `tenant_id` 필드가 포함되어 있는지 확인

**디버깅 방법**:
```javascript
// 브라우저 콘솔에서 확인
const token = localStorage.getItem('dwp-access-token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('JWT Payload:', payload);
console.log('User ID (sub):', payload.sub);
console.log('Tenant ID:', payload.tenant_id);
```

### 3. CORS Preflight 요청

**확인 사항**:
- 브라우저가 OPTIONS 요청을 보낼 때 백엔드가 올바르게 응답하는지 확인
- CORS 오류가 발생하지 않는지 확인

**확인 방법**:
- 브라우저 개발자 도구의 Network 탭에서 OPTIONS 요청 확인
- CORS 오류 메시지가 없는지 확인

---

## 📞 문의 사항

프론트엔드 구현이 완료되었으므로, 다음 사항을 백엔드 팀과 협의하여 테스트를 진행하시기 바랍니다:

1. **통합 테스트 일정**: 프론트엔드와 백엔드를 함께 테스트할 일정 조율
2. **테스트 계정**: JWT 토큰이 포함된 테스트 계정 제공 요청
3. **로그 확인**: Gateway와 Aura-Platform 로그에서 요청이 정상적으로 처리되는지 확인
4. **에러 처리**: 예상치 못한 에러 발생 시 백엔드 로그 확인 방법

---

## 📝 변경 이력

- **2026-01-16**: 초기 작성
  - JWT sub 필드 사용 확인
  - POST 요청 구현 확인
  - SSE 재연결 구현 확인
  - CORS 헤더 포함 확인

---

**최종 업데이트**: 2026-01-16  
**담당자**: DWP Frontend Team
