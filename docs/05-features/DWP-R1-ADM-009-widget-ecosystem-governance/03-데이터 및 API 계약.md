# DWP-R1-ADM-009 데이터 및 API 계약

## 1. 현재 계약과 안전 경계

- `PLATFORM.HOME_WIDGET` Code Set과 Frontend Registry는 5개 Native Key를 전제로 한다.
- `usr_home_preferences.layout_payload.widgets[].widgetKey`는 Definition과 Instance를 구분하지 않는다.
- `usr_home_widget_configurations`는 `(view_id, widget_key)`당 한 행이다.
- `adm_home_templates`와 관련 API는 단일 Widget이 아니라 전체 Home Layout Snapshot이다.
- Provider Definition Lifecycle, Tenant Widget Policy, Runtime Broker, User Widget Preset Backend는 아직 없다.
- 현재 Frontend Library는 로그인 사용자의 Entitled App과 정적 Registry를 교차해 항목을 만들며, 원천
  데이터 ACL이나 동적 Tenant 정책을 대체하지 않는다.
- `useSystemCodeOptions`는 Code 조회 실패나 값 불일치 시 정적 5개 Key로 복귀하므로
  `PLATFORM.HOME_WIDGET`를 Kill·Tenant Allow·인증 권한원장으로 사용하지 않는다.

Phase 0은 현재 API를 사용해 Catalog의 의미와 배치 상태를 개선한다. 정적 선언을 Provider 인증,
Tenant 허용, 동적 회수 증거로 표시하지 않는다.

## 2. 권한원장 결정

Definition과 Version의 단일 권한원장은 `dwp-platform-server`다.

```text
Provider Control UI
  → dwp-provider-server: Provider RBAC·SoD·Operator 감사 파사드
  → 전용 Internal Service Identity
  → dwp-platform-server: Definition·Version·Release·Safety 단일 권한원장

Tenant Admin / End User
  → dwp-platform-server
  → Published Tenant Policy
  → Effective Catalog Evaluator
```

Provider DB에 Definition을 따로 소유하거나 비동기 복제본을 권한원장으로 사용하지 않는다. Quarantine와
Revoke는 Projection 지연 중에도 Platform의 최종 판정을 우회할 수 없어야 한다. Provider는 공개
명령의 신원·권한·분리 승인을 검증한 뒤 Platform이 상태 전이를 다시 검증하도록 호출한다.

## 3. Phase 1A Control-plane Shadow Bundle

Phase 1A는 일부 테이블만 먼저 만들고 Runtime에 연결하는 단계가 아니다. 다음 항목을 하나의 Shadow
Bundle로 구현하고, 정적 Runtime의 권한원이 되지는 않는다.

포함:

- Definition Registry와 불변 Version
- 검토·인증 증거
- Release Channel과 긴급 Quarantine·Revoke
- `정책 없음 = DENY`인 최소 Tenant Policy Revision
- Effective Catalog Evaluator와 Shadow Diff
- Global·Definition·Version Kill Switch
- Idempotency, Optimistic Lock, Audit, Outbox, Metrics
- 현재 정적 5종 Seed와 Golden Parity
- `STATIC | SHADOW | AUTHORITATIVE`의 서버 소유 Migration Mode

제외:

- `usr_home_widget_instances`와 Layout v6
- Runtime Broker와 신규 Data Source
- Widget Preset 생성·공유
- 임의 JavaScript·HTML·iframe·URL·SQL·자유형 JSON Builder
- 현재 Home Preference 정규화 또는 정적 Runtime 경로의 변경

## 4. Platform 데이터 모델

### 4.1 Definition·Version·Release

`plt_widget_definitions`

- `definition_id`, canonical `definition_key`, 호환용 `legacy_widget_key`
- owner app/product/team, risk tier, data classification
- Definition 상태 `ACTIVE | RETIRED`
- optimistic `version`, 생성·수정 감사 Column

`legacy_widget_key`는 일반 API 입력이 아니다. DB는 non-null 값에 partial unique index와
`command-rail|daily-brief|focus|schedule|activity` exact CHECK를 두고, 오직 첫 Migration의
`SYSTEM_MIGRATION` role만 다섯 canonical mapping을 insert할 수 있다. Application role의 create는 항상
`null`이고 trigger가 이후 변경을 거부한다. 따라서 새 Definition이 기존 Shadow key를 사칭하거나 하나의
legacy key가 여러 Definition에 매핑될 수 없다.

`definitionKey`는 길이 3..128의 ASCII lowercase 문자열이며
`^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$`를 만족해야 한다. 공백·Unicode·대문자·연속/말단 separator를
정규화하지 않고 거부하며, 검증을 통과한 ASCII/UTF-8 byte 자체가 canonical key다. API, DB unique,
Manifest, Golden mapping과 Receipt hash가 모두 같은 byte를 사용한다.

`plt_widget_definition_versions`

- `definition_version_id`, `definition_id`, unique semantic version
- manifest schema version, canonical manifest JSON, SHA-256
- renderer/config/data/action 계약과 predecessor/replacement
- Workflow `DRAFT | SUBMITTED | APPROVED | REJECTED`
- Release `UNPUBLISHED | PUBLISHED | DEPRECATED`
- Safety `CLEAR | QUARANTINED | REVOKED`
- Attestation `PENDING | PROVIDER_CERTIFIED | LEGACY_UNVERIFIED`
- 작성·승인·게시·차단 actor/timestamp와 optimistic `version`

Semantic Version 입력은 길이 1..128의 ASCII SemVer 2.0.0 exact grammar만 허용한다. Core는
`major.minor.patch` 세 숫자가 모두 있어야 하고 숫자 식별자의 leading zero, 공백, Unicode, 빈 prerelease/build
identifier를 거부한다. prerelease/build identifier의 대소문자와 순서는 보존한다. 이 검증을 통과한 입력 자체의
ASCII/UTF-8 byte가 `normalizedSemVer`이며 별도 NFKC·대소문자 변환은 하지 않는다. Definition 내 unique,
Manifest, API response, Receipt의 `DEFINITION_SEMVER_HASH`가 모두 이 동일 byte를 사용한다.

상태 축을 하나의 Lifecycle enum으로 합치지 않는다. `PUBLISHED` manifest는 API와 DB Guard 양쪽에서
수정 불가다. `DEPRECATED`는 Safety·현재 Evidence Gate가 유효한 기존 실행만 허용하고 신규 추가는 금지하며, `REVOKED`는
불가역이다. Rollback은 과거 행 수정이 아니라 Channel Head 또는 새 Policy Revision으로 수행한다.

`plt_widget_release_channels`

- `(definition_id, STABLE | PREVIEW)` unique
- current/previous version, optimistic `version`
- Promote와 Rollback은 Registry Event를 남긴다.

`plt_widget_certification_evidence`

- `MANIFEST | SECURITY | PRIVACY | A11Y | PERFORMANCE | LOCALIZATION`
- `NOT_RUN | PASS | FAIL | EXPIRED | WAIVED`
- manifest hash, evidence reference/hash, expiry, reviewer
- append-only이며 실제 행이 없으면 UI에 `인증 완료`라고 표시하지 않는다.

Approve와 Publish는 동일 Manifest hash에 대한 최신 Evidence를 DB clock 기준으로 다시 평가한다.
Gate는 아래 표가 전부이며 암묵적 waiver나 Risk별 생략은 없다.

| Evidence type | `LOW | MEDIUM` 허용 상태 | `HIGH` 허용 상태 | Waiver |
| -------------- | ------------------------- | ---------------- | ------ |
| `MANIFEST` | 유효한 `PASS` | 유효한 `PASS` | 금지 |
| `SECURITY` | 유효한 `PASS` | 유효한 `PASS` | 금지 |
| `PRIVACY` | 유효한 `PASS` | 유효한 `PASS` | 금지 |
| `A11Y` | 유효한 `PASS` | 유효한 `PASS` | 금지 |
| `PERFORMANCE` | 유효한 `PASS | WAIVED` | 유효한 `PASS` | 조건부 |
| `LOCALIZATION` | 유효한 `PASS | WAIVED` | 유효한 `PASS` | 조건부 |

조건부 waiver는 `LOW | MEDIUM`의 `FAIL | EXPIRED` Performance 또는 Localization Evidence에만 새
append-only Decision으로 추가한다. exact Manifest hash와 원 Evidence ID, 만료 시각, 사유, 추적 Ticket을
요구하고 waiver actor는 Version author 및 원 reviewer와 달라야 한다. 해당 waiver를 사용하는 최종 Version
approver도 waiver actor와 달라야 하며 `WidgetReviewDecisionRequest.evidenceIds[]`에 원 Evidence ID와 waiver
Decision ID를 모두 넣는다. `WAIVED`는 만료 전까지만 PASS-equivalent이며 원 Evidence 행을 갱신하지 않는다.
만료·Manifest hash 불일치·새 Evidence가 기록되면 Gate를 다시 계산한다. UI는 `인증 완료`와 별도로 waiver
Badge와 만료를 표시한다.

### 4.2 Manifest Binding Authority

Manifest 검증이 아직 존재하지 않는 외부 Product Catalog를 암묵적으로 호출하지 않도록, Phase 1A의 단일
권한원은 Platform DB의 `WidgetManifestBindingCatalog`로 고정한다. 이는 Tenant의 `adm_workspace_apps`,
Provider Code Set, Frontend Registry를 복제한 것이 아니라 Widget Manifest가 참조할 수 있는
Product·App·Authority·Native Renderer·Capability의 폐쇄형 Release Catalog다. Phase 1A에서는 별도
온라인 Catalog Control Plane을 만들지 않는다. 서명·Review된 Platform Release Artifact와 forward-only
Flyway Migration만 이 Catalog를 바꿀 수 있고 Application Runtime, Browser, Provider와 Tenant API에는
Writer나 activation route가 없다.

`plt_widget_binding_catalog_revisions`

- `catalog_revision_id=sha256(RFC8785-JCS exact catalog object)` lowercase 64자, `schema_version=1`
- 세 Component의 content digest인 `product_app_revision`, `renderer_revision`, `capability_revision`
- signed release artifact digest, source fixture byte digest, Migration version, 생성 시각
- Content-addressed append-only이며 Update/Delete를 금지한다.

`plt_widget_binding_product_apps`

- `(catalog_revision_id,product_key,source_app_resource_key)` unique
- `ACTIVE | INACTIVE`, exact Authority set와 그 JCS digest
- Product↔App은 다대다를 허용하지만 다른 Product의 row를 상속하지 않는다.

`plt_widget_binding_renderers`

- `(catalog_revision_id,renderer_key)` unique
- `kind=NATIVE`, owner Product/App, minimum/maximum Host API Version, `ACTIVE | DISABLED`
- 같은 renderer key의 Product/App 재사용과 runtime code·URL 저장을 금지한다.

`plt_widget_binding_capabilities`

- `(catalog_revision_id,product_key,source_app_resource_key,capability_type,capability_key)` unique
- `capability_type=SOURCE | DATA | ACTION`; key 비교는 정규화나 prefix match 없는 exact byte 비교다.

`plt_widget_binding_catalog_head`

- singleton `environment=PLATFORM`, current/previous catalog revision과 단조 `head_version`
- Application role에는 `SELECT`만 허용한다. Head 변경은 Flyway migration role이 새 Revision 전체의
  Schema·digest·참조 무결성을 검증하고 expected head version으로 CAS한 뒤 append-only
  `plt_widget_binding_catalog_activations`와 함께 commit할 때만 가능하다.
- Revision content는 활성화 후에도 수정하지 않는다. Rollback도 과거 Revision을 가리키는 새 forward-only
  Migration과 새 head version이며 SQL downgrade나 row update/delete가 아니다.

Application Port는 다음 한 개뿐이다.

```text
WidgetManifestBindingCatalogPort.resolveCurrent(
  ownerProductKey,
  sourceAppResourceKey,
  rendererKey,
  sourceKey?,
  dataCapabilityKeys[],
  actionCapabilityKeys[]
) -> WidgetManifestBindingSnapshot(
  catalogRevisionId,
  headVersion,
  productAppRevision,
  productAppState,
  exactAuthorities[],
  rendererRevision,
  rendererBinding,
  capabilityRevision,
  exactSourceKeys[],
  exactDataCapabilityKeys[],
  exactActionCapabilityKeys[]
)
```

Adapter는 active head와 모든 child row를 한 local read-only DB Transaction에서 읽고, 배포 Artifact에
포함된 exact Fixture의 root/component digest와 DB head를 비교한다. Head 부재·복수, Revision 또는 child
digest 불일치, 비활성 App/Renderer, DB 오류, fixture/head 불일치, cache가 현재 `head_version`과 다름은
`503 MANIFEST_BINDING_AUTHORITY_UNAVAILABLE`로 Fail Closed한다. stale-while-revalidate, Provider Code Set,
Tenant App row, Frontend 상수 fallback은 금지한다. Version Validation은 Parent Definition version,
`catalogRevisionId/headVersion`과 세 Component revision을 저장한다. Submit·Approve·Publish에서 current head가
달라졌으면 `409 MANIFEST_BINDING_REVISION_CHANGED`로 거부하고 새 Validation run을 요구한다. Effective
Evaluator는 current head에 대해 owner App·required Authorities·Renderer·Source·Data·Action 전체 binding을
매 요청 재검증한다. 하나라도 빠지거나 달라지면 exact reason `MANIFEST_BINDING_INVALID`,
`availability=NOT_AVAILABLE`, `canAdd=false`이고 저장 Instance는 민감 데이터 없는 정책 Placeholder로
남긴다. STATIC/SHADOW는 동일 would-deny만 기록하고 AUTHORITATIVE는 discovery/render/data/action을 deny한다.
Catalog revision은 모든 Effective cache key와 hard `validUntil`에 포함한다.

Binding Revision activation은 additive 변경만 바로 허용한다. 제거·비활성·Authority/Capability 축소 또는
Renderer tuple 변경은 `WidgetBindingImpactValidator`가 현재 `PUBLISHED | DEPRECATED` Version의 Manifest
전체를 current와 candidate에 대해 비교한다. 영향 Version이 하나라도 `CLEAR`이면 Migration을 abort한다.
먼저 일반 Registry API로 전부 `QUARANTINED | REVOKED`하고 Event·Outbox가 commit된 증거를 fixture에
pin해야만 다음 Migration을 허용한다. 자동 Scheduler가 Binding 변경을 사후 보정하거나 기존 Published
Version을 조용히 유지하지 않는다.

첫 Migration은 Golden Fixture와 같은 다음 다섯 binding을 하나의 Revision으로 Seed하고 그 exact field와
digest를 Java·DB Test에 고정한다. 표 밖 Product/App·Renderer·Capability를 암묵적으로 추가하지 않는다.

| Definition                    | Product          | App            | Authority           | Renderer            | Source           | Data capability             |
| ----------------------------- | ---------------- | -------------- | ------------------- | ------------------- | ---------------- | --------------------------- |
| `core.workspace.command-rail` | `core.workspace` | `APP.WORK`     | `APP.WORK:VIEW`     | `home.command-rail` | —                | `HOME.OVERVIEW.READ`        |
| `core.workspace.daily-brief`  | `core.workspace` | `APP.WORK`     | `APP.WORK:VIEW`     | `home.daily-brief`  | `RECOMMENDATION` | `HOME.RECOMMENDATIONS.READ` |
| `core.work.focus`             | `core.work`      | `APP.WORK`     | `APP.WORK:VIEW`     | `home.focus`        | `WORK`           | `WORK.ITEMS.LIST`           |
| `core.calendar.schedule`      | `core.calendar`  | `APP.CALENDAR` | `APP.CALENDAR:VIEW` | `home.schedule`     | `CALENDAR`       | `CALENDAR.EVENTS.LIST`      |
| `core.activity.activity`      | `core.activity`  | `APP.ACTIVITY` | `APP.ACTIVITY:VIEW` | `home.activity`     | `ACTIVITY`       | `ACTIVITY.EVENTS.LIST`      |

각 Product/App와 Renderer 상태는 `ACTIVE`, Renderer `kind=NATIVE`, minimum/maximum Host API Version은
`1/1`, 다섯 행의 Action capability는 모두 빈 집합이다. `—`는 JSON `null`이나 문자열이 아니라 해당
SOURCE row가 없음을 뜻한다. Exact JSON Schema와 anchor는
[`fixtures/widget-binding-catalog.v1.schema.json`](fixtures/widget-binding-catalog.v1.schema.json),
[`fixtures/widget-binding-catalog.v1.golden.json`](fixtures/widget-binding-catalog.v1.golden.json),
[`fixtures/verify-binding-catalog.mjs`](fixtures/verify-binding-catalog.mjs)다. Bootstrap bundle 생성→독립
JCS/root·component/file digest 검증→DB Seed→Port contract test→Application role write-deny test가 끝나기
전에는 Definition Create/Update/Validate endpoint를 열지 않는다.

### 4.3 Safety·Tenant Policy·Command

`plt_widget_runtime_controls`

- 범위 `CATALOG_MUTATIONS | CATALOG_DISCOVERY | RUNTIME_RENDER | RUNTIME_ACTION`
- 대상 global/definition/version
- `ENABLED | DISABLED`, revision, public/internal reason, expiry
- `(scope,target_type,normalized_target_id,revision)` unique와 tuple별 단일 active head를 둔다.
- Migration은 4개 scope의 `GLOBAL/ENABLED/revision=1`을 명시 Seed한다. Global head 부재는 `DISABLED`로
  Fail Closed하고 Definition/Version head 부재는 상위를 상속한다.
- Effective control은 해당 scope의 Global ∩ Definition ∩ Version다. 하위 `ENABLED`는 상위
  `DISABLED`를 완화하지 못하고, expiry된 `DISABLED`도 수동 enable 전까지 차단한다.
- Disable/enable은 기존 행을 수정하지 않고 새 revision을 `201`로 추가한 뒤 head를
  원자적 교체한다. 최초 Definition/Version disable은 `expectedVersion=0`, 이후는 현재 head version을
  요구한다.

`plt_widget_runtime_enable_approvals`

- immutable `approval_id`, `control_id`, exact `scope/target_type/normalized_target_id`, 승인 시점의
  `control_revision`, `ACTIVE | CONSUMED | REVOKED | EXPIRED`, evidence ref hash, 승인자, DB-clock
  `created_at/expires_at`, nullable `consumed_at/consumed_by_command_id`를 저장한다. 승인 ID와 승인 row는
  Update/Delete하지 않으며 상태 전이도 append-only revision으로 기록한다.
- Approval 생성 Transaction은 Runtime Control tuple의 current head를 잠그고 그 head가 `DISABLED`이며
  `request.controlRevision == expectedVersion == currentHead.revision`일 때만 `ACTIVE` approval을 만든다.
  Approval의 expiry는 서버 DB clock 기준 최대 30분이고 approver는 current head의 disabler와 달라야 한다.
- Enable Transaction은 같은 순서로 Control head와 Approval을 잠그고
  `approval.controlId/scope/target/controlRevision == request.controlId/scope/target/controlRevision ==
expectedVersion == current DISABLED head revision`을 exact 비교한다. Approval은 `ACTIVE`, 미만료,
  미사용이어야 하며 enabler는 approver/disabler와 달라야 한다. 성공한 같은 Transaction에서 새
  `ENABLED` revision/head, Approval `CONSUMED`, Audit/Event/Outbox/Completion을 함께 기록한다.
  stale head/tuple은 `409 DECISION_REVISION_CONFLICT`, expired/consumed/revoked approval은
  `422 RUNTIME_ENABLE_APPROVAL_INVALID`이고 어떤 실패도 approval을 재사용 가능 상태로 되돌리지 않는다.

| Disabled scope      | `STATIC/SHADOW` 효과                                                                                                 | `AUTHORITATIVE` 즉시 효과                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `CATALOG_MUTATIONS` | 새 Registry·Tenant Widget Policy 일반 Mutation을 `503 WIDGET_MUTATIONS_DISABLED`로 거부; legacy Home Mutation 무변경 | 같은 신규 Mutation 거부; legacy Home은 Authoritative 계약으로만 전환                |
| `CATALOG_DISCOVERY` | would-omit decision/metric만; 기존 Catalog 무변경                                                                    | 신규 Catalog discovery에서 대상을 생략; 기존 Instance 참조는 보존                   |
| `RUNTIME_RENDER`    | would-stop-data decision/metric만; 기존 Data 무변경                                                                  | 기존 Instance는 Data 조회를 중단하고 민감 Data 없는 차단 Placeholder로 전환         |
| `RUNTIME_ACTION`    | would-deny decision/metric만; 기존 Action 무변경                                                                     | Widget Action을 `403 WIDGET_ACTION_DISABLED`로 거부; Domain API도 독립적으로 재인가 |

`CATALOG_MUTATIONS`는 새 Control-plane의 emergency brake이므로 Registry가 설치된 모든 Mode에서
Service 진입 시 실제 강제한다. 이 차단은 legacy `HomePreference`·v5 Layout Mutation 경로에는 주입하지
않는다. Phase 1A의 `SHADOW` 비주입 원칙은 나머지 세 scope의 판정을 response/layout/renderer/data/action에
적용하지 않는다는 뜻이다. 그 세 scope의 Authoritative 효과는 승인된 cutover 후에만 Runtime Guard가 적용한다.

`CATALOG_MUTATIONS` 차단 중에도 `QUARANTINE`, `REVOKE`, `DISABLE_RUNTIME_CONTROL`, 독립
enable approval과 `ENABLE_RUNTIME_CONTROL`은 복구·보안 escape hatch로만 허용하며 위 exact
permission·SoD·assertion을 그대로 요구한다. Scope가 다른 disable을 우회하지는 못한다.

`adm_tenant_widget_policy_revisions`

- tenant, definition, revision number, `DRAFT | PUBLISHED | SUPERSEDED | REVOKED`
- enabled, `CHANNEL | PINNED` selector
- surface/audience, required/locked configuration, sharing policy
- Definition당 Published Revision은 하나이며 행 부재는 명시적 `DENY`
- `(tenant_id,definition_id)`의 active head가 immutable revision을 가리킨다. Revoke는 기존
  `PUBLISHED` 행을 바꾸지 않고 predecessor를 가리키는 `REVOKED/enabled=false` tombstone revision을
  추가한 뒤 head를 원자적 교체한다. Evaluator는 head만 읽으며 `REVOKED`를 즉시 deny한다.

`adm_tenant_widget_catalog_settings`

- catalog `STATIC | SHADOW | AUTHORITATIVE`
- instance `OFF | DUAL_WRITE | READ`
- runtime `LEGACY | BROKER`
- preset `OFF | PRIVATE | SHARE`
- 기본값 `STATIC/OFF/LEGACY/OFF`

세 전역 판정 축의 단일 SoR은 `plt_widget_registry_revision_head(environment)`,
`adm_tenant_widget_policy_catalog_head(tenant_id)`, `plt_widget_safety_revision_head(environment)`다.
관련 상태 변경은 head를 `SELECT FOR UPDATE`하고 signed BIGINT를 정확히 `+1`한 뒤 State·Registry
Event·Outbox를 같은 Transaction에 commit한다. Replay·No-op·실패는 head/Event/Outbox를 변경하지 않고,
Rollback도 과거 값을 되돌리지 않고 새 `+1` Revision을 만든다. `9223372036854775807` 도달 시 wrap하지
않고 readiness `FAILED/REVISION_HEAD_EXHAUSTED`로 Fail Closed한다. 이 규칙의 실행 fixture는
[`fixtures/widget-revision-authority.v1.golden.json`](fixtures/widget-revision-authority.v1.golden.json),
[`fixtures/widget-revision-authority.v1.negative.json`](fixtures/widget-revision-authority.v1.negative.json),
[`fixtures/verify-revision-authority-contract.mjs`](fixtures/verify-revision-authority-contract.mjs)에 고정한다.

`plt_widget_catalog_bootstrap_prerequisites`

- immutable UUID `prerequisite_id`, `schema_version=1`, canonical payload JSON/bytes와 unique lowercase
  SHA-256 `prerequisite_digest`
- source commit/build/workflow, Platform/Provider/Auth migration snapshot, Manifest/Binding/Tenant Policy
  fixture revision, CI test artifact digest, dashboard/alert/runbook digest
- trusted CI attestation JWS hash/JTI와 verified-at; Update/Delete/TTL cleanup 금지

Exact payload는
[`fixtures/widget-bootstrap-prerequisite.v1.schema.json`](fixtures/widget-bootstrap-prerequisite.v1.schema.json)의
`BootstrapPrerequisiteV1`이다. Manifest/Binding/Policy Golden, migration/contract/negative/flags-off/
non-injection test, metric/dashboard/alert와 모든 필수 Runbook의 content digest가 non-null이어야 한다.
Golden·Trust Negative·독립 digest/replay 검증은 각각
[`fixtures/widget-bootstrap-prerequisite.v1.golden.json`](fixtures/widget-bootstrap-prerequisite.v1.golden.json),
[`fixtures/widget-bootstrap-prerequisite.v1.negative.json`](fixtures/widget-bootstrap-prerequisite.v1.negative.json),
[`fixtures/widget-bootstrap-ci-jwks.v1.json`](fixtures/widget-bootstrap-ci-jwks.v1.json),
[`fixtures/verify-bootstrap-prerequisite-contract.mjs`](fixtures/verify-bootstrap-prerequisite-contract.mjs)에
고정한다. Verifier는 compact JWS의 ES256 raw signature를 pinned public JWK로 실제 검증하고, 고정
verification time의 `nbf/exp±30초`, unknown kid, forged signature, replay, local artifact missing/tamper를
Negative로 거부한다. `dwp-ci-attestation-authority`는 pin한 CI JWKS와 workload에서만 compact JWS를 발급한다.
Protected Header는 exact `alg=ES256`, pinned `kid`, `typ=JWT`이고 Claims는 exact
`iss=dwp-ci-attestation-authority`, `sub=dwp-release-readiness`, `azp=dwp-release-readiness`,
`aud=dwp-platform-widget-rollout`, `iat/nbf/exp/jti`, `environment=STAGING`, `prerequisiteId`,
`prerequisiteDigest`, `sourceCommitSha`, `deploymentBuildDigest`, `workflowDigest`, closed
`verificationArtifactDigests`, `conclusion=SUCCESS`다. TTL은 `1..600초`, clock skew는 ±30초,
`(iss,jti)`는 Approval 원장에 영구 single-use이고 raw CI token은 저장하지 않는다. `none`·대칭키·unknown
`kid`·유효한 cached key 없는 JWKS/replay store 장애는 모두 fail closed다.
CI JTI는 schema, time, pinned-key signature, prerequisite/body/artifact digest를 모두 검증한 뒤에만
Bootstrap Approval·Receipt와 같은 Transaction에서 unique insert한다. 검증 실패/Transaction rollback은 JTI를
소비하지 않으며, 위조 요청이 정상 요청의 같은 JTI를 선점할 수 없음을 `forged-then-valid-same-jti` Negative로
고정한다.

Bootstrap에 pin하는 Dashboard와 Alert bytes는
[`operations/widget-shadow-dashboard.v1.json`](operations/widget-shadow-dashboard.v1.json),
[`operations/widget-shadow-alerts.v1.json`](operations/widget-shadow-alerts.v1.json)이고, 9개 Runbook은
`docs/07-runbooks/widget-*.md`의 exact path/content digest다. CI 예제 verifier도 이 11개 로컬 운영
Artifact의 실제 존재와 byte hash를 검사한다. Production은 같은 검증을 immutable Artifact Store ref에
대해 수행한다.
Alert rule의 closed schema, 8개 drift Negative와 independent digest/matrix verifier는
[`operations/widget-shadow-alerts.v1.schema.json`](operations/widget-shadow-alerts.v1.schema.json),
[`operations/widget-shadow-alerts.v1.negative.json`](operations/widget-shadow-alerts.v1.negative.json),
[`operations/verify-shadow-alert-contract.mjs`](operations/verify-shadow-alert-contract.mjs)다. Bootstrap
verifier는 이 verifier를 먼저 실행하므로 evidence field나 15분 평균으로 실제 stop rule을 대체할 수 없다.

Platform은 Bootstrap Approval 생성 시 Schema/JCS digest, current build·DB migration·binding/fixture revision,
CI signature/JTI/body binding, artifact existence와 runbook path/digest를 다시 검증한다. 하나라도 없거나 stale면
`422 ROLLOUT_PREREQUISITE_INVALID`, CI/JWKS/Artifact Store가 불가하면
`503 ROLLOUT_TRUST_UNAVAILABLE`다. 임의 64-hex와 사람 3인 서명만으로 Bootstrap을 만들 수 없다.

`plt_widget_catalog_rollout_approval_revisions`

- immutable `approval_id`, 단조 `approval_revision`, `BOOTSTRAP | PROMOTION`,
  `ACTIVE | REVOKED | EXPIRED`, `environment=STAGING`
- `rollout_revision`, `from_ring_bps`, `to_ring_bps`, immutable Bootstrap provenance
  (`bootstrap_prerequisite_id`, `bootstrap_prerequisite_digest`, `ci_attestation_jti`),
  `selector_key_id`, optional `rollout_evidence_id`와 evidence digest, approved actor/time,
  서버 DB-clock `activation_deadline`, `expires_at`, predecessor
- 모든 ring 값은 Integer `0..10,000bps`다. Bootstrap은 `from=0`, `to=1..100bps`, prerequisite digest
  필수, 24시간 evidence는 금지한다.
- Promotion은 current ring과 `from`이 같고 `1≤from<to≤10,000bps`, `to>100bps`여야 하며, 직전 연속 24시간
  window와 §11 Gate의 canonical evidence digest가 필수다.
- `activation_deadline=created_at+10분`은 서버만 계산한다. 요청/JWS `expiresAt`은 DB clock의
  `db_now+24시간 < expiresAt ≤ db_now+26시간`이어야 하며 활성 rollout의 hard stop 시각이다. Client 시각,
  무제한 미래 expiry, activation deadline이 지난 Approval은 허용하지 않는다.
- 생성 Transaction은 검증을 모두 통과한 새 revision을 오직 `ACTIVE`로만 기록하고 응답도 같은 state여야
  한다. Activation은 그 exact approval revision을 다시 잠가 `ACTIVE`·미만료임을 확인하므로 생성 또는
  activation 시점의 `REVOKED | EXPIRED` projection은 모두 거부한다.

`plt_widget_rollout_selector_keys`

- `selector_key_id`는 전역 unique·재사용 금지 ID이며 `ACTIVE | RETIRED`, monotonic registry revision,
  HSM/KMS secret handle, 생성/retire 시각만 저장한다. Secret 원문은 DB·Log·Metric·응답에 저장하지 않는다.
- Approval 생성과 활성화는 key row를 잠그고 `ACTIVE`임을 재검증한다. ACTIVE Head/Approval이 참조하는 key는
  rotate/retire할 수 없고 key resolution·KMS 장애는 `503 ROLLOUT_SELECTOR_UNAVAILABLE`로 fail closed한다.
  회전은 기존 rollout을 먼저 stop하고 새 key와 새 Bootstrap prerequisite로 최대 1%에서 다시 시작하며,
  nested-cohort/kill/quarantine staging drill을 통과해야 한다.

`plt_widget_catalog_rollout_evidence`

- immutable UUID `evidence_id`, `schema_version=1`, canonical payload JSON/bytes, unique lowercase SHA-256
  `evidence_digest`, fixed query-set revision, immutable observability snapshot ref hash
- window start/end, collected/verified time, deployment build, catalog/binding/policy/safety/head/selector revision,
  ring bps, sample/diff/safety/queue/outbox/drill aggregate
- Release Approval Authority attestation JWS hash, immutable `authority_verification_record_id`와 verified-at;
  Update/Delete/TTL cleanup 금지

`plt_widget_rollout_authority_verifications`

- 최초 Promotion Approval 생성 시 검증한 Evidence Authority assertion마다 immutable
  `verification_record_id`, `issuer`, unique permanent `jti`, `kid`, verification public-key fingerprint,
  compact JWS SHA-256, canonical claims SHA-256, `evidence_id/digest`, `query_set_revision`, snapshot ref hash,
  `verified_at`, `result=SUCCESS`를 같은 Transaction에 기록한다. Compact JWS 원문은 저장하지 않는다.
- Application role은 성공 record만 insert할 수 있고 Update/Delete를 금지한다. `(issuer,jti)` replay와
  Evidence/claim/hash mismatch는 record 생성 전에 거부한다. 이 record는 “hash만으로 서명을 다시
  검증했다”는 주장이 아니라 최초 raw compact JWS의 signature/time/body binding 검증이 성공했다는 durable
  verification fact다.
- Operation domain request의 `ciAttestation`과 `evidenceAuthorityAttestation`은 raw token이나 임의 JTI가
  아니라 `{verificationRecordId, assertionSha256}` immutable row reference다. Trust boundary는 raw compact
  JWS를 한 번만 받아 ES256 signature와 pin한 `issuer/kid/public-key fingerprint`, time, exact closed claims,
  request/evidence digest, JTI를 검증한 뒤 `result=SUCCESS` row를 원자적으로 만든다. Domain verifier는 이
  row를 exact 조회·결속하며 `aaa.bbb.ccc`, regex 모양만 맞는 token, 임의 carry-forward JTI, hash/claim/key
  불일치를 모두 거부한다.

Exact payload는
[`fixtures/widget-rollout-evidence.v1.schema.json`](fixtures/widget-rollout-evidence.v1.schema.json)의
`RolloutEvidenceV1`이다. 숫자는 소수 대신 count, basis point, millisecond, second의 non-negative integer만
사용한다. `window.durationSeconds=86400`, `missingSampleBuckets=0`, end가 approval 생성 DB clock보다 미래가
아니고 bootstrap/promotion head의 직전 연속 window여야 한다. `querySetRevision`은 Platform Release에 pin한
closed query set digest이며 Client가 query text나 threshold를 보내지 않는다. Exact PromQL·integer formula와
독립 anchor는
[`fixtures/widget-rollout-query-set.v1.golden.json`](fixtures/widget-rollout-query-set.v1.golden.json),
[`fixtures/verify-rollout-evidence-contract.mjs`](fixtures/verify-rollout-evidence-contract.mjs)에 고정한다.
모든 rate Gate는 `denominator > 0`, `0 ≤ numerator ≤ denominator`를 먼저 만족해야 하며
`samples.total`은 모든 sample partition의 exact 합과 같아야 한다. Basis point 상한은 arbitrary-precision
BigInt의 `(10000n * numerator + denominator - 1n) / denominator` CEIL로만 계산한다. Number/부동소수 변환,
`max(1, denominator)` 보정, 누락 telemetry나 `missingSampleBuckets > 0`은 허용하지 않고 fail closed한다.

Evidence queue 필드는 24시간 aggregate 외에 max rolling 15분 rejection/error rate와 duration p99, max 1분
rate/p99, `maximumConsecutiveSecondsAboveDepth230`을 모두 포함한다. Drill은 Kill과 Quarantine decision,
would-deny와 would-stop-data delay, legacy Payload/Data mismatch count를 각각 보존한다. 누적 seconds를
연속 5분 증거로 대신하거나 Payload 일치만으로 Data 일치를 추론하지 않는다.

`dwp-release-approval-authority`는 JWS 발급 전에 허용된 Observability service identity로
`immutableSnapshotRefHash`의 read-only snapshot을 다시 조회하고, pin한 query set의 모든 query가 정확히
24시간 window를 덮으며 missing bucket이 0인지 검증한다. 수집자가 제출한 aggregate와 독립 재계산 결과가
byte-equivalent하고 §11의 sample/diff/safety/queue/outbox/drill Gate가 모두 참일 때만
`evidenceId/evidenceDigest/querySetRevision/immutableSnapshotRefHash`를 attestation claim에 넣어 서명한다.

Platform은 Approval 생성 Transaction에서 JSON Schema와 RFC 8785 digest를 다시 계산하고, current
build/head/selector/catalog/binding/policy/safety revision 일치, window 완전성, 모든 integer aggregate와
Gate threshold를 자체 재계산한다. Authority attestation과 하나라도 다르면
`422 ROLLOUT_EVIDENCE_INVALID`; Observability attestation/JWKS/replay 확인 불가면
`503 ROLLOUT_TRUST_UNAVAILABLE`다. Bootstrap은 evidence를 금지하고 Promotion은 canonical payload,
Authority attestation과 DB Evidence row가 모두 없으면 거부한다. 임의 64-hex digest만 제출하거나 사람
서명만으로 metric Gate를 우회할 수 없다.

`plt_widget_catalog_rollout_heads`

- `environment` unique, `STATIC | BOOTSTRAP | SHADOW`, 단조 `rollout_revision`,
  `active_approval_id/revision?`, `ring_bps`, `selector_key_id?`, active rollout과 함께 carry-forward하는 nullable
  `bootstrap_prerequisite_id/digest/ci_attestation_jti`, optimistic `version`
- activation은 Head를 잠그고 Approval의 active/unexpired/environment/kind/from/to/revision을 검증한 같은
  Transaction에서만 Head를 전이한다.
- Promotion의 trusted predecessor는 exact `rollout_revision/head_version`의 ACTIVATE commit이며 그
  `activated_at ≤ evidence.window.start`여야 한다. Server는 그 commit 이후의 전체 rollout ledger를 읽고,
  성공 Transaction에서 DB commit된 `ACTIVATE | STOP | EXPIRE`만 authoritative transition으로 취급한다.
  각 행은 DB-clock `committed_at`, strict-monotonic head version/revision, resulting phase가 operation과 exact
  일치해야 하고 rollback/uncommitted 행은 애초 조회 집합에 포함하지 않는다. 조회 누락·malformed·동률·순서
  모호성은 행을 건너뛰지 않고 provenance 전체를 fail closed한다. 최신 committed transition이
  `STOP | EXPIRE`면 authoritative current head는 `STATIC`이므로 거부하며, 후속 `ACTIVATE`도 제출한 trusted
  predecessor가 stale하고 연속 구간이 끊긴 것으로 거부한다.
- Evidence window 전체는 위 exact predecessor revision의 하나의 연속 `ACTIVE` 구간 안에 있어야 한다.
  window 안의 STOP/EXPIRE뿐 아니라 이후 reactivation도 단절을 복구하지 못하며, predecessor approval은
  window end까지 `ACTIVE`·미만료여야 한다.
- activation은 위 검증 외에도 `db_now≤activation_deadline`, current deployment build와 Platform/Provider/Auth
  migration digest, Manifest/Binding/Tenant Policy fixture, catalog/binding/policy/safety/head revision,
  selector key ACTIVE 상태와 key ID, Bootstrap prerequisite/CI JTI를 Approval 생성 시점 provenance와 다시
  exact 비교한다. Promotion은 Evidence row와 immutable Authority verification record를 잠가
  Evidence/Approval의 ID·digest·JTI·claims digest·key fingerprint가 exact 일치하는지 확인한다. 이어 허용된
  Observability identity로 immutable snapshot을 다시 읽어 pinned query set을 재실행하고 window/Gate를 현재
  코드로 재계산한다. Raw JWS가 없는 activation에서 JWS hash만으로 signature를 재검증했다고 간주하지 않는다.
  Evidence window end가 Approval 생성 시점의 직전 window인지도 확인한다. 하나라도 변했거나 trust source를
  읽을 수 없으면 Head를 바꾸지 않고 각각 `409 ROLLOUT_PROVENANCE_STALE`,
  `422 ROLLOUT_EVIDENCE_INVALID`, `503 ROLLOUT_TRUST_UNAVAILABLE`로 닫는다.
- Bootstrap activation은 Approval의 provenance triple을 Head에 기록한다. 모든 Promotion 생성·활성화는
  현재 Head의 triple과 `selector_key_id`를 byte-equivalent하게 새 Approval/Head로 복사한다. 따라서 active Approval이 이전
  Promotion이어도 `1%→10%→100%` 연속 승격이 가능하며, Client가 과거 Bootstrap payload를 다시 제출하거나
  다른 prerequisite로 갈아끼울 수 없다.
- stop/expiry는 새 `REVOKED | EXPIRED` Approval revision을 추가하고 Head를 `STATIC`, `ring_bps=0`,
  active approval과 Bootstrap provenance를 `null`, `rollout_revision+1`로 바꾸는 단일 Transaction이다. Evaluator는 매 요청에서
  외부 Flag뿐 아니라 이 Head/Approval tuple을 확인하므로 Flag 전파 전에도 observer를 중단한다.
- Evaluator는 enqueue 직전 DB에서 `db_now < active_approval.expires_at` predicate를 Head/Approval exact tuple과
  함께 평가한다. 만료됐거나 DB time을 읽지 못하면 해당 요청은 `STATIC`, observer off로 fail closed하고 expiry
  reconciliation intent를 기록한다. Scheduler나 Flag 전파 성공을 observer 중단의 선행조건으로 두지 않는다.
- `RolloutExpiryScheduler`는 최대 15초 주기로 DB clock 기준 만료된 ACTIVE Approval을 `FOR UPDATE SKIP
LOCKED`로 가져온다. `UUIDv5("rollout-expiry\n"+approvalId+"\n"+approvalRevision+"\n"+expiresAt)`
  deterministic command ID를 사용하고, Head/Approval을 다시 잠근 같은 Transaction에서 Approval `EXPIRED`,
  Head `STATIC/ring=0`, Completion Receipt, Audit, Event, Outbox를 원자적으로 기록한다. 이미 stop됐거나 다른
  Approval이 active면 성공 no-op Receipt로 봉인한다. Event는 `WIDGET_ROLLOUT_STOPPED`,
  `stopCause=APPROVAL_EXPIRED`, `reasonCode=ROLLOUT_APPROVAL_EXPIRED`이고 사람/자동 안전 중단은
  `stopCause=SAFETY_THRESHOLD`, `reasonCode=ROLLOUT_SAFETY_STOP`으로 구분한다.

이 원장의 유일한 Writer는 `dwp-deployment-controller` workload identity
(`aud=dwp-platform-widget-rollout`, `scope=widget-catalog.rollout.manage`)다. Browser·Provider·Tenant API와
Generic provisioning token은 접근할 수 없다. 승인 생성자는 proposer 1명과 Platform Control Plane
approver 2명, 총 3명의 서로 다른 opaque actor를 제출한다. 내부 Operations route와 operationId는 아래 여섯
개만 허용하고 별도 internal-only OpenAPI와 Gateway deny test를 둔다.

| operationId                                  | Method·exact path                                                            | Request DTO                    | Success DTO/status                           |
| -------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------- |
| `getWidgetCatalogRolloutCurrentInternal`     | `GET /internal/operations/v1/widget-catalog-rollouts/current`                | —                              | `WidgetCatalogRolloutStateResponse` `200`    |
| `getWidgetCatalogRolloutApprovalInternal`    | `GET /internal/operations/v1/widget-catalog-rollouts/approvals/{approvalId}` | —                              | `WidgetCatalogRolloutApprovalResponse` `200` |
| `getWidgetCatalogRolloutEvidenceInternal`    | `GET /internal/operations/v1/widget-catalog-rollouts/evidence/{evidenceId}`  | —                              | `WidgetCatalogRolloutEvidenceResponse` `200` |
| `createWidgetCatalogRolloutApprovalInternal` | `POST /internal/operations/v1/widget-catalog-rollouts/approvals`             | `RolloutApprovalCreateRequest` | `WidgetCatalogRolloutApprovalResponse` `201` |
| `activateWidgetCatalogRolloutInternal`       | `POST /internal/operations/v1/widget-catalog-rollouts/activate`              | `RolloutActivateRequest`       | `WidgetCatalogRolloutStateResponse` `200`    |
| `stopWidgetCatalogRolloutInternal`           | `POST /internal/operations/v1/widget-catalog-rollouts/stop`                  | `RolloutStopRequest`           | `WidgetCatalogRolloutStateResponse` `200`    |

이는 Provider→Platform Widget Registry의 10 Read+2 Command Route와 다른 trust plane이다. 모든 Operations
요청은 Identity JWKS로 검증하는 ES256 service token을 요구한다. exact claim은
`iss=dwp-internal-identity`, `sub=dwp-deployment-controller`, `azp=dwp-deployment-controller`,
`aud=dwp-platform-widget-rollout`, route별 `scope=widget-catalog.rollout.read|widget-catalog.rollout.manage`,
`iat/nbf/exp/jti`이고 TTL≤5분, clock skew ±30초다. unknown `kid`, cached key가 없는 JWKS/Replay Store
장애, claim 불일치는 fail closed다.

Approval 생성은 추가로 `X-DWP-Rollout-Approval` compact JWS를 요구한다. `alg=ES256`, `kid`는 Platform이
pin한 별도 Release Approval JWKS에서 해결하며 `none`/대칭키 fallback을 금지한다. exact claim은
`iss=dwp-release-approval-authority`, opaque workflow `sub`, `aud=dwp-platform-widget-rollout`,
`iat/nbf/exp/jti`, 같은 요청의 service-token `jti`와 일치하는 `serviceTokenJti`,
`kind/environment/rolloutRevision/fromRingBps/toRingBps`,
`selectorKeyId`, `prerequisiteId`, `prerequisiteDigest`, `ciAttestationJti`, nullable evidence selector(`evidenceId`, `evidenceDigest`,
`querySetRevision`, `immutableSnapshotRefHash`, `evidenceAttestationJti`), `expiresAt`,
DTO와 동일한 `proposerRef`, 정렬된 두 `approverRefs`, 그리고 JWS field를 제외한 Request의 RFC 8785
canonical lowercase SHA-256 `requestDigest`다. Assertion TTL≤5분이고 actor 3명은 모두 달라야 하며
claim과 DTO가 byte-equivalent여야 한다. `(iss,jti)`는 Approval 원장에 unique로 영구 보존해 재사용을
거부하고, service-token jti/request/evidence/selector binding 하나라도 다르면 실패한다.

`PROMOTION` JWS는 추가로 `evidenceId`, `evidenceDigest`, `querySetRevision`,
`immutableSnapshotRefHash`, `evidenceAttestationJti`를 필수로 포함하고 `RolloutEvidenceV1` body 및 별도
Evidence Authority attestation과 exact 일치해야 한다. `BOOTSTRAP`은 이 claim을 모두 `null`로 고정한다.

Mutation은 UUID `Idempotency-Key`를 요구한다. Approval 생성 Receipt target은
`ROLLOUT_REVISION:STAGING:{rolloutRevision}`, activate/stop은 `ROLLOUT_HEAD:STAGING`이고 06 §10.3의
fingerprint·lease·fencing·cleanup을 그대로 사용한다. `RolloutApprovalCreateRequest`는 `kind`,
`environment=STAGING`,
`rolloutRevision`, `expectedHeadVersion`, `fromRingBps`, `toRingBps`, `bootstrapPrerequisite?`, `ciAttestation?`,
`rolloutEvidence?`, `evidenceAuthorityAttestation?`, `selectorKeyId`, `proposerRef`, `approverRefs[2]`,
`expiresAt`만
허용한다. `rolloutRevision`은 생성 Transaction에서 잠근 current Head의 `rolloutRevision+1`과 같아야 한다.
`RolloutActivateRequest`는 `approvalId`, `approvalRevision`, `expectedHeadVersion`,
`RolloutStopRequest`는 `expectedHeadVersion`, `reasonCode`, `incidentRef`만 허용한다.
`BOOTSTRAP`은 prerequisite+CI attestation을 필수, rollout evidence를 금지한다. `PROMOTION`은 prerequisite
payload 재제출을 금지하고 current Head의 immutable Bootstrap provenance triple을 서버가 상속하며
rollout evidence+Evidence Authority attestation을 필수로 한다.
`WidgetCatalogRolloutStateResponse`의 exact field는 `environment`, `phase`, `rolloutRevision`, `headVersion`,
`ringBps`, nullable `selectorKeyId`, nullable `activeApprovalId`, nullable `activeApprovalRevision`, nullable
`activeApprovalExpiresAt`, nullable `bootstrapPrerequisiteId`, nullable `bootstrapPrerequisiteDigest`, nullable
`ciAttestationJti`, nullable `activeRolloutEvidenceId`, nullable `activeRolloutEvidenceDigest`다.
`WidgetCatalogRolloutApprovalResponse`의 exact field는 `approvalId`,
`approvalRevision`, `kind`, `state`, `environment`, `rolloutRevision`, `fromRingBps`, `toRingBps`,
`selectorKeyId`, `bootstrapPrerequisiteId`, `bootstrapPrerequisiteDigest`, `ciAttestationJti`, nullable
`rolloutEvidenceId`, nullable `rolloutEvidenceDigest`, nullable `evidenceAttestationJti`, `activationDeadline`,
`expiresAt`, `headVersion`이다. `WidgetCatalogRolloutEvidenceResponse`는 `evidenceId`, `evidenceDigest`,
`querySetRevision`, `immutableSnapshotRefHash`, `windowStart`, `windowEnd`, `verifiedAt`,
`deploymentBuildDigest`, `catalogRevision`, `bindingCatalogRevision`, `policyRevision`, `safetyRevision`,
`selectorKeyId`, `rolloutRevision`, `ring`, `ringBps`, `evidenceAttestationJti` exact field만 반환한다. 세 DTO는 raw actor·JWS·metric
payload를 반환하지 않는다. State의 두 Evidence field는 active Promotion에서만 non-null이고
`activeApproval`이 참조하는 Evidence와 exact 일치한다.
응답 `ring=STAGING_BOOTSTRAP|STAGING_SHADOW`는 저장 Evidence payload의
`ring=staging-bootstrap|staging-shadow`와 1:1 mapping하며 다른 case/value를 허용하지 않는다.
DTO nullability는 closed `oneOf`로 고정한다. `STATIC` State는 selector/active Approval/Bootstrap/Evidence가
모두 null, `BOOTSTRAP`은 selector·Approval·Bootstrap triple이 non-null이고 Evidence pair가 null,
`SHADOW`는 이 값과 Evidence pair가 모두 non-null이다. `BOOTSTRAP` Approval은 Bootstrap triple과 CI JTI가
non-null이고 Evidence selector/attestation이 null, `PROMOTION` Approval은 inherited triple/CI JTI와 Evidence
selector/attestation이 모두 non-null이다. phase/kind와 어긋난 nullable 조합은 Schema Negative로 거부한다.
이 DTO·approve/activate/stop/expiry/evidence read·Promotion threshold의 실행 계약은
[`fixtures/widget-rollout-operation.v1.schema.json`](fixtures/widget-rollout-operation.v1.schema.json),
[`fixtures/widget-rollout-operation.v1.golden.json`](fixtures/widget-rollout-operation.v1.golden.json),
[`fixtures/widget-rollout-operation.v1.negative.json`](fixtures/widget-rollout-operation.v1.negative.json),
[`fixtures/verify-rollout-operation-contract.mjs`](fixtures/verify-rollout-operation-contract.mjs)에 고정한다.
모든 Mutation은 optimistic conflict `409`, JWS replay `409 ROLLOUT_APPROVAL_REPLAYED`, 만료/SoD/body
binding 불일치 `422 ROLLOUT_APPROVAL_ARTIFACT_MISMATCH`, bootstrap prerequisite 불일치
`422 ROLLOUT_PREREQUISITE_INVALID`, evidence schema/digest/source/Gate 불일치
`422 ROLLOUT_EVIDENCE_INVALID`, trust/JWKS/replay-store 장애
`503 ROLLOUT_TRUST_UNAVAILABLE`이고 Audit·Outbox와 같은 Transaction으로 기록한다.

Approval 생성 검증 순서는 고정한다. TLS와 현재 service token을 먼저 검증하고, Idempotency scope/key와
canonical body fingerprint로 Receipt를 조회한다. `COMPLETED`가 같은 fingerprint이고 저장된
`approvalAssertionHash`가 제출한 raw JWS의 SHA-256과 같으면, 최초 수락 때 검증한 artifact임을 근거로 JWS
expiry/replay check보다 먼저 저장 응답을 replay한다. `IN_PROGRESS`도 같은 hash면
`COMMAND_IN_PROGRESS`만 반환한다. 새 Receipt에 대해서만 JWS signature/time/binding과 `(iss,jti)` single-use를
검증해 hash/jti를 Receipt·Approval에 저장한다. 다른 key나 fingerprint가 이미 사용한 jti를 제출하면
`ROLLOUT_APPROVAL_REPLAYED`, 같은 key에 다른 JWS hash면 `ROLLOUT_APPROVAL_ARTIFACT_MISMATCH`다.
Signature·time·body/artifact binding이 모두 성공하기 전에는 `(iss,jti)`를 예약하지 않는다. JTI unique insert는
Approval·Receipt 생성과 같은 Transaction의 마지막 trust step이고, 그 뒤 실패하면 함께 rollback한다. 위조/unknown
`kid` 요청 뒤 동일 JTI의 정상 assertion이 성공하고, 그 정상 commit 이후 재사용만 replay로 거부되는 순서를
Bootstrap verifier의 `forged-then-valid-same-jti` Negative와 동일하게 적용한다.

`plt_widget_command_receipts`

- idempotency key, operation, target, request fingerprint, response, expiry
- `state`, `leaseOwner`, 단조 증가 `fencingToken`, `leaseUntil`, `attempt`, original assertion hash/JTI/expiry
- `COMPLETED`면 unique `completion_ledger_command_id`가 반드시 non-null인 deferred DB invariant
- 같은 Key와 다른 Fingerprint는 `409`

`plt_widget_command_execution_gates`는 지연 ingress와 완료 확정을 직렬화하는 영구 Gate다.

- immutable unique `command_id`와 public fingerprint, actor ref hash, operationId, target type/id
- `OPEN | SEALED`, 단조 `gate_version`, nullable completion outcome/hash
- 최초 Command Receipt와 `seal-not-executed`가 모두 같은 commandId row를 먼저 insert-or-lock한다.
- Target Transaction과 Seal Transaction의 lock 순서는 항상 Gate → Receipt → Target이다. Target은 `OPEN`에서만
  실행하고 완료 시 `SEALED`; Seal이 먼저 `SEALED`로 전이하면 지연된 원 요청은 저장 응답만 replay한다.
- Gate는 Receipt TTL과 무관하며 Update는 `OPEN → SEALED` CAS 한 번만, Delete/TTL cleanup은 금지한다.

`plt_widget_command_completion_ledger`는 Receipt TTL과 무관한 append-only 복구 원장이다.

- immutable unique `command_id`, public request fingerprint, actor ref hash, operationId, target type/id,
  `MUTATED | NO_OP | REJECTED | NOT_EXECUTED` outcome, final public HTTP status, canonical response bytes
  (최대 64KiB), ETag, response hash, completedAt, nullable aggregate/event refs
- 모든 Platform `COMPLETED` Receipt는 성공 2xx, 결정적 4xx, terminal
  `503 COMMAND_NOT_EXECUTED`를 막론하고 같은 Transaction에 정확히 한 Ledger와 `SEALED` Gate를 가진다.
  상태를 바꾼 `MUTATED`만 Target·Registry Event·Outbox가 같은 Transaction에 필수이고, 검증 2xx
  `NO_OP`, 결정적 4xx `REJECTED`, target 미실행 `NOT_EXECUTED`는 aggregate/event ref가 null이어야 한다.
- 영구 Deferred constraint/constraint trigger는 `SEALED Gate ↔ Ledger`가 정확히 하나씩 존재하고 commandId,
  binding, outcome/status/body hash가 일치하는지 commit 시 검사한다. 존재하는 `COMPLETED` Receipt는 반드시
  그 Gate/Ledger를 참조하고 같은 값을 가져야 하지만, 정상 TTL cleanup 뒤 Receipt 부재는 허용한다.
  `IN_PROGRESS` Receipt는 `OPEN` Gate와만 공존하고 Ledger가 없어야 한다. Receipt가 존재하는 완료
  Transaction에서 세 객체 중 하나만 쓰거나 값이 다르면 commit을 거부한다.
- Update/Delete나 TTL cleanup을 금지한다. Raw actor/session ref와 Credential은 저장하지 않는다.
- Command handler는 새 Target lock 전에 ledger를 조회한다. 같은 commandId+binding이면 저장 응답만 replay,
  하나라도 다르면 `409 COMMAND_BINDING_MISMATCH`이며 ledger가 있으면 Mutation을 절대 재실행하지 않는다.
- PostgreSQL은 `command_id` hash 32 partition과 global PK를 사용한다. 최대 payload 64KiB와 12개월 peak
  완료량의 2배를 매 분기 forecast하고 24개월 headroom을 사전 확보한다. 저장공간 70% warning/85% page,
  WAL/PITR RPO 5분·RTO 60분, 일일 backup 35일 보존, 분기 restore drill에서 row count·binding/response hash
  표본·Receipt TTL 경과 command replay를 검증한다. 용량 부족을 이유로 Ledger를 삭제하지 않는다.

Provider façade DB의 `prv_widget_command_receipts`는 Public Mutation을 Platform 호출보다 먼저 영속한다.

- unique `(actorRef,operationId,targetType,targetId,publicIdempotencyKey)`, public request fingerprint,
  `IN_PROGRESS | COMPLETED`, 한 번 생성한 immutable UUID `commandId`
- `leaseOwner`, 단조 `fencingToken`, `leaseUntil`, reconciliation attempt, Platform status/body/ETag,
  completed/expiry
- 같은 Public key+fingerprint 재시도는 저장된 `commandId`를 재사용하고 다른 fingerprint는 Platform 호출 전
  `409 IDEMPOTENCY_KEY_REUSED`다. `IN_PROGRESS.expiresAt=null`이며 Completed만 06 §10.3 TTL cleanup 대상이다.
- `prv_widget_command_dispatch_attempts`는 `(receipt_id,dispatch_attempt)` append-only이며 fence, exact
  `serviceTokenJti/hash/exp`, `widgetAssertionJti/hash/exp`, preparedAt/dispatchAt을 저장한다. Provider는 signed
  service token/assertion bytes를 메모리에서 먼저 준비하고, 신규 Receipt+commandId+attempt tuple을 같은 첫
  Transaction에 commit한 뒤 저장 hash와 byte가 같은 그 artifact만 송신한다. 준비 실패면 Receipt를 만들지
  않는다. commit 후 송신 전 crash도 `assertionExp`가 알려진 닫힌 상태다.
- Exact compact token/assertion은 KMS envelope encryption을 적용한 별도
  `prv_widget_command_attempt_secrets`에 seal 완료까지만 보관하고 Log·Audit·Outbox에 쓰지 않는다. 완료 후
  per-attempt DEK를 파기한다. Background reconciler는 이 artifact로 원 Target Mutation을 재전송하지 않는다.
- Provider Audit/Outbox는 `(commandId,eventType)` unique다. Platform 성공 후 Provider commit 전 crash도
  lease takeover가 Completion read로 Platform의 저장 응답을 받은 뒤 Provider Receipt/Audit/Outbox를
  원자적으로 완료한다. Provider는 retry에서 commandId를 재생성하거나 새 internal Idempotency key를 만들지 않는다.
- `WidgetProviderReceiptReconciler`는 lease가 만료된 Provider `IN_PROGRESS`를 `FOR UPDATE SKIP LOCKED`와
  fencing token으로 claim하고 completed-only Internal read를 호출한다. User session/permission이 만료돼도
  서비스 reconcile trust로 저장 결과만 읽을 수 있다. 일치 Completion을 받으면 Provider
  Receipt/Audit/Outbox를 같은 Transaction으로 완료한다.
- Platform의 `WidgetCommandReceiptFinalizer`는 lease가 만료되고 original assertion `exp+30초<db_now`인
  `IN_PROGRESS`를 Gate-first fence로 claim한다. Gate가 `OPEN`이고 Target/Event/Ledger가 없을 때만 Gate,
  durable Ledger와 `503 COMMAND_NOT_EXECUTED` Completed Receipt를 원자적으로 seal한다. Event/Target만 있거나
  `COMPLETED Receipt + Ledger`가 불일치하면 `503 COMMAND_COMPLETION_INTEGRITY_FAILURE`와 즉시 page 후
  재실행하지 않는다.
- Provider reconciler가 Completion `404`를 받고 original assertion `exp+30초<db_now`이면 새
  `seal-not-executed` endpoint를 호출한다. Platform은 current reconcile trust와 암호화 보관한 original
  service token/assertion의 signature·command binding·실제 `exp`를 검증한 뒤 Gate를 lock한다. Gate가
  `OPEN`이면 위 terminal Ledger/Receipt를 만들고, 이미 `SEALED`면 실제 저장 결과를 반환한다. 이는 원 Target
  Mutation fallback이 아니라 실행 금지 Tombstone 확정이다. Provider는 Platform이 반환한 저장 결과만으로
  Public Receipt를 완료하며 자체적으로 `COMMAND_NOT_EXECUTED`를 합성하지 않는다.
- Platform Command의 첫 Receipt Gate Transaction은 assertion `exp>db_now`를 다시 확인하고 Gate를
  insert-or-lock한 뒤에만 `IN_PROGRESS`를 insert한다. Target Transaction도 Gate를 먼저 잠그고 assertion
  `exp>db_now`를 다시 검사한다. exp가 지났으면 Target을 건드리지 않고 terminal seal한다. 따라서 exp 전에
  시작해 DB lock에서 지연된 ingress, Target 실행과 seal 요청 중 하나만 Gate lock 순서상 먼저 완료되고,
  Public terminal 결과와 후발 Mutation이 갈라질 수 없다.

`plt_widget_registry_events`

- Platform 상태 전이 Transaction과 원자적으로 기록
- Command event의 `command_id`, event type, aggregate/sequence; Completion Ledger와 binding
- actor plane, correlation ID, 접근통제된 Platform Audit row의 immutable `audit_ref_hash`, reason code,
  before/after hash. Stable operator/session ref는 Event·Outbox payload에 넣지 않는다.
- Restricted Provider/Platform Audit Store만 원 operator/session ref를 보관하고 correlation ID+audit ref hash로
  Event와 연결한다.
- exact command/scheduler/shadow branch와 30개 Event type·target matrix는
  [`fixtures/widget-registry-event.v1.schema.json`](fixtures/widget-registry-event.v1.schema.json),
  [`fixtures/widget-registry-event.v1.examples.json`](fixtures/widget-registry-event.v1.examples.json),
  [`fixtures/verify-registry-event-contract.mjs`](fixtures/verify-registry-event-contract.mjs)에 고정한다.
- 새 Aggregate를 만드는 `WIDGET_DEFINITION_CREATED`, `WIDGET_VERSION_CREATED`,
  `WIDGET_EVIDENCE_RECORDED`, `WIDGET_EVIDENCE_WAIVED`, `WIDGET_ROLLOUT_APPROVED`의 absent-state
  `beforeHash`는 RFC 8785 canonical
  JSON `null`의 UTF-8 bytes를 SHA-256한
  `74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b` 단일 sentinel이다. Producer가
  빈 Object, SQL null 문자열, 임의 digest를 선택할 수 없다. `afterHash`와 그 외 전이는 각 aggregate의
  versioned canonical projection bytes를 hash하며 projection schema version을 Event producer contract에 pin한다.
- 위 다섯 생성 Event는 `aggregateSequence=1`도 동시에 강제한다. Runtime control 변경은 target의
  `GLOBAL|DEFINITION|VERSION`, `resultingState=DISABLED|ENABLED`, 여섯 개 reason 조합을 exact 결속하고,
  Rollout stop은 `SAFETY_THRESHOLD|APPROVAL_EXPIRED`와 대응 reason을 exact 결속한다.
- `reasonCode`는 자유 문자열/정규식만으로 끝내지 않고 Event type별 closed allowlist다. Schema는 전체
  34-code enum을, 독립 verifier는 `eventType→allowed reasonCode[]` exact mapping과 target/state/cause
  swapped-reason Negative를
  검증한다. `occurredAt`은 UTC lexical pattern뿐 아니라 실제 Gregorian calendar 날짜/00..23시도 검증한다.
- Command와 Evidence-expiry Event는 `projectionSchemaVersion=1`과 closed `projectionType`을 필수로
  가진다. `DefinitionState|VersionState|EvidenceDecision|ReleaseChannelHead|RuntimeControlHead|
TenantPolicyHead|RolloutApproval|RolloutHead`의 eventType matrix를 Schema와 독립 verifier가 동시에
  고정한다. Fixture wrapper의 `source=LOCKED_DB_ROW`, `canonicalization=RFC8785_JCS` before/after projection을
  다시 canonicalize해 hash를 검증하며 Evidence raw ref, raw identity, child Approval mismatch를 거부한다.
  Shadow family에는 projection metadata/hash를 넣지 않는다.
- Runtime enable Event는 `enableApprovalId`를 ENABLE target과 locked `ACTIVE` Approval에 exact 결속하고,
  before/after child `controlRevision`을 현재 disabled Control revision에 고정한다. Quarantine clear Event는
  `clearanceApprovalId/quarantineEventId`를 locked current quarantine tuple 및 child `quarantineRevision`에
  exact 결속한다. 두 실행은 미만료·미사용 Approval만 허용하고 after projection에서 같은 Approval을
  `CONSUMED`, `consumedAt=occurredAt`, `consumedByCommandId=event.commandId`로 기록한다.

마이그레이션 번호는 구현 직전에 다시 예약한다. 2026-08-27 15:01 KST snapshot의 작업트리 최신 번호는
Platform `V200`, Provider `V49`, Auth `V106`이다. 다음 후보 `V201`, `V50`, `V107`은 예약이 아니며 Dirty Owner가
확정되거나 다른 Migration이 생기면 즉시 무효다.

## 5. Seed와 Manifest

기존 5개는 다음 exact state로만 Seed한다.

- Definition `ACTIVE`
- Version `1.0.0`, Workflow `APPROVED`, Release `PUBLISHED`, Safety `CLEAR`,
  Attestation `LEGACY_UNVERIFIED`
- Certification Evidence 행 `0`개; 파생 표시는 `NOT_RUN`, UI의 `인증 완료=false`
- `STABLE` Channel current head는 해당 Version, previous head는 `null`
- actor는 `SYSTEM_MIGRATION`, predecessor/replacement는 `null`, Manifest/hash는 아래 Golden anchor

Attestation은 Client 입력이 아니라 서버가 상태 전이와 함께 관리한다. 일반 Create는 항상 `PENDING`으로
초기화하고 `DRAFT | SUBMITTED | REJECTED`는 `PENDING`만 허용한다. Approve는 위 Risk/Evidence Gate가
전부 충족되고 SoD가 성립한 동일 Transaction에서 Workflow를 `APPROVED`, Attestation을
`PROVIDER_CERTIFIED`로 함께 전이한다. Rework는 `DRAFT/PENDING`으로 되돌린다.

`LEGACY_UNVERIFIED`는 이 5개 key의 승인된 Migration Seed에만 허용하는 폐쇄형 provenance다.
일반 Create/Submit/Approve/Publish API는 이 값을 받지 않는다. DB Constraint는 `APPROVED`에
`PROVIDER_CERTIFIED | LEGACY_UNVERIFIED`만, 표준 API가 만드는 `PUBLISHED`에는
`PROVIDER_CERTIFIED`만 허용하고, 예외인 위 5개 Seed의 `APPROVED/PUBLISHED/LEGACY_UNVERIFIED` 조합은
Migration role과 exact key allowlist로만 허용한다. Seed는 Static↔Shadow parity에는 쓰지만, 실제 Evidence와 새
`PROVIDER_CERTIFIED` Version이 없으면 Authoritative 전환을 차단한다. DB Constraint·Seed Test는
위 5개 exact key 외 `LEGACY_UNVERIFIED` 삽입과 Application Runtime의 해당 값 생성을 거부한다.
현재 UI의 `인증 완료`는 Attestation 단독 값이 아니라 위 Risk/Evidence Gate의 현재 유효성까지 다시 계산한다.
표준 `APPROVED/PROVIDER_CERTIFIED`이면서 Release가 `PUBLISHED | DEPRECATED`인 Version의 Gate가 Evidence
또는 waiver 만료로 깨지면 Attestation은 승인 시점의 역사적 사실로 보존하되 DB clock의 만료 순간부터
파생 `certificationStatus=EXPIRED`와 Effective Reason `CERTIFICATION_EXPIRED`가 된다. Effective Evaluator가
매 요청 직접 재평가하므로 Scheduler 지연 중에도 AUTHORITATIVE 신규 discovery와 기존 render/data/action은
즉시 차단된다. STATIC/SHADOW는 같은 would-deny/would-stop-data만 계산하여 legacy Runtime을 바꾸지 않는다.
Channel head는 audit를 위해 보존하지만 promote/rollback 대상에서 제외한다.

1분 `WidgetEvidenceExpiryScheduler`는 위 deny를 durable Safety 상태로 수렴시킨다. Scheduler workload
identity는 `SYSTEM_EVIDENCE_EXPIRY`이고 이 exact 자동 전이에만 human `REVOKE` SoD 예외를 가진다. 각 Worker는
후보 Version을 `FOR UPDATE SKIP LOCKED`로 claim한다. `causeDigest` 입력은
`{schemaVersion:1,versionId,manifestHash,invalidEntries:[{evidenceId,decisionRevision,status,expiresAt}]}` exact
Object이며 `invalidEntries`를 `evidenceId ASC, decisionRevision ASC`로 정렬하고 RFC 8785 canonical UTF-8
byte의 SHA-256을 계산한다. unknown/missing field와 nullable expiry는 거부한다.
`(WIDGET_EVIDENCE_EXPIRED,versionId,causeDigest)` Event unique constraint가 Idempotency key다.
Safety가 `CLEAR`면 같은 Transaction에서 새 `QUARANTINED` revision, Event, Outbox를 기록하고, 이미
`QUARANTINED | REVOKED`면 중복 Safety revision 없이 Event/Outbox 존재만 보장한다. 실패는 전부 rollback하고
같은 causeDigest로 retry한다. 이 사유의 Quarantine clear는 현재 Risk/Evidence Gate 복구와 새 clearance
approval이 모두 없으면 `422 EVIDENCE_GATE_FAILED`다.

Clearance Approval은 `versionId`, immutable `manifestHash`, 현재 `evidenceDecisionRevision`,
`bindingCatalogRevision`, `bindingHeadVersion`, `productAppRevision`, `rendererRevision`,
`capabilityRevision`, `catalogRevision`, `safetyRevision`, 현재 active `quarantineEventId`를 함께 고정한다.
Approval row는 `ACTIVE | CONSUMED | REVOKED | EXPIRED`, DB-clock 최대 30분 expiry, nullable
`consumedAt/consumedByCommandId`를 append-only로 보존한다. Approval 생성은 Version/Safety head를 잠그고
요청의 `quarantineEventId`가 current active Quarantine Event와 같을 때만 `ACTIVE`를 만든다. Clear 실행은
Version/Safety head와 Approval을 잠근 뒤
`approval.versionId/quarantineEventId == request.versionId/quarantineEventId == current active quarantine eventId`,
Approval `ACTIVE`·미만료·미사용을 exact 검증한다. 같은 Transaction에서 새 `CLEAR` Safety revision,
Approval `CONSUMED`, Audit/Event/Outbox/Completion을 기록하므로 이전 사건의 Approval은 재격리 사건에
재사용할 수 없다. stale 사건/tuple은 `409 DECISION_REVISION_CONFLICT`, consumed/expired/revoked Approval은
`422 CLEARANCE_APPROVAL_INVALID`다. Clear 실행은 Target lock 뒤
`APPROVED+PUBLISHED+QUARANTINED`, Channel promote/rollback은 `APPROVED+PUBLISHED+CLEAR`를 요구한다. 둘 다
current Risk/Evidence Gate, Manifest 전체 Binding Gate와 current Binding head를 다시 계산한다.
Approval/요청 tuple과 하나라도 달라지면 `409 DECISION_REVISION_CONFLICT`, 현재 Gate 실패는
`422 EVIDENCE_GATE_FAILED|BINDING_GATE_FAILED`로 거부하고 과거 PASS를 재사용하지 않는다.

| Canonical key                 | Legacy key     |
| ----------------------------- | -------------- |
| `core.workspace.command-rail` | `command-rail` |
| `core.workspace.daily-brief`  | `daily-brief`  |
| `core.work.focus`             | `focus`        |
| `core.calendar.schedule`      | `schedule`     |
| `core.activity.activity`      | `activity`     |

Tenant Policy Migration baseline은 위 5개를 Tenant마다 명시적 Published Revision으로 만든다. exact
Schema·Golden·독립 digest 검증은
[`fixtures/widget-tenant-policy-seeds.v1.schema.json`](fixtures/widget-tenant-policy-seeds.v1.schema.json),
[`fixtures/widget-tenant-policy-seeds.v1.golden.json`](fixtures/widget-tenant-policy-seeds.v1.golden.json),
[`fixtures/verify-tenant-policy-seeds.mjs`](fixtures/verify-tenant-policy-seeds.mjs)에 고정한다. App을 보유하지
않은 Tenant도 같은 baseline row를 가지되 Evaluator의 Entitlement Gate가 우선하여 deny한다. 이 Seed는
Preference·Instance·Preset을 만들지 않고, 기존 명시적 Tenant Revision을 덮어쓰지 않는다.

Manifest는 중앙의 폐쇄형 계약이다.

일반 Version 입력의 exact 구조는
[`fixtures/widget-manifest.v1.schema.json`](fixtures/widget-manifest.v1.schema.json)이며 root와 모든 nested
Object는 `additionalProperties=false`다. Array cardinality/unique, enum, 정규식과 수치 상한은 Schema가,
`default∈allowed`, item min≤max, Policy Class↔Context, canonical set order와 32KiB 상한은
[`fixtures/verify-manifest-contract.mjs`](fixtures/verify-manifest-contract.mjs)가
[`fixtures/widget-manifest.v1.negative.json`](fixtures/widget-manifest.v1.negative.json)의 10개 Negative
case로 검증한다. `verify-golden.mjs`도 이 executable contract를 import하므로 Seed digest만 통과하고 일반
Manifest Schema가 깨지는 상태를 허용하지 않는다.

```json
{
  "schemaVersion": 1,
  "definitionKey": "core.calendar.schedule",
  "owner": {
    "productKey": "core.calendar",
    "sourceAppResourceKey": "APP.CALENDAR"
  },
  "renderer": {
    "kind": "NATIVE",
    "rendererKey": "home.schedule",
    "minimumHostApiVersion": 1
  },
  "supportedSurfaces": ["workspace-home"],
  "requiredAuthorities": ["APP.CALENDAR:VIEW"],
  "placement": {
    "supportedContexts": ["CLASSIC_PERSONAL", "FLOW_PERSONAL"],
    "policyClass": "PERSONAL",
    "canHide": true,
    "defaultSize": "quarter",
    "allowedSizes": ["fifth", "quarter", "compact", "medium"],
    "defaultHeight": "standard",
    "allowedHeights": ["short", "standard", "tall"]
  },
  "configurationContract": {
    "sourceKey": "CALENDAR",
    "fieldKeys": ["title", "startAt", "endAt", "location"],
    "filterPresets": ["TODAY", "NEXT_7_DAYS"],
    "itemLimit": { "min": 1, "max": 20 }
  },
  "dataCapabilities": ["CALENDAR.EVENTS.LIST"],
  "actionCapabilities": [],
  "sharing": { "presetEligible": true },
  "operations": {
    "freshnessSeconds": 30,
    "analyticsKey": "home.schedule"
  },
  "privacy": {
    "classification": "CONFIDENTIAL",
    "retention": "NONE",
    "recipientContextBinding": true
  }
}
```

`rendererKey`, capability, field, filter, size, height, surface, placement context와 analytics key는 Server
Allowlist와 정규식·수치 범위로 검증한다. Browser가 보낸 App Route, 권한 보유 주장, User/Tenant ID,
Source URL, Renderer Code 또는 관리형 Placement Context를 신뢰하지 않는다.

Manifest는 독립 문서가 아니라 Parent Definition과 §4.2의 active
`WidgetManifestBindingCatalog` Revision에 강하게 binding한다. Version
Create/Update/Validate/Submit/Approve/Publish는 모두 current Snapshot으로 아래 조건을 다시 검증한다.
권한원 자체가 불완전하면 `503 MANIFEST_BINDING_AUTHORITY_UNAVAILABLE`, 이전 Validation의 Revision이
바뀌면 `409 MANIFEST_BINDING_REVISION_CHANGED`, 현재 Snapshot과 내용이 어긋나면
`422 MANIFEST_OWNERSHIP_MISMATCH`다.

- `manifest.definitionKey == parentDefinition.definitionKey`
- `manifest.owner.productKey == parentDefinition.ownerProductKey`이고 signed Provider assertion의
  `ownerProductKeys[]`가 해당 Product를 포함
- `manifest.owner.sourceAppResourceKey`는 Binding Catalog에서 해당 owner Product에 등록된 active App
  Resource이고, `requiredAuthorities[]`는 그 App의 등록 Authority exact set 부분집합
- Phase 1A의 `renderer.kind=NATIVE`; `(rendererKey,ownerProductKey,sourceAppResourceKey)`가 Host의 immutable
  Renderer binding row와 exact 일치
- `configurationContract.sourceKey`, `dataCapabilities[]`, `actionCapabilities[]`는 Binding Catalog에서 같은
  Product/App에 등록된 exact set의 부분집합. capability prefix 유사 일치는 허용하지 않음
- `manifest.privacy.classification == parentDefinition.dataClassification`

Validation run은 Parent Definition version, Catalog/head version, Product/App authority revision,
Renderer revision, Capability revision과 Manifest hash를 함께 고정한다. 이후 Revision이 하나라도 바뀌면 기존 run은
Submit/Approve/Publish에 재사용할 수 없다. 다른 Definition key, cross-product App·renderer·authority·data·
action capability 사칭 Negative Test를 Public API와 Internal command 양쪽에 둔다.

Canonicalization은 [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)의
UTF-16 property ordering과 ECMAScript primitive serialization을 사용한다. DWP Manifest v1은 JCS의
허용 범위를 더 좁혀 다음을 강제한다.

- 입력은 UTF-8(BOM 없음)이며 모든 key와 string value는 저장 전에 NFC여야 한다. Canonicalizer가 값을
  조용히 정규화하지 않고 NFC가 아니면 거부한다.
- 숫자는 `0..Number.MAX_SAFE_INTEGER`의 정수만 허용하고 `-0`, 소수, 지수, `NaN`, Infinity를 거부한다.
- Object key는 JCS 순서로 정렬하고 Array 순서는 의미의 일부이므로 정렬하지 않는다.
- Schema의 필수 nullable field는 `null`을 포함한다. 임의 field 생략, `undefined`, 중복 key와 unknown
  property는 Schema validation에서 먼저 거부한다.
- Hash 범위는 `manifest` Object 하나의 canonical UTF-8 bytes다. `expectedSha256`, DB ID, 상태,
  timestamp와 증거 URI는 포함하지 않는다. 결과는 lowercase 64자 SHA-256 hex다.

5종 전체 payload와 기대 Digest는
[`fixtures/widget-manifests.v1.golden.json`](fixtures/widget-manifests.v1.golden.json)에 고정했고
[`fixtures/verify-golden.mjs`](fixtures/verify-golden.mjs)가 독립 검증한다. TS·Java·DB Seed는 Fixture를
별도 재작성하지 않고 같은 파일을 Test Resource로 읽어 byte와 digest가 모두 일치해야 한다.
Verifier는 Fixture 내부 `expectedSha256`를 자기참조하지 않고 독립적인
`legacyWidgetKey → exact definitionKey → SHA-256` 상수 Map과 Fixture 파일 전체 byte SHA-256를
고정한다. 따라서 key 교체, Manifest+digest 동시 변경, duplicate JSON key·공백 변경도 명시적
Golden 승인 없이 통과하지 못한다.

| Legacy key     | expected SHA-256                                                   |
| -------------- | ------------------------------------------------------------------ |
| `command-rail` | `a3a1fd5ffff9d7f6014ec3007a16ebea10dbf8ce3ae19e02fd2bd001fee0eb97` |
| `daily-brief`  | `9b7f48b7ea4ef429120db330a4972c3315ad682759fa86e49c212c42bdd02406` |
| `focus`        | `36d1b02326e4725a235749e173dfdf50a0423ef30f42d7ccab97946ba826d893` |
| `schedule`     | `7f3e090997a213e9d3e6f8184e1458e57382c5f31db79f00fbf678d36f884f5d` |
| `activity`     | `fbab61015ec3b20c2faf9810b1758aebbd7517029baa64cb6b99190815836ca1` |

## 6. API 계약

### 6.1 Provider 공개 API

```text
GET/POST /v1/admin/widget-definitions
GET      /v1/admin/widget-definitions/{definitionId}
GET      /v1/admin/widget-definitions/{definitionId}/versions
POST     /v1/admin/widget-definitions/{definitionId}/versions
GET      /v1/admin/widget-definitions/{definitionId}/retirement-impact
GET/PUT  /v1/admin/widget-definition-versions/{versionId}
POST     /v1/admin/widget-definition-versions/{versionId}/validate
POST     /v1/admin/widget-definition-versions/{versionId}/submit
POST     /v1/admin/widget-definition-versions/{versionId}/decision
POST     /v1/admin/widget-definition-versions/{versionId}/rework
POST     /v1/admin/widget-definition-versions/{versionId}/evidence
GET      /v1/admin/widget-definition-versions/{versionId}/evidence
GET      /v1/admin/widget-definition-versions/{versionId}/evidence/{evidenceId}
POST     /v1/admin/widget-definition-versions/{versionId}/evidence/{evidenceId}/waive
POST     /v1/admin/widget-definition-versions/{versionId}/publish
POST     /v1/admin/widget-definition-versions/{versionId}/deprecate
POST     /v1/admin/widget-definition-versions/{versionId}/quarantine
POST     /v1/admin/widget-definition-versions/{versionId}/clear-quarantine-approvals
POST     /v1/admin/widget-definition-versions/{versionId}/clear-quarantine
POST     /v1/admin/widget-definition-versions/{versionId}/revoke
POST     /v1/admin/widget-definitions/{definitionId}/retire
GET      /v1/admin/widget-definitions/{definitionId}/channels/{channel}
POST     /v1/admin/widget-definitions/{definitionId}/channels/{channel}/promote
POST     /v1/admin/widget-definitions/{definitionId}/channels/{channel}/rollback
GET      /v1/admin/widget-runtime-controls
POST     /v1/admin/widget-runtime-controls/disable
POST     /v1/admin/widget-runtime-controls/{controlId}/enable-approvals
POST     /v1/admin/widget-runtime-controls/{controlId}/enable
```

Provider Endpoint는 Provider Server의 공개 계약이다. Platform의 Internal Mutation Endpoint는 전용
Service Identity만 사용하고 Gateway에 노출하지 않는다.

OpenAPI v1의 최소 Operation 계약은 다음과 같다. 모든 Mutation DTO는 `reasonCode`, `reasonText`와
`expectedVersion`을 포함하고 UUID `Idempotency-Key`와 `X-Correlation-ID` Header를 요구한다.
조회 Query도 폐쇄형이다.

Gateway와 각 Service는 decompressed public/internal Mutation body를 64KiB에서 먼저 끊고 초과 시 Receipt나
Target을 만들지 않는 `413 PAYLOAD_TOO_LARGE`를 반환한다. Manifest v1의 RFC 8785 canonical bytes는
32KiB 이하, 나머지 typed Request의 canonical bytes는 48KiB 이하여야 한다. Target lock 전에 성공/결정적
오류 Response를 canonical serialize해 64KiB 이하임을 preflight하며 초과 예상은 작은
`422 RESPONSE_CONTRACT_TOO_LARGE` `REJECTED` Ledger로 완료한다. 따라서 Target commit 뒤 Completion
Ledger 64KiB 한도로 실패하는 경로가 없다. Unknown/duplicate JSON key와 압축 해제 비율 초과도 Target 전
`400 INVALID_INPUT_VALUE` 또는 `413`으로 닫는다.

- `WidgetDefinitionListQuery`: `page≥0`, `size=1..100`,
  `sort=definitionKey:asc|updatedAt:desc`, `ownerProductKey?`,
  `definitionState=ACTIVE|RETIRED?`, `riskTier=LOW|MEDIUM|HIGH?`, NFKC `q?` 최대 100자,
  opaque `readRevision?`
- `WidgetVersionListQuery`: `page≥0`, `size=1..100`,
  `sort=createdAt:desc|semanticVersion:desc`, `workflowState?`, `releaseState?`, `safetyState?`,
  `channel?`, opaque `readRevision?`
- `WidgetEvidenceListQuery`: `page≥0`, `size=1..100`, `sort=createdAt:desc`, `evidenceType?`,
  `status?`, opaque `readRevision?`
- `WidgetDefinitionRetirementImpactQuery`: nullable `replacementDefinitionId`만 허용한다. Server는 현재
  Definition/channel/policy/instance/preset/reference revision을 한 read-only Transaction에서 계산한다.

`WidgetDefinitionPage`, `WidgetVersionPage`, `WidgetEvidencePage`, `WidgetRuntimeControlPage`는 `items[]`, `page`, `size`,
`totalElements`, `hasNext`, opaque `readRevision`의 exact envelope다. 모든 목록은 한 read-only DB
Transaction에서 생성하고 `X-Widget-Registry-Revision=readRevision`을 반환한다. 첫 page는
`readRevision`을 생략하고, 다음 page부터 직전 응답값을 Query로 반드시 보낸다. 현재 Registry
revision이 Query와 다르면 중간 결과를 반환하지 않고 `409 READ_REVISION_CONFLICT`로 전체
재시작을 요구한다. Detail GET은 동일 revision Header와 Entity `ETag`을 반환한다.

| operationId                           | Method·path                                                                         | Request DTO                             | Success DTO                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------- |
| `listWidgetDefinitions`               | `GET /v1/admin/widget-definitions`                                                  | Query/Page                              | `WidgetDefinitionPage`                      |
| `createWidgetDefinition`              | `POST /v1/admin/widget-definitions`                                                 | `WidgetDefinitionCreateRequest`         | `WidgetDefinitionResponse` `201`            |
| `getWidgetDefinition`                 | `GET /v1/admin/widget-definitions/{definitionId}`                                   | —                                       | `WidgetDefinitionResponse`                  |
| `listWidgetDefinitionVersions`        | `GET /v1/admin/widget-definitions/{definitionId}/versions`                          | Query/Page                              | `WidgetVersionPage`                         |
| `createWidgetDefinitionVersion`       | `POST /v1/admin/widget-definitions/{definitionId}/versions`                         | `WidgetVersionCreateRequest`            | `WidgetVersionResponse` `201`               |
| `getWidgetDefinitionRetirementImpact` | `GET /v1/admin/widget-definitions/{definitionId}/retirement-impact`                 | `WidgetDefinitionRetirementImpactQuery` | `WidgetDefinitionRetirementImpactResponse`  |
| `getWidgetDefinitionVersion`          | `GET /v1/admin/widget-definition-versions/{versionId}`                              | —                                       | `WidgetVersionResponse`                     |
| `updateWidgetDefinitionVersion`       | `PUT /v1/admin/widget-definition-versions/{versionId}`                              | `WidgetVersionUpdateRequest`            | `WidgetVersionResponse`                     |
| `validateWidgetDefinitionVersion`     | `POST /v1/admin/widget-definition-versions/{versionId}/validate`                    | `WidgetVersionValidateRequest`          | `WidgetValidationResponse`                  |
| `submitWidgetDefinitionVersion`       | `POST /v1/admin/widget-definition-versions/{versionId}/submit`                      | `WidgetTransitionRequest`               | `WidgetVersionResponse`                     |
| `decideWidgetDefinitionVersion`       | `POST /v1/admin/widget-definition-versions/{versionId}/decision`                    | `WidgetReviewDecisionRequest`           | `WidgetVersionResponse`                     |
| `reworkWidgetDefinitionVersion`       | `POST /v1/admin/widget-definition-versions/{versionId}/rework`                      | `WidgetReworkRequest`                   | `WidgetVersionResponse`                     |
| `recordWidgetCertificationEvidence`   | `POST /v1/admin/widget-definition-versions/{versionId}/evidence`                    | `WidgetEvidenceCreateRequest`           | `WidgetEvidenceResponse` `201`              |
| `listWidgetCertificationEvidence`     | `GET /v1/admin/widget-definition-versions/{versionId}/evidence`                     | `WidgetEvidenceListQuery`               | `WidgetEvidencePage`                        |
| `getWidgetCertificationEvidence`      | `GET /v1/admin/widget-definition-versions/{versionId}/evidence/{evidenceId}`        | —                                       | `WidgetEvidenceResponse`                    |
| `waiveWidgetCertificationEvidence`    | `POST /v1/admin/widget-definition-versions/{versionId}/evidence/{evidenceId}/waive` | `WidgetEvidenceWaiverRequest`           | `WidgetEvidenceResponse`                    |
| `publishWidgetDefinitionVersion`      | `POST /v1/admin/widget-definition-versions/{versionId}/publish`                     | `WidgetPublishRequest`                  | `WidgetVersionResponse`                     |
| `deprecateWidgetDefinitionVersion`    | `POST /v1/admin/widget-definition-versions/{versionId}/deprecate`                   | `WidgetDeprecateRequest`                | `WidgetVersionResponse`                     |
| `quarantineWidgetDefinitionVersion`   | `POST /v1/admin/widget-definition-versions/{versionId}/quarantine`                  | `WidgetSafetyTransitionRequest`         | `WidgetVersionResponse`                     |
| `approveWidgetQuarantineClearance`    | `POST /v1/admin/widget-definition-versions/{versionId}/clear-quarantine-approvals`  | `WidgetClearanceApprovalRequest`        | `WidgetClearanceApprovalResponse`           |
| `clearWidgetVersionQuarantine`        | `POST /v1/admin/widget-definition-versions/{versionId}/clear-quarantine`            | `WidgetClearanceExecutionRequest`       | `WidgetVersionResponse`                     |
| `revokeWidgetDefinitionVersion`       | `POST /v1/admin/widget-definition-versions/{versionId}/revoke`                      | `WidgetSafetyTransitionRequest`         | `WidgetVersionResponse`                     |
| `retireWidgetDefinition`              | `POST /v1/admin/widget-definitions/{definitionId}/retire`                           | `WidgetDefinitionRetireRequest`         | `WidgetDefinitionResponse`                  |
| `getWidgetReleaseChannel`             | `GET /v1/admin/widget-definitions/{definitionId}/channels/{channel}`                | —                                       | `WidgetReleaseChannelResponse`              |
| `promoteWidgetReleaseChannel`         | `POST /v1/admin/widget-definitions/{definitionId}/channels/{channel}/promote`       | `WidgetChannelTransitionRequest`        | `WidgetReleaseChannelResponse`              |
| `rollbackWidgetReleaseChannel`        | `POST /v1/admin/widget-definitions/{definitionId}/channels/{channel}/rollback`      | `WidgetChannelRollbackRequest`          | `WidgetReleaseChannelResponse`              |
| `listWidgetRuntimeControls`           | `GET /v1/admin/widget-runtime-controls`                                             | `WidgetRuntimeControlListQuery`         | `WidgetRuntimeControlPage`                  |
| `disableWidgetRuntimeControl`         | `POST /v1/admin/widget-runtime-controls/disable`                                    | `WidgetRuntimeDisableRequest`           | `WidgetRuntimeControlResponse` `201`        |
| `approveWidgetRuntimeControlEnable`   | `POST /v1/admin/widget-runtime-controls/{controlId}/enable-approvals`               | `WidgetRuntimeEnableApprovalRequest`    | `WidgetRuntimeEnableApprovalResponse` `201` |
| `enableWidgetRuntimeControl`          | `POST /v1/admin/widget-runtime-controls/{controlId}/enable`                         | `WidgetRuntimeEnableRequest`            | `WidgetRuntimeControlResponse` `201`        |

핵심 DTO의 폐쇄형 필드는 다음과 같다. `manifest`는 Manifest v1 Schema를 통과한 Object만 허용하고 자유형
확장 필드는 거부한다. UUID는 lowercase canonical text, digest는 lowercase 64-hex, `reasonCode`는 서버
allowlist의 ASCII enum, `reasonText`는 NFC 1..500자, opaque ref는 NFC 1..128자이고 control character를
거부한다. `expectedVersion`은 non-negative integer다.

- `WidgetDefinitionCreateRequest`: `definitionKey`, `ownerProductKey`,
  `ownerTeamKey`, `riskTier`, `dataClassification`, `reasonCode`, `reasonText`, `expectedVersion=0`
- `WidgetVersionCreateRequest`: `semanticVersion`, `manifest`, `predecessorVersionId?`, 공통 Mutation field
- `WidgetVersionUpdateRequest`: `manifest`, `predecessorVersionId?`, 공통 Mutation field. `DRAFT`에서만
  허용하고 semantic version과 Parent Definition은 바꾸지 않는다.
- `WidgetVersionValidateRequest`: `manifestHash`, 공통 Mutation field. Check 선택 배열은 없으며 Manifest,
  Parent, Binding Catalog와 모든 정적 Gate를 서버가 전부 실행한다.
- `WidgetReviewDecisionRequest`: `decision=APPROVE|REJECT`, `validationRunId`, `evidenceIds[]`, 공통 field
- `WidgetTransitionRequest`: 공통 Mutation field만 허용한다. Path와 현재 상태가 Transition 의미를 결정하고
  Client가 target state를 보내지 않는다.
- `WidgetDeprecateRequest`: `replacementVersionId`, `deprecationEndsAt`, 공통 field. Replacement는 같은
  Definition의 다른 `PUBLISHED/CLEAR` Version이고 current Evidence/Binding Gate를 통과해야 한다.
  `deprecationEndsAt`은 DB clock보다 미래이고 365일 이내이며 만료 시 자동 Allow가 아니라 신규 Add 금지를
  유지하고 운영 escalation을 만든다.
- `WidgetDefinitionRetireRequest`: `replacementDefinitionId?`, `impactRevision`, 공통 field. Active channel이
  없어야 하고 Tenant Policy/Instance/Preset 참조가 하나라도 있으면 replacement가 필수다. Replacement는 다른
  `ACTIVE` Definition, Published STABLE head, current Safety/Evidence/Binding Gate와 호환 Surface를 가져야 한다.
  참조 0건일 때만 null을 허용하고 impactRevision이 current와 다르면 `409 DECISION_REVISION_CONFLICT`다.
- `WidgetReworkRequest`: `rejectedDecisionId`, 공통 Mutation field. 현재 `REJECTED` head의 Decision ID와
  일치해야 하며 성공 시 Manifest는 바꾸지 않고 `DRAFT/PENDING`으로 전이한 뒤 validation/approval link를
  비운다. 이후 편집은 기존 Draft `PUT`을 사용한다.
- `WidgetPublishRequest`: `channel`, `validationRunId`, `evidenceIds[]`, `manifestHash`, 공통 field
- `WidgetEvidenceCreateRequest`: `evidenceType=MANIFEST|SECURITY|PRIVACY|A11Y|PERFORMANCE|LOCALIZATION`,
  `decision=PASS|FAIL`, `manifestHash`, `evidenceRef`, `evidenceSha256`, `expiresAt?`, `reviewNote?`, 공통 field.
  `NOT_RUN|EXPIRED|WAIVED`와 reviewer identity/revision은 서버가 만든다.
- `WidgetEvidenceWaiverRequest`: `manifestHash`, `waiverExpiresAt`, `waiverReason`, `trackingTicketRef`,
  공통 field. Path Evidence가 `PERFORMANCE|LOCALIZATION`이고 Risk `LOW|MEDIUM`인 경우만 허용한다.
- `WidgetSafetyTransitionRequest`: `publicReasonCode`, `internalIncidentRef`, `replacementVersionId?`,
  `expiresAt?`, 공통 field
- `WidgetClearanceApprovalRequest`: `quarantineEventId`, `reviewDecision`, `evidenceRefs[]`, 공통 field
- `WidgetClearanceExecutionRequest`: `clearanceApprovalId`, `quarantineEventId`, 공통 field
- `WidgetChannelTransitionRequest`: `versionId`, `validationRunId`, `manifestHash`, 공통 field. Path channel의
  current head version이 `expectedVersion`과 같고 대상 Version Gate를 다시 통과해야 한다.
- `WidgetChannelRollbackRequest`: `restoreVersionId`, `expectedCurrentVersionId`, 공통 field. previous head를
  암묵 추론하지 않고 지정 Version의 current Gate를 다시 검증한다.
- `WidgetRuntimeControlListQuery`: `page≥0`, `size=1..100`, `sort=createdAt:desc`, `scope?`,
  `targetType?`, `state?`, opaque `readRevision?`
- `WidgetRuntimeDisableRequest`: `scope=CATALOG_MUTATIONS|CATALOG_DISCOVERY|RUNTIME_RENDER|RUNTIME_ACTION`,
  `targetType=GLOBAL|DEFINITION|VERSION`, `targetId`(단 `GLOBAL`은 `null`), `expiresAt?`,
  `publicReasonCode`, `internalIncidentRef`, 공통 field
- `WidgetRuntimeEnableApprovalRequest`: `controlRevision`, `evidenceRefs[]`, 공통 field
- `WidgetRuntimeEnableRequest`: `enableApprovalId`, `controlRevision`, 공통 field
- `WidgetClearanceApprovalResponse`: `approvalId`, `versionId`, `quarantineEventId`, `reviewDecision`, `state`,
  `evidenceRefHashes[]`, `expiresAt`, nullable `consumedAt`, opaque `approvedBy`, `version`, `createdAt`
- `WidgetRuntimeEnableApprovalResponse`: `approvalId`, `controlId`, `controlRevision`,
  `state`, `evidenceRefHashes[]`, `expiresAt`, nullable `consumedAt`, opaque `approvedBy`, `version`, `createdAt`

핵심 Response도 `additionalProperties=false`다.

- `WidgetDefinitionResponse`: `definitionId`, `definitionKey`, `legacyWidgetKey?`, `ownerProductKey`,
  `ownerTeamKey`, `riskTier`, `dataClassification`, `definitionState`, `version`, `createdAt`, `updatedAt`,
  `allowedTransitions[]`
- `WidgetVersionResponse`: `versionId`, `definitionId`, `semanticVersion`, `manifest`, `manifestHash`,
  `workflowState`, `releaseState`, `safetyState`, `attestation`, `certificationStatus`,
  `predecessorVersionId?`, `replacementVersionId?`, `validationRunId?`, nullable `currentReviewDecisionId`,
  nullable `currentQuarantineEventId`, `bindingCatalogRevision?`,
  `version`, `createdAt`, `updatedAt`, `allowedTransitions[]`
- `WidgetVersionResponse`는 두 independent closed `oneOf`을 추가로 적용한다. `workflowState=REJECTED`일 때만
  `currentReviewDecisionId`가 UUID이고 그 외 workflow에서는 `null`이다. `safetyState=QUARANTINED`일 때만
  `currentQuarantineEventId`가 UUID이고 그 외 safety state에서는 `null`이다. 따라서 REWORK와 clearance
  Client가 필요한 optimistic producer ID를 Detail GET만으로 항상 얻는다.
- `WidgetValidationResponse`: `validationRunId`, `versionId`, `manifestHash`, `status=PASS|FAIL`,
  `parentDefinitionVersion`, `bindingCatalogRevision`, `bindingHeadVersion`, `productAppRevision`,
  `rendererRevision`, `capabilityRevision`, `errors[]`, `validatedAt`. Error는
  `{code,jsonPointer}` exact pair이고 자유 text/stack을 반환하지 않는다.
- `WidgetEvidenceResponse`: `evidenceId`, `versionId`, `evidenceType`, `status`, `manifestHash`,
  `evidenceRef`, `evidenceSha256`, `expiresAt?`, `decisionRevision`, `waivedEvidenceId?`,
  `trackingTicketRef?`, opaque `reviewedBy`, `createdAt`
- `WidgetDefinitionRetirementImpactResponse`: `definitionId`, nullable `replacementDefinitionId`,
  `activeChannelCount`, `tenantPolicyReferenceCount`, `instanceReferenceCount`, `presetReferenceCount`,
  `replacementCompatible`, `retirementAllowed`, `impactRevision`, `calculatedAt`. Raw Tenant/subject/reference ID는
  반환하지 않는다.
- `WidgetReleaseChannelResponse`: `definitionId`, `channel=STABLE|PREVIEW`, `currentVersionId?`,
  `previousVersionId?`, `version`, `updatedAt`, `allowedTransitions[]`

`ETag`은 Response body field가 아니라 위 Detail/Mutation HTTP Header이며 `version`에서 결정적으로 만든다.
모든 Response는 내부 Incident 본문, Credential, 원천 URL, raw actor/session을 반환하지 않는다.

### 6.2 Tenant API

```text
GET  /v1/admin/widget-catalog
GET  /v1/admin/widget-policies/{definitionId}
POST /v1/admin/widget-policies/{definitionId}/revisions
PUT  /v1/admin/widget-policies/{definitionId}/revisions/{revisionId}
GET  /v1/admin/widget-policies/{definitionId}/revisions/{revisionId}/impact
POST /v1/admin/widget-policies/{definitionId}/revisions/{revisionId}/publish
POST /v1/admin/widget-policies/{definitionId}/revoke
POST /v1/admin/widget-policies/{definitionId}/rollback
GET  /v1/admin/widget-policies/{definitionId}/history
GET  /v1/admin/widget-catalog/{definitionId}/explain
```

| operationId                   | Method·path                                                                    | Request DTO                   | Success DTO                    |
| ----------------------------- | ------------------------------------------------------------------------------ | ----------------------------- | ------------------------------ |
| `listTenantWidgetCatalog`     | `GET /v1/admin/widget-catalog`                                                 | `TenantWidgetCatalogQuery`    | `TenantWidgetCatalogPage`      |
| `getTenantWidgetPolicy`       | `GET /v1/admin/widget-policies/{definitionId}`                                 | —                             | `TenantWidgetPolicyResponse`   |
| `createTenantPolicyRevision`  | `POST /v1/admin/widget-policies/{definitionId}/revisions`                      | `TenantPolicyRevisionRequest` | `TenantPolicyRevisionResponse` |
| `updateTenantPolicyRevision`  | `PUT /v1/admin/widget-policies/{definitionId}/revisions/{revisionId}`          | `TenantPolicyRevisionRequest` | `TenantPolicyRevisionResponse` |
| `previewTenantPolicyImpact`   | `GET /v1/admin/widget-policies/{definitionId}/revisions/{revisionId}/impact`   | —                             | `TenantPolicyImpactResponse`   |
| `publishTenantPolicyRevision` | `POST /v1/admin/widget-policies/{definitionId}/revisions/{revisionId}/publish` | `TenantPolicyPublishRequest`  | `TenantWidgetPolicyResponse`   |
| `revokeTenantWidgetPolicy`    | `POST /v1/admin/widget-policies/{definitionId}/revoke`                         | `TenantPolicyRevokeRequest`   | `TenantWidgetPolicyResponse`   |
| `rollbackTenantWidgetPolicy`  | `POST /v1/admin/widget-policies/{definitionId}/rollback`                       | `TenantPolicyRollbackRequest` | `TenantWidgetPolicyResponse`   |
| `listTenantPolicyHistory`     | `GET /v1/admin/widget-policies/{definitionId}/history`                         | `TenantPolicyHistoryQuery`    | `TenantPolicyRevisionPage`     |
| `explainTenantWidgetDecision` | `GET /v1/admin/widget-catalog/{definitionId}/explain`                          | `surfaceKey`, `subjectRef?`   | `TenantWidgetExplainResponse`  |

`TenantPolicyRevisionRequest`는 `enabled`, `selector=CHANNEL|PINNED`, `channel?`, `versionId?`,
`supportedSurfaceKeys[]`, `audienceSelector`, `required`, `lockedConfiguration`, `sharingPolicy`,
`reasonCode`, `reasonText`, `expectedVersion`만 허용한다. `TenantPolicyPublishRequest`는
`expectedVersion`, `expectedImpactRevision`, `reasonCode`, `reasonText`만 요구한다. Phase 1A Publish는 DB
clock의 같은 Transaction에서 즉시 적용하며 `effectiveAt`이나 scheduled state를 허용하지 않는다. Impact
preimage는 internal Tenant binding, definition/draft ID와 version, catalog/binding/policy/safety/authority
revision, audience selector hash, `validUntil`, 다섯 aggregate count의 closed object이고
`impactRevision=sha256(RFC8785-JCS(preimage))`다. Publish는 Tenant·Draft·세 head·Authority snapshot을 같은
Transaction에서 잠그고 preimage를 재계산한 뒤 `expectedImpactRevision`과 exact 비교한다. stale/cross-tenant/
count change/expired authority면 `409 IMPACT_REVISION_CONFLICT`로 거부하고 State·Event·Outbox·Audit를 전혀
기록하지 않는다. 성공 Response·Audit·`TENANT_WIDGET_POLICY_PUBLISHED` Event는 적용된 `impactRevision`을
동일하게 보존한다. `GET .../impact`는 저장 Side Effect 없는 표시용
read model이며 Publish 증거가 아니다. `subjectRef` Explain은 관리자에게도
현재 Tenant 내부 opaque person ref만 허용하고 일반 사용자의 raw authority 목록은 반환하지 않는다.
`TenantPolicyRevokeRequest`는 `publishedRevisionId`, `expectedVersion`, `publicReasonCode`,
`reasonText`를 요구하고, 새 `REVOKED` event/revision을 만들어 기존 Published 행을 수정하지
않는다. 결과는 해당 Tenant만 deny하고 기존 Layout/config는 보존한다.

`audienceSelector`는 Policy Revision에 inline 저장하는 non-null `AudienceSelectorV1`이다. 외부 Rule ref나
자유 Query/Expression을 허용하지 않는다.

```text
AudienceSelectorV1 {
  schemaVersion: 1,
  mode: ALL_ENTITLED | ANY_OF | ALL_OF,
  roleCodes: string[],
  groupRefs: opaque-string[]
}
```

- `ALL_ENTITLED`는 두 배열이 모두 비어야 하며 App Entitlement/Permission Gate를 완화하지 않는다.
- `ANY_OF`는 두 배열 합계가 1..100이고 현재 Principal이 role 또는 group 중 하나에 속하면 match다.
- `ALL_OF`는 합계가 1..20이고 모든 role/group membership을 가져야 match다. `NOT`, wildcard, nested rule,
  License query와 cross-tenant group은 Phase 1A에서 금지한다.
- Role은 `^[A-Z][A-Z0-9_.-]{0,63}$`, group ref는 NFC opaque 1..128자이며 control/whitespace를 거부한다.
  배열은 byte sort·unique이고 selector RFC 8785 SHA-256을 immutable Policy Revision에 저장한다.
- Membership SoR은 현재 Tenant로 binding된 Auth authority snapshot이다. Snapshot은 role/group exact set,
  `authorityRevision`, `validUntil`을 가지며 Browser 입력을 받지 않는다. Missing/expired/cross-tenant ref는
  match하지 않고 원장 조회 오류는 전체 evaluation `EVALUATION_ERROR`로 Fail Closed한다.
- `decisionRevision`과 Effective cache key는 selector hash+authority revision/validUntil을 포함한다. Draft
  validation, impact preview, Publish Transaction과 매 Effective 평가가 같은 pure matcher를 사용한다.

Tenant Query/DTO도 `additionalProperties=false`로 고정한다.

- `TenantWidgetCatalogQuery`: `page≥0`, `size=1..100`,
  `sort=definitionKey:asc|updatedAt:desc`, `effectiveState?`, NFC `q?` 최대 100자, opaque `readRevision?`
- `TenantPolicyHistoryQuery`: `page≥0`, `size=1..100`, `sort=revision:desc`, opaque `readRevision?`
- `TenantPolicyRevisionRequest`: 위 필드와 함께 `sharingPolicy=PRIVATE_ONLY|TENANT_REVIEW`,
  `lockedConfiguration`은 Manifest config field key의 정렬·unique 배열 최대 50개다. `selector=CHANNEL`이면
  `channel=STABLE|PREVIEW`만 필수이고 `versionId`는 금지, `PINNED`면 반대다.
- `TenantPolicyRevokeRequest`: `publishedRevisionId`, `publicReasonCode`, `reasonText`, `expectedVersion`
- `TenantPolicyRollbackRequest`: `sourceRevisionId`, `expectedHeadRevisionId`, `reasonCode`, `reasonText`,
  `expectedVersion`. Source snapshot을 복사한 새 Revision만 만들며 과거 row/head를 수정하지 않는다.
- `TenantWidgetPolicyResponse`: `tenantPolicyId`, `definitionId`, `headRevisionId`, `revision`, `state`,
  `enabled`, `selector`, nullable `channel`, nullable `versionId`, `supportedSurfaceKeys`, canonical
  `audienceSelector`, `audienceSelectorHash`, `required`, `lockedConfiguration`, `sharingPolicy`,
  `catalogRevision`, `bindingCatalogRevision`, `safetyRevision`, `version`, `createdAt`, nullable
  `publishedAt`, `allowedTransitions[]`
- `TenantPolicyRevisionResponse`: `tenantPolicyId`, `definitionId`, `revisionId`, nullable
  `predecessorRevisionId`, `revision`, `state=DRAFT|PUBLISHED|SUPERSEDED|REVOKED`, `enabled`, `selector`,
  nullable `channel`, nullable `versionId`, `supportedSurfaceKeys`, canonical `audienceSelector`,
  `audienceSelectorHash`, `required`, `lockedConfiguration`, `sharingPolicy`, `reasonCode`, opaque `createdBy`,
  `createdAt`, `updatedAt`, `version`
- `TenantWidgetCatalogItem`: `definitionId`, `definitionKey`, nullable `resolvedVersionId`, nullable
  `resolvedSemanticVersion`, nullable `policyHeadRevisionId`, nullable `policyRevision`, nullable `policyState`,
  `effectiveState=ALLOW|DENY|ERROR`, `publicReasonCodes[]`, `supportedSurfaceKeys`, nullable `audienceMode`,
  `required`, `lockedConfiguration`, `sharingPolicy`, `updatedAt`
- `TenantWidgetCatalogPage`, `TenantPolicyRevisionPage`: 해당 item `items[]`, `page`, `size`,
  `totalElements`, `hasNext`, opaque `readRevision` exact envelope
- `TenantPolicyImpactResponse`: `definitionId`, `draftRevisionId`, `draftVersion`, catalog/binding/policy/safety/
  authority revision, selector hash, `evaluatedAt`, `validUntil`, 그리고 non-negative aggregate
  `eligibleCount`, `newlyAllowedCount`, `newlyDeniedCount`, `existingInstanceBlockedCount`,
  `unknownAuthorityCount`, deterministic `impactRevision`만 반환한다. Subject ref/name/list와 internal Tenant
  binding은 반환하지 않으며 저장 Snapshot ID도 없다. Schema·Golden·10개 stale/cross-tenant/expiry Negative는
  [`fixtures/widget-tenant-impact.v1.schema.json`](fixtures/widget-tenant-impact.v1.schema.json),
  [`fixtures/widget-tenant-impact.v1.golden.json`](fixtures/widget-tenant-impact.v1.golden.json),
  [`fixtures/widget-tenant-impact.v1.negative.json`](fixtures/widget-tenant-impact.v1.negative.json),
  [`fixtures/verify-tenant-impact-contract.mjs`](fixtures/verify-tenant-impact-contract.mjs)에 고정한다.
- `TenantWidgetExplainResponse`: `definitionId`, nullable `versionId`, `surfaceKey`,
  `placementContexts[]`, `effectiveState=ALLOW|DENY|ERROR`, `internalReasonCodes[]`, `publicReasonCodes[]`,
  `catalogRevision`, `bindingCatalogRevision`, nullable `policyRevision`, `safetyRevision`, `authorityRevision`,
  nullable `audienceSelectorHash`, `evaluatedAt`, `validUntil`. Raw role/group/permission과 다른 Subject 정보는
  금지한다.

Catalog/History pagination은 Provider Page와 같은 read revision 규칙을 쓴다. Impact/Explain은
`Cache-Control: private, no-store`이고 current Tenant predicate, DB clock `validUntil`, Cross-tenant negative
test가 필수다.

첫 page는 같은 read-only snapshot에서 item과 authoritative head를 읽고 head-bound `readRevision`을
반환한다. 다음 page의 supplied head가 current와 다르면 `409 READ_REVISION_CONFLICT`다. Effective read는
Registry/Tenant Policy/Safety 세 head를 읽고 평가한 뒤 세 head를 재확인하며, 두 번 연속 drift면
`503 REVISION_STABILITY_UNAVAILABLE`로 Fail Closed한다. Safety head는 Positive cache lookup 전에 읽어 cache
key에 포함한다. Rollout snapshot은 이 세 head tuple과 predecessor가 evidence window 전체에서 중단·만료·
재활성화 없이 계속 ACTIVE였다는 transition history를 함께 고정한다.

### 6.3 사용자 Effective Catalog

| operationId                 | Method·path                        | Request DTO                   | Success DTO                      |
| --------------------------- | ---------------------------------- | ----------------------------- | -------------------------------- |
| `getEffectiveWidgetCatalog` | `GET /v1/widget-catalog/effective` | `surfaceKey` exact Query only | `EffectiveWidgetCatalogResponse` |

```http
GET /v1/widget-catalog/effective?surfaceKey=workspace-home
Cache-Control: private, no-store
```

```json
{
  "schemaVersion": 1,
  "mode": "SHADOW",
  "catalogRevision": "opaque-revision",
  "bindingCatalogRevision": "lowercase-sha256",
  "policyRevision": "opaque-revision",
  "safetyRevision": "opaque-revision",
  "hostContext": {
    "surfaceKey": "workspace-home",
    "resolvedHostMode": "FLOW",
    "homeExperienceVersion": 17,
    "compositionSchemaVersion": 3,
    "layoutSource": "HOME_VIEW",
    "activeViewRef": "opaque-ref-or-null",
    "layoutRevision": 9,
    "hostConfigurationRevision": "opaque-revision",
    "hostCapabilityVersion": 1,
    "decisionRevision": "opaque-revision"
  },
  "contexts": [
    {
      "placementContext": "FLOW_PERSONAL",
      "capabilities": {
        "libraryRead": true,
        "legacyPlacementWrite": true,
        "instanceV6Write": false,
        "brokerRead": false,
        "presetCreate": false,
        "presetShare": false
      },
      "items": [
        {
          "definitionId": "uuid",
          "definitionKey": "core.calendar.schedule",
          "legacyWidgetKey": "schedule",
          "resolvedVersionId": "uuid",
          "semanticVersion": "1.0.0",
          "effectiveState": "AVAILABLE",
          "reasonCodes": ["AVAILABLE"],
          "placementCapabilities": {
            "canAdd": true,
            "canHide": true,
            "canMove": true,
            "canResize": true
          },
          "addedInstanceCount": 0
        }
      ]
    },
    {
      "placementContext": "FLOW_GOVERNED",
      "capabilities": {
        "libraryRead": false,
        "legacyPlacementWrite": false,
        "instanceV6Write": false,
        "brokerRead": false,
        "presetCreate": false,
        "presetShare": false
      },
      "items": [
        {
          "definitionId": "uuid",
          "definitionKey": "core.workspace.command-rail",
          "legacyWidgetKey": "command-rail",
          "resolvedVersionId": "uuid",
          "semanticVersion": "1.0.0",
          "effectiveState": "ALREADY_ADDED",
          "reasonCodes": ["ALREADY_ADDED"],
          "placementCapabilities": {
            "canAdd": false,
            "canHide": false,
            "canMove": false,
            "canResize": false
          },
          "addedInstanceCount": 1
        }
      ]
    }
  ]
}
```

`EffectiveWidgetCatalogResponse` v1은 위 JSON의 `schemaVersion`, `mode`, 4개
catalog/bindingCatalog/policy/safety
revision, `hostContext`, `contexts[]`만 반환한다. `hostContext`는 표본의 10개
field, context는 `placementContext`, 표본의 6개 Boolean `capabilities`, `items[]`만, item은
표본의 ID/key/version/state/reason/
4개 placement Boolean/instance count만 허용한다. `mode`, `effectiveState`, `reasonCodes`는 이 문서의
폐쇄형 enum이고 unknown field/enum은 OpenAPI·Generated Client Contract Test에서 거부한다.

`contexts[]`는 서버가 정한 순서와 cardinality를 가진다. `resolvedHostMode=CLASSIC`이면
`[CLASSIC_PERSONAL]` exact 1개다. `FLOW`이면 `FLOW_PERSONAL`이 항상 첫 번째이고, 정규화된 Published
governed zone이 있으면 `FLOW_GOVERNED`가 두 번째다. 같은 Definition은 Manifest가 두 Context를 모두
지원하더라도 context별 독립 item/capability로 평가하며 `(placementContext,definitionId)`가 unique다.
Personal Library 항목과 managed `command-rail`을 단일 context로 합치거나 Browser가 Context를 선택할 수 없다.

Browser는 `hostMode`, `placementContext`, 관리형 zone, Host Capability Version과 Home revision을 보내지
않는다. Gateway도 외부의 동명 Header를 제거한다. Platform의 신규 `HomeHostContextResolver`가 다음 서버
소유 원장을 읽어 실제 Host Context를 계산한다.

1. 현재 Tenant `HomeExperience.version`과 정규화된
   `HomeExperience.compositionPolicy.experienceVariant`. 행이 없으면 기존 Service와 동일하게
   `version=0` + `HomeCompositionPolicyRegistry.defaultPolicy()`로 정규화한다.
2. `HomeCompositionPolicyRegistry.effectiveVariant(policy, homeFlowEnabled)`가 산출한 `CLASSIC|FLOW_V1`과
   정규화된 Published governed zone
3. Platform build ID, 서버 `homeFlowEnabled`, rollout/config revision으로 생성한
   `hostConfigurationRevision`
4. `HomeExperienceService.homePreferenceStore(...)`와 동일한 서버 판정이 `VIEWS`면 현재
   Tenant·Subject·Surface의 유일한 `HomeView.isDefault=true` 행, `LEGACY`면 현재
   `HomePreference` 행. 각각의 version은 `layoutRevision`일 뿐 Host Mode 원천이 아니다.
5. 서버가 검증한 Tenant·Subject·App Entitlement·Authority Context

현재 Entity에는 독립 `experienceMode` 컬럼이 없고 `HomeView`에도
`experienceVariant`가 없다. 따라서 Resolver는 위 기존 필드를 읽고 `HomeExperienceService`와 동일한
Registry 정규화/플래그 규칙을 호출해야 하며, 새 저장 필드를 가정하지 않는다.
`VIEWS`에서 default View가 없거나 복수인 경우는 원장 불일치로 거부한다. `LEGACY`에서
Preference 행이 없으면 기존 `HomePreferenceService.defaultResponse(...)`와 동일한 기본 Layout,
`layoutRevision=0`, `activeViewRef=null`을 쓴다. `layoutSource=HOME_VIEW|LEGACY_PREFERENCE`는 서버가
반환하고 Browser가 선택하지 않는다.
`decisionRevision`은 trusted tenant/subject authority fingerprint, canonical surface, 서버가 정렬한
placement context/zone revision 집합, Home Experience version,
layout revision, host configuration revision, 등록 Host Capability Version,
catalog/bindingCatalog/policy/safety revision,
`certificationGateRevision` tuple의 canonical SHA-256이며 `catalogRevision`과 분리한다.
`certificationGateRevision`은 Manifest hash와 정렬된 Evidence/waiver ID·revision·status·expiresAt의
canonical SHA-256이다.

Host Capability Version은 Platform 배포 Manifest의 등록 값이며 외부 요청값이 아니다. 지원하지 않는
`surfaceKey`는 `400 INVALID_INPUT_VALUE`다. Home Experience/Preference 설정 행 부재는 위 version 0 기본값으로
정규화하지만, 필수 Authority/Entitlement 원장 조회 장애, 유효한 Host Configuration Revision 부재,
`VIEWS` default 불변식 위반 또는 Resolver 예외는 `503 WIDGET_HOST_CONTEXT_UNAVAILABLE`로 Fail Closed한다.
Browser가 Query/Header를 조작해도 `FLOW_GOVERNED`를 얻을 수 없다. 향후 Add/Move/Hide/Resize
Mutation은 응답의 `hostContext.decisionRevision`과 대상 `placementContext`를
`expectedHostContextRevision`으로 함께 binding하고, current 서버 Context 집합과 달라지면
`409 DECISION_REVISION_CONFLICT`로 재평가한다. 현재 Backend에 Resolver와 revision 필드가 생기기 전에는
`SHADOW`도 켜지 않는다.

Manifest 지원 여부와 서버 Zone을 교차한 최종 Capability는 다음 규칙을 사용한다.

| Placement context  | Personal Definition                             | `command-rail` Governed Definition                            |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------- |
| `CLASSIC_PERSONAL` | `add/hide/move/resize`를 Manifest 범위에서 허용 | 기존 v5 호환 범위의 `hide/move/resize`; `add=false`           |
| `FLOW_PERSONAL`    | `add/hide/move/resize`를 Manifest 범위에서 허용 | 일반 Library Payload에서 생략                                 |
| `FLOW_GOVERNED`    | 일반 Library Payload에서 생략                   | `add=false, hide=false, move=false, resize=false`인 Host 항목 |

Tenant `required/lockedConfiguration`, Safety와 Lifecycle은 이 표보다 우선한다. 각 Capability는 독립 Boolean
이며 하나가 false라고 다른 행동을 추론하지 않는다. Phase 1A `SHADOW` 응답은 비교·관찰용이고 현재 정적
Layout이나 Renderer의 권한원이 아니다.

## 7. Effective Catalog 판정

평가 순서는 고정한다.

1. Global Kill
2. Definition Retired 또는 Version Quarantined, Revoked
3. `PROVIDER_CERTIFIED` Version의 현재 Risk/Evidence Gate 만료·불일치
4. Manifest 전체가 current Binding Catalog와 불일치
5. Published Channel/Version 해석 실패
6. Published Tenant Policy 부재
7. Tenant Disabled
8. App Entitlement·필수 Authority 부재
9. Audience 불일치
10. Surface·Host 불일치
11. Deprecated
12. Available 또는 Already Added

Unknown·예외·Projection 부재는 `DENY`다. 내부 Reason은 `GLOBAL_DISABLED`,
`DEFINITION_RETIRED`, `VERSION_QUARANTINED`, `VERSION_REVOKED`, `CERTIFICATION_EXPIRED`,
`MANIFEST_BINDING_INVALID`, `VERSION_UNRESOLVED`,
`TENANT_POLICY_MISSING`, `TENANT_DISABLED`, `APP_NOT_ENTITLED`, `PERMISSION_MISSING`,
`AUDIENCE_MISMATCH`, `SURFACE_UNSUPPORTED`, `HOST_INCOMPATIBLE`, `DEPRECATED`, `AVAILABLE`,
`ALREADY_ADDED`, `EVALUATION_ERROR`을 사용한다.

일반 사용자에게 공개할 수 있는 Reason은 `NOT_AVAILABLE`, `DISABLED_BY_ORGANIZATION`,
`APP_ACCESS_REQUIRED`, `INCOMPATIBLE`, `TEMPORARILY_UNAVAILABLE`, `DEPRECATED`, `AVAILABLE`,
`ALREADY_ADDED`뿐이다. 다음 표가 포함·Placeholder·추가 가능성의 전체 계약이며 먼저 일치한 행 하나만
적용한다.

| Internal reason            | 신규 Library 항목  | 기존 Instance 표현                    | 공개 Reason                | `canAdd` | AUTHORITATIVE Legacy 실행 |
| -------------------------- | ------------------ | ------------------------------------- | -------------------------- | -------- | ------------------------- |
| `GLOBAL_DISABLED`          | 생략               | 제목·데이터 없는 일시중단 Placeholder | `TEMPORARILY_UNAVAILABLE`  | `false`  | 차단                      |
| `DEFINITION_RETIRED`       | 생략               | Replacement 또는 제거 Placeholder     | `NOT_AVAILABLE`            | `false`  | 차단                      |
| `VERSION_QUARANTINED`      | 생략               | 제목·데이터 없는 일시중단 Placeholder | `TEMPORARILY_UNAVAILABLE`  | `false`  | 차단                      |
| `VERSION_REVOKED`          | 생략               | Replacement 또는 제거 Placeholder     | `NOT_AVAILABLE`            | `false`  | 차단                      |
| `CERTIFICATION_EXPIRED`    | 생략               | 제목·데이터 없는 일시중단 Placeholder | `TEMPORARILY_UNAVAILABLE`  | `false`  | 차단                      |
| `MANIFEST_BINDING_INVALID` | 생략               | 제목·데이터 없는 정책 Placeholder     | `NOT_AVAILABLE`            | `false`  | 차단                      |
| `VERSION_UNRESOLVED`       | 생략               | 호환 불가 Placeholder                 | `INCOMPATIBLE`             | `false`  | 차단                      |
| `TENANT_POLICY_MISSING`    | 생략               | 조직에서 사용할 수 없음 Placeholder   | `DISABLED_BY_ORGANIZATION` | `false`  | 차단                      |
| `TENANT_DISABLED`          | 생략               | 조직에서 사용할 수 없음 Placeholder   | `DISABLED_BY_ORGANIZATION` | `false`  | 차단                      |
| `APP_NOT_ENTITLED`         | 생략               | App 접근 필요 Placeholder             | `APP_ACCESS_REQUIRED`      | `false`  | 차단                      |
| `PERMISSION_MISSING`       | 생략               | App 접근 필요 Placeholder             | `APP_ACCESS_REQUIRED`      | `false`  | 차단                      |
| `AUDIENCE_MISMATCH`        | 생략               | 제목·Count 없는 일반 Placeholder      | `NOT_AVAILABLE`            | `false`  | 차단                      |
| `SURFACE_UNSUPPORTED`      | 생략               | 호환 불가 Placeholder                 | `INCOMPATIBLE`             | `false`  | 차단                      |
| `HOST_INCOMPATIBLE`        | 생략               | 호환 불가 Placeholder                 | `INCOMPATIBLE`             | `false`  | 차단                      |
| `EVALUATION_ERROR`         | Catalog 전체 `503` | 제목·데이터 없는 일시중단 Placeholder | `TEMPORARILY_UNAVAILABLE`  | `false`  | 차단                      |
| `DEPRECATED`               | 표시               | 정상 실행+교체 안내                   | `DEPRECATED`               | `false`  | 허용                      |
| `ALREADY_ADDED`            | 표시               | 정상 실행                             | `ALREADY_ADDED`            | `false`  | 허용                      |
| `AVAILABLE`                | 표시               | 해당 없음                             | `AVAILABLE`                | `true`   | 허용                      |

Placeholder에는 Definition key, 원천 ID, Audience, 정책 부재 여부와 내부 Incident ref를 넣지 않는다.
`SHADOW`에서는 위 AUTHORITATIVE 열을 계산·비교만 하고 기존 v5 실행·Payload·Layout은 항상
`UNCHANGED_IN_SHADOW`다.

Evidence 판정 Cache entry는 `certificationGateRevision`과 `validUntil=min(가장 이른 필수 Evidence/waiver
expiresAt, db_now+5초)`를 저장한다. 읽을 때마다 DB clock으로 `db_now<validUntil`을 재검증하고 만료 순간부터
stale entry를 절대 사용하지 않는다. Effective API는 `Cache-Control: private, no-store`를 반환하며
AUTHORITATIVE Runtime Guard도 같은 Gate revision/validUntil을 매 Data·Action 요청에서 검사한다. 따라서
Scheduler나 cache invalidation 전파가 늦어도 만료된 Certification이 Allow로 평가되는 구간은 없다.

Catalog는 App Entitlement 수준까지만 판단한다. 행·문서·일정 등 Source ACL은 Runtime Broker가
도입된 뒤 현재 사용자 기준으로 매 요청 다시 검증한다.

## 8. 권한·SoD·Mutation 공통 계약

Provider 권한:

- `WIDGET_CATALOG_READ`
- `WIDGET_DEFINITION_WRITE`
- `WIDGET_DEFINITION_REVIEW`
- `WIDGET_DEFINITION_RELEASE`
- `WIDGET_DEFINITION_REVOKE`
- `WIDGET_EVIDENCE_WAIVE`

기본 역할은 한 사람이 모든 고위험 권한을 갖지 않도록 분리한다.

- `PROVIDER_WIDGET_AUTHOR`: READ+WRITE
- `PROVIDER_WIDGET_REVIEWER`: READ+REVIEW
- `PROVIDER_WIDGET_RELEASE_MANAGER`: READ+RELEASE
- `PROVIDER_WIDGET_SECURITY_RESPONDER`: READ+REVOKE
- `PROVIDER_WIDGET_EVIDENCE_OFFICER`: READ+WAIVE
- `PROVIDER_WIDGET_AUDITOR`: READ

기존 광범위 `PROVIDER_ADMIN`에 WRITE·REVIEW·RELEASE·REVOKE를 자동 합성하지 않는다. Break-glass는 별도
시간 제한 Assignment·Incident·사후 Review를 요구한다.

Tenant 권한:

- `ADMIN.HOME_WIDGET_POLICY:VIEW | MANAGE | PUBLISH | EXPLAIN | AUDIT`

강제 규칙:

- Definition 작성자와 승인자를 분리한다.
- 고위험 Version 승인자와 게시자를 분리한다.
- 긴급 Quarantine는 지정 보안 담당자가 즉시 실행할 수 있으나 해제는 독립 승인이 필요하다.
- Provider와 Platform 양쪽에서 현재 상태와 SoD를 재검증한다.
- 아래 exact Path Template와 HTTP Method를 각각 명시적으로 Security Matcher에 등록한다.
- Browser Header를 Operator 신원으로 전달하지 않고 Provider가 검증된 Actor Context를 재구성한다.

Provider 공개 Route의 최소 권한과 SoD는 다음과 같다. Path suffix 또는 Prefix 추론으로 권한을 결정하지
않는다. 알 수 없는 Path/Template은 `404`, 등록된 Path의 알 수 없는 Method는 `405`, 등록된
Method+Template의 권한 부재는 `403`이며 어느 경우도 Generic Provider matcher로 fallback하지 않는다.

| Method | Exact public path template                                                     | 필요 권한                   | 추가 SoD·artifact                                      |
| ------ | ------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------ |
| `GET`  | `/v1/admin/widget-definitions`                                                 | `WIDGET_CATALOG_READ`       | —                                                      |
| `GET`  | `/v1/admin/widget-definitions/{definitionId}`                                  | `WIDGET_CATALOG_READ`       | —                                                      |
| `GET`  | `/v1/admin/widget-definitions/{definitionId}/versions`                         | `WIDGET_CATALOG_READ`       | —                                                      |
| `GET`  | `/v1/admin/widget-definitions/{definitionId}/retirement-impact`                | `WIDGET_DEFINITION_RELEASE` | aggregate-only preflight, impactRevision 생성          |
| `POST` | `/v1/admin/widget-definitions`                                                 | `WIDGET_DEFINITION_WRITE`   | owner app 범위                                         |
| `POST` | `/v1/admin/widget-definitions/{definitionId}/versions`                         | `WIDGET_DEFINITION_WRITE`   | owner app 범위                                         |
| `GET`  | `/v1/admin/widget-definition-versions/{versionId}`                             | `WIDGET_CATALOG_READ`       | —                                                      |
| `PUT`  | `/v1/admin/widget-definition-versions/{versionId}`                             | `WIDGET_DEFINITION_WRITE`   | DRAFT만, owner app 범위                                |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/validate`                    | `WIDGET_DEFINITION_WRITE`   | immutable validation run 생성                          |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/submit`                      | `WIDGET_DEFINITION_WRITE`   | author context 기록                                    |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/decision`                    | `WIDGET_DEFINITION_REVIEW`  | reviewer ≠ author                                      |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/rework`                      | `WIDGET_DEFINITION_WRITE`   | REJECTED head Decision 일치, owner app 범위            |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/evidence`                    | `WIDGET_DEFINITION_REVIEW`  | evidence actor·hash 고정                               |
| `GET`  | `/v1/admin/widget-definition-versions/{versionId}/evidence`                    | `WIDGET_CATALOG_READ`       | closed page/readRevision                               |
| `GET`  | `/v1/admin/widget-definition-versions/{versionId}/evidence/{evidenceId}`       | `WIDGET_CATALOG_READ`       | path version/evidence binding                          |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/evidence/{evidenceId}/waive` | `WIDGET_EVIDENCE_WAIVE`     | LOW/MEDIUM Performance/Localization만, 독립 actor      |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/publish`                     | `WIDGET_DEFINITION_RELEASE` | high-risk publisher ≠ approver, Risk/Evidence Gate     |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/deprecate`                   | `WIDGET_DEFINITION_RELEASE` | replacement/expiry 검증                                |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/quarantine`                  | `WIDGET_DEFINITION_REVOKE`  | 지정 security operator, 즉시 실행                      |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/clear-quarantine-approvals`  | `WIDGET_DEFINITION_REVIEW`  | current quarantineEventId 결속, approver ≠ quarantiner |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/clear-quarantine`            | `WIDGET_DEFINITION_RELEASE` | current 사건의 ACTIVE approval single-use consume      |
| `POST` | `/v1/admin/widget-definition-versions/{versionId}/revoke`                      | `WIDGET_DEFINITION_REVOKE`  | 지정 security operator, 불가역                         |
| `POST` | `/v1/admin/widget-definitions/{definitionId}/retire`                           | `WIDGET_DEFINITION_RELEASE` | active channel 없음·replacement 검증                   |
| `GET`  | `/v1/admin/widget-definitions/{definitionId}/channels/{channel}`               | `WIDGET_CATALOG_READ`       | current/previous head와 optimistic version producer    |
| `POST` | `/v1/admin/widget-definitions/{definitionId}/channels/{channel}/promote`       | `WIDGET_DEFINITION_RELEASE` | target Approved+Published+CLEAR+현재 Evidence Gate     |
| `POST` | `/v1/admin/widget-definitions/{definitionId}/channels/{channel}/rollback`      | `WIDGET_DEFINITION_RELEASE` | previous Approved+Published+CLEAR+현재 Gate, 새 event  |
| `GET`  | `/v1/admin/widget-runtime-controls`                                            | `WIDGET_CATALOG_READ`       | —                                                      |
| `POST` | `/v1/admin/widget-runtime-controls/disable`                                    | `WIDGET_DEFINITION_REVOKE`  | 지정 security operator, 즉시 차단                      |
| `POST` | `/v1/admin/widget-runtime-controls/{controlId}/enable-approvals`               | `WIDGET_DEFINITION_REVIEW`  | current DISABLED head revision 결속, 30분 approval     |
| `POST` | `/v1/admin/widget-runtime-controls/{controlId}/enable`                         | `WIDGET_DEFINITION_RELEASE` | current head exact match, ACTIVE approval single-use   |

Tenant Route는 Generic `ADMIN` Role fallback보다 먼저 exact matcher가 평가되어야 한다.

| Method | Exact Tenant path template                                                | 필요 authority                         |
| ------ | ------------------------------------------------------------------------- | -------------------------------------- |
| `GET`  | `/v1/admin/widget-catalog`                                                | `ADMIN.HOME_WIDGET_POLICY:VIEW`        |
| `GET`  | `/v1/admin/widget-policies/{definitionId}`                                | `ADMIN.HOME_WIDGET_POLICY:VIEW`        |
| `POST` | `/v1/admin/widget-policies/{definitionId}/revisions`                      | `ADMIN.HOME_WIDGET_POLICY:MANAGE`      |
| `PUT`  | `/v1/admin/widget-policies/{definitionId}/revisions/{revisionId}`         | `ADMIN.HOME_WIDGET_POLICY:MANAGE`      |
| `GET`  | `/v1/admin/widget-policies/{definitionId}/revisions/{revisionId}/impact`  | `ADMIN.HOME_WIDGET_POLICY:EXPLAIN`     |
| `POST` | `/v1/admin/widget-policies/{definitionId}/revisions/{revisionId}/publish` | `ADMIN.HOME_WIDGET_POLICY:PUBLISH`     |
| `POST` | `/v1/admin/widget-policies/{definitionId}/revoke`                         | `ADMIN.HOME_WIDGET_POLICY:PUBLISH`     |
| `POST` | `/v1/admin/widget-policies/{definitionId}/rollback`                       | `ADMIN.HOME_WIDGET_POLICY:PUBLISH`     |
| `GET`  | `/v1/admin/widget-policies/{definitionId}/history`                        | `ADMIN.HOME_WIDGET_POLICY:AUDIT`       |
| `GET`  | `/v1/admin/widget-catalog/{definitionId}/explain`                         | `ADMIN.HOME_WIDGET_POLICY:EXPLAIN`     |
| `GET`  | `/v1/widget-catalog/effective`                                            | 현재 Tenant에 binding된 인증 Principal |

각 `GET` Template의 `HEAD`는 동일 authority로 명시 등록한다. 표에 없는 Method는 Generic Admin/Provider
fallback으로 넘기지 않고 `405 Method Not Allowed`, 등록되지 않은 Path는 `404`로 닫는다. CORS `OPTIONS`는
Gateway의 고정 allowlist에서만 처리하고 Application 권한 판정으로 전달하지 않는다.

Platform Internal API는 Registry Catalog/Evidence/Impact/Channel 아홉 개와 Completion 하나, 총 열 개의 조회
route와 Registry 실행 및
미실행 seal 두 개의 command route만 둔다. Catalog 목록은 위의
같은 폐쇄형 Query와 서버 고정 최대 page size를 사용하고, ID로 건너뛰기나 자유형 filter를
허용하지 않는다.

Effective route에는 단일 App authority를 요구하지 않는다. Route는 current-tenant authenticated Principal만
허용하고, App별 Entitlement/required Authority는 Evaluator가 item마다 검사해 미충족 Definition을 Payload에서
제거한다. 한 App 권한으로 다른 App item을 열거나 route-level 공통 App 권한을 추론하지 않는다.

| operationId                                    | Method | Exact internal path                                                                       | Query/request                           | Success DTO                                       | Bearer service-token contract                                                                 |
| ---------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `listWidgetRegistryDefinitionsInternal`        | `GET`  | `/internal/provider/v1/widget-registry/definitions`                                       | `WidgetDefinitionListQuery`             | `WidgetDefinitionPage`                            | `aud=dwp-platform-widget-registry`, `azp=dwp-provider-server`, `scope=widget-registry.read`   |
| `getWidgetRegistryDefinitionInternal`          | `GET`  | `/internal/provider/v1/widget-registry/definitions/{definitionId}`                        | —                                       | `WidgetDefinitionResponse`                        | 같은 `aud/azp`, `scope=widget-registry.read`                                                  |
| `listWidgetRegistryDefinitionVersionsInternal` | `GET`  | `/internal/provider/v1/widget-registry/definitions/{definitionId}/versions`               | `WidgetVersionListQuery`                | `WidgetVersionPage`                               | 같은 `aud/azp`, `scope=widget-registry.read`                                                  |
| `getWidgetRegistryVersionInternal`             | `GET`  | `/internal/provider/v1/widget-registry/versions/{versionId}`                              | —                                       | `WidgetVersionResponse`                           | 같은 `aud/azp`, `scope=widget-registry.read`                                                  |
| `getWidgetRegistryRetirementImpactInternal`    | `GET`  | `/internal/provider/v1/widget-registry/definitions/{definitionId}/retirement-impact`      | `WidgetDefinitionRetirementImpactQuery` | `WidgetDefinitionRetirementImpactResponse`        | 같은 `aud/azp`, `scope=widget-registry.read`; signed `WIDGET_DEFINITION_RELEASE`              |
| `getWidgetRegistryReleaseChannelInternal`      | `GET`  | `/internal/provider/v1/widget-registry/definitions/{definitionId}/channels/{channel}`     | —                                       | `WidgetReleaseChannelResponse`                    | 같은 `aud/azp`, `scope=widget-registry.read`; signed `WIDGET_CATALOG_READ`, path channel 결속 |
| `listWidgetRegistryEvidenceInternal`           | `GET`  | `/internal/provider/v1/widget-registry/versions/{versionId}/evidence`                     | `WidgetEvidenceListQuery`               | `WidgetEvidencePage`                              | 같은 `aud/azp`, `scope=widget-registry.read`; signed `WIDGET_CATALOG_READ`                    |
| `getWidgetRegistryEvidenceInternal`            | `GET`  | `/internal/provider/v1/widget-registry/versions/{versionId}/evidence/{evidenceId}`        | —                                       | `WidgetEvidenceResponse`                          | 같은 `aud/azp`, `scope=widget-registry.read`; signed `WIDGET_CATALOG_READ`, path ID 결속      |
| `listWidgetRegistryRuntimeControlsInternal`    | `GET`  | `/internal/provider/v1/widget-registry/runtime-controls`                                  | `WidgetRuntimeControlListQuery`         | `WidgetRuntimeControlPage`                        | 같은 `aud/azp`, `scope=widget-registry.read`                                                  |
| `getWidgetRegistryCommandCompletionInternal`   | `GET`  | `/internal/provider/v1/widget-registry/command-completions/{commandId}`                   | signed binding claims                   | `WidgetCommandCompletionResponse`                 | 같은 `aud/azp`, `scope=widget-registry.reconcile`                                             |
| `sealWidgetRegistryCommandNotExecutedInternal` | `POST` | `/internal/provider/v1/widget-registry/command-completions/{commandId}/seal-not-executed` | `WidgetCommandNotExecutedSealRequest`   | `WidgetCommandCompletionResponse` `200`           | 같은 `aud/azp`, `scope=widget-registry.reconcile`; Target Service 호출 금지                   |
| `executeWidgetRegistryCommandInternal`         | `POST` | `/internal/provider/v1/widget-registry/commands`                                          | `WidgetRegistryCommandRequest`          | operationId의 public Success DTO·동일 HTTP status | 같은 `aud/azp`, command별 exact scope, signed operator+SoD evidence, closed command allowlist |

| Internal command type                                                                                 | 필요 service scope        | 재검증할 Provider permission |
| ----------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------- |
| `CREATE_DEFINITION`, `CREATE_VERSION`, `UPDATE_VERSION`, `VALIDATE`, `SUBMIT`, `REWORK`               | `widget-registry.write`   | `WIDGET_DEFINITION_WRITE`    |
| `DECIDE`, `RECORD_EVIDENCE`, `APPROVE_QUARANTINE_CLEARANCE`, `APPROVE_RUNTIME_CONTROL_ENABLE`         | `widget-registry.review`  | `WIDGET_DEFINITION_REVIEW`   |
| `WAIVE_EVIDENCE`                                                                                      | `widget-registry.waive`   | `WIDGET_EVIDENCE_WAIVE`      |
| `PUBLISH`, `DEPRECATE`, `RETIRE`, `PROMOTE`, `ROLLBACK`, `CLEAR_QUARANTINE`, `ENABLE_RUNTIME_CONTROL` | `widget-registry.release` | `WIDGET_DEFINITION_RELEASE`  |
| `QUARANTINE`, `REVOKE`, `DISABLE_RUNTIME_CONTROL`                                                     | `widget-registry.safety`  | `WIDGET_DEFINITION_REVOKE`   |

Internal `WidgetRegistryCommandRequest`는 `commandId`, public `operationId`, target IDs, typed command payload,
public idempotency key/fingerprint, expected version, correlation ID, Provider operator opaque ref, auth session
opaque ref, verified Provider permission set hash와 SoD artifact IDs만 허용한다. Browser Header 원문, raw role
문자열과 Tenant/User ID를 전달하지 않는다. Platform은 `operationId → required internal command scope →
required Provider permission → current target actor history`를 자체 allowlist로 다시 검증한다.

Internal command envelope v1은 `schemaVersion=1`, UUID `commandId`, 위 공개 `operationId`, 위 표의
closed `commandType`, closed `target={targetType,targetId,definitionId?,versionId?,evidenceId?,controlId?,
channel?,controlScope?,runtimeTargetType?,runtimeTargetId?}`, `payload` oneOf(해당 공개 Request DTO), UUID
`publicIdempotencyKey`, lowercase SHA-256 `publicRequestFingerprint`, `expectedVersion`, UUID
`correlationId`, opaque `operatorRef`, opaque `sessionRef`, lowercase SHA-256 `permissionSetHash`,
`sodArtifactIds[]`만 허용한다. commandType별 target 필수/금지 field는 JSON Schema `oneOf` 분기로
고정하고 unknown/multiple branch를 거부한다. `permissionSetHash`는 멱등성 증거일 뿐 실제 권한은
JWS의 signed `permissionCodes[]`로 다시 검증한다.

`operationId↔commandType↔target`은 아래 분기 외 조합이 없다. `targetId`는 Receipt/Gate target과 exact
일치하며, 괄호 안 field만 target Object에 존재해야 한다.

| public operationId·commandType                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | targetType·targetId                                                                                             | target의 추가 field·결속                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `createWidgetDefinition` · `CREATE_DEFINITION`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `DEFINITION_KEY_HASH` · `sha256(canonical definitionKey)`                                                       | 없음; body definitionKey와 재계산                                                                   |
| `createWidgetDefinitionVersion` · `CREATE_VERSION`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `DEFINITION_SEMVER_HASH` · `sha256(definitionId+"\n"+normalizedSemVer)`                                         | `definitionId`; path+body에서 재계산                                                                |
| `updateWidgetDefinitionVersion` · `UPDATE_VERSION`, `validateWidgetDefinitionVersion` · `VALIDATE`, `submitWidgetDefinitionVersion` · `SUBMIT`, `decideWidgetDefinitionVersion` · `DECIDE`, `reworkWidgetDefinitionVersion` · `REWORK`, `recordWidgetCertificationEvidence` · `RECORD_EVIDENCE`, `publishWidgetDefinitionVersion` · `PUBLISH`, `deprecateWidgetDefinitionVersion` · `DEPRECATE`, `quarantineWidgetDefinitionVersion` · `QUARANTINE`, `approveWidgetQuarantineClearance` · `APPROVE_QUARANTINE_CLEARANCE`, `clearWidgetVersionQuarantine` · `CLEAR_QUARANTINE`, `revokeWidgetDefinitionVersion` · `REVOKE` | `VERSION` · lowercase Version UUID                                                                              | `versionId`; path UUID와 `targetId`가 같음                                                          |
| `waiveWidgetCertificationEvidence` · `WAIVE_EVIDENCE`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `EVIDENCE` · lowercase Evidence UUID                                                                            | `versionId,evidenceId`; `evidenceId=targetId`, 두 path UUID 모두 결속                               |
| `retireWidgetDefinition` · `RETIRE`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `DEFINITION` · lowercase Definition UUID                                                                        | `definitionId`; path UUID와 `targetId`가 같음                                                       |
| `promoteWidgetReleaseChannel` · `PROMOTE`, `rollbackWidgetReleaseChannel` · `ROLLBACK`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `DEFINITION_CHANNEL_HASH` · `sha256(definitionId+"\n"+channel)`                                                 | `definitionId,channel`; exact path의 `STABLE                                                        | PREVIEW` 결속 |
| `disableWidgetRuntimeControl` · `DISABLE_RUNTIME_CONTROL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `RUNTIME_CONTROL_SCOPE_HASH` · `sha256(controlScope+"\n"+runtimeTargetType+"\n"+(runtimeTargetId ?? "GLOBAL"))` | `controlScope,runtimeTargetType,runtimeTargetId`; body의 scope/target과 같고 GLOBAL일 때만 nullable |
| `approveWidgetRuntimeControlEnable` · `APPROVE_RUNTIME_CONTROL_ENABLE`, `enableWidgetRuntimeControl` · `ENABLE_RUNTIME_CONTROL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `RUNTIME_CONTROL` · lowercase Control UUID                                                                      | `controlId`; path UUID와 `targetId`가 같음                                                          |

각 branch의 payload는 표의 public Request DTO 하나와 exact 대응하고 path field를 payload에 중복하지 않는다.
Envelope `expectedVersion`은 payload의 같은 값과 일치해야 한다. Platform은 assertion의 operation/command/target,
normalized actual path, payload hash, Receipt target을 모두 재계산하며 하나라도 다르면 Receipt 생성 전에
`400 INVALID_INPUT_VALUE`, 이미 사용한 key와 binding이 다르면 `409 COMMAND_BINDING_MISMATCH`로 닫는다.
추가로 Envelope `operatorRef/sessionRef/sodArtifactIds[]`와 signed
`actorRef/sessionRef/sodArtifactIds[]`는 byte-equivalent해야 한다. `permissionSetHash`는
`{schemaVersion:1,permissionCodes:[ASCII sort unique],ownerProductKeys:[ASCII sort unique],
providerAuthorityRevision}`의 RFC 8785 bytes SHA-256로 Platform이 재계산하고 Envelope 값과 비교한다.
`reasonDigest`도 branch payload의 exact `reasonCode/reasonText` canonical pair에서 재계산한다. Duplicate/unsorted
permission·owner·SoD ID, signed claim과 envelope mismatch, stale authority revision은 Receipt 생성 전
`400 COMMAND_BINDING_INVALID` 또는 `403 COMMAND_AUTHORITY_STALE`로 거부한다.
21개 branch의 실행 가능한 envelope 계약은
[`fixtures/widget-registry-command.v1.schema.json`](fixtures/widget-registry-command.v1.schema.json),
[`fixtures/widget-registry-command.v1.golden.json`](fixtures/widget-registry-command.v1.golden.json),
[`fixtures/widget-registry-command.v1.negative.json`](fixtures/widget-registry-command.v1.negative.json),
[`fixtures/verify-registry-command-contract.mjs`](fixtures/verify-registry-command-contract.mjs)에 고정한다.

`WidgetRuntimeControlResponse`는 `controlId`, `scope`, `targetType`, nullable `targetId`, `state`, `revision`,
nullable `expiresAt`, `publicReasonCode`, `createdAt`, opaque `createdBy`, `safetyRevision`만 반환한다. `ETag`은
다른 Detail/Mutation과 동일하게 HTTP Header에만 존재한다.
Enable approval Response는 위 `WidgetRuntimeEnableApprovalResponse`와 동일하게 `approvalId`, `controlId`,
`controlRevision`, `state`, `evidenceRefHashes[]`, `expiresAt`, nullable `consumedAt`, opaque `approvedBy`,
`version`, `createdAt`만 반환하고 내부 Incident 본문을 노출하지 않는다.

`WidgetCommandCompletionResponse`는 closed exact field `schemaVersion=1`, `commandId`, `operationId`,
`commandType`, `target={targetType,targetId}`, `outcome=SUCCEEDED|REJECTED|NOT_EXECUTED`,
`responseStatus`, `responseBody`, nullable `responseEtag`, `responseHash`, `completedAt`만 반환한다.
`responseStatus`는 100..599 integer, `responseBody`는 operationId별 public Success DTO 또는 closed public Error
DTO의 `oneOf`이고 `NOT_EXECUTED`는 exact `503 COMMAND_NOT_EXECUTED` Error DTO다. `responseHash`는
`{status:responseStatus,body:responseBody,etag:responseEtag}` RFC 8785 bytes의 SHA-256이며 두 plane이 같은
serializer/vector로 검증한다. Path commandId와 signed public fingerprint·actor ref hash·
operationId·target binding이 durable ledger와 모두 같아야 하며 Platform Receipt가 아직 `IN_PROGRESS`면
`409 COMMAND_IN_PROGRESS`, Gate/Ledger/Receipt가 모두 없으면 `404 COMMAND_COMPLETION_NOT_FOUND`, binding이
다르면 `409 COMMAND_BINDING_MISMATCH`다. Receipt TTL 이후에도 일치하는 `SEALED` Gate+Ledger만 있으면
Ledger의 저장 응답을 정상 `200` envelope로 반환한다. `SEALED` Gate와 Ledger 중 하나만 있거나 값이
다른 경우, `COMPLETED` Receipt가 있는데 Gate/Ledger가 없거나 hash/status가 다른 경우, `OPEN` Gate와
Receipt의 상태가 맞지 않는 경우는 `503 COMMAND_COMPLETION_INTEGRITY_FAILURE`를 반환하고 page한다. 이
Handler는 read-only Transaction만 열고 Target Service를 호출하지 않는다.

Completion의 operation별 성공 DTO·status·ETag·target/payload/postcondition 결속과 terminal outcome은
[`fixtures/widget-command-completion.v1.schema.json`](fixtures/widget-command-completion.v1.schema.json),
[`fixtures/widget-command-completion.v1.golden.json`](fixtures/widget-command-completion.v1.golden.json),
[`fixtures/widget-command-completion.v1.negative.json`](fixtures/widget-command-completion.v1.negative.json),
[`fixtures/verify-command-completion-contract.mjs`](fixtures/verify-command-completion-contract.mjs)에 고정한다.
특히 `CLEAR_QUARANTINE` Completion은 durable request의 `clearanceApprovalId/quarantineEventId`를 잠긴
Version의 current active quarantine event와 그 사건에 종속된 child Approval의
`versionId/quarantineRevision`에 exact 결속한다. `ENABLE_RUNTIME_CONTROL`도 durable request의
`enableApprovalId/controlRevision`을 잠긴 Control head의 exact scope/target/revision과 child Approval에
결속한다. 두 실행 모두 Completion 시점에 Approval이 `ACTIVE`·미사용·미만료였음을 검증하며, 같은
Transaction에서 동일 child Approval의 post-mutation projection을 `CONSUMED`,
`consumedAt=completedAt`, `consumedByCommandId=response.commandId`로 고정한다.

`WidgetCommandNotExecutedSealRequest`는 `schemaVersion=1`, commandId, operationId, target type/id,
public request fingerprint, actor ref hash, original service-token hash/JTI/exp, original Widget assertion
hash/JTI/exp, Provider Receipt createdAt과
`originalArtifacts={serviceTokenCompact,widgetAssertionCompact}`만 허용한다. Compact JWS/JWT는 각각
ASCII 1..8192/1..16384 byte, 전체 body는 32KiB 이하이며 TLS 내부 채널과 request body redaction을
강제한다. 새 Reconcile assertion은 originalArtifacts까지 포함한 RFC 8785 body digest와
`purpose=SEAL_NOT_EXECUTED`를 binding한다. Platform은 current reconcile service token/assertion과 함께
Provider KMS secret row에서 복호화해 제출한 original compact token/assertion의
signature·hash·JTI·serviceTokenJti·command
binding을 역사 증거로 검증한다. 원 assertion `exp+30초>=db_now`면 `409 COMMAND_SEAL_TOO_EARLY`, Gate가
이미 완료됐으면 저장 결과 `200`, Gate lock 뒤 변경이 전혀 없을 때만 terminal
`NOT_EXECUTED/503 COMMAND_NOT_EXECUTED` Ledger를 만들고 그 결과를 `200` response envelope로 반환한다.
Seal 요청 자체에는 별도 Public Idempotency key가 없고 permanent commandId Gate가 유일한 Idempotency
key다.

Platform은 originalArtifacts 원문을 Receipt, Gate, Ledger, Audit, Event, Outbox, exception과 access log에
저장하지 않고 검증 후 메모리 참조를 폐기하며 hash/JTI/exp만 보존한다. Provider도 current Reconcile
assertion의 body digest가 decrypt한 exact bytes와 일치하지 않으면 요청을 보내지 않는다.

모든 Internal route는 `Authorization: Bearer <service-token>`과 request-bound assertion을 둘 다 요구한다.
Catalog/Command는 `X-DWP-Widget-Assertion`, Completion read는
`X-DWP-Widget-Reconcile-Assertion` compact JWS를 사용한다. 두 증명의 issuer·key·claim 소유를 다음처럼
분리한다.

Service token은 내부 Identity Authority가 발급한다.

- `alg=ES256`, `kid`는 Platform이 pin한 Identity JWKS에서 해결한다.
- 필수 claim은 `iss=dwp-internal-identity`, `sub=dwp-provider-server`,
  `azp=dwp-provider-server`, `aud=dwp-platform-widget-registry`, exact `scope`, `iat`, `nbf`, `exp`,
  `jti`다. TTL은 최대 5분, clock skew는 ±30초다.
- 위 Internal route table의 `aud/azp/scope`는 오직 이 service token claim을 뜻한다. GET은
  Catalog `widget-registry.read`, Completion `widget-registry.reconcile`, POST는 command table의 exact
  scope를 요구한다.

Widget assertion은 Provider Server 서명 key로 요청마다 생성한다.

- `alg=ES256`, `kid`는 별도로 pin한 Provider assertion JWKS에서 해결한다. `none`,
  대칭키 fallback, unknown key, 유효한 cached key가 없는 JWKS 장애는 fail closed다.
- 필수 claim은 `iss=dwp-provider-server`, `sub=dwp-provider-server`,
  `aud=dwp-platform-widget-registry`, `iat`, `nbf`, `exp`, `jti`, `serviceTokenJti`다. TTL은 최대
  60초, clock skew는 ±30초고 `(iss,sub,jti)` replay key를 최초 수락 시점부터 5분간
  저장한다. `serviceTokenJti`는 같은 요청의 검증된 Bearer `jti`와 완전 일치해야 한다.
  Replay Store 장애도 fail closed고, 이 계약의 nonce는 별도 claim이 아닌 assertion `jti`다.
- 메시지 claim은 exact HTTP method, matched path template, ID가 포함된 normalized actual path,
  수신한 RFC 3986 origin-form request-target(`path?rawQuery`) byte의 lowercase SHA-256, RFC 8785
  canonical request body의 lowercase SHA-256, public `Idempotency-Key`, `X-Correlation-ID`를 binding한다.
  Query는 위 폐쇄형 DTO key만 허용하고 invalid percent encoding, unknown/duplicate singleton key를 먼저
  거부한다. GET은 empty-body digest와 `Idempotency-Key=null`을 쓴다. 서명과 실제 request의
  하나라도 다르면 거부한다.
- Provider가 서명하는 operator claim은 opaque `actorRef`, opaque `sessionRef`, 정렬된 exact
  `permissionCodes[]`, 정렬된 `ownerProductKeys[]`, `providerAuthorityRevision`, `authenticatedAt`만
  포함한다. command claim은 public `operationId`, closed `commandType`, target IDs,
  `expectedVersion`, canonical reason digest, immutable `sodArtifactIds[]`를 추가한다.
- Platform은 Definition/Version/Evidence/Runtime Control 일곱 GET에서
  `service scope=widget-registry.read` + signed `WIDGET_CATALOG_READ`, retirement-impact GET에서는 같은
  service scope + signed `WIDGET_DEFINITION_RELEASE`를 재검증한다. Query/path/version/evidence ID와 assertion
  request-target binding도 exact 비교한다. Completion GET은 아래 reconcile trust만 쓴다. Command는 위 allowlist의 exact service scope·permission·owner
  product scope와 Platform이 저장한 author/reviewer/publisher/quarantiner/disabler history로 SoD를
  독립 재검증한다. Assertion hash나 permission set hash만으로 허용을 추론하지 않는다.
- Reconcile assertion은 같은 Provider assertion key/JWKS, `iss/sub/aud/iat/nbf/exp/jti/serviceTokenJti`,
  method/path/request-target binding을 쓰되 operator permission 대신 `commandId`, lowercase public request
  fingerprint, actorRef의 lowercase SHA-256, operationId, target type/id와
  `purpose=READ_COMPLETION|SEAL_NOT_EXECUTED`를 exact claim으로 요구한다. Seal은 추가로 exact request body와
  original artifact hash/JTI/exp를 binding한다. TTL≤60초,
  replay 5분, service token scope `widget-registry.reconcile`이고 ledger binding이 모두 일치한 완료 응답만
  반환한다. 원 operator session/permission의 현재 유효성은 요구하지 않으며 이 예외는 완료 결과 복구에만
  적용한다. Ledger 부재·IN_PROGRESS에서 원 Registry Command 실행으로 fallback하지 않는다.
- 두 증명 중 하나라도 서명·claim·시간·request binding에 실패하면 거부한다. Token/assertion
  전체, permission/owner list, actor/session ref, SoD artifact 내용은 Log·Metric·Outbox에 쓰지 않고
  correlation ID와 검증 result code만 남긴다. 요청은 TLS 보호 내부 채널로만 허용한다.

Identity service-token key와 Provider assertion key의 lifecycle은 `ACTIVE_SIGNING → VERIFY_ONLY → RETIRED`다.
원 Command를 최초 수락할 때 사용한 두 `kid`와 검증 공개키 fingerprint를 immutable dispatch attempt에
기록한다. `VERIFY_ONLY` key는 새 서명에 쓰지 않지만 durable pinned key history에 남겨 terminal seal이
original token/assertion을 다시 검증할 수 있게 한다. key retirement/delete는 해당 `kid`를 참조하는
`OPEN` Gate 또는 unsealed dispatch attempt count가 `0`이고 `db_now > max(original exp)+30초`인 두 조건을
모두 만족할 때만 허용한다. 최대 unresolved age를 초과한 attempt가 하나라도 있으면 key를 지우는 대신
page하고 Gate/Ledger reconcile을 완료한다. 일일 auditor는 issuer·kid별 unsealed count/oldest age와 durable
key 존재를 대조하고, 분기 rotation drill은 old key를 `VERIFY_ONLY`로 바꾼 뒤 JWKS 원본 장애 상태에서도
Completion read와 seal-not-executed가 성공하며 새 Command는 new `ACTIVE_SIGNING` key만 쓰는지 검증한다.

현재 `PlatformSecurityFilter`는 `/internal/provider/**` 전체를 skip하고
`ProviderProvisioningSecurityFilter`는 같은 Prefix 전체를 범용 Provisioning token으로 인증한다. 구현 시
전용 `WidgetRegistryInternalSecurityFilter`를 더 높은 우선순위에 두는 것만으로 끝내지 않고,
`ProviderProvisioningSecurityFilter.shouldNotFilter`에서 exact `/internal/provider/v1/widget-registry/**`를
명시 제외한다. 범용 `X-DWP-Provisioning-Token`은 Widget route에서 항상 거부하고 위 Bearer의
`aud/azp/scope/expiry`와 assertion의 `aud/expiry/jti/serviceTokenJti`를 각각 검증한다. 이 Route는 Gateway allowlist와 외부 OpenAPI에
없어야 한다.

모든 Mutation은 UUID `Idempotency-Key`, expected version, 필수 reason, correlation ID를 요구한다.

| HTTP | 공통 Code                                             | 의미                                         |
| ---- | ----------------------------------------------------- | -------------------------------------------- |
| 400  | `INVALID_INPUT_VALUE`                                 | Manifest·Config·Transition 입력 오류         |
| 413  | `PAYLOAD_TOO_LARGE`                                   | 압축 해제 Request 64KiB 초과                 |
| 403  | `FORBIDDEN`, `SOD_CONFLICT`, `WIDGET_ACTION_DISABLED` | 권한·분리 승인·Runtime Action 차단           |
| 404  | `NOT_FOUND`                                           | 노출 가능한 대상 없음                        |
| 409  | `OBJECT_VERSION_CONFLICT`                             | Optimistic Lock 충돌                         |
| 409  | `DECISION_REVISION_CONFLICT`                          | Host/Policy/Safety 판정 Revision 변경        |
| 409  | `READ_REVISION_CONFLICT`                              | 다중 page 조회 중 Registry Revision 변경     |
| 409  | `MANIFEST_BINDING_REVISION_CHANGED`                   | Validation 이후 Binding Revision 변경        |
| 409  | `INVALID_CATALOG_MODE_COMBINATION`                    | Tenant mode·server flag·approval 조합 오류   |
| 409  | `IDEMPOTENCY_KEY_REUSED`                              | 같은 Key의 다른 request fingerprint          |
| 409  | `COMMAND_IN_PROGRESS`                                 | 같은 명령 처리 중, `Retry-After` 포함        |
| 409  | `RESOURCE_CONFLICT`                                   | 현재 상태에서 허용되지 않는 전이             |
| 409  | `COMMAND_BINDING_MISMATCH`                            | commandId와 영구 binding 불일치              |
| 409  | `COMMAND_SEAL_TOO_EARLY`                              | 원 assertion 안전 만료 전 seal 요청          |
| 422  | `EVIDENCE_GATE_FAILED`                                | 검증·증거·SoD artifact 미충족                |
| 422  | `MANIFEST_TOO_LARGE`                                  | canonical Manifest 32KiB 초과                |
| 422  | `MANIFEST_OWNERSHIP_MISMATCH`                         | Parent/Product/App/Capability binding 불일치 |
| 422  | `RESPONSE_CONTRACT_TOO_LARGE`                         | 저장 가능한 canonical 응답 64KiB 초과        |
| 503  | `WIDGET_CATALOG_UNAVAILABLE`                          | Authoritative 권한원장 확인 불가             |
| 503  | `MANIFEST_BINDING_AUTHORITY_UNAVAILABLE`              | Binding Fixture/DB/head 확인 불가            |
| 503  | `WIDGET_HOST_CONTEXT_UNAVAILABLE`                     | 서버 Host Context 판정 불가                  |
| 503  | `WIDGET_MUTATIONS_DISABLED`                           | Runtime Control에 의한 일반 Mutation 중단    |
| 503  | `COMMAND_NOT_EXECUTED`                                | 만료된 고아 Receipt를 무변경으로 종결        |
| 503  | `COMMAND_COMPLETION_INTEGRITY_FAILURE`                | Receipt·Gate·Ledger 불변식 위반              |

Item 차단 이유마다 전역 Error Code를 추가하지 않고 Effective Reason Code로 표현한다.

## 9. Migration·Flag·호환성

기존 Tenant에는 현재 동작을 보존하는 5개 explicit allow Policy Revision을 Backfill한다. 신규 Tenant도
Provisioning이 같은 5개 exact Baseline을 생성하고 App 미보유 항목은 Entitlement Gate로 deny한다. Definition Publish만으로 Tenant
Allow, 사용자 배치 또는 Home Layout을 만들지 않는다.

서버 Flag는 기본 `false`다.

- `widget-registry-enabled`
- `widget-catalog-shadow-bootstrap-enabled`
- `widget-catalog-shadow-enabled`
- `widget-catalog-authoritative-enabled`
- `tenant-widget-policy-enforcement-enabled`
- `widget-instance-v6-dual-write-enabled`
- `widget-instance-v6-read-enabled`
- `widget-runtime-broker-enabled`
- `widget-preset-enabled`

`VITE_HOME_WIDGET_LIBRARY_ENABLED`는 Phase 0 UI 노출 전용이며 권한 근거가 아니다.

`adm_tenant_widget_catalog_settings`는 `authoritativeActivatedAt?`, `authoritativeRevision?`,
`activationApprovalId?`를 추가로 저장한다. Mode 판정은 아래 순서를 사용하고, 조합을 임의로
완화하지 않는다.

| Tenant catalog setting / selector       | 필수 server flag·artifact                                                                                                                         | Effective API mode / observer / Runtime effect                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `STATIC`                                | bootstrap selector 미선택                                                                                                                         | `STATIC` / off / legacy                                         |
| `STATIC` + `STAGING_BOOTSTRAP_SELECTED` | staging, registry + tenant-policy + bootstrap=`true`, shadow=`false`, authoritative=`false`, `BOOTSTRAP` Head+active approval, bucket≤ring≤100bps | `STATIC` / on / legacy; Shadow result는 metric에만 쓰임         |
| `SHADOW` + `PROMOTION_RING_SELECTED`    | staging, registry + tenant-policy + shadow=`true`, bootstrap + authoritative=`false`, `SHADOW` Head+active promotion approval, bucket≤ring        | `SHADOW` / on / legacy                                          |
| `SHADOW` + `PROMOTION_RING_UNSELECTED`  | 위와 같지만 bucket>ring                                                                                                                           | `STATIC` / off / legacy                                         |
| `AUTHORITATIVE`                         | registry + tenant-policy + authoritative=`true`, bootstrap + shadow=`false`, activation approval/revision                                         | `AUTHORITATIVE` / off / Effective deny가 Runtime Guard 권한원장 |

표의 `registry`, `tenant-policy`, `bootstrap`, `shadow`, `authoritative`는 각각
`widget-registry-enabled`, `tenant-widget-policy-enforcement-enabled`,
`widget-catalog-shadow-bootstrap-enabled`, `widget-catalog-shadow-enabled`,
`widget-catalog-authoritative-enabled`의 exact alias다. 두 ring selector는 Browser 입력이 아니다.
Platform은 Approval에 고정된 `selectorKeyId`의 secret으로
`HMAC-SHA256(opaqueTenantRef + "\n" + opaqueSubjectRef + "\n" + surfaceKey + "\n" +
bootstrapPrerequisiteId)`을
계산하고 첫 8 byte를 unsigned big-endian Integer로 읽어 `(value mod 10,000)+1` bucket을 만든다. Secret은
DB·Log·Metric에 쓰지 않고 Rollout 중 회전하지 않는다. `bootstrapPrerequisiteId`가 rollout의 immutable
cohort lineage이므로 같은 selector key를 carry-forward한 `1%→10%→100%` 승격은 기존 cohort를 항상
포함한다. `rolloutRevision`을 HMAC 입력에 넣어 promotion마다 subject bucket을 churn시키지 않는다.
`deploymentEnvironment=STAGING`, active
Head/Approval tuple 일치, `bucket≤Head.ring_bps`를 bootstrap과 정상 SHADOW 요청마다 모두 재검증한다.
Bootstrap 행은 일반 `STATIC`보다 먼저 판정하고, SHADOW ring 밖 요청은 위 표처럼 `STATIC/off/legacy`다.
Production에서는 두 selector와 Rollout Operations 자체를 거부한다.
저장 Mutation은 위 조합이 아니면 `409 INVALID_CATALOG_MODE_COMBINATION`으로 거부한다. 미설정·unknown
Tenant setting은 cutover 전에만 `STATIC/observer off`로 정규화한다. `authoritativeActivatedAt`이 있는
Tenant에서 필수 flag/artifact/revision이 부재·불일치하면 정적 Fallback 없이
`503 WIDGET_CATALOG_UNAVAILABLE`로 Fail Closed한다. Bootstrap, Shadow, Authoritative flag 중 둘 이상을
동시 `true`로 두거나 Frontend flag로 이 Mode를 정하는 조합은 허용하지 않는다. Bootstrap 자동 중단은
원장 Transaction으로 approval을 `REVOKED`, Head를 `STATIC`, `rolloutRevision+1`로 만든 다음 bootstrap
flag를 내린다. 정상 Shadow 자동 중단도 같은 원장 Transaction으로 promotion approval과 Head를 먼저
폐기한 뒤 shadow flag를 내린다. 두 경로는 서로의 flag나 approval을 재사용하지 않는다.

```text
STATIC
→ SHADOW
→ Authoritative API read-only
→ AUTHORITATIVE v5 + Legacy Runtime Guard
→ Instance v6 dual-write
→ Instance v6 read
→ Runtime Broker
→ Private Preset
→ Controlled sharing
```

`AUTHORITATIVE`에서 Registry를 읽지 못하면 정적 Catalog로 되돌아가지 않고 Fail Closed한다.

두 기존 코드 경계를 직접 연결하지 않는다.

- `HomePreferenceService`의 누락 Widget `visible=true` 정규화에 Registry Publish를 연결하지 않는다.
- `HomeWidgetConfigurationPolicy`는 Workspace Registry Seed가 완결될 때까지 HCM·Approval의 정적
  호환 Resolver를 유지한다.

## 10. 후속 의존성

구현 순서는 다음과 같다.

```text
Control-plane Shadow Bundle
→ Instance v6
→ Runtime Broker
→ Private Preset
→ Direct/Group/Tenant 공유
```

Instance v6가 같은 Definition의 복수 Instance와 독립 설정을 소유한 뒤에만 Preset 적용을 시작한다.
Runtime Broker가 현재 사용자 Source ACL, Field/Row Budget, Cache 격리와 Action 재인가를 제공하기
전에는 신규 Data Capability를 출시하지 않는다. Preset은 불변·데이터 없는 Config Revision이며
기본 적용은 Copy-on-apply다.
