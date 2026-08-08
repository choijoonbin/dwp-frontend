# 06 AI Agent 계약

현재 Directory Mutation에 생성형 AI를 사용하지 않는다. 조직·그룹은 Agent의 권한과
Context를 제한하는 입력이므로 Agent Runtime이 Auth Database를 직접 조회하거나 변경할 수
없다.

- 향후 Agent는 승인된 Identity Context API가 반환한 Tenant·조직·그룹 Claim만 사용한다.
- Directory를 사용하는 Tool Grant와 Search ACL은 실행 시점의 Effective Membership과
  교집합으로 계산하고 Cache가 불확실하면 Fail-closed한다.
- Agent는 조직 개편이나 Group 추천안을 제시할 수 있지만 변경은 Admin Review, 명시적
  승인, Version과 동일 Audit 계약을 거쳐야 한다.
- Audit·Prompt에는 불필요한 사용자 목록을 복제하지 않고 ID와 정책 결정 근거만 남긴다.

Group Role과 ABAC가 구현되기 전에는 Directory Group을 권한 Grant로 해석하지 않는다.
