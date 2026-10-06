# HRM modern native-identity successor v1

상태: `DESIGN_PROPOSED_G3_NONE`. 이 패키지는 작성자 설계·schema/경계 검사이며 정본 overlay, 독립 승인, 실제 권한·PEP 또는 Gate PASS가 아니다. 역사적 `hrm-modern-remediation.v1.json` SHA `1b93c3b7b89137f4c742789f336beb834cef1944fac0577278a84283a759bc4a`와 기존 BASE/감사 핀은 변경하지 않았다.

## 범위와 제거

기존 6 capabilities의 82 operation ID를 모두 보존하고 `modern.onboarding.journey.employment.bind` 1개를 추가했다. 각 operation의 method/path/input/read/write/state 및 신원 모드는 JSON `nativeIdentityPreparation.operationReviewRegistry`에 있다. 이 registry는 저자의 expected scope이며, 별도 소유자의 독립 정본 scope registry 승인은 OPEN이다.

`ppl_principal_worker_links`와 그 provisioning/proof/journal owner port를 제거했다. 기존 34 tableDeltas 중 33을 유지하며, 별도 계획 `ppl_rec_person_admission_receipts` 1개를 명시했다. 이는 후보자·동의·source·native person 입장 결과의 immutable 업무 receipt이며 principal↔worker 권한 원장이 아니다. 이 신규 표와 internal admission command/query의 완전한 physical/schema/source 등록·비충돌 예약·BASE admission 계약 통합은 OPEN이다. 단순히 34개 수를 맞췄다는 완결성 주장은 하지 않는다.

역사 v1에서 발견한 journal/selfContextId/proof 참조 348개(KEY 10, VALUE 338)를 JSON pointer·원문 SHA·operation/capability·삭제/대체 종류로 기록했다. sections: typeDefinitions 11, capabilities 25, operationDeltas 58, tableDeltas 5, recordSchemas 42, responseSchemas 2, identityMappingDelta 37, ownerContractDeltas 7, ownerSnapshots 99, operationFieldLineage 48, configurationFixtures 9, prerequisiteProfiles 3, crossCapabilityJourneys 2. 원문은 `historicalReferenceDisposition`와 역사 입력 table 목록에만 남는다. 거부 테스트의 old selector는 의도적 negative 입력이며 정상 계약으로 재사용하지 않는다. 정상 candidate 실행 영역에 forbidden 참조는 0개이다. 이 분류와 문자열 부재 자체를 업무 source 의미의 독립 PASS로 해석하지 않는다.

## native source와 권한 경계

Auth 소유 `com_users.person_public_id` → People `ppl_persons`를 재사용한다. Auth principal UUID, person UUID, worker UUID는 서로 다른 identity space이며 correlation/digest/businessKey 또는 BIGINT를 UUID로 변환하지 않는다. Auth의 `version`/`access_revision`과 현재 binding/authority를 재조회한다. HRM은 Auth table을 쓰거나 새 identity journal·linkPublicId selector를 만들지 않는다.

고용 목적만 worker/relationship/assignment 3UUID selector와 person/worker/relationship/assignment native versions를 사용한다. People owner가 같은 tenant의 실제 parent BIGINT 관계를 join한 결과를 검증한다. DATE 경계는 assignment owner zone에서 asOf를 civil DATE로 변환하여 양 끝 inclusive이며 동일 assignment slice의 max effective sequence를 선택한다. 충돌/누락 zone/불완전 context set을 첫 행이나 UTC로 대체하지 않는다. asOf freshness/history는 별도의 immutable purpose policy 조건이다. 짧은 authority lease만으로 오래된 asOf가 안전하다고 간주하지 않는다.

`NativeSelectedEmployment`의 18 field adapters는 실제 `AuthPersonBindingV1`, `NativeSelfContextSetV1`, guard `SELECTED` getter와 검증된 query.asOf를 참조한다. `NativeSelfPerson`의 9 adapters는 실제 `SelfPersonResolutionV1` binding/person/verifiedAt getter를 참조한다. 22 Java/DDL source의 path/SHA/bytes/lines/decimal-string mtimeNs를 JSON에 핀했다. source를 관찰했다는 사실은 transport/public DTO 등록·현재 signed proof·PEP·field policy가 생산 배선되었다는 증거가 아니다.

관찰한 `SelfPersonPortV1.resolve()`는 caller 입력 0개, owner-clock current-only이다. 요청 body의 person/tenant/principal/asOf는 이 port에 전달하지 않는다. HRcase expectedPersonVersion은 current resolution 이후 별도 write guard이다. 실제 fixed guard는 `SELF_PROFILE_READ / HRIS_HRM`, `appEntitled=true`, SoD를 유지한다. 고용 entity/EMPLOYEE role이 불필요하다는 것과 앱 entitlement가 불필요하다는 것은 다르다.

HRcase create/read·onboarding read/task complete/waive는 profile-read identity와 별도의 action/population/field 권한이다. 현재 fixed SelfPerson 후보가 이를 이미 승인했다고 주장하지 않는다. 비앱 prehire task는 `DWP.NativePersonTaskAuthority.proposal.v1`의 native Auth binding + task owner assignee/delegate + exact task/action/current grant tuple을 쓰는 별도 work/task surface 계획으로 분리했다. 명시적 task grant·현재 purpose proof·producer DTO/SPI/transport 등록은 OPEN이며 자동 APP.HCM/grant 0이다. metadata의 closed request/response field 계획은 현재 source producer가 아니다.

관리자 population은 self SPI와 다르다. `NativeAuthorizedEmploymentSubject` 계획은 명시 target native tuple을 owner가 query하고 현재 actor purpose/field/population 정책으로 승인한다. target person을 caller Auth binding으로 위조하거나 self fallback하지 않는다. 이 owner port도 미게시다.

## 업무 수정

ATS의 requisition/candidate/offer/hire-handoff 분리는 유지한다. 후보자 admission은 consent/source/vault 증거와 실제 native Person 생성/재사용 owner 결과를 refetch하며 personToken SHA로 Person UUID를 만들지 않는다. candidate/prehire/hire 요청은 미래 worker/assignment·직원 앱·Auth 계정을 입력 선결로 강요하지 않는다.

WorkerProposal은 `CREATE_NEW_WORKER`와 `REUSE_NATIVE_WORKER`를 분리한다. REUSE는 existing native worker UUID/version, 동일 native person parent, pinned reuse policy를 모두 검증하며 CREATE는 reuse selector를 금지한다. 재입사/해지/인사 merge/relink provenance·asOf owner policy의 실제 publication은 OPEN이다. Auth relink는 별도 Auth 소유 CAS/version/access-revision 및 proof revoke 순서 계약이며 HRM hire의 SQL 부수효과나 autogrant가 아니다.

온보딩 할당 subject는 closed union `PREHIRE_PERSON(candidateCaseId,personAdmissionReceiptId)` 또는 `EMPLOYMENT(native selector,versions,worker snapshot)`이다. prehire는 person·native admission receipt와 명시 template/task assignee, pinned calendar/onboarding zone/tzdb로 동작하며 worker 컬럼은 nullable typed absence이다. task 반복 완료와 assignment 완료 lifecycle은 유지하고, prehire 완료 이벤트는 필수 person/subjectKind/nativeBindingState를 내보내며 worker가 없어도 schema-valid이다.

추가 native bind 명령은 기존 assignment CAS + accepted/refetched hire receipt + 동일 native person/admission parent + 현재 eligible native tuple/version을 검증한다. `PERSON_ONLY → EMPLOYMENT_BOUND`는 task lifecycle과 별도이다. COMPLETED prehire도 task 재개 없이 bind할 수 있으며 CANCELLED/future/conflicting/replay-changed receipt는 거부한다. historical hire receipt에 native tuple이 없으면 unsupported version이지 synthetic 성공이 아니다.

복리후생 self enrollment/lifeevent는 고용 selector와 plan/eligibility/config version을 refetch한다. HRservice requester는 current person/principal로 보존하며 implicit worker를 생성하지 않는다. 이후 domain CAS update는 신규 요청 신원으로 기존 tuple을 덮지 않고 실제 loaded prestate/RETURNING을 보존한다. provider callback의 CAS source는 undeclared If-Match가 아니라 원래 stored provider request payload의 enrollmentVersion이다.

22 native source-write plans는 body path, owner raw DTO, guard outcome, loaded CAS row, original provider payload, INSERT/UPDATE RETURNING, clock, public UUID allocator, command receipt/outbox dependency를 명시한다. 1,585 typed-source 수는 의미 closure 증거가 아니다. 상속한 비신원 source graph/event/read/write 전체의 독립 의미 검토와 canonical validator 호환은 여전히 OPEN이다.

## 실제 작성자 검사

Node 20 + Ajv 6.12.6 Draft-07, full formats, coercion/default/removal 비활성으로 저장된 JSON schemas/fixtures를 실행한다.

```sh
node output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/hrm-modern-native-identity-successor.v1.check.js
```

최종 실행값은 companion evidence에 고정한다: 383 schemas, 83 request-shape witnesses, A/B 구체 identity boundary 요청 10개, 543 assertions, positive 9, negative 31, failures/source-pin drift/undeclared body-header source/typed source-shape defect 0. old 82 ID의 실제 역사 입력과 candidate 보존을 검사한다. shape witnesses는 업무적으로 유효한 83개 여정이 아니다. 10 요청은 명시 owner prerequisites를 갖춘 author fixture이지 HTTP/owner producer 실행 receipt가 아니다.

negatives는 tenant/Auth person 및 revision mismatch, expired/revoked mock, purpose, HRIS person app=false, profile-read-as-action, parent mismatch, duplicate/partial selector, version, inclusive end/DST, missing zone, body selfclaim/old journal input, prehire worker 입력, future/canceled/changed hire bind, native worker reuse policy/parent/version, implicit Auth relink를 검사한다. current-only person 모델은 employment DTO/query가 없어도 동작하지만 HRIS app entitlement는 유지한다. 실제 Java guard/signature/PEP/transport를 이 JS 모델이 실행하지 않는다.

공통 SelfPerson 작성자의 별도 72 focused tests 보고서 `coding-readiness/reports/identity-self-person-abi-author-verification-2026-09-14.json` SHA `e99289365114efc9ff76e7705ded6978725ffdcea8d954c4865ed47606589fc0`를 읽었다. 이는 guard 48/JDBC 16/native PG 8, failure/error/skip 0을 기록한다. 이 task가 재실행한 결과가 아니며 current verifier/Auth는 explicit mock, production wiring/G3Approval=false이다.

## 다음 내부 검토와 단계

G3 OPEN: independent expected scope registry/owner contract registration, People common V49와 HRM domain V50+ 비충돌 내부 예약·source approval, 실제 current authority/lifecycle/revoke producer, purpose/field/action PEP, task/non-app source port, native admission/reuse/receipt source compatibility, immutable config authority, exact canonical source dialect/SQL/event oracle 통합, shared fail-closed adapters 및 소비자 compile/current common·pilot 준비 증거. 승인 책임은 내부 Security/Auth/People/DWP task/Control 전문가·코드 owner 검증이며 고객 자료나 사용자의 새로운 의사결정을 요구하는 것이 아니다.

G4: domain CRUD/SQL/outbox/receipt producers 및 전체 83-operation native 업무 여정 구현·실행. G3 coding 준비에 이를 선행 요구하지 않는다. G6: 고객 identity authority/adoption과 optional connector/country/provider의 실제 운영 활성화. 모든 고객에게 modern feature/employee 앱을 강제로 설치하지 않는다.

소유권: 이 successor JSON/MD/schemas/fixtures/check.js/fixture-check.js/evidence만 HRM 설계 author 소유다. root의 canonical registries/Gate, 현재 2007-line lineage checker, 기존 BASE/modern 역사·감사, BE/main/SQL은 수정 0이다. canonical mapping·공통 identity source 및 모듈 코드 fanout은 각 owner/root 후속이며, 본인 작성 후보는 독립 승인 대상에서 제외한다. Gate는 CLOSED 그대로다.
