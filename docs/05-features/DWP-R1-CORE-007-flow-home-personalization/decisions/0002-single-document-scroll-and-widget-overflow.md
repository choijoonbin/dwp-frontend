# 0002. Home 단일 문서 스크롤과 Widget Overflow

- 상태: Proposed
- 기준일: 2026-08-21
- 적용 Surface: `workspace-home` 읽기·편집 Mode
- 승인: Frontend·Design·Accessibility 승인 대기

## Context

Home 페이지와 Widget이 같은 세로 축의 Scroll Container가 되면 Wheel·Trackpad 입력이 포인터
아래 Widget에서 소비된다. 사용자는 페이지 아래로 이동하려고 빈 공간을 찾아 포인터를 옮겨야
한다. Widget의 콘텐츠를 모두 표시해야 한다는 요구와 문서 이동의 예측 가능성을 함께 해결해야
한다.

## Decision

`workspace-home`의 기본 읽기·편집 화면은 문서 하나만 세로 Scroll을 소유한다.

- Home Widget 본문에 `overflow-y: auto|scroll`을 사용하지 않는다.
- Home Widget에 `overscroll-behavior-y: contain|none`을 적용해 페이지 Scroll chaining을
  차단하지 않는다.
- Wheel·Trackpad Event를 JavaScript로 가로채 상위 문서에 재전송하지 않는다.
- 시각 Mask가 필요하면 `overflow: clip` 또는 안전한 `hidden`을 사용할 수 있지만 가려진 업무
  정보에는 반드시 동일한 접근 경로가 있어야 한다.
- Dialog, Menu, Listbox처럼 Focus가 명시적으로 이동한 Overlay는 독립 Scroll을 가질 수 있다.
  닫기, Escape와 Focus 복원 계약이 필수다.
- 대용량 Table·Canvas가 업무상 독립 Scroll을 반드시 요구하면 Home 요약 Widget이 아니라 전용
  Route에서 제공한다.

## Content Budget

각 Widget Manifest는 표현 높이가 아니라 정보 예산을 가진다.

| 항목       | 계약                                                                   |
| ---------- | ---------------------------------------------------------------------- |
| 우선 행    | 긴급·마감·관리형·사용자 Pin 순으로 선택                                |
| 표시 수    | Viewport·Density별 승인된 `contentRows` 사용                           |
| 생략 표시  | 전체 건수, 현재 표시 수와 적용 Filter를 알림                           |
| Drill-down | `전체 보기`가 원본 Route·Scope·Filter·Return URL을 보존                |
| Freshness  | 마지막 성공 갱신, Stale·Partial·Unavailable을 Section별 표시           |
| 접근성     | 생략 사실과 전체 보기 목적을 Screen Reader가 이해할 수 있게 Label 제공 |

콘텐츠가 적을 때 고정 높이를 채우기 위한 빈 공간을 만들지 않는다. 콘텐츠가 많을 때 중요한
행을 단순히 잘라내지 않고 총건수와 원본 경로를 제공한다.

## Input별 동작

| 입력           | 읽기 Mode                        | 편집 Mode                                                  |
| -------------- | -------------------------------- | ---------------------------------------------------------- |
| Wheel·Trackpad | 포인터 위치와 무관하게 문서 이동 | Drag 중이 아니면 문서 이동                                 |
| Touch Swipe    | 문서 이동                        | Handle 밖 Swipe는 문서 이동                                |
| Pointer Drag   | 해당 없음                        | Drag Handle에서만 시작, Viewport Edge에서 문서 Auto-scroll |
| Keyboard       | Landmark·Heading·Control 순서    | 이동 메뉴 또는 지정 Shortcut, DOM 순서와 시각 순서 일치    |
| Screen Reader  | Section 요약·건수·Freshness      | 편집 시작·이동 결과·취소를 Live Region으로 알림            |

Long Press는 편집 Mode로 들어가는 보조 Shortcut이며 일반 Scroll Gesture를 가로채지 않는다.
명시적 `홈 화면 편집` 버튼과 메뉴 경로를 항상 함께 제공한다.

## Responsive

- Tablet·Mobile은 단일 열 문서 흐름으로 Reflow한다.
- Desktop App 행을 축소하거나 가로 Snap 안에 숨기지 않고 Dock 예산 + `모든 앱` 경로를 쓴다.
- 320px과 실제 200% 글자 크기에서도 페이지 수평 Scroll을 만들지 않는다.
- Mobile에서 고정 Widget 높이와 내부 Scroll을 사용하지 않는다.

## Verification

다음 시나리오는 자동화 대상이다.

1. Widget 중앙에 포인터를 두고 연속 Wheel을 입력해 다음 Section과 문서 끝까지 이동한다.
2. Widget 콘텐츠가 0, 예산 이하, 예산 초과일 때 높이·건수·전체 보기가 정확하다.
3. Trackpad 관성, Touch Swipe와 Keyboard Page Down/Space가 같은 읽기 순서를 유지한다.
4. 편집 Mode Drag Edge Auto-scroll 뒤 DOM·시각·저장 순서가 같다.
5. Dialog·Menu를 닫으면 Trigger로 Focus가 복원되고 문서 Scroll 위치가 유지된다.
6. 1440·1280·390·320px, 실제 200% 글자 크기에서 수평 Overflow와 겹침이 없다.

## Consequences

- 기존 `workspace-home` Widget의 고정 높이와 내부 `overflowY` 구현은 단계적으로 제거해야 한다.
- Widget 상세 탐색은 전용 Route 품질과 Return Context에 의존한다.
- 공통 Composer의 순서·너비 Token은 유지할 수 있지만 높이 Token은 Home에서 정보 예산·최소
  시각 Footprint로 재해석해야 한다.
- HCM 등 다른 Surface는 별도 Migration 승인 전 기존 계약을 유지한다.

## Rejected Alternatives

- Widget 끝에서 Wheel Event를 부모로 수동 전달: Trackpad 관성·브라우저·보조기술별 불일치가
  커진다.
- Hover 시 Scroll 잠금 해제 Toggle: 발견하기 어렵고 입력 Mode마다 동작이 다르다.
- 모든 콘텐츠 무제한 펼침: 긴 Home, 정보 과부하와 초기 렌더 비용을 만든다.
- Home 전체 고정 Viewport + 영역별 Scroll: 사용자 문제를 구조적으로 반복한다.
