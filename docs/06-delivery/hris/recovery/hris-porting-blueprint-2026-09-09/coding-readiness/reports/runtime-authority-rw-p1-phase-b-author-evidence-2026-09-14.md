# RW-P1 Phase-B 네이티브 메타데이터 저자 검증 — 2026-09-14

이 문서는 신규 **2 main + 2 test** 구현의 저자 실행 증거다. 독립 승인·실제 producer·Spring 등록·8서비스 연결·13-stream 활성화·전체 G3 준비 판정이 아니다. 원본 phase-A12 및 기존 authority38 파일, scalar/Composite/Inspector/Compiler/Guard/parser/build/SQL/Gate는 변경하지 않았다. 같은 디렉터리의 [JSON 원문](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/runtime-authority-rw-p1-phase-b-author-evidence-2026-09-14.json)에 실제 argv, stdout/stderr, UTC, 단조시간 경과, 42파일 전후 SHA/decimal-ns, fresh XML 원문·해시·case 목록을 저장했다.

## 최종 고정 소스

checkout은 `/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend`다.

- [JdbcRuntimeMetadataPoolInspectionV1.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/JdbcRuntimeMetadataPoolInspectionV1.java): 259행, SHA `af260423156ec904ad2931d7f179ba8699a309bad111636c924779a8ba2ecd0b`, ns `1789377245269129079`.
- [RuntimeMetadataAdmissionGuardV1.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/RuntimeMetadataAdmissionGuardV1.java): 295행, SHA `2282e2d66c1ec49dadd40f423a6777aeb1810d20d1177f7f1680c4ff5b9ea593`, ns `1789377245268250452`.
- [RuntimeMetadataAdmissionGuardV1Test.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/test/java/com/dwp/core/database/authority/RuntimeMetadataAdmissionGuardV1Test.java): 277행, SHA `c597e2facc79a3757a1e79d163bfc48190b768608d4705b8bd336f6dda3e845d`, ns `1789377513868416025`.
- [JdbcRuntimeMetadataPoolInspectionV1PostgresTest.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/test/java/com/dwp/core/database/authority/JdbcRuntimeMetadataPoolInspectionV1PostgresTest.java): 304행, SHA `2c98d096fa232880b98fcfd0d152276659ce87915fce6482c12e658d0cce341e`, ns `1789378033052390589`.

## 실제 실행

공유 semaphore는 `/Users/a10697/Work/DWP/.codex-worktrees/hris/.control-locks/hris-verification.lock`이고, 각 배치를 `LOCK_EX|LOCK_NB`로 직렬 실행했다. subprocess 상한은 기존 180초이며 임의 확대하지 않았다. 최종 아래 세 배치의 42파일 SHA/ns는 전후 및 배치 상호 간 모두 동일하다. phase-A 최종 namespace38과도 SHA/ns가 모두 일치한다.

| 실행 | 실제 UTC 시작 → 종료 | 경과 | fresh 결과 |
| --- | --- | --- | --- |
| PostgreSQL 16 | 09:33:15.900598 → 09:33:58.238611 | 42.337553초 | 40 tests, fail/error/skip 0 |
| PostgreSQL 18.4 | 09:35:07.367446 → 09:35:47.155558 | 39.787847초 | 40 tests, fail/error/skip 0 |
| 최종 unit + ratchets | 09:36:47.997078 → 09:37:08.888452 | 20.890928초 | 51 tests, fail/error/skip 0 |

세 Gradle exit는 모두 0이다. Java 고유 case는 **91개**, 최종 엔진별 실행 수는 **131 = 40 + 40 + 51**이다. 동일 native40을 두 버전에서 실행한 것을 80개 고유 case로 부르지 않는다. 이전 phase-A/root 독립 배치와 합산한 whole PASS도 아니다.

fresh XML SHA는 PG16 `62e6eb77a0855840fb3c8cd5c4e216ef7711f0ea48fc5bb3a766a1b1c2f1709a`, PG18.4 `3c46771eeec6c7450bc7d2371fbebde24f7310928d979bc60f91670497d6e64d`, 최종 unit `60a1aac093f7c632eac3fe87eb9abf160b03888f22812da8a50aa45131a64b26`이다. 다음 test task가 XML을 덮어쓰기 전에 JSON에 각각 원문을 보존했다.

실제 최종 ratchet Python tests도 6 + 7 + 6건 모두 통과했다. source-size는 production1668/new700행, test-size는823/new1000행/기존 정확 예외7, dependency cycles는 정확 legacy SCC12/새 SCC0/Spring constructor cycle0이다. baseline 예외 추가·완화는 없다. 기존 다른 패키지의 `serialVersionUID` 경고는 stderr에 원문 보존했으며 이 범위에서 고치지 않았다.

재실행 argv는 아래와 같다. 실제 host semaphore 취득 및 고정 소스 확인 후 실행해야 한다.

```sh
DWP_TEST_POSTGRES_IMAGE=postgres:16-alpine ./gradlew :dwp-core:test --tests com.dwp.core.database.authority.JdbcRuntimeMetadataPoolInspectionV1PostgresTest --rerun-tasks --no-daemon
DWP_TEST_POSTGRES_IMAGE=postgres:18.4-alpine ./gradlew :dwp-core:test --tests com.dwp.core.database.authority.JdbcRuntimeMetadataPoolInspectionV1PostgresTest --rerun-tasks --no-daemon
./gradlew :dwp-core:test --tests com.dwp.core.database.authority.RuntimeMetadataAdmissionGuardV1Test checkSourceSize checkTestSourceSize checkJavaDependencyCycles --rerun-tasks --no-daemon
```

## 최초 실패와 수정 경계

첫 공유 People override3 실행은 신규 core dependency 컴파일에서 실패하여 **test0**으로 끝났다. 이를 사업 의미 테스트 실패나 PASS0으로 치환하지 않는다. [동료 보존 원문](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/native-people-user-role-v3-override-core-compile-failure-2026-09-14.json)의 SHA는 `c5e93ce155714376cc686a6fa224ceed99c1fc48abaeeb9c64702109ccf340ae`다. 해당 actual argv/UTC/exit/output을 이 보고서 JSON에도 별도 포함했다.

원인은 기존 own `Admission.validUntil()`가 String인데 신규 Guard에서 Instant처럼 비교한 것이다. initial `isBefore`는 컴파일 실패했고, 독립 root가 확인한 `Instant.equals(String)`은 healthy를 항상 거부할 두 번째 타입 오류였다. 수리 전 신규 Guard SHA `40f79a0f8a960371a7fdc8ebab8fcc4654ff1af57ae91b7ffc5903aa27d18eb6`를 보존하고, 두 곳만 기존 엄격한 `instant(admission.validUntil())`로 변환했다. null/malformed/noncanonical 문자열, inclusive expiry, 정상 signed healthy 경로를 실제 unit으로 검사했다. 기존 own Guard/phase-A12 수정은 없다.

신규 inspector의 restoration도 모든 단계를 시도하고 하나라도 실패하면 abort→close 및 관찰 증거 폐기로 정리했다. rollback 실패가 driver/clock/password sentinel 또는 cause를 노출하지 않으며 정상 증거를 반환하지 않는다는 mock/native 음성을 배정했다.

첫 unit51은 09:25:05.824183→09:25:16.493495/10.669093초에 통과했고 XML SHA `72e846bdb64dad2d993146b0ea9f2d62403afb39d12c500b79c1897dda15a2c6`도 보존했다. 이후 PG test의 SELECT-only assertion이 기존 catalog guard의 WITH CTE를 부당하게 거부할 것을 정적 확인하여 **test-only** SELECT|WITH로 수정했다. 이 수정 전 실행하지 않은 PG를 PASS/FAIL로 꾸미지 않는다. 최종 unit은 해당 수정 후 동일4pin에서 다시 실행했다.

## 실제로 구현·검사한 경계

`JdbcRuntimeMetadataPoolInspectionV1.Binding`은 independently approved ExpectedSource + 동일 DataSource 객체 + 고정 compiler/history Policy를 입력받는다. source/qualifier/pool 반복과 scalar source별 정확 history oracle 불일치를 생성 시 거부한다. People metadata는 primary/performance 두 history를 검사하되, metadata에 own stream 또는 PRIMARY 역할을 부여하지 않는다. 실제 metadata role 네 개는 분리되어 있다.

연결 전에는 정확 registry의 DS 객체/ExpectedSource를 비교한다. original JDBC login, autocommit=true, readOnly=true를 먼저 확인하고 application transaction에 합류하지 않는다. 15초 network timeout·repeatable-read snapshot 후 네이티브 current/session login, server/catalog/version/search_path=`pg_catalog`, role NONE/replication origin/read-only transaction을 검사한다. inspector는 `setReadOnly`를 호출하지 않는다. privileged admin pool을 readOnly로 꾸미거나 원 login과 current role을 다르게 만드는 경우는 거부한다.

실제 SQL은 app relation/column/sequence/routine, 기본 PUBLIC EXECUTE 및 SECURITY DEFINER/프로시저, grant option/default ACL, 양방향 membership/잠재 SET ROLE, 전역 ownership, DB CREATE/TEMP/foreign CONNECT(다른 catalog 및 template1), 모든 schema CREATE, 전 history 권한, catalog mutation을 거부한다. routine signature/body/security 설정·type/default ACL 등을 frozen versioned compiler로 해시하고 **외부 승인 SHA**와 비교한다. history relation은 catalog identity/권한으로만 검사하며 history row는 읽지 않는다. 새 SQL은 pg_catalog-qualified이고 기존 reusable catalog checker도 exact native pg_catalog search path 확인 후 실행된다.

PG fixture authority가 mutation **이전** admin catalog connection에서 expected 해시를 생성·고정한다. 이것은 test fixture의 독립 승인 입력이며 production inspector의 expected 자기 발견이 아니다. 실제 GRANT/REVOKE/definition/endpoint/login/posture 변조40건과 별도의 실제 history/domain/definer/DDL 42501 denial을 기록했다. type/default ACL은 승인 해시와 drift 검사 대상이다. 모든 app type USAGE가 0이거나 임의 custom type의 의미 안전성까지 독립 인증했다는 주장은 하지 않는다.

`RuntimeMetadataAdmissionGuardV1`은 phase-A 서명 검증 token을 live lease로 재사용하지 않는다. 새로운 signed current vector는 namespace/version·fresh nonce·actual signed own ACTIVE lease document SHA·네 active source의 전체 정책/evidence SHA·deployment/epoch/key/control/source/manifest pin에 결속한다. caller boolean current=true 또는 raw claims를 받지 않는다. unknown/duplicate/coerce/trailing/oversize/null 등은 새로운 strict byte-canonical parser가 거부한다.

native inspection 전후에 own-current와 metadata-current signed proof를 다시 요청하고 **provider 응답 후** clock을 recapture한다. clock non-regression, 최초 own/vector expiry, 최종 signed proof expiry를 모두 검사하므로 새 응답으로 expired 초기 권한을 회생시키지 않는다. missing current/native provider·pool은 open0으로 거부하고, explicitly inactive source set은 다른 optional pool을 열지 않는다.

## 컨테이너 및 증거 한계

PG16 XML의 own PG `18603cdab7ac1a56e37c0acf284f5f11734830f40e1b9f516019d950d1796f07`, Ryuk `eb79ad9e4f1bad7b4938a387502e7f92c729e8a7deba25f72ee01f57d9f750d6`; PG18.4 own PG `e1c1480327ff8c200e4a51c0c81e17ec6df99c073d6f5adc9df385dcf663a140`, Ryuk `0bd64d0ae25f6a7d0278ba5f5e783253b5739ae5191e4c32ecc3598a91156df2`는 각각 exact inspect에서 no-such-object=REMOVED를 확인했다. 자동 Testcontainers 정리이며 수동 삭제0, 다른 프로젝트 컨테이너 종료0이다.

**실제 네이티브 증거는 metadata pool/catalog/권한 검사다.** 조합 테스트의 own base/ACTIVE lease/current issuer는 real Ed25519로 서명한 MOCK·synthetic fixture 계약이며 실제 trusted producer/native own inspection/deployment fence/transport를 인증하지 않는다. 외부 issuer는 durable current deployment/epoch/permit/lease/source vector를 native fence와 linearize해야 하지만 그 구현은 후속 P2 범위다. timestamp/서명만으로 현재성 또는 privileged DBA compromise 차단을 보장하지 않는다.

아직 root 독립 replay, native empty/adopted composite publication, real authenticated current issuer, readiness renewal/drain, 실제8 Spring runtime-only wiring 및 앱 migration DS/secret/Flyway 제거, optional13 bootstrap이 OPEN이다. 이를 domain G4 CRUD 선개발 요구와 혼동하지 않는다. 정확 공통 scaffold와 실제 공통 연결을 다음 단계에서 완료해야 하며, 이 보고서 자체로 G3/G4/G6 승인하지 않는다.

## 다음 최소 연결안

기존 source-based implementation plan의 후속은 provider-own+metadata4 한 vertical slice부터 진행한다. 별도 Control-owned approved metadata 슬롯을 own permit/deployment/epoch/source/manifest에 결속하고, 동일 durable deployment row/native offline fence 아래 current vector를 서명한다. 기존 ACTIVE의 runtime+metadata CONNECT denial은 유지한다.

검토된 INSPECTION 단계에서만 원 app credential은 계속 invalid한 채 private rotated direct runtime/metadata probe를 허용하고 실제 native 검사를 수행한다. private probe CONNECT 회수·session0 확인 후 immutable native/adopted source/composite/seal publication→SERVING으로 전이해야 한다. 실패는 fenced 상태를 유지한다. 그 후 실제 provider startup barrier에서 독립 anchor/current port/registered pool을 소비하고 migration DS/secret/Flyway를 제거한다. 실제8/9로 일반화한 다음 optional13은 별도 activation 계약으로 다룬다. 이 계획은 아직 구현·승인된 Control 변경이 아니다.
