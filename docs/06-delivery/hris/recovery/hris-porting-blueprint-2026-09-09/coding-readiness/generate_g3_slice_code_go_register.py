#!/usr/bin/env python3
"""Generate the exact per-slice G3 code-go register from sealed G2 inputs."""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUTPUT = HERE / "g3-slice-code-go-register.csv"

HEADER = [
    "slice_id",
    "source_kind",
    "source_ref",
    "session_id",
    "module",
    "delivery_wave",
    "prerequisite_contracts",
    "ia_node_ids",
    "api_event_contract_refs",
    "authorization_refs",
    "schema_state_contract_refs",
    "dependency_ids",
    "file_allocation_ids",
    "migration_allocation_ids",
    "test_evidence_refs",
    "code_go_token",
    "gate_condition",
    "gate_status",
    "implementation_state",
    "production_state",
]

SESSION_BY_MODULE = {name: f"HRIS-{name}" for name in ("HRM", "PER", "TIM", "PAY", "SYS")}
G2_REFS = {
    "HRM": "../session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql|../session-evidence/hrm/g2-readiness/state-guard-idempotency-recovery.md|../session-evidence/hrm/g2-readiness/api-event-contracts.v1.json",
    "PER": "../session-evidence/per/g2-readiness/physical-schema.sql|../session-evidence/per/g2-readiness/state-guard-idempotency-recovery.md|../session-evidence/per/g2-readiness/api-event-contracts.yaml",
    "TIM": "../session-evidence/tim/g2-physical-schema.sql|../session-evidence/tim/g2-runtime-controls.md|../session-evidence/tim/g2-api-event-contracts.json",
    "PAY": "../session-evidence/pay/g2-physical-schema.sql|../session-evidence/pay/g2-runtime-controls.md|../session-evidence/pay/g2-api-event-contracts.json",
    "SYS": "../session-evidence/sys/g2-physical-schema.sql|../session-evidence/sys/g2-state-machines.md|../session-evidence/sys/g2-contract-catalog.csv",
}
VALIDATORS = {
    "HRM": "../session-evidence/hrm/g2-readiness/validate_hrm_readiness.py",
    "PER": "../session-evidence/per/g2-readiness/validate_per_readiness.py",
    "TIM": "../session-evidence/tim/validate_readiness.py",
    "PAY": "../session-evidence/pay/validate_readiness.py",
    "SYS": "../session-evidence/sys/validate_sys_readiness.v2.py|../session-evidence/sys/validate_sys_service_local_migrations.py",
}
AUTH_REFS = {
    "HRM": "../session-evidence/hrm/g2-readiness/authorization-field-policy.csv",
    "PER": "../session-evidence/per/g2-readiness/authorization-field-policy.md",
    "TIM": "../session-evidence/tim/g2-authorization.md",
    "PAY": "../session-evidence/pay/g2-authorization.md",
    "SYS": "../hris-atomic-duty-matrix.csv|../hris-sod-rule-matrix.csv",
}
MIGRATIONS = {
    "HRM": "MIG-HRM-PEOPLE-47-69",
    "PER": "MIG-PER-PERFORMANCE-1-63",
    "TIM": "MIG-TIM-TIME-1-39",
    "PAY": "MIG-PAY-PAYROLL-1-49",
    "SYS": "MIG-SYS-AUTH-211-239|MIG-SYS-PLATFORM-231-259",
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def split_pipe(value: str) -> list[str]:
    return [item.strip() for item in value.split("|") if item.strip()]


def joined(values: list[str] | set[str]) -> str:
    return "|".join(sorted(set(values)))


def build_rows() -> list[dict[str, str]]:
    tfr_rows = read_csv(HERE / "target-family-resolution-register.csv")
    trace_rows = read_csv(HERE / "modern-capability-trace-register.csv")
    delivery_rows = {
        row["capability_id"]: row
        for row in read_csv(HERE / "modern-capability-delivery-register.csv")
    }
    ia_rows = read_csv(HERE / "hris-information-architecture-register.csv")
    gate_rows = {
        row["session_id"]: row
        for row in read_csv(HERE / "module-code-gate-register.csv")
    }
    allocation_rows = read_csv(HERE / "g3-file-allocation-register.csv")

    module_allocations: dict[str, list[str]] = defaultdict(list)
    for row in allocation_rows:
        if row["session_id"].startswith("HRIS-"):
            module_allocations[row["session_id"]].append(row["allocation_id"])

    ia_by_tfr: dict[str, list[dict[str, str]]] = defaultdict(list)
    ia_by_key = {row["source_node_key"]: row for row in ia_rows}
    for row in ia_rows:
        for reference in split_pipe(row["source_family_refs"]):
            ia_by_tfr[reference].append(row)

    rows: list[dict[str, str]] = []
    order_by_module: dict[str, int] = defaultdict(int)
    for source in tfr_rows:
        module = source["module"]
        session_id = SESSION_BY_MODULE[module]
        order_by_module[module] += 1
        ia_matches = ia_by_tfr.get(source["resolution_id"], [])
        rows.append(
            {
                "slice_id": f"BASE-{source['resolution_id']}",
                "source_kind": "BASE_TARGET_FAMILY",
                "source_ref": source["resolution_id"],
                "session_id": session_id,
                "module": module,
                "delivery_wave": f"G3A_BASE_{order_by_module[module]:03d}",
                "prerequisite_contracts": gate_rows[session_id]["required_upstream_dependencies"],
                "ia_node_ids": joined([row["ia_node_id"] for row in ia_matches]) or "NON_UI_SUPPORTING_SLICE",
                "api_event_contract_refs": joined(
                    split_pipe(source["resolution_refs"])
                    + [ref for row in ia_matches for ref in split_pipe(row["api_contract_refs"])]
                ),
                "authorization_refs": joined(
                    [ref for row in ia_matches for ref in split_pipe(row["authorization_refs"])]
                ) or AUTH_REFS[module],
                "schema_state_contract_refs": G2_REFS[module],
                "dependency_ids": gate_rows[session_id]["required_upstream_dependencies"],
                "file_allocation_ids": joined(module_allocations[session_id]),
                "migration_allocation_ids": MIGRATIONS[module],
                "test_evidence_refs": VALIDATORS[module],
                "code_go_token": f"G3-CODE-GO-BASE-{source['resolution_id']}",
                "gate_condition": "SEALED_G2_EXACT_CONTRACTS_AND_CENTRAL_ALLOCATION_PASS",
                "gate_status": "OPEN_G3_CODE",
                "implementation_state": "NOT_STARTED_G3",
                "production_state": "NOT_AUTHORIZED_G6",
            }
        )

    for trace in trace_rows:
        delivery = delivery_rows[trace["capability_id"]]
        session_id = trace["owner_session"]
        module = session_id.removeprefix("HRIS-")
        menu_keys = split_pipe(trace["menu_node_keys"])
        ia_matches = [ia_by_key[key] for key in menu_keys]
        rows.append(
            {
                "slice_id": trace["implementation_slice_id"],
                "source_kind": "MODERN_CAPABILITY",
                "source_ref": trace["capability_id"],
                "session_id": session_id,
                "module": module,
                "delivery_wave": delivery["delivery_wave"],
                "prerequisite_contracts": delivery["prerequisite_contracts"],
                "ia_node_ids": joined([row["ia_node_id"] for row in ia_matches]),
                "api_event_contract_refs": joined(split_pipe(trace["api_event_contracts"])),
                "authorization_refs": joined(split_pipe(trace["authorization_capabilities"])),
                "schema_state_contract_refs": joined(
                    split_pipe(trace["data_contracts"])
                    + [
                        "modern-capability-exact-schema-contracts.v1.json",
                        "modern-capability-event-payload-contracts.v1.json",
                    ]
                ),
                "dependency_ids": gate_rows[session_id]["required_upstream_dependencies"],
                "file_allocation_ids": joined(module_allocations[session_id]),
                "migration_allocation_ids": MIGRATIONS[module],
                "test_evidence_refs": trace["test_evidence_allocation"],
                "code_go_token": f"G3-CODE-GO-{trace['implementation_slice_id']}",
                "gate_condition": "SEALED_G2_EXACT_CONTRACTS_AND_CENTRAL_ALLOCATION_PASS",
                "gate_status": "OPEN_G3_CODE",
                "implementation_state": "NOT_STARTED_G3",
                "production_state": "NOT_AUTHORIZED_G6",
            }
        )

    return sorted(rows, key=lambda row: (row["session_id"], row["delivery_wave"], row["slice_id"]))


def write_rows(path: Path = OUTPUT) -> None:
    rows = build_rows()
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

SERVICE_CONSUMER_RELATED = {
    "SVC-PEP-HRM-002": {"BASE-TFR-PER-016", "BASE-TFR-TIM-019", "BASE-TFR-PAY-013"},
    "SVC-PEP-HRM-003": {"BASE-TFR-PAY-013"},
    "SVC-PEP-HRM-004": {"BASE-TFR-TIM-019"},
    "SVC-PEP-HRM-005": {"BASE-TFR-PAY-013"},
    "SVC-PEP-HRM-006": {"BASE-TFR-SYS-012"},
    "SVC-PEP-PER-001": {"BASE-TFR-PAY-016"},
    "SVC-PEP-PER-002": {"BASE-TFR-SYS-012"},
    "SVC-PEP-TIM-001": {"BASE-TFR-PAY-013"},
    "SVC-PEP-TIM-002": {"BASE-TFR-SYS-012"},
    "SVC-PEP-PAY-001": {"BASE-TFR-SYS-012"},
}

XCON_CONSUMER_DEFAULT = {
    "HRIS-PER": "BASE-TFR-PER-016",
    "HRIS-TIM": "BASE-TFR-TIM-019",
    "HRIS-PAY": "BASE-TFR-PAY-013",
    "HRIS-SYS": "BASE-TFR-SYS-012",
}
XCON_CONSUMER_OVERRIDE = {
    **{
        (f"XCON-{number:03d}", "HRIS-PAY"): "BASE-TFR-PAY-021"
        for number in (1, 2, 3, 4, 5, 6, 7, 17, 18, 19)
    },
    **{
        (f"XCON-{number:03d}", "HRIS-PAY"): "BASE-TFR-PAY-020"
        for number in range(8, 12)
    },
    **{
        (f"XCON-{number:03d}", "HRIS-TIM"): "BASE-TFR-TIM-019"
        for number in (1, 3, 5, 16)
    },
    **{
        (f"XCON-{number:03d}", "HRIS-PER"): "BASE-TFR-PER-016"
        for number in (1, 3, 5)
    },
    **{
        (f"XCON-{number:03d}", "HRIS-SYS"): "BASE-TFR-SYS-012"
        for number in range(12, 16)
    },
    ("XCON-004", "HRIS-TIM"): "BASE-TFR-TIM-003",
    ("XCON-020", "HRIS-PAY"): "BASE-TFR-PAY-016",
    ("XCON-021", "HRIS-PAY"): "BASE-TFR-PAY-016",
}


if __name__ == "__main__":
    write_rows()
    print(f"WROTE {OUTPUT} rows={len(build_rows())}")
