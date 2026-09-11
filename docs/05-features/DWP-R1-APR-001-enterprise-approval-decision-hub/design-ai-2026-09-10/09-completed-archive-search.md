# 09. 내 처리 완료·완료 보관·감사 검색

화면 ID: `APR-09` · 경로: `/approvals/completed`, `/approvals/requests/archive` · 우선순위: D2

## Design AI에 전달할 원문

당신은 규제·감사 환경의 의사결정 이력을 빠르게 재탐색하는 화면을 설계하는 시니어 Product
Designer다. DWP 전자결재의 `내 처리 완료함`과 `완료 보관함`을 서로 다른 소유 의미를 유지한
채 일관된 read-only 경험으로 고도화하라. 디자인과 상호작용 명세만 반환한다.

DWP shell, 전자결재 사이드바, Product Surface 권한과 실제 task/request API를 유지한다.
별도 문서관리시스템이나 전사 감사 플랫폼을 만들지 않는다.

### 두 화면의 차이

- `내 처리 완료함` `/approvals/completed`: 내가 실제 결정 actor였던 Task와 당시 결정 증적.
- `완료 보관함` `/approvals/requests/archive`: 내가 소유한 요청 중 승인·반려·회수·취소된 문서.

두 목록을 `완료 문서` 하나로 합치지 않는다. 첫 화면은 “내가 어떤 판단을 했는가”, 두 번째는
“내 요청이 어떻게 끝났는가”에 답한다.

### 사용자·권한·행동

- 사용자: 자신의 결정 증적 또는 자신의 요청을 볼 수 있는 구성원.
- 주 행동: 기록 선택→read-only 상세 확인.
- 보조 행동: 조건 검색·filter·원업무/관련 요청 이동. export는 계약이 있을 때만.
- 과거에 결재했다고 현재 제한 본문을 항상 읽을 권리가 생기지 않는다. content permission과
  retention 상태를 다시 확인한다.

### 1440px 구조

1. 화면 목적, 기간/상태/양식/결정 검색, 결과 수와 기준 시각.
2. 안정된 list-detail: 결정/완료 시각, 번호·제목, 역할/대표 행위, outcome, workflow/form,
   data classification, 보존 상태.
3. detail은 당시 version의 form label·payload, 단계, 결정 사유, actor/delegation, immutable
   timeline을 read-only로 제공한다.
4. 현재 업무 상태와 당시 결정 증적을 구분한다. 이후 취소/대체된 요청이면 그 관계를 실제
   데이터가 있을 때만 표시한다.
5. mutable action footer를 만들지 않는다. 필요한 경우 `관련 요청 보기`, `원업무 열기`만 제공한다.

### 검색·saved view·export

현재 목록 API는 server cursor와 고급 검색을 보장하지 않는다. 기본 client filter는
`EXISTING/REDESIGN_ONLY`, 다음은 `CONTRACT_FIRST`다.

- cursor, stable sort, date range, workflow/form/outcome/actor/delegation filter
- PERSONAL saved view의 schema/version/scope/concurrency
- 감사 export job, classification redaction, reason, expiry, download audit
- retention/legal hold와 export eligibility

Design AI는 목표 화면을 제안할 수 있지만 활성 download 버튼이나 가짜 결과 수를 current
frame에 넣지 않는다.

### 필수 상태

- 두 화면 각각 populated/실제 empty/search empty
- detail loading/부분 실패
- content permission 없음: metadata는 허용 범위만, payload redacted
- retention 만료/삭제 예정/legal hold 목표
- delegated decision과 원 actor
- 긴 기간·많은 결과의 cursor 목표
- export 요청/생성 중/실패/만료 목표
- 403 scope 회수, 503 audit source unavailable

### 모바일·접근성

- 390px에서 list→full read-only detail. 표를 가로 축소하지 않는다.
- filter는 sheet, 적용 조건 수와 초기화 행동을 명시한다.
- outcome, actor, time, step을 색 외 텍스트로 제공한다.
- timeline은 의미 순서와 heading을 갖고 screen reader가 중복 장식을 읽지 않게 한다.
- detail back 후 row focus/scroll을 복원하고 권한 회수 시 안전한 heading으로 이동한다.
- 320px/200%, dark/forced colors, 긴 제목/ID/timezone을 포함한다.

### 반환물·실패 기준

두 route의 1440 정상과 390 모바일, search empty, redacted, delegated, retention/export 목표를
제출한다. current와 contract-first를 분리하고 각 field의 source/permission을 주석으로 표시한다.

내 결정과 내 요청을 합치거나, completed 화면에 approve/reject를 다시 제공하거나, content
권한 없이 과거 payload를 노출하거나, 실제 export job 없이 즉시 다운로드를 그리면 실패다.
