# 02. 결재함 Action Center

화면 ID: `APR-02` · 경로: `/approvals/inbox` · 우선순위: D1

## Design AI에 전달할 원문

당신은 고빈도 엔터프라이즈 업무함을 설계하는 시니어 Product Designer다. DWP 전자결재의
검토 대기 업무를 페이지 이동 없이 빠르게 읽고 처리하는 split-pane action center로
고도화하라. 코드가 아니라 전체 화면·상태·상호작용 명세를 반환한다.

DWP 글로벌 헤더와 제품 사이드바, 현재 React/MUI design-system을 유지한다. 별도 Next.js
shell, Tailwind 전용 UI, 새 전역 navigation을 만들지 않는다. 참고 `Approval Command Center`
화면의 밀도와 list-detail 리듬은 수용하되 DWP의 실제 데이터와 권한 계약에 맞춘다.

### 목적·사용자·권한

- 사용자: Task `VIEW` 권한이 있는 직접 후보, claim 가능한 그룹 후보, 유효한 대리인.
- 질문: “지금 어떤 결재를 어떤 근거로 먼저 판단해야 하는가?”
- 주 행동: Task 선택 후 검토; 권한과 최신 version이 확인된 경우만 claim/결정.
- archetype: global sidebar + queue list + flexible detail pane.
- Task 조회, claim, decision은 각각 다른 capability다. VIEW가 있다고 결정 버튼을 열지 않는다.

### 사이드바 계약

`결재함`은 disclosure 가능한 상위 메뉴다. 클릭하면 아래 4개 하위 메뉴를 펼치고, 다시 클릭하면
접는다. 현재 선택은 접어도 route에서 유지한다.

- 전체 대기: `queue=ALL`
- 긴급 결재: `queue=URGENT`
- 오늘 마감: `queue=DUE_TODAY`
- 고위험: `queue=HIGH_RISK`

하위 메뉴는 홈 본문, inbox 본문의 별도 왼쪽 rail, 상단 tab에 중복하지 않는다. 선택한 큐의
건수는 권위 조회 성공 시만 표시하며 실패 시 0으로 내리지 않는다.

### 1440px 구성

1. 본문 상단에 페이지 제목, 현재 큐 이름·건수·생성 시각, 검색, 간결한 filter/sort, 새로고침을
   둔다.
2. 목록 pane은 안정적인 360~440px 범위다. 행에는 checkbox, 번호, 제목, 요청자/조직,
   workflow·현재 단계, 기한, priority, risk, delegated/claimed 상태를 우선순위에 따라 배치한다.
3. checkbox와 행 선택을 분리한다. checkbox는 batch, 행 본문은 detail 선택이다.
4. 선택 행은 색만이 아니라 경계/아이콘/`aria-selected`로 구분한다.
5. detail pane은 남은 폭을 사용하고 자체 header·본문·sticky action footer를 가진다. 세부 anatomy는
   APR-03 계약을 따른다.
6. 검색 0건, 전체 0건, 권한 오류, 네트워크 실패를 서로 다른 화면으로 만든다.
7. 첫 화면에 독립된 `결재 워크플로` 메뉴 카드나 또 다른 사이드바를 만들지 않는다.

### 검색·필터·저장 보기

현재 구현은 client search와 4개 queue를 제공한다. 이를 `EXISTING`으로 설계한다. server cursor,
복합 filter, 개인 saved view는 `CONTRACT_FIRST`다. 목표 프레임을 제안할 수 있으나 현재 정상
화면의 활성 기능으로 표시하지 않는다.

saved view 목표에는 PERSONAL scope, schema/version, 이름 충돌, 권한 회수, 지원 종료 filter,
동시 수정, URL과 동일한 재현 가능한 조건이 필요하다. localStorage만 사용하면서 여러 기기
동기화를 주장하지 않는다.

### batch 계약

- 최대 20건 선택은 현재 기능이다.
- batch CTA에는 선택 수, 실제 처리 가능 수, 제외 수를 구분한다.
- 실행 직전에 각 Task의 권한·상태·version을 다시 확인한다.
- 서로 다른 결과를 전체 성공 toast 하나로 덮지 않는다. 성공/실패/건너뜀/충돌을 항목별로
  보여 주고 실패한 항목의 입력·선택을 보존한다.
- 위험 등급이나 제목만 같다는 이유로 동일 결정이 안전하다고 가정하지 않는다.
- batch selection이 detail selection을 바꾸지 않는다.

### 상태 전이

- 큐 전환 → URL query 갱신 → 목록 재검증 → 선택이 새 목록에 있으면 유지, 없으면 desktop은
  첫 항목/모바일은 목록으로 복귀.
- Task 선택 → URL의 task와 detail을 일치시키고 loading 중 이전 민감 detail/CTA를 제거.
- claim 성공 → 같은 Task의 최신 detail/version으로 수렴.
- 403/503/409 → 열린 확인 dialog를 닫고 stale decision을 전송하지 않음.
- 결정 성공 → 처리 결과를 알리고 다음 논리적 행을 선택하되 원래 focus 위치를 예측 가능하게
  복원.
- 자정 경계 → `오늘 마감` 건수와 목록을 같은 기준 시각으로 갱신.

### 필수 상태 프레임

- 정상 list-detail
- no selection
- 전체 실제 empty
- search/filter empty
- 목록 loading / detail loading
- 목록 실패 / detail만 실패 / partial source failure
- offline/503 stale read-only
- 403 권한 회수와 민감 상세 제거
- 409 다른 사용자가 이미 결정
- batch 선택, 사전 검증, 부분 결과
- 1000건 이상을 가정한 cursor/virtualization `CONTRACT_FIRST` 목표
- 긴 제목·긴 조직명·기한 없음·위임/claim 동시 표기

### 390px·접근성

- 모바일은 목록과 상세를 동시에 축소하지 않는다. 목록→전체 상세→결정→동일 행 focus 복귀의
  drill-in 구조로 만든다.
- queue는 기존 사이드 drawer의 결재함 하위 메뉴를 사용하고 본문 상단에는 현재 큐와 filter
  trigger만 둔다.
- selection mode에서 checkbox 44px target, 전체 선택 범위와 최대값을 명료하게 표시한다.
- keyboard: 상위 menu disclosure의 `aria-expanded`, 목록의 roving 또는 일관된 Tab 전략,
  선택 후 detail heading focus, 뒤로 시 원 행 focus 복원.
- 200% 확대/320px에서 page 가로 overflow, 중첩 가로 scroll, 가려진 sticky footer가 없어야 한다.
- 상태 변화는 screen reader에 요약하되 매 clock tick을 낭독하지 않는다.

### 반환물·실패 기준

1440 정상, 390 모바일, batch 전후, 목록/상세 실패, 권한 회수, 409, long-content를 제출한다.
각 프레임에 데이터 신선도, 권한 전제, component anatomy, focus/scroll rules, 구현 분류를
표시한다.

하위 큐를 홈 본문이나 inbox의 고정 보조 메뉴로 복제하거나, checkbox 클릭이 상세까지 바꾸거나,
stale detail로 decision을 허용하거나, batch를 all-or-nothing 성공처럼 표현하면 실패다.
