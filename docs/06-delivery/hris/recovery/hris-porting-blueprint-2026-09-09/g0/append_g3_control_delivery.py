#!/usr/bin/env python3
"""Crash-detectable Control release + complete consumer receipt CAS.

Inputs are stable-read and copied into one immutable Control intake bundle.
The release and receipt registers are validated as one candidate and committed
under the shared host semaphore with a PREPARED journal.  Ordinary failures
restore both registers and the prior marker; process interruption requires an
explicit deterministic commit/rollback recovery from that same bundle.
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
from validate_central_artifact_delivery import (
    ALLOCATIONS,
    CHECKPOINTS,
    CLASSIFICATIONS,
    DECISION,
    DELIVERY_STATE_FIELDS,
    G0,
    RECEIPT_HEADER,
    RECEIPTS,
    RELEASE_HEADER,
    RELEASES,
    ROOT,
    delivery_state_errors,
    read_csv,
    sha256,
    validate_data,
)
from write_module_evidence_shard import read_stable_source


STATE = G0 / "g3-control-delivery-state.json"
BUNDLE_FIELDS = {"schema", "releaseId", "files", "state"}


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


def load_single_row_bytes(value: bytes, header: list[str]) -> dict[str, str]:
    try:
        text = value.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ValueError("Control delivery input is not UTF-8 CSV") from error
    with tempfile.TemporaryFile(mode="w+", newline="", encoding="utf-8") as handle:
        handle.write(text)
        handle.seek(0)
        reader = csv.DictReader(handle)
        if list(reader.fieldnames or []) != header:
            raise ValueError("Control delivery input row header drift")
        rows = list(reader)
    if len(rows) != 1 or set(rows[0]) != set(header):
        raise ValueError("Control delivery input must contain exactly one typed row")
    return rows[0]


def stable_input_row(path: Path, header: list[str]) -> dict[str, str]:
    return load_single_row_bytes(read_stable_source(path.absolute()), header)


def safe_relative(reference: str) -> bool:
    path = Path(reference)
    return bool(reference) and not path.is_absolute() and ".." not in path.parts


def bundle_root(release_id: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{2,127}", release_id):
        raise ValueError("Control release ID is not path-safe")
    return G0 / "control-evidence-intake/control-deliveries" / release_id


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_CLOEXEC", 0))
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def ensure_directory(path: Path) -> None:
    missing: list[Path] = []
    current = path
    while not current.exists():
        missing.append(current)
        current = current.parent
    for directory in reversed(missing):
        directory.mkdir(mode=0o700)
        fsync_directory(directory.parent)


def write_new_file(path: Path, content: bytes) -> None:
    ensure_directory(path.parent)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_CLOEXEC", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags, 0o600)
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    fsync_directory(path.parent)


def immutable_bundle(
    release: dict[str, str], receipts: list[dict[str, str]]
) -> Path:
    root = bundle_root(release.get("release_id", ""))
    artifacts = [
        ("release-row.csv", csv_bytes(RELEASE_HEADER, [release])),
        *[
            (f"receipt-rows/{index:03d}.csv", csv_bytes(RECEIPT_HEADER, [row]))
            for index, row in enumerate(receipts, 1)
        ],
    ]
    files = sorted([
        {
            "path": relative,
            "sha256": sha256_bytes(content),
            "size": len(content),
            "mode": "0600",
        }
        for relative, content in artifacts
    ], key=lambda item: str(item["path"]))
    manifest = {
        "schema": "dwp.hris.g3.control-delivery-intake-bundle.v1",
        "releaseId": release["release_id"],
        "files": files,
        "state": "IMMUTABLE_CONTROL_DELIVERY_INTAKE",
    }
    artifacts.append(("bundle-manifest.json", json_bytes(manifest)))
    expected_by_path = dict(artifacts)
    if root.is_symlink() or (root.exists() and not root.is_dir()):
        raise ValueError("Control delivery bundle root is unsafe")
    if root.exists():
        allowed_directories = {root, root / "receipt-rows"}
        observed_files: dict[str, Path] = {}
        for value in root.rglob("*"):
            if value.is_symlink():
                raise ValueError("Control delivery partial bundle contains a symlink")
            if value.is_dir():
                if value not in allowed_directories:
                    raise ValueError("Control delivery partial bundle contains an extra directory")
                continue
            if not value.is_file():
                raise ValueError("Control delivery partial bundle contains a special file")
            relative = value.relative_to(root).as_posix()
            if relative not in expected_by_path:
                raise ValueError("Control delivery partial bundle contains an extra file")
            observed_files[relative] = value
        manifest_path = root / "bundle-manifest.json"
        if manifest_path.is_file() and set(observed_files) != set(expected_by_path):
            raise ValueError("committed Control delivery bundle file closure drift")
        for relative, target in observed_files.items():
            if (
                stat.S_IMODE(target.stat().st_mode) != 0o600
                or target.read_bytes() != expected_by_path[relative]
            ):
                raise ValueError(
                    "Control delivery bundle ID was consumed with different bytes"
                )
    created: list[Path] = []
    try:
        for relative, content in artifacts:
            target = root / relative
            if not target.exists():
                write_new_file(target, content)
                created.append(target)
        return root / "bundle-manifest.json"
    except Exception:
        for target in reversed(created):
            if target.is_file() and not target.is_symlink():
                parent = target.parent
                target.unlink()
                fsync_directory(parent)
        raise


def load_bundle(path: Path) -> tuple[dict[str, str], list[dict[str, str]]]:
    if path.is_symlink() or not path.is_file() or stat.S_IMODE(path.stat().st_mode) != 0o600:
        raise ValueError("Control delivery bundle manifest missing/unsafe")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if (
        not isinstance(payload, dict) or set(payload) != BUNDLE_FIELDS
        or payload.get("schema") != "dwp.hris.g3.control-delivery-intake-bundle.v1"
        or payload.get("state") != "IMMUTABLE_CONTROL_DELIVERY_INTAKE"
        or not isinstance(payload.get("files"), list)
    ):
        raise ValueError("Control delivery bundle manifest schema drift")
    root = path.parent
    expected_paths: list[str] = []
    for item in payload["files"]:
        if not isinstance(item, dict) or set(item) != {"path", "sha256", "size", "mode"}:
            raise ValueError("Control delivery bundle file entry drift")
        reference = str(item.get("path", ""))
        if not safe_relative(reference):
            raise ValueError("Control delivery bundle path unsafe")
        target = root / reference
        if (
            target.is_symlink() or not target.is_file()
            or stat.S_IMODE(target.stat().st_mode) != 0o600
            or item.get("sha256") != sha256(target)
            or item.get("size") != target.stat().st_size
            or item.get("mode") != "0600"
        ):
            raise ValueError("Control delivery bundle byte/mode digest drift")
        expected_paths.append(reference)
    if expected_paths != sorted(expected_paths) or len(expected_paths) != len(set(expected_paths)):
        raise ValueError("Control delivery bundle paths not sorted/unique")
    observed = sorted(
        value.relative_to(root).as_posix()
        for value in root.rglob("*") if value.is_file()
    )
    if observed != sorted([*expected_paths, "bundle-manifest.json"]):
        raise ValueError("Control delivery bundle exact file closure drift")
    release = load_single_row_bytes((root / "release-row.csv").read_bytes(), RELEASE_HEADER)
    receipt_paths = [root / reference for reference in expected_paths if reference.startswith("receipt-rows/")]
    receipts = [load_single_row_bytes(value.read_bytes(), RECEIPT_HEADER) for value in receipt_paths]
    if payload.get("releaseId") != release.get("release_id") or not receipts:
        raise ValueError("Control delivery bundle identity or receipt closure drift")
    return release, receipts


def allocate_rows(
    existing: list[dict[str, str]],
    proposed: list[dict[str, str]],
    *,
    id_field: str,
    seq_field: str,
) -> list[dict[str, str]]:
    seen_ids = {row.get(id_field, "") for row in existing}
    result = list(existing)
    last_time = existing[-1].get("recorded_at", "") if existing else ""
    for offset, row in enumerate(proposed, 1):
        identifier = row.get(id_field, "")
        recorded_at = row.get("recorded_at", "")
        if row.get(seq_field) != "CONTROL_ASSIGNS_AT_APPEND":
            raise ValueError(f"{identifier}: global sequence was pre-assigned")
        if not identifier or identifier in seen_ids:
            raise ValueError(f"{identifier}: blank or replayed Control delivery ID")
        if not recorded_at.endswith("Z"):
            raise ValueError(f"{identifier}: append timestamp is not UTC")
        if last_time and recorded_at <= last_time:
            raise ValueError(f"{identifier}: append timestamp is not strictly increasing")
        allocated = dict(row)
        allocated[seq_field] = str(len(existing) + offset)
        result.append(allocated)
        seen_ids.add(identifier)
        last_time = recorded_at
    return result


def candidate_from_bundle(
    bundle: Path,
    base_releases: list[dict[str, str]],
    base_receipts: list[dict[str, str]],
) -> tuple[list[dict[str, str]], list[dict[str, str]], dict[str, str], list[dict[str, str]]]:
    release, receipts = load_bundle(bundle)
    receipts = sorted(receipts, key=lambda row: row.get("receipt_id", ""))
    candidate_releases = allocate_rows(
        base_releases, [release], id_field="release_id", seq_field="release_seq"
    )
    candidate_receipts = allocate_rows(
        base_receipts, receipts, id_field="receipt_id", seq_field="receipt_seq"
    )
    class_header, classes = read_csv(CLASSIFICATIONS)
    _allocation_header, allocations = read_csv(ALLOCATIONS)
    _checkpoint_header, checkpoints = read_csv(CHECKPOINTS)
    decision = json.loads(DECISION.read_text(encoding="utf-8"))
    errors = validate_data(
        class_header, classes, allocations, RELEASE_HEADER, candidate_releases,
        RECEIPT_HEADER, candidate_receipts, checkpoints, decision,
        verify_files=True, check_live=True,
    )
    if errors:
        raise ValueError("Control delivery candidate rejected: " + "; ".join(errors))
    return candidate_releases, candidate_receipts, release, receipts


def fsync_parent(path: Path) -> None:
    fsync_directory(path.parent)


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


def committed_state() -> dict[str, object]:
    payload = json.loads(STATE.read_text(encoding="utf-8"))
    releases = read_csv(RELEASES)[1]
    receipts = read_csv(RECEIPTS)[1]
    errors = delivery_state_errors(
        payload, sha256(RELEASES), sha256(RECEIPTS),
        has_rows=bool(releases or receipts), release_rows=releases, receipt_rows=receipts,
    )
    if errors:
        raise ValueError("Control delivery transaction state invalid: " + "; ".join(errors))
    return payload


def prepared_state(
    prior: dict[str, object],
    bundle: Path,
    releases: list[dict[str, str]],
    receipts: list[dict[str, str]],
    release: dict[str, str],
    proposed_receipts: list[dict[str, str]],
) -> dict[str, object]:
    release_content = csv_bytes(RELEASE_HEADER, releases)
    receipt_content = csv_bytes(RECEIPT_HEADER, receipts)
    prepared_at = later_timestamp(str(prior.get("committedAt") or ""))
    return {
        "schema": "dwp.hris.g3.control-delivery-transaction-state.v1",
        "transactionSeq": int(prior["transactionSeq"]) + 1,
        "phase": "PREPARED",
        "priorReleaseRegisterSha256": sha256(RELEASES),
        "priorReceiptRegisterSha256": sha256(RECEIPTS),
        "candidateReleaseRegisterSha256": sha256_bytes(release_content),
        "candidateReceiptRegisterSha256": sha256_bytes(receipt_content),
        "releaseRegisterSha256": sha256_bytes(release_content),
        "receiptRegisterSha256": sha256_bytes(receipt_content),
        "releaseId": release["release_id"],
        "receiptIds": sorted(row["receipt_id"] for row in proposed_receipts),
        "releaseSeq": len(releases),
        "receiptSeq": len(receipts),
        "bundleRef": bundle.relative_to(ROOT).as_posix(),
        "bundleSha256": sha256(bundle),
        "preparedAt": prepared_at,
        "committedAt": None,
        "priorState": prior,
        "status": "CONTROL_DELIVERY_TRANSACTION_PREPARED",
    }


def finish_state(journal: dict[str, object]) -> dict[str, object]:
    result = dict(journal)
    result.update(
        {
            "phase": "COMMITTED",
            "committedAt": later_timestamp(str(journal["preparedAt"])),
            "priorState": None,
            "status": "CONTROL_DELIVERY_TRANSACTION_COMMITTED",
        }
    )
    return result


def restore_transaction(release_bytes: bytes, receipt_bytes: bytes, state_bytes: bytes) -> None:
    failures: list[str] = []
    for path, content in ((RELEASES, release_bytes), (RECEIPTS, receipt_bytes), (STATE, state_bytes)):
        try:
            replace_bytes(path, content)
        except Exception as error:
            failures.append(f"{path.name}: {error}")
    if failures:
        raise RuntimeError("Control delivery rollback incomplete: " + "; ".join(failures))


def append_batch(release_row_path: Path, receipt_row_paths: list[Path]) -> dict[str, object]:
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        assert_all_central_transactions_committed()
        assert_current_gate_open()
        marker = committed_state()
        release = stable_input_row(release_row_path, RELEASE_HEADER)
        receipts = sorted(
            [stable_input_row(path, RECEIPT_HEADER) for path in receipt_row_paths],
            key=lambda row: row.get("receipt_id", ""),
        )
        if not receipts:
            raise ValueError("a Control release and all consumer receipts must be one batch")
        bundle = immutable_bundle(release, receipts)
        base_releases = read_csv(RELEASES)[1]
        base_receipts = read_csv(RECEIPTS)[1]
        releases, candidate_receipts, release, receipts = candidate_from_bundle(
            bundle, base_releases, base_receipts
        )
        release_content = csv_bytes(RELEASE_HEADER, releases)
        receipt_content = csv_bytes(RECEIPT_HEADER, candidate_receipts)
        old_release = RELEASES.read_bytes()
        old_receipt = RECEIPTS.read_bytes()
        old_state = STATE.read_bytes()
        journal = prepared_state(marker, bundle, releases, candidate_receipts, release, receipts)
        try:
            replace_bytes(STATE, json_bytes(journal))
            assert_authoritative_gate_open_during_prepared_transaction(
                "G3_CONTROL_DELIVERY", journal
            )
            replace_bytes(RELEASES, release_content)
            replace_bytes(RECEIPTS, receipt_content)
            replace_bytes(STATE, json_bytes(finish_state(journal)))
        except Exception as error:
            try:
                restore_transaction(old_release, old_receipt, old_state)
            except RuntimeError as rollback_error:
                raise RuntimeError(str(rollback_error)) from error
            raise
        return {
            "schema": "dwp.hris.g3.control-delivery-cas-result.v2",
            "status": "PASS",
            "releaseId": release["release_id"],
            "receiptCount": len(receipts),
            "transactionSeq": journal["transactionSeq"],
            "stateSha256": sha256(STATE),
        }


def load_prepared() -> dict[str, object]:
    payload = json.loads(STATE.read_text(encoding="utf-8"))
    if (
        not isinstance(payload, dict) or set(payload) != DELIVERY_STATE_FIELDS
        or payload.get("schema") != "dwp.hris.g3.control-delivery-transaction-state.v1"
        or payload.get("phase") != "PREPARED"
        or payload.get("status") != "CONTROL_DELIVERY_TRANSACTION_PREPARED"
        or not isinstance(payload.get("priorState"), dict)
    ):
        raise ValueError("Control delivery state is not one recoverable PREPARED transaction")
    return payload


def recover(action: str) -> dict[str, object]:
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        assert_recovery_exclusive("G3_CONTROL_DELIVERY")
        journal = load_prepared()
        bundle_ref = str(journal.get("bundleRef", ""))
        if not safe_relative(bundle_ref):
            raise ValueError("PREPARED Control delivery bundle path unsafe")
        bundle = ROOT / bundle_ref
        if not bundle.is_file() or sha256(bundle) != journal.get("bundleSha256"):
            raise ValueError("PREPARED Control delivery bundle missing/stale")
        current_release_digest = sha256(RELEASES)
        current_receipt_digest = sha256(RECEIPTS)
        if current_release_digest not in {
            journal.get("priorReleaseRegisterSha256"), journal.get("candidateReleaseRegisterSha256")
        } or current_receipt_digest not in {
            journal.get("priorReceiptRegisterSha256"), journal.get("candidateReceiptRegisterSha256")
        }:
            raise ValueError("PREPARED Control delivery registers are neither preimage nor candidate")
        releases = read_csv(RELEASES)[1]
        receipts = read_csv(RECEIPTS)[1]
        if current_release_digest == journal.get("candidateReleaseRegisterSha256"):
            if not releases or releases[-1].get("release_id") != journal.get("releaseId"):
                raise ValueError("PREPARED Control release candidate tail drift")
            releases.pop()
        candidate_receipt_ids = list(journal.get("receiptIds", []))
        if current_receipt_digest == journal.get("candidateReceiptRegisterSha256"):
            if len(receipts) < len(candidate_receipt_ids) or sorted(
                row.get("receipt_id", "") for row in receipts[-len(candidate_receipt_ids):]
            ) != candidate_receipt_ids:
                raise ValueError("PREPARED Control receipt candidate tail drift")
            del receipts[-len(candidate_receipt_ids):]
        prior_release_content = csv_bytes(RELEASE_HEADER, releases)
        prior_receipt_content = csv_bytes(RECEIPT_HEADER, receipts)
        if (
            sha256_bytes(prior_release_content) != journal.get("priorReleaseRegisterSha256")
            or sha256_bytes(prior_receipt_content) != journal.get("priorReceiptRegisterSha256")
        ):
            raise ValueError("PREPARED Control delivery preimage reconstruction drift")
        prior_state = journal["priorState"]
        if action == "rollback":
            replace_bytes(RELEASES, prior_release_content)
            replace_bytes(RECEIPTS, prior_receipt_content)
            replace_bytes(STATE, json_bytes(prior_state))
            return {
                "schema": "dwp.hris.g3.control-delivery-recovery-result.v1",
                "status": "PASS", "action": "ROLLBACK",
                "transactionSeq": prior_state.get("transactionSeq"),
            }
        assert_authoritative_gate_open_during_prepared_transaction(
            "G3_CONTROL_DELIVERY", journal
        )
        candidate_releases, candidate_receipts, _release, _receipts = candidate_from_bundle(
            bundle, releases, receipts
        )
        release_content = csv_bytes(RELEASE_HEADER, candidate_releases)
        receipt_content = csv_bytes(RECEIPT_HEADER, candidate_receipts)
        if (
            sha256_bytes(release_content) != journal.get("candidateReleaseRegisterSha256")
            or sha256_bytes(receipt_content) != journal.get("candidateReceiptRegisterSha256")
        ):
            raise ValueError("PREPARED Control delivery deterministic candidate drift")
        assert_authoritative_gate_open_during_prepared_transaction(
            "G3_CONTROL_DELIVERY", journal
        )
        replace_bytes(RELEASES, release_content)
        replace_bytes(RECEIPTS, receipt_content)
        replace_bytes(STATE, json_bytes(finish_state(journal)))
        return {
            "schema": "dwp.hris.g3.control-delivery-recovery-result.v1",
            "status": "PASS", "action": "COMMIT",
            "transactionSeq": journal.get("transactionSeq"),
        }


def self_test() -> dict[str, object]:
    import inspect
    from unittest import mock

    cases: dict[str, bool] = {}
    first = {
        "sequence": "CONTROL_ASSIGNS_AT_APPEND",
        "identifier": "ID-1",
        "recorded_at": "2026-09-11T00:00:01Z",
    }
    allocated = allocate_rows([], [first], id_field="identifier", seq_field="sequence")
    cases["single-control-sequence-allocation"] = allocated[0]["sequence"] == "1"
    for label, row in (
        ("replayed-id-rejected", first),
        ("stale-time-rejected", dict(first, identifier="ID-2", recorded_at="2026-09-11T00:00:00Z")),
        ("preassigned-sequence-rejected", dict(first, identifier="ID-3", sequence="3", recorded_at="2026-09-11T00:00:03Z")),
    ):
        try:
            allocate_rows(allocated, [row], id_field="identifier", seq_field="sequence")
            cases[label] = False
        except ValueError:
            cases[label] = True
    cases["current-committed-marker-valid"] = bool(committed_state())
    source = inspect.getsource(append_batch)
    positions = [
        source.find("exclusive_host_semaphore("), source.find("assert_current_gate_open()"),
        source.find("stable_input_row("), source.find("candidate_from_bundle("),
        source.find("replace_bytes(STATE, json_bytes(journal))"),
        source.find("assert_authoritative_gate_open_during_prepared_transaction("),
        source.find("replace_bytes(RELEASES, release_content)"),
        source.find("replace_bytes(RECEIPTS, receipt_content)"),
        source.find("replace_bytes(STATE, json_bytes(finish_state(journal)))"),
    ]
    cases["lock-gate-input-validation-journal-pre-cas-gate-order"] = (
        all(value >= 0 for value in positions) and positions == sorted(positions)
    )
    replacement = inspect.getsource(replace_bytes)
    cases["register-and-marker-replace-file-parent-fsync"] = (
        "os.fsync(handle.fileno())" in replacement and "fsync_parent(path)" in replacement
    )
    cases["ordinary-failure-restores-release-receipt-and-state"] = (
        "restore_transaction(old_release, old_receipt, old_state)" in source
    )
    recovery = inspect.getsource(recover)
    cases["explicit-prior-candidate-commit-rollback-recovery"] = (
        "neither preimage nor candidate" in recovery
        and 'action == "rollback"' in recovery
        and "deterministic candidate drift" in recovery
    )
    cases["prepared-commit-uses-retained-lock-gate-seal-only"] = (
        source.count(
            "assert_authoritative_gate_open_during_prepared_transaction("
        )
        == 1
        and recovery.count(
            "assert_authoritative_gate_open_during_prepared_transaction("
        )
        == 2
        and "assert_current_gate_open()" not in recovery
        and '"G3_CONTROL_DELIVERY", journal' in source
        and '"G3_CONTROL_DELIVERY", journal' in recovery
    )
    cases["baseline-sync-transition-is-validator-enforced"] = (
        "validate_data(" in inspect.getsource(candidate_from_bundle)
    )
    with tempfile.TemporaryDirectory(prefix="g3-delivery-selftest-") as temporary:
        path = Path(temporary) / "state.json"
        path.write_bytes(b"old\n")
        replace_bytes(path, b"new\n")
        cases["atomic-replace-exact-bytes"] = path.read_bytes() == b"new\n"
    with tempfile.TemporaryDirectory(prefix="g3-delivery-bundle-resume-") as temporary:
        fixture_g0 = Path(temporary) / "g0"
        release = {field: "" for field in RELEASE_HEADER}
        release.update(
            release_id="REL-SELF-001",
            release_seq="CONTROL_ASSIGNS_AT_APPEND",
        )
        receipt = {field: "" for field in RECEIPT_HEADER}
        receipt.update(
            receipt_id="RCP-SELF-001",
            receipt_seq="CONTROL_ASSIGNS_AT_APPEND",
        )
        original_write = write_new_file
        write_count = 0

        class SimulatedProcessKill(BaseException):
            pass

        def kill_after_second_durable_file(target: Path, content: bytes) -> None:
            nonlocal write_count
            original_write(target, content)
            write_count += 1
            if write_count == 2:
                raise SimulatedProcessKill()

        with mock.patch(f"{__name__}.G0", fixture_g0):
            try:
                with mock.patch(
                    f"{__name__}.write_new_file",
                    side_effect=kill_after_second_durable_file,
                ):
                    immutable_bundle(release, [receipt])
                killed = False
            except SimulatedProcessKill:
                killed = True
            partial_root = bundle_root(release["release_id"])
            partial_files = sorted(
                value.relative_to(partial_root).as_posix()
                for value in partial_root.rglob("*")
                if value.is_file()
            )
            manifest_path = immutable_bundle(release, [receipt])
            replay_release, replay_receipts = load_bundle(manifest_path)
            cases["kth-file-process-kill-resumes-exact-partial-bundle"] = (
                killed
                and len(partial_files) == 2
                and "bundle-manifest.json" not in partial_files
                and replay_release == release
                and replay_receipts == [receipt]
            )
            different = dict(release, producer_checkpoint_id="G3-DIFFERENT")
            try:
                immutable_bundle(different, [receipt])
                cases["partial-or-committed-id-byte-reuse-rejected"] = False
            except ValueError:
                cases["partial-or-committed-id-byte-reuse-rejected"] = True
    status = "PASS" if all(cases.values()) else "FAIL"
    return {
        "schema": "dwp.hris.g3.control-delivery-cas-self-test.v2",
        "status": status,
        "caseCount": len(cases), "passedCount": sum(cases.values()), "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--release-row", type=Path)
    parser.add_argument("--receipt-row", type=Path, action="append", default=[])
    parser.add_argument("--recover", choices=("commit", "rollback"))
    parser.add_argument("--self-test", action="store_true")
    arguments = parser.parse_args()
    if sum((arguments.release_row is not None, bool(arguments.recover), arguments.self_test)) != 1:
        parser.error("choose exactly one of --release-row, --recover, or --self-test")
    try:
        if arguments.self_test:
            result = self_test()
        elif arguments.recover:
            result = recover(arguments.recover)
        else:
            result = append_batch(arguments.release_row.absolute(), arguments.receipt_row)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result.get("status") == "PASS" else 1
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError, SemaphoreTimeoutError) as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
