# DWP-R1-CORE-001 API·권한 계약

## 1. Reference 상태

현재 화면은 Frontend Fixture를 사용하며 아래 API를 호출하지 않는다. 경로와 Response는
R1 Backend·Connector Spike의 후보 계약으로, Build 전에 OpenAPI와 권한 판정을 별도
승인한다.

## 2. 후보 API

| Method | Path                   | 목적                   | 권한·Risk                 |
| ------ | ---------------------- | ---------------------- | ------------------------- |
| GET    | `/api/home/today`      | 개인 우선 업무와 일정  | 본인 Projection           |
| GET    | `/api/work`            | 권한 범위 Work Query   | Work ACL·Field Masking    |
| GET    | `/api/activity`        | 통합 실행 Timeline     | Actor·Work Object ACL     |
| GET    | `/api/activity/{id}`   | Event·Audit Detail     | Event Scope·Trace Masking |
| GET    | `/api/apps`            | 부여된 App Registry    | Entitlement Filter        |
| POST   | `/api/ask/query`       | 권한 기반 검색·답변    | Source ACL, Rate·Budget   |
| GET    | `/api/ask/runs/{id}`   | 답변·Source·Trace 상태 | Run Owner·Support Scope   |
| POST   | `/api/actions/preview` | 후속 Action Plan 생성  | Tool Policy, no mutation  |

## 3. 공통 계약

- Browser Authentication은 HttpOnly Session Cookie와 CSRF 계약을 사용한다.
- `X-Tenant-ID`는 JWT Tenant와 일치해야 하며 Header만으로 Scope를 넓히지 않는다.
- Pagination은 안정된 Cursor를 우선하고 Sort·Filter를 명시한다.
- Response에는 `correlationId`, Source Freshness와 Permission Decision Reference를
  포함할 수 있어야 한다.
- Source of Record 원문 권한을 DWP Role만으로 대체하지 않는다.
- Activity 응답은 내부 Chain-of-thought를 포함하지 않고 입력 Reference, 정책 판정, Tool,
  결과와 Audit Reference만 제공한다.

## 4. Error와 상태

| 상황             | HTTP | Client 동작                                  |
| ---------------- | ---- | -------------------------------------------- |
| Session 만료     | 401  | Auth State 제거와 Sign-in                    |
| 권한 거부        | 403  | 존재·Snippet을 노출하지 않는 Permission 상태 |
| 결과 없음        | 200  | 빈 목록과 적용 Filter                        |
| 일부 Source 실패 | 200  | `partial=true`, 실패 범위와 Retry            |
| Rate·Budget 제한 | 429  | Retry 시각과 결정적 Search Fallback          |
| Connector 지연   | 503  | Stale Cache와 마지막 동기화 또는 Retry       |

## 5. Mutation 원칙

Reference Flow는 Mutation을 수행하지 않는다. R1의 실제 Action은 다음을 모두 요구한다.

- Idempotency Key와 Business Correlation ID
- 변경 대상·Before·After Plan Preview
- Risk Tier별 사용자 확인 또는 별도 Approver
- Tool Result, 원본 ID, Audit Event와 Compensation 전략
