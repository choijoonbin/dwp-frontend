# 14. Workflow·Routing Studio

화면 ID: `APR-14` · 경로: `/approvals/admin/workflows` · 우선순위: D2

## Design AI에 전달할 원문

당신은 감사 가능한 엔터프라이즈 Workflow 설계 도구를 만드는 시니어 Product Designer다.
DWP 전자결재의 현재 순차 결재선 편집기를, 후보 역할·SLA·guardrail·게시 증거가 한 흐름으로
읽히는 Routing Studio로 고도화하라. 코드는 만들지 않는다.

DWP의 React/Vite/MUI Design System, 관리자 Product Surface, 실제 Form/Workflow 분리 모델,
maker-checker와 step-up 계약을 보존한다. 자유 배치 노드 캔버스나 허구의 BPMN 엔진을 만들지
않는다.

### 사용자·권한·목적

- Designer: draft Workflow의 단계·후보 역할·SLA를 편집한다.
- Publisher: immutable diff, hash, 검증 결과를 읽고 독립 게시한다.
- Operator/Auditor: 활성 경로와 사용 증거를 read-only로 확인한다.
- 질문: “누가 어떤 순서와 기한으로 결정하고, 잘못된 경로가 게시 전에 어떻게 차단되는가?”
- 주 행동: Workflow 선택, 단계 편집, validation, draft 저장, 독립 게시 검토.

### 현재 구현

Workflow list/detail, 한영 name/description, lifecycle/version, ordered steps, candidate role, SLA,
guardrails/hash, create/update/publish가 있다. 현재 단계 정족수는 역할 후보 중 한 명이 처리하는
`ANY`만 지원한다. 이 범위는 `EXISTING`이다.

병렬 branch, `ALL`, `COUNT`, `PERCENT`, 동적 후보 resolver, escalation timer, policy simulation,
published version에서 새 revision branch, canary/rollback은 원장과 API가 더 필요하다. 목표
section에서 `CONTRACT_FIRST`로만 설계하고 현재 활성 control로 가장하지 않는다.

### 1440px 구조

1. 좌측 320~380px Workflow 목록: 검색, lifecycle, version, step count, linked Form count, owner,
   updatedAt. 선택 row와 keyboard 이동이 안정적이어야 한다.
2. 중앙 520px 이상 순차 route editor: 위에서 아래로 단계 번호, 이름, 후보 역할, mode `ANY`, SLA,
   위험 표시를 보여 준다. 연결은 단순하고 판독 가능해야 하며 선이 교차하는 canvas는 금지한다.
3. 우측 320px inspector: 선택 단계 속성, 후보 설명, SLA, guardrail, validation과 reference Form.
4. 상단 compact bar: draft/published 상태, version/hash, 저장 상태, validation 수, preview, 저장,
   publish review. 고위험 publish는 step-up 흐름을 거친다.
5. 하단 validation drawer: 누락 후보, 잘못된 SLA, 빈 단계, self-approval 위험, inactive role,
   stale reference를 심각도와 단계 링크로 보여 준다.

### 단계 상호작용

- 단계 추가, 복제, 삭제, 위/아래 이동은 icon+tooltip과 keyboard 대안을 제공한다.
- 단계 선택 시 inspector만 바뀌며 목록 scroll과 Workflow selection을 보존한다.
- 후보 역할 조회 실패를 빈 후보로 가장하지 않고 해당 단계 저장을 막는다.
- 지원 mode가 `ANY`뿐임을 명확히 표시하되, 불필요한 disabled mode 묶음을 노출하지 않는다.
- Form binding과 Workflow version은 독립 자산임을 inspector와 publish diff에서 보존한다.
- 동일 사용자의 design/publish 충돌은 설명과 actor evidence를 남기고 mutation을 보내지 않는다.

### 목표 Routing Simulation

별도 annotated frame으로 입력 사례를 선택하면 예상 단계, 후보 집합, SLA, SoD 위반을 설명하는
simulation panel을 설계한다. 결과가 실제 승인이나 게시를 수행하지 않으며 다음 계약이 필요하다고
표시한다.

- canonical input snapshot과 policy/workflow version
- candidate resolver 결과와 이유
- branch/quorum semantics와 deterministic ordering
- simulation audit, timeout, partial dependency failure
- 활성 요청에 미치는 영향과 canary/rollback evidence

### 필수 상태

- list/detail populated, no Workflow, search empty
- Designer draft, Publisher review, Auditor read-only
- dirty/saving/saved, validation error, `409` conflict, 503 dependency
- candidate role unavailable, inactive linked Form, self-publish blocked
- long 20-step Workflow, 긴 한영 단계명, step reorder confirmation
- publish step-up required/cancelled/expired/succeeded
- simulation target frame: pass, SoD violation, unresolved candidate, timeout

### 390px·접근성

- 모바일은 Workflow list→route summary→step editor→publish review의 drill-in 구조다.
- 20단계를 수평 stepper로 압축하지 않는다. 세로 ordered list와 현재 위치를 사용한다.
- 단계 재정렬은 drag 외에 Move up/down menu를 제공하고 결과를 live region으로 알린다.
- 연결선·상태는 색에만 의존하지 않고 번호, label, icon, text를 함께 쓴다.
- focus는 저장/오류/삭제 후 논리적인 단계 또는 trigger로 돌아간다.
- 320px/200%, dark, forced colors, reduced motion, 긴 validation 문구를 포함한다.

### 반환물·실패 기준

1440 normal/edit/error/publish, 390 list/step/review, 20-step stress, high-risk step-up, simulation
목표를 제출한다. component anatomy, focus order, interaction notes, 구현 분류를 표시한다.

지원하지 않는 BPMN·parallel/quorum을 실제 기능처럼 보이거나, 복잡한 자유 배치 canvas를 만들거나,
Designer가 자신의 변경을 게시하거나, 후보 조회 실패 상태로 저장을 허용하면 실패다.
