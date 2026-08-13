# DWP-R1-ADM-007 Navigation and App Access Governance

- Owner: Tenant Experience Governance
- 상태: pilot
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

Navigation Revision의 게시·복원과 앱 접근 요청의 결정 증거까지가 현재 책임이다. 외부 IAM
Entitlement 적용은 `D-16` 승인 전까지 `IAM_SYNC_PENDING`으로 fail-closed 처리한다.
