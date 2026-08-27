# DWP-R1-CAL-001 Enterprise Calendar

- 상태: Implemented · Scheduling hardening v1.2
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

- 오늘 홈: 다음 일정, 회의 참여, 시간 요약, 오늘의 흐름, 주간 리듬, 시간 코치
- 일정: 주·월·날짜별 목록, 빈 시간 생성, 반복 일정, 참석자·자원 포함 수정·취소, RSVP
- 집중 계획: 주간 집중 목표, 향후 집중·업무 블록, 개인 free/busy 기반 90분 추천과 일정 생성
- 초대 및 응답: 응답 상태·충돌 요약, 상태 필터, 참석·미정·불참과 상세 확인
- 가용 시간: People 구성원 최대 20명, 14일 범위, 근무시간·시간대 기반 후보
- 공간 연계: 일정 작성기 회의실 선택과 Workplace 공간 탐색 문맥 링크
- 시간 인사이트: 회의·집중·과부하·충돌, 설명 가능한 개인 권장사항
- 운영: 집계 현황, 예약 승인함, 자원 CRUD, 일정 정책
- 반응형: Desktop 주간 보기, Mobile 날짜별 목록 기본, 모바일 전체 Dialog
- 다국어: 한국어·영어 화면 및 날짜·시간 형식

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

상세 설계와 단계별 출시 게이트는
[`08-scheduling-hub-v1.2-v1.4-design.md`](./08-scheduling-hub-v1.2-v1.4-design.md)를 따른다.

## 실행 검증 증거

- 일반 구성원 `minseo.kim@sk.com`으로 반복 일정·필수 참석자·회의실 생성 성공
- 참석자와 회의실을 함께 변경한 뒤 참석자, 자원 예약, 낙관적 version 갱신 확인
- 두 번째 일정이 첫 일정의 미래 반복 회차와 겹칠 때 HTTP `409` 확인
- 비관련 `CALENDAR_ADMIN`이 공유 캘린더의 `CONFIDENTIAL` 일정 상세를 받지 않음
- 취소 시 Event와 Booking이 함께 `CANCELLED`, 생성·수정·취소 감사 이벤트 3건 확인
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
