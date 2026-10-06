#!/usr/bin/env python3
"""Crash-detectable CAS append/recovery for Control-authored G3 checkpoints.

One immutable Control intake bundle may add a checkpoint row and, for a
frontend contract consumer, one dependency row.  Because two CSV files cannot
be replaced atomically, a PREPARED transaction marker records exact preimage
and candidate digests before either register is changed.  Normal exceptions
restore all three files synchronously; an interrupted process is recovered
explicitly under the same host semaphore by deterministic roll-forward or
rollback from the immutable bundle.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import stat
import tempfile
from pathlib import Path

from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    exclusive_host_semaphore,
)
from central_transaction_fence import (
    assert_all_central_transactions_committed,
    assert_recovery_exclusive,
)
from gate_authority import (
    assert_authoritative_gate_open_during_prepared_transaction,
)
from prepare_g3_checkpoint import assert_current_gate_open, later_timestamp
from prepare_g3_control_checkpoint import BUNDLE_MANIFEST_FIELDS, control_root
from validate_code_checkpoint import (
    Checks,
    G0,
    G3_CHECKPOINT_HEADER,
    G3_CONTROL_CHECKPOINT_STATE_FIELDS,
    G3_CROSS_REPO_DEPENDENCY_HEADER,
    MODULES,
    ROOT,
    control_checkpoint_projection_sha256,
    file_sha256,
    read_csv,
    validate_baselines,
    validate_checkpoint_test_evidence,
    validate_command_catalog,
    validate_control_checkpoint_transaction_state,
    validate_control_proposal_registry,
    validate_cross_repo_dependency_registry,
    validate_g3_checkpoint_registry,
    validate_live,
    validate_worktrees_static,
)


CHECKPOINT_REGISTER = G0 / "g3-checkpoint-register.csv"
DEPENDENCY_REGISTER = G0 / "g3-cross-repo-dependency-register.csv"
STATE = G0 / "g3-control-checkpoint-transaction-state.json"
FINALIZATION_FIELDS = {
    "schema", "checkpointId", "checkpointKind", "ownerSessionId",
    "writerSessionId", "repository", "sliceId", "parentHeadSha", "headSha",
    "sourceCheckpointId", "checkpointRowRef", "checkpointRowSha256",
    "dependencyRowRef", "dependencyRowSha256", "bundleManifestRef",
    "bundleManifestSha256", "createdAt", "status",
}
CONTROL_KINDS = {
    "CENTRAL_MATERIALIZATION", "INTEGRATION_MERGE", "CONTROL_BASELINE_SYNC",
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def json_bytes(payload: dict[str, object]) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()


def csv_bytes(header: list[str], rows: list[dict[str, str]]) -> bytes:
    with tempfile.TemporaryFile(mode="w+", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
        handle.flush()
        handle.seek(0)
        return handle.read().encode("utf-8")


def load_single_row(path: Path, header: list[str]) -> dict[str, str]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if list(reader.fieldnames or []) != header:
            raise ValueError(f"{path.name}: header drift")
        rows = list(reader)
    if len(rows) != 1 or set(rows[0]) != set(header):
        raise ValueError(f"{path.name}: expected exactly one typed row")
    return rows[0]


def relative(path: Path) -> str:
    try:
        return path.resolve(strict=True).relative_to(ROOT.resolve(strict=True)).as_posix()
    except (OSError, ValueError) as error:
        raise ValueError("Control bundle path escapes blueprint") from error


def assert_regular_0600(path: Path) -> None:
    try:
        parts = path.absolute().relative_to(ROOT.absolute()).parts
    except ValueError as error:
        raise ValueError("Control bundle path escapes blueprint") from error
    current = ROOT.absolute()
    for part in parts:
        current = current / part
        metadata = current.lstat()
        if stat.S_ISLNK(metadata.st_mode):
            raise ValueError("Control bundle path contains a symlink")
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or stat.S_IMODE(metadata.st_mode) != 0o600:
        raise ValueError("Control bundle artifact must be a 0600 regular file")


def safe_finalization(value: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = ROOT / path
    resolved = path.resolve(strict=True)
    assert_regular_0600(resolved)
    return resolved


def validate_bundle(finalization_path: Path) -> tuple[
    dict[str, object], dict[str, str], dict[str, str] | None
]:
    finalization = json.loads(finalization_path.read_text(encoding="utf-8"))
    if (
        not isinstance(finalization, dict)
        or set(finalization) != FINALIZATION_FIELDS
        or finalization.get("schema") != "dwp.hris.g3.control-checkpoint-finalization.v1"
        or finalization.get("status") != "READY_FOR_CONTROL_CAS_APPEND"
        or finalization.get("writerSessionId") != "CONTROL"
        or finalization.get("checkpointKind") not in CONTROL_KINDS
    ):
        raise ValueError("Control checkpoint finalization schema/lifecycle drift")
    owner = str(finalization.get("ownerSessionId", ""))
    checkpoint_id = str(finalization.get("checkpointId", ""))
    if owner not in MODULES or not re.fullmatch(r"G3-[A-Z0-9-]{3,101}", checkpoint_id):
        raise ValueError("Control checkpoint owner/ID invalid")
    root = control_root(owner, checkpoint_id)
    if finalization_path != root / "finalization.json":
        raise ValueError("finalization is outside the exact Control checkpoint root")
    sealed = root / "sealed"
    row_path = sealed / "checkpoint-row.csv"
    bundle_path = root / "bundle-manifest.json"
    for path in (finalization_path, row_path, bundle_path):
        assert_regular_0600(path)
    if (
        finalization.get("checkpointRowRef") != relative(row_path)
        or finalization.get("checkpointRowSha256") != file_sha256(row_path)
        or finalization.get("bundleManifestRef") != relative(bundle_path)
        or finalization.get("bundleManifestSha256") != file_sha256(bundle_path)
    ):
        raise ValueError("Control finalization row/bundle digest binding drift")
    proposed = load_single_row(row_path, G3_CHECKPOINT_HEADER)
    identities = {
        "checkpoint_id": "checkpointId", "checkpoint_kind": "checkpointKind",
        "owner_session_id": "ownerSessionId", "writer_session_id": "writerSessionId",
        "repository": "repository", "slice_id": "sliceId",
        "parent_head_sha": "parentHeadSha", "head_sha": "headSha",
        "source_checkpoint_id": "sourceCheckpointId",
    }
    for row_field, finalization_field in identities.items():
        expected = finalization.get(finalization_field) or ""
        if proposed.get(row_field) != expected:
            raise ValueError(f"Control finalization identity drift: {row_field}")
    if proposed.get("checkpoint_seq") != "CONTROL_ASSIGNS_AT_APPEND" or proposed.get("recorded_at") != "CONTROL_ASSIGNS_AT_APPEND":
        raise ValueError("Control bundle pre-assigned checkpoint sequence/time")

    dependency: dict[str, str] | None = None
    dependency_ref = finalization.get("dependencyRowRef")
    dependency_sha = finalization.get("dependencyRowSha256")
    dependency_path = sealed / "dependency-row.csv"
    if dependency_ref is None and dependency_sha is None:
        if dependency_path.exists() or proposed.get("dependency_checkpoint_id"):
            raise ValueError("Control dependency lifecycle mismatch")
    else:
        assert_regular_0600(dependency_path)
        if dependency_ref != relative(dependency_path) or dependency_sha != file_sha256(dependency_path):
            raise ValueError("Control dependency row digest binding drift")
        dependency = load_single_row(dependency_path, G3_CROSS_REPO_DEPENDENCY_HEADER)
        if (
            dependency.get("dependency_seq") != "CONTROL_ASSIGNS_AT_APPEND"
            or dependency.get("dependency_id") != proposed.get("dependency_checkpoint_id")
            or dependency.get("consumer_checkpoint_id") != checkpoint_id
        ):
            raise ValueError("Control dependency row identity/sequence drift")

    bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    if (
        not isinstance(bundle, dict)
        or set(bundle) != BUNDLE_MANIFEST_FIELDS
        or bundle.get("schema") != "dwp.hris.g3.control-checkpoint-bundle-manifest.v1"
        or bundle.get("checkpointId") != checkpoint_id
        or bundle.get("rootRef") != relative(root)
        or bundle.get("state") != "IMMUTABLE_CONTROL_INTAKE_BUNDLE"
        or not isinstance(bundle.get("files"), list)
    ):
        raise ValueError("Control bundle manifest schema/identity drift")
    observed: dict[str, Path] = {}
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError("Control bundle contains a symlink")
        if path.is_file() and path not in {bundle_path, finalization_path}:
            assert_regular_0600(path)
            observed[relative(path)] = path
        elif path.is_dir() and path not in {root, sealed}:
            raise ValueError("Control bundle contains an unexpected directory")
    files = bundle.get("files", [])
    listed_paths = [str(item.get("path", "")) for item in files if isinstance(item, dict)]
    if len(listed_paths) != len(files) or listed_paths != sorted(observed) or len(listed_paths) != len(set(listed_paths)):
        raise ValueError("Control bundle manifest file closure/order drift")
    for item in files:
        path = observed.get(str(item.get("path", ""))) if isinstance(item, dict) else None
        if (
            not isinstance(item, dict)
            or set(item) != {"path", "sha256", "size", "mode"}
            or path is None
            or item.get("sha256") != file_sha256(path)
            or item.get("size") != path.stat().st_size
            or item.get("mode") != "0600"
        ):
            raise ValueError("Control bundle manifest exact byte/mode seal drift")
    return finalization, proposed, dependency


def allocate_checkpoint(
    existing: list[dict[str, str]],
    proposed: dict[str, str],
    recorded_at: str | None = None,
) -> tuple[list[dict[str, str]], dict[str, str]]:
    checkpoint_id = proposed.get("checkpoint_id", "")
    if not checkpoint_id or any(row.get("checkpoint_id") == checkpoint_id for row in existing):
        raise ValueError("Control checkpoint ID is blank or replayed")
    kind = proposed.get("checkpoint_kind", "")
    owner = proposed.get("owner_session_id", "")
    repository = proposed.get("repository", "")
    chain_session = owner if kind == "CONTROL_BASELINE_SYNC" else "CONTROL"
    expected_parent = next(
        (
            row.get("head_sha", "")
            for row in reversed(existing)
            if row.get("repository") == repository
            and (
                row.get("owner_session_id")
                if row.get("checkpoint_kind") == "CONTROL_BASELINE_SYNC"
                else row.get("writer_session_id")
            ) == chain_session
        ),
        None,
    )
    if expected_parent is None:
        from validate_code_checkpoint import BACKEND_SHA, FRONTEND_SHA
        expected_parent = BACKEND_SHA if repository == "DWP_BACKEND" else FRONTEND_SHA
    if proposed.get("parent_head_sha") != expected_parent:
        raise ValueError("Control checkpoint parent chain is stale")
    if any(
        row.get("repository") == repository
        and row.get("head_sha") == proposed.get("head_sha")
        and (
            row.get("owner_session_id")
            if row.get("checkpoint_kind") == "CONTROL_BASELINE_SYNC"
            else row.get("writer_session_id")
        ) == chain_session
        for row in existing
    ):
        raise ValueError("Control checkpoint head is replayed on its chain")
    last_time = existing[-1].get("recorded_at", "") if existing else ""
    allocated_time = recorded_at or later_timestamp(last_time)
    if last_time and allocated_time <= last_time:
        raise ValueError("Control checkpoint timestamp is not append-monotonic")
    allocated = dict(proposed)
    allocated["checkpoint_seq"] = str(len(existing) + 1)
    allocated["recorded_at"] = allocated_time
    return [*existing, allocated], allocated


def allocate_dependency(
    existing: list[dict[str, str]], proposed: dict[str, str] | None
) -> tuple[list[dict[str, str]], dict[str, str] | None]:
    if proposed is None:
        return list(existing), None
    dependency_id = proposed.get("dependency_id", "")
    if proposed.get("dependency_seq") != "CONTROL_ASSIGNS_AT_APPEND":
        raise ValueError("Control dependency sequence was pre-assigned")
    if not dependency_id or any(row.get("dependency_id") == dependency_id for row in existing):
        raise ValueError("Control dependency ID is blank or replayed")
    if existing and proposed.get("recorded_at", "") <= existing[-1].get("recorded_at", ""):
        raise ValueError("Control dependency timestamp is not append-monotonic")
    allocated = dict(proposed)
    allocated["dependency_seq"] = str(len(existing) + 1)
    return [*existing, allocated], allocated


def fsync_parent(path: Path) -> None:
    descriptor = os.open(path.parent, os.O_RDONLY | getattr(os, "O_CLOEXEC", 0))
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def replace_bytes(path: Path, content: bytes) -> None:
    descriptor, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
        fsync_parent(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def restore_transaction(
    dependency_bytes: bytes,
    checkpoint_bytes: bytes,
    state_bytes: bytes,
) -> None:
    failures: list[str] = []
    for path, content in (
        (DEPENDENCY_REGISTER, dependency_bytes),
        (CHECKPOINT_REGISTER, checkpoint_bytes),
        (STATE, state_bytes),
    ):
        try:
            replace_bytes(path, content)
        except Exception as error:
            failures.append(f"{path.name}: {error}")
    if failures:
        raise RuntimeError("transaction rollback incomplete: " + "; ".join(failures))


def load_state(require_committed: bool) -> dict[str, object]:
    payload = json.loads(STATE.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or set(payload) != G3_CONTROL_CHECKPOINT_STATE_FIELDS:
        raise ValueError("Control checkpoint transaction marker schema drift")
    expected_phase = "COMMITTED" if require_committed else "PREPARED"
    expected_status = (
        "CONTROL_CHECKPOINT_TRANSACTION_COMMITTED"
        if require_committed else "CONTROL_CHECKPOINT_TRANSACTION_PREPARED"
    )
    if payload.get("phase") != expected_phase or payload.get("status") != expected_status:
        raise ValueError(f"Control checkpoint transaction is not {expected_phase}")
    return payload


def control_live_scope(checkpoint: dict[str, str]) -> str:
    return (
        checkpoint.get("owner_session_id", "")
        if checkpoint.get("checkpoint_kind") == "CONTROL_BASELINE_SYNC"
        else "CONTROL"
    )


def validate_candidate(
    checkpoints: list[dict[str, str]],
    dependencies: list[dict[str, str]],
    allocated: dict[str, str],
) -> None:
    checks = Checks()
    validate_g3_checkpoint_registry(checks, checkpoints)
    validate_cross_repo_dependency_registry(checks, dependencies)
    profiles = validate_command_catalog(checks)
    prior = {
        row.get("checkpoint_id", ""): row
        for row in checkpoints
        if row.get("checkpoint_id") != allocated.get("checkpoint_id")
    }
    validate_checkpoint_test_evidence(checks, allocated, prior, profiles, dependencies)
    baselines = validate_baselines(checks)
    worktrees = validate_worktrees_static(checks)
    proposals = validate_control_proposal_registry(checks, checkpoints)
    validate_live(
        checks, baselines, worktrees, checkpoints, profiles, proposals,
        control_live_scope(allocated),
        dependency_rows_override=dependencies,
    )
    if checks.errors:
        raise ValueError("Control checkpoint candidate rejected: " + "; ".join(checks.errors))


def transaction_material(
    finalization_path: Path,
    *,
    checkpoint_recorded_at: str | None = None,
    base_checkpoint_rows: list[dict[str, str]] | None = None,
    base_dependency_rows: list[dict[str, str]] | None = None,
) -> tuple[
    dict[str, object], list[dict[str, str]], list[dict[str, str]],
    dict[str, str], dict[str, str] | None,
]:
    finalization, proposed_checkpoint, proposed_dependency = validate_bundle(finalization_path)
    checkpoints = read_csv(CHECKPOINT_REGISTER) if base_checkpoint_rows is None else base_checkpoint_rows
    dependencies = read_csv(DEPENDENCY_REGISTER) if base_dependency_rows is None else base_dependency_rows
    minimum_time = dependencies[-1].get("recorded_at", "") if dependencies else ""
    assigned = checkpoint_recorded_at or later_timestamp(
        max(checkpoints[-1].get("recorded_at", "") if checkpoints else "", minimum_time)
    )
    candidate_checkpoints, allocated_checkpoint = allocate_checkpoint(
        checkpoints, proposed_checkpoint, assigned
    )
    candidate_dependencies, allocated_dependency = allocate_dependency(
        dependencies, proposed_dependency
    )
    if allocated_dependency and allocated_dependency.get("recorded_at", "") > assigned:
        raise ValueError("dependency receipt was recorded after checkpoint append time")
    validate_candidate(candidate_checkpoints, candidate_dependencies, allocated_checkpoint)
    return (
        finalization, candidate_checkpoints, candidate_dependencies,
        allocated_checkpoint, allocated_dependency,
    )


def prepared_state(
    prior: dict[str, object],
    finalization: dict[str, object],
    checkpoint_rows: list[dict[str, str]],
    dependency_rows: list[dict[str, str]],
    allocated: dict[str, str],
    allocated_dependency: dict[str, str] | None,
    prepared_at: str,
) -> dict[str, object]:
    bundle_ref = str(finalization["bundleManifestRef"])
    return {
        "schema": "dwp.hris.g3.control-checkpoint-transaction-state.v1",
        "transactionSeq": int(prior["transactionSeq"]) + 1,
        "phase": "PREPARED",
        "priorCheckpointRegisterSha256": file_sha256(CHECKPOINT_REGISTER),
        "priorDependencyRegisterSha256": file_sha256(DEPENDENCY_REGISTER),
        "candidateCheckpointRegisterSha256": sha256_bytes(
            csv_bytes(G3_CHECKPOINT_HEADER, checkpoint_rows)
        ),
        "candidateDependencyRegisterSha256": sha256_bytes(
            csv_bytes(G3_CROSS_REPO_DEPENDENCY_HEADER, dependency_rows)
        ),
        "controlCheckpointProjectionSha256": control_checkpoint_projection_sha256(
            checkpoint_rows
        ),
        "dependencyRegisterSha256": sha256_bytes(
            csv_bytes(G3_CROSS_REPO_DEPENDENCY_HEADER, dependency_rows)
        ),
        "checkpointId": allocated["checkpoint_id"],
        "dependencyId": allocated_dependency["dependency_id"] if allocated_dependency else "",
        "lastDependencyId": dependency_rows[-1]["dependency_id"] if dependency_rows else "",
        "checkpointSeq": int(allocated["checkpoint_seq"]),
        "dependencySeq": len(dependency_rows),
        "bundleRef": bundle_ref,
        "bundleSha256": file_sha256(ROOT / bundle_ref),
        "checkpointRecordedAt": allocated["recorded_at"],
        "preparedAt": prepared_at,
        "committedAt": None,
        "priorState": prior,
        "status": "CONTROL_CHECKPOINT_TRANSACTION_PREPARED",
    }


def committed_state(prepared: dict[str, object]) -> dict[str, object]:
    payload = dict(prepared)
    payload.update(
        {
            "phase": "COMMITTED",
            "committedAt": later_timestamp(str(prepared["checkpointRecordedAt"])),
            "priorState": None,
            "status": "CONTROL_CHECKPOINT_TRANSACTION_COMMITTED",
        }
    )
    return payload


def append_finalization(finalization_path: Path) -> dict[str, object]:
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        assert_all_central_transactions_committed()
        assert_current_gate_open()
        state_checks = Checks()
        prior = validate_control_checkpoint_transaction_state(state_checks)
        if state_checks.errors:
            raise ValueError("Control transaction precondition invalid: " + "; ".join(state_checks.errors))
        finalization, checkpoints, dependencies, allocated, allocated_dependency = transaction_material(
            finalization_path
        )
        checkpoint_content = csv_bytes(G3_CHECKPOINT_HEADER, checkpoints)
        dependency_content = csv_bytes(G3_CROSS_REPO_DEPENDENCY_HEADER, dependencies)
        prior_checkpoint = CHECKPOINT_REGISTER.read_bytes()
        prior_dependency = DEPENDENCY_REGISTER.read_bytes()
        prior_state = STATE.read_bytes()
        journal = prepared_state(
            prior, finalization, checkpoints, dependencies, allocated,
            allocated_dependency, later_timestamp(str(prior.get("committedAt") or "")),
        )
        try:
            replace_bytes(STATE, json_bytes(journal))
            # Ordinary Gate authority correctly rejects PREPARED.  Under the
            # retained opaque host lease, validate the complete publication
            # seal against this exact journal's prior committed projection and
            # require every other central transaction to remain COMMITTED.
            assert_authoritative_gate_open_during_prepared_transaction(
                "G3_CONTROL_CHECKPOINT", journal
            )
            replace_bytes(DEPENDENCY_REGISTER, dependency_content)
            replace_bytes(CHECKPOINT_REGISTER, checkpoint_content)
            replace_bytes(STATE, json_bytes(committed_state(journal)))
        except Exception as error:
            try:
                restore_transaction(prior_dependency, prior_checkpoint, prior_state)
            except RuntimeError as rollback_error:
                raise RuntimeError(str(rollback_error)) from error
            raise
        return {
            "schema": "dwp.hris.g3.control-checkpoint-cas-result.v1",
            "status": "PASS",
            "checkpointId": allocated["checkpoint_id"],
            "checkpointSeq": allocated["checkpoint_seq"],
            "dependencyId": allocated_dependency["dependency_id"] if allocated_dependency else None,
            "transactionSeq": int(journal["transactionSeq"]),
            "stateSha256": file_sha256(STATE),
        }


def recover_prepared(action: str) -> dict[str, object]:
    if action not in {"commit", "rollback"}:
        raise ValueError("recovery action must be commit or rollback")
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        assert_recovery_exclusive("G3_CONTROL_CHECKPOINT")
        journal = load_state(require_committed=False)
        prior_state = journal.get("priorState")
        if not isinstance(prior_state, dict) or set(prior_state) != G3_CONTROL_CHECKPOINT_STATE_FIELDS:
            raise ValueError("PREPARED transaction lacks an exact prior committed marker")
        bundle_ref = str(journal.get("bundleRef", ""))
        bundle = ROOT / bundle_ref
        if not bundle.is_file() or file_sha256(bundle) != journal.get("bundleSha256"):
            raise ValueError("PREPARED transaction immutable bundle is unavailable or stale")
        finalization_path = bundle.parent / "finalization.json"

        current_checkpoints = read_csv(CHECKPOINT_REGISTER)
        current_dependencies = read_csv(DEPENDENCY_REGISTER)
        checkpoint_digest = file_sha256(CHECKPOINT_REGISTER)
        dependency_digest = file_sha256(DEPENDENCY_REGISTER)
        if checkpoint_digest not in {
            journal.get("priorCheckpointRegisterSha256"),
            journal.get("candidateCheckpointRegisterSha256"),
        } or dependency_digest not in {
            journal.get("priorDependencyRegisterSha256"),
            journal.get("candidateDependencyRegisterSha256"),
        }:
            raise ValueError("PREPARED transaction register bytes are neither preimage nor candidate")

        base_checkpoints = list(current_checkpoints)
        if checkpoint_digest == journal.get("candidateCheckpointRegisterSha256"):
            if not base_checkpoints or base_checkpoints[-1].get("checkpoint_id") != journal.get("checkpointId"):
                raise ValueError("PREPARED checkpoint candidate tail drift")
            base_checkpoints.pop()
        base_dependencies = list(current_dependencies)
        if dependency_digest == journal.get("candidateDependencyRegisterSha256") and journal.get("dependencyId"):
            if not base_dependencies or base_dependencies[-1].get("dependency_id") != journal.get("dependencyId"):
                raise ValueError("PREPARED dependency candidate tail drift")
            base_dependencies.pop()
        prior_checkpoint_bytes = csv_bytes(G3_CHECKPOINT_HEADER, base_checkpoints)
        prior_dependency_bytes = csv_bytes(G3_CROSS_REPO_DEPENDENCY_HEADER, base_dependencies)
        if (
            sha256_bytes(prior_checkpoint_bytes) != journal.get("priorCheckpointRegisterSha256")
            or sha256_bytes(prior_dependency_bytes) != journal.get("priorDependencyRegisterSha256")
        ):
            raise ValueError("PREPARED transaction preimage reconstruction drift")

        if action == "rollback":
            replace_bytes(DEPENDENCY_REGISTER, prior_dependency_bytes)
            replace_bytes(CHECKPOINT_REGISTER, prior_checkpoint_bytes)
            replace_bytes(STATE, json_bytes(prior_state))
            return {
                "schema": "dwp.hris.g3.control-checkpoint-recovery-result.v1",
                "status": "PASS", "action": "ROLLBACK",
                "transactionSeq": prior_state.get("transactionSeq"),
            }

        assert_authoritative_gate_open_during_prepared_transaction(
            "G3_CONTROL_CHECKPOINT", journal
        )
        finalization, checkpoints, dependencies, allocated, _allocated_dependency = transaction_material(
            finalization_path,
            checkpoint_recorded_at=str(journal.get("checkpointRecordedAt", "")),
            base_checkpoint_rows=base_checkpoints,
            base_dependency_rows=base_dependencies,
        )
        del finalization, allocated
        checkpoint_content = csv_bytes(G3_CHECKPOINT_HEADER, checkpoints)
        dependency_content = csv_bytes(G3_CROSS_REPO_DEPENDENCY_HEADER, dependencies)
        if (
            sha256_bytes(checkpoint_content) != journal.get("candidateCheckpointRegisterSha256")
            or sha256_bytes(dependency_content) != journal.get("candidateDependencyRegisterSha256")
        ):
            raise ValueError("PREPARED transaction deterministic candidate reconstruction drift")
        assert_authoritative_gate_open_during_prepared_transaction(
            "G3_CONTROL_CHECKPOINT", journal
        )
        replace_bytes(DEPENDENCY_REGISTER, dependency_content)
        replace_bytes(CHECKPOINT_REGISTER, checkpoint_content)
        replace_bytes(STATE, json_bytes(committed_state(journal)))
        return {
            "schema": "dwp.hris.g3.control-checkpoint-recovery-result.v1",
            "status": "PASS", "action": "COMMIT",
            "transactionSeq": journal.get("transactionSeq"),
        }


def self_test() -> dict[str, object]:
    import inspect

    cases: dict[str, bool] = {}
    append_source = inspect.getsource(append_finalization)
    positions = [
        append_source.find("exclusive_host_semaphore("),
        append_source.find("assert_current_gate_open()"),
        append_source.find("transaction_material("),
        append_source.find("replace_bytes(STATE, json_bytes(journal))"),
        append_source.find(
            "assert_authoritative_gate_open_during_prepared_transaction("
        ),
        append_source.find("replace_bytes(DEPENDENCY_REGISTER"),
        append_source.find("replace_bytes(CHECKPOINT_REGISTER"),
        append_source.find("replace_bytes(STATE, json_bytes(committed_state(journal)))"),
    ]
    cases["lock-validation-prepared-gate-two-registers-commit-order"] = (
        all(position >= 0 for position in positions) and positions == sorted(positions)
    )
    cases["synchronous-three-file-rollback-present"] = all(
        needle in append_source
        for needle in (
            "restore_transaction(prior_dependency, prior_checkpoint, prior_state)",
            "except RuntimeError as rollback_error",
        )
    ) and all(
        needle in inspect.getsource(restore_transaction)
        for needle in ("DEPENDENCY_REGISTER", "CHECKPOINT_REGISTER", "STATE")
    )
    replacement = inspect.getsource(replace_bytes)
    cases["every-replace-fsyncs-file-and-parent"] = (
        "os.fsync(handle.fileno())" in replacement
        and "os.replace(temporary, path)" in replacement
        and "fsync_parent(path)" in replacement
    )
    recovery = inspect.getsource(recover_prepared)
    cases["prepared-recovery-accepts-only-prior-or-candidate-digests"] = (
        "neither preimage nor candidate" in recovery
        and 'action == "rollback"' in recovery
        and "deterministic candidate reconstruction" in recovery
    )
    cases["prepared-commit-uses-retained-lock-gate-seal-only"] = (
        append_source.count(
            "assert_authoritative_gate_open_during_prepared_transaction("
        )
        == 1
        and recovery.count(
            "assert_authoritative_gate_open_during_prepared_transaction("
        )
        == 2
        and "assert_current_gate_open()" not in recovery
        and '"G3_CONTROL_CHECKPOINT", journal' in append_source
        and '"G3_CONTROL_CHECKPOINT", journal' in recovery
    )
    rows: list[dict[str, str]] = []
    first = {field: "" for field in G3_CHECKPOINT_HEADER}
    first.update(
        {
            "checkpoint_seq": "CONTROL_ASSIGNS_AT_APPEND",
            "checkpoint_id": "G3-CTL-SELF-001",
            "checkpoint_kind": "CENTRAL_MATERIALIZATION",
            "writer_session_id": "CONTROL",
            "owner_session_id": "HRIS-HRM",
            "repository": "DWP_BACKEND",
            "parent_head_sha": __import__("validate_code_checkpoint").BACKEND_SHA,
            "head_sha": "1" * 40,
            "recorded_at": "CONTROL_ASSIGNS_AT_APPEND",
        }
    )
    rows, allocated = allocate_checkpoint(rows, first, "2026-09-15T00:00:01.000Z")
    cases["control-global-sequence-and-time-allocated"] = (
        allocated["checkpoint_seq"] == "1"
        and allocated["recorded_at"] == "2026-09-15T00:00:01.000Z"
    )
    stale = dict(first, checkpoint_id="G3-CTL-SELF-002", head_sha="2" * 40)
    try:
        allocate_checkpoint(rows, stale, "2026-09-15T00:00:02.000Z")
        cases["stale-control-parent-rejected"] = False
    except ValueError:
        cases["stale-control-parent-rejected"] = True
    dependency = {field: "" for field in G3_CROSS_REPO_DEPENDENCY_HEADER}
    dependency.update(
        {
            "dependency_seq": "CONTROL_ASSIGNS_AT_APPEND",
            "dependency_id": "DEP-G3-CTL-SELF-001",
            "recorded_at": "2026-09-15T00:00:00.000Z",
        }
    )
    deps, allocated_dep = allocate_dependency([], dependency)
    cases["dependency-sequence-allocated"] = (
        len(deps) == 1 and allocated_dep is not None
        and allocated_dep["dependency_seq"] == "1"
    )
    cases["control-live-replay-excludes-foreign-dirty-module"] = (
        control_live_scope(first) == "CONTROL"
        and control_live_scope(
            dict(first, checkpoint_kind="CONTROL_BASELINE_SYNC", owner_session_id="HRIS-HRM")
        ) == "HRIS-HRM"
        and "control_live_scope(allocated)" in inspect.getsource(validate_candidate)
    )
    with tempfile.TemporaryDirectory(prefix="g3-control-checkpoint-selftest-") as temporary:
        path = Path(temporary) / "state.json"
        path.write_bytes(b"old\n")
        replace_bytes(path, b"new\n")
        cases["atomic-replace-exact-bytes"] = path.read_bytes() == b"new\n"
    status = "PASS" if all(cases.values()) else "FAIL"
    return {
        "schema": "dwp.hris.g3.control-checkpoint-cas-self-test.v1",
        "status": status,
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--finalization")
    parser.add_argument("--recover", choices=("commit", "rollback"))
    parser.add_argument("--self-test", action="store_true")
    arguments = parser.parse_args()
    selected = sum(
        (bool(arguments.finalization), bool(arguments.recover), arguments.self_test)
    )
    if selected != 1:
        parser.error("choose exactly one of --finalization, --recover, or --self-test")
    try:
        if arguments.self_test:
            result = self_test()
        elif arguments.recover:
            result = recover_prepared(arguments.recover)
        else:
            result = append_finalization(safe_finalization(str(arguments.finalization)))
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result.get("status") == "PASS" else 1
    except (OSError, ValueError, json.JSONDecodeError, SemaphoreTimeoutError) as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
