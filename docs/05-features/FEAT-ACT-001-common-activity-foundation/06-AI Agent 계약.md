# Agent 원천·관측 계약

이번 고도화는 새 추론 에이전트나 자동 명령 실행 기능을 추가하지 않는다. 기존 DWAI·ON 실행 원장을 읽기 전용으로 연결하고, 실제 runtime이 만든 단계·원천 호출 계측을 같은 Agent 원장에 저장한다. 사람 입력·승인·실행 정책은 원본 서비스가 계속 소유한다.

## 공개 snapshot

`/api/agent/v1/runs`와 `/api/agent/v1/runs/{runId}`는 본인의 현재 run과 현재 lease generation에 결속된 다음 필드를 제공한다.

- `activityTitle`: prompt가 아닌 서버의 허용된 agent catalog key로 만든 안전 제목
- `attempt`: 1 이상의 현재 lease generation
- `lease`: `ACTIVE | EXPIRED | RELEASED`와 만료 시각
- `currentStage`, `stages`: 순서, `ACTIVE | COMPLETED | SKIPPED | FAILED`, 시작·종료 시각, 실측 `durationMs`
- `progressPercent`: 5개 operational stage의 완료·건너뜀 전이로 계산한 20% 단위 진행률
- `measurementStatus`: `MEASURING | MEASURED | PARTIAL | NOT_AVAILABLE`
- `sourceHealth`: 실제 시도한 원천의 `SUCCESS | UNAVAILABLE | NOT_CONFIGURED`, latency, 최근 시도·성공 시각
- `auditEvidence`: opaque Agent audit ID, 결정적 중앙 audit record 주소, `PENDING | LINKED | NOT_AVAILABLE`
- `dataProvenance`: `LIVE | SAMPLE`

질문·답변·대화 제목·인용문·암호문·credential·raw error를 읽거나 반환하지 않는다. full chain-of-thought, 없는 단계, 없는 지연 시간, 추정 connector health를 합성하지 않는다.

## 기록·동시성

실제 Executor와 조회 source는 같은 in-memory 또는 PostgreSQL RunStore provider를 사용한다. 단계 전이는 run ID와 lease generation fencing을 만족한 writer만 기록한다. 종료 단계는 수정하지 않고 retry는 새 generation으로 분리한다. 성공 종료 시 미실행 operational stage는 `SKIPPED`로 닫으며, 실패 종료는 실제 완료 전이만 남기고 100%로 만들지 않는다.

PostgreSQL run 목록·상세는 run row와 telemetry를 `READ ONLY REPEATABLE READ`에서 읽고 처음 읽은 generation만 선택한다. 따라서 조회 도중 retry가 시작되어도 이전 run row에 새 attempt의 stage/source가 섞이지 않는다.

`RUNNING`의 임대 만료는 `UNKNOWN`이다. `FAILED`와 다르며 승인·취소·재시도 자동 명령을 발생시키지 않는다. 정책 `DENY`와 `HANDOFF`는 각각 `POLICY_BLOCKED`, `NEEDS_INPUT`으로 표현하되 원장의 현재 값만 사용한다.

## 감사 경계

Agent는 실행 audit ID에서 UUIDv5 중앙 record 주소를 계산해 run에 저장한다. 이는 게시 의도와 조회 주소이며 중앙 원장에 실제 행이 있다는 증거가 아니다. 현재 publisher에는 ingestion acknowledgement가 없으므로 정상 실행도 `auditEvidence.status=PENDING`을 유지한다.

Platform `/api/platform/v1/workspace/activity/audit/evidence/{auditRecordId}`가 같은 tenant/actor와 `dwp-agent-runtime`/`AGENT_RUN` 중앙 레코드를 실제로 찾았을 때만 중앙 receipt를 표시한다. 404, 권한 없음, checkpoint 없음은 `LINKED`나 `VERIFIED`로 합성하지 않는다. hash/checkpoint 검증 상태는 Platform 감사 원장만 소유한다.

## 공통 활동과 SAMPLE

공통 Agent `/api/agent/v1/activity/**`는 `data_provenance='LIVE'`만 읽는다. `/api/agent/v1/runs/**`는 SAMPLE도 provenance badge와 함께 읽을 수 있다. 따라서 로컬 시연 run은 DWAI·ON 실행 상세에서는 보이지만 공통 활동 피드·상세·실행 집계에는 들어가지 않는다.

로컬 seed는 `DWP_ENVIRONMENT=local`, `DWP_AGENT_LOCAL_ACTIVITY_SEED_ENABLED=true`, `DWP_AGENT_DATABASE_URL`을 요구하고 `tenant=1`, `user=900018`에 고정된 SAMPLE run 4개를 insert-only로 만든다. 기존 run ID/request ID/tenant/user/provenance가 충돌하면 전체 transaction을 실패시킨다. prompt와 응답 본문은 저장하지 않는다.

원본 `/dwaion/activity?run={runId}`는 최근 목록 밖의 LIVE run도 독립 상세로 연다. SAMPLE run은 `/runs` 기반 시연 상세에서만 다루며 공통 활동 원본 route 권한으로 승격하지 않는다. 원본에 없는 command는 제시하지 않는다.

## 운영 활성화 경계

Agent 신규 읽기 route 5개는 Product Authorization v5 DRAFT에 등록했다. 기존 v4 projection과 증명은 그대로 보존되며 v5 승인을 대신하지 않는다. `110`/`111` strict 상태에서 정확한 v5 evidence, v5 환경 flag, 새 Agent PEP attestation 중 하나라도 없으면 fail-closed한다. 운영 배포·운영 검증은 사용자 요청에 따라 이번 작업에서 제외한다. 상세는 [DWAI·ON production gate](/Users/a10697/Work/DWP/dwp_agent/docs/DWAI_ON_PRODUCTION_GATE.md)를 따른다.
