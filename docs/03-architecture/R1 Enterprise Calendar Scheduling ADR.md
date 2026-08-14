# ADR: R1 Enterprise Calendar Scheduling

- 상태: Accepted and implemented
- 기준일: 2026-08-14
- 기능 ID: `DWP-R1-CAL-001`

## 1. 결정

DWP는 외부 메일·캘린더 런처인 `APP.MAIL_CALENDAR`와 별개로 네이티브 일정 도메인
`APP.CALENDAR`를 둔다. 네이티브 도메인은 일정·참석·반복·자원 예약·조직 정책·감사를
소유하며 외부 공급사 일정은 Adapter가 이 모델에 투영한다.

## 2. 모듈 경계

| 계층                         | 소유 책임                                                          |
| ---------------------------- | ------------------------------------------------------------------ |
| Frontend `features/calendar` | 사용자·관리자 정보구조, 화면 조합, Query cache와 상호작용          |
| Design System                | Date/Time, Autocomplete multi-select, Button, Dialog, 상태·표 규격 |
| Shared API                   | Calendar DTO와 Gateway API 계약                                    |
| Platform `calendar`          | 정책 검증, 반복 확장, free/busy, 예약 충돌, 승인, 감사             |
| Auth                         | `APP.CALENDAR`, `ADMIN.CALENDAR`, `CALENDAR_ADMIN`과 그룹 위임     |
| Gateway                      | 세션 검증, Tenant 경계, 최소 Permission Prefix 전달                |
| People                       | 구성원 검색과 영속 `person_public_id` 소유                         |
| External adapter             | Google/Microsoft 동기화, 회의 링크, Webhook 재처리                 |

R1의 추천과 충돌 계산은 결정론적 규칙이다. 일정 변경을 수행하는 AI Agent를 추가하지
않는다. 향후 Agent는 변경안 Preview를 만들 수 있지만 사람의 명시적 적용 확인과 같은
권한·감사 경계를 통과해야 한다.

## 3. 데이터 모델

| 테이블                  | 역할                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `cal_tenant_policies`   | 근무시간, 일정 길이, 사전 예약, 전환 여유, 집중·회의 기준  |
| `cal_calendars`         | 개인·팀·자원·시스템 캘린더와 가시성                        |
| `cal_events`            | 일정 원본, 유형, 시간대, 반복, 가시성, 외부 소스와 멱등 키 |
| `cal_event_attendees`   | 사용자·People 식별자, 이메일, 참석 유형과 RSVP             |
| `cal_resources`         | 회의실·좌석·장비, 위치, 수용 인원, 설비, 상태, 승인 정책   |
| `cal_resource_bookings` | 예약 기간, 승인 상태, 요청자·결정자·사유·버전              |
| `cal_identity_links`    | IAM user ID와 People public UUID의 런타임 브리지           |
| `cal_audit_events`      | 생성·변경·취소·응답·승인 전후 스냅샷과 Correlation ID      |

원본 이벤트는 반복 규칙을 보존하고 조회 범위에서 occurrence를 확장한다. free/busy도 같은
반복 규칙을 이벤트 시간대의 현지 시각 기준으로 확장해 화면의 일정과 가용 시간 판단이
어긋나지 않게 한다. 따라서 DST 전후에도 `09:00` 반복 일정은 현지 시각 `09:00`을 유지한다.
API 조회 범위는 370일, occurrence는 4,000개로 제한한다.

## 4. 식별자와 Tenant 경계

- IAM은 인증 사용자 ID를, People은 회사 인사 기준 public UUID를 소유한다.
- Gateway가 검증된 `X-DWP-User-ID`, `X-DWP-Tenant-ID`, `X-DWP-Person-Public-ID`를 전달한다.
- 검증된 사용자 진입점은 identity bridge를 멱등 갱신한다. UUID가 바뀌거나 마지막 확인 후
  15분이 지난 경우에만 행이 갱신되며 별도 짧은 트랜잭션으로 조회 트랜잭션과 분리한다.
- 모든 조회·변경 SQL은 tenant ID를 포함한다.
- 개인 캘린더 소유자, 일정 주최자, 참석자와 가용성은 person UUID를 우선 기준으로 계산해
  IAM 계정 재발급이나 Seed 재정렬에도 소유권과 관계를 유지한다. `user_id`는 기존 데이터에
  person UUID가 없는 경우에만 사용하는 명시적 호환 경계다.
- Platform `V92`는 기존 개인 캘린더 소유권을 person UUID로 승격하고 `V93`은 People 식별자가
  있는 참석자의 오래된 IAM 참조를 제거한다. 런타임 bridge는 캐시이지 업무 소유권 원장이
  아니므로 재구성할 수 있어야 한다.
- 조회 SQL은 현재 사용자 참석자를 단일 LATERAL 행으로 축약한다. 참석자 역할이 여러 개이거나
  과거 IAM 참조가 남아도 같은 occurrence가 중복 생성되지 않는다.

## 5. 권한 모델

| 역할               | 권한                                                       |
| ------------------ | ---------------------------------------------------------- |
| `WORKSPACE_MEMBER` | `APP.CALENDAR:VIEW/CREATE/UPDATE`                          |
| `TENANT_ADMIN`     | `ADMIN.CALENDAR:VIEW`만 제공, 운영 변경은 불가             |
| `CALENDAR_ADMIN`   | 사용자 캘린더 + `ADMIN.CALENDAR:VIEW/CREATE/UPDATE/MANAGE` |

SKAX 개발 Seed는 `SKAX_CALENDAR_ADMINS` 그룹에 이서연을 넣고 역할을 그룹 단위로
위임한다. 운영 배포에서는 SCIM/IAM 그룹 동기화가 이 멤버십을 대체한다. 감사 독립성을
위해 `AUDITOR`와 `CALENDAR_ADMIN`은 충돌 역할로 정의한다.

## 6. 개인정보·보안 결정

- 가용 시간 API는 타인의 일정 제목·설명·위치·참석자를 반환하지 않는다.
- `PRIVATE/CONFIDENTIAL` 일정은 본인·주최자·참석자만 상세 조회할 수 있다. 비관련 사용자의
  일정 피드에서는 제외하고 가용 시간 계산에는 제목 없는 busy 구간으로만 반영한다.
- 관리자 현황은 집계, 자원과 승인 대상 예약만 보여주고 개인 비공개 본문을 노출하지 않는다.
- 일정 변경·취소와 예약 결정은 작성자/기능 권한, Tenant, version을 함께 검증한다.
- 생성에는 클라이언트 멱등 키를 사용해 재전송 중복을 차단한다.
- 예약의 원본 기간은 PostgreSQL GiST exclusion constraint로 차단한다. 반복 예약의 미래
  occurrence는 자원별 transaction advisory lock을 획득한 뒤 서비스 검증으로 차단한다.

## 7. API 경계

### 사용자

- `GET /v1/calendar/home`
- `GET /v1/calendar/calendars`
- `GET /v1/calendar/events`
- `POST/PUT /v1/calendar/events`
- `POST /v1/calendar/events/{id}/response`
- `POST /v1/calendar/events/{id}/cancel`
- `GET /v1/calendar/availability`
- `GET /v1/calendar/resources`

### 관리자

- `GET /v1/admin/calendar/overview`
- `GET/PUT /v1/admin/calendar/policy`
- `GET /v1/admin/calendar/bookings/pending`
- `POST /v1/admin/calendar/bookings/{id}/decision`
- `POST/PUT /v1/admin/calendar/resources`

## 8. 상태와 동시성

- Event: `CONFIRMED -> TENTATIVE | CANCELLED`
- RSVP: `NEEDS_ACTION -> ACCEPTED | TENTATIVE | DECLINED`
- Booking: `PENDING -> CONFIRMED | DECLINED`, 모든 활성 상태에서 `CANCELLED`
- Event·Policy·Resource·Booking은 version 기반 compare-and-set을 사용한다.
- 승인형 자원은 일정 생성과 함께 `PENDING`, 즉시형은 `CONFIRMED`로 생성된다.
- 자원을 사용하는 반복 일정은 종료일이 필수이며 Tenant 사전 예약 한도를 넘을 수 없다.
- 일정 수정은 참석자·자원까지 하나의 트랜잭션으로 교체하고 기존 참석자의 RSVP는 보존한다.
- 승인형 자원의 시간·반복 조건이 바뀌면 예약 결정을 초기화하고 다시 `PENDING`으로 전환한다.
- 일정 취소 시 연관된 예약도 같은 트랜잭션에서 취소된다.

동시 생성 요청은 `tenant + resource` advisory lock으로 직렬화한다. 잠금 이후 요청·기존 반복
occurrence를 모두 검사하고, 마지막 방어선으로 원본 예약 기간 exclusion constraint를 적용한다.

## 9. 외부 연동 포트

외부 공급사는 `source_type/source_ref`와 별도 연결 Credential을 사용한다. 동기화는
외부 ID + 변경 버전으로 멱등 처리하고, Webhook 수신·증분 Pull·재조정 Job을 함께 둔다.
회의 링크 발급 실패가 일정 전체 생성 실패로 이어지지 않도록 후속 상태와 재시도를 분리한다.

## 10. 결과

이 결정으로 DWP는 즉시 사용할 수 있는 네이티브 캘린더를 가지면서도 Google·Microsoft
연동을 교체 가능한 Adapter로 유지한다. 운영자가 자원과 정책을 관리할 수 있지만 개인 일정
본문은 볼 수 없고, 회사 관리자와 기능 관리자도 분리된다.
