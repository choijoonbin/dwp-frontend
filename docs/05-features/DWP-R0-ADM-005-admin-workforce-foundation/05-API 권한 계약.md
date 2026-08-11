# 05 API 권한 계약

## 1. 제품 경계

| 영역                   | 경로                                                | 권한 원칙                                                  |
| ---------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| 일반 People            | `/api/people/v1/people`, `/api/people/v1/org-chart` | `APP.PEOPLE_DIRECTORY:VIEW`, 업무용 공개 필드만 반환       |
| Workforce              | `/api/people/v1/workforce/**`                       | `APP.WORKFORCE_MANAGEMENT:VIEW`와 Workforce Role 동시 요구 |
| Tenant Control Center  | `/api/*/v1/admin/**`                                | Tenant IAM·구성 정책 관리, HR 업무 원장 제외               |
| Provider Control Plane | `/api/provider/v1/**`                               | Provider Identity만 허용                                   |
| 지원 세션              | People·Workforce GET 일부                           | JIT 승인된 `WORKFORCE_READ`, 만료·사유·고객 승인·감사 강제 |

`TENANT_ADMIN`은 Workforce 권한이 아니다. HR 운영은 `ADMIN`, `HR_ADMIN`,
`PEOPLE_ADMIN`으로 제한하고 `PEOPLE_ADMIN`은 읽기 전용이다. `HR_ADMIN`과 `ADMIN`만
Connector·기준정보·Scenario Mutation을 수행한다.

## 2. Effective Permission

```text
effective = direct user roles
          + active tenant-scoped group roles
          + approved scoped delegated roles
          - SoD and policy denials
```

- UI가 버튼을 숨겨도 API가 역할·Resource·Action·Tenant를 다시 검사한다.
- Group·Role·Scope 변경은 Session과 Permission Cache를 폐기한다.
- 모든 Query에 Tenant Predicate를 포함하며 Update는 Version 또는 ETag를 요구한다.
- PII Export, Role Assignment, Navigation Publish와 Agent Tool Grant는 별도 Action이다.
- 일반 People와 Workforce는 서로 다른 Controller를 사용한다. 같은 DTO를 반환하더라도
  일반 Surface의 제한 필드는 Service에서 `null` 또는 빈 목록으로 투영한다.

## 3. People와 Workforce API

| Method         | Path                                                 | 역할과 계약                                            |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| GET            | `/api/people/v1/people`                              | 일반 디렉터리 검색·상세, Worker ID·직급·발령 이력 제외 |
| GET            | `/api/people/v1/org-chart`                           | 활성 사람·Direct/Matrix 관계의 읽기 전용 Graph         |
| GET            | `/api/people/v1/workforce/people`                    | HR 운영용 Worker·발령·직급 Projection                  |
| GET            | `/api/people/v1/workforce/organization/chart`        | 조직·Position·공석·비용 Effective Graph                |
| GET            | `/api/people/v1/workforce/organization/intelligence` | 비교일 또는 Scenario 기준 Health·Change·Quality        |
| GET·PUT        | `/api/people/v1/workforce/reference-data/**`         | 기준정보 조회, Tenant 소유 Catalog만 낙관적 변경       |
| GET·POST·PATCH | `/api/people/v1/workforce/data-operations/hris/**`   | Source·Mapping·Connector·Sync Run 운영                 |

## 4. Organization Scenario API

Base Path는 `/api/people/v1/workforce/organization/scenarios`다.

| Method   | 상대 경로                                       | 계약                                                  |
| -------- | ----------------------------------------------- | ----------------------------------------------------- |
| GET·POST | `/`                                             | 목록·Draft 생성                                       |
| POST     | `/{scenarioId}/clone`                           | 기준선·변경 집합·Source 계보를 보존한 독립 Draft 복제 |
| POST     | `/{scenarioId}/moves`                           | 조직 이동 계획                                        |
| POST     | `/{scenarioId}/position-moves`                  | 직위 이동 계획                                        |
| POST     | `/{scenarioId}/positions`                       | 비용·FTE를 포함한 직위 신설 계획                      |
| POST     | `/{scenarioId}/positions/{positionId}/close`    | 안전한 공석 직위 종료 계획                            |
| GET      | `/{scenarioId}/decision-pack`                   | 저장하지 않는 최신 준비도 Preview                     |
| POST     | `/{scenarioId}/decision-pack/validate`          | 불변 검증 근거 생성                                   |
| GET      | `/{scenarioId}/decision-pack/history`           | Tenant 범위 최근 검증 근거                            |
| POST     | `/{scenarioId}/submit`, `/approval`, `/publish` | 동일 Decision Gate를 재검증하는 상태 전이             |

- 조회·Preview는 `PEOPLE_ADMIN`, `HR_ADMIN`, `ADMIN`이 가능하다.
- Draft 변경·검증·제출·게시와 승인 판단은 `HR_ADMIN`, `ADMIN`만 가능하다.
- 승인자는 작성자와 달라야 하며 Publish는 Baseline Fingerprint, Graph Cycle,
  Position Dependency와 승인 상태를 다시 검사한다.
- 모든 Mutation은 Version과 Correlation ID를 받아 Transactional Audit Outbox로 연결한다.

## 5. 데이터와 감사

- `dwp_people.ppl_*`: Person, Worker, Assignment, Organization, Position, Scenario와 기준정보
- `dwp_people.int_*`: HRIS Source, Connector, Mapping, Receipt, Sync Run과 Error
- `dwp_people.sys_*`: 접근 감사, Transactional Outbox와 서비스 Tenant
- `dwp_auth.com_*`: Account, Role, Group, Resource, Permission과 Scope
- `dwp_platform.adm_*`: App Registry, Navigation, Locale와 Tenant Experience

Database 간 FK를 만들지 않는다. `tenant_id`, 공개 UUID, Idempotency Key, Correlation ID와
감사 Event로 계약을 연결한다. People 조회와 Workforce 조회는 서로 다른 `accessSurface`,
목적, Actor, Tenant, 결과와 Correlation ID를 감사한다.
