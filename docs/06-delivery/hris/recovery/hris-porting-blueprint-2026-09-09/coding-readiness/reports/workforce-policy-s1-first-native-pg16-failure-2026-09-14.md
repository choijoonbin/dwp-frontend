# S1 첫 native PG16 실패 — 실제 초기화 반례

상태: ACTUAL_NATIVE_INITIALIZATION_FAIL, 1 testcase/1 FAIL·0 error/skip, 정상 Auth 업무 검증은 실행되지 않았습니다. G3_CLOSED입니다.

- UTC 2026-09-14 11:39:04.099658Z–11:39:15.779118Z, exit1, 11.679815042초, timeout=false. 호스트 잠금은 11:39:17.010Z에 해제됐습니다.
- 새 격리 PG에서 기존 114개 마이그레이션이 실제 v212까지 성공했습니다. immutable migration/프로덕션/기대값은 변경하지 않았습니다.
- @BeforeAll TEST_ONLY 사용자 INSERT에서 maker900010이 기존 V40 493행 Provider Tenant Provisioner의 PK와 충돌했습니다. checker900011/target900012도 V40 495/497행의 기존 Provider 계정입니다. 이 단계 이후 실제 factory/evaluator/JWT/session 정상검증은 진행되지 않았습니다.
- 수정안은 기존 Provider seeds·SQL·actor900009를 보존하고 신규 TENANT fixture maker/checker/target만 사용되지 않은 941010/941011/941012로 분리하는 것입니다. distinct maker/checker·TENANT target·정상/거부 기대를 그대로 유지하며 ON CONFLICT로 기존 신원을 덮어쓰지 않습니다. Root 검토 후 최소 fixture 변경을 별도 실행으로 검증합니다.
- native fractional timestamp 이스케이프 가설은 실행 반례 0·수정 0으로 유지합니다.

## 완전 증거

[45개 ACK 청크·원문/XML/source/docker events JSON](workforce-policy-s1-first-native-pg16-failure-2026-09-14.json) SHA는 `835eda67c9eea4d14a5ec29fd8cd1fe464e5955d7ce6e072e23b229d023337f1`, ns는 `1789386028682717904`입니다. 저장 파일을 읽어 gzip SHA `01f9dcb35a2c1978a603bc06306e9fa3b932c3d1a938fdd0495d044a6e4fd013` 및 receipt SHA `5e774fc1def5d1e7152e3034d5fc3975a61c2b364e265d27f730ef6e82f853db`을 대조했습니다. fresh XML SHA는 `34eca62cfd16e66bd9cb44d435230cccb076a6d645cf075a8cdec11ccd1fa44c`, ns는 `1789385955342090745`입니다.

전후 3,068개 SHA/바이트/정확한 ns 문자열 소스 튜플이 같습니다. 이전 단위 실행 3,066개와 다른 것은 새 완결 Control test/helper 2개가 추가됐기 때문이며 수량을 고정 승인 상수로 쓰지 않습니다.

Owned PG `81764428de32beb1b7146d95367f5c254153feedce8c86e93b6fd3e400e49381`, Testcontainers session `21d4b1d5-956e-4b17-bb67-c00a4d25613d`의 create/start/die/destroy를 XML와 native Docker events로 대조했습니다. 이후 PG 및 같은 Ryuk `17295c396bb0` 모두 실제 inspect에서 ABSENT입니다. 종료는 Testcontainers 자동 정리이며 수동 stop은 0건입니다. protected 사용자 PostgreSQL/Redis/Kafka 및 타 작업 컨테이너는 건드리지 않았습니다.

실제 argv:

```text
./gradlew :dwp-auth-server:test --rerun --tests com.dwp.services.auth.service.WorkforcePolicyGovernanceAuthorityAdapterV1PostgresTest --no-daemon --max-workers=1
```

120초 task 상한·30초 host semaphore·no-daemon·worker1입니다. Docker 없음은 silent skip하지 않습니다. S1 READ evidence는 command permit가 아니고 TEST_ONLY 등록은 제품 capability/duty/SoD 등록·배포 승인이나 전체 native PEP/transport/S2S3 consume fence 완료가 아닙니다.
