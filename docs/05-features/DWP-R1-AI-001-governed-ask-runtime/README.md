# DWP-R1-AI-001 Governed Ask Runtime

> 상태: in-development
>
> Release: R1 Candidate
>
> Owner: DWP AI Platform
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`, `dwp_agent`

인증된 사용자의 현재 권한 범위에서 업무 근거를 조회하고, 인용 가능한 읽기 전용 답변만
제공하는 DWP Ask Runtime이다. Browser는 Model Provider를 직접 호출하지 않으며
Gateway Session, Service Identity, Server Policy, Context Broker, Model Gateway와
암호화된 Run Store를 순서대로 통과한다.

현재 코드는 Model Credential이 없어도 합성 답변을 만들지 않고
`CONFIGURATION_REQUIRED`를 반환한다. 실제 Model 품질·비용·지연 평가와 운영 Secret
연결은 Release Gate이며 완료로 간주하지 않는다.

## 산출물

- `01-기획 정의.md`
- `02-화면 설계서.md`
- `03-디자인 정의.md`
- `04-데이터 설계.md`
- `05-API 권한 계약.md`
- `06-AI Agent 계약.md`
- `07-수용 테스트.md`

## 상위 계약

- `03-architecture/R0 플랫폼 통합 및 Agent Runtime ADR.md`
- `03-architecture/R0 Contract Spike 3 - Governed Grounded Ask.md`
- `05-features/DWP-R1-CORE-001-reference-work-hub/`
