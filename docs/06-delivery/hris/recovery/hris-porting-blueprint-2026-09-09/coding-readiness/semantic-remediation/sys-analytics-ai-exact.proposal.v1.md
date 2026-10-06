# SYS People Analytics / Governed AI exact successor fragment

상태: DESIGN_PROPOSED_NOT_CANONICAL_NOT_INDEPENDENTLY_APPROVED. G3 CLOSED 유지. 이 문서는 작성자 설계 설명이며 별도 독립 감사 결과나 업무 구현 완료 증명이 아니다.

## 합성 범위와 단계

[typed JSON](sys-analytics-ai-exact.proposal.v1.json)은 ROOT SYS/TIM v1의 PeopleAnalytics 11개 + GovernedAI 9개 operation을 대체할 **추가 successor 합성 입력**이다. ROOT v1, 역사적 modern v1/PER v2, 정본 register/validator, backend 파일을 수정하지 않았다. BASE86 전체 의미 무결성은 이 작업에서 인증하지 않았다.

최종 범위는 기존 20개 identity를 보존한 45개 operation(32 authenticated public / 13 authenticated internal), 26개 proposed physical tables, 141개 closed record/request/event schema, 24개 owner port, 6개 business state machine, 32개 최소 lifecycle event, 160개 named typed derivation, 서로 다른 synthetic config 2종 및 expected case 28개다. Operation/migration/table 수를 100개에 맞추기 위한 병합은 하지 않았다.

- G3: 정확한 설계의 canonical 합성, 실제 공유 DTO/SPI·fail-closed adapter·qualifier guard·13-stream composite authority/receipt·빈 승인 schema/role/stream·consumer compile·현재 common/pilot runtime·5 paired-session 자원 증거가 필요하다.
- G4: 이 fragment의 domain migrations/CRUD/worker/read model 및 28 case의 실제 실행. 전체 업무 구현을 G3 준비 개방의 선행조건으로 요구하지 않는다.
- G5: G4 이후 mandatory full-screen Design AI handoff. Loading/empty/unavailable/denied/unknown/cancelled/suppressed/expired를 포함한다. Home widget-only와 7-workbench IA를 유지한다.
- G6: 실제 고객 authority/privacy/country/model/provider/data-processing 승인, 기존 DB adoption/cutover, 필요시 dedicated Insights process isolation. Production runtime artifact에는 migration credentials/DS/DDL 실행 경로가 없어야 한다.

작성 시 capability 입력 snapshot은 ROOT JSON SHA-256 708e48cd06a53fdd5655c80baf740bc3e3b2c824c83e82899358478ae4bdd4de이었다. ROOT는 동시 작업 중이며 마지막 관측 root 전체 SHA-256은 261b9d7b987e93cfe817a32b7e20e465ba4e502cbf5ad161bd51d18f7e08e25e이다. 이를 같은 bytes로 주장하지 않는다. 합성자는 ROOT 최신 파일과 본 fragment의 capability override를 명시적으로 조합해야 한다. Authority 결정안 관측 SHA-256은 4be3e9a506387c463cfea1f7d1584a10ec1fd65ce689dfb897bf0b2d4c0081a1이다.

## 배포·저장·신원 경계

ROOT A 기본 경로를 따른다. 기존 8 service / 9 scalar stream을 보존하고 Platform configuration/protected/insights 3개와 Auth participation issuer 1개를 추가하는 **8 service / 13 stream** 설계다. 기존 8/9 실행 receipt에 private 이름을 붙이는 것으로 supplemental authority를 허용하지 않는다.

| 소유 authority | 이 fragment의 데이터 | 금지 |
| --- | --- | --- |
| platform-hris-configuration / hris_configuration | Metric definition/version/full payload/field registry/validation; AI policy/version/full payload/emergency epoch/phase permits; owner control requests; privacy publication epoch/receipt | primary public credential fallback, local BIGINT의 Insights 복사, foreign entity/repository import |
| platform-hris-insights / hris_insights | Frozen minimal fact/source projection, metric values, projection/export/result/artifact, AI evaluation/assistance/provenance, jobs/attempts, Insights command receipt | configuration table SELECT/FK, ingestion raw response SELECT, raw prompt의 durable queue/event/log |
| protected admission / issuer | ROOT 별도 owner; listening safe fixed aggregate package와 token 발급 경계만 연결 | 분석 role의 protected raw SELECT, respondent/worker/token/issuer trace의 분석 전달 |

최신 authority에는 13 stream과 14 runtime purpose가 있으며 Insights의 query/write가 별도다. INSIGHTS_QUERY는 hrisInsightsQueryDataSource/readOnly=true/SELECT-only direct LOGIN이고 metadata/result allowlisted columns만 읽는다. Frozen source facts, instruction HMAC/provider execution key, private encrypted locator/jobs/control history에는 SELECT가 없다. INSIGHTS_EXECUTION_WRITE는 hrisInsightsExecutionDataSource/readOnly=false/정확한 owner DML direct LOGIN이다. Query를 writer qualifier로 바꾸거나 raw byte locator를 직접 읽지 않으며 restricted artifact owner SPI의 현재 gated refetch만 사용한다. Query audit/permit/budget 쓰기는 별도 실제 owner port duty로 수행하고 query DS에 INSERT를 부여하지 않는다.

Analytics/AI는 configuration+insights만 필요하며 Listening/protected/issuer 설치를 강제하지 않는다. EMPLOYEE_LISTENING만 configuration+protected+issuer+insights pair를 요구한다. Configuration-only 배포도 가능하고 disabled purpose DS는 connection0이어야 한다. Existing8/9 증거는 이 distinct-principal14purpose bootstrap 증거가 아니다.

각 stream은 목적별 dedicated direct LOGIN DS/runtime principal과 별도 external Control migration authority를 가진다. App는 SET ROLE, schema/role/extension CREATE, foreign history/control receipt DML을 할 수 없다. 같은 JVM의 여러 purpose DS는 **SQL least privilege이지 process-compromise 격리가 아니다**. 필요시 같은 port를 유지해 dedicated Insights extraction을 선택한다. DB 관리자/역할 공모, 네트워크 timing, 식별 free text의 잔여 위험을 지우지 않는다.

tenant/caller는 검증된 signed context만 사용한다. Auth.Principal owner/actor UUID는 생성 시 authenticated principal에서 오며 metric/policy/path UUID를 복사하지 않는다. Business UUID는 owner transaction에서 생성·저장한 실제 public_id다. Correlation ID는 trace-only다. FK는 같은 owner의 tenant-bound local FK만 사용한다.

## Analytics: typed content → exact calculation → gated publication

MetricDefinitionPayload.v2의 전체 strict typed canonical payload를 immutable payload table에 보존한다. Digest는 무결성 검사이며 원문 대체가 아니다. 등록된 field registry는 실제 owner read operation/schema·grain·field/type/unit/UUID entity·currency·purpose/sensitivity를 명시해야 한다. 고객별 회사/조직/측정값 설정은 versioned registry/config로 바꾸지만 임의 SQL, expression, 자유 Map, 미등록 owner contract는 허용하지 않는다.

Aggregation은 폐쇄 oneOf다.

| kind | 필수 operand | 계산 |
| --- | --- | --- |
| COUNT | distinct registered grain key | 유일 grain 수; 별도 count 공개 정책 필요 |
| SUM | value operand | exact decimal sum |
| WEIGHTED_MEAN | value + nonnegative weight | sum(value × weight) / sum(weight) |
| RATIO | compatible numerator + denominator | exact ratio; denominator 0은 UNDEFINED / null, 0으로 대체 금지 |

Filter는 STRING/DECIMAL/BIGINT/DATE/INSTANT/ENUM/PUBLIC_UUID/BOOLEAN 폐쇄 union이다. EQ=1, IN=distinct 1..100, BETWEEN=동일 type의 ordered 2개, null predicate=0개다. Field registry 타입/nullable/filterable/scope/entity를 확인한다. HTTP query의 알려진 optional key 부재는 typed null로 정규화하고 duplicate/unknown/float/plus/whitespace를 거부한다.

Money는 REJECT_MIXED 또는 ISO currency별 partition이다. 암묵적 FX나 통화 합계는 없다. Precision ≤38, scale ≤12, immutable metric version에 고정된 지원 정책 HALF_EVEN 또는 HALF_UP을 final rounding에 적용하며 intermediate arithmetic를 조기 NUMERIC(38)로 절단하지 않는다. Final overflow는 실패다. Exact decimal string은 exponent/plus/leading-zero/whitespace와 signed-zero 비정규 표현을 금지한다.

Window는 EFFECTIVE_AS_OF / owner-resolved POSTED_PERIOD / EVENT_INTERVAL oneOf다. Cutoff/end-exclusive/timezone 및 source mode가 definition과 일치해야 한다. Frozen immutable owner ref는 exact entity/public UUID/version/schema/digest와 실제 typed content를 refetch한다. HRM employment/assignment, TIM approved time/leave, PAY finalized money/period, PER verified outcomes/skills의 소유권을 혼합하지 않는다. Cross-domain availability를 HRM의 존재하지 않는 snapshot이라고 표현하지 않는다.

Queued projection은 requested source refs/window/cohort/metric version를 영속화한다. Worker는 모든 requested source의 complete minimal typed fields 및 unique grain을 검증한다. 결과 group은 canonical dimension tuple + currency total order로 유일하다. Correction은 새 run이며 old result/asOf를 갱신하지 않는다.

Privacy는 한 input batch만 보는 threshold 검사로 끝나지 않는다. Source owner가 실제 publication batch의 안정적인 HMAC key, 허용 complete package/dimension/window/정책 증거를 서명한다. Alternative cohort/snapshot UUID로 같은 batch 예산을 초기화할 수 없다. Config privacy owner가 batch+policy epoch+window bucket을 stable order로 lock하고 reserve/consume를 원자 처리한다. Listening은 FIXED_PACKAGE_ONLY, epoch당 단일 complete aggregate package를 기본으로 하며 임의 narrowed/repeated-different query를 거부한다. 다른 owner의 disjoint package는 실제 승인된 owner 증거가 있을 때만 허용한다. Raw member/answer set을 configuration/insights에 보내지 않는다.

PUBLICATION_ALLOWED consume를 확인하기 전 COMPLETED/public values가 없고, gate unavailable/unknown이면 fail closed다. SUPPRESSED는 values empty와 safe reason만 반환한다. Adequate라도 precise participantCount/subjectCount를 노출하지 않는다. COUNT metric 값도 pinned privacy policy가 해당 measure 공개를 별도로 승인할 때만 허용하며 cohort metadata count와 구분한다. Export/query replay도 current policy/epoch/fingerprint/result를 재검증한다.

## Analytics API / 상태 / export

기존 11 identity의 exact public routes는 JSON operations/apiContract에 있다. Configuration prefix는 /api/platform/v1/hris/configuration/analytics, execution prefix는 /api/platform/v1/hris/insights/analytics다.

추가 public operation은 metric.version.get, metric.draft.replace, metric.revise, projection.status, projection.cancel이다. Draft correction은 새 full payload를 append하고 CAS pointer를 교체한다. Validation/approval를 무효화하며 old payload/root owner/key/createdAt/effective window는 보존한다. Stale CAS는 전체 rollback, orphan payload 0이다. Publish는 exact PASSED validation + target-bound current approval + maker/checker + effective non-overlap이 필요하다. Revise는 별도 NEW DRAFT, prior published version은 그대로다.

Projection QUEUED → RUNNING → COMPLETED/SUPPRESSED/FAILED/RESULT_UNKNOWN, 별도 cancellation fence를 가진다. Export PENDING → RUNNING → COMPLETED/FAILED/RESULT_UNKNOWN/CANCELLED → EXPIRED를 명시한다. Pending/unknown 상태에 object digest/artifact/row count/calculated timestamp를 만들어 넣지 않는다.

Export는 tenant/current caller/original purpose, 모든 projection field/privacy/DLP 및 expiry를 create/finalize/download 시 재검증한다. Receipt/artifact UUID는 bearer download token이 아니다. JSON의 fixed typed export row fields는 metricKey/window/dimensions/currency/valueState/value/outputUnit이며 unselected field는 required null이다. CSV는 같은 fixed field order·canonical typed nested value·quote/CRLF/UTF-8/formula escape를 사용한다. Bytes는 restricted artifact owner에서 실제 refetch하고 schema/hash/length를 검증한다. Arbitrary object URI 또는 digest만으로 COMPLETED를 승인하지 않는다. Storage upload와 DB transaction은 원자적이지 않으므로 final auth/CAS 실패 시 object revoke/cleanup를 수행한다.

## Governed AI: policy/evaluation/assist의 서로 다른 객체

AI root owner/useCaseKey는 immutable이고 version payload는 strict typed AiPolicyPayload.v2다. Policy DRAFT → EVALUATING → EVALUATED → ACTIVE → SUSPENDED/RETIRED이며 평가 실패는 DRAFT로 돌아간다. Failed draft를 실제 수정할 수 있는 policy.draft.replace를 추가했다. Revise는 prior ACTIVE/SUSPENDED와 원 owner/timestamps/status를 변경하지 않고 NEW DRAFT를 생성한다.

Mutable aggregate CAS version과 immutable business version_no를 분리한다. VersionRef.revision은 version_no이고 contentDigest는 exact payload다. State transition이 CAS token을 바꿨다고 immutable source pin이 깨지거나 임의 과거 digest를 최신 content로 가장하지 않는다. EVALUATING 중 payload 편집은 금지한다.

Model/suite/evaluation test artifact/template은 서로 다른 typed owner entity다. Test artifact를 instruction template UUID로 대체하지 않는다. Actual evaluator metric key/unit/sample coverage/evidence와 refetched suite의 exact blocking bounds로 PASSED/FAILED를 서버에서 유도한다. Caller pass=true, digest만 있는 evaluation, unknown job은 게시 승인 근거가 아니다. Config evaluate와 Insights run은 다른 authority이므로 durable owner control/outbox + signed callback + exact result refetch를 사용한다. Transport unknown은 RESULT_UNKNOWN receipt이고 policy는 EVALUATING, no success artifact다.

Publish는 exact policy payload/model/suite/real evaluation/result + current target-bound four-eyes receipt를 요구한다. Owner와 version maker/checker를 구분하고 self approval를 막는다. Autonomous employment/pay/compensation/ranking decision은 항상 false이며 assistance는 HRM/PER/TIM/PAY tables에 쓰지 않는다.

AI instruction은 폐쇄 oneOf다.

- BOUNDED_EPHEMERAL_TEXT: bounded text만 허용, template은 null. Raw text를 DB/job/event/log/unkeyed digest index에 보관하지 않는다. Bounded volatile buffer가 claim 전 소실되면 UNAVAILABLE/no lease/no call. May-have-dispatched crash이면 RESULT_UNKNOWN/no blind provider retry다.
- VERSIONED_TEMPLATE: exact approved template ref만 허용, text는 null. Current purpose/action/source fields/retirement/digest 및 active policy allowlist를 refetch한다.

Provider execution key는 실제 run UUID에 결속된 stable HMAC이고 trace UUID가 아니다. Unknown call의 자동 재시도는 금지하며 versioned provider idempotency + authenticated reconciliation proof가 있어야 한다. Synthetic test adapter와 UNAVAILABLE는 명시적 모드다. Real model/provider/customer activation은 G6 별도 경계다.

AI Assistance QUEUED/RUNNING/DRAFT_OUTPUT/UNAVAILABLE/CANCELLED/FAILED/RESULT_UNKNOWN/EXPIRED를 구분한다. Unauthorized input은 caller-bound REJECTED receipt이며 성공 business run을 만들지 않는다. Draft output은 closed text/citation/humanReviewRequired/policy/model schema로 restricted immutable artifact에 보관한다. Raw prompt/자유 before-after가 아니며 실제 bytes refetch가 가능해야 한다. Pending/unknown/cancelled에 outputRef/generatedAt/success digest는 null이다.

## Kill / cancellation: owner consume와 한계

Configuration root owner lock은 kill/retire와 REQUEST/DISPATCH/FINALIZE/DELIVER phase authorization를 직렬화한다. Immutable emergency record의 actor는 authenticated Auth.Principal이고 root owner는 바뀌지 않는다. Phase permit은 target/caller/tenant/purpose/attempt/input/output digest/current epoch에 결속되고 TTL≤5s다. Issued cached signature만으로 kill 이후 전달을 완전 차단한다고 주장하지 않는다.

Insights는 phase마다 owner **consume**를 현재 gate에서 확인해야 한다. DELIVER gate unavailable은 deny다. CONSUMED same-key/same-payload cached replay도 current ACTIVE/epoch/effective/caller/purpose/expiry 확인 전에 authorization를 돌려주지 않는다. 새 HTTP delivery는 별도 action identity이며 old bearer permit을 재사용하지 않는다.

Owner consume의 허가 commit을 linearization point로 정의하고 lease expiry 및 network TOCTOU를 제한·감사한다. Kill 이후 새 owner authorization는 불가하지만 kill 직전 이미 허가/전송된 bytes와 외부 call은 소급 취소할 수 없다. 두 DS를 단일 transaction이라고 표현하거나 callback cancellation의 도착만으로 safety를 보장하지 않는다. Late stale epoch/attempt/cancel completion은 draft를 commit하지 않고 uploaded artifact를 revoke/discard한다. New output read도 current gate를 거친다.

## Internal callbacks / 이벤트 / source graph

13 internal routes는 public OpenAPI에 노출하지 않는다. Trusted service/mTLS/signed tenant-purpose-delegation + job target/attempt/input/worker/expiry/cancel-bound lease를 요구한다. Claim, projection/export/evaluation/assist complete, failure, reconciliation, target cancel/AI expire, evaluation owner create/apply, phase issue/consume를 분리했다. Job/target/attempt receipt/outbox는 같은 Insights owner transaction에서 갱신한다. Exact kind → table mapping 및 conditional write template를 JSON executionPipeline에 명시했다.

32 lifecycle event는 exact subject public_id/entity/version/state/changedAt의 최소 typed schema다. Queue/unknown에 성공 결과를 붙이지 않는다. Raw source facts/answers/prompt/token/PII-before-after는 event에 없고 owner reauthorization refetch만 허용한다. PDX_014 최소 audit evidence projection과 operation별 producer/consumer/test allocation은 canonical 합성 시 봉인해야 한다.

JSON sourceGraphDialect는 새 fragment의 source namespaces / typed rule / reference / owner dispatch 형식이다. Named owner response field와 proposed physical columns의 작성자 closure는 확인했지만 기존 strict validator의 actual FK/source oracle에 통합된 그래프가 아니다. FACT_OWNER/AI_SOURCE_OWNER closed dispatch와 dynamic registry complete nested fieldSources를 canonical 형식으로 정규화하고 독립 검증해야 한다. Label/UUID/digest만으로 entity를 바꾸는 laundering은 허용하지 않는다.

Digest framing은 별도로 명시했다. Owned payload hash는 자기 reference/digest wrapper와 재인증 proof/transient CAS/status를 제외한 canonical typed content 및 schema/algorithm domain이다. Result hash도 자기 resultDigest를 제외한다. Recursive self-hash나 digest-only 원문 대체를 요구하지 않는다.

## 합성·검증·열린 항목

작성자 bounded checks: 저장 파일 schema/ref/operation/table-column/FK/owner-response-field/UUID-source/transition identity/root20/fixture-operation/unique identity 및 query column/source closure 2,903 checks, 0 errors; exact BigInt SUM/HALF_EVEN/HALF_UP/weighted rational/zero denominator/config-case arithmetic 16 assertions, 0 errors. 별도 Python Decimal 방식으로 SUM/tie 기대값10개도 일치했다. **28 domain fixture를 실제 실행한 결과가 아니다.** New fragment source graph independent PASS, real shared compile/runtime PASS도 선언하지 않는다.

Synthetic A는 scale2/threshold5/epoch budget2, B는 scale0/threshold7/epoch budget1이다. 두 config 모두 actual typed source rows, money partitions, ratio zero, 두 지원 rounding policy의 ties, field/type/temporal/currency overflow negatives, narrowed/alias budget attacks, pending export bytes, unauthorized caller, correction pointer/refetch/timestamps/orphan CAS/replay, real evaluation coverage/SoD, template oneOf/unknown ephemeral/current gate kill+replayed permit/cancel/expiry를 expected input→outcome로 가진다. Customer policy나 hardcoded production defaults가 아니다.

ROOT 독립 rounding 지적은 작성자안에서 HALF_EVEN/HALF_UP 폐쇄2정책, version pin과 typed tie1000.005 A/B case로 수정했다. A(scale2 HALF_EVEN)는 canonical value1000 / display1000.00, B tie variant(scale2 HALF_UP)는1000.01이다. Wire의 redundant trailing-zero 제거와 fixed-scale display를 구분한다. Unknown rounding/worker default swap은 거부 배정한다. 이는 작성자 수정이며 독립 재승인 전이다.

G3 P0 OPEN은 JSON openIssues에 구체적으로 남겨 두었다: canonical field/API/state/event/test synthesis, 13-stream composite authority/empty schema/DS/role/receipt/current reference/5-session budget, exact shared owner source/registry/privacy/model/test/template/approval/artifact/phase/budget DTO/SPI fail-closed adapter 및 consumer compile, current-gate/unknown/replay privacy/phase scaffold 증거다. Actual 45op/26table domain CRUD와 28case 실행은 G4 후속이다. Root 최신 WFM/listening fragment와 common migration successor reservation의 실 SQL/owner bootstrap 소비를 함께 합성해야 하며 historical allocation을 지금 덮어쓰지 않는다.

Root 통합 전에 최소 독립 acceptance는 다음과 같다.

1. Source UUID entity/FK target, full typed payload/refetch/nested projection, immutable content revision과 CAS, command/result source를 actual column oracle로 검사한다.
2. 원 owner/schema/stream/tenant/purpose/source revision/digest mismatch, unknown binding, primary/private role fallback, missing/tampered/stale composite receipt를 fail closed한다.
3. Single batch alias/narrowing/repeated publication budget, cached consume replay afterkill, current owner outage, late callback/cancel/unknown provider attack의 shared negative tests를 실행한다.
4. G3 shared empty schema/DTO/SPI/guards/compile/pilot/runtime와 G4 domain fixture 실행을 따로 기록한다. 현재 디자인만으로 G3를 OPEN하거나 최종 P0/P1=0이라고 선언하지 않는다.
