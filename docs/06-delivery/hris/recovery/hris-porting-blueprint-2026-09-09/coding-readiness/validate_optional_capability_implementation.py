#!/usr/bin/env python3
"""Static fail-closed verifier for the optional-capability START implementation."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
MANIFEST_PATH = HERE / "optional-capability-implementation-manifest.v1.json"
CONTRACT_PATH = HERE / "optional-capability-admission-contract.v1.json"
MODULES = {"HRIS-HRM", "HRIS-PER", "HRIS-PAY", "HRIS-TIM", "HRIS-SYS"}
ROLES = {
    "decision", "error", "exception", "guard", "request", "authorized-binding",
    "descriptor", "install-state", "operation", "types", "version",
}
SHA256 = re.compile(r"[a-f0-9]{64}")
PRODUCTION_PREFIX = (
    "dwp-platform-contracts/src/main/java/"
    "com/dwp/platform/contracts/hris/capability/v1/"
)
EXPECTED_TEST_ROOT = {
    "HRIS-HRM": "dwp-people-server/",
    "HRIS-PER": "dwp-people-server/",
    "HRIS-PAY": "dwp-payroll-server/",
    "HRIS-TIM": "dwp-time-server/",
    "HRIS-SYS": "dwp-platform-server/",
}
GUARD_MARKERS = {
    "public final class OptionalCapabilityAdmissionGuardV1",
    "public OptionalCapabilityAdmissionDecisionV1 evaluate(",
    "public <T> T execute(",
    "DecisionKind.DENY_UNKNOWN_CAPABILITY",
    "UNKNOWN_OPERATION",
    "DecisionKind.DENY_UNINSTALLED",
    "DecisionKind.DENY_DISABLED",
    "DecisionKind.DENY_VERSION",
    "DecisionKind.DENY_MISSING_BINDING",
    "DecisionKind.DENY_MISSING_CAPABILITY",
    "UNAUTHORIZED_CONSUMER",
    "descriptor.forbiddenBindings()",
    "descriptor.consumers().contains(request.consumer())",
    "descriptor.preservedOperations()",
    "rejectForbiddenDependencyBindings(indexed)",
    "descriptor.capabilityPrerequisites()",
    "rejectCycles(indexed)",
    "installed.major() == required.major()",
    "installed.compareTo(required) >= 0",
    "throw new OptionalCapabilityAdmissionExceptionV1(decision.error())",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_digest(text: str) -> str:
    return digest(text.encode("utf-8"))


def load_sources(backend_root: Path, paths: set[str]) -> tuple[dict[str, str], list[str]]:
    sources: dict[str, str] = {}
    errors: list[str] = []
    for relative in sorted(paths):
        path = backend_root / relative
        try:
            sources[relative] = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exception:
            errors.append(f"cannot read {relative}: {exception}")
    return sources, errors


def validate(
        manifest: dict[str, Any],
        contract_bytes: bytes,
        sources: dict[str, str],
        actual_production_paths: set[str]) -> list[str]:
    errors: list[str] = []
    if manifest.get("schema") != "dwp.hris.optional-capability-implementation-manifest.v1":
        errors.append("manifest schema mismatch")
    if manifest.get("status") != "START_IMPLEMENTATION_EVIDENCE_PASS_G4_G6_NOT_AUTHORIZED":
        errors.append("implementation status overclaims or is stale")
    if manifest.get("gateEffect") != "NONE":
        errors.append("C3 implementation evidence must not open a coding gate")

    contract = manifest.get("contract", {})
    if contract.get("path") != CONTRACT_PATH.name:
        errors.append("contract path mismatch")
    if contract.get("sha256") != digest(contract_bytes):
        errors.append("contract digest mismatch")
    try:
        design = json.loads(contract_bytes)
    except json.JSONDecodeError as exception:
        errors.append(f"contract JSON invalid: {exception}")
        design = {}
    if design.get("schema") != "dwp.hris.optional-capability-admission-contract.v1":
        errors.append("design contract schema mismatch")
    if design.get("cyclePolicy") != "REJECT_CONFIGURATION":
        errors.append("design contract no longer rejects dependency cycles")
    if design.get("unknownPolicy") != "DENY_UNKNOWN_CAPABILITY_BEFORE_CALL":
        errors.append("design contract no longer rejects unknown capabilities before call")
    if design.get("versionPolicy") != "EXACT_MAJOR_AND_NO_DOWNGRADE":
        errors.append("design contract no longer rejects version drift/downgrade")
    if design.get("operationPolicy") != "EXACT_AFFECTED_OR_EXPLICIT_PRESERVED_OTHERWISE_DENY":
        errors.append("design contract allows an unregistered operation")
    boundary = design.get("implementationBoundary", {})
    if set(boundary) != {"START", "G4", "G6"}:
        errors.append("design stage boundary is not closed")

    production = manifest.get("productionSources", [])
    if not isinstance(production, list):
        errors.append("production source manifest must be a list")
        production = []
    roles = [row.get("role") for row in production if isinstance(row, dict)]
    paths = [row.get("path") for row in production if isinstance(row, dict)]
    if set(roles) != ROLES or len(roles) != len(ROLES):
        errors.append("production role closure mismatch")
    if len(paths) != len(set(paths)) or any(not isinstance(path, str) for path in paths):
        errors.append("production paths must be unique strings")
    declared_production_paths = {path for path in paths if isinstance(path, str)}
    if declared_production_paths != actual_production_paths:
        missing = sorted(declared_production_paths - actual_production_paths)
        extra = sorted(actual_production_paths - declared_production_paths)
        errors.append(f"production package closure mismatch missing={missing} extra={extra}")

    forbidden = manifest.get("forbiddenProductionMarkers", [])
    for row in production:
        if not isinstance(row, dict):
            errors.append("invalid production source row")
            continue
        path = row.get("path", "")
        text = sources.get(path)
        if text is None:
            continue
        if not path.startswith(PRODUCTION_PREFIX) or not path.endswith(".java"):
            errors.append(f"production source escaped owner-neutral package: {path}")
        if row.get("sha256") != source_digest(text):
            errors.append(f"production digest mismatch: {path}")
        public_type = row.get("publicType")
        if not isinstance(public_type, str) or f" {public_type}" not in text:
            errors.append(f"public type marker missing: {path}")
        expected_package = f'package {manifest.get("productionPackage")};'
        if expected_package not in text:
            errors.append(f"production package declaration mismatch: {path}")
        present_forbidden = [marker for marker in forbidden if marker in text]
        if present_forbidden:
            errors.append(f"runtime/provider wiring leaked into START source {path}: {present_forbidden}")

    guard_rows = [row for row in production if row.get("role") == "guard"]
    guard_text = sources.get(guard_rows[0].get("path"), "") if len(guard_rows) == 1 else ""
    for marker in sorted(GUARD_MARKERS):
        if marker not in guard_text:
            errors.append(f"shared guard semantic marker missing: {marker}")

    shared = manifest.get("sharedGuardTest", {})
    validate_test_row(shared, sources, errors, shared=True)

    consumers = manifest.get("consumerTests", [])
    if not isinstance(consumers, list):
        errors.append("consumer test manifest must be a list")
        consumers = []
    modules = [row.get("module") for row in consumers if isinstance(row, dict)]
    if set(modules) != MODULES or len(modules) != len(MODULES):
        errors.append("all-five consumer module closure mismatch")
    consumer_paths: set[str] = set()
    consumer_classes: set[str] = set()
    for row in consumers:
        if not isinstance(row, dict):
            errors.append("invalid consumer test row")
            continue
        path = row.get("path", "")
        module = row.get("module")
        class_name = row.get("className")
        if path in consumer_paths or class_name in consumer_classes:
            errors.append(f"consumer path/class is not distinct: {module}")
        consumer_paths.add(path)
        consumer_classes.add(class_name)
        if module in EXPECTED_TEST_ROOT and not path.startswith(EXPECTED_TEST_ROOT[module]):
            errors.append(f"consumer test is outside its actual service module: {module}")
        validate_test_row(row, sources, errors, shared=False)

    implementation_boundary = manifest.get("implementationBoundary", {})
    if set(implementation_boundary) != {"START", "G4", "G6"}:
        errors.append("implementation evidence stage boundary mismatch")
    else:
        if "only" not in implementation_boundary["START"]:
            errors.append("START boundary is not explicitly limited")
        if "remain unimplemented" not in implementation_boundary["G4"]:
            errors.append("G4 provider implementation is being overclaimed")
        if "remain unauthorized" not in implementation_boundary["G6"]:
            errors.append("G6 production activation is being overclaimed")
    return errors


def validate_test_row(
        row: dict[str, Any],
        sources: dict[str, str],
        errors: list[str],
        shared: bool) -> None:
    path = row.get("path", "")
    text = sources.get(path)
    label = "shared guard" if shared else str(row.get("module"))
    if text is None:
        errors.append(f"test source missing: {path}")
        return
    if row.get("sha256") != source_digest(text):
        errors.append(f"test digest mismatch: {path}")
    class_name = row.get("className")
    for marker in [f"class {class_name}", "guard.execute(", "assertThrows("]:
        if marker not in text:
            errors.append(f"{label} test marker missing: {marker}")
    for marker in row.get("requiredMarkers", []):
        if marker not in text:
            errors.append(f"{label} scenario marker missing: {marker}")
    if "@Disabled" in text:
        errors.append(f"{label} evidence test is disabled")
    if not shared:
        counter = row.get("zeroCallCounter")
        if not isinstance(counter, str) or f"assertEquals(0, {counter}.get());" not in text:
            errors.append(f"{label} exact zero-call witness missing")
        if "AtomicInteger" not in text:
            errors.append(f"{label} test lacks an observable provider-call counter")


def source_paths(manifest: dict[str, Any]) -> set[str]:
    paths = {
        row.get("path") for row in manifest.get("productionSources", [])
        if isinstance(row, dict) and isinstance(row.get("path"), str)
    }
    shared = manifest.get("sharedGuardTest", {})
    if isinstance(shared.get("path"), str):
        paths.add(shared["path"])
    paths.update(
        row.get("path") for row in manifest.get("consumerTests", [])
        if isinstance(row, dict) and isinstance(row.get("path"), str)
    )
    return paths


def self_test(
        manifest: dict[str, Any],
        contract_bytes: bytes,
        sources: dict[str, str],
        actual_production_paths: set[str]) -> tuple[int, int]:
    mutants: list[tuple[dict[str, Any], bytes, dict[str, str]]] = []

    changed = copy.deepcopy(manifest)
    changed["productionSources"][0]["sha256"] = "0" * 64
    mutants.append((changed, contract_bytes, copy.deepcopy(sources)))

    changed = copy.deepcopy(manifest)
    changed["productionSources"] = changed["productionSources"][1:]
    mutants.append((changed, contract_bytes, copy.deepcopy(sources)))

    changed = copy.deepcopy(manifest)
    changed["consumerTests"][1]["module"] = "HRIS-HRM"
    mutants.append((changed, contract_bytes, copy.deepcopy(sources)))

    changed_sources = copy.deepcopy(sources)
    hrm_path = manifest["consumerTests"][0]["path"]
    changed_sources[hrm_path] = changed_sources[hrm_path].replace(
        "assertEquals(0, atsCalls.get());", "assertEquals(1, atsCalls.get());")
    changed = copy.deepcopy(manifest)
    changed["consumerTests"][0]["sha256"] = source_digest(changed_sources[hrm_path])
    mutants.append((changed, contract_bytes, changed_sources))

    changed_sources = copy.deepcopy(sources)
    guard_path = next(row["path"] for row in manifest["productionSources"]
                      if row["role"] == "guard")
    changed_sources[guard_path] += "\n@Service\n"
    changed = copy.deepcopy(manifest)
    next(row for row in changed["productionSources"]
         if row["role"] == "guard")["sha256"] = source_digest(changed_sources[guard_path])
    mutants.append((changed, contract_bytes, changed_sources))

    changed_sources = copy.deepcopy(sources)
    changed_sources[guard_path] = changed_sources[guard_path].replace(
        "if (!descriptor.preservedOperations().contains(request.operation())) {",
        "if (false) {")
    changed = copy.deepcopy(manifest)
    next(row for row in changed["productionSources"]
         if row["role"] == "guard")["sha256"] = source_digest(changed_sources[guard_path])
    mutants.append((changed, contract_bytes, changed_sources))

    changed = copy.deepcopy(manifest)
    changed["implementationBoundary"]["G4"] = "provider implementation complete"
    mutants.append((changed, contract_bytes, copy.deepcopy(sources)))

    changed = copy.deepcopy(manifest)
    changed["contract"]["sha256"] = "f" * 64
    mutants.append((changed, contract_bytes, copy.deepcopy(sources)))

    changed_sources = copy.deepcopy(sources)
    shared_path = manifest["sharedGuardTest"]["path"]
    changed_sources[shared_path] = changed_sources[shared_path].replace(
        "DEPENDENCY_CYCLE", "CYCLE_NOT_TESTED")
    changed = copy.deepcopy(manifest)
    changed["sharedGuardTest"]["sha256"] = source_digest(changed_sources[shared_path])
    mutants.append((changed, contract_bytes, changed_sources))

    changed = copy.deepcopy(manifest)
    changed["gateEffect"] = "OPEN"
    mutants.append((changed, contract_bytes, copy.deepcopy(sources)))

    rejected = sum(bool(validate(candidate, contract, candidate_sources,
                                 actual_production_paths))
                   for candidate, contract, candidate_sources in mutants)
    return rejected, len(mutants)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend-root", type=Path)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    backend_root = args.backend_root or Path.cwd()
    backend_root = backend_root.resolve()
    if not (backend_root / "settings.gradle").is_file():
        parser.error("--backend-root must identify the DWP backend repository")

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    contract_bytes = CONTRACT_PATH.read_bytes()
    paths = source_paths(manifest)
    sources, read_errors = load_sources(backend_root, paths)
    actual_production_paths = {
        str(path.relative_to(backend_root))
        for path in (backend_root / PRODUCTION_PREFIX).glob("*.java")
    }
    baseline_errors = read_errors + validate(
        manifest, contract_bytes, sources, actual_production_paths)
    if args.self_test and not baseline_errors:
        rejected, mutation_count = self_test(
            manifest, contract_bytes, sources, actual_production_paths)
        errors = [] if rejected == mutation_count else [
            f"mutation rejection incomplete: {rejected}/{mutation_count}"]
    else:
        rejected = mutation_count = 0
        errors = baseline_errors

    artifact_digests = sorted(
        (path, source_digest(text)) for path, text in sources.items())
    aggregate = digest(json.dumps(
        artifact_digests, separators=(",", ":"), ensure_ascii=True).encode("utf-8"))
    result = {
        "schema": "dwp.hris.optional-capability-implementation-validation.v1",
        "status": "PASS" if not errors else "FAIL",
        "mode": "SELF_TEST" if args.self_test else "IMPLEMENTATION",
        "backendRoot": str(backend_root),
        "productionSourceCount": len(manifest.get("productionSources", [])),
        "consumerModuleCount": len(manifest.get("consumerTests", [])),
        "sharedTestCount": 1,
        "artifactAggregateSha256": aggregate,
        "mutationRejected": rejected if args.self_test else None,
        "mutationCount": mutation_count if args.self_test else None,
        "providerAdapters": "NOT_IMPLEMENTED_G4",
        "tenantActivation": "NOT_AUTHORIZED_G6",
        "gateEffect": "NONE",
        "errors": errors,
    }
    print(json.dumps(result, ensure_ascii=False,
                     separators=(",", ":") if args.compact else None,
                     indent=None if args.compact else 2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
