# 0004. Flow Home Visual v1.1과 안전한 편집 계약

- 상태: Accepted for implementation
- 기준일: 2026-08-24
- 적용 Surface: `workspace-home`의 `FLOW_V1`
- 검토: Architecture, UI/UX, Accessibility·Personalization 교차 검토

## Context

기존 Flow 구현 후보는 단일 문서 스크롤과 실데이터 기반 Section을 제공하지만 Context, Dock,
Now와 개인 Section을 모두 비슷한 `Paper + border`로 표현한다. 이 때문에 정보 우선순위가 약하고
`focused`, `balanced`, `expressive` Preset도 간격 차이만 보여 개인화 체감이 낮다. 또한 앱 Dock의
550ms 길게 누르기는 존재하지만 읽기 상태의 Widget 길게 누르기는 연결되지 않았고, 일반 Motion
환경의 반복 Jiggle과 편집 진입·종료 Focus 복원도 안전 계약을 충족하지 못한다.

## Primary user, question and action

- Primary user: 로그인 직후 오늘의 업무를 시작하는 구성원·관리자·운영 담당자
- Primary question: `지금 가장 먼저 무엇을 처리하고, 오늘 어떤 흐름을 준비해야 하는가?`
- Primary action: 자주 쓰는 앱을 즉시 실행하거나 `Now`의 최우선 업무를 연다.
- Archetype: 자유 좌표 Dashboard가 아닌 개인 업무 Command Center

## Decision

### 1. 읽기 구조

기본 읽기 순서와 DOM 순서는 다음을 유지한다.

1. 열린 `Compact Context`
2. 하나의 부드러운 `My App Dock`
3. 필요한 경우에만 조직 관리형 공지 Band
4. 고정 `Now`와 기본 Sidecar `Today Flowline`의 Action Stage
5. Divider로 연결된 `Work Signals`
6. 열린 Row 목록인 `Next`
7. Freshness Footer

`>=1280px`의 기본 Action Stage는 60-unit 저장 Grid에서 `Now=large(40)`와
`Today Flowline=compact(20)`로 구성한다. 768~1279px, Mobile과 실제 200% 글자 크기에서는 같은 DOM이 한
열로 전환된다. 사용자가 Flowline의 위치·폭을 바꾸거나 숨길 수 있으며, `Now`는 조직 관리 영역으로
항상 첫 번째에 남는다.

### 2. Surface hierarchy

- Context는 Card·Shadow를 갖지 않는 열린 Canvas다.
- Dock만 첫 Viewport의 기본 Ambient Shadow를 갖는다.
- `Now`는 실제 행동 항목이 있을 때만 Inverse Surface를 사용한다. Empty·Forbidden·Unavailable은
  일반 또는 압축 상태로 돌아간다.
- Signal은 KPI Card 묶음이 아니라 하나의 Surface 안에서 Divider로 구분한다.
- Next의 반복 객체는 Card가 아니라 Row와 Divider를 사용한다.
- 일반 Section에는 Shadow를 사용하지 않고 실제 Floating Layer인 Menu, Dialog와 편집 Toolbar에만
  강한 Elevation을 허용한다.

Light Canvas는 Warm Pearl `#F7F6F2`, 기본 Surface는 `#FCFCFB`, 보조 Surface는 `#EEF3F8`,
행동 가능한 Inverse는 `#111923`을 기준으로 한다. Dark, Forced Colors와 Reduced Transparency는
Theme의 불투명 Surface와 System Color가 우선한다. Tenant 이미지는 Flow Context의 낮은 대비
Scene으로만 사용하며 필수 Text의 배경이 되지 않는다.

### 3. 의미 있는 시각화 Gate

Chart 또는 Sparkline은 다음 조건을 모두 만족할 때만 표시한다.

1. 동일 Metric·Unit의 실제 시계열이 4개 이상이다.
2. 기간과 Target·Threshold·Baseline 중 하나가 명확하다.
3. Source와 마지막 갱신 시각이 있다.
4. 원본 화면으로 이동할 수 있다.
5. 동일 데이터의 Text Summary와 Table/List 대안이 있다.

조건이 부족하면 Target Meter, 값·기준 문장 또는 `비교 데이터 없음`으로 축소한다. 가짜 Trend,
장식 Donut·Gauge와 임의 생성 데이터는 금지한다.

### 4. Bounded expression

기존 저장 계약의 `presentation`을 실제 표현 Preset으로 사용한다.

| Preset       | 표현                                                    |
| ------------ | ------------------------------------------------------- |
| `focused`    | Scene 제거, 조밀한 간격, 설명 축약, 가장 낮은 Elevation |
| `balanced`   | Warm Pearl Canvas, 표준 간격·콘텐츠 예산                |
| `expressive` | 넓은 간격, 승인된 낮은 Scene·Accent와 Flowline 강조     |

Preset은 Entitlement, 상태색, 필수 Zone, DOM 순서, 업무 수치와 접근 가능한 이름을 바꾸지 않는다.
앱·Widget 순서, 표시·숨김, Folder, 승인 폭·높이, Desktop·Mobile Preview, 저장·취소·Reset,
Undo·Redo, Revision·Template·복수 Home 계약은 그대로 유지한다.

### 5. Scroll and editor safety

- Home 읽기·편집 상태 모두 세로 Scroll은 Document 하나가 소유한다.
- Wheel·Trackpad Event를 가로채거나 Widget 경계에서 전파를 막지 않는다.
- 앱과 읽기 상태 Widget 모두 550ms 길게 누르기로 편집에 진입한다. Pointer가 10px 이상 움직이면
  취소하고, 실제 진입 뒤의 우발 Click을 억제한다.
- Mouse·Touch·Keyboard DnD와 이동 Button/Menu를 함께 유지한다.
- 편집 진입 Motion은 1회 180ms Settle만 허용하고 반복 Jiggle·Pulse를 금지한다.
- Reduced Motion에서는 Transform을 제거하고 Outline·Text로 상태를 전달한다.
- 편집 진입 후 Keyboard Focus는 편집 Toolbar로 이동하고, Save·Cancel 뒤에는 연결된 진입 Trigger
  또는 안전한 Home Heading으로 복원한다.
- Draft는 Save 실패·409 충돌에서도 보존한다.

## Global pattern evidence

- Microsoft Viva Connections: 조직 기본·Audience 관리와 사용자 재배치·표시 제어, Device Preview를
  분리한다. <https://learn.microsoft.com/en-us/viva/connections/create-dashboard>
- Apple Widgets·Home customization: 한눈에 보는 정보와 정확한 Deep Link, 길게 누르기 기반의
  복구 가능한 편집을 사용한다. <https://developer.apple.com/design/human-interface-guidelines/widgets>
- IBM Carbon Dashboard: 적은 지표, 강한 계층, 여백과 제한된 Expressive moment를 사용한다.
  <https://carbondesignsystem.com/data-visualization/dashboards/>

위 Pattern은 Entitlement나 보안 권한의 근거가 아니다. DWP 서버 권한과 Tenant 정책이 항상
최종 권한을 소유한다.

## Rollout and rollback

Classic renderer와 Legacy preference는 삭제하거나 재해석하지 않는다. `FLOW_V1`은 서버가 계산한
Effective Variant가 있을 때만 선택하고 모르는 조합은 Classic으로 Fail Closed 한다. 운영 Rollback은
대상 Tenant의 정책을 `CLASSIC`으로 되돌린 뒤 광범위 장애에서 전역 Flow Flag를 끄는 순서다.
VIEWS 장애는 Read만 Legacy로 되돌리고 Dual Write·Shadow Compare는 정합성이 회복될 때까지
유지한다. 사용자 Preference를 초기화하거나 기존 Migration을 역행하지 않는다.

구현 전 복원 지점은 Workspace 외부 Archive, 각 Repository의 전체 `.git`, Working Tree와 로컬
Home 관련 Database를 포함하며 SHA-256과 Archive 무결성을 검증한다. 복원은 사용자의 명시 요청
후 작업 이후 상태를 별도 보존하고 수행한다.

## Acceptance gates

- Dock, Now, Flowline, Signals, Next 위에서 Wheel 상·하가 Document를 이동하고 내부 Y Scroll이 없다.
- 1440, 1280, 390, 320 CSS px와 실제 200% 글자 크기에서 수평 문서 Overflow가 없다.
- App/Widget 550ms Long press, Mouse·Touch·Keyboard DnD, 비 Drag 이동, Folder와 Context Menu가
  동작한다.
- Save·Cancel·Reset·Undo·Redo·409 재적용 후 Draft와 Focus가 계약대로 유지된다.
- Light·Dark·Forced Colors·Reduced Motion·Reduced Transparency에서 의미와 조작이 유지된다.
- 한국어·영어 긴 Label, Partial·Stale·Forbidden·Empty 상태와 44px Target을 검증한다.
- Chart는 실데이터 Gate와 접근 가능한 Table/List 대안을 함께 통과한다.
- Classic과 Flow 전환 전후 App·Widget Preference의 정규화 값이 동일하다.

## Consequences

- 전체 UI Library를 교체하지 않는다. MUI, DWP Design System, Lucide와 기존 DnD 계약을
  고도화한다.
- 시각 Preset은 새 자유 형식 CSS나 임의 Wallpaper Upload 없이 현재 저장 계약에서 안전하게
  강화할 수 있다.
- 7:5 Action Stage와 Widget 폭을 지원하려면 Flow Section Registry, Preference Adapter와
  Responsive Test를 함께 변경해야 한다.
- 서버가 제공하지 않는 우선순위·영향 요소를 Client에서 추정하지 않는다. 시간대 정규화와
  안전한 Action Link는 별도 Backend Projection으로 이동하는 후속 Architecture Gate로 남긴다.
