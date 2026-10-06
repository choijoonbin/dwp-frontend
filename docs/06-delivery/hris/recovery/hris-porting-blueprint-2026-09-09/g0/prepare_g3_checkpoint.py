#!/usr/bin/env python3
"""Prepare and finalize a module-owned G3 checkpoint without central mutation.

The helper derives touches from a committed Git range, resolves allocations and
registered commands from sealed catalogs, and never accepts a command string.
``finalize`` emits an append-ready, validator-compatible proposal bundle.  It
deliberately does not append ``g3-checkpoint-register.csv``; Integration Control
allocates the global sequence/timestamp under the shared host lock.  A module
draft is therefore bound to its own session/repository parent, not to a global
register preimage that would starve parallel module work.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    active_host_semaphore_capability,
    exclusive_host_semaphore,
)
from gate_authority import assert_authoritative_gate_open
from write_module_evidence_shard import (
    append_new_bytes,
    assert_canonical_workspace,
    evidence_shard_lock_name,
    read_stable_source,
    resolve_target,
)
from validate_code_checkpoint import (
    BACKEND_SHA,
    Checks,
    G0,
    G3_CHECKPOINT_HEADER,
    G3_TOUCH_HEADER,
    MODULES,
    ROOT,
    allocation_path_allowed,
    canonical_argv_sha256,
    changed_entries,
    expected_command_bindings,
    file_sha256,
    git,
    git_blob_oid,
    is_registered_migration_path,
    migration_path_allowed,
    migration_path_allowed_for_ids,
    migration_reservation_allows,
    ownership_allows,
    parse_frontend_slice_typed_result,
    read_csv,
    reproducible_result_sha256,
    reserved_migration_owners,
    split_pipe,
    stable_fingerprint,
    valid_typed_receipt,
    validate_checkpoint_test_evidence,
    validate_command_catalog,
)


CHECKPOINT_ID = re.compile(r"^G3-[A-Z0-9][A-Z0-9-]{2,100}$")
REPOSITORIES = ("DWP_BACKEND", "DWP_FRONTEND")
OPERATION_MAP_HEADER = [
    "touch_id",
    "slice_id",
    "session_id",
    "repository",
    "allocation_id",
    "changed_path",
    "git_status",
    "git_operation",
    "allowed_operation_refs",
    "selected_operation_refs",
]
IMMUTABLE_OPERATION_FIELDS = OPERATION_MAP_HEADER[:-1]
SLICE_REGISTER = ROOT / "coding-readiness/g3-slice-code-go-register.csv"
ALLOCATION_REGISTER = ROOT / "coding-readiness/g3-file-allocation-register.csv"
CHECKPOINT_REGISTER = G0 / "g3-checkpoint-register.csv"
TOUCH_VALIDATOR = ROOT / "coding-readiness/validate_g3_slice_code_go.py"
CURRENT_GATE_DECISION = G0 / "current-g3-gate-decision.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def gate_decision_allows_module_execution(payload: object) -> bool:
    return (
        isinstance(payload, dict)
        and payload.get("schema") == "dwp.hris.current-g3-gate-decision.v1"
        and payload.get("currentState") == "OPEN_AUTHORITATIVE_LIVE"
        and payload.get("effectiveGate") == "OPEN_G3_CODE"
    )


def assert_current_gate_open() -> None:
    """Compatibility name; authority now requires the full live publication seal."""
    assert_authoritative_gate_open()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def csv_bytes(header: list[str], rows: list[dict[str, str]]) -> bytes:
    import io

    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=header, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def json_bytes(payload: dict[str, object]) -> bytes:
    return (
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")


def append_or_verify_exact_batch(
    session: str,
    artifacts: list[tuple[str, bytes]],
    phase: str = "g3",
    *,
    _shard_lock_capability: object | None = None,
    _lock_environment: dict[str, str] | None = None,
    _parent_pid: int | None = None,
) -> list[Path]:
    """Append one immutable batch or verify a complete byte-identical retry.

    A process may stop after the sealed evidence batch is committed but before
    the proposed row/finalization batch is appended. Retrying that exact phase
    is safe; a partial or byte-different pre-existing batch is not.
    """
    if not artifacts:
        raise ValueError("artifact batch must not be empty")
    return [
        path
        for path, _chain in append_new_bytes(
            session,
            artifacts,
            phase,
            _shard_lock_held_by_parent=_shard_lock_capability is not None,
            _shard_lock_capability=_shard_lock_capability,
            _lock_environment=_lock_environment,
            _parent_pid=_parent_pid,
        )
    ]


def atomic_write_bytes(path: Path, value: bytes, *, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(value)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def atomic_write_json(path: Path, payload: dict[str, object]) -> None:
    atomic_write_bytes(path, json_bytes(payload))


def atomic_write_csv(
    path: Path, header: list[str], rows: list[dict[str, str]]
) -> None:
    atomic_write_bytes(path, csv_bytes(header, rows))


def load_csv_exact(path: Path, expected_header: list[str]) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if list(reader.fieldnames or []) != expected_header:
            raise ValueError(f"CSV header drift: {path.name}")
        return list(reader)


def load_csv_exact_bytes(
    value: bytes, expected_header: list[str]
) -> list[dict[str, str]]:
    import io

    with io.StringIO(value.decode("utf-8-sig"), newline="") as handle:
        reader = csv.DictReader(handle)
        if list(reader.fieldnames or []) != expected_header:
            raise ValueError("CSV header drift in stable external input")
        return list(reader)


def module_slice(session: str, slice_id: str) -> dict[str, str]:
    matches = [
        row
        for row in read_csv(SLICE_REGISTER)
        if row.get("slice_id") == slice_id
    ]
    if len(matches) != 1:
        raise ValueError("slice ID is absent or duplicated")
    row = matches[0]
    if (
        row.get("session_id") != session
        or row.get("gate_status") != "OPEN_G3_CODE"
        or row.get("code_go_token") != f"G3-CODE-GO-{slice_id}"
    ):
        raise ValueError("slice is not code-open for the selected module")
    return row


def registered_worktree(session: str, repository: str) -> tuple[dict[str, str], Path]:
    matches = [
        row
        for row in read_csv(G0 / "worktree-branch-register.csv")
        if row.get("session_id") == session
        and row.get("repository") == repository
    ]
    if len(matches) != 1:
        raise ValueError("module worktree registration is absent or duplicated")
    registration = matches[0]
    worktree = Path(registration["worktree_path"])
    assert_registered_worktree_identity(registration, worktree)
    return registration, worktree


def assert_registered_worktree_identity(
    registration: dict[str, str], worktree: Path
) -> None:
    if not worktree.is_dir() or worktree.is_symlink():
        raise ValueError("registered module worktree is missing or symlinked")
    if (
        registration.get("clean_required") != "YES"
        or registration.get("state") != "READY_G3_CODE"
    ):
        raise ValueError("registered module worktree is not G3-ready")
    code, branch = git(worktree, "branch", "--show-current")
    if code != 0 or branch != registration.get("branch"):
        raise ValueError("registered module worktree branch drift")
    code, dirty = git(
        worktree,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--ignore-submodules=none",
    )
    if code != 0 or dirty:
        raise ValueError("registered module worktree must be clean")


def assert_forward_checkpoint_range(
    worktree: Path,
    parent: str,
    head: str,
    prior_heads: set[str],
) -> None:
    if not re.fullmatch(r"[0-9a-f]{40}", parent) or not re.fullmatch(
        r"[0-9a-f]{40}", head
    ):
        raise ValueError("checkpoint parent/head must be lowercase 40-hex")
    if head == parent:
        raise ValueError("checkpoint range is empty; commit the bounded slice first")
    if head in prior_heads:
        raise ValueError("module HEAD already has a checkpoint")
    parent_code, _ = git(worktree, "cat-file", "-e", f"{parent}^{{commit}}")
    head_code, _ = git(worktree, "cat-file", "-e", f"{head}^{{commit}}")
    ancestor_code, _ = git(worktree, "merge-base", "--is-ancestor", parent, head)
    if parent_code != 0 or head_code != 0 or ancestor_code != 0:
        raise ValueError("module checkpoint is not a resolvable forward range")


def checkpoint_rows() -> list[dict[str, str]]:
    return load_csv_exact(CHECKPOINT_REGISTER, G3_CHECKPOINT_HEADER)


def checkpoint_chain_session(row: dict[str, str]) -> str:
    return (
        row.get("owner_session_id", "")
        if row.get("checkpoint_kind") == "CONTROL_BASELINE_SYNC"
        else row.get("writer_session_id", "")
    )


def checkpoint_context(
    session: str, repository: str, slice_id: str
) -> tuple[dict[str, str], dict[str, str], Path, str, str, list[dict[str, str]]]:
    slice_row = module_slice(session, slice_id)
    registration, worktree = registered_worktree(session, repository)
    rows = checkpoint_rows()
    parent = registration["head_sha"]
    for row in rows:
        if (
            checkpoint_chain_session(row) == session
            and row.get("repository") == repository
        ):
            parent = row.get("head_sha", "")
    code, head = git(worktree, "rev-parse", "HEAD")
    if code != 0 or not re.fullmatch(r"[0-9a-f]{40}", head):
        raise ValueError("cannot resolve module worktree HEAD")
    prior_heads = {
        row.get("head_sha", "")
        for row in rows
        if
        checkpoint_chain_session(row) == session
        and row.get("repository") == repository
    }
    assert_forward_checkpoint_range(worktree, parent, head, prior_heads)
    return slice_row, registration, worktree, parent, head, rows


def known_operation_refs(slice_row: dict[str, str], repository: str) -> set[str]:
    refs = split_pipe(slice_row.get("primary_contract_refs", "")) | {
        slice_row.get("source_ref", "")
    }
    if repository == "DWP_BACKEND":
        refs |= split_pipe(slice_row.get("consumed_xcon_refs", ""))
        refs |= split_pipe(slice_row.get("consumed_service_pep_refs", ""))
    else:
        refs |= split_pipe(slice_row.get("primary_ia_node_ids", ""))
    refs.discard("")
    if not refs:
        raise ValueError("slice has no operation reference authority")
    return refs


def matching_allocation(
    slice_row: dict[str, str], session: str, repository: str, changed_path: str
) -> str:
    allocation_ids = split_pipe(slice_row.get("file_allocation_ids", ""))
    allocations = [
        row
        for row in read_csv(ALLOCATION_REGISTER)
        if row.get("allocation_id") in allocation_ids
        and row.get("session_id") == session
        and row.get("repository") == repository
        and row.get("state") == "ALLOCATED_G3_NOT_IMPLEMENTED"
        and any(
            allocation_path_allowed(changed_path, pattern)
            for pattern in split_pipe(row.get("path_globs", ""))
        )
    ]
    if len(allocations) != 1:
        raise ValueError(
            f"changed path must resolve to exactly one named module allocation: {changed_path}"
        )
    return allocations[0]["allocation_id"]


def assert_owner_module_migration(
    *,
    slice_row: dict[str, str],
    session: str,
    repository: str,
    changed_path: str,
    status: str,
    allocation_id: str,
    worktree: Path,
    head: str,
) -> None:
    if repository != "DWP_BACKEND" or status != "A":
        raise ValueError("module migration must be a DWP_BACKEND CREATE")
    allocations = {
        row.get("allocation_id", ""): row
        for row in read_csv(ALLOCATION_REGISTER)
    }
    allocation = allocations.get(allocation_id, {})
    if (
        allocation.get("artifact_class") != "DATABASE_MIGRATION"
        or allocation.get("session_id") != session
        or allocation.get("repository") != repository
        or not migration_path_allowed(session, changed_path)
        or not migration_path_allowed_for_ids(
            split_pipe(slice_row.get("migration_allocation_ids", "")),
            changed_path,
        )
        or not migration_reservation_allows(
            slice_row.get("slice_id", ""),
            changed_path,
            reserved_migration_owners(),
        )
    ):
        raise ValueError("migration escapes owner reserved range/version/allocation")
    planned = slice_row.get("planned_migration_file", "")
    if planned.endswith(".sql") and changed_path != planned:
        raise ValueError("migration differs from exact slice reservation")
    baseline_code, _ = git(worktree, "cat-file", "-e", f"{BACKEND_SHA}:{changed_path}")
    if baseline_code == 0:
        raise ValueError("existing baseline migration cannot be recreated")
    match = re.fullmatch(r"V([1-9][0-9]*)__[a-z0-9][a-z0-9_]*\.sql", Path(changed_path).name)
    if match is None:
        raise ValueError("migration filename is not canonical")
    code, tree_paths = git(
        worktree,
        "ls-tree",
        "-r",
        "--name-only",
        head,
        "--",
        Path(changed_path).parent.as_posix(),
    )
    version_prefix = f"V{match.group(1)}__"
    if code != 0 or sum(
        Path(candidate).name.startswith(version_prefix)
        for candidate in tree_paths.splitlines()
    ) != 1:
        raise ValueError("migration version is duplicated in module HEAD")


def derive_operation_plan(
    checkpoint_id: str,
    session: str,
    repository: str,
    slice_row: dict[str, str],
    worktree: Path,
    parent: str,
    head: str,
) -> list[dict[str, str]]:
    entries = changed_entries(worktree, parent, head)
    if not entries:
        raise ValueError("checkpoint Git range contains no changes")
    allowed_refs = "|".join(sorted(known_operation_refs(slice_row, repository)))
    operation_by_status = {"A": "CREATE", "M": "MODIFY", "D": "DELETE"}
    result: list[dict[str, str]] = []
    for index, (status, changed_path) in enumerate(entries, 1):
        if status not in operation_by_status:
            raise ValueError(f"Git type-change is forbidden: {changed_path}")
        if (
            not changed_path
            or Path(changed_path).is_absolute()
            or ".." in Path(changed_path).parts
            or any(character in changed_path for character in ("\n", "\r", "\t"))
        ):
            raise ValueError("unsafe changed path in Git range")
        operation = operation_by_status[status]
        if not ownership_allows(session, repository, changed_path, operation):
            raise ValueError(f"Git operation is outside module ownership: {changed_path}")
        allocation_id = matching_allocation(
            slice_row, session, repository, changed_path
        )
        if is_registered_migration_path(changed_path):
            assert_owner_module_migration(
                slice_row=slice_row,
                session=session,
                repository=repository,
                changed_path=changed_path,
                status=status,
                allocation_id=allocation_id,
                worktree=worktree,
                head=head,
            )
        if status != "D" and not git_blob_oid(worktree, head, changed_path):
            raise ValueError(f"non-regular blob/symlink/submodule forbidden: {changed_path}")
        if slice_row.get("source_kind") == "MODERN_CAPABILITY":
            exact_roots = split_pipe(slice_row.get("exact_change_paths", ""))
            if not any(
                changed_path == root
                or changed_path.startswith(root.rstrip("/") + "/")
                for root in exact_roots
            ):
                raise ValueError(f"path is outside modern slice exact roots: {changed_path}")
        result.append(
            {
                "touch_id": f"{checkpoint_id}-T{index:03d}",
                "slice_id": slice_row["slice_id"],
                "session_id": session,
                "repository": repository,
                "allocation_id": allocation_id,
                "changed_path": changed_path,
                "git_status": status,
                "git_operation": operation,
                "allowed_operation_refs": allowed_refs,
                "selected_operation_refs": "",
            }
        )
    return result


def registered_bindings(
    session: str, repository: str, slice_id: str
) -> tuple[
    dict[str, dict[str, object]],
    dict[str, tuple[list[str], str]],
    list[dict[str, str]],
]:
    checks = Checks()
    profiles = validate_command_catalog(checks)
    if checks.errors:
        raise ValueError("G3 command catalog invalid: " + "; ".join(checks.errors))
    checkpoint = {
        "checkpoint_id": "DRAFT",
        "checkpoint_kind": "MODULE_COMMIT",
        "owner_session_id": session,
        "writer_session_id": session,
        "repository": repository,
        "slice_id": slice_id,
        "source_checkpoint_id": "",
    }
    resolved = expected_command_bindings(checkpoint, profiles)
    if not resolved:
        raise ValueError("no registered command bindings for module checkpoint")
    bindings = [
        {
            "commandId": command_id,
            "argvSha256": canonical_argv_sha256(argv),
            "workingDirectory": working_directory,
        }
        for command_id, (argv, working_directory) in sorted(resolved.items())
    ]
    return profiles, resolved, bindings


def checkpoint_directory(session: str, checkpoint_id: str) -> Path:
    if session not in MODULES:
        raise ValueError("unknown module session")
    if not CHECKPOINT_ID.fullmatch(checkpoint_id):
        raise ValueError("checkpoint ID must match G3-[A-Z0-9-]{3,101}")
    return resolve_target(
        session, f"checkpoints/{checkpoint_id}/draft-metadata.json", "g3"
    ).parent


def _prepare_locked(
    session: str,
    repository: str,
    slice_id: str,
    checkpoint_id: str,
    shard_lock_capability: object,
    shard_lock_environment: dict[str, str],
) -> dict[str, object]:
    """Derive and append one draft while global and owner locks stay retained."""
    assert_current_gate_open()
    directory = checkpoint_directory(session, checkpoint_id)
    if directory.exists() or directory.is_symlink():
        raise ValueError("checkpoint directory already exists")
    slice_row, registration, worktree, parent, head, _rows = checkpoint_context(
        session, repository, slice_id
    )
    plan = derive_operation_plan(
        checkpoint_id, session, repository, slice_row, worktree, parent, head
    )
    _profiles, _resolved, bindings = registered_bindings(
        session, repository, slice_id
    )
    plan_value = csv_bytes(OPERATION_MAP_HEADER, plan)
    draft = {
        "schema": "dwp.hris.g3.module-checkpoint-draft.v3",
        "checkpointId": checkpoint_id,
        "checkpointKind": "MODULE_COMMIT",
        "ownerSessionId": session,
        "writerSessionId": session,
        "repository": repository,
        "sliceId": slice_id,
        "parentHeadSha": parent,
        "headSha": head,
        "worktreeRecordId": registration["record_id"],
        "worktreePath": str(worktree),
        "branch": registration["branch"],
        "changedPathsSha256": stable_fingerprint(
            *[row["changed_path"] for row in plan]
        ),
        "operationMapTemplateSha256": sha256_bytes(plan_value),
        "operationSelectionMode": "EXTERNAL_INPUT_THEN_IMMUTABLE_SELECTED_MAP_APPEND",
        "registeredCommandBindings": bindings,
        "createdAt": utc_now(),
        "state": "AWAITING_EXTERNAL_OPERATION_REF_SELECTION",
    }
    prefix = f"checkpoints/{checkpoint_id}"
    appended = append_new_bytes(
        session,
        [
            (f"{prefix}/operation-map-template.csv", plan_value),
            (f"{prefix}/draft-metadata.json", json_bytes(draft)),
        ],
        "g3",
        _shard_lock_held_by_parent=True,
        _shard_lock_capability=shard_lock_capability,
        _lock_environment=shard_lock_environment,
        _parent_pid=os.getpid(),
    )
    return {
        "schema": "dwp.hris.g3.module-checkpoint-prepare-result.v2",
        "status": "PASS",
        "checkpointDirectory": str(directory),
        "operationMapTemplate": str(directory / "operation-map-template.csv"),
        "touchCount": len(plan),
        "nextAction": "COPY_TEMPLATE_OUTSIDE_SHARD_SELECT_NONEMPTY_OPERATION_REFS_THEN_FINALIZE_WITH_SELECTION_MAP",
        "shardEntryChainSha256": [chain for _path, chain in appended],
        "centralRegisterMutated": False,
    }


def prepare(
    session: str, repository: str, slice_id: str, checkpoint_id: str
) -> dict[str, object]:
    """Prepare atomically under the global→owner-shard lock order.

    The complete decision/catalog/worktree/register read through immutable
    shard append is one critical section.  This prevents a concurrent Control
    baseline sync or another owner publisher from invalidating the derived
    parent/HEAD/operation plan between its read and publication.
    """
    shard_lock_name = evidence_shard_lock_name(session, "g3")
    with exclusive_host_semaphore(
        HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0
    ):
        assert_current_gate_open()
        with exclusive_host_semaphore(shard_lock_name, timeout_seconds=30.0):
            shard_capability = active_host_semaphore_capability(shard_lock_name)
            if shard_capability is None:
                raise ValueError("owner shard semaphore capability is unavailable")
            shard_environment = {
                "DWP_HRIS_SHARD_LOCK_NAME": shard_lock_name,
                "DWP_HRIS_SHARD_LOCK_PARENT_PID": str(os.getpid()),
            }
            return _prepare_locked(
                session,
                repository,
                slice_id,
                checkpoint_id,
                shard_capability,
                shard_environment,
            )


def selected_refs(row: dict[str, str]) -> list[str]:
    allowed = split_pipe(row["allowed_operation_refs"])
    selected = split_pipe(row["selected_operation_refs"])
    canonical = "|".join(sorted(selected))
    if not selected:
        raise ValueError(f"touch has no selected operation ref: {row['touch_id']}")
    if selected - allowed:
        raise ValueError(f"touch selected operation ref outside authority: {row['touch_id']}")
    if row["selected_operation_refs"] != canonical:
        raise ValueError(
            f"touch selected refs must be unique and lexically pipe-sorted: {row['touch_id']}"
        )
    return sorted(selected)


def assert_plan_immutable(
    expected: list[dict[str, str]], observed: list[dict[str, str]]
) -> None:
    if len(expected) != len(observed):
        raise ValueError("operation map row count drift")
    for number, (expected_row, observed_row) in enumerate(zip(expected, observed), 1):
        if any(
            observed_row.get(field) != expected_row.get(field)
            for field in IMMUTABLE_OPERATION_FIELDS
        ):
            raise ValueError(f"operation map immutable field drift at row {number}")
        selected_refs(observed_row)


def assert_operation_template_digest(
    expected_plan: list[dict[str, str]], expected_digest: object
) -> None:
    observed_digest = sha256_bytes(csv_bytes(OPERATION_MAP_HEADER, expected_plan))
    if observed_digest != expected_digest:
        raise ValueError("operation map blank-template digest drift")


def capture_registered_commands(
    draft: dict[str, object],
    worktree: Path,
    resolved: dict[str, tuple[list[str], str]],
    output: Path,
) -> dict[str, object]:
    """Execute only catalog-resolved argv and atomically write typed receipts."""

    started_at = utc_now()
    before_head_code, before_head = git(worktree, "rev-parse", "HEAD")
    before_dirty_code, before_dirty = git(
        worktree,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--ignore-submodules=none",
    )
    if (
        before_head_code != 0
        or before_head != draft.get("headSha")
        or before_dirty_code != 0
        or before_dirty
    ):
        raise ValueError("worktree changed before registered command capture")
    environment = os.environ.copy()
    environment.update({"CI": "true", "TZ": "UTC", "LANG": "C", "LC_ALL": "C"})
    receipts: list[dict[str, object]] = []
    slice_row = module_slice(
        str(draft["ownerSessionId"]), str(draft["sliceId"])
    )
    for command_id, (argv, working_directory) in sorted(resolved.items()):
        command_cwd = (worktree / working_directory).resolve()
        root = worktree.resolve()
        if command_cwd != root and root not in command_cwd.parents:
            raise ValueError(f"registered command working directory escapes: {command_id}")
        command_started = utc_now()
        timed_out = False
        try:
            completed = subprocess.run(
                argv,
                cwd=command_cwd,
                env=environment,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                check=False,
                shell=False,
                timeout=1800,
            )
            output_bytes = completed.stdout
            exit_code = completed.returncode
        except subprocess.TimeoutExpired as error:
            timed_out = True
            output_bytes = error.stdout or b""
            if isinstance(output_bytes, str):
                output_bytes = output_bytes.encode("utf-8", errors="replace")
            exit_code = 124
        status_value = "PASS" if exit_code == 0 and not timed_out else "FAIL"
        command_digest = canonical_argv_sha256(argv)
        command_receipt: dict[str, object] = {
                "commandId": command_id,
                "commandSha256": command_digest,
                "startedAt": command_started,
                "endedAt": utc_now(),
                "exitCode": exit_code,
                "outputSha256": sha256_bytes(output_bytes),
                "reproducibleResultSha256": reproducible_result_sha256(
                    command_digest, exit_code, status_value
                ),
                "status": status_value,
            }
        typed_result = parse_frontend_slice_typed_result(
            command_id,
            output_bytes,
            slice_id=str(draft["sliceId"]),
            test_path=slice_row.get("frontend_test_path", ""),
        )
        if typed_result is not None:
            command_receipt["typedResult"] = typed_result
        receipts.append(command_receipt)
    after_head_code, after_head = git(worktree, "rev-parse", "HEAD")
    after_dirty_code, after_dirty = git(
        worktree,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--ignore-submodules=none",
    )
    if (
        after_head_code != 0
        or after_head != draft.get("headSha")
        or after_dirty_code != 0
        or after_dirty
    ):
        raise ValueError("verification commands changed HEAD or left worktree dirty")
    overall = "PASS" if receipts and all(row["status"] == "PASS" for row in receipts) else "FAIL"
    evidence = {
        "schema": "dwp.hris.g3.checkpoint-test-evidence.v1",
        "checkpointId": draft["checkpointId"],
        "checkpointKind": draft["checkpointKind"],
        "sliceId": draft["sliceId"],
        "ownerSessionId": draft["ownerSessionId"],
        "writerSessionId": draft["writerSessionId"],
        "repository": draft["repository"],
        "parentHeadSha": draft["parentHeadSha"],
        "headSha": draft["headSha"],
        "sourceCheckpointId": draft.get("sourceCheckpointId"),
        "commands": receipts,
        "overallStatus": overall,
    }
    atomic_write_json(output, evidence)
    return {
        "schema": "dwp.hris.g3.registered-command-capture-receipt.v1",
        "catalogRef": "g0/g3-verification-command-catalog.v1.json",
        "catalogSha256": file_sha256(G0 / "g3-verification-command-catalog.v1.json"),
        "startedAt": started_at,
        "endedAt": utc_now(),
        "commandCount": len(receipts),
        "failedCommandIds": [
            row["commandId"] for row in receipts if row["status"] != "PASS"
        ],
        "status": overall,
    }


def choose_touch_receipt(
    repository: str, evidence: dict[str, object]
) -> dict[str, object]:
    commands = [row for row in evidence.get("commands", []) if isinstance(row, dict)]
    suffix = "frontend-slice-test" if repository == "DWP_FRONTEND" else "slice-contract"
    candidates = [
        row for row in commands if str(row.get("commandId", "")).split(":")[-1].endswith(suffix)
    ]
    if not candidates:
        raise ValueError("cannot select a registered touch verification receipt")
    receipt = sorted(candidates, key=lambda row: str(row.get("commandId", "")))[0]
    if receipt.get("exitCode") != 0 or receipt.get("status") != "PASS":
        raise ValueError("selected touch verification receipt did not pass")
    return receipt


def assert_receipt_bound(
    receipt: dict[str, object], bindings: list[dict[str, str]]
) -> None:
    expected = {
        row["commandId"]: row["argvSha256"]
        for row in bindings
    }
    command_id = receipt.get("commandId")
    if not isinstance(command_id, str) or command_id not in expected:
        raise ValueError("test evidence contains an unknown command binding")
    if receipt.get("commandSha256") != expected[command_id]:
        raise ValueError("test evidence canonical argv digest mismatch")
    if not re.fullmatch(r"[0-9a-f]{64}", str(receipt.get("outputSha256", ""))):
        raise ValueError("test evidence output digest invalid")
    if receipt.get("exitCode") != 0 or receipt.get("status") != "PASS":
        raise ValueError("test evidence command did not pass")


def assert_test_evidence_identity(
    evidence: dict[str, object],
    draft: dict[str, object],
    bindings: list[dict[str, str]],
) -> None:
    expected_identity = {
        "checkpointId": draft["checkpointId"],
        "checkpointKind": "MODULE_COMMIT",
        "sliceId": draft["sliceId"],
        "ownerSessionId": draft["ownerSessionId"],
        "writerSessionId": draft["writerSessionId"],
        "repository": draft["repository"],
        "parentHeadSha": draft["parentHeadSha"],
        "headSha": draft["headSha"],
        "sourceCheckpointId": None,
    }
    if evidence.get("schema") != "dwp.hris.g3.checkpoint-test-evidence.v1":
        raise ValueError("checkpoint test evidence schema drift")
    if any(evidence.get(field) != value for field, value in expected_identity.items()):
        raise ValueError("checkpoint test evidence identity/replay mismatch")
    commands = evidence.get("commands")
    if not isinstance(commands, list) or not commands:
        raise ValueError("checkpoint test evidence has no commands")
    command_ids = [
        str(row.get("commandId", "")) for row in commands if isinstance(row, dict)
    ]
    if len(command_ids) != len(commands) or set(command_ids) != {
        row["commandId"] for row in bindings
    } or len(command_ids) != len(set(command_ids)):
        raise ValueError("checkpoint test evidence command set mismatch")
    for receipt in commands:
        assert_receipt_bound(receipt, bindings)
    slice_row = module_slice(
        str(draft["ownerSessionId"]), str(draft["sliceId"])
    )
    frontend_receipts = [
        receipt
        for receipt in commands
        if isinstance(receipt, dict)
        and str(receipt.get("commandId", "")).endswith(":frontend-slice-test")
    ]
    if draft.get("repository") == "DWP_FRONTEND":
        if len(frontend_receipts) != 1 or not valid_typed_receipt(
            frontend_receipts[0].get("typedResult"),
            slice_id=str(draft["sliceId"]),
            test_path=slice_row.get("frontend_test_path", ""),
        ):
            raise ValueError("frontend checkpoint lacks one exact typed slice-test PASS")
    elif frontend_receipts:
        raise ValueError("backend checkpoint contains frontend slice-test receipt")
    if evidence.get("overallStatus") != "PASS":
        raise ValueError("checkpoint test evidence overall status is not PASS")


def later_timestamp(previous: str) -> str:
    current = utc_now()
    if not previous or current > previous:
        return current
    parsed = datetime.fromisoformat(previous.replace("Z", "+00:00"))
    return (parsed + timedelta(milliseconds=1)).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def run_touch_validator(manifest: Path) -> dict[str, object]:
    argv = [
        sys.executable,
        str(TOUCH_VALIDATOR),
        "--touch-manifest",
        str(manifest),
        "--compact",
    ]
    started_at = utc_now()
    completed = subprocess.run(
        argv,
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
        shell=False,
        timeout=900,
    )
    return {
        "commandSha256": sha256_bytes(
            json.dumps(argv, separators=(",", ":")).encode("utf-8")
        ),
        "startedAt": started_at,
        "endedAt": utc_now(),
        "exitCode": completed.returncode,
        "outputSha256": sha256_bytes(completed.stdout),
        "outputBytes": len(completed.stdout),
        "status": "PASS" if completed.returncode == 0 else "FAIL",
    }


def relative_to_root(path: Path) -> str:
    resolved = path.resolve(strict=False)
    try:
        return resolved.relative_to(ROOT.resolve()).as_posix()
    except ValueError as error:
        raise ValueError("evidence path escapes blueprint root") from error


def draft_context_matches(
    draft: dict[str, object],
    registration: dict[str, str],
    worktree: Path,
    parent: str,
    head: str,
) -> bool:
    return (
        draft.get("parentHeadSha") == parent
        and draft.get("headSha") == head
        and draft.get("worktreeRecordId") == registration.get("record_id")
        and draft.get("worktreePath") == str(worktree)
        and draft.get("branch") == registration.get("branch")
    )


def assert_finalize_context_unchanged(
    session: str,
    repository: str,
    slice_id: str,
    draft: dict[str, object],
) -> tuple[dict[str, str], Path, str, str, list[dict[str, str]]]:
    _slice, registration, worktree, parent, head, rows = checkpoint_context(
        session, repository, slice_id
    )
    if not draft_context_matches(draft, registration, worktree, parent, head):
        raise ValueError("worktree HEAD, parent chain, or baseline sync changed during finalize")
    return registration, worktree, parent, head, rows


def _finalize_locked(
    session: str,
    repository: str,
    checkpoint_id: str,
    selection_map: Path,
    semaphore_metadata: dict[str, object],
    shard_lock_capability: object,
    shard_lock_environment: dict[str, str],
) -> dict[str, object]:
    assert_current_gate_open()
    assert_canonical_workspace(session, "g3", canonical_only=True)
    directory = checkpoint_directory(session, checkpoint_id)
    if not directory.is_dir() or directory.is_symlink():
        raise ValueError("prepared checkpoint directory is missing or unsafe")
    sealed = directory / "sealed"
    if sealed.is_symlink() or (directory / "finalization.json").exists():
        raise ValueError("checkpoint is already finalized or contains an unsafe sealed path")
    draft_path = directory / "draft-metadata.json"
    operation_template_path = directory / "operation-map-template.csv"
    if (
        not draft_path.is_file()
        or draft_path.is_symlink()
        or not operation_template_path.is_file()
        or operation_template_path.is_symlink()
    ):
        raise ValueError("prepared checkpoint inputs are missing or symlinked")
    if selection_map.is_symlink():
        raise ValueError("selection map symlink is forbidden")
    selection_resolved = selection_map.resolve(strict=True)
    selection_metadata = selection_resolved.lstat()
    blueprint_root = ROOT.resolve()
    if (
        not stat.S_ISREG(selection_metadata.st_mode)
        or stat.S_ISLNK(selection_metadata.st_mode)
        or selection_resolved == blueprint_root
        or blueprint_root in selection_resolved.parents
    ):
        raise ValueError("selection map must be a regular file outside the canonical blueprint")
    draft = json.loads(draft_path.read_text(encoding="utf-8"))
    required_draft_fields = {
        "schema", "checkpointId", "checkpointKind", "ownerSessionId",
        "writerSessionId", "repository", "sliceId", "parentHeadSha",
        "headSha", "worktreeRecordId", "worktreePath", "branch",
        "changedPathsSha256", "operationMapTemplateSha256",
        "operationSelectionMode", "registeredCommandBindings",
        "createdAt", "state",
    }
    if set(draft) != required_draft_fields or draft.get("schema") != "dwp.hris.g3.module-checkpoint-draft.v3":
        raise ValueError("draft metadata schema drift")
    if (
        draft.get("checkpointId") != checkpoint_id
        or draft.get("ownerSessionId") != session
        or draft.get("writerSessionId") != session
        or draft.get("repository") != repository
        or draft.get("checkpointKind") != "MODULE_COMMIT"
        or draft.get("operationSelectionMode")
        != "EXTERNAL_INPUT_THEN_IMMUTABLE_SELECTED_MAP_APPEND"
        or draft.get("state") != "AWAITING_EXTERNAL_OPERATION_REF_SELECTION"
    ):
        raise ValueError("draft identity or lifecycle drift")
    slice_id = str(draft["sliceId"])
    slice_row, registration, worktree, parent, head, prior_rows = checkpoint_context(
        session, repository, slice_id
    )
    if not draft_context_matches(draft, registration, worktree, parent, head):
        raise ValueError("worktree or commit range changed after prepare")
    expected_plan = derive_operation_plan(
        checkpoint_id, session, repository, slice_row, worktree, parent, head
    )
    assert_operation_template_digest(
        expected_plan, draft.get("operationMapTemplateSha256")
    )
    expected_template_bytes = csv_bytes(OPERATION_MAP_HEADER, expected_plan)
    if operation_template_path.read_bytes() != expected_template_bytes:
        raise ValueError("immutable operation map template bytes drift")
    observed_plan = load_csv_exact_bytes(
        read_stable_source(selection_resolved), OPERATION_MAP_HEADER
    )
    assert_plan_immutable(expected_plan, observed_plan)
    if stable_fingerprint(*[row["changed_path"] for row in observed_plan]) != draft.get(
        "changedPathsSha256"
    ):
        raise ValueError("changed-path digest drift")
    profiles, resolved_commands, bindings = registered_bindings(
        session, repository, slice_id
    )
    if bindings != draft.get("registeredCommandBindings"):
        raise ValueError("registered verification commands changed after prepare")

    selected_relative = f"checkpoints/{checkpoint_id}/operation-map-selected.csv"
    selected_bytes = csv_bytes(OPERATION_MAP_HEADER, observed_plan)
    append_or_verify_exact_batch(
        session,
        [(selected_relative, selected_bytes)],
        "g3",
        _shard_lock_capability=shard_lock_capability,
        _lock_environment=shard_lock_environment,
        _parent_pid=os.getpid(),
    )

    pending = Path(tempfile.mkdtemp(prefix="dwp-hris-g3-sealed-"))
    capture_receipt: dict[str, object] = {}
    try:
        test_evidence_pending = pending / "test-evidence.json"
        capture_receipt = capture_registered_commands(
            draft,
            worktree,
            resolved_commands,
            test_evidence_pending,
        )
        if capture_receipt.get("status") != "PASS" or not test_evidence_pending.is_file():
            raise ValueError("registered G3 command capture failed")
        # Command execution can be long.  Re-resolve the complete session
        # chain while the global+owner locks are still held before publishing
        # any sealed result.
        assert_finalize_context_unchanged(
            session, repository, slice_id, draft
        )
        test_evidence = json.loads(test_evidence_pending.read_text(encoding="utf-8"))
        assert_test_evidence_identity(test_evidence, draft, bindings)
        receipt = choose_touch_receipt(repository, test_evidence)
        assert_receipt_bound(receipt, bindings)

        final_root_ref = relative_to_root(sealed)
        touch_rows: list[dict[str, str]] = []
        for index, operation_row in enumerate(observed_plan, 1):
            evidence_name = f"touch-evidence-{index:03d}.json"
            evidence = {
                "schema": "dwp.hris.g3.touch-evidence.v1",
                "sliceId": slice_id,
                "sessionId": session,
                "repository": repository,
                "allocationId": operation_row["allocation_id"],
                "changedPath": operation_row["changed_path"],
                "operationRefs": selected_refs(operation_row),
                "proposalRef": None,
                "proposalSha256": None,
                "verificationCommandSha256": receipt["commandSha256"],
                "outputSha256": receipt["outputSha256"],
                "exitCode": receipt["exitCode"],
                "status": receipt["status"],
            }
            evidence_path = pending / evidence_name
            atomic_write_json(evidence_path, evidence)
            touch_rows.append(
                {
                    "touch_id": operation_row["touch_id"],
                    "slice_id": slice_id,
                    "session_id": session,
                    "repository": repository,
                    "allocation_id": operation_row["allocation_id"],
                    "changed_path": operation_row["changed_path"],
                    "operation_refs": operation_row["selected_operation_refs"],
                    "migration_filename": (
                        Path(operation_row["changed_path"]).name
                        if is_registered_migration_path(operation_row["changed_path"])
                        else ""
                    ),
                    "evidence_ref": f"{final_root_ref}/{evidence_name}",
                    "evidence_sha256": file_sha256(evidence_path),
                }
            )
        manifest_pending = pending / "touch-manifest.csv"
        atomic_write_csv(manifest_pending, G3_TOUCH_HEADER, touch_rows)

        sealed_prefix = f"checkpoints/{checkpoint_id}/sealed"
        staged_names = [
            "test-evidence.json",
            *[
                f"touch-evidence-{index:03d}.json"
                for index in range(1, len(touch_rows) + 1)
            ],
            "touch-manifest.csv",
        ]
        sealed_artifacts = [
            (f"{sealed_prefix}/{name}", (pending / name).read_bytes())
            for name in staged_names
        ]
        append_or_verify_exact_batch(
            session,
            sealed_artifacts,
            "g3",
            _shard_lock_capability=shard_lock_capability,
            _lock_environment=shard_lock_environment,
            _parent_pid=os.getpid(),
        )

        manifest = sealed / "touch-manifest.csv"
        validator_receipt = run_touch_validator(manifest)
        if validator_receipt["status"] != "PASS":
            raise ValueError("slice touch-manifest validator failed")

        test_evidence = sealed / "test-evidence.json"
        checkpoint_row = {
            "checkpoint_seq": "CONTROL_ASSIGNS_AT_APPEND",
            "checkpoint_id": checkpoint_id,
            "checkpoint_kind": "MODULE_COMMIT",
            "writer_session_id": session,
            "owner_session_id": session,
            "repository": repository,
            "slice_id": slice_id,
            "parent_head_sha": parent,
            "head_sha": head,
            "changed_paths_sha256": draft["changedPathsSha256"],
            "touch_manifest_ref": relative_to_root(manifest),
            "touch_manifest_sha256": file_sha256(manifest),
            "source_checkpoint_id": "",
            "source_link_manifest_ref": "",
            "source_link_manifest_sha256": "",
            "dependency_checkpoint_id": "",
            "dependency_receipt_ref": "",
            "dependency_receipt_sha256": "",
            "test_evidence_ref": relative_to_root(test_evidence),
            "test_evidence_sha256": file_sha256(test_evidence),
            "recorded_at": "CONTROL_ASSIGNS_AT_APPEND",
            "status": "VERIFIED",
        }
        local_checks = Checks()
        prior_by_id = {row["checkpoint_id"]: row for row in prior_rows}
        validate_checkpoint_test_evidence(
            local_checks, checkpoint_row, prior_by_id, profiles
        )
        if local_checks.errors:
            raise ValueError(
                "checkpoint test evidence did not bind: " + "; ".join(local_checks.errors)
            )
        row_path = sealed / "checkpoint-row.csv"
        row_value = csv_bytes(G3_CHECKPOINT_HEADER, [checkpoint_row])
        result = {
            "schema": "dwp.hris.g3.module-checkpoint-finalization.v3",
            "checkpointId": checkpoint_id,
            "checkpointKind": "MODULE_COMMIT",
            "ownerSessionId": session,
            "writerSessionId": session,
            "repository": repository,
            "sliceId": slice_id,
            "parentHeadSha": parent,
            "headSha": head,
            "centralRegisterAppended": False,
            "checkpointRowRef": relative_to_root(row_path),
            "checkpointRowSha256": sha256_bytes(row_value),
            "testEvidenceRef": relative_to_root(test_evidence),
            "testEvidenceSha256": file_sha256(test_evidence),
            "touchManifestRef": relative_to_root(manifest),
            "touchManifestSha256": file_sha256(manifest),
            "captureReceipt": capture_receipt,
            "touchValidatorReceipt": validator_receipt,
            "hostSemaphore": semaphore_metadata,
            "finalizedAt": utc_now(),
            "status": "READY_FOR_CONTROL_APPEND_NOT_APPENDED",
        }
        # Last check immediately before the final immutable shard commit.  It
        # catches out-of-contract Git mutation as well as a stale baseline
        # projection instead of sealing evidence for a different HEAD.
        assert_finalize_context_unchanged(
            session, repository, slice_id, draft
        )
        append_new_bytes(
            session,
            [
                (f"{sealed_prefix}/checkpoint-row.csv", row_value),
                (f"checkpoints/{checkpoint_id}/finalization.json", json_bytes(result)),
            ],
            "g3",
            _shard_lock_held_by_parent=True,
            _shard_lock_capability=shard_lock_capability,
            _lock_environment=shard_lock_environment,
            _parent_pid=os.getpid(),
        )
        return result
    finally:
        if pending.exists():
            # Remove only the randomized OS-temporary staging directory. No
            # canonical shard artifact is ever deleted or rewritten here.
            import shutil

            shutil.rmtree(pending)


def finalize(
    session: str,
    repository: str,
    checkpoint_id: str,
    selection_map: Path,
) -> dict[str, object]:
    """Finalize atomically under the global→owner-shard lock order."""
    shard_lock_name = evidence_shard_lock_name(session, "g3")
    with exclusive_host_semaphore(
        HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0
    ) as semaphore_metadata:
        assert_current_gate_open()
        with exclusive_host_semaphore(
            shard_lock_name, timeout_seconds=30.0
        ):
            shard_capability = active_host_semaphore_capability(shard_lock_name)
            if shard_capability is None:
                raise ValueError("owner shard semaphore capability is unavailable")
            shard_environment = {
                "DWP_HRIS_SHARD_LOCK_NAME": shard_lock_name,
                "DWP_HRIS_SHARD_LOCK_PARENT_PID": str(os.getpid()),
            }
            return _finalize_locked(
                session,
                repository,
                checkpoint_id,
                selection_map,
                semaphore_metadata,
                shard_capability,
                shard_environment,
            )


def self_test() -> dict[str, object]:
    import ast
    import inspect
    import stat
    from unittest import mock

    cases: dict[str, bool] = {}
    central_before = file_sha256(CHECKPOINT_REGISTER)

    def rejected(callback: object) -> bool:
        try:
            callback()  # type: ignore[operator]
        except (OSError, ValueError):
            return True
        return False

    cases["closed-current-gate-rejected"] = not gate_decision_allows_module_execution(
        {
            "schema": "dwp.hris.current-g3-gate-decision.v1",
            "currentState": "VALIDATOR_CONTROLLED_BLOCKED",
            "effectiveGate": "CLOSED_FAIL_SAFE",
        }
    )
    cases["authoritative-live-open-gate-accepted"] = gate_decision_allows_module_execution(
        {
            "schema": "dwp.hris.current-g3-gate-decision.v1",
            "currentState": "OPEN_AUTHORITATIVE_LIVE",
            "effectiveGate": "OPEN_G3_CODE",
        }
    )

    cases["checkpoint-id-accepted"] = bool(CHECKPOINT_ID.fullmatch("G3-HRM-001-A"))
    cases["checkpoint-path-escape-rejected"] = not bool(
        CHECKPOINT_ID.fullmatch("G3-../ESCAPE")
    )
    cases["checkpoint-root-is-owned-module-evidence-shard"] = (
        "/session-evidence/hrm/g3/module-evidence/checkpoints/G3-HRM-001-A"
        in checkpoint_directory("HRIS-HRM", "G3-HRM-001-A").as_posix()
    )
    cases["wrong-session-rejected"] = rejected(
        lambda: module_slice("HRIS-PER", "BASE-TFR-HRM-001")
    )
    cases["unknown-worktree-binding-rejected"] = rejected(
        lambda: registered_worktree("HRIS-HRM", "DWP_UNKNOWN")
    )
    cases["baseline-sync-advances-owner-module-chain"] = (
        checkpoint_chain_session(
            {
                "checkpoint_kind": "CONTROL_BASELINE_SYNC",
                "writer_session_id": "CONTROL",
                "owner_session_id": "HRIS-HRM",
            }
        ) == "HRIS-HRM"
        and checkpoint_chain_session(
            {
                "checkpoint_kind": "MODULE_COMMIT",
                "writer_session_id": "HRIS-HRM",
                "owner_session_id": "HRIS-HRM",
            }
        ) == "HRIS-HRM"
    )

    template = {field: field for field in OPERATION_MAP_HEADER}
    template.update(
        {
            "touch_id": "G3-HRM-001-A-T001",
            "allowed_operation_refs": "A|B",
            "selected_operation_refs": "A",
        }
    )
    cases["selected-operation-subset-accepted"] = not rejected(
        lambda: selected_refs(template)
    )
    authority_escape = dict(template)
    authority_escape["selected_operation_refs"] = "C"
    cases["operation-authority-escape-rejected"] = rejected(
        lambda: selected_refs(authority_escape)
    )
    noncanonical = dict(template)
    noncanonical["selected_operation_refs"] = "B|A"
    cases["noncanonical-operation-refs-rejected"] = rejected(
        lambda: selected_refs(noncanonical)
    )
    synthetic_slice = {
        "source_ref": "SOURCE",
        "primary_contract_refs": "PRIMARY",
        "related_contract_refs": "RELATED",
        "consumed_xcon_refs": "",
    }
    related_only = dict(template)
    related_only["allowed_operation_refs"] = "|".join(
        sorted(known_operation_refs(synthetic_slice, "DWP_BACKEND"))
    )
    related_only["selected_operation_refs"] = "RELATED"
    cases["related-only-ref-cannot-authorize"] = rejected(
        lambda: selected_refs(related_only)
    )

    immutable_expected = [dict(template)]
    immutable_observed = [dict(template)]
    immutable_observed[0]["changed_path"] = "escape/path"
    cases["immutable-plan-tamper-rejected"] = rejected(
        lambda: assert_plan_immutable(immutable_expected, immutable_observed)
    )
    cases["operation-row-count-drift-rejected"] = rejected(
        lambda: assert_plan_immutable(immutable_expected, [])
    )
    template_digest = sha256_bytes(csv_bytes(OPERATION_MAP_HEADER, immutable_expected))
    cases["operation-template-digest-accepted"] = not rejected(
        lambda: assert_operation_template_digest(immutable_expected, template_digest)
    )
    cases["operation-template-digest-tamper-rejected"] = rejected(
        lambda: assert_operation_template_digest(immutable_expected, "0" * 64)
    )

    try:
        _profiles, _resolved, catalog_bindings = registered_bindings(
            "HRIS-HRM", "DWP_FRONTEND", "BASE-TFR-HRM-001"
        )
        cases["closed-command-catalog-resolves"] = len(catalog_bindings) == 3
    except ValueError:
        cases["closed-command-catalog-resolves"] = False

    binding = {
        "commandId": "G3CMD-HRM-FE:BASE-TFR-HRM-001:frontend-slice-test",
        "argvSha256": "a" * 64,
        "workingDirectory": ".",
    }
    passing_receipt: dict[str, object] = {
        "commandId": binding["commandId"],
        "commandSha256": binding["argvSha256"],
        "startedAt": "2026-09-11T00:00:00.000Z",
        "endedAt": "2026-09-11T00:00:01.000Z",
        "exitCode": 0,
        "outputSha256": "b" * 64,
        "reproducibleResultSha256": "c" * 64,
        "status": "PASS",
        "typedResult": {
            "schema": "dwp.hris.g3.frontend-slice-test-gate.v1",
            "status": "PASS",
            "sliceId": "BASE-TFR-HRM-001",
            "testPath": "apps/dwp/src/features/hris/people/__tests__/g3-slices/base-tfr-hrm-001.slice.test.tsx",
            "testFileCount": 1,
            "executedTestCount": 1,
            "passedTestCount": 1,
            "failedTestCount": 0,
            "skippedTestCount": 0,
            "unrelatedTestCount": 0,
            "jestExitCode": 0,
            "jestResultSha256": "d" * 64,
            "argvSha256": "e" * 64,
            "errors": [],
        },
    }
    cases["bound-command-receipt-accepted"] = not rejected(
        lambda: assert_receipt_bound(passing_receipt, [binding])
    )
    unknown_receipt = dict(passing_receipt)
    unknown_receipt["commandId"] = "UNKNOWN"
    cases["unknown-command-rejected"] = rejected(
        lambda: assert_receipt_bound(unknown_receipt, [binding])
    )
    argv_mismatch = dict(passing_receipt)
    argv_mismatch["commandSha256"] = "d" * 64
    cases["argv-digest-mismatch-rejected"] = rejected(
        lambda: assert_receipt_bound(argv_mismatch, [binding])
    )
    output_mismatch = dict(passing_receipt)
    output_mismatch["outputSha256"] = "not-a-digest"
    cases["output-digest-mismatch-rejected"] = rejected(
        lambda: assert_receipt_bound(output_mismatch, [binding])
    )
    failed_receipt = dict(passing_receipt)
    failed_receipt.update({"exitCode": 1, "status": "FAIL"})
    cases["command-failure-rejected"] = rejected(
        lambda: assert_receipt_bound(failed_receipt, [binding])
    )

    identity_draft: dict[str, object] = {
        "checkpointId": "G3-HRM-001-A",
        "checkpointKind": "MODULE_COMMIT",
        "sliceId": "BASE-TFR-HRM-001",
        "ownerSessionId": "HRIS-HRM",
        "writerSessionId": "HRIS-HRM",
        "repository": "DWP_FRONTEND",
        "parentHeadSha": "1" * 40,
        "headSha": "2" * 40,
        "sourceCheckpointId": None,
    }
    identity_evidence: dict[str, object] = {
        "schema": "dwp.hris.g3.checkpoint-test-evidence.v1",
        "checkpointId": identity_draft["checkpointId"],
        "checkpointKind": "MODULE_COMMIT",
        "sliceId": identity_draft["sliceId"],
        "ownerSessionId": identity_draft["ownerSessionId"],
        "writerSessionId": identity_draft["writerSessionId"],
        "repository": identity_draft["repository"],
        "parentHeadSha": identity_draft["parentHeadSha"],
        "headSha": identity_draft["headSha"],
        "sourceCheckpointId": None,
        "commands": [passing_receipt],
        "overallStatus": "PASS",
    }
    cases["evidence-identity-accepted"] = not rejected(
        lambda: assert_test_evidence_identity(
            identity_evidence, identity_draft, [binding]
        )
    )
    replayed_evidence = dict(identity_evidence)
    replayed_evidence["headSha"] = "3" * 40
    cases["replayed-evidence-stale-head-rejected"] = rejected(
        lambda: assert_test_evidence_identity(
            replayed_evidence, identity_draft, [binding]
        )
    )
    wrong_owner_evidence = dict(identity_evidence)
    wrong_owner_evidence["ownerSessionId"] = "HRIS-PER"
    cases["wrong-owner-evidence-rejected"] = rejected(
        lambda: assert_test_evidence_identity(
            wrong_owner_evidence, identity_draft, [binding]
        )
    )
    duplicate_command_evidence = dict(identity_evidence)
    duplicate_command_evidence["commands"] = [passing_receipt, passing_receipt]
    cases["duplicate-command-evidence-rejected"] = rejected(
        lambda: assert_test_evidence_identity(
            duplicate_command_evidence, identity_draft, [binding]
        )
    )
    missing_typed_evidence = copy.deepcopy(identity_evidence)
    missing_typed_evidence["commands"][0].pop("typedResult")
    cases["frontend-missing-typed-result-rejected"] = rejected(
        lambda: assert_test_evidence_identity(
            missing_typed_evidence, identity_draft, [binding]
        )
    )
    skipped_typed_evidence = copy.deepcopy(identity_evidence)
    skipped_typed_evidence["commands"][0]["typedResult"]["skippedTestCount"] = 1
    cases["frontend-skipped-typed-result-rejected"] = rejected(
        lambda: assert_test_evidence_identity(
            skipped_typed_evidence, identity_draft, [binding]
        )
    )
    wrong_path_typed_evidence = copy.deepcopy(identity_evidence)
    wrong_path_typed_evidence["commands"][0]["typedResult"]["testPath"] = (
        "apps/dwp/src/features/hris/people/__tests__/g3-slices/"
        "unrelated.slice.test.tsx"
    )
    cases["frontend-wrong-path-typed-result-rejected"] = rejected(
        lambda: assert_test_evidence_identity(
            wrong_path_typed_evidence, identity_draft, [binding]
        )
    )

    allocation_slice = module_slice("HRIS-HRM", "BASE-TFR-HRM-001")
    try:
        allocation = matching_allocation(
            allocation_slice,
            "HRIS-HRM",
            "DWP_BACKEND",
            "dwp-people-server/src/main/java/com/dwp/services/people/hris/people/Probe.java",
        )
        cases["exact-module-allocation-resolves"] = allocation == "G3-HRM-BE-SOURCE"
    except ValueError:
        cases["exact-module-allocation-resolves"] = False
    try:
        migration_allocation = matching_allocation(
            allocation_slice,
            "HRIS-HRM",
            "DWP_BACKEND",
            "dwp-people-server/src/main/resources/db/migration/V51__hrm_worker_core.sql",
        )
        cases["owner-module-migration-allocation-resolves"] = (
            migration_allocation == "G3-HRM-BE-MIGRATION"
        )
    except ValueError:
        cases["owner-module-migration-allocation-resolves"] = False
    cases["wrong-prefix-migration-allocation-rejected"] = rejected(
        lambda: matching_allocation(
            allocation_slice,
            "HRIS-HRM",
            "DWP_BACKEND",
            "dwp-people-server/src/main/resources/db/migration/V51__per_escape.sql",
        )
    )
    valid_migration_path = (
        "dwp-people-server/src/main/resources/db/migration/"
        "V51__hrm_worker_core.sql"
    )
    def migration_git_fixture(_worktree: Path, *arguments: str) -> tuple[int, str]:
        if arguments[:2] == ("cat-file", "-e"):
            return 1, ""
        if arguments[:3] == ("ls-tree", "-r", "--name-only"):
            return 0, valid_migration_path
        return 1, "unsupported"

    with mock.patch(f"{__name__}.git", side_effect=migration_git_fixture):
        cases["owner-module-create-only-migration-accepted"] = not rejected(
            lambda: assert_owner_module_migration(
                slice_row=allocation_slice,
                session="HRIS-HRM",
                repository="DWP_BACKEND",
                changed_path=valid_migration_path,
                status="A",
                allocation_id="G3-HRM-BE-MIGRATION",
                worktree=Path("/fixture"),
                head="2" * 40,
            )
        )
        cases["owner-module-migration-modify-rejected"] = rejected(
            lambda: assert_owner_module_migration(
                slice_row=allocation_slice,
                session="HRIS-HRM",
                repository="DWP_BACKEND",
                changed_path=valid_migration_path,
                status="M",
                allocation_id="G3-HRM-BE-MIGRATION",
                worktree=Path("/fixture"),
                head="2" * 40,
            )
        )

    with tempfile.TemporaryDirectory(prefix="hris-g3-helper-selftest-") as temporary:
        temporary_root = Path(temporary)
        repository = temporary_root / "repository"
        repository.mkdir()

        def fixture_git(*arguments: str) -> str:
            code, output = git(repository, *arguments)
            if code != 0:
                raise ValueError(output)
            return output

        fixture_git("init", "-q", "-b", "main")
        fixture_git("config", "user.name", "DWP Gate Self Test")
        fixture_git("config", "user.email", "gate-self-test@example.invalid")
        (repository / "probe.txt").write_text("base\n", encoding="utf-8")
        fixture_git("add", "probe.txt")
        fixture_git("-c", "commit.gpgsign=false", "commit", "-q", "-m", "base")
        base = fixture_git("rev-parse", "HEAD")
        (repository / "probe.txt").write_text("child\n", encoding="utf-8")
        fixture_git("add", "probe.txt")
        fixture_git("-c", "commit.gpgsign=false", "commit", "-q", "-m", "child")
        head = fixture_git("rev-parse", "HEAD")
        registration = {
            "clean_required": "YES",
            "state": "READY_G3_CODE",
            "branch": "main",
        }
        cases["clean-registered-worktree-accepted"] = not rejected(
            lambda: assert_registered_worktree_identity(registration, repository)
        )
        (repository / "uncommitted.txt").write_text("dirty\n", encoding="utf-8")
        cases["dirty-uncommitted-worktree-rejected"] = rejected(
            lambda: assert_registered_worktree_identity(registration, repository)
        )
        (repository / "uncommitted.txt").unlink()
        wrong_branch = dict(registration)
        wrong_branch["branch"] = "not-main"
        cases["wrong-branch-rejected"] = rejected(
            lambda: assert_registered_worktree_identity(wrong_branch, repository)
        )
        symlink = temporary_root / "repository-link"
        symlink.symlink_to(repository, target_is_directory=True)
        cases["symlinked-worktree-rejected"] = rejected(
            lambda: assert_registered_worktree_identity(registration, symlink)
        )
        cases["forward-commit-range-accepted"] = not rejected(
            lambda: assert_forward_checkpoint_range(repository, base, head, set())
        )
        cases["empty-parent-head-range-rejected"] = rejected(
            lambda: assert_forward_checkpoint_range(repository, head, head, set())
        )
        cases["replayed-head-rejected"] = rejected(
            lambda: assert_forward_checkpoint_range(repository, base, head, {head})
        )
        cases["non-forward-stale-parent-rejected"] = rejected(
            lambda: assert_forward_checkpoint_range(repository, head, base, set())
        )

        atomic_target = temporary_root / "atomic.json"
        atomic_write_bytes(atomic_target, b"sealed")
        cases["atomic-output-success"] = (
            atomic_target.read_bytes() == b"sealed"
            and stat.S_IMODE(atomic_target.stat().st_mode) == 0o600
        )
        blocked_target = temporary_root / "blocked-target"
        blocked_target.mkdir()
        cases["atomic-output-failure-cleans-temp"] = rejected(
            lambda: atomic_write_bytes(blocked_target, b"must-not-replace-directory")
        ) and not list(temporary_root.glob(".blocked-target.*.tmp"))

        context_registration = {
            "record_id": "WT-HRM-BE",
            "branch": "codex/hris-hrm",
        }
        context_worktree = Path("/tmp/hrm")
        context_draft = {
            "parentHeadSha": "a" * 40,
            "headSha": "b" * 40,
            "worktreeRecordId": "WT-HRM-BE",
            "worktreePath": str(context_worktree),
            "branch": "codex/hris-hrm",
        }
        cases["unchanged-finalize-context-accepted"] = draft_context_matches(
            context_draft,
            context_registration,
            context_worktree,
            "a" * 40,
            "b" * 40,
        )
        cases["head-commit-during-capture-rejected"] = not draft_context_matches(
            context_draft,
            context_registration,
            context_worktree,
            "a" * 40,
            "c" * 40,
        )
        cases["baseline-sync-parent-change-during-capture-rejected"] = not draft_context_matches(
            context_draft,
            context_registration,
            context_worktree,
            "c" * 40,
            "b" * 40,
        )

    def shell_false_calls(path: Path) -> bool:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        calls = [
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "run"
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "subprocess"
        ]
        return bool(calls) and all(
            any(
                keyword.arg == "shell"
                and isinstance(keyword.value, ast.Constant)
                and keyword.value.value is False
                for keyword in call.keywords
            )
            for call in calls
        )

    cases["all-helper-subprocesses-shell-false"] = shell_false_calls(
        Path(__file__)
    ) and shell_false_calls(G0 / "capture_g3_checkpoint_evidence.py")
    prepare_wrapper_source = inspect.getsource(prepare)
    prepare_source = inspect.getsource(_prepare_locked)
    finalize_wrapper_source = inspect.getsource(finalize)
    finalize_source = inspect.getsource(_finalize_locked)
    direct_capture_source = inspect.getsource(capture_registered_commands)
    cases["finalize-appends-through-shard-writer-only"] = (
        "append_new_bytes(" in finalize_source
        and "append_or_verify_exact_batch(" in finalize_source
        and "os.replace(pending, sealed)" not in finalize_source
        and "atomic_write_json(directory" not in finalize_source
        and "atomic_write_csv(row_path" not in finalize_source
    )
    cases["finalize-requires-external-selection-map"] = (
        "selection map must be a regular file outside the canonical blueprint"
        in finalize_source
    )
    cases["global-then-owner-shard-lock-and-no-nested-capture-lock"] = (
        finalize_wrapper_source.count("exclusive_host_semaphore(") == 2
        and finalize_wrapper_source.find("exclusive_host_semaphore(")
        < finalize_wrapper_source.rfind("exclusive_host_semaphore(")
        < finalize_wrapper_source.find("_finalize_locked(")
        and "capture_registered_commands(" in finalize_source
        and "assert_finalize_context_unchanged(" in finalize_source
        and "capture_g3_checkpoint_evidence.py" not in finalize_source
        and "exclusive_host_semaphore(" not in direct_capture_source
        and "exclusive_host_semaphore(" not in finalize_source
    )
    cases["prepare-read-through-append-is-global-then-owner-locked"] = (
        prepare_wrapper_source.count("exclusive_host_semaphore(") == 2
        and prepare_wrapper_source.find("exclusive_host_semaphore(")
        < prepare_wrapper_source.rfind("exclusive_host_semaphore(")
        < prepare_wrapper_source.find("_prepare_locked(")
        and "checkpoint_context(" in prepare_source
        and "derive_operation_plan(" in prepare_source
        and "registered_bindings(" in prepare_source
        and "append_new_bytes(" in prepare_source
        and prepare_source.find("checkpoint_context(")
        < prepare_source.find("append_new_bytes(")
        and "exclusive_host_semaphore(" not in prepare_source
        and "_shard_lock_held_by_parent=True" in prepare_source
        and "_shard_lock_capability=shard_lock_capability" in prepare_source
        and "active_host_semaphore_capability(shard_lock_name)"
        in prepare_wrapper_source
    )
    fake_completed = subprocess.CompletedProcess([], 0, stdout=b"PASS")
    injection_draft = dict(identity_draft)
    injected_argv = ["safe-program", "BASE-TFR-HRM-001;touch /tmp/injected"]
    injected_commands = {"INJECTION-PROBE": (injected_argv, ".")}
    with mock.patch.object(subprocess, "run", return_value=fake_completed) as runner, mock.patch.object(
        sys.modules[__name__],
        "git",
        side_effect=[
            (0, injection_draft["headSha"]),
            (0, ""),
            (0, injection_draft["headSha"]),
            (0, ""),
        ],
    ), mock.patch.object(sys.modules[__name__], "atomic_write_json"):
        capture_registered_commands(
            injection_draft,
            Path("/tmp"),
            injected_commands,
            Path("unused.json"),
        )
        positional, keywords = runner.call_args
        argv = positional[0]
        cases["argv-injection-remains-literal-argument"] = (
            isinstance(argv, list)
            and "BASE-TFR-HRM-001;touch /tmp/injected" in argv
            and keywords.get("shell") is False
        )

    cases["central-register-unchanged"] = (
        file_sha256(CHECKPOINT_REGISTER) == central_before
    )
    status_value = "PASS" if all(cases.values()) else "FAIL"
    return {
        "schema": "dwp.hris.g3.module-checkpoint-helper-self-test.v1",
        "status": status_value,
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="action", required=True)
    prepare_parser = subparsers.add_parser("prepare")
    prepare_parser.add_argument("--session-id", required=True, choices=tuple(MODULES))
    prepare_parser.add_argument("--repository", required=True, choices=REPOSITORIES)
    prepare_parser.add_argument("--slice-id", required=True)
    prepare_parser.add_argument("--checkpoint-id", required=True)
    finalize_parser = subparsers.add_parser("finalize")
    finalize_parser.add_argument("--session-id", required=True, choices=tuple(MODULES))
    finalize_parser.add_argument("--repository", required=True, choices=REPOSITORIES)
    finalize_parser.add_argument("--checkpoint-id", required=True)
    finalize_parser.add_argument("--selection-map", required=True, type=Path)
    subparsers.add_parser("self-test")
    arguments = parser.parse_args()
    try:
        if arguments.action == "prepare":
            result = prepare(
                arguments.session_id,
                arguments.repository,
                arguments.slice_id,
                arguments.checkpoint_id,
                arguments.selection_map,
            )
        elif arguments.action == "finalize":
            result = finalize(
                arguments.session_id,
                arguments.repository,
                arguments.checkpoint_id,
            )
        else:
            result = self_test()
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result.get("status") in {
            "PASS", "READY_FOR_CONTROL_APPEND_NOT_APPENDED"
        } else 1
    except (
        KeyError,
        OSError,
        ValueError,
        json.JSONDecodeError,
        subprocess.TimeoutExpired,
        SemaphoreTimeoutError,
    ) as error:
        print(
            json.dumps(
                {
                    "schema": "dwp.hris.g3.module-checkpoint-helper-error.v1",
                    "status": "FAIL",
                    "errorType": type(error).__name__,
                    "message": str(error),
                    "centralRegisterMutated": False,
                },
                ensure_ascii=False,
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
