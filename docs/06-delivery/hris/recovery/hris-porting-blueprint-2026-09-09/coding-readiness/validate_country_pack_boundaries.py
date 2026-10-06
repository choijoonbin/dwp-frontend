#!/usr/bin/env python3
"""Fail-closed proof that Product Core and real country-pack activation are separated."""

from __future__ import annotations

import argparse
import copy
import csv
import json
import re
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REGISTER = HERE / "country-pack-boundary-register.csv"
HEADER = [
    "boundary_id", "module", "capability", "layer", "g3_code_requirement",
    "g3_test_substitute", "g6_real_evidence", "activation_gate",
    "disabled_behavior", "owner_role", "status", "evidence_refs",
]
EXPECTED_IDS = {
    "CPB-TIM-001", "CPB-TIM-002", "CPB-TIM-003", "CPB-TIM-004", "CPB-TIM-005",
    "CPB-PAY-001", "CPB-PAY-002", "CPB-PAY-003", "CPB-PAY-004", "CPB-PAY-005", "CPB-PAY-006",
}
EXPECTED_G6_GATES = {
    "CPB-TIM-004": "ACT-G6-KR-TIME",
    "CPB-TIM-005": "ACT-G6-KR-TIME",
    "CPB-PAY-004": "ACT-G6-KR-PAY",
    "CPB-PAY-005": "ACT-G6-YEA",
    "CPB-PAY-006": "ACT-G6-KR-PAY",
}


def rows_from(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def ref_exists(reference: str) -> bool:
    path_text = reference.split("#", 1)[0]
    return bool(path_text) and (HERE / path_text).resolve().is_file()


def validate_rows(
    header: list[str],
    rows: list[dict[str, str]],
    roles: set[str],
    activation: dict[str, dict[str, str]],
) -> list[str]:
    errors: list[str] = []
    if header != HEADER:
        errors.append("register header drift")
    ids = [row.get("boundary_id", "") for row in rows]
    if set(ids) != EXPECTED_IDS or len(ids) != len(EXPECTED_IDS):
        errors.append("boundary row set must be exact")
    if len(ids) != len(set(ids)):
        errors.append("duplicate boundary_id")

    for index, row in enumerate(rows, 2):
        row_id = row.get("boundary_id", f"line-{index}")
        if any(not row.get(column, "").strip() for column in HEADER):
            errors.append(f"{row_id}: blank required field")
            continue
        if row["module"] not in {"TIM", "PAY"}:
            errors.append(f"{row_id}: unsupported module")
        if row["owner_role"] not in roles:
            errors.append(f"{row_id}: unknown owner role")
        refs = row["evidence_refs"].split("|")
        if not refs or not all(ref_exists(ref) for ref in refs):
            errors.append(f"{row_id}: unresolved evidence reference")

        if row["layer"] in {"PRODUCT_CORE", "PACK_RUNTIME", "TEST_CONFORMANCE_PACK"}:
            if row["g3_code_requirement"] != "REQUIRED_G3":
                errors.append(f"{row_id}: G3 layer is not required implementation")
            if row["g6_real_evidence"] != "N_A" or row["activation_gate"] != "G3_CORE":
                errors.append(f"{row_id}: G3 layer imports real activation evidence")
            if row["status"] != "READY_FOR_G3":
                errors.append(f"{row_id}: G3 layer status drift")
            if not any(token in row["g3_test_substitute"] for token in ("SYNTHETIC", "TEST_ONLY")):
                errors.append(f"{row_id}: G3 substitute is not synthetic/test-only")
        elif row["layer"] == "G6_ACTIVATION":
            if row["g3_code_requirement"] != "INTERFACE_AND_FAIL_CLOSED_ONLY":
                errors.append(f"{row_id}: real rule content entered G3")
            if row["status"] != "NOT_AUTHORIZED_G6":
                errors.append(f"{row_id}: G6 activation is not fail-closed")
            if row["g6_real_evidence"] == "N_A":
                errors.append(f"{row_id}: G6 evidence contract missing")
            expected_gate = EXPECTED_G6_GATES.get(row_id)
            if row["activation_gate"] != expected_gate:
                errors.append(f"{row_id}: activation gate drift")
            gate = activation.get(row["activation_gate"], {})
            if gate.get("gate") != "G6" or gate.get("status") != "DEFERRED_G6_NOT_CORE_BLOCKER":
                errors.append(f"{row_id}: activation register is not deferred G6")
            if gate.get("core_code_effect") != "DOES_NOT_BLOCK_G3_CORE":
                errors.append(f"{row_id}: G6 incorrectly blocks Product Core")
            if not row["disabled_behavior"].startswith("422_"):
                errors.append(f"{row_id}: disabled pack/provider lacks typed fail-closed outcome")
        else:
            errors.append(f"{row_id}: unknown layer")
    return errors


def validate_artifacts() -> list[str]:
    errors: list[str] = []
    tim_dir = ROOT / "session-evidence" / "tim"
    pay_dir = ROOT / "session-evidence" / "pay"
    tim_golden = json.loads((tim_dir / "synthetic-golden-fixtures.json").read_text(encoding="utf-8"))
    pay_golden = json.loads((pay_dir / "synthetic-golden-fixtures.json").read_text(encoding="utf-8"))
    tim_cases = {row["id"]: row for row in tim_golden.get("cases", [])}
    pay_cases = {row["id"]: row for row in pay_golden.get("cases", [])}
    if tim_golden.get("syntheticOnly") is not True or tim_golden.get("currencyOrLegalAssertion") is not False:
        errors.append("TIM golden is not synthetic/non-legal")
    if pay_golden.get("syntheticOnly") is not True or pay_golden.get("statutoryAssertion") is not False:
        errors.append("PAY golden asserts a real statutory outcome")
    if tim_cases.get("TIM-GOLD-010", {}).get("expected", {}).get("KR_STATUTORY_LEAVE") != "422_COUNTRY_PACK_NOT_ACTIVE":
        errors.append("TIM missing-pack fail-closed golden drift")
    pay_boundary = pay_cases.get("PAY-GOLD-010", {}).get("expected", {})
    if pay_boundary.get("CORE_REGULAR_RUN") != "SUCCEEDED" or pay_boundary.get("KR_WITHHOLDING") != "422_COUNTRY_PACK_NOT_ACTIVE":
        errors.append("PAY Product Core/country-pack isolation golden drift")
    if pay_boundary.get("YEA_PROVIDER_SUBMIT") != "422_PROVIDER_NOT_ACTIVE":
        errors.append("PAY YEA provider fail-closed golden drift")

    pay_api = json.loads((pay_dir / "g2-api-event-contracts.json").read_text(encoding="utf-8"))
    pack_activate = next((row for row in pay_api.get("operations", []) if row.get("id") == "country.pack.activate"), {})
    if set(pack_activate.get("activationEvidence", [])) != {"officialReferenceSet", "effectiveDate", "goldenPack", "statutoryApproval"}:
        errors.append("PAY country-pack activation evidence drift")
    if pack_activate.get("sod") != "PACK_INSTALLER_NE_STATUTORY_APPROVER" or pack_activate.get("stepUp") != "required":
        errors.append("PAY country-pack four-eyes/step-up drift")

    pay_ddl = (pay_dir / "g2-physical-schema.sql").read_text(encoding="utf-8")
    for marker in (
        "CREATE TABLE pay_country_pack_versions",
        "official_reference_set_ref",
        "golden_pack_ref",
        "statutory_approved_at",
        "ck_pay_country_pack_activation",
        "status <> 'ACTIVE'",
    ):
        if marker.lower() not in pay_ddl.lower():
            errors.append(f"PAY pack DDL missing {marker}")
    tim_boundary = (tim_dir / "g2-service-boundary.md").read_text(encoding="utf-8")
    pay_runtime = (pay_dir / "g2-runtime-controls.md").read_text(encoding="utf-8")
    if "initial core ships with no statutory numeric default" not in tim_boundary.lower():
        errors.append("TIM no-statutory-default boundary missing")
    if "no guessed law/rate/form" not in pay_runtime.lower() or "disabled pack fails only pack-dependent work" not in pay_runtime.lower():
        errors.append("PAY Product Core/country-pack runtime boundary missing")
    return errors


def load_inputs() -> tuple[list[str], list[dict[str, str]], set[str], dict[str, dict[str, str]]]:
    header, rows = rows_from(REGISTER)
    _, role_rows = rows_from(ROOT / "g0" / "role-register.csv")
    _, gate_rows = rows_from(HERE / "activation-gate-register.csv")
    return header, rows, {row["role_id"] for row in role_rows}, {row["activation_id"]: row for row in gate_rows}


def run_self_test(header: list[str], rows: list[dict[str, str]], roles: set[str], activation: dict[str, dict[str, str]]) -> tuple[int, int]:
    mutations: list[tuple[str, list[dict[str, str]], set[str], dict[str, dict[str, str]]]] = []
    mutations.append(("missing-row", copy.deepcopy(rows[:-1]), roles, activation))
    changed = copy.deepcopy(rows); changed[0]["g6_real_evidence"] = "REAL_RATE_TABLE"; mutations.append(("real-evidence-in-core", changed, roles, activation))
    changed = copy.deepcopy(rows); changed[3]["status"] = "READY_FOR_G3"; mutations.append(("g6-open", changed, roles, activation))
    changed = copy.deepcopy(rows); changed[3]["g3_code_requirement"] = "REQUIRED_G3"; mutations.append(("real-content-in-g3", changed, roles, activation))
    changed = copy.deepcopy(rows); changed[3]["owner_role"] = "ROLE.UNKNOWN"; mutations.append(("unknown-owner", changed, roles, activation))
    changed = copy.deepcopy(rows); changed[3]["activation_gate"] = "ACT-G6-KR-PAY"; mutations.append(("wrong-gate", changed, roles, activation))
    changed_activation = copy.deepcopy(activation); changed_activation["ACT-G6-KR-TIME"]["status"] = "READY"; mutations.append(("activation-register-open", copy.deepcopy(rows), roles, changed_activation))
    caught = sum(bool(validate_rows(header, candidate, candidate_roles, candidate_activation)) for _, candidate, candidate_roles, candidate_activation in mutations)
    return caught, len(mutations)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    header, rows, roles, activation = load_inputs()
    errors = validate_rows(header, rows, roles, activation) + validate_artifacts()
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        print(f"COUNTRY_PACK_BOUNDARY=FAIL rows={len(rows)} errors={len(errors)}")
        return 1
    if args.self_test:
        caught, total = run_self_test(header, rows, roles, activation)
        if caught != total:
            print(f"ERROR: mutation suite caught {caught}/{total}")
            print(f"COUNTRY_PACK_BOUNDARY_SELF_TEST=FAIL mutations={total}")
            return 1
        print(f"COUNTRY_PACK_BOUNDARY_SELF_TEST=PASS mutations={total}")
        return 0
    counts = {module: sum(row["module"] == module for row in rows) for module in ("TIM", "PAY")}
    g3 = sum(row["status"] == "READY_FOR_G3" for row in rows)
    g6 = sum(row["status"] == "NOT_AUTHORIZED_G6" for row in rows)
    print(f"COUNTRY_PACK_BOUNDARY=PASS rows={len(rows)} tim={counts['TIM']} pay={counts['PAY']} g3={g3} g6={g6}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
