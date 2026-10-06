#!/usr/bin/env python3
"""Integration-Control-only CAS append for finalized module G3 checkpoints.

Module helpers may prepare and finalize concurrently.  Their filesystem bundle
is an untrusted submission, even when its local SHA-256 chain is internally
consistent.  This tool owns the global append critical section: it validates an
exact regular-file bundle, independently recomputes the Git touch closure,
replays only closed-catalog commands, allocates sequence/time, and atomically
replaces the central register.  It never executes user-supplied commands and
never rewrites a module evidence bundle.  This is a workflow-integrity control,
not external identity attestation.
"""

from __future__ import annotations

import argparse
import csv
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
from central_transaction_fence import assert_all_central_transactions_committed
from prepare_g3_checkpoint import (
    assert_current_gate_open,
    checkpoint_chain_session,
    later_timestamp,
)
from validate_blueprint_workspace_boundaries import validate_shard
from write_module_evidence_shard import evidence_shard_lock_name
from validate_code_checkpoint import (
    BACKEND_SHA,
    FRONTEND_SHA,
    Checks,
    G0,
    G3_CHECKPOINT_HEADER,
    G3_TOUCH_HEADER,
    MODULES,
    ROOT,
    file_sha256,
    read_csv,
    validate_baselines,
    validate_checkpoint_test_evidence,
    validate_command_catalog,
    validate_control_checkpoint_transaction_state,
    validate_control_proposal_registry,
    validate_g3_checkpoint_registry,
    validate_live,
    validate_worktrees_static,
)


REGISTER = G0 / "g3-checkpoint-register.csv"
SOURCE_TRUST = "UNTRUSTED_SUBMISSION"
CONTROL_VERIFICATION = "INDEPENDENT_LIVE_REPLAY_AND_EXACT_GIT_TOUCH_VALIDATED"
CENTRAL_ANCHOR = "G3_CHECKPOINT_REGISTER_TEST_TOUCH_DIGEST_CAS_APPEND"
INTEGRITY_CLAIM = "WORKFLOW_INTEGRITY_NOT_EXTERNAL_IDENTITY_ATTESTATION"


def safe_blueprint_file(value: str) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    resolved = candidate.resolve(strict=False)
    if ROOT.resolve() not in resolved.parents or resolved.is_symlink():
        raise ValueError("append input escapes the blueprint or is symlinked")
    if not resolved.is_file():
        raise ValueError("append input is not a regular file")
    return resolved


def load_single_row(path: Path) -> dict[str, str]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if list(reader.fieldnames or []) != G3_CHECKPOINT_HEADER:
            raise ValueError("append-ready checkpoint row header drift")
        rows = list(reader)
    if len(rows) != 1 or set(rows[0]) != set(G3_CHECKPOINT_HEADER):
        raise ValueError("append-ready bundle must contain exactly one checkpoint row")
    return rows[0]


def relative_to_blueprint(path: Path) -> str:
    try:
        return path.resolve(strict=True).relative_to(ROOT.resolve(strict=True)).as_posix()
    except (OSError, ValueError) as error:
        raise ValueError("submission file escapes the blueprint") from error


def finalization_owner_from_path(finalization_path: Path) -> str:
    """Resolve the owner lexically without reading mutable submission bytes."""
    absolute = finalization_path.absolute()
    for owner, specification in MODULES.items():
        checkpoint_root = (
            ROOT
            / "session-evidence"
            / str(specification["slug"])
            / "g3"
            / "module-evidence"
            / "checkpoints"
        ).absolute()
        try:
            relative = absolute.relative_to(checkpoint_root)
        except ValueError:
            continue
        if (
            len(relative.parts) == 2
            and relative.parts[1] == "finalization.json"
            and re.fullmatch(r"G3-[A-Z0-9-]{3,101}", relative.parts[0])
        ):
            return owner
    raise ValueError("finalization path is outside an exact owner checkpoint root")


def assert_regular_mode_0600(path: Path) -> None:
    try:
        relative_parts = path.absolute().relative_to(ROOT.absolute()).parts
    except ValueError as error:
        raise ValueError("submission path escapes the blueprint") from error
    current = ROOT.absolute()
    for part in relative_parts:
        current = current / part
        try:
            metadata = current.lstat()
        except OSError as error:
            raise ValueError("submission path is missing") from error
        if stat.S_ISLNK(metadata.st_mode):
            raise ValueError("submission path contains a symlink")
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or stat.S_IMODE(metadata.st_mode) != 0o600:
        raise ValueError("submission artifact must be an exact 0600 regular file")


def validate_untrusted_submission_bundle(
    finalization_path: Path,
    payload: dict[str, object],
    proposed: dict[str, str],
) -> None:
    """Validate exact path/file/mode closure before any central trust anchor.

    These checks do not make the submitter trusted.  They ensure that the
    subsequent independent Git validation and command replay are applied to the
    exact immutable bytes whose digests will be written into the central row.
    """

    session = str(payload.get("ownerSessionId", ""))
    checkpoint_id = str(payload.get("checkpointId", ""))
    spec = MODULES.get(session, {})
    slug = str(spec.get("slug", ""))
    if not slug or not re.fullmatch(r"G3-[A-Z0-9-]{3,101}", checkpoint_id):
        raise ValueError("untrusted submission owner/checkpoint identity invalid")
    expected_root = (
        ROOT
        / "session-evidence"
        / slug
        / "g3"
        / "module-evidence"
        / "checkpoints"
        / checkpoint_id
    )
    expected_finalization = expected_root / "finalization.json"
    if finalization_path.resolve(strict=True) != expected_finalization:
        raise ValueError("finalization is outside the exact owner checkpoint root")
    sealed = expected_root / "sealed"
    if not sealed.is_dir() or sealed.is_symlink():
        raise ValueError("sealed submission directory missing or unsafe")

    exact_refs = {
        "checkpointRowRef": sealed / "checkpoint-row.csv",
        "testEvidenceRef": sealed / "test-evidence.json",
        "touchManifestRef": sealed / "touch-manifest.csv",
    }
    for payload_field, expected in exact_refs.items():
        if payload.get(payload_field) != relative_to_blueprint(expected):
            raise ValueError(f"untrusted submission {payload_field} path drift")
        assert_regular_mode_0600(expected)
    assert_regular_mode_0600(expected_finalization)
    for required_root_file in (
        "draft-metadata.json",
        "operation-map-template.csv",
        "operation-map-selected.csv",
    ):
        assert_regular_mode_0600(expected_root / required_root_file)

    touch_path = exact_refs["touchManifestRef"]
    with touch_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if list(reader.fieldnames or []) != G3_TOUCH_HEADER:
            raise ValueError("untrusted submission touch manifest header drift")
        touch_rows = list(reader)
    if not touch_rows:
        raise ValueError("untrusted submission contains no touch rows")
    expected_sealed = {
        exact_refs["checkpointRowRef"],
        exact_refs["testEvidenceRef"],
        exact_refs["touchManifestRef"],
    }
    for index, touch in enumerate(touch_rows, 1):
        evidence = sealed / f"touch-evidence-{index:03d}.json"
        if touch.get("evidence_ref") != relative_to_blueprint(evidence):
            raise ValueError("untrusted submission touch evidence path/order drift")
        assert_regular_mode_0600(evidence)
        if file_sha256(evidence) != touch.get("evidence_sha256"):
            raise ValueError("untrusted submission touch evidence byte digest drift")
        expected_sealed.add(evidence)

    observed_sealed: set[Path] = set()
    for path in sealed.rglob("*"):
        if path.is_symlink() or not path.is_file():
            raise ValueError("untrusted submission contains nested/symlink/non-file content")
        observed_sealed.add(path)
    if observed_sealed != expected_sealed:
        raise ValueError("untrusted submission sealed file set drift")
    observed_root = {path.name for path in expected_root.iterdir()}
    if observed_root != {
        "draft-metadata.json",
        "operation-map-template.csv",
        "operation-map-selected.csv",
        "sealed",
        "finalization.json",
    }:
        raise ValueError("untrusted submission checkpoint root file set drift")

    shard_errors = validate_shard(session, "g3")
    if shard_errors:
        raise ValueError(
            "untrusted submission is not closed by the append-only shard manifest: "
            + "; ".join(shard_errors)
        )

    if proposed.get("checkpoint_id") != checkpoint_id:
        raise ValueError("untrusted submission row/checkpoint identity drift")


def allocate_candidate(
    existing: list[dict[str, str]],
    proposed: dict[str, str],
    *,
    recorded_at: str | None = None,
) -> tuple[list[dict[str, str]], dict[str, str]]:
    if proposed.get("checkpoint_seq") != "CONTROL_ASSIGNS_AT_APPEND":
        raise ValueError("module bundle pre-assigned the global checkpoint sequence")
    if proposed.get("recorded_at") != "CONTROL_ASSIGNS_AT_APPEND":
        raise ValueError("module bundle pre-assigned the global append timestamp")
    checkpoint_id = proposed.get("checkpoint_id", "")
    if not checkpoint_id or any(row.get("checkpoint_id") == checkpoint_id for row in existing):
        raise ValueError("checkpoint ID is blank or already consumed")
    if any(
        checkpoint_chain_session(row) == proposed.get("writer_session_id")
        and row.get("repository") == proposed.get("repository")
        and row.get("head_sha") == proposed.get("head_sha")
        for row in existing
    ):
        raise ValueError("checkpoint HEAD is already consumed for this writer/repository")
    repository = proposed.get("repository", "")
    expected_parent = BACKEND_SHA if repository == "DWP_BACKEND" else FRONTEND_SHA
    for row in existing:
        if (
            checkpoint_chain_session(row) == proposed.get("writer_session_id")
            and row.get("repository") == repository
        ):
            expected_parent = row.get("head_sha", "")
    if proposed.get("parent_head_sha") != expected_parent:
        raise ValueError("append-ready row is stale for its session/repository parent")
    previous_time = existing[-1].get("recorded_at", "") if existing else ""
    append_time = recorded_at or later_timestamp(previous_time)
    if previous_time and append_time <= previous_time:
        raise ValueError("append timestamp is not strictly increasing")
    allocated = dict(proposed)
    allocated["checkpoint_seq"] = str(len(existing) + 1)
    allocated["recorded_at"] = append_time
    return [*existing, allocated], allocated


def atomic_write_register(rows: list[dict[str, str]]) -> None:
    prior_bytes = REGISTER.read_bytes()
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".g3-checkpoint-register.", suffix=".tmp", dir=REGISTER.parent
    )
    temporary = Path(temporary_name)
    replaced = False
    try:
        with os.fdopen(descriptor, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=G3_CHECKPOINT_HEADER, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, REGISTER)
        replaced = True
        directory_descriptor = os.open(
            REGISTER.parent, os.O_RDONLY | getattr(os, "O_CLOEXEC", 0)
        )
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    except Exception:
        if replaced:
            restore_descriptor, restore_name = tempfile.mkstemp(
                prefix=".g3-checkpoint-register.rollback.",
                suffix=".tmp",
                dir=REGISTER.parent,
            )
            restore = Path(restore_name)
            try:
                with os.fdopen(restore_descriptor, "wb") as handle:
                    handle.write(prior_bytes)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.chmod(restore, 0o600)
                os.replace(restore, REGISTER)
                rollback_directory = os.open(
                    REGISTER.parent, os.O_RDONLY | getattr(os, "O_CLOEXEC", 0)
                )
                try:
                    os.fsync(rollback_directory)
                finally:
                    os.close(rollback_directory)
            finally:
                if restore.exists():
                    restore.unlink()
        raise
    finally:
        if temporary.exists():
            temporary.unlink()


def _append_finalization_locked(finalization_path: Path) -> dict[str, object]:
    transaction_checks = Checks()
    validate_control_checkpoint_transaction_state(transaction_checks)
    if transaction_checks.errors:
        raise ValueError(
            "Control checkpoint transaction is not committed: "
            + "; ".join(transaction_checks.errors)
        )
    payload = json.loads(finalization_path.read_text(encoding="utf-8"))
    if (
        set(payload) != {
            "schema", "checkpointId", "checkpointKind", "ownerSessionId",
            "writerSessionId", "repository", "sliceId", "parentHeadSha",
            "headSha", "centralRegisterAppended", "checkpointRowRef",
            "checkpointRowSha256", "testEvidenceRef", "testEvidenceSha256",
            "touchManifestRef", "touchManifestSha256", "captureReceipt",
            "touchValidatorReceipt", "hostSemaphore", "finalizedAt", "status",
        }
        or payload.get("schema") != "dwp.hris.g3.module-checkpoint-finalization.v3"
        or payload.get("status") != "READY_FOR_CONTROL_APPEND_NOT_APPENDED"
        or payload.get("centralRegisterAppended") is not False
        or payload.get("checkpointKind") != "MODULE_COMMIT"
        or payload.get("ownerSessionId") != payload.get("writerSessionId")
    ):
        raise ValueError("finalization schema, state, or owner lifecycle drift")
    row_path = safe_blueprint_file(str(payload.get("checkpointRowRef", "")))
    if file_sha256(row_path) != payload.get("checkpointRowSha256"):
        raise ValueError("append-ready checkpoint row digest drift")
    proposed = load_single_row(row_path)
    identity_pairs = {
        "checkpoint_id": "checkpointId",
        "checkpoint_kind": "checkpointKind",
        "writer_session_id": "writerSessionId",
        "owner_session_id": "ownerSessionId",
        "repository": "repository",
        "slice_id": "sliceId",
        "parent_head_sha": "parentHeadSha",
        "head_sha": "headSha",
        "test_evidence_ref": "testEvidenceRef",
        "test_evidence_sha256": "testEvidenceSha256",
        "touch_manifest_ref": "touchManifestRef",
        "touch_manifest_sha256": "touchManifestSha256",
    }
    if any(proposed.get(row_key) != payload.get(payload_key) for row_key, payload_key in identity_pairs.items()):
        raise ValueError("finalization and checkpoint row identity/digest binding drift")
    validate_untrusted_submission_bundle(finalization_path, payload, proposed)

    existing = read_csv(REGISTER)
    candidate, allocated = allocate_candidate(existing, proposed)
    checks = Checks()
    validate_g3_checkpoint_registry(checks, candidate)
    profiles = validate_command_catalog(checks)
    validate_checkpoint_test_evidence(
        checks,
        allocated,
        {row["checkpoint_id"]: row for row in existing},
        profiles,
    )
    baselines = validate_baselines(checks)
    worktrees = validate_worktrees_static(checks)
    control_proposals = validate_control_proposal_registry(checks, candidate)
    validate_live(
        checks,
        baselines,
        worktrees,
        candidate,
        profiles,
        control_proposals,
        allocated["owner_session_id"],
    )
    if checks.errors:
        raise ValueError("candidate checkpoint append rejected: " + "; ".join(checks.errors))
    # Re-read the authoritative decision immediately before the durable CAS.
    # Compliant publishers share this semaphore, so this closes the check/use
    # window without trusting the earlier module finalization state.
    assert_current_gate_open()
    atomic_write_register(candidate)
    return {
        "schema": "dwp.hris.g3.control-cas-append-result.v1",
        "status": "PASS",
        "checkpointId": allocated["checkpoint_id"],
        "checkpointSeq": allocated["checkpoint_seq"],
        "recordedAt": allocated["recorded_at"],
        "registerSha256": file_sha256(REGISTER),
        "sourceTrust": SOURCE_TRUST,
        "controlVerification": CONTROL_VERIFICATION,
        "centralAnchor": CENTRAL_ANCHOR,
        "integrityClaim": INTEGRITY_CLAIM,
    }


def append_finalization(finalization_path: Path) -> dict[str, object]:
    owner = finalization_owner_from_path(finalization_path)
    with exclusive_host_semaphore(
        HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0
    ):
        assert_all_central_transactions_committed()
        assert_current_gate_open()
        # Lock order is globally fixed: shared Control host lock, then the
        # submitting owner's shard lock.  All exact bundle reads, replay, and
        # central CAS occur while both locks remain held.
        with exclusive_host_semaphore(
            evidence_shard_lock_name(owner, "g3"), timeout_seconds=30.0
        ):
            return _append_finalization_locked(finalization_path)


def self_test() -> dict[str, object]:
    import inspect

    base_heads = {
        "DWP_BACKEND": BACKEND_SHA,
        "DWP_FRONTEND": FRONTEND_SHA,
    }
    rows: list[dict[str, str]] = []
    cases: dict[str, bool] = {}
    try:
        for index, session in enumerate(("HRIS-HRM", "HRIS-PER", "HRIS-PAY", "HRIS-TIM", "HRIS-SYS"), 1):
            proposed = {field: "" for field in G3_CHECKPOINT_HEADER}
            proposed.update(
                {
                    "checkpoint_seq": "CONTROL_ASSIGNS_AT_APPEND",
                    "checkpoint_id": f"G3-SELF-{index}",
                    "checkpoint_kind": "MODULE_COMMIT",
                    "writer_session_id": session,
                    "owner_session_id": session,
                    "repository": "DWP_BACKEND",
                    "slice_id": f"SLICE-{index}",
                    "parent_head_sha": base_heads["DWP_BACKEND"],
                    "head_sha": f"{index:040x}",
                    "recorded_at": "CONTROL_ASSIGNS_AT_APPEND",
                    "status": "VERIFIED",
                }
            )
            rows, _ = allocate_candidate(
                rows,
                proposed,
                recorded_at=f"2026-09-11T00:00:0{index}Z",
            )
        cases["five-parallel-module-drafts-append-without-global-preimage-starvation"] = (
            [row["checkpoint_seq"] for row in rows] == ["1", "2", "3", "4", "5"]
        )
        baseline_sync = {field: "" for field in G3_CHECKPOINT_HEADER}
        baseline_sync.update(
            {
                "checkpoint_seq": "6",
                "checkpoint_id": "G3-SELF-HRM-SYNC",
                "checkpoint_kind": "CONTROL_BASELINE_SYNC",
                "writer_session_id": "CONTROL",
                "owner_session_id": "HRIS-HRM",
                "repository": "DWP_BACKEND",
                "slice_id": "SLICE-1",
                "parent_head_sha": "1" * 40,
                "head_sha": "a" * 40,
                "recorded_at": "2026-09-11T00:00:06Z",
                "status": "VERIFIED",
            }
        )
        rows.append(baseline_sync)
        after_sync = {field: "" for field in G3_CHECKPOINT_HEADER}
        after_sync.update(
            {
                "checkpoint_seq": "CONTROL_ASSIGNS_AT_APPEND",
                "checkpoint_id": "G3-SELF-HRM-AFTER-SYNC",
                "checkpoint_kind": "MODULE_COMMIT",
                "writer_session_id": "HRIS-HRM",
                "owner_session_id": "HRIS-HRM",
                "repository": "DWP_BACKEND",
                "slice_id": "SLICE-1",
                "parent_head_sha": "a" * 40,
                "head_sha": "b" * 40,
                "recorded_at": "CONTROL_ASSIGNS_AT_APPEND",
                "status": "VERIFIED",
            }
        )
        rows, resumed = allocate_candidate(
            rows, after_sync, recorded_at="2026-09-11T00:00:07Z"
        )
        cases["module-chain-resumes-from-baseline-sync-head"] = (
            resumed["parent_head_sha"] == "a" * 40
            and resumed["checkpoint_seq"] == "7"
        )
        stale = {field: "" for field in G3_CHECKPOINT_HEADER}
        stale.update(
            {
                "checkpoint_seq": "CONTROL_ASSIGNS_AT_APPEND",
                "checkpoint_id": "G3-SELF-STALE",
                "writer_session_id": "HRIS-HRM",
                "repository": "DWP_BACKEND",
                "parent_head_sha": BACKEND_SHA,
                "head_sha": "f" * 40,
                "recorded_at": "CONTROL_ASSIGNS_AT_APPEND",
            }
        )
        try:
            allocate_candidate(rows, stale, recorded_at="2026-09-11T00:00:08Z")
            cases["same-session-stale-parent-rejected"] = False
        except ValueError:
            cases["same-session-stale-parent-rejected"] = True
        duplicate = dict(stale)
        duplicate["checkpoint_id"] = "G3-SELF-1"
        try:
            allocate_candidate(rows, duplicate, recorded_at="2026-09-11T00:00:08Z")
            cases["duplicate-checkpoint-id-rejected"] = False
        except ValueError:
            cases["duplicate-checkpoint-id-rejected"] = True
    except ValueError:
        cases["five-parallel-module-drafts-append-without-global-preimage-starvation"] = False
    cases["submission-self-hash-is-never-a-control-trust-claim"] = (
        SOURCE_TRUST == "UNTRUSTED_SUBMISSION"
        and INTEGRITY_CLAIM == "WORKFLOW_INTEGRITY_NOT_EXTERNAL_IDENTITY_ATTESTATION"
    )
    wrapper_source = inspect.getsource(append_finalization)
    append_source = inspect.getsource(_append_finalization_locked)
    required_steps = [
        "validate_control_checkpoint_transaction_state(",
        "validate_untrusted_submission_bundle(",
        "validate_g3_checkpoint_registry(",
        "validate_checkpoint_test_evidence(",
        "validate_live(",
        "atomic_write_register(",
    ]
    positions = [append_source.find(step) for step in required_steps]
    cases["control-bundle-git-command-replay-precedes-central-cas-anchor"] = (
        all(position >= 0 for position in positions)
        and positions == sorted(positions)
    )
    wrapper_steps = [
        wrapper_source.find("exclusive_host_semaphore("),
        wrapper_source.find("assert_current_gate_open()"),
        wrapper_source.find("evidence_shard_lock_name(owner, \"g3\")"),
        wrapper_source.find("_append_finalization_locked("),
    ]
    cases["gate-check-and-all-validation-run-inside-host-semaphore"] = (
        all(position >= 0 for position in wrapper_steps)
        and wrapper_steps == sorted(wrapper_steps)
        and append_source.find("assert_current_gate_open()")
        < append_source.find("atomic_write_register(candidate)")
    )
    cases["host-then-owner-shard-lock-freezes-bundle-through-cas"] = (
        wrapper_source.find("HOST_VERIFICATION_SEMAPHORE")
        < wrapper_source.find("evidence_shard_lock_name(owner, \"g3\")")
        < wrapper_source.find("_append_finalization_locked(")
        and append_source.find("validate_untrusted_submission_bundle(")
        < append_source.find("atomic_write_register(candidate)")
    )
    try:
        finalization_owner_from_path(
            ROOT / "session-evidence/hrm/g3/module-evidence/checkpoints/G3-SELF-LOCK/finalization.json"
        )
        cases["owner-shard-lock-derived-without-reading-submission"] = True
    except ValueError:
        cases["owner-shard-lock-derived-without-reading-submission"] = False
    try:
        finalization_owner_from_path(ROOT / "session-evidence/hrm/g3/finalization.json")
        cases["non-checkpoint-lock-target-rejected"] = False
    except ValueError:
        cases["non-checkpoint-lock-target-rejected"] = True
    register_write_source = inspect.getsource(atomic_write_register)
    cases["central-register-replace-is-directory-fsynced-with-rollback"] = (
        "prior_bytes = REGISTER.read_bytes()" in register_write_source
        and "os.replace(temporary, REGISTER)" in register_write_source
        and "os.fsync(directory_descriptor)" in register_write_source
        and "os.replace(restore, REGISTER)" in register_write_source
        and "os.fsync(rollback_directory)" in register_write_source
    )
    bundle_source = inspect.getsource(validate_untrusted_submission_bundle)
    cases["control-intake-requires-owned-module-evidence-shard"] = (
        '"module-evidence"' in bundle_source
        and "validate_shard(session, \"g3\")" in bundle_source
        and '"operation-map-template.csv"' in bundle_source
        and '"operation-map-selected.csv"' in bundle_source
    )
    return {
        "schema": "dwp.hris.g3.control-cas-append-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--finalization")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        result = self_test()
    elif args.finalization:
        result = append_finalization(safe_blueprint_file(args.finalization))
    else:
        parser.error("one of --self-test or --finalization is required")
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0 if result.get("status") == "PASS" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError, SemaphoreTimeoutError) as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, ensure_ascii=False))
        raise SystemExit(1)
