# DWP-R0-ADM-004 Organization and Group Directory

> 상태: in-development
>
> Owner: Identity and Security
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`
>
> ADR: `docs/03-architecture/R0 Organization Directory 및 Provisioning Boundary ADR.md`

## Outcome

Tenant 관리자가 조직 계층과 직접 사용자 그룹을 안전하게 운영하고, 소속 변경이 접근
맥락·Session·감사에 원자적으로 반영된다.

## 이번 Baseline

- 단일 Parent 조직 계층과 사용자별 기본 조직
- 부서와 분리된 직접 사용자 Group Membership
- Local 생성·수정·활성화·비활성화와 Source Ownership
- Tenant 복합 FK, Cycle·Dependency·Version 보호
- Membership Diff, Access Revision, Session 폐기와 Append-only Audit
- 서버 Page·검색·상태 Filter, Desktop Grid와 Mobile Semantic List

## 후속 범위

SCIM Inbound, Group Role·Effective Access, Access Review와 Joiner·Mover·Leaver 원장은
`DWP-R0-ADM-003`의 후속 Revision에서 구현했다. 중첩 Group, 위임 조직 범위, SoD 정책과
실제 고객 IdP Mapping·Reconciliation은 `D-01` 결정 뒤 확장한다.

## 구현 증거

- Flyway V5 조직·그룹·Membership Schema와 Tenant 복합 FK
- Auth Admin Directory API, Entity Picker와 반응형 Admin Directory UI
- Backend Unit, Frontend Type·Lint, Desktop·Mobile Playwright·Axe
- 실제 Gateway·PostgreSQL에서 정상 `200`, Tenant 불일치 `403`, Cycle·Dependency·Stale
  Version `409`, Revision·Audit·Membership 확인
- 검증 종료 뒤 조직·그룹·Membership·임시 사용자·Audit·테스트 Session 잔존 `0`

## 산출물

- `01-기획 정의.md`
- `02-화면 설계서.md`
- `03-디자인 정의.md`
- `04-데이터 설계.md`
- `05-API 권한 계약.md`
- `06-AI Agent 계약.md`
- `07-수용 테스트.md`
