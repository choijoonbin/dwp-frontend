# Agent 원천 계약

새 추론 에이전트나 자동 명령 실행 기능을 추가한 것이 아니다. 기존 DWAI·ON 실행 원장을 읽기 전용으로 연결했다. 사람 입력·승인·실행 정책은 원본 서비스가 계속 소유한다.

원천 API는 현재 run snapshot만 제공한다. 질문/답변/대화 제목/인용문/암호문을 읽지 않는다. 화면은 원장 식별자, agent key, 현재 상태, 시도/버전, 생성·완료/관측 시각과 원본 경로를 사용한다. full chain-of-thought, 전체 lifecycle, 없는 결과물을 합성하지 않는다.

RUNNING의 임대 만료는 UNKNOWN이다. FAILED와 다르며 승인·취소·재시도 자동 명령을 발생시키지 않는다. 정책 DENY와 HANDOFF는 각각 POLICY_BLOCKED/NEEDS_INPUT으로 표현하되 원장이 제공하는 현재 값만 사용한다.

실제 Executor와 조회 source가 같은 메모리/DB provider를 사용한다. 오래된 worker의 완료는 lease generation fencing으로 차단한다. 이미 완료된 원장 snapshot은 조회에 포함된다. 과거 retry 단계의 불변 보관/outbox는 이번 범위가 아니다.

실제 연결된 감사 FK가 없으므로 Agent snapshot은 `auditStatus=NOT_LINKED`, auditRecordId=null이다. 앱 변경 원장의 VERIFIED 상태와 섞지 않는다. 원본 `/dwaion/activity?run=UUID`는 최근 목록 밖이라도 독립 상세를 열며, 원본에 없는 명령은 제시하지 않는다.

신규 조회 route 5개는 Product Authorization v5 DRAFT에 등록했다. 기존 v4 projection과 증명은 그대로 보존되며 v5를 대신 승인하지 않는다. `110`/`111` strict 상태에서 정확한 v5 evidence, v5 환경 플래그, 새 Agent PEP attestation 중 하나라도 없으면 의도적으로 fail-closed한다. [운영 상세](/Users/a10697/Work/DWP/dwp_agent/docs/DWAI_ON_PRODUCTION_GATE.md).
