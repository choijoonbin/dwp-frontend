# DWP-R0-ADM-003 Identity Access Governance

> 상태: reference-implemented, automated-verification-complete
>
> Owner: Identity and Security
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

## Outcome

Tenant 관리자가 사용자 Directory와 직접·Group 경유 Effective Access를 확인하고, Role 변경,
주기적 접근 검토와 SCIM 프로비저닝을 수행할 때 Tenant 격리, 동시 변경, 마지막 관리자,
Session 회수와 불변 감사 근거가 일관되게 적용된다.

## 이번 Baseline

- Tenant 사용자·Role 조회, 검색, 직접·Group Assignment 근거와 Scope
- 다른 사용자의 Role Set 교체, Optimistic Version, 마지막 Admin 보호와 Session 폐기
- Access Review Campaign, 불변 Assignment Snapshot, 권고 근거, 승인·회수와 Remediation
- SCIM 2.0 Users·Groups, Connector Credential 수명주기, 건강 상태와 Provisioning Event
- Identity Audit과 통합 Admin Audit 화면

## 후속 범위

Organization Unit과 User Group은 `DWP-R0-ADM-004`가 소유한다. 실제 기업 IdP 선정,
Domain·MFA·복구·Break-glass, 고객별 SCIM Mapping과 Sandbox Reconciliation은 외부 결정
`D-01` 뒤에 활성화한다. 정책 없는 임의 Provider 연결이나 성공 상태를 합성하지 않는다.

## 구현 증거

- Auth Admin API: 사용자·Active Role·Effective Access 조회, Role Set 교체, Access Review,
  SCIM Connector·Event와 Identity Audit
- 보호 규칙: Tenant Scope, 자기 Role 변경 금지, Role 잠금 기반 마지막 Admin 보호,
  Access Revision·JPA Version 충돌 감지
- 변경 원자성: Membership Diff, 대상 Active Session 폐기, Revision 증가와 전후 Snapshot
  Audit를 하나의 Transaction에서 처리
- Admin UI: 접근 근거 Inspector, Role 변경 Dialog, Campaign Review Queue, SCIM Readiness·건강·
  Event Inspector와 Guided Empty State
- 검증: Backend Unit, Desktop·Mobile Playwright, Axe, Tenant·Version·권한 경계 회귀

## 산출물

- `01-기획 정의.md`
- `02-화면 설계서.md`
- `03-디자인 정의.md`
- `04-데이터 설계.md`
- `05-API 권한 계약.md`
- `06-AI Agent 계약.md`
- `07-수용 테스트.md`
