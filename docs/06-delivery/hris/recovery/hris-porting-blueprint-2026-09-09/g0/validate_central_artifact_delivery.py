#!/usr/bin/env python3
"""Validate Control-owned artifact classification, release, and consumer-sync seals.

The entry bootstrap is carried by the code-entry lineage, while later shared
changes use an append-only Control release followed by one exact consumer sync
receipt.  Integration-only artifacts are never copied to module branches.
"""

from __future__ import annotations

import argparse
import copy
import csv
import fnmatch
import hashlib
import json
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
CLASSIFICATIONS = G0 / "central-artifact-classification-register.csv"
ALLOCATIONS = ROOT / "coding-readiness/g3-file-allocation-register.csv"
RELEASES = G0 / "g3-control-release-register.csv"
RECEIPTS = G0 / "g3-control-sync-receipt-register.csv"
CHECKPOINTS = G0 / "g3-checkpoint-register.csv"
WORKTREES = G0 / "worktree-branch-register.csv"
DECISION = G0 / "current-g3-gate-decision.json"
SYNC_COMMAND_CATALOG = G0 / "control-sync-command-catalog.v1.json"
DELIVERY_STATE = G0 / "g3-control-delivery-state.json"

SHA40 = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
ISO_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")
SESSIONS = {"HRIS-HRM", "HRIS-PER", "HRIS-PAY", "HRIS-TIM", "HRIS-SYS"}
ENTRY_BOOTSTRAP_CLASSES = {
    "CENTRAL-CLASS-001",
    "CENTRAL-CLASS-002",
    "CENTRAL-CLASS-008",
}
CLASSIFICATION_HEADER = [
    "classification_id", "artifact_class", "repository", "path_globs",
    "allocation_ids", "producer_session", "allowed_consumers", "delivery_mode",
    "source_provenance_requirement", "consumer_receipt_required",
    "module_direct_touch_allowed", "state",
]
RELEASE_HEADER = [
    "release_seq", "release_id", "artifact_classification_id",
    "producer_checkpoint_id", "predecessor_release_id", "repository",
    "source_head_sha", "source_tree_sha", "path_manifest_ref",
    "path_manifest_sha256", "release_commit_sha", "consumer_session_ids",
    "recorded_at", "status",
]
RECEIPT_HEADER = [
    "receipt_seq", "receipt_id", "release_id", "consumer_session_id",
    "repository", "predecessor_head_sha", "successor_head_sha",
    "source_commit_sha", "path_manifest_sha256", "conflict_count",
    "compile_evidence_ref", "compile_evidence_sha256", "recorded_at", "status",
    "compile_output_ref", "compile_output_sha256",
]
RELEASE_MANIFEST_FIELDS = {
    "schema", "releaseId", "classificationId", "producerCheckpointId",
    "predecessorReleaseId", "repository", "sourceHeadSha", "sourceTreeSha",
    "releaseCommitSha", "consumerSessionIds", "artifacts", "recordedAt", "status",
}
ARTIFACT_FIELDS = {"path", "gitBlobOid", "byteSha256", "size"}
COMPILE_RECEIPT_FIELDS = {
    "schema", "receiptId", "releaseId", "consumerSessionId", "repository",
    "predecessorHeadSha", "successorHeadSha", "sourceCommitSha",
    "pathManifestSha256", "argv", "argvSha256", "outputSha256", "exitCode",
    "conflictCount", "startedAt", "endedAt", "status",
    "outputRef",
}
DELIVERY_STATE_FIELDS = {
    "schema", "transactionSeq", "phase",
    "priorReleaseRegisterSha256", "priorReceiptRegisterSha256",
    "candidateReleaseRegisterSha256", "candidateReceiptRegisterSha256",
    "releaseRegisterSha256", "receiptRegisterSha256",
    "releaseId", "receiptIds", "releaseSeq", "receiptSeq",
    "bundleRef", "bundleSha256", "preparedAt", "committedAt",
    "priorState", "status",
}


def delivery_state_errors(
    payload: object,
    release_digest: str,
    receipt_digest: str,
    *,
    has_rows: bool,
    release_rows: list[dict[str, str]] | None = None,
    receipt_rows: list[dict[str, str]] | None = None,
) -> list[str]:
    if not isinstance(payload, dict) or set(payload) != DELIVERY_STATE_FIELDS:
        return ["Control delivery transaction state schema drift"]
    expected_status = "CONTROL_DELIVERY_TRANSACTION_COMMITTED" if has_rows else "HEADER_ONLY_CLOSED_GATE"
    transaction_seq = payload.get("transactionSeq")
    release_seq = payload.get("releaseSeq")
    receipt_seq = payload.get("receiptSeq")
    receipt_ids = payload.get("receiptIds")
    prepared_at = parse_utc(payload.get("preparedAt"))
    committed_at = parse_utc(payload.get("committedAt"))
    row_binding_valid = True
    if release_rows is not None and receipt_rows is not None:
        latest_release = release_rows[-1] if release_rows else {}
        latest_receipt_ids = sorted(
            row.get("receipt_id", "")
            for row in receipt_rows
            if row.get("release_id") == latest_release.get("release_id")
        )
        row_binding_valid = (
            transaction_seq == len(release_rows)
            and release_seq == len(release_rows)
            and receipt_seq == len(receipt_rows)
            and payload.get("releaseId") == latest_release.get("release_id", "")
            and receipt_ids == latest_receipt_ids
        )
    valid = (
        payload.get("schema") == "dwp.hris.g3.control-delivery-transaction-state.v1"
        and payload.get("phase") == "COMMITTED"
        and payload.get("priorState") is None
        and isinstance(transaction_seq, int) and not isinstance(transaction_seq, bool)
        and transaction_seq >= (1 if has_rows else 0)
        and isinstance(release_seq, int) and not isinstance(release_seq, bool)
        and isinstance(receipt_seq, int) and not isinstance(receipt_seq, bool)
        and isinstance(receipt_ids, list)
        and all(isinstance(value, str) and value for value in receipt_ids)
        and receipt_ids == sorted(set(receipt_ids))
        and all(
            bool(SHA256.fullmatch(str(payload.get(field, ""))))
            for field in (
                "priorReleaseRegisterSha256", "priorReceiptRegisterSha256",
                "candidateReleaseRegisterSha256", "candidateReceiptRegisterSha256",
            )
        )
        and payload.get("releaseRegisterSha256") == release_digest
        and payload.get("receiptRegisterSha256") == receipt_digest
        and payload.get("status") == expected_status
        and row_binding_valid
        and (
            (
                not has_rows and transaction_seq == release_seq == receipt_seq == 0
                and payload.get("releaseId") == "" and receipt_ids == []
                and payload.get("bundleRef") == "" and payload.get("bundleSha256") == ""
                and prepared_at is None and committed_at is None
            )
            or (
                has_rows and transaction_seq == release_seq
                and release_seq > 0 and receipt_seq > 0
                and bool(payload.get("releaseId")) and bool(receipt_ids)
                and bool(SHA256.fullmatch(str(payload.get("bundleSha256", ""))))
                and safe_file(str(payload.get("bundleRef", ""))) is not None
                and safe_file(str(payload.get("bundleRef", ""))).is_file()
                and sha256(safe_file(str(payload.get("bundleRef", ""))))
                == payload.get("bundleSha256")
                and prepared_at is not None and committed_at is not None
                and prepared_at <= committed_at
            )
        )
    )
    return [] if valid else ["Control delivery transaction state/digest drift"]


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def split_pipe(value: str) -> set[str]:
    return {item for item in value.split("|") if item}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_utc(value: object) -> datetime | None:
    if not isinstance(value, str) or not ISO_UTC.fullmatch(value):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo == timezone.utc else None


def load_sync_command_catalog() -> dict[tuple[str, str], list[str]]:
    try:
        payload = json.loads(SYNC_COMMAND_CATALOG.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Control sync command catalog unreadable: {error}") from error
    if not isinstance(payload, dict) or set(payload) != {"schema", "commands"}:
        raise ValueError("Control sync command catalog schema drift")
    if payload.get("schema") != "dwp.hris.g3.control-sync-command-catalog.v1":
        raise ValueError("Control sync command catalog identity drift")
    commands = payload.get("commands")
    if not isinstance(commands, list):
        raise ValueError("Control sync command catalog commands are not a list")
    expected_item_fields = {"sessionId", "repository", "argv"}
    result: dict[tuple[str, str], list[str]] = {}
    for item in commands:
        if not isinstance(item, dict) or set(item) != expected_item_fields:
            raise ValueError("Control sync command catalog item schema drift")
        key = (str(item.get("sessionId", "")), str(item.get("repository", "")))
        argv = item.get("argv")
        if (
            key in result or key[0] not in SESSIONS
            or key[1] not in {"DWP_BACKEND", "DWP_FRONTEND"}
            or not isinstance(argv, list) or not argv
            or not all(isinstance(value, str) and value for value in argv)
            or argv[0] in {"sh", "bash", "zsh", "true"}
        ):
            raise ValueError(f"Control sync command catalog entry drift: {key}")
        result[key] = argv
    expected = {(session, repository) for session in SESSIONS for repository in {"DWP_BACKEND", "DWP_FRONTEND"}}
    if set(result) != expected:
        raise ValueError("Control sync command catalog session/repository matrix drift")
    return result


def safe_file(reference: str) -> Path | None:
    if not reference:
        return None
    candidate = Path(reference)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    resolved = candidate.resolve(strict=False)
    if ROOT.resolve() not in resolved.parents or resolved.is_symlink():
        return None
    return resolved


def git(path: Path, *args: str) -> tuple[int, str]:
    completed = subprocess.run(
        ["git", "-C", str(path), *args], capture_output=True, text=True,
        check=False, shell=False,
    )
    return completed.returncode, completed.stdout.strip()


def git_bytes(path: Path, *args: str) -> tuple[int, bytes]:
    completed = subprocess.run(
        ["git", "-C", str(path), *args], capture_output=True,
        check=False, shell=False,
    )
    return completed.returncode, completed.stdout


def glob_allows(path: str, pattern: str) -> bool:
    if pattern.endswith("/**"):
        return path.startswith(pattern[:-3].rstrip("/") + "/")
    return fnmatch.fnmatchcase(path, pattern)


def manifest_artifacts_valid(
    artifacts: object, allowed_patterns: set[str]
) -> bool:
    if not isinstance(artifacts, list) or not artifacts:
        return False
    paths = [str(item.get("path", "")) for item in artifacts if isinstance(item, dict)]
    return (
        len(paths) == len(artifacts) == len(set(paths))
        and paths == sorted(paths)
        and all(
            isinstance(item, dict)
            and set(item) == ARTIFACT_FIELDS
            and any(glob_allows(str(item.get("path", "")), pattern) for pattern in allowed_patterns)
            and bool(SHA40.fullmatch(str(item.get("gitBlobOid", ""))))
            and bool(SHA256.fullmatch(str(item.get("byteSha256", ""))))
            and isinstance(item.get("size"), int)
            and int(item.get("size", -1)) >= 0
            for item in artifacts
        )
    )


def git_blob_identity(
    repository: Path, revision: str, relative_path: str
) -> tuple[str, str, str, int] | None:
    """Return mode, blob OID, byte SHA-256, and size for one regular Git blob."""
    rc, output = git_bytes(repository, "ls-tree", "-z", revision, "--", relative_path)
    if rc != 0 or not output:
        return None
    entries = [entry for entry in output.split(b"\0") if entry]
    if len(entries) != 1:
        return None
    try:
        metadata, path_bytes = entries[0].split(b"\t", 1)
        mode, object_type, oid = metadata.decode("ascii").split(" ", 2)
        stored_path = path_bytes.decode("utf-8")
    except (UnicodeDecodeError, ValueError):
        return None
    if stored_path != relative_path or object_type != "blob" or mode not in {"100644", "100755"}:
        return None
    rc, content = git_bytes(repository, "cat-file", "blob", oid)
    if rc != 0:
        return None
    return mode, oid, hashlib.sha256(content).hexdigest(), len(content)


def commit_changed_paths(repository: Path, revision: str) -> tuple[set[str], list[str]]:
    """Read an atomic commit's exact A/M regular-file path closure; reject other status."""
    errors: list[str] = []
    rc, output = git_bytes(
        repository, "diff-tree", "--root", "--no-commit-id", "--name-status",
        "-r", "-z", revision,
    )
    if rc != 0:
        return set(), ["release commit diff is unavailable"]
    tokens = [token.decode("utf-8", errors="strict") for token in output.split(b"\0") if token]
    paths: set[str] = set()
    index = 0
    try:
        while index < len(tokens):
            status = tokens[index]
            index += 1
            if status.startswith(("R", "C")):
                errors.append(f"release commit rename/copy is forbidden: {status}")
                index += 2
                continue
            if index >= len(tokens):
                errors.append("release commit name-status is truncated")
                break
            path = tokens[index]
            index += 1
            if status not in {"A", "M"}:
                errors.append(f"release commit status is not A/M: {status}:{path}")
            if path in paths:
                errors.append(f"release commit path is duplicated: {path}")
            paths.add(path)
    except UnicodeDecodeError:
        return set(), ["release commit path is not UTF-8"]
    return paths, errors


def released_artifacts_match_git(
    repository: Path,
    revision: str,
    artifacts: list[dict[str, object]],
    allowed_patterns: set[str],
    *,
    require_exact_commit_closure: bool,
) -> list[str]:
    errors: list[str] = []
    artifact_paths = {str(item.get("path", "")) for item in artifacts}
    if require_exact_commit_closure:
        changed_paths, changed_errors = commit_changed_paths(repository, revision)
        errors.extend(changed_errors)
        if changed_paths != artifact_paths:
            errors.append(
                "release manifest does not exactly equal the release commit path closure"
            )
    for item in artifacts:
        relative_path = str(item.get("path", ""))
        if not any(glob_allows(relative_path, pattern) for pattern in allowed_patterns):
            errors.append(f"release artifact is outside classification: {relative_path}")
            continue
        identity = git_blob_identity(repository, revision, relative_path)
        if identity is None:
            errors.append(f"release artifact is absent or not a regular blob: {relative_path}")
            continue
        _mode, oid, byte_sha, size = identity
        if (
            oid != item.get("gitBlobOid")
            or byte_sha != item.get("byteSha256")
            or size != item.get("size")
        ):
            errors.append(f"release artifact Git/byte identity drift: {relative_path}")
    return errors


def descendant_preserves_release(
    repository: Path,
    sync_head: str,
    current_head: str,
    artifacts: list[dict[str, object]],
    protected_patterns: set[str],
) -> list[str]:
    errors: list[str] = []
    ancestor_rc, _ = git(repository, "merge-base", "--is-ancestor", sync_head, current_head)
    if ancestor_rc != 0:
        return ["sync successor is not an ancestor of the current consumer HEAD"]
    for item in artifacts:
        relative_path = str(item.get("path", ""))
        expected = (
            str(item.get("gitBlobOid", "")),
            str(item.get("byteSha256", "")),
            int(item.get("size", -1)),
        )
        for revision in (sync_head, current_head):
            identity = git_blob_identity(repository, revision, relative_path)
            if identity is None or (identity[1], identity[2], identity[3]) != expected:
                errors.append(
                    f"consumer does not preserve released blob at {revision}: {relative_path}"
                )
    rc, commits_output = git(repository, "rev-list", "--reverse", f"{sync_head}..{current_head}")
    if rc != 0:
        errors.append("consumer descendant commit list is unavailable")
        return errors
    for commit in [value for value in commits_output.splitlines() if value]:
        rc, output = git_bytes(
            repository, "diff-tree", "--no-commit-id", "--name-only", "-r", "-m", "-z", commit,
        )
        if rc != 0:
            errors.append(f"consumer descendant diff is unavailable: {commit}")
            continue
        paths = [value.decode("utf-8", errors="replace") for value in output.split(b"\0") if value]
        if any(any(glob_allows(path, pattern) for pattern in protected_patterns) for path in paths):
            errors.append(f"consumer descendant touched a Control-owned release path: {commit}")
    return errors


def latest_receipt_closure_errors(
    latest_release: dict[str, str],
    classes: dict[str, dict[str, str]],
    receipt_pairs: set[tuple[str, str]],
) -> list[str]:
    errors: list[str] = []
    for class_id, release_id in latest_release.items():
        class_row = classes.get(class_id, {})
        if class_row.get("consumer_receipt_required") != "YES":
            continue
        expected_pairs = {
            (release_id, session)
            for session in split_pipe(class_row.get("allowed_consumers", ""))
        }
        observed_pairs = {pair for pair in receipt_pairs if pair[0] == release_id}
        if observed_pairs != expected_pairs:
            errors.append(f"{release_id}: latest release consumer receipt closure drift")
    return errors


def baseline_sync_transition_errors(
    release_rows: list[dict[str, str]],
    receipt_rows: list[dict[str, str]],
    checkpoint_rows: list[dict[str, str]],
    release_artifacts: dict[str, list[dict[str, object]]],
    *,
    verify_files: bool,
) -> list[str]:
    """Bind every consumer receipt to one exact CONTROL_BASELINE_SYNC checkpoint."""
    errors: list[str] = []
    releases = {row.get("release_id", ""): row for row in release_rows}
    checkpoints = {row.get("checkpoint_id", ""): row for row in checkpoint_rows}
    consumed_checkpoints: set[str] = set()
    for receipt in receipt_rows:
        receipt_id = receipt.get("receipt_id", "")
        release = releases.get(receipt.get("release_id", ""), {})
        producer = checkpoints.get(release.get("producer_checkpoint_id", ""), {})
        if not (
            producer.get("checkpoint_kind") == "CENTRAL_MATERIALIZATION"
            and producer.get("writer_session_id") == "CONTROL"
            and producer.get("repository") == release.get("repository")
            and producer.get("head_sha") == release.get("source_head_sha")
            and producer.get("recorded_at", "") < release.get("recorded_at", "")
        ):
            errors.append(f"{receipt_id}: release is not sourced by one prior CENTRAL_MATERIALIZATION checkpoint")
        matches = [
            checkpoint
            for checkpoint in checkpoint_rows
            if checkpoint.get("checkpoint_kind") == "CONTROL_BASELINE_SYNC"
            and checkpoint.get("writer_session_id") == "CONTROL"
            and checkpoint.get("owner_session_id") == receipt.get("consumer_session_id")
            and checkpoint.get("repository") == receipt.get("repository")
            and checkpoint.get("parent_head_sha") == receipt.get("predecessor_head_sha")
            and checkpoint.get("head_sha") == receipt.get("successor_head_sha")
        ]
        if len(matches) != 1:
            errors.append(f"{receipt_id}: exact CONTROL_BASELINE_SYNC checkpoint cardinality drift")
            continue
        checkpoint = matches[0]
        checkpoint_id = checkpoint.get("checkpoint_id", "")
        if checkpoint_id in consumed_checkpoints:
            errors.append(f"{receipt_id}: CONTROL_BASELINE_SYNC checkpoint was replayed")
        consumed_checkpoints.add(checkpoint_id)
        if not (
            release.get("recorded_at", "") < checkpoint.get("recorded_at", "")
            and checkpoint.get("recorded_at", "") <= receipt.get("recorded_at", "")
        ):
            errors.append(f"{receipt_id}: release/checkpoint/receipt time transition drift")
        if verify_files:
            touch_path = safe_file(checkpoint.get("touch_manifest_ref", ""))
            touch_paths: list[str] = []
            if touch_path is not None and touch_path.is_file():
                try:
                    _header, touches = read_csv(touch_path)
                    touch_paths = sorted(row.get("changed_path", "") for row in touches)
                except OSError:
                    touch_paths = []
            artifact_paths = sorted(
                str(item.get("path", ""))
                for item in release_artifacts.get(receipt.get("release_id", ""), [])
            )
            fingerprint = hashlib.sha256(
                "\x1f".join(artifact_paths).encode("utf-8")
            ).hexdigest()
            if (
                not artifact_paths
                or touch_paths != artifact_paths
                or checkpoint.get("changed_paths_sha256") != fingerprint
            ):
                errors.append(f"{receipt_id}: release artifacts and baseline-sync touch closure drift")
    return errors


def validate_data(
    classification_header: list[str],
    classes: list[dict[str, str]],
    allocation_rows: list[dict[str, str]],
    release_header: list[str],
    release_rows: list[dict[str, str]],
    receipt_header: list[str],
    receipt_rows: list[dict[str, str]],
    checkpoint_rows: list[dict[str, str]],
    decision: dict[str, object],
    *,
    verify_files: bool,
    check_live: bool,
) -> list[str]:
    errors: list[str] = []
    require = lambda condition, message: None if condition else errors.append(message)
    try:
        sync_commands = load_sync_command_catalog()
    except ValueError as error:
        sync_commands = {}
        errors.append(str(error))
    worktree_rows = read_csv(WORKTREES)[1] if (verify_files or check_live) else []
    worktrees = {
        (row.get("session_id", ""), row.get("repository", "")): Path(row.get("worktree_path", ""))
        for row in worktree_rows
    }
    require(classification_header == CLASSIFICATION_HEADER, "classification header drift")
    require(release_header == RELEASE_HEADER, "Control release header drift")
    require(receipt_header == RECEIPT_HEADER, "Control sync receipt header drift")
    by_allocation = {row.get("allocation_id", ""): row for row in allocation_rows}
    by_class: dict[str, dict[str, str]] = {}
    for index, row in enumerate(classes, 1):
        class_id = row.get("classification_id", "")
        require(bool(class_id) and class_id not in by_class, f"classification {index}: duplicate/blank ID")
        by_class[class_id] = row
        allocation_ids = split_pipe(row.get("allocation_ids", ""))
        allocations = [by_allocation.get(item, {}) for item in allocation_ids]
        allocation_paths = set().union(
            *(split_pipe(item.get("path_globs", "")) for item in allocations)
        ) if allocations else set()
        classified_paths = split_pipe(row.get("path_globs", ""))
        classification_is_allocated = bool(classified_paths) and all(
            any(
                classified == allocated
                or (
                    allocated.endswith("/**")
                    and classified.startswith(allocated[:-3].rstrip("/") + "/")
                )
                for allocated in allocation_paths
            )
            for classified in classified_paths
        )
        require(
            row.get("producer_session") == "CONTROL"
            and row.get("repository") in {"DWP_BACKEND", "DWP_FRONTEND"}
            and row.get("delivery_mode") in {
                "BASELINE_SYNCABLE", "INTEGRATION_ONLY", "VERSIONED_ARTIFACT_DEPENDENCY"
            }
            and row.get("module_direct_touch_allowed") == "NO"
            and bool(allocation_ids)
            and all(item for item in allocations)
            and all(item.get("session_id") == "CONTROL" for item in allocations)
            and classification_is_allocated,
            f"{class_id}: classification/allocation ownership drift",
        )
        consumers = split_pipe(row.get("allowed_consumers", ""))
        if row.get("delivery_mode") == "BASELINE_SYNCABLE":
            require(
                consumers and consumers.issubset(SESSIONS)
                and row.get("consumer_receipt_required") == "YES"
                and row.get("source_provenance_requirement")
                in {"ENTRY_BASELINE_LINEAGE", "G3_CONTROL_CHECKPOINT"},
                f"{class_id}: baseline-sync contract drift",
            )
        elif row.get("delivery_mode") == "INTEGRATION_ONLY":
            require(
                consumers == {"CONTROL"}
                and row.get("consumer_receipt_required") == "NO",
                f"{class_id}: integration-only contract drift",
            )
        else:
            require(
                consumers and consumers.issubset(SESSIONS)
                and row.get("consumer_receipt_required") == "YES",
                f"{class_id}: versioned dependency contract drift",
            )
    require(len(by_class) == len(classes) and len(classes) >= 7, "classification universe drift")

    gate_open = (
        decision.get("effectiveGate") == "OPEN_G3_CODE"
        and decision.get("currentState") == "OPEN_AUTHORITATIVE_LIVE"
    )
    require(
        {
            class_id
            for class_id, row in by_class.items()
            if row.get("source_provenance_requirement") == "ENTRY_BASELINE_LINEAGE"
        }
        == ENTRY_BOOTSTRAP_CLASSES,
        "entry-baseline central artifact class set drift",
    )
    for required in sorted(ENTRY_BOOTSTRAP_CLASSES):
        state = by_class.get(required, {}).get("state", "")
        require(
            state == ("ENTRY_BASELINE_VERIFIED" if gate_open else "CODE_ENTRY_BOOTSTRAP_PENDING"),
            f"{required}: state is not atomically aligned with current gate decision",
        )

    checkpoint_by_id = {row.get("checkpoint_id", ""): row for row in checkpoint_rows}
    release_by_id: dict[str, dict[str, str]] = {}
    release_artifacts: dict[str, list[dict[str, object]]] = {}
    latest_release: dict[str, str] = {}
    for index, row in enumerate(release_rows, 1):
        release_id = row.get("release_id", "")
        class_row = by_class.get(row.get("artifact_classification_id", ""), {})
        producer = checkpoint_by_id.get(row.get("producer_checkpoint_id", ""), {})
        require(
            row.get("release_seq") == str(index)
            and bool(release_id) and release_id not in release_by_id,
            f"release {index}: sequence/ID drift",
        )
        release_by_id[release_id] = row
        require(
            class_row.get("delivery_mode") in {"BASELINE_SYNCABLE", "VERSIONED_ARTIFACT_DEPENDENCY"}
            and producer.get("writer_session_id") == "CONTROL"
            and producer.get("repository") == row.get("repository")
            and producer.get("head_sha") == row.get("source_head_sha")
            and row.get("source_tree_sha")
            and bool(SHA40.fullmatch(row.get("source_head_sha", "")))
            and bool(SHA40.fullmatch(row.get("source_tree_sha", "")))
            and bool(SHA40.fullmatch(row.get("release_commit_sha", "")))
            and row.get("release_commit_sha") == row.get("source_head_sha")
            and bool(SHA256.fullmatch(row.get("path_manifest_sha256", "")))
            and row.get("consumer_session_ids") == "|".join(sorted(split_pipe(class_row.get("allowed_consumers", ""))))
            and row.get("predecessor_release_id") == latest_release.get(row.get("artifact_classification_id", ""), "")
            and bool(ISO_UTC.fullmatch(row.get("recorded_at", "")))
            and row.get("status") == "CONTROL_RELEASE_VERIFIED",
            f"{release_id}: release provenance/state drift",
        )
        latest_release[row.get("artifact_classification_id", "")] = release_id
        if verify_files:
            path = safe_file(row.get("path_manifest_ref", ""))
            require(
                path is not None and path.is_file() and sha256(path) == row.get("path_manifest_sha256"),
                f"{release_id}: release manifest missing/unsafe/stale",
            )
            if path is not None and path.is_file():
                try:
                    payload = json.loads(path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    payload = {}
                artifacts = payload.get("artifacts", []) if isinstance(payload, dict) else []
                require(
                    isinstance(payload, dict)
                    and set(payload) == RELEASE_MANIFEST_FIELDS
                    and payload.get("schema") == "dwp.hris.g3.control-release-manifest.v1"
                    and payload.get("releaseId") == release_id
                    and payload.get("classificationId") == row.get("artifact_classification_id")
                    and payload.get("producerCheckpointId") == row.get("producer_checkpoint_id")
                    and payload.get("predecessorReleaseId") == row.get("predecessor_release_id")
                    and payload.get("repository") == row.get("repository")
                    and payload.get("sourceHeadSha") == row.get("source_head_sha")
                    and payload.get("sourceTreeSha") == row.get("source_tree_sha")
                    and payload.get("releaseCommitSha") == row.get("release_commit_sha")
                    and payload.get("consumerSessionIds") == sorted(split_pipe(row.get("consumer_session_ids", "")))
                    and payload.get("recordedAt") == row.get("recorded_at")
                    and manifest_artifacts_valid(artifacts, split_pipe(class_row.get("path_globs", "")))
                    and payload.get("status") == "CONTROL_RELEASE_VERIFIED",
                    f"{release_id}: typed release manifest drift",
                )
                if isinstance(artifacts, list):
                    typed_artifacts = [item for item in artifacts if isinstance(item, dict)]
                    release_artifacts[release_id] = typed_artifacts
                    repository = worktrees.get(("CONTROL", row.get("repository", "")))
                    if repository is None or not repository.is_dir():
                        require(False, f"{release_id}: Control repository worktree missing")
                    else:
                        tree_rc, observed_tree = git(
                            repository, "rev-parse", f"{row.get('release_commit_sha', '')}^{{tree}}"
                        )
                        require(
                            tree_rc == 0 and observed_tree == row.get("source_tree_sha"),
                            f"{release_id}: release commit/tree identity drift",
                        )
                        for error in released_artifacts_match_git(
                            repository,
                            row.get("release_commit_sha", ""),
                            typed_artifacts,
                            split_pipe(class_row.get("path_globs", "")),
                            require_exact_commit_closure=True,
                        ):
                            require(False, f"{release_id}: {error}")

    receipt_pairs: set[tuple[str, str]] = set()
    for index, row in enumerate(receipt_rows, 1):
        receipt_id = row.get("receipt_id", "")
        release = release_by_id.get(row.get("release_id", ""), {})
        class_row = by_class.get(release.get("artifact_classification_id", ""), {})
        pair = (row.get("release_id", ""), row.get("consumer_session_id", ""))
        require(
            row.get("receipt_seq") == str(index)
            and bool(receipt_id)
            and pair not in receipt_pairs,
            f"sync receipt {index}: sequence/duplicate consumption drift",
        )
        receipt_pairs.add(pair)
        require(
            bool(release)
            and row.get("consumer_session_id") in split_pipe(class_row.get("allowed_consumers", ""))
            and row.get("repository") == release.get("repository")
            and row.get("source_commit_sha") == release.get("release_commit_sha")
            and row.get("path_manifest_sha256") == release.get("path_manifest_sha256")
            and row.get("conflict_count") == "0"
            and bool(SHA40.fullmatch(row.get("predecessor_head_sha", "")))
            and bool(SHA40.fullmatch(row.get("successor_head_sha", "")))
            and bool(SHA256.fullmatch(row.get("compile_evidence_sha256", "")))
            and bool(SHA256.fullmatch(row.get("compile_output_sha256", "")))
            and bool(ISO_UTC.fullmatch(row.get("recorded_at", "")))
            and row.get("status") == "CONSUMER_SYNC_VERIFIED",
            f"{receipt_id}: sync receipt provenance/state drift",
        )
        if verify_files:
            path = safe_file(row.get("compile_evidence_ref", ""))
            require(
                path is not None and path.is_file() and sha256(path) == row.get("compile_evidence_sha256"),
                f"{receipt_id}: compile receipt missing/unsafe/stale",
            )
            if path is not None and path.is_file():
                try:
                    payload = json.loads(path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    payload = {}
                argv = payload.get("argv", []) if isinstance(payload, dict) else []
                output_path = safe_file(row.get("compile_output_ref", ""))
                started_at = parse_utc(payload.get("startedAt")) if isinstance(payload, dict) else None
                ended_at = parse_utc(payload.get("endedAt")) if isinstance(payload, dict) else None
                expected_argv = sync_commands.get(
                    (row.get("consumer_session_id", ""), row.get("repository", ""))
                )
                require(
                    isinstance(payload, dict) and set(payload) == COMPILE_RECEIPT_FIELDS
                    and payload.get("schema") == "dwp.hris.g3.control-sync-compile-receipt.v1"
                    and payload.get("receiptId") == receipt_id
                    and payload.get("releaseId") == row.get("release_id")
                    and payload.get("consumerSessionId") == row.get("consumer_session_id")
                    and payload.get("repository") == row.get("repository")
                    and payload.get("predecessorHeadSha") == row.get("predecessor_head_sha")
                    and payload.get("successorHeadSha") == row.get("successor_head_sha")
                    and payload.get("sourceCommitSha") == row.get("source_commit_sha")
                    and payload.get("pathManifestSha256") == row.get("path_manifest_sha256")
                    and payload.get("outputRef") == row.get("compile_output_ref")
                    and payload.get("outputSha256") == row.get("compile_output_sha256")
                    and argv == expected_argv
                    and payload.get("argvSha256") == hashlib.sha256(json.dumps(argv, separators=(",", ":")).encode()).hexdigest()
                    and payload.get("exitCode") == 0 and payload.get("conflictCount") == 0
                    and started_at is not None and ended_at is not None
                    and started_at <= ended_at
                    and payload.get("endedAt") == row.get("recorded_at")
                    and payload.get("status") == "PASS",
                    f"{receipt_id}: typed compile receipt drift",
                )
                require(
                    output_path is not None and output_path.is_file()
                    and sha256(output_path) == row.get("compile_output_sha256"),
                    f"{receipt_id}: compile output missing/unsafe/stale",
                )
        if check_live:
            worktree = worktrees.get(
                (row.get("consumer_session_id", ""), row.get("repository", ""))
            )
            if worktree is None:
                require(False, f"{receipt_id}: consumer worktree missing")
            else:
                head_rc, head = git(worktree, "rev-parse", "HEAD")
                parent_rc, parent = git(worktree, "rev-parse", f"{row.get('successor_head_sha', '')}^")
                changed_paths, changed_errors = commit_changed_paths(
                    worktree, row.get("successor_head_sha", "")
                )
                artifacts = release_artifacts.get(row.get("release_id", ""), [])
                artifact_paths = {str(item.get("path", "")) for item in artifacts}
                require(
                    head_rc == 0 and parent_rc == 0
                    and parent == row.get("predecessor_head_sha"),
                    f"{receipt_id}: sync commit is not a direct child of the sealed predecessor",
                )
                require(
                    not changed_errors and changed_paths == artifact_paths,
                    f"{receipt_id}: sync commit path closure drift",
                )
                for error in descendant_preserves_release(
                    worktree,
                    row.get("successor_head_sha", ""),
                    head,
                    artifacts,
                    split_pipe(class_row.get("path_globs", "")),
                ):
                    require(False, f"{receipt_id}: {error}")

    errors.extend(latest_receipt_closure_errors(latest_release, by_class, receipt_pairs))
    errors.extend(
        baseline_sync_transition_errors(
            release_rows, receipt_rows, checkpoint_rows, release_artifacts,
            verify_files=verify_files,
        )
    )
    return errors


def validate(*, check_live: bool = False) -> list[str]:
    class_header, classes = read_csv(CLASSIFICATIONS)
    _allocation_header, allocations = read_csv(ALLOCATIONS)
    release_header, releases = read_csv(RELEASES)
    receipt_header, receipts = read_csv(RECEIPTS)
    _checkpoint_header, checkpoints = read_csv(CHECKPOINTS)
    decision = json.loads(DECISION.read_text(encoding="utf-8"))
    errors = validate_data(
        class_header, classes, allocations, release_header, releases,
        receipt_header, receipts, checkpoints, decision,
        verify_files=True, check_live=check_live,
    )
    try:
        state = json.loads(DELIVERY_STATE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        errors.append(f"Control delivery transaction state unreadable: {error}")
    else:
        errors.extend(delivery_state_errors(
            state, sha256(RELEASES), sha256(RECEIPTS),
            has_rows=bool(releases or receipts),
            release_rows=releases,
            receipt_rows=receipts,
        ))
    return sorted(set(errors))


def self_test() -> dict[str, object]:
    class_header, classes = read_csv(CLASSIFICATIONS)
    _allocation_header, allocations = read_csv(ALLOCATIONS)
    release_header, releases = read_csv(RELEASES)
    receipt_header, receipts = read_csv(RECEIPTS)
    _checkpoint_header, checkpoints = read_csv(CHECKPOINTS)
    decision = json.loads(DECISION.read_text(encoding="utf-8"))
    cases: dict[str, bool] = {}
    mutated_classes = copy.deepcopy(classes)
    mutated_classes[0]["path_globs"] += "|escape/**"
    cases["classification-allocation-path-drift-rejected"] = bool(validate_data(
        class_header, mutated_classes, allocations, release_header, releases,
        receipt_header, receipts, checkpoints, decision,
        verify_files=False, check_live=False,
    ))
    open_decision = dict(decision, effectiveGate="OPEN_G3_CODE", currentState="OPEN_AUTHORITATIVE_LIVE")
    cases["open-gate-with-pending-entry-bootstrap-rejected"] = bool(validate_data(
        class_header, classes, allocations, release_header, releases,
        receipt_header, receipts, checkpoints, open_decision,
        verify_files=False, check_live=False,
    ))
    cases["release-header-drift-rejected"] = bool(validate_data(
        class_header, classes, allocations, release_header[:-1], releases,
        receipt_header, receipts, checkpoints, decision,
        verify_files=False, check_live=False,
    ))
    cases["receipt-header-drift-rejected"] = bool(validate_data(
        class_header, classes, allocations, release_header, releases,
        receipt_header[:-1], receipts, checkpoints, decision,
        verify_files=False, check_live=False,
    ))
    cases["closed-command-catalog-exact-matrix"] = (
        len(load_sync_command_catalog()) == 10
    )
    state = json.loads(DELIVERY_STATE.read_text(encoding="utf-8"))
    cases["control-delivery-transaction-state-valid"] = not delivery_state_errors(
        state, sha256(RELEASES), sha256(RECEIPTS),
        has_rows=bool(releases or receipts),
        release_rows=releases, receipt_rows=receipts,
    )
    forged_state = dict(state, releaseRegisterSha256="0" * 64)
    cases["control-delivery-split-brain-digest-rejected"] = bool(
        delivery_state_errors(
            forged_state, sha256(RELEASES), sha256(RECEIPTS),
            has_rows=bool(releases or receipts),
            release_rows=releases, receipt_rows=receipts,
        )
    )
    closure_class = {
        "CLASS": {
            "consumer_receipt_required": "YES",
            "allowed_consumers": "HRIS-HRM|HRIS-PER",
        }
    }
    cases["latest-release-missing-consumer-receipt-rejected"] = bool(
        latest_receipt_closure_errors(
            {"CLASS": "REL-2"}, closure_class, {("REL-2", "HRIS-HRM")}
        )
    )
    cases["stale-prior-release-receipts-do-not-mask-latest"] = bool(
        latest_receipt_closure_errors(
            {"CLASS": "REL-2"},
            closure_class,
            {("REL-1", "HRIS-HRM"), ("REL-1", "HRIS-PER")},
        )
    )
    transition_checkpoints = [
        {
            "checkpoint_id": "G3-CTL-PRODUCER-001",
            "checkpoint_kind": "CENTRAL_MATERIALIZATION",
            "writer_session_id": "CONTROL",
            "owner_session_id": "HRIS-HRM",
            "repository": "DWP_BACKEND",
            "head_sha": "1" * 40,
            "recorded_at": "2026-09-11T00:00:01Z",
        },
        {
            "checkpoint_id": "G3-CTL-SYNC-HRM-001",
            "checkpoint_kind": "CONTROL_BASELINE_SYNC",
            "writer_session_id": "CONTROL",
            "owner_session_id": "HRIS-HRM",
            "repository": "DWP_BACKEND",
            "parent_head_sha": "2" * 40,
            "head_sha": "3" * 40,
            "recorded_at": "2026-09-11T00:00:03Z",
        },
    ]
    transition_release = {
        "release_id": "REL-SELF-001",
        "producer_checkpoint_id": "G3-CTL-PRODUCER-001",
        "repository": "DWP_BACKEND",
        "source_head_sha": "1" * 40,
        "recorded_at": "2026-09-11T00:00:02Z",
    }
    transition_receipt = {
        "receipt_id": "REC-SELF-001",
        "release_id": "REL-SELF-001",
        "consumer_session_id": "HRIS-HRM",
        "repository": "DWP_BACKEND",
        "predecessor_head_sha": "2" * 40,
        "successor_head_sha": "3" * 40,
        "recorded_at": "2026-09-11T00:00:04Z",
    }
    cases["release-receipt-baseline-sync-exact-transition-valid"] = not (
        baseline_sync_transition_errors(
            [transition_release], [transition_receipt], transition_checkpoints,
            {}, verify_files=False,
        )
    )
    wrong_transition = dict(transition_receipt, successor_head_sha="4" * 40)
    cases["receipt-without-exact-baseline-sync-checkpoint-rejected"] = bool(
        baseline_sync_transition_errors(
            [transition_release], [wrong_transition], transition_checkpoints,
            {}, verify_files=False,
        )
    )
    with tempfile.TemporaryDirectory(prefix="hris-central-release-") as temporary:
        repository = Path(temporary)
        subprocess.run(["git", "init", "-q", str(repository)], check=True)
        subprocess.run(["git", "-C", str(repository), "config", "user.email", "gate@example.invalid"], check=True)
        subprocess.run(["git", "-C", str(repository), "config", "user.name", "Gate Fixture"], check=True)
        (repository / ".gitignore").write_text("\n", encoding="utf-8")
        subprocess.run(["git", "-C", str(repository), "add", ".gitignore"], check=True)
        subprocess.run(["git", "-C", str(repository), "commit", "-qm", "base"], check=True)
        protected = repository / "control"
        protected.mkdir()
        artifact_path = protected / "shared.txt"
        artifact_path.write_text("sealed\n", encoding="utf-8")
        subprocess.run(["git", "-C", str(repository), "add", "control/shared.txt"], check=True)
        subprocess.run(["git", "-C", str(repository), "commit", "-qm", "release"], check=True)
        _rc, release_head = git(repository, "rev-parse", "HEAD")
        identity = git_blob_identity(repository, release_head, "control/shared.txt")
        assert identity is not None
        artifact: dict[str, object] = {
            "path": "control/shared.txt", "gitBlobOid": identity[1],
            "byteSha256": identity[2], "size": identity[3],
        }
        cases["release-git-blob-and-exact-path-closure-valid"] = not released_artifacts_match_git(
            repository, release_head, [artifact], {"control/**"},
            require_exact_commit_closure=True,
        )
        forged = dict(artifact, size=int(artifact["size"]) + 1)
        cases["forged-release-byte-size-rejected"] = bool(released_artifacts_match_git(
            repository, release_head, [forged], {"control/**"},
            require_exact_commit_closure=True,
        ))
        cases["omitted-release-commit-path-rejected"] = bool(released_artifacts_match_git(
            repository, release_head, [], {"control/**"},
            require_exact_commit_closure=True,
        ))
        (repository / "module.txt").write_text("module\n", encoding="utf-8")
        subprocess.run(["git", "-C", str(repository), "add", "module.txt"], check=True)
        subprocess.run(["git", "-C", str(repository), "commit", "-qm", "module work"], check=True)
        _rc, module_head = git(repository, "rev-parse", "HEAD")
        cases["module-only-descendant-preserves-release"] = not descendant_preserves_release(
            repository, release_head, module_head, [artifact], {"control/**"}
        )
        artifact_path.write_text("tampered\n", encoding="utf-8")
        subprocess.run(["git", "-C", str(repository), "add", "control/shared.txt"], check=True)
        subprocess.run(["git", "-C", str(repository), "commit", "-qm", "forbidden control touch"], check=True)
        _rc, control_drift_head = git(repository, "rev-parse", "HEAD")
        cases["control-path-descendant-drift-rejected"] = bool(descendant_preserves_release(
            repository, release_head, control_drift_head, [artifact], {"control/**"}
        ))
        subprocess.run(["git", "-C", str(repository), "checkout", "-q", "--detach", f"{release_head}^"], check=True)
        (repository / "sibling.txt").write_text("sibling\n", encoding="utf-8")
        subprocess.run(["git", "-C", str(repository), "add", "sibling.txt"], check=True)
        subprocess.run(["git", "-C", str(repository), "commit", "-qm", "sibling"], check=True)
        _rc, sibling_head = git(repository, "rev-parse", "HEAD")
        cases["sibling-consumer-head-rejected"] = bool(descendant_preserves_release(
            repository, release_head, sibling_head, [artifact], {"control/**"}
        ))
    return {
        "schema": "dwp.hris.g3.central-artifact-delivery-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases), "passedCount": sum(cases.values()), "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-live", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        result = self_test()
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result["status"] == "PASS" else 1
    errors = validate(check_live=args.check_live)
    result = {
        "schema": "dwp.hris.g3.central-artifact-delivery.v1",
        "status": "PASS" if not errors else "FAIL",
        "classificationCount": len(read_csv(CLASSIFICATIONS)[1]),
        "releaseCount": len(read_csv(RELEASES)[1]),
        "syncReceiptCount": len(read_csv(RECEIPTS)[1]),
        "errors": errors,
    }
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
