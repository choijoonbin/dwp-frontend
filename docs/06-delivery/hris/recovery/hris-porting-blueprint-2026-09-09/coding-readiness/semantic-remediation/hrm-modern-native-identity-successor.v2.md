# HRM modern native identity successor v2 — bounded preparation

Status: `DESIGN_PROPOSED_G3_NONE`, author-only. This is not a canonical overlay dialect, an independent approval, or a Gate change. Existing v1 seven files, BASE/PAY candidates, historical contracts, BE/main/SQL/CSV/Gate remain unedited.

## Two actual design corrections

Generic native Person admission now has a closed `HR_NATIVE | ATS_CASE | IMPORT` source union. Manual hire, contingent creation and prehire onboarding use an explicit People native workspace/human decision. Native staged import uses an accepted immutable batch/item/mapping. Only `ATS_CASE` requires the candidate/requisition/source/token/consent tuple and optional ATS provider. Disabled ATS is rejected before provider resolution; native/import never call it. An absent optional connector does not block native staged/manual flows.

The common immutable business receipt is planned `ppl_person_admission_receipts`, tenant-linked to native `ppl_persons`. It has no candidate FK. Optional `ppl_person_admission_ats_bindings` holds the tenant composite candidate/requisition relation only for ATS. Workspace/import tables and their producer contracts are explicitly new, unpublished plans, not existing native source evidence. These are business command receipts, not a principal-person employment journal.

`ActorAuthority.authVersions` contains acting Auth `com_users.version/access_revision` only. `SubjectPopulation` is a PERSON/EMPLOYMENT closed union: native person version only, or People person/worker/relationship/assignment four-version vector with three UUID selector. The target does not require an Auth account. The actor's Auth-bound person is not the NONSELF target. No acting Auth stamp is copied into target versions, no fake target Auth lookup, no zero-version placeholder for a person that does not exist.

Before CREATE, `CreationPopulation` authorizes the source workspace/item and mutation, not a synthetic target Person. After actual planned INSERT RETURNING, native `person_id/public_id/version` supplies the result. REUSE resolves the exact tenant/native Person UUID/version and Privacy identity evidence; it does not match first name/email, transform a digest/business key/internal BIGINT into UUID, or relink Auth.

## Exact planned contracts and current source

The JSON preserves all83 operation IDs and records every operation's nonidentity source closure as OPEN. Eight justified internal owner command/query deltas are separately declared, not silently counted as modern HTTP83. Their complete closed request/response schemas, routes, writes, state/CAS/receipt rules and intended DTO/producer/consumer/test paths are in `source-contract.json`.

Observed native source pins cover Auth binding/raw DTO/reader, People raw Person/Worker/Relationship/Assignment DTOs/readers, People V1/V41/V49 and Auth V1/V4/V7. Native target planned query resolves tenant internal parents and exposes public UUIDs from those same rows. The actual `NativeSelfContextQueryReaderV1` accepts SELF guard-issued lookup only: its SQL structure/DTOs are reusable data evidence, NOT NONSELF population authority. New People target PEP/query/adapters are unpublished.

Employment uses exact worker/relationship/assignment UUIDs, native People4 versions, inclusive owner-zone DATE, maximum effective sequence and overlap rejection. Legal employer public UUID comes from forward common V49, not old V1..48 or an employer key. Domain migration allocation is provisional V50+ after nonconflicting internal owner review; no actual migration version is assigned here.

Current fixed SelfPerson `SELF_PROFILE_READ/HRIS_HRM`, current-only/caller-input0, retains HRIS app entitlement and does not grant Person admission, hire, onboarding task or NONSELF actions. No employee employment prerequisite does not mean no HRIS entitlement/action permission. Nonapp task/prehire access requires separate purpose-bound DWP task surface/native Auth port/grant plan; no automatic APP.HCM or target account creation.

Current native `int_source_systems` has BIGINT/source_key and no public UUID. The successor does not copy an opaque SYS UUID into `ppl_persons.source_system_id`. CREATE keeps that nullable native field/external_id NULL and retains exact accepted source provenance in the business receipt until a genuine source-owner adapter is published. Person key/display name are explicit typed facts under field/Privacy policy, not a digest-only object.

The native existing outbox is `sys_people_outbox_events`. Admission event aggregate UUID/version are the actual admission receipt result, with separate native Person UUID/version. Twelve subject-business HRM events retain their own candidate/offer/handoff/journey/task/benefit/case/contingent record or aggregate identity. Their exact parent/RETURNING bindings are in the source contract; all30 event schema IDs remain accounted for. Candidate/offer may precede native Person admission. Native admission does not emit a phantom candidate lifecycle event.

## Author verification and output boundary

Run:

```
node /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/hrm-modern-native-identity-successor.v2.check.cjs --frontend /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend
```

Installed Ajv6.12.6 uses full Draft07, full formats, no coercion/default/removal. Actual replay compiles411 definitions including8 complete owner request/response pairs. It validates83 inherited request shape witnesses (not business journeys), thirteen concrete admission requests/results across A/B/source/create/reuse plus optional connector, sixteen A/B owner API pairs and four native contingent/onboarding API requests.

Actual author models execute27 admission negative boundaries,15 closed-schema negatives,15 native target negatives and6 source semantic mutations. A separate current People target population decision is compared to native result/versions/policy/fields/purpose; source workspace/actor authority does not manufacture it. Native target positives include repeated DST instants and inclusive end date. Twenty observed SQL column/type/public-ID source bindings and recursive schema leaves/parent joins are checked; every `sourceIssues` finding is fatal. The old flat subject Auth/mandatory common ATS receipt executable-reference scanner returns0. The550-pointer disposition manifest preserves exact frozen source pointer/value hash; annotations are previews, not executable replacements.

`record-outputs.json` contains actual computed model receipts/events/target snapshots and API payloads, with exact output digest linked from `evidence.json`. These are concrete synthetic owner-row/RETURNING fixtures and modeled authority decisions, NOT native SQL/Auth/HTTP receipts. The owner source rows for planned workspace/import/source artifacts are decoded fixture objects, not proof of existing physical producer or complete native publication. Safe-integer JSON BIGINT is an author schema subset; lossless signed transport codec is still owner review OPEN.

Evidence records actual argv/time/runtime/head and before/after SHA plus decimal-string mtimeNs. Whole actively changing integration/main worktrees are not approved or frozen. No DB/DML/domain CRUD/server/commit occurs. File ownership is this v2 prefix only; planned module Java/test paths are allocations, not files created here.

## Remaining boundaries

G3 still requires internally reviewed source-owner authority/purpose/population/field/SoD/stepup and immutable config/Privacy/workspace/import adapters, NONSELF target proof producer/refetch/freshness/revocation, exact canonical DTO/SPI/operation/event/expected-scope publication, nonconflicting migration allocation, real failclosed shared adapter/consumer compilation and current common/pilot proof. Inherited83 nonidentity source/state/output oracle remains unapproved. These source/design requirements are not deferred as G4.

G4 implements domain persistence/DML/CRUD/event producers and full journeys after coding readiness; it is not a precondition for exact planned G3 schemas. G6 is actual customer optional ATS/provider/country adoption/activation, not every-customer installation. Security/Auth/People/Control review means internal expert/code-owner technical validation, not new user/customer permission or external data. Root independent review/replay is required; author model PASS does not close either P0 independently or open Gate.
