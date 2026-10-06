#!/usr/bin/env python3
"""Hostile tests for candidate/live and reciprocal-registry coherence."""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from generate_modern_exact_event_successor import validate as validate_exact_event  # noqa: E402


class CandidateValidatorCoherenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp = tempfile.TemporaryDirectory(prefix="hris-candidate-coherence-")
        cls.candidate = Path(cls.temp.name)
        for command in (
            [
                sys.executable,
                str(HERE / "generate_modern_closed_set_manifest.py"),
                "--candidate-dir", str(cls.candidate),
            ],
            [
                sys.executable,
                str(HERE / "generate_modern_canonical_five_successor.py"),
                "--candidate-dir", str(cls.candidate),
            ],
        ):
            completed = subprocess.run(
                command, cwd=HERE.parent, capture_output=True, text=True,
                timeout=120, check=False,
            )
            if completed.returncode != 0:
                raise RuntimeError(completed.stdout + completed.stderr)

        def load(root: Path, name: str) -> dict:
            return json.loads((root / name).read_text(encoding="utf-8"))

        cls.manifest = load(cls.candidate, "modern-capability-closed-set-manifest.v3.json")
        cls.ssot = load(cls.candidate, "modern-capability-operation-causal-contract-ssot.v2.json")
        cls.exact = load(cls.candidate, "modern-capability-exact-schema-contracts.v1.json")
        cls.events = load(cls.candidate, "modern-capability-event-payload-contracts.v1.json")
        cls.semantic = load(cls.candidate, "modern-capability-semantic-bindings.v1.json")
        cls.identities = load(cls.candidate, "modern-capability-public-identity-registry.v1.json")
        cls.source_exact = load(HERE, "modern-capability-exact-schema-contracts.v1.json")
        cls.source_events = load(HERE, "modern-capability-event-payload-contracts.v1.json")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temp.cleanup()

    def validate(self, exact: dict, events: dict) -> None:
        validate_exact_event(
            exact, events, self.manifest,
            source_ssot=self.ssot,
            source_exact=self.source_exact,
            source_events=self.source_events,
            semantic=self.semantic,
            identities=self.identities,
        )

    def test_baseline_candidate_passes(self) -> None:
        self.validate(self.exact, self.events)

    def test_implicit_live_reread_is_forbidden(self) -> None:
        with self.assertRaisesRegex(ValueError, "explicit source_ssot"):
            validate_exact_event(self.exact, self.events, self.manifest)

    def test_candidate_live_event_mix_fails_closed(self) -> None:
        with self.assertRaises(ValueError):
            self.validate(self.exact, self.source_events)

    def test_reciprocal_registry_pin_drift_fails_closed(self) -> None:
        hostile = copy.deepcopy(self.exact)
        pins = hostile["independentRegistryCorePins"]
        key = sorted(pins)[0]
        pins[key] = "0" * 64
        with self.assertRaisesRegex(ValueError, "reciprocal|reprojection"):
            self.validate(hostile, self.events)

    def test_missing_approval_receipt_source_fails_closed(self) -> None:
        hostile = copy.deepcopy(self.exact)
        lineage = next(
            row for row in hostile["operationFieldLineage"]
            if row["operationId"] == "modern.compplan.snapshot.publish"
        )
        source = next(
            row for row in lineage["mutationFieldSources"]
            if row["target"]
            == "prf_cmp_approved_snapshots.approval_receipt_public_id"
        )
        source["sourcePath"] = ""
        with self.assertRaisesRegex(ValueError, "frozen approval proof source drift"):
            self.validate(hostile, self.events)


if __name__ == "__main__":
    from modern_successor_reader_guard import guarded_main

    raise SystemExit(guarded_main(__file__, lambda: unittest.main(verbosity=2)))
