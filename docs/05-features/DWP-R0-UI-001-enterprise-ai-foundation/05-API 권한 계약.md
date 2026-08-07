# DWP-R0-UI-001 API·권한 계약

## API Inventory

Foundation 자체 Endpoint는 없다. Consumer는 승인된 OpenAPI 계약으로 Row,
Citation, Plan과 Execution Event를 제공한다.

| Method | Path                       | 목적               | Permission    | Idempotency | Audit          |
| ------ | -------------------------- | ------------------ | ------------- | ----------- | -------------- |
| GET    | Feature별                  | Grid·Citation 조회 | Resource read | N/A         | 민감 조회 정책 |
| POST   | Feature별 plan approval    | 승인·반려          | Agent approve | 필수        | 필수           |
| POST   | Feature별 execution action | Stop·Retry·Handoff | Agent operate | 필수        | 필수           |

## Error Contract

| HTTP | Error Code            | 사용자 의미    | Retry    | UI 처리          |
| ---- | --------------------- | -------------- | -------- | ---------------- |
| 400  | VALIDATION_FAILED     | 요청 수정 필요 | 아니오   | Field·Plan Error |
| 401  | UNAUTHORIZED          | Session 만료   | Login 후 | Return URL 보존  |
| 403  | FORBIDDEN             | 권한 없음      | 아니오   | Denied State     |
| 409  | PLAN_VERSION_CONFLICT | 계획 변경됨    | Refresh  | 변경 비교        |
| 429  | RATE_LIMITED          | 잠시 후 재시도 | 조건부   | Retry 시각       |
| 5xx  | SERVICE_UNAVAILABLE   | 처리 불가      | 조건부   | Correlation ID   |

## Permission

- Component의 Disabled·Hidden 상태는 사용성 표현이며 Security Boundary가 아니다.
- Backend가 Tenant, Resource, Action, Risk Tier와 승인 분리를 검증한다.
- Citation URL은 원본 접근 시 다시 권한을 확인한다.
- 직접 API 호출도 UI와 동일하게 거부되어야 한다.

## Security와 Observability

- Browser Session은 HttpOnly Cookie와 CSRF 계약 사용
- Plan 승인·실행 Action은 Idempotency Key와 Plan Version 필요
- Audit는 Actor·Tenant·Plan·Version·Decision·Target·Correlation ID 포함
- 원문 Prompt·민감 Tool Output은 기본 Log에 기록하지 않음
- Contract Test는 실제 Feature API 추가 시 필수
