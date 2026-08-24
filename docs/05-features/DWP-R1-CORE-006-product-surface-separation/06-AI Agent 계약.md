# DWP-R1-CORE-006 AI Agent 계약

## 판정

`Not applicable` — Product Surface 선택, Navigation Projection, Scope 선택과 권한 판정은
결정적 UI·정책 기능이며 AI가 추천·변경·실행하지 않는다.

## 금지

- AI가 사용자 역할을 추정해 Surface를 자동 전환하지 않는다.
- AI가 Permission, Responsibility, Scope, JIT 또는 Support Session을 생성·확대하지 않는다.
- 자연어 요청만으로 Product Management Mutation을 실행하지 않는다.
- 권한 없음 상태에서 우회 Route나 더 넓은 Scope를 제안하지 않는다.
- 사용자의 관리 가능 Product·Scope·만료 정보를 Model Context나 Analytics에 원문으로 보내지
  않는다.

## 향후 Agent Tool 계약

향후 Agent가 Product Management Tool을 호출하더라도 다음 일반 API 계약을 그대로 따른다.

1. Exact Capability와 Target Scope
2. Human Actor와 Delegation/Tool Grant
3. Fresh Step-up·JIT·Approval Policy
4. Expected Version과 Idempotency Key
5. 사유, 영향 Preview, Stop·Retry·Rollback
6. SoD와 자기 승인 금지
7. Before/After Audit, Correlation ID와 Denied Audit

퇴역·비활성 Capability는 Agent PEP에서도 허용하지 않는다. 기존 Aggregate
`ADMIN.DWAION` 같은 호환 권한을 Agent 전용 우회로 유지하지 않는다.
