#!/usr/bin/env python3
"""Fail-closed promotion of one qualified modern canonical/physical bundle.

This writer deliberately treats promotion as a Control transaction, not as a
sequence of convenient file copies.  The immutable request captures every
source identity and every destination preimage.  The writer stages and backs
up on the destination filesystem, publishes a PREPARED/COMMITTING journal while
holding the common host semaphore, and uses compare-and-swap checks immediately
before every rename.  A crash is recovered either by exact rollback or, only
after the immutable receipt is already present and every destination is the
accepted successor, by finalizing the commit.

POSIX cannot atomically rename sixteen independent pathnames.  Therefore the
no-mixed-generation contract has two required parts: all supported readers use
``hris-verification`` and the central transaction fence rejects PREPARED or
COMMITTING journals.  Independent acceptance must attest reader-fence coverage;
the tool refuses a promotion request without that attestation.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import stat
import sys
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator


ROOT = Path(__file__).resolve().parent.parent
CODING = ROOT / "coding-readiness"
G0 = ROOT / "g0"
REPORTS = CODING / "reports"
JOURNAL = G0 / "modern-successor-promotion-transaction-state.json"

if str(G0) not in sys.path:
    sys.path.insert(0, str(G0))

from host_semaphore import (  # noqa: E402
    HOST_VERIFICATION_SEMAPHORE,
    active_host_semaphore_capability,
    exclusive_host_semaphore,
)


CANONICAL_FILES = (
    "modern-capability-closed-set-manifest.v3.json",
    "sys-listening-stream-authority-successor.v2.json",
    "modern-capability-operation-causal-contract-ssot.v2.json",
    "modern-capability-exact-schema-contracts.v1.json",
    "modern-capability-event-payload-contracts.v1.json",
    "modern-capability-semantic-bindings.v1.json",
    "modern-capability-public-identity-registry.v1.json",
    "modern-capability-causal-state-contracts.v2.json",
)
PHYSICAL_FILES = (
    "hrm-modern-forward-ddl.v4.sql",
    "per-modern-forward-ddl.v4.sql",
    "tim-modern-forward-ddl.v4.sql",
    "sys-auth-modern-forward-ddl.v4.sql",
    "sys-platform-modern-forward-ddl.v4.sql",
    "modern-owner-handler-physical-contracts.v4.json",
    "modern-query-projection-physical-contracts.v4.json",
    "physical-candidate-generation-report.v4.json",
)
PHYSICAL_PAYLOAD_FILES = tuple(
    name for name in PHYSICAL_FILES if name != "physical-candidate-generation-report.v4.json"
)

SPEC_SCHEMA = "dwp.hris.modern-successor-promotion-spec.v1"
ACCEPTANCE_SCHEMA = "dwp.hris.modern-successor-bundle-independent-acceptance.v1"
JOURNAL_SCHEMA = "dwp.hris.modern-successor-promotion-transaction-state.v1"
RECEIPT_SCHEMA = "dwp.hris.modern-successor-promotion-receipt.v1"
PREFLIGHT_SCHEMA = "dwp.hris.modern-successor-promotion-preflight.v1"
SEAL_METHOD = "SHA256_OF_UTF8_JSON_SORT_KEYS_COMPACT_EXCLUDING_sealedPayloadSha256"
TRANSACTION_ID = re.compile(r"MODERN-SUCCESSOR-[A-Z0-9][A-Z0-9-]{7,95}")
SHA256 = re.compile(r"[0-9a-f]{64}")

REQUIRED_ACCEPTANCE_CHECKS = {
    "canonicalStatic": "PASS",
    "canonicalHostile": "PASS",
    "physicalStatic": "PASS",
    "postgresql16": "PASS",
    "postgresql18": "PASS",
    "normalizedEquality": "PASS",
    "candidateSourceStability": "PASS",
    "readerFenceCoverage": "PASS",
    "controlJournalRecovery": "PASS",
}

IDENTITY_FIELDS = {
    "state",
    "device",
    "inode",
    "mode",
    "uid",
    "gid",
    "size",
    "mtimeNs",
    "ctimeNs",
    "sha256",
}
ABSENT_IDENTITY = {"state": "ABSENT"}

SPEC_FIELDS = {
    "schema",
    "transactionId",
    "status",
    "productionState",
    "generatedAt",
    "rootIdentity",
    "canonicalCandidateDirectory",
    "physicalCandidateDirectory",
    "acceptanceEvidence",
    "promotionReportPath",
    "items",
    "sealCanonicalization",
    "sealedPayloadSha256",
}
ITEM_FIELDS = {
    "bundle",
    "sourcePath",
    "destinationPath",
    "sourceIdentity",
    "destinationPrecondition",
}
EVIDENCE_REF_FIELDS = {"path", "fileSha256", "sealedPayloadSha256"}
READER_FENCE_AUDIT_SCHEMA = (
    "dwp.hris.modern-successor-reader-fence-independent-audit.v1"
)
READER_INVENTORY_PATH = (
    "coding-readiness/modern-successor-supported-reader-inventory.v5.json"
)
READER_INVENTORY_SCHEMA = "dwp.hris.modern-successor-supported-reader-inventory.v5"
READER_INVENTORY_PREDECESSOR = {
    "path": "coding-readiness/modern-successor-supported-reader-inventory.v4.json",
    "fileSha256": "40d272662a574e67f16779580822d6c68ce2ceb39868825a96f19a15d58eb08c",
    "sealedPayloadSha256": "6d54e432c4c069338087eb9a944e7ba04da2b7ed3e587eca7a1612bab696b5dd",
    "disposition": "IMMUTABLE_SELF_SEALED_PREDECESSOR_SUPERSEDED_BY_V5_REFRESH",
}

JOURNAL_FIELDS = {
    "schema",
    "transactionId",
    "specPath",
    "specSha256",
    "phase",
    "status",
    "transactionDirectory",
    "promotionReportPath",
    "preparedAt",
    "updatedAt",
    "nextDestination",
    "installedDestinations",
    "receiptSha256",
    "priorJournalSha256",
}


class PromotionError(ValueError):
    """A fail-closed promotion or recovery refusal."""


class InjectedCrash(BaseException):
    """Self-test-only asynchronous crash model; ordinary rollback is skipped."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace(
        "+00:00", "Z"
    )


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json_bytes(payload: object, *, pretty: bool = True) -> bytes:
    options: dict[str, object] = {
        "ensure_ascii": False,
        "sort_keys": True,
    }
    if pretty:
        options["indent"] = 2
    else:
        options["separators"] = (",", ":")
    return (json.dumps(payload, **options) + ("\n" if pretty else "")).encode("utf-8")


def sealed_payload_sha256(payload: dict[str, object]) -> str:
    body = copy.deepcopy(payload)
    body.pop("sealedPayloadSha256", None)
    return sha256_bytes(canonical_json_bytes(body, pretty=False))


def seal_payload(payload: dict[str, object]) -> dict[str, object]:
    result = copy.deepcopy(payload)
    result["sealedPayloadSha256"] = sealed_payload_sha256(result)
    return result


def self_seal_errors(payload: object, label: str) -> list[str]:
    if not isinstance(payload, dict):
        return [f"{label}: JSON root is not an object"]
    observed = payload.get("sealedPayloadSha256")
    if not isinstance(observed, str) or not SHA256.fullmatch(observed):
        return [f"{label}: missing or malformed sealedPayloadSha256"]
    expected = sealed_payload_sha256(payload)
    return [] if observed == expected else [f"{label}: self-seal mismatch"]


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_CLOEXEC", 0))
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def atomic_write(path: Path, data: bytes, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        os.fchmod(descriptor, mode)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        fsync_directory(path.parent)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def create_new(path: Path, data: bytes, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_CLOEXEC", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags, mode)
    except FileExistsError as error:
        raise PromotionError(f"immutable output already exists: {path}") from error
    try:
        os.fchmod(descriptor, mode)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        try:
            path.unlink()
        except OSError:
            pass
        raise
    fsync_directory(path.parent)


def relative_path(path: Path, root: Path) -> str:
    try:
        return path.absolute().relative_to(root.absolute()).as_posix()
    except ValueError as error:
        raise PromotionError(f"path escapes blueprint root: {path}") from error


def rooted(root: Path, value: object, label: str) -> Path:
    if not isinstance(value, str) or not value or value.startswith("/"):
        raise PromotionError(f"{label}: root-relative path required")
    pieces = Path(value).parts
    if any(piece in {"", ".", ".."} for piece in pieces):
        raise PromotionError(f"{label}: unsafe relative path")
    path = root.joinpath(*pieces)
    relative_path(path, root)
    return path


def assert_secure_ancestors(path: Path, root: Path, *, include_leaf: bool = False) -> None:
    relative = Path(relative_path(path, root))
    current = root
    root_stat = current.lstat()
    if not stat.S_ISDIR(root_stat.st_mode) or stat.S_ISLNK(root_stat.st_mode):
        raise PromotionError(f"unsafe blueprint root: {root}")
    stop = len(relative.parts) if include_leaf else max(0, len(relative.parts) - 1)
    for piece in relative.parts[:stop]:
        current = current / piece
        metadata = current.lstat()
        if not stat.S_ISDIR(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
            raise PromotionError(f"unsafe path ancestor: {current}")


def _stat_identity(metadata: os.stat_result, digest: str) -> dict[str, object]:
    return {
        "state": "PRESENT",
        "device": metadata.st_dev,
        "inode": metadata.st_ino,
        "mode": stat.S_IMODE(metadata.st_mode),
        "uid": metadata.st_uid,
        "gid": metadata.st_gid,
        "size": metadata.st_size,
        "mtimeNs": metadata.st_mtime_ns,
        "ctimeNs": metadata.st_ctime_ns,
        "sha256": digest,
    }


def snapshot_file(path: Path, root: Path) -> tuple[dict[str, object], bytes]:
    assert_secure_ancestors(path, root)
    try:
        path_before = path.lstat()
    except FileNotFoundError as error:
        raise PromotionError(f"required file missing: {path}") from error
    if not stat.S_ISREG(path_before.st_mode) or stat.S_ISLNK(path_before.st_mode):
        raise PromotionError(f"unsafe non-regular file: {path}")
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags)
    try:
        descriptor_before = os.fstat(descriptor)
        if (path_before.st_dev, path_before.st_ino) != (
            descriptor_before.st_dev,
            descriptor_before.st_ino,
        ):
            raise PromotionError(f"path rebound before read: {path}")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        descriptor_after = os.fstat(descriptor)
    finally:
        os.close(descriptor)
    path_after = path.lstat()
    stable_fields = (
        "st_dev",
        "st_ino",
        "st_mode",
        "st_uid",
        "st_gid",
        "st_size",
        "st_mtime_ns",
        "st_ctime_ns",
    )
    if any(
        getattr(descriptor_before, field) != getattr(descriptor_after, field)
        or getattr(descriptor_before, field) != getattr(path_after, field)
        for field in stable_fields
    ):
        raise PromotionError(f"file changed during stable read: {path}")
    data = b"".join(chunks)
    return _stat_identity(descriptor_after, sha256_bytes(data)), data


def snapshot_optional(path: Path, root: Path) -> tuple[dict[str, object], bytes | None]:
    try:
        return snapshot_file(path, root)
    except PromotionError as error:
        try:
            path.lstat()
        except FileNotFoundError:
            assert_secure_ancestors(path, root)
            return dict(ABSENT_IDENTITY), None
        raise error


def identity_errors(expected: object, observed: dict[str, object], label: str) -> list[str]:
    if not isinstance(expected, dict):
        return [f"{label}: identity is not an object"]
    if expected.get("state") == "ABSENT":
        if set(expected) != {"state"}:
            return [f"{label}: ABSENT identity field-set drift"]
    elif set(expected) != IDENTITY_FIELDS:
        return [f"{label}: PRESENT identity field-set drift"]
    return [] if expected == observed else [f"{label}: compare-and-swap identity mismatch"]


def parse_json(data: bytes, label: str) -> dict[str, object]:
    try:
        payload = json.loads(data)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PromotionError(f"{label}: invalid JSON: {error}") from error
    if not isinstance(payload, dict):
        raise PromotionError(f"{label}: JSON root is not an object")
    return payload


def exact_directory_files(directory: Path, expected: tuple[str, ...], root: Path) -> None:
    assert_secure_ancestors(directory, root, include_leaf=True)
    observed = {entry.name for entry in directory.iterdir()}
    if observed != set(expected):
        missing = sorted(set(expected) - observed)
        extra = sorted(observed - set(expected))
        raise PromotionError(
            f"{directory}: exact bundle drift missing={missing} extra={extra}"
        )
    for name in expected:
        snapshot_file(directory / name, root)


def expected_destinations(root: Path) -> dict[tuple[str, str], Path]:
    mapping: dict[tuple[str, str], Path] = {}
    for name in CANONICAL_FILES:
        mapping[("CANONICAL", name)] = root / "coding-readiness" / name
    for name in PHYSICAL_FILES:
        mapping[("PHYSICAL", name)] = (
            root / "coding-readiness" / "modern-physical-successor" / name
        )
    return mapping


def _candidate_directories(
    root: Path, canonical_value: object, physical_value: object
) -> tuple[Path, Path]:
    canonical = rooted(root, canonical_value, "canonicalCandidateDirectory")
    physical = rooted(root, physical_value, "physicalCandidateDirectory")
    if canonical.parent != root / "coding-readiness" or not canonical.name.startswith(
        "modern-canonical-candidate."
    ):
        raise PromotionError("canonical candidate directory allocation drift")
    if physical.parent != root / "coding-readiness" or not physical.name.startswith(
        "modern-physical-candidate."
    ):
        raise PromotionError("physical candidate directory allocation drift")
    exact_directory_files(canonical, CANONICAL_FILES, root)
    exact_directory_files(physical, PHYSICAL_FILES, root)
    return canonical, physical


def validate_physical_generation_report(
    root: Path, canonical: Path, physical: Path
) -> None:
    canonical_hashes = {
        name: snapshot_file(canonical / name, root)[0]["sha256"]
        for name in CANONICAL_FILES
    }
    physical_hashes = {
        name: snapshot_file(physical / name, root)[0]["sha256"]
        for name in PHYSICAL_PAYLOAD_FILES
    }
    report_path = physical / "physical-candidate-generation-report.v4.json"
    _identity, report_bytes = snapshot_file(report_path, root)
    report = parse_json(report_bytes, str(report_path))
    errors = self_seal_errors(report, str(report_path))
    source = report.get("sourceCanonical")
    if not isinstance(source, dict):
        errors.append("physical generation report lacks sourceCanonical")
    else:
        if source.get("directory") != canonical.name:
            errors.append("physical generation report canonical directory mismatch")
        if source.get("fileSha256") != canonical_hashes:
            errors.append("physical generation report canonical hash map mismatch")
    outputs = report.get("outputFiles")
    if not isinstance(outputs, dict) or set(outputs) != set(PHYSICAL_PAYLOAD_FILES):
        errors.append("physical generation report output file set mismatch")
    else:
        for name, digest in physical_hashes.items():
            entry = outputs.get(name)
            if not isinstance(entry, dict) or entry.get("sha256") != digest:
                errors.append(f"physical generation report output hash mismatch: {name}")
    if report.get("status") != "PASS_CANDIDATE_NOT_G3_AUTHORITY":
        errors.append("physical generation report status is not candidate PASS")
    if report.get("productionState") != "NOT_AUTHORIZED_G6":
        errors.append("physical generation report claims unexpected production state")
    if errors:
        raise PromotionError("; ".join(sorted(set(errors))))


def validate_candidate_json_seals(root: Path, directories: tuple[Path, Path]) -> None:
    errors: list[str] = []
    sealed_count = 0
    for directory in directories:
        for path in sorted(directory.glob("*.json")):
            _identity, data = snapshot_file(path, root)
            payload = parse_json(data, str(path))
            if "sealedPayloadSha256" in payload:
                sealed_count += 1
                errors.extend(self_seal_errors(payload, str(path)))
    if sealed_count < 8:
        errors.append("qualified bundle has fewer than eight self-sealed JSON artifacts")
    if errors:
        raise PromotionError("; ".join(sorted(set(errors))))


def acceptance_errors(
    payload: dict[str, object],
    *,
    root: Path,
    canonical: Path,
    physical: Path,
) -> list[str]:
    errors = self_seal_errors(payload, "acceptance evidence")
    if payload.get("schema") != ACCEPTANCE_SCHEMA:
        errors.append("acceptance evidence schema drift")
    if payload.get("status") != "PASS":
        errors.append("acceptance evidence status is not PASS")
    if payload.get("verdict") != "QUALIFIED_FOR_ATOMIC_LIVE_PROMOTION_ONLY":
        errors.append("acceptance evidence verdict does not qualify atomic promotion")
    if payload.get("reviewerIndependence") != "INDEPENDENT_OF_CANDIDATE_AUTHOR":
        errors.append("acceptance evidence lacks reviewer independence")
    if payload.get("productionState") != "NOT_AUTHORIZED_G6":
        errors.append("acceptance evidence production state drift")
    if payload.get("canonicalCandidateDirectory") != relative_path(canonical, root):
        errors.append("acceptance canonical candidate path mismatch")
    if payload.get("physicalCandidateDirectory") != relative_path(physical, root):
        errors.append("acceptance physical candidate path mismatch")
    checks = payload.get("checks")
    if checks != REQUIRED_ACCEPTANCE_CHECKS:
        errors.append("acceptance evidence exact check set/status drift")
    expected_canonical = {
        name: snapshot_file(canonical / name, root)[0]["sha256"]
        for name in CANONICAL_FILES
    }
    expected_physical = {
        name: snapshot_file(physical / name, root)[0]["sha256"]
        for name in PHYSICAL_FILES
    }
    if payload.get("canonicalFileSha256") != expected_canonical:
        errors.append("acceptance canonical hash map mismatch")
    if payload.get("physicalFileSha256") != expected_physical:
        errors.append("acceptance physical hash map mismatch")
    reader_ref = payload.get("readerFenceCoverageEvidence")
    if not isinstance(reader_ref, dict) or set(reader_ref) != EVIDENCE_REF_FIELDS:
        errors.append("acceptance reader-fence evidence reference drift")
    else:
        try:
            reader_path = rooted(
                root,
                reader_ref.get("path"),
                "readerFenceCoverageEvidence.path",
            )
            if reader_path.parent != root / "coding-readiness" / "reports":
                raise PromotionError("reader-fence audit is not a direct immutable report")
            reader_identity, reader_raw = snapshot_file(reader_path, root)
            reader_audit = parse_json(reader_raw, str(reader_path))
            if reader_identity.get("sha256") != reader_ref.get("fileSha256"):
                errors.append("reader-fence audit file hash mismatch")
            if reader_audit.get("sealedPayloadSha256") != reader_ref.get(
                "sealedPayloadSha256"
            ):
                errors.append("reader-fence audit seal reference mismatch")
            errors.extend(self_seal_errors(reader_audit, "reader-fence audit"))
            if reader_audit.get("schema") != READER_FENCE_AUDIT_SCHEMA:
                errors.append("reader-fence independent audit schema drift")
            if reader_audit.get("status") != "PASS":
                errors.append("reader-fence independent audit did not PASS")
            if reader_audit.get("verdict") != "READER_FENCE_COVERAGE_CONFIRMED":
                errors.append("reader-fence independent audit verdict drift")
            if reader_audit.get("reviewerIndependence") != "INDEPENDENT_OF_REPAIR_AUTHOR":
                errors.append("reader-fence audit lacks independent reviewer declaration")
            inventory_path = root / READER_INVENTORY_PATH
            inventory_identity, inventory_raw = snapshot_file(inventory_path, root)
            inventory = parse_json(inventory_raw, str(inventory_path))
            errors.extend(self_seal_errors(inventory, "reader inventory"))
            if inventory.get("schema") != READER_INVENTORY_SCHEMA:
                errors.append("reader inventory schema drift")
            if inventory.get("predecessorInventory") != READER_INVENTORY_PREDECESSOR:
                errors.append("reader inventory predecessor pin drift")
            inventory_pin = reader_audit.get("readerInventory")
            if inventory_pin != {
                "path": READER_INVENTORY_PATH,
                "fileSha256": inventory_identity["sha256"],
                "sealedPayloadSha256": inventory.get("sealedPayloadSha256"),
            }:
                errors.append("reader-fence audit inventory pin drift")
            if reader_audit.get("checks") != {
                "exactActiveInventory": "PASS",
                "directEntrypointGuarding": "PASS",
                "nonterminalWriterDeathBlocking": "PASS",
                "malformedJournalBlocking": "PASS",
                "sharedReaderExclusiveWriterExclusion": "PASS",
                "terminalAndAbsentAdmission": "PASS",
                "physicalBundleCountEight": "PASS",
            }:
                errors.append("reader-fence independent audit exact check set drift")
        except (OSError, PromotionError) as error:
            errors.append(f"reader-fence independent audit unavailable: {error}")
    return sorted(set(errors))


def load_acceptance(
    root: Path,
    evidence_ref: object,
    canonical: Path,
    physical: Path,
) -> tuple[Path, dict[str, object], dict[str, object]]:
    if not isinstance(evidence_ref, dict) or set(evidence_ref) != EVIDENCE_REF_FIELDS:
        raise PromotionError("acceptance evidence reference field-set drift")
    evidence_path = rooted(root, evidence_ref.get("path"), "acceptanceEvidence.path")
    if evidence_path.parent != root / "coding-readiness" / "reports":
        raise PromotionError("acceptance evidence must be a direct immutable report")
    identity, data = snapshot_file(evidence_path, root)
    if identity["sha256"] != evidence_ref.get("fileSha256"):
        raise PromotionError("acceptance evidence file hash mismatch")
    payload = parse_json(data, str(evidence_path))
    if payload.get("sealedPayloadSha256") != evidence_ref.get("sealedPayloadSha256"):
        raise PromotionError("acceptance evidence seal reference mismatch")
    errors = acceptance_errors(
        payload, root=root, canonical=canonical, physical=physical
    )
    if errors:
        raise PromotionError("; ".join(errors))
    return evidence_path, identity, payload


def gate_closed_errors(root: Path) -> list[str]:
    path = root / "g0" / "current-g3-gate-decision.json"
    try:
        _identity, data = snapshot_file(path, root)
        payload = parse_json(data, str(path))
    except (OSError, PromotionError) as error:
        return [f"Gate decision unavailable: {error}"]
    errors: list[str] = []
    if payload.get("schema") != "dwp.hris.current-g3-gate-decision.v1":
        errors.append("Gate decision schema drift")
    if payload.get("effectiveGate") != "CLOSED_FAIL_SAFE":
        errors.append("bundle promotion requires CLOSED_FAIL_SAFE")
    if payload.get("currentState") != "VALIDATOR_CONTROLLED_BLOCKED":
        errors.append("bundle promotion requires validator-controlled blocked state")
    if payload.get("productionActivation") != "NOT_AUTHORIZED_G6":
        errors.append("bundle promotion cannot confer production activation")
    return errors


def _root_identity(root: Path) -> dict[str, int]:
    metadata = root.lstat()
    if not stat.S_ISDIR(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
        raise PromotionError("unsafe blueprint root")
    return {"device": metadata.st_dev, "inode": metadata.st_ino}


def _report_path_allowed(path: Path, root: Path, label: str) -> None:
    if path.parent != root / "coding-readiness" / "reports" or path.suffix != ".json":
        raise PromotionError(f"{label} must be a direct JSON file in coding-readiness/reports")
    assert_secure_ancestors(path, root)


def build_spec(
    *,
    root: Path,
    canonical_candidate: Path,
    physical_candidate: Path,
    acceptance_evidence: Path,
    promotion_report: Path,
    transaction_id: str,
) -> dict[str, object]:
    if not TRANSACTION_ID.fullmatch(transaction_id):
        raise PromotionError("transaction id format drift")
    _report_path_allowed(acceptance_evidence, root, "acceptance evidence")
    _report_path_allowed(promotion_report, root, "promotion report")
    if promotion_report.exists() or promotion_report.is_symlink():
        raise PromotionError("promotion report must be create-new")
    canonical, physical = _candidate_directories(
        root,
        relative_path(canonical_candidate, root),
        relative_path(physical_candidate, root),
    )
    validate_candidate_json_seals(root, (canonical, physical))
    validate_physical_generation_report(root, canonical, physical)
    evidence_identity, evidence_data = snapshot_file(acceptance_evidence, root)
    evidence_payload = parse_json(evidence_data, str(acceptance_evidence))
    errors = acceptance_errors(
        evidence_payload, root=root, canonical=canonical, physical=physical
    )
    if errors:
        raise PromotionError("; ".join(errors))
    destinations = expected_destinations(root)
    items: list[dict[str, object]] = []
    for bundle, directory, names in (
        ("CANONICAL", canonical, CANONICAL_FILES),
        ("PHYSICAL", physical, PHYSICAL_FILES),
    ):
        for name in names:
            source = directory / name
            destination = destinations[(bundle, name)]
            source_identity, _data = snapshot_file(source, root)
            destination_identity, _prior = snapshot_optional(destination, root)
            items.append(
                {
                    "bundle": bundle,
                    "sourcePath": relative_path(source, root),
                    "destinationPath": relative_path(destination, root),
                    "sourceIdentity": source_identity,
                    "destinationPrecondition": destination_identity,
                }
            )
    return seal_payload(
        {
            "schema": SPEC_SCHEMA,
            "transactionId": transaction_id,
            "status": "QUALIFIED_CANDIDATE_PROMOTION_REQUEST",
            "productionState": "NOT_AUTHORIZED_G6",
            "generatedAt": utc_now(),
            "rootIdentity": _root_identity(root),
            "canonicalCandidateDirectory": relative_path(canonical, root),
            "physicalCandidateDirectory": relative_path(physical, root),
            "acceptanceEvidence": {
                "path": relative_path(acceptance_evidence, root),
                "fileSha256": evidence_identity["sha256"],
                "sealedPayloadSha256": evidence_payload["sealedPayloadSha256"],
            },
            "promotionReportPath": relative_path(promotion_report, root),
            "items": items,
            "sealCanonicalization": SEAL_METHOD,
        }
    )


def write_spec(path: Path, payload: dict[str, object], root: Path) -> None:
    _report_path_allowed(path, root, "promotion spec")
    create_new(path, canonical_json_bytes(payload), 0o600)


def validate_spec(
    *,
    root: Path,
    spec_path: Path,
    require_destination_preconditions: bool = True,
) -> tuple[dict[str, object], dict[str, object]]:
    _report_path_allowed(spec_path, root, "promotion spec")
    spec_identity, spec_data = snapshot_file(spec_path, root)
    spec = parse_json(spec_data, str(spec_path))
    errors = self_seal_errors(spec, "promotion spec")
    if set(spec) != SPEC_FIELDS:
        errors.append("promotion spec field-set drift")
    if spec.get("schema") != SPEC_SCHEMA:
        errors.append("promotion spec schema drift")
    if spec.get("status") != "QUALIFIED_CANDIDATE_PROMOTION_REQUEST":
        errors.append("promotion spec status drift")
    if spec.get("productionState") != "NOT_AUTHORIZED_G6":
        errors.append("promotion spec production state drift")
    if spec.get("sealCanonicalization") != SEAL_METHOD:
        errors.append("promotion spec seal method drift")
    transaction_id = spec.get("transactionId")
    if not isinstance(transaction_id, str) or not TRANSACTION_ID.fullmatch(transaction_id):
        errors.append("promotion transaction id drift")
    if spec.get("rootIdentity") != _root_identity(root):
        errors.append("promotion spec blueprint-root identity mismatch")
    if errors:
        raise PromotionError("; ".join(sorted(set(errors))))
    canonical, physical = _candidate_directories(
        root,
        spec.get("canonicalCandidateDirectory"),
        spec.get("physicalCandidateDirectory"),
    )
    validate_candidate_json_seals(root, (canonical, physical))
    validate_physical_generation_report(root, canonical, physical)
    load_acceptance(root, spec.get("acceptanceEvidence"), canonical, physical)
    report_path = rooted(root, spec.get("promotionReportPath"), "promotionReportPath")
    _report_path_allowed(report_path, root, "promotion report")
    if report_path.exists() or report_path.is_symlink():
        raise PromotionError("promotion report path is not create-new")
    items = spec.get("items")
    if not isinstance(items, list) or len(items) != len(CANONICAL_FILES) + len(PHYSICAL_FILES):
        raise PromotionError("promotion spec item count drift")
    expected_map = expected_destinations(root)
    expected_pairs = [
        *(('CANONICAL', name) for name in CANONICAL_FILES),
        *(('PHYSICAL', name) for name in PHYSICAL_FILES),
    ]
    observed_pairs: list[tuple[str, str]] = []
    bundle_devices: set[int] = set()
    for index, item in enumerate(items):
        if not isinstance(item, dict) or set(item) != ITEM_FIELDS:
            raise PromotionError(f"promotion item {index}: field-set drift")
        bundle = item.get("bundle")
        source = rooted(root, item.get("sourcePath"), f"items[{index}].sourcePath")
        destination = rooted(
            root, item.get("destinationPath"), f"items[{index}].destinationPath"
        )
        name = source.name
        pair = (str(bundle), name)
        observed_pairs.append(pair)
        source_directory = canonical if bundle == "CANONICAL" else physical
        if pair not in expected_map or source != source_directory / name:
            raise PromotionError(f"promotion item {index}: source allocation drift")
        if destination != expected_map[pair]:
            raise PromotionError(f"promotion item {index}: destination allocation drift")
        source_identity, _data = snapshot_file(source, root)
        bundle_devices.add(int(source_identity["device"]))
        source_errors = identity_errors(
            item.get("sourceIdentity"), source_identity, f"items[{index}].sourceIdentity"
        )
        if source_errors:
            raise PromotionError("; ".join(source_errors))
        destination_identity, _prior = snapshot_optional(destination, root)
        if require_destination_preconditions:
            destination_errors = identity_errors(
                item.get("destinationPrecondition"),
                destination_identity,
                f"items[{index}].destinationPrecondition",
            )
            if destination_errors:
                raise PromotionError("; ".join(destination_errors))
        parent = destination.parent
        assert_secure_ancestors(parent, root, include_leaf=True)
        bundle_devices.add(parent.stat().st_dev)
    if observed_pairs != expected_pairs:
        raise PromotionError("promotion spec exact source/destination manifest order drift")
    transaction_parent = root / "coding-readiness"
    bundle_devices.add(transaction_parent.stat().st_dev)
    bundle_devices.add(report_path.parent.stat().st_dev)
    bundle_devices.add((root / "g0").stat().st_dev)
    if len(bundle_devices) != 1:
        raise PromotionError("staging, backup and destinations are not on one filesystem")
    return spec, spec_identity


def _journal_payload(
    *,
    spec: dict[str, object],
    spec_path: Path,
    spec_sha256: str,
    root: Path,
    phase: str,
    status: str,
    prepared_at: str,
    next_destination: str | None,
    installed: list[str],
    receipt_sha256: str | None,
    prior_journal_sha256: str | None,
) -> dict[str, object]:
    transaction_id = str(spec["transactionId"])
    return {
        "schema": JOURNAL_SCHEMA,
        "transactionId": transaction_id,
        "specPath": relative_path(spec_path, root),
        "specSha256": spec_sha256,
        "phase": phase,
        "status": status,
        "transactionDirectory": relative_path(
            root / "coding-readiness" / ".modern-successor-promotion" / transaction_id,
            root,
        ),
        "promotionReportPath": spec["promotionReportPath"],
        "preparedAt": prepared_at,
        "updatedAt": utc_now(),
        "nextDestination": next_destination,
        "installedDestinations": list(installed),
        "receiptSha256": receipt_sha256,
        "priorJournalSha256": prior_journal_sha256,
    }


def journal_errors(payload: object) -> list[str]:
    if not isinstance(payload, dict):
        return ["promotion journal root is not an object"]
    errors: list[str] = []
    if set(payload) != JOURNAL_FIELDS:
        errors.append("promotion journal field-set drift")
    if payload.get("schema") != JOURNAL_SCHEMA:
        errors.append("promotion journal schema drift")
    phase = payload.get("phase")
    status = payload.get("status")
    expected_status = {
        "PREPARED": "PROMOTION_TRANSACTION_PREPARED",
        "COMMITTING": "PROMOTION_TRANSACTION_COMMITTING",
        "FINALIZING": "PROMOTION_TRANSACTION_FINALIZING",
        "COMMITTED": "PROMOTION_TRANSACTION_COMMITTED",
        "ROLLED_BACK": "PROMOTION_TRANSACTION_ROLLED_BACK",
    }
    if expected_status.get(phase) != status:
        errors.append("promotion journal phase/status mismatch")
    transaction_id = payload.get("transactionId")
    if not isinstance(transaction_id, str) or not TRANSACTION_ID.fullmatch(transaction_id):
        errors.append("promotion journal transaction id drift")
    spec_sha = payload.get("specSha256")
    if not isinstance(spec_sha, str) or not SHA256.fullmatch(spec_sha):
        errors.append("promotion journal spec hash drift")
    installed = payload.get("installedDestinations")
    if not isinstance(installed, list) or any(not isinstance(value, str) for value in installed):
        errors.append("promotion journal installed destination list drift")
    elif len(installed) != len(set(installed)) or len(installed) > 16:
        errors.append("promotion journal installed destination cardinality drift")
    receipt_sha = payload.get("receiptSha256")
    if phase == "COMMITTED" and not (
        isinstance(receipt_sha, str) and SHA256.fullmatch(receipt_sha)
    ):
        errors.append("committed promotion journal receipt hash drift")
    if phase == "ROLLED_BACK" and receipt_sha is not None:
        errors.append("rolled-back promotion journal has a receipt hash")
    return sorted(set(errors))


def _read_journal_optional(root: Path) -> tuple[dict[str, object] | None, str | None]:
    path = root / "g0" / JOURNAL.name
    try:
        _identity, data = snapshot_file(path, root)
    except PromotionError:
        try:
            path.lstat()
        except FileNotFoundError:
            return None, None
        raise
    payload = parse_json(data, str(path))
    errors = journal_errors(payload)
    if errors:
        raise PromotionError("; ".join(errors))
    return payload, sha256_bytes(data)


def _assert_prior_journal_terminal(root: Path) -> str | None:
    payload, digest = _read_journal_optional(root)
    if payload is None:
        return None
    if payload.get("phase") not in {"COMMITTED", "ROLLED_BACK"}:
        raise PromotionError("an unfinished promotion journal requires recovery")
    return digest


def _write_journal(root: Path, payload: dict[str, object]) -> None:
    errors = journal_errors(payload)
    if errors:
        raise PromotionError("refusing invalid promotion journal: " + "; ".join(errors))
    atomic_write(root / "g0" / JOURNAL.name, canonical_json_bytes(payload), 0o600)


def _copy_exact(
    source: Path,
    destination: Path,
    *,
    root: Path,
    expected_identity: dict[str, object],
) -> None:
    identity, data = snapshot_file(source, root)
    errors = identity_errors(expected_identity, identity, str(source))
    if errors:
        raise PromotionError("; ".join(errors))
    create_new(destination, data, int(identity["mode"]))
    copied_identity, _copied = snapshot_file(destination, root)
    if copied_identity["sha256"] != identity["sha256"]:
        raise PromotionError(f"staged copy digest mismatch: {destination}")


def _transaction_paths(root: Path, transaction_id: str) -> tuple[Path, Path, Path]:
    transaction = root / "coding-readiness" / ".modern-successor-promotion" / transaction_id
    return transaction, transaction / "staged", transaction / "backup"


def _prepare_transaction_material(
    root: Path, spec: dict[str, object]
) -> tuple[Path, Path, Path]:
    transaction_id = str(spec["transactionId"])
    transaction, staged, backup = _transaction_paths(root, transaction_id)
    if transaction.exists() or transaction.is_symlink():
        raise PromotionError(f"transaction directory already exists: {transaction}")
    transaction_root = transaction.parent
    if not transaction_root.exists():
        transaction_root.mkdir(mode=0o700)
        fsync_directory(transaction_root.parent)
    root_metadata = transaction_root.lstat()
    if (
        not stat.S_ISDIR(root_metadata.st_mode)
        or stat.S_ISLNK(root_metadata.st_mode)
        or root_metadata.st_uid != os.getuid()
        or stat.S_IMODE(root_metadata.st_mode) & 0o077
    ):
        raise PromotionError(f"unsafe promotion transaction root: {transaction_root}")
    transaction.mkdir(mode=0o700)
    fsync_directory(transaction.parent)
    staged.mkdir(mode=0o700)
    backup.mkdir(mode=0o700)
    for index, item in enumerate(spec["items"]):
        assert isinstance(item, dict)
        source = rooted(root, item["sourcePath"], "transaction source")
        stage_file = staged / f"{index:02d}.payload"
        _copy_exact(
            source,
            stage_file,
            root=root,
            expected_identity=item["sourceIdentity"],
        )
        prior = item["destinationPrecondition"]
        if isinstance(prior, dict) and prior.get("state") == "PRESENT":
            destination = rooted(root, item["destinationPath"], "transaction destination")
            _copy_exact(
                destination,
                backup / f"{index:02d}.prior",
                root=root,
                expected_identity=prior,
            )
    manifest = seal_payload(
        {
            "schema": "dwp.hris.modern-successor-promotion-material.v1",
            "transactionId": transaction_id,
            "specSealedPayloadSha256": spec["sealedPayloadSha256"],
            "items": [
                {
                    "index": index,
                    "destinationPath": item["destinationPath"],
                    "stagedSha256": item["sourceIdentity"]["sha256"],
                    "backupSha256": (
                        item["destinationPrecondition"].get("sha256")
                        if isinstance(item["destinationPrecondition"], dict)
                        else None
                    ),
                }
                for index, item in enumerate(spec["items"])
            ],
        }
    )
    create_new(transaction / "material-manifest.json", canonical_json_bytes(manifest), 0o600)
    fsync_directory(staged)
    fsync_directory(backup)
    fsync_directory(transaction)
    return transaction, staged, backup


def _verify_candidate_sources(root: Path, spec: dict[str, object]) -> None:
    for index, item in enumerate(spec["items"]):
        assert isinstance(item, dict)
        source = rooted(root, item["sourcePath"], f"items[{index}].sourcePath")
        identity, _data = snapshot_file(source, root)
        errors = identity_errors(item["sourceIdentity"], identity, f"source {index}")
        if errors:
            raise PromotionError("; ".join(errors))


def _verify_destination_preimages(root: Path, spec: dict[str, object]) -> None:
    for index, item in enumerate(spec["items"]):
        assert isinstance(item, dict)
        destination = rooted(root, item["destinationPath"], f"destination {index}")
        identity, _data = snapshot_optional(destination, root)
        errors = identity_errors(
            item["destinationPrecondition"], identity, f"destination preimage {index}"
        )
        if errors:
            raise PromotionError("; ".join(errors))


def _all_destination_state(
    root: Path, spec: dict[str, object]
) -> tuple[list[str], list[str], list[str]]:
    prior: list[str] = []
    successor: list[str] = []
    foreign: list[str] = []
    for item in spec["items"]:
        assert isinstance(item, dict)
        destination = rooted(root, item["destinationPath"], "destination state")
        identity, _data = snapshot_optional(destination, root)
        predecessor = item["destinationPrecondition"]
        predecessor_equivalent = (
            isinstance(predecessor, dict)
            and (
                (predecessor.get("state") == "ABSENT" and identity == ABSENT_IDENTITY)
                or (
                    predecessor.get("state") == "PRESENT"
                    and identity.get("state") == "PRESENT"
                    and all(
                        identity.get(field) == predecessor.get(field)
                        for field in ("sha256", "size", "mode", "uid", "gid")
                    )
                )
            )
        )
        if predecessor_equivalent:
            prior.append(str(item["destinationPath"]))
        elif (
            identity.get("state") == "PRESENT"
            and identity.get("sha256") == item["sourceIdentity"].get("sha256")
            and identity.get("size") == item["sourceIdentity"].get("size")
        ):
            successor.append(str(item["destinationPath"]))
        else:
            foreign.append(str(item["destinationPath"]))
    return prior, successor, foreign


def _restore_prior(root: Path, spec: dict[str, object], backup: Path) -> None:
    prior, successor, foreign = _all_destination_state(root, spec)
    if foreign:
        raise PromotionError(
            "rollback refuses foreign destination generation: " + ",".join(foreign)
        )
    del prior
    for index in reversed(range(len(spec["items"]))):
        item = spec["items"][index]
        assert isinstance(item, dict)
        destination = rooted(root, item["destinationPath"], "rollback destination")
        current, _data = snapshot_optional(destination, root)
        if current == item["destinationPrecondition"]:
            continue
        if str(item["destinationPath"]) not in successor:
            raise PromotionError(f"rollback state changed after preflight: {destination}")
        predecessor = item["destinationPrecondition"]
        if isinstance(predecessor, dict) and predecessor.get("state") == "ABSENT":
            destination.unlink()
            fsync_directory(destination.parent)
        else:
            backup_path = backup / f"{index:02d}.prior"
            backup_identity, backup_data = snapshot_file(backup_path, root)
            if (
                backup_identity.get("sha256") != predecessor.get("sha256")
                or backup_identity.get("size") != predecessor.get("size")
            ):
                raise PromotionError(f"rollback backup mismatch: {backup_path}")
            descriptor, temporary = tempfile.mkstemp(
                prefix=f".{destination.name}.rollback.", dir=destination.parent
            )
            try:
                os.fchmod(descriptor, int(predecessor["mode"]))
                with os.fdopen(descriptor, "wb") as handle:
                    handle.write(backup_data)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary, destination)
                fsync_directory(destination.parent)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)
    final_prior, final_successor, final_foreign = _all_destination_state(root, spec)
    if len(final_prior) != len(spec["items"]) or final_successor or final_foreign:
        raise PromotionError("rollback postcondition did not restore every exact preimage")


def _receipt_payload(
    *,
    root: Path,
    spec: dict[str, object],
    spec_path: Path,
    spec_sha256: str,
    prepared_at: str,
) -> dict[str, object]:
    promoted = []
    for item in spec["items"]:
        assert isinstance(item, dict)
        destination = rooted(root, item["destinationPath"], "receipt destination")
        identity, _data = snapshot_file(destination, root)
        if identity.get("sha256") != item["sourceIdentity"].get("sha256"):
            raise PromotionError(f"receipt destination digest mismatch: {destination}")
        promoted.append(
            {
                "bundle": item["bundle"],
                "destinationPath": item["destinationPath"],
                "preimage": item["destinationPrecondition"],
                "promotedSha256": identity["sha256"],
                "promotedSize": identity["size"],
            }
        )
    return seal_payload(
        {
            "schema": RECEIPT_SCHEMA,
            "transactionId": spec["transactionId"],
            "status": "PASS_ATOMIC_BUNDLE_PROMOTED",
            "productionState": "NOT_AUTHORIZED_G6",
            "specPath": relative_path(spec_path, root),
            "specSha256": spec_sha256,
            "acceptanceEvidence": spec["acceptanceEvidence"],
            "canonicalCandidateDirectory": spec["canonicalCandidateDirectory"],
            "physicalCandidateDirectory": spec["physicalCandidateDirectory"],
            "preparedAt": prepared_at,
            "completedAt": utc_now(),
            "promotedFiles": promoted,
            "promotedFileCount": len(promoted),
            "noMixedGenerationControl": {
                "hostSemaphore": HOST_VERIFICATION_SEMAPHORE,
                "journalFence": relative_path(root / "g0" / JOURNAL.name, root),
                "readerFenceCoverage": "INDEPENDENT_ACCEPTANCE_PASS",
            },
            "sealCanonicalization": SEAL_METHOD,
        }
    )


def _inject(point: str, requested: str | None) -> None:
    if requested == point:
        raise InjectedCrash(point)


@contextmanager
def _guard(lock_root: Path | None = None) -> Iterator[dict[str, object]]:
    keywords = {"timeout_seconds": 300.0}
    if lock_root is not None:
        keywords["lock_root"] = lock_root
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, **keywords) as receipt:
        yield receipt


def preflight(
    *,
    root: Path,
    spec_path: Path,
    output_report: Path | None = None,
    lock_root: Path | None = None,
) -> dict[str, object]:
    with _guard(lock_root):
        prior_journal = _assert_prior_journal_terminal(root)
        gate_errors = gate_closed_errors(root)
        if gate_errors:
            raise PromotionError("; ".join(gate_errors))
        spec, spec_identity = validate_spec(root=root, spec_path=spec_path)
        _verify_candidate_sources(root, spec)
        _verify_destination_preimages(root, spec)
        result = seal_payload(
            {
                "schema": PREFLIGHT_SCHEMA,
                "status": "PASS_READ_ONLY_NO_PROMOTION",
                "transactionId": spec["transactionId"],
                "specPath": relative_path(spec_path, root),
                "specSha256": spec_identity["sha256"],
                "itemCount": len(spec["items"]),
                "canonicalItemCount": len(CANONICAL_FILES),
                "physicalItemCount": len(PHYSICAL_FILES),
                "candidateIdentityStable": True,
                "destinationCasPreconditionsMatch": True,
                "sameFilesystem": True,
                "gate": "CLOSED_FAIL_SAFE",
                "priorJournalSha256": prior_journal,
                "productionState": "NOT_AUTHORIZED_G6",
                "sealCanonicalization": SEAL_METHOD,
            }
        )
        if output_report is not None:
            _report_path_allowed(output_report, root, "preflight report")
            create_new(output_report, canonical_json_bytes(result), 0o600)
        return result


def promote(
    *,
    root: Path,
    spec_path: Path,
    lock_root: Path | None = None,
    failure_injection: str | None = None,
) -> dict[str, object]:
    with _guard(lock_root):
        if active_host_semaphore_capability(HOST_VERIFICATION_SEMAPHORE) is None:
            raise PromotionError("promotion requires active opaque host-semaphore capability")
        prior_journal_sha = _assert_prior_journal_terminal(root)
        gate_errors = gate_closed_errors(root)
        if gate_errors:
            raise PromotionError("; ".join(gate_errors))
        spec, spec_identity = validate_spec(root=root, spec_path=spec_path)
        report_path = rooted(root, spec["promotionReportPath"], "promotionReportPath")
        _verify_candidate_sources(root, spec)
        _verify_destination_preimages(root, spec)
        transaction, staged, backup = _prepare_transaction_material(root, spec)
        _verify_candidate_sources(root, spec)
        _verify_destination_preimages(root, spec)
        prepared_at = utc_now()
        installed: list[str] = []
        journal = _journal_payload(
            spec=spec,
            spec_path=spec_path,
            spec_sha256=str(spec_identity["sha256"]),
            root=root,
            phase="PREPARED",
            status="PROMOTION_TRANSACTION_PREPARED",
            prepared_at=prepared_at,
            next_destination=None,
            installed=installed,
            receipt_sha256=None,
            prior_journal_sha256=prior_journal_sha,
        )
        _write_journal(root, journal)
        _inject("after-prepared", failure_injection)
        try:
            for index, item in enumerate(spec["items"]):
                assert isinstance(item, dict)
                destination = rooted(root, item["destinationPath"], "commit destination")
                observed, _prior = snapshot_optional(destination, root)
                errors = identity_errors(
                    item["destinationPrecondition"], observed, f"commit destination {index}"
                )
                if errors:
                    raise PromotionError("; ".join(errors))
                journal = _journal_payload(
                    spec=spec,
                    spec_path=spec_path,
                    spec_sha256=str(spec_identity["sha256"]),
                    root=root,
                    phase="COMMITTING",
                    status="PROMOTION_TRANSACTION_COMMITTING",
                    prepared_at=prepared_at,
                    next_destination=str(item["destinationPath"]),
                    installed=installed,
                    receipt_sha256=None,
                    prior_journal_sha256=prior_journal_sha,
                )
                _write_journal(root, journal)
                os.replace(staged / f"{index:02d}.payload", destination)
                fsync_directory(destination.parent)
                installed.append(str(item["destinationPath"]))
                journal = _journal_payload(
                    spec=spec,
                    spec_path=spec_path,
                    spec_sha256=str(spec_identity["sha256"]),
                    root=root,
                    phase="COMMITTING",
                    status="PROMOTION_TRANSACTION_COMMITTING",
                    prepared_at=prepared_at,
                    next_destination=None,
                    installed=installed,
                    receipt_sha256=None,
                    prior_journal_sha256=prior_journal_sha,
                )
                _write_journal(root, journal)
                _inject(f"after-install-{index + 1}", failure_injection)
            _inject("after-install-all", failure_injection)
            _verify_candidate_sources(root, spec)
            prior, successor, foreign = _all_destination_state(root, spec)
            if prior or foreign or len(successor) != len(spec["items"]):
                raise PromotionError("installed bundle is not one exact successor generation")
            receipt = _receipt_payload(
                root=root,
                spec=spec,
                spec_path=spec_path,
                spec_sha256=str(spec_identity["sha256"]),
                prepared_at=prepared_at,
            )
            receipt_bytes = canonical_json_bytes(receipt)
            receipt_sha = sha256_bytes(receipt_bytes)
            journal = _journal_payload(
                spec=spec,
                spec_path=spec_path,
                spec_sha256=str(spec_identity["sha256"]),
                root=root,
                phase="FINALIZING",
                status="PROMOTION_TRANSACTION_FINALIZING",
                prepared_at=prepared_at,
                next_destination=None,
                installed=installed,
                receipt_sha256=receipt_sha,
                prior_journal_sha256=prior_journal_sha,
            )
            _write_journal(root, journal)
            staged_receipt = transaction / "promotion-receipt.json"
            create_new(staged_receipt, receipt_bytes, 0o600)
            try:
                os.link(staged_receipt, report_path, follow_symlinks=False)
            except FileExistsError as error:
                raise PromotionError("immutable promotion receipt path collision") from error
            fsync_directory(report_path.parent)
            _inject("after-report-publish", failure_injection)
            journal = _journal_payload(
                spec=spec,
                spec_path=spec_path,
                spec_sha256=str(spec_identity["sha256"]),
                root=root,
                phase="COMMITTED",
                status="PROMOTION_TRANSACTION_COMMITTED",
                prepared_at=prepared_at,
                next_destination=None,
                installed=installed,
                receipt_sha256=receipt_sha,
                prior_journal_sha256=prior_journal_sha,
            )
            _write_journal(root, journal)
            return receipt
        except InjectedCrash:
            raise
        except BaseException:
            if report_path.exists() or report_path.is_symlink():
                raise
            _restore_prior(root, spec, backup)
            rolled_back = _journal_payload(
                spec=spec,
                spec_path=spec_path,
                spec_sha256=str(spec_identity["sha256"]),
                root=root,
                phase="ROLLED_BACK",
                status="PROMOTION_TRANSACTION_ROLLED_BACK",
                prepared_at=prepared_at,
                next_destination=None,
                installed=[],
                receipt_sha256=None,
                prior_journal_sha256=prior_journal_sha,
            )
            _write_journal(root, rolled_back)
            raise


def recover(
    *,
    root: Path,
    spec_path: Path,
    lock_root: Path | None = None,
) -> dict[str, object]:
    with _guard(lock_root):
        if active_host_semaphore_capability(HOST_VERIFICATION_SEMAPHORE) is None:
            raise PromotionError("recovery requires active opaque host-semaphore capability")
        journal, _journal_sha = _read_journal_optional(root)
        if journal is None or journal.get("phase") not in {
            "PREPARED",
            "COMMITTING",
            "FINALIZING",
        }:
            raise PromotionError("no unfinished promotion transaction to recover")
        spec_identity, spec_data = snapshot_file(spec_path, root)
        spec = parse_json(spec_data, str(spec_path))
        errors = self_seal_errors(spec, "recovery promotion spec")
        if errors or set(spec) != SPEC_FIELDS:
            raise PromotionError("; ".join(errors or ["recovery spec field-set drift"]))
        if (
            journal.get("specPath") != relative_path(spec_path, root)
            or journal.get("specSha256") != spec_identity.get("sha256")
            or journal.get("transactionId") != spec.get("transactionId")
        ):
            raise PromotionError("recovery spec does not match unfinished journal")
        transaction, _staged, backup = _transaction_paths(
            root, str(spec["transactionId"])
        )
        if relative_path(transaction, root) != journal.get("transactionDirectory"):
            raise PromotionError("recovery transaction directory mismatch")
        report_path = rooted(root, spec["promotionReportPath"], "recovery report")
        prior, successor, foreign = _all_destination_state(root, spec)
        if foreign:
            raise PromotionError(
                "recovery refuses foreign destination generation: " + ",".join(foreign)
            )
        if report_path.exists() or report_path.is_symlink():
            report_identity, report_data = snapshot_file(report_path, root)
            receipt = parse_json(report_data, str(report_path))
            receipt_errors = self_seal_errors(receipt, "promotion receipt")
            if (
                receipt_errors
                or report_identity.get("sha256") != journal.get("receiptSha256")
                or receipt.get("schema") != RECEIPT_SCHEMA
                or receipt.get("transactionId") != spec.get("transactionId")
                or prior
                or len(successor) != len(spec["items"])
            ):
                raise PromotionError("published receipt cannot finalize this generation")
            committed = dict(journal)
            committed.update(
                phase="COMMITTED",
                status="PROMOTION_TRANSACTION_COMMITTED",
                updatedAt=utc_now(),
                nextDestination=None,
                installedDestinations=[
                    str(item["destinationPath"]) for item in spec["items"]
                ],
            )
            _write_journal(root, committed)
            return {
                "schema": "dwp.hris.modern-successor-promotion-recovery.v1",
                "status": "PASS_COMMIT_FINALIZED",
                "transactionId": spec["transactionId"],
            }
        _restore_prior(root, spec, backup)
        rolled_back = dict(journal)
        rolled_back.update(
            phase="ROLLED_BACK",
            status="PROMOTION_TRANSACTION_ROLLED_BACK",
            updatedAt=utc_now(),
            nextDestination=None,
            installedDestinations=[],
            receiptSha256=None,
        )
        _write_journal(root, rolled_back)
        return {
            "schema": "dwp.hris.modern-successor-promotion-recovery.v1",
            "status": "PASS_EXACT_ROLLBACK",
            "transactionId": spec["transactionId"],
        }


def _fixture_json(name: str, *, sealed: bool) -> bytes:
    payload: dict[str, object] = {"name": name, "productionState": "NOT_AUTHORIZED_G6"}
    if sealed:
        payload = seal_payload(payload)
    return canonical_json_bytes(payload)


def _fixture_acceptance(root: Path, canonical: Path, physical: Path, path: Path) -> None:
    inventory_path = root / READER_INVENTORY_PATH
    inventory_path.parent.mkdir(parents=True, exist_ok=True)
    inventory = seal_payload(
        {
            "schema": READER_INVENTORY_SCHEMA,
            "activeSourceCount": 44,
            "predecessorInventory": dict(READER_INVENTORY_PREDECESSOR),
        }
    )
    inventory_path.write_bytes(canonical_json_bytes(inventory))
    inventory_identity, _inventory_raw = snapshot_file(inventory_path, root)
    reader_audit_path = path.parent / f"reader-fence-audit-{path.stem}.json"
    reader_audit = seal_payload(
        {
            "schema": READER_FENCE_AUDIT_SCHEMA,
            "status": "PASS",
            "verdict": "READER_FENCE_COVERAGE_CONFIRMED",
            "reviewerIndependence": "INDEPENDENT_OF_REPAIR_AUTHOR",
            "readerInventory": {
                "path": READER_INVENTORY_PATH,
                "fileSha256": inventory_identity["sha256"],
                "sealedPayloadSha256": inventory["sealedPayloadSha256"],
            },
            "checks": {
                "exactActiveInventory": "PASS",
                "directEntrypointGuarding": "PASS",
                "nonterminalWriterDeathBlocking": "PASS",
                "malformedJournalBlocking": "PASS",
                "sharedReaderExclusiveWriterExclusion": "PASS",
                "terminalAndAbsentAdmission": "PASS",
                "physicalBundleCountEight": "PASS",
            },
        }
    )
    create_new(reader_audit_path, canonical_json_bytes(reader_audit))
    reader_identity, _reader_raw = snapshot_file(reader_audit_path, root)
    payload = seal_payload(
        {
            "schema": ACCEPTANCE_SCHEMA,
            "status": "PASS",
            "verdict": "QUALIFIED_FOR_ATOMIC_LIVE_PROMOTION_ONLY",
            "reviewerIndependence": "INDEPENDENT_OF_CANDIDATE_AUTHOR",
            "productionState": "NOT_AUTHORIZED_G6",
            "canonicalCandidateDirectory": relative_path(canonical, root),
            "physicalCandidateDirectory": relative_path(physical, root),
            "checks": dict(REQUIRED_ACCEPTANCE_CHECKS),
            "readerFenceCoverageEvidence": {
                "path": relative_path(reader_audit_path, root),
                "fileSha256": reader_identity["sha256"],
                "sealedPayloadSha256": reader_audit["sealedPayloadSha256"],
            },
            "canonicalFileSha256": {
                name: snapshot_file(canonical / name, root)[0]["sha256"]
                for name in CANONICAL_FILES
            },
            "physicalFileSha256": {
                name: snapshot_file(physical / name, root)[0]["sha256"]
                for name in PHYSICAL_FILES
            },
        }
    )
    create_new(path, canonical_json_bytes(payload))


def _fixture_root(base: Path, suffix: str) -> tuple[Path, Path, Path, Path, Path]:
    root = base / suffix
    coding = root / "coding-readiness"
    reports = coding / "reports"
    canonical = coding / f"modern-canonical-candidate.{suffix}"
    physical = coding / f"modern-physical-candidate.{suffix}"
    for path in (reports, canonical, physical, root / "g0", coding / "modern-physical-successor"):
        path.mkdir(parents=True, exist_ok=True)
    gate = {
        "schema": "dwp.hris.current-g3-gate-decision.v1",
        "effectiveGate": "CLOSED_FAIL_SAFE",
        "currentState": "VALIDATOR_CONTROLLED_BLOCKED",
        "productionActivation": "NOT_AUTHORIZED_G6",
    }
    (root / "g0" / "current-g3-gate-decision.json").write_bytes(canonical_json_bytes(gate))
    sealed_names = {
        CANONICAL_FILES[0],
        CANONICAL_FILES[1],
        CANONICAL_FILES[5],
        CANONICAL_FILES[6],
        CANONICAL_FILES[7],
    }
    for name in CANONICAL_FILES:
        (canonical / name).write_bytes(_fixture_json(name, sealed=name in sealed_names))
    canonical_hashes = {
        name: snapshot_file(canonical / name, root)[0]["sha256"]
        for name in CANONICAL_FILES
    }
    for name in PHYSICAL_PAYLOAD_FILES:
        if name.endswith(".json"):
            (physical / name).write_bytes(_fixture_json(name, sealed=True))
        else:
            (physical / name).write_text(f"-- {name}\n", encoding="utf-8")
    physical_hashes = {
        name: snapshot_file(physical / name, root)[0]
        for name in PHYSICAL_PAYLOAD_FILES
    }
    generation = seal_payload(
        {
            "status": "PASS_CANDIDATE_NOT_G3_AUTHORITY",
            "productionState": "NOT_AUTHORIZED_G6",
            "sourceCanonical": {
                "directory": canonical.name,
                "fileSha256": canonical_hashes,
            },
            "outputFiles": {
                name: {"sha256": identity["sha256"], "bytes": identity["size"]}
                for name, identity in physical_hashes.items()
            },
        }
    )
    (physical / "physical-candidate-generation-report.v4.json").write_bytes(
        canonical_json_bytes(generation)
    )
    # Seven canonical destinations have predecessors.  Listening v2 and all
    # physical v4 paths intentionally exercise create-new destination rollback.
    for name in CANONICAL_FILES:
        if name == "sys-listening-stream-authority-successor.v2.json":
            continue
        (coding / name).write_bytes(f"prior:{name}\n".encode())
    evidence = reports / f"acceptance-{suffix}.json"
    _fixture_acceptance(root, canonical, physical, evidence)
    report = reports / f"promotion-receipt-{suffix}.json"
    return root, canonical, physical, evidence, report


def _fixture_spec(
    root: Path,
    canonical: Path,
    physical: Path,
    evidence: Path,
    report: Path,
    suffix: str,
) -> Path:
    spec_path = root / "coding-readiness" / "reports" / f"promotion-spec-{suffix}.json"
    spec = build_spec(
        root=root,
        canonical_candidate=canonical,
        physical_candidate=physical,
        acceptance_evidence=evidence,
        promotion_report=report,
        transaction_id=f"MODERN-SUCCESSOR-{suffix.upper()}-0001",
    )
    write_spec(spec_path, spec, root)
    return spec_path


def self_test() -> dict[str, object]:
    cases: dict[str, bool] = {}
    with tempfile.TemporaryDirectory(prefix="hris-modern-promotion-") as temporary:
        base = Path(temporary)

        root, canonical, physical, evidence, report = _fixture_root(base, "happycase")
        spec_path = _fixture_spec(root, canonical, physical, evidence, report, "happycase")
        lock_root = root / "locks"
        before_sources = {
            name: snapshot_file(canonical / name, root)[0] for name in CANONICAL_FILES
        }
        preflight_result = preflight(
            root=root, spec_path=spec_path, lock_root=lock_root
        )
        cases["read-only-preflight-passes"] = (
            preflight_result["status"] == "PASS_READ_ONLY_NO_PROMOTION"
            and all(
                snapshot_file(canonical / name, root)[0] == before_sources[name]
                for name in CANONICAL_FILES
            )
        )

        # Same digest with a new inode/ctime is not the accepted source identity.
        source = canonical / CANONICAL_FILES[2]
        source_bytes = source.read_bytes()
        source.unlink()
        source.write_bytes(source_bytes)
        try:
            preflight(root=root, spec_path=spec_path, lock_root=lock_root)
            cases["same-bytes-source-rebinding-rejected"] = False
        except PromotionError:
            cases["same-bytes-source-rebinding-rejected"] = True

        root, canonical, physical, evidence, report = _fixture_root(base, "crashrollback")
        spec_path = _fixture_spec(
            root, canonical, physical, evidence, report, "crashrollback"
        )
        lock_root = root / "locks"
        spec = json.loads(spec_path.read_text())
        prior_bytes = {
            item["destinationPath"]: (
                rooted(root, item["destinationPath"], "fixture destination").read_bytes()
                if item["destinationPrecondition"]["state"] == "PRESENT"
                else None
            )
            for item in spec["items"]
        }
        try:
            promote(
                root=root,
                spec_path=spec_path,
                lock_root=lock_root,
                failure_injection="after-install-1",
            )
            cases["injected-partial-crash-observed"] = False
        except InjectedCrash:
            cases["injected-partial-crash-observed"] = True
        recovery = recover(root=root, spec_path=spec_path, lock_root=lock_root)
        restored = True
        for item in spec["items"]:
            destination = rooted(root, item["destinationPath"], "fixture restored")
            expected = prior_bytes[item["destinationPath"]]
            if expected is None:
                restored &= not destination.exists()
            else:
                restored &= destination.read_bytes() == expected
        cases["partial-crash-exact-rollback"] = (
            recovery["status"] == "PASS_EXACT_ROLLBACK" and restored
        )

        root, canonical, physical, evidence, report = _fixture_root(base, "receiptcrash")
        spec_path = _fixture_spec(root, canonical, physical, evidence, report, "receiptcrash")
        lock_root = root / "locks"
        try:
            promote(
                root=root,
                spec_path=spec_path,
                lock_root=lock_root,
                failure_injection="after-report-publish",
            )
            cases["post-receipt-crash-observed"] = False
        except InjectedCrash:
            cases["post-receipt-crash-observed"] = True
        recovery = recover(root=root, spec_path=spec_path, lock_root=lock_root)
        journal = json.loads((root / "g0" / JOURNAL.name).read_text())
        cases["published-receipt-finalizes-exact-commit"] = (
            recovery["status"] == "PASS_COMMIT_FINALIZED"
            and journal["phase"] == "COMMITTED"
            and report.is_file()
        )

        root, canonical, physical, evidence, report = _fixture_root(base, "casdrift")
        spec_path = _fixture_spec(root, canonical, physical, evidence, report, "casdrift")
        first_destination = root / "coding-readiness" / CANONICAL_FILES[0]
        first_destination.write_bytes(b"foreign-generation\n")
        try:
            promote(
                root=root,
                spec_path=spec_path,
                lock_root=root / "locks",
            )
            cases["destination-cas-drift-rejected-before-journal"] = False
        except PromotionError:
            cases["destination-cas-drift-rejected-before-journal"] = not (
                root / "g0" / JOURNAL.name
            ).exists()

        root, canonical, physical, evidence, report = _fixture_root(base, "extrafile")
        (canonical / "unexpected.json").write_text("{}\n", encoding="utf-8")
        try:
            build_spec(
                root=root,
                canonical_candidate=canonical,
                physical_candidate=physical,
                acceptance_evidence=evidence,
                promotion_report=report,
                transaction_id="MODERN-SUCCESSOR-EXTRAFILE-0001",
            )
            cases["candidate-extra-file-rejected"] = False
        except PromotionError:
            cases["candidate-extra-file-rejected"] = True

        root, canonical, physical, evidence, report = _fixture_root(base, "symlinkfile")
        target = canonical / CANONICAL_FILES[0]
        target_bytes = target.read_bytes()
        target.unlink()
        external = root / "external.json"
        external.write_bytes(target_bytes)
        target.symlink_to(external)
        try:
            build_spec(
                root=root,
                canonical_candidate=canonical,
                physical_candidate=physical,
                acceptance_evidence=evidence,
                promotion_report=report,
                transaction_id="MODERN-SUCCESSOR-SYMLINKFILE-0001",
            )
            cases["candidate-symlink-rejected"] = False
        except PromotionError:
            cases["candidate-symlink-rejected"] = True

        root, canonical, physical, evidence, report = _fixture_root(base, "tamperseal")
        payload = json.loads(evidence.read_text())
        payload["checks"]["readerFenceCoverage"] = "FAIL"
        evidence.write_bytes(canonical_json_bytes(payload))
        try:
            build_spec(
                root=root,
                canonical_candidate=canonical,
                physical_candidate=physical,
                acceptance_evidence=evidence,
                promotion_report=report,
                transaction_id="MODERN-SUCCESSOR-TAMPERSEAL-0001",
            )
            cases["acceptance-tamper-rejected"] = False
        except PromotionError:
            cases["acceptance-tamper-rejected"] = True

        root, canonical, physical, evidence, report = _fixture_root(base, "missingaudit")
        evidence_payload = json.loads(evidence.read_text())
        reader_audit_path = rooted(
            root,
            evidence_payload["readerFenceCoverageEvidence"]["path"],
            "fixture reader audit",
        )
        reader_audit_path.unlink()
        try:
            build_spec(
                root=root,
                canonical_candidate=canonical,
                physical_candidate=physical,
                acceptance_evidence=evidence,
                promotion_report=report,
                transaction_id="MODERN-SUCCESSOR-MISSINGAUDIT-0001",
            )
            cases["missing-independent-reader-audit-rejected"] = False
        except PromotionError:
            cases["missing-independent-reader-audit-rejected"] = True

        root, canonical, physical, evidence, report = _fixture_root(base, "collision")
        report.write_text("occupied\n", encoding="utf-8")
        try:
            build_spec(
                root=root,
                canonical_candidate=canonical,
                physical_candidate=physical,
                acceptance_evidence=evidence,
                promotion_report=report,
                transaction_id="MODERN-SUCCESSOR-COLLISION-0001",
            )
            cases["receipt-create-new-collision-rejected"] = False
        except PromotionError:
            cases["receipt-create-new-collision-rejected"] = True

        root, canonical, physical, evidence, report = _fixture_root(base, "success")
        spec_path = _fixture_spec(root, canonical, physical, evidence, report, "success")
        result = promote(
            root=root,
            spec_path=spec_path,
            lock_root=root / "locks",
        )
        spec = json.loads(spec_path.read_text())
        cases["successful-commit-exact-sixteen-and-immutable-receipt"] = (
            result["status"] == "PASS_ATOMIC_BUNDLE_PROMOTED"
            and result["promotedFileCount"] == 16
            and report.is_file()
            and all(
                snapshot_file(
                    rooted(root, item["destinationPath"], "success destination"), root
                )[0]["sha256"]
                == item["sourceIdentity"]["sha256"]
                for item in spec["items"]
            )
        )
        try:
            create_new(report, b"replacement\n")
            cases["immutable-receipt-cannot-be-overwritten"] = False
        except PromotionError:
            cases["immutable-receipt-cannot-be-overwritten"] = True

    failed = sorted(name for name, passed in cases.items() if not passed)
    return {
        "schema": "dwp.hris.modern-successor-promotion-self-test.v1",
        "status": "PASS" if not failed else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "failedCases": failed,
        "cases": cases,
    }


def _production_only(path: Path, expected_parent: Path, label: str) -> None:
    if path.parent != expected_parent:
        raise PromotionError(f"{label} must be allocated under {expected_parent}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--prepare-spec", action="store_true")
    action.add_argument("--preflight", "--dry-run", dest="preflight", action="store_true")
    action.add_argument("--promote", action="store_true")
    action.add_argument("--recover", action="store_true")
    action.add_argument("--self-test", action="store_true")
    parser.add_argument("--canonical-candidate-dir", type=Path)
    parser.add_argument("--physical-candidate-dir", type=Path)
    parser.add_argument("--acceptance-evidence", type=Path)
    parser.add_argument("--promotion-report", type=Path)
    parser.add_argument("--transaction-id")
    parser.add_argument("--spec", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        if args.self_test:
            result = self_test()
        elif args.prepare_spec:
            required = (
                args.canonical_candidate_dir,
                args.physical_candidate_dir,
                args.acceptance_evidence,
                args.promotion_report,
                args.transaction_id,
                args.spec,
            )
            if any(value is None for value in required):
                raise PromotionError("prepare-spec requires both candidates, acceptance, receipt, transaction id and spec")
            canonical = args.canonical_candidate_dir.absolute()
            physical = args.physical_candidate_dir.absolute()
            acceptance = args.acceptance_evidence.absolute()
            promotion_report = args.promotion_report.absolute()
            spec_path = args.spec.absolute()
            _production_only(spec_path, REPORTS, "promotion spec")
            with _guard():
                if _assert_prior_journal_terminal(ROOT) is not None:
                    # A terminal predecessor is allowed; this call documents
                    # that the journal was parsed before the new CAS snapshot.
                    pass
                gate_errors = gate_closed_errors(ROOT)
                if gate_errors:
                    raise PromotionError("; ".join(gate_errors))
                payload = build_spec(
                    root=ROOT,
                    canonical_candidate=canonical,
                    physical_candidate=physical,
                    acceptance_evidence=acceptance,
                    promotion_report=promotion_report,
                    transaction_id=str(args.transaction_id),
                )
                write_spec(spec_path, payload, ROOT)
            result = {
                "schema": "dwp.hris.modern-successor-promotion-spec-write.v1",
                "status": "PASS_IMMUTABLE_SPEC_CREATED_NO_PROMOTION",
                "specPath": relative_path(spec_path, ROOT),
                "specSha256": snapshot_file(spec_path, ROOT)[0]["sha256"],
            }
        else:
            if args.spec is None:
                raise PromotionError("--spec is required")
            spec_path = args.spec.absolute()
            _production_only(spec_path, REPORTS, "promotion spec")
            if args.preflight:
                report_path = args.report.absolute() if args.report else None
                if report_path is not None:
                    _production_only(report_path, REPORTS, "preflight report")
                result = preflight(
                    root=ROOT,
                    spec_path=spec_path,
                    output_report=report_path,
                )
            elif args.promote:
                if args.report is not None:
                    raise PromotionError("promotion receipt path is sealed into the spec; --report is forbidden")
                result = promote(root=ROOT, spec_path=spec_path)
            else:
                result = recover(root=ROOT, spec_path=spec_path)
    except (OSError, PromotionError) as error:
        result = {
            "schema": "dwp.hris.modern-successor-promotion-command.v1",
            "status": "FAIL_CLOSED",
            "error": str(error),
        }
    print(
        json.dumps(
            result,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":") if args.compact else None,
            indent=None if args.compact else 2,
        )
    )
    return 0 if str(result.get("status", "")).startswith("PASS") else 1


if __name__ == "__main__":
    raise SystemExit(main())
