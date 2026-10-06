# Control metadata 실제 consumer — 실패 전 증적

판정: 작성자 범위의 실패 보존. G3 승인 아님. 기존 generic 20개 역사 증적은 변경하지 않았다.

## 실제 실행

- 첫 readonly 반례: 10:44:30.912794→10:44:44.368752 UTC, native exit 1, 1 FAIL / error·skip 0. TEST_ONLY 기준 풀은 정상이고 ACTIVE fence 복구 후 실제 consumer가 NativeObservation.present를 거부했다. 원래 로그인 풀 readOnly=false였다.
- 첫 후처리 TypeError는 native 실행 이후의 기록기 오류다. 첫 XML/bridge/test 저장 파일을 즉시 읽어 보존했지만 전체 최초 stdout/source manifest archive를 회수하지 못했다. 이를 완전 증적으로 과장하지 않았다.
- 같은 반례 재실행: 10:48:20.704566→10:48:35.734651 UTC, native exit 1, 동일 1 FAIL. 이번 full stdout/stderr/XML/source379 manifest gzip는 보존했다. 신규 fixture의 foreign CONNECT ACL 정리만 보완했고 healthy 기대값은 변경하지 않았다.
- combined 34 실행은 180초 상한 timeout이다. fresh XML 0, 남은 before XML은 stale이므로 제외했다. full pre/post manifest는 회수하지 못했다. partial binary 원문·tool traceback과 exact owned PG2/Ryuk1 ABSENT를 보존했다. 수동 종료 0, PASS 0이다.
- consumer14 단독: 11:06:39.400216→11:08:09.058314 UTC, native 89.661706초, exit 1, 12 PASS / 2 FAIL / error·skip 0. source379 SHA/ns 전후 일치. cleanup 후 11:08:19.720Z host 해제; owned PG/Ryuk ABSENT, processgroup 없음, 수동 종료 0.

## 두 test 계약 오류

실제 healthy NativeObservation.present와 원래 JDBC pool 복구는 통과했다.

1. primary runtime label: 새 test가 IllegalArgumentException을 기대했지만 frozen ExpectedSource→RuntimeStartupValues는 IllegalStateException으로 거부한다. 업무 거부 자체는 정상이다.
2. catalogMutation: inspector.empty, ACTIVE 복구와 JDBC 상태 복구 assertion 뒤 최종 serving restore가 기존 SystemCatalog guard의 pg_catalog.pg_class UPDATE 권한 초과 검증으로 거부됐다. DatabaseControl은 catch에서 FAILED로 fail-close한다. 새 test의 unconditional final-serving-success 기대가 잘못됐다. 이를 성공 복구라고 부르지 않는다.

Root가 실제 core/fence 계약을 읽고 신규 test만 두 기대값을 정정하도록 승인했다. empty 검사·ACTIVE 검사·원래 JDBC 상태 검사는 유지하고 final serving restore는 throws + FAILED + noForeignSessions를 요구한다. frozen core/bridge/기존20 기대값은 변경하지 않는다.

## 생산 코드 최소 수리

bridge 2524fdf3…→4af8b071…: 등록 metadata principal의 원래 로그인 factory에만 PostgreSQL readOnly=true 속성을 공급했다. generic credential rejection 및 runtime 로그인은 기존 default false를 유지한다. Inspector가 flag를 제조하거나 SET ROLE/owner fallback을 추가하지 않았다. 설치된 PG JDBC42.7.11의 READ_ONLY 속성 지원은 javap로 확인했다. jar SHA는 JSON에 보존했다.

## 범위와 한계

실제 composition은 auth metadata 슬롯 하나다. 네 metadata source publication, signed current issuer/vector, Sourceepoch, Main hook, Spring pool 등록, 앱8 runtime-only wiring 및 13-stream bootstrap 증거가 아니다. 기준 policy/surface는 mutation 이전 독립 TEST_ONLY fixture 기대값이며 production 승인 입력으로 사용할 수 없다. Standalone native observation은 lease/freshness/current authority를 대체하지 않는다. 역사적 generic20 및 과거 Core/People native 결과와 합산하여 whole-current PASS로 주장하지 않는다.

JSON에는 실제 argv·Popen PID/PGID·UTC·source/ns·전체 freshXML/cases·압축 원문·source UTF8 snapshot·exact cleanup을 담았다. 독립 승인 없음.

