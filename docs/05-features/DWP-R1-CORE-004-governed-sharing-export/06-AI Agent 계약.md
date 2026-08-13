# DWP-R1-CORE-004 AI Agent 계약

현재 기능에는 AI Agent를 사용하지 않는다.

- Dataset, Population, Field, Masking, TTL과 상태 전이는 결정적 서버 정책이다.
- Agent는 반출 범위를 넓히거나 승인, 재시도, 취소 또는 Artifact URL을 생성할 수 없다.
- 향후 Agent가 요청 작성을 보조하더라도 사용자가 Preview, 수신자와 목적을 확인한 뒤
  명시적으로 제출해야 한다.
- 실제 반출 실행 Tool은 `D-02`, `D-09`, `D-12`와 Governed Agent Action 계약 전에는
  Registry에 등록하지 않는다.
