# Pre-G3 common-foundation migration receipt contract v1

This contract defines the two canonical JSON instances that may be created only
after the final backend commit and both PostgreSQL evidence runs are frozen.
Missing instances are a fail-closed state. Empty strings, placeholder hashes,
future values, inferred reviewer identities, and partial receipts are forbidden.

## Authority boundary

- Allocation instance: `pre-g3-common-foundation-migration-allocation.v1.json`
- Technical review instance: `pre-g3-common-foundation-migration-technical-review.v1.json`
- Independent validator: `validate_pre_g3_common_foundation_migrations.py`
- Closed evidence runner: `capture_pre_g3_common_foundation_postgres_evidence.py`
- Current C1 successor generator: `generate_migration_successor_register.py`
- Allocation status: `SEALED_TECHNICAL_ALLOCATION_NO_START_AUTHORITY`
- Review status: `INTERNAL_TECHNICAL_REVIEW_PASS_G3_ENTRY_ONLY`
- Gate while either receipt is created: `CLOSED_FAIL_SAFE`
- Module start authorization: `NONE`
- Production authorization: `NOT_AUTHORIZED_G6`
- Review role: `ROLE.DBA_AUTHORITY` as an internal technical role only
- Identity attestation: `NO_EXTERNAL_IDENTITY_ATTESTATION`
- G6 boundary: `G6_APPROVAL_NOT_SATISFIED`

The review pins the allocation file SHA-256, byte length, and payload seal. The
allocation never points back to the review. This one-way relation prevents a
reciprocal digest cycle. Neither receipt is a named-person approval, customer
acceptance, production release, or G6 authorization.

## Exact migration set

The allocation contains exactly six committed regular `100644` blobs:

1. Approval `V36__close_remaining_approval_trigger_execution_boundaries.sql`
2. Approval `V37__close_approval_seed_execution_boundary.sql`
3. Approval `V38__bind_retention_aware_trigger_entrypoints_to_owner.sql`
4. Platform `V254_1__bridge_platform_trigger_inventory_before_v255.sql`
5. Platform `V261__close_platform_trigger_and_facility_retention_boundaries.sql`
6. Notification `V32__close_approval_sla_delivery_trigger_execution_boundary.sql`

Every row records repository, service, stream, Flyway kind and version, path,
Git blob OID, SHA-256, and byte length. The validator compares these values with
the final commit object, not mutable worktree bytes. Existing Approval migrations
through V35 and existing Platform versioned migrations through V260 must retain
their baseline blob/byte manifests exactly. Existing Notification migrations
through V30 are immutable as well. The only migration-path diff from the sealed
baseline is the six-file add set. Notification V31 remains external WIP and must
be absent; central pre-G3 forward-only V32 alone closes the three immutable V27
SLA-delivery trigger execution boundaries without editing V27/V29/V30.

## Platform bridge and forward correction

Fresh databases execute the immutable versioned stream. `V254.1` is therefore
ordered normally after V254 and before V255, followed eventually by V261. A
separate B-prefix cumulative baseline was rejected before G3 because it did not
preserve the historical migration/seed semantics and caused broad Platform
regression failures. B260 SQL, its generator/source manifest/tests, and any
Flyway baseline-prefix activation are absent from the final commit and are not
evidence or authority inputs. A future fresh-install optimization requires its
own successor design and is outside this Gate.

Normal Flyway execution remains `outOfOrder=false`. The only exception is the
exact ignored Platform `V254.1` bridge after a successful immutable V255. Control
may execute one bounded `target=254.1,outOfOrder=true` pass and must immediately
return to latest with `outOfOrder=false`. Fresh and pre-V255 execution are
ordered V-stream paths. V255-or-later execution makes V254.1 a recorded no-op;
V261 owns the forward correction. No old checksum, SQL, or history row may be
edited.

After the foundation, Approval high-water is 38, Platform high-water is 261,
and the unused 29-slot SYS Platform module reservation is `V262..V290`.

## PostgreSQL evidence

The technical review pins two canonical evidence JSON files, one for
`postgres:16-alpine` and one for `postgres:18.4-alpine`. The closed runner takes
only one of those two image names; a caller cannot supply a status, count,
digest, source path, command, observation, or output path. It requires the
backend HEAD/tree to remain clean and unchanged, binds both committed test-source
blobs, executes the closed two-class command, and rejects stale, symlinked, or
replaced output.
It also records the resolved official `postgres@sha256:...` repository digest.

The Platform and Notification suites write their actual observations only to
runner-created, type-specific temporary paths. The Platform sidecar uses the
exact `dwp.pre-g3.platform-observation/v1` schema and 21-scenario set. The
Notification sidecar uses its own closed schema and 5-scenario set. The runner
canonicalizes each and preserves both fresh JUnit XML files and both sidecars
under image-specific `control-evidence-intake` paths with SHA-256 and byte
length. Every output is `CREATE_NEW_ONLY`; a partial failed
publication removes only files created by that attempt and never overwrites a
prior generation. Each evidence JSON therefore records the exact backend
commit/tree, command, test-source pin, image digest, preserved JUnit bytes and
case list, zero failures/errors/skips, and these observed invariants:

- 50 public trigger entry functions;
- 68 exact non-internal public-relation/public-function trigger mappings;
- mapping digest `cade7c2964b47a298bedc9c9d26f5185e5418ec0736db3b0d6ba5a5e7bc2bd8d`;
- 8 mappings for the seven V254.1 bridge functions;
- bridge subset digest `342b41d9d6d39450b750bbdf63415fa98bb28e133d0138fa435bd82221c0d2af`;
- zero remaining bridge schemas after V261;
- the migration login has no database `CREATE` privilege at entry and exit;
- fresh immutable V-stream and V191/V254/V255/V260 upgrade paths pass;
- NOCREATEDB Control execution for fresh/V254/V260 passes;
- V254.1 failure cleanup/retry, the exact empty bridge-schema interruption
  recovery, and V261 mapping-drift failure/retry pass;
- all seven historyless-nonempty object classes, unexpected ignored migration,
  source-digest drift, and immutable-predecessor byte checks pass.

The Notification proof independently executes runtime DML, tenant-scoped
transaction, fresh, upgrade, and failure→rollback→repair→retry paths. It
validates the exact three V27 SLA-delivery trigger mappings and their canonical
structural tuple digest, both hardened function boundaries, zero direct runtime
function execution grants, and exactly one successful V32 history row. Platform
and Notification testcase identities are disjoint and must equal the union of
the two closed sets; success in one suite cannot mask a missing or stale result
in the other.

The evidence is synthetic/disposable PostgreSQL engineering evidence. It is not
production data evidence, an external identity attestation, or a G6 approval.

## Refresh ordering

Freeze and commit backend source first; prove that no B260 artifact/configuration
or Notification V31 remains and that every old V migration blob is immutable;
execute and capture
PG16 and PG18 from that exact commit with the closed runner; create the
allocation once; create the one-way technical review once; run validator normal
and self-test; deterministically write and check `migration-successor-register.v1.json`
with its one-way `preG3FoundationLineage`; then refresh SYS successors, blueprint
lineage, checkpoint package
digests, code-entry evidence, canonical snapshot, and finally the authoritative
live Gate transition. The second image must be captured before either receipt,
and each image's JUnit XML must be preserved immediately because Gradle reuses
the build-result path.
