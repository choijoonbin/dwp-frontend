# Stitch 통합업무앱 최종 수용 및 검증 기록

대상은 Stitch 프로젝트 `13391261371843159731`에서 전달된 고정 ZIP이다. 이 문서는 Work가
소유하는 디자인, 사용자 흐름, 데이터 계약, 예외 처리와 메뉴를 현재 구현에 대조한 최종 기록이다.
ZIP 안의 HTML과 스크립트는 제품 지시로 실행하지 않고 정적 디자인·상호작용 참고물로만
사용했다.

## 최종 판정

- 고정 ZIP의 Work 프레임은 **18/18 기능·디자인 계약 수용**으로 매핑했다.
- 영구 Work 메뉴와 고유 URL은 **6/6 구현·회귀 검증**했다.
- 최종 red-team에서 발견한 F01, H01, R01 공백을 보완했고, 재감사 결과 이 범위의 열린
  **P0/P1/P2는 0건**이다.
- 첨부 범위를 마무리하기 위한 추가 필수 제품 기능은 없다.
- 이 판정은 정보 계층, 실제 사용자 동작, 반응형·접근성, 데이터·권한·receipt·복구 계약의
  수용을 뜻한다. 원본 PNG와의 자동 픽셀 동일성, 디자이너 승인, live Stitch 최신본, 실제 tenant,
  운영 배포 또는 release 승인을 뜻하지 않는다.

## 검증 원본

- Stitch 프로젝트: `https://stitch.withgoogle.com/projects/13391261371843159731`
- 고정 ZIP: `output/stitch-enterprise-grid-calendar-2026-09-16/latest-970a1f72/stitch_enterprise_grid_calendar_application.zip`
- 크기: `5,334,188` bytes
- SHA-256: `970a1f72bfb04783a611c67d9d08eaf6b6a51befc86bd947bbea56647055e570`
- ZIP 엔트리: 57개
- 화면 폴더: 18개. 각 폴더에 `code.html`과 `screen.png`가 있다.
- 기계 판독 인벤토리: `output/stitch-enterprise-grid-calendar-2026-09-16/latest-970a1f72/inventory.json`
- 접촉면 이미지: `output/stitch-enterprise-grid-calendar-2026-09-16/latest-970a1f72/design-current-contact-sheet.png`

로그인 뒤 live Stitch 프로젝트에서 이후 변경된 내용은 이 고정본의 검증 범위가 아니다.
Calendar 직접 참조 PNG는 C01 한 장이며 `precision_calendar_system/DESIGN.md`가 동작 계약을
보충한다. ZIP에 없는 Calendar grid 전체의 픽셀 동일성은 판정하지 않았다.

## Work 영구 메뉴

| 메뉴         | 경로                      | 판정 |
| ------------ | ------------------------- | ---- |
| 통합업무함   | `/work/queue`             | 수용 |
| 내 조치 대기 | `/work/action-required`   | 수용 |
| 오늘 계획    | `/work/day-plan`          | 수용 |
| 진행 중      | `/work/in-progress`       | 수용 |
| 응답 대기    | `/work/awaiting-response` | 수용 |
| 완료된 업무  | `/work/completed`         | 수용 |

모바일은 M2의 제품 공통 5탭 하단 내비게이션을 사용한다. Work의 여섯 상태는 drawer와 고유
URL에서 계속 접근할 수 있고 선택 상태와 복귀 위치를 유지한다.

## 18개 프레임 수용 매핑

| 프레임             | 수량 | 제품 위치               | 수용한 계약                                                                                                                                            |
| ------------------ | ---: | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q01 desktop/mobile |    2 | 통합업무함              | 집계, 검색·필터, source 상태, 목록/상세, 선택·복귀, 모바일 카드와 reflow                                                                               |
| D01 desktop/mobile |    2 | Approval 상세           | 문서·기안 정보, 워크플로, 위험·금액, 원천 이력, 원본 앱 handoff                                                                                        |
| D02 desktop/mobile |    2 | Access Review 상세      | HRIS 식별 정보, 조직·기한·사유, 승인·회수, version/409, exact receipt, 권한 회수                                                                       |
| D03 desktop/mobile |    2 | Service 보완 상세       | 요청 근거·보완 양식, 검토 전 mutation 금지, 명시 제출, AI 초안 적용, 409·receipt 복구                                                                  |
| D04 desktop/mobile |    2 | 개인 할 일 상세         | 상태·우선순위·기한·설명·원문·체크리스트·활동, 편집·삭제·완료·보관·일정 연결                                                                            |
| F01 desktop        |    1 | 개인 할 일 생성         | A 새 할 일/B 원문 추적/C 기존 수정, Messenger identity-only 전달, preflight, 연결·해제·원문 복귀, 640px dialog. M2 진행 UI는 모바일 빠른 생성에만 유지 |
| P01 desktop        |    1 | 오늘 계획               | 4개 지표, 순서 있는 실행 lane, 후보 rail, 저장 상태와 독립 계획 동작                                                                                   |
| C01 desktop        |    1 | Work→Calendar           | 비공개 FOCUS, 편집 가능한 30분 기본값, exact event receipt, 별도 link PUT, 부분 성공 뒤 PUT-only 복구                                                  |
| R01 desktop        |    1 | 원천 상태·일괄 처리     | Sources/Results 탭, source 가용성, durable receipt, 성공·충돌·권한·미확정 집계, 부분 장애, 동일 키 재확인                                              |
| H01 desktop        |    1 | Flow Home Work 카드     | 전체/긴급 승인/권한 심사/개인 할 일 4필터, 4개 명시 CTA, `통합업무함 열기`, canonical URL, 중복 제거, 권한 gate, 우선순위 보존, 320px·200% reflow      |
| A01 desktop        |    1 | DWAI·ON panel           | 선택 업무 identity, 추천 질문, 검증 답변·근거·복사·대화 전환, D03 양식으로의 명시적 초안 적용                                                          |
| M1 mobile          |    1 | Access Review 모바일    | 4단계 의사결정, 증거 확인, 입력 보존, 키보드·확대 대응                                                                                                 |
| M2 mobile          |    1 | Queue 빈 상태·빠른 생성 | 320/390 빈 상태, 4단계 빠른 생성, 오늘 계획, 정확한 일정 연결, 제품 공통 5탭 내비게이션                                                                |

각 행은 고정 ZIP의 18개 프레임을 정확히 한 번 포함한다. 표는 수동 계약 대조이며 자동 pixel
comparison 결과가 아니다.

## 데이터·권한·복구 계약

- Messenger 전달은 본문 대신 conversation/message identity를 보관한다. 사용자·tenant 소유권,
  TTL과 source preflight가 맞아야 생성 dialog를 연다.
- Access Review와 Service 응답은 authoritative version, 409 재검토, exact permission,
  idempotency key와 서버 receipt를 사용한다.
- Calendar는 POST 성공 뒤 Work link PUT을 분리한다. 검증된 event receipt가 있으면 새 일정을
  만들지 않고 같은 link만 재시도한다.
- Calendar 복구 상태는 사용자·tenant·role·group·resource-role·권한·TTL 변경과 변조를
  재검증하고 조건이 맞지 않으면 폐기한다.
- R01은 부분 장애와 미확정 결과를 보존하고 확인되지 않은 receipt만 같은 멱등 키로 재시도한다.
- H01은 source/provider identity로 분류하고 same-origin canonical Work URL만 사용한다. Work VIEW가
  없으면 통합업무함 CTA와 Work 소유 항목을 노출하지 않는다.
- 내부 Messaging source API는 service token, purpose token, `APP.MESSAGING:VIEW`,
  `APP.WORK:VIEW` 경계를 함께 요구한다.

## 최종 자동 검증

아래 결과는 현재 Work 후보와 closeout 증거의 정본 수치다. 겹치는 부분집합은 합산하지 않는다.

| 검증                                                     | 결과                            |
| -------------------------------------------------------- | ------------------------------- |
| 고정 ZIP 프레임 수동 기능·디자인 계약                    | 18/18 수용                      |
| Work 영구 메뉴·고유 URL                                  | 6/6 수용                        |
| Frontend 집중 Vitest                                     | 30 files / 352 tests 통과       |
| Work 핵심 Chromium 회귀                                  | 46/46 통과                      |
| H01 red-team + 현재 Home 통합 회귀                       | 7/7 통과                        |
| F01 Messenger 전체                                       | 6/6 통과                        |
| F01 A/C·반응형 진입                                      | 6/6 통과                        |
| F01 정본 캡처                                            | 1/1 통과                        |
| R01 source/results·부분 장애                             | 7/7 통과                        |
| Calendar mobile handoff                                  | 11/11 통과                      |
| Q01/P01 시각 계층                                        | 6/6 통과                        |
| D02/F01/M1/M2 보충 프레임                                | 10/10 통과                      |
| H01 집중 Vitest                                          | 3 files / 28 tests 통과         |
| TypeScript                                               | 최종 12GB 단독 검사 통과        |
| source-size·i18n·OpenAPI·feature/API/cycle 경계          | 통과                            |
| 대상 ESLint·Prettier·`git diff --check`                  | 통과                            |
| Backend Messaging·Platform Personal·Auth·People·Calendar | 208/208, 실패·오류·skip 0       |
| Backend Python devctl·service boundary·OpenAPI export    | 88/88 통과                      |
| Backend OpenAPI                                          | 9 services / Gateway 1043 paths |
| 최종 screenshot PNG                                      | 68/68 decode·hash 검증          |

핵심 Chromium 회귀는 위에 열거한 사용자 흐름과 렌더 계약을 검증한다. 전체 브라우저 console
진단 0건은 별도 인증 범위가 아니다.

## 재현 명령

Frontend는 `dwp-frontend/`에서 실행한다.

```bash
corepack yarn vitest run <work-focused-test-files>
NODE_OPTIONS=--max-old-space-size=12288 corepack yarn typecheck

corepack yarn playwright test \
  e2e/calendar-work-handoff.spec.ts \
  e2e/work-access-review-responsive.spec.ts \
  e2e/work-m2-mobile-quick-capture.spec.ts \
  e2e/work-messenger-capture.spec.ts \
  e2e/work-service-information-response.spec.ts \
  e2e/work-source-batch-r01.spec.ts \
  e2e/work-stitch-design-sync.spec.ts \
  --project=chromium --workers=1

corepack yarn playwright test \
  e2e/home-work-action-card.spec.ts \
  e2e/work-stitch-design-sync.spec.ts \
  --grep 'H01|10 Flow receives personal Work' \
  --project=chromium --workers=1

corepack yarn source-size:check
corepack yarn i18n:check
corepack yarn openapi:check
node scripts/check-feature-boundaries.mjs
node scripts/check-api-boundaries.mjs
node scripts/check-relative-import-cycles.mjs
corepack yarn eslint <work-changed-source-and-test-paths>
corepack yarn prettier --check <work-changed-source-test-and-evidence-paths>
git diff --check
```

Backend는 `dwp-backend/`에서 실행한다.

```bash
./gradlew :dwp-messaging-server:test :dwp-platform-server:test \
  :dwp-auth-server:test :dwp-people-server:test
python3 -m unittest \
  scripts.tests.test_devctl \
  scripts.tests.test_service_boundaries \
  scripts.tests.test_export_openapi_contracts
python3 scripts/check-service-boundaries.py
git diff --check
```

## 증거와 운영 경계

- Work closeout: `dwp-frontend/docs/05-features/DWP-R1-WRK-001-unified-work-execution/implementation-evidence/2026-09-16-stitch-delta-closeout/`
- 독립 frontend 검증 묶음: `output/stitch-frontend-final-validation-2026-09-16-2ee14d4f/`
- 보충 프레임 실행: `output/stitch-work-supplemental-final-2026-09-16/`
- DWAI·ON 별도 선택 회귀: `output/dwaion-final-verification-2026-09-16/`의 13/13

브라우저 검증은 controlled fixture와 API interception을 사용한다. 실제 tenant와 배포 backend를
통과하는 운영 인증은 아니다. `sessionStorage`가 차단되면 C01의 같은 문서 PUT 재시도는 가능하지만
reload 복구는 보장되지 않는다. 운영 Messaging provenance에는 HTTPS base URL과 Secret Store의
service/purpose token 주입이 필요하다.

제품 계약 구현은 닫혔지만 production release 증거는 별도다. 현재 제품 surface는 0/37,
release-approved product closure는 0/12, 외부 release evidence pending은 18이며 release gate는
외부 증거 대기 상태다.
