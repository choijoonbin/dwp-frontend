# 10. 결재 위임·대결

화면 ID: `APR-10` · 경로: `/approvals/delegations` · 우선순위: D2

## Design AI에 전달할 원문

당신은 부재 중 업무 연속성과 대표 행위 책임을 동시에 보장하는 위임 화면을 설계하는 시니어
Product Designer다. DWP 전자결재의 개인 위임·대결 생성, 수신 위임 확인, 예정/활성/종료,
철회를 설계하라. 디자인 명세만 반환한다.

DWP shell·전자결재 design-system·현재 delegation API를 유지한다. 위임은 권한 자체를 영구
복제하거나 모든 결재를 관리자에게 넘기는 기능이 아니다.

### 사용자·권한·목적

- 사용자: 자신에게 허용된 `MANAGE_SELF` 위임 범위를 관리하는 구성원.
- 질문: “언제, 어떤 Workflow의 결재를, 누구에게, 어떤 책임으로 맡기는가?”
- 주 행동: 후보 검증→범위·기간·사유 확인→위임 생성 또는 자신의 위임 철회.
- incoming/outgoing direction을 서버가 확인하지 못하면 행을 안전하게 표시하되 mutation을 열지
  않는다.

### 현재 계약

- scope: 모든 지원 Workflow 또는 특정 Workflow
- 기간: 시작/종료, 최대 90일
- 후보 검색: tenant/user exact identity, 본인 선택 금지
- 상태: 예정/활성/종료/철회
- outgoing/incoming, 대표 actor snapshot, version 기반 철회
- 목록·후보·published workflow 조회 실패를 각각 분리하고 권위 실패 시 저장 차단

금액·위험등급·업무유형 세분, overlap impact simulation, 조직 대체자 자동 추천은 현재 API에
없으므로 `CONTRACT_FIRST`다.

### 1440px 구조

1. 상단: 위임 목적, 현재 시간대, `새 위임 설정`.
2. `내가 맡긴 결재`와 `내가 대신 처리할 결재`를 명확히 구분한다. 상태 filter는 탭/segment로
   쓸 수 있으나 영구 사이드바 메뉴를 늘리지 않는다.
3. 행: delegate/delegator, scope, Workflow 이름, 기간·시간대, 상태, reason summary, 생성/철회 시각,
   실제 허용 action.
4. active delegation에는 대표 행위가 audit에 남는다는 짧은 설명과 상세 연결을 제공한다.
5. create dialog: 후보 autocomplete, scope segmented control, Workflow select, date-time range,
   reason, 영향 요약, 확인.

### 생성·철회 흐름

- dialog open 시 최신 목록·후보·Workflow 권위를 확인한다.
- 후보 선택 후 identity, active status, self 여부를 재검증한다.
- 날짜는 timezone/DST를 명시하고 종료가 시작보다 늦어야 하며 90일 상한을 보여 준다.
- overlap/conflict가 있으면 서버 근거로 설명한다. client만으로 허용하지 않는다.
- 제출 직전 후보·scope·period·identityKey를 재확인하고 single-flight로 전송한다.
- 철회는 delegation ID/version/direction을 고정하고 영향·즉시성·진행 중 Task 의미를 확인한다.
- 성공 후 목록과 실제 후보 Task 권위를 재조회한다. 기존 Task를 자동 이전/회수했다고 과장하지
  않는다.

### 필수 상태

- outgoing/incoming populated, 예정/활성/종료
- 실제 0건
- 목록 실패, 후보만 실패, Workflow만 실패
- 403 권한 회수/identity 전환
- candidate 없음/비활성/본인/다른 tenant
- 기간 오류/90일 초과/timezone boundary
- 409 overlap 또는 version conflict
- 생성/철회 진행·성공·결과 불명
- 상세 Workflow retired 또는 scope metadata 없음

### 관리자 확장 경계

전체 직원 위임 관리, 강제 대체, 비상 대리, escalation assignment는 개인 화면에 넣지 않는다.
관리자 계약은 APR-15의 `CONTRACT_FIRST` 목표다. 관리 권한이 있어도 사용자의 대표 행위 이력과
제한 본문을 무조건 열지 않는다.

### 모바일·접근성

- 390px는 방향별 section/list→상세 또는 create sheet. 날짜 선택과 keyboard가 footer를 가리지
  않는다.
- outgoing/incoming을 화살표 아이콘만으로 구분하지 않고 문구로 제공한다.
- 후보 option은 이름·이메일·직책이 길어도 구분되며 screen reader option label이 완전해야 한다.
- dialog focus trap/opener restore, inline error 연결, status/alert, 44px target을 명세한다.
- 320px/200%, dark, forced colors, reduced motion, 긴 조직명/Workflow를 검수한다.

### 반환물·실패 기준

1440 정상, 390 모바일, create, revoke, partial authority failure, 409, timezone boundary를 제출한다.
필드·권한·version·audit와 focus 흐름을 주석으로 표시한다.

위임을 영구 권한 부여처럼 표시하거나, 본인/비활성 후보를 허용하거나, incoming 위임을 사용자가
철회할 수 있게 하거나, 목록 실패 중 기존 dialog로 제출하면 실패다.
