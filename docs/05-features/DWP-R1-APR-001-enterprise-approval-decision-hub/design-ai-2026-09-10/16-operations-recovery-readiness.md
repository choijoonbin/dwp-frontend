# 16. 운영·복구·보존·서명 준비

화면 ID: `APR-16A` Operations, `APR-16B` Signatures · 경로:
`/approvals/admin/operations`, `/approvals/admin/signatures` · 우선순위: D3

## Design AI에 전달할 원문

당신은 고위험 업무 Workflow의 복구와 외부 의존성 readiness를 설계하는 시니어 Operations
Product Designer다. DWP 전자결재 운영 화면을 지연 task, 전달 실패, 재처리, 감사 증거와 외부
전자서명 준비 상태를 정직하게 보여 주는 운영 workbench로 고도화하라. 코드는 만들지 않는다.

DWP 관리자 shell과 Product Surface, 현재 Approval API, step-up, retry idempotency, maker-checker,
fail-closed readiness를 보존한다. 운영 데이터를 꾸미기 위한 가짜 uptime·success rate를 만들지
않고, 법적 전자서명·WORM·KMS가 준비되지 않았으면 명시적으로 차단 상태를 보여 준다.

### 사용자·권한·목적

- Operator: breached task와 integration delivery를 진단하고 허용된 retry를 실행한다.
- Recovery Auditor: retry 전후 immutable evidence와 담당자 결속을 검토한다.
- Signature Admin: Provider 설정·검증 상태를 읽고 외부 Gate를 확인한다.
- Compliance Auditor: 보존·삭제·서명 증적을 read-only로 확인한다.
- 질문: “무엇이 막혔고, 다시 실행해도 안전한가, 어떤 외부 조건 때문에 아직 운영할 수 없는가?”

### 현재 구현

operations overview에 SLA breached task와 integration delivery 상태가 있고, delivery retry command와
고위험 step-up이 있다. signatures에는 Provider 설정/검증 여부를 읽는 화면과 명시적 외부 Gate가
있다. 이 범위는 `EXISTING`이다.

bulk retry, task reassignment, dead-letter replay, reconciliation run, legal hold, retention purge,
WORM export, 법적 전자서명 ceremony는 추가 정책·원장·Provider가 필요하다. 실제 action을 만들지
말고 `CONTRACT_FIRST` 또는 `EXTERNAL_GATE` target으로 구분한다.

### 1440px Operations 구조

1. 상단 compact health strip: breached count, retryable delivery, blocked/non-retryable, last refresh,
   partial-source status. 실제 필드만 사용한다.
2. 좌측 420px work queue: `SLA 위반`, `전달 실패` tabs, severity/status/age, request number,
   destination, attempts, next retry, owner. dense row와 keyboard selection을 사용한다.
3. 우측 detail: 실패 원인, payload는 redacted summary, idempotency/version, attempts timeline,
   related request/task, retry eligibility와 차단 이유.
4. sticky action zone: 새로고침, 원업무 열기, `다시 전달`. retry는 대상 outbox/version과 최신
   권한을 재검증하고 고위험 확인·step-up을 거친다.
5. partial source가 실패하면 성공한 panel은 유지하되 전체가 정상이라고 표시하지 않는다.

### 1440px Signatures readiness 구조

1. Provider row: name, configured, verified, region/tenant binding, last verification, capability.
2. readiness checklist: credential, callback trust, consent, retention, legal review, production probe.
3. 상태는 `READY`, `NOT_CONFIGURED`, `NOT_VERIFIED`, `BLOCKED_EXTERNAL`, `UNKNOWN`처럼 원인을
   포함한다. 설정되지 않은 Provider에 “활성” badge를 주지 않는다.
4. external document/sign ceremony는 target journey로만 그리고 DWP 내부 승인 결정과 분리한다.

### 안전한 retry·복구 규칙

- retry 가능 여부, 다음 attempt, idempotency key, terminal/non-terminal을 서버 응답으로 표시한다.
- 진행 중에는 같은 delivery의 중복 command를 막고, 늦은 성공이 최신 실패/권한 회수 상태를
  덮지 않게 한다.
- `409`는 입력 없이 새로고침 후 최신 evidence를 다시 확인하게 한다.
- 403/권한 회수, stale version, non-retryable, exhausted attempt에는 POST를 보내지 않는다.
- 성공 toast만 보여 주지 말고 timeline·status·attempt가 갱신됐는지 확인한다.

### 필수 상태

- healthy/empty, breached tasks, retryable/non-retryable deliveries
- operations query partial, offline/503, stale data, 403/revoked
- retry idle/pending/success/failed/409/step-up cancelled
- duplicate click, identity switch, selected item disappears after refresh
- Signature configured+verified, configured-not-verified, not configured, external blocked, unknown
- redacted sensitive payload, long error text, 1000-row cursor target
- retention/hold/export/reconciliation target frames with no active command

### 390px·접근성

- 모바일은 queue→detail→confirm→result로 전환하고 선택 맥락과 뒤로 가기를 보존한다.
- sticky action은 safe area와 virtual keyboard를 침범하지 않는다.
- live update는 screen reader에 요약만 알리고 row focus를 강제로 이동하지 않는다.
- status와 retry eligibility는 색뿐 아니라 label과 reason을 제공한다.
- error detail은 접을 수 있어도 핵심 원인과 correlation id를 숨기지 않는다.
- 320px/200%, dark, forced colors, reduced motion, keyboard-only retry를 포함한다.

### 반환물·실패 기준

`APR-16A-Operations` 1440/390과 `APR-16B-Signatures` 1440/390, partial/403/409/retry/step-up,
외부 Gate, target recovery frame을 제출한다. component anatomy, event transitions, permission,
redaction, 구현 분류를 표시한다.

미지원 bulk/reassign/legal hold/e-sign을 활성 버튼으로 만들거나, 외부 readiness를 임의로 READY로
표시하거나, raw payload/secret을 노출하거나, retry 중복·stale·권한 상태를 생략하면 실패다.
