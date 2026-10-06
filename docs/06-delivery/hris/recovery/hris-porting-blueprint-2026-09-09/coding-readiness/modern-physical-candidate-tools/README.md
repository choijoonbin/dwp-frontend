# Modern physical candidate tools

These tools replace the path-coupled 106-table physical validator. They support
two explicit and non-interchangeable scope profiles: the sealed 132-table v3
historical reproduction and the 131-table v4 successor. They do **not** publish a canonical artifact,
allocate Flyway versions, open G3, or authorize G6.

## Scope profiles

- `v3-132-historical` is the default only to preserve the sealed q0/v3 audit
  command and its exact 38 finding tuples. It accepts only policy v3 at its
  fixed file hash and self-seal, with exact counts `199/133/66/25/155/132`.
- `v4-131-successor` must be selected explicitly. It accepts only policy v4 at
  its fixed file hash and self-seal, with exact counts
  `199/133/66/27/157/131`. It also requires the manifest's exact policy pin,
  Listening `plannedTables=23`, `ownerPortOperations=18`, exact `+17/-1`
  (`netDelta=16`) scope, and no operational/schema/lineage reference to the
  removed `sys_hris_listening_export_receipts` table.

Passing one profile under the other profile is a fail-closed error; table or
handler count spoofing cannot select a profile implicitly.

## Safety boundary

- Every canonical source directory and output directory is supplied explicitly.
- Both tools reject symlink roots/ancestors and bind every input to one
  `O_NOFOLLOW` regular-file descriptor/inode while reading it.
- Every declared canonical self-seal is verified; the manifest, causal-state,
  public-identity and semantic-binding authority documents require one. The
  three intentionally byte-pinned core projections are bound through their
  closed-set manifest file/seal references instead of inventing new seals.
- Output is written to a sibling temporary directory, fsynced, then published
  with the host kernel's no-replace rename; there is no check-then-overwrite
  fallback. Output/report parents must already be real directories.
- SQL identifiers, types, defaults and CHECK/predicate expressions use closed
  allowlists. Arbitrary functions, statements, qualification and comments are
  rejected before rendering.
- `coding-readiness/modern-physical-successor/` is never read as a generation
  source and is never modified.
- A `LOCAL_COMPOSITE_FK` or command `LOCAL_TABLE` selector crossing a
  service/schema owner fails before any SQL is written.
- The explicit physical-owner prefix register is byte-pinned; each table must
  match its reviewed service, bounded context, schema and allowed prefix row.
- The selected expansion policy is mandatory and byte-pinned. All 17 additions
  must have the exact complete producer set and at least one
  field-policy-safe reader.
- In v4 mode, the immutable v4 expansion policy and its manifest pin are
  mandatory. The one reviewed orphan removal must not leave an FK, selector,
  DML, reader, lineage or authority reference.
- Revision history uses one supported model: immutable predecessor-chain
  appends serialized by owner-root CAS. Raw history interval exclusion is not
  materialized because correction and future supersession legitimately overlap.

## Generate

```text
python3 coding-readiness/modern-physical-candidate-tools/generate_modern_physical_candidate.py \
  --scope-profile v4-131-successor \
  --canonical-dir <explicit-seven-file-canonical-candidate> \
  --expansion-policy coding-readiness/modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v4.json \
  --owner-prefix-register coding-readiness/physical-owner-prefix-register.csv \
  --output-dir <new-absent-physical-candidate-directory>
```

Use `--preflight-only` to inspect a canonical candidate without writing physical
artifacts. `--preflight-report <new-file>` writes a sealed diagnostic snapshot,
including failures.

Run the generator's path, seal, SQL grammar and exclusive-publication hostile
self-test without canonical inputs:

```text
python3 coding-readiness/modern-physical-candidate-tools/generate_modern_physical_candidate.py --tool-self-test
```

Five executable owner-local SQL units are emitted when preflight passes:

1. HRM in the People service `public` schema.
2. PER in the People service `hris_performance` schema.
3. TIM in the Time service `public` schema.
4. SYS Platform across its four owner schemas.
5. SYS Auth participation issuer in its own database/schema.

PAY has no modern producer-owned table in this closed set. Its two consumer
materializations remain a separately governed PAY contract and are not generated
as fake modern owners.

## Independently validate

```text
python3 coding-readiness/modern-physical-candidate-tools/validate_modern_physical_candidate.py \
  --scope-profile v4-131-successor \
  --canonical-dir <same-canonical-candidate> \
  --expansion-policy coding-readiness/modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v4.json \
  --owner-prefix-register coding-readiness/physical-owner-prefix-register.csv \
  --physical-dir <generated-physical-candidate> \
  --self-test \
  --docker-postgres all \
  --report <new-report-file>
```

`--docker-postgres all` executes the DDL in disposable PostgreSQL 16 and 18
containers, with separate People, Time, Platform and Auth databases. The
validator pulls each requested tag, records its immutable image ID/repository
digests, starts the container by image ID, and verifies the running container
binding. It provisions distinct migration/runtime roles, executes DDL as the
migration role, and proves owner, RLS, `NOBYPASSRLS`, schema and least-privilege
ACL boundaries. It also executes same-interval correction, future supersession,
immutable predecessor and concurrent same-expected-version CAS fixtures and
requires PostgreSQL 16/18 normalized observations to agree. Each PostgreSQL row
and the final validation report are self-sealed. It removes only the uniquely
named containers it created. Docker execution is deferred until a new canonical
candidate reaches zero static findings.

The validator's input-independent hostile checks can be run alone:

```text
python3 coding-readiness/modern-physical-candidate-tools/validate_modern_physical_candidate.py --tool-self-test
```

With `--self-test`, a zero-static candidate additionally undergoes resealed
handler trigger, query method and SQL column-type mutation attacks plus
v3/v4-profile confusion, count spoofing, removed-table dangling-reference and
policy identity drift attacks; exact canonical projection reconstruction must
detect each mutation.

Passing this validator means only that a sealed physical candidate is internally
closed and executable. Integration Control must still review it, allocate new
forward-only migrations, run service test suites, refresh downstream consumers,
and perform the authoritative G3 transition.
