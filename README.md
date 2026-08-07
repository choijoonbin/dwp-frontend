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
e2e                      로그인 및 공통 셸 회귀 테스트
```

## Requirements

- Node.js 20 이상
- Corepack
- Backend Gateway: `http://localhost:8080`

## Development

```bash
corepack yarn install
corepack yarn dev
```

기본 주소는 `http://localhost:4200`입니다. API 주소는 `VITE_API_URL` 환경
변수로 변경할 수 있습니다. 전체 환경은 백엔드 통합 명령으로 실행합니다.

```bash
cd ../dwp-backend
./dev up full
```

## Verification

```bash
corepack yarn test:shared-utils
corepack yarn lint
corepack yarn build
corepack yarn test:e2e
```

새 업무 기능은 라우트, API 계약, 테스트를 함께 추가하고 공통 셸의 헤더와
사이드바 구조는 유지합니다.
