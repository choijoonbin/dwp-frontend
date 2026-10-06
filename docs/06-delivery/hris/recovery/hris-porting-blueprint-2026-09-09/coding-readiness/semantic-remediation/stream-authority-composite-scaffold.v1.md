# Stream authority / composite receipt v1 — common source scaffold

Status: UNWIRED_DISABLED_SCAFFOLD / G3_CLOSED / COMMON_P0_OPEN. No 13-stream runtime or Control boot approval is asserted.

현재 구현 범위는 새로운 immutable authority/receipt 계약과 외부 Control 검사 전용 미배선 파일럿입니다. 기존 scalar v2·SQL·서비스 시작 배선은 변경하지 않았습니다. 앱 runtime-only startup 검증, 현재 서명 seal·freshness·deployment fence 및 실제 13-stream bootstrap은 공통 P0로 남으며 모듈별 코딩 Gate는 열지 않습니다.

Authority decision: [SYS stream authority decision proposal](sys-stream-authority-decision.proposal.v1.md), read in full before implementation and again after root correction. [Runtime-only startup authority boundary](runtime-only-startup-authority-boundary.proposal.v1.md) was read in full and remains OPEN. Root independent review required exact split Insights query/execution writer purposes, analytics/AI deployment without employee-listening adoption, and an external-only inspection API because native seal inspection requires migration credentials. This document records those refinements without changing historical SQL, scalar v2 evidence, or existing Gate registries.

## Source inventory and compatibility

Baseline backend HEAD: `70c996fdafc011392056a1909a2e5222b240ded3`, tree `ad226258485214e52a552e08594668c3593c320b`, clean before this task. Historical full diagnostic remains `backend-full-diagnostic-70c996f-2026-09-14.v1.*`, not fresh proof for these new sources.

New production sources only, under `dwp-core/src/main/java/com/dwp/core/database/authority/`:

| Source | Responsibility |
| --- | --- |
| ExactStreamTopology.java | Independent structural 8-service/13-stream oracle, fixed schemas/history/locations, exact runtime purpose cardinality, explicit unwired status |
| StreamAuthorityContract.java | Immutable manifest, deployment catalog/role/qualifier identities, capabilities/dependencies, deny-by-default object grants |
| CompositeAuthorityReceipt.java | Immutable native-preapplied successor receipt; incompatible/adopted modes reject rather than imitate scalar evidence |
| StreamAuthorityJson.java | 262144-byte limit, strict unknown/duplicate/coercion/trailing/null/version rejection, exact byte-canonical JSON and namespace-separated SHA256/external binding |
| CompositeRuntimeBindingGuard.java | External Control authority inspection + runtime pool pilot only; trusted lazy migration/runtime registry entries, fixed read-only PG catalog queries; never app startup |

Two documentation JSON schemas live in `dwp-core/src/main/resources/database/stream-authority/`: `stream-authority-manifest.v1.schema.json` and `composite-authority-receipt.v1.schema.json`. The parser and independent topology oracle enforce cross-field invariants that JSON Schema alone does not establish; a schema-only PASS is never authority approval.

No existing scalar `MigrationControlRunReceiptGuard`, `ControlPlan`, `MigrationControlMain`, Flyway guard, migration SQL, main service bootstrap, build, authorisation/Gate registry, or source-size/SCC exception is changed. There are no new Spring annotations, factories, environment fallbacks, ServiceLoader registrations, or application calls to the new API. It is an unwired external deployment/Control inspection scaffold only. Renaming the API is a responsibility correction, NOT implementation or approval of an app runtime-only startup guard.

The sole public inspection entry is `inspectExternallyControlledService`. Its immutable result fixes `executionBoundary=EXTERNAL_CONTROL_AUTHORITY_INSPECTION` and `implementationStatus=UNWIRED_DISABLED_SCAFFOLD`. It requires migration suppliers to read native histories and exhaustive inventories; production applications must never receive or invoke this API with migration credentials. The class remains in a shared library but has no startup wiring. Application runtime-only DTO/guard must receive only runtime pools plus independently signed/current RuntimeStreamStartupSeal/epoch/freshness/deployment-fence proof and must have no migration supplier/history SELECT. That transport, proof schema, producer, key/signature/revocation/freshness/fence/outage policy and actual app guard are unimplemented OPEN P0.

## Exact topology and runtime purposes

Catalog keys are deployment-level service identifiers, not tenant HR configuration. All eight deployed database names are canonical and distinct; Auth and Platform cannot share a catalog. Each stream's migration LOGIN and every runtime purpose LOGIN/qualifier are globally distinct. Thirteen streams therefore have thirteen migration authorities and fourteen runtime authorities, not thirteen total roles.

| Service / stream key | Schema / history | Exact runtime purpose(s) |
| --- | --- | --- |
| approval / approval-main | public / flyway_schema_history | PRIMARY |
| auth / auth-main | public / flyway_schema_history | PRIMARY |
| auth / auth-hris-participation-issuer | hris_participation_issuer / flyway_hris_participation_issuer_history | PARTICIPATION_ISSUER |
| notification / notification-main | public / flyway_schema_history | PRIMARY |
| payroll / payroll-main | public / flyway_schema_history | PRIMARY |
| people / people-main | public / flyway_schema_history | PRIMARY |
| people / people-performance | hris_performance / flyway_performance_schema_history | PERFORMANCE |
| platform / platform-main | public / flyway_schema_history | PRIMARY |
| platform / platform-hris-configuration | hris_configuration / flyway_hris_configuration_history | CONFIGURATION |
| platform / platform-hris-protected | hris_listening_protected / flyway_hris_listening_protected_history | LISTENING_ADMISSION |
| platform / platform-hris-insights | hris_insights / flyway_hris_insights_history | INSIGHTS_EXECUTION_WRITE, INSIGHTS_QUERY |
| provider / provider-main | public / flyway_schema_history | PRIMARY |
| time / time-main | public / flyway_schema_history | PRIMARY |

Existing public locations remain `classpath:db/migration`; People performance remains `classpath:db/performance-migration`. New locations are proposed reservations only: `classpath:db/hris-configuration-migration`, `classpath:db/hris-listening-protected-migration`, `classpath:db/hris-insights-migration`, `classpath:db/hris-participation-issuer-migration`. No migration exists there and no empty-schema deployment is claimed.

Existing nine stream identities and immutable history are preserved, NOT the existing scalar role topology. In particular, existing People main/performance currently use the same migration principal. New composite authority rejects that reuse and needs a separately reviewed external G3 role/ownership/bootstrap transition. Relabelling the current scalar receipt cannot prove the new topology, and current 70c996f runtime evidence must not be reused.

Insights query requires pool readOnly=true, actual PG transaction_read_only=on, own-schema SELECT-only tables (or exact approved TYPE USAGE), no user routine invocation, no ownership/membership/DDL. Insights execution writer is a separate direct LOGIN with readOnly=false and exact own-schema object DML/approved routine grants, never protected answers/tokens or foreign history. Writer access is not obtained by relaxing query readOnly or granting SET ROLE. These two pools in the same JVM do not provide process-compromise or DBA isolation; dedicated Insights deployment remains a separate regulated profile.

## Manifest key contract and feature dependencies

Exact top-level keys: `schemaVersion`, `topologyVersion`, `controlReference`, `enabledCapabilities`, `catalogs`, `streams`, `manifestSha256`. Version is 1.0, topology is hris-stream-topology-v1, and source reference currently has existing `dwp-migration-control-v2:<sha256>` syntax. The receipt namespace is separately versioned; this syntax does not mean current Control produces it.

Catalog keys: `catalogKey`, `database`. Stream keys: `service`, `streamKey`, `catalogKey`, `enabled`, `schemas`, `historyTable`, `migrationLocations`, `migrationPrincipal`, `migrationQualifier`, `runtimePrincipals`. Runtime keys: `purpose`, `principal`, `qualifier`, `readOnly`, `searchPath`, `objectGrants`. Grant keys: `objectClass`, `schema`, `name`, `identityArguments`, `privileges`. TABLE allows SELECT/INSERT/UPDATE/DELETE, SEQUENCE allows SELECT/USAGE, ROUTINE allows EXECUTE with canonical built-in argument identities, TYPE allows USAGE. Column/default/grant-option/broad privileges and foreign/history grants are unsupported and fail closed. Arrays are unique and strictly sorted; searchPath is the fixed ordered `[pg_catalog, own_schema]`.

The exact enabled supplemental stream set must equal the union of enabled capabilities:

| Capability | Required supplemental streams |
| --- | --- |
| HRIS_CONFIGURATION | configuration |
| PEOPLE_ANALYTICS | configuration + insights |
| GOVERNED_AI | configuration + insights |
| EMPLOYEE_LISTENING | configuration + protected + participation issuer + insights |

People analytics and governed AI are independently available without employee listening. Protected admission/issuer always deploy as a pair and require configuration. Listening also requires an Insights result boundary; anonymous answers are not made available to generic analytics. Unknown capabilities or hidden enabled streams reject. Existing nine streams cannot be disabled through this successor.

Credentials, JDBC URLs, arbitrary SQL, tenant secret parameters and generic endpoint authorisation are absent from documents. `inspectExternallyControlledService` accepts an independent external expected manifest digest/receipt digest/current Control reference/previous digest and an already trusted external-authority qualifier registry of lazy migration/runtime suppliers plus expected numeric server address/port. Suppliers carry process-owned credentials only in memory; they are forbidden app startup inputs. It does not construct a datasource or use DB_USERNAME/primary DS fallback. Missing enabled qualifiers reject before opening any pool; disabled suppliers are never invoked. A wrong qualifier bound to the wrong pool fails actual principal/endpoint/purpose verification. The future external deployment authority must keep these settings independent of documents and configure bounded pool acquisition/login/network timeouts.

## Receipt and native probe boundary

Exact receipt keys: `schemaVersion`, `topologyVersion`, `manifestSha256`, `controlReference`, `previousCompositeReceiptSha256`, `mode`, `streams`, `receiptSha256`. Native mode is NATIVE_PREAPPLIED only. Each stream seal carries `service`, `streamKey`, `database`, `authoritySha256`, `migrationPrincipal`, `postgresVersion`, `historyMaxInstalledRank`, `historyRowCount`, `historySha256`, `inventoryObjectCount`, `definitionAclOwnershipInventorySha256`, `adoptionReceiptSha256`, `temporaryPrivilegeRevoked`, `bootstrapOrder`. Adoption provenance is currently empty; non-empty adoption/mode inputs fail closed and require a separately versioned proven successor rather than a bypass.

Manifest SHA is SHA256(namespace + newline + exact canonical object excluding manifestSha256); stream SHA binds the complete authority object; receipt SHA similarly excludes receiptSha256 under a distinct namespace. Expected digests/current source/previous chain are mandatory trusted external settings. The receipt enabled stream set must exactly match the manifest, each stream's catalog/migration role/authority digest must match, and bootstrapOrder is the exact sorted 1..N order. A receipt or authority copied across stream/catalog/current revision cannot approve it.

Actual inspection checks same trusted server/catalog for migration/runtime, original authenticated JDBC metadata LOGIN=current_user=session_user=the declared LOGIN, PG version, role=none, replication-role origin, readOnly posture, exact live/persistent searchPath, no elevated attributes, zero incoming/outgoing memberships, no foreign catalog CONNECT/CREATE/TEMP, no foreign schema usage/CREATE/ownership, and no runtime owned objects/parameter/catalog authority. The original protocol username check rejects privileged SET SESSION AUTHORIZATION disguise even when both live SQL usernames become a safe role. Effective TABLE/SEQUENCE/ROUTINE/custom standalone TYPE privileges are enumerated across all non-system schemas and compared with the exact allowlist. Row and array types are implementation derivatives, not additional grant-authorisation surfaces; schema/table denial remains mandatory. PUBLIC/default/column/grant-option/unknown-routine/private-history authority is not a fallback.

Existing `MigrationAdoptionGuard` native history and exhaustive protected object inventory are reused read-only. Its inventory identity contains definition and ACL fingerprints, exact owner/OID/dependency/extension membership seals; the new receipt names that semantic meaning explicitly. Live history count/max/success/installed_by and digest are checked, so a forged maximum does not truncate or hide rows. This scaffold issues no DDL, ALTER ROLE, grant, migration, SET ROLE, arbitrary caller SQL or history write. Fixed inspection statements have 5-second query timeouts. A temporary 15-second JDBC network timeout also bounds existing exhaustive inventory queries and is restored before pool-owned connections close; unsupported timeout enforcement fails closed. Pool acquisition/login settings remain the trusted integration's responsibility. Existing exhaustive inventory routines are not altered.

## Test allocation and proof limits

New unit/support classes: AuthorityFixtures (explicitly synthetic, never Control proof), StreamAuthorityJsonTest (strict manifest/receipt/identity/cardinality/dependency rejections), CompositeRuntimeBindingGuardTest (disabled suppliers=0, missing fallback/query/writer/foreign qualifier/instance reuse before pool opening).

Real private PG classes: CompositeRuntimeBindingGuardPostgresTest (configuration native healthy-first plus 33 actual role/ACL/history/inventory mutations and direct session-user/SET ROLE/server/catalog/readOnly rejections); InsightsPurposeBindingGuardPostgresTest (query and writer actual healthy-first, bounded own CRUD and SELECT, query actual DML denial and DML-grant rejection, wrong pool readOnly/server role default/purpose/qualifier/principal rejection, writer→protected SELECT/DML denial and grant mutation rejection). Test DDL applies only to newly generated private catalog/roles inside owned Testcontainers PG; passwords are random in memory/prepared parameters, exceptions are generic. Catalog lifetime disposal avoids deleting immutable audit rows. No customer/user database, running server, opt-in environment, historical skip condition, or guard strength is changed.

Preliminary focused source-contract/config pilot result: 95 cases, failures/errors/skips 0; Gradle exit 0, 166.493 seconds under hris-verification semaphore. Earlier healthy PG failed first because inet::text carries a network mask and then because SQL searchPath was configured as a single quoted name; canonical host(inet) query and correct list-valued fixture configuration were fixed, not rejection policy weakened. The additional real Insights query/writer healthy test passed in 26.245 seconds, including actual own CRUD/SELECT, query DML denial and protected query denial. Final source/XML digest evidence is recorded separately after final fresh verification; preliminary results do not cover later source edits.

Final frozen-source focused verification: 114 cases across four suites, failures/errors/skips 0; Gradle exit 0, 224.713 seconds, 4 executed / 7 up-to-date tasks. The final run started 2026-09-14 02:07:01.898 UTC and released hris-verification normally at 02:10:46.611 UTC. All twelve source modification timestamps precede run start, independently measured pre/post-commit hashes match, six existing static checks pass, and the backend is clean after exact twelve-file commit `76130dde620084124a9c16ff8edc731487e0a4c3` / tree `b7007b8c27cd4cfb9aadf50a034e316e7864869e`. The independent current attested source reference is `dwp-migration-control-v2:a18c30c83e7ec75d0ea42312dc9683c526c73007c0d2a5a9626f1d403d55dc0e`.

The [final focused report](../reports/stream-authority-composite-focused-2026-09-14.v1.md) and [complete source/class/XML/case manifest](../reports/stream-authority-composite-focused-2026-09-14.v1.json) preserve the exact evidence. Actual PostgreSQL identity/ACL/native-seal tests are external-inspection pilots using synthetic contract-reference metadata, not a real current-source 13-stream Control bootstrap. This PASS does not close any remaining common P0 or open G3.

## Remaining common P0 — G3 coding gate stays CLOSED

1. An actual resource-only external Control composite producer, exact bootstrap manifest/ordering/grants/native-or-proven-adoption provenance and prior-chain sealing does not exist. It must preserve scalar v2 compatibility and genuine immutable histories, deny unapproved endpoints/roles/SQL, and independently verify 8 catalogs/13 streams/14 runtime purposes. Current Control does not emit a composite receipt; synthetic unit receipt hashes are never a substitute.
2. The app runtime-only startup contract/guard is NOT implemented: it must accept no migration DS/supplier/credential/history SELECT and only own purpose runtime pools plus signed/current RuntimeStreamStartupSeal. Exact proof schema/serializer/key rotation/signature/revocation, source/receipt binding, transport/refetch freshness, deployment epoch/permit/fence/notBefore/expiry/outage, DDL-vs-startup race and readiness revoke/drain/reseal policy are OPEN. External-only native inspection cannot be directly wired to app startup. Primary/supplemental profile qualifiers, disabled routes/UI unavailable/configuration-required and enabled purpose bindings, bounded acquisition/network timeout/failure/cleanup and authority distribution remain actual G3 work, not domain G4.
3. Empty reserved schemas/roles/history/actual migrations and reviewed per-object table/routine/type/sequence allowlists do not exist. Existing People shared-role history needs a controlled owner transition. Real 13-stream/14-purpose missing/tampered receipt/private role reuse/cross-history/primary→private deny boot tests are outstanding, not moved to domain G4.
4. Signed issuer/admission mirror control/refetch/result-unknown/replay/erase and privacy aggregate DTO/SPI/fail-closed adapters remain separate common-source P0. This scaffold neither admits anonymous answers nor proves anonymity/process isolation.
5. New common sources change the actual Control source hash. Current exact HEAD/tree/source reference, generated schemas/contracts, module instructions, worktree baseline manifests, G0/G3 catalogue evidence and full backend checks need fresh reviewed proof after integration/commit. Historical 70c996f full diagnostic is unchanged and remains historical. No module-wide coding Gate is opened by this scaffold or its focused tests.
