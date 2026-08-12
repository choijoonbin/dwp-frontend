# R0 Contract Spike 3 - Governed Grounded Ask

> 상태: Runtime foundation implemented, external model evaluation pending
>
> 기준일: 2026-08-12

## 검증한 계약

- Browser Session과 CSRF 뒤 Gateway가 확인한 `APP.*` Permission만 Agent에 전달한다.
- Agent Runtime Service Token은 Work Item과 Productivity Item GET에만 접근한다.
- L0·L1 읽기 질문만 Context와 Model 단계로 진입한다.
- Source는 Model에 전달하기 전에 사용자 Permission으로 제한하고 비신뢰 데이터로 표시한다.
- strict Structured Output 뒤 Citation 집합, Confidence와 상태 불변식을 서버·Client에서 검증한다.
- 질문은 HMAC, 재시도 응답은 AES-256-GCM, Citation은 Hash로만 저장한다.
- 같은 Request ID의 다른 질문 재사용은 응답 Replay 대신 충돌 처리한다.

## 구현 증적

- `dwp_agent`: Policy, Context Broker, OpenAI Responses Gateway, Run Store와 Migration
- `dwp-backend`: Ask용 App Permission Relay, 최소권한 Workspace Read와 Agent Registry Seed
- `dwp-frontend`: 실제 `/api/agent/v1/ask` 연결, Citation·상태·실행 증적 UI

## 남은 A1 Exit Evidence

이 Spike는 A1의 구조적 기반만 충족한다. 운영 Model Credential, 허용 Model Route,
대표 Evaluation Dataset, 품질·비용·지연 Report, Tenant Budget·Rate Limit과 운영 Alert가
없으므로 A1 완료로 표시하지 않는다. Model이 설정되지 않은 환경은 명시적으로
`CONFIGURATION_REQUIRED`를 반환한다.

## 참고

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Model Guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1)
- [OWASP Agentic Security Initiative](https://genai.owasp.org/)
