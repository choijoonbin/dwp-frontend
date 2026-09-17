# Notification R2 완료 증적

기준일: 2026-09-17

## 범위

이 문서는 전달된 Stitch 01-20과 Notification R2 내부 고도화의 최종 구현·검증 증거를 고정한다.
제품 코드로 통제할 수 없는 외부 Provider와 Production 인프라 승인은 별도 Gate로 구분한다.

### 사용자 범위

- `/notifications/home`: 실행 중심 홈, KPI Filter, 업무 브리핑, 우선 조치, 멘션·대화, 업데이트,
  앱별 미확인과 수신 환경 상태
- `/notifications/center`: Saved View v2, 수신 이유·Context 조합 Filter, Split Detail, Bulk·Keyboard
  Triage, 320·390px Mobile Flow
- `/notifications/settings`: 채널·앱·유형 설정, Quiet Hours, Digest, Privacy, 관심 규칙,
  시험 알림과 Endpoint 진단
- 알림 상세: Safe Preview, Source 이동, 수신 이유, Follow·Mute·Prioritize, Messenger 답장·재시도

### 관리자 범위

- `/notifications/admin/overview`: 운영 KPI, 품질·피로도, 익명 집계, Finding과 Deep Link
- `/notifications/admin/contracts`: Producer·Type 계약과 상태
- `/notifications/admin/policies`: Tenant Policy와 관심 규칙 4-eyes Governance
- `/notifications/admin/templates`: Revision, Safe Preview, 독립 승인과 철회
- `/notifications/admin/operations`: 전달 조사, Queue·Provider 상태와 제한 작업
- `/notifications/admin/suppressions`: 영향 Preview, TTL, 해제와 감사

## 아키텍처·보안 완료

- Transactional Outbox → Kafka → Notification Materialization → PostgreSQL Inbox → Redis
  content-free hint → SSE·Version Catch-up 경로
- Recipient Entitlement Admission의 Tenant/User binding, 권한 회수, 401·403·404·Timeout·5xx
  Fail Closed와 Suppressed no-write
- Owner PEP의 Cross Tenant, Scope Escape, Stale Authority, Confused Deputy, Internal Header Spoof
  거부와 canonical UUID·Header 검증
- Saved View·Attention Rule·Noise Quality의 Tenant/User 격리, RLS·FORCE RLS와 개인정보 최소 집단
- 감사 Outbox Lease·Backoff·Poison·Retention과 결정·완료 사실의 Append-only 기록

## 자동 검증 결과

### Frontend

| Gate                       | 결과                                      |
| -------------------------- | ----------------------------------------- |
| Notification Vitest        | 29 files, 163 tests PASS                  |
| Notification Chromium E2E  | 101 PASS, 1 project-specific SKIP, 0 FAIL |
| Stitch Screenshot Baseline | 17/17 PASS                                |
| 변경 영향 E2E 재검증       | 34/34 PASS                                |
| iPhone 13 WebKit           | 2 PASS, Desktop 전용 100 SKIP, 0 FAIL     |
| TypeScript                 | PASS                                      |
| Notification scoped ESLint | PASS                                      |
| Vite Production Build      | PASS                                      |
| Notification Source Size   | 최대 1,000줄 이하 PASS                    |
| Notification Design System | 신규 회귀 0 PASS                          |

Chromium 전체 실행은 홈·센터·상세·설정·관리자, 정상·빈 화면·부분 장애·오프라인·403·429,
한국어·영어, 320·390·1280·1440px, 200% 유효 폭, Keyboard·Focus·Messenger Reply를 포함한다.
WebKit 프로젝트의 유효 테스트는 Native Mobile Home·Detail·Settings Flow와 알림 앱 접근성 계약을
검증한다. 프로젝트 전용 Skip은 실패로 집계하지 않는다.

### Backend

| Gate                            | 결과                                                   |
| ------------------------------- | ------------------------------------------------------ |
| `dwp-notification-server` 전체  | 464 tests, 416 PASS, 조건부 PostgreSQL 48 SKIP, 0 FAIL |
| 실제 PostgreSQL 통합            | 61/61 PASS                                             |
| Messaging Notification Producer | 8/8 PASS                                               |

실제 PostgreSQL 61건은 Reason Query, Structured Context, Attention Governance Concurrency,
Attention Audit, Noise Quality History, SLA Delivery Journal과 SLA Materialization을 각각 깨끗한
Database 경계에서 실행한 합계다.

### 핵심 실행 명령

```bash
# Frontend unit/type/lint/build
yarn vitest run <notification test files>
yarn tsc --noEmit
yarn eslint apps/dwp/src/features/notifications <notification e2e files>
yarn vite build

# Browser
E2E_BASE_URL=http://127.0.0.1:4217 E2E_REUSE_EXISTING_SERVER=true \
  yarn playwright test e2e/notification*.spec.ts --project=chromium --workers=1
E2E_BASE_URL=http://127.0.0.1:4217 E2E_REUSE_EXISTING_SERVER=true \
  yarn playwright test e2e/notification*.spec.ts --project=mobile --workers=1

# Backend
./gradlew :dwp-notification-server:cleanTest :dwp-notification-server:test \
  --no-daemon --max-workers=1 --console=plain
./gradlew :dwp-messaging-server:test \
  --tests '*MessagingNotificationEventsTest' \
  --tests '*MessagingProductSurfaceContractCandidateTest'
```

## 공유 트리 전체 Gate 상태

Notification 소유 범위는 통과했다. 현재 전체 저장소 Gate의 남은 차단은 다른 활성 제품 범위다.

- Unused internal export: Rooms `workplaceSafetyResponseTotal`
- Source size: Approval Admin v2, Rooms unified reservations, shared approval API
- Maintenance source size: Approval·Mail
- Design System 잔여: Approval·Mail·Rooms
- Bundle Budget: Initial raw 1,088.8 KiB / 1,074.2 KiB, 14.6 KiB 초과

이 항목을 Notification 완료로 위장하거나 타 제품 파일을 임의 수정하지 않는다.

## 외부 운영 Gate

다음은 코드·Fixture만으로 완료 처리할 수 없다.

- 실제 Email·Push·Teams·Slack 자격증명, 발신 Domain과 Provider Callback
- Production Kafka HA, Peak Load, 장애·복구·DR 실행 결과
- Retention·Residency·Support Session과 출시 승인
- Tenant 휴일 정본·개인 일정 합성 우선순위와 Governed Failed-delivery Replay 운영 정책 승인
- Edge·Safari 실기기 전체 SSE와 장시간 Screen Reader·Burst 증거

Readiness는 이 증거가 없으면 Fail Closed를 유지한다. 따라서 현재 판정은
`내부 제품 및 Stitch 01-20 구현 완료, Production 외부 Gate 대기`다.
