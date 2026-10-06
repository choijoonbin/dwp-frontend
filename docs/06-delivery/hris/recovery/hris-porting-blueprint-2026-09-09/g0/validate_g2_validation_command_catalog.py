#!/usr/bin/env python3
"""Validate the closed, repository-relative G2 command catalog."""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import re
from pathlib import Path
from typing import Any


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
CATALOG = G0 / "g2-validation-command-catalog.v1.json"
SLICE_REGISTER = ROOT / "coding-readiness/g3-slice-code-go-register.csv"
MODULES = ("HRM", "PER", "PAY", "TIM", "SYS")
PROFILE_IDS = {
    *(f"G2-{module}-BASE" for module in MODULES),
    *(f"G2-{module}-MODERN" for module in MODULES),
    "G2-CONTROL-MODERN-PG16-18",
}
RECEIPT_CONTRACT = {
    "schema": "dwp.hris.g2.validation-command-receipt.v1",
    "requiredFields": [
        "schema", "profileId", "ownerSessionId", "repository",
        "workingDirectory", "catalogSha256", "commands", "overallStatus",
    ],
    "commandRequiredFields": [
        "commandKey", "argvSha256", "exitCode", "outputSha256",
        "expectedPassMarker", "markerMatched", "status",
    ],
    "passStatus": "PASS",
}
BASE_COMMANDS = {
    "HRM": [
        ("hrm-readiness", ["python3", "session-evidence/hrm/g2-readiness/validate_hrm_readiness.py"], "HRM_READINESS=PASS"),
    ],
    "PER": [
        ("per-readiness", ["python3", "session-evidence/per/g2-readiness/validate_per_readiness.py"], "PER_READINESS=PASS"),
    ],
    "PAY": [
        ("pay-readiness", ["python3", "session-evidence/pay/validate_readiness.py"], "HRIS-PAY_READINESS=PASS"),
    ],
    "TIM": [
        ("tim-readiness", ["python3", "session-evidence/tim/validate_readiness.py"], "HRIS-TIM_READINESS=PASS"),
    ],
    "SYS": [
        ("sys-exact-readiness", ["python3", "session-evidence/sys/validate_sys_readiness.v2.py"], '"status": "PASS"'),
        ("sys-service-local-migrations", ["python3", "session-evidence/sys/validate_sys_service_local_migrations.py", "--compact"], '"status":"PASS"'),
    ],
}
MODERN_COMMANDS = [
    ("modern-static-normal", ["python3", "coding-readiness/validate_modern_capability_contracts.py", "--compact"], "MODERN_CAPABILITY_CONTRACTS=PASS"),
    ("modern-static-self-test", ["python3", "coding-readiness/validate_modern_capability_contracts.py", "--self-test", "--compact"], "MODERN_SCHEMA_NEGATIVE_SELF_TESTS=PASS"),
]
CONTROL_COMMANDS = [
    ("modern-schema-postgres-16", ["python3", "coding-readiness/validate_modern_capability_contracts.py", "--postgres-feasibility", "--compact"], "MODERN_POSTGRES_FEASIBILITY=PASS"),
    ("modern-causal-postgres-16-18", ["python3", "coding-readiness/validate_modern_causal_state_contracts.py", "--postgres-feasibility", "--compact"], "MODERN_CAUSAL_POSTGRES_DML=PASS postgres=16,18"),
]
SHA256 = re.compile(r"^[0-9a-f]{64}$")


def load_catalog() -> dict[str, Any]:
    payload = json.loads(CATALOG.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("catalog root must be an object")
    return payload


def expected_command(key: str, argv: list[str], marker: str) -> dict[str, Any]:
    return {
        "commandKey": key,
        "argv": argv,
        "expectedReceipt": {
            "schema": "dwp.hris.g2.validation-command-receipt.v1",
            "status": "PASS",
            "passMarker": marker,
        },
    }


def expected_profiles() -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for module in MODULES:
        result[f"G2-{module}-BASE"] = {
            "profileId": f"G2-{module}-BASE",
            "ownerSessionId": f"HRIS-{module}",
            "sourceKind": "BASE_TARGET_FAMILY",
            "executor": "MODULE",
            "semaphorePolicy": "NONE_STATIC_BLUEPRINT_ONLY",
            "commands": [expected_command(*command) for command in BASE_COMMANDS[module]],
        }
        result[f"G2-{module}-MODERN"] = {
            "profileId": f"G2-{module}-MODERN",
            "ownerSessionId": f"HRIS-{module}",
            "sourceKind": "MODERN_CAPABILITY",
            "executor": "MODULE",
            "semaphorePolicy": "NONE_STATIC_BLUEPRINT_ONLY",
            "commands": [expected_command(*command) for command in MODERN_COMMANDS],
        }
    result["G2-CONTROL-MODERN-PG16-18"] = {
        "profileId": "G2-CONTROL-MODERN-PG16-18",
        "ownerSessionId": "CONTROL",
        "sourceKind": "MODERN_CAPABILITY_CONTROL_FEASIBILITY",
        "executor": "INTEGRATION_CONTROL",
        "semaphorePolicy": "REQUIRED_EXCLUSIVE_HRIS_VERIFICATION",
        "commands": [expected_command(*command) for command in CONTROL_COMMANDS],
    }
    return result


def canonical_argv_sha256(argv: list[str]) -> str:
    return hashlib.sha256(
        json.dumps(argv, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def valid_typed_receipt(
    value: object,
    *,
    profile: dict[str, Any],
    catalog_sha256: str,
) -> bool:
    """Reject free-form, partial, skipped, or cross-profile G2 receipts."""
    if not isinstance(value, dict):
        return False
    top_fields = set(RECEIPT_CONTRACT["requiredFields"])
    command_fields = set(RECEIPT_CONTRACT["commandRequiredFields"])
    commands = value.get("commands")
    expected_commands = {
        str(command.get("commandKey", "")): command
        for command in profile.get("commands", [])
        if isinstance(command, dict)
    }
    if not isinstance(commands, list) or len(commands) != len(expected_commands):
        return False
    observed: set[str] = set()
    for receipt in commands:
        if not isinstance(receipt, dict) or set(receipt) != command_fields:
            return False
        key = str(receipt.get("commandKey", ""))
        expected = expected_commands.get(key)
        if expected is None or key in observed:
            return False
        observed.add(key)
        expected_receipt = expected.get("expectedReceipt", {})
        if not (
            receipt.get("argvSha256") == canonical_argv_sha256(expected.get("argv", []))
            and receipt.get("exitCode") == 0
            and not isinstance(receipt.get("exitCode"), bool)
            and isinstance(receipt.get("outputSha256"), str)
            and bool(SHA256.fullmatch(receipt["outputSha256"]))
            and receipt.get("expectedPassMarker") == expected_receipt.get("passMarker")
            and receipt.get("markerMatched") is True
            and receipt.get("status") == "PASS"
        ):
            return False
    return (
        set(value) == top_fields
        and value.get("schema") == RECEIPT_CONTRACT["schema"]
        and value.get("profileId") == profile.get("profileId")
        and value.get("ownerSessionId") == profile.get("ownerSessionId")
        and value.get("repository") == "BLUEPRINT"
        and value.get("workingDirectory") == "."
        and value.get("catalogSha256") == catalog_sha256
        and observed == set(expected_commands)
        and value.get("overallStatus") == "PASS"
    )


def validate_data(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    require = lambda condition, message: None if condition else errors.append(message)
    require(
        set(payload) == {"schema", "repository", "workingDirectory", "receiptContract", "profiles"},
        "catalog fields drift",
    )
    require(payload.get("schema") == "dwp.hris.g2.validation-command-catalog.v1", "catalog schema drift")
    require(payload.get("repository") == "BLUEPRINT", "repository must be BLUEPRINT")
    require(payload.get("workingDirectory") == ".", "working directory must be blueprint root '.'")
    require(payload.get("receiptContract") == RECEIPT_CONTRACT, "typed receipt contract drift")
    profiles = payload.get("profiles")
    require(isinstance(profiles, list), "profiles must be a list")
    if not isinstance(profiles, list):
        return sorted(set(errors))
    by_id = {
        str(profile.get("profileId", "")): profile
        for profile in profiles
        if isinstance(profile, dict)
    }
    require(len(by_id) == len(profiles), "profile IDs are blank, duplicated, or non-object")
    require(set(by_id) == PROFILE_IDS, "closed profile set drift")
    expected = expected_profiles()
    for profile_id, expected_profile in expected.items():
        profile = by_id.get(profile_id)
        require(profile == expected_profile, f"{profile_id}: exact profile contract drift")
        if not isinstance(profile, dict):
            continue
        commands = profile.get("commands", [])
        if not isinstance(commands, list):
            continue
        command_keys = [str(command.get("commandKey", "")) for command in commands if isinstance(command, dict)]
        require(len(command_keys) == len(commands) == len(set(command_keys)), f"{profile_id}: command keys duplicated or invalid")
        for command in commands:
            if not isinstance(command, dict):
                continue
            argv = command.get("argv")
            require(
                isinstance(argv, list)
                and bool(argv)
                and all(isinstance(item, str) and item for item in argv),
                f"{profile_id}: argv must be a non-empty string array",
            )
            if not isinstance(argv, list) or len(argv) < 2:
                continue
            path = Path(str(argv[1]))
            require(not path.is_absolute() and ".." not in path.parts, f"{profile_id}: command path escapes blueprint")
            require((ROOT / path).is_file(), f"{profile_id}: command target missing")
            if profile.get("executor") == "MODULE":
                require(
                    "--postgres-feasibility" not in argv
                    and "--docker-postgres" not in argv,
                    f"{profile_id}: module profile contains Control-only PostgreSQL command",
                )
    control = by_id.get("G2-CONTROL-MODERN-PG16-18", {})
    control_argv = [
        item
        for command in control.get("commands", [])
        if isinstance(command, dict)
        for item in command.get("argv", [])
    ] if isinstance(control, dict) else []
    require("--postgres-feasibility" in control_argv, "Control PG16/18 command missing")
    postgres_profiles = {
        profile_id
        for profile_id, profile in by_id.items()
        if isinstance(profile, dict)
        and any(
            "--postgres-feasibility" in command.get("argv", [])
            or "--docker-postgres" in command.get("argv", [])
            for command in profile.get("commands", [])
            if isinstance(command, dict)
        )
    }
    require(postgres_profiles == {"G2-CONTROL-MODERN-PG16-18"}, "PostgreSQL feasibility is not exactly Control-only")
    sys_keys = {
        command.get("commandKey")
        for command in by_id.get("G2-SYS-BASE", {}).get("commands", [])
        if isinstance(command, dict)
    }
    require(sys_keys == {"sys-exact-readiness", "sys-service-local-migrations"}, "SYS second exact validator omitted")
    return sorted(set(errors))


def validate_slice_bindings(
    payload: dict[str, Any],
    rows_override: list[dict[str, str]] | None = None,
) -> list[str]:
    errors: list[str] = []
    profiles = {
        str(profile.get("profileId", "")): profile
        for profile in payload.get("profiles", [])
        if isinstance(profile, dict)
    } if isinstance(payload.get("profiles"), list) else {}
    if rows_override is None:
        try:
            with SLICE_REGISTER.open(newline="", encoding="utf-8-sig") as handle:
                rows = list(csv.DictReader(handle))
        except OSError as error:
            return [f"slice register unreadable: {error}"]
    else:
        rows = rows_override
    referenced: set[str] = set()
    for row in rows:
        if row.get("gate_status") != "OPEN_G3_CODE":
            continue
        slice_id = row.get("slice_id", "")
        module = row.get("module", "")
        source_kind = row.get("source_kind", "")
        expected_profile_id = (
            f"G2-{module}-BASE"
            if source_kind == "BASE_TARGET_FAMILY"
            else f"G2-{module}-MODERN"
            if source_kind == "MODERN_CAPABILITY"
            else ""
        )
        profile_id = row.get("g2_validation_profile_id", "")
        referenced.add(profile_id)
        profile = profiles.get(profile_id, {})
        expected_keys = {
            str(command.get("commandKey", ""))
            for command in profile.get("commands", [])
            if isinstance(command, dict)
        } if isinstance(profile, dict) else set()
        observed_keys = {
            value for value in row.get("g2_validation_command_keys", "").split("|") if value
        }
        if not (
            expected_profile_id
            and profile_id == expected_profile_id
            and profile.get("ownerSessionId") == row.get("session_id")
            and profile.get("executor") == "MODULE"
        ):
            errors.append(f"{slice_id}: G2 profile binding missing, cross-owner, or source-kind drift")
        if not observed_keys or observed_keys != expected_keys:
            errors.append(f"{slice_id}: G2 command-key binding is not the exact profile set")
        if not row.get("g2_validation_command_display_non_authoritative", "").startswith(
            "DERIVED_NON_AUTHORITATIVE:"
        ):
            errors.append(f"{slice_id}: G2 raw command display is not non-authoritative")
    if "G2-CONTROL-MODERN-PG16-18" in referenced:
        errors.append("module slice binds Control-only PostgreSQL G2 profile")
    return sorted(set(errors))


def self_test(canonical: dict[str, Any]) -> dict[str, Any]:
    cases: dict[str, bool] = {
        "canonical-closed-catalog-valid": not (
            validate_data(canonical) or validate_slice_bindings(canonical)
        )
    }

    def rejected(name: str, mutate: Any) -> None:
        payload = copy.deepcopy(canonical)
        mutate(payload)
        cases[name] = bool(validate_data(payload))

    def profile(payload: dict[str, Any], profile_id: str) -> dict[str, Any]:
        return next(item for item in payload["profiles"] if item["profileId"] == profile_id)

    rejected("wrong-repository-rejected", lambda p: p.update({"repository": "DWP_BACKEND"}))
    rejected("wrong-cwd-rejected", lambda p: p.update({"workingDirectory": "../"}))
    rejected("module-postgres-rejected", lambda p: profile(p, "G2-HRM-MODERN")["commands"][0]["argv"].append("--postgres-feasibility"))
    rejected("control-postgres-owner-rejected", lambda p: profile(p, "G2-CONTROL-MODERN-PG16-18").update({"ownerSessionId": "HRIS-SYS"}))
    rejected("control-postgres-semaphore-rejected", lambda p: profile(p, "G2-CONTROL-MODERN-PG16-18").update({"semaphorePolicy": "NONE"}))
    rejected("control-pg18-command-omission-rejected", lambda p: profile(p, "G2-CONTROL-MODERN-PG16-18").update({"commands": profile(p, "G2-CONTROL-MODERN-PG16-18")["commands"][:1]}))
    rejected("sys-second-validator-omission-rejected", lambda p: profile(p, "G2-SYS-BASE").update({"commands": profile(p, "G2-SYS-BASE")["commands"][:1]}))
    rejected("raw-shell-command-rejected", lambda p: profile(p, "G2-PAY-BASE")["commands"][0].update({"argv": "python3 validate.py"}))
    rejected("receipt-type-drift-rejected", lambda p: p["receiptContract"].update({"schema": "free-form"}))
    rejected("modern-self-test-omission-rejected", lambda p: profile(p, "G2-TIM-MODERN").update({"commands": profile(p, "G2-TIM-MODERN")["commands"][:1]}))
    receipt_profile = profile(canonical, "G2-HRM-BASE")
    catalog_sha256 = hashlib.sha256(CATALOG.read_bytes()).hexdigest()
    typed_receipt: dict[str, Any] = {
        "schema": "dwp.hris.g2.validation-command-receipt.v1",
        "profileId": "G2-HRM-BASE",
        "ownerSessionId": "HRIS-HRM",
        "repository": "BLUEPRINT",
        "workingDirectory": ".",
        "catalogSha256": catalog_sha256,
        "commands": [
            {
                "commandKey": "hrm-readiness",
                "argvSha256": canonical_argv_sha256(receipt_profile["commands"][0]["argv"]),
                "exitCode": 0,
                "outputSha256": "1" * 64,
                "expectedPassMarker": "HRM_READINESS=PASS",
                "markerMatched": True,
                "status": "PASS",
            }
        ],
        "overallStatus": "PASS",
    }
    cases["exact-typed-receipt-accepted"] = valid_typed_receipt(
        typed_receipt, profile=receipt_profile, catalog_sha256=catalog_sha256
    )
    wrong_owner_receipt = copy.deepcopy(typed_receipt)
    wrong_owner_receipt["ownerSessionId"] = "HRIS-PAY"
    cases["cross-owner-receipt-rejected"] = not valid_typed_receipt(
        wrong_owner_receipt, profile=receipt_profile, catalog_sha256=catalog_sha256
    )
    marker_only_receipt = copy.deepcopy(typed_receipt)
    marker_only_receipt["commands"][0]["exitCode"] = 1
    cases["marker-only-failed-receipt-rejected"] = not valid_typed_receipt(
        marker_only_receipt, profile=receipt_profile, catalog_sha256=catalog_sha256
    )
    with SLICE_REGISTER.open(newline="", encoding="utf-8-sig") as handle:
        canonical_rows = list(csv.DictReader(handle))

    def rejected_slice(name: str, mutate: Any) -> None:
        rows = copy.deepcopy(canonical_rows)
        target = next(row for row in rows if row.get("gate_status") == "OPEN_G3_CODE")
        mutate(target)
        cases[name] = bool(validate_slice_bindings(canonical, rows))

    rejected_slice(
        "slice-g2-profile-omission-rejected",
        lambda row: row.update({"g2_validation_profile_id": ""}),
    )
    rejected_slice(
        "slice-g2-command-key-omission-rejected",
        lambda row: row.update({"g2_validation_command_keys": ""}),
    )
    rejected_slice(
        "slice-g2-control-pg-profile-rejected",
        lambda row: row.update(
            {
                "g2_validation_profile_id": "G2-CONTROL-MODERN-PG16-18",
                "g2_validation_command_keys": "modern-causal-postgres-16-18|modern-schema-postgres-16",
            }
        ),
    )
    return {
        "schema": "dwp.hris.g2.validation-command-catalog-self-test.v1",
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
        payload = load_catalog()
        if args.self_test:
            result = self_test(payload)
        else:
            errors = validate_data(payload) + validate_slice_bindings(payload)
            result = {
                "schema": "dwp.hris.g2.validation-command-catalog-validation.v1",
                "status": "PASS" if not errors else "FAIL",
                "profileCount": len(payload.get("profiles", [])),
                "commandCount": sum(len(item.get("commands", [])) for item in payload.get("profiles", []) if isinstance(item, dict)),
                "catalogSha256": hashlib.sha256(CATALOG.read_bytes()).hexdigest(),
                "errors": errors,
            }
    except (OSError, ValueError, json.JSONDecodeError) as error:
        result = {"schema": "dwp.hris.g2.validation-command-catalog-validation.v1", "status": "FAIL", "errors": [str(error)]}
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if result.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
