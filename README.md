# DWP Frontend Starter

새 DWP 프로젝트를 시작하기 위한 React 애플리케이션 셸입니다. 로그인과
공통 헤더, 빈 사이드바, 테마·다국어 기반만 유지하며 기존 업무 메뉴와 기능
모듈은 포함하지 않습니다.

## Structure

```text
apps/dwp                 애플리케이션 셸, 인증 화면, 라우팅
libs/design-system       공통 UI 컴포넌트와 테마
libs/shared-i18n         공통 번역 기반
libs/shared-utils        인증 API, 세션, 권한과 HTTP 기반
docs                     제품·설계·아키텍처·기능·Delivery 계약
e2e                      앱 Journey·접근성·시각 회귀 테스트
e2e-storybook            공통 Component 상호작용·접근성·시각 회귀 테스트
scripts                  Dependency License 검증 자동화
```

## Requirements

- Node.js 20 이상
- Corepack과 Yarn 4.17.1
- Backend Gateway: `http://localhost:8080`

## Development

```bash
corepack yarn install
corepack yarn dev
```

기본 주소는 `http://localhost:4200`입니다. 개발 환경에서는 동일 출처 `/api`를
`VITE_API_PROXY_TARGET`의 Gateway로 전달합니다. 별도 API Origin이 필요한 배포만
`VITE_API_URL`을 설정합니다. 전체 환경은 백엔드 통합 명령으로 실행합니다.

```bash
cd ../dwp-backend
./dev up full
```

## Verification

```bash
corepack yarn format:check
corepack yarn lint
corepack yarn typecheck
corepack yarn test
corepack yarn build
corepack yarn build-storybook
corepack yarn test:e2e
corepack yarn test:storybook
corepack yarn license:check
```

브라우저 인증은 JavaScript Token Storage가 아니라 Backend의 `HttpOnly` Session
Cookie를 사용합니다. 상태 변경 API는 `/api/auth/csrf`에서 받은 Token을
`X-XSRF-TOKEN` Header로 자동 전송합니다.

Design System Workbench는 `corepack yarn storybook`으로 실행하며 기본 주소는
`http://localhost:6006`입니다.

새 업무 기능은 `docs/05-features/<feature-id>/`에 기획·화면·디자인·데이터·API·권한·
AI·수용 테스트 계약을 먼저 만들고 Build Ready Gate를 통과한 뒤 구현합니다. 외부
제품과 화면은 비교·검증 자료로만 사용하며 Source, Asset과 시각 구성을 복제하지
않습니다.
