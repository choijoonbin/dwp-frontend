# PER Authorization and Field-Policy Contract

Status: `READY_FOR_G3_CODE`  
Canonical app entitlement: `APP.HCM` (display name HRIS; `APP.HRIS` read-compatibility alias only)  
Policy enforcement owner: DWP Auth plus `dwp-people-server/hris/performance` resource PEP

## Authorization equation

An operation is allowed only when every applicable term evaluates true:

`app entitlement ∩ atomic capability ∩ tenant ∩ resource population ∩ cycle/stage state ∩ purpose ∩ field policy ∩ SoD ∩ step-up ∩ active module/config`

A deny at any layer wins. Broad roles, URL possession, hidden menus, client claims and current organization hierarchy never bypass an assigned-review or frozen-population decision.

## Access packages and atomic capabilities

| Package | Atomic capability examples | Population | Risk |
|---|---|---|---|
| `HRIS_EMPLOYEE` | `hcm.personal.performance.view`, `per.goal.self.write`, `per.review.self.submit`, `per.appeal.self.open` | `SELF` | low/high by action |
| `HRIS_LINE_MANAGER` | `hcm.team.performance.review`, `per.goal.team.approve`, `per.checkin.team.manage` | `ASSIGNED_REVIEW_POPULATION` or current team for non-review operations | high |
| `HRIS_PERFORMANCE_OPERATOR` | `hcm.operations.performance.update`, `per.cycle.manage`, `per.population.freeze`, `per.exception.resolve` | `ORG_TREE` or `NAMED_POPULATION` | high |
| `HRIS_PERFORMANCE_CALIBRATOR` | `hcm.operations.performance.calibrate` | named calibration population | critical + step-up + approval |
| `HRIS_PERFORMANCE_RESULT_PUBLISHER` | `hcm.operations.performance.publish` | named result population | critical + step-up + approval |
| `HRIS_CONFIG_DESIGNER` | `per.template.draft`, `per.rule.draft`, `per.config.simulate` | tenant/config scope | high |
| `HRIS_CONFIG_PUBLISHER` | `per.template.publish`, `per.rule.publish`, `per.config.publish` | tenant/config scope | critical + approval |
| `HRIS_ENTERPRISE_AUDITOR` | `per.audit.evidence.view`, `per.audit.export` | approved tenant/legal-entity scope | high; read-only; purpose required |

No default `HRIS_ALL_OPERATOR` exists. Local development uses separate synthetic personas. “Open all” means all catalog entries are discoverable in a synthetic tenant; it never disables API PEP or combines conflicting critical duties in one account.

## Capability-to-command matrix

| Command/query | Required capability | Population rule | Field groups | Extra guards |
|---|---|---|---|---|
| performance home widget | `hcm.personal.performance.view` or role-specific widget capability | self/assigned/named | `PERFORMANCE_SUMMARY` | partial failures isolated per widget |
| cycle list/read | `per.cycle.view` | authorized tenant/org scope | `PERFORMANCE_CONFIG` | draft visibility limited to operator/config roles |
| cycle create/update/validate | `per.cycle.manage` | config scope | `PERFORMANCE_CONFIG_PRIVATE` | expected version |
| cycle publish | `per.cycle.publish` | config scope | `PERFORMANCE_CONFIG_PRIVATE` | independent approval; optional step-up by tenant policy |
| population preview | `per.population.preview` | named org/population | `LIMITED_PROFILE` | HRM snapshot as-of; result minimization |
| population freeze | `per.population.freeze` | named org/population | `LIMITED_PROFILE` | preview hash; expected version; audit reason |
| own goal read/write | `per.goal.self.view/write` | self | `PERFORMANCE_GOAL` | cycle/stage state |
| team goal approve | `per.goal.team.approve` | team/named goal population | `PERFORMANCE_GOAL` | cannot approve own goal when SoD policy enabled |
| assigned review read/write/submit | `hcm.team.performance.review` or self equivalent | exact frozen reviewer assignment | `PERFORMANCE_ASSIGNED` | stage, reviewer type, template version |
| feedback response | `per.feedback.assigned.submit` | exact feedback assignment | `PERFORMANCE_FEEDBACK_ASSIGNED` | anonymity and close time |
| feedback aggregate read | `per.feedback.aggregate.view` | subject/manager/operator by release policy | `PERFORMANCE_FEEDBACK_AGGREGATE` | minimum cohort; no contributor identity |
| check-in manage | `per.checkin.manage` | self + paired manager | `PERFORMANCE_CHECKIN` | private note ownership independent |
| calibration read/adjust | `hcm.operations.performance.calibrate` | named calibration population | `PERFORMANCE_PRIVATE` | step-up, baseline hash, reason |
| result validate/approve | `per.result.validate/approve` | named result population | `PERFORMANCE_PRIVATE` | maker/checker policy |
| result publish | `hcm.operations.performance.publish` | named result population | `PERFORMANCE_PRIVATE` | step-up; approval; calibrate/publish SoD |
| own published result | `hcm.personal.performance.view` | self | `PERFORMANCE_RELEASED_RESULT` | only after successful publication |
| appeal open/view | `per.appeal.self.open/view` | self result | `PERFORMANCE_APPEAL_SELF` | appeal window |
| appeal resolve | `per.appeal.resolve` | named case population | `PERFORMANCE_APPEAL_PRIVATE` | cannot resolve own appeal |
| import/export | `per.data_exchange.execute` | named domain population | explicit export profile | purpose, row cap, object expiry, download audit |
| audit evidence/export | `per.audit.evidence.view/export` | approved scope | masked by default | purpose, time-bound grant, export step-up |

## Field groups

| Group | Examples | Default visibility |
|---|---|---|
| `PERFORMANCE_SUMMARY` | task count, goal progress band, review completion, published-result availability | employee self; role-specific aggregates |
| `LIMITED_PROFILE` | worker public ID, display name, organization/job labels needed for assignment | operator/reviewer for authorized population |
| `PERFORMANCE_CONFIG` | cycle names, dates, published template labels and stage metadata | authorized participants/operators |
| `PERFORMANCE_CONFIG_PRIVATE` | draft rules, population criteria, approval refs, validation issues | operator/config roles only |
| `PERFORMANCE_GOAL` | goal title, measures, weight, progress, alignment | self and explicitly authorized manager/operator |
| `PERFORMANCE_ASSIGNED` | review form answers and evidence needed for assigned stage | exact reviewer assignment; subject only per publish policy |
| `PERFORMANCE_REVIEW_PRIVATE` | draft narrative, reviewer-only notes, return reasons | author/assigned operator by purpose |
| `PERFORMANCE_FEEDBACK_ASSIGNED` | an individual assigned feedback response | provider while open; not exposed to subject |
| `PERFORMANCE_FEEDBACK_AGGREGATE` | thresholded aggregate and redacted themes | subject/manager after release policy |
| `PERFORMANCE_CHECKIN` | shared agenda and acknowledged notes | paired participants |
| `PERFORMANCE_CHECKIN_PRIVATE` | private manager/employee note references | note owner only unless explicit legal workflow |
| `PERFORMANCE_PRIVATE` | raw scores, reviewer identities, calibration before/after, unpublished results | calibrator/result operator/auditor by exact purpose |
| `PERFORMANCE_RELEASED_RESULT` | published overall result and approved detail | subject and authorized manager per publication policy |
| `PERFORMANCE_APPEAL_SELF` | appellant statement, status and released resolution | appellant |
| `PERFORMANCE_APPEAL_PRIVATE` | case evidence, reviewer notes, correction link | assigned case reviewer/auditor |
| `DOCUMENT_CONTENT` | evidence/import/export file body | never embedded in normal API; short-lived Object Storage grant |

Narrative text, raw reviewer identity, calibration evidence and appeal material are never placed in home widgets, search suggestions, counts, telemetry or generic exports.

## Resource PEP algorithm

1. Resolve tenant and actor from the verified DWP session/service identity.
2. Verify `APP.HCM` and installed PER module entitlement. Apply explicit deny first.
3. Resolve the exact API operation to one atomic capability; reject unmapped endpoints.
4. Load the target resource by `(tenant_id, public_id)` or return tenant-safe `404`.
5. Resolve cycle, frozen participant/reviewer assignment or named operational population.
6. Evaluate purpose and field group. Produce allowed read fields, writable fields and export profile separately.
7. Evaluate aggregate state, stage window, approval, step-up freshness and dynamic SoD.
8. Only then execute the repository command/query. Apply tenant predicate again in SQL.
9. Shape response fields server-side and record policy revision/decision reference in Audit.
10. Re-evaluate entitlement/scope when an async job starts and before its artifact is downloaded.

Permission cache keys include tenant, actor, app grant revision, access-package revision, population-policy revision, field-policy revision, resource/cycle scope and purpose. Revocation events invalidate matching entries immediately; TTL is only a safety net.

## Dynamic SoD and step-up

| Rule | Prohibited combination/situation | Scope | Enforcement |
|---|---|---|---|
| `SOD_HRIS_PERFORMANCE_CALIBRATE_PUBLISH` | calibrator and publisher on same cycle | cycle | assignment-time warning and runtime deny |
| `SOD_PER_RESULT_MAKER_CHECKER` | same actor calculates and approves result set | result set | runtime deny unless documented emergency workflow |
| `SOD_PER_CONFIG_DESIGN_PUBLISH` | same actor drafts and publishes high-risk template/rule | config version | approval/runtime deny |
| `NO_REVIEW_OUTSIDE_ASSIGNMENT` | reviewer operates outside frozen assignment | review | runtime deny; current manager status is insufficient |
| `NO_SELF_APPEAL_RESOLUTION` | appellant resolves own appeal | appeal | runtime deny |
| `NO_PRIVATE_NOTE_DISCLOSURE` | paired party/operator reads owner-private note | check-in | field-policy deny |

Calibration adjustment, result approval/publication, high-volume export, private-evidence export and break-glass require replay-protected step-up evidence bound to actor, tenant, capability, resource/scope and expiry.

## Privacy, export and analytics controls

- Purpose codes are allowlisted per operation (`PERFORMANCE_OPERATION`, `ASSIGNED_REVIEW`, `EMPLOYEE_SELF_SERVICE`, `AUDIT_INVESTIGATION`, `LEGAL_RESPONSE`). Free text is supplementary, not authorization.
- Search is performed only on fields the caller may see; counts are computed after population/field filtering to prevent inference.
- Anonymous feedback enforces minimum cohort before aggregation. Suppressed results return a reason category, not an exact contributor count.
- Exports require a named profile, row/field limits, purpose, approval where configured, content hash, expiry and download audit. Direct synchronous bulk export is forbidden.
- AI receives only fields allowed for the human caller and explicit purpose. It may draft or summarize; it cannot score, grade, calibrate, publish or decide an appeal.
- Retention uses tenant/country policy IDs. Legal hold blocks destruction; expired object links and derived read models are purged independently.

## Negative test inventory

1. No app grant → `403 APP_DENIED` even when route is known.
2. PER employee asks another employee's review/result → tenant-safe `404` or policy `403` without existence leak.
3. Current manager not in frozen reviewer assignment → `403 ASSIGNED_POPULATION_DENIED`.
4. Assigned reviewer requests another stage's private fields → allowed resource but fields omitted/denied.
5. Calibrator attempts publish on same cycle → `403 SOD_DENIED`.
6. Expired/replayed/mismatched step-up evidence → `403 STEP_UP_REQUIRED`.
7. Operator searches a masked narrative/value → no hit/count inference.
8. Anonymous cohort below threshold → aggregate withheld, contributor identities absent.
9. Tenant A ID supplied under Tenant B → no distinguishable existence signal.
10. Revoked access package between job request and execution/download → job/artifact access denied and audited.
11. Auditor without an approved purpose or expired grant → denied.
12. Client attempts to set tenant, reviewer assignment or publication field directly → ignored/rejected as server-owned.

## G2 acceptance evidence

- endpoint-to-capability registry has no unmapped mutation/query;
- policy unit/property tests cover every row above;
- tenant-negative tests cover list, detail, search, count, receipt, export and deep link;
- field serialization tests prove prohibited keys are absent, not merely masked in UI;
- SoD/step-up tests include concurrency and replay;
- Audit assertions bind the exact policy revisions and purpose to each decision;
- named Security and Privacy reviewers are bound before Integration Control opens the slice Gate.
