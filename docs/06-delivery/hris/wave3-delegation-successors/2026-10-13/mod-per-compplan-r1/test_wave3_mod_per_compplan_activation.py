#!/usr/bin/env python3
"""Focused control-artifact tests for Wave3 MOD-PER-COMPPLAN Phase B."""

from __future__ import annotations

import json
import unittest
from copy import deepcopy

import materialize_wave3_mod_per_compplan_activation as materializer
import validate_wave3_mod_per_compplan_activation as validator


class Wave3ModPerCompplanPhaseBTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.frontend = materializer.DEFAULT_FRONTEND.resolve()
        cls.backend = materializer.DEFAULT_BACKEND.resolve()
        cls.agent = materializer.DEFAULT_AGENT.resolve()
        cls.worktrees = materializer.DEFAULT_WORKTREE_ROOT.resolve()
        cls.root = cls.frontend / materializer.SUCCESSOR_REL

    def artifact(self, relative: str) -> dict:
        return json.loads((self.root / relative).read_text(encoding="utf-8"))

    def test_in_memory_bundle_is_deterministic_and_closed(self) -> None:
        first = materializer.build_all(
            self.frontend, self.backend, self.agent, self.worktrees
        )
        second = materializer.build_all(
            self.frontend, self.backend, self.agent, self.worktrees
        )
        self.assertEqual(first, second)
        self.assertEqual(
            set(first),
            {
                materializer.LEASE_OUTPUT,
                materializer.REGISTER_OUTPUT,
                materializer.TOKEN_OUTPUT,
                materializer.STATE_OUTPUT,
                materializer.MANIFEST_OUTPUT,
            },
        )

    def test_schemas_are_recursively_closed_and_match_instances(self) -> None:
        pairs = [
            (
                "migration-lease-admission.v1.json",
                "contracts/wave3-migration-lease-admission.schema.v1.json",
            ),
            (
                "tokens/mod-per-compplan.start-token.v1.json",
                "contracts/wave3-start-token.schema.v1.json",
            ),
            (
                "state/activation-pending-promotion.v1.json",
                "contracts/wave3-activation-state.schema.v1.json",
            ),
            (
                "manifest.v1.json",
                "contracts/wave3-activation-manifest.schema.v1.json",
            ),
        ]
        for artifact_path, schema_path in pairs:
            with self.subTest(artifact=artifact_path):
                artifact = self.artifact(artifact_path)
                schema = self.artifact(schema_path)
                validator.verify_schema_instance(
                    artifact, schema, artifact_path, validator.Audit()
                )

        token = self.artifact("tokens/mod-per-compplan.start-token.v1.json")
        token_schema = self.artifact(
            "contracts/wave3-start-token.schema.v1.json"
        )
        token["authority"]["unexpectedAuthority"] = True
        with self.assertRaises(RuntimeError):
            validator.verify_schema_instance(
                token, token_schema, "mutated token", validator.Audit()
            )

    def test_token_is_pending_and_all_elevated_authority_is_denied(self) -> None:
        token = self.artifact("tokens/mod-per-compplan.start-token.v1.json")
        self.assertEqual(token["state"], "ISSUED_PENDING_PROMOTION_RECEIPT")
        self.assertFalse(token["authority"]["currentlyEffective"])
        self.assertTrue(token["authority"]["effectiveAfterPromotionOnly"])
        self.assertEqual(len(token["effectiveAllowedPaths"]), 8)
        self.assertEqual(len(token["protectedPaths"]), 68)
        self.assertEqual(len(token["controlObligations"]["preStart"]), 2)
        self.assertEqual(
            len(token["controlObligations"]["afterPushedModuleResult"]), 5
        )
        for key in (
            "sharedControlPathChangeAuthorized",
            "integrationMergeAuthorized",
            "payConsumptionAuthorized",
            "customerDataAuthorized",
            "customerActivationAuthorized",
            "productionReleaseAuthorized",
        ):
            self.assertFalse(token["authority"][key], key)

    def test_state_has_no_current_active_token(self) -> None:
        state = self.artifact("state/activation-pending-promotion.v1.json")
        self.assertEqual(state["currentActiveTokenClosedSet"], [])
        self.assertEqual(
            state["activeTokenClosedSetAfterPromotion"],
            [materializer.TOKEN_ID],
        )
        self.assertFalse(state["authority"]["promotionReceiptIssued"])
        self.assertFalse(state["authority"]["currentModuleAuthoringAuthorized"])

    def test_lease_is_exact_v17_and_does_not_extend_phase_a(self) -> None:
        lease = self.artifact("migration-lease-admission.v1.json")
        reservation = json.loads(
            (self.frontend / materializer.RESERVATION_REL).read_text(encoding="utf-8")
        )
        self.assertEqual(lease["version"], "V17")
        self.assertEqual(lease["exactRelativePath"], materializer.V17_PATH)
        self.assertEqual(lease["observedVersions"], ["V1", "V2", "V3", "V16"])
        self.assertFalse(lease["outOfOrder"])
        self.assertEqual(lease["expiresAt"], reservation["expiresAt"])
        self.assertEqual(lease["ownerTokenId"], materializer.TOKEN_ID)
        self.assertEqual(lease["tableAllocation"]["domainTables"], materializer.DOMAIN_TABLES)
        self.assertEqual(
            lease["tableAllocation"]["sharedFoundationTables"],
            materializer.SHARED_TABLES,
        )

    def test_manifest_excludes_itself_and_promotion(self) -> None:
        manifest = self.artifact("manifest.v1.json")
        self.assertEqual(manifest["artifactCount"], 4)
        self.assertEqual(manifest["toolCount"], 9)
        self.assertEqual(manifest["promotionReceiptCount"], 0)
        self.assertEqual(
            {row["path"] for row in manifest["artifacts"]},
            {
                str(materializer.SUCCESSOR_REL / path)
                for path in materializer.ARTIFACT_FILES
            },
        )
        self.assertNotIn(
            str(materializer.SUCCESSOR_REL / materializer.MANIFEST_OUTPUT),
            {row["path"] for row in manifest["artifacts"]},
        )
        self.assertFalse((self.frontend / materializer.PROMOTION_REL).exists())

    def test_seals_fail_closed_on_mutation(self) -> None:
        token = self.artifact("tokens/mod-per-compplan.start-token.v1.json")
        materializer.verify_seal(token, "token")
        mutated = deepcopy(token)
        mutated["authority"]["productionReleaseAuthorized"] = True
        with self.assertRaises(materializer.PhaseBBlocked):
            materializer.verify_seal(mutated, "mutated token")

    def test_independent_validator_rejects_future_carrier_fields(self) -> None:
        audit = validator.Audit()
        validator.reject_future_carrier_references(
            {"safe": {"state": "pending"}}, "fixture", audit
        )
        with self.assertRaises(RuntimeError):
            validator.reject_future_carrier_references(
                {"bundleCommit": "future"}, "fixture", validator.Audit()
            )

    def test_promotion_receipt_construction_is_deterministic_and_scoped(self) -> None:
        bundle_commit = "a" * 40
        bundle_tree = "b" * 40
        first = materializer.build_promotion_receipt(
            self.frontend, bundle_commit, bundle_tree
        )
        second = materializer.build_promotion_receipt(
            self.frontend, bundle_commit, bundle_tree
        )
        self.assertEqual(first, second)
        materializer.verify_seal(first, "promotion fixture")
        self.assertEqual(first["bundleCommit"]["commit"], bundle_commit)
        self.assertEqual(first["bundleCommit"]["tree"], bundle_tree)
        self.assertEqual(first["activeTokenClosedSet"], [materializer.TOKEN_ID])
        self.assertEqual(len(first["delegation"]["controlObligations"]["preStart"]), 2)
        self.assertEqual(
            len(first["delegation"]["controlObligations"]["afterPushedModuleResult"]),
            5,
        )
        for key in (
            "sharedControlPathChangeAuthorizedForModule",
            "integrationMergeAuthorized",
            "payConsumptionAuthorized",
            "customerDataAuthorized",
            "customerActivationAuthorized",
            "productionReleaseAuthorized",
        ):
            self.assertFalse(first["authority"][key], key)
        validator.verify_schema_instance(
            first,
            self.artifact("contracts/wave3-promotion-receipt.schema.v1.json"),
            "promotion fixture",
            validator.Audit(),
        )

    def test_promotion_modes_fail_closed_before_phase_b_and_phase_c(self) -> None:
        current_commit = materializer.git(self.frontend, "rev-parse", "HEAD")
        current_tree = materializer.git(
            self.frontend, "rev-parse", "HEAD^{tree}"
        )
        with self.assertRaises(materializer.PhaseBBlocked):
            materializer.validate_promotion_prepare_boundary(
                self.frontend,
                materializer.PHASE_A_COMMIT,
                materializer.PHASE_A_TREE,
            )
        with self.assertRaises(materializer.PhaseBBlocked):
            materializer.validate_promotion_carrier_boundary(
                self.frontend, current_commit, current_tree
            )
        self.assertFalse((self.frontend / materializer.PROMOTION_REL).exists())

    def test_configured_upstream_name_mismatch_fails_closed(self) -> None:
        with self.assertRaises(materializer.PhaseBBlocked):
            materializer.require_configured_upstream(
                "origin/wrong", "origin/expected", "fixture"
            )
        with self.assertRaises(RuntimeError):
            validator.verify_configured_upstream_value(
                "origin/wrong",
                "origin/expected",
                "fixture",
                validator.Audit(),
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
