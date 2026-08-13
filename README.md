# DWP Frontend Starter

새 DWP 프로젝트를 시작하기 위한 React 애플리케이션 셸입니다. 안전한 로그인,
Global Shell, DWP Work Hub Reference와 Tenant Admin Control Plane을 포함하며 기존
업무 시스템의 메뉴와 기능 모듈은 포함하지 않습니다.

## Structure

```text
apps/dwp                 애플리케이션 셸, 인증 화면, 라우팅
libs/design-system       공통 UI 컴포넌트와 테마
libs/shared-i18n         공통 번역 기반
libs/shared-utils        인증·Platform API, 세션, 권한과 HTTP 기반
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

이 저장소는 `packageManager`와 CI가 고정한 Yarn 4 단일 Workspace다. `pnpm-lock.yaml`,
`pnpm-workspace.yaml`, `package-lock.json` 또는 Bun Lockfile이 생기면
`corepack yarn package-manager:check`와 CI가 실패한다.

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
corepack yarn test:performance
corepack yarn test:visual
corepack yarn test:storybook
corepack yarn license:check
corepack yarn release:evidence:check
```

`corepack yarn build`는 production manifest를 분석해 초기 Entry, 정적 의존 청크와 가장 큰
지연 청크의 raw/gzip 예산을 강제합니다. Pull Request에서는 Shell 접근성·반응형 계약과
Shell 준비 시간, SPA 전환 시간, CLS 예산도 GitHub Actions가 검증합니다. 운영 환경에서
`VITE_WEB_VITALS_ENDPOINT`를 설정하면 LCP·INP·CLS를 개인정보나 원문 URL 없이 Route
Group 단위로 전송합니다.

`release:evidence:check`는 `R2`·`R3`·외부 결정·승인 원장의 구조와 증거 경로를 검증합니다.
실제 출시 승인에는 `corepack yarn release:gate`를 사용하며, 외부 성능·접근성·보안·운영
증거가 완료되기 전에는 의도적으로 실패합니다. GitHub의 수동 `Release readiness`
워크플로도 같은 Gate를 실행합니다.

브라우저 인증은 JavaScript Token Storage가 아니라 Backend의 `HttpOnly` Session
Cookie를 사용합니다. 상태 변경 API는 `/api/auth/csrf`에서 받은 Token을
`X-XSRF-TOKEN` Header로 자동 전송합니다.

Tenant Admin은 계정 메뉴의 `Administration`에서 사용자 Role, 기준정보, 제품 Registry와
통합 감사 이벤트를 관리합니다. Role 변경은 자기 변경·마지막 Admin 제거를 차단하고 대상
Session을 폐기합니다. 앱·Connector·Agent·Tool·Policy의 실행 상세와 Secret은 Registry
Envelope에 저장하지 않고 후속 전용 계약으로 분리합니다.

Design System Workbench는 `corepack yarn storybook`으로 실행하며 기본 주소는
`http://localhost:6006`입니다.

새 업무 기능은 `docs/05-features/<feature-id>/`에 기획·화면·디자인·데이터·API·권한·
AI·수용 테스트 계약을 먼저 만들고 Build Ready Gate를 통과한 뒤 구현합니다. 외부
제품과 화면은 비교·검증 자료로만 사용하며 Source, Asset과 시각 구성을 복제하지
않습니다.
