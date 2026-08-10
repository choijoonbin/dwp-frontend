# 06 AI Agent 계약

## Agent Event

Agent는 계획 생성, Tool 선택, 승인 요청·결과, 실행, 실패, Human Handoff와 중단을
`AI_ACTION` 또는 `POLICY_DENIED`로 기록한다. Actor Type은 `AGENT`, Target은 업무·Case·
Tool·정책 ID를 사용하며 Prompt 원문과 Tool Credential은 기록하지 않는다.

## 관리 자동화

감사 Case·Finding·정책을 Agent가 조작할 때도 화면과 같은 Resource 권한을 사용한다.

1. 사용자의 자연어 요청을 Typed Command로 변환한다.
2. Tenant, Actor, Resource와 현재 정책을 Resolution한다.
3. 변경 전 Preview와 영향 대상, 반출 시 사유를 보여준다.
4. 고위험 변경은 Human Approval 뒤에 실행한다.
5. 요청, Plan Hash, Approval, 실행 결과와 Correlation ID를 감사 Event로 남긴다.

## 내구성

Agent Runtime은 원격 Collector 장애 시 원자적 Local Disk Spool을 사용한다. Relay는
성공 응답 이후에만 Event를 제거하며 재기동 뒤에도 재전송한다. Production에서는
Encrypted Durable Volume과 Workload Identity를 사용한다.

## 금지

- Agent가 감사 Event를 수정·삭제하거나 Risk를 낮추는 행위
- 사용자 승인 없이 보존 단축·Legal Hold 해제·증적 반출
- Prompt, 문서 본문, 개인정보 원문을 Metadata에 복제
- 실패한 실행을 성공으로 기록하거나 Correlation을 새로 만들어 단절
