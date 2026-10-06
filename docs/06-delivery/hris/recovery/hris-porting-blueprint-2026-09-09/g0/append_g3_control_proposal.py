#!/usr/bin/env python3
"""Owner-scoped, append-only publication of a G3 Control proposal.

The editable proposal is read from outside the blueprint. Its exact bytes are
appended to the owner's evidence shard; ``proposal_blob_oid`` is a deterministic
content ID and never a pruneable, unreachable object. Integration Control validates the
candidate before allocating the global proposal sequence and replacing the
central register under the common host semaphore.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import stat
import tempfile
from pathlib import Path

from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    exclusive_host_semaphore,
)
from central_transaction_fence import assert_all_central_transactions_committed
from prepare_g3_checkpoint import assert_current_gate_open
from prepare_g3_control_checkpoint import stable_external_bytes
from validate_blueprint_workspace_boundaries import validate_shard
from validate_code_checkpoint import (
    Checks,
    G0,
    G3_CONTROL_PROPOSAL_HEADER,
    MODULES,
    ROOT,
    control_proposal_binding_errors,
    file_sha256,
    git_blob_content_oid,
    has_typed_owner_control_proposal_shape,
    read_csv,
    validate_control_proposal_registry,
    validate_control_checkpoint_transaction_state,
)
from write_module_evidence_shard import append_new_bytes, resolve_target


REGISTER = G0 / "g3-control-proposal-register.csv"


def csv_bytes(header: list[str], rows: list[dict[str, str]]) -> bytes:
    with tempfile.TemporaryFile(mode="w+", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
        handle.flush()
        handle.seek(0)
        return handle.read().encode("utf-8")


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


def registered_owner_repository(owner: str, repository: str) -> Path:
    rows = [
        row
        for row in read_csv(G0 / "worktree-branch-register.csv")
        if row.get("session_id") == owner and row.get("repository") == repository
    ]
    if len(rows) != 1:
        raise ValueError("owner repository registration is not unique")
    path = Path(rows[0].get("worktree_path", ""))
    if not path.is_dir() or path.is_symlink():
        raise ValueError("owner repository worktree is unavailable or symlinked")
    return path


def proposal_row(
    proposal: dict[str, object],
    proposal_ref: str,
    payload: bytes,
    blob_oid: str,
) -> dict[str, str]:
    mappings = {
        "proposal_id": "proposalId",
        "owner_session_id": "ownerSessionId",
        "writer_session_id": "writerSessionId",
        "repository": "repository",
        "slice_id": "sliceId",
        "source_checkpoint_id": "sourceCheckpointId",
        "source_head_sha": "sourceHeadSha",
        "source_tree_sha": "sourceTreeSha",
        "source_touch_manifest_sha256": "sourceTouchManifestSha256",
        "proposer_role": "proposerRole",
        "approved_by_role": "approvedByRole",
        "approval_reference": "approvalReference",
        "approved_at": "approvedAt",
        "status": "status",
    }
    row = {field: "" for field in G3_CONTROL_PROPOSAL_HEADER}
    row.update({field: str(proposal.get(source, "")) for field, source in mappings.items()})
    row.update(
        {
            "proposal_seq": "CONTROL_ASSIGNS_AT_APPEND",
            "proposal_blob_oid": blob_oid,
            "proposal_ref": proposal_ref,
            "proposal_sha256": hashlib.sha256(payload).hexdigest(),
        }
    )
    return row


def append_or_verify_owner_artifact(owner: str, relative: str, payload: bytes) -> Path:
    target = resolve_target(owner, relative, "g3")
    if target.exists() or target.is_symlink():
        if target.is_symlink() or not target.is_file() or target.read_bytes() != payload:
            raise ValueError("proposal artifact path was already consumed with different bytes")
        if stat.S_IMODE(target.stat().st_mode) != 0o600:
            raise ValueError("existing proposal artifact mode drift")
        errors = validate_shard(owner, "g3")
        if errors:
            raise ValueError("existing proposal artifact is not shard-sealed: " + "; ".join(errors))
        return target
    return append_new_bytes(owner, [(relative, payload)], "g3")[0][0]


def append_proposal(source: Path) -> dict[str, object]:
    payload = stable_external_bytes(source)
    try:
        proposal = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"proposal is not one UTF-8 JSON object: {error}") from error
    if not isinstance(proposal, dict) or not has_typed_owner_control_proposal_shape(proposal):
        raise ValueError("proposal typed schema/status is invalid")
    owner = str(proposal.get("ownerSessionId", ""))
    repository = str(proposal.get("repository", ""))
    proposal_id = str(proposal.get("proposalId", ""))
    if owner not in MODULES or repository not in {"DWP_BACKEND", "DWP_FRONTEND"}:
        raise ValueError("proposal owner/repository is invalid")
    if not proposal_id or not all(character.isalnum() or character in "-_" for character in proposal_id):
        raise ValueError("proposal ID is not path-safe")

    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        assert_all_central_transactions_committed()
        assert_current_gate_open()
        transaction_checks = Checks()
        validate_control_checkpoint_transaction_state(transaction_checks)
        if transaction_checks.errors:
            raise ValueError(
                "Control checkpoint transaction is not committed: "
                + "; ".join(transaction_checks.errors)
            )
        checkpoints = read_csv(G0 / "g3-checkpoint-register.csv")
        source_checkpoint = next(
            (
                row for row in checkpoints
                if row.get("checkpoint_id") == proposal.get("sourceCheckpointId")
            ),
            {},
        )
        owner_repository = registered_owner_repository(owner, repository)
        slug = str(MODULES[owner]["slug"])
        relative = f"control-proposals/{proposal_id}.json"
        proposal_ref = f"session-evidence/{slug}/g3/module-evidence/{relative}"
        blob_oid = git_blob_content_oid(payload)
        proposed = proposal_row(proposal, proposal_ref, payload, blob_oid)
        active_slices = {
            row.get("slice_id", ""): row
            for row in read_csv(ROOT / "coding-readiness/g3-slice-code-go-register.csv")
            if row.get("gate_status") == "OPEN_G3_CODE"
        }
        control_allocations = {
            row.get("allocation_id", ""): row
            for row in read_csv(ROOT / "coding-readiness/g3-file-allocation-register.csv")
            if row.get("session_id") == "CONTROL"
            and row.get("state") == "ALLOCATED_G3_NOT_IMPLEMENTED"
        }
        binding_errors = control_proposal_binding_errors(
            proposed,
            proposal,
            source_checkpoint,
            owner_repository,
            payload,
            active_slices,
            control_allocations,
        )
        if binding_errors:
            raise ValueError("owner proposal binding rejected: " + "; ".join(binding_errors))

        artifact = append_or_verify_owner_artifact(owner, relative, payload)
        if artifact.relative_to(ROOT).as_posix() != proposal_ref or file_sha256(artifact) != proposed["proposal_sha256"]:
            raise ValueError("owner proposal artifact publication drift")
        existing = read_csv(REGISTER)
        existing_match = next(
            (row for row in existing if row.get("proposal_id") == proposal_id), None
        )
        if existing_match is not None:
            comparison = dict(proposed)
            comparison["proposal_seq"] = existing_match.get("proposal_seq", "")
            if comparison != existing_match:
                raise ValueError("proposal ID was already consumed with different content")
            return {
                "schema": "dwp.hris.g3.control-proposal-append-result.v1",
                "status": "PASS",
                "proposalId": proposal_id,
                "proposalSeq": existing_match["proposal_seq"],
                "registerSha256": file_sha256(REGISTER),
                "idempotentReplay": True,
            }
        proposed["proposal_seq"] = str(len(existing) + 1)
        candidate = [*existing, proposed]
        checks = Checks()
        validate_control_proposal_registry(checks, checkpoints, candidate)
        if checks.errors:
            raise ValueError("proposal register candidate rejected: " + "; ".join(checks.errors))
        prior = REGISTER.read_bytes()
        assert_current_gate_open()
        try:
            replace_bytes(REGISTER, csv_bytes(G3_CONTROL_PROPOSAL_HEADER, candidate))
        except Exception:
            replace_bytes(REGISTER, prior)
            raise
        return {
            "schema": "dwp.hris.g3.control-proposal-append-result.v1",
            "status": "PASS",
            "proposalId": proposal_id,
            "proposalSeq": proposed["proposal_seq"],
            "registerSha256": file_sha256(REGISTER),
            "idempotentReplay": False,
        }


def self_test() -> dict[str, object]:
    import inspect

    cases: dict[str, bool] = {}
    source = inspect.getsource(append_proposal)
    positions = [
        source.find("exclusive_host_semaphore("),
        source.find("assert_current_gate_open()"),
        source.find("control_proposal_binding_errors("),
        source.find("append_or_verify_owner_artifact("),
        source.rfind("assert_current_gate_open()"),
        source.find("replace_bytes(REGISTER"),
    ]
    cases["lock-gate-binding-shard-and-cas-order-sealed"] = (
        all(position >= 0 for position in positions) and positions == sorted(positions)
    )
    cases["external-source-is-stable-and-outside-blueprint"] = (
        "stable_external_bytes(source)" in source
    )
    cases["immutable-shard-content-oid-precedes-register"] = (
        source.find("git_blob_content_oid(") < source.find("replace_bytes(REGISTER")
        and "hash-object" not in source
        and "-w" not in source
    )
    replacement = inspect.getsource(replace_bytes)
    cases["register-cas-fsyncs-file-and-parent"] = (
        "os.fsync(handle.fileno())" in replacement
        and "os.replace(temporary, path)" in replacement
        and "fsync_parent(path)" in replacement
    )
    cases["proposal-register-failure-rolls-back"] = (
        "replace_bytes(REGISTER, prior)" in source
    )
    with tempfile.TemporaryDirectory(prefix="g3-control-proposal-selftest-") as temporary:
        path = Path(temporary) / "register.csv"
        path.write_bytes(b"old\n")
        replace_bytes(path, b"new\n")
        cases["atomic-replace-writes-exact-bytes"] = path.read_bytes() == b"new\n"
    status = "PASS" if all(cases.values()) else "FAIL"
    return {
        "schema": "dwp.hris.g3.control-proposal-append-self-test.v1",
        "status": status,
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--proposal", type=Path)
    parser.add_argument("--self-test", action="store_true")
    arguments = parser.parse_args()
    try:
        if arguments.self_test:
            result = self_test()
        elif arguments.proposal is not None:
            result = append_proposal(arguments.proposal)
        else:
            parser.error("one of --proposal or --self-test is required")
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result.get("status") == "PASS" else 1
    except (OSError, ValueError, json.JSONDecodeError, SemaphoreTimeoutError) as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
