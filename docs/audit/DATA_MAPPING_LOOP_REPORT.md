# Interface Cross-Check & Data Mapping Loop Report

**목적**: 백엔드 API 응답 → 화면 데이터 채움까지의 '데이터 매핑 루프' 최종 확인  
**갱신일**: 2026-02-11

---

## 1. case_action_history / audit-events → 타임라인 UI

### 1.1 백엔드 응답 필드 (Binding Check)

백엔드가 **actor 표시**를 위해 보낼 수 있는 필드는 아래 세 가지를 모두 수용하도록 정리했습니다.

| BE 필드명 | 용도 | FE 반영 |
|-----------|------|--------|
| `actorDisplayName` | 조치자 표시명 (권장) | 1순위 사용 |
| `actorName` | 동일 목적 대체 필드 | 2순위 fallback |
| `actor_id` | ID만 제공 시 | 3순위 — 문자열로 표시, 없으면 'System' |

**결론**: `actor_id`만 오면 그대로 표시하고, `actorName` 또는 `actorDisplayName`이 있으면 해당 값 사용. 타임라인 UI는 **동일한 표시용 문자열**(`actorName` prop)만 받으므로, BE가 어떤 필드명을 쓰든 FE 매핑 단계에서 하나로 통일합니다.

### 1.2 데이터 매핑 루프 (최종)

```
GET /api/synapse/cases/{caseId}/audit-events
  → ApiResponse<CaseAuditEventsResponse>
  → res.data.items: CaseAuditEventDto[]

CaseAuditEventDto (libs/shared-utils/src/api/synapse-operations-api.ts)
  - auditId, createdAt, eventCategory?, eventType?, actorDisplayName?, actorName?, actor_id?, ...

↓ useCaseAuditEventsQuery(caseId, { page, size })

↓ 소비처별 매핑 (actor 표시 통일)

[워크벤치] apps/remotes/synapsex/src/pages/workbench/index.tsx
  actionHistory = auditData.items.map(item => ({
    id: item.auditId,
    actorName: item.actorDisplayName ?? item.actorName ?? (item.actor_id != null ? String(item.actor_id) : undefined) ?? 'System',
    actionAt: item.createdAt ?? '',
    comment: [item.eventCategory, item.eventType, item.resourceType].filter(Boolean).join(' · ') || undefined,
  }))
  → WorkbenchDetailPanel → WorkbenchActionHistoryTimeline(items={actionHistory})

[케이스 상세] apps/remotes/synapsex/src/pages/case-detail.tsx
  caseAuditEvents = caseAuditApiData.items.map(item => ({
    actor: item.actorDisplayName ?? item.actorName ?? (item.actor_id != null ? String(item.actor_id) : undefined) ?? 'System',
    description: ...,
    timestamp: item.createdAt,
  }))

[감사 로그] apps/remotes/synapsex/src/pages/audit/index.tsx, audit-legacy.tsx
  toAuditEvent(item) 내부에서 actor = item.actorDisplayName ?? item.actorName ?? (item.actor_id != null ? String(item.actor_id) : undefined) ?? 'System'
```

**타임라인 UI 컴포넌트**

- `WorkbenchActionHistoryTimeline`: props `items: AgentCaseActionHistoryItem[]` — 각 항목 `actorName`, `actionAt`, `comment` 사용.

---

## 2. WebSocket 알림 (NotificationDto) → 상단 알림 바

### 2.1 type 분기 및 아이콘·색상 매칭 (WebSocket Sync)

백엔드 WebSocket 알림 객체의 **`type`** (및 `category`) 값을 아래와 같이 분기해, 상단 알림 바의 **아이콘 + 아이콘 색상**이 일치하도록 했습니다.

| BE type 예시 (대소문자 무시) | FE NotificationCategory | 아이콘 | 아이콘 색상 |
|-----------------------------|--------------------------|--------|-------------|
| AI_DETECT, anomaly, danger, risk, detect | anomaly_detected | danger-triangle | error (빨강) |
| TRAINING_COMPLETE, learning, learned, rag_learned | training_complete | graduation | success (녹색) |
| APPROVAL_COMPLETE, action, hitl_approved, hitl_rejected | approval_complete | check-circle | success (녹색) |
| warning | warning | bell-bing | warning (주황) |
| error | error | close-circle | error (빨강) |
| 기타 | info | info-circle | info (파랑) |

### 2.2 데이터 매핑 루프 (최종)

```
백엔드 WebSocket /ws/notifications
  → 메시지: NotificationDto { id?, type?, category?, title?, message?, body?, link? }

↓ useNotificationWebSocket({ showToastOnReceive: true })

↓ use-notification-websocket.ts
  - normalizeCategory(payload.category ?? payload.type) → NotificationCategory
  - addNotification({ category, title, message, link })
  - showToast(...) (우측 상단 스낵바)

↓ notification-store (Zustand)
  - items: NotificationItem[] (id, category, title, message, createdAt, isUnRead, link?)

↓ NotificationsPopover (apps/dwp/src/layouts/components/notifications-popover.tsx)
  - useNotificationStore(s => s.items), getUnreadCount, markAsRead, ...
  - listToShow = items.slice(0, 10)
  - NotificationRow(notification) per item

↓ NotificationRow
  - category → CATEGORY_ICON[category] (아이콘)
  - category → CATEGORY_COLOR[category] (색상: error/warning/success/info)
  - Box sx: bgcolor: `${colorKey}.lighter`, color: `${colorKey}.main`
  - 클릭 시 notification.link 있으면 navigate(link), Popover 닫기
```

**고정된 UI props**

- **NotificationItem** (store): `id`, `category` (NotificationCategory), `title`, `message`, `createdAt`, `isUnRead`, `link?`
- **NotificationRow**: `notification: NotificationItem`, `onNavigate?` — 아이콘/색상은 `notification.category`에서만 파생 (단일 소스).

---

## 3. 요약 표

| 구간 | API/입력 | DTO/타입 | 매핑 위치 | UI 컴포넌트 (고정 props) |
|------|----------|----------|------------|---------------------------|
| 조치 이력 | GET .../audit-events | CaseAuditEventDto (actorDisplayName \| actorName \| actor_id) | workbench/index, case-detail, audit | WorkbenchActionHistoryTimeline(items: { actorName, actionAt, comment }[]) |
| 실시간 알림 | WS /ws/notifications | NotificationDto (type, category, title, message, link) | use-notification-websocket (normalizeCategory), notification-store | NotificationsPopover → NotificationRow(notification); category → CATEGORY_ICON + CATEGORY_COLOR |

백엔드가 **case_action_history**에 `actor_id`만 내려줘도 타임라인에 표시되고, **알림 type**에 `AI_DETECT` 등이 오면 해당 타입에 맞는 아이콘과 색상이 상단 알림 바에 반영되도록 매핑 루프를 고정했습니다.
