# DWP-R1-ADM-009 Phase 1A Control-plane Shadow 실행 설계

## 1. 결정

- 상태: `contract-hardening-in-review`, `backend-blocked`
- 권한원장: `dwp-platform-server`
- Provider 역할: 공개 명령의 RBAC·SoD·감사 파사드
- 실행 모드: `STATIC → SHADOW`; Phase 1A에서 `AUTHORITATIVE` 전환 금지
- Runtime·Layout: 현재 v5와 Native Renderer를 변경하지 않음
- 배포 단위: Registry, Tenant default-deny, Evaluator, Safety, Audit·Outbox·Metrics를 하나의 Bundle로
  배포하되 Flag Off 상태로 먼저 설치

부분 DB나 읽기 API만 Runtime에 연결하지 않는다. 안전·정책·감사 없이 Registry만 권한원장처럼
사용하면 Publish가 곧 Allow로 오해되거나 Revoke가 Runtime에 도달하지 않는 불완전한 통제 평면이 된다.

## 2. 구현 전제와 현재 차단 사항

2026-08-27 현재 Frontend Phase 0 대상 Unit 45건, Flag On Playwright 8건, Flag Off 3건과 직접 Vite
Production Build는 통과했다. 저장소 전체 Release Gate는 여전히 통과 상태가 아니다.

- 전체 TypeScript와 Frontend Architecture Gate: 현 작업트리 재검증 통과, 최종 통합 Branch에서 반복 필요
- Package policy: Local Node 20, 저장소 요구 Node 24.18 이상이라 표준 Build command는 선행 Gate에서 중단
- Backend: 여러 서비스의 Migration·OpenAPI·SecurityFilter가 Dirty이고 Owner가 미확정
- 15:01 KST snapshot 재조회: Platform `V200`, Provider `V49`, Auth `V106`

따라서 이번 문서 작성만으로 Backend 착수를 완료했다고 표시하지 않는다. 실제 Migration과 OpenAPI를
수정하기 전, 대상 Branch의 Dirty 파일 Owner와 Migration 번호를 다시 확인한다.

## 3. Work Package와 완료 경계

### WP-0 — Manifest Binding Authority Bootstrap

이 Package는 Definition lifecycle endpoint보다 먼저 병합하며 독립 온라인 Control Plane이 아니다.

산출물:

- `widget-binding-catalog.v1` JSON Schema, Golden Fixture, 독립 root/component/file digest verifier
- Platform append-only binding Revision/child/head/activation Migration과 Application role read-only Grant
- `WidgetManifestBindingCatalogPort`와 local DB adapter
- 5종 Product/App/Authority/Renderer/Source/Data exact Seed

완료 조건:

- Fixture↔Java↔DB byte/digest parity와 unknown/missing/duplicate binding Negative Test
- Head/fixture mismatch, DB 오류, stale cache가 `MANIFEST_BINDING_AUTHORITY_UNAVAILABLE`
- current Revision 변경이 기존 Validation run을 무효화하고 Manifest 전체 binding을 Effective에서 재검증
- 축소 Revision은 영향 Published Version이 먼저 Quarantine/Revoke되지 않으면 Migration abort
- Application/Gateway/Provider/Tenant identity의 Catalog write가 모두 거부됨

### WP-A — Platform Registry Core

산출물:

- Definition·Version·Release Channel·Evidence·Runtime Control Entity/Repository
- 상태 전이 Domain Service
- Published Manifest API·DB Immutability Guard
- canonical JSON과 Manifest·Binding Catalog SHA-256 Golden Utility
- 5개 Legacy Seed

완료 조건:

- 상태 축별 허용 전이와 불허 전이 Test
- 작성자≠승인자, 고위험 승인자≠게시자 Test
- 같은 Definition+SemVer와 canonical key 충돌 Test
- Publish가 Tenant Policy나 Home Layout을 만들지 않는 Negative Test

### WP-B — Tenant Policy와 Effective Evaluator

산출물:

- Tenant Policy Revision·Catalog Settings
- 기존 Tenant explicit allow Backfill과 신규 Tenant baseline hook
- 우선순위가 고정된 순수 Evaluator
- Admin Explain과 일반 사용자용 Reason 축약

완료 조건:

- Policy 행 부재, Version 미해석, 예외, Unknown 값이 모두 `DENY`
- Tenant A 정책이 Tenant B 결과·Count·Title에 영향을 주지 않음
- App Entitlement 없는 `schedule`이 일반 사용자 Payload에 없음
- `command-rail`은 Flow 개인 Library에 나타나지 않음

### WP-C — Provider Control Façade

산출물:

- Provider Permission·Role Migration
- 공개 Provider OpenAPI와 Generated Client
- 전용 Platform Internal Client·Service Identity
- Operator, Session, Correlation, Reason을 연결한 양쪽 감사

완료 조건:

- Browser 제공 Actor Header를 무시하고 검증된 Operator Context를 재구성
- 범용 Provisioning Token으로 Mutation 불가
- Platform Internal Endpoint가 Gateway Route에 없음
- 동일 Idempotency Key+다른 Fingerprint가 `409`

### WP-D — Shadow·Safety·Operations

산출물:

- 정적 판정과 Effective 판정의 Shadow Compare
- Global·Definition·Version Kill/Quarantine/Revoke
- Transactional Registry Event·Outbox
- Dashboard, Alert, Runbook, Rollback Command

완료 조건:

- Shadow는 응답·Layout·Renderer를 변경하지 않음
- Metric Label에 Definition ID·User ID·Config·업무 제목을 넣지 않음
- Kill/Quarantine Drill과 Event Replay 수행
- Registry 장애가 Home Header·App 실행·정적 Runtime을 막지 않음

## 4. Transaction 경계

상태를 변경하는 성공 Command는 한 Platform Transaction에서 다음을 완료한다.

```text
Permanent command execution gate insert-or-lock
→ Idempotency receipt lock/read
→ assertion expiry 재검증
→ Target + expected version lock/read
→ 권한·SoD·현재 상태 재검증
→ State mutation
→ Registry event append
→ Outbox append
→ Durable command completion ledger append
→ Gate OPEN → SEALED
→ Receipt response persist
→ commit
```

검증 2xx와 결정적 4xx는 Target/Event/Outbox 없이 같은 Gate·Ledger·Completed Receipt Transaction으로
끝난다. Terminal `503 COMMAND_NOT_EXECUTED`도 같은 불변식의 `NOT_EXECUTED` outcome이며, 그 밖의 transient
5xx만 Ledger/Completed를 만들지 않고 `IN_PROGRESS`로 남긴다. `COMPLETED Receipt ↔ SEALED Gate ↔
Ledger` binding 불일치는 commit constraint와 Completion read에서 Fail Closed한다.

Provider 감사는 Platform Transaction과 분산 Transaction으로 묶지 않는다. 동일 Correlation ID를 쓰고,
Platform 호출 전 exact service-token/assertion attempt tuple과 Provider Receipt/commandId를 먼저 영속한다.
응답 뒤 Provider Receipt·Audit·Outbox를 한
Transaction으로 완료하고, 장애 시 completed-only background reconciler가 durable ledger 응답으로 같은
Transaction을 재시도한다. 원 assertion 만료 뒤에는 Gate-serialized seal만 요청하며 Platform 상태를 임의로
되돌리거나 원 Mutation을 무권한 재실행하지 않는다.

## 5. Shadow 비교 계약

### 5.1 실행 Topology와 비주입 Seam

Shadow 비교 실행 주체는 Browser나 Frontend가 아니라 Platform의 신규
`WidgetCatalogShadowObserver`다.

```text
기존 GET /v1/home-experience 또는 /v1/home-preferences 성공
  → 기존 Controller/Service가 기존 응답을 그대로 확정
  → after-response bounded executor에 ShadowEvaluationContext 제출
      immutable WidgetShadowAuthoritySnapshot + surfaceKey
      server-owned Home/Host/Layout revision + placementContexts[]
  → LegacyWorkspaceWidgetCatalogAdapter가 Java Golden Fixture 5종으로 정적 판정
  → WidgetEffectiveCatalogEvaluator가 Registry/Policy/Safety 판정
  → WidgetCatalogShadowComparator가 low-cardinality diff/event/metric 기록
  → 원 호출의 status/body/header/cache/layout에는 쓰지 않음
```

`LegacyWorkspaceWidgetCatalogAdapter`는 현재 `HomePreferenceService`의 공개 응답이나 저장을 호출하지 않는
read-only adapter이며 Golden Fixture 이외의 Registry row를 입력으로 받지 않는다. Queue가 가득 차거나
Timeout·평가 예외가 발생하면 observer는 `EVALUATION_ERROR` Metric만 남기고 원 요청을 성공/실패로 바꾸지
않는다. Async 작업에는 Request ThreadLocal을 넘기지 않고 인증된 요청 문맥이 살아 있을 때 아래
폐쇄형 Snapshot을 한 번만 생성한다.

`WidgetShadowAuthoritySnapshot` v1의 필수 필드와 경계는 다음과 같다.

- 내부 `tenantId`, opaque `subjectRef`, `authorityRevision`, `capturedAt`, `expiresAt`
- canonical surface, `placementContexts[]` 최대 2개, Home Experience version, layout revision, host configuration revision,
  Host Capability Version
- 정렬·중복 제거된 `entitledAppKeys[]` 최대 256개와 평가에 실제 필요한
  `permissionCodes[]` 최대 256개
- Audience 평가에 실제 참조되는 정렬된 `roleCodes[]` 최대 64개와 opaque `groupRefs[]`
  최대 128개; 평가에 쓰지 않는 claim은 복사하지 않는다.

Snapshot은 불변 deep copy이고 최대 canonical encoded size는 16 KiB, 유효 시간은 capture 후
5초다. 메모리 대기열/평가 스택 외에 직렬화·저장하지 않고, Log·Metric·Outbox·Debug
Payload에 넣지 않으며 평가 완료 즉시 참조를 폐기한다. `authorityFingerprint`는 Snapshot으로부터
파생해 cache key와 승인된 진단 상관관계에만 쓰고 평가기 입력이나 Metric label로 대체하지
않는다.

필수 authority/entitlement/audience claim이 누락되었거나 개수·크기·TTL 한계를 넘으면 작업을 제출하지
않고 `dwp_widget_shadow_snapshot_rejections_total{reason=MISSING_CLAIM|ENTRY_LIMIT|SIZE_LIMIT|EXPIRED|READ_TIMEOUT|AUTHORITY_UNAVAILABLE|INVALID_REFERENCE|ERROR}`와
`EVALUATION_ERROR`를 기록한다. Worker는 dequeue 즉시, Registry/Policy remote read 후, comparator 호출 직전에
`expiresAt`을 다시 검증하고 중간에 만료되면 결과를 폐기한다. Worker는 Browser identity로 authority를
재조회하거나 fingerprint에서 역추론하지 않는다. 즉, Legacy와 Shadow가 같은 요청 시점의 실제
authority set을 입력으로 받는다.

`HomeHostContextResolver`는 한 요청에서 평가할 Context를 서버가 확정한다.

- effective variant가 `CLASSIC`이면 `[CLASSIC_PERSONAL]`
- effective variant가 `FLOW_V1`이면 `[FLOW_PERSONAL, FLOW_GOVERNED]`; 단 Published governed zone이
  하나도 없는 fail-closed policy면 `[FLOW_PERSONAL]`

Observer는 Context별로 Evaluator/Comparator를 독립 호출하고
`dwp_widget_shadow_evaluations_total{placement_context=...}`을 각각 1건으로 증가시킨다. 따라서
`FLOW_GOVERNED ≥1,000`은 실제 Flow governed staging 요청 호출 횟수로 계산하며 단일
`placementContext` 라벨을 인위적으로 재사용하지 않는다. 스테이징 호출량이 부족하면 고정된
테스트 Tenant·Subject의 실제 인증 문맥으로 부하를 보완하고 `ring=staging-bootstrap`으로만
계수한다.

Phase 1A에서 다음 seam은 코드·Dependency Test로 강제한다.

- Frontend `defaultWorkspaceWidgets`, `reconcileWorkspaceWidgets`, `createDefaultLaunchpadLayout`,
  `reconcileLaunchpadLayout`은 Effective API를 import·호출하지 않는다.
- Backend `HomePreferenceService`, `HomeViewService`, `HomeComposerService`의 normalize/save/render 입력에는
  Registry/Evaluator 결과를 주입하지 않는다.
- `WidgetCatalogShadowObserver`는 Home service가 의존하는 객체가 아니라 optional after-response observer다.
- `/v1/widget-catalog/effective`는 QA·계약 검증용으로만 열고 Frontend Phase 0 Feature Flag와 연결하지 않는다.
- `SHADOW` 결과가 v5 `visible`, order, size, height, appLayout, HTTP status 또는 cache key를 바꾸면 Test가
  실패한다.

### 5.2 비교 입력과 결과

입력:

- `WidgetShadowAuthoritySnapshot`의 tenant, subject, 실제 authority/entitlement/audience set
- server-owned surface, placement context, Home/Host/Layout revision, host capability
- 현재 정적 5종 Catalog 결과
- Platform Effective 결과와 current Binding Catalog revision

정적 5종은 DB의 immutable partial-unique `legacyWidgetKey`로 비교한다. 일반 API가 만든
`legacyWidgetKey=null` Definition은 canonical `definitionKey`로 한 번만 식별하고 정적 대응이 없으므로
다른 Gate 결과와 무관하게 `SHADOW_ONLY` 후보로 분류한다. 중복/null을 임의 legacy key로 보충하지 않는다.
다음 Diff만 저카디널리티 Metric으로 기록한다.

- `STATIC_ONLY`
- `SHADOW_ONLY`
- `STATE_MISMATCH`
- `ADDABILITY_MISMATCH`
- `VERSION_UNRESOLVED`
- `BINDING_MISMATCH` — Manifest owner/App/Authority/Renderer/Source/Data/Action 중 하나가 current binding과 다름
- `SAFETY_MISMATCH` — Global control, Quarantine, Revoke, Certification deny가 양쪽에서 다른 경우

Evaluator timeout/예외는 Diff가 아니라 evaluation `outcome=ERROR|TIMEOUT`으로만 기록하며 해당 window의
promotion error-rate Gate에 포함한다.

아래 §11 exact Metric 표의 label·값만 유일한 whitelist다. `reason bucket`, `service version`,
`tenant rollout ring`과 같은 alias label을 추가로 만들지 않는다. Tenant ID는 승인된 내부 Diagnostic
Log에 Hash 형태로만 남기고 Metric Label에는 넣지 않는다. Definition별 상세는 감사 권한이 있는
Debug Endpoint에서만 조회한다.

Observer queue는 process당 256, 동시 실행 8, 전체 deadline 150ms, Registry/Policy read timeout 100ms로
고정한다. 초과 작업은 기다리지 않고 `queue_rejected`로 기록한다. 실패하면 정적 Runtime은 계속 동작하고
Shadow 오류만 기록한다. 이 동작은 `AUTHORITATIVE` 장애 처리와 다르다.

## 6. Cache·Revision 계약

- Effective 응답: `private, no-store`
- Server 내부 Cache를 쓰면 Key에 tenant, authority fingerprint, surface, host version, catalog revision,
  policy revision, safety revision, certification gate revision을 포함
- Evidence Cache는 `validUntil=min(가장 이른 필수 Evidence/waiver expiry, db_now+5초)`를 저장하고 조회마다
  DB clock으로 hard expiry를 확인; Runtime Guard도 동일 revision/validUntil 사용
- Safety Revision 변경은 Positive Allow Cache를 즉시 무효화
- Safety 상태는 Allow보다 우선하며 Stale/Missing Cache를 Allow로 해석하지 않음
- `AUTHORITATIVE` 전환 후 Registry 장애에서 정적 Fallback 금지
- Revision SoR은 `plt_widget_registry_revision_head(environment)`,
  `adm_tenant_widget_policy_catalog_head(tenant_id)`, `plt_widget_safety_revision_head(environment)` 세 행이다.
  상태 변경만 head lock 후 `+1`하며 State·Event·Outbox를 같은 commit에 넣고 replay/no-op/failure는 증가시키지
  않는다. Rollback은 과거 revision으로 감소하지 않고 새 `+1`을 만든다. BIGINT overflow는 readiness를
  Fail Closed한다.
- 목록 첫 page는 동일 read-only snapshot의 head-bound `readRevision`을 반환하고 다음 page current head가
  다르면 `409 READ_REVISION_CONFLICT`다. Effective read는 세 head read→평가→세 head recheck를 최대 두 번
  수행하고 계속 drift면 `503 REVISION_STABILITY_UNAVAILABLE`다. Safety head read와 cache-key 결속은 positive
  cache lookup보다 항상 먼저다. 실행 계약은
  [`fixtures/verify-revision-authority-contract.mjs`](fixtures/verify-revision-authority-contract.mjs)에 고정한다.

## 7. Migration 안전 규칙

- 기존 Tenant는 5개 Legacy Definition마다 명시적 Published Allow Revision을 생성한다.
- 신규 Tenant도 동일 5개 Published baseline을 생성한다. App 미보유 항목은 정책을 생략하지 않고
  Entitlement Gate에서 `APP_NOT_ENTITLED`로 deny하여 baseline bytes와 운영 설명을 하나로 유지한다.
- 신규 Definition Publish는 Tenant Allow, Home Preference, Instance를 만들지 않는다.
- `HomePreferenceService`의 누락 Widget 자동 삽입 대상은 현재 정적 Key Set으로 고정한다.
- Registry Key를 해당 정규화 함수의 입력으로 사용하지 않는다.
- Workspace Seed가 Golden Parity를 통과하기 전 HCM·Approval 정적 정책을 변경하지 않는다.
- Backfill은 재실행 가능하고 기존 명시적 Tenant 선택을 덮어쓰지 않는다.

## 8. 보안 Route Checklist

- Binding Catalog는 온라인 Route가 없고 Flyway migration role만 write 가능; Application role은 exact
  revision/head read-only이며 Fixture/DB digest mismatch에서 readiness와 Mutation이 Fail Closed
- Provider 공개 `/v1/admin/widget-definitions/**`, `/v1/admin/widget-definition-versions/**`: Method별
  Provider Widget 권한 Family에 명시 등록
- Platform Tenant `/v1/admin/widget-catalog/**`, `/v1/admin/widget-policies/**`:
  `ADMIN.HOME_WIDGET_POLICY`의 `VIEW/EXPLAIN/MANAGE/PUBLISH`를 Method별 명시 등록
- Platform User `/v1/widget-catalog/effective`: 인증 사용자, Current Tenant 강제
- Platform Internal `/internal/provider/v1/widget-registry/**`: 03의 ES256 Bearer service token +
  request-bound Provider assertion을 모두 요구. Completion GET과 `seal-not-executed`만 exact
  `widget-registry.reconcile` scope/purpose를 허용하고 Target Service 호출 금지, 전체 Gateway 미노출
- Generic Tenant Admin Fallback과 URL Prefix 추론에 의존하지 않음
- 모든 List/Explain Query에 Tenant Predicate와 Cross-tenant Negative Test

## 9. Tenant Migration 진리표

| 상황                                | Policy 생성                             | Effective 결과            | 기존 Home 변경       |
| ----------------------------------- | --------------------------------------- | ------------------------- | -------------------- |
| 기존 Tenant·기존 5종·App Entitled   | explicit Published Allow Backfill       | 다른 Gate 통과 시 Allow   | 없음                 |
| 기존 Tenant·기존 5종·App 미보유     | Backfill 가능하나 Entitlement Gate 우선 | `APP_NOT_ENTITLED`        | 없음                 |
| 신규 Tenant Provisioning            | 기존 5종 exact Baseline 생성            | App Gate 포함 전체 재평가 | 없음                 |
| 신규 Definition Publish             | 자동 Policy 없음                        | `TENANT_POLICY_MISSING`   | 없음                 |
| Policy 행 부재·Projection 부재·예외 | 없음                                    | `DENY`                    | 없음                 |
| Tenant Disable Publish              | 새 Revision                             | 해당 Tenant만 Deny        | Instance/config 보존 |
| Policy Rollback                     | 과거 행 수정 없이 새 Published Revision | 새 Revision 재평가        | Layout 변경 없음     |
| Global/Version Safety 차단          | Policy보다 우선                         | 모든 대상 Deny            | Instance/config 보존 |

Backfill은 `(tenant_id, definition_id, baseline_generation)` Idempotency를 가지며 기존 Published/Draft
Tenant 선택을 덮어쓰지 않는다. exact schema/golden/digest는
[`fixtures/widget-tenant-policy-seeds.v1.schema.json`](fixtures/widget-tenant-policy-seeds.v1.schema.json),
[`fixtures/widget-tenant-policy-seeds.v1.golden.json`](fixtures/widget-tenant-policy-seeds.v1.golden.json),
[`fixtures/verify-tenant-policy-seeds.mjs`](fixtures/verify-tenant-policy-seeds.mjs)에 고정하며 5종 모두
`CHANNEL/STABLE`, `workspace-home`, `ALL_ENTITLED`, `required=false`, empty locked config,
`PRIVATE_ONLY`, `PUBLISHED revision=1`, `baselineGeneration=1`, `SYSTEM_MIGRATION`이다.

## 10. 상태 전이·SoD·Idempotency Matrix

### 10.1 Definition·Version·Evidence

| 명령                       | From → To                                           | 권한      | 불변 조건·SoD                                                         |
| -------------------------- | --------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| Definition 생성            | 없음 → `ACTIVE`                                     | `WRITE`   | canonical key unique, owner app 범위                                  |
| Definition retire          | `ACTIVE` → `RETIRED`                                | `RELEASE` | active channel 없음, replacement 검증, 불가역                         |
| Version 작성               | 없음 → `DRAFT/UNPUBLISHED/CLEAR`                    | `WRITE`   | Definition owner 범위, semantic version unique                        |
| Draft 수정                 | `DRAFT` → `DRAFT`                                   | `WRITE`   | expected version, unknown field 거부                                  |
| Submit                     | `DRAFT` → `SUBMITTED`                               | `WRITE`   | current manifest hash의 validation PASS                               |
| Approve                    | `SUBMITTED/PENDING` → `APPROVED/PROVIDER_CERTIFIED` | `REVIEW`  | reviewer ≠ author·사용 waiver actor, 03 Risk/Evidence Gate            |
| Reject                     | `SUBMITTED` → `REJECTED`                            | `REVIEW`  | reviewer ≠ author, decision append-only                               |
| Rework                     | `REJECTED` → `DRAFT`                                | `WRITE`   | 기존 decision 보존, validation/approval link 초기화                   |
| Evidence 기록              | 없음 → `PASS/FAIL`                                  | `REVIEW`  | 공개 입력은 두 상태만, append-only, manifest hash 일치                |
| Evidence 미실행/만료       | 없음/현재 → `NOT_RUN/EXPIRED`                       | `SYSTEM`  | `NOT_RUN`은 행 부재 파생값, `EXPIRED`는 DB clock 서버 전이            |
| Evidence waive             | `FAIL/EXPIRED` → append-only `WAIVED` decision      | `WAIVE`   | LOW/MEDIUM Performance/Localization만, 독립 actor·expiry 필수         |
| Publish                    | `APPROVED/UNPUBLISHED` → `PUBLISHED`                | `RELEASE` | high-risk publisher ≠ approver, 03 Risk/Evidence Gate, hash 고정      |
| Deprecate                  | `PUBLISHED` → `DEPRECATED`                          | `RELEASE` | 신규 Add 금지, replacement/expiry                                     |
| Quarantine                 | `CLEAR` → `QUARANTINED`                             | `REVOKE`  | security operator, Safety Revision 증가                               |
| Evidence expiry quarantine | `CLEAR` → `QUARANTINED`                             | `SYSTEM`  | `SYSTEM_EVIDENCE_EXPIRY`, causeDigest unique 자동 전이만              |
| Clear approval 생성        | `QUARANTINED` 유지                                  | `REVIEW`  | current active quarantineEventId+revision tuple, 30분 ACTIVE approval |
| Clear quarantine           | `QUARANTINED` → `CLEAR`                             | `RELEASE` | current 사건 exact match, approval ACTIVE→CONSUMED single-use         |
| Revoke                     | `CLEAR/QUARANTINED` → `REVOKED`                     | `REVOKE`  | 불가역, Replacement 선택 가능                                         |
| Channel promote            | current → target Published Version                  | `RELEASE` | target Approved+Published+CLEAR+현재 Evidence/full Binding Gate       |
| Channel rollback           | current → requested prior Published Version         | `RELEASE` | target도 같은 full Gate, 과거 Version 수정 없이 channel event         |

`PUBLISHED` Manifest와 Certification Evidence/Decision 행은 Update/Delete하지 않는다. Definition
Definition `RETIRED`, Version `REVOKED`에서 돌아오는 Transition은 없다. Reject 후 같은 Version을 Rework할 수 있지만
이전 Decision과 hash는 audit chain에 남고 새 Submit이 새 validation run을 요구한다.

`CATALOG_MUTATIONS=DISABLED`는 catalog mode와 무관하게 새 Registry·Tenant Widget Policy 일반 Mutation을
Service 진입에서 `503 WIDGET_MUTATIONS_DISABLED`로 차단한다. Quarantine/Revoke/control disable·독립 승인된
enable은 복구 경로로 유지하고, legacy HomePreference·v5 Layout Mutation에는 이 Gate를 주입하지 않는다.

### 10.2 Tenant Policy·Runtime Control

| 명령                    | From → To                                        | 권한      | 규칙                                                           |
| ----------------------- | ------------------------------------------------ | --------- | -------------------------------------------------------------- |
| Policy draft 생성       | 없음 → `DRAFT`                                   | `MANAGE`  | tenant+definition scope, expected version `0`                  |
| Policy draft 수정       | `DRAFT` → `DRAFT`                                | `MANAGE`  | Published row 수정 금지                                        |
| Policy publish          | `DRAFT` → `PUBLISHED`                            | `PUBLISH` | impact snapshot·현재 catalog/safety revision 일치              |
| 새 Policy publish       | old `PUBLISHED` → `SUPERSEDED` + new `PUBLISHED` | `PUBLISH` | 단일 transaction, revision 증가                                |
| Policy revoke           | `PUBLISHED` head → 새 `REVOKED` tombstone head   | `PUBLISH` | 기존 행 immutable, 해당 Tenant만 deny, Layout/config 보존      |
| Policy rollback         | 과거 snapshot → 새 `PUBLISHED` Revision          | `PUBLISH` | 과거 행 수정 금지, impact 재계산                               |
| Runtime control disable | effective `ENABLED` → 새 `DISABLED` revision     | `REVOKE`  | global/definition/version head 원자 교체, Safety Revision 증가 |
| Runtime control enable  | `DISABLED` head → 새 `ENABLED` revision          | `RELEASE` | current disabled head exact match, approval ACTIVE→CONSUMED    |
| Runtime control expiry  | expired `DISABLED` → `DISABLED` 유지             | `SYSTEM`  | 자동 Allow 금지; 수동 enable 전까지 fail closed                |

Audience, policy, runtime control에서 unknown enum/state를 읽으면 `DENY`; DB constraint에 없는 값을 기본
Allow로 변환하지 않는다.

Clear/Enable Approval 생성은 각각 Version+Safety head 또는 Runtime Control head를 먼저 잠그고 current
`quarantineEventId`/`controlRevision`을 Approval에 고정한다. 실행은 같은 lock 순서로 Approval까지 잠근 뒤
요청·Approval·current head tuple과 `expectedVersion`의 exact equality, 미만료 `ACTIVE`, SoD를 검증하고,
성공 Transaction에서 대상 revision과 Approval `CONSUMED`, Audit/Event/Outbox/Completion을 함께 기록한다.
따라서 과거 격리 사건이나 이전 DISABLED head의 승인, 이미 소비된 승인은 재사용할 수 없다.

### 10.3 Idempotency·Concurrency

- Provider public Receipt unique scope는 `(authenticatedActorRef,operationId,targetType,targetId,
publicIdempotencyKey)`, Platform internal Receipt는 `(callerPlane,authenticatedActorRef,operationId,
targetType,targetId,publicIdempotencyKey)`다. Provider public fingerprint는 HTTP method/path/body/expected
  version/actor scope만 포함하고 `commandId`를 포함하지 않는다. Provider는 Platform 호출 전 첫 Receipt Gate
  Transaction에서 immutable random UUID `commandId`를 한 번 저장한다. Platform fingerprint는 이 저장된
  `commandId`와 public fingerprint를 함께 포함해 양쪽 Receipt를 연결한다.
- `targetId`는 null을 허용하지 않고 두 plane이 같은 규칙으로 만든다. 기존 Resource는 lowercase UUID,
  `CREATE_DEFINITION`은 `targetType=DEFINITION_KEY_HASH`와
  `sha256(UTF-8 canonical definitionKey)`, `CREATE_VERSION`은 `targetType=DEFINITION_SEMVER_HASH`와
  `sha256(lowercase definition UUID + "\n" + normalized SemVer)`, Tenant Policy 최초 Revision은
  `targetType=TENANT_DEFINITION_HASH`와 `sha256(opaque tenantRef + "\n" + lowercase definition UUID)`,
  Release channel은 `targetType=DEFINITION_CHANNEL_HASH`와
  `sha256(lowercase definition UUID + "\n" + STABLE|PREVIEW)`, 선할당 ID 없는 Runtime disable은
  `targetType=RUNTIME_CONTROL_SCOPE_HASH`와
  `sha256(controlScope + "\n" + runtimeTargetType + "\n" + (runtimeTargetId ?? "GLOBAL"))`을 사용한다.
  Tenant Global Runtime Control은 public body 안에서 `runtimeTargetType=GLOBAL,runtimeTargetId=null`이고
  Receipt targetId 자체는 위 hash라 null이 아니다. 정의되지 않은 Command/target
  조합은 Receipt 생성 전 `400 INVALID_INPUT_VALUE`로 거부한다.
- Fingerprint는 HTTP method, exact path template, canonical request body, expected version과 authenticated
  actor/tenant scope의 SHA-256이다. Header 순서와 correlation ID는 제외한다.
- Provider는 current public authentication·permission·SoD를 검증하고 exact service token과 Widget
  assertion bytes를 메모리에서 먼저 만든다. 신규 Receipt+immutable `commandId`와 append-only dispatch
  attempt의 `serviceTokenJti/hash/exp`, `assertionJti/hash/exp`, fence를 한 Transaction에 commit한 뒤 저장
  hash가 같은 artifact만 송신한다. Artifact 준비 실패면 Receipt를 만들지 않는다. Compact artifact는 KMS
  envelope encryption secret row에 seal까지 보관하고 Log·Audit·Outbox에 쓰지 않으며 완료 뒤 DEK를
  폐기한다. Background reconciler는 이를 원 Registry Mutation 재전송에 사용하지 않는다.
- Platform의 영구 Execution Gate는 `commandId` unique, immutable binding,
  `OPEN | SEALED`와 단조 gate version을 가진다. 최초 ingress와 seal 모두 Gate를 insert-or-lock하고 모든
  Transaction lock order는 Gate → Receipt → Target이다. Gate는 Delete/TTL cleanup 금지이며
  `OPEN → SEALED`만 허용한다.
- 상태 Receipt는 `IN_PROGRESS | COMPLETED` 두 개뿐이다. Trust/인증 통과 후 첫 Platform Transaction은
  assertion `exp>db_now`를 확인하고 Gate를 lock한 뒤 `IN_PROGRESS`, 임의 lease owner,
  `fencingToken=1`, `leaseUntil=db_now+2분`을 commit한다. Target Transaction도 Gate와 Receipt를 먼저
  잠그고 assertion expiry와 fence를 다시 검사한 뒤에만 Target lock을 얻는다.
- 상태를 바꾼 성공은 Target·Event·Outbox·`MUTATED` Ledger·`SEALED` Gate·`COMPLETED` Receipt를 같은
  Transaction에 commit한다. 검증 2xx `NO_OP`와 stale version 등 결정적 4xx `REJECTED`는
  Target/Event/Outbox 없이 Ledger·Gate·Receipt만 같은 Transaction에 commit한다. Terminal
  `503 COMMAND_NOT_EXECUTED`도 `NOT_EXECUTED` Ledger로 저장한다. Deferred DB invariant는 모든
  영구 `SEALED Gate ↔ Ledger`의 commandId, binding, status/body hash가 정확히 하나씩 일치하고, 존재하는
  `COMPLETED` Receipt도 같은 값을 가져야 commit을 허용한다. 정상 TTL cleanup 뒤 Receipt 부재는 허용하며
  `IN_PROGRESS` Receipt는 `OPEN` Gate와만 공존하고 Ledger가 없어야 한다.
- 같은 key+fingerprint의 `COMPLETED`는 결정적 2xx/4xx와 terminal
  `503 COMMAND_NOT_EXECUTED`의 status/body/ETag를 byte-equivalent로 재생한다. 다른 fingerprint는
  `409 IDEMPOTENCY_KEY_REUSED`; lease가 유효한 `IN_PROGRESS`는 `409 COMMAND_IN_PROGRESS`와
  `Retry-After: 1`을 반환한다. Receipt TTL 뒤에도 일치하는 SEALED Gate+Ledger가 있으면 Ledger 응답을
  정상 replay한다. Gate/Ledger 중 하나만 있거나, 존재하는 `COMPLETED` Receipt가 둘과 다르면
  `503 COMMAND_COMPLETION_INTEGRITY_FAILURE`와 즉시 page다.
- Provider는 Platform 응답 후 `(receiptId,state=IN_PROGRESS,leaseOwner,fencingToken)`을 잠근 한
  Transaction에서 response·Provider Audit·Outbox·`COMPLETED`를 저장한다. Platform commit 뒤 Provider
  commit 전 crash하면 public retry/background reconciler는 같은 commandId Completion만 읽는다. 새 service
  token/assertion으로 원 Mutation을 다시 보내거나 commandId/internal idempotency key를 바꾸지 않는다.
- Completion GET이 `404`이고 original assertion `exp+30초<db_now`일 때 Provider는 암호화 보관한 original
  artifact와 current reconcile trust를 사용해 `seal-not-executed`만 요청한다. Platform은 original
  signature·hash·JTI·serviceTokenJti·exp·command binding을 검증하고 Gate를 lock한다. Gate가 `OPEN`이고
  Target/Event/Ledger가 없을 때만 terminal Ledger/Receipt를 만들고, `SEALED`면 실제 저장 결과를 반환한다.
  Provider는 이 결과 없이 Public `COMMAND_NOT_EXECUTED`를 합성하지 않는다.
- exp 전에 시작해 DB에서 지연된 ingress/Target과 seal이 경합해도 같은 Gate row가 직렬화한다. Target이
  먼저 완료하면 seal은 실제 결과를 반환하고, seal이 먼저 완료하면 지연 ingress/Target은 terminal 응답만
  replay한다. Target Transaction의 expiry 재검사와 Gate lock 없이 Side Effect를 쓰는 경로는 없다.
- Target commit 전 일시적 DB/network 5xx를 분류하면 응답을 저장하지 않고 현재
  `(leaseOwner,fencingToken)` 일치 조건으로만 해당 receipt를 `IN_PROGRESS`, `leaseUntil=db_now+5초`,
  internal attempt를 증가시킨 뒤 transient `503` + `Retry-After: 5`를 반환한다. 이는 terminal
  `COMMAND_NOT_EXECUTED`와 다른 code이며 Ledger에 저장하지 않는다. Fence를 잃은 Worker는 이 응답도
  갱신하지 않는다. 동일 key는 lease 만료 후만 Platform 내부 takeover하며 별도 `FAILED_RETRYABLE` 상태는 없다.
- Receipt TTL은 일반 Mutation 24시간, Publish/Retire/Policy Publish/Quarantine/Clear/Revoke/Channel
  Transition 7일이다. `IN_PROGRESS.expiresAt`은 항상 `null`이고, 두 번째 Transaction의 `COMPLETED`
  전이와 함께 `completedAt=db_now`, `expiresAt=completedAt+해당 TTL`을 저장한다. Cleanup은
  `state=COMPLETED AND expiresAt<=db_now`만 batch 삭제하며 `IN_PROGRESS`는 생성 시각이나 lease 만료와
  무관하게 절대 삭제하지 않는다. 만료 lease는 takeover로만 회수하고 반복 takeover나 Event/Target
  불일치는 integrity page 대상으로 둔다. TTL 삭제는 Completion Ledger/Event/Audit/Outbox를 삭제하지 않는다.
- Handler crash로 lease가 만료된 `IN_PROGRESS`는 receipt row를 잠근 Claim Transaction에서만 takeover할
  수 있다. Claim은 Gate→Receipt 순으로 잠그고 `leaseUntil<=db_now`를 다시 확인하며 새 `leaseOwner`,
  `fencingToken+1`, internal attempt+1을 commit한다. 이전 Worker는 새 fence 때문에 Target lock 전에
  중단된다. Event/Target이 있는데 Ledger/Completed Receipt가 없으면 무결성 사고로 page하고 재실행하지
  않는다. Gate가 `OPEN`, assertion이 아직 유효하고 Event/Target 변경이 없을 때만 저장된 검증 claim으로
  Platform 내부 실행을 재개한다. Assertion이 만료됐으면 Target을 건드리지 않고 terminal seal한다.
  불가역 상태의 새 key 재실행은 `RESOURCE_CONFLICT`다.

### 10.4 Reconciliation·Capacity 운영 계약

- Provider Reconciler는 15초마다, Platform Finalizer는 30초마다 `FOR UPDATE SKIP LOCKED` 최대 100건을
  claim한다. 외부 Completion read/seal timeout은 connect 500ms/read 2초이고 claim마다 lease를
  `db_now+30초`로 CAS 연장한 뒤 호출한다. Fence를 잃으면 결과를 쓰지 않는다.
- Retry는 DB `next_attempt_at` 기준 `5s·2^min(consecutiveFailures,6)`에 full jitter를 적용하고 5분으로
  cap한다. 같은 command를 병렬 polling하지 않는다. Binding/integrity mismatch는 즉시 page,
  연속 10회 실패 또는 oldest unresolved age 15분은 해당 Service on-call page다.
- 필수 Metric은 `dwp_widget_command_reconciliation_backlog{service}` Gauge,
  `dwp_widget_command_reconciliation_oldest_age_seconds{service}` Gauge,
  `dwp_widget_command_reconciliation_attempts_total{service,outcome}` Counter,
  `dwp_widget_command_integrity_failures_total{service,reason}` Counter다. 허용 outcome은
  `COMPLETED|NOT_FOUND|IN_PROGRESS|SEALED_NOT_EXECUTED|RETRY|ERROR`, reason은
  `GATE_WITHOUT_LEDGER|LEDGER_WITHOUT_GATE|COMPLETED_RECEIPT_MISMATCH|OPEN_GATE_STATE_MISMATCH|EVENT_WITHOUT_LEDGER|BINDING_MISMATCH|STALE_FENCE`다.
- Ledger는 commandId hash 32 partition, response 최대 64KiB, 24개월 forecast headroom을 유지한다.
  저장공간 70% warning/85% page, WAL/PITR RPO 5분·RTO 60분, 일일 Backup 35일, 분기 Restore Drill에서
  row count·binding/response hash 표본·Receipt TTL 이후 replay를 검증한다. Ledger/Gate 삭제는 복구 수단이 아니다.

## 11. Event·Metric·SLO 계약

Registry Event Envelope v1:

```json
{
  "schemaVersion": 1,
  "eventId": "uuid",
  "commandId": "uuid",
  "eventType": "WIDGET_VERSION_QUARANTINED",
  "aggregateType": "WIDGET_VERSION",
  "aggregateId": "uuid",
  "aggregateSequence": 17,
  "occurredAt": "RFC-3339",
  "correlationId": "uuid",
  "actor": {
    "plane": "PROVIDER",
    "auditRefHash": "lowercase-sha256"
  },
  "target": {
    "definitionId": "uuid",
    "versionId": "uuid"
  },
  "reasonCode": "SECURITY_INCIDENT",
  "projectionSchemaVersion": 1,
  "projectionType": "VersionState",
  "beforeHash": "sha256",
  "afterHash": "sha256"
}
```

Payload에는 stable operator/session ref, 업무·사용자 Data, Widget 결과, Query, Credential을 넣지 않는다.
Raw actor/session은 접근통제된 Provider/Platform Audit Store에만 두고 Event는 correlation ID와
`auditRefHash`로 연결한다. Tenant Policy event만
ACL로 보호된 opaque `tenantRef` routing key를 허용하며 raw Tenant ID나 이름은 금지한다. Consumer는
`schemaVersion+eventId`로 Idempotent 처리하고 알 수 없는 Version을 Allow로 해석하지 않는다. Outbox
partition key는 `aggregateType:aggregateId`이고 같은 Aggregate의 `aggregateSequence`는 1부터 단조 증가한다.
Consumer는 gap을 발견하면 해당 Aggregate projection을 중단하고 replay를 요청하며 다른 Aggregate까지
전역 정지하지 않는다.

Public/Internal command가 만든 Event는 `commandId`가 필수이고 Completion Ledger를 참조한다. 같은 command가
복수 Event를 만들 수 있으므로 Event unique는 `(commandId,eventType,aggregateId,aggregateSequence)`이고
Ledger의 `commandId` 자체는 unique다. Scheduler/Shadow observer Event는 event-family JSON Schema 분기에서
`commandId`를 생략하고 각각 causeDigest/evaluation ID를 Idempotency 근거로 사용한다.

필수 Event Catalog v1:

| Aggregate         | Event type                                                                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Definition        | `WIDGET_DEFINITION_CREATED`, `WIDGET_DEFINITION_RETIRED`                                                                                                                                            |
| Version workflow  | `WIDGET_VERSION_CREATED`, `WIDGET_VERSION_UPDATED`, `WIDGET_VERSION_VALIDATED`, `WIDGET_VERSION_SUBMITTED`, `WIDGET_VERSION_APPROVED`, `WIDGET_VERSION_REJECTED`, `WIDGET_VERSION_REWORKED`         |
| Evidence          | `WIDGET_EVIDENCE_RECORDED`, `WIDGET_EVIDENCE_WAIVED`, `WIDGET_EVIDENCE_EXPIRED`                                                                                                                     |
| Release           | `WIDGET_VERSION_PUBLISHED`, `WIDGET_VERSION_DEPRECATED`, `WIDGET_CHANNEL_PROMOTED`, `WIDGET_CHANNEL_ROLLED_BACK`                                                                                    |
| Safety            | `WIDGET_VERSION_QUARANTINED`, `WIDGET_QUARANTINE_CLEAR_APPROVED`, `WIDGET_QUARANTINE_CLEARED`, `WIDGET_VERSION_REVOKED`, `WIDGET_RUNTIME_CONTROL_CHANGED`, `WIDGET_RUNTIME_CONTROL_ENABLE_APPROVED` |
| Tenant policy     | `TENANT_WIDGET_POLICY_PUBLISHED`, `TENANT_WIDGET_POLICY_REVOKED`, `TENANT_WIDGET_POLICY_ROLLED_BACK`                                                                                                |
| Shadow operations | `WIDGET_ROLLOUT_APPROVED`, `WIDGET_ROLLOUT_ACTIVATED`, `WIDGET_ROLLOUT_STOPPED`, `WIDGET_SHADOW_MISMATCH_DETECTED`, `WIDGET_SHADOW_RECOVERED`                                                       |

Event별 required target ID와 before/after hash는
[`fixtures/widget-registry-event.v1.schema.json`](fixtures/widget-registry-event.v1.schema.json)의 top-level
closed `oneOf`로 고정한다. 30종 Catalog, command/scheduler/shadow positive·negative, CREATE absent-state
sentinel, Event별 reason taxonomy와 Gregorian UTC timestamp 검증의 독립 digest는
[`fixtures/widget-registry-event.v1.examples.json`](fixtures/widget-registry-event.v1.examples.json),
[`fixtures/verify-registry-event-contract.mjs`](fixtures/verify-registry-event-contract.mjs)가 검증한다.
Command event는 `commandId+actor.auditRefHash`, Evidence expiry는 command/actor 없이 `causeDigest`, Shadow는
command/actor 없이 `evaluationId`를 각각 강제한다. Shadow mismatch event에는 raw Tenant ID/User ID/Definition
제목 대신 rollout ring, surface, placement context, diff bucket, opaque aggregate ref만 허용한다.

Command/Evidence-expiry producer는 locked DB row의 closed V1 projection을 RFC 8785 JCS로 canonicalize하고
`projectionSchemaVersion=1`, eventType별 exact `projectionType`, before/after SHA-256을 함께 기록한다. CREATE
before는 canonical `null`만 허용한다. `VersionState`의 validation/clearance child와 `RuntimeControlHead`의 enable
Approval은 event target과 exact 결속하고 Evidence는 raw ref 대신 hash만 포함한다. Shadow observer family는
projection metadata/hash 자체를 금지한다.

필수 Metric은 이름·type·unit·label/bucket을 고정한다.

| Metric name                                                   | Type      | Unit     | 허용 label / histogram bucket                               |
| ------------------------------------------------------------- | --------- | -------- | ----------------------------------------------------------- |
| `dwp_widget_shadow_evaluations_total`                         | Counter   | request  | `outcome,surface,placement_context,ring`                    |
| `dwp_widget_shadow_diff_total`                                | Counter   | diff     | `diff_bucket,surface,placement_context,ring`                |
| `dwp_widget_shadow_evaluation_duration_seconds`               | Histogram | seconds  | `outcome,ring`; `0.005,0.01,0.025,0.05,0.1,0.15,0.25,0.5,1` |
| `dwp_widget_effective_evaluation_duration_seconds`            | Histogram | seconds  | `outcome`; `0.005,0.01,0.025,0.05,0.1,0.25,0.5,1`           |
| `dwp_widget_effective_denials_total`                          | Counter   | decision | `reason_bucket,surface,placement_context`                   |
| `dwp_widget_safety_enforcement_delay_seconds`                 | Histogram | seconds  | `control_scope`; `1,5,10,15,30,60,120,300`                  |
| `dwp_widget_outbox_oldest_unpublished_age_seconds`            | Gauge     | seconds  | `service`                                                   |
| `dwp_widget_outbox_delivery_total`                            | Counter   | event    | `service,outcome,event_family`                              |
| `dwp_widget_idempotency_total`                                | Counter   | command  | `operation_family,outcome`                                  |
| `dwp_widget_shadow_queue_depth`                               | Gauge     | task     | `service`                                                   |
| `dwp_widget_shadow_queue_depth_above_230_consecutive_seconds` | Gauge     | seconds  | `service,ring`                                              |
| `dwp_widget_shadow_queue_rejections_total`                    | Counter   | task     | `service,ring`                                              |
| `dwp_widget_shadow_snapshot_rejections_total`                 | Counter   | request  | `reason,ring`                                               |
| `dwp_widget_shadow_unsafe_allow_total`                        | Counter   | decision | `ring`                                                      |
| `dwp_widget_shadow_drill_delay_seconds`                       | Histogram | seconds  | `scenario,ring`; `1,5,10,15,30,60,120`                      |
| `dwp_widget_shadow_drill_max_delay_seconds`                   | Gauge     | seconds  | `scenario,ring`                                             |
| `dwp_widget_shadow_legacy_mismatch_total`                     | Counter   | mismatch | `kind,ring`                                                 |
| `dwp_widget_outbox_dead_letter_total`                         | Counter   | event    | `service,event_family`                                      |
| `dwp_widget_command_reconciliation_backlog`                   | Gauge     | command  | `service`                                                   |
| `dwp_widget_command_reconciliation_oldest_age_seconds`        | Gauge     | seconds  | `service`                                                   |
| `dwp_widget_command_reconciliation_attempts_total`            | Counter   | attempt  | `service,outcome`                                           |
| `dwp_widget_command_integrity_failures_total`                 | Counter   | incident | `service,reason`                                            |

Label 값도 폐쇄형이다.

- `surface=workspace-home`
- `placement_context=CLASSIC_PERSONAL|FLOW_PERSONAL|FLOW_GOVERNED`
- `ring=staging-bootstrap|staging-shadow`
- `diff_bucket=STATIC_ONLY|SHADOW_ONLY|STATE_MISMATCH|ADDABILITY_MISMATCH|VERSION_UNRESOLVED|BINDING_MISMATCH|SAFETY_MISMATCH`
- `reason_bucket=GLOBAL|LIFECYCLE|CERTIFICATION|BINDING|TENANT_POLICY|ENTITLEMENT|PERMISSION|AUDIENCE|SURFACE|HOST|ERROR`
- `control_scope=CATALOG_MUTATIONS|CATALOG_DISCOVERY|RUNTIME_RENDER|RUNTIME_ACTION`
- `service=platform|provider`
- `event_family=definition|version|evidence|release|safety|tenant_policy|rollout|shadow`
- `operation_family=definition_write|version_workflow|evidence|release|safety|tenant_policy|rollout`
- drill `scenario=KILL_DECISION|QUARANTINE_DECISION|WOULD_DENY|WOULD_STOP_DATA`, legacy mismatch
  `kind=PAYLOAD|DATA`
- snapshot `reason=MISSING_CLAIM|ENTRY_LIMIT|SIZE_LIMIT|EXPIRED|READ_TIMEOUT|AUTHORITY_UNAVAILABLE|INVALID_REFERENCE|ERROR`
- Shadow evaluation/duration `outcome=MATCH|DIFF|SKIPPED|ERROR|TIMEOUT`, Effective evaluation duration
  `outcome=ALLOW|DENY|ERROR|TIMEOUT`, Outbox delivery `outcome=PUBLISHED|RETRY|DEAD_LETTER|ERROR`,
  Idempotency `outcome=FIRST|REPLAY|IN_PROGRESS|FINGERPRINT_CONFLICT|TAKEOVER|STALE_FENCE|ERROR`

알 수 없는 내부 값은 새 label을 만들지 않고 해당 metric의 `ERROR` 또는 정해진 `ERROR` bucket으로
접은 뒤 별도 structured log를 남긴다.

`definitionId`, `tenantId`, `userId`, actor, semantic version, config와 reason text는 Metric label 금지다.

### 11.1 Shadow enable·자동 중단 Gate

최초 진입을 위한 `BOOTSTRAP_SHADOW` 운영 단계와 상위 ring 승격 Gate를 분리한다.
`BOOTSTRAP_SHADOW`는 별도 실행 mode나 응답 mode가 아니라 staging 내부 ring 선택값이며 외부 응답은
계속 `STATIC`이다.

Observer는 bootstrap과 정상 `SHADOW` 모두 03의 동일 HMAC bucket을 계산해 active
Head의 `ring_bps` 안인 요청만 enqueue한다. 정상 SHADOW라도 bucket 밖이면 응답 mode `STATIC`, observer
off, legacy Runtime이며 Head/Approval/selector key 불일치도 같은 fail-safe 결과다.
HMAC lineage는 promotion마다 바뀌는 `rolloutRevision`이 아니라 Head가 carry-forward하는
`bootstrapPrerequisiteId`다. 따라서 1% cohort는 10%와 100% cohort에 항상 포함된다. Selector key는
재사용 금지 ACTIVE registry row/HSM handle로 해석하고 ACTIVE Head가 참조하는 동안 rotate/retire하지 않는다.

최초 bootstrap enable은 Migration/Golden/Contract/negative Test, Flags-off byte regression, 비주입 seam,
Metric·Alert·Runbook 생성과 Owner 승인을 모두 통과한 뒤 03의 Rollout 원장에
`BOOTSTRAP/ACTIVE,to_ring_bps≤100` Approval revision을 기록하고 같은 Transaction으로 `BOOTSTRAP` Head를
활성화한 staging ring에만 허용한다.
Approval 생성 뒤 10분 이내 활성화해야 한다. 활성화 Transaction은 current build/migration/catalog/binding/
policy/safety/head, selector key ACTIVE 상태, Bootstrap/CI provenance를 다시 비교하고 Promotion이면
최초 JWS 검증의 immutable Authority verification record를 Evidence/Approval과 exact 결속한 뒤 immutable
snapshot을 다시 읽어 query-set/window/Gate를 재계산한다. Raw JWS hash만으로 signature를 다시 검증했다고
간주하지 않는다. 생성 뒤 변한 provenance나 stale
evidence는 Head를 바꾸지 않으며 trust source 장애도 fail closed한다.
아직 없는 24시간 Metric을 bootstrap 선행조건으로 요구하지 않으며, 아래 자동 중단 Gate는
첫 평가부터 즉시 적용한다.

1%보다 큰 staging ring 승격은 다음 모든 조건을 만족한 current active ring의 단일 연속 24시간
evidence와 Platform Control Plane owner 승인이 있어야 canonical evidence digest를 가진
`PROMOTION/ACTIVE` Approval revision과 `SHADOW` Head를 생성한 뒤 Flag Controller가 수락한다.
최초 bootstrap ring에서의 승격은 `ring=staging-bootstrap`, 이후 `SHADOW` ring 승격은
`ring=staging-shadow` evidence만 허용하며 predecessor rollout revision과 exact 결속한다.
Evidence window 시작 시각 전에 해당 predecessor가 `ACTIVATE`됐고 window 종료까지 같은 revision이 연속
`ACTIVE`여야 한다. window 안의 `STOP`, `EXPIRE`, 동일 revision 재활성화 또는 세 authoritative head tuple
변경은 전체 window를 무효화한다.

- 총 Shadow evaluation `≥100,000`, `CLASSIC_PERSONAL`, `FLOW_PERSONAL`, `FLOW_GOVERNED` 각각
  `≥1,000`
- `STATIC_ONLY|SHADOW_ONLY|STATE_MISMATCH|ADDABILITY_MISMATCH|VERSION_UNRESOLVED|BINDING_MISMATCH|SAFETY_MISMATCH`
  합계 `0`
- Revoked/Quarantined/Global Kill 대상을 Allow한 평가 `0`
- rolling 15분 queue rejection rate `≤0.1%`, evaluation error rate `≤0.5%`, evaluation duration p99
  `≤150ms`; 어떤 1분 bucket도 각각 `1%`, `2%`, `250ms`를 넘지 않음
- queue depth가 256의 90%(`230`)를 5분 연속 초과하지 않음
- outbox oldest unpublished age `≤30초`, rolling 5분 delivery error rate `≤1%`, DLQ 증가 `0`
- Kill/Quarantine staging drill의 Shadow control-decision 전파 p99 `≤30초`,
  would-deny/would-stop-data 판정 전파 최대 `≤60초`, legacy Payload/Data는 byte-equivalent 무변경

활성화 후에는 아래 조건을 자동 중단·승격 차단 Gate로 고정한다. Bootstrap과 정상 Shadow는 같은
중단 신호를 쓰되 활성화 수단을 교차 사용하지 않는다.

- `STAGING_BOOTSTRAP` 중단: 같은 원장 Transaction에서 해당 bootstrap approval을 `REVOKED`, Head를
  `STATIC/ring=0`, `rolloutRevision+1`로 먼저 바꾼 뒤 `widget-catalog-shadow-bootstrap-enabled=false`로
  내려 기존 hash ring 선택을 폐기한다. 이 단계의
  `widget-catalog-shadow-enabled`는 시작부터 끝까지 `false`다.
- 정상 `SHADOW` 중단: 같은 원장 Transaction에서 promotion approval과 Head를 먼저 폐기한 뒤
  `widget-catalog-shadow-enabled=false`로 내리며 bootstrap flag는 계속 `false`다.
- 두 경우 모두 observer가 실제로 off이고 legacy Runtime이 byte-equivalent로 유지됐음을 확인해야
  중단 완료다. Controller는 두 flag를 동시에 `true`로 만들거나 폐기된 approval을 재사용할 수 없다.
- 매 evaluation은 DB clock으로 active Approval expiry를 재확인하고 만료/DB-time 조회 실패 시 enqueue하지
  않는다. 15초 주기 idempotent `RolloutExpiryScheduler`는 03의 deterministic command ID와 row lock으로
  Approval `EXPIRED`+Head `STATIC`+Event/Outbox/Receipt를 원자 기록한다. Scheduler 지연 중에도 evaluator의
  per-request check가 hard stop을 보장한다.

- 비안전 Allow 1건은 Security, mismatch 1건은 Control Plane, DLQ 증가 1건은 Platform Data에 각각 즉시
  중단·page한다.
- queue rejection `>1%` 또는 evaluation error `>2%`가 연속 1분: 중단
- evaluation p99 `>250ms`가 5분, queue depth `>230`이 5분: 중단
- outbox age `>30초`가 5분: warning; `>60초`가 2분 또는 delivery error `>1%`가 5분:
  중단·Platform Data page

모든 window는 `dwp_widget_*` 원본 Metric으로 계산하고 수동 무시를 금지한다. 중단 후는 원인
수정·Owner 승인 후 다시 최대 1% bootstrap에 진입하고, 새 24시간 window를 통과해야 상위
ring으로 재승격한다.

운영 Artifact와 Owner는 다음과 같이 고정한다. 경로의 문서가 실제로 생성되고 staging drill evidence가
연결되기 전에는 `SHADOW`를 켜지 않는다.

- Dashboard: [`operations/widget-shadow-dashboard.v1.json`](operations/widget-shadow-dashboard.v1.json)
- Alert set: [`operations/widget-shadow-alerts.v1.json`](operations/widget-shadow-alerts.v1.json)
- Alert contract: [`operations/widget-shadow-alerts.v1.schema.json`](operations/widget-shadow-alerts.v1.schema.json),
  [`operations/widget-shadow-alerts.v1.negative.json`](operations/widget-shadow-alerts.v1.negative.json),
  [`operations/verify-shadow-alert-contract.mjs`](operations/verify-shadow-alert-contract.mjs)

| Runbook artifact                                     | Owner                                        | Trigger·필수 종료 조건                                                             |
| ---------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `docs/07-runbooks/widget-shadow-stop.md`             | Platform Control Plane on-call               | queue/error SLO 초과; shadow flag off와 legacy 무변경 확인                         |
| `docs/07-runbooks/widget-catalog-kill.md`            | Platform Security on-call                    | mutation/discovery incident; kill revision 전파 확인                               |
| `docs/07-runbooks/widget-quarantine.md`              | Product Security + Provider                  | Phase 1A 30초 decision/60초 would-deny+무주입; Authoritative에서 실제 data 차단    |
| `docs/07-runbooks/widget-channel-rollback.md`        | Provider Release on-call                     | release regression; previous head와 새 event 확인                                  |
| `docs/07-runbooks/widget-policy-rollback.md`         | Tenant Experience on-call                    | tenant policy regression; 새 revision·영향 Tenant 한정 확인                        |
| `docs/07-runbooks/widget-outbox-replay.md`           | Platform Data on-call                        | age/error alert; aggregate gap 0·DLQ 처리                                          |
| `docs/07-runbooks/widget-command-reconciliation.md`  | Provider Control + Platform Registry on-call | backlog 15분/무결성 오류; Gate·Ledger·Receipt 일치와 저장 응답 회수                |
| `docs/07-runbooks/widget-binding-catalog-release.md` | Platform Release owner                       | Fixture/DB digest mismatch·축소 영향; forward-only abort/rollback과 readiness 복구 |
| `docs/07-runbooks/widget-authoritative-recovery.md`  | Platform Control Plane on-call               | fail-closed incident; 정적 fallback 없이 authority 복구                            |

## 12. Migration Reservation Ledger

구현 시작 시 PR/작업공간에 다음 Ledger를 먼저 기록한다.

| 서비스   | HEAD 추적 최신 | 작업트리 최신 | 예약 번호 | Owner            | 조회 시각        | 상태    |
| -------- | -------------- | ------------- | --------- | ---------------- | ---------------- | ------- |
| Platform | `V182`         | `V200`        | 미예약    | 동시 작업 미합의 | 2026-08-27 15:01 | BLOCKED |
| Provider | `V37`          | `V49`         | 미예약    | 동시 작업 미합의 | 2026-08-27 15:01 | BLOCKED |
| Auth     | `V98`          | `V106`        | 미예약    | 동시 작업 미합의 | 2026-08-27 15:01 | BLOCKED |

Platform `V183–V187/V190–V200`, Provider `V38–V49`, Auth `V99–V106`이 snapshot 시점 untracked 동시 작업이다. 파일 생성
직전 다시 조회하고 Owner가 병합·재배치한 뒤 번호를 예약한다. 문서의 다음 숫자를 예약으로 간주하지 않는다.

## 13. Release Gate

Phase 1A 내부 완료:

- Flags Off에서 기존 Preference Hash·Home 동작 무변경
- TS/Java/DB Seed 5종 Golden Parity
- Published Manifest 불변성과 Lifecycle·SoD·Idempotency·Concurrency Test
- Manifest Parent/Product/App/Renderer/Capability binding Negative Test
- Platform commit→Provider commit crash, 권한 회수, Receipt TTL 경과 후 Completion Ledger reconcile Test
- Identity/Provider signing key rotation 뒤 old key `VERIFY_ONLY` terminal seal·durable key auditor Drill
- Evidence/waiver 만료 즉시 deny·SYSTEM quarantine·복구 전 clear 거부 Test
- Policy/Projection/예외 부재 시 DENY
- 신규 Publish가 Layout·Allow·Instance를 생성하지 않음
- Provider Registry/Completion Internal Endpoint와 Rollout Operations Gateway 미노출
- Platform·Provider·Gateway OpenAPI와 Generated Client 동기화
- Shadow Diff 0, Audit/Event Replay, Dashboard·Alert 준비

Authoritative 전환 차단:

Phase 1A에서 30초/60초는 control decision과 would-deny 관찰치이다. 실제 Widget Data 차단
`≤60초`는 Phase 1B Authoritative legacy Runtime Guard에 연결한 뒤 다시 Drill하는 별도 전환 Gate이다.

- Revoke·Quarantine가 Runtime Guard에 연결되지 않음
- Positive Allow Cache가 Safety Revision 없이 존재
- Shadow Mismatch 또는 Revoked Allow가 1건 이상
- Kill Enforcement p99 30초 초과 또는 Data 차단 60초 초과
- Registry 장애 시 정적 Fallback
- Cross-tenant 누출 또는 현재 5종의 실제 승인·인증 증거 부재

## 14. 다음 착수 명령 순서

1. Backend Dirty Owner·Migration 최신 번호·AGENTS 지침 재확인
2. Platform Schema와 Domain State Test를 Flag Off로 추가
3. Tenant default-deny와 기존 Tenant Backfill을 같은 Review에 포함
4. Pure Effective Evaluator와 Golden Parity Fixture 추가
5. Safety·Idempotency·Audit·Outbox를 완성
6. Provider Façade와 명시적 Security Route 추가
7. OpenAPI·Generated Client 동기화
8. `SHADOW`만 활성화하고 Diff·Kill Drill 수행
9. 별도 승인 전 `AUTHORITATIVE` Flag를 생성하더라도 활성화하지 않음
