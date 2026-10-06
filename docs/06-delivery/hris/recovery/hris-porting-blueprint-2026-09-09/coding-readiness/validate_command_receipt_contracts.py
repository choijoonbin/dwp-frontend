#!/usr/bin/env python3
"""Validate durable caller-bound command receipts across all five HRIS modules."""

from __future__ import annotations

import argparse
import copy
import csv
import json
import re
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SEALED_JSON_FIELDS = {
    "receiptId", "commandType", "originatingAction", "subjectPrincipalPublicId",
    "populationScopeDigest", "fieldPolicyRevision", "purposeCode",
    "authorizationRevision", "status", "correlationId", "requestDigest", "createdAt",
}
AUTH_JSON_FIELDS = {
    "originatingAction", "subjectPrincipalPublicId", "populationScopeDigest",
    "fieldPolicyRevision", "purposeCode", "authorizationRevision",
}
SEALED_AUTH_SQL_COLUMNS = {
    "originating_action", "subject_principal_public_id", "population_scope_digest",
    "field_policy_revision", "purpose_code", "authorization_revision",
    "idempotency_key",
}
SQL_SPECS = {
    "HRM": (ROOT / "session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql", "ppl_command_receipts", "request_hash", True),
    "PER": (ROOT / "session-evidence/per/g2-readiness/physical-schema.sql", "prf_command_receipts", "request_hash", False),
    "TIM": (ROOT / "session-evidence/tim/g2-physical-schema.sql", "tme_command_receipts", "request_digest", True),
    "PAY": (ROOT / "session-evidence/pay/g2-physical-schema.sql", "pay_command_receipts", "request_digest", True),
    "SYS_AUTH": (ROOT / "session-evidence/sys/g2-auth-physical-schema.sql", "com_product_access_command_receipts", "request_digest", True),
    "SYS_PLATFORM": (ROOT / "session-evidence/sys/g2-platform-physical-schema.sql", "sys_hris_command_receipts", "request_digest", True),
}


def table_body(sql: str, table: str) -> str:
    match = re.search(rf"CREATE\s+TABLE\s+{re.escape(table)}\s*\((.*?)\n\);", sql, re.I | re.S)
    return match.group(1) if match else ""


def rls_tables(sql: str) -> set[str]:
    values: set[str] = set()
    for block in re.findall(r"FOREACH\s+[a-zA-Z_][a-zA-Z0-9_]*\s+IN\s+ARRAY\s+ARRAY\[(.*?)\]\s+LOOP", sql, re.I | re.S):
        values.update(re.findall(r"'([a-zA-Z_][a-zA-Z0-9_]*)'", block))
    return values


def validate_sql_contract(owner: str, sql: str, table: str, request_column: str, require_correlation: bool) -> list[str]:
    errors: list[str] = []
    body = table_body(sql, table)
    if not body:
        return [f"{owner}: missing {table}"]
    lower = body.lower()
    required_columns = SEALED_AUTH_SQL_COLUMNS | {request_column}
    if require_correlation:
        required_columns.add("correlation_id")
    for column in required_columns:
        if not re.search(rf"\b{column}\b[^,\n]*\bNOT\s+NULL\b", body, re.I):
            errors.append(f"{owner}: {table} missing non-null {column}")
    if not re.search(
        r"UNIQUE\s*\(\s*tenant_id\s*,\s*subject_principal_public_id\s*,\s*originating_action\s*,\s*idempotency_key\s*\)",
        body,
        re.I,
    ):
        errors.append(f"{owner}: caller/action-bound idempotency key drift")
    if not re.search(r"population_scope_digest[^,\n]*CHAR\s*\(\s*64\s*\)", lower, re.I):
        errors.append(f"{owner}: population digest width drift")
    if not re.search(rf"{request_column}[^,\n]*CHAR\s*\(\s*64\s*\)", lower, re.I):
        errors.append(f"{owner}: request hash/digest width drift")
    guard = re.search(
        rf"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([a-zA-Z0-9_]*command_receipt[a-zA-Z0-9_]*)\s*\(\).*?\$\$\s*;",
        sql,
        re.I | re.S,
    )
    if not guard:
        errors.append(f"{owner}: immutable receipt guard missing")
    else:
        guard_text = guard.group(0).lower()
        for column in required_columns | {"tenant_id", "command_type"}:
            if f"new.{column}" not in guard_text or f"old.{column}" not in guard_text:
                errors.append(f"{owner}: guard does not seal {column}")
        if "tg_op = 'delete'" not in guard_text:
            errors.append(f"{owner}: receipt delete is not rejected")
    if not re.search(rf"BEFORE\s+UPDATE\s+OR\s+DELETE\s+ON\s+{re.escape(table)}", sql, re.I):
        errors.append(f"{owner}: update/delete trigger drift")
    if table not in rls_tables(sql):
        errors.append(f"{owner}: receipt table absent from RLS closure")
    return errors


def validate_receipt_schema(owner: str, schema: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if schema.get("type") != "object" or schema.get("additionalProperties") is not False:
        errors.append(f"{owner}: receipt schema is not closed")
    if set(schema.get("required", [])) != SEALED_JSON_FIELDS:
        errors.append(f"{owner}: receipt required fields drift")
    properties = schema.get("properties", {})
    if properties.get("status", {}).get("enum") != ["ACCEPTED", "RUNNING", "SUCCEEDED", "REJECTED", "FAILED", "RESULT_UNKNOWN"]:
        errors.append(f"{owner}: receipt status set drift")
    for revision in ("fieldPolicyRevision", "authorizationRevision"):
        if properties.get(revision, {}).get("minimum") != 1:
            errors.append(f"{owner}: {revision} is not positive")
    return errors


def validate_tim_pay(module: str, api: dict[str, Any], transport: dict[str, Any], golden: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    receipt = api.get("receipt", {})
    if set(receipt.get("required", [])) != SEALED_JSON_FIELDS:
        errors.append(f"{module}: API receipt sealed field drift")
    if receipt.get("idempotencyScope") != ["trustedTenantContext", "subjectPrincipalPublicId", "originatingAction", "Idempotency-Key"]:
        errors.append(f"{module}: idempotency is not caller/action bound")
    rule = receipt.get("idempotencyRule", "")
    if "different digest returns 409" not in rule or "another subject is an independent scope" not in rule:
        errors.append(f"{module}: replay rule drift")
    if receipt.get("sealedFieldsImmutable") is not True or receipt.get("opaqueNotFoundOnRevocationOrContextMismatch") is not True:
        errors.append(f"{module}: immutable/opaque lookup policy drift")
    errors.extend(validate_receipt_schema(module, transport.get("$defs", {}).get("Receipt", {})))
    query = transport.get("operations", {}).get("command.receipt.query", {})
    if query.get("authorizationContext") != "SEALED_ORIGINATING_COMMAND_CONTEXT" or query.get("authorizationRule") != "MORE_RESTRICTIVE_OF_CURRENT_AND_ORIGINATING" or query.get("opaqueNotFoundOnContextMismatch") is not True:
        errors.append(f"{module}: receipt query reauthorization drift")
    refs = set(transport.get("negativeTestRefs", []))
    if not {"receipt-caller-bound-idempotency", "receipt-sealed-authorization-context"} <= refs:
        errors.append(f"{module}: required receipt negatives missing")
    golden_id = "TIM-GOLD-013" if module == "TIM" else "PAY-GOLD-015"
    case = next((row for row in golden.get("cases", []) if row.get("id") == golden_id), {})
    expected = case.get("expected", {})
    if expected.get("sameSubjectSameDigest") != "ORIGINAL_RECEIPT" or expected.get("sameSubjectDifferentDigest") != "409_IDEMPOTENCY_KEY_REUSED":
        errors.append(f"{module}: same-caller replay golden drift")
    if expected.get("differentSubjectSameKey") != "INDEPENDENT_RECEIPT" or expected.get("sealedFieldUpdate") != "REJECTED" or expected.get("receiptDelete") != "REJECTED":
        errors.append(f"{module}: caller/seal golden drift")
    return errors


def validate_hrm(api: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    receipt = api.get("receipt", {})
    if not AUTH_JSON_FIELDS <= set(receipt.get("required", [])):
        errors.append("HRM: receipt originating authorization fields drift")
    if receipt.get("authorizationContext") != "SEALED_ORIGINATING_COMMAND_CONTEXT" or receipt.get("authorizationRule") != "MORE_RESTRICTIVE_OF_CURRENT_AND_ORIGINATING" or receipt.get("opaqueNotFoundOnContextMismatch") is not True:
        errors.append("HRM: receipt policy is not sealed/fail-closed")
    if "original receipt" not in receipt.get("replay", "") or "returns 409" not in receipt.get("mismatch", ""):
        errors.append("HRM: receipt replay/mismatch rule drift")
    query = next((row for row in api.get("endpoints", []) if row.get("operationId") == "getCommandReceipt"), {})
    if query.get("method") != "GET" or query.get("path") != "/command-receipts/{receiptId}":
        errors.append("HRM: receipt query route drift")
    if query.get("authorizationContext") != "SEALED_ORIGINATING_COMMAND_CONTEXT" or query.get("authorizationRule") != "MORE_RESTRICTIVE_OF_CURRENT_AND_ORIGINATING" or query.get("opaqueNotFoundOnContextMismatch") is not True:
        errors.append("HRM: receipt query reauthorization drift")
    rules = " ".join(query.get("rules", [])).lower()
    if "current app entitlement" not in rules or "opaque 404" not in rules or "more restrictive" not in rules:
        errors.append("HRM: receipt query negative disclosure rule drift")
    return errors


def validate_per(api_yaml: str) -> list[str]:
    errors: list[str] = []
    receipt_match = re.search(
        r"^    CommandReceipt:\n(?P<body>.*?)(?=^    [A-Za-z][A-Za-z0-9]+:\n|\Z)",
        api_yaml,
        re.M | re.S,
    )
    receipt_body = receipt_match.group("body") if receipt_match else ""
    if not receipt_body or "additionalProperties: false" not in receipt_body:
        errors.append("PER: closed CommandReceipt schema missing")
    required_match = re.search(r"required:\s*\[([^\]]+)\]", receipt_body)
    required = {value.strip() for value in required_match.group(1).split(",")} if required_match else set()
    if not AUTH_JSON_FIELDS <= required:
        errors.append("PER: receipt originating authorization fields drift")
    query_match = re.search(
        r"^  /command-receipts/\{receiptId\}:\n(?P<body>.*?)(?=^  /|^components:|\Z)",
        api_yaml,
        re.M | re.S,
    )
    query = query_match.group("body") if query_match else ""
    for marker in (
        "operationId: getCommandReceipt",
        "x-dwp-authorization-context: SEALED_ORIGINATING_COMMAND_CONTEXT",
        "x-dwp-authorization-rule: MORE_RESTRICTIVE_OF_CURRENT_AND_ORIGINATING",
        "x-dwp-opaque-not-found-on-context-mismatch: true",
        "schema: {$ref: '#/components/schemas/CommandReceipt'}",
    ):
        if marker not in query:
            errors.append(f"PER: receipt query missing {marker}")
    return errors


def validate_sys(transport: dict[str, Any], golden_rows: list[dict[str, str]], catalog_rows: list[dict[str, str]]) -> list[str]:
    errors = validate_receipt_schema("SYS", transport.get("$defs", {}).get("Receipt", {}))
    operations = transport.get("operations", {})
    for operation_id in ("SYS-API-037", "SYS-API-038"):
        operation = operations.get(operation_id, {})
        if operation.get("authorizationContext") != "SEALED_ORIGINATING_COMMAND_CONTEXT" or operation.get("authorizationRule") != "MORE_RESTRICTIVE_OF_CURRENT_AND_ORIGINATING" or operation.get("opaqueNotFoundOnContextMismatch") is not True:
            errors.append(f"SYS: {operation_id} reauthorization drift")
    if not {"receipt-caller-bound-idempotency", "receipt-sealed-authorization-context"} <= set(transport.get("negativeTestRefs", [])):
        errors.append("SYS: required receipt negatives missing")
    catalog = {row.get("contract_id"): row for row in catalog_rows}
    for operation_id in ("SYS-API-037", "SYS-API-038"):
        row = catalog.get(operation_id, {})
        if row.get("operation_or_version") != "GET" or row.get("idempotency") != "N_A" or row.get("state_or_payload") != "SEALED_ORIGINATING_COMMAND_CONTEXT_RECEIPT":
            errors.append(f"SYS: {operation_id} catalog receipt drift")
    golden = {row.get("scenario_id"): row for row in golden_rows}
    auth_case = golden.get("SYS-GOLD-040", {})
    if "sealed originating" not in auth_case.get("expected_result", "").lower() or "opaque 404" not in auth_case.get("negative_or_recovery", "").lower():
        errors.append("SYS: receipt reauthorization golden drift")
    replay_case = golden.get("SYS-GOLD-045", {})
    if "original receipt" not in replay_case.get("expected_result", "").lower() or "independent receipt" not in replay_case.get("expected_result", "").lower():
        errors.append("SYS: caller-bound replay golden drift")
    if "different digest" not in replay_case.get("negative_or_recovery", "").lower() or "immutable" not in replay_case.get("negative_or_recovery", "").lower():
        errors.append("SYS: immutable/replay failure golden drift")
    return errors


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def validate_all() -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    inputs: dict[str, Any] = {}
    for owner, (path, table, request_column, require_correlation) in SQL_SPECS.items():
        sql = path.read_text(encoding="utf-8")
        inputs[f"sql:{owner}"] = sql
        errors.extend(validate_sql_contract(owner, sql, table, request_column, require_correlation))
    hrm_api = load_json(ROOT / "session-evidence/hrm/g2-readiness/api-event-contracts.v1.json")
    per_api_yaml = (ROOT / "session-evidence/per/g2-readiness/api-event-contracts.yaml").read_text(encoding="utf-8")
    inputs.update({"api:HRM": hrm_api, "api:PER": per_api_yaml})
    errors.extend(validate_hrm(hrm_api))
    errors.extend(validate_per(per_api_yaml))
    for module, slug in (("TIM", "tim"), ("PAY", "pay")):
        folder = ROOT / "session-evidence" / slug
        api = load_json(folder / "g2-api-event-contracts.json")
        transport = load_json(folder / "g2-transport-schemas.v1.json")
        golden = load_json(folder / "synthetic-golden-fixtures.json")
        inputs[f"api:{module}"] = api
        inputs[f"transport:{module}"] = transport
        inputs[f"golden:{module}"] = golden
        errors.extend(validate_tim_pay(module, api, transport, golden))
    sys_folder = ROOT / "session-evidence" / "sys"
    sys_transport = load_json(sys_folder / "g2-transport-schemas.v1.json")
    sys_golden = load_csv(sys_folder / "g2-golden-scenarios.csv")
    sys_catalog = load_csv(sys_folder / "g2-contract-catalog.csv")
    inputs.update({"transport:SYS": sys_transport, "golden:SYS": sys_golden, "catalog:SYS": sys_catalog})
    errors.extend(validate_sys(sys_transport, sys_golden, sys_catalog))
    return errors, inputs


def run_self_test(inputs: dict[str, Any]) -> tuple[int, int]:
    mutations: list[list[str]] = []
    hrm_sql = inputs["sql:HRM"]
    mutations.append(validate_sql_contract(
        "HRM",
        hrm_sql.replace(
            "tenant_id, subject_principal_public_id, originating_action, idempotency_key",
            "tenant_id, originating_action, idempotency_key",
            1,
        ),
        "ppl_command_receipts",
        "request_hash",
        True,
    ))
    per_sql = inputs["sql:PER"]
    mutations.append(validate_sql_contract(
        "PER",
        per_sql.replace(
            "BEFORE UPDATE OR DELETE ON prf_command_receipts",
            "BEFORE UPDATE ON prf_command_receipts",
            1,
        ),
        "prf_command_receipts",
        "request_hash",
        False,
    ))
    tim_sql = inputs["sql:TIM"]
    mutations.append(validate_sql_contract("TIM", tim_sql.replace("subject_principal_public_id, originating_action, idempotency_key", "originating_action, idempotency_key", 1), "tme_command_receipts", "request_digest", True))
    mutations.append(validate_sql_contract("TIM", tim_sql.replace("BEFORE UPDATE OR DELETE ON tme_command_receipts", "BEFORE UPDATE ON tme_command_receipts", 1), "tme_command_receipts", "request_digest", True))
    pay_sql = inputs["sql:PAY"]
    mutations.append(validate_sql_contract("PAY", pay_sql.replace("NEW.authorization_revision, NEW.idempotency_key", "OLD.authorization_revision, NEW.idempotency_key", 1), "pay_command_receipts", "request_digest", True))
    tim_api = copy.deepcopy(inputs["api:TIM"]); tim_api["receipt"]["idempotencyScope"].remove("subjectPrincipalPublicId"); mutations.append(validate_tim_pay("TIM", tim_api, inputs["transport:TIM"], inputs["golden:TIM"]))
    pay_transport = copy.deepcopy(inputs["transport:PAY"]); pay_transport["operations"]["command.receipt.query"]["authorizationRule"] = "CURRENT_ONLY"; mutations.append(validate_tim_pay("PAY", inputs["api:PAY"], pay_transport, inputs["golden:PAY"]))
    tim_golden = copy.deepcopy(inputs["golden:TIM"]); next(row for row in tim_golden["cases"] if row["id"] == "TIM-GOLD-013")["expected"]["differentSubjectSameKey"] = "COLLISION"; mutations.append(validate_tim_pay("TIM", inputs["api:TIM"], inputs["transport:TIM"], tim_golden))
    sys_transport = copy.deepcopy(inputs["transport:SYS"]); sys_transport["$defs"]["Receipt"]["required"].remove("authorizationRevision"); mutations.append(validate_sys(sys_transport, inputs["golden:SYS"], inputs["catalog:SYS"]))
    sys_golden = copy.deepcopy(inputs["golden:SYS"]); next(row for row in sys_golden if row["scenario_id"] == "SYS-GOLD-045")["expected_result"] = "same receipt"; mutations.append(validate_sys(inputs["transport:SYS"], sys_golden, inputs["catalog:SYS"]))
    caught = sum(bool(errors) for errors in mutations)
    return caught, len(mutations)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    errors, inputs = validate_all()
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        print(f"COMMAND_RECEIPT_CONTRACTS=FAIL modules=5 owners=6 errors={len(errors)}")
        return 1
    if args.self_test:
        caught, total = run_self_test(inputs)
        if caught != total:
            print(f"ERROR: mutation suite caught {caught}/{total}")
            print(f"COMMAND_RECEIPT_CONTRACTS_SELF_TEST=FAIL mutations={total}")
            return 1
        print(f"COMMAND_RECEIPT_CONTRACTS_SELF_TEST=PASS mutations={total}")
        return 0
    print("COMMAND_RECEIPT_CONTRACTS=PASS modules=5 owners=6 receiptQueries=6 sealedAuthorizationFields=6")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
