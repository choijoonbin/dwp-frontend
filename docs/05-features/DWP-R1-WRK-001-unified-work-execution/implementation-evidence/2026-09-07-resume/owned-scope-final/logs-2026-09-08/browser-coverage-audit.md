# Work E2E source coverage audit — 2026-09-08

읽기 전용 정적 감사입니다. 지정 13개 spec과 공통 fixture/config를 읽었으며 테스트 실행이나 저장소 소스 편집은 하지 않았습니다. 아래 숫자는 반복문을 전개한 소스상 등록/실행 대상 수이며 pass/fail 결과가 아닙니다. 최종 실행 결과·재시도·flaky 여부·실제 skip 수는 root의 최종 Playwright JSON을 기준으로 기록해야 합니다.

## 프로젝트와 공통 조건

- `playwright.config.ts`: `chromium`은 Desktop Chrome/Chromium(기본 1280×720, DPR1, touch=false), `mobile`은 iPhone 13/WebKit 에뮬레이션(기본 390×664, DPR3, touch=true). 실제 iPhone 기기 실행은 아닙니다. `setViewportSize`와 test.use의 재정의는 표에 기재했습니다.
- `mockWorkHubFoundation`(support/work-hub-foundation-fixtures.ts:74–84)는 모든 호출에 reducedMotion=reduce, 기본 colorScheme/light 및 앱 reduceMotion=true를 설정합니다. 기본 UI locale은 en이고 KO는 명시 설정입니다. command-center도 beforeEach에서 reduced motion을 명시합니다. 정상 모션과 reduced motion의 비교 검증을 뜻하지 않습니다.
- 앱 highContrast 설정과 OS/browser forced-colors 미디어는 구분했습니다. dark highContrast라는 제목만으로 forced-colors를 검증했다고 쓰면 안 됩니다.
- 모든 주요 API 응답은 controlled fictional fixtures로 인터셉트합니다. 실제 컴포넌트와 URL/API 요청·receipt 계약을 실행하는 범위이며 실제 tenant 데이터/권한/외부 서비스 운영 성공의 증거가 아닙니다.

## Spec별 선언 수와 범위

`등록/프로젝트`는 동일 spec이 각 프로젝트에 등록하는 수입니다. `Chromium 대상`/`mobile 대상`은 조건부 skip을 제외한 정적 예상 수입니다. 표의 파일은 모두 `e2e/<name>.spec.ts`입니다.

| Spec                                | 등록/프로젝트 | Chromium 대상 | mobile 대상 | 전개 근거                                                                                             |
| ----------------------------------- | ------------: | ------------: | ----------: | ----------------------------------------------------------------------------------------------------- |
| work-access-review-responsive       |             5 |             5 |           5 | 2 widths + 2 widths + 1 text enlargement                                                              |
| work-activity-return-focus          |            11 |            11 |          11 | 3 native widths + 3 personal widths + 5 owner/focus contracts                                         |
| work-command-center                 |             2 |             2 |           2 | 2 standalone tests                                                                                    |
| work-direct-action-owner-transition |             3 |             3 |           0 | user / tenant / access transitions                                                                    |
| work-hub-foundation                 |            28 |            28 |          19 | 21 standalone + 7 layout variants                                                                     |
| work-mobile-accessibility-audit     |            13 |            13 |          12 | 4 width×locale navigation + 2 touch + 2 text/receipt + 5 standalone                                   |
| work-personal-design-actions        |            11 |            11 |          11 | 1 conflict + 4 detail widths + 1 CRUD + 2 keyboard widths + 1 read-only + 2 appearance                |
| work-route-access                   |            12 |            12 |          12 | 3 viewports × empty / allow / deny / provider                                                         |
| work-selected-assist-contract       |            13 |            11 |          12 | 2 source types + 1 forged binding + 4 resource revokes + 3 server codes + 1 actor + 2 mobile-specific |
| work-source-decisions               |             9 |             9 |           9 | 2 handoffs + 2 decisions + 3 denial/drift + 2 forged 2xx receipts                                     |
| work-source-design-evidence         |             1 |             1 |           1 | 1 test with 2 widths × 3 source screens inside its body                                               |
| work-stitch-design-sync             |            10 |            10 |          10 | 5 viewport suites + 3 standalone + 2 appearances                                                      |
| work-task-edit-conflict             |             5 |             5 |           5 | 5 conflict variants                                                                                   |

정적 합계: 프로젝트당 123 등록, 두 프로젝트 246 등록. Chromium 대상 121, mobile 대상 109, 조건부 skip 예상 16. 이 값은 실행 성공 수가 아닙니다.

- **work-access-review-responsive** — viewport: 390×844, 320×844 → height 440; 1440×1000, 1280×1000. KO mobile + EN desktop; desktop dark + application highContrast; 390px root font-size 200%; evidence Enter toggle, focused rationale retained after height contraction; no native keyboard or forced-colors setting in this spec.
- **work-activity-return-focus** — viewport: 1280×900, 390×844, 320×568. EN/light defaults; browser Back restores exact Activity trigger and URL after fresh reads. 20KB+ owner scope, permission revoke, user switch, source version drift, and changed selection consume stale return intents.
- **work-command-center** — viewport: Project defaults. EN/light/reduced motion. Atomic multi-item review/confirmed receipts and 409 conflict clears stale selection. Axe main scan only in successful batch case.
- **work-direct-action-owner-transition** — viewport: Chromium project default. EN/light. Hold aggregate revalidation, change user/tenant/UPDATE permission, assert zero direct/batch/foreign mutation attempts and no success. Mobile intentionally skips all 3.
- **work-hub-foundation** — viewport: 1440×900; 1280×800; 390×844; 320×568 → height 360; remaining project defaults. EN/light defaults; 1280 dark and 320 dark; 320 mixed long KO/EN title; 1280 forced-colors; 1280 CSS zoom 2. Keyboard Tab→focus-visible→Enter. Partial/all-source/background outages, view-only controls, forced disabled clicks, source-return revalidation, lost responses, UUID/CAS batch receipts, menu remount/reload and create+plan replay. Axe main in 7 layout variants.
- **work-mobile-accessibility-audit** — viewport: 390×844, 320×844; 1280×900 desktop density; combined zoom case 1280×900 Chromium / 390×900 mobile. KO/EN six-route navigation, 44px touch and desktop 38px density; root font-size 200% at 390/320; forced-colors with CSS zoom 2 on Chromium / root text 200% on mobile. Enter/Escape/Space, More/plan/dialog focus restore, focus-visible and header/nav occlusion bounds. Partial-source and lost-response receipt UI. visualViewport.height override simulates keyboard (not native OS keyboard).
- **work-personal-design-actions** — viewport: 1440×1000, 1280×1000; 390×844, 320×844 → height 440; 1280×1000 CSS zoom. KO design/appearance and EN default functional cases. 390 dark + app highContrast + forced-colors; CSS zoom 2 at 1280. Checklist concurrency requires explicit review before write; checklist/source-link edits and confirmed delete use intercepted production API paths; read-only disables edits. Keyboard-height simulation preserves composer input.
- **work-route-access** — viewport: 1280×900, 390×844, 320×568. EN/light defaults. APP.WORK VIEW allow opens queue; empty/deny goes 403 and provider goes provider route, with zero Work source reads for blocked cases and no overflow.
- **work-selected-assist-contract** — viewport: Project defaults; mobile-only 320×844. KO/light. Typed selected-work binding, existing conversation continuation, no foreign mutation/new launch. Wrong version rejects response; APP.ASK/SERVICES/APPROVALS/WORK revoke and actor transition discard late answers; FORBIDDEN/NOT_FOUND/STALE clear/refetch state. Mobile 320 return-focus via DWAI and root font-size 200% panel operability/focus restore.
- **work-source-decisions** — viewport: Project defaults. EN/light. Approval and Service perform source-owned document handoff without foreign commands. Access APPROVE/REVOKE decision/version/remediation/result focus; governed deny, newer version, lost authority before submit; malformed 2xx rationale and skipped version retain error/preview and publish no success.
- **work-source-design-evidence** — viewport: 1440×1000, 390×844. KO/light document evidence for 02 Approval, 03 Access, 04 Service and M1 preview/receipt. No Approval/Service commands from Work. Screenshots are evidence captures, not independent tests or visual golden assertions.
- **work-stitch-design-sync** — viewport: 1440×1000, 1280×900, 390×844, 320×740, 720×500/DPR2; separate 1280×800 CSS zoom. KO; six canonical Work routes, independent day plan, Calendar dialog, source status, inline AI and Flow canonical contributions; default light plus 390 dark and 390 app highContrast/forced-colors. 720px/DPR2 is reflow proxy; CSS zoom 2 separate. Enter/Escape More focus restore; Axe WCAG2A/AA subset on main+bottom-nav in appearance cases. Calendar test opens dialog and asserts zero event POST; does not complete Calendar lifecycle.
- **work-task-edit-conflict** — viewport: 1440×1000, 1280×900, 390×844, 320×740, 1280×1000 CSS zoom. EN desktop, KO mobile/zoom; 390 dark + application highContrast only (no forced-colors emulateMedia here). CSS zoom 2 at 1280. Fresh edit conflict preserves draft, latest-server review/explicit replacement or use-latest, PageDown and focused title; long Korean server title; Axe dialog at 320 only.

## 200%와 모바일 키보드의 정확한 의미

| 방식                  | 실제 설정 / 해당 spec                                                                                                                                                | 해석                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| CSS page zoom         | `document.documentElement.style.zoom = "2"`: foundation, personal-design-actions, stitch-design-sync, task-edit-conflict; mobile-accessibility-audit의 Chromium 분기 | CSS 레이아웃/포커스/오버플로 reflow 검증. 브라우저 메뉴나 단축키의 실제 browser zoom은 아님.                               |
| 텍스트 확대           | root `fontSize = "200%"`: access-review-responsive, selected-assist-contract, mobile-accessibility-audit(390/320 및 mobile forced-colors 분기)                       | 루트 글자 크기 확대 시 읽기·터치·포커스 유지. 모든 픽셀 치수가 정확히 2배가 된다는 보장은 아님.                            |
| reflow boundary proxy | stitch-design-sync의 `720×500`, `deviceScaleFactor: 2`                                                                                                               | 1440 물리 픽셀/200%에 대응하는 CSS 폭을 가정한 reflow와 raster scale 검증. DPR2는 browser zoom 200%를 설정하는 API가 아님. |
| 키보드 환경 대체      | viewport 높이 844→440 또는 568→360, 또는 `visualViewport.height = window.innerHeight - 320` override/resize event                                                    | 화면 가림/scroll/focus/초안 보존의 대체 검증. 실제 모바일 OS 가상 키보드 열림/닫힘이나 브라우저 UI zoom 자동화 아님.       |

이 13개 spec에는 실제 브라우저 UI zoom 설정/조회 검증이 없습니다. 최종 문구는 “200% CSS zoom·텍스트 확대 및 해당 reflow 경계 검증”으로 한정하는 것이 정확합니다.

## 의도된 project skip (정적 예상 16)

| 파일/라인                         | skip되는 프로젝트/수 | 소스상 이유와 담당 실행                                                             |
| --------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| direct-action-owner-transition:18 | mobile 3             | user/tenant/access owner-transition 계약은 Chromium에서 한 번씩 실행.               |
| hub-foundation:383                | mobile 1             | batch receipt의 모든 Work view/reload/source-panel history는 desktop Chromium 담당. |
| hub-foundation:554                | mobile 1             | route-backed composer browser-back URL history는 desktop 담당.                      |
| hub-foundation:578,622            | mobile 2             | create receipt 및 create+today-plan route-remount 중복 POST 방지는 desktop 담당.    |
| hub-foundation:684                | mobile 1             | view 변경 시 batch selection 초기화 navigation 계약은 desktop 담당.                 |
| hub-foundation:724                | mobile 1             | legacy entry convergence/IA 계약은 desktop Chromium 담당.                           |
| hub-foundation:754                | mobile 1             | 390px source handoff와 filtered-list focus return은 좁힌 Chromium에서 한 번 실행.   |
| hub-foundation:818                | mobile 1             | 390px today-plan navigation은 좁힌 Chromium에서 한 번 실행.                         |
| hub-foundation:836                | mobile 1             | 320px input viewport contraction은 좁힌 Chromium에서 한 번 실행.                    |
| mobile-accessibility-audit:210    | mobile 1             | desktop 38px density 계약은 Chromium 담당.                                          |
| selected-assist-contract:146      | mobile 1             | wrong-version response fail-closed 계약은 Chromium에서 한 번 실행.                  |
| selected-assist-contract:373,409  | chromium 2           | 320px DWAI return-focus 및 텍스트 확대는 mobile project 담당.                       |

조건부 skip은 미완료 기능 표시가 아니라 project 중복 제거/담당 배분입니다. 그러나 Chromium에서 좁힌 viewport만 실행한 계약을 mobile WebKit에서도 통과했다고 표현하면 안 됩니다.

## 접근성 및 완료 표현의 경계

- 실제 키보드 이벤트(Enter/Escape/Space/Tab/PageDown)와 focus-visible, trigger 복원, aria-current, 44×44 target, header/bottom-navigation 가림 및 horizontal-overflow assertion을 포함합니다. 일부 여정은 .focus()나 pointer click을 함께 사용하므로 전체 18개 여정이 처음부터 끝까지 keyboard-only였다고 표현하지 않습니다.
- 자동 Axe gate는 command-center의 성공 batch main, foundation의 7 layout main, stitch의 dark/high-contrast main+bottom-nav(WCAG2A/AA 태그), task-edit-conflict의 320px dialog에 한정됩니다. gate는 serious/critical 위반 없음만 확인하며 모든 severity 0, screen-reader 수동 검증 또는 전면 WCAG 인증을 뜻하지 않습니다.
- `pixelPerfect=false`: 원본 Stitch 18개 frame 여정의 구현/반응형 스크린샷 증거입니다. 지정 13 specs에 원본 Stitch와 pixel-diff/golden 비교 gate가 없으며 screenshot capture 수를 test case 수로 세면 안 됩니다.
- `liveTenant=false`, `fixtures="controlled fictional"`: 라이브 tenant release, 실제 Approval/Service/Calendar/Activity/DWAI backend 통합 결과와 권한/운영 환경 수용은 별도 근거가 필요합니다. Work 소유 핸드오프/receipt 실패 안전성의 E2E 성공으로 외부 앱 소유 기능 완료를 대신 입증할 수 없습니다.
- Calendar 화면 디자인 테스트는 생성 dialog/입력과 enabled control 및 zero POST까지 검증합니다. Calendar create/unlink lifecycle·CAS·실제 저장은 별도 단위/계약/Calendar 소유 E2E 근거를 인용해야 합니다.

## 읽은 소스 SHA-256

감사 시점 파일 내용 확인용이며 실행 gate freeze hash를 대신하지 않습니다.

```json
{
  "kind": "READ_ONLY_SOURCE_AUDIT",
  "liveTenant": false,
  "pixelPerfect": false,
  "actualBrowserZoomVerified": false,
  "countsAreExecutionResults": false,
  "sourceSha256": {
    "e2e/work-access-review-responsive.spec.ts": "c68f3e1a354b378df4cfce93a255ca55cbe8afa41106df60cb836f4435f454d3",
    "e2e/work-activity-return-focus.spec.ts": "0ac2ed15890a0d77fcafb547644af9a081a6334f53fd492ec387db66d132d3e7",
    "e2e/work-command-center.spec.ts": "ac9ba376434494ee2bad89b059e22dfa6b2c6618051bfa6ede4b62b63f2467e2",
    "e2e/work-direct-action-owner-transition.spec.ts": "89b45335e57bc7be1ee8cf931e2ed6a620573ef56326a78a662e13617efe49cd",
    "e2e/work-hub-foundation.spec.ts": "4328522f4ca53768b9c458daecbae133a93064a3b785c72f4b3a443d12f380a7",
    "e2e/work-mobile-accessibility-audit.spec.ts": "0d2d3298ae905d650e82f5e8505e2fd696892915868eda3ec960ee1a59656122",
    "e2e/work-personal-design-actions.spec.ts": "a950c06bd97f0d3d5b80cd4bc618a72f2c7c6975d8a01d55c0e7a5e45569532a",
    "e2e/work-route-access.spec.ts": "4f409b0d2238c20d3c6b3f9a9405fc62629d26c1cd0a02742b80891f84738736",
    "e2e/work-selected-assist-contract.spec.ts": "7dc1cb1ad4b6351d035c65a84d5008498b8982a4e80dcc1637e2da2bc3180da0",
    "e2e/work-source-decisions.spec.ts": "9bc315a7fa7975c09bcfc8ff14b112785af287affb89e62dde7dd164bae7df22",
    "e2e/work-source-design-evidence.spec.ts": "44193757594b508e7d4a117799303e80af556b87075de8a646925815fe0723f1",
    "e2e/work-stitch-design-sync.spec.ts": "ebe2fb0ce3b3973b88d8dc3a795a73077d5bf43d945130229d2a3e284ff6d409",
    "e2e/work-task-edit-conflict.spec.ts": "c5bdf533315d2db190909ccfbebfd2779a08393eb82f9988113af4173dc72e80",
    "playwright.config.ts": "d96af79022518b207f0825d98eaa7038c52cfbe474dafff27ac5bc42d9f6ca76",
    "e2e/support/work-hub-foundation-fixtures.ts": "6cac32281d8c2cb7d883bb5cc064bab767d1c78e2b003d1e9527ecd648c6c5a6"
  }
}
```

Final gate 전 Personal Work → source=PERSONAL_TASK Activity → back focus 1280/390/320 3 cases/project가 추가되었다. 아래 최초 정적 감사 SHA는 그 추가 이전이며, 최종 source snapshot과 실행 JSON이 최종 권위 근거다.

## 최종 v5 보완

기존 Access source evidence 및 Work AI 11여정에 실제 viewport에서 global launcher와 action 영역을 같은 세로 위치로 옮겨 간격과 활성 clearance를 검증하는 assertion을 추가했다. 테스트 등록 수는 그대로 246이다. 원래 소스 줄 번호·SHA 표는 감사 당시 이력이며 최종 소스 맵과 Playwright JSON이 최종 판정 근거다.
