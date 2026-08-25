# DWP-R1-CORE-007 AI Agent 계약

> 상태: `implemented / AI·Privacy·operation approval pending`
>
> 구현 상태: `proposal → explicit approval → apply → undo path implemented; default disabled`
>
> 적용 단계: 1차는 설명 가능한 추천 표시, 2차는 승인형 `AI Workstyle Composer`

## 1. 목적과 경계

Flow Home의 AI는 사용자의 화면을 몰래 바꾸는 자동 배치기가 아니다. 사용자가 지금 해야 할
업무와 다음 행동을 이해하도록 이유를 설명하고, 요청받은 경우에만 허용된 개인화 변경안을
제안한다. 권한·Tenant 정책·관리형 영역·필수 업무를 수정하거나 우회할 수 없다.

1차 경로는 기존 추천 데이터와 규칙 기반 우선순위를 화면에 안전하게 설명한다.
2차 `AI Workstyle Composer`의 제안 생성→Preview→명시 승인→Apply→Undo Source 경로는 구현했다.
아래 보안·Privacy·AI Eval·운영 승인 전에는 Flag 기본값 `false`로 비활성
상태를 유지한다.

## 2. 허용 범위

### 2.1 1차

- 서버가 제공한 추천 이유, 원천, 최신성과 정책 버전을 `Next`에 표시
- 사용자의 `관련 없음`, `숨기기`, `같은 유형 줄이기` 피드백 수집
- 긴 업무 목록의 권한 범위 내 요약. 원본 항목과 전체 보기 경로를 함께 제공
- Loading, Partial, Stale, Unavailable 상태에서 일반 홈 기능을 방해하지 않는 축소 표시

### 2.2 2차

- 사용자가 명시적으로 요청한 업무 스타일 진단
- 등록된 Widget, 허용된 순서·너비·표현 밀도 안에서 Layout 변경안 생성
- 개인 Home Profile 또는 승인된 Team Template의 초안 제안
- 변경 이유, 영향받는 영역과 되돌리기 방법 설명

## 3. 금지

- 사용자의 요청과 승인 없이 App, Widget, Folder 또는 Home Profile을 생성·이동·숨김
- 관리형 공지, `My App Dock`, 핵심 `Now` Zone 또는 정책 잠금 항목의 위치·표시 변경
- Entitlement 확대, Route Guard 우회, 권한 밖 App·업무명·수치의 조회 또는 노출
- 임의 HTML, CSS, JavaScript, 외부 URL이나 등록되지 않은 Widget 생성
- 개인 성과 평가, 감정·건강 상태 추론 또는 과도한 행동 감시를 개인화 입력으로 사용
- 승인되지 않은 Tenant Presentation·Theme·배경 게시
- Preview와 Diff 없이 Preference API 호출
- 사용자가 거부한 제안을 같은 근거로 반복 노출

## 4. 제안 실행 상태 머신

```text
IDLE
  -> REQUESTED
  -> POLICY_VALIDATED
  -> DRAFTED
  -> PREVIEWED
  -> APPROVED
  -> APPLIED
  -> UNDO_AVAILABLE

REQUESTED | POLICY_VALIDATED | DRAFTED | PREVIEWED
  -> CANCELLED

POLICY_VALIDATED | DRAFTED | APPLIED
  -> FAILED

APPLIED
  -> UNDONE
```

- `REQUESTED`는 사용자의 버튼·명령·대화 입력으로만 시작한다.
- `POLICY_VALIDATED`에서 현재 Entitlement, Composition Policy, Registry와 Preference Version을
  서버가 다시 확인한다.
- `PREVIEWED`는 적용 전 화면, 변경 목록, 근거와 잠금 항목을 함께 보여준다.
- `APPROVED`는 이 제안 Revision에 대한 명시적 단일 사용 승인이다. 재사용할 수 없다.
- `APPLIED`는 기존 Preference 낙관적 잠금과 감사 계약을 통과한 경우에만 성립한다.
- `UNDO_AVAILABLE`은 적용 직후와 Revision History에서 접근할 수 있다.

## 5. 입출력 계약

AI 입력은 표시 문구가 아니라 최소화된 구조화 Context를 사용한다.

```json
{
  "surfaceKey": "workspace-home",
  "preferenceVersion": 12,
  "compositionPolicyVersion": 3,
  "allowedWidgetKeys": ["focus", "schedule", "activity"],
  "lockedZoneKeys": ["my-app-dock", "required-announcements", "now"],
  "currentLayout": {
    "presentation": "balanced",
    "widgets": []
  },
  "signals": {
    "frequentAppKeys": ["approvals", "calendar"],
    "dismissedRecommendationTypes": []
  }
}
```

업무 제목·메일 본문·공지 원문·사용자 이름·Email은 Layout 제안 입력에 포함하지 않는다.

제안 결과는 실행 명령이 아니라 검증 가능한 Patch 초안이다.

```json
{
  "proposalId": "uuid",
  "basePreferenceVersion": 12,
  "reasonCodes": ["FREQUENT_APPROVAL_WORK", "LOW_SIGNAL_USAGE"],
  "changes": [
    {
      "operation": "MOVE_WIDGET",
      "widgetKey": "schedule",
      "beforeIndex": 3,
      "afterIndex": 2
    }
  ],
  "warnings": [],
  "expiresAt": "2026-08-21T02:00:00Z"
}
```

허용 `operation`은 `MOVE_WIDGET`, `SHOW_WIDGET`, `HIDE_WIDGET`, `SET_WIDTH`,
`SET_DENSITY`, `PIN_APP`, `UNPIN_APP`로 제한한다. Phase 1에서는 이 Patch를 생성·실행하지
않고 Phase 2 Feature Flag 아래에서만 허용한다.

## 6. 검증과 권한

- AI Runtime은 Preference를 직접 쓰지 않는다. Platform Home Service가 제안 Patch를 현재
  Registry·Entitlement·Policy·Version에 대해 다시 검증한 뒤 적용한다.
- Proposal의 Tenant와 Actor는 Session에서 결정하며 Client Assertion을 신뢰하지 않는다.
- `409`가 발생하면 기존 제안을 폐기하고 최신 구성과의 새 Diff를 만든다.
- 관리형 Zone, 미등록 Widget, 허용되지 않은 Size·Density, 권한 밖 App이 포함된 제안은
  전체를 거부한다.
- Apply와 Undo는 기존 Preference Audit에 `proposalId`, `reasonCodes`, `changeCount`만 남긴다.
  프롬프트와 업무 원문은 감사 Event에 저장하지 않는다.

## 7. 설명·피드백 UX

- 모든 추천은 `왜 표시되었나요`를 제공한다.
- 근거는 `마감`, `업무 차단`, `명시적 Pin`, `최근 사용`처럼 사용자가 이해할 수 있는
  Reason Code로 번역한다.
- 생성형 설명과 원천 데이터는 시각적으로 구분한다.
- `관련 없음`, `숨기기`, `같은 유형 줄이기`를 제공하고 즉시 반영 결과를 알린다.
- AI가 응답하지 않아도 `My App Dock`, `Now`, `Flowline`, `Work Signals`와 일반 편집은
  정상 동작해야 한다.

## 8. 관측·개인정보

Phase 1의 Canonical 허용 목록은 `assets/home-analytics-event.schema.json`이다. 추천과 직접 관련된
Event는 `home.recommendation_feedback`이며, 설명 열기는 `home.action_opened`와 `sectionKey=next`로
측정한다. 허용 속성도 해당 Schema의 Enum·Bucket과 `changeCount`, `occurredAt`으로 제한한다.

다음 Composer Event는 Phase 2 예약명이며 **현재 허용 목록이나 Runtime 수집 계약이 아니다**.

- `home.composer_proposal_created`
- `home.composer_proposal_previewed`
- `home.composer_proposal_applied`
- `home.composer_proposal_undone`
- `home.composer_proposal_rejected`

Phase 2 진입 전에 Event Schema Version을 올리고 `reasonCode`, `feedbackType`, `outcome`,
`modelRoute`의 관리형 Enum을 Security·Privacy와 승인한다. 사용자 ID, 제목·본문, Folder 이름,
검색어, 프롬프트 원문과 자유 형식 Tenant 문자열은 Metric Dimension으로 수집하지 않는다.

## 9. 평가 Gate

- 권한 밖 App·업무·Widget 노출 0건
- 잠금 Zone 변경 제안 0건
- Preview와 실제 적용 Diff 불일치 0건
- 승인 없는 Apply 0건
- Undo 성공률 99% 이상
- 동일 거부 근거 재추천 0건
- 설명의 Reason Code·원천 Coverage 100%
- AI 장애 시 비-AI Home Journey 성공률 100%
- 한국어·영문 긴 설명, Screen Reader, Reduced Motion과 320px에서 핵심 의미 보존

이 Gate와 보안·Privacy·AI Owner 승인이 모두 완료되기 전에는 Phase 2 Composer Flag를
활성화하지 않는다.
