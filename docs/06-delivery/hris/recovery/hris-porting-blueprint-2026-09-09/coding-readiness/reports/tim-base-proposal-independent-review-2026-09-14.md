# TIM BASE 제안 독립 검토 — 2026-09-14

결론: 제안은 G3 승인 대상이 아닙니다. P0 5건(신규·source 미검증 4건 + 작성자가 명시한 shared 준비 OPEN 1건), P1 6건을 기록합니다. 표준 shape 검사 통과는 업무 의미·실제 SQL·권한·native 실행의 PASS가 아닙니다. 원본/historical/BE/FE/canonical Gate는 수정하지 않았고 신규 보고서 두 파일만 저장했습니다.

## 고정 검토 입력

- JSON: `coding-readiness/semantic-remediation/tim-base-exact.proposal.v1.json`, SHA256 `5fbb5b1ae3fd92795939e4ecea85877035fae85cf1c32189db22e91037cc3933` (10,707,168 bytes).
- MD: 동일 stem `.md`, SHA256 `32fa6514408faf690de707ca7c585fb957df8b3cfc1145b035f87a3079d5ddbb`.
- 실제 source oracle: `validate_modern_semantic_field_lineage.py`, SHA256 `30e3fe74498ba265945970b4b68ab008bbce6108fc74169edd356e8d70f3bf81`.
- proposal inputManifest 8개 실제 파일 SHA도 모두 일치했습니다. root WFM 다른 version은 이 검토 source로 대체하지 않았습니다.

## 전수 검사 범위와 실제 증거

114 operation, 43 planned table/581 column, 4,789 write target/source row, 5,018 typed declaration, 461 schema, 81 event 및 9 machine/86 transition 전체를 기계적으로 순회했습니다. JSON 보고서에는 모든 operation/table의 정확한 coverage register와 실행 가능한 stdin probe source를 포함했습니다. 핵심 source/ledger/전이/PEP 의미는 별도 비판적으로 읽었지만 12 retained historical TIM operation이나 BASE86 전체를 인증하지 않습니다.

| 실제 수행 | 결과 | 증거 경계 |
| --- | --- | --- |
| strict Ajv 6.12.6, coercion/default/removal 모두 off | 461 compile / 556 closed object nodes / 36 fixture / 69 negative controls 일치 | 표준 transport shape만 |
| fixture SHA 독립 재계산 | owner 12 + interval 7 + artifact 4 일치 | owner authority/서명/현재 권한 아님 |
| Decimal/DST 산술 재계산 | 14 기대값 일치 | 제안된 engine/핀된 runtime tzdb 실행 아님 |
| 모든 route 정규화 | 정확히 중복 1쌍 | 실제 등록 가능한 route closure |
| write target/rule name 존재 | 4,789 target 모두 존재, duplicate source/rule missing 0 | 실제 dependency/entity/source semantics 아님 |
| 현재 canonical oracle 직접 호출 | FAIL: unsupported proposal dialect + operation graph required, 0 validated operations, readiness=false | NOT_VALIDATED, raw0/exit0를 PASS로 사용 금지 |
| sibling key 반례 | unrelated-parent 4개에서 declared FK key 일치 | in-memory key만; PostgreSQL/미래 trigger 실행 아님 |

properties/required/additionalProperties는 object의 존재·형태를 검사하는 도구입니다. business source와 state 관계를 자동 인증하지 않습니다. [JSON Schema 공식 object 설명](https://json-schema.org/understanding-json-schema/reference/object).

## P0/P1 결과

### TIM-IR-P0-001 [P0] 종료와 무효 취소의 public POST 경로가 충돌합니다

114개 method+parameter-name-normalized path 전수 검사에서 중복은 정확히 1쌍입니다. 두 operation 모두 POST /api/time/v1/leave/enrollments/{enrollmentId}/termination이며 ACTIVE→ENDED와 ACTIVE→CANCELLED, request schema와 authorizationDuty/idempotent originatingAction가 다릅니다. cancel에는 terminate의 proration/settlement rules도 복사되어 있습니다.

하나의 HTTP mapping에서 서로 다른 두 업무/PEP/receipt 계약을 exact operationId로 선택할 수 없습니다. 불필요 legacy 유지가 아니라 semantic 라우팅 충돌입니다.

정확한 JSON pointer: `/operationDeltas/63`, `/operationDeltas/110`.

최소 수정 방향:

- unused zero-effect cancel은 /cancellations 등 별도 경로로 분리하거나, exact closed discriminated oneOf 하나의 command로 통합하고 정책·state·receipt action을 같이 재설계합니다.
- 무효 취소에서 HRM termination/proration/settlement 규칙을 제거하고, actual no-effect 조건 및 현재 rowVersion을 명시합니다.

G3 종료 증거: 모든 proposed+retained TIM public route의 normalized exact uniqueness 검사와 서로 다른 cancel/terminate typed body/PEP/receipt fixture를 봉인합니다.

G4 실행 증거: unused cancellation과 actual employment termination 각각의 native state/write/replay를 실행합니다.

### TIM-IR-P0-002 [P0] entitlement run의 frozen 선택 집합과 실행 입력이 digest만으로 남습니다

run.create는 실제 enrollment IDs/revisions+HRM/config/calendar+period/mode를 freeze하라고 규정합니다. 그러나 abs_entitlement_runs에는 input_snapshot_digest/rule_snapshot_digest 및 policy FK만 있고 선택 집합·asOf·configuration/calendar reference를 담은 immutable input payload 또는 그 payload FK/public version refetch 계약이 없습니다. run FK를 가진 별도 표는 previous_run과 완료 결과 items뿐입니다. tme_owner_artifact_snapshots.content는 'entire refetched owner response'이며 run-specific frozen selector artifact가 아닙니다.

run을 QUEUED로 commit한 뒤 JVM/queue가 재시작하면 worker가 어느 enrollment/revision을 실행해야 하는지, 누락 item이 몇 개인지, finalize에서 all selected가 맞는지 재구성할 exact 자료가 없습니다. 선택 set을 caller 재전송/현재 목록/owner snapshot으로 추측하는 것은 freeze 계약 위반입니다.

정확한 JSON pointer: `/operationDeltas/65`, `/operationDeltas/71`, `/operationDeltas/72`, `/operationDeltas/74`, `/$defs/TIM.EntitlementRunCreate.v1`, `/tableSpecifications/29`, `/tableSpecifications/30`, `/tableSpecifications/7`.

최소 수정 방향:

- TIM.EntitlementInputArtifact.v1처럼 tenant/run/public identity와 canonical ordered unique enrollment items+각 원래 revision+HRM basis/config/calendar/정책 refs+asOf+period/mode를 담은 immutable closed artifact를 정의합니다.
- run이 artifact를 tenant-composite FK 또는 exact authorized owner version/refetch 계약으로 참조하고 items는 frozen selected item identity를 참조하도록 설계합니다.
- lease/execute/finalize/reconcile의 read set, source graph, selected=terminal+pending cardinality, duplicate/non-selected enrollment deny, correction previousRun을 exact하게 추가합니다.

G3 종료 증거: queue restart/no caller payload로 frozen set refetch, missing/extra/duplicate selected item, changed enrollment/current source, partial reconcile에 대한 concrete typed fixtures와 owner DTO/SPI/shared guard allocation을 준비합니다. 전체 business CRUD 실행은 요구하지 않습니다.

G4 실행 증거: 실제 crash-after-QUEUED→recovery, item atomic posting, partial/failure/cancel finalization을 실행합니다.

### TIM-IR-P0-003 [P0] employment termination의 corrective run/settlement handoff가 write/event/port에 연결되지 않습니다

terminate 규칙은 PRORATE_FINAL_PERIOD에서 linked corrective entitlement run과 exact reversal+new grant, OWNER_APPROVED_SETTLEMENT에서 typed owner handoff를 요구합니다. 실제 businessWriteSet은 enrollment status/effective_to/row_version UPDATE + enrollment decision INSERT뿐이고 transitiveWriteSet도 corrective run/settlement을 포함하지 않습니다. ownerCommandRequirements 네 계약은 SYS governance/Approval decision/TIM publication/optional document이며 termination settlement contract는 없습니다.

ENDED만 저장하고 필요한 final grant 교정/닫힌 기간 settlement가 영구 미발행될 수 있습니다. 'creates/emits'라는 텍스트를 구현자가 임의 직접 call/row/event로 채워야 합니다.

정확한 JSON pointer: `/operationDeltas/63`, `/ownerCommandRequirements`, `/tableSpecifications/23`, `/tableSpecifications/29`.

최소 수정 방향:

- 정책별 explicit branches를 STOP_FUTURE_ONLY, PRORATE_FINAL_PERIOD, OWNER_APPROVED_SETTLEMENT로 설계합니다. corrective run/input+original grant reference는 exact new write set/source/event를 추가합니다.
- remote settlement는 durable outbox intent+typed owner request/result/reconcile/fence를 정의하고, ENDED effective employment 사실과 financial settlement pending/unknown/complete 상태를 분리합니다.
- reversal/new grant 또는 closed/downstream settlement은 과거 fact mutation이나 자동 PAY 변환 없이 exact source와 SoD를 보존합니다.

G3 종료 증거: 동일 concrete termination input에 정책별 expected writes/no-writes, correction source refs, unknown/replay/closed-period deny fixture를 봉인하고 cross-module settlement DTO/SPI failclosed adapter를 배정합니다.

G4 실행 증거: actual proration correction, immutable old grant preservation, settlement outbox/unknown/reconcile를 실행합니다.

### TIM-IR-P0-004 [P0] source graph는 count-complete이지만 실제 의존성·owner 계약과 불일치합니다

첫 tim.rule.create의 requiredOwnerSources/ownerSources는 SYS.TimePolicyContextSnapshot.proposal.v1로 수정됐으나 typedSources[1]는 이전 SYS.EffectiveTimeConfigurationSnapshot.v1와 sys.owner.time-configuration.effective를 요구합니다. 이는 아직 존재하지 않는 DRAFT의 published-artifact governance를 재요구하는 구버전 graph입니다. 85 owner typed sources 모두 inputs가 tenant+actor뿐이며 body ref/selector/asOf/purpose/source revision은 의존성에 없습니다. expression은 body.content/hash 또는 owner clock을 쓰는데 clock source 212개는 ownerClock dependency가 없고 ID sources 330개는 generation metadata가 없습니다(124개는 DB internal BIGINT로 UUID generation kind와 구분 필요). 4789 target rows가 존재하고 ruleId가 있는 것만으로 실제 input closure를 증명하지 않습니다.

label/표현식 prose를 신뢰하면 준비 단계 수정이 실제 canonical graph에 반영되지 않아 첫 create 불가/잘못된 source binding/누락 dependency를 숨깁니다. 현재 oracle READINESS 호출은 UNSUPPORTED_PROPOSAL_DIALECT + OPERATION_GRAPH_REQUIRED, validated operations=0, readiness_pass=false입니다. raw0/noop PASS 위험은 현재 failclosed됐지만 actual successor graph는 아직 검증되지 않았습니다.

정확한 JSON pointer: `/operationDeltas/0/requiredOwnerSources`, `/operationFieldLineage/0/typedSources/1`, `/operationFieldLineage/0/typedSources/5`, `/operationFieldLineage/0`, `/derivationRules/3`, `/derivationRules/13`, `/derivationRules/14`, `/operationFieldLineage`, `/ownerContractDeltas`.

최소 수정 방향:

- canonical successor adapter를 별도 exact dialect contract로 승인하고 operationBindings+lineage+record/event schemas를 외부 exact operation ID set에 봉인합니다. 이름만 바꾸거나 diagnostic mode를 readiness로 승격하지 않습니다.
- 모든 expression의 실제 body/path/aggregate/clock/owner reference 및 nested array record projection을 typedSources inputs와 같은 oracle에 연결합니다.
- owner read request selector/asOf/reference/purpose, actual owner response schema/entity/idSpace를 등록합니다. context/create와 published governance/publish를 분리하고 internal DB RETURNING identity와 owner-generated UUID lifecycle를 각각 exact kind로 정의합니다.

G3 종료 증거: 114 exact operation scope의 실제 canonical source/FK/type/entity/dependency/array-item closure 및 laundering mutations를 검증합니다. owner DTO/SPI/consumer compile/shared failclosed registration이 필요하며 domain handlers 전체 구현은 G4입니다.

G4 실행 증거: actual body→persisted column→query/event 결과의 의미를 domain native tests로 확인합니다.

### TIM-IR-P0-005 [P0] shared owner/PEP/composite authority·legacy assignment contract는 실제 G3 준비 항목으로 OPEN입니다

17 owner read DTO+command contracts는 CURRENT_PUBLISHED=false/REQUIRED_NOT_ALLOCATED입니다. 114 headerContracts purpose는 모두 EXACT_OWNER_PURPOSE placeholder이며 population/field scope도 generic, 신규 authorizationDuty 대부분 PROPOSED_ATOMIC입니다. legacy tme_legacy_ledger_assignment_bindings도 exactSchemaApproval OPEN입니다. configuration hris_configuration/13-stream purpose DS+role+manifest+receipt/guard/scaffold는 NOT_ALLOCATED이고 scalar existing8/9 proof를 사용할 수 없습니다.

SELF principal≠worker, requester/approver/publisher SoD, internal workload capability, field-limited projections 및 new protected authority를 actual current shared adapter가 failclosed로 강제한다고 승인할 수 없습니다. 이 항목은 customer migration만의 G6 문제가 아닙니다.

정확한 JSON pointer: `/authority`, `/ownerContractDeltas`, `/ownerCommandRequirements`, `/timeLedgerAdditiveDelta`, `/remainingRisks`, `/operationDeltas/0/headerContract`.

최소 수정 방향:

- owner read/command SPI/DTO registry, PEP action/capability/purpose/population/field/delegation/SoD policy matrix 및 exact callable boundary를 canonical successor에 배정합니다.
- legacy row binding은 immutable tenant+original row+actual worker/assignment/date/provenance proof를 exact table/schema로 설계하고 ambiguous는 BLOCK합니다.
- 13-stream composite authority bootstrap/DS qualifiers/role ACL/seal/no scalar fallback와 common pilot runtime를 별도 actual scaffold로 구현합니다.

G3 종료 증거: actual shared generated DTO/SPI/failclosed adapters+consumer compile, zero/multi/foreign/revoked self-scope/owner-ref/SoD/field-policy denial, current common/Control/pilot runtime evidence가 필요합니다. all114 business domain CRUD는 G4입니다.

G4 실행 증거: actual owner production integrations/business programs, legacy data cutover와 country/customer authority는 각각 G4/G6으로 분리합니다.

### TIM-IR-P1-006 [P1] failed/blocked entitlement item의 저장 가능한 결과 shape와 count 계약이 부족합니다

run item은 numerator/denominator/quantity/rounding_trace/result_digest NOT NULL 및 denominator>0를 항상 요구하면서 status는 BLOCKED/FAILED도 허용합니다. zero denominator input은 N18에서 거부해야 하고 finalizer는 failed/cancelled까지 selected cardinality에 합산합니다. 계산 불가 failure를 어떤 immutable nullable typed failure result/attempt/source identity로 기록하는지, error code/lease attempt/source 및 cancelled slot proof가 exact하게 정의되지 않았습니다.

invalid input의 denominator를 가짜1로 채우거나 실패 item을 생략하면 arithmetic provenance 또는 final cardinality가 잘못됩니다. zero-denom failure row를 현 always-positive denominator 식으로 직접 저장하는 것은 불가능합니다.

정확한 JSON pointer: `/tableSpecifications/30`, `/operationDeltas/71`, `/operationDeltas/72/rules`, `/negativeCaseCatalog/17`.

최소 수정 방향:

- computed CALCULATED/POSTED result와 BLOCKED/FAILED error result를 closed discriminated union으로 분리합니다. 계산 값 없는 실패는 explicit null/unavailable reason+error/source/attempt/fence를 보관하고 positive denominator constraint는 computed branches에만 적용합니다.
- frozen selected input item과 outcome을 exact 연결하고 cancelled/unexecuted outcomes를 어느 table/state/predicate로 계산하는지 선언합니다.

G3 종료 증거: zero denominator/missing owner/cap BLOCK_POST/partial cancellation의 typed failure shape와 selected cardinality fixtures를 추가합니다.

G4 실행 증거: actual failed-item persistence/restart/finalization; zero ledger/counter/lot/balance effects를 확인합니다.

### TIM-IR-P1-007 [P1] tenant FK가 sibling parent/assignment/enrollment 결속까지 보장하지 않습니다

정확한 declared FK key만 평가한 네 반례에서 모든 FK가 일치했습니다: segment(period10, assignment201→period20), approval(period10,evaluation302→period20), ledger(enrollment402,item801→enrollment401), lot(enrollment402,grant901→enrollment401). 이는 PostgreSQL 실행/미래 trigger 전체 우회 실험이 아니라 현재 정의된 개별 key들의 관계 공백입니다. 해당 table semanticGuardRequirements는 이 parent equality를 명시하지 않습니다(ledger에는 다른 sign/reversal guard만 있음).

동일 tenant 내 unrelated source를 결속하여 다른 schedule/worker/enrollment의 결과가 부모 query/publication/ledger에 포함될 수 있습니다. tenant-safe만으로 source-safe/population-safe가 아닙니다.

정확한 JSON pointer: `/tableSpecifications/12/foreignKeys`, `/tableSpecifications/16/foreignKeys`, `/tableSpecifications/31/foreignKeys`, `/tableSpecifications/33/foreignKeys`.

최소 수정 방향:

- tenant+parent+child ID composite UK/FK 또는 exact same-owner constraint/immutable source guard로 period-assignment-evaluation-publication 및 enrollment-runItem-entry-lot closure를 보장합니다.
- 모든 관련 FK의 sibling equality oracle를 전수 선언하고 selector→child resolution→query source를 PEP population에 함께 묶습니다.

G3 종료 증거: 네 concrete wrong-parent fixtures와 positive counterpart의 expected reject/accept를 봉인하고 constructor/shared bind guard allocation을 준비합니다.

G4 실행 증거: actual PG FK/trigger/owner-transaction negatives로 wrong-parent row/query/publication/ledger를 거부함을 실행합니다.

### TIM-IR-P1-008 [P1] planned CREATE bundle의 순환 FK와 SQL token 오류를 해결하는 materialization plan이 없습니다

43 fragment 전수 검사에서 list-order forward target reference19개, direct reciprocal CREATE cycles3개(period↔evaluation,period↔publication,leaveRequest↔approvalBinding)입니다. table0 CREATE가 아직 없는 snapshots/reports를 inline FK로 참조합니다. DEFERRABLE은 DML 검사 시점이고 referenced table 존재의 대체가 아닙니다. table12 CHECK 두 곳은 AND50400 token으로 공백이 없어 SQL keyword AND와 정수50400이 아닙니다. SQL을 실제 PG에서 실행한 결과로 과장하지 않습니다.

그대로 CONCAT하거나 단순 topological sort로 initial native DDL을 만들 수 없습니다. 'explicit CREATE SQL'을 실행 가능한 통합 instruction으로 취급하면 실패합니다.

정확한 JSON pointer: `/tableSpecifications/0/plannedCreateSql`, `/tableSpecifications/9/plannedCreateSql`, `/tableSpecifications/12/plannedCreateSql`, `/tableSpecifications/25/plannedCreateSql`, `/migrationPlan`.

최소 수정 방향:

- two-phase all tables+PK/UK → ordered ALTER FK/exclusions/triggers/RLS/ACL 또는 정확 reviewed migration step graph를 정의합니다. 모든 referenced UK/type/order를 검사합니다.
- AND 50400로 token을 고치고 planned complete migration bytes/SQL parser check/test allocation을 successor에 봉인합니다. historical migration 수정/validator count 완화는 금지합니다.

G3 종료 증거: G3는 exact planned migration dependency/token/constraint allocation 검증입니다. shared empty-stream/bootstrap 실제 scaffold는 G3, 모든 business DDL 실행은 G4입니다.

G4 실행 증거: complete business migration batch의 fresh/upgrade PG16/18 execution을 검증합니다.

### TIM-IR-P1-009 [P1] event state와 receipt result의 조건부 의미가 표준 schema에 봉인되지 않습니다

81 event 모두 stateBefore/stateAfter가 free string|null입니다. actual Ajv는 resultRecord.status=DRAFT인데 stateAfter=CLOSED_WRONG_STATE/stateBefore=UNKNOWN_UNDECLARED_STATE인 rule.create event를 ACCEPTED했습니다. RUNNING receipt+nonnull registered result도 schema ACCEPTED했습니다. 이것은 result field가 언제 durable aggregate identity이고 언제 success artifact인지 구별하는 조건부 계약이 없음의 증거이며, QUEUED run UUID의 합법적 반환 자체를 금지하자는 뜻이 아닙니다.

schema-valid private event가 실제 machine 상태와 충돌하거나 pending outcome을 success result처럼 소비할 수 있습니다. private delivery/producer가 실제 state를 복사한다는 구현 guard는 아직 제안/미실행입니다.

정확한 JSON pointer: `/eventSchemas`, `/$defs/TIM.Event.tim.rule.create.Committed.v1`, `/$defs/TIM.CommandReceipt.tim.leave.entitlement.run.v1`, `/stateMachines`.

최소 수정 방향:

- state-bearing event는 per-operation actual from/outcome enum과 persisted aggregate state/revision/resultRecord equality를 봉인합니다. state가 없는 command만 명시적 null/no-state shape를 사용합니다.
- receipt status/result/error 조합을 conditional로 정의하고 durable created aggregate ref와 final result artifact를 분리합니다. unknown/rejected/failed에서 fake success artifact 반환을 금지합니다.

G3 종료 증거: wrong state/result status/revision, pending/no final artifact, opaque cross-tenant receipt/read field projections의 standard-schema/shared constructor negative tests를 준비합니다.

G4 실행 증거: actual atomic event/receipt projection이 persisted state/write result와 일치함을 실행합니다.

### TIM-IR-P1-010 [P1] closed transport가 basic time/partial-leave semantic bounds를 아직 허용합니다

actual Ajv는 localPeriodBoundaryTime=99:99:99, workedQuantityBasis.value=0, HOUR quantity+localDate만 있는 no-interval partial leave를 ACCEPTED했습니다. N18/N29와 registry는 이를 계산/승인 단계에서 거부하려 하지만 actual shared semantic adapter는 OPEN입니다. Quantity aliases -0/-0.000000/1.500000도 ACCEPTED합니다. fixed-scale synthetic expected 1.500000을 자동 금지하지 않으며 canonical wire/hash normalization 의도를 먼저 확정해야 합니다.

schema compile/extra-property negatives만으로 계산/시간 semantic safety가 보장되지 않습니다. 같은 숫자의 여러 lexical form은 replay digest/protocol과 정렬해야 합니다.

정확한 JSON pointer: `/$defs/TIM.AccrualMonthly.v1`, `/$defs/TIM.AccrualYearly.v1`, `/$defs/TIM.AccrualAnniversary.v1`, `/$defs/TIM.AccrualPerWorkedUnit.v1`, `/$defs/TIM.LeaveSegment.v1`, `/$defs/TIM.Quantity.v1`, `/ruleRegistry`.

최소 수정 방향:

- local time lexical bounds를 HH[00..23]:mm[00..59]:ss[00..59]와 exact pinned zone/calendar parsing에 연결합니다.
- HOUR/MINUTE leave는 interval-required oneOf/conditional, worked basis positive same-unit validation을 명시합니다. AST key uniqueness/type/arity/DAG/rounding stage/overflow는 exact shared validator allocation을 유지합니다.
- quantity decimal canonicalization/fixed-scale display와 request hash normalization을 구분하여 XCON QuantityDecimal codec과 일관된 계약을 선택합니다.

G3 종료 증거: 이 concrete accepted witnesses를 intended reject 또는 documented normalization 결과로 전환하는 standard-schema/shared guard fixture가 필요합니다. 실제 leave/accrual engine 모든 구현은 G4입니다.

G4 실행 증거: pinned runtime tzdb, gap/fold/local-boundary, actual DAY calendar conversion, exact Decimal calculation을 실행합니다.

### TIM-IR-P1-011 [P1] negative/경계/교정 acceptance 정의가 대부분 문자열 설명이고 exact executable fixture가 아닙니다

2 configurations의36 instances는 24 request bodies+12 owner doubles이며 unique operations는11/114입니다. A/B math/source digest는 재현되지만30 negative의 input은 전부 문자열 설명(typed object0개)입니다. shift/pattern lifecycle, run recovery/partial/cancel/failure, termination corrective writes, amendment/publication/SoD와 exact owner failure에 대해 concrete request+owner/state/clock/write/no-write expected fixture가 완성됐다고 인증할 수 없습니다.

개수/예상 한 문장만 보고5-session 전체 구현이 동일 semantics로 진행한다고 승인할 수 없습니다. author planned test classes114개는 실제 input→expected domain evidence가 아닙니다.

정확한 JSON pointer: `/configurationFixtures`, `/negativeCaseCatalog`, `/testAllocation`, `/procedureContracts`.

최소 수정 방향:

- 현재 좋은 A/B baseline은 유지하고 모든 machine transition/branch/source/denied/replay/correction path를 concrete typed request+owner seed+clock+before facts+expected after/write/no-write/durable identity로 정의합니다.
- 부족한 owner authority/legacy binding/heterogeneous WFM source는 fixture prerequisite OPEN으로 표시하고 generic placeholder를 fake accepted evidence로 만들지 않습니다.

G3 종료 증거: G3는 exact fixture/test allocation+실제 shared schema/DTO/guard mock tests입니다. all114 native CRUD 또는 every golden journey actual execution을 G3 circular prerequisite로 요구하지 않습니다.

G4 실행 증거: G4에서 실제 database/native domain journeys와 failure/replay/concurrency cases를 실행합니다.

SQL FK는 참조 key 및 검사 시점이 별도입니다. `DEFERRABLE`로 참조 대상 table 미생성을 해결하지 않으며, circular CREATE는 reviewed two-phase graph가 필요합니다. [PostgreSQL 18 CREATE TABLE](https://www.postgresql.org/docs/18/sql-createtable.html).

## 위험을 과장하지 않는 구분

일반 AST는 schema에서 array symbol key uniqueness/타입/DAG 전체를 증명하지 못하므로 별도 bounded owner validator가 필요한 것이 정상입니다. proposal의 graph budget/정확한15 operator signature/owner-input failure/rounding/불변 source 규칙은 역사적 free-form rule string보다 좋은 방향입니다. 다만 현재 실제 shared interpreter/typed source adapter 등록/compile 증거가 없으므로 이 ruleRegistry 자체를 실행 PASS로 세지 않습니다.

APPROVED schedule 취소는 명시된 dispatched-request guard에 의해 CANCEL_PENDING, cancellation reconcile는 exact known matching owner result + local unpublished/no irreversible effect를 요구합니다. unknown→CANCELLED를 허용한다고 새로 단정하지 않습니다. 그러나 cancellation source graph의 실제 request/refetch/effect binding/PEP 및 concrete native race fixture는 아직 OPEN입니다. owner decision history를 CANCELLED로 rewrite하지 않는 설계 원칙은 유지되어야 합니다.

RUNNING receipt에 생성된 QUEUED run identity를 반환하는 것이 항상 잘못인 것은 아닙니다. durable aggregate 식별자와 완료 결과 artifact를 분리해 정확한 상태별 field contract를 정의해야 한다는 지적입니다. fixed-scale fixture `1.500000`도 회사 출력 표현과 wire canonicalization을 구분한 뒤 판단해야 하며 arbitrary 규칙으로 원본을 자동 정규화하지 않았습니다.

TIM-owned native arrangement/availability intersection, 별도 PER skills, native manual schedule, immutable published correction successor, append-only leave accounting/별도 reservation, 정확한 LOCKED card vs CLOSED close-period 및 verified self-context 설계는 범용·확장 HRIS 방향에 부합합니다. optional connector를 강제하거나 legacy 개수에 맞춰 기능을 유지할 필요가 없습니다.

## G3/G4/G6 및 미인증 범위

- G3: 정확히 승인된 planned schema/API/SQL/read-write/state/source/event/typed fixtures/test allocation, 실제 shared DTO/SPI/failclosed guards/adapters 및 producer/consumer compile, 13-stream composite authority/common/pilot runtime. 부족한 구조를 G4라 부르며 넘길 수 없지만 all114 domain CRUD/journey 실행을 G3 순환 선행조건으로 요구하지 않습니다.
- G4: 실제 business migrations/DDL/CRUD, leave/time engine·원장·full native acceptance 실행.
- G6: 고객 identity/authority/country/provider/adoption·production credential/process-isolation 승인.
- 12 historical TIM operation(시계/해석/close/handoff/export/widget/receipt 등의 bounded 외부 영역), full BASE86 의미 복원, 다른 root WFM successor 승인, actual SQL/native/crypto/PEP/runtime tzdb 및 고객 데이터는 UNVERIFIED입니다.

최종 판정은 `INDEPENDENT_FINDINGS_REPORTED_NOT_APPROVED`, `G3 CLOSED`입니다. 작성자 검사를 대체하는 자기 PASS나 canonical Gate 승인을 선언하지 않습니다.
