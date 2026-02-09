# 감사 추적 로그 (Audit Trail) — 필터 UI/UX 정리

## 개요

`/synapse/audit` (또는 `/audit`) 화면의 검색 필터를 정돈된 UX로 개선했습니다.

- **기본 필터**: 6개 이내로 한눈에 노출
- **Advanced**: Drawer에서 Add Filter 패턴 (Jira/Notion 스타일)
- **Chip 요약**: 적용된 필터를 Chip으로 표시, 개별 삭제 가능
- **URL 동기화**: URLSearchParams 단일 소스, 새로고침/공유 시 동일 상태 재현

## 구조

```
audit/
├── index.tsx                    # 메인 페이지 (KPI, 필터바, Chip, 이벤트 목록)
├── types.ts                     # AuditFilters, AuditApiParams 등
├── utils/audit-date-utils.ts    # 날짜 프리셋/커스텀 변환
├── hooks/use-audit-filters.ts   # URL 동기화, apiParams 정규화
├── components/
│   ├── audit-filter-bar.tsx     # FilterCard 활용 1·2행
│   └── audit-advanced-filters-drawer.tsx  # Advanced Drawer
└── README.md
```

## 필터 정의

### 기본 영역 (항상 노출)

| 필터 | 설명 |
|------|------|
| Date Range | 프리셋(오늘/24h/7d/30d) + 커스텀(from/to) |
| eventCategory | 전체/CASE/ACTION/ADMIN/INTEGRATION 등 |
| outcome | 전체/SUCCESS/FAILED/DENIED/NOOP |
| actorType | 전체/HUMAN/AGENT/SYSTEM |
| q | 통합 검색 (resourceId/actorUserId/traceId/spanId/gatewayRequestId OR 매칭) |
| Reset | 초기화 |

### Advanced (접기/Drawer)

Add Filter 패턴: 체크박스로 필요한 필터만 추가 시 입력폼 표시

- eventType (멀티)
- severity (멀티: INFO/WARN/HIGH/CRITICAL)
- resourceType (멀티)
- resourceId, actorUserId, actorAgentId
- traceId, spanId, gatewayRequestId
- ipAddress, userAgent

## 상태/라우팅

- **URLSearchParams**: 단일 소스 (새로고침/공유 재현)
- **QueryKey**: `['synapse', 'audit', 'events', tenantId, params]`
- **normalize**: 빈값 제거, 멀티 정렬, 날짜 ISO

## DoD 체크리스트

- [x] 기본 필터 6개 이내로 한눈에 정돈
- [x] Advanced 기본 닫힘 + 필터 추가/삭제/전체 초기화 가능
- [x] URL 복사 → 새 탭 동일 상태 재현
- [x] q로 traceId/gatewayRequestId 검색 가능

## 백엔드 API 스펙 반영 (AUDIT_LOGS_Q_SEARCH_AND_CASE_STATUS_PHASEA.md)

- **날짜**: `range`(1h|6h|24h|7d|30d|90d) 또는 `dateFrom`/`dateTo` — today/custom 시 dateFrom/dateTo 전송
- **q 검색**: resource_id, actor_user_id, actor_agent_id, gateway_request_id, trace_id, span_id OR 매칭 (exact/prefix)
- **eventCategory**: CASE, ACTION, AUDIT, RUN 등
- **outcome**: SUCCESS, FAILED, DENIED
