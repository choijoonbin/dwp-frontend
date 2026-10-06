# HRIS-TIM authorization contract

The DWP authority system remains the source of app entitlement and atomic duties. Time owns the final object/scope/state decision. UI visibility mirrors effective permission but never replaces the API PEP.

## Effective decision

`ALLOW = app entitlement ∧ atomic action ∧ population/scope ∧ field-purpose projection ∧ object-state guard ∧ SoD/step-up ∧ installed policy/pack/connector`.

Deny, expiry, suspension, legal hold and unavailable owner projection win over allow. Tenant and actor come only from trusted identity context. Missing/out-of-scope targets return the same opaque 404.

## Atomic duties

| Duty | Representative actions | Scope |
|---|---|---|
| `TIME_EMPLOYEE` | self schedule/timecard/leave view; self clock/request/submit/cancel | `SELF` |
| `TIME_MANAGER` | team schedule/view; decide team timecard/request | `DIRECT_REPORT|ORG_TREE` |
| `TIME_OPERATOR` | interpret, resolve exception, correct card, manage requests | `TIME_GROUP|PERIOD|NAMED_POPULATION` |
| `LEAVE_OPERATOR` | enroll, entitlement run/adjust, evidence metadata | `TIME_GROUP|LEGAL_ENTITY` |
| `TIME_CONFIG_AUTHOR` | draft work/leave/calendar/connector assignment | `LEGAL_ENTITY|TIME_GROUP` |
| `TIME_CONFIG_APPROVER` | publish validated configuration | same assigned scope |
| `TIME_CLOSE_OPERATOR` | validate and request close/reopen | `TIME_GROUP|PERIOD` |
| `TIME_CLOSE_APPROVER` | approve close/reopen and handoff | `TIME_GROUP|PERIOD` |
| `TIME_INTEGRATION_OPERATOR` | connection assignment, quarantine/replay, receipt view | `CONNECTION|TIME_GROUP` |
| `TIME_AUDITOR` | read audit/reconciliation with field projection | assigned audit scope |

Role labels such as employee/manager/operator/settings/auditor are access packages composed of these duties, not hardcoded checks.

## DWP 권한그룹 구성

HRIS 앱 권한을 먼저 부여하고, 그 하위 DWP 권한그룹이 atomic duty를 조합한다. 그룹명 자체를 API에서 검사하지 않는다.

| DWP 권한그룹 | 기본 TIM access package | 기본 범위와 제한 |
|---|---|---|
| `직원` | `TIME_EMPLOYEE` | `SELF`; 본인 일정·근태·휴가 조회와 신청/제출 |
| `관리자` | `TIME_EMPLOYEE + TIME_MANAGER` | 본인 + 승인된 `DIRECT_REPORT/ORG_TREE`; 민감 휴가 상세는 별도 field duty 없으면 일반화 |
| `업무운영자` | 직무별 `TIME_OPERATOR`, `LEAVE_OPERATOR`, `TIME_CLOSE_OPERATOR/APPROVER`, `TIME_INTEGRATION_OPERATOR` 조합 | 승인된 time group/legal entity/period/population만; maker/approver는 별도 package로 분리 |
| `설정관리자` | `TIME_CONFIG_AUTHOR` 또는 `TIME_CONFIG_APPROVER` | 설정 작성과 게시는 분리하며 동일 버전 단독 게시 금지 |
| `전사감사자` | `TIME_AUDITOR` | 명시된 감사 범위·목적·기간의 읽기 전용; 변경 duty 없음 |

한 사용자가 여러 그룹을 가져도 deny/SoD/field-purpose/state guard가 우선한다. 테넌트 관리자는 그룹에 access package를 배포하고 유효기간·scope를 설정하며, HRIS 서버는 매 요청에서 최종 객체 판정을 수행한다. 개발 환경의 전체 메뉴 노출은 탐색 편의일 뿐 API 권한 우회가 아니며 운영 기본값으로 승격하지 않는다.

## Field groups

| Group | Default | Extra control |
|---|---|---|
| schedule/time totals/balance | view within scope | none |
| clock source/device metadata | omit for employee/manager | operator purpose |
| precise location | omit | explicit collection policy and highly restricted purpose; not a productivity feature |
| leave type | view only as required | manager projection may generalize sensitive type |
| leave free-text/evidence | omit | purpose, highly restricted field duty, audit and optional step-up |
| interpretation trace | summary for self; detail for operator | trace duty and scope |
| audit/export | omit by default | audit/export duty, purpose, step-up, expiry and immutable access record |

Search/filter/sort/aggregate use the same field policy as the returned data to prevent inference. Counts are suppressed or bucketed when a sensitive population is too small.

## SoD and object guards

- requester/submitting worker cannot decide the same request/timecard.
- correction maker cannot be sole close approver for the affected period.
- closer cannot solely approve reopen.
- configuration author cannot solely publish the same version.
- connector replayer cannot waive its own reconciliation difference.
- auditor has no mutation duty.
- closed/locked period rejects ordinary correction even when the actor has a write duty.

Every decision audit stores access-package revision, atomic action, population/policy revision, fields returned/omitted/masked, purpose, object state/revision, SoD outcome and step-up session. Frontend tests cover hidden navigation and 403/404 states; backend tests prove cross-tenant, out-of-population, self-approval, stale policy and sensitive-field denial.
