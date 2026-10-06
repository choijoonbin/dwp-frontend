# Control adopted-ACTIVE 재접속 반례 — 실제 PG16 before 증거

상태는 `EXPECTED_COUNTEREXAMPLE_OBSERVED`이며 이 결과는 코딩 Gate 통과가 아니다.

- 실제 대상: 변경되지 않은 공개 `MigrationControlMain.main` 경로
- 실행: PostgreSQL 16, 4개 고유 케이스, 3 PASS / 1 targeted FAIL, 오류·skip 0
- 시간: 2026-09-14 11:59:25.342324Z ~ 12:00:05.158695Z, native 29.579573초
- 반례: BASELINE에서는 기존 v2 predecessor 검증이 성공하지만, Control이 ACTIVE로 전환해 runtime의 CONNECT를 차단한 뒤 `runAdoption -> legacyBoundary -> verifyBeforeMigration -> verifyControlPrincipal -> ControlDataSource.getConnection`이 runtime으로 다시 접속하여 SQLSTATE `42501`로 fail-closed 된다.
- 보존성: receipt/history snapshot은 전후 동일했고, 486개 대상 source의 SHA-256 및 mtime ns가 동일했다. production/test source 쓰기는 0이다.
- 격리·정리: 외부 Gradle PID/PGID 9304의 종료 후 process group은 비었고, 이번 실행에서 관찰한 PostgreSQL/Ryuk 컨테이너 2개는 semaphore 해제 전에 모두 부재를 확인했다. 수동 stop/remove는 0이다.
- 손실 없는 증거: fresh XML, 전체 stdout/stderr, 486 source manifest, 중요 5개 source 전문은 동반 `.json.gz.b64`에 보존했다. 36개 ACK chunk와 `ARCHIVE_COMPLETE`를 회수했으며 압축 SHA-256 `506c45d6cae09d56da0df2ea54055c408ce4e47ae667c6c5d55598f1e5c2454a`, 해제 후 receipt SHA-256 `ba95b36504b49515a4e68ad63247f6e0f9e6b20ac830934d56eb36bf01467458`를 독립 재검증했다.

## 최소 수정 경계 제안

단순히 `legacyBoundary` 호출 위치만 ACTIVE 이전으로 옮기면 검증과 사용 사이의 변경을 놓칠 수 있다. 다음의 fail-closed 2단계가 필요하다.

1. 동일 bootstrap 연결·exclusive Control lock 아래, BASELINE에서 각 stream의 receipt/reference, legacy boundary, history/inventory digest, migration/runtime metadata ACL을 검증하여 stream-key에 결박된 불변 typed predecessor proof를 만든다.
2. ACTIVE 전환 및 foreign-session 제거 뒤에는 runtime으로 로그인하지 않는다. 기존 bootstrap/controller 연결로 receipt/reference/history/inventory와 principal별 ACL 관찰값이 proof와 동일한지 재검증한 다음 boundary를 한 번만 소비한다.
3. mismatch, 누락, 중복, 순서 차이, proof 재사용, initial-adoption/existing-receipt 모드 혼용은 모두 migration 전에 거부한다.
4. 기존 initial adoption, BASELINE 직접-principal 검증, ACTIVE CONNECT 차단, exact previous receipt/control reference, 모든 기존 Main/Core/build 테스트는 그대로 유지한다.

이 before 증거는 Auth 전체 114 migration, 실제 receipt issuer/publication, 전체 G3 준비 완료를 증명하지 않는다.
