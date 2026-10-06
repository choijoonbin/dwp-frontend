# PAY BASE 개선 후보 독립 검토 — 2026-09-14

상태: `ROOT_INDEPENDENT_REVIEW / NOT_READY / G3 CLOSED`. 작성자는 Galileo이며 이 검토는 root가 저장된 후보를 읽고 실행한 별도 진단이다. 후보·historical G2·정본·Gate·DB·서버는 수정하지 않았다. 신규 read-only 검사와 이 보고서만 추가했다. 다른 작성자의 자체 PASS를 독립 업무 승인으로 승계하지 않는다.

## 고정 입력과 실제 검증

후보 JSON: `semantic-remediation/pay-base-exact.proposal.v1.json`, SHA-256 `bfe3e38b1417b180339e91ca22e20409e75f3991904ab26ecf0e8f3cb7e22455`.

후보 MD 전체 476행을 읽었다. SHA-256 `633992f8db76e2d15ceb5137f79d0e4459647f4659dc2907d15fbbe907817acb`. JSON은 전체 파싱·schema projection·참조 inventory와 선택된 operation/source/table/owner/fixture 계약을 검토했으며, 1303개 column의 업무 의미를 전수 인증하지 않았다.

backend read 기준: integration `db0d2b5067e6fbee27ee58121c5a4406cab132b9`. root가 실제 `ControlPlan.java`의 payroll-main 및 single() 경로를 읽었다. 새 identity scaffold는 integration에서 미커밋 준비 중이고 이 PAY 승인의 근거가 아니다.

실행:

```sh
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_pay_base_independent_projection.cjs /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend
```

- UTC `03:15:54.776046`–`03:15:55.670811`, measured 0.894038초, exit0.
- 검사 source SHA-256 `8186e6dda90a42b12b39efa30452830554f31cb4576860995459bc6738ed4de0`.
- stdout SHA-256 `0b56fd16e3e8a9b7347a48087ba331231a2336b1f4726bc43163cab322eddb08`, stderr SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- installed Ajv6.12.6, Draft-07 **shape projection**, `format: full`, coercion/default/removal 없음. Draft-2020 전용 keyword와 유효한 constraint sibling이 있으면 projection을 거부한다. 현재 referenceContract metadata179개는 JSON Schema의 owner/entity 검사로 실행되지 않는다고 별도로 계수했다.
- 635 schema compile, 기존 concrete request36+owner8=44 shape 통과, 5개의 shape/semantic-boundary probe 기대결과 확인, 입력 바이트 불변.

이는 Draft-2020 정본 검증, 실제 owner authority, per-column source closure, SQL/native runtime, formula interpreter 실행, 119개 업무 API 수용이나 coding Gate 승인이 아니다. 최초 fast-format 진단은 잘못된 날짜를 허용했고 최종 full-format 검사에서는 `2026-02-30`을 거부한다. 이 둘을 합쳐 전체 PASS라고 표현하지 않는다. 최초 projection의 referenceContract sibling 거부도 canonical validator를 완화하지 않고, 표준에서 실행되지 않는 metadata라는 사실과179개 미검증 경계를 명시한 별도 진단으로 해소했다.

## 고도화 방향에서 유지할 점

digest-only foundation/run을 실제 payload·immutable source vector·closed typed AST로 바꾸고, calculation candidate·금융 finalization·은행 ACK·회계 posting을 분리한 방향은 타당하다. 다중 assignment/currency, native manual 지급과 native GL의 정확한 완료 명칭, country/provider 선택 설치, unknown outcome의 재조회, finalized 결과의 새 correction/reversal은 필요한 개선이다.

그러나 42→88 table 또는 33→108 public API 증가는 최적화의 증거가 아니다. 화면은 공통 journey로 통합하고, 신규 table은 immutable facts/receipt/lease/보관·권한/독립 lifecycle의 실질 필요를 설명한 뒤 채택한다. 고객에게 은행/ERP/PER/country pack을 일괄 강제하지 않는 방향을 유지한다.

## 착수 차단 지적

### PAY-REVIEW-P0-001 — owner registry와 operation 의존이 연결되지 않음

operationDeltas index0/3/6/9/12/15/18/21의 ownerReadContracts는 `SYS.PayrollConfigurationGovernancePort.proposal.v1`이다. 이 label은34개 ownerContractDeltas에 없고, actual policy/effective configuration DTO와 method/query 연결도 없다. entity 생성은 table initialSource와 procedure에 HRM legalEntity refetch를 요구하지만 해당 operation/sourceModel.ownerSources는 SYS label만 선언한다.

해소: 공통 port와 단계별 DTO의 관계를 exact method/query/response/refetch·권한·asOf로 등록하고 각 operation의 실제 owner 목록과 source dependency를 일치시킨다. owner34개 전부 CURRENT_PUBLISHED=false다. 공유 Java/endpoint·producer/consumer·disabled adapter·공통 pilot 미완료를 schema 이름으로 닫지 않는다.

### PAY-REVIEW-P0-002 — 계획 schema와 실행 stream이 불일치

78 scoped table의 계획은 `hris_payroll`을 사용한다. 현재 Control payroll-main은 `public / flyway_schema_history / classpath:db/migration / createSchemas=false`다. historical PAY SQL은 schema 비지정 CREATE이며 새 schema/native bootstrap·receipt·search_path·runtime ACL 변경 승인이 없다.

해소: public 유지 또는 payroll stream의 명시적 schema successor 중 하나를 근거 있게 결정하고 SQL·Control manifest·resource stage·history·runtime role/guard·예약을 일치시킨다. 이를 이유로 불필요한 새 서비스/stream을 자동 추가하지 않는다. SYS13-stream 설정만으로 PAY schema 불일치가 해소되지는 않는다.

### PAY-REVIEW-P0-003 — native identity·전체 mutation·SQL 의미 승인 미완료

SELF 후보에는 employmentContextPublicId/employmentPublicId가 있지만 현재 공통 ABI는 기존 People worker/workRelationship/assignment native tuple을 사용한다. 추가 식별자의 실제 객체·allocator·owner storage/refetch 또는 native 명칭의 명시적 대응이 아직 없다. 새 journal이나 business-key UUID로 빈칸을 채우지 않는다.

sourceModels는 의존 inventory이며 full operation-specific prestate→guard→write→RETURNING graph가 아니다. 계획 CHECK/exclusion/partial-index/append-only ACL도 통합 SQL로 완료되지 않았다. author remainingRisks003/004/005가 이를 OPEN으로 정확히 인정한다. 해소는 실제 owner binding·구체 source graph·exact SQL/예약의 독립 검증이며, domain 전체 CRUD를 먼저 요구하는 순환 Gate는 만들지 않는다.

구체 read-set 반례도 있다. `payment.create`에는 run primarySubjectBinding이 있으므로 run 조회 자체가 전혀 없다는 지적은 하지 않는다. 그러나 declared reads/loadedSources는 payment batch/instruction뿐이라 실제 finalized worker-result/finalization source가 연결되지 않는다. `pay.run.input.freeze`는 procedure가 selected source vector와 accepted ingests를 요구하지만 declared reads/loadedSources는 snapshot/run/worker뿐이다. `run.finalize`도 계산 결과·검증·승인/source freshness를 컬럼 의존 graph로 연결하지 않는다. primary subject query와 설명문만으로 transitive read closure를 대신하지 않는다.

### PAY-REVIEW-P0-004 — 전체 PAY 업무 필요성·source restoration 인증 미완료

10 retained historical table,4 retained public operation과 retirement119 parent/YEA34 route의 basis/history/eligibility/document/correction variant는 UNVERIFIED다. shell과 operation 수로 source 의미를 모두 흡수했다고 선언할 수 없다. 일반 payroll run과 retirement/YEA case를 나누는 방향은 적절하지만 통합·제외·country/optional 분류와 실제 payload/state/source restoration이 필요하다. HRM/PER BASE exact 개선 준비 역시 별도 미완료다.

실제 국가 법정값·고객 adoption·provider production contract는 G6이며, generic port/disabled 상태·확장 정책·업무 계약 누락은 G3 내부 준비다. 현재 사용자에게 없는 운영 DDL/은행 자료를 추가 요구할 사유가 아니다.

## 수용조건 보완

- PAY-REVIEW-P1-001: negativeCaseCatalog51개 input은 모두 설명 string이며 concrete typed object0개다. operation·현재 정책/owner rows·clock/lease·version·request·expected receipt/error·0writes/provider-call counts를 실제 fixture로 만들어 독립 검증한다. 현재44개는2설정의 선택 subset이고 모든 상태/원천/취소·정정 branch의 수용을 증명하지 않는다.
- PAY-REVIEW-P1-002: 서로 다른 rule의 동일 rounding stage, invalid IANA zone/wrong legal-entity owner selector, `-0`를 shape만으로 거부하지 못한다. stage cardinality와 실제 registry/unit/currency/timezone/owner/entity guard·canonical Decimal/hash 정책을 정확히 등록하고 concrete negatives를 검증한다. JSON Schema PASS를 domain validity로 승계하거나 기존 Decimal 정본과 다른 임의 정규화를 만들지 않는다.

취소 reconciliation은 writesTables에 cancellation request만 있지만 **branchWriteSets에6종 subject/binding update가 이미 선언돼 있다**. 따라서 subject write가 전혀 없다는 지적은 하지 않는다. canonical adapter는 branch별 subject/prestate/returned state와 모든 effective writes를 정규화해야 한다. GL CANCELLED 상태 등 remainingRisks010의 인정된 미완료는 여전히 OPEN이다.

## 최종 판정

개선 방향 일부는 합리적이고 실제 shape 검사도 재현됐으나 **PAY 전체 메뉴 독립 개발 착수 준비는 미완료**다. 위4개 P0 묶음과2개 수용조건은 이 후보의 bounded 독립 검토 결과이지 다른 보고서·2007개 modern errors와 합산할 신규 총계가 아니다. Gate는 닫고 canonical/API/SQL/source/fixture/common runtime 준비를 완료한 새 안정 pin으로 독립 재검증한다.
