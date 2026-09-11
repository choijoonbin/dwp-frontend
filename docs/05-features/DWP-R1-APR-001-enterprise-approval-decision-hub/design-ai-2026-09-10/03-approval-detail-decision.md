# 03. 결재 상세·결정

화면 ID: `APR-03` · 위치: `/approvals/inbox` 우측 상세 · 우선순위: D1

## Design AI에 전달할 원문

당신은 고위험 업무 의사결정 화면을 설계하는 시니어 Product Designer다. DWP 결재함에서
선택한 Task를 충분한 근거로 검토하고 승인·반려·정보 요청을 안전하게 수행하는 상세 pane을
설계하라. 이 상세는 새 영구 메뉴나 별도 앱이 아니다.

DWP 글로벌 shell, 전자결재 사이드바, 기존 MUI/design-system, Product Surface 권한을
유지한다. 디자인과 prototype 명세만 반환하며 기능을 구현하지 않는다.

### 사용자·권한·질문

- 사용자: 현재 Task의 직접 후보, claim한 사용자, 유효한 대리인.
- 질문: “무엇이 바뀌며, 어떤 근거와 정책 때문에 내가 이 결정을 해야 하는가?”
- 행동: claim, approve, reject, request information. 서버가 반환한 `canClaim`, `canDecide`,
  self-approval/SoD와 최신 version을 모두 만족할 때만 표시한다.
- completed 사용자는 동일 정보를 읽을 수 있어도 mutation footer는 보지 않는다.

### 정보 위계

1. sticky detail header: 요청 번호·제목, priority/risk/data classification, 요청자, 기한, 현재
   단계, 최신 확인 시각. 목록으로 돌아가기와 원업무 복귀가 있으면 정확한 target을 사용한다.
2. `판단 근거 브리프`: 서버 risk/policy 신호, 주의할 필드, 왜 내가 담당인지, 누락된 근거를
   짧게 보여 준다. 서버 score를 생성 AI의 확정 추천으로 바꾸지 않는다.
3. AI 요약 목표를 제안한다면 출처, 생성 시각, 근거 링크, 미확인/실패, 사용하지 않은 민감
   데이터, “결정은 사용자 책임”을 포함하고 `CONTRACT_FIRST`로 표시한다.
4. `결재 경로`: Draft/제출, 과거 단계, 현재 단계, 예정 단계를 연결한 step tracker. 현재
   runtime은 순차 `ANY`만 활성화한다. ALL/COUNT/PERCENT/parallel을 정상 fixture에 넣지 않는다.
5. `요청 내용`: 고정된 form schema label로 payload를 섹션화한다. key-value wall이 아니라
   금액·기간·대상·사유·변경 전후 등 판단 순서로 표시한다. 없는 값과 조회 실패를 구분한다.
6. `결정 이력`: actor, 대표 actor, 단계, outcome, 사유, 시각, version을 읽는 immutable timeline.
7. sticky footer: 문맥에 맞는 claim / 정보 요청 / 반려 / 승인. footer는 본문 마지막 근거와
   오류를 가리지 않는다.

### 첨부·댓글·참조의 정직한 범위

현재 public Approval API에는 첨부·독립 collaboration thread·멘션·참조/협조선이 없다.

- decision의 `comment`는 결정 사유다. 대화형 댓글 feed처럼 보이게 하지 않는다.
- 첨부 목표 frame은 `CONTRACT_FIRST + EXTERNAL_GATE`로 표시하고 upload, object version,
  MIME/확장자 검사, malware scan, preview eligibility, KMS, retention, audit, 권한 회수 상태를
  함께 설계한다.
- 댓글/멘션/참조/협조 목표 frame은 별도 thread/member/read/audit/notification 계약이 필요하다.
- 계약 전의 기본 frame에는 비활성 paperclip이나 가짜 댓글 건수를 장식으로 넣지 않는다.

### 결정 흐름

1. 사용자가 CTA를 선택한다.
2. 최신 Task 권한·상태·version을 재확인한다. 확인 중에는 제출할 수 없다.
3. dialog에서 대상·결정·영향·현재 단계·요구 사유를 다시 읽는다.
4. 반려/정보 요청은 최소 8자 사유를 요구하고 IME 조합 중 Enter 제출을 막는다.
5. 고위험이면 canonical OIDC step-up→동일 target/version 재확인→사용자 reconfirm 순서다.
6. 제출 중 single-flight, 취소 규칙, 중복 클릭 방지를 명세한다.
7. 성공은 결정 원장 commit과 원업무 fulfillment를 구분한다. 외부 반영 중이면 완료로 쓰지 않는다.
8. 409는 입력 사유를 보존하고 최신 상세를 먼저 보여 준 뒤 사용자가 다시 선택해야 한다.

### 필수 상태

- 검토 가능 / claim 필요 / 읽기 전용 completed
- detail loading, payload만 실패, timeline만 실패
- self-approval/SoD blocked
- delegated decision과 원 결재자 표시
- 정보 요청 중/요청자 답변 후 재개
- 403 후보 회수, 503 authority unavailable, offline
- 409 version conflict, replay success, 이미 다른 사용자가 처리
- step-up popup blocked/timeout/foreign origin/expired proof
- 결정 commit 완료 + fulfillment pending/failed/completed
- 긴 form 50필드, 긴 timeline, restricted field redaction

### 반응형·접근성

- 1440에서는 detail의 읽기 column을 무한히 넓히지 않고 metadata/본문/timeline의 계층을 유지한다.
- 390에서는 header→brief→workflow→content→timeline 순의 한 면으로 재배치하고 section jump를
  제공할 수 있다. sticky footer는 safe area·키보드·오류 영역을 가리지 않는다.
- workflow는 색/원만으로 상태를 표현하지 않고 `완료/현재/예정/건너뜀` 텍스트를 제공한다.
- dialog는 제목·설명·초기 focus·trap·Escape 정책·opener focus 복원을 명세한다.
- 상태 변경은 `status`, 거절/권한 회수는 `alert`; focus는 실제 CTA가 사라진 경우에만 안정된
  status로 이동한다.
- 320px/200%, dark, forced colors, reduced motion, 긴 한영 제목을 모두 검수한다.

### 반환물·수용 기준

1440 정상과 390 모바일, claim, 세 decision dialog, partial, 403, 409, step-up, fulfillment
pending을 제출한다. 각 행동의 permission·version·result contract와 focus 흐름을 주석으로
표시한다.

근거보다 CTA를 먼저 강조하거나, risk를 자동 승인 추천으로 표시하거나, 사유 없이 반려하거나,
권한 회수 뒤 payload를 남기거나, decision 성공과 원업무 반영 성공을 합치면 실패다.
