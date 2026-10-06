#!/usr/bin/env python3
"""Prepare and finalize the modern-causal internal G3 endorsement bundle.

The workflow is intentionally split in two:

* ``--prepare-authority`` creates the direct source-authority manifest and the
  Integration Control intake before PostgreSQL evidence is produced.
* ``--finalize-review`` consumes an existing unsigned PG16/PG18 v2 evidence
  artifact and publishes the reciprocal hostile-review report/evidence pair.

Both modes require the exact fail-safe CLOSED Gate and the caller's same-thread
opaque host-semaphore capability.  The public CLI acquires that capability and
then calls the in-process functions.  This tool never opens the Gate, writes a
central transaction journal, or claims external reviewer identity.
"""

from __future__ import annotations

import argparse
import copy
import csv
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
from typing import Any, Callable, Iterable
from unittest import mock

from modern_causal_successor_profile import (
    LEGACY_PROFILE,
    SUCCESSOR_PROFILE,
    SuccessorProfileError,
    accepted_live_preflight,
    create_only_pair,
    hostile_self_test as successor_profile_hostile_self_test,
    pending_successor_inputs,
    profile_metadata,
    require_profile,
    successor_paths,
    successor_stage_state,
    successor_target_failures,
    verify_accepted_live_canonical,
    verify_predecessor_pins,
)


BASE = Path(__file__).resolve().parent
BLUEPRINT_ROOT = BASE.parent
G0 = BLUEPRINT_ROOT / "g0"
if str(G0) not in sys.path:
    sys.path.insert(0, str(G0))

import gate_authority  # noqa: E402
from host_semaphore import (  # noqa: E402
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    active_host_semaphore_capability,
    exclusive_host_semaphore,
)
import validate_modern_causal_final_endorsement as contract  # noqa: E402
from modern_successor_reader_guard import guarded_modern_successor_read  # noqa: E402


SOURCE_MANIFEST_PATH = BASE / contract.SOURCE_AUTHORITY_MANIFEST_NAME
CONTROL_INTAKE_PATH = G0 / contract.CONTROL_INTAKE_RELATIVE_PATH
EVIDENCE_PATH = BASE / contract.EVIDENCE_RELATIVE_PATH
UNSIGNED_EVIDENCE_PATH = BASE / "reports/modern-causal-independent-pg-evidence.v2.unsigned.json"
FINAL_REPORT_PATH = BASE / contract.REPORT_RELATIVE_PATH
DESIGN_REPORT_PATH = BASE / contract.DESIGN_REPORT_RELATIVE_PATH
ACTIVE_PROFILE = LEGACY_PROFILE
ACTIVE_PROFILE_METADATA = profile_metadata(ACTIVE_PROFILE, BASE, BLUEPRINT_ROOT)


def configure_profile(name: str) -> dict[str, Any]:
    """Keep preparer output paths aligned with the selected verifier profile."""
    global ACTIVE_PROFILE, ACTIVE_PROFILE_METADATA
    global SOURCE_MANIFEST_PATH, CONTROL_INTAKE_PATH, EVIDENCE_PATH, UNSIGNED_EVIDENCE_PATH
    global FINAL_REPORT_PATH, DESIGN_REPORT_PATH, G0
    name = require_profile(name)
    contract.configure_profile(name)
    ACTIVE_PROFILE = name
    if name == SUCCESSOR_PROFILE:
        paths = successor_paths(BASE, BLUEPRINT_ROOT)
        SOURCE_MANIFEST_PATH = paths["sourceAuthority"]
        CONTROL_INTAKE_PATH = paths["controlIntake"]
        EVIDENCE_PATH = paths["pgEvidence"]
        UNSIGNED_EVIDENCE_PATH = BASE / contract.UNSIGNED_EVIDENCE_RELATIVE_PATH
        FINAL_REPORT_PATH = paths["finalReview"]
        DESIGN_REPORT_PATH = paths["designFindings"]
    else:
        SOURCE_MANIFEST_PATH = BASE / contract.SOURCE_AUTHORITY_MANIFEST_NAME
        CONTROL_INTAKE_PATH = G0 / contract.CONTROL_INTAKE_RELATIVE_PATH
        EVIDENCE_PATH = BASE / contract.EVIDENCE_RELATIVE_PATH
        UNSIGNED_EVIDENCE_PATH = BASE / "reports/modern-causal-independent-pg-evidence.v2.unsigned.json"
        FINAL_REPORT_PATH = BASE / contract.REPORT_RELATIVE_PATH
        DESIGN_REPORT_PATH = BASE / contract.DESIGN_REPORT_RELATIVE_PATH
    ACTIVE_PROFILE_METADATA = profile_metadata(ACTIVE_PROFILE, BASE, BLUEPRINT_ROOT)
    return ACTIVE_PROFILE_METADATA


def _successor_preflight_unlocked() -> dict[str, Any]:
    paths = successor_paths(BASE, BLUEPRINT_ROOT)
    stages = successor_stage_state(BASE, BLUEPRINT_ROOT)
    accepted_live = accepted_live_preflight(BASE, BLUEPRINT_ROOT)
    return {
        "profile": ACTIVE_PROFILE,
        "activeGateChain": ACTIVE_PROFILE_METADATA["activeGateChain"],
        "canonicalCounts": ACTIVE_PROFILE_METADATA["canonicalCounts"],
        "policy": ACTIVE_PROFILE_METADATA["policy"],
        "successorArtifacts": {
            key: str(value.relative_to(BLUEPRINT_ROOT)) for key, value in paths.items()
        },
        "missingSuccessorInputs": pending_successor_inputs(BASE, BLUEPRINT_ROOT),
        "stageState": stages,
        "acceptedLivePreflight": accepted_live,
        "predecessorPinFailures": verify_predecessor_pins(BLUEPRINT_ROOT),
        "successorTargetFailures": successor_target_failures(BASE, BLUEPRINT_ROOT),
        "predecessorDisposition": ACTIVE_PROFILE_METADATA.get("predecessorDisposition"),
    }


def successor_preflight() -> dict[str, Any]:
    """Read successor readiness under the shared reader fence."""
    with guarded_modern_successor_read(__file__):
        return _successor_preflight_unlocked()

REVIEWER_ID = "reviewer:modern-causal-independent-hostile-review"
PENDING_REVIEWER_ID = "reviewer:pending-independent-hostile-review"
ZERO_SHA256 = "0" * 64
TARGET_MODE = 0o600


class WorkflowError(RuntimeError):
    """A fail-closed workflow precondition or publication error."""


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _canonical_bytes(value: dict[str, Any]) -> bytes:
    return contract.canonical_file_bytes(value)


def _sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _raise_findings(label: str, findings: contract.Findings) -> None:
    if findings.rows:
        compact = json.dumps(
            findings.rows[:20],
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        raise WorkflowError(f"{label} failed ({len(findings.rows)}): {compact}")


def _require_active_host_semaphore() -> None:
    if active_host_semaphore_capability(HOST_VERIFICATION_SEMAPHORE) is None:
        raise WorkflowError(
            "same-thread opaque hris-verification semaphore capability is required"
        )


def _safe_relative_path(base: Path, relative_name: str) -> Path:
    relative = Path(relative_name)
    if (
        not relative_name
        or relative.is_absolute()
        or "." in relative.parts
        or ".." in relative.parts
    ):
        raise WorkflowError(f"unsafe relative path: {relative_name!r}")
    try:
        base_stat = base.lstat()
    except OSError as exc:
        raise WorkflowError(f"base directory unavailable: {base}: {exc}") from exc
    if stat.S_ISLNK(base_stat.st_mode) or not stat.S_ISDIR(base_stat.st_mode):
        raise WorkflowError(f"base must be a real directory: {base}")
    cursor = base
    for part in relative.parts[:-1]:
        cursor = cursor / part
        try:
            row = cursor.lstat()
        except OSError as exc:
            raise WorkflowError(f"target parent unavailable: {cursor}: {exc}") from exc
        if stat.S_ISLNK(row.st_mode) or not stat.S_ISDIR(row.st_mode):
            raise WorkflowError(f"target parent must be a real directory: {cursor}")
        if stat.S_IMODE(row.st_mode) & 0o022:
            raise WorkflowError(f"target parent is group/world writable: {cursor}")
    target = base.joinpath(*relative.parts)
    try:
        target_stat = target.lstat()
    except FileNotFoundError:
        return target
    except OSError as exc:
        raise WorkflowError(f"target metadata unavailable: {target}: {exc}") from exc
    if stat.S_ISLNK(target_stat.st_mode) or not stat.S_ISREG(target_stat.st_mode):
        raise WorkflowError(f"target must be a regular non-symlink file: {target}")
    if target_stat.st_nlink != 1:
        raise WorkflowError(f"target link count must be one: {target}")
    if stat.S_IMODE(target_stat.st_mode) & 0o022:
        raise WorkflowError(f"target is group/world writable: {target}")
    return target


def _safe_existing_file(base: Path, relative_name: str, label: str) -> Path:
    findings = contract.Findings()
    path = contract.check_safe_regular_file(base, relative_name, findings, label)
    _raise_findings(label, findings)
    if path is None:
        raise WorkflowError(f"{label}: required file is missing")
    return path


def atomic_replace_pair(
    replacements: list[tuple[Path, bytes]],
    *,
    post_commit_validate: Callable[[], None],
    failure_hook: Callable[[int], None] | None = None,
    allow_replace_for_test: bool = False,
) -> None:
    """Create exactly two new files, rolling back only this generation.

    Endorsement artifacts are sealed evidence.  Replacing an occupied target
    would destroy the predecessor evidence, so every production call is
    create-new-only.  The filesystem hard-link commit in the shared helper
    rejects a target that appears concurrently after preflight.
    """
    if len(replacements) != 2 or replacements[0][0] == replacements[1][0]:
        raise WorkflowError("an exact pair of distinct publication targets is required")
    if allow_replace_for_test:
        # Synthetic verifier fixtures need to model the historical
        # unsigned-evidence -> finalized-evidence transition.  This escape
        # hatch is intentionally explicit, private to self-test callers, and
        # never used by a production workflow or the successor profile.
        originals: dict[Path, tuple[bytes, int]] = {}
        try:
            for target, _raw in replacements:
                row = target.lstat()
                if stat.S_ISLNK(row.st_mode) or not stat.S_ISREG(row.st_mode) or row.st_nlink != 1:
                    raise WorkflowError(f"test replacement target is unsafe: {target}")
                originals[target] = (target.read_bytes(), stat.S_IMODE(row.st_mode))
            for index, (target, raw) in enumerate(replacements, 1):
                target.write_bytes(raw)
                os.chmod(target, TARGET_MODE)
                if failure_hook is not None:
                    failure_hook(index)
            post_commit_validate()
            return
        except BaseException as original_error:
            for target, (raw, mode) in originals.items():
                try:
                    target.write_bytes(raw)
                    os.chmod(target, mode)
                except OSError:
                    pass
            raise WorkflowError(f"test pair replacement rolled back: {original_error!r}") from original_error
    created: list[Path] = []
    try:
        # ``create_only_pair`` is a guarded library primitive.  Keep the
        # lease around the complete pair, including post-commit validation,
        # so both successor and historical callers prove one stable terminal
        # generation.  The context is re-entrant when the successor caller
        # already holds its reader lease.
        with guarded_modern_successor_read(__file__):
            for index, (target, raw) in enumerate(replacements, 1):
                create_only_pair([(target, raw)])
                created.append(target)
                if failure_hook is not None:
                    failure_hook(index)
            post_commit_validate()
            for target, expected in replacements:
                row = target.lstat()
                if (
                    stat.S_ISLNK(row.st_mode)
                    or not stat.S_ISREG(row.st_mode)
                    or row.st_nlink != 1
                    or stat.S_IMODE(row.st_mode) != TARGET_MODE
                    or target.read_bytes() != expected
                ):
                    raise WorkflowError(f"published bytes/mode verification failed: {target}")
    except BaseException as original_error:
        rollback_errors: list[str] = []
        for target in reversed(created):
            try:
                target.unlink(missing_ok=True)
            except OSError as exc:
                rollback_errors.append(f"{target}: {exc}")
        if rollback_errors:
            raise WorkflowError(
                "create-only pair failed and rollback was incomplete; all validators "
                f"must remain closed: error={original_error!r} rollback={rollback_errors}"
            ) from original_error
        raise WorkflowError(f"create-only pair rolled back: {original_error!r}") from original_error


def _file_snapshot(paths: Iterable[Path]) -> dict[str, tuple[Any, ...]]:
    snapshot: dict[str, tuple[Any, ...]] = {}
    for path in sorted(set(paths), key=str):
        try:
            row = path.lstat()
        except OSError as exc:
            raise WorkflowError(f"snapshot input unavailable: {path}: {exc}") from exc
        if stat.S_ISLNK(row.st_mode) or not stat.S_ISREG(row.st_mode) or row.st_nlink != 1:
            raise WorkflowError(f"snapshot input is unsafe: {path}")
        if stat.S_IMODE(row.st_mode) & 0o022:
            raise WorkflowError(f"snapshot input is group/world writable: {path}")
        snapshot[str(path)] = (
            row.st_dev,
            row.st_ino,
            stat.S_IMODE(row.st_mode),
            row.st_nlink,
            row.st_size,
            row.st_mtime_ns,
            row.st_ctime_ns,
            contract.file_hash(path),
        )
    return snapshot


def _assert_snapshot_unchanged(
    before: dict[str, tuple[Any, ...]], paths: Iterable[Path]
) -> None:
    after = _file_snapshot(paths)
    if before != after:
        changed = sorted(set(before) | set(after))
        changed = [name for name in changed if before.get(name) != after.get(name)]
        raise WorkflowError(f"input changed during preparation: {changed}")


def assert_exact_closed_gate(g0_root: Path) -> None:
    _require_active_host_semaphore()
    decision_path = _safe_existing_file(
        g0_root, "current-g3-gate-decision.json", "P0-PREPARER-GATE-DECISION"
    )
    try:
        decision = contract.strict_json_file(decision_path)
    except (OSError, contract.StrictJsonError) as exc:
        raise WorkflowError(f"Gate decision is not strict JSON: {exc}") from exc
    errors = list(gate_authority.gate_decision_errors(decision, require_open=False))
    errors.extend(
        gate_authority.central_classification_errors(
            decision, path=g0_root / "central-artifact-classification-register.csv"
        )
    )
    transition_path = g0_root / "g3-gate-transition-register.csv"
    errors.extend(
        gate_authority.transition_register_errors(
            decision_path=decision_path,
            transition_path=transition_path,
            require_open=False,
        )
    )
    # ``require_open=False`` validates every historical row but intentionally
    # does not define a closed-tip policy.  This writer is stricter: after any
    # history exists, the latest transition itself must commit and bind the
    # current closed decision.  A stale latest OPEN row is not an exact CLOSED
    # generation even when someone separately rewrote the decision JSON.
    try:
        with transition_path.open(newline="", encoding="utf-8-sig") as stream:
            reader = csv.DictReader(stream)
            if list(reader.fieldnames or []) != gate_authority.TRANSITION_HEADER:
                raise WorkflowError("G3 Gate transition register header drift")
            transition_rows = list(reader)
    except OSError as exc:
        raise WorkflowError(f"G3 Gate transition register unavailable: {exc}") from exc
    if transition_rows:
        latest = transition_rows[-1]
        if (
            latest.get("target_gate") != "CLOSED_FAIL_SAFE"
            or latest.get("status") != "COMMITTED_CLOSED_FAIL_SAFE"
            or latest.get("decision_sha256") != contract.file_hash(decision_path)
        ):
            errors.append("latest G3 Gate transition is not the current committed CLOSED decision")
    if errors:
        raise WorkflowError("exact CLOSED Gate required: " + "; ".join(sorted(set(errors))))


def _require_frozen_current_tool_root(root: Path) -> None:
    findings = contract.Findings()
    contract.validate_internal_trusted_tool_root(root, findings, require_frozen=True)
    _raise_findings("trusted tool root", findings)


def _authority_input_paths(root: Path, g0_root: Path) -> list[Path]:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        try:
            accepted = verify_accepted_live_canonical(root, root.parent)
        except (OSError, SuccessorProfileError, ValueError, KeyError, TypeError) as exc:
            raise WorkflowError(f"accepted-live source closure unavailable: {exc}") from exc
        paths = [
            root / contract.ORACLE_NAME,
            root / contract.FIXTURE_NAME,
            root / contract.BUILDER_NAME,
            root / contract.RUNNER_NAME,
            root / contract.INDEPENDENT_VALIDATOR_NAME,
            root / contract.VERIFIER_NAME,
            root / contract.REVIEW_INVENTORY_NAME,
            root / contract.REVIEW_FINALIZATION_NAME,
            *accepted["sources"].values(),
            root / contract.SUCCESSOR_ACCEPTED_LIVE_MANIFEST,
            root / contract.SUCCESSOR_INDEPENDENT_ACCEPTANCE,
            g0_root / "current-g3-gate-decision.json",
            g0_root / "central-artifact-classification-register.csv",
            g0_root / "g3-gate-transition-register.csv",
        ]
        return paths
    names = {
        contract.ORACLE_NAME,
        contract.FIXTURE_NAME,
        contract.BUILDER_NAME,
        contract.RUNNER_NAME,
        contract.INDEPENDENT_VALIDATOR_NAME,
        contract.VERIFIER_NAME,
        contract.REVIEW_INVENTORY_NAME,
        *contract.CANDIDATE_FILES.values(),
        *(row[0] for row in contract.SOURCE_AUTHORITY_FILES.values()),
    }
    paths = [root / name for name in names]
    paths.extend(
        [
            g0_root / "current-g3-gate-decision.json",
            g0_root / "central-artifact-classification-register.csv",
            g0_root / "g3-gate-transition-register.csv",
        ]
    )
    return paths


def _source_rows(root: Path) -> tuple[dict[str, dict[str, str]], dict[str, str]]:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        try:
            accepted = verify_accepted_live_canonical(root, root.parent)
        except (OSError, SuccessorProfileError, ValueError, KeyError, TypeError) as exc:
            raise WorkflowError(f"accepted-live source closure unavailable: {exc}") from exc
        accepted_labels = {
            "operationSsot": "operationSsot",
            "exact": "exact",
            "events": "events",
            "semanticBindings": "semanticBindings",
            "publicIdentity": "publicIdentity",
            "listeningSuccessorAuthority": "listeningAuthority",
        }
        source_rows: dict[str, dict[str, str]] = {}
        current_hashes: dict[str, str] = {}
        for label, (relative_name, requires_seal) in contract.SOURCE_AUTHORITY_FILES.items():
            if label in accepted_labels:
                path = accepted["sources"][accepted_labels[label]]
                relative_name = path.name
            else:
                path = _safe_existing_file(root, relative_name, f"P0-PREPARER-SOURCE-{label}")
            digest = contract.file_hash(path)
            current_hashes[label] = digest
            row = {"path": relative_name, "fileSha256": digest}
            if requires_seal:
                try:
                    document = contract.strict_json_file(path)
                except (OSError, contract.StrictJsonError) as exc:
                    raise WorkflowError(f"source {label} is not strict JSON: {exc}") from exc
                seal = contract.semantic_seal(document)
                if document.get("sealedPayloadSha256") != seal:
                    raise WorkflowError(f"source {label} semantic seal is invalid")
                row["sealedPayloadSha256"] = seal
            source_rows[label] = row
        causal_pins = {
            file_name: contract.file_hash(accepted["sources"][accepted_label])
            for label, file_name in contract.CAUSAL_PIN_SOURCE_LABELS.items()
            for accepted_label in ({
                "exact": "exact", "events": "events", "semanticBindings": "semanticBindings",
                "publicIdentity": "publicIdentity", "listeningSuccessorAuthority": "listeningAuthority",
            }[label],)
        }
        return source_rows, causal_pins
    source_rows: dict[str, dict[str, str]] = {}
    current_hashes: dict[str, str] = {}
    for label, (relative_name, requires_seal) in contract.SOURCE_AUTHORITY_FILES.items():
        path = _safe_existing_file(root, relative_name, f"P0-PREPARER-SOURCE-{label}")
        digest = contract.file_hash(path)
        current_hashes[label] = digest
        row = {"path": relative_name, "fileSha256": digest}
        if requires_seal:
            try:
                document = contract.strict_json_file(path)
            except (OSError, contract.StrictJsonError) as exc:
                raise WorkflowError(f"source {label} is not strict JSON: {exc}") from exc
            seal = contract.semantic_seal(document)
            if document.get("sealedPayloadSha256") != seal:
                raise WorkflowError(f"source {label} semantic seal is invalid")
            row["sealedPayloadSha256"] = seal
        source_rows[label] = row
    causal_pins = {
        file_name: current_hashes[label]
        for label, file_name in contract.CAUSAL_PIN_SOURCE_LABELS.items()
    }
    causal_path = _safe_existing_file(
        root, contract.CANDIDATE_FILES["causal"], "P0-PREPARER-CAUSAL"
    )
    try:
        causal = contract.strict_json_file(causal_path)
    except (OSError, contract.StrictJsonError) as exc:
        raise WorkflowError(f"causal candidate is not strict JSON: {exc}") from exc
    if causal.get("canonicalSourcePins") != causal_pins:
        raise WorkflowError("causal candidate canonicalSourcePins are stale")
    if causal.get("sealedPayloadSha256") != contract.semantic_seal(causal):
        raise WorkflowError("causal candidate semantic seal is invalid")
    return source_rows, causal_pins


def _tool_pins(root: Path) -> dict[str, dict[str, str]]:
    names = {
        "builder": contract.BUILDER_NAME,
        "independentValidator": contract.INDEPENDENT_VALIDATOR_NAME,
        "runner": contract.RUNNER_NAME,
        "finalVerifier": contract.VERIFIER_NAME,
    }
    rows: dict[str, dict[str, str]] = {}
    for label, name in names.items():
        path = _safe_existing_file(root, name, f"P0-PREPARER-TOOL-{label}")
        digest = contract.file_hash(path)
        if label in contract.TRUSTED_TOOL_ROOT_SPEC["tools"]:
            expected = contract.TRUSTED_TOOL_ROOT_SPEC["tools"][label]["fileSha256"]
            if digest != expected:
                raise WorkflowError(
                    f"{label} differs from the verifier-embedded trusted root"
                )
        rows[label] = {
            "path": f"coding-readiness/{name}",
            "fileSha256": digest,
        }
    return rows


def _assert_acyclic_authority_binding(
    source_manifest: dict[str, Any],
    source_raw: bytes,
    control_intake: dict[str, Any],
) -> None:
    # Source is the root of this two-node graph.  It must not contain a reverse
    # Control reference; Control binds the already-complete source file only.
    source_text = source_raw.decode("utf-8", errors="strict")
    if (
        "controlIntake" in source_manifest
        or contract.CONTROL_INTAKE_ID in source_text
        or contract.CONTROL_INTAKE_RECORDED_PATH in source_text
    ):
        raise WorkflowError("source/control reference graph is cyclic")
    reference = control_intake.get("sourceAuthorityManifest")
    expected = {
        "path": f"coding-readiness/{contract.SOURCE_AUTHORITY_MANIFEST_NAME}",
        "fileSha256": _sha256(source_raw),
        "sealedPayloadSha256": source_manifest.get("sealedPayloadSha256"),
    }
    if reference != expected:
        raise WorkflowError("Control source-authority reference is stale or malformed")


def build_authority_documents(
    root: Path,
    *,
    now: dt.datetime,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    _require_frozen_current_tool_root(root)
    projection_findings = contract.Findings()
    projection, _expected_sets, _expected_tables = contract.derive_id_projection(
        root, projection_findings
    )
    _raise_findings("source projection", projection_findings)
    if projection is None:
        raise WorkflowError("source projection could not be derived")
    sources, causal_pins = _source_rows(root)
    timestamp = now.astimezone(dt.timezone.utc).isoformat()
    source_manifest: dict[str, Any] = {
        "manifestId": contract.SOURCE_AUTHORITY_ID,
        "schemaVersion": contract.SOURCE_AUTHORITY_SCHEMA_VERSION,
        "status": "CURRENT_DIRECT_SOURCE_AUTHORITY_PINNED",
        "scope": contract.REVIEW_SCOPE,
        "generatedAt": timestamp,
        "sources": sources,
        "causalCanonicalSourcePins": causal_pins,
        "trustedToolRoot": contract.trusted_tool_root_reference(),
        "expectedProjection": projection,
        "sealedPayloadSha256": "",
    }
    source_manifest["sealedPayloadSha256"] = contract.semantic_seal(source_manifest)
    source_raw = _canonical_bytes(source_manifest)
    source_reference = {
        "path": contract.SOURCE_AUTHORITY_MANIFEST_NAME,
        "fileSha256": _sha256(source_raw),
        "sealedPayloadSha256": source_manifest["sealedPayloadSha256"],
    }
    control_intake: dict[str, Any] = {
        "intakeId": contract.CONTROL_INTAKE_ID,
        "schemaVersion": contract.CONTROL_INTAKE_SCHEMA_VERSION,
        "status": "ACCEPTED_FOR_INTERNAL_REVIEW_WORKFLOW",
        "gatePolicy": contract.GATE_POLICY,
        "controlRole": "ROLE.INTEGRATION_CONTROL",
        "scope": contract.REVIEW_SCOPE,
        "externalIdentityAttestation": contract.NO_EXTERNAL_IDENTITY,
        "acceptedAt": timestamp,
        "sourceAuthorityManifest": {
            **source_reference,
            "path": f"coding-readiness/{contract.SOURCE_AUTHORITY_MANIFEST_NAME}",
        },
        "trustedToolRoot": contract.trusted_tool_root_reference(),
        "toolPins": _tool_pins(root),
        "sealedPayloadSha256": "",
    }
    control_intake["sealedPayloadSha256"] = contract.semantic_seal(control_intake)
    _assert_acyclic_authority_binding(source_manifest, source_raw, control_intake)
    control_reference = {
        "path": contract.CONTROL_INTAKE_RECORDED_PATH,
        "fileSha256": _sha256(_canonical_bytes(control_intake)),
        "sealedPayloadSha256": control_intake["sealedPayloadSha256"],
    }
    return source_manifest, control_intake, {
        "sourceAuthority": source_reference,
        "controlIntake": control_reference,
        "expectedProjection": projection,
    }


def _validate_published_authority_pair(
    root: Path,
    g0_root: Path,
    references: dict[str, Any],
) -> None:
    findings = contract.Findings()
    evidence_view = {
        **references,
        "builderFileSha256": contract.file_hash(root / contract.BUILDER_NAME),
        "independentValidatorFileSha256": contract.file_hash(
            root / contract.INDEPENDENT_VALIDATOR_NAME
        ),
        "runnerFileSha256": contract.file_hash(root / contract.RUNNER_NAME),
        "verifierFileSha256": contract.file_hash(root / contract.VERIFIER_NAME),
    }
    manifest = contract.validate_source_authority(
        root,
        evidence_view,
        references["expectedProjection"],
        findings,
        utc_now(),
    )
    contract.validate_control_intake(
        root, g0_root, evidence_view, manifest, findings, utc_now()
    )
    _raise_findings("published authority pair", findings)


def prepare_authority_under_active_lock(
    root: Path = BASE,
    g0_root: Path = G0,
    *,
    now: dt.datetime | None = None,
    failure_hook: Callable[[int], None] | None = None,
) -> dict[str, Any]:
    _require_active_host_semaphore()
    assert_exact_closed_gate(g0_root)
    source_target = _safe_relative_path(
        root, contract.SOURCE_AUTHORITY_MANIFEST_NAME
    )
    control_target = _safe_relative_path(g0_root, contract.CONTROL_INTAKE_RELATIVE_PATH)
    inputs = _authority_input_paths(root, g0_root)
    snapshot = _file_snapshot(inputs)
    source, control, references = build_authority_documents(
        root, now=now or utc_now()
    )
    _assert_snapshot_unchanged(snapshot, inputs)
    source_raw = _canonical_bytes(source)
    control_raw = _canonical_bytes(control)
    publish_authority = lambda: atomic_replace_pair(
        [(source_target, source_raw), (control_target, control_raw)],
        post_commit_validate=lambda: _validate_published_authority_pair(
            root, g0_root, references
        ),
        failure_hook=failure_hook,
    )
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        with guarded_modern_successor_read(__file__):
            publish_authority()
    else:
        publish_authority()
    return {
        "schema": "dwp.hris.modern-causal-final-preparer.v1",
        "mode": "PREPARE_AUTHORITY",
        "status": "PASS",
        "sourceAuthority": references["sourceAuthority"],
        "controlIntake": references["controlIntake"],
        "trustedToolRoot": contract.trusted_tool_root_reference(),
        "hostSemaphore": "IN_PROCESS_OPAQUE",
        "gate": "CLOSED_FAIL_SAFE",
    }


def _expected_pending_reviewer(generated_at: Any, core: str) -> dict[str, Any]:
    return {
        "signed": False,
        "attestationMode": contract.ATTESTATION_MODE,
        "externalIdentityAttestation": contract.NO_EXTERNAL_IDENTITY,
        "reviewerId": PENDING_REVIEWER_ID,
        "reviewerRole": "INDEPENDENT_HOSTILE_REVIEWER",
        "reportId": contract.REPORT_ID,
        "reportPath": contract.REPORT_RELATIVE_PATH,
        "reportSealedPayloadSha256": ZERO_SHA256,
        "reportFileSha256": ZERO_SHA256,
        "evidenceCoreSealSha256": core,
        "findingCounts": {"P0": 0, "P1": 0},
        "reviewedAt": generated_at,
    }


def _load_unsigned_evidence(root: Path) -> dict[str, Any]:
    relative_path = (
        contract.UNSIGNED_EVIDENCE_RELATIVE_PATH
        if ACTIVE_PROFILE == SUCCESSOR_PROFILE
        else contract.EVIDENCE_RELATIVE_PATH
    )
    path = _safe_existing_file(
        root, relative_path, "P0-PREPARER-EVIDENCE"
    )
    try:
        evidence = contract.strict_json_file(path)
    except (OSError, contract.StrictJsonError) as exc:
        raise WorkflowError(f"PG evidence is not strict JSON: {exc}") from exc
    if path.read_bytes() != _canonical_bytes(evidence):
        raise WorkflowError("PG evidence must be canonical compact JSON plus one LF")
    expected_keys = (
        contract.SUCCESSOR_EVIDENCE_KEYS
        if ACTIVE_PROFILE == SUCCESSOR_PROFILE else contract.EVIDENCE_KEYS
    )
    if set(evidence) != expected_keys:
        raise WorkflowError("PG evidence top-level shape differs from active contract")
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        if evidence.get("evidenceState") != "UNSIGNED_STAGING_SUCCESSOR_V3":
            raise WorkflowError("successor evidence is not unsigned staging state")
        if evidence.get("unsignedStagingPath") != relative_path:
            raise WorkflowError("successor unsigned evidence path is stale")
        if evidence.get("finalEvidencePath") != contract.EVIDENCE_RELATIVE_PATH:
            raise WorkflowError("successor final evidence path is stale")
        if evidence.get("unsignedStagingPath") == evidence.get("finalEvidencePath"):
            raise WorkflowError("successor unsigned/final evidence paths collide")
    core = contract.evidence_core_seal(evidence)
    if evidence.get("sealedPayloadSha256") != core:
        raise WorkflowError("PG evidence core seal is invalid")
    expected_pending = _expected_pending_reviewer(evidence.get("generatedAt"), core)
    if evidence.get("secondReviewer") != expected_pending:
        raise WorkflowError(
            "PG evidence is not the exact unsigned runner output or is already finalized"
        )
    # Reuse the final verifier's closed schema before indexing nested values.
    # Only the runner's expected pending reviewer block is temporarily promoted
    # to a shape-valid reviewer; it is outside the evidence core by contract.
    schema_view = copy.deepcopy(evidence)
    schema_view["secondReviewer"] = {
        **expected_pending,
        "signed": True,
        "reviewerId": REVIEWER_ID,
    }
    schema_findings = contract.Findings()
    contract.validate_evidence_schema(schema_view, schema_findings, root=root)
    _raise_findings("unsigned PG evidence schema", schema_findings)
    return evidence


def _verify_design_report(root: Path) -> dict[str, Any]:
    _safe_existing_file(
        root, contract.DESIGN_REPORT_RELATIVE_PATH, "P0-PREPARER-DESIGN-REPORT"
    )
    trusted = contract.TRUSTED_TOOL_ROOT_SPEC["tools"]["independentValidator"]
    suffix = list(trusted["invocations"]["verifyDesignReport"]["argvSuffix"])
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        suffix.extend(["--profile", SUCCESSOR_PROFILE])
    argv = [sys.executable, str(root / trusted["path"]), *suffix]
    findings = contract.Findings()
    contract.run_typed_subprocess(
        "preparer-independent-verify-design-report",
        argv,
        findings,
        lambda raw, name, rows: contract.validate_design_report_receipt(
            raw, root, name, rows
        ),
        cwd=root,
    )
    _raise_findings("independent design report", findings)
    return findings.receipts[0]


def _build_final_pair(
    evidence: dict[str, Any],
    *,
    reviewed_at: dt.datetime,
) -> tuple[dict[str, Any], dict[str, Any]]:
    result = copy.deepcopy(evidence)
    input_core = contract.evidence_core_seal(result)
    if result.get("sealedPayloadSha256") != input_core:
        raise WorkflowError("evidence core changed before hostile review")
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        # Final evidence is a successor generation with a distinct state and
        # a distinct create-only path; the runner-owned unsigned core remains
        # immutable at its staging path.
        result["evidenceState"] = "FINALIZED_SUCCESSOR_V3"
    core = contract.evidence_core_seal(result)
    timestamp = reviewed_at.astimezone(dt.timezone.utc).isoformat()
    result["secondReviewer"] = {
        "signed": True,
        "attestationMode": contract.ATTESTATION_MODE,
        "externalIdentityAttestation": contract.NO_EXTERNAL_IDENTITY,
        "reviewerId": REVIEWER_ID,
        "reviewerRole": "INDEPENDENT_HOSTILE_REVIEWER",
        "reportId": contract.REPORT_ID,
        "reportPath": contract.REPORT_RELATIVE_PATH,
        "reportSealedPayloadSha256": ZERO_SHA256,
        "reportFileSha256": ZERO_SHA256,
        "evidenceCoreSealSha256": core,
        "findingCounts": {"P0": 0, "P1": 0},
        "reviewedAt": timestamp,
    }
    comparison = result["executionComparison"]
    report: dict[str, Any] = {
        "reportId": contract.REPORT_ID,
        "schemaVersion": contract.REPORT_SCHEMA_VERSION,
        "status": "PASS",
        "scope": contract.REVIEW_SCOPE,
        "externalIdentityAttestation": contract.NO_EXTERNAL_IDENTITY,
        "reviewer": {
            "reviewerId": REVIEWER_ID,
            "reviewerRole": "INDEPENDENT_HOSTILE_REVIEWER",
            "independenceAssertion": "DISTINCT_FROM_ALL_PRODUCERS",
            "producerPrincipalIdsReviewed": copy.deepcopy(
                result["producerPrincipalIds"]
            ),
        },
        "subject": {
            "evidenceId": result["evidenceId"],
            "evidenceCoreSealSha256": core,
            "oracleSha256": result["oracleSha256"],
            "oracleFileSha256": result["oracleFileSha256"],
            "fixtureSha256": result["fixtureSha256"],
            "fixtureFileSha256": result["fixtureFileSha256"],
            "builderFileSha256": result["builderFileSha256"],
            "runnerFileSha256": result["runnerFileSha256"],
            "verifierFileSha256": result["verifierFileSha256"],
            "independentValidatorFileSha256": result[
                "independentValidatorFileSha256"
            ],
            "sourceAuthority": copy.deepcopy(result["sourceAuthority"]),
            "controlIntake": copy.deepcopy(result["controlIntake"]),
            "trustedToolRoot": copy.deepcopy(result["trustedToolRoot"]),
            "expectedProjection": copy.deepcopy(result["expectedProjection"]),
            **({
                "acceptedLiveSourceHashes": copy.deepcopy(
                    result["acceptedLiveSourceHashes"]
                ),
            } if ACTIVE_PROFILE == SUCCESSOR_PROFILE else {
                "candidateHashes": copy.deepcopy(result["candidateHashes"]),
            }),
            "pgComparableExecutionPayloadSha256": comparison[
                "comparableExecutionPayloadSha256"
            ],
            "pgRunPayloadSha256": {
                "16": comparison["pg16PayloadSha256"],
                "18": comparison["pg18PayloadSha256"],
            },
        },
        "findings": {"counts": {"P0": 0, "P1": 0}, "P0": [], "P1": []},
        "assertions": copy.deepcopy(
            contract.SUCCESSOR_REPORT_ASSERTIONS
            if ACTIVE_PROFILE == SUCCESSOR_PROFILE else contract.REPORT_ASSERTIONS
        ),
        "reviewedAt": timestamp,
        "sealedPayloadSha256": "",
    }
    report["sealedPayloadSha256"] = contract.report_seal(report)
    report_raw = _canonical_bytes(report)
    result["secondReviewer"]["reportSealedPayloadSha256"] = report[
        "sealedPayloadSha256"
    ]
    result["secondReviewer"]["reportFileSha256"] = _sha256(report_raw)
    if contract.evidence_core_seal(result) != core:
        raise WorkflowError("review binding changed the immutable evidence core")
    result["sealedPayloadSha256"] = core
    return result, report


def _validate_final_pair_in_memory(
    root: Path,
    g0_root: Path,
    evidence: dict[str, Any],
    report: dict[str, Any],
    *,
    now: dt.datetime,
) -> None:
    findings = contract.Findings()
    contract.validate_evidence_schema(evidence, findings, root=root)
    contract.validate_report_schema(report, findings, root=root)
    contract.validate_current_inputs(root, evidence, findings)
    projection, expected_sets, expected_tables = contract.derive_id_projection(root, findings)
    source = contract.validate_source_authority(
        root, evidence, projection, findings, now
    )
    control = contract.validate_control_intake(
        root, g0_root, evidence, source, findings, now
    )
    contract.validate_pg_comparison(
        evidence, findings, expected_sets, expected_tables, now
    )
    report_parent = root / contract.REPORTS_DIR
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".modern-causal-final-review-validation.",
        suffix=".json",
        dir=report_parent,
    )
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, TARGET_MODE)
        with os.fdopen(descriptor, "wb", closefd=True) as stream:
            descriptor = -1
            stream.write(_canonical_bytes(report))
            stream.flush()
            os.fsync(stream.fileno())
        contract.validate_reciprocal_binding(evidence, report, temporary, findings)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        temporary.unlink(missing_ok=True)
    contract.validate_time_chain(evidence, report, source, control, findings, now)
    _raise_findings("final endorsement pair", findings)


def _validate_published_final_pair(root: Path, g0_root: Path) -> None:
    findings = contract.verify_bundle(root, g0_root=g0_root, run_commands=False)
    _raise_findings("published final endorsement", findings)


def finalize_review_under_active_lock(
    root: Path = BASE,
    g0_root: Path = G0,
    *,
    now: dt.datetime | None = None,
    failure_hook: Callable[[int], None] | None = None,
    allow_replace_for_test: bool = False,
    design_verifier: Callable[[Path], dict[str, Any]] = _verify_design_report,
) -> dict[str, Any]:
    _require_active_host_semaphore()
    assert_exact_closed_gate(g0_root)
    _require_frozen_current_tool_root(root)
    report_target = _safe_relative_path(root, contract.REPORT_RELATIVE_PATH)
    evidence_target = _safe_relative_path(root, contract.EVIDENCE_RELATIVE_PATH)
    # Legacy v1/v2 evidence is finalized in place; only the successor profile
    # has a distinct unsigned staging path.  Keep the snapshot boundary
    # aligned with ``_load_unsigned_evidence`` so historical reproduction
    # does not require an absent successor-only file.
    unsigned_relative = (
        contract.UNSIGNED_EVIDENCE_RELATIVE_PATH
        if ACTIVE_PROFILE == SUCCESSOR_PROFILE
        else contract.EVIDENCE_RELATIVE_PATH
    )
    unsigned_target = _safe_relative_path(root, unsigned_relative)
    evidence = _load_unsigned_evidence(root)
    inputs = [
        *_authority_input_paths(root, g0_root),
        root / contract.SOURCE_AUTHORITY_MANIFEST_NAME,
        g0_root / contract.CONTROL_INTAKE_RELATIVE_PATH,
        root / contract.DESIGN_REPORT_RELATIVE_PATH,
        unsigned_target,
    ]
    snapshot = _file_snapshot(inputs)
    design_receipt = design_verifier(root)
    check_now = now or utc_now()
    final_evidence, report = _build_final_pair(evidence, reviewed_at=check_now)
    _validate_final_pair_in_memory(
        root, g0_root, final_evidence, report, now=check_now
    )
    _assert_snapshot_unchanged(snapshot, inputs)
    report_raw = _canonical_bytes(report)
    evidence_raw = _canonical_bytes(final_evidence)
    publish_final = lambda: atomic_replace_pair(
        [(report_target, report_raw), (evidence_target, evidence_raw)],
        post_commit_validate=lambda: _validate_published_final_pair(root, g0_root),
        failure_hook=failure_hook,
        # Successor finalization is always create-only.  The optional
        # replacement hook exists solely for the historical synthetic bundle;
        # accepting it here would let a finalizer overwrite a sealed target.
        allow_replace_for_test=(allow_replace_for_test if ACTIVE_PROFILE != SUCCESSOR_PROFILE else False),
    )
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        with guarded_modern_successor_read(__file__):
            publish_final()
    else:
        publish_final()
    return {
        "schema": "dwp.hris.modern-causal-final-preparer.v1",
        "mode": "FINALIZE_REVIEW",
        "status": "PASS",
        "evidence": {
            "path": contract.EVIDENCE_RELATIVE_PATH,
            "fileSha256": _sha256(evidence_raw),
            "evidenceCoreSealSha256": final_evidence["sealedPayloadSha256"],
            **({"unsignedStagingPath": contract.UNSIGNED_EVIDENCE_RELATIVE_PATH}
               if ACTIVE_PROFILE == SUCCESSOR_PROFILE else {}),
        },
        "report": {
            "path": contract.REPORT_RELATIVE_PATH,
            "fileSha256": _sha256(report_raw),
            "sealedPayloadSha256": report["sealedPayloadSha256"],
        },
        "designReceipt": design_receipt,
        "reviewerRole": "INDEPENDENT_HOSTILE_REVIEWER",
        "externalIdentityAttestation": contract.NO_EXTERNAL_IDENTITY,
        "hostSemaphore": "IN_PROCESS_OPAQUE",
        "gate": "CLOSED_FAIL_SAFE",
    }


def _closed_gate_fixture(g0_root: Path) -> None:
    g0_root.mkdir(parents=True, exist_ok=True)
    (g0_root / "current-g3-gate-decision.json").write_bytes(
        _canonical_bytes(gate_authority.canonical_gate_payload(False))
    )
    current = gate_authority.CENTRAL_CLASSIFICATIONS.read_bytes()
    closed = gate_authority._central_classification_generation(current, gate_open=False)
    (g0_root / "central-artifact-classification-register.csv").write_bytes(closed)
    (g0_root / "g3-gate-transition-register.csv").write_text(
        ",".join(gate_authority.TRANSITION_HEADER) + "\n", encoding="utf-8"
    )


def _case_rejects(action: Callable[[], None]) -> bool:
    try:
        action()
    except (WorkflowError, OSError, ValueError):
        return True
    return False


def run_self_test() -> dict[str, Any]:
    """Exercise hostile path, Gate, digest-DAG and pair-rollback cases."""
    cases: dict[str, bool] = {}
    cases["active-host-capability-required"] = _case_rejects(
        lambda: _require_active_host_semaphore()
    )
    with tempfile.TemporaryDirectory(prefix="hris-final-preparer-self-test-") as temp:
        root = Path(temp)
        targets = root / "targets"
        targets.mkdir(mode=0o700)
        first = targets / "first.json"
        second = targets / "second.json"
        first.write_bytes(b"old-first\n")
        second.write_bytes(b"old-second\n")
        os.chmod(first, 0o640)
        os.chmod(second, 0o600)

        def fail_after_first(index: int) -> None:
            if index == 1:
                raise OSError("injected first-rename failure")

        cases["pair-first-rename-failure-rejected"] = _case_rejects(
            lambda: atomic_replace_pair(
                [(first, b"new-first\n"), (second, b"new-second\n")],
                post_commit_validate=lambda: None,
                failure_hook=fail_after_first,
            )
        )
        cases["pair-first-rename-failure-rolls-back-bytes"] = (
            first.read_bytes() == b"old-first\n"
            and second.read_bytes() == b"old-second\n"
            and stat.S_IMODE(first.stat().st_mode) == 0o640
            and stat.S_IMODE(second.stat().st_mode) == 0o600
        )
        cases["pair-post-validation-failure-rejected"] = _case_rejects(
            lambda: atomic_replace_pair(
                [(first, b"new-first\n"), (second, b"new-second\n")],
                post_commit_validate=lambda: (_ for _ in ()).throw(
                    WorkflowError("injected post-validation failure")
                ),
            )
        )
        cases["pair-post-validation-failure-rolls-back-both"] = (
            first.read_bytes() == b"old-first\n"
            and second.read_bytes() == b"old-second\n"
        )
        missing_first = targets / "missing-first.json"
        missing_second = targets / "missing-second.json"
        cases["new-pair-failure-rejected"] = _case_rejects(
            lambda: atomic_replace_pair(
                [(missing_first, b"one\n"), (missing_second, b"two\n")],
                post_commit_validate=lambda: None,
                failure_hook=fail_after_first,
            )
        )
        cases["new-pair-failure-removes-torn-generation"] = (
            not missing_first.exists() and not missing_second.exists()
        )
        atomic_replace_pair(
            [(missing_first, b"one\n"), (missing_second, b"two\n")],
            post_commit_validate=lambda: None,
        )
        cases["pair-success-exact-bytes-and-mode"] = (
            missing_first.read_bytes() == b"one\n"
            and missing_second.read_bytes() == b"two\n"
            and stat.S_IMODE(missing_first.stat().st_mode) == TARGET_MODE
            and stat.S_IMODE(missing_second.stat().st_mode) == TARGET_MODE
        )
        symlink = targets / "unsafe-symlink.json"
        symlink.symlink_to(missing_first.name)
        cases["symlink-target-rejected"] = _case_rejects(
            lambda: _safe_relative_path(targets, symlink.name)
        )
        hardlink = targets / "unsafe-hardlink.json"
        os.link(missing_first, hardlink)
        cases["hardlink-target-rejected"] = _case_rejects(
            lambda: _safe_relative_path(targets, hardlink.name)
        )
        writable = targets / "unsafe-writable.json"
        writable.write_bytes(b"unsafe\n")
        os.chmod(writable, 0o666)
        cases["group-world-writable-target-rejected"] = _case_rejects(
            lambda: _safe_relative_path(targets, writable.name)
        )
        cases["path-traversal-rejected"] = _case_rejects(
            lambda: _safe_relative_path(targets, "../escape.json")
        )

        manifest = {
            "manifestId": contract.SOURCE_AUTHORITY_ID,
            "sealedPayloadSha256": ZERO_SHA256,
        }
        manifest["sealedPayloadSha256"] = contract.semantic_seal(manifest)
        manifest_raw = _canonical_bytes(manifest)
        control = {
            "sourceAuthorityManifest": {
                "path": f"coding-readiness/{contract.SOURCE_AUTHORITY_MANIFEST_NAME}",
                "fileSha256": _sha256(manifest_raw),
                "sealedPayloadSha256": manifest["sealedPayloadSha256"],
            }
        }
        try:
            _assert_acyclic_authority_binding(manifest, manifest_raw, control)
            cases["source-to-control-graph-is-acyclic"] = True
        except WorkflowError:
            cases["source-to-control-graph-is-acyclic"] = False
        stale_manifest = copy.deepcopy(manifest)
        stale_manifest["status"] = "changed"
        stale_manifest["sealedPayloadSha256"] = contract.semantic_seal(stale_manifest)
        cases["torn-source-control-generation-rejected"] = _case_rejects(
            lambda: _assert_acyclic_authority_binding(
                stale_manifest, _canonical_bytes(stale_manifest), control
            )
        )
        cyclic_manifest = copy.deepcopy(manifest)
        cyclic_manifest["controlIntake"] = contract.CONTROL_INTAKE_RECORDED_PATH
        cyclic_manifest["sealedPayloadSha256"] = contract.semantic_seal(cyclic_manifest)
        cases["reverse-control-reference-rejected"] = _case_rejects(
            lambda: _assert_acyclic_authority_binding(
                cyclic_manifest, _canonical_bytes(cyclic_manifest), control
            )
        )

        gate_root = root / "gate"
        _closed_gate_fixture(gate_root)
        with exclusive_host_semaphore(
            HOST_VERIFICATION_SEMAPHORE,
            timeout_seconds=1.0,
            lock_root=root / "locks",
        ):
            try:
                assert_exact_closed_gate(gate_root)
                cases["exact-closed-gate-accepted"] = True
            except WorkflowError:
                cases["exact-closed-gate-accepted"] = False
            decision_path = gate_root / "current-g3-gate-decision.json"
            transition_path = gate_root / "g3-gate-transition-register.csv"
            closed_transition = {key: "" for key in gate_authority.TRANSITION_HEADER}
            closed_transition.update(
                {
                    "transition_seq": "1",
                    "transition_id": "G3-GATE-SELFTEST-CLOSED",
                    "target_gate": "CLOSED_FAIL_SAFE",
                    "decision_sha256": contract.file_hash(decision_path),
                    "recorded_at": "2026-09-15T00:00:00Z",
                    "status": "COMMITTED_CLOSED_FAIL_SAFE",
                }
            )
            with transition_path.open("w", newline="", encoding="utf-8") as stream:
                writer = csv.DictWriter(
                    stream,
                    fieldnames=gate_authority.TRANSITION_HEADER,
                    lineterminator="\n",
                )
                writer.writeheader()
                writer.writerow(closed_transition)
            try:
                assert_exact_closed_gate(gate_root)
                cases["committed-closed-transition-tip-accepted"] = True
            except WorkflowError:
                cases["committed-closed-transition-tip-accepted"] = False
            stale_open = copy.deepcopy(closed_transition)
            stale_open["target_gate"] = "OPEN_G3_CODE"
            stale_open["status"] = "COMMITTED_OPEN_AUTHORITATIVE_LIVE"
            with transition_path.open("w", newline="", encoding="utf-8") as stream:
                writer = csv.DictWriter(
                    stream,
                    fieldnames=gate_authority.TRANSITION_HEADER,
                    lineterminator="\n",
                )
                writer.writeheader()
                writer.writerow(stale_open)
            cases["stale-open-transition-tip-rejected"] = _case_rejects(
                lambda: assert_exact_closed_gate(gate_root)
            )
            _closed_gate_fixture(gate_root)
            decision_path.write_bytes(
                _canonical_bytes(gate_authority.canonical_gate_payload(True))
            )
            cases["open-gate-rejected"] = _case_rejects(
                lambda: assert_exact_closed_gate(gate_root)
            )
            invalid = gate_authority.canonical_gate_payload(False)
            invalid["bypass"] = True
            decision_path.write_bytes(_canonical_bytes(invalid))
            cases["closed-gate-extra-field-rejected"] = _case_rejects(
                lambda: assert_exact_closed_gate(gate_root)
            )

        pending = {"generatedAt": "2026-09-15T00:00:00+00:00"}
        pending.update({key: None for key in contract.EVIDENCE_KEYS - set(pending)})
        pending.update(
            {
                "evidenceId": contract.EVIDENCE_ID,
                "producerPrincipalIds": ["principal:self-test-producer"],
                "oracleSha256": ZERO_SHA256,
                "oracleFileSha256": ZERO_SHA256,
                "fixtureSha256": ZERO_SHA256,
                "fixtureFileSha256": ZERO_SHA256,
                "builderFileSha256": ZERO_SHA256,
                "runnerFileSha256": ZERO_SHA256,
                "verifierFileSha256": ZERO_SHA256,
                "independentValidatorFileSha256": ZERO_SHA256,
                "sourceAuthority": {},
                "controlIntake": {},
                "trustedToolRoot": {},
                "expectedProjection": {},
                "candidateHashes": {},
                "executionComparison": {
                    "pg16PayloadSha256": ZERO_SHA256,
                    "pg18PayloadSha256": ZERO_SHA256,
                    "comparableExecutionPayloadSha256": ZERO_SHA256,
                },
            }
        )
        pending["secondReviewer"] = {}
        first_core = contract.evidence_core_seal(pending)
        pending["sealedPayloadSha256"] = first_core
        pending["secondReviewer"] = _expected_pending_reviewer(
            pending["generatedAt"], first_core
        )
        finalized, report = _build_final_pair(
            pending, reviewed_at=dt.datetime(2026, 9, 15, 0, 1, tzinfo=dt.timezone.utc)
        )
        cases["review-binding-does-not-change-evidence-core"] = (
            contract.evidence_core_seal(finalized) == first_core
            and finalized["sealedPayloadSha256"] == first_core
        )
        cases["report-hash-binding-is-one-way"] = (
            finalized["secondReviewer"]["reportFileSha256"]
            == _sha256(_canonical_bytes(report))
            and "evidenceFileSha256" not in report["subject"]
        )

        # Exercise both real workflow entry points against the verifier's own
        # synthetic 100-operation/58-edge bundle.  The production trusted root
        # remains untouched; this scoped test root freezes hashes only in
        # memory and restores the module globals on context exit.
        workflow_root = root / "workflow" / "coding-readiness"
        frozen_spec = copy.deepcopy(contract.TRUSTED_TOOL_ROOT_SPEC)
        frozen_spec["status"] = "TOOLS_FROZEN"
        for label, name in (
            ("builder", contract.BUILDER_NAME),
            ("independentValidator", contract.INDEPENDENT_VALIDATOR_NAME),
            ("runner", contract.RUNNER_NAME),
        ):
            frozen_spec["tools"][label]["fileSha256"] = contract.file_hash(BASE / name)
        frozen_digest = contract.canonical_value_hash(frozen_spec)
        test_now = utc_now()
        with (
            mock.patch.object(contract, "TRUSTED_TOOL_ROOT_SPEC", frozen_spec),
            mock.patch.object(contract, "TRUSTED_TOOL_ROOT_DIGEST", frozen_digest),
        ):
            contract.build_synthetic_bundle(workflow_root, test_now)
            workflow_g0 = workflow_root / "g0"
            _closed_gate_fixture(workflow_g0)
            (workflow_root / contract.SOURCE_AUTHORITY_MANIFEST_NAME).unlink()
            (workflow_g0 / contract.CONTROL_INTAKE_RELATIVE_PATH).unlink()
            with exclusive_host_semaphore(
                HOST_VERIFICATION_SEMAPHORE,
                timeout_seconds=1.0,
                lock_root=root / "workflow-locks",
            ):
                try:
                    authority_receipt = prepare_authority_under_active_lock(
                        workflow_root,
                        workflow_g0,
                        now=test_now - dt.timedelta(minutes=3),
                    )
                    cases["authority-workflow-end-to-end"] = (
                        authority_receipt["status"] == "PASS"
                    )
                except Exception:
                    cases["authority-workflow-end-to-end"] = False
                source_path = workflow_root / contract.SOURCE_AUTHORITY_MANIFEST_NAME
                control_path = workflow_g0 / contract.CONTROL_INTAKE_RELATIVE_PATH
                cases["authority-pair-canonical-and-private"] = (
                    source_path.read_bytes()
                    == _canonical_bytes(contract.strict_json_file(source_path))
                    and control_path.read_bytes()
                    == _canonical_bytes(contract.strict_json_file(control_path))
                    and stat.S_IMODE(source_path.stat().st_mode) == TARGET_MODE
                    and stat.S_IMODE(control_path.stat().st_mode) == TARGET_MODE
                )

                unsigned = contract.strict_json_file(
                    workflow_root / contract.EVIDENCE_RELATIVE_PATH
                )
                source_document = contract.strict_json_file(source_path)
                control_document = contract.strict_json_file(control_path)
                unsigned["sourceAuthority"] = {
                    "path": contract.SOURCE_AUTHORITY_MANIFEST_NAME,
                    "fileSha256": contract.file_hash(source_path),
                    "sealedPayloadSha256": source_document["sealedPayloadSha256"],
                }
                unsigned["controlIntake"] = {
                    "path": contract.CONTROL_INTAKE_RECORDED_PATH,
                    "fileSha256": contract.file_hash(control_path),
                    "sealedPayloadSha256": control_document["sealedPayloadSha256"],
                }
                unsigned["trustedToolRoot"] = contract.trusted_tool_root_reference()
                unsigned["expectedProjection"] = copy.deepcopy(
                    source_document["expectedProjection"]
                )
                unsigned["generatedAt"] = (
                    test_now - dt.timedelta(minutes=2)
                ).isoformat()
                unsigned["sealedPayloadSha256"] = contract.evidence_core_seal(unsigned)
                unsigned["secondReviewer"] = _expected_pending_reviewer(
                    unsigned["generatedAt"], unsigned["sealedPayloadSha256"]
                )
                evidence_path = workflow_root / contract.EVIDENCE_RELATIVE_PATH
                evidence_path.write_bytes(_canonical_bytes(unsigned))
                os.chmod(evidence_path, TARGET_MODE)
                design_path = workflow_root / contract.DESIGN_REPORT_RELATIVE_PATH
                design_path.write_bytes(b"{}\n")
                os.chmod(design_path, TARGET_MODE)
                try:
                    final_receipt = finalize_review_under_active_lock(
                        workflow_root,
                        workflow_g0,
                        now=test_now,
                        allow_replace_for_test=True,
                        design_verifier=lambda _root: {
                            "name": "synthetic-design-verifier",
                            "status": "PASS",
                        },
                    )
                    cases["final-review-workflow-end-to-end"] = (
                        final_receipt["status"] == "PASS"
                    )
                except Exception:
                    cases["final-review-workflow-end-to-end"] = False
                final_evidence_path = workflow_root / contract.EVIDENCE_RELATIVE_PATH
                final_report_path = workflow_root / contract.REPORT_RELATIVE_PATH
                cases["final-pair-canonical-private-and-reciprocal"] = (
                    final_evidence_path.read_bytes()
                    == _canonical_bytes(contract.strict_json_file(final_evidence_path))
                    and final_report_path.read_bytes()
                    == _canonical_bytes(contract.strict_json_file(final_report_path))
                    and stat.S_IMODE(final_evidence_path.stat().st_mode) == TARGET_MODE
                    and stat.S_IMODE(final_report_path.stat().st_mode) == TARGET_MODE
                    and not contract.verify_bundle(
                        workflow_root, g0_root=workflow_g0, run_commands=False
                    ).rows
                )
                cases["already-finalized-evidence-rejected"] = _case_rejects(
                    lambda: finalize_review_under_active_lock(
                        workflow_root,
                        workflow_g0,
                        now=test_now,
                        design_verifier=lambda _root: {},
                    )
                )
                malformed = contract.strict_json_file(final_evidence_path)
                malformed["executionComparison"] = None
                malformed["sealedPayloadSha256"] = contract.evidence_core_seal(malformed)
                malformed["secondReviewer"] = _expected_pending_reviewer(
                    malformed["generatedAt"], malformed["sealedPayloadSha256"]
                )
                final_evidence_path.write_bytes(_canonical_bytes(malformed))
                cases["malformed-unsigned-nested-shape-rejected"] = _case_rejects(
                    lambda: _load_unsigned_evidence(workflow_root)
                )

    failed = sorted(name for name, passed in cases.items() if not passed)
    return {
        "schema": "dwp.hris.modern-causal-final-preparer-self-test.v1",
        "status": "PASS" if not failed else "FAIL",
        "caseCount": len(cases),
        "passedCount": len(cases) - len(failed),
        "failedCases": failed,
        "cases": cases,
        "trustedToolRootUnmodified": contract.TRUSTED_TOOL_ROOT_SPEC["status"],
    }


def successor_preparer_self_test() -> dict[str, Any]:
    """Exercise successor no-replace and pending-transition controls only."""
    cases: dict[str, bool] = {}
    failures: list[str] = []
    preflight: dict[str, Any] | None = None
    with tempfile.TemporaryDirectory(prefix="modern-causal-successor-preparer-lock-") as lock_temp:
        with guarded_modern_successor_read(
            __file__, lock_root=Path(lock_temp) / "locks"
        ):
            failures.extend(successor_profile_hostile_self_test(BASE, BLUEPRINT_ROOT))
            preflight = successor_preflight()
            with tempfile.TemporaryDirectory(prefix="modern-causal-successor-preparer-") as temporary:
                root = Path(temporary)
                first = root / "first.json"
                second = root / "second.json"
                try:
                    create_only_pair([(first, b"first\n"), (second, b"second\n")])
                    before = (first.read_bytes(), second.read_bytes())
                    try:
                        create_only_pair([(first, b"mutate\n"), (second, b"mutate\n")])
                    except (FileExistsError, SuccessorProfileError, WorkflowError):
                        cases["existing-successor-pair-rejected"] = True
                    else:
                        cases["existing-successor-pair-rejected"] = False
                    cases["existing-successor-pair-unchanged"] = (
                        (first.read_bytes(), second.read_bytes()) == before
                    )
                except Exception as exc:
                    cases["existing-successor-pair-rejected"] = False
                    cases["existing-successor-pair-unchanged"] = False
                    failures.append(f"create-only-pair-harness:{type(exc).__name__}:{exc}")
    cases["profile-path-and-predecessor-controls"] = not failures
    assert preflight is not None
    cases["predecessor-pins-exact"] = not bool(preflight["predecessorPinFailures"])
    cases["successor-targets-are-clean"] = not bool(preflight["successorTargetFailures"])
    cases["successor-inputs-pending"] = bool(preflight["missingSuccessorInputs"])
    cases["successor-stage-graph-acyclic"] = bool(preflight.get("stageState", {}).get("acyclic"))
    if not all(cases.values()):
        failures.extend(name for name, passed in cases.items() if not passed)
    return {
        "schema": "dwp.hris.modern-causal-final-preparer-successor-self-test.v1",
        "status": "PASS" if not failures else "FAIL",
        "profile": ACTIVE_PROFILE,
        "tests": len(cases) + 2,
        "cases": cases,
        "failures": sorted(set(failures)),
        "canonicalCounts": ACTIVE_PROFILE_METADATA["canonicalCounts"],
        "policy": ACTIVE_PROFILE_METADATA["policy"],
        "predecessorDisposition": ACTIVE_PROFILE_METADATA["predecessorDisposition"],
    }


def emit(payload: dict[str, Any], compact: bool) -> None:
    print(
        json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":") if compact else None,
            indent=None if compact else 2,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--prepare-authority", action="store_true")
    mode.add_argument("--finalize-review", action="store_true")
    mode.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    parser.add_argument(
        "--host-semaphore-timeout",
        type=int,
        default=300,
        metavar="SECONDS",
    )
    parser.add_argument(
        "--profile", choices=(LEGACY_PROFILE, SUCCESSOR_PROFILE), default=LEGACY_PROFILE,
        help=("artifact chain profile; legacy-v1 preserves historical workflow, "
              "successor-v2 uses collision-free v2/v3 outputs with no-replace publication"),
    )
    args = parser.parse_args()
    if not 0 <= args.host_semaphore_timeout <= 300:
        parser.error("--host-semaphore-timeout must be between 0 and 300")
    try:
        configure_profile(args.profile)
    except (SuccessorProfileError, ValueError) as error:
        payload = {
            "schema": "dwp.hris.modern-causal-final-preparer-profile-error.v1",
            "status": "FAIL",
            "errors": [f"{type(error).__name__}: {error}"],
            "profile": args.profile,
        }
        emit(payload, args.compact)
        return 1
    if args.self_test:
        if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
            payload = successor_preparer_self_test()
            emit(payload, args.compact)
            return 0 if payload["status"] == "PASS" else 1
        payload = run_self_test()
        emit(payload, args.compact)
        return 0 if payload["status"] == "PASS" else 1
    try:
        if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
            preflight = successor_preflight()
            required_stage = "authority" if args.prepare_authority else "final-review"
            stage_missing = pending_successor_inputs(BASE, BLUEPRINT_ROOT, stage=required_stage)
            target_keys = (
                ("sourceAuthority", "controlIntake") if args.prepare_authority
                else ("finalEvidence", "finalReview")
            )
            stage_target_failures = successor_target_failures(
                BASE, BLUEPRINT_ROOT, keys=target_keys
            )
            if (stage_missing or preflight["predecessorPinFailures"]
                    or stage_target_failures
                    or preflight.get("acceptedLivePreflight", {}).get("status") != "READY"
                    or not preflight.get("stageState", {}).get("acyclic")):
                payload = {
                    "schema": "dwp.hris.modern-causal-final-preparer-successor-check.v1",
                    "mode": "PREPARE_AUTHORITY" if args.prepare_authority else "FINALIZE_REVIEW",
                    "status": "PENDING_ACCEPTED_CANONICAL_TRANSITION",
                    "errors": [{
                        "code": "P0-SUCCESSOR-PROFILE-PENDING",
                        "subject": ACTIVE_PROFILE,
                        "detail": (
                            f"stage={required_stage} missing={stage_missing} "
                            f"predecessorPinFailures={preflight['predecessorPinFailures']} "
                            f"successorTargetFailures={stage_target_failures} "
                            f"acceptedLive={preflight.get('acceptedLivePreflight', {}).get('status')}"
                        ),
                    }],
                    "gate": "CLOSED_FAIL_SAFE",
                    "profile": ACTIVE_PROFILE,
                    "activeGateChain": preflight["activeGateChain"],
                    "canonicalCounts": preflight["canonicalCounts"],
                    "policy": preflight["policy"],
                    "predecessorDisposition": preflight["predecessorDisposition"],
                    "externalIdentityAttestation": contract.NO_EXTERNAL_IDENTITY,
                }
                emit(payload, args.compact)
                return 1
        with exclusive_host_semaphore(
            HOST_VERIFICATION_SEMAPHORE,
            timeout_seconds=float(args.host_semaphore_timeout),
        ):
            if args.prepare_authority:
                payload = prepare_authority_under_active_lock()
            else:
                payload = finalize_review_under_active_lock()
    except Exception as exc:
        payload = {
            "schema": "dwp.hris.modern-causal-final-preparer.v1",
            "mode": "PREPARE_AUTHORITY" if args.prepare_authority else "FINALIZE_REVIEW",
            "status": "FAIL",
            "errors": [f"{type(exc).__name__}: {exc}"],
            "gate": "CLOSED_FAIL_SAFE",
            "externalIdentityAttestation": contract.NO_EXTERNAL_IDENTITY,
        }
    emit(payload, args.compact)
    return 0 if payload.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
