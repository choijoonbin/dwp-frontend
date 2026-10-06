# HRIS-HRM G2 readiness package

## Module execution binding

This package is bound to the clean, dedicated HRM G1 worktrees below. The values were verified from Git on 2026-09-10T11:47:55+09:00.

| Surface | Worktree | Branch | Required and observed HEAD | Dirty paths |
|---|---|---|---|---:|
| Backend | `.codex-worktrees/hris/g1-20260910/hrm/backend` | `codex/hris-hrm-g1-backend-20260910` | `5670877de7a39e94e75021c7e23cbbb553296c90` | 0 |
| Frontend | `.codex-worktrees/hris/g1-20260910/hrm/frontend` | `codex/hris-hrm-g1-frontend-20260910` | `7635ce4223000ed83cb4965f8374d8a8433f1a62` | 0 |

These are module execution baselines, not permission to write code. The HRM module validator verifies both HEAD values and clean status on every run.

## Package contents

- `adr-001-people-sor-effective-dating.md`: SoR, bounded context, effective-time, correction, privacy and downstream decisions.
- `physical-schema-blueprint.sql`: non-executable PostgreSQL physical design and integrity blueprint.
- `api-event-contracts.v1.json`: versioned query, command, receipt, snapshot and semantic event contracts.
- `state-guard-idempotency-recovery.md`: lifecycle states, guards, idempotency, transaction, recovery and reconciliation rules.
- `authorization-field-policy.csv`: package/duty/capability/population/field/purpose/SoD/PEP policy and negative tests.
- `synthetic-golden-fixtures.json` and `synthetic-golden-spec.md`: customer-independent, executable test oracle.
- `build_hrm_g1_evidence.py`: deterministic G1 coverage/child/decision evidence generator over sanitized evidence only.
- `validate_hrm_readiness.py`: fail-closed module validation.

## Gate state and ownership

The HRM-owned package is `READY_FOR_G3_CODE`: 583 parents, 1,654 child behaviors, 15 decided design records, 24 authorization policies, 15 golden cases, and zero `UNKNOWN`/`UNASSESSED`. The central checkpoint issues the code Gate; this package never authorizes production activation.

At the read-only central validation snapshot on 2026-09-10T11:47:55+09:00, the sealed G0 validator reported `G0_VALIDATION=FAIL checks=761856 errors=7187 warnings=0`. The central register/checksum contract still describes the previous baseline and worktrees, while other module traces and build evidence are also being changed. HRM files do not rewrite or waive that central failure.

Integration Control/coordinator must, after all module packages are stable:

1. review and deliberately re-seal the central integration baseline, worktree/branch register and prompt/checksum contract;
2. merge each module coverage shard into the master coverage register and regenerate the trusted digest;
3. merge common authorization and event contracts; bind named human approvers and record ACKs before G6 production activation;
4. allocate non-conflicting Flyway migration numbers after DBA review of this blueprint;
5. replay the approved backend/frontend command matrix from the new baseline until the central validator passes; and
6. retain the central `OPEN_G3_CODE` only while each slice checkpoint and full build remain green.

Operating menu exports, legacy DDL/batch history, customer data, real connector contracts and statutory packs are parity or activation evidence for the affected tenant/adapter/country pack. Their absence does not block generic HRM core design or synthetic implementation testing.
