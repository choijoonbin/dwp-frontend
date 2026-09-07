# API·권한 계약

브라우저는 같은 origin의 Gateway `/api/**`만 호출한다. 브라우저에서 trusted tenant/user/permission 헤더를 합성하거나 플랫폼에 Agent 신뢰 수집 경로를 추가하지 않는다.

| 원천                | 공개 경로                                                    |
| ------------------- | ------------------------------------------------------------ |
| Workspace 목록      | GET `/api/platform/v1/workspace/activity`                    |
| Workspace 상세      | GET `/api/platform/v1/workspace/activity/events/{UUID}`      |
| Workspace 현재 집계 | GET `/api/platform/v1/workspace/activity/executions/summary` |
| Agent 목록          | GET `/api/agent/v1/activity/events`                          |
| Agent 상세          | GET `/api/agent/v1/activity/events/{UUID}`                   |
| Agent 현재 집계     | GET `/api/agent/v1/activity/executions/summary`              |
| Agent 실행 목록     | GET `/api/agent/v1/runs`                                     |
| Agent 실행 상세     | GET `/api/agent/v1/runs/{UUID}`                              |

필터는 actor/state/query/source/objectType/objectId/executionId/from/to/cursor/limit/includeUsage. 시각은 timezone 포함 ISO, from 포함/to 미포함, limit 1–100. query는 SQL 와일드카드가 아닌 문자열 검색이다. Agent는 includeUsage를 사용하지 않는다.

목록 계약은 events/generatedAt + coverage/snapshotAt/startCursor/resumeCursor/nextCursor/hasMore. 클라이언트 결합 페이지는 각 원천에서 실제 소비한 마지막 행의 위치만 전진시켜 미소비 행을 누락하지 않는다. timestamp 소수점 이하를 밀리초로 뭉개지 않고 비교한다. 전체 원천이 아닌 부분 결과는 partial/sourceStates로 표시한다.

## 권한

- 공통 접근 `APP.ACTIVITY:VIEW`는 원본 읽기 권한을 대체하지 않는다.
- native Work: 역사적 수신자=현재 사용자, 현재 담당자=사용자, TASK, source WORKSPACE/DWP_WORKSPACE, APP.WORK:VIEW.
- App usage: 정확한 writer source, 역사적 수신자, 활성 카탈로그, APP.APPS:VIEW, 현재 앱 resource VIEW.
- Agent: 서명된 Gateway identity, TENANT, 본인 run, APP.ACTIVITY:VIEW + APP.ASK:VIEW. Provider/Support 거절.
- 목록/집계는 허용 행만 포함한다. 없는 객체·삭제·객체 접근 철회는 같은 404. API 진입 권한 없음은 403. 감사 ID 연결은 관리자 감사 열람 권한이 아니다.

브라우저는 APP.ASK 권한이 없으면 Agent 원천 요청을 생략한다. 이 편의 게이트와 별개로 서버가 최종 인가한다. 권한·tenant/user 변화 시 query scope와 기존 인증 cache clearing을 적용한다. 원본 이동 직전에 상세를 재검증한다.

Workspace cursor는 query scope 해시를 가진 opaque position이며 서명된 인가 토큰이 아니다. 매 요청 ACL을 재검사한다. Agent cursor는 HMAC과 1시간 유효기간을 사용한다. 클라이언트 composite cursor는 원천 token만 담고 기록 내용을 저장하지 않는다. 만료/조건 변경은 최신 페이지부터 다시 조회한다.

Agent 신규 경로 5개는 append-only Product Authorization v5 DRAFT에 등록했다. 기존 v4 projection은 최초 3개 route 그대로 보존된다. `110`/`111`에서 신규 경로를 열려면 정확한 v5 route/context/SELF evidence와 `DWP_AGENT_PRODUCT_AUTHORIZATION_V5_ENABLED`가 모두 필요하며, v4 readiness만으로는 503 fail-closed를 통과할 수 없다. 운영 활성화 전 v5 Agent PEP attestation과 보안 승인을 발급해야 한다.
