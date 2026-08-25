# 0005. Flow Home v2 — Daily Work Launch & Triage

- 상태: Superseded in visual composition by Decision 0006 · historical implementation record
- 기준일: 2026-08-24
- 적용 Surface: `workspace-home`의 `FLOW_V1`
- 대체 범위: Decision 0004의 Visual composition과 Action Stage 비율을 대체한다. 0004의 단일
  문서 Scroll, 안전한 편집 세션, 접근성, Rollback 원칙은 유지한다.

> 2026-08-24 Critical design audit 이후 Header Assistant, Tenant Logo fallback, Dock cadence,
> inverse Now, Action Stage 비율과 Appearance preset 의미는
> [Decision 0006](0006-critical-design-audit-and-home-v2-correction.md)이 대체한다.

## Context

Flow Home v1은 내부 Scroll 문제와 실데이터 연결을 해결했지만, 뉴스와 `Now`가 각각 전체 폭의
긴 영역을 차지하고 좌우 여백과 반복 Surface가 커져 첫 화면의 업무 밀도가 낮았다. Home을 뉴스
Portal이나 Widget 모음으로 해석하면 사용자가 로그인 직후 필요한 앱 실행과 업무 선별이 다시
아래로 밀린다.

## Product contract

- Primary user: 로그인 직후 업무를 시작하는 구성원. Manager·Operator 정보는 Entitlement 안에서
  누적한다.
- Operational question: `지금 처리할 일과 오늘 준비할 일을 빠르게 선별하고, 필요한 앱을 바로
실행할 수 있는가?`
- Primary action: `Now`의 최우선 업무를 열거나 App Dock의 앱을 실행한다.
- Archetype: `Daily Work Launch & Triage`형 Personal Command Center

Home의 성공은 머문 시간이나 Widget 수가 아니라 첫 업무 행동, 앱 실행 성공, 필수 항목 누락 0건,
권한 밖 노출 0건과 신뢰 가능한 상태 표현으로 판단한다.

## Decision

### 1. 정보 우선순위와 화면 예산

기본 문서·DOM 순서는 다음과 같다.

```text
Compact Context (desktop target <= 96px)
  -> My App Dock (desktop target <= 128px, visible app/folder <= 8)
  -> Required/Critical notice rail (eligible일 때만, thin rail)
  -> Work action stage
       row 1: Now 8 columns + first visible personal section 4 columns
       row 2 default: Work Signals 4 columns + Next 8 columns
  -> Updates (normal editorial communications, after work)
  -> Home freshness footer
```

`12-column`은 시각적 설명이며 저장 계약은 기존 60-unit Composer Grid를 유지한다. 따라서 4/8은
각각 `compact(20)`/`large(40)`에 대응한다. 기본값은 `Today Flowline=compact`, `Work
Signals=compact`, `Next=large`다. 첫 개인 Section이 숨김·이동·Resize되면 `Now`가 그 폭의
보완 폭을 사용하고, 안전하게 조합할 수 없거나 좁은 화면에서는 전체 폭 한 열로 전환한다.

### 2. 공지와 Updates

- `acknowledgementRequired=true` 또는 `severity=CRITICAL`인 대상 공지만 Dock 뒤의 얇은 Rail에
  올린다.
- 일반 소식, Featured story와 읽지 않은 소식 요약은 실제 업무 Stage 뒤의 `Updates`에 둔다.
- 필수 공지를 Rail과 Updates에 중복 노출하지 않는다.
- 공지가 없거나 권한이 없으면 빈 공간을 예약하지 않는다.
- 자동 Carousel, Marquee와 장식용 Motion을 사용하지 않는다.

### 3. App Dock과 Badge

- Dock에는 권한·Tenant 정책·개인 Layout을 모두 통과한 App 또는 Folder를 최대 8개 표시한다.
- `모든 앱`은 아홉 번째 App Tile이 아니라 Dock의 독립 Action이다.
- Badge는 `totalUnread`, `actionableUnread`, `urgentUnread`를 구조적으로 유지한다. 시각 Tone과
  접근 가능한 이름은 `urgent > actionable > unread` 우선순위를 사용한다.
- Notification 부분 실패 때 정상 App의 Badge는 유지하고 실패한 Source만 숨기거나 비가용으로
  표현한다. 정적 숫자나 오래된 숫자로 대체하지 않는다.
- Summary Query의 `staleTime`·`refetchInterval`은 각각 30초이고 `generatedAt`은 현재
  기준 ±30초에서만 신뢰한다. 권한 없음, 최초·Refetch 오류, 오래된 성공 Cache는
  이전 Badge·Metadata 전체를 숨기는 Fail-closed 상태다.
- Flowline의 숨겨진 Overflow Source가 Calendar 하나면 `/calendar/schedule`, Work
  하나면 `/work`로 이동한다.

### 4. Truthful state contract

- `FORBIDDEN`: 권한 밖 제목·수치·원천 ID를 표시하지 않는다. 빈 상태로 위장하지 않는다.
- `UNAVAILABLE`: 마지막 성공 데이터가 없다면 실패와 Retry를 명시한다. 다른 정상 Section을
  지우지 않는다.
- `PARTIAL`: 사용할 수 있는 실제 데이터는 유지하고 누락된 Source만 설명한다.
- Date mismatch: 화면의 기준일과 원천 항목 날짜가 다르면 `오늘`이라고 표기하지 않는다. 실제
  날짜 또는 갱신 지연 상태를 보여준다.
- Source label: 내부 Runtime Key 대신 승인된 사용자용 Source 이름을 표시한다.
- `0`, Healthy empty, No data, No comparison, Forbidden, Unavailable을 서로 다른 상태로 유지한다.

### 5. Shell, assistant와 Tenant brand

- Home 본문 오른쪽에 영구 Assistant Rail을 예약하지 않는다. DWAI·ON 진입점은 Global Header의
  기존 Entitlement 기반 Control을 사용하고, 열린 Assistant만 독립 Layer가 된다.
- Tenant Logo가 없거나 0×0·Decode·Network 오류로 실패하면 Logo Slot과 Divider를 제거하고 DWP
  Product Mark로 자연스럽게 수렴한다. 깨진 이미지나 빈 고정 폭을 남기지 않는다.
- Tenant Scene은 Context의 매우 낮은 대비 Accent일 뿐 필수 Text 배경이나 대형 Hero가 아니다.

### 6. Existing editor and bounded personalization

v2 재구성은 다음 기능을 제거하거나 초기화하지 않는다.

- 명시적 `홈 편집`, App·Widget 550ms Long press, Context Menu
- Mouse·Touch·Keyboard DnD와 비 Drag 이동
- App Pin·Hide·Restore·Folder, Widget Add·Hide·Restore·순서·승인 폭·콘텐츠 예산
- Save·Cancel·Reset·Undo·Redo·409 재적용, Desktop·Mobile Preview
- 복수 Home, Revision·Restore, Template, Device Overlay와 Home Studio

개인화는 Entitlement, 관리형 Zone, Component Registry와 허용 Size 안에서만 동작한다. 임의
좌표·HTML·CSS·Script, 필수 Zone 숨김, 무승인 AI 자동 적용은 계속 금지한다.

### 7. Scroll and responsive behavior

- Home 읽기·편집 상태의 세로 Scroll Owner는 Document 하나다.
- Home Section에서 같은 축 `overflow-y:auto|scroll` 또는 Scroll chaining 차단을 사용하지 않는다.
- `>=1200px`에서 4+8 또는 8+4 Pair를 사용하고, 그보다 좁거나 Mobile Preview·실제
  `html font-size: 200%` 상태에서는 동일 DOM 순서를 한 열로 Reflow한다.
- Required Notice가 있으면 실제 Narrow Viewport와 Desktop 편집기 Mobile Preview에
  동일한 `priorityCompact` 정책을 적용하고 Context·Now 보조 설명을 축약한다.
- 검증 Viewport는 1440×900, 1280×800, 390×844, 320×568과 실제 `html font-size: 200%`다.
- Light·Dark·High Contrast·Forced Colors·Reduced Motion·Reduced Transparency에서도 의미,
  Focus와 조작을 유지한다.

## Implementation and verification boundary

현재 Source에는 v2 구성, 구조화 Badge, 날짜 불일치 판정, 필수 Rail·Updates 분리, Header Assistant,
Tenant Logo 오류 fallback이 구현되어 있다. 2026-08-24 v2 검증 Snapshot은 다음과 같다.

- Home Feature Vitest: Flow·Editor·Personalization·Badge Policy·Home History localization을
  포함해 15 files, 61 tests passed
- `flow-home.spec.ts` 기본 Chromium: 24 passed / 9 skipped
- Personalization v2 Flag Chromium: 33/33 passed
- Personalization v2 Mobile: 28 passed / Chromium-only 5 skipped
- `dwaion-launcher.spec.ts` Chromium: 5/5 passed
- Production `yarn build`의 Architecture·Route·Feature·API·Source-size·Design System·i18n·Display
  Dictionary·ESLint·TypeScript·Vite·Bundle Budget passed

위 결과는 최신 통합 Worktree 재실행 결과이며 사람 승인·실기기·보조기술 QA를 대신하지
않는다. Mobile 상위 4개 Dock·첫 CTA, Source Freshness·시간 경과, 확인된 Rail 제거,
Work-only Route, `UNAVAILABLE`·`FORBIDDEN` 의미, Mobile Preview 단일 열·Required Notice
`priorityCompact`, Notification Badge 30초 Stale transition을 포함한다.
최종 수치는 [`10-구현 및 검증 결과.md`](../10-구현%20및%20검증%20결과.md)에 갱신한다.

## Restore point and rollback

v2 재설계 직전의 정확한 복원 지점은 다음이다.

`/Users/a10697/Work/DWP/.codex-restore-points/home-flow-v1-before-redesign-20260824-130133-KST`

복원은 사용자의 명시 요청이 있을 때만 수행한다. 먼저 현재 v2 상태를 별도 보존하고 Stack을 중지한
뒤 `MANIFEST.md`의 SHA-256을 검증하고 Frontend·Backend Archive와 세 Database Dump를 완전한
단위로 복원한다. 운영 Rollback은 Source Archive 복원보다 Tenant Variant `CLASSIC` 또는 전역
Flow Kill Switch를 우선하며 사용자 Preference를 Reset하거나 Migration을 Down하지 않는다.

## Consequences

- 첫 화면은 소식 소비보다 앱 실행과 업무 선별을 우선한다.
- 4+8 Pair는 화면 폭을 활용하지만 Mobile과 실제 200% 글자 크기에서는 문서 순서를 보존한
  한 열이 된다.
- 일반 소식이 아래로 이동해도 필수·Critical 공지는 얇은 Rail로 놓치지 않는다.
- UI Library 전면 교체 없이 MUI·DWP Design System·Lucide·기존 Composer를 고도화한다.
- 외부 상용 Design AI의 독립 승인을 받았다고 주장하지 않는다. 공개 글로벌 Pattern, 내부 다중
  관점 Review, 자동 검증과 승인된 제품 계약을 근거로 한다.
