# HRIS scoped authoring control package

This package prepares `HRIS-HRM`, `HRIS-PER`, `HRIS-PAY`, `HRIS-TIM`, and
`HRIS-SYS` to the point immediately before feature development.

It is deliberately separate from
`output/hris-porting-blueprint-2026-09-09`. The existing G3 package remains
the authority for the official integration gate, and its current effective
gate remains `CLOSED_FAIL_SAFE`.

## Allowed state transition

This preparation run may advance only through:

```text
DRAFT
  -> PACKET_ISSUED_HOLD
  -> PREFLIGHT_PASS
  -> READY_TO_START_HOLD
```

The following transitions are not authorized by this package:

```text
START_SCOPED_AUTHORING
SCOPED_AUTHORING_ACTIVE
OPEN_G3_CODE
G4
G5A
G6
```

`READY_TO_START_HOLD` means that a module has an immutable preparation
packet, clean isolated backend/frontend worktrees, a single first slice,
path and migration boundaries, pinned contract/fixture inputs, and closed
verification-profile bindings. It does not grant permission to modify code,
SQL, tests, design assets, or integration branches.

## Contents

- `packets/*.v1.json`: module-specific preparation packets.
- `registers/scoped-authoring-worktree-register.csv`: the ten isolated
  worktrees. These do not replace the official twelve G3 worktrees.
- `receipts/*-preflight.v1.json`: Control-recorded read-only preflight
  receipts.
- `receipts/environment-preflight.v1.json`: supplementary immutable evidence
  for dependency installation, package-manager checks, architecture scans,
  frontend typechecks, backend main/test-source compilation, and the final
  clean-state recheck of all ten worktrees. It does not claim that feature
  tests ran before authoring.
- `state/current-readiness.v1.json`: aggregate readiness and hold state.
- `validators/validate_scoped_authoring_control.py`: read-only validator;
  Control may additionally use `--write-receipt` to materialize a receipt.
- `materialize_scoped_authoring_control.py`: one-time packet materializer.

## Start boundary

Feature work may begin only after a later, explicit user instruction and a
separate Control transition carrying the literal command
`START_SCOPED_AUTHORING`. Until then every module must remain idle even when
its preflight result is `PREFLIGHT_PASS_READY_TO_START_HOLD`.

## Environment preflight

All five frontend worktrees passed immutable dependency installation,
package-manager validation, the HRIS layer scan, and typechecking. All five
backend worktrees passed the bounded main/test-source compile profile for
their assigned server modules. The layer scanner correctly continued to
report `g3StartAuthorized=false` because the official gate remains closed.
The ten worktrees remained clean and pinned to their packet HEAD/tree after
these checks.
