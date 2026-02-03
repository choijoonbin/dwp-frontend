# HITL 승인 UI 연동 가이드

> Aura Platform 팀 전달 사항 기반 구현  
> BACKEND_HANDOFF.md 및 Aura SSE 이벤트 형식 준수

---

## 1. hitl 이벤트 형식 (수신)

```json
{
  "type": "hitl",
  "requestId": "req_abc123",
  "actionType": "propose_action",
  "message": "propose_action 실행을 승인하시겠습니까?",
  "context": { "caseId": "...", "actionType": "..." },
  "trace_id": "...",
  "tenant_id": "...",
  "case_id": "..."
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| requestId | ✅ | API 호출 시 사용. 승인/거절 API에 전달 |
| message | | 사용자에게 표시할 설명 |
| actionType | | 작업 유형 (propose_action 등) |
| context | | caseId, actionType 등 추가 컨텍스트 |

---

## 2. 백엔드 API (BACKEND_HANDOFF 기준)

### 승인

```http
POST /api/aura/hitl/approve/{requestId}
Authorization: Bearer {JWT}
X-Tenant-ID: {tenant_id}
X-User-ID: {user_id}
Content-Type: application/json

{"userId": "user123"}
```

### 거절

```http
POST /api/aura/hitl/reject/{requestId}
Authorization: Bearer {JWT}
X-Tenant-ID: {tenant_id}
X-User-ID: {user_id}
Content-Type: application/json

{"userId": "user123", "reason": "사용자 거절"}
```

---

## 3. 프론트엔드 구현 위치

| 위치 | 역할 |
|------|------|
| `libs/shared-utils/src/agent/hitl-api.ts` | approveHitlRequest, rejectHitlRequest |
| `libs/shared-utils/src/agent/use-synapse-agent-stream.ts` | hitl 이벤트 파싱, HitlEventData 타입 |
| `apps/dwp/src/components/aura/aura-mini-overlay.tsx` | Mini Overlay HITL UI + API 연동 |
| `apps/dwp/src/pages/aiworkspace/hooks/use-ai-workspace.ts` | Full Workspace HITL + API 연동 |
| `apps/remotes/synapsex/.../case-hitl-drawer.tsx` | Case Detail HITL Drawer |
| `apps/remotes/synapsex/.../use-case-hitl.ts` | Case Detail approve/reject mutation |

---

## 4. 동작 흐름

1. **hitl 이벤트 수신** → pendingHitl 설정, 스트리밍 일시 중지
2. **승인/거절 모달 표시** → message, context로 사용자에게 설명
3. **승인 클릭** → `POST /api/aura/hitl/approve/{requestId}` 호출
4. **거절 클릭** → `POST /api/aura/hitl/reject/{requestId}` 호출 (reason 선택)
5. **성공 시** → 모달 닫기, SSE 스트림 자동 재개 (Aura-Platform Redis 신호)

---

## 5. requestId 사용

- `requestId`는 hitl 이벤트의 `data.requestId`에서 추출
- 일부 구 백엔드는 `id` 필드 사용 → `eventData.requestId ?? eventData.id`로 호환
- `hitl-` 접두사가 붙은 경우 API 호출 전 제거
