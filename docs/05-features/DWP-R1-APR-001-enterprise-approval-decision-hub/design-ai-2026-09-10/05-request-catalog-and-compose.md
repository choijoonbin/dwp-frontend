# 05. 게시 양식 선택·기안 작성

화면 ID: `APR-05` · 경로: `/approvals/requests/new` · 우선순위: D1

## Design AI에 전달할 원문

당신은 복잡한 사내 신청을 오류 없이 작성하게 돕는 시니어 Product Designer다. DWP 전자결재의
새 결재 작성 화면을 게시 양식 선택→업무 내용 작성→초안 저장→상신 검토로 이어지는 명료한
workspace로 설계하라. 디자인과 상호작용 명세만 반환한다.

DWP 글로벌 shell·전자결재 사이드바·MUI/design-system·Product Surface 권한을 유지한다.
별도 form-builder 제품이나 마케팅식 template gallery를 만들지 않는다. 관리자가 게시한 양식과
Workflow만 사용하며 미게시/권한 밖 자산을 노출하지 않는다.

### 사용자·권한·목적

- 사용자: request `CREATE`와 `UPDATE` 권한이 있고 게시 Form을 볼 수 있는 구성원.
- 질문: “어떤 양식으로 무엇을 작성해야 하며, 지금 저장 가능한가 또는 상신 가능한가?”
- 주 행동: 불완전 상태의 초안 저장 또는 모든 필수 검증 후 상신.
- archetype: guided form workspace + compact route context.
- `MANAGE` 상위 권한을 제외하면 CREATE와 UPDATE를 구분해 검사한다.

### 현재 구현 사실

게시 Form 카탈로그, Form template, 고정 Workflow/version, 제목·요약·priority, 동적
TEXT/TEXTAREA/NUMBER/DATE/SELECT/USER 필드, 부분 draft 저장, strict submit, DWAI·ON
handoff와 기존 draft hydration이 있다. 명시적 저장은 `EXISTING`이다. background autosave는
현재 계약이 아니므로 `CONTRACT_FIRST`로 분리한다.

### 1440px 정보 구조

1. 상단에 `새 결재 작성`, 선택한 양식/현재 draft 여부, 저장 상태, 닫기/초안 저장/상신 검토를
   배치한다. 상신은 필수 검증 전 disabled 이유를 읽을 수 있게 한다.
2. 양식 미선택 상태는 검색 가능한 게시 양식 selector와 카테고리·설명·소유 부서·예상 SLA를
   제공한다. 추천/인기 수치는 실제 데이터 없이는 만들지 않는다.
3. 양식 선택 후 main column은 sectioned form이다. 기본 정보→업무 필드 순서, field label/help,
   required, 단위, 선택값, 오류를 명확히 한다.
4. right inspector는 선택된 양식의 이름·version·Workflow·단계·전체 SLA와 현재 validation
   summary를 제공한다. 긴 결재선 canvas를 항상 점유하지 않는다.
5. 긴 Form은 section index와 오류 수를 제공하되 각 오류로 keyboard focus 이동이 가능해야 한다.
6. sticky action area는 저장과 상신 검토를 구분한다. 저장을 상신처럼 강조하거나 상신을 자동
   수행하지 않는다.

### 입력·저장 전이

- Form 변경 → 기존 입력 소실 영향을 먼저 확인. 확인 전 자동 초기화하지 않는다.
- draft deep link → 서버 detail 권위를 확인한 뒤에만 필드를 hydrate한다.
- 부분 draft 저장 → 필수값이 비어도 허용하지만 unknown field/type/길이 등 기본 schema는 지킨다.
- submit → 제목·요약·필수 dynamic field·게시 Form/Workflow·version을 모두 재검증한다.
- 저장/상신 중 single-flight, 버튼 label 변화로 layout이 흔들리지 않는다.
- 409 → 입력을 보존하고 서버 최신 draft version과 안전하게 비교 후 재적용/취소.
- 403 → 민감 draft를 제거하고 권한 안내·안전한 목록 복귀. 브라우저에 가짜 저장 완료를 남기지
  않는다.
- DWAI·ON handoff는 검토할 초안을 채울 뿐 자동 상신하지 않는다.

### 오류·빈 상태

- 게시 Form loading/error/실제 0건
- template만 loading/error/게시 중단
- draft loading/error/삭제·권한 회수
- field validation, section error summary, 상신 전 server validation
- offline 입력 중, 저장 실패, 결과 불명, 409 version conflict
- 선택한 USER 후보 권한/상태 변경은 신규 directory 계약이 없으면 활성 selector로 만들지 않음
- 100개 선택 option, 긴 help, 긴 영문 label, 금액/날짜 locale

### 첨부·참조·협조 경계

현재 API에는 첨부·참조/협조선·독립 댓글이 없다. 기본 frame에 가짜 upload 성공, virus scan
완료, 참조자 알림을 넣지 않는다. APR-06의 `CONTRACT_FIRST` 목표 frame에서만 제안한다.

### 모바일·접근성

- 390px에서 양식 선택→form section→validation→action의 한 column. right inspector는 summary
  sheet 또는 inline accordion으로 이동한다.
- 320px/200%에서 label, help, error, suffix가 겹치지 않고 horizontal page overflow가 없다.
- 각 input의 programmatic label/help/error 연결, required를 색 외 텍스트로 표시한다.
- 첫 오류 summary에서 해당 field로 이동하고 focus가 sticky header/footer에 가리지 않는다.
- Form 변경 확인 dialog는 focus trap/opener restore, IME Enter 방지, destructive action의 명료한
  이름을 가진다.
- save result는 `status`, validation/권한 오류는 `alert`; 입력 중 계속 낭독하지 않는다.

### 반환물·수용 기준

1440 양식 미선택/작성 중/validation, 390 모바일, long form, partial draft save, submit review,
403, 409, offline을 제출한다. field anatomy, section navigation, 저장/상신 state machine,
permission과 구현 분류를 주석으로 표시한다.

필수값이 없으면 초안 저장까지 막거나, draft 저장을 상신 완료로 표현하거나, 양식 변경 시
입력을 예고 없이 지우거나, 존재하지 않는 첨부/참조 기능을 정상 화면에 넣으면 실패다.
