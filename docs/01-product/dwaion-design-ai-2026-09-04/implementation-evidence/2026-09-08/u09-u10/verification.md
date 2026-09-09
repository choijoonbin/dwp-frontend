# U09·U10 구현 및 검증 기록 · 2026-09-08

U09의 사용자와 주 작업은 구성원이 정확한 AI 실행 결과를 목록과 상세에서 확인하고 연결 대화로 돌아가는 것이다. U10은 현재 앱의 문맥을 유지하면서 질문 패널을 여는 전역 도우미다.

## 변경 범위

- `apps/dwp/src/features/dwaion/dwaion-activity.tsx`: 조회, 권한 판단, URL 필터·선택, 상세 orchestration 유지. 622줄에서 225줄로 분리했다.
- `apps/dwp/src/features/dwaion/dwaion-activity-view.tsx`: 목록 헤더/본문/행, 빈 inspector, 상태 색 함수 이동. 404줄이며 UI 동작을 변경하지 않았다.
- `apps/dwp/src/components/dwaion-assistant/dwaion-launcher.tsx`: 도킹된 런처가 있는 360px 이하 헤더에서 선택적 테넌트 브랜드 접미 영역이 공간을 양보한다. DWP 제품 로고와 테넌트를 포함한 접근 가능한 홈 링크 이름, 검색/알림/계정/44px 런처를 유지한다. 공통 shell-header·brand 소스는 수정하지 않았다.
- `e2e/dwaion-launcher-header-contract.spec.ts`: 6개 프로필의 전체 헤더 버튼 가림·잘림, 런처 크기, axe, Enter/Escape/focus 복귀와 캡처 추가.

기존 dirty `e2e/dwaion-activity-list-detail.spec.ts`의 다른 작업 변경은 보존했다. 기존 런처 검증을 느슨하게 바꾸지 않았다.

## 실행 결과

Node `v24.19.0`을 사용했다. 개발 서버는 `http://127.0.0.1:4300`, test mode이며 API는 각 suite의 계약 fixture로 재현했다.

| 명령/범위                                                                                                                                                                      | 결과                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 관련 4개 소스 및 새 런처 suite Prettier / ESLint                                                                                                                               | 통과                                                                              |
| `corepack yarn vitest run apps/dwp/src/features/dwaion/dwaion-activity-model.test.ts apps/dwp/src/features/dwaion/dwaion-activity-summary.test.tsx`                            | 2 files / 7 tests 통과                                                            |
| `corepack yarn playwright test e2e/dwaion-launcher.spec.ts e2e/dwaion-launcher-header-contract.spec.ts e2e/dwaion-activity-list-detail.spec.ts --project=chromium --workers=2` | 24 통과 / 1 실패. Activity 최초 필터 확인 중 예상 1회 대신 목록 조회 2회가 관찰됨 |
| `corepack yarn playwright test e2e/dwaion-activity-list-detail.spec.ts --project=chromium --workers=1`                                                                         | 수정 없이 9/9 통과, 21.9초                                                        |
| 기존 런처 suite + 신규 헤더 suite                                                                                                                                              | 위 결합 실행에서 16/16 통과                                                       |
| `corepack yarn playwright test e2e/activity-stitch-visual-quality.spec.ts --project=chromium --workers=2 --grep 'DWAI·ON 실행 이력\|품질 매트릭스'`                            | 5/5 통과, 1.6분                                                                   |
| 수정 파일 `git diff --check`                                                                                                                                                   | 통과                                                                              |

결합 실행의 최초 Activity 조회 횟수 실패 원인은 확정하지 않았다. 공유 개발 서버에서 동시 편집이 있었으며, 별도 실행에서는 동일한 강한 조회 횟수 단언을 유지해 통과했다. 전체 저장소 typecheck/build 최종 수치는 상위 작업이 별도 기록한다.

## 수용 기준과 증거

| 화면                             | 계약 및 상태                                                                                                                                                                   | 검증                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| U09 · `/dwaion/activity?run=...` | 최근 100건 범위 조회, URL 상태 필터·정확한 run, 최근 창 밖의 실행 조회, APP.ASK-only 권한과 공통 상세 요청 분리, stale 권한 응답 후 민감 데이터 제거                           | Activity E2E 9개; 목록·상세 390/320/320×568 캡처 5개             |
| U09 · Stitch 품질                | 1440/1280/390/320, 한국어 light, 긴 영어 dark+high contrast, forced colors, 200% text, reduced motion, axe/overflow                                                            | `activity-quality-dwaion-*.png` 16개; 기존 기준선 변경 없이 통과 |
| U10 · 전역 도우미                | overlay로 본문 크기 유지, 실제 Ask request/answer와 opaque workspace 인계, configuration-required 구분, 이벤트 기반 motion, 전체화면·200% text·CSS zoom, 하단 업무 액션 비가림 | 기존 런처 E2E 10개                                               |
| U10 · 헤더 도킹                  | 320/390/768/390@200%, 320 dark/forced colors, 44px, 검색/알림/계정 표시, 기존 액션 겹침·잘림 없음, Enter/Escape/focus 복귀                                                     | 신규 E2E 6개, `dwaion-launcher-*.png` 6개                        |

대표 320px 런처와 forced colors/dark, 200% text, Activity 320 목록·상세, 1440 light·390 dark·320 forced colors·1280 확대 캡처를 육안 확인했다. 모바일 quality 캡처는 full-page 이미지이므로 실제 화면 높이 아래에 드로어 뒤 목록이 포함될 수 있다. 실제 viewport 전체화면 동작은 별도 viewport 캡처와 geometry/axe 단언으로 확인했다.

이 증거는 계약 fixture를 사용한 화면 및 기능 수용 검증이다. 실제 테넌트의 운영 연결 상태나 AI 실행 성공률을 증명하거나 주장하지 않는다.
