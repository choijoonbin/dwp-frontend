# TIM v4 minimum actual Java source chunk — proposed 2026-09-14

Status: **INTERNAL_OWNER_DESIGN_REVIEW_REQUIRED / CODE0 / NATIVE0 / DML0 / SOURCE_CLOSED=false / G3 CLOSED**. This is an actionable first-chunk specification, not an independent acceptance of my v4 author model. No frozen TIM/HRM/PAY, BE/main/SQL/CSV/Gate or common registry edits.

## Source read and reuse boundary

Read the exact v4 subtrees `graphs` (268–414), `assemble_input/prepare_input/refetch_input` (599–635), `termination_instruction` (638–654), owner adapter projection (657–706), frozen six-table metadata via `load_frozen()[3]`, generated closed schemas/graphs/guards and original entitlement state machine. Metadata loading only: no schema engine/test/PG/DML execution in this plan.

Actual common ABI is in **dwp-platform-contracts**, not dwp-core. Fully read `CurrentHrisAuthorizationV2`, `VerifiedCurrentHrisAuthorizationV2`, `CurrentHrisAuthorizationPortsV2` and `NativeHrisTargetReadEvidencePortsV2`. Raw records confer no authority; the guard-minted carrier explicitly is not a signed production proof. Existing dwp-time-server already depends on dwp-platform-contracts (build.gradle18); no build/common ABI change is needed for local candidate consumer compile.

Exact read pins (captured2026-09-14T10:06:20.625173+00:00; decimal-ns, not rounded JSON integers):

| Source | SHA256 | mtimeNs |
| --- | --- | --- |
| semantic-remediation/tim_cross_context_successor_v4.py | 582e99f8eaad7b8835992854c83e6e7c39c6323fccb6fca7bd0448d77e8c9328 | 1789377158420738317 |
| semantic-remediation/test_tim_cross_context_successor_v4.py | 0421fe522f308bb37e37095a1660807a6003bc01278d97f10a4b7063edef9f51 | 1789377126272313022 |
| semantic-remediation/tim-cross-context-boundary-successor.v4.schemas.json | 9841d3d99bbc486e8d6ec41bb63d5b164aa23f2cba9d4c74d7e2a95ddbf8e14d | 1789377350541084586 |
| semantic-remediation/tim-cross-context-boundary-successor.v4.source-graphs.json | c54c3ed2bb6a9811dc46128e188fe8c57cf8c53a867f0a3316488b4001919247 | 1789377354133259834 |
| semantic-remediation/tim-cross-context-boundary-successor.v4.table-dependencies.json | 4a96e09c7190b91bd8c4e46930ac6b0db54c4db5e8aea7c4d6b5b150a909e1c3 | 1789377354510146169 |
| semantic-remediation/tim-cross-context-boundary-successor.v4.guards.json | 1cd3e1295f409c499c2f67efec28555325b8faed88682491fbc369ba1531ef79 | 1789377357375273647 |
| semantic-remediation/tim-cross-context-boundary-successor.v4.fixtures.json | 85757f558302d32b04f1b16c922f7a652c2e919d2fd377c98e149820bdce8225 | 1789377351977469584 |
| integration/backend/dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/identity/v2/CurrentHrisAuthorizationV2.java | a5537ff53d88b93d9ac759d2ccfd3c5840b3b91b80a97e021ce60cf28424efdd | 1789370928007662329 |
| integration/backend/dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/identity/v2/VerifiedCurrentHrisAuthorizationV2.java | f6de6969a3bf65e499faa108beddd7d4b1d2924911079bfa30f2ee3f00259d05 | 1789370904366695734 |
| integration/backend/dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/identity/v2/CurrentHrisAuthorizationPortsV2.java | c7f8cf621b2b4679f65b4ca9747987caaa379c88d17b47a43f8506a66ffcd841 | 1789370904366254895 |
| integration/backend/dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/identity/v2/NativeHrisTargetReadEvidencePortsV2.java | 5e3858d2c9fd6067c714a3da110adbdc6be21259edf174801f941deeeac5db6e | 1789372499219576922 |
| integration/backend/dwp-time-server/build.gradle | 914df5fe0f50216fa2987a405314e8b9065e120adcebc94cffa87092c9b56866 | 1789045059627380846 |

The frozen source declares116 inherited operation IDs; target4 are `tim.rule.create`, `tim.leave.entitlement.run`, `tim.leave.enrollment.cancel`, `tim.leave.entitlement.input.get`. Remaining112 stay OPEN. First J1 below does not close TIME rule production or all18 guards; declarations/counts are not source proof.

## First J1: exactly four main / four tests

Root/internal module-owner approval must allocate these existing v4 planned locations before implementation. Reuse them; do not add parallel `V5` DTOs or another proposal clone.

Main root: `dwp-time-server/src/main/java/com/dwp/services/time/`.

| Exact file | First-chunk contents and executable source boundary |
| --- | --- |
| `absence/contracts/v4/AbsOwnerResponseV4.java` | Closed Header/ActorAuthority and six owner-discriminated payloads: HRM native employment, SYS calendar, TIME published calendar, TIME published schedule, SYS ABS governance, SYS time configuration. Preserve full typed payload/parent/version/date/unit fields, not just ref+digest. Nested DTOs for source references/input/selected/outcomes can be grouped here within1000line gate. No authority boolean factory/default. |
| `absence/ports/AbsOwnerSnapshotRefetchPortV4.java` | Exact trusted lookup + branch-specific local-source/refetch interfaces: current full policy, selected enrollment/native parent tuples, ledger/reservation versions, immutable input+selected rows, termination owner/settlement receipt. Request carries tenant/operation-purpose/audience/native selector/business ref+expected revision/asOf/window/current guarded authority. Optional disabled owner calls0; enabled missing denies. Source producer/transport publication stays OPEN. |
| `absence/source/EntitlementInputAssemblerV4.java` | Full unsigned input and four run/input/selection/outcome typed row families (20+24+11+13=68 slots), explicit NewInsertSpec versus ExistingCasMutation, source-context and RETURNING phases. No reflective fallback map or column-name rule factory. DRY_RUN/POST and NONE/REVERSE_AND_REGRANT closed branches; current policy refetch, canonical selection/order/cardinality, actual parent/units/date/versions, own digest exclusion and immutable revision1/new corrective run. |
| `absence/source/TerminationInstructionAssemblerV4.java` | Two typed row families (workflow15+intent12=27), actual owner employment-end instruction, exact three treatments, native parent/ledger/policy/receipt binding, new versus existing-CAS phases and guarded outcomes. A separate CANCEL_ENROLLMENT input variant cannot inherit employment-end requirements. Ordinary cancel writes enrollment cancel prestate, not phantom termination rows. Unsupported/missing exact source branch is an explicit denial, never a fake zero/null result. |

Test root mirrors main: `dwp-time-server/src/test/java/com/dwp/services/time/`.

Exactly `absence/contracts/v4/AbsOwnerResponseV4Test.java`, `absence/ports/AbsOwnerSnapshotRefetchPortV4Test.java`, `absence/source/EntitlementInputAssemblerV4Test.java`, `absence/source/TerminationInstructionAssemblerV4Test.java`. Fixtures/oracle are test-owned immutable inputs from pinned v4 schema/fixtures/frozen table declarations, not recomputed from the candidate assembler's output or a simultaneously shortened candidate list. Generated schema transport material, if required, remains test resources within the same allocated source family; no canonical schema-engine replacement.

The first chunk is local package/contract/assembler compilation with explicit mock owner/clock/allocator/RETURNING sources. No repository/Spring endpoint/controller/SQL writer/bank/connector/server. Publishing a shared owner contract is a separate internal owner task; existing package location does not authorize shared ABS/TIME business DB access.

## Source phases — do not copy labels into values

Six frozen table graphs declare95 names: runs20, run_items24, input_versions11, selected_items13, termination_workflows15, settlement_intents12. Actual source executability is currently OPEN. First J1 must preserve an independently expected95 field/type/nullable/parent registry and execute each applicable typed record branch; impossible/null-only branches remain denied with a source-gap record.

1. **Invocation**: actor/tenant/operation/requirements are server-owned. Body contributes only business selectors/period/mode/cancel reason/expected row version, never actor, target authorization, tenant or policy booleans.
2. **Loaded/owner sources**: local tenant+native public UUID resolution returns exact internalID/publicID/version/native-parent tuple. REFETCH requires the full typed owner body/current purpose/population/field/SoD and exact requested revision/window, not latest/digest-only/no adapter.
3. **Allocation/clock**: publicUUIDs are explicit allocator results persisted under matching unsigned input; internalBIGINTs only from native INSERT RETURNING. A transaction Clock supplies capturedAt/createdAt, with a distinct registered date policy for LocalDate. Do not derive IDs/clocks from actor/tenant/correlation.
4. **Insert/returning**: InsertSpec binds nongenerated inputs. PersistedRow takes actual INSERT RETURNING for internal IDs/DB defaults; tests injecting it are synthetic. A later child binds that exact returned parent tuple. Do not require `loaded.run` or UPDATE RETURNING during new creation.
5. **CAS**: ExistingCasMutation carries loaded old state+version+expected lease/cancel fences, independent current refetch and actual UPDATE RETURNING. Failed/missing CAS returns a typed conflict/denial, not unchanged success.
6. **Response/receipt**: only the guarded branch's full immutable input/outcome/owner receipt is projected. DIGEST recomputes canonical normalized bytes excluding its own declared slot; it does not substitute for payload/source/provenance.

Exact correction to current graph labels: run status/row_version/lease_version currently refer to `loaded.run.*` and UPDATE RETURNING even for creation (v4.py282–303); workflow/intent creation and existing CAS also share labels (335–350). Replace executable branches in J1, not the frozen source. Fixture controls must reject creation attempting a loaded-existing source or CAS without prestate.

## Initial values / exact defaults — internal design decisions needed

| Slot | Actual frozen source | J1 closed constructor design, not historical native claim |
| --- | --- | --- |
| run.status | Original `TIM.State.abs_entitlement_runs.v1.initialStates=[QUEUED]`; CHECK exactnine states | New run QUEUED; no existing loaded state. Current run/finalize/unknown states are not guessed from a counter. |
| run.row_version | Frozen plannedCreateSql `BIGINT NOT NULL DEFAULT 0` and column.default=`0` | Omit this insert slot under sourced DB-default branch and consume RETURNING0. Existing CAS uses old+1 returned by guarded update. Never substitute initial1. |
| run.lease_version | NOTNULL, **no default** | Propose explicit NEW_UNCLAIMED_LEASE epoch0, owner/expiry/cancel fence null; this is a new technical lifecycle constructor source, NOT an observed native/default source. Claim increments only against observed old epoch and returns the new one. Approval/fixture is required, no generic filler0. |
| workflow/intent.row_version | NOTNULL, **no default**; CHECK >=0 | Propose explicit NEW_WORKFLOW/NEW_INTENT initial0 with source-kind LIFECYCLE_CONSTRUCTOR; existing CAS reads/returns real version. Owner review must approve this new source rule; do not label DB-default. |
| input.revision / intent.revision | Exact immutable schema/record CHECK revision1 | New identity uses1, never updates existing input. Corrective action allocates a new run/input/intent and carries the pinned original source. |
| workflow.status / intent.status | Workflow CHECK STOPPED/CORRECTION_QUEUED/SETTLEMENT_PENDING/RESULT_UNKNOWN/COMPLETED/REJECTED; intent CHECK DELIVERY_PENDING/ACCEPTED/RUNNING/SUCCEEDED/REJECTED/FAILED/RESULT_UNKNOWN | Exact treatment maps from existing termination function; new settlement intent DELIVERY_PENDING with owner_receipt_payload null. Later receipt state requires refetched matched owner command/receipt, never body status. |

SQL defaults above are **saved plannedSQL**, not applied production SQL. Lease/workflow/intent constructor decisions must be approved internally and then exist as actual J1 typed factories+source assertions before author can report this subsource implemented.

## Cancellation versus actual employment termination

Original enrollment.cancel transition is ACTIVE→CANCELLED. Existing v4 `termination_instruction` instead requires owner employmentEndedOn and computes exclusive enrollment end as inclusive lastDATE+1. These are different business causes. J1 must use a closed source-kind action union:

- CANCEL_ENROLLMENT: actual ACTIVE enrollment prestate/current revision, authorized cancellation policy/config/reason/effectiveDATE and current source/state rules. No forced employmentEndedOn, no HRM termination adapter call, no settlement/corrective row unless an explicit cancellation policy commands one.
- REAL_EMPLOYMENT_END: refetch exact HRM owner employment-end/native worker+relationship+assignment tuple, inclusiveDATE/date-policy provenance and matching policy/ledger summary. STOP_FUTURE_ONLY stops future eligibility; PRORATE_FINAL_PERIOD allocates exact correction with original grant/run; OWNER_APPROVED_SETTLEMENT allocates intent and waits for matched PAY receipt.

The second source must be a purpose-bound owner event/internal instruction/query source. Its registration/expected operation catalog delta remains OPEN; do not add an unregistered pseudo-op to the frozen116 or claim ordinary cancel supports all termination cases. Native prehire/nonself subjects must not require a targetAuth account; actorAuth2 is separate from targetPeople4.

## Receipt / row ordering — planned only

Frozen G2 `tme_command_receipts` (SQL709–735) already has tenant+publicUUID unique key and typedUUID `result_ref`. Do not add an unnecessary internal receipt UK or put correlationUUID into business refs. Its required numeric field_policy_revision/authorization_revision cannot accept native opaque auth-/policy-/psc-/psr-* strings; **exact neutral receipt authority successor mapping is an internal G3 preparation OPEN**, not a hash-to-long adapter or a G4 excuse.

Proposed transaction plan after internal neutral-owner approval:

1. Current guard/refetch and same-idempotency+different canonical payload conflict check; neutral receipt acquisition under tenant/acting principal/action/key. No auto-grant or raw-body authority.
2. Allocate runUUID/inputUUID and freeze full source vector. The input's tenant/run_public_id→run tenant/publicUUID FK metadata is deferrable=true; run→input internalFK is not.
3. Explicit named deferred-FK plan: insert immutable input first, receive input internalID; insert QUEUED run referencing it, receive run internalID/rowVersion0; insert selected source rows/owner projections with exact RETURNING parents. Commit validates runPublicUUID parent equality. Current plannedCreateSql intentionally omits the second FK pass, so deferrability is not claimed materialized or native.
4. Posting item branch refetches run/selected input+owner/source versions, obtains matching current lease/CAS, binds item/outcome and any ledger effects; receipt success/outbox are same-transaction projections of returned actual state. rowVersion and inputRevision1 remain different fields.
5. Actual employment-end settlement creates workflow first with nullable intent link, returns workflowID, then intent referencing it, returns intentID and CAS attaches link; typed deferred metadata for both references is retained, not silently disabled. STOP/PRORATE omit the entire inapplicable intent row, not a null-filled NOTNULL row.
6. RESULT_UNKNOWN/reconcile refetches exact command digest/originating+current authority/native owner receipt and durable effects; no retry/accepted/success on unknown or missing receipt. Ordinary enrollment cancel follows its own CAS branch, not this employment-end ordering.

New work must emit a typed TransactionPlan/InsertSpec/PersistedRow/ExistingCasMutation trace for concrete A/B records with source refs. No SQL execution while external WFM parent/publication or neutral ownership remains OPEN.

## Acceptance before reporting J1 author-tested

Compile against actual existing neutral v2 ABI. Treat guard-minted result as bounded local composition; production transport/PEP remains OPEN. Native actor row/access2 plus opaque Auth/Policy/Context/Decision revisions preserve exactString; target person/worker/relationship/assignment versions are distinct. Never hash policyRevision to a local numeric governance revision.

J1 must run concrete A/B full payload+source records through the installed Draft07 engine and Java constructors/assemblers (explicit mocks), comparing independently expected95 slots/SQL type/nullable/parent/phase. Preserve actual initialFAIL-before, same-expectationPASS-after, raw XML/stdout, argv, pre/post SHA+decimalns and mock/native boundaries. Integer wire beyond JS-safe precision must receive an explicit source/transport codec decision; existing unrestricted JSON integer does not prove exact64bit revisions in Ajv.

Negative/mutation families: optional-disabled0calls, enabled missing owner, wrong contract/schema/tenant/actor/purpose/field/SoD/target parent, stale/current lease/time window, opaque revision mismatch, no-targetAuth/person-only inappropriate employment coercion, duplicate/sparse/unsorted selection, unit/date/calendar/DST mismatch, changed full payload under same digest, missing/or extra95 slot, source owner/type/nullable/parent swap, inserting with existing-CAS labels, updating without oldVersion, absent RETURNING/default source, correction original grant/run mismatch, unknown/receipt replay, unsupported cancellation cause, illegal termination enum and terminal-row mutation. Counts alone never close source.

## J2/J3 — not in first-four allocation

J2 reuses planned `AbsPolicyEvaluationReportV4.java`, `PublishedScheduleSnapshotResponseV4.java`, `AbsOwnerTypedFieldAdapterV4.java`, `PublishedScheduleSnapshotQuerySpiV4.java` plus independent tests: local ABS evaluator/policy/governance versus full SYS/TIME response sources and all82 imported columns. ABS consumer cannot query TIME business tables; only TIME owner adapter may issue its exact published header/segment query. Offset-bearing instants must compare normalized Instants, not lexical strings.

J3: actual TIME rule-create assembler and nine TIME+nine ABS exhaustive typed guard branches, source-/schema-bound tests and88 planned SQL-guard material review. SQL grammar material is not owner semantic approval. Missing related producer in the original112 stays OPEN even when a pure guard branch compiles.

No G4 full businessCRUD required before exact G3 source/DTO/SPI/failclosed/consumer compile preparation. Conversely planned source/state/receipt authority gaps are G3 preparation gaps and cannot be postponed to G4. Actual owner API/PEP/producers/publication/nativeDML and global customer/provider/statutory activation have separate readiness boundaries; all remain honestly unapproved here.

