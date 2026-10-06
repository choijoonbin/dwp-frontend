# PAY BASE preparation successor v2 — 2026-09-14

`DESIGN_PROPOSED / AUTHOR_ONLY / CURRENT_PUBLISHED=false / G3 CLOSED`.

이 패키지는 기존 PAY 독립검토4 P0/2수용조건에 대한 실제 신규 준비 설계·검사다. v1 원후보4.8MB·historical G2 SQL·CSV·Gate·session evidence·BE/main 바이트를 수정하지 않았다. 이 로컬 proposal dialect는 승인된 canonical overlay가 아니며,119 operation과88 table의 보존·확장은 의미 완결 또는 독립 승인 근거가 아니다. 사용자의 common 준비 권한 내 내부 전문가/코드 owner 검증·비충돌 allocation·등록 준비가 남으며 외부 고객 자료나 새 사용자 승인을 요구하지 않는다.

## 실제 보완

- 모든119 operation ID/order를 원후보와 대조하여 보존하고, 각 operation에 read/write/owner registry·loaded physical columns·CAS/clock/allocator/receipt inputs 및 남은 exact source gap을 명시했다. 새 독립 expected operation/source-family catalog는 아직 미게시다.
- 현재 Control `payroll-main`의 `public / flyway_schema_history / classpath:db/migration / createSchemas=false`와 Payroll `pg_catalog, public` search_path 및 PAY owner-prefix 정책을 채택했다. hris_payroll을 새 stream으로 만들지 않는다.
-78 table의 계획 DDL/RLS를 public로 정합화하고10 retained table은 역사 SQL에서 별도 draft로 조립했다. `.planned.sql`은88 CREATE를 먼저 생성한 뒤73 tenant-composite FK와88 FORCE RLS를 배치한다. 원본 history는 불변이다.8 실제 state-machine CHECK를 계획하며 GL의 CANCELLED를 실제 proposed enum/전이로 추가한다. GL APPROVED/SENT/POSTED/NATIVE_POSTED는 CANCELLED로 덮어쓰지 않는다.
- 누락됐던 governance label을 신규 `SYS.PayrollConfigurationGovernancePort.proposal.v2`에 연결했다. ENTITY/PAYGROUP/CALENDAR/ROUNDING/ELIGIBILITY/ELEMENT/FORMULA/GL_MAPPING의8 query method와 closed request/response, 전체 response fieldSource, version/schema/asOf/digest/refetch, purpose/population/SoD/failclosed 및 SYS/PAY 파일·테스트 소유권을 계획했다.8종 모두 native producer SQL column registry/DTO SPI/endpoint 등록은 OPEN이다. conceptual fieldSource를 actual SQL source proof로 승인하지 않는다.
- freeze/finalize/payment/gl/statement/reversal 및6 cancellation branch의 누락된 transitive reads를 추가했다. `.graphs.json`은12 planned queries의 실제197 field column/type,12 runtime/body/CAS/RETURNING/hash nodes,6 subject/binding branch tuple를 명시한다. freeze의 부모는 실제 `run.input_snapshot_id → snapshot.input_snapshot_id`이며 존재하지 않는 `snapshot.payroll_run_id`를 사용하지 않는다.
- command normalization은 actor/tenant만으로 column ruleId를 만드는 방식이 아니다. actual header/body/path, loaded parent/prestate, owner payload/native versions, clock, secure allocator, CAS RETURNING, normalized effective outcome을 각각 입력으로 분리했다. full local-entry/artifact/native-target/invalidation/audit payload leaf·balance watermark 등 미등록 입력은 `OPEN_*`으로 노출한다.
- native identity는 Auth `com_users.person_public_id`→People person/worker/relationship/assignment3UUID 및 native versions/inclusive DATE/owner-zone을 재사용한다. People common V49의 `ppl_legal_employers.public_id`, 실제 `version/lifecycle_state/country_code`를 query source로 계획하며 PAY가 People DB를 직접 읽거나 cross-owner FK를 만들지 않는다. PAY owner query transport/current authority는 미게시다.
- `.native-columns.json`은 frozen run-worker target와 immutable worker result에14 native identity/version/date fields씩을 추가하는 forward-only 계획이다. 원본119/88의 식별자 수를 억지로 바꾸지 않는다. acting Auth2 stamps는 subject People version vector와 별도 receipt로 보관한다. 역사 행을 current/guessed context로 backfill하지 않는다.
- person-bound payslip은 현재 active employment/assignment가 없는 former worker도 immutable statement/result person-parent를 통해 조회할 수 있도록 별도 PAY statement authority adapter를 계획했다. HRIS_PAY app/duty/field policy/pay-purpose/current proof를 유지하고 profile-only `SELF_PROFILE_READ/HRIS_HRM` SelfPerson permission은 PAY 행동 허가가 아니다. APP autogrant·EMPLOYEE synthetic default·principal UUID=worker UUID는 금지다.
- 기존 synthetic employmentContextPublicId/employmentPublicId/selfContextRef는 역사 입력일 뿐 새 native 계약으로 승인되지 않는다. Download의 successor body는 explicit statement/version/digest/action/pay-purpose query다. retirement/YEA 기존 `employmentIds`는 exact native historical relationship/service interval owner request 재설계가 OPEN이며 label alias로 완료 처리하지 않는다.
- retirement119 parent/YEA34 route 전체를 원천 inventory ID/파일/행으로 유지하며 KEEP/INTEGRATE/KR_COUNTRY_PACK/customer-variant RETIRE 판단·이유를 각각 제안했다. 원천 code/schema/formula를 복사하지 않는다. YEA backend는 원천 shard에 없어 명세 추정으로 인증하지 않는다. BENSK PAY parent0과 역사 ADDSK contaminated12file 제외 경계를 명시한다. 국가 tax/rate/filing 계산과 company-specific variant는 global core0 hardcoding/optional pack이며 native case/basis/evidence/correction 필요성은 별도다. 이 분류는 per-field variant 의미의 독립 인증이 아니다.

## 검사와 한계

전용 `.check.cjs`는 installed Ajv6.12.6/full formats/coercion0로 원후보635개와 신규27개=662개의 실제 전체 Draft07 정의를 compile한다. 지원되지 않는2020 keyword/constraint ref-sibling을 버리지 않고 거부한다. 원본 referenceContract179개+신규 inherited annotation1=180개는 표준 JSON Schema authority 검사로 실행되지 않음을 계수한다. canonical Draft2020/현재 modern lineage checker 승인이나 source graph 전체 closure를 주장하지 않는다.

실제 inherited A/B request36·owner8을 재검증하고, 신규 owner fixture는 native carrier/selector/statement/download14 shape와 저장된8 config method×A/B=16 typed request/response·실제 payload digest를 검사한다. 이 fixture들은 synthetic author data이며 실제 signed authority/HTTP/PEP/customer identity/native runtime은 아니다. 과거51개의 설명 negative는51 concrete typed boundary model로 변환했다. recovery/positive도 분리하며 기존005의 “다중 고용이면 current payslip selector 필수” 기대값은 person-bound positive로 정정했다. duplicate rounding-stage/IANA zone/signed-zero3건을 추가해54건이다. canonical signed negative zero는 Decimal SSOT에 따라 hash 전에0으로 정규화한다.

foundation8종 operation의 successor request를 `.foundation.schemas.json`에 별도로 정의해 기존 body의 generic governance.snapshot selector를 실제 planned schema/policy/owner revision/digest/asOf/scope reference로 대체했다. ENTITY는 HRM.LegalEntity label 대신 `NativeLegalEmployerRef(publicId,expectedVersion,asOf)`를 사용한다. entity 최초생성 policy scope는 tenant-root(null/null)이며 future local UUID로 config scope를 신뢰하지 않는다. `.foundation-fixtures.json`의8×A/B=16 concrete API body와 owner response payload/revision/digest를 검사하고18개의 inherited foundation body 변환도 재검증한다. local artifact prerequisite와 native governance bootstrap은 실제 source authority/native workflow가 아니므로 OPEN이다.

검사 범위는1303 actual planned columns/types,5538 loaded-column references,146 same-owner FK column pairs,197 critical query fields,88 assembled public table draft이다.447 initial source는 real input/clock/allocator/RETURNING을 가진 direct planned이고856 business/phase/historical source는 OPEN이다. loaded column count는 업무 계산 source closure가 아니다.39/51 모델에는 full operation API request 연결이 없음을 evidence의 exact case ID로 공개한다. 따라서54 typed-model PASS를51 complete API-negative/native journey PASS로 승계하지 않는다.

mutations는 unknown shadow selector field, invalid actual calendar date, phantom source column, nested input payload/digest, wrong parent, stale CAS를 실제 검사에 주입하여 거부를 확인한다. 이는 완성된 domain formula interpreter가 아니다.19 closed AST operator/type/unit/currency/rounding/dependency/error registry/noeval 계약을 유지하지만 G3 shared compiler/SPI/consumer binding 및 독립 formula fixture oracle는 OPEN이다.

actual successor formula body에 HOST_EVAL expression, foundation body에 wrong method kind와 missing schema-version owner reference, actual native assignment에 wrong parent도 주입해 총10 mutation 거부를 검사한다. 이 검사는 실제 SQL source producer/법정 계산식의 실행 또는119 전체 payload의 독립 oracle가 아니다.

`.cancel-fixtures.json`은6 branch×5 authoritative outcome=30 concrete fixture와90 actual closed CAS header/cancel-request/reconcile-request shape를 추가한다. RUN owner rejection은 실제 enum VALIDATION_FAILED다. retirement/YEA review-pending은 CALCULATED business case+binding PENDING이며 phantom APPROVAL_PENDING case를 만들지 않는다. already approved는 REVIEWED, rejection은 CALCULATED+binding REJECTED, unknown/not-found는 원상태/subject-write0, before-decision cancellation은 no unresolved provider/posting guard 하의 CANCELLED다. 이 새 planned 전이/owner binding은 독립 검토·생산 adapter 미완료이며 author outcome replay로 승인하지 않는다.

실행 명령:

```sh
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/pay-base-preparation-successor.v2.check.cjs /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend
```

최종 `.evidence.json`에는 actual argv/UTC/engine/counts/outcomes/source와 own-file SHA/ns decimal strings pre/post 및 capture pin drift를 저장한다. saved SQL과 owned builder의 full text도 검증한다. SQL parser/native execution은0이며 DML/DB/runtime/server/commit은 수행하지 않았다. 다른 owner가 변경 중인 BE 전체 tree 불변 또는 approval을 주장하지 않는다.

## Gate 경계와 다음 정확한 범위

G3: independent119/catalog/source decisions; internal nonconflict owner allocation; exact normalized per-op mutable columns/state/constraints/ACL/forward schema upgrade; SYS8 config actual producer/query/DTO SPI/current refetch/failclosed/consumer compile; native PAY statement/purpose/PEP/historical result binding; closed formula shared compiler/source/error oracle; unmatched39 full API-negative payload publication·독립 replay가 남는다. public schema 정합 draft와 author tests만으로 이 결함을 CLOSED로 만들지 않는다.

G4: 실제 domain DML/CRUD/전체119 API 및 모든 financial journey 실행. G3를 열기 위해 이를 먼저 개발하라는 순환 조건을 만들지 않는다.

G6: 실제 국가 법정값/은행·ERP·YEA provider production 활성화/고객 identity adoption. optional pack 미활성은 native generic regular/offcycle/correction/manual-payment/native-journal/case workspace를 모두 금지하는 원인이 아니며, 필요한 pack-dependent branch는 disabled failclosed한다.

PAY V1..49의 기존 reservation을 계획 참조하지만 작성자가 새 version 번호를 배정하지 않았다. People common49과 HRM domain50+ 잠정 범위를 분리한다. 최종 internal owner/source approval과 independent review 및 실제 current shared common proof 전에 전사·모듈 독립 착수 READY를 선언하지 않는다.

`.source-file-allocation.json`에 shared Contracts/Platform SYS owner producer와 PAY consumer의 실제 repository-relative planned Java source/test 파일19개를 별도 분리했다. ellipsis 경로를 exact namespace로 대체했으며 현행 registry 또는 BE파일 할당·생성·승인은0이다. G3 shared DTO/SPI/guard/consumer compile와 G4 domain CRUD 소유권을 혼합하지 않는다.

스프레드시트 skill은 원천 CSV의 인메모리 읽기와153행 exact ID 대조에만 사용했다. CSV/워크북 수정이나 count 기반 전수 업무 인증은 하지 않았다.

OfcrMulcnt 전체 원천 entity의 add_rate/유효일/HRM attribute 필드 확인으로 “임원 배수” 자체를 ADDSK 회사 변형처럼 폐기하던 초기분류를5 exact rows에서 보정했다. 필요성은 typed effective configuration/optional country calculation으로 보존하며 source 회사번호·배수 값은 재사용하지 않는다. KR 법정 배수인지 tenant plan 가산율인지의 field별 독립 source decision은 OPEN이며 generic 업무 개념을 회사 변형이라는 label만으로 삭제하지 않는다.
