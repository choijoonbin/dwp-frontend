# P2 외부 Control INSPECTION·own/metadata 게시 최소 연결 지시안

상태: DESIGN_PROPOSED_SOURCE_BASED_NOT_INDEPENDENT_APPROVAL / NO_G3_START. 이 문서는 [v1](runtime-only-wiring-producer-implementation-plan.v1.md)의 후속 입력이다. 이번 작업은 새 설계 JSON/MD 두 개만 저장한다. 생산 소스·SQL·Control Main·8서비스·정본·Gate 변경은 0이며 다음 파일 소유권 승인 전 구현하지 않는다. [동반 JSON](runtime-only-wiring-producer-implementation-plan.v2.json)은 61개 실제 소스의 SHA-256/decimal ns, 정확한 제안 파일·단계·DTO·ledger 필드·반례를 보존한다. working-tree 소스 snapshot은 승인된 배포 binary가 아니다.

## 1. 실제 준비 상태와 범위

현재 Phase-A 계약/검증과 Phase-B metadata 검사 준비 코드는 존재하지만 Spring·external transport·Control producer와 연결되지 않았다. Phase-B [작성자 증거](../reports/runtime-authority-rw-p1-phase-b-author-evidence-2026-09-14.md)는 최종51 unit +40 native unique, PG16/18 같은40을 각각 실행한131 engine invocations다. 실제 JDBC metadata4 검사와 실제 Ed25519를 MOCK own/current issuer와 조합한 경계이며 실제 production epoch/fence/게시자 PASS가 아니다. 기존 Root241/Phase-A129/native93/timeout을 더해 current whole PASS로 만들지 않는다.

Phase-B4는 Inspector af260423… / Guard 2282e2d6… / unit c597e2fa… / PG 2c98d096…로 FROZEN이다. 두 시간타입 수리 및 복원/abort 조건은 이 버전에 있다. 기존 scalar/Composite/v1 JSON/parser/Guard/registry와 8서비스/build/역사 SQL은 이 설계가 수정하지 않는다. Root 독립91+People112 실행/승인은 별도다.

현재 실제 Control은 8서비스/9스트림/8runtime binding/8migration LOGIN이다. People의 public + hris_performance는 동일 승인 principal/pool을 공유한다. 현재 Payroll은 public/payroll-main이다. 등록된 future13/14purpose/별도 People role은 미배선·미활성이며 이9를 이름만 바꿔13 native-ready라고 하지 않는다.

Provider metadata4는 migration stream이 아니다. auth / people / platform / provider 각각의 source owner DB에서 dwp_provider_metadata_auth / people / platform / self가 CONNECT fence된다. suffix도 자기 Provider와 정확히 같다. frozen metadata 계약은 scalar-nine만 지원한다. 향후 private4 active history가 있는 topology에는 새 검토된 source-policy successor가 필요하며 기존 reader를 PRIMARY로 위장하지 않는다.

## 2. 실제 소스에서 확인한 연결 제약

[MigrationControlMain](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-migration-control/src/main/java/com/dwp/migration/control/MigrationControlMain.java:38)은 native advisory lock → preflight → credential/CONNECT fence → migration/adoption → TEMP revoke → service restore → scalar stdout다. 생산자 출력을 뒤에 한 줄 붙이면 restore 이후 unfenced 상태의 서명으로 끝나므로 충분하지 않다. 승인된 hook은 lock을 계속 보유한 채 restore 이전에 검사·staging을 수행하고, 전체 게시 완료 후에만 외부 SERVING/permit을 연다.

[DatabaseConnectionFence](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-migration-control/src/main/java/com/dwp/migration/control/DatabaseConnectionFence.java:14)의 ACTIVE는 migration CONNECT만이다. [DatabaseControl](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-migration-control/src/main/java/com/dwp/migration/control/DatabaseControl.java:70)은 원래 runtime/migration 비밀번호를 무효화하고 private runtime 비밀번호조차42501로 거부한다. 이 ACTIVE invariant는 그대로 보존한다. runtime 검사를 위한 별도 INSPECTION이 필요하다.

현재 metadata는 CONNECT를 회수하지만 비밀번호를 rotate하지 않는다. INSPECTION에서 기존 비밀번호를 둔 채 metadata CONNECT를 잠시 부여하면 이전 앱도 접속할 수 있다. selected metadata도 Control-private 임시 비밀번호로 먼저 rotate해야 한다. 임시 비밀번호를 signed DTO/log/stdout/앱 환경으로 내보내지 않는다.

[ControlStartupLeaseAuthorityV1](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-migration-control/src/main/java/com/dwp/migration/control/startup/v1/ControlStartupLeaseAuthorityV1.java:87)의 current는 consumer deployment/permit/lease만 lock한다. foreign Auth/People/Platform source epoch와 원자적으로 묶지 못한다. Provider own ACTIVE를 full metadata 권한으로 사용하지 않는다. 현재 core CurrentRequest는 nonce/ownLeaseDocumentSha/각 source evidence·정책을 서명하지만 원격 resource epoch를 inline field로 갖지 않는다. external immutable manifest/source ledger가 그 슬롯에 정확한 원격 epoch/native snapshot을 binding하고 current issuer가 모두 확인해야 한다.

추가 source-only open: [Main.runAdoption](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-migration-control/src/main/java/com/dwp/migration/control/MigrationControlMain.java:280)은 ACTIVE 뒤 legacyBoundary를 다시 부른다. [AdoptionSealer](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-migration-control/src/main/java/com/dwp/migration/control/AdoptionSealer.java:45)의 existing-receipt branch는 direct runtime DS를 열어 MigrationAdoptionGuard.verifyControlPrincipal(runtime)을 실행한다. ACTIVE CONNECT deny와 충돌한다. 아직 이 문서에서 native 재현하지 않았다. BASELINE lock 보유 preflight에서 verified boundary/predecessor를 typed private proof로 보존하고 ACTIVE에서는 owner-only 원본 receipt/history를 다시 대조하는 bridge를 검토해야 한다. CONNECT/SET ROLE/legacy boundary 완화로 해결하지 않는다. 실제 adopted restart 회귀는 필수다.

## 3. 첫 실제 구현: P2-A native INSPECTION bridge

첫 승인 요청은 신규 same-package ControlInspectionFenceBridgeV1 + 실제 PG test와 명시적으로 검토된 Fence/Main hook이다. 기존 package-private DatabaseControl의 정상 fence를 사용하고 새 후보만 쌓아두지 않는다. core frozen 클래스의 리팩터/입력완화는 없다.

| native phase | exact CONNECT·credentials | session 요구 |
| --- | --- | --- |
| BASELINE | 현재 approved runtime/migration/local metadata + bootstrap owner, PUBLIC/unknown/grantoption 없음 | Control fence PID 외 모두0; preflight direct role 검사 세션도 닫힘 |
| ACTIVE | 기존 그대로 migration-only + bootstrap owner. private runtime도42501 | 실제 migration 작업 세션만 bounded owner 작업에서 열고 검사 전 모두 닫음 |
| INSPECTION | migration CONNECT 회수; selected original runtime **또는** metadata 한 LOGIN에만 CONNECT. 해당 role은 private rotated secret | 보유 Control fence PID + 현재 exact probe PID만. 다른 principal/PID는0 |
| ACTIVE 복귀 | probe CONNECT 회수·private secret 무효화 후 migration-only | probe 복원/close/abort 확인, foreign session0 |
| FAILED | bootstrap owner만; runtime/migration/metadata 모두 CONNECT deny, credentials invalid | 복구 작업이 정상 native fence를 다시 얻기 전 readiness/permit0 |
| RESTORED | 현재 expected service CONNECT를 복원, PUBLIC deny; 임시 secret 무효 | 외부 gate는 아직닫힘, all-serving 게시 전 relaunch0 |

PID 예외는 특정 run/phase/직접 인증된 backend identity에만 적용한다. "runtime principal이면 모든 session 허용"은 금지한다. 검사 자신은 SET ROLE·history row SELECT·DDL·grant를 하지 않는다. public policy/current bool을 받아 offline proof를 만들지 않는다.

Native lock key는 현행 dwp-migration-control:<database>:<service>를 유지한다. endpoint/catalog/service가 외부 승인 tuple과 맞아야 하며 native pg_catalog.hashtextextended/pg_try_advisory_lock를 사용한다. 동일 Platform catalog의 여러 schema를 서로 독립 native lock이라고 계산하지 않는다.

Core 원래 pool inspector와 metadata inspector를 직접 호출하되 approved registry qualifier/DS object/native endpoint/history policy/privilegeSurfaceSha와 실제 관측을 비교한다. DS는 외부 Control-private 연결 구성만 있고 앱에 owner factory를 넘기지 않는다. JDBC readOnly를 검사 과정에서 true로 바꿔 proof를 만들지 않는다.

Frozen compiler는 target-role effective DB CONNECT와 native OID 및 raw schema/relation/column/sequence/routine/type/default ACL을 hash한다. INSPECTION은 비밀번호/CONNECT만 바꾸며 schema ACL·role search_path/config·connlimit·rolvaliduntil·body는 바꾸지 않는다. 따라서 selected target의 approved restored-state surface와 exact 비교할 수 있다. 실제 native test로 이를 확인한다. 새로운 DB의 OID/hash가 다르면 signer가 실제 capture를 자동 expected로 채우지 않고 독립 target-specific 승인 절차로 닫힌다.

Notification 정상 managed NOLOGIN api/worker/audit membership/ACL 표면은 그대로 검사한다. group을 무조건 elevated로 거부하지 않으며 owner/history/CREATE/TEMP/foreign CONNECT/임의 grantor·options를 허용하지 않는다.

## 4. resource epoch: metadata4가 같은 시간의 권한인지 검증

Durable resource는 endpoint/catalog의 native fence domain이다. stream13이 resource13이라는 뜻이 아니다. Metadata4 첫 게시에는 active4 source resource/native lock을 결정적 순서로 잡아야 한다. 최초 scalar9 CompositeV2를 만드는 경우에는 all8 catalog/all9 history의 native bootstrap 승인 증거를 확보한다. 기존 approved unchanged resource vector가 있을 때만 그 snapshot을 exact predecessor와 현재 source epoch로 확인하여 후속 합성이 가능하다. 빠진 source를 dummy/count-only receipt로 채우지 않는다.

동일 external Control ledger transaction에서 lock 순서는 resource(endpoint/catalog 순) → affected consumer deployment(service/deployment 순) → permit → lease다. migration drain도 current/reserve/activate도 이 순서를 사용한다. source drain은 그 source를 참조하는 publication/permit을 함께 revoke하고 consumer epoch를 전진시킨다. existing own V1 deployment-only lock을 먼저 확인한 다음 별도 transaction에서 foreign epoch를 확인하는 wrapper는 TOCTOU를 남긴다.

따라서 별도 ControlStartupLeaseAuthorityV2가 frozen own RuntimeStartupFreshnessPort와 metadata CurrentIssuerPort를 구현하되, source resource + consumer deployment + permit + lease를 **같은 Connection/transaction**에서 검증한다. 기존 V1을 source-precheck 후 독립 execute에 delegate하지 않는다. V1 source는 보존하고 동일 auth·phase·clock·persisted-time·no-renew 조건을 successor에 회귀 배정한다.

Frozen metadata Slot.policy.source에는 원격 epoch가 inline로 없으므로 immutable pre-sign manifest에 resourceId/epoch/approvalId/sourceControl/sourceArtifact/staged-manifest/native snapshot/historyPolicy/compiler surface/endpoint를 등록한다. evidenceSha와 exact policy는 publication_sources의 immutable row를 통해 그 vector에만 resolve된다. 요청 JSON의 값이 typed라는 이유만으로 권한 근거가 되지 않는다. current issuer는 승인된 publication row를 조회해 소비자 own lease와 every remote current generation을 확인한다. 이 explicit binding이 없으면 signed response를 내지 않는다. 이후 inline self-contained epoch가 필요하면 V2 evidence 설계/검토를 하며 frozen v1의 hidden 기능이라고 하지 않는다.

## 5. 게시 문서와 hash 순서: 자기승인·순환결속 금지

1. 독립 deployment approval은 exact committed source/artifact/per-file manifest, current Control/core compiler reference, source/native proof, registry/roles/qualifiers/posture, active source vector, key/epoch/instance/challenge/time를 제공한다. caller seal/current DB capture에서 expected를 발견하지 않는다.
2. **pre-sign manifest**를 정적 승인 tuple + immutable resource/native source vector로 계산한다. 아직 own seal SHA나 metadata signed document SHA를 넣지 않는다. 그렇지 않으면 manifest → own seal → metadata → manifest의 hash cycle이 생긴다.
3. exact all9 CompositeAuthorityReceiptV2를 owner-only proof로 구성한다. own seal의 controlReceiptSha256은 이 프로토콜에서 exact CompositeV2 digest이며 옛 scalar ControlRunReceipt SHA는 별도 필드로 보존한다. 두 digest namespace를 임의로 교체하지 않는다.
4. own claims(manifest/Composite/provenance/runtime policy/permit/time)를 승인 tuple과 대조해 서명 → own SHA.
5. metadata claims(manifest + own SHA + exact source expected policy)를 서명 → 각 evidence SHA.
6. publication row가 생성된 own/metadata exact bytes + source binding vector를 보존한다. signed outputs를 역으로 manifest에 넣지 않는다.
7. current는 매번 새 nonce + actual signed ACTIVE own lease document SHA + ordered exact evidence/policy slot을 별도 namespace로 서명한다. 캐시된 own lease 문서나 current=true는 대체물이 아니다.

서명 domain은 frozen code와 동일하다.

| 문서 | claims signature domain | document digest domain |
| --- | --- | --- |
| own seal | dwp-runtime-stream-startup-seal-claims-v1 + LF | dwp-runtime-stream-startup-seal-v1 + LF |
| own lease | dwp-runtime-startup-lease-claims-v1 + LF | metadata current 요청의 own doc은 dwp-runtime-own-active-lease-document-v1 + LF |
| metadata evidence | dwp-runtime-metadata-catalog-read-claims-v1 + LF | dwp-runtime-metadata-catalog-read-evidence-v1 + LF |
| metadata current | dwp-runtime-metadata-freshness-claims-v1 + LF | dwp-runtime-metadata-freshness-document-v1 + LF |

서명키는 external signer에만 있고 public key/revision은 별도 deployment anchor/ledger에 승인된다. keypair 잘못됨/revoked/unknown/domain/purpose/source mismatch는 거부한다. JSON은 각각 frozen closed parser의 unknown/dup/coerce/trailing/oversize/byte-canonical 검사를 거친다. clock/provider/driver/key 예외는 일반 no-cause 오류이고 secret/body/plaintext를 출력하지 않는다.

## 6. native/adopted/empty producer의 실제 검증

DTO constructor·count≥filecount·digest 자기일치만으로 native proof라고 하지 않는다. owner만 전체 history rows를 읽고 전체 COUNT/MAX·success·version/script/type/checksum·installed_by/installed_on/execution_time·정확한 현재 source closure/Flyway validate·pending0를 검증한다. higher-rank forged row를 expected max 이하만 읽어 놓치지 않는다. engine version은 live native 값과 exact 비교한다.

Native는 legacy row가 없고 history relation/OID/definition을 실제 확인한다. 빈 People performance는 실제 materialized hris_performance.flyway_performance_schema_history와 genuine empty resolved staged source inventory가 모두 있어야 한다. fake V1/no-op/history repair로 수량을 맞추지 않는다. core classpath의 R__create_domain_event_delivery_ledger.sql 등 실제 실행 resource도 per-file artifact closure에 포함하며 원래 target worktree fileTree와 같은 값이라는 이유로 승인하지 않는다.

Adopted는 원본 full v2 receipt와 외부 이전 SHA/Control ref·이전 run/composite predecessor를 보존하고 DB receipt/inventory/전체 history를 대조한다. sealed legacyBoundary는 후속 run에서 늘리지 않는다. boundary 후 신규 행은 migration LOGIN이고 old installed_by/checksum/time/rank는 수정하지 않는다. runtime app/metadata는 history row 권한이0이며 이 전체 검증을 수행하지 않는다.

현재 inventory/definition/ACL fingerprint의 실제 보장에 대응되는 same-object/body/ACL/RLS/default/trigger/extension/DB-scoped attack 회귀를 배정한다. privilege compiler 하나를 모든 DDL 의미의 완전 fingerprint로 과장하지 않는다. legacy/adoption current-restart source 충돌은 별도 actual native 실패→같은기대수리→PASS를 보존한다.

## 7. 외부 ledger·SQL/ACL 소유 경계

현재 V1은 별도 trusted Control catalog 안의 SQL schema dwp_deployment_startup.current_deployments/startup_permits/startup_leases를 사용하며 actual bootstrap은 fixture만 있다. 옛 문서 dwp_deployment_control 이름이나 application DB fallback을 exact provision으로 간주하지 않는다.

새 ledger는 additive external bootstrap artifact 002_runtime_publication_ledger.v1.sql이며 Control src/main/resources/서비스 Flyway 밖에 둔다. app dwp_migration_control exact5 object set는 바꾸지 않는다. Auth/People/Platform business migration 번호도 소비하지 않는다. 동반 JSON에 신규4 table의 정확한 column·PK·UK·FK·CHECK·불변성 입력이 있다.

| 신규 table | 최소 책임 |
| --- | --- |
| startup_resources | endpoint/catalog UK, monotonic resource epoch/key/phase, current approved source snapshot |
| resource_approvals | immutable target epoch/source/native/history/compiler 승인 snapshot, resource+epoch+approval tuple UK |
| startup_publications | operation/request idempotency, consumer instance/epoch/permit exact, pre-sign manifest/Composite/own bytes, STAGED/CURRENT/REVOKED |
| publication_sources | publication+source PK; resource+epoch+approval 복합 FK, exact endpoint/policy/evidence bytes |

Existing permit와 새 publication의 exact FK/immutable binding adapter는 별도 additive reviewed bootstrap가 필요하다. 단순 caller digest/legacy V1 table count로 접근을 승인하지 않는다. owner/native PK/UK/FK/check/ACL drift는 IF NOT EXISTS로 덮지 않고 fail-closed다. runtime/migration/metadata는 이 external catalog CONNECT·schema USAGE/DML0다. trusted external bootstrap/publisher/current issuer도 독립 purpose별 최소 grants를 갖고 현재 V1 issuer가 임의 permit INSERT/rebind할 수 없다는 회귀를 보존한다. 서명키 보유와 DB grantee 권한은 서로 다른 승인이다.

여러 app catalog의 credential/CONNECT 전환과 external ledger commit은 하나의 SQL transaction이 아니다. durable DRAINING + operationId + per-resource exact native ack/승인 snapshot으로 unavailable를 유지한다. 재시작 시 old row가 native lock/session proof를 대신하지 않으며 lock을 다시 얻어 revalidate한다.

## 8. exact source 변경 순서와 반례

| chunk | 실제 source 승계·완료 증거 |
| --- | --- |
| P2-A | 신규 ControlInspectionFenceBridgeV1.java / ControlInspectionFenceBridgeV1PostgresTest.java + 승인된 DatabaseConnectionFence/Main hook. ACTIVE 불변, metadata password rotate, original login 검사·probe 종료를 actual PG16/18로 검증 |
| P2-B | 신규 external Publication DTO/Ledger/Producer/Signer/LeaseAuthorityV2 + external artifact/test. actual same-transaction resource vector/current/drain + own/metadata 서명·immutable source proof |
| P2-C | 독립 인증 protocol 승인 후 실제 external transport + trusted launcher 한 경로. Main이 drain/inspection/게시를 우회하지 않고 동일 승인 결과를 guard가 소비 |
| P3 | 각8서비스 strict runtime-only YAML/Configuration + secret pruning. owner DS/Flyway/migration credential0, startup barrier 실제 배선 |
| P4 | 승인된 supplemental private4 empty scaffold/13stream14purpose/People distinct cutover. inactive0 opens, active missing reject, primary fallback0 |

P2-A/B의 exact Java/test/artifact 경로·역할·제안 argv는 JSON proposedFiles/verificationPlan이다. 기존 Main/Fence/Control writer 수정은 parent의 추가 소유권 승인 후만 수행한다. body source helper를 새로 추가해 미등록으로 남겨놓고 완료하지 않는다. 한 실제 external invocation이 기존 Main hook/ledger/서명/own+metadata current를 연결한 source/owned PG 증거가 P2-C 기준이다.

필수 실제 반례는 ACTIVE old credential28P01/private runtime42501 유지, INSPECTION original metadata password 거부·selected private login 성공, unknown CONNECT/PID/grantoption 실패, SET ROLE/RESET ROLE owner escape 실패, 모든 history read0 및 DDL/routine/column/default/type/PG18MAINTAIN drift, forged higher rank/wrong engine, native empty 위조/legacy boundary/predecessor mismatch, source Auth drain vs Provider current, reserve→inspect→drain→activate, lock 겹침, publication 단계별 crash/idempotency/recovery, expired initial proof를 later current로 부활, progressive clock/initialClock sentinel no-cause, malformed JSON/domain/key, disabled0 open/required missing0 open이다.

Same source row lock 직렬화에서 current-before-drain은 제한된 과거 snapshot을 얻을 수 있고 drain-before-current은 거부된다. post-inspection current가 새 epoch를 거부한다. 이미 읽거나 전송한 bytes를 소급 취소했다고 하지 않는다. lease CURRENT는 TTL를 연장하지 않는다. 계속 동작하는 request/task의 renewal/drain gate는 별도 실제 P3/production 작업이다.

Restore-before-SERVING 중에는 offline orchestrator/gate가 relaunch를 막고 old actual sessions0를 확인해야 한다. 기존 credential restore가 임의 old process/직접 JDBC 사용을 DB에서 magically 차단하는 것은 아니다. safe credential generation publication/P3 app gate가 별도 OPEN이다. 기존 앱은 migration credential을 아직 보유하므로 P2 단독을 production/G3 completion으로 승인하지 않는다.

## 9. 검증과 남은 승인

이번 문서 검사는 JSON parse·61 source SHA/ns·historical input pins·설계 참조/불변성·Phase-B4 유지뿐이다. P2 actual producer/SQL/transport/native integration test는 실행0이다. 향후 host semaphore를 peer freeze 뒤 실제 독점하여 unit→PG16→PG18.4 순차로 수행한다. fresh XML/cases/raw argv/UTC/elapsed/pre-post SHA+ns/첫 실제 FAIL/own-container exact cleanup를 보존하고 source/test/SCC 정책을 약화하지 않는다. 임의 timeout 증가/타인 container 종료/doctor 우회는 없다.

남은 P0는 INSPECTION/Main·metadata rotation/multi-source fence, native/adopted/empty full producer, independent approval+immutable publication, source-generation current/authenticated transport/key lifecycle, 실제8 runtime-only barrier/owner credential 제거, live renewal/offline/credential-generation 정책, active private13 bootstrap/People cutover다. source-observed adopted restart/definition guarantee 실제 반례는 P1/P0 exploitability 검증 OPEN이다. 이 노트만으로 닫힌 항목은 없다.

G3는 exact 설계/공유 DTO·SPI·failclosed adapter·current common runtime 및 승인된 active empty scaffold의 native 독립 증거다. 전체 HRM/PER/PAY/TIM/SYS business CRUD·실제 acceptance는 G4이며 그 전체 구현을 G3 선행으로 요구하지 않는다. 고객 country/adoption/liveauthority/production isolation은 G6다. 이 문서는 다음 공통 source 분담을 위한 DESIGN_PROPOSED이며 작성자 검사 또는 hash-only 증거는 독립 승인/activation이 아니다.
