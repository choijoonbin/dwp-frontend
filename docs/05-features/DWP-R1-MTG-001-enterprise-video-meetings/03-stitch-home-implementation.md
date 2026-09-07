# U01 · Approved Stitch home implementation

Date: 2026-09-04. Scope: `/meetings/home`; other U02–U15 designs are pending.

## Design and outcome

User: meeting participant, host or independently appointed reviewer. Question: which meeting
should I join or prepare, and which recent outcome needs my attention? Primary action: prepare
or join the current/next meeting. Archetype: command center, structured density.

User-supplied reference: https://stitch.withgoogle.com/projects/13391261371843159731
Frames: `DWP Meetings: Today & Next Action (화상회의 홈 1440px) - Polished` and
`DWP Meetings: Mobile Home (화상회의 모바일 390px) - Polished`.

Compact freshness/action bar → light full-width focus surface → timeline with a secondary
recent-review queue → published outcomes. Preserve the DWP shell, workspace gutters, theme,
SectionHeader, ActionButton, FormField and FormDialog. Mobile changes reading order and
uses a code-entry dialog. Do not copy example identities, tasks or readiness claims.

## Data and authority

- Existing home API supplies current/next/today summaries and service capability.
- Server time/timezone and last successful refresh are explicit. Polling is not streaming LIVE.
- Plain agenda text is not a tracked checklist; participant count is not an RSVP count.
- Opening home never acquires devices, publishes media or starts recording.
- Latest-visible reports provide a bounded recent-meeting review queue, only when the server
  grants current-viewer review authority. Latest-published provides recap previews to authorized
  meeting participants; publication is not anonymous/public access.
- Failed authorization/revalidation hides sensitive cached results. Optional result failures are
  section-local; failed home revalidation hides the home snapshot and disables commands.
- Home-normalized recording flags and scheduled end times are not actual artifact/attendance evidence.
- No new storage, database, Agent execution or public API/permission contract in this change.

## Deferred dependencies

Task acceptance/assignment, templates, personal rooms, structured agenda progress and invitation
responses require U02–U15 contracts. No dead navigation, fake tasks, unsupported security levels,
E2EE guarantees, device-ready badges or automatic transcript claims are added.

## Acceptance and rollback

Verify start/schedule/code/prepare/history; active/next/empty/blocked/revalidation and section
failure; published vs private drafts; keyboard/focus, 1440/1280/390/320, 200% text, dark/high
contrast/reduced motion. Run unit, clean typecheck, lint/i18n/design/source-size, canonical isolated
Yarn webServer E2E and visual screenshots. Media infrastructure gates remain unchanged.
Rollback scope is the Meeting-owned home composition, not the common shell.

## 검증 결과 · 2026-09-04

U01 홈 구현과 소유 범위 검증을 완료했다. U02–U15 또는 외부 미디어/AI 인프라의 운영 승인을
의미하지 않는다. 공통 셸·Gateway·OpenAPI·backend·Agent 런타임은 이번 변경에서 편집하지 않았다.

- Meeting unit: `corepack yarn vitest run --project=dwp-app apps/dwp/src/features/meetings` —
  **19 files / 141 tests PASS**. 새 홈 모델/결과/런타임 검증은 4 files / 67 tests.
- `corepack yarn typecheck --incremental false` — 전체 PASS.
- Meeting 소유 TS/TSX/E2E scoped ESLint (`--max-warnings 0`), Prettier 및 diff-check — PASS.
- `corepack yarn i18n:check`, `corepack yarn design-system:check`, display dictionary — PASS.
- `corepack yarn architecture:check` — source-size/maintenance-size/경계/도달성/계약 정합 PASS.
  포함된 production-readiness 검사는 schema/integrity 모드이며 기존 운영 evidence BLOCKED를 유지한다.
- Node24 + 정본 Yarn webServer를 격리 포트 4337에서 실행한 Chromium/mobile — **50/50 PASS**.
  홈 시각/행동/권한 18, 기존 제품 기능 24, 참여/리캡/관리 시각 8.
  최종 실행은 snapshot 갱신 옵션 없이 비교했다.
- 홈 기준 이미지 10개: 기존 8 갱신 + 1280px 2 신규. 1440/1280/768(글자 200%)/390/320,
  다크/고대비/동작 줄이기, 가로 넘침/포커스/키보드, axe serious/critical 0.
- 초기 503·갱신 503 복구, 입력 코드 보존, 403 즉시 캐시 내용 제거, 초안 본문 미노출,
  검토 권한과 게시된 결과 분리, tenant/actor 전환 및 이전 비동기 완료 차단 회귀 PASS.
- 실제 로컬 API가 연결된 Chrome에서도 홈을 확인했다. 예약 시간이 없는 회의의 합성
  `0분` 표시를 제거하고, 홈에서 장치 접근/회의 생성/녹화를 자동 실행하지 않음을 확인했다.
- 별도 UX 검토자가 6종 화면을 재검토했으며 시각적 P0/P1은 발견하지 않았다.

최종 E2E 명령:

```sh
DWP_FRONTEND_DEV_PORT=4337 E2E_BASE_URL=http://127.0.0.1:4337 \
PLAYWRIGHT_OUTPUT_DIR=test-results/meeting-home-stitch-final \
corepack yarn playwright test e2e/video-meetings.spec.ts \
e2e/video-meeting-visual-quality.spec.ts --project=chromium --project=mobile --workers=1
```

실행 런타임은 Node 24.19.0, Yarn 4.17.1. 테스트의 샘플 사용자/일정/요약은 검증 fixture이며
프로덕션에 삽입하지 않았다.

## 전체 솔루션 통합 Gate와 인계

`corepack yarn build`는 계약·구조·i18n·전체 ESLint·TypeScript·Vite production compilation까지
통과했다. 마지막 공통 초기 bundle budget에서 실패했다:

- initial raw 1172.9 KiB / limit 1074.2 KiB
- initial gzip 333.6 KiB / limit 317.4 KiB

생성된 manifest의 초기 graph는 index, application-shell 두 chunk, runtime, initial-vendor다.
Meetings route/locale chunks는 초기 graph에 없고 lazy-loaded다. 한도 상향이나 공통 번들
설정 변경으로 우회하지 않았다. 전체 배포 Gate PASS로 보고하지 않는다.

전체 `format:check`는 다른 소유 범위의 29개 파일(Calendar/Home/Work/공용 API/관련 문서 등)로
실패했다. Meeting 소유 파일은 모두 통과했고 다른 작업의 편집은 보존했다.

주요 변경 파일:

- `apps/dwp/src/features/meetings/meeting-home.tsx`
- 같은 디렉터리의 `meeting-home-header.tsx`, `meeting-home-focus.tsx`,
  `meeting-home-timeline.tsx`, `meeting-home-model.ts` 및 `.test.ts`
- `meeting-home-results.tsx`, `meeting-home-results-model.ts` 및 `.test.ts`,
  `meeting-home-results-runtime.test.ts`, `meeting-home-runtime.test.ts`
- `meeting-visual-system.ts`: 사용하지 않는 이전 대형 그라데이션 홈 surface 제거
- `libs/shared-i18n/src/locales/{en,ko}/meetings.json`
- `e2e/video-meetings.spec.ts`, `e2e/video-meeting-visual-quality.spec.ts`,
  `e2e/support/video-meeting-visual-fixtures.ts`, 홈 snapshot PNG 10개
- `scripts/design-system-adoption-baseline.json`: Meeting 두 항목만 기존 예외 총 40건 하향.
  다른 작업이 편집한 같은 파일의 항목은 보존했다.

다음 단계는 사용자가 전달할 U02–U15 화면을 각각 검토하여 실제 계약에 연결하는 것이다.
템플릿·개인 회의실·일반 업무 큐는 해당 설계/기능이 준비될 때 홈에 추가한다.
