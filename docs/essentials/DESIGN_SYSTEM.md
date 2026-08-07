# Frontend Design System

새 기능은 MUI와 `@dwp-frontend/design-system`의 공통 테마를 기준으로 구현합니다.

- 색상과 간격은 테마 토큰을 사용합니다.
- 공통 피드백은 `GlobalSnackbar`와 toast store를 사용합니다.
- 권한이 필요한 UI는 `PermissionGate`를 사용합니다.
- 공통 셸에서 사용하는 `Logo`와 `Iconify`는 디자인 시스템에서 가져옵니다.
- 업무 컴포넌트는 실제 기능을 추가할 때 별도 feature 경계에 배치합니다.
