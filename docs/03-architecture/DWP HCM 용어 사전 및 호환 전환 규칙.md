# DWP HCM 용어 사전 및 호환 전환 규칙

> 상태: Accepted
>
> 기준일: 2026-08-14
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

## 1. 제품 언어

| 구분             | 정식 용어                | 사용 위치                                        | 금지 또는 제한                                 |
| ---------------- | ------------------------ | ------------------------------------------------ | ---------------------------------------------- |
| 제품군           | `DWP HCM`                | 아키텍처, 계약, 관리 화면, 제품 Registry         | 사용자 메뉴를 `HRIS`로 표시하지 않는다.        |
| 사용자 앱        | 한국어 `인사`, 영어 `HR` | 홈 앱, Header, Sidebar, 검색                     | `구성원`은 앱 이름으로 사용하지 않는다.        |
| 제품 경로        | `/hr`                    | Route, Deep Link                                 | 제품명 변경을 이유로 URL을 바꾸지 않는다.      |
| Frontend Shell   | `hcm`                    | Shell, Product Experience, Query namespace       | 신규 코드에 `hris` Shell을 만들지 않는다.      |
| 제품 권한        | `APP.HCM`                | Auth resource, Navigation, App Registry          | `APP.HRIS`는 호환 Alias로만 수용한다.          |
| 홈 Surface       | `hcm-home`               | 개인 홈 저장·감사 계약                           | `hris-home`은 읽기/요청 호환 Alias다.          |
| 사람 핵심 데이터 | `people`                 | Person, Worker, 관계, 발령, 조직 Projection      | 제품 전체를 `people`로 부르지 않는다.          |
| 인력 운영        | `workforce`              | 인력 계획, 조직 설계, Position, 운영 통제        | 개인 HR Self-service와 혼용하지 않는다.        |
| 외부 시스템 연계 | `hris`                   | Connector, Source, Mapping, Sync, Reconciliation | DWP 제품명이나 Shell 식별자로 사용하지 않는다. |
| 사용자 표현      | `구성원`                 | 설명 문구, 디렉터리 대상, 사람 친화적 Copy       | DB·API 엔터티 이름으로 사용하지 않는다.        |

## 2. 핵심 엔터티

`Person → Worker → WorkRelationship → Assignment`는 중복 테이블이 아니라 서로 다른
수명주기와 보안 경계를 가진 Aggregate 관계다.

| 엔터티             | 의미                                       | 생성·변경 기준                                     | DWP 저장 계약                                       |
| ------------------ | ------------------------------------------ | -------------------------------------------------- | --------------------------------------------------- |
| `Person`           | 고용 여부와 무관한 한 자연인               | 최초 식별 시 생성하고 재입사해도 유지              | `ppl_persons`, `personId` UUID                      |
| `Worker`           | 테넌트에서 관리하는 근로자 정체성          | 근로자 유형·번호 체계에 따라 Person에 연결         | `ppl_workers`, `workerId` UUID                      |
| `WorkRelationship` | Worker와 법적 고용주 사이의 법적 관계      | 입사·재입사·고용주 변경 시 별도 관계 생성          | `ppl_work_relationships`, `workRelationshipId` UUID |
| `Assignment`       | 관계 안에서 수행하는 유효일 기준 업무 배치 | 직무·조직·위치·관리자·근무시간 변경을 Slice로 기록 | `ppl_assignments`, `assignmentId` UUID              |

API의 정식 상세 그래프는 다음 구조를 사용한다.

```text
person
└── workers[]
    └── workRelationships[]
        └── assignments[]
```

Directory Surface는 업무상 공개 가능한 `PersonSummary`만 반환한다. Workforce Surface만
Target Population과 Field Masking 검사를 거쳐 위 고용 그래프를 반환한다. 기존 평면
`PersonDetail.assignments`는 전환 기간의 응답 호환 필드이며 신규 기능은 중첩 그래프를
우선 사용한다.

## 3. Bounded Context

| Context          | 책임                                         | 대표 코드·테이블                            |
| ---------------- | -------------------------------------------- | ------------------------------------------- |
| HCM Experience   | 하나의 역할 인지 HR 제품 경험                | `features/hcm`, `HcmLayout`, `/hr/**`       |
| People Core      | 사람·근로자·고용관계·발령·조직 Projection    | `dwp-people-server`, `ppl_*`                |
| Workforce        | 인력·Position·조직 시나리오·통제형 반출      | `workforce` API와 화면                      |
| HR Domains       | 근태·휴가·복리후생·급여 참조·Talent 수명주기 | `tme_*`, `abs_*`, `bnf_*`, `pay_*`, `tal_*` |
| HRIS Integration | 외부 HR 시스템 수집·매핑·정합성              | `int_*`, `/data-operations/hris/**`         |
| Identity         | 로그인 주체·역할·제품 Entitlement            | `APP.HCM`, `DATA.HR_*`, `DATA.WORKFORCE`    |

## 4. 호환 전환

| 레거시                                 | 정식 값        | 전환 동작                                                               |
| -------------------------------------- | -------------- | ----------------------------------------------------------------------- |
| `APP.HRIS`                             | `APP.HCM`      | 두 키를 같은 앱 권한으로 평가하고 어느 한쪽의 명시적 `DENY`도 우선한다. |
| `DWP_HRIS`                             | `DWP_HCM`      | 기존 Registry 데이터를 Migration으로 갱신한다.                          |
| `hris` Shell/Icon                      | `hcm`          | 서버에 남은 구형 Icon은 표시 Alias만 제공한다.                          |
| `hris-home`                            | `hcm-home`     | 서버가 요청을 정규화하고 저장 레코드는 Migration한다.                   |
| `features/hris`                        | `features/hcm` | 패키지를 이동하고 외부 연계 Adapter만 `Hris*`를 유지한다.               |
| `/people/**`, `/workforce/**` 제품 URL | `/hr/**`       | Query와 Hash를 보존해 Redirect한다.                                     |

Alias 제거는 다음 조건을 모두 만족한 별도 Migration에서만 수행한다.

1. 운영 로그에서 레거시 키 요청이 합의된 관찰 기간 동안 0건이다.
2. 모든 관리형 클라이언트와 저장된 Navigation·Home 설정이 정식 키를 사용한다.
3. 권한 회귀, Bookmark, 지원 세션, 감사 Deep Link 검증이 통과한다.
4. 고객 Delivery Runbook과 Rollback 절차가 승인된다.

## 5. 근거와 적용 원칙

- [Workday HCM](https://www.workday.com/en-us/products/human-capital-management/overview.html)은 Core HR을 포함한 인력 수명주기 제품군을 HCM으로 정의한다.
- [Workday HCM과 HRIS 구분](https://www.workday.com/en-us/topics/hr/human-capital-management-software.html)은 HRIS를 핵심 기록 시스템, HCM을 더 넓은 인력 경험과 운영 체계로 구분한다.
- [Oracle Work Relationships](https://docs.oracle.com/en/cloud/saas/human-resources/fawhr/work-relationships.html)은 Person과 법적 고용 관계를 분리하고 재입사 시 새 관계를 생성한다.
- [Oracle Assignments](https://docs.oracle.com/en/cloud/saas/human-resources/fawhr/assignments.html)은 직무·Position·급여·관리자·시간·위치를 Assignment가 소유하도록 구분한다.
- [Microsoft Worker](https://learn.microsoft.com/en-us/dynamics365/human-resources/hr-worker)와 [Positions](https://learn.microsoft.com/en-us/dynamics365/human-resources/hr-personnel-positions)은 Worker와 Position·Assignment 성격의 운영 데이터를 분리한다.
- [SAP Employment Information](https://help.sap.com/docs/successfactors-employee-central/implementing-employee-central-core/employment-information)은 개인 정보와 고용 정보를 별도 유효일 데이터로 관리한다.

DWP는 외부 제품의 화면 명칭을 복제하지 않는다. 공통된 도메인 경계와 수명주기 원칙만
채택하고, 사용자에게는 짧고 이해 가능한 `인사`/`HR` 경험을 제공한다.
