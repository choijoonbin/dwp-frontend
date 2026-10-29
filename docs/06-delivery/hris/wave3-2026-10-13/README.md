# HRIS Wave3 Phase A authority refresh

This append-only bundle refreshes the HRIS control authority after the G7 and
Wave2 integrations. It preserves the sealed 102-row G7 overlay and appends a
new Wave3 projection; it never edits the G1/G7/Wave2 predecessor evidence.

Phase A only prepares control state. It does not issue a start token, create or
bind a module worktree, publish a promotion receipt, authorize source changes,
or authorize production use.

The single prepared module is `MOD-PER-COMPPLAN`. Its G7 R1 semantic contract
is retained as predecessor evidence, but its old integration-branch pins and
Performance V4 reservation are stale. The current Performance stream contains
V1, V2, V3 and V16 with `outOfOrder=false`, so Phase A reserves V17 only. The
reservation remains inactive until a later carrier-bound start authority.
The predecessor's complete 68-entry `commonControlOnlyPaths` closed set is
preserved exactly; module work must stop instead of editing any shared
Workforce, XCON/generated, authorization, Gateway, shell, or synchronization
boundary.

Phase A records both pre-start Control conditions as fulfilled:

1. `ALLOCATED_REGISTERED_GRANTED`: the module exclusively receives the
   `typedartifact/**` main/test roots and the single shared foundation table
   `prf_per_artifact_versions` inside V17. This is an allocation, not a domain
   implementation; after a later token the module implements six domain tables
   plus this one shared foundation table in V17.
2. `IMPLEMENTED_TESTED_REGISTERED_GRANTED`: the compensation projection on
   `WorkforceSnapshotQueryPort.v1` is present and pinned to Backend code/tests,
   without changing `PERFORMANCE_V1`. The exact three targeted Gradle test
   argv and their three JUnit XML hashes/counts seal 24 passing tests with zero
   failures, errors, or skips. This is limited exactly to
   `CONTRACT_ABI_IMPLEMENTED_TESTED_REGISTERED_GRANTED; owner runtime provider
wiring intentionally fail-closed and remains post-result Central
integration`.

The HRM owner runtime provider/verifier remains fail closed. Wiring and testing
that runtime projection is explicitly tracked by the existing post-result
`INTEGRATION_VERIFY` Central request; it is not promoted into a new pre-start
gate. The prepared packet retains the predecessor UI work contract, V17-updated
acceptance criteria, exact test closed sets, and executable command argv.

After this bundle is committed and pushed on `dwp-dev`, a later append-only
authority must re-pin that carrier, revalidate both fulfilled conditions,
create fresh worktrees from the then-current `dwp-dev`, bind them to a new
token, and only then issue a promotion receipt. If either condition no longer
validates, Phase B must not issue a token. Old G7/Wave2 tokens and worktrees are
evidence, not reusable authority.

## Deterministic workflow

Run only against clean Backend and Agent pins equal to `origin/dwp-dev`.
Backend may be a clean detached worktree at that exact remote pin, which keeps
unrelated edits in the primary Backend checkout outside this materialization.
Frontend may contain only this Phase A directory as uncommitted work.

```text
python3 docs/06-delivery/hris/wave3-2026-10-13/materialize_wave3_phase_a.py prepare --backend-root /absolute/clean/backend-pin
python3 docs/06-delivery/hris/wave3-2026-10-13/materialize_wave3_phase_a.py check --backend-root /absolute/clean/backend-pin
python3 docs/06-delivery/hris/wave3-2026-10-13/validate_wave3_phase_a.py --backend-root /absolute/clean/backend-pin
python3 docs/06-delivery/hris/wave3-2026-10-13/test_wave3_phase_a.py --backend-root /absolute/clean/backend-pin
```

After the Phase-A bundle is the single direct-child carrier committed and
pushed to `dwp-dev`, rerun only the independent validator with
`--allow-phase-a-carrier`. That explicit mode requires a clean
`HEAD == origin/dwp-dev`, verifies `HEAD^` and its tree against the sealed
pre-carrier pin, and requires the carrier diff closed set to equal the sealed
Phase-A artifact and tool paths exactly.

The validation is control-artifact validation only. It intentionally does not
rerun application, Gradle, Vitest, Playwright, G0-G7, or W1 suites whose source
trees are unchanged by Phase A.
