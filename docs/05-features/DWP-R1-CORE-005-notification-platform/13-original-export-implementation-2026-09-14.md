# 알림 원본 export 반영 및 검증

기준일: 2026-09-14. 앞선 12번 문서의 이미지 기반 보완 이후 사용자가 제공한 원본 ZIP을
직접 읽고 재구현했다. 12번의 원본 접근 불가 설명은 그 당시 검증에만 해당한다.
이번 검증은 원본 `code.html`의 배치·상태·밀도와 `screen.png`를 함께 기준으로 삼는다.

## 원본 기준점

- 제공 파일: `/Users/a10697/Downloads/stitch_enterprise_grid_calendar_application (6).zip`
- SHA-256: `846ab492abadc7538ef33ed23b45ec5a63682df7ecadc561fb35dcc0268d3924`
- 작업용 추출: `/tmp/dwp-notification-stitch-original-20260914/stitch_enterprise_grid_calendar_application`
- 화면 export: 17개. 첨부 HTML의 CDN script나 지시문을 실행하지 않았다.
- 기존 DWP React/Vite, MUI 및 공통 디자인 시스템을 유지했다. 예시 Next.js 디렉터리나 별도
  Tailwind/Zustand 상태 저장소를 이중으로 도입하지 않았다.

## 화면 추적

| 원본 export                     | 실제 구현 경로·상태                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `dwp_v2_1440px_actionable_home` | `/notifications/home`: 조치·멘션·업데이트, 브리핑, 앱별 집계, 수신 환경                        |
| `dwp_1440px_3`                  | 홈: 멘션 보조 조회 실패와 부분 상태·재검사                                                     |
| `dwp_390px_v2`                  | 모바일 홈: 한 열 구성, 같은 필터·조치·답장·앱별 집계                                           |
| `dwp_390px_1`                   | 모바일 오프라인: 상태 표시와 쓰기 차단; 허구의 offline outbox/LWW 문구 제외                    |
| `dwp_01._1440px`                | `/notifications/center`: 목록과 미선택 상세 상태                                               |
| `dwp_02._1440px_2`              | 센터: 선택 도구, 일괄 처리 부분 성공·실패 복원                                                 |
| `dwp_03._390px_sheet`           | 모바일 센터: 필터 sheet와 동일 서버 조회 조건                                                  |
| `dwp_1440px_04._detail_actions` | 데스크톱 상세: 수신 이유·원천 정보·미리보기·답장·고정 작업 버튼                                |
| `dwp_390px_04._mobile_detail`   | 모바일 상세: 미리보기 이후 개인 조치, 원천 이동·답장 footer                                    |
| `dwp_1440px_5`                  | 센터: 나를 멘션/저장됨/나중에/정리됨, 개인 보기, 원천 삭제·권한 회수                           |
| `dwp_390px_3`                   | 모바일 센터: 동일 보기·수신 이유·개인 보기 및 원천 상태                                        |
| `dwp_1440px_1`                  | `/notifications/settings`: 설정/수신 진단 2탭, 6채널·유형 matrix·집중 시간                     |
| `dwp_390px_polished`            | 모바일 설정·수신 진단: 세로 구성, 동일 잠금·기기 해제·재검사                                   |
| `dwp_1440px_2`                  | `/notifications/admin/overview`, `/operations`, `/suppressions`: 영향·실패·UNKNOWN·억제 통제   |
| `dwp_unknown_390px`             | 모바일 운영 조사·결과 불명·억제 이력 및 사유 기반 제어                                         |
| `dwp_1440px_4`                  | `/notifications/admin/contracts`, `/policies`, `/templates`: 카탈로그/상세·현재/제안 비교·검증 |
| `dwp_390px_2`                   | 모바일 관리자: 동일 개요·카탈로그·정책·템플릿·전달·억제 작업                                   |

위 추적은 각 상태의 구현 위치를 나타낸다. 고정 샘플 숫자나 모든 외부 채널의 실제 운영
활성화까지 완료됐다는 의미는 아니다. `/notifications/inbox`는 정본 센터 경로로 연결하는
기존 호환 경로를 보존한다.

## 원본과의 정합화

1. 전 메뉴의 가로 여백은 동일한 `PageCanvas workspace` 계약을 사용한다.
   공통 Shell·Sidebar·전역 테마를 바꾸지 않았다. Notification 전용 frame만 원본의 밀도와
   공통 토큰을 연결하며 상위 palette·글꼴·명암·고대비·동작 설정을 보존한다.
2. 홈은 본문/보조 레일 2:1, 8px 표면 radius, 20px 제목, 13px 본문, 간결한 검색·상태 band,
   filled KPI 필터와 브리핑으로 재구성했다. 동일한 제목과 동기화 시각의 중복을 제거했다.
3. urgent 조치는 빨간 왼쪽 경계, 대화는 의미상 녹색, 일반 업데이트는 간결한 행으로 구분한다.
   긴급 대화는 긴급도 색상이 우선한다. API가 주는 안전한 미리보기와 답장 capability를 따른다.
4. 설정은 전역 채널 → 앱/유형 → 집중 시간 → 도착 알림/개인정보 → 요약 순서다.
   진단·기기 목록은 별도 탭에 있으며 처음에는 펼쳐져 있다. 탭 왕복 시 사용자의 접기 상태를
   유지한다. 모바일도 같은 문서를 스크롤하며 section navigation으로 이동한다.
5. 유형 matrix의 900px 전환은 실제 content container 폭에 따른다. API가 제공하지 않은
   채널 값은 조작 없는 `-`와 tooltip으로 표시하며 false 또는 enabled로 추정하지 않는다.
6. 설정 폭 변경 시 보던 섹션을 유지한다. responsive reflow를 ResizeObserver로 따라가되
   사용자 pointer/wheel/keyboard 입력이 시작되면 자동 위치 복원을 중단한다.
7. 상세는 수신 context, 안전한 본문, 실제 답장, 원천 이동 순서다. 상세 작업대 높이는 실제
   header/filter/bulk-feedback 아래 남는 viewport를 측정해 footer가 첫 화면 밖으로 밀리지 않게 한다.
8. 운영 개요는 예외/조치 우선이며 빈 차트가 옆 영역을 늘리지 않는다. 일별 bucket의 날짜를
   유지한다. 템플릿은 현재 적용본과 대기 초안의 진입을 구분하며 승인 대기 목록은 184px 내에서
   스크롤한다. 검토 대상·독립 승인·사유·원본 비교는 제거하지 않는다.

## 기능·보안 진실성

- 전용 화면만 바꿨으며 실제 query, durable triage, URL 조건, 개인정보 보호 및 원천 재인가를 유지한다.
- 읽음/저장/미룸/정리는 기존 optimistic update와 실패 복원을 사용한다. 성공 확정 전 외부 업무를
  승인 완료로 간주하지 않는다. 결재 등 원천 업무 실행은 해당 앱의 실제 권한·명령 계약을 따른다.
- 대화 답장은 실제 Messaging API 성공 뒤에 알림을 정리한다. 실패한 초안을 보존하고 같은 내용의
  재시도는 idempotency key를 재사용한다. pending 동안 수정·중복 전송을 막는다.
- 원천 삭제·조회 권한 회수·sensitive 내용은 답장/원천 실행을 차단하거나 명시적인 확인을 거친다.
- 조회 실패와 partial을 0건/정상으로 꾸미지 않는다. 홈 수신 상태는 capabilities와 effective-settings를
  실제 조회한다. 홈 재검사 시 이 두 query도 갱신한다.
- 원본의 고정 99.82%, AI 생성 요약·제안, 감사 완료, Provider ACTIVE, 외부 채널 발송 성공,
  offline queue, replay 또는 SoD 실행 완료 등을 샘플 숫자나 문구로 제품에 추가하지 않았다.
- 외부 Provider credential/실발송, Kafka HA·부하·DR 및 승인 증적은 기존 외부 Gate를 유지한다.

## 소스 크기·소유 범위

`notification-template-studio.tsx`의 중간 1,063줄 초과를 기존 상세 UI의 전용 컴포넌트 분리로
해결했다. 첫 compile-safe checkpoint는 910줄/200줄이었다. 최종 미세 보완 후 studio는
930줄, `notification-template-detail-workspace.tsx`는 200줄이다. 기존 변수·원본·미리보기·
리비전·복구 제안·게시/철회 동작은 보존했다. 공통 DS barrel을 추가하지 않았고 기준값 확대도 없다.

- 홈/센터: frame, home/header/insights, action-card, inbox-chrome, filter-bar, center 및 상세 3개 컴포넌트.
- 신규 전용 helper: `use-notification-inspector-height.ts`, `notification-preference-styles.ts`,
  `notification-template-detail-workspace.tsx`.
- 설정: preferences/navigation/channel-grid/type-setting-rows/delivery-status/delivery-endpoints.
- 관리자: admin/metric-grid/overview-trend/product-pages/operations-workbench/policy-studio/channels/
  suppression-studio/template-studio/preview/responsive-catalog/governance-comparison/policy-simulation.
- locale: Notification `preferences.valueNotProvided` ko/en만 추가.
- 회귀: notifications, notification-design-completion, notification-admin-governance,
  notification-design-refinement specs. 신규 inspector footer 회귀를 포함한다.
- 공통 matrix·canonical·readiness·baseline·Shell·Sidebar·Approval SLA 파일은 편집하지 않았다.
  `preferences.RawTypography` 감소 1건은 Root 소유자가 downward-only ratchet을 수행한다.
- 부분 커밋 없음. 전문가 작업은 인계 완료 후 쓰기를 중단했다.

## 검증 기록

Node 24와 저장소 고정 Yarn을 사용했다. 브라우저 검증은 API fixture 기반 실제 렌더링이며
외부 발송/SSE의 두 계정 운영 검증을 대체하지 않는다. 저장·실패 복원·권한·부분 실패·
개인정보 및 viewport 검증 assertion을 제거하지 않았다. 의도적으로 변경된 탭/미리보기
샘플에는 새 UI 진입 조건을 반영했다.

```sh
corepack yarn vitest run apps/dwp/src/features/notifications apps/dwp/src/routes/notification-routes.test.tsx
corepack yarn eslint apps/dwp/src/features/notifications e2e/notifications.spec.ts e2e/notification-design-refinement.spec.ts e2e/notification-admin-governance.spec.ts e2e/notification-design-completion.spec.ts --max-warnings=0
corepack yarn typecheck
corepack yarn source-size:check
corepack yarn architecture:check
corepack yarn build
DWP_FRONTEND_DEV_PORT=4222 E2E_BASE_URL=http://127.0.0.1:4222 PLAYWRIGHT_OUTPUT_DIR=/tmp/dwp-stitch-original-release corepack yarn playwright test e2e/notifications.spec.ts e2e/notification-design-completion.spec.ts e2e/notification-admin-governance.spec.ts e2e/notification-views.spec.ts e2e/notification-design-refinement.spec.ts e2e/notifications-runtime.spec.ts --project=chromium --workers=2
```

최종 Gate와 캡처는 아래에 기록한다. 앞선 전체 build/규모·성능 PASS는 그 당시 기준점에만 해당하며
현재 실행 결과와 구분한다.

| Gate                                | 이번 원본 반영 결과                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Notification unit/route             | 11 files / 50 tests PASS                                                                                                        |
| 전체 Notification Chromium 6spec    | 57/57 PASS, 2.4분, 1440/1280/390/320px·부분 실패·개인정보·저장 복원 포함                                                        |
| 설정 responsive 위치 유지 반복      | 3/3 PASS; 실제 모바일 섹션 제목 viewport 포함 assertion 추가                                                                    |
| 최종 footer inset/분할 상세         | 2/2 PASS; 1280x720·1440x960 및 bulk 도구 표시 전후                                                                              |
| 실제 mobile WebKit                  | 전용 workflow 1/1 PASS; 홈·상세·목록 복귀·6채널 잠금·진단 탭 접기 상태 보존                                                     |
| TypeScript                          | 전체 PASS, Notification 타입 오류 0                                                                                             |
| scoped Notification + 전용 E2E lint | 오류 0 / 경고 0                                                                                                                 |
| Source size                         | PASS; template studio 930줄 / helper 200줄 / center 983줄                                                                       |
| DS adoption                         | 전체 PASS, 3246 grandfathered JSX; Root downward-only ratchet 이후                                                              |
| i18n                                | 전체 PASS; 버전 machine identifier의 direct JSX text 검사 2건 보정                                                              |
| 전체 build                          | 최신 실행은 외부 소유 `rooms/workplace-authorized-floor-metadata.ts` unreachable로 차단; Notification 자체 오류로 보고하지 않음 |

WebKit 최초 기존 8개 테스트 선택은 `beforeEach`의 Chromium-only guard로 모두 SKIP이었다.
이를 통과로 계산하지 않고 실제 실행되는 전용 mobile workflow를 추가해 1건을 별도로 검증했다.
CSS 200% 검증은 실제 browser native zoom 인증과 구분한다. 외부 운영 Gate는 이 결과와 무관하게
유지하며 승인·부하·HA·DR 증적을 디자인 테스트로 대체하지 않는다.

### 실제 캡처

이미지는 API fixture 기반 브라우저 렌더링이며 합성 테스트 계정/알림을 보여준다.
사용자·테넌트의 실데이터 또는 외부 채널 발송 완료 증거가 아니다.

- [홈 데스크톱](/Users/a10697/Work/DWP/dwp-frontend/artifacts/notification-original-export-2026-09-14/home-desktop.png)
- [홈 모바일](/Users/a10697/Work/DWP/dwp-frontend/artifacts/notification-original-export-2026-09-14/home-mobile.png)
- [설정 데스크톱](/Users/a10697/Work/DWP/dwp-frontend/artifacts/notification-original-export-2026-09-14/settings-desktop.png)
- [템플릿 데스크톱](/Users/a10697/Work/DWP/dwp-frontend/artifacts/notification-original-export-2026-09-14/template-desktop.png)
- [상세 작업대 데스크톱](/Users/a10697/Work/DWP/dwp-frontend/artifacts/notification-original-export-2026-09-14/center-detail-desktop.png)

전문 에이전트 3개가 설정, 상세/답장, 관리자 범위를 나눠 구현·감사했다. 그 범위에서 발견한
P2 밀도·누락 값·대기 초안 구분·승인 목록 확장·빈 차트 stretch 문제를 추가 보완했다.
원본의 시각 언어는 적용하되 공통 Shell 규격, 실제 데이터와 보안·접근성 차이로 생기는 의도적인
적응은 위에 명시했다. 모든 픽셀·모든 운영 상태의 100% 동등성을 주장하지 않는다.

작업 화면: 기존 개발 서버 [알림 홈](http://localhost:4200/notifications/home),
[알림 설정](http://localhost:4200/notifications/settings). 최종 파일·Gate와 compile-safe
checkpoint를 Root 통합 작업에 인계한다. 무커밋 상태로 소유 파일 추가 쓰기를 중단하며 공통
공식 build/bundle 성능 판단은 Root의 현재 실행 결과를 따른다.
