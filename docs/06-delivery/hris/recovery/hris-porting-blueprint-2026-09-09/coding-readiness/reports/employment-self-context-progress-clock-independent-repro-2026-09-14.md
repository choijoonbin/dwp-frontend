# 기존 SelfContext 실시간 진행 시계 P0 재현

상태: INDEPENDENT_ACTUAL_POSITIVE_REGRESSION_FAIL / COMMON_P0_CONFIRMED / G3_CLOSED.

정상 owner 조회 중 시간 경과만으로 fresh native Auth binding이 거부되는 실제 공통 결함을 재현했습니다. 올바른 기대값 SELECTED를 변경하지 않았고, 현재 production Guard는 AUTH_BINDING_STALE를 던져 테스트1개가 실제 실패했습니다. source 변경·guard 우회·skip은 없습니다.

UTC 2026-09-14T04:55:37.441908+00:00 → 2026-09-14T04:55:51.517850+00:00; 14.064476초; Gradleexit1; tests1/failure1/error0/skip0. 기존 host lock 아래 --no-daemon/--max-workers=1/--continue로 단일 neutral testcase만 실행했으며 native PostgreSQL/HTTP는 실행하지 않았습니다. source192개 pre/post SHA와 decimal-string ns는 동일합니다.

실제 argv:

```text
./gradlew :dwp-platform-contracts:test --tests com.dwp.platform.contracts.hris.identity.v1.IdentitySelfContextProgressClockRegressionTest --no-daemon --max-workers=1 --continue
```

새 IdentitySelfContextProgressClockRegressionTest는 trusted Clock 초기t0, Auth native read 후t0+1 capture, expiry t0+10을 typed DTO로 제공합니다. 정상 binding 자체는 아직 만료되지 않았으며 People read 후t0+2에서 SELECTED를 기대합니다. 그러나 현재 Guard는 최초t0를 checkBinding에 그대로 넘겨 capture t0+1을 future처럼 취급합니다.

실제 stack은 GuardedSelfContextPortV1.require:220 → checkBinding:102 → resolve:61 → regression:39이며, message는 Self-context contract rejected: AUTH_BINDING_STALE입니다. [정확한 원문·XML SHA/ns·192 source manifest](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/employment-self-context-progress-clock-independent-repro-2026-09-14.json)에 보존했습니다.

작성자 root가 각 owner 반환 후 monotonic trusted Clock 및 current lease를 검증하도록 보완한 뒤 동일 positive fixture를 재실행해야 합니다. 실패 기대값을 AUTH_BINDING_STALE로 바꿔 PASS를 만들지 않습니다. 앞선79개는 fixed synthetic Clock 입력에 대해 실제 통과한 제한된 역사 증거이며 실시간 native production 통합의 승인으로 확대하지 않습니다. 신규 SelfPerson은 이 패턴을 복사하지 않고 각 owner 호출 후/최종 발급 시 시계를 검증하지만 아직 작성자 테스트/독립 검토 전입니다.

