# DWP-R1-ADM-007 Navigation and App Access Governance

- Owner: Tenant Experience Governance
- 상태: internal runtime complete / external IAM gated
- Roadmap: R1-03, R1-13
- 메뉴: `관리 센터 > 플랫폼 설정 > 내비게이션`, `워크스페이스 > 앱`

## 산출물

- [기획 정의](01-기획 정의.md)
- [화면 설계서](02-화면 설계서.md)
- [디자인 정의](03-디자인 정의.md)
- [데이터 설계](04-데이터 설계.md)
- [API 권한 계약](05-API 권한 계약.md)
- [AI Agent 계약](06-AI Agent 계약.md)
- [수용 테스트](07-수용 테스트.md)

Navigation Revision의 게시·복원과 앱 접근 요청·결정·이행·재시도·회수·만료 증거를
소유한다. DWP Auth 런타임 Entitlement는 실제 적용되며 승인과 이행은 분리된다.
Microsoft Entra·Okta 등 외부 IAM Mapping, Credential, Sandbox와 Reconciliation은
`D-16` Gate로 분리한다.
