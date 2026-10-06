# HRIS 백엔드 서비스 아키텍처

상태: **목표 구조 / G3 CLOSED**. 이 문서의 package·aggregate 원칙은 설계 입력이며 실행·배선 완료 증거가 아니다. 현재 공통 준비와 독립 감사는 `reports/readiness-recovery-2026-09-14.md`를 따른다. 아래 역사적 stream/예약을 현재 CREATE 허가로 해석하지 않는다.

## 1. 배치 원칙

DWP의 Spring Boot 3.5/Java 21/Gradle/Flyway/PostgreSQL, Gateway, product-surface authorization, audit/event outbox, OpenTelemetry 기반을 재사용한다. 서비스는 업무 변경 빈도, 트랜잭션 경계, 장애 격리, 데이터 민감도, 계산 부하를 기준으로 나눈다.

| Service | HRIS 소유 | 금지 |
|---|---|---|
| `dwp-people-server` | HRM과 초기 PER, canonical worker/org snapshot | Time/Payroll ledger 저장, 다른 DB 직접 읽기 |
| `dwp-time-server` | schedule, clock, interpretation, time/leave ledger, approval, close | 급여 계산, HRM master 수정 |
| `dwp-payroll-server` | payroll input/run/result/payment/GL/statutory provider ports | 사람/근태 DB join, 미승인 결과 지급 |
| `dwp-auth-server` | HRIS entitlement, access package, assignment, static SoD/effective permission; `hris_participation_issuer`에서 listening eligibility와 opaque 참여 envelope 발급 영수증 소유 | HR 도메인 데이터·protected 응답·insights projection 소유 |
| `dwp-platform-server/hrisconfiguration` | config registry framework, automation/connector control plane, home contribution projection; 추가 `hris_configuration` stream/권한의 결정안은 아래 참조 | HR 도메인 규칙 계산, 임의 코드 실행, protected/insight 응답·집계 저장 |
| `dwp-platform-server/hrislisteningprotected` | `hris_listening_protected`의 admission snapshot, response/answer, token consumption, protected receipt, erase/cohort privacy fence | configuration local ID/FK, principal-bound receipt, raw response/token event, insights direct SELECT |
| `dwp-platform-server/hrisinsights` | `hris_insights`의 privacy-safe cohort projection/lineage/export receipt; query와 projection-write principal 분리 | 고용·근태·급여·성과·보상 결정, 원천 domain repository/FK, protected 응답 접근, 소규모 cohort/direct identifier export |
| 기존 Approval/Notification/Audit | 승인, 알림, 감사 transport/collector | domain state의 SoR 역할 |
| `dwp-gateway` | edge authentication context, route, composition, rate/size limit | 업무 상태전이와 계산 |

## 2. Package 표준과 의존 방향

각 bounded context는 다음 layer 구조를 사용한다. 단 package root를 모든 service에
`hris.<context>`로 다시 중첩하지 않는다. 실제 root는 아래 표와
`module-structure-contract-register.csv`가 정본이다.

```text
<registered-context-root>/
  api/             # controller, request/response DTO, exception mapping
  application/     # use case, transaction orchestration, ports
  domain/          # aggregate, value object, invariant, state machine, event
  infrastructure/  # JDBC/JPA repository, event/audit adapter, external adapter
  config/          # Spring wiring and validated properties
```

허용 방향은 `api → application → domain`, `infrastructure → application/domain`이다. domain은 Spring, HTTP, JDBC, Kafka DTO를 import하지 않는다. application port를 구현하는 adapter만 외부 시스템을 안다. 같은 service 내 HRM과 PER도 서로 repository를 import하지 않고 application query port와 snapshot contract를 사용한다.

| 세션 | 정본 Java root |
|---|---|
| HRM | `com.dwp.services.people.hris.{people,employment,organization,employeeservice,compatibility}` |
| PER | `com.dwp.services.people.hris.performance` |
| TIM | `com.dwp.services.time` |
| PAY | `com.dwp.services.payroll` |
| SYS | `com.dwp.services.auth.productaccess.listeningissuer`, `com.dwp.services.platform.hrisconfiguration.listening`, `com.dwp.services.platform.hrislisteningprotected`, `com.dwp.services.platform.hrisinsights.listening` 및 기존 SYS root |

각 root의 `api/application/domain/infrastructure/config` import edge와 금지 edge는
module별 architecture test가 검사한다. `domain → Spring/HTTP/JDBC/JPA/Kafka`, 다른
service의 repository/entity import, package root 우회는 fail-closed다.

## 3. Aggregate 경계

| Context | 대표 aggregate | 핵심 invariant |
|---|---|---|
| HRM | Person, Worker, Employment, Assignment, OrgUnit, Position, HrCase | tenant/business key unique, 유효기간 비중첩, 주배치 규칙, 변경 reason/evidence |
| PER | PerformanceCycle, GoalPlan, Goal, ReviewAssignment, Evaluation, CalibrationSession, PublishedResult | cycle/version 고정, 평가자 대상 제한, 제출 후 immutable revision, calibration/publish SoD |
| TIM | WorkSchedule, ClockEvent, TimeInterpretation, Timesheet, TimeLedger, LeaveAccount, LeaveRequest, TimePeriod | raw event 불변, rule version 추적, 중복 타각 방지, 승인 결과 append-only, 마감 후 보정/재개방 절차 |
| PAY | PayGroup, PayCalendar, PayrollInputSet, PayrollRun, WorkerCalculation, PayResultLedger, PaymentBatch, AccountingBatch | frozen inputs, deterministic rule version, 금액/통화/rounding 추적, 승인 전 release 금지, 역분개 append-only |
| SYS/Auth | AccessPackage, PackageRevision, Assignment, ScopeBinding, FieldPolicy, SodRule | app entitlement 교집합, revision 일치, overlapping effective permission SoD |
| SYS/Configuration | ConfigSet, ConfigVersion, Survey/FormDefinition, Metric/AiDefinition, AutomationDefinition, RunReceipt, ConnectorDefinition, MappingVersion | `hris_configuration`의 정의·version·게시/운영 메타. draft/publish four-eyes, signed manifest, secret reference only. 응답 원문·신원 발급 기록·분석 결과 접근 금지 |
| SYS/ProtectedAdmission | ListeningAdmissionVersion, ProtectedResponse, TokenConsumption, ProtectedReceipt | `hris_listening_protected`, `hrisinsights.listening.admission` owner. 자기 immutable admission snapshot·동일 admission의 local FK·submit/close fence·보호된 replay/erase. configuration local ID나 principal-bound receipt 공유 금지 |
| SYS/Insights | CohortResult, MetricProjection, AnalyticsExportReceipt, AiAssistanceProvenance | `hris_insights`의 privacy-safe projection·lineage·export/보조 결과. SELECT-only query와 execution-write principal 분리, anti-reidentification threshold·purpose/field projection. protected 응답·token/issuer 접근 및 transactional HR 결정 금지 |
| SYS/AuthParticipationIssuer | EligibilityGrant, ParticipationTokenIssuanceReceipt | `hris_participation_issuer`, `productaccess.listeningissuer` owner. 인증된 eligibility와 무작위 token의 최소 발급 기록, protected 응답 접근 금지 |

`hrisconfiguration`, `hrislisteningprotected`, `hrisinsights`, Auth `listeningissuer`는 서로 다른 bounded context다. active `MOD-SYS-LISTEN` 해석 정본은 operation causal·semantic binding·public identity·exact schema·event payload의 canonical 5개에 합성된 Listening 행이다. `dwp.hris.sys.listening.stream-authority-successor.v1` (`sys-listening-stream-authority-successor.v1.json`)은 그 5개 정본을 입력으로만 받아 생성하는 검증용 derived summary이며 정본으로 역참조할 수 없다. context 간 repository/entity import와 cross-schema FK/local BIGINT 전달을 금지하고 versioned owner port 또는 privacy-safe event만 사용한다. 네 stream은 `hris_configuration`, `hris_listening_protected`, `hris_insights`, `hris_participation_issuer`의 서로 다른 schema/history/location/migration principal을 갖고, insights SELECT-only와 projection-write를 포함한 정확히 5개 runtime purpose/principal을 사용한다. 관리자는 `modern.listening.surveys.query`로 optional exact survey ID·상태·기간·cursor를 사용해 create/publish/close/action 결과를 재조회하고, `modern.listening.survey.revise`로 DRAFT 상태만 expected aggregate version CAS 하에 수정하며 server version을 정확히 1 증가시키고 `EmployeeListeningSurveyRevised.v3`를 발행한다. 보호 응답 삭제는 signed Privacy/Retention `protected.requestErasure` 또는 owner due-scan이 `REQUESTED` ticket·sealed status receipt·idempotent 재진입을 먼저 원자적으로 만들고, 별도 owner-local processor가 ticket claim→key material/answer erasure→tombstone→stable replay receipt로 닫는다. 6개 cross-stream internal message는 각각 수신 owner의 inbox claim→domain/CAS→closed ack→outbox를 한 transaction으로 처리하며 중간 fault는 전부 pre-state로 rollback한다. 기존 `V287__hris_platform_modern_employee_listening.sql`은 실행 예약이 아니며 4개 stream별 V1..V40 successor reservation으로 대체한다. native bootstrap·runtime-only startup seal·실제 배선·pilot은 `NOT_STARTED_G3`, 전체 업무 CRUD는 `NOT_STARTED_G4`, 실제 identity/process-isolation/tenant 활성화는 G6다. 같은 JVM의 SQL 권한 분리를 process compromise 격리로 주장하지 않는다. Analytics/AI는 configuration+insights만 요구하고 listening은 네 stream을 함께 요구한다.

한 aggregate transaction이 너무 커지는 것을 막기 위해 payroll worker calculation, time interpretation, bulk import는 item/partition 단위로 처리하고 run aggregate는 orchestration 상태와 totals/checksum을 소유한다. 실제 고정 입력·선택된 owner source/version·항목·결과/trace는 같은 업무 owner의 별도 immutable artifact/item에 보관하고 exact reference로 재조회한다. digest만 기록하고 실제 입력/결과를 버리는 설계는 아니다. 위 supplemental context·subroot/port·DS 목적의 architecture register/test successor는 아직 승인·배선 완료가 아니다.

## 4. 동기·비동기 경계

- 사용자가 즉시 확인해야 하는 단건 조회/검증은 동기 HTTP다.
- 계산, 대량 import/export, period close, statement generation, connector sync는 command 수락과 receipt 조회로 분리한다.
- service 간 state propagation은 transactional outbox와 idempotent inbox가 기본이다.
- 이벤트 지연 중 안전하지 않은 command는 required snapshot version을 확인해 `409 STALE_DEPENDENCY`로 닫는다.
- polling worker는 `FOR UPDATE SKIP LOCKED`, lease token, heartbeat, retry budget, DLQ를 사용한다.
- 이벤트 payload는 event별 exact typed 계약의 최소 업무 식별자·변화 종류·native version/CAS·owner snapshot/refetch reference 및 필요한 최소 비민감 내용을 담는다. generic ID+kind/digest만으로 typed 업무 의미를 대체하지 않는다. 민감 원문은 public event/topic에 내보내지 않고 owner API에서 purpose/scope/field policy·현재 version을 다시 평가해 조회한다.

## 5. 트랜잭션·동시성·재시도

- 모든 mutable aggregate는 monotonic `version`을 가진다.
- update/delete/transition은 expected version이 없으면 고위험 command에서 `428`, 불일치면 `409`다.
- idempotency record는 tenant, actor/client, operation, key, payload hash, status, response/receipt ref, expiry를 가진다.
- 같은 key·같은 payload는 원결과를 재생하고, 같은 key·다른 payload는 충돌이다.
- 외부 side effect는 DB commit 전에 호출하지 않는다. outbox/worker가 수행하고 provider idempotency key와 receipt를 저장한다.
- 분산 transaction을 사용하지 않는다. compensation은 명시적 domain command/event이고 감사·역분개 이력을 남긴다.

## 6. 데이터 접근

- 내부 PK와 `tenant_id`는 DWP 관례의 `BIGINT`, 외부 식별자는 `UUID public_id`다.
- 모든 unique/index/FK의 tenant 범위를 명시한다. 다른 service public ID에는 DB FK를 만들지 않는다.
- high sensitivity 테이블은 API/worker DB role을 분리하고 RLS를 강제한다.
- repository query는 tenant/scope predicate 없이 실행할 수 없도록 request context를 필수 인자로 받는다.
- list query는 bounded pagination과 deterministic tie-breaker를 사용한다.
- effective-dated published row는 `[from,to)`이고 같은 business key의 range overlap을 exclusion constraint로 차단한다.
- 위 `[from,to)`는 신규 모델의 목표 계약이다. 기존 People의 native DATE·inclusive end/CURRENT_DATE 조회를 그대로 같은 의미라고 가정하지 않는다. owner가 계약에 end-bound 의미·업무 timezone·요청 asOf·parent 유효기간을 명시하고 검증해야 한다. 복수 worker/relationship/assignment를 primary `LIMIT 1`로 줄이는 legacy 조회는 self-context authority의 완전한 결과로 사용할 수 없다.
- append-only ledger는 correction/reversal row를 추가하며 원행을 overwrite/delete하지 않는다.

## 7. Migration 번호와 호환성

People `V46`/Auth `V210`/Platform `V230`과 HRM47–69/Auth211–239/Platform231–259는 historical G2 기준이며 현재 high-water/예약 허가가 아니다. 역사 proposal과 G2 checkpoint는 변경하지 않고 증거로만 보존한다. 현행 C1 정본은 최종 clean backend descendant와 pre-G3 common-foundation exact-six(Approval V36–V38, Platform V254.1/V261, Notification V32)를 결합해 `g0/migration-successor-register.v1.json`으로 재생성하며 People50/Auth216/Platform261/Approval38/Notification32와 private Performance0/Payroll0/Time0을 봉인해야 한다. 모듈용 successor range는 HRM People51–73, PER Performance1–63, PAY1–49, TIM1–39, SYS Auth217–245 및 Platform262–290이다. `g0/validate_migration_successor.py`가 exact-six 기술 receipt, 중복·겹침·stale high-water·private/public 누수·exact-byte rename 계보를 모두 거부하기 전에는 새 Flyway CREATE를 시작하지 않는다.

승인 이후 모듈 owner는 자기 stream·service·prefix·range와 slice reservation에 맞는 직계 Flyway 파일을 `CREATE`만 한다. 기존 파일 수정·삭제·rename·symlink와 다른 slice의 numeric version 선점은 금지한다. Integration Control은 앞선 owner `MODULE_COMMIT`의 동일 path/blob만 source-linked merge하고 DBA workflow review 및 affected-service/global clean-upgrade replay를 봉인한다. shared/on-demand 중앙 migration만 proposal-bound `CENTRAL_MATERIALIZATION`으로 처리한다.

DB 변경은 expand → backfill/reconcile → reader switch → contract 순서다. 기존 `V38` HR demo 테이블은 full HRIS canonical schema가 아니며 호환 adapter를 거쳐 단계적으로 읽기 전환 후 제거한다. 이미 배포된 Flyway 파일은 수정하지 않는다.

API/event는 기존 필드 삭제·의미변경 대신 새 version을 추가한다. consumer contract와 down-conversion/compatibility window가 없으면 breaking version을 게시할 수 없다.

## 8. 공통 DWP 기반 재사용

- `dwp-core` domain event outbox/inbox와 audit outbox
- `dwp-audit`의 framework-neutral audit contract
- `dwp-observability`와 OpenTelemetry trace/metric
- DWP product-surface authorization, owner-service PEP, negative matrix
- Approval service의 승인/서명/step-up 패턴
- Notification service의 entitlement-aware delivery와 outbox
- Platform object storage와 controlled export 패턴

공통 모듈 재사용은 편의를 위한 domain leakage를 허용하지 않는다. HRIS-specific DTO/rule/table을 `dwp-core`에 넣지 않는다.

## 9. Scaffolding 순서

Integration Control은 새 service의 `settings.gradle`, service `build.gradle`,
`application.yml`, Docker Compose, `scripts/devctl.py`, CI/deploy manifest와 중앙
OpenAPI/AsyncAPI publication만 생성한다. 이 책임은 `g3-file-allocation-register.csv`의
`G3-CTL-*` 경로를 벗어나지 않는다. TIM/PAY 모듈은 자기 source/test allocation 안에서
health/readiness dependency indicator, domain Flyway/RLS와 owner-allocated CREATE-only migration,
outbox/inbox, audit adapter, boundary·tenant-negative·failure test를 구현한다. Flyway 파일은
등록된 stream/range/prefix/reservation 안에서 모듈 owner가 CREATE하고 SQL 의미·clean/upgrade/RLS/
backfill 검증을 책임진다. Integration Control은 동일 blob merge·DBA workflow review·global replay를 담당한다. 중앙은 module checkpoint 없이 domain Java/test를
대신 만들지 않고, 모듈은 중앙 build/runtime/contract 파일을 직접 수정하지 않는다.

102개 slice 각각의 실행 명령과 향후 runbook·telemetry·migration clean/upgrade·worker
recovery·acceptance evidence 경로는 `g3-slice-code-go-register.csv`에 선할당돼 있다.
checkpoint는 `g0/g3-checkpoint-evidence-contract.md`의 command-level PASS와 Git diff
1:1 touch evidence가 없으면 봉인할 수 없다. 비어 있는 service라도 module health,
dependency-failure, tenant-negative, worker crash/replay test가 통과해야 한다.
