#!/usr/bin/env python3
"""Prepare immutable Integration-Control G3 checkpoint intake bundles.

This is the executable path for CENTRAL_MATERIALIZATION, INTEGRATION_MERGE,
and CONTROL_BASELINE_SYNC.  It never accepts a shell command: verification is
resolved from the closed G3 catalog.  Editable selections stay outside the
blueprint; the Control intake contains CREATE_NEW_ONLY 0600 files.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import stat
import sys
import tempfile
from pathlib import Path

from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    exclusive_host_semaphore,
)
from prepare_g3_checkpoint import (
    CHECKPOINT_ID,
    OPERATION_MAP_HEADER,
    REPOSITORIES,
    assert_current_gate_open,
    assert_forward_checkpoint_range,
    atomic_write_csv,
    capture_registered_commands,
    checkpoint_rows,
    choose_touch_receipt,
    csv_bytes,
    json_bytes,
    load_csv_exact,
    load_csv_exact_bytes,
    registered_worktree,
    sha256_bytes,
    utc_now,
)
from validate_code_checkpoint import (
    BACKEND_SHA,
    FRONTEND_SHA,
    Checks,
    G0,
    G3_CHECKPOINT_HEADER,
    G3_CROSS_REPO_DEPENDENCY_HEADER,
    G3_SOURCE_LINK_HEADER,
    G3_TOUCH_HEADER,
    MODULES,
    ROOT,
    allocation_path_allowed,
    canonical_argv_sha256,
    changed_entries,
    contract_producer_touch_closure_errors,
    dependency_bundle_sha256,
    expected_command_bindings,
    file_sha256,
    git,
    git_blob_oid,
    is_registered_migration_path,
    read_csv,
    repository_blob_bytes,
    resolved_command_set_sha256,
    split_pipe,
    stable_fingerprint,
    validate_checkpoint_test_evidence,
    validate_command_catalog,
    validate_control_proposal_registry,
)
from write_module_evidence_shard import fsync_directory, read_stable_source
from validate_g3_control_publication_authority import (
    allowed_control_allocation_ids,
    load_authority as load_control_publication_authority,
)


CONTROL_KINDS = (
    "CENTRAL_MATERIALIZATION",
    "INTEGRATION_MERGE",
    "CONTROL_BASELINE_SYNC",
)
CONTROL_OPERATION_HEADER = [
    *OPERATION_MAP_HEADER,
    "proposal_ref",
    "proposal_sha256",
]
CONTROL_OPERATION_IMMUTABLE = CONTROL_OPERATION_HEADER[:-3]
SOURCE_LINK_EDITABLE = {"dba_review_ref", "dba_review_sha256"}
BUNDLE_MANIFEST_FIELDS = {"schema", "checkpointId", "rootRef", "files", "state"}
CONTROL_INTAKE_ROOT = G0 / "control-evidence-intake"


def safe_relative(reference: str) -> bool:
    value = Path(reference)
    return bool(reference) and not value.is_absolute() and ".." not in value.parts


def stable_external_bytes(source: Path) -> bytes:
    """Read an operator-edited selection only from outside the blueprint."""
    try:
        absolute = source.absolute()
        metadata = absolute.lstat()
        resolved = absolute.resolve(strict=True)
    except OSError as error:
        raise ValueError(f"external selection is unavailable: {error}") from error
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        raise ValueError("external selection must be a regular non-symlink file")
    if resolved == ROOT.resolve() or ROOT.resolve() in resolved.parents:
        raise ValueError("external selection must be outside the blueprint")
    return read_stable_source(resolved)


def control_root(owner: str, checkpoint_id: str) -> Path:
    if owner not in MODULES or not CHECKPOINT_ID.fullmatch(checkpoint_id):
        raise ValueError("invalid Control checkpoint owner or ID")
    return (
        G0
        / "control-evidence-intake"
        / MODULES[owner]["slug"]
        / "g3-control-checkpoints"
        / checkpoint_id
    )


def relative_to_root(path: Path) -> str:
    try:
        return path.resolve(strict=False).relative_to(ROOT.resolve()).as_posix()
    except ValueError as error:
        raise ValueError("Control evidence path escapes blueprint") from error


def ensure_safe_directory(anchor: Path, target: Path) -> None:
    """Create a directory chain durably without traversing a symlink."""
    anchor = anchor.absolute()
    target = target.absolute()
    try:
        parts = target.relative_to(anchor).parts
    except ValueError as error:
        raise ValueError("Control intake directory escapes its anchor") from error
    try:
        anchor_metadata = anchor.lstat()
    except OSError as error:
        raise ValueError("Control intake anchor is unavailable") from error
    if stat.S_ISLNK(anchor_metadata.st_mode) or not stat.S_ISDIR(anchor_metadata.st_mode):
        raise ValueError("Control intake anchor is unsafe")
    current = anchor
    for part in parts:
        current = current / part
        try:
            metadata = current.lstat()
        except FileNotFoundError:
            current.mkdir(mode=0o700)
            fsync_directory(current.parent)
            metadata = current.lstat()
        if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
            raise ValueError("Control intake directory chain is unsafe")


def ensure_safe_parent(root: Path, target: Path) -> None:
    absolute_root = root.absolute()
    absolute_target = target.absolute()
    if absolute_target != absolute_root and absolute_root not in absolute_target.parents:
        raise ValueError("Control intake target escapes checkpoint root")
    anchor = CONTROL_INTAKE_ROOT
    if absolute_root != anchor.absolute() and anchor.absolute() not in absolute_root.parents:
        # Unit fixtures live outside the blueprint; their existing parent is
        # the explicit trust anchor for this filesystem-only helper.
        anchor = absolute_root.parent
    ensure_safe_directory(anchor, absolute_target.parent)


def write_new_batch(root: Path, artifacts: list[tuple[str, bytes]]) -> list[Path]:
    if not artifacts or len({name for name, _data in artifacts}) != len(artifacts):
        raise ValueError("Control intake batch is empty or has duplicate paths")
    for relative, data in artifacts:
        if not safe_relative(relative) or not isinstance(data, bytes):
            raise ValueError("Control intake artifact path/bytes invalid")
    created: list[Path] = []
    try:
        for relative, data in artifacts:
            target = root / relative
            ensure_safe_parent(root, target)
            if target.exists() or target.is_symlink():
                try:
                    metadata = target.lstat()
                except OSError as error:
                    raise ValueError("Control intake resume target is unstable") from error
                if (
                    stat.S_ISLNK(metadata.st_mode)
                    or not stat.S_ISREG(metadata.st_mode)
                    or stat.S_IMODE(metadata.st_mode) != 0o600
                    or target.read_bytes() != data
                ):
                    raise FileExistsError(
                        f"CREATE_NEW_ONLY target differs from retry bytes: {relative}"
                    )
                continue
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_CLOEXEC", 0)
            if hasattr(os, "O_NOFOLLOW"):
                flags |= os.O_NOFOLLOW
            descriptor = os.open(target, flags, 0o600)
            created.append(target)
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            fsync_directory(target.parent)
        fsync_directory(root)
        return [root / relative for relative, _data in artifacts]
    except Exception:
        for target in reversed(created):
            if target.is_file() and not target.is_symlink():
                target.unlink()
                fsync_directory(target.parent)
        raise


def validate_exact_partial_batch(root: Path, artifacts: list[tuple[str, bytes]]) -> None:
    """Allow only an exact subset left by a killed CREATE_NEW batch."""
    if not root.exists() and not root.is_symlink():
        return
    metadata = root.lstat()
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        raise ValueError("Control checkpoint intake root is unsafe")
    expected = dict(artifacts)
    for path in root.rglob("*"):
        metadata = path.lstat()
        if stat.S_ISLNK(metadata.st_mode):
            raise ValueError("Control checkpoint partial batch contains a symlink")
        if stat.S_ISDIR(metadata.st_mode):
            continue
        if not stat.S_ISREG(metadata.st_mode):
            raise ValueError("Control checkpoint partial batch contains a special file")
        relative = path.relative_to(root).as_posix()
        if (
            relative not in expected
            or stat.S_IMODE(metadata.st_mode) != 0o600
            or path.read_bytes() != expected[relative]
        ):
            raise ValueError("Control checkpoint intake ID contains unrelated or changed bytes")


def durable_remove_tree(root: Path) -> None:
    """Durably abandon an uncommitted intake; safe and idempotent after a kill."""
    if not root.exists() and not root.is_symlink():
        return
    metadata = root.lstat()
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        raise ValueError("Control checkpoint abandon root is unsafe")
    paths = sorted(root.rglob("*"), key=lambda path: len(path.parts), reverse=True)
    for path in paths:
        metadata = path.lstat()
        if stat.S_ISLNK(metadata.st_mode):
            raise ValueError("Control checkpoint abandon refuses a symlink")
        if stat.S_ISREG(metadata.st_mode):
            path.unlink()
            fsync_directory(path.parent)
        elif stat.S_ISDIR(metadata.st_mode):
            path.rmdir()
            fsync_directory(path.parent)
        else:
            raise ValueError("Control checkpoint abandon refuses a special file")
    root.rmdir()
    fsync_directory(root.parent)


def abandon(owner: str, checkpoint_id: str) -> dict[str, object]:
    """Explicitly discard only an incomplete, never-registered Control intake."""
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        assert_current_gate_open()
        root = control_root(owner, checkpoint_id)
        rows = checkpoint_rows()
        if any(row.get("checkpoint_id") == checkpoint_id for row in rows):
            raise ValueError("registered Control checkpoint cannot be abandoned")
        dependencies = read_csv(G0 / "g3-cross-repo-dependency-register.csv")
        if any(row.get("consumer_checkpoint_id") == checkpoint_id for row in dependencies):
            raise ValueError("Control checkpoint with a registered dependency cannot be abandoned")
        state = json.loads(
            (G0 / "g3-control-checkpoint-transaction-state.json").read_text(
                encoding="utf-8"
            )
        )
        if state.get("checkpointId") == checkpoint_id:
            raise ValueError("Control checkpoint referenced by transaction state cannot be abandoned")
        if root.is_dir() and (root / "finalization.json").exists():
            raise ValueError("finalized Control checkpoint intake cannot be abandoned")
        durable_remove_tree(root)
        return {
            "schema": "dwp.hris.g3.control-checkpoint-abandon-result.v1",
            "status": "PASS",
            "checkpointId": checkpoint_id,
            "ownerSessionId": owner,
            "recoveryAction": "DURABLE_UNCOMMITTED_INTAKE_ABANDON",
        }


def slice_row(owner: str, slice_id: str) -> dict[str, str]:
    rows = [
        row
        for row in read_csv(ROOT / "coding-readiness/g3-slice-code-go-register.csv")
        if row.get("slice_id") == slice_id
    ]
    if (
        len(rows) != 1
        or rows[0].get("session_id") != owner
        or rows[0].get("gate_status") != "OPEN_G3_CODE"
    ):
        raise ValueError("Control checkpoint slice is absent, retired, or cross-owner")
    return rows[0]


def chain_session(kind: str, owner: str) -> str:
    return owner if kind == "CONTROL_BASELINE_SYNC" else "CONTROL"


def expected_parent(rows: list[dict[str, str]], kind: str, owner: str, repository: str) -> str:
    session = chain_session(kind, owner)
    result = BACKEND_SHA if repository == "DWP_BACKEND" else FRONTEND_SHA
    for row in rows:
        row_session = (
            row.get("owner_session_id")
            if row.get("checkpoint_kind") == "CONTROL_BASELINE_SYNC"
            else row.get("writer_session_id")
        )
        if row_session == session and row.get("repository") == repository:
            result = row.get("head_sha", "")
    return result


def control_context(
    kind: str,
    owner: str,
    repository: str,
    slice_id: str,
    source_checkpoint_id: str | None,
) -> tuple[dict[str, str], dict[str, str], Path, str, str, list[dict[str, str]]]:
    if kind not in CONTROL_KINDS or repository not in REPOSITORIES:
        raise ValueError("Control checkpoint kind/repository invalid")
    selected_slice = slice_row(owner, slice_id)
    rows = checkpoint_rows()
    worktree_session = owner if kind == "CONTROL_BASELINE_SYNC" else "CONTROL"
    registration, worktree = registered_worktree(worktree_session, repository)
    parent = expected_parent(rows, kind, owner, repository)
    code, head = git(worktree, "rev-parse", "HEAD")
    if code != 0:
        raise ValueError("Control checkpoint HEAD cannot be resolved")
    prior_heads = {
        row.get("head_sha", "")
        for row in rows
        if row.get("repository") == repository
        and (
            row.get("owner_session_id")
            if row.get("checkpoint_kind") == "CONTROL_BASELINE_SYNC"
            else row.get("writer_session_id")
        )
        == worktree_session
    }
    assert_forward_checkpoint_range(worktree, parent, head, prior_heads)
    if kind == "INTEGRATION_MERGE":
        source = next(
            (row for row in rows if row.get("checkpoint_id") == source_checkpoint_id),
            {},
        )
        if not (
            source.get("checkpoint_kind") == "MODULE_COMMIT"
            and source.get("writer_session_id") == owner
            and source.get("owner_session_id") == owner
            and source.get("repository") == repository
            and source.get("slice_id") == slice_id
        ):
            raise ValueError("integration merge source MODULE_COMMIT is invalid")
    elif source_checkpoint_id:
        raise ValueError("only INTEGRATION_MERGE accepts a source checkpoint")
    return selected_slice, registration, worktree, parent, head, rows


def operation_authority(selected_slice: dict[str, str], repository: str) -> set[str]:
    result = split_pipe(selected_slice.get("primary_contract_refs", "")) | {
        selected_slice.get("source_ref", "")
    }
    if repository == "DWP_BACKEND":
        result |= split_pipe(selected_slice.get("consumed_xcon_refs", ""))
        result |= split_pipe(selected_slice.get("consumed_service_pep_refs", ""))
    else:
        result |= split_pipe(selected_slice.get("primary_ia_node_ids", ""))
    return {value for value in result if value}


def source_touch_rows(source: dict[str, str]) -> list[dict[str, str]]:
    path = ROOT / source.get("touch_manifest_ref", "")
    return load_csv_exact(path, G3_TOUCH_HEADER)


def matching_control_allocation(
    selected_slice: dict[str, str],
    kind: str,
    repository: str,
    changed_path: str,
    source_allocation: str = "",
) -> str:
    allocations = {
        row.get("allocation_id", ""): row
        for row in read_csv(ROOT / "coding-readiness/g3-file-allocation-register.csv")
    }
    allowed_ids = split_pipe(selected_slice.get("file_allocation_ids", ""))
    if kind == "INTEGRATION_MERGE":
        candidates = {source_allocation} if source_allocation else set()
    else:
        candidates = allowed_control_allocation_ids(
            load_control_publication_authority(),
            kind,
            selected_slice.get("session_id", ""),
        )
    matches = [
        allocation_id
        for allocation_id in sorted(candidates)
        if (kind != "INTEGRATION_MERGE" or allocation_id in allowed_ids)
        and allocations.get(allocation_id, {}).get("repository") == repository
        and (
            kind != "INTEGRATION_MERGE"
            or allocations.get(allocation_id, {}).get("session_id")
            == selected_slice.get("session_id")
        )
        and (
            kind == "INTEGRATION_MERGE"
            or allocations.get(allocation_id, {}).get("session_id") == "CONTROL"
        )
        and any(
            allocation_path_allowed(changed_path, pattern)
            for pattern in split_pipe(allocations.get(allocation_id, {}).get("path_globs", ""))
        )
    ]
    if len(matches) != 1:
        raise ValueError(f"Control diff path has no unique exact allocation: {changed_path}")
    return matches[0]


def derive_plan(
    checkpoint_id: str,
    kind: str,
    owner: str,
    repository: str,
    selected_slice: dict[str, str],
    worktree: Path,
    parent: str,
    head: str,
    rows: list[dict[str, str]],
    source_checkpoint_id: str | None,
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    entries = changed_entries(worktree, parent, head)
    if not entries:
        raise ValueError("Control checkpoint commit range is empty")
    source = next(
        (row for row in rows if row.get("checkpoint_id") == source_checkpoint_id),
        {},
    )
    source_touches = {
        row.get("changed_path", ""): row for row in source_touch_rows(source)
    } if source else {}
    if source and set(source_touches) != {path for _status, path in entries}:
        raise ValueError("integration target diff does not equal source touch path set")
    operations = {"A": "CREATE", "M": "MODIFY", "D": "DELETE", "T": "MODIFY"}
    allowed_refs = "|".join(sorted(operation_authority(selected_slice, repository)))
    plan: list[dict[str, str]] = []
    for index, (status_value, changed_path) in enumerate(entries, 1):
        source_touch = source_touches.get(changed_path, {})
        allocation_id = matching_control_allocation(
            selected_slice,
            kind,
            repository,
            changed_path,
            source_touch.get("allocation_id", ""),
        )
        plan.append(
            {
                "touch_id": f"{checkpoint_id}-T{index:03d}",
                "slice_id": selected_slice["slice_id"],
                "session_id": owner,
                "repository": repository,
                "allocation_id": allocation_id,
                "changed_path": changed_path,
                "git_status": status_value,
                "git_operation": operations[status_value],
                "allowed_operation_refs": allowed_refs,
                "selected_operation_refs": "",
                "proposal_ref": "",
                "proposal_sha256": "",
            }
        )
    links: list[dict[str, str]] = []
    if source:
        source_registration, source_worktree = registered_worktree(owner, repository)
        del source_registration
        source_status = {
            path: status
            for status, path in changed_entries(
                source_worktree, source["parent_head_sha"], source["head_sha"]
            )
        }
        target_by_path = {row["changed_path"]: row for row in plan}
        for index, source_row in enumerate(source_touch_rows(source), 1):
            path = source_row["changed_path"]
            target = target_by_path[path]
            operation = operations[source_status[path]]
            target_status = next(status for status, value in entries if value == path)
            if operations[target_status] != operation:
                raise ValueError("integration source/target operation differs")
            source_revision = source["parent_head_sha"] if operation == "DELETE" else source["head_sha"]
            target_revision = parent if operation == "DELETE" else head
            source_blob = git_blob_oid(source_worktree, source_revision, path)
            target_blob = git_blob_oid(worktree, target_revision, path)
            if not source_blob or source_blob != target_blob:
                raise ValueError("integration source/target regular blob differs")
            links.append(
                {
                    "link_id": f"{checkpoint_id}-L{index:03d}",
                    "source_checkpoint_id": source["checkpoint_id"],
                    "source_touch_id": source_row["touch_id"],
                    "source_path": path,
                    "source_operation": operation,
                    "source_allocation_id": source_row["allocation_id"],
                    "source_blob_oid": source_blob,
                    "publication_kind": "INTEGRATION_MERGE",
                    "target_touch_id": target["touch_id"],
                    "target_path": path,
                    "target_operation": operation,
                    "target_allocation_id": target["allocation_id"],
                    "target_blob_oid": target_blob,
                    "equivalence_rule": (
                        "IDENTICAL_PREIMAGE_DELETE"
                        if operation == "DELETE"
                        else "IDENTICAL_REGULAR_BLOB"
                    ),
                    "dba_review_ref": "",
                    "dba_review_sha256": "",
                }
            )
    return plan, links


def prepare(
    kind: str,
    owner: str,
    repository: str,
    slice_id: str,
    checkpoint_id: str,
    source_checkpoint_id: str | None,
) -> dict[str, object]:
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        assert_current_gate_open()
        root = control_root(owner, checkpoint_id)
        if root.is_symlink() or (root.exists() and not root.is_dir()):
            raise ValueError("Control checkpoint intake ID is unsafe")
        if root.is_dir() and (root / "finalization.json").exists():
            raise ValueError("Control checkpoint intake ID is already finalized")
        selected_slice, registration, worktree, parent, head, rows = control_context(
            kind, owner, repository, slice_id, source_checkpoint_id
        )
        plan, links = derive_plan(
            checkpoint_id, kind, owner, repository, selected_slice, worktree,
            parent, head, rows, source_checkpoint_id,
        )
        plan_bytes = csv_bytes(CONTROL_OPERATION_HEADER, plan)
        link_bytes = csv_bytes(G3_SOURCE_LINK_HEADER, links) if links else b""
        created_at = utc_now()
        existing_draft = root / "draft-metadata.json"
        if existing_draft.is_file() and not existing_draft.is_symlink():
            try:
                existing_payload = json.loads(existing_draft.read_text(encoding="utf-8"))
            except json.JSONDecodeError as error:
                raise ValueError("partial Control draft metadata is invalid") from error
            if isinstance(existing_payload.get("createdAt"), str):
                created_at = str(existing_payload["createdAt"])
        draft = {
            "schema": "dwp.hris.g3.control-checkpoint-draft.v1",
            "checkpointId": checkpoint_id,
            "checkpointKind": kind,
            "ownerSessionId": owner,
            "writerSessionId": "CONTROL",
            "repository": repository,
            "sliceId": slice_id,
            "parentHeadSha": parent,
            "headSha": head,
            "sourceCheckpointId": source_checkpoint_id,
            "worktreeRecordId": registration["record_id"],
            "worktreePath": str(worktree),
            "operationTemplateSha256": sha256_bytes(plan_bytes),
            "sourceLinkTemplateSha256": sha256_bytes(link_bytes) if links else None,
            "createdAt": created_at,
            "state": "AWAITING_EXTERNAL_SELECTIONS",
        }
        artifacts = [
            ("operation-map-template.csv", plan_bytes),
            ("draft-metadata.json", json_bytes(draft)),
        ]
        if links:
            artifacts.insert(1, ("source-link-template.csv", link_bytes))
        validate_exact_partial_batch(root, artifacts)
        write_new_batch(root, artifacts)
        return {
            "schema": "dwp.hris.g3.control-checkpoint-prepare-result.v1",
            "status": "PASS",
            "checkpointRoot": str(root),
            "operationMapTemplate": str(root / "operation-map-template.csv"),
            "sourceLinkTemplate": str(root / "source-link-template.csv") if links else None,
            "nextAction": "COPY_TEMPLATES_OUTSIDE_BLUEPRINT_FILL_SELECTIONS_THEN_FINALIZE",
        }


def validate_selected_plan(
    template: list[dict[str, str]], selected: list[dict[str, str]], kind: str,
    proposals: dict[str, dict[str, object]],
) -> None:
    if len(template) != len(selected):
        raise ValueError("Control operation selection row count drift")
    allocations = {
        row.get("allocation_id", ""): row
        for row in read_csv(ROOT / "coding-readiness/g3-file-allocation-register.csv")
    }
    for number, (expected, observed) in enumerate(zip(template, selected), 1):
        if any(observed.get(field) != expected.get(field) for field in CONTROL_OPERATION_IMMUTABLE):
            raise ValueError(f"Control operation immutable field drift at row {number}")
        selected_refs = split_pipe(observed.get("selected_operation_refs", ""))
        allowed_refs = split_pipe(observed.get("allowed_operation_refs", ""))
        if (
            not selected_refs
            or selected_refs - allowed_refs
            or observed.get("selected_operation_refs") != "|".join(sorted(selected_refs))
        ):
            raise ValueError(f"Control operation refs invalid at row {number}")
        allocation = allocations.get(observed.get("allocation_id", ""), {})
        requires_proposal = allocation.get("session_id") == "CONTROL"
        proposal_ref = observed.get("proposal_ref", "")
        proposal_sha = observed.get("proposal_sha256", "")
        seal = proposals.get(proposal_ref, {}) if proposal_ref else {}
        proposal_row = seal.get("register", {}) if isinstance(seal, dict) else {}
        proposal = seal.get("artifact", {}) if isinstance(seal, dict) else {}
        if requires_proposal:
            if not (
                isinstance(proposal_row, dict)
                and isinstance(proposal, dict)
                and proposal_row.get("proposal_sha256") == proposal_sha
                and observed.get("allocation_id") in proposal.get("allocationIds", [])
                and observed.get("changed_path") in proposal.get("publishedPaths", [])
                and proposal.get("operationRefs") == sorted(selected_refs)
            ):
                raise ValueError(f"Control-owned touch lacks owner proposal at row {number}")
        elif proposal_ref or proposal_sha:
            raise ValueError(f"imported owner touch cannot claim proposal at row {number}")
        if kind == "INTEGRATION_MERGE" and requires_proposal:
            raise ValueError("integration merge cannot convert owner touch into Control materialization")


def validate_selected_links(
    template: list[dict[str, str]], selected: list[dict[str, str]]
) -> None:
    if len(template) != len(selected):
        raise ValueError("source-link selection row count drift")
    for number, (expected, observed) in enumerate(zip(template, selected), 1):
        immutable = set(G3_SOURCE_LINK_HEADER) - SOURCE_LINK_EDITABLE
        if any(observed.get(field) != expected.get(field) for field in immutable):
            raise ValueError(f"source-link immutable field drift at row {number}")
        migration = is_registered_migration_path(observed.get("target_path", ""))
        ref = observed.get("dba_review_ref", "")
        digest = observed.get("dba_review_sha256", "")
        path = ROOT / ref if safe_relative(ref) else Path("/__missing__")
        if migration:
            if not path.is_file() or file_sha256(path) != digest:
                raise ValueError(f"migration source-link lacks exact DBA review at row {number}")
        elif ref or digest:
            raise ValueError(f"non-migration source-link declares DBA review at row {number}")


def dependency_receipt(
    checkpoint_id: str,
    producer_checkpoint_id: str,
    artifact_paths: list[str],
    operation_refs: list[str],
    receipt_ref: str,
    rows: list[dict[str, str]],
    expected_owner: str,
    expected_slice: str,
) -> tuple[dict[str, object], dict[str, str]]:
    producer = next(
        (row for row in rows if row.get("checkpoint_id") == producer_checkpoint_id),
        {},
    )
    _registration, backend = registered_worktree("CONTROL", "DWP_BACKEND")
    closure_errors = contract_producer_touch_closure_errors(
        producer,
        backend,
        artifact_paths,
        expected_owner=expected_owner,
        expected_slice=expected_slice,
    )
    if closure_errors:
        raise ValueError(
            "dependency producer is not the exact contract publication: "
            + "; ".join(closure_errors)
        )
    tree_code, tree = git(backend, "rev-parse", f"{producer['head_sha']}^{{tree}}")
    if tree_code != 0:
        raise ValueError("dependency producer tree cannot be resolved")
    artifacts: list[dict[str, object]] = []
    for path in sorted(set(artifact_paths)):
        if not safe_relative(path):
            raise ValueError("dependency artifact path unsafe")
        oid = git_blob_oid(backend, producer["head_sha"], path)
        blob = repository_blob_bytes(backend, oid) if oid else None
        if blob is None:
            raise ValueError(f"dependency artifact is not a regular producer blob: {path}")
        artifacts.append(
            {
                "path": path,
                "gitBlobOid": oid,
                "byteSha256": hashlib.sha256(blob).hexdigest(),
                "size": len(blob),
            }
        )
    families = (
        any(item["path"].startswith("contracts/openapi/") for item in artifacts),
        any(item["path"].startswith("contracts/asyncapi/") for item in artifacts),
        any(item["path"].startswith("contracts/product-authorization/") for item in artifacts),
    )
    if not artifacts or not all(families):
        raise ValueError("dependency receipt must include OpenAPI, AsyncAPI, and authorization artifacts")
    recorded_at = utc_now()
    dependency_id = f"DEP-{checkpoint_id}"
    bundle = dependency_bundle_sha256(artifacts)
    receipt = {
        "schema": "dwp.hris.g3.backend-contract-dependency-receipt.v1",
        "dependencyId": dependency_id,
        "consumerCheckpointId": checkpoint_id,
        "producerCheckpointId": producer_checkpoint_id,
        "producerRepository": "DWP_BACKEND",
        "producerHeadSha": producer["head_sha"],
        "producerTreeSha": tree,
        "consumerRepository": "DWP_FRONTEND",
        "artifacts": artifacts,
        "bundleSha256": bundle,
        "selectedOperationRefs": sorted(set(operation_refs)),
        "recordedAt": recorded_at,
        "status": "VERIFIED_BACKEND_CONTRACT_DEPENDENCY",
    }
    row = {field: "" for field in G3_CROSS_REPO_DEPENDENCY_HEADER}
    row.update(
        {
            "dependency_seq": "CONTROL_ASSIGNS_AT_APPEND",
            "dependency_id": dependency_id,
            "consumer_checkpoint_id": checkpoint_id,
            "producer_checkpoint_id": producer_checkpoint_id,
            "producer_repository": "DWP_BACKEND",
            "producer_head_sha": producer["head_sha"],
            "producer_tree_sha": tree,
            "artifact_manifest_ref": receipt_ref,
            "artifact_manifest_sha256": sha256_bytes(json_bytes(receipt)),
            "bundle_sha256": bundle,
            "consumer_repository": "DWP_FRONTEND",
            "recorded_at": recorded_at,
            "status": "VERIFIED_BACKEND_CONTRACT_DEPENDENCY",
        }
    )
    return receipt, row


def bundle_manifest(root: Path, checkpoint_id: str) -> dict[str, object]:
    excluded = {root / "bundle-manifest.json", root / "finalization.json"}
    files = []
    for path in sorted(
        (value for value in root.rglob("*") if value.is_file() and value not in excluded),
        key=lambda value: relative_to_root(value),
    ):
        metadata = path.lstat()
        if path.is_symlink() or stat.S_IMODE(metadata.st_mode) != 0o600:
            raise ValueError("Control bundle contains unsafe mode or symlink")
        files.append(
            {
                "path": relative_to_root(path),
                "sha256": file_sha256(path),
                "size": metadata.st_size,
                "mode": "0600",
            }
        )
    return {
        "schema": "dwp.hris.g3.control-checkpoint-bundle-manifest.v1",
        "checkpointId": checkpoint_id,
        "rootRef": relative_to_root(root),
        "files": files,
        "state": "IMMUTABLE_CONTROL_INTAKE_BUNDLE",
    }


def finalize(
    owner: str,
    checkpoint_id: str,
    selection_map: Path,
    source_link_map: Path | None,
    producer_checkpoint_id: str | None,
    artifact_paths: list[str],
) -> dict[str, object]:
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        assert_current_gate_open()
        root = control_root(owner, checkpoint_id)
        if not root.is_dir() or (root / "finalization.json").exists():
            raise ValueError("Control draft missing or already finalized")
        draft = json.loads((root / "draft-metadata.json").read_text(encoding="utf-8"))
        kind = str(draft.get("checkpointKind", ""))
        repository = str(draft.get("repository", ""))
        slice_id = str(draft.get("sliceId", ""))
        source_id = draft.get("sourceCheckpointId")
        selected_slice, registration, worktree, parent, head, rows = control_context(
            kind, owner, repository, slice_id,
            str(source_id) if isinstance(source_id, str) else None,
        )
        if (
            draft.get("checkpointId") != checkpoint_id
            or draft.get("ownerSessionId") != owner
            or draft.get("writerSessionId") != "CONTROL"
            or draft.get("parentHeadSha") != parent
            or draft.get("headSha") != head
            or draft.get("worktreeRecordId") != registration.get("record_id")
            or draft.get("worktreePath") != str(worktree)
            or draft.get("state") != "AWAITING_EXTERNAL_SELECTIONS"
        ):
            raise ValueError("Control draft identity/worktree drift")
        template = load_csv_exact(root / "operation-map-template.csv", CONTROL_OPERATION_HEADER)
        if sha256_bytes(csv_bytes(CONTROL_OPERATION_HEADER, template)) != draft.get("operationTemplateSha256"):
            raise ValueError("Control operation template digest drift")
        selected = load_csv_exact_bytes(
            stable_external_bytes(selection_map), CONTROL_OPERATION_HEADER
        )
        proposal_checks = Checks()
        proposals = validate_control_proposal_registry(proposal_checks, rows)
        if proposal_checks.errors:
            raise ValueError("Control proposal registry invalid: " + "; ".join(proposal_checks.errors))
        validate_selected_plan(template, selected, kind, proposals)
        selected_bytes = csv_bytes(CONTROL_OPERATION_HEADER, selected)

        selected_links: list[dict[str, str]] = []
        if kind == "INTEGRATION_MERGE":
            if source_link_map is None:
                raise ValueError("integration merge requires external source-link map")
            link_template = load_csv_exact(root / "source-link-template.csv", G3_SOURCE_LINK_HEADER)
            selected_links = load_csv_exact_bytes(
                stable_external_bytes(source_link_map), G3_SOURCE_LINK_HEADER
            )
            validate_selected_links(link_template, selected_links)
        elif source_link_map is not None:
            raise ValueError("non-integration checkpoint cannot accept source-link map")

        write_new_batch(
            root,
            [("operation-map-selected.csv", selected_bytes)]
            + (
                [("source-link-selected.csv", csv_bytes(G3_SOURCE_LINK_HEADER, selected_links))]
                if selected_links else []
            ),
        )

        touched_ids = {row["allocation_id"] for row in selected}
        operation_refs = sorted(
            set().union(*(split_pipe(row["selected_operation_refs"]) for row in selected))
        )
        dependency_required = repository == "DWP_FRONTEND" and "G3-CTL-FE-CONTRACTS" in touched_ids
        receipt_ref = relative_to_root(root / "sealed/dependency-receipt.json")
        dependency: dict[str, object] | None = None
        dependency_row: dict[str, str] | None = None
        dependency_values: dict[str, str] = {}
        if dependency_required:
            if not producer_checkpoint_id or not artifact_paths:
                raise ValueError("frontend contract checkpoint requires producer and artifact paths")
            dependency, dependency_row = dependency_receipt(
                checkpoint_id, producer_checkpoint_id, artifact_paths,
                operation_refs, receipt_ref, rows, owner, slice_id,
            )
            dependency_values = {
                "dependency_head_sha": str(dependency["producerHeadSha"]),
                "dependency_tree_sha": str(dependency["producerTreeSha"]),
                "dependency_manifest_ref": receipt_ref,
                "dependency_bundle_sha256": str(dependency["bundleSha256"]),
                "dependency_checkpoint_id": str(dependency["producerCheckpointId"]),
            }
        elif producer_checkpoint_id or artifact_paths:
            raise ValueError("unexpected dependency inputs for this Control checkpoint")

        catalog_checks = Checks()
        profiles = validate_command_catalog(catalog_checks)
        if catalog_checks.errors:
            raise ValueError("G3 command catalog invalid: " + "; ".join(catalog_checks.errors))
        checkpoint_stub = {
            "checkpoint_id": checkpoint_id,
            "checkpoint_kind": kind,
            "writer_session_id": "CONTROL",
            "owner_session_id": owner,
            "repository": repository,
            "slice_id": slice_id,
            "source_checkpoint_id": str(source_id or ""),
        }
        resolved = expected_command_bindings(
            checkpoint_stub, profiles, touched_ids, dependency_values
        )
        if not resolved:
            raise ValueError("Control checkpoint resolved no closed-catalog commands")
        bindings = [
            {
                "commandId": command_id,
                "argvSha256": canonical_argv_sha256(argv),
                "workingDirectory": cwd,
            }
            for command_id, (argv, cwd) in sorted(resolved.items())
        ]
        if dependency_row is not None:
            dependency_row["resolved_command_set_sha256"] = resolved_command_set_sha256(resolved)

        pending = Path(tempfile.mkdtemp(prefix="dwp-hris-g3-control-"))
        try:
            draft_for_capture = {
                "checkpointId": checkpoint_id,
                "checkpointKind": kind,
                "sliceId": slice_id,
                "ownerSessionId": owner,
                "writerSessionId": "CONTROL",
                "repository": repository,
                "parentHeadSha": parent,
                "headSha": head,
                "sourceCheckpointId": source_id,
            }
            test_pending = pending / "test-evidence.json"
            capture = capture_registered_commands(
                draft_for_capture, worktree, resolved, test_pending
            )
            if capture.get("status") != "PASS":
                raise ValueError("Control closed-catalog command capture failed")
            test_payload = json.loads(test_pending.read_text(encoding="utf-8"))
            receipt = choose_touch_receipt(repository, test_payload)
            touch_rows: list[dict[str, str]] = []
            for index, operation in enumerate(selected, 1):
                evidence = {
                    "schema": "dwp.hris.g3.touch-evidence.v1",
                    "sliceId": slice_id,
                    "sessionId": owner,
                    "repository": repository,
                    "allocationId": operation["allocation_id"],
                    "changedPath": operation["changed_path"],
                    "operationRefs": sorted(split_pipe(operation["selected_operation_refs"])),
                    "proposalRef": operation["proposal_ref"] or None,
                    "proposalSha256": operation["proposal_sha256"] or None,
                    "verificationCommandSha256": receipt["commandSha256"],
                    "outputSha256": receipt["outputSha256"],
                    "exitCode": receipt["exitCode"],
                    "status": receipt["status"],
                }
                name = f"touch-evidence-{index:03d}.json"
                (pending / name).write_bytes(json_bytes(evidence))
                touch_rows.append(
                    {
                        "touch_id": operation["touch_id"],
                        "slice_id": slice_id,
                        "session_id": owner,
                        "repository": repository,
                        "allocation_id": operation["allocation_id"],
                        "changed_path": operation["changed_path"],
                        "operation_refs": operation["selected_operation_refs"],
                        "migration_filename": (
                            Path(operation["changed_path"]).name
                            if is_registered_migration_path(operation["changed_path"])
                            else ""
                        ),
                        "evidence_ref": relative_to_root(root / "sealed" / name),
                        "evidence_sha256": file_sha256(pending / name),
                    }
                )
            atomic_write_csv(pending / "touch-manifest.csv", G3_TOUCH_HEADER, touch_rows)
            if selected_links:
                atomic_write_csv(
                    pending / "source-link-manifest.csv",
                    G3_SOURCE_LINK_HEADER,
                    selected_links,
                )
            if dependency is not None and dependency_row is not None:
                (pending / "dependency-receipt.json").write_bytes(json_bytes(dependency))
                atomic_write_csv(
                    pending / "dependency-row.csv",
                    G3_CROSS_REPO_DEPENDENCY_HEADER,
                    [dependency_row],
                )

            manifest_path = root / "sealed/touch-manifest.csv"
            test_path = root / "sealed/test-evidence.json"
            checkpoint_row = {field: "" for field in G3_CHECKPOINT_HEADER}
            checkpoint_row.update(
                {
                    "checkpoint_seq": "CONTROL_ASSIGNS_AT_APPEND",
                    "checkpoint_id": checkpoint_id,
                    "checkpoint_kind": kind,
                    "writer_session_id": "CONTROL",
                    "owner_session_id": owner,
                    "repository": repository,
                    "slice_id": slice_id,
                    "parent_head_sha": parent,
                    "head_sha": head,
                    "changed_paths_sha256": stable_fingerprint(
                        *[row["changed_path"] for row in selected]
                    ),
                    "touch_manifest_ref": relative_to_root(manifest_path),
                    "touch_manifest_sha256": file_sha256(pending / "touch-manifest.csv"),
                    "source_checkpoint_id": str(source_id or ""),
                    "source_link_manifest_ref": (
                        relative_to_root(root / "sealed/source-link-manifest.csv")
                        if selected_links else ""
                    ),
                    "source_link_manifest_sha256": (
                        file_sha256(pending / "source-link-manifest.csv")
                        if selected_links else ""
                    ),
                    "dependency_checkpoint_id": (
                        dependency_row["dependency_id"] if dependency_row else ""
                    ),
                    "dependency_receipt_ref": receipt_ref if dependency_row else "",
                    "dependency_receipt_sha256": (
                        dependency_row["artifact_manifest_sha256"] if dependency_row else ""
                    ),
                    "test_evidence_ref": relative_to_root(test_path),
                    "test_evidence_sha256": file_sha256(test_pending),
                    "recorded_at": "CONTROL_ASSIGNS_AT_APPEND",
                    "status": "VERIFIED",
                }
            )
            atomic_write_csv(
                pending / "checkpoint-row.csv", G3_CHECKPOINT_HEADER, [checkpoint_row]
            )
            sealed_artifacts = [
                (f"sealed/{path.name}", path.read_bytes())
                for path in sorted(pending.iterdir(), key=lambda value: value.name)
            ]
            write_new_batch(root, sealed_artifacts)

            local_checks = Checks()
            candidate_dependencies = None
            if dependency_row:
                allocated_dependency = dict(dependency_row)
                existing_dependencies = read_csv(
                    G0 / "g3-cross-repo-dependency-register.csv"
                )
                allocated_dependency["dependency_seq"] = str(
                    len(existing_dependencies) + 1
                )
                candidate_dependencies = [
                    *existing_dependencies,
                    allocated_dependency,
                ]
            validate_checkpoint_test_evidence(
                local_checks,
                checkpoint_row,
                {row["checkpoint_id"]: row for row in rows},
                profiles,
                candidate_dependencies,
            )
            if local_checks.errors:
                raise ValueError("Control checkpoint evidence invalid: " + "; ".join(local_checks.errors))

            manifest_payload = bundle_manifest(root, checkpoint_id)
            write_new_batch(root, [("bundle-manifest.json", json_bytes(manifest_payload))])
            finalization = {
                "schema": "dwp.hris.g3.control-checkpoint-finalization.v1",
                "checkpointId": checkpoint_id,
                "checkpointKind": kind,
                "ownerSessionId": owner,
                "writerSessionId": "CONTROL",
                "repository": repository,
                "sliceId": slice_id,
                "parentHeadSha": parent,
                "headSha": head,
                "sourceCheckpointId": source_id,
                "checkpointRowRef": relative_to_root(root / "sealed/checkpoint-row.csv"),
                "checkpointRowSha256": file_sha256(root / "sealed/checkpoint-row.csv"),
                "dependencyRowRef": (
                    relative_to_root(root / "sealed/dependency-row.csv")
                    if dependency_row else None
                ),
                "dependencyRowSha256": (
                    file_sha256(root / "sealed/dependency-row.csv")
                    if dependency_row else None
                ),
                "bundleManifestRef": relative_to_root(root / "bundle-manifest.json"),
                "bundleManifestSha256": file_sha256(root / "bundle-manifest.json"),
                "createdAt": utc_now(),
                "status": "READY_FOR_CONTROL_CAS_APPEND",
            }
            write_new_batch(root, [("finalization.json", json_bytes(finalization))])
            return finalization
        finally:
            shutil.rmtree(pending)


def self_test() -> dict[str, object]:
    import inspect
    from unittest import mock

    cases: dict[str, bool] = {}
    cases["all-three-control-kinds-covered"] = set(CONTROL_KINDS) == {
        "CENTRAL_MATERIALIZATION", "INTEGRATION_MERGE", "CONTROL_BASELINE_SYNC"
    }
    cases["control-intake-root-is-owner-scoped"] = (
        "g0/control-evidence-intake/hrm/g3-control-checkpoints/G3-CTL-HRM-001"
        in control_root("HRIS-HRM", "G3-CTL-HRM-001").as_posix()
    )
    cases["unsafe-control-intake-id-rejected"] = False
    try:
        control_root("HRIS-HRM", "../escape")
    except ValueError:
        cases["unsafe-control-intake-id-rejected"] = True
    finalize_source = inspect.getsource(finalize)
    cases["finalize-holds-host-lock-and-uses-closed-catalog"] = (
        "exclusive_host_semaphore(" in finalize_source
        and "assert_current_gate_open()" in finalize_source
        and "validate_command_catalog(" in finalize_source
        and "expected_command_bindings(" in finalize_source
        and "shell" not in finalize_source
    )
    external_source = inspect.getsource(stable_external_bytes)
    cases["external-selections-read-stably-outside-blueprint"] = (
        finalize_source.count("stable_external_bytes(") >= 1
        and "outside the blueprint" in external_source
        and "lstat()" in external_source
    )
    cases["frontend-dependency-is-first-class"] = (
        "dependency_receipt(" in finalize_source
        and "resolved_command_set_sha256(" in finalize_source
        and "dependency-row.csv" in finalize_source
    )
    cases["integration-source-status-is-indexed-by-path"] = (
        "for status, path in changed_entries(" in inspect.getsource(derive_plan)
        and "source_status[path]" in inspect.getsource(derive_plan)
    )
    with tempfile.TemporaryDirectory(prefix="hris-control-intake-selftest-") as temporary:
        root = Path(temporary) / "root"
        root.mkdir()
        write_new_batch(root, [("nested/a.json", b"a")])
        cases["create-new-0600-write-accepted"] = (
            (root / "nested/a.json").read_bytes() == b"a"
            and stat.S_IMODE((root / "nested/a.json").stat().st_mode) == 0o600
        )
        write_new_batch(
            root,
            [("nested/a.json", b"a"), ("nested/b.json", b"b")],
        )
        cases["partial-create-new-batch-retry-resumes-byte-identically"] = (
            (root / "nested/b.json").read_bytes() == b"b"
        )
        try:
            write_new_batch(root, [("nested/a.json", b"overwrite")])
            cases["overwrite-rejected"] = False
        except FileExistsError:
            cases["overwrite-rejected"] = True
        try:
            write_new_batch(root, [("../escape.json", b"x")])
            cases["path-escape-rejected"] = False
        except ValueError:
            cases["path-escape-rejected"] = True
        try:
            validate_exact_partial_batch(
                root,
                [("nested/a.json", b"a"), ("nested/b.json", b"different")],
            )
            cases["partial-control-intake-byte-drift-rejected"] = False
        except ValueError:
            cases["partial-control-intake-byte-drift-rejected"] = True
        durable_remove_tree(root)
        durable_remove_tree(root)
        cases["durable-abandon-is-retry-safe"] = not root.exists()
    write_source = inspect.getsource(write_new_batch)
    remove_source = inspect.getsource(durable_remove_tree)
    cases["control-intake-create-unlink-and-rmdir-are-parent-fsynced"] = (
        "fsync_directory(target.parent)" in write_source
        and "fsync_directory(path.parent)" in remove_source
        and "fsync_directory(root.parent)" in remove_source
    )
    abandon_source = inspect.getsource(abandon)
    cases["abandon-rejects-registered-finalized-and-inflight-checkpoints"] = all(
        token in abandon_source
        for token in (
            'row.get("checkpoint_id") == checkpoint_id',
            'row.get("consumer_checkpoint_id") == checkpoint_id',
            'state.get("checkpointId") == checkpoint_id',
            'root / "finalization.json"',
        )
    )
    fake_allocations = [
        {
            "allocation_id": "G3-CTL-BE-CONTRACTS",
            "session_id": "CONTROL",
            "repository": "DWP_BACKEND",
            "path_globs": "contracts/openapi/**|contracts/asyncapi/**|contracts/product-authorization/**",
        }
    ]
    fake_slice = {
        "file_allocation_ids": "G3-HRM-BE-SOURCE",
        "session_id": "HRIS-HRM",
    }
    with mock.patch(f"{__name__}.read_csv", return_value=fake_allocations):
        cases["central-materialization-control-allocation-resolves"] = (
            matching_control_allocation(
                fake_slice, "CENTRAL_MATERIALIZATION", "DWP_BACKEND",
                "contracts/openapi/hris.json",
            ) == "G3-CTL-BE-CONTRACTS"
        )
        try:
            matching_control_allocation(
                fake_slice, "INTEGRATION_MERGE", "DWP_BACKEND",
                "contracts/openapi/hris.json", "",
            )
            cases["integration-without-source-allocation-rejected"] = False
        except ValueError:
            cases["integration-without-source-allocation-rejected"] = True
    status_value = "PASS" if all(cases.values()) else "FAIL"
    return {
        "schema": "dwp.hris.g3.control-checkpoint-prepare-self-test.v1",
        "status": status_value,
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="action", required=True)
    prepare_parser = subparsers.add_parser("prepare")
    prepare_parser.add_argument("--checkpoint-kind", choices=CONTROL_KINDS, required=True)
    prepare_parser.add_argument("--owner-session-id", choices=tuple(MODULES), required=True)
    prepare_parser.add_argument("--repository", choices=REPOSITORIES, required=True)
    prepare_parser.add_argument("--slice-id", required=True)
    prepare_parser.add_argument("--checkpoint-id", required=True)
    prepare_parser.add_argument("--source-checkpoint-id")
    finalize_parser = subparsers.add_parser("finalize")
    finalize_parser.add_argument("--owner-session-id", choices=tuple(MODULES), required=True)
    finalize_parser.add_argument("--checkpoint-id", required=True)
    finalize_parser.add_argument("--selection-map", type=Path, required=True)
    finalize_parser.add_argument("--source-link-map", type=Path)
    finalize_parser.add_argument("--producer-checkpoint-id")
    finalize_parser.add_argument("--artifact-path", action="append", default=[])
    abandon_parser = subparsers.add_parser("abandon")
    abandon_parser.add_argument("--owner-session-id", choices=tuple(MODULES), required=True)
    abandon_parser.add_argument("--checkpoint-id", required=True)
    subparsers.add_parser("self-test")
    arguments = parser.parse_args()
    try:
        if arguments.action == "prepare":
            result = prepare(
                arguments.checkpoint_kind,
                arguments.owner_session_id,
                arguments.repository,
                arguments.slice_id,
                arguments.checkpoint_id,
                arguments.source_checkpoint_id,
            )
        elif arguments.action == "finalize":
            result = finalize(
                arguments.owner_session_id,
                arguments.checkpoint_id,
                arguments.selection_map,
                arguments.source_link_map,
                arguments.producer_checkpoint_id,
                arguments.artifact_path,
            )
        elif arguments.action == "abandon":
            result = abandon(arguments.owner_session_id, arguments.checkpoint_id)
        else:
            result = self_test()
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result.get("status") in {"PASS", "READY_FOR_CONTROL_CAS_APPEND"} else 1
    except (
        KeyError, OSError, ValueError, json.JSONDecodeError,
        SemaphoreTimeoutError,
    ) as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, sort_keys=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
