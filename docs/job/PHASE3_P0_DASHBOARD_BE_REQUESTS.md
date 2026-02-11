# Phase3 P0 통합관제센터 UI/UX — 백엔드 요청/확인 사항

P0 작업은 **FE에서 기존 API만 사용**하여 완료했습니다.  
**백엔드 답변 반영 완료** (2026-02-10).

---

## 1. 현재 사용 API (변경 없음)

| 용도 | API | 비고 |
|------|-----|------|
| 에이전트 스트림 | `GET /api/synapse/dashboard/agent-stream?range=6h&limit=50` | 10초 폴링, 응답 `data.items[]` 사용 |
| 요약/KPI | `GET /api/synapse/dashboard/summary` | 기존 |
| 조치 필요 | `GET /api/synapse/dashboard/action-required?severity=...` | 기존 |
| 주요 리스크 | `GET /api/synapse/dashboard/top-risk-drivers?range=24h` | 기존 |
| 팀 현황 | `GET /api/synapse/dashboard/team-snapshot?range=7d` | 기존 |

---

## 2. 백엔드 답변 요약

### 2.1 감사추적로그 진입 시 기본 필터 (P0-4) — ✅ 지원

- **FE 동작**: "전체 감사 로그 보기" 클릭 시 `/synapse/audit?range=6h&category=CASE` 로 이동.
- **BE 답변**: `range`, `category`(또는 `eventCategory`), `resourceType` **지원**.  
  - **range**: `1h`, `6h`, `24h`, `7d`, `30d`, `90d` (미지정 시 기본 24h).  
  - **category** / **eventCategory**: `CASE`, `ACTION`, `AGENT`, `ADMIN`, `POLICY`, `AUDIT`, `DASHBOARD`, `INTEGRATION`, `FEEDBACK`, `UI`, `RUN` 등.  
  - **resourceType**: `AGENT_CASE`, `AGENT_ACTION`, `CASE`, `ACTION`, `AUDIT_EVENT`, `DOCUMENT`, `OPEN_ITEM`, `DETECT_RUN` 등.
- **FE 유지**: `/synapse/audit?range=6h&category=CASE` 그대로 사용.  
  (선택) 케이스만 더 좁히려면 `resourceType=AGENT_CASE` 추가 가능.

### 2.2 agent-stream 응답 스키마 — ✅ 확인

- **BE 응답**: `data.items[]` 에 `ts`(ISO-8601), `level`, `stage`, `message`, `caseId`, `actionId`, `resourceType`, `resourceId`, `traceId`, `gatewayRequestId`, `links` 제공.
- **FE 가정과의 차이**:  
  - `timestamp` 없음 → **ts** 사용 (FE adapter 이미 `d.ts ?? d.timestamp` 처리).  
  - `action` 없음 → **stage** 사용 (FE adapter 이미 `d.stage ?? d.action` 처리).  
  - `status` 없음 → **level**(INFO/WARN/ERROR)로 표현 (FE adapter `d.status ?? d.level` 처리).  
  - `caseKey` 없음 → `caseId` + `resourceId` 로 대응.
- **eventType**: BE는 `eventType` 필드 미제공. FE에서 **stage**(SCAN, DETECT, ANALYZE, SIMULATE, EXECUTE, MATCH 등)를 읽기 쉬운 라벨로 매핑해 표시. 이후 BE에서 `eventType` 등 공통 코드를 내려주면 FE에서 해당 필드 우선 사용 가능.

---

## 3. 향후 Phase4 등에서 필요 시 (이번 P0 범위 아님)

- **GET /api/synapse/dashboard/summary?range=6h**  
  P0에서는 미사용. 이후 지표/집계 개편 시 `updatedAt`, `unresolvedBySeverity`, `pendingApprovalCount`, `avgLeadTime` 등 집계값을 이 엔드포인트로 확장해 주시면, FE에서 "마지막 업데이트" 등에 활용할 수 있습니다.

---

## 4. 요약

- **필수 백엔드 변경 없음.** P0는 기존 대시보드 API만 사용.
- **감사 API**: `range`, `category`, `resourceType` 지원 확인됨. FE 링크 `/synapse/audit?range=6h&category=CASE` 유지.
- **agent-stream**: `ts`, `stage`, `message`, `level`, `caseId`, `links` 등 확인됨. FE adapter fallback으로 정합성 유지. BE가 내려주는 **stage** 값(SCAN, DETECT, ANALYZE, SIMULATE, EXECUTE, MATCH)에 대한 라벨 매핑은 FE i18n에 반영 완료.
