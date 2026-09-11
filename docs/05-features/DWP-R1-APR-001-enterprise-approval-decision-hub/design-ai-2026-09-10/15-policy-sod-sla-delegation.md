# 15. 정책·SoD·SLA·위임 거버넌스

화면 ID: `APR-15` · 주 경로: `/approvals/admin/policies` · 우선순위: D3

## Design AI에 전달할 원문

당신은 내부통제·직무분리·운영 정책을 다루는 엔터프라이즈 Governance Product Designer다.
DWP 전자결재 정책 화면을 현재값과 제안값, 영향과 게시 책임이 명확한 통제 workspace로
고도화하라. 코드는 만들지 않는다.

DWP 관리자 Product Surface, React/Vite/MUI Design System, 세부 permission, step-up,
maker-checker, immutable version evidence를 유지한다. 권한이 없는 관리자에게 숨은 기능이나
임의 정책 값을 보여 주지 않는다.

### 사용자·권한·목적

- Policy Designer: proposed value·reason을 편집하되 게시하지 않는다.
- Policy Publisher: current/proposed diff와 evidence를 검토해 독립 게시한다.
- Operations Admin: SLA 위반과 delegation 운영 신호를 읽고 허용된 조치만 수행한다.
- Auditor: versions, actor, reason, hash와 적용 상태를 read-only로 본다.
- 질문: “어떤 통제가 왜 바뀌며, 누가 검토했고, 영향과 실패 시 결과는 무엇인가?”

### 현재 구현

policy list, value type, current/proposed value, reason, lifecycle/severity, versions, update/publish,
self-publish 차단과 고위험 command가 있다. 이 범위는 `EXISTING`이다.

임의 요청을 대상으로 하는 policy simulation, 영향 대상 count, tenant별 rollout, 한국식 전결·후결,
parallel quorum, central admin delegation override, 자동 escalation 편집은 추가 원장/API가 필요하다.
별도 목표 frame에서 `CONTRACT_FIRST`로만 보여 준다.

### 1440px 구조

1. 좌측 320px 정책 목록: domain, severity, lifecycle, pending change, last publishedAt, 검색/필터.
2. 중앙 comparison workspace: policy 목적, 현재값과 제안값의 나란한 semantic diff, 변경 이유,
   validation, 적용 범위. JSON dump를 주 화면으로 사용하지 않는다.
3. 우측 assurance rail: maker/publisher 분리, version/hash, 관련 Workflow/Form, required step-up,
   최근 변경·실패 증거.
4. 상단 signals: 검토 대기, 고위험 변경, SLA 정책, SoD 정책 등 서버가 제공하는 실제 값만.
5. publish footer: 대상 policy/version/hash, 변경 요약, 사유, 위험, step-up 상태와 취소/확정.

### 정책 편집 규칙

- boolean은 switch, enum은 select, 숫자는 단위가 있는 input/stepper를 사용한다.
- current value는 읽기 전용이며 proposed value를 저장해도 즉시 적용됐다고 표현하지 않는다.
- 서버 validation 실패, stale version, 권한 회수 시 입력과 diff를 보존하고 publish는 닫는다.
- 자신이 마지막으로 편집한 draft는 자신이 게시할 수 없다.
- severity 색은 보조 신호다. 텍스트·icon·영향 문구를 함께 사용한다.
- 현재 활성 version과 proposed draft의 actor/time/reason을 섞지 않는다.

### SoD·SLA·위임 목표

별도 tabs 또는 연결 panel로 다음 목표를 설계하되 현재 메뉴를 무단 추가하지 않는다.

- SoD: self-approval, requester/approver conflict, role conflict의 rule·severity·예외 evidence
- SLA: 단계별 목표, 경고/위반 임계, 휴일·시간대, escalation의 결정적 순서
- 위임 거버넌스: 최대 기간, 허용 scope, overlap, revoke, 대결 표시와 원 사용자 evidence
- 영향 검토: 실제 Form/Workflow/request snapshot으로 pass/block/unknown을 분리

이 목표는 `CONTRACT_FIRST`이며 API, versioned policy model, simulation audit, 운영 승인 없이는
활성화하지 않는다. 사용자 self-service 위임 `/approvals/delegations`과 관리자 통제를 섞지 않는다.

### 필수 상태

- populated/no policy/search empty
- Designer/Publisher/Operator/Auditor
- current only, proposed dirty/saved, pending review, published
- query partial failure, 403/revoked, 409 conflict, server 503
- self-publish blocked, step-up required/cancelled/expired
- invalid value, impact unknown, stale linked asset
- SoD/SLA/delegation target frames의 pass/block/partial/unsupported

### 390px·접근성

- 모바일은 정책 목록→현재/제안 diff→assurance→publish review 순서로 drill-in한다.
- 비교값은 가로 두 칸을 억지로 유지하지 않고 `현재`와 `제안` label을 붙인 세로 diff로 바꾼다.
- 변경값과 오류를 field 설명에 연결하고 status update가 focus를 탈취하지 않게 한다.
- table은 적절한 header와 caption을, tabs는 tab/tabpanel 연결을 제공한다.
- 320px/200%, dark, forced colors, keyboard-only publish와 긴 정책명을 검증한다.

### 반환물·실패 기준

1440 policy list/comparison/publish, 390 drill-in, persona별 read/write, conflict/partial/step-up,
SoD·SLA·위임 목표를 제출한다. component anatomy, permission, data source, 구현 분류를 주석으로
표시한다.

current와 proposed를 한 input으로 합치거나, 저장을 적용으로 표현하거나, maker가 publish하거나,
unsupported simulation 결과를 실제 데이터처럼 만들거나, 사용자 위임과 관리자 통제를 같은
화면에서 뒤섞으면 실패다.
