#!/usr/bin/env python3
"""Validate and atomically materialize the reviewed canonical-five successor."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any

from generate_modern_operation_ssot_successor import (
    compose as compose_operation,
    render,
    validate as validate_operation,
)
from generate_modern_semantic_identity_successor import (
    compose_all as compose_semantic_all,
    validate as validate_semantic_all,
)
from modern_closed_set_design import PREDECESSOR_OPERATION_SSOT_SHA256


HERE = Path(__file__).resolve().parent
WORKSPACE = HERE.parents[2]
MANIFEST = HERE / "modern-capability-closed-set-manifest.v3.json"
BASELINE = HERE / "modern-canonical-predecessor-byte-baseline.v1.json"
SSOT = HERE / "modern-capability-operation-causal-contract-ssot.v2.json"
EXACT = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENTS = HERE / "modern-capability-event-payload-contracts.v1.json"
BINDINGS = HERE / "modern-capability-semantic-bindings.v1.json"
IDENTITIES = HERE / "modern-capability-public-identity-registry.v1.json"
CANONICAL_PATHS = (SSOT, EXACT, EVENTS, BINDINGS, IDENTITIES)


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_historical_bytes(baseline: dict[str, Any]) -> None:
    for row in baseline["historicalLiveMigrations"]:
        path = WORKSPACE / row["path"]
        if not path.is_file():
            raise ValueError(f"historical live migration missing: {path}")
        if path.stat().st_size != row["bytes"] or file_sha(path) != row["sha256"]:
            raise ValueError(f"historical live migration bytes changed: {path}")


def compose_expected(
    manifest_path: Path = MANIFEST,
) -> tuple[tuple[dict[str, Any], ...], dict[str, Any], str]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    verify_historical_bytes(baseline)
    ssot_bytes = SSOT.read_bytes()
    current_ssot = json.loads(ssot_bytes)
    current_sha = hashlib.sha256(ssot_bytes).hexdigest()
    if current_sha == PREDECESSOR_OPERATION_SSOT_SHA256:
        predecessor_by_path = {
            HERE / row["path"]: row for row in baseline["canonicalFive"]
        }
        for path in CANONICAL_PATHS:
            row = predecessor_by_path[path]
            if path.stat().st_size != row["bytes"] or file_sha(path) != row["sha256"]:
                raise ValueError(f"canonical predecessor byte baseline drift: {path.name}")
        operation = compose_operation(current_ssot, manifest)
        state = "SEALED_PREDECESSOR"
    elif current_ssot.get("closedSetManifest", {}).get("sealedPayloadSha256") == manifest["sealedPayloadSha256"]:
        operation = compose_operation(current_ssot, manifest)
        state = "CURRENT_SUCCESSOR_REFRESH"
    elif current_ssot.get("closedSetManifest", {}).get("manifestId") == manifest["manifestId"]:
        operation = compose_operation(current_ssot, manifest)
        state = "PINNED_SUCCESSOR_REPROJECTION"
    else:
        raise ValueError("operation canonical is neither sealed predecessor nor current successor")
    validate_operation(operation, manifest)
    exact, events, semantic, identities = compose_semantic_all(
        json.loads(EXACT.read_text(encoding="utf-8")),
        json.loads(EVENTS.read_text(encoding="utf-8")),
        operation, hashlib.sha256(render(operation).encode("utf-8")).hexdigest(), manifest,
    )
    validate_semantic_all(exact, events, semantic, identities, manifest)
    values = (operation, exact, events, semantic, identities)
    return values, manifest, state


def deterministic_expected(
    manifest_path: Path = MANIFEST,
) -> tuple[tuple[dict[str, Any], ...], dict[str, Any], str]:
    first, manifest, state = compose_expected(manifest_path)
    second, manifest_second, state_second = compose_expected(manifest_path)
    if manifest != manifest_second or state != state_second:
        raise ValueError("canonical composition input changed during deterministic check")
    first_bytes = tuple(render(value).encode("utf-8") for value in first)
    second_bytes = tuple(render(value).encode("utf-8") for value in second)
    if first_bytes != second_bytes:
        raise ValueError("canonical-five composition is nondeterministic")
    return first, manifest, state


def summary(values: tuple[dict[str, Any], ...]) -> str:
    hashes = [
        path.name + "=" + hashlib.sha256(render(value).encode("utf-8")).hexdigest()
        for path, value in zip(CANONICAL_PATHS, values)
    ]
    return " ".join(hashes)


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--preview", action="store_true")
    group.add_argument("--write", action="store_true")
    group.add_argument("--check", action="store_true")
    group.add_argument("--candidate-dir", type=Path)
    args = parser.parse_args()
    manifest_path = (
        args.candidate_dir / MANIFEST.name if args.candidate_dir else MANIFEST
    )
    values, manifest, state = deterministic_expected(manifest_path)
    encoded = tuple(render(value).encode("utf-8") for value in values)
    if args.preview:
        print(
            "MODERN_CANONICAL_FIVE_SUCCESSOR_PREVIEW=PASS"
            f" sourceState={state} operations={manifest['scope']['operations']}"
            f" handlers={manifest['scope']['handlers']}"
            f" events={manifest['scope']['publicEvents']} tables={manifest['scope']['tableSpecifications']} "
            + summary(values)
        )
        return 0
    if args.write or args.candidate_dir:
        destination = HERE if args.write else args.candidate_dir
        assert destination is not None
        destination.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="modern-canonical-five-", dir=str(destination)) as raw:
            stage = Path(raw)
            staged = []
            for path, value in zip(CANONICAL_PATHS, encoded):
                target = stage / path.name
                with target.open("wb") as handle:
                    handle.write(value)
                    handle.flush()
                    os.fsync(handle.fileno())
                if hashlib.sha256(target.read_bytes()).digest() != hashlib.sha256(value).digest():
                    raise ValueError(f"staged canonical byte mismatch: {path.name}")
                staged.append(target)
            for target, path in zip(staged, CANONICAL_PATHS):
                os.replace(target, destination / path.name)
        verify_historical_bytes(json.loads(BASELINE.read_text(encoding="utf-8")))
        if args.candidate_dir:
            print(
                "MODERN_CANONICAL_FIVE_CANDIDATE_WRITE=PASS"
                f" path={destination} " + summary(values)
            )
            return 0
    mismatches = [
        path.name for path, value in zip(CANONICAL_PATHS, encoded)
        if path.read_bytes() != value
    ]
    if mismatches:
        raise ValueError("canonical-five generated bytes mismatch: " + ", ".join(mismatches))
    print("MODERN_CANONICAL_FIVE_SUCCESSOR_CHECK=PASS " + summary(values))
    return 0


if __name__ == "__main__":
    import pathlib as _guard_pathlib
    import sys as _guard_sys

    _guard_dir = _guard_pathlib.Path(__file__).resolve().parent
    while not (_guard_dir / "modern_successor_reader_guard.py").is_file():
        if _guard_dir.parent == _guard_dir:
            raise SystemExit("modern successor reader guard is unavailable")
        _guard_dir = _guard_dir.parent
    _guard_sys.path.insert(0, str(_guard_dir))
    from modern_successor_reader_guard import guarded_main as _guarded_main

    raise SystemExit(_guarded_main(__file__, main))
