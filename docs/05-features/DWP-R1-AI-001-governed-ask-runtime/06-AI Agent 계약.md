# DWP-R1-AI-001 AI·Agent 계약

## Pipeline

1. Request ID와 질문 Hash로 Idempotency를 확인한다.
2. Tenant Agent Registry의 `DWP_ASSISTANT` Active Revision을 확인한다.
3. Server Policy가 Ask Permission, 민감정보와 Mutation 의도를 판정한다.
4. 허용된 App Permission별 Context Source만 조회하고 민감 제목·Evidence를 다시 제외한다.
5. Evidence를 비신뢰 JSON으로 직렬화하고 지시문으로 취급하지 않는다.
6. Model Gateway가 `store=false`, 개인정보 보호 Safety ID와 strict JSON Schema를 사용한다.
7. 반환 Citation ID가 조회 Source 집합에 속하는지 검증한다.
8. 상태·사용량·Hash 증적을 저장하고 Privacy-minimized Audit를 발행한다.

## Fail-closed 규칙

- 답변에 Citation 또는 Confidence가 없으면 Grounding 위반으로 보류한다.
- 답변과 Abstention이 동시에 있거나, Abstention에 Citation이 있으면 보류한다.
- Provider가 임의 Source ID를 반환하면 보류한다.
- Model, Registry, Context 또는 안전 식별자 설정이 없으면 합성 답변 대신
  `CONFIGURATION_REQUIRED`를 반환한다.
- L2·L3 요청은 이 Runtime에서 실행하지 않고 Governed Workflow로 인계한다.

## 표준 근거

- OpenAI Structured Outputs와 Responses API의 strict JSON Schema, `store=false`,
  privacy-preserving `safety_identifier`
- NIST AI RMF와 Generative AI Profile의 Govern·Map·Measure·Manage 수명주기
- OWASP Agentic Security의 Prompt Injection·Excessive Agency 방어 원칙

## 미충족 Release Gate

- 승인 Model Route와 운영 Secret
- 한국어·영어 대표 질문 Evaluation Set
- Grounded Accuracy, Citation Precision, Correct Abstention, Unauthorized Exposure 보고서
- Tenant별 Budget·Rate Limit·Data Residency 정책과 운영 Alert
