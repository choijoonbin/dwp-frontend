# DWP-R0-ADM-003 Identity Access Governance

> 상태: in-development
>
> Owner: Identity and Security
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

## Outcome

Tenant 관리자가 사용자 Directory와 Role을 확인하고 다른 사용자에게 Role을 배정할 때
동시 변경, 마지막 관리자, Session과 감사 경계가 일관되게 적용된다.

## 이번 Baseline

- Tenant 사용자·Role 조회와 검색
- 다른 사용자의 Role Set 교체
- Optimistic Version, 마지막 Admin 보호와 대상 Session 폐기
- Identity Audit과 통합 Admin Audit 화면

## 후속 범위

Organization Unit과 직접 User Group은 `DWP-R0-ADM-004`에서 구현했다. Group Role,
SCIM 2.0, 위임 범위, SoD Rule, Access Review와 Joiner·Mover·Leaver Workflow는 같은
Identity Plane의 다음 Revision에서 구현한다.

## 구현 증거

- Auth Admin API: 사용자·Active Role 조회, 다른 사용자 Role Set 교체, Identity Audit
- 보호 규칙: Tenant Scope, 자기 Role 변경 금지, Role 잠금 기반 마지막 Admin 보호,
  Access Revision·JPA Version 충돌 감지
- 변경 원자성: Membership Diff, 대상 Active Session 폐기, Revision 증가와 전후 Snapshot
  Audit를 하나의 Transaction에서 처리
- Admin UI: Desktop Data Grid, Mobile Semantic List, Role Checkbox Dialog와 Platform·Identity
  통합 Audit
- 검증: Backend Unit, Gateway 실제 API·DB 검증, Desktop·Mobile Playwright·Axe

## 산출물

- `01-기획 정의.md`
- `02-화면 설계서.md`
- `03-디자인 정의.md`
- `04-데이터 설계.md`
- `05-API 권한 계약.md`
- `06-AI Agent 계약.md`
- `07-수용 테스트.md`
