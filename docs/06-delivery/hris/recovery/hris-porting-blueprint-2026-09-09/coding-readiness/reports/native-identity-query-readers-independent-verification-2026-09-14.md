# Native identity query readers 독립 집중 검증

상태: INDEPENDENT_BOUNDED_NATIVE_READER_VERIFICATION_PASS / G3_CLOSED / COMMON_P0_OPEN.

새 Auth·People reader에 대한 독립 테스트 79개가 실제 실행되어 통과했습니다. 44개 JDBC/입력 단위 반례와 35개 격리 PostgreSQL native 조회 사례이며, 실패·오류·skip은 모두 0입니다. 이것은 Auth→Gateway→People 전체 신원 검증이나 모듈 개발 Gate 승인이 아닙니다.

## 실제 실행

- UTC 2026-09-14T04:36:57.625203+00:00 → 2026-09-14T04:38:01.249264+00:00; 63.641513초, Gradle exit0, timeout 없음.
- 실행 HEAD db0d2b5067e6fbee27ee58121c5a4406cab132b9, Git tree 20f345a640b1d8238b9a2e709a060cc51df9b729. 승인된 새 공통 소스가 미커밋 상태인 dirty snapshot이며 HEAD/tree/status는 전후 동일합니다. clean HEAD 검증으로 표현하지 않습니다.
- 기존 host lock /Users/a10697/Work/DWP/.codex-worktrees/hris/.control-locks/hris-verification.lock, 최대 획득 대기30초, 실제 0.00001초; --no-daemon/--max-workers=1/--continue, 최대900초.
- 관련 소스·native SQL·테스트·빌드185개와 4개 XML의 정확한 SHA, decimal-string mtime ns 및 79개 실제 case ID는 [JSON 증거](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/native-identity-query-readers-independent-verification-2026-09-14.json)에 전부 저장했습니다. 소스185개의 pre/post SHA와 exact ns는 모두 동일합니다.
- 집중 입력4개 신규 테스트만 선택했습니다. 기존118개 native owner 테스트나 이전85개 ABI mock 실행은 새79개 증거로 재사용하지 않았습니다.

실행 argv:

```text
./gradlew :dwp-auth-server:test --tests com.dwp.services.auth.hris.identity.v1.AuthPersonBindingQueryReaderV1*Test :dwp-people-server:test --tests com.dwp.services.people.hris.identity.v1.NativeSelfContextQueryReaderV1*Test --no-daemon --max-workers=1 --continue
```

| 실제 suite | 개수 | 실패/오류/skip |
|---|---:|---:|
| AuthPersonBindingQueryReaderV1Test | 16 | 0/0/0 |
| AuthPersonBindingQueryReaderV1PostgresTest | 11 | 0/0/0 |
| NativeSelfContextQueryReaderV1Test | 28 | 0/0/0 |
| NativeSelfContextQueryReaderV1PostgresTest | 24 | 0/0/0 |
| 합계 | 79 | 0/0/0 |

## 실제 native 경계

Auth는 private disposable PostgreSQL에 기존 native 전체114개 마이그레이션(latest212)을 적용했습니다. 기존 com_users principal UUID/person UUID/native version/access_revision을 fresh SELECT로 읽고, 현재 binding·초기 version0·상태별 철회·revision 변경·null person·foreign tenant·relink mismatch·조회 중 lease 만료·SQL 오류 redaction을 검증했습니다. People 테이블이나 People DB에는 접속하지 않습니다.

People은 별도 private disposable PostgreSQL에 기존 V1..V48을 먼저 적용했습니다. 법인 기존 rows/내부ID/업무키/상태/version, 고용 부모 tuple/FK 정의, 이력 checksum/installed_by/success를 저장한 뒤 실제 source의 V49를 적용하여 그대로 유지됨을 확인했습니다. V49에서 기존 rows에 생성된 native opaque UUID 및 newrow default/not-null/global unique/tenant-local employer FK 거부를 실제 검증했습니다. 테스트 전용 가짜 컬럼·BIGINT→UUID 변환·employerKey hash는 없습니다. com_users/Auth DB에는 접속하지 않습니다.

두 runtime LOGIN은 owner와 분리된 NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE이며, 고정 native SELECT가 쓰는 정확한 컬럼의 SELECT만 owner fixture로 부여했습니다. 실제 runtime 연결에서 native INSERT/UPDATE/DELETE, public DDL, TEMP, Flyway 이력 SELECT, SET ROLE owner가 각각42501로 거부됩니다. role/password 설정·마이그레이션·synthetic row 변경은 owner 연결에서만 수행하며 runtime은 DDL/grant를 수행하지 않습니다. fixture password는 난수/메모리와 parameterized connection-local GUC로만 전달하며 저장·출력하지 않습니다.

각 DB는 Testcontainers가 이 테스트를 위해 소유한 PostgreSQL입니다. 실행 후 XML에서 식별한 정확한 PostgreSQL2개와 Ryuk2개 container ID를 read-only inspect하여 2026-09-14T04:40:16.348601+00:00에 모두 제거되었음을 확인했습니다. broad Docker stop/delete, 사용자 main DB/서버 변경은 수행하지 않았습니다.

## 실제 기능 반례

- 모든 worker·relationship·assignment 및 부모 UUID/native version0을 읽으며 primary/LIMIT1 기본 선택을 하지 않습니다. 2개의 실제 native 복수 고용은 SELECTION_REQUIRED, 명시 selector는 해당 업무 tuple만 SELECTED입니다.
- 업무 location의 명시 IANA zone에서 날짜를 계산하며 native end date는 inclusive입니다. 동/서반구 현지 날짜 및 다음 현지 자정 경계를 실제 검증했습니다.
- 같은 native assignment key·같은 시작일은 maximum sequence 정정만 사용합니다. latest correction이 종료시킨 slice를 옛 open slice로 대체하지 않습니다. 서로 다른 시작일의 겹치는 key는 전체 결과를 거부합니다.
- fresh 조회가 새 second assignment를 즉시 읽고, worker/person 부재·MERGED·null location/zone·invalid zone·잘못된 부모 UUID0/negative version을 허용하지 않습니다.
- 실제100개 complete assignment contexts는 사용 가능하고101개는 complete=false 및 OWNER_RESPONSE_INVALID로 거부합니다. truncation 뒤 임의 첫 assignment를 선택하지 않습니다.
- SQL 오류 및 malformed Java zone은 typed generic error/no cause이며 raw native ID·SQL/connection detail·원래 zone 문자열을 caller에게 전달하지 않습니다.

## 독립 발견 후 실제 보완

NIQR-F01(P0): 최초 reader SQL의 employer.public_id는 기존 People V1..V48에 없었습니다. 독립 source 대조로 작성자에게 전달했고 root가 검토된 실제 forward V49를 추가했습니다. 새35개 native 사례에는 실제48→49 업그레이드가 포함됩니다. pre-fix runtime FAIL을 실행한 것으로 기록하지 않습니다.

NIQR-F02(P1): Java invalid ZoneId는 원문 zone을 포함한 DateTimeException으로 탈출할 수 있었습니다. root가 typed OWNER_RESPONSE_INVALID 변환을 추가했고 현재 invalidNativeZoneHasTypedRedactedReaderError가 실제 실행되어 generic message/no cause를 확인합니다. PostgreSQL timezone(...) 자체 오류는 별도의 SQL error로 OWNER_UNAVAILABLE redaction을 확인했습니다.

## 남아 있는 경계

NIQR-O01(COMMON_P0_OPEN): location.time_zone을 native 효력일에 적용하는 것은 기존 owner 정책의 검증된 재사용 완료가 아니라 새 목적별 정책입니다. 기존 HrWorkerRepository는 CURRENT_DATE와 primary/LIMIT1, 기존 HrService/HrTimeRepository는 TIM schedule zone 및 missing/invalid UTC fallback을 사용합니다. 그 나쁜 fallback을 새 reader에 흡수하지 않았습니다. 그러나 nullable location/zone이나 고용 context 없는 직원의 SELF_PROFILE_READ도 현재 거부되므로, remote/no-location 회사가 TIM 설치 없이 자기 프로필을 읽을 People-owned date-zone 또는 별도 비고용 profile 계약은 아직 정의·배선되지 않았습니다.

NIQR-O02(COMMON_P0_OPEN): current APP entitlement/SoD/authority verifier와 반대 owner는 각 suite에서 EXPLICIT MOCK입니다. public raw DTO나 기존 version0만으로 signed/current owner proof가 되지 않습니다. 실제 Auth endpoint/verified transport, relink native producer의 보수적 version ordering, revoke fencing, current-proof freshness, runtime DataSource qualifier/login admission, production registration, Auth→Gateway EE는 이79개 테스트로 구현·승인되지 않습니다. reader DataSource constructor 자체를 임의 endpoint 승인 guard로 취급하지 않습니다.

NIQR-O03(P1 hypothesis): LIMIT101은 left-join parent-only row도 세고 rowCount를 complete threshold로 사용합니다. 100개 초과 parent-only row가 적은 assignment-context set을 불필요하게 incomplete로 만들 수 있는 추가 경계는 아직 실제 반례를 실행하지 않았습니다. 현재79개 입력 pin을 보존하고 후속 검토/테스트와 분리합니다.

## 정확한 핵심 source snapshot

- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/hris/identity/v1/AuthPersonBindingQueryReaderV1.java\n  - SHA256 a1f698e3280d6629fb71ed94d3f998403eecbadef8f92fc7fdbe0750fd148f12; mtimeNs "1789359261552529839"; pre/post 동일.
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/test/java/com/dwp/services/auth/hris/identity/v1/AuthPersonBindingQueryReaderV1PostgresTest.java\n  - SHA256 6db7560237bd8bbde6796f2f57b5bce5a62a1cf50f251d62e8472892d8b3a384; mtimeNs "1789360386586876722"; pre/post 동일.
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/test/java/com/dwp/services/auth/hris/identity/v1/AuthPersonBindingQueryReaderV1Test.java\n  - SHA256 53da4db6e827d0a70a038c460602103f5de48a5d37709f6500d2fcff219934ae; mtimeNs "1789360386584408065"; pre/post 동일.
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/hris/identity/v1/NativeSelfContextQueryReaderV1.java\n  - SHA256 9303e773d78b3b94d1bafefb6dcb474f24e101eee205ce6e6f105fb3d9492749; mtimeNs "1789360393439338720"; pre/post 동일.
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/resources/db/migration/V49__add_native_legal_employer_public_id.sql\n  - SHA256 9fe9f4b2f540b94a38525544e40989452410a860dca3fdc521a0ee07c542ada3; mtimeNs "1789360448778031618"; pre/post 동일.
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/test/java/com/dwp/services/people/hris/identity/v1/NativeSelfContextQueryReaderV1PostgresTest.java\n  - SHA256 69b51fa895f929fcca0281df191a30e5caf440bc981fd6b069968d1c03c38179; mtimeNs "1789360558275220464"; pre/post 동일.
- /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/test/java/com/dwp/services/people/hris/identity/v1/NativeSelfContextQueryReaderV1Test.java\n  - SHA256 1dfe5fbeb1ef6f9a57954b3349a34abbe946e6df74191985b0b0650a0d072791; mtimeNs "1789360386586194297"; pre/post 동일.

XML4개의 full SHA/ns/case ID와185개 전체 pre/post source manifest는 JSON을 정본 실행증거로 사용합니다. mtime ns는 문자열로 기록하여 이전 JS unsafe-number 반올림 문제가 없습니다.

## 실행 진단과 한계

최초 harness의 host-lock parent 경로 오타는 Gradle/DB 실행 전 exit1로 종료됐습니다. 기록된79개 실행은 정확한 기존 hris host lock을 사용합니다. Docker29의 lowercase no-such-object 응답을 초기 teardown classifier가 UNCERTAIN으로 분류했으나, 후속 read-only exact-ID 재확인에서4개 모두 REMOVED를 확인했습니다. 이 두 진단을 test skip/PASS로 바꾸지 않았습니다.

본 결과는 작성자가 아닌 checker의 제한된 native reader 검증입니다. 전체 backend check, 13stream/current Control bootstrap, signed 권한·신원 authority, HRIS 전체 source graph/owner 정책/모듈 개발환경 READY를 의미하지 않습니다. G3는 CLOSED이고 공통 P0는 별도로 열려 있습니다. commit 및 canonical/Gate 전파는 수행하지 않았습니다.

