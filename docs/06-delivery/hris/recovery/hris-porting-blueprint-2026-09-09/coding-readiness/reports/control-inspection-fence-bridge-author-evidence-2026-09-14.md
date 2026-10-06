# P2-A Control 검사 fence — 작성자 native 실행 증적

신규 bridge + PG test + 기존 Fence의 INSPECTION exact-principal overload만 변경했습니다. Main/ControlEnvironment/ControlCredentials/DatabaseControl/기존 core·8 app wiring·DDL·정본·Gate 변경은 0입니다. 이 bridge는 등록되지 않았으며 producer/서명/current metadata4/admission/full13 권한이 아닙니다. G3는 열지 않습니다.

## 실제 실행과 고정 입력

PG16: UTC10:24:30.460528→10:25:28.691344,58.233054417초,exit0, 실제20 PASS/failed·error·skipped0. PG18.4: UTC10:26:32.505700→10:27:59.881758,87.379453208초,exit0, 같은20 PASS/failed·error·skipped0. freshXML의 classname/name을 전수 대조해 양 엔진 SAME20을 확인했습니다. 20개 scenario/40개 engine execution이며 40개 서로 다른 업무 시나리오로 세지 않습니다. 최초 compile/native FAIL은 없었습니다.

두 실행 모두 source377의 SHA와 decimal ns가 pre/post 및 두 실행 사이 일치합니다. 범위는 Control/Core/Notification/Audit/Observability/PlatformContracts의 main+testFixtures, Control 모든 tests, build/Gradle wrapper 입력입니다. 전체 backend 인증이 아니고, 이후 Root의 별도 신규 source additions를 소급 인증하지 않습니다. 정확 argv는 `./gradlew :dwp-migration-control:test --tests com.dwp.migration.control.ControlInspectionFenceBridgeV1PostgresTest --rerun-tasks --no-daemon`이며 Docker host와 host override, PG image, UTC/elapsed/exit/host semaphore는 동명 JSON에 보존했습니다. Host lock release는 각각10:25:28.780Z,10:27:59.990Z입니다.

Source3 current SHA/ns는 아래와 같으며 saved-file readback에서도 일치했습니다.

- bridge391행: 2524fdf33c172b0298c05beb9ae19fcc17f2db8e9d3da8c27ec15dfb35e15716 /1789381153743927905
- Fence143행: 76bb330d976ed5b727e97eddaff3995bb68ad077ff19a4d18f2c130ce0716059 /1789381040373741687
- PGtest338행: e9699d3d0a986129725d7a92fbaf49aedf137bbdb12362d640b19dc5095a28b1 /1789381259482661576

## 입증한 fence 경계

Request.disabled는 기타 입력이 모두 없어도 secret-port·probe·connection 호출0입니다. enabled는 owner direct current/session login, endpoint/catalog, 보유한 native advisory fence, exact ACTIVE DB ACL, offline session0, strict roles/membership/search_path를 먼저 확인합니다. metadata는 source service/catalog/endpoint/principal/controlReference/외부 generation ref가 일치하는 TEST provider response만 받으며 missing/slot mismatch/wrong actual password는 mutation 전 거부했습니다. **Typed provider 값은 독립승인을 대체하지 않습니다.** native 42501(정상 비밀번호+CONNECT fence)을 확인하며 pg_authid 비밀번호나 history rows를 읽어 expected를 자기발견하지 않습니다.

INSPECTION은 migration CONNECT를 회수하고 선택된 runtime 또는 해당 DB metadata1개만 CONNECT합니다. old generation은28P01, migration private generation은42501을 확인했습니다. original current_user/session_user/ROLE none/origin/catalog의 catalog 관찰과 history/DDL/unlisted function/alternate owner credentials/두번째 borrow/concurrent Control 차단이 실제 test에 있습니다. probe close/offline0 후 exact ACTIVE를 복귀시키며 runtime은 기존 ACTIVE private password로, metadata는 공급된 원 generation으로 복귀합니다. no-borrow 자기일치 observation과 probe 실패는 observation 없이 FAILED ACL/credential fence로 거부하며 generic no-cause exception을 확인했습니다. 제어 연결 자체가 unreachable일 때 외부 durable recovery는 OPEN입니다.

## 원문·컨테이너·품질 검사

동명 JSON에 두 실행 stdout/stderr·freshXML·source manifest·source3 snapshot 총10개 gzip을 보존했습니다. 저장 파일에서 gzip/raw 길이·SHA, fresh20 XML attributes 및 모든 case 기록을 재검증했습니다. readonly readback harness의 첫 Python bracket SyntaxError는 파일 읽기/검사 전 발생한 harness 실패로 별도 보존하고, 괄호만 고친 verifier는 실제10개 archive를 확인했습니다. native test FAIL이나 archive integrity 실패로 바꿔 적지 않습니다.

각 실행 직후 Ryuk1 pending은 역사적 관찰로 남겼습니다. freshXML에서 추출한 PG16 d1ce79…/Ryukf6dabd… 및 PG18.4 550212…/Ryuk1a61fb…의 exact full IDs는 나중 docker inspect에서 모두 no-such-object/REMOVED입니다. 타인·protected container를 중지하지 않았고 manual stop0입니다.

실제 cheap scanner 결과는 production1673 source-size<=700,Java test825/기존 exception7/new<=1000, trivially-unused private0,legacy SCC12/new cycle0/Spring constructor cycle0입니다. baseline 쓰기는0이며 이것을 전체 G3 PASS로 쓰지 않습니다. 각 컴파일 stderr에는 **2 warning**(기존 Contracts serialVersionUID1+신규 bridge의 미참조 try-resource1)이 있어 warning-free를 주장하지 않습니다.

## 중요한 미완료 — generic callback은 실제 metadata inspector가 아님

현재 ProbePool은 direct JDBC default readOnly=false/autoCommit=true, role별 default search_path를 사용합니다. 따라서20개 generic TEST callback PASS는 frozen `JdbcRuntimeMetadataPoolInspectionV1`의 METADATA_CATALOG_READ composition proof가 **아닙니다**. 그 inspector는 처음 빌린 등록된 DS의 original readOnly=true/autoCommit=true/user/DS-instance/qualifier를 확인한 뒤 자체 RR snapshot을 시작하고 원 isolation/network timeout을 복원합니다. RR가 original prerequisite라고 과장하지 않습니다.

후속은 independent SourcePurpose approval에 결속된 immutable metadata pool posture(readOnly=true,autoCommit=true,pg_catalog,ROLE NONE,origin,endpoint/policy/source/compiler)부터 공급하고, DS original pose를 inspector 바깥에서 정당하게 구성해야 합니다. 검사 실패 뒤 setReadOnly로 건강한 proof를 제조하거나 PRIMARY를 metadata namespace로 위장하면 안 됩니다. actual core inspector/native compiled surface·history policy/foreign CONNECT/default ACL/current issuer와 own+metadata4 publication의 composition 시험이 별도로 필요합니다. Main hook·생산 credential registry·durable INSPECTION/publication/current vector·8 runtime-only app·13 private bootstrap·renewal/offline/customer activation은 아직 OPEN입니다.
