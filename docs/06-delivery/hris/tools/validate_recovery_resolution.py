#!/usr/bin/env python3
"""Validate G1 exact recovery supplements without mutating the raw recovery mirror."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path
from typing import Any


HRIS_ROOT = Path(__file__).resolve().parents[1]
RAW_ROOT = HRIS_ROOT / "recovery" / "hris-porting-blueprint-2026-09-09"
SUPPLEMENT_ROOT = (
    HRIS_ROOT
    / "recovery"
    / "exact-supplements"
    / "2026-10-06"
    / "hris-porting-blueprint-2026-09-09"
)

EXPECTED = {
    "hris-atomic-duty-matrix.csv": (
        "bc6a387b648be7ead865691653f647bd67f694b2bf3868e5d5eaad5dfab16caa",
        59593,
    ),
    "coding-readiness/target-family-resolution-register.csv": (
        "3e3618ff3ac150da8c9c7cbd3b1018e30e69652f28f3dbd8c87edb7df6a83819",
        38399,
    ),
    "coding-readiness/ia-entry-query-api-contract-register.csv": (
        "cb8d5b5ff815ab5de960025c491d8ac0b565cfda644898dee019967a0fd85bbe",
        99982,
    ),
    "coding-readiness/ia-entry-query-projection-schemas.v1.json": (
        "b185accd712216c39bf8a66f70cbbf0092a27a8c2c5e3d7457ecd4d511afa048",
        1523618,
    ),
    "coding-readiness/ia-entry-query-runtime-invariant-register.csv": (
        "3b9bd24be721fe1ea9ac11f011a840809dc154f459bd3e7d9288977a27586eda",
        51745,
    ),
    "coding-readiness/ia-entry-query-action-key-register.csv": (
        "19a12600eb11e4d6c7c6098ad7f44f8afb544a1d9c698c3d2305e9e8150b5b7e",
        78170,
    ),
}

EXPECTED_CLASSIFICATIONS = {
    "hris-atomic-duty-matrix.csv": "PIN_EXACT_CHECKPOINT",
    "coding-readiness/target-family-resolution-register.csv": "PIN_EXACT_CHECKPOINT",
    "coding-readiness/ia-entry-query-api-contract-register.csv": "PIN_EXACT_CHECKPOINT",
    "coding-readiness/ia-entry-query-projection-schemas.v1.json": "PIN_EXACT_CHECKPOINT",
    "coding-readiness/ia-entry-query-runtime-invariant-register.csv": "PIN_ERA_DETERMINISTIC_COMPANION",
    "coding-readiness/ia-entry-query-action-key-register.csv": "PIN_ERA_DETERMINISTIC_COMPANION",
}

EXPECTED_ACCEPTED = {
    "coding-readiness/ia-entry-query-api-contract-register.csv": (
        100020,
        "5f47efd33a1d5aa3d11a4d9fd5716cd4e35650e9fec0868ecb77c8c90a4cd988",
        "ACCEPTED_POST_PIN_SUCCESSOR_EXACT",
    ),
    "coding-readiness/ia-entry-query-runtime-invariant-register.csv": (
        51783,
        "fcdfd1a26d8fca2c8d9a2a8279a3c5a99844ba827aefe47cbac2210b8753f77a",
        "ACCEPTED_POST_PIN_DETERMINISTIC_COMPANION",
    ),
    "coding-readiness/sys-listening-stream-authority-successor.v1.json": (
        46420,
        "62f110f36a4d26dab7dda3051e6baf1a5872a475b8f2a83cee19f2cd950496b1",
        "ACCEPTED_POST_PIN_SUCCESSOR_EXACT",
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def split_refs(value: str) -> set[str]:
    return {item for item in value.split("|") if item and item != "NONE"}


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def main() -> int:
    failures: list[str] = []
    checks: dict[str, Any] = {}

    for relative, (expected_sha, expected_bytes) in EXPECTED.items():
        path = SUPPLEMENT_ROOT / relative
        require(path.is_file(), f"missing supplement: {relative}", failures)
        if not path.is_file():
            continue
        actual_sha = sha256(path)
        actual_bytes = path.stat().st_size
        require(actual_sha == expected_sha, f"sha mismatch: {relative}", failures)
        require(actual_bytes == expected_bytes, f"byte count mismatch: {relative}", failures)
        checks[relative] = {"sha256": actual_sha, "bytes": actual_bytes}

    supplement_manifest_path = SUPPLEMENT_ROOT.parent / "manifest.json"
    supplement_manifest = json.loads(supplement_manifest_path.read_text(encoding="utf-8"))
    require(
        supplement_manifest.get("rawRecoveryPolicy") == "IMMUTABLE_EVIDENCE_DO_NOT_OVERWRITE",
        "supplement raw-recovery policy mismatch",
        failures,
    )
    require(
        supplement_manifest.get("authorityScope")
        == "HISTORICAL_SYS_EXACT_BUSINESS_START_PIN_CHECKPOINT",
        "supplement authority scope must remain historical checkpoint only",
        failures,
    )
    manifest_prefix = "hris-porting-blueprint-2026-09-09/"
    manifest_artifacts = supplement_manifest.get("artifacts", [])
    require(len(manifest_artifacts) == 6, "supplement manifest must pin six artifacts", failures)
    manifest_by_relative = {
        item["path"][len(manifest_prefix) :]: item
        for item in manifest_artifacts
        if item.get("path", "").startswith(manifest_prefix)
    }
    require(
        set(manifest_by_relative) == set(EXPECTED),
        "supplement manifest path set mismatch",
        failures,
    )
    for relative, (expected_sha, expected_bytes) in EXPECTED.items():
        item = manifest_by_relative.get(relative)
        if not item:
            continue
        require(item.get("sha256") == expected_sha, f"manifest sha mismatch: {relative}", failures)
        require(item.get("bytes") == expected_bytes, f"manifest bytes mismatch: {relative}", failures)
        require(
            item.get("classification") == EXPECTED_CLASSIFICATIONS[relative],
            f"manifest classification mismatch: {relative}",
            failures,
        )

    raw_manifest_path = RAW_ROOT / "RECOVERY_MANIFEST.json"
    require(
        sha256(raw_manifest_path)
        == "3db0bae17ff7f50368e0dca051dee7de29f365d1b7149297fb66feb8e8a7341c",
        "raw recovery manifest digest drift",
        failures,
    )
    raw_manifest = json.loads(raw_manifest_path.read_text(encoding="utf-8"))
    raw_artifacts = raw_manifest.get("historicalArtifacts", [])
    require(
        raw_manifest.get("historicalArtifactCount") == 757 and len(raw_artifacts) == 757,
        "raw recovery manifest must retain 757 historical artifacts",
        failures,
    )
    raw_mismatches: list[str] = []
    for item in raw_artifacts:
        path = RAW_ROOT / item["path"]
        if (
            not path.is_file()
            or path.stat().st_size != item["bytes"]
            or sha256(path) != item["sha256"]
        ):
            raw_mismatches.append(item["path"])
    require(not raw_mismatches, "raw recovery mirror drift detected", failures)
    checks["rawRecoveryManifest"] = {
        "artifactCount": len(raw_artifacts),
        "pathSizeShaMatches": len(raw_artifacts) - len(raw_mismatches),
        "mismatches": raw_mismatches,
    }
    checks["supplementManifest"] = {
        "artifactCount": len(manifest_artifacts),
        "authorityScope": supplement_manifest.get("authorityScope"),
        "rawRecoveryPolicy": supplement_manifest.get("rawRecoveryPolicy"),
    }
    generator_evidence = supplement_manifest.get("reconstructionEvidence", {}).get(
        "iaAtomicGenerator", {}
    )
    generator_path = SUPPLEMENT_ROOT.parent / generator_evidence.get("generatorPath", "")
    replay_result_path = SUPPLEMENT_ROOT.parent / generator_evidence.get("replayResultPath", "")
    require(
        generator_path.is_file()
        and sha256(generator_path) == generator_evidence.get("generatorSha256"),
        "pin-era generator evidence drift",
        failures,
    )
    require(
        replay_result_path.is_file()
        and sha256(replay_result_path) == generator_evidence.get("replayResultSha256"),
        "IA replay result evidence drift",
        failures,
    )
    pin_replay_result = (
        json.loads(replay_result_path.read_text(encoding="utf-8"))
        if replay_result_path.is_file()
        else {}
    )
    require(pin_replay_result.get("status") == "PASS", "IA pin replay did not pass", failures)
    require(
        pin_replay_result.get("authorityScope")
        == "HISTORICAL_SYS_EXACT_BUSINESS_START_PIN_CHECKPOINT",
        "IA pin replay authority scope drift",
        failures,
    )
    evidence_input_mismatches = []
    for item in generator_evidence.get("inputs", []):
        path = RAW_ROOT / item["path"]
        if not path.is_file() or sha256(path) != item["sha256"]:
            evidence_input_mismatches.append(item["path"])
    require(not evidence_input_mismatches, "IA replay input evidence drift", failures)
    checks["companionReconstruction"] = {
        "generatorSha256": generator_evidence.get("generatorSha256"),
        "inputCount": len(generator_evidence.get("inputs", [])),
        "inputMismatches": evidence_input_mismatches,
        "replayResultSha256": generator_evidence.get("replayResultSha256"),
    }

    accepted_prefix = "accepted-successors/hris-porting-blueprint-2026-09-09/"
    accepted_artifacts = supplement_manifest.get("acceptedSuccessors", [])
    accepted_by_relative = {
        item["path"][len(accepted_prefix) :]: item
        for item in accepted_artifacts
        if item.get("path", "").startswith(accepted_prefix)
    }
    require(
        set(accepted_by_relative) == set(EXPECTED_ACCEPTED),
        "accepted successor manifest path set mismatch",
        failures,
    )
    accepted_root = SUPPLEMENT_ROOT.parent / "accepted-successors" / "hris-porting-blueprint-2026-09-09"
    for relative, (expected_bytes, expected_sha, expected_classification) in EXPECTED_ACCEPTED.items():
        item = accepted_by_relative.get(relative)
        path = accepted_root / relative
        require(path.is_file(), f"missing accepted successor: {relative}", failures)
        if not item or not path.is_file():
            continue
        require(path.stat().st_size == expected_bytes, f"accepted bytes mismatch: {relative}", failures)
        require(sha256(path) == expected_sha, f"accepted sha mismatch: {relative}", failures)
        require(item.get("bytes") == expected_bytes, f"accepted manifest bytes mismatch: {relative}", failures)
        require(item.get("sha256") == expected_sha, f"accepted manifest sha mismatch: {relative}", failures)
        require(
            item.get("classification") == expected_classification,
            f"accepted classification mismatch: {relative}",
            failures,
        )

    accepted_api = csv_rows(accepted_root / "coding-readiness/ia-entry-query-api-contract-register.csv")
    accepted_runtime = csv_rows(
        accepted_root / "coding-readiness/ia-entry-query-runtime-invariant-register.csv"
    )
    checkpoint_api = csv_rows(
        SUPPLEMENT_ROOT / "coding-readiness/ia-entry-query-api-contract-register.csv"
    )
    checkpoint_runtime = csv_rows(
        SUPPLEMENT_ROOT / "coding-readiness/ia-entry-query-runtime-invariant-register.csv"
    )
    accepted_diffs = {}
    for label, before_rows, after_rows in (
        ("api", checkpoint_api, accepted_api),
        ("runtime", checkpoint_runtime, accepted_runtime),
    ):
        before = {row["query_id"]: row for row in before_rows}
        after = {row["query_id"]: row for row in after_rows}
        require(set(before) == set(after), f"accepted {label} query set drift", failures)
        differences = {}
        for query_id in sorted(set(before) & set(after)):
            fields = sorted(
                key
                for key in set(before[query_id]) | set(after[query_id])
                if before[query_id].get(key) != after[query_id].get(key)
            )
            if fields:
                differences[query_id] = fields
        require(
            differences
            == {
                "IAQ-033": ["test_allocation_id"],
                "IAQ-065": ["test_allocation_id"],
            },
            f"accepted {label} difference set drift",
            failures,
        )
        accepted_diffs[label] = differences

    accepted_replay = supplement_manifest.get("reconstructionEvidence", {}).get(
        "acceptedIaSuccessor", {}
    )
    accepted_replay_result = SUPPLEMENT_ROOT.parent / accepted_replay.get("replayResultPath", "")
    require(
        accepted_replay_result.is_file()
        and sha256(accepted_replay_result) == accepted_replay.get("replayResultSha256"),
        "accepted IA replay result evidence drift",
        failures,
    )
    accepted_replay_payload = (
        json.loads(accepted_replay_result.read_text(encoding="utf-8"))
        if accepted_replay_result.is_file()
        else {}
    )
    require(
        accepted_replay_payload.get("status") == "PASS",
        "accepted IA replay did not pass",
        failures,
    )
    require(
        accepted_replay_payload.get("authorityScope") == "ACCEPTED_POST_PIN_SUCCESSOR",
        "accepted IA replay authority scope drift",
        failures,
    )
    require(
        accepted_replay_payload.get("changedFromHistoricalPin")
        == ["IAQ-033.test_allocation_id", "IAQ-065.test_allocation_id"],
        "accepted IA replay change set drift",
        failures,
    )

    listening_path = (
        accepted_root / "coding-readiness/sys-listening-stream-authority-successor.v1.json"
    )
    listening = json.loads(listening_path.read_text(encoding="utf-8"))
    stored_listening_seal = listening.get("sealedPayloadSha256")
    unsigned_listening = {
        key: value for key, value in listening.items() if key != "sealedPayloadSha256"
    }
    computed_listening_seal = hashlib.sha256(
        json.dumps(
            unsigned_listening,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    expected_listening_seal = (
        supplement_manifest.get("reconstructionEvidence", {})
        .get("acceptedListeningSuccessor", {})
        .get("sealedPayloadSha256")
    )
    require(
        stored_listening_seal
        == computed_listening_seal
        == expected_listening_seal
        == "45973285a659239b080bb89cbb60d2ccd34899a44edea776461364643f525804",
        "accepted Listening successor self-seal mismatch",
        failures,
    )
    checks["acceptedSuccessors"] = {
        "artifactCount": len(accepted_artifacts),
        "iaDifferenceSet": accepted_diffs,
        "replayResultSha256": accepted_replay.get("replayResultSha256"),
        "listeningSelfSeal": computed_listening_seal,
    }

    atomic = csv_rows(SUPPLEMENT_ROOT / "hris-atomic-duty-matrix.csv")
    atomic_ids = [row["duty_code"] for row in atomic]
    require(len(atomic) == 128, "atomic duty row count must be 128", failures)
    require(len(set(atomic_ids)) == 128, "atomic duty_code values must be unique", failures)

    packages = csv_rows(RAW_ROOT / "hris-permission-group-matrix.csv")
    package_refs = set().union(*(split_refs(row["atomic_duty_codes"]) for row in packages))
    require(package_refs == set(atomic_ids), "permission package duty set must equal atomic set", failures)

    modern = [
        row
        for row in atomic
        if row["current_source_evidence"].startswith("modern-capability-trace-register.csv#")
    ]
    ia = [
        row
        for row in atomic
        if row["current_source_evidence"].startswith(
            "coding-readiness/ia-entry-query-projection-register.csv#"
        )
    ]
    require(len(modern) == 48, "modern atomic duty count must be 48", failures)
    require(len(ia) == 13, "IA atomic duty count must be 13", failures)
    require(len(atomic) - len(modern) - len(ia) == 67, "base duty count must be 67", failures)

    target_families = csv_rows(
        SUPPLEMENT_ROOT / "coding-readiness/target-family-resolution-register.csv"
    )
    require(len(target_families) == 86, "target-family row count must be 86", failures)
    require(
        len({row["resolution_id"] for row in target_families}) == 86,
        "target-family resolution_id values must be unique",
        failures,
    )

    api = csv_rows(
        SUPPLEMENT_ROOT / "coding-readiness/ia-entry-query-api-contract-register.csv"
    )
    runtime = csv_rows(
        SUPPLEMENT_ROOT / "coding-readiness/ia-entry-query-runtime-invariant-register.csv"
    )
    actions = csv_rows(
        SUPPLEMENT_ROOT / "coding-readiness/ia-entry-query-action-key-register.csv"
    )
    schemas = json.loads(
        (
            SUPPLEMENT_ROOT
            / "coding-readiness/ia-entry-query-projection-schemas.v1.json"
        ).read_text(encoding="utf-8")
    )
    api_ids = {row["query_id"] for row in api}
    runtime_ids = {row["query_id"] for row in runtime}
    projection_ids = set(schemas["projections"])
    require(len(api) == 66 and len(api_ids) == 66, "IA API query count must be 66", failures)
    require(
        len(runtime) == 66 and runtime_ids == api_ids,
        "IA runtime query set must equal API query set",
        failures,
    )
    require(
        schemas.get("projectionCount") == 66 and projection_ids == api_ids,
        "IA schema projection set must equal API query set",
        failures,
    )
    action_ids = [row["action_key"] for row in actions]
    require(len(actions) == 202, "IA action row count must be 202", failures)
    require(len(set(action_ids)) == 202, "IA action_key values must be unique", failures)
    referenced_actions = set().union(*(split_refs(row["action_keys"]) for row in api))
    require(
        referenced_actions <= set(action_ids),
        "every API action reference must exist in the action register",
        failures,
    )

    sys_pin = json.loads(
        (RAW_ROOT / "coding-readiness/sys-exact-business-start-pin.v1.json").read_text(
            encoding="utf-8"
        )
    )
    pin_by_path = {item["path"]: item for item in sys_pin["artifactPins"]}
    for relative in (
        "hris-atomic-duty-matrix.csv",
        "coding-readiness/target-family-resolution-register.csv",
        "coding-readiness/ia-entry-query-api-contract-register.csv",
        "coding-readiness/ia-entry-query-projection-schemas.v1.json",
    ):
        expected_sha, expected_bytes = EXPECTED[relative]
        pin = pin_by_path.get(relative)
        require(pin is not None, f"missing SYS exact pin: {relative}", failures)
        if pin:
            require(pin["sha256"] == expected_sha, f"SYS pin sha mismatch: {relative}", failures)
            require(pin["byteCount"] == expected_bytes, f"SYS pin bytes mismatch: {relative}", failures)

    checks["atomicComposition"] = {
        "total": len(atomic),
        "base": len(atomic) - len(modern) - len(ia),
        "modern": len(modern),
        "ia": len(ia),
        "permissionReferenceSetEqual": package_refs == set(atomic_ids),
    }
    checks["targetFamilyCount"] = len(target_families)
    checks["iaBundle"] = {
        "queries": len(api),
        "runtimeRows": len(runtime),
        "projections": len(projection_ids),
        "actions": len(actions),
        "referencedActions": len(referenced_actions),
    }
    result = {"status": "PASS" if not failures else "FAIL", "checks": checks, "failures": failures}
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
