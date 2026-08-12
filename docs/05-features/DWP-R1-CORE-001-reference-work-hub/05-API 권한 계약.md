# DWP-R1-CORE-001 API·권한 계약

## 1. Reference 상태

이 문서의 초기 Reference 화면은 Frontend Fixture를 사용했다. 현재 Ask 답변은
`POST /api/agent/v1/ask`, Action Plan 계약은 `POST /api/agent/v1/plans/preview`를 사용한다.
Ask의 세부 권한·응답·데이터 계약은 `DWP-R1-AI-001-governed-ask-runtime`이 소유한다.
Tool Mutation은 여전히 호출하지 않는다.

R0.5에서는 `resourceType=APP` 권한이 한 건도 없을 때 Reference App 전체를 일반 사용자에게
보이는 호환 모드로 동작하고 Admin은 Role을 추가 확인한다. APP 권한이 등록되는 순간부터
Home, Sidebar, Apps Catalog와 Route Guard는 정확한 Resource Grant만 허용한다. 운영 전에는
반드시 APP Resource Seed와 사용자 Entitlement를 구성해 호환 모드를 종료한다.

## 2. 현재 API

| Method       | Path                                                 | 목적                       | 권한·Risk                                                  |
| ------------ | ---------------------------------------------------- | -------------------------- | ---------------------------------------------------------- |
| GET          | `/api/platform/v1/workspace/work-items`              | 권한 범위 Work Queue       | `APP.WORK:VIEW`, Tenant·Assignee Scope                     |
| PATCH        | `/api/platform/v1/workspace/work-items/{id}/status`  | 단건 상태 변경             | `APP.WORK:UPDATE`, CSRF, `version`, Activity·Audit         |
| PATCH        | `/api/platform/v1/workspace/work-items/batch/status` | 최대 50건 원자적 상태 변경 | `APP.WORK:UPDATE`, 중복·Version 전수 검증, 전부 성공/실패  |
| GET          | `/api/platform/v1/workspace/activity`                | 통합 실행 Timeline         | `APP.ACTIVITY:VIEW`, Actor·Work Object Scope               |
| GET          | `/api/platform/v1/workspace/apps`                    | 부여된 App Registry        | `APP.APPS:VIEW`, Entitlement Filter                        |
| PATCH        | `/api/platform/v1/workspace/apps/{id}/pin`           | 개인 Pin 변경              | CSRF, Tenant·User, `version`                               |
| POST         | `/api/platform/v1/workspace/apps/{id}/launch`        | 승인 App 실행 기록         | Entitlement 재검증, Activity·Audit                         |
| GET·PUT·POST | `/api/platform/v1/home-preferences[/reset]`          | 개인 Home 조회·저장·초기화 | CSRF, Tenant·User, `version`                               |
| CRUD         | `/api/platform/v1/workspace/saved-views`             | 개인·Tenant 운영 View      | Owner·Scope·관리 권한, JSON Schema                         |
| POST         | `/api/agent/v1/ask`                                  | 권한 기반 검색·답변        | App Permission, Source ACL, Rate·Budget, Browser 60초 제한 |
| POST         | `/api/agent/v1/plans/preview`                        | 결정적 Agent Plan 계약     | Session·CSRF, L2 Approval, no mutation                     |

## 3. 공통 계약

- Browser Authentication은 HttpOnly Session Cookie와 CSRF 계약을 사용한다.
- Gateway는 보호 API마다 Session Registry를 재검증하고 외부 `X-DWP-*` Identity Header를
  제거한 뒤 검증된 User·Tenant·Role만 내부 Service에 전달한다.
- Agent 경로는 외부 `X-DWP-Service-Token`도 제거한 뒤 Gateway 전용 Service Identity를
  주입하며 Agent는 누락·불일치를 거부한다. Frontend에는 이 Token을 전달하지 않는다.
- `X-Tenant-ID`는 JWT Tenant와 일치해야 하며 Header만으로 Scope를 넓히지 않는다.
- Pagination은 안정된 Cursor를 우선하고 Sort·Filter를 명시한다.
- Response에는 `correlationId`, Source Freshness와 Permission Decision Reference를
  포함할 수 있어야 한다.
- Agent Preview Response는 승인 대상을 고정하는 64자리 SHA-256 `planHash`와
  `correlationId`를 필수로 포함한다.
- Source of Record 원문 권한을 DWP Role만으로 대체하지 않는다.
- Home Layout은 App ID만 참조하며 서버는 응답·저장 시 현재 Entitlement를 다시 적용한다.
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
