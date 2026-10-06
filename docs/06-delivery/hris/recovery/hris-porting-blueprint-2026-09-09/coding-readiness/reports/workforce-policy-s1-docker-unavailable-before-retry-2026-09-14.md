# S1 native PG16 재실행 — Docker 환경 실패 보존

상태는 `ENVIRONMENT_BLOCKED_BEFORE_TESTCONTAINERS`입니다. 실제 업무 권한 사례는 0건 실행됐고 G3는 닫히지 않았습니다.

- 승인된 테스트 전용 maker/checker/target만 `900010/900011/900012`에서 `941010/941011/941012`로 분리됐습니다. 현재 테스트 SHA에서 이 세 값을 역치환한 SHA가 첫 실패 snapshot `3eeb48bb...`와 정확히 같습니다. actor `900009`, 생산 4파일, 업무 기대값은 변경하지 않았습니다.
- 동일 PG16 단일 클래스 실행은 UTC 11:53:07.411994–11:53:17.373869, exit 1, timeout false였습니다. `hris-verification` 잠금은 11:53:18.738Z에 해제됐습니다.
- fresh XML은 1 testcase/1 failure/0 error/skip이며 `Could not find a valid Docker environment` 초기화 오류입니다. PostgreSQL 컨테이너와 테스트 본문이 시작되기 전의 환경 실패이므로 fixture 수정 근거가 아닙니다.
- 후속 `docker version`도 daemon 연결 불가를 반환했습니다. 사용자 Docker Desktop, 보호 중 PostgreSQL/Redis/Kafka, 다른 작업 컨테이너는 시작·중지하지 않았습니다.
- ACK 프로토콜 자체는 44청크 끝까지 완료됐지만 첫 청크가 orchestration 출력 한도에서 잘려 로컬 lossless archive라고 주장하지 않습니다. 대신 fresh XML SHA `eb11ae0735d013f3c36fbb1c7e08ddd5103f682077ce3126f427d0ef58e1dbeb`, source 3,068개 전후 안정, receipt/archive SHA와 경계 사실을 [JSON](workforce-policy-s1-docker-unavailable-before-retry-2026-09-14.json)에 고정했습니다.

Docker daemon이 외부에서 다시 가용해지면 코드·기대값을 더 바꾸지 않고 같은 명령을 재실행합니다. 그때 새로운 기능 실패가 나오면 먼저 별도 before 증거로 보존하며, S1 성공도 READ evidence일 뿐 command permit·durable consume/revoke fence·product catalog 게시·전체 G3 승인이 아닙니다.
