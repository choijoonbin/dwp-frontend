# R1 Flow Home 및 Bounded Personalization ADR

> 상태: Implemented · architecture approval pending
>
> 구현 상태: Phase 1·2 capability and Home v2 composition implemented; integrated frontend verification passed
>
> 승인 상태: Architecture, Product, Design, Platform, Notification, Security·Privacy 승인 대기
>
> 기준일: 2026-08-25
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

## 1. Context

### 1.1 Primary User

로그인 후 여러 DWP 앱, 알림, 일정, 업무와 협업 신호를 오가며 오늘 무엇을 먼저 처리할지 결정해야
하는 구성원이다. Manager와 Operator는 동일 Home을 사용하되 권한 범위에서 추가 신호를 받는다.

### 1.2 Operational Question

> 지금 처리할 일, 오늘 일정, 응답할 일과 진행 중인 요청을 앱을 오가지 않고 어떻게 판단하고 실행할 것인가?

### 1.3 Primary Action

사용자가 자주 쓰는 앱을 즉시 실행하거나 `우선 업무`의 첫 행동을 처리하는 것이다.

### 1.4 Page Archetype

Home은 Marketing Hero나 일반 Dashboard가 아니라 **Daily Work Launch & Triage형 개인 업무
Command Center**다. App Launcher,
업무 우선순위, 시간 흐름과 근거 있는 신호를 한 문서 흐름으로 제공한다.

### 1.5 문제

고도화 이전 Home은 다음 구조적 문제를 가졌다.

1. Widget과 App Group이 고정 높이와 내부 세로 Scroll을 사용해 Browser Scroll Chaining을 막는다.
2. 사용자가 Widget 위에 Pointer를 둔 채 다시 Wheel을 사용하면 문서의 다음 영역으로 이동하지 못한다.
3. Home App Badge 일부가 실제 알림이 아니라 정적 숫자다.
4. 큰 배경 이미지와 동일한 사각 Widget이 업무 우선순위보다 시각적 공간을 차지한다.
5. 앱 배치 Preference와 Workspace `pinned` 신호가 분리돼 Home 등록 의미가 불명확하다.
6. Personalization 기능은 존재하지만 정보 구조, AI 제안, 다중 Home으로 확장할 장기 계약이 없다.

현재 구현 근거:

- `apps/dwp/src/components/workspace-composer/workspace-widget-canvas.tsx`: Widget 내부
  `overflowY: auto`, `overscrollBehavior: contain`
- `apps/dwp/src/features/home/app-launchpad.tsx`: Desktop App Group 내부 세로 Scroll
- `apps/dwp/src/components/workspace-composer/workspace-widget-layout-policy.ts`: 288·368·448·560px
  고정 Block Size
- `apps/dwp/src/components/workspace-composer/app-launchpad-model.ts`: 다수 정적 Badge
- `dwp-backend/dwp-platform-server/src/main/resources/db/migration/V26__create_workspace_runtime.sql`:
  별도 `usr_workspace_app_preferences.pinned`

## 2. Decision

DWP Workspace Home을 **Flow Home**으로 진화시킨다. 최종 핵심 정보 구조는 다음 순서를 사용한다.

```text
Tenant Workscape
  -> Compact Context + My App Dock
  -> Required/Critical notice rail (eligible일 때)
  -> Purpose Work Stage
       row 1: Action Queue 8 columns + first role/personal section 4 columns
       row 2 default: Requests 4 + Today 4 + Responses 4 columns
  -> News (normal communications, after work)
```

- `Tenant Workscape`: 회색화하지 않은 Tenant Media, 가독성 Scrim, Context와 Dock을 하나의 업무 시작 무대로 연결
- `Compact Context`: 날짜, 역할·대리 Context와 최근 성공 갱신 시각
- `My App Dock`: 사용자가 Home에 등록한 앱, 실데이터 알림, Folder와 즉시 실행. Desktop 기본 8개, Expressive Wide 최대 12개, Mobile 4개
- `Required/Critical notice rail`: 대상·기간 정책을 통과한 확인 필수·Critical 공지
- `Action Queue(우선 업무)`: 마감·승인·필수 확인 등 가장 중요한 현재 행동
- `Today(오늘)`: 오늘 일정과 업무 Event를 시간순으로 연결
- `Responses(응답할 일)`: 일정 초대, 확인 요청과 알림처럼 사용자의 응답이 필요한 항목
- `Requests(내 요청 현황)`: 서비스 요청·결재·업무 요청의 진행 상태
- `Role Pulse(업무 점검)`: 권한과 역할에 맞는 인사·활동·운영 신호
- `News(소식)`: 일반 사내 소식·Featured story·읽지 않음 요약

이 순서에서 `My App Dock`, 필수 Rail과 `Action Queue`는 예측 가능한 관리형 Zone으로 유지한다. Dock
내부 App·Folder는 사용자가 편집할 수 있고, `Today`, `Responses`, `Requests`, `Role Pulse`는 Tenant
정책이 허용한 범위에서 순서·표시·정보 예산을 개인화할 수 있다. 어떤 배치에서도 DOM·Keyboard·
Mobile 읽기 순서는 화면 순서와 같아야 한다.

12-column은 Visual Guide이며 저장은 기존 60-unit Grid의 `compact(20)`·`large(40)`를
사용한다. 기본은 `Action Queue=large`, 개인 목적 Widget은 `compact`다.
`>=1200px`에서 8+4와 4+4+4를 사용하고 좁은 화면·Mobile·실제 200% 글자 크기는 동일 DOM을
한 열로
Reflow한다. 같은 업무·공지·요청은 전역 Dedupe Key로 한 번만 표시하고 집계 수를 제공한다.

## 3. Single Vertical Scroll

`workspace-home`의 Flow Home은 **Document 하나만 세로 Scroll Owner**로 사용한다.

1. Home Widget과 App Dock 안에 `overflow-y: auto|scroll`을 두지 않는다.
2. Home Widget에서 `overscroll-behavior: contain|none`으로 문서 Scroll Chaining을 막지 않는다.
3. Widget 높이는 콘텐츠에 따라 확장한다.
4. 데이터가 많은 경우 내부 Scroll 대신 `상위 N개 + 총 건수 + 전체보기`를 제공한다.
5. `전체보기`는 동일 페이지의 숨은 대량 콘텐츠가 아니라 목적이 명확한 List·Timeline·Detail Route로
   이동한다.
6. Modal, Drawer, Command Palette처럼 문서와 다른 독립 Surface는 Focus Trap과 명시적 Scroll
   Region을 가질 수 있다. 이 예외를 Home Widget에 적용하지 않는다.
7. Mobile에서도 수직 Swipe를 Widget이 가로채지 않는다. App 목록은 Wrap·확장 또는 별도 전체 앱
   화면을 사용하며 Wheel을 가로 Scroll로 변환하지 않는다.

### 3.1 기존 ADR 대체 범위

이 결정은 `R1 Multi-Surface Personal Home Composer ADR.md` 6절의 다음 규칙을
`workspace-home`의 `FLOW_V1`에 한해 명시적으로 대체한다.

- 288·368·448·560px 고정 Block Size
- 콘텐츠 Overflow의 Widget 내부 Scroll

저장 Token `short|standard|tall|expanded`는 삭제하지 않는다. Flow Home 읽기 상태에서는 콘텐츠에
따라 자연 높이로 확장하되 `short|standard|tall`은 각각 최대 1·2·3개의 요약 행을 표시한다.
편집 상태에서는 배치 안정성과 사용자가 선택한 크기의 직접 피드백을 위해 168·232·304·384px의
정확한 콘텐츠 Footprint와 44px Editor Chrome을 사용한다. 높이를 낮추면 임의의 지표를 없애는 것이
아니라 목적 목록의 정보 예산만 단계적으로 줄이고 `+N`·`전체 보기`로 연속성을 보존한다. Classic
Home과 `hcm-home`, `approval-home`은 별도 승인 전까지 기존 계약을 유지한다.

## 4. Compatibility-first Preference

1차는 `usr_home_preferences` Schema v5, `layout.appLayout` v1과 기존 Widget Key를 유지한다.

그 이유는 다음과 같다.

- 기존 사용자의 순서·숨김·폭·높이·Folder를 보존한다.
- Classic과 Flow가 같은 Payload를 읽어 Feature Gate만으로 되돌릴 수 있다.
- Pixel 좌표와 실행 코드를 도입하지 않는다.
- 신규 Page Builder를 만들지 않고 검토된 React Registry를 공유한다.

Widget Key는 표시명이 아니라 Stable Technical ID다. Flow Home의 새로운 Label과 Composite Renderer는
기존 Key 위에 구현한다. 1차 배포에서 Key를 Rename하거나 기존 Preference Row를 자동 저장하지 않는다.

### 4.1 Home Dock Source of Truth

1차에서 Home Dock 등록·순서·Folder·숨김의 Source of Truth는 `layout.appLayout`이다.
`usr_workspace_app_preferences.pinned`, `last_used_at`, `launch_count`는 추가 제안의 근거로만 사용하고
사용자 승인 없이 Dock을 재배치하지 않는다.

2차에서 App Dock Domain Service로 통합하기 전까지 `홈에 추가`와 `즐겨찾기`를 별도 의미로
표현한다. Preference는 App 실행 권한이 아니며 Backend는 실행 시점에 App Catalog와 Entitlement를
다시 검사한다.

## 5. Bounded Personalization

DWP는 임의 좌표·HTML·CSS를 허용하는 자유 Canvas 대신 **제약된 높은 자유도**를 제공한다.

| Level | 범위             | 사용자 권한                                                         | 단계      |
| ----- | ---------------- | ------------------------------------------------------------------- | --------- |
| L0    | 조직 기본        | 관리형 필수 Zone·권한·App Catalog                                   | 기존·1차  |
| L1    | 기능 개인화      | App 추가·숨김·Folder, Widget 표시·숨김                              | 기존 유지 |
| L2    | 구조 개인화      | Widget 순서·승인 폭·콘텐츠 예산, 저장·취소·초기화                   | 1차 완성  |
| L3    | 선별 시각 개인화 | `balanced`, `expressive`, `focused`, Density·표면 Tone의 승인 Token | 1차 일부  |
| L4    | AI 제안          | 업무 스타일 기반 Layout Diff·설명·Preview                           | 2차       |

1차는 L2 전체와 기존 `presentation`을 활용한 일부 L3를 제공한다. 다음은 금지한다.

- 임의 Pixel `x/y/w/h`
- 사용자 HTML·JavaScript·CSS
- 무제한 배경·Font·색상
- 자동 움직임과 업무 의미를 바꾸는 표현 모드
- 사용자 승인 없는 AI 자동 저장·이동·삭제

### 5.1 편집 기능 보존

기존 동작을 제거하지 않는다.

- 명시적 `홈 편집` Button
- App·Widget Long Press 진입
- Pointer·Touch Drag
- Keyboard·Menu 기반 이동 대안
- Widget 추가·숨김·복원·승인 폭·콘텐츠 예산 변경
- App Folder 생성·이름 변경·해제
- 저장·취소·기본 구성 복원

1차는 Client Draft History 기반 Undo·Redo와 Desktop·Mobile Preview를 추가한다. 저장은 사용자가
확정할 때 한 번 수행한다.

## 6. Component Architecture

```text
HomeRoute
 ├─ FlowHomeVariantGate
 ├─ HomeDataCoordinator
 │   ├─ Home Overview
 │   ├─ Home Experience / Preference / Workspace Apps
 │   ├─ Notification App Summary
 │   └─ App Contribution Providers
 │       ├─ Work / Calendar / Activity / Approval
 │       └─ HCM / Employee Services / Workplace
 ├─ TenantWorkscape
 │   ├─ CompactContextRegion
 │   └─ MyAppDock
 ├─ RequiredCriticalNoticeRail
 ├─ WorkspaceWidgetCanvas
 │   ├─ ActionQueueRegion (governed)
 │   ├─ TodayRegion
 │   ├─ ResponseRegion
 │   ├─ RequestRegion
 │   └─ RolePulseRegion
 ├─ NewsRegion (governed trailing)
 └─ PersonalHomeComposerAdapter
```

`HomeDataCoordinator`는 원천 상태를 독립적으로 보존한다. Contribution Provider는 App별 권한,
Freshness, Redaction, Route와 Dedupe Key를 명시하고 정규화한 뒤 `ACTION|TIMELINE|RESPONSE|REQUEST|PULSE`
Bucket으로 합성한다. 동일한 결재·업무가 여러 원천이나 반복 응답에 나타나면 한 행과 Count로 집계한다.
개별 Query 실패는 다른 원천을 Blank 처리하지 않고 해당 Bucket을 `PARTIAL|UNAVAILABLE`과 Retry로
격리한다. `FORBIDDEN`은 권한 없는 콘텐츠를 빈 정상 상태로 위장하지 않으며 민감 제목·수치·원천 ID는
Contribution 경계를 넘기 전에 제거한다. Preference 실패는 읽기 전용 기본 Layout으로 수렴한다.

기존 MUI, Emotion, Lucide, DWP Design Token, TanStack Query, `dnd-kit`을 유지한다. Component
Library를 전면 교체하지 않으며 새 의존성은 기존 Stack으로 해결할 수 없는 검증된 Gap이 있을 때만
ADR을 추가한다.

## 7. Visual System

Flow Home v2는 `Calm Workstage / Soft Editorial` 방향을 DWP Token으로 구현한다.

- 깊은 Navy Tenant Workscape와 원색 Tenant Media, White Glass Dock, Neutral Canvas의 3단 구조
- Warm Pearl·Off-white는 본문 보조 Surface에만 사용
- DWP Cobalt·Cyan은 구조·상태·Focus 강조에 사용
- Coral은 실제 위험·마감 예외에만 사용
- 20~28px Radius는 주요 Region에 제한적으로 적용
- Glass·Blur·Elevation은 정보 계층을 설명할 때만 사용
- 배경의 빛 흐름은 Today Flowline 같은 데이터 관계를 설명할 때만 사용
- 장식용 Glow, Blob, 연속 Animation, Generic Card Soup 금지
- 모든 Chart는 Trend·비교·분포·임계치 목적과 Text·Table 대안을 가짐
- 일반 소식은 실제 Cover Asset이 있을 때만 Soft Editorial Surface에 사용
- Home 본문의 영구 Assistant Rail·우측 여백 금지, Global Header 진입점 사용
- Tenant Logo Load·Decode 실패 시 빈 Slot·Divider 제거 후 DWP Product Mark로 Fallback

Tenant 배경 Asset은 삭제하거나 회색화하지 않는다. `FLOW_V1`에서는 상단 `Tenant Workscape` 안에서
원색을 유지하고 이미지 초점 반대 방향의 Navy Scrim으로 문자 대비를 확보한다. 본문 전체 Wallpaper로
반복하지 않으며 이미지 실패 시 장식이 아니라 Theme 기반 Navy Surface로 수렴한다.

### 7.1 Shell ownership

- DWAI·ON 전체 앱은 Dock에서 실행할 수 있고, 빠른 질문 Launcher는 우측 하단 Fixed Safe Area를
  유지한다. Home 본문은 Assistant Rail 폭을 예약하지 않으며 Launcher는 문서 Scroll 위치에 따라
  움직이지 않는다. 사용자가 연 Assistant Layer만 독립 포커스·Scroll 계약을 가진다.
- `BrandLockup`은 Tenant Logo URL이 없거나 Load·Decode에 실패하면 실패한 Slot·Divider를
  제거하고 DWP Product Mark로 수렴한다. Branding Asset은 권한·Navigation의 근거가 아니다.

## 8. Tenant Variant와 Release Gate

Composition Policy를 Schema v3으로 확장한다.

```json
{
  "schemaVersion": 3,
  "experienceVariant": "CLASSIC",
  "personalCustomizationEnabled": true,
  "governedZones": []
}
```

실제 Variant는 두 Gate의 교집합이다.

```text
effectiveFlowHome =
  DWP_HOME_FLOW_ENABLED
  AND compositionPolicy.experienceVariant == FLOW_V1
```

- 환경 Kill Switch 기본값은 `false`
- Tenant Policy 기본값은 `CLASSIC`
- 누락·파손·미지원 값은 `CLASSIC`
- Tenant 게시·Rollback은 기존 Home Experience Revision과 Audit를 사용
- Provider Feature Rollout은 Runtime Service 평가 계약이 구현되기 전까지 사용하지 않음

## 9. App Notification Badge

정적 Badge를 제거하고 Notification Service의 사용자 Projection을 `owner_app_key`별로 집계한다.

```text
GET /api/notifications/v1/summary/by-app
```

Home App Registry는 `notificationSourceKey`를 명시하고 현재 Entitlement와 교집합한 Count만 표시한다.
Badge Model은 `totalUnread`, `actionableUnread`, `urgentUnread`, `intent`, `accessibleLabel`을
구조적으로 유지하고 `urgent > actionable > unread` 우선순위를 사용한다. Notification Partial은
성공한 App Count를 유지하며, 장애 Source를 정적 숫자나 오래된 숫자로 대체하지 않는다.

REST Query의 `staleTime`과 `refetchInterval`은 각각 30초다. Response `generatedAt`은
현재 기준 ±30초의 별도 Freshness Gate를 통과해야 한다. Notification 권한 없음,
최초 Load·Refetch 오류, Parse 불가, 오래된 성공 Cache에서는 Badge·Metadata 전체를
숨기고 Home Overview·정적 Count로 Fallback하지 않는다. Fresh·Healthy Partial에서만
성공 App Count를 유지한다.

Count 응답은 앱 Key와 `totalUnread|actionableUnread|urgentUnread`만 포함한다. 제목, 본문, User ID,
Notification·Thread ID는 Home으로 전달하지 않는다.

## 10. Security·Privacy

1. Frontend Audience와 Widget Visibility는 보안 통제가 아니다.
2. Work, Calendar, Communications, Activity, Notification, App Launch는 원천 서비스가 권한을
   재검사한다.
3. Preference에는 업무·메일·알림 본문, Prompt, Credential, 실행 코드를 저장하지 않는다.
4. Layout Audit는 Widget·App Key와 변경 전후 구조만 기록한다.
5. Product Telemetry에 User ID, 자유 Text, Folder명, 검색어, 업무 Object ID를 넣지 않는다.
6. AI는 Layout Diff를 제안할 수 있지만 사용자 Preview·승인 후에만 Preference API를 호출한다.
7. 권한을 잃은 App·Widget은 Runtime에서 제거하고 Preference를 권한 자료로 사용하지 않는다.

## 11. Accessibility

- Drag만으로 완료해야 하는 기능을 만들지 않는다.
- 이동 Menu와 Keyboard Move를 동일 결과로 제공한다.
- Long Press는 Shortcut이며 Button·Menu 진입을 항상 제공한다.
- DOM 순서, 시각 순서, Keyboard 탐색 순서, Mobile Reflow 순서를 일치시킨다.
- Visible Focus, 44px Target, Accessible Name, Tooltip을 제공한다.
- `prefers-reduced-motion`에서 Jiggle·Settle·Flow Motion을 제거한다.
- High Contrast에서 Blur·색상 없이도 구조와 상태를 구분한다.
- 실제 200% 글자 크기와 320px에서 수평·중첩 세로 Scroll을 만들지 않는다.
- Chart와 Flowline은 Color 외 Label·Pattern·Text 대안을 제공한다.

## 12. Observability와 SLO

현재 `dwp.home.overview.duration`, `dwp.home.section.degraded`, Browser CLS·INP·LCP를 재사용하고
다음을 추가한다.

- Variant Exposure
- Section별 Duration·Status
- Preference Save 성공·충돌·검증 실패
- Editor 진입 방법·저장·취소
- App Badge Load 상태
- App Launch 성공·실패
- Page Reach와 Widget 주요 Action

1차 Health Gate 목표:

| 지표                            | 목표         |
| ------------------------------- | ------------ |
| Preference Save 성공률          | `>= 99.5%`   |
| Home Overview p95               | `<= 1,000ms` |
| App Badge p95                   | `<= 300ms`   |
| INP p75                         | `<= 200ms`   |
| CLS p75                         | `<= 0.1`     |
| LCP p75                         | `<= 2.5s`    |
| Critical·Serious Axe Violation  | `0`          |
| Home 내부 세로 Scroll 위반      | `0`          |
| Classic↔Flow Layout Hash 불일치 | `0`          |

목표는 Pilot 시작 전에 SRE가 실제 Baseline과 함께 승인해야 한다.

## 13. Migration·Rollback

1차 배포 순서:

1. Policy v1~v3 Reader와 Classic 기본값
2. Additive Policy v3 Migration
3. Notification 앱별 Summary
4. OpenAPI·Frontend Client
5. Flow Component Dark Launch
6. 내부 Tenant `FLOW_V1`
7. Pilot·확대

`usr_home_preferences`는 Migration하지 않는다. Rollback은 Tenant Variant를 `CLASSIC`으로 게시하거나
`DWP_HOME_FLOW_ENABLED=false`로 변경한다. DB Down Migration, Preference Reset, Tenant Background
삭제를 하지 않는다.

## 14. 2차 확장

2차 Source는 다음 기능을 구현했다. 운영 활성화는 각 기능 Flag, Privacy·
Sharing·Retention·AI Eval·Rollout 승인을 통과해야 한다.

- 여러 개인 Home과 활성 Home 전환
- 개인 Version History·복원
- Tenant 공유 Template
- 기기별 고급 Layout Override
- Active Home View와 App Dock Layout 저장
- AI Workstyle Composer

`usr_home_views`, `usr_home_view_revisions`, `adm_home_templates`를 Additive 생성하고 기존 Preference를
`default` View로 Backfill하는 경로가 Source에 존재한다. Dual Read, Shadow Compare, Dual Write, Read
Switch 순서를 사용하며 안정화 전 기존 Store를 삭제하지 않는다.

## 15. Alternatives Considered

### A. 기존 Home 유지하고 Scroll Chaining만 수정

기각한다. 즉각적인 접근성 Bug는 줄지만 정보 우선순위, 정적 Badge, 장식 중심 Hero와 개인화 확장
문제를 해결하지 못한다.

### B. 자유 좌표 Page Builder

기각한다. Keyboard·Mobile 순서, 접근성, Upgrade, Support, Security와 Template Governance 비용이
과도하다.

### C. Preference Schema를 즉시 v6으로 전환

1차에서는 기각한다. 새로운 정보 구조는 기존 Key와 Token으로 제공 가능하며, 불필요한 데이터
Migration이 Rollback과 사용자 설정 보존 위험을 높인다.

### D. UI Component Stack 전면 교체

기각한다. 현재 MUI·Emotion·DWP Token·Storybook·Axe 기반은 재사용 가능하다. 문제는 Library
부족보다 Composition·Token 적용·콘텐츠 계약에 있다.

### E. Provider Feature Rollout을 Browser에서 직접 평가

기각한다. 현재 API가 관리자 권한 전용이고 Runtime 외부 실행이 비활성이다. 1차는 환경 Kill Switch와
감사 가능한 Tenant Policy를 사용한다.

## 16. Consequences

### Positive

- 사용자 Layout과 기존 편집 기능을 보존한다.
- Widget 위 Pointer 정지 후에도 문서 Scroll이 계속된다.
- 앱 알림이 실제 데이터 또는 명시적 비가용 상태가 된다.
- Classic으로 즉시 복귀할 수 있다.
- 높은 개인화 자유도를 접근성·보안·Upgrade 가능성과 함께 제공한다.

### Trade-offs

- 다중 Home·Version History·Template·AI Composer는 Source에 있어도 외부 정책·운영 승인 전에
  기본 활성화하지 않는다.
- 기존 Stable Widget Key와 새 표시 의미 사이의 Adapter가 필요하다.
- App Dock의 Home 등록과 Workspace 즐겨찾기는 Domain 통합 승인 전까지 별도 의미를 명확히
  설명해야 한다.
- Summary+전체보기 계약을 위해 각 Domain Owner의 협업이 필요하다.

## 17. Implementation evidence and restore boundary

2026-08-25 목적형 Home 재구성 단계에서 Frontend 전체 Vitest 97 files / 447 tests와 Contribution
Model·Provider 2 files / 22 tests, TypeScript, 대상 ESLint, Architecture·Route·Feature·API·Source-size·
Design System·i18n 검사를 통과했다. Backend는 Home Preference와 Personalization Migration 대상 Test를
통과했다. 최종 Chromium E2E·Visual Snapshot·Production Build 결과는 구현 결과 문서에 최신 실행값을
기록한다. 실기기·보조기술·사람·운영 승인은 별도 Gate다.

통합 E2E는 Mobile 상위 4개 Dock·첫 CTA, 개별 Source Freshness·시간 경과, 확인된
Required Rail 제거, Work-only Route, `UNAVAILABLE`·`FORBIDDEN` 의미 분리, Mobile Preview
실제 단일 열·Required Notice `priorityCompact`, Notification Badge 30초 Stale
transition과 `html font-size: 200%`를 포함한다.

이번 최종 재설계 직전 복원 지점은
`/Users/a10697/Work/DWP/.codex-restore-points/home-completion-before-20260825-125202-KST`다.
복원은 명시적 사용자 요청 후 현재 상태를 별도 보존하고 `MANIFEST.md`의 SHA-256을 다시
검증한 뒤 Source·`.git`·세 Database를 완전한 Capture 단위로 적용한다. 운영 회피는
Archive 복원보다 `CLASSIC`·Kill Switch를 우선하고 Preference Reset·Down Migration을 하지 않는다.

## 18. Approval Record

| 영역             | 승인자 | 상태 | Evidence                   |
| ---------------- | ------ | ---- | -------------------------- |
| Product          | 미지정 | 대기 | 범위·성공 지표             |
| Design           | 미지정 | 대기 | Figma·State·Responsive     |
| Architecture     | 미지정 | 대기 | 이 ADR                     |
| Platform         | 미지정 | 대기 | Policy·Preference·Overview |
| Notification     | 미지정 | 대기 | 앱별 Summary               |
| Security·Privacy | 미지정 | 대기 | Threat Model·Telemetry     |
| Accessibility·QA | 미지정 | 대기 | WCAG·E2E·Visual Evidence   |
| SRE              | 미지정 | 대기 | SLO·Alert·Rollback Drill   |

이 ADR은 Source 구현 완료와 자동 증거 Snapshot을 기록하지만 사람 승인·운영 활성화를
기록하지 않는다. 위 승인과 G3 Evidence가 모두 완료된 뒤 상태를 `Accepted`로 변경한다.
