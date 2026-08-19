# DWP-R1-APR-001 API·권한 계약

## API 원칙

- Base path: `/api/approvals/v1`
- 모든 Command는 CSRF, Tenant, Permission, Scope, SoD, Resource Version을 서버에서 검증한다.
- 제출·결정·재시도·Webhook에는 Idempotency Key가 필수다.
- 결정 API는 비동기 원업무 반영 완료를 성공 응답으로 가장하지 않는다.
- 목록은 서명 Cursor와 안정 정렬을 사용한다.

## 현재 구현 API 기준선

현재 Gateway 공개 경로는 `/api/approvals/v1`이며 아래 계약이 동작한다. 이어지는 전체
Inventory는 목표 계약으로, 이 표에 없는 Endpoint는 구현 완료로 간주하지 않는다.

| Method       | Path                                                             | 책임                                          |
| ------------ | ---------------------------------------------------------------- | --------------------------------------------- |
| GET          | `/home`                                                          | 사용자 결재 지표·우선 Queue·흐름·인사이트     |
| GET          | `/tasks?view=INBOX\|DELEGATED\|COMPLETED`, `/tasks/{taskId}`     | 후보 결재함·실제 결정자 완료함과 고정 상세    |
| POST         | `/tasks/{taskId}/claim`, `/tasks/{taskId}/decisions`             | Claim과 승인·반려·정보 요청                   |
| GET          | `/requests`, `/requests/{id}`, `/requests/{id}/detail`           | 자신의 초안·상신 문서와 동적 Payload          |
| POST         | `/requests`                                                      | 게시 Workflow·Form Version을 고정한 초안 생성 |
| PUT          | `/requests/{id}/draft`                                           | Owner·Expected Version 기반 초안 편집         |
| POST         | `/requests/{id}/submit`                                          | 서버 Form 검증 후 상신                        |
| POST         | `/requests/{id}/information-response`, `/requests/{id}/withdraw` | 보완 답변과 회수                              |
| GET          | `/catalog/forms`, `/catalog/forms/{id}/template`                 | 기안 가능한 Form·결재선·동적 Schema 계약      |
| GET          | `/workflows/published`, `/workflows/published/{id}/template`     | 이전 Workflow 진입점 호환 계약                |
| GET/POST     | `/delegations`                                                   | 본인의 기간·Workflow 범위 위임                |
| GET/POST/PUT | `/admin/workflows/**`, `/admin/forms/**`, `/admin/policies/**`   | 설계·게시 SoD가 적용된 정의 관리              |
| GET/POST/PUT | `/admin/form-categories/**`                                      | 계층형 양식 분류와 운영 상태 관리             |
| GET          | `/admin/overview`, `/admin/operations`, `/admin/signatures`      | 권한별 운영·연계 상태 조회                    |

현재 Command는 CSRF와 Resource Version을 사용한다. 별도 Idempotency-Key 원장, 서명
Webhook, 원업무 Result Inbox, 재지정·재시도 Command는 Production 확장 Gate다.

`COMPLETED` Task 목록은 현재 배정자나 과거 위임 관계가 아니라 불변 결정 증적의
`decision_actor_user_id`로만 범위를 정하고 `completed_at` 최신순으로 반환한다. 완료 상세는
같은 actor에게만 열리며 Claim·승인·반려·보완 액션을 반환하지 않는다.

Task·Request 상세의 Timeline Event는 `actorDisplayName`, `stepName`, `stepSequence`,
`delegated` Snapshot을 포함한다. 표시 이름은 감사 시점 증적이며 현재 인사정보로 덮어쓰지
않고, `actorId`는 상관관계 식별자로 별도 유지한다.

Draft 생성·수정은 알려진 Field의 타입과 선택값을 검증하되 필수 업무값 누락을 허용한다.
Submit은 제목·요약·필수 Field·조건부 경로를 서버에서 다시 검증한다. 보완 답변은 사용자가
검토한 `expectedVersion`, 답변, 수정 `payload`를 함께 보내며 서버가 고정된 Form Schema를
재검증하고 새 Payload Version을 생성한다. `/requests/{id}/detail`은 권한이 확인된 고정
Payload, 요청 당시 `form_version_id`에 고정된 다국어 `formSchema`, append-only Timeline을
함께 반환한다. `/tasks/{taskId}`도 같은 고정 Schema를 반환하므로 결재자와 요청자의 Field
라벨이 관리자 변경 이후에도 당시 문서와 일치한다.

`/catalog/forms/{formId}/template`는 게시 양식·동적 필드 Schema와 함께 안전하게 공개할
수 있는 결재 단계(`key`, 표시명, 후보 역할, `ANY`, 단계 SLA)를 반환한다. 내부 정책식,
후보 개인 목록과 제한 데이터는 반환하지 않는다. 기안자는 제출 전에 경로를 확인하지만,
최종 권한 후보와 SoD는 제출 시점에 서버가 다시 계산하고 검증한다.

Frontend 메뉴와 직접 URL Guard는 API와 같은 Resource를 사용한다. `MANAGE`는 해당
Resource의 상위 권한이며, 새 기안은 `CREATE`와 `UPDATE`를 모두 보유하거나 `MANAGE`여야
노출된다. Task 조회·Claim·결정은 각각 `VIEW`, `UPDATE`, `APPROVE` Capability로 분리한다.

## API Inventory

| Method   | Path                                   | 목적                   | Permission                             | Idempotency | Audit          |
| -------- | -------------------------------------- | ---------------------- | -------------------------------------- | ----------- | -------------- |
| GET      | `/tasks?view=INBOX\|COMPLETED`         | 후보 Queue·개인 처리함 | `ACTION.APPROVAL_TASK:VIEW`            | -           | Read metadata  |
| GET      | `/tasks/{taskId}`                      | 판단 상세              | `ACTION.APPROVAL_TASK:VIEW` + scope    | -           | Sensitive read |
| POST     | `/tasks/{taskId}/claim`                | 그룹 Task Claim        | `ACTION.APPROVAL_TASK:UPDATE`          | 필수        | O              |
| POST     | `/tasks/{taskId}/release`              | Claim 해제             | `APPROVAL.TASK:CLAIM`                  | 필수        | O              |
| POST     | `/tasks/{taskId}/decisions`            | 승인·반려·보완         | `ACTION.APPROVAL_TASK:APPROVE` + scope | 필수        | O              |
| POST     | `/tasks/{taskId}/information-requests` | 정보 요청              | `APPROVAL.TASK:REQUEST_INFO`           | 필수        | O              |
| POST     | `/information-requests/{id}/responses` | 답변                   | 대상 사용자·Requester                  | 필수        | O              |
| POST     | `/tasks/{taskId}/delegate`             | Task 위임              | `APPROVAL.TASK:DELEGATE`               | 필수        | O              |
| POST     | `/tasks/{taskId}/reassign`             | Task 재지정            | `APPROVAL.OPERATIONS:REASSIGN`         | 필수        | O              |
| GET      | `/forms`                               | 기안 가능한 Form       | `APPROVAL.REQUEST:CREATE`              | -           | -              |
| POST     | `/drafts`                              | Draft 생성             | `APPROVAL.REQUEST:CREATE`              | 필수        | O              |
| PUT      | `/drafts/{requestId}`                  | Draft 저장             | Owner + expected version               | 필수        | O              |
| POST     | `/drafts/{requestId}/preflight`        | 결재선·정책 검증       | Owner                                  | 필수        | O              |
| POST     | `/drafts/{requestId}/submit`           | 불변 Revision 제출     | Owner                                  | 필수        | O              |
| GET      | `/requests`                            | 자신의 Draft·제출 문서 | `APPROVAL.REQUEST:VIEW`                | -           | -              |
| GET      | `/requests/{requestId}`                | 요청·Revision·Timeline | Owner·Participant·Scoped Viewer        | -           | Sensitive read |
| POST     | `/instances/{instanceId}/withdraw`     | 진행 중 회수           | Owner + policy                         | 필수        | O              |
| GET      | `/instances/{instanceId}/route`        | 결재선과 설명          | Scoped viewer                          | -           | -              |
| GET/POST | `/delegations`                         | 위임 조회·생성         | `APPROVAL.DELEGATION:MANAGE_SELF`      | POST 필수   | O              |
| DELETE   | `/delegations/{id}`                    | 예정·활성 위임 종료    | Owner                                  | 필수        | O              |
| POST     | `/source-requests`                     | 업무 앱 승인 요청      | Service identity + source scope        | 필수        | O              |
| POST     | `/source-results`                      | 원업무 반영 결과       | Service identity + destination         | 필수        | O              |

## Admin API

| Method       | Path                              | 목적               | Permission                             |
| ------------ | --------------------------------- | ------------------ | -------------------------------------- |
| GET/POST     | `/admin/workflows`                | 목록·Draft 생성    | `APPROVAL.DESIGN:{VIEW,CREATE}`        |
| PUT          | `/admin/workflows/{id}/draft`     | Draft 편집         | `APPROVAL.DESIGN:UPDATE`               |
| POST         | `/admin/workflows/{id}/validate`  | Graph·Rule 검증    | `APPROVAL.DESIGN:UPDATE`               |
| POST         | `/admin/workflows/{id}/publish`   | 독립 검토·게시     | `APPROVAL.DESIGN:PUBLISH`              |
| GET/POST/PUT | `/admin/form-categories`          | 계층형 Form 분류   | `APPROVAL.DESIGN:{VIEW,CREATE,UPDATE}` |
| GET/POST/PUT | `/admin/forms`                    | Form Catalog       | `APPROVAL.DESIGN:{VIEW,CREATE,UPDATE}` |
| POST         | `/admin/forms/{id}/publish`       | Form 게시          | `APPROVAL.FORM:PUBLISH`                |
| GET/POST/PUT | `/admin/policies`                 | Routing·SoD·SLA    | `APPROVAL.POLICY:{VIEW,MANAGE}`        |
| POST         | `/admin/policies/{id}/publish`    | Policy 게시        | `APPROVAL.POLICY:PUBLISH`              |
| GET          | `/admin/operations`               | 장애·지연 Queue    | `APPROVAL.OPERATIONS:VIEW`             |
| POST         | `/admin/operations/{id}/retry`    | Fulfillment 재시도 | `APPROVAL.OPERATIONS:RETRY`            |
| POST         | `/admin/operations/{id}/cancel`   | 통제된 중단        | `APPROVAL.OPERATIONS:CANCEL`           |
| GET/POST     | `/admin/signature-providers`      | Provider 설정·진단 | `APPROVAL.SIGNATURE:MANAGE`            |
| POST         | `/webhooks/signatures/{provider}` | 서명 Event 수신    | Provider signature/mTLS                |

## Decision Request

```json
{
  "outcome": "APPROVE",
  "expectedTaskVersion": 7,
  "reasonCode": "POLICY_COMPLIANT",
  "comment": "검토 완료",
  "acknowledgedEvidence": ["field:amount", "attachment:contract-v3"],
  "stepUpToken": "required-for-high-risk",
  "clientActionId": "019c..."
}
```

Response는 `decisionId`, `taskState`, `instanceState`, `fulfillmentState`,
`nextAuthorizedAction`, `correlationId`를 반환한다. 외부 반영이 끝나지 않았으면
`fulfillmentState=QUEUED`이며 `COMPLETED`를 반환하지 않는다.

## Error Contract

| HTTP | Error Code                      | 사용자 의미             | Retry     | UI 처리                 |
| ---- | ------------------------------- | ----------------------- | --------- | ----------------------- |
| 400  | `APPROVAL_VALIDATION_FAILED`    | 입력·결재선 검증 실패   | 수정 후   | Field·Route issue 표시  |
| 401  | `STEP_UP_REQUIRED`              | 추가 인증 필요          | 인증 후   | Step-up Dialog          |
| 403  | `TASK_NOT_ACTIONABLE`           | 후보·Scope·SoD 불충족   | X         | 안전한 상세·경로만 표시 |
| 404  | `APPROVAL_NOT_FOUND`            | 없거나 비공개           | X         | 존재 여부 최소 노출     |
| 409  | `TASK_VERSION_CONFLICT`         | 다른 곳에서 처리됨      | 최신 조회 | Stale 결과·처리자 표시  |
| 409  | `SOURCE_VERSION_CONFLICT`       | 원업무가 변경됨         | Diff 후   | 재검증 요구             |
| 422  | `WORKFLOW_NO_ELIGIBLE_APPROVER` | 결재 후보 없음          | 운영 조치 | 제출 차단               |
| 423  | `APPROVAL_LEGAL_HOLD`           | 보존 정책으로 변경 불가 | X         | 정책 Owner 안내         |
| 429  | `APPROVAL_RATE_LIMITED`         | 요청 과다               | Backoff   | Retry-after 적용        |
| 503  | `FULFILLMENT_UNAVAILABLE`       | 원업무 반영 지연        | 비동기    | 결정 보존·진행 표시     |

## Permission

| Resource Key          | Permission                                | Scope                 | Condition                  |
| --------------------- | ----------------------------------------- | --------------------- | -------------------------- |
| `APP.APPROVALS`       | `VIEW`                                    | Tenant                | 앱 Entitlement             |
| `APPROVAL.REQUEST`    | `CREATE,VIEW,WITHDRAW`                    | Self·Source           | Owner·정책                 |
| `APPROVAL.TASK`       | `VIEW,DECIDE,REQUEST_INFO,CLAIM,DELEGATE` | Active task           | candidacy·SoD·task state   |
| `APPROVAL.DELEGATION` | `MANAGE_SELF`                             | Self                  | 기간·범주·SoD              |
| `APPROVAL.DESIGN`     | `VIEW,CREATE,UPDATE,PUBLISH`              | Tenant                | designer/publisher SoD     |
| `APPROVAL.FORM`       | `VIEW,CREATE,UPDATE,PUBLISH`              | Tenant                | owner domain scope         |
| `APPROVAL.POLICY`     | `VIEW,MANAGE,PUBLISH`                     | Tenant                | policy owner·publisher SoD |
| `APPROVAL.OPERATIONS` | `VIEW,RETRY,REASSIGN,CANCEL`              | Tenant·domain         | Outcome 변경 금지          |
| `APPROVAL.AUDIT`      | `VIEW,EXPORT,VIEW_CONTENT`                | Tenant·classification | Content 별도 권한          |
| `APPROVAL.SIGNATURE`  | `VIEW,MANAGE`                             | Tenant                | provider admin             |

`APPROVAL_PARTICIPANT`는 사용자에게 영구 부여하는 Role이 아니다. Workflow가 만든 활성
Task 후보와 현재 권한을 교차 평가한 Runtime authority다.

## Security

- Session: Browser Session·CSRF, Service는 Workload Identity와 Audience 제한 Token
- Step-up: Restricted, 고액, 권한 상승, 대결, 전결과 외부 서명에 정책형 재인증
- Input: JSON Schema, 길이·금액·Locale·Expression AST Allowlist 검증
- File: 확장자·MIME 이중 검증, Malware Scan 완료 전 Preview·제출 제한
- Encryption: TLS, DB encryption, Restricted Field는 KMS Envelope Encryption
- Webhook: 서명 검증, Timestamp·Replay window, Provider Event ID Dedupe
- SSRF: Source URL 입력 금지, 등록된 Connector destination만 사용
- PII: 목록·Log·Audit에는 Redacted summary만, 본문 조회 별도 감사
- Rate: 사용자·Tenant·Service·Command별 제한

## Audit와 Observability

- Audit: actor, represented actor, auth level, tenant, target, revision, workflow/policy
  version, action, reason, result, correlation, source IP·device metadata 최소값
- Audit category: 요청·Task 업무 사건은 `SYSTEM_EVENT`, 양식·정책·위임·통합 재처리 같은
  통제 변경은 `ADMIN_CHANGE`로 분리한다.
- API History: 기존 `sys_api_history` 계약으로 route template, status, latency, trace 기록
- Trace: Gateway → Approval → Outbox → Domain 결과를 W3C Trace로 연결
- Metric: queue age, due breach, decision latency, no-candidate, conflict, fulfillment failure,
  retry, webhook lag
- Alert: high-risk no candidate, decision duplicate attempt, hash break, DLQ growth, KMS·engine failure
- SLO 후보: Inbox P95 400ms, Detail P95 600ms, Decision commit P95 800ms. 외부
  Fulfillment 시간은 별도 SLI다.

## Compatibility

- API Version: `v1`
- Consumer: DWP Web, Mobile/PWA, Domain Service, Governed Agent, Connector
- Event는 additive 변경만 같은 Version에 허용한다.
- OpenAPI·JSON Schema·Event Contract와 권한 Matrix를 CI에서 검증한다.
- 폐기 Route는 최소 두 Release 공지와 소비자 Telemetry 확인 후 제거한다.
