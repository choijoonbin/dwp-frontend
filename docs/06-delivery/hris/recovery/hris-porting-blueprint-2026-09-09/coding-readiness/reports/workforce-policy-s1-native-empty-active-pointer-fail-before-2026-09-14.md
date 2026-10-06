# S1 native PG16 — 빈 active pointer 실제 실패

상태는 `ACTUAL_NATIVE_INITIALIZATION_FAIL`이며, 실제 권한 업무 testcase는 아직 0건입니다. G3는 닫히지 않았습니다.

- Docker daemon이 자연 회복된 뒤 같은 PG16 단일 클래스를 UTC 11:57:10.418910–11:57:21.547910에 실행했습니다. exit 1, timeout false, source 3,068개 전후 동일, `hris-verification` 잠금은 11:57:23.011Z에 해제됐습니다.
- 앞선 V40 사용자 PK 충돌은 941010/941011/941012 테스트 신원 분리로 통과했습니다. 다음 초기화 단계에서 clean 114-migration/v212 DB에 active `product-surfaces` pointer가 없는데 테스트가 `findActive(...).orElseThrow()`로 이미 존재한다고 가정하여 `NoSuchElementException`이 났습니다.
- 이는 운영 마이그레이션이 seed를 의도적으로 DRAFT/default-off로 두는 정책과 일치하는 환경에서 드러난 **TEST_ONLY fixture 선행상태 오류**입니다. 생산 adapter·controller·security·contract와 업무 기대값은 변경하지 않았습니다.
- Root 확인 후 classpath 정본 `product-surfaces-v1.bundle-v6.generated.json`을 실제 validator로 읽어 테스트 후보 v7의 base로 사용하고, 최초 pointer가 없을 때 실제 `activateGoverned` 계약대로 expected revision 0을 넘기도록 fixture만 수정했습니다. 역변환 SHA가 실행 전 테스트 SHA `4f6c0501...`와 정확히 일치합니다.
- [45 ACK 청크 lossless 원문](workforce-policy-s1-native-pg16-retry-lossless-2026-09-14.json)은 archive SHA `97f99d59df69b874af228f765fcad02e7261adbe1e781f82a137fe652e80672d`, receipt SHA `6a76ddd6d6160fdfd725f6b958c757ec3b45061c817872c94b054813a62c5cc3`, fresh XML SHA `ad45d02739bfe483de4bbdac957ea4c7d463904a5527b8160fd74fd2b5d8da33`를 보존합니다. owned PG `0bbc3e7f...`는 자동 kill/die/destroy됐고 보호 컨테이너에는 수동 조작하지 않았습니다.

수정 후에도 같은 PG16 클래스를 그대로 재실행합니다. 추가 실패가 나타나면 성공으로 덮지 않고 새로운 before 증거로 먼저 보존합니다. 이 S1은 끝까지 READ evidence이며 command permit·People write·durable consume/revoke·전체 G3 승인이 아닙니다.
