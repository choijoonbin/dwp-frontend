# DWP-R1-ADM-006 AI Agent 계약

Agent는 승인된 Context에서 Catalog Entity와 변경 영향의 읽기 결과를 근거로 사용할 수 있다.
관계 등록·종료, Owner 변경과 외부 Source 동기화는 현재 Agent Tool로 노출하지 않는다.

향후 Mutation은 Plan Preview, 독립 승인 Token, 최소 권한 Tool Grant, Idempotency Key와 실행 전
Entity Revision 재검증을 모두 요구한다. 실행·취소·실패는 동일 Correlation의 감사 Timeline에
기록한다.
