# HRIS Wave3 MOD-PER-COMPPLAN R2 authority bundle

This append-only successor re-pins `MOD-PER-COMPPLAN` after the backend
`dwp-dev` base advanced from `3565c3e61b6c37a6b8088cc5250791fce32a0d9f`
to `8577ef532243c63b34877444738a4edde8b4c0e5`. The one intervening commit
changes only `ReferenceConfigurationService.java`; the People server,
platform contracts, Performance source/test roots, and Performance migration
tree retain their exact Git tree object IDs.

The R1 token is therefore recorded as
`INVALIDATED_BACKEND_BASE_PIN_DRIFT`, and its V17 lease as
`SUPERSEDED_AFTER_BACKEND_BASE_PIN_DRIFT`. Their sealed receipt, token, lease,
bundle, and historical 24-test receipt remain pinned evidence; those unaffected
tests are not re-run. Only the R2 token and R3 lease can become effective.

The R2 authority remains limited to the immutable Phase A eight-path allowed
closed set. All 68 common-Control paths, shared contract/Gateway/auth/shell
wiring, integration merge, PAY consumption, customer activation, and
production release remain unauthorized.

## Exact carrier sequence

1. Historical Phase A carrier: `1f187a7903d2792b696a6f8ca2b207ebb79b33e1`.
2. Historical R1 bundle: `eceef645b6363e7ece301c85ff05f209f275c9a5`.
3. Historical R1 promotion and R2 frontend base:
   `a3a0a75451a7ed14b1f5135f1f56b6271dee41fd`.
4. This R2 bundle as an ADD-only direct child, entirely below this directory.
5. Promotion receipt v2 as a separate, single-file direct child of the R2
   bundle.

Combining steps 4 and 5 is forbidden because it would make the receipt
self-referential.

## Focused deterministic workflow

```text
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r2/materialize_wave3_mod_per_compplan_activation.py prepare
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r2/materialize_wave3_mod_per_compplan_activation.py check
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r2/test_wave3_mod_per_compplan_activation.py
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r2/validate_wave3_mod_per_compplan_activation.py --phase bundle
```

These commands inspect only authority artifacts, exact Git object pins, the
single backend changed-path set, relevant subtree OIDs, clean pushed R2 module
worktrees, and V17 vacancy. They do not run Gradle, Vitest, Playwright, or a
broad historical gate.

After committing and pushing the R2 bundle:

```text
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r2/materialize_wave3_mod_per_compplan_activation.py prepare-promotion --bundle-commit <r2-bundle-commit> --bundle-tree <r2-bundle-tree>
git commit docs/06-delivery/hris/2026-10-13-wave3-mod-per-compplan-promotion-receipt.v2.json
git push origin dwp-dev
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r2/materialize_wave3_mod_per_compplan_activation.py check-promotion --bundle-commit <r2-bundle-commit> --bundle-tree <r2-bundle-tree>
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r2/validate_wave3_mod_per_compplan_activation.py --phase promotion
```

The promotion carrier must add only
`docs/06-delivery/hris/2026-10-13-wave3-mod-per-compplan-promotion-receipt.v2.json`.
