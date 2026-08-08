# 06 AI Agent 계약

`AGENT` Registry Entry는 Agent의 Inventory Envelope이며 Prompt, Model Route, Tool Grant나
실행 권한 자체가 아니다.

Agent Runtime이 Active Entry를 소비하는 후속 계약은 다음을 요구한다.

- 요청 시 Agent Key와 Revision 또는 Resolution 결과를 Trace에 기록한다.
- Registry Active만 실행 후보가 될 수 있다.
- Risk Tier는 Tool·Data·Approval 정책의 입력이며 단독 허가가 아니다.
- Agent Definition, Model Route와 Tool Grant는 별도 Versioned Schema를 사용한다.
- Registry 조회 실패 시 Write 실행은 Fail Closed한다.

현재 Reference Preview는 Active Revision을 해석해 Agent Key·Revision·Artifact Version을
Plan Hash, 응답과 감사 Event에 포함한다. Registry가 비어 있으면 비변경 Preview에만
`REFERENCE_FALLBACK`을 허용하며, 향후 Tool 실행은 `enforced` Mode를 요구한다.
