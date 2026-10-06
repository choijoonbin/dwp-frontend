# S1 native PG16 — TEST_ONLY v7가 생산 lineage guard에 거부된 실제 실패

상태는 `ACTUAL_NATIVE_INITIALIZATION_FAIL`입니다. 실제 권한 업무 testcase는 0건이며 G3는 닫히지 않았습니다.

- UTC 12:03:35.721975–12:03:50.235303, exit 1, timeout false, source 3,068개 전후 동일, host lock release 12:03:51.006Z입니다.
- clean migration DB의 pointer 0 처리는 통과했습니다. 이어 fixture가 classpath 정본 v6에서 `base.version()+1`로 테스트 후보 v7을 만들었지만, 생산 `ProductAuthorizationContractValidator`가 immutable lineage 1..6만 허용해 line 186에서 정확히 거부했습니다.
- 이 거부는 생산 validator가 정상 작동한 증거이므로 validator·계약·기대값을 완화하지 않습니다. 최신 직전 정본 v5를 fixture base로 읽으면 기존 `+1` 로직이 허용된 TEST_ONLY v6 후보가 되며, 실제 validator→importDraft→독립 maker/checker approve→pointer0 activate 경로는 그대로 유지됩니다. 수정 범위는 테스트 resource 문자열 1줄뿐입니다.
- [45 ACK 청크 lossless 원문](workforce-policy-s1-native-pg16-after-catalog-fixture-lossless-2026-09-14.json)은 archive SHA `0fb52949bef8b8f6747a3e75d910d62f7736336789f655721f27b654c7b7152e`, receipt SHA `4237fa18fc266de8be5e080ab4ac6ef234cc685266918129e5e15d082c7d7622`, fresh XML SHA `96a69d6accf6fc27f5f545e4c260bae1317e9959221c8d851b3bb928b1efe3ec`를 보존합니다.
- owned PG `110cbabf...`와 Ryuk `67e3a5ac...`는 자동 제거 후 exact inspect ABSENT이며 수동 Docker 조작은 0건입니다.

S1은 READ evidence 후보일 뿐 command permit·People mutation·durable consume/revoke·제품 catalog 게시·전체 G3 승인이 아닙니다.
