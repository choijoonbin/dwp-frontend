# 06 AI Agent 계약

## 적용 여부

현재 기준정보 편집과 감사 조회에는 생성형 AI를 사용하지 않는다. 운영 기준 변경은
결정적 Form, Validation과 명시적 사용자 Action으로 수행한다.

## 향후 Agent 사용 제한

- Agent는 변경 초안이나 영향 분석을 제안할 수 있다.
- 실제 활성화·폐기는 Admin의 Plan Preview와 승인을 요구한다.
- Agent Identity, Tool Grant, Risk Tier와 실행 Audit이 없으면 Write API를 호출할 수 없다.
- Secret, 원문 개인정보와 Cross-tenant 데이터는 Context에 포함하지 않는다.
