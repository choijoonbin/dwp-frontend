# 07. 임시 저장·충돌 복구

화면 ID: `APR-07` · 경로: `/approvals/requests/drafts` · 우선순위: D1

## Design AI에 전달할 원문

당신은 사용자의 작성 내용을 잃지 않는 엔터프라이즈 편집 경험을 설계하는 시니어 Product
Designer다. DWP 전자결재의 임시 저장 목록과 이어 쓰기, version conflict, 네트워크 실패를
안전하게 복구하는 화면을 설계하라. 코드는 만들지 않는다.

DWP 글로벌 shell과 전자결재 사이드바를 유지한다. drafts는 별도 문서 저장소나 협업 에디터가
아니다. 현재 request draft API, owner scope, expected version, published template 계약에 맞춘다.

### 사용자·권한·목적

- 사용자: 자신이 만든 draft를 읽고 수정할 권한이 있는 구성원.
- 질문: “어디까지 저장됐고 어떤 초안을 안전하게 이어 쓸 수 있는가?”
- 주 행동: draft 선택→이어 쓰기.
- 보조 행동: 새 기안, 안전한 삭제/폐기는 API가 있을 때만.
- 다른 사용자의 draft, 관리자 전체 draft, 공유 공동편집은 제공하지 않는다.

### 현재 구현과 목표

현재 draft 목록, request detail, query deep link, 부분 저장과 expected version update가 있다.
목록→작성 재개는 `EXISTING`이다. 자동 저장, draft 삭제, revision history, 공동편집은 현재 public
API가 없으므로 `CONTRACT_FIRST`다.

### 1440px 구성

1. 제목, 실제 draft 수, 검색/정렬, `새 결재 작성`.
2. 비교 가능한 list/table: 번호, 제목 또는 미완성 표시, 양식, 수정 시각, 작성 완성도는 실제
   schema 기반일 때만, 저장 version, 경고 상태.
3. 선택 시 compact preview/drawer: 주요 입력, 연결 Form/Workflow version, 마지막 저장,
   validation issue, `이어서 작성`.
4. 미완성 제목을 `(제목 없음)`처럼 정직하게 표시하며 자동 생성 제목을 사실처럼 만들지 않는다.
5. 목록 실패를 0건 empty로 보여 주지 않는다.

### 이어 쓰기와 복구

- row 선택 → detail 권위 확인 → `/approvals/requests/new?draft=...`에서 hydrate.
- loading 중 이전 draft 내용을 표시하지 않는다.
- 저장 실패 → 입력은 local component state에 보존, 서버 저장 여부를 확정하지 않음.
- 결과 불명 → `저장되지 않음`으로 단정하지 않고 최신 version을 확인하는 흐름 제공.
- 409 → 사용자 변경과 서버 최신을 field/section 단위로 비교하는 목표. diff API가 없다면
  `CONTRACT_FIRST`; 최소 baseline은 입력 보존+최신 재조회+명시적 재적용.
- Form/Workflow가 더 이상 게시되지 않음 → 기존 draft의 읽기/보존 범위와 submit 차단을 구분.
- 권한 회수/identity 전환 → 열린 detail, 입력, dialog, toast를 즉시 격리한다.
- browser close 경고는 실제 unsaved local change가 있을 때만.

### 자동 저장 목표

자동 저장을 제안할 수 있지만 current로 표시하지 않는다. debounce, stable idempotency key,
single-flight, pending close serialization, offline queue 여부, identity/version binding, 409 draft
preservation, saving/saved/error의 실제 서버 근거가 필요하다. 단순 “저장됨” label만 추가하면 실패다.

### 필수 상태

- draft 여러 건 / 실제 0건 / 검색 0건
- 목록 loading/error/partial
- detail loading/error/권한 회수
- 저장 중/성공/실패/결과 불명
- 409 concurrent update
- published Form retired 또는 binding 변경
- 긴 제목·제목 없음·100개 draft 목표 pagination
- offline에서 작성 후 online 복구 목표

### 모바일·접근성

- 390px는 draft 목록→preview/작성으로 drill-in. desktop table을 가로 스크롤시키지 않는다.
- 저장 상태는 색뿐 아니라 명확한 문구와 시각을 제공한다.
- 돌아가기 시 목록 filter/scroll/row focus를 복원한다.
- conflict dialog는 변경값을 읽는 순서, 선택 가능한 해결, 취소, focus trap/opener restore를
  명세한다.
- 320px/200%, dark, forced colors, screen reader status, 44px target을 포함한다.

### 반환물·실패 기준

1440 list+preview, 390 list→resume, empty, list error, retired template, save failure, 409를 제출한다.
`EXISTING`과 autosave/diff/delete `CONTRACT_FIRST`를 분리한다.

수정 시각 없이 `저장됨`을 표시하거나, conflict에서 한쪽 내용을 자동 폐기하거나, 권한 회수 뒤
draft preview를 남기거나, 목록 실패를 빈 초안으로 표현하면 실패다.
