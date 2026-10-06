# Runtime startup native inspection — 작성자 실행 증거

고정일: 2026-09-14. 상태: **작성자 측 bounded test evidence이며 독립 승인/G3 착수 승인이 아니다.** 새 생산 2파일·테스트 3파일을 검증했으며 기존 고정 10파일의 SHA256은 모두 동일하다. 독립 root 초기 Clock 반례는 아직 이 93-case 집합으로 인증하지 않았다.

정확 데이터는 [typed JSON](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/runtime-startup-native-inspection-author-evidence-2026-09-14.json)에 보존한다. JSON에는 fresh XML SHA/93 case 이름·PG18 case별 elapsed·모든 실행 argv·고정 15파일 pin·최초 실패 경계가 포함되어 있다.

## 실제 최종 실행

| 실행 | 실제 결과 | suite 구성 | native XML 원문 시각 / seconds | Gradle elapsed |
| --- | --- | --- | --- | --- |
| postgres:16-alpine | 93 tests / fail0 / error0 / skip0 | 기존 guard28 + 새 unit7/9 + native49 | 2026-09-14T05:26:17 / 85.346 | 110초 |
| postgres:18.4-alpine | 93 tests / fail0 / error0 / skip0 | 동일 고정 소스·동일 93-case 집합 | 2026-09-14T05:28:20 / 77.855 | 89초 |

93은 고유 combined case 수이다. 두 엔진에서 총186회 실행했지만 고유186개 테스트라고 표현하지 않는다. 새 고유 case는65(7+9+49), 기존 guard case는28이다.

JUnit XML timestamp 자체에는 zone suffix가 없다. 원문값을 유지하며 Gradle report convention 및 당시 UTC clock에 따라 UTC로 해석했다. wrapper의 정확 UTC 시작/종료는 계측하지 않았으므로 추정값을 쓰지 않는다. PG18 종료 후 UTC clock 관측은 `2026-09-14 05:29:51 UTC`이다. 실제 엔진 tag는 보존했으나 final image digest와 server minor text는 별도 보존하지 않았다.

PG16 XML metadata는 해당 실행 직후 직접 읽었지만 다음 PG18 실행으로 파일이 교체되었다. 따라서 PG16 case별 elapsed/XML SHA를 보유했다고 주장하지 않는다. PG18은 다음 독립 replay 전에 실제 fresh XML을 읽어 SHA·attributes·모든 testcase를 JSON에 복사했다.

## 재현 argv와 host semaphore

cwd: `/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend`.

두 실행 모두 기존 host lock `/Users/a10697/Work/DWP/.codex-worktrees/hris/.control-locks/hris-verification.lock`을 `r+`로 열어 `fcntl.LOCK_EX|LOCK_NB`로 소유한 상태에서 다음 argv를 실행했다. busy이면 Gradle을 시작하지 않는다. subprocess timeout은300초이며 임의 연장하지 않았고 finally에서 lock을 해제했다.

```text
DWP_TEST_POSTGRES_IMAGE=postgres:16-alpine
./gradlew :dwp-core:test
  --tests com.dwp.core.database.authority.RuntimeOnlyStartupGuardTest
  --tests com.dwp.core.database.authority.PrivilegeSurfaceCompilerV1Test
  --tests com.dwp.core.database.authority.JdbcRuntimePoolInspectionV1Test
  --tests com.dwp.core.database.authority.JdbcRuntimePoolInspectionV1PostgresTest
  --rerun-tasks --no-daemon --max-workers=1 --console=plain
```

PG18 실행은 환경값만 `postgres:18.4-alpine`로 바꿨다. 실제 리스트 형태 argv/env는 JSON에 있으며 위 줄바꿈은 설명용이다. 테스트의 `disabledWithoutDocker=false`로 실제 Docker/PG가 없으면 skip 성공으로 처리하지 않는다.

## source와 namespace pin

Backend committed HEAD: `db0d2b5067e6fbee27ee58121c5a4406cab132b9`. 새 source/test는 당시 untracked이며 이 과제는 commit하지 않았다. namespace는 `com.dwp.core.database.authority`, compiler protocol은 `DWP_RUNTIME_PRIVILEGE_SURFACE_V1`이다.

| 신규 파일 | lines | SHA256 |
| --- | --- | --- |
| JdbcRuntimePoolInspectionV1.java | 331 | `41e1e2aae659a97a14225281b18d832c9e4bc6751ab8b1ccc4930ed74aa01072` |
| PrivilegeSurfaceCompilerV1.java | 328 | `6bff3ec29240d1e89f50dcee9a819aea495436869441e77ab95d8a97a94aa2c9` |
| PrivilegeSurfaceCompilerV1Test.java | 87 | `3100d88ae885777793df9c0545d3100b7e1e2cde07aa2efb7139090a6043dbce` |
| JdbcRuntimePoolInspectionV1Test.java | 82 | `c337f040942c55e1e90fddb0b0586f140b1f0e2987fa729ae3700672fee80eb0` |
| JdbcRuntimePoolInspectionV1PostgresTest.java | 391 | `9f896da90db0cee4bab0a0d75552f36e68c8c93374542036acc8b52154e1dcff` |

기존 고정10파일의 정확 경로/SHA도 JSON에 포함한다. 기존 scalar/Composite/고정 guard/Control/8서비스 wiring/build/main SQL/G0·G2 정본 수정은0이다.

## 최초45 FAIL은 분리 보존

최초 PG16 실행은 `BUILD FAILED in 15s`, XML 원문 timestamp `2026-09-14T05:15:19`, suite seconds `2.667`, tests45/failures45/errors0/skipped0이었다. exact cause:

```text
java.lang.IllegalStateException: Runtime startup: invalid trusted server identity
at RuntimeStreamStartupSeal$RuntimePurpose.<init>(RuntimeStreamStartupSeal.java:105)
at JdbcRuntimePoolInspectionV1PostgresTest.purpose(JdbcRuntimePoolInspectionV1PostgresTest.java:283)
45 tests completed, 45 failed
```

fixture가 `inet_server_addr()::text`를 사용해 `/32` mask를 포함한 주소를 넘겼고 frozen RuntimePurpose IP grammar가 inspect 호출 전에 거부했다. native inspection 호출 수는0이었다. 검사 성공이나 별도 security counterexample로 계산하지 않는다.

새 inspector query와 새 fixture만 `pg_catalog.host(pg_catalog.inet_server_addr())`로 정규화했다. 고정10파일/IP grammar/role privilege 정책은 완화하지 않았다. 전체 최초 stdout은 도구 transcript에, 정확 tail·stack excerpt·argv·metadata는 JSON에 보존했다. 과거 전체 XML/SHA가 보존됐다고 주장하지 않는다.

## native 검사와 hash의 실제 범위

trusted qualifier/정확 DataSource object identity/독립 승인 endpoint·principal·schema·path를 connection open 전에 대조한다. ORIGINAL JDBC login이 bootstrap이면 catalog SQL 전에 거부한다. 이후 current_user/session_user/TCP server/catalog/version/transaction readOnly/searchPath, elevated attrs, conservative MEMBER closure(특히 NOINHERIT), 모든 schema CREATE/global ownership/parameter·catalog authority, DB CREATE/TEMP/foreign CONNECT, materialized history의 table·column·PG17+MAINTAIN 권한을 읽는다.

정상 SET-only managed role과 기존 People primary+performance 한-pool scalar alias positive를 포함한다. 임의 membership을 곧바로 privileged로 간주하지 않지만 privileged/owner/CREATE/history/foreign CONNECT 우회는 거부한다. MEMBER는 SET-only보다 넓은 의도적 fail-closed closure이며 exact options/grantor는 hash에 포함한다.

table/sequence/column ACL·routine(default PUBLIC/SECURITY DEFINER/args/body/config digest)·type/default ACL/grant option/reachable roles를 versioned length-framed UTF-8로 hash한다. namespace 밖 large-object metadata ACL 및 FDW/server/user-mapping options도 포함한다. history row/large-object payload는 읽지 않고 routine·GUC·remote credential literal은 hash-only이다. 예상 hash는 독립 signed trust anchor가 공급해야 하며 현재 DB 관측을 자기 승인 baseline으로 삼지 않는다.

## 정적 검사와 종료 증거

실제 Python script 결과는 source-size1645 PASS(신규700행 이하), test-size810 PASS(신규1000행 이하/legacy exact7), SCC1645 classes/legacy12/Spring0 PASS, unused-private PASS, git diff --check exit0이다. 정확 argv/stdout은 JSON에 있다. 수량 증가나 baseline 완화로 통과시킨 것이 아니다.

Testcontainers가 task PG/Ryuk를 자동 종료했다. final docker ps에는 보호 주서버 `dwp-postgres`/`dwp-redis`/`dwp-kafka`만 보였고 task PG/Ryuk는 없었다. broad docker cleanup/주서버 종료/불명 컨테이너 종료는0이다. final task exact IDs/StartedAt/image digest를 계측하지 않았으므로 이것은 list상 absence evidence이며 ID-bound destruction receipt라고 과장하지 않는다.

## 여전히 OPEN

provider registration, 실제 외부 native definition/provenance producer, lease/offline fence 통합, eight-service runtime-only wiring, thirteen-stream bootstrap/activation은 미구현이다. 현재9 scalar와 미래13 authority를 혼동하지 않는다. Policy는 관련 catalog에 실제 materialized한 history inventory를 받아야 하며 미래 registered-only optional reservation을 자기 발견·활성화하지 않는다.

이 hash는 ACL/role/posture/routine-body surface이며 table constraint/default/RLS-expression/trigger-definition 전체 의미 fingerprint가 아니다. full stream definition/provenance는 독립 외부 producer의 native proof와 fence로 별도 닫아야 한다. startup snapshot은 continuous monitoring·privileged DBA/host compromise 방어가 아니다.

customer authority/adoption/live country/integration, domain G4 실제 acceptance, G6 production activation 및 G3 착수 승인은 모두 이 보고서 밖이다. 작성자 성공93과 frozen byte 일치는 독립 root Clock1 반례나 전체 semantics에 대한 PASS를 의미하지 않는다.

