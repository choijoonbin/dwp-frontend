# HRIS 데이터·API·이벤트 계약

## 1. 공통 값 타입

| 값 | 저장/전송 규칙 |
|---|---|
| Tenant | 내부 `BIGINT tenant_id`; 외부 claim/contract는 비순차 public tenant key |
| Aggregate ID | 내부 BIGINT 또는 UUID PK, 외부는 UUID `publicId`; tenant 없이 조회 금지 |
| Effective date | date 기반 업무는 `[validFrom, validTo)`; `validTo=null`은 infinity |
| System time | `createdAt/updatedAt`은 UTC instant; business date/timezone과 분리 |
| Money | `decimal-value-types.v1.json` 정본: wire는 exponent 없는 decimal string; `InputAmount(19,6)` → `CalculationDecimal(24,8)` → `PostedMoney(19,4)` 단계와 currency/policy별 명시적 rounding; float/DB 암묵 rounding 금지 |
| Rate | `RateDecimal(19,8)`; 퍼센트 표시는 UI 책임이고 wire/storage는 decimal ratio |
| Quantity/Hours | `QuantityDecimal(19,6)` + 명시적 unit; 분/초를 암묵 변환하지 않음 |
| Local time | IANA zone, local date/time, resolved offset, instant, DST resolution 결과 보존 |
| Rule reference | immutable `policyId + version + effectiveFrom + digest` |
| Actor | user/service public ID, delegation/support session, purpose, authentication strength |
| Document/File | object key, media type, byte size, hash, malware status, retention class; 원문 event 금지 |
| Sensitive identifier | token/reference + masked display; national ID/bank account 평문 일반 테이블 금지 |

## 2. 물리 데이터 규칙

- 테이블 prefix는 owner context를 나타낸다. 코딩 정본은 다음과 같다: HRM/People `ppl_*`, PER `prf_*`, TIM time/schedule `tme_*`, TIM absence/leave `abs_*`, PAY `pay_*`, SYS Auth product-access `sys_product_access_*` 및 assignment `com_product_access_*`, SYS Platform control/config `sys_*`, 격리된 SYS Insights(`hris_insights` schema) `sys_hris_*`. 문서나 코드에서 `hr_*`, `tim_*`, `hrx_*`를 새 물리 prefix로 도입하지 않는다.
- prefix만으로 소유권을 추정하지 않는다. `physical-owner-prefix-register.csv`의 runtime/schema/file 범위와 longest-prefix 규칙을 함께 적용하며, 등록되지 않은 prefix·cross-owner duplicate·다른 서비스 migration 배치는 Gate에서 거부한다.
- 모든 mutable root에 `version BIGINT NOT NULL`, 생성/수정 actor와 timestamp를 둔다.
- business key unique는 `tenant_id`를 첫 컬럼으로 포함한다.
- tenant-owned FK는 가능하면 `(tenant_id, local_id)` composite로 잘못된 tenant 연결을 차단한다.
- cross-service ID는 UUID와 captured version/digest만 저장하고 FK를 만들지 않는다.
- published effective range는 PostgreSQL range/exclusion constraint 또는 동등한 직렬화 guard로 overlap을 차단한다.
- audit/event/idempotency/receipt는 domain write와 같은 transaction에 기록한다.
- ledger와 법정/급여 결과는 hard delete 금지; reversal/correction과 legal hold를 사용한다.
- JSONB는 provider payload, versioned extension, evidence metadata에만 사용하고 핵심 검색/정합성 필드를 숨기지 않는다.
- 인덱스는 query contract와 reference load profile로 정당화하며 추측성 전체 인덱싱을 금지한다.

## 3. API envelope

외부 API는 기존 DWP Gateway의 service-key 규약인 `/api/{service}/v1/**`를 사용하고 Gateway가 `StripPrefix=2`한 뒤 owner service의 `/v1/**`로 전달한다. HRIS는 HRM `/api/people/v1/hris/**`, PER `/api/people/v1/hris/performance/**`, TIM `/api/time/v1/**`, PAY `/api/payroll/v1/**`로 고정한다. SYS는 단일 서비스가 아니므로 기존 소유 서비스의 `auth`, `provider`, `platform`, `approvals`, `notifications` service-key를 그대로 유지한다. 그중 HRIS 전용 Platform 기능은 employee/manager self-service `/api/platform/v1/hris/**`와 설정·운영·감사 `/api/platform/v1/admin/hris/**`로 분리하고, 기존 공통 API를 exact reuse하는 경우에는 원래 path를 바꾸지 않는다. 서비스 전용 API는 `/internal/{bounded-context}/v1/**`이며 Gateway/browser에 노출하지 않는다. 단일 `/api/hris/**`가 여러 service로 암묵 분기하는 별도 규약과 임의 action verb를 금지한다.

### Query response

```json
{
  "data": {},
  "meta": {
    "contractVersion": "hris.people.worker.v1",
    "tenantRevision": 12,
    "scopeRevision": 8,
    "generatedAt": "2026-09-10T00:00:00Z",
    "freshness": "CURRENT",
    "nextCursor": null
  }
}
```

### Command response

```json
{
  "receiptId": "00000000-0000-0000-0000-000000000000",
  "state": "ACCEPTED",
  "aggregatePublicId": "00000000-0000-0000-0000-000000000000",
  "aggregateVersion": 4,
  "acceptedAt": "2026-09-10T00:00:00Z",
  "links": { "status": "/api/.../receipts/..." }
}
```

### 필수 request context

- authenticated tenant/actor는 trusted token/filter에서 주입하며 body/query의 tenant를 신뢰하지 않는다.
- `X-Correlation-Id`, `traceparent`; 신규·고위험 command는 `Idempotency-Key`.
- 기존 DWP Platform의 `platform_updateSurface`를 exact reuse하는 `SYS-API-032`만 이름이 고정된 예외다. fixed `surfaceKey=hcm-home`과 request body의 필수 `version` CAS 및 동기 응답을 그대로 사용하며 `Idempotency-Key`, `If-Match`, 비동기 receipt를 새로 만들지 않는다. 다른 command는 이 예외를 사용할 수 없다.
- `202`를 반환하는 모든 command는 같은 owner service의 권한 있는 receipt `GET`으로 수렴해야 한다. 조회 population은 `ORIGINATING_COMMAND_SCOPE`이며 app entitlement와 봉인된 원 command의 action·subject·population·field policy·purpose를 현재 권한으로 다시 평가해 더 좁은 교집합만 반환하고, tenant/scope 밖은 opaque `404`로 처리한다. HRM·PER·TIM·PAY는 각 domain receipt endpoint를, SYS는 Auth/Platform 소유 endpoint를 사용하며 중앙 운영 projection이 recovery command 권한을 대신 부여하지 않는다.
- high-risk command는 `If-Match` 또는 body `expectedVersion`, step-up proof와 approved purpose가 필요하다.
- list는 `limit` 상한, opaque cursor, allowlisted sort/filter를 사용한다.

## 4. 오류 계약

Problem Details 계열 envelope에 stable code를 추가한다.

| HTTP | 대표 code | 의미 |
|---|---|---|
| 400 | `INVALID_ARGUMENT` | 형식/범위 오류 |
| 401 | `AUTHENTICATION_REQUIRED` | 인증 없음/만료 |
| 403 | `APP_NOT_ENTITLED`, `CAPABILITY_DENIED`, `SCOPE_DENIED`, `FIELD_DENIED`, `SOD_DENIED`, `STEP_UP_REQUIRED` | fail-closed 권한 결과 |
| 404 | `RESOURCE_NOT_FOUND` | 권한과 존재 유출을 피하는 bounded 결과 |
| 409 | `VERSION_CONFLICT`, `EFFECTIVE_PERIOD_OVERLAP`, `INVALID_STATE_TRANSITION`, `IDEMPOTENCY_CONFLICT`, `STALE_DEPENDENCY` | 재조회/해결 필요 |
| 412/428 | `PRECONDITION_FAILED/REQUIRED` | expected version 누락/불일치 |
| 413/415/422 | file size/type/semantic validation | import/document 검증 |
| 429 | `RATE_LIMITED` | retry-after 포함 |
| 503 | `DEPENDENCY_UNAVAILABLE`, `COUNTRY_PACK_UNAVAILABLE` | 안전한 비활성/재시도 |

오류에 급여액, 주민식별, 계좌, 평가 코멘트, 원시 payload를 넣지 않는다. field 오류는 허용된 field key와 localized message key만 반환한다.

## 5. Event envelope

```json
{
  "specVersion": "1.0",
  "id": "uuid",
  "source": "dwp-people-server",
  "type": "dwp.hris.worker.assignment.changed.v1",
  "schemaVersion": 1,
  "time": "2026-09-10T00:00:00Z",
  "subject": "ASSIGNMENT/uuid",
  "tenantId": 1,
  "aggregateType": "ASSIGNMENT",
  "aggregateId": "uuid",
  "aggregateSequence": 7,
  "correlationId": "uuid-or-approved-id",
  "causationId": "uuid",
  "traceParent": "00-00000000000000000000000000000000-0000000000000000-01",
  "data": {},
  "extensions": {}
}
```

- 정본은 `contracts/asyncapi/domain-events.yaml#/components/schemas/DomainEventEnvelope`, Java adapter는 `dwp-core`의 `DomainEventEnvelope`·`DomainEventRecorder`·`DomainEventOutboxRepository`다. HRIS profile에서는 shared schema가 platform-global event를 위해 nullable로 허용하는 `tenantId`도 반드시 양수로 채운다.
- 필수 envelope field set은 `specVersion,id,source,type,schemaVersion,time,tenantId,aggregateType,aggregateId,aggregateSequence,correlationId,data`다. `subject,causationId,traceParent,extensions`는 선택 필드이며 별도 alias를 만들지 않는다.
- producer는 aggregate별 `aggregateSequence`를 보장한다. global ordering을 가정하지 않는다.
- consumer는 `(consumer, id)` inbox unique로 exactly-once effect를 만든다.
- schema는 backward compatibility check를 통과하고 `type`에 major version을 포함한다.
- 삭제/정정 이벤트도 최소 payload와 owner API link를 사용한다.
- subject erasure가 필요한 projection은 tombstone/tokenization을 처리하되 법적 보존 ledger는 별도 policy를 따른다.

## 6. 핵심 snapshot/event 계약

| Producer | Contract | Consumer | 필수 내용 |
|---|---|---|---|
| HRM | `WorkerAssignmentSnapshot.v1` | PER/TIM/PAY | worker, employment, primary/secondary assignment, legal entity, org, position, manager, timezone, validity, version |
| HRM | `CompensationBasisSnapshot.v1` | PAY | basis components, currency, frequency, validity, policy refs; 민감 필드는 PAY scope로만 |
| HRM | `WorkerChanged.v1`, `EmploymentChanged.v1`, `AssignmentChanged.v1`, `OrganizationChanged.v1` | PER/TIM/PAY/Home | public IDs, version, change type, effective range |
| HRM | `CompensationBasisChanged.v1` | PAY | invalidation pointer only; PAY refetches its field-filtered snapshot |
| HRM | `WorkplaceAssignmentSnapshot.v1` | TIM | workplace, location code, timezone, calendar, validity, version/digest |
| HRM | `WorkerDependentEligibilitySnapshot.v1` | PAY | tokenized dependent reference, relationship, eligibility facts, validity, version/digest |
| HRM | `WorkerTaxIdentitySnapshot.v1` | PAY | jurisdiction, tokenized tax identifier, residency/classification, validity, version/digest |
| HRM | `WorkerBankAccountTokenSnapshot.v1` | PAY | bank token, masked display, currency/priority, validity, version/digest; raw account 금지 |
| TIM | `ClosedTimeResult.v1` | PAY | worker/period/pay code quantities, approval/close version, digest, correction lineage |
| TIM | `TimePeriodClosed.v1`, `TimePeriodReopened.v1`, `PayrollTimeHandoffReady.v1` | PAY/Home/Notification | 최소 상태, immutable result reference와 action link |
| PER | `ApprovedCompensationPlanSnapshot.v1`, `ApprovedCompensationPlanLine.v1`, `ApprovedCompensationPlanSnapshotPublished.v2` | PAY | immutable header 1건 + ordered line 1..100000건이 모두 커밋된 뒤 16-field v2 event만 발행·소비한다. line별 worker/assignment/component/amount/currency/effective range, approval receipt, header/line/event digest를 검증하고 PAY input은 line N건과 정확히 N건으로 대사한다. `CompensationPlanApproved.v1`은 G2/lineage 역사 정본일 뿐 G3 runtime producer·consumer·trigger가 아니며 dual publish도 금지한다. |
| PER | cycle/review/published result events | Home/Notification/HRM projection | 민감 점수 원문 없이 상태/visibility |
| PAY | run/result/statement/payment state events | Home/Notification/Audit | 상태·count·digest; 개인 금액은 owner query로만 |
| SYS | access/config/job/connector lifecycle events | all | revision, effective time, state, invalidation reason |

위 표는 사람이 읽는 요약이다. 구현 wire 정본은 `cross-module-canonical-schemas.v1.json`의 Draft 2020-12 schema 21건과 `cross-module-schema-binding-register.csv`다. 모든 producer/consumer는 같은 generated import를 사용하고, type·format·required·nullability·nested cardinality·정규화 SHA-256과 양끝 contract test가 일치해야 한다. 필드명 목록만 같거나 서로 복사한 DTO는 계약 폐쇄로 인정하지 않는다.

## 7. Home contribution 계약

각 owner는 module-local projection을 만들고 Platform/Gateway가 materialize한다. contribution 실패는 홈 전체 실패가 아니다.

정본 event type은 모든 모듈이 공통으로 발행하는 `HrisHomeContributionChanged.v1`이며 transport topic은 `dwp.hris.home.contribution.changed.v1`이다. 모듈별 payload profile은 `PeopleHomeContribution.v1`, `PerformanceHomeContribution.v1`, `TimeLeaveHomeContribution.v1`, `PayrollHomeContribution.v1`로 고정한다. SYS Home projection은 이 event를 소비하며 별도 alias나 암묵적 변환은 허용하지 않는다.

- key: `(tenant, actor, audience, scopeRevision, widgetKey)`
- payload에는 허용된 요약·count·status·deep link만 포함
- 급여 금액/평가 코멘트는 field policy에 따라 masked 또는 별도 owner query
- `generatedAt`, `sourceVersion`, `freshUntil`, `staleAfter` 필수
- entitlement/scope revision 변경 event로 cache invalidation
- 모듈 비활성, 권한 거부, 데이터 없음, 지연을 서로 다른 상태로 표현

## 8. Import/export/document 계약

Import는 object quarantine→malware scan→schema detect→row validation→dry-run→approval→idempotent execute→reconciliation receipt 순서다. 원본/정규화본/오류행/실행결과는 hash로 연결한다. Export는 purpose, 승인, 대상 scope, field set, watermark, expiry, download count와 감사 이벤트가 필요하다. 대용량 파일은 signed URL을 쓰되 짧은 TTL, tenant-bound object key, one-time policy를 적용한다.

## 9. DWP 공통 서비스 exact binding

세부 path·adapter·schema·test와 G3/G6 경계는
`platform-integration-binding-register.csv`가 정본이다.

| Concern | HRIS G3 binding | 금지 |
|---|---|---|
| Event/outbox | `DomainEventEnvelope` + `DomainEventRecorder` + local transactional outbox + AsyncAPI contract test | 모듈별 envelope alias와 DB commit 뒤 유실 가능한 임의 publish |
| Approval | `/api/approvals/v1/**` contract의 request/decision receipt를 참조 | HRIS private approval engine/table과 승인 state 우회 |
| Notification | canonical event `data.notificationIntents[]`를 allowlisted translator가 materialize | notification DB 직접 write와 임의 recipient fan-out |
| Audit | `AuditEvent`를 domain transaction의 `AuditOutboxRecorder`에 기록 | 민감 원문 payload·무감사 privileged read/export |
| Config | `HrisConfigurationVersion.v1` draft→validate→publish→supersede/rollback snapshot | module별 하드코딩·다른 module 설정 table 직접 조회 |
| API/PEP | service-key route + 175 public operation exact PEP register | 화면 권한 추론·`TIME_*`/`PAY_*` alias를 canonical duty로 사용 |

위 baseline adapter가 존재한다는 사실은 HRIS wiring 구현 완료를 뜻하지 않는다.
각 binding 상태는 `REQUIRED_G3_BINDING`이며 production provider·실명 승인·실제 tenant
값은 G6까지 fail-closed다.
