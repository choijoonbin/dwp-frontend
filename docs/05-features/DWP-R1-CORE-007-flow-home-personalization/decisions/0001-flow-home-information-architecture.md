# 0001. Flow Home 정보 구조

- 상태: Proposed
- 기준일: 2026-08-21
- 적용 Surface: `workspace-home`
- 승인: Product·Design 승인 대기

## Context

기존 Home은 권한 기반 앱을 로그인 직후 실행한다는 명확한 목적이 있지만 대형 App Hero와
비슷한 비중의 Widget이 첫 화면을 점유한다. 앱 실행을 뒤로 숨기지 않으면서 실제 업무의 시급성,
시간 흐름과 다음 행동을 한 화면에서 판단할 수 있는 계층이 필요하다.

## Decision

기본 읽기 순서를 다음으로 고정한다.

1. `Compact Context`: 날짜, 역할·대리 Context와 최근 성공 갱신 상태
2. `My App Dock`: 권한 앱, 앱별 알림·상태, 사용자 Pin·Folder와 `모든 앱`
3. 관리형 공지: 대상·기간 정책을 통과한 공지가 있을 때만 표시하는 고정 영역
4. `Now`: 가장 시급하고 설명 가능한 한정된 업무·일정·승인과 주 행동
5. `Today Flowline`: 오늘의 실제 시간·의존·상태 관계
6. `Work Signals`: 판단을 돕는 실제 추세·비교·임계값과 Drill-down
7. `Next`: 오늘 이후 또는 현재 행동 뒤에 이어질 업무

Global Header, Tenant/DWP Lockup, 검색, 알림과 계정은 기존 Shell 계약을 유지한다. 관리형 공지는
대상·기간 정책을 통과한 경우 `Now` 앞의 고정 영역에 합성하되 사용자의 개인 Layout에 저장하지
않는다.

### My App Dock

- 사용자가 로그인 직후 앱별 Badge를 확인하고 자주 쓰는 앱을 즉시 실행하는 기존 목적을
  보존한다.
- Tenant 기본 → Entitlement → 사용자 Pin·Folder 순으로 계산한다.
- 첫 Viewport의 예측 가능한 위치를 유지하되 전체 앱을 억지로 한 행에 넣지 않는다.
- Responsive 콘텐츠 예산을 넘는 앱은 `모든 앱` 검색 가능 Grid/List로 연결한다. Home에 별도
  세로 또는 가로 Scroll Track을 만들지 않는다.
- 권한이 없는 앱은 Dock, Folder, Badge, DOM과 Route에서 모두 제외한다.

### Now

- 마감, 업무 영향, 승인 차단, 명시적 Pin과 현재 시간에 근거한 소수 항목만 보여준다.
- 추천 이유, Source, Freshness와 누락 원천을 확인할 수 있어야 한다.
- 데이터가 없거나 모든 원천이 실패하면 합성 성공 상태를 만들지 않는다.

### Today Flowline

- 우주 배경의 빛 흐름을 그대로 장식하지 않고 Schedule·Work·Approval의 실제 순서와 상태를
  설명하는 정보 표현으로 사용한다.
- Flowline의 각 Node는 제목, 시간·기한, 상태, Source와 행동을 갖는다.
- 시간 관계가 없거나 데이터가 부족하면 간단한 목록·Empty·Unavailable 상태로 대체한다.
- 자동으로 계속 움직이는 Animation과 색상 단독 상태 표현을 사용하지 않는다.

### Work Signals와 Next

- Signal은 추세·비교·분포·임계값 중 하나를 실제 데이터로 설명할 때만 사용한다.
- 모든 Chart에는 동등한 텍스트 또는 표 대체와 원본 업무 Drill-down이 있다.
- Next는 현재 행동 이후의 후속 항목을 보여주며 별도 무한 Feed가 아니다.

## Visual Direction

`Soft Aurora`를 사용한다. Warm Pearl 계열 바탕, DWP Cobalt·Cyan의 제한된 흐름, 위험을 위한
Coral, 20~28px Radius와 절제된 Elevation으로 부드러운 인상을 만든다. Glass와 Gradient는 계층과
흐름을 설명하는 범위에만 사용한다. DWP Product Experience Rules의 장식 Gradient·Glow·Card
Soup 금지 원칙이 우선한다.

## Consequences

- App Launcher의 목적은 유지되지만 대형 배경 Hero는 주 계층에서 내려간다.
- 실제 데이터와 Source가 없는 Chart·Flowline을 만들 수 없다.
- 각 Section은 콘텐츠 예산과 Drill-down Route가 필요하다.
- 과거 `CORE-002`의 App Hero·네 Group 한 행·Mobile Snap은 역사적 구현 기준선으로 남고
  `workspace-home` vNext에는 적용하지 않는다.

## Rejected Alternatives

- 앱 Launcher 제거: 기존 핵심 JTBD와 앱별 알림 확인을 훼손한다.
- 현재 Hero에 Chart만 추가: 정보 계층과 Scroll 문제를 해결하지 못한다.
- 동일 크기 Bento Card 확대: 중요도와 업무 연결이 다시 묻힌다.
- AI 생성 Dashboard: Source·권한·일관된 반응형 계약과 예측 가능성을 잃는다.
