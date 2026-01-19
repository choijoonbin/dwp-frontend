# 프론트엔드 확인 요청 사항

> **작성일**: 2026-01-16  
> **대상**: 프론트엔드 개발팀  
> **목적**: 백엔드 통합 전 필수 확인 사항

---

## 1. JWT 사용자 식별자 매핑

### ✅ 확인 완료: JWT의 `sub` 클레임을 `X-User-ID` 헤더로 전달

**구현 위치**:
- `libs/shared-utils/src/auth/user-id-storage.ts`
- `libs/shared-utils/src/auth/auth-provider.tsx`

**올바른 구현 예시**:
```typescript
// ✅ 올바른 구현: JWT의 sub 클레임을 우선 사용
export function extractUserIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // ✅ 우선순위: sub > userId > user_id (백엔드 명세에 맞춰 sub 우선)
    return payload.sub || payload.userId || payload.user_id || null;
  } catch {
    return null;
  }
}

// 로그인 시 자동으로 추출 및 저장
const login = useCallback(async (payload: LoginRequest) => {
  const res = await loginApi(payload);
  const token = extractAccessToken(res.data);
  setAccessToken(token);
  
  // ✅ JWT의 sub 필드를 추출하여 저장
  const userId = extractUserIdFromToken(token);
  if (userId) {
    setUserId(userId);  // localStorage에 저장
  }
}, []);

// API 요청 시 X-User-ID 헤더에 포함
const userId = getUserId();  // localStorage에서 조회
headers: {
  'X-User-ID': userId,  // ✅ JWT의 sub 값과 일치
}
```

**잘못된 구현 예시 (피해야 할 패턴)**:
```typescript
// ❌ 잘못된 구현: userId나 user_id를 우선 사용
return payload.userId || payload.user_id || payload.sub || null;

// ❌ 잘못된 구현: JWT를 파싱하지 않고 다른 소스에서 가져오기
const userId = localStorage.getItem('userId');  // JWT와 무관한 값

// ❌ 잘못된 구현: X-User-ID 헤더를 포함하지 않음
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Tenant-ID': tenantId,
  // X-User-ID 누락
}
```

**사용 위치 확인**:
- ✅ `apps/dwp/src/components/aura/aura-mini-overlay.tsx`: SSE 요청 시
- ✅ `apps/dwp/src/pages/ai-workspace.tsx`: SSE 요청 시
- ✅ `libs/shared-utils/src/agent/hitl-api.ts`: HITL API 호출 시

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
const token = localStorage.getItem('dwp-access-token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('JWT sub:', payload.sub);
console.log('Stored User ID:', localStorage.getItem('dwp-user-id'));
// 두 값이 일치해야 함
```

---

## 2. POST 요청으로 SSE 연결

### ✅ 확인 완료: POST 메서드를 사용하여 SSE 스트림 연결

**구현 위치**:
- `apps/dwp/src/components/aura/aura-mini-overlay.tsx`
- `apps/dwp/src/pages/ai-workspace.tsx`

**올바른 구현 예시**:
```typescript
// ✅ 올바른 구현: POST 메서드 사용
const response = await fetch(`${NX_API_URL}/api/aura/test/stream`, {
  method: 'POST',  // ✅ POST 메서드 사용
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId,
    'Authorization': `Bearer ${token}`,
    'X-User-ID': userId,
  },
  body: JSON.stringify({
    prompt: finalPrompt,  // ✅ 요청 본문에 prompt 포함
    context: agentContext,  // ✅ 요청 본문에 context 포함
  }),
  signal: abortController.signal,
});

// ✅ SSE 스트림 읽기
const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  // SSE 이벤트 파싱...
}
```

**잘못된 구현 예시 (피해야 할 패턴)**:
```typescript
// ❌ 잘못된 구현: GET 메서드 사용 (context 데이터가 크면 URL 길이 제한)
const url = `${NX_API_URL}/api/aura/test/stream?message=${encodeURIComponent(prompt)}`;
const response = await fetch(url, { method: 'GET' });

// ❌ 잘못된 구현: 요청 본문에 prompt나 context 누락
body: JSON.stringify({
  // prompt 누락
  // context 누락
}),

// ❌ 잘못된 구현: EventSource 사용 (POST를 지원하지 않음)
const eventSource = new EventSource(`${NX_API_URL}/api/aura/test/stream`);
```

**Context 객체 구조 확인**:
```typescript
// ✅ 명세에 맞는 context 객체
const agentContext = getAgentContext();
// {
//   activeApp: 'mail',        // ✅ 필수
//   pathname: '/mail',        // ✅ 필수
//   path: '/mail',
//   itemId: undefined,
//   timestamp: '2026-01-16T...',
//   userAgent: '...',
//   language: 'ko-KR',
//   remoteState: { ... }      // 선택 (MFE Context Bridge)
// }
```

**디버깅 로그**:
개발 환경에서 브라우저 콘솔에 다음 로그가 출력됩니다:
```javascript
[Aura SSE Request] {
  endpoint: 'http://localhost:8080/api/aura/test/stream',
  method: 'POST',  // ✅ 확인
  headers: { ... },
  payload: {
    prompt: '...',  // ✅ 확인
    context: { ... }  // ✅ 확인
  }
}
```

---

## 3. SSE 재연결 구현

### ✅ 확인 완료: `Last-Event-ID` 헤더를 사용한 재연결 구현

**구현 위치**:
- `libs/shared-utils/src/agent/use-agent-stream.ts`

**올바른 구현 예시**:
```typescript
// ✅ 올바른 구현: 이벤트 ID 저장
const lastEventIdRef = useRef<string | null>(null);

// SSE 응답에서 id: 라인 파싱
if (trimmedLine.startsWith('id: ')) {
  lastEventIdRef.current = trimmedLine.slice(4).trim();  // ✅ 이벤트 ID 저장
  continue;
}

// ✅ 재연결 시 Last-Event-ID 헤더 포함
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Tenant-ID': tenantId,
  'Authorization': `Bearer ${token}`,
  ...(lastEventId && { 'Last-Event-ID': lastEventId }),  // ✅ 재연결 시 포함
};

// ✅ Exponential Backoff 재연결
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
    // ✅ Exponential Backoff: 1s, 2s, 4s, 8s, 16s (최대 30s)
    const delay = getBackoffDelay(attempt);
    reconnectAttemptRef.current = attempt + 1;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return attemptReconnect(attempt + 1);
  }
};
```

**잘못된 구현 예시 (피해야 할 패턴)**:
```typescript
// ❌ 잘못된 구현: 이벤트 ID를 저장하지 않음
// id: 라인을 파싱하지 않음

// ❌ 잘못된 구현: 재연결 시 Last-Event-ID 헤더를 포함하지 않음
const headers = {
  'Content-Type': 'application/json',
  // Last-Event-ID 누락
};

// ❌ 잘못된 구현: 재연결 시 고정된 지연 시간 사용
await new Promise((resolve) => setTimeout(resolve, 1000));  // 항상 1초

// ❌ 잘못된 구현: 재연결 시도 횟수 제한 없음
while (true) {  // 무한 루프 위험
  try {
    return await connectStream(...);
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
```

**재연결 흐름**:
1. 네트워크 오류 발생
2. `lastEventIdRef.current`에 마지막으로 받은 이벤트 ID 저장
3. Exponential Backoff로 재시도 (최대 5회)
4. 재연결 시 `Last-Event-ID` 헤더에 마지막 이벤트 ID 포함
5. 백엔드가 해당 ID 이후의 이벤트부터 재개

**상태 관리**:
```typescript
const [isReconnecting, setIsReconnecting] = useState(false);
const lastEventIdRef = useRef<string | null>(null);
const reconnectAttemptRef = useRef(0);
```

---

## 4. CORS 헤더 설정

### ✅ 확인 완료: 필요한 헤더가 모든 요청에 포함됨

**포함되는 헤더**:
- ✅ `Authorization`: JWT 토큰
- ✅ `X-Tenant-ID`: 테넌트 ID (서브도메인에서 추출)
- ✅ `X-User-ID`: 사용자 ID (JWT의 `sub` 필드)
- ✅ `Content-Type`: `application/json`
- ✅ `Last-Event-ID`: SSE 재연결 시 (선택)
- ✅ `Accept`: `text/event-stream` (SSE 요청 시)

**구현 위치**:
1. **SSE 스트리밍 요청**:
   - `apps/dwp/src/components/aura/aura-mini-overlay.tsx`
   - `apps/dwp/src/pages/ai-workspace.tsx`

2. **HITL API 요청**:
   - `libs/shared-utils/src/agent/hitl-api.ts`

**올바른 구현 예시**:
```typescript
// ✅ 올바른 구현: 모든 필수 헤더 포함
const response = await fetch(`${NX_API_URL}/api/aura/test/stream`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',  // ✅ SSE 요청 시 포함
    'Authorization': `Bearer ${token}`,  // ✅ 필수
    'X-Tenant-ID': tenantId,  // ✅ 필수
    'X-User-ID': userId,  // ✅ 필수
    ...(lastEventId && { 'Last-Event-ID': lastEventId }),  // ✅ 재연결 시
  },
  body: JSON.stringify({ ... }),
});
```

**잘못된 구현 예시 (피해야 할 패턴)**:
```typescript
// ❌ 잘못된 구현: 필수 헤더 누락
headers: {
  'Content-Type': 'application/json',
  // Authorization 누락
  // X-Tenant-ID 누락
  // X-User-ID 누락
}

// ❌ 잘못된 구현: 잘못된 헤더 값
headers: {
  'Authorization': token,  // Bearer 접두사 누락
  'X-Tenant-ID': undefined,  // undefined 값 전달
}
```

**CORS Preflight 요청 확인**:
브라우저가 자동으로 OPTIONS 요청을 보내며, 백엔드가 다음 헤더를 허용해야 합니다:
- `Authorization`
- `X-Tenant-ID`
- `X-User-ID`
- `Content-Type`
- `Accept`
- `Last-Event-ID`

**검증 방법**:
1. 브라우저 개발자 도구의 Network 탭에서 OPTIONS 요청 확인
2. CORS 오류 메시지가 없는지 확인
3. 실제 POST 요청이 정상적으로 전송되는지 확인

---

## 5. 에러 처리

### ✅ 확인 완료: SSE 연결 실패 및 에러 상황 처리

**구현 위치**:
- `apps/dwp/src/components/aura/aura-mini-overlay.tsx`
- `apps/dwp/src/pages/ai-workspace.tsx`
- `libs/shared-utils/src/agent/use-agent-stream.ts`

**올바른 구현 예시**:
```typescript
// ✅ 올바른 구현: 다양한 에러 상황 처리
try {
  const response = await fetch(`${NX_API_URL}/api/aura/test/stream`, {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify({ ... }),
    signal: abortController.signal,
  });

  // ✅ HTTP 에러 상태 확인
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No reader available');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // SSE 이벤트 파싱...
    }
  } catch (streamError: any) {
    // ✅ 스트림 읽기 에러 처리
    if (streamError.name !== 'AbortError') {
      console.error('Stream read error:', streamError);
      throw streamError;
    }
  }
} catch (error: any) {
  // ✅ 네트워크 에러 처리
  if (error.name === 'AbortError') {
    // 사용자가 취소한 경우
    console.log('Request aborted by user');
    return;
  }

  // ✅ HTTP 에러 처리
  if (error.message?.includes('HTTP')) {
    addMessage({
      role: 'assistant',
      content: `서버 오류가 발생했습니다: ${error.message}`,
    });
    return;
  }

  // ✅ 일반 에러 처리
  console.error('SSE connection error:', error);
  addMessage({
    role: 'assistant',
    content: `연결 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
  });
} finally {
  // ✅ 정리 작업
  setStreaming(false);
  setThinking(false);
  setStreamingText('');
  abortController.current = null;
}
```

**잘못된 구현 예시 (피해야 할 패턴)**:
```typescript
// ❌ 잘못된 구현: 에러를 처리하지 않음
const response = await fetch(...);
const reader = response.body?.getReader();
// 에러 처리 없음

// ❌ 잘못된 구현: 모든 에러를 무시
try {
  // ...
} catch (error) {
  // 아무것도 하지 않음
}

// ❌ 잘못된 구현: 사용자에게 에러를 표시하지 않음
catch (error) {
  console.error(error);  // 콘솔에만 출력
  // UI에 에러 메시지 표시하지 않음
}

// ❌ 잘못된 구현: AbortError를 일반 에러로 처리
catch (error) {
  addMessage({
    role: 'assistant',
    content: `오류: ${error.message}`,  // AbortError도 에러 메시지로 표시
  });
}
```

**에러 처리 시나리오**:

1. **네트워크 오류**:
   - 자동 재연결 시도 (Exponential Backoff)
   - 최대 5회 재시도 후 실패 메시지 표시

2. **HTTP 에러 (4xx, 5xx)**:
   - 에러 메시지를 사용자에게 표시
   - 재연결 시도하지 않음

3. **스트림 파싱 에러**:
   - 불완전한 JSON은 버퍼에 보관하고 다음 청크에서 처리
   - 파싱 불가능한 데이터는 경고만 출력하고 계속 진행

4. **사용자 취소 (AbortError)**:
   - 에러 메시지를 표시하지 않음
   - 정상적으로 스트리밍 중지

5. **타임아웃**:
   - 재연결 시도
   - 최대 재시도 횟수 초과 시 에러 메시지 표시

**에러 메시지 표시**:
```typescript
// ✅ 사용자에게 친화적인 에러 메시지 표시
addMessage({
  role: 'assistant',
  content: `오류가 발생했습니다: ${error.message}`,
});
```

---

## 📋 확인 체크리스트

### 구현 완료 항목

- [x] **JWT sub 필드 사용**: JWT의 `sub` 클레임을 `X-User-ID` 헤더로 전달 ✅
- [x] **POST 요청 구현**: POST `/api/aura/test/stream` 요청 구현 완료 ✅
- [x] **요청 본문 구조**: `prompt`와 `context` 포함 확인 ✅
- [x] **SSE 재연결 구현**: `Last-Event-ID` 헤더를 사용한 재연결 로직 구현 ✅
- [x] **이벤트 ID 저장**: SSE 응답의 `id:` 라인 파싱 및 저장 ✅
- [x] **CORS 헤더 포함**: 필요한 모든 헤더가 요청에 포함됨 ✅
- [x] **에러 처리**: 다양한 에러 상황에 대한 처리 구현 ✅

### 테스트 필요 항목

- [ ] **실제 백엔드 연결 테스트**: Gateway(8080)를 통한 Aura-Platform(9000) 연결 테스트
- [ ] **SSE 스트리밍 테스트**: 실제 SSE 이벤트 수신 및 파싱 테스트
- [ ] **재연결 시나리오 테스트**: 네트워크 끊김 시나리오에서 재연결 동작 테스트
- [ ] **에러 시나리오 테스트**: 다양한 에러 상황에서 적절한 처리 확인

---

## 🔧 테스트 시나리오

### 1. JWT 사용자 식별자 매핑 테스트

```javascript
// 브라우저 콘솔에서 실행
const token = localStorage.getItem('dwp-access-token');
const payload = JSON.parse(atob(token.split('.')[1]));
const storedUserId = localStorage.getItem('dwp-user-id');

console.log('JWT sub:', payload.sub);
console.log('Stored User ID:', storedUserId);
console.log('Match:', payload.sub === storedUserId);  // ✅ true여야 함
```

### 2. POST SSE 연결 테스트

브라우저 개발자 도구의 Network 탭에서 확인:
- 요청 메서드: `POST` ✅
- 요청 URL: `http://localhost:8080/api/aura/test/stream` ✅
- 요청 본문: `{"prompt": "...", "context": {...}}` ✅
- 응답 타입: `text/event-stream` ✅

### 3. SSE 재연결 테스트

1. 네트워크 탭에서 "Offline" 모드 활성화
2. SSE 요청 전송
3. 네트워크 복구 후 자동 재연결 확인
4. `Last-Event-ID` 헤더가 포함되는지 확인

### 4. 에러 처리 테스트

1. **네트워크 오류**: 네트워크 끊김 시 재연결 시도 확인
2. **HTTP 401**: 인증 오류 메시지 표시 확인
3. **HTTP 500**: 서버 오류 메시지 표시 확인
4. **취소**: 사용자가 취소 버튼 클릭 시 정상 중지 확인

---

## 📞 문의 사항

구현이 완료되었으므로, 다음 단계로 진행하시기 바랍니다:

1. **통합 테스트**: 프론트엔드와 백엔드를 함께 테스트
2. **실제 연결 테스트**: Gateway(8080)를 통한 Aura-Platform(9000) 연결 확인
3. **에러 시나리오 테스트**: 다양한 에러 상황에서 적절한 처리 확인

---

**최종 업데이트**: 2026-01-16  
**담당자**: DWP Frontend Team
