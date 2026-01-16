# Aura AI 프론트엔드-백엔드 통합 스펙서

> **대상**: 백엔드 개발팀, Aura Platform 개발팀  
> **최종 업데이트**: 2026-01-16  
> **프론트엔드 버전**: v1.0

---

## 📋 개요

이 문서는 Aura AI UI가 정상적으로 동작하기 위해 백엔드에서 구현해야 하는 모든 API 및 SSE 이벤트 스펙을 정의합니다.

프론트엔드는 다음 4개의 탭으로 AI의 작업 과정을 시각화합니다:
1. **사고 과정** (Thought Process): AI의 내부 사고 체인
2. **작업 계획** (Work Plan): 단계별 실행 계획
3. **실행 로그** (Execution Log): 도구 실행 기록
4. **결과** (Results): 최종 결과물

---

## 🔄 SSE 스트리밍 엔드포인트

### 엔드포인트

**현재 프론트엔드 구현**: `POST /api/aura/test/stream`

**요청 형식**:
```http
POST /api/aura/test/stream
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}
X-Tenant-ID: {TENANT_ID}

{
  "prompt": "사용자 질문",
  "context": {
    "url": "http://localhost:4200/mail",
    "path": "/mail",
    "title": "메일 인박스",
    "activeApp": "mail",
    "itemId": "msg-123",
    "metadata": {
      "headings": ["받은 메일함", "중요 메일"],
      "hasTables": true,
      "tableCount": 1
    }
  }
}
```

**응답 형식**: `text/event-stream`

각 이벤트는 다음 형식 중 하나를 따릅니다:

```
event: {type}
data: {JSON_OBJECT}\n\n
```

또는 간단한 형식:

```
data: {JSON_OBJECT}\n\n
```

스트림 종료:

```
data: [DONE]\n\n
```

---

## 📡 필수 SSE 이벤트 타입

### 1. `thought` / `thinking` (사고 과정)

**용도**: AI의 내부 사고 과정을 실시간으로 전달하여 "사고 과정" 탭에 표시

**이벤트 형식**:
```json
{
  "type": "thought" | "thinking",
  "thoughtType": "analysis" | "planning" | "execution" | "verification",
  "content": "사용자 요청을 분석하고 있습니다...",
  "sources": [
    {
      "type": "code" | "conversation" | "metadata",
      "name": "mail/inbox.tsx",
      "path": "apps/mail/src/pages/inbox.tsx"
    }
  ]
}
```

**프론트엔드 처리**:
- `ThoughtChainUI` 컴포넌트에 타임라인으로 표시
- `type`에 따라 아이콘 및 색상 변경
- `sources` 배열을 칩 형태로 표시

**필수 필드**:
- ✅ `type`: "thought" 또는 "thinking"
- ✅ `content`: 사고 내용 (문자열)
- ⚠️ `thoughtType`: "analysis", "planning", "execution", "verification" 중 하나 (없으면 "analysis"로 기본값)
- ⚠️ `sources`: 참고 자료 배열 (선택, 없으면 표시 안 함)

---

### 2. `plan_step` (작업 계획)

**용도**: AI가 수립한 작업 계획의 각 단계를 "작업 계획" 탭에 표시

**이벤트 형식**:
```json
{
  "type": "plan_step",
  "title": "1. 페이지 구조 분석",
  "description": "현재 메일 인박스의 컴포넌트 구조를 분석합니다.",
  "order": 0,
  "canSkip": false,
  "confidence": 0.9
}
```

**프론트엔드 처리**:
- `DynamicPlanBoard` 컴포넌트에 카드 형태로 표시
- `order` 필드로 정렬
- 사용자가 순서 변경, 승인, 건너뛰기 가능
- `confidence`가 낮으면 경고 색상 표시

**필수 필드**:
- ✅ `type`: "plan_step"
- ✅ `title`: 단계 제목
- ✅ `description`: 단계 설명
- ✅ `order`: 순서 (0부터 시작, 정수)
- ⚠️ `canSkip`: 건너뛰기 가능 여부 (기본값: false)
- ⚠️ `confidence`: 신뢰도 (0.0 ~ 1.0, 기본값: 없음)

**상태 업데이트 이벤트** (선택):
```json
{
  "type": "plan_step_update",
  "id": "plan-step-123",
  "status": "pending" | "approved" | "skipped" | "executing" | "completed" | "failed",
  "description": "업데이트된 설명",
  "confidence": 0.85
}
```

---

### 3. `tool_execution` / `action` (도구 실행)

**용도**: AI가 실행하는 도구(Git, Jira, Code Analyzer 등)의 실행 상태를 "실행 로그" 탭에 표시

**이벤트 형식** (실행 시작):
```json
{
  "type": "tool_execution" | "action",
  "tool": "code_analyzer" | "git_diff" | "jira_create" | "mail_send" | ...,
  "params": {
    "file": "apps/mail/src/pages/inbox.tsx",
    "operation": "analyze"
  },
  "status": "executing"
}
```

**이벤트 형식** (실행 완료):
```json
{
  "type": "tool_execution" | "action",
  "tool": "code_analyzer",
  "params": {
    "file": "apps/mail/src/pages/inbox.tsx"
  },
  "status": "completed",
  "result": "Found 3 main components: MailList, FilterBar, SearchBox"
}
```

**이벤트 형식** (실행 실패):
```json
{
  "type": "tool_execution" | "action",
  "tool": "code_analyzer",
  "params": {
    "file": "apps/mail/src/pages/inbox.tsx"
  },
  "status": "failed",
  "error": "File not found"
}
```

**프론트엔드 처리**:
- `ActionExecutionView` 컴포넌트에 로그 형태로 표시
- `LiveExecutionLog` 컴포넌트에 터미널 스타일로 표시
- `status`에 따라 색상 변경 (executing: 노랑, completed: 초록, failed: 빨강)

**필수 필드**:
- ✅ `type`: "tool_execution" 또는 "action"
- ✅ `tool`: 도구 이름 (문자열)
- ✅ `params`: 도구 파라미터 (객체)
- ✅ `status`: "executing" | "completed" | "failed"
- ⚠️ `result`: 실행 결과 (completed일 때)
- ⚠️ `error`: 에러 메시지 (failed일 때)

**주의사항**:
- 같은 `tool`과 `params` 조합에 대해 실행 시작 → 완료/실패 순서로 전송해야 함
- 프론트엔드는 실행 시작 시 `status: "executing"`으로 추가하고, 완료/실패 시 업데이트함

---

### 4. `hitl` / `approval_required` (승인 요청)

**용도**: 중요한 작업 전 사용자 승인을 요청하여 "CheckpointApproval" 다이얼로그 표시

**이벤트 형식**:
```json
{
  "type": "hitl" | "approval_required",
  "data": {
    "requestId": "hitl-1234567890",
    "message": "메일 3개를 삭제하시겠습니까?",
    "actionType": "delete_emails",
    "params": {
      "ids": ["msg-123", "msg-456", "msg-789"]
    },
    "confidence": 0.7,
    "editableContent": "메일 3개를 삭제하시겠습니까?"
  }
}
```

또는 간단한 형식:
```json
{
  "type": "hitl",
  "requestId": "hitl-1234567890",
  "message": "메일 3개를 삭제하시겠습니까?",
  "action": "delete_emails",
  "params": {
    "ids": ["msg-123", "msg-456", "msg-789"]
  },
  "confidence": 0.7,
  "editableContent": "메일 3개를 삭제하시겠습니까?"
}
```

**프론트엔드 처리**:
- `CheckpointApproval` 다이얼로그 표시
- 스트리밍 일시 중지 (사용자 승인 대기)
- 사용자가 승인/거절 시 `/api/aura/hitl/approve/{requestId}` 또는 `/api/aura/hitl/reject/{requestId}` 호출

**필수 필드**:
- ✅ `type`: "hitl" 또는 "approval_required"
- ✅ `requestId`: 고유한 요청 ID (문자열)
- ✅ `message`: 사용자에게 표시할 메시지
- ✅ `action` 또는 `actionType`: 실행할 액션 이름
- ✅ `params`: 액션 파라미터 (객체)
- ⚠️ `confidence`: 신뢰도 (0.0 ~ 1.0, 없으면 표시 안 함)
- ⚠️ `editableContent`: 사용자가 수정 가능한 텍스트 (없으면 `message` 사용)

**중요**:
- `hitl` 이벤트가 전송되면 프론트엔드는 스트리밍을 일시 중지합니다.
- 사용자가 승인/거절할 때까지 스트리밍이 재개되지 않습니다.
- 승인 후 백엔드는 스트리밍을 계속 진행해야 합니다.

---

### 5. `content` / `message` (최종 응답)

**용도**: AI의 최종 응답 텍스트를 채팅창에 표시

**이벤트 형식**:
```json
{
  "type": "content",
  "content": "현재 페이지는 메일 인박스 화면입니다.\n\n**주요 기능:**\n- 읽지 않은 메일 필터링\n- 메일 목록 표시\n- 검색 기능"
}
```

또는 간단한 형식:
```json
{
  "type": "message",
  "message": "작업이 완료되었습니다."
}
```

**결과물 포함 형식** (결과 탭에 표시):
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

**중요**: `metadata.result`가 포함된 `content` 이벤트는 마지막 `content` 이벤트여야 합니다.
프론트엔드는 스트리밍 종료 시 마지막 `content` 이벤트의 `metadata.result`를 메시지에 저장합니다.

**프론트엔드 처리**:
- 채팅창에 스트리밍 텍스트로 표시
- `metadata.result`가 있으면 "결과" 탭에 `ResultViewer`로 표시

**필수 필드**:
- ✅ `type`: "content" 또는 "message"
- ✅ `content` 또는 `message`: 응답 텍스트
- ⚠️ `metadata.result`: 결과 객체 (선택)

**결과 타입별 형식**:

1. **diff** (코드 변경사항):
```json
{
  "type": "diff",
  "content": "--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,4 @@\n...",
  "title": "코드 변경사항"
}
```

2. **preview** (문서 프리뷰):
```json
{
  "type": "preview",
  "content": "문서 내용 또는 HTML",
  "title": "문서 프리뷰"
}
```

3. **checklist** (체크리스트):
```json
{
  "type": "checklist",
  "content": [
    { "label": "작업 1", "checked": true },
    { "label": "작업 2", "checked": false }
  ],
  "title": "작업 체크리스트"
}
```

4. **text** (일반 텍스트, 기본값):
```json
{
  "type": "text",
  "content": "일반 텍스트 결과",
  "title": "결과"
}
```

---

### 6. `timeline_step_update` (타임라인 단계 업데이트)

**용도**: "사고 과정" 탭의 실행 타임라인 단계 상태 업데이트

**이벤트 형식**:
```json
{
  "type": "timeline_step_update",
  "id": "timeline-step-123",
  "status": "pending" | "processing" | "completed" | "failed",
  "title": "업데이트된 제목",
  "description": "업데이트된 설명"
}
```

**프론트엔드 처리**:
- `ReasoningTimeline` 컴포넌트의 해당 단계 상태 업데이트
- `status`에 따라 아이콘 및 색상 변경

**필수 필드**:
- ✅ `type`: "timeline_step_update"
- ✅ `id`: 타임라인 단계 ID (문자열)
- ✅ `status`: "pending" | "processing" | "completed" | "failed"
- ⚠️ `title`: 업데이트된 제목 (선택)
- ⚠️ `description`: 업데이트된 설명 (선택)

**참고**:
- 프론트엔드는 초기에 타임라인 단계를 생성하지만, 백엔드가 `timeline_step_update`를 보내면 상태를 업데이트합니다.
- `id`는 프론트엔드가 생성한 ID와 일치해야 합니다.

---

## 🔐 HITL 승인/거절 API

### 승인 요청

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

**응답 형식**:
```json
{
  "status": "SUCCESS",
  "message": "Request approved successfully",
  "data": {
    "requestId": "hitl-1234567890",
    "sessionId": "session-abc",
    "status": "approved"
  },
  "success": true,
  "timestamp": "2026-01-16T12:00:00"
}
```

**중요**:
- 승인 후 백엔드는 SSE 스트리밍을 재개해야 합니다.
- 프론트엔드는 승인 후 스트리밍 상태를 `true`로 설정하고 대기합니다.

---

### 거절 요청

```http
POST /api/aura/hitl/reject/{requestId}
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}
X-Tenant-ID: {TENANT_ID}
X-User-ID: {USER_ID}

{
  "userId": "{USER_ID}",
  "reason": "사용자가 작업을 거부했습니다."
}
```

**응답 형식**:
```json
{
  "status": "SUCCESS",
  "message": "Request rejected",
  "data": {
    "requestId": "hitl-1234567890",
    "sessionId": "session-abc",
    "status": "rejected",
    "reason": "사용자가 작업을 거부했습니다."
  },
  "success": true,
  "timestamp": "2026-01-16T12:00:00"
}
```

**중요**:
- 거절 후 백엔드는 스트리밍을 종료하거나 에러 메시지를 전송해야 합니다.
- 프론트엔드는 거절 후 스트리밍 상태를 `false`로 설정합니다.

---

## 📊 UI 탭별 데이터 요구사항

### 탭 1: 사고 과정 (Thought Process)

**표시 컴포넌트**: `ThoughtChainUI`, `ReasoningTimeline`

**필요한 이벤트**:
1. ✅ `thought` / `thinking`: 사고 체인 추가
2. ✅ `timeline_step_update`: 타임라인 단계 상태 업데이트

**데이터 구조**:
- `ThoughtChain`: `type`, `content`, `sources`, `timestamp`
- `TimelineStep`: `id`, `title`, `description`, `status`, `timestamp`

**검증 체크리스트**:
- [ ] `thought` 이벤트가 전송되면 사고 과정 탭에 타임라인으로 표시되는가?
- [ ] `thoughtType`에 따라 아이콘 및 색상이 올바르게 변경되는가?
- [ ] `sources` 배열이 칩 형태로 표시되는가?
- [ ] `timeline_step_update`로 단계 상태가 업데이트되는가?

---

### 탭 2: 작업 계획 (Work Plan)

**표시 컴포넌트**: `DynamicPlanBoard`

**필요한 이벤트**:
1. ✅ `plan_step`: 계획 단계 추가
2. ⚠️ `plan_step_update`: 계획 단계 상태 업데이트 (선택)

**데이터 구조**:
- `PlanStep`: `id`, `title`, `description`, `order`, `canSkip`, `status`, `confidence`

**검증 체크리스트**:
- [ ] `plan_step` 이벤트가 전송되면 작업 계획 탭에 카드로 표시되는가?
- [ ] `order` 필드로 올바르게 정렬되는가?
- [ ] `confidence`가 낮으면 경고 색상이 표시되는가?
- [ ] 사용자가 순서 변경, 승인, 건너뛰기를 할 수 있는가?
- [ ] `plan_step_update`로 상태가 업데이트되는가?

---

### 탭 3: 실행 로그 (Execution Log)

**표시 컴포넌트**: `ActionExecutionView`, `LiveExecutionLog`

**필요한 이벤트**:
1. ✅ `tool_execution` / `action`: 도구 실행 기록 추가
2. ✅ `executionLog`: 일반 로그 메시지 (선택, 프론트엔드가 자동 생성)

**데이터 구조**:
- `ActionExecution`: `id`, `tool`, `params`, `status`, `result`, `error`, `timestamp`
- `ExecutionLog`: `id`, `type`, `content`, `timestamp`

**검증 체크리스트**:
- [ ] `tool_execution` 이벤트가 전송되면 실행 로그 탭에 표시되는가?
- [ ] `status: "executing"`일 때 노란색으로 표시되는가?
- [ ] `status: "completed"`일 때 초록색으로 표시되는가?
- [ ] `status: "failed"`일 때 빨간색으로 표시되는가?
- [ ] `LiveExecutionLog`에 터미널 스타일로 실시간 표시되는가?
- [ ] `params`와 `result`가 JSON 형태로 표시되는가?

---

### 탭 4: 결과 (Results)

**표시 컴포넌트**: `ResultViewer`

**필요한 이벤트**:
1. ✅ `content` / `message`: 최종 응답 (필수)
2. ⚠️ `metadata.result`: 결과 객체 (선택)

**데이터 구조**:
- `Result`: `type` ("diff" | "preview" | "checklist" | "text"), `content`, `title`

**검증 체크리스트**:
- [ ] `content` 이벤트가 전송되면 채팅창에 표시되는가?
- [ ] `metadata.result`가 있으면 결과 탭에 표시되는가?
- [ ] `type: "diff"`일 때 코드 하이라이팅이 적용되는가?
- [ ] `type: "checklist"`일 때 체크박스 리스트로 표시되는가?
- [ ] `type: "preview"`일 때 문서 프리뷰로 표시되는가?

---

## 🔄 실시간 스트리밍 처리 플로우

### 정상 플로우

```
1. 사용자 질문 전송
   ↓
2. 백엔드: thought 이벤트 전송 (사고 과정 탭 업데이트)
   ↓
3. 백엔드: plan_step 이벤트들 전송 (작업 계획 탭 업데이트)
   ↓
4. 백엔드: tool_execution 이벤트 전송 (status: "executing")
   ↓
5. 백엔드: tool_execution 이벤트 전송 (status: "completed" 또는 "failed")
   ↓
6. 백엔드: content 이벤트 전송 (채팅창 및 결과 탭 업데이트)
   ↓
7. 백엔드: data: [DONE] 전송 (스트리밍 종료)
```

### HITL 플로우

```
1. 사용자 질문 전송
   ↓
2. 백엔드: thought, plan_step 이벤트들 전송
   ↓
3. 백엔드: hitl 이벤트 전송
   ↓
4. 프론트엔드: 스트리밍 일시 중지, 승인 다이얼로그 표시
   ↓
5. 사용자 승인/거절
   ↓
6-1. 승인: POST /api/aura/hitl/approve/{requestId}
      → 백엔드: 스트리밍 재개, tool_execution 이벤트들 전송
   ↓
6-2. 거절: POST /api/aura/hitl/reject/{requestId}
      → 백엔드: 스트리밍 종료 또는 에러 메시지 전송
```

---

## ⚠️ 중요 주의사항

### 1. 이벤트 순서

- 이벤트는 순차적으로 전송되어야 합니다.
- `tool_execution`의 경우 `status: "executing"` → `status: "completed"` 순서로 전송해야 합니다.

### 2. 이벤트 ID 관리

- `plan_step_update`의 `id`는 프론트엔드가 생성한 `plan_step`의 `id`와 일치해야 합니다.
- `timeline_step_update`의 `id`는 프론트엔드가 생성한 `TimelineStep`의 `id`와 일치해야 합니다.
- **권장**: 백엔드가 `plan_step` 이벤트에 `id` 필드를 포함하여 프론트엔드가 사용하도록 함

### 3. HITL 승인 후 스트리밍 재개

- 승인 API 호출 후 백엔드는 **같은 SSE 연결**에서 스트리밍을 재개해야 합니다.
- 새로운 스트림을 시작하면 안 됩니다.

### 4. 에러 처리

- 스트리밍 중 에러 발생 시 `tool_execution` 이벤트로 `status: "failed"`와 `error` 필드를 전송하거나,
- `content` 이벤트로 에러 메시지를 전송해야 합니다.

### 5. 스트림 종료

- 모든 작업이 완료되면 반드시 `data: [DONE]`을 전송해야 합니다.
- 프론트엔드는 이를 받으면 스트리밍 상태를 `false`로 설정합니다.

---

## 🧪 테스트 시나리오

### 시나리오 1: 기본 질문-응답

1. 사용자: "현재 화면을 분석해주세요"
2. 백엔드 전송:
   - `thought` 이벤트 (사고 과정)
   - `plan_step` 이벤트들 (작업 계획)
   - `tool_execution` 이벤트들 (도구 실행)
   - `content` 이벤트 (최종 응답)
   - `data: [DONE]`

**예상 결과**:
- 사고 과정 탭: 타임라인 표시
- 작업 계획 탭: 계획 카드들 표시
- 실행 로그 탭: 실행 기록 표시
- 결과 탭: 최종 응답 표시

### 시나리오 2: HITL 승인 필요

1. 사용자: "메일 3개를 삭제해주세요"
2. 백엔드 전송:
   - `thought` 이벤트
   - `plan_step` 이벤트들
   - `hitl` 이벤트 (승인 요청)
3. 프론트엔드: 승인 다이얼로그 표시, 스트리밍 일시 중지
4. 사용자 승인
5. 백엔드: `/api/aura/hitl/approve/{requestId}` 호출
6. 백엔드: 스트리밍 재개
   - `tool_execution` 이벤트들
   - `content` 이벤트
   - `data: [DONE]`

**예상 결과**:
- 승인 다이얼로그가 표시되고 사용자 승인 후 작업이 계속 진행됨

---

## 📝 체크리스트

백엔드 개발 완료 여부 확인:

### SSE 스트리밍
- [ ] `POST /api/aura/test/stream` 엔드포인트 구현
- [ ] `thought` / `thinking` 이벤트 전송
- [ ] `plan_step` 이벤트 전송
- [ ] `tool_execution` / `action` 이벤트 전송
- [ ] `hitl` / `approval_required` 이벤트 전송
- [ ] `content` / `message` 이벤트 전송
- [ ] `timeline_step_update` 이벤트 전송 (선택)
- [ ] `plan_step_update` 이벤트 전송 (선택)
- [ ] `data: [DONE]` 전송

### HITL API
- [ ] `POST /api/aura/hitl/approve/{requestId}` 구현
- [ ] `POST /api/aura/hitl/reject/{requestId}` 구현
- [ ] 승인 후 스트리밍 재개 로직 구현
- [ ] 거절 후 스트리밍 종료 로직 구현

### 데이터 형식
- [ ] 모든 이벤트가 올바른 JSON 형식으로 전송되는가?
- [ ] 필수 필드가 모두 포함되는가?
- [ ] 선택 필드가 올바르게 처리되는가?

### UI 동작
- [ ] 사고 과정 탭이 올바르게 표시되는가?
- [ ] 작업 계획 탭이 올바르게 표시되는가?
- [ ] 실행 로그 탭이 올바르게 표시되는가?
- [ ] 결과 탭이 올바르게 표시되는가?
- [ ] HITL 승인 다이얼로그가 올바르게 표시되는가?

---

## 📞 문의

프론트엔드 구현 관련 문의:
- Repository: `dwp-frontend`
- 주요 파일: 
  - `apps/dwp/src/components/aura/`
  - `apps/dwp/src/pages/ai-workspace.tsx`
  - `apps/dwp/src/store/use-aura-store.ts`

백엔드 구현 관련 문의:
- Repository: `dwp-backend`
- 문서: `dwp-backend/docs/FRONTEND_INTEGRATION_GUIDE.md`

---

**문서 버전**: 1.0  
**최종 업데이트**: 2026-01-16  
**작성자**: DWP Frontend Team
