#!/usr/bin/env python3
"""Fail closed unless all 86 source target families resolve to exact G2 contracts."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import pathlib
import re
import sys
import tempfile
from collections import Counter, defaultdict
from typing import Any

HERE = pathlib.Path(__file__).resolve().parent
BLUEPRINT = HERE.parent
REGISTER = HERE / "target-family-resolution-register.csv"
SHARED = HERE / "shared-contract-catalog.csv"
API_PEP = HERE / "api-pep-binding-register.csv"
SERVICE_PEP = HERE / "service-api-auth-binding-register.csv"
CROSS = HERE / "cross-module-contract-register.csv"
PLATFORM = HERE / "platform-integration-binding-register.csv"
SYS_CATALOG = BLUEPRINT / "session-evidence/sys/g2-contract-catalog.csv"
BASELINES = BLUEPRINT / "g0/integration-baseline-manifest.csv"
MODULE_FILES = {
    module: BLUEPRINT / f"session-registers/hris-{module.lower()}-source-coverage.csv"
    for module in ("HRM", "PER", "TIM", "PAY", "SYS")
}
CHILD_FILES = {
    module: BLUEPRINT / f"session-evidence/{module.lower()}/g1-child-trace.csv"
    for module in MODULE_FILES
}
DECISIONS = {
    module: BLUEPRINT / f"session-evidence/{module.lower()}/g1-decision-log.csv"
    for module in MODULE_FILES
}
EXPECTED_FAMILY_COUNTS = {"HRM": 17, "PER": 16, "TIM": 19, "PAY": 21, "SYS": 13}
EXPECTED_SOURCE_ROWS = {"HRM": 583, "PER": 349, "TIM": 568, "PAY": 580, "SYS": 189}
EXPECTED_CHILD_ROWS = {"HRM": 1654, "PER": 1041, "TIM": 3566, "PAY": 3515, "SYS": 225}
EXPECTED_HOME_XCON = {
    "TFR-HRM-003": "XCON-013",
    "TFR-PER-007": "XCON-012",
}
# These three source-contamination children are deliberately retired from the
# generic core.  They are the only permitted child/parent capability mismatch;
# every field below is pinned so this exception cannot become a broad bypass.
EXPECTED_RETIRED_CHILD_OVERRIDES = {
    ("TIM", "TIM-CH-ADDSK-3B3746EBB5F6"): {
        "parentCapability": "TIM-PLATFORM-AUTOMATION",
        "childCapability": "TIM-CONNECTOR",
        "disposition": "RETIRE",
        "decisionId": "TIM-DEC-011",
    },
    ("PAY", "PAY-CH-ADDSK-B3CE3E42A24F"): {
        "parentCapability": "PAY-CONNECTOR",
        "childCapability": "PAY-RETIREMENT",
        "disposition": "RETIRE",
        "decisionId": "PAY-DEC-012",
    },
    ("PAY", "PAY-CH-ADDSK-C0B9748F4291"): {
        "parentCapability": "PAY-RETRO-OFFCYCLE",
        "childCapability": "PAY-RUN-PREPARE",
        "disposition": "RETIRE",
        "decisionId": "PAY-DEC-012",
    },
}
EXPECTED_HEADER = [
    "resolution_id", "module", "source_family_sha256", "source_capability_ids",
    "source_row_count", "resolution_refs", "primary_resolution_refs",
    "related_resolution_refs", "resolution_state", "consolidation_rationale",
    "source_register",
]
EXPECTED_SHARED_HEADER = [
    "contract_id", "owner_service", "method", "browser_path", "owner_path",
    "baseline_openapi_reference", "semantic_role", "status",
]


def read_csv(path: pathlib.Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def split_pipe(value: str) -> list[str]:
    return [item.strip() for item in value.split("|") if item.strip()]


def rel(path: pathlib.Path) -> str:
    return "../" + path.relative_to(BLUEPRINT).as_posix()


def source_families() -> tuple[
    dict[tuple[str, str], dict[str, Any]],
    dict[tuple[str, str], dict[str, str]],
    list[str],
]:
    families: dict[tuple[str, str], dict[str, Any]] = {}
    parents: dict[tuple[str, str], dict[str, str]] = {}
    errors: list[str] = []
    for module, path in MODULE_FILES.items():
        header, rows = read_csv(path)
        required = {"target_api_or_event", "target_capability_id", "decision_status"}
        if not required <= set(header):
            errors.append(f"{module}: source register header incomplete")
            continue
        if len(rows) != EXPECTED_SOURCE_ROWS[module]:
            errors.append(f"{module}: source row count drift")
        grouped: defaultdict[str, list[dict[str, str]]] = defaultdict(list)
        for row in rows:
            artifact_id = row.get("artifact_id", "")
            parent_key = (module, artifact_id)
            if not artifact_id or parent_key in parents:
                errors.append(f"{module}: blank or duplicate source artifact ID {artifact_id or 'BLANK'}")
            family_sha256 = hashlib.sha256(row["target_api_or_event"].encode("utf-8")).hexdigest()
            parents[parent_key] = {
                "capability": row["target_capability_id"],
                "decisionStatus": row["decision_status"],
                "familySha256": family_sha256,
            }
            grouped[row["target_api_or_event"]].append(row)
            if row["decision_status"] != "DECIDED":
                errors.append(f"{module}: undecided source row {row.get('artifact_id', 'UNKNOWN')}")
        if len(grouped) != EXPECTED_FAMILY_COUNTS[module]:
            errors.append(f"{module}: source target-family count drift actual={len(grouped)}")
        for family, items in grouped.items():
            digest = hashlib.sha256(family.encode("utf-8")).hexdigest()
            families[(module, digest)] = {
                "family": family,
                "capabilities": sorted({item["target_capability_id"] for item in items}),
                "rows": len(items),
                "sourceRegister": rel(path),
            }
    return families, parents, errors


def validate_child_transitive_closure(
    parents: dict[tuple[str, str], dict[str, str]],
    resolved_family_keys: set[tuple[str, str]],
) -> tuple[list[str], Counter[str], int, int]:
    """Resolve every G1 child through its source parent to an exact TFR row.

    `target_api_event_candidate` on a child is preserved characterization text,
    not a canonical implementation target.  The only authoritative route is
    child -> parent_artifact_id -> parent target family -> TFR resolution_refs.
    """
    errors: list[str] = []
    module_counts: Counter[str] = Counter()
    resolved = 0
    accepted_overrides = 0
    seen_children: set[tuple[str, str]] = set()
    referenced_parents: set[tuple[str, str]] = set()
    decision_ids = {
        module: {row["decision_id"] for row in read_csv(path)[1]}
        for module, path in DECISIONS.items()
    }
    required = {
        "child_id", "parent_artifact_id", "target_capability_candidate",
        "target_api_event_candidate", "disposition", "decision_status",
        "decision_id", "notes",
    }
    for module, path in CHILD_FILES.items():
        header, rows = read_csv(path)
        if not required <= set(header):
            errors.append(f"{module}: child trace header incomplete")
            continue
        if len(rows) != EXPECTED_CHILD_ROWS[module]:
            errors.append(
                f"{module}: child row count expected={EXPECTED_CHILD_ROWS[module]} actual={len(rows)}"
            )
        for row in rows:
            module_counts[module] += 1
            child_id = row["child_id"]
            child_key = (module, child_id)
            parent_key = (module, row["parent_artifact_id"])
            if not child_id or child_key in seen_children:
                errors.append(f"{module}: blank or duplicate child ID {child_id or 'BLANK'}")
                continue
            seen_children.add(child_key)
            parent = parents.get(parent_key)
            if parent is None:
                errors.append(f"{module}:{child_id}: orphan parent {row['parent_artifact_id']}")
                continue
            referenced_parents.add(parent_key)
            family_key = (module, parent["familySha256"])
            if family_key not in resolved_family_keys:
                errors.append(f"{module}:{child_id}: parent family has no exact TFR resolution")
                continue
            semantic_ok = True
            if parent["decisionStatus"] != "DECIDED" or row["decision_status"] != "DECIDED":
                errors.append(f"{module}:{child_id}: parent/child decision is not DECIDED")
                semantic_ok = False
            if row["decision_id"] not in decision_ids[module]:
                errors.append(f"{module}:{child_id}: unresolved decision ID {row['decision_id']}")
                semantic_ok = False
            parent_capability = parent["capability"]
            child_capability = row["target_capability_candidate"]
            if child_capability != parent_capability:
                expected = EXPECTED_RETIRED_CHILD_OVERRIDES.get(child_key)
                actual = {
                    "parentCapability": parent_capability,
                    "childCapability": child_capability,
                    "disposition": row["disposition"],
                    "decisionId": row["decision_id"],
                }
                if (
                    expected != actual
                    or "ADDSK_CLASSIFICATION=RETIRE_FROM_CORE" not in row["notes"]
                ):
                    errors.append(
                        f"{module}:{child_id}: child/parent capability family mismatch"
                    )
                    semantic_ok = False
                else:
                    accepted_overrides += 1
            elif child_key in EXPECTED_RETIRED_CHILD_OVERRIDES:
                errors.append(f"{module}:{child_id}: pinned retired override unexpectedly disappeared")
                semantic_ok = False
            if semantic_ok:
                resolved += 1

    missing_parents = sorted(set(parents) - referenced_parents)
    if missing_parents:
        errors.append(f"source parents without child trace actual={len(missing_parents)}")
    missing_overrides = sorted(set(EXPECTED_RETIRED_CHILD_OVERRIDES) - seen_children)
    if missing_overrides:
        errors.append(f"pinned retired child overrides missing actual={len(missing_overrides)}")
    if module_counts != Counter(EXPECTED_CHILD_ROWS):
        errors.append(f"module child totals drift actual={dict(module_counts)}")
    return errors, module_counts, resolved, accepted_overrides


def canonical_event_name(item: dict[str, Any]) -> str:
    """Prefer the version-preserving canonical name over transport aliases."""
    return str(item.get("name") or item.get("eventType") or item.get("type") or "")


def event_refs() -> set[str]:
    result: set[str] = set()
    hrm = json.loads((BLUEPRINT / "session-evidence/hrm/g2-readiness/api-event-contracts.v1.json").read_text(encoding="utf-8"))
    result.update(f"EVT-HRM:{item['eventType']}" for item in hrm.get("events", []))
    per_text = (BLUEPRINT / "session-evidence/per/g2-readiness/api-event-contracts.yaml").read_text(encoding="utf-8")
    result.update(f"EVT-PER:{name}" for name in re.findall(r"\b[A-Z][A-Za-z0-9]+\.v1\b", per_text))
    for module in ("TIM", "PAY"):
        payload = json.loads((BLUEPRINT / f"session-evidence/{module.lower()}/g2-api-event-contracts.json").read_text(encoding="utf-8"))
        for collection in ("consumedEvents", "providedEvents"):
            for item in payload.get(collection, []):
                name = canonical_event_name(item)
                if name:
                    result.add(f"EVT-{module}:{name}")
    return result


def backend_baseline() -> pathlib.Path:
    _, rows = read_csv(BASELINES)
    return next(pathlib.Path(row["integration_worktree"]) for row in rows if row["repository"] == "DWP_BACKEND")


def validate_shared(rows: list[dict[str, str]]) -> list[str]:
    errors: list[str] = []
    ids = [row["contract_id"] for row in rows]
    expected = {f"SHARED-API-{number:03d}" for number in range(1, 13)}
    if len(rows) != 12 or len(set(ids)) != 12 or set(ids) != expected:
        errors.append("shared contract catalog must contain exactly SHARED-API-001..012")
    baseline = backend_baseline()
    for line, row in enumerate(rows, 2):
        if row["status"] != "BASELINE_REUSE_VALIDATED":
            errors.append(f"shared line {line}: invalid status")
        try:
            file_part, pointer = row["baseline_openapi_reference"].split("#", 1)
            payload: Any = json.loads((baseline / file_part).read_text(encoding="utf-8"))
            for token in pointer.removeprefix("/").split("/"):
                payload = payload[token.replace("~1", "/").replace("~0", "~")]
            if row["method"].lower() not in payload:
                errors.append(f"shared line {line}: method missing from pinned OpenAPI")
        except (OSError, KeyError, ValueError, json.JSONDecodeError) as exc:
            errors.append(f"shared line {line}: baseline OpenAPI evidence invalid: {exc}")
    return errors


def validate() -> dict[str, Any]:
    errors: list[str] = []
    header, rows = read_csv(REGISTER)
    if header != EXPECTED_HEADER:
        errors.append(f"register header mismatch expected={EXPECTED_HEADER} actual={header}")
        rows = []
    shared_header, shared_rows = read_csv(SHARED)
    if shared_header != EXPECTED_SHARED_HEADER:
        errors.append("shared catalog header mismatch")
        shared_rows = []
    errors.extend(validate_shared(shared_rows))
    families, parents, family_errors = source_families()
    errors.extend(family_errors)

    expected_total = sum(EXPECTED_FAMILY_COUNTS.values())
    ids = [row["resolution_id"] for row in rows]
    keys = [(row["module"], row["source_family_sha256"]) for row in rows]
    if len(rows) != expected_total or len(set(ids)) != expected_total or len(set(keys)) != expected_total:
        errors.append("resolution register must contain 86 unique IDs and family keys")
    if set(keys) != set(families):
        errors.append(f"source target-family coverage drift missing={len(set(families)-set(keys))} extra={len(set(keys)-set(families))}")

    _, public_rows = read_csv(API_PEP)
    _, service_rows = read_csv(SERVICE_PEP)
    _, cross_rows = read_csv(CROSS)
    _, platform_rows = read_csv(PLATFORM)
    _, sys_rows = read_csv(SYS_CATALOG)
    refs = {
        *(row["binding_id"] for row in public_rows),
        *(row["binding_id"] for row in service_rows),
        *(row["contract_id"] for row in cross_rows),
        *(row["binding_id"] for row in platform_rows),
        *(row["contract_id"] for row in sys_rows),
        *(row["contract_id"] for row in shared_rows),
        *event_refs(),
    }
    refs.update(
        f"DECISION:{row['decision_id']}"
        for path in DECISIONS.values()
        for row in read_csv(path)[1]
    )

    resolved_source_rows = 0
    module_counts: Counter[str] = Counter()
    ref_type_counts: Counter[str] = Counter()
    primary_ref_locations: Counter[str] = Counter()
    for line, row in enumerate(rows, 2):
        module_counts[row["module"]] += 1
        expected_id = f"TFR-{row['module']}-{module_counts[row['module']]:03d}"
        if row["resolution_id"] != expected_id:
            errors.append(f"line {line}: resolution ID/order expected={expected_id}")
        source = families.get((row["module"], row["source_family_sha256"]))
        if source is None:
            continue
        resolved_source_rows += source["rows"]
        if split_pipe(row["source_capability_ids"]) != source["capabilities"]:
            errors.append(f"line {line}: source capability set drift")
        if row["source_row_count"] != str(source["rows"]):
            errors.append(f"line {line}: source row count drift")
        if row["source_register"] != source["sourceRegister"]:
            errors.append(f"line {line}: source register drift")
        row_refs = split_pipe(row["resolution_refs"])
        primary_refs = split_pipe(row["primary_resolution_refs"])
        related_refs = split_pipe(row["related_resolution_refs"])
        if not row_refs or len(row_refs) != len(set(row_refs)):
            errors.append(f"line {line}: blank or duplicate resolution refs")
        if (
            set(row_refs) != set(primary_refs) | set(related_refs)
            or set(primary_refs) & set(related_refs)
            or len(primary_refs) != len(set(primary_refs))
            or len(related_refs) != len(set(related_refs))
        ):
            errors.append(f"line {line}: primary/related resolution role partition drift")
        primary_ref_locations.update(primary_refs)
        missing = sorted(set(row_refs) - refs)
        if missing:
            errors.append(f"line {line}: unresolved exact contract refs {'|'.join(missing)}")
        expected_home_xcon = EXPECTED_HOME_XCON.get(row["resolution_id"])
        if expected_home_xcon and {
            reference for reference in row_refs if reference.startswith("XCON-")
        } != {expected_home_xcon}:
            errors.append(
                f"line {line}: home contribution producer/XCON semantic binding drift"
            )
        for reference in row_refs:
            ref_type_counts[reference.split(":", 1)[0].split("-", 1)[0]] += 1
        retired = source["family"] in {"NONE", "No target endpoint; replacement contract referenced by decision"}
        if retired:
            if (
                row["resolution_state"] != "RETIRED_DECIDED"
                or primary_refs
                or not all(ref.startswith("DECISION:") for ref in row_refs)
            ):
                errors.append(f"line {line}: retired family is not decision-only")
        else:
            if row["resolution_state"] != "RESOLVED_G2_CONTRACT":
                errors.append(f"line {line}: active family state drift")
            if all(ref.startswith(("EVT-", "DECISION:")) for ref in row_refs):
                errors.append(f"line {line}: active family has no callable shared or snapshot contract")
        if len(row["consolidation_rationale"].strip()) < 60:
            errors.append(f"line {line}: consolidation rationale is not explicit")

    if module_counts != Counter(EXPECTED_FAMILY_COUNTS):
        errors.append(f"module family totals drift actual={dict(module_counts)}")
    duplicate_primary = sorted(
        ref for ref, count in primary_ref_locations.items() if count != 1
    )
    if duplicate_primary:
        errors.append(
            f"primary target-family semantic refs must be globally unique actual={len(duplicate_primary)}"
        )
    if resolved_source_rows != 2269:
        errors.append(f"resolved source parent total expected=2269 actual={resolved_source_rows}")
    child_errors, child_counts, resolved_children, retired_child_overrides = (
        validate_child_transitive_closure(parents, set(keys))
    )
    errors.extend(child_errors)
    expected_child_total = sum(EXPECTED_CHILD_ROWS.values())
    if resolved_children != expected_child_total:
        errors.append(
            f"resolved source child total expected={expected_child_total} actual={resolved_children}"
        )
    if retired_child_overrides != len(EXPECTED_RETIRED_CHILD_OVERRIDES):
        errors.append(
            "intentional retired child override total "
            f"expected={len(EXPECTED_RETIRED_CHILD_OVERRIDES)} actual={retired_child_overrides}"
        )
    checks = {
        "exact86FamilyCoverage": set(keys) == set(families) and len(rows) == 86,
        "all2269SourceParentsResolved": resolved_source_rows == 2269,
        "all10001SourceChildrenTransitivelyResolved": resolved_children == expected_child_total,
        "childParentFamilyIntegrity": not any(
            token in error
            for error in errors
            for token in (
                "orphan parent", "without child trace", "capability family mismatch",
                "parent family has no exact TFR", "module child totals drift",
            )
        ),
        "childDecisionsResolved": not any(
            token in error
            for error in errors
            for token in ("parent/child decision", "unresolved decision ID")
        ),
        "onlyPinnedRetiredChildOverrides": (
            retired_child_overrides == len(EXPECTED_RETIRED_CHILD_OVERRIDES)
            and not any("retired override" in error for error in errors)
        ),
        "childCandidateIsNonCanonical": True,
        "exactContractReferencesResolve": not any("unresolved exact contract refs" in error for error in errors),
        "homeContributionProducerSemanticClosure": not any(
            "home contribution producer/XCON" in error for error in errors
        ),
        "primaryRelatedSemanticRoleClosure": not any(
            marker in error
            for error in errors
            for marker in ("primary/related resolution", "globally unique")
        ),
        "sharedBaselineOpenapiVerified": not any("shared line" in error for error in errors),
        "retiredFamiliesDecisionOnly": not any("retired family" in error for error in errors),
        "activeFamiliesCallable": not any("active family" in error for error in errors),
        "consolidationRationalePresent": not any("consolidation rationale" in error for error in errors),
        "registerIntegrity": not any(token in error for error in errors for token in ("header mismatch", "unique IDs", "resolution ID/order", "source capability", "source row", "source register")),
    }
    return {
        "schema": "dwp.hris.target-family-resolution.v1",
        "status": "PASS" if not errors else "FAIL",
        "checks": checks,
        "coverage": {
            "sourceParentRows": 2269,
            "resolvedSourceParentRows": resolved_source_rows,
            "sourceChildRows": expected_child_total,
            "resolvedSourceChildRows": resolved_children,
            "sourceChildRowsByModule": dict(child_counts),
            "intentionalRetiredChildOverrides": retired_child_overrides,
            "authoritativeChildResolutionPath": (
                "child.parent_artifact_id -> source parent target family -> "
                "target-family-resolution-register.resolution_refs"
            ),
            "nonCanonicalChildField": "target_api_event_candidate",
            "sourceTargetFamilies": 86,
            "resolvedTargetFamilies": len(rows),
            "byModule": dict(module_counts),
            "referenceTypeCounts": dict(sorted(ref_type_counts.items())),
        },
        "registerSha256": hashlib.sha256(REGISTER.read_bytes()).hexdigest(),
        "sharedCatalogSha256": hashlib.sha256(SHARED.read_bytes()).hexdigest(),
        "blockers": errors,
    }


def self_test() -> dict[str, Any]:
    """Prove representative register and baseline-evidence tampering fails closed."""
    global REGISTER, SHARED, CHILD_FILES
    original_register = REGISTER
    original_shared = SHARED
    original_child_files = CHILD_FILES
    results: dict[str, bool] = {}
    baseline = validate()
    results["baselinePasses"] = baseline["status"] == "PASS"
    results["versionPreservingEventNamePreferred"] = (
        canonical_event_name(
            {"name": "TimePeriodClosed.v1", "eventType": "TimePeriodClosed"}
        )
        == "TimePeriodClosed.v1"
    )
    with tempfile.TemporaryDirectory(prefix="hris-target-family-selftest-") as temp:
        temp_root = pathlib.Path(temp)
        try:
            bad_ref = temp_root / "bad-ref.csv"
            bad_ref.write_text(
                original_register.read_text(encoding="utf-8").replace("PLAT-003", "PLAT-999", 1),
                encoding="utf-8",
            )
            REGISTER = bad_ref
            outcome = validate()
            results["unknownContractRefRejected"] = (
                outcome["status"] == "FAIL"
                and any("unresolved exact contract refs" in item for item in outcome["blockers"])
            )

            bad_hash = temp_root / "bad-hash.csv"
            first_hash = original_register.read_text(encoding="utf-8").splitlines()[1].split(",")[2]
            bad_hash.write_text(
                original_register.read_text(encoding="utf-8").replace(first_hash, "0" * 64, 1),
                encoding="utf-8",
            )
            REGISTER = bad_hash
            outcome = validate()
            results["sourceFamilyDriftRejected"] = (
                outcome["status"] == "FAIL"
                and any("source target-family coverage drift" in item for item in outcome["blockers"])
            )

            bad_home = temp_root / "bad-home-xcon.csv"
            bad_home.write_text(
                original_register.read_text(encoding="utf-8").replace(
                    "SVC-PEP-HRM-006|XCON-013",
                    "SVC-PEP-HRM-006|XCON-012",
                    1,
                ),
                encoding="utf-8",
            )
            REGISTER = bad_home
            outcome = validate()
            results["homeContributionProducerSemanticDriftRejected"] = (
                outcome["status"] == "FAIL"
                and any(
                    "home contribution producer/XCON" in item
                    for item in outcome["blockers"]
                )
            )

            REGISTER = original_register
            bad_shared = temp_root / "bad-shared.csv"
            bad_shared.write_text(
                original_shared.read_text(encoding="utf-8").replace(
                    "SHARED-API-001,dwp-provider-server,GET,",
                    "SHARED-API-001,dwp-provider-server,DELETE,",
                    1,
                ),
                encoding="utf-8",
            )
            SHARED = bad_shared
            outcome = validate()
            results["sharedOpenapiMethodDriftRejected"] = (
                outcome["status"] == "FAIL"
                and any("method missing from pinned OpenAPI" in item for item in outcome["blockers"])
            )

            SHARED = original_shared
            for label, column, value, blocker in (
                ("orphanChildParentRejected", "parent_artifact_id", "ORPHAN-PARENT", "orphan parent"),
                ("childFamilyMismatchRejected", "target_capability_candidate", "INVALID-CAPABILITY", "capability family mismatch"),
            ):
                bad_child = temp_root / f"{label}.csv"
                child_header, child_rows = read_csv(original_child_files["HRM"])
                child_rows[0][column] = value
                with bad_child.open("w", encoding="utf-8", newline="") as handle:
                    writer = csv.DictWriter(handle, fieldnames=child_header)
                    writer.writeheader()
                    writer.writerows(child_rows)
                CHILD_FILES = {**original_child_files, "HRM": bad_child}
                outcome = validate()
                results[label] = (
                    outcome["status"] == "FAIL"
                    and any(blocker in item for item in outcome["blockers"])
                )
        finally:
            REGISTER = original_register
            SHARED = original_shared
            CHILD_FILES = original_child_files
    return {
        "schema": "dwp.hris.target-family-resolution-self-test.v1",
        "status": "PASS" if all(results.values()) else "FAIL",
        "checks": results,
        "blockers": [] if all(results.values()) else [
            key for key, passed in results.items() if not passed
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compact", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    try:
        result = self_test() if args.self_test else validate()
    except Exception as exc:
        result = {"schema": "dwp.hris.target-family-resolution.v1", "status": "FAIL", "checks": {}, "coverage": {}, "blockers": [f"validator execution error: {type(exc).__name__}: {exc}"]}
    json.dump(result, sys.stdout, ensure_ascii=False, indent=None if args.compact else 2)
    sys.stdout.write("\n")
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
