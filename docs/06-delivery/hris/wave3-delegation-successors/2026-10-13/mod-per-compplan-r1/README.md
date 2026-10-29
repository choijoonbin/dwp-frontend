# HRIS Wave3 MOD-PER-COMPPLAN Phase B activation bundle

This append-only successor consumes the committed and pushed Wave3 Phase A
carrier and seals the exact `MOD-PER-COMPPLAN` module delegation inputs. It
does not modify the Phase A bundle.

Phase B contains one admitted Performance V17 lease, one start token, two
clean and pushed module worktree bindings, a pre-promotion state, and a sealed
manifest. The token remains `ISSUED_PENDING_PROMOTION_RECEIPT`; none of these
artifacts authorizes source changes until a later, separate promotion receipt
lists that exact token in the active-token closed set.

The module authority is limited to the Phase A allowed-path closed set. The
68 inherited common-Control paths remain protected. Shared contracts,
Gateway, authorization, route/shell registration, integration merge, PAY
consumption, customer activation, and production release remain unauthorized.

## Carrier sequence

The immutable sequence is:

1. Phase A carrier `1f187a7903d2792b696a6f8ca2b207ebb79b33e1`.
2. This Phase B bundle in a direct child commit.
3. A later promotion-only direct child commit that pins the Phase B commit and
   tree. The promotion receipt must not exist in Phase B.

Combining steps 2 and 3 would make the promotion receipt self-referential and
is forbidden.

## Deterministic workflow

The frontend worktree must be the clean pushed Phase A carrier. The clean
backend control pin and both module worktrees must remain on their exact
pushed commits with zero ahead/behind counts. The frontend, agent, and both
module worktrees must also have their exact expected `origin/...` branch set
as the configured upstream; a same-SHA but differently configured branch is
rejected. V17 must still be vacant.

```text
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r1/materialize_wave3_mod_per_compplan_activation.py prepare
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r1/materialize_wave3_mod_per_compplan_activation.py check
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r1/validate_wave3_mod_per_compplan_activation.py --phase bundle
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r1/test_wave3_mod_per_compplan_activation.py
```

These commands validate control artifacts only. They do not run Gradle,
Vitest, Playwright, application suites, or historical full-gate suites. The
already sealed Phase A 24-test execution receipt is revalidated by commit,
tree, file hashes, totals, and seal without repeating the tests.

After the Phase B bundle is committed and pushed as the direct child of Phase
A, the already-sealed tool provides the only Phase C materialization path:

```text
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r1/materialize_wave3_mod_per_compplan_activation.py prepare-promotion --bundle-commit <phase-b-commit> --bundle-tree <phase-b-tree>
git commit <the single generated promotion receipt> && git push origin dwp-dev
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r1/materialize_wave3_mod_per_compplan_activation.py check-promotion --bundle-commit <phase-b-commit> --bundle-tree <phase-b-tree>
python3 docs/06-delivery/hris/wave3-delegation-successors/2026-10-13/mod-per-compplan-r1/validate_wave3_mod_per_compplan_activation.py --phase promotion
```

`prepare-promotion` fails closed unless the current clean, pushed `dwp-dev`
HEAD is the exact direct-child Phase B bundle and the receipt is absent from
that commit. It writes only
`docs/06-delivery/hris/2026-10-13-wave3-mod-per-compplan-promotion-receipt.v1.json`.
`check-promotion` and the independent promotion validator require the clean,
pushed Phase C HEAD to be a direct child of Phase B and require the exact
Phase B-to-C diff to contain only that added receipt. No Phase B tool or
artifact may be edited in Phase C.

All five JSON contracts are recursively closed: every represented object has
an exact required/property set with `additionalProperties: false`, and every
bounded array has exact cardinality. Both materialization phases and the
independent validator therefore fail closed on nested field expansion as well
as top-level drift.
