# TIM BASE 독립 지적 후속 설계 — 작성자 제안 v1

2026-09-14. 상태: DESIGN_PROPOSED, CURRENT_PUBLISHED=false, G3 CLOSED, independentPass=false.

이 문서는 11개 독립 지적에 대한 **작성자 후속 제안**이다. 기존 독립 감사의 승인이나 전체 TIM 114개 의미 무결성 인증이 아니다. Root/Mendel의 별도 재감사가 필요하다. 원본·역사적 계약·정본 Gate·BE/FE·DB는 수정하지 않았다.

## 입력과 적용 방식

| 보존 입력 | SHA-256 |
|---|---|
| tim-base-exact.proposal.v1.json | 5fbb5b1ae3fd92795939e4ecea85877035fae85cf1c32189db22e91037cc3933 |
| tim-base-exact.proposal.v1.md | 32fa6514408faf690de707ca7c585fb957df8b3cfc1145b035f87a3079d5ddbb |
| reports/tim-base-proposal-independent-review-2026-09-14.json | 7cc282ca4e116524cace6576e2b29b08f9c5c21ffd38f55b942f175abf8dcda5 |
| reports/tim-base-proposal-independent-review-2026-09-14.md | 9840eb1082d3db4afc8657dd07e4133c4aabc68b7f41238730ef64e5d52e174e |

신규 JSON의 `originalPins`가 위 네 파일을 고정한다. `patch`는 430개 RFC6902 test/add/replace/remove 델타다. 10MB 원본을 복제한 successor 파일은 만들지 않는다. materializer는 원본을 읽어 deep-copy 후 **메모리에서만** 적용한다. SQL 문자열도 설계 데이터이며 실행·파일 출력하지 않는다.

변경 후 계산한 범위는 116 operations(기존114+owner용2), public86/owner30, tables47, id 포함 columns642, schemas481, event declarations83다. 이 개수는 구현·수용·승인 증거가 아니다. 원본의 `counts`·`authorValidation`은 역사적 작성자 기록이며 revised draft의 검사 결과로 재사용하지 않는다.

## 11개 지적별 제안과 미해결 경계

| 독립 지적 | 후속 설계 | 작성자 경계 |
|---|---|---|
| 001 route·복사된 종료 rules | op110 `/cancellations`; 미시작·무효과·현재 CAS만 취소, 종료/정산 branch 생성 금지 | 116 transport+method+normalizedPath 중복 검사. 실제 HTTP/G4 실행 아님 |
| 002 frozen run 입력 부재 | `TIM.EntitlementInputDocument.v2`, `TIM.SelectedEntitlementItem.v2`, 입력/selected 로컬 테이블, owner refetch query | 실제 typed assembler/source registry OPEN |
| 003 종료 정책 실제 쓰기 부재 | ENDED 사실 기록과 별도 termination workflow; corrective run/settlement intent/outbox/owner receipt uncertainty | 신규 HRM termination/PAY settlement DTO/SPI·PEP OPEN |
| 004 generic source derivation | 아래 4개 graph에 body selector/loaded row/owner ref/clock/CAS/allocator/RETURNING 명시 | source4는 상세 제안, CLOSED 아님. 다른112 exact IDs OPEN |
| 005 shared 권한·owner 미게시 | CURRENT_PUBLISHED=false 및 unavailable DENY 유지 | 17+신규 owner·PEP·13-stream actual bootstrap/scaffold OPEN |
| 006 오류 결과 저장 양수 강제 | computed/error/cancelled closed union; 오류/취소 numerics null, computed denominator>0, no fake effect | 실제 constructor/SQL executor의 동일 조건 구현 OPEN |
| 007 sibling parent FK | period+assignment, period+evaluation, enrollment+run item, enrollment+grant source UK/FK | 논리 tuple/UK 검사는 ownership 정책 승인 아님 |
| 008 DDL forward/cycle·AND50400 | 전체 CREATE/PK/UK/CHECK 먼저, 106 FK ALTER 다음, RLS 다음; reciprocal deferred 의도 | PostgreSQL 실행/전체 SQL parser/immutability/exclusion/ACL programs OPEN |
| 009 event·receipt | closed state enum + actual persisted CAS equality; pending receipt result null; aggregate/result 종류 분리 | 실제 static event registry/atomic constructor/adapter OPEN |
| 010 시간·부분 휴가·decimal | 시각 00..23:00..59:00..59, HOUR/MINUTE instant interval 요구, XCON 호환 QuantityDecimal | DST/rule/accrual native engine 및 source oracle OPEN |
| 011 concrete acceptance | 2 synthetic configs, 24 invariant 정의, 12 typed schema cases, tamper units | 전체114 happy/denied/duplicate/correction acceptance 실제 실행 아님 |

## Run 입력·결과·재시작 계약

`abs_entitlement_runs.input_version_id`는 실제 `abs_entitlement_input_versions` FK다. 입력은 실행 asOf/기간/mode/정책 버전과 **전체 typed policyContent**, selected count/digest와 **전체 selectedItems**를 저장한다. selected row마다 별도 public ID, ordinal, enrollment ID/revision, worker/assignment identity, HRM/calendar/config refs, ledger/reservation revision, unit, correction source가 있다. owner API는 실행에 필요한 원본 typed bytes를 실제 FK에서 재조회한다. digest만으로 현재 enrollment 목록을 재구성하지 않는다.

입력 선택은 canonical lowercase enrollment public UUID 오름차순, unique enrollment/selected ID, ordinal1..N이다. 입력/selected 부모·count·hash와 actual run FK/child payload equality를 검증한다. 수정·회복은 기존 성공 슬롯을 지우거나 초기화하지 않는다. public run은 correctionMode=NONE이며 correction은 실제 원 grant/run을 검증한 owner 경로만 생성한다.

`TIM.EntitlementOutcome.v2`는 세 closed branch다.

- CALCULATED/POSTED: 실제 numerator/strict-positive denominator/quantity/unit/suppressed amount/rounding trace. DRY_RUN은 CALCULATED와 ledger0, POST는 POSTED만 가능하다.
- BLOCKED/FAILED: exact error/stage/source/time. 계산값을 0/1로 위조하여 쓰지 않는다. ledger/counter/lot/balance 변경0.
- CANCELLED: selected identity/input hash/cancel fence/time/reason만. 금액·계산값·성공 증거 없음.

POSTED quantity=canonical0이면 ledger0인 알려진 zero-effect terminal이다. 양수 새 GRANT는 실제 신규 ledger ID가 필요하다. 음수 correction REVERSE는 원 grant에 결속된 별도 ledger effect이며 새 grant 값을 음수로 표현하지 않는다. scalar SQL projection과 outcome payload/status는 동일해야 한다.

finalize는 selected N과 exact terminal N, unique key·input·mode·unit을 검사한다. 누락/중복/비선택 결과는 SUCCEEDED가 될 수 없다. 성공+오류 PARTIAL, 오류만 FAILED, cancel 요청이 보존되면 CANCELLED/CANCELLED_PARTIAL이다. prospective writer는 current owner/lease/version/expiry/cancel fence를 **효과 commit 바로 전 같은 owner transaction**에서 재검증해야 한다. readonly helper 검사는 atomic DB 구현 증거가 아니다.

expired RUNNING을 UNKNOWN으로 옮기는 경로는 expired lease와 exact observed fence를 요구하고 fence를 증가시킨다. unexpired lease를 요구하지 않는다. UNKNOWN에서 재시도는 모든 기존 terminal을 보존하고, missing slot의 authoritative no-effect proof·old lease 부재·취소 부재·버전 고정 retry budget이 있을 때 missing selected만 QUEUED로 재개한다. NOT_FOUND만으로 zero effect를 추정하지 않는다.

## 종료·정산·알려지지 않은 결과

HRM assignment.effectiveTo를 employment termination으로 복사하지 않는다. 신규 미게시 `HRM.EmploymentTerminationSnapshot.v2`는 employmentEndedOn을 **마지막 재직 현지 날짜, inclusive**로 정의하고 worker/employment/assignment의 실제 membership/revision/hash/asOf를 제공해야 한다. TIM enrollment half-open effective_to는 그 다음 civil day다. 이는 아직 HRM이 합의·게시한 source가 아니다.

동일 enrollment owner lock/CAS에서 실제 immutable policy를 읽고 다음 branch를 결정한다.

- STOP_FUTURE_ONLY: enrollment ENDED + workflow STOPPED, 추가 run/settlement0.
- PRORATE_FINAL_PERIOD: ENDED + workflow CORRECTION_QUEUED + 새 run/input/selected. 원 grant/run과 전체 original source를 보존하고 원 grant를 UPDATE하지 않는다. 원 REVERSE+재계산 GRANT는 fenced item transaction이다.
- OWNER_APPROVED_SETTLEMENT: ENDED + SETTLEMENT_PENDING + sealed typed intent + 같은 transaction outbox. command request/ref/digest/revision/ledger summary를 PAY owner SPI에 결속한다.

예: start10/17, 마지막 재직10/24는 half-open end10/25, eligible8/31일이다. A2시간은0.516129, B4시간은1.032258(6자리 HALF_UP). 원15일 grant와 원 applied timestamp는 보존한다. closed/소비된/downstream 효과가 있으면 임의 reversal이 아니라 승인된 settlement 권한/정책 또는409가 필요하다.

새 internal reconcile은 원 workflow/requestKey/command hash를 refetch한다. callback·caller가 제공한 status를 권한으로 신뢰하지 않는다. PAY RESULT_UNKNOWN/unavailable은 workflow RESULT_UNKNOWN, finalSettlementPublicId=null이며 새 지급을 만들지 않는다. 실 owner SUCCEEDED+original command binding+final artifact가 있을 때만 financial COMPLETED다. receipt/outbox와 actual CAS writes는 같은 owner transaction이어야 한다.

## Event와 command receipt

stateBefore는 actual owner CAS-load, stateAfter는 actual returned aggregate status다. 같은 aggregate/result entity일 때만 resultRecord.status equality를 요구한다. execute-item은 run RUNNING이 유지되면서 result item은 POSTED/CALCULATED/BLOCKED/FAILED가 될 수 있다. 서로 다른 entity의 status를 억지로 같게 만들지 않는다. static owner event registry가 entity 관계를 결정하며 caller의 sameEntity 토글로 우회할 수 없다.

ACCEPTED/RUNNING/RESULT_UNKNOWN receipt의 resultPublicId/resultEntityType은 null이다. aggregatePublicId는 이미 알려진 durable pending aggregate ID일 수 있다. run CREATE command가 durable QUEUED run 생성을 완료한 SUCCEEDED인 것은 computation SUCCEEDED/final business artifact 발행과 다르다. 실제 등록된 result kind와 persisted record state를 함께 해석해야 한다. 실제 common adapter/constructor 구현은 OPEN이다.

## Source4와 exact OPEN

상세 graph는 `tim.rule.create`, `tim.leave.entitlement.run`, `tim.leave.enrollment.cancel`, `tim.leave.entitlement.input.get`이다. actor+tenant+ruleId만으로 business 값을 생성하지 않는다. 실제 body selector/ref/asOf, exact loaded row 및 lock, immutable owner source, ownerClock, If-Match/CAS, secure public allocator, DB generated BIGINT RETURNING, same-transaction receipt/event causal projection을 명시한다.

그러나 이 네 graph의 선언된 sourceLeaves/표현식은 실제 source oracle 증거가 아니다. JSON `sourceRepairScope.unfixedSubtargetsWithinDetailed`는 full input/selected/owner payload, unsigned-input/hash assembler, canonical request/event constructor, owner-private query registration 등 exact 미검증 하위 target을 별도로 고정한다. `sourceActualCanonicalPass=false`, `boundedDetailedDoesNotMeanClosed=true`다.

다른 **112 operation ID 전체**는 `sourceRepairScope.unfixedExactOperationIds`가 열거한다. 원본 immutable114 ID + 승인된 새2 ID와 비교하며 draft ID와 OPEN 목록을 동시에 바꿔 새로운 phantom ID를 허용하지 않는다. source4를 포함하여 실제 typed source registry/canonical adapter/DTO compile 전 source closure 승인은 없다.

## 추가 root-origin P0: bounded context FK

정본 `physical-owner-prefix-register.csv` PFX-TIM-ABSENCE는 SAME_SERVICE_TYPED_PORT_NO_CROSS_CONTEXT_FK다. 같은 dwp-time-server/JVM이어도 ABSENCE와 TIME은 같은 bounded context가 아니다.

기존13 exact pointer는 JSON `additionalFindingSources[0].originalPointers`다: tables3 FK0/1/2,24 FK1/2,26 FK1/2,27 FK1/2,30 FK2/3,34 FK2,39 FK3. abs plan/decision/leave segment/approval/run item/lot가 tme artifact/calendar/schedule/report를 직접 FK하고 tme governance가 abs plan을 FK한다. 새 run source mirror도 이 정책 승인을 받지 않았다.

해결은 abs-local immutable snapshot/ref 및 exact Time owner port로 분리해야 한다. neutral shared infrastructure 예외가 필요한 경우에는 exact owner/classification/권한/조회/transaction/visibility 책임의 독립 architecture revision이 필요하다. **본 델타는 기존 정책을 완화하거나 FK를 정본 승인하지 않는다.** `TIM-REVIEW-OPEN-CROSS-CONTEXT` P0, crossContextPolicyPass=false이며 phase2 SQL을 canonical로 발행하면 안 된다.

## Wire·검사기의 정확한 보장 범위

actual pinned `decimal-value-types.v1.json` 및 backend `CanonicalDecimalJson.java`와 일치시키는 원칙은 JSON string, exponent/plus/whitespace/integer leading-zero/number/scale overflow 금지, signed-zero→0, unquantized trailing-zero 제거다. `1.500000`와`1.5`, `-0.000000`와`0`는 입력 alias로 받아 동일 canonical bytes/hash로 정규화한다. quantized display scale은 별도 named rounding stage이며 수량 wire/hash를 fixed spelling으로 바꾸지 않는다.

actual engine은 설치된 Ajv6.12.6다. business defs의 실제 validation keywords는 Draft7-compatible subset이고 unknown validation keyword를 거부한다. holder `$defs`는 ref storage로 사용한다. **declared2020-12 전체 author envelope 또는 full2020-12 인증이 아니다.** referenceContract/x-*는 annotation이며 actual owner authorization/type lineage 검증을 대신하지 않는다.

reader는 duplicate JSON keys/nonfinite/overflow를 거부한다. 이 TIM author envelope의 숫자 정책은 정수 JSON 값만이며 Quantity/Rate/CalculationDecimal은 string이다. fractional/underflow/rounding-loss 숫자 token을 허용하지 않는다. `1.0`은 정확한 integral1로 읽되 임의 fractional JSON을 처리하는 범용 RFC library라고 주장하지 않는다. test에서 boolean과number는 다르다. 지원4 RFC ops, escaped pointer, array bounds, field closure와 in-memory no-op rejection을 검사한다.

DDL 검사는 table metadata/phase1의 대응, phase2 actual FK SQL list·arity·local/target columns·referenced UK 대응이다. full PostgreSQL parser/execution·policy/trigger/exclusion/default/immutability/ACL·sourceLeaf truth oracle를 인증하지 않는다. WFM candidate/close-period 외부 테이블 owner/successor와 preserved command receipt 경계는 별도 OPEN이다.

## 재현 명령과 실제 작성자 검사

작업 디렉터리 `/Users/a10697/Work/DWP`. 다음 명령은 읽기 전용이며 새 materialized file을 만들지 않는다.

```sh
python3 -B output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_tim_base_review_remediation.py --compact
python3 -B -m unittest discover -s output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation -p test_tim_base_review_remediation.py -v
python3 -B output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_tim_base_review_remediation.py --compact --require-g3
```

작성자 검사 실제 결과: normal exit0이지만 AUTHOR_DRAFT_CHECKS_ONLY_NOT_APPROVED/readinessPass=false/G3CLOSED; structural errors0; Ajv481 compile/576 closed object schema nodes/12 typed shape cases/34 negative+compatibility controls 실패0; immutable input fingerprint10/decimal2 configs. unit37/37 통과. `--require-g3`는 exit1이다.

정본 semantic oracle 실제 결과는 **FAIL2**: UNSUPPORTED_PROPOSAL_DIALECT + OPERATION_GRAPH_REQUIRED, readiness=false, validated operations0. custom checker 무검사 raw0을 PASS로 바꾸지 않았다. 24 concrete invariant 정의는 domain/native API 실행0이며 G4 actual acceptance로 계산하지 않는다. unit helper도 DB transaction·PEP·crypto·owner workload 구현 증거가 아니다.

## 다음 단계와 승인 경계

G3: 전체 exact successor 설계/소스·state·write/read·SQL+fixture+test allocation 합성 및 독립 검증, 실제 공유 DTO/SPI·fail-closed adapter/PEP·13-stream authority/scaffold/consumer compile·현행 common/pilot runtime. source112 및 source4 하위 OPEN·13 FK·미게시owner·legacy assignment binding·WFM alias를 숨기지 않는다.

G4: 각 도메인 business migration/CRUD/AST/accrual/DST/atomic ledger와 전체 실제 happy/denied/duplicate/correction 실행. 이를 G3 열기 위해 먼저114개 전체 구현하라는 순환 준비 조건으로 만들지 않는다.

G6: 실제 고객 권한·운영 adoption·country/live integration/data/production activation. 이 작성자 제안은 G3/G4/G6 승인이 아니며 retained historical12 및 BASE86 전체 의미 무결성도 UNVERIFIED다.

Root/Mendel stable-byte 독립 재감사 전 P0/P1 closure 또는 READY/PASS를 선언하지 않는다.
