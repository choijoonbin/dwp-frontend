# R1 Frontend Performance 및 Visual Quality Gate ADR

- 상태: Accepted
- 적용일: 2026-08-11
- 대상: DWP Web Shell, Product Area, Tenant Control Center, Provider Control Plane

## 1. 결정

DWP는 화면 완료 여부를 정적 검사와 육안 확인만으로 판정하지 않는다. Production Bundle,
실사용 성능, 반응형 Shell, 접근성, 다국어·권한별 시각 상태를 별도 품질 계약으로 관리한다.

공식 기준은 다음과 같다.

- [Vite Production Build](https://vite.dev/guide/build)는 동적 import를 비동기 청크로
  분리하고 production 산출물을 기준으로 최적화하도록 안내한다.
- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)는 동일한 실행
  환경에서 안정화된 screenshot을 반복 비교하도록 권고한다.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)의 Reflow, Focus Visible, Focus Not Obscured와
  Target Size를 Shell 수용 기준으로 사용한다.
- [Core Web Vitals](https://web.dev/articles/defining-core-web-vitals-thresholds)는 75번째
  백분위 기준 LCP 2.5초, INP 200ms, CLS 0.1 이하를 좋은 사용자 경험의 경계로 정의한다.

## 2. Bundle Gate

`vite build`는 `.vite/manifest.json`을 생성하고 `scripts/check-bundle-budget.mjs`가 정적 import
그래프를 재귀 분석한다. 단순히 가장 큰 파일 하나만 검사하지 않는다.

| 항목                      |       R1 예산 |
| ------------------------- | ------------: |
| Entry raw / gzip          | 460KB / 140KB |
| 초기 정적 JS raw / gzip   | 1.2MB / 350KB |
| 초기 JS request           |      5개 이하 |
| 최대 지연 청크 raw / gzip | 550KB / 170KB |

Enterprise DataGrid와 Date Picker는 공통 Barrel을 통해 Shell로 유입하지 않고 Feature 또는
Route 경계 뒤에 둔다. 예산을 늘리는 변경은 원인 분석, 사용자 영향, 대안과 새 측정값을 ADR에
기록해야 하며 단순히 JSON 숫자만 올릴 수 없다.

## 3. Runtime Observability

`web-vitals`는 초기 Entry에 포함하지 않고 Browser Idle 시 별도 청크로 로드한다. 수집 대상은
LCP, INP, CLS이며 payload에는 Metric, Rating, Navigation Type과 Shell Route Group만 포함한다.

- 사용자 ID, Email, Tenant ID, 검색어, 원문 URL과 Route Parameter를 전송하지 않는다.
- 운영 Collector는 `VITE_WEB_VITALS_ENDPOINT`로 주입하며 미설정 환경은 Network 전송을 하지
  않고 Browser Event만 발행한다.
- SPA Route 전환은 동일 Origin Link 또는 History Intent부터 두 번의 Animation Frame이 지난
  Commit까지 측정한다.

R1 Lab Gate는 Shell Ready 3초, SPA Route Transition 1초, CLS 0.1 이하이다. 운영 출시 Gate는
충분한 Traffic 확보 후 Mobile·Desktop 각각 75번째 백분위 Core Web Vitals로 승격한다.

## 4. Shell 및 Visual Matrix

자동 계약은 다음을 포함한다.

| 축         | 기준 상태                                               |
| ---------- | ------------------------------------------------------- |
| Viewport   | 1280, 1200, 1024, 640 CSS px, iPhone 13                 |
| Locale     | 한국어, 영어                                            |
| Persona    | 일반 구성원, 테넌트 관리자, 프로바이더 관리자           |
| Appearance | Light, Dark, High Contrast, Compact·Comfortable Density |
| Shell      | Workspace, People, Admin, Provider, Mobile Drawer       |

Screenshot은 운영체제와 Browser Rendering 차이에 종속되므로 동일 CI Image에서 생성하고
비교한다. Snapshot 갱신은 UI 변경 의도와 검토 근거가 있는 변경에서만 허용한다.

## 5. 접근성 및 Reflow

- 문서의 첫 Keyboard Target은 `본문으로 건너뛰기` 링크다.
- 모든 Product Shell은 하나의 `main#dwp-main-content`를 가지며 SPA 경로 변경 후 Main으로
  Focus를 이동한다.
- Header는 Viewport가 아니라 실제 남은 Header 폭을 기준으로 축약한다. 검색 입력은 Icon,
  사용자 보조정보는 Avatar, Workspace는 제한 폭에서 숨김으로 전환하되 Application Context,
  Search, Notification과 Account 진입점은 유지한다.
- 200% 확대를 640 CSS px Reflow 상태로 검증하며 Header에 수평 Scroll이나 겹침을 허용하지
  않는다.

## 6. Delivery Gate

`dwp-dev` Push와 Pull Request에서 GitHub Actions는 Formatting, Lint, Type, Unit Test,
Production Build와 Bundle Budget, Chromium Shell Contract, Runtime Performance Budget을
순차 실행한다. macOS 기준 Visual Snapshot은 개발 단계에서 `corepack yarn test:visual`로
검증하며 Linux CI Baseline을 승인한 뒤 PR 필수 Gate로 확장한다.
