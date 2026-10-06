# DWP HRIS 전체 코딩 아키텍처

## 1. 제품 목표와 비목표

목표는 SKKF HRM/PER/TIM/PAY/SYS가 제공한 유효한 업무행위를 빠짐없이 추적하되, 중복 화면·수동 우회·고객사 하드코딩·직접 DB 결합·불투명 계산을 제거한 범용 HRIS다. 같은 사용자·aggregate·권한·상태를 다루는 화면은 하나의 workspace로 통합하고, 상세·tab·drawer·wizard는 최상위 메뉴로 만들지 않는다.

다음은 비목표다.

- SKKF 테이블명·화면수·서비스 수의 1:1 복제
- BENSK, ADDSK 또는 특정 고객 식별자를 core 분기로 이관
- 실사용 증거가 없는 old/copy/test/publish route 유지
- 한 서비스의 DB를 다른 서비스가 join하거나 FK로 참조
- 미확정 세율, 반올림, 신고 포맷, 은행 파일, ERP 필드를 core에 고정
- 디자인 완료 전 임시 화면을 최종 UI로 간주

## 2. 논리 계층

```text
DWP Product Shell
  └─ HRIS app entitlement (APP.HCM canonical, APP.HRIS compatibility alias)
      ├─ Personal / Team / Operations / Configuration / Audit surfaces
      ├─ Access package + atomic duty + scope + field policy + SoD
      └─ HRIS Home contribution read model + Work Explorer

Domain services
  ├─ People: HRM + extraction-ready PER
  ├─ Time: time, leave, schedule, close ledgers
  └─ Payroll: payroll, payment, accounting, statutory provider ports

DWP shared control plane
  ├─ Auth: entitlement, access package, effective permissions, SoD
  ├─ Platform: tenant configuration, automation, connector control plane
  │   └─ isolated HRIS Insights: listening/analytics privacy aggregation only
  ├─ Approval / Notification / Audit / Object storage
  └─ Gateway: external API routing/composition, no domain decisions

Variation layers
  Product Core → Country Pack → Tenant Configuration → Signed Extension Pack
```

`SYS`는 source 분석 세션 이름이지 신규 `dwp-sys-server`가 아니다. 공통 행위는 기존 DWP owner service에 배치한다. `PER`는 초기에는 People service에 두되 public contract와 package boundary를 독립적으로 유지해 규모·장애격리 요구가 생기면 데이터 복제 없이 event 기반으로 추출할 수 있게 한다.

## 3. 정보 구조

최상위 navigation은 수백 개 레거시 route를 나열하지 않는다.

| Surface | 대상 | 역할 |
|---|---|---|
| `/hr/home` | 앱 권한 보유자 | 인사·근태·휴가·급여·성과 핵심 정보, 해야 할 일, 예외, freshness 위젯 |
| `/hr/explore` | 앱 권한 보유자 | 설치 모듈·국가팩·권한·scope에 맞춘 전체 업무 탐색과 검색 |
| `/hr/me/**` | 직원 | 내 정보·고용·근태·휴가·급여·성과·신청/문서 |
| `/hr/team/**` | 관리자 | 팀원·근태·휴가·성과·인력변경 승인/제안 |
| `/hr/operations/{people,time,leave,payroll,performance}/**` | 업무운영자 | 도메인 운영 workspace와 exception queue |
| `/hr/settings/**` | HRIS 설정관리자 | 도메인 정책·규칙·주기·코드·form의 draft/simulate/publish |
| DWP 관리자 | 보안·플랫폼·감사 | 앱/권한그룹·SoD·connector·automation·audit·extension lifecycle |

홈은 메뉴 지도 역할을 하지 않는다. 각 모듈은 widget data contract만 소유하고 SYS가 shell/composition/freshness/partial-failure를 소유한다. 하나의 모듈 장애 때문에 전체 홈이 실패하지 않으며 stale widget은 마지막 성공시각과 제한된 fallback을 표시한다.

## 4. 모듈과 런타임 경계

| Source 세션 | Target bounded context | Runtime | 데이터 원본(SoR) |
|---|---|---|---|
| HRM | Person, Worker, Employment, Assignment, Organization, Employee Service | `dwp-people-server` | 사람·고용·배치·조직·계약·HR case |
| PER | Goal, Review, Evaluation, Calibration, Result | `dwp-people-server/hris/performance` | 성과주기·평가·보정·결과 |
| TIM | Schedule, Clock, Interpretation, Time Ledger, Leave Ledger, Period Close | 신규 `dwp-time-server` | 원시 타각·해석·승인 결과·잔액·마감 |
| PAY | Payroll Input, Run, Result Ledger, Statement, Payment, GL, Statutory | 신규 `dwp-payroll-server` | 급여 계산·결과·지급·회계·법정 실행 증적 |
| SYS | Product access, config lifecycle, automation, connector control, shell/home, isolated listening/analytics insights | `dwp-auth-server` + `dwp-platform-server` (`hrisconfiguration`와 별도 `hrisinsights`) + 기존 shared services | 권한·설정 메타·job/connector·공통 UX; `hris_insights`에는 비식별/목적제한 응답·집계·lineage만 저장 |

서비스는 자기 DB schema와 migration을 소유한다. 다른 도메인의 값은 public UUID, versioned snapshot, event로 소비하며 동기 호출이 필요한 경우 timeout·circuit breaker·cached snapshot·명확한 stale policy가 있어야 한다.

물리 소유권 정본은 `physical-owner-prefix-register.csv`다. base 163개와 producer-owned modern 71개로 구성된 authoritative owner/SoR 계획 234개 및 PAY consumer materialization 2개를 합친 실제 배포 물리 객체 236개는 승인된 DB schema/prefix/runtime owner에 정확히 한 번 귀속되어야 한다. PAY의 2개 projection은 `dwp-payroll-server`가 소유하지만 PER SoR을 복제하지 않으며, owner service 이외의 migration·FK·repository import를 허용하지 않는다. `SYS`는 분석 세션일 뿐이므로 `dwp-sys-server` 같은 가상 runtime으로 테이블을 우회 소유할 수 없다.

Employee listening과 people analytics는 `dwp-platform-server` 안에서도 설정 패키지에 섞지 않는다. `com.dwp.services.platform.hrisinsights`/`hris_insights` 전용 package·DB schema·NOBYPASSRLS role을 사용하고, `hrisconfiguration` 또는 다른 도메인의 repository/FK를 참조하지 않는다. 허용되는 계산은 cohort 최소인원·재식별 방지·lineage가 적용된 privacy-safe aggregation뿐이다. 고용·근태·급여·성과·보상 결정을 내리거나 원천 도메인 규칙을 재구현하는 것은 금지한다.

## 5. 공통 실행 규칙

모든 high-impact command는 다음 순서를 따른다.

1. 인증과 HRIS app entitlement 확인
2. atomic capability, 대상 scope, field policy, purpose, effective SoD 평가
3. request schema와 effective-date, 상태전이 guard 검증
4. `Idempotency-Key`와 payload hash 중복 판정
5. `If-Match` 또는 `expectedVersion`으로 CAS
6. domain write, audit outbox, domain event outbox, command receipt를 한 transaction에 기록
7. 즉시 완료면 `200/201`, 비동기면 `202 + receiptId`
8. retry는 같은 key면 동일 결과, 다른 payload면 `409`
9. timeout 후 결과 불명은 성공으로 추정하지 않고 receipt query로 수렴

`202` command의 receipt 조회는 단순 ID lookup이 아니다. 현재 app entitlement와 원 command에 봉인한 action·subject·population·field policy·purpose를 다시 평가하고 더 좁은 교집합만 반환한다. Auth/Platform을 포함한 각 owner service가 자기 receipt endpoint를 제공하며 중앙 운영 화면은 read/deep-link만 조합하고 domain recovery 권한을 만들지 않는다.

모든 query는 tenant와 대상 scope를 repository predicate에 넣고, 반환 직전에 field projection을 적용한다. UI에서 숨기는 것은 보안통제가 아니다.

## 6. 설정·국가·고객 확장

| 층 | 허용 내용 | 금지 내용 |
|---|---|---|
| Product Core | 전사 공통 aggregate, workflow, ledger, 권한, API/event SPI | 고객명·세율·은행 포맷 하드코딩 |
| Country Pack | 시행일이 있는 법정 규칙, 반올림, 문서/신고 adapter, 회귀팩 | core table 직접 수정, unsigned runtime script |
| Tenant Config | 근무제, 휴가정책, 급여군, 평가주기, 조직·코드·승인흐름 | Java class/method명, SQL, secret 평문 |
| Signed Extension Pack | 선언된 hook, schema-validated mapping, UI slot, adapter implementation | 임의 DB 접근, 권한 우회, core fork |

모든 설정은 immutable version을 만들고 `DRAFT → VALIDATED → SIMULATED → APPROVED → SCHEDULED/PUBLISHED → RETIRED/ROLLED_BACK`으로 이동한다. 게시 전 영향대상·before/after·예상 exception을 보여주고 four-eyes와 효력일을 강제한다.

## 7. 중앙 automation·integration

배치와 연계 관리 메뉴는 앱마다 복제하지 않는다. DWP 관리자/플랫폼 control plane이 job definition, schedule, connector, secret reference, mapping version, health, execution receipt, retry/DLQ를 관리한다. 도메인 service는 허용된 command와 결과 schema를 제공한다.

- 임의 bean/class/method/SQL 실행 금지
- signed job manifest와 allowlisted handler key만 실행
- tenant·legal entity·period·policy version을 입력으로 고정
- lease, heartbeat, timeout, retry budget, concurrency key, cancellation policy 적용
- 실행 결과는 immutable receipt와 artifact digest로 보존
- connector는 transport와 domain mapping을 분리하고 dry-run/reconciliation을 제공

## 8. 의존 순서

1. SYS/Auth 공통 entitlement/access package/event/config/job 계약
2. HRM canonical person/worker/employment/assignment/org snapshot
3. PER와 TIM 병렬 구현
4. HRM compensation input + TIM closed result 이후 PAY core 계산
5. country pack·외부 connector·고객 migration은 core 기능 뒤 별도 G6 activation

모든 모듈을 같은 날 코딩할 수는 있지만, upstream 계약을 각 세션에서 다시 정의할 수는 없다. 미구현 upstream은 checked-in contract fixture와 consumer test로 대체하고 계약 drift를 차단한다.

`module-code-gate-register.csv.required_upstream_dependencies`는 해당 세션이 다른 module/platform owner로부터 소비하는 계약만 뜻한다. `g3-file-allocation-register.csv.dependency_ids`는 각 artifact가 소비하거나 생산하는 계약을 뜻하며, 모듈별 합집합은 `module-dependency-register.csv`에서 계산한 producer-or-consumer 관여 집합과 정확히 같아야 한다. 알려진 ID의 부분집합만 확인하거나 관련 없는 dependency를 한 allocation에 몰아 넣어 Gate를 우회할 수 없다.

## 9. 완료 정의

모듈의 기능 완료는 화면이 보이는 상태가 아니다. source trace, domain invariant, API/event, 권한 negative test, tenant isolation, idempotency/CAS, audit/receipt, migration/reconciliation, 모든 UI 상태, observability, runbook, synthetic golden과 회귀가 연결돼야 한다. 디자인은 G4 뒤 G5A/B/C로 수행하되 접근성·정보 우선순위·오류/부분실패 상태는 G3에서 구현한다.

## 10. 실행 가능한 구조·공통 계약 정본

- `module-structure-contract-register.csv`: 5개 세션의 backend/frontend root와 허용·금지 import edge
- `g3-file-allocation-register.csv`: module source/test와 중앙 settings/build/Docker/devctl/CI/deploy/contract/gateway/migration single-writer
- `g3-slice-code-go-register.csv`: base 86 + modern 16, 총 102개 추적 slice 중 active 100개에만 IA/API·event/auth/schema·state/dependency/file/migration/test 귀속과 고유 코드 착수 토큰을 부여한다. HRM-006/SYS-013 두 retired evidence-only 행은 target code 권한이 없다. 모듈 Gate가 열려도 선택한 active slice와 검증된 touch manifest 없이는 코드 변경을 시작하지 않는다.

Migration의 의미 설계·파일 생성·검증 책임은 해당 stream의 모듈 owner에 있다. 모듈은 예약된 service·stream·prefix·version range와 named slice의 exact allocation 안에서 Flyway 파일을 CREATE하고 schema intent, invariant, backfill/forward-correction 및 clean/upgrade test를 봉인한다. Integration Control은 앞선 owner MODULE_COMMIT의 동일 path/blob만 source-linked INTEGRATION_MERGE하며 DBA workflow review와 affected-service/global replay를 수행한다. shared/on-demand 중앙 migration만 owner proposal에 결속한 CENTRAL_MATERIALIZATION으로 분리한다. 기존 Flyway 파일의 수정·삭제·rename과 다른 slice의 numeric version 선점은 금지한다. 실행 정본은 g0/g3-checkpoint-evidence-contract.md 및 g3-file-allocation-register.csv이며 중앙이 모듈 소유 SQL을 임의로 대신 생성하지 않는다.
- `platform-integration-binding-register.csv`: DWP Event/Approval/Notification/Audit/Config/API route/PEP adapter·schema·test 경계
- `api-pep-binding-register.csv`: 175개 public API operation의 app entitlement→persona package→atomic duty→capability/resource/action/population/field/purpose exact PEP tuple
- `cross-module-canonical-schemas.v1.json` + `cross-module-schema-binding-register.csv`: 21개 snapshot/event의 타입·format·nullability·nested cardinality·정규화 digest와 양끝 generated import/contract test 정본
- `modern-capability-delivery-register.csv` + `modern-capability-trace-register.csv`: 최신 HRIS 16건의 owner/wave와 prompt·slice·menu·data·auth·API·test·G4 evidence

이 정본들은 구현 완료를 뜻하지 않는다. G3 시작 시 할당을 enforce하고, G4 evidence가
생길 때까지 상태는 `ALLOCATED_G3_NOT_IMPLEMENTED` 또는
`ALLOCATED_REQUIRED_NOT_STARTED`로 유지한다.
