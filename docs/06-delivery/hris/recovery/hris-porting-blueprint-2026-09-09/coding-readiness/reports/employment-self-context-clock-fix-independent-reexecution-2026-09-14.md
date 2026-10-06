# 고용 SelfContext 실시간 시계 보완 독립 재실행

상태: **실제 실행 FAIL / G3 CLOSED**. 원본 실패 재현 후 root의 고용 Guard 보완을 독립 재실행한 기록입니다. 새 SelfPerson 작성자 검증은 이 실행에 포함하지 않습니다.

UTC 2026-09-14T04:58:01.228237+00:00 → 2026-09-14T04:58:34.925775+00:00; 33.697087초, Gradle exit 1.

- 실제 10 XML suite, 165 tests, 4 failures, 0 errors, 0 skips.
- 진행 시계 정상 회귀 1건 PASS. 기존 native reader 79건(실제 격리 PG 35 / JDBC 단위 44), consumer 4건, generated contract 22건 PASS.
- 기존 IdentitySelfContextContractTest 59건 중 시계 단계·호출 횟수 가정 4건 FAIL. 만료/역행 거부 자체는 수행됐으나 해당 fixture의 provider 호출 횟수 기대가 불일치합니다.
- 새 Guard는 verifier/Auth/People 호출 후 시각과 만료를 재검사합니다. `issuanceRechecksCurrentClockAndBothLeases`의 3개 fixture는 두 번째 clock read에서 시간을 이동해 새 조기 검사가 owner 호출 전에 거부합니다. expected 1, actual 0입니다.
- `queryClockCapturedOnceAndIssuanceClockRecheckedWithValidatedBinding`은 실제 clock reads 4회인데 2회를 기대합니다.
- 안전 검사를 약화하거나 만료를 허용해서 해결하면 안 됩니다. owner callback에서 시각을 이동해 의도한 단계의 만료를 검증하고, 보완된 실제 호출 단계와 단일 query.asOf 고정을 확인한 뒤 동일 scope를 재실행해야 합니다.
- 192 관련 source의 SHA-256 및 decimal-string mtime ns는 실행 전후 동일합니다. HEAD/tree 및 승인된 dirty 파일, 정확 argv, 모든 XML SHA/ns/case ID/실패 원문은 동명 JSON에 보존했습니다. lock은 해제했습니다.

권한 검증기는 명시적 mock입니다. native owner SQL 조회 성공을 Auth→Gateway end-to-end, 실제 current PEP, signed transport, lifecycle ordering 또는 전체 HRIS/G3 준비완료로 승계하지 않습니다.
