# 04. 모바일 결재 처리·배치 결과

화면 ID: `APR-04` · 위치: APR-02/03 모바일 변형 · 우선순위: D1

## Design AI에 전달할 원문

당신은 모바일에서 고위험 업무를 안전하게 처리하는 시니어 Product Designer다. DWP 전자결재
결재함을 390×844와 320×568에서 손가락·키보드·screen reader로 완결할 수 있게 설계하라.
데스크톱 3열을 축소한 그림이 아니라 목록→상세→확정→복귀의 모바일 전용 정보 구조를 만든다.

이 요청은 APR-02와 APR-03의 반응형 디자인이다. 새 route, 하단 탭 bar, 별도 모바일 앱을
만들지 않는다. DWP 상단 shell과 drawer, 현재 permission/version/fail-closed 계약을 유지한다.
APR-02/03의 1440px 승인본과 동일한 정보·행동·상태를 보존하되 작은 화면의 순서만 바꾼다.

### 사용자·목적

- 사용자: 이동 중 자신의 승인 Task를 검토하는 직접 결재자 또는 유효 대리인.
- 질문: “작은 화면에서도 대상을 혼동하지 않고 근거를 확인한 뒤 안전하게 결정할 수 있는가?”
- 주 행동: 한 Task의 상세 검토와 명시적 결정.
- batch는 보조 mode이며 빠른 swipe 승인보다 사전 재검증과 결과 이해가 우선이다.

### 모바일 구조

1. 목록 화면: 현재 queue, 건수/신선도, 검색, filter, selection mode trigger, task rows.
2. 제품 drawer: `결재함` disclosure 아래 4개 queue. 단순 닫기·취소 시 `결재함` disclosure
   trigger로 focus를 복원하고, 하위 queue 선택 시 route 갱신 뒤 본문의 현재 queue heading으로
   focus를 이동한다.
3. detail 화면: 뒤로, 번호·제목·상태·기한, 근거 brief, workflow, payload, timeline, action footer.
4. 결정 dialog 또는 full-height sheet: 대상·영향·사유·확정/취소. 키보드가 입력과 오류를 가리지
   않는다.
5. 성공 후 목록 복귀: 이전 queue, 검색, scroll, 원 Task 위치를 보존하고 다음 focus를 명시한다.

### 한 손·터치·gesture 원칙

- 모든 주요 touch target은 최소 44×44px.
- swipe approve/reject를 기본으로 두지 않는다. 제공하더라도 노출된 버튼 대안과 undo가
  실제 계약으로 있어야 한다.
- checkbox와 row open target이 겹치지 않는다.
- sticky footer의 승인·반려는 색뿐 아니라 아이콘/텍스트/순서로 구분한다.
- 위험 행동은 edge gesture나 accidental back으로 제출되지 않는다.

### batch 모바일 흐름

- `선택`을 눌러 selection mode에 들어가고, 화면 제목이 선택 수와 최대 20을 알린다.
- 현재 보이는 필터만 전체 선택하는지, 전체 결과를 선택하는지 정확히 표시한다.
- batch action 전 대상 수, 처리 가능, 제외를 summary sheet에서 검토한다.
- 실행 중 single-flight. 결과는 성공·충돌·권한 상실·건너뜀을 행별로 표시한다.
- 닫을 때 실패한 항목이 있는 목록 위치로 돌아가며 성공한 항목을 다시 선택하지 않는다.
- 네트워크 단절 결과가 불명확하면 성공/실패로 추정하지 않고 `결과 확인 필요`로 표시한다.

### 필수 상태

- populated list, detail, decision dialog
- drawer queue 전환
- search empty와 실제 empty
- skeleton loading과 incremental detail loading
- 503 stale read-only, offline banner
- 403/revoked 후 detail 제거와 목록 복귀
- 409 다른 처리자 결정
- long title, 긴 사유, 50-field document, 20-step timeline
- virtual keyboard open, orientation change, browser text 200%
- batch 1건/20건/처리 가능 0건/부분 결과/결과 불명

### 접근성·focus·screen reader

- 목록에서 detail을 열면 h1/h2 또는 detail back control로 예측 가능한 focus 이동.
- 뒤로 가면 원 row의 open target으로 focus 복원. 행이 사라졌으면 queue heading/status로 이동.
- status update는 짧게 한 번 알리고 timer/clock tick을 반복 낭독하지 않는다.
- dialog/sheet는 `aria-modal`, label/description, trap, Escape/시스템 back 정책, opener 복원을 명세한다.
- 배치 checkbox는 제목을 포함한 접근 이름과 selected state를 가진다.
- bottom footer가 focus outline, inline error, toast를 가리지 않는다.

### 시각·반응형

- 390px에서 한 작업면, 320px에서 모든 metadata가 자연스럽게 줄바꿈한다.
- priority/risk/status chip을 한 행에 억지로 모두 넣지 않는다.
- body 4.5:1, component/focus 3:1. dark/forced colors에서도 선택·위험·disabled가 구분된다.
- reduced motion에서 pane slide는 즉시 전환 또는 짧은 fade로 대체한다.
- iOS/Android safe area와 browser toolbar 변화에도 footer가 내용 위를 덮지 않는다.

### 반환물·실패 기준

390 정상 목록/상세/결정/복귀, 320 long-content, drawer, offline, revoked, conflict, batch 전후를
제출한다. 각 프레임에 focus target, scroll 유지, live message, touch target을 표시한다.

desktop pane을 390px로 줄인 시안, 하단 action이 키보드에 가린 시안, swipe만으로 결정하는 시안,
back 이후 다른 Task를 여는 시안, 부분 결과를 toast 하나로 숨기는 시안은 실패다.
