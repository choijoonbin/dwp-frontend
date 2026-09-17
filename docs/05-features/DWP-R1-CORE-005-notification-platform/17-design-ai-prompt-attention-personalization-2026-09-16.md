# Design AI 전달 프롬프트: Attention Personalization

기준일: 2026-09-16

## 전달 순서

1. 기존 Stitch 01-14 결과물과 DWP Shell 캡처를 먼저 전달한다.
2. 아래 `Master Prompt`를 전달한다.
3. 화면 15~20을 번호 순서대로 생성한다.
4. Desktop 1440px을 먼저 검토한 뒤 Mobile 390px을 생성한다.
5. 정상 화면 승인 후 Empty/Loading/Error/Offline/Managed/Conflict 상태를 생성한다.
6. 최종 결과는 화면별 PNG와 Component/Token 설명을 함께 받는다.

기존 01-14를 다시 디자인하지 않는다. 이번 요청은 누락된 개인화·소음 제어를 확장하는 15-20
추가 세트다.

## Master Prompt

```text
[제품]
DWP는 여러 업무 앱을 통합하는 Enterprise Digital Workplace다. 이번 화면은 DWP 알림 제품의
Attention Personalization 고도화다. 기존 알림 홈, 알림 센터, 알림 설정, 관리자 정책/운영 화면을
유지하고 아래 기능을 자연스럽게 확장한다.

[목표]
사용자가 알림을 단순히 끄는 것이 아니라 어떤 사람, 대화, Project, 업무 객체와 주제를 중요하게
볼지 정하고, 현재 알림에서 즉시 Follow/Mute할 수 있게 한다. 관리자는 Mandatory 정책을 보존하면서
소음과 중복을 줄인다.

[제품 구조]
- 사용자 Sidebar는 알림 홈, 알림 센터, 알림 설정 3개를 유지한다.
- 중요 인물, 대화, Project, Topic을 별도 Sidebar 메뉴로 만들지 않는다.
- 알림 센터의 저장 보기와 알림 설정의 '관심 규칙' 설정군으로 제공한다.
- 관리자 Sidebar도 기존 운영 개요, 알림 계약, 정책 스튜디오, 템플릿 스튜디오, 전달 운영,
  전달 통제를 유지한다.

[핵심 도메인]
- Rule Scope: 앱·유형, 중요 인물, Thread/대화, Channel/Project/업무 객체, 승인된 Topic Token.
- Rule Effect: Follow, 우선 표시, Mute.
- Mandatory 회사 정책은 사용자가 끌 수 없고 잠금, 소유자, 이유를 보여준다.
- 저장 보기는 필터와 함께 Dense/Detailed, Grouping을 기억한다.
- '왜 이 알림을 받았나요?'에서 적용 규칙과 변경 가능한 설정으로 바로 이동한다.
- 시험 알림은 실제 업무 알림이나 KPI에 섞이지 않는다.

[시각 방향]
- 최신 협업 제품 수준으로 세련되고 빠르게 Scan 가능해야 한다.
- MZ 감성은 과장된 Gradient, 장식용 Blob, 대형 Hero가 아니라 정교한 밀도, 타이포 위계,
  Micro-interaction, 명확한 상태색으로 표현한다.
- 조용하고 전문적인 Enterprise UI를 유지한다.
- Card radius는 8px 이하. Page Section을 떠 있는 Card처럼 만들거나 Card 안에 Card를 중첩하지 않는다.
- Familiar Action은 Lucide Icon을 사용하고 낯선 Icon에는 Tooltip을 제공한다.
- 보라/파랑 단색 일변도 Palette를 피하고 긴급·Follow·Muted·Managed 상태를 의미색으로 구분한다.
- DWP 공통 Header/Sidebar/PageCanvas와 좌우 Gutter를 그대로 사용한다.
- 한국어 실무 문구와 현실적인 DWP 앱명(전자결재, 메신저, HR, Space, IT 서비스)을 사용한다.

[Responsive/Accessibility]
- Desktop 1440px과 Mobile 390px을 모두 만든다. 320px과 200% Zoom에서도 기능이 사라지면 안 된다.
- Desktop은 Keyboard Triage와 Master-detail을 유지한다.
- Mobile은 목록과 상세/Bottom Sheet를 한 번에 하나씩 보여준다.
- Focus ring, WCAG AA Contrast, Screen Reader Label, Reduced Motion을 명시한다.
- Hover만으로 제공되는 기능을 만들지 않는다.

[금지]
- 존재하지 않는 AI 점수, 승인율, 성공률을 운영 데이터처럼 만들지 않는다.
- Notification 앱이 전자결재 승인이나 HR 변경을 직접 소유하는 것처럼 표현하지 않는다.
- 민감 본문을 Keyword 검색하는 UI를 만들지 않는다. Topic은 Producer가 승인한 Token만 선택한다.
- 기능마다 Sidebar 메뉴를 추가하지 않는다.
```

## 화면 15: 알림 센터 개인화 작업대

```text
1440px Desktop 알림 센터를 설계한다.

- 기존 받은 알림/조치 필요/나를 멘션/저장됨/나중에/정리됨 보기를 유지한다.
- 보기 오른쪽에 Dense/Detailed Segmented Control을 배치한다.
- 저장 보기 Tab을 추가/재정렬할 수 있고 현재 보기는 '내 핵심 업무' 예시를 사용한다.
- Filter는 앱, 수신 이유, 우선순위, 읽음, 중요 인물, Context를 조합한다.
- 목록은 Dense와 Detailed의 차이가 분명하되 행 높이가 변할 때 Layout Shift가 없어야 한다.
- 상세 패널에는 수신 이유, 적용 규칙, 원천 이동, 읽음/저장/나중에/정리 Action을 둔다.
- 목록 3건과 상세 1건을 현실적인 DWP 데이터로 표시한다.
- Search/Filter 결과, 전체 수, 서버 집계 수를 혼동하지 않는다.
```

## 화면 16: 저장 보기 편집기

```text
Desktop Modal이 아닌 우측 Drawer 또는 단일 Dialog로 저장 보기 편집기를 설계한다.

- 이름, Dense/Detailed, Unread only, Grouping 없음/앱/Context.
- 포함 유형: 멘션, 직접 수신, Thread, 중요 인물, 업무 업데이트.
- 특정 앱, 사람, Project/Channel/업무 객체를 Searchable Multi-select로 선택한다.
- 적용 결과 예상 건수를 보여주되 실제 Query가 없으면 Skeleton/확인 필요 상태를 사용한다.
- 저장, 취소, 삭제, Tab 순서 변경을 제공한다.
- 최대 규칙 수와 회사 관리형 제한을 명확히 보여준다.
- Keyboard Focus Trap과 Error Summary를 포함한다.
```

## 화면 17: 현재 알림의 수신 제어

```text
Desktop Popover/Side Panel과 Mobile Bottom Sheet 두 버전을 만든다.

- 진입점: 알림 상세의 '왜 이 알림을 받았나요?'.
- 현재 이유: '김민서님이 직접 멘션했고 이 대화를 Follow 중입니다.'
- 가능한 Action: 이 대화 Follow, 이 Project 우선 표시, 김민서님을 중요 인물로 지정,
  이 알림 유형 Mute.
- 각 Action의 적용 범위, 예상 영향, 만료 선택(1일/1주/직접 지정/계속)을 보여준다.
- Mandatory 정책일 때 Mute를 Disabled하고 회사 정책 소유자와 이유를 표시한다.
- 저장 전 Preview, 저장 중, 409 충돌 후 최신 설정 Rebase, Offline 상태를 각각 설계한다.
```

## 화면 18: 알림 설정 - 관심 규칙

```text
1440px Desktop 알림 설정에 기존 채널/앱별 설정/집중 시간/표시/요약과 동급인 '관심 규칙' 설정군을
추가한다. 별도 Sidebar 메뉴는 만들지 않는다.

- 상단 요약: 중요 인물 수, Follow 중인 업무 수, Mute 규칙 수, Topic Watch 수.
- 섹션: 중요 인물, Follow 중인 대화·Project, Mute된 범위, 승인된 Topic Watch.
- 각 행에 Source, Scope, 효과, Channel, 만료, 관리 주체, 마지막 변경 시각을 표시한다.
- 추가/수정/삭제, 일시 중지, 만료 연장을 제공한다.
- 회사 관리형 규칙은 잠금과 Exception 가능 여부를 표시한다.
- 설정 검색과 '시험 알림 보내기'를 제공한다.
- 시험 알림 결과는 Banner, Preview Privacy, 연결 기기/브라우저 단계별 상태로 보여준다.
```

## 화면 19: 모바일 관심 규칙과 시험 알림

```text
390px Mobile 전용으로 설계한다.

- 핵심 상태 4개를 먼저 보여주고 긴 진단 정보는 Accordion으로 접는다.
- 관심 규칙은 Card 중첩 없이 단일 행 목록과 Filter Sheet를 사용한다.
- 중요 인물/Follow/Mute/Topic Tab은 가로 Overflow가 생기지 않도록 Select 또는 Bottom Sheet로 전환한다.
- 규칙 상세는 전체 화면 Sheet에서 Scope, 효과, Channel, 만료, 정책 잠금을 보여준다.
- 시험 알림은 1회 Action으로 실행하고 Rate Limit/Offline/Permission denied 상태를 명확히 보여준다.
- 화면 하단 고정 CTA가 콘텐츠를 가리지 않게 Safe Area를 확보한다.
```

## 화면 20: 관리자 소음 품질·관심 정책

```text
1440px 관리자 화면과 390px 조사 화면을 설계한다.

- 기존 운영 개요 안에 Noise Quality 영역을 추가하고 정책 편집은 기존 정책 스튜디오에서 연다.
- KPI: Mute rate, Duplicate collapse rate, Action conversion, Burst-risk users(익명 집계).
- 상위 Noisy Type 목록: 앱, Type, 발송량, Mute율, 중복 억제율, 전환율, Owner, Finding.
- Finding에서 계약/정책/템플릿/전달 통제로 정본 Deep Link한다.
- 정책 스튜디오는 허용 Scope, 사용자 Rule 상한, Topic Allowlist, Mandatory 우선순위,
  최소 집계 Privacy Threshold를 설정한다.
- Draft→영향 미리보기→독립 승인/반려의 4-eyes 절차를 유지한다.
- 소규모 집단은 Privacy Threshold로 수치를 숨기고 이유를 설명한다.
- 표를 모바일에 억지로 축소하지 말고 조사 Card와 상세 Sheet로 바꾼다.
```

## 상태 세트

각 화면에서 다음 상태를 별도 Frame 또는 Component Variant로 제공한다.

- 정상, Loading, Empty, Search no-result
- Partial source failure, Offline, SSE Polling fallback
- Permission revoked, Target deleted/expired/forbidden
- Managed locked, Rule limit reached, Version conflict
- Long Korean/English text, 200% Zoom, High contrast, Reduced motion
- 외부 Provider disabled, Endpoint expired, Test delivery rate-limited

## Design AI 산출물 수용 기준

- Frame 이름은 `NTF-15`부터 `NTF-20`으로 고정한다.
- 각 Frame에 Route, Persona, Primary Action, Data authority, Error state를 주석으로 남긴다.
- Desktop 1440px과 Mobile 390px의 대응 관계를 표로 제공한다.
- Color, spacing, radius, typography, focus, motion Token을 수치로 제공한다.
- 화면에 등장한 모든 Action은 `구현 가능`, `Owner API 필요`, `운영 Gate 필요` 중 하나로 표시한다.
- 승인 후 개발팀은 [Attention Rules 아키텍처](16-attention-rules-architecture-2026-09-16.md)의
  API와 정책을 벗어나는 Action을 임의 구현하지 않는다.
