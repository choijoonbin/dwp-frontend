# 8서비스 runtime-only startup·외부 Control 생산자 연결 구현 지시안

상태: DESIGN_PROPOSED_SOURCE_BASED_NOT_INDEPENDENT_APPROVAL / NO_G3_START. 읽기 전용 현행 소스 분석에 근거한 다음 공통 준비 작업 제안이다. 이 문서로 8서비스 배선·13스트림 bootstrap·생산 활성화를 승인하지 않는다. 작성 시각과 38개 소스 SHA는 동반 JSON의 sourceCapture에 보존한다. 관련 소스는 미커밋 working-tree 후보를 포함하므로 승인된 배포 binary라는 뜻이 아니다.

## 1. 현재 증거와 이번 변경 경계

새 native inspector/compiler의 PG16·18.4 작성자 실행은 동일한 93 unique cases(신규65 + 당시 Guard28)다. 186 engine invocations를 186 unique로 부르지 않는다. [작성자 증거](../reports/runtime-startup-native-inspection-author-evidence-2026-09-14.json)는 최초45 FAIL과 fixture의 host(IP) 교정, 실제 argv·XML·한계를 보존한다. 현재 root166 timeout은 해당 증거에 포함하지 않는다.

Root가 별도로 재현한 초기 Clock 예외 노출 뒤 Guard 한 파일의 원인 수리만 허용됐다. SHA 122110d87e929896a6478a3583d8a3cd5d2a93b961c85d5e1b5ee6fb6e7518cc → 5a4f2d5470e5cbe820fc7489c9a488ed1507d061be557de299de3be1f2257083. initial instant()/null 검증에만 local catch(Exception)을 두어 no-cause 일반 오류로 거부한다. 기존14핀은 불변이다. [Root 독립29 PASS](../reports/runtime-startup-clock-entry-root-remediation-pass-2026-09-14.json)는 별도 증거이고 native65와 합쳐 current whole PASS로 주장하지 않는다. 이후 생산 소스 변경은 없다.

이 노트는 기존 scalar/Composite 정책·Control Main·app wiring·role grant·SQL/G0를 수정하지 않는다. 새 구현은 아래 개별 writer 합의 후 진행한다. root가 소유한 startup lease 후보의 과거9 FAIL·후속 수정/독립 검증도 이 노트가 승인하지 않는다.

## 2. 실제9스트림과 등록된13스트림의 차이

[ControlPlan](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-migration-control/src/main/java/com/dwp/migration/control/ControlPlan.java)과 [devctl의 실제 stream map](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/scripts/devctl.py:2955)이 현재 사용하는 구성은 8서비스·9스트림이다. 각 main은 public / flyway_schema_history / classpath:db/migration이다.

| service | 현재 실제 stream·history | 현재 runtime binding |
| --- | --- | --- |
| Auth | auth-main / public.flyway_schema_history | Auth main runtime |
| Platform | platform-main / public.flyway_schema_history | Platform main runtime |
| People | people-main / public.flyway_schema_history; people-performance / hris_performance.flyway_performance_schema_history | 두 stream이 동일 People runtime·migration principal 및 runtime pool을 공유 |
| Time | time-main / public.flyway_schema_history | Time main runtime |
| Payroll | payroll-main / public.flyway_schema_history | Payroll main runtime; public/payroll-main 유지 |
| Approval | approval-main / public.flyway_schema_history | Approval main runtime |
| Notification | notification-main / public.flyway_schema_history | direct runtime + 승인된 api/worker/audit group 표면 |
| Provider | provider-main / public.flyway_schema_history | main runtime + 별도4 catalog metadata-reader |

People performance location은 classpath:db/performance-migration이고 createSchemas(false)다. 현재 승인된 빈 performance history의 count/max=0도 정상 표현해야 한다. 신규49-case fixture는 generic history 관계를 사용하는 정책 seam 검사이며 실제9스트림의 전수 경로/이름을 실행한 증거가 아니다. compiler의 독립 history inventory에 위 실제 history 이름을 정확히 넣는다. 향후 inactive4 history를 materialized라고 넣어 missing-table 오탐을 만들지 않는다.

[ExactStreamTopology](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/ExactStreamTopology.java)는 UNWIRED_DISABLED_SCAFFOLD다. 추가4개는 다음과 같다.

| future stream | schema / history | 활성 dependency·runtime purpose |
| --- | --- | --- |
| platform-hris-configuration | hris_configuration / flyway_hris_configuration_history | configuration; analytics/AI/listening의 configuration owner |
| platform-hris-insights | hris_insights / flyway_hris_insights_history | analytics 또는 AI 또는 listening; QUERY(RO)와 EXECUTION_WRITE 별도 |
| platform-hris-protected | hris_listening_protected / flyway_hris_listening_protected_history | listening만; LISTENING_ADMISSION |
| auth-hris-participation-issuer | hris_participation_issuer / flyway_hris_participation_issuer_history | listening만; PARTICIPATION_ISSUER, protected와 pair |

현재 [StreamAuthorityContract](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/StreamAuthorityContract.java)는 기존9 base enabled를 요구하고, disabled stream을 포함한 migration/runtime role identifier의 전역 unique를 강제한다. 전부 활성화한 successor는 migration13·runtime purpose14이다. current8 runtime/8 migration의 People alias를 이름만 바꿔 이 distinct-role 증거로 재사용하지 않는다. SCALAR_NINE 배포 anchor와 COMPOSITE_THIRTEEN 배포 anchor를 명시적으로 분리하고, People performance ownership/pool/credential cutover는 별도 reviewed Control 작업이다. runtime role 문자열이나 qualifier는 tenant 업무 configuration이 아니라 독립 deployment policy다.

현재 [CompositeAuthorityReceipt](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/CompositeAuthorityReceipt.java:17)는 native-only이고 historyRowCount>=1이다. 빈 performance0과 v2 adopted legacy를 지원하지 못한다. successor 계약의 정확한 버전 변경이 먼저 필요하다. 가짜 V1/no-op 행을 만들거나 installed_by/checksum를 고쳐 수량을 맞추지 않는다. 현재 ObjectGrant의 TABLE/SEQUENCE/ROUTINE/TYPE 표현만으로 Notification의 column/group/default/grant-option 표면 전체를 대체하지 않는다. reviewed versioned compiler policy와 정확한 native 표면을 그대로 결속한다.

## 3. 앱이 가진 migration authority를 제거하는 정확한 교체점

8개 application.yml 모두 Spring Flyway enabled=true이고 migration username/password 설정을 가진다. 8개 migration configuration 모두 Flyway/initializer와 owner datasource를 요구하며 strict에서 pending=0을 확인한 뒤에도 migrate()를 호출한다. no-op 기대는 process가 owner credential을 갖지 않는다는 보장이 아니다.

| service | 현재 수정 대상(다음 단계) | runtime-only 교체·추가 테스트 |
| --- | --- | --- |
| Auth | [AuthDatabaseMigrationConfiguration](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/config/AuthDatabaseMigrationConfiguration.java) + application.yml | AuthRuntimeOnlyStartupConfiguration/Test/PostgresTest |
| Platform | [PlatformDatabaseMigrationConfiguration](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-platform-server/src/main/java/com/dwp/services/platform/config/PlatformDatabaseMigrationConfiguration.java) + application.yml | PlatformRuntimeOnlyStartupConfiguration/Test/PostgresTest |
| People | [PerformanceMigrationStreamConfiguration](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/hris/migrationstream/PerformanceMigrationStreamConfiguration.java) 및 Bootstrap + application.yml | PeopleRuntimeOnlyStartupConfiguration/Test/PostgresTest; 실제 two-history alias |
| Time | [TimeDatabaseMigrationConfiguration](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-time-server/src/main/java/com/dwp/services/time/TimeDatabaseMigrationConfiguration.java) + application.yml | TimeRuntimeOnlyStartupConfiguration/Test/PostgresTest |
| Payroll | [PayrollDatabaseMigrationConfiguration](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-payroll-server/src/main/java/com/dwp/services/payroll/PayrollDatabaseMigrationConfiguration.java) + application.yml | PayrollRuntimeOnlyStartupConfiguration/Test/PostgresTest |
| Approval | [ApprovalDatabaseMigrationConfiguration](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-approval-server/src/main/java/com/dwp/services/approval/config/ApprovalDatabaseMigrationConfiguration.java) + application.yml | ApprovalRuntimeOnlyStartupConfiguration/Test/PostgresTest |
| Notification | [NotificationDatabaseMigrationConfiguration](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-notification-server/src/main/java/com/dwp/services/notification/migration/NotificationDatabaseMigrationConfiguration.java) + application.yml | NotificationRuntimeOnlyStartupConfiguration/Test/PostgresTest; managed options/ACL |
| Provider | [ProviderDatabaseMigrationConfiguration](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-provider-server/src/main/java/com/dwp/services/provider/config/ProviderDatabaseMigrationConfiguration.java), MetadataConfiguration + application.yml | ProviderRuntimeOnlyStartupConfiguration/Test/PostgresTest; metadata 별도 증명 |

새 strict 앱에는 Flyway auto-configuration/initializer/strategy/owner datasource가 없어야 한다. 기존 configuration을 그대로 두고 enabled=false만 주면 mandatory MigrationInfrastructure(Flyway,initializer) 때문에 bean 생성이 실패한다. strict runtime-only configuration으로 barrier를 대체하고 old configuration은 엄격히 비활성화한다. 기존 로컬 호환을 유지할지 여부는 별도 reviewed 개발 profile/artifact 결정이며 frozen Guard에 자동 LOCAL_LEGACY 우회를 추가하지 않는다. production/strict 앱에 local owner fallback도 없다.

application config·환경·CLI override·secret mount에서 자기 서비스와 타서비스의 모든 *_MIGRATION_DB_USERNAME/PASSWORD, generic DB_USERNAME/PASSWORD의 owner fallback, spring.flyway URL/user/password/enable override와 bootstrap credential을 제거/거부한다. producer 프로세스만 migration secret bundle을 가진다. source files에 inert SQL이 남는 것과 앱 Flyway producer/owner endpoint factory를 배선하는 것은 구분하되, runtime artifact에는 execution bean/factory가 없음을 실제 검사한다. approved startup policy에 migration principal의 이름이 provenance field로 나타나는 것은 password/connection authority를 소유하는 것이 아니다.

Time·Payroll·Notification의 현재 Hikari auto-commit=false는 [RuntimeOnlyStartupGuard](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/RuntimeOnlyStartupGuard.java:143)와 inspector의 required autoCommit=true에 맞지 않는다. strict runtime pool은 true로 바꾸고 Spring transaction manager/JPA provider의 begin/commit/rollback 동작을 실제 테스트한다. inspector가 false를 허용하거나 검사를 위해 posture를 위장하도록 바꾸지 않는다.

RuntimeStartupInfrastructure는 datasource 객체의 lazy registry만 받고, JPA EntityManagerFactory·repository 첫 접근·ApplicationRunner/local pilot seed·scheduler·Kafka/relay·HTTP business readiness보다 먼저 admission을 완료한다. BeanFactory dependency와 auto-config ordering을 실제 context 테스트로 증명한다. SmartLifecycle/HTTP ready flag 하나만 늦게 설정하여 earlier runner의 DML을 허용하는 방식은 부족하다. active pool의 무인자 Hikari lazy 구성과 minimumIdle=0 등으로 barrier 이전 eager connection도 검증한다.

## 4. 독립 기대값·runtime registry·Provider catalog reader

외부 정책은 source revision40뿐 아니라 실제 sourceArtifactSha256, manifestSha256, controlReceiptSha256, 현재 확장 Control reference, deployment/instance/challenge/epoch/keyRevision, exact stream evidence 및 compiler version/policy를 별도로 pin한다. seal 문서에서 가져온 key나 현재 DB에서 계산한 hash를 expected로 자기 승인하지 않는다. 새로운 source/native fingerprint 로직 및 앱 artifact가 바뀌면 reference·immutable policy approval·signature 증거도 갱신한다. 기존 521 Git inventory와 새 미커밋 후보 binary를 혼동하지 않는다.

현재 [JdbcRuntimePoolInspectionV1](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/JdbcRuntimePoolInspectionV1.java)는 trusted qualifier/DataSource instance/opaque endpoint/native server/database와 independently approved materialized-history inventory를 읽는다. [PrivilegeSurfaceCompilerV1](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/PrivilegeSurfaceCompilerV1.java)의 VERSION은 DWP_RUNTIME_PRIVILEGE_SURFACE_V1이다. 외부 producer도 같은 compiler를 사용하여 live actual을 독립 승인 정책과 비교한다. bootstrap의 새 실제 object/surface를 발견했다는 이유만으로 새로운 expected hash를 발급하지 않는다. 실제 initial approval/cutover는 reviewed source/config policy와 external deployment authority의 책임이다.

실제 runtime 쿼리는 native catalog만이다. history rows SELECT·DDL·GRANT·SET ROLE·owner pool은 inspector에 없다. 모든 approved current-catalog histories에 runtime/group effective column/table ALL 권한이 없어야 한다. routine exact ABI/body/config/ACL/default PUBLIC, table·sequence·column·type·default ACL/grant option·reachable role 표면을 compiler hash로 결속한다. full native history·DDL/definition/ownership/provenance는 외부 producer가 기존 inventory/fingerprint 경로로 검증한다. 새 compiler 한 개를 모든 CHECK/default/RLS/trigger 의미의 완전 DDL hash라고 과장하지 않는다.

Notification 정상 managed api/worker/audit는 NOLOGIN이고 정확한 grantor/admin=false/inherit=false/set=true 및 승인된 object ACL을 갖는다. inspector가 이 도달 표면을 hash하면서 privileged attributes/DDL/ownership/history/foreign CONNECT를 거부하도록 유지한다. 정상 group을 무조건 elevated로 거부하거나 future Insights의 role 분리를 Notification의 합법적인 scoped transaction role 모델에 무차별 적용하지 않는다. Inspector 자체는 SET ROLE을 하지 않는다.

Provider의 [ProviderMetadataDatabaseConfiguration](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-provider-server/src/main/java/com/dwp/services/provider/config/ProviderMetadataDatabaseConfiguration.java:30)는 main MigrationInfrastructure와 spring.flyway.user에 의존한다. current4 reader는 각각 Auth/People/Platform/self catalog의 dedicated role이며 readOnly·pg_catalog path·exact-one catalog CONNECT·domain table/routine/history/DDL 금지를 유지한다. 현재 source4 validation/connection은 unconditional이다. metadata discovery를 optional로 만들려면 별도 명시적 enablement/source-set 계약을 검토하며, required enabled source를 슬쩍 제외하거나 무관한 optional capability를 강제 설치하지 않는다.

중요 OPEN: 현재 sealed RuntimePurpose에는 METADATA_CATALOG_READ가 없고 runtime database/schema가 covered own-stream에 결속된다. Provider foreign4 pool은 이 계약으로 정상 표현할 수 없다. PRIMARY로 위장하거나 pool registry 밖에 숨겨 8서비스 완료라고 금지한다. versioned metadata catalog-read proof/purpose 및 owner/source catalog bindings를 먼저 설계·독립 검토해야 한다. metadata readers는 추가 migration stream이 아니며 runtime app이 source migration DS를 받아서는 안 된다. 기존 ReadOnlyMetadataDatabaseGuard를 유지하는 것만으로 signed exact surface/freshness 결속 완료라고 주장하지 않는다.

## 5. 외부 producer와 실제 fence의 연결 순서

현재 [MigrationControlMain](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-migration-control/src/main/java/com/dwp/migration/control/MigrationControlMain.java:38)는 session advisory fence→preflight→offline credential/CONNECT rotation→migration/adoption→TEMP revoke→service credential/CONNECT restore→scalar receipt stdout를 수행한다. [DatabaseConnectionFence](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-migration-control/src/main/java/com/dwp/migration/control/DatabaseConnectionFence.java)는 every non-Control current-catalog session offline와 exact ACL을 검사한다. 정상 Control 경로의 offline fence이지 privileged DBA/host compromise 방어라고 주장하지 않는다.

[ControlStartupLeaseAuthorityV1](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-migration-control/src/main/java/com/dwp/migration/control/startup/v1/ControlStartupLeaseAuthorityV1.java)는 separate constructor-bound Control catalog의 SQL schema dwp_deployment_startup.current_deployments/startup_permits/startup_leases를 읽는다. reserve/activate/current/release와 beginDrain은 durable deployment row lock으로 직렬화한다. permit/DDL/provision은 생성하지 않고 authenticated invocation/independent key를 요구한다. [Signer](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-migration-control/src/main/java/com/dwp/migration/control/startup/v1/ControlStartupLeaseSignerV1.java)는 lease를 서명하지만 native approval·startup seal 생산자가 아니다. Main/transport/offline proof/publication/renewal 통합은 현재 OPEN이다.

다음 source 분담은 external package com.dwp.migration.control.startup.v1의 신규 ControlRuntimeStartupSealProducerV1, ControlStartupMigrationFenceCoordinatorV1, authenticated transport와 별도 reviewed Control-owned ledger bootstrap다. 기존 dwp_migration_control exact object set를 임의 변경하지 않는다. schema 이름은 과거 prose의 dwp_deployment_control과 현재 source의 dwp_deployment_startup 사이에서 exact DDL/owner/catalog 승인으로 확정한다. runtime/migration에 이 ledger의 USAGE/DML/access를 주지 않는다.

추가 실제 제약: 기존 ACTIVE native fence는 rotated runtime credential에도 CONNECT를 거부하므로 그 상태에서 runtime-login compiler를 실행할 수 없다. migration login을 SET ROLE로 위장하여 대체하지 않는다. producer에는 별도 reviewed 검사 전이가 필요하다. durable DRAINING·exclusive native lock을 유지하고 old app credential 무효/서비스 offline을 확인한 상태에서 Control만 아는 rotated runtime credential의 정확한 단기 probe를 허용하고, catalog-only 검사 후 probe close·CONNECT 회수·non-Control session0을 재검증한다. 기존 ACTIVE=runtime CONNECT denied invariant를 몰래 완화하지 않고 새 전이의 exact ACL/credential/session 허용 집합·failure fence를 별도 계약/PG test로 정의한다. 이 전이는 현재 미구현 P0이고 정상 앱 credential restore나 SERVING 이전에 검사를 완료해야 한다.

1. Migration 요청은 현재 deployment epoch를 expected CAS로 DRAINING으로 전진·permit revoke를 durable commit한다. beginDrain 성공은 offline acknowledgement가 아니다.
2. 앱 readiness/request/task gate를 닫고 active lease revoke/expiry를 확인한다. runtime·metadata의 실제 service sessions 모두 offline, 새 CONNECT 불가 및 owner-only temporary rotated credential 상태를 기존 native fence로 검증한다. 임의 foreign 서버/container/session을 종료하거나 timeout을 늘려 강행하지 않는다.
3. 같은 정상 authority 경로에서 exclusive native advisory fence를 유지한 채 checksum/current-source/pending/history full COUNT/MAX·성공·installed_by와 inventory/definition/ACL/owner를 검사하고 reviewed native/adopted migration을 수행한다. TEMP 및 Notification exact privileged window는 기존 bounded finally/recovery를 보존한다.
4. 최종 hardening/full verification/immutable native or adoption receipt를 완료한다. legacy boundary 이후는 current migration principal만 허용하고 과거 installed_by/checksum/time/rank는 보존한다. 기존 receipt 없는 legacy를 fresh라고 암묵 재봉인하지 않는다.
5. native fence와 durable deployment epoch 사이의 coordinator를 통해 sealed expected artifact/policy와 actual을 exact 비교한다. 새 signed seal·permit 승인 레코드와 external publication 결과를 결속한다. 다른 catalog에서 atomic SQL transaction이 된다고 주장하지 않으며 중간 crash는 DRAINING/permit unavailable로 남아 explicit recovery한다.
6. 앱 reserve→native runtime inspection→activate 후에만 startup barrier를 연다. inspection 동안 drain이 먼저 commit되면 activation은 새 epoch/fence 때문에 거부된다. 검사 이후 DDL이 과거 permit으로 승인되지 않도록 migration 경로 자체가 broker drain/offline/native fence를 의무 사용해야 한다.
7. 정상 서비스 자격증명 restore/publication과 SERVING 전환의 정확한 순서를 coordinator 테스트로 증명한다. scalar Main은 현재 restore-before-stdout이므로 단순 뒤에 seal 출력만 붙이는 구현은 이 새 protocol의 증거가 아니다. intermediate publication failure는 준비 상태를 열지 않는다.

CURRENT는 lease expiry를 연장하지 않는다. 장시간 서비스에는 별도 reviewed renewal protocol 또는 새 bounded approval가 필요하며 activate/current 재사용으로 TTL를 암묵 늘리지 않는다. 현재 lease만 조회할 수 없으면 readiness·request·task admission을 fail closed한다. expired/old epoch의 이미 수행 중인 요청을 소급 취소했다는 주장도 하지 않고 drain completion/offline proof를 따로 확인한다. startup snapshot은 연속 drift 검증이 아니다.

## 6. 단계·writer·검증 할당

| 순서 | source writer 경계(합의 전 구현 금지) | 선행·구체 완료 증거 |
| --- | --- | --- |
| P1 | core shared contracts/policy + external producer DTO 소비 | separate9/13 anchor, metadata reader proof, composite empty/adopted successor; typed provider/consumer compile + mutation |
| P2 | external Control startup package/ledger/transport/coordinator | P1; source/artifact approved permit, Ed25519, actual PG16/18 native race/crash/offline negatives |
| P3 | 8 module YAML + 각 RuntimeOnlyStartupConfiguration, existing migration bean 분기 | P2; 한 app slice 후8서비스 전개, Flyway/owner bean0, credential0, proper barrier, direct artifact denial/restart |
| P4 | reviewed optional13 Control bootstrap + Auth/Platform private adapters/pools | P3 + exact successor reservation; active empty schema/history/owner/role/native proof, private purpose separation |
| P5 | independent root/Mendel 검증·activation register 후속 | actual fresh evidence; author 숫자 PASS로 승인 금지 |

Core proposed tests: RuntimeOnlyApplicationRegistryContractTest, RuntimeMetadataCatalogReadEvidenceV1Test, RuntimeStartupLeaseAdmissionLifecycleTest. Control proposed tests: ControlRuntimeStartupSealProducerV1PostgresTest, ControlStartupMigrationFenceIntegrationV1PostgresTest. 각 모듈의 표에 있는 runtime-only context/native tests는 아직 새 구현·작성 전이다. 기존 migration tests를 없애어 검증 수를 맞추지 않으며 external Control parity/history/provenance 회귀로 보존한다.

필수 음성: missing/unsigned/wrong-key/revoked-key/stale-source/artifact/Control/epoch/lease/future/expired seal, same-consistent wrong PostgreSQL version, higher forged history rank/count, rogue owner object 및 same-object body/ACL/definition drift, runtime/group history/DDL/foreign catalog/purpose drift, alias/reused instance/endpoint mismatch, Provider metadata forbidden table/routine access, disabled optional0 constructed pools/0 getConnection/0 queries, enabled required missing reject, pending 결과에 success artifact 금지, native-inspection→drain→activate race, restore/publication crash 및 old permit replay. 실제 schema fingerprint 보장 항목에 대응되는 attack을 실행하고 compiler 하나만 검사하여 모든 정의 공격을 닫았다고 부르지 않는다.

배포/devctl writer는 scripts/devctl.py의 service_environment/Control secret bundle을 분리한다. 현재 자기 서비스 migration credential은 남고 타서비스만 prune한다. prospective signed seal/policy/authority transport 설정은 별도 independent approved deployment file/endpoint registry에서 온다. authority URL/key/approval를 seal JSON 자체가 만들지 않는다. 환경 생성 함수를 실제 실행해 password를 출력하지 않는다.

호스트 semaphore를 실제 독점하여 unit→PG16→PG18→8 serial app pilots 순으로 실행하고 fresh XML/source/ns/argv/UTC/elapsed/owned cleanup IDs를 보존한다. memory doctor FAIL은 우회하지 않는다. 광범위 합산/timeout 재사용/shape-only checks로 G3를 닫지 않는다.

## 7. 활성13과 optional zero-open

현재 nine base는 separate scalar policy로 보존한다. 후속13 distinct contract로 cutover하려면 People alias를 포함한 ownership/role/pool/native+adoption bootstrap가 reviewed prerequisite다. private4를 기존 scalar receipt나 primary credential로 승인하지 않는다.

Analytics/AI만 활성화하면 configuration+insights(query/write)가 필요하고 listening/issuer는 요구하지 않는다. listening 활성화 시 configuration+protected+issuer+insights를 paired로 요구한다. disabled stream은 등록 label만 있고 실제 role/DS construction·connection·schema/history probe가 0이어야 한다. enabled required schema/role/source/proof가 없으면 configuration-required/unavailable로 닫히며 primary fallback·ordinary RLS SET ROLE·raw protected SELECT·cross-schema FK로 대체하지 않는다. Insights query는 SELECT-only RO와 execution writer 별도 LOGIN/qualifier이고 protected/issuer와 role membership이 없다.

G3의 범위는 exact 계획·공유 DTO/SPI/guards/fail-closed adapter·current common runtime·승인된 활성 empty supplemental scaffold 검증이다. 85 PER/82 HRM/46 SYS/TIM 또는 후속 domain 전체 CRUD 및 실제 사용자 수용 실행은 G4다. 고객 신원 authority/adoption/live country/provider와 production isolation 승인은 G6다. 아직 optional13 producer/wiring/bootstrap가 구현되지 않은 사실은 G3 준비 OPEN으로 명시하지만 전체 G4 업무 구현을 선행 요구하는 순환 조건은 두지 않는다.

## 8. 다음 승인 요청과 잔여 OPEN

Root가 이 노트를 검토한 뒤 첫 구현 승계는 P1 계약 격차(Provider metadata/empty adopted composite/explicit9 alias policy)와 P2 external producer/fence를 개별 writer로 분할하는 것이다. P3 앱 source writer는 승인된 immutable policy/transport/native producer가 있을 때 배정한다. clock-entry 수리 이외 이번 노트의 생산 변경·8배선·13bootstrap는 0이다.

동반 JSON의 RW-P0-01..09는 전부 OPEN_NOT_IMPLEMENTED 또는 REGISTERED_NOT_IMPLEMENTED다. 현재 signed Guard/inspector의 bounded source/test 준비, 독립 Clock29 PASS와 이 설계안을 runtime-only 전체 완성으로 바꾸지 않는다. NO_G3_START, G4未実行, G6未授权 및 기존 역사적 정책/원본/보고서 불변을 유지한다.
