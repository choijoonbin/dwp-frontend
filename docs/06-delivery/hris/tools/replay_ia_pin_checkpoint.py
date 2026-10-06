#!/usr/bin/env python3
"""Replay the historical IA checkpoint generator in an isolated temporary tree."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


HRIS_ROOT = Path(__file__).resolve().parents[1]
RAW_ROOT = HRIS_ROOT / "recovery" / "hris-porting-blueprint-2026-09-09"
SUPPLEMENT_ROOT = HRIS_ROOT / "recovery" / "exact-supplements" / "2026-10-06"
GENERATOR = SUPPLEMENT_ROOT / "reconstruction" / "generate_ia_entry_query_projection_schemas.pin-era.py"

INPUTS = {
    "coding-readiness/api-pep-binding-register.csv": "0e38d724516a8b271069241ffa0fb6400984dc703758767de53cbaffb4f93da3",
    "coding-readiness/hris-information-architecture-register.csv": "ab506a2bb2f80c8ab81a4b9d575374d6bda83b312d11dce07495d4812bdf4686",
    "coding-readiness/ia-entry-query-field-type-register.csv": "1e103d8c823d62518607334f7b985ae416f7b5ceee55ef8098aae94972a7a948",
    "coding-readiness/ia-entry-query-projection-register.csv": "86c55b9d4be19056fcb550b8ea05ff662c88684a8da85c7a2d2b17423329fb6f",
    "coding-readiness/ia-node-access-contract-register.csv": "3fc33ce63642c337c9cf8dc6cfbd3b9287d9b1202c5b709e137744c7b28494bf",
    "coding-readiness/shared-contract-catalog.csv": "34ffec83a60a7cb369406807bb856755e7bb34cf2be5dacb67dac1b0f3a07118",
    "session-evidence/hrm/g3-modern-capability-contracts.v1.json": "2e6e4b6b7911ae1dcf2a5e70f1cf9877c2699cba3d4fdeb763c5f510cb6d34c5",
    "session-evidence/per/g3-modern-capability-contracts.v2.json": "e4b221549aa80f34944a352e7466221dfb0ba4969ce5a2ddc24d8c4dd75bd92f",
    "session-evidence/tim/g3-modern-capability-contracts.v1.json": "b652b639575f8e767a0ead4abb8370b3f8f356ea4df98ea45fcb9d921a4f4196",
    "session-evidence/sys/g3-modern-capability-contracts.v1.json": "95baf1156baf603e3ddbc4a5891da0f6217c4f5ab7fb2a86eebbbc188d17ae5b",
}

OUTPUTS = {
    "ia-entry-query-api-contract-register.csv": (
        99982,
        "cb8d5b5ff815ab5de960025c491d8ac0b565cfda644898dee019967a0fd85bbe",
    ),
    "ia-entry-query-projection-schemas.v1.json": (
        1523618,
        "b185accd712216c39bf8a66f70cbbf0092a27a8c2c5e3d7457ecd4d511afa048",
    ),
    "ia-entry-query-runtime-invariant-register.csv": (
        51745,
        "3b9bd24be721fe1ea9ac11f011a840809dc154f459bd3e7d9288977a27586eda",
    ),
    "ia-entry-query-action-key-register.csv": (
        78170,
        "19a12600eb11e4d6c7c6098ad7f44f8afb544a1d9c698c3d2305e9e8150b5b7e",
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    expected_generator_sha = "11fbbdfdea806ceb6068ad42fd99c0b4f5eefc6de3b01ced3ec7f92a52c99240"
    if sha256(GENERATOR) != expected_generator_sha:
        raise AssertionError("pin-era generator SHA drift")

    with tempfile.TemporaryDirectory(prefix="hris-ia-pin-replay-") as raw_tmp:
        temp_root = Path(raw_tmp)
        staged_generator = temp_root / "coding-readiness" / "generate_ia_entry_query_projection_schemas.py"
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
            raise AssertionError("generator did not report the expected atomic output counts")

        observed = {}
        for name, (expected_bytes, expected_sha) in OUTPUTS.items():
            path = staged_generator.parent / name
            actual = {"bytes": path.stat().st_size, "sha256": sha256(path)}
            if actual != {"bytes": expected_bytes, "sha256": expected_sha}:
                raise AssertionError(f"generated output drift: {name}")
            observed[name] = actual

    print(
        json.dumps(
            {
                "status": "PASS",
                "authorityScope": "HISTORICAL_SYS_EXACT_BUSINESS_START_PIN_CHECKPOINT",
                "generatorSha256": expected_generator_sha,
                "inputCount": len(INPUTS),
                "outputs": observed,
                "atomicCounts": {"projections": 66, "api": 66, "runtime": 66, "actions": 202},
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
