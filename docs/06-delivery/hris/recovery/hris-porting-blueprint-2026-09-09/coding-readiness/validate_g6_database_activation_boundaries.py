#!/usr/bin/env python3
"""Keep production database identity and migration credentials fail-closed at G6."""

from __future__ import annotations

import argparse
import copy
import csv
import json
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ACTIVATION = HERE / "activation-gate-register.csv"
PREPARATION = ROOT / "remaining-preparation-register.csv"
ACTIVATION_HEADER = [
    "activation_id", "module_or_platform", "capability", "required_real_evidence",
    "core_test_substitute", "owner_role", "named_binding_required", "gate", "status",
    "core_code_effect", "production_effect", "evidence",
]
PREPARATION_HEADER = [
    "prep_id", "required_before", "category", "item", "owner", "status",
    "blocking_scope", "exit_evidence",
]
EXPECTED = {
    "ACT-G6-DB-IDENTITY-ADOPTION": {
        "prep_id": "G6-03",
        "module_or_platform": "ALL",
        "owner_role": "ROLE.DBA_AUTHORITY",
        "capability": "Production database service identity adoption",
        "evidence_markers": {
            "service-by-service database principal inventory",
            "schema-history and ownership digest",
            "Control-only credential cutover",
            "backup and restore point",
            "strict process restart",
            "rollback rehearsal",
            "named DBA and Security signoff",
        },
        "prep_category": "DB_IDENTITY_ADOPTION",
        "prep_scope": "ALL_PRODUCTION_DATABASE_SERVICES",
    },
    "ACT-G6-RUNTIME-NO-MIGRATION-CREDENTIALS": {
        "prep_id": "G6-04",
        "module_or_platform": "ALL",
        "owner_role": "ROLE.SECURITY_AUTHORITY",
        "capability": "External migration job and runtime credential separation",
        "evidence_markers": {
            "external Control Flyway job completion receipt",
            "exact schema-history digest",
            "runtime deployment artifact and environment inventory",
            "migration datasource and credential absence",
            "strict restart",
            "rollback rehearsal",
            "named DBA Security and release signoff",
        },
        "prep_category": "RUNTIME_MIGRATION_CREDENTIAL_REMOVAL",
        "prep_scope": "ALL_PRODUCTION_RUNTIME_ARTIFACTS",
    },
    "ACT-G6-APPROVAL-LEGACY-ROLE-HARDENING": {
        "prep_id": "G6-05",
        "module_or_platform": "APPROVAL",
        "owner_role": "ROLE.DBA_AUTHORITY",
        "capability": "Legacy Approval database role inheritance and ACL hardening recovery",
        "evidence_markers": {
            "Approval database principal inventory",
            "rolinherit=false conversion or controlled role rebuild",
            "membership ownership cluster and database ACL before-after diff",
            "schema-history and ownership digest",
            "backup restore point",
            "strict process restart",
            "rollback rehearsal",
            "named DBA Security and SRE release approval",
        },
        "core_test_substitute": "Fresh or disposable Approval database migration with NOINHERIT role invariants and strict ACL negative tests",
        "production_effect": "BLOCKS_APPROVAL_PRODUCTION_ACTIVATION",
        "prep_category": "APPROVAL_LEGACY_ROLE_HARDENING_RECOVERY",
        "prep_scope": "AFFECTED_EXISTING_APPROVAL_PRODUCTION_DATABASES_ONLY",
        "prep_item_markers": {
            "V24-era INHERIT state",
            "approved one-time NOINHERIT role and ACL hardening recovery",
            "rolinherit=false conversion or a controlled role rebuild",
        },
        "exit_markers": {
            "fresh or disposable G3 databases remain non-blocking",
            "affected Approval production database remains fail-closed",
            "named DBA/Security/SRE release approval",
        },
    },
}


def read_csv(path: Path, expected_header: list[str]) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if list(reader.fieldnames or []) != expected_header:
            raise ValueError(f"{path.name}: header drift")
        return list(reader)


def split_pipe(value: str) -> set[str]:
    return {item for item in value.split("|") if item}


def validate_data(activation_rows: list[dict[str, str]], preparation_rows: list[dict[str, str]]) -> list[str]:
    errors: list[str] = []
    require = lambda condition, message: None if condition else errors.append(message)
    activation_ids = [row.get("activation_id", "") for row in activation_rows]
    prep_ids = [row.get("prep_id", "") for row in preparation_rows]
    require(len(activation_ids) == len(set(activation_ids)), "activation IDs are duplicated")
    require(len(prep_ids) == len(set(prep_ids)), "preparation IDs are duplicated")
    by_activation = {row.get("activation_id", ""): row for row in activation_rows}
    by_prep = {row.get("prep_id", ""): row for row in preparation_rows}
    for activation_id, expected in EXPECTED.items():
        row = by_activation.get(activation_id, {})
        require(bool(row), f"{activation_id}: activation row missing")
        require(
            row.get("module_or_platform") == expected["module_or_platform"],
            f"{activation_id}: module or platform boundary drift",
        )
        require(row.get("capability") == expected["capability"], f"{activation_id}: capability drift")
        require(row.get("owner_role") == expected["owner_role"], f"{activation_id}: accountable role drift")
        require(split_pipe(row.get("required_real_evidence", "")) == expected["evidence_markers"], f"{activation_id}: exact evidence contract drift")
        require(
            row.get("named_binding_required") == "YES"
            and row.get("gate") == "G6"
            and row.get("status") == "DEFERRED_G6_NOT_CORE_BLOCKER"
            and row.get("core_code_effect") == "DOES_NOT_BLOCK_G3_CORE"
            and row.get("production_effect") == expected.get("production_effect", "BLOCKS_PRODUCTION_ACTIVATION"),
            f"{activation_id}: G3/G6 separation is not fail-closed",
        )
        if expected.get("core_test_substitute"):
            require(
                row.get("core_test_substitute") == expected["core_test_substitute"],
                f"{activation_id}: fresh/disposable G3 substitute drift",
            )
        prep = by_prep.get(expected["prep_id"], {})
        require(bool(prep), f"{expected['prep_id']}: preparation row missing")
        require(
            prep.get("required_before") == "G6_PRODUCTION_ACTIVATION"
            and prep.get("category") == expected["prep_category"]
            and prep.get("status") == "NOT_AUTHORIZED_G6"
            and prep.get("blocking_scope") == expected["prep_scope"],
            f"{expected['prep_id']}: production preparation boundary drift",
        )
        require(activation_id in prep.get("exit_evidence", ""), f"{expected['prep_id']}: activation reference missing")
        for marker in expected.get("prep_item_markers", set()):
            require(marker in prep.get("item", ""), f"{expected['prep_id']}: preparation item missing {marker}")
        for marker in expected.get("exit_markers", set()):
            require(marker in prep.get("exit_evidence", ""), f"{expected['prep_id']}: exit evidence missing {marker}")
        require(
            {"ROLE.INTEGRATION_CONTROL", "ROLE.DBA_AUTHORITY", "ROLE.SECURITY_AUTHORITY", "ROLE.SRE_RELEASE"}
            == split_pipe(prep.get("owner", "")),
            f"{expected['prep_id']}: Control/DBA/Security/release accountability drift",
        )
    return sorted(set(errors))


def self_test(activation_rows: list[dict[str, str]], preparation_rows: list[dict[str, str]]) -> dict[str, Any]:
    cases: dict[str, bool] = {"canonical-g6-database-boundaries-valid": not validate_data(activation_rows, preparation_rows)}

    def rejected(name: str, mutate: Any) -> None:
        activations, preparations = copy.deepcopy(activation_rows), copy.deepcopy(preparation_rows)
        mutate(activations, preparations)
        cases[name] = bool(validate_data(activations, preparations))

    rejected("identity-adoption-row-missing-rejected", lambda a, p: a.__setitem__(slice(None), [row for row in a if row.get("activation_id") != "ACT-G6-DB-IDENTITY-ADOPTION"]))
    rejected("runtime-credential-removal-row-missing-rejected", lambda a, p: p.__setitem__(slice(None), [row for row in p if row.get("prep_id") != "G6-04"]))
    rejected("approval-legacy-role-activation-row-missing-rejected", lambda a, p: a.__setitem__(slice(None), [row for row in a if row.get("activation_id") != "ACT-G6-APPROVAL-LEGACY-ROLE-HARDENING"]))
    rejected("approval-legacy-role-preparation-row-missing-rejected", lambda a, p: p.__setitem__(slice(None), [row for row in p if row.get("prep_id") != "G6-05"]))
    rejected("named-binding-bypass-rejected", lambda a, p: next(row for row in a if row.get("activation_id") == "ACT-G6-DB-IDENTITY-ADOPTION").update({"named_binding_required": "NO"}))
    rejected("premature-production-open-rejected", lambda a, p: next(row for row in p if row.get("prep_id") == "G6-03").update({"status": "CLOSED"}))
    rejected("missing-restore-evidence-rejected", lambda a, p: next(row for row in a if row.get("activation_id") == "ACT-G6-DB-IDENTITY-ADOPTION").update({"required_real_evidence": "service-by-service database principal inventory|schema-history and ownership digest|Control-only credential cutover|strict process restart|rollback rehearsal|named DBA and Security signoff"}))
    rejected("runtime-migration-credential-co-residency-rejected", lambda a, p: next(row for row in a if row.get("activation_id") == "ACT-G6-RUNTIME-NO-MIGRATION-CREDENTIALS").update({"production_effect": "ALLOW_RUNTIME_MIGRATION_CREDENTIALS"}))
    rejected("wrong-accountable-role-rejected", lambda a, p: next(row for row in a if row.get("activation_id") == "ACT-G6-RUNTIME-NO-MIGRATION-CREDENTIALS").update({"owner_role": "ROLE.PROGRAM_OWNER"}))
    rejected("missing-security-owner-rejected", lambda a, p: next(row for row in p if row.get("prep_id") == "G6-04").update({"owner": "ROLE.INTEGRATION_CONTROL|ROLE.DBA_AUTHORITY|ROLE.SRE_RELEASE"}))
    rejected("approval-legacy-role-evidence-incomplete-rejected", lambda a, p: next(row for row in a if row.get("activation_id") == "ACT-G6-APPROVAL-LEGACY-ROLE-HARDENING").update({"required_real_evidence": "Approval database principal inventory|schema-history and ownership digest|backup restore point|strict process restart|rollback rehearsal|named DBA Security and SRE release approval"}))
    rejected("approval-legacy-role-scope-widened-rejected", lambda a, p: next(row for row in p if row.get("prep_id") == "G6-05").update({"blocking_scope": "ALL_G3_AND_G6_DATABASES"}))
    rejected("approval-legacy-role-production-bypass-rejected", lambda a, p: next(row for row in a if row.get("activation_id") == "ACT-G6-APPROVAL-LEGACY-ROLE-HARDENING").update({"production_effect": "DOES_NOT_BLOCK_PRODUCTION"}))
    rejected("approval-legacy-role-fresh-g3-block-rejected", lambda a, p: next(row for row in a if row.get("activation_id") == "ACT-G6-APPROVAL-LEGACY-ROLE-HARDENING").update({"core_code_effect": "BLOCKS_G3_CORE"}))
    rejected("approval-legacy-role-release-owner-missing-rejected", lambda a, p: next(row for row in p if row.get("prep_id") == "G6-05").update({"owner": "ROLE.INTEGRATION_CONTROL|ROLE.DBA_AUTHORITY|ROLE.SECURITY_AUTHORITY"}))
    return {
        "schema": "dwp.hris.g6-database-activation-boundaries-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        activations = read_csv(ACTIVATION, ACTIVATION_HEADER)
        preparations = read_csv(PREPARATION, PREPARATION_HEADER)
        if args.self_test:
            payload = self_test(activations, preparations)
        else:
            errors = validate_data(activations, preparations)
            payload = {
                "schema": "dwp.hris.g6-database-activation-boundaries.v1",
                "status": "PASS" if not errors else "FAIL",
                "activationBoundaryCount": len(EXPECTED),
                "productionState": "NOT_AUTHORIZED_G6",
                "errors": errors,
            }
    except (OSError, csv.Error, ValueError) as error:
        payload = {"schema": "dwp.hris.g6-database-activation-boundaries.v1", "status": "FAIL", "errors": [str(error)]}
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if payload.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
