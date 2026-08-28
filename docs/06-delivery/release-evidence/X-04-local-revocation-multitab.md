# X-04 local revocation and multi-tab automation

This evidence boundary is local and deterministic only. It is not an approved production
`REVOCATION_SLO`, an `AUTOMATED_RUN_ATTESTATION`, or an owner approval.

## Commands

Run the closed-shape checker tests:

```bash
corepack yarn node --test scripts/check-x04-local-revocation-slo.test.mjs
```

Run the mounted two-tab harness, validate its evidence, and write the local machine-readable
report:

```bash
corepack yarn node scripts/check-x04-local-revocation-slo.mjs
```

The second command writes
`build/reports/product-surface/x04-local-revocation-multitab.json`. The report uses Vitest fake
timer logical milliseconds and covers both `BROADCAST_CHANNEL` and `STORAGE_FALLBACK`. It proves
only that the mounted provider propagates a revision, purges access-sensitive cache entries,
commits the denial probe, retains public cache entries, and remains denied when authority refresh
fails under the deterministic local harness.

## Readiness disposition

Once both commands pass, the internal automation gap is closed, but X-04 must remain release
blocked. The appropriate next state is `BLOCKED_EXTERNAL`, with all of these blockers retained:

- `EXTERNAL_X04_OWNER_APPROVAL`
- `EXTERNAL_APPROVED_PRODUCTION_REVOCATION_SLO`
- `EXTERNAL_STAGING_REAL_BROWSER_CAPABILITY_ATTESTATION`

Do not mark X-04 `COMPLETE` or register the local report as `REVOCATION_SLO`. Completion still
requires an approved numerical production SLO and signed staging evidence from real supported
browsers for both capability modes.
