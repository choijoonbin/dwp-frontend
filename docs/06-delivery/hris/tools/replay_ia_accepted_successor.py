#!/usr/bin/env python3
"""Replay the accepted IA Listening-allocation successor in a temporary tree."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from replay_ia_pin_checkpoint import INPUTS, sha256


HRIS_ROOT = Path(__file__).resolve().parents[1]
RAW_ROOT = HRIS_ROOT / "recovery" / "hris-porting-blueprint-2026-09-09"
ACCEPTED_ROOT = (
    HRIS_ROOT
    / "recovery"
    / "exact-supplements"
    / "2026-10-06"
    / "accepted-successors"
    / "hris-porting-blueprint-2026-09-09"
)
GENERATOR = RAW_ROOT / "coding-readiness/generate_ia_entry_query_projection_schemas.py"
GENERATOR_SHA256 = "11041a6c61fc8aacb5d101574604c12af464bd930525c247bf85d7da80733cf7"

OUTPUTS = {
    "ia-entry-query-api-contract-register.csv": (
        100020,
        "5f47efd33a1d5aa3d11a4d9fd5716cd4e35650e9fec0868ecb77c8c90a4cd988",
    ),
    "ia-entry-query-projection-schemas.v1.json": (
        1523618,
        "b185accd712216c39bf8a66f70cbbf0092a27a8c2c5e3d7457ecd4d511afa048",
    ),
    "ia-entry-query-runtime-invariant-register.csv": (
        51783,
        "fcdfd1a26d8fca2c8d9a2a8279a3c5a99844ba827aefe47cbac2210b8753f77a",
    ),
    "ia-entry-query-action-key-register.csv": (
        78170,
        "19a12600eb11e4d6c7c6098ad7f44f8afb544a1d9c698c3d2305e9e8150b5b7e",
    ),
}


def main() -> int:
    if sha256(GENERATOR) != GENERATOR_SHA256:
        raise AssertionError("accepted-successor generator SHA drift")
    with tempfile.TemporaryDirectory(prefix="hris-ia-successor-replay-") as raw_tmp:
        temp_root = Path(raw_tmp)
        staged_generator = temp_root / "coding-readiness" / GENERATOR.name
        staged_generator.parent.mkdir(parents=True)
        shutil.copy2(GENERATOR, staged_generator)
        for relative, expected_sha in INPUTS.items():
            source = RAW_ROOT / relative
            if sha256(source) != expected_sha:
                raise AssertionError(f"input SHA drift: {relative}")
            destination = temp_root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)

        completed = subprocess.run(
            [sys.executable, str(staged_generator)],
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        if "IA_ENTRY_QUERY_SCHEMA_GENERATION=PASS projections=66 api=66 runtime=66 actions=202" not in completed.stdout:
            raise AssertionError("accepted-successor generator count mismatch")
        observed = {}
        for name, (expected_bytes, expected_sha) in OUTPUTS.items():
            generated = staged_generator.parent / name
            actual = {"bytes": generated.stat().st_size, "sha256": sha256(generated)}
            if actual != {"bytes": expected_bytes, "sha256": expected_sha}:
                raise AssertionError(f"accepted-successor output drift: {name}")
            observed[name] = actual

        for name in (
            "ia-entry-query-api-contract-register.csv",
            "ia-entry-query-runtime-invariant-register.csv",
        ):
            accepted = ACCEPTED_ROOT / "coding-readiness" / name
            generated = staged_generator.parent / name
            if accepted.read_bytes() != generated.read_bytes():
                raise AssertionError(f"versioned accepted successor drift: {name}")

    print(
        json.dumps(
            {
                "status": "PASS",
                "authorityScope": "ACCEPTED_POST_PIN_SUCCESSOR",
                "generatorSha256": GENERATOR_SHA256,
                "inputCount": len(INPUTS),
                "outputs": observed,
                "changedFromHistoricalPin": [
                    "IAQ-033.test_allocation_id",
                    "IAQ-065.test_allocation_id",
                ],
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
