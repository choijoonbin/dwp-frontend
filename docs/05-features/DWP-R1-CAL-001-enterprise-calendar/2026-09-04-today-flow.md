# Calendar Today Flow — 2026-09-04

## 설계와 실제 기능

사용자가 전달한 Stitch 캡처의 화면 위계(헤더 → 전체 폭 다음 일정 → 타임라인/주간 리듬 + 독립 우측 카드)를 기존 React Router/MUI/Design System 구조에 적용한다. 별도 Next.js 앱이나 시연용 대시보드를 만들지 않는다. 일정 메뉴는 전체 계획용 그리드, 홈은 현재·다음 실행·집중 구간·응답 판단용으로 구분한다.

| 시안 요소           | 실제 데이터와 동작                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| 오늘의 흐름 헤더    | 선택 지역의 날짜·시간대, 성공/갱신/오류 상태, 전체 일정·빠른 실행·새 일정                          |
| 다음/진행 중 일정   | 서버가 허용한 일정, 회의 참여 시간 창, 안전한 HTTP(S) 링크 복사, 실제 일정 상세/안건               |
| 시간순 타임라인     | 현재 시각, 시간 배지, 일정 종류·참석자, 실제 빈 시간에서 집중 일정 생성, 지난 일정 펼치기          |
| 주간 리듬           | 실제 회의/집중 분의 공통 스케일, 회의 한도 비율 별도 표기, 선택 날짜의 일정으로 이동               |
| 확인할 일·집중 목표 | 서버 attention 및 focus 지표, 실제 응답/집중 계획/회의실 탐색 연결, 목표 없음은 미설정 표시        |
| 공유 구성원 가용성  | 신규 권한 기반 snapshot API, 공유한 구성원만 표시, 선택한 구성원의 전체 가용 시간 찾기 페이지 연결 |
| 단축키              | 실제 명령 팔레트 단축키 및 일정/가용 시간 페이지 링크. 지원하지 않는 단축키를 표시하지 않음        |

홈의 우측 카드는 데스크톱에서 페이지와 함께 흐르고 작은 화면에서는 브리핑 drawer로 전환한다. 기존 일정 그리드의 제한된 rail 높이는 유지한다. 공통 셸의 페이지 여백과 토큰을 그대로 사용하며 별도 고정 최대 폭을 추가하지 않는다.

## 공유 가용성 기능/권한

`GET /api/platform/v1/calendar/team-availability/snapshot?timeZone=Asia%2FSeoul`

- Calendar VIEW와 People Directory VIEW, 검증된 TENANT identity가 모두 필요하다. Gateway exact path에만 두 권한 projection을 적용하며 인접 Calendar 경로는 유지한다.
- 서버가 현재 actor의 활성 PERSON/GROUP 공유 grant 및 identity link를 조회한다. 임의 tenant/person 목록을 입력받는 열거 API가 아니다.
- 원천은 `DWP_NATIVE_CALENDAR`, 범위는 `SHARED_WITH_ME`다. 온라인 presence, 외부 Calendar 동기화 완료, 조직 전체 상태라고 표현하지 않는다.
- 기존 scheduling 계약과 동일하게 개인 캘린더의 명시적 공유는 해당 구성원의 일정 조율용 free/busy 자격을 부여한다. busy는 구성원의 주최/거절하지 않은 참석 일정 전체에서 계산한다. 이는 다른 캘린더의 제목·내용 조회 권한을 부여하지 않는다. V92의 인물당 개인 캘린더 하나 제약뿐 아니라 `CalendarAccessSql.AUTHORIZED_FREE_BUSY_PEOPLE`과 `CalendarSql01.BUSY_SLOTS_WITH_CAL_EVENTS`의 기존 결합을 근거로 한다.
- PRIVATE/FREE_BUSY 일정의 제목·안건·참석자·종류는 노출하지 않는다. 표시 가능한 상태만 AVAILABLE/BUSY/FOCUS/OUT_OF_OFFICE로 반환한다.
- generatedAt/validUntil은 서버 생성이며 최대 30초, 공유 만료가 더 빠르면 해당 시각으로 제한한다. 자연 만료 시 이름을 포함한 기존 데이터를 폐기한 뒤 새 권한으로 다시 조회한다.
- 401/403/실패/잘못된 응답은 이전 구성원을 남기지 않는다. 자동 재시도 루프를 멈추고 명시적 재시도만 제공한다. 홈 일정과는 실패 영역을 분리한다.
- 사람별 CTA는 공개 person ID를 디렉토리 API에서 다시 확인한 후 조율 참가자로 선택한다. 일정 접근 허용은 기존 scheduling evaluator가 별도로 판정한다.
- 운영 데이터/공유 관계가 없으면 정직한 빈 상태와 공유 관리 진입점을 표시한다. 가상의 구성원·온라인 상태·일정을 운영 데이터처럼 주입하지 않는다.

## 독립 감사에서 추가 보정한 사항

1. 자연 만료 시 stale 차단 효과와 갱신 타이머가 경쟁하던 문제: 검증 실패와 시간 경과를 분리하고 clean query epoch에서 재조회한다.
2. 200 성공 응답에서 공유가 회수/축소된 경우 열려 있던 상세의 민감한 데이터가 남던 문제: 동일 일정·발생 시각을 최신 응답으로 재해석하고 없어짐/비공개/권한 부재 시 폐기한다. 편집·삭제 의도도 권한과 버전을 재확인한다.
3. 자정/주 경계와 DST에 걸친 일정 집계: 각 실제 날짜 범위로 시간을 잘라 집계하고 회의 한도 비율의 인위적인 160% 상한을 제거한다. DTO/API는 변경하지 않는다.

## 검증 범위

Calendar 전용 unit/API, 실제 PostgreSQL Calendar 테스트, Gateway 권한 projection, Chromium/mobile 실행 회귀, 라이트/다크/forced-colors screenshot, Axe, 320px와 200% 확대, 복사/참여/안건, 공유 만료/권한 회수와 상세 폐기를 검증한다. 최신 수치와 외부 제품 Gate 차단은 최종 인계에 별도 기록한다.

OpenAPI는 승인된 Platform exporter와 frontend sync로 생성한다. 동시 Mail 주소록 소유자가 승인한 7개 path 추가도 생성물에 포함되며 기존 path 의미는 변경하지 않는다. 마이그레이션·권한 정본·공용 디자인 시스템은 이번 작업에서 편집하지 않는다.

### 최종 검증 결과

- Calendar frontend unit/API: 14 files, **109 passed**.
- Calendar 기능 E2E(enterprise/home-enterprise/home-flow): **59 passed**, 기기별 비대상 5 skipped.
- 시각/접근성 회귀: baseline 갱신 없이 최종 **35 passed**, 기기별 비대상 3 skipped. 다섯 화면을 한 테스트 시간 제한 안에서 검사하던 forced-colors 검사는 화면별 독립 테스트로 분리했다.
- 디자인 전문가 전용 1440/1280/390/320px, dark/forced-colors/200% reflow: **9 passed**.
- Calendar backend: **17 suites / 117 tests**, PostgreSQL 포함, 실패/오류/skip 0.
- Gateway: 기존 verifier 39 + Calendar snapshot 전용 1 = **40 passed**, 기존 타제품 테스트 원문 유지.
- Backend `checkSourceSize`, `checkTestSourceSize`: PASS, 기준 상향 없음. CalendarService 839줄 유지.
- Calendar scoped ESLint, i18n, diff-check, 공식 OpenAPI export/sync 검사: PASS. Vite production build: PASS.
- 전체 frontend 정적 Gate는 동시 타제품 수정 시점에 따라 Messaging 타입/디자인, Notifications source-size, Home의 stale export/하향 ratchet에서 차단됐다. Calendar 자체 회귀와 구분하며 전역 release PASS로 주장하지 않는다.
- 마지막 전역 번들 검사에서 initial raw 1165.5/1074.2 KiB, gzip 331.0/317.4 KiB 초과가 남았다. Vite 빌드 성공과 전역 번들 예산 통과는 별개이며 예산을 올리지 않았다. 병렬 DWAI/Activity 변경의 정적 회귀도 별도 소유 범위다.
- 최종 로컬 runtime: Platform listener 20669(8002), Gateway listener 79711(8080), health UP. 집계 보정 후 Platform만 다시 기동했고 다른 서비스는 중단하지 않았다. 공식 runtime OpenAPI 재검사 PASS. 검증용 Vite 4330은 회수 후 종료했다.
- 독립 교차 감사: 확인된 Calendar 내부 미해결 P0/P1 0. 공용 DWAI·ON launcher가 일부 viewport에서 카드 우측 일부와 겹치는 비차단 P2는 공유 소유 작업에 전달했다. 실제 버튼 접근·스크롤·키보드 회귀는 통과한다.

### 이번 변경의 소유 파일

Frontend (`apps/dwp/src/features/calendar/`): `calendar-home.tsx`, `calendar-home-header.tsx`, `calendar-home-hero.tsx`, `calendar-home-event-row.tsx`, `calendar-home-rhythm.tsx`, `calendar-home-surfaces.ts`, `calendar-home-selection.ts`, `calendar-home-selection.test.ts`, `calendar-home-shortcuts.tsx`, `calendar-home-team-panel.tsx`, `calendar-home-team-panel.test.tsx`, `calendar-workspace-rail.tsx`, `calendar-workspace-rail.test.tsx`, `calendar-workspace-overlays.tsx`, `calendar-today-workspace.tsx`, `calendar-today-model.ts`, `calendar-today-model.test.ts`, `calendar-availability.tsx`, `calendar-components.tsx`(교체된 미사용 AgendaItem 제거).

Client/locale: `libs/shared-utils/src/api/calendar-team-api.ts`, `calendar-team-api.test.ts`, `calendar-api.ts`(re-export), `libs/shared-i18n/src/locales/{en,ko}/calendar.json`.

E2E: `e2e/calendar-home-flow.spec.ts`와 light snapshots, `e2e/calendar-home-rail-design.spec.ts`, `e2e/calendar-enterprise.spec.ts`(공통 목적의 버튼이 두 곳에 존재하므로 header trigger로 한정), `e2e/calendar-visual-quality.spec.ts` 및 의도적으로 변경된 home snapshots. 기존 중단 시점의 다른 Calendar 변경은 보존했다.

Backend Calendar: `CalendarTeamAvailabilityAccess.java`, `CalendarTeamAvailabilityController.java`, `CalendarTeamAvailabilityDtos.java`, `CalendarTeamAvailabilityRepository.java`, `CalendarTeamAvailabilityService.java`, `CalendarTeamAvailabilityControllerTest.java`, `CalendarTeamAvailabilityPostgresIntegrationTest.java`, `CalendarTeamAvailabilityServiceTest.java`, `CalendarService.java`, `CalendarOccurrenceProjector.java`, `CalendarHomeTimeAccounting.java`, `CalendarHomeTimeAccountingTest.java`.

Gateway: `security/AuthSessionVerifier.java`, 전용 `CalendarTeamSnapshotAuthSessionVerifierTest.java`. 기존 `AuthSessionVerifierTest.java`의 최종 diff는 0이다.

승인된 생성물: backend `contracts/openapi/{platform,gateway-public}.json`, frontend `libs/api-contracts/openapi/gateway-public.json`, `libs/api-contracts/src/gateway-public.ts`.
