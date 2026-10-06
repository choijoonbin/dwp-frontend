#!/usr/bin/env python3
"""Independently validate the pre-G3 common-foundation migration receipts."""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
DWP = ROOT.parents[1]
BACKEND = DWP / ".codex-worktrees/hris/integration/backend"
ALLOCATION = G0 / "pre-g3-common-foundation-migration-allocation.v1.json"
REVIEW = G0 / "pre-g3-common-foundation-migration-technical-review.v1.json"
BASELINE_COMMIT = "787f25753a72dc5f0fbbb06783205c0bff6635a5"
SHA40 = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
VERSIONED = re.compile(r"^V([0-9]+(?:[._][0-9]+)*)__.+\.sql$")

ALLOCATION_ID = "dwp.hris.pre-g3-common-foundation-migration-allocation.v1"
REVIEW_ID = "dwp.hris.pre-g3-common-foundation-migration-technical-review.v1"
EVIDENCE_ID = "dwp.hris.pre-g3-common-foundation-postgres-evidence.v1"
OBSERVATION_ID = "dwp.pre-g3.platform-observation/v1"
NOTIFICATION_OBSERVATION_ID = (
    "dwp.pre-g3.notification-trigger-observation/v1"
)

EXPECTED_FILES = {
    "dwp-approval-server/src/main/resources/db/migration/"
    "V36__close_remaining_approval_trigger_execution_boundaries.sql": (
        "dwp-approval-server", "approval-main", "VERSIONED", "36",
        "PRE_G3_COMMON_SECURITY_FOUNDATION",
    ),
    "dwp-approval-server/src/main/resources/db/migration/"
    "V37__close_approval_seed_execution_boundary.sql": (
        "dwp-approval-server", "approval-main", "VERSIONED", "37",
        "PRE_G3_COMMON_SECURITY_FOUNDATION",
    ),
    "dwp-approval-server/src/main/resources/db/migration/"
    "V38__bind_retention_aware_trigger_entrypoints_to_owner.sql": (
        "dwp-approval-server", "approval-main", "VERSIONED", "38",
        "PRE_G3_COMMON_SECURITY_FOUNDATION",
    ),
    "dwp-platform-server/src/main/resources/db/migration/"
    "V254_1__bridge_platform_trigger_inventory_before_v255.sql": (
        "dwp-platform-server", "platform-main", "VERSIONED", "254.1",
        "PRE_G3_COMMON_PLATFORM_FOUNDATION",
    ),
    "dwp-platform-server/src/main/resources/db/migration/"
    "V261__close_platform_trigger_and_facility_retention_boundaries.sql": (
        "dwp-platform-server", "platform-main", "VERSIONED", "261",
        "PRE_G3_COMMON_PLATFORM_FOUNDATION",
    ),
    "dwp-notification-server/src/main/resources/db/migration/"
    "V32__close_approval_sla_delivery_trigger_execution_boundary.sql": (
        "dwp-notification-server", "notification-main", "VERSIONED", "32",
        "PRE_G3_COMMON_SECURITY_FOUNDATION",
    ),
}

FORBIDDEN_BASELINE_PATHS = {
    "dwp-platform-server/src/main/resources/db/migration/"
    "B260__platform_baseline.sql",
    "dwp-platform-server/src/main/resources/db/baseline/"
    "platform-baseline-v260.sources.v1.json",
    "scripts/generate-platform-baseline-migration.py",
    "scripts/tests/test_generate_platform_baseline_migration.py",
}
FORBIDDEN_BASELINE_MARKERS = (
    "B260__platform_baseline.sql",
    "flyway.baselineMigrationPrefix",
    "generate-platform-baseline-migration",
    "platform-baseline-v260.sources",
)
TEST_SOURCE_PATH = (
    "dwp-migration-control/src/test/java/com/dwp/migration/control/"
    "PlatformInventoryBridgeControlPostgresTest.java"
)
JUNIT_BUILD_PATH = (
    "dwp-migration-control/build/test-results/test/"
    "TEST-com.dwp.migration.control."
    "PlatformInventoryBridgeControlPostgresTest.xml"
)
NOTIFICATION_TEST_SOURCE_PATH = (
    "dwp-notification-server/src/test/java/com/dwp/services/notification/"
    "migration/NotificationTriggerExecutionBoundaryPostgresTest.java"
)
NOTIFICATION_JUNIT_BUILD_PATH = (
    "dwp-notification-server/build/test-results/test/"
    "TEST-com.dwp.services.notification.migration."
    "NotificationTriggerExecutionBoundaryPostgresTest.xml"
)
EVIDENCE_PATHS = {
    "postgres:16-alpine": (
        "g0/control-evidence-intake/"
        "pre-g3-common-foundation-postgres-16.v1.json"
    ),
    "postgres:18.4-alpine": (
        "g0/control-evidence-intake/"
        "pre-g3-common-foundation-postgres-18.v1.json"
    ),
}
PRESERVED_JUNIT_PATHS = {
    "postgres:16-alpine": (
        "g0/control-evidence-intake/"
        "pre-g3-common-foundation-postgres-16.junit.xml"
    ),
    "postgres:18.4-alpine": (
        "g0/control-evidence-intake/"
        "pre-g3-common-foundation-postgres-18.junit.xml"
    ),
}
PRESERVED_NOTIFICATION_JUNIT_PATHS = {
    "postgres:16-alpine": (
        "g0/control-evidence-intake/"
        "pre-g3-common-foundation-postgres-16.notification.junit.xml"
    ),
    "postgres:18.4-alpine": (
        "g0/control-evidence-intake/"
        "pre-g3-common-foundation-postgres-18.notification.junit.xml"
    ),
}
OBSERVATION_PATHS = {
    "postgres:16-alpine": (
        "g0/control-evidence-intake/"
        "pre-g3-common-foundation-postgres-16.observations.v1.json"
    ),
    "postgres:18.4-alpine": (
        "g0/control-evidence-intake/"
        "pre-g3-common-foundation-postgres-18.observations.v1.json"
    ),
}
NOTIFICATION_OBSERVATION_PATHS = {
    "postgres:16-alpine": (
        "g0/control-evidence-intake/"
        "pre-g3-common-foundation-postgres-16.notification-observations.v1.json"
    ),
    "postgres:18.4-alpine": (
        "g0/control-evidence-intake/"
        "pre-g3-common-foundation-postgres-18.notification-observations.v1.json"
    ),
}
COMMANDS = {
    image: (
        f"DWP_CONTROL_POSTGRES_TEST_IMAGE={image} ./gradlew "
        ":dwp-migration-control:test :dwp-notification-server:test --tests "
        "'com.dwp.migration.control.PlatformInventoryBridgeControlPostgresTest' "
        "--tests 'com.dwp.services.notification.migration."
        "NotificationTriggerExecutionBoundaryPostgresTest' "
        "--rerun-tasks --no-daemon --max-workers=1"
    )
    for image in EVIDENCE_PATHS
}
EXPECTED_SCENARIOS = {
    "bridge-failure-retry",
    "bridge-partial-state-retry",
    "control-254",
    "control-260",
    "control-fresh",
    "fresh-ordered",
    "historyless-nonempty-bridge-schema",
    "historyless-nonempty-relation",
    "historyless-nonempty-routine",
    "historyless-nonempty-schema",
    "historyless-nonempty-sequence",
    "historyless-nonempty-trigger",
    "historyless-nonempty-type",
    "immutable-predecessors",
    "source-digest-drift",
    "unexpected-ignored",
    "upgrade-191",
    "upgrade-254",
    "upgrade-255",
    "upgrade-260",
    "v261-failure-retry",
}
REPOSITORY_DIGEST = re.compile(r"^postgres@sha256:[0-9a-f]{64}$")
JUNIT_SUITE = (
    "com.dwp.migration.control.PlatformInventoryBridgeControlPostgresTest"
)
NOTIFICATION_JUNIT_SUITE = (
    "com.dwp.services.notification.migration."
    "NotificationTriggerExecutionBoundaryPostgresTest"
)
EXPECTED_JUNIT_CASE_NAMES = {
    scenario: scenario for scenario in EXPECTED_SCENARIOS
}
EXPECTED_JUNIT_CASE_IDS = {
    f"{JUNIT_SUITE}#{name}" for name in EXPECTED_JUNIT_CASE_NAMES.values()
}
EXPECTED_NOTIFICATION_SCENARIOS = {
    "runtime-dml-through-hardened-triggers",
    "runtime-transaction-audit-idempotency",
    "v32-failure-repair-retry",
    "v32-fresh-trigger-boundary",
    "v32-upgrade-v30-trigger-boundary",
}
EXPECTED_NOTIFICATION_JUNIT_CASE_IDS = {
    f"{NOTIFICATION_JUNIT_SUITE}#{name}"
    for name in EXPECTED_NOTIFICATION_SCENARIOS
}

if set(EXPECTED_JUNIT_CASE_NAMES) != EXPECTED_SCENARIOS:
    raise RuntimeError("JUnit/scenario semantic mapping is not an exact closed set")


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def parse_utc_timestamp(value: Any) -> datetime:
    """Parse RFC 3339 UTC timestamps portably, including Python 3.9."""
    if not isinstance(value, str):
        raise ValueError("timestamp is not a string")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise ValueError("timestamp is not timezone-aware UTC")
    return parsed


def compact_json(value: object) -> bytes:
    return (
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        + "\n"
    ).encode("utf-8")


def canonical_file(value: dict[str, Any]) -> bytes:
    return (
        json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + "\n"
    ).encode("utf-8")


def sealed_payload(value: dict[str, Any]) -> bytes:
    return compact_json(
        {key: item for key, item in value.items() if key != "sealedPayloadSha256"}
    )


def seal(value: dict[str, Any]) -> dict[str, Any]:
    value["sealedPayloadSha256"] = digest(sealed_payload(value))
    return value


def reject_constant(value: str) -> None:
    raise ValueError(f"non-finite JSON constant: {value}")


def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def parse_json(raw: bytes, *, canonical: bool) -> dict[str, Any]:
    if raw.startswith(b"\xef\xbb\xbf"):
        raise ValueError("UTF-8 BOM is forbidden")
    if not raw.endswith(b"\n") or raw.endswith(b"\n\n"):
        raise ValueError("exactly one final LF is required")
    value = json.loads(
        raw.decode("utf-8"),
        object_pairs_hook=reject_duplicates,
        parse_constant=reject_constant,
        parse_float=lambda item: (_ for _ in ()).throw(
            ValueError(f"float is forbidden: {item}")
        ),
    )
    if not isinstance(value, dict):
        raise ValueError("top-level JSON value must be an object")
    if canonical and raw != canonical_file(value):
        raise ValueError("JSON instance bytes are not canonical")
    return value


def load(path: Path) -> tuple[dict[str, Any], bytes]:
    raw = path.read_bytes()
    return parse_json(raw, canonical=True), raw


def exact_keys(
    value: object, expected: set[str], subject: str, errors: list[str]
) -> dict[str, Any]:
    if not isinstance(value, dict):
        errors.append(f"{subject}:OBJECT_REQUIRED")
        return {}
    if set(value) != expected:
        errors.append(f"{subject}:KEY_SET")
    return value


def shape_committed_pin(
    value: object, subject: str, errors: list[str]
) -> dict[str, Any]:
    row = exact_keys(
        value,
        {"path", "fileMode", "gitBlobOid", "sha256", "byteLength"},
        subject,
        errors,
    )
    if not isinstance(row.get("path"), str) or not row.get("path"):
        errors.append(f"{subject}:PATH")
    if row.get("fileMode") != "100644":
        errors.append(f"{subject}:MODE")
    if not SHA40.fullmatch(str(row.get("gitBlobOid", ""))):
        errors.append(f"{subject}:BLOB")
    if not SHA256.fullmatch(str(row.get("sha256", ""))):
        errors.append(f"{subject}:SHA256")
    if type(row.get("byteLength")) is not int or row.get("byteLength", 0) <= 0:
        errors.append(f"{subject}:LENGTH")
    return row


def validate_allocation(
    doc: dict[str, Any], *, check_repository: bool
) -> list[str]:
    errors: list[str] = []
    exact_keys(
        doc,
        {
            "contractId", "schemaVersion", "status", "effectiveGate",
            "moduleStartAuthorization", "productionAuthorization", "source",
            "migrationFiles", "immutablePredecessorSets", "governance",
            "sealedPayloadSha256",
        },
        "ALLOCATION",
        errors,
    )
    if doc.get("contractId") != ALLOCATION_ID:
        errors.append("ALLOCATION:CONTRACT_ID")
    if doc.get("schemaVersion") != 1 or type(doc.get("schemaVersion")) is not int:
        errors.append("ALLOCATION:SCHEMA_VERSION")
    if doc.get("status") != "SEALED_TECHNICAL_ALLOCATION_NO_START_AUTHORITY":
        errors.append("ALLOCATION:STATUS")
    if doc.get("effectiveGate") != "CLOSED_FAIL_SAFE":
        errors.append("ALLOCATION:GATE")
    if doc.get("moduleStartAuthorization") != "NONE":
        errors.append("ALLOCATION:MODULE_AUTHORITY")
    if doc.get("productionAuthorization") != "NOT_AUTHORIZED_G6":
        errors.append("ALLOCATION:PRODUCTION_AUTHORITY")
    if doc.get("sealedPayloadSha256") != digest(sealed_payload(doc)):
        errors.append("ALLOCATION:SEAL")

    source = exact_keys(
        doc.get("source"),
        {
            "repository", "baselineCommit", "finalCommit", "finalTree",
            "baselineAncestorRequired", "requiredWorktreeState",
        },
        "SOURCE",
        errors,
    )
    if source.get("repository") != "DWP_BACKEND":
        errors.append("SOURCE:REPOSITORY")
    if source.get("baselineCommit") != BASELINE_COMMIT:
        errors.append("SOURCE:BASELINE")
    if not SHA40.fullmatch(str(source.get("finalCommit", ""))):
        errors.append("SOURCE:FINAL_COMMIT")
    if not SHA40.fullmatch(str(source.get("finalTree", ""))):
        errors.append("SOURCE:FINAL_TREE")
    if source.get("baselineAncestorRequired") is not True:
        errors.append("SOURCE:ANCESTRY_POLICY")
    if source.get("requiredWorktreeState") != "CLEAN":
        errors.append("SOURCE:WORKTREE_POLICY")

    files = doc.get("migrationFiles")
    if not isinstance(files, list):
        errors.append("MIGRATIONS:LIST")
        files = []
    by_path: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(files):
        row = exact_keys(
            item,
            {
                "path", "service", "streamKey", "flywayKind", "version",
                "authorizationClass", "fileMode", "gitBlobOid", "sha256",
                "byteLength",
            },
            f"MIGRATION:{index}",
            errors,
        )
        path = str(row.get("path", ""))
        if path in by_path:
            errors.append(f"MIGRATION:DUPLICATE:{path}")
        by_path[path] = row
    if set(by_path) != set(EXPECTED_FILES) or len(files) != len(EXPECTED_FILES):
        errors.append("MIGRATION:EXACT_SIX_FILE_SET")
    for path, expected in EXPECTED_FILES.items():
        row = by_path.get(path, {})
        observed = tuple(
            row.get(key)
            for key in (
                "service", "streamKey", "flywayKind", "version",
                "authorizationClass",
            )
        )
        if observed != expected:
            errors.append(f"MIGRATION:SEMANTICS:{path}")
        if row.get("fileMode") != "100644":
            errors.append(f"MIGRATION:MODE:{path}")
        if not SHA40.fullmatch(str(row.get("gitBlobOid", ""))):
            errors.append(f"MIGRATION:BLOB:{path}")
        if not SHA256.fullmatch(str(row.get("sha256", ""))):
            errors.append(f"MIGRATION:SHA256:{path}")
        if type(row.get("byteLength")) is not int or row.get("byteLength", 0) <= 0:
            errors.append(f"MIGRATION:LENGTH:{path}")

    immutable = doc.get("immutablePredecessorSets")
    if not isinstance(immutable, list):
        errors.append("IMMUTABLE:LIST")
        immutable = []
    immutable_map: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(immutable):
        row = exact_keys(
            item,
            {
                "streamKey", "migrationDir", "baselineHighWater", "fileCount",
                "manifestSha256", "mutationPolicy",
            },
            f"IMMUTABLE:{index}",
            errors,
        )
        immutable_map[str(row.get("streamKey", ""))] = row
    expected_immutable = {
        "approval-main": (
            "dwp-approval-server/src/main/resources/db/migration", 35
        ),
        "platform-main": (
            "dwp-platform-server/src/main/resources/db/migration", 260
        ),
        "notification-main": (
            "dwp-notification-server/src/main/resources/db/migration", 30
        ),
    }
    if (
        set(immutable_map) != set(expected_immutable)
        or len(immutable) != len(expected_immutable)
    ):
        errors.append("IMMUTABLE:SET")
    for key, (directory, high_water) in expected_immutable.items():
        row = immutable_map.get(key, {})
        if (
            row.get("migrationDir") != directory
            or row.get("baselineHighWater") != high_water
            or type(row.get("fileCount")) is not int
            or row.get("fileCount", 0) <= 0
            or not SHA256.fullmatch(str(row.get("manifestSha256", "")))
            or row.get("mutationPolicy")
            != "BASELINE_GIT_BLOB_SHA256_AND_LENGTH_IMMUTABLE"
        ):
            errors.append(f"IMMUTABLE:DETAIL:{key}")

    governance = exact_keys(
        doc.get("governance"),
        {
            "approvalCommonFoundation", "platformCommonFoundation",
            "sysPlatformModuleReservation", "outOfOrderException",
            "notificationCommonFoundation", "notificationProtectedBoundary",
            "oldChecksumEditAllowed",
        },
        "GOVERNANCE",
        errors,
    )
    if governance.get("approvalCommonFoundation") != {
        "beforeHighWater": 35,
        "afterHighWater": 38,
        "versions": [36, 37, 38],
    }:
        errors.append("GOVERNANCE:APPROVAL")
    if governance.get("platformCommonFoundation") != {
        "beforeHighWater": 260,
        "afterHighWater": 261,
        "files": ["V254.1", "V261"],
    }:
        errors.append("GOVERNANCE:PLATFORM")
    if governance.get("sysPlatformModuleReservation") != {
        "allocationId": "MIG-SYS-PLATFORM-262-290",
        "baselineHighWater": 261,
        "start": 262,
        "end": 290,
        "slotCount": 29,
        "state": "RESERVED_G3_RANGE_NOT_IMPLEMENTED",
    }:
        errors.append("GOVERNANCE:SYS_RANGE")
    if governance.get("outOfOrderException") != {
        "normalOutOfOrderAllowed": False,
        "onlyVersion": "254.1",
        "onlyFile": (
            "V254_1__bridge_platform_trigger_inventory_before_v255.sql"
        ),
        "precondition": "EXACT_IGNORED_BRIDGE_AND_SUCCESSFUL_V255",
        "execution": (
            "ONE_BOUNDED_TARGET_254_1_OUT_OF_ORDER_TRUE_THEN_"
            "LATEST_OUT_OF_ORDER_FALSE"
        ),
        "historyMutationAllowed": False,
    }:
        errors.append("GOVERNANCE:OUT_OF_ORDER")
    if governance.get("notificationProtectedBoundary") != {
        "service": "dwp-notification-server",
        "baselineHighWater": 30,
        "excludedVersion": 31,
        "state": "EXTERNAL_WIP_OUT_OF_SCOPE_PROTECTED_OWNER_HANDOFF",
    }:
        errors.append("GOVERNANCE:NOTIFICATION")
    if governance.get("notificationCommonFoundation") != {
        "beforeHighWater": 30,
        "afterHighWater": 32,
        "includedVersion": 32,
        "protectedAbsentVersion": 31,
        "role": "PRE_G3_FORWARD_ONLY_TRIGGER_EXECUTION_BOUNDARY",
    }:
        errors.append("GOVERNANCE:NOTIFICATION_FOUNDATION")
    if governance.get("oldChecksumEditAllowed") is not False:
        errors.append("GOVERNANCE:CHECKSUM_MUTATION")

    forbidden_blob = json.dumps(doc, ensure_ascii=False, sort_keys=True).upper()
    for token in (
        "NO_EXTERNAL_IDENTITY_ATTESTATION", "G6_APPROVAL_NOT_SATISFIED",
        "V31__", "B260", "BENSK", "ADDSK",
    ):
        if token in forbidden_blob:
            errors.append(f"ALLOCATION:FORBIDDEN_TOKEN:{token}")

    if check_repository and not errors:
        errors.extend(validate_repository(doc))
    return errors


def git(*arguments: str, binary: bool = False) -> str | bytes:
    completed = subprocess.run(
        ["git", "-C", str(BACKEND), *arguments],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode:
        raise RuntimeError(completed.stderr.decode("utf-8", "replace").strip())
    return completed.stdout if binary else completed.stdout.decode("utf-8").strip()


def commit_blob(commit: str, path: str) -> tuple[str, str, bytes]:
    line = str(git("ls-tree", commit, "--", path))
    if not line:
        raise ValueError(f"commit path missing: {path}")
    metadata, observed_path = line.split("\t", 1)
    mode, object_type, oid = metadata.split()
    if observed_path != path or object_type != "blob":
        raise ValueError(f"commit path is not one exact blob: {path}")
    content = git("show", f"{commit}:{path}", binary=True)
    assert isinstance(content, bytes)
    return mode, oid, content


def migration_version(path: str) -> tuple[int, ...] | None:
    match = VERSIONED.fullmatch(Path(path).name)
    if not match:
        return None
    return tuple(int(part) for part in re.split(r"[._]", match.group(1)))


def immutable_manifest(
    commit: str, directory: str, high_water: int
) -> tuple[list[dict[str, Any]], str]:
    listing = str(git("ls-tree", "-r", commit, "--", directory))
    rows: list[dict[str, Any]] = []
    for line in listing.splitlines():
        metadata, path = line.split("\t", 1)
        mode, object_type, oid = metadata.split()
        version = migration_version(path)
        if object_type != "blob" or version is None or version > (high_water,):
            continue
        content = git("show", f"{commit}:{path}", binary=True)
        assert isinstance(content, bytes)
        rows.append(
            {
                "path": path,
                "mode": mode,
                "gitBlobOid": oid,
                "sha256": digest(content),
                "byteLength": len(content),
            }
        )
    rows.sort(key=lambda row: row["path"])
    return rows, digest(compact_json(rows))


def validate_repository(doc: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    source = doc["source"]
    final_commit = source["finalCommit"]
    try:
        if str(git("rev-parse", "HEAD")) != final_commit:
            errors.append("REPOSITORY:HEAD")
        if str(git("rev-parse", f"{final_commit}^{{tree}}")) != source["finalTree"]:
            errors.append("REPOSITORY:TREE")
        if str(git("status", "--porcelain=v1", "--untracked-files=all")):
            errors.append("REPOSITORY:DIRTY")
        ancestry = subprocess.run(
            ["git", "-C", str(BACKEND), "merge-base", "--is-ancestor",
             BASELINE_COMMIT, final_commit],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if ancestry.returncode != 0:
            errors.append("REPOSITORY:BASELINE_NOT_ANCESTOR")

        by_path = {row["path"]: row for row in doc["migrationFiles"]}
        for path in EXPECTED_FILES:
            mode, oid, content = commit_blob(final_commit, path)
            row = by_path[path]
            if (
                mode != row["fileMode"]
                or oid != row["gitBlobOid"]
                or digest(content) != row["sha256"]
                or len(content) != row["byteLength"]
            ):
                errors.append(f"REPOSITORY:FILE_PIN:{path}")

        directories = [
            "dwp-approval-server/src/main/resources/db/migration",
            "dwp-platform-server/src/main/resources/db/migration",
            "dwp-notification-server/src/main/resources/db/migration",
        ]
        changed = str(
            git(
                "diff", "--name-status", "--find-renames=100%",
                BASELINE_COMMIT, final_commit, "--", *directories,
            )
        )
        observed_changes = {
            tuple(line.split("\t", 1)) for line in changed.splitlines() if line
        }
        expected_changes = {("A", path) for path in EXPECTED_FILES}
        if observed_changes != expected_changes:
            errors.append("REPOSITORY:MIGRATION_DELTA_NOT_EXACT_SIX_ADDS")

        immutable_map = {
            row["streamKey"]: row for row in doc["immutablePredecessorSets"]
        }
        for key, directory, high_water in (
            (
                "approval-main",
                "dwp-approval-server/src/main/resources/db/migration",
                35,
            ),
            (
                "platform-main",
                "dwp-platform-server/src/main/resources/db/migration",
                260,
            ),
            (
                "notification-main",
                "dwp-notification-server/src/main/resources/db/migration",
                30,
            ),
        ):
            baseline_rows, manifest_sha = immutable_manifest(
                BASELINE_COMMIT, directory, high_water
            )
            row = immutable_map[key]
            if (
                row["fileCount"] != len(baseline_rows)
                or row["manifestSha256"] != manifest_sha
            ):
                errors.append(f"REPOSITORY:IMMUTABLE_MANIFEST:{key}")
            for predecessor in baseline_rows:
                mode, oid, content = commit_blob(final_commit, predecessor["path"])
                if (
                    mode != predecessor["mode"]
                    or oid != predecessor["gitBlobOid"]
                    or digest(content) != predecessor["sha256"]
                    or len(content) != predecessor["byteLength"]
                ):
                    errors.append(
                        f"REPOSITORY:IMMUTABLE_PREDECESSOR:{predecessor['path']}"
                    )

        for path in FORBIDDEN_BASELINE_PATHS:
            if str(git("ls-tree", final_commit, "--", path)):
                errors.append(f"REPOSITORY:DEFERRED_BASELINE_PATH_PRESENT:{path}")
        for marker in FORBIDDEN_BASELINE_MARKERS:
            probe = subprocess.run(
                ["git", "-C", str(BACKEND), "grep", "-n", "-I", "-F", marker,
                 final_commit, "--"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            if probe.returncode == 0 and probe.stdout:
                errors.append(f"REPOSITORY:DEFERRED_BASELINE_MARKER_PRESENT:{marker}")
            elif probe.returncode not in {0, 1}:
                raise RuntimeError(
                    probe.stderr.decode("utf-8", "replace").strip()
                )
    except (KeyError, OSError, RuntimeError, ValueError, json.JSONDecodeError) as exc:
        errors.append(f"REPOSITORY:EXCEPTION:{type(exc).__name__}:{exc}")
    return errors


def expected_observations() -> dict[str, Any]:
    return {
        "triggerFunctionCount": 50,
        "triggerMappingCount": 68,
        "triggerMappingSha256": (
            "cade7c2964b47a298bedc9c9d26f5185e5418ec0736db3b0d6ba5a5e7bc2bd8d"
        ),
        "bridgedMappingCount": 8,
        "bridgedMappingSha256": (
            "342b41d9d6d39450b750bbdf63415fa98bb28e133d0138fa435bd82221c0d2af"
        ),
        "finalBridgeSchemaCount": 0,
        "migrationPrincipalDatabaseCreateAtEntry": False,
        "migrationPrincipalDatabaseCreateAtExit": False,
        "verifiedScenarioIds": sorted(EXPECTED_SCENARIOS),
    }


def expected_notification_observations() -> dict[str, Any]:
    return {
        "triggerFunctionCount": 2,
        "securityDefinerFunctionCount": 2,
        "fixedSearchPathFunctionCount": 2,
        "triggerBoundaryTupleCount": 3,
        "triggerBoundaryTupleSha256": (
            "f00383323e062fdb4f1c92f4ecadf8e6e33cbf5a0290b5fd7cb3054449e181ef"
        ),
        "directRuntimeExecuteGrantCount": 0,
        "failedV32HistoryCount": 0,
        "failureRollbackFunctionStateUnchanged": True,
        "successfulV32HistoryCount": 1,
        "verifiedScenarioIds": sorted(EXPECTED_NOTIFICATION_SCENARIOS),
    }


def validate_observation_document(
    doc: dict[str, Any], image: str
) -> list[str]:
    errors: list[str] = []
    exact_keys(
        doc,
        {"schema", "postgresImage", *expected_observations().keys()},
        f"OBSERVATION:{image}",
        errors,
    )
    if doc.get("schema") != OBSERVATION_ID:
        errors.append(f"OBSERVATION:{image}:SCHEMA")
    if doc.get("postgresImage") != image:
        errors.append(f"OBSERVATION:{image}:IMAGE")
    observed = {
        key: doc.get(key) for key in expected_observations()
    }
    if observed != expected_observations():
        errors.append(f"OBSERVATION:{image}:INVARIANTS")
    return errors


def validate_notification_observation_document(
    doc: dict[str, Any], image: str
) -> list[str]:
    errors: list[str] = []
    exact_keys(
        doc,
        {"schema", "postgresImage", *expected_notification_observations().keys()},
        f"NOTIFICATION_OBSERVATION:{image}",
        errors,
    )
    if doc.get("schema") != NOTIFICATION_OBSERVATION_ID:
        errors.append(f"NOTIFICATION_OBSERVATION:{image}:SCHEMA")
    if doc.get("postgresImage") != image:
        errors.append(f"NOTIFICATION_OBSERVATION:{image}:IMAGE")
    observed = {
        key: doc.get(key) for key in expected_notification_observations()
    }
    if observed != expected_notification_observations():
        errors.append(f"NOTIFICATION_OBSERVATION:{image}:INVARIANTS")
    return errors


def parse_junit(
    raw: bytes,
    *,
    suite: str = JUNIT_SUITE,
    expected_case_ids: set[str] = EXPECTED_JUNIT_CASE_IDS,
) -> dict[str, Any]:
    if not raw or b"\x00" in raw or b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise ValueError("unsafe or empty JUnit XML")
    root = ET.fromstring(raw)
    if root.tag != "testsuite" or root.attrib.get("name") != suite:
        raise ValueError("JUnit root suite identity drift")
    if any(child.tag == "testsuite" for child in root):
        raise ValueError("nested JUnit suites are forbidden")
    testcases = [child for child in root if child.tag == "testcase"]
    if not testcases:
        raise ValueError("JUnit XML contains no testcase")
    case_ids: list[str] = []
    failures = 0
    errors = 0
    skipped = 0
    for testcase in testcases:
        classname = testcase.attrib.get("classname", "")
        name = testcase.attrib.get("name", "")
        if classname != suite or not name:
            raise ValueError("JUnit testcase identity is incomplete")
        case_ids.append(f"{classname}#{name}")
        failures += len(testcase.findall("failure"))
        errors += len(testcase.findall("error"))
        skipped += len(testcase.findall("skipped"))
    if len(case_ids) != len(set(case_ids)):
        raise ValueError("JUnit testcase identities are not unique")
    if set(case_ids) != expected_case_ids:
        raise ValueError("JUnit exact testcase set drift")
    declared = {}
    for key in ("tests", "failures", "errors", "skipped"):
        value = root.attrib.get(key)
        if value is None or not value.isdigit():
            raise ValueError(f"JUnit suite count missing/invalid: {key}")
        declared[key] = int(value)
    observed = {
        "tests": len(testcases),
        "failures": failures,
        "errors": errors,
        "skipped": skipped,
    }
    if declared != observed:
        raise ValueError("JUnit declared and observed counts diverge")
    return {
        "suiteName": suite,
        "tests": len(testcases),
        "failures": failures,
        "errors": errors,
        "skipped": skipped,
        "caseIds": sorted(case_ids),
    }


def validate_evidence(
    doc: dict[str, Any],
    image: str,
    source: dict[str, Any],
    *,
    junit_bytes: bytes | None,
    notification_junit_bytes: bytes | None,
    observation_doc: dict[str, Any] | None,
    observation_bytes: bytes | None,
    notification_observation_doc: dict[str, Any] | None,
    notification_observation_bytes: bytes | None,
    check_repository: bool,
) -> list[str]:
    errors: list[str] = []
    exact_keys(
        doc,
        {
            "schema", "status", "postgresImage", "containerImage", "source",
            "testSource", "notificationTestSource", "command", "execution",
            "junit", "notificationJunit", "observationSource",
            "notificationObservationSource", "observations",
            "notificationObservations", "sealedPayloadSha256",
        },
        f"EVIDENCE:{image}",
        errors,
    )
    if doc.get("schema") != EVIDENCE_ID or doc.get("status") != "PASS":
        errors.append(f"EVIDENCE:{image}:STATUS")
    if doc.get("postgresImage") != image or doc.get("command") != COMMANDS[image]:
        errors.append(f"EVIDENCE:{image}:EXECUTION_IDENTITY")
    container = exact_keys(
        doc.get("containerImage"),
        {"requested", "resolvedRepositoryDigest"},
        f"EVIDENCE:{image}:CONTAINER",
        errors,
    )
    if (
        container.get("requested") != image
        or not REPOSITORY_DIGEST.fullmatch(
            str(container.get("resolvedRepositoryDigest", ""))
        )
    ):
        errors.append(f"EVIDENCE:{image}:CONTAINER_DIGEST")
    if doc.get("source") != {
        "repository": "DWP_BACKEND",
        "commit": source.get("finalCommit"),
        "tree": source.get("finalTree"),
    }:
        errors.append(f"EVIDENCE:{image}:SOURCE")
    test_source = shape_committed_pin(
        doc.get("testSource"), f"EVIDENCE:{image}:TEST_SOURCE", errors
    )
    if test_source.get("path") != TEST_SOURCE_PATH:
        errors.append(f"EVIDENCE:{image}:TEST_SOURCE_PATH")
    notification_test_source = shape_committed_pin(
        doc.get("notificationTestSource"),
        f"EVIDENCE:{image}:NOTIFICATION_TEST_SOURCE",
        errors,
    )
    if notification_test_source.get("path") != NOTIFICATION_TEST_SOURCE_PATH:
        errors.append(f"EVIDENCE:{image}:NOTIFICATION_TEST_SOURCE_PATH")
    if check_repository and not errors:
        try:
            mode, oid, content = commit_blob(str(source.get("finalCommit")), TEST_SOURCE_PATH)
            if test_source != {
                "path": TEST_SOURCE_PATH,
                "fileMode": mode,
                "gitBlobOid": oid,
                "sha256": digest(content),
                "byteLength": len(content),
            }:
                errors.append(f"EVIDENCE:{image}:TEST_SOURCE_COMMIT_PIN")
        except (OSError, RuntimeError, ValueError) as exc:
            errors.append(
                f"EVIDENCE:{image}:TEST_SOURCE_EXCEPTION:"
                f"{type(exc).__name__}:{exc}"
            )
        try:
            mode, oid, content = commit_blob(
                str(source.get("finalCommit")), NOTIFICATION_TEST_SOURCE_PATH
            )
            if notification_test_source != {
                "path": NOTIFICATION_TEST_SOURCE_PATH,
                "fileMode": mode,
                "gitBlobOid": oid,
                "sha256": digest(content),
                "byteLength": len(content),
            }:
                errors.append(
                    f"EVIDENCE:{image}:NOTIFICATION_TEST_SOURCE_COMMIT_PIN"
                )
        except (OSError, RuntimeError, ValueError) as exc:
            errors.append(
                f"EVIDENCE:{image}:NOTIFICATION_TEST_SOURCE_EXCEPTION:"
                f"{type(exc).__name__}:{exc}"
            )
    execution = exact_keys(
        doc.get("execution"),
        {
            "startedAtUtc", "finishedAtUtc", "durationMilliseconds",
            "exitCode", "rerunTasks", "noDaemon", "maxWorkers",
            "stdoutSha256", "stderrSha256",
        },
        f"EVIDENCE:{image}:EXECUTION",
        errors,
    )
    try:
        started = parse_utc_timestamp(execution.get("startedAtUtc"))
        finished = parse_utc_timestamp(execution.get("finishedAtUtc"))
        if finished < started:
            raise ValueError("invalid ordered aware timestamps")
    except ValueError:
        errors.append(f"EVIDENCE:{image}:TIMESTAMPS")
    if (
        execution.get("exitCode") != 0
        or execution.get("rerunTasks") is not True
        or execution.get("noDaemon") is not True
        or execution.get("maxWorkers") != 1
        or type(execution.get("durationMilliseconds")) is not int
        or execution.get("durationMilliseconds", -1) < 0
        or not SHA256.fullmatch(str(execution.get("stdoutSha256", "")))
        or not SHA256.fullmatch(str(execution.get("stderrSha256", "")))
    ):
        errors.append(f"EVIDENCE:{image}:EXECUTION_RESULT")
    junit = exact_keys(
        doc.get("junit"),
        {
            "sourcePath", "preservedPath", "sha256", "byteLength",
            "suiteName", "tests", "failures", "errors", "skipped",
            "caseIds",
        },
        f"EVIDENCE:{image}:JUNIT",
        errors,
    )
    case_ids = junit.get("caseIds", [])
    if (
        junit.get("sourcePath") != JUNIT_BUILD_PATH
        or junit.get("preservedPath") != PRESERVED_JUNIT_PATHS[image]
        or not SHA256.fullmatch(str(junit.get("sha256", "")))
        or type(junit.get("byteLength")) is not int
        or junit.get("byteLength", 0) <= 0
        or junit.get("suiteName") != JUNIT_SUITE
        or type(junit.get("tests")) is not int
        or junit.get("tests") != len(EXPECTED_JUNIT_CASE_IDS)
        or junit.get("failures") != 0
        or junit.get("errors") != 0
        or junit.get("skipped") != 0
        or not isinstance(case_ids, list)
        or len(case_ids) != junit.get("tests")
        or len(case_ids) != len(set(case_ids))
        or not all(isinstance(item, str) and item for item in case_ids)
        or set(case_ids) != EXPECTED_JUNIT_CASE_IDS
    ):
        errors.append(f"EVIDENCE:{image}:JUNIT_RESULT")
    if junit_bytes is None:
        errors.append(f"EVIDENCE:{image}:JUNIT_MISSING")
    else:
        if (
            digest(junit_bytes) != junit.get("sha256")
            or len(junit_bytes) != junit.get("byteLength")
        ):
            errors.append(f"EVIDENCE:{image}:JUNIT_PIN")
        try:
            parsed_junit = parse_junit(junit_bytes)
        except (ET.ParseError, ValueError) as exc:
            errors.append(
                f"EVIDENCE:{image}:JUNIT_PARSE:{type(exc).__name__}:{exc}"
            )
        else:
            if any(junit.get(key) != value for key, value in parsed_junit.items()):
                errors.append(f"EVIDENCE:{image}:JUNIT_PARSED_RESULT")
    notification_junit = exact_keys(
        doc.get("notificationJunit"),
        {
            "sourcePath", "preservedPath", "sha256", "byteLength",
            "suiteName", "tests", "failures", "errors", "skipped",
            "caseIds",
        },
        f"EVIDENCE:{image}:NOTIFICATION_JUNIT",
        errors,
    )
    notification_case_ids = notification_junit.get("caseIds", [])
    if (
        notification_junit.get("sourcePath") != NOTIFICATION_JUNIT_BUILD_PATH
        or notification_junit.get("preservedPath")
        != PRESERVED_NOTIFICATION_JUNIT_PATHS[image]
        or not SHA256.fullmatch(str(notification_junit.get("sha256", "")))
        or type(notification_junit.get("byteLength")) is not int
        or notification_junit.get("byteLength", 0) <= 0
        or notification_junit.get("suiteName") != NOTIFICATION_JUNIT_SUITE
        or notification_junit.get("tests")
        != len(EXPECTED_NOTIFICATION_JUNIT_CASE_IDS)
        or notification_junit.get("failures") != 0
        or notification_junit.get("errors") != 0
        or notification_junit.get("skipped") != 0
        or not isinstance(notification_case_ids, list)
        or len(notification_case_ids) != notification_junit.get("tests")
        or len(notification_case_ids) != len(set(notification_case_ids))
        or not all(
            isinstance(item, str) and item for item in notification_case_ids
        )
        or set(notification_case_ids) != EXPECTED_NOTIFICATION_JUNIT_CASE_IDS
        or set(notification_case_ids) & set(case_ids)
    ):
        errors.append(f"EVIDENCE:{image}:NOTIFICATION_JUNIT_RESULT")
    if notification_junit_bytes is None:
        errors.append(f"EVIDENCE:{image}:NOTIFICATION_JUNIT_MISSING")
    else:
        if (
            digest(notification_junit_bytes)
            != notification_junit.get("sha256")
            or len(notification_junit_bytes)
            != notification_junit.get("byteLength")
        ):
            errors.append(f"EVIDENCE:{image}:NOTIFICATION_JUNIT_PIN")
        try:
            parsed_notification_junit = parse_junit(
                notification_junit_bytes,
                suite=NOTIFICATION_JUNIT_SUITE,
                expected_case_ids=EXPECTED_NOTIFICATION_JUNIT_CASE_IDS,
            )
        except (ET.ParseError, ValueError) as exc:
            errors.append(
                f"EVIDENCE:{image}:NOTIFICATION_JUNIT_PARSE:"
                f"{type(exc).__name__}:{exc}"
            )
        else:
            if any(
                notification_junit.get(key) != value
                for key, value in parsed_notification_junit.items()
            ):
                errors.append(
                    f"EVIDENCE:{image}:NOTIFICATION_JUNIT_PARSED_RESULT"
                )
    observation_source = exact_keys(
        doc.get("observationSource"),
        {"path", "sha256", "byteLength"},
        f"EVIDENCE:{image}:OBSERVATION_SOURCE",
        errors,
    )
    if observation_source.get("path") != OBSERVATION_PATHS[image]:
        errors.append(f"EVIDENCE:{image}:OBSERVATION_PATH")
    if observation_doc is None or observation_bytes is None:
        errors.append(f"EVIDENCE:{image}:OBSERVATION_MISSING")
    else:
        if (
            observation_source.get("sha256") != digest(observation_bytes)
            or observation_source.get("byteLength") != len(observation_bytes)
        ):
            errors.append(f"EVIDENCE:{image}:OBSERVATION_PIN")
        errors.extend(validate_observation_document(observation_doc, image))
        observed_from_source = {
            key: observation_doc.get(key) for key in expected_observations()
        }
        if doc.get("observations") != observed_from_source:
            errors.append(f"EVIDENCE:{image}:OBSERVATION_COPY")
    if doc.get("observations") != expected_observations():
        errors.append(f"EVIDENCE:{image}:OBSERVATIONS")
    notification_observation_source = exact_keys(
        doc.get("notificationObservationSource"),
        {"path", "sha256", "byteLength"},
        f"EVIDENCE:{image}:NOTIFICATION_OBSERVATION_SOURCE",
        errors,
    )
    if (
        notification_observation_source.get("path")
        != NOTIFICATION_OBSERVATION_PATHS[image]
    ):
        errors.append(f"EVIDENCE:{image}:NOTIFICATION_OBSERVATION_PATH")
    if (
        notification_observation_doc is None
        or notification_observation_bytes is None
    ):
        errors.append(f"EVIDENCE:{image}:NOTIFICATION_OBSERVATION_MISSING")
    else:
        if (
            notification_observation_source.get("sha256")
            != digest(notification_observation_bytes)
            or notification_observation_source.get("byteLength")
            != len(notification_observation_bytes)
        ):
            errors.append(f"EVIDENCE:{image}:NOTIFICATION_OBSERVATION_PIN")
        errors.extend(
            validate_notification_observation_document(
                notification_observation_doc, image
            )
        )
        observed_notification = {
            key: notification_observation_doc.get(key)
            for key in expected_notification_observations()
        }
        if doc.get("notificationObservations") != observed_notification:
            errors.append(f"EVIDENCE:{image}:NOTIFICATION_OBSERVATION_COPY")
    if doc.get("notificationObservations") != expected_notification_observations():
        errors.append(f"EVIDENCE:{image}:NOTIFICATION_OBSERVATIONS")
    if doc.get("sealedPayloadSha256") != digest(sealed_payload(doc)):
        errors.append(f"EVIDENCE:{image}:SEAL")
    return errors


def validate_review(
    doc: dict[str, Any], allocation: dict[str, Any], allocation_bytes: bytes,
    *,
    evidence_docs: dict[str, tuple[dict[str, Any], bytes]] | None,
    junit_docs: dict[str, bytes] | None = None,
    notification_junit_docs: dict[str, bytes] | None = None,
    observation_docs: dict[str, tuple[dict[str, Any], bytes]] | None = None,
    notification_observation_docs: dict[
        str, tuple[dict[str, Any], bytes]
    ] | None = None,
    check_repository: bool = False,
) -> list[str]:
    errors: list[str] = []
    exact_keys(
        doc,
        {
            "contractId", "schemaVersion", "status", "effectiveGate",
            "moduleStartAuthorization", "productionAuthorization",
            "allocationRef", "authority", "decisions", "postgresEvidence",
            "technicalFindings", "sealedPayloadSha256",
        },
        "REVIEW",
        errors,
    )
    if doc.get("contractId") != REVIEW_ID or doc.get("schemaVersion") != 1:
        errors.append("REVIEW:IDENTITY")
    if doc.get("status") != "INTERNAL_TECHNICAL_REVIEW_PASS_G3_ENTRY_ONLY":
        errors.append("REVIEW:STATUS")
    if doc.get("effectiveGate") != "CLOSED_FAIL_SAFE":
        errors.append("REVIEW:GATE")
    if doc.get("moduleStartAuthorization") != "NONE":
        errors.append("REVIEW:MODULE_AUTHORITY")
    if doc.get("productionAuthorization") != "NOT_AUTHORIZED_G6":
        errors.append("REVIEW:PRODUCTION_AUTHORITY")
    allocation_ref = exact_keys(
        doc.get("allocationRef"),
        {"path", "sha256", "byteLength", "sealedPayloadSha256"},
        "REVIEW:ALLOCATION_REF",
        errors,
    )
    if allocation_ref != {
        "path": "g0/pre-g3-common-foundation-migration-allocation.v1.json",
        "sha256": digest(allocation_bytes),
        "byteLength": len(allocation_bytes),
        "sealedPayloadSha256": allocation.get("sealedPayloadSha256"),
    }:
        errors.append("REVIEW:ALLOCATION_PIN")
    if doc.get("authority") != {
        "reviewAuthorityRole": "ROLE.DBA_AUTHORITY",
        "reviewAuthorityScope": "INTERNAL_TECHNICAL_REVIEW_ONLY",
        "identityAttestation": "NO_EXTERNAL_IDENTITY_ATTESTATION",
        "g6Boundary": "G6_APPROVAL_NOT_SATISFIED",
        "namedPersonApprovalClaimed": False,
    }:
        errors.append("REVIEW:AUTHORITY_BOUNDARY")
    expected_decisions = {
        "APPROVAL_V36_V38": "TECHNICALLY_ACCEPTED_PRE_G3_COMMON_SECURITY_FOUNDATION",
        "PLATFORM_V254_1_V261": (
            "TECHNICALLY_ACCEPTED_PRE_G3_COMMON_PLATFORM_FOUNDATION"
        ),
        "SYS_PLATFORM_V262_V290": (
            "TECHNICALLY_ACCEPTED_G3_RESERVATION_REBASE_NOT_IMPLEMENTATION"
        ),
        "NOTIFICATION_V32": (
            "TECHNICALLY_ACCEPTED_PRE_G3_COMMON_SECURITY_FOUNDATION"
        ),
        "NOTIFICATION_V31": "EXCLUDED_EXTERNAL_WIP_OWNER_HANDOFF_REQUIRED",
    }
    decisions = doc.get("decisions", [])
    observed_decisions = {
        row.get("subject"): row.get("decision")
        for row in decisions if isinstance(row, dict)
    }
    if (
        not isinstance(decisions, list)
        or len(decisions) != len(expected_decisions)
        or len(observed_decisions) != len(expected_decisions)
        or observed_decisions != expected_decisions
        or any(
            set(row) != {"subject", "decision", "g6Effect"}
            or row.get("g6Effect") != "NONE"
            for row in decisions if isinstance(row, dict)
        )
    ):
        errors.append("REVIEW:DECISIONS")
    evidence_rows = doc.get("postgresEvidence", [])
    evidence_by_image = {
        row.get("postgresImage"): row
        for row in evidence_rows if isinstance(row, dict)
    }
    if (
        not isinstance(evidence_rows, list)
        or len(evidence_rows) != 2
        or set(evidence_by_image) != set(EVIDENCE_PATHS)
    ):
        errors.append("REVIEW:EVIDENCE_SET")
    for image, path in EVIDENCE_PATHS.items():
        row = exact_keys(
            evidence_by_image.get(image),
            {"postgresImage", "path", "sha256", "byteLength"},
            f"REVIEW:EVIDENCE_REF:{image}",
            errors,
        )
        if row.get("path") != path:
            errors.append(f"REVIEW:EVIDENCE_PATH:{image}")
        if evidence_docs is not None and image in evidence_docs:
            evidence_doc, evidence_bytes = evidence_docs[image]
            if (
                row.get("sha256") != digest(evidence_bytes)
                or row.get("byteLength") != len(evidence_bytes)
            ):
                errors.append(f"REVIEW:EVIDENCE_PIN:{image}")
            errors.extend(
                validate_evidence(
                    evidence_doc,
                    image,
                    allocation["source"],
                    junit_bytes=(junit_docs or {}).get(image),
                    notification_junit_bytes=(
                        notification_junit_docs or {}
                    ).get(image),
                    observation_doc=(observation_docs or {}).get(image, (None, b""))[0],
                    observation_bytes=(observation_docs or {}).get(image, ({}, None))[1],
                    notification_observation_doc=(
                        notification_observation_docs or {}
                    ).get(image, (None, b""))[0],
                    notification_observation_bytes=(
                        notification_observation_docs or {}
                    ).get(image, ({}, None))[1],
                    check_repository=check_repository,
                )
            )
        elif evidence_docs is not None:
            errors.append(f"REVIEW:EVIDENCE_MISSING:{image}")
    if doc.get("technicalFindings") != {
        "oldMigrationSqlMutation": "NONE",
        "oldFlywayChecksumMutation": "NONE",
        "freshDatabasePath": "IMMUTABLE_VERSIONED_STREAM",
        "existingDatabaseAuthority": "IMMUTABLE_VERSIONED_MIGRATIONS",
        "outOfOrderPolicy": "EXACT_V254_1_ONE_TIME_CONTROLLED_EXCEPTION_ONLY",
        "v261Role": "FORWARD_CORRECTION_AND_FINAL_BOUNDARY",
        "notificationV32Role": (
            "FORWARD_ONLY_SLA_DELIVERY_TRIGGER_EXECUTION_BOUNDARY"
        ),
        "notificationV31": "EXCLUDED_EXTERNAL_OWNER_HANDOFF",
        "sysPlatformRange": "V262_V290_UNUSED_29_SLOT_RESERVATION",
        "productionEffect": "NONE_G6_REMAINS_CLOSED",
    }:
        errors.append("REVIEW:TECHNICAL_FINDINGS")
    forbidden_identity_keys = {
        "reviewerName", "reviewerEmail", "reviewerIdentity", "signature",
        "externalApproval", "g6Approval",
    }
    if forbidden_identity_keys & set(doc):
        errors.append("REVIEW:EXTERNAL_IDENTITY_FIELD")
    if doc.get("sealedPayloadSha256") != digest(sealed_payload(doc)):
        errors.append("REVIEW:SEAL")
    return errors


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def validate_authority_consumers() -> list[str]:
    errors: list[str] = []
    try:
        allocation_rows = read_csv(G0 / "migration-allocation-register.csv")
        policies = {
            row.get("service"): row
            for row in allocation_rows
            if row.get("policy_id", "").startswith("MIGPOL-")
        }
        if policies.get("dwp-approval-server", {}).get("baseline_high_water") != "38":
            errors.append("CONSUMER:APPROVAL_HIGH_WATER")
        if policies.get("dwp-platform-server", {}).get("baseline_high_water") != "261":
            errors.append("CONSUMER:PLATFORM_HIGH_WATER")
        notification_policy = policies.get("dwp-notification-server", {})
        if (
            notification_policy.get("baseline_high_water") != "32"
            or notification_policy.get("vertical_slice")
            != (
                "PRE_G3_COMMON_SECURITY_FOUNDATION_V32_WITH_V31_"
                "EXTERNAL_WIP_PROTECTED"
            )
            or notification_policy.get("state")
            != "COMMON_FOUNDATION_ONLY_EXTERNAL_FUTURE_PROTECTED"
            or notification_policy.get("code_gate")
            != "INTEGRATION_CONTROL_ALLOCATION_REQUIRED"
        ):
            errors.append("CONSUMER:NOTIFICATION_FOUNDATION_POLICY")
        notification_allocations = [
            row for row in allocation_rows
            if row.get("allocation_id") == "MIG-CONTROL-NOTIFICATION-V32"
        ]
        if len(notification_allocations) != 1:
            errors.append("CONSUMER:NOTIFICATION_V32_EXACT_ALLOCATION_SET")
        else:
            notification_allocation = notification_allocations[0]
            expected_notification_allocation = {
                "policy_id": "ALLOC-CONTROL-NOTIFICATION-V32",
                "service": "dwp-notification-server",
                "repository": "DWP_BACKEND",
                "migration_dir": (
                    "dwp-notification-server/src/main/resources/db/migration"
                ),
                "baseline_commit": BASELINE_COMMIT,
                "baseline_high_water": "30",
                "allocated_version": "32",
                "exact_filename": (
                    "V32__close_approval_sla_delivery_trigger_execution_"
                    "boundary.sql"
                ),
                "session_id": "CONTROL",
                "vertical_slice": (
                    "PRE_G3_COMMON_SECURITY_FOUNDATION_V32_EXACT_"
                    "V31_PROTECTED_ABSENT"
                ),
                "create_only": "YES",
                "existing_edit_allowed": "NO",
                "forward_correction_required": "YES",
                "state": "EXACT_PRE_G3_COMMON_FOUNDATION_ALLOCATION",
                "code_gate": (
                    "PRE_G3_TECHNICAL_RECEIPT_REQUIRED_NO_G3_NO_G6"
                ),
            }
            if any(
                notification_allocation.get(key) != value
                for key, value in expected_notification_allocation.items()
            ):
                errors.append("CONSUMER:NOTIFICATION_V32_EXACT_ALLOCATION")
        if any(
            row.get("service") == "dwp-notification-server"
            and (
                row.get("allocated_version") == "31"
                or str(row.get("exact_filename", "")).startswith("V31__")
            )
            for row in allocation_rows
        ):
            errors.append("CONSUMER:NOTIFICATION_V31_MUST_REMAIN_UNALLOCATED")
        sys_row = next(
            (
                row for row in allocation_rows
                if row.get("session_id") == "HRIS-SYS"
                and row.get("service") == "dwp-platform-server"
                and row.get("state") == "RESERVED_G3_RANGE"
                and row.get("migration_dir")
                == "dwp-platform-server/src/main/resources/db/migration"
            ),
            {},
        )
        expected_range = {
            "baseline_high_water": "261",
            "allocation_id": "MIG-SYS-PLATFORM-262-290",
            "allocated_version": "262-290",
            "exact_filename": "V{262..290}__hris_platform_<slice>.sql",
        }
        if any(sys_row.get(key) != value for key, value in expected_range.items()):
            errors.append("CONSUMER:SYS_PLATFORM_ALLOCATION")
        stream = next(
            (
                row for row in read_csv(G0 / "migration-stream-register.csv")
                if row.get("stream_id") == "MIGSTREAM-SYS-PLATFORM"
            ),
            {},
        )
        if (
            stream.get("migration_allocation_id") != "MIG-SYS-PLATFORM-262-290"
            or stream.get("baseline_high_water") != "261"
            or stream.get("out_of_order_allowed") != "NO"
        ):
            errors.append("CONSUMER:SYS_PLATFORM_STREAM")
        owner = next(
            (
                row for row in read_csv(G0 / "file-ownership-register.csv")
                if row.get("ownership_id") == "OWN-SYS-BE-MIG-PLATFORM"
            ),
            {},
        )
        if owner.get("path_glob") != (
            "dwp-platform-server/src/main/resources/db/migration/"
            "V{262..290}__hris_platform_<slice>.sql"
        ):
            errors.append("CONSUMER:SYS_PLATFORM_OWNER")
        notification_owner = next(
            (
                row for row in read_csv(G0 / "file-ownership-register.csv")
                if row.get("ownership_id") == "OWN-BE-MIG-NOTIFICATION"
            ),
            {},
        )
        if (
            notification_owner.get("session_id") != "CONTROL"
            or notification_owner.get("path_class")
            != "MIGRATION_EXACT_ALLOCATION_ONLY"
            or notification_owner.get("allocation_required") != "YES"
            or notification_owner.get("status")
            != "CONTROLLED_PRE_G3_V32_EXACT_V31_AND_FUTURE_PROTECTED"
        ):
            errors.append("CONSUMER:NOTIFICATION_V32_OWNERSHIP")
        g3 = next(
            (
                row for row in read_csv(
                    ROOT / "coding-readiness/g3-file-allocation-register.csv"
                )
                if row.get("allocation_id") == "G3-SYS-BE-MIGRATION"
            ),
            {},
        )
        if g3.get("path_globs") != owner.get("path_glob"):
            errors.append("CONSUMER:SYS_PLATFORM_G3_ALLOCATION")
    except (OSError, StopIteration, csv.Error) as exc:
        errors.append(f"CONSUMER:EXCEPTION:{type(exc).__name__}:{exc}")
    return errors


def synthetic_fixture() -> tuple[
    dict[str, Any],
    bytes,
    dict[str, tuple[dict[str, Any], bytes]],
    dict[str, bytes],
    dict[str, tuple[dict[str, Any], bytes]],
    dict[str, bytes],
    dict[str, tuple[dict[str, Any], bytes]],
    dict[str, Any],
]:
    source = {
        "repository": "DWP_BACKEND",
        "baselineCommit": BASELINE_COMMIT,
        "finalCommit": "1" * 40,
        "finalTree": "2" * 40,
        "baselineAncestorRequired": True,
        "requiredWorktreeState": "CLEAN",
    }
    migration_files = []
    for index, (path, expected) in enumerate(EXPECTED_FILES.items(), 1):
        migration_files.append(
            {
                "path": path,
                "service": expected[0],
                "streamKey": expected[1],
                "flywayKind": expected[2],
                "version": expected[3],
                "authorizationClass": expected[4],
                "fileMode": "100644",
                "gitBlobOid": f"{index:x}" * 40,
                "sha256": f"{index:x}" * 64,
                "byteLength": 100 + index,
            }
        )
    allocation = seal(
        {
            "contractId": ALLOCATION_ID,
            "schemaVersion": 1,
            "status": "SEALED_TECHNICAL_ALLOCATION_NO_START_AUTHORITY",
            "effectiveGate": "CLOSED_FAIL_SAFE",
            "moduleStartAuthorization": "NONE",
            "productionAuthorization": "NOT_AUTHORIZED_G6",
            "source": source,
            "migrationFiles": migration_files,
            "immutablePredecessorSets": [
                {
                    "streamKey": "approval-main",
                    "migrationDir": "dwp-approval-server/src/main/resources/db/migration",
                    "baselineHighWater": 35,
                    "fileCount": 35,
                    "manifestSha256": "7" * 64,
                    "mutationPolicy": "BASELINE_GIT_BLOB_SHA256_AND_LENGTH_IMMUTABLE",
                },
                {
                    "streamKey": "platform-main",
                    "migrationDir": "dwp-platform-server/src/main/resources/db/migration",
                    "baselineHighWater": 260,
                    "fileCount": 211,
                    "manifestSha256": "8" * 64,
                    "mutationPolicy": "BASELINE_GIT_BLOB_SHA256_AND_LENGTH_IMMUTABLE",
                },
                {
                    "streamKey": "notification-main",
                    "migrationDir": "dwp-notification-server/src/main/resources/db/migration",
                    "baselineHighWater": 30,
                    "fileCount": 30,
                    "manifestSha256": "9" * 64,
                    "mutationPolicy": "BASELINE_GIT_BLOB_SHA256_AND_LENGTH_IMMUTABLE",
                },
            ],
            "governance": {
                "approvalCommonFoundation": {
                    "beforeHighWater": 35, "afterHighWater": 38,
                    "versions": [36, 37, 38],
                },
                "platformCommonFoundation": {
                    "beforeHighWater": 260, "afterHighWater": 261,
                    "files": ["V254.1", "V261"],
                },
                "sysPlatformModuleReservation": {
                    "allocationId": "MIG-SYS-PLATFORM-262-290",
                    "baselineHighWater": 261, "start": 262, "end": 290,
                    "slotCount": 29,
                    "state": "RESERVED_G3_RANGE_NOT_IMPLEMENTED",
                },
                "outOfOrderException": {
                    "normalOutOfOrderAllowed": False,
                    "onlyVersion": "254.1",
                    "onlyFile": "V254_1__bridge_platform_trigger_inventory_before_v255.sql",
                    "precondition": "EXACT_IGNORED_BRIDGE_AND_SUCCESSFUL_V255",
                    "execution": (
                        "ONE_BOUNDED_TARGET_254_1_OUT_OF_ORDER_TRUE_THEN_"
                        "LATEST_OUT_OF_ORDER_FALSE"
                    ),
                    "historyMutationAllowed": False,
                },
                "notificationProtectedBoundary": {
                    "service": "dwp-notification-server",
                    "baselineHighWater": 30,
                    "excludedVersion": 31,
                    "state": "EXTERNAL_WIP_OUT_OF_SCOPE_PROTECTED_OWNER_HANDOFF",
                },
                "notificationCommonFoundation": {
                    "beforeHighWater": 30,
                    "afterHighWater": 32,
                    "includedVersion": 32,
                    "protectedAbsentVersion": 31,
                    "role": "PRE_G3_FORWARD_ONLY_TRIGGER_EXECUTION_BOUNDARY",
                },
                "oldChecksumEditAllowed": False,
            },
        }
    )
    allocation_bytes = canonical_file(allocation)
    evidence_docs: dict[str, tuple[dict[str, Any], bytes]] = {}
    junit_docs: dict[str, bytes] = {}
    observation_docs: dict[str, tuple[dict[str, Any], bytes]] = {}
    notification_junit_docs: dict[str, bytes] = {}
    notification_observation_docs: dict[
        str, tuple[dict[str, Any], bytes]
    ] = {}
    for image in EVIDENCE_PATHS:
        junit_cases = "".join(
            '<testcase classname="' + JUNIT_SUITE + '" name="'
            + name + '"/>'
            for name in sorted(EXPECTED_JUNIT_CASE_NAMES.values())
        )
        junit_bytes = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<testsuite name="' + JUNIT_SUITE + '" tests="'
            + str(len(EXPECTED_JUNIT_CASE_IDS))
            + '" failures="0" errors="0" skipped="0">'
            + junit_cases + '</testsuite>\n'
        ).encode("utf-8")
        junit_docs[image] = junit_bytes
        junit_result = parse_junit(junit_bytes)
        observation = {
            "schema": OBSERVATION_ID,
            "postgresImage": image,
            **expected_observations(),
        }
        observation_bytes = canonical_file(observation)
        observation_docs[image] = (observation, observation_bytes)
        notification_junit_cases = "".join(
            '<testcase classname="' + NOTIFICATION_JUNIT_SUITE + '" name="'
            + name + '"/>'
            for name in sorted(EXPECTED_NOTIFICATION_SCENARIOS)
        )
        notification_junit_bytes = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<testsuite name="' + NOTIFICATION_JUNIT_SUITE + '" tests="'
            + str(len(EXPECTED_NOTIFICATION_JUNIT_CASE_IDS))
            + '" failures="0" errors="0" skipped="0">'
            + notification_junit_cases + '</testsuite>\n'
        ).encode("utf-8")
        notification_junit_docs[image] = notification_junit_bytes
        notification_junit_result = parse_junit(
            notification_junit_bytes,
            suite=NOTIFICATION_JUNIT_SUITE,
            expected_case_ids=EXPECTED_NOTIFICATION_JUNIT_CASE_IDS,
        )
        notification_observation = {
            "schema": NOTIFICATION_OBSERVATION_ID,
            "postgresImage": image,
            **expected_notification_observations(),
        }
        notification_observation_bytes = canonical_file(
            notification_observation
        )
        notification_observation_docs[image] = (
            notification_observation,
            notification_observation_bytes,
        )
        evidence = seal(
            {
                "schema": EVIDENCE_ID,
                "status": "PASS",
                "postgresImage": image,
                "containerImage": {
                    "requested": image,
                    "resolvedRepositoryDigest": "postgres@sha256:" + "f" * 64,
                },
                "source": {
                    "repository": "DWP_BACKEND",
                    "commit": source["finalCommit"],
                    "tree": source["finalTree"],
                },
                "testSource": {
                    "path": TEST_SOURCE_PATH,
                    "fileMode": "100644",
                    "gitBlobOid": "e" * 40,
                    "sha256": "e" * 64,
                    "byteLength": 1000,
                },
                "notificationTestSource": {
                    "path": NOTIFICATION_TEST_SOURCE_PATH,
                    "fileMode": "100644",
                    "gitBlobOid": "d" * 40,
                    "sha256": "d" * 64,
                    "byteLength": 2000,
                },
                "command": COMMANDS[image],
                "execution": {
                    "startedAtUtc": "2026-09-15T00:00:00Z",
                    "finishedAtUtc": "2026-09-15T00:01:00Z",
                    "durationMilliseconds": 60000,
                    "exitCode": 0,
                    "rerunTasks": True,
                    "noDaemon": True,
                    "maxWorkers": 1,
                    "stdoutSha256": "a" * 64,
                    "stderrSha256": "b" * 64,
                },
                "junit": {
                    "sourcePath": JUNIT_BUILD_PATH,
                    "preservedPath": PRESERVED_JUNIT_PATHS[image],
                    "sha256": digest(junit_bytes),
                    "byteLength": len(junit_bytes),
                    **junit_result,
                },
                "notificationJunit": {
                    "sourcePath": NOTIFICATION_JUNIT_BUILD_PATH,
                    "preservedPath": PRESERVED_NOTIFICATION_JUNIT_PATHS[image],
                    "sha256": digest(notification_junit_bytes),
                    "byteLength": len(notification_junit_bytes),
                    **notification_junit_result,
                },
                "observationSource": {
                    "path": OBSERVATION_PATHS[image],
                    "sha256": digest(observation_bytes),
                    "byteLength": len(observation_bytes),
                },
                "observations": expected_observations(),
                "notificationObservationSource": {
                    "path": NOTIFICATION_OBSERVATION_PATHS[image],
                    "sha256": digest(notification_observation_bytes),
                    "byteLength": len(notification_observation_bytes),
                },
                "notificationObservations": expected_notification_observations(),
            }
        )
        evidence_bytes = canonical_file(evidence)
        evidence_docs[image] = (evidence, evidence_bytes)
    review = seal(
        {
            "contractId": REVIEW_ID,
            "schemaVersion": 1,
            "status": "INTERNAL_TECHNICAL_REVIEW_PASS_G3_ENTRY_ONLY",
            "effectiveGate": "CLOSED_FAIL_SAFE",
            "moduleStartAuthorization": "NONE",
            "productionAuthorization": "NOT_AUTHORIZED_G6",
            "allocationRef": {
                "path": "g0/pre-g3-common-foundation-migration-allocation.v1.json",
                "sha256": digest(allocation_bytes),
                "byteLength": len(allocation_bytes),
                "sealedPayloadSha256": allocation["sealedPayloadSha256"],
            },
            "authority": {
                "reviewAuthorityRole": "ROLE.DBA_AUTHORITY",
                "reviewAuthorityScope": "INTERNAL_TECHNICAL_REVIEW_ONLY",
                "identityAttestation": "NO_EXTERNAL_IDENTITY_ATTESTATION",
                "g6Boundary": "G6_APPROVAL_NOT_SATISFIED",
                "namedPersonApprovalClaimed": False,
            },
            "decisions": [
                {"subject": subject, "decision": decision, "g6Effect": "NONE"}
                for subject, decision in {
                    "APPROVAL_V36_V38": (
                        "TECHNICALLY_ACCEPTED_PRE_G3_COMMON_SECURITY_FOUNDATION"
                    ),
                    "PLATFORM_V254_1_V261": (
                        "TECHNICALLY_ACCEPTED_PRE_G3_COMMON_PLATFORM_FOUNDATION"
                    ),
                    "SYS_PLATFORM_V262_V290": (
                        "TECHNICALLY_ACCEPTED_G3_RESERVATION_REBASE_NOT_IMPLEMENTATION"
                    ),
                    "NOTIFICATION_V32": (
                        "TECHNICALLY_ACCEPTED_PRE_G3_COMMON_SECURITY_FOUNDATION"
                    ),
                    "NOTIFICATION_V31": (
                        "EXCLUDED_EXTERNAL_WIP_OWNER_HANDOFF_REQUIRED"
                    ),
                }.items()
            ],
            "postgresEvidence": [
                {
                    "postgresImage": image,
                    "path": EVIDENCE_PATHS[image],
                    "sha256": digest(evidence_docs[image][1]),
                    "byteLength": len(evidence_docs[image][1]),
                }
                for image in EVIDENCE_PATHS
            ],
            "technicalFindings": {
                "oldMigrationSqlMutation": "NONE",
                "oldFlywayChecksumMutation": "NONE",
                "freshDatabasePath": "IMMUTABLE_VERSIONED_STREAM",
                "existingDatabaseAuthority": "IMMUTABLE_VERSIONED_MIGRATIONS",
                "outOfOrderPolicy": (
                    "EXACT_V254_1_ONE_TIME_CONTROLLED_EXCEPTION_ONLY"
                ),
                "v261Role": "FORWARD_CORRECTION_AND_FINAL_BOUNDARY",
                "notificationV32Role": (
                    "FORWARD_ONLY_SLA_DELIVERY_TRIGGER_EXECUTION_BOUNDARY"
                ),
                "notificationV31": "EXCLUDED_EXTERNAL_OWNER_HANDOFF",
                "sysPlatformRange": "V262_V290_UNUSED_29_SLOT_RESERVATION",
                "productionEffect": "NONE_G6_REMAINS_CLOSED",
            },
        }
    )
    return (
        allocation,
        allocation_bytes,
        evidence_docs,
        junit_docs,
        observation_docs,
        notification_junit_docs,
        notification_observation_docs,
        review,
    )


def self_test() -> dict[str, bool]:
    (
        base, base_bytes, evidence, junit, observations,
        notification_junit, notification_observations, review,
    ) = synthetic_fixture()
    cases: list[tuple[str, str, Callable[[dict[str, Any]], None]]] = [
        ("allocation-open-gate", "allocation", lambda d: d.update({"effectiveGate": "OPEN"})),
        ("allocation-module-authority", "allocation", lambda d: d.update({"moduleStartAuthorization": "GRANTED"})),
        ("allocation-production-authority", "allocation", lambda d: d.update({"productionAuthorization": "AUTHORIZED_G6"})),
        ("allocation-baseline-commit", "allocation", lambda d: d["source"].update({"baselineCommit": "0" * 40})),
        ("allocation-final-commit-shape", "allocation", lambda d: d["source"].update({"finalCommit": "0"})),
        ("allocation-final-tree-shape", "allocation", lambda d: d["source"].update({"finalTree": "0"})),
        ("allocation-missing-file", "allocation", lambda d: d["migrationFiles"].pop()),
        ("allocation-extra-file", "allocation", lambda d: d["migrationFiles"].append(copy.deepcopy(d["migrationFiles"][0]))),
        ("allocation-wrong-version", "allocation", lambda d: d["migrationFiles"][0].update({"version": "39"})),
        ("allocation-symlink-mode", "allocation", lambda d: d["migrationFiles"][0].update({"fileMode": "120000"})),
        ("allocation-invalid-blob", "allocation", lambda d: d["migrationFiles"][0].update({"gitBlobOid": "0"})),
        ("allocation-invalid-sha", "allocation", lambda d: d["migrationFiles"][0].update({"sha256": "0"})),
        ("allocation-zero-length", "allocation", lambda d: d["migrationFiles"][0].update({"byteLength": 0})),
        ("allocation-old-manifest-drift", "allocation", lambda d: d["immutablePredecessorSets"][0].update({"manifestSha256": "0"})),
        ("allocation-missing-immutable-set", "allocation", lambda d: d["immutablePredecessorSets"].pop()),
        ("allocation-deferred-baseline-field", "allocation", lambda d: d.update({"baselineOptimization": {"state": "FORBIDDEN"}})),
        ("allocation-deferred-baseline-file", "allocation", lambda d: d["governance"]["platformCommonFoundation"].update({"files": ["V254.1", "B260", "V261"]})),
        ("allocation-broad-out-of-order", "allocation", lambda d: d["governance"]["outOfOrderException"].update({"normalOutOfOrderAllowed": True})),
        ("allocation-wrong-out-of-order-file", "allocation", lambda d: d["governance"]["outOfOrderException"].update({"onlyFile": "V255__wrong.sql"})),
        ("allocation-checksum-edit", "allocation", lambda d: d["governance"].update({"oldChecksumEditAllowed": True})),
        ("allocation-sys-range", "allocation", lambda d: d["governance"]["sysPlatformModuleReservation"].update({"start": 261})),
        ("allocation-notification-included", "allocation", lambda d: d["governance"]["notificationProtectedBoundary"].update({"state": "INCLUDED"})),
        ("allocation-reciprocal-review-ref", "allocation", lambda d: d.update({"reviewRef": "forbidden"})),
        ("allocation-seal-missing", "allocation", lambda d: d.pop("sealedPayloadSha256")),
        ("allocation-seal-invalid", "allocation", lambda d: d.update({"sealedPayloadSha256": "0" * 64})),
        ("review-fake-name", "review", lambda d: d.update({"reviewerName": "Fake Person"})),
        ("review-wrong-role", "review", lambda d: d["authority"].update({"reviewAuthorityRole": "ROLE.PROGRAM_OWNER"})),
        ("review-external-attestation", "review", lambda d: d["authority"].update({"identityAttestation": "ATTESTED"})),
        ("review-named-person", "review", lambda d: d["authority"].update({"namedPersonApprovalClaimed": True})),
        ("review-g6-satisfied", "review", lambda d: d["authority"].update({"g6Boundary": "SATISFIED"})),
        ("review-open-gate", "review", lambda d: d.update({"effectiveGate": "OPEN"})),
        ("review-module-authority", "review", lambda d: d.update({"moduleStartAuthorization": "GRANTED"})),
        ("review-production-authority", "review", lambda d: d.update({"productionAuthorization": "AUTHORIZED_G6"})),
        ("review-allocation-pin", "review", lambda d: d["allocationRef"].update({"sha256": "0" * 64})),
        ("review-missing-pg18", "review", lambda d: d["postgresEvidence"].pop()),
        ("review-duplicate-pg16", "review", lambda d: d["postgresEvidence"][1].update({"postgresImage": "postgres:16-alpine"})),
        ("review-wrong-evidence-path", "review", lambda d: d["postgresEvidence"][0].update({"path": "wrong.json"})),
        ("review-notification-v32-decision", "review", lambda d: next(row for row in d["decisions"] if row["subject"] == "NOTIFICATION_V32").update({"decision": "EXCLUDED"})),
        ("review-notification-v31-decision", "review", lambda d: next(row for row in d["decisions"] if row["subject"] == "NOTIFICATION_V31").update({"decision": "INCLUDED"})),
        ("review-old-sql-mutation", "review", lambda d: d["technicalFindings"].update({"oldMigrationSqlMutation": "ALLOWED"})),
        ("review-seal-missing", "review", lambda d: d.pop("sealedPayloadSha256")),
        ("review-seal-invalid", "review", lambda d: d.update({"sealedPayloadSha256": "0" * 64})),
        ("evidence-error", "evidence16", lambda d: d["execution"].update({"exitCode": 1})),
        ("evidence-source-drift", "evidence16", lambda d: d["source"].update({"commit": "0" * 40})),
        ("evidence-command-drift", "evidence16", lambda d: d.update({"command": "./gradlew test"})),
        ("evidence-container-digest", "evidence16", lambda d: d["containerImage"].update({"resolvedRepositoryDigest": "sha256:" + "0" * 64})),
        ("evidence-test-source-path", "evidence16", lambda d: d["testSource"].update({"path": "wrong.java"})),
        ("evidence-test-source-pin", "evidence16", lambda d: d["testSource"].update({"sha256": "0"})),
        ("evidence-notification-test-source-path", "evidence16", lambda d: d["notificationTestSource"].update({"path": "wrong.java"})),
        ("evidence-stdout-digest", "evidence16", lambda d: d["execution"].update({"stdoutSha256": "0"})),
        ("evidence-junit-preserved-path", "evidence16", lambda d: d["junit"].update({"preservedPath": "wrong.xml"})),
        ("evidence-observation-pin", "evidence16", lambda d: d["observationSource"].update({"sha256": "0" * 64})),
        ("evidence-failure", "evidence16", lambda d: d["junit"].update({"failures": 1})),
        ("evidence-skipped", "evidence16", lambda d: d["junit"].update({"skipped": 1})),
        ("evidence-junit-case-set", "evidence16", lambda d: d["junit"]["caseIds"].__setitem__(0, f"{JUNIT_SUITE}#unexpected")),
        ("evidence-notification-junit-missing-case", "evidence16", lambda d: d["notificationJunit"]["caseIds"].pop()),
        ("evidence-notification-junit-failure", "evidence16", lambda d: d["notificationJunit"].update({"failures": 1})),
        ("evidence-trigger-count", "evidence16", lambda d: d["observations"].update({"triggerMappingCount": 73})),
        ("evidence-trigger-digest", "evidence16", lambda d: d["observations"].update({"triggerMappingSha256": "0" * 64})),
        ("evidence-bridge-remains", "evidence16", lambda d: d["observations"].update({"finalBridgeSchemaCount": 1})),
        ("evidence-database-create", "evidence16", lambda d: d["observations"].update({"migrationPrincipalDatabaseCreateAtExit": True})),
        ("evidence-missing-retry", "evidence16", lambda d: d["observations"].update({"verifiedScenarioIds": sorted(EXPECTED_SCENARIOS - {"bridge-failure-retry"})})),
        ("evidence-notification-boundary-digest", "evidence16", lambda d: d["notificationObservations"].update({"triggerBoundaryTupleSha256": "0" * 64})),
        ("evidence-notification-runtime-execute", "evidence16", lambda d: d["notificationObservations"].update({"directRuntimeExecuteGrantCount": 1})),
        ("evidence-notification-retry-history", "evidence16", lambda d: d["notificationObservations"].update({"successfulV32HistoryCount": 2})),
        ("evidence-seal-missing", "evidence16", lambda d: d.pop("sealedPayloadSha256")),
        ("evidence-seal-invalid", "evidence16", lambda d: d.update({"sealedPayloadSha256": "0" * 64})),
    ]
    results: dict[str, bool] = {}
    baseline_errors = validate_allocation(base, check_repository=False)
    baseline_errors.extend(validate_review(
        review,
        base,
        base_bytes,
        evidence_docs=evidence,
        junit_docs=junit,
        notification_junit_docs=notification_junit,
        observation_docs=observations,
        notification_observation_docs=notification_observations,
    ))
    results["baseline-valid"] = not baseline_errors
    for name, target, mutation in cases:
        allocation = copy.deepcopy(base)
        allocation_bytes = canonical_file(allocation)
        evidence_docs = copy.deepcopy(evidence)
        candidate_review = copy.deepcopy(review)
        if target == "allocation":
            mutation(allocation)
            if name not in {"allocation-seal-missing", "allocation-seal-invalid"}:
                seal(allocation)
            errors = validate_allocation(allocation, check_repository=False)
        elif target == "review":
            mutation(candidate_review)
            if name not in {"review-seal-missing", "review-seal-invalid"}:
                seal(candidate_review)
            errors = validate_review(
                candidate_review, allocation, allocation_bytes,
                evidence_docs=evidence_docs,
                junit_docs=junit,
                notification_junit_docs=notification_junit,
                observation_docs=observations,
                notification_observation_docs=notification_observations,
            )
        else:
            candidate, _old_bytes = evidence_docs["postgres:16-alpine"]
            mutation(candidate)
            if name not in {"evidence-seal-missing", "evidence-seal-invalid"}:
                seal(candidate)
            candidate_bytes = canonical_file(candidate)
            evidence_docs["postgres:16-alpine"] = (candidate, candidate_bytes)
            candidate_review["postgresEvidence"][0].update(
                {"sha256": digest(candidate_bytes), "byteLength": len(candidate_bytes)}
            )
            seal(candidate_review)
            errors = validate_review(
                candidate_review, allocation, allocation_bytes,
                evidence_docs=evidence_docs,
                junit_docs=junit,
                notification_junit_docs=notification_junit,
                observation_docs=observations,
                notification_observation_docs=notification_observations,
            )
        results[name] = bool(errors)
    image = "postgres:16-alpine"
    changed_observations = copy.deepcopy(observations)
    observation_doc = changed_observations[image][0]
    observation_doc["triggerMappingCount"] = 69
    observation_bytes = canonical_file(observation_doc)
    changed_observations[image] = (observation_doc, observation_bytes)
    results["joint-observation-replacement"] = bool(
        validate_observation_document(observation_doc, image)
    )
    changed_notification = copy.deepcopy(notification_observations)
    notification_doc = changed_notification[image][0]
    notification_doc["triggerBoundaryTupleCount"] = 4
    results["joint-notification-observation-replacement"] = bool(
        validate_notification_observation_document(notification_doc, image)
    )
    try:
        results["timestamp-rfc3339-z-accepted"] = (
            parse_utc_timestamp("2026-09-15T00:00:00.123456Z").utcoffset()
            == timedelta(0)
        )
    except ValueError:
        results["timestamp-rfc3339-z-accepted"] = False
    try:
        results["timestamp-zero-offset-accepted"] = (
            parse_utc_timestamp("2026-09-15T00:00:00+00:00").utcoffset()
            == timedelta(0)
        )
    except ValueError:
        results["timestamp-zero-offset-accepted"] = False
    for name, hostile in {
        "timestamp-non-utc-offset-rejected": "2026-09-15T09:00:00+09:00",
        "timestamp-naive-rejected": "2026-09-15T00:00:00",
        "timestamp-invalid-rejected": "not-a-timestamp",
    }.items():
        try:
            parse_utc_timestamp(hostile)
            results[name] = False
        except ValueError:
            results[name] = True
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    arguments = parser.parse_args()
    errors: list[str] = []
    try:
        allocation, allocation_bytes = load(ALLOCATION)
        review, _review_bytes = load(REVIEW)
        errors.extend(validate_allocation(allocation, check_repository=True))
        evidence_docs: dict[str, tuple[dict[str, Any], bytes]] = {}
        junit_docs: dict[str, bytes] = {}
        observation_docs: dict[str, tuple[dict[str, Any], bytes]] = {}
        notification_junit_docs: dict[str, bytes] = {}
        notification_observation_docs: dict[
            str, tuple[dict[str, Any], bytes]
        ] = {}
        for image, relative in EVIDENCE_PATHS.items():
            evidence_docs[image] = load(ROOT / relative)
            junit_path = ROOT / PRESERVED_JUNIT_PATHS[image]
            observation_path = ROOT / OBSERVATION_PATHS[image]
            notification_junit_path = (
                ROOT / PRESERVED_NOTIFICATION_JUNIT_PATHS[image]
            )
            notification_observation_path = (
                ROOT / NOTIFICATION_OBSERVATION_PATHS[image]
            )
            if (
                not junit_path.is_file()
                or junit_path.is_symlink()
                or not observation_path.is_file()
                or observation_path.is_symlink()
                or not notification_junit_path.is_file()
                or notification_junit_path.is_symlink()
                or not notification_observation_path.is_file()
                or notification_observation_path.is_symlink()
            ):
                raise ValueError(f"unsafe/missing preserved evidence for {image}")
            junit_docs[image] = junit_path.read_bytes()
            observation_docs[image] = load(observation_path)
            notification_junit_docs[image] = (
                notification_junit_path.read_bytes()
            )
            notification_observation_docs[image] = load(
                notification_observation_path
            )
        errors.extend(
            validate_review(
                review,
                allocation,
                allocation_bytes,
                evidence_docs=evidence_docs,
                junit_docs=junit_docs,
                notification_junit_docs=notification_junit_docs,
                observation_docs=observation_docs,
                notification_observation_docs=notification_observation_docs,
                check_repository=True,
            )
        )
        errors.extend(validate_authority_consumers())
    except (OSError, ValueError, json.JSONDecodeError, UnicodeError) as exc:
        errors.append(f"LOAD:{type(exc).__name__}:{exc}")
    hostile = self_test() if arguments.self_test else {}
    failed = sorted(name for name, rejected in hostile.items() if not rejected)
    if failed:
        errors.append("SELF_TEST:" + "|".join(failed))
    result = {
        "schema": "dwp.hris.pre-g3-common-foundation-migration-validation.v1",
        "status": "PASS" if not errors else "FAIL",
        "scope": "PRE_G3_TECHNICAL_ONLY_NO_G6_NO_EXTERNAL_IDENTITY",
        "migrationFileCount": len(EXPECTED_FILES),
        "postgresEvidenceCount": 2,
        "selfTests": (
            {"total": len(hostile), "passed": sum(hostile.values())}
            if arguments.self_test else None
        ),
        "errors": errors,
    }
    print(
        json.dumps(
            result,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":") if arguments.compact else None,
            indent=None if arguments.compact else 2,
        )
    )
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
