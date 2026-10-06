# TIM BASE 후속안 독립 검토

2026-09-14. 상태: INDEPENDENT BOUNDED REVIEW COMPLETED / NOT READY / G3 CLOSED / COMMON P0 OPEN.

작성자와 독립적으로 고정본을 재현했습니다. 37개 단위 검사는 통과하고 작성자 한정 정상 명령은 종료 0입니다. 그러나 실제 source 정본 검증은 FAIL이며, 정상 명령도 readinessPass=false입니다. 이 결과는 전체 116개 기능·테이블·업무 상태·권한·native 구현의 준비 완료나 승인 증거가 아닙니다.

이 검토는 본인이 작성한 identity ABI를 독립 승인하지 않습니다. TIM 작성자 후속 원본을 수정하지 않았고, 이 보고서 JSON/MD 두 파일만 추가합니다.

## 고정본과 입력 보존

작성자 FROZEN 통지 후 아래 바이트에서 실행했습니다.

| 파일 | SHA-256 |
|---|---|
| 후속 JSON | 04a4785e199b9babc92ae71c0a35df282194bb97adccc7eb31579a602d2cc448 |
| 후속 MD | 8289dea17e2d593882973768ea999374ef85f62d52f3cca485091b5a3274c600 |
| validator, 602행 | 76d2c5b45098062def03ceaa3ad71dfa271a9160cdfc8deebc5d688f87dbc3e4 |
| author tests | 3c000aafa4f6b3d8d6f85cceb0f611ea0f2473d4fd395588262bd54435cfd218 |

원본 TIM JSON5fbb5b/MD32fa65, 기존 독립 JSON7cc282/MD9840eb은 보존했습니다. 실행 전후 후속4+역사4+정본 검증기1의 SHA와 mtimeNs가 같습니다. 추가 반례 완료 후 후속4+역사4 및 정본 검증기를 다시 대조했습니다. ns는 Python 정수에서 얻은 decimal string으로 저장하여 JS unsafe integer 반올림을 거치지 않았습니다. 고정 전 읽은 draft2d8177/60362→ce3e48/87fcc는 별도 기록이며 최종 실행 증거가 아닙니다.

새2 operation ID는 작성자 검증기의 local static allowlist입니다. “approved new2” 문자열은 정본·root·G3 승인이 아닙니다.

## 실제 독립 재현

작업 디렉터리는 /Users/a10697/Work/DWP입니다. JSON execution.runs에 정확한 argv, 시작/종료 UTC, duration, 출력 SHA, 모든 37 case ID를 기록했습니다.

```sh
python3 -B -m unittest discover -s output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation -p test_tim_base_review_remediation.py -v
python3 -B output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_tim_base_review_remediation.py --compact
python3 -B output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_tim_base_review_remediation.py --compact --require-g3
```

| 실행 | duration | 결과 |
|---|---:|---|
| author unit 독립 재현 | 8.483253s | 37/37 PASS, 실패0·오류0·skip0, exit0 |
| normal author-only CLI | 1.983456s | exit0, structural errors0, readinessfalse/G3CLOSED |
| G3 요구 CLI | 1.851292s | exit1, readinessfalse/G3CLOSED |

Ajv6.12.6에서 481 defs compile, closed object schema nodes576, typed cases12, negative/compatibility controls34, 실패0을 재현했습니다. immutable input fingerprint10, decimal2 configurations도 작성자 한정 검사입니다.

정본 semantic oracle는 UNSUPPORTED_PROPOSAL_DIALECT와 OPERATION_GRAPH_REQUIRED, FAIL2를 반환합니다. counts는 빈 객체이며 실제 operation 검증0을 PASS로 해석하지 않았습니다. holder $defs를 사용하는 Draft7-compatible business keyword subset 검사이지 declared2020-12 전체 envelope 인증이 아닙니다.

계산한 116 operations/47 tables/642 columns/83 events는 inventory입니다. source4는 상세 설계이고 하위 leaf/assembler target은 OPEN입니다. 다른112 source IDs가 명시적으로 OPEN이며 닫힌 실제 source design은 이 검토에서 입증0입니다. 24 invariant definitions는 native/domain 실행0입니다. 전체 state-machine reachability·116 operation별 PEP/fixture·G4 업무 실행은 NOT_VALIDATED입니다.

## 반례 실행 결과

FROZEN JSON에 메모리 patch suffix 또는 metadata 변경을 넣고 /dev/stdin으로 공급했습니다. loader+structural helper, full CLI, standalone helper를 분리했습니다. JSON에 16 structural cases, 8 helper cases, 추가11 pin/patch/context cases, full CLI4건 및 실제 date shape6건의 결과와 입력을 기록했습니다.

거부된 반례는 다음과 같습니다.

- 잘못된 contractId, top-level executable dialect 혼합.
- 원본 ID+OPEN complement를 함께 phantom ID로 변경.
- 잘못된 node.type, 다른 정상 node로 column binding 변경, 잘못된 query projection source.
- 중복 fixture/probe ID, FK local/target arity 불일치.
- pin 누락·잘못된 expected SHA·blueprint 밖 path.
- empty patch·test-only no-op·실패한 test·prototype member path·invalid escape·leading-zero array index.
- duplicate JSON·NaN·numeric overflow·bool-number test 혼동·fractional rounding/underflow token.

정상 최소 structural witness는 수용됐습니다. 정상 query에 임의 business write를 강제하지 않았습니다. prototype 이름 거부 및 지원4 op/closed field는 enterprise subset 정책이며 RFC의 forbidden-name 규칙이라고 주장하지 않습니다. JSON test의 타입·숫자 비교 기준은 [RFC6902 §4.6](https://www.rfc-editor.org/rfc/rfc6902.html), escaped pointer/array 표기는 [RFC6901](https://www.rfc-editor.org/rfc/rfc6901.html)에 근거합니다. 작성자 integer-only 숫자 정책은 범용 fractional JSON Patch보다 좁은 정책입니다.

다음은 errors0으로 남았습니다. 동일한 입력을 전체 CLI에 넣은 대표4건도 exit0/shape failures0이었으나 readinessfalse/canonicalFAIL2는 그대로입니다. 이 안전 경계를 무시하여 G3 bypass라고 주장하지 않습니다.

## 남은 지적과 검사 한계

| ID | 범위 | 실제 반례·필요 후속 |
|---|---|---|
| F01 P0 계속 | field leaf/business UUID 출처 | /operationFieldLineage/0/typedSources/2의 public_id 입력을 X-Correlation-ID로 바꾸거나 sourceLeaves/11의 actual column을 nonexistent_column으로 바꿔도 수용. 실제 owner schema/column/entity/ID-space oracle 및 assembler/typed projection 필요. source4가 닫혔다는 증거가 아님 |
| F02 P1 | SQL 대응과 parent 의미 | plannedCreateSql와 phase1 SQL 양쪽을 SELECT1로 맞추면 수용. segment의 period+assignment FK를 abs selected tuple로 바꾸고 ALTER SQL을 맞추면 수용. correspondence/arity/UK 존재는 SQL 내용·의도한 parent 증거가 아님 |
| F03 P1 | duplicate record scope | 같은 table record 추가가 dict로 가려져 plannedTables47을 유지. 같은 lineage operation record 추가는 next(first)로 가려짐. array unique IDs+exact graph coverage/cardinality 필요 |
| F04 P1 | 존재하지 않는 civil date | 실제 EntitlementInputDocument.periodStart=2026-02-30, capturedAt=2026-02-30T00:00:00Z를 Ajv default fast가 수용. full은 둘 다 거부, healthy는 둘 다 통과. strict profile/constructor와 calendar-date regressions 필요 |
| F05 P1 | envelope version type | schemaVersion=true가 ==1로 수용되고 full CLI도 exit0. fieldGraphDialect=CANONICAL_READY는 informational label로 검사하지 않음. exact version type excluding bool와 authoritative envelope type 정의 필요 |
| L01 이미 OPEN | standalone helper composition | leaseVersion999 outcome을 finalize helper에만 넣으면 SUCCEEDED; synthetic event aggregateRevision0도 state string이 맞으면 수용. 현재 lease/revision을 API가 받지 않아 native atomicity 증거가 될 수 없음 |

F02의 실제 sibling 반례는 /tableSpecifications/12/foreignKeys/1을 tenant+schedule_period_id+schedule_assignment_id → abs_entitlement_selected_items(tenant+input_version_id+selected_item_id)로 바꾼 것입니다. 실제 column 수·BIGINT type·UK는 맞아도 의도한 schedule assignment parent가 아닙니다. /twoPhaseDdlPlan/phase2ForeignKeys/27 SQL도 같이 맞췄습니다. root-origin 기존13 cross-context FK P0와 새로운 mirror 경계는 여전히 OPEN이며 정본 SQL을 발행하면 안 됩니다.

F04는 root 요청에 따른 실제 declared schema shape 반례입니다. DST/tzdb/현지 work date/actual calendar/분모/시간 ledger engine 전체 검증으로 확대하지 않습니다. date payload 변경은 합성 복제에만 적용했고 domain/native SQL을 실행하지 않았습니다.

L01은 작성자 MD가 요구하는 same-owner transaction writer fence와 static event entity registry의 미구현 경계입니다. separate writer_fence_guard의 stale/expiry/owner/cancel negatives는 통과했습니다. standalone helper 수용을 실제 owner 우회로 단정하지 않고, 등록된 source/revision/lease/CAS/PEP/receipt/outbox constructor가 반드시 합성되어야 한다는 OPEN 증거로 구분합니다.

materialized draft에 operationBindings=[]를 추가해도 author structural은 수용합니다. top-level proposal envelope의 동일 key는 거부됩니다. 이는 author-local mixed-draft admission 한계이고 실제 canonical oracle는 계속 FAIL입니다.

검증기 근거 위치는 [schema identity guard](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_tim_base_review_remediation.py:324), [table collapse](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_tim_base_review_remediation.py:352), [sibling tuples](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_tim_base_review_remediation.py:357), [SQL correspondence](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_tim_base_review_remediation.py:374), [source leaf/derived checks](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_tim_base_review_remediation.py:400), [Ajv options](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_tim_base_review_remediation.py:479)입니다.

## 기존 11개 지적의 상태

| 기존 지적 | 독립 후속 판단 |
|---|---|
| P0-001 | 취소 route·복사 rules 설계 개선과 static negatives 확인. actual HTTP/domain 인증 아님 |
| P0-002 | frozen full payload/selected/refetch 구조 개선. actual source assembler/registry OPEN |
| P0-003 | termination workflow/corrective run/settlement/reconcile 구조 개선. HRM/PAY owner DTO/SPI/PEP/정본 source OPEN |
| P0-004 | source4 하위+112 전체 미닫힘. canonicalFAIL2, F01 구체 출처 한계 확인 |
| P0-005 | shared owner/권한/13-stream/native proof 미닫힘. 본인 ABI를 여기서 독립 승인하지 않음 |
| P1-006 | computed/error/cancel union·positive denominator·nonnegative/zero-effect 설계와 units 개선. atomic SQL constructor OPEN |
| P1-007 | sibling UK/FK 선언 개선. 실제 parent/context 의미는 F02처럼 미검증 |
| P1-008 | two-phase/typo 개선. physical SQL/context/immutability/exclusion/ACL programs OPEN |
| P1-009 | event/receipt closed state·same/different entity 구분 개선. actual registered producer/revision source OPEN |
| P1-010 | time/interval/decimal shape 개선. F04 date 및 DST/calendar/AST/accrual 미검증 |
| P1-011 | typed invariant24/schema12/unit37이 있으나 전체116 native happy/denied/duplicate/correction acceptance 아님 |

## 준비 Gate와 다음 작업

G3에는 전체 exact successor의 source/state/read-write/SQL/fixture/test allocation과 실제 공유 DTO/SPI/fail-closed adapter/PEP/authority/consumer compile/current common pilot의 독립 검증이 필요합니다. source4+112·owner·13 context FK·legacy assignment binding·WFM alias가 남아 있습니다.

G4에는 domain business migration/CRUD/AST/accrual/DST/atomic ledger 및 실제 업무 acceptance를 구현합니다. G3를 위해 먼저 전체116 domain CRUD를 완성하라는 순환 준비 조건으로 만들지 않습니다. G6는 실제 회사·국가·provider·배포/운영 authority입니다.

이 고정본을 재수정하여 독립 리뷰를 무한 반복하지 않습니다. 후속 correction은 별도 successor로 고정하고 필요한 범위를 독립 검증해야 합니다. 최종 판단은 NOT READY / G3 CLOSED / COMMON P0 OPEN입니다.

## 실행 및 보존 한계

PG/무거운 build/사용자 DB·서버/production credentials를 사용하지 않았습니다. BE/FE·원본·작성자4파일·SQL·Control·정본 validator·Gate·봉인·commit은 수정하지 않았습니다. 처음 추가반례 stdout이 큰 copied graph/table을 포함하여 도구 출력이 잘려 그 capture로 결론을 내리지 않았습니다. 같은 입력/검증을 다시 실행하되 출력만 해당 값의 SHA와 reconstruct reference로 요약하여 정확히 저장했습니다. 검사 실패를 숨기거나 무력화하지 않았습니다.

[상세 JSON 증거](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/tim-base-remediation-independent-followup-2026-09-14.json)에 argv/duration/test IDs·pre/post SHA/ns·모든 bounded 반례·판정 범위·재현 하네스를 저장했습니다.
