# 프론트엔드: Finance Agent Stream API 연동 수정 요청

> **대상**: 프론트엔드 개발팀  
> **작성일**: 2026-02-06  
> **배경**: 422(요청 형식) 또는 스트림 오류 추정 — 오류 내용 미확인 상태에서 백엔드(Aura-Platform) 계약에 맞춘 수정 요청

---

## 1. API 개요

| 항목 | 값 |
|------|-----|
| **엔드포인트** | `POST /api/synapse/agent-tools/agents/finance/stream` |
| **Content-Type** | `application/json` |
| **Accept** | `text/event-stream` |

---

## 2. 요청 Body 계약 (필수)

### 2.1 허용 형식

**형식 A (권장)**

```json
{
  "prompt": "케이스 조사",
  "context": {
    "caseId": "CS-001"
  }
}
```

**형식 B (message 필드 사용)**

```json
{
  "message": "케이스 조사",
  "context": {
    "caseId": "CS-001"
  }
}
```

### 2.2 필수 조건

| 조건 | 설명 |
|------|------|
| **prompt 또는 message** | 둘 중 **하나 이상** 반드시 포함 |
| **값 길이** | 1자 이상 (공백만 있는 값 불가) |
| **빈 객체 금지** | `{}` 전송 금지 |

### 2.3 선택 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `context` | `object` | `caseId`, `documentIds`, `entityIds`, `openItemIds` 등 |
| `goal` | `string` | 목표 (예: 중복송장 의심 케이스 조사 후 조치 제안) |
| `thread_id` | `string` | 스레드 ID (재연결/이어하기용) |

---

## 3. 현재 프론트엔드 구현과의 차이

### 3.1 현재 전송 형식 (잘못됨)

```json
{ "caseId": "CS-001" }
```

- `prompt` 또는 `message` 없음 → **422 Validation Error** 가능
- `context` 객체 없이 최상위에 `caseId`만 전송

### 3.2 수정 후 전송 형식 (권장)

```json
{
  "prompt": "케이스 조사",
  "context": {
    "caseId": "CS-001"
  }
}
```

또는 Case 상세 화면 목적에 맞게:

```json
{
  "prompt": "이 케이스를 분석하고 조치를 제안해 주세요",
  "context": {
    "caseId": "CS-001"
  }
}
```

---

## 4. 수정 대상 파일

| 파일 | 수정 내용 |
|------|-----------|
| `libs/shared-utils/src/agent/use-synapse-agent-stream.ts` | `body: JSON.stringify({ caseId })` → `body: JSON.stringify({ prompt: "...", context: { caseId } })` |

---

## 5. 수정 예시 코드

```typescript
// Before
body: JSON.stringify({ caseId }),

// After
body: JSON.stringify({
  prompt: "이 케이스를 분석하고 조치를 제안해 주세요",
  context: caseId ? { caseId } : {},
}),
```

- `caseId`가 없을 때: `context: {}` 또는 `context` 생략 가능
- `prompt`는 고정 문구 또는 i18n 키 사용 가능

---

## 6. 헤더 (기존 유지)

| 헤더 | 필수 | 설명 |
|------|------|------|
| `Authorization` | ✅ | `Bearer <JWT>` |
| `X-Tenant-ID` | ✅ | 테넌트 ID |
| `X-User-ID` | 권장 | 사용자 ID |
| `X-Agent-ID` | 권장 | 에이전트 세션 ID |
| `X-Trace-ID` | 권장 | 추적 ID |
| `Content-Type` | ✅ | `application/json` |
| `Accept` | ✅ | `text/event-stream` |
| `Last-Event-ID` | 선택 | SSE 재연결 시 |

---

## 7. 완료 기준

- [ ] `POST /api/synapse/agent-tools/agents/finance/stream` 호출 시 `prompt` 또는 `message` 포함
- [ ] `caseId`는 `context.caseId`로 전달
- [ ] 빈 객체 `{}` 전송하지 않음
- [ ] 422 Validation Error 미발생
