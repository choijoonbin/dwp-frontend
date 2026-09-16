# Stitch 통합업무앱 수용 및 검증 기록

대상 Stitch 프로젝트는 `13391261371843159731`이다. 이 문서는 전달받은 고정 ZIP을 정본으로
삼아 Work가 소유하는 디자인, 사용자 흐름, 데이터 계약과 메뉴를 대조한 결과를 기록한다.

## 판정의 범위

- 고정 ZIP의 Work 프레임 18개는 **18/18 수동 기능·디자인 계약 수용**으로 매핑했다.
- Work 영구 메뉴 6개와 고유 경로는 **6/6 수용**으로 매핑했다.
- 이 문서의 `18/18`은 각 프레임의 정보 계층, 사용자 흐름, 반응형 동작, 데이터 변경 계약과
  예외 처리를 제품 구현에 연결해 검토했다는 뜻이다.
- `18/18`은 원본 이미지와의 자동 픽셀 동일성, 디자이너 최종 승인, 실제 tenant 수용 또는 운영
  배포 승인을 뜻하지 않는다.
- 자동 검증 수치는 최종 코드 tree에서 다시 실행한 결과만 기록한다.

## 검증 원본

- Stitch 프로젝트: `https://stitch.withgoogle.com/projects/13391261371843159731`
- 고정 ZIP(워크스페이스 루트 기준):
  `output/stitch-enterprise-grid-calendar-2026-09-16/latest-970a1f72/stitch_enterprise_grid_calendar_application.zip`
- 크기: `5,334,188` bytes
- SHA-256: `970a1f72bfb04783a611c67d9d08eaf6b6a51befc86bd947bbea56647055e570`
- ZIP 엔트리: 57개
- 화면 폴더: 18개이며 각 폴더에 `code.html`과 `screen.png`가 있다.
- 추가 Calendar 명세: `precision_calendar_system/DESIGN.md`
- 기계 판독 인벤토리:
  `output/stitch-enterprise-grid-calendar-2026-09-16/latest-970a1f72/inventory.json`
- 디자인 접촉면:
  `output/stitch-enterprise-grid-calendar-2026-09-16/latest-970a1f72/design-current-contact-sheet.png`

ZIP의 HTML과 script는 제품 구현 지시로 실행하지 않고 정적 디자인과 상호작용 참고물로만
대조했다. 로그인 뒤 live Stitch 프로젝트의 이후 변경 내용은 이 고정본의 검증 범위에 포함하지
않는다.

Calendar를 직접 그린 전달 PNG는 C01 한 장뿐이다. `precision_calendar_system/DESIGN.md`는
Calendar 동작과 레이아웃 계약을 보충하지만 전체 Calendar grid의 직접 참조 PNG는 아니다.
따라서 ZIP에 없는 Calendar grid 전체에 대해 원본 픽셀 동일성을 주장하지 않는다.

## Work 영구 메뉴

18개 프레임은 상세 화면, dialog, Home 기여, assistant panel과 반응형 변형을 포함한다. 제품의
영구 Work 메뉴는 아래 6개이며 각 상태를 고유 URL로 유지한다.

| 메뉴         | 경로                      | 수동 계약 판정 |
| ------------ | ------------------------- | -------------- |
| 통합업무함   | `/work/queue`             | 수용           |
| 내 조치 대기 | `/work/action-required`   | 수용           |
| 오늘 계획    | `/work/day-plan`          | 수용           |
| 진행 중      | `/work/in-progress`       | 수용           |
| 응답 대기    | `/work/awaiting-response` | 수용           |
| 완료된 업무  | `/work/completed`         | 수용           |

모바일에서는 최신 M2가 제시한 제품 공통 5탭 하단 내비게이션을 기준으로 사용한다. Work의 6개
상태는 drawer와 고유 URL에서 계속 접근할 수 있고 선택 상태와 복귀 위치를 유지한다. 이는 Q01의
Work 화면 맥락과 M2의 제품 전체 내비게이션을 함께 수용하기 위한 명시적 일관성 결정이다.

## 18개 프레임 수동 수용 매핑

| 프레임             | 수량 | 제품 위치                | 수동 계약 수용 내용                                                                                                    |
| ------------------ | ---: | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Q01 desktop/mobile |    2 | 통합업무함               | 집계, 검색·필터, source 상태, 목록/상세, 선택·복귀, 모바일 카드와 reflow를 매핑했다.                                   |
| D01 desktop/mobile |    2 | Approval 상세            | 문서·기안 정보, 워크플로, 위험·금액, 원천 이력, 원본 앱 handoff와 상세 우선 계층을 매핑했다.                           |
| D02 desktop/mobile |    2 | Access Review 상세       | HRIS 식별 정보, 조직·기한·사유, 승인·회수 결정, version/409, exact receipt와 권한 회수를 매핑했다.                     |
| D03 desktop/mobile |    2 | Service 보완 상세        | 요청 근거, 보완 양식, 검토 전 mutation 금지, 명시적 제출, AI 초안 적용, stale/409 및 receipt 복구를 매핑했다.          |
| D04 desktop/mobile |    2 | 개인 할 일 상세          | 상태, 우선순위·기한, 설명, 원문, 체크리스트, 활동, 편집·삭제·완료·보관·일정 연결을 매핑했다.                           |
| F01 desktop        |    1 | 개인 할 일 생성          | Messenger의 개인 할 일 추적, identity-only 전달, source preflight, 연결·해제·원문 복귀를 매핑했다.                     |
| P01 desktop        |    1 | 오늘 계획                | 4개 지표, 순서 있는 실행 lane, 후보 rail, 저장 상태와 독립 계획 동작을 매핑했다.                                       |
| C01 desktop        |    1 | Work→Calendar            | 비공개 FOCUS 일정, 편집 가능한 30분 기본값, exact event receipt, 별도 link PUT, 부분 성공 뒤 PUT-only 복구를 매핑했다. |
| R01 desktop        |    1 | 원천 상태·일괄 처리      | source 가용성, durable batch receipt, 성공·충돌·권한·미확정 집계, 미확정 건만 같은 키로 재확인하는 흐름을 매핑했다.    |
| H01 desktop        |    1 | Flow Home 기여           | 개인 업무·보완 의무·오늘 계획 기여 카드와 canonical Work 복귀를 매핑했다.                                              |
| A01 desktop        |    1 | DWAI·ON contextual panel | 선택 업무 identity, 추천 질문, 검증 답변·근거·복사·대화 전환, D03 양식으로의 명시적 초안 적용을 매핑했다.              |
| M1 mobile          |    1 | Access Review 모바일     | 4단계 의사결정, 증거 확인, 입력 보존, 키보드·확대 대응을 매핑했다.                                                     |
| M2 mobile          |    1 | Queue 빈 상태·빠른 생성  | 320/390 빈 상태, 빠른 생성, 오늘 계획, 정확한 일정 연결과 제품 공통 5탭 모바일 내비게이션을 매핑했다.                  |

각 행은 고정 ZIP의 18개 프레임을 정확히 한 번씩 포함한다. 이 표는 수동 계약 대조 기록이며 자동
픽셀 비교 결과표가 아니다.

## 데이터·권한 계약

- Messenger 전달은 메시지 본문 대신 conversation/message identity를 보관한다. 사용자·tenant
  소유권, TTL과 source preflight가 맞아야 생성 dialog를 연다.
- Access Review와 Service 응답은 authoritative version, 409 재검토, exact permission,
  idempotency key와 서버 receipt를 사용한다.
- Calendar는 POST 성공 뒤 Work link PUT을 분리한다. 검증된 event receipt가 있으면 새 일정을
  만들지 않고 같은 link만 재시도한다.
- Calendar 복구 상태는 사용자·tenant·role·group·resource-role·권한·TTL 변경과 변조를
  재검증하며 조건이 맞지 않으면 폐기한다.
- R01은 부분 장애와 미확정 결과를 보존하고 확인되지 않은 receipt만 같은 멱등 키로 재시도한다.
- 내부 Messaging source API는 service token, purpose token, `APP.MESSAGING:VIEW`,
  `APP.WORK:VIEW` 경계를 함께 요구한다.

## 자동 검증 방식과 한계

Frontend 브라우저 검증은 통제된 fixture와 API interception을 사용해 정보 계층, 사용자 동작,
요청 payload, receipt, 오류·복구 분기를 재현한다. 이는 실제 tenant와 배포된 backend를 통과하는
운영 end-to-end 인증이 아니다. Backend의 선택된 단위·통합·계약 검사는 별도로 실행한다.

회귀 screenshot이나 제품 baseline을 사용하는 검사도 구현 내부의 시각 퇴행을 찾기 위한
것이다. 전달 PNG와 구현 화면 사이의 자동 pixel diff, 디자이너 signoff, 실제 tenant 수용,
운영 배포 및 release 승인은 이번 기록에서 실시하지 않았다.

DWAI·ON의 U02/U04/U05 선택 화면은 2026-09-16에 새로 실행한 Playwright 검증에서 **13/13
통과**했다. 여기에는 새 대화·내 대화의 다중 viewport/reflow와 forced-colors 검사, AI 제안함의
desktop/mobile 계층과 review 진입 검사가 포함된다. 결과와 screenshot은 워크스페이스 루트 기준
`output/dwaion-final-verification-2026-09-16/`에 있다. 이 13개 검사는 Work 18프레임의 자동
픽셀 인증으로 합산하지 않는다.

## 최종 후보 자동 실행 결과

이전 임시 실행의 테스트 수나 불완전한 closeout bundle은 최종 근거로 인용하지 않는다.

| 검증                                            | 결과              |
| ----------------------------------------------- | ----------------- |
| 고정 ZIP 18프레임 수동 기능·디자인 계약 매핑    | 18/18 수용        |
| Work 영구 메뉴와 고유 URL                       | 6/6 수용          |
| DWAI·ON U02/U04/U05 선택 Playwright             | 13/13 통과        |
| Work 핵심 Playwright 7개 spec                   | 46/46 통과        |
| Calendar handoff mobile 회귀                    | 11/11 통과        |
| Q01/P01 시각 계층 회귀                          | 6/6 통과          |
| D01/D02/D03/D04/F01/M1/M2 보충 회귀             | 10/10 통과        |
| Frontend 집중 Vitest                            | 29 files/348 통과 |
| TypeScript                                      | 통과              |
| Frontend feature boundary·cycle·i18n·OpenAPI    | 통과              |
| 대상 ESLint·Prettier·diff check                 | 통과              |
| Backend Messaging·Platform·Calendar·Auth·People | 71/71 통과        |
| Backend Python 계약 검사                        | 86/86 통과        |
| Backend service boundary·JSON·diff check        | 통과              |

## 재현 명령

모든 명령은 저장소 상대 경로만 사용한다. Frontend 명령은 `dwp-frontend/`에서 실행한다.

```bash
corepack yarn playwright test \
  e2e/calendar-work-handoff.spec.ts \
  e2e/work-access-review-responsive.spec.ts \
  e2e/work-m2-mobile-quick-capture.spec.ts \
  e2e/work-messenger-capture.spec.ts \
  e2e/work-service-information-response.spec.ts \
  e2e/work-source-batch-r01.spec.ts \
  e2e/work-stitch-design-sync.spec.ts \
  --project=chromium --workers=1

corepack yarn playwright test e2e/calendar-work-handoff.spec.ts \
  --project=mobile --workers=1

corepack yarn playwright test e2e/work-q01-p01-visual-parity.spec.ts \
  --project=chromium --workers=1

corepack yarn playwright test \
  e2e/work-detail-stitch-frames.spec.ts \
  e2e/work-stitch-missing-frame-evidence.spec.ts \
  --project=chromium --workers=1

corepack yarn vitest run
corepack yarn typecheck
node scripts/check-feature-boundaries.mjs
node scripts/check-relative-import-cycles.mjs
corepack yarn i18n:check
corepack yarn openapi:check
git diff --name-only --diff-filter=ACMR HEAD^ HEAD -- '*.ts' '*.tsx' '*.mjs' | \
  xargs corepack yarn eslint
git diff --name-only --diff-filter=ACMR HEAD^ HEAD \
  -- '*.ts' '*.tsx' '*.mjs' '*.json' '*.md' | \
  xargs corepack yarn prettier --check
git diff --check
```

DWAI·ON 선택 검증의 재현 명령도 `dwp-frontend/`에서 실행한다.

```bash
corepack yarn playwright test \
  e2e/dwaion-conversation-design.spec.ts \
  e2e/dwaion-proposal-selection.spec.ts \
  --project=chromium --workers=1 \
  --grep 'visual reflow|forced colors keeps studio|Stitch U05 hierarchy|Stitch U05 Korean desktop|Stitch U05 Korean mobile|Stitch U05 and U06 mobile composition' \
  --output=../output/dwaion-final-verification-2026-09-16
```

Backend 명령은 `dwp-backend/`에서 실행한다.

```bash
./gradlew :dwp-messaging-server:test \
  --tests 'com.dwp.services.messaging.api.MessagingControllerTest' \
  --tests 'com.dwp.services.messaging.domain.MessagingServiceTest' \
  --tests 'com.dwp.services.messaging.collaboration.CollaborationSecurityFilterTest' \
  --tests 'com.dwp.services.messaging.security.MessagingWorkSourceSecurityFilterTest'

./gradlew :dwp-platform-server:test \
  --tests 'com.dwp.services.platform.workhub.personal.MessagingMessageSourceResolverTest' \
  --tests 'com.dwp.services.platform.workhub.personal.PersonalWorkServiceTest' \
  --tests 'com.dwp.services.platform.calendar.CalendarEventTitleContractTest' \
  --tests 'com.dwp.services.platform.calendar.CalendarMigrationPathPostgresIntegrationTest'

./gradlew :dwp-auth-server:test \
  --tests 'com.dwp.services.auth.controller.AccessReviewWorkControllerTest' \
  --tests 'com.dwp.services.auth.service.AccessReviewWorkServiceTest' \
  --tests 'com.dwp.services.auth.identity.WorkforceIdentitySyncServiceTest' \
  --tests 'com.dwp.services.auth.identity.WorkforceIdentityWorkerNumberMigrationPostgresTest'

./gradlew :dwp-people-server:test \
  --tests 'com.dwp.services.people.integration.HrisIdentityProjectionContractTest'

python3 -m unittest \
  scripts.tests.test_devctl \
  scripts.tests.test_service_boundaries \
  scripts.tests.test_export_openapi_contracts
python3 scripts/check-service-boundaries.py
git diff --check
```

## 증거 보존 원칙

- 고정 디자인 원본과 인벤토리는
  `output/stitch-enterprise-grid-calendar-2026-09-16/latest-970a1f72/`에 보존한다.
- DWAI·ON의 새 실행 결과는 `output/dwaion-final-verification-2026-09-16/`에 보존한다.
- Work 최종 자동 실행 결과는 워크스페이스 루트 기준
  `output/stitch-frontend-final-validation-2026-09-16-dbf576ff/`와
  `output/stitch-work-supplemental-final-2026-09-16/`에 보존한다.
- 최종 실행 시각보다 오래되었거나 현재 spec 수와 맞지 않는 임시 bundle은 수용 근거로 사용하지
  않는다.

이 기록은 고정 전달물에 대한 구현 수용과 재현 가능한 검증 범위를 설명한다. 실제 tenant,
운영 보안·복구 훈련, 배포 승인과 release signoff는 별도 운영 절차에서 검증해야 한다.
