#!/usr/bin/env python3
"""Validate source-derived runtime ownership for generated HRIS contracts.

Generated DTO parity is only the transport boundary.  Every canonical
``DOMAIN_RUNTIME`` extension is separately assigned to the producer/consumer
slice that must implement and test the behavior.  The mapping below is an
independent policy oracle; it is not imported from the Java generator.
"""

from __future__ import annotations

import argparse
import copy
import csv
import json
import re
from pathlib import Path


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
REGISTER = ROOT / "coding-readiness/generated-contract-runtime-invariant-register.csv"
SLICES = ROOT / "coding-readiness/g3-slice-code-go-register.csv"
PLATFORM_BINDINGS = ROOT / "coding-readiness/platform-dependency-schema-binding-register.csv"
WORKTREES = G0 / "worktree-branch-register.csv"
SHA256 = re.compile(r"^[0-9a-f]{64}$")
HEADER = [
    "runtime_binding_id", "source_id", "schema_pointer", "member",
    "value_sha256", "contract_refs", "control_allocation_id",
    "producer_slice_bindings", "consumer_slice_bindings", "consumer_sessions",
    "acceptance_policy", "state",
]

EXPECTED_POINTER_MEMBERS = {
    "#/$defs/InputAmount/x-sqlType": {"$value"},
    "#/$defs/InputAmount/x-authoritativePointer": {"$value"},
    "#/$defs/InputAmount/x-exponentNotation": {"$value"},
    "#/$defs/InputAmount/x-negativeZero": {"$value"},
    "#/$defs/QuantityDecimal/x-sqlType": {"$value"},
    "#/$defs/QuantityDecimal/x-authoritativePointer": {"$value"},
    "#/$defs/QuantityDecimal/x-exponentNotation": {"$value"},
    "#/$defs/QuantityDecimal/x-negativeZero": {"$value"},
    "#/$defs/PostedMoneyAmount/x-sqlType": {"$value"},
    "#/$defs/PostedMoneyAmount/x-authoritativePointer": {"$value"},
    "#/$defs/PostedMoneyAmount/x-exponentNotation": {"$value"},
    "#/$defs/PostedMoneyAmount/x-negativeZero": {"$value"},
    "#/$defs/XCON_008/x-streamingTransport": {
        "wireVersion", "gatewayBuffering", "backpressure", "maxHeaderBytes",
        "maxLineBytes", "maxPayloadBytes", "maxCompressedPayloadBytes",
        "maxUncompressedPayloadBytes", "maxCompressionRatio", "byteAccounting",
        "sequenceValidation", "digest", "consumerIngest", "finalize", "failure",
    },
    "#/$defs/XCON_012/x-profile": {"$value"},
    "#/$defs/XCON_013/x-profile": {"$value"},
    "#/$defs/XCON_014/x-profile": {"$value"},
    "#/$defs/XCON_015/x-profile": {"$value"},
    "#/$defs/XCON_020/x-invariants": {"payMaterialization", "payloadDigest"},
    "#/$defs/XCON_020/x-streamingTransport": {
        "wireVersion", "gatewayBuffering", "backpressure", "maxHeaderBytes",
        "maxLineBytes", "maxPayloadBytes", "maxCompressedPayloadBytes",
        "maxUncompressedPayloadBytes", "maxCompressionRatio", "byteAccounting",
        "sequenceValidation", "digest", "consumerIngest", "finalize", "failure",
    },
    "#/$defs/PDX_001/x-invariants": {"effectiveRange", "publishedApproval", "resolution"},
    "#/$defs/PDX_002/x-invariants": {"source", "ordering", "consumer"},
    "#/$defs/PDX_003/x-invariants": {"ordering", "consumer"},
    "#/$defs/PDX_004/x-invariants": {"execution", "compatibility", "activation"},
    "#/$defs/PDX_005/x-invariants": {"idempotency", "dispatch", "retry"},
    "#/$defs/PDX_006/x-invariants": {"identity", "terminal", "retry", "counts"},
    "#/$defs/PDX_007/x-invariants": {"activation", "effectiveRange"},
    "#/$defs/PDX_008/x-invariants": {"idempotency", "execution", "secrets"},
    "#/$defs/PDX_009/x-invariants": {"terminal", "reconciliation"},
    "#/$defs/PDX_010/x-invariants": {"authority", "idempotency", "version"},
    "#/$defs/PDX_011/x-invariants": {
        "ordering", "idempotency", "domainGuard", "separation", "authority",
    },
    "#/$defs/PDX_012/x-invariants": {"idempotency", "policy", "privacy"},
    "#/$defs/PDX_013/x-invariants": {"ordering", "privacy"},
    "#/$defs/PDX_014/x-invariants": {"policy", "evidenceOnly", "privacy"},
}
EXPECTED_RUNTIME_MEMBER_COUNT = sum(
    len(members) for members in EXPECTED_POINTER_MEMBERS.values()
)

XCON_RUNTIME = {
    "XCON-008": ("HRIS-TIM", "BASE-TFR-TIM-007", "HRIS-PAY", "BASE-TFR-PAY-020"),
    "XCON-012": ("HRIS-PER", "BASE-TFR-PER-007", "HRIS-SYS", "BASE-TFR-SYS-012"),
    "XCON-013": ("HRIS-HRM", "BASE-TFR-HRM-003", "HRIS-SYS", "BASE-TFR-SYS-012"),
    "XCON-014": ("HRIS-TIM", "BASE-TFR-TIM-018", "HRIS-SYS", "BASE-TFR-SYS-012"),
    "XCON-015": ("HRIS-PAY", "BASE-TFR-PAY-015", "HRIS-SYS", "BASE-TFR-SYS-012"),
    "XCON-020": ("HRIS-PER", "MOD-PER-COMPPLAN", "HRIS-PAY", "BASE-TFR-PAY-016"),
}

PRIMITIVE_RUNTIME = {
    "InputAmount": (
        {"XCON-002", "XCON-008"},
        {
            "HRIS-HRM:BASE-TFR-HRM-011:XCON-002",
            "HRIS-TIM:BASE-TFR-TIM-007:XCON-008",
        },
        {
            "HRIS-PAY:BASE-TFR-PAY-021:XCON-002",
            "HRIS-PAY:BASE-TFR-PAY-020:XCON-008",
        },
    ),
    "QuantityDecimal": (
        {"XCON-008"}, {"HRIS-TIM:BASE-TFR-TIM-007:XCON-008"},
        {"HRIS-PAY:BASE-TFR-PAY-020:XCON-008"},
    ),
    "PostedMoneyAmount": (
        {"XCON-020"}, {"HRIS-PER:MOD-PER-COMPPLAN:XCON-020"},
        {"HRIS-PAY:BASE-TFR-PAY-016:XCON-020"},
    ),
}

PDX_PRIMARY = {
    **{f"PDX-{number:03d}": "BASE-TFR-SYS-007" for number in range(1, 4)},
    **{f"PDX-{number:03d}": "BASE-TFR-SYS-006" for number in range(4, 7)},
    **{f"PDX-{number:03d}": "BASE-TFR-SYS-008" for number in range(7, 10)},
    **{f"PDX-{number:03d}": "BASE-TFR-SYS-003" for number in range(10, 12)},
}
PDX_DEPENDENCY = {
    **{f"PDX-{number:03d}": "DEP-004" for number in range(1, 4)},
    **{f"PDX-{number:03d}": "DEP-005" for number in range(4, 7)},
    **{f"PDX-{number:03d}": "DEP-006" for number in range(7, 10)},
    **{f"PDX-{number:03d}": "DEP-014" for number in range(10, 12)},
    "PDX-012": "DEP-015",
    "PDX-013": "DEP-015",
    "PDX-014": "DEP-016",
}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def split_pipe(value: str) -> set[str]:
    return {item for item in value.split("|") if item}


def dependency_slice_bindings(
    slices: dict[str, dict[str, str]], dependency: str, contract: str,
) -> set[str]:
    return {
        f"{row.get('session_id', '')}:{slice_id}:{contract}"
        for slice_id, row in slices.items()
        if row.get("gate_status") == "OPEN_G3_CODE"
        and row.get("implementation_state") == "NOT_STARTED_G3"
        and dependency in split_pipe(row.get("dependency_ids", ""))
    }


def expected_roles(
    pointer: str, slices: dict[str, dict[str, str]],
) -> tuple[set[str], set[str], set[str]]:
    for primitive, expected in PRIMITIVE_RUNTIME.items():
        if pointer.startswith(f"#/$defs/{primitive}/"):
            return expected
    xcon_match = re.search(r"/XCON_(\d{3})/", pointer)
    if xcon_match:
        contract = f"XCON-{xcon_match.group(1)}"
        producer_session, producer_slice, consumer_session, consumer_slice = XCON_RUNTIME[contract]
        return (
            {contract},
            {f"{producer_session}:{producer_slice}:{contract}"},
            {f"{consumer_session}:{consumer_slice}:{contract}"},
        )
    pdx_match = re.search(r"/PDX_(\d{3})/", pointer)
    if not pdx_match:
        raise ValueError(f"unmapped runtime pointer: {pointer}")
    contract = f"PDX-{pdx_match.group(1)}"
    if contract in {"PDX-012", "PDX-013", "PDX-014"}:
        bindings = dependency_slice_bindings(
            slices, PDX_DEPENDENCY[contract], contract
        )
        if contract == "PDX-013":
            return {contract}, set(), bindings
        return {contract}, bindings, set()
    return {contract}, {f"HRIS-SYS:{PDX_PRIMARY[contract]}:{contract}"}, set()


def parse_binding(value: str) -> tuple[str, str, str] | None:
    parts = value.split(":")
    return tuple(parts) if len(parts) == 3 and all(parts) else None  # type: ignore[return-value]


def manifest_runtime_entries(path: Path) -> dict[tuple[str, str, str], str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    result: dict[tuple[str, str, str], str] = {}
    for binding in payload.get("extensionBindings", []):
        if not isinstance(binding, dict):
            continue
        classifications = binding.get("memberClassifications", {})
        if not isinstance(classifications, dict):
            continue
        for member, values in classifications.items():
            if isinstance(values, list) and "DOMAIN_RUNTIME" in values:
                key = (
                    str(binding.get("sourceId", "")),
                    str(binding.get("schemaPointer", "")),
                    str(member),
                )
                if key in result:
                    raise ValueError(f"duplicate DOMAIN_RUNTIME member: {key}")
                result[key] = str(binding.get("valueSha256", ""))
    return result


def validate_rows(
    header: list[str],
    rows: list[dict[str, str]],
    slices: dict[str, dict[str, str]],
    platform: dict[str, dict[str, str]],
    *,
    live_entries: dict[tuple[str, str, str], str] | None = None,
) -> list[str]:
    errors: list[str] = []
    require = lambda condition, message: None if condition else errors.append(message)
    require(header == HEADER, "runtime invariant register header drift")
    expected_keys = {
        (source, pointer, member)
        for pointer, members in EXPECTED_POINTER_MEMBERS.items()
        for member in members
        for source in ({"platform-dependency-v1"} if "/PDX_" in pointer else {"xcon-v1"})
    }
    observed_keys: set[tuple[str, str, str]] = set()
    ids: set[str] = set()
    for index, row in enumerate(rows, 1):
        key = (row.get("source_id", ""), row.get("schema_pointer", ""), row.get("member", ""))
        require(row.get("runtime_binding_id") == f"GCRUNTIME-{index:03d}", f"row {index}: ID/order drift")
        require(key not in observed_keys, f"row {index}: duplicate runtime member")
        observed_keys.add(key)
        ids.add(row.get("runtime_binding_id", ""))
        try:
            contracts, producers, consumers = expected_roles(key[1], slices)
        except (KeyError, ValueError) as error:
            errors.append(str(error))
            continue
        require(split_pipe(row.get("contract_refs", "")) == contracts, f"row {index}: contract role drift")
        require(split_pipe(row.get("producer_slice_bindings", "")) == producers, f"row {index}: producer slice drift")
        require(split_pipe(row.get("consumer_slice_bindings", "")) == consumers, f"row {index}: consumer slice drift")
        require(bool(SHA256.fullmatch(row.get("value_sha256", ""))), f"row {index}: value digest invalid")
        require(
            row.get("control_allocation_id") == "G3-CTL-BE-GENERATED-HRIS-CONTRACTS"
            and row.get("acceptance_policy") == "CONTROL_GENERATED_GUARD_PLUS_SLICE_RUNTIME_NEGATIVE_TEST"
            and row.get("state") == "ALLOCATED_G3_RUNTIME_NOT_IMPLEMENTED",
            f"row {index}: generated/runtime acceptance boundary drift",
        )
        pdx = next(iter(contracts)) if next(iter(contracts)).startswith("PDX-") else ""
        if pdx:
            binding = platform.get(pdx.replace("PDX-", "PDX_"), {})
            require(
                split_pipe(row.get("consumer_sessions", "")) == split_pipe(binding.get("consumers", "")),
                f"row {index}: platform consumer set drift",
            )
        else:
            require(
                split_pipe(row.get("consumer_sessions", ""))
                == {parse_binding(value)[0] for value in consumers if parse_binding(value)},
                f"row {index}: XCON consumer session drift",
            )
        for value in producers | consumers:
            parsed = parse_binding(value)
            require(parsed is not None, f"row {index}: malformed slice binding")
            if parsed is None:
                continue
            session, slice_id, contract = parsed
            slice_row = slices.get(slice_id, {})
            require(
                slice_row.get("session_id") == session
                and slice_row.get("gate_status") == "OPEN_G3_CODE"
                and slice_row.get("implementation_state") == "NOT_STARTED_G3",
                f"row {index}: runtime slice is missing, retired, or wrong owner",
            )
            if contract.startswith("XCON-"):
                field = "produced_xcon_refs" if value in producers else "consumed_xcon_refs"
                require(contract in split_pipe(slice_row.get(field, "")), f"row {index}: XCON role is not in slice authority")
            else:
                require(
                    PDX_DEPENDENCY[contract] in split_pipe(slice_row.get("dependency_ids", "")),
                    f"row {index}: PDX primary slice lacks its dependency",
                )
    require(
        len(rows) == len(expected_keys) and len(ids) == len(expected_keys),
        f"runtime invariant register must contain {len(expected_keys)} unique rows",
    )
    require(observed_keys == expected_keys, "DOMAIN_RUNTIME member universe has orphan/extra rows")
    if live_entries is not None:
        registered = {
            (row["source_id"], row["schema_pointer"], row["member"]): row["value_sha256"]
            for row in rows
        }
        require(live_entries == registered, "live codegen manifest DOMAIN_RUNTIME universe/digest drift")
    return sorted(set(errors))


def load_inputs() -> tuple[list[str], list[dict[str, str]], dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    header, rows = read_csv(REGISTER)
    _slice_header, slice_rows = read_csv(SLICES)
    _platform_header, platform_rows = read_csv(PLATFORM_BINDINGS)
    return (
        header,
        rows,
        {row.get("slice_id", ""): row for row in slice_rows},
        {row.get("schema_id", ""): row for row in platform_rows},
    )


def validate(check_live: bool) -> list[str]:
    header, rows, slices, platform = load_inputs()
    live_entries = None
    if check_live:
        _header, worktrees = read_csv(WORKTREES)
        control = next(
            (
                row for row in worktrees
                if row.get("session_id") == "CONTROL"
                and row.get("repository") == "DWP_BACKEND"
            ),
            {},
        )
        manifest = Path(control.get("worktree_path", "")) / "contracts/hris/canonical/hris-contract-codegen-manifest.v1.json"
        if not manifest.is_file() or manifest.is_symlink():
            return ["live canonical generated-contract manifest missing"]
        try:
            live_entries = manifest_runtime_entries(manifest)
        except (OSError, ValueError, json.JSONDecodeError) as error:
            return [f"live generated-contract manifest unreadable: {error}"]
    return validate_rows(header, rows, slices, platform, live_entries=live_entries)


def self_test() -> dict[str, object]:
    header, rows, slices, platform = load_inputs()
    cases: dict[str, bool] = {}
    cases["canonical-runtime-map-valid"] = not validate_rows(header, rows, slices, platform)
    omitted = copy.deepcopy(rows[:-1])
    cases["omitted-runtime-member-rejected"] = bool(validate_rows(header, omitted, slices, platform))
    duplicate = copy.deepcopy(rows)
    duplicate[-1] = copy.deepcopy(duplicate[0])
    cases["duplicate-runtime-member-rejected"] = bool(validate_rows(header, duplicate, slices, platform))
    rehomed = copy.deepcopy(rows)
    target = next(row for row in rehomed if "XCON_008" in row["schema_pointer"])
    target["producer_slice_bindings"] = "HRIS-TIM:BASE-TFR-TIM-008:XCON-008"
    cases["semantic-slice-rehome-rejected"] = bool(validate_rows(header, rehomed, slices, platform))
    wrong_digest = copy.deepcopy(rows)
    wrong_digest[0]["value_sha256"] = "0" * 64
    live = {
        (row["source_id"], row["schema_pointer"], row["member"]): row["value_sha256"]
        for row in rows
    }
    cases["live-value-digest-drift-rejected"] = bool(
        validate_rows(header, wrong_digest, slices, platform, live_entries=live)
    )
    wrong_role = copy.deepcopy(rows)
    wrong_role[0]["consumer_slice_bindings"] = "HRIS-PAY:BASE-TFR-PAY-013:XCON-002"
    cases["consumer-role-drift-rejected"] = bool(validate_rows(header, wrong_role, slices, platform))
    status = "PASS" if all(cases.values()) else "FAIL"
    return {
        "schema": "dwp.hris.generated-contract-runtime-invariant-self-test.v1",
        "status": status,
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check-live", action="store_true")
    mode.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        payload = self_test()
    else:
        errors = validate(args.check_live)
        payload = {
            "schema": "dwp.hris.generated-contract-runtime-invariant.v1",
            "status": "PASS" if not errors else "FAIL",
            "runtimeMemberCount": EXPECTED_RUNTIME_MEMBER_COUNT,
            "errors": errors,
        }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=None if args.compact else 2))
    return 0 if payload["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
