# HRIS-PER G2 Coding-Readiness Package

Module verdict: `CONTRACT_READY_FOR_INDEPENDENT_G2_REVIEW`  
This package does not self-authorize production. Integration Control completed cross-module validation and issued `OPEN_G3_CODE` for the generic core; G6 activation remains separate.

## Fixed decisions

- Runtime owner: `dwp-people-server/hris/performance`.
- Deployment starts inside People Server, but the bounded context is extractable.
- Frontend owner: `apps/dwp/src/features/hris/performance`.
- HRM data is consumed through an as-of snapshot/event port; no HRM repository/entity access.
- All 349 source parents are decided, with 1,041 child behavior traces and no `UNKNOWN/UNASSESSED`.
- BENSK/ADDSK are outside core; customer/provider data exchange is a signed extension.
- HRIS Home receives permission-trimmed performance widgets; menu discovery remains outside Home.
- Visual polish and Design AI handoff remain G5 work after functional G4.

## Package contents

| Artifact | Purpose |
|---|---|
| `../../g1-characterization.md` | G1 behavior recovery and consolidation contract |
| `../../g1-child-trace.csv` | Route/service/job/interface/formula/file/SQL/state child trace |
| `../../g1-decision-log.csv` | Sixteen closed G1 source-to-target decisions |
| `ADR-001-performance-boundary.md` | SoR, owner, dependencies and extraction boundary |
| `physical-schema.sql` | PostgreSQL physical DDL blueprint for all PER aggregates/reliability tables |
| `api-event-contracts.yaml` | Versioned REST commands/queries, receipts and domain/consumed events |
| `state-guard-idempotency-recovery.md` | State machines, guards, idempotency and failure recovery |
| `authorization-field-policy.md` | DWP permission packages, atomic duties, population/field/purpose/SoD PEP |
| `golden/performance-golden-fixtures.json` | Synthetic deterministic oracle and negative cases |
| `golden/golden-spec.md` | Oracle use, ownership and change policy |
| `g2-code-go-slices.csv` | Bounded implementation order and evidence dependencies |
| `build_g1_evidence.py` | Reproducible coverage/child/decision generation from governed views |
| `validate_per_readiness.py` | Standard-library structural and oracle validator |

## Target code layout

```text
dwp-people-server/src/main/java/.../hris/performance/
  domain/
    cycle/ template/ population/ goal/ review/ feedback/
    checkin/ calibration/ result/ appeal/
  application/
    port/in/ port/out/ command/ query/ policy/ job/
  adapter/
    in/web/ in/event/ out/persistence/ out/hrm/
    out/approval/ out/notification/ out/objectstorage/
    out/automation/ out/integration/ out/audit/
  configuration/
  contract/

apps/dwp/src/features/hris/performance/
  api/ model/ policy/ routes/ widgets/
  cycle/ goals/ reviews/ feedback/ checkins/
  calibration/ results/ appeals/ operations/
```

The `domain` and `application` packages have no Spring Data, HTTP or HRM implementation imports. Adapters implement ports. Database records use public UUIDs at boundaries and tenant-scoped composite constraints.

## Implementation slice order

1. `PER-SLICE-FOUNDATION`: module package, transaction boundary, PEP adapter, inbox/outbox/receipt and HRM snapshot client.
2. `PER-SLICE-CYCLE`: cycle/template draft, validation and publish contracts.
3. `PER-SLICE-POPULATION`: deterministic preview/freeze and assigned reviewer projection.
4. `PER-SLICE-REVIEW`: self review → manager review → auditable result query (first walking vertical).
5. `PER-SLICE-GOAL`: organization/team/individual goal and alignment workspace.
6. `PER-SLICE-FEEDBACK`: multi-source feedback and check-ins.
7. `PER-SLICE-CALIBRATION`: result calculation, calibration, independent publish and visibility.
8. `PER-SLICE-APPEAL`: appeal and correction lineage.
9. `PER-SLICE-DATA-EXCHANGE`: generic import/export receipts; specific provider adapter activation later.

Foundation, Cycle and Population may be implemented behind disabled tenant feature flags while their contracts remain stable. Calibration/publish must not open before critical SoD and step-up integration tests pass.

## Validation

Run from any directory:

```bash
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/session-evidence/per/g2-readiness/validate_per_readiness.py
```

Expected result:

```text
PER_READINESS=PASS checks=40403 parents=349 children=1041 decisions=16 unknown=0 unassessed=0 runtime_owner=dwp-people-server/hris/performance
```

The validator proves internal artifact consistency, not production fitness or human approval.

## Gate boundary

Core coding has no dependency on operating menu exports, customer access logs, AS-IS DDL, customer golden data or live provider contracts. Those are scoped to exact parity, adapter activation, customer UAT/cutover or production release.

Before Integration Control opens a slice G2 gate, it must verify the current integration baseline, cross-module HRM/SYS contracts and independent Architecture/DBA/Security/Privacy/QA findings. Real owners are required for production risk acceptance. A connector-specific or retention-specific open item blocks only that adapter/tenant activation, not the generic PER core.
