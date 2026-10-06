# External Control 시작 권한: 시간 정밀도 추가 독립 반례

상태: **수정 전 실제 실패 보존 / G3 CLOSED**. 초기 29개 실패 보고서는 그대로 보존한다. 작성자 native 15개와 독립 unit 9개·native 7개를 실행한 제한 검사이며, 현재 13-stream 배선·ControlMain·실제 인증 transport 또는 승인된 native ACL 전체를 인증하지 않는다.

## 실행

- UTC 2026-09-14 05:38:42.400209–05:38:55.061872, 12.661257초, Gradle exit 1.
- 31개 고유 case, 실패 11 / 오류 0 / skip 0. 기존 9개 실패 유지, 추가 시간 정밀도 반례 2개 모두 실패.
- 296개 source의 SHA·정확한 decimal-string ns 전후 동일. manifest SHA: `e5d248a39682f855025f4ac687551825b16688638fb703a95b5318516a98e24c`.
- task-local `--rerun`으로 선택한 Control 테스트가 실제 실행됨. `verifyMigrationControlRuntimeClasspath` 통과. 종속 compile UP-TO-DATE와 실제 테스트 실행은 JSON의 task outcomes로 구분한다.
- 소유 PostgreSQL 2개와 같은 JVM의 shared Ryuk 1개 exact-ID read-only inspect에서 모두 제거 확인. 서버 종료·삭제 작업 없음.

```text
./gradlew :dwp-migration-control:verifyMigrationControlRuntimeClasspath :dwp-migration-control:test --rerun --tests com.dwp.migration.control.startup.v1.ControlStartupLeaseAuthorityV1*Test --no-daemon --max-workers=1 --continue
```

## 새 실제 결함 CONTROL_F04

수정 전 Authority SHA `87fd4171163b0814007a3cbb6abc2497826a2ce897e5b7e57f7cc1dfa4ac3932`.

최초 reserve/activate는 Java Instant nanoseconds를 서명하지만, retry/current는 PostgreSQL에 저장된 microseconds를 서명한다. 같은 lease의 immutable native 값에 대한 응답이 달라져 canonical idempotency가 깨진다.

| 반례 | 최초 issuedAt | 같은 native lease 재조회 issuedAt |
| --- | --- | --- |
| RESERVE_RETRY | 05:00:00.123456789Z | 05:00:00.123457Z |
| ACTIVE_CURRENT | 05:00:02.987654321Z | 05:00:02.987654Z |

첫 사례는 DB 반올림으로 211ns 미래가 되고 expiry도 같은 방식으로 늘어난다. 명시적인 native microsecond floor와 실제 저장 row 기반 서명이 필요하며, 원래의 실시간 monotonic clock 검사와 storage precision을 구분해야 한다. 승인 window/lease를 확대해서 해결해서는 안 된다.

기존 CONTROL_F01(입구 예외·null redaction), F02(search-path catalog spoof), F03(호출 사이 stored-issuedAt 시간 역행)도 같은 동결 입력에서 다시 실패했다. 작성자 native15는 통과했고, signing-expiry rollback·native login·activate/drain lock 경합 양성/음성 3개도 통과했다. full native Control ACL/role/endpoint baseline 및 실제 transport·publication·renewal은 별도 OPEN이다.

## 증거 경계

동명 JSON에 296개 full pre-source manifest, 전체 비교 후 동일한 post-manifest 표현, 31개 case ID와 실패 원문, 3개 XML gzip/base64·SHA·정확 ns, 실행 시각·환경·argv·exit·소유 container 제거 확인을 보존했다. mock invocation을 Auth/Gateway production 연계로 승계하지 않는다. 검사 작성자는 production 코드·SQL·기존 봉인·Gate를 수정하지 않았다.
