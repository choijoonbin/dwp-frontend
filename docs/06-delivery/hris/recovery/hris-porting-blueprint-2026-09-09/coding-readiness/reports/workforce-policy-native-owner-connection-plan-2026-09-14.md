# 기존 Workforce 정책 생산자·현재 PEP 최소 연결 계획

상태: SOURCE_BASED_READONLY_PROPOSAL / 미게시 / G3_CLOSED. 코드·DDL·registry·Gate 수정, Gradle/PG 실행은 모두 0이다. 기존 v3/V50의 112 고유 작성자 회귀는 보존하며 이번 생산자·HTTP·현재 SoD·전체 PEP 증거로 승계하지 않는다.

## 소스에서 확인한 경계

- P01: 정책 REST 4개는 Gateway LEGACY_EXEMPT이며 People hcm v3 claimed namespace 밖이다. 기존 검증 header만으로 exact current HRIS PEP를 주장할 수 없다. [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-gateway/src/main/java/com/dwp/gateway/productsurface/GeneratedProductRouteCatalog.java:44) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/security/HcmV3PepRegistry.java:106)

- P02: 현재 USER override는 READ action filtering보다 먼저 ROLE 전체를 제외한다. legacy find/Decision 및 DIRECTORY 필수 요건은 유지하고 새 atomic READ만 target organization AND field로 계산한다. [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyService.java:60) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyRepository.java:65)

- P03: create는 USER 본인 금지와 People 조직 tenant 확인만 한다. target USER의 Auth tenant 존재/상태와 ROLE tenant catalog/current actor-held ROLE로 인한 간접 self-grant를 검증하지 않는다. [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyService.java:54) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyRepository.java:186)

- P04: revoke는 본인 USER override 철회로 ROLE가 재노출되는 자기 권한 상승을 검사하지 않는다. 정책 version CAS는 있으나 before snapshot은 일반 find이고 current governance/subject evidence 재검증이 없다. [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyService.java:82) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyRepository.java:87)

- P05: com_roles의 역할 ID는 BIGINT이며 publicUUID/role_family가 없다. family는 builtin_role_code→sys_builtin_role_catalog이며 HR_ADMIN의 실제 family는 PEOPLE다. TENANT는 customer tenant/identity plane 소유권 의미로 검사하고 literal family TENANT를 강제하지 않는다. [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/entity/Role.java:18) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/resources/db/migration/V25__govern_builtin_role_codes.sql:1) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/repository/RoleRepository.java:18)

- P06: APP.HCM과 APP.HRIS는 기존 단일 app resource-set boundary를 공유한다. V90은 APP_HRIS를 RS_HCM_CONFIG로 동일 UUID를 보존하며 rename한다. 현행 hcm/hcm.management와 RS_HCM_CONFIG를 재사용하고 별도 HRIS 관리자 원장을 만들지 않는다. [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/resources/db/migration/V55__govern_new_product_application_boundaries.sql:35) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/resources/db/migration/V90__normalize_product_authorization_resource_set_keys.sql:1) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/contracts/product-authorization/product-surfaces-v1.json:2720)

- P07: ScopedAdminDutyPolicy의 현재 scoped 분기는 approvals.admin만 적용하며 static SoD helper는 알려진 approvals 3개 이외 default false이다. V92 HCM preset은 DRAFT이며 허가가 아니다. HRIS exact mapping 및 unknown-policy failclosed가 필요한 native 준비 항목이다. [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/service/ScopedAdminDutyPolicy.java:17) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationAuthoritySupport.java:222) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/resources/db/migration/V92__govern_app_admin_presets.sql:230)

- P08: Gateway session cache는 permissionPrefix가 없는 3종 low-risk platform read만 적용한다. HRIS와 정책 CRUD는 현재 uncached이므로 HRIS가 3초 stale cache를 쓴다는 진단은 틀리다. 정책 native versions/window와 People psr/population evidence는 요청별 재계산한다. [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-gateway/src/main/java/com/dwp/gateway/security/AuthSessionVerifier.java:62) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/service/AuthService.java:362) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-gateway/src/main/java/com/dwp/gateway/productsurface/ProductSurfaceContextAggregationService.java:305)

- P09: create는 trimmed subjectRef를 validation에만 사용하고 repository에 원래 request subjectRef를 저장한다. 실제 owner 쓰기에서 canonical role50/positive decimal user ID를 한 번 정규화하여 validation·catalog binding·저장·digest가 동일 값을 사용해야 한다. storage legacy80는 inspect/revoke 호환이지 신규 native grant가 아니다. [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyService.java:167) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyRepository.java:203) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/resources/db/migration/V50__align_workforce_policy_role_code_compatibility.sql:1)

- P10: Auth V101/V104는 Auth의 동일 canonical user row 권한 경계를 serialize하지만 People mutation transaction과 원자적으로 묶지 않는다. 마지막 Auth proof 이후 People commit 전에 일어난 revoke의 즉시 철회 보장은 별도 permit/fence 계약 없이는 주장할 수 없다. [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/resources/db/migration/V101__exclude_provider_identities_from_tenant_authority.sql:1) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/resources/db/migration/V104__serialize_identity_authority_boundaries.sql:1) [소스](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyService.java:54)

## 닫힌 ABI 및 신뢰 주체

Auth는 actor principal/user/native person binding과 user rowVersion/accessRevision 두 stamp, 현재 session/권한/ROLE/duty/SoD를 소유한다. 정책 관리자는 person/고용 context가 없을 수 있다. Gateway는 현재 검증한 session·exact route·selected scope·psc/psr를 소유한다. People는 data target PERSON 또는 person→worker→relationship→assignment 및 native version 4개를 소유한다. 이 둘을 long revision 하나로 합치지 않는다.

정책 수신자 USER numeric account ID/ROLE code+BIGINT role ID와 data target person public UUID는 다른 ID space다. nonSELF/prehire data target에 Auth 계정을 강요하지 않는다. PERSON 읽기에 worker/location/TIM/UTC/primary assignment를 요구하지 않는다. com_roles에 publicUUID/role_family를 만들거나 BIGINT→UUID로 변환하지 않는다. builtin catalog에는 version이 없으므로 native updated_at/정확 row 내용의 별도 catalog stamp를 정의한다. 이는 native auth-* truth factory를 대체하는 새 hash 규칙이 아니다.

revoke: native policy UUID+version and locked immutable subject/population row. create: canonical command digest+actual current governance collection/scope owner reference and revision, not a nonexistent policy before creation; allocate new policy public UUID server-side after admission. Exact create StepUp/nonce target binding is a reviewed command contract, not correlation/session-derived identity.

Existing REST remains conflict/CAS semantics until an exact reviewed replay/idempotency contract is implemented. Reuse existing People command-bound StepUp replay ledger only after exact CREATE collection-target/revision and REVOKE row-target bindings are registered; null HcmPepContext legacy return is not proof. No fake receipts/DDL/step-up booleans.

공개 request/response carrier의 boolean·field list·duty·actor 주장은 권한 증거가 아니다. server-owned operation registry와 current authenticated invocation을 결속한 private guard만 verified lookup/result를 발급한다. missing current provider/issuer/known scope는 DML 이전에 거부한다.

## 최소 구현 순서 — Root 검토 전 미구현

### S1: 기존 Auth native factory와 현행 actor session을 사용하는 exact current governance+target subject owner publication. 별도 role/shadow RBAC/identity DDL 없음.

신규 production 파일 제안:

- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/workforce/v1/WorkforcePolicyGovernanceV1.java
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/service/WorkforcePolicyGovernanceAuthorityAdapterV1.java
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/controller/WorkforcePolicyGovernanceAuthorityControllerV1.java
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/config/WorkforcePolicyGovernanceInternalSecurityConfigV1.java

제안 내부 API는 POST /internal/auth/v2/workforce-policy-governance/evaluate, caller/audience dwp-people-server만이다. 신규 endpoint만 지정한 dedicated service-token plus current actor JWT 검증. 기존 Gateway 전용 product-surface token/identity를 People에 공유하거나 People이 dwp-gateway를 사칭하게 하지 않는다. JWT는 기존 decoder/native session validator를 재사용하고 몸체 actor/tenant를 권위로 사용하지 않는다. 기존 JwtDecoder/AuthSessionJwtValidator를 재사용하며 session credential는 메모리 전송만 하고 저장·로그하지 않는다. actor/tenant는 인증 주체에서 추출하고 body selector/digest/revision은 비교 입력이다. unknown field/operation, duplicated header, wrong service, revoked native session은 거부한다.

단계 종료 증거: 정확 service caller/session/actor stamp/Auth revision/active bundle/scope/duty/known SoD와 target catalog refetch를 모두 검증. native source가 없거나 미등록이면 deny/unavailable이며 DML0. source-only factory unit를 native HTTP/session EE로 확대하지 않는다.

### S2: 동일 기존 service.create/revoke에 owner guard를 실제 연결. 기존 REST/Decision/USER 우선순위/DIRECTORY·transaction semantics 유지.

신규 production 파일 제안:

- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforcePolicyGovernanceGuardV1.java
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforcePolicyGovernanceAuthorityClientV1.java

기존 변경 경계:

- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyService.java
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyRepository.java
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessDtos.java

- create/revoke/list/organizations는 server operationId로 guard를 먼저 호출한다. current MANAGE를 필요로 하는 기존 service GET 의미를 VIEW로 조용히 확장하지 않는다. legacy role empty-permission fallback을 새 current proof로 사용하지 않는다.
- create의 신규 ROLE write는 native role50만 승인하고 existing legacy80 row inspect/revoke는 보존한다. normalized subjectRef를 catalog/digest/insert에 동일하게 전달하며 Locale.ROOT를 사용한다.
- USER subject는 current Auth account exact tenant/native numeric ID/current state를 검사한다. HRIS data target person/prehire/noAuth는 이 정책 recipient account와 구분한다.
- 보유 ROLE(DIRECT/GROUP/PRIVILEGED TENANT origin)을 target으로 새 grant하려는 actor와 자기 USER restriction revoke는 self-grant denial. 승인 workflow는 이 단계에서 만들지 않으며 proof 없는 bypass는 없다.
- revoke 전 tenant+UUID locked findForUpdate, version>=0 검증, CAS UPDATE native state/version. before/after는 동일 잠긴 row/native RETURNING 또는 current refetch다. rollback/conflict에는 성공 outbox 없음.
- organization/current source owner refetch, 각 owner 호출 후 monotonic clock 재확인, 최종 두 current lease와 모든 source validTo의 min expiry. session/role/duty/revision mismatch는 rollback.
- 기존 AuditOutboxRecorder local transaction 삽입을 유지한다. correlation는 metadata이며 business policy UUID 또는 idempotency proof가 아니다.

단계 종료 증거: 실제 기존 create/revoke→native repository→transaction/audit→target-first read 경로. mock governance와 실제 Auth session/HTTP/current SoD/transport 테스트를 보고서에서 별도 분리. 신뢰 provider 미설치인 HRIS command는 unavailable/0write이며 기존 legacy endpoint 전체 배선 완료로 주장하지 않는다.

### S3: 4 REST의 exact current route/current target evidence/native PEP 연결. 먼저 등록하고 legacy exemption을 여전히 우회하게 두거나 먼저 exemption만 제거하여 임시 broad fallback을 만들지 않는다.

기존 변경 경계:

- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-gateway/src/main/java/com/dwp/gateway/productsurface/GeneratedProductRouteCatalog.java
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-gateway/src/main/java/com/dwp/gateway/filter/ProductSurfaceDecisionContextFilter.java
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/security/HcmV3PepRegistry.java
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/security/HcmProductSurfacePepFilter.java
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/service/ScopedAdminDutyPolicy.java
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationAuthoritySupport.java

등록 소유권은 hcm/hcm.management, APP.HCM(호환 APP.HRIS), RS_HCM_CONFIG, ADMIN.WORKFORCE_ACCESS:MANAGE이다. 기존 sys_admin_scoped_duty_catalog/capabilities/conflicts, com_admin_scoped_duty_assignments, com_admin_role_assignments/resources/members를 재사용. 신규 duty codes/SoD policy IDs는 owner 승인·정상 registry 생성 및 forward catalog registration 대상이며 현재 존재/승인으로 주장하지 않는다. tenant/user/group grant 신규 자동 seed 없음. 전체 G4 CRUD 선행 없음.

v3 native USERoverride-first policy 관계 검사 결과를 current People population/field proof의 부분 입력으로 연결. PURPOSE/date/SoD/Gateway current bridge가 없으면 whole PeopleAuthoritySnapshot을 true/default로 완성하지 않는다.

현재 canonical/historical bundle 불변; 다음 reviewed bundle은 기존 generator/index/bootstrap 정합 검증 절차로 발행. exact 4 exemption 제거와 People PEP namespace claim은 full route witness 후 같은 reviewed rollout 경계. 서버설정 default-off/mixed rollout failclosed; public 경로/응답 DTO 유지.

## 실제 테스트 할당

이번 설계의 실제 test execution은 0개다. JSON에 29개 fixture/expected denial·positive/source/DML/outbox assertions를 PLANNED_NOT_EXECUTED로 정의했다. 숫자는 커버리지 합격이 아니다.

S1은 실제 Auth factory/native target catalog/current actor/session과 exact security-chain 테스트, S2는 실제 기존 service.create/revoke→repository→transaction/AuditOutbox 테스트, S3는 Gateway→People exact route/native proof test로 분리한다. public boolean/mock current verifier가 있는 native-row 테스트는 explicit MOCK으로 표시하고 실제 transport/SoD/PEP EE로 확대하지 않는다.

우선 회귀는 DIRECTORY+JOB_GRADE OrgA와 DIRECTORY OrgB를 실제 service.create로 생성한 뒤 OrgB JOB_GRADE 거부·DIRECTORY 허용, USER override 3종, foreign/revoked USER·ROLE, native PEOPLE family 정상, indirect self ROLE grant와 own USER restriction revoke reveal, stale/negative CAS·concurrent revoke, audit 실패 rollback, 두번째 lease/source.validTo final expiry, missing/unknown duty·SoD·DRAFT, wrong caller/session/body actor relabel이다.

신규 테스트 제안 경로는 JSON implementationStages.S2.testsNewPaths에 지정했다. 실제 Auth/Gateway HTTP producer 배선, policy source version/refetch, current native SoD와 data target permission 관계는 별도로 실행·증거를 기록해야 한다.

## transaction·철회·캐시

기존 AuditOutboxRecorder는 caller transaction에서 service-local outbox를 삽입한다. policy mutation/success audit는 같이 commit하고 conflict/audit failure에는 rollback한다. denial REQUIRES_NEW audit의 목적은 유지하되 광역 감사 작업으로 확대하지 않는다. native version CAS·row lock을 재사용하며 새 정책 revision ledger/counter는 만들지 않는다.

HRIS와 정책 CRUD는 Gateway 현재 uncached이다. 새 authority TTL cache를 넣지 않고 native policy version/window와 People population/field evidence를 요청별 재계산한다. UI context invalidation은 committed outbox 후 보조 기능이며 native current denial을 대신하지 않는다.

Auth canonical user lock/V104는 Auth 내부 권한 경계를 serialize할 뿐 Auth+People의 distributed transaction이 아니다. Read-style expiring carrier is not a commit permit. Before production mutation cutover define exact authorization linearization point/commit permit consumption and native revocation semantics; require independent two-owner race tests. Do not assert zero-race immediate revoke until real fence exists. 실제 authorization linearization point/current command permit 소비·revocation fence는 Root와 owner 계약에서 먼저 닫아야 한다. 마지막 owner refetch만으로 production 즉시 철회 race가 해결되었다고 주장하지 않는다.

## 증거와 미인증

54개 selected source의 SHA/행 수/decimal-string mtimeNs를 JSON에 기록했다. 초기 49개 재확인은 불변이며 추가 native JWT 관련 5개도 baseline/post에서 재확인했다. 2026-09-14T09:42:23.356489+00:00 → 2026-09-14T09:48:47.134746+00:00의 54개 SHA/ns drift는 0이다. 이는 지정 메서드·DDL 경계 읽기 증거이며 whole worktree clean/전체 대형 클래스 감사/실행 PASS는 아니다.

현재 native whole PeopleAuthoritySnapshot, current Gateway→People verified invocation transport, HRIS duty·SoD producer/registration, actual HTTP EE와 cross-owner command fence, 13stream startup 및 5모듈 coding readiness는 미인증이다. Root가 S1/S2의 정확 code scope를 승인하기 전 production 구현·commit·정본 전파를 하지 않는다.

