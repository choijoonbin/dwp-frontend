# HRM/PER BASE preparation successor — 2026-09-14

상태: **DESIGN_PROPOSED_NOT_CANONICAL / G3 승인 NONE / 독립 P0 CLOSED 아님**.

새 [JSON 설계](hrm-per-base-preparation-successor.proposal.v1.json), [구체 fixtures](hrm-per-base-preparation-successor.fixtures.v1.json), [전용 검사](hrm-per-base-preparation-successor.check.v1.js)는 BASE-P0-007/008/009의 수정 설계를 실제로 작성한 successor 패키지다. 기존 G2 SQL/API, HRM/PER modern v1, population-freeze 제안 및 감사 핀은 보존했다. 새로운 109개 operation 설계를 기존 정본 count에 합산하거나 승인된 개발 범위로 간주하면 안 된다.

## 실제 보완

| 지적 | 이 패키지의 변경 | 승인 전 남는 조건 |
|---|---|---|
| BASE-P0-007 | 12종 EmploymentEvent의 closed discriminator/payload 및 admission/변경별 native write/source. arbitrary changes/patch 대신 bounded NAME·EMAIL/PHONE·governed assignment proposal. 후보자/공고/offer/hire handoff와 onboarding template version/assignment/task 분리. | HRM 내부 source/SQL 검토, 새 reference public UUID·same-day effective sequence/중복 worker 정책·확장 이벤트의 exact 등록 |
| BASE-P0-008 | Cycle/Goal/Evaluation/Calibration/Result의 각각 저장 상태와 정확 command/query/CAS. frozen reviewer·template·participant tuple 및 immutable submission. 이전 값·grade·cohort 영향·결과는 owner 계산. | PER source 재설계 검토, DTO/SPI/공통 fail-closed 배선 및 exact SQL successor 통합; 다른 feedback/checkin/appeal 범위는 별도 |
| BASE-P0-009 | 역사적 closed allOf의 유효 4-field witness가 실제 Ajv에서 거부됨을 재현. 새 flattened closed FreezePopulation은 실제 preview identity/version/asOf와 rule/workforce 네이티브 vector를 다시 읽는 구체 요청을 수용. | 새 transport/owner query/consumer compile 등록; 기존 역사 API를 자동 변경한 것이 아님 |

JSON에는 181개 schema, 14개 객체 machine, 20개 query, 9개 **미게시** owner port, 11개 physical change plan이 있다. 계획된 table/column 및 typed content는 작성된 설계이며 현재 실제 domain DDL/CRUD가 아니다. 단순 숫자를 업무 의미 완결성으로 취급하지 않는다.

### HRM 입력과 source

HIRE/REHIRE는 새 assignment가 아직 없으므로 기존 AssignmentEvent의 assignment_id NOT NULL 전제를 admission-only NULL로 수정하도록 계획했다. admission snapshot에는 현재 person·선택한 기존 worker/종료 relationship·유효 master refs만 있으며 미래 assignment UUID를 만들지 않는다. publish의 실제 INSERT RETURNING에서 새 worker/relationship/assignment 결과를 결속한다. 일반 변경은 CAS-loaded 부모와 변경하지 않는 org/job/location/manager/hours를 보존한다.

TRANSFER/PROMOTION/DEMOTION/CONCURRENT_ASSIGNMENT/CHANGE_MANAGER/CHANGE_LOCATION/LEAVE/RETURN/TERMINATION/CORRECTION은 서로 다른 typed payload와 selected native write branches를 가진다. public UUID는 각각 tenant-scoped 실제 PK로 해결한다. manager assignment UUID는 manager의 assignment_key로 해결하지 조직/position UUID가 되지 않는다. correlation은 tracing일 뿐 business ID/FK/deduplication이 아니다.

TERMINATION은 해당 relationship과 그 assignment만 종료한다. 다른 유효 employment가 있으면 worker ACTIVE를 보존하며 Auth/person status를 자동 비활성화하지 않는다. correction은 기존 published event·slice·downstream evidence를 덮어쓰지 않는 새 intent다.

실제 source와 schema gap은 JSON sourcePins 및 sourceEvidenceSelectors에 기록했다. 현재 native DATE upper bound는 inclusive이며 역사 planned half-open exclusion과 같다고 가정하지 않았다. 같은 날 sequence/primary precedence와 HIRE existing-worker reuse 확장은 **G3 내부 HRM 검토 OPEN**이다. source probation/release·dispatch-release 등은 CORRECTION에 억지로 매핑하지 않고 미검증 확장으로 남겼다.

### 기존 신원 chain 재사용

Auth com_users.person_public_id → trusted Gateway → People person/worker/relationship/assignment의 native FK·독립 UUID·version을 재사용한다. client self-selector는 **worker/relationship/assignment 3 UUID**이고 person은 Auth owner가 결정한다. NativeTuple의 person+version은 authorized business TARGET/snapshot이며 self 주장으로 사용할 수 없다.

새 principal_worker_links 원장, PrincipalWorkerEmploymentLink, linkPublicId selector, principalUUID=person/worker, body worker UUID만으로 self 인정은 금지했다. 기존 HRM modern v1의 shadow-link 방향은 역사 입력으로 보존했으나 지지하지 않는다. 이를 제거하고 rebind하는 modern successor는 별도 남은 작업이다.

V1..V48 capture에는 legal employer/job profile/location/grade의 공개 UUID가 없으므로 현재 source published=false다. root는 별도 common People V49 legal-employer UUID forward migration을 추가 중이며 본 capture의 기존 SHA를 소급 수정하지 않았다. 새 stable source/검토를 후속 통합해야 한다. HRM domain은 잠정 V50+ 경계이고 여기서는 Flyway 번호를 임의 선택하지 않았다.

### PER 객체와 owner 계산

Goal 반환은 DDL에 없는 RETURNED를 쓰지 않고 SUBMITTED→DRAFT 새 revision으로 표현했다. evaluation은 frozen participant/reviewer/stage/template/cycle tuple을 로드하고 실제 Auth-person→native reviewer binding과 3-UUID selector를 교차 확인한다. submitted answer는 불변이고 반환/수정은 새 draft submission이다.

calibration 요청에서 previousValue/previousGrade/adjustedGrade/distributionImpact를 제거했다. owner가 exact baseline·이전 durable adjustment·full frozen cohort·typed scoring config로 값을 계산한다. result의 개인 점수와 cohort mean은 분리했다. correction은 새 COMPUTED set이며 이전 published rows를 즉시 변경하지 않는다. 단계 완료·waiver·source revision은 owner 조회 값이지 client count가 아니다.

strict ScoringPolicy는 단위, decimal6, MEAN/WEIGHTED_MEAN, HALF_EVEN/HALF_UP/DOWN, grade bands, explicit component/stage weights, missing/withheld/NOT_APPLICABLE 정책과 calibration bounds를 정의한다. 회사 코드·국가 법정 숫자·스크립트·실행 가능한 임의 formula는 core에 넣지 않았다.

### 공고/후보자·onboarding

공고 create/publish는 후보자를 생성하거나 CandidateStageChanged를 내지 않는다. native manual candidate admission은 optional connector 없이 personToken/source key/consent/requisition을 입력한다. offer를 발행한 candidate와 accepted-offer→People hire receipt handoff를 독립적으로 관리한다. OFFERED/HIRED는 coupled guarded outcome이며 임의 pseudo stage가 아니다.

published template version의 exact tasks를 assignment/task instances로 스냅샷한다. task 완료는 IN_PROGRESS loop이고 별도 all-required guard가 assignment COMPLETED를 만든다. optional pending task는 required 완료를 막지 않는다. NAMED_NATIVE_WORKER는 실제 NativeTuple이 필수이며 SUBJECT/HR_OPERATOR는 client-supplied worker tuple을 받지 않는다. waiver/이미 offer된 후보 취소/accepted-offer revocation의 전체 exact 흐름은 별도 OPEN이며 암묵적으로 승인하지 않았다.

## 실제 bounded 검사

명령:

~~~sh
node coding-readiness/semantic-remediation/hrm-per-base-preparation-successor.check.v1.js
~~~

Ajv 6.12.6, Node v20.20.2, Draft-07 full format, coercion/default/추가필드 제거 없이 exit 0.

- 181개 schema compile·mechanical schema probe. 이 probe는 source 업무 의미 승인이 아니다.
- 101개 구체 API 요청; A/B 각 42-step cycle→freeze→goal→4 evaluation→calibration→individual results→close owner 모델.
- A: review source가 baseline 1.500000/3.500000을 실제 계산; 첫 participant만 2.500000으로 adjustment, 개인 결과 2.500000/3.500000, cohort mean 3.000000.
- B: ratio review source가 0.400000/0.800000; 첫 participant만 0.600000, 결과 0.600000/0.800000, cohort mean 0.700000.
- 15개 실제 negative 및 4개 checker 변조 거부. missing owner/tenant/native parent/CAS/owner revision/SoD/terminal/key reuse/caller impact/unit/missing source/freeze stale/incomplete task/candidate missing을 검사한다.
- 637개 합산 assertion, selected column binding 640개 static 확인, source pin 27개 drift 0. 이 수치에 mechanical checks가 포함되며 전체 field-lineage 폐쇄를 뜻하지 않는다.

상세 실행 결과와 입력 SHA는 [작성자 evidence](hrm-per-base-preparation-successor.evidence.v1.json)에 보존한다. 실제 domain DB·HTTP·signed issuer/AuthorityVerifier·full native producer를 실행하지 않았다. fixture digest는 reproducible canonical content hash이며 생산 framing/신뢰 권한 검증을 대신하지 않는다. canonical semantic lineage PASS나 독립 승인으로 기록하지 않았다.

## 소유권과 남은 준비 경계

HRM은 event/person/assignment/candidate/onboarding exact design·DDL·domain tests, PER은 performance stream의 cycle/goal/evaluation/calibration/result/freeze tests를 소유한다. JSON testAllocation에 aggregate별 test class와 source assertions를 지정했다. Control은 공유 ABI/route/schema/stream 통합 및 소비자 compile, Auth/Security는 current owner authority/PEP/step-up을 소유한다. 여기서는 이 코드를 선행 개발하지 않았다.

G3 남는 작업은 내부 전문가/코드 owner의 source 설계 검토, 충돌 없는 owner allocation, 승인된 exact DTO/SPI 등록, 실제 shared fail-closed adapter/authority/refetch/consumer compile·공통 pilot smoke이다. 이는 고객 자료·외부 승인·사용자의 새로운 의사결정을 요청하는 조건이 아니다.

G4 전체 업무 CRUD/migration/도메인 여정 실행은 coding-ready의 선행 조건으로 요구하지 않는다. 실제 고객 identity authority/법정 pack/provider/생산 채택은 G6다. BENSK/ADDSK bytes와 회사 전용 source 코드/숫자를 재사용하지 않았고 BASE86/IA98 전체 의미 수용·완전 source 복원은 인증하지 않았다.

backend HEAD db0d2b…는 유지되었으나 root/다른 작업의 Auth/identity/V49 changes가 진행 중이다. 전체 tree clean/불변이라는 주장은 하지 않는다. 본 작업은 이 prefix의 신규 설계·fixture·checker·evidence만 작성했고 backend/SQL/권한/Gate/commit은 수정하지 않았다.
