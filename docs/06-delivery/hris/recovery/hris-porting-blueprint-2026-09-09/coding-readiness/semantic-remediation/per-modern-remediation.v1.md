# PER 현대 기능 의미 재설계 제안 v1 — 2026-09-14

## 상태와 범위

**DESIGN_PROPOSED / G3 CLOSED / 독립 PASS 아님.** 이 문서는 독립 제품 감사와 구별되는 작성자의 재설계 제안이다. 기존 `session-evidence/per/g3-modern-capability-contracts.v1.json`, 역사적 v2 및 기존 exact schema/register는 수정하지 않았다. 이 제안의 개수를 기존 modern100에 맞추지 않았다. 코드·SQL·실행 테스트 결과는 없다.

Machine-readable 정본은 [per-modern-remediation.v1.json](per-modern-remediation.v1.json)이다. 독립 지적은 [제품 감사](../reports/global-product-semantic-audit-2026-09-14.md)와 typed findings JSON에 있다. 신규 제안만으로 원래 지적을 CLOSED로 바꾸면 안 된다. **base 86 family 전체 의미 무결성도 이 감사에서 인증하지 않았다.**

| 항목 | 제안 |
|---|---:|
| Capability | 6 |
| Operation | 85 |
| Domain table | 26 |
| Typed artifact / immutable command receipt table | 1 / 1 |
| 객체별 state machine | 14 |
| Typed domain event | 63 |
| 정확 content/reference/receipt schema | 29 |
| 응답 projection schema | 38 |
| Synthetic config / case | 12 / 44 |

## 글로벌 적합성과 제품 경계

Skills/learning/internal mobility/succession/compensation을 서로 연결하되 하나의 만능 평가·추천 객체로 합치지 않는다. 이 범위는 [Oracle Talent Management](https://www.oracle.com/human-capital-management/talent-management/)의 연결된 talent 방향과 부합하지만 모든 고객의 첫 릴리스 의무라는 뜻은 아니다. 직원 자기 진술과 검증된 evidence, 인간 선정/승인과 자동 추천을 분리한다. [Workday Responsible AI Practices](https://www.workday.com/en-us/artificial-intelligence/responsible-ai-practices.html)

설정형·이벤트형 업무흐름은 공통 foundation을 사용하지만 객체별 의미를 generic businessKey/changeSetDigest로 대체하지 않는다. [Workday Business Process Framework](https://www.workday.com/content/dam/web/en-us/documents/datasheets/workday-business-process-framework.pdf)

- Product Core: 공개 ABI, strict schemas, 객체별 lifecycle, idempotency, immutable evidence, 목적/범위/field policy/SoD.
- Country Pack: 실제 국가 규정·법정 급여/복지 연계 활성화 G6; 본 제안은 법정값을 제공하지 않는다.
- Tenant Config: taxonomy proficiency vocabulary, visibility/consent, learning capacity/eligibility, mobility criteria, succession readiness/audience, guideline/budget/component/rounding version. 회사명/조직코드/금액한도/법정식을 코드에 넣지 않는다.
- Signed Extension: typed provider/HRM/SYS SPI; arbitrary Map, 직접 DB 접근, 자기 서비스 HTTP, 미승인 provider secret 금지.
- BENSK/ADDSK 화면·테이블·공식 재사용 없음. PER에 payroll 계산기/benefits 엔진을 추가하지 않는다.
- Home widget-only; 7-workbench IA의 내 HR/팀/성과에서 목적별 task entry. 새 최상위 업무 메뉴를 임의 추가하지 않는다.
- G4 전체 동작 수용 완료 후 G5 전체 메뉴·full-screen Design AI prompt+검증 ZIP 필수. 시각 작업이 업무 의미 결함을 대신 해결하지 않는다.

## 실제 내용과 owner refetch

`prf_per_artifact_versions`는 schema/version/owner aggregate ID/type/revision/effective interval와 canonical typed bytes를 **같이** 보존한다. 내용은 암호화된 BYTEA이며 digest만 저장하는 설계가 아니다. 15개 closed artifact type은 각각 하나의 exact schema에 결속한다. 상세 데이터는 typed columns 또는 artifact의 정확한 nested fields에 존재한다.

`PerTypedArtifactQueryPort.v1`은 모듈-local owner 계약이다. public typed-artifact refetch도 먼저 소유 aggregate의 read duty/population/field/purpose를 확인한다. 일반 artifact duty로 비공개 coaching/succession/salary를 우회하지 못한다. ID/type/schema/revision/owner/tenant/digest mismatched ref는 decode 전에 opaque deny. 임의 blob/JsonNode로 업무 내용을 받지 않는다.

Canonical SHA-256 input은 schemaId/version/owner type/owner UUID/artifact revision의 명시 framing과 strict canonical typed UTF-8 content다. object keys는 재귀 정렬, array는 명시 업무 순서 유지, temporal/money lexical은 strict wire 규칙이다. 정정은 새 artifact/revision이며 기존 published/completed snapshot byte는 불변이다. 보존기간/법적보류/삭제는 별도 governed Control policy이며 무기한 보존을 약속하지 않는다.

`prf_per_command_receipts`는 actor/tenant/action/idempotency hash/target/schema/content/purpose를 결속한다. 동일 요청은 원 receipt/result를 반환하고 두 번째 business/artifact/event insert가 0, 같은 key의 다른 요청은 409다. `X-Correlation-ID`는 receipt/audit control context 외 business UUID/FK로 사용할 수 없다.

## 의존계약과 독립 세션

PER는 People runtime의 `hris.performance` 및 `hris_performance` Flyway stream만 소유한다. HRM repository/entity/table을 import/read하지 않는다. Control은 공유 ABI/생성기/route/build scaffold 공급과 병합·quality gate를 담당하고 PER 전체 domain 코드·migration CREATE·test는 PER owner가 수행한다.

| Source owner | 필요한 정확한 계약 | 시작 전 조건 |
|---|---|---|
| HRM | authenticated principal→worker binding | tenant/principal/worker/assignment/revision/effective/scope exact typed owner query |
| HRM | compensation workforce population | 기존 WorkforceSnapshotQueryPort의 명시 projection amendment; grade/job/org/eligible component/revision 실제 값과 immutable refetch |
| SYS | versioned policy/config | config scope, learning eligibility/assignment, mobility match, succession audience/readiness, compensation guideline/rounding의 exact schema/published/effective/digest |
| Approval | decision receipt | 대상/action/version/content/actor/policy digest 결속; maker-checker/live 권한 |
| HRM | worker change by selection decision | JOB_MOVE 선정 이후 HRM 독립 변경 proposal/승인; materialized change 정정은 승인된 reversal receipt 필요 |
| PAY | ApprovedCompensationPlanSnapshot.v1 | XCON-020/SVC-PEP-PER-001 ABI 유지; PER 승인 immutable N-line source→PAY N-input freeze |

이 owner port/projection/amended schema의 신규 allocation·scaffold·dependency order는 **아직 정본 통합 전**이며 G3 entry blocker다. 새 논리 port 이름을 기재했다는 이유로 구현 가능/compile PASS를 주장하지 않는다.

## Capability별 실행 설계

### SKILLS_ONTOLOGY

실제 typed content: `SkillTaxonomyContent.v1`, `SkillEvidenceContent.v1`, `SkillEvidenceObservation.v1`. 전체 nested fields, bounds, refs는 JSON `schemas`에 있다.

Domain tables: `prf_skl_taxonomies`, `prf_skl_taxonomy_versions`, `prf_skl_worker_evidence`. 공개 UUID와 tenant-local BIGINT identity를 분리하고, 모든 local FK는 tenant 복합키로 결속한다. Table specs에는 실제 business columns와 response fieldSources가 있다.

| 객체 | 최초 진입 | 정확 전이 |
|---|---|---|
| TaxonomyVersion | createTaxonomyDraft → DRAFT | replaceTaxonomyDraft: DRAFT→DRAFT<br>validateTaxonomy: DRAFT→VALIDATED<br>publishTaxonomy: VALIDATED→PUBLISHED<br>rejectTaxonomy: VALIDATED→REJECTED<br>retireTaxonomy: PUBLISHED→RETIRED |
| SkillEvidence | submitSkillEvidence → SUBMITTED | verifySkillEvidence: SUBMITTED→VERIFIED<br>rejectSkillEvidence: SUBMITTED→REJECTED<br>revokeSkillEvidence: VERIFIED→REVOKED<br>correctSkillEvidence: VERIFIED→SUPERSEDED |

Parent/catalog와 version/assignment/child의 상태를 서로 복사하지 않는다. 작성/발행이 없는 child를 자동 생성하지 않는다. 정정 새 객체/버전의 predecessor와 현재 live 동의/권한/source가 명시되어 있다.

| Operation | 실제 typed 입력 | Domain write |
|---|---|---|
| GET queryTaxonomies | 없음 | NONE |
| GET getTaxonomyVersion | 없음; path taxonomyId, version | NONE |
| POST createTaxonomyDraft | taxonomyPublicId:UUID nullable, configurationScopePublicId:UUID, content:SkillTaxonomyContent.v1, effectiveFrom:DATE | prf_skl_taxonomies [taxonomy_key, configuration_scope_id, status]<br>prf_skl_taxonomy_versions [skill_taxonomy_id, version_no, artifact_public_id, artifact_revision, content_digest, effective_from, effective_to, status] |
| PUT replaceTaxonomyDraft | content:SkillTaxonomyContent.v1; path taxonomyId, version | prf_skl_taxonomy_versions [version_no, artifact_public_id, artifact_revision, content_digest, effective_from, effective_to, status] |
| POST validateTaxonomy | 없음; path taxonomyId, version | prf_skl_taxonomy_versions [status] |
| POST publishTaxonomy | approvalReceiptPublicId:UUID; path taxonomyId, version | prf_skl_taxonomies [status]<br>prf_skl_taxonomy_versions [status, effective_from, effective_to] |
| POST rejectTaxonomy | reasonCode:STRING; path taxonomyId, version | prf_skl_taxonomy_versions [status] |
| POST retireTaxonomy | reasonCode:STRING, replacementVersionRef:PerArtifactRef.v1 nullable; path taxonomyId, version | prf_skl_taxonomy_versions [status, effective_to] |
| POST submitSkillEvidence | content:SkillEvidenceContent.v1 | prf_skl_worker_evidence [worker_public_id, skill_public_id, taxonomy_version_public_id, artifact_public_id, evidence_digest, proficiency_code, source_type, source_revision, consent_revision, observed_at, expires_at, status, supersedes_evidence_public_id, verification_receipt_public_id, verified_at] |
| POST verifySkillEvidence | verificationReceiptPublicId:UUID; path evidenceId | prf_skl_worker_evidence [status, verification_receipt_public_id, verified_at] |
| POST rejectSkillEvidence | reasonCode:STRING; path evidenceId | prf_skl_worker_evidence [status] |
| POST revokeSkillEvidence | reasonCode:STRING, consentRevision:BIGINT; path evidenceId | prf_skl_worker_evidence [status, consent_revision] |
| POST correctSkillEvidence | content:SkillEvidenceContent.v1; path evidenceId | prf_skl_worker_evidence [status] |
| GET queryWorkerSkillProfile | 없음; path workerId | NONE |

각 operation JSON에 method/path, exact request schema, readsTables, selected write columns/source, CAS 보존열, typed source/entity/ref binding, emits, authorization, query artifact refetch와 guard가 있다. 공통 receipt/audit/semantic outbox는 동일 owner transaction에 원자적으로 기록한다.

Synthetic config A/B 차이와 구체 flow: SKILLS_ONTOLOGY-HAPPY-A → {"taxonomyState":"PUBLISHED","evidenceCount":2,"evidenceStates":["VERIFIED","VERIFIED"],"profileProficiency":"WORKING","sourceTaxonomyVersion":1,"events":["SkillsTaxonomyPublished.v1","WorkerSkillEvidenceVerified.v1"]}; SKILLS_ONTOLOGY-HAPPY-B → {"taxonomyState":"PUBLISHED","evidenceCount":2,"evidenceStates":["VERIFIED","VERIFIED"],"profileProficiency":"WORKING","sourceTaxonomyVersion":1,"events":["SkillsTaxonomyPublished.v1","WorkerSkillEvidenceVerified.v1"]}.

추가 독립 검사 입력: SKILLS_ONTOLOGY-DENIED-1 (content.edges=[self edge skill30->skill30]); SKILLS_ONTOLOGY-DENIED-2 (evidence verifier=employee that submitted EMPLOYEE_ASSERTION); SKILLS_ONTOLOGY-DUPLICATE (same-key replay/cross-tenant owner mock); SKILLS_ONTOLOGY-CORRECTION (createTaxonomyDraft); SKILLS_ONTOLOGY-CROSS-TENANT (same-key replay/cross-tenant owner mock).

### GROWTH_PROFILE

실제 typed content: `GrowthAssertion.v1`, `CoachingNote.v1`. 전체 nested fields, bounds, refs는 JSON `schemas`에 있다.

Domain tables: `prf_grw_profiles`, `prf_grw_aspirations`, `prf_grw_evidence_links`, `prf_grw_coaching_notes`. 공개 UUID와 tenant-local BIGINT identity를 분리하고, 모든 local FK는 tenant 복합키로 결속한다. Table specs에는 실제 business columns와 response fieldSources가 있다.

| 객체 | 최초 진입 | 정확 전이 |
|---|---|---|
| GrowthProfile | createGrowthProfile → ACTIVE | archiveGrowthProfile: ACTIVE→ARCHIVED |
| Aspiration | addAspiration → ACTIVE | replaceAspiration: ACTIVE→ACTIVE<br>removeAspiration: ACTIVE→REMOVED |
| EvidenceLink | linkGrowthEvidence → LINKED | unlinkGrowthEvidence: LINKED→REVOKED |
| CoachingNote | recordCoachingNote → RECORDED | correctCoachingNote: RECORDED→SUPERSEDED |

Parent/catalog와 version/assignment/child의 상태를 서로 복사하지 않는다. 작성/발행이 없는 child를 자동 생성하지 않는다. 정정 새 객체/버전의 predecessor와 현재 live 동의/권한/source가 명시되어 있다.

| Operation | 실제 typed 입력 | Domain write |
|---|---|---|
| GET queryMyGrowthProfile | 없음 | NONE |
| GET getGrowthProfile | 없음; path profileId | NONE |
| POST createGrowthProfile | 없음 | prf_grw_profiles [worker_public_id, status, profile_version, archived_at] |
| POST addAspiration | content:GrowthAssertion.v1; path profileId | prf_grw_aspirations [growth_profile_id, aspiration_key, aspiration_type, artifact_public_id, artifact_revision, visibility, consent_revision, target_date, status] |
| PUT replaceAspiration | content:GrowthAssertion.v1; path profileId, aspirationId | prf_grw_aspirations [aspiration_key, aspiration_type, artifact_public_id, artifact_revision, visibility, consent_revision, target_date, status] |
| POST removeAspiration | reasonCode:STRING; path profileId, aspirationId | prf_grw_aspirations [status] |
| POST linkGrowthEvidence | evidencePublicId:UUID, evidenceRevision:BIGINT, consentRevision:BIGINT; path profileId | prf_grw_evidence_links [growth_profile_id, evidence_public_id, source_revision, consent_revision, consent_expires_at, status] |
| POST unlinkGrowthEvidence | reasonCode:STRING; path profileId, linkId | prf_grw_evidence_links [status] |
| POST recordCoachingNote | content:CoachingNote.v1; path profileId | prf_grw_coaching_notes [growth_profile_id, coach_principal_public_id, artifact_public_id, artifact_revision, employee_visible, occurred_at, status] |
| POST correctCoachingNote | content:CoachingNote.v1, reasonCode:STRING; path profileId, noteId | prf_grw_coaching_notes [status] |
| POST archiveGrowthProfile | reasonCode:STRING, portabilityExportRequested:BOOLEAN; path profileId | prf_grw_profiles [status, archived_at] |
| POST exportGrowthProfile | purposeCode:STRING; path profileId | NONE |

각 operation JSON에 method/path, exact request schema, readsTables, selected write columns/source, CAS 보존열, typed source/entity/ref binding, emits, authorization, query artifact refetch와 guard가 있다. 공통 receipt/audit/semantic outbox는 동일 owner transaction에 원자적으로 기록한다.

Synthetic config A/B 차이와 구체 flow: GROWTH_PROFILE-HAPPY-A → {"profileState":"ACTIVE","aspirationCount":2,"assertionText":"Develop synthetic analysis competence","linkedEvidenceCount":1,"verifiedEvidenceCreationDelta":0,"managerVisibleAspiration":{"byConfig":{"A":false,"B":true}},"events":["GrowthAspirationCreated.v1","GrowthEvidenceLinked.v1"]}; GROWTH_PROFILE-HAPPY-B → {"profileState":"ACTIVE","aspirationCount":2,"assertionText":"Develop synthetic analysis competence","linkedEvidenceCount":1,"verifiedEvidenceCreationDelta":0,"managerVisibleAspiration":{"byConfig":{"A":false,"B":true}},"events":["GrowthAspirationCreated.v1","GrowthEvidenceLinked.v1"]}.

추가 독립 검사 입력: GROWTH_PROFILE-DENIED-1 (manager replaces employee aspiration statement); GROWTH_PROFILE-DENIED-2 (manager reads EMPLOYEE_PRIVATE content); GROWTH_PROFILE-DUPLICATE (same-key replay/cross-tenant owner mock); GROWTH_PROFILE-CORRECTION (replaceAspiration); GROWTH_PROFILE-CROSS-TENANT (same-key replay/cross-tenant owner mock).

### LEARNING

실제 typed content: `LearningOfferingContent.v1`, `VerifiedLearningCompletion.v1`. 전체 nested fields, bounds, refs는 JSON `schemas`에 있다.

Domain tables: `prf_lrn_offerings`, `prf_lrn_offering_versions`, `prf_lrn_assignments`, `prf_lrn_completion_evidence`. 공개 UUID와 tenant-local BIGINT identity를 분리하고, 모든 local FK는 tenant 복합키로 결속한다. Table specs에는 실제 business columns와 response fieldSources가 있다.

| 객체 | 최초 진입 | 정확 전이 |
|---|---|---|
| OfferingVersion | createLearningOfferingDraft → DRAFT | replaceLearningOfferingDraft: DRAFT→DRAFT<br>publishLearningOffering: DRAFT→PUBLISHED<br>retireLearningOffering: PUBLISHED→RETIRED |
| LearningAssignment | enrollMyLearning, assignWorkerLearning → ENROLLED | startLearningAssignment: ENROLLED→IN_PROGRESS<br>cancelLearningAssignment: ENROLLED\|IN_PROGRESS→CANCELLED<br>verifyLearningCompletion: IN_PROGRESS→COMPLETED |

Parent/catalog와 version/assignment/child의 상태를 서로 복사하지 않는다. 작성/발행이 없는 child를 자동 생성하지 않는다. 정정 새 객체/버전의 predecessor와 현재 live 동의/권한/source가 명시되어 있다.

| Operation | 실제 typed 입력 | Domain write |
|---|---|---|
| GET queryLearningOfferings | 없음 | NONE |
| GET getLearningOfferingVersion | 없음; path offeringId, version | NONE |
| POST createLearningOfferingDraft | offeringPublicId:UUID nullable, content:LearningOfferingContent.v1 | prf_lrn_offerings [offering_code, status, current_version_public_id]<br>prf_lrn_offering_versions [learning_offering_id, version_no, artifact_public_id, artifact_revision, provider_public_id, capacity, status, valid_from, valid_to] |
| PUT replaceLearningOfferingDraft | content:LearningOfferingContent.v1; path offeringId, version | prf_lrn_offering_versions [version_no, artifact_public_id, artifact_revision, capacity, status, valid_from, valid_to] |
| POST publishLearningOffering | approvalReceiptPublicId:UUID; path offeringId, version | prf_lrn_offerings [status]<br>prf_lrn_offering_versions [status] |
| POST retireLearningOffering | reasonCode:STRING; path offeringId, version | prf_lrn_offering_versions [status] |
| POST enrollMyLearning | offeringVersionPublicId:UUID, consentRevision:BIGINT | prf_lrn_assignments [offering_version_public_id, worker_public_id, assigned_by_principal_public_id, assigned_at, due_at, reservation_revision, status] |
| POST assignWorkerLearning | offeringVersionPublicId:UUID, workerPublicId:UUID, dueAt:TIMESTAMPTZ, assignmentPolicyVersionPublicId:UUID | prf_lrn_assignments [offering_version_public_id, worker_public_id, assigned_by_principal_public_id, assigned_at, due_at, reservation_revision, status] |
| GET queryMyLearningAssignments | 없음 | NONE |
| GET getLearningAssignment | 없음; path assignmentId | NONE |
| POST startLearningAssignment | 없음; path assignmentId | prf_lrn_assignments [status] |
| POST cancelLearningAssignment | reasonCode:STRING; path assignmentId | prf_lrn_assignments [status] |
| POST verifyLearningCompletion | content:VerifiedLearningCompletion.v1; path assignmentId | prf_lrn_completion_evidence [learning_assignment_id, completion_revision, artifact_public_id, evidence_digest, source_receipt_public_id, source_receipt_digest, completed_at, verified_at, supersedes_completion_public_id]<br>prf_lrn_assignments [status] |
| POST correctLearningCompletion | content:VerifiedLearningCompletion.v1, reasonCode:STRING; path assignmentId | prf_lrn_completion_evidence [learning_assignment_id, completion_revision, artifact_public_id, evidence_digest, source_receipt_public_id, source_receipt_digest, completed_at, verified_at, supersedes_completion_public_id] |

각 operation JSON에 method/path, exact request schema, readsTables, selected write columns/source, CAS 보존열, typed source/entity/ref binding, emits, authorization, query artifact refetch와 guard가 있다. 공통 receipt/audit/semantic outbox는 동일 owner transaction에 원자적으로 기록한다.

Synthetic config A/B 차이와 구체 flow: LEARNING-HAPPY-A → {"assignmentCount":{"byConfig":{"A":2,"B":1}},"secondEnrollment":{"byConfig":{"A":"ENROLLED","B":"409_CAPACITY_FULL"}},"offeringState":"PUBLISHED","workerAAssignmentState":"COMPLETED","completionEvidenceRows":1,"achievedSkill":"00000000-0000-4000-8000-000000000030","proficiency":"WORKING","events":["LearningAssignmentChanged.v1","LearningCompletionVerified.v1"]}; LEARNING-HAPPY-B → {"assignmentCount":{"byConfig":{"A":2,"B":1}},"secondEnrollment":{"byConfig":{"A":"ENROLLED","B":"409_CAPACITY_FULL"}},"offeringState":"PUBLISHED","workerAAssignmentState":"COMPLETED","completionEvidenceRows":1,"achievedSkill":"00000000-0000-4000-8000-000000000030","proficiency":"WORKING","events":["LearningAssignmentChanged.v1","LearningCompletionVerified.v1"]}.

추가 독립 검사 입력: LEARNING-DENIED-1 (completion workerPublicId=workerB while assignment belongs workerA); LEARNING-DENIED-2 (completionRevision is JSON float 1.5 or string "1"; separately unsigned source receipt); LEARNING-DUPLICATE (same-key replay/cross-tenant owner mock); LEARNING-CORRECTION (correctLearningCompletion); LEARNING-CROSS-TENANT (same-key replay/cross-tenant owner mock).

### INTERNAL_MARKETPLACE

실제 typed content: `OpportunityContent.v1`, `ApplicationStatement.v1`, `MatchExplanation.v1`. 전체 nested fields, bounds, refs는 JSON `schemas`에 있다.

Domain tables: `prf_mkt_opportunities`, `prf_mkt_opportunity_versions`, `prf_mkt_applications`, `prf_mkt_match_explanations`, `prf_mkt_decision_revisions`. 공개 UUID와 tenant-local BIGINT identity를 분리하고, 모든 local FK는 tenant 복합키로 결속한다. Table specs에는 실제 business columns와 response fieldSources가 있다.

| 객체 | 최초 진입 | 정확 전이 |
|---|---|---|
| OpportunityVersion | createOpportunityDraft → DRAFT | replaceOpportunityDraft: DRAFT→DRAFT<br>publishOpportunity: DRAFT→OPEN<br>closeOpportunity: OPEN→CLOSED |
| OpportunityApplication | applyToOpportunity → APPLIED | replaceApplicationStatement: APPLIED→APPLIED<br>withdrawOpportunityApplication: APPLIED\|SHORTLISTED→WITHDRAWN<br>shortlistOpportunityApplication: APPLIED→SHORTLISTED<br>selectOpportunityApplication: APPLIED\|SHORTLISTED→SELECTED<br>rejectOpportunityApplication: APPLIED\|SHORTLISTED→NOT_SELECTED |

Parent/catalog와 version/assignment/child의 상태를 서로 복사하지 않는다. 작성/발행이 없는 child를 자동 생성하지 않는다. 정정 새 객체/버전의 predecessor와 현재 live 동의/권한/source가 명시되어 있다.

| Operation | 실제 typed 입력 | Domain write |
|---|---|---|
| GET queryOpportunityCatalog | 없음 | NONE |
| GET getOpportunityVersion | 없음; path opportunityId, version | NONE |
| POST createOpportunityDraft | opportunityPublicId:UUID nullable, content:OpportunityContent.v1 | prf_mkt_opportunities [opportunity_code, owner_org_public_id, status]<br>prf_mkt_opportunity_versions [internal_opportunity_id, version_no, artifact_public_id, artifact_revision, capacity, open_from, close_at, status] |
| PUT replaceOpportunityDraft | content:OpportunityContent.v1; path opportunityId, version | prf_mkt_opportunity_versions [version_no, artifact_public_id, artifact_revision, capacity, open_from, close_at, status] |
| POST publishOpportunity | approvalReceiptPublicId:UUID; path opportunityId, version | prf_mkt_opportunity_versions [status]<br>prf_mkt_opportunities [status] |
| POST closeOpportunity | reasonCode:STRING, pendingApplicationPolicy:ENUM; path opportunityId, version | prf_mkt_opportunity_versions [status]<br>prf_mkt_opportunities [status] |
| POST applyToOpportunity | content:ApplicationStatement.v1; path opportunityId, version | prf_mkt_applications [opportunity_version_public_id, worker_public_id, statement_artifact_public_id, consent_revision, decision_receipt_public_id, applied_at, status] |
| GET queryMyOpportunityApplications | 없음 | NONE |
| GET getOpportunityApplication | 없음; path applicationId | NONE |
| PUT replaceApplicationStatement | content:ApplicationStatement.v1; path applicationId | prf_mkt_applications [statement_artifact_public_id, consent_revision] + common CAS/version/updated_at; original applied_at/worker/opportunity/status/decision preserved |
| POST withdrawOpportunityApplication | reasonCode:STRING; path applicationId | prf_mkt_applications [status] |
| POST shortlistOpportunityApplication | explanation:MatchExplanation.v1, humanDecisionReceiptPublicId:UUID; path applicationId | prf_mkt_match_explanations [opportunity_application_id, artifact_public_id, explanation_digest, match_policy_version_public_id, policy_revision, prohibited_attribute_count]<br>prf_mkt_applications [status] |
| POST selectOpportunityApplication | humanDecisionReceiptPublicId:UUID, reasonCode:STRING; path applicationId | prf_mkt_applications [status, decision_receipt_public_id]<br>prf_mkt_decision_revisions [opportunity_application_id, decision_revision, decision, approval_receipt_public_id, reason_code, reverses_decision_public_id, hrm_handoff_receipt_public_id, status] |
| POST rejectOpportunityApplication | humanDecisionReceiptPublicId:UUID, reasonCode:STRING; path applicationId | prf_mkt_applications [status, decision_receipt_public_id]<br>prf_mkt_decision_revisions [opportunity_application_id, decision_revision, decision, approval_receipt_public_id, reason_code, reverses_decision_public_id, hrm_handoff_receipt_public_id, status] |
| POST correctOpportunityDecision | humanDecisionReceiptPublicId:UUID, reasonCode:STRING, newDecision:ENUM, hrmCorrectionHandoffReceiptPublicId:UUID nullable; path applicationId | prf_mkt_decision_revisions [opportunity_application_id, decision_revision, decision, approval_receipt_public_id, reason_code, reverses_decision_public_id, hrm_handoff_receipt_public_id, status] |

각 operation JSON에 method/path, exact request schema, readsTables, selected write columns/source, CAS 보존열, typed source/entity/ref binding, emits, authorization, query artifact refetch와 guard가 있다. 공통 receipt/audit/semantic outbox는 동일 owner transaction에 원자적으로 기록한다.

Synthetic config A/B 차이와 구체 flow: INTERNAL_MARKETPLACE-HAPPY-A → {"opportunityState":"OPEN","applicationCount":2,"selectedCount":{"byConfig":{"A":1,"B":2}},"secondSelection":{"byConfig":{"A":"409_CAPACITY_FULL","B":"SELECTED"}},"explainedCriteria":["00000000-0000-4000-8000-000000000030"],"directHrmAssignmentWrites":0,"events":["OpportunityApplicationSubmitted.v1","OpportunitySelectionRecorded.v1"]}; INTERNAL_MARKETPLACE-HAPPY-B → {"opportunityState":"OPEN","applicationCount":2,"selectedCount":{"byConfig":{"A":1,"B":2}},"secondSelection":{"byConfig":{"A":"409_CAPACITY_FULL","B":"SELECTED"}},"explainedCriteria":["00000000-0000-4000-8000-000000000030"],"directHrmAssignmentWrites":0,"events":["OpportunityApplicationSubmitted.v1","OpportunitySelectionRecorded.v1"]}.

추가 독립 검사 입력: INTERNAL_MARKETPLACE-DENIED-1 (explanation.prohibitedAttributeCount=1); INTERNAL_MARKETPLACE-DENIED-2 (human decision receipt absent or AI-only); INTERNAL_MARKETPLACE-DUPLICATE (same-key replay/cross-tenant owner mock); INTERNAL_MARKETPLACE-CORRECTION (correctOpportunityDecision); INTERNAL_MARKETPLACE-CROSS-TENANT (same-key replay/cross-tenant owner mock).

### SUCCESSION

실제 typed content: `SuccessionPlanContent.v1`, `ReadinessEvidence.v1`. 전체 nested fields, bounds, refs는 JSON `schemas`에 있다.

Domain tables: `prf_suc_plans`, `prf_suc_plan_versions`, `prf_suc_nominations`, `prf_suc_readiness_evidence`. 공개 UUID와 tenant-local BIGINT identity를 분리하고, 모든 local FK는 tenant 복합키로 결속한다. Table specs에는 실제 business columns와 response fieldSources가 있다.

| 객체 | 최초 진입 | 정확 전이 |
|---|---|---|
| SuccessionPlanVersion | createSuccessionDraft → DRAFT | replaceSuccessionDraft: DRAFT→DRAFT<br>submitSuccessionPlan: DRAFT→PENDING_APPROVAL<br>approveSuccessionPlan: PENDING_APPROVAL→APPROVED<br>rejectSuccessionPlan: PENDING_APPROVAL→REJECTED<br>publishSuccessionPlan: APPROVED→PUBLISHED<br>retireSuccessionPlan: PUBLISHED→RETIRED |
| Nomination | nominateSuccessionWorker → DRAFT | replaceSuccessionReadiness: DRAFT→DRAFT<br>removeSuccessionNomination: DRAFT→REMOVED<br>submitSuccessionPlan: DRAFT→FROZEN |

Parent/catalog와 version/assignment/child의 상태를 서로 복사하지 않는다. 작성/발행이 없는 child를 자동 생성하지 않는다. 정정 새 객체/버전의 predecessor와 현재 live 동의/권한/source가 명시되어 있다.

| Operation | 실제 typed 입력 | Domain write |
|---|---|---|
| GET querySuccessionPlans | 없음 | NONE |
| GET getSuccessionPlanVersion | 없음; path planId, version | NONE |
| POST createSuccessionDraft | content:SuccessionPlanContent.v1 | prf_suc_plans [plan_key, key_position_public_id, status]<br>prf_suc_plan_versions [succession_plan_id, version_no, artifact_public_id, artifact_revision, audience_policy_version_public_id, approval_receipt_public_id, frozen_nomination_set_digest, status] |
| PUT replaceSuccessionDraft | content:SuccessionPlanContent.v1; path planId, version | prf_suc_plan_versions [version_no, artifact_public_id, artifact_revision, frozen_nomination_set_digest, status] |
| POST nominateSuccessionWorker | workerPublicId:UUID, consentRevision:BIGINT, readinessCode:STRING, reviewDueAt:TIMESTAMPTZ; path planId, version | prf_suc_nominations [plan_version_public_id, worker_public_id, readiness_code, consent_revision, nomination_revision, review_due_at, status] |
| PUT replaceSuccessionReadiness | content:ReadinessEvidence.v1; path nominationId | prf_suc_readiness_evidence [succession_nomination_id, artifact_public_id, evidence_digest, source_revision, expires_at, supersedes_evidence_public_id]<br>prf_suc_nominations [readiness_code, consent_revision, nomination_revision, review_due_at, status] |
| POST removeSuccessionNomination | reasonCode:STRING; path nominationId | prf_suc_nominations [status] |
| POST submitSuccessionPlan | 없음; path planId, version | prf_suc_plan_versions [status, frozen_nomination_set_digest]<br>prf_suc_nominations [status] |
| POST approveSuccessionPlan | approvalReceiptPublicId:UUID; path planId, version | prf_suc_plan_versions [status, approval_receipt_public_id] |
| POST rejectSuccessionPlan | approvalReceiptPublicId:UUID, reasonCode:STRING; path planId, version | prf_suc_plan_versions [status, approval_receipt_public_id] |
| POST publishSuccessionPlan | 없음; path planId, version | prf_suc_plan_versions [status]<br>prf_suc_plans [status] |
| POST retireSuccessionPlan | reasonCode:STRING; path planId, version | prf_suc_plan_versions [status] |
| POST createSuccessionCorrection | content:SuccessionPlanContent.v1, reasonCode:STRING; path planId, version | prf_suc_plan_versions [succession_plan_id, version_no, artifact_public_id, artifact_revision, audience_policy_version_public_id, approval_receipt_public_id, frozen_nomination_set_digest, status] |

각 operation JSON에 method/path, exact request schema, readsTables, selected write columns/source, CAS 보존열, typed source/entity/ref binding, emits, authorization, query artifact refetch와 guard가 있다. 공통 receipt/audit/semantic outbox는 동일 owner transaction에 원자적으로 기록한다.

Synthetic config A/B 차이와 구체 flow: SUCCESSION-HAPPY-A → {"planVersionState":"PUBLISHED","nominationCount":2,"nominationStates":["FROZEN","FROZEN"],"readinessEvidenceRows":2,"readiness":{"byConfig":{"A":"READY_LATER","B":"LONG_TERM"}},"employeeGlobalRankingCreated":false,"events":["SuccessionReadinessRecorded.v1","SuccessionPlanPublished.v1"]}; SUCCESSION-HAPPY-B → {"planVersionState":"PUBLISHED","nominationCount":2,"nominationStates":["FROZEN","FROZEN"],"readinessEvidenceRows":2,"readiness":{"byConfig":{"A":"READY_LATER","B":"LONG_TERM"}},"employeeGlobalRankingCreated":false,"events":["SuccessionReadinessRecorded.v1","SuccessionPlanPublished.v1"]}.

추가 독립 검사 입력: SUCCESSION-DENIED-1 (maker approves own submitted plan); SUCCESSION-DENIED-2 (unrestricted employee/audit duty without succession read purpose requests detail); SUCCESSION-DUPLICATE (same-key replay/cross-tenant owner mock); SUCCESSION-CORRECTION (createSuccessionCorrection); SUCCESSION-CROSS-TENANT (same-key replay/cross-tenant owner mock).

### COMPENSATION_PLANNING

실제 typed content: `CompensationGuidelinesContent.v1`, `CompensationPopulationContent.v1`, `CompensationProposalContent.v1`. 전체 nested fields, bounds, refs는 JSON `schemas`에 있다.

Domain tables: `prf_cmp_cycles`, `prf_cmp_budget_ledger`, `prf_cmp_proposals`, `prf_cmp_proposal_revisions`, `prf_cmp_approved_snapshots`, `prf_cmp_approved_snapshot_lines`. 공개 UUID와 tenant-local BIGINT identity를 분리하고, 모든 local FK는 tenant 복합키로 결속한다. Table specs에는 실제 business columns와 response fieldSources가 있다.

| 객체 | 최초 진입 | 정확 전이 |
|---|---|---|
| CompensationCycle | createCompensationCycle → DRAFT | openCompensationCycle: DRAFT→OPEN<br>submitCompensationPlan: OPEN→PENDING_APPROVAL<br>approveCompensationPlan: PENDING_APPROVAL→APPROVED<br>rejectCompensationPlan: PENDING_APPROVAL→REJECTED<br>publishApprovedCompensationSnapshot: APPROVED→PUBLISHED<br>cancelCompensationCycle: DRAFT\|OPEN\|PENDING_APPROVAL→CANCELLED |
| CompensationProposal | createCompensationProposal → DRAFT | replaceCompensationProposal: DRAFT→DRAFT<br>submitCompensationProposal: DRAFT→SUBMITTED<br>rejectCompensationProposal: SUBMITTED→REJECTED<br>cancelCompensationProposal: DRAFT\|SUBMITTED→CANCELLED<br>approveCompensationPlan: SUBMITTED→FROZEN<br>cancelCompensationCycle: DRAFT\|SUBMITTED→CANCELLED |

Parent/catalog와 version/assignment/child의 상태를 서로 복사하지 않는다. 작성/발행이 없는 child를 자동 생성하지 않는다. 정정 새 객체/버전의 predecessor와 현재 live 동의/권한/source가 명시되어 있다.

| Operation | 실제 typed 입력 | Domain write |
|---|---|---|
| GET queryCompensationCycles | 없음 | NONE |
| GET getCompensationCycle | 없음; path cycleId | NONE |
| POST createCompensationCycle | cycleCode:STRING, guidelines:CompensationGuidelinesContent.v1, population:CompensationPopulationContent.v1, effectiveFrom:DATE, effectiveTo:DATE nullable, populationSourceRef:HRMSourceSnapshotRef.v1 | prf_cmp_cycles [cycle_code, guideline_artifact_public_id, population_artifact_public_id, effective_from, effective_to, status] |
| POST allocateCompensationBudget | organizationPublicId:UUID, currency:ISO4217, amount:DECIMAL_STRING, entryType:ENUM, reversesEntryPublicId:UUID nullable; path cycleId | prf_cmp_budget_ledger [compensation_cycle_id, org_public_id, currency_code, amount, entry_sequence, entry_type, source_entry_public_id] |
| POST openCompensationCycle | 없음; path cycleId | prf_cmp_cycles [status] |
| POST createCompensationProposal | content:CompensationProposalContent.v1; path cycleId | prf_cmp_proposals [compensation_cycle_id, worker_public_id, assignment_public_id, component_code, currency_code, amount, effective_from, effective_to, current_revision, status, supersedes_proposal_public_id]<br>prf_cmp_proposal_revisions [compensation_proposal_id, revision_no, typed_content_artifact_public_id, content_digest, exception_approval_receipt_public_id] |
| PUT replaceCompensationProposal | content:CompensationProposalContent.v1; path proposalId | prf_cmp_proposals [component_code, currency_code, amount, effective_from, effective_to, current_revision, status]<br>prf_cmp_proposal_revisions [compensation_proposal_id, revision_no, typed_content_artifact_public_id, content_digest, exception_approval_receipt_public_id] |
| POST submitCompensationProposal | exceptionApprovalReceiptPublicId:UUID nullable; path proposalId | prf_cmp_proposals [status] |
| POST rejectCompensationProposal | decisionReceiptPublicId:UUID, reasonCode:STRING; path proposalId | prf_cmp_proposals [status] |
| POST cancelCompensationProposal | reasonCode:STRING; path proposalId | prf_cmp_proposals [status] |
| POST submitCompensationPlan | 없음; path cycleId | prf_cmp_cycles [status] |
| POST approveCompensationPlan | approvalReceiptPublicId:UUID; path cycleId | prf_cmp_cycles [status]<br>prf_cmp_proposals [status] |
| POST rejectCompensationPlan | approvalReceiptPublicId:UUID, reasonCode:STRING; path cycleId | prf_cmp_cycles [status] |
| POST cancelCompensationCycle | reasonCode:STRING; path cycleId | prf_cmp_cycles [status]<br>prf_cmp_proposals [status] |
| POST publishApprovedCompensationSnapshot | 없음; path cycleId | prf_cmp_approved_snapshots [compensation_cycle_id, approval_receipt_public_id, snapshot_revision, source_version, effective_from, effective_to, line_count, payload_digest]<br>prf_cmp_approved_snapshot_lines [approved_compensation_snapshot_id, line_sequence, worker_public_id, assignment_public_id, component_code, currency_code, approved_amount, effective_from, effective_to, line_digest]<br>prf_cmp_cycles [status] |
| GET getApprovedCompensationSnapshot | 없음; path snapshotId | NONE |
| POST createCompensationCorrection | cycleCode:STRING, reasonCode:STRING, correctedProposals:ARRAY; path cycleId | prf_cmp_cycles [cycle_code, guideline_artifact_public_id, population_artifact_public_id, effective_from, effective_to, status]<br>prf_cmp_proposals [compensation_cycle_id, worker_public_id, assignment_public_id, component_code, currency_code, amount, effective_from, effective_to, current_revision, status, supersedes_proposal_public_id]<br>prf_cmp_proposal_revisions [compensation_proposal_id, revision_no, typed_content_artifact_public_id, content_digest, exception_approval_receipt_public_id] |

각 operation JSON에 method/path, exact request schema, readsTables, selected write columns/source, CAS 보존열, typed source/entity/ref binding, emits, authorization, query artifact refetch와 guard가 있다. 공통 receipt/audit/semantic outbox는 동일 owner transaction에 원자적으로 기록한다.

Synthetic config A/B 차이와 구체 flow: COMPENSATION_PLANNING-HAPPY-A → {"proposalCount":2,"proposalStates":["FROZEN","FROZEN"],"snapshotHeaders":1,"snapshotLineCount":2,"orderedLineSequences":[1,2],"amounts":["100","150.25"],"sum":"250.25","remainingBudget":{"byConfig":{"A":"749.75","B":"249.75"}},"currency":{"fixtureRef":"config.currency"},"payImmutableInputs":2,"duplicatePayInputDelta":0,"events":["CompensationPlanApproved.v1"]}; COMPENSATION_PLANNING-HAPPY-B → {"proposalCount":2,"proposalStates":["FROZEN","FROZEN"],"snapshotHeaders":1,"snapshotLineCount":2,"orderedLineSequences":[1,2],"amounts":["100","150.25"],"sum":"250.25","remainingBudget":{"byConfig":{"A":"749.75","B":"249.75"}},"currency":{"fixtureRef":"config.currency"},"payImmutableInputs":2,"duplicatePayInputDelta":0,"events":["CompensationPlanApproved.v1"]}.

추가 독립 검사 입력: COMPENSATION_PLANNING-DENIED-1 (proposal amount exceeds guideline or sum exceeds current currency/org budget without exception); COMPENSATION_PLANNING-DENIED-2 (wire amount JSON number, exponent, plus, whitespace, precision/scale overflow, signed zero not canonical); COMPENSATION_PLANNING-DUPLICATE (same-key replay/cross-tenant owner mock); COMPENSATION_PLANNING-CORRECTION (createCompensationCorrection); COMPENSATION_PLANNING-CROSS-TENANT (same-key replay/cross-tenant owner mock).

## 중요 동작의 명시적 경계

- Skills: taxonomy graph cycle/self-edge/unknown band 거부; 직원 assertion은 self-verify 불가. manualObservation 실제 typed 내용 또는 같은 worker/skill/course/outcome의 verified completion ref를 요구한다. taxonomy retire가 이미 수집한 evidence를 소급으로 조작하지 않는다.
- Growth: employee assertion과 coaching 기록은 다른 객체/증거다. 직원 개인 진술을 manager가 대체하지 못한다. privacy 변경은 current consent revision을 요구하며 verified evidence를 생성하지 않는다.
- Learning: offering.create는 assignment를 만들지 않는다. 두 worker enroll/assign을 별도 admission하고 capacity lock으로 config A/B 차이를 재현한다. completion verify는 typed completion evidence+assignment 상태를 같이 write하고 source receipt/worker/outcome/revision을 검증한다.
- Marketplace: opportunity.create는 application을 만들지 않는다. 선정은 인간 receipt/skill evidence 설명/capacity를 요구한다. close는 미해결 application이 0일 때만 가능하며 자동 rejection을 만들지 않는다. HRM assignment 직접 변경 없음. JOB_MOVE 이후 실제 HRM 변경의 정정은 owner refetch/reversal 승인 후 새 decision revision이다.
- Succession: plan version과 N nomination/readiness evidence는 각각 독립 상태다. submit은 유효 consent/source/readiness를 검증해 exact nomination revision set을 freeze한다. unrestricted audit/employee purpose로 nominee 상세를 읽을 수 없다.
- CompPlan: proposal create/edit가 worker+assignment+component+currency+canonical amount를 실제 형성한다. per-org/currency budget inverse ledger는 positive amount, exact original-entry reversal, double reversal 거부다. human approval은 frozen proposal set/digest에 결속한다. approval-only에서 PAY event를 보내지 않고 snapshot header+N ordered lines 발행 후 `CompensationPlanApproved.v1`을 내보낸다. PAY는 owner refetch/dedup/freeze하며 PER 원결과 변경 없음.
- Compensation 정정은 새 DRAFT cycle/proposals이며 원 snapshot 불변; 새 budget allocation·approval 필수. 법정/회계/실제 payroll activated integration은 G6다.

## Synthetic fixture materialization과 수용 결과

각 capability 기본7 case: HAPPY-A/B, DENIED-1/2, DUPLICATE+payloadMismatch, CORRECTION, CROSS-TENANT. Marketplace statement edit/refetch/replay/denied/no-op A/B2 case를 추가해 총44 case다. named fixtureRef/byConfig는 exact allowlist deterministic fixture factory가 **wire validation 전에** 실제 typed 값으로 확장한다. UUIDv5 factory는 fixture/action/entity/iteration으로 entity ID를 만들며 correlation을 사용하지 않는다.

Approval mock receipt UUID는 대상/action/version/content digest/checker에 결속하고 다른 application에 동일 receipt를 재사용하지 않는다. Completion/readiness/match explanation은 iteration worker·nomination·application에 각각 결속한다. HRM population SHA는 보존된 exact typed rows에서 계산하며 임의 dddd digest를 정답으로 쓰지 않는다. Cross-tenant는 client tenant input이 아니라 악성 owner snapshot 반환/잘못된 context를 주입해 403과 write/event 0을 검증한다.

작성자가 JSON 구조/참조를 점검한 것은 설계 self-check다. fixture runner 구현·실행, JUnit/SQL/API/event/PEP evidence 및 독립 reviewer의 config2종 재현이 있어야 G4 PASS가 된다. 현재 전 사례 NOT_EXECUTED이다.

## 정본 통합·검증 수용 조건 — 아직 열림

1. Root가 historical predecessor와 제안을 분리한 채 modern delivery/coding/API/table/state/event/IA/ownership/source registers를 일관되게 개편한다. 필요한 operation/event/table 수를 늘리고 count-only gate를 쓰지 않는다.
2. 논리 operation-discriminated source를 실제 `operationFieldLineage`/typedSources/nested projection graph로 펼쳐 실제 FK/entity oracle 및 owner snapshot schema를 독립 검증한다. 컬럼 binding의 labelled lookup을 runtime 구현으로 착각하지 않는다.
3. 신규 HRM/SYS/Approval ports와 schemas/projection, exact-duty allocation, package/route/Gradle shared baseline supply를 소유자와 합의하고 5세션에서 독립 compile한다.
4. PER migration CREATE range/path/slice allocation, existing object/name compatibility, schema fresh/restart/out-of-order 독립 stream, rollback/forward correction 및 data retention 승인. 새 common People47/48, Auth211/212, Platform231..237은 기존 module reservation 첫머리를 이미 소비한다. historical characterization과 current successor를 분리하고 새 paired baseline 이후 free range/capacity와 실제 filenames를 재예약·동기화한 뒤 전체 Gate를 재검증한다. 기존 range/count/6f PASS를 재사용하지 않는다.
5. JSON request/response/event strict binding, additional/duplicate/coercion/nullable-presence/nested item/decimal/temporal mutation; stale-source/wrong entity/FK/cursor/type/digest/privacy/SoD/step-up/idempotency 공격을 독립 검증한다.
6. G3에서는 Config A/B44 case의 exact typed input→expected row/state/event/receipt/error/refetch SPEC 및 test allocation과 공통 실행 adapter/consumer compile을 봉인한다. 실제85 operation CRUD·업무 SQL materialization 및44 case API→table→event→receipt→refetch 실행은 G4 수용조건이다. G3 준비를 위해 전체 G4 업무 구현을 선행 요구하지 않는다. G4 후 전체 화면 Design AI/G5 승인·교체·회귀를 수행한다.
7. 국가팩·실 고객값·실 provider channel·법정 검증·운영 credential-free runtime/Control production job·adoption/cutover·DBA 승인은 별도 G6 activation blocker다.

이 문서/JSON은 위 통합과 독립 검증을 대신하지 않는다. 원 지적 P0/P1의 CLOSED 판정은 해당 정본과 실제 독립 결과를 근거로 부모가 조정한다.

## 지원서 수정 — bounded author remediation

Root의 독립 검토는 새 statement artifact를 만들어도 application의 기존 pointer를 보존하고 applied_at을 초기화하는 실제 제안 오류를 발견했다. 작성자 수정은 새로운 immutable ApplicationStatement revision append와 statement_artifact_public_id/consent_revision/common CAS/version/updated_at 갱신을 하나의 transaction에 결속한다. original applied_at, worker, opportunity version, decision receipt와 APPLIED 상태는 보존한다. 새 content의 worker/opportunity binding 변경은 거부한다.

A/B 두 추가 fixture는 수정 text가 get/owner-refetch로 반환되고 과거 artifact text/원래 신청 timestamp는 불변임을 기대한다. 같은 key/bytes replay는 기존 receipt/artifact를 반환해 append/write/event0; stale CAS나 다른 worker/opportunity는 append 없이 거부한다. 같은 current content/new key는 no-op receipt이며 version/event를 늘리지 않는다. CAS 실패 시 append/link/receipt/event를 함께 rollback해 orphan content를 만들지 않는다.

이것은 AUTHOR_FIX_PROPOSED_NOT_INDEPENDENT_PASS다. 이전1001 structural self-check는 편집 의미의 인증이 아니며 추가44 fixture도 NOT_EXECUTED_G4다. exact source/event artifact pointer, factory materialization과 동시수정은 별도 독립 검토가 필요하다.
