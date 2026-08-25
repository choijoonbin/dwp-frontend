# 0003. 제약형 개인화와 AI Layout 제안

- 상태: Proposed
- 기준일: 2026-08-21
- 적용 Surface: `workspace-home`
- 승인: Product·Security·Privacy·AI 승인 대기

## Context

사용자는 자기 업무 방식에 맞게 Home을 꾸미고 싶어 하며 기존 Home도 앱·Widget 편집을 제공한다.
자유도를 늘리되 권한, 필수 공지, 반응형 읽기 순서, 접근성, 성능과 지원 가능성을 잃지 않아야
한다. AI 개인화도 사용자의 환경을 예고 없이 바꾸거나 과도한 행동 감시로 이어져서는 안 된다.

## Decision

개인화를 다섯 계층으로 분리한다. 상위 계층은 하위 계층이 덮어쓸 수 없다.

| Level          | 소유자              | 범위                                          | 사용자 제어         | 단계      |
| -------------- | ------------------- | --------------------------------------------- | ------------------- | --------- |
| L0 조직 기본   | Tenant·Policy Owner | Entitlement, 필수 Zone, 기본 App·Widget, 제한 | 읽기·정책 확인      | 공통      |
| L1 기능        | 사용자              | Pin, Hide, Folder, 앱·Widget 표시             | 즉시 편집·초기화    | 기존 유지 |
| L2 구조        | 사용자              | 개인 Zone 순서, 승인 너비·정보 예산·표시 조합 | Drag·Menu·Keyboard  | 1차 전체  |
| L3 시각        | 사용자              | 승인된 Density·Surface·Accent Preset          | Preview 후 적용     | 1차 선택  |
| L4 지능형 제안 | AI + 사용자         | 사용 맥락에 맞는 Registry 조합 제안           | Diff 승인·거부·Undo | 2차       |

계산 우선순위는 `Security·Entitlement → Tenant·Governed Policy → 사용자 Preference → 현재
업무 Context → AI 제안`이다.

`My App Dock`의 상단 위치, 관리형 공지와 `Now`의 우선 위치는 L2 대상이 아니다. 사용자는 Dock
안의 App·Folder와 Tenant가 개인화 가능으로 등록한 `Today Flowline`, `Work Signals`, `Next` 및
추가 Widget만 편집한다.

## 기존 편집 기능 보존

- `홈 화면 편집` 버튼을 기본 진입점으로 제공한다.
- Widget 또는 Dock Long Press는 익숙한 보조 Shortcut으로 유지한다.
- Pointer·Touch Drag로 순서를 이동할 수 있다.
- 동일한 결과를 만드는 이동 메뉴·Keyboard·단일 Pointer 조작을 제공한다.
- 앱 Folder 생성·이름 변경·해제와 Pin·Hide·복원을 유지한다.
- Widget 표시·숨김, 승인 크기, 저장·취소·Tenant 기본값 복원을 유지한다.
- 1차에서 Undo·Redo와 Desktop·Mobile Preview를 추가한다.
- 읽기 Mode에서는 Drag Handle과 편집 Control을 숨긴다.

## 저장 계약

- 저장 대상은 Registry ID, 순서, 표시 여부, 승인된 의미 크기·정보 예산, Folder와 Preset Key다.
- 임의 `x/y`, Pixel 크기, HTML, JavaScript, CSS, Prompt와 업무 본문을 저장하지 않는다.
- 서버는 Surface·Widget·App·Size·Preset Allowlist, Payload 크기와 Version을 검증한다.
- Entitlement가 회수된 항목은 렌더링·실행에서 제거한다. 정책에 따라 Preference의 비활성 참조를
  보존하더라도 권한 자료로 사용하지 않는다.
- 조직이 잠근 Widget과 관리형 공지는 숨김·이동·크기 변경 대상이 아니다.
- 저장 충돌은 `409`와 Diff·Reload 선택을 제공하며 조용히 덮어쓰지 않는다.
- 1차는 현행 Preference와의 무손실 Reconcile을 우선하고 파괴적 Migration을 요구하지 않는다.
  복수 Home·Device Overlay·Version History는 2차 Schema와 Rollback을 별도 승인한다.

## AI 제안 계약

AI는 Registry에 등록된 Component와 승인 Token만 조합한 `Suggestion Plan`을 만든다.

필수 표시:

- 제안 이유와 사용한 Source 범주
- 현재 Layout과 제안 Layout의 추가·이동·숨김·표현 변경 Diff
- Desktop·Mobile Preview와 영향받는 관리형·개인형 구분
- 적용, 항목별 수정, 거부와 같은 유형 제안 줄이기
- 적용 후 즉시 Undo와 Version History Reference
- 누락 Source·불확실성·정책상 변경할 수 없는 항목

금지:

- 사용자 승인 없는 적용·게시·저장
- Entitlement 확대, 필수 공지 숨김, 관리형 Zone 이동
- 임의 UI Code·외부 Widget 생성
- 개인 성과 평가, 감정·건강 추론과 과도한 행동 감시를 개인화 입력으로 사용
- 클릭률만으로 성공을 판단하거나 거부 이력을 숨김

AI 제안은 결정적 Editor와 동일한 서버 검증, 낙관적 잠금, 감사와 Rollback 경로를 사용한다.

## Phase 1

- L0·L1 기존 계약 보존
- L2 전체: Widget·App의 승인 구조 편집
- L3 선택: `balanced`, `focused`, `expressive`와 승인된 Soft Aurora 표현 Token
- Undo·Redo, Device Preview, Keyboard·Menu 대체
- 조직 기본과 개인 변경 Diff, Reset 영향 Preview

## Phase 2

- 목적별 복수 개인 Home
- Widget별 고급 콘텐츠·안전한 Filter Preset
- 소유권·회수 계약이 있는 공유 Template
- Device별 고급 Layout Overlay
- 불변 Version History·비교·복원
- Eval Gate를 통과한 AI Workstyle Composer

## Consequences

- 사용자는 높은 체감 자유도를 얻지만 제품은 테스트 가능한 Layout·접근성·권한 경계를 유지한다.
- 신규 Preset·Widget·AI 제안 유형마다 Registry, Figma, Contract와 Test 승인이 필요하다.
- Device별·복수 Home은 단순 Payload 필드 추가가 아니라 수명주기·충돌·공유·복원 설계가 필요하다.
- AI는 편집기를 대체하지 않고 설명 가능한 제안 계층이 된다.

## Rejected Alternatives

- 완전 자유 Canvas: 반응형·Keyboard 순서·지원·Migration 비용이 과도하다.
- Theme Marketplace: Brand·License·보안·접근성 통제가 불명확하다.
- 사용량 기반 자동 재배치: 예측 가능성과 사용자 소유감을 훼손한다.
- 기존 편집 기능 제거 후 AI만 제공: 명시적 사용자 통제와 장애 시 복구 경로가 사라진다.
