# 13. 양식 빌더·검증·미리보기

화면 ID: `APR-13` · 위치: `/approvals/admin/forms`의 편집 workspace · 우선순위: D2

## Design AI에 전달할 원문

당신은 규제 산업용 전자결재 양식 빌더를 설계하는 시니어 Product Designer다. DWP의 기존
Form schema와 권한 계약을 보존하면서, 관리자가 한영 필드와 기본 결재선을 정확하게 편집하고
실제 기안 화면을 미리 검증하는 작업 공간을 설계하라. 코드는 만들지 않는다.

DWP는 Next.js/Tailwind 앱이 아니라 React 19·Vite·MUI 7·DWP Design System 기반이다. 글로벌
관리자 shell과 Product Surface를 다시 만들지 말고 기존 `/approvals/admin/forms` 안의
dialog 또는 집중 workspace로 설계한다. 카드 안에 카드를 반복하는 마케팅형 화면은 피한다.

### 사용자·권한·목적

- Designer: draft Form과 field schema를 만들고 수정하지만 자신의 마지막 변경을 게시하지 못한다.
- Publisher: 변경 diff와 validation을 검토해 게시하며 field 값을 직접 편집하지 않는다.
- Auditor: schema, hash, version, actor evidence를 읽기만 한다.
- 질문: “이 양식이 어떤 값을 어떤 규칙으로 받고, 모바일과 한영 환경에서 실제로 쓸 수 있는가?”
- 주 행동: 필드 추가·순서 변경·속성 편집·미리보기·draft 저장·게시 검토 요청.

### 현재 구현과 금지된 가정

현재 field type은 `TEXT`, `TEXTAREA`, `NUMBER`, `DATE`, `SELECT`, `USER`다. field key, 한영
label/help, required, select options, 정렬, active default Workflow route를 편집하고 create/update/
publish할 수 있다. 이 범위는 `EXISTING`이다.

조건부 표시, 계산식, 반복 그룹, 파일 첨부, 서명 필드, 외부 데이터 lookup, 협업 댓글, 실시간
공동 편집은 아직 계약이 없다. 이 기능은 목표 주석에서 `CONTRACT_FIRST`로만 제안하고 현재
toolbar나 canvas에 동작 가능한 것처럼 넣지 않는다.

### 1440px 작업 공간

1. 상단 56~64px 편집 bar: Form명, lifecycle/version, 저장 상태, 마지막 저장 시각, validation
   count, 닫기, 미리보기, `초안 저장`. 게시 행동은 Publisher 전용 검토 흐름으로 분리한다.
2. 좌측 260px 구조 panel: 필드 목록, type icon, required, 숨김/오류 상태, keyboard reorder 버튼.
   새 필드 type은 icon menu로 추가한다. drag는 보조 수단이며 위/아래 이동을 반드시 제공한다.
3. 중앙 flexible canvas: 실제 기안 form과 같은 폭·간격·label/help/error를 보여 준다. 선택 필드는
   얇은 focus outline과 toolbar만 사용하고 장식용 대형 card를 만들지 않는다.
4. 우측 320~360px property inspector: key, type, 한영 label/help, required, options, validation,
   data preview. 긴 값과 null을 안정적으로 처리한다.
5. Preview mode는 desktop/mobile segmented control로 전환하며 실제 기안 컴포넌트의 read/write,
   required error, 긴 번역, keyboard order를 보여 준다.
6. 하단 sticky validation summary는 오류 위치로 이동하고 저장 버튼을 가리지 않는다.

### 편집·저장 규칙

- field key는 생성 후 기존 요청 payload와의 호환성 때문에 가벼운 label처럼 변경하지 않는다.
- type 변경으로 기존 option/value가 손실되면 영향과 되돌릴 수 없는 범위를 확인한다.
- 빈 한영 label, 중복 key, SELECT option 누락, 허용되지 않은 type, inactive Workflow binding은
  클라이언트와 서버 validation 모두에서 막힌다.
- 저장에는 현재 form id/version과 draft snapshot이 결속된다. `409`이면 사용자 입력을 보존하고
  서버본 비교·새로고침·다시 적용을 선택하게 한다.
- 닫기 중 저장이 진행 중이면 중복 저장하지 않고 완료·실패를 확인한 뒤 닫는다.
- 게시본은 직접 수정하지 않고 새 draft가 필요한 목표 상태임을 설명한다.

### 필수 화면·상태

- populated form, blank new form, long 40-field form
- Designer edit, Publisher review, Auditor read-only
- pristine, dirty, saving, saved, validation failed, server 503, `409` conflict
- field add/delete/reorder, destructive type change confirmation
- desktop/mobile preview, Korean/English preview, long text and missing translation
- inactive route, self-publish blocked, permission revoked while editing
- loading skeleton, partial reference-Workflow failure, offline draft preservation

### 390px·320px·200% 반응형

- 390px는 축소된 3열이 아니다. `필드 목록 → 필드 편집 → 미리보기`의 명확한 단계형 drill-in이다.
- 선택 필드 이름과 뒤로 가기를 sticky header에 유지하고, 저장 상태와 오류 수를 숨기지 않는다.
- keyboard reorder와 move menu는 touch target 44px 이상이며 horizontal overflow가 없어야 한다.
- 320px와 200%에서 fixed footer가 마지막 field/error를 가리지 않게 safe-area와 padding을 둔다.

### 접근성·시각 규칙

- canvas selection과 입력 focus를 구분한다. 선택만으로 form value가 바뀌지 않는다.
- property 변경과 validation 결과는 적절한 status live region으로 알리고 focus를 탈취하지 않는다.
- drag handle, icon button, type icon에는 이름과 tooltip을 제공한다.
- error summary는 field label과 연결되고 첫 오류 이동 후 실제 입력에 focus한다.
- light/dark/forced colors/reduced motion, 200% 확대, 긴 한영 문구를 검증한다.
- 시각 언어는 neutral workspace에 DWP blue selection, teal valid, amber warning, red blocking만 쓴다.

### 반환물·실패 기준

1440 normal/dirty/validation/conflict, 390 edit/preview, 320·200%, dark/forced-colors, Designer/
Publisher/Auditor를 제출한다. component anatomy, token, focus order, field state table, `EXISTING`과
`CONTRACT_FIRST` 경계를 주석으로 표시한다.

별도 앱 shell을 만들거나, 지원하지 않는 attachment·formula를 toolbar에 넣거나, 게시본을 직접
덮어쓰거나, 모바일에 desktop 3열을 축소하거나, drag만으로 순서를 바꾸게 하면 실패다.
