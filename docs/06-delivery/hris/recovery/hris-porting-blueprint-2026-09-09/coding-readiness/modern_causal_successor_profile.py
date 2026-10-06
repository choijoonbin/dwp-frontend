"""Shared, fail-closed profile and publication helpers for the causal tools.

The historical causal bundle was written before the downstream v4 transition
plan.  This module gives the five reviewer tools a named successor profile
without making the historical files aliases for the new chain.  It is
deliberately data-only: it never reads a candidate to derive expected values.

The successor profile is intentionally pending until an independently accepted
canonical/live transition publishes its review inputs.  A caller may therefore
ask each tool for a deterministic preflight, but a missing or drifted
predecessor cannot be silently replaced and an existing target cannot be
overwritten.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import tempfile
from pathlib import Path
from typing import Any

from modern_successor_reader_guard import require_active_reader_guard


LEGACY_PROFILE = "legacy-v1"
SUCCESSOR_PROFILE = "successor-v2"
PROFILE_NAMES = (LEGACY_PROFILE, SUCCESSOR_PROFILE)

# Successor inputs are deliberately outside the output set.  They are supplied
# by the canonical/live promotion authority only after an independent
# acceptance record exists.  Keeping these names separate from
# ``SUCCESSOR_ARTIFACTS`` prevents a stage from treating its own output as an
# input and makes the first-publication order auditable.
SUCCESSOR_ACCEPTED_LIVE_MANIFEST = (
    "modern-independent-successor/accepted-live-canonical.v1.json"
)
SUCCESSOR_INDEPENDENT_ACCEPTANCE = (
    "modern-independent-successor/accepted-live-canonical-independent-acceptance.v1.json"
)
SUCCESSOR_UNSIGNED_EVIDENCE = (
    "reports/modern-causal-independent-pg-evidence.v3.unsigned.json"
)

SUCCESSOR_STAGE_ORDER = (
    "review-input",
    "oracle",
    "fixture",
    "authority",
    "pg-unsigned",
    "final-review",
    "endorsement",
)

# These are input keys, never output keys for the same stage.  In particular,
# the oracle stage does not require oracle/fixture and final review consumes a
# distinct unsigned staging file before creating final evidence.
SUCCESSOR_STAGE_PREREQUISITES = {
    "review-input": ("acceptedLiveManifest", "independentAcceptance"),
    "oracle": ("reviewInventory", "reviewFinalization"),
    "fixture": ("oracle",),
    "authority": ("oracle", "fixture", "reviewInventory"),
    "pg-unsigned": ("oracle", "fixture", "sourceAuthority", "controlIntake"),
    "final-review": (
        "oracle", "fixture", "sourceAuthority", "controlIntake",
        "designFindings", "pgUnsigned",
    ),
    "endorsement": (
        "oracle", "fixture", "sourceAuthority", "controlIntake",
        "designFindings", "finalReview", "finalEvidence",
    ),
}

SUCCESSOR_STAGE_OUTPUTS = {
    "review-input": ("reviewInventory", "reviewFinalization"),
    "oracle": ("oracle",),
    "fixture": ("fixture",),
    "authority": ("sourceAuthority", "controlIntake"),
    "pg-unsigned": ("pgUnsigned",),
    "final-review": ("finalEvidence", "finalReview"),
    "endorsement": (),
}

# These are source-derived closure values from the sealed downstream plan.
# They are metadata for a future successor build, never inferred from a
# mutable candidate directory.
SUCCESSOR_CANONICAL_COUNTS = {
    "publicOperations": 199,
    "commands": 133,
    "queries": 66,
    "systemHandlers": 27,
    "publicEvents": 157,
    "tableSpecifications": 131,
    "ownerPortOperationContracts": 18,
    "ownerDependencyContracts": 2,
}

# The successor global SSOT has one unchanged Listening local dependency and
# one exact PAY owner dependency.  These are pins, not values derived from a
# candidate directory: a successor accepted-live bundle must present this
# exact ordered pair and each contract must carry the matching semantic seal.
SUCCESSOR_OWNER_DEPENDENCY_PINS = {
    "configuration.resolveSignedParticipationOfferForEntitledSubject.v1": (
        "4409bdbfc2a2432264f5731357d298f1c2d0dcb0bb41960a37ca55f8cb85c4c5"
    ),
    "compensation.resolveApprovedSnapshotForPayroll.v1": (
        "ccc91e86e68792e3efee027ed197d3443f1c7627059052d1e9b589523b8dad1e"
    ),
}
SUCCESSOR_OWNER_DEPENDENCY_IDS = tuple(SUCCESSOR_OWNER_DEPENDENCY_PINS)
SUCCESSOR_OWNER_DEPENDENCY_RECEIPT_SCHEMA = (
    "dwp.hris.modern.causal.successor-owner-dependency-receipt.v1"
)

# The global SSOT and exact successor projections are also bound to this
# create-only closed-set manifest.  Keep the rendered file pin separate from
# the manifest's semantic payload seal: both are required to reject a
# same-path replacement or a resealed manifest with different bytes.
SUCCESSOR_CLOSED_SET_MANIFEST_PIN = {
    "manifestId": "dwp.hris.modern.closed-set-manifest.v3",
    "path": "modern-capability-closed-set-manifest.v3.json",
    "fileSha256": "9b3a882e666debfe7c63fb61cd28bb12c104adcd53018dc1fcdca1a4e48b04f5",
    "sealedPayloadSha256": "76cb3ea4f49ffc7bf00943e9f54863ff3670db4ec634f4c40c8abd4f62d762a5",
    "countsAreDerivedOnly": True,
}

SUCCESSOR_POLICY = {
    "path": "modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v5.json",
    "fileSha256": "ec29008105473639a2a6ffcf116295e410de4c017d5bf1c0fd5a02c228cb088b",
    "sealedPayloadSha256": "4bdfd9282371ce9c6f32db6d2d50265b3480c8d4157d35132c1d7dccefcd69e2",
}

# Exact byte/seal pins for the predecessor artifacts that are present in the
# reviewed v1 chain.  Missing later artifacts are represented explicitly as
# pending below; no hash is invented for an unpublished predecessor.
SUCCESSOR_PREDECESSOR_PINS = {
    "modern-causal-independent-oracle.v1.json": {
        "fileSha256": "4e4164b5d0ef2e6817cf4e43593182d58335bb2ab8035a2637f2190e19b56828",
        "sealedPayloadSha256": "f6d933bd39591c31bab9f4d524dfef35476612746520151dba2eea7e3ec48d46",
    },
    "modern-causal-independent-pg-fixtures.v1.json": {
        "fileSha256": "b2400ca2ed53b4c231653260c893cfa7227924bab7becaf09ccc806d82ffab15",
        "sealedPayloadSha256": "75026a60d28b4248607bce6e3551b6b9bd7add03f602239dc2a9126541442ac7",
    },
    "modern-causal-independent-review-inventory.v1.json": {
        "fileSha256": "496f0f42db3106331f5631bc2094a8d25759328a4bc5f83f296df382e923b84f",
        "sealedPayloadSha256": "6ce5b973cdfd5d249d2831c46bac80632602590061b776335efae01fddda3b21",
    },
    "modern-causal-independent-reviewed-finalization.v1.json": {
        "fileSha256": "1720100fb9f0198bfc2f911cd386f43eb349ad562ba620162079bb056071a149",
        "sealedPayloadSha256": "2fb9d730cffae55b569b8a14c8fa4c4d2853be2fff590ffd8807047afd5a408b",
    },
    "reports/modern-causal-independent-pg-evidence.v1.json": {
        "fileSha256": "246ba77db5f4818ae4a37cdf8e69ef0e1bf4f2308327aae13f786d5e71c34fc2",
        "sealedPayloadSha256": "9228f1d01f76d1cb70082d2205d45ea9d1923e1f5a3711c67f611fa0ad912f19",
    },
}

# The v1 final hostile review, source manifest, and Control intake were not
# published in this workspace.  Keeping their names here makes the pending
# state auditable without fabricating hashes.
SUCCESSOR_UNPUBLISHED_PREDECESSORS = (
    "reports/modern-causal-independent-pg-evidence.v2.json",
    "reports/modern-causal-independent-final-hostile-review.v1.json",
    "modern-causal-final-source-authority-manifest.v1.json",
    "g0/control-evidence-intake/modern-causal-final-endorsement.v1.json",
)

SUCCESSOR_ARTIFACTS = {
    "reviewInventory": "modern-causal-independent-review-inventory.v2.json",
    "reviewFinalization": "modern-causal-independent-reviewed-finalization.v2.json",
    "oracle": "modern-causal-independent-oracle.v2.json",
    "fixture": "modern-causal-independent-pg-fixtures.v2.json",
    "pgEvidence": "reports/modern-causal-independent-pg-evidence.v3.json",
    "designFindings": "reports/modern-causal-independent-design-findings.v2.json",
    "finalReview": "reports/modern-causal-independent-final-hostile-review.v2.json",
    "sourceAuthority": "modern-causal-final-source-authority-manifest.v2.json",
    "controlIntake": "g0/control-evidence-intake/modern-causal-final-endorsement.v2.json",
    "listeningAuthority": "sys-listening-stream-authority-successor.v2.json",
}

SUCCESSOR_IDS = {
    "oracle": "dwp.hris.modern.causal-independent-oracle.v2",
    "fixture": "dwp.hris.modern.causal-independent-pg-fixtures.v2",
    "pgEvidence": "dwp.hris.modern.causal-independent-pg-evidence.v3",
    "finalReview": "dwp.hris.modern.causal-independent-final-hostile-review.v2",
    "sourceAuthority": "dwp.hris.modern-causal-final-source-authority.v2",
    "controlIntake": "dwp.hris.modern-causal-final-control-intake.v2",
}


class SuccessorProfileError(ValueError):
    """Raised for an unsafe profile, drifted pin, or occupied successor target."""


def require_profile(name: str) -> str:
    if name not in PROFILE_NAMES:
        raise SuccessorProfileError(
            f"unknown causal artifact profile {name!r}; expected one of {PROFILE_NAMES}"
        )
    return name


def successor_paths(base: Path, blueprint_root: Path) -> dict[str, Path]:
    """Resolve the closed successor set under the supplied trusted roots."""
    result: dict[str, Path] = {}
    for key, relative in SUCCESSOR_ARTIFACTS.items():
        relative_path = Path(relative)
        if relative_path.is_absolute() or "." in relative_path.parts or ".." in relative_path.parts:
            raise SuccessorProfileError(f"unsafe successor path constant: {relative}")
        anchor = blueprint_root if relative_path.parts[0] == "g0" else base
        result[key] = anchor.joinpath(*relative_path.parts)
    return result


def successor_input_paths(base: Path, blueprint_root: Path) -> dict[str, Path]:
    """Resolve the accepted-live and unsigned staging inputs.

    These paths are intentionally not part of ``successor_paths``: neither is
    a successor artifact output and neither may be created by an output stage.
    """
    return {
        "acceptedLiveManifest": base / SUCCESSOR_ACCEPTED_LIVE_MANIFEST,
        "independentAcceptance": base / SUCCESSOR_INDEPENDENT_ACCEPTANCE,
        "pgUnsigned": base / SUCCESSOR_UNSIGNED_EVIDENCE,
    }


def successor_stage_paths(base: Path, blueprint_root: Path) -> dict[str, Path]:
    """Return the closed path namespace used by every successor stage."""
    result = successor_paths(base, blueprint_root)
    result.update(successor_input_paths(base, blueprint_root))
    # ``pgEvidence`` is the finalized evidence path; unsigned evidence has a
    # separate staging name so finalization never attempts to replace it.
    result["finalEvidence"] = result["pgEvidence"]
    return result


def stage_prerequisites(stage: str, base: Path, blueprint_root: Path) -> dict[str, Any]:
    """Describe one acyclic stage's inputs, outputs, and missing files."""
    if stage not in SUCCESSOR_STAGE_ORDER:
        raise SuccessorProfileError(
            f"unknown successor stage {stage!r}; expected one of {SUCCESSOR_STAGE_ORDER}"
        )
    paths = successor_stage_paths(base, blueprint_root)
    inputs = tuple(SUCCESSOR_STAGE_PREREQUISITES[stage])
    outputs = tuple(SUCCESSOR_STAGE_OUTPUTS[stage])
    missing = [key for key in inputs if not paths[key].is_file()]
    target_failures = successor_target_failures(
        base, blueprint_root, keys=outputs
    ) if outputs else []
    return {
        "stage": stage,
        "prerequisites": list(inputs),
        "outputs": list(outputs),
        "paths": {key: str(path) for key, path in paths.items()},
        "missing": missing,
        "targetFailures": target_failures,
        "selfDependency": sorted(set(inputs) & set(outputs)),
        "downstreamOutputDependency": sorted(
            set(inputs) & {
                item for later in SUCCESSOR_STAGE_ORDER
                for item in SUCCESSOR_STAGE_OUTPUTS[later]
                if SUCCESSOR_STAGE_ORDER.index(later) > SUCCESSOR_STAGE_ORDER.index(stage)
            }
        ),
    }


def successor_stage_state(base: Path, blueprint_root: Path) -> dict[str, Any]:
    """Return deterministic, stage-specific readiness without writing files."""
    stages = [stage_prerequisites(stage, base, blueprint_root)
              for stage in SUCCESSOR_STAGE_ORDER]
    return {
        "profile": SUCCESSOR_PROFILE,
        "stageOrder": list(SUCCESSOR_STAGE_ORDER),
        "stages": stages,
        "acyclic": all(not row["selfDependency"] and not row["downstreamOutputDependency"]
                        for row in stages),
    }


SUCCESSOR_LIVE_SOURCE_FILES = {
    "operationSsot": "modern-capability-operation-causal-contract-ssot.v2.json",
    "causal": "modern-capability-causal-state-contracts.v2.json",
    "exact": "modern-capability-exact-schema-contracts.v1.json",
    "events": "modern-capability-event-payload-contracts.v1.json",
    "semanticBindings": "modern-capability-semantic-bindings.v1.json",
    "publicIdentity": "modern-capability-public-identity-registry.v1.json",
    "listeningAuthority": "sys-listening-stream-authority-successor.v2.json",
    "closedSet": "modern-capability-closed-set-manifest.v3.json",
}


def _safe_relative_child(base: Path, relative: str, *, label: str) -> Path:
    candidate = Path(relative)
    if (
        not relative
        or candidate.is_absolute()
        or "." in candidate.parts
        or ".." in candidate.parts
        or "candidate" in relative.lower()
    ):
        raise SuccessorProfileError(f"unsafe {label} relative path: {relative!r}")
    path = base.joinpath(*candidate.parts)
    cursor = base
    try:
        metadata = cursor.lstat()
    except OSError as exc:
        raise SuccessorProfileError(f"{label} base unavailable: {base}: {exc}") from exc
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        raise SuccessorProfileError(f"{label} base must be a real directory: {base}")
    for part in candidate.parts[:-1]:
        cursor = cursor / part
        try:
            row = cursor.lstat()
        except OSError as exc:
            raise SuccessorProfileError(f"{label} parent unavailable: {cursor}: {exc}") from exc
        if stat.S_ISLNK(row.st_mode) or not stat.S_ISDIR(row.st_mode):
            raise SuccessorProfileError(f"{label} parent must be a real directory: {cursor}")
        if stat.S_IMODE(row.st_mode) & 0o022:
            raise SuccessorProfileError(f"{label} parent is group/world writable: {cursor}")
    return path


def _strict_regular_file(path: Path, *, label: str) -> bytes:
    try:
        metadata = path.lstat()
    except OSError as exc:
        raise SuccessorProfileError(f"{label} unavailable: {path}: {exc}") from exc
    if (
        stat.S_ISLNK(metadata.st_mode)
        or not stat.S_ISREG(metadata.st_mode)
        or metadata.st_nlink != 1
        or stat.S_IMODE(metadata.st_mode) & 0o022
    ):
        raise SuccessorProfileError(f"{label} is not a private regular file: {path}")
    return path.read_bytes()


def _canonical_document(raw: bytes, *, label: str) -> dict[str, Any]:
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SuccessorProfileError(f"{label} is not valid UTF-8 JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise SuccessorProfileError(f"{label} top-level object required")
    return value


def _semantic_hash(value: dict[str, Any]) -> str:
    return hashlib.sha256(
        json.dumps(
            {key: item for key, item in value.items() if key != "sealedPayloadSha256"},
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    ).hexdigest()


def successor_owner_dependency_receipt() -> dict[str, Any]:
    """Return the immutable successor global owner-dependency pin receipt."""
    listening_id, pay_id = SUCCESSOR_OWNER_DEPENDENCY_IDS
    return {
        "schema": SUCCESSOR_OWNER_DEPENDENCY_RECEIPT_SCHEMA,
        "ownerDependencyContracts": SUCCESSOR_CANONICAL_COUNTS[
            "ownerDependencyContracts"
        ],
        "dependencyContractIds": list(SUCCESSOR_OWNER_DEPENDENCY_IDS),
        "dependencyContractSeals": dict(SUCCESSOR_OWNER_DEPENDENCY_PINS),
        "listeningDependencyContracts": 1,
        "payDependencyContracts": 1,
        "listeningDependencyContractId": listening_id,
        "payDependencyContractId": pay_id,
        "authority": "ACCEPTED_LIVE_OPERATION_SSOT_EXACT_SEALED_PINS",
    }


def verify_successor_owner_dependency_receipt(
    value: Any, *, label: str = "successor owner-dependency receipt"
) -> dict[str, Any]:
    """Reject a missing or mutated successor owner-dependency receipt."""
    expected = successor_owner_dependency_receipt()
    if value != expected:
        raise SuccessorProfileError(
            f"{label} drift: expected={expected} actual={value}"
        )
    return expected


def verify_successor_owner_dependencies(
    document: Any, *, label: str = "successor ownerDependencyContracts"
) -> dict[str, Any]:
    """Verify the exact ordered global SSOT dependency contract closure.

    The first row is intentionally the pre-existing Listening local
    dependency.  The second row is the PAY snapshot read dependency.  Both
    IDs and both semantic seals are fixed by the reviewed successor source;
    accepting a merely counted or re-sealed replacement would break the
    cross-service authority boundary.
    """
    if not isinstance(document, dict):
        raise SuccessorProfileError(f"{label} must be an object")
    dependencies = document.get("ownerDependencyContracts")
    if not isinstance(dependencies, list):
        raise SuccessorProfileError(f"{label} must be an array")
    if len(dependencies) != SUCCESSOR_CANONICAL_COUNTS["ownerDependencyContracts"]:
        raise SuccessorProfileError(
            f"{label} count must be exactly two: actual={len(dependencies)}"
        )
    ids = tuple(
        row.get("dependencyContractId")
        if isinstance(row, dict) else None
        for row in dependencies
    )
    if ids != SUCCESSOR_OWNER_DEPENDENCY_IDS:
        raise SuccessorProfileError(
            f"{label} IDs drift: expected={SUCCESSOR_OWNER_DEPENDENCY_IDS} actual={ids}"
        )
    for dependency_id, row in zip(SUCCESSOR_OWNER_DEPENDENCY_IDS, dependencies):
        if not isinstance(row, dict):
            raise SuccessorProfileError(f"{label} row is not an object: {dependency_id}")
        expected_seal = SUCCESSOR_OWNER_DEPENDENCY_PINS[dependency_id]
        if row.get("sealedPayloadSha256") != expected_seal:
            raise SuccessorProfileError(
                f"{label} seal drift for {dependency_id}: "
                f"expected={expected_seal} actual={row.get('sealedPayloadSha256')}"
            )
        actual_seal = _semantic_hash(row)
        if actual_seal != expected_seal:
            raise SuccessorProfileError(
                f"{label} semantic seal invalid for {dependency_id}: "
                f"expected={expected_seal} actual={actual_seal}"
            )
    for container_name in ("scope", "ownerPortContractClosure"):
        container = document.get(container_name)
        if isinstance(container, dict) and container.get("ownerDependencyContracts") != 2:
            raise SuccessorProfileError(
                f"{label} {container_name}.ownerDependencyContracts must be 2"
            )
    return successor_owner_dependency_receipt()


def verify_successor_closed_set_manifest_reference(
    document: Any, *, label: str = "successor closed-set manifest reference"
) -> dict[str, Any]:
    """Verify a successor document's exact closed-set manifest reference.

    Some successor projections intentionally carry only the manifest ID and
    semantic seal, while SSOT/exact/manifest rows carry the rendered file pin
    as well.  The required fields are therefore checked in both forms, with
    any optional fields required to match the final reviewed pin.
    """
    if not isinstance(document, dict):
        raise SuccessorProfileError(f"{label} must be an object")
    reference = document.get("closedSetManifest")
    if not isinstance(reference, dict):
        raise SuccessorProfileError(f"{label} is missing")
    expected = SUCCESSOR_CLOSED_SET_MANIFEST_PIN
    for key in ("manifestId", "sealedPayloadSha256"):
        if reference.get(key) != expected[key]:
            raise SuccessorProfileError(
                f"{label} {key} drift: expected={expected[key]} actual={reference.get(key)}"
            )
    for key in ("path", "fileSha256", "countsAreDerivedOnly"):
        if key in reference and reference.get(key) != expected[key]:
            raise SuccessorProfileError(
                f"{label} {key} drift: expected={expected[key]} actual={reference.get(key)}"
            )
    return dict(expected)


def accepted_live_paths(base: Path, blueprint_root: Path) -> dict[str, Path]:
    """Resolve the manifest, independent acceptance, and live source paths."""
    manifest = _safe_relative_child(
        base, SUCCESSOR_ACCEPTED_LIVE_MANIFEST, label="accepted-live manifest"
    )
    acceptance = _safe_relative_child(
        base, SUCCESSOR_INDEPENDENT_ACCEPTANCE, label="independent acceptance"
    )
    return {
        "manifest": manifest,
        "acceptance": acceptance,
    }


def verify_accepted_live_canonical(
    base: Path,
    blueprint_root: Path,
) -> dict[str, Any]:
    """Verify an independently accepted live canonical source bundle.

    The returned source map is derived only from the accepted-live manifest;
    candidate directories are rejected as paths and are never opened here.
    The independent acceptance record binds the complete manifest bytes in one
    direction, avoiding a circular manifest/acceptance seal.
    """
    paths = accepted_live_paths(base, blueprint_root)
    manifest_raw = _strict_regular_file(paths["manifest"], label="accepted-live manifest")
    manifest = _canonical_document(manifest_raw, label="accepted-live manifest")
    if manifest.get("sealedPayloadSha256") != _semantic_hash(manifest):
        raise SuccessorProfileError("accepted-live manifest semantic seal is invalid")
    if manifest.get("manifestId") != "dwp.hris.modern.accepted-live-canonical.v1":
        raise SuccessorProfileError("accepted-live manifest identity is invalid")
    if manifest.get("schemaVersion") != 1 or manifest.get("status") != "ACCEPTED_LIVE_CANONICAL":
        raise SuccessorProfileError("accepted-live manifest is not an accepted v1 live source")
    if manifest.get("canonicalCounts") != SUCCESSOR_CANONICAL_COUNTS:
        raise SuccessorProfileError("accepted-live source-derived counts are not the v4 closure")
    live_root_name = manifest.get("liveRoot")
    live_root = _safe_relative_child(base, str(live_root_name), label="accepted-live root")
    try:
        live_metadata = live_root.lstat()
    except OSError as exc:
        raise SuccessorProfileError(f"accepted-live root unavailable: {live_root}: {exc}") from exc
    if stat.S_ISLNK(live_metadata.st_mode) or not stat.S_ISDIR(live_metadata.st_mode):
        raise SuccessorProfileError("accepted-live root must be a real directory")
    if stat.S_IMODE(live_metadata.st_mode) & 0o022:
        raise SuccessorProfileError("accepted-live root is group/world writable")

    acceptance_raw = _strict_regular_file(paths["acceptance"], label="independent acceptance")
    acceptance = _canonical_document(acceptance_raw, label="independent acceptance")
    if acceptance.get("sealedPayloadSha256") != _semantic_hash(acceptance):
        raise SuccessorProfileError("independent acceptance semantic seal is invalid")
    if acceptance.get("acceptanceId") != "dwp.hris.modern.accepted-live-canonical-independent-acceptance.v1":
        raise SuccessorProfileError("independent acceptance identity is invalid")
    if acceptance.get("schemaVersion") != 1 or acceptance.get("status") != "PASS_ACCEPTED_LIVE_CANONICAL":
        raise SuccessorProfileError("independent acceptance status is not PASS")
    if acceptance.get("candidateAsOracle") is not False:
        raise SuccessorProfileError("candidate material cannot be oracle authority")
    if acceptance.get("authority") != "INDEPENDENT_LIVE_CANONICAL_ACCEPTANCE":
        raise SuccessorProfileError("independent acceptance authority is invalid")
    accepted_manifest = acceptance.get("acceptedManifest")
    if not isinstance(accepted_manifest, dict):
        raise SuccessorProfileError("independent acceptance manifest binding is missing")
    if (
        accepted_manifest.get("path") != SUCCESSOR_ACCEPTED_LIVE_MANIFEST
        or accepted_manifest.get("fileSha256") != hashlib.sha256(manifest_raw).hexdigest()
        or accepted_manifest.get("sealedPayloadSha256") != manifest["sealedPayloadSha256"]
    ):
        raise SuccessorProfileError("independent acceptance does not bind exact manifest bytes")
    if acceptance.get("canonicalCounts") != SUCCESSOR_CANONICAL_COUNTS:
        raise SuccessorProfileError("independent acceptance count profile drift")

    declared = manifest.get("files")
    if not isinstance(declared, dict) or set(declared) != set(SUCCESSOR_LIVE_SOURCE_FILES):
        raise SuccessorProfileError("accepted-live source file closed set is invalid")
    sources: dict[str, Path] = {}
    source_refs: dict[str, dict[str, str]] = {}
    for key, expected_name in SUCCESSOR_LIVE_SOURCE_FILES.items():
        row = declared.get(key)
        if not isinstance(row, dict) or set(row) != {"path", "fileSha256"}:
            raise SuccessorProfileError(f"accepted-live source reference shape invalid: {key}")
        relative = row.get("path")
        if relative != expected_name:
            raise SuccessorProfileError(
                f"accepted-live source path substitution for {key}: {relative!r}"
            )
        source = _safe_relative_child(live_root, relative, label=f"accepted-live {key}")
        raw = _strict_regular_file(source, label=f"accepted-live {key}")
        actual = hashlib.sha256(raw).hexdigest()
        if actual != row.get("fileSha256"):
            raise SuccessorProfileError(
                f"accepted-live source hash drift for {key}: expected={row.get('fileSha256')} actual={actual}"
            )
        sources[key] = source
        source_refs[key] = {"path": relative, "fileSha256": actual}
    closed_set = _canonical_document(
        sources["closedSet"].read_bytes(), label="accepted-live closed-set manifest"
    )
    closed_set_pin = dict(SUCCESSOR_CLOSED_SET_MANIFEST_PIN)
    if source_refs["closedSet"]["fileSha256"] != closed_set_pin["fileSha256"]:
        raise SuccessorProfileError(
            "accepted-live closed-set manifest rendered file pin drift: "
            f"expected={closed_set_pin['fileSha256']} "
            f"actual={source_refs['closedSet']['fileSha256']}"
        )
    if (
        closed_set.get("manifestId") != closed_set_pin["manifestId"]
        or closed_set.get("sealedPayloadSha256") != closed_set_pin["sealedPayloadSha256"]
    ):
        raise SuccessorProfileError(
            "accepted-live closed-set manifest semantic pin drift: "
            f"expected={closed_set_pin} actual={{'manifestId': {closed_set.get('manifestId')!r}, "
            f"'sealedPayloadSha256': {closed_set.get('sealedPayloadSha256')!r}}}"
        )
    # SSOT/exact projections carry the full rendered reference.  The semantic
    # projection may retain only the ID+seal, but it must still bind the same
    # final manifest payload.
    for key in ("operationSsot", "exact", "semanticBindings"):
        projected = _canonical_document(
            sources[key].read_bytes(), label=f"accepted-live {key}"
        )
        verify_successor_closed_set_manifest_reference(
            projected, label=f"accepted-live {key}.closedSetManifest"
        )
    # The operation SSOT is the global owner-dependency authority.  Exact and
    # semantic projections must carry the same bytes so a successor receipt
    # cannot claim PAY coverage while only the Listening-local dependency was
    # projected downstream.
    dependency_receipt: dict[str, Any] | None = None
    for key in ("operationSsot", "exact", "semanticBindings"):
        document = _canonical_document(
            sources[key].read_bytes(), label=f"accepted-live {key}"
        )
        current_receipt = verify_successor_owner_dependencies(
            document, label=f"accepted-live {key}.ownerDependencyContracts"
        )
        if dependency_receipt is None:
            dependency_receipt = current_receipt
        elif current_receipt != dependency_receipt:
            raise SuccessorProfileError(
                f"accepted-live owner-dependency receipt projection drift: {key}"
            )
    return {
        "manifest": manifest,
        "manifestRaw": manifest_raw,
        "manifestFileSha256": hashlib.sha256(manifest_raw).hexdigest(),
        "acceptance": acceptance,
        "acceptanceRaw": acceptance_raw,
        "acceptanceFileSha256": hashlib.sha256(acceptance_raw).hexdigest(),
        "liveRoot": live_root,
        "sources": sources,
        "sourceRefs": source_refs,
        "ownerDependencyReceipt": dependency_receipt,
        "closedSetManifestPin": closed_set_pin,
    }


def accepted_live_preflight(base: Path, blueprint_root: Path) -> dict[str, Any]:
    try:
        result = verify_accepted_live_canonical(base, blueprint_root)
    except (OSError, SuccessorProfileError, ValueError, KeyError, TypeError) as exc:
        return {
            "status": "PENDING_ACCEPTED_LIVE_CANONICAL",
            "errors": [f"{type(exc).__name__}:{exc}"],
            "sources": {},
        }
    return {
        "status": "READY",
        "errors": [],
        "sources": {key: str(value) for key, value in result["sources"].items()},
        "manifestFileSha256": result["manifestFileSha256"],
        "acceptanceFileSha256": result["acceptanceFileSha256"],
    }


def profile_metadata(name: str, base: Path, blueprint_root: Path) -> dict[str, Any]:
    require_profile(name)
    if name == LEGACY_PROFILE:
        return {
            "name": name,
            "activeGateChain": "historical-v1",
            "canonicalCounts": None,
            "policy": None,
            "successor": False,
            "artifacts": {},
        }
    return {
        "name": name,
        "activeGateChain": "successor-v2-pending-accepted-canonical-transition",
        "canonicalCounts": dict(SUCCESSOR_CANONICAL_COUNTS),
        "ownerDependencyReceipt": successor_owner_dependency_receipt(),
        "closedSetManifestPin": dict(SUCCESSOR_CLOSED_SET_MANIFEST_PIN),
        "policy": dict(SUCCESSOR_POLICY),
        "successor": True,
        "artifacts": {key: str(value) for key, value in successor_paths(base, blueprint_root).items()},
        "ids": dict(SUCCESSOR_IDS),
        "predecessorPins": {
            key: dict(value) for key, value in SUCCESSOR_PREDECESSOR_PINS.items()
        },
        "unpublishedPredecessors": list(SUCCESSOR_UNPUBLISHED_PREDECESSORS),
        "predecessorDisposition": "HISTORICAL_BYTES_PINNED_NOT_ACTIVE_GATE_AUTHORITY",
    }


def _lstat_or_none(path: Path) -> os.stat_result | None:
    try:
        return path.lstat()
    except FileNotFoundError:
        return None


def assert_new_target(path: Path) -> None:
    """Reject every occupied/suspicious target before a successor write."""
    require_active_reader_guard(__file__)
    parent = path.parent
    cursor = parent
    missing: list[Path] = []
    while True:
        metadata = _lstat_or_none(cursor)
        if metadata is None:
            missing.append(cursor)
            if cursor.parent == cursor:
                break
            cursor = cursor.parent
            continue
        if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
            raise SuccessorProfileError(f"successor target parent is not a real directory: {cursor}")
        if stat.S_IMODE(metadata.st_mode) & 0o022:
            raise SuccessorProfileError(f"successor target parent is group/world writable: {cursor}")
        break
    for directory in reversed(missing):
        directory.mkdir(mode=0o700)
    metadata = _lstat_or_none(path)
    if metadata is not None:
        kind = "symlink" if stat.S_ISLNK(metadata.st_mode) else "occupied"
        raise FileExistsError(f"successor publication target already exists ({kind}): {path}")


def _fsync_directory(directory: Path) -> None:
    descriptor = os.open(directory, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def create_only_bytes(path: Path, raw: bytes, *, mode: int = 0o600) -> None:
    """Atomically create a regular file, never replace an existing target.

    A hard-link commit gives this operation no-replace semantics even if a
    hostile process races the preflight with a target creation.
    """
    assert_new_target(path)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, mode)
        with os.fdopen(descriptor, "wb", closefd=True) as stream:
            descriptor = -1
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(temporary, path, follow_symlinks=False)
        except FileExistsError as exc:
            raise FileExistsError(f"successor publication target already exists: {path}") from exc
        _fsync_directory(path.parent)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        temporary.unlink(missing_ok=True)


def create_only_json(path: Path, value: Any) -> None:
    raw = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8") + b"\n"
    create_only_bytes(path, raw)


def create_only_text(path: Path, text: str) -> None:
    create_only_bytes(path, text.encode("utf-8"))


def create_only_pair(replacements: list[tuple[Path, bytes]]) -> None:
    """Create a small successor pair with rollback, never replacing a target."""
    if not replacements or len({path for path, _ in replacements}) != len(replacements):
        raise SuccessorProfileError("successor publication pair targets must be distinct")
    for path, _raw in replacements:
        assert_new_target(path)
    created: list[Path] = []
    try:
        for path, raw in replacements:
            create_only_bytes(path, raw)
            created.append(path)
    except BaseException:
        for path in reversed(created):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
        raise


def verify_predecessor_pins(blueprint_root: Path, *, include_unpublished: bool = False) -> list[str]:
    """Return exact pin failures; no mutable candidate is consulted."""
    require_active_reader_guard(__file__)
    failures: list[str] = []
    base = blueprint_root / "coding-readiness"
    for relative, expected in SUCCESSOR_PREDECESSOR_PINS.items():
        path = blueprint_root / relative if relative.startswith("g0/") else base / relative
        try:
            raw = path.read_bytes()
        except OSError:
            failures.append(f"MISSING:{relative}")
            continue
        actual = hashlib.sha256(raw).hexdigest()
        if actual != expected["fileSha256"]:
            failures.append(f"FILE_SHA:{relative}:expected={expected['fileSha256']}:actual={actual}")
            continue
        try:
            document = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            failures.append(f"JSON:{relative}")
            continue
        if document.get("sealedPayloadSha256") != expected["sealedPayloadSha256"]:
            failures.append(
                f"SEAL:{relative}:expected={expected['sealedPayloadSha256']}:actual={document.get('sealedPayloadSha256')}"
            )
    if include_unpublished:
        for relative in SUCCESSOR_UNPUBLISHED_PREDECESSORS:
            path = blueprint_root / relative
            if not path.is_file() or path.is_symlink():
                failures.append(f"UNPUBLISHED:{relative}")
    return failures


def pending_successor_inputs(
    base: Path,
    blueprint_root: Path,
    *,
    stage: str | None = None,
) -> list[str]:
    """Return deterministic missing-input diagnostics for one successor stage.

    The old implementation gathered every downstream output into one global
    preflight.  That made the first producer wait for its own output and for
    outputs that could only be produced later.  A stage argument now makes the
    dependency boundary explicit; ``None`` is retained as a compatibility
    alias for the first, review-input stage and never means "all outputs".
    """
    selected_stage = "review-input" if stage is None else stage
    return list(stage_prerequisites(selected_stage, base, blueprint_root)["missing"])


def successor_target_failures(
    base: Path,
    blueprint_root: Path,
    *,
    keys: tuple[str, ...] | list[str] | None = None,
) -> list[str]:
    """Reject successor targets that are aliases/substitutions of predecessors."""
    # Include staging inputs so stage-specific callers can check the unsigned
    # target as well as finalized outputs.  The default remains the output
    # namespace only, preserving callers that use this as a publication check.
    paths = successor_stage_paths(base, blueprint_root)
    selected = set(successor_paths(base, blueprint_root)) if keys is None else set(keys)
    predecessor_by_target = {
        "oracle": ("modern-causal-independent-oracle.v1.json",),
        "fixture": ("modern-causal-independent-pg-fixtures.v1.json",),
        "reviewInventory": ("modern-causal-independent-review-inventory.v1.json",),
        "reviewFinalization": ("modern-causal-independent-reviewed-finalization.v1.json",),
        "pgEvidence": (
            "reports/modern-causal-independent-pg-evidence.v2.json",
            "reports/modern-causal-independent-pg-evidence.v1.json",
        ),
        "designFindings": ("reports/modern-causal-independent-design-findings.v1.json",),
        "finalReview": ("reports/modern-causal-independent-final-hostile-review.v1.json",),
        "sourceAuthority": ("modern-causal-final-source-authority-manifest.v1.json",),
        "controlIntake": ("g0/control-evidence-intake/modern-causal-final-endorsement.v1.json",),
    }
    failures: list[str] = []
    predecessor_by_target["pgUnsigned"] = (
        "reports/modern-causal-independent-pg-evidence.v2.json",
        "reports/modern-causal-independent-pg-evidence.v1.json",
    )
    for key, path in paths.items():
        if key not in selected:
            continue
        if not path.exists() and not path.is_symlink():
            continue
        try:
            metadata = path.lstat()
        except OSError as exc:
            failures.append(f"STAT:{key}:{exc}")
            continue
        if stat.S_ISLNK(metadata.st_mode):
            failures.append(f"SYMLINK:{key}")
            continue
        if not stat.S_ISREG(metadata.st_mode):
            failures.append(f"NOT_REGULAR:{key}")
            continue
        if metadata.st_nlink != 1:
            failures.append(f"HARDLINK:{key}")
        if stat.S_IMODE(metadata.st_mode) & 0o022:
            failures.append(f"WRITABLE:{key}")
        predecessors = predecessor_by_target.get(key, ())
        for predecessor in predecessors:
            predecessor_path = blueprint_root / predecessor if predecessor.startswith("g0/") else base / predecessor
            try:
                predecessor_raw = predecessor_path.read_bytes()
            except OSError:
                continue
            if path.read_bytes() == predecessor_raw:
                failures.append(f"PREDECESSOR_ALIAS:{key}:{predecessor}")
                break
    return failures


def hostile_self_test(base: Path, blueprint_root: Path) -> list[str]:
    """Exercise path substitution, occupied target, and predecessor drift controls."""
    failures: list[str] = []
    with tempfile.TemporaryDirectory(prefix="modern-causal-successor-profile-") as temp:
        root = Path(temp)
        target = root / "out" / "new.json"
        create_only_bytes(target, b"one\n")
        try:
            create_only_bytes(target, b"two\n")
        except (FileExistsError, SuccessorProfileError):
            pass
        else:
            failures.append("occupied-target-accepted")
        if target.read_bytes() != b"one\n":
            failures.append("occupied-target-mutated")
        link_parent = root / "link-parent"
        link_parent.symlink_to(root / "out", target_is_directory=True)
        try:
            create_only_bytes(link_parent / "escape.json", b"escape\n")
        except (SuccessorProfileError, FileExistsError, OSError):
            pass
        else:
            failures.append("symlink-parent-accepted")
        staged_predecessor = root / "predecessor.json"
        staged_predecessor.write_bytes(b"drift")
        actual = hashlib.sha256(staged_predecessor.read_bytes()).hexdigest()
        if actual == SUCCESSOR_PREDECESSOR_PINS["modern-causal-independent-oracle.v1.json"]["fileSha256"]:
            failures.append("drift-fixture-collision")
        predecessor = base / "modern-causal-independent-oracle.v1.json"
        if predecessor.is_file() and not predecessor.is_symlink():
            alias_root = root / "alias-blueprint"
            alias_base = alias_root / "coding-readiness"
            alias_base.mkdir(parents=True)
            alias_predecessor = alias_base / predecessor.name
            shutil.copyfile(predecessor, alias_predecessor)
            alias_target = successor_paths(alias_base, alias_root)["oracle"]
            shutil.copyfile(alias_predecessor, alias_target)
            if not any(item.startswith("PREDECESSOR_ALIAS:oracle:")
                       for item in successor_target_failures(alias_base, alias_root)):
                failures.append("predecessor-path-substitution-accepted")
    return failures
