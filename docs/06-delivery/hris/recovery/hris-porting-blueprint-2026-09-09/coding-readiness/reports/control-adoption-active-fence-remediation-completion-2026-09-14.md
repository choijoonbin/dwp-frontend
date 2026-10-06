# Control adopted predecessor ACTIVE-fence atomic remediation

Status: **frozen `db0d2b5` bounded remediation verified; G3/READY remains closed**.

## Outcome

The public `MigrationControlMain` counterexample was preserved first on PostgreSQL 16: 3 PASS / 1 targeted FAIL, with ACTIVE denying a reopened runtime login at SQLSTATE `42501`. The complete before archive remains `control-adoption-active-fence-reproduction-before-2026-09-14.json.gz.b64` (archive SHA-256 `506c45d6…`, receipt SHA-256 `ba95b365…`, 36/36 ACK).

The approved remediation changes exactly three production files. `AdoptionSealer` captures an immutable, value-only predecessor proof during BASELINE under the held Control lock/bootstrap session. Existing predecessors retain the original direct migration/runtime verification. After ACTIVE, `MigrationAdoptionGuard` observes the exact receipt, control reference, canonical history, inventory, PUBLIC ACL and named migration/runtime ACL through the controller connection; runtime CONNECT is never reopened.

The later TOCTOU audit item is now closed for the migration-session race. `MigrationControlMain.consumeAndTransferAdoption` starts one transaction on that same fence connection. Proof shape is rejected first; then the current ACTIVE ACL and offline boundary are checked, receipt/inventory and planned Flyway history evidence receive write-conflicting `ACCESS EXCLUSIVE` locks, the prepared proof is revalidated, and `transferProtectedObjects` mutates in the same transaction before commit. `runAdoption` no longer opens a second bootstrap connection for transfer.

## Verification

The two adversarial race cases passed on PostgreSQL 16:

- existing adopted predecessor: migration history writer blocked through transfer commit;
- initial predecessor: migration history writer blocked through transfer commit.

The writer in each case used the current temporary migration credential, entered a real PostgreSQL `Lock` wait, remained unfinished after `transferProtectedObjects`, and completed only after the shared transaction committed. `pg_stat_clear_snapshot()` is used only by the test observer to refresh `pg_stat_activity`; production contains no call.

The final focused class then produced two independent fresh 21/21 PASS XML namespaces:

- 114.624 seconds, XML SHA-256 `6856a714…`;
- 94.485 seconds, XML SHA-256 `86dcb343…`.

The second run's exact Control containers were PostgreSQL `71c0076a…` with Testcontainers session `53131e6e…`, and matching Ryuk `2201632d…`. Docker lifecycle events show both destroyed before the evidence runner was released. Concurrent Approval containers were distinguished by their different session and `dwp.approval.owner` label and were never stopped or removed.

There is no claimed final lossless archive: one evidence-only runner had a post-test serialization `NameError`; the next transport waited 30 seconds for every ACK chunk. Both native executions had already completed 21/21 with fresh XML. After the second child and exact containers were absent, only our waiting evidence runner PID/PGID `52711/52711` was terminated. The XML identities/counts/hashes were captured before the later Gradle regression reused the result directory. This is reported as an evidence-transport limitation, not silently presented as an archive pass.

Final regressions, executed once after the production change, passed:

- `MigrationControlMainTest`: 9/9, XML SHA-256 `fe87ee78…`;
- `MigrationAdoptionGuardPostgresTest`: 6/6 on PostgreSQL 16, XML SHA-256 `eb8671f6…`.

The regression semaphore was held from `2026-09-14T13:13:35.734Z` through `13:14:15.701Z`. Critical source SHA and mtime-ns were identical before/after. Exact Control PostgreSQL `e47b25a8…` and matching Ryuk `3e57e4e7…` were absent before release. Manual container stops/removals: zero. Foreign/pre-existing Testcontainers remained separate and untouched.

Negative coverage includes missing/wrong controller identity; receipt digest/reference, history, inventory and ACL drift; positive/all-successful canonical history invariants; missing, wrong, swapped, duplicate and mixed-mode proofs; single-use rejection; both initial/adopted writer races; and the actual public Main ACTIVE path.

## Trust boundary and limits

The concrete prepare/consume-to-first-transfer race is closed: a newly admitted migration session cannot change predecessor history until the atomic transfer transaction commits. The old migration password is rotated and rejected, the temporary credential remains in Control custody, and runtime CONNECT stays denied. A malicious holder of the bootstrap-owner credential is a broader privileged-database compromise; the cooperative advisory lock and offline checks are defense in depth, not a superuser-security claim. Post-commit mutation by a holder of the current migration credential cannot retroactively change the proof used for transfer, and later Flyway/receipt checks remain fail closed under the credential-custody contract.

This evidence is deliberately bounded to frozen `db0d2b5`. It does not certify newer `dwp-dev` `315e1b2`, all Auth migrations/issuer acceptance, or separate Control composition/bridge gates. The unrelated Auth 80-character historical-role `MALFORMED_REQUEST` issue was not touched. No commit, G3/READY promotion, producer publication or whole-backend certification was made.

The JSON companion contains exact hashes, case counts, container IDs, source pins and evidence limitations.
