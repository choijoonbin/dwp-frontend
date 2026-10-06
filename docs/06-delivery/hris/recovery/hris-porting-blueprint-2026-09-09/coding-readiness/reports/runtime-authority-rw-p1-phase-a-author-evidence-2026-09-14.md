# RW-P1 phase-A 실제 구현·작성자 검증 증적 — 2026-09-14

판정은 **AUTHOR-ONLY / 계약·합성 observation 테스트 정상 / G3 CLOSED**이다. 독립 승인, 실제 metadata native inspection, pool 등록, producer 및 8서비스 runtime-only wiring, future13 bootstrap 승인을 뜻하지 않는다. Root가 신규 8 production/4 test 파일을 별도 전체 읽기·실행 검토한다.

원문 증적은 [JSON](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/runtime-authority-rw-p1-phase-a-author-evidence-2026-09-14.json)에 실제 argv/UTC/elapsed/stdout/stderr, fresh XML 전체, testcase 이름·시간, source SHA-256 및 decimal nanosecond metadata를 보존했다. 기존 frozen authority 26파일과 새 12파일은 명확히 구분한다. JSON의 original XML 문자열을 UTF-8로 복원하면 각 보존 XML SHA와 비교할 수 있다.

## 실제 실행 — 합산 금지

| 실행 | 결과 | UTC wrapper 구간 | elapsed |
| --- | --- | --- | --- |
| 처음 107개·추가 음성 전 소스 | 107 정상, failure/error/skip 0 | 08:30:47.682965 → 08:31:06.869490 | 19.195620초 |
| 추가 126개·실제 첫 실패 | 125 정상 / **1 FAIL**, error/skip 0 | 08:37:40.073951 → 08:37:51.339402 | 11.273925초 |
| 수리 후 동결 129개 | **129 고유 정상**, failure/error/skip 0 | 08:39:47.106992 → 08:40:15.042414 | 27.998875초 |

첫 107개 combined tool output은 JSON metadata 부분에서 잘렸으므로 완전한 38파일 pre/post trace가 보존됐다고 주장하지 않는다. 해당 실행의 4개 XML 원문 및 post source namespace는 이후 수정 전 별도 읽어 보존했다. 첫 실제 FAIL과 수리본은 **완전한 pre/post 38파일 SHA/ns**를 각각 보존했으며 모두 동일하다. 수정 전부터 존재한 26파일은 전체 과정에서 SHA/ns가 그대로이다.

최종 fresh XML은 registry 7 + metadata parser 25 + signature/외부 anchor/합성 observation 62 + receipt 35 = 129이다. class+case 이름도 129개 고유이다. 그 중 qualifier LIMIT witness는 외부 승인의 범위를 보여주는 반례성 검사이지 실제 pool 승인 사례가 아니다. 유지보수 ratchet Python 6+7+6은 JUnit 129개와 별도 수량이다. 과거 native PG/Clock/Auth/People/FE 실행과 합산한 현행 전체 PASS를 주장하지 않는다.

실제 최종 argv는 다음과 같다.

```sh
./gradlew :dwp-core:test --tests com.dwp.core.database.authority.ScalarNineRuntimeRegistryContractTest --tests com.dwp.core.database.authority.RuntimeMetadataCatalogReadEvidenceJsonTest --tests com.dwp.core.database.authority.RuntimeMetadataCatalogReadEvidenceVerifierTest --tests com.dwp.core.database.authority.CompositeAuthorityReceiptV2Test checkSourceSize checkTestSourceSize checkJavaDependencyCycles --rerun-tasks --no-daemon --max-workers=1 --console=plain
```

cwd: `/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend`. 공유 lock은 `/Users/a10697/Work/DWP/.codex-worktrees/hris/.control-locks/hris-verification.lock`의 `fcntl.LOCK_EX|LOCK_NB`, subprocess timeout 240초 고정이며 임의 연장·동시 BEheavy 실행이 없다. 각 실행 종료 후 해제했다. wrapper의 process exit와 Gradle return code를 혼동하지 않고 JSON의 실제 `exitCode`를 사용했다.

## 최초 실패와 신규 소스 수리 경계

metadata의 canonical JSON `null`이 `parse()`에서 null로 반환되어 새 rootNull 음성이 실제 실패했다. `RuntimeMetadataCatalogReadEvidenceJsonV1`와 `CompositeAuthorityReceiptV2Json`의 **신규 parser 두 곳**에 `parsed != null`을 요구했다. v2의 이전 rootNull 검사도 단순 no-cause assertion이 downstream NPE로 우연히 충족될 수 있어 최종에는 `IllegalStateException` 타입까지 검사한다. 이 두 수리 전 XML과 실패 원문을 그대로 보존했다.

작성자 추가 보강은 신규 Selection/VerifiedEvidence의 private constructor, Provider own scalar history/bindingKey 및 role/purpose exact 동정, base-own 최대 5분·metadata window 종속이다. 기존 parser/signature/Guard/Inspector/Compiler/registry, scalar/v1 receipt, Control, 8wiring, CSV/Gate/역사 DDL은 **수정 0**이다. 입력·parser·clock 예외의 원문 및 cause를 attach하지 않는 기존 no-cause 경계도 유지했다.

## 구현 계약과 명확한 한계

- scalar9는 실제 8 catalog/9stream이다. People는 승인된 한 pool에서 PERFORMANCE+PRIMARY 두 stream을 담당하며 runtime/migration 각 하나의 승인 alias를 유지한다. future13 별도 manifest의 13 독립 authority로 숫자나 역할을 숨겨 치환하지 않는다. Selection은 승인된 `selectService`에서만 생성되고 service-only 기존 pool map을 반환할 뿐 DS 생성/open/등록/검사를 하지 않는다.
- metadata는 `METADATA_CATALOG_READ` 독립 목적 및 두 namespace이다. Provider의 auth/people/platform/provider 네 slot과 dedicated metadata principal을 검사한다. 독립 expected base-own SHA, 서명된 own seal, deployment/app/epoch/key/permit/challenge/control/source/artifact/manifest 및 source slot/endpoint/engine/compiler/history policy/ACL anchor가 필요하다. PRIMARY/owned foreign stream을 위장 등록하지 않는다.
- native metadata port는 **UNWIRED phase-A seam**이다. `UNAVAILABLE`은 Optional.empty, 없는 observation은 거부한다. positive observation은 명시적 합성 객체이며 JDBC query/pg_catalog/live pool 증적이 아니다. 실제 provider가 original login/current/session, direct role, global membership/CONNECT, schema ownership/CREATE/TEMP, history·relation·column·sequence·routine/type/default/grant-option/catalog surface를 같은 compiler 정책으로 조사해야 한다.
- VerifiedEvidence는 private constructor이므로 raw Claims로 native-observation verifier를 호출할 수 없다. 그러나 **검증 시점의 서명·정책 token이지 live lease가 아니다**. Phase-B가 native 완료 후 clock/evidence/base expiry, issuer/current epoch/lease/fence를 재검증해야 한다. 초기 서명 검사만 계속 재사용하여 승인하면 안 된다.
- Provider base public schema/정확 history table/`provider-runtime` binding 및 role/purpose를 잘못 둔 실제 서명 입력은 거부한다. qualifier는 독립 승인된 base SHA에 정확 결속된다. 외부 SHA를 명시 갱신한 다른 qualifier는 허용되는 LIMIT witness가 있다. 이는 actual scalar registry/DS identity/endpoint proof가 아니므로 Phase-B/own admission에서 exact approved registry composition을 반드시 해야 한다.
- composite v2는 v1 변경 없이 새로운 parser/type만 제공한다. Native와 AdoptedHistoryProof는 one-of이다. 빈 history에는 count/rank 0, canonical full-history empty SHA, native history relation OID/definition pin, genuinely-empty staged versioned/repeatable inventory가 필요하다. 실제 PER 0 또는 future 활성 G3 empty scaffold를 표현할 수 있지만 missing source/history를 무조건 허용하지 않는다.
- adoption v2는 원본 MigrationAdoptionGuard receipt를 full-field digest로 재검사하고 boundary/stream/catalog/schema/history/principal/full history/inventory/current reference를 exact 결속한다. installed_by/checksum rewrite 없이 full-history SHA를 보존한다. prior adoption 및 composite predecessor는 독립 expected binding에 남는다.
- receipt source count 및 history count 관계는 **타입 경계**이다. 자기가 만든 self-consistent receipt는 native 증거가 아니다. 실제 resource closure/checksum/Flyway success/count/max/installed_by/pending 검사와 영수증 producer·predecessor publisher는 별도 실제 구현·검증이 필요하다. 미구현 producer가 생겼다고 표시하지 않는다.

## Source·test-size·SCC 실제 결과

실제 같은 최종 argv에서 source-size **1665 production/신규 700행**, test-size **819 test/신규 1000행·기존 exact exceptions 7**, Java SCC **기존 exact 12 / 신규 0 / Spring constructor 0**가 통과했다. baseline 또는 검사 제한은 수정하지 않았다. 새 production 최대 122행, test 최대 214행이다.

신규 동결 12파일 SHA/ns는 아래와 같다.

| 파일 | SHA-256 | mtime ns |
| --- | --- | --- |
| [CompositeAuthorityReceiptV2.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/CompositeAuthorityReceiptV2.java) | `4c2f010740ab83788305c67f9cfd53b45fac13ee0447cabae4556ae947b04898` | `1789374183580189584` |
| [CompositeAuthorityReceiptV2Json.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/CompositeAuthorityReceiptV2Json.java) | `a32060e50d8032d9f0396ff1231dd008669320174ea1d38fc7c71e7edfa146c2` | `1789375155939146867` |
| [RuntimeMetadataCatalogReadEvidenceJsonV1.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/RuntimeMetadataCatalogReadEvidenceJsonV1.java) | `bb94d059a0e11e7d8f81f94505d326e5d31a33a245121c3f33c613431bcc2dd3` | `1789375155937505316` |
| [RuntimeMetadataCatalogReadEvidenceV1.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/RuntimeMetadataCatalogReadEvidenceV1.java) | `ecf4e54d54ee1a1082a949e5b20cccb035a18f6b376d34d8472ee8f84a02108b` | `1789374222670488500` |
| [RuntimeMetadataCatalogReadEvidenceVerifierV1.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/RuntimeMetadataCatalogReadEvidenceVerifierV1.java) | `87a1e322e3e4354733b49502026cc733ee83d4977edde3b11ea96579bc27e805` | `1789375155941710089` |
| [RuntimeMetadataPoolInspectionPortV1.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/RuntimeMetadataPoolInspectionPortV1.java) | `4de1a1dd27b91235dfad5ddf16a4d7a5c0a8d1fd3a9612129717b9f022d287f7` | `1789373981446382644` |
| [ScalarNineRuntimeRegistryAdapterV1.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/ScalarNineRuntimeRegistryAdapterV1.java) | `21aa39fcefabaa4ae58715c36e521ded75a558828aa3e0f229ca39f35ec5eee9` | `1789374783228104525` |
| [ScalarNineRuntimeRegistryContract.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/main/java/com/dwp/core/database/authority/ScalarNineRuntimeRegistryContract.java) | `683d57d4f799875a340c3e6fb216cf501047ee117b27b0e757e7aba8a5e1360d` | `1789374783226908810` |
| [CompositeAuthorityReceiptV2Test.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/test/java/com/dwp/core/database/authority/CompositeAuthorityReceiptV2Test.java) | `f7faccf72d85805f2bb2a5b098c1159f072d207857b3f42869f26a7a8817bb3a` | `1789375155944200477` |
| [RuntimeMetadataCatalogReadEvidenceJsonTest.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/test/java/com/dwp/core/database/authority/RuntimeMetadataCatalogReadEvidenceJsonTest.java) | `f59f6f19269e862807bd6630d032d02b055c658132e459298aad7830065da127` | `1789374827802675087` |
| [RuntimeMetadataCatalogReadEvidenceVerifierTest.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/test/java/com/dwp/core/database/authority/RuntimeMetadataCatalogReadEvidenceVerifierTest.java) | `32395170fc029b109c368040a10a7f858617a1f1b1aa77a5b8b8f2c2444667ed` | `1789375155942930220` |
| [ScalarNineRuntimeRegistryContractTest.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-core/src/test/java/com/dwp/core/database/authority/ScalarNineRuntimeRegistryContractTest.java) | `5b6c96ec2fe91614c654251cde4811321f5ece8a46ac538c729535b40124c052` | `1789374783229259197` |

## 남은 실제 준비 작업

1. Phase-B의 dedicated metadata native JDBC provider, independent trusted DS identity/endpoint/history policy, PG16/18 privilege·default PUBLIC routine·foreign CONNECT·role switch·catalog mutation 음성.
2. Phase-B의 metadata/own admission 현재 signed lease/epoch/fence/expiry composition. disabled optional zero-open, required missing fail-closed 및 unrelated optional blocking 금지.
3. 새 composite v2 native/adopted/empty 실제 Control producer와 staged source 원본/checksum/history success/installed_by/기존 relation/native inventory 및 durable predecessor 승인.
4. P2 외부 producer·trust anchor·reserve/activate/current/release/drain/offline fence와 transport 통합.
5. P3 8서비스 strict app process migration credential/Flyway/migration DS 제거, JPA/runner startup barrier 및 실제 direct-JAR/start/restart/tamper 검사.
6. P4 future13 supplemental schema/history/roles/bootstrap/control cutover. 현재 scalar9와 구별하고 임의 bootstrap·LOCAL_LEGACY·SET ROLE 우회를 추가하지 않는다.

실제 domain G4 CRUD 전체를 선구현해야 G3 준비가 열린다는 순환 요구는 하지 않는다. 다만 exact 설계, shared DTO/SPI/guards/scaffold·source contracts 및 현재 common+pilot runtime이 실제로 닫혀야 한다. 이 phase-A 작성자 증거만으로 5모듈 착수/G3 또는 domain G4/G6를 승인하지 않는다.

이번 task는 native PG 실행·컨테이너 생성/종료/삭제가 모두 0이다. 별도 Docker namespace inspect를 하지 않았으므로 보호 local 컨테이너 불변 증거를 주장하지 않는다. 기록된 serialVersionUID/JVM 경고는 다른 source의 현행 경고이며 이를 수리하려고 승인 밖 파일을 건드리지 않았다.
