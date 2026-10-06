# 글로벌 HRIS 제품 의미 독립 감사 — 2026-09-14

## 판정

**제품 방향 적합, 전체 G3 코딩준비 판정은 차단.** 이 보고서는 제품범위·의미 계약 감사이며 런타임/코드/전체 Gate 인증이 아니다. 현재 다른 담당자의 보완은 진행 중이며 이 보고서의 결함은 원래 봉인된 exact 정본을 대상으로 한다. 새 재설계 제안 자체는 독립 PASS 증거가 아니다.

파일 편집·코드 실행 공격·실DB 실험 없이 source CSV, IA, API/state/schema/event/acceptance 및 세션 지시서를 읽고 구조·의미를 교차 계산했다. 보고서 및 typed findings 저장만 별도 승인받았다.

## 글로벌 primary benchmark

공유 Core HR, 근태·급여·성과 연결은 글로벌 HRIS 기반이지만 vendor DB/화면/프로토콜 복제를 의미하지 않는다. [Oracle Human Resources](https://www.oracle.com/human-capital-management/human-resources/)

과거·현재·미래 인사 이력과 소급조정은 현재값 CRUD 이상이다. 급여 소급 재계산은 원결과를 보존하고 차이를 새 결과로 비교해야 한다. [Oracle Date Effectivity](https://docs.oracle.com/en/cloud/saas/human-resources/faisa/date-effectivity.html), [Oracle Retroactive Pay](https://docs.oracle.com/en/cloud/saas/human-resources/faagp/overview-of-retroactive-pay.html)

설정형 업무흐름·조건·승인·문서·연계·실행감사를 공통 기반으로 두는 방향이 적합하다. [Workday Business Process Framework](https://www.workday.com/content/dam/web/en-us/documents/datasheets/workday-business-process-framework.pdf) 공통 연계 설정·실행·스케줄·모니터링 역시 타당하다. [SAP Integration Center](https://help.sap.com/docs/SAP_SUCCESSFACTORS_PLATFORM/60ba370328e0485797adde67aee846a0/9b24a750cb3b48dbbbdf3c2ebd6963b3.html?locale=en-us)

홈은 정보·업무기한·다음 행동 카드 중심으로 구성할 수 있다. DWP의 정확한 7-workbench 분류는 vendor 요구가 아닌 제품 설계 선택이다. [SAP Home Page Cards](https://help.sap.com/docs/successfactors-platform/managing-sap-successfactors-user-experience/home-page-cards?locale=en-US)

채용·학습·스킬·내부기회·승계·인력계획은 합리적 확장 범위지만 모든 고객의 첫 출시 필수 기능이라는 근거는 아니다. DWP가 이 16개를 REQUIRED_G3로 선택한 이상 구현 착수 전 충분한 의미 계약은 필요하다. [Oracle Talent Management](https://www.oracle.com/human-capital-management/talent-management/) AI는 인사/평가/급여 결정의 자동 확정을 의미하지 않으며 인간 통제·설명·공정성·감사를 먼저 설계해야 한다. [Workday Responsible AI Practices](https://www.workday.com/en-us/artificial-intelligence/responsible-ai-practices.html)

## 등록 구조와 제품 경계 — 확인

- source parent 2,269개(HRM583/PER349/TIM568/PAY546+YEA34/SYS189), child 10,001개, 86 target family는 유지/통합/재설계/제외 및 source 참조를 갖는다. REUSE281/REBUILD1081/CONFIGURE426/EXTENSION121/RETIRE360은 코드 재사용 허가가 아니라 행동 이관 분류다. 수량만으로 의미 완전성을 인증하지 않았다.
- 기본 86 + modern16 slice, active100/retired2; 모든 모듈에 파일 소유권·API/event/state/data/auth·G4 수용/운영·Design AI 인계 경로가 등록되어 있다. source→실행 연결의 **등록 구조**는 존재한다.
- Home widget-only, sidebar `내 HR/팀/인사 운영/근태/급여/성과/설정` 7개, explore 분리, 98 IA node/46 task group. 정본 `09-information-architecture-contract.md:7`와 세션 `07-g3-full-coding-execution-contract.md:110`까지 이어진다.
- BENSK/ADDSK는 코어 제외. 범용 benefits는 별도 신규 capability/route/contract이며 BENSK 데이터·공식·화면의 재사용이 아니다.
- Product Core→Country Pack→Tenant Config→Signed Extension 경계가 명시되어 있다. 근무제·급여군·평가주기·workflow·조직코드·eligibility는 버전 설정이며 실제 국가 법정값/외부 계약/고객 정책 활성화는 G6다. 프로토콜 enum, 공개 ABI, 안전한 size bound 같은 제품 불변조건과 회사 정책값은 구분해야 한다.
- 기능 G4 완료 후 전체 메뉴·화면 Design AI 프롬프트/검증 ZIP 필수, 디자인 승인 대기 G5B, 실제 교체·전체 회귀 G5C. `07-g3-full-coding-execution-contract.md:112`가 이를 강제한다. 시각 디자인 인계가 G3 업무 의미 결함을 대신 해결하지 않는다.

## G3 차단 지적

| ID | 수준 | 정확한 결함 | 보완 |
|---|---|---|---|
| P0-SCOPE-001 | P0 | modern100 operation에서 correlation→business ref 45행/23op. 다른 path UUID도 관계없는 worker/org/policy ID로 복사. 150행은 generic `validatedCommand+ownerPolicy.*`만 기재. 413 response source는 실제 column에 없음(정상 유도 projection도 명시 유도식 필요). | entity-typed source graph, authenticated/self mapping, parent-generated ID, loaded relation 보존, named owner refetch/typed projection |
| P0-SCOPE-002 | P0 | 실제 업무 payload가 없어 digest를 계산하더라도 의미를 저장/재현할 수 없음. offer amount/currency, 설문 질문/답변, 스킬 그래프, metric definition/value, WFM shift lines, 성장 aspiration 변경, proposal 생성 등이 누락. | typed columns/child rows 또는 exact immutable artifact schema/version/owner/refetch 계약 |
| P0-SCOPE-003 | P0 | requisition/후보, template/assignment/task, opportunity/application 등 서로 다른 상태를 단일 machine으로 혼합. 13 capability의 선언 terminal이 도달 불가. 3개의 `*_OR_*` pseudo target은 실제 enum과 불일치. | 객체별 machine; admission/query/repeated child action/completion/decision edges; unsupported scope 명시 |
| P1-SCOPE-004 | P1 | 48 acceptance는 한 문장 assertion/미래 evidencePath만 있고 원래 modern fixture 파일은 없음. | synthetic config2종과 실제 input→값/row/event/error 기대치를 지금 정의, 실제 실행 결과는 G4 |

P0-SCOPE-001의 45행 exact operation→target→repair map은 typed JSON `enumeratedEvidence.correlationBusinessReferences`에 파일행/JSON pointer/필요한 owner source까지 전수 기록했다. 221 reference rows, 150 generic derivations, 413 missing-column response source도 해당 JSON에 전수 기록했다. 전체 221 reference rows를 모두 결함으로 세지 않았으며, 부모 local ID로 올바르게 해석되는 행과 관계없는 UUID 복사를 구분해야 한다. base 계약의 동일 literal `headers.X-Correlation-ID`/`OBJECT_REFERENCE_RESOLUTION` 패턴은 modern exact 외 match0이지만 **base 86 family 전체 의미 무결성은 아직 인증하지 않았다.**

## 16개 modern semantic matrix

| Capability | 실제 빠진 의미/재현 경계 | 최소 재설계 |
|---|---|---|
| Recruiting ATS | candidate 입구 없음; requisition event가 아직 없는 candidate를 요구; offer 금액/통화 미저장 | 독립 requisition/candidate/offer/hire handoff, typed intake 및 immutable offer |
| Onboarding | task 정의/소유자/기한/evidence schema 없음; N-task 완료 반복·최종완료 불가 | versioned task graph + assignment/task instance machine |
| Workforce Planning | scenario 입력/인사·비용 가정/결과가 digest 중심 | typed as-of population, assumptions, scenario result lines 또는 pinned artifact/refetch |
| Benefits Admin | plan options/eligibility content 및 election coverage/dependents 선택 재현 없음 | versioned benefit plan/options + eligibility refetch + enrollment snapshot |
| HR Service Delivery | 문의/응답 본문 또는 안전한 typed objectref 없음; queue assignment/SLA pause-resume 불명 | minimized encrypted case content, typed response/evidence, SLA clock receipt |
| Contingent Workforce | create가 vendor/worker/sponsor/classification intent 표현 불가 | explicit engagement refs/classification/access-expiry handoffs |
| Skills Ontology | taxonomy graph/labels/proficiency vocabulary가 digest뿐; evidence 입구/검증 범위 없음 | immutable typed taxonomy version/graph, consent-bound evidence admission/verification |
| Growth Profile | aspiration/coaching 변경이 changeSetDigest뿐 | typed employee assertions and coaching artifact; evidence separation |
| Learning | offering 목표/content/capacity/skill mapping 없음; enroll 대상 불명; 완료 evidence table 미write | offering version + assignment instance + completion provenance |
| Internal Marketplace | type/capacity/skill criteria/explanation 실체 부재; opportunity create에 applicant 없는 application write | opportunity version + per-worker application + explained human selection |
| Succession | nomination은 있으나 readiness evidence write/refetch 연결 없음; restricted audience pin 불명 | per-position plan, consent-bound nomination/readiness evidence, audience approval |
| Compensation Planning | proposal create/edit 없음; 기존 proposalId submit만; snapshot은 typed지만 source line 형성 불가 | money-typed proposal admission/change, balanced budgets, immutable multi-line handoff |
| Advanced WFM | demand rows/availability/shift candidate lines가 digest뿐; optimize/validate가 publish ledger까지 write | typed demand/availability + candidate lines + constraints + publish-only ledger |
| Employee Listening | 질문버전/답변 content 없음; cohort numerical results 재현 불가 | protected typed response artifact; anonymous cohort projection and erasure boundary |
| People Analytics | metric expression/lineage source/result values가 digest뿐; create에 projection write | bounded typed metric definition and named source snapshot/refetch + separate projection computation |
| Governed AI | policy/evaluation thresholds/output 및 source projection pin 불명 | typed human-control policy/eval suite/assist result artifact; no autonomous decision |

## 후속 Gate와 과도한 범위 방지

- **G3 준비:** 위 데이터·객체·상태·source·fixture 의미를 고정해야 한다. 내부 자료에서 해결 가능하며 운영 DDL/export나 실제 고객 golden dataset을 기다릴 사안이 아니다.
- **G4:** 구현된 업무흐름·필드·예외·동시성·소급/정정·재처리·권한·golden 결과를 실제 시험하고 증거를 제출한다.
- **G5:** full-screen Design AI 인계/승인/교체/전면 회귀. 정보구조·접근성은 이미 G3/G4 요구다.
- **G6:** 실제 국가팩/법정·은행·ERP·세무·보험·타각, 고객 정책/데이터/UAT, 실제 AI provider/평가, 법률·보존·운영·성능·배포 승인을 활성화한다. 이번 보고서는 법적 준수나 production 준비를 인증하지 않는다.

16개 확장을 일괄 vendor copy나 새 서비스를 만들어 채우지 않는다. capability 설치/tenant entitlement와 delivery wave로 선택적으로 노출하되, 선택된 REQUIRED_G3 범위의 누락을 wish list라는 이름으로 감추어서도 안 된다.

## 별도 독립 재검토 — SYS/TIM 제안과 공통 successor

범위: `sys-tim-modern-remediation.v1.json`, `sys-tim-synthetic-acceptance.v1.json`, `remediation-integration-plan.md`를 읽기 전용으로 검토했다. 실제 typed 데이터/객체별 machine/선택 설치/anonymous role-purpose 경계/인간 승인·최종 delivery fence 방향은 타당하지만 **46 operation 제안은 현재 exact 실행 정본이 아니며 READY가 아니다.** 작성자의 PER 제안도 이 별도 독립 검토의 PASS 대상이 아니다.

| ID | 수준 | 정확한 남은 문제와 위치 | 수용 조건 |
|---|---|---|---|
| P0-PROPOSAL-ST-001 | P0 | WFM create(560~573)는 native/owner ONE_OF인데 lines와 ref 모두 required. AI assist(3289)는 ephemeral mode에도 template ref required | discriminator별 exact closed oneOf, 두 정상 branch와 missing/mixed 음성 |
| P0-PROPOSAL-ST-002 | P0 | WFM SkillRequirement(105~116)의 PER.SkillVersion UUID+decimal proficiency가 PER 새 taxonomy skill/version/band vocabulary와 불일치 | skill UUID+immutable taxonomy version ref+band code; owner band-order만 사용, 2config 연동 |
| P0-PROPOSAL-ST-003 | P0 | anonymous response(1642/1659)가 generic principal receipt 기본값과 override 문구를 함께 상속 | token-scoped exact receipt/schema/key/atomic consumption; same payload retry 동일receipt/행1, 다른payload 충돌; identity/trace join 금지 |
| P0-PROPOSAL-ST-004 | P0 | owner form/audience/availability/cohort/evaluation contracts와 exact column/query/event/source closure는 미게시(3723). filter typedValues는 STRING[], weighted mean/ratio operand/zero policy 불명(316) | 46+ op의 method/path/typed query-target와 actual source fields, closed typed operator/owner port/event/SQL graph 전수 통합 |
| P1-PROPOSAL-ST-005 | P1 | WFM fixture28~38의 단일 skill 필드는 requiredSkills array와 다르고 native/ref branch 입력 없음; cohort count5(242)는 정밀 count 차단 주장과 충돌 | exact API 입력 materialization, 공표 count null/bucket 정책, overlapping cohort5/6 차분 음성·query budget pinned rule |
| P0-BASELINE-ALLOCATION-006 | P0 | module range47..69/211..239/231..259(coding-readiness/g3-file-allocation-register.csv35/39/40) 시작을 새 common People47/48,Auth211/212,Platform231..237이 이미 소비 | common successor HEAD 이후 free version/capacity 재예약·same-blob merge·current paired worktree/catalog/source/Gate 원자 갱신; fresh/restart 전수 재검증 |

P0-BASELINE-ALLOCATION-006은 실제 integration backend 파일 목록과 allocation CSV를 교차 확인했다. 서로 다른 filename이어도 같은 Flyway version을 허용할 수 없다. historical1..46 characterization을 live48 successor로 덮어쓰지 말고, historical 검증과 current successor 증거를 분리한다. 단순 expected count 증가나 오래된6f baseline의 PASS 재사용은 수용 조건이 아니다.

새 포트/스키마/typed fixture 내용은 내부 자료와 소유자 협의로 보완할 수 있다. 운영 고객 golden/실 provider/법정팩을 기다리는 G6 문제로 이 G3 의미 결함을 미루면 안 된다. 반대로 확장 기능을 모든 고객에게 의무 노출하거나 새 runtime/service를 늘릴 이유는 없다. 본 검토는 base86 전체 의미·실DB·current root gate·doctor 통과를 인증하지 않았다.
