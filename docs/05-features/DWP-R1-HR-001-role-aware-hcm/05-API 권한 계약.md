# 05. API 권한 계약

## 공통 요청 계약

- 외부 호출은 Gateway의 `/api/people/v1/hr/**`만 사용한다.
- Gateway는 검증된 `tenant_id`, `user_id`, 역할, Permission, `person_public_id`를 내부
  Identity Header로 전달하고 외부 위조 Header를 제거한다.
- People Server는 `person_public_id`를 Tenant의 활성 Worker와 다시 연결한다.
- 개인 API는 Request Body의 `workerId`를 신뢰하지 않고 인증 Context의 Worker만 사용한다.
- 변경 명령은 `X-Correlation-ID`, Optimistic `version`, Audit Outbox를 사용한다.

## Endpoint

| Method | 경로                                    | Audience                      | 결과                            |
| ------ | --------------------------------------- | ----------------------------- | ------------------------------- |
| GET    | `/v1/hr/home`                           | 구성원                        | 개인·팀·Reference 상태 Overview |
| GET    | `/v1/hr/time`                           | 구성원                        | 현재 Time Card·Entry·Exception  |
| PUT    | `/v1/hr/time/{cardId}/entries/{date}`   | 본인                          | 열린 Card의 일별 Entry 저장     |
| POST   | `/v1/hr/time/{cardId}/submit?version=`  | 본인                          | 제출 가능 Card 전이             |
| POST   | `/v1/hr/time/{cardId}/decision`         | 실제 Manager 또는 위임 관리자 | 승인·반려                       |
| GET    | `/v1/hr/absence`                        | 구성원                        | Balance·Request·팀 Queue·일정   |
| POST   | `/v1/hr/absence/requests`               | 본인                          | 휴가 신청                       |
| POST   | `/v1/hr/absence/requests/{id}/withdraw` | 본인                          | 제출 신청 철회·Pending 원복     |
| POST   | `/v1/hr/absence/requests/{id}/decision` | 실제 Manager 또는 위임 관리자 | 승인·반려                       |
| GET    | `/v1/hr/benefits`                       | 구성원                        | 가입 Plan·Window                |
| GET    | `/v1/hr/pay`                            | 구성원                        | 지급 Cycle·문서 Reference       |
| GET    | `/v1/hr/talent`                         | 구성원                        | Journey·Goal·Learning           |
| PUT    | `/v1/hr/talent/goals/{id}`              | 본인                          | Goal 진척 갱신                  |
| GET    | `/v1/hr/operations/{domain}`            | 도메인 관리자                 | Tenant 운영 Metric·Queue        |

HR 서비스 허브는 신규 People API를 만들지 않고 Platform의 `/v1/services/catalog`과
`/v1/services/requests/**` 계약을 사용한다. 진입에는 `APP.EMPLOYEE_SERVICES:VIEW`가 필요하며
요청 상태·SLA·Timeline·운영 Queue 권한은 Service Center 계약을 따른다.

## 권한 Matrix

| Domain   | Resource           | Delegated Role   |
| -------- | ------------------ | ---------------- |
| Time     | `DATA.HR_TIME`     | `TIME_ADMIN`     |
| Absence  | `DATA.HR_ABSENCE`  | `ABSENCE_ADMIN`  |
| Benefits | `DATA.HR_BENEFITS` | `BENEFITS_ADMIN` |
| Pay      | `DATA.HR_PAY`      | `PAYROLL_ADMIN`  |
| Talent   | `DATA.HR_TALENT`   | `TALENT_ADMIN`   |

운영 조회는 `VIEW` 또는 `MANAGE`, 결정은 `APPROVE` 또는 `MANAGE`가 필요하다. 실제
Manager는 도메인 역할 없이 직속 Target에 대해서만 근태·휴가 결정을 할 수 있다.

## 오류 계약

| 상황                                  | 오류                  |
| ------------------------------------- | --------------------- |
| Worker 연결 없음·Target Population 밖 | `FORBIDDEN`           |
| 잘못된 기간·분·상태                   | `INVALID_INPUT_VALUE` |
| 없는 Aggregate                        | `NOT_FOUND`           |
| 오래된 Version·허용되지 않은 전이     | `RESOURCE_CONFLICT`   |
| 다른 Worker의 휴가 철회 대상          | `NOT_FOUND`           |
| 기존 제출·승인 휴가와 중복            | `RESOURCE_CONFLICT`   |

DB Exclusion Constraint의 동시 경합도 업무 `RESOURCE_CONFLICT`로 변환하며 500으로 노출하지
않는다.
