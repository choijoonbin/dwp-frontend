# 06. 상신 전 검증·결재선·증빙

화면 ID: `APR-06` · 위치: 새 기안의 상신 검토 단계 · 우선순위: D1

## Design AI에 전달할 원문

당신은 금융·권한·인사 영향을 주는 요청의 제출 전 오류 예방을 설계하는 시니어 Product
Designer다. DWP 기안자가 상신 직전에 문서, 결재 경로, 정책, 증빙과 영향을 한 번 더 확인하는
preflight 화면을 설계하라. 새 영구 메뉴가 아니라 APR-05의 review step 또는 dialog/full pane다.

DWP shell과 전자결재 design-system을 유지하고 코드를 만들지 않는다. 화면에 보이는 기능은
`EXISTING`, `REDESIGN_ONLY`, `CONTRACT_FIRST`, `EXTERNAL_GATE`로 명확히 구분한다.

### 사용자·권한·목적

- 사용자: 해당 draft의 owner이며 최신 version에 대해 submit 권한이 있는 기안자.
- 질문: “이 문서가 어떤 버전·경로·근거로 제출되고, 빠진 것과 되돌릴 수 없는 영향은 무엇인가?”
- 주 행동: 문제 위치로 돌아가 수정하거나 명시적으로 상신.
- archetype: error-prevention review, not a final approval screen.

### 현재 제공 가능한 기준 화면

현재 template 응답의 게시 Form, form version, Workflow, 순차 `ANY` 단계, candidate role,
단계 SLA, 필드 schema와 draft payload를 사용한다.

1. 문서 요약: 제목, 양식·version, data classification, priority, 요청자, 주요 업무 필드.
2. 결재 경로: 단계 순서, 단계명, candidate role, SLA. 실제 개인 후보 이름이 API에 없으면
   사람 avatar를 만들지 않는다.
3. 검증 결과: 필수/형식/허용값/unknown field와 게시 자산 상태. issue를 section/field에 연결한다.
4. 제출 영향: 새 immutable request revision과 당시 Form/Workflow binding이 고정됨을 사용자
   언어로 설명한다.
5. 행동: `작성으로 돌아가기`, `초안 저장`, `상신`. submit 전 서버 재검증을 전제로 한다.

### 경로·정책 진실성

- UI preview는 설명용이다. 실제 후보와 SoD는 submit 시점에 서버가 다시 계산한다.
- 현재 runtime은 순차 `ANY`다. ALL/COUNT/PERCENT/parallel branch를 정상 경로에 넣지 않는다.
- 후보 없음, published asset 변경, self-approval/SoD, authority unavailable은 제출 차단 상태다.
- route가 바뀌었다면 조용히 제출하지 않고 이전/최신 경로 차이를 보여 준 뒤 사용자 확인을
  다시 받는다. 이 diff가 API에 없으면 `CONTRACT_FIRST`로 표시한다.

### 첨부 목표 계약

첨부 UX는 유용하지만 현재 미구현이다. 별도 목표 frame에는 다음 전체 상태를 설계하고
`CONTRACT_FIRST + EXTERNAL_GATE`로 표시한다.

- upload 대기/진행/완료/실패/취소/재개, checksum과 object version
- 파일명, 크기, MIME/확장자, 업로더, 분류, 접근 범위
- malware scan `PENDING/CLEAN/QUARANTINED/FAILED/EXPIRED`
- scan 완료 전 preview·submit 차단, 권한 회수 시 preview 제거
- KMS 암호화, 만료 URL, retention/legal hold와 audit
- 긴 파일명, 같은 이름, 0 byte, 최대 수/크기, 모바일 업로드

paperclip 아이콘과 `검사 완료` 배지만 그려 놓고 backend/infra 계약을 생략하면 실패다.

### 참조·협조·댓글 목표 계약

참조자, 협조자, 회람, 댓글/멘션도 현재 API에 없다. 목표 frame에는 participant type, scope,
읽기/작성 권한, 알림, 추가/제거 version, 감사, 권한 회수, 본문 redaction을 요구한다.
결재 단계 후보와 단순 참조자를 같은 사람 목록으로 합치지 않는다. decision reason과 협업 댓글도
분리한다.

### 상태 전이

- preflight loading 중 이전 경로를 최신처럼 표시하지 않음.
- validation issue 선택 → APR-05 해당 field로 돌아가 focus.
- submit 중 single-flight, page leave 방지, 취소 가능/불가능 시점을 명시.
- submit success → submitted request ID와 상세 경로. 원업무 반영 완료를 의미하지 않음.
- 409 published asset/draft conflict → 작성값 보존, 최신 contract 비교, 재검토.
- 422 no eligible approver → 운영 조치가 필요한 차단, 임의 후보 선택 금지.
- 503 authority/engine unavailable → 제출 0건, retry와 초안 보존.

### 필수 프레임

- 정상 preflight
- 3개 field issue와 route issue
- candidate 없음/SoD 차단
- Form 또는 Workflow version 변경
- submit 진행/성공/결과 불명/실패
- 첨부 목표: scan pending/quarantined/permission revoked
- 참조·협조 목표: 권한·알림·제거 상태
- 긴 10단계 경로, 긴 문서, 390/320 모바일

### 접근성·반응형

- 1440에서는 document summary와 route/issue inspector의 비교 가능한 구조를 쓴다.
- 390에서는 issue summary→문서→경로→확정 순서로 한 면에 두고 sticky action이 오류를 가리지
  않는다.
- step tracker는 완료/현재/예정을 텍스트로 제공하고 200%에서는 세로 timeline으로 reflow한다.
- error summary와 field 연결, dialog focus, status/alert, 44px target, forced colors를 명세한다.
- 고영향 제출은 WCAG 오류 예방 원칙에 맞게 대상·결과·version을 확인할 수 있어야 한다.

### 반환물·실패 기준

현재 계약 기준 frame과 첨부/협업 계약 목표 frame을 섞지 말고 분리 제출한다. 1440·390,
정상·검증 실패·충돌·authority failure와 번호가 있는 submit 흐름을 제공한다.

실제 후보가 없는 데 사람을 임의 표시하거나, client preview만으로 권한을 확정하거나, scan 전
첨부를 열거나, 상신 성공을 최종 승인으로 표현하면 실패다.
