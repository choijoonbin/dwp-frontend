# Aura AI Integration Documentation

## 📋 목차

1. [개요](#개요)
2. [프론트엔드 아키텍처](#프론트엔드-아키텍처)
3. [필수 API 스펙](#필수-api-스펙)
4. [데이터 모델](#데이터-모델)
5. [UI 컴포넌트 구조](#ui-컴포넌트-구조)
6. [상태 관리](#상태-관리)
7. [통신 프로토콜](#통신-프로토콜)
8. [백엔드 구현 가이드](#백엔드-구현-가이드)

---

## 개요

Aura는 DWP 플랫폼의 Agentic AI 파트너로, 사용자와 실시간으로 상호작용하며 복잡한 작업을 수행할 수 있는 AI 에이전트입니다. 프론트엔드는 **Server-Sent Events (SSE)**를 통해 실시간 스트리밍을 받아 처리하며, 사용자에게 AI의 사고 과정, 실행 계획, 결과를 투명하게 시각화합니다.

### 핵심 기능

- **실시간 스트리밍 대화**: SSE를 통한 타이핑 효과와 실시간 응답
- **사고 과정 시각화**: AI의 추론 과정을 타임라인으로 표시
- **작업 계획 관리**: 단계별 작업 제안 및 사용자 승인/순서 변경
- **Human-in-the-Loop (HITL)**: 중요한 작업 전 사용자 승인 요청
- **컨텍스트 인지**: 현재 페이지, 선택된 항목 등 자동 수집
- **실행 로그**: 터미널 스타일의 실시간 실행 로그 표시

---

## 프론트엔드 아키텍처

### 컴포넌트 구조

```
apps/dwp/src/
├── components/aura/
│   ├── aura-floating-button.tsx      # 우측 하단 고정 버튼 (arua.gif)
│   ├── aura-mini-overlay.tsx          # 미니 채팅 오버레이 (우측 슬라이드)
│   ├── thought-chain-ui.tsx          # 사고 과정 타임라인
│   ├── dynamic-plan-board.tsx         # 작업 계획 보드 (드래그 앤 드롭)
│   ├── live-execution-log.tsx         # 하단 고정 실행 로그
│   ├── checkpoint-approval.tsx        # HITL 승인 다이얼로그
│   ├── confidence-score.tsx           # AI 신뢰도 표시
│   └── contextual-bridge.tsx          # 오른쪽 사이드바 컨텍스트
├── pages/
│   └── ai-workspace.tsx               # Full AI Workspace 페이지
├── store/
│   └── use-aura-store.ts              # Zustand 상태 관리
└── hooks/
    └── use-page-context.ts            # 페이지 컨텍스트 수집
```

### UI 흐름

1. **Floating Button 클릭** → Mini Overlay 열림
2. **Mini Overlay에서 대화** → 실시간 스트리밍 응답
3. **"확장하기" 버튼 클릭** → Full Workspace로 전환
4. **Full Workspace** → 사고 과정, 작업 계획, 실행 로그, 결과 탭 제공

---

## 필수 API 스펙

### 1. SSE 스트리밍 엔드포인트

#### 요청

```http
POST /api/aura/test/stream
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}
X-Tenant-ID: {TENANT_ID}

{
  "prompt": "현재 페이지를 요약해줘",
  "context": {
    "url": "https://example.com/mail/inbox",
    "pathname": "/mail/inbox",
    "title": "Mail Inbox",
    "activeApp": "mail",
    "selectedItemIds": ["msg-123", "msg-456"],
    "metadata": {
      "screen": "inbox",
      "filters": { "status": "unread" }
    }
  }
}
```

#### 응답 (SSE 스트림)

```
Content-Type: text/event-stream
Transfer-Encoding: chunked

data: {"type":"thought","content":"사용자 요청을 분석하고 있습니다...","thoughtType":"analysis","sources":[{"type":"code","name":"mail/inbox.tsx","path":"apps/mail/src/pages/inbox.tsx"},{"type":"conversation","name":"이전 대화"}]}

data: {"type":"thinking","content":"현재 페이지의 React 컴포넌트 구조를 파악 중..."}

data: {"type":"plan_step","title":"1. 페이지 구조 분석","description":"현재 메일 인박스의 컴포넌트 구조를 분석합니다.","order":0,"confidence":0.9}

data: {"type":"plan_step","title":"2. 주요 기능 추출","description":"읽지 않은 메일 필터링, 정렬 기능 등을 추출합니다.","order":1,"confidence":0.85}

data: {"type":"plan_step_update","id":"plan-step-123","status":"executing","description":"분석을 시작합니다."}

data: {"type":"tool_execution","tool":"code_analyzer","params":{"file":"apps/mail/src/pages/inbox.tsx"},"status":"executing"}

data: {"type":"tool_execution","tool":"code_analyzer","params":{"file":"apps/mail/src/pages/inbox.tsx"},"result":"Found 3 main components: MailList, FilterBar, SearchBox","status":"completed"}

data: {"type":"timeline_step_update","id":"timeline-step-123","status":"completed","title":"코드 분석 완료"}

data: {"type":"hitl","data":{"requestId":"hitl-1234567890","message":"메일 3개를 삭제하시겠습니까?","actionType":"delete_emails","params":{"ids":["msg-123","msg-456","msg-789"]},"confidence":0.7,"editableContent":"메일 3개를 삭제하시겠습니까?"}}

data: {"type":"content","content":"현재 페이지는 메일 인박스 화면입니다.\n\n**주요 기능:**\n- 읽지 않은 메일 필터링\n- 메일 목록 표시\n- 검색 기능","metadata":{"result":{"type":"text","content":"분석 결과","title":"페이지 분석 결과"}}}

data: [DONE]
```

### 2. SSE 응답 타입 상세

#### `thought` / `thinking`
AI의 사고 과정을 실시간으로 전달합니다.

```json
{
  "type": "thought" | "thinking",
  "content": "사용자 요청을 분석하고 있습니다...",
  "thoughtType": "analysis" | "planning" | "execution" | "verification",
  "sources": [
    {
      "type": "code" | "conversation" | "metadata",
      "name": "mail/inbox.tsx",
      "path": "apps/mail/src/pages/inbox.tsx"  // code 타입일 때만
    }
  ]
}
```

#### `plan_step`
작업 계획의 각 단계를 전달합니다.

```json
{
  "type": "plan_step",
  "title": "1. 페이지 구조 분석",
  "description": "현재 메일 인박스의 컴포넌트 구조를 분석합니다.",
  "order": 0,
  "confidence": 0.9,  // 0.0 ~ 1.0
  "canSkip": false
}
```

#### `plan_step_update`
작업 계획 단계의 상태를 업데이트합니다. (선택)

```json
{
  "type": "plan_step_update",
  "id": "plan-step-123",  // 프론트엔드가 생성한 plan_step의 id
  "status": "pending" | "approved" | "skipped" | "executing" | "completed" | "failed",
  "description": "업데이트된 설명",
  "confidence": 0.85
}
```

**참고**: `id`는 프론트엔드가 `plan_step` 이벤트를 받을 때 생성한 ID와 일치해야 합니다. 백엔드가 `plan_step` 이벤트에 `id` 필드를 포함하여 전송하는 것을 권장합니다.

#### `tool_execution`
도구 실행 정보를 전달합니다.

```json
{
  "type": "tool_execution" | "action",
  "tool": "code_analyzer" | "git_diff" | "jira_create" | "mail_send" | ...,
  "params": {
    "file": "apps/mail/src/pages/inbox.tsx",
    "operation": "analyze"
  },
  "status": "executing" | "completed" | "failed",
  "result": "Found 3 main components...",  // completed일 때
  "error": "File not found"  // failed일 때
}
```

#### `hitl` / `approval_required`
사용자 승인이 필요한 작업입니다.

```json
{
  "type": "hitl" | "approval_required",
  "message": "메일 3개를 삭제하시겠습니까?",
  "action": "delete_emails",
  "params": {
    "ids": ["msg-123", "msg-456", "msg-789"]
  },
  "confidence": 0.7,  // 신뢰도가 낮을수록 승인 필요
  "editableContent": "메일 3개를 삭제하시겠습니까?",  // 사용자가 수정 가능한 텍스트
  "stepId": "plan-step-123"  // 관련된 plan_step의 ID
}
```

**중요**: `hitl` 타입이 전달되면 프론트엔드는 스트리밍을 일시 중지하고 사용자 승인을 기다립니다.

#### `content` / `message`
최종 응답 텍스트입니다.

```json
{
  "type": "content",
  "content": "현재 페이지는 메일 인박스 화면입니다.\n\n**주요 기능:**\n..."
}
```

또는 간단한 형식:

```json
{
  "type": "message",
  "message": "작업이 완료되었습니다."
}
```

**결과 메타데이터 포함 형식** (결과 탭에 표시):

```json
{
  "type": "content",
  "content": "코드 분석이 완료되었습니다.",
  "metadata": {
    "result": {
      "type": "diff" | "preview" | "checklist" | "text",
      "content": "...",
      "title": "코드 변경사항"
    }
  }
}
```

**중요**: `metadata.result`가 포함된 `content` 이벤트는 마지막 `content` 이벤트여야 합니다. 프론트엔드는 스트리밍 종료 시 마지막 `content` 이벤트의 `metadata.result`를 메시지에 저장합니다.

### 3. HITL 승인 처리 API

#### 승인 요청

```http
POST /api/aura/hitl/approve/{requestId}
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}
X-Tenant-ID: {TENANT_ID}
X-User-ID: {USER_ID}

{
  "userId": "{USER_ID}"
}
```

**참고**: 프론트엔드는 `requestId`를 URL 경로에 포함하고, body에 `userId`만 전달합니다.

#### 승인 응답

```json
{
  "status": "SUCCESS",
  "message": "승인이 완료되었습니다.",
  "data": {
    "requestId": "hitl-1234567890",
    "action": "delete_emails",
    "result": "2개의 메일이 삭제되었습니다."
  }
}
```

#### 거절 요청

```http
POST /api/aura/hitl/reject/{requestId}
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}
X-Tenant-ID: {TENANT_ID}
X-User-ID: {USER_ID}

{
  "userId": "{USER_ID}",
  "reason": "사용자가 취소함"  // 선택
}
```

**참고**: 프론트엔드는 `requestId`를 URL 경로에 포함하고, body에 `userId`와 선택적으로 `reason`을 전달합니다.

### 4. 컨텍스트 정보

프론트엔드는 모든 요청에 다음 컨텍스트 정보를 자동으로 포함합니다:

```typescript
{
  "url": "https://example.com/mail/inbox?filter=unread",
  "pathname": "/mail/inbox",
  "title": "Mail Inbox - DWP",
  "activeApp": "mail",  // 현재 활성화된 Remote App 이름
  "selectedItemIds": ["msg-123", "msg-456"],  // 사용자가 선택한 항목 ID들
  "metadata": {
    "screen": "inbox",
    "filters": { "status": "unread" },
    "timestamp": "2026-01-15T10:30:00Z"
  }
}
```

---

## 데이터 모델

### ThoughtChain

```typescript
{
  id: string;
  type: 'analysis' | 'planning' | 'execution' | 'verification';
  content: string;
  timestamp: Date;
  sources?: Array<{
    type: 'code' | 'conversation' | 'metadata';
    name: string;
    path?: string;  // code 타입일 때만
  }>;
}
```

### PlanStep

```typescript
{
  id: string;
  title: string;
  description: string;
  order: number;
  canSkip: boolean;
  status: 'pending' | 'approved' | 'skipped' | 'executing' | 'completed' | 'failed';
  confidence?: number;  // 0.0 ~ 1.0
}
```

### ExecutionLog

```typescript
{
  id: string;
  timestamp: Date;
  type: 'command' | 'api' | 'info' | 'error' | 'success';
  content: string;
  metadata?: Record<string, any>;
}
```

### HitlRequest

```typescript
{
  id: string;
  stepId: string;  // 관련된 plan_step의 ID
  message: string;
  action: string;
  params: Record<string, any>;
  timestamp: Date;
  confidence?: number;  // 0.0 ~ 1.0
  editableContent?: string;  // 사용자가 수정 가능한 텍스트
}
```

### ContextSnapshot

```typescript
{
  url: string;
  title: string;
  screenshot?: string;  // 향후 구현 예정
  metadata?: Record<string, any>;
  timestamp: Date;
}
```

---

## UI 컴포넌트 구조

### 1. AuraFloatingButton

- **위치**: 우측 하단 고정
- **이미지**: `public/assets/images/arua.gif`
- **기능**: 
  - 클릭 시 Mini Overlay 토글
  - AI가 "생각 중"일 때 펄스 애니메이션
  - 알림 배지 표시

### 2. AuraMiniOverlay

- **위치**: 우측 하단 슬라이드 (360px 너비)
- **기능**:
  - 실시간 채팅 인터페이스
  - "요약", "추천" 퀵 액션 버튼
  - "확장하기" 버튼 → Full Workspace로 이동
  - 진행 중인 타임라인 단계 표시

### 3. AI Workspace (Full Page)

- **경로**: `/ai-workspace`
- **레이아웃**: 
  - 좌측 40%: 채팅 패널
  - 우측 60%: 탭 패널 (사고 과정, 작업 계획, 실행 로그, 결과)
  - 오른쪽 사이드바: 컨텍스트 스냅샷 (선택적)

### 4. ThoughtChainUI

- **기능**: AI의 사고 과정을 타임라인으로 시각화
- **표시 정보**:
  - 사고 타입 (분석, 계획, 실행, 검증)
  - 사고 내용
  - 참고 자료 (코드, 대화, 메타데이터) 칩

### 5. DynamicPlanBoard

- **기능**: 작업 계획을 단계별로 표시
- **인터랙션**:
  - 드래그 앤 드롭으로 단계 순서 변경
  - 각 단계별 승인/건너뛰기 버튼
  - 신뢰도 표시

### 6. LiveExecutionLog

- **위치**: 화면 하단 고정
- **스타일**: 터미널 스타일 (다크 배경, 모노스페이스 폰트)
- **기능**: 실시간 실행 로그 표시 (API 호출, 명령어 실행 등)

### 7. CheckpointApproval

- **기능**: HITL 승인 다이얼로그
- **특징**:
  - 작업 내용 인라인 수정 가능
  - 신뢰도 표시
  - 파라미터 JSON 표시

### 8. ConfidenceScore

- **기능**: AI 신뢰도 시각화
- **표시**:
  - 신뢰도 퍼센트 (0-100%)
  - 색상 코딩 (높음: 초록, 보통: 노랑, 낮음: 빨강)
  - 신뢰도가 낮을 경우 추가 정보 요청 버튼

---

## 상태 관리

### Zustand Store (`use-aura-store.ts`)

주요 상태:

```typescript
{
  isOverlayOpen: boolean;           // Mini Overlay 열림/닫힘
  messages: AgentMessage[];         // 대화 기록
  isStreaming: boolean;              // 스트리밍 중 여부
  isThinking: boolean;              // AI가 사고 중인지 여부
  thoughtChains: ThoughtChain[];   // 사고 과정 체인
  planSteps: PlanStep[];            // 작업 계획 단계들
  executionLogs: ExecutionLog[];    // 실행 로그
  actionExecutions: ActionExecution[];  // 도구 실행 기록
  pendingHitl: HitlRequest | null;  // 대기 중인 승인 요청
  contextSnapshot: ContextSnapshot | null;  // 컨텍스트 스냅샷
  isExpanding: boolean;             // 확장 애니메이션 중 여부
  returnPath: string | null;        // Full Workspace에서 돌아갈 경로
}
```

---

## 통신 프로토콜

### SSE 스트림 파싱

프론트엔드는 다음과 같이 SSE 스트림을 파싱합니다:

```typescript
const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = '';
let accumulatedText = '';
let lastResultMetadata = null; // 결과 메타데이터 추적

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';  // 불완전한 라인은 버퍼에 보관

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

    const dataStr = trimmedLine.slice(6);
    if (dataStr === '[DONE]') break;

    try {
      const data = JSON.parse(dataStr);
      // data.type에 따라 처리
    } catch (e) {
      // 불완전한 JSON은 무시하고 다음 청크에서 처리
    }
  }
}
```

### HITL 플로우

1. 백엔드가 `hitl` 타입 이벤트 전송
2. 프론트엔드가 스트리밍 일시 중지
3. 사용자가 승인/거절 선택
4. 승인 시: `/api/aura/hitl/approve` 호출 후 스트리밍 재개
5. 거절 시: `/api/aura/hitl/reject` 호출 후 스트리밍 종료

---

## 백엔드 구현 가이드

### 1. SSE 엔드포인트 구현

**엔드포인트**: `GET /api/aura/test/stream?message={message}` 또는 `POST /api/aura/test/stream`

**현재 프론트엔드 구현**: POST 방식을 사용하며, body에 `prompt`와 `context`를 포함합니다.
백엔드가 GET 방식을 요구하는 경우, 쿼리 파라미터로 메시지를 전달하도록 수정 가능합니다.

**필수 헤더**:
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `Authorization: Bearer {JWT_TOKEN}`
- `X-Tenant-ID: {TENANT_ID}`

**응답 형식**:
```
event: {type}
data: {JSON_OBJECT}\n\n
```

또는 간단한 형식:
```
data: {JSON_OBJECT}\n\n
```

각 이벤트는 `\n\n`으로 구분되어야 합니다.

### 2. 응답 타입 우선순위

1. **`thought` / `thinking`**: 사고 과정 (가장 먼저 전송)
2. **`plan_step`**: 작업 계획 단계들
3. **`tool_execution`**: 도구 실행 정보
4. **`hitl`**: 승인 요청 (필요 시)
5. **`content` / `message`**: 최종 응답

### 3. 컨텍스트 활용

프론트엔드가 전달하는 컨텍스트 정보를 활용하여:
- 현재 페이지의 기능 파악
- 선택된 항목에 대한 작업 수행
- 관련 파일/코드 자동 참조

### 4. 신뢰도 계산

각 작업 단계와 HITL 요청에 `confidence` 값을 포함:
- **0.8 이상**: 높은 신뢰도 (승인 없이 진행 가능)
- **0.5 ~ 0.8**: 보통 신뢰도 (사용자 확인 권장)
- **0.5 미만**: 낮은 신뢰도 (반드시 승인 필요)

### 5. 소스 어트리뷰션

`thought` 이벤트에 `sources` 배열을 포함하여:
- 참고한 코드 파일 경로
- 이전 대화 내용
- 메타데이터 정보

### 6. 에러 처리

에러 발생 시:

```json
{
  "type": "error",
  "message": "파일을 찾을 수 없습니다.",
  "code": "FILE_NOT_FOUND"
}
```

또는 `tool_execution`에서:

```json
{
  "type": "tool_execution",
  "tool": "code_analyzer",
  "status": "failed",
  "error": "File not found: apps/mail/src/pages/inbox.tsx"
}
```

---

## Aura Platform 연동 가이드

### 1. Gateway → Aura Platform 통신

Gateway는 프론트엔드로부터 받은 요청을 Aura Platform으로 전달하고, Aura Platform의 응답을 SSE 스트림으로 변환하여 프론트엔드에 전달합니다.

### 2. Aura Platform 응답 형식

Aura Platform은 다음과 같은 형식으로 응답해야 합니다:

```json
{
  "event_type": "thought" | "plan_step" | "tool_execution" | "hitl" | "content",
  "data": {
    // 각 이벤트 타입에 맞는 데이터
  },
  "metadata": {
    "confidence": 0.9,
    "sources": [...],
    "timestamp": "2026-01-15T10:30:00Z"
  }
}
```

### 3. 도구 실행 인터페이스

Aura Platform에서 사용 가능한 도구들:

- `code_analyzer`: 코드 분석
- `git_diff`: Git diff 생성
- `jira_create`: Jira 이슈 생성
- `mail_send`: 메일 발송
- `file_read`: 파일 읽기
- `file_write`: 파일 쓰기
- 기타 비즈니스 로직 도구들

각 도구 실행 시 `tool_execution` 이벤트를 전송해야 합니다.

---

## 보안 고려사항

1. **인증**: 모든 요청에 JWT 토큰 필수
2. **테넌트 격리**: `X-Tenant-ID` 헤더로 테넌트별 데이터 격리
3. **HITL 필수 작업**: 다음 작업은 반드시 승인 필요
   - 파일 삭제
   - 데이터베이스 수정
   - 외부 API 호출 (메일 발송 등)
   - Git Push
4. **컨텍스트 제한**: 민감한 정보는 컨텍스트에서 제외

---

## 향후 개선 사항

1. **스크린샷 캡처**: ContextSnapshot에 실제 화면 스크린샷 포함
2. **대화 기록 저장**: 서버에 대화 기록 영구 저장
3. **멀티 모달 지원**: 이미지, 파일 업로드 등
4. **음성 입력**: 음성으로 대화 가능
5. **협업 기능**: 여러 사용자가 동시에 AI와 협업

---

## 문의 및 지원

프론트엔드 구현 관련 문의:
- Repository: `dwp-frontend`
- 주요 파일: `apps/dwp/src/components/aura/`, `apps/dwp/src/store/use-aura-store.ts`

백엔드/Aura Platform 구현 관련 문의:
- Gateway API: `/api/aura/test/stream`, `/api/aura/hitl/approve`, `/api/aura/hitl/reject`
- 상세 API 스펙: `docs/BACKEND_API_SPEC.md` 참조
- Aura Platform: 별도 문서 참조

---

**문서 버전**: 1.2  
**최종 업데이트**: 2026-01-16  
**작성자**: DWP Frontend Team

---

## 백엔드 통합 상태

### ✅ 구현 완료

1. **HITL 승인/거절 API**: `libs/shared-utils/src/agent/hitl-api.ts`에 `approveHitlRequest`, `rejectHitlRequest`, `getHitlRequest` 함수 구현 완료
2. **사용자 ID 관리**: `libs/shared-utils/src/auth/user-id-storage.ts`에서 JWT 토큰에서 자동 추출 및 localStorage 저장
3. **SSE 이벤트 파싱**: `event:` 및 `data:` 형식 모두 지원
4. **이벤트 핸들러**: 
   - `plan_step_update` 이벤트 핸들러 추가 (작업 계획 단계 상태 업데이트)
   - `timeline_step_update` 이벤트 핸들러 추가 (타임라인 단계 상태 업데이트)
5. **결과 메타데이터 추적**: `lastResultMetadata` 상태를 통해 결과 탭에 표시할 메타데이터 추적
6. **에러 처리**: 백엔드 `ApiResponse` 형식에 맞춘 에러 처리

### ⚠️ 주의사항

1. **SSE 스트리밍 방식**: 
   - 백엔드 문서는 `GET /api/aura/test/stream?message={message}`를 권장하지만,
   - 현재 프론트엔드는 `POST` 방식을 사용하여 `context` 정보를 전달합니다.
   - 백엔드가 GET만 지원하는 경우, 코드 내 주석을 참조하여 GET 방식으로 변경 가능합니다.

2. **사용자 ID**:
   - 로그인 시 JWT 토큰에서 자동 추출됩니다 (`sub`, `userId`, `user_id` 필드 확인).
   - 추출 실패 시 HITL API 호출이 실패할 수 있으므로, 백엔드가 사용자 ID를 응답에 포함하는 것을 권장합니다.

3. **HITL requestId**:
   - 백엔드에서 전달하는 `requestId`를 그대로 사용합니다.
   - 프론트엔드가 생성한 임시 ID(`hitl-${timestamp}`)는 백엔드 `requestId`로 교체됩니다.
