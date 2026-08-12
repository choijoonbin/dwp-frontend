# Feature Packages

신규 메뉴와 기능은 이 경로 아래에 `FEAT-<domain>-<number>` Package로 생성한다.

## 생성 순서

1. `00-governance/templates/`의 일곱 Template을 복사한다.
2. Feature README에 Owner, 상태, Roadmap Release와 모든 산출물 링크를 기록한다.
3. G0부터 G3까지 승인된 뒤 Source 구현을 시작한다.
4. G4 증거가 준비된 뒤 Release 상태로 전환한다.

## 상태

`discovery`, `definition`, `design`, `build-ready`, `in-development`, `pilot`,
`released`, `retired`만 사용한다.

## 현재 Package

- `DWP-R0-SEC-001-session-lifecycle`: Session·CSRF·기기 관리 Foundation
- `DWP-R0-UI-001-enterprise-ai-foundation`: DWP UI·AI Trust Foundation
- `DWP-R0-ADM-001-platform-control-plane`: Tenant 기준정보·감사 Control Plane
- `DWP-R0-ADM-002-product-registry`: App·Connector·Agent·Tool·Policy Registry
- `DWP-R0-ADM-003-identity-access-governance`: Tenant 사용자·Role·Session 통제
- `DWP-R0-ADM-004-organization-group-directory`: 조직 계층·직접 Group·Membership 통제
- `DWP-R0-GOV-001-enterprise-audit-control`: 감사 증적·탐지·조사·보존·무결성 Control Plane
- `DWP-R1-CORE-001-reference-work-hub`: R1 Reference Work Hub
- `DWP-R1-CORE-002-personal-home-experience`: Sidebar 없는 개인 Home과 Tenant Presentation
- `DWP-R1-AI-001-governed-ask-runtime`: 권한 기반 Context·Citation·Model Route Ask Runtime
