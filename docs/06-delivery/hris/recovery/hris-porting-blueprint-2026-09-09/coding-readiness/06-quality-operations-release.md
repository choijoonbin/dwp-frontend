# HRIS 품질·운영·마이그레이션·릴리스 계약

## 1. Definition of Done

기능 한 건은 코드가 컴파일되는 것으로 끝나지 않는다. source decision/child trace → target capability/menu → API/event → aggregate/table → 권한/SoD → 상태전이 → test/golden → metric/alert/runbook → 디자인 대상 surface가 연결돼야 한다. 적용 가능한 상태와 실패복구가 하나라도 빠지면 G4가 아니다.

## 2. 테스트 피라미드

| 층 | 필수 범위 |
|---|---|
| Pure/domain | 금액/시간/유효기간/상태/산식 property와 boundary, deterministic rule version |
| Repository | PostgreSQL Testcontainers, PK/UK/FK/exclusion/RLS/index/query plan, tenant negative |
| Application | idempotency, CAS, SoD, audit/outbox atomicity, retry/compensation, result unknown |
| Contract | OpenAPI/event schema backward compatibility, producer/consumer, field projection |
| Component | page/form/grid/receipt 상태, keyboard/a11y, 403/409/stale/partial |
| Integration/E2E | persona별 핵심 journey, cross-service eventual consistency, approval/close/pay sequence |
| Golden | 합성 HRM/TIM/PER/PAY 입력과 expected result/digest, rule/country-pack version |
| Resilience | dependency timeout, duplicated/out-of-order event, worker crash, lease expiry, DLQ/replay |
| Performance | reference profile의 read/command ack/batch throughput, DB plan과 memory bound |
| Security/privacy | cross-tenant/scope/field/SoD, replay, import, log/event leakage, support session |

Mutation/property testing은 payroll/time calculation과 state guard처럼 오류 비용이 큰 pure rule에 우선 적용한다. snapshot test만으로 계산 정확성을 증명하지 않는다.

## 3. 합성 Golden 전략

실제 고객 데이터가 없어도 core 코딩은 다음 합성 dataset으로 검증한다.

- HRM: 입사, 미래발령, 겸직, 조직이동, 휴직/복직, 퇴직/재고용, 기간충돌
- TIM: 정상/DST/야간/자정경계/휴일/초과/결측/중복타각, 휴가발생·취소·소급보정, 마감/재개방
- PER: 목표변경, 평가자 변경, 제출/반려, calibration, 공개, scope/비공개 필드
- PAY: 정기/중도 입퇴사/소급/정정/0·음수/상한·하한/다통화/rounding, time handoff, reversal
- SYS: app 권한 없음, package revision drift, static/dynamic SoD, config four-eyes, job 중복/retry, connector dry-run

값과 법정 규칙은 `TEST_ONLY` provider로 명시하고 production country pack으로 사용하지 않는다. 실제 tenant UAT/golden과 KR 법정 회귀팩은 G6 activation에서 추가한다.

## 4. Reference load profile

코드와 schema 검증을 위한 기본 reference profile이며 계약 고객의 보증값이 아니다.

| Profile | Active workers | Daily clock events | Payroll workers/run | Concurrent interactive users |
|---|---:|---:|---:|---:|
| S | 5,000 | 20,000 | 5,000 | 250 |
| M | 25,000 | 125,000 | 25,000 | 1,000 |
| L | 100,000 | 600,000 | 100,000 | 4,000 |

최소 code gate는 S/M fixture와 L 규모 생성기를 제공하는 것이다. production SLO/capacity는 tenant 계약, 보존, peak, topology로 G6에서 확정한다. partition/cache/read replica는 측정 결과와 query plan에 따라 켜고 데이터 양만으로 선제 도입하지 않는다.

## 5. 관측성과 SLO 설계

모든 request/job/event에 correlation과 owner context를 둔다. metric label에는 tenant ID, worker ID, pay run ID 같은 고카디널리티/민감 값을 넣지 않는다.

필수 지표:

- API latency/error/denied/conflict/rate-limit, DB pool/query timeout
- outbox/inbox lag, retry/DLQ, duplicate/out-of-order, stale snapshot
- job queue/lease/heartbeat/duration/item outcome/cancel
- connector health, reconciliation mismatch, provider throttling
- HRM data-quality exception, TIM unresolved exception/period state
- PAY run state/worker failure/totals digest/release failure
- Home contribution freshness/partial/degraded
- auth package drift, SoD block, privilege expiry/review

코드 기본 목표는 interactive read p95 500ms, command acceptance p95 800ms, home shell p95 1.5s와 widget 부분실패 격리다. 이는 reference 환경의 테스트 목표이며 production 보증은 G6에서 승인한다. error budget, pager/티켓 경계, RTO/RPO도 tier별 activation 정책으로 확정한다.

## 6. Runbook과 복구

각 비동기 흐름은 다음 runbook을 갖는다.

- 탐지 지표와 사용자 영향
- 안전한 중지/재개 조건
- receipt, correlation, aggregate version으로 진단하는 방법
- 같은 idempotency key의 재시도와 금지된 수동 DB 수정
- DLQ quarantine/replay 승인과 순서 보존
- partial success의 실패 item만 재실행하는 방법
- reconciliation, correction/reversal, 감사 확인
- escalation owner와 country/connector provider 경계

Payroll release, bank file, statutory filing, period close/reopen은 break-glass와 four-eyes 절차 없이 운영자가 임의 강제 완료할 수 없다.

## 7. SKKF 데이터 마이그레이션

소스 DB를 통째로 복제하지 않는다.

1. source artifact/운영 export를 provenance와 함께 수집
2. canonical staging schema로 읽기 전용 적재
3. code/identity/org/worker/effective-date mapping과 데이터 품질 분류
4. dry-run 변환, row/aggregate totals와 orphan/overlap/invalid-state 보고
5. domain API 또는 승인된 bulk loader로 idempotent load
6. count, totals, ledger balance, referential, sample journey reconciliation
7. delta capture와 freeze window
8. tenant feature flag/canary cutover
9. read-only archive와 법정 보존, rollback 기준시점 고정

마이그레이션 오류는 임의 default로 채우지 않고 `BLOCKING / REVIEW / AUTO_NORMALIZED`로 분류하고 receipt를 남긴다. 고객사별 mapping은 tenant migration package이며 core source fork가 아니다.

## 8. 배포와 호환성

- DB는 expand → dual-read/write가 필요한 경우 명시 → backfill/reconcile → switch → contract 순서다.
- event/API는 additive 변경을 우선하고 기존 consumer deprecation window를 둔다.
- feature flag는 tenant/module/country pack/surface/capability 단위이며 권한을 대체하지 않는다.
- 신규 service는 dark launch → internal synthetic → pilot tenant → canary cohort → staged rollout을 따른다.
- rollback은 binary rollback만이 아니라 schema/event/worker/side-effect 상태를 포함한다.
- irreversible external side effect 후에는 rollback 대신 correction/reversal workflow를 사용한다.

## 9. CI/CD Gate

모든 module PR:

- format/lint/type/compile/unit
- architecture/service boundary/source-size/cycle/unused code
- Testcontainers migration/invariant/tenant negative
- OpenAPI/event compatibility and generated snapshot
- authorization/SoD/field negative matrix
- dependency vulnerability/license/SBOM and secret scan
- module golden and impacted E2E
- migration number ownership and clean rebase

Integration checkpoint:

- 전체 backend `./gradlew check --no-daemon`
- frontend immutable install, architecture, typecheck, full test, build, contract, security audit, SBOM
- 5개 source register/evidence와 readiness validator
- dirty worktree/unauthorized central-file/migration collision 검사
- `g3-slice-code-go-register.csv`에 선할당된 per-slice runbook, telemetry, migration clean+upgrade/RLS/backfill, worker crash/replay, feature-flag/event forward-correction와 acceptance evidence의 typed PASS 및 checkpoint digest 검사

모듈은 위 파일을 만들고 `status=PASS`를 적는 것만으로 G4를 선언할 수 없다. `validate_g4_functional_gate.py`는 active 100개 slice를 HRM 21, PER 22, PAY 21, TIM 20, SYS 16으로 정확히 닫고, slice마다 backend/frontend `MODULE_COMMIT` checkpoint의 closed catalog 전체 argv digest·재현 digest와 FE exact test typed result, runbook·telemetry·migration·recovery·acceptance 5종 파일 및 하위 artifact digest를 검증한다. 조상 checkpoint PASS만으로는 부족하다. `capture_g4_final_head_evidence.py`가 등록된 Integration Control backend/frontend 작업폴더의 현재 clean commit/tree에서 해당 모듈의 모든 active slice closed command를 다시 실행하고, exact command set·argv/output/reproducible digest·FE typed result를 각각 append-only G4 shard에 남겨야 한다. aggregate 검증·Control append 시점에도 그 commit이 현재 Integration HEAD여야 하므로 뒤이은 통합 commit은 앞선 G4를 자동으로 stale 처리하고 재검증을 요구한다. 각 증거와 aggregate는 `write_module_evidence_shard.py --phase g4`로 자기 `session-evidence/<module>/g4` append-only shard에만 추가하고, aggregate는 `gates/<gate-id>/functional-gate-aggregate.json` exact 경로를 사용한다. Integration Control만 `append_g4_functional_gate.py`로 검증된 aggregate SHA와 checkpoint prefix를 append-only `g0/g4-functional-gate-register.csv`에 기록한다. G5A는 해당 모듈의 최신 `VERIFIED_G4_FUNCTIONAL_GATE` 행과 byte-for-byte 일치하는 aggregate만 받는다. 누락·stale·fake PASS·다른 모듈 checkpoint·과거 HEAD 재사용·skipped/no-test·wrong test collection·cross-module shard 증거는 실패하며, 이는 실측 G6 승인과 별개다.

G6 activation은 추가로 tenant UAT, 실제 connector certification, country statutory signoff, volume/load/DR exercise, production security/privacy/DBA/operations 승인과 cutover rehearsal을 요구한다.

기존 Approval 운영 DB가 V24-era 역할을 보유할 수 있는 경우에는 일반 migration rehearsal만으로 충분하지 않다. `ACT-G6-APPROVAL-LEGACY-ROLE-HARDENING`의 일회성 복구 runbook을 별도로 실행한다.

1. 대상 DB와 migration high-water를 동결하고 principal·`rolinherit`·membership·ownership·cluster/database ACL inventory 및 schema-history/ownership digest를 채취한다.
2. 검토된 `rolinherit=false` 전환 또는 controlled role rebuild 계획, 영향 분석, 중단 범위와 backup restore point를 승인한다.
3. Control 전용 자격으로 변경하고 전후 membership·ownership·ACL diff와 exact schema-history digest를 봉인한다.
4. migration/runtime 자격을 분리한 strict process restart에서 정상 업무와 권한상승 negative test를 재실행한다.
5. rollback rehearsal와 restore 가능성을 증명한 후 실명 DBA·Security·SRE release 승인을 기록한다.

이 receipt가 완결되지 않으면 영향을 받는 Approval production activation만 차단한다. fresh/disposable DB를 사용하는 G3 clean-from-zero 검증과 모듈 코딩은 계속 가능하며, 운영 DB 복구를 일반 application startup이나 모듈 세션에 위임하지 않는다.

## 10. Design AI 이후 회귀

G5 디자인 교체는 component/token/layout만 변경할 수 있다. route, API, command, permission, state, receipt, audit, keyboard/focus 의미는 G4 정본을 유지한다. 각 모듈은 1440/390, 주요 persona, loading/empty/error/denied/conflict/stale/partial/success, dialog/drawer/wizard/report/document를 포함하는 prompt package와 screen coverage register를 생성한다. Design AI 결과가 기능을 암시만 하고 실제 command/API가 없으면 채택하지 않는다.
