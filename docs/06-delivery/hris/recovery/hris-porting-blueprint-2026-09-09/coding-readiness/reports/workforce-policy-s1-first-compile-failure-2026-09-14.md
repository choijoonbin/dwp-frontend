# S1 첫 컴파일 실패 — 원문 보존

상태: 실제 COMPILE_FAIL, 테스트 0개, XML 0개. G3는 CLOSED이며 HRIS 준비 완료를 승인하지 않습니다.

- 동일 7개 후보 소스와 기대값을 변경하지 않고 2026-09-14 11:12:10.581166Z–11:12:26.223625Z에 재실행했습니다. exit1, 15.643097833초, timeout=false입니다.
- 호스트 잠금은 11:12:27.321Z에 해제됐습니다. 사용자 서버나 컨테이너를 수동 종료하지 않았습니다.
- 전후 3,066개 소스의 SHA/바이트/정확한 ns 문자열 튜플이 모두 동일합니다.
- 원인은 신규 SecurityTest 56행과 PGTest 296행에서 설치되지 않은 spring-security-test의 SecurityMockMvcConfigurers를 참조한 컴파일 오류 2건입니다. 프로덕션 컴파일 단계는 UP-TO-DATE이며 테스트 실행까지 도달하지 않았습니다.
- 최초 비-tty 캡처는 ACK stdin EOF로 44개 중 1개 청크만 확보했습니다. 그 메타데이터는 불완전 관측으로만 보존하며 완전 검증 증거로 승계하지 않습니다.
- 동일 소스 tty 재실행은 44개 전체 청크와 ARCHIVE_COMPLETE를 확보했습니다. 저장 JSON을 다시 읽고 압축 및 원문 SHA, 원문 바이트 수, 전후 소스 튜플을 직접 대조했습니다.

## 완전 증거

[JSON 압축 원문과 정확한 실행/소스 목록](workforce-policy-s1-first-compile-failure-2026-09-14.json)은 receipt 1,449,504바이트를 포함합니다. JSON SHA는 `3bd459b04996f9a648f4152e5ef56432ecf0d65fa4b3f326a75099b8f3ce9508`, mtime ns는 `1789384550414386862`입니다. gzip SHA는 `14da09258664a8d8184bccfae63807370290322293b20aafa73eed2020c14c61`, 해제된 receipt SHA는 `4938aa5540af031d182536c68890f56dfbb8b36acf7f7349947fc63311243295`입니다.

실제 argv:

```text
./gradlew :dwp-auth-server:test --rerun --tests com.dwp.services.auth.service.WorkforcePolicyGovernanceAuthorityAdapterV1Test --tests com.dwp.services.auth.config.WorkforcePolicyGovernanceInternalSecurityConfigV1Test --no-daemon --max-workers=1
```

## 승인된 최소 수리

Root의 소스/빌드 독립 확인 후 신규 테스트 두 곳만 실제 기존 FilterChainProxy를 MockMvc.addFilters로 연결하도록 수리합니다. 의존성·프로덕션 4개 파일·기존 JWT/session/factory/SQL/catalog·기대값은 변경하지 않습니다. 수리 후 실행 결과는 이 실패 증거를 덮어쓰지 않는 후속 보고서에 보존합니다.

이 기록은 S1 작성자 집중 검증입니다. 현재 READ evidence는 command permit가 아니며 S2/S3 consume/store/writer fence, 전체 native PEP, 고객 배포 및 G3 승인으로 확대하지 않습니다.
