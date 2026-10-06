#!/usr/bin/env python3
"""Fail-closed executable proof for HRIS decimal, money and large handoff contracts."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import pathlib
import re
import subprocess
from decimal import (
    Decimal,
    InvalidOperation,
    ROUND_CEILING,
    ROUND_DOWN,
    ROUND_FLOOR,
    ROUND_HALF_EVEN,
    ROUND_HALF_UP,
    ROUND_UP,
    localcontext,
)
from typing import Any


HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
PATHS = {
    "decimal": HERE / "decimal-value-types.v1.json",
    "canonical": HERE / "cross-module-canonical-schemas.v1.json",
    "pay_transport": ROOT / "session-evidence/pay/g2-transport-schemas.v1.json",
    "pay_api": ROOT / "session-evidence/pay/g2-api-event-contracts.json",
    "tim_api": ROOT / "session-evidence/tim/g2-api-event-contracts.json",
    "per_api": ROOT / "session-evidence/per/g2-readiness/api-event-contracts.yaml",
    "pay_ddl": ROOT / "session-evidence/pay/g2-physical-schema.sql",
    "tim_ddl": ROOT / "session-evidence/tim/g2-physical-schema.sql",
    "golden": ROOT / "session-evidence/pay/synthetic-golden-fixtures.json",
    "pay_consumer": ROOT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json",
}

VALUE_TYPES = {
    "CalculationDecimal": (24, 8, "NUMERIC(24,8)", 16),
    "InputAmount": (19, 6, "NUMERIC(19,6)", 13),
    "RateDecimal": (19, 8, "NUMERIC(19,8)", 11),
    "QuantityDecimal": (19, 6, "NUMERIC(19,6)", 13),
    "PostedMoney": (19, 4, "NUMERIC(19,4)", 15),
}
ROUNDING = {
    "HALF_UP": ROUND_HALF_UP,
    "HALF_EVEN": ROUND_HALF_EVEN,
    "DOWN": ROUND_DOWN,
    "UP": ROUND_UP,
    "FLOOR": ROUND_FLOOR,
    "CEILING": ROUND_CEILING,
}
STREAMS = {
    "CLOSED_TIME": {
        "wireVersion": "V1_JSON_ARRAY",
        "gatewayBuffering": "FORBIDDEN_STREAM_THROUGH",
        "backpressure": "END_TO_END_REACTIVE_PULL_WITH_BOUNDED_QUEUES",
        "lineCeiling": 1_000_000,
        "maxHeaderBytes": 65_536,
        "maxLineBytes": 4_096,
        "maxPayloadBytes": 5_368_709_120,
        "maxCompressedPayloadBytes": 1_073_741_824,
        "maxUncompressedPayloadBytes": 5_368_709_120,
        "maxCompressionRatio": 100,
        "byteAccounting": "COUNT_COMPRESSED_AND_STREAMING_DECOMPRESSED_BYTES_BEFORE_ALLOCATION",
        "sequenceValidation": "ARRAY_INDEX_CONTIGUOUS_FROM_0_AND_COUNT_EQUALS_LINE_COUNT",
        "digest": "INCREMENTAL_CANONICAL_HEADER_THEN_ORDERED_LINES",
        "consumerIngest": "STAGED_TEMPORARY_ROWS",
        "finalize": "ATOMIC_AFTER_COUNT_SEQUENCE_AND_DIGEST_VALIDATION",
        "failure": "ROLLBACK_STAGED_ROWS_AND_QUARANTINE_RECEIPT",
    },
    "COMPENSATION": {
        "wireVersion": "V1_JSON_ARRAY",
        "gatewayBuffering": "FORBIDDEN_STREAM_THROUGH",
        "backpressure": "END_TO_END_REACTIVE_PULL_WITH_BOUNDED_QUEUES",
        "lineCeiling": 100_000,
        "maxHeaderBytes": 65_536,
        "maxLineBytes": 4_096,
        "maxPayloadBytes": 536_870_912,
        "maxCompressedPayloadBytes": 134_217_728,
        "maxUncompressedPayloadBytes": 536_870_912,
        "maxCompressionRatio": 100,
        "byteAccounting": "COUNT_COMPRESSED_AND_STREAMING_DECOMPRESSED_BYTES_BEFORE_ALLOCATION",
        "sequenceValidation": "LINE_SEQUENCE_EQUALS_ARRAY_INDEX_PLUS_1_CONTIGUOUS_NO_GAP_OR_DUPLICATE",
        "digest": "INCREMENTAL_CANONICAL_HEADER_THEN_ORDERED_LINES",
        "consumerIngest": "STAGED_TEMPORARY_ROWS",
        "finalize": "ATOMIC_AFTER_COUNT_SEQUENCE_AND_DIGEST_VALIDATION",
        "failure": "ROLLBACK_STAGED_ROWS_AND_QUARANTINE_RECEIPT",
    },
}


class Validation:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.checks = 0

    def require(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            self.errors.append(message)


def load_yaml(path: pathlib.Path) -> Any:
    try:
        import yaml  # type: ignore

        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except ImportError:
        proc = subprocess.run(
            ["ruby", "-ryaml", "-rjson", "-e", "puts JSON.generate(YAML.load_file(ARGV[0]))", str(path)],
            check=False,
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise ValueError(proc.stderr.strip())
        return json.loads(proc.stdout)


def load_inputs() -> dict[str, Any]:
    result: dict[str, Any] = {}
    for name, path in PATHS.items():
        if path.suffix == ".json":
            result[name] = json.loads(path.read_text(encoding="utf-8"))
        elif path.suffix in {".yaml", ".yml"}:
            result[name] = load_yaml(path)
        else:
            result[name] = path.read_text(encoding="utf-8")
    return result


def expected_pattern(integer_digits: int, scale: int) -> str:
    return rf"^-?(?:0|[1-9][0-9]{{0,{integer_digits - 1}}})(?:\.[0-9]{{1,{scale}}})?$"


def parse_typed_wire(value: Any, spec: dict[str, Any]) -> Decimal:
    if type(value) is not str:
        raise ValueError("WIRE_TYPE_REQUIRED")
    if re.fullmatch(spec["jsonPattern"], value) is None:
        raise ValueError("SCHEMA_INVALID")
    try:
        parsed = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("SCHEMA_INVALID") from exc
    if not parsed.is_finite():
        raise ValueError("SCHEMA_INVALID")
    return parsed


def parse_plain(value: Any) -> Decimal:
    if type(value) is not str:
        raise ValueError("WIRE_TYPE_REQUIRED")
    if re.fullmatch(r"^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$", value) is None:
        raise ValueError("SCHEMA_INVALID")
    parsed = Decimal(value)
    if not parsed.is_finite():
        raise ValueError("SCHEMA_INVALID")
    return parsed


def canonical_unquantized(value: Any) -> str:
    parsed = parse_plain(value)
    if parsed.is_zero():
        return "0"
    rendered = format(parsed, "f")
    if "." in rendered:
        rendered = rendered.rstrip("0").rstrip(".")
    return rendered


def quantize(value: Any, scale: int, mode: str) -> str:
    parsed = parse_plain(value)
    digits = len(parsed.as_tuple().digits)
    with localcontext() as context:
        context.prec = max(100, digits + abs(parsed.as_tuple().exponent) + scale + 10)
        result = parsed.quantize(Decimal(1).scaleb(-scale), rounding=ROUNDING[mode])
    if result.is_zero():
        result = result.copy_abs()
    return format(result, f".{scale}f") if scale else format(result, ".0f")


def digest(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def validate_stream(v: Validation, actual: Any, expected: dict[str, Any], where: str) -> None:
    v.require(actual == expected, f"{where}: exact streaming/backpressure/limit contract drift")
    if not isinstance(actual, dict):
        return
    v.require(actual.get("maxCompressedPayloadBytes", 0) < actual.get("maxUncompressedPayloadBytes", 0),
              f"{where}: compressed and uncompressed ceilings are not independently bounded")
    v.require(actual.get("maxPayloadBytes") == actual.get("maxUncompressedPayloadBytes"),
              f"{where}: v1 maxPayloadBytes compatibility alias drift")


def validate_decimal_ssot(v: Validation, data: dict[str, Any]) -> None:
    v.require(data.get("$schema") == "https://json-schema.org/draft/2020-12/schema", "decimal SSOT schema drift")
    v.require(data.get("contractId") == "dwp.hris.decimal-value-types.v1", "decimal contract ID drift")
    v.require(data.get("status") == "READY_FOR_G3_CODE", "decimal readiness state drift")
    serialization = data.get("serialization", {})
    v.require(serialization == {
        "wireType": "STRING",
        "exponentNotation": "FORBIDDEN",
        "localeFormatting": "FORBIDDEN",
        "plusSign": "FORBIDDEN",
        "negativeZero": "NORMALIZE_TO_ZERO",
        "databaseRounding": "FORBIDDEN",
        "floatingPoint": "FORBIDDEN",
    }, "decimal serialization policy drift")
    canonical = data.get("canonicalization", {})
    for key, markers in {
        "parse": ("arbitrary-precision", "JSON number", "exponent"),
        "signedZero": ("positive zero", "hashing", "persistence"),
        "unquantized": ("plain base-10", "zero is exactly 0"),
        "quantized": ("exactly the declared scale", "no minus sign"),
        "digest": ("Canonical JSON", "byte-identical"),
        "persistence": ("before SQL bind", "never be used as the rounding operation"),
    }.items():
        text = canonical.get(key, "")
        v.require(all(marker in text for marker in markers), f"decimal canonicalization.{key} drift")
    types = data.get("valueTypes", {})
    v.require(set(types) == set(VALUE_TYPES), "decimal value-type set drift")
    for name, (precision, scale, sql_type, integer_digits) in VALUE_TYPES.items():
        spec = types.get(name, {})
        v.require(spec.get("precision") == precision and spec.get("scale") == scale
                  and spec.get("sqlType") == sql_type
                  and spec.get("jsonPattern") == expected_pattern(integer_digits, scale),
                  f"{name}: precision/scale/pattern drift")
        maximum = "9" * integer_digits + "." + "9" * scale
        overflow = "1" + "0" * integer_digits + "." + "0" * scale
        try:
            parsed = parse_typed_wire(maximum, spec)
            v.require(parsed == Decimal(maximum), f"{name}: arbitrary-precision maximum changed")
        except ValueError as exc:
            v.require(False, f"{name}: valid precision boundary rejected: {exc}")
        try:
            parse_typed_wire(overflow, spec)
            v.require(False, f"{name}: overflow accepted")
        except ValueError:
            v.require(True, f"{name}: overflow rejection")
    v.require(data.get("requiredRoundingModes") == list(ROUNDING), "rounding mode set/order drift")
    v.require(data.get("roundingPipeline") == [
        "SOURCE_NORMALIZE", "FORMULA_DECLARED", "ELEMENT", "WORKER_RESULT", "SETTLEMENT_OR_STATUTORY"
    ], "rounding pipeline drift")
    rules = data.get("rules", {})
    v.require("before persistence" in rules.get("overflow", "")
              and "never" in rules.get("overflow", ""), "pre-bind overflow policy drift")
    v.require("prior exact rounded value" in rules.get("noDoubleRounding", ""), "double-rounding policy drift")
    currency = data.get("currencyPolicy", {})
    unit = data.get("unitPolicy", {})
    v.require(currency.get("hardcodedMinorUnits") == "FORBIDDEN"
              and currency.get("crossCurrencyArithmetic") == "FORBIDDEN_WITHOUT_VERSIONED_FX_CONTRACT",
              "currency policy drift")
    v.require(unit.get("canonicalCodes") == ["MINUTE", "HOUR", "DAY", "COUNT", "AMOUNT"]
              and "AMOUNT handoff values require currency" in unit.get("money", "")
              and "non-AMOUNT handoff quantities forbid" in unit.get("money", ""),
              "unit/currency policy drift")


def validate_canonical_xcon(v: Validation, inputs: dict[str, Any]) -> None:
    defs = inputs["canonical"].get("$defs", {})
    types = inputs["decimal"].get("valueTypes", {})
    for ssot, local in (("InputAmount", "InputAmount"), ("QuantityDecimal", "QuantityDecimal"), ("PostedMoney", "PostedMoneyAmount")):
        schema = defs.get(local, {})
        v.require(schema.get("type") == "string" and schema.get("pattern") == types.get(ssot, {}).get("jsonPattern")
                  and schema.get("x-sqlType") == types.get(ssot, {}).get("sqlType")
                  and schema.get("x-authoritativePointer") == f"decimal-value-types.v1.json#/valueTypes/{ssot}",
                  f"canonical {local}: decimal SSOT binding drift")
    v.require(defs.get("XCON_002", {}).get("properties", {}).get("amount") == {"$ref": "#/$defs/InputAmount"},
              "XCON-002 CompensationBasis amount is not InputAmount decimal string")
    closed = defs.get("ClosedTimeLine", {})
    v.require(closed.get("x-unitCurrencyBinding") == {
        "MINUTE": {"valueType": "QuantityDecimal", "currency": "FORBIDDEN_NULL"},
        "HOUR": {"valueType": "QuantityDecimal", "currency": "FORBIDDEN_NULL"},
        "DAY": {"valueType": "QuantityDecimal", "currency": "FORBIDDEN_NULL"},
        "COUNT": {"valueType": "QuantityDecimal", "currency": "FORBIDDEN_NULL"},
        "AMOUNT": {"valueType": "InputAmount", "currency": "REQUIRED_ISO_4217"},
    }, "XCON-008 unit-discriminated Quantity/InputAmount currency binding drift")
    condition = (closed.get("allOf") or [{}])[0]
    v.require(condition.get("if", {}).get("properties", {}).get("unit", {}).get("const") == "AMOUNT"
              and condition.get("then", {}).get("properties", {}).get("quantity") == {"$ref": "#/$defs/InputAmount"}
              and condition.get("then", {}).get("properties", {}).get("currency") == {"$ref": "#/$defs/Currency"}
              and condition.get("else", {}).get("properties", {}).get("quantity") == {"$ref": "#/$defs/QuantityDecimal"}
              and condition.get("else", {}).get("properties", {}).get("currency") == {"type": "null"},
              "XCON-008 conditional schema drift")
    plan = defs.get("XCON_020", {})
    line = defs.get("ApprovedCompensationPlanLine", {})
    v.require(plan.get("properties", {}).get("lineCount", {}).get("minimum") == 1
              and plan.get("properties", {}).get("lineCount", {}).get("maximum") == 100_000
              and plan.get("properties", {}).get("lines", {}).get("minItems") == 1
              and plan.get("properties", {}).get("lines", {}).get("maxItems") == 100_000,
              "XCON-020 header/1..100000 line cardinality drift")
    v.require(line.get("properties", {}).get("approvedAmount") == {"$ref": "#/$defs/PostedMoneyAmount"}
              and line.get("properties", {}).get("lineSequence", {}).get("minimum") == 1
              and line.get("properties", {}).get("lineSequence", {}).get("maximum") == 100_000,
              "XCON-020 ordered line/non-exponent money contract drift")
    v.require(plan.get("x-invariants") == {
        "lineCountEquals": "lines.length",
        "lineSequence": "UNIQUE_CONTIGUOUS_ASCENDING_FROM_1",
        "lineId": "UNIQUE_WITHIN_SNAPSHOT",
        "payMaterialization": "ATOMIC_N_LINES_TO_N_INPUT_ROWS",
        "payloadDigest": "CANONICAL_HEADER_PLUS_ORDERED_LINES_CANONICAL_DECIMAL_STRINGS",
    }, "XCON-020 N-to-N/incremental digest invariants drift")
    validate_stream(v, defs.get("XCON_008", {}).get("x-streamingTransport"), STREAMS["CLOSED_TIME"], "XCON-008")
    validate_stream(v, plan.get("x-streamingTransport"), STREAMS["COMPENSATION"], "XCON-020")


def by_name(rows: list[dict[str, Any]], name: str) -> dict[str, Any]:
    return next((row for row in rows if row.get("name") == name), {})


def validate_source_handoffs(v: Validation, inputs: dict[str, Any]) -> None:
    tim_closed = by_name(inputs["tim_api"].get("providedSnapshots", []), "ClosedTimeResult.v1")
    pay_closed = by_name(inputs["pay_api"].get("consumedSnapshots", []), "ClosedTimeResult.v1")
    pay_plan = by_name(inputs["pay_api"].get("consumedSnapshots", []), "ApprovedCompensationPlanSnapshot.v1")
    per_plan = by_name(inputs["per_api"].get("x-dwp-provided-snapshots", []), "ApprovedCompensationPlanSnapshot.v1")
    validate_stream(v, tim_closed.get("streamingTransport"), STREAMS["CLOSED_TIME"], "TIM provider ClosedTimeResult")
    validate_stream(v, pay_closed.get("streamingTransport"), STREAMS["CLOSED_TIME"], "PAY consumer ClosedTimeResult")
    validate_stream(v, per_plan.get("streamingTransport"), STREAMS["COMPENSATION"], "PER provider compensation")
    validate_stream(v, pay_plan.get("streamingTransport"), STREAMS["COMPENSATION"], "PAY consumer compensation")
    v.require(tim_closed.get("lineValuePolicy") == pay_closed.get("lineValuePolicy")
              and "AMOUNT uses InputAmount and requires currency" in tim_closed.get("lineValuePolicy", "")
              and "currency=null" in tim_closed.get("lineValuePolicy", ""),
              "TIM/PAY ClosedTimeResult decimal/currency contract differs")
    v.require("canonical PostedMoney decimal string NUMERIC(19,4)" in pay_plan.get("decimalPolicy", "")
              and "implicit database rounding forbidden" in pay_plan.get("decimalPolicy", "")
              and "lineSequence contiguous from 1" in pay_plan.get("cardinality", "")
              and "N lines to N input rows atomically" in pay_plan.get("cardinality", ""),
              "PAY compensation snapshot decimal/N-to-N contract drift")


def validate_ddl(v: Validation, inputs: dict[str, Any]) -> None:
    pay = inputs["pay_ddl"]
    tim = inputs["tim_ddl"]
    for name, ddl in (("PAY", pay), ("TIM", tim)):
        v.require(re.search(r"\b(?:DOUBLE\s+PRECISION|REAL|FLOAT\s*\()", ddl, re.I) is None,
                  f"{name}: binary floating SQL type present")
    for name, ddl, constraint in (
        ("TIM", tim, "ck_tme_closed_result_line_currency"),
        ("PAY", pay, "ck_pay_time_handoff_line_currency"),
    ):
        pattern = rf"CONSTRAINT\s+{constraint}\s+CHECK\s*\(\s*\(unit\s*=\s*'AMOUNT'\s+AND\s+currency_code\s*<>\s*'XXX'\s+AND\s+currency_code\s*~\s*'\^\[A-Z\]\{{3\}}\$'\)\s*OR\s*\(unit\s*<>\s*'AMOUNT'\s+AND\s+currency_code\s*=\s*'XXX'\)\s*\)"
        v.require(re.search(pattern, ddl, re.I | re.S) is not None,
                  f"{name}: AMOUNT/currency versus quantity/XXX persistence pairing drift")
        v.require("quantity NUMERIC(19,6) NOT NULL" in ddl,
                  f"{name}: ClosedTime quantity/InputAmount physical precision drift")
    v.require("unrounded_output_amount NUMERIC(24,8)" in pay
              and "gross_amount NUMERIC(19,4)" in pay
              and "amount NUMERIC(19,6)" in pay
              and "rate NUMERIC(19,8)" in pay,
              "PAY decimal value-type physical precision drift")


def validate_pay_consumer(v: Validation, inputs: dict[str, Any]) -> None:
    doc = inputs["pay_consumer"]
    consumed = doc.get("consumedModernCapabilities", [])
    v.require(len(consumed) == 1, "PAY compensation consumer count drift")
    if len(consumed) != 1:
        return
    item = consumed[0]
    snap = item.get("snapshotContract", {})
    validate_stream(v, snap.get("streamingTransport"), STREAMS["COMPENSATION"], "PAY modern compensation projection")
    tables = {table.get("name"): table for table in item.get("tables", [])}
    v.require(set(tables) == {"pay_compensation_plan_inputs", "pay_input_snapshot_compensation_refs"},
              "PAY consumer exact two-table allocation drift")
    expected_input_columns = {
        "snapshot_id": ("UUID", False, "snapshotId"),
        "snapshot_revision": ("BIGINT", False, "snapshotRevision"),
        "plan_id": ("UUID", False, "planId"),
        "cycle_id": ("UUID", False, "cycleId"),
        "source_line_id": ("UUID", False, "lines[].lineId"),
        "line_sequence": ("INTEGER", False, "lines[].lineSequence"),
        "worker_id": ("UUID", False, "lines[].workerId"),
        "assignment_id": ("UUID", False, "lines[].assignmentId"),
        "component_code": ("VARCHAR(40)", False, "lines[].componentCode"),
        "currency": ("CHAR(3)", False, "lines[].currency"),
        "approved_amount": ("NUMERIC(19,4)", False, "lines[].approvedAmount"),
        "effective_from": ("DATE", False, "lines[].effectiveFrom"),
        "effective_to": ("DATE", True, "lines[].effectiveTo"),
        "approval_receipt_id": ("UUID", False, "approvalReceiptId"),
        "source_version": ("BIGINT", False, "sourceVersion"),
        "line_digest": ("CHAR(64)", False, "lines[].lineDigest"),
        "snapshot_payload_digest": ("CHAR(64)", False, "payloadDigest"),
        "snapshot_effective_from": ("DATE", False, "effectiveFrom"),
        "snapshot_effective_to": ("DATE", True, "effectiveTo"),
        "snapshot_line_count": ("INTEGER", False, "lineCount"),
    }
    expected_ref_columns = {
        "input_snapshot_id": ("BIGINT", False, "pay_input_snapshots.input_snapshot_id"),
        "compensation_plan_input_id": ("BIGINT", False, "pay_compensation_plan_inputs.compensation_plan_input_id"),
        "line_sequence": ("INTEGER", False, "pay_compensation_plan_inputs.line_sequence"),
        "line_digest": ("CHAR(64)", False, "pay_compensation_plan_inputs.line_digest"),
        "recorded_at": ("TIMESTAMPTZ", False, "ownerClock.instant"),
    }
    for table_name, expected in (
        ("pay_compensation_plan_inputs", expected_input_columns),
        ("pay_input_snapshot_compensation_refs", expected_ref_columns),
    ):
        table = tables.get(table_name, {})
        actual = {
            column.get("name"): (column.get("sqlType"), column.get("nullable"), column.get("source"))
            for column in table.get("physicalColumnContract", [])
        }
        v.require(actual == expected, f"{table_name}: exact physical column/source contract drift")
        v.require(table.get("rowSecurity") == "INHERIT_EXACT_DEFAULT", f"{table_name}: RLS contract drift")
    input_table = tables.get("pay_compensation_plan_inputs", {})
    ref_table = tables.get("pay_input_snapshot_compensation_refs", {})
    v.require(set(input_table.get("uniqueKeys", [])) == {
        "(tenant_id,compensation_plan_input_id)",
        "(tenant_id,public_id)",
        "(tenant_id,snapshot_id,snapshot_revision,source_line_id)",
        "(tenant_id,snapshot_id,snapshot_revision,line_sequence)",
        "(tenant_id,snapshot_payload_digest,line_digest)",
    }, "pay_compensation_plan_inputs: candidate/idempotency/digest keys drift")
    v.require(set(ref_table.get("uniqueKeys", [])) == {
        "(tenant_id,input_snapshot_compensation_ref_id)",
        "(tenant_id,public_id)",
        "(tenant_id,input_snapshot_id,compensation_plan_input_id)",
        "(tenant_id,input_snapshot_id,line_sequence)",
    }, "pay_input_snapshot_compensation_refs: candidate/order keys drift")
    v.require(ref_table.get("foreignKeys") == [
        {
            "columns": ["tenant_id", "input_snapshot_id"],
            "targetTable": "pay_input_snapshots",
            "targetColumns": ["tenant_id", "input_snapshot_id"],
            "targetCandidateKey": "uk_pay_input_snapshot_internal",
        },
        {
            "columns": ["tenant_id", "compensation_plan_input_id"],
            "targetTable": "pay_compensation_plan_inputs",
            "targetColumns": ["tenant_id", "compensation_plan_input_id"],
            "targetCandidateKey": "uk_pay_compensation_plan_input_internal",
        },
    ], "PAY consumer local composite FK/candidate-key contract drift")
    checks = set(input_table.get("checks", []))
    v.require({"line_digest ~ '^[0-9a-f]{64}$'", "snapshot_payload_digest ~ '^[0-9a-f]{64}$'"} <= checks,
              "PAY consumer line/header digest constraints drift")
    base_ddl = inputs["pay_ddl"]
    v.require("CONSTRAINT uk_pay_input_snapshot_internal UNIQUE (tenant_id, input_snapshot_id)" in base_ddl,
              "PAY base target candidate key for compensation join FK missing")
    tests = item.get("acceptanceTests", [])
    joined = " ".join(test.get("assertion", "") for test in tests)
    for marker in (
        "streams through without buffering", "compressed or uncompressed byte overflow",
        "roll back staged rows", "incremental canonical digest", "atomic finalize",
        "no partial snapshot is queryable", "N equals lineCount",
    ):
        v.require(marker in joined, f"PAY streaming acceptance missing: {marker}")


def validate_golden(v: Validation, inputs: dict[str, Any]) -> None:
    cases = {case.get("id"): case for case in inputs["golden"].get("cases", [])}
    case = cases.get("PAY-GOLD-014", {})
    source = case.get("input", {})
    expected = case.get("expected", {})
    v.require(source.get("contract") == "dwp.hris.decimal-value-types.v1", "PAY-GOLD-014 SSOT binding drift")
    seen_modes: set[str] = set()
    seen_scales: set[int] = set()
    for rounding_case in source.get("roundingCases", []):
        mode = rounding_case.get("mode")
        scale = rounding_case.get("scale")
        seen_modes.add(mode)
        seen_scales.add(scale)
        actual = [quantize(value, scale, mode) for value in rounding_case.get("values", [])]
        v.require(actual == rounding_case.get("outputs"), f"PAY-GOLD-014 rounding mismatch {mode}/scale={scale}")
    v.require(seen_modes == set(ROUNDING) and {0, 4} <= seen_scales,
              "PAY-GOLD-014 does not execute every mode plus scale 0/4")
    types = inputs["decimal"].get("valueTypes", {})
    entry_types = {"MONEY": "InputAmount", "RATE": "RateDecimal", "HOURS": "QuantityDecimal", "NUMBER": "CalculationDecimal"}
    for entry in source.get("typedWorkerEntries", []):
        target = entry_types.get(entry.get("valueType"))
        v.require(target == entry.get("expectedType"), "PAY-GOLD-014 typed worker mapping drift")
        try:
            parse_typed_wire(entry.get("value"), types[target])
            valid_pair = ((entry.get("valueType") == "MONEY" and re.fullmatch(r"[A-Z]{3}", entry.get("currency", "")) is not None)
                          or (entry.get("valueType") != "MONEY" and "currency" not in entry))
            v.require(valid_pair, f"PAY-GOLD-014 typed unit/currency pair drift: {entry.get('valueType')}")
        except (KeyError, ValueError) as exc:
            v.require(False, f"PAY-GOLD-014 typed input rejected: {exc}")
    zeros = [canonical_unquantized(value) for value in source.get("negativeZeroCases", [])]
    v.require(zeros == expected.get("negativeZeroOutputs") == ["0", "0", "0"],
              "PAY-GOLD-014 signed negative zero normalization drift")
    for value in source.get("invalidWireValues", []):
        try:
            parse_typed_wire(value, types["CalculationDecimal"])
            v.require(False, f"PAY-GOLD-014 invalid wire accepted: {value!r}")
        except ValueError:
            v.require(True, "invalid wire rejected")
    for value in source.get("invalidJsonNumbers", []):
        try:
            parse_typed_wire(value, types["CalculationDecimal"])
            v.require(False, f"PAY-GOLD-014 JSON number accepted: {value!r}")
        except ValueError:
            v.require(True, "JSON number rejected")
    v.require(len(source.get("invalidJsonNumbers", [])) >= 2
              and all(type(value) in {int, float} for value in source.get("invalidJsonNumbers", [])),
              "PAY-GOLD-014 JSON-number rejection corpus missing")
    for name, value in source.get("overflowCases", {}).items():
        try:
            parse_typed_wire(value, types[name])
            v.require(False, f"PAY-GOLD-014 {name} overflow accepted")
        except ValueError:
            v.require(True, f"{name} overflow rejected")
    mismatch_actual: list[str] = []
    for mismatch in source.get("mismatchCases", []):
        if "left" in mismatch:
            left, right = mismatch["left"], mismatch["right"]
            mismatch_actual.append("CROSS_CURRENCY_FORBIDDEN" if "amount" in left and left.get("currency") != right.get("currency") else "UNIT_MISMATCH")
        elif mismatch.get("unit") == "AMOUNT" and mismatch.get("currency") is None:
            mismatch_actual.append("CURRENCY_REQUIRED")
        else:
            mismatch_actual.append("CURRENCY_FORBIDDEN")
        v.require(mismatch_actual[-1] == mismatch.get("expected"), "PAY-GOLD-014 mismatch oracle drift")
    v.require(mismatch_actual == expected.get("mismatchOutcomes"), "PAY-GOLD-014 mismatch outcome list drift")
    trace = source.get("trace", [])
    required_trace = {"stage", "before", "after", "scale", "mode", "policyDigest"}
    for step in trace:
        v.require(set(step) == required_trace and step.get("stage") in inputs["decimal"].get("roundingPipeline", [])
                  and step.get("mode") in ROUNDING and isinstance(step.get("scale"), int)
                  and re.fullmatch(r"[0-9a-f]{64}", step.get("policyDigest", "")) is not None,
                  "PAY-GOLD-014 calculation trace contract drift")
    v.require(trace and canonical_unquantized(trace[0]["before"]) == trace[0]["after"],
              "PAY-GOLD-014 source normalization is not executable")
    for step in trace[1:]:
        v.require(quantize(step["before"], step["scale"], step["mode"]) == step["after"],
                  f"PAY-GOLD-014 trace rounding mismatch at {step.get('stage')}")
    canonical_a = {"amount": canonical_unquantized("1.00"), "zero": canonical_unquantized("-0.000")}
    canonical_b = {"amount": canonical_unquantized("1.0"), "zero": canonical_unquantized("0")}
    v.require(digest(canonical_a) == digest(canonical_b), "canonical decimal digest is not byte-identical")
    v.require(expected.get("roundingCasesAllMatch") is True
              and expected.get("floatingPointUsed") is False
              and expected.get("databaseRoundingUsed") is False
              and expected.get("traceHasBeforeAfterStageScaleModePolicyDigest") is True
              and expected.get("invalidWireOutcome") == "SCHEMA_INVALID"
              and expected.get("invalidJsonNumberOutcome") == "WIRE_TYPE_REQUIRED"
              and expected.get("overflowOutcome") == "DECIMAL_OVERFLOW"
              and expected.get("sameInputPolicyDigestByteIdentical") is True,
              "PAY-GOLD-014 expected execution contract drift")


def validate(inputs: dict[str, Any] | None = None) -> dict[str, Any]:
    data = copy.deepcopy(inputs if inputs is not None else load_inputs())
    v = Validation()
    try:
        validate_decimal_ssot(v, data["decimal"])
        validate_canonical_xcon(v, data)
        validate_source_handoffs(v, data)
        validate_ddl(v, data)
        validate_pay_consumer(v, data)
        validate_golden(v, data)
    except (KeyError, TypeError, ValueError, InvalidOperation) as exc:
        v.require(False, f"validator encountered incomplete contract: {exc}")
    return {
        "schema": "dwp.hris.decimal-money-contract-proof.v1",
        "status": "PASS" if not v.errors else "FAIL",
        "checks": v.checks,
        "coverage": {
            "valueTypes": len(data.get("decimal", {}).get("valueTypes", {})),
            "roundingModes": len(data.get("decimal", {}).get("requiredRoundingModes", [])),
            "largeStreamingContracts": 2,
            "payConsumerProjectionTables": len((data.get("pay_consumer", {}).get("consumedModernCapabilities") or [{}])[0].get("tables", [])),
            "goldenCase": "PAY-GOLD-014",
        },
        "states": {"implementation": "NOT_STARTED_G3", "production": "NOT_AUTHORIZED_G6"},
        "errors": v.errors,
    }


def self_test() -> dict[str, Any]:
    base = load_inputs()
    cases: list[dict[str, Any]] = []

    def rejected(name: str, mutate) -> None:
        candidate = copy.deepcopy(base)
        mutate(candidate)
        result = validate(candidate)
        cases.append({"name": name, "status": "PASS" if result["status"] == "FAIL" else "FAIL", "rejectedErrors": len(result["errors"])})

    rejected("json-number-wire", lambda d: d["decimal"]["serialization"].update({"wireType": "NUMBER"}))
    rejected("exponent-enabled", lambda d: d["decimal"]["valueTypes"]["InputAmount"].update({"jsonPattern": r"^-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$"}))
    rejected("database-rounding-enabled", lambda d: d["decimal"]["serialization"].update({"databaseRounding": "ALLOWED"}))
    rejected("precision-drift", lambda d: d["decimal"]["valueTypes"]["PostedMoney"].update({"precision": 18}))
    rejected("negative-zero-preserved", lambda d: d["decimal"]["serialization"].update({"negativeZero": "PRESERVE"}))
    rejected("xcon002-number", lambda d: d["canonical"]["$defs"]["XCON_002"]["properties"].update({"amount": {"type": "number"}}))
    rejected("closed-time-currency-binding", lambda d: d["canonical"]["$defs"]["ClosedTimeLine"]["x-unitCurrencyBinding"]["AMOUNT"].update({"currency": "FORBIDDEN_NULL"}))
    rejected("compensation-line-number", lambda d: d["canonical"]["$defs"]["ApprovedCompensationPlanLine"]["properties"].update({"approvedAmount": {"type": "number"}}))
    rejected("gateway-buffering", lambda d: d["canonical"]["$defs"]["XCON_020"]["x-streamingTransport"].update({"gatewayBuffering": "BUFFER_ALL"}))
    rejected("compressed-ceiling-missing", lambda d: d["canonical"]["$defs"]["XCON_008"]["x-streamingTransport"].pop("maxCompressedPayloadBytes"))
    rejected("sequence-gap-not-checked", lambda d: d["canonical"]["$defs"]["XCON_020"]["x-streamingTransport"].update({"sequenceValidation": "NONE"}))
    rejected("pay-tim-provider-drift", lambda d: by_name(d["tim_api"]["providedSnapshots"], "ClosedTimeResult.v1")["streamingTransport"].update({"backpressure": "UNBOUNDED"}))
    rejected("tim-amount-currency-ddl", lambda d: d.update({"tim_ddl": d["tim_ddl"].replace("unit = 'AMOUNT' AND currency_code <> 'XXX'", "unit = 'AMOUNT' AND currency_code = 'XXX'", 1)}))
    rejected("pay-projection-column-missing", lambda d: d["pay_consumer"]["consumedModernCapabilities"][0]["tables"][0]["physicalColumnContract"].pop())
    rejected("pay-projection-digest-typo", lambda d: next(column for column in d["pay_consumer"]["consumedModernCapabilities"][0]["tables"][0]["physicalColumnContract"] if column["name"] == "snapshot_payload_digest").update({"name": "payload_digest"}))
    rejected("pay-local-fk-missing", lambda d: d["pay_consumer"]["consumedModernCapabilities"][0]["tables"][1]["foreignKeys"].pop())
    rejected("golden-rounding-wrong", lambda d: next(case for case in d["golden"]["cases"] if case["id"] == "PAY-GOLD-014")["input"]["roundingCases"][0]["outputs"].__setitem__(0, "1.00"))
    rejected("golden-json-number-gap", lambda d: next(case for case in d["golden"]["cases"] if case["id"] == "PAY-GOLD-014")["input"].update({"invalidJsonNumbers": []}))
    return {
        "schema": "dwp.hris.decimal-money-contract-proof-self-test.v1",
        "status": "PASS" if all(case["status"] == "PASS" for case in cases) else "FAIL",
        "caseCount": len(cases),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    result = self_test() if args.self_test else validate()
    kwargs: dict[str, Any] = {"ensure_ascii": False, "sort_keys": True}
    if args.compact:
        kwargs["separators"] = (",", ":")
    else:
        kwargs["indent"] = 2
    print(json.dumps(result, **kwargs))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
