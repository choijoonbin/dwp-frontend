# DWP-R0-ADM-001 Platform Control Plane

> 상태: in-development, automated and local integration verified
>
> Owner: Platform
>
> ADR: `docs/03-architecture/R0 Platform Control Plane 및 Admin Governance ADR.md`

## Outcome

Tenant 관리자가 격리된 기준정보를 안전하게 생성·활성화·폐기하고, 모든 변경을
감사 이벤트로 확인할 수 있다.

## 구현 범위

- Gateway 내부 Service Identity와 검증된 User·Tenant·Role 전달
- `dwp-platform-server`와 독립 `dwp_platform` Database
- 다국어 기준정보, 유효기간, 정렬, Parent Code와 Lifecycle
- Optimistic Lock, Runtime Read API와 Append-only Audit
- Desktop·Mobile Admin 화면과 접근성 자동검사

## 제외 범위

- Provider Cross-tenant Console
- SCIM·조직·세부 위임 권한
- Secret 저장, Feature Flag와 실행 가능한 Policy 편집
- 승인 Workflow와 PostgreSQL RLS

## 산출물

- `01-기획 정의.md`
- `02-화면 설계서.md`
- `03-디자인 정의.md`
- `04-데이터 설계.md`
- `05-API 권한 계약.md`
- `06-AI Agent 계약.md`
- `07-수용 테스트.md`
- `08-기준정보 운영 카탈로그.md`
