# 최신 HRIS 16개 capability exact G3 코딩 계약

## 판정과 범위

이 문서는 최신 HRIS 16개 capability의 G3 구현 계약이다. 2026-09-14 독립 제품 감사에서 발견된 업무 객체 식별자와 응답 source의 의미적 결함은 explicit semantic binding successor와 public identity registry로 교정했고, 2026-09-15 기준 normal 검증과 93개 mutation self-test를 통과했다. 다만 이 결과만으로 전역 Gate가 열리지는 않는다. 현재는 **독립 재감사·전역 봉인 대기, G3 착수 차단, 구현 미착수(`NOT_STARTED_G3`)**이며 production 활성화는 **미승인(`NOT_AUTHORIZED_G6`)**이다. authoritative live·published 검증 전체가 통과하기 전에는 모듈 코드 Gate를 열지 않는다. AI model/provider, 외부 연결, 국가·법정 규칙, 고객별 정책값과 실제 보존기간은 generic core에 하드코딩하지 않고 G6 activation에서 별도로 승인한다.

SKKF 구조를 그대로 복사하지 않는다. 메뉴·API·상태·이벤트·물리 테이블은 DWP의 HRM/PER/TIM/SYS runtime에 배치한다. PAY는 modern capability를 소유하지 않고 PER의 승인 보상계획 snapshot만 소비한다. 새로운 `talent`, `analytics`, `AI` 독립 서비스를 발명하지 않는다.

## 정본 산출물

| 정본 | 고정하는 내용 |
|---|---|
| `modern-capability-coding-contract-register.csv` | 16개 capability의 owner/runtime, backend·frontend·test root, migration, OpenAPI/AsyncAPI, 정확한 수량과 lifecycle |
| `modern-menu-node-register.csv` | 22개 메뉴 node의 route, persona, navigation surface, visibility와 atomic capability |
| `modern-capability-authorization-register.csv` | 48개 atomic authorization binding, owner PEP, population, field group, purpose와 G3/G6 경계 |
| `modern-capability-exact-schema-contracts.v1.json` | canonical operation 전체의 request/query/header/response/error schema와 request→validation/derivation→aggregate/objectRef→table/event field lineage, 물리 테이블의 business column·type·nullability·default·sensitivity·tokenization·FK/UK/check/index/RLS/retention. 전역 수량은 이 파일의 closed set에서 파생하며 별도 상수로 고정하지 않음 |
| `modern-capability-event-payload-contracts.v1.json` | canonical event 전체의 exact typed payload, topic, transition·operation binding과 공통 envelope. 전역 수량은 payload closed set에서 파생 |
| `modern-capability-semantic-bindings.v1.json` | canonical operation의 request·derived·persisted·response·event source를 업무 의미 단위로 명시한 explicit binding. type-only 및 generic event fallback은 허용하지 않음 |
| `modern-capability-public-identity-registry.v1.json` | 물리 identity 413개와 request 174개·response 212개·event 194개 public identity projection의 canonical field/type/대상 의미 |
| `modern-capability-operation-causal-contract-ssot.v2.json` | canonical operation과 내부 handler의 operation-scoped DML 순서, 기존 상태, CAS, command receipt, outbox/inbox, rollback 및 금지 경로 정본 |
| `modern-capability-causal-state-contracts.v2.json` | causal SSOT에서 결정적으로 생성된 구현 후보. 수기 편집으로 권한·상태·물리 sink를 우회할 수 없음 |
| `modern-capability-event-successor-lineage.v2.json` | canonical event 전체의 이전 정본→현 schema, semantic referent와 실제 table/column provenance successor 관계 |
| `sys-listening-stream-authority-successor.v1.json` | `dwp.hris.sys.listening.stream-authority-successor.v1`. Canonical modern 5개 계약에 합성된 Employee Listening 10 operation/24 table/7 public event와 configuration·protected admission·insights·Auth issuer 4-stream 경계를 단방향 검증하는 derived summary. 이 summary를 canonical 5개가 역참조하거나 별도 업무 정본으로 구현하는 것을 금지하며, 단일 V287, response→configuration local FK, raw response/token public event도 금지한다. |
| `modern-causal-independent-oracle.v1.json` / `modern-causal-independent-pg-fixtures.v1.json` | generator와 분리된 검토자가 고정한 operation/query/edge/handler oracle 및 PostgreSQL 16/18 실행 fixture |
| `reports/modern-causal-independent-pg-evidence.v2.json` / `reports/modern-causal-independent-final-hostile-review.v1.json` / `validate_modern_causal_final_endorsement.py` | 현재 입력 hash, PG16/18 comparable execution, P0/P1=0 최종 검토와 비순환 상호 봉인. G3 내부 workflow integrity만 보증하며 외부 reviewer identity attestation은 주장하지 않음 |
| `session-evidence/{hrm,tim,sys}/g3-modern-capability-contracts.v1.json`, `session-evidence/per/g3-modern-capability-contracts.v2.json` | 모듈별 aggregate, operation, state machine, transition, event, table, G4 acceptance evidence allocation. PER v1은 shared People Flyway stream을 전제로 한 immutable G2 predecessor이며 현재 실행 정본은 별도 performance stream의 v2다. |
| `session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json` | PER 승인 보상계획의 PAY consumer-only 계약과 2개 materialization table |

## 고정 수량

| 항목 | 수량 |
|---|---:|
| capability | 16 |
| exact API operation/request schema | canonical exact-schema closed set에서 파생 |
| response schema / record schema | 38 / 23 |
| state machine / transition | 16 / 85 |
| event / typed payload schema | canonical event-payload closed set에서 파생 |
| modern owner physical table | 91 active (predecessor exact 71에서 listening 4를 successor 24로 교체) |
| PAY consumer materialization table | 2 |
| menu node / atomic authorization binding | 22 / 48 |
| G4 acceptance contract | 48 |
| explicit semantic binding / typed source | canonical semantic-binding closed set에서 파생 |
| semantic mutation self-test | 93 |
| causal command / query / internal handler | canonical causal closed set에서 파생 |
| causal public event / required input use / selector | canonical causal/event closed set에서 파생 |
| checked-in owner transaction table / profile | 12 / 4 |
| legacy insert·append edge | 58 (command commit 51 + owner-handler commit 2 + forbidden 5) |
| causal hostile mutation self-test | 42 |

기존 G2 base physical blueprint 163개와 active modern owner table 91개는 이름 중복이 0이며, 전체 active planned owner table은 **254개**다. PAY consumer materialization 2개를 포함한 배포 계획 객체는 256개다. predecessor modern exact의 listening 4개는 trace로만 남고 successor 24개와 동시에 구현하지 않는다. 승인 보상 스냅샷은 불변 header/line 테이블로 분리하고 header 한 행에 1..100000개의 정렬된 line을 결합한다.

## 모듈별 구현 할당

| 세션 | capability 수 | operation | table | 권한 | 구현 root |
|---|---:|---:|---:|---:|---|
| HRIS-HRM | 6 | 36 | 24 | 18 | `dwp-people-server/.../people|organization|employeeservice`, `apps/dwp/src/features/hris/...` |
| HRIS-PER | 6 | 36 | 23 | 18 | `dwp-people-server/.../hris/performance`, `apps/dwp/src/features/hris/performance` |
| HRIS-TIM | 1 | 6 | 11 | 3 | `dwp-time-server/.../workforcemanagement`, `apps/dwp/src/features/hris/time/workforce-management` |
| HRIS-SYS | 3 | canonical exact-schema closed set에서 파생 (Listening 10 포함) | 33 active (기존 analytics/AI 9 + listening successor 24) | 9 | Platform configuration/protected/insights + Auth participation issuer, `apps/dwp/src/features/hris/administration` |
| HRIS-PAY | owner 0 | consumer only | 2 consumer | 0 | `dwp-payroll-server/.../payroll/input/compensationplan`; modern UI/menu를 소유하지 않음 |

상세 root와 Flyway/OpenAPI/AsyncAPI 파일명은 coding contract register가 유일한 정본이다. G3 작업 세션은 register의 자기 owner 행과 모듈 JSON만 수정한다. 다른 owner의 DB/repository 직접 접근과 cross-service FK를 금지한다.

`HRIS.MODERN.EMPLOYEE_LISTENING`의 위 역사 집계 8 operation/4 table/6 event는 predecessor 수량 추적값이다. active canonical 5개에는 관리자 재진입용 `modern.listening.surveys.query`와 DRAFT CAS 수정용 `modern.listening.survey.revise`를 포함한 10개 public operation, 2개 owner service, 4개 stream, 5개 runtime purpose, signed Privacy/Retention `protected.requestErasure`를 포함한 18개 owner port, 보호영역 erasure ticket REQUESTED producer·processor와 6개 internal-message inbox consumer로 구성된 8개 owner-local handler, 24개 stream-local planned table, `EmployeeListeningSurveyRevised.v3`를 포함한 7개 privacy-safe public event, 6개 최소 internal port message를 합성한다. 각 internal message는 수신 owner의 inbox claim→domain/CAS→closed ack→outbox를 한 transaction으로 닫고, erasure request는 ticket·sealed status receipt·idempotency 재진입을 원자적으로 남긴다. derived summary는 이를 단방향 검증할 뿐 별도 구현 정본이 아니다. 이는 새 사용자 journey CRUD 완료를 뜻하지 않는다. 24개 table CREATE와 API/worker/UI 동작은 G3/G4 구현 대상이며 production·실제 identity/process isolation은 G6다.

## 데이터·API 불변조건

- 내부 `tenant_id`는 `BIGINT NOT NULL`, 외부 `public_id`는 UUID다. tenant UUID cast와 내부 BIGINT ID의 외부 노출을 금지한다.
- 모든 tenant table은 RLS `ENABLE/FORCE`, `NOBYPASSRLS`, authenticated tenant predicate를 적용한다.
- table constraint와 index는 exact spec에 선언된 column만 참조한다. local FK와 모든 unique key는 `tenant_id`로 경계를 닫는다.
- local composite FK는 source/target column 순서와 SQL type이 일치하고 target에 동일 순서의 candidate key가 있어야 한다. 문자 enum check는 PostgreSQL에서 실행 가능한 single-quoted literal만 허용한다.
- 경계 밖 object/version/principal reference는 UUID만 사용한다. 내부 BIGINT surrogate key는 같은 bounded context의 tenant-bound composite FK 외에는 노출하거나 저장하지 않는다.
- 배열 입력은 scalar로 축약하지 않는다. 허용된 `UUID[]`는 tenant 가시성을 검증한 뒤 중복을 거부하고 UUID byte 오름차순으로 정규화하며, 같은 canonical array의 SHA-256을 함께 저장한다.
- 민감 field는 타입·분류·tokenization을 명시하고 unknown request/event field는 거부한다.
- 보존기간 숫자는 product core에 넣지 않는다. 모든 table은 `*_RETENTION_POLICY_REF`를 통해 country pack + tenant effective policy를 해석하고 실제 기간은 G6에서 활성화한다.
- query는 body·write·domain event가 없고 read-safe다. command는 `Idempotency-Key`, `X-Correlation-ID`, typed body와 exact write table을 가진다. optimistic command는 `If-Match`가 필수다.
- 모든 command는 정확히 선언된 transition과 event를 연결하고, 모든 event payload field는 typed/versioned schema로 닫는다.
- canonical exact-schema의 모든 operation은 field lineage를 가진다. command의 모든 required input, NOT NULL/no-default column, event field가 source와 derivation 및 sink를 가져야 하며 digest만 바꿔 업무 상태를 변경하는 구현은 금지한다.
- 81개 command는 owner별 기존 command-receipt를 먼저 claim하고 domain DML, receipt completion, 실제 outbox append 순으로 한 transaction에서 실행한다. HRM은 `ppl_command_receipts`/`sys_people_outbox_events`, PER는 `prf_command_receipts`/`prf_outbox_events`, TIM은 `tme_command_receipts`/`tme_outbox_events`, SYS는 `sys_hris_command_receipts`/core `sys_domain_event_outbox`를 사용한다. 존재하지 않는 공통 alias나 scalar `result_ref` 내부의 가상 JSON decision receipt를 금지한다.
- 정책·확인 입력의 감사 사실은 새 opaque JSONB가 아니라 각 owner receipt의 `originating_action`, subject principal, population digest, field-policy/purpose/authorization revision, request digest와 실제 결과 상태에 구조화해 저장한다. checked-in DB trigger가 originating authorization/idempotency seal 변경·삭제를 거부해야 한다.
- 4개 owner-result handler는 HRM/TIM/core SYS의 실제 inbox에서 claim하고 domain write와 4개 handler event outbox를 원자적으로 완료한다. 19개 query는 receipt/domain write/outbox를 모두 금지한다.

## Compensation Planning 경계

`HRIS.MODERN.COMPENSATION_PLANNING`의 lifecycle/aggregate/API/state/table/FE owner는 **HRIS-PER**이며 backend root는 `dwp-people-server/src/main/java/com/dwp/services/people/hris/performance/compensationplanning`이다. PAY는 계획 ledger나 UI를 만들지 않는다.

PAY는 snapshot header와 1..N line이 모두 커밋된 뒤 발생하는 `ApprovedCompensationPlanSnapshotPublished.v2`만 중복 제거해 소비하고 `SVC-PEP-PER-001`로 다음 정본 API를 재조회한다. 계획 승인만 기록한 `CompensationPlanApprovalRecorded.v2`는 PAY trigger가 아니다.

- `GET /internal/hris-performance/v1/approved-compensation-plan-snapshots/{snapshotId}`
- operation: `getApprovedCompensationPlanSnapshot`
- caller: `dwp-payroll-server`
- purpose: `HRIS_APPROVED_COMPENSATION_PLAN_SNAPSHOT_REFETCH`

`ApprovedCompensationPlanSnapshot.v1`은 불변 header와 `ApprovedCompensationPlanLine.v1[1..100000]`로 구성한다. `lineCount == lines.length`, `lineSequence` 연속·오름차순, line UUID/sequence 유일성, header digest와 ordered line digest 결합을 검증한다. PAY는 tenant, purpose, field projection, 승인 revision, effective range, freshness, header/line digest를 재검증한 뒤 line N개를 정확히 N개의 immutable payroll input으로 동결한다.

`CompensationPlanApproved.v1`은 G2 characterization과 successor-lineage predecessor로만 보존한다. G3 runtime의 producer·consumer·trigger·primary owner·trace·XCON·slice에는 존재할 수 없고 v1/v2 dual publish도 금지한다. `ApprovedCompensationPlanSnapshotPublished.v2`의 16개 required field는 PER producer, XCON-021 schema, PAY consumer에서 정확히 같아야 한다.

## Fail-closed 검증

```bash
python3 coding-readiness/generate_modern_semantic_field_lineage.py --check
python3 coding-readiness/validate_modern_semantic_field_lineage.py --compact
python3 coding-readiness/validate_modern_semantic_field_lineage.py --self-test --compact
python3 coding-readiness/validate_modern_capability_contracts.py
python3 coding-readiness/validate_modern_capability_contracts.py --self-test --compact
python3 coding-readiness/validate_modern_capability_contracts.py --postgres-feasibility --compact
python3 coding-readiness/validate_modern_capability_authorization.py
python3 coding-readiness/validate_compensation_snapshot_v2_authority.py --compact
python3 coding-readiness/validate_compensation_snapshot_v2_authority.py --self-test --compact
python3 coding-readiness/generate_modern_causal_successor.py --check
python3 coding-readiness/generate_modern_event_successor_lineage.py --check
python3 coding-readiness/validate_modern_causal_state_contracts.py --self-test --compact
python3 coding-readiness/validate_modern_causal_state_contracts.py --postgres-feasibility --compact
python3 coding-readiness/validate_physical_owner_prefixes.py --self-test --compact
python3 coding-readiness/generate_sys_listening_stream_authority_successor.py --check --compact
python3 coding-readiness/validate_sys_listening_stream_authority_successor.py --compact
python3 coding-readiness/validate_sys_listening_stream_authority_successor.py --self-test --compact
```

semantic generator check는 생성 결과가 봉인된 exact schema/event 계약과 byte-equivalent인지 확인한다. semantic validator와 self-test는 required request·column·response·event source, public identity, receipt UUID ordered key, cross-capability SQL source를 검증하며 type-only/generic fallback을 fail-closed한다. modern contract validator는 capability/operation/menu/auth/state/event/table/test/file allocation과 exact transport/data schema를 교차 검증한다. compensation v2 authority validator는 16개 capability trace 전체, DEP-019, XCON-021, PER producer, PAY consumer, canonical exact/event set에서 파생한 primary ownership과 slice를 독립 비교하며 predecessor 재활성화·v2→v1·dual publish·16-field drift를 mutation으로 거부한다. causal validator는 generator/reviewer oracle을 import하지 않고 checked-in base transaction table의 실제 column/default/NOT NULL과 receipt 불변 trigger를 다시 파싱하며, PostgreSQL 16/18에서 canonical causal closed set의 command·handler·outbox fact·edge와 replay/rollback/tenant mismatch를 실행한다. authorization validator는 planned authorization binding이 canonical exact operation과 owner route를 완전히 덮으면서 현행 implemented PEP와 겹치지 않는지 검증한다. 어느 하나라도 실패하면 modern G3 code Gate는 닫힌다.

## G3 완료와 G6 활성화의 구분

G3에서는 generic domain logic, API/event contract, Flyway schema, PEP enforcement, FE workflow와 automated tests를 구현한다. G4에서는 contract/state/security/acceptance evidence를 제출한다. 실제 AI·법정·보존·customer/connector configuration을 켜는 행위는 G6의 owner 승인, synthetic/golden 검증, privacy/security/legal 확인 후에만 허용한다.
