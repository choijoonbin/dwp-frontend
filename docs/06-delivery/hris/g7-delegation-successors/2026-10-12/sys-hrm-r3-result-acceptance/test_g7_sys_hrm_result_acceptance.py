#!/usr/bin/env python3
"""Focused fresh-run and tamper tests for the R3 result acceptance tools."""

from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import materialize_g7_sys_hrm_result_acceptance as materializer
import validate_g7_sys_hrm_result_acceptance as validator


class SchemaFixtureError(AssertionError):
    pass


def validate_schema_fixture(
    value: object,
    schema: dict[str, object],
    root: dict[str, object] | None = None,
    location: str = "$",
) -> None:
    """Small dependency-free validator for the schema keywords used here."""
    root = schema if root is None else root
    reference = schema.get("$ref")
    if isinstance(reference, str):
        if not reference.startswith("#/$defs/"):
            raise SchemaFixtureError(f"{location}: unsupported ref {reference}")
        target: object = root
        for part in reference[2:].split("/"):
            if not isinstance(target, dict) or part not in target:
                raise SchemaFixtureError(f"{location}: missing ref {reference}")
            target = target[part]
        if not isinstance(target, dict):
            raise SchemaFixtureError(f"{location}: ref is not a schema")
        validate_schema_fixture(value, target, root, location)
        return
    alternatives = schema.get("oneOf")
    if isinstance(alternatives, list):
        matches = 0
        for alternative in alternatives:
            try:
                validate_schema_fixture(value, alternative, root, location)
            except SchemaFixtureError:
                continue
            matches += 1
        if matches != 1:
            raise SchemaFixtureError(f"{location}: oneOf matched {matches} alternatives")
        return
    if "const" in schema and value != schema["const"]:
        raise SchemaFixtureError(f"{location}: const mismatch")
    if "enum" in schema and value not in schema["enum"]:
        raise SchemaFixtureError(f"{location}: enum mismatch")
    value_type = schema.get("type")
    if value_type == "object":
        if not isinstance(value, dict):
            raise SchemaFixtureError(f"{location}: expected object")
        required = set(schema.get("required", []))
        properties = schema.get("properties", {})
        if not isinstance(properties, dict) or not required.issubset(value):
            raise SchemaFixtureError(f"{location}: missing required field")
        if schema.get("additionalProperties") is False and set(value) - set(properties):
            raise SchemaFixtureError(f"{location}: additional property")
        for key, child in properties.items():
            if key in value:
                validate_schema_fixture(value[key], child, root, f"{location}.{key}")
    elif value_type == "array":
        if not isinstance(value, list):
            raise SchemaFixtureError(f"{location}: expected array")
        if len(value) < int(schema.get("minItems", 0)):
            raise SchemaFixtureError(f"{location}: too few items")
        if "maxItems" in schema and len(value) > int(schema["maxItems"]):
            raise SchemaFixtureError(f"{location}: too many items")
        if schema.get("uniqueItems"):
            encoded = [json.dumps(item, sort_keys=True) for item in value]
            if len(encoded) != len(set(encoded)):
                raise SchemaFixtureError(f"{location}: duplicate items")
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                validate_schema_fixture(item, item_schema, root, f"{location}[{index}]")
    elif value_type == "string":
        if not isinstance(value, str):
            raise SchemaFixtureError(f"{location}: expected string")
        if len(value) < int(schema.get("minLength", 0)):
            raise SchemaFixtureError(f"{location}: string too short")
        if "pattern" in schema and not re.fullmatch(str(schema["pattern"]), value):
            raise SchemaFixtureError(f"{location}: pattern mismatch")
    elif value_type == "integer":
        if not isinstance(value, int) or isinstance(value, bool):
            raise SchemaFixtureError(f"{location}: expected integer")
        if value < int(schema.get("minimum", value)):
            raise SchemaFixtureError(f"{location}: below minimum")
    elif value_type == "null" and value is not None:
        raise SchemaFixtureError(f"{location}: expected null")


class R3ResultAcceptanceSelfTest(unittest.TestCase):
    def shared_plan(self) -> dict[str, object]:
        commands = copy.deepcopy(materializer.EXPECTED_SHARED_COMMANDS)
        return materializer.sealed(
            {
                "schema": "dwp.hris.g7-sys-hrm-shared-verification-plan.v3",
                "planId": "FIXTURE-SHARED-PLAN",
                "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
                "authorityStatus": "CONTROL_PROPOSAL_NOT_PREDECESSOR_AUTHORITY",
                "basis": materializer.EXPECTED_SHARED_BASIS,
                "requiredCategories": materializer.REQUIRED_SHARED_CATEGORIES,
                "closedSet": [row["commandId"] for row in commands],
                "commands": commands,
                "rerunPolicy": "ONE_SHARED_BATCH_NO_PER_FIX_FULL_RERUN",
            }
        )

    def module_test_input(self) -> tuple[dict[str, object], dict[tuple[str, str], dict[str, object]]]:
        results_by_key: dict[tuple[str, str], dict[str, object]] = {}
        rows: list[dict[str, object]] = []
        for index, (command_id, expected) in enumerate(
            materializer.EXPECTED_TEST_COMMANDS.items(), start=1
        ):
            commit = f"{index:040x}"
            tree = f"{index + 10:040x}"
            results_by_key[(expected["module"], expected["repo"])] = {
                "absolutePath": "/module-fixture",
                "basePin": {"commit": "f" * 40, "tree": "e" * 40},
                "resultPin": {"commit": commit, "tree": tree}
            }
            rows.append(
                {
                    "commandId": command_id,
                    "module": expected["module"],
                    "repo": expected["repo"],
                    "cwd": expected["cwd"],
                    "argv": expected["argv"],
                    "status": "PASS",
                    "exitCode": 0,
                    "resultCommit": commit,
                    "resultTree": tree,
                    "executedAt": "2026-10-12T09:00:00Z",
                    "executionBinding": {
                        "mode": "POST_COMMIT_EXACT_RESULT",
                        "testedTree": tree,
                        "authorityStatus": "GIT_COMMIT_BOUND_EXACT_RESULT",
                    },
                    "output": {
                        "path": f"docs/fixture/{command_id}.log",
                        "gitBlobSha1": f"{index + 20:040x}",
                        "sha256": f"{index + 30:064x}",
                        "bytes": index,
                        "redactionStatus": "SANITIZED_NO_SECRET_OR_CUSTOMER_DATA",
                    },
                }
            )
        value = materializer.sealed(
            {
                "schema": "dwp.hris.g7-sys-hrm-module-test-evidence-input.v3",
                "evidenceId": "FIXTURE-MODULE-EVIDENCE",
                "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
                "authorityStatus": "CONTROL_AUTHORED_RESULT_EVIDENCE",
                "closedSet": materializer.EXPECTED_TEST_CLOSED_SET,
                "results": rows,
            }
        )
        return value, results_by_key

    def tokens(self) -> dict[str, dict[str, str]]:
        return {
            "SYS": {
                "issuedAt": "2026-10-12T07:00:00Z",
                "expiresAt": "2026-10-19T09:00:00Z",
            },
            "HRM": {
                "issuedAt": "2026-10-12T07:00:00Z",
                "expiresAt": "2026-10-19T09:00:00Z",
            },
        }

    def git(
        self,
        repo: Path,
        *args: str,
        env: dict[str, str] | None = None,
    ) -> str:
        return subprocess.check_output(
            ["git", "-C", str(repo), *args],
            text=True,
            env=env,
        ).strip()

    def git_run(
        self,
        repo: Path,
        *args: str,
        env: dict[str, str] | None = None,
    ) -> None:
        subprocess.run(
            ["git", "-C", str(repo), *args],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=env,
        )

    def configure_repo(self, repo: Path) -> None:
        self.git_run(repo, "config", "user.email", "r3-test@example.invalid")
        self.git_run(repo, "config", "user.name", "R3 Test")

    def commit_all(self, repo: Path, message: str, timestamp: str) -> str:
        self.git_run(repo, "add", ".")
        environment = os.environ.copy()
        environment["GIT_AUTHOR_DATE"] = timestamp
        environment["GIT_COMMITTER_DATE"] = timestamp
        self.git_run(repo, "commit", "-q", "-m", message, env=environment)
        return self.git(repo, "rev-parse", "HEAD")

    def push(self, repo: Path, branch: str, *, set_upstream: bool = False) -> None:
        args = ["push", "-q"]
        if set_upstream:
            args.append("-u")
        args.extend(["origin", branch])
        self.git_run(repo, *args)

    def write_bytes(self, repo: Path, relative: str, raw: bytes) -> None:
        target = repo / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)

    def write_json(self, repo: Path, relative: str, value: dict[str, object]) -> bytes:
        raw = materializer.json_bytes(value)
        self.write_bytes(repo, relative, raw)
        return raw

    def blob_pin(self, relative: str, raw: bytes) -> dict[str, object]:
        header = f"blob {len(raw)}\0".encode("ascii")
        return {
            "path": relative,
            "gitBlobSha1": hashlib.sha1(header + raw).hexdigest(),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "bytes": len(raw),
        }

    def playwright_report(
        self,
        spec_file: str | None = None,
        source_pins: dict[str, dict[str, str]] | None = None,
    ) -> dict[str, object]:
        # Playwright 1.58 reports a basename when config.rootDir is the e2e directory.
        reported_file = spec_file or Path(materializer.SHARED_TEST_SOURCE_PATH).name
        source_pins = source_pins or {
            "frontend": {"commit": "1" * 40, "tree": "2" * 40},
            "backend": {"commit": "3" * 40, "tree": "4" * 40},
        }
        annotations = [
            {"type": annotation_type, "description": source_pins[repo_name][pin_name]}
            for annotation_type, (repo_name, pin_name) in
            materializer.SOURCE_PIN_ANNOTATIONS.items()
        ]
        specs = []
        for project, title in materializer.PLAYWRIGHT_EXECUTION_PAIRS:
            specs.append(
                {
                    "title": title,
                    "file": reported_file,
                    "ok": True,
                    "tests": [
                        {
                            "projectId": project,
                            "projectName": project,
                            "expectedStatus": "passed",
                            "status": "expected",
                            "annotations": copy.deepcopy(annotations),
                            "results": [
                                {
                                    "status": "passed",
                                    "errors": [],
                                    "stdout": [],
                                    "stderr": [],
                                    "retry": 0,
                                    "annotations": copy.deepcopy(annotations),
                                    "attachments": [],
                                }
                            ],
                        }
                    ],
                }
            )
        return {
            "config": {
                "version": "1.58.0",
                "workers": 1,
                "rootDir": "/fixture/central-frontend/e2e",
                "reporter": [["json"]],
                "projects": [
                    {
                        "id": project,
                        "name": project,
                        "testDir": "/fixture/central-frontend/e2e",
                        "retries": 0,
                        "repeatEach": 1,
                    }
                    for project in materializer.PLAYWRIGHT_PROJECTS
                ],
            },
            "errors": [],
            "stats": {"expected": 4, "skipped": 0, "unexpected": 0, "flaky": 0},
            "suites": [
                {
                    "title": reported_file,
                    "file": reported_file,
                    "specs": specs,
                }
            ],
        }

    def vitest_report(self, frontend: Path) -> dict[str, object]:
        test_results = []
        for index, target in enumerate(materializer.VITEST_TARGETS, start=1):
            test_results.append(
                {
                    "name": (frontend / target).resolve().as_posix(),
                    "status": "passed",
                    "assertionResults": [
                        {
                            "status": "passed",
                            "title": f"fixture assertion {index}",
                            "failureMessages": [],
                        }
                    ],
                }
            )
        return {
            "numTotalTestSuites": 4,
            "numPassedTestSuites": 4,
            "numFailedTestSuites": 0,
            "numPendingTestSuites": 0,
            "numTotalTests": 4,
            "numPassedTests": 4,
            "numFailedTests": 0,
            "numPendingTests": 0,
            "numTodoTests": 0,
            "success": True,
            "testResults": test_results,
        }

    def architecture_output(self) -> bytes:
        digest = "a" * 64
        return (
            "\n".join(
                [
                    "Approval Stitch source PASS: 24 pairs, 24 rasters, 0 recorded fetch gaps; source verification skipped (APPROVAL_STITCH_SOURCE_DIR is not set); tracked manifest verified",
                    "Approval Stitch APR-17..24 PASS: 8 pairs; source verification skipped (APPROVAL_STITCH_EXTENSION_SOURCE_DIR is not set); tracked manifest verified",
                    "Approval APR-17..24 traceability PASS: 8 frames, 6 canonical areas, 2 supplemental areas, 4 source states, 8 viewport captures, 12 supported commands, 3 unavailable controls, 8 owner action contracts, 4 high-risk routes",
                    f"PASS product surface authorization v1-v37 ({digest}); 42 PAGE routes closed.",
                    "PASS internal closure 12/12 products, 48/48 PEP cells (COMPLETE).",
                    f"PASS fixture snapshot and generated TypeScript ({digest}).",
                    "PASS frontend application architecture: 3 independent product applications, 1 independent platform shell, 8 platform features, 12 governed Product Surfaces, Gateway /api.",
                    "PASS route composition: 3 independently deployed applications.",
                    "PASS feature boundaries: product features do not import sibling implementations directly or through component re-export bridges.",
                    "PASS API boundaries: frontend runtime calls are centralized through Gateway /api/** clients.",
                    "PASS relative import cycles: 10 production modules checked.",
                    "PASS production reachability: 10/10 modules reachable from 2 roots; 0 governed verification root(s).",
                    "PASS internal exports: 10 declarations checked; 0 exact documented exception(s).",
                    "PASS source-size budget: 10 production files checked; 2 generated file(s) excluded; new files are limited to 800 lines.",
                    "PASS maintenance source-size budget: 10 test/tool files checked; 0 exact legacy exception(s); new files are limited to 1200 lines.",
                    "Product Surface production readiness evidence",
                    "- manifest: product-surface-production-readiness.v1",
                    "- status: READY",
                    "- complete: 12/12",
                    "- exact product contracts: 12/12",
                    "- internally closed products: 12/12",
                    "- owner-service PEP cells: 12/12",
                    "- release-approved product closure: 12/12",
                    "- internal evidence pending: 0",
                    "- incomplete release evidence: 0",
                    "- mode: schema and integrity only",
                ]
            )
            + "\n"
        ).encode("utf-8")

    def semantic_stdout(self, command_id: str, frontend: Path) -> bytes:
        if command_id == "CONTROL_AUTHORIZATION_CHECK":
            return (
                f"PASS product surface authorization v1-v37 ({'a' * 64}); "
                "42 PAGE routes closed.\n"
            ).encode("utf-8")
        if command_id == "CONTROL_BACKEND_OPENAPI_CHECK":
            return b"OpenAPI contracts verified: 9 services, 123 public Gateway paths.\n"
        if command_id == "CONTROL_FRONTEND_OPENAPI_CHECK":
            return (
                "PASS generated Gateway API types match the approved OpenAPI snapshot.\n"
                "PASS generated Agent API types match the approved OpenAPI snapshot.\n"
            ).encode("utf-8")
        if command_id == materializer.VITEST_COMMAND_ID:
            return json.dumps(
                self.vitest_report(frontend), separators=(",", ":")
            ).encode("utf-8")
        if command_id == "CONTROL_FRONTEND_TYPECHECK":
            return b""
        if command_id == "CONTROL_FRONTEND_ARCHITECTURE":
            return self.architecture_output()
        raise AssertionError(f"no non-Playwright semantic fixture for {command_id}")

    def test_schemas_are_valid_strict_json_with_unique_ids(self) -> None:
        schema_dir = materializer.HERE / "contracts"
        schemas = sorted(schema_dir.glob("*.schema.v3.json"))
        self.assertEqual(6, len(schemas))
        identifiers: list[str] = []
        for path in schemas:
            value = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual("https://json-schema.org/draft/2020-12/schema", value["$schema"])
            self.assertFalse(value["additionalProperties"], path.name)
            pending = [value]
            while pending:
                node = pending.pop()
                if isinstance(node, dict):
                    if node.get("type") == "object":
                        self.assertIs(node.get("additionalProperties"), False, path.name)
                        self.assertEqual(
                            set(node.get("required", [])),
                            set(node.get("properties", {})),
                            path.name,
                        )
                    pending.extend(node.values())
                elif isinstance(node, list):
                    pending.extend(node)
            if path.name in {
                "result-admission-receipt.schema.v3.json",
                "integration-authorization-receipt.schema.v3.json",
                "closure-receipt.schema.v3.json",
            }:
                if path.name == "result-admission-receipt.schema.v3.json":
                    self.assertEqual(
                        (2, 2, True),
                        (
                            value["properties"]["moduleResults"]["minItems"],
                            value["properties"]["moduleResults"]["maxItems"],
                            value["properties"]["moduleResults"]["uniqueItems"],
                        ),
                    )
                    self.assertEqual(
                        (11, 11, True),
                        (
                            value["properties"]["toolchain"]["minItems"],
                            value["properties"]["toolchain"]["maxItems"],
                            value["properties"]["toolchain"]["uniqueItems"],
                        ),
                    )
                elif path.name == "integration-authorization-receipt.schema.v3.json":
                    self.assertEqual(
                        (4, 4, True),
                        (
                            value["properties"]["authorizedResults"]["minItems"],
                            value["properties"]["authorizedResults"]["maxItems"],
                            value["properties"]["authorizedResults"]["uniqueItems"],
                        ),
                    )
                elif path.name == "closure-receipt.schema.v3.json":
                    self.assertEqual(
                        (2, 2, True),
                        (
                            value["properties"]["tokenClosures"]["minItems"],
                            value["properties"]["tokenClosures"]["maxItems"],
                            value["properties"]["tokenClosures"]["uniqueItems"],
                        ),
                    )
            elif path.name == "shared-verification-evidence-input.schema.v3.json":
                self.assertEqual(
                    (7, 7, True),
                    (
                        value["properties"]["results"]["minItems"],
                        value["properties"]["results"]["maxItems"],
                        value["properties"]["results"]["uniqueItems"],
                    ),
                )
            identifiers.append(value["$id"])
        self.assertEqual(len(identifiers), len(set(identifiers)))

    def test_validator_is_independent_and_constants_agree(self) -> None:
        source = (materializer.HERE / "validate_g7_sys_hrm_result_acceptance.py").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("import materialize_g7_sys_hrm_result_acceptance", source)
        self.assertEqual(materializer.EXPECTED_TEST_CLOSED_SET, validator.TEST_CLOSED_SET)
        self.assertEqual(materializer.REQUIRED_SHARED_CATEGORIES, validator.SHARED_CATEGORIES)
        self.assertEqual(materializer.EXPECTED_SHARED_BASIS, validator.EXPECTED_SHARED_BASIS)
        self.assertEqual(materializer.EXPECTED_SHARED_COMMANDS, validator.EXPECTED_SHARED_COMMANDS)
        self.assertEqual(materializer.EXPECTED_SHARED_CLOSED_SET, validator.EXPECTED_SHARED_CLOSED_SET)
        self.assertEqual(materializer.SHARED_PROOF_KINDS, validator.SHARED_PROOF_KINDS)
        self.assertEqual(materializer.RUNNER_EXECUTION_MODE, validator.RUNNER_EXECUTION_MODE)
        self.assertEqual(materializer.RUNNER_GENESIS_SHA256, validator.RUNNER_GENESIS_SHA256)
        self.assertEqual(materializer.SOURCE_PIN_ENVIRONMENT, validator.SOURCE_PIN_ENVIRONMENT)
        self.assertEqual(materializer.SOURCE_PIN_ANNOTATIONS, validator.SOURCE_PIN_ANNOTATIONS)
        self.assertEqual(materializer.VITEST_COMMAND_ID, validator.VITEST_COMMAND_ID)
        self.assertEqual(materializer.VITEST_TARGETS, validator.VITEST_TARGETS)
        self.assertEqual(materializer.AUTHORIZATION_SUCCESS_PATTERN, validator.AUTHORIZATION_SUCCESS_PATTERN)
        self.assertEqual(materializer.BACKEND_OPENAPI_SUCCESS_PATTERN, validator.BACKEND_OPENAPI_SUCCESS_PATTERN)
        self.assertEqual(materializer.FRONTEND_OPENAPI_SUCCESS_LINES, validator.FRONTEND_OPENAPI_SUCCESS_LINES)
        self.assertEqual(materializer.ARCHITECTURE_SUCCESS_MARKERS, validator.ARCHITECTURE_SUCCESS_MARKERS)
        self.assertEqual(materializer.SHARED_TEST_SOURCE_BYTES, validator.SHARED_TEST_SOURCE_BYTES)
        self.assertEqual(materializer.PLAYWRIGHT_PROJECTS, validator.PLAYWRIGHT_PROJECTS)
        self.assertEqual(
            materializer.PLAYWRIGHT_EXECUTION_PAIRS,
            validator.PLAYWRIGHT_EXECUTION_PAIRS,
        )
        self.assertEqual(
            materializer.CONTROL_PREREQUISITES_PATCH_PATH,
            validator.CONTROL_PREREQUISITES_PATCH_PATH,
        )
        self.assertEqual(
            materializer.CONTROL_PREREQUISITE_PATHS,
            validator.CONTROL_PREREQUISITE_PATHS,
        )
        self.assertEqual(materializer.CANONICAL_PACKAGE_SCRIPTS, validator.CANONICAL_PACKAGE_SCRIPTS)
        self.assertEqual(materializer.FRONTEND_CANONICAL_COMMAND_PATHS, validator.FRONTEND_CANONICAL_COMMAND_PATHS)
        self.assertEqual(materializer.BACKEND_CANONICAL_COMMAND_PATHS, validator.BACKEND_CANONICAL_COMMAND_PATHS)
        self.assertEqual(materializer.MODULES, validator.MODULES)
        self.assertEqual(materializer.TOOL_RELATIVE_PATHS, validator.TOOL_RELATIVE_PATHS)
        self.assertEqual(11, len(materializer.TOOL_RELATIVE_PATHS))
        self.assertIn("control-prerequisites.patch", materializer.TOOL_RELATIVE_PATHS)
        self.assertNotIn(materializer.SHARED_TEST_SOURCE_PATH, materializer.TOOL_RELATIVE_PATHS)
        self.assertEqual(materializer.R2_PROMOTION_CARRIER_COMMIT, validator.R2_PROMOTION_CARRIER_COMMIT)
        self.assertEqual(materializer.R2_PROMOTION_CARRIER_TREE, validator.R2_PROMOTION_CARRIER_TREE)
        self.assertEqual(materializer.R2_PROMOTION_RECEIPT_SHA256, validator.R2_PROMOTION_RECEIPT_SHA256)
        self.assertEqual(
            "2fc4faa5d8631dda6a3cbabefeef9ba606feca52",
            materializer.R2_PROMOTION_CARRIER_COMMIT,
        )
        self.assertEqual(
            "06807365ae5d289eda8ca82a6cc5071abc315037",
            materializer.R2_PROMOTION_CARRIER_TREE,
        )
        self.assertEqual(
            "d09e250da60b797404109dca5342db7cb6806144b51e3f5c92cd2ebc9925d275",
            materializer.R2_PROMOTION_RECEIPT_SHA256,
        )
        authorize_args = materializer.build_parser().parse_args(
            [
                "authorize",
                "--run-id",
                "parser-fixture",
                "--admission-carrier",
                "a" * 40,
                "--backend-pre-commit",
                "b" * 40,
            ]
        )
        self.assertEqual("b" * 40, authorize_args.backend_pre_commit)

    def test_seals_fail_closed_after_tamper_in_both_implementations(self) -> None:
        value = materializer.sealed({"schema": "fixture", "state": "PASS"})
        materializer.verify_seal(value, "fixture")
        validator.check_seal(value, "fixture")
        tampered = copy.deepcopy(value)
        tampered["state"] = "FAIL"
        with self.assertRaises(materializer.GateError):
            materializer.verify_seal(tampered, "fixture")
        with self.assertRaises(validator.ValidationError):
            validator.check_seal(tampered, "fixture")

    def test_runner_record_hash_chain_detects_field_tamper(self) -> None:
        row = {
            "recordIndex": 1,
            "commandId": "CONTROL_AUTHORIZATION_CHECK",
            "previousRecordSha256": materializer.RUNNER_GENESIS_SHA256,
            "exitCode": 0,
        }
        digest = materializer.runner_record_digest(row)
        self.assertEqual(digest, validator.runner_record_digest(row))
        tampered = copy.deepcopy(row)
        tampered["exitCode"] = 1
        self.assertNotEqual(digest, materializer.runner_record_digest(tampered))

    def test_shared_plan_is_closed_set_and_proposal_labeled(self) -> None:
        value = self.shared_plan()
        materializer.validate_shared_plan(value)
        validator.verify_plan(value)
        missing = copy.deepcopy(value)
        missing["commands"] = missing["commands"][:-1]
        missing = materializer.sealed(missing)
        with self.assertRaises(materializer.GateError):
            materializer.validate_shared_plan(missing)
        overstated = copy.deepcopy(value)
        overstated["authorityStatus"] = "AUTHORITATIVE_PREDECESSOR_PLAN"
        overstated = materializer.sealed(overstated)
        with self.assertRaises(validator.ValidationError):
            validator.verify_plan(overstated)
        resealed_extra = copy.deepcopy(value)
        resealed_extra["unexpectedAuthority"] = True
        resealed_extra = materializer.sealed(resealed_extra)
        with self.assertRaises(materializer.GateError):
            materializer.validate_shared_plan(resealed_extra)
        with self.assertRaises(validator.ValidationError):
            validator.verify_plan(resealed_extra)
        arbitrary = copy.deepcopy(value)
        arbitrary["commands"][0]["argv"] = ["node", "scripts/fake-pass.mjs"]
        arbitrary = materializer.sealed(arbitrary)
        with self.assertRaises(materializer.GateError):
            materializer.validate_shared_plan(arbitrary)
        with self.assertRaises(validator.ValidationError):
            validator.verify_plan(arbitrary)

    def test_playwright_json_requires_exact_workers_projects_journeys_and_passes(self) -> None:
        source_pins = {
            "frontend": {"commit": "1" * 40, "tree": "2" * 40},
            "backend": {"commit": "3" * 40, "tree": "4" * 40},
        }

        def assert_rejected(value: dict[str, object]) -> None:
            rejected_raw = json.dumps(value).encode("utf-8")
            with self.assertRaises(materializer.GateError):
                materializer.validate_playwright_json(rejected_raw, source_pins)
            with self.assertRaises(validator.ValidationError):
                validator.verify_playwright_report(rejected_raw, source_pins)

        raw = json.dumps(self.playwright_report()).encode("utf-8")
        expected = materializer.expected_playwright_summary(source_pins)
        self.assertEqual(expected, materializer.validate_playwright_json(raw, source_pins))
        self.assertEqual(expected, validator.verify_playwright_report(raw, source_pins))
        with self.assertRaises(materializer.GateError):
            materializer.expected_structured_result(
                materializer.PLAYWRIGHT_COMMAND_ID,
                source_pins,
                raw,
                b"unexpected stderr\n",
                0,
                Path("/fixture/central-frontend"),
            )
        with self.assertRaises(validator.ValidationError):
            validator.expected_structured_result(
                validator.PLAYWRIGHT_COMMAND_ID,
                source_pins,
                raw,
                b"unexpected stderr\n",
                0,
                Path("/fixture/central-frontend"),
            )
        canonical_raw = json.dumps(
            self.playwright_report(materializer.SHARED_TEST_SOURCE_PATH)
        ).encode("utf-8")
        self.assertEqual(expected, materializer.validate_playwright_json(canonical_raw, source_pins))
        self.assertEqual(expected, validator.verify_playwright_report(canonical_raw, source_pins))
        tampered = self.playwright_report()
        tampered["config"]["workers"] = 2
        assert_rejected(tampered)
        assert_rejected(self.playwright_report("other.spec.ts"))
        assert_rejected(
            self.playwright_report(
                "/fixture/central-frontend/e2e/"
                + Path(materializer.SHARED_TEST_SOURCE_PATH).name
            )
        )
        wrong_source = self.playwright_report()
        wrong_source["suites"][0]["specs"][0]["tests"][0]["annotations"][0][
            "description"
        ] = "9" * 40
        assert_rejected(wrong_source)

        malformed_reports: list[dict[str, object]] = []
        boolean_workers = self.playwright_report()
        boolean_workers["config"]["workers"] = True
        malformed_reports.append(boolean_workers)
        boolean_stats = self.playwright_report()
        boolean_stats["stats"]["skipped"] = False
        malformed_reports.append(boolean_stats)
        boolean_retries = self.playwright_report()
        boolean_retries["config"]["projects"][0]["retries"] = False
        malformed_reports.append(boolean_retries)
        boolean_repeat = self.playwright_report()
        boolean_repeat["config"]["projects"][0]["repeatEach"] = True
        malformed_reports.append(boolean_repeat)
        reordered = self.playwright_report()
        reordered["suites"][0]["specs"][0], reordered["suites"][0]["specs"][1] = (
            reordered["suites"][0]["specs"][1],
            reordered["suites"][0]["specs"][0],
        )
        malformed_reports.append(reordered)
        duplicate = self.playwright_report()
        duplicate["suites"][0]["specs"][3] = copy.deepcopy(
            duplicate["suites"][0]["specs"][2]
        )
        malformed_reports.append(duplicate)
        missing = self.playwright_report()
        missing["suites"][0]["specs"].pop()
        malformed_reports.append(missing)
        extra = self.playwright_report()
        extra["suites"][0]["specs"].append(
            copy.deepcopy(extra["suites"][0]["specs"][0])
        )
        malformed_reports.append(extra)
        two_tests = self.playwright_report()
        two_tests["suites"][0]["specs"][0]["tests"].append(
            copy.deepcopy(two_tests["suites"][0]["specs"][0]["tests"][0])
        )
        malformed_reports.append(two_tests)
        wrong_project = self.playwright_report()
        wrong_project["suites"][0]["specs"][0]["tests"][0]["projectId"] = "mobile"
        malformed_reports.append(wrong_project)
        for field, value in (
            ("stdout", ["unexpected"]),
            ("stderr", ["unexpected"]),
            ("retry", 1),
            ("retry", False),
            ("attachments", [{"name": "unexpected"}]),
        ):
            dirty_result = self.playwright_report()
            dirty_result["suites"][0]["specs"][0]["tests"][0]["results"][0][field] = value
            malformed_reports.append(dirty_result)
        no_result = self.playwright_report()
        no_result["suites"][0]["specs"][0]["tests"][0]["results"] = []
        malformed_reports.append(no_result)
        two_results = self.playwright_report()
        two_results["suites"][0]["specs"][0]["tests"][0]["results"].append(
            copy.deepcopy(
                two_results["suites"][0]["specs"][0]["tests"][0]["results"][0]
            )
        )
        malformed_reports.append(two_results)
        wrong_result_source = self.playwright_report()
        wrong_result_source["suites"][0]["specs"][0]["tests"][0]["results"][0][
            "annotations"
        ][0]["description"] = "9" * 40
        malformed_reports.append(wrong_result_source)
        nested = self.playwright_report()
        nested["suites"][0]["suites"] = [{"title": "unexpected", "specs": []}]
        malformed_reports.append(nested)
        extra_suite = self.playwright_report()
        extra_suite["suites"].append(copy.deepcopy(extra_suite["suites"][0]))
        malformed_reports.append(extra_suite)
        for malformed in malformed_reports:
            assert_rejected(malformed)

    def test_non_playwright_semantic_proofs_reject_forged_output_stderr_and_exit(self) -> None:
        frontend = Path("/fixture/central-frontend")
        source_pins = {
            "frontend": {"commit": "1" * 40, "tree": "2" * 40},
            "backend": {"commit": "3" * 40, "tree": "4" * 40},
        }
        command_ids = materializer.EXPECTED_SHARED_CLOSED_SET[:-1]
        for command_id in command_ids:
            with self.subTest(command_id=command_id):
                stdout = self.semantic_stdout(command_id, frontend)
                materialized = materializer.expected_structured_result(
                    command_id, source_pins, stdout, b"", 0, frontend
                )
                independently_verified = validator.expected_structured_result(
                    command_id, source_pins, stdout, b"", 0, frontend
                )
                self.assertEqual(materialized, independently_verified)
                self.assertEqual(hashlib.sha256(stdout).hexdigest(), materialized["stdoutSha256"])
                self.assertIsInstance(materialized["report"], dict)

                if command_id == "CONTROL_AUTHORIZATION_CHECK":
                    forged = b"PASS\n"
                elif command_id == "CONTROL_BACKEND_OPENAPI_CHECK":
                    forged = b"OpenAPI contracts written.\n"
                elif command_id == "CONTROL_FRONTEND_OPENAPI_CHECK":
                    forged = materializer.FRONTEND_OPENAPI_SUCCESS_LINES[0].encode("utf-8")
                elif command_id == materializer.VITEST_COMMAND_ID:
                    report = self.vitest_report(frontend)
                    report["success"] = False
                    forged = json.dumps(report, separators=(",", ":")).encode("utf-8")
                elif command_id == "CONTROL_FRONTEND_TYPECHECK":
                    forged = b"PASS typecheck\n"
                else:
                    forged = b"\n".join(self.architecture_output().splitlines()[:-1]) + b"\n"

                with self.assertRaises(materializer.GateError):
                    materializer.expected_structured_result(
                        command_id, source_pins, forged, b"", 0, frontend
                    )
                with self.assertRaises(validator.ValidationError):
                    validator.expected_structured_result(
                        command_id, source_pins, forged, b"", 0, frontend
                    )
                with self.assertRaises(materializer.GateError):
                    materializer.expected_structured_result(
                        command_id, source_pins, stdout, b"forged stderr\n", 0, frontend
                    )
                with self.assertRaises(validator.ValidationError):
                    validator.expected_structured_result(
                        command_id, source_pins, stdout, b"forged stderr\n", 0, frontend
                    )
                with self.assertRaises(materializer.GateError):
                    materializer.expected_structured_result(
                        command_id, source_pins, stdout, b"", 1, frontend
                    )
                with self.assertRaises(validator.ValidationError):
                    validator.expected_structured_result(
                        command_id, source_pins, stdout, b"", 1, frontend
                    )

    def test_shared_source_requires_active_integrated_modules_and_owner_requests(self) -> None:
        source = materializer.SHARED_TEST_SOURCE_BYTES.decode("utf-8")
        for marker in (
            "E2E_BASE_URL=http://127.0.0.1:4200",
            "E2E_REUSE_EXISTING_SERVER=false",
            "VITE_HRIS_REFERENCE_CONFIGURATION_ENABLED=true",
            "VITE_HRIS_EMPLOYEE_CHANGE_ENABLED=true",
        ):
            self.assertIn(marker, materializer.EXPECTED_SHARED_COMMANDS[-1]["argv"])
        self.assertIn("toHaveAttribute('data-runtime-state', 'ON')", source)
        self.assertIn("Reference configuration is unavailable", source)
        self.assertIn("Employee change requests", source)
        self.assertIn("ownerRequestCount += 1", source)
        self.assertIn("/api/platform/v1/hris/workbench/settings-reference", source)
        self.assertIn("/api/people/v1/hris/workbench/operations/employee/change/requests", source)
        for environment_name, annotation_type in zip(
            materializer.SOURCE_PIN_ENVIRONMENT,
            materializer.SOURCE_PIN_ANNOTATIONS,
        ):
            self.assertIn(environment_name, source)
            self.assertIn(annotation_type, source)

    def test_canonical_shared_command_sources_fail_when_a_real_target_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            frontend = root / "frontend"
            backend = root / "backend"
            subprocess.run(["git", "init", "-q", str(frontend)], check=True)
            subprocess.run(["git", "init", "-q", str(backend)], check=True)
            self.configure_repo(frontend)
            self.configure_repo(backend)
            self.write_json(
                frontend,
                "package.json",
                {
                    "scripts": materializer.CANONICAL_PACKAGE_SCRIPTS,
                    "devDependencies": {
                        name: "1.0.0"
                        for name in materializer.CANONICAL_PACKAGE_DEPENDENCIES
                    },
                },
            )
            missing = materializer.FRONTEND_CANONICAL_COMMAND_PATHS[-2]
            for path_value in materializer.FRONTEND_CANONICAL_COMMAND_PATHS:
                if path_value in {"package.json", missing}:
                    continue
                raw = (
                    materializer.SHARED_TEST_SOURCE_BYTES
                    if path_value == materializer.SHARED_TEST_SOURCE_PATH
                    else b"fixture\n"
                )
                self.write_bytes(frontend, path_value, raw)
            for path_value in materializer.BACKEND_CANONICAL_COMMAND_PATHS:
                self.write_bytes(backend, path_value, b"fixture\n")
            frontend_commit = self.commit_all(
                frontend, "missing canonical target", "2026-10-12T06:00:00Z"
            )
            backend_commit = self.commit_all(
                backend, "backend canonical target", "2026-10-12T06:00:00Z"
            )
            with self.assertRaises(materializer.GateError):
                materializer.verify_canonical_command_sources(
                    frontend, frontend_commit, backend, backend_commit
                )
            with self.assertRaises(validator.ValidationError):
                validator.verify_canonical_command_sources(
                    frontend, frontend_commit, backend, backend_commit
                )

    def test_module_test_input_exact_four_commands_and_no_suite_rerun(self) -> None:
        value, results = self.module_test_input()
        with patch.object(materializer, "verify_output_pin", return_value=None), patch.object(
            materializer,
            "commit_time",
            side_effect=lambda repo, _commit: materializer.parse_time(
                "2026-10-12T08:00:00Z" if str(repo) == "/module-fixture" else "2026-10-12T10:00:00Z",
                "fixture",
            ),
        ):
            materializer.validate_module_test_input(
                value,
                Path("/fixture"),
                "a" * 40,
                "fixture-run",
                results,
                self.tokens(),
            )
        bad = copy.deepcopy(value)
        bad["results"][0]["exitCode"] = 1
        bad = materializer.sealed(bad)
        with patch.object(materializer, "verify_output_pin", return_value=None), patch.object(
            materializer,
            "commit_time",
            side_effect=lambda repo, _commit: materializer.parse_time(
                "2026-10-12T08:00:00Z" if str(repo) == "/module-fixture" else "2026-10-12T10:00:00Z",
                "fixture",
            ),
        ):
            with self.assertRaises(materializer.GateError):
                materializer.validate_module_test_input(
                    bad,
                    Path("/fixture"),
                    "a" * 40,
                    "fixture-run",
                    results,
                    self.tokens(),
                )

    def test_pre_commit_final_tree_binding_accepts_exact_tree_and_rejects_early_or_mismatch(self) -> None:
        value, results = self.module_test_input()
        for row in value["results"]:
            row["executionBinding"] = {
                "mode": "PRE_COMMIT_FINAL_TREE",
                "testedTree": row["resultTree"],
                "authorityStatus": "CONTROL_ASSERTED_WORKTREE_TREE_EQUALS_RESULT_TREE",
            }
        value = materializer.sealed(value)
        result_commits = {
            result["resultPin"]["commit"] for result in results.values()
        }

        def fixture_commit_time(repo: Path, revision: str) -> datetime:
            if str(repo) == "/fixture":
                value_text = "2026-10-12T10:00:00Z"
            elif revision in result_commits:
                value_text = "2026-10-12T09:30:00Z"
            else:
                value_text = "2026-10-12T08:00:00Z"
            return materializer.parse_time(value_text, "fixture")

        result_info = {
            key: {"row": result, "repo": Path(str(result["absolutePath"]))}
            for key, result in results.items()
        }
        with patch.object(materializer, "verify_output_pin", return_value=None), patch.object(
            materializer, "commit_time", side_effect=fixture_commit_time
        ):
            materializer.validate_module_test_input(
                value,
                Path("/fixture"),
                "a" * 40,
                "fixture-run",
                results,
                self.tokens(),
            )
        with patch.object(validator, "verify_output", return_value=None), patch.object(
            validator, "commit_time", side_effect=fixture_commit_time
        ):
            validator.verify_module_evidence(
                value,
                Path("/fixture"),
                "a" * 40,
                "fixture-run",
                result_info,
                self.tokens(),
            )

        for mutation in ("tree", "early"):
            tampered = copy.deepcopy(value)
            if mutation == "tree":
                tampered["results"][0]["executionBinding"]["testedTree"] = "0" * 40
            else:
                tampered["results"][0]["executedAt"] = "2026-10-12T06:59:59Z"
            tampered = materializer.sealed(tampered)
            with patch.object(materializer, "verify_output_pin", return_value=None), patch.object(
                materializer, "commit_time", side_effect=fixture_commit_time
            ):
                with self.assertRaises(materializer.GateError):
                    materializer.validate_module_test_input(
                        tampered,
                        Path("/fixture"),
                        "a" * 40,
                        "fixture-run",
                        results,
                        self.tokens(),
                    )
            with patch.object(validator, "verify_output", return_value=None), patch.object(
                validator, "commit_time", side_effect=fixture_commit_time
            ):
                with self.assertRaises(validator.ValidationError):
                    validator.verify_module_evidence(
                        tampered,
                        Path("/fixture"),
                        "a" * 40,
                        "fixture-run",
                        result_info,
                        self.tokens(),
                    )

    def test_path_policy_rejects_protected_and_outside_paths(self) -> None:
        allowed = ["backend:service/domain/**"]
        protected = ["backend:service/domain/protected/**"]
        valid = [{"path": "service/domain/ok.java"}]
        materializer.enforce_path_policy("backend", valid, allowed, protected, "fixture")
        with self.assertRaises(materializer.GateError):
            materializer.enforce_path_policy(
                "backend",
                [{"path": "service/domain/protected/no.java"}],
                allowed,
                protected,
                "fixture",
            )
        with self.assertRaises(materializer.GateError):
            materializer.enforce_path_policy(
                "backend",
                [{"path": "service/shared/no.java"}],
                allowed,
                protected,
                "fixture",
            )

    def test_union_rejects_cross_module_overlap(self) -> None:
        file_value = {
            "path": "same/file.ts",
            "change": "ADD",
            "before": None,
            "after": {"mode": "100644", "gitBlobSha1": "a" * 40, "bytes": 1, "sha256": "b" * 64},
        }
        module_results = [
            {"module": "SYS", "worktrees": [{"repo": "frontend", "changedFiles": [file_value]}]},
            {"module": "HRM", "worktrees": [{"repo": "frontend", "changedFiles": [file_value]}]},
        ]
        with self.assertRaises(materializer.GateError):
            materializer.expected_union(module_results)
        with self.assertRaises(validator.ValidationError):
            validator.union_from_admission({"moduleResults": module_results})

    def test_validator_closes_migration_authority_independently(self) -> None:
        source = (
            materializer.HERE / "validate_g7_sys_hrm_result_acceptance.py"
        ).read_text(encoding="utf-8")
        for expected in (
            'token.get("migrationLeaseId") != "G7-LEASE-SYS-PLATFORM-V325-R2"',
            'token_authority.get("migrationAuthorityMode") != "ADMITTED_EXACT_LEASE"',
            'prerequisite.get("mode") != "CONTROL_BOOTSTRAP_READ_ONLY_PIN"',
            'prerequisite.get("exactRelativePath") != path_value',
            'prerequisite.get("migrationEditAuthorized") is not False',
            'prerequisite.get("frozenBackendCommit")',
        ):
            self.assertIn(expected, source)

    def test_real_git_fresh_run_end_to_end_and_deep_schema_tamper(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            frontend_remote = root / "frontend-origin.git"
            backend_remote = root / "backend-origin.git"
            subprocess.run(["git", "init", "--bare", "-q", str(frontend_remote)], check=True)
            subprocess.run(["git", "init", "--bare", "-q", str(backend_remote)], check=True)

            frontend = root / "central-frontend"
            backend = root / "central-backend"
            frontend.mkdir()
            backend.mkdir()
            self.git_run(frontend, "init", "-q")
            self.git_run(backend, "init", "-q")
            self.configure_repo(frontend)
            self.configure_repo(backend)
            frontend_branch = "control-frontend"
            backend_branch = "control-backend"
            self.git_run(frontend, "checkout", "-q", "-b", frontend_branch)
            self.git_run(backend, "checkout", "-q", "-b", backend_branch)
            self.git_run(frontend, "remote", "add", "origin", str(frontend_remote))
            self.git_run(backend, "remote", "add", "origin", str(backend_remote))
            self.write_bytes(frontend, "base/frontend.txt", b"frontend-base\n")
            self.write_bytes(
                frontend,
                "package.json",
                (materializer.DEFAULT_FRONTEND / "package.json").read_bytes(),
            )
            for path_value in materializer.FRONTEND_CANONICAL_COMMAND_PATHS:
                if path_value not in {"package.json", materializer.SHARED_TEST_SOURCE_PATH}:
                    self.write_bytes(
                        frontend,
                        path_value,
                        (materializer.DEFAULT_FRONTEND / path_value).read_bytes(),
                    )
            frontend_base = self.commit_all(frontend, "frontend base", "2026-10-12T08:00:00Z")
            self.push(frontend, frontend_branch, set_upstream=True)
            v54_path = materializer.MODULES["HRM"]["migrationPath"]
            v54_raw = b"-- frozen V54\n"
            self.write_bytes(backend, "base/backend.txt", b"backend-base\n")
            self.write_bytes(backend, v54_path, v54_raw)
            for path_value in materializer.BACKEND_CANONICAL_COMMAND_PATHS:
                self.write_bytes(
                    backend,
                    path_value,
                    (materializer.DEFAULT_BACKEND / path_value).read_bytes(),
                )
            backend_base = self.commit_all(backend, "backend base", "2026-10-12T08:00:00Z")
            self.push(backend, backend_branch, set_upstream=True)

            def clone_module(
                name: str,
                remote: Path,
                source_branch: str,
                result_branch: str,
            ) -> Path:
                repo = root / name
                subprocess.run(
                    ["git", "clone", "-q", "--no-checkout", str(remote), str(repo)],
                    check=True,
                )
                self.configure_repo(repo)
                self.git_run(
                    repo,
                    "checkout",
                    "-q",
                    "-b",
                    result_branch,
                    f"origin/{source_branch}",
                )
                return repo

            module_specs = {
                ("SYS", "frontend"): ("sys-frontend", frontend_remote, frontend_branch, "sys-frontend-result"),
                ("SYS", "backend"): ("sys-backend", backend_remote, backend_branch, "sys-backend-result"),
                ("HRM", "frontend"): ("hrm-frontend", frontend_remote, frontend_branch, "hrm-frontend-result"),
                ("HRM", "backend"): ("hrm-backend", backend_remote, backend_branch, "hrm-backend-result"),
            }
            module_repos = {
                key: clone_module(*specification)
                for key, specification in module_specs.items()
            }
            module_changes = {
                ("SYS", "frontend"): {
                    "apps/dwp/src/features/hris/administration/reference-configuration/result.ts": b"export const sys = true;\n"
                },
                ("HRM", "frontend"): {
                    "apps/dwp/src/features/hris/employee-services/employee-change/result.ts": b"export const hrm = true;\n"
                },
                ("SYS", "backend"): {
                    "dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/referenceconfiguration/SysResult.java": b"class SysResult {}\n",
                    materializer.MODULES["SYS"]["migrationPath"]: b"-- leased V325\n",
                },
                ("HRM", "backend"): {
                    "dwp-people-server/src/main/java/com/dwp/services/people/hris/employeeservice/employeechange/HrmResult.java": b"class HrmResult {}\n"
                },
            }
            result_times = {
                ("SYS", "frontend"): "2026-10-12T08:10:00Z",
                ("SYS", "backend"): "2026-10-12T08:11:00Z",
                ("HRM", "frontend"): "2026-10-12T08:12:00Z",
                ("HRM", "backend"): "2026-10-12T08:13:00Z",
            }
            result_pins: dict[tuple[str, str], dict[str, str]] = {}
            for key, repo in module_repos.items():
                for relative, raw in module_changes[key].items():
                    self.write_bytes(repo, relative, raw)
                result_commit = self.commit_all(repo, f"{key} result", result_times[key])
                result_branch = module_specs[key][3]
                self.push(repo, result_branch, set_upstream=True)
                result_pins[key] = {
                    "commit": result_commit,
                    "tree": self.git(repo, "rev-parse", f"{result_commit}^{{tree}}"),
                }

            packet_paths = {
                "SYS": materializer.EXPECTED_SHARED_BASIS[0].split("#", 1)[0],
                "HRM": materializer.EXPECTED_SHARED_BASIS[1].split("#", 1)[0],
            }
            packet_raw: dict[str, bytes] = {}
            for module in ("SYS", "HRM"):
                commands = []
                for command_id in (f"{module}_BACKEND_TARGETED", f"{module}_FRONTEND_TARGETED"):
                    expected = materializer.EXPECTED_TEST_COMMANDS[command_id]
                    commands.append(
                        {
                            "cwd": expected["cwd"],
                            "argv": expected["argv"],
                            "stage": "TARGETED_MODULE",
                        }
                    )
                packet = materializer.sealed(
                    {
                        "packetId": f"FIXTURE-{module}-PACKET",
                        "verificationBindings": {"moduleCommands": commands},
                    }
                )
                packet_raw[module] = self.write_json(frontend, packet_paths[module], packet)

            frontend_base_tree = self.git(frontend, "rev-parse", f"{frontend_base}^{{tree}}")
            backend_base_tree = self.git(backend, "rev-parse", f"{backend_base}^{{tree}}")
            v54_sha256 = hashlib.sha256(v54_raw).hexdigest()
            tokens: dict[str, dict[str, object]] = {}
            token_raw: dict[str, bytes] = {}
            for module in ("SYS", "HRM"):
                bindings = []
                for repo_name in ("frontend", "backend"):
                    bindings.append(
                        {
                            "repo": repo_name,
                            "absolute_path": str(module_repos[(module, repo_name)].resolve()),
                            "branch": module_specs[(module, repo_name)][3],
                            "upstream": f"origin/{module_specs[(module, repo_name)][3]}",
                        }
                    )
                if module == "SYS":
                    allowed = [
                        "frontend:apps/dwp/src/features/hris/administration/reference-configuration/**",
                        "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/referenceconfiguration/**",
                        "backend:dwp-platform-server/src/main/resources/db/migration/V325__create_hris_reference_configuration_lifecycle.sql",
                    ]
                    migration_fields = {
                        "migrationLeaseId": "G7-LEASE-SYS-PLATFORM-V325-R2",
                        "controlOwnedMigrationPrerequisite": None,
                    }
                    migration_authority = {
                        "migrationAuthorityMode": "ADMITTED_EXACT_LEASE",
                        "migrationEditAuthorized": True,
                    }
                else:
                    allowed = [
                        "frontend:apps/dwp/src/features/hris/employee-services/employee-change/**",
                        "backend:dwp-people-server/src/main/java/com/dwp/services/people/hris/employeeservice/employeechange/**",
                    ]
                    migration_fields = {
                        "migrationLeaseId": None,
                        "controlOwnedMigrationPrerequisite": {
                            "mode": "CONTROL_BOOTSTRAP_READ_ONLY_PIN",
                            "exactRelativePath": v54_path,
                            "sha256": v54_sha256,
                            "frozenBackendCommit": backend_base,
                            "state": "CONTROL_BOOTSTRAP_CONSUMED_READ_ONLY",
                            "migrationEditAuthorized": False,
                        },
                    }
                    migration_authority = {
                        "migrationAuthorityMode": "CONTROL_BOOTSTRAP_READ_ONLY_PIN",
                        "migrationEditAuthorized": False,
                    }
                token = materializer.sealed(
                    {
                        "tokenId": materializer.MODULES[module]["tokenId"],
                        "packetId": f"FIXTURE-{module}-PACKET",
                        "packetPath": packet_paths[module],
                        "packetFileSha256": hashlib.sha256(packet_raw[module]).hexdigest(),
                        "worktreeBindings": bindings,
                        "executionBasePins": {
                            "frontend": {"commit": frontend_base, "tree": frontend_base_tree},
                            "backend": {"commit": backend_base, "tree": backend_base_tree},
                        },
                        "effectiveAllowedPaths": allowed,
                        "protectedPaths": ([f"backend:{v54_path}"] if module == "HRM" else []),
                        "pathPolicySha256": ("1" if module == "SYS" else "2") * 64,
                        "issuedAt": "2026-10-12T08:20:00Z",
                        "expiresAt": "2026-10-19T09:00:00Z",
                        "authority": {
                            **migration_authority,
                            "integrationMergeAuthorized": False,
                        },
                        **migration_fields,
                    }
                )
                tokens[module] = token
                token_path = materializer.MODULES[module]["tokenPath"].as_posix()
                token_raw[module] = self.write_json(frontend, token_path, token)

            r2_placeholders = [
                materializer.R2_ROOT_REL / "control-bootstrap-completion.v2.json",
                materializer.R2_ROOT_REL / "manifest.v2.json",
                materializer.R2_ROOT_REL / "migration-leases.delta.v2.json",
                materializer.R2_ROOT_REL / "registers/module-worktrees.active.v2.csv",
                materializer.R2_ROOT_REL / "state/delegation-after-sys-hrm-promotion.v2.json",
            ]
            for placeholder in r2_placeholders:
                self.write_bytes(frontend, placeholder.as_posix(), b"fixture\n")
            bundle_commit = self.commit_all(frontend, "R2 bundle", "2026-10-12T08:20:00Z")
            bundle_tree = self.git(frontend, "rev-parse", f"{bundle_commit}^{{tree}}")
            promotion = materializer.sealed(
                {
                    "schema": "dwp.hris.g7-sys-hrm-promotion-receipt.v2",
                    "status": "PASS_SCOPED_DELEGATION",
                    "bundleCommit": {"commit": bundle_commit, "tree": bundle_tree},
                    "activeTokenClosedSet": [
                        materializer.MODULES["SYS"]["tokenId"],
                        materializer.MODULES["HRM"]["tokenId"],
                    ],
                    "delegations": [
                        {
                            "module": module,
                            "tokenId": materializer.MODULES[module]["tokenId"],
                            "tokenSha256": hashlib.sha256(token_raw[module]).hexdigest(),
                        }
                        for module in ("SYS", "HRM")
                    ],
                    "authority": {"integrationMergeAuthorized": False},
                }
            )
            promotion_raw = self.write_json(
                frontend, materializer.R2_PROMOTION_REL.as_posix(), promotion
            )
            promotion_commit = self.commit_all(
                frontend, "R2 promotion", "2026-10-12T08:21:00Z"
            )
            promotion_tree = self.git(frontend, "rev-parse", f"{promotion_commit}^{{tree}}")
            self.push(frontend, frontend_branch)

            for relative in materializer.TOOL_RELATIVE_PATHS:
                self.write_bytes(
                    frontend,
                    (materializer.R3_ROOT_REL / relative).as_posix(),
                    (materializer.HERE / relative).read_bytes(),
                )
            tooling_commit = self.commit_all(
                frontend, "R3 tooling carrier", "2026-10-12T08:22:00Z"
            )
            self.push(frontend, frontend_branch)

            central_materializer = {
                "frontend": (frontend_branch, f"origin/{frontend_branch}"),
                "backend": (backend_branch, f"origin/{backend_branch}"),
            }
            central_validator = {
                "frontend": {"branch": frontend_branch, "upstream": f"origin/{frontend_branch}"},
                "backend": {"branch": backend_branch, "upstream": f"origin/{backend_branch}"},
            }
            with ExitStack() as source_stack:
                source_stack.enter_context(
                    patch.object(materializer, "CENTRAL_BRANCHES", central_materializer)
                )
                source_stack.enter_context(patch.object(validator, "CENTRAL", central_validator))
                for module in (materializer, validator):
                    source_stack.enter_context(
                        patch.object(module, "R2_PROMOTION_CARRIER_COMMIT", promotion_commit)
                    )
                    source_stack.enter_context(
                        patch.object(module, "R2_PROMOTION_CARRIER_TREE", promotion_tree)
                    )
                    source_stack.enter_context(
                        patch.object(
                            module,
                            "R2_PROMOTION_RECEIPT_SHA256",
                            hashlib.sha256(promotion_raw).hexdigest(),
                        )
                    )
                source_paths = materializer.prepare_shared_test_source(
                    frontend, tooling_commit
                )
                self.assertEqual(
                    [
                        *materializer.CONTROL_PREREQUISITE_PATHS,
                        materializer.SHARED_TEST_SOURCE_PATH,
                    ],
                    [path.as_posix() for path in source_paths],
                )
                source_carrier = self.commit_all(
                    frontend, "shared test source carrier", "2026-10-12T08:23:00Z"
                )
                self.push(frontend, frontend_branch)
                validator.verify_shared_test_source_carrier(
                    frontend, source_carrier, require_current=True
                )

            run_id = "fresh-e2e"
            run_root = materializer.run_root_rel(run_id)
            evidence_path = (run_root / "module-test-evidence.v3.json").as_posix()
            plan_path = (run_root / "shared-plan.v3.json").as_posix()
            output_pins: dict[str, dict[str, object]] = {}
            for command_id in materializer.EXPECTED_TEST_CLOSED_SET:
                output_path = (run_root / "module-logs" / f"{command_id}.log").as_posix()
                output_raw = f"{command_id}: PASS\n".encode("utf-8")
                self.write_bytes(frontend, output_path, output_raw)
                output_pins[command_id] = {
                    **self.blob_pin(output_path, output_raw),
                    "redactionStatus": "SANITIZED_NO_SECRET_OR_CUSTOMER_DATA",
                }
            evidence_rows = []
            for command_id, expected in materializer.EXPECTED_TEST_COMMANDS.items():
                result_pin = result_pins[(expected["module"], expected["repo"])]
                evidence_rows.append(
                    {
                        "commandId": command_id,
                        "module": expected["module"],
                        "repo": expected["repo"],
                        "cwd": expected["cwd"],
                        "argv": expected["argv"],
                        "status": "PASS",
                        "exitCode": 0,
                        "resultCommit": result_pin["commit"],
                        "resultTree": result_pin["tree"],
                        "executedAt": "2026-10-12T08:24:00Z",
                        "executionBinding": {
                            "mode": "POST_COMMIT_EXACT_RESULT",
                            "testedTree": result_pin["tree"],
                            "authorityStatus": "GIT_COMMIT_BOUND_EXACT_RESULT",
                        },
                        "output": output_pins[command_id],
                    }
                )
            module_evidence = materializer.sealed(
                {
                    "schema": "dwp.hris.g7-sys-hrm-module-test-evidence-input.v3",
                    "evidenceId": "FIXTURE-MODULE-EVIDENCE",
                    "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
                    "authorityStatus": "CONTROL_AUTHORED_RESULT_EVIDENCE",
                    "closedSet": materializer.EXPECTED_TEST_CLOSED_SET,
                    "results": evidence_rows,
                }
            )
            self.write_json(frontend, evidence_path, module_evidence)
            plan_commands = copy.deepcopy(materializer.EXPECTED_SHARED_COMMANDS)
            shared_plan = materializer.sealed(
                {
                    "schema": "dwp.hris.g7-sys-hrm-shared-verification-plan.v3",
                    "planId": "FIXTURE-SHARED-PLAN",
                    "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
                    "authorityStatus": "CONTROL_PROPOSAL_NOT_PREDECESSOR_AUTHORITY",
                    "basis": materializer.EXPECTED_SHARED_BASIS,
                    "requiredCategories": materializer.REQUIRED_SHARED_CATEGORIES,
                    "closedSet": [row["commandId"] for row in plan_commands],
                    "commands": plan_commands,
                    "rerunPolicy": "ONE_SHARED_BATCH_NO_PER_FIX_FULL_RERUN",
                }
            )
            self.write_json(frontend, plan_path, shared_plan)
            input_carrier = self.commit_all(
                frontend, "Control input evidence", "2026-10-12T08:30:00Z"
            )
            self.push(frontend, frontend_branch)

            with ExitStack() as stack:
                stack.enter_context(patch.object(materializer, "CENTRAL_BRANCHES", central_materializer))
                stack.enter_context(patch.object(validator, "CENTRAL", central_validator))
                for module in (materializer, validator):
                    stack.enter_context(patch.object(module, "R2_PROMOTION_CARRIER_COMMIT", promotion_commit))
                    stack.enter_context(patch.object(module, "R2_PROMOTION_CARRIER_TREE", promotion_tree))
                    stack.enter_context(
                        patch.object(
                            module,
                            "R2_PROMOTION_RECEIPT_SHA256",
                            hashlib.sha256(promotion_raw).hexdigest(),
                        )
                    )

                with self.assertRaises(materializer.GateError):
                    materializer.build_authorization(
                        run_id,
                        frontend,
                        backend,
                        input_carrier,
                        require_admission_current=True,
                    )
                admission = materializer.build_admission(
                    run_id,
                    frontend,
                    backend,
                    module_repos,
                    input_carrier,
                    evidence_path,
                    plan_path,
                    require_input_current=True,
                )
                admission_path = materializer.artifact_rel(run_id, "result-admission.v3.json")
                materializer.write_once(frontend, admission_path, admission)
                admission_carrier = self.commit_all(
                    frontend, "result admission", "2026-10-12T08:31:00Z"
                )
                self.push(frontend, frontend_branch)
                validator.verify_admission(
                    frontend, backend, run_id, admission_carrier, require_current=True
                )

                authorization = materializer.build_authorization(
                    run_id,
                    frontend,
                    backend,
                    admission_carrier,
                    require_admission_current=True,
                )
                authorization_path = materializer.artifact_rel(
                    run_id, "integration-authorization.v3.json"
                )
                materializer.write_once(frontend, authorization_path, authorization)
                authorization_carrier = self.commit_all(
                    frontend, "integration authorization", "2026-10-12T08:32:00Z"
                )
                self.push(frontend, frontend_branch)
                validator.verify_authorization(
                    frontend,
                    backend,
                    run_id,
                    authorization_carrier,
                    require_current=True,
                )

                for index, module in enumerate(("SYS", "HRM"), start=1):
                    result_branch = module_specs[(module, "frontend")][3]
                    self.git_run(
                        frontend,
                        "fetch",
                        "-q",
                        "origin",
                        f"{result_branch}:refs/remotes/origin/{result_branch}",
                    )
                    environment = os.environ.copy()
                    environment["GIT_COMMITTER_DATE"] = f"2026-10-12T08:{32 + index}:00Z"
                    self.git_run(
                        frontend,
                        "cherry-pick",
                        result_pins[(module, "frontend")]["commit"],
                        env=environment,
                    )
                frontend_integrated = self.git(frontend, "rev-parse", "HEAD")
                self.push(frontend, frontend_branch)
                for index, module in enumerate(("SYS", "HRM"), start=1):
                    result_branch = module_specs[(module, "backend")][3]
                    self.git_run(
                        backend,
                        "fetch",
                        "-q",
                        "origin",
                        f"{result_branch}:refs/remotes/origin/{result_branch}",
                    )
                    environment = os.environ.copy()
                    environment["GIT_COMMITTER_DATE"] = f"2026-10-12T08:{34 + index}:00Z"
                    self.git_run(
                        backend,
                        "cherry-pick",
                        result_pins[(module, "backend")]["commit"],
                        env=environment,
                    )
                backend_integrated = self.git(backend, "rev-parse", "HEAD")
                self.push(backend, backend_branch)

                with self.assertRaises(materializer.GateError):
                    materializer.build_closure(
                        run_id,
                        frontend,
                        backend,
                        authorization_carrier,
                        frontend_integrated,
                        backend_integrated,
                        (run_root / "missing-shared-evidence.json").as_posix(),
                        frontend_integrated,
                        require_shared_current=True,
                    )

                stub_path = root / "exact-command-stub.py"
                report_path = root / "playwright-1.58-report.json"
                runner_source_pins = {
                    "frontend": {
                        "commit": frontend_integrated,
                        "tree": self.git(frontend, "rev-parse", f"{frontend_integrated}^{{tree}}"),
                    },
                    "backend": {
                        "commit": backend_integrated,
                        "tree": self.git(backend, "rev-parse", f"{backend_integrated}^{{tree}}"),
                    },
                }
                report_path.write_text(
                    json.dumps(
                        self.playwright_report(source_pins=runner_source_pins),
                        separators=(",", ":"),
                    ),
                    encoding="utf-8",
                )
                semantic_outputs: dict[str, Path] = {}
                for index, command_id in enumerate(
                    materializer.EXPECTED_SHARED_CLOSED_SET, start=1
                ):
                    output_path = root / f"runner-output-{index:02d}.bin"
                    if command_id == materializer.PLAYWRIGHT_COMMAND_ID:
                        output_path.write_bytes(report_path.read_bytes())
                    else:
                        output_path.write_bytes(
                            self.semantic_stdout(command_id, frontend)
                        )
                    semantic_outputs[command_id] = output_path
                stub_path.write_text(
                    "import json, os, pathlib, sys\n"
                    "command_id = sys.argv[1]\n"
                    "output_path = pathlib.Path(sys.argv[2])\n"
                    "report = json.loads(pathlib.Path(sys.argv[3]).read_text(encoding='utf-8'))\n"
                    "annotations = {row['type']: row['description'] for row in report['suites'][0]['specs'][0]['tests'][0]['annotations']}\n"
                    "environment = {'G7_FRONTEND_SOURCE_COMMIT': 'g7-frontend-source-commit', 'G7_FRONTEND_SOURCE_TREE': 'g7-frontend-source-tree', 'G7_BACKEND_SOURCE_COMMIT': 'g7-backend-source-commit', 'G7_BACKEND_SOURCE_TREE': 'g7-backend-source-tree'}\n"
                    "if any(os.environ.get(name) != annotations[kind] for name, kind in environment.items()):\n"
                    "    raise SystemExit(9)\n"
                    "if command_id not in "
                    + repr(materializer.EXPECTED_SHARED_CLOSED_SET)
                    + ":\n"
                    "    raise SystemExit(8)\n"
                    "sys.stdout.buffer.write(output_path.read_bytes())\n",
                    encoding="utf-8",
                )
                invoked: list[str] = []

                def resolve_stub(command: dict[str, object]) -> list[str]:
                    command_id = str(command["commandId"])
                    invoked.append(command_id)
                    return [
                        sys.executable,
                        str(stub_path),
                        command_id,
                        str(semantic_outputs[command_id]),
                        str(report_path),
                    ]

                instant = datetime(2026, 10, 12, 8, 37, tzinfo=timezone.utc)
                clock_values = iter(
                    [instant + timedelta(seconds=index) for index in range(14)]
                )
                shared_evidence_relative = materializer.run_shared_batch(
                    run_id,
                    frontend,
                    backend,
                    authorization_carrier,
                    frontend_integrated,
                    backend_integrated,
                    _test_argv_resolver=resolve_stub,
                    _test_clock=lambda: next(clock_values),
                )
                self.assertEqual(materializer.EXPECTED_SHARED_CLOSED_SET, invoked)
                shared_evidence_path = shared_evidence_relative.as_posix()
                shared_evidence = json.loads(
                    (frontend / shared_evidence_relative).read_text(encoding="utf-8")
                )
                self.assertEqual(
                    materializer.SELF_TEST_EXECUTION_MODE,
                    shared_evidence["runner"]["executionMode"],
                )
                self.assertEqual(
                    materializer.RUNNER_GENESIS_SHA256,
                    shared_evidence["results"][0]["previousRecordSha256"],
                )
                shared_carrier = self.commit_all(
                    frontend, "shared evidence", "2026-10-12T08:39:00Z"
                )
                self.push(frontend, frontend_branch)

                with self.assertRaises(materializer.GateError):
                    materializer.build_closure(
                        run_id,
                        frontend,
                        backend,
                        authorization_carrier,
                        frontend_integrated,
                        backend_integrated,
                        shared_evidence_path,
                        shared_carrier,
                        require_shared_current=True,
                    )
                closure = materializer.build_closure(
                    run_id,
                    frontend,
                    backend,
                    authorization_carrier,
                    frontend_integrated,
                    backend_integrated,
                    shared_evidence_path,
                    shared_carrier,
                    require_shared_current=True,
                    allow_test_mode=True,
                )
                closure_path = materializer.artifact_rel(run_id, "integrated-closure.v3.json")
                materializer.write_once(frontend, closure_path, closure)
                closure_carrier = self.commit_all(
                    frontend, "integrated closure", "2026-10-12T08:40:00Z"
                )
                self.push(frontend, frontend_branch)
                with self.assertRaises(validator.ValidationError):
                    validator.verify_closure(
                        frontend,
                        backend,
                        run_id,
                        closure_carrier,
                    )
                validator.verify_closure(
                    frontend,
                    backend,
                    run_id,
                    closure_carrier,
                    allow_test_mode=True,
                )

                schema_values = [
                    ("module-test-evidence-input.schema.v3.json", module_evidence),
                    ("shared-verification-plan.schema.v3.json", shared_plan),
                    ("shared-verification-evidence-input.schema.v3.json", shared_evidence),
                    ("result-admission-receipt.schema.v3.json", admission),
                    ("integration-authorization-receipt.schema.v3.json", authorization),
                    ("closure-receipt.schema.v3.json", closure),
                ]
                for schema_name, receipt in schema_values:
                    schema = json.loads(
                        (materializer.HERE / "contracts" / schema_name).read_text(
                            encoding="utf-8"
                        )
                    )
                    validate_schema_fixture(receipt, schema)

                admission_tamper = copy.deepcopy(admission)
                admission_tamper["moduleResults"][0]["worktrees"][0]["unexpected"] = True
                authorization_tamper = copy.deepcopy(authorization)
                authorization_tamper["authority"]["effectiveAfterCarrier"]["futureCarrierCommit"] = "0" * 40
                closure_tamper = copy.deepcopy(closure)
                closure_tamper["centralIntegration"]["repositories"]["frontend"]["integrated"]["unexpected"] = True
                shared_tamper = copy.deepcopy(shared_evidence)
                shared_tamper["results"][0]["stdout"]["unexpected"] = True
                module_tamper = copy.deepcopy(module_evidence)
                module_tamper["results"][0]["executionBinding"]["unexpected"] = True
                for schema_name, tampered in (
                    ("module-test-evidence-input.schema.v3.json", module_tamper),
                    ("shared-verification-evidence-input.schema.v3.json", shared_tamper),
                    ("result-admission-receipt.schema.v3.json", admission_tamper),
                    ("integration-authorization-receipt.schema.v3.json", authorization_tamper),
                    ("closure-receipt.schema.v3.json", closure_tamper),
                ):
                    schema = json.loads(
                        (materializer.HERE / "contracts" / schema_name).read_text(
                            encoding="utf-8"
                        )
                    )
                    with self.assertRaises(SchemaFixtureError):
                        validate_schema_fixture(tampered, schema)

                self.assertEqual(
                    {
                        input_carrier,
                        admission_carrier,
                        authorization_carrier,
                        shared_carrier,
                        closure_carrier,
                    },
                    materializer.run_history_commits(frontend, run_id),
                )

    def test_run_id_delete_then_reuse_and_reserved_input_collision_fail(self) -> None:
        run_id = "reuse-attack"
        reserved = materializer.artifact_rel(
            run_id, "integration-authorization.v3.json"
        ).as_posix()
        with self.assertRaises(materializer.GateError):
            materializer.assert_distinct_non_reserved_run_inputs(
                run_id, [reserved], "fixture"
            )
        with self.assertRaises(validator.ValidationError):
            validator.assert_distinct_non_reserved_run_inputs(
                run_id, [reserved], "fixture"
            )
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            self.configure_repo(repo)
            self.write_bytes(repo, "base.txt", b"base\n")
            self.commit_all(repo, "base", "2026-10-12T07:00:00Z")
            historical_path = (
                materializer.run_root_rel(run_id) / "historical.json"
            ).as_posix()
            self.write_bytes(repo, historical_path, b"{}\n")
            self.commit_all(repo, "historical run", "2026-10-12T07:01:00Z")
            (repo / historical_path).unlink()
            self.commit_all(repo, "delete historical run", "2026-10-12T07:02:00Z")
            input_path = (materializer.run_root_rel(run_id) / "input.json").as_posix()
            self.write_bytes(repo, input_path, b"{}\n")
            reused_input = self.commit_all(repo, "reuse run id", "2026-10-12T07:03:00Z")
            with self.assertRaises(materializer.GateError):
                materializer.assert_run_never_preexisted(repo, run_id, reused_input)
            with self.assertRaises(validator.ValidationError):
                validator.assert_run_never_preexisted(repo, run_id, reused_input)

    def test_real_git_carrier_requires_exact_parent_and_sole_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            subprocess.run(["git", "-C", str(repo), "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", str(repo), "config", "user.name", "R3 Test"], check=True)
            (repo / "input.txt").write_text("evidence\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "add", "input.txt"], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-q", "-m", "input"], check=True)
            input_commit = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
            artifact = "runs/fresh/result-admission.v3.json"
            (repo / artifact).parent.mkdir(parents=True)
            (repo / artifact).write_text("{}\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "add", artifact], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-q", "-m", "admission"], check=True)
            admission = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
            validator.assert_carrier_shape(repo, admission, input_commit, artifact, "fixture")
            (repo / "extra.txt").write_text("tamper\n", encoding="utf-8")
            (repo / "runs/fresh/integration-authorization.v3.json").write_text("{}\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-q", "-m", "bad carrier"], check=True)
            bad = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
            with self.assertRaises(validator.ValidationError):
                validator.assert_carrier_shape(
                    repo,
                    bad,
                    admission,
                    "runs/fresh/integration-authorization.v3.json",
                    "fixture",
                )
            old_time_artifact = "runs/fresh/old-time.json"
            (repo / old_time_artifact).write_text("{}\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "add", old_time_artifact], check=True)
            environment = os.environ.copy()
            environment["GIT_AUTHOR_DATE"] = "2000-01-01T00:00:00Z"
            environment["GIT_COMMITTER_DATE"] = "2000-01-01T00:00:00Z"
            subprocess.run(
                ["git", "-C", str(repo), "commit", "-q", "-m", "old timestamp"],
                check=True,
                env=environment,
            )
            old_time = subprocess.check_output(
                ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True
            ).strip()
            with self.assertRaises(validator.ValidationError):
                validator.assert_carrier_shape(
                    repo, old_time, bad, old_time_artifact, "fixture"
                )

    def test_shared_test_source_carrier_applies_patch_and_rejects_tamper(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            remote = root / "origin.git"
            repo = root / "repo"
            subprocess.run(["git", "init", "--bare", "-q", str(remote)], check=True)
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            self.configure_repo(repo)
            self.git_run(repo, "remote", "add", "origin", str(remote))
            self.git_run(repo, "checkout", "-q", "-b", "base")
            self.write_bytes(repo, "base.txt", b"base\n")
            preimages = {
                path_value: f"before {index}\n".encode("utf-8")
                for index, path_value in enumerate(
                    materializer.CONTROL_PREREQUISITE_PATHS, start=1
                )
            }
            postimages = {
                path_value: f"after {index}\n".encode("utf-8")
                for index, path_value in enumerate(
                    materializer.CONTROL_PREREQUISITE_PATHS, start=1
                )
            }
            for path_value, raw in preimages.items():
                self.write_bytes(repo, path_value, raw)
            self.commit_all(repo, "base", "2026-10-12T07:00:00Z")
            for path_value, raw in postimages.items():
                self.write_bytes(repo, path_value, raw)
            patch_raw = subprocess.check_output(
                [
                    "git",
                    "-C",
                    str(repo),
                    "diff",
                    "--full-index",
                    "--no-ext-diff",
                    "--no-renames",
                    "--",
                    *materializer.CONTROL_PREREQUISITE_PATHS,
                ]
            )
            for path_value, raw in preimages.items():
                self.write_bytes(repo, path_value, raw)
            self.write_bytes(
                repo,
                materializer.CONTROL_PREREQUISITES_PATCH_PATH,
                patch_raw,
            )
            tooling = self.commit_all(
                repo, "tooling with pinned patch", "2026-10-12T07:01:00Z"
            )
            self.push(repo, "base", set_upstream=True)

            def verification_stack(branch_name: str) -> ExitStack:
                stack = ExitStack()
                stack.enter_context(
                    patch.object(
                        materializer,
                        "CENTRAL_BRANCHES",
                        {"frontend": (branch_name, f"origin/{branch_name}")},
                    )
                )
                stack.enter_context(
                    patch.object(
                        validator,
                        "CENTRAL",
                        {
                            "frontend": {
                                "branch": branch_name,
                                "upstream": f"origin/{branch_name}",
                            }
                        },
                    )
                )
                stack.enter_context(
                    patch.object(materializer, "verify_tooling_carrier", return_value=None)
                )
                stack.enter_context(
                    patch.object(validator, "verify_tooling_carrier", return_value=None)
                )
                return stack

            self.git_run(repo, "checkout", "-q", "-b", "prepared", tooling)
            self.push(repo, "prepared", set_upstream=True)
            with verification_stack("prepared"):
                prepared = materializer.prepare_shared_test_source(repo, tooling)
                self.assertEqual(
                    [
                        *materializer.CONTROL_PREREQUISITE_PATHS,
                        materializer.SHARED_TEST_SOURCE_PATH,
                    ],
                    [path_value.as_posix() for path_value in prepared],
                )
                prepared_carrier = self.commit_all(
                    repo, "prepared source", "2026-10-12T07:02:00Z"
                )
                self.push(repo, "prepared")
                materialized, _ = materializer.verify_shared_test_source_carrier(
                    repo, prepared_carrier, require_current=True
                )
                independently_verified, _ = validator.verify_shared_test_source_carrier(
                    repo, prepared_carrier, require_current=True
                )
                self.assertEqual(materialized, independently_verified)
                self.assertTrue(
                    materialized["exactControlPrerequisites"][
                        "patchMatchesModifiedDiff"
                    ]
                )

            def create_tampered_carrier(
                branch_name: str,
                *,
                source_raw: bytes = materializer.SHARED_TEST_SOURCE_BYTES,
                extra_path: str | None = None,
                tamper_patch_path: str | None = None,
            ) -> str:
                self.git_run(repo, "checkout", "-q", "-b", branch_name, tooling)
                for path_value, raw in postimages.items():
                    self.write_bytes(repo, path_value, raw)
                if tamper_patch_path is not None:
                    self.write_bytes(repo, tamper_patch_path, b"tampered postimage\n")
                self.write_bytes(repo, materializer.SHARED_TEST_SOURCE_PATH, source_raw)
                if extra_path is not None:
                    self.write_bytes(repo, extra_path, b"pollution\n")
                carrier = self.commit_all(
                    repo, branch_name, "2026-10-12T07:03:00Z"
                )
                self.push(repo, branch_name, set_upstream=True)
                return carrier

            def verify_fails(branch_name: str, carrier: str) -> None:
                with verification_stack(branch_name):
                    with self.assertRaises(materializer.GateError):
                        materializer.verify_shared_test_source_carrier(
                            repo, carrier, require_current=True
                        )
                    with self.assertRaises(validator.ValidationError):
                        validator.verify_shared_test_source_carrier(
                            repo, carrier, require_current=True
                        )

            polluted = create_tampered_carrier(
                "polluted", extra_path="unexpected.txt"
            )
            verify_fails("polluted", polluted)

            wrong = create_tampered_carrier(
                "wrong-bytes",
                source_raw=(
                    b"import { test } from '@playwright/test';\n"
                    b"test('fake', () => {});\n"
                ),
            )
            verify_fails("wrong-bytes", wrong)

            mismatched_patch = create_tampered_carrier(
                "wrong-patch",
                tamper_patch_path=materializer.CONTROL_PREREQUISITE_PATHS[0],
            )
            verify_fails("wrong-patch", mismatched_patch)

    def test_real_git_manifest_detects_extra_integration_change(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            subprocess.run(["git", "-C", str(repo), "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", str(repo), "config", "user.name", "R3 Test"], check=True)
            (repo / "domain").mkdir()
            (repo / "domain/item.txt").write_text("base\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-q", "-m", "base"], check=True)
            base = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
            (repo / "domain/item.txt").write_text("result\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "commit", "-qam", "result"], check=True)
            result = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
            expected = materializer.file_manifest(repo, base, result)
            self.assertEqual(expected, validator.changed_manifest(repo, base, result))
            (repo / "unexpected.txt").write_text("extra\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-q", "-m", "extra"], check=True)
            tampered = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
            self.assertNotEqual(expected, validator.changed_manifest(repo, base, tampered))

    def test_authorization_self_reference_is_rule_not_future_commit_pin(self) -> None:
        readme = (materializer.HERE / "README.md").read_text(encoding="utf-8")
        source = (materializer.HERE / "materialize_g7_sys_hrm_result_acceptance.py").read_text(encoding="utf-8")
        self.assertIn("AUTHORIZATION_CARRIER_COMMIT_EXACT", readme)
        self.assertIn('"rule": "AUTHORIZATION_CARRIER_COMMIT_EXACT"', source)
        self.assertIn("assert_carrier_shape", (materializer.HERE / "validate_g7_sys_hrm_result_acceptance.py").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
