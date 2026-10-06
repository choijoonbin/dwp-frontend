#!/usr/bin/env python3
"""Validate G3 bounded module commands and Control-only root verification."""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
from pathlib import Path
from typing import Any

from validate_code_checkpoint import Checks, validate_command_catalog


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
CATALOG = G0 / "g3-verification-command-catalog.v1.json"


def validate_payload(
    payload: dict[str, object],
    slice_rows: list[dict[str, str]] | None = None,
) -> tuple[list[str], int]:
    checks = Checks()
    profiles = validate_command_catalog(
        checks,
        payload,
        validate_slice_bindings=True,
        slice_rows_override=slice_rows,
    )
    return checks.errors, len(profiles)


def self_test(canonical: dict[str, object]) -> dict[str, object]:
    canonical_errors, _count = validate_payload(canonical)
    cases: dict[str, bool] = {"canonical-catalog-valid": not canonical_errors}

    def rejected(name: str, mutate: Any) -> None:
        payload = copy.deepcopy(canonical)
        mutate(payload)
        errors, _profile_count = validate_payload(payload)
        cases[name] = bool(errors)

    def profile(payload: dict[str, object], profile_id: str) -> dict[str, object]:
        profiles = payload.get("profiles", [])
        return next(
            item
            for item in profiles
            if isinstance(item, dict) and item.get("profileId") == profile_id
        )

    rejected(
        "module-root-check-rejected",
        lambda payload: profile(payload, "G3CMD-HRM-BE")["commands"].append(
            {"commandKey": "root-check", "workingDirectory": ".", "argvTemplate": ["./gradlew", "check", "--no-daemon"]}
        ),
    )
    rejected(
        "wrong-working-directory-rejected",
        lambda payload: profile(payload, "G3CMD-PER-BE")["commands"][0].update(
            {"workingDirectory": "../"}
        ),
    )
    rejected(
        "unbounded-module-service-test-rejected",
        lambda payload: profile(payload, "G3CMD-TIM-BE")["commands"][0].update(
            {"argvTemplate": ["./gradlew", ":dwp-time-server:test", "--no-daemon"]}
        ),
    )
    rejected(
        "module-bootjar-whole-suite-rejected",
        lambda payload: profile(payload, "G3CMD-PAY-BE")["commands"][0].update(
            {"argvTemplate": ["./gradlew", ":dwp-payroll-server:bootJar", ":dwp-payroll-server:test", "--no-daemon"]}
        ),
    )
    rejected(
        "frontend-typed-wrapper-omission-rejected",
        lambda payload: profile(payload, "G3CMD-HRM-FE")["commands"][-1].update(
            {"receiptType": "GENERIC_EXIT_ZERO"}
        ),
    )
    rejected(
        "frontend-profile-omission-rejected",
        lambda payload: payload.update(
            {"profiles": [item for item in payload["profiles"] if item.get("profileId") != "G3CMD-PAY-FE"]}
        ),
    )
    rejected(
        "frontend-slice-placeholder-omission-rejected",
        lambda payload: profile(payload, "G3CMD-PER-FE")["commands"][-1].update(
            {"argvTemplate": ["/usr/bin/python3", str(G0 / "run_required_frontend_slice_test_gate.py"), "--project-dir", "."]}
        ),
    )
    rejected(
        "control-root-check-omission-rejected",
        lambda payload: profile(payload, "G3CMD-CONTROL-BE").update(
            {"commands": [command for command in profile(payload, "G3CMD-CONTROL-BE")["commands"] if command.get("commandKey") != "root-check"]}
        ),
    )
    rejected(
        "second-root-check-rejected",
        lambda payload: profile(payload, "G3CMD-SYS-BE")["commands"].append(
            {"commandKey": "root-check", "workingDirectory": ".", "argvTemplate": ["./gradlew", "check", "--no-daemon"], "appliesToMigrationAllocationIds": ["MIG-SYS-PLATFORM-262-290"]}
        ),
    )
    rejected(
        "listening-protected-profile-omission-rejected",
        lambda payload: payload.update(
            {"profiles": [item for item in payload["profiles"] if item.get("profileId") != "G3-SYS-LISTEN-PROTECTED-BE"]}
        ),
    )
    rejected(
        "listening-issuer-wrong-service-rejected",
        lambda payload: profile(payload, "G3-SYS-LISTEN-ISSUER-BE")["commands"][0]["argvTemplate"].__setitem__(1, ":dwp-platform-server:test"),
    )
    with (ROOT / "coding-readiness/g3-slice-code-go-register.csv").open(
        newline="", encoding="utf-8-sig"
    ) as handle:
        canonical_rows = list(csv.DictReader(handle))

    def rejected_slice(name: str, mutate: Any) -> None:
        rows = copy.deepcopy(canonical_rows)
        target = next(row for row in rows if row.get("gate_status") == "OPEN_G3_CODE")
        mutate(target)
        errors, _profile_count = validate_payload(canonical, rows)
        cases[name] = bool(errors)

    rejected_slice(
        "slice-frontend-profile-binding-omission-rejected",
        lambda row: row.update({"frontend_verification_profile_id": ""}),
    )
    rejected_slice(
        "slice-frontend-test-path-omission-rejected",
        lambda row: row.update({"frontend_test_path": ""}),
    )
    rejected_slice(
        "slice-wrong-frontend-test-path-rejected",
        lambda row: row.update(
            {"frontend_test_path": "apps/dwp/src/features/hris/people/__tests__/g3-slices/unrelated.slice.test.tsx"}
        ),
    )
    return {
        "schema": "dwp.hris.g3.verification-command-catalog-self-test.v1",
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
        payload = json.loads(CATALOG.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("catalog root must be an object")
        if args.self_test:
            result = self_test(payload)
        else:
            errors, profile_count = validate_payload(payload)
            result = {
                "schema": "dwp.hris.g3.verification-command-catalog-validation.v1",
                "status": "PASS" if not errors else "FAIL",
                "profileCount": profile_count,
                "rootCheckCount": sum(
                    1
                    for profile in payload.get("profiles", [])
                    if isinstance(profile, dict)
                    for command in profile.get("commands", [])
                    if isinstance(command, dict)
                    and command.get("argvTemplate") == ["./gradlew", "check", "--no-daemon"]
                ),
                "catalogSha256": hashlib.sha256(CATALOG.read_bytes()).hexdigest(),
                "errors": errors,
            }
    except (OSError, ValueError, json.JSONDecodeError) as error:
        result = {"schema": "dwp.hris.g3.verification-command-catalog-validation.v1", "status": "FAIL", "errors": [str(error)]}
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if result.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
