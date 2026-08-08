# DWP-R0-ADM-002 Product Registry

> 상태: in-development, automated and local integration verified
>
> Owner: Platform Governance
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`; Runtime 소비는 후속 Agent·Connector Feature

## Outcome

Tenant 관리자가 App, Connector, Agent, Tool과 Policy의 소유자, 위험등급, 배포 버전과
Lifecycle을 단일 Catalog에서 추적하고, 활성 Revision만 Runtime에 제공한다.

## 구현 범위

- 유형: `APP`, `CONNECTOR`, `AGENT`, `TOOL`, `POLICY`
- Key별 Revision, Draft 편집, Active 교체, Retire와 이력 API
- Owner Reference, Risk Tier와 Artifact Version
- Tenant 격리, Optimistic Lock과 모든 변경 Audit
- Desktop·Mobile Registry 관리 화면

## 제외 범위

- Connector Credential, Agent Prompt·Tool Grant, Policy Rule 등 실행 가능한 상세 정의
- Secret 원문, Binary Artifact와 앱 Launch URL
- 4-eyes 승인, Provider Catalog 배포와 Tenant Entitlement

## 산출물

- `01-기획 정의.md`
- `02-화면 설계서.md`
- `03-디자인 정의.md`
- `04-데이터 설계.md`
- `05-API 권한 계약.md`
- `06-AI Agent 계약.md`
- `07-수용 테스트.md`
