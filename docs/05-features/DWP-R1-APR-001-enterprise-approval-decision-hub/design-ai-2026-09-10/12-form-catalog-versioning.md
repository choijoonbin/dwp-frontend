# 12. 양식 카탈로그·버전·게시

화면 ID: `APR-12` · 경로: `/approvals/admin/forms` · 우선순위: D2

## Design AI에 전달할 원문

당신은 버전 관리되는 엔터프라이즈 업무 양식 카탈로그를 설계하는 시니어 Product Designer다.
DWP 전자결재 양식 관리 화면을 카테고리 탐색→양식 선택→스키마/결재선 검토→독립 게시로
이어지는 정밀한 관리 workspace로 고도화하라. 코드는 만들지 않는다.

DWP 관리자 shell, MUI/design-system, Form·Workflow의 분리된 자산 모델과 maker-checker를
유지한다. 개인 기안 화면이나 범용 문서 저장소를 만들지 않는다.

### 사용자·권한·목적

- Designer: category/form create·update, 자신의 마지막 편집 자산 publish 금지.
- Publisher: form/schema/route diff 검토와 publish, draft 내용 편집 금지.
- Auditor: metadata/version/evidence read-only.
- 질문: “어떤 양식의 어떤 버전이 어느 Workflow에 연결돼 있고 게시 준비가 되었는가?”
- 주 행동: 양식 선택, 허용된 draft 편집 또는 독립 게시 검토.

### 현재 구현

계층 category, 한영 metadata, icon/sort/active, search, form list, Form kind, owner group,
lifecycle/current version, field/route/usage count, detail schema/hash, 기본 Workflow route, field
builder, create/update/publish와 SoD가 있다. 이 범위를 `EXISTING`으로 유지한다.

게시본에서 새 draft branch, version diff, retire/restore, 배포 환경 promote/rollback은
`CONTRACT_FIRST`다. current frame에 활성 버튼을 만들지 않는다.

### 1440px 구조

1. 상단 compact signals: 전체/게시/draft/검토 필요 등 실제 계산 가능한 값만.
2. 좌측 240~300px category tree: 전체, hierarchy, child count, active/inactive, 검색과 keyboard
   tree semantics.
3. 중앙 list 340~440px: 이름, key, kind, lifecycle, current version, field/route/usage count,
   updatedAt, owner. 선택/검색/정렬이 안정적이어야 한다.
4. 우측 flexible inspector: 한영 metadata, schema summary/hash, fields, default Workflow·version·SLA,
   publish readiness, updated/published actor evidence.
5. create/edit는 APR-13의 dialog/workspace를 열고, inspector 선택·scroll을 보존한다.
6. publish 검토는 대상 version/hash, route, validation, 마지막 편집자, 영향 summary와 사유를
   보여 준다. 영향 count API가 없으면 임의 숫자를 만들지 않는다.

### 카테고리·자산 규칙

- cycle, cross-tenant parent, inactive parent binding을 서버가 거부한다.
- category inactive는 신규 기안 노출을 닫지만 기존 요청/증적을 삭제하지 않는다.
- 게시 Form은 활성 default Workflow가 없으면 publish할 수 없다.
- Form과 Workflow version을 하나의 숫자로 합치지 않는다.
- usage count가 0이라는 이유로 삭제 가능하다고 가정하지 않는다.

### 버전·배포 목표

별도 목표 frame에는 published immutable version→new draft branch→field/metadata/route diff→review
request→independent publish→canary/rollback evidence를 설계한다. 다음 API/원장이 필요하다고
표시한다.

- parent published version, draft revision, immutable diff
- reviewer/publisher decision, conflict, retirement/restore
- active binding impact와 in-flight request compatibility
- environment promotion/rollback 및 audit

이를 단순 `version + 1` 입력란이나 동일 row 덮어쓰기로 설계하지 않는다.

### 필수 상태

- populated catalog, no category/no form/search empty
- category query만 실패, form list만 실패, detail 실패
- designer/publisher/auditor persona
- draft ready/not ready/published/inactive
- self-publish blocked, 409 version conflict, stale route reference
- long category depth, 긴 한영 name, 1000 forms cursor 목표
- new revision/diff/retire 목표 frame

### 모바일·접근성

- 390px는 category selector sheet→form list→full inspector→edit/review. 3열 축소 금지.
- tree는 Arrow key/Enter/Space와 level/expanded/selected를 제공하며 drag만으로 정렬하지 않는다.
- status/hash/version label은 색 외 텍스트로 제공한다.
- dialog focus trap/opener restore, selection/scroll 유지, error status를 명세한다.
- 320px/200%, dark, forced colors, 긴 field list를 포함한다.

### 반환물·실패 기준

1440 3영역 정상, 390 mobile drill-in, partial errors, persona views, publish confirmation, version 목표를
제출한다. component anatomy와 current/contract-first mapping을 주석으로 표시한다.

카테고리·목록·inspector를 카드 속 카드로 채우거나, Designer가 자신의 변경을 게시하게 하거나,
게시본을 직접 편집하거나, 신규 version lifecycle을 이미 존재하는 것으로 표시하면 실패다.
