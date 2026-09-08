# API·권한 계약

브라우저는 같은 origin의 Gateway `/api/**`만 호출한다. 브라우저에서 trusted tenant/user/permission 헤더를 합성하거나 Platform에 Agent 신뢰 수집 경로를 추가하지 않는다.

## 공개 읽기 경로

| 원천                | Gateway 경로                                                             | 결과                                          |
| ------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| Workspace 목록      | GET `/api/platform/v1/workspace/activity`                                | 권한이 있는 사건 page                         |
| Workspace 상세      | GET `/api/platform/v1/workspace/activity/events/{eventId}`               | 독립 사건 상세                                |
| Workspace 실행 집계 | GET `/api/platform/v1/workspace/activity/executions/summary`             | SAMPLE을 제외한 현재 실행 집계                |
| native event 증적   | GET `/api/platform/v1/workspace/activity/events/{eventId}/evidence`      | 사건 audit 연결과 checkpoint 관측             |
| Agent 중앙 증적     | GET `/api/platform/v1/workspace/activity/audit/evidence/{auditRecordId}` | 중앙에 실제 ingest된 본인 Agent audit receipt |
| 개인 원천 상태      | GET `/api/platform/v1/workspace/activity/sources/status`                 | 권한이 있는 Mail/Calendar 원천 관측           |
| Agent 공통 목록     | GET `/api/agent/v1/activity/events`                                      | LIVE 현재 실행 snapshot page                  |
| Agent 공통 상세     | GET `/api/agent/v1/activity/events/{runId}`                              | LIVE 현재 실행 snapshot                       |
| Agent 공통 집계     | GET `/api/agent/v1/activity/executions/summary`                          | LIVE 현재 실행 집계                           |
| Agent run 목록      | GET `/api/agent/v1/runs`                                                 | 본인 run과 현재 attempt telemetry             |
| Agent run 상세      | GET `/api/agent/v1/runs/{runId}`                                         | 본인 단건 run과 현재 attempt telemetry        |

사건 필터는 actor/state/query/source/objectType/objectId/executionId/from/to/cursor/limit/includeUsage다. 시각은 timezone 포함 ISO, from 포함/to 미포함, limit 1–100이다. Agent 공통 API는 includeUsage를 사용하지 않는다.

목록 계약은 events/generatedAt와 coverage/snapshotAt/startCursor/resumeCursor/nextCursor/hasMore를 제공한다. 클라이언트 결합 페이지는 각 원천에서 실제 소비한 마지막 행의 위치만 전진시켜 미소비 행을 누락하지 않는다. 전체 원천이 아닌 부분 결과는 `partial`/`sourceStates`로 표시한다.

## 증적 상태 계약

- `linkStatus=LINKED|NOT_LINKED`는 중앙 audit record의 실제 연결 여부다.
- `auditAccess=AVAILABLE|RESTRICTED`는 감사 상세 필드 열람 권한이다.
- `integrityStatus=VERIFIED|FAILED|PENDING|UNAVAILABLE`는 감사 원장이 보고한 일별 checkpoint 상태다.
- `integrityScope=DAILY_CHECKPOINT_REPORTED`는 독립 검증이나 법적·규제 준수 보증이 아니다.
- Agent run의 `auditEvidence.status=PENDING`은 결정적 중앙 주소를 계산했지만 ingestion acknowledgement가 없다는 의미다. 중앙 receipt 404를 `VERIFIED`로 승격하지 않는다.

기존 사건 DTO의 `auditStatus`는 하위 호환용 감사 연결 표기이며 checkpoint 무결성 판정이 아니다. 화면의 검증 상태는 evidence receipt의 `integrityStatus`만 사용한다.

## 권한·비노출

- 공통 접근 `APP.ACTIVITY:VIEW`는 원본 읽기 권한을 대체하지 않는다.
- native Work는 역사적 수신자=현재 사용자, 현재 담당자=사용자, `TASK`, source `WORKSPACE|DWP_WORKSPACE`, `APP.WORK:VIEW`를 모두 재검사한다.
- App usage는 정확한 writer source, 역사적 수신자, 활성 카탈로그, `APP.APPS:VIEW`, 현재 앱 resource `VIEW`를 모두 요구한다.
- Agent 공통 `/v1/activity/**`는 서명된 Gateway identity, TENANT plane, 본인 소유, `APP.ACTIVITY:VIEW`와 `APP.ASK:VIEW`를 요구한다. `/v1/runs/**`는 같은 identity/본인 소유 경계와 `APP.ASK:VIEW`를 요구한다. Provider/Support plane은 거절한다.
- native evidence는 사건 상세와 같은 current source ACL을 재검사한다. Agent 중앙 evidence는 같은 tenant/actor, `dwp-agent-runtime`, `AGENT_RUN`, UUID target만 허용한다.
- source status는 `APP.MAIL:VIEW` 또는 `APP.CALENDAR:VIEW`가 있는 resource만 반환한다. 자격 증명·token·provider identifier·raw error는 선택하지 않는다.
- `ADMIN.AUDIT_VIEW:VIEW`가 없으면 `recordHash`, `hashAlgorithm`, `verifiedAt`을 반환하지 않고 `auditAccess=RESTRICTED`, `integrityStatus=UNAVAILABLE`을 사용한다.
- 목록/집계는 허용 행만 포함한다. 없는 객체·삭제·객체 접근 철회·다른 tenant/user는 같은 404로 처리하고, API 진입 권한 없음은 403이다.

브라우저는 `APP.ASK:VIEW`가 없으면 Agent 원천 요청을 생략하지만 서버가 최종 인가한다. 권한·tenant/user 변화 시 query scope와 인증 cache를 비운다. 원본 이동 직전에 상세를 다시 검증한다.

## Cursor·캐시

Workspace cursor는 query scope 해시를 가진 opaque position이며 인가 토큰이 아니다. 로컬 fixture 노출 flag도 scope에 포함되어 flag 전환 전 cursor를 재사용할 수 없다. Agent cursor는 HMAC과 1시간 유효기간을 사용한다. 모든 요청에서 tenant/user/권한을 다시 검사한다.

Platform의 `/v1/workspace/activity/**` 성공·오류 응답은 security filter에서 `Cache-Control: private, no-store, max-age=0`를 설정한다. Agent `/v1/runs` 성공 응답과 명시적 detail 404/503도 `no-store`다. 프런트는 증적·run 응답을 영속 저장하지 않고, 단건 재검증 실패 시 이전 영수증이나 source route를 다시 표시하지 않는다.

## Product Authorization 경계

Agent 신규 읽기 경로 5개는 append-only Product Authorization v5 DRAFT에 등록했다. 기존 v4 projection은 최초 3개 route를 그대로 보존한다. `110`/`111`에서 신규 경로를 열려면 정확한 v5 route/context/SELF evidence, `DWP_AGENT_PRODUCT_AUTHORIZATION_V5_ENABLED`, 신규 Agent PEP attestation이 모두 필요하다. 하나라도 없으면 503 fail-closed다.

Platform evidence/source 경로는 기존 Activity 읽기 권한 경계를 확장한 것이며 별도 command 권한이나 Agent-to-Platform trusted ingestion을 만들지 않는다.
