# External Control 시작 권한: 보완 후 독립 재실행

상태: **제한 후보 31개 통과 / G3 CLOSED**. 작성자 native15와 독립 unit9/native7을 실제 재실행했다. 초기 29/9 실패 및 후속 31/11 실패 보고서는 보존하며, 이 결과는 전체 HRIS 개발 Gate나 운영 Control authority 승인이 아니다.

## 실제 실행 증거

- UTC 2026-09-14 05:49:07.997577–05:49:39.886616, 31.886755초, Gradle exit0.
- 31개 고유 case 모두 통과, failure/error/skip 0. 수정 전 31개와 exact case ID가 같고, 세 테스트 파일 SHA도 동일하다.
- 세 suite: 작성자 native15, 독립 native7, 독립 no-PG9. PostgreSQL16 disposable catalog와 실제 역할을 사용했지만 authenticated invocation은 explicit fixture이다.
- 296개 관련 소스 SHA·정확 decimal-string ns 전후 동일. 실행 전후 status 동일(승인된 후보 변경이 있는 integration worktree이며 clean/full-HEAD proof가 아니다).
- pre/post manifest SHA `74a451b49a288b098255099bf4c520f094f4fc04bdf60e51aca1ad3fc1008be8`.
- task-local `--rerun` 실제 test 실행; `verifyMigrationControlRuntimeClasspath` 통과. 수정 Authority compile은 실제 수행, 종속 compile의 UP-TO-DATE는 JSON에 별도 보존한다.
- 소유 PostgreSQL2 + shared Ryuk1 exact-ID read-only inspect 모두 제거 확인. main DB/서버/container 종료 작업 없음.

```text
./gradlew :dwp-migration-control:verifyMigrationControlRuntimeClasspath :dwp-migration-control:test --rerun --tests com.dwp.migration.control.startup.v1.ControlStartupLeaseAuthorityV1*Test --no-daemon --max-workers=1 --continue
```

## 실제 보완 확인

수정 전후 296 source 중 바뀐 것은 Root 소유 Authority 1개뿐이다. 현재 SHA `55235d7762f92a53e7a6b42a8efb0bd08b38b3cca38c12eef173628f36b41114`, ns `1789364377490027282`. 검사자는 생산 소스를 수정하지 않았다.

| 지적 | 수정 전 실제 실패 | 같은 테스트 재실행 결과 |
| --- | --- | --- |
| F01 입구 transport/Clock 예외·null | 7 | generic/no-cause, pool0 거부 통과 |
| F02 search-path catalog spoof | 1 | 실제 pg_catalog catalog 불일치 거부 통과 |
| F03 persisted issuedAt 이후 시간 역행 | 1 | native 저장 시간보다 이전 Clock 거부 통과 |
| F04 nanos→PG micros canonical 불일치 | 2 | 같은 reserve retry/current signed lease 일치 통과 |

전체 코드를 독립 재독했다. 최초 provider/Clock 검사를 redaction try 안에 두고, native identity 함수를 qualification하며, 저장 issuedAt와 현재 시간을 비교한다. raw Clock monotonic 검사를 유지하면서 DB 저장 시간은 MICROS floor한다. 변경 후 실제 FOR UPDATE row를 다시 읽고 예상 immutable 값과 동일함을 검사해 그 행만 서명한다. expiry floor는 승인 window를 줄이며, DB 반올림으로 미래 시간이나 lease가 늘어나는 것을 막는다.

기존 signing 중 expiry rollback·native login mismatch·activate/drain 경합 및 작성자 native15도 유지되어 모두 통과했다. 테스트를 삭제·skip·약화하거나 fixture를 synthetic 정상 결과로 대체하지 않았다.

## 여전히 OPEN

승인된 immutable native Control schema·role attributes/membership·정확 ACL/PUBLIC/default/routine/TEMP·endpoint/server identity 전체 verifier는 미완료다. 실제 authenticated invocation transport·permit/seal publication, ControlMain native offline fencing, 현재 13-stream wiring·renewal·key lifecycle도 OPEN이다. 이 테스트 catalog의 제한 grants를 승인된 production Control schema로 주장하지 않는다.

동명 JSON에 296개 full pre-manifest와 동일 post 비교 표현, 31개 case ID, 3 XML gzip/base64·SHA·정확 ns, argv/환경/시각/exit/task outcomes/container 확인을 보존했다. 이 제한 독립 검증을 production E2E·현재 전체 BE check·모듈 G3 승인으로 승계하지 않는다.
