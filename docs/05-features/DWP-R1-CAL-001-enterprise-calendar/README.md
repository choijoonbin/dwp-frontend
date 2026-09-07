# DWP-R1-CAL-001 Enterprise Calendar

- 상태: Implemented · Scheduling hardening v1.2 · Sharing UX P0 verified
- 사용자 진입점: `/calendar/home`
- 관리자 진입점: `/calendar/admin/overview`
- 리소스: `APP.CALENDAR`, `ADMIN.CALENDAR`

## 2026-08-26 경험 고도화 결정

### 사용자와 운영 질문

- 주 사용자: 본인의 일정과 집중 시간을 계획하고 다른 구성원과 회의를 조율하는 구성원
- 핵심 질문: “지금 무엇에 시간을 써야 하고, 누구와 언제 만날 수 있으며, 어떤 결정이 남았는가?”
- 핵심 행동: 일정 생성, 집중 시간 보호, 초대 응답, 공통 가용 시간 탐색
- Page archetype: Today는 command center, Calendar는 temporal workspace, Focus plan과
  Invitations는 workflow/list-detail, Availability는 focus form이다.

### 사용자 정보구조

```text
시작
└─ 오늘
계획
├─ 일정
└─ 집중 계획
협업과 예약
├─ 초대 및 응답
└─ 가용 시간 찾기
분석
└─ 시간 인사이트
```

관리 Surface는 사용자 Sidebar와 분리해 `운영 현황`, `일정 정책`만 유지한다. 외부 예약
페이지, 일정 투표, 공유 캘린더·연동 설정은 서버 계약 없이 빈 메뉴로 노출하지 않는다.

### 도메인 경계

- Calendar는 일정, 참석, 반복, free/busy, 회의실 일정 연결, RSVP와 시간 정책을 소유한다.
- Workplace는 물리 공간·좌석·장비 원장, 지도, 비회의 자원 예약과 현장 운영을 소유한다.
- 캘린더에서는 일정 작성기의 회의실 선택과 Availability의 문맥 링크로 Workplace를 연결한다.
  좌석·장비 탐색을 Calendar 최상위 메뉴로 복제하지 않는다.
- Work는 업무 원본의 우선순위·마감·예상 소요시간을 소유한다. Focus plan은 현재 Calendar의
  FOCUS/TASK 이벤트만 사용하고, Work 자동 배치는 읽기 계약과 명시적 미리보기·적용·되돌리기
  계약이 생긴 뒤 확장한다.
- Notifications는 초대·변경·리마인더 전달을, Provider Adapter는 Google/Microsoft 동기화를
  소유한다.

### 글로벌 기능 레퍼런스에서 채택한 계약

| 제품              | 검증된 장점                                                    | DWP 적용                                           |
| ----------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| Google Calendar   | 충돌 캘린더를 확인하는 예약 페이지, 버퍼·예약 한도, Focus time | Booking pages 후속 계약, 집중 목표·블록            |
| Microsoft Outlook | Scheduling Assistant, Room Finder, Scheduling Poll             | Availability와 회의실 선택 결합, Poll 후속 계약    |
| Calendly          | 재사용/일회성 링크, Poll, 상태 중심 Scheduling hub             | Booking pages와 Poll의 수명주기 모델               |
| Reclaim           | 업무·습관·집중 시간을 구분한 스마트 시간 보호                  | Focus와 TASK를 분리하고 추천은 사용자 확인 후 적용 |
| Notion Calendar   | 빠른 예약 링크, 다중 캘린더·시간대·회의 방식 설정              | Calendar source rail과 개인 설정 후속 계약         |

공식 참고 자료:

- [Google Calendar appointment schedules](https://support.google.com/calendar/answer/10729749?hl=en)
- [Google Calendar focus time](https://support.google.com/calendar/answer/11190973?hl=en-GB)
- [Microsoft Outlook Scheduling Poll](https://support.microsoft.com/en-us/outlook/create-a-scheduling-poll-in-outlook-for-windows)
- [Calendly Scheduling page](https://help.calendly.com/hc/en-us/articles/360022356594-Home-page-overview?locale=en-us)
- [Reclaim Tasks, Habits and Focus Time](https://help.reclaim.ai/en/articles/11325700-habits-vs-tasks-vs-focus-time-when-to-use-each-in-reclaim)
- [Notion Calendar scheduling and availability](https://www.notion.com/help/availability-blocking-and-time-zones)

### 단계별 목표

1. v1.1: Focus plan, Invitations, 작업 가능한 Today signal, freshness, 캘린더 소스 선택,
   Availability 입력 snapshot, 키보드·ARIA 계약을 완성한다.
2. v1.2: 참석자 free/busy와 Room Finder를 Event editor에 결합하고, 날짜·보기·소스·필터를
   URL/saved view로 보존한다. 결합 평가의 privacy, criteria hash, freshness, DST와 source
   completeness를 적용한다.
3. v1.3: 개인/팀 Booking pages와 예약자의 변경·취소 수명주기를 추가한다.
4. v1.4: Scheduling Poll을 후보·투표·hold·합의·확정 상태로 추가한다.
5. Adapter: OAuth/Webhook과 공급사 Tenant 준비 후 Google Workspace·Microsoft 365 양방향
   동기화와 Meet·Teams 링크 발급을 추가한다.

## 제공 범위

- 오늘 홈: 다음 일정과 회의 참여, 실제 일정 사이의 열린 시간, 응답·충돌 확인 목록,
  집중 목표와 주간 리듬을 실행 순서로 제시하는 Today command center
- 일정: 주·월·날짜별 목록, 빈 시간 생성, 반복 일정, 참석자·자원 포함 수정·취소, RSVP
- 집중 계획: 주간 집중 목표, 향후 집중·업무 블록, 개인 free/busy 기반 90분 추천과 일정 생성
- 초대 및 응답: 응답 상태·충돌 요약, 상태 필터, 참석·미정·불참과 상세 확인
- 가용 시간: People 구성원 최대 20명, 14일 범위, 근무시간·시간대 기반 후보
- 공간 연계: 일정 작성기 회의실 선택과 Workplace 공간 탐색 문맥 링크
- 시간 인사이트: 회의·집중·과부하·충돌, 설명 가능한 개인 권장사항
- 운영: 집계 현황, 예약 승인함, 자원 CRUD, 일정 정책
- 반응형: Desktop 주간 보기, Mobile 날짜별 목록 기본, 모바일 전체 Dialog
- 다국어: 한국어·영어 화면 및 날짜·시간 형식

## 2026-09-03 Today와 Schedule 분리 결정

`오늘`은 더 이상 `일정`의 축약 그리드가 아니다. 두 메뉴는 다음과 같이 독립 책임을 갖는다.

| Surface | 사용자가 해결하는 질문                               | 소유하는 상호작용                                                                            |
| ------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 오늘    | “지금부터 무엇을 실행하고 무엇을 확인해야 하는가?”   | 지금/다음 일정, 참여·상세, 응답, 실제 열린 시간의 Focus 전환, 확인할 일, 집중 목표·주간 신호 |
| 일정    | “언제 무엇을 배치하고 어떤 캘린더를 함께 볼 것인가?” | 일·주·월·목록 보기, 소스 선택·즐겨찾기·공유, saved view, 빈 영역 생성, drag/resize           |

- Today는 `GET /v1/calendar/home`의 서버 `generatedAt`에 단조 증가 시계를 결합해 상대 시간과
  진행 상태를 갱신하며 30초마다 새 snapshot을 요청한다. 2분이 지난 성공 응답도 읽기 전용
  `STALE`로 전환하고, 응답 날짜·시간대가 요청 문맥과 다르면 데이터를 노출하지 않는다.
- 당일 요약은 `today` 이벤트에서 다시 계산하고, 서버 `metrics`는 주간 집중 목표와 브리핑에만
  사용한다. 취소된 일정은 제외하고 DST·자정 경계를 당일 시간대로 절단한다.
- 30분 이상으로 확인된 실제 간격만 열린 시간으로 제시한다. 마지막 열린 시간은 Calendar 정책을
  현재 조회에서 검증한 경우에만 근무 종료 시각까지 확장한다. 최초 실패뿐 아니라 성공 데이터가
  남은 상태의 재조회 5xx·권위 거부에서도 캐시된 근무시간을 폐기하고 이를 추정하거나 생성하지 않는다.
- 지나간 일정은 접힌 기록으로 분리해 현재·다음 일정과 실행 가능한 빈 시간을 먼저 제시한다.
- 열린 시간 CTA는 기존 일정 작성기의 `FOCUS` 초안으로 연결한다. 사용자가 저장하기 전에는 자동으로
  일정을 변경하지 않는다.
- 홈 빠른 실행은 기존 canonical event type인 회의, 집중, 업무 시간 블록, 부재 시간 블록을 모두
  제공한다. 비회의 유형에서는 참석자·회의실·화상회의·응답 요청을 UI와 mutation payload 양쪽에서
  제거하며, 실패 후 동일 사용자 의도 재시도에는 같은 idempotency key를 유지한다. 네 유형 모두
  palette→작성기→실제 POST를 실행형 회귀로 고정하고 서로 다른 생성 의도에는 별도 key를 사용한다.
- Home이 검증한 지역 시간대는 작성기의 기본 이벤트 시간대와 DateTime picker context에 함께 전달한다.
  따라서 브라우저 OS 시간대와 사용자 지역 설정이 달라도 벽시계, 저장 UTC 구간과 반복 기준 시간대가
  하나의 문맥으로 유지되며 기존 일정 편집에서는 일정 자체 시간대가 우선한다.
- Home은 캘린더 소스, week/month toolbar, drag/resize를 소유하지 않는다. 이 경계는 전용 모델 단위
  테스트와 Chromium/mobile E2E로 고정한다.
- 일시적인 5xx/네트워크 장애에서는 마지막 검증 데이터를 읽기 전용으로 유지하고, 401/403/404 등
  권위 거부에서는 캐시된 일정·상세·작성 동작을 즉시 폐기한다.
- 1280px 이상은 Today 흐름과 304px 브리핑을 한 연결 표면에 배치하고, 그 아래는 브리핑 Drawer,
  320px·200%에서는 단일 열 실행 흐름으로 전환한다. dark/forced-colors/reduced-motion/Axe를 모두
  출시 게이트로 유지한다.

설계 방향은 빠른 참여와 당일 실행을 제공하는 Outlook My Day, 일정 충돌을 피하는 Google 예약
가용성, 사용자 확인 후 시간 블록을 적용하는 Reclaim의 장점을 취한다. Calendar source의 문맥별
전환은 Fantastical Calendar Sets를 후속 saved-view 고도화 기준으로 사용한다.

- [Outlook My Day](https://support.microsoft.com/en-US/Outlook/calendar/use-my-day-with-to-do-in-outlook)
- [Google Calendar appointment availability](https://support.google.com/calendar/answer/10729749?hl=en)
- [Reclaim scheduling priorities](https://help.reclaim.ai/en/articles/6207587-how-reclaim-manages-your-schedule-automatically)
- [Fantastical Calendar Sets](https://flexibits.com/fantastical/help/calendar-sets)

## SKAX Seed

- People 원장과 IAM이 연결된 SKAX 구성원 178명 전원의 개인 캘린더 178개
- 활성 일정 1,122개: 회의 714, 집중 178, 업무 178, 부재 17, 리마인더 35
- 구성원 간 참석 관계 889개와 IAM·People identity bridge 178개
- 회사 캘린더 1개, 플랫폼 캘린더 1개
- 자원 8개: 회의실 6, 좌석 1, 장비 1
- 충돌 없이 시간·공간에 분산된 활성 자원 예약 222개: 확정 192, 승인 대기 30
- 이름·회사 이메일·응답 상태·일정 유형·시간을 결정적으로 변형해 DB 재구축 결과를 재현
- 기존 `member{id}@sk.com` 임시 참석자 0개
- 캘린더 관리자 그룹 1개, 위임 사용자 1명

## 검증 시나리오

1. 일반 구성원이 홈·일정·인사이트와 개인 일정만 본다.
2. 반복 일정이 화면과 가용 시간 계산에 같은 occurrence로 반영된다.
3. 타인 가용 시간 조회 응답에 일정 제목·메모가 포함되지 않는다.
4. 승인형 자원 일정 생성 시 예약이 `PENDING`이다.
5. `CALENDAR_ADMIN`만 승인 결정을 수행하고 결정 사유가 감사에 남는다.
6. 일정 취소 시 이벤트와 예약이 함께 `CANCELLED`다.
7. 일반 Tenant 관리자는 관리자 조회만 가능하고 정책 변경·승인은 거부된다.
8. Desktop 1280x720, Mobile 390x844에서 페이지 가로 overflow와 UI 중첩이 없다.
9. 일정 행에 중첩 button이 없고 브라우저 console error가 없다.
10. 반복 자원의 미래 occurrence와 겹치는 요청은 `409 RESOURCE_CONFLICT`로 거부된다.
11. 공유 캘린더의 비공개·기밀 일정은 비관련 사용자의 일정 피드에서 제외된다.
12. 반복 일정은 이벤트 시간대 현지 시각을 유지해 DST 전후에도 같은 시각에 표시된다.
13. 초대 응답은 `APP.CALENDAR:UPDATE`가 있을 때만 mutation을 보내고 읽기 전용 사용자는
    상태와 상세만 확인한다.
14. 집중 추천은 기존 일정·근무시간을 존중하며 사용자가 선택하기 전에는 일정을 생성하지 않는다.
15. Availability 결과 이후 참석자·기간·소요시간이 바뀌면 이전 결과를 폐기한다.
16. 참석자 식별자는 POST body로만 전송하고 임의·타 Tenant UUID를 가용으로 처리하지 않는다.
17. 추천 시간 적용 후 People과 Room을 새 기준으로 함께 재평가하며 만료된 snapshot은 적용하지
    않는다.
18. 일정 보기 변경 후 브라우저 back/forward가 URL, 캘린더 보기와 선택 source를 함께 복원한다.
19. 일정 피드 조회가 실패해도 검증 완료된 캘린더 source 목록·선택·공유 관리는 유지되고,
    일정 격자만 독립 오류 상태로 전환된다.
20. 일정·초대별 상세/응답 행동은 이벤트 제목을 포함한 고유 접근 이름을 제공한다.
21. 회사 캘린더의 선택 문맥이 게시/휴지통 tab과 panel의 접근 이름에 연결되며,
    320px·200% 텍스트 확대에서도 상단 행동이 겹치거나 가로로 넘치지 않는다.
22. `오늘`에는 일정 보기 toolbar·source picker·drag/resize가 없고, `일정`에는 전체 시간 그리드와
    캘린더 소스 관리가 존재해 두 메뉴의 목적과 H1이 중복되지 않는다.
23. Home의 열린 시간은 서버 snapshot 기준 실제 일정 간격에서만 생성되며 Focus 작성기에 정확한
    시작·종료를 전달한다.
24. Home의 당일 건수·회의·집중 합계는 주간 집계가 아니라 `today` 이벤트로 계산하고, 정책이
    확인된 경우에만 근무 종료까지 마지막 열린 시간을 표시한다.
25. 사용자의 지역 시간대 변경은 Home API query, 날짜·시간 표시와 일정 작성기의 picker·POST에 함께
    적용되며, 다른 시간대나 날짜 문맥으로 응답한 snapshot은 fail-closed 처리한다.
26. Home의 상대 시간은 화면을 다시 열지 않아도 진행되고, 주기적 재조회에도 2분 이상 갱신되지
    않은 성공 응답은 읽기 전용으로 전환한다.
27. 빠른 실행의 MEETING·FOCUS·TASK·OUT_OF_OFFICE는 모두 실제 POST까지 연결된다. 비회의 유형은
    회의실·참석자·화상회의 메타데이터를 전송하지 않으며, transient 실패 후 재시도해도 동일
    idempotency key를 사용하고 별도 사용자 의도 간에는 key를 재사용하지 않는다.
28. 정책 warm cache가 재조회 5xx 또는 401/403/404로 무효화되면 Home 본체는 유지하되 근무 종료까지의
    마지막 열린 시간과 근거 없는 Focus CTA는 즉시 제거한다.

상세 설계와 단계별 출시 게이트는
[`08-scheduling-hub-v1.2-v1.4-design.md`](./08-scheduling-hub-v1.2-v1.4-design.md)를 따른다.

## 실행 검증 증거

- 일반 구성원 `minseo.kim@sk.com`으로 반복 일정·필수 참석자·회의실 생성 성공
- 참석자와 회의실을 함께 변경한 뒤 참석자, 자원 예약, 낙관적 version 갱신 확인
- 두 번째 일정이 첫 일정의 미래 반복 회차와 겹칠 때 HTTP `409` 확인
- 비관련 `CALENDAR_ADMIN`이 공유 캘린더의 `CONFIDENTIAL` 일정 상세를 받지 않음
- 취소 시 Event와 Booking이 함께 `CANCELLED`, 생성·수정·취소 감사 이벤트 3건 확인
- Dark와 forced-colors에서 핵심 사용자/회사 관리 화면의 텍스트·경계·선택 상태 시각 회귀 확인
- Seed 반복 occurrence를 90일 펼친 자원 중복 예약 0건 확인
- Auth 구성원 ID와 Platform 개인 캘린더 소유자 집합 178건 일치 확인
- 구성원별 활성 소유 일정 최소 6개, 참석자 identity 불일치 및 활성 예약 겹침 0건 확인

## 데이터베이스 이력

- Platform `V69`: 캘린더 도메인·SKAX 일정·자원 Seed
- Platform `V71`: IAM·People identity bridge와 예약 승인 거버넌스
- Platform `V72`: 충돌 없는 Seed 재배치와 활성 예약 GiST exclusion constraint
- Platform `V74`: SKAX 구성원 178명 전체 일정·참석·부재·리마인더·자원 예약 Seed
- Platform `V75`: 리마인더와 회의·자원 일정의 사용자 화면 중첩 제거
- Platform `V76`: 부재 일정과 동일 사용자의 자원 예약 충돌 제거
- Auth `V51`: 캘린더 앱·관리 권한·위임 역할·SKAX 관리자 그룹

## 외부 준비가 필요한 후속 범위

Google Workspace·Microsoft 365 양방향 동기화, Meet·Teams 링크 발급, 외부 Poll·예약
페이지는 공급사 Tenant와 OAuth/Webhook 정보가 준비된 뒤 Adapter 단계로 진행한다.
