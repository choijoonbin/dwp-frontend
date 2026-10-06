#!/usr/bin/env python3
"""Fail-closed static evidence for the five owner-neutral identity ABI consumers."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path


BLUEPRINT = Path(__file__).resolve().parent.parent
BASELINE_MANIFEST = BLUEPRINT / "g0/integration-baseline-manifest.csv"
CANONICAL_SNAPSHOT = BLUEPRINT / "g0/blueprint-central-snapshot-manifest.v1.json"
DEFAULT_BACKEND = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend").resolve()
BACKEND_ENV = "DWP_BACKEND_C2_ROOT"
GIT_BINARY = "/usr/bin/git"
SHA40 = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")

CONSUMERS = {
    "HRM": {
        "path": "dwp-people-server/src/test/java/com/dwp/services/people/hris/identity/v1/IdentitySelfContextConsumerCompileTest.java",
        "package": "com.dwp.services.people.hris.identity.v1",
        "audience": "HRIS_HRM",
        "purpose": "SELF_PROFILE_READ",
    },
    "PER": {
        "path": "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/identity/v1/PerformanceIdentitySelfContextConsumerCompileTest.java",
        "package": "com.dwp.services.people.hris.performance.identity.v1",
        "audience": "HRIS_PER",
        "purpose": "SELF_PERFORMANCE_READ",
    },
    "PAY": {
        "path": "dwp-payroll-server/src/test/java/com/dwp/services/payroll/hris/identity/v1/IdentitySelfContextConsumerCompileTest.java",
        "package": "com.dwp.services.payroll.hris.identity.v1",
        "audience": "HRIS_PAY",
        "purpose": "SELF_PAY_READ",
    },
    "TIM": {
        "path": "dwp-time-server/src/test/java/com/dwp/services/time/hris/identity/v1/TimeIdentitySelfContextConsumerCompileTest.java",
        "package": "com.dwp.services.time.hris.identity.v1",
        "audience": "HRIS_TIM",
        "purpose": "SELF_ATTENDANCE_READ",
    },
    "SYS": {
        "path": "dwp-platform-server/src/test/java/com/dwp/services/platform/hris/identity/v1/PlatformIdentitySelfContextConsumerCompileTest.java",
        "package": "com.dwp.services.platform.hris.identity.v1",
        "audience": "HRIS_SYS",
        "purpose": "SELF_HRIS_HOME_READ",
    },
}

OWNER_PINS = {
    "dwp-auth-server/src/main/java/com/dwp/services/auth/hris/identity/v1/AuthPersonBindingQueryReaderV1.java": "a1f698e3280d6629fb71ed94d3f998403eecbadef8f92fc7fdbe0750fd148f12",
    "dwp-people-server/src/main/java/com/dwp/services/people/hris/identity/v1/NativeSelfContextQueryReaderV1.java": "9303e773d78b3b94d1bafefb6dcb474f24e101eee205ce6e6f105fb3d9492749",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/identity/v1/GuardedSelfContextPortV1.java": "c665723f366527687c9e3dec55cefd4534defdc8b0aecc596ada3ab15eb40735",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/identity/v1/GuardedSelfPersonPortV1.java": "fc8c01dfe60de405b37fa363b4f727ec3681dc67fda17b43daae93b82260a8b7",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/identity/v2/GuardedCurrentHrisAuthorizationPortV2.java": "b87b2cc6d461a8b23bbbb87596bcc2abc6d256593644b5364c67b976b771eb33",
    "dwp-people-server/src/main/java/com/dwp/services/people/hris/identity/v2/NativeHrisUserPolicyAdmissionPilotV2.java": "99ffbc173fbf56b7d662efe47100bad7c12839959642797e17c8a81d7fb8920f",
    "dwp-people-server/src/main/java/com/dwp/services/people/hris/identity/v3/NativeHrisUserRolePolicyAdmissionPilotV3.java": "63eb1bc46a3d41489707b5994cbed099c34f8c78eb4bcfd0234735567d5fd72c",
}

PURPOSE_FILE = "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/identity/v1/SelfContextPurposeV1.java"
CONSUMER_PINS = {
    "dwp-people-server/src/test/java/com/dwp/services/people/hris/identity/v1/IdentitySelfContextConsumerCompileTest.java": "f1b39380f0e46b437a245ec8b653e8195d812029bd835de7c83af0d8fbeff68b",
    "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/identity/v1/PerformanceIdentitySelfContextConsumerCompileTest.java": "efb06b489343ef01ab60714a1d8239a9e4102ee936adbfe05c3426d6bf318ae2",
    "dwp-payroll-server/src/test/java/com/dwp/services/payroll/hris/identity/v1/IdentitySelfContextConsumerCompileTest.java": "ef18080ea3ffdc694dc073d6d8abe676f07ac19d66f74bd37de7c82d4247cd56",
    "dwp-time-server/src/test/java/com/dwp/services/time/hris/identity/v1/TimeIdentitySelfContextConsumerCompileTest.java": "0b2c97cec9009cff582d95f0715aaa2db3fe6c73355f0d9475c9271f2dfcacc3",
    "dwp-platform-server/src/test/java/com/dwp/services/platform/hris/identity/v1/PlatformIdentitySelfContextConsumerCompileTest.java": "9b79e5bd151d2582d3be881d0a2d210d36f66e85d05825374b1a4ba6dd44ea43",
}
PURPOSE_PIN = "893993c2f9ec01f5d97f40fbf07347f6bc0ed180ebc73786758560b0ff3f2413"
IMPORT_RE = re.compile(r"^import\s+(?:static\s+)?([^;]+);", re.MULTILINE)
FORBIDDEN_DB = re.compile(
    r"org\.springframework\.jdbc|jakarta\.persistence|javax\.sql|JdbcTemplate|NamedParameterJdbcTemplate|"
    r"DataSource|EntityManager|createNativeQuery|prepareStatement|\.repository\.", re.IGNORECASE
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_manifest_snapshot_pin() -> list[str]:
    """Bind the moving baseline row to the canonical blueprint snapshot."""
    try:
        snapshot = json.loads(CANONICAL_SNAPSHOT.read_text(encoding="utf-8"))
        matches = [
            row for row in snapshot.get("files", [])
            if row.get("path") == "g0/integration-baseline-manifest.csv"
        ]
        if len(matches) != 1:
            return [f"BASELINE_SNAPSHOT_PIN_CARDINALITY:{len(matches)}"]
        pin = matches[0]
        actual_mode = f"{BASELINE_MANIFEST.stat().st_mode & 0o777:04o}"
        errors = []
        if pin.get("sha256") != sha256(BASELINE_MANIFEST):
            errors.append("BASELINE_MANIFEST_SNAPSHOT_DIGEST_DRIFT")
        if pin.get("size") != BASELINE_MANIFEST.stat().st_size:
            errors.append("BASELINE_MANIFEST_SNAPSHOT_SIZE_DRIFT")
        if pin.get("mode") != actual_mode:
            errors.append("BASELINE_MANIFEST_SNAPSHOT_MODE_DRIFT")
        return errors
    except (OSError, UnicodeError, json.JSONDecodeError, TypeError) as error:
        return [f"BASELINE_SNAPSHOT_PIN_UNREADABLE:{error}"]


def read_backend_baseline() -> tuple[dict[str, str], list[str]]:
    errors = validate_manifest_snapshot_pin()
    try:
        with BASELINE_MANIFEST.open(encoding="utf-8", newline="") as handle:
            rows = [
                row for row in csv.DictReader(handle)
                if row.get("repository") == "DWP_BACKEND"
            ]
    except (OSError, csv.Error) as error:
        return {}, [f"BASELINE_MANIFEST_UNREADABLE:{error}"]
    if len(rows) != 1:
        errors.append(f"BASELINE_ROW_CARDINALITY:{len(rows)}")
        return {}, errors
    return rows[0], errors


def validate_baseline_facts(
    row: dict[str, str],
    *,
    environment_root: str | None,
    actual_root: str,
    actual_branch: str,
    actual_head: str,
    actual_tree: str,
    actual_dirty_count: int,
) -> list[str]:
    """Validate manifest-to-Git facts without embedding a moving C0 SHA."""
    errors: list[str] = []
    declared_root = Path(row.get("integration_worktree", "") or "/__missing_c2_backend__").resolve()
    if declared_root != DEFAULT_BACKEND:
        errors.append(f"BASELINE_INTEGRATION_ROOT_MISMATCH:{declared_root}")
    if environment_root is not None:
        requested_root = Path(environment_root).resolve()
        if requested_root != declared_root:
            errors.append(f"BACKEND_ROOT_REDIRECT:{requested_root}")
    expected_head = row.get("integration_head_sha", "")
    expected_tree = row.get("integration_tree_sha", "")
    expected_branch = row.get("integration_branch", "")
    if not expected_branch:
        errors.append("BASELINE_BRANCH_INVALID")
    if not SHA40.fullmatch(expected_head):
        errors.append("BASELINE_HEAD_INVALID")
    if not SHA40.fullmatch(expected_tree):
        errors.append("BASELINE_TREE_INVALID")
    if row.get("integration_dirty_count") != "0":
        errors.append(f"BASELINE_DIRTY_COUNT_NOT_ZERO:{row.get('integration_dirty_count', '')}")
    if Path(actual_root).resolve() != declared_root:
        errors.append(f"GIT_TOPLEVEL_MISMATCH:{actual_root}")
    if actual_branch != expected_branch:
        errors.append(f"BACKEND_BRANCH_MISMATCH:{actual_branch}")
    if actual_head != expected_head:
        errors.append(f"BACKEND_HEAD_MISMATCH:{actual_head}")
    if actual_tree != expected_tree:
        errors.append(f"BACKEND_TREE_MISMATCH:{actual_tree}")
    if actual_dirty_count != 0:
        errors.append(f"BACKEND_WORKTREE_DIRTY:{actual_dirty_count}")
    return errors


def safe_git_environment() -> dict[str, str]:
    environment = {
        key: value for key, value in os.environ.items()
        if not key.startswith("GIT_")
        and key not in {"DYLD_INSERT_LIBRARIES", "LD_PRELOAD"}
    }
    environment.update({
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_CONFIG_SYSTEM": os.devnull,
        "GIT_TERMINAL_PROMPT": "0",
        "LC_ALL": "C",
    })
    return environment


def git_output(root: Path, *arguments: str) -> str:
    completed = subprocess.run(
        [GIT_BINARY, "-C", str(root), *arguments],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=safe_git_environment(),
        timeout=15,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "git command failed")
    return completed.stdout


def git_text(root: Path, *arguments: str) -> str:
    return git_output(root, *arguments).strip()


def load_backend_context() -> tuple[Path, dict[str, str], list[str], dict[str, object]]:
    row, errors = read_backend_baseline()
    declared = Path(row.get("integration_worktree", str(DEFAULT_BACKEND))).resolve()
    evidence: dict[str, object] = {
        "manifest": str(BASELINE_MANIFEST),
        "declaredRoot": str(declared),
        "expectedHead": row.get("integration_head_sha"),
        "expectedTree": row.get("integration_tree_sha"),
        "expectedDirtyCount": row.get("integration_dirty_count"),
    }
    if not declared.is_dir():
        errors.append(f"BACKEND_ROOT_MISSING:{declared}")
        return declared, row, errors, evidence
    try:
        actual_root = git_text(declared, "rev-parse", "--show-toplevel")
        actual_branch = git_text(declared, "symbolic-ref", "--quiet", "--short", "HEAD")
        actual_head = git_text(declared, "rev-parse", "HEAD")
        actual_tree = git_text(declared, "rev-parse", "HEAD^{tree}")
        status = git_output(
            declared,
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
            "--ignore-submodules=none",
            "-z",
        )
        actual_dirty_count = 0 if status == "" else max(1, status.count("\0"))
        evidence.update({
            "actualRoot": actual_root,
            "actualBranch": actual_branch,
            "actualHead": actual_head,
            "actualTree": actual_tree,
            "actualDirtyCount": actual_dirty_count,
        })
        errors.extend(validate_baseline_facts(
            row,
            environment_root=os.environ.get(BACKEND_ENV),
            actual_root=actual_root,
            actual_branch=actual_branch,
            actual_head=actual_head,
            actual_tree=actual_tree,
            actual_dirty_count=actual_dirty_count,
        ))
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        errors.append(f"BACKEND_GIT_INSPECTION_FAILED:{error}")
    return declared, row, errors, evidence


def validate_digest_pins(
    observed: dict[str, str],
    expected: dict[str, str],
    label: str,
) -> list[str]:
    errors: list[str] = []
    for relative, digest in expected.items():
        actual = observed.get(relative)
        if actual is None:
            errors.append(f"{label}_PIN_MISSING:{relative}")
        elif actual != digest:
            errors.append(f"{label}_PIN_DRIFT:{relative}")
    return errors


def validate_pin_contract(
    consumer_pins: dict[str, str] | None = None,
    purpose_pin: str = PURPOSE_PIN,
) -> list[str]:
    pins = CONSUMER_PINS if consumer_pins is None else consumer_pins
    expected_paths = {spec["path"] for spec in CONSUMERS.values()}
    errors: list[str] = []
    if set(pins) != expected_paths or len(pins) != len(CONSUMERS):
        errors.append("CONSUMER_PIN_SET_DRIFT")
    if any(not SHA256.fullmatch(value) for value in pins.values()):
        errors.append("CONSUMER_PIN_DIGEST_FORMAT_DRIFT")
    if not SHA256.fullmatch(purpose_pin):
        errors.append("PURPOSE_PIN_DIGEST_FORMAT_DRIFT")
    if any(not SHA256.fullmatch(value) for value in OWNER_PINS.values()):
        errors.append("OWNER_PIN_DIGEST_FORMAT_DRIFT")
    return errors


def validate_texts(texts: dict[str, str], purpose_text: str) -> list[str]:
    errors: list[str] = []
    packages: set[str] = set()
    for module, spec in CONSUMERS.items():
        text = texts.get(module)
        if text is None:
            errors.append(f"CONSUMER_MISSING:{module}")
            continue
        package = spec["package"]
        packages.add(package)
        if f"package {package};" not in text:
            errors.append(f"PACKAGE_MISMATCH:{module}")
        for imported in IMPORT_RE.findall(text):
            if imported.startswith("com.dwp.") and not imported.startswith(
                "com.dwp.platform.contracts.hris.identity.v1."
            ):
                errors.append(f"NON_ABI_DWP_IMPORT:{module}:{imported}")
        if FORBIDDEN_DB.search(text):
            errors.append(f"DIRECT_DB_ACCESS:{module}")
        required = [
            f"SelfContextPurposeV1.Audience.{spec['audience']}",
            f"SelfContextPurposeV1.{spec['purpose']}",
            "GuardedSelfContextPortV1.guarded",
            "ADAPTER_UNAVAILABLE",
            "OWNER_UNAVAILABLE",
            "MissingAdapterFailsClosedWithout",
            "OwnerUnavailableFailsClosedWithout",
            ".hasValue(3)",
            ".hasValue(0)",
            ".hasValue(1)",
        ]
        for marker in required:
            if marker not in text:
                errors.append(f"CONSUMER_EVIDENCE_MISSING:{module}:{marker}")
        mapping = f"{spec['purpose']}(Audience.{spec['audience']})"
        if mapping not in purpose_text:
            errors.append(f"PURPOSE_MAPPING_MISSING:{module}:{mapping}")
    if len(packages) != len(CONSUMERS):
        errors.append("BOUNDED_CONTEXT_PACKAGE_COLLISION")
    return errors


def load(backend: Path) -> tuple[dict[str, str], str, list[str], dict[str, str]]:
    errors: list[str] = []
    texts: dict[str, str] = {}
    digests: dict[str, str] = {}
    for module, spec in CONSUMERS.items():
        path = backend / spec["path"]
        if not path.is_file():
            errors.append(f"CONSUMER_FILE_MISSING:{module}:{spec['path']}")
            continue
        try:
            texts[module] = path.read_text(encoding="utf-8")
            digests[spec["path"]] = sha256(path)
        except (OSError, UnicodeError) as error:
            errors.append(f"CONSUMER_FILE_UNREADABLE:{module}:{error}")
    purpose_path = backend / PURPOSE_FILE
    purpose_text = ""
    if not purpose_path.is_file():
        errors.append(f"PURPOSE_FILE_MISSING:{PURPOSE_FILE}")
    else:
        try:
            purpose_text = purpose_path.read_text(encoding="utf-8")
            digests[PURPOSE_FILE] = sha256(purpose_path)
        except (OSError, UnicodeError) as error:
            errors.append(f"PURPOSE_FILE_UNREADABLE:{error}")
    for relative in OWNER_PINS:
        path = backend / relative
        if not path.is_file():
            errors.append(f"OWNER_PIN_MISSING:{relative}")
        else:
            try:
                digests[relative] = sha256(path)
            except OSError as error:
                errors.append(f"OWNER_PIN_UNREADABLE:{relative}:{error}")
    errors.extend(validate_pin_contract())
    errors.extend(validate_digest_pins(digests, CONSUMER_PINS, "CONSUMER"))
    errors.extend(validate_digest_pins(digests, {PURPOSE_FILE: PURPOSE_PIN}, "PURPOSE"))
    errors.extend(validate_digest_pins(digests, OWNER_PINS, "OWNER"))
    return texts, purpose_text, errors, digests


def self_tests(texts: dict[str, str], purpose_text: str) -> list[dict[str, object]]:
    cases: list[dict[str, object]] = []

    def text_case(name: str, candidate: dict[str, str], purposes: str,
                  expected_marker: str, mutation_applied: bool) -> None:
        failures = validate_texts(candidate, purposes)
        cases.append({
            "id": name,
            "mutationApplied": mutation_applied,
            "rejected": mutation_applied and any(
                error.startswith(expected_marker) for error in failures
            ),
        })

    missing = dict(texts)
    missing.pop("TIM", None)
    text_case(
        "missing-consumer", missing, purpose_text, "CONSUMER_MISSING:TIM",
        "TIM" in texts,
    )
    wrong_purpose = dict(texts)
    original_per = wrong_purpose.get("PER", "")
    if "PER" in wrong_purpose:
        wrong_purpose["PER"] = original_per.replace("SELF_PERFORMANCE_READ", "SELF_PROFILE_READ")
    text_case(
        "wrong-purpose", wrong_purpose, purpose_text,
        "CONSUMER_EVIDENCE_MISSING:PER:SelfContextPurposeV1.SELF_PERFORMANCE_READ",
        wrong_purpose.get("PER", "") != original_per,
    )
    direct_db = dict(texts)
    direct_db["PAY"] = direct_db.get("PAY", "") + "\nimport org.springframework.jdbc.core.JdbcTemplate;\n"
    text_case("direct-db-import", direct_db, purpose_text, "DIRECT_DB_ACCESS:PAY", True)
    fallback = dict(texts)
    original_sys = fallback.get("SYS", "")
    if "SYS" in fallback:
        fallback["SYS"] = original_sys.replace("OwnerUnavailableFailsClosedWithout", "OwnerUnavailableMayFallback")
    text_case(
        "fallback-witness-removed", fallback, purpose_text,
        "CONSUMER_EVIDENCE_MISSING:SYS:OwnerUnavailableFailsClosedWithout",
        fallback.get("SYS", "") != original_sys,
    )
    promotion = purpose_text.replace("SELF_HRIS_HOME_READ(Audience.HRIS_SYS)", "SELF_HRIS_HOME_READ(Audience.HRIS_HRM)")
    text_case(
        "purpose-audience-rehome", dict(texts), promotion,
        "PURPOSE_MAPPING_MISSING:SYS:SELF_HRIS_HOME_READ(Audience.HRIS_SYS)",
        promotion != purpose_text,
    )

    synthetic_head = "a" * 40
    synthetic_tree = "b" * 40
    synthetic_row = {
        "integration_worktree": str(DEFAULT_BACKEND),
        "integration_head_sha": synthetic_head,
        "integration_tree_sha": synthetic_tree,
        "integration_dirty_count": "0",
        "integration_branch": "codex/hris-integration-backend-20260909",
    }

    def baseline_rejected(name: str, *, row: dict[str, str] | None = None,
                          environment_root: str | None = None,
                          actual_branch: str = "codex/hris-integration-backend-20260909",
                          actual_head: str = synthetic_head,
                          actual_tree: str = synthetic_tree,
                          actual_dirty_count: int = 0,
                          expected_marker: str) -> None:
        failures = validate_baseline_facts(
            dict(synthetic_row if row is None else row),
            environment_root=environment_root,
            actual_root=str(DEFAULT_BACKEND),
            actual_branch=actual_branch,
            actual_head=actual_head,
            actual_tree=actual_tree,
            actual_dirty_count=actual_dirty_count,
        )
        cases.append({
            "id": name,
            "rejected": any(error.startswith(expected_marker) for error in failures),
        })

    baseline_rejected(
        "backend-root-redirect",
        environment_root="/__c2_redirected_backend__",
        expected_marker="BACKEND_ROOT_REDIRECT",
    )
    baseline_rejected(
        "backend-root-empty-override",
        environment_root="",
        expected_marker="BACKEND_ROOT_REDIRECT",
    )
    baseline_rejected(
        "backend-dirty",
        actual_dirty_count=1,
        expected_marker="BACKEND_WORKTREE_DIRTY",
    )
    baseline_rejected(
        "backend-tree-mismatch",
        actual_tree="c" * 40,
        expected_marker="BACKEND_TREE_MISMATCH",
    )
    baseline_rejected(
        "backend-head-mismatch",
        actual_head="d" * 40,
        expected_marker="BACKEND_HEAD_MISMATCH",
    )
    baseline_rejected(
        "backend-branch-mismatch",
        actual_branch="codex/redirected-branch",
        expected_marker="BACKEND_BRANCH_MISMATCH",
    )
    manifest_dirty = dict(synthetic_row)
    manifest_dirty["integration_dirty_count"] = "1"
    baseline_rejected(
        "manifest-dirty-not-zero",
        row=manifest_dirty,
        expected_marker="BASELINE_DIRTY_COUNT_NOT_ZERO",
    )

    missing_pin = dict(CONSUMER_PINS)
    missing_pin.pop(next(iter(missing_pin)))
    cases.append({
        "id": "consumer-pin-set-drift",
        "rejected": "CONSUMER_PIN_SET_DRIFT" in validate_pin_contract(missing_pin),
    })
    path_to_module = {spec["path"]: module for module, spec in CONSUMERS.items()}
    for relative in sorted(CONSUMER_PINS):
        module = path_to_module[relative]
        original_text = texts.get(module)
        observed_consumers = dict(CONSUMER_PINS)
        if original_text is not None:
            observed_consumers[relative] = hashlib.sha256(
                (original_text + " ").encode("utf-8")
            ).hexdigest()
        consumer_failures = validate_digest_pins(observed_consumers, CONSUMER_PINS, "CONSUMER")
        cases.append({
            "id": f"consumer-whitespace-digest-drift-{module.lower()}",
            "mutationApplied": observed_consumers[relative] != CONSUMER_PINS[relative],
            "rejected": any(
                error == f"CONSUMER_PIN_DRIFT:{relative}"
                for error in consumer_failures
            ),
        })
    mutated_purpose_digest = hashlib.sha256(
        (purpose_text + " ").encode("utf-8")
    ).hexdigest() if purpose_text else PURPOSE_PIN
    purpose_failures = validate_digest_pins(
        {PURPOSE_FILE: mutated_purpose_digest}, {PURPOSE_FILE: PURPOSE_PIN}, "PURPOSE"
    )
    cases.append({
        "id": "purpose-whitespace-digest-drift",
        "mutationApplied": mutated_purpose_digest != PURPOSE_PIN,
        "rejected": any(error.startswith("PURPOSE_PIN_DRIFT") for error in purpose_failures),
    })
    return cases


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    backend, baseline_row, errors, baseline_evidence = load_backend_context()
    texts, purpose_text, load_errors, digests = load(backend)
    errors.extend(load_errors)
    errors.extend(validate_texts(texts, purpose_text))
    post_backend, post_row, post_errors, post_evidence = load_backend_context()
    baseline_evidence["postRead"] = post_evidence
    if post_backend != backend or post_row != baseline_row:
        errors.append("BASELINE_CHANGED_DURING_VALIDATION")
    for field in ("actualRoot", "actualBranch", "actualHead", "actualTree", "actualDirtyCount"):
        if baseline_evidence.get(field) != post_evidence.get(field):
            errors.append(f"BACKEND_CHANGED_DURING_VALIDATION:{field}")
    for error in post_errors:
        if error not in errors:
            errors.append(f"POST_READ_{error}")
    tests = self_tests(texts, purpose_text) if args.self_test else []
    if any(not case["rejected"] for case in tests):
        errors.append("SELF_TEST_NOT_REJECTED")
    report = {
        "schema": "dwp.hris.identity-c2-five-consumer-static.v1",
        "status": "PASS" if not errors else "FAIL",
        "backend": str(backend),
        "baselineManifest": str(BASELINE_MANIFEST),
        "baselineSnapshot": baseline_evidence,
        "baselineRepository": baseline_row.get("repository"),
        "consumers": len(texts),
        "consumerModules": sorted(texts),
        "abiOnlyConsumerImports": not any(error.startswith("NON_ABI_DWP_IMPORT") for error in errors),
        "directCrossOwnerDatabaseAccessCount": sum(error.startswith("DIRECT_DB_ACCESS") for error in errors),
        "ownerNativeAndGuardPins": len(OWNER_PINS),
        "consumerPins": len(CONSUMER_PINS),
        "purposePins": 1,
        "digests": dict(sorted(digests.items())),
        "selfTests": tests,
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, sort_keys=True,
                     separators=(",", ":") if args.compact else None,
                     indent=None if args.compact else 2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
