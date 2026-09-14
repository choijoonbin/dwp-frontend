# 알림 사용자·관리자 디자인 재검증 및 보완

기준일: 2026-09-14. 01-14 화면의 기능 구현과 디자인 수용을 별개로 검증한다.
사용자가 지적한 홈·개인 설정·관리자 화면의 시각 완성도를 재검토하고 실제 코드를 보완했다.
기존 공통 셸·권한·원천 업무 API를 유지하며 Notification 전용 컴포넌트만 수정했다.

## 디자인 기준과 검증 한계

- 기준은 사용자가 전달한 Stitch 홈 V2, 설정·진단, 목록/상세, 운영·정책·템플릿 결과 이미지다.
- [Stitch 프로젝트](https://stitch.withgoogle.com/projects/13391261371843159731)는 이번 도구 접근에서
  Google 로그인 또는 Chrome 도구 timeout으로 원본 화면/export를 열지 못했다.
  따라서 원본 파일 전체와 픽셀 단위 일치 또는 100% 수용을 주장하지 않는다.
- 디자인 전문 에이전트가 코드 사전 감사와 실제 Playwright 캡처 사후 감사를 수행했다.
  홈·데스크톱 설정·모바일 설정·운영 개요 및 3개 유형/6채널 matrix 캡처 범위에서 P0/P1
  시각 잔여를 발견하지 못했다. 이것은 모든 운영 상태에 대한 인증이 아니다.
- [Linear 알림](https://linear.app/docs/notifications)과
  [Slack 알림 설정](https://slack.com/help/articles/201355156-Configure-your-Slack-notifications)의
  수신 채널·집중 시간·작업 분류 원칙을 참고했다. UI를 복제하거나 실제 데이터가 없는 AI 점수,
  Provider 활성 상태를 생성하지 않는다.

## 확인한 원인

1. 다수 Notification `sx.borderRadius`가 `'shape.borderRadius'` 문자열을 CSS 값으로 넘겼다.
   실제 브라우저에서 둥근 모서리가 적용되지 않았다. 모든 해당 사용처를
   `theme.shape.borderRadius`를 해석하는 property callback으로 바꾸고 계산된 radius를 검증했다.
2. 공통 `PageCanvas workspace`는 이미 연결되어 있었다. 그러나 화면별 중첩 경계·그림자,
   설정 폼의 반복과 레일 폭이 같은 여백 안에서도 서로 다른 밀도로 보이게 했다.
3. 개인 설정은 수신 상태·기술 진단·유형별 폼이 과하게 쌓였다. 디자인의 6채널 비교와
   유형/전달 방식/채널 matrix가 아니라 긴 양식처럼 표시됐다.
4. 긴급 대화 알림에서 conversation 색상이 긴급도보다 우선했고, 앱별 긴급 0건도 빨간색으로
   표시됐다. 의미 색상의 우선순위를 교정했다.
5. 전역 채널 저장 후 effective-settings를 갱신하지 않아 토글과 앱별 적용 상태가 오래 남을 수
   있었다. 저장 중에는 잠금되지 않은 채널만 draft를 표시하고 성공·실패 후 적용 상태를 재조회한다.

## 화면별 보완

| 화면      | 주요 사용자·질문                          | 화면 유형·우선 행동                      | 반영                                                                           |
| --------- | ----------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| 홈        | 개인: 지금 확인할 조치/멘션은 무엇인가    | 실행 허브·원천 조치/답장                 | 평평한 toolbar, compact KPI, 작은 radius, 260-300px 보조 rail, 앱별 count 정렬 |
| 센터·상세 | 개인: 어떤 알림을 분류/확인할 것인가      | 목록-상세·읽음/저장/미룸/정리            | 같은 workspace 기준선과 radius, 기존 URL·선택·키보드·답장 유지                 |
| 개인 설정 | 개인: 어디로 언제 어떤 알림을 받을 것인가 | 설정 폼·자동 저장                        | 채널 → 앱 → 집중 시간 → 표시/개인정보 → 요약 순서, 6채널 tiles, 유형 matrix    |
| 수신 진단 | 개인: 수신 장애가 있는가                  | 진단·재검사                              | 4개 핵심 상태 band, 기술 진단 명시적 펼침, 기기 제어 유지                      |
| 운영 개요 | 운영자: 누가 어떤 영향을 받고 있는가      | 조치 중심 command center                 | 낮은 KPI band, findings-first, 중첩 카드/그림자 제거                           |
| 계약      | 운영자: 어떤 계약이 어떻게 전달되는가     | 검색-상세·계약 조사                      | 공통 heading/radius, 계약 상세 모든 필드 유지                                  |
| 정책      | 운영자: 어떤 규칙을 안전하게 바꿀 것인가  | 비교 studio·미리보기/독립 승인           | desktop channel 표, mobile 정의 행; 강제 가로 스크롤 제거                      |
| 템플릿    | 운영자: 어떤 메시지가 렌더링되는가        | authoring studio·렌더 미리보기/독립 승인 | 공통 frame/radius, 원본·변수·거버넌스 유지                                     |
| 전달·억제 | 운영자: 실패 원인과 안전 통제는 무엇인가  | 조사/통제 작업대                         | 같은 workspace/radius, 기존 영향·감사·사유·해제 확인 유지                      |

설정의 유형 matrix는 viewport가 아니라 실제 content container 폭으로 전환한다.
900px 이상에서는 유형/전달 방식/6채널 열을 비교하고, 좁은 화면은 같은 제어를 쌓아서 제공한다.
모바일 앱 선택은 가로 scroller로 압축하며 섹션 순서는 실제 DOM 순서와 일치한다.
집중 시간 시작/종료 및 요약 mode/시간은 데스크톱에서 나란히, 모바일에서 안전하게 줄바꿈한다.

## 검증 결과

Node 24와 저장소 고정 Yarn을 사용했다. 아래 명령의 `yarn`은 `corepack yarn`으로 실행했다.

| Gate                                     | 결과                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| Notification unit 및 route               | 11 files / 50 tests PASS                                                        |
| 기존 + 신규 4 viewport/a11y browser      | 43/43 PASS, 독립 4220 개발 서버                                                 |
| 3유형/6채널 matrix + 저장 성공/실패 복원 | 1440/390px 2/2 PASS                                                             |
| Notification ESLint                      | 오류 0 / 경고 0                                                                 |
| TypeScript                               | 최초 PASS; 후속은 동시 Approval typed-workflow 오류만 발생, Notification 오류 0 |
| Design-system adoption                   | 전체 PASS, 3382 grandfathered JSX; 신규 baseline 확대 없음                      |
| Source/maintenance-size                  | PASS; 새 파일 1,000줄 이하                                                      |
| 전체 production build                    | 최초 PASS; 후속은 동시 Approval typed-workflow unreachable 5개로 차단           |
| 전체 Notification 6개 spec 최종 실행     | 56/56 PASS, 독립 4220 서버; 2.5분                                               |
| 최신 production compile / bundle budget  | `bundle:check` PASS; 통합 Gate 차단과 구분                                      |

실행 명령:

```sh
corepack yarn vitest run apps/dwp/src/features/notifications apps/dwp/src/routes/notification-routes.test.tsx
corepack yarn eslint apps/dwp/src/features/notifications e2e/notifications.spec.ts e2e/notification-design-refinement.spec.ts e2e/support/notification-design-completion-fixtures.ts --max-warnings=0
corepack yarn typecheck
node scripts/check-design-system-adoption.mjs
node scripts/check-source-size.mjs
node scripts/check-maintenance-source-size.mjs
corepack yarn build
corepack yarn bundle:check
DWP_FRONTEND_DEV_PORT=4220 E2E_BASE_URL=http://127.0.0.1:4220 PLAYWRIGHT_OUTPUT_DIR=/tmp/dwp-notification-design-release corepack yarn playwright test e2e/notifications.spec.ts e2e/notification-design-completion.spec.ts e2e/notification-admin-governance.spec.ts e2e/notification-views.spec.ts e2e/notification-design-refinement.spec.ts e2e/notifications-runtime.spec.ts --project=chromium --workers=2
```

신규 브라우저 회귀는 사용자·관리자 9개 경로의 1440/1280/390/320px, CSS 200% 확대,
dark/high-contrast/reduced-motion, serious/critical axe 위반 없음, 실제 CSS radius/그림자,
6채널 capability 잠금과 3유형 18개 switch, 자동 저장·503 복원을 검증한다.
이 브라우저 실행은 API fixture 기반이다. 두 계정의 실제 발송/SSE 증거로 대체하지 않는다.
미등록 알림 유형의 장문 fallback 시험은 의도적으로 `E2E_MATRIX_*` 번역 미등록 경고를 낸다.
사용자 UI에는 계약에서 제공된 유형명/설명 fallback을 표시한다.

### 최종 캡처

아래 이미지는 API fixture 기반 실제 Chromium 렌더링이며, 로컬 `artifacts`에 보관한다.
미연결 외부 채널은 정상 발송/활성 상태로 꾸미지 않았다.

- [개인 설정 첫 화면](/Users/a10697/Work/DWP/dwp-frontend/artifacts/notification-design-2026-09-14/settings-desktop.png)
- [개인 설정 전체](/Users/a10697/Work/DWP/dwp-frontend/artifacts/notification-design-2026-09-14/settings-full.png)
- [알림 홈](/Users/a10697/Work/DWP/dwp-frontend/artifacts/notification-design-2026-09-14/home-desktop.png)
- [모바일 설정](/Users/a10697/Work/DWP/dwp-frontend/artifacts/notification-design-2026-09-14/settings-mobile.png)
- [운영 개요](/Users/a10697/Work/DWP/dwp-frontend/artifacts/notification-design-2026-09-14/admin-overview.png)

전체 회귀 종료 후 캡처의 초점/스크롤만 정돈한 1440px 테스트도 1/1 통과했다.
키보드 초점 검증과 캡처용 초점 해제는 별개이며 제품 초점 스타일을 제거하지 않았다.

## 소유 범위와 운영 잔여

- 새 전용 컴포넌트: `notification-channel-grid.tsx`, `notification-policy-channels.tsx`.
- 기존 전용 컴포넌트 보완: frame, UI heading, home/insights/action card, preference/navigation/type
  rows/delivery status, admin metric/overview/product pages 및 radius 사용처.
- 새 회귀: `e2e/notification-design-refinement.spec.ts`.
- 기존 테스트 보정은 스크롤을 실제 수행하고 닫힌 popover 및 상세 패널 범위를 정확히 확인하는
  변경이다. 권한/저장/반응형 assertion은 제거하지 않았다.
- 공통 셸·Sidebar·theme·canonical·readiness·baseline·Approval 파일은 편집하지 않았다.
  별도 루트 통합 소유자가 공유 트리의 ratchet과 Approval Gate를 처리한다.
- Provider credential/실발송, Kafka HA·부하·DR, governed replay 운영 계약은 이전 외부/승인
  Gate를 유지한다. 디자인 개선으로 활성화하거나 완료 처리하지 않았다.
- Approval SLA Notification backend 초안은 별도 통합 작업에 인계한 안전 지점에서 동결돼 있다.
  이 문서의 UI 완료 범위에 포함하지 않는다.
- 부분 커밋을 만들지 않는다. 최종 파일·검증 결과를 루트 통합에 전달한다.
