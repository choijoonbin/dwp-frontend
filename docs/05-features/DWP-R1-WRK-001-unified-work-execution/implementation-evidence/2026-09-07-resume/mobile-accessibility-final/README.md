# Work 모바일·접근성 마감 감사 — 2026-09-07

상태: **생산 코드 FROZEN**. Work 모바일 범위의 재현 결함을 수정하고 대표 여정 및 화면 검증을 마쳤다. 운영 API 활성화나 Approvals, Services, Calendar, Flow 소유 기능은 이 감사에서 변경하지 않았다. 원본 Stitch 화면 전체 일치 여부는 상위 통합 마감 보고의 원본 대조와 함께 판단한다.

## 수정한 사용자 결함

1. 오늘 계획에서 키보드로 후보를 추가하면 기존 Add 버튼이 사라져 포커스가 body로 이탈했다. 추가한 업무의 제목으로, 제거 후에는 해당 후보의 Add 버튼으로 포커스를 옮긴다. 후보가 필터로 숨겨지면 해당 영역 제목을 사용한다. 포인터 사용자의 스크롤 위치는 강제로 이동하지 않는다.
2. 200% 확대에서 포커스된 개인 할 일 상태 버튼이 고정 하단 메뉴 뒤에 가렸다. Work 본문 내 포커스 대상과 실제 헤더·하단 메뉴 경계를 비교해 필요할 때 보이는 위치로 스크롤한다. 다른 앱과 본문 밖의 포털 dialog에는 적용하지 않는다.
3. 390px WebKit에서 글자를 200%로 키우면 개인 할 일 상세 제목과 편집·삭제 버튼의 글자가 겹쳤다. 제목 영역에 필요한 너비를 주고 헤더가 자연스럽게 다음 줄로 이동하도록 했다.
4. 같은 글자 확대에서 하단 DWAI·ON 라벨이 More 버튼 영역을 침범했다. 각 메뉴의 라벨을 자기 버튼 너비 안에서 줄바꿈하도록 했다.

## 변경 파일

- `apps/dwp/src/features/work-hub/use-work-today-plan-focus.ts` — 계획 목록 간 키보드 포커스 복구.
- `apps/dwp/src/features/work-hub/work-today-plan-panel.tsx` — 위 포커스 연결과 접근 가능한 복구 지점.
- `apps/dwp/src/layouts/work-layout.tsx` — Work 본문 포커스가 고정 탐색에 가리지 않도록 보정.
- `apps/dwp/src/features/work-hub/work-hub-personal-detail.tsx` — 상세 헤더 배치만 변경. 소유 명령 및 API 로직은 변경하지 않음.
- `apps/dwp/src/layouts/work-mobile-navigation.tsx` — 확대 라벨 줄바꿈.
- `e2e/work-mobile-accessibility-audit.spec.ts` — 6개 메뉴, 계획 키보드, dialog 복구, 입력 보존, 확대 가림·겹침 회귀.
- `e2e/work-native-zoom-accessibility.spec.ts` — 격리 Chromium의 실제 탭 확대 검증. 기존 `browser-zoom` 도우미 사용.

`work-task-dialog.tsx`는 다른 감사 담당자의 충돌 처리 작업을 보존했으며 직접 수정하지 않았다. 이 목록은 이번 감사에서 수정한 범위이며 저장소의 다른 진행 중 변경을 포함하지 않는다.

## 검증 결과와 증거

| 검증                                                                                                | 결과              | 로그 / 화면                                                               |
| --------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| 신규 모바일 감사, Desktop Chromium + iPhone 13 WebKit                                               | **16/16 PASS**    | `quality-final.log`, `quality-final/`                                     |
| 오늘 계획, 개인 상세, 모바일 탐색 단위 검증                                                         | **15/15 PASS**    | `unit-final.log`                                                          |
| 영향 회귀: M1 390/320, 접근 근거 1440/1280, 200% 글자, 320×360 입력, 7개 레이아웃, 키보드 상태 처리 | **14/14 PASS**    | `regression.log`, `regression/`                                           |
| 실제 Chromium 브라우저 200% 확대: 개인·오늘 계획·M1 × 640/320 CSS px                                | **6개 화면 PASS** | `native-zoom.log`, `native-zoom/`                                         |
| 확대 상태의 마지막 개인 할 일 액션 포커스                                                           | **WebKit PASS**   | `footer-before.log`, `footer-before/` (폴더명과 달리 최종 보완 이후 검사) |
| 변경 파일 ESLint                                                                                    | **PASS**          | `eslint-final.log` (성공하여 출력 없음)                                   |

마지막 확대 캡처 갱신은 `last-zoom.log`와 `last-zoom/`에 별도로 보관했다. **3 PASS / 1 의도적 SKIP**으로 종료했다. 일반 확대 2개와 실제 브라우저 확대 1개를 실행하며, 실제 Chromium 전용 시나리오의 WebKit 항목은 의도적으로 건너뛴다. `manifest.json`은 보관한 최종 PNG의 경로와 SHA-256을 기록한다. 14개 영향 회귀는 마지막 글자 겹침 보완 전에 실행했으며, 보완 이후에는 16개 감사와 확대 3개를 다시 통과했다.

6개 메뉴는 390px·320px × 한국어·영어에서 URL, 선택 상태, 더보기 닫기, 포커스 복귀와 44px 이상의 터치 영역을 확인했다. 개인 편집과 M1 결정 미리보기의 Escape 복귀, 권한 검토 사유 보존, 가상 키보드 표시 시 하단 메뉴 숨김 및 복원도 확인했다. 기존 회귀는 가로 넘침, 접근성 serious/critical 위반, 밝은/어두운 테마, 고대비, 줄인 모션, 긴 한·영 제목을 포함한다.

## 확대와 입력 검사의 구분

- Chromium 일반 회귀: 1280px 화면에 CSS zoom 2를 적용한 200% reflow. 이는 실제 브라우저 탭 확대와 구분한다.
- WebKit 일반 회귀: 390px 화면의 루트 글자를 200%로 확대. WebKit의 CSS zoom은 Chromium처럼 레이아웃 폭을 줄이지 않으므로 같은 전제를 사용하지 않았다. 초기 전제 실패는 `after-mobile.log`에 남겼고 최종 검사는 위 표와 같이 통과했다.
- 실제 브라우저 확대: 일회성 격리 Chromium 프로필에서 `chrome.tabs.setZoom(2)`와 `getZoom`을 검증했다. 물리 너비 1280/640px에서 `innerWidth`가 640/320px이고 CSS zoom은 1, 루트 글자는 16px임을 확인했다. 사용자 브라우저 프로필에는 확장을 설치하지 않았다.
- 가상 키보드: VisualViewport 높이 변화 및 320×360px 입력 뷰포트 수축을 자동 재현했다. 실제 iOS 기기의 소프트웨어 키보드 검증을 의미하지 않는다.

`before/`에는 계획 포커스 이탈 및 고정 메뉴 가림의 재현 캡처가 있다. `final/`의 WebKit 200% 글자 캡처는 글자 겹침을 발견한 중간 증거이며, 수정 후 판정에는 `quality-final/`, `footer-before/`, `last-zoom/`을 사용한다.

## 재실행

서버 `http://127.0.0.1:4211`을 재사용하고 Node 24로 실행했다. `E2E_BASE_URL`, `E2E_REUSE_EXISTING_SERVER=true`, 각 증거 폴더의 `PLAYWRIGHT_OUTPUT_DIR`을 지정한다.

```sh
node node_modules/@playwright/test/cli.js test e2e/work-mobile-accessibility-audit.spec.ts --workers=1
node node_modules/vitest/vitest.mjs run apps/dwp/src/features/work-hub/work-today-plan-panel.test.tsx apps/dwp/src/features/work-hub/work-hub-personal-detail.test.ts apps/dwp/src/layouts/work-mobile-navigation.test.tsx --config apps/dwp/vitest.config.ts
```

실제 탭 확대 검사는 `E2E_BROWSER_ZOOM_EXTENSION`에 이 폴더의 `qa-browser-zoom-extension` 절대 경로를 지정한 후 `work-native-zoom-accessibility.spec.ts --project=chromium --workers=1`로 실행한다.
