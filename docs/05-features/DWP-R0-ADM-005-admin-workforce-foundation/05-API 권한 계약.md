# 05 API 권한 계약

## Namespace

- Provider: 향후 `/api/provider/v1/**`, Provider Identity만 허용
- Tenant Admin: `/api/*/v1/admin/**`, 검증된 단일 Tenant Context
- Runtime: `/api/*/v1/**`, Resource+Action과 Data Scope 재검사
- People: 향후 `/api/people/v1/**`, Field Masking과 Purpose Scope 적용

## Permission

```text
effective = direct user roles
          + active tenant-scoped group roles
          + approved scoped delegated roles
          - SoD/policy denials
```

- UI가 버튼을 숨겨도 API는 동일 Permission을 검사한다.
- Group/Role/Scope 변경은 Session과 Permission Cache를 폐기한다.
- PII Export, Role Assignment, Navigation Publish와 Agent Tool Grant는 별도 Action이다.
- 목록은 Cursor Pagination을 기본 목표로 하고 모든 Query에 Tenant Predicate를 포함한다.
- Update는 Version 또는 ETag가 없으면 거부한다.

## Organization API

| Method   | Path                                            | 계약                                                   |
| -------- | ----------------------------------------------- | ------------------------------------------------------ |
| GET      | `/api/people/v1/org-chart`                      | `asOf`, Root, Depth, Scenario를 적용한 Effective Graph |
| GET      | `/api/people/v1/org-chart/intelligence`         | 비교일 또는 Scenario 기준 Health·Change·Quality        |
| GET·POST | `/api/people/v1/org-chart/scenarios`            | 시나리오 목록·생성                                     |
| POST     | `/{scenarioId}/clone`                           | 기준선·변경 집합·Source 계보를 보존한 독립 Draft 복제  |
| POST     | `/{scenarioId}/moves`                           | 조직 이동 계획                                         |
| POST     | `/{scenarioId}/position-moves`                  | 직위 이동 계획                                         |
| POST     | `/{scenarioId}/positions`                       | 비용·FTE를 포함한 직위 신설 계획                       |
| POST     | `/{scenarioId}/positions/{positionId}/close`    | 안전한 공석 직위 종료 계획                             |
| GET      | `/{scenarioId}/decision-pack`                   | 저장하지 않는 최신 준비도 Preview                      |
| POST     | `/{scenarioId}/decision-pack/validate`          | 불변 검증 근거 생성                                    |
| GET      | `/{scenarioId}/decision-pack/history`           | Tenant 범위 최근 검증 근거 50건                        |
| POST     | `/{scenarioId}/submit`, `/approval`, `/publish` | 동일 Decision Gate를 재검증하는 상태 전이              |

- Planner API는 `HR_ADMIN`, `PEOPLE_ADMIN`, `TENANT_ADMIN`, `PLATFORM_ADMIN`, `ADMIN`만 허용한다.
- 편집은 Owner 또는 상위 관리자만 가능하고 승인자는 작성자와 달라야 한다.
- Publish는 승인 상태, Baseline Fingerprint, Graph Cycle, Position Dependency를 다시 검사한다.
- 비교 UI는 두 Decision Pack의 기준일·Fingerprint가 같을 때만 수치 차이를 계산한다.
- 모든 Mutation은 Version과 Correlation ID를 받아 Audit Outbox로 연결한다.
