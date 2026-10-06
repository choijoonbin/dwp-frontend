# HRM modern semantic remediation v1

Status: DESIGN_PROPOSED. This is a successor design proposal, not a Gate canonical artifact, implementation result, runtime receipt, or PASS decision. G3 remains closed. Generated 2026-09-14; the historical v1 schema/module/event artifacts and BE/FE worktrees are unchanged.

The exact machine-readable delta is [hrm-modern-remediation.v1.json](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/hrm-modern-remediation.v1.json). Every operation declares a closed complete request, removals/additions/replacements, exact read/write effects, concurrency owner, transition IDs, closed response/event/record schemas, typed lineage, positive journey references and negative cases. Proposed HTTP paths are v2; existing operation IDs are retained for historical correlation, not silent v1 replacement.

## Scope and lifecycle split

| Capability | Replace | Add | Total | Independent objects |
| --- | ---: | ---: | ---: | --- |
| RecruitingATS | 6 | 9 | 15 | Requisition, CandidateCase, RecruitingOffer, HireHandoff |
| Onboarding | 6 | 5 | 11 | JourneyTemplateVersion, JourneyAssignment, JourneyAssignmentTask |
| WorkforcePlanning | 6 | 4 | 10 | WorkforceScenario |
| BenefitsAdmin | 6 | 9 | 15 | BenefitPlanVersion, BenefitEnrollment, BenefitLifeEvent |
| HRServiceDelivery | 6 | 10 | 16 | HrCase, HrCaseSlaClock, HrKnowledgeVersion |
| ContingentWorkforce | 6 | 9 | 15 | ContingentWorkerProposal, ContingentEngagement, ContingentAccessRequest, ContingentVendor |

Totals: 82 HRM operations (36 historical replacements, 46 additions), 34 business table specifications (20 replacement specifications, 14 additions), 18 state machines, 95 exact transitions, 29 events, 132 record schemas, 83 response schemas and 43 closed typed objects. If the other historical 64 operations were unchanged the modern total would become 146; preserving the historical 100 is not a design goal.

Recruiting separates one Requisition from its N CandidateCases, their Offers, and canonical HireHandoffs. Requisition creation/publishing creates no candidate and emits no CandidateStageChanged. Typed candidate admission binds person token, consent receipt, source system/key and persisted requisition relation. SCREENING and INTERVIEW are separate real SQL stages. Rejection/withdrawal/closure and offer acceptance/decline/expiry/withdrawal are explicit; canonical worker creation is only confirmed through the actual HRM command receipt. A rejected handoff returns the candidate to OFFERED for a corrected proposal, not an invented HIRED row.

Onboarding separates Template identity/immutable version, Assignment and AssignmentTask. Publishing freezes typed task definitions, assignee role, evidence policy and business-calendar deadlines. Assignment re-fetches the exact published version and materializes N task rows with verified assignees. Completing different tasks repeatedly keeps IN_PROGRESS until all required tasks are completed or policy-authorized waived; then COMPLETED is emitted once and optional pending tasks are canceled. Terminal assignments cannot be canceled. Retiring a version blocks new assignments without rewriting existing tasks.

WorkforcePlanning separates scenario lifecycle from immutable input/simulation revisions. Create/revise consumes typed position/org/cost snapshots and lines, not a digest-only result. Simulation uses the pinned rounding/config policy and records exact before/after rounding stages; approval binds the simulated revision, maker/checker decision and result digest. REJECTED can be revised, CANCELLED and PUBLISHED are terminal.

Benefits separates Plan identity/immutable version, Enrollment, LifeEvent, and optional provider attempts/receipts. Eligibility actually evaluates the selected verified worker employment, dependent owner snapshot, plan option, eligibility policy, effective interval and enrollment/life-event window. Ineligibility cannot be bypassed by a human approval. Life-event verification/rejection/expiry and enrollment cancellation are explicit. Provider commands are optional extensions; native approval does not fabricate insurer receipts or require a connector.

HRServiceDelivery separates Case, append-only Responses/Actions, SLAClock and KnowledgeVersion/access receipts. Native human authored knowledge is published, queried and cited with immutable source version, excerpt digest, redaction/retention policy and case-scoped access receipt. Response/resolution provenance is recomputed from these refetched artifacts, not trusted as a caller digest. SLA pause/resume has explicit RUNNING/PAUSED state, accumulated business seconds, effective calendar and resumed deadline. WAITING and IN_PROGRESS are real states; resolve/cancel stops the clock.

ContingentWorkforce separates native Vendor, canonical WorkerProposal, Engagement and replay-safe AccessRequest attempts. Sponsor, vendor, worker, classification and effective bounds are independently verified typed references. Proposal is not Worker: only accepted canonical HRM receipt provides worker identity. Auth commands are created by Auth; pending People rows store null Auth command IDs. Access failures are terminal attempt outcomes; a typed new request linked to the failed request retries, and close requires owner-refetched empty access inventory and successful coverage of prior failed revocations. Native vendor/worker/access control does not require a vendor connector.

## Canonical self-context owner contract — common prerequisite

The retained G2 Person/Worker schema and XCON001 WorkerAssignmentSnapshot do not prove authenticated principal to Worker/Person linkage. The proposal therefore introduces an authoritative HRM-owned PrincipalWorkerEmploymentLink table and provisioning/query/resolution ports. Canonical DTO/SPI/planned SQL/source contracts and fail-closed common adapter/consumer compilation remain open G3 P0. Actual link provisioning persistence/full business journeys are G4; verified customer identity authority/bootstrap/adoption is G6.

Provisioning is privileged maker/checker identity administration with verified Auth principal and canonical HRM person/worker/employment relation. A link binds tenant, distinct principal/person/worker/employment UUIDs, half-open effective interval, verification receipt/method/provenance, status and revision. The exact proposed verificationProofContract re-fetches an immutable HRM proof that binds all identities/intervals and verified Auth principal proof plus maker/checker approval. Method/provenance are copied from that receipt, not caller digest or a caller signed-sync label; the Auth proof contract allocation remains explicitly open. Revocation is versioned and invalidates self-scope cursors. The caller cannot provision its own mapping, assert a body worker UUID, match an email/name/correlation ID, or equate principal UUID with worker UUID.

GET employment-contexts uses signed tenant/principal and owner clock. Zero valid verified links denies self scope; one may default; multiple require owner-issued authorized selfContextId and otherwise return SELF_CONTEXT_REQUIRED. SelfContextId is the link public UUID, not a claimed Worker UUID. Every self operation resolves that link using tenant + principal + status VERIFIED + interval, reauthorizes the current population and independently loads the canonical effective employment snapshot. This applies to onboarding self list, benefit self list/enrollment/life-event and HR case creation/self query.

## Source, command and immutable artifact rules

Every business UUID input has a referenceContract with exact entityType and PUBLIC_UUID space. Business outputs/FKs have independent semanticBinding, never a label inferred from a trace ID. Cross-owner fields come from specific typed owner snapshot response fields. Local references resolve tenant-bound public UUID to the target table's actual BIGINT identity; path IDs load their named aggregate and preserve unrelated stored organization/position/source IDs. No FIRST_PATH copying, businessKey-to-UUID conversion or UUID shape-based cast is permitted.

operationFieldLineage registers every derivation in typedSources with ruleId, exact inputs, type and semantic binding. ARRAY/OBJECT projection fieldSources cover the closed item/object schema. The proposal currently contains 1,230 typed sources and 1,374 required-column mappings. ownerSnapshots carries exact proposed owner contract pointer, operation, request bindings, response schema, tenant/caller, owner reauthorization, version field and complete field sources. These are 34 concrete consumer snapshot bindings, not claims that historical owner APIs already satisfy them.

All 66 commands write the existing People command receipt together with their exact People business effects. A complete verifiedReferences object is stored with the closed response in the actual G2 result_reference column. It preserves validated configuration/version/decision/document and other typed inputs beyond their digest. The sealed actor, subject principal, originating action, purpose, authorization/policy revision and context seal use actual G2 columns. A changed payload under the same key conflicts; a same-payload replay returns the saved IDs/response with no additional rows, version increments, events or external commands.

If-Match compares the exact named owner aggregate; versioned template/plan routes additionally resolve the numeric version into that parent's exact version row. Child insert commands increment their explicit versioned parent once. Owner callbacks use a locked causal pending request and its sealed originating context/revision, not untrusted callback If-Match or current self identity. Domain events are outbox results of actual committed matched transitions; failed proof/guard emits no business event. HR case numbers use a tenant/year business counter and explicit string formatting, never an internal SQL identity or UUID-derived key.

Native global core is company/country generic. All policy references are pinned effective typed owner versions; no country/company source branches or numerical legal defaults are built in. External ATS/insurer/vendor integrations, credentials and production policy activation are separate optional/G6 boundaries.

## Two deterministic native configurations

Fixtures are EXPECTED_DESIGN, not executed runtime evidence. Both use zero optional connectors and distinct signed principals, verified identity links, native owner-issued typed configuration/snapshot/receipt fixtures. Reference UUIDs are constant fixture owner outputs, never derived from a business code. The runner must compile descriptor references into a complete validated HTTP request and materialize native owner proofs; missing owner APIs is a hard failure, not generic filler.

| Fixed input / behavior | Native A | Native B strict |
| --- | --- | --- |
| Tenant / calendar | 91001 / UTC weekday 09–17 | 91002 / Asia/Seoul weekday 09–18, lunch 12–13 excluded |
| Verified self context | One valid employment | Two valid employments; selector mandatory |
| Benefit primary facts | FTE 0.7500; service 60 days; 2 dependents | Same primary facts |
| Eligibility policy | min FTE 0.5; service 30; max 3 dependents → eligible | min FTE 0.8; service 90; max 1 dependent → ineligible; verified second employment positive branch |
| Required onboarding tasks | 2; complete twice → COMPLETED | 3; after 2 → IN_PROGRESS, after 3 → COMPLETED; waiver denied |
| Same cost 1000.005 × FTE 1.0000, USD 2 decimals | HALF_EVEN → 1000.00 | HALF_UP → 1000.01 |
| SLA pause/resume expected resolved result | 27,000 business seconds, MET | 16,200 business seconds, BREACHED |

The JSON fixes full policy values, actor/catalog/evidence/object seeds, exact journey method/path/request bindings and 13 named prerequisite profiles. Twelve native capability journeys contain 104 explicit steps with 246 required-header bindings and authenticated fixture actor allocations; plus a cross-capability hire → verified identity → onboarding journey, they allocate acceptance coverage to all 82 operations. Named branches isolate distinct candidate/offer/assignment/plan/scenario/engagement states. Task selection uses exactly one published taskKey under the named assignment, never a first task ID. Creation responses expose the exact initial template/plan version companion row and offboarding exposes its newly created access request, so subsequent fixture references use actual typed response identities. Generic businessKey request fields are removed in favor of templateKey/scenarioKey/planCode/engagementCode plus their typed policy/object inputs. Common and capability-specific negatives reject unknown/wrong typed fields, wrong-entity UUIDs, cross-tenant/purpose scope, missing immutable proof, stale revision/causal receipt, changed replay payload, terminal/pseudo edges and trace-driven business reference changes.

## Migration and evidence boundary

REQUIRED_NOT_ALLOCATED / P0. Current common People V47/V48 already consume the start of the historical HRM V47..V69 business allocation. This proposal assigns no successor version and forbids business reuse of V47/V48. SYS Auth V211/V212 and Platform V231..V237 are also occupied. Preserve exact sealed historical G2 V1..V46 blobs; record approved immutable common prefix separately; approve current owner successor allocation before new physical/business migrations. Do not simply widen the historical G2 validator to V48 to manufacture PASS.

Semantic validator v1 is aligned with the proposed typedSources/semanticBinding format but does not yet prove authoritative ownerResponse boundaries or nested typed input identity. The proposal explicitly labels this unsupported boundary UNRESOLVED; no label-only validation is accepted. Approve exact canonical planned DTO/SPI/source/ref schemas, integrate fail-closed shared adapters and consumer compile, and extend independent source-oracle validation before coding readiness. Complete business physical projections/endpoint persistence and their full runtime journeys follow in G4. The existing tenant + correlation_id receipt uniqueness also requires explicit compatibility review for shared tracing across distinct commands; historical DDL is not silently changed here.

Remaining G3 P0: exact canonical owner identity/proof/snapshot/worker proposal/receipt DTO+SPI and source/ref binding, fail-closed common adapter/consumer compile, nested independent source-oracle validation, approved planned authorization/API/event/SQL/write/state/fixture/test allocation and module successor/migration ownership, plus reconciled current common/pilot smoke. G4: the 82 domain CRUD/SQL/PEP/state/outbox implementations and full native/negative/concurrency runtime acceptance. Intentional G6: actual customer identity authority/link bootstrap/adoption, production authorization, activated country/customer policy and optional provider credentials. None is declared resolved by this proposal.

## Coding preparation is not circular business implementation

G3 prepares coding before all 82 domain operations are implemented. It needs exact approved planned schema/SQL/read-write/state/source/fixtures/test allocation, canonical owner DTO/SPI and fail-closed shared adapters with consumer compilation, and current common/pilot/static/focused/runtime smoke evidence. Full domain CRUD/SQL materialization and all-native82 runtime acceptance are G4. Real customer identity authority/bootstrap/adoption and production policy activation are G6. Deterministic verified G3 fixture identity is not a production identity claim. A partial structural self-test is also not sufficient by itself to open G3.

## Exact operation inventory

### RecruitingATS

- `modern.recruiting.requisitions.query` — REPLACE; `GET /api/people/v2/hris/recruiting/requisitions`; QUERY; no writes.
- `modern.recruiting.requisition.create` — REPLACE; `POST /api/people/v2/hris/recruiting/requisitions`; COMMAND; writes `ppl_rec_requisitions`, `ppl_command_receipts`.
- `modern.recruiting.requisition.publish` — REPLACE; `POST /api/people/v2/hris/recruiting/requisitions/{requisitionId}/publish`; COMMAND; writes `ppl_rec_requisitions`, `ppl_command_receipts`.
- `modern.recruiting.candidate.stage` — REPLACE; `PATCH /api/people/v2/hris/recruiting/candidate-cases/{candidateCaseId}/stage`; COMMAND; writes `ppl_rec_candidate_cases`, `ppl_command_receipts`.
- `modern.recruiting.offer.issue` — REPLACE; `POST /api/people/v2/hris/recruiting/candidate-cases/{candidateCaseId}/offers`; COMMAND; writes `ppl_rec_offers`, `ppl_rec_candidate_cases`, `ppl_command_receipts`.
- `modern.recruiting.hire.record` — REPLACE; `POST /api/people/v2/hris/recruiting/candidate-cases/{candidateCaseId}/hire-decisions`; COMMAND; writes `ppl_rec_hire_requests`, `ppl_rec_candidate_cases`, `ppl_command_receipts`.
- `modern.recruiting.candidate.admit` — ADD; `POST /api/people/v2/hris/recruiting/candidate-cases`; COMMAND; writes `ppl_rec_candidate_cases`, `ppl_command_receipts`.
- `modern.recruiting.candidates.query` — ADD; `GET /api/people/v2/hris/recruiting/candidate-cases`; QUERY; no writes.
- `modern.recruiting.requisition.pause` — ADD; `POST /api/people/v2/hris/recruiting/requisitions/{requisitionId}/pause`; COMMAND; writes `ppl_rec_requisitions`, `ppl_command_receipts`.
- `modern.recruiting.requisition.close` — ADD; `POST /api/people/v2/hris/recruiting/requisitions/{requisitionId}/close`; COMMAND; writes `ppl_rec_requisitions`, `ppl_command_receipts`.
- `modern.recruiting.candidate.close` — ADD; `POST /api/people/v2/hris/recruiting/candidate-cases/{candidateCaseId}/close`; COMMAND; writes `ppl_rec_candidate_cases`, `ppl_rec_offers`, `ppl_command_receipts`.
- `modern.recruiting.offer.decide` — ADD; `POST /api/people/v2/hris/recruiting/offers/{offerId}/decisions`; COMMAND; writes `ppl_rec_offers`, `ppl_rec_candidate_cases`, `ppl_command_receipts`.
- `modern.recruiting.offer.expire` — ADD; `POST /api/people/v2/hris/recruiting/offers/{offerId}/expire`; COMMAND; writes `ppl_rec_offers`, `ppl_rec_candidate_cases`, `ppl_command_receipts`.
- `modern.recruiting.hire.confirm` — ADD; `POST /api/people/v2/hris/recruiting/hire-requests/{hireRequestId}/owner-receipts`; COMMAND; writes `ppl_rec_hire_handoff_receipts`, `ppl_rec_hire_requests`, `ppl_rec_candidate_cases`, `ppl_command_receipts`.
- `modern.recruiting.offer.withdraw` — ADD; `POST /api/people/v2/hris/recruiting/offers/{offerId}/withdraw`; COMMAND; writes `ppl_rec_offers`, `ppl_rec_candidate_cases`, `ppl_command_receipts`.

### Onboarding

- `modern.onboarding.self.query` — REPLACE; `GET /api/people/v2/hris/onboarding/my-journeys`; QUERY; no writes.
- `modern.onboarding.template.create` — REPLACE; `POST /api/people/v2/hris/onboarding/templates`; COMMAND; writes `ppl_jny_templates`, `ppl_jny_template_versions`, `ppl_command_receipts`.
- `modern.onboarding.template.publish` — REPLACE; `POST /api/people/v2/hris/onboarding/templates/{templateId}/versions/{version}/publish`; COMMAND; writes `ppl_jny_template_versions`, `ppl_command_receipts`.
- `modern.onboarding.journey.assign` — REPLACE; `POST /api/people/v2/hris/onboarding/journey-assignments`; COMMAND; writes `ppl_jny_assignments`, `ppl_jny_assignment_tasks`, `ppl_command_receipts`.
- `modern.onboarding.task.complete` — REPLACE; `POST /api/people/v2/hris/onboarding/journey-assignments/{assignmentId}/tasks/{taskId}/complete`; COMMAND; writes `ppl_jny_task_evidence`, `ppl_jny_assignment_tasks`, `ppl_jny_assignments`, `ppl_command_receipts`.
- `modern.onboarding.journey.cancel` — REPLACE; `POST /api/people/v2/hris/onboarding/journey-assignments/{assignmentId}/cancel`; COMMAND; writes `ppl_jny_assignments`, `ppl_jny_assignment_tasks`, `ppl_command_receipts`.
- `modern.onboarding.template.version.create` — ADD; `POST /api/people/v2/hris/onboarding/templates/{templateId}/versions`; COMMAND; writes `ppl_jny_template_versions`, `ppl_command_receipts`, `ppl_jny_templates`.
- `modern.onboarding.template.version.query` — ADD; `GET /api/people/v2/hris/onboarding/templates/{templateId}/versions/{version}`; QUERY; no writes.
- `modern.onboarding.template.retire` — ADD; `POST /api/people/v2/hris/onboarding/templates/{templateId}/versions/{version}/retire`; COMMAND; writes `ppl_jny_template_versions`, `ppl_command_receipts`.
- `modern.onboarding.journey.query` — ADD; `GET /api/people/v2/hris/onboarding/journey-assignments/{assignmentId}`; QUERY; no writes.
- `modern.onboarding.task.waive` — ADD; `POST /api/people/v2/hris/onboarding/journey-assignments/{assignmentId}/tasks/{taskId}/waive`; COMMAND; writes `ppl_jny_assignment_tasks`, `ppl_jny_assignments`, `ppl_command_receipts`.

### WorkforcePlanning

- `modern.workforceplan.scenarios.query` — REPLACE; `GET /api/people/v2/hris/workforce-planning/scenarios`; QUERY; no writes.
- `modern.workforceplan.scenario.create` — REPLACE; `POST /api/people/v2/hris/workforce-planning/scenarios`; COMMAND; writes `ppl_wfp_scenarios`, `ppl_wfp_scenario_revisions`, `ppl_command_receipts`.
- `modern.workforceplan.scenario.simulate` — REPLACE; `POST /api/people/v2/hris/workforce-planning/scenarios/{scenarioId}/simulations`; COMMAND; writes `ppl_wfp_scenarios`, `ppl_wfp_scenario_revisions`, `ppl_command_receipts`.
- `modern.workforceplan.scenario.submit` — REPLACE; `POST /api/people/v2/hris/workforce-planning/scenarios/{scenarioId}/submit`; COMMAND; writes `ppl_wfp_scenarios`, `ppl_command_receipts`.
- `modern.workforceplan.scenario.approve` — REPLACE; `POST /api/people/v2/hris/workforce-planning/scenarios/{scenarioId}/approve`; COMMAND; writes `ppl_wfp_scenarios`, `ppl_command_receipts`.
- `modern.workforceplan.scenario.publish` — REPLACE; `POST /api/people/v2/hris/workforce-planning/scenarios/{scenarioId}/publish`; COMMAND; writes `ppl_wfp_publish_receipts`, `ppl_wfp_scenarios`, `ppl_command_receipts`.
- `modern.workforceplan.scenario.revise` — ADD; `POST /api/people/v2/hris/workforce-planning/scenarios/{scenarioId}/revisions`; COMMAND; writes `ppl_wfp_scenarios`, `ppl_wfp_scenario_revisions`, `ppl_command_receipts`.
- `modern.workforceplan.scenario.query` — ADD; `GET /api/people/v2/hris/workforce-planning/scenarios/{scenarioId}`; QUERY; no writes.
- `modern.workforceplan.scenario.reject` — ADD; `POST /api/people/v2/hris/workforce-planning/scenarios/{scenarioId}/reject`; COMMAND; writes `ppl_wfp_scenarios`, `ppl_command_receipts`.
- `modern.workforceplan.scenario.cancel` — ADD; `POST /api/people/v2/hris/workforce-planning/scenarios/{scenarioId}/cancel`; COMMAND; writes `ppl_wfp_scenarios`, `ppl_command_receipts`.

### BenefitsAdmin

- `modern.benefits.self.plans.query` — REPLACE; `GET /api/people/v2/hris/benefits/my-eligible-plans`; QUERY; no writes.
- `modern.benefits.plan.create` — REPLACE; `POST /api/people/v2/hris/benefits/plans`; COMMAND; writes `ppl_bnf_plans`, `ppl_bnf_plan_versions`, `ppl_command_receipts`.
- `modern.benefits.plan.publish` — REPLACE; `POST /api/people/v2/hris/benefits/plans/{planId}/versions/{version}/publish`; COMMAND; writes `ppl_bnf_plan_versions`, `ppl_command_receipts`.
- `modern.benefits.enrollment.submit` — REPLACE; `POST /api/people/v2/hris/benefits/enrollments`; COMMAND; writes `ppl_bnf_enrollments`, `ppl_command_receipts`.
- `modern.benefits.lifeevent.submit` — REPLACE; `POST /api/people/v2/hris/benefits/life-events`; COMMAND; writes `ppl_bnf_life_events`, `ppl_command_receipts`.
- `modern.benefits.enrollment.decide` — REPLACE; `POST /api/people/v2/hris/benefits/enrollments/{enrollmentId}/decisions`; COMMAND; writes `ppl_bnf_enrollments`, `ppl_command_receipts`.
- `modern.benefits.plan.version.create` — ADD; `POST /api/people/v2/hris/benefits/plans/{planId}/versions`; COMMAND; writes `ppl_bnf_plan_versions`, `ppl_command_receipts`, `ppl_bnf_plans`.
- `modern.benefits.plan.version.query` — ADD; `GET /api/people/v2/hris/benefits/plans/{planId}/versions/{version}`; QUERY; no writes.
- `modern.benefits.plan.retire` — ADD; `POST /api/people/v2/hris/benefits/plans/{planId}/versions/{version}/retire`; COMMAND; writes `ppl_bnf_plan_versions`, `ppl_command_receipts`.
- `modern.benefits.enrollment.query` — ADD; `GET /api/people/v2/hris/benefits/enrollments/{enrollmentId}`; QUERY; no writes.
- `modern.benefits.enrollment.cancel` — ADD; `POST /api/people/v2/hris/benefits/enrollments/{enrollmentId}/cancel`; COMMAND; writes `ppl_bnf_enrollments`, `ppl_command_receipts`.
- `modern.benefits.lifeevent.decide` — ADD; `POST /api/people/v2/hris/benefits/life-events/{lifeEventId}/decisions`; COMMAND; writes `ppl_bnf_life_events`, `ppl_command_receipts`.
- `modern.benefits.lifeevent.expire` — ADD; `POST /api/people/v2/hris/benefits/life-events/{lifeEventId}/expire`; COMMAND; writes `ppl_bnf_life_events`, `ppl_command_receipts`.
- `modern.benefits.provider.execute` — ADD; `POST /api/people/v2/hris/benefits/enrollments/{enrollmentId}/provider-executions`; COMMAND; writes `ppl_bnf_provider_requests`, `ppl_command_receipts`, `ppl_bnf_enrollments`.
- `modern.benefits.provider.receipt` — ADD; `POST /api/people/v2/hris/benefits/enrollments/{enrollmentId}/provider-receipts`; COMMAND; writes `ppl_bnf_provider_receipts`, `ppl_bnf_provider_requests`, `ppl_command_receipts`, `ppl_bnf_enrollments`.

### HRServiceDelivery

- `modern.hrservice.case.create` — REPLACE; `POST /api/people/v2/hris/hr-services/cases`; COMMAND; writes `ppl_hrs_case_number_allocations`, `ppl_hrs_cases`, `ppl_hrs_case_actions`, `ppl_hrs_sla_clocks`, `ppl_command_receipts`.
- `modern.hrservice.case.query` — REPLACE; `GET /api/people/v2/hris/hr-services/cases/{caseId}`; QUERY; no writes.
- `modern.hrservice.case.triage` — REPLACE; `POST /api/people/v2/hris/hr-services/cases/{caseId}/triage`; COMMAND; writes `ppl_hrs_cases`, `ppl_hrs_case_actions`, `ppl_command_receipts`.
- `modern.hrservice.case.assign` — REPLACE; `POST /api/people/v2/hris/hr-services/cases/{caseId}/assignments`; COMMAND; writes `ppl_hrs_cases`, `ppl_hrs_case_actions`, `ppl_command_receipts`.
- `modern.hrservice.case.respond` — REPLACE; `POST /api/people/v2/hris/hr-services/cases/{caseId}/responses`; COMMAND; writes `ppl_hrs_responses`, `ppl_hrs_case_actions`, `ppl_command_receipts`, `ppl_hrs_cases`.
- `modern.hrservice.case.resolve` — REPLACE; `POST /api/people/v2/hris/hr-services/cases/{caseId}/resolve`; COMMAND; writes `ppl_hrs_cases`, `ppl_hrs_case_actions`, `ppl_hrs_sla_clocks`, `ppl_hrs_sla_receipts`, `ppl_command_receipts`.
- `modern.hrservice.case.self.query` — ADD; `GET /api/people/v2/hris/hr-services/my-cases`; QUERY; no writes.
- `modern.hrservice.case.pause` — ADD; `POST /api/people/v2/hris/hr-services/cases/{caseId}/pause`; COMMAND; writes `ppl_hrs_cases`, `ppl_hrs_case_actions`, `ppl_hrs_sla_clocks`, `ppl_hrs_sla_receipts`, `ppl_command_receipts`.
- `modern.hrservice.case.resume` — ADD; `POST /api/people/v2/hris/hr-services/cases/{caseId}/resume`; COMMAND; writes `ppl_hrs_cases`, `ppl_hrs_case_actions`, `ppl_hrs_sla_clocks`, `ppl_hrs_sla_receipts`, `ppl_command_receipts`.
- `modern.hrservice.case.cancel` — ADD; `POST /api/people/v2/hris/hr-services/cases/{caseId}/cancel`; COMMAND; writes `ppl_hrs_cases`, `ppl_hrs_case_actions`, `ppl_hrs_sla_clocks`, `ppl_hrs_sla_receipts`, `ppl_command_receipts`.
- `modern.hrservice.response.query` — ADD; `GET /api/people/v2/hris/hr-services/cases/{caseId}/responses/{responseId}`; QUERY; no writes.
- `modern.hrservice.knowledge.version.create` — ADD; `POST /api/people/v2/hris/hr-services/knowledge-versions`; COMMAND; writes `ppl_hrs_knowledge_versions`, `ppl_command_receipts`.
- `modern.hrservice.knowledge.version.publish` — ADD; `POST /api/people/v2/hris/hr-services/knowledge-versions/{knowledgeVersionId}/publish`; COMMAND; writes `ppl_hrs_knowledge_versions`, `ppl_command_receipts`.
- `modern.hrservice.knowledge.version.query` — ADD; `GET /api/people/v2/hris/hr-services/knowledge-versions/{knowledgeVersionId}`; QUERY; no writes.
- `modern.hrservice.knowledge.citation.issue` — ADD; `POST /api/people/v2/hris/hr-services/cases/{caseId}/knowledge-citation-receipts`; COMMAND; writes `ppl_hrs_knowledge_access_receipts`, `ppl_command_receipts`, `ppl_hrs_cases`.
- `modern.hrservice.knowledge.version.retire` — ADD; `POST /api/people/v2/hris/hr-services/knowledge-versions/{knowledgeVersionId}/retire`; COMMAND; writes `ppl_hrs_knowledge_versions`, `ppl_command_receipts`.

### ContingentWorkforce

- `modern.contingent.engagements.query` — REPLACE; `GET /api/people/v2/hris/contingent-workforce/engagements`; QUERY; no writes.
- `modern.contingent.engagement.create` — REPLACE; `POST /api/people/v2/hris/contingent-workforce/engagements`; COMMAND; writes `ppl_cwk_engagements`, `ppl_cwk_sponsor_assignments`, `ppl_command_receipts`.
- `modern.contingent.engagement.submit` — REPLACE; `POST /api/people/v2/hris/contingent-workforce/engagements/{engagementId}/submit`; COMMAND; writes `ppl_cwk_engagements`, `ppl_command_receipts`.
- `modern.contingent.engagement.activate` — REPLACE; `POST /api/people/v2/hris/contingent-workforce/engagements/{engagementId}/activate`; COMMAND; writes `ppl_cwk_engagements`, `ppl_command_receipts`.
- `modern.contingent.engagement.offboard` — REPLACE; `POST /api/people/v2/hris/contingent-workforce/engagements/{engagementId}/offboard`; COMMAND; writes `ppl_cwk_engagements`, `ppl_cwk_access_requests`, `ppl_command_receipts`.
- `modern.contingent.engagement.close` — REPLACE; `POST /api/people/v2/hris/contingent-workforce/engagements/{engagementId}/close`; COMMAND; writes `ppl_cwk_engagements`, `ppl_command_receipts`.
- `modern.contingent.vendor.create` — ADD; `POST /api/people/v2/hris/contingent-workforce/vendors`; COMMAND; writes `ppl_cwk_vendors`, `ppl_command_receipts`.
- `modern.contingent.vendors.query` — ADD; `GET /api/people/v2/hris/contingent-workforce/vendors`; QUERY; no writes.
- `modern.contingent.worker.proposal.create` — ADD; `POST /api/people/v2/hris/contingent-workforce/worker-proposals`; COMMAND; writes `ppl_cwk_worker_proposals`, `ppl_command_receipts`.
- `modern.contingent.worker.proposal.confirm` — ADD; `POST /api/people/v2/hris/contingent-workforce/worker-proposals/{proposalId}/owner-receipts`; COMMAND; writes `ppl_cwk_worker_proposals`, `ppl_command_receipts`.
- `modern.contingent.engagement.reject` — ADD; `POST /api/people/v2/hris/contingent-workforce/engagements/{engagementId}/reject`; COMMAND; writes `ppl_cwk_engagements`, `ppl_command_receipts`.
- `modern.contingent.engagement.cancel` — ADD; `POST /api/people/v2/hris/contingent-workforce/engagements/{engagementId}/cancel`; COMMAND; writes `ppl_cwk_engagements`, `ppl_command_receipts`.
- `modern.contingent.access.request` — ADD; `POST /api/people/v2/hris/contingent-workforce/engagements/{engagementId}/access-requests`; COMMAND; writes `ppl_cwk_access_requests`, `ppl_cwk_engagements`, `ppl_command_receipts`.
- `modern.contingent.access.receipt` — ADD; `POST /api/people/v2/hris/contingent-workforce/access-requests/{accessRequestId}/owner-receipts`; COMMAND; writes `ppl_cwk_access_requests`, `ppl_cwk_access_expiry_receipts`, `ppl_cwk_engagements`, `ppl_command_receipts`.
- `modern.contingent.vendor.retire` — ADD; `POST /api/people/v2/hris/contingent-workforce/vendors/{vendorId}/retire`; COMMAND; writes `ppl_cwk_vendors`, `ppl_command_receipts`.

## Verification interpretation

Structural machine/schema/write/projection/fixture arithmetic checks validate this proposal's internal design consistency only. They do not prove actual saved owner source bytes, customer identity authority, database migrations, PEP behavior, API implementation, concurrent runtime or production activation. Any reported semantic-validator failure remains an open integration requirement rather than an exception or Gate PASS.
