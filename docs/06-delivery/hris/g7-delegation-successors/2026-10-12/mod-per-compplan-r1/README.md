# MOD-PER-COMPPLAN R1 preparation bundle

This append-only bundle prepares the `MOD-PER-COMPPLAN` packet after the
effective SYS/HRM R3 closure. It does **not** issue a start token, create or
bind worktrees, activate a migration, authorize source changes, merge an
integration result, or authorize customer/production use.

The bundle resolves the recovered contract conflict before any module token:

- the twelve G3 operation identities and eight v2 event identities remain the
  public ownership closed set, while incompatible request/response shapes are
  explicitly superseded by the per-operation resealed wire contracts;
- `XCON-020`, `XCON-021`, and `SVC-PEP-PER-001` use their current canonical
  definitions, not the incomplete generated compensation payloads;
- the public `snapshot.publish` command accepts only the validated approval
  receipt and returns a bounded ten-field summary. Full `XCON-020` lines are
  never returned to the browser and remain available only to PAY through
  `SVC-PEP-PER-001`;
- `XCON-020` line and payload SHA-256 use sealed RFC 8785/JCS preimages,
  canonical scalar forms, deterministic proposal ordering and persisted replay
  identities, with two known-answer vectors;
- `ApprovedCompensationPlanSnapshotPublished.v2` is emitted only after the
  immutable header and all ordered lines commit; `CompensationPlanApproved.v1`
  and dual publication are forbidden;
- PAY is the sole cross-module consumer, and its owner refetch is the
  service-only, full-atomic, non-paged `SVC-PEP-PER-001` stream;
- the compensation domain closed set is exactly six tables. The same V4 also
  bootstraps one Control-allocated shared `prf_per_artifact_versions` table,
  so the V4 new-table closed set is exactly seven. There is no
  `prf_cmp_plans`, `prf_cmp_proposal_versions`, or
  `prf_cmp_plan_proposal_refs` table;
- the shared typed-artifact port is module-local, strict, encrypted,
  append-only and RLS-protected; a browser/public typed-artifact endpoint is
  forbidden. Its R1 input is the immutable artifact public ID plus expected
  type, owner and purpose; revision, schema and digest are owner-verified
  metadata rather than caller authority;
- cycle creation and revision refetch the complete compensation population via
  a Control-owned additive `WorkforceSnapshotQueryPort.v1` variant with purpose
  `HRIS_PER_COMPENSATION_POPULATION` and projection
  `COMPENSATION_POPULATION_V1`. Partial pages, changed revisions or any
  source-reference/content mismatch fail closed;
- R1 supports `HARD_CAP` only. `EXCEPTION_APPROVAL` is
  `R1_WITHHELD_NOT_IMPLEMENTED`, its receipt column remains null, and neither
  API nor UI exposes an exception path;
- `planId == cycleId == aggregateId` applies only to snapshot publication and
  `XCON-020`/`XCON-021`; proposal events use the proposal public ID;
- the reachable cycle flow is `NONE -> DRAFT -> OPEN -> PROPOSAL_REVIEW ->
  APPROVED -> PUBLISHED`, with explicit cancellation and multi-proposal
  branches and no unreachable `PENDING_APPROVAL` state;
- budget reversals are append-only exact inverses of one unreversed allocation
  under the cycle lock, and approval freezes a collision-free set of exactly
  1..100000 proposals with one deterministic snapshot line per proposal;
- the seven owner-only standard events are complete six-field transition facts
  with no current/latest or historical aggregate refetch. Only XCON-021 uses
  immutable snapshot refetch;
- the UI owner contract fixes route
  `/hr/operations/performance/compensation-planning`, menu node
  `hcm.operations.compensation-planning`, the studio journey, material states,
  and the three view/propose/approve capabilities;
- Performance migration `V4__per_modern_compensation_planning.sql` is merely
  reserved as `RESERVED_CONTROL_ONLY`; admission remains false.

## Files

The five tooling files are authored first:

1. this README;
2. `contracts/mod-per-compplan-preparation.schema.v1.json`, the only schema;
3. `materialize_g7_mod_per_compplan_preparation.py`;
4. `validate_g7_mod_per_compplan_preparation.py`, which deliberately imports
   neither the materializer nor its constants;
5. `test_g7_mod_per_compplan_preparation.py`.

The materializer creates exactly five preparation artifacts:

1. `contract-reseal-authority.v1.json`;
2. `packet.v1.json`;
3. `migration-leases.delta.v1.json`;
4. `state/preparation.v1.json`;
5. `manifest.v1.json`.

No `token`, `promotion`, `activation`, or worktree register belongs to this
directory or carrier.

## Required sequence

From the clean central frontend worktree at the exact R3 closure carrier and
the clean/pushed backend pin:

```text
python3 docs/06-delivery/hris/g7-delegation-successors/2026-10-12/mod-per-compplan-r1/materialize_g7_mod_per_compplan_preparation.py prepare
python3 docs/06-delivery/hris/g7-delegation-successors/2026-10-12/mod-per-compplan-r1/materialize_g7_mod_per_compplan_preparation.py check
python3 docs/06-delivery/hris/g7-delegation-successors/2026-10-12/mod-per-compplan-r1/test_g7_mod_per_compplan_preparation.py
```

Commit and push the exact ten-file directory as one direct child of
`259fae159d35586da2fa79a1fd2947a2e0fb39fd`. Only then validate the carrier:

```text
python3 docs/06-delivery/hris/g7-delegation-successors/2026-10-12/mod-per-compplan-r1/validate_g7_mod_per_compplan_preparation.py preparation \
  --carrier <full-preparation-carrier-commit>
```

The validator requires the carrier to be the clean, current, exactly pushed
head; requires that exact direct parent; verifies the ten added paths and no
other diff; independently checks every seal and source pin; rejects any token,
promotion, activation, or worktree artifact; and rechecks that all authorities
remain withheld.

## Next authority boundary

A passing preparation carrier only establishes
`PACKET_PREPARED_START_WITHHELD`. Before a start token, Control must register
all seven prepared requests and must implement, test, register, and grant both
pre-start allocations: the typed-artifact bootstrap and the additive
WorkforceSnapshot compensation projection. The other five requests are
fulfilled only after the pushed module result. The later activation sequence
is exact: validate the clean/pushed
preparation carrier, check V4 vacancy before any worktree creation, create the
frontend worktree from that preparation carrier and the backend worktree from
`deb39a02634826d40ae5de5e30f54223c31b5851`, recheck V4 immediately before
sealing the activation bundle, issue a start token in
`ISSUED_PENDING_PROMOTION_RECEIPT`, and require a still later promotion receipt
before module source edits can start. PAY remains withheld until the pushed
producer result and named tests are admitted by Control.

Verification follows the repository efficiency rule: run the changed test
cluster first, collect its failures, then run the single closed module batch
once. Broad W1, full application, shared route, and promotion suites are not
part of packet preparation.
