# 08. 내가 올린 결재·보완 요청

화면 ID: `APR-08` · 경로: `/approvals/requests/submitted`,
`/approvals/requests/needs-info` · 우선순위: D1

## Design AI에 전달할 원문

당신은 요청자가 장기 실행 업무의 현재 상태와 다음 행동을 오해하지 않게 설계하는 시니어
Product Designer다. DWP의 `내가 올린 결재`와 `보완할 결재`를 하나의 일관된 수명주기 경험으로
설계하라. 두 route는 기존 사이드바 메뉴로 유지하고 별도 진행 dashboard를 추가하지 않는다.

DWP shell·전자결재 design-system·실제 request/detail/timeline API를 유지한다. 디자인 명세만
반환한다.

### 사용자·권한·질문

- 사용자: request owner. 참여자·관리자라는 이유만으로 owner 행동을 허용하지 않는다.
- submitted 질문: “내 요청은 어느 단계이며 내가 할 일이 있는가?”
- needs-info 질문: “무엇을 보완해야 하며 어떤 version에 답변하는가?”
- 주 행동: 상세 추적, 정책이 허용할 때 진행 중 요청 회수, 보완 답변 제출.

### 현재 구현 사실

상태별 request 목록, query deep link, detail drawer, frozen form labels/payload, 단계와 timeline,
withdraw, latest information request, full schema 기반 보완 답변, expected version이 있다. 이 범위는
`EXISTING`이다. field-level diff, restricted-field encryption UX, server cursor search는
`CONTRACT_FIRST`다.

### 목록과 상세

1. 목록 행: 번호·제목, Form/Workflow, 상태, 현재 단계/전체 단계, 제출·기한·완료 시각, 다음 행동.
2. 상태와 시간 신호를 분리한다. `IN_REVIEW`와 `기한 초과`는 동시에 존재할 수 있다.
3. 선택 drawer/detail: fixed form schema label로 payload, current step, route, immutable timeline,
   available action.
4. 진행률은 완료된 단계 근거로 계산하고 마지막 단계가 시작됐다는 이유로 100%를 표시하지 않는다.
5. 원업무 fulfillment가 별도라면 승인과 반영 중/실패/완료를 구분한다.

### 보완 요청 흐름

- 요청 메시지, 요청한 actor/단계/시각, 답변 기한, 검토한 request version을 먼저 보여 준다.
- 전체 frozen schema를 렌더링하고 기존 payload에 없던 필수 field도 입력하게 한다.
- requester가 수정 가능한 field와 read-only field를 구분한다. 정책 근거 없이 restricted field를
  열지 않는다.
- 답변 submit 전 최신 authority/request/version을 재확인한다.
- 성공은 새 payload revision과 timeline event를 만든 것으로 표현하고 최종 승인으로 쓰지 않는다.
- 409에서는 입력 보존→최신 request/diff 검토→명시적 재제출.

### 회수 흐름

- 서버가 현재 상태와 정책에서 허용할 때만 `회수`를 제공한다.
- 확인에는 요청 번호·제목·현재 단계·영향·사유 요구 여부·version을 표시한다.
- 회수 후 이미 완료된 외부 행동이 자동 취소된다고 주장하지 않는다.
- 권한/상태 변경, 409, 결과 불명에서는 optimistic `회수 완료`를 표시하지 않는다.

### 필수 상태

- submitted populated / 실제 0건 / search 0건
- needs-info 1건/여러 건/실제 0건
- 목록 성공 + detail 실패 partial
- request detail 403/503, 권한 회수
- 단계 진행/보완 대기/승인/반려/회수/취소
- 보완 입력 중/validation/submit/409
- withdraw 확인/진행/성공/409/불가
- 긴 payload, 20단계 timeline, null due date
- source fulfillment pending/failed/completed 목표

### 모바일·접근성

- 390px는 목록→full detail→보완 form/회수 dialog→원 목록 복귀. drawer를 화면 밖 좁은 열로
  남기지 않는다.
- 상태·단계·시간을 텍스트와 구조로 제공하고 색만으로 구분하지 않는다.
- detail close/back 후 원 row focus/scroll을 복원한다.
- 보완 error summary에서 해당 field로 focus 이동, IME Enter 방지, sticky footer가 keyboard와
  error를 가리지 않음.
- 320px/200%, dark/forced colors/reduced motion, long Korean/English를 검수한다.

### 반환물·실패 기준

submitted와 needs-info의 1440 정상, 390 모바일, partial detail, withdraw, 보완 validation/409,
fulfillment 상태를 제출한다. 상태 machine과 사용자 행동의 permission/version을 주석으로 표시한다.

단계 시작을 완료로 표시하거나, 보완 성공을 최종 승인으로 쓰거나, 회수로 외부 반영까지
되돌렸다고 주장하거나, 권한 실패 뒤 payload를 남기면 실패다.
