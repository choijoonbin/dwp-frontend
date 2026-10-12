#!/usr/bin/env python3
"""Focused self-tests for the SYS/HRM G7 R2 successor tooling."""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import materialize_g7_sys_hrm_successor as materializer
import validate_g7_sys_hrm_successor as validator


class G7SysHrmSuccessorSelfTest(unittest.TestCase):
    def repository_pin(self, repo: str) -> dict[str, object]:
        values = {
            "frontend": ("a" * 40, "b" * 40),
            "backend": ("c" * 40, "d" * 40),
        }
        commit, tree = values[repo]
        central = materializer.CENTRAL_REPOSITORIES[repo]
        return {
            "commit": commit,
            "tree": tree,
            "stateSha256": materializer.EMPTY_SHA256,
            "branch": central["branch"],
            "upstream": central["upstream"],
            "clean": True,
            "upstreamMatched": True,
        }

    def worktree_row(self, module: str, repo: str) -> dict[str, str]:
        spec = materializer.MODULES[module]
        pin = self.repository_pin(repo)
        branch = f"codex/hris-g7-{spec['worktreeSlug']}-{repo}-20261012-r2"
        return {
            "module": module,
            "slice_id": spec["sliceId"],
            "token_id": spec["tokenId"],
            "repo": repo,
            "absolute_path": f"/fixture/g7-20261012-r2/{spec['worktreeSlug']}/{repo}",
            "branch": branch,
            "upstream": f"origin/{branch}",
            "head": str(pin["commit"]),
            "tree": str(pin["tree"]),
            "state_sha256": materializer.EMPTY_SHA256,
            "clean": "true",
            "ahead": "0",
            "behind": "0",
            "state": "CREATED_PUSHED_CLEAN",
        }

    def control_receipt(self) -> dict[str, object]:
        request_results = []
        for index, request_id in enumerate(materializer.CONTROL_REQUESTS):
            artifact = {
                "repo": "frontend" if index % 2 == 0 else "backend",
                "path": f"fixture/{index:02d}.txt",
                "gitBlobSha1": f"{index + 1:040x}",
                "byteLength": index + 1,
                "contentSha256": f"{index + 1:064x}",
            }
            evidence = {
                "schema": materializer.CONTROL_EVIDENCE_SCHEMA,
                "artifacts": [artifact],
            }
            request_results.append(
                {
                    "requestId": request_id,
                    "module": "SYS" if "SYS-007" in request_id else "HRM",
                    "status": "PASS",
                    "evidence": evidence,
                    "evidenceSha256": materializer.sha256_bytes(
                        materializer.canonical_bytes(
                            {
                                "schema": materializer.CONTROL_EVIDENCE_SCHEMA,
                                "requestId": request_id,
                                "artifacts": [artifact],
                            }
                        )
                    ),
                }
            )
        pins = {
            "frontend": self.repository_pin("frontend"),
            "backend": self.repository_pin("backend"),
        }
        return materializer.sealed(
            {
                "schema": "dwp.hris.g7-control-bootstrap-completion.v2",
                "receiptId": materializer.CONTROL_RECEIPT_ID,
                "status": "PASS_SYS_HRM_CONTROL_BOOTSTRAP",
                "issuedAt": "2026-10-12T15:00:00+09:00",
                "expiresAt": "2026-10-19T15:00:00+09:00",
                "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
                "frontendPin": pins["frontend"],
                "backendPin": pins["backend"],
                "requestResults": request_results,
                "verification": materializer.build_control_verification(
                    pins, request_results
                ),
                "authority": {
                    "controlBootstrapComplete": True,
                    "moduleSourceChangeAuthorized": False,
                    "sharedControlPathChangeAuthorizedForModules": False,
                    "integrationMergeAuthorized": False,
                    "customerDataAuthorized": False,
                    "customerActivationAuthorized": False,
                    "productionReleaseAuthorized": False,
                },
            }
        )

    def context(self) -> dict[str, object]:
        receipt = self.control_receipt()
        return {
            "issuedAt": receipt["issuedAt"],
            "expiresAt": receipt["expiresAt"],
            "centralPins": {
                "frontend": self.repository_pin("frontend"),
                "backend": self.repository_pin("backend"),
            },
            "controlReceipt": receipt,
            "controlReceiptRaw": materializer.json_bytes(receipt),
            "worktrees": {
                module: [
                    self.worktree_row(module, "frontend"),
                    self.worktree_row(module, "backend"),
                ]
                for module in materializer.MODULES
            },
            "migrationPrerequisites": {
                "HRM": {
                    "mode": "CONTROL_BOOTSTRAP_READ_ONLY_PIN",
                    "exactRelativePath": materializer.MODULES["HRM"][
                        "migrationPath"
                    ],
                    "sha256": "f" * 64,
                    "frozenBackendCommit": str(
                        self.repository_pin("backend")["commit"]
                    ),
                    "state": "CONTROL_BOOTSTRAP_CONSUMED_READ_ONLY",
                    "migrationEditAuthorized": False,
                }
            },
        }

    def tool_pins(self) -> list[dict[str, object]]:
        return [
            materializer.file_pin(
                str(materializer.SUCCESSOR_ROOT_REL / relative),
                f"fixture:{relative}".encode("utf-8"),
            )
            for relative in materializer.TOOL_RELATIVE_PATHS
        ]

    def test_schemas_are_valid_json_with_unique_ids(self) -> None:
        ids = []
        for relative in materializer.TOOL_RELATIVE_PATHS[:6]:
            schema_path = materializer.HERE / relative
            schema = json.loads(schema_path.read_text(encoding="utf-8"))
            self.assertEqual(schema["$schema"], "https://json-schema.org/draft/2020-12/schema")
            ids.append(schema["$id"])
        self.assertEqual(len(ids), len(set(ids)))

    def test_schemas_encode_asymmetric_migration_authority(self) -> None:
        lease = json.loads(
            (materializer.HERE / "contracts/g7-migration-lease-delta.schema.v2.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(lease["properties"]["leases"]["minItems"], 1)
        self.assertEqual(lease["properties"]["leases"]["maxItems"], 1)
        self.assertEqual(
            lease["properties"]["leases"]["items"]["properties"]["leaseId"][
                "const"
            ],
            materializer.MODULES["SYS"]["leaseId"],
        )

        token = json.loads(
            (materializer.HERE / "contracts/g7-start-token.schema.v2.json").read_text(
                encoding="utf-8"
            )
        )
        hrm_branch = token["allOf"][0]["else"]
        self.assertIn("controlOwnedMigrationPrerequisite", hrm_branch["required"])
        self.assertEqual(
            hrm_branch["properties"]["effectiveAllowedPaths"]["maxItems"], 3
        )
        self.assertEqual(
            hrm_branch["properties"]["authority"]["properties"][
                "migrationEditAuthorized"
            ]["const"],
            False,
        )
        manifest = json.loads(
            (materializer.HERE / "contracts/g7-successor-manifest.schema.v2.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(manifest["properties"]["artifacts"]["maxItems"], 5)
        self.assertEqual(manifest["properties"]["toolPins"]["minItems"], 9)
        self.assertEqual(manifest["properties"]["toolPins"]["maxItems"], 9)
        state = json.loads(
            (materializer.HERE / "contracts/g7-successor-state.schema.v2.json").read_text(
                encoding="utf-8"
            )
        )
        hrm_state = state["properties"]["effectiveDelegations"]["prefixItems"][1]
        self.assertIn("migrationLeaseId", hrm_state["not"]["anyOf"][0]["required"])
        self.assertFalse(
            hrm_state["properties"]["migrationAuthority"]["additionalProperties"]
        )

    def test_bundle_is_deterministic_and_has_only_expected_outputs(self) -> None:
        first = materializer.build_bundle_bytes(self.context(), self.tool_pins())
        second = materializer.build_bundle_bytes(self.context(), self.tool_pins())
        self.assertEqual(first, second)
        self.assertEqual(
            set(first),
            {
                Path("migration-leases.delta.v2.json"),
                Path("registers/module-worktrees.active.v2.csv"),
                Path("tokens/sys-007.start-token.v2.json"),
                Path("tokens/hrm-010.start-token.v2.json"),
                Path("state/delegation-after-sys-hrm-promotion.v2.json"),
                Path("manifest.v2.json"),
            },
        )

        state = json.loads(first[Path("state/delegation-after-sys-hrm-promotion.v2.json")])
        self.assertEqual(
            state["activeTokenClosedSetAfterPromotion"],
            materializer.ACTIVE_TOKEN_CLOSED_SET,
        )
        self.assertEqual(
            state["closedPredecessorTokens"],
            materializer.CLOSED_PREDECESSOR_TOKENS,
        )

    def test_tokens_keep_exact_path_and_authority_boundaries(self) -> None:
        outputs = materializer.build_bundle_bytes(self.context(), self.tool_pins())
        for module, spec in materializer.MODULES.items():
            token = json.loads(outputs[Path(spec["tokenRelativePath"])])
            self.assertEqual(token["effectiveAllowedPaths"], materializer.effective_allowed_paths(module))
            self.assertTrue(
                set(token["effectiveAllowedPaths"]).isdisjoint(
                    materializer.effective_protected_paths(module)
                )
            )
            self.assertFalse(token["authority"]["sharedControlPathChangeAuthorized"])
            self.assertFalse(token["authority"]["integrationMergeAuthorized"])
            self.assertFalse(token["authority"]["customerActivationAuthorized"])

        sys_token = json.loads(
            outputs[Path(materializer.MODULES["SYS"]["tokenRelativePath"])]
        )
        self.assertEqual(
            sys_token["migrationLeaseId"],
            materializer.MODULES["SYS"]["leaseId"],
        )
        self.assertTrue(sys_token["authority"]["migrationEditAuthorized"])

        hrm_token = json.loads(
            outputs[Path(materializer.MODULES["HRM"]["tokenRelativePath"])]
        )
        self.assertNotIn("migrationLeaseId", hrm_token)
        self.assertNotIn("migrationLeaseSha256", hrm_token)
        self.assertNotIn(
            f"backend:{materializer.MODULES['HRM']['migrationPath']}",
            hrm_token["effectiveAllowedPaths"],
        )
        self.assertIn(
            f"backend:{materializer.MODULES['HRM']['migrationPath']}",
            hrm_token["protectedPaths"],
        )
        self.assertFalse(hrm_token["authority"]["migrationEditAuthorized"])
        self.assertEqual(
            hrm_token["controlOwnedMigrationPrerequisite"],
            self.context()["migrationPrerequisites"]["HRM"],
        )

    def test_only_sys_receives_a_successor_migration_lease(self) -> None:
        outputs = materializer.build_bundle_bytes(self.context(), self.tool_pins())
        delta = json.loads(outputs[Path("migration-leases.delta.v2.json")])
        self.assertEqual([row["module"] for row in delta["leases"]], ["SYS"])
        self.assertEqual(
            delta["closedPredecessorLeases"][1]["state"],
            "CONSUMED_BY_CONTROL_BOOTSTRAP",
        )
        self.assertIsNone(delta["closedPredecessorLeases"][1]["successorLeaseId"])

    def test_promotion_is_deterministic_and_closes_per_tim(self) -> None:
        context = self.context()
        outputs = materializer.build_bundle_bytes(context, self.tool_pins())
        first = materializer.build_promotion_receipt(
            context, outputs, "1" * 40, "2" * 40
        )
        second = materializer.build_promotion_receipt(
            context, outputs, "1" * 40, "2" * 40
        )
        self.assertEqual(first, second)
        self.assertEqual(first["activeTokenClosedSet"], materializer.ACTIVE_TOKEN_CLOSED_SET)
        self.assertEqual(
            first["closedPredecessorTokens"],
            materializer.CLOSED_PREDECESSOR_TOKENS,
        )
        self.assertEqual([row["module"] for row in first["delegations"]], ["SYS", "HRM"])
        self.assertEqual(
            first["authority"]["migrationAdmissionAuthorized"],
            [materializer.MODULES["SYS"]["leaseId"]],
        )
        hrm = {row["module"]: row for row in first["delegations"]}["HRM"]
        self.assertNotIn("migrationLeaseId", hrm)
        self.assertNotIn("migrationLeaseSha256", hrm)
        self.assertEqual(
            hrm["controlOwnedMigrationPrerequisite"],
            context["migrationPrerequisites"]["HRM"],
        )

    def test_append_only_writer_refuses_drift(self) -> None:
        outputs = {Path("nested/evidence.json"): b"{\"ok\":true}\n"}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            materializer.write_append_only(outputs, root, check_only=False)
            materializer.write_append_only(outputs, root, check_only=True)
            (root / "nested/evidence.json").write_bytes(b"drift\n")
            with self.assertRaises(materializer.PrerequisiteError):
                materializer.write_append_only(outputs, root, check_only=False)

    def test_control_phase_output_is_deterministic(self) -> None:
        pins = {
            "frontend": self.repository_pin("frontend"),
            "backend": self.repository_pin("backend"),
        }
        results = self.control_receipt()["requestResults"]
        with (
            patch.object(materializer, "validate_frontend_source_boundary"),
            patch.object(materializer, "validate_control_result_ancestors"),
            patch.object(materializer, "build_control_request_results", return_value=results),
            patch.object(
                materializer,
                "control_window",
                return_value=("2026-10-12T06:00:00Z", "2026-10-19T06:00:00Z"),
            ),
        ):
            first = materializer.build_control_receipt(Path("/frontend"), Path("/backend"), pins)
            second = materializer.build_control_receipt(Path("/frontend"), Path("/backend"), pins)
        self.assertEqual(first, second)
        self.assertEqual(materializer.json_bytes(first), materializer.json_bytes(second))

    def test_control_request_evidence_has_exact_blob_closure(self) -> None:
        marker_bytes: dict[tuple[str, str], list[str]] = {}
        for spec in materializer.CONTROL_EVIDENCE_SPECS.values():
            for repo, path, marker in spec["markers"]:
                marker_bytes.setdefault((repo, path), []).append(marker)

        def fake_blob(
            _root: Path, _commit: str, repo: str, path: str
        ) -> tuple[dict[str, object], bytes]:
            raw = ("fixture\n" + "\n".join(marker_bytes.get((repo, path), []))).encode()
            return (
                {
                    "repo": repo,
                    "path": path,
                    "gitBlobSha1": materializer.sha256_bytes(raw)[:40],
                    "byteLength": len(raw),
                    "contentSha256": materializer.sha256_bytes(raw),
                },
                raw,
            )

        pins = {
            "frontend": self.repository_pin("frontend"),
            "backend": self.repository_pin("backend"),
        }
        with patch.object(materializer, "committed_blob", side_effect=fake_blob):
            results = materializer.build_control_request_results(
                Path("/frontend"), Path("/backend"), pins
            )
        self.assertEqual([row["requestId"] for row in results], materializer.CONTROL_REQUESTS)
        for row in results:
            expected_paths = sorted(
                materializer.CONTROL_EVIDENCE_SPECS[row["requestId"]]["artifacts"]
            )
            actual_paths = [
                (artifact["repo"], artifact["path"])
                for artifact in row["evidence"]["artifacts"]
            ]
            self.assertEqual(actual_paths, expected_paths)
            self.assertEqual(len(actual_paths), len(set(actual_paths)))
            self.assertEqual(
                row["evidenceSha256"],
                materializer.sha256_bytes(
                    materializer.canonical_bytes(
                        {
                            "schema": materializer.CONTROL_EVIDENCE_SCHEMA,
                            "requestId": row["requestId"],
                            "artifacts": row["evidence"]["artifacts"],
                        }
                    )
                ),
            )

    def test_check_control_rejects_tamper_path_and_commit_drift(self) -> None:
        expected = self.control_receipt()
        with tempfile.TemporaryDirectory() as directory:
            frontend = Path(directory)
            backend = frontend / "backend"
            backend.mkdir()
            target = frontend / materializer.CONTROL_RECEIPT_REL
            target.parent.mkdir(parents=True)
            with patch.object(materializer, "build_control_receipt", return_value=expected):
                target.write_bytes(materializer.json_bytes(expected))
                materializer.validate_control_receipt(
                    frontend,
                    backend,
                    self.repository_pin("frontend"),
                    self.repository_pin("backend"),
                    verify_frontend_carrier=False,
                )
                cases = []
                path_tamper = copy.deepcopy(expected)
                path_tamper["requestResults"][0]["evidence"]["artifacts"][0]["path"] = "tampered/path"
                cases.append(materializer.sealed(path_tamper))
                digest_tamper = copy.deepcopy(expected)
                digest_tamper["requestResults"][0]["evidenceSha256"] = "0" * 64
                cases.append(materializer.sealed(digest_tamper))
                commit_drift = copy.deepcopy(expected)
                commit_drift["frontendPin"]["commit"] = "9" * 40
                cases.append(materializer.sealed(commit_drift))
                extra_pin_field = copy.deepcopy(expected)
                extra_pin_field["frontendPin"]["renewedAt"] = "2026-10-13T00:00:00Z"
                cases.append(materializer.sealed(extra_pin_field))
                for tampered in cases:
                    with self.subTest(tamper=tampered["sealedPayloadSha256"]):
                        target.write_bytes(materializer.json_bytes(tampered))
                        with self.assertRaises(materializer.PrerequisiteError):
                            materializer.validate_control_receipt(
                                frontend,
                                backend,
                                self.repository_pin("frontend"),
                                self.repository_pin("backend"),
                                verify_frontend_carrier=False,
                            )

    def test_source_pin_rejects_extra_fields_and_prior_authority_carrier(self) -> None:
        source_pin = self.repository_pin("frontend")
        extra_field_pin = copy.deepcopy(source_pin)
        extra_field_pin["renewedAt"] = "2026-10-13T00:00:00Z"
        with self.assertRaises(materializer.PrerequisiteError):
            materializer.validate_repository_pin_key_closure(
                extra_field_pin, "Control frontend source"
            )

        control_path = str(materializer.CONTROL_RECEIPT_REL)

        def materializer_git(
            _root: Path, *args: str, raw: bool = False
        ) -> str | bytes:
            if args[0] == "rev-parse":
                value = str(source_pin["tree"])
            elif args[0] == "ls-tree" and args[-1] == control_path:
                value = control_path
            elif args[0] == "ls-tree":
                value = ""
            else:
                raise AssertionError(args)
            return value.encode() if raw else value

        with patch.object(materializer, "run_git", side_effect=materializer_git):
            with self.assertRaises(materializer.PrerequisiteError):
                materializer.validate_frontend_source_boundary(
                    Path("/frontend"), source_pin
                )

        def validator_git(
            _root: Path, args: list[str]
        ) -> tuple[int, bytes]:
            if args[0] == "rev-parse":
                return 0, f"{source_pin['tree']}\n".encode()
            if args[0] == "ls-tree" and args[-1] == control_path:
                return 0, f"{control_path}\n".encode()
            if args[0] in {"ls-tree", "diff"}:
                return 0, b""
            if args[0] == "merge-base":
                return 0, b""
            raise AssertionError(args)

        independent_pin = copy.deepcopy(source_pin)
        independent_pin["renewedAt"] = "2026-10-13T00:00:00Z"
        audit = validator.Audit()
        with patch.object(validator, "run_git", side_effect=validator_git):
            validator.verify_frontend_authority_carrier(
                Path("/frontend"), independent_pin, source_pin, audit
            )
        with self.assertRaises(SystemExit):
            audit.finish()
        self.assertTrue(
            any("field closed set" in error for error in audit.errors), audit.errors
        )
        self.assertTrue(
            any("authority path absent" in error for error in audit.errors), audit.errors
        )

    def test_fresh_phase_inventory_requires_control_before_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            frontend = Path(directory)
            root = frontend / materializer.SUCCESSOR_ROOT_REL
            for relative in materializer.TOOL_RELATIVE_PATHS:
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture", encoding="utf-8")
            materializer.validate_phase_inventory(frontend, "control")
            with self.assertRaises(materializer.PrerequisiteError):
                materializer.validate_phase_inventory(frontend, "bundle")
            receipt = frontend / materializer.CONTROL_RECEIPT_REL
            receipt.write_text("fixture", encoding="utf-8")
            materializer.validate_phase_inventory(frontend, "check-control")
            materializer.validate_phase_inventory(frontend, "bundle")
            for relative in materializer.BUNDLE_RELATIVE_PATHS:
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture", encoding="utf-8")
            materializer.validate_phase_inventory(frontend, "promotion")
            promotion = frontend / materializer.PROMOTION_RECEIPT_REL
            promotion.parent.mkdir(parents=True, exist_ok=True)
            promotion.write_text("fixture", encoding="utf-8")
            materializer.validate_phase_inventory(frontend, "check-promotion")

    def test_independent_validator_rejects_path_expansion(self) -> None:
        context = self.context()
        outputs = materializer.build_bundle_bytes(context, self.tool_pins())
        lease_delta = json.loads(outputs[Path("migration-leases.delta.v2.json")])
        lease = {row["module"]: row for row in lease_delta["leases"]}["SYS"]
        token = json.loads(outputs[Path("tokens/sys-007.start-token.v2.json")])
        token = copy.deepcopy(token)
        token["effectiveAllowedPaths"].append(
            materializer.MODULES["SYS"]["protectedPaths"][0]
        )
        audit = validator.Audit()
        validator.verify_effective_boundary(
            "SYS",
            token,
            context["centralPins"],
            context["controlReceipt"],
            context["controlReceiptRaw"],
            context["worktrees"]["SYS"] + context["worktrees"]["HRM"],
            lease,
            {},
            audit,
        )
        with self.assertRaises(SystemExit):
            audit.finish()
        self.assertTrue(any("effective allowed paths" in error for error in audit.errors))

    def test_independent_validator_rejects_resealed_hrm_migration_authority(self) -> None:
        context = self.context()
        outputs = materializer.build_bundle_bytes(context, self.tool_pins())
        token = json.loads(outputs[Path("tokens/hrm-010.start-token.v2.json")])
        token["migrationLeaseId"] = materializer.MODULES["SYS"]["leaseId"]
        token["migrationLeaseSha256"] = "1" * 64
        token = materializer.sealed(token)
        audit = validator.Audit()
        validator.verify_seal(token, "tampered HRM token", audit)
        validator.verify_effective_boundary(
            "HRM",
            token,
            context["centralPins"],
            context["controlReceipt"],
            context["controlReceiptRaw"],
            context["worktrees"]["SYS"] + context["worktrees"]["HRM"],
            {},
            context["migrationPrerequisites"]["HRM"],
            audit,
        )
        with self.assertRaises(SystemExit):
            audit.finish()
        self.assertTrue(
            any("field closed set" in error for error in audit.errors),
            audit.errors,
        )

    def test_independent_validator_rejects_resealed_extra_authority(self) -> None:
        context = self.context()
        outputs = materializer.build_bundle_bytes(context, self.tool_pins())
        token = json.loads(outputs[Path("tokens/sys-007.start-token.v2.json")])
        token["authority"]["unscopedWriteAuthorized"] = True
        token = materializer.sealed(token)
        lease_delta = json.loads(outputs[Path("migration-leases.delta.v2.json")])
        lease = lease_delta["leases"][0]
        audit = validator.Audit()
        validator.verify_seal(token, "tampered SYS token", audit)
        validator.verify_effective_boundary(
            "SYS",
            token,
            context["centralPins"],
            context["controlReceipt"],
            context["controlReceiptRaw"],
            context["worktrees"]["SYS"] + context["worktrees"]["HRM"],
            lease,
            {},
            audit,
        )
        with self.assertRaises(SystemExit):
            audit.finish()
        self.assertTrue(any("authority" in error for error in audit.errors))

    def test_materializer_and_validator_static_contracts_match(self) -> None:
        validator.verify_static_contract()
        self.assertEqual(materializer.ACTIVE_TOKEN_CLOSED_SET, validator.ACTIVE_TOKEN_CLOSED_SET)
        self.assertEqual(materializer.CLOSED_PREDECESSOR_TOKENS, validator.CLOSED_PREDECESSOR_TOKENS)
        self.assertEqual(materializer.PREDECESSOR_PINS, validator.PREDECESSOR_PINS)
        self.assertEqual(materializer.CONTROL_REQUESTS, validator.CONTROL_REQUESTS)
        self.assertEqual(
            materializer.CONTROL_RESULT_ANCESTORS,
            validator.CONTROL_RESULT_ANCESTORS,
        )
        self.assertEqual(
            materializer.REPOSITORY_PIN_KEYS,
            validator.REPOSITORY_PIN_KEYS,
        )
        normalized_materializer_specs = {
            request_id: (
                tuple(spec["artifacts"]),
                tuple(spec["markers"]),
            )
            for request_id, spec in materializer.CONTROL_EVIDENCE_SPECS.items()
        }
        self.assertEqual(
            normalized_materializer_specs,
            validator.CONTROL_EVIDENCE_SPECS,
        )
        for module in materializer.MODULES:
            for key in (
                "sliceId",
                "sessionId",
                "packetId",
                "packetPath",
                "packetSha256",
                "tokenId",
                "tokenRelativePath",
                "migrationAuthorityMode",
                "stream",
                "streamRoot",
                "migrationPath",
                "schemaEffect",
            ):
                self.assertEqual(
                    materializer.MODULES[module][key],
                    validator.MODULES[module][key],
                )
            self.assertEqual(
                materializer.MODULES[module]["allowedPaths"],
                validator.MODULES[module]["allowedPaths"],
            )
            self.assertEqual(
                materializer.MODULES[module]["protectedPaths"],
                validator.MODULES[module]["protectedPaths"],
            )
            self.assertEqual(
                materializer.MODULES[module].get("additionalProtectedPaths", []),
                validator.MODULES[module].get("additionalProtectedPaths", []),
            )
            self.assertEqual(
                materializer.MODULES[module]["migrationAuthorityMode"],
                validator.MODULES[module]["migrationAuthorityMode"],
            )


if __name__ == "__main__":
    unittest.main()
