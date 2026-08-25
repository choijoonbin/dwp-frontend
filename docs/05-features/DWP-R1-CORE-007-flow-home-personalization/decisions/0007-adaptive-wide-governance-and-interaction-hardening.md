# 0007. Adaptive wide composition, governance, and interaction hardening

- 상태: Implemented · automated browser evidence passed · external release approval pending
- 기준일: 2026-08-24
- 적용 Surface: `workspace-home`의 `FLOW_V1`
- 대체 범위: Decision 0006의 Expressive 최대 폭, Desktop Work Stage 비율, 일반 소식 정책과
  focus·keyboard drag 검증 계약을 구체화하거나 대체한다.

## Context

초기 Expressive 구현은 shell 폭과 Widget 폭만 넓혀 초광폭에서 앱 사이와 Widget 내부에 사용되지
않는 면적이 커졌다. 이는 사용자가 지적한 “확장형인데 넓어지기만 하고 휑하다”는 결함이며,
responsive layout의 목적과 맞지 않는다. 확장형은 같은 카드의 단순 확대가 아니라 추가된 폭을
정보 구조, 열 구성, 표시 항목 수와 내부 조판에 배분해야 한다.

동시에 다음 결함을 하나의 release gate에서 다뤄야 했다.

- 조직이 관리하는 필수 공지와 일반 소식의 편집 상태 표시가 일관되지 않았다.
- 조직의 News `height` 정책이 data attribute에만 남고 실제 콘텐츠 깊이를 바꾸지 않았다.
- 흰색과 같은 tenant accent에서 로컬 focus style이 사라질 수 있었다.
- keyboard drag 시작 시 원래 이동 handle이 숨겨져 focus와 다음 방향키 입력이 끊겼다.
- 개인이 저장한 폭과 순서를 adaptive template가 다시 덮을 가능성이 있었다.

## Decision

### 1. Expressive는 확대가 아니라 재구성이다

- `expressive` shell은 좌우 24px을 남기고 최대 2560px까지 사용한다.
- `>=1800px`이고 개인 Section이 기본 순서·표시·폭을 유지할 때만 adaptive wide template를
  적용한다.
- Work Stage는 60 virtual columns를 사용해 `우선 업무 25/60 + 오늘 일정 15/60 + 지원 Stack
20/60`, 즉 실제 `5/12 + 3/12 + 4/12`로 구성한다.
- `우선 업무`와 `오늘 일정`은 두 행 높이를 함께 사용하고, 우측 4/12에서는 `업무 현황`과
  `다음에 준비할 일`을 위아래로 배치한다. 네 영역의 하단이 하나의 stage로 정렬된다.
- 같은 데이터라도 단순 폭 확대로 끝나지 않도록 오늘 일정 표시 예산은 4건, 업무 현황은 4개
  metric, 일반 소식은 대표 1건과 compact rail 3건으로 바꾼다.
- 업무 현황의 4개 metric은 서로 다른 업무 건강도 차원이므로 모든 `short / standard / tall`
  높이와 허용 폭에서 4개를 유지한다. 정보 구조는 항상 2×2이며 `short`는 여백과 부가 설명을
  압축하고, `tall`만 추세·출처 같은 상세 정보를 추가한다. 높이를 이유로 항목을 제거하거나
  넓은 폭에서 1×4 strip으로 재구성하지 않는다. 단, 사용자가 콘텐츠 표시 수를 명시적으로
  저장했거나 Source가 가용하지 않은 경우에는 그 계약을 우선한다.
- `2560px`에서 핵심 업무가 이미 첫 화면에 들어간 뒤 생기는 중립 canvas는 가짜 카드 높이로
  채우지 않는다. Footer는 viewport 하단에 정렬한다.

### 2. Adaptive 적용 여부는 명시적 구조 계약이다

- `isFlowAdaptiveTemplateEligible`가 기본 세 Section의 순서, 표시 상태와 폭을 판정한다.
- 사용자가 순서·표시·폭을 변경하면 adaptive template를 끄고 저장한 twelve-column footprint를
  모든 viewport에서 source of truth로 사용한다.
- 높이는 footprint가 아니라 콘텐츠 깊이이므로 adaptive eligibility에서 제외하고 실제 저장값을
  그대로 적용한다.
- 편집 중에는 adaptive 재구성을 끄고 저장될 개인 footprint를 그대로 보여준다.

### 3. Dock은 고정 cadence를 유지한다

- Expressive 읽기 상태의 Dock 내부에는 최대 1760px 중앙 rail을 둔다.
- 초광폭 rail은 `설명 224px / 앱 960~1120px / 모든 앱 112px`로 구성하고 App tile 사이에 남는
  폭을 `1fr`로 분배하지 않는다.
- App tile은 72px 계열 고정 pitch와 10~16px gap을 유지하며, 넓은 화면에서는 최대 12개를
  표시한다. 남은 앱 알림은 `모든 앱`의 의미 있는 aggregate badge로 전달한다.
- 편집 상태에서는 기존 4개 app group, pin·hide·folder·context menu와 long press를 유지한다.

### 4. 필수 공지와 일반 소식은 다른 governance channel이다

- 필수·Critical 항목은 일반 News 표시 정책과 무관한 organization rail이다. 일반 News가
  숨겨져 있어도 유지하고, required 상태를 확인할 수 없으면 경고와 retry를 fail closed로
  표시한다.
- 필수·Critical·dismissed 항목은 일반 News에서 제외해 중복과 잘못된 홈 unread count를 막는다.
- 일반 News는 organization-managed trailing widget으로 편집 화면에서도 같은 governance label과
  fixed-position 의미를 사용한다.
- Flow의 일반 News는 뒤에 짝이 없는 trailing 관리형 영역이므로 부분 폭을 남겨 빈 orphan row를
  만들지 않고 전체 폭으로 정규화한다. 관리 화면도 Flow 선택 시 이 계약을 명시하며, 기존 조직
  `size`는 Classic Home에서만 실제 grid footprint를 바꾼다. `height`는 두 경험 모두 실제 콘텐츠
  예산을 바꾸며 `short`는 최대 3건, `standard`는 최대 4건을 사용한다.

### 5. 단일 scroll과 보존된 편집 계약

- Home Widget content는 `overflow-y:auto`를 만들지 않고 document 하나가 세로 scroll을
  소유한다. 포인터가 Widget 위에 있어도 페이지 wheel·trackpad chaining이 계속된다.
- 기존 편집 버튼, 550ms long press, pointer·touch·keyboard DnD, 비 drag 이동 버튼,
  resize·height, pin·folder·hide·restore, undo·redo, save·cancel·reset과 focus 복원을 유지한다.
- keyboard drag 중에는 active handle을 숨기지 않아 focus와 arrow/drop 입력을 유지한다.
  Pointer drag에서는 기존 drop placeholder와 overlay를 유지한다.

### 6. Tenant color와 무관한 focus indication

- tenant primary color는 브랜드 표현에 사용하되 focus ring의 유일한 색으로 사용하지 않는다.
- Theme가 현재 표면 대비 3:1 이상인 불투명 semantic focus color를 계산해
  `--dwp-focus-ring`으로 제공한다.
- Dock, 필수 공지, 일정, 업무 현황, News, Home launcher의 로컬 focus style도 같은 token을
  shorthand로 사용해 CSS cascade가 `currentColor`로 되돌리지 않게 한다.
- forced colors에서는 운영체제 `CanvasText` 계약을 유지한다.

## Verification contract

- 1920·2560 Expressive에서 실제 `5/12 + 3/12 + 4/12`, 우측 support stack, Dock 양끝 거리,
  News 높이와 horizontal overflow를 bounding geometry로 확인한다.
- 1440·1920 한국어 Default와 1920 한국어 Edit를 실제 브라우저 캡처한다.
- 비기본 개인 폭은 2560에서도 data attribute뿐 아니라 실제 bounding width ratio로 확인한다.
- Flow News는 전체 폭과 orphan gap 부재를, `short/standard`는 링크 수와 실제 높이 차이를 검증한다.
- 업무 현황은 모든 허용 폭과 `short / standard / tall`에서 4개 metric, 2열·2행, 콘텐츠
  비잘림을 검증하고 높이 단계가 핵심 metric 수를 바꾸지 않는지 확인한다.
- 흰 tenant accent에서 Dock·필수 공지·일정·업무·News focus가 semantic ring을 사용하는지
  확인한다.
- keyboard drag는 handle focus 유지, 개인 Widget만 이동, 최종 위치 live announcement,
  discard 후 원래 순서와 진입 focus 복원을 검증한다.

## Restore point

이번 결정도 다음 전체 복원 지점을 유지한다.

`/Users/a10697/Work/DWP/.codex-restore-points/home-flow-v1-before-redesign-20260824-130133-KST`

복원은 사용자의 명시 요청이 있을 때만 Capture 단위로 수행한다.
