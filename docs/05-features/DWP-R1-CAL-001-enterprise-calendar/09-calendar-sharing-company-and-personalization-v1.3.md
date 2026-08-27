# Calendar company sharing and personalization v1.3

- 상태: P0 설계 승인, 구현·검증 진행
- 기준일: 2026-08-27
- 검토: Product Design, Calendar Architecture/Security, Quality/Privacy expert review

## 1. 목표와 비목표

Calendar의 상위 사용자 메뉴는 늘리지 않는다. 회사·내 캘린더·공유받은 캘린더는
`일정` 화면의 source rail에서 하나의 시간축으로 조합한다.

이번 버전의 P0 목표는 다음과 같다.

- 회사 관리자가 게시한 회사 캘린더를 모든 활성 구성원이 기본으로 본다.
- 개인 캘린더는 소유자 또는 명시적 Grant 대상만 목록과 일정에 접근한다.
- `VIEW_FREE_BUSY`는 시간 구간만, `VIEW_DETAILS`는 비공개가 아닌 상세만 본다.
- 권한 없는 calendar/event ID는 목록·딥링크·직접 API에서 동일하게 노출하지 않는다.
- 캘린더 즐겨찾기·선택 상태와 일정 별표는 사용자 개인 상태로 저장한다.
- 일정 중요도는 공유되는 일정 속성으로 저장한다.
- 삭제는 주최자 취소/휴지통, 참석자의 내 캘린더에서 제거, 회사 관리자의 보관을
  구분한다.

외부 Calendar Adapter, 공개 링크 공유, 외부 도메인 공유는 별도 보안 게이트 전에는
허용하지 않는다.

## 2. 정보 구조와 UI

```text
일정
├─ 즐겨찾는 캘린더
├─ 회사 캘린더          tenant Grant, 기본 표시, 구성원 read-only
├─ 내 캘린더            owner
├─ 나에게 공유됨        explicit person/group Grant
└─ 팀 캘린더            explicit tenant/group/person Grant
```

- 1280px 이상: 264px source rail과 시간 격자를 같은 surface에 배치한다.
- 900–1279px: 접이식 source rail을 제공한다.
- 899px 이하: `캘린더` 버튼이 전체 화면 source sheet를 연다.
- 각 소스는 소유 유형, 권한 수준, 필수 구독 여부를 텍스트와 아이콘으로 표시한다.
- 일정 drawer 상단에는 별표와 중요도를, 하단에는 서버가 허용한 action만 표시한다.
- 허용되지 않은 삭제는 버튼을 단순히 숨기지 않고 회사 일정/공유 일정/초대 일정의
  이유를 설명한다.

시각 언어는 얇은 경계, 중립 paper surface, 절제된 semantic color, 충분한 여백을
사용한다. 장식적 gradient와 과도한 카드 중첩은 사용하지 않는다.

## 3. 권한 모델

| Access           | 상세                            | 일정 쓰기      | 공유 관리 |
| ---------------- | ------------------------------- | -------------- | --------- |
| `OWNER`          | 전체                            | 전체           | 전체      |
| `MANAGE`         | 일반 상세, 명시 허용 시 private | 생성·수정·취소 | 가능      |
| `EDIT`           | 일반 상세                       | 생성·수정      | 불가      |
| `VIEW_DETAILS`   | 일반 상세                       | 불가           | 불가      |
| `VIEW_FREE_BUSY` | 익명 busy 구간                  | 불가           | 불가      |
| `NONE`           | 존재 비노출                     | 불가           | 불가      |

권한 계산 순서는 `owner → active person/group/tenant Grant → event attendee → NONE`이다.
회사 관리자 권한은 회사 `SYSTEM` 캘린더에서만 `MANAGE`로 승격하며 개인 캘린더를
열람시키지 않는다. `PRIVATE/CONFIDENTIAL` 일정은 organizer/attendee 또는
`canViewPrivate=true` Grant가 아니면 busy block으로 축소한다.

서버는 Calendar에 `accessLevel`, `sourceKind`, `required`, `favorite`, `selected`,
`capabilities`를, Event에 `detailLevel`, `redacted`, `importance`, `starred`,
`capabilities`, `restrictionReason`을 반환한다. 클라이언트는 organizer ID로 권한을
재계산하지 않는다.

## 4. 데이터 경계

- `cal_calendar_access_grants`: tenant/person/group principal, access level, private 허용,
  유효기간, lifecycle, version.
- `cal_calendar_subscriptions`: person별 selected/favorite/order/color, version.
- `cal_event_user_preferences`: person별 starred/hidden, version.
- `cal_events`: importance, deleted timestamp/actor/reason, purge deadline, legal hold.
- 모든 신규 관계는 `(tenant_id, parent_id)` 복합 FK로 교차 tenant 삽입을 차단한다.
- 기존 `SYSTEM` 회사 캘린더와 명시적으로 전사 공개되던 `TEAM` 캘린더만 migration에서
  tenant Grant로 이관한다. 이후 생성되는 TEAM/SYSTEM은 Grant 없이는 공개되지 않는다.

## 5. API와 트랜잭션

- `GET /v1/calendar/calendars`
- `GET|PUT|DELETE /v1/calendar/calendars/{calendarId}/shares`
- `PUT /v1/calendar/calendars/{calendarId}/subscription`
- `PUT /v1/calendar/events/{eventId}/preference`
- 기존 event create/update/cancel 응답에는 capability와 importance를 additive하게 추가한다.
- 회사 캘린더 게시 명령은 `/v1/admin/calendar/company-calendars/**`에만 둔다.

명령은 `tenant + object FOR UPDATE → ACL/version 검사 → 변경 → audit/outbox → commit`
순서로 처리한다. 공유 철회·개인 설정 변경·회사 게시도 각각 한 DB transaction이다.
알림과 외부 Adapter 호출은 transaction 이후 outbox consumer가 수행한다.

## 6. 출시 게이트

- 미공유·철회·만료·cross-tenant 접근이 목록, 상세, direct ID에서 fail-closed.
- FREE_BUSY 응답에 title/description/location/attendee/email/original event ID가 없음.
- 회사 구성원은 읽기만, `ADMIN.CALENDAR:MANAGE`는 회사 일정만 관리.
- 즐겨찾기·별표 변경이 다른 사용자와 event version에 영향을 주지 않음.
- 회사/개인/공유 캘린더 source 선택과 이벤트 drawer가 1440/1280/390/320에서 동작.
- keyboard, focus return, live status, forced-colors, Axe serious/critical 0건.
- 기존 Calendar public API와 transaction 경계, recurrence/DST/resource conflict 회귀 없음.
