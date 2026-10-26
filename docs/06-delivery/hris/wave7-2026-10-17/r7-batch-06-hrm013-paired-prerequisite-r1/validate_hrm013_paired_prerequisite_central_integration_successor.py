#!/usr/bin/env python3
"""Stable append-only validation for the HRM-013 paired integration evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parents[4]
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
FRONTEND_EVIDENCE_COMMIT = "6cbf4f1e7ac9831c25edbaec4ff51df0641b4c51"
FRONTEND_EVIDENCE_TREE = "0d74712da16d2ce746820acc133e4d4484ae0088"
BACKEND_EVIDENCE_COMMIT = "c50b267e7b015758ab6f7acc7fdf353eee81e631"
BACKEND_EVIDENCE_TREE = "22bd6533ab340cfb91c6cf5ab5fd6991e501e6c4"
V1_RECEIPT = (10335, "4678544555e3747acd880f83571a05239e749d20933955b8efd38f117e9cb339")
V1_VALIDATOR = (11429, "90f49a7975b1c87321086ad6f67345cdf881e0063fd9d0397585a05c64a2ab1f")
EMPTY_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

OPTIONAL_TEST_XML = {
    "dwp-approval-server/build/test-results/test/TEST-com.dwp.services.approval.hrisbridge.separation.HrisSeparationWaiverMigrationPostgresTest.xml": (63713, "91a73b9b40fe84a1f8bb441957d3698b47e1fd7438241e3dc03d757a249c0a80", 3),
    "dwp-approval-server/build/test-results/test/TEST-com.dwp.services.approval.hrisbridge.separation.HrisSeparationWaiverStoresPostgresTest.xml": (175759, "fe04a7a2a94d2e92904ae0eb4ac589f0a67674f381b46f2ed1d3a6a2fd363547", 10),
    "dwp-approval-server/build/test-results/test/TEST-com.dwp.services.approval.hrisbridge.HrisEmployeeChangeBridgeMigrationPostgresTest.xml": (23848, "b6d7596b461845fed2d1513d61c00e986c1c6130a532375f6596c41e0e9cda01", 1),
    "dwp-approval-server/build/test-results/test/TEST-com.dwp.services.approval.hrisbridge.HrisApprovalBindingLedgerPostgresTest.xml": (18479, "2ebdb49d22216a44091e25c898adefb0151d0e4ca4b0b0e5750496fc4c541be2", 1),
    "dwp-people-server/build/test-results/test/TEST-com.dwp.services.people.hris.separation.hrm013.Hrm013PrerequisiteStoresPostgresTest.xml": (74063, "0e793d435d35691aeb305aadd323b979f5cd513398e4dff34dda777a737869d0", 4),
    "dwp-people-server/build/test-results/test/TEST-com.dwp.services.people.hris.separation.hrm013.Hrm013ServiceAuthorityPortTest.xml": (859, "a26b2a8063695ba9040922f3b22aa0eb424dba57945f4447e49c2fa6f7694ff6", 3),
    "dwp-people-server/build/test-results/test/TEST-com.dwp.services.people.hris.separation.hrm013.Hrm013V61MigrationContractTest.xml": (1269, "5ddf3fd5fef6ed3286a094e92ef3943516b0bfd1f01afbb83335bad17e0fa61a", 5),
    "dwp-people-server/build/test-results/test/TEST-com.dwp.services.people.hris.separation.hrm013.Hrm013V61MigrationPostgresTest.xml": (149601, "38b38d6eda3fca7110cd168f96ea146d25e00b89433f30275a2367e9bfda9f63", 7),
    "dwp-people-server/build/test-results/test/TEST-com.dwp.services.people.integration.Hrm012V60MigrationPostgresTest.xml": (45176, "1831bf235f5a3f40bbc2e4cb1ee8c292b28a1faddccf26a892c7559a8cc70a74", 2),
}


def run(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise RuntimeError(f"{' '.join(args)} failed in {cwd}: {result.stderr.decode(errors='replace').strip()}")
    return result


def text(cwd: Path, *args: str) -> str:
    return run(cwd, *args).stdout.decode().strip()


def digest(data: bytes) -> tuple[int, str]:
    return len(data), hashlib.sha256(data).hexdigest()


def digest_file(path: Path) -> tuple[int, str]:
    return digest(path.read_bytes())


def is_ancestor(repo: Path, ancestor: str, descendant: str) -> bool:
    return run(repo, "git", "merge-base", "--is-ancestor", ancestor, descendant, check=False).returncode == 0


parser = argparse.ArgumentParser()
parser.add_argument("--authoring", action="store_true", help="Allow only the two uncommitted v2 carrier files while authoring.")
args = parser.parse_args()

errors: list[str] = []
checks = 0


def require(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        errors.append(message)


v1_receipt_path = HERE / "paired-prerequisite-central-integration-receipt.v1.json"
v1_validator_path = HERE / "validate_hrm013_paired_prerequisite_central_integration.py"
require(digest_file(v1_receipt_path) == V1_RECEIPT, "v1 integration receipt byte/hash drift")
require(digest_file(v1_validator_path) == V1_VALIDATOR, "v1 validator byte/hash drift")

v1 = json.loads(v1_receipt_path.read_text(encoding="utf-8"))
require(v1["state"] == "PAIRED_PREREQUISITE_INTEGRATION_COMPLETE_RUNTIME_MODULE_OWNER_FULL_HRM013_AND_BUSINESS_COMPLETION_WITHHELD", "v1 integration result state drift")
require(v1["verification"]["aggregate"] == {"tests": 36, "failures": 0, "errors": 0, "skipped": 0}, "v1 sealed test aggregate drift")
require(v1["backendFinal"]["head"] == BACKEND_EVIDENCE_COMMIT and v1["backendFinal"]["tree"] == BACKEND_EVIDENCE_TREE, "v1 backend evidence pin drift")
require(v1["artifactPins"]["validator"] == {"path": v1_validator_path.name, "bytes": V1_VALIDATOR[0], "sha256": V1_VALIDATOR[1]}, "v1 validator artifact pin drift")

front_commit = run(FRONTEND, "git", "cat-file", "commit", FRONTEND_EVIDENCE_COMMIT).stdout
front_tree = run(FRONTEND, "git", "ls-tree", "-r", "-z", FRONTEND_EVIDENCE_TREE).stdout
back_commit = run(BACKEND, "git", "cat-file", "commit", BACKEND_EVIDENCE_COMMIT).stdout
back_tree = run(BACKEND, "git", "ls-tree", "-r", "-z", BACKEND_EVIDENCE_TREE).stdout
require(text(FRONTEND, "git", "rev-parse", f"{FRONTEND_EVIDENCE_COMMIT}^{{tree}}") == FRONTEND_EVIDENCE_TREE, "frontend evidence commit/tree mismatch")
require(digest(front_commit) == (250, "2879926988458ff9bfdf94d1531e6b24a10b8add31d7eda78cd6ce188c61daf7"), "frontend evidence commit object drift")
require(digest(front_tree) == (1853886, "398327ead2348d8b9bf18ffab7128bae505dedc8e1f8afd9b8b948661e20df5b"), "frontend evidence tree listing drift")
require(text(BACKEND, "git", "rev-parse", f"{BACKEND_EVIDENCE_COMMIT}^{{tree}}") == BACKEND_EVIDENCE_TREE, "backend evidence commit/tree mismatch")
require(digest(back_commit) == (307, "f7d84b285438bb76131b7cbb4c1e9d41707292961b8b6989be762be1e49bc920"), "backend evidence commit object drift")
require(digest(back_tree) == (1125946, "b63cf83ccc729181bc74498bdc52630793c3a42204f8c4cb2f0cc4a386bd35c3"), "backend evidence tree listing drift")

require(text(FRONTEND, "git", "branch", "--show-current") == "dwp-dev", "frontend checkout is not dwp-dev")
require(text(BACKEND, "git", "branch", "--show-current") == "dwp-dev", "backend checkout is not dwp-dev")
front_head = text(FRONTEND, "git", "rev-parse", "HEAD")
front_origin = text(FRONTEND, "git", "rev-parse", "origin/dwp-dev")
back_head = text(BACKEND, "git", "rev-parse", "HEAD")
back_origin = text(BACKEND, "git", "rev-parse", "origin/dwp-dev")
require(is_ancestor(FRONTEND, FRONTEND_EVIDENCE_COMMIT, front_head), "frontend current HEAD does not contain evidence commit")
require(is_ancestor(FRONTEND, FRONTEND_EVIDENCE_COMMIT, front_origin), "frontend origin/dwp-dev does not contain evidence commit")
require(is_ancestor(BACKEND, BACKEND_EVIDENCE_COMMIT, back_head), "backend current HEAD does not contain integrated commit")
require(is_ancestor(BACKEND, BACKEND_EVIDENCE_COMMIT, back_origin), "backend origin/dwp-dev does not contain integrated commit")
require(is_ancestor(FRONTEND, "3ae4671e4d98c768a5426ae9eb2bb28ac2701f2f", FRONTEND_EVIDENCE_COMMIT), "descendant-semantics self-check failed")

front_remote = run(FRONTEND, "git", "ls-remote", "origin", "refs/heads/dwp-dev").stdout.decode().split()[0]
back_remote = run(BACKEND, "git", "ls-remote", "origin", "refs/heads/dwp-dev").stdout.decode().split()[0]
require(front_remote == front_origin, "frontend remote and origin/dwp-dev are not synchronized")
require(back_remote == back_origin, "backend remote and origin/dwp-dev are not synchronized")

back_status = run(BACKEND, "git", "status", "--porcelain=v1", "-z").stdout
require(back_status == b"", "backend repository must be clean at validation execution")
require(hashlib.sha256(back_status).hexdigest() == EMPTY_SHA, "backend clean porcelain digest drift")
front_status = run(FRONTEND, "git", "status", "--porcelain=v1", "-z").stdout
if args.authoring:
    entries = [entry for entry in front_status.decode().split("\0") if entry]
    allowed = {
        "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-paired-prerequisite-r1/paired-prerequisite-central-integration-receipt-successor.v2.json",
        "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-paired-prerequisite-r1/validate_hrm013_paired_prerequisite_central_integration_successor.py",
    }
    require(all(entry.startswith("?? ") and entry[3:] in allowed for entry in entries), "authoring mode found changes outside the two v2 carrier files")
else:
    require(front_status == b"", "frontend repository must be clean at strict validation execution")

present_xml = 0
present_tests = 0
for relative, (size, sha256, expected_tests) in OPTIONAL_TEST_XML.items():
    path = BACKEND / relative
    if not path.is_file():
        continue
    present_xml += 1
    require(digest_file(path) == (size, sha256), f"present optional JUnit XML drift: {relative}")
    suite = ET.parse(path).getroot()
    tests = int(suite.attrib.get("tests", "0"))
    failures = int(suite.attrib.get("failures", "0"))
    suite_errors = int(suite.attrib.get("errors", "0"))
    skipped = int(suite.attrib.get("skipped", "0"))
    require((tests, failures, suite_errors, skipped) == (expected_tests, 0, 0, 0), f"present optional JUnit result drift: {relative}")
    present_tests += tests
if present_xml == len(OPTIONAL_TEST_XML):
    require(present_tests == 36, "complete optional JUnit set does not total 36 tests")

successor_path = HERE / "paired-prerequisite-central-integration-receipt-successor.v2.json"
require(successor_path.is_file(), "v2 successor receipt missing")
if successor_path.is_file():
    successor = json.loads(successor_path.read_text(encoding="utf-8"))
    require(successor["state"] == "APPEND_ONLY_VALIDATION_SEMANTICS_CORRECTION_INTEGRATION_RESULT_UNCHANGED", "v2 successor state drift")
    require(successor["supersedesValidationSemanticsOnly"]["v1Receipt"] == {"path": v1_receipt_path.name, "bytes": V1_RECEIPT[0], "sha256": V1_RECEIPT[1]}, "v2 v1-receipt pin drift")
    require(successor["supersedesValidationSemanticsOnly"]["v1Validator"] == {"path": v1_validator_path.name, "bytes": V1_VALIDATOR[0], "sha256": V1_VALIDATOR[1]}, "v2 v1-validator pin drift")
    own = digest_file(Path(__file__).resolve())
    require(successor["artifactPins"]["successorValidator"] == {"path": Path(__file__).name, "bytes": own[0], "sha256": own[1]}, "v2 successor-validator pin drift")
    require(successor["sealedIntegrationResult"]["aggregate"] == {"tests": 36, "failures": 0, "errors": 0, "skipped": 0}, "v2 sealed integration aggregate drift")
    require(successor["validationSemantics"]["currentHeadEqualityRequired"] is False, "v2 retains current-HEAD equality")
    require(successor["validationSemantics"]["pinnedEvidenceMustBeAncestorOfCurrentHeadAndOrigin"] is True, "v2 ancestry rule missing")
    require(successor["validationSemantics"]["junitXmlFuturePresenceRequired"] is False, "v2 still requires future JUnit XML")
    authority = successor["authority"]
    require(authority["integrationResultChanged"] is False, "v2 changes integration result")
    require(authority["nextOwnerRuntimeBindingGatePreparationAuthorized"] is True, "next-gate preparation missing")
    for key in ("nextOwnerRuntimeBindingGateImplementationAuthorized", "runtimeActivationAuthorized", "moduleOwnerPacketAuthorized", "fullHrm013ModuleImplementationAuthorized", "businessCompletionClaimed"):
        require(authority[key] is False, f"v2 forbidden authority true: {key}")
    require(authority["businessCompletionCredit"] == 0, "v2 business completion credit must remain zero")

result = {
    "validator": Path(__file__).name,
    "mode": "AUTHORING" if args.authoring else "STRICT_CLEAN",
    "state": "PASS" if not errors else "FAIL",
    "checks": checks,
    "errorsCount": len(errors),
    "p0": len(errors),
    "optionalJUnitXmlPresent": present_xml,
    "optionalJUnitTestsObserved": present_tests,
    "errors": errors,
}
print(json.dumps(result, ensure_ascii=False, sort_keys=True))
sys.exit(0 if not errors else 1)
