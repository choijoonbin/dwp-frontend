# 06 AI Agent 계약

Agent가 API 운영 데이터를 사용할 때 기본 권한은 읽기 전용이다.

- 허용: 오류 증가 요약, 느린 Route 후보, 연관 Trace Hop 설명, 점검 Runbook 제안
- 승인 필요: Retention 변경, Alert Rule 변경, 서비스 차단·재시작
- 금지: 이력 위조·수정, 개별 Event 삭제, Hash 역추적, Payload 존재를 가정한 설명
- 모든 Agent 응답은 기간, Tenant, Filter와 근거 Event/Trace ID를 표시한다.

자동 조치는 Provider/Admin Typed Command, Plan Preview, Risk Tier와 승인 Gate가 연결된 후
별도 Feature로 연다.
