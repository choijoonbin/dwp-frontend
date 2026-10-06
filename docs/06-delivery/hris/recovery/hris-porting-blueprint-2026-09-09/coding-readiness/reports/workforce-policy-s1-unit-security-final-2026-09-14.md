# S1 단위·보안 작성자 검증 — 같은 58개 기대값 통과

상태: AUTHOR_SUBSET_PASS. G3_CLOSED이며 전체 HRIS/native PEP/배포 준비 승인은 아닙니다.

- UTC 2026-09-14T11:30:31.053482+00:00–2026-09-14T11:30:47.888774+00:00, exit0, 16.835772624999997초, timeout=false입니다. 호스트 잠금은 2026-09-14T11:30:48.964Z에 해제됐습니다.
- 닫힌 request/schema/decoder/digest/missing-owner 검증 34개와 실제 전용 보안 필터 체인·HS256/default JWT validator 검증 24개, 총 58개 distinct ID가 실제로 통과했습니다. 오류·실패·건너뜀은 모두 0입니다.
- 두 XML은 실제 시작 이후 생성됐으며 raw XML을 다시 읽어 58개 ID의 중복 없음과 모두 passed를 확인했습니다.
- 전후 3,066개 소스 SHA/바이트/정확한 ns 문자열 튜플이 같습니다. canonical sorted JSON manifest SHA는 `b967f76be7ab4f07316a5d9e550701e76adef89c9cc7bdbd4b350d4aec5fa552`입니다.
- 생산 4개·기존 build/JWT/native Encoder/session/factory/SQL/catalog·assertions/기대코드는 변경하지 않았습니다.
- 신규 테스트만 actual FilterChainProxy를 직접 연결하고, 기존 native 규칙과 동일한 명시 HS256으로 서명하며, 두 parameterized 메서드 이름을 displayName에 포함했습니다.
- 기존 compile 실패와 58record/55ID/2FAIL 원문은 별도 보고서 그대로 보존했습니다. 이 결과로 과거 실패를 덮어쓰거나 소스-only 가설을 실제 반례로 표현하지 않습니다.

## 실제 범위

보안 단위 테스트의 authority adapter는 MOCK입니다. 이 실행은 실제 native Auth session/person/current tables나 Auth→Gateway→People 통합을 검증하지 않았습니다. 그 native PG 실행은 0개입니다. S1의 결과는 READ_ONLY_NOT_COMMAND_PERMIT이며 signed transport/current proof·S2/S3 consume/store/writer fence·실제 People mutation PEP를 구현하지 않았습니다.

Native fractional LocalTimestamp 이스케이프 가설은 수정 0·실행 반례 0 상태입니다. 다음 native 정상 fixture에서 실제 결과를 확인한 후 동일 기대값으로 최소 보완 여부를 판단합니다.

## 완전 증거

[전체 소스 전후 튜플·원문/XML 압축 JSON](workforce-policy-s1-unit-security-final-2026-09-14.json) SHA `1e1214edbda5a1ea037b7a979836d955763a73a36e069b1da134586863f87085`, ns `1789385534835790847`입니다. 44개 ACK 청크·completion을 확보하고 파일 readback으로 gzip SHA `7f7a04d02a37f95ab090f39a3a5a661788139b725ac56973571e01aeaac50279` 및 receipt SHA `b773cffbb797e378df061bdbf830e34b25041ccaa2487e03f3e8b79699bcd124`을 직접 대조했습니다.

[읽을 수 있는 58개 case ID·XML/소스 핀 요약](workforce-policy-s1-unit-security-final-readable-2026-09-14.json)에 실제 ID와 XML hash/ns, 후보 7개 핀, 정확한 시작/종료/잠금/manifest를 실었습니다.

- com.dwp.services.auth.service.WorkforcePolicyGovernanceAuthorityAdapterV1Test: 34 tests, SHA `1c0af2c125a0508b7fa96523fbb13e608927c270822fbfae319187ce3394751e`, ns `1789385447468467306`.
- com.dwp.services.auth.config.WorkforcePolicyGovernanceInternalSecurityConfigV1Test: 24 tests, SHA `f44fd4dcf3a0d1981e5b52ac0d62f3a4da653bd162d4650b0797cde245663e94`, ns `1789385447470352462`.

실제 argv:

```text
./gradlew :dwp-auth-server:test --rerun --tests com.dwp.services.auth.service.WorkforcePolicyGovernanceAuthorityAdapterV1Test --tests com.dwp.services.auth.config.WorkforcePolicyGovernanceInternalSecurityConfigV1Test --no-daemon --max-workers=1
```

Corretto 23.0.2, host semaphore 30초, worker1, no-daemon, task 120초 상한을 사용했습니다. 사용자 서버/컨테이너 수동 종료는 0건입니다. Root 독립 소스/실행 검토 전 commit/정본 전파/모듈 Gate 승인은 하지 않습니다.
