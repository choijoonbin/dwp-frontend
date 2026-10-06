#!/usr/bin/env python3
"""Create the pre-G3 allocation and its one-way technical review in order."""

from __future__ import annotations

import argparse
import json
import os
import stat
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from validate_pre_g3_common_foundation_migrations import (
    ALLOCATION,
    ALLOCATION_ID,
    BACKEND,
    BASELINE_COMMIT,
    EVIDENCE_PATHS,
    EXPECTED_FILES,
    NOTIFICATION_OBSERVATION_PATHS,
    OBSERVATION_PATHS,
    PRESERVED_NOTIFICATION_JUNIT_PATHS,
    PRESERVED_JUNIT_PATHS,
    REVIEW,
    REVIEW_ID,
    ROOT,
    canonical_file,
    commit_blob,
    digest,
    git,
    immutable_manifest,
    load,
    seal,
    validate_allocation,
    validate_evidence,
    validate_review,
)

FOUNDATION_DECISION = "FINAL_VERSIONED_STREAM_ONLY"
FINAL_FOUNDATION_PROFILE = "FINAL_VERSIONED_STREAM_ONLY"


def _same_identity(left: os.stat_result, right: os.stat_result) -> bool:
    return (left.st_dev, left.st_ino) == (right.st_dev, right.st_ino)


def _create_new_exact(
    path: Path,
    data: bytes,
    *,
    allowed_paths: frozenset[Path],
    required_parent: Path,
) -> None:
    if path not in allowed_paths or path.parent != required_parent:
        raise ValueError(f"non-receipt output path forbidden: {path}")
    parent_before = required_parent.lstat()
    if required_parent.is_symlink() or not stat.S_ISDIR(parent_before.st_mode):
        raise ValueError(f"unsafe receipt parent: {required_parent}")
    parent_flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0)
    parent_flags |= getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    parent_descriptor = os.open(required_parent, parent_flags)
    descriptor: int | None = None
    created = False
    try:
        if not _same_identity(parent_before, os.fstat(parent_descriptor)):
            raise ValueError("receipt parent changed while opened")
        if path.is_symlink():
            raise ValueError(f"symlink receipt target forbidden: {path}")
        if path.exists():
            raise FileExistsError(f"CREATE_NEW_ONLY receipt already exists: {path}")
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_CLOEXEC", 0)
        flags |= getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(path.name, flags, 0o600, dir_fd=parent_descriptor)
        created = True
        os.fchmod(descriptor, 0o600)
        opened = os.fstat(descriptor)
        if not stat.S_ISREG(opened.st_mode):
            raise ValueError("receipt target is not a regular file")
        with os.fdopen(descriptor, "wb", closefd=False) as handle:
            handle.write(data)
            handle.flush()
            os.fsync(descriptor)
        written = os.fstat(descriptor)
        linked = os.stat(path.name, dir_fd=parent_descriptor, follow_symlinks=False)
        if (
            not _same_identity(opened, written)
            or not _same_identity(written, linked)
            or not stat.S_ISREG(linked.st_mode)
            or stat.S_IMODE(linked.st_mode) != 0o600
            or linked.st_size != len(data)
        ):
            raise ValueError("receipt target identity/mode/length changed while written")
        os.fsync(parent_descriptor)
    except Exception:
        if created:
            try:
                os.unlink(path.name, dir_fd=parent_descriptor)
                os.fsync(parent_descriptor)
            except OSError:
                pass
        raise
    finally:
        if descriptor is not None:
            os.close(descriptor)
        os.close(parent_descriptor)


def create_receipt_new(path: Path, data: bytes) -> None:
    """Create exactly one of the two canonical receipts, never an intake file."""
    for ancestor in (ROOT, ALLOCATION.parent):
        state = ancestor.lstat()
        if ancestor.is_symlink() or not stat.S_ISDIR(state.st_mode):
            raise ValueError(f"unsafe receipt ancestor: {ancestor}")
    _create_new_exact(
        path,
        data,
        allowed_paths=frozenset({ALLOCATION, REVIEW}),
        required_parent=ALLOCATION.parent,
    )


def require_receipt_order(
    write_allocation: bool,
    allocation_path: Path = ALLOCATION,
    review_path: Path = REVIEW,
) -> None:
    if write_allocation:
        if review_path.exists() or review_path.is_symlink():
            raise ValueError("review cannot pre-exist its allocation")
        if allocation_path.exists() or allocation_path.is_symlink():
            raise FileExistsError("allocation is CREATE_NEW_ONLY")
    else:
        if (
            not allocation_path.is_file()
            or allocation_path.is_symlink()
            or not stat.S_ISREG(allocation_path.lstat().st_mode)
        ):
            raise ValueError("exact regular allocation must exist before technical review")
        if review_path.exists() or review_path.is_symlink():
            raise FileExistsError("technical review is CREATE_NEW_ONLY")


def pin(commit: str, path: str, *, include_mode: bool) -> dict[str, Any]:
    mode, oid, content = commit_blob(commit, path)
    if mode != "100644":
        raise ValueError(f"committed input is not regular 100644: {path}")
    result: dict[str, Any] = {
        "path": path,
        "gitBlobOid": oid,
        "sha256": digest(content),
        "byteLength": len(content),
    }
    if include_mode:
        result["fileMode"] = mode
    return result


def clean_source() -> dict[str, str]:
    head = str(git("rev-parse", "HEAD"))
    tree = str(git("rev-parse", "HEAD^{tree}"))
    if str(git("status", "--porcelain=v1", "--untracked-files=all")):
        raise ValueError("backend receipt materialization requires a clean worktree")
    ancestry = subprocess.run(
        ["git", "-C", str(BACKEND), "merge-base", "--is-ancestor", BASELINE_COMMIT, head],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if ancestry.returncode:
        raise ValueError("sealed backend baseline is not an ancestor")
    return {
        "repository": "DWP_BACKEND",
        "baselineCommit": BASELINE_COMMIT,
        "finalCommit": head,
        "finalTree": tree,
        "baselineAncestorRequired": True,
        "requiredWorktreeState": "CLEAN",
    }


def build_allocation() -> dict[str, Any]:
    if FOUNDATION_DECISION != FINAL_FOUNDATION_PROFILE:
        raise ValueError(
            "foundation profile is not the final versioned-stream-only decision"
        )
    source = clean_source()
    commit = source["finalCommit"]
    migration_files: list[dict[str, Any]] = []
    for path, semantics in EXPECTED_FILES.items():
        service, stream, kind, version, authorization = semantics
        migration_files.append(
            {
                **pin(commit, path, include_mode=True),
                "service": service,
                "streamKey": stream,
                "flywayKind": kind,
                "version": version,
                "authorizationClass": authorization,
            }
        )
    immutable_sets = []
    for stream, directory, high_water in (
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
        rows, manifest_sha = immutable_manifest(
            BASELINE_COMMIT, directory, high_water
        )
        immutable_sets.append(
            {
                "streamKey": stream,
                "migrationDir": directory,
                "baselineHighWater": high_water,
                "fileCount": len(rows),
                "manifestSha256": manifest_sha,
                "mutationPolicy": (
                    "BASELINE_GIT_BLOB_SHA256_AND_LENGTH_IMMUTABLE"
                ),
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
            "immutablePredecessorSets": immutable_sets,
            "governance": {
                "approvalCommonFoundation": {
                    "beforeHighWater": 35,
                    "afterHighWater": 38,
                    "versions": [36, 37, 38],
                },
                "platformCommonFoundation": {
                    "beforeHighWater": 260,
                    "afterHighWater": 261,
                    "files": ["V254.1", "V261"],
                },
                "sysPlatformModuleReservation": {
                    "allocationId": "MIG-SYS-PLATFORM-262-290",
                    "baselineHighWater": 261,
                    "start": 262,
                    "end": 290,
                    "slotCount": 29,
                    "state": "RESERVED_G3_RANGE_NOT_IMPLEMENTED",
                },
                "outOfOrderException": {
                    "normalOutOfOrderAllowed": False,
                    "onlyVersion": "254.1",
                    "onlyFile": (
                        "V254_1__bridge_platform_trigger_inventory_before_v255.sql"
                    ),
                    "precondition": (
                        "EXACT_IGNORED_BRIDGE_AND_SUCCESSFUL_V255"
                    ),
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
                    "state": (
                        "EXTERNAL_WIP_OUT_OF_SCOPE_PROTECTED_OWNER_HANDOFF"
                    ),
                },
                "notificationCommonFoundation": {
                    "beforeHighWater": 30,
                    "afterHighWater": 32,
                    "includedVersion": 32,
                    "protectedAbsentVersion": 31,
                    "role": (
                        "PRE_G3_FORWARD_ONLY_TRIGGER_EXECUTION_BOUNDARY"
                    ),
                },
                "oldChecksumEditAllowed": False,
            },
        }
    )
    errors = validate_allocation(allocation, check_repository=True)
    (
        evidence,
        junit,
        observations,
        notification_junit,
        notification_observations,
    ) = load_preserved_evidence()
    for image in EVIDENCE_PATHS:
        errors.extend(
            validate_evidence(
                evidence[image][0],
                image,
                source,
                junit_bytes=junit[image],
                notification_junit_bytes=notification_junit[image],
                observation_doc=observations[image][0],
                observation_bytes=observations[image][1],
                notification_observation_doc=(
                    notification_observations[image][0]
                ),
                notification_observation_bytes=(
                    notification_observations[image][1]
                ),
                check_repository=True,
            )
        )
    if errors:
        raise ValueError("allocation candidate invalid: " + ";".join(errors))
    return allocation


def load_preserved_evidence() -> tuple[
    dict[str, tuple[dict[str, Any], bytes]],
    dict[str, bytes],
    dict[str, tuple[dict[str, Any], bytes]],
    dict[str, bytes],
    dict[str, tuple[dict[str, Any], bytes]],
]:
    evidence: dict[str, tuple[dict[str, Any], bytes]] = {}
    junit: dict[str, bytes] = {}
    observations: dict[str, tuple[dict[str, Any], bytes]] = {}
    notification_junit: dict[str, bytes] = {}
    notification_observations: dict[
        str, tuple[dict[str, Any], bytes]
    ] = {}
    for image in EVIDENCE_PATHS:
        evidence[image] = load(ROOT / EVIDENCE_PATHS[image])
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
            raise ValueError(f"missing/unsafe preserved evidence for {image}")
        junit[image] = junit_path.read_bytes()
        observations[image] = load(observation_path)
        notification_junit[image] = notification_junit_path.read_bytes()
        notification_observations[image] = load(
            notification_observation_path
        )
    return (
        evidence,
        junit,
        observations,
        notification_junit,
        notification_observations,
    )


def build_review(
    allocation: dict[str, Any], allocation_bytes: bytes
) -> dict[str, Any]:
    current = clean_source()
    if (
        current["finalCommit"] != allocation.get("source", {}).get("finalCommit")
        or current["finalTree"] != allocation.get("source", {}).get("finalTree")
    ):
        raise ValueError("backend source advanced after allocation")
    (
        evidence,
        junit,
        observations,
        notification_junit,
        notification_observations,
    ) = load_preserved_evidence()
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
                {
                    "subject": "APPROVAL_V36_V38",
                    "decision": (
                        "TECHNICALLY_ACCEPTED_PRE_G3_COMMON_SECURITY_FOUNDATION"
                    ),
                    "g6Effect": "NONE",
                },
                {
                    "subject": "PLATFORM_V254_1_V261",
                    "decision": (
                        "TECHNICALLY_ACCEPTED_PRE_G3_COMMON_PLATFORM_FOUNDATION"
                    ),
                    "g6Effect": "NONE",
                },
                {
                    "subject": "SYS_PLATFORM_V262_V290",
                    "decision": (
                        "TECHNICALLY_ACCEPTED_G3_RESERVATION_REBASE_NOT_IMPLEMENTATION"
                    ),
                    "g6Effect": "NONE",
                },
                {
                    "subject": "NOTIFICATION_V32",
                    "decision": (
                        "TECHNICALLY_ACCEPTED_PRE_G3_COMMON_SECURITY_FOUNDATION"
                    ),
                    "g6Effect": "NONE",
                },
                {
                    "subject": "NOTIFICATION_V31",
                    "decision": "EXCLUDED_EXTERNAL_WIP_OWNER_HANDOFF_REQUIRED",
                    "g6Effect": "NONE",
                },
            ],
            "postgresEvidence": [
                {
                    "postgresImage": image,
                    "path": EVIDENCE_PATHS[image],
                    "sha256": digest(evidence[image][1]),
                    "byteLength": len(evidence[image][1]),
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
    errors = validate_review(
        review,
        allocation,
        allocation_bytes,
        evidence_docs=evidence,
        junit_docs=junit,
        notification_junit_docs=notification_junit,
        observation_docs=observations,
        notification_observation_docs=notification_observations,
        check_repository=True,
    )
    if errors:
        raise ValueError("technical review candidate invalid: " + ";".join(errors))
    return review


def self_test() -> dict[str, bool]:
    from unittest import mock

    cases: dict[str, bool] = {}
    with tempfile.TemporaryDirectory(prefix="pre-g3-receipt-selftest-") as temporary:
        parent = Path(temporary) / "receipts"
        parent.mkdir(mode=0o700)
        allocation = parent / "allocation.json"
        review = parent / "review.json"
        allowed = frozenset({allocation, review})
        payload = b'{"status":"test"}\n'
        _create_new_exact(
            allocation,
            payload,
            allowed_paths=allowed,
            required_parent=parent,
        )
        allocation_state = allocation.lstat()
        cases["create-new-regular-0600"] = (
            allocation.read_bytes() == payload
            and stat.S_ISREG(allocation_state.st_mode)
            and stat.S_IMODE(allocation_state.st_mode) == 0o600
        )
        try:
            _create_new_exact(
                allocation,
                payload,
                allowed_paths=allowed,
                required_parent=parent,
            )
            cases["existing-file-rejected"] = False
        except FileExistsError:
            cases["existing-file-rejected"] = True
        try:
            with mock.patch.object(os, "fsync", side_effect=OSError("injected")):
                _create_new_exact(
                    review,
                    payload,
                    allowed_paths=allowed,
                    required_parent=parent,
                )
            cases["partial-write-cleaned"] = False
        except OSError:
            cases["partial-write-cleaned"] = not review.exists() and not review.is_symlink()
        symlink_target = Path(temporary) / "outside.json"
        review.symlink_to(symlink_target)
        try:
            _create_new_exact(
                review,
                payload,
                allowed_paths=allowed,
                required_parent=parent,
            )
            cases["symlink-target-rejected"] = False
        except ValueError:
            cases["symlink-target-rejected"] = True
        review.unlink()
        try:
            _create_new_exact(
                Path(temporary) / "escaped.json",
                payload,
                allowed_paths=allowed,
                required_parent=parent,
            )
            cases["path-escape-rejected"] = False
        except ValueError:
            cases["path-escape-rejected"] = True
        real_parent = Path(temporary) / "real-parent"
        real_parent.mkdir()
        linked_parent = Path(temporary) / "linked-parent"
        linked_parent.symlink_to(real_parent, target_is_directory=True)
        linked_receipt = linked_parent / "receipt.json"
        try:
            _create_new_exact(
                linked_receipt,
                payload,
                allowed_paths=frozenset({linked_receipt}),
                required_parent=linked_parent,
            )
            cases["symlink-parent-rejected"] = False
        except ValueError:
            cases["symlink-parent-rejected"] = True
        order_parent = Path(temporary) / "order"
        order_parent.mkdir()
        order_allocation = order_parent / "allocation.json"
        order_review = order_parent / "review.json"
        order_review.write_bytes(payload)
        try:
            require_receipt_order(True, order_allocation, order_review)
            cases["review-before-allocation-rejected"] = False
        except ValueError:
            cases["review-before-allocation-rejected"] = True
        order_review.unlink()
        try:
            require_receipt_order(False, order_allocation, order_review)
            cases["technical-review-without-allocation-rejected"] = False
        except ValueError:
            cases["technical-review-without-allocation-rejected"] = True
        order_allocation.write_bytes(payload)
        try:
            require_receipt_order(False, order_allocation, order_review)
            cases["technical-review-after-allocation-accepted"] = True
        except (ValueError, FileExistsError):
            cases["technical-review-after-allocation-accepted"] = False
    return cases


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write-allocation", action="store_true")
    mode.add_argument("--write-technical-review", action="store_true")
    mode.add_argument("--self-test", action="store_true")
    arguments = parser.parse_args()
    try:
        if arguments.self_test:
            cases = self_test()
            failed = sorted(name for name, passed in cases.items() if not passed)
            result = {
                "status": "PASS" if not failed else "FAIL",
                "passed": sum(cases.values()),
                "total": len(cases),
                "failed": failed,
            }
        elif arguments.write_allocation:
            require_receipt_order(True)
            allocation = build_allocation()
            data = canonical_file(allocation)
            create_receipt_new(ALLOCATION, data)
            result = {
                "status": "PASS",
                "created": ALLOCATION.relative_to(ROOT).as_posix(),
                "sha256": digest(data),
                "byteLength": len(data),
                "authority": "NO_START_AUTHORITY",
            }
        else:
            require_receipt_order(False)
            allocation, allocation_bytes = load(ALLOCATION)
            if validate_allocation(allocation, check_repository=True):
                raise ValueError("existing allocation no longer validates")
            review = build_review(allocation, allocation_bytes)
            data = canonical_file(review)
            create_receipt_new(REVIEW, data)
            result = {
                "status": "PASS",
                "created": REVIEW.relative_to(ROOT).as_posix(),
                "sha256": digest(data),
                "byteLength": len(data),
                "authority": "G3_ENTRY_TECHNICAL_ONLY_NO_G6",
            }
    except Exception as exc:
        result = {
            "status": "FAIL",
            "error": f"{type(exc).__name__}:{exc}",
        }
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
