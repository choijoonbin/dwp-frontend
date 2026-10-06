#!/usr/bin/env python3
"""Fail-closed validation for physical table owner/schema/prefix boundaries."""

from __future__ import annotations

import argparse
import csv
import json
import re
from copy import deepcopy
from pathlib import Path

HERE = Path(__file__).resolve().parent
BLUEPRINT = HERE.parent
REGISTER = HERE / "physical-owner-prefix-register.csv"
MODERN = HERE / "modern-capability-exact-schema-contracts.v1.json"
LISTENING_SUCCESSOR = HERE / "sys-listening-stream-authority-successor.v1.json"
PAY_CONSUMER = BLUEPRINT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json"

HEADER = [
    "binding_id", "session", "owner_service", "bounded_context", "database_schema",
    "allowed_prefixes", "table_source_scope", "forbidden_prefixes",
    "cross_boundary_rule", "status",
]
EXPECTED_BINDINGS = {
    "PFX-HRM-PEOPLE", "PFX-PER-PERFORMANCE", "PFX-TIM-TIME", "PFX-TIM-ABSENCE",
    "PFX-PAY-PAYROLL", "PFX-SYS-AUTH-CATALOG", "PFX-SYS-AUTH-TENANT",
    "PFX-SYS-PLATFORM", "PFX-SYS-INSIGHTS", "PFX-SYS-CONFIGURATION",
    "PFX-SYS-LISTEN-CONFIGURATION", "PFX-SYS-LISTEN-PROTECTED",
    "PFX-SYS-LISTEN-INSIGHTS", "PFX-SYS-LISTEN-ISSUER",
}
EXPECTED_SERVICES = {
    "dwp-people-server",
    "dwp-time-server",
    "dwp-payroll-server",
    "dwp-auth-server",
    "dwp-platform-server",
}
EXPECTED_DATABASE_SCHEMAS = {
    "PFX-HRM-PEOPLE": "public",
    "PFX-PER-PERFORMANCE": "hris_performance",
    "PFX-TIM-TIME": "public",
    "PFX-TIM-ABSENCE": "public",
    "PFX-PAY-PAYROLL": "public",
    "PFX-SYS-AUTH-CATALOG": "public",
    "PFX-SYS-AUTH-TENANT": "public",
    "PFX-SYS-PLATFORM": "public",
    "PFX-SYS-INSIGHTS": "hris_insights",
    "PFX-SYS-CONFIGURATION": "hris_configuration",
    "PFX-SYS-LISTEN-CONFIGURATION": "hris_configuration",
    "PFX-SYS-LISTEN-PROTECTED": "hris_listening_protected",
    "PFX-SYS-LISTEN-INSIGHTS": "hris_insights",
    "PFX-SYS-LISTEN-ISSUER": "hris_participation_issuer",
}
BASE_DDLS = {
    "BASE_HRM": BLUEPRINT / "session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql",
    "BASE_PER": BLUEPRINT / "session-evidence/per/g2-readiness/physical-schema.sql",
    "BASE_TIM": BLUEPRINT / "session-evidence/tim/g2-physical-schema.sql",
    "BASE_PAY": BLUEPRINT / "session-evidence/pay/g2-physical-schema.sql",
    "BASE_SYS": BLUEPRINT / "session-evidence/sys/g2-physical-schema.sql",
}
EXPECTED_PAY_CONSUMER_TABLES = {
    "pay_compensation_plan_inputs",
    "pay_input_snapshot_compensation_refs",
}
EXPECTED_COUNTS = {
    "base": 163,
    "producer_modern": 91,
    "authoritative": 254,
    "consumer_materialization": 2,
    "deployment": 256,
}


def pipe(text: str) -> set[str]:
    return {value for value in text.split("|") if value}


def table_names(path: Path) -> list[str]:
    return re.findall(r"CREATE\s+TABLE\s+(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*\(", path.read_text(encoding="utf-8"), re.I)


def read_rows() -> tuple[list[str], list[dict[str, str]]]:
    with REGISTER.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def actual_tables() -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    result["BASE_HRM"] = table_names(BASE_DDLS["BASE_HRM"])
    result["BASE_PER"] = table_names(BASE_DDLS["BASE_PER"])
    tim = table_names(BASE_DDLS["BASE_TIM"])
    result["BASE_TIM_TME"] = [name for name in tim if name.startswith("tme_")]
    result["BASE_TIM_ABS"] = [name for name in tim if name.startswith("abs_")]
    result["BASE_PAY"] = table_names(BASE_DDLS["BASE_PAY"])
    sys_tables = table_names(BASE_DDLS["BASE_SYS"])
    result["BASE_SYS_AUTH_CATALOG"] = [name for name in sys_tables if name.startswith("sys_product_access_")]
    result["BASE_SYS_AUTH_TENANT"] = [name for name in sys_tables if name.startswith("com_product_access_")]
    result["BASE_SYS_PLATFORM"] = [
        name for name in sys_tables
        if not name.startswith("sys_product_access_") and not name.startswith("com_product_access_")
    ]

    modern = json.loads(MODERN.read_text(encoding="utf-8"))
    for table in modern.get("tableSpecifications", []):
        session = table.get("session", "").removeprefix("HRIS-")
        capability = table.get("capabilityId")
        if session in {"HRM", "PER", "TIM", "PAY"}:
            scope = f"MODERN_{session}"
        elif capability == "HRIS.MODERN.EMPLOYEE_LISTENING":
            # Predecessor trace only.  The active 4-stream table set is loaded
            # from the canonical successor below.
            continue
        elif capability == "HRIS.MODERN.PEOPLE_ANALYTICS":
            scope = "MODERN_SYS_ANALYTICS"
        elif capability == "HRIS.MODERN.GOVERNED_AI":
            scope = "MODERN_SYS_AI"
        else:
            raise ValueError(f"unmapped modern table capability: {capability}")
        result.setdefault(scope, []).append(table["tableName"])

    listening = json.loads(LISTENING_SUCCESSOR.read_text(encoding="utf-8"))
    if (
        listening.get("contractId")
        != "dwp.hris.sys.listening.stream-authority-successor.v1"
        or listening.get("status") != "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED"
    ):
        raise ValueError("SYS listening successor authority is not canonical")
    scope_by_stream = {
        "platform-hris-configuration": "SUCCESSOR_SYS_LISTEN_CONFIGURATION",
        "platform-hris-listening-protected": "SUCCESSOR_SYS_LISTEN_PROTECTED",
        "platform-hris-insights": "SUCCESSOR_SYS_LISTEN_INSIGHTS",
        "auth-hris-participation-issuer": "SUCCESSOR_SYS_LISTEN_ISSUER",
    }
    for table in listening.get("tableOwnership", []):
        stream_key = table.get("streamKey")
        if stream_key not in scope_by_stream:
            raise ValueError(f"unmapped listening successor stream: {stream_key}")
        result.setdefault(scope_by_stream[stream_key], []).append(table["tableName"])

    pay_consumer = json.loads(PAY_CONSUMER.read_text(encoding="utf-8"))
    consumer_tables = [
        table.get("name", "")
        for capability in pay_consumer.get("consumedModernCapabilities", [])
        for table in capability.get("tables", [])
    ]
    if set(consumer_tables) != EXPECTED_PAY_CONSUMER_TABLES or len(consumer_tables) != len(set(consumer_tables)):
        raise ValueError(
            "PAY modern consumer materialization table set is not exact: "
            f"{sorted(consumer_tables)}"
        )
    result["MODERN_PAY_CONSUMER"] = consumer_tables
    return result


def validate(rows: list[dict[str, str]], tables: dict[str, list[str]]) -> list[str]:
    errors: list[str] = []
    ids = [row.get("binding_id", "") for row in rows]
    if set(ids) != EXPECTED_BINDINGS or len(ids) != len(set(ids)):
        errors.append("physical prefix binding set is not exact")
    scope_owner: dict[str, str] = {}
    table_owner: dict[str, str] = {}
    for row in rows:
        if row.get("status") != "READY_FOR_G3_CODE":
            errors.append(f"{row.get('binding_id')}: status not ready")
        if row.get("owner_service", "") not in EXPECTED_SERVICES:
            errors.append(f"{row.get('binding_id')}: owner service is not an existing DWP runtime")
        binding_id = row.get("binding_id", "")
        if (
            row.get("database_schema") != EXPECTED_DATABASE_SCHEMAS.get(binding_id)
            or not row.get("bounded_context")
        ):
            errors.append(
                f"{binding_id}: service-local database schema/context drift "
                f"expected={EXPECTED_DATABASE_SCHEMAS.get(binding_id)}"
            )
        allowed = pipe(row.get("allowed_prefixes", ""))
        forbidden = pipe(row.get("forbidden_prefixes", ""))
        if not allowed or allowed & forbidden:
            errors.append(f"{row.get('binding_id')}: invalid allowed/forbidden prefix set")
        if "PORT" not in row.get("cross_boundary_rule", ""):
            errors.append(f"{row.get('binding_id')}: cross-boundary port rule missing")
        for scope in pipe(row.get("table_source_scope", "")):
            prior = scope_owner.setdefault(scope, row.get("binding_id", ""))
            if prior != row.get("binding_id"):
                errors.append(f"{scope}: assigned to multiple physical owners")
            names = tables.get(scope)
            if not names:
                errors.append(f"{scope}: no physical tables discovered")
                continue
            for name in names:
                prior_table_scope = table_owner.setdefault(name, scope)
                if prior_table_scope != scope:
                    errors.append(
                        f"{name}: duplicated across physical source scopes "
                        f"{prior_table_scope} and {scope}"
                    )
                if not any(name.startswith(prefix) for prefix in allowed):
                    errors.append(f"{scope}/{name}: outside canonical owner prefix {sorted(allowed)}")
                if any(name.startswith(prefix) for prefix in forbidden):
                    errors.append(f"{scope}/{name}: uses forbidden foreign-owner prefix")
    if set(scope_owner) != set(tables):
        errors.append(f"table source scope closure mismatch expected={sorted(tables)} actual={sorted(scope_owner)}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    header, rows = read_rows()
    errors = [] if header == HEADER else ["register header mismatch"]
    try:
        tables = actual_tables()
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
        tables = {}
        errors.append(f"physical table source discovery failed: {error}")
    errors.extend(validate(rows, tables))
    self_tests = 0
    if args.self_test and not errors:
        mutations = []
        bad_prefix = deepcopy(rows)
        bad_prefix[0]["allowed_prefixes"] = "wrong_"
        mutations.append(bad_prefix)
        duplicate_scope = deepcopy(rows)
        duplicate_scope[1]["table_source_scope"] += "|BASE_HRM"
        mutations.append(duplicate_scope)
        fake_owner = deepcopy(rows)
        fake_owner[0]["owner_service"] = "dwp-sys-server"
        mutations.append(fake_owner)
        wrong_database_schema = deepcopy(rows)
        wrong_database_schema[0]["database_schema"] = "people"
        mutations.append(wrong_database_schema)
        wrong_sys_database_schema = deepcopy(rows)
        next(
            row for row in wrong_sys_database_schema
            if row["binding_id"] == "PFX-SYS-AUTH-CATALOG"
        )["database_schema"] = "auth"
        mutations.append(wrong_sys_database_schema)
        missing_consumer_scope = deepcopy(rows)
        for row in missing_consumer_scope:
            if row.get("binding_id") == "PFX-PAY-PAYROLL":
                row["table_source_scope"] = "BASE_PAY"
        mutations.append(missing_consumer_scope)
        missing = deepcopy(rows[:-1])
        mutations.append(missing)
        for index, mutated in enumerate(mutations, 1):
            self_tests += 1
            if not validate(mutated, tables):
                errors.append(f"self-test mutation {index} was not rejected")
    base_table_count = sum(
        len(names) for scope, names in tables.items() if scope.startswith("BASE_")
    )
    producer_modern_table_count = sum(
        len(names)
        for scope, names in tables.items()
        if (scope.startswith("MODERN_") and scope != "MODERN_PAY_CONSUMER")
        or scope.startswith("SUCCESSOR_SYS_LISTEN_")
    )
    consumer_materialization_table_count = len(
        tables.get("MODERN_PAY_CONSUMER", [])
    )
    authoritative_table_count = base_table_count + producer_modern_table_count
    deployment_physical_object_count = (
        authoritative_table_count + consumer_materialization_table_count
    )
    observed_counts = {
        "base": base_table_count,
        "producer_modern": producer_modern_table_count,
        "authoritative": authoritative_table_count,
        "consumer_materialization": consumer_materialization_table_count,
        "deployment": deployment_physical_object_count,
    }
    if observed_counts != EXPECTED_COUNTS:
        errors.append(
            "physical table category counts drifted "
            f"expected={EXPECTED_COUNTS} actual={observed_counts}"
        )
    payload = {
        "status": "PASS" if not errors else "FAIL",
        "bindings": len(rows),
        "sourceScopes": len(tables),
        "baseTables": base_table_count,
        "producerModernTables": producer_modern_table_count,
        "authoritativeTables": authoritative_table_count,
        "consumerMaterializationTables": consumer_materialization_table_count,
        "deploymentPhysicalObjects": deployment_physical_object_count,
        "tables": deployment_physical_object_count,
        "selfTests": self_tests,
        "errors": errors,
    }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True) if args.compact else json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    import pathlib as _guard_pathlib
    import sys as _guard_sys

    _guard_dir = _guard_pathlib.Path(__file__).resolve().parent
    while not (_guard_dir / "modern_successor_reader_guard.py").is_file():
        if _guard_dir.parent == _guard_dir:
            raise SystemExit("modern successor reader guard is unavailable")
        _guard_dir = _guard_dir.parent
    _guard_sys.path.insert(0, str(_guard_dir))
    from modern_successor_reader_guard import guarded_main as _guarded_main

    raise SystemExit(_guarded_main(__file__, main))
