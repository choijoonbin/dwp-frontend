# 06 AI Agent 계약

## 원칙

Agent는 자연어 요청을 직접 Database Mutation으로 실행하지 않는다.

1. Intent를 Allowlisted `commandKey`와 Typed Parameter로 변환
2. Tenant, User, Agent Identity, Effective Permission과 Scope 검증
3. Expected Version을 포함한 변경 전후 Preview 생성
4. Risk에 따라 Human Approval과 SoD 확인
5. Plan Hash가 같은 경우에만 Idempotent Domain Command 실행
6. User, Agent, Approver, Diff, Outcome과 Correlation Audit

## 기본 승인 필요

- Tenant·User·Role·Group·Menu·PII·Connector·Agent Tool 변경
- 대량 변경, Export, Impersonation과 정책 Publish
- Joiner·Mover·Leaver 자동화 중 원본 HRIS에 쓰는 작업

Agent는 `mutationAllowed=false`인 Reference Plan만 제공한다. 실제 Mutation Endpoint는
Policy Evaluator, Approval Store와 Command Executor가 구현된 뒤 별도 Gate로 연다.
