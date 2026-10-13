#!/usr/bin/env python3
"""Focused tests for the Wave3 Phase A materialized authority bundle."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
import sys
import unittest
from copy import deepcopy
from pathlib import Path


class Wave3PhaseATest(unittest.TestCase):
    frontend: Path
    backend: Path
    agent: Path

    @classmethod
    def setUpClass(cls) -> None:
        cls.frontend = Path(TEST_ARGS.frontend_root).resolve()
        cls.backend = Path(TEST_ARGS.backend_root).resolve()
        cls.agent = Path(TEST_ARGS.agent_root).resolve()
        cls.bundle = cls.frontend / "docs/06-delivery/hris/wave3-2026-10-13"

    def run_tool(self, script: str, *extra: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable,
                str(self.bundle / script),
                *extra,
                "--frontend-root",
                str(self.frontend),
                "--backend-root",
                str(self.backend),
                "--agent-root",
                str(self.agent),
            ],
            cwd=self.frontend,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

    def test_generated_artifacts_are_deterministic(self) -> None:
        result = self.run_tool("materialize_wave3_phase_a.py", "check")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("WAVE3_PHASE_A_GENERATED_CHECK_PASS", result.stdout)

    def test_independent_validator_passes(self) -> None:
        authority = json.loads(
            (self.bundle / "authority-refresh.v1.json").read_text(encoding="utf-8")
        )
        head = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=self.frontend,
            text=True,
            stdout=subprocess.PIPE,
            check=True,
        ).stdout.strip()
        mode = () if head == authority["sourcePins"]["frontend"]["commit"] else ("--allow-phase-a-carrier",)
        result = self.run_tool("validate_wave3_phase_a.py", *mode)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("WAVE3_PHASE_A_INDEPENDENT_VALIDATION_PASS", result.stdout)

    def test_frontend_carrier_mode_is_explicit_and_fail_closed(self) -> None:
        authority = json.loads(
            (self.bundle / "authority-refresh.v1.json").read_text(encoding="utf-8")
        )
        pinned = authority["sourcePins"]["frontend"]["commit"]
        head = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=self.frontend,
            text=True,
            stdout=subprocess.PIPE,
            check=True,
        ).stdout.strip()
        if head == pinned:
            precommit = self.run_tool("validate_wave3_phase_a.py")
            carrier = self.run_tool(
                "validate_wave3_phase_a.py", "--allow-phase-a-carrier"
            )
            self.assertEqual(precommit.returncode, 0, precommit.stderr)
            self.assertNotEqual(carrier.returncode, 0)
            self.assertIn("HEAD parent is not the pinned pre-carrier commit", carrier.stderr)
        else:
            carrier = self.run_tool(
                "validate_wave3_phase_a.py", "--allow-phase-a-carrier"
            )
            self.assertEqual(carrier.returncode, 0, carrier.stderr)

    def test_seals_fail_closed_after_mutation(self) -> None:
        packet = json.loads((self.bundle / "mod-per-compplan/packet.v2.json").read_text(encoding="utf-8"))
        original_seal = packet["sealedPayloadSha256"]
        mutated = deepcopy(packet)
        mutated["lifecycleState"] = "PACKET_AUTHORIZED_DOMAIN_AUTHORING"
        mutated.pop("sealedPayloadSha256")
        digest = hashlib.sha256(
            json.dumps(mutated, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        self.assertNotEqual(original_seal, digest)

    def test_overlay_exact_completion_and_no_token_for_compplan(self) -> None:
        with (self.bundle / "successor-slice-overlay.v2.csv").open(newline="", encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))
        completed = [row for row in rows if row["wave3_classification"].startswith("INTEGRATED_COMPLETE")]
        self.assertEqual(len(rows), 102)
        self.assertEqual(len(completed), 13)
        compplan = next(row for row in rows if row["slice_id"] == "MOD-PER-COMPPLAN")
        self.assertEqual(compplan["wave3_classification"], "PREPARED_STALE_REISSUE_REQUIRED")
        self.assertEqual(compplan["wave3_start_token_id"], "NONE")
        self.assertIn("V17", compplan["wave3_migration_lease_id"])

    def test_g7_overlay_uses_authoritative_final_lineage(self) -> None:
        with (self.bundle / "successor-slice-overlay.v2.csv").open(
            newline="", encoding="utf-8"
        ) as handle:
            by_id = {row["slice_id"]: row for row in csv.DictReader(handle)}
        per_tim_promotion = json.loads(
            (
                self.frontend
                / "docs/06-delivery/hris/2026-10-12-g7-evidence-promotion-and-delegation-receipt.json"
            ).read_text(encoding="utf-8")
        )
        sys_hrm_promotion = json.loads(
            (
                self.frontend
                / "docs/06-delivery/hris/2026-10-12-g7-sys-hrm-promotion-receipt.v2.json"
            ).read_text(encoding="utf-8")
        )
        closure = json.loads(
            (
                self.frontend
                / "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/"
                "sys-hrm-r3-result-acceptance/runs/sys-hrm-r3-20261012-r3/"
                "integrated-closure.v3.json"
            ).read_text(encoding="utf-8")
        )
        per_tim = {row["sliceId"]: row for row in per_tim_promotion["delegations"]}
        sys_hrm = {row["sliceId"]: row for row in sys_hrm_promotion["delegations"]}
        predecessor_closed = {
            row["tokenId"]: row["state"]
            for row in sys_hrm_promotion["closedPredecessorTokens"]
        }
        final_closed = {row["sliceId"]: row for row in closure["tokenClosures"]}
        exact = {
            "BASE-TFR-PER-006": ("G7-START-PER-BASE-TFR-PER-006-R1", "G7-LEASE-PER-PERFORMANCE-V2-R1"),
            "BASE-TFR-TIM-006": ("G7-START-TIM-BASE-TFR-TIM-006-R1", "G7-LEASE-TIM-TIME-V8-R1"),
            "BASE-TFR-SYS-007": ("G7-START-SYS-BASE-TFR-SYS-007-R2", "G7-LEASE-SYS-PLATFORM-V325-R2"),
            "BASE-TFR-HRM-010": ("G7-START-HRM-BASE-TFR-HRM-010-R2", "CONTROL_BOOTSTRAP_READ_ONLY_PIN"),
        }
        for slice_id in ("BASE-TFR-PER-006", "BASE-TFR-TIM-006"):
            token_id, migration_authority = exact[slice_id]
            delegation = per_tim[slice_id]
            self.assertEqual(delegation["tokenId"], token_id)
            self.assertEqual(predecessor_closed[token_id], "RESULT_INTEGRATED_CLOSED")
            token = json.loads((self.frontend / delegation["tokenPath"]).read_text(encoding="utf-8"))
            self.assertEqual(by_id[slice_id]["wave3_start_token_id"], token_id)
            self.assertEqual(by_id[slice_id]["wave3_migration_lease_id"], migration_authority)
            self.assertEqual(by_id[slice_id]["wave3_dependency_result_pins"], token["dependencyPinsSha256"])
            self.assertEqual(by_id[slice_id]["wave3_touch_policy_digest"], token["pathPolicySha256"])
        for slice_id in ("BASE-TFR-SYS-007", "BASE-TFR-HRM-010"):
            token_id, migration_authority = exact[slice_id]
            delegation = sys_hrm[slice_id]
            self.assertEqual(delegation["tokenId"], token_id)
            self.assertEqual(final_closed[slice_id]["tokenId"], token_id)
            self.assertEqual(final_closed[slice_id]["stateAfterCarrier"], "RESULT_INTEGRATED_CLOSED")
            self.assertEqual(by_id[slice_id]["wave3_start_token_id"], token_id)
            self.assertEqual(by_id[slice_id]["wave3_migration_lease_id"], migration_authority)

    def test_workforce_tested_gate_is_backed_by_exact_execution_receipt(self) -> None:
        receipt = json.loads(
            (
                self.bundle
                / "workforce-compensation-targeted-test-execution-receipt.v1.json"
            ).read_text(encoding="utf-8")
        )
        grant = json.loads(
            (
                self.bundle
                / "mod-per-compplan/prestart-control-grant-receipt.v1.json"
            ).read_text(encoding="utf-8")
        )
        expected_argv = [
            "./gradlew",
            ":dwp-people-server:test",
            "--tests",
            "com.dwp.services.people.hris.contracts.workforce.v1.CompensationPopulationContractTest",
            "--tests",
            "com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotContractTest",
            "--tests",
            "com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotPaginationContractTest",
            "--no-daemon",
        ]
        self.assertEqual(receipt["execution"]["argv"], expected_argv)
        self.assertEqual(receipt["execution"]["cwd"], self.backend.as_posix())
        self.assertFalse(receipt["execution"]["broadTestExecution"])
        self.assertEqual(
            receipt["backendPin"]["commit"],
            "3565c3e61b6c37a6b8088cc5250791fce32a0d9f",
        )
        self.assertEqual(
            receipt["totals"],
            {"tests": 24, "failures": 0, "errors": 0, "skipped": 0},
        )
        expected_reports = {
            "TEST-com.dwp.services.people.hris.contracts.workforce.v1.CompensationPopulationContractTest.xml": (2346, "dcd66dd972d9bf8aa6603241cbc573c4ce888f32ae815ddc3b6006301a427fa1", 10),
            "TEST-com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotContractTest.xml": (2225, "740fff035c246defb9621a41d349d5059edba7e5399ccd3a1162aae523d5ef6f", 10),
            "TEST-com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotPaginationContractTest.xml": (1139, "f68e47dd8d50bef5296c3259cf5030131a434e0c70a1dd59c8fe69fe11fc663d", 4),
        }
        self.assertEqual(len(receipt["reports"]), 3)
        for row in receipt["reports"]:
            expected = expected_reports[Path(row["path"]).name]
            payload = (self.backend / row["path"]).read_bytes()
            self.assertEqual((len(payload), hashlib.sha256(payload).hexdigest(), row["tests"]), expected)
            self.assertEqual((row["failures"], row["errors"], row["skipped"]), (0, 0, 0))
        workforce = next(
            row
            for row in grant["conditions"]
            if row["category"] == "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION"
        )
        self.assertEqual(workforce["state"], "IMPLEMENTED_TESTED_REGISTERED_GRANTED")
        self.assertEqual(workforce["targetedTestExecutionReceiptSeal"], receipt["sealedPayloadSha256"])
        self.assertEqual(workforce["targetedTestTotals"], receipt["totals"])

    def test_two_prestart_conditions_are_fulfilled_without_start_authority(self) -> None:
        grant = json.loads(
            (self.bundle / "mod-per-compplan/prestart-control-grant-receipt.v1.json").read_text(
                encoding="utf-8"
            )
        )
        state = json.loads(
            (self.bundle / "state/phase-a.v1.json").read_text(encoding="utf-8")
        )
        condition_states = {
            row["category"]: row["state"] for row in grant["conditions"]
        }
        self.assertEqual(
            condition_states,
            {
                "TYPED_ARTIFACT_BOOTSTRAP": "ALLOCATED_REGISTERED_GRANTED",
                "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION": "IMPLEMENTED_TESTED_REGISTERED_GRANTED",
            },
        )
        self.assertTrue(state["controlGates"]["typedArtifactBootstrapFulfilled"])
        self.assertTrue(state["controlGates"]["workforceCompensationProjectionFulfilled"])
        self.assertFalse(state["controlGates"]["startTokenIssued"])
        self.assertEqual(state["activeTokens"], [])
        self.assertEqual(state["activeWorktrees"], [])

    def test_predecessor_common_control_closed_set_is_preserved(self) -> None:
        predecessor = json.loads(
            (
                self.frontend
                / "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/mod-per-compplan-r1/packet.v1.json"
            ).read_text(encoding="utf-8")
        )
        touch = json.loads(
            (self.bundle / "mod-per-compplan/touch-manifest.v1.json").read_text(
                encoding="utf-8"
            )
        )
        predecessor_paths = predecessor["pathPolicy"]["commonControlOnlyPaths"]
        self.assertEqual(len(predecessor_paths), 68)
        self.assertEqual(touch["wave3AdditionalCommonControlOnlyPaths"], [])
        self.assertEqual(touch["commonControlOnlyPaths"], predecessor_paths)
        selectors = {row["selector"] for row in touch["commonControlOnlyPaths"]}
        self.assertIn(
            "dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/**",
            selectors,
        )
        self.assertIn(
            "dwp-platform-contracts/src/main/java/com/dwp/contracts/hris/xcon/v1/**",
            selectors,
        )
        self.assertIn(
            "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/generated/**",
            selectors,
        )

    def test_packet_pins_auth_bundle_and_tracks_post_result_owner_wiring(self) -> None:
        packet = json.loads(
            (self.bundle / "mod-per-compplan/packet.v2.json").read_text(
                encoding="utf-8"
            )
        )
        requests = json.loads(
            (self.bundle / "control-requests.v1.json").read_text(encoding="utf-8")
        )
        obligation = "wire and test HRM owner runtime compensation projection before central integration acceptance"
        self.assertEqual(
            packet["contractPins"]["authorizationBundleFileSha256"],
            "de449058055b5ae9500489735910fdcf593b34a9ab05e927663a7fd74d740667",
        )
        integration_request = next(
            row for row in requests["requests"] if row["category"] == "INTEGRATION_VERIFY"
        )
        self.assertFalse(integration_request["requiredBeforeStartToken"])
        self.assertEqual(
            integration_request["fulfillmentState"],
            "REGISTERED_WITH_FULFILLMENT_AFTER_RESULT",
        )
        self.assertIn(obligation, integration_request["scope"])
        self.assertIn(obligation, packet["deliverables"])

    def test_packet_is_executable_and_preserves_predecessor_semantics(self) -> None:
        packet = json.loads(
            (self.bundle / "mod-per-compplan/packet.v2.json").read_text(
                encoding="utf-8"
            )
        )
        predecessor = json.loads(
            (
                self.frontend
                / "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/mod-per-compplan-r1/packet.v1.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(
            packet["ownership"],
            {
                "ownerAgent": "HRIS-PER",
                "reviewer": "HRIS-INTEGRATION-CONTROL",
                "singleWriter": "HRIS-PER",
            },
        )
        self.assertEqual(packet["uiWorkContract"], predecessor["uiWorkContract"])
        expected_criteria = [
            (
                "clean empty-schema or V16-to-V17 upgrade, RLS, and append-only enforcement"
                if value
                == "clean V1 through V4 upgrade, RLS, and append-only enforcement"
                else value
            )
            for value in predecessor["verification"]["acceptanceInvariants"]
        ]
        self.assertEqual(
            [row["criterion"] for row in packet["acceptanceCriteria"]],
            expected_criteria,
        )
        commands = packet["verificationBindings"]["namedCommands"]
        self.assertEqual(commands, predecessor["verification"]["namedCommands"])
        self.assertEqual(len(commands), 3)
        self.assertTrue(all(row["cwd"] and len(row["argv"]) >= 3 for row in commands))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--frontend-root")
    parser.add_argument("--backend-root")
    parser.add_argument("--agent-root")
    args, unittest_args = parser.parse_known_args()
    if not args.frontend_root:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=Path.cwd(),
            text=True,
            stdout=subprocess.PIPE,
            check=True,
        )
        args.frontend_root = result.stdout.strip()
    workspace = Path(args.frontend_root).resolve().parent
    args.backend_root = args.backend_root or str(workspace / "dwp-backend")
    args.agent_root = args.agent_root or str(workspace / "dwp_agent")
    sys.argv = [sys.argv[0], *unittest_args]
    return args


TEST_ARGS = parse_args()


if __name__ == "__main__":
    unittest.main(verbosity=2)
