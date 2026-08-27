# Calendar Scheduling Hub v1.2–v1.4 설계

- 상태: v1.2 구현·Calendar 범위 검증 완료, v1.3/v1.4 승인된 후속 설계
- 기준일: 2026-08-27
- 검토: Product Design, Calendar Architecture, Quality/Security expert review 반영

## 1. 사용자와 업무

- 주 사용자: 본인의 시간을 계획하고 여러 참석자와 회의실을 함께 조율하는 구성원
- 운영 질문: “누구와 언제 만날 수 있고, 그 시간에 확정 가능한 공간은 어디인가?”
- 1차 행동: 일정 작성기 안에서 참석자·시간·회의실을 한 번에 평가하고 적용
- Page archetype: 일정은 temporal workspace, Scheduling은 focus form + 결과 비교,
  Booking/Poll은 상태 기반 workflow다.

## 2. 메뉴와 정보구조 결정

최상위 메뉴 개수를 늘리는 것 자체를 목표로 삼지 않는다. 현재 여섯 사용자 메뉴는 서로 다른
반복 업무를 담당하므로 유지한다. v1.3부터 `가용 시간 찾기`를 `Scheduling` 허브로 확장하고
허브 안에서만 `시간 찾기`, `예약 페이지`, `일정 투표` 탭을 제공한다.

```text
시작
└─ 오늘
계획
├─ 일정
└─ 집중 계획
협업과 예약
├─ 초대 및 응답
└─ Scheduling
   ├─ 시간 찾기          v1.2
   ├─ 예약 페이지        v1.3
   └─ 일정 투표          v1.4
분석
└─ 시간 인사이트
```

- 빈 메뉴, `Coming soon` 전용 화면, 서버 수명주기 없이 저장되지 않는 기능은 노출하지 않는다.
- Google/Microsoft 연결은 개인 `계정 > 연결`에서, Tenant Adapter 상태는 관리자 연동 화면에서
  관리한다. 사용자 Calendar Sidebar에 공급사별 메뉴를 만들지 않는다.
- Workplace는 공간 원장을 소유한다. Calendar는 일정 문맥 안에서 회의실 후보와 예약 상태만
  보여준다.

## 3. v1.2 일정 작성기 UI 계약

### Desktop

- 폭이 충분할 때 Dialog를 `일정 필드 | Scheduling assistant` 두 열로 구성한다.
- 왼쪽에는 제목, 시작·종료, 일정 시간대, 종일 여부, 반복 간격, 필수/선택 참석자,
  회의실과 설명을 둔다.
- 오른쪽에는 평가 실행, 참석자·소요시간·시간대 요약, 추천 시간, 추천 회의실, 신선도와
  개인정보 안내를 둔다.
- 추천 시간을 적용하면 새 시간 기준으로 People과 Room을 다시 하나의 평가 snapshot으로
  조회한다. 이전 결과나 이전 회의실 후보는 재사용하지 않는다.

### Mobile

- 599px 이하에서는 전체 화면 Dialog로 전환하고, 일정 필드 다음에 assistant가 이어지는
  단일 열 흐름을 사용한다.
- 320px에서도 가로 스크롤이 없어야 하며 하단 저장·취소 행동은 보존한다.

### 상태

| 상태           | 화면 계약                                             |
| -------------- | ----------------------------------------------------- |
| 초기           | 평가 범위와 개인정보 안내, 현재 시간 기준 회의실 후보 |
| 조회 중        | `role=status`, 진행 표시, 이전 snapshot 사용 금지     |
| 완료           | 추천 시간·회의실, 생성 시각, 설명 가능한 reason code  |
| 부분 실패      | 결과 적용 차단, 실패 source와 재시도 제공             |
| 만료/입력 변경 | 이전 결과 폐기, 다시 평가 안내                        |
| 반복 일정 수정 | 자동 추천 숨김, 전체 series 수동 변경임을 명시        |

접근성 기준은 키보드 전용 사용, 보이는 focus, Dialog 이름, 상태 live region, 색상 외 상태 표현,
한국어/영어 긴 레이블, 200% 확대다.

## 4. Scheduling Evaluation 계약

`POST /v1/calendar/scheduling/evaluations`는 attendee free/busy와 Room 후보를 하나의 조회
경계에서 계산한다. 사람 식별자는 URL이나 access log query에 넣지 않는다.

```text
Event editor
  └─ POST scheduling evaluation
       ├─ Tenant 안에서 확인된 person_public_id만 허용
       ├─ 반복 occurrence를 포함한 free/busy 계산
       ├─ Workplace ABAC를 통과한 ROOM 후보 계산
       └─ evaluationId + criteriaHash + generatedAt + validUntil 반환
```

- 최대 20명에는 현재 주최자를 포함한다. 요청 본문의 추가 참석자는 최대 19명이다.
- 14일은 UTC 336시간이 아니라 요청 IANA 시간대의 14 local calendar days다.
- 임의 UUID, 타 Tenant UUID, 확인할 수 없는 source는 free로 간주하지 않고 fail-closed한다.
- `completeness=COMPLETE`, 모든 source가 `HEALTHY`, `validUntil` 이전이며 현재 입력의
  fingerprint와 일치할 때만 결과를 적용한다.
- 응답은 제목·설명·위치·다른 참석자 등 타인의 일정 상세를 포함하지 않는다.
- Evaluation은 예약이 아니다. 일정 생성/수정 시 Room advisory lock, occurrence 충돌 검사,
  PostgreSQL exclusion constraint를 다시 통과해야 한다.

## 5. 트랜잭션과 서비스 책임

- `CalendarService`의 기존 public API는 호환 facade로 유지한다.
- v1.2 계산은 `CalendarSchedulingEvaluator`로 분리하고, facade의 read-only transaction 안에서
  People/Room snapshot을 생성한다.
- Event, Attendee, Room booking, audit는 기존 Calendar DB 단일 transaction에서 저장한다.
- 외부 Adapter와 알림 호출을 Calendar transaction 안에서 실행하지 않는다. v1.3 착수 전
  Outbox를 도입하고 비동기 전달·재시도·재조정을 분리한다.
- v1.3 전에는 facade를 Command, Query, Recurrence, Room booking, Policy, Privacy/Audit
  협력 서비스로 추가 분리한다. `CalendarService` 파일 예산을 올리는 방식은 허용하지 않는다.

## 6. Booking pages v1.3

### Aggregate와 상태

```text
BookingPage: DRAFT → PUBLISHED ↔ PAUSED → ARCHIVED
BookingHold: HELD → CONSUMED | EXPIRED | CANCELLED
Appointment: CONFIRMED → RESCHEDULED | CANCELLED
```

- 개인/팀 소유권, 주간 가용 규칙, 기간·버퍼·일별 한도, 회의 방식, 질문 양식을 저장한다.
- 인증 사용자 예약부터 출시한다. 공개 링크는 opaque token, rate limit, bot 방어, 외부 이메일
  검증, abuse 감사가 준비된 뒤 개방한다.
- Hold는 짧은 TTL과 fencing token을 갖고 Appointment 확정 시 원자적으로 consume한다.
- 변경·취소 링크는 예약자에게 최소 권한 토큰으로 제공하고 모든 상태 전이를 감사한다.

## 7. Scheduling Poll v1.4

```text
Poll: DRAFT → OPEN → AGREEMENT_REACHED → CONFIRMED
                    └──────────────→ CANCELLED | EXPIRED
```

- 후보 시간, 참여자, 투표, comment, soft people hold, hard room hold를 별도 모델로 둔다.
- 인증 사용자 투표부터 출시한다. 외부 투표는 공개 토큰 보안 게이트 이후 추가한다.
- 합의 도달은 자동 확정이 아니라 주최자 확인 상태다. 확정 시 Event·Attendee·Room booking과
  같은 transaction에서 연결하고 후보 hold를 해제한다.

## 8. External Calendar Adapter

- 별도 `dwp-calendar-adapter-server`와 DB가 OAuth token, webhook 원문, sync cursor,
  공급사 ID mapping, lease/fencing과 reconciliation을 소유한다.
- Calendar는 canonical event와 source reference만 소유하며 Provider 제어면에는 일정 본문,
  OAuth token, webhook payload를 저장하지 않는다.
- 도입 순서는 Microsoft read-only shadow, inbound import, outbound write, Teams link,
  Google import/write, 양방향 conflict reconciliation이다.
- Calendar와 Adapter는 Outbox/Inbox로 연결하며 silent last-write-wins를 금지한다.

## 9. 출시 게이트

### v1.2 필수

- lossless event edit: time zone, all-day, recurrence interval/until, optional attendee 보존
- POST body privacy, Tenant person 검증, criteria hash, freshness/expiry, source completeness
- 추천 시간 적용 뒤 결합 snapshot 재평가
- URL/saved view 우선순위와 back/forward 복원
- DST, 권한, Room hard recheck, partial failure, 320/390/1280/1440 접근성 E2E
- OpenAPI backend/frontend snapshot 일치와 source-size gate 통과

### v1.3/v1.4 전제

- Calendar membership/subscription과 occurrence exception 모델
- Tenant composite FK, append-only audit, retention/legal hold
- Notification Outbox와 Adapter Inbox
- 동시 hold/confirm PostgreSQL 통합 테스트와 복구 runbook
