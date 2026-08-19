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
- `DWP-R1-ADM-006-governed-catalog`: 자산 관계·영향·Assurance Catalog
- `DWP-R1-ADM-007-navigation-app-access-governance`: 메뉴·앱 접근 계약과 승인 수명주기
- `DWP-R1-ADM-008-localization-studio`: 번역 Draft·독립 검토·게시·복원 Studio
- `DWP-R1-CORE-003-account-preferences`: 개인 설정과 Tenant 관리 정책·예외
- `DWP-R1-CORE-004-governed-sharing-export`: Team View 소유권과 통제형 Workforce 반출
- `DWP-R1-CORE-005-notification-platform`: Event 기반 알림 센터·개인 설정·정책·Omnichannel 전달
- `DWP-R1-COM-001-enterprise-communications`: 대상화 소식·필수 확인·게시 거버넌스
- `DWP-R1-SVC-001-employee-services`: 구성원 서비스 Catalog·Request·SLA 운영
- `DWP-R1-APR-001-enterprise-approval-decision-hub`: 통합 결재함·Workflow·결정 증적·원업무 반영
- `DWP-R1-HR-001-role-aware-hcm`: 개인·Manager·위임 HR 운영을 분리한 역할 인지 DWP HCM
- `DWP-R1-CAL-001-enterprise-calendar`: 오늘 중심 일정·가용 시간·자원 예약·위임 운영
- `DWP-R1-MAIL-001-enterprise-mail`: 행동 중심 메일·공유함 협업·사람 승인형 AI 제안
- `DWP-R2-SPC-001-enterprise-spaces`: 목적별 사람·콘텐츠·앱·AI를 묶는 통제형 협업 Space
