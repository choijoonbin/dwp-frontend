# 11. 전자결재 관리 홈

화면 ID: `APR-11` · 경로: `/approvals/admin/overview` · 우선순위: D2

## Design AI에 전달할 원문

당신은 규제된 workflow 운영을 위한 관리자 cockpit을 설계하는 시니어 Product Designer다.
DWP 전자결재의 관리 홈을 예외 발견→영향 이해→권한 있는 관리 화면으로 이동하는 조용하고
밀도 높은 화면으로 고도화하라. 개인 전자결재 홈과 별도 Surface다.

DWP 글로벌 shell은 유지하되 관리자 전용 제품 사이드바와 현재 관리 scope/read-only 상태를
명확히 한다. 관리자라는 이유로 사용자 요청 본문을 자동 열람하게 만들지 않는다. 디자인 명세만
반환한다.

### 사용자·권한·목적

- 사용자: Approval Designer, Publisher, Operator, Auditor 중 실제 VIEW 권한이 있는 사람.
- 질문: “현재 어떤 통제·자산·업무 예외가 있으며 어디서 먼저 조사해야 하는가?”
- 주 행동: workflows/forms/policies/operations 중 허용된 화면으로 이동.
- archetype: exception-led admin overview, not a BI landing page.

### 현재 API

현재 overview는 published/draft workflows, active requests, overdue tasks, failed integrations와
identity/segregation/evidence/delivery assurance state+exception count를 제공한다. 단일 snapshot에
없는 시계열·성공률·용량 예측을 만들지 않는다.

### 1440px 구조

1. 상단: `전자결재 관리`, 현재 tenant/scope, 생성 시각, 데이터 신선도, read-only 여부.
2. compact operational signals: 게시 Workflow, draft, active requests, overdue, failed delivery.
   값·범위·기준 시각을 함께 표시하고 숫자만 큰 카드로 만들지 않는다.
3. `확인할 예외`: overdue/failed/assurance attention을 영향·심각도·건수·다음 화면과 연결한다.
4. `통제 모델`: Designer/Publisher/Operator/Auditor 책임과 현재 사용자의 허용 action을 보여 준다.
5. `assurance`: identity, segregation, evidence, delivery의 ENFORCED/ATTENTION. `ENFORCED`를
   production release 전체 승인으로 표현하지 않는다.
6. 자산 현황은 Form/Workflow/Policy의 draft→review→published 병목을 실제 API가 제공할 때만
   보여 준다. 현 API 밖의 trend는 `CONTRACT_FIRST`.

### 권한 분리

- Designer는 edit, Publisher는 독립 publish, Operator는 recovery, Auditor는 read-only.
- 한 화면에 모든 CTA를 disabled로 나열하지 말고 사용자에게 허용된 조사 경로만 제시한다.
- 관리 메뉴 권한이 회수되면 현재 데이터·deep link·shortcut을 즉시 제거한다.
- 개인 사용자의 payload·decision comment는 별도 content permission 없이 요약에도 넣지 않는다.

### 필수 상태

- 정상: 예외 2~3개
- healthy처럼 보이나 외부 production gate는 blocked인 상태
- 실제 0 exceptions
- overview loading/error
- metrics 성공 + assurance 실패 partial
- stale 생성 시각/재조회
- read-only auditor
- 한 관리 기능만 허용된 persona
- scope/tenant 전환과 403 회수
- 긴 숫자/긴 영어 assurance title

### 행동·전이

- signal 선택 → 정확한 admin route와 filter/target을 전달한다. 허용되지 않으면 shortcut 자체를
  제공하지 않는다.
- refresh → 기존 데이터의 stale 여부를 표시하고 실패를 0으로 덮지 않는다.
- partial → 성공 영역은 유지, 실패 영역은 누락 가능성과 재시도 제공.
- external gate → readiness/detail로 연결하되 `해결됨`으로 표시하지 않는다.

### 모바일·접근성

- 390px는 예외→assurance→자산 순으로 한 column. 5개 KPI를 작은 가로 scroller로 만들지 않는다.
- 320px/200%에서 signal 값/label/detail/action이 겹치지 않는다.
- metric과 status에 접근 이름·범위·시각을 포함하고 색만으로 상태를 전달하지 않는다.
- partial update는 status, critical failure는 alert. 자동 refresh가 focus/읽기 위치를 바꾸지 않는다.
- keyboard로 signal→target 이동 후 뒤로 돌아오면 원 signal focus를 복원한다.

### 반환물·실패 기준

1440 정상/partial/read-only, 390 모바일, stale/403/empty를 제출한다. persona별 CTA visibility와
route mapping, data freshness를 주석으로 표시한다.

개인 홈과 합치거나, snapshot으로 가짜 7일 trend를 만들거나, assurance ENFORCED를 release GO로
표시하거나, 운영자에게 설계/게시 CTA를 주면 실패다.
