#!/usr/bin/env python3
"""Fail-closed validation for the 21 canonical HRIS cross-module contracts."""

from __future__ import annotations

import argparse
import copy
import csv
import datetime as dt
import hashlib
import json
import pathlib
import re
import subprocess
from collections import Counter
from typing import Any, Dict, List, Mapping, Optional, Tuple


HERE = pathlib.Path(__file__).resolve().parent
BLUEPRINT = HERE.parent
SOURCE_REGISTER = HERE / "cross-module-contract-register.csv"
BINDING_REGISTER = HERE / "cross-module-schema-binding-register.csv"
SCHEMA_DOCUMENT = HERE / "cross-module-canonical-schemas.v1.json"
ALLOCATION_REGISTER = HERE / "g3-file-allocation-register.csv"
DECIMAL_DOCUMENT = HERE / "decimal-value-types.v1.json"

EXPECTED_COUNT = 21
EXPECTED_IMPLEMENTATION = "NOT_STARTED_G3"
EXPECTED_PRODUCTION = "NOT_AUTHORIZED_G6"
EXPECTED_SCHEMA_URI = "https://json-schema.org/draft/2020-12/schema"
EXPECTED_KINDS = {"SNAPSHOT": 8, "EVENT": 13}
EXPECTED_PRODUCERS = {"HRIS-HRM": 12, "HRIS-PER": 3, "HRIS-TIM": 5, "HRIS-PAY": 1}
DECIMAL_DOCUMENT_SHA256 = "8597640fa5cf5051cccc14fe4b83a4f179d54dfe36f0ffdaa319dc1149b5c6a6"
ALLOWED_TYPES = {"object", "array", "string", "integer", "number", "boolean", "null"}
ALLOWED_FORMATS = {"uuid", "date", "date-time"}
TEST_ROOTS = {
    "HRIS-HRM": "dwp-people-server/src/test/java/com/dwp/services/people/hris/",
    "HRIS-PER": "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/",
    "HRIS-TIM": "dwp-time-server/src/test/java/com/dwp/services/time/",
    "HRIS-PAY": "dwp-payroll-server/src/test/java/com/dwp/services/payroll/",
    "HRIS-SYS": "dwp-platform-server/src/test/java/com/dwp/services/platform/hrisconfiguration/",
}
COMPENSATION_EVENT_V2 = "ApprovedCompensationPlanSnapshotPublished.v2"
COMPENSATION_EVENT_PREDECESSOR = "CompensationPlanApproved.v1"
COMPENSATION_EVENT_V2_FIELDS = {
    "aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt",
    "correlationId", "planId", "cycleId", "approvalRevision",
    "approvalReceiptId", "effectiveDate", "snapshotId", "lineCount",
    "snapshotRevision", "sourceVersion", "payloadDigest",
}
COMPENSATION_EVENT_V2_IMPORT = (
    "com.dwp.contracts.hris.xcon.v1."
    "Xcon021ApprovedCompensationPlanSnapshotPublishedV2"
)
COMPENSATION_EVENT_V2_PROVIDER_TEST = (
    "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/"
    "contracts/xcon/Xcon021ApprovedCompensationPlanSnapshotPublishedV2ProviderContractTest.java"
)
COMPENSATION_EVENT_V2_CONSUMER_TEST = (
    "dwp-payroll-server/src/test/java/com/dwp/services/payroll/integration/xcon/"
    "Xcon021ApprovedCompensationPlanSnapshotPublishedV2ConsumerContractTest.java"
)
_CACHE: Dict[pathlib.Path, Any] = {}


class ContractFailure(Exception):
    pass


def read_csv(path: pathlib.Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def load_yaml(path: pathlib.Path) -> Any:
    try:
        import yaml  # type: ignore
        with path.open(encoding="utf-8") as fh:
            return yaml.safe_load(fh)
    except ImportError:
        proc = subprocess.run(
            ["ruby", "-ryaml", "-rjson", "-e", "puts JSON.generate(YAML.load_file(ARGV[0]))", str(path)],
            check=False,
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise ContractFailure(f"cannot parse YAML {path}: {proc.stderr.strip()}")
        return json.loads(proc.stdout)


def load_document(path: pathlib.Path) -> Any:
    path = path.resolve()
    if path in _CACHE:
        return _CACHE[path]
    if path.suffix.lower() == ".json":
        value = json.loads(path.read_text(encoding="utf-8"))
    elif path.suffix.lower() in {".yaml", ".yml"}:
        value = load_yaml(path)
    elif path.suffix.lower() == ".csv":
        value = read_csv(path)
    else:
        raise ContractFailure(f"unsupported evidence document: {path}")
    _CACHE[path] = value
    return value


def canonical_digest(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def file_digest(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pointer_get(document: Any, fragment: str) -> Any:
    if fragment in {"", "#"}:
        return document
    if not fragment.startswith("#/"):
        raise ContractFailure(f"not a JSON pointer: {fragment}")
    node = document
    for raw in fragment[2:].split("/"):
        token = raw.replace("~1", "/").replace("~0", "~")
        try:
            node = node[int(token)] if isinstance(node, list) else node[token]
        except (KeyError, IndexError, TypeError, ValueError):
            raise ContractFailure(f"unknown pointer {fragment} at {token}")
    return node


def resolve_evidence_ref(ref: str) -> Any:
    if ref == "NONE":
        return None
    file_part, marker, fragment = ref.partition("#")
    path = (HERE / file_part).resolve()
    if not path.is_file():
        raise ContractFailure(f"evidence file missing: {ref}")
    document = load_document(path)
    if path.suffix.lower() == ".csv" and marker and fragment.startswith("contract_id="):
        wanted = fragment.split("=", 1)[1]
        matches = [row for row in document if row.get("contract_id") == wanted]
        if len(matches) != 1:
            raise ContractFailure(f"CSV selector must resolve once: {ref} ({len(matches)})")
        return matches[0]
    return pointer_get(document, "#" + fragment if marker else "")


def schema_pointer(document: Dict[str, Any], pointer: str) -> Any:
    return pointer_get(document, pointer)


def materialize(schema: Any, document: Dict[str, Any], seen: Optional[Tuple[str, ...]] = None) -> Any:
    seen = seen or ()
    if isinstance(schema, dict) and set(schema) == {"$ref"}:
        ref = schema["$ref"]
        if not ref.startswith("#/$defs/"):
            raise ContractFailure(f"external or non-canonical schema ref: {ref}")
        key = ref.rsplit("/", 1)[1]
        if key in seen:
            return {"$recursiveRef": ref}
        try:
            target = document["$defs"][key]
        except KeyError:
            raise ContractFailure(f"unknown schema ref: {ref}")
        return materialize(target, document, seen + (key,))
    if isinstance(schema, dict):
        return {key: materialize(value, document, seen) for key, value in sorted(schema.items())}
    if isinstance(schema, list):
        return [materialize(value, document, seen) for value in schema]
    return schema


def parse_session_map(value: str, where: str) -> Dict[str, str]:
    if value == "NONE":
        return {}
    result: Dict[str, str] = {}
    for item in value.split(";"):
        if ":" not in item:
            raise ContractFailure(f"{where}: mapping item lacks session prefix: {item}")
        session, mapped = item.split(":", 1)
        if not session or not mapped or session in result:
            raise ContractFailure(f"{where}: invalid or duplicate session mapping: {item}")
        result[session] = mapped
    return result


def evidence_fields(value: Any) -> List[str]:
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return value
    if isinstance(value, dict) and isinstance(value.get("state_or_payload"), str):
        return value["state_or_payload"].split("|")
    raise ContractFailure("evidence reference does not resolve to an exact field list")


def validate_schema_shape(schema: Any, where: str, errors: List[str]) -> None:
    if not isinstance(schema, dict):
        errors.append(f"{where}: schema node must be an object")
        return
    schema_type = schema.get("type")
    if isinstance(schema_type, list):
        if len(schema_type) != 2 or "null" not in schema_type or len(set(schema_type)) != 2:
            errors.append(f"{where}: nullable type must contain exactly one concrete type and null")
        concrete = next((value for value in schema_type if value != "null"), None)
    else:
        concrete = schema_type
    if concrete not in ALLOWED_TYPES - {"null"}:
        errors.append(f"{where}: missing or unknown exact type {schema_type!r}")
        return
    if schema.get("format") not in ALLOWED_FORMATS | {None}:
        errors.append(f"{where}: unsupported format {schema.get('format')!r}")
    if concrete == "object":
        properties = schema.get("properties")
        required = schema.get("required")
        if not isinstance(properties, dict) or not isinstance(required, list):
            errors.append(f"{where}: object must declare properties and required")
            return
        if schema.get("additionalProperties") is not False:
            errors.append(f"{where}: object must set additionalProperties=false")
        if set(properties) != set(required) or len(required) != len(set(required)):
            errors.append(f"{where}: object properties and required fields must be exact equal sets")
        for name, child in properties.items():
            validate_schema_shape(child, f"{where}/properties/{name}", errors)
    elif concrete == "array":
        if not isinstance(schema.get("minItems"), int) or not isinstance(schema.get("maxItems"), int):
            errors.append(f"{where}: array must declare integer minItems and maxItems")
        elif schema["minItems"] < 0 or schema["maxItems"] < schema["minItems"]:
            errors.append(f"{where}: invalid array cardinality")
        if "items" not in schema:
            errors.append(f"{where}: array must declare items")
        else:
            validate_schema_shape(schema["items"], f"{where}/items", errors)
    elif concrete == "string":
        if not any(key in schema for key in ("format", "pattern", "enum", "const", "minLength", "maxLength")):
            errors.append(f"{where}: string must declare format, pattern, enum, const, or length")
    elif concrete in {"integer", "number"}:
        if not any(key in schema for key in ("minimum", "exclusiveMinimum", "maximum", "exclusiveMaximum", "multipleOf")):
            errors.append(f"{where}: numeric field must declare range or scale")


def _string_sample(schema: Dict[str, Any]) -> str:
    if "const" in schema:
        return schema["const"]
    if schema.get("enum"):
        return schema["enum"][0]
    if schema.get("format") == "uuid":
        return "123e4567-e89b-12d3-a456-426614174000"
    if schema.get("format") == "date":
        return "2026-09-10"
    if schema.get("format") == "date-time":
        return "2026-09-10T00:00:00Z"
    candidates = [
        "0",
        "0.0",
        "1",
        "1.0",
        "0" * 64,
        "USD",
        "CODE",
        "Asia/Seoul",
        "href_abcdefghijklmnop",
        "tok_abcdefghijklmnopqrstuvwxyz",
        "vault_abcdefghijklmnopqrstuvwxyz",
        "****1234",
        "US",
        "people-summary",
        "performance-summary",
        "time-summary",
        "payroll-summary",
        "x" * max(1, schema.get("minLength", 1)),
    ]
    pattern = schema.get("pattern")
    for candidate in candidates:
        if len(candidate) <= schema.get("maxLength", 10**9) and (
            pattern is None or re.fullmatch(pattern, candidate)
        ):
            return candidate
    raise ContractFailure(f"cannot synthesize string for pattern {pattern!r}")


def synthesize(schema: Dict[str, Any]) -> Any:
    schema_type = schema["type"]
    if isinstance(schema_type, list) and "null" in schema_type:
        return None
    concrete = next(value for value in schema_type if value != "null") if isinstance(schema_type, list) else schema_type
    if concrete == "object":
        return {name: synthesize(child) for name, child in schema["properties"].items()}
    if concrete == "array":
        return [synthesize(schema["items"]) for _ in range(schema["minItems"])]
    if concrete == "string":
        return _string_sample(schema)
    if concrete == "integer":
        return int(schema.get("minimum", 0))
    if concrete == "number":
        return schema.get("minimum", 0)
    if concrete == "boolean":
        return False
    raise ContractFailure(f"cannot synthesize type {concrete}")


def validate_instance(instance: Any, schema: Dict[str, Any], at: str = "$") -> None:
    for branch in schema.get("allOf", []):
        validate_instance(instance, branch, at)
    if "if" in schema:
        try:
            validate_instance(instance, schema["if"], at)
            matched = True
        except ContractFailure:
            matched = False
        if matched and "then" in schema:
            validate_instance(instance, schema["then"], at)
        if not matched and "else" in schema:
            validate_instance(instance, schema["else"], at)
    schema_type = schema.get("type")
    if schema_type is None:
        if isinstance(instance, dict):
            missing = set(schema.get("required", [])) - set(instance)
            if missing:
                raise ContractFailure(f"{at}: missing conditional required fields {sorted(missing)}")
            for name, child_schema in schema.get("properties", {}).items():
                if name in instance:
                    validate_instance(instance[name], child_schema, f"{at}/{name}")
        if "const" in schema and instance != schema["const"]:
            raise ContractFailure(f"{at}: const rejected")
        if "enum" in schema and instance not in schema["enum"]:
            raise ContractFailure(f"{at}: enum rejected")
        return
    accepted = schema_type if isinstance(schema_type, list) else [schema_type]
    type_ok = any(
        (kind == "null" and instance is None)
        or (kind == "object" and isinstance(instance, dict))
        or (kind == "array" and isinstance(instance, list))
        or (kind == "string" and isinstance(instance, str))
        or (kind == "integer" and isinstance(instance, int) and not isinstance(instance, bool))
        or (kind == "number" and isinstance(instance, (int, float)) and not isinstance(instance, bool))
        or (kind == "boolean" and isinstance(instance, bool))
        for kind in accepted
    )
    if not type_ok:
        raise ContractFailure(f"{at}: instance type rejected by {accepted}")
    if instance is None:
        return
    if "const" in schema and instance != schema["const"]:
        raise ContractFailure(f"{at}: const rejected")
    if "enum" in schema and instance not in schema["enum"]:
        raise ContractFailure(f"{at}: enum rejected")
    if isinstance(instance, str):
        if len(instance) < schema.get("minLength", 0) or len(instance) > schema.get("maxLength", 10**9):
            raise ContractFailure(f"{at}: string length rejected")
        if "pattern" in schema and re.fullmatch(schema["pattern"], instance) is None:
            raise ContractFailure(f"{at}: pattern rejected")
        if schema.get("format") == "uuid" and re.fullmatch(
            r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}",
            instance,
        ) is None:
            raise ContractFailure(f"{at}: uuid format rejected")
        if schema.get("format") == "date":
            try:
                dt.date.fromisoformat(instance)
            except ValueError:
                raise ContractFailure(f"{at}: date format rejected")
        if schema.get("format") == "date-time":
            try:
                dt.datetime.fromisoformat(instance.replace("Z", "+00:00"))
            except ValueError:
                raise ContractFailure(f"{at}: date-time format rejected")
    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if instance < schema.get("minimum", instance) or instance > schema.get("maximum", instance):
            raise ContractFailure(f"{at}: numeric range rejected")
        if "multipleOf" in schema:
            quotient = instance / schema["multipleOf"]
            if abs(quotient - round(quotient)) > 1e-7:
                raise ContractFailure(f"{at}: multipleOf rejected")
    if isinstance(instance, list):
        if len(instance) < schema["minItems"] or len(instance) > schema["maxItems"]:
            raise ContractFailure(f"{at}: array cardinality rejected")
        if schema.get("uniqueItems") and len({canonical_digest(value) for value in instance}) != len(instance):
            raise ContractFailure(f"{at}: uniqueItems rejected")
        for index, value in enumerate(instance):
            validate_instance(value, schema["items"], f"{at}/{index}")
    if isinstance(instance, dict):
        properties = schema["properties"]
        missing = set(schema["required"]) - set(instance)
        extra = set(instance) - set(properties)
        if missing:
            raise ContractFailure(f"{at}: missing required fields {sorted(missing)}")
        if schema.get("additionalProperties") is False and extra:
            raise ContractFailure(f"{at}: additional properties {sorted(extra)}")
        for name, value in instance.items():
            validate_instance(value, properties[name], f"{at}/{name}")


def row_binding_digest(row: Mapping[str, str]) -> str:
    return canonical_digest({key: value for key, value in row.items() if key != "binding_sha256"})


def required_digest(fields: List[str]) -> str:
    return hashlib.sha256("|".join(sorted(fields)).encode("utf-8")).hexdigest()


def expected_contract_key(contract_id: str) -> str:
    if re.fullmatch(r"XCON-\d{3}", contract_id) is None:
        raise ContractFailure(f"invalid contract ID {contract_id}")
    return contract_id.replace("-", "_")


def validate(
    bindings: Optional[List[Dict[str, str]]] = None,
    schemas: Optional[Dict[str, Any]] = None,
    source_rows: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    errors: List[str] = []
    bindings = copy.deepcopy(bindings if bindings is not None else read_csv(BINDING_REGISTER))
    schemas = copy.deepcopy(schemas if schemas is not None else load_document(SCHEMA_DOCUMENT))
    source_rows = copy.deepcopy(source_rows if source_rows is not None else read_csv(SOURCE_REGISTER))
    allocations = read_csv(ALLOCATION_REGISTER)
    allocation_by_id = {row["allocation_id"]: row for row in allocations}

    if schemas.get("$schema") != EXPECTED_SCHEMA_URI:
        errors.append("canonical schema document is not Draft 2020-12")
    if schemas.get("$id") != "urn:dwp:hris:cross-module-canonical-schemas:v1":
        errors.append("canonical schema document ID drift")
    try:
        decimal = load_document(DECIMAL_DOCUMENT)
        if file_digest(DECIMAL_DOCUMENT) != DECIMAL_DOCUMENT_SHA256:
            errors.append("decimal-value SSOT digest drift")
        decimal_defs = {"InputAmount":"InputAmount", "QuantityDecimal":"QuantityDecimal", "PostedMoney":"PostedMoneyAmount"}
        for ssot_name, local_name in decimal_defs.items():
            ssot = decimal["valueTypes"][ssot_name]
            local = schemas["$defs"][local_name]
            if local.get("type") != "string" or local.get("pattern") != ssot.get("jsonPattern") or local.get("x-sqlType") != ssot.get("sqlType"):
                errors.append(f"{local_name}: decimal-value SSOT shape drift")
            if local.get("x-authoritativePointer") != f"decimal-value-types.v1.json#/valueTypes/{ssot_name}" or local.get("x-exponentNotation") != "FORBIDDEN" or local.get("x-negativeZero") != "NORMALIZE_TO_ZERO":
                errors.append(f"{local_name}: decimal serialization authority drift")
        closed_line = materialize(schemas["$defs"]["ClosedTimeLine"], schemas)
        if closed_line["properties"]["quantity"].get("x-valueType") != "QuantityDecimal" or closed_line["properties"]["unit"].get("enum") != ["MINUTE", "HOUR", "DAY", "COUNT", "AMOUNT"]:
            errors.append("ClosedTimeLine quantity/unit exact contract drift")
        expected_unit_binding = {
            "MINUTE":{"valueType":"QuantityDecimal","currency":"FORBIDDEN_NULL"},
            "HOUR":{"valueType":"QuantityDecimal","currency":"FORBIDDEN_NULL"},
            "DAY":{"valueType":"QuantityDecimal","currency":"FORBIDDEN_NULL"},
            "COUNT":{"valueType":"QuantityDecimal","currency":"FORBIDDEN_NULL"},
            "AMOUNT":{"valueType":"InputAmount","currency":"REQUIRED_ISO_4217"},
        }
        if closed_line.get("x-unitCurrencyBinding") != expected_unit_binding:
            errors.append("ClosedTimeLine unit/currency discriminant drift")
        uuid = "123e4567-e89b-12d3-a456-426614174000"
        amount_line = {"workerId":uuid,"assignmentId":uuid,"payCode":"REGULAR","quantity":"10.00","currency":"USD","sourceEntryCount":1,"sourceEntryDigest":"a"*64,"unit":"AMOUNT"}
        quantity_line = dict(amount_line, quantity="1.5", currency=None, unit="HOUR")
        validate_instance(amount_line, closed_line)
        validate_instance(quantity_line, closed_line)
        for invalid in (dict(amount_line, currency=None), dict(quantity_line, currency="USD")):
            try:
                validate_instance(invalid, closed_line)
                errors.append("ClosedTimeLine accepted invalid unit/currency pairing")
            except ContractFailure:
                pass
    except (ContractFailure, KeyError, OSError, TypeError) as exc:
        errors.append(f"decimal-value SSOT resolution failed: {exc}")
    try:
        plan = schemas["$defs"]["XCON_020"]
        plan_lines = plan["properties"]["lines"]
        plan_line = schemas["$defs"]["ApprovedCompensationPlanLine"]
        expected_plan_invariants = {
            "lineCountEquals": "lines.length",
            "lineSequence": "UNIQUE_CONTIGUOUS_ASCENDING_FROM_1",
            "lineId": "UNIQUE_WITHIN_SNAPSHOT",
            "payMaterialization": "ATOMIC_N_LINES_TO_N_INPUT_ROWS",
            "payloadDigest": "CANONICAL_HEADER_PLUS_ORDERED_LINES_CANONICAL_DECIMAL_STRINGS",
        }
        if plan_lines.get("minItems") != 1 or plan_lines.get("maxItems") != 100000 or plan["properties"]["lineCount"].get("minimum") != 1 or plan["properties"]["lineCount"].get("maximum") != 100000:
            errors.append("XCON-020 lineCount/lines cardinality drift")
        if plan.get("x-invariants") != expected_plan_invariants:
            errors.append("XCON-020 ordered N-to-N/digest invariants drift")
        amount_ref = plan_line["properties"]["approvedAmount"]
        amount = materialize(amount_ref, schemas)
        if amount_ref != {"$ref":"#/$defs/PostedMoneyAmount"} or amount.get("type") != "string" or amount.get("x-valueType") != "PostedMoney" or amount.get("x-authoritativePointer") != "decimal-value-types.v1.json#/valueTypes/PostedMoney":
            errors.append("XCON-020 approvedAmount canonical decimal-string drift")
    except (KeyError, TypeError) as exc:
        errors.append(f"XCON-020 exact nested contract resolution failed: {exc}")
    if len(source_rows) != EXPECTED_COUNT:
        errors.append(f"source register count drift: {len(source_rows)} != {EXPECTED_COUNT}")
    if len(bindings) != EXPECTED_COUNT:
        errors.append(f"binding register count drift: {len(bindings)} != {EXPECTED_COUNT}")

    source_by_id = {row["contract_id"]: row for row in source_rows}
    binding_by_id = {row["contract_id"]: row for row in bindings}
    if len(source_by_id) != len(source_rows):
        errors.append("duplicate contract ID in source register")
    if len(binding_by_id) != len(bindings):
        errors.append("duplicate contract ID in schema binding register")
    missing = sorted(set(source_by_id) - set(binding_by_id))
    orphan = sorted(set(binding_by_id) - set(source_by_id))
    if missing:
        errors.append(f"source contracts without schema binding: {missing}")
    if orphan:
        errors.append(f"orphan schema bindings: {orphan}")

    source_021 = source_by_id.get("XCON-021", {})
    binding_021 = binding_by_id.get("XCON-021", {})
    schema_021 = schemas.get("$defs", {}).get("XCON_021", {})
    if (
        source_021.get("canonical_name") != COMPENSATION_EVENT_V2
        or set(source_021.get("required_fields", "").split("|"))
        != COMPENSATION_EVENT_V2_FIELDS
        or source_021.get("producer_evidence")
        != "../session-evidence/per/g3-modern-capability-contracts.v2.json"
        or source_021.get("consumer_evidence")
        != "../session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json"
    ):
        errors.append("XCON-021: v2-only source/evidence authority drift")
    if (
        binding_021.get("canonical_name") != COMPENSATION_EVENT_V2
        or binding_021.get("producer_evidence_required_ref")
        != "../session-evidence/per/g3-modern-capability-contracts.v2.json#/capabilities/5/events/4/payloadRequired"
        or binding_021.get("consumer_evidence_required_refs")
        != "HRIS-PAY:../session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json#/consumedModernCapabilities/0/invalidationEvent/payloadRequired"
        or binding_021.get("canonical_generated_import") != COMPENSATION_EVENT_V2_IMPORT
        or binding_021.get("producer_generated_import") != COMPENSATION_EVENT_V2_IMPORT
        or binding_021.get("consumer_generated_imports")
        != f"HRIS-PAY:{COMPENSATION_EVENT_V2_IMPORT}"
        or binding_021.get("producer_test_allocation")
        != COMPENSATION_EVENT_V2_PROVIDER_TEST
        or binding_021.get("consumer_test_allocations")
        != f"HRIS-PAY:{COMPENSATION_EVENT_V2_CONSUMER_TEST}"
    ):
        errors.append("XCON-021: v2-only schema/import/test binding drift")
    if (
        schema_021.get("title") != COMPENSATION_EVENT_V2
        or set(schema_021.get("properties", {})) != COMPENSATION_EVENT_V2_FIELDS
        or set(schema_021.get("required", [])) != COMPENSATION_EVENT_V2_FIELDS
        or schema_021.get("x-causal-contract") != {
            "emission": "POST_SNAPSHOT_HEADER_AND_ALL_ORDERED_LINES_COMMIT",
            "runtimeVersion": "V2_ONLY",
            "dualPublish": "FORBIDDEN",
            "payTrigger": "THIS_EVENT_ONLY",
        }
    ):
        errors.append("XCON-021: exact 16-field v2 causal schema drift")
    active_021_text = json.dumps(
        {"source": source_021, "binding": binding_021, "schema": schema_021},
        sort_keys=True,
    )
    if COMPENSATION_EVENT_PREDECESSOR in active_021_text:
        errors.append("XCON-021: predecessor event remains in active authority")

    seen_schema_pointers = set()
    seen_provider_tests = set()
    seen_consumer_tests = set()
    resolved = 0
    evidence_matches = 0
    import_matches = 0
    test_allocations = 0

    for contract_id in sorted(set(source_by_id) & set(binding_by_id)):
        source = source_by_id[contract_id]
        binding = binding_by_id[contract_id]
        where = contract_id
        expected_fields = source["required_fields"].split("|") if source["required_fields"] else []
        expected_nested = source["nested_required_fields"].split("|") if source["nested_required_fields"] else []

        if binding.get("binding_id") != contract_id.replace("XCON", "XSC"):
            errors.append(f"{where}: binding ID drift")
        for field in ("dependency_id", "contract_kind", "canonical_name", "producer_session", "consumer_sessions"):
            source_field = "producer_session" if field == "producer_session" else field
            if binding.get(field) != source.get(source_field):
                errors.append(f"{where}: {field} differs from source register")
        if source.get("status") != "READY_FOR_G3":
            errors.append(f"{where}: source register status is not READY_FOR_G3")
        if binding.get("implementation") != EXPECTED_IMPLEMENTATION or binding.get("production") != EXPECTED_PRODUCTION:
            errors.append(f"{where}: readiness state drift")
        if binding.get("status") != "SCHEMA_BOUND":
            errors.append(f"{where}: binding status drift")
        if binding.get("binding_sha256") != row_binding_digest(binding):
            errors.append(f"{where}: binding row digest drift")

        if source.get("required_fields_sha256") != required_digest(expected_fields):
            errors.append(f"{where}: source required-fields digest drift")
        if binding.get("required_fields_sha256") != source.get("required_fields_sha256"):
            errors.append(f"{where}: binding required-fields digest drift")
        if expected_nested:
            if source.get("nested_required_fields_sha256") != required_digest(expected_nested):
                errors.append(f"{where}: source nested required-fields digest drift")
            if binding.get("nested_required_fields_sha256") != source.get("nested_required_fields_sha256"):
                errors.append(f"{where}: binding nested required-fields digest drift")
        elif binding.get("nested_required_fields_sha256") != "NONE":
            errors.append(f"{where}: unexpected nested required-fields digest")

        expected_pointer = f"#/$defs/{expected_contract_key(contract_id)}"
        if binding.get("schema_document") != SCHEMA_DOCUMENT.name or binding.get("schema_pointer") != expected_pointer:
            errors.append(f"{where}: canonical schema document or pointer drift")
        if expected_pointer in seen_schema_pointers:
            errors.append(f"{where}: duplicate canonical schema pointer")
        seen_schema_pointers.add(expected_pointer)
        try:
            raw_schema = schema_pointer(schemas, binding["schema_pointer"])
            exact_schema = materialize(raw_schema, schemas, (expected_contract_key(contract_id),))
            if canonical_digest(exact_schema) != binding.get("normalized_schema_sha256"):
                errors.append(f"{where}: normalized schema digest drift")
            if raw_schema.get("title") != source.get("canonical_name"):
                errors.append(f"{where}: schema title differs from canonical name")
            if set(raw_schema.get("properties", {})) != set(expected_fields):
                errors.append(f"{where}: schema property set differs from source required fields")
            if set(raw_schema.get("required", [])) != set(expected_fields):
                errors.append(f"{where}: schema required set differs from source required fields")
            validate_schema_shape(exact_schema, where, errors)
            validate_instance(synthesize(exact_schema), exact_schema)
            if expected_nested:
                line_schema = exact_schema.get("properties", {}).get("lines", {}).get("items", {})
                if set(line_schema.get("properties", {})) != set(expected_nested) or set(line_schema.get("required", [])) != set(expected_nested):
                    errors.append(f"{where}: nested line schema differs from nested source fields")
            resolved += 1
        except (ContractFailure, KeyError, TypeError, ValueError) as exc:
            errors.append(f"{where}: schema resolution failed: {exc}")

        try:
            producer_fields = evidence_fields(resolve_evidence_ref(binding["producer_evidence_required_ref"]))
            if set(producer_fields) != set(expected_fields) or len(producer_fields) != len(set(producer_fields)):
                errors.append(f"{where}: producer evidence field set drift")
            consumer_sessions = binding["consumer_sessions"].split("|")
            consumer_refs = parse_session_map(binding["consumer_evidence_required_refs"], f"{where} consumer evidence")
            if set(consumer_refs) != set(consumer_sessions):
                errors.append(f"{where}: consumer evidence session coverage drift")
            for session, ref in consumer_refs.items():
                fields = evidence_fields(resolve_evidence_ref(ref))
                if set(fields) != set(expected_fields) or len(fields) != len(set(fields)):
                    errors.append(f"{where}/{session}: consumer evidence field set drift")
            producer_nested_ref = binding["producer_nested_required_ref"]
            consumer_nested_refs = parse_session_map(binding["consumer_nested_required_refs"], f"{where} nested consumer evidence")
            if expected_nested:
                if set(evidence_fields(resolve_evidence_ref(producer_nested_ref))) != set(expected_nested):
                    errors.append(f"{where}: producer nested evidence drift")
                if set(consumer_nested_refs) != set(consumer_sessions):
                    errors.append(f"{where}: consumer nested evidence coverage drift")
                for session, ref in consumer_nested_refs.items():
                    if set(evidence_fields(resolve_evidence_ref(ref))) != set(expected_nested):
                        errors.append(f"{where}/{session}: consumer nested evidence drift")
            elif producer_nested_ref != "NONE" or consumer_nested_refs:
                errors.append(f"{where}: unexpected nested evidence binding")
            evidence_matches += 1
        except (ContractFailure, KeyError, TypeError, ValueError) as exc:
            errors.append(f"{where}: evidence resolution failed: {exc}")

        try:
            import_name = binding["canonical_generated_import"]
            if re.fullmatch(r"com\.dwp\.contracts\.hris\.xcon\.v1\.Xcon\d{3}[A-Za-z0-9]+V[1-9][0-9]*", import_name) is None:
                errors.append(f"{where}: canonical generated import naming drift")
            if binding["producer_generated_import"] != import_name:
                errors.append(f"{where}: producer does not import canonical generated type")
            consumer_imports = parse_session_map(binding["consumer_generated_imports"], f"{where} consumer imports")
            consumer_sessions = binding["consumer_sessions"].split("|")
            if set(consumer_imports) != set(consumer_sessions) or any(value != import_name for value in consumer_imports.values()):
                errors.append(f"{where}: consumers do not import the same canonical generated type")
            import_matches += 1

            producer_allocation = allocation_by_id[binding["producer_allocation_id"]]
            if producer_allocation["session_id"] != binding["producer_session"] or binding["dependency_id"] not in producer_allocation["dependency_ids"].split("|"):
                errors.append(f"{where}: producer allocation does not own session/dependency")
            consumer_allocations = parse_session_map(binding["consumer_allocation_ids"], f"{where} consumer allocations")
            if set(consumer_allocations) != set(consumer_sessions):
                errors.append(f"{where}: consumer allocation session coverage drift")
            for session, allocation_id in consumer_allocations.items():
                allocation = allocation_by_id[allocation_id]
                if allocation["session_id"] != session or binding["dependency_id"] not in allocation["dependency_ids"].split("|"):
                    errors.append(f"{where}/{session}: consumer allocation does not own session/dependency")

            provider_test = binding["producer_test_allocation"]
            if not provider_test.startswith(TEST_ROOTS[binding["producer_session"]]) or not provider_test.endswith("ProviderContractTest.java"):
                errors.append(f"{where}: producer test allocation outside module or wrong test kind")
            if provider_test in seen_provider_tests:
                errors.append(f"{where}: duplicate producer contract test allocation")
            seen_provider_tests.add(provider_test)
            consumer_tests = parse_session_map(binding["consumer_test_allocations"], f"{where} consumer tests")
            if set(consumer_tests) != set(consumer_sessions):
                errors.append(f"{where}: consumer test allocation coverage drift")
            for session, test_path in consumer_tests.items():
                if not test_path.startswith(TEST_ROOTS[session]) or not test_path.endswith("ConsumerContractTest.java"):
                    errors.append(f"{where}/{session}: consumer test allocation outside module or wrong test kind")
                if test_path in seen_consumer_tests:
                    errors.append(f"{where}/{session}: duplicate consumer contract test allocation")
                seen_consumer_tests.add(test_path)
            test_allocations += 1 + len(consumer_tests)
        except (ContractFailure, KeyError, TypeError, ValueError) as exc:
            errors.append(f"{where}: generated import/test allocation failed: {exc}")

    by_kind = dict(Counter(row.get("contract_kind") for row in bindings))
    by_producer = dict(Counter(row.get("producer_session") for row in bindings))
    if by_kind != EXPECTED_KINDS:
        errors.append(f"contract kind counts drift: {by_kind}")
    if by_producer != EXPECTED_PRODUCERS:
        errors.append(f"producer counts drift: {by_producer}")

    coverage = {
        "sourceContractCount": len(source_rows),
        "bindingCount": len(bindings),
        "resolvedSchemaCount": resolved,
        "producerEvidenceMatchCount": evidence_matches,
        "consumerBindingCount": sum(len(row.get("consumer_sessions", "").split("|")) for row in bindings),
        "generatedImportMatchCount": import_matches,
        "testAllocationCount": test_allocations,
        "byKind": by_kind,
        "byProducer": by_producer,
        "duplicateContractCount": len(bindings) - len(binding_by_id),
        "orphanBindingCount": len(orphan),
    }
    checks = {
        "exact21Parity": len(source_rows) == len(bindings) == EXPECTED_COUNT and not missing and not orphan,
        "draft202012TypedClosedSchemas": not any("schema" in error and "drift" in error or "additionalProperties" in error for error in errors),
        "producerConsumerEvidenceExact": not any("evidence" in error for error in errors),
        "sameGeneratedImportAtBothEnds": not any("import" in error for error in errors),
        "producerConsumerTestsAllocated": not any("test allocation" in error for error in errors),
        "normalizedSchemaDigestsPinned": not any("normalized schema digest" in error for error in errors),
    }
    return {
        "schema": "dwp.hris.cross-module-schema-contracts.v1",
        "status": "PASS" if not errors else "FAIL",
        "coverage": coverage,
        "states": {"implementation": EXPECTED_IMPLEMENTATION, "production": EXPECTED_PRODUCTION},
        "checks": checks,
        "digests": {
            str(path.relative_to(BLUEPRINT)): file_digest(path)
            for path in (SOURCE_REGISTER, SCHEMA_DOCUMENT, BINDING_REGISTER, DECIMAL_DOCUMENT)
        },
        "errors": errors,
    }


def self_test() -> Dict[str, Any]:
    base_bindings = read_csv(BINDING_REGISTER)
    base_schemas = load_document(SCHEMA_DOCUMENT)
    base_source = read_csv(SOURCE_REGISTER)
    cases: List[Dict[str, Any]] = []

    def rejected(name: str, mutate) -> None:
        bindings = copy.deepcopy(base_bindings)
        schemas = copy.deepcopy(base_schemas)
        source = copy.deepcopy(base_source)
        mutate(bindings, schemas, source)
        result = validate(bindings, schemas, source)
        cases.append({
            "name": name,
            "status": "PASS" if result["status"] == "FAIL" else "FAIL",
            "rejectedErrorCount": len(result["errors"]),
        })

    rejected("unknown-schema-ref", lambda b, s, r: s["$defs"]["XCON_001"]["properties"]["personPublicId"].update({"$ref": "#/$defs/Unknown"}))
    rejected("schema-required-drift", lambda b, s, r: s["$defs"]["XCON_003"]["required"].remove("changeType"))
    rejected("schema-field-type-drift", lambda b, s, r: s["$defs"]["ApprovedCompensationPlanLine"]["properties"]["approvedAmount"].update({"type": "number"}))
    rejected("schema-nullability-drift", lambda b, s, r: s["$defs"]["XCON_016"]["properties"].update({"effectiveTo": {"type": "string", "format": "date"}}))
    rejected("nested-cardinality-drift", lambda b, s, r: s["$defs"]["XCON_008"]["properties"]["lines"].pop("maxItems"))
    rejected("open-object-drift", lambda b, s, r: s["$defs"]["EligibilityFacts"].update({"additionalProperties": True}))
    rejected("normalized-digest-drift", lambda b, s, r: b[0].update({"normalized_schema_sha256": "0" * 64}))
    rejected("producer-evidence-pointer-drift", lambda b, s, r: b[0].update({"producer_evidence_required_ref": "../session-evidence/hrm/g2-readiness/api-event-contracts.v1.json#/events/2/payloadRequired"}))
    rejected("consumer-evidence-field-drift", lambda b, s, r: b[1].update({"consumer_evidence_required_refs": "HRIS-PAY:../session-evidence/pay/g2-api-event-contracts.json#/consumedSnapshots/0/required"}))
    rejected("producer-generated-import-drift", lambda b, s, r: b[2].update({"producer_generated_import": "com.example.LocalDto"}))
    rejected("consumer-generated-import-drift", lambda b, s, r: b[2].update({"consumer_generated_imports": "HRIS-PER:com.example.LocalDto;HRIS-TIM:com.example.LocalDto;HRIS-PAY:com.example.LocalDto"}))
    rejected("producer-test-allocation-drift", lambda b, s, r: b[3].update({"producer_test_allocation": "dwp-payroll-server/src/test/java/WrongProviderContractTest.java"}))
    rejected("consumer-test-coverage-drift", lambda b, s, r: b[4].update({"consumer_test_allocations": "HRIS-PER:dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/integration/xcon/WrongConsumerContractTest.java"}))
    rejected("source-required-field-drift", lambda b, s, r: r[5].update({"required_fields": r[5]["required_fields"] + "|unexpectedField"}))
    rejected("xcon020-line-cardinality-drift", lambda b, s, r: s["$defs"]["XCON_020"]["properties"]["lines"].update({"maxItems": 1000}))
    rejected("xcon020-n-to-n-invariant-drift", lambda b, s, r: s["$defs"]["XCON_020"]["x-invariants"].pop("payMaterialization"))
    rejected("decimal-negative-zero-policy-drift", lambda b, s, r: s["$defs"]["PostedMoneyAmount"].update({"x-negativeZero": "PRESERVE"}))
    rejected("closed-time-unit-currency-binding-drift", lambda b, s, r: s["$defs"]["ClosedTimeLine"]["x-unitCurrencyBinding"]["AMOUNT"].update({"currency":"FORBIDDEN_NULL"}))
    rejected(
        "xcon021-v2-to-v1-coherent-drift",
        lambda b, s, r: (
            next(row for row in b if row["contract_id"] == "XCON-021").update(
                {"canonical_name": COMPENSATION_EVENT_PREDECESSOR}
            ),
            s["$defs"]["XCON_021"].update({"title": COMPENSATION_EVENT_PREDECESSOR}),
            next(row for row in r if row["contract_id"] == "XCON-021").update(
                {"canonical_name": COMPENSATION_EVENT_PREDECESSOR}
            ),
        ),
    )
    rejected(
        "xcon021-exact-field-drift",
        lambda b, s, r: s["$defs"]["XCON_021"]["required"].remove("snapshotRevision"),
    )
    rejected(
        "xcon021-historical-evidence-reactivation",
        lambda b, s, r: next(
            row for row in b if row["contract_id"] == "XCON-021"
        ).update({
            "consumer_evidence_required_refs": (
                "HRIS-PAY:../session-evidence/pay/g2-api-event-contracts.json"
                "#/consumedEvents/11/payloadRequired"
            )
        }),
    )

    return {
        "schema": "dwp.hris.cross-module-schema-contracts-self-test.v1",
        "status": "PASS" if all(case["status"] == "PASS" for case in cases) else "FAIL",
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    result = self_test() if args.self_test else validate()
    kwargs = {"ensure_ascii": False, "sort_keys": True}
    if args.compact:
        kwargs["separators"] = (",", ":")
    else:
        kwargs["indent"] = 2
    print(json.dumps(result, **kwargs))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
