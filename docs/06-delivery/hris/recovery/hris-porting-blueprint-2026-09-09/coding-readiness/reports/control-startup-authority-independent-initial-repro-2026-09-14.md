# 외부 Control 시작 lease 후보 독립 반례 실행

상태: **독립 실제 반례 FAIL / G3 CLOSED**. root 작성 후보 production2/native15/build에 제가 작성한 독립 unit9/native5를 추가해 검증했습니다. production·legacy/core10·SelfPerson·SQL·Gate·정본 수정 0입니다.

UTC 2026-09-14T05:32:10.218226+00:00 → 2026-09-14T05:32:28.331429+00:00, 18.112681초, Gradle exit1. **3 XML / 29 고유 cases / 9 failures / 0 errors / 0 skips**. root native15는 통과했고 독립 unit7/native2에서 반례가 재현됐습니다. `verifyMigrationControlRuntimeClasspath`는 실제 PASS로 단일 sealed core 프로젝트 dependency/외부 Jackson/Control own resources0 경계를 확인했습니다.

## 실제 발견

- F01: transport provider/Clock 오류가 execute try 바깥에서 발생해 synthetic sentinel 메시지가 reserve/activate/current/release로 전파됩니다. null Optional은 raw NPE, null initial Clock는 pool을1회 열어 expected0에 실패했습니다. 실제 운영 비밀을 넣지 않았으며 sentinel은 테스트 문자열입니다. generic/no-cause 거부와 invalid ingress pool0이어야 합니다.
- F02: identity의 첫 `current_database()`가 search_path 정규화 전 unqualified입니다. 실제 private PG에서 같은이름 routine을 shadow하여 실제 catalog `independent_startup_catalog`를 `forged_startup_catalog`로 보고하게 했고, 잘못된 기대 catalog로 signed lease가 발급됐습니다. `pg_catalog.current_database()`는 실제 이름을 확인했습니다. catalog mismatch는 native row 변경 전에 거부해야 합니다.
- F03: native lease reserve t0→activate t2→current t1에서 future-issued ACTIVE 응답이 발급됐습니다. permit window 안에서 발생한 호출 간 Clock 역행이므로 entered/now의 단일 호출 비교로는 잡히지 않습니다. persisted issued_at보다 현재 시각이 이른 경우 거부해야 합니다. **앱 runtime guard는 future lease를 거부하므로 현재 앱 권한 상승으로 주장하지 않습니다.**

반면 signing 도중 만료된 native lease/permit 쓰기는 transaction rollback됐고 original native login mismatch는 쓰기 전 거부됐습니다. activate vs beginDrain 동시 실행도 durable epoch2/DRAINING/permit REVOKED·old current 거부를 확인했습니다. 이 race는 linearization이며 in-flight 응답 철회/native 세션 offline 또는 DDL 허가를 증명하지 않습니다.

## 증거와 범위

296 source의 full pre/post SHA/bytes/path/decimal-string ns를 실제 캡처·비교해 동일했습니다. 동일 post array는 복사 생략을 명시했으며 독립 계산된 두 manifest SHA 8d263d6f2c7f5c7b7b57c0b9a51e9405153cae1bdd59f1cc4e632a979315e546가 같습니다. JSON에는 전체 pre source manifest, 정확 argv/UTC/HEAD/tree/dirty snapshot/exit, 모든29 ID·결과·실패 원문, 3 XML SHA/ns/gzip-base64 원본 archive를 보존합니다. exact owner2PG+sharedRyuk1만 read-only inspect해 REMOVED를 확인했고 주서버/임의 container를 종료하지 않았습니다. lock은 해제했습니다.

첫 실패 실행도 동일29/9FAIL이었지만 도구 poll budget 오류로 manifest 출력이 절단돼 exact 최종 증거로 사용하지 않았습니다. source를 변경하지 않고 다시 완전 캡처한 실행을 이 보고서에 사용했습니다. 실패를 회피하는 source/fixture 변경은 없었습니다.

**미완료:** 승인된 실제 Control schema/column grants·role flags/membership/owner/PUBLIC/TEMP/endpoint baseline verifier, key lifecycle, signed seal·permit 실제 publisher, authenticated transport, ControlMain-native offline/13-stream bootstrap/continuous renewal는 OPEN입니다. native15 통과/name-only 검사/제한된 spoof 보완을 full native authority 또는 전체 HRIS 준비완료로 세탁하지 않습니다. production 보완은 root에게 전달했고 같은 회귀의 후속 재검증은 별도 보고서에 기록합니다.
