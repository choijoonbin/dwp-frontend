# PAY BASE exact preparation proposal v1

상태: DESIGN_PROPOSED / CURRENT_PUBLISHED=false / G3 CLOSED_FAIL_SAFE. 이 파일과 JSON은 작성자 수정 설계안이며 역사 G2·Gate·central rules·BE/FE source를 대체하거나 independent P0 CLOSED를 선언하지 않는다.

## 1. 결과와 승인 경계

BASE-P0-010의 digest-only foundation/run admission과 string formula wire를 실제 typed payload·immutable source vector·closed formula AST로 분리한다. 기존 generic businessKey+digest를 정상 계약으로 재사용하지 않는다. 모든 신규 UUID는 실제 allocator/INSERT RETURNING 또는 검증된 owner public UUID에서만 얻는다. business code를 UUID로 해시·변환하거나 correlation UUID를 business FK로 사용하지 않는다.

계획은 119 operations(108 public/11 owner internal; 38 query/81 command), historical42+new46=88 table specifications/1303 columns, 635 schema definitions, 34 owner DTO/refetch requirements, 81 operation-private event payloads, 51 negative cases다. 10 historical tables와4 public operations는 bounded scope 밖 UNVERIFIED로 보존한다. 이 숫자는 모든580 PAY parent/3515 child,119 retirement parent,34 YEA route의 의미 복원이나 전체 BASE86 PASS가 아니다.

G3는 full exact planned API/query/response/event·physical SQL·read/write/source/state·typed fixture/test allocation·소유권/권한/SoD/privacy와 실제 공유 owner DTO/SPI/fail-closed adapter/consumer compile·common pilot/runtime readiness·독립 설계 검증을 요구한다. 119 업무 API의 domain CRUD·테이블 CREATE·native 전수 API→row/artifact→receipt/event→query 실행은 G4다. 고객 실제 identity adoption/parallel-pay·법정값·은행/ERP/YEA provider 운영 승인은 G6다. source/SQL/owner 설계 누락은 G4/G6로 미루지 않는다.

## 2. 기존 신원 원천 재사용과 외부 SELF 계약

실제 Auth `com_users.person_public_id`와 `IdentitySubjectLookupService.Subject(publicId,personPublicId,...)`가 있다. Gateway는 caller `X-DWP-Person-Public-ID`를 제거하고 verified Auth person을 다시 설정한다. People은 `ppl_persons`→worker/relationship/assignment의 tenant-bound join을 소유한다. 새 PAY/HRM 독립 principal-worker 신원 원장을 normal SELF의 정본으로 만들지 않는다.

중요 근거: 현재 People `HcmPopulationRepository.actor()`는 primary/effective ordering 뒤 LIMIT1을 쓴다. 이 API를 범용 multiemployment external SELF proof로 재사용하지 않는다. 현재 새 PrincipalVerificationReceipt에는 person owner binding proof가 없고, 현재 HRM SelfContext와 actual PeopleWorkerIdentity도 필요한 worker/public-employment projection 전체를 외부 consumer에게 게시한 증거가 없다.

이 제안은 `Auth.PrincipalPersonBindingReceipt.proposal.v1`와 `HRM.VerifiedSelfScopeSnapshot.proposal.v1`을 새 exact successor로 DEFINE한다. Auth principalPublicId≠personPublicId≠workerPublicId이며 authPersonBindingRevision·People personOwnerRevision·effective verified employmentContextPublicId/worker/employment/assignment IDs·asOf/validUntil·digest를 binding한다. owner authorization/schema/query/proof·signed DTO/SPI publication는 HARD G3 P0 OPEN이다. 0 context는403/opaque404,1은 verified effective context만,다수는409 SELF_CONTEXT_REQUIRED 뒤 명시적 authorized context 재조회다. body worker UUID는 query/operator selector일 뿐 SELF claim이 아니다. 고객 실제 신원 authority/bootstrap adoption은 G6다.

## 3. 설정 객체와 실질 payload

Entity/paygroup/calendar/rounding/eligibility/element/formula/GL mapping은 각각 실제 closed create schema를 갖는다. 공통 artifact registry는 하나의 typed payload version에만 연결되며 서로 다른 worker/run/case lifecycles를 conflation하지 않는다.

- Entity: verified HRM legalEntity source, jurisdiction/currency/timeZone/effective range.
- Paygroup: tenant-local legal payroll entity ID, effective frequency/payment method/currency, exact eligibility/calendar artifact refs.
- Calendar: periodKey/start/endsBefore/inputCutoff/payDate/timeZone/tzdbVersion의 실제 closed periods. public wire는 half-open date range다. historical inclusive `period_end`에는 endsBefore−one civil calendar day를 명시적 변환한다. DST를24-hour arithmetic으로 처리하지 않는다.
- Rounding: immutable header1개+unique per-stage1..5 child rules. 기존 header의 stage/scale/mode/currency를 첫 rule로 채우지 않고 `pay_rounding_policy_stage_rules`로 이동한다. 이 source-restoration 승인/DDL successor는 OPEN이다.
- Eligibility: actual workforce facts/typed dependencies와 BOOLEAN output의 closed AST. generic digest 또는 caller TRUE가 아니다.
- Element: EARNING/DEDUCTION/EMPLOYER_COST/INFORMATION/BALANCE, exact value type/unit/currency, priority, eligibility/formula/rounding source binding, optional pack classification.
- Formula: declared exact source inputs, closed recursive AST, decision tables, immutable dependency/rounding refs, resource bounds and actual golden results.
- GL mapping: exact local element version and approved account registry, debit/credit/cost-object mapping. native tenant-governed chart가 기본이고 ERP master/transport는 optional source다. `Finance.AccountRegistrySnapshot`의 conceptual label은 새 service를 신설한 결정이 아니다. dwp-platform-server configuration authority/optional ERP provenance의 root owner successor는 OPEN이다.

DRAFT 생성에는 SYS `PayrollPolicyContextSnapshot`을 쓴다. 아직 존재하지 않는 own artifact UUID를 이미 승인된 binding 목록에 요구하는 순환을 만들지 않는다. publish 시에는 새 `EffectivePayrollConfigurationSnapshot`과 own immutable artifact UUID/version/digest의 approved governance binding을 실제 refetch한다. SYS는 scope/effective priority/version/schema/approval governance, PAY는 business payload·DSL·계산 내용을 소유한다. local shadow configuration/ACL engine·cross-DB repository/FK는 금지한다.

새 SYS configuration 경계 `platform-hris-configuration/hris_configuration/flyway_hris_configuration_history`는 ROOT_ARCHITECTURE_DECISION_PROPOSED일 뿐 CURRENT_PUBLISHED가 아니다. 현재 canonical21 XCON wire schema와 기존 dependencies만 존재하며13-stream DTO/SPI/op·distinct DS/login role·empty schema/control receipt/guard bootstrap·shared pilot은 OPEN이다. 과거8-service/9-stream scalarv2 실행은13-stream proof가 아니다. primary credential/DB_USERNAME fallback으로 supplemental DS를 열지 않는다.

## 4. 실제 input vector와 선택적 원천

run.prepare는 entity/paygroup/period 관계를 실제 PAY row에서 해석하고, authorized worker+assignment+currency target 또는 exact effective membership revision을 고정한다. 전달 digest 하나만으로 freeze하지 않는다. PREPARING run/BUILDING snapshot에는 requested selector만 기록하고, actual accepted owner source proof 뒤 READY/FROZEN으로 전이한다.

각 source vector에는 sourceKind/ownerSession/contractRef/object public UUID/revision/schemaVersion/asOf/effective range/actual canonical payloadDigest/lineCount/accepted ingestReceipt/fieldSetVersion을 저장한다. 로컬 element/formula/rounding/entries/balance/prior-final results도 실제 version/watermark/digest로 고정한다. single worker max revision을 모든 source revision처럼 쓰지 않는다.

HRM worker/person/employment/assignment/compensation, optional tax/dependent/bank token manifests, TIM closed result, optional PER approved plan, SYS configuration, optional country pack를 owner 별로 exact refetch한다. Events는 invalidation signal일 뿐 원천 데이터나 성공 receipt가 아니다. 각 owner는 signed tenant/caller/on-behalf/purpose/population/field/asOf와 public object identity를 재인가한다.

`InputDeclaration.sourceBinding`은 actual operand entity/field를 식별한다. WORKER_ENTRY는 exact element artifact, TIM은 exact closed result worker/assignment/payCode/unit, PER는 component/effective worker/assignment, PRIOR_RESULT는 explicit finalized run+element, BALANCE는 own frozen watermark+key, case는 frozen basis/approved output+component, country는 exact pack/fact를 명시한다. current element native input은 typed `CURRENT_ELEMENT_INPUT/thisElement=true`를 actual created element relation로 해석해 pre-create UUID/digest cycle를 피한다. 원천을 첫 UUID/첫 행으로 선택하지 않는다.

NOT_SELECTED는 actual compiled dependency plan에 원천 의존이 없거나 기능 비활성인 경우에만 허용한다. required source가 없으면 typed error로 닫으며 implicit zero/null/default-success를 만들지 않는다. HRM salary 기반을 선택하지 않은 native manual entries 계산은 가능하다. BANK는 BANK_CONNECTOR 지급에만 필요하고 native MANUAL_RECORDED에는 강제하지 않는다. tax/country pack/PER plan도 선택된 의존 업무에만 필요하다.

TIM ClosedTimeResult XCON008과 PER ApprovedCompensationPlan XCON020의 기존 bounded stream·count/sequence/ordered canonical digest·atomic N-lines ingest 계약을 보존한다. header/line/byte/compression/line ceilings는 기존 canonical wire의 exact transport를 따른다. incomplete staging은 visible input이 아니며 digest/count/sequence/unit/currency mismatch는 quarantine/rollback한다. 새 owner revision/state ports는 OPEN이며 schema 이름만으로 passed closed source가 되지 않는다.

source change/reopen/supersede/revoke는 actual owner change snapshot→old frozen vector identity/revision/digest를 검증한다. unfinalized는 INVALIDATED marker·pending approval cancel/block를 기록하고 finalization을 막는다. financial FINALIZED는 old input/result를 수정하지 않고 explicit retro assessment만 생성한다. unrelated tenant-global entry/balance counter 증가를 실제 selected operand 차이로 오인하지 않고 selected row vector/hash로 비교한다.

freeze의 `expectedInputDigest`는 source vector만이 아니라 target·local input/artifact·source revision의 full frozen compound hash와 비교한다. 별도 저장 `source_vector_digest`를 이 compound digest와 혼동하지 않으며, 어느 digest도 actual owner refetch/accepted ingest proof를 대체하지 않는다.

## 5. 계산식 타입·unit·currency·limits

wire expression은 string이 아닌 closed PAY_RULE_AST_V1이다. 19 allowlisted operators만 허용한다. 모든 nodeId/input/dependency version은 고유/유효하며 AST4096nodes·64depth 이하의 더 작은 published limits, bounded collection·memory·timeout을 적용한다. numbers/decimals는 canonical non-exponent string이다. floating point·reflection·SpEL/SQL/JS·file/network/DB·clock/random·class/method selection·unbounded recursion/loop는 금지한다.

MONEY/MONEY ADD는 same currency, QUANTITY/QUANTITY는 same unit이다. UNIT_PRICE(per-minute/hour/day/count money)×matching quantity는 MONEY다. hourly price×DAY는 reject한다. salary MONTHLY/ANNUAL을 generic30day/8hour/365day 회사 상수로 나누지 않는다. HRM compensation amount/frequency와 approved calendar/time factor의 exact source를 요구한다. UNIT_PRICE는 formula normalization/intermediate 용도이며 native worker entry는 separately closed value variants를 쓴다.

MINUTE↔HOUR60은 물리 unit factor만 허용한다. DAY↔HOUR는 verified worker calendar/source가 없으면 금지한다. currency conversion/FX fallback은 없다. RATE RATIO와 UNITLESS NUMBER를 암묵적 coercion하지 않는다. DIVIDE0, overflow, cycle, unknown function/input, mismatch, missing pack/source, timeout/resource breach는 typed failures이며 partial monetary output을 final facts로 올리지 않는다.

SOURCE_NORMALIZE→FORMULA_DECLARED→ELEMENT→WORKER_RESULT→SETTLEMENT_OR_STATUTORY의 실제 rounding마다 before/after/stage/scale/mode/policy UUID/version/digest를 기록한다. HALF_UP/HALF_EVEN/DOWN/UP/FLOOR/CEILING만 허용하며 precision을 SQL bind 전에 검증한다. implicit DB rounding·truncate/saturate는 없다. actual golden evaluation PASSED가 publish 전 필요하며 expected-only report는 성공이 아니다.

## 6. 객체별 상태와 native flow

기계 상태는 아래 실제 enum으로 분리한다. guards·step/effect는 JSON의 stateMachines/procedureContracts에 있다. syntax reachability는 guard satisfiability 또는 independent proof가 아니다.

### PAY.ConfigurationArtifact

table `pay_config_artifact_versions`, initial DRAFT, terminal/frozen REJECTED, RETIRED, CANCELLED.

| operation | from | to | guard |
| --- | --- | --- | --- |
| pay.config.validate | DRAFT | VALIDATED | actual payload/graph/dependencies/effective schema complete no violations |
| pay.config.validate | DRAFT | VALIDATION_FAILED | actual violations nonempty |
| pay.config.validate | VALIDATION_FAILED | VALIDATED | same admitted immutable draft reevaluation with refetched valid dependencies |
| pay.config.simulate | VALIDATED | VALIDATED | bounded cases actualmatches; event records new report not phantomstate |
| pay.config.approval.submit | VALIDATED | APPROVAL_PENDING | VALID report+formula/eligibility requiredPASSEDgolden+ownerapprovalnotcaller |
| pay.config.approval.apply | APPROVAL_PENDING | APPROVED | ownerAPPROVED exact revision+payload/eval/golden vector+maker≠decider |
| pay.config.approval.apply | APPROVAL_PENDING | REJECTED | ownerREJECTED exact sealedsubject |
| pay.config.publish | APPROVED | PUBLISHED | CAS+verified SYS governance+uniqueeverpublishedrange+SoD |
| pay.config.retire | PUBLISHED | RETIRED | forwardeffectiveclosure only no historicalpayloadrewrite |
| pay.config.cancel | DRAFT | CANCELLED | no externalapproval orpublished dependencies |
| pay.config.cancel | VALIDATED | CANCELLED | no externalapprovalstarted |
| pay.approval.reconcile | APPROVAL_PENDING | CANCELLED | ownerCANCELLED_BEFORE_DECISION exactscope |
| pay.approval.reconcile | APPROVAL_PENDING | APPROVED | ownerDECISION_ALREADY_APPROVED exactreceipt |
| pay.approval.reconcile | APPROVAL_PENDING | REJECTED | ownerDECISION_ALREADY_REJECTED exactreceipt |
| pay.config.cancel | VALIDATION_FAILED | CANCELLED | noexternalownerapproval/publishedfact;CAS exactloadedversion |

Eachartifactversion one aggregate; typed payload child hasprojectionstatus mapping bykind;1entity version isnot N worker/runs lifecycle.

### PAY.PayrollRun

table `pay_payroll_runs`, initial PREPARING, terminal/frozen FINALIZED, SUPERSEDED, CANCELLED.

| operation | from | to | guard |
| --- | --- | --- | --- |
| pay.run.input.freeze | PREPARING | READY | allselectedsources accepted+target exhaustive+dependenciescomplete |
| pay.input.source.ingest | PREPARING | INPUT_INVALIDATED | unsupported/stale/source mismatch leavesnoFROZEN |
| run.calculate | READY | CALCULATING | new queuedattempt exact frozenhash |
| pay.attempt.commit | CALCULATING | CALCULATED | activefence+schema/unit/currency/count/hash+zero partialwrite |
| pay.attempt.fail | CALCULATING | FAILED | fencedpermanent/retryable failure |
| pay.attempt.fail | CALCULATING | RESULT_UNKNOWN | lost commit proof ambiguous; no speculative retry |
| pay.attempt.reconcile | RESULT_UNKNOWN | CALCULATED | durable actual committedoutput proven |
| pay.attempt.reconcile | RESULT_UNKNOWN | FAILED | durable nonexistentcommit fenced/closed proven |
| run.validate | CALCULATED | VALIDATED | allcontroltotals/sourcevalidity/targetdispositions/ledger checksvalid |
| run.validate | CALCULATED | VALIDATION_FAILED | blocking actual issue nonempty |
| run.approve | VALIDATED | APPROVAL_PENDING | ownerapprovalcase exact result/input/revision |
| pay.run.approval.apply | APPROVAL_PENDING | APPROVED | authoritative APPROVED+SoD+currentinputs unchanged |
| pay.run.approval.apply | APPROVAL_PENDING | VALIDATION_FAILED | authoritative REJECTED |
| run.finalize | APPROVED | FINALIZED | actualvalidatedimmutablefacts+sourcefreshness+SoD+appendfinalpostingreceipt once |
| pay.run.amend | PREPARING | SUPERSEDED | new fullyrefetched successor nofinalposting |
| pay.run.amend | READY | SUPERSEDED | new successor withnewowninputvector no changingoldfrozenrows |
| pay.run.amend | CALCULATED | SUPERSEDED | no live lease/unresolvedexternal decision |
| pay.run.amend | VALIDATION_FAILED | SUPERSEDED | new corrected sourcevector |
| pay.run.amend | FAILED | SUPERSEDED | attemptfencedclosed no unknown |
| pay.run.amend | INPUT_INVALIDATED | SUPERSEDED | authoritativesource refetch successor |
| pay.run.cancel | PREPARING | CANCELLED | no live job/approval/financialposting |
| pay.run.cancel | READY | CANCELLED | no liveattempt |
| pay.approval.reconcile | APPROVAL_PENDING | CANCELLED | ownerCANCELLED_BEFORE_DECISION |
| pay.approval.reconcile | APPROVAL_PENDING | APPROVED | ownerDECISION_ALREADY_APPROVED |
| pay.approval.reconcile | APPROVAL_PENDING | VALIDATION_FAILED | ownerDECISION_ALREADY_REJECTED |
| pay.run.amend | VALIDATED | SUPERSEDED | exactreplacementSources fullyreauthorized;noexternalpayment/GL/livelease/unknown;newsuccessor losesoldapproval andrequiresnewownerdecision |
| pay.run.amend | APPROVED | SUPERSEDED | exactreplacementSources fullyreauthorized;noexternalpayment/GL/livelease/unknown;newsuccessor losesoldapproval andrequiresnewownerdecision |

Finalizedsource never transitions to paymentpending/closed/reopened. Payment/GL settlement projection separate. Reopen/correction on FINALIZED creates new CORRECTION/RETRO successor+explicitreversal/difference; nooriginalstateupdate.

### PAY.RunAttempt

table `pay_payroll_run_attempts`, initial QUEUED, terminal/frozen SUCCEEDED, FAILED.

| operation | from | to | guard |
| --- | --- | --- | --- |
| pay.attempt.claim | QUEUED | RUNNING | registeredinternalworker+CAS+lease/fencecounter |
| pay.attempt.heartbeat | RUNNING | RUNNING | sameactivefence+unexpiredownerclocklease |
| pay.attempt.commit | RUNNING | SUCCEEDED | sameactivefence+completeactual stagedartifact+hash |
| pay.attempt.fail | RUNNING | FAILED | fencedknownfailure, nofinalposting |
| pay.attempt.fail | RUNNING | RESULT_UNKNOWN | commitstateunknown |
| pay.attempt.reconcile | RESULT_UNKNOWN | SUCCEEDED | actualdurable committedresult proof |
| pay.attempt.reconcile | RESULT_UNKNOWN | FAILED | fencednotcommittedproof |

No timeout-as-success. Newattempt after FAILED requires runamend READYsuccessor currently; neverrewrites oldattempt.

### PAY.PaymentBatch

table `pay_payment_batches`, initial DRAFT, terminal/frozen ACKNOWLEDGED, MANUALLY_RECORDED, CANCELLED.

| operation | from | to | guard |
| --- | --- | --- | --- |
| pay.payment.validate | DRAFT | VALIDATED | actualinstructions/amount/lineage/verifiedtoken+activation ifBANK |
| pay.payment.approval.submit | VALIDATED | APPROVAL_PENDING | ownerdecisionbound batchhash |
| pay.payment.approval.apply | APPROVAL_PENDING | APPROVED | ownerAPPROVED+maker/checker/banksourcechanger separation |
| pay.payment.approval.apply | APPROVAL_PENDING | REJECTED | ownerREJECTED |
| payment.release | APPROVED | RELEASED | native logicalrequestcommitted; providerresult notassumed |
| pay.payment.reconcile | RELEASED | ACKNOWLEDGED | actualBANKownerreceipt allinstructions accepted/settled schema |
| pay.payment.reconcile | RELEASED | REJECTED | owner definitive reject |
| pay.payment.reconcile | RELEASED | RESULT_UNKNOWN | owner resultunknown |
| pay.payment.reconcile | RELEASED | PARTIALLY_ACKNOWLEDGED | ownerinstruction-level partialresult noallpaidclaim |
| pay.payment.reconcile | RESULT_UNKNOWN | ACKNOWLEDGED | owner lookup exactlogicalkeyhash provesallsettled |
| pay.payment.reconcile | RESULT_UNKNOWN | REJECTED | owner exactdefinitivereject |
| pay.payment.reconcile | RESULT_UNKNOWN | PARTIALLY_ACKNOWLEDGED | authoritativepartiallookup |
| pay.payment.manual.record | RELEASED | MANUALLY_RECORDED | MANUALmethod+Documentverifiedproof+amountbound+independentchecker, notBANK_ACK |
| pay.payment.cancel | DRAFT | CANCELLED | no releasedlogicalrequest |
| pay.payment.cancel | VALIDATED | CANCELLED | no ownerdecisionpending |
| pay.approval.reconcile | APPROVAL_PENDING | CANCELLED | ownerCANCELLED_BEFORE_DECISION |
| pay.approval.reconcile | APPROVAL_PENDING | APPROVED | owner alreadyapproved |
| pay.approval.reconcile | APPROVAL_PENDING | REJECTED | owner alreadyrejected |

Releasedunknown/partialcannotcancel orblindresend. Reverse createsnew oppositeinstructions andlinks; sourceACK/MANUALimmutable.

### PAY.GlBatch

table `pay_gl_batches`, initial DRAFT, terminal/frozen POSTED, NATIVE_POSTED.

| operation | from | to | guard |
| --- | --- | --- | --- |
| gl.create | DRAFT | BALANCED | canonicalexactdebits=credits withincurrency+allmapping/accountsource refsvalidated |
| pay.gl.approval.submit | BALANCED | APPROVAL_PENDING | ownerapprovalbatch digest |
| pay.gl.approval.apply | APPROVAL_PENDING | APPROVED | ownerAPPROVED+SoD |
| pay.gl.approval.apply | APPROVAL_PENDING | REJECTED | ownerREJECTED |
| gl.post | APPROVED | NATIVE_POSTED | NATIVE_CANONICAL independentpostingduty+actualowner-privatejournalpostingreceipt |
| gl.post | APPROVED | SENT | ERPactivatedconnectorlogicalrequestpersisted |
| pay.gl.reconcile | SENT | POSTED | authoritative exactERP POSTEDreceipt |
| pay.gl.reconcile | SENT | REJECTED | authoritative exactERPreject |
| pay.gl.reconcile | SENT | RESULT_UNKNOWN | unknowntransportlookup |
| pay.gl.reconcile | RESULT_UNKNOWN | POSTED | authoritative lookup exacthashkey |
| pay.gl.reconcile | RESULT_UNKNOWN | REJECTED | definitive ownerreject |

Nativejournal postingnot ERPbookconfirmed. Cancellationpendingownerknownreject keeps REJECTED orapproved; no phantomCLOSED.

### PAY.RETIREMENTCase

table `pay_retirement_cases`, initial OPEN, terminal/frozen POSTED, CANCELLED.

| operation | from | to | guard |
| --- | --- | --- | --- |
| pay.retirement.case.validate | OPEN | VALIDATED | actualverifiedservice/comp/contributions+eligibility TRUE |
| pay.retirement.case.validate | OPEN | VALIDATION_FAILED | ineligible/missingtypedbasis |
| pay.retirement.case.calculate | VALIDATED | CALCULATED | installedapproved compatiblepack+exactbasis typedoutput noactuallegalassertionforstub |
| pay.retirement.case.review | CALCULATED | REVIEWED | actualownerAPPROVED outputdigest+SoD |
| pay.retirement.case.post | REVIEWED | POSTED | append exactcasepostinglink+newrun no originalfinalrewrite |
| pay.retirement.case.cancel | OPEN | CANCELLED | no provider/financialposting |
| pay.retirement.case.cancel | VALIDATED | CANCELLED | no calculationunknown |

Correct operation creates newsuccessor withreplacementbasis+oldoutputsource links; originalcase/output never rewrites terminalfacts. Coverage119retirement/34YEA parents UNVERIFIED.

### PAY.YEAR_ENDCase

table `pay_year_end_cases`, initial COLLECTING, terminal/frozen POSTED, CANCELLED.

| operation | from | to | guard |
| --- | --- | --- | --- |
| pay.yearend.case.validate | COLLECTING | READY | annualruncoverage/sourcefacts/evidence/consentcomplete no lawcomputed |
| pay.yearend.case.validate | COLLECTING | VALIDATION_FAILED | missingcoverage/consent/orprovenance |
| yearend.provider.submit | READY | SUBMITTED | activated selectedprovider/nativepack+exactbasis/consentlogicalrequest |
| pay.yearend.provider.reconcile | SUBMITTED | CALCULATED | authoritative CALCULATED typedoutput hash |
| pay.yearend.provider.reconcile | SUBMITTED | CORRECTION_REQUIRED | authoritative correctionsrequiresnewbasis |
| pay.yearend.provider.reconcile | SUBMITTED | RESULT_UNKNOWN | owner unknown |
| pay.yearend.provider.reconcile | RESULT_UNKNOWN | CALCULATED | exactlogicalrequest statusknownCALCULATED |
| pay.yearend.case.review | CALCULATED | REVIEWED | ownerAPPROVED output+SoD |
| yearend.provider.submit | REVIEWED | SUBMITTED | FILEoperation approved output+consent |
| pay.yearend.provider.reconcile | SUBMITTED | FILED | exactownerfilingreceipt FILED notcalculationACK |
| pay.yearend.case.post | REVIEWED | POSTED | append adjustmentrun basis/output link |
| pay.yearend.case.post | FILED | POSTED | append finalapproved adjustmentrun |
| pay.yearend.case.cancel | COLLECTING | CANCELLED | no unresolvedprovider request |

Correct operation creates newsuccessor withreplacementbasis+oldoutputsource links; originalcase/output never rewrites terminalfacts. Coverage119retirement/34YEA parents UNVERIFIED.

### PAY.InputSnapshot

table `pay_input_snapshots`, initial BUILDING, terminal/frozen INVALIDATED.

| operation | from | to | guard |
| --- | --- | --- | --- |
| pay.run.input.freeze | BUILDING | FROZEN | allactualaccepted sourcevectors/targetcount/order/digest proofscomplete |
| pay.input.source.ingest | BUILDING | INVALIDATED | unrecoverable stale/superseded/schema/digest evidence |
| pay.input.source.invalidate | FROZEN | INVALIDATED | ownerreopen/revoke/neweffective source event exactoldrevision, andsourcefinancialrununfinalized |

immutableFROZENbusinessinput;INVALIDATED marker append invalidationfact notrewrittenpayload

Financial FINALIZED run은 payment/GL pending/CLOSED/REOPENED로 덮어쓰지 않는다. Settlement는 별도 batch/receipt projection다. 계산 후보 rows의 `posted_at`를 `calculated_at`로 의미 분리하고 unique finalization receipt가 실제 금융 posting authority다. balance ledger/result/reversal/source/basis/approval facts는 append-only다.

REGULAR은 하나의 active financial position, OFF_CYCLE은 별도 run, RETRO_DIFFERENCE는 old/new 차액, FULL_REVERSAL_REPLACEMENT는 original-line linked inverse/replacement를 만든다. +100 difference와−3000/+3100 fullpair를 동시에 게시하지 않는다. unfinalized amend는 fully refetched new input/run successor이며 old source SUPERSEDED; approved old decision은 새 successor에 승계되지 않는다. final reopen/correction는 new CORRECTION/RETRO와 explicit old finalization/basis links만 만들고 original monetary facts/state를 unlock하지 않는다.

worker-only unique를 worker+assignment+currency로 바꾼다. per-run attempt counter, monotonic lease/fencing, own tenant ENTRY/BALANCE input revision counters와 ledger/entry revision을 계획한다. actualattempt row_version가 없던 historical schema에는 ADD successor를 명시한다. lease timeout은 성공이 아니고 stale fence late commit은0writes다. staging actual count/hash/source proof 뒤 complete calculated facts를 원자 append한다. every command receipt/outbox와 commit RETURNING은 same owner transaction이다.

Payment MANUAL_RECORDED는 actual Document verified proof+independent checker로 MANUALLY_RECORDED를 기록하며 은행 ACK를 주장하지 않는다. BANK_CONNECTOR는 verified HRM bank token version/currency/verification/revocation/provenance와 exact active Integration format/conformance/idempotency/status-lookup를 요구한다. maker/checker와 bank source changer≠releaser는 실제 owner provenance로 판정하며 caller actor 목록으로 우회하지 않는다.

RELEASED/SENT는 logical send committed이지 funds moved/ERP posted가 아니다. RESULT_UNKNOWN은 exact logical key/request/payload digest/provider reference의 actual owner lookup으로 복구한다. partial instruction receipt는 PARTIALLY_ACKNOWLEDGED이고 전액 지급/period closed를 주장하지 않는다. unknown send는 cancel/새 key/blind resend 불가다. 원 settlement는 immutable이며 reverse/refund는 new opposite instructions/journal와 original receipt links; actual provider reversal receipt는 별도다.

GL NATIVE_CANONICAL은 native balanced canonical journal+owner private NATIVE_POSTED proof로 동작하며 ERP를 강제하지 않는다. ERP POSTED는 actual owner receipt가 있어야 한다. missing account/mapping/FX 또는 unbalanced lines를 synthetic plug로 맞추지 않는다. generic approval cancel은 owner CANCELLED_BEFORE_DECISION만 local cancel; already-approved/rejected는 실제 owner decision을 채택하고 UNKNOWN/NOT_FOUND는 pending 보존한다. GL cancel terminal/some case rejection/source-restoration successor detail은 아래 OPEN 항목에 남긴다.

Payslip은 actual finalization/worker-result relation·published template·verified document/version/hash 후 publication한다. 현재 entitlement/purpose/field/step-up·SELF owner context를 매번 재검증한다. immutable run input/old originating receipt는 entitlement 자체를 freeze하거나 재현하는 허가가 아니다. revoke/download unknown source는 false complete가 아니다.

## 7. retirement/YEA는 generic run 동의어가 아니다

Retirement는 독립 scheme(DEFINED_BENEFIT/DEFINED_CONTRIBUTION/SEVERANCE/OTHER_REGISTERED)·case kind·effective employment set·verified credited service history/continuity/termination·compensation earned interval·prior final result line·contribution/reversal ledger·currency·eligibility/pack version의 immutable basis를 갖는다. current worker status나 일반 run inputDigest로 이를 대체하지 않는다. validate/calculate/review/post-to-new-run/correct-new-basis/cancel-unposted와 exact output component/basis-line/trace/formula refs를 계획한다.

Year-end는 annual final income/withholding coverage, verified external-income/prior withholding evidence, dependent/deduction facts·tax identity/jurisdiction/year·consent/purpose/effective source vector가 별도 frozen basis다. COLLECTION_ONLY native case는 provider 없어도 수집/검증을 설계하지만 READY는 법정 금액 PASS가 아니다. EXTERNAL_PROVIDER/NATIVE_COUNTRY_PACK/HYBRID의 validate/calculate/file/correct/status는 actual compatible activated optional SPI의 typed output/filing receipt로만 확정한다. FILED는 calculation ACK와 다르다. CORRECTION_REQUIRED는 new basis/case/output successor이고 provider result/consent history는 immutable다.

POSTED case는 approved output을 명시적 paygroup/period/entity/config 관계의 new OFFCYCLE/CORRECTION payroll input으로 handed off했다는 뜻이다. 금융 finalization 또는 bank payment 성공을 주장하지 않는다. actual run approval/finalization은 계속 필요하다.

119 retirement parents와34 YEA routes의 모든 basis/history/eligibility/object/form/document/correction/distribution variant를 이 shell/operation counts만으로 인증하지 않는다. source→target decision evidence와 exact missing business contracts는 HARD G3 P0 OPEN이다. 공통 generic pack/provider schema/SPI/disabled adapter/fail-closed consumer compile는 G3, actual official law/rates/retirement/YEA statutory oracle·partner provider credential/cutover는 G6다.

## 8. source graph의 증거 수준

`sourceModels`는119 operation 각각에 typed request/header/path/query sources, actual owned row schema/column fieldSources, primary tenant/public UUID query binding, existing/proposed same-owner FK catalog, owner refetch requirement, captured clock, distinct business ID/DB RETURNING, loaded CAS prestate, guarded outcome, receipt projection을 분리한다.

`tableSpecifications[].columns[].initialSource`는 CREATE/APPEND일 때만 적용한다. mutable phase에 create body를 재사용하지 않는다. UPDATE status/version/time/decision/result reference는 actual loaded prestate·owner outcome·transition guard·RETURNING을 사용해야 한다. full per-column normalized mutation source graph의 candidate overlay/strict validator integration은 OPEN이다. 새로운 `ruleId=TABLE_COLUMN` 문자열과 inputs=[tenant,actor]를 만드는 기법은 closure가 아니며 사용하지 않는다. request source inventory 수와 derived source count를 domain 의미 PASS로 표시하지 않는다.

제안의 semanticBinding은 target required validation contract일 뿐 실제 검증 receipt가 아니다. canonical owner API/table/query/identity binding·owner reauthorization·snapshot/version/digest/tenant/principal/asOf/cross-module consumer integration을 독립 검증하기 전 normal semantic validator PASS를 선언하지 않는다. 역사 HRM31 identity/provenance FAIL rows나 TIM5018 source count를 이 PAY 문서로 숨기거나 덮지 않는다.

Receipts의 aggregate_public_id/revision/result_ref는 actual returned/loaded business subject/output에서 온다. receipt UUID 자체, correlation UUID, arbitrary businessKey-derived UUID를 aggregate/result/other domain FK로 fallback하지 않는다. captured owner clock/allocator/header/request/CAS roots 없이 actor+tenant만으로 clock/ID/version/outcome을 생성했다고 증명하지 않는다.

## 9. public queries, events와 실제 SQL 계획

38 query response에는 exact actual PAY table/column projections과 per-collection signed current-policy/source-watermark keyset cursor/≤200page가 있다. current field policy에 의해 money는 VIEW(amount/currency),MASK(REDACTED),OMIT의 closed discriminant다. bank/tax/evidence plaintext, token/private/lease/formula AST/owner payload는 general browser response에 나오지 않는다. access authorization과 entity projection field별 independent approval는 OPEN이다.

81 committed event payload는 operationId CONST로 서로 구분되며 owner-private PAY only다. 일반 public payline broadcast가 아니다. event subject/revision/resultRef/receiptId/digests/time는 actual commit outcome/RETURNING/captured clock에서 binding한다. 외부 소비 event wire successor/owner review는 별도이며 existing public provided-events history를 수정하지 않는다.

88 table specifications 중78 scoped tables에는 exact column/FK/native CREATE draft와 RLS SQL를 제시한다. RLS `dwp.tenant_id` missing/null은 deny다. runtime app는 Control/schema owner/migration principal이 아니며 no elevated role/no DDL/no SET ROLE/no foreign repositories다. cross-owner public UUID는 opaque typed ref, local BIGINT FK는 tenant-bound actual PUBLIC→LOCAL resolution 또는 exact new INSERT RETURNING이다. cross-DB/schema/repo FK는 없다.

중요 미완료: 모든 CHECK/state/valuechoice/everpublication range/exclusion/regular partial-index/append-only financial receipt/roleACL/business-source-restoration clauses를 통합한 **실행 가능한 exact successor migration SQL 승인**은 OPEN이다. 이 column/FK CREATE draft를 PostgreSQL/full migration PASS라고 부르지 않는다. successor SQL 설계를 완성하는 것은 G3; 실제 business migration 실행은 G4다.

Historical G2 42-table blob은 불변이다. rounding stage moved columns, typed native entry value columns, input BUILDING digest nullable→FROZEN nonnull guard, calculated_at rename, multiassignment uniqueness와 timestamps/versions의 source→target restoration 결정을 owner 승인해야 한다. 새88table 변경은 current allocation을 갱신해 REQUIRED_NOT_ALLOCATED로 관리한다. People47/48·Auth211/212·Platform231..237 occupied prefix를 business migration에 재사용하거나 G2 validator historical range를 늘려PASS시키지 않는다.

## 10. concrete A/B 작성자 검증

44 concrete instances(36 request bodies/8 owner responses)는 embedded custom closed-schema subset checker에서 AUTHOR_SUBSET_ONLY_PASS다. 함수는 JSON `authorValidation.fixtureSubsetCheckerJavaScript`에 있다. bind `const s=proposal.$defs`; `check(s[op.requestBodySchemaRef],body,path)` 및 `check(s[ownerSchemaRef],ownerbody,path)`로 검사한다. bare schema name를 $ref에 넣어 검사하지 않는다. registered full standards schema engine/independent source guard fixture validator는 아직 실행/승인하지 않았다.

Actual request payloads는 rounding5stage rules, workforce eligibility predicate, civil calendar, 4native input elements+formula dependency element, native base/flat/deduction/formula-basis entries, exact prepare/freeze/calculate/validate/manual payment draft다. formula basis100은 BASE3000이 아니라 INFORMATION elementUUID에 명시적으로 binding한다. full closed prerequisite entity/paygroup publication/approval/query/source receipt and all-negative journeys의 independent fixture coverage는 OPEN이다. UUID constants는 expected test allocator RETURNING outputs일 뿐 normal business-key UUID 변환이나 caller supplied create IDs가 아니다.

| invariant | A | B |
| --- | --- | --- |
| configured ratio100×rate | .125→12.5000 | .20→20.0000 |
| EARNING base+flat+formula | 3212.5000 TST | 3220.0000 TST |
| deductions/net | 100 /3112.5000 |100 /3120.0000 |
| ELEMENT tie1.005,scale2 | HALF_UP→1.01 | HALF_EVEN→1.00 |
| optional bank/country/PER | not selected; dependency rejectsifneeded | not selected; dependency rejectsifneeded |
| manual final claim | MANUALLY_RECORDED,notBANK_ACK | MANUALLY_RECORDED,notBANK_ACK |
| frozen fixture digest | 925f080c92690522efccec2b8f568d8f0be682ef1bac81c8a672370709d698d4 | def12159e814ad0d787bf52a2bf88fef1c7ea21fa5801c01b74201433a83a0dc |
| result fixture digest | 63bcbe64fdc75f75c2fe9d24bc5dc2d9fdeaa083219b7898c8973a79f199f431 | ff5e7d0eef4fec90e89387921de0cb2309fc3ffe7e79a338054c9998c33e0e54 |

TST is synthetic, not current statutory or production currency adoption. sorted UTF-8 canonical key digest includes actual nested immutable artifact/source digests; only each artifact's own digest slot is excluded. fixture expected frozen/result materialization hashes are author expectations, not actual producer receipt/source-graph proof. 13 Decimal expected checks PASS(allowance/gross/net/tie modes/offcycle/difference/fullpair/no originalmutations/manualnotbank); no business runtime executed. 11 structural checks and normalized method/path route uniqueness PASS;8machines allstates syntacticallyreachable. Guard satisfiability/source/SoD/privacy/physical SQL independent P0 CLOSED는 아니다.

## 11. exact operation scope

| operationId | surface/mode | method/path | request → response | planned writes/procedure |
| --- | --- | --- | --- | --- |
| pay.entity.version.create | PUBLIC/COMMAND | POST /v1/entity-versions | PAY.EntityCreate → PAY.Receipt | pay_config_artifact_versions, pay_legal_payroll_entities, pay_artifact_revision_counters; PAY.CREATE_TYPED_ARTIFACT |
| pay.entity.version.query | PUBLIC/QUERY | GET /v1/entity-versions/{artifactId} | none → PAY.Response.pay.entity.version.query | none; PAY.QUERY_TYPED_ARTIFACT |
| pay.entity.versions.query | PUBLIC/QUERY | GET /v1/entity-versions | none → PAY.Response.pay.entity.versions.query | none; PAY.LIST_TYPED_ARTIFACT |
| pay.paygroup.version.create | PUBLIC/COMMAND | POST /v1/paygroup-versions | PAY.PayGroupCreate → PAY.Receipt | pay_config_artifact_versions, pay_pay_groups, pay_artifact_revision_counters; PAY.CREATE_TYPED_ARTIFACT |
| pay.paygroup.version.query | PUBLIC/QUERY | GET /v1/paygroup-versions/{artifactId} | none → PAY.Response.pay.paygroup.version.query | none; PAY.QUERY_TYPED_ARTIFACT |
| pay.paygroup.versions.query | PUBLIC/QUERY | GET /v1/paygroup-versions | none → PAY.Response.pay.paygroup.versions.query | none; PAY.LIST_TYPED_ARTIFACT |
| pay.calendar.version.create | PUBLIC/COMMAND | POST /v1/calendar-versions | PAY.CalendarCreate → PAY.Receipt | pay_config_artifact_versions, pay_calendar_versions, pay_artifact_revision_counters; PAY.CREATE_TYPED_ARTIFACT |
| pay.calendar.version.query | PUBLIC/QUERY | GET /v1/calendar-versions/{artifactId} | none → PAY.Response.pay.calendar.version.query | none; PAY.QUERY_TYPED_ARTIFACT |
| pay.calendar.versions.query | PUBLIC/QUERY | GET /v1/calendar-versions | none → PAY.Response.pay.calendar.versions.query | none; PAY.LIST_TYPED_ARTIFACT |
| pay.rounding.version.create | PUBLIC/COMMAND | POST /v1/rounding-versions | PAY.RoundingCreate → PAY.Receipt | pay_config_artifact_versions, pay_rounding_policy_versions, pay_artifact_revision_counters, pay_rounding_policy_stage_rules; PAY.CREATE_TYPED_ARTIFACT |
| pay.rounding.version.query | PUBLIC/QUERY | GET /v1/rounding-versions/{artifactId} | none → PAY.Response.pay.rounding.version.query | none; PAY.QUERY_TYPED_ARTIFACT |
| pay.rounding.versions.query | PUBLIC/QUERY | GET /v1/rounding-versions | none → PAY.Response.pay.rounding.versions.query | none; PAY.LIST_TYPED_ARTIFACT |
| pay.eligibility.version.create | PUBLIC/COMMAND | POST /v1/eligibility-versions | PAY.EligibilityCreate → PAY.Receipt | pay_config_artifact_versions, pay_eligibility_policy_versions, pay_artifact_revision_counters; PAY.CREATE_TYPED_ARTIFACT |
| pay.eligibility.version.query | PUBLIC/QUERY | GET /v1/eligibility-versions/{artifactId} | none → PAY.Response.pay.eligibility.version.query | none; PAY.QUERY_TYPED_ARTIFACT |
| pay.eligibility.versions.query | PUBLIC/QUERY | GET /v1/eligibility-versions | none → PAY.Response.pay.eligibility.versions.query | none; PAY.LIST_TYPED_ARTIFACT |
| element.version.create | PUBLIC/COMMAND | POST /v1/element-versions | PAY.ElementCreate → PAY.Receipt | pay_config_artifact_versions, pay_element_versions, pay_artifact_revision_counters; PAY.CREATE_TYPED_ARTIFACT |
| pay.element.version.query | PUBLIC/QUERY | GET /v1/element-versions/{artifactId} | none → PAY.Response.pay.element.version.query | none; PAY.QUERY_TYPED_ARTIFACT |
| pay.element.versions.query | PUBLIC/QUERY | GET /v1/element-versions | none → PAY.Response.pay.element.versions.query | none; PAY.LIST_TYPED_ARTIFACT |
| formula.version.create | PUBLIC/COMMAND | POST /v1/formula-versions | PAY.FormulaCreate → PAY.Receipt | pay_config_artifact_versions, pay_formula_versions, pay_artifact_revision_counters, pay_formula_dependencies; PAY.CREATE_TYPED_ARTIFACT |
| pay.formula.version.query | PUBLIC/QUERY | GET /v1/formula-versions/{artifactId} | none → PAY.Response.pay.formula.version.query | none; PAY.QUERY_TYPED_ARTIFACT |
| pay.formula.versions.query | PUBLIC/QUERY | GET /v1/formula-versions | none → PAY.Response.pay.formula.versions.query | none; PAY.LIST_TYPED_ARTIFACT |
| pay.gl-mapping.version.create | PUBLIC/COMMAND | POST /v1/gl-mapping-versions | PAY.GlMappingCreate → PAY.Receipt | pay_config_artifact_versions, pay_gl_mapping_rule_versions, pay_artifact_revision_counters; PAY.CREATE_TYPED_ARTIFACT |
| pay.gl-mapping.version.query | PUBLIC/QUERY | GET /v1/gl-mapping-versions/{artifactId} | none → PAY.Response.pay.gl-mapping.version.query | none; PAY.QUERY_TYPED_ARTIFACT |
| pay.gl-mapping.versions.query | PUBLIC/QUERY | GET /v1/gl-mapping-versions | none → PAY.Response.pay.gl-mapping.versions.query | none; PAY.LIST_TYPED_ARTIFACT |
| pay.config.validate | PUBLIC/COMMAND | POST /v1/config-artifacts/{artifactId}/validate | PAY.ConfigValidate → PAY.Receipt | pay_config_artifact_versions, pay_config_evaluations; PAY.VALIDATE_TYPED_ARTIFACT |
| pay.config.simulate | PUBLIC/COMMAND | POST /v1/config-artifacts/{artifactId}/simulate | PAY.ConfigSimulate → PAY.Receipt | pay_config_artifact_versions, pay_config_golden_reports; PAY.SIMULATE_TYPED_ARTIFACT |
| pay.config.approval.submit | PUBLIC/COMMAND | POST /v1/config-artifacts/{artifactId}/approval-submit | PAY.ConfigApprovalRequest → PAY.Receipt | pay_config_artifact_versions, pay_config_approval_bindings; PAY.SUBMIT_ARTIFACT_APPROVAL |
| pay.config.publish | PUBLIC/COMMAND | POST /v1/config-artifacts/{artifactId}/publish | PAY.ConfigPublish → PAY.Receipt | pay_config_artifact_versions, pay_artifact_effective_publications; PAY.PUBLISH_TYPED_ARTIFACT |
| pay.config.retire | PUBLIC/COMMAND | POST /v1/config-artifacts/{artifactId}/retire | PAY.ConfigRetire → PAY.Receipt | pay_config_artifact_versions; PAY.RETIRE_ARTIFACT |
| pay.config.cancel | PUBLIC/COMMAND | POST /v1/config-artifacts/{artifactId}/cancel | PAY.Revoke → PAY.Receipt | pay_config_artifact_versions; PAY.CANCEL_DRAFT_ARTIFACT |
| pay.config.approval.apply | OWNER_INTERNAL/COMMAND | POST /internal/payroll/v1/config-artifacts/{artifactId}/approval-decisions | PAY.OwnerDecisionApply → PAY.Receipt | pay_config_artifact_versions, pay_config_approval_bindings; PAY.APPLY_ARTIFACT_OWNER_DECISION |
| pay.config.evaluation.query | PUBLIC/QUERY | GET /v1/config-evaluations/{evaluationId} | none → PAY.Response.pay.config.evaluation.query | none; PAY.QUERY_EVALUATION |
| pay.config.golden.query | PUBLIC/QUERY | GET /v1/config-golden-reports/{goldenReportId} | none → PAY.Response.pay.config.golden.query | none; PAY.QUERY_GOLDEN |
| pay.membership.create | PUBLIC/COMMAND | POST /v1/pay-group-memberships | PAY.MembershipCreate → PAY.Receipt | pay_group_memberships, pay_membership_revision_counters; PAY.ADMIT_MEMBERSHIP |
| pay.memberships.query | PUBLIC/QUERY | GET /v1/pay-group-memberships | none → PAY.Response.pay.memberships.query | none; PAY.QUERY_MEMBERSHIP |
| pay.period.materialize | PUBLIC/COMMAND | POST /v1/pay-periods/materializations | PAY.PeriodMaterialize → PAY.Receipt | pay_pay_periods; PAY.MATERIALIZE_CALENDAR_PERIODS |
| pay.period.query | PUBLIC/QUERY | GET /v1/pay-periods/{periodId} | none → PAY.Response.pay.period.query | none; PAY.QUERY_PERIOD |
| pay.period.lock | PUBLIC/COMMAND | POST /v1/pay-periods/{periodId}/input-lock | PAY.PeriodAction → PAY.Receipt | pay_pay_periods, pay_period_lock_bindings; PAY.LOCK_INPUT |
| pay.period.reopen | PUBLIC/COMMAND | POST /v1/pay-periods/{periodId}/reopen | PAY.RunReopen → PAY.Receipt | pay_pay_periods, pay_period_lock_bindings; PAY.REOPEN_PERIOD |
| worker.entry.create | PUBLIC/COMMAND | POST /v1/worker-entries | PAY.WorkerEntryCreate → PAY.Receipt | pay_worker_element_entries, pay_input_revision_counters; PAY.ADMIT_TYPED_WORKER_ENTRY |
| worker.entry.correct | PUBLIC/COMMAND | POST /v1/worker-entries/{entryId}/corrections | PAY.WorkerEntryCorrect → PAY.Receipt | pay_worker_element_entries, pay_worker_entry_correction_links, pay_input_revision_counters; PAY.CORRECT_ENTRY_SUCCESSOR |
| pay.worker.entries.query | PUBLIC/QUERY | GET /v1/worker-entries | none → PAY.Response.pay.worker.entries.query | none; PAY.QUERY_ENTRIES |
| run.prepare | PUBLIC/COMMAND | POST /v1/runs | PAY.RunPrepare → PAY.Receipt | pay_payroll_runs, pay_input_snapshots, pay_payroll_run_workers, pay_input_source_vectors, pay_input_source_ingest_receipts; PAY.PREPARE_PINNED_INPUT |
| pay.input.source.ingest | OWNER_INTERNAL/COMMAND | POST /internal/payroll/v1/runs/{runId}/sources/ingestions | PAY.InputIngest → PAY.Receipt | pay_input_source_ingest_receipts, pay_owner_snapshot_payloads, pay_input_source_vectors, pay_time_handoff_snapshots, pay_time_handoff_lines; PAY.INGEST_EXACT_OWNER_SOURCE |
| pay.run.input.freeze | PUBLIC/COMMAND | POST /v1/runs/{runId}/input-freeze | PAY.InputFreeze → PAY.Receipt | pay_input_snapshots, pay_payroll_runs, pay_payroll_run_workers; PAY.FREEZE_INPUT_VECTOR |
| pay.run.inputs.query | PUBLIC/QUERY | GET /v1/runs/{runId}/inputs | none → PAY.Response.pay.run.inputs.query | none; PAY.QUERY_FROZEN_INPUT |
| run.calculate | PUBLIC/COMMAND | POST /v1/runs/{runId}/attempts | PAY.AttemptStart → PAY.Receipt | pay_payroll_run_attempts, pay_run_attempt_counters, pay_payroll_runs; PAY.ENQUEUE_BOUNDED_CALCULATION |
| pay.attempt.claim | OWNER_INTERNAL/COMMAND | POST /internal/payroll/v1/attempts/{attemptId}/claims | PAY.AttemptClaim → PAY.Receipt | pay_payroll_run_attempts, pay_attempt_fences; PAY.CLAIM_ATTEMPT_FENCE |
| pay.attempt.heartbeat | OWNER_INTERNAL/COMMAND | POST /internal/payroll/v1/attempts/{attemptId}/heartbeats | PAY.AttemptHeartbeat → PAY.Receipt | pay_attempt_fences, pay_payroll_run_attempts; PAY.RENEW_ATTEMPT_FENCE |
| pay.attempt.commit | OWNER_INTERNAL/COMMAND | POST /internal/payroll/v1/attempts/{attemptId}/commits | PAY.AttemptCommit → PAY.Receipt | pay_payroll_run_attempts, pay_payroll_runs, pay_worker_results, pay_result_lines, pay_calculation_trace_nodes, pay_result_staging_manifests; PAY.COMMIT_FENCED_RESULTS |
| pay.attempt.fail | OWNER_INTERNAL/COMMAND | POST /internal/payroll/v1/attempts/{attemptId}/failures | PAY.AttemptFail → PAY.Receipt | pay_payroll_run_attempts, pay_payroll_runs, pay_result_staging_manifests; PAY.FAIL_OR_UNKNOWN_ATTEMPT |
| pay.attempt.query | PUBLIC/QUERY | GET /v1/attempts/{attemptId} | none → PAY.Response.pay.attempt.query | none; PAY.QUERY_ATTEMPT |
| pay.attempt.reconcile | PUBLIC/COMMAND | POST /v1/attempts/{attemptId}/reconciliation | PAY.LocalAttemptReconcile → PAY.Receipt | pay_payroll_run_attempts, pay_payroll_runs; PAY.RECONCILE_LOCAL_COMMIT_RECEIPT |
| run.query | PUBLIC/QUERY | GET /v1/runs/{runId} | none → PAY.Response.run.query | none; PAY.QUERY_RUN |
| run.results | PUBLIC/QUERY | GET /v1/runs/{runId}/results | none → PAY.Response.run.results | none; PAY.QUERY_RESULTS |
| run.worker.trace | PUBLIC/QUERY | GET /v1/runs/{runId}/workers/{workerId}/trace | none → PAY.Response.run.worker.trace | none; PAY.QUERY_PURPOSE_TRACE |
| run.validate | PUBLIC/COMMAND | POST /v1/runs/{runId}/validations | PAY.RunValidate → PAY.Receipt | pay_run_validation_reports, pay_reconciliation_issues, pay_payroll_runs; PAY.VALIDATE_RESULT_CONSERVATION |
| run.approve | PUBLIC/COMMAND | POST /v1/runs/{runId}/approval-requests | PAY.RunApprovalRequest → PAY.Receipt | pay_run_approval_bindings, pay_payroll_runs; PAY.SUBMIT_RUN_OWNER_APPROVAL |
| pay.run.approval.apply | OWNER_INTERNAL/COMMAND | POST /internal/payroll/v1/runs/{runId}/approval-decisions | PAY.OwnerDecisionApply → PAY.Receipt | pay_run_approval_bindings, pay_run_approvals, pay_payroll_runs; PAY.APPLY_RUN_OWNER_DECISION |
| run.finalize | PUBLIC/COMMAND | POST /v1/runs/{runId}/finalize | PAY.RunFinalize → PAY.Receipt | pay_payroll_runs, pay_run_finalization_receipts, pay_balance_ledger_entries, pay_input_revision_counters; PAY.FINALIZE_IMMUTABLE_FACTS |
| pay.run.amend | PUBLIC/COMMAND | POST /v1/runs/{runId}/amendments | PAY.RunAmend → PAY.Receipt | pay_payroll_runs, pay_input_snapshots, pay_run_successor_links; PAY.CREATE_UNFINALIZED_SUCCESSOR |
| pay.run.reopen | PUBLIC/COMMAND | POST /v1/runs/{runId}/reopens | PAY.RunReopen → PAY.Receipt | pay_run_reopen_requests, pay_run_successor_links, pay_payroll_runs; PAY.REOPEN_AS_SUCCESSOR |
| pay.run.cancel | PUBLIC/COMMAND | POST /v1/runs/{runId}/cancellation | PAY.RunCancel → PAY.Receipt | pay_payroll_runs; PAY.CANCEL_NONFINAL_RUN |
| retro.create | PUBLIC/COMMAND | POST /v1/retro-events | PAY.RetroCreate → PAY.Receipt | pay_retro_events; PAY.ADMIT_RETRO_IMPACT |
| pay.retro.query | PUBLIC/QUERY | GET /v1/retro-events/{retroId} | none → PAY.Response.pay.retro.query | none; PAY.QUERY_RETRO |
| correction.create | PUBLIC/COMMAND | POST /v1/runs/{runId}/corrections | PAY.CorrectionCreate → PAY.Receipt | pay_payroll_runs, pay_input_snapshots, pay_run_successor_links, pay_correction_basis_links; PAY.CREATE_FINAL_CORRECTION_SUCCESSOR |
| payment.create | PUBLIC/COMMAND | POST /v1/runs/{runId}/payment-batches | PAY.PaymentCreate → PAY.Receipt | pay_payment_batches, pay_payment_instructions; PAY.PREPARE_CANONICAL_PAYMENT |
| pay.payment.query | PUBLIC/QUERY | GET /v1/payment-batches/{batchId} | none → PAY.Response.pay.payment.query | none; PAY.QUERY_PAYMENT |
| pay.payment.validate | PUBLIC/COMMAND | POST /v1/payment-batches/{batchId}/validations | PAY.PaymentValidate → PAY.Receipt | pay_payment_batches, pay_reconciliation_issues; PAY.VALIDATE_CANONICAL_PAYMENT |
| pay.payment.approval.submit | PUBLIC/COMMAND | POST /v1/payment-batches/{batchId}/approval-requests | PAY.RunApprovalRequest → PAY.Receipt | pay_payment_approval_bindings, pay_payment_batches; PAY.SUBMIT_PAYMENT_APPROVAL |
| pay.payment.approval.apply | OWNER_INTERNAL/COMMAND | POST /internal/payroll/v1/payment-batches/{batchId}/approval-decisions | PAY.OwnerDecisionApply → PAY.Receipt | pay_payment_batches, pay_payment_approval_bindings; PAY.APPLY_PAYMENT_OWNER_DECISION |
| payment.release | PUBLIC/COMMAND | POST /v1/payment-batches/{batchId}/release | PAY.PaymentRelease → PAY.Receipt | pay_payment_batches, pay_payment_instructions, pay_settlement_invocations; PAY.RELEASE_LOGICAL_SETTLEMENT |
| pay.payment.manual.record | PUBLIC/COMMAND | POST /v1/payment-batches/{batchId}/manual-settlement-records | PAY.ManualSettlementRecord → PAY.Receipt | pay_settlement_receipts, pay_payment_batches, pay_payment_instructions; PAY.RECORD_MANUAL_PROOF_NOT_BANK_ACK |
| pay.payment.reconcile | PUBLIC/COMMAND | POST /v1/payment-batches/{batchId}/reconciliation | PAY.SettlementReconcile → PAY.Receipt | pay_settlement_receipts, pay_connector_receipts, pay_payment_batches, pay_payment_instructions; PAY.RECONCILE_AUTHORITATIVE_SETTLEMENT |
| pay.payment.cancel | PUBLIC/COMMAND | POST /v1/payment-batches/{batchId}/cancellation | PAY.Revoke → PAY.Receipt | pay_payment_batches; PAY.CANCEL_UNRELEASED_PAYMENT |
| pay.payment.reverse | PUBLIC/COMMAND | POST /v1/payment-batches/{batchId}/reversals | PAY.PaymentReverse → PAY.Receipt | pay_payment_batches, pay_payment_instructions, pay_payment_reversal_links; PAY.REVERSE_WITH_NEW_INSTRUCTIONS |
| gl.create | PUBLIC/COMMAND | POST /v1/runs/{runId}/gl-batches | PAY.GlCreate → PAY.Receipt | pay_gl_batches, pay_gl_lines; PAY.PREPARE_BALANCED_NATIVE_JOURNAL |
| pay.gl.query | PUBLIC/QUERY | GET /v1/gl-batches/{batchId} | none → PAY.Response.pay.gl.query | none; PAY.QUERY_JOURNAL |
| pay.gl.approval.submit | PUBLIC/COMMAND | POST /v1/gl-batches/{batchId}/approval-requests | PAY.RunApprovalRequest → PAY.Receipt | pay_gl_approval_bindings, pay_gl_batches; PAY.SUBMIT_GL_APPROVAL |
| pay.gl.approval.apply | OWNER_INTERNAL/COMMAND | POST /internal/payroll/v1/gl-batches/{batchId}/approval-decisions | PAY.OwnerDecisionApply → PAY.Receipt | pay_gl_approval_bindings, pay_gl_batches; PAY.APPLY_GL_OWNER_DECISION |
| gl.post | PUBLIC/COMMAND | POST /v1/gl-batches/{batchId}/post | PAY.GlPost → PAY.Receipt | pay_gl_batches, pay_settlement_invocations; PAY.POST_NATIVE_OR_ACTIVATED_JOURNAL |
| pay.gl.reconcile | PUBLIC/COMMAND | POST /v1/gl-batches/{batchId}/reconciliation | PAY.SettlementReconcile → PAY.Receipt | pay_gl_batches, pay_settlement_receipts, pay_connector_receipts; PAY.RECONCILE_ERP_RECEIPT |
| pay.gl.reverse | PUBLIC/COMMAND | POST /v1/gl-batches/{batchId}/reversals | PAY.PaymentReverse → PAY.Receipt | pay_gl_batches, pay_gl_lines, pay_gl_reversal_links; PAY.REVERSE_NEW_BALANCED_JOURNAL |
| pay.issues.query | PUBLIC/QUERY | GET /v1/reconciliation-issues | none → PAY.Response.pay.issues.query | none; PAY.QUERY_BLOCKERS |
| pay.issue.resolve | PUBLIC/COMMAND | POST /v1/reconciliation-issues/{issueId}/resolutions | PAY.IssueResolve → PAY.Receipt | pay_reconciliation_issues, pay_issue_resolution_events; PAY.RESOLVE_WITH_OWNER_EVIDENCE |
| pay.payslip.publish | PUBLIC/COMMAND | POST /v1/runs/{runId}/payslip-publications | PAY.PayslipPublish → PAY.Receipt | pay_payslips; PAY.PUBLISH_IMMUTABLE_STATEMENT |
| payslip.query | PUBLIC/QUERY | GET /v1/payslips/{payslipId} | none → PAY.Response.payslip.query | none; PAY.QUERY_VERIFIED_SELF_STATEMENT |
| payslip.download | PUBLIC/COMMAND | POST /v1/payslips/{payslipId}/download-grants | PAY.Download → PAY.Receipt | pay_payslip_access_events; PAY.ISSUE_GOVERNED_OBJECT_GRANT |
| pay.payslip.revoke | PUBLIC/COMMAND | POST /v1/payslips/{payslipId}/revocations | PAY.Revoke → PAY.Receipt | pay_payslips; PAY.REVOKE_DOCUMENT_AUTHORITY |
| country.pack.activate | PUBLIC/COMMAND | POST /v1/country-packs/{packId}/activate | PAY.PackActivate → PAY.Receipt | pay_country_pack_versions; PAY.ACTIVATE_PACK_WITH_G6_EVIDENCE |
| pay.pack.install | PUBLIC/COMMAND | POST /v1/country-packs/installations | PAY.PackInstall → PAY.Receipt | pay_country_pack_versions; PAY.INSTALL_COMPATIBLE_DISABLED_PACK |
| pay.pack.query | PUBLIC/QUERY | GET /v1/country-packs/{packId} | none → PAY.Response.pay.pack.query | none; PAY.QUERY_PACK |
| command.receipt.query | PUBLIC/QUERY | GET /v1/command-receipts/{receiptId} | none → PAY.Response.command.receipt.query | none; PAY.REAUTHORIZE_SEALED_RECEIPT |
| pay.retirement.basis.create | PUBLIC/COMMAND | POST /v1/retirement-bases | PAY.RetirementBasisCreate → PAY.Receipt | pay_retirement_basis_versions, pay_retirement_basis_source_refs, pay_artifact_revision_counters; PAY.ADMIT_RETIREMENT_BASIS |
| pay.retirement.basis.query | PUBLIC/QUERY | GET /v1/retirement-bases/{basisId} | none → PAY.Response.pay.retirement.basis.query | none; PAY.QUERY_RETIREMENT_BASIS |
| pay.retirement.case.create | PUBLIC/COMMAND | POST /v1/retirement-cases | PAY.RetirementCaseCreate → PAY.Receipt | pay_retirement_cases; PAY.CREATE_RETIREMENT_CASE |
| pay.retirement.case.query | PUBLIC/QUERY | GET /v1/retirement-cases/{caseId} | none → PAY.Response.pay.retirement.case.query | none; PAY.QUERY_RETIREMENT_CASE |
| pay.retirement.case.validate | PUBLIC/COMMAND | POST /v1/retirement-cases/{caseId}/validations | PAY.CaseValidate → PAY.Receipt | pay_case_validation_reports, pay_retirement_cases; PAY.VALIDATE_RETIREMENT_ELIGIBILITY |
| pay.retirement.case.calculate | PUBLIC/COMMAND | POST /v1/retirement-cases/{caseId}/calculations | PAY.CaseCalculate → PAY.Receipt | pay_retirement_cases, pay_case_outputs, pay_case_output_lines; PAY.CALCULATE_OPTIONAL_RETIREMENT_PACK |
| pay.retirement.case.review | PUBLIC/COMMAND | POST /v1/retirement-cases/{caseId}/reviews | PAY.CaseReview → PAY.Receipt | pay_case_approval_bindings, pay_retirement_cases; PAY.REVIEW_RETIREMENT_OUTPUT |
| pay.retirement.case.post | PUBLIC/COMMAND | POST /v1/retirement-cases/{caseId}/postings | PAY.CasePost → PAY.Receipt | pay_case_posting_links, pay_payroll_runs, pay_retirement_cases, pay_input_snapshots, pay_input_source_vectors, pay_payroll_run_workers; PAY.POST_APPROVED_CASE_TO_NEW_RUN |
| pay.retirement.case.correct | PUBLIC/COMMAND | POST /v1/retirement-cases/{caseId}/corrections | PAY.CaseCorrect → PAY.Receipt | pay_retirement_cases, pay_case_successor_links; PAY.CORRECT_CASE_NEW_BASIS_SUCCESSOR |
| pay.retirement.case.cancel | PUBLIC/COMMAND | POST /v1/retirement-cases/{caseId}/cancellation | PAY.Revoke → PAY.Receipt | pay_retirement_cases; PAY.CANCEL_UNPOSTED_CASE |
| pay.yearend.basis.create | PUBLIC/COMMAND | POST /v1/year-end-bases | PAY.YearEndBasisCreate → PAY.Receipt | pay_year_end_basis_versions, pay_year_end_basis_source_refs, pay_artifact_revision_counters; PAY.ADMIT_YEAR_END_BASIS |
| pay.yearend.basis.query | PUBLIC/QUERY | GET /v1/year-end-bases/{basisId} | none → PAY.Response.pay.yearend.basis.query | none; PAY.QUERY_YEAR_END_BASIS |
| yearend.case.create | PUBLIC/COMMAND | POST /v1/year-end-cases | PAY.YearEndCaseCreate → PAY.Receipt | pay_year_end_cases; PAY.CREATE_TYPED_YEAR_END_CASE |
| pay.yearend.case.query | PUBLIC/QUERY | GET /v1/year-end-cases/{caseId} | none → PAY.Response.pay.yearend.case.query | none; PAY.QUERY_YEAR_END_CASE |
| yearend.evidence.add | PUBLIC/COMMAND | POST /v1/year-end-cases/{caseId}/evidence | PAY.YearEndEvidenceAdd → PAY.Receipt | pay_year_end_evidence, pay_year_end_cases; PAY.ADMIT_VERIFIED_YEAR_END_EVIDENCE |
| pay.yearend.case.validate | PUBLIC/COMMAND | POST /v1/year-end-cases/{caseId}/validations | PAY.CaseValidate → PAY.Receipt | pay_case_validation_reports, pay_year_end_cases; PAY.VALIDATE_YEAR_END_COVERAGE |
| yearend.provider.submit | PUBLIC/COMMAND | POST /v1/year-end-cases/{caseId}/provider-submissions | PAY.YearEndSubmit → PAY.Receipt | pay_year_end_provider_invocations, pay_year_end_cases; PAY.SUBMIT_ONE_LOGICAL_YEAR_END_INVOCATION |
| pay.yearend.provider.reconcile | PUBLIC/COMMAND | POST /v1/year-end-cases/{caseId}/provider-reconciliation | PAY.YearEndReconcile → PAY.Receipt | pay_year_end_provider_invocations, pay_case_outputs, pay_case_output_lines, pay_year_end_cases; PAY.RECONCILE_YEAR_END_OWNER_RESULT |
| pay.yearend.case.review | PUBLIC/COMMAND | POST /v1/year-end-cases/{caseId}/reviews | PAY.CaseReview → PAY.Receipt | pay_case_approval_bindings, pay_year_end_cases; PAY.REVIEW_YEAR_END_OUTPUT |
| pay.yearend.case.post | PUBLIC/COMMAND | POST /v1/year-end-cases/{caseId}/postings | PAY.CasePost → PAY.Receipt | pay_case_posting_links, pay_payroll_runs, pay_year_end_cases, pay_input_snapshots, pay_input_source_vectors, pay_payroll_run_workers; PAY.POST_APPROVED_CASE_TO_NEW_RUN |
| pay.yearend.case.correct | PUBLIC/COMMAND | POST /v1/year-end-cases/{caseId}/corrections | PAY.CaseCorrect → PAY.Receipt | pay_year_end_cases, pay_case_successor_links; PAY.CORRECT_CASE_NEW_BASIS_SUCCESSOR |
| pay.yearend.case.cancel | PUBLIC/COMMAND | POST /v1/year-end-cases/{caseId}/cancellation | PAY.Revoke → PAY.Receipt | pay_year_end_cases; PAY.CANCEL_UNPOSTED_CASE |
| pay.case.output.query | PUBLIC/QUERY | GET /v1/case-outputs/{outputId} | none → PAY.Response.pay.case.output.query | none; PAY.QUERY_CASE_OUTPUT |
| pay.approval.cancel | PUBLIC/COMMAND | POST /v1/payroll-approvals/{subjectId}/cancellation | PAY.ApprovalCancellation → PAY.Receipt | pay_approval_cancellation_requests; PAY.REQUEST_OWNER_APPROVAL_CANCELLATION |
| pay.approval.reconcile | OWNER_INTERNAL/COMMAND | POST /internal/payroll/v1/payroll-approvals/{subjectId}/cancellation-reconciliation | PAY.OwnerCancellationApply → PAY.Receipt | pay_approval_cancellation_requests; PAY.RECONCILE_OWNER_APPROVAL_CANCELLATION |
| pay.input.source.invalidate | OWNER_INTERNAL/COMMAND | POST /internal/payroll/v1/input-snapshots/{inputSnapshotId}/invalidations | PAY.SourceInvalidation → PAY.Receipt | pay_input_snapshots, pay_payroll_runs, pay_retro_events, pay_source_invalidation_facts; PAY.INVALIDATE_UNFINALIZED_OR_ASSESS_FINAL_RETRO |

### Historical route dispositions

- payroll.widget.summary: RETAIN_UNVERIFIED_SCOPE. Historical widget/foundation aggregate/format download/export exact field projection and platform source restoration not independently certified by this bounded design
- foundation.query: RETAIN_UNVERIFIED_SCOPE. Historical widget/foundation aggregate/format download/export exact field projection and platform source restoration not independently certified by this bounded design
- foundation.version.create: REMOVE. digest-only generic create replaced by closed kind-specific entity/paygroup/calendar/rounding/eligibility APIs
- formula.validate: REMOVE. Replaced by shared exact typed-artifact phases pay.config.validate with artifactKind=FORMULA and explicit formula branch; no second independent lifecycle
- formula.simulate: REMOVE. Replaced by shared exact typed-artifact phases pay.config.simulate with artifactKind=FORMULA and explicit formula branch; no second independent lifecycle
- formula.publish: REMOVE. Replaced by shared exact typed-artifact phases pay.config.publish with artifactKind=FORMULA and explicit formula branch; no second independent lifecycle
- payment.file.download: RETAIN_UNVERIFIED_SCOPE. Historical widget/foundation aggregate/format download/export exact field projection and platform source restoration not independently certified by this bounded design
- insight.export: RETAIN_UNVERIFIED_SCOPE. Historical widget/foundation aggregate/format download/export exact field projection and platform source restoration not independently certified by this bounded design

## 12. exact remaining risks/closing conditions

- PAY_G3_P0_001 [HARD_G3_P0/OPEN] Exact owner-contract integration: 34readDTO/source requirements require actual owner registration/history-query source/identitysemanticBinding/producer-consumer DTO+SPI+shared failclosed adapter+compile;schema names/ownerResponse labels notapproval
- PAY_G3_P0_002 [HARD_G3_P0/OPEN] Canonical self identity successor: Reuse Auth com_users.person_public_id→verified gateway X-DWP-Person-Public-ID→People person/worker/relationships/assignment; current PrincipalVerificationReceipt lacks personownerbindingproof and PeopleactorLIMIT1 isnotmulticontext. Publish signedversioned Authpersonproof+externalPeopleemploymentcontext projection; actualcustomerbootstrapG6 notG3blocker
- PAY_G3_P0_003 [HARD_G3_P0/OPEN] Normalized operation-specific mutation sourcegraphs: Initial per-column semanticrules and request/load/refetch/clock/allocator/CAS/RETURNING roots areplanned. Each state/write operation still needs full normalized fielddependencygraph to actual prestate/guardedoutcome/returned rows; no genericcolumnRULE+tenant/actor-only sources counts as closure;strict semanticvalidatorNOT_RUN/NO_PASS
- PAY_G3_P0_004 [HARD_G3_P0/OPEN] Complete exact successor physical SQL: 78scoped CREATEcolumn/FK/RLS drafts plussemanticconstraint specs notexecutable migrationapproval; allstateCHECK/valuechoice/exclusion/regularpartialindex/everpublication/appendonlymonetaryreceipt guards mustmaterializeexactplannedSQL independently; do not postpone designmissingclauses toG4
- PAY_G3_P0_005 [HARD_G3_P0/OPEN] Migration/source restoration allocation: Preserve42historicalPAYG2tableblobs/currentcommonprefix;assign88spec changes45/46new successor migrations safely separateexistingranges. People47/48occupied/Auth211/212/Platform231..237consumed notreassign. Removedroundingfields→stagechildren, inclusiveperiodwire, calculated_at rename andmultiassignment constraints require source-restoration decision approvals, notcounterpassing
- PAY_G3_P0_006 [HARD_G3_P0/OPEN] Config authority /13streams: SYS13stream topology ROOT_ARCHITECTURE_DECISION_PROPOSED notCURRENT_PUBLISHED;new platform-hris-configuration DTO/SPI/op source,distinctDS/login/schema/history+actualemptyBootstrap/controlreceipt/sharedguard/pilotOPEN. Scalar8/9v2 evidence not13proof;PAY ownbusinessartifact content vsSYSscope/version/governance exactsuccessor integration
- PAY_G3_P0_007 [HARD_G3_P0/OPEN] Source-family restoration beyond generic run: 119retirement parents/34YEA parents/KRtax/insurance sourcechildren not independently mapped to exactcasebasis/eligibility/history/correction/object/output variants here; decisioncounts/old18dispositions notfullsemanticcertification. Nativegenericpack/providerSPI+disabled failclosed+sourcecoverage schemaG3; realofficiallaw/partnerG6
- PAY_G3_P0_008 [HARD_G3_P0/OPEN] Retained historical/API semantic scope: 4retained publicoperations widget/foundation-summary/payment-file-download/export and10retained historicaltables remainUNVERIFIED; BASE-PER+BASE-HRM exactplans alsoseparatemissing. Notall86/five-moduleREADY
- PAY_G3_P0_009 [HARD_G3_P0/OPEN] Independent oracle/fixture and compile: 44request/ownerinstances customsubset schema check +13expected Decimal values notnative119APIruntime orindependentapproval; registeredreal standardsvalidator+semanticstate/source/privacy/ownercontracts+actualsharedconsumercompile/pilot stillOPEN
- PAY_G3_P0_010 [HARD_G3_P0/OPEN] Approval/settlement/revocation successor detail: Exactcancelowneroutcome/selfentitlement/refetch constraints planned; genericGL owner-cancel knownoutcome→CANCELLED state notallocated, casevalidationfailure correction/rejection/finality source-disposition andDocument grant revocationunknown completecontract require ownerfollowup. Neverfalsecomplete onunknown
- PAY_G4_SCOPE_001 [G4_IMPLEMENTATION/OPEN] Domain implementation and native journeys: ActualdomainCRUD/migrations/materializedrows/ownerrefetch/events/receipts/recovery/load/regular-offcycle-retro-correction/manualpayout/GL/yearendshell APIs implemented inG4; not requiredcompletedbeforecodingG3
- PAY_G6_SCOPE_001 [G6_PRODUCTION/OPEN] Production statutory/bank/customer adoption: Realcustomeridentitybootstrap/adoption/parallelpay,officiallegalvalues/retirement-YEAstatutoryapproval,bank/ERP/YEAprovider actualactivation/conformancecredential/legal/DR remainG6; do not hardcodeorpretend optionalcorecoverage

## 13. input bytes preserved

| input | SHA256 |
| --- | --- |
| session-evidence/pay/g2-api-event-contracts.json | 040e64703871582aaff04f102495592f405a603f690ed4f8a20029981eee3a21 |
| session-evidence/pay/g2-transport-schemas.v1.json | d88d7b37ebda7d9abb6eb9e8aa0032bf0344a6dccc65d7d3d8b88abb06d037fd |
| session-evidence/pay/synthetic-golden-fixtures.json | fbf1830e3f2615acc410e87c832fab44a45bd20586fcd1f19b5f86ff7a9ee9e4 |
| session-evidence/pay/g2-physical-schema.sql | 23662d7daa89f0a6e5b4eaa754a96184d0a5fc688b4a6bc790e62fbaf428b3f0 |
| session-evidence/pay/g2-service-boundary.md | 639f75ac3d5153cc6ca10a01a52a2c04f2e00f1331c5e3bcf4902b605400d8b0 |
| session-evidence/pay/g2-runtime-controls.md | 89f1440778d1aedd46a3839138a2f0920605e4d7326441e5771f875b29fad551 |
| session-evidence/pay/g1-characterization.md | ec53f886eff6a245b59e4431af4a1cbc6d12c51002f129a0271099b2f19e6f37 |
| session-evidence/pay/g1-decision-log.csv | 83f79a95d1b05c821ad6672962dc22ca9de1c53dd0e412d2a59ee1f057851ef3 |
| coding-readiness/cross-module-canonical-schemas.v1.json | 6221da1de36e397d5d52ac2bde1b68f3116b79a96c66a48bdefa14f261c29d71 |
| coding-readiness/reports/base-scope-business-readiness-audit-2026-09-14.json | b0785ae509688a3094db999b2da4c25f95b7ad86e555f72a417d42b1fdba692d |
| coding-readiness/g3-file-allocation-register.csv | adfe95e90c2df54df471ab757a1af83e5febaf4a2cd1f9c9c4dc84a763c3923d |
| coding-readiness/semantic-remediation/g3-preparation-boundary.md | a6f545e28788d688c5bb0460be18f9dc2e00462f228e028f6152e68243ccb4f7 |
| coding-readiness/semantic-remediation/sys-stream-authority-decision.proposal.v1.md | 4be3e9a506387c463cfea1f7d1584a10ec1fd65ce689dfb897bf0b2d4c0081a1 |

부모/root가 common owner integration·actual shared compile/runtime proof·Gate seal을 담당한다. 이 작성자는 두 proposal 파일만 추가했고 original historical/Gates/centralrules/BEFE/source/worktrees/DB/container/process/commit를 변경하지 않았다. 새 JSON/MD가 저장됐다는 이유로 Gate를 열지 않는다.
