# DWP-R2-WPL-001 수용 테스트 및 잔여 Gate

## 1. 내부 완료 증거

| 계약                                   | 자동화 증거                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| 사용자 예약·체크인·반납·취소           | `e2e/rooms.spec.ts`                                                              |
| 미래 예약 동종 자원/시간 변경          | `e2e/rooms.spec.ts`, `WorkplaceOperationsServiceTest`                            |
| 회의실 정책 장애 fail-closed           | `e2e/rooms.spec.ts`                                                              |
| Site 규칙 없음·미매핑 회의실 기본 차단 | `WorkplaceAuthorizationFailClosedPostgresIntegrationTest`, `e2e/rooms.spec.ts`   |
| 권한 회수 후 조회 제외·쓰기 재검증     | `WorkplaceServiceTest`, `WorkplaceOperationsServiceTest`, PostgreSQL 통합 테스트 |
| Desktop/Mobile 관리 화면과 Draft 재개  | `e2e/rooms.spec.ts`                                                              |
| API Gateway 경계와 요청 Payload        | `workplace-api.test.ts`, `rooms-api.test.ts`                                     |
| 예약/Release Window 멱등성             | `WorkplaceOperationsServiceTest`, `WorkplaceReleaseWindowServiceTest`            |
| 배치도 업로드 검증과 bounded decode    | `WorkplaceFloorPlanValidatorTest`                                                |
| 미디어 삭제 재참조 경합                | `TenantMediaCleanupWorkerTest`, `V185__fence_workplace_media_cleanup.sql`        |
| 마이그레이션 계약                      | `WorkplaceLifecycleHardeningMigrationTest`                                       |
| 앱 격리, Gateway, 소스 크기            | `yarn architecture:check`, backend source-size Gate                              |
| 한·영 번역 완전성                      | `yarn i18n:check`                                                                |

### 1.1 2026-08-27 검증 Snapshot

- Backend Platform 전체 Gate: 659 tests, failures 0, errors 0, source-size 1,086 production files PASS.
- Frontend Rooms 단위 테스트: 7 files, 35 tests PASS.
- Chromium·Mobile 사용자/관리자 Journey: 38 tests PASS.
- Frontend 전체 TypeScript, 애플리케이션 격리, Gateway API 경계, source-size, Design System,
  Display Dictionary와 i18n Gate PASS.
- Calendar-Rooms 통합 범위의 코드·계약 차단은 0건이다.

위 Snapshot은 Workplace/Rooms Increment 1의 내부 수용 증거다. 전사 Product Surface 출시 증거
매니페스트는 같은 시점에 0/37 `BLOCKED`이므로, 이 결과만으로 솔루션 전체를 Production Ready로
승인하지 않는다.

## 2. 릴리스 차단 Gate

다음 항목은 외부 환경 또는 승인된 규모 입력이 필요한 출시 증거다. 코드가 존재한다는 이유만으로
완료 처리하지 않는다.

1. R2 부하 Gate: 동일 자원 100개 동시 요청에서 성공 1건과 나머지 충돌, 멱등 재시도 동일 ID.
2. R3 보안 Gate: 실제 Gateway를 통한 Tenant·Building 범위 차단, RLS/KMS와 운영 Key Rotation 증거.
3. A 접근성 Gate: 지원 브라우저, Tablet/Mobile, 200% Zoom과 전체 키보드 Journey 증거.
4. 외부 Calendar/출입/센서 Adapter는 승인된 공급자, 동기화 소유권과 장애 정책이 확정된 뒤 연결한다.
5. 대규모 Cursor Pagination은 승인된 자원·예약 Cardinality와 SLO를 기준으로 별도 증명한다.

## 3. 승인된 후속 범위

- 비회의 공간 다중 날짜 Series/Occurrence는 원자 생성, 개별 예외와 감사 계약을 별도 Increment로 구현한다.
- 배치도 Review에서 미래 예약 영향과 변경 Diff를 운영자가 확인하는 Preview를 추가한다.
- 편집기 Undo/Redo, Snap/Grid와 충돌 안내는 사용자 연구와 성능 기준을 갖춘 편집기 Increment로 확장한다.

위 후속 범위는 현재 단일 예약·게시·복구 계약을 우회하는 임시 구현으로 추가하지 않는다.
